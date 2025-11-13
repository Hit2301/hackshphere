# 🧠 Team_Bheem : HackSphere — Parkinson’s Voice AI

> AI-powered system to detect early Parkinson’s patterns using voice biomarkers with an interactive dashboard, advanced ML fusion, and Gemini AI chatbot.

## 🚀 Overview

**HackSphere** is a full-stack project that analyzes voice recordings to detect Parkinson’s disease risk.  
It combines audio-based machine learning, PCA feature reduction, and a fusion meta-model for robust predictions.

### 🔍 Features
- 🎙 **Voice Analysis** — Extracts 920D acoustic features and computes Parkinson risk.
- 🧩 **PCA Visualization** — Displays 22 key components in a Radar (Spider) Chart.
- 🧠 **Fusion Model** — Combines multiple AI predictions for higher accuracy.
- 💬 **Gemini AI Chatbot** — Answers health and AI questions conversationally.
- 🔐 **Firebase Auth** — Secure user login and audio history.
- 🌈 **Animated Dashboard** — Beautiful neural background, circular graphs, and real-time results.

---

## 🧱 Project Architecture

Audio Input (.wav)
↓
Feature Extraction (MFCC, Spectral, Prosody)
↓
Model 1 — Audio SSL + Prosody (920D)
↓
Model 2 — Fusion Meta-Model
↓
Prediction: Parkinson Probability + Confidence
↓
Frontend Dashboard + Gemini AI Chatbot


---

## ⚙️ Tech Stack

| Layer | Technology |
|-------|-------------|
| Frontend | React.js, Firebase Auth |
| Backend | FastAPI, Python, joblib, librosa |
| ML Models | Scikit-Learn, LightGBM |
| AI Assistant | Gemini-2.0-Flash (Google Generative AI) |

---

## 🧩 ML Models

### 🥇 Model 1 — Audio SSL + Prosody (920D)
- Extracts 920 handcrafted acoustic + SSL features.
- Output: `audio_full_proba`
- Captures jitter, shimmer, MFCC, HNR, tempo irregularities.

### 🥉 Model 2 — Fusion Meta-Model
- Inputs: `[p_audio, p_pca22]`
- Output: `fusion_proba` (final Parkinson risk)
- Adds calibrated confidence and final label  
  → ✅ Healthy | ⚠ Borderline | ⚠️ Parkinson Risk

---

## 💬 Chatbot (Gemini AI Integration)

Gemini Chatbot
│
├─ Input: user questions (metrics, AI meaning)
├─ Processing: Gemini-2.0-Flash API
├─ Output: short, friendly, medical-safe responses
└─ Tone: supportive, clear, AI-explainer style


Backend route → `/chatbot`  
Frontend → `Chatbot.js`

---



## ⚙️ Setup Instructions

##Create .env in /frontend:


REACT_APP_FIREBASE_API_KEY=AIzaSyAoddqc3ahy_Q-hUI9HjRlLEBmdSrmwdHs
REACT_APP_FIREBASE_PROJECT_ID=gdg0111
REACT_APP_FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCQklvCXv1e8YyI\n3gzD837XMrvfUGgHC2GcfxA7YsoBrtNqgdL1jprfZF2HmYRYK8UCH3rzL5R+3cLU\nGcbG29Q0M/MBd/ft9BHUiyIujQpmpPshX5QzftYazV7i0lgoKwLWw6RhhJI/7DM/\nI/b1ieTjNJZHaS8U/IbAJcULQIzYoJAA1u7i8ho/q+2P++8Yxy7dmcsXy7zeYJD2\nLnt0iocD6LjRy8bk64L6EEuUUp25+s4lWfzUt0JouzQ0r3dXDOsR7F7oWfDcJ1VA\nJrDDbWqKm233dgUEqRFMsmv461hGrqDrDICE8s8prdAFrezKGwC8QUvlYoUc6xL6\n8pCXYHVHAgMBAAECggEAHYiIjjBxeg/GMb+KxAzeAIAwuPHoDmhYzGt4mWkY8zcP\noVZcDiXPpYsPQEAwNQLcAA8GQt+ZakFLJ6EMZltKAlAKeGZVk5qkedLibLgLQ+S4\nGJ053Tsv6dHCbHuj3rDKp6zXy8QVTFGoNmHWdVpyE6gOexAVuifMLzyIAEBzhV0Y\n5mZTh1lQT7OBv5czqsdEz0c8dUICmBmBAr+GfiOAmhdN7cQyiZTjRjBQhKmwwBYP\nQIww4nhwJE6VrkehGwRxHnzKwVOOWGw3M7O0luqCBjJBdELd+tFiQ7+lEySJHML7\ngVM2WIO7oF0VxYx4sN0gfY5x0vFSBfFigUkPGTN2QQKBgQDHlbj4DVfgY5jnBBte\nE9rcaUhfK66vrNp0DyjY5jX36R+VRWf0bg3jxIkqOTh94MWAi6rSswn2Mk9CCJGC\nwm8hEY5xbtAtUTTNNHReDkip1eSEVYKOdA2s9kGON0au3vzYItBn6w94H8Yjnur8\nlgFh83n8HVu329nzIiO0jrUpqQKBgQC5b8wp0ZvqS12SdRDripCzAgvmhUTANTF/\naX9gq1tj75Kaim/msv65YpYR4w16JRsBI/t4eq6MS0AUzdxXgNpwr4+LJjNDlNd2\nYP/zgiT22EZ7+r7fxydq+GcPa1XzzTCrjviQnQ+L45JZq1OvKh9BHRZB6Sla68u+\nH2nQScldbwKBgDZ4/8373lMo+895iHqp0p87wPvwsTHTbKAmjxB77JjoMK2ODuxg\nqTvUJVe33FpG4cDO3eW55esjGgy8x/I3XRtablU5WGo18sJbIbOWFHD+JuuTZxm4\nRQ9C+ut03L7Xr4zSG61xM3ymt257bklYK7JvQIj1/lV1FMxOMg6SsJFZAoGAYsFN\nQ4AjvrUAUj0SE76prQuL9upGYO5zO92dPohDlYdC1haf3Ya57VS5gzEePkyAgyz8\ngX8kcgapS+sOS3ON4bE9iud/KaCc1qh15uMKeINZljFFcbuIHInJqQaKsdo270am\nza03WFKL4EFDwed22aB5+AQKSCeHS+tC2PBS0vUCgYEAjYFg06i+sN9WfO7Zqdhw\n6ts2FJB8dORZmAtmGPiLcT/UhtavEz3qsHgiJnpHVt5eSmulHt9YV8WwwGjgPTWK\njv1iCi4BciT6O72djJNYvL05EdGyNQw0dWcsIkvO3GwHNj9gI+zuLXDAjtuzILFG\nGQjy/znyaLLcgiy1tWJ0cxw=\n-----END PRIVATE KEY-----\n"
REACT_APP_FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@gdg0111.iam.gserviceaccount.com


REACT_APP_SUPABASE_URL=https://fiuoludgllhobimawrev.supabase.co
REACT_APP_SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpdW9sdWRnbGxob2JpbWF3cmV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1OTEyMTEsImV4cCI6MjA3ODE2NzIxMX0.mwonqvl4dc6GQk6P4TRHKNOOigQPqFtx4AGAbWcGahM
REACT_APP_SUPABASE_BUCKET=audio-uploads

MODEL_PATH=./model/parkinsons_basic_model.pkl


##Create .env in /backend:


FIREBASE_PROJECT_ID=gdg0111
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCQklvCXv1e8YyI\n3gzD837XMrvfUGgHC2GcfxA7YsoBrtNqgdL1jprfZF2HmYRYK8UCH3rzL5R+3cLU\nGcbG29Q0M/MBd/ft9BHUiyIujQpmpPshX5QzftYazV7i0lgoKwLWw6RhhJI/7DM/\nI/b1ieTjNJZHaS8U/IbAJcULQIzYoJAA1u7i8ho/q+2P++8Yxy7dmcsXy7zeYJD2\nLnt0iocD6LjRy8bk64L6EEuUUp25+s4lWfzUt0JouzQ0r3dXDOsR7F7oWfDcJ1VA\nJrDDbWqKm233dgUEqRFMsmv461hGrqDrDICE8s8prdAFrezKGwC8QUvlYoUc6xL6\n8pCXYHVHAgMBAAECggEAHYiIjjBxeg/GMb+KxAzeAIAwuPHoDmhYzGt4mWkY8zcP\noVZcDiXPpYsPQEAwNQLcAA8GQt+ZakFLJ6EMZltKAlAKeGZVk5qkedLibLgLQ+S4\nGJ053Tsv6dHCbHuj3rDKp6zXy8QVTFGoNmHWdVpyE6gOexAVuifMLzyIAEBzhV0Y\n5mZTh1lQT7OBv5czqsdEz0c8dUICmBmBAr+GfiOAmhdN7cQyiZTjRjBQhKmwwBYP\nQIww4nhwJE6VrkehGwRxHnzKwVOOWGw3M7O0luqCBjJBdELd+tFiQ7+lEySJHML7\ngVM2WIO7oF0VxYx4sN0gfY5x0vFSBfFigUkPGTN2QQKBgQDHlbj4DVfgY5jnBBte\nE9rcaUhfK66vrNp0DyjY5jX36R+VRWf0bg3jxIkqOTh94MWAi6rSswn2Mk9CCJGC\nwm8hEY5xbtAtUTTNNHReDkip1eSEVYKOdA2s9kGON0au3vzYItBn6w94H8Yjnur8\nlgFh83n8HVu329nzIiO0jrUpqQKBgQC5b8wp0ZvqS12SdRDripCzAgvmhUTANTF/\naX9gq1tj75Kaim/msv65YpYR4w16JRsBI/t4eq6MS0AUzdxXgNpwr4+LJjNDlNd2\nYP/zgiT22EZ7+r7fxydq+GcPa1XzzTCrjviQnQ+L45JZq1OvKh9BHRZB6Sla68u+\nH2nQScldbwKBgDZ4/8373lMo+895iHqp0p87wPvwsTHTbKAmjxB77JjoMK2ODuxg\nqTvUJVe33FpG4cDO3eW55esjGgy8x/I3XRtablU5WGo18sJbIbOWFHD+JuuTZxm4\nRQ9C+ut03L7Xr4zSG61xM3ymt257bklYK7JvQIj1/lV1FMxOMg6SsJFZAoGAYsFN\nQ4AjvrUAUj0SE76prQuL9upGYO5zO92dPohDlYdC1haf3Ya57VS5gzEePkyAgyz8\ngX8kcgapS+sOS3ON4bE9iud/KaCc1qh15uMKeINZljFFcbuIHInJqQaKsdo270am\nza03WFKL4EFDwed22aB5+AQKSCeHS+tC2PBS0vUCgYEAjYFg06i+sN9WfO7Zqdhw\n6ts2FJB8dORZmAtmGPiLcT/UhtavEz3qsHgiJnpHVt5eSmulHt9YV8WwwGjgPTWK\njv1iCi4BciT6O72djJNYvL05EdGyNQw0dWcsIkvO3GwHNj9gI+zuLXDAjtuzILFG\nGQjy/znyaLLcgiy1tWJ0cxw=\n-----END PRIVATE KEY-----\n"


SUPABASE_URL=https://fiuoludgllhobimawrev.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpdW9sdWRnbGxob2JpbWF3cmV2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjU5MTIxMSwiZXhwIjoyMDc4MTY3MjExfQ.gICMiBOgTRJJw4fq9cCj8aRzWBpwDGo05_mrRpofRKA
SUPABASE_BUCKET=audio-uploads


MODEL_PATH=./model/parkinsons_basic_model.pkl

GEMINI_API_KEY=AIzaSyAHnKW2Z8itcYb6yaPqayi-MZ6p7mOHkoA
FIREBASE_PROJECT_ID=gdg0111
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@gdg0111.iam.gserviceaccount.com


### 🔹 1. Backend/frontend Setup

## Quick start (macOS / Linux)

1. Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# copy .env.example to .env and fill values (Firebase / Supabase / keys)
uvicorn app:app --reload --port 8000
```
## Quick start (windows)

1. Backend
```bash
cd backend
python -m venv venv
venv/scripts/Activate
pip install -r requirements.txt
# copy .env.example to .env and fill values (Firebase / Supabase / keys)
uvicorn app:app --reload --port 8000
```
## Both 

2. Frontend

it is a Node/React project:
```bash
cd frontend
npm install
npm start
```

| Endpoint        | Method | Description                           |
| --------------- | ------ | ------------------------------------- |
| `/upload`       | POST   | Upload `.wav` file and get prediction |
| `/user/results` | GET    | Fetch user’s history from Supabase    |
| `/verify`       | GET    | Token validation test                 |
| `/chatbot`      | POST   | Gemini AI chatbot interaction         |

📊 Dataset Reference

Dataset used for research and testing:

Parkinson Speech Dataset (.wav files)
🔗 https://drive.google.com/drive/folders/1_HK1GFvzvInkwWC74wBjOKepTsRoSAgO?usp=sharing

👨‍💻 Authors

Hit K. Busa - Integrater
Dhruv B. Bhalala - AI Model developer
Vishvam H. Paghadar - Backend developer
Jash M. Godhani - Frontend UI/UX

Contact: busahit001@gmail.com





