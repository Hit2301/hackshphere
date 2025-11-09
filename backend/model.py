import os
import joblib
import numpy as np
import subprocess
from features import extract_parselmouth_features

MODEL_PATH = os.getenv("MODEL_PATH", "./model/model.pkl")
MODEL = joblib.load(MODEL_PATH) if os.path.exists(MODEL_PATH) else None
if MODEL:
    print(f"✅ Model loaded successfully from {MODEL_PATH}")
else:
    print(f"⚠️ Model not found at {MODEL_PATH}, fallback mode")

def features_to_vector(features):
    vec = [
        features.get("mean_pitch", 0),
        features.get("jitter_local", 0),
        features.get("shimmer_local", 0),
        features.get("hnr", 0),
    ]
    vec += features.get("mfcc_means", [0] * 13)
    return np.array(vec).reshape(1, -1)

def convert_to_wav_ffmpeg(input_path):
    """Force convert any audio (webm, mp3, etc.) to valid WAV using ffmpeg CLI"""
    wav_path = input_path.rsplit(".", 1)[0] + "_fixed.wav"
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-ar", "16000", "-ac", "1", "-f", "wav", wav_path
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if not os.path.exists(wav_path) or os.path.getsize(wav_path) < 1000:
        raise RuntimeError("FFmpeg conversion failed or empty file.")
    return wav_path

def predict_from_file(path):
    try:
        ext = os.path.splitext(path)[1].lower()
        print(f"🎧 Received file: {path} ({ext})")

        # Convert everything to proper WAV
        wav_path = convert_to_wav_ffmpeg(path)
        print(f"✅ Converted to: {wav_path}")

        # Extract features
        features = extract_parselmouth_features(wav_path)
        vec = features_to_vector(features)

        if MODEL is None:
            score = 0.5 + (features.get("jitter_local", 0) * 0.05)
            label = "Parkinson" if score >= 0.5 else "Healthy"
            return label, float(score), features

        if hasattr(MODEL, "predict_proba"):
            prob = MODEL.predict_proba(vec)[0][1]
        else:
            prob = float(MODEL.predict(vec)[0])

        label = "Parkinson" if prob >= 0.5 else "Healthy"
        print(f"✅ Prediction: {label} ({prob:.3f})")
        return label, float(prob), features

    except Exception as e:
        print(f"❌ Audio processing failed: {e}")
        raise RuntimeError(f"Audio processing failed: {e}")
