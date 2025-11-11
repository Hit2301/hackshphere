# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# system deps for librosa/soundfile if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libsndfile1 ffmpeg git curl \
  && rm -rf /var/lib/apt/lists/*

# copy only requirements first (speeds rebuild)
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

# create models folder in container (if you will copy models)
RUN mkdir -p /app/ml_training/models

# expose port
ENV PORT 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
