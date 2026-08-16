import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.ingest.vid2 import analyze_and_extract_video
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
        raise HTTPException(
            status_code=404,
            detail=f"Video '{payload.video_filename}' not found in {VIDEOS_DIR}/",
        )

    try:
        scenes = analyze_and_extract_video(video_path, SNAPSHOTS_DIR)
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))

    return VideoAnalysisResponse(
        video_filename=payload.video_filename,
        total_scenes=len(scenes),
        scenes=scenes,
    )