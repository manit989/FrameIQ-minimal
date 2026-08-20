import os
import time
import cv2
import json
from dotenv import load_dotenv
from google import genai
from google.genai import types
from src.models.models import SceneCaption, Items
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

def extract_snapshots_for_timestamps(video_path: str, timestamps_sec: list[int], output_dir: str, video_id: str):
    """Extracts a frame snapshot for every timestamp in the provided list."""
    os.makedirs(output_dir, exist_ok=True)
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise IOError(f"Unable to open video source at '{video_path}'")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    for start_sec in set(timestamps_sec):
        frame_number = int(fps * start_sec)
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
        ret, frame = cap.read()
        if ret:
            snapshot_filename = f"{video_id}_{start_sec}s.jpg"
            snapshot_path = os.path.join(output_dir, snapshot_filename)
            cv2.imwrite(snapshot_path, frame)
    cap.release()

def analyze_and_extract_video(
    video_path: str, 
    output_dir: str, 
    video_id: str, 
    title: str, 
    video_filename: str
) -> tuple[list[SceneCaption], list[Items]]:
    video_file = upload_video(video_path)

    prompt = (
        "You are a video analysis expert. Analyze this video scene by scene.\n"
        "IMPORTANT: Break the video down into MULTIPLE distinct, granular scenes (aim for 5 to 15 scenes depending on length). "
        "Do NOT group the entire video into a single scene.\n\n"
        "For each distinct scene, extract:\n"
        "- start_time / end_time: precise timestamps in seconds\n"
        "- visual_description: detailed description of environment, actions, body language, and framing\n"
        "- detected_objects: prominent visible objects\n"
        "- recognized_figures: identify famous people/artists/public figures by name\n"
        "- activity_type: specific classification (e.g. 'freestyle rap', 'podcast interview', 'vlog')\n"
        "- setting: specific location description\n"
        "- visual_cues: observable indicators revealing content nature\n"
        "- audio_genre_and_mood: audio landscape description\n"
        "- semantic_intent: core purpose or meaning of this scene\n"
        "- search_tags: 5 high-level search keywords\n"
    )

    gemini_schema = {
        "type": "object",
        "properties": {
            "scenes": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "start_time": {"type": "number"},
                        "end_time": {"type": "number"},
                        "visual_description": {"type": "string"},
                        "detected_objects": {"type": "array", "items": {"type": "string"}},
                        "recognized_figures": {"type": "array", "items": {"type": "string"}},
                        "activity_type": {"type": "string"},
                        "setting": {"type": "string"},
                        "visual_cues": {"type": "array", "items": {"type": "string"}},
                        "audio_genre_and_mood": {"type": "string"},
                        "semantic_intent": {"type": "string"},
                        "search_tags": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": [
                        "start_time", "end_time", "visual_description",
                        "detected_objects", "recognized_figures", "activity_type",
                        "setting", "visual_cues", "audio_genre_and_mood",
                        "semantic_intent", "search_tags",
                    ],
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

    data = json.loads(response.text)
    scene_dicts = data.get("scenes", []) if isinstance(data, dict) else data
    scenes = [SceneCaption(**s) for s in scene_dicts]

    video_items = []
    for scene in scenes:
        figures_str = ', '.join(scene.recognized_figures) if scene.recognized_figures else 'none'
        scene_text = (
            f"[SCENE] {scene.visual_description} | "
            f"Activity: {scene.activity_type} | "
            f"Setting: {scene.setting} | "
            f"Figures: {figures_str} | "
            f"Objects: {', '.join(scene.detected_objects)} | "
            f"Cues: {', '.join(scene.visual_cues)} | "
            f"Audio: {scene.audio_genre_and_mood} | "
            f"Intent: {scene.semantic_intent} | "
            f"Tags: {', '.join(scene.search_tags)}"
        )
        vector = get_embedding(scene_text)
        
        item = Items(
            vector=vector,
            video_id=video_id,
            video_filename=video_filename,
            title=title,
            start_time=scene.start_time,
            end_time=scene.end_time,
            text=scene_text,
        )
        video_items.append(item)

    return scenes, video_items