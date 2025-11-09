# 🧠 Phase 1: Basic ML Model for Parkinson's Detection
# Author: Dhruv

# -------------------------------
# 1️⃣ Import Libraries
# -------------------------------
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report

# -------------------------------
# 2️⃣ Load Dataset
# -------------------------------
# ⚠️ Change file path if needed
df = pd.read_csv("parkinsons.csv")
print("✅ Data Loaded Successfully!")
print("Shape:", df.shape)
print("\nFirst 5 rows:\n", df.head())

# -------------------------------
# 3️⃣ Check Missing Values
# -------------------------------
print("\nMissing values per column:")
print(df.isnull().sum())

# -------------------------------
# 4️⃣ Data Info
# -------------------------------
print("\nDataset Info:")
print(df.info())

# -------------------------------
# 5️⃣ Statistical Summary
# -------------------------------
print("\nStatistical Summary:")
print(df.describe().T)

# 6️⃣ Correlation Heatmap (Ignore non-numeric columns like 'name')
numeric_df = df.select_dtypes(include=['float64', 'int64'])
plt.figure(figsize=(12, 8))
sns.heatmap(numeric_df.corr(), cmap='coolwarm', linewidths=0.5)
plt.title("Feature Correlation Heatmap (Numeric Only)")
plt.show()


# -------------------------------
# 7️⃣ Prepare Features & Labels
# -------------------------------
# "status" is usually 1 = Parkinson's, 0 = Healthy
X = df.drop(columns=['name', 'status'])
y = df['status']

# -------------------------------
# 8️⃣ Train-Test Split
# -------------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)
print(f"Training Samples: {len(X_train)}, Test Samples: {len(X_test)}")

# -------------------------------
# 9️⃣ Feature Scaling
# -------------------------------
scaler = StandardScaler()
X_train = scaler.fit_transform(X_train)
X_test = scaler.transform(X_test)

# -------------------------------
# 🔟 Train Logistic Regression Model
# -------------------------------
model = LogisticRegression(max_iter=200)
model.fit(X_train, y_train)

# -------------------------------
# 1️⃣1️⃣ Evaluate Model
# -------------------------------
y_pred = model.predict(X_test)

acc = accuracy_score(y_test, y_pred)
print(f"\n🎯 Model Accuracy: {acc*100:.2f}%")
print("\nClassification Report:\n", classification_report(y_test, y_pred))

# -------------------------------
# 1️⃣2️⃣ Confusion Matrix
# -------------------------------
cm = confusion_matrix(y_test, y_pred)
plt.figure(figsize=(5,4))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues')
plt.title("Confusion Matrix")
plt.xlabel("Predicted")
plt.ylabel("Actual")
plt.show()

# -------------------------------
# 1️⃣3️⃣ Save Model
# -------------------------------
import joblib
joblib.dump(model, "parkinsons_basic_model.pkl")
print("\n✅ Model saved as parkinsons_basic_model.pkl")
