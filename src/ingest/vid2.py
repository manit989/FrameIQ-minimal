import json
import os
import time
import cv2
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

# Load environment variables
load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY")
client = genai.Client(api_key=api_key)

MODEL_ID = "gemini-3.7-flash"


class SceneCaption(BaseModel):
    timestamp_seconds: float = Field(
        description="Exact timestamp in seconds where this scene occurs"
    )
    timestamp_formatted: str = Field(
        description="Formatted timecode string, e.g. 00:01:15"
    )
    description: str = Field(
        description="Detailed caption of what is happening in the scene"
    )
    snapshot_url: str | None = Field(
        default=None, description="HTTP path to snapshot image"
    )


class VideoAnalysis(BaseModel):
    scenes: list[SceneCaption]


def upload_video(video_file_name: str):
    """Handles uploading and polling until Gemini processing completes."""
    video_file = client.files.upload(file=video_file_name)

    while video_file.state.name != "ACTIVE":
        time.sleep(3)
        video_file = client.files.get(name=video_file.name)
        if video_file.state.name == "FAILED":
            raise RuntimeError(f"Gemini file processing failed: {video_file.error}")

    return video_file


def extract_snapshots(video_path: str, scenes: list[SceneCaption], output_dir: str):
    """Extracts frame snapshots at specified timestamps using OpenCV."""
    os.makedirs(output_dir, exist_ok=True)
    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        raise IOError(f"Unable to open video source at '{video_path}'")

    fps = cap.get(cv2.CAP_PROP_FPS)

    for idx, scene in enumerate(scenes, start=1):
        sec = scene.timestamp_seconds
        frame_number = int(fps * sec)

        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
        ret, frame = cap.read()

        if ret:
            snapshot_filename = f"scene_{idx}_{int(sec)}s.jpg"
            snapshot_path = os.path.join(output_dir, snapshot_filename)
            cv2.imwrite(snapshot_path, frame)
            scene.snapshot_url = f"/snapshots/{snapshot_filename}"

    cap.release()


def analyze_and_extract_video(video_path: str, output_dir: str) -> list[SceneCaption]:
    """Pipeline orchestrator for video analysis and frame extraction."""
    video_file = upload_video(video_path)

    prompt = (
        "Analyze this video scene by scene. For each key event or topic change, "
        "provide exact timestamp in seconds, formatted timecode, and descriptive caption."
    )

    response = client.models.generate_content(
        model=MODEL_ID,
        contents=[video_file, prompt],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=VideoAnalysis,
            temperature=0.2,
        ),
    )

    analysis_result = VideoAnalysis.model_validate_json(response.text)
    extract_snapshots(video_path, analysis_result.scenes, output_dir)

    return analysis_result.scenes