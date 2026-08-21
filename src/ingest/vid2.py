import os
import time
import cv2
import json
import logging
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import ValidationError
from src.models.models import SceneCaption, Items
from src.ingest.embedder import get_embedding
from src.errors import (
    GeminiServiceError,
    InvalidProviderResponseError,
    SnapshotExtractionError,
    VideoDecodeError,
    gemini_error,
)

load_dotenv()
logger = logging.getLogger(__name__)
client = None
MODEL_ID = "gemini-3.5-flash-lite"
GEMINI_FILE_TIMEOUT_SECONDS = 300


def get_gemini_client():
    global client
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise GeminiServiceError(
            code="GEMINI_CONFIGURATION_ERROR",
            message="Gemini is not configured on the server.",
            status_code=503,
        )
    if client is None:
        try:
            client = genai.Client(api_key=api_key)
        except Exception as exc:
            raise gemini_error(exc, "client initialization") from exc
    return client


def delete_uploaded_video(video_file) -> None:
    name = getattr(video_file, "name", None)
    if not name:
        return
    try:
        get_gemini_client().files.delete(name=name)
    except Exception as exc:
        logger.warning("Could not delete Gemini file %s: %r", name, exc)


def upload_video(video_file_name: str):
    video_file = None
    try:
        gemini_client = get_gemini_client()
        video_file = gemini_client.files.upload(file=video_file_name)
        deadline = time.monotonic() + GEMINI_FILE_TIMEOUT_SECONDS

        while True:
            state = getattr(getattr(video_file, "state", None), "name", "UNKNOWN")
            if state == "ACTIVE":
                return video_file
            if state in ("FAILED", "CANCELLED"):
                raise GeminiServiceError(
                    code="GEMINI_FILE_PROCESSING_FAILED",
                    message="Gemini could not prepare this video for analysis.",
                    status_code=502,
                    retryable=True,
                )
            if time.monotonic() >= deadline:
                raise GeminiServiceError(
                    code="GEMINI_FILE_TIMEOUT",
                    message="Gemini took too long to prepare this video.",
                    status_code=504,
                    retryable=True,
                )

            time.sleep(3)
            video_file = gemini_client.files.get(name=video_file.name)
    except GeminiServiceError:
        if video_file is not None:
            delete_uploaded_video(video_file)
        raise
    except Exception as exc:
        if video_file is not None:
            delete_uploaded_video(video_file)
        raise gemini_error(exc, "video upload") from exc


def extract_snapshots_for_timestamps(video_path: str, timestamps_sec: list[int], output_dir: str, video_id: str):
    """Extracts a frame snapshot for every timestamp in the provided list."""
    try:
        os.makedirs(output_dir, exist_ok=True)
    except OSError as exc:
        raise SnapshotExtractionError() from exc

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        cap.release()
        raise VideoDecodeError()

    timestamps = set(timestamps_sec)
    written_count = 0
    try:
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        for start_sec in timestamps:
            frame_number = int(fps * start_sec)
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
            ret, frame = cap.read()
            if not ret:
                continue

            snapshot_filename = f"{video_id}_{start_sec}s.jpg"
            snapshot_path = os.path.join(output_dir, snapshot_filename)
            if not cv2.imwrite(snapshot_path, frame):
                raise SnapshotExtractionError()
            written_count += 1
    except cv2.error as exc:
        raise SnapshotExtractionError() from exc
    finally:
        cap.release()

    if timestamps and written_count == 0:
        raise VideoDecodeError()


def analyze_and_extract_video(
    video_path: str, 
    output_dir: str, 
    video_id: str, 
    title: str, 
    video_filename: str,
    original_filename: str,
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

    try:
        try:
            response = get_gemini_client().models.generate_content(
                model=MODEL_ID,
                contents=[video_file, prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=gemini_schema,
                    temperature=0.2,
                ),
            )
        except GeminiServiceError:
            raise
        except Exception as exc:
            raise gemini_error(exc, "video analysis") from exc

        try:
            if not response.text:
                raise ValueError("Empty Gemini response")
            data = json.loads(response.text)
            scene_dicts = data.get("scenes", []) if isinstance(data, dict) else data
            if not isinstance(scene_dicts, list):
                raise TypeError("Gemini scenes must be a list")
            scenes = [SceneCaption(**scene) for scene in scene_dicts]
        except (json.JSONDecodeError, ValidationError, TypeError, ValueError) as exc:
            raise InvalidProviderResponseError(
                code="GEMINI_INVALID_RESPONSE",
                message="Gemini returned an invalid video analysis response.",
                status_code=502,
                retryable=True,
            ) from exc
    finally:
        delete_uploaded_video(video_file)

    video_items = []
    for scene in scenes:
        figures_str = f" featuring {', '.join(scene.recognized_figures)}" if scene.recognized_figures else ""
        objects_str = f" Visible items: {', '.join(scene.detected_objects)}." if scene.detected_objects else ""
        
        clean_vector_text = (
            f"{scene.visual_description}{figures_str}. "
            f"Activity: {scene.activity_type} in {scene.setting}. "
            f"Intent: {scene.semantic_intent}.{objects_str}"
        )
        
        vector = get_embedding(clean_vector_text)
        
        item = Items(
            vector=vector,
            video_id=video_id,
            video_filename=video_filename,
            original_filename=original_filename,
            title=title,
            start_time=scene.start_time,
            end_time=scene.end_time,
            text=f"[SCENE] {clean_vector_text}",
        )
        video_items.append(item)

    return scenes, video_items