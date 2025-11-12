import os, sys, tempfile, shutil, joblib, numpy as np, logging
from pathlib import Path
from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import google.generativeai as genai

# Local model inference
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from ml_inference import predict_fusion

# =======================================================
# ⚙️ Setup
# =======================================================
load_dotenv()
BASE_DIR = Path(__file__).resolve().parents[1]
MODEL_DIR = BASE_DIR / "ml_training" / "models"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("parkinson-backend")

# =======================================================
# 🧠 Load Models
# =======================================================
def safe_load_model(name):
    path = MODEL_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"{name} not found in {MODEL_DIR}")
    return joblib.load(path)

try:
    audio_bundle = safe_load_model("audio_ssl_prosody_calibrated.pkl")
    fusion_bundle = safe_load_model("fusion_meta_ssl_tabular.pkl")
    audio_model = audio_bundle["model"]
    fusion_model = fusion_bundle["meta_model"]
    logger.info("✅ Models loaded successfully (Audio + Fusion)")
except Exception as e:
    logger.error(f"❌ Model loading failed: {e}")
    audio_model = fusion_model = None

# =======================================================
# 🌐 FastAPI Config
# =======================================================
app = FastAPI(title="Parkinson Detection Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =======================================================
# 🤖 Gemini Config
# =======================================================
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        logger.info("✅ Gemini configured")
    except Exception as e:
        logger.warning(f"⚠️ Gemini setup failed: {e}")

# =======================================================
# 🎵 Upload & Predict
# =======================================================
@app.post("/upload")
async def upload_audio(file: UploadFile = File(...)):
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        result = predict_fusion(tmp_path)

        # clean numpy objects
        def clean_json(obj):
            if isinstance(obj, np.generic): return obj.item()
            if isinstance(obj, np.ndarray): return obj.tolist()
            if isinstance(obj, dict): return {k: clean_json(v) for k, v in obj.items()}
            if isinstance(obj, list): return [clean_json(x) for x in obj]
            return obj

        result = clean_json(result)

        # extract safe numeric values
        audio_prob = float(result.get("audio_prob", result.get("audio_full_proba", 0.0)) or 0.0)
        fusion_prob = float(result.get("fusion_prob", result.get("fusion_proba", 0.0)) or 0.0)
        pca_features = result.get("pca_features", [])

        if not isinstance(pca_features, list):
            pca_features = []
        if len(pca_features) < 22:
            pca_features += [0.0] * (22 - len(pca_features))
        elif len(pca_features) > 22:
            pca_features = pca_features[:22]

        audio_prob = max(0.0, min(audio_prob, 1.0))
        fusion_prob = max(0.0, min(fusion_prob, 1.0))

        # determine health label
        if fusion_prob > 0.85:
            label = "🔴 Parkinson High Risk"
        elif fusion_prob > 0.65:
            label = "🟠 Parkinson Risk"
        elif fusion_prob > 0.4:
            label = "⚠️ Borderline"
        else:
            label = "🟢 Healthy"

        ai_summary = f"Detected {label.split(' ', 1)[1]} with {(fusion_prob * 100):.2f}% probability."

        logger.info(f"✅ Prediction complete | Audio={audio_prob:.3f}, Fusion={fusion_prob:.3f}, Label={label}")

        # ✅ frontend expects these exact keys
        return JSONResponse({
            "audio_full_proba": round(audio_prob, 4),
            "fusion_proba": round(fusion_prob, 4),
            "label": label,
            "ai_summary": ai_summary,
            "pca_features": pca_features,
        })

    except Exception as e:
        logger.exception("❌ Prediction error")
        raise HTTPException(status_code=500, detail=str(e))

# =======================================================
# 💬 Chatbot
# =======================================================
@app.post("/chatbot")
async def chatbot(request: Request):
    try:
        data = await request.json()
        msg = data.get("message", "").strip()
        if not msg:
            return {"reply": "Please type something to ask me."}
        if not GEMINI_API_KEY:
            return {"reply": "AI assistant not configured yet."}

        model = genai.GenerativeModel("gemini-2.0-flash")
        prompt = f"You are a friendly Parkinson assistant. Explain in simple words: {msg}"
        response = model.generate_content(prompt)
        text = response.text.strip() if response and response.text else "I'm here to help you understand your results!"
        return {"reply": text}
    except Exception as e:
        logger.warning(f"Chatbot error: {e}")
        return {"reply": "Sorry, I couldn't connect to AI right now."}

# =======================================================
# 🏠 Root + Health Check
# =======================================================
@app.get("/")
def root():
    return {"message": "✅ Parkinson Detection Backend Running — No Database, Full PCA Feature Return"}

@app.get("/health")
def health():
    return {
        "status": "ok",
        "models": {"audio": bool(audio_model), "fusion": bool(fusion_model)},
        "pca_feature_support": True
    }