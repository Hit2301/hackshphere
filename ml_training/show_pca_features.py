import joblib
from pathlib import Path
import numpy as np
import matplotlib.pyplot as plt

# --- Load model ---
MODEL_PATH = Path("ml_training/models/audio_pca22_bridge.pkl")
pca_bundle = joblib.load(MODEL_PATH)

print("✅ Loaded PCA bridge successfully!")

# --- Access PCA inside the pipeline ---
pipeline = pca_bundle.get("pipeline")
if pipeline is None:
    print("❌ No 'pipeline' key found in pickle.")
    exit()

# --- Locate PCA inside the pipeline steps ---
pca = None
if hasattr(pipeline, "named_steps") and "pca" in pipeline.named_steps:
    pca = pipeline.named_steps["pca"]
    print("✅ Found PCA inside pipeline.named_steps['pca']")
elif hasattr(pipeline, "steps"):
    for name, step in pipeline.steps:
        if "pca" in name.lower():
            pca = step
            print(f"✅ Found PCA inside pipeline step '{name}'")
            break

if pca is None:
    print("❌ PCA object not found inside pipeline.")
    exit()

# --- Safely detect original feature count ---
orig_features = getattr(pca, "n_features_in_", None) or getattr(pca, "n_features_", "unknown")

# --- Print PCA info ---
print(f"\n🧩 PCA Details:")
print(f"Components: {pca.n_components_}")
print(f"Original features: {orig_features}")
print(f"Total variance explained: {pca.explained_variance_ratio_.sum():.4f}")
print("Top 5 component variances:", np.round(pca.explained_variance_ratio_[:5], 4))

# --- Save PCA component matrix ---
np.savetxt("ml_training/data/pca_22_features_matrix.csv", pca.components_, delimiter=",")
print("✅ Saved PCA component matrix to: ml_training/data/pca_22_features_matrix.csv")

# --- Plot variance contribution ---
plt.figure(figsize=(8, 4))
plt.bar(range(1, pca.n_components_ + 1), pca.explained_variance_ratio_ * 100, color="#4a90e2")
plt.title("Explained Variance by Each PCA Feature (22D)")
plt.xlabel("PCA Feature Index (1–22)")
plt.ylabel("Variance Explained (%)")
plt.grid(True, linestyle="--", alpha=0.4)
plt.tight_layout()
plt.show()
