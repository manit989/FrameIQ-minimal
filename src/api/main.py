import os
import subprocess
import imageio_ffmpeg
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

load_dotenv()

app = FastAPI(title="FrameIQ API")

# Directories Setup & Static Serving
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

# Global Clients & Tools
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
MODEL_ID = "gemini-3.7-flash"
FFMPEG_EXE = imageio_ffmpeg.get_ffmpeg_exe()


# --- Schemas ---
class SceneCaption(BaseModel):
    timestamp_seconds: float = Field(description="Timestamp in seconds")
    timestamp_formatted: str = Field(description="Formatted timecode (e.g. 00:01:15)")
    description: str = Field(description="Scene description from Gemini")
    snapshot_url: str | None = Field(default=None, description="Static HTTP URL to snapshot image")


class VideoAnalysisRequest(BaseModel):
    video_filename: str = Field(default="output.mp4")


class VideoAnalysisResponse(BaseModel):
    video_filename: str
    total_scenes: int
    scenes: list[SceneCaption]


# --- Helper Functions ---
def extract_snapshot_frame(video_path: str, sec: float, output_path: str) -> bool:
    """Extracts a single frame using FFmpeg CLI."""
    cmd = [
        FFMPEG_EXE, "-y", "-ss", str(sec), "-i", video_path,
        "-vframes", "1", "-q:v", "2", output_path
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return os.path.exists(output_path)


def analyze_with_gemini(video_path: str) -> list[SceneCaption]:
    """Uploads video to Gemini and retrieves structured scene analysis."""
    video_file = client.files.upload(file=video_path)
    
    while video_file.state.name != "ACTIVE":
        video_file = client.files.get(name=video_file.name)
        if video_file.state.name == "FAILED":
            raise ValueError(f"Gemini processing failed: {video_file.error}")

    prompt = (
        "Analyze this video scene by scene. For each key event or transition, "
        "provide timestamp in seconds, formatted timecode, and detailed caption."
    )

    response = client.models.generate_content(
        model=MODEL_ID,
        contents=[video_file, prompt],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=list[SceneCaption],
            temperature=0.2,
        ),
    )
    return response.parsed


# --- Endpoints ---
@app.get("/health")
def health():
    return {"status": "ok", "service": "FrameIQ API"}


@app.post("/api/analyze", response_model=VideoAnalysisResponse)
def analyze_video(payload: VideoAnalysisRequest):
    video_path = os.path.join(VIDEOS_DIR, payload.video_filename)

    if not os.path.exists(video_path):
        raise HTTPException(
            status_code=404,
            detail=f"Video '{payload.video_filename}' not found in {VIDEOS_DIR}/"
        )

    try:
        scenes: list[SceneCaption] = analyze_with_gemini(video_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Snapshot extraction loop
    for idx, scene in enumerate(scenes, start=1):
        filename = f"scene_{idx}_{int(scene.timestamp_seconds)}s.jpg"
        snapshot_path = os.path.join(SNAPSHOTS_DIR, filename)

        if extract_snapshot_frame(video_path, scene.timestamp_seconds, snapshot_path):
            scene.snapshot_url = f"/snapshots/{filename}"

    return VideoAnalysisResponse(
        video_filename=payload.video_filename,
        total_scenes=len(scenes),
        scenes=scenes,
    )