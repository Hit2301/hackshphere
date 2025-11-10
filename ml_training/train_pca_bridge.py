# ml_training/train_pca_bridge.py
import joblib, numpy as np, pandas as pd
from pathlib import Path
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.linear_model import LogisticRegression
from sklearn.calibration import CalibratedClassifierCV
from sklearn.pipeline import Pipeline
from sklearn.metrics import roc_auc_score, accuracy_score, brier_score_loss

DATA = Path("ml_training/data/audio_features.csv")
OUT  = Path("ml_training/models"); OUT.mkdir(parents=True, exist_ok=True)
N_COMPONENTS = 22

def main():
    df = pd.read_csv(DATA)
    y = df["label"].astype(int).values
    X = df.drop(columns=["label", "name"], errors="ignore").select_dtypes(np.number).values

    print(f"✅ Loaded {X.shape[0]} samples, {X.shape[1]} features")
    print("🧠 Label distribution:\n", pd.Series(y).value_counts())

    # scaler + PCA(22) + LR (calibrated)
    pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("pca", PCA(n_components=N_COMPONENTS, random_state=42)),
        ("clf", CalibratedClassifierCV(
            estimator=LogisticRegression(max_iter=2000, class_weight="balanced"),
            method="sigmoid",
            cv=3
        )),
    ])

    # CV to sanity check
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    aucs, accs, briers = [], [], []
    for i, (tr, va) in enumerate(skf.split(X, y), 1):
        pipe.fit(X[tr], y[tr])
        p = pipe.predict_proba(X[va])[:,1]
        yhat = (p >= 0.5).astype(int)
        aucs.append(roc_auc_score(y[va], p))
        accs.append(accuracy_score(y[va], yhat))
        briers.append(brier_score_loss(y[va], p))
        print(f"Fold {i}: AUC={aucs[-1]:.3f}, ACC={accs[-1]:.3f}, Brier={briers[-1]:.4f}")

    print("\n📊 CV Summary:")
    print(f"Mean AUC = {np.mean(aucs):.3f} ± {np.std(aucs):.3f}")
    print(f"Mean ACC = {np.mean(accs):.3f}")
    print(f"Mean Brier = {np.mean(briers):.4f}")

    # Final fit on all data and save
    pipe.fit(X, y)
    joblib.dump({
        "pipeline": pipe,
        "n_components": N_COMPONENTS,
        "feature_count_in": X.shape[1],
        "feature_names": [c for c in df.columns if c not in ("label","name")]
    }, OUT / "audio_pca22_bridge.pkl")
    print(f"✅ Saved PCA bridge to {OUT / 'audio_pca22_bridge.pkl'}")

if __name__ == "__main__":
    main()
