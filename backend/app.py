import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi import FastAPI, File, UploadFile, Header, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import math, tempfile, joblib, numpy as np
from pathlib import Path
from dotenv import load_dotenv
import librosa

# Firebase + Supabase
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from supabase import create_client

# Local import for feature extraction
from ml_training.train_audio_features import extract_features

# ============================================================
# ⚙️ Environment and Model Setup
# ============================================================
load_dotenv()
BASE_DIR = Path(__file__).resolve().parents[1]
MODEL_DIR = BASE_DIR / "ml_training" / "models"

# Load models
audio_bundle = joblib.load(MODEL_DIR / "audio_parkinson_model_calibrated.pkl")
audio_model, audio_scaler = audio_bundle["model"], audio_bundle.get("scaler", None)

pca_bridge = joblib.load(MODEL_DIR / "audio_pca22_bridge.pkl")["pipeline"]
fusion_bundle = joblib.load(MODEL_DIR / "fusion_meta_model_pca22.pkl")
fusion_model = fusion_bundle["meta_model"]

print("✅ All models loaded successfully (Audio + PCA Bridge + Fusion)")

# ============================================================
# 🌐 FastAPI Configuration
# ============================================================
app = FastAPI(title="Parkinson Detection Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# 🔐 Firebase Authentication
# ============================================================
FIREBASE_PRIVATE_KEY = os.getenv("FIREBASE_PRIVATE_KEY")
FIREBASE_CLIENT_EMAIL = os.getenv("FIREBASE_CLIENT_EMAIL")
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID")

if FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL and FIREBASE_PROJECT_ID:
    cred_dict = {
        "type": "service_account",
        "project_id": FIREBASE_PROJECT_ID,
        "private_key_id": "dummy_key_id",
        "private_key": FIREBASE_PRIVATE_KEY.replace('\\n', '\n'),
        "client_email": FIREBASE_CLIENT_EMAIL,
        "client_id": "dummy_client_id",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{FIREBASE_CLIENT_EMAIL}"
    }
    try:
        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred)
    except Exception:
        pass
else:
    print("⚠️ Firebase credentials missing — token verification disabled.")

# ============================================================
# 🗃️ Supabase Setup
# ============================================================
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET")

supabase = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    print("⚠️ Supabase not configured — database features disabled.")

# ============================================================
# 🧠 Verify Token
# ============================================================
def verify_token(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    token = authorization.split(" ", 1)[1] if authorization.lower().startswith("bearer ") else authorization
    try:
        decoded = firebase_auth.verify_id_token(token)
        return decoded
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

# ============================================================
# 🎵 Predict from File (Audio + PCA Bridge)
# ============================================================
def predict_from_file(file_path: str):
    # 1️⃣ Extract full 920D audio features
    feats = extract_features(file_path)
    feats = np.nan_to_num(feats).reshape(1, -1)

    # 2️⃣ Audio (Full) model prediction
    if audio_scaler is not None:
        x_audio = audio_scaler.transform(feats)
    else:
        print("⚠️ No scaler found in model — using raw features.")
        x_audio = feats
    p_audio = float(audio_model.predict_proba(x_audio)[0, 1])

    # 3️⃣ PCA(22) Bridge prediction
    p_pca22 = float(pca_bridge.predict_proba(feats)[0, 1])

    # 4️⃣ Fusion model prediction
    f_input = np.array([[p_pca22, p_audio]])
    p_fusion = float(fusion_model.predict_proba(f_input)[0, 1])

    label = "Parkinson" if p_fusion >= 0.5 else "Healthy"
    return label, p_audio, p_pca22, p_fusion

# ============================================================
# 📤 Upload Endpoint (Audio + PCA Fusion)
# ============================================================
@app.post("/upload")
async def upload(file: UploadFile = File(...), user: dict = Depends(verify_token)):
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    content = await file.read()
    tmp.write(content)
    tmp.flush()
    tmp.close()

    if os.path.getsize(tmp.name) < 1000:
        raise HTTPException(status_code=400, detail="Invalid or empty audio file uploaded.")

    # Upload to Supabase
    storage_path = f"{user['uid']}/{file.filename}"
    public_url = None
    if supabase and SUPABASE_BUCKET:
        try:
            with open(tmp.name, "rb") as f:
                supabase.storage.from_(SUPABASE_BUCKET).upload(storage_path, f)
            public_url = supabase.storage.from_(SUPABASE_BUCKET).get_public_url(storage_path)
        except Exception as e:
            print("⚠️ Supabase upload error:", e)

    # Run inference
    label, p_audio, p_pca22, p_fusion = predict_from_file(tmp.name)

    print(f"🎧 Audio(920D)={p_audio:.3f} | PCA(22)={p_pca22:.3f} | 🧠 Fusion={p_fusion:.3f}")

    def clean_json(obj):
        if isinstance(obj, np.ndarray):
            return [clean_json(x) for x in obj.tolist()]
        elif isinstance(obj, list):
            return [clean_json(x) for x in obj]
        elif isinstance(obj, dict):
            return {k: clean_json(v) for k, v in obj.items()}
        elif isinstance(obj, float):
            if math.isnan(obj) or math.isinf(obj):
                return 0.0
            return float(obj)
        else:
            return obj

    data = {
        "user_id": user["uid"],
        "audio_full_proba": p_audio,
        "pca22_proba": p_pca22,
        "fusion_proba": p_fusion,
        "final_label": label,
        "audio_url": public_url,
    }

    if supabase:
        try:
            res = supabase.table("results").insert(data).execute()
            print("✅ Supabase insert success:", res)
        except Exception as e:
            print("⚠️ Supabase insert error:", e)

    return JSONResponse(clean_json(data))

# ============================================================
# 📊 User Results
# ============================================================
@app.get("/user/results")
def get_user_results(user: dict = Depends(verify_token)):
    if not supabase:
        return {"results": []}
    uid = user["uid"]
    res = supabase.table("results").select("*").eq("user_id", uid).order("created_at", desc=True).execute()
    return {"results": res.data}

# ============================================================
# 🏠 Root
# ============================================================
@app.get("/")
def root():
    return {"message": "✅ Parkinson AI backend running with PCA(22) + Fusion"}
