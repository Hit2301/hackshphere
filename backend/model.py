import joblib, os, numpy as np
from features import extract_parselmouth_features

MODEL_PATH = os.getenv('MODEL_PATH', './model/model.pkl')
MODEL = None
if os.path.exists(MODEL_PATH):
    MODEL = joblib.load(MODEL_PATH)
else:
    print("WARNING: Model not found at", MODEL_PATH)

def features_to_vector(features):
    vec = [features.get('mean_pitch',0), features.get('jitter_local',0), features.get('shimmer_local',0), features.get('hnr',0)]
    vec += features.get('mfcc_means', [0]*13)
    return np.array(vec).reshape(1, -1)

def predict_from_file(path):
    features = extract_parselmouth_features(path)
    vec = features_to_vector(features)
    if MODEL is None:
        # fallback demo: simple rule-based score
        score = 0.5 + (features['jitter_local'] * 0.05)
        label = 'Parkinson' if score >= 0.5 else 'Healthy'
        return label, float(score), features
    if hasattr(MODEL, 'predict_proba'):
        prob = MODEL.predict_proba(vec)[0][1]
    else:
        pred = MODEL.predict(vec)[0]
        prob = float(pred)
    label = 'Parkinson' if prob >= 0.5 else 'Healthy'
    return label, float(prob), features
