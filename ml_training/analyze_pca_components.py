import joblib
import numpy as np
import pandas as pd
from pathlib import Path

# Paths
MODEL_PATH = Path("ml_training/models/audio_pca22_bridge.pkl")
FEATURE_PATH = Path("ml_training/data/audio_feature_names_920.txt")

# Load model and feature names
pkl = joblib.load(MODEL_PATH)
pipeline = pkl["pipeline"]
pca = pipeline.named_steps.get("pca")
feature_names = [line.strip() for line in open(FEATURE_PATH, "r")]

if pca is None:
    raise ValueError("❌ PCA not found in pipeline.")

print(f"✅ PCA components: {pca.n_components_}")
print(f"✅ Original features: {len(feature_names)}")

# Analyze top contributors
components = pca.components_

for i, comp in enumerate(components):
    top_idx = np.argsort(np.abs(comp))[-5:][::-1]
    top_features = [feature_names[j] for j in top_idx]
    print(f"\n🧩 PCA Feature {i+1}:")
    print("Top contributing features:", ", ".join(top_features))
