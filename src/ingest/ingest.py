import os
import uuid
import logging
from src.ingest.aud import extract_audio, process_audio
from src.ingest.vid import analyze_and_extract_video, extract_snapshots_for_timestamps
from src.ingest.pipeline import insert_to_lancedb
from src.errors import AppError

logger = logging.getLogger(__name__)

TEMP_AUDIO_DIR = "data/temp_audio"
SNAPSHOT_DIR = "data/snapshots"


def ingest_video(
    video_path: str,
    title: str,
    original_filename: str,
    video_id: str | None = None,
) -> dict:
    """
    End-to-end ingestion orchestrator:
    1. Extracts audio and produces chunked speech embeddings via Groq.
    2. Analyzes video scenes and produces visual embeddings via Gemini.
    3. Extracts frame snapshots for each scene timestamp using OpenCV.
    4. Persists unified vector embeddings and metadata to LanceDB.
    """
    if not video_id:
        video_id = uuid.uuid4().hex[:12]

    os.makedirs(TEMP_AUDIO_DIR, exist_ok=True)
    os.makedirs(SNAPSHOT_DIR, exist_ok=True)

    video_filename = os.path.basename(video_path)
    audio_path = os.path.join(TEMP_AUDIO_DIR, f"{video_id}.mp3")

    logger.info("Starting ingestion for video: '%s' (ID: %s)...", title, video_id)

    # 1. Analyze Video Scenes
    logger.info("Analyzing video visual scenes...")
    scenes, video_items = analyze_and_extract_video(
        video_path=video_path,
        output_dir=SNAPSHOT_DIR,
        video_id=video_id,
        title=title,
        video_filename=video_filename,
        original_filename=original_filename,
    )

    # 2. Extract Snapshots for Scene Timestamps
    timestamps = [int(scene.start_time) for scene in scenes]
    if timestamps:
        logger.info("Extracting frame snapshots for %d timestamps...", len(timestamps))
        extract_snapshots_for_timestamps(
            video_path=video_path,
            timestamps_sec=timestamps,
            output_dir=SNAPSHOT_DIR,
            video_id=video_id,
        )

    # 3. Process Audio Transcription & Contextual Chunking
    audio_items = []
    try:
        logger.info("Extracting audio stream from video...")
        extract_audio(video_path=video_path, audio_path=audio_path)

        logger.info("Transcribing audio and building context chunks...")
        audio_items = process_audio(
            audio_path=audio_path,
            video_id=video_id,
            title=title,
            video_filename=video_filename,
            original_filename=original_filename,
        )
    except AppError as exc:
        logger.warning(
            "Audio pipeline skipped for video %s: %s. Continuing with visual items.",
            video_id,
            exc,
        )
    finally:
        if os.path.exists(audio_path):
            try:
                os.remove(audio_path)
            except OSError:
                pass

    # 4. Insert Unified Records into LanceDB
    all_items = video_items + audio_items
    logger.info(
        "Persisting %d records (%d visual, %d audio) to LanceDB...",
        len(all_items),
        len(video_items),
        len(audio_items),
    )
    insert_to_lancedb(all_items)

    return {
        "video_id": video_id,
        "title": title,
        "scenes_count": len(scenes),
        "video_items_count": len(video_items),
        "audio_items_count": len(audio_items),
        "total_records_inserted": len(all_items),
    }