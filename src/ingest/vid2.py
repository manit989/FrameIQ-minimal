import os
import time
import cv2
from dotenv import load_dotenv
from google import genai
from google.genai import types
from src.models.models import SceneCaption, VideoAnalysisResponse, Items
from src.ingest.embedder import get_embedding

load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")
client = genai.Client(api_key=api_key)
MODEL_ID = "gemini-3.5-flash-lite"

def upload_video(video_file_name: str):
    video_file = client.files.upload(file=video_file_name)
    while video_file.state.name != "ACTIVE":
        time.sleep(3)
        video_file = client.files.get(name=video_file.name)
        if video_file.state.name == "FAILED":
            raise RuntimeError(f"Gemini file processing failed: {video_file.error}")
    return video_file

def extract_snapshots(video_path: str, scenes: list[SceneCaption], output_dir: str):
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

def analyze_and_extract_video(video_path: str, output_dir: str, video_id: str, title: str) -> tuple[list[SceneCaption], list[Items]]:
    video_file = upload_video(video_path)
    prompt = "Analyze this video scene by scene. For each key event or topic change, provide exact timestamp in seconds, formatted timecode, and descriptive caption."

    # Define a clean schema for Gemini (no Optional/union types which break the API)
    gemini_schema = {
        "type": "object",
        "properties": {
            "scenes": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "timestamp_seconds": {"type": "number"},
                        "timestamp_formatted": {"type": "string"},
                        "description": {"type": "string"},
                    },
                    "required": ["timestamp_seconds", "timestamp_formatted", "description"],
                },
            }
        },
        "required": ["scenes"],
    }

    response = client.models.generate_content(
        model=MODEL_ID,
        contents=[video_file, prompt],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=gemini_schema,
            temperature=0.2,
        ),
    )

    import json
    raw = response.text
    data = json.loads(raw)

    # Handle both possible shapes: {"scenes": [...]} or bare [...]
    if isinstance(data, dict):
        scene_dicts = data.get("scenes", [])
    elif isinstance(data, list):
        scene_dicts = data
    else:
        raise ValueError(f"Unexpected Gemini response type: {type(data)}")

    scenes = [SceneCaption(**s) for s in scene_dicts]
    
    extract_snapshots(video_path, scenes, output_dir)

    video_items = []
    for i, scene in enumerate(scenes):
        end_time = scenes[i + 1].timestamp_seconds if i + 1 < len(scenes) else scene.timestamp_seconds + 5.0
        scene_text = f"[SCENE] {scene.description}"
        vector = get_embedding(scene_text)
        
        item = Items(
            vector=vector,
            video_id=video_id,
            title=title,
            start_time=scene.timestamp_seconds,
            end_time=end_time,
            text=scene_text
        )
        video_items.append(item)

    return scenes, video_items
