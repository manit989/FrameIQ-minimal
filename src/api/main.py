import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.ingest.vid2 import analyze_and_extract_video
from src.ingest.aud import extract_audio, process_audio
from src.ingest.pipeline import insert_to_lancedb
from src.models.models import VideoAnalysisRequest, VideoAnalysisResponse

app = FastAPI(title="FrameIQ API")

VIDEOS_DIR = "data/videos"
SNAPSHOTS_DIR = "data/snapshots"
os.makedirs(VIDEOS_DIR, exist_ok=True)
os.makedirs(SNAPSHOTS_DIR, exist_ok=True)

app.mount("/snapshots", StaticFiles(directory=SNAPSHOTS_DIR), name="snapshots")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok", "service": "FrameIQ API"}

@app.post("/api/analyze", response_model=VideoAnalysisResponse)
def analyze_video(payload: VideoAnalysisRequest):
    video_path = os.path.join(VIDEOS_DIR, payload.video_filename)

    if not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail=f"Video '{payload.video_filename}' not found.")

    # Dynamically generate audio path based on video filename
    video_id = payload.video_filename.rsplit('.', 1)[0]
    audio_filename = f"{video_id}.mp3"
    audio_path = os.path.join(VIDEOS_DIR, audio_filename)
    title = f"Analysis of {payload.video_filename}"

    try:
        # 1. Auto-extract Audio
        extract_audio(video_path, audio_path)

        # 2. Process Video via Gemini & Extract Snapshots
        scenes, video_db_items = analyze_and_extract_video(video_path, SNAPSHOTS_DIR, video_id, title)
        
        # 3. Process Audio via Whisper
        audio_db_items = process_audio(audio_path, video_id, title)

        # 4. Insert both into LanceDB Vector Store
        all_db_items = video_db_items + audio_db_items
        insert_to_lancedb(all_db_items)

    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))

    return VideoAnalysisResponse(
        video_filename=payload.video_filename,
        total_scenes=len(scenes),
        scenes=scenes,
    )