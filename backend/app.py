from fastapi import FastAPI, File, UploadFile, Header, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os, tempfile, json
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
    allow_origins=["*"],  # you can replace "*" with ["http://127.0.0.1:5500"] if you serve via VSCode Live Server
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
        "private_key": FIREBASE_PRIVATE_KEY.replace('\\n', '\n'),
        "client_email": FIREBASE_CLIENT_EMAIL,
    }
    cred = credentials.Certificate(cred_dict)
    try:
        firebase_admin.initialize_app(cred)
    except Exception as e:
        # may already be initialized in dev reloads
        pass
else:
    print("WARNING: Firebase admin credentials not set. Token verification will fail.")

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
supabase = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    print("WARNING: Supabase not configured. DB/storage operations will be no-ops.")



def verify_token(auth_header: str = Header(None)):
    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    if auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1]
    else:
        token = auth_header
    try:
        decoded = firebase_auth.verify_id_token(token)
        return decoded
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

@app.post("/upload")
async def upload(file: UploadFile = File(...), user: dict = Depends(verify_token)):
    # Save file to temp
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    content = await file.read()
    tmp.write(content)
    tmp.flush()
    tmp.close()
    # Optional: upload to Supabase storage
    storage_path = f"{user['uid']}/{file.filename}"
    public_url = None
    if supabase:
        try:
            with open(tmp.name, 'rb') as f:
                supabase.storage().from_(os.getenv('SUPABASE_BUCKET')).upload(storage_path, f)
            public_url = supabase.storage().from_(os.getenv('SUPABASE_BUCKET')).get_public_url(storage_path).get('publicURL')
        except Exception as e:
            print("Supabase upload error:", e)
    # Run prediction
    label, score, features = predict_from_file(tmp.name)
    # Save to DB
    if supabase:
        try:
            supabase.table('results').insert({
                'user_firebase_uid': user['uid'],
                'audio_path': storage_path,
                'label': label,
                'score': float(score),
                'features': features,
            }).execute()
        except Exception as e:
            print("Supabase insert error:", e)
    return JSONResponse({'label': label, 'score': score, 'features': features, 'audio_url': public_url})

@app.get("/user/results")
def get_user_results(user: dict = Depends(verify_token)):
    if not supabase:
        return {'results': []}
    uid = user['uid']
    res = supabase.table('results').select('*').eq('user_firebase_uid', uid).order('created_at', {'ascending': False}).execute()
    return {'results': res.data}
