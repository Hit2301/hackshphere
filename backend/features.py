import parselmouth
import numpy as np
import librosa

def extract_parselmouth_features(path):
    snd = parselmouth.Sound(path)
    pitch = snd.to_pitch()
    pitch_values = pitch.selected_array['frequency']
    mean_pitch = float(np.mean(pitch_values[pitch_values>0])) if len(pitch_values)>0 else 0.0
    try:
        jitter_local = parselmouth.praat.call(snd, "Get jitter (local)", 0, 0.02, 1.3)
        shimmer_local = parselmouth.praat.call(snd, "Get shimmer (local)", 0, 0.02, 1.3, 1.6)
        harmonicity = parselmouth.praat.call(snd, "To Harmonicity (cc)", 0.01, 75, 0.1).get_mean()
    except Exception:
        jitter_local = 0.0
        shimmer_local = 0.0
        harmonicity = 0.0
    y, sr = librosa.load(path, sr=16000)
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    mfcc_means = np.mean(mfcc, axis=1).tolist()
    features = {
        'mean_pitch': float(mean_pitch),
        'jitter_local': float(jitter_local),
        'shimmer_local': float(shimmer_local),
        'hnr': float(harmonicity),
        'mfcc_means': mfcc_means
    }
    return features
