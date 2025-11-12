# ml_inference.py
import librosa, torch, joblib, numpy as np
from transformers import Wav2Vec2Model, Wav2Vec2Processor
from pathlib import Path

MODEL_DIR = Path("ml_training/models")
INTERIM_DIR = Path("ml_training/data/interim")

# === Load models ===
audio_bundle = joblib.load(MODEL_DIR / "audio_ssl_prosody_calibrated.pkl")
fusion_bundle = joblib.load(MODEL_DIR / "fusion_meta_ssl_tabular.pkl")
audio_model = audio_bundle["model"]
fusion_model = fusion_bundle["meta_model"]

# === Load processor ===
processor = Wav2Vec2Processor.from_pretrained("facebook/wav2vec2-base")
wav2vec2 = Wav2Vec2Model.from_pretrained("facebook/wav2vec2-base")
device = "cuda" if torch.cuda.is_available() else "cpu"
wav2vec2 = wav2vec2.to(device).eval()

SR = 16000
MFCC_N = 20

def extract_ssl(y):
    inputs = processor(y, sampling_rate=SR, return_tensors="pt", padding=True)
    with torch.no_grad():
        out = wav2vec2(inputs.input_values.to(device)).last_hidden_state.squeeze(0).cpu().numpy()
    return out.mean(axis=0)

def extract_prosody(y):
    y = librosa.util.normalize(y)
    feats = {}
    feats["zcr"] = librosa.feature.zero_crossing_rate(y).mean()
    feats["rms"] = librosa.feature.rms(y=y).mean()
    S = np.abs(librosa.stft(y, n_fft=1024, hop_length=256))
    feats["centroid"] = librosa.feature.spectral_centroid(S=S, sr=SR).mean()
    feats["bandwidth"] = librosa.feature.spectral_bandwidth(S=S, sr=SR).mean()
    feats["rolloff"] = librosa.feature.spectral_rolloff(S=S, sr=SR, roll_percent=0.85).mean()
    mfcc = librosa.feature.mfcc(y=y, sr=SR, n_mfcc=MFCC_N).mean(axis=1)
    for i, v in enumerate(mfcc): feats[f"mfcc_{i+1}"] = float(v)
    return feats

def predict_fusion(wav_path, age=None, sex=None):
    y, _ = librosa.load(wav_path, sr=SR, mono=True)
    ssl = extract_ssl(y)
    pro = extract_prosody(y)
    feats = {**{f"ssl_{i}": v for i, v in enumerate(ssl)}, **pro}
    import pandas as pd
    df = pd.DataFrame([feats])
    audio_prob = audio_model.predict_proba(df)[0, 1]
    # optional: add demographics if frontend sends them
    extra = {}
    if age: extra["age"] = age
    if sex: extra["sex"] = 1 if sex.lower().startswith("m") else 0
    df2 = pd.DataFrame([{**extra, "audio_prob": audio_prob}])
    fusion_prob = fusion_model.predict_proba(df2)[0, 1]
    return {
        "audio_prob": round(float(audio_prob), 3),
        "fusion_prob": round(float(fusion_prob), 3),
        "prosody_features": pro
    }