import sys, os, math, tempfile, joblib, numpy as np, librosa
from pathlib import Path
from fastapi import FastAPI, File, UploadFile, Header, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

# Firebase + Supabase
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from supabase import create_client

# Gemini AI
import google.generativeai as genai

# Local import
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from ml_training.train_audio_features import extract_features


# ============================================================
# ⚙️ ENVIRONMENT + MODEL SETUP
# ============================================================
load_dotenv()
BASE_DIR = Path(__file__).resolve().parents[1]
MODEL_DIR = BASE_DIR / "ml_training" / "models"

# Load Models
audio_bundle = joblib.load(MODEL_DIR / "audio_parkinson_model_calibrated.pkl")
audio_model, audio_scaler = audio_bundle["model"], audio_bundle.get("scaler", None)

pca_bridge = joblib.load(MODEL_DIR / "audio_pca22_bridge.pkl")["pipeline"]
fusion_bundle = joblib.load(MODEL_DIR / "fusion_meta_model_pca22.pkl")
fusion_model = fusion_bundle["meta_model"]

print("✅ All models loaded successfully (Audio + PCA Bridge + Fusion)")

# ============================================================
# 🌐 FASTAPI CONFIG
# ============================================================
app = FastAPI(title="Parkinson Detection Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or restrict to frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# 🔐 FIREBASE
# ============================================================
FIREBASE_PRIVATE_KEY = os.getenv("FIREBASE_PRIVATE_KEY")
FIREBASE_CLIENT_EMAIL = os.getenv("FIREBASE_CLIENT_EMAIL")
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID")

if FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL and FIREBASE_PROJECT_ID:
    cred_dict = {
        "type": "service_account",
        "project_id": FIREBASE_PROJECT_ID,
        "private_key_id": "dummy_key_id",
        "private_key": FIREBASE_PRIVATE_KEY.replace("\\n", "\n"),
        "client_email": FIREBASE_CLIENT_EMAIL,
        "client_id": "dummy_client_id",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{FIREBASE_CLIENT_EMAIL}",
    }
    try:
        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred)
        print("✅ Firebase initialized")
    except Exception as e:
        print("⚠️ Firebase already initialized or error:", e)
else:
    print("⚠️ Firebase credentials missing")

# ============================================================
# 🗃️ SUPABASE
# ============================================================
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "audio-uploads")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

# ============================================================
# 🤖 GEMINI AI
# ============================================================
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    print("✅ Gemini AI configured")
else:
    print("⚠️ Gemini API key missing")

# ============================================================
# 🧠 VERIFY TOKEN
# ============================================================
def verify_token(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    token = authorization.split(" ", 1)[1] if authorization.lower().startswith("bearer ") else authorization
    try:
        return firebase_auth.verify_id_token(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

# ============================================================
# 🎵 PREDICTION PIPELINE
# ============================================================
def predict_from_file(file_path: str):
    # Extract 920D features
    feats = extract_features(file_path)
    feats = np.nan_to_num(feats).reshape(1, -1)

    # Audio (920D)
    if audio_scaler is not None:
        x_audio = audio_scaler.transform(feats)
    else:
        print("⚠️ No scaler found — using raw features.")
        x_audio = feats
    p_audio = float(audio_model.predict_proba(x_audio)[0, 1])

    # PCA(22)
    p_pca22 = float(pca_bridge.predict_proba(feats)[0, 1])

    # Fusion
    f_input = np.array([[p_pca22, p_audio]])
    p_fusion = float(fusion_model.predict_proba(f_input)[0, 1])

    label = "Parkinson" if p_fusion >= 0.5 else "Healthy"
    return label, p_audio, p_pca22, p_fusion


# ============================================================
# 🧹 JSON CLEANER
# ============================================================
def clean_json(obj):
    if isinstance(obj, np.ndarray):
        return [clean_json(x) for x in obj.tolist()]
    if isinstance(obj, (list, tuple)):
        return [clean_json(x) for x in obj]
    if isinstance(obj, dict):
        return {k: clean_json(v) for k, v in obj.items()}
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return 0.0
        return float(obj)
    return obj

# ============================================================
# 📤 UPLOAD ENDPOINT
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

    storage_path = f"{user['uid']}/{file.filename}"
    public_url = None

    # Upload to Supabase
    if supabase:
        try:
            with open(tmp.name, "rb") as f:
                supabase.storage.from_(SUPABASE_BUCKET).upload(storage_path, f)
            public_url = supabase.storage.from_(SUPABASE_BUCKET).get_public_url(storage_path)
        except Exception as e:
            print("⚠️ Supabase upload error:", e)

    # Run predictions
    label, p_audio, p_pca22, p_fusion = predict_from_file(tmp.name)

    print(f"🎧 Audio(920D)={p_audio:.3f} | PCA(22)={p_pca22:.3f} | 🧠 Fusion={p_fusion:.3f}")

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
            supabase.table("results").insert(clean_json(data)).execute()
            print("✅ Supabase insert success.")
        except Exception as e:
            print("⚠️ Supabase insert error:", e)

    return JSONResponse(clean_json(data))

# ============================================================
# 📊 USER RESULTS
# ============================================================
@app.get("/user/results")
def get_user_results(user: dict = Depends(verify_token)):
    if not supabase:
        return {"results": []}
    uid = user["uid"]
    res = supabase.table("results").select("*").eq("user_id", uid).order("created_at", desc=True).execute()
    return {"results": res.data}

# ============================================================
# 🤖 GEMINI CHATBOT
# ============================================================
@app.post("/chatbot")
async def chatbot(request: Request):
    try:
        data = await request.json()
        message = data.get("message", "").strip()
        if not message:
            return {"reply": "Please type a question."}

        print(f"💬 Gemini Request: {message}")
        model = genai.GenerativeModel("gemini-2.0-flash")
        prompt = (
            "You are a friendly AI assistant inside a Parkinson’s voice health dashboard. "
            "Explain voice analysis metrics (like jitter, shimmer, HNR, MFCCs, and health score) simply and clearly. "
            "Keep answers concise (2–4 sentences) and supportive. "
            "For casual questions, reply kindly like a human friend. "
            f"User asked: '{message}'"
        )

        response = model.generate_content(prompt)
        reply_text = response.text.strip() if response and response.text else "I'm here to help you understand your voice results!"
        print(f"✅ Gemini Reply: {reply_text}")
        return {"reply": reply_text}

    except Exception as e:
        import traceback
        traceback.print_exc()
        print("❌ Gemini Chatbot Error:", e)
        return {"reply": "Sorry, I couldn’t connect to the AI assistant."}

# ============================================================
# 🏠 ROOT
# ============================================================
@app.get("/")
def root():
    return {"message": "✅ Parkinson Detection Backend with PCA(22) + Fusion + Gemini AI running successfully"}
