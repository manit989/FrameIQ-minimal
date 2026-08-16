# run these commands before  running this file 
#uv add opencv-python pydantic

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
VIDEO_PATH = "../../data/videos/output.mp4"
SNAPSHOTS_DIR = "../../data/snapshots"


# 1. Define Pydantic Schema for Structured JSON Output
class SceneCaption(BaseModel):
    timestamp_seconds: float = Field(
        description="Exact timestamp in seconds where this scene or event occurs"
    )
    timestamp_formatted: str = Field(
        description="Formatted timecode string, e.g. 00:01:15 or 01:23"
    )
    description: str = Field(
        description="Detailed caption of what is happening in the scene"
    )


class VideoAnalysis(BaseModel):
    scenes: list[SceneCaption]


def upload_video(video_file_name):
    print(f"Uploading {video_file_name}...")
    video_file = client.files.upload(file=video_file_name)

    # Poll until video processing is completed
    while video_file.state.name != "ACTIVE":
        print(
            f"Current state: {video_file.state.name} - Waiting for video to be processed..."
        )
        time.sleep(5)

        # Ping the API to refresh the object state
        video_file = client.files.get(name=video_file.name)

        if video_file.state.name == "FAILED":
            raise ValueError(
                f"Video processing failed. Reason: {video_file.error}"
            )

    print(f"Video processing complete: {video_file.uri}")
    return video_file


def extract_snapshots(video_path, scenes, output_dir):
    """Reads local video file using OpenCV and extracts frames at given scene timestamps."""
    os.makedirs(output_dir, exist_ok=True)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error: Could not open video file at {video_path}")
        return

    fps = cap.get(cv2.CAP_PROP_FPS)
    print(f"\nExtracting snapshots (Video FPS: {fps:.2f})...")

    for idx, scene in enumerate(scenes):
        sec = scene.timestamp_seconds
        frame_number = int(fps * sec)

        # Seek to frame position
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
        ret, frame = cap.read()

        if ret:
            snapshot_filename = f"scene_{idx+1}_{int(sec)}s.jpg"
            snapshot_path = os.path.join(output_dir, snapshot_filename)
            cv2.imwrite(snapshot_path, frame)
            print(
                f" Saved: {snapshot_filename} [{scene.timestamp_formatted}]"
            )
        else:
            print(
                f" Failed to extract frame at {sec}s ({scene.timestamp_formatted})"
            )

    cap.release()


def main():
    # 1. Upload Video
    video_file = upload_video(VIDEO_PATH)

    prompt = (
        "Analyze this video scene by scene. For each key event or topic change, "
        "provide the exact timestamp in seconds, a formatted timecode, and a descriptive caption."
    )

    print("\nPrompting Gemini with Structured Output schema...")

    # 2. Call Gemini API using Structured Output JSON
    response = client.models.generate_content(
        model=MODEL_ID,
        contents=[video_file, prompt],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=VideoAnalysis,
            temperature=0.2,
        ),
    )

    # 3. Parse JSON Response into Python Data Structure
    analysis_result = VideoAnalysis.model_validate_json(response.text)

    print("\n--- DETECTED SCENES & CAPTIONS ---")
    for idx, scene in enumerate(analysis_result.scenes, start=1):
        print(
            f"{idx}. [{scene.timestamp_formatted}] ({scene.timestamp_seconds}s): {scene.description}"
        )

    # 4. Extract Local Snapshots using OpenCV
    extract_snapshots(VIDEO_PATH, analysis_result.scenes, SNAPSHOTS_DIR)

    print(f"\nProcessing complete! All snapshots saved to '{SNAPSHOTS_DIR}'.")


if __name__ == "__main__":
    main()