import sys, os, math, tempfile, joblib, numpy as np, librosa
from pathlib import Path
from fastapi import FastAPI, File, UploadFile, Header, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import logging
import requests
import base64
import json
from typing import Optional

# Firebase + Supabase
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from supabase import create_client, Client as SupabaseClient

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

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("parkinson-backend")

# ============================================================
# 🧠 Model loading (wrapped with try/except + fallback download)
# ============================================================
audio_bundle = None
audio_model = None
audio_scaler = None
pca_bridge = None
fusion_bundle = None
fusion_model = None

def try_download_model_from_supabase(filename: str) -> Optional[Path]:
    """
    Try to download `filename` from the SUPABASE bucket into MODEL_DIR.
    Requires SUPABASE_URL and SUPABASE_KEY to be set.
    Returns the local Path if successful, otherwise None.
    """
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY")
    SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "audio-uploads")
    if not (SUPABASE_URL and SUPABASE_KEY):
        logger.warning("Supabase credentials not set — cannot download model.")
        return None

    # Build storage download URL (Supabase storage uses this pattern)
    # We'll attempt to use the public REST URL pattern (requires correct permissions)
    storage_url = f"{SUPABASE_URL}/storage/v1/object/sign/{SUPABASE_BUCKET}/{filename}"
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    try:
        logger.info(f"Attempting to download {filename} from Supabase storage...")
        # request a signed URL (short lived) - Supabase supports signing via /object/sign
        r = requests.get(storage_url, headers=headers, timeout=30)
        if r.status_code == 200:
            signed_url = r.json().get("signedURL") if r.headers.get("content-type", "").startswith("application/json") else None
            # fallback: if we got bytes directly
            if signed_url:
                dl = requests.get(signed_url, timeout=60)
                if dl.status_code == 200:
                    MODEL_DIR.mkdir(parents=True, exist_ok=True)
                    local_path = MODEL_DIR / filename
                    with open(local_path, "wb") as f:
                        f.write(dl.content)
                    logger.info(f"Downloaded {filename} to {local_path}")
                    return local_path
            else:
                # maybe Supabase returned file bytes directly
                if r.status_code == 200 and r.content:
                    MODEL_DIR.mkdir(parents=True, exist_ok=True)
                    local_path = MODEL_DIR / filename
                    with open(local_path, "wb") as f:
                        f.write(r.content)
                    logger.info(f"Downloaded {filename} to {local_path}")
                    return local_path
        else:
            # Some Supabase deployments return 404 or 403 if object is private
            logger.warning(f"Failed to get signed URL or file for {filename} from Supabase: {r.status_code} {r.text}")
    except Exception as e:
        logger.exception("Error while downloading model from Supabase: %s", e)
    return None


def safe_load_joblib(path_or_name):
    """
    Try to load a joblib file from disk. If it's not present, attempt to download from supabase.
    Accepts either a Path or filename (string).
    """
    try:
        if isinstance(path_or_name, str):
            candidate = MODEL_DIR / path_or_name
        else:
            candidate = Path(path_or_name)
        if candidate.exists():
            logger.info(f"Loading model from {candidate}")
            return joblib.load(candidate)
        else:
            logger.warning(f"Model file {candidate} not found locally. Trying Supabase.")
            downloaded = try_download_model_from_supabase(candidate.name)
            if downloaded and downloaded.exists():
                logger.info(f"Loading downloaded model from {downloaded}")
                return joblib.load(downloaded)
            raise FileNotFoundError(f"Model {candidate} not found and could not be downloaded.")
    except Exception as e:
        logger.exception(f"Failed to load model {path_or_name}: {e}")
        raise


# attempt loads (wrapped so we don't crash with opaque errors)
try:
    audio_bundle = safe_load_joblib(MODEL_DIR / "audio_parkinson_model_calibrated.pkl")
    audio_model = audio_bundle["model"]
    audio_scaler = audio_bundle.get("scaler", None)
    logger.info("✅ Audio model loaded (audio_parkinson_model_calibrated.pkl)")
except Exception as e:
    logger.error("Audio model failed to load: %s", e)
    audio_bundle = None
    audio_model = None
    audio_scaler = None

try:
    pca_bridge = safe_load_joblib(MODEL_DIR / "audio_pca22_bridge.pkl")["pipeline"]
    logger.info("✅ PCA bridge loaded (audio_pca22_bridge.pkl)")
except Exception as e:
    logger.error("PCA bridge failed to load: %s", e)
    pca_bridge = None

try:
    fusion_bundle = safe_load_joblib(MODEL_DIR / "fusion_meta_model_pca22.pkl")
    fusion_model = fusion_bundle["meta_model"]
    logger.info("✅ Fusion meta model loaded (fusion_meta_model_pca22.pkl)")
except Exception as e:
    logger.error("Fusion model failed to load: %s", e)
    fusion_bundle = None
    fusion_model = None

logger.info("Model loading step complete (some models may be missing).")

# ============================================================
# 🌐 FASTAPI CONFIG
# ============================================================
app = FastAPI(title="Parkinson Detection Backend")

# Configure allowed origins via environment
_allowed = os.getenv("ALLOWED_ORIGINS", "")
if _allowed:
    # comma separated list
    allowed_origins = [o.strip() for o in _allowed.split(",") if o.strip()]
else:
    # fallback to wildcard if not provided (dev only)
    allowed_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,  # set via ALLOWED_ORIGINS env var for production
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
        # Only initialize if not already
        if not firebase_admin._apps:
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
            logger.info("✅ Firebase initialized")
        else:
            logger.info("Firebase already initialized")
    except Exception as e:
        logger.exception("⚠️ Firebase initialization error: %s", e)
else:
    logger.warning("⚠️ Firebase credentials missing or incomplete; skipping Firebase initialization")

# ============================================================
# 🗃️ SUPABASE
# ============================================================
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "audio-uploads")
supabase: Optional[SupabaseClient] = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("✅ Supabase client created")
    except Exception as e:
        logger.exception("⚠️ Could not initialize Supabase client: %s", e)
        supabase = None
else:
    logger.warning("⚠️ Supabase URL/Key missing; supabase client not created")

# ============================================================
# 🤖 GEMINI AI
# ============================================================
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        logger.info("✅ Gemini AI configured")
    except Exception as e:
        logger.exception("⚠️ Gemini configuration error: %s", e)
else:
    logger.warning("⚠️ Gemini API key missing")

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
# 🎵 Predict from File (Audio + PCA Bridge + Features)
# ============================================================
def predict_from_file(file_path: str):
    # re-check that models exist
    if audio_model is None or fusion_model is None or pca_bridge is None:
        logger.warning("One or more models are missing — prediction may be unreliable or impossible.")
        # if missing, raise an error so client gets an explicit message
        raise HTTPException(status_code=500, detail="Model(s) not loaded on server. Check logs or model path.")

    feats = extract_features(file_path)
    feats = np.nan_to_num(feats).reshape(1, -1)

    # 🎧 Audio (Full)
    x_audio = audio_scaler.transform(feats) if audio_scaler else feats
    p_audio = float(audio_model.predict_proba(x_audio)[0, 1])

    # 🧩 PCA Bridge (22D)
    pca_step = pca_bridge.named_steps.get("pca", None)
    X_pca = pca_step.transform(feats) if pca_step else np.zeros((1, 22))
    p_pca22 = float(pca_bridge.predict_proba(feats)[0, 1])

    # 🧠 Fusion
    f_input = np.array([[p_pca22, p_audio]])
    p_fusion = float(fusion_model.predict_proba(f_input)[0, 1])

    label = "Parkinson" if p_fusion >= 0.5 else "Healthy"

    # ✨ AI Summary (optional)
    if p_fusion < 0.4:
        ai_summary = "Your voice appears stable and healthy with strong acoustic consistency."
    elif p_fusion < 0.65:
        ai_summary = "Some mild irregularities detected in voice features — consider regular monitoring."
    else:
        ai_summary = "AI detected significant voice variations possibly linked to Parkinson’s symptoms."

    return label, p_audio, p_pca22, p_fusion, X_pca.tolist()[0], ai_summary



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
# 📤 Upload Endpoint (Audio + PCA Fusion)
# ============================================================
@app.post("/upload")
async def upload(file: UploadFile = File(...), user: dict = Depends(verify_token)):
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    tmp.write(await file.read())
    tmp.flush()
    tmp.close()

    label, p_audio, p_pca22, p_fusion, pca_features, ai_summary = predict_from_file(tmp.name)

    data = {
        "user_id": user["uid"],
        "audio_full_proba": p_audio,
        "pca22_proba": p_pca22,
        "fusion_proba": p_fusion,
        "final_label": label,
        "ai_summary": ai_summary,
        "pca_features": pca_features,
    }

    return JSONResponse(data)

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

        logger.info(f"💬 Gemini Request: {message}")
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
        logger.info(f"✅ Gemini Reply: {reply_text}")
        return {"reply": reply_text}

    except Exception as e:
        import traceback
        traceback.print_exc()
        logger.exception("❌ Gemini Chatbot Error: %s", e)
        return {"reply": "Sorry, I couldn’t connect to the AI assistant."}

# ============================================================
# 🏠 ROOT + HEALTH
# ============================================================
@app.get("/")
def root():
    return {"message": "✅ Parkinson Detection Backend with PCA(22) + Fusion + Gemini AI running successfully"}

@app.get("/health")
def health():
    """
    Health endpoint for load balancers / Render checks.
    Returns model and integration status.
    """
    status = {
        "firebase": bool(firebase_admin._apps),
        "supabase": bool(supabase),
        "gemini_configured": bool(GEMINI_API_KEY),
        "models": {
            "audio_model": bool(audio_model),
            "pca_bridge": bool(pca_bridge),
            "fusion_model": bool(fusion_model),
        }
    }
    return {"status": "ok", "details": status}

# ============================================================
# 🏁 Startup event to verify environment
# ============================================================
@app.on_event("startup")
def startup_checks():
    logger.info("Running startup checks...")
    # Print key environment hints (not secrets)
    logger.info(f"ALLOWED_ORIGINS: {os.getenv('ALLOWED_ORIGINS', 'not-set')}")
    logger.info(f"SUPABASE_URL present: {bool(os.getenv('SUPABASE_URL'))}")
    logger.info(f"FIREBASE_CLIENT_EMAIL present: {bool(os.getenv('FIREBASE_CLIENT_EMAIL'))}")
    logger.info(f"MODEL_DIR: {MODEL_DIR} (exists: {MODEL_DIR.exists()})")

    # If some models are missing and Supabase credentials exist, try a bulk fetch
    missing = []
    if audio_model is None:
        missing.append("audio_parkinson_model_calibrated.pkl")
    if pca_bridge is None:
        missing.append("audio_pca22_bridge.pkl")
    if fusion_model is None:
        missing.append("fusion_meta_model_pca22.pkl")

    if missing and SUPABASE_URL and SUPABASE_KEY:
        logger.info(f"Attempting to download missing models from Supabase: {missing}")
        for name in missing:
            try:
                safe_load_joblib(name)
            except Exception as e:
                logger.warning(f"Could not download or load {name}: {e}")
    elif missing:
        logger.warning("Models missing and Supabase credentials not available. Predictions will fail until models are loaded.")

    logger.info("Startup checks complete.")
