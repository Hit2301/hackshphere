# ml_training/train_audio_features.py
import os, re, warnings
from pathlib import Path
from typing import Dict, Any
import numpy as np
import pandas as pd
from tqdm import tqdm
import librosa
import librosa.feature as LF

# ---------- Paths ----------
AUDIO_ROOT = Path("ml_training/data/audio")
DEMOGRAPHICS = Path("ml_training/data/Demographics_age_sex.xlsx")
OUT_CSV = Path("ml_training/data/audio_features.csv")
OUT_CSV.parent.mkdir(parents=True, exist_ok=True)

# ---------- Audio settings ----------
SR = 16_000
MIN_SEC = 1.0
FRAME_SEC = 0.032
HOP_SEC = 0.010

# ---------- Optional Praat ----------
try:
    import parselmouth
    HAVE_PRAAT = True
except Exception:
    HAVE_PRAAT = False
    warnings.warn("⚠️ parselmouth not found — skipping jitter/shimmer features.")

def sec_to_frames(sr: int, sec: float) -> int:
    return int(round(sr * sec))

N_FFT  = sec_to_frames(SR, FRAME_SEC)
HOPLEN = sec_to_frames(SR, HOP_SEC)

# ---------- Label inference ----------
def infer_label_from_path(path: Path) -> int:
    s = str(path).lower().replace("\\", "/")
    if "/pd_ah/" in s or "pd_ah/" in s:
        return 1
    if "/hc_ah/" in s or "hc_ah/" in s:
        return 0
    fname = path.name.lower()
    if "pd" in fname and "hc" not in fname:
        return 1
    if "hc" in fname and "pd" not in fname:
        return 0
    raise ValueError(f"Cannot infer label from: {path}")

# ---------- Stats helper ----------
def stats(name: str, v: np.ndarray) -> Dict[str, float]:
    if v is None or len(v) == 0:
        return {f"{name}_{k}": np.nan for k in ("mean","std","min","max","p25","p50","p75","qrange")}
    v = np.asarray(v, dtype=float)
    return {
        f"{name}_mean": float(np.nanmean(v)),
        f"{name}_std" : float(np.nanstd(v)),
        f"{name}_min" : float(np.nanmin(v)),
        f"{name}_max" : float(np.nanmax(v)),
        f"{name}_p25" : float(np.nanpercentile(v, 25)),
        f"{name}_p50" : float(np.nanpercentile(v, 50)),
        f"{name}_p75" : float(np.nanpercentile(v, 75)),
        f"{name}_qrange": float(np.nanpercentile(v, 75) - np.nanpercentile(v, 25)),
    }

# ---------- Core feature extraction ----------
def extract_core_features(y: np.ndarray, sr: int) -> Dict[str, float]:
    rms = LF.rms(y=y, frame_length=N_FFT, hop_length=HOPLEN).squeeze()
    zcr = LF.zero_crossing_rate(y, frame_length=N_FFT, hop_length=HOPLEN).squeeze()
    centroid  = LF.spectral_centroid(y=y, sr=sr, n_fft=N_FFT, hop_length=HOPLEN).squeeze()
    bandwidth = LF.spectral_bandwidth(y=y, sr=sr, n_fft=N_FFT, hop_length=HOPLEN).squeeze()
    rolloff   = LF.spectral_rolloff(y=y, sr=sr, n_fft=N_FFT, hop_length=HOPLEN, roll_percent=0.85).squeeze()
    flatness  = LF.spectral_flatness(y=y, n_fft=N_FFT, hop_length=HOPLEN).squeeze()
    contrast  = LF.spectral_contrast(y=y, sr=sr, n_fft=N_FFT, hop_length=HOPLEN)
    chroma = LF.chroma_stft(y=y, sr=sr, n_fft=N_FFT, hop_length=HOPLEN)
    mfcc   = LF.mfcc(y=y, sr=sr, n_mfcc=20, n_fft=N_FFT, hop_length=HOPLEN)
    d_mfcc = librosa.feature.delta(mfcc, order=1)
    dd_mfcc= librosa.feature.delta(mfcc, order=2)
    mel = LF.melspectrogram(y=y, sr=sr, n_mels=30, n_fft=N_FFT, hop_length=HOPLEN)
    logmel = librosa.power_to_db(mel + 1e-10)

    feats: Dict[str, float] = {}
    feats.update(stats("rms", rms))
    feats.update(stats("zcr", zcr))
    feats.update(stats("centroid", centroid))
    feats.update(stats("bandwidth", bandwidth))
    feats.update(stats("rolloff", rolloff))
    feats.update(stats("flatness", flatness))

    for i in range(contrast.shape[0]):
        feats.update(stats(f"contrast_b{i}", contrast[i]))
    for i in range(chroma.shape[0]):
        feats.update(stats(f"chroma_b{i}", chroma[i]))
    for i in range(mfcc.shape[0]):
        feats.update(stats(f"mfcc_b{i}", mfcc[i]))
        feats.update(stats(f"d_mfcc_b{i}", d_mfcc[i]))
        feats.update(stats(f"dd_mfcc_b{i}", dd_mfcc[i]))
    for i in range(logmel.shape[0]):
        feats.update(stats(f"logmel_b{i}", logmel[i]))

    return feats

# ---------- Parselmouth features ----------
def extract_praat_features(y: np.ndarray, sr: int) -> Dict[str, float]:
    if not HAVE_PRAAT:
        return {}
    try:
        snd = parselmouth.Sound(y, sampling_frequency=sr)
        feats = {}
        pitch = snd.to_pitch(time_step=HOP_SEC, pitch_floor=60, pitch_ceiling=400)
        pitch_values = pitch.selected_array["frequency"]
        pitch_values = pitch_values[pitch_values > 0]
        feats.update(stats("praat_f0", pitch_values))
        point_proc = parselmouth.praat.call(snd, "To PointProcess (periodic, cc)", 75, 500)
        feats["praat_jitter_local"] = float(parselmouth.praat.call([snd, point_proc],
            "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3))
        feats["praat_shimmer_local_db"] = float(parselmouth.praat.call([snd, point_proc],
            "Get shimmer (local_dB)", 0, 0, 0.0001, 0.02, 1.3, 1.6))
        return feats
    except Exception:
        return {}

# ---------- Single file extractor for backend use ----------
def extract_features(file_path: str) -> np.ndarray:
    """Used by backend for real-time prediction."""
    y, sr = librosa.load(file_path, sr=SR, mono=True)
    y, _ = librosa.effects.trim(y, top_db=30)
    if len(y) < int(MIN_SEC * SR):
        raise ValueError("Audio too short for feature extraction.")
    y = librosa.util.normalize(y)

    feats = {}
    feats.update(extract_core_features(y, sr))
    feats.update(extract_praat_features(y, sr))
    vec = np.array(list(feats.values()), dtype=float)
    vec = np.nan_to_num(vec)
    return vec

# ---------- Batch extractor ----------
def main():
    audio_files = list(AUDIO_ROOT.rglob("*.wav"))
    if not audio_files:
        print("No audio files found in:", AUDIO_ROOT.resolve())
        return

    rows = []
    for p in tqdm(audio_files, desc="Extracting audio features"):
        try:
            y, sr = librosa.load(p, sr=SR, mono=True)
            y, _ = librosa.effects.trim(y, top_db=30)
            if len(y) < int(MIN_SEC * SR):
                continue
            y = librosa.util.normalize(y)

            rec = {"filename": p.name, "filepath": str(p), "label": infer_label_from_path(p)}
            rec.update(extract_core_features(y, sr))
            rec.update(extract_praat_features(y, sr))
            rows.append(rec)
        except Exception as e:
            warnings.warn(f"Failed on {p}: {e}")

    if not rows:
        print("No valid samples extracted.")
        return

    df = pd.DataFrame(rows)
    df = df.replace([np.inf, -np.inf], np.nan)
    for c in df.select_dtypes(include=[np.number]).columns:
        df[c].fillna(df[c].mean(), inplace=True)

    df.to_csv(OUT_CSV, index=False)
    print(f"✅ Saved extracted features to {OUT_CSV}")
    print(f"Samples: {len(df)} | Features: {df.shape[1]-3}")

if __name__ == "__main__":
    main()
