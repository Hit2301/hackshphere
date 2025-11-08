from fastapi import FastAPI
from pydantic import BaseModel
app = FastAPI()
class Q(BaseModel):
    q: str
@app.post("/chat")
def chat(q: Q):
    # Simple rule-based demo bot. Replace with real AI integration if desired.
    text = q.q.lower()
    if 'report' in text:
        return {'answer': 'You can generate a PDF report from the dashboard by clicking the report button (demo).'}
    if 'how' in text or 'what' in text:
        return {'answer': 'Record a 3-5s vowel and upload. The model will return a risk score and timeline per user.'}
    return {'answer': 'This is a demo chatbot. For more, integrate a real LLM or retrieval system.'}
