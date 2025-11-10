import pandas as pd
from pathlib import Path

# Path to your audio features file
AUDIO_FEATURES_PATH = Path("ml_training/data/audio_features.csv")

# Load dataset
df = pd.read_csv(AUDIO_FEATURES_PATH)

# Remove non-feature columns
exclude_cols = ["filename", "label", "name", "status"]
feature_names = [c for c in df.columns if c not in exclude_cols]

print(f"✅ Loaded {len(feature_names)} feature names\n")

# Show first few names
for i, name in enumerate(feature_names[:30], 1):
    print(f"{i:3}. {name}")

# Save all names to file
output_path = Path("ml_training/data/audio_feature_names_920.txt")
with open(output_path, "w") as f:
    f.write("\n".join(feature_names))

print(f"\n✅ Saved all {len(feature_names)} feature names to: {output_path}")
