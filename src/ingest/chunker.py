import logging
from src.models.models import Items
from src.ingest.embedder import get_embedding

logger = logging.getLogger(__name__)

# Target duration (in seconds) for grouping small Whisper segments into a unified context chunk
TARGET_CHUNK_DURATION_SEC = 20.0
MAX_CHUNK_DURATION_SEC = 30.0


def chunk_and_embed_transcript(
    segments: list,
    video_id: str,
    title: str,
    video_filename: str,
    original_filename: str,
) -> list[Items]:
    """
    Groups raw Whisper segments into semantic time-windowed chunks to preserve conversational 
    context, then generates vector embeddings for each chunk.
    """
    if not segments:
        return []

    chunks = []
    current_text_parts = []
    chunk_start_time = None
    last_end_time = 0.0

    for segment in segments:
        # Extract fields safely across dict or object responses
        text = segment["text"] if isinstance(segment, dict) else segment.text
        start = segment["start"] if isinstance(segment, dict) else segment.start
        end = segment["end"] if isinstance(segment, dict) else segment.end

        text = text.strip()
        if not text:
            continue

        if chunk_start_time is None:
            chunk_start_time = start

        current_text_parts.append(text)
        last_end_time = end

        current_duration = last_end_time - chunk_start_time

        # If current accumulated duration meets or exceeds target window, finalize chunk
        if current_duration >= TARGET_CHUNK_DURATION_SEC or current_duration >= MAX_CHUNK_DURATION_SEC:
            combined_text = " ".join(current_text_parts)
            
            # Clean narrative format for dense vector representation
            clean_vector_text = f"Speaker transcript ({title}): {combined_text}"
            vector = get_embedding(clean_vector_text)

            item = Items(
                vector=vector,
                video_id=video_id,
                video_filename=video_filename,
                original_filename=original_filename,
                title=title,
                start_time=float(chunk_start_time),
                end_time=float(last_end_time),
                text=f"[AUDIO] {combined_text}",
            )
            chunks.append(item)

            # Reset window
            current_text_parts = []
            chunk_start_time = None

    # Process remaining tail segments
    if current_text_parts and chunk_start_time is not None:
        combined_text = " ".join(current_text_parts)
        clean_vector_text = f"Speaker transcript ({title}): {combined_text}"
        vector = get_embedding(clean_vector_text)

        item = Items(
            vector=vector,
            video_id=video_id,
            video_filename=video_filename,
            original_filename=original_filename,
            title=title,
            start_time=float(chunk_start_time),
            end_time=float(last_end_time),
            text=f"[AUDIO] {combined_text}",
        )
        chunks.append(item)

    return chunks