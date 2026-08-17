import os
import subprocess
from faster_whisper import WhisperModel
from src.models.models import Items
from src.ingest.embedder import get_embedding

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

def process_audio(audio_path: str, video_id: str, title: str) -> list[Items]:
    model_size = "large-v2"
    model = WhisperModel(model_size, device="cuda", compute_type="float16")

    segments, info = model.transcribe(audio_path, beam_size=5)
    print("Detected language '%s' with probability %f" % (info.language, info.language_probability))

    audio_items = []
    for segment in segments:
        clean_text = f"[AUDIO] {segment.text}"
        vector = get_embedding(clean_text)
        
        item = Items(
            vector=vector,
            video_id=video_id,
            title=title,
            start_time=segment.start,
            end_time=segment.end,
            text=clean_text
        )
        audio_items.append(item)
    
    return audio_items