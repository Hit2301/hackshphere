# ml_training/train_tabular_baseline.py
import joblib, numpy as np, pandas as pd
from pathlib import Path
from sklearn.model_selection import GroupKFold
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import StackingClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import roc_auc_score, average_precision_score, classification_report
from imblearn.over_sampling import SMOTE
from lightgbm import LGBMClassifier
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer

DATA = Path("ml_training/data/tabular/parkinsons.csv")
OUT_DIR = Path("ml_training/models"); OUT_DIR.mkdir(parents=True, exist_ok=True)

def load_tabular():
    df = pd.read_csv(DATA)

    # Target and features
    y = df["status"].astype(int)
    X = df.drop(columns=["status", "name"], errors="ignore").copy()

    # Groups from 'name'
    names = df.get("name")
    if names is not None:
        groups = names.str.extract(r"(phon_[^_]+_[^_]+)")[0]
        groups = groups.fillna(pd.Series(groups.index.astype(str), index=groups.index))
    else:
        groups = pd.Series(np.arange(len(df)).astype(str), index=df.index)

    return X, y, groups

def build_pipeline(numeric_cols):
    numeric = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler())
    ])
    pre = ColumnTransformer([("num", numeric, numeric_cols)], remainder="drop")

    base_lgbm = LGBMClassifier(
        n_estimators=400,
        max_depth=-1,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42,
        class_weight="balanced"
    )
    base_logreg = LogisticRegression(max_iter=500, class_weight="balanced", solver="liblinear")

    stack = StackingClassifier(
        estimators=[("lgbm", base_lgbm), ("lr", base_logreg)],
        final_estimator=LogisticRegression(max_iter=500),
        passthrough=True
    )

    # Calibrate the full stack
    clf = CalibratedClassifierCV(estimator=stack, method="sigmoid", cv=3)

    pipe = Pipeline([
        ("pre", pre),
        ("clf", clf)
    ])
    return pipe

def main():
    X, y, groups = load_tabular()
    numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()

    gkf = GroupKFold(n_splits=5)
    oof = np.zeros_like(y, dtype=float)

    print(f"✅ Loaded {len(X)} samples with {len(numeric_cols)} numeric features")

    for fold, (tr, va) in enumerate(gkf.split(X, y, groups)):
        Xtr, Xva = X.iloc[tr], X.iloc[va]
        ytr, yva = y.iloc[tr], y.iloc[va]

        # Handle class imbalance
        sm = SMOTE(random_state=42)
        Xtr_bal, ytr_bal = sm.fit_resample(Xtr, ytr)

        pipe = build_pipeline(numeric_cols)
        pipe.fit(Xtr_bal, ytr_bal)

        proba = pipe.predict_proba(Xva)[:, 1]
        oof[va] = proba

        auc = roc_auc_score(yva, proba)
        ap = average_precision_score(yva, proba)
        print(f"Fold {fold+1}: AUC={auc:.3f} | AP={ap:.3f}")

    print("\n📊 Overall validation:")
    print(f"AUC = {roc_auc_score(y, oof):.3f}")
    print(f"AP  = {average_precision_score(y, oof):.3f}")
    preds = (oof >= 0.5).astype(int)
    print(classification_report(y, preds, digits=3))

    # Final model training
    final_pipe = build_pipeline(numeric_cols)
    final_pipe.fit(X, y)

    save = {"feature_names": numeric_cols, "model": final_pipe}
    joblib.dump(save, OUT_DIR / "tabular_baseline_calibrated.pkl")
    print(f"✅ Saved model to: {OUT_DIR / 'tabular_baseline_calibrated.pkl'}")

if __name__ == "__main__":
    main()
