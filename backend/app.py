from fastapi import FastAPI, File, UploadFile, Header, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os, tempfile
from dotenv import load_dotenv
load_dotenv()

# Firebase admin init (requires credentials)
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from supabase import create_client
from model import predict_from_file

app = FastAPI()

# Allow frontend to connect (CORS fix)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # you can specify your frontend URL if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Firebase admin using env variables for service account
FIREBASE_PRIVATE_KEY = os.getenv("FIREBASE_PRIVATE_KEY")
FIREBASE_CLIENT_EMAIL = os.getenv("FIREBASE_CLIENT_EMAIL")
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID")

if FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL and FIREBASE_PROJECT_ID:
    cred_dict = {
        "type": "service_account",
        "project_id": FIREBASE_PROJECT_ID,
        "private_key_id": "dummy_key_id",
        "private_key": FIREBASE_PRIVATE_KEY.replace('\\n', '\n'),
        "client_email": FIREBASE_CLIENT_EMAIL,
        "client_id": "dummy_client_id",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{FIREBASE_CLIENT_EMAIL}"
    }
    try:
        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred)
    except Exception:
        pass
else:
    print("⚠️ Firebase admin credentials not set. Token verification will fail.")

# Initialize Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    print("⚠️ Supabase not configured. DB/storage operations disabled.")


# ✅ Token verification
def verify_token(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    if authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
    else:
        token = authorization
    try:
        decoded = firebase_auth.verify_id_token(token)
        return decoded
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


# ✅ Upload route
@app.post("/upload")
async def upload(file: UploadFile = File(...), user: dict = Depends(verify_token)):
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    content = await file.read()
    tmp.write(content)
    tmp.flush()
    tmp.close()

    # Ensure audio is valid
    if os.path.getsize(tmp.name) < 1000:
        raise HTTPException(status_code=400, detail="Uploaded file too small or invalid audio.")

    storage_path = f"{user['uid']}/{file.filename}"
    public_url = None

    if supabase:
        try:
            with open(tmp.name, "rb") as f:
                supabase.storage.from_(os.getenv("SUPABASE_BUCKET")).upload(storage_path, f)
            public_url = supabase.storage.from_(os.getenv("SUPABASE_BUCKET")).get_public_url(storage_path)
        except Exception as e:
            print("Supabase upload error:", e)

    label, score, features = predict_from_file(tmp.name)

    if supabase:
        try:
            supabase.table("results").insert({
                "user_firebase_uid": user["uid"],
                "audio_path": storage_path,
                "label": label,
                "score": float(score),
                "features": features,
            }).execute()
        except Exception as e:
            print("Supabase insert error:", e)

    return JSONResponse({
        "label": label,
        "score": score,
        "features": features,
        "audio_url": public_url
    })


# ✅ Fetch results
@app.get("/user/results")
def get_user_results(user: dict = Depends(verify_token)):
    if not supabase:
        return {"results": []}
    uid = user["uid"]
    res = supabase.table("results").select("*").eq("user_firebase_uid", uid).order("created_at", desc=True).execute()
    return {"results": res.data}


# ✅ Root check
@app.get("/")
def root():
    return {"message": "Parkinson backend running successfully ✅"}
