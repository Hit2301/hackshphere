# ml_training/train_audio_model.py
import warnings
warnings.filterwarnings("ignore")

import joblib, numpy as np, pandas as pd
from pathlib import Path
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    roc_auc_score, accuracy_score, brier_score_loss, classification_report
)
from sklearn.feature_selection import SelectPercentile, mutual_info_classif
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, StackingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.calibration import CalibratedClassifierCV
from imblearn.pipeline import Pipeline as ImbPipeline
from imblearn.over_sampling import SMOTE

# Paths & constants
DATA = Path("ml_training/data/audio_features.csv")
OUT_DIR = Path("ml_training/models")
OUT_DIR.mkdir(parents=True, exist_ok=True)
PERCENTILE = 50
N_SPLITS = 5
RANDOM_SEED = 42

# --------------------------
# Load data
# --------------------------
def load_data():
    df = pd.read_csv(DATA)
    print(f"✅ Loaded {len(df)} samples and {df.shape[1]} columns")

    if "label" not in df.columns:
        raise ValueError("❌ 'label' column missing in features CSV.")

    y = df["label"].astype(int)
    X = df.drop(columns=["label"], errors="ignore").select_dtypes(include=[np.number])
    X = X.replace([np.inf, -np.inf], np.nan).fillna(X.mean())

    print("\n🧠 Label distribution:")
    print(y.value_counts())
    if y.nunique() < 2:
        raise ValueError("❌ Only one class present (PD/HC imbalance).")

    return X, y

# --------------------------
# Build model pipeline
# --------------------------
def build_pipeline(n_percent=PERCENTILE):
    rf = RandomForestClassifier(
        n_estimators=400, class_weight="balanced", random_state=RANDOM_SEED
    )
    gb = GradientBoostingClassifier(
        n_estimators=300, learning_rate=0.05, random_state=RANDOM_SEED
    )
    lr_final = LogisticRegression(max_iter=1000, solver="liblinear", random_state=RANDOM_SEED)

    stack = StackingClassifier(
        estimators=[("rf", rf), ("gb", gb)],
        final_estimator=lr_final,
        passthrough=True
    )

    try:
        calibrated = CalibratedClassifierCV(estimator=stack, method="sigmoid", cv=3)
    except TypeError:
        calibrated = CalibratedClassifierCV(base_estimator=stack, method="sigmoid", cv=3)

    pipe = ImbPipeline([
        ("scaler", StandardScaler()),
        ("select", SelectPercentile(mutual_info_classif, percentile=n_percent)),
        ("smote", SMOTE(random_state=RANDOM_SEED)),
        ("clf", calibrated)
    ])
    return pipe

# --------------------------
# Cross-validation
# --------------------------
def cross_validate(X, y):
    skf = StratifiedKFold(n_splits=N_SPLITS, shuffle=True, random_state=RANDOM_SEED)
    aucs, accs, briers = [], [], []

    for fold, (tr, va) in enumerate(skf.split(X, y), 1):
        Xtr, Xva = X.iloc[tr], X.iloc[va]
        ytr, yva = y.iloc[tr], y.iloc[va]

        if len(np.unique(ytr)) < 2 or len(np.unique(yva)) < 2:
            print(f"⚠️ Skipping fold {fold} due to single-class issue")
            continue

        try:
            pipe = build_pipeline(PERCENTILE)
            pipe.fit(Xtr, ytr)
        except ValueError:
            print(f"⚠️ SMOTE failed for fold {fold}, using original data")
            pipe = build_pipeline(PERCENTILE)
            pipe.steps.pop(2)  # remove SMOTE
            pipe.fit(Xtr, ytr)

        proba = pipe.predict_proba(Xva)[:, 1]
        pred = (proba >= 0.5).astype(int)

        auc = roc_auc_score(yva, proba)
        acc = accuracy_score(yva, pred)
        brier = brier_score_loss(yva, proba)
        aucs.append(auc); accs.append(acc); briers.append(brier)

        print(f"Fold {fold}: AUC={auc:.3f}, ACC={acc:.3f}, Brier={brier:.4f}")

    print("\n📊 CV Summary:")
    print(f"Mean AUC = {np.mean(aucs):.3f} ± {np.std(aucs):.3f}")
    print(f"Mean ACC = {np.mean(accs):.3f}")
    print(f"Mean Brier = {np.mean(briers):.4f}")

# --------------------------
# Final training + save
# --------------------------
def fit_full_and_save(X, y, feature_names):
    pipe = build_pipeline(PERCENTILE)
    pipe.fit(X, y)

    proba = pipe.predict_proba(X)[:, 1]
    pred = (proba >= 0.5).astype(int)

    print("\n🧠 Full training results:")
    print(f"AUC={roc_auc_score(y, proba):.3f} | ACC={accuracy_score(y, pred):.3f}")
    print(classification_report(y, pred, digits=3))

    scaler = pipe.named_steps.get("scaler", None)

    joblib.dump({
        "model": pipe,
        "scaler": scaler,
        "features": list(feature_names),
        "percentile": PERCENTILE,
        "version": "v4_calibrated_featureselect"
    }, OUT_DIR / "audio_parkinson_model_calibrated.pkl")

    print(f"\n✅ Saved calibrated model to {OUT_DIR / 'audio_parkinson_model_calibrated.pkl'}")

# --------------------------
# Main entry
# --------------------------
def main():
    X, y = load_data()
    print(f"\nℹ️ Using {X.shape[1]} features")
    cross_validate(X, y)
    fit_full_and_save(X, y, X.columns)

if __name__ == "__main__":
    main()
