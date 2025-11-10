# ml_training/fuse_tabular_audio.py
import joblib, numpy as np, pandas as pd
from pathlib import Path
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, accuracy_score, classification_report
from sklearn.model_selection import StratifiedKFold

# Paths
TAB_MODEL = Path("ml_training/models/tabular_baseline_calibrated.pkl")
AUD_MODEL = Path("ml_training/models/audio_parkinson_model_calibrated.pkl")
TAB_DATA = Path("ml_training/data/tabular/parkinsons.csv")
AUD_DATA = Path("ml_training/data/audio_features.csv")
OUT_DIR = Path("ml_training/models"); OUT_DIR.mkdir(parents=True, exist_ok=True)

# ------------------------------
# Load models and data
# ------------------------------
tab_bundle = joblib.load(TAB_MODEL)
aud_bundle = joblib.load(AUD_MODEL)

tab_model = tab_bundle["model"]
aud_model = aud_bundle["model"]
audio_scaler = aud_bundle.get("scaler", None)

tab_df = pd.read_csv(TAB_DATA)
aud_df = pd.read_csv(AUD_DATA)

# ------------------------------
# Align samples
# ------------------------------
if "status" not in tab_df.columns:
    raise ValueError("❌ 'status' column not found in tabular CSV!")

y = tab_df["status"].astype(int).values
tab_names = tab_df.get("name", pd.Series(np.arange(len(tab_df)))).astype(str)
aud_names = aud_df.get("filename", pd.Series(np.arange(len(aud_df)))).astype(str)

matches = []
for i, tn in enumerate(tab_names):
    for j, an in enumerate(aud_names):
        if any(sub in an for sub in tn.split("_") if len(sub) > 2):
            matches.append((i, j))
            break

if len(matches) == 0:
    print("⚠️ No name matches found — falling back to index-based alignment.")
    limit = min(len(tab_df), len(aud_df))
    matches = [(i, i) for i in range(limit)]

matches = np.array(matches)
print(f"✅ Matched {len(matches)} samples between tabular and audio sets")

# ------------------------------
# Prepare aligned data
# ------------------------------
X_tab = tab_df.drop(columns=["status", "name"], errors="ignore").select_dtypes(include=[np.number]).iloc[matches[:, 0]]
X_aud = aud_df.drop(columns=["label"], errors="ignore").select_dtypes(include=[np.number]).iloc[matches[:, 1]]
y = y[matches[:, 0]]

if audio_scaler:
    X_aud = pd.DataFrame(audio_scaler.transform(X_aud), columns=X_aud.columns)

# ------------------------------
# Get probabilities from both models
# ------------------------------
tab_proba = tab_model.predict_proba(X_tab)[:, 1]
aud_proba = aud_model.predict_proba(X_aud)[:, 1]

fusion_df = pd.DataFrame({
    "tabular_proba": tab_proba,
    "audio_proba": aud_proba,
    "label": y
})
fusion_df.to_csv("ml_training/data/fusion_inputs.csv", index=False)
print("✅ Saved fusion dataset:", fusion_df.shape)

# ------------------------------
# Train meta fusion model
# ------------------------------
X = fusion_df[["tabular_proba", "audio_proba"]]
y = fusion_df["label"]

skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
aucs, accs = [], []

for fold, (tr, va) in enumerate(skf.split(X, y), 1):
    Xtr, Xva = X.iloc[tr], X.iloc[va]
    ytr, yva = y.iloc[tr], y.iloc[va]

    meta = LogisticRegression(max_iter=500)
    meta.fit(Xtr, ytr)

    proba = meta.predict_proba(Xva)[:, 1]
    pred = (proba >= 0.5).astype(int)
    auc = roc_auc_score(yva, proba)
    acc = accuracy_score(yva, pred)
    aucs.append(auc); accs.append(acc)

    print(f"Fold {fold}: AUC={auc:.3f} | ACC={acc:.3f}")

print("\n📊 Fusion Model Performance:")
print(f"Mean AUC = {np.mean(aucs):.3f} ± {np.std(aucs):.3f}")
print(f"Mean ACC = {np.mean(accs):.3f}")
print(classification_report(y, (meta.predict_proba(X)[:,1] >= 0.5).astype(int), digits=3))

# ------------------------------
# Save final fusion model
# ------------------------------
bundle = {
    "meta_model": meta,
    "features": ["tabular_proba", "audio_proba"]
}
joblib.dump(bundle, OUT_DIR / "fusion_meta_model.pkl")
print(f"✅ Saved meta fusion model to {OUT_DIR / 'fusion_meta_model.pkl'}")
