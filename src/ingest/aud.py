import os
import subprocess
from groq import Groq
from src.models.models import Items
from src.ingest.embedder import get_embedding

client = Groq()

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
        # Run FFMPEG silently
        subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f"Audio extraction complete: {audio_path}")
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"FFMPEG failed to extract audio: {e}")

def process_audio(audio_path: str, video_id: str, title: str, video_filename: str) -> list[Items]:
    with open(audio_path, "rb") as file:
        transcription = client.audio.transcriptions.create(
          file=(audio_path, file.read()),
          model="whisper-large-v3-turbo",
          temperature=0,
          response_format="verbose_json",
        )

    audio_items = []
    for segment in transcription.segments: # type: ignore
        clean_text = f"[AUDIO] {segment['text']}"
        vector = get_embedding(clean_text)

        print(segment)
        
        item = Items(
            vector=vector,
            video_id=video_id,
            video_filename=video_filename,  # Added missing field
            title=title,
            start_time=segment['start'],
            end_time=segment['end'],
            text=clean_text
        )
        audio_items.append(item)
    
    return audio_items