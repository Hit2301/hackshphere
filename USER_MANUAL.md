# USER MANUAL — Parkinson's Voice Detector (Step-by-step)

This manual explains how to set up and use the project. Share it with team members.

## Roles & Short Tasks
1. Frontend Developer
   - Update Firebase config in frontend HTML files
   - Implement nicer UI if desired
   - Ensure recorder works in Chrome/Edge (getUserMedia)

2. Backend Developer
   - Create a `.env` file from `.env.example` and fill in Firebase Admin and Supabase service keys
   - Run backend and confirm /upload works
   - Replace dummy model with real trained model and ensure `MODEL_PATH` env variable points to it

3. ML Engineer
   - Train a pipeline on the UCI Parkinson's dataset
   - Save the pipeline with same feature ordering expected in `backend/model.py` (mean_pitch, jitter_local, shimmer_local, hnr, mfcc_means[0..12])
   - Save model using joblib to `backend/model/model.pkl`

4. QA / Tester
   - Create test users in Firebase, record and upload audio, verify DB rows in Supabase
   - Generate PDF report for a result: `python backend/generate_report.py`

## Setup steps (detailed)

### A. Firebase (frontend auth)
1. Create project at https://console.firebase.google.com/
2. Add a Web App and copy the config object (apiKey, authDomain, projectId, etc.)
3. Paste config into `frontend/login.html`, `frontend/signup.html`, and `frontend/dashboard.html`
4. Enable Email/Password sign-in (Authentication → Sign-in method)

### B. Supabase (storage & DB)
1. Create project at https://supabase.com/
2. In SQL Editor, run the following (create table and storage):

```sql
create table results (
  id uuid primary key default gen_random_uuid(),
  user_firebase_uid text not null,
  audio_path text,
  created_at timestamptz default now(),
  label text,
  score numeric,
  features jsonb
);
create index on results (user_firebase_uid, created_at desc);
```

3. Create a Storage bucket (Settings → Storage) named `audio-uploads`.
4. Get your `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` and put them in backend/.env.

### C. Backend .env
Copy `backend/.env.example` to `backend/.env` and fill:
- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY (the private key from service account JSON; replace newlines with \n)
- SUPABASE_URL
- SUPABASE_KEY
- SUPABASE_BUCKET (audio-uploads)
- MODEL_PATH (path to model.pkl)

### D. Running backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

### E. Running frontend
Open `frontend/index.html` in your browser. Use signup/login to create a user, then visit dashboard to record and upload.

## How the prediction flow works (for devs)
1. Frontend gets user ID token from Firebase and sends it in `Authorization: Bearer <idToken>` header to backend `/upload`.
2. Backend verifies token using Firebase Admin SDK and receives a decoded token with `uid`.
3. File saved to disk, optionally uploaded to Supabase Storage, then features extracted with parselmouth+librosa.
4. `backend/model.py` converts features to a vector and uses the saved pipeline to predict probability.
5. Backend inserts a row in Supabase `results` table linking `user_firebase_uid` -> prediction and features.
6. Frontend periodically calls `/user/results` to get the user's history and draw the timeline chart.

## Troubleshooting
- If token verification fails, ensure Firebase Admin credentials (service account) are correctly set in .env.
- If parselmouth import fails, install dependencies carefully; parselmouth wheel is available for many platforms. On Linux/WSL, consider `apt-get install libsndfile1` before pip.
- For Cross-Origin issues in frontend, either serve the HTML via a simple static server (python -m http.server) or configure CORS in FastAPI.

