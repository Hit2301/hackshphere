import joblib, os, numpy as np
from pydub import AudioSegment
import parselmouth
from features import extract_parselmouth_features

MODEL_PATH = os.getenv("MODEL_PATH", "./model/parkinsons_basic_model.pkl")
MODEL = None

# ✅ Load trained ML model
if os.path.exists(MODEL_PATH):
    MODEL = joblib.load(MODEL_PATH)
    print(f"✅ Model loaded successfully from {MODEL_PATH}")
else:
    print("⚠️ WARNING: Model not found at", MODEL_PATH)


def features_to_vector(features):
    """Ensure features are in proper numeric vector shape (1, -1)."""
    # If it's already a numpy array — just reshape
    if isinstance(features, np.ndarray):
        return features.reshape(1, -1)
    # If it's a dict (fallback)
    elif isinstance(features, dict):
        vec = [v for v in features.values()]
        return np.array(vec).reshape(1, -1)
    else:
        raise ValueError("Unsupported feature format")


def predict_from_file(path):
    """Predict Parkinson risk from an audio file."""
    try:
        ext = os.path.splitext(path)[1].lower()

        try:
            # convert any format (webm, mp3, m4a) to wav
            sound = AudioSegment.from_file(path)
            wav_path = path.rsplit(".", 1)[0] + "_fixed.wav"
            sound.export(wav_path, format="wav")
            path = wav_path
            print(f"✅ Converted to real WAV: {path}")
        except Exception as e:
            raise RuntimeError(f"FFmpeg conversion failed: {e}")

        # ✅ Extract features (22-element array)
        features = extract_parselmouth_features(path)
        vec = features_to_vector(features)
        if np.isnan(vec).any() or np.isinf(vec).any():
            print("⚠️ Found NaN/inf in features — replacing with 0")
            vec = np.nan_to_num(vec, nan=0.0, posinf=0.0, neginf=0.0)
        print(f"✅ Extracted {vec.shape[1]} features")

        # ✅ Handle missing model
        if MODEL is None:
            score = np.mean(vec)
            label = "Parkinson" if score > 0.5 else "Healthy"
            return label, float(score), features

        # ✅ Predict using model
        if hasattr(MODEL, "predict_proba"):
            prob = MODEL.predict_proba(vec)[0][1]
        else:
            prob = float(MODEL.predict(vec)[0])

        label = "Parkinson" if prob >= 0.5 else "Healthy"
        print(f"✅ Prediction: {label} ({prob:.3f})")
        return label, float(prob), features

    except Exception as e:
        raise RuntimeError(f"Audio processing failed: {e}")
