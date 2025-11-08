# ParkinsonProject — Hackathon Starter Kit (Demo)

This ZIP contains a complete starter project for the Parkinson's Voice Detector hackathon demo.
It includes:
- A simple static frontend (landing, signup, login, dashboard with recorder)
- A FastAPI backend that accepts uploads and returns predictions
- A dummy trained model (for demo)
- Feature extraction code using parselmouth + librosa
- Supabase + Firebase integration placeholders (fill your keys)
- A PDF report generator (reportlab)
- A detailed user manual and step-by-step guide in `USER_MANUAL.md`

IMPORTANT: This is a development/demo skeleton. Replace the dummy model with a properly trained model on the UCI Parkinson's dataset for real results.

---

## Quick start (local dev)

1. Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate        # on Windows: venv\Scripts\activate
pip install -r requirements.txt
# set environment variables or copy .env.example to .env and fill values
uvicorn app:app --reload --port 8000
```

2. Frontend
Open `frontend/index.html` in your browser (or host it with a static server). Update Firebase config placeholders in the frontend HTML files with your Firebase project's web config.

3. Model
A demo model is provided at `backend/model/model.pkl`. Replace it with your trained pipeline ensuring feature order matches `backend/model.py`.

4. Supabase & Firebase
- Create a Firebase project and enable Authentication.
- Create a Supabase project, add the SQL schema in your project (see SQL in USER_MANUAL.md), and create a storage bucket named `audio-uploads`.
- Fill backend/.env with service keys (only backend uses those secrets).

---

## Files
- frontend/: static HTML + JS files
- backend/: FastAPI app, feature extraction, model wrapper, PDF generator
- backend/model/: demo model.pkl
- USER_MANUAL.md: step-by-step instructions for each role

"# hackshphere" 
