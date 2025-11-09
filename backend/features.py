import parselmouth
import numpy as np

def extract_parselmouth_features(path):
    """Extract 22 Parkinson-like features from a .wav file using Parselmouth."""
    try:
        snd = parselmouth.Sound(path)
        pitch = snd.to_pitch()
        pulses = parselmouth.praat.call([snd, pitch], "To PointProcess (cc)")

        # ✅ Pitch features
        mean_pitch = parselmouth.praat.call(pitch, "Get mean", 0, 0, "Hertz")
        max_pitch = parselmouth.praat.call(pitch, "Get maximum", 0, 0, "Hertz", "Parabolic")
        min_pitch = parselmouth.praat.call(pitch, "Get minimum", 0, 0, "Hertz", "Parabolic")

        # ✅ Correct Jitter features
        jitter_local = parselmouth.praat.call(pulses, "Get jitter (local)", 0, 0.02, 1.3, 1.6, 0.02)
        jitter_abs = parselmouth.praat.call(pulses, "Get jitter (local, absolute)", 0, 0.02, 1.3, 1.6, 0.02)
        rap = parselmouth.praat.call(pulses, "Get jitter (rap)", 0, 0.02, 1.3, 1.6, 0.02)
        ppq = parselmouth.praat.call(pulses, "Get jitter (ppq5)", 0, 0.02, 1.3, 1.6, 0.02)
        ddp = parselmouth.praat.call(pulses, "Get jitter (ddp)", 0, 0.02, 1.3, 1.6, 0.02)

        # ✅ Correct Shimmer features
        shimmer_local = parselmouth.praat.call([snd, pulses], "Get shimmer (local)", 0, 0.02, 1.3, 1.6, 0.02, 1.3)
        shimmer_db = parselmouth.praat.call([snd, pulses], "Get shimmer (local_dB)", 0, 0.02, 1.3, 1.6, 0.02, 1.3)
        apq3 = parselmouth.praat.call([snd, pulses], "Get shimmer (apq3)", 0, 0.02, 1.3, 1.6, 0.02, 1.3)
        apq5 = parselmouth.praat.call([snd, pulses], "Get shimmer (apq5)", 0, 0.02, 1.3, 1.6, 0.02, 1.3)
        apq = parselmouth.praat.call([snd, pulses], "Get shimmer (apq11)", 0, 0.02, 1.3, 1.6, 0.02, 1.3)
        dda = parselmouth.praat.call([snd, pulses], "Get shimmer (dda)", 0, 0.02, 1.3, 1.6, 0.02, 1.3)

        # ✅ Harmonics-to-noise ratio
        hnr_obj = parselmouth.praat.call(snd, "To Harmonicity (cc)", 0.01, 75, 0.1, 1.0)
        hnr = parselmouth.praat.call(hnr_obj, "Get mean", 0, 0)
        nhr = 1 / hnr if hnr != 0 else 0

        # ✅ Synthetic nonlinear features (placeholder)
        rpde = np.random.uniform(0.4, 0.6)
        dfa = np.random.uniform(0.6, 0.8)
        spread1 = np.random.uniform(-6.0, -4.0)
        spread2 = np.random.uniform(0.2, 0.3)
        d2 = np.random.uniform(2.0, 2.6)
        ppe = np.random.uniform(0.15, 0.25)

        # ✅ Final 22-feature vector
        features = np.array([
            mean_pitch, max_pitch, min_pitch,
            jitter_local, jitter_abs, rap, ppq, ddp,
            shimmer_local, shimmer_db, apq3, apq5, apq, dda,
            nhr, hnr, rpde, dfa, spread1, spread2, d2, ppe
        ])

        return features

    except Exception as e:
        raise RuntimeError(f"Feature extraction failed: {e}")
