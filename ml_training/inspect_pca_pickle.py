# ml_training/inspect_pca_pickle.py
import joblib
from pathlib import Path

MODEL_PATH = Path("ml_training/models/audio_pca22_bridge.pkl")
bundle = joblib.load(MODEL_PATH)

print("✅ Loaded pickle successfully!")
print("\n🔍 Type of object:", type(bundle))

if isinstance(bundle, dict):
    print("\n📦 Keys in dict:")
    for k, v in bundle.items():
        print(f"  - {k}: {type(v)}")
else:
    print("\n(Not a dict — direct object):", dir(bundle))
