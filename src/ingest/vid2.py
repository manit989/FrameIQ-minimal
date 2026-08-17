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
        # Use start_time to grab the representative frame
        frame_number = int(fps * scene.start_time)
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
        ret, frame = cap.read()
        if ret:
            snapshot_filename = f"scene_{idx}_{int(scene.start_time)}s.jpg"
            snapshot_path = os.path.join(output_dir, snapshot_filename)
            cv2.imwrite(snapshot_path, frame)
            scene.snapshot_url = f"/snapshots/{snapshot_filename}"
    cap.release()

def analyze_and_extract_video(video_path: str, output_dir: str, video_id: str, title: str) -> tuple[list[SceneCaption], list[Items]]:
    video_file = upload_video(video_path)

    prompt = (
        "You are a video analysis expert. Analyze this video scene by scene.\n"
        "For each distinct scene (key event, topic change, new person appearing, or shift in activity), extract:\n\n"
        "- start_time / end_time: precise timestamps in seconds\n"
        "- visual_description: detailed description of the environment, actions, body language, and framing\n"
        "- detected_objects: all prominent visible objects (microphone, turntable, laptop, spray can, instrument, etc.)\n"
        "- recognized_figures: identify ANY famous people, artists, musicians, actors, public figures, YouTubers, or streamers by name. "
        "If you're not confident, still provide your best guess with context (e.g., 'possibly Eminem based on appearance'). Return empty list only if no one is recognizable.\n"
        "- activity_type: classify what is happening in concrete terms. Examples: 'freestyle rap', 'music video performance', "
        "'podcast interview', 'cooking tutorial', 'live concert', 'street busking', 'product review', 'gaming stream', 'vlog'. Be specific, not vague.\n"
        "- setting: describe WHERE this is taking place. Examples: 'recording studio with sound panels', 'outdoor street corner at night', "
        "'professional stage with lighting rig', 'home kitchen', 'podcast desk setup'. Be specific.\n"
        "- visual_cues: list observable indicators that reveal the nature of the content. "
        "Examples: 'handheld microphone', 'freestyle cipher circle', 'beat playing from speaker', 'graffiti backdrop', "
        "'ring light', 'dual monitor setup', 'chef knife and cutting board'. These are the clues a human would use to instantly recognize what's happening.\n"
        "- audio_genre_and_mood: describe the audio landscape. Examples: 'boom-bap beat, aggressive freestyle delivery', "
        "'lo-fi hip-hop instrumental, chill vibe', 'no music, conversational podcast tone', 'heavy metal, mosh pit energy'\n"
        "- semantic_intent: what is the PURPOSE or meaning of this scene? Examples: 'Artist freestyling over a boom-bap beat about street life', "
        "'Host interviewing guest about their new album', 'Chef demonstrating knife technique for beginners'\n"
        "- search_tags: 5 high-level keywords a user would search to find this type of content\n"
    )

    # Define a clean schema for Gemini (no Optional/union types which break the API)
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
                        "detected_objects": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                        "recognized_figures": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                        "activity_type": {"type": "string"},
                        "setting": {"type": "string"},
                        "visual_cues": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                        "audio_genre_and_mood": {"type": "string"},
                        "semantic_intent": {"type": "string"},
                        "search_tags": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
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

    # Build rich text for embedding from all the scene metadata
    video_items = []
    for scene in scenes:
        print(scene)
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
            title=title,
            start_time=scene.start_time,
            end_time=scene.end_time,
            text=scene_text,
        )
        video_items.append(item)

    return scenes, video_items
