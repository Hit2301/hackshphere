import joblib
from pathlib import Path

# Path to your PCA bridge model
MODEL_PATH = Path("ml_training/models/audio_pca22_bridge.pkl")

pca_bundle = joblib.load(MODEL_PATH)
pipeline = pca_bundle.get("pipeline")

# Find PCA inside pipeline
pca = None
if hasattr(pipeline, "named_steps") and "pca" in pipeline.named_steps:
    pca = pipeline.named_steps["pca"]
elif hasattr(pipeline, "steps"):
    for name, step in pipeline.steps:
        if "pca" in name.lower():
            pca = step
            break

if pca is None:
    print("❌ PCA not found inside pipeline.")
    exit()

# Generate PCA feature names
pca_feature_names = [f"PCA_Feature_{i+1}" for i in range(pca.n_components_)]

print("✅ PCA feature names (22 total):\n")
for name in pca_feature_names:
    print("-", name)

# Save to file
output_path = Path("ml_training/data/pca_feature_names.txt")
with open(output_path, "w") as f:
    f.write("\n".join(pca_feature_names))

print(f"\n✅ Saved PCA feature names to: {output_path}")
