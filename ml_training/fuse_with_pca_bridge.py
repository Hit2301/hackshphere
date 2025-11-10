# ml_training/fuse_with_pca_bridge.py
import joblib, numpy as np, pandas as pd
from pathlib import Path
from sklearn.model_selection import StratifiedKFold
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, accuracy_score, classification_report

AUDIO_MODEL = Path("ml_training/models/audio_parkinson_model_calibrated.pkl")
PCA_BRIDGE  = Path("ml_training/models/audio_pca22_bridge.pkl")
AUDIO_DATA  = Path("ml_training/data/audio_features.csv")
OUT         = Path("ml_training/models"); OUT.mkdir(parents=True, exist_ok=True)

def main():
    # Load data
    df = pd.read_csv(AUDIO_DATA)
    y = df["label"].astype(int).values
    X = df.drop(columns=["label","name"], errors="ignore").select_dtypes(np.number).values

    # Load models
    audio_bundle = joblib.load(AUDIO_MODEL)
    audio_model = audio_bundle["model"]
    audio_scaler = audio_bundle.get("scaler")

    bridge = joblib.load(PCA_BRIDGE)["pipeline"]

    # Compute both probabilities
    if audio_scaler is not None:
        X_scaled = audio_scaler.transform(X)
    else:
        X_scaled = X
    audio_full_proba = audio_model.predict_proba(X_scaled)[:,1]

    bridge_proba = bridge.predict_proba(X)[:,1]

    F = np.vstack([bridge_proba, audio_full_proba]).T  # shape (n,2)

    # Train logistic meta on 2 probs
    meta = LogisticRegression(max_iter=2000)
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    aucs, accs = [], []
    for i, (tr, va) in enumerate(skf.split(F, y), 1):
        meta.fit(F[tr], y[tr])
        p = meta.predict_proba(F[va])[:,1]
        yhat = (p>=0.5).astype(int)
        aucs.append(roc_auc_score(y[va], p))
        accs.append(accuracy_score(y[va], yhat))
        print(f"Fold {i}: AUC={aucs[-1]:.3f} | ACC={accs[-1]:.3f}")

    print("\n📊 Fusion (new) Summary:")
    print(f"Mean AUC = {np.mean(aucs):.3f} ± {np.std(aucs):.3f}")
    print(f"Mean ACC = {np.mean(accs):.3f}")

    meta.fit(F, y)
    print("\nClassification report (fit-on-all, just for reference):")
    p_all = meta.predict_proba(F)[:,1]
    yhat_all = (p_all>=0.5).astype(int)
    print(classification_report(y, yhat_all, digits=3))

    joblib.dump({
        "meta_model": meta,
        "feature_names": ["p_tab_like_from_pca22", "p_audio_full"]
    }, OUT / "fusion_meta_model_pca22.pkl")
    print(f"✅ Saved new fusion meta model to {OUT / 'fusion_meta_model_pca22.pkl'}")

if __name__ == "__main__":
    main()
