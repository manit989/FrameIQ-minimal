import os
import logging
import subprocess
from dotenv import load_dotenv
from groq import Groq
from src.models.models import Items
from src.ingest.embedder import get_embedding
from src.errors import (
    AudioExtractionError,
    AudioFileReadError,
    GroqServiceError,
    InvalidProviderResponseError,
    MediaProcessingTimeoutError,
    MediaToolUnavailableError,
    groq_error,
)

load_dotenv()
logger = logging.getLogger(__name__)
client = None


def get_groq_client():
    global client
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise GroqServiceError(
            code="GROQ_CONFIGURATION_ERROR",
            message="Groq transcription is not configured on the server.",
            status_code=503,
        )
    if client is None:
        try:
            client = Groq(api_key=api_key)
        except Exception as exc:
            raise groq_error(exc, "client initialization") from exc
    return client

def extract_audio(video_path: str, audio_path: str):
    """Dynamically extracts audio from the video file using FFmpeg."""
    if os.path.exists(audio_path):
        print(f"Audio already exists at {audio_path}, skipping extraction.")
        return

    print(f"Extracting audio from {video_path}...")
    command = [
        "ffmpeg", "-y", "-i", video_path,
        "-q:a", "0", "-map", "a", audio_path
    ]
    
    try:
        subprocess.run(
            command,
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            timeout=300,
        )
        print(f"Audio extraction complete: {audio_path}")
    except FileNotFoundError as exc:
        raise MediaToolUnavailableError() from exc
    except subprocess.TimeoutExpired as exc:
        raise MediaProcessingTimeoutError() from exc
    except subprocess.CalledProcessError as exc:
        logger.warning("FFmpeg audio extraction failed: %s", exc.stderr)
        raise AudioExtractionError() from exc
    except OSError as exc:
        raise MediaToolUnavailableError() from exc

def process_audio(
    audio_path: str,
    video_id: str,
    title: str,
    video_filename: str,
    original_filename: str,
) -> list[Items]:
    try:
        with open(audio_path, "rb") as file:
            audio_contents = file.read()
    except OSError as exc:
        raise AudioFileReadError() from exc

    try:
        transcription = get_groq_client().audio.transcriptions.create(
            file=(audio_path, audio_contents),
            model="whisper-large-v3-turbo",
            temperature=0,
            response_format="verbose_json",
        )
    except GroqServiceError:
        raise
    except Exception as exc:
        raise groq_error(exc) from exc

    segments = getattr(transcription, "segments", None)
    if segments is None:
        raise InvalidProviderResponseError(
            code="GROQ_INVALID_RESPONSE",
            message="Groq transcription returned an invalid response.",
            status_code=502,
            retryable=True,
        )

    audio_items = []
    for segment in segments:
        try:
            segment_text = segment["text"] if isinstance(segment, dict) else segment.text
            start_time = segment["start"] if isinstance(segment, dict) else segment.start
            end_time = segment["end"] if isinstance(segment, dict) else segment.end
        except (AttributeError, KeyError, TypeError) as exc:
            raise InvalidProviderResponseError(
                code="GROQ_INVALID_RESPONSE",
                message="Groq transcription returned malformed audio segments.",
                status_code=502,
                retryable=True,
            ) from exc

        if (
            not isinstance(segment_text, str)
            or not isinstance(start_time, (int, float))
            or not isinstance(end_time, (int, float))
        ):
            raise InvalidProviderResponseError(
                code="GROQ_INVALID_RESPONSE",
                message="Groq transcription returned malformed audio segments.",
                status_code=502,
                retryable=True,
            )

        clean_text = f"[AUDIO] {segment_text}"
        vector = get_embedding(clean_text)
        
        item = Items(
            vector=vector,
            video_id=video_id,
            video_filename=video_filename,  # Added missing field
            original_filename=original_filename,
            title=title,
            start_time=start_time,
            end_time=end_time,
            text=clean_text
        )
        audio_items.append(item)
    
    return audio_items
