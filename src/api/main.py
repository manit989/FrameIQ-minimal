import errno
import logging
import os
import uuid
from fastapi import FastAPI, Form, Query, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.api.error_handlers import register_error_handlers
from src.ingest.vid2 import analyze_and_extract_video, extract_snapshots_for_timestamps
from src.ingest.aud import extract_audio, process_audio
from src.ingest.pipeline import get_video_metadata_items, insert_to_lancedb, search_items
from src.models.models import (
    SearchResponse,
    SearchResultItem,
    TitleSearchResponse,
    VideoAnalysisResponse,
    VideoListItem,
    VideoListResponse,
)
from src.ingest.embedder import get_embedding
from src.errors import (
    AnalysisEmptyError,
    AppError,
    DatabaseDataError,
    FileStorageError,
    SearchValidationError,
    UnsupportedVideoError,
    UploadReadError,
    UploadTooLargeError,
    UploadValidationError,
)

app = FastAPI(title="FrameIQ API")
register_error_handlers(app)

logger = logging.getLogger(__name__)

VIDEOS_DIR = "data/videos"
SNAPSHOTS_DIR = "data/snapshots"
MAX_UPLOAD_SIZE_MB = 500
MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024
UPLOAD_CHUNK_SIZE = 1024 * 1024
SUPPORTED_VIDEO_EXTENSIONS = {"mp4", "mov", "avi", "webm", "mkv", "m4v"}
os.makedirs(VIDEOS_DIR, exist_ok=True)
os.makedirs(SNAPSHOTS_DIR, exist_ok=True)


def _video_items_from_rows(rows: list[dict]) -> list[VideoListItem]:
    """Collapse scene-level database rows into one result per video."""
    try:
        grouped: dict[str, list[dict]] = {}
        for row in rows:
            video_id = row["video_id"]
            if video_id == "init":
                continue
            grouped.setdefault(video_id, []).append(row)

        videos = []
        for video_id, scenes in grouped.items():
            scenes.sort(key=lambda row: row["start_time"])
            first = scenes[0]
            last = scenes[-1]
            start_sec = int(round(first["start_time"]))
            total_duration = last["end_time"]
            mins = int(total_duration // 60)
            secs = int(total_duration % 60)

            videos.append(VideoListItem(
                video_id=video_id,
                video_filename=first.get("video_filename", f"{video_id}.mp4"),
                original_filename=(
                    first.get("original_filename")
                    or first.get("title")
                    or first.get("video_filename", f"{video_id}.mp4")
                ),
                title=first["title"],
                thumbnail_url=f"/snapshots/{video_id}_{start_sec}s.jpg",
                scene_count=len(scenes),
                duration=f"{mins}:{secs:02d}",
            ))
    except (KeyError, TypeError, ValueError) as exc:
        raise DatabaseDataError() from exc

    return videos


def _title_match_rank(title: str, normalized_query: str) -> int:
    normalized_title = title.casefold()
    if normalized_title == normalized_query:
        return 0
    if normalized_title.startswith(normalized_query):
        return 1
    return 2

app.mount("/snapshots", StaticFiles(directory=SNAPSHOTS_DIR), name="snapshots")
app.mount("/videos", StaticFiles(directory=VIDEOS_DIR), name="videos")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)

@app.get("/health")
def health():
    return {"status": "ok", "service": "FrameIQ API"}

@app.get("/api/videos", response_model=VideoListResponse)
def list_videos():
    """Return all distinct analyzed videos with a representative thumbnail and scene count."""
    return VideoListResponse(videos=_video_items_from_rows(get_video_metadata_items()))


@app.get("/api/videos/search", response_model=TitleSearchResponse)
def search_video_titles(
    query: str = Query(min_length=1, max_length=500),
    limit: int = Query(default=10, ge=1, le=100),
):
    """Return distinct videos whose user-provided title contains the query."""
    normalized_query = query.strip()
    if not normalized_query:
        raise SearchValidationError()

    casefolded_query = normalized_query.casefold()
    matching_videos = [
        video
        for video in _video_items_from_rows(get_video_metadata_items())
        if casefolded_query in video.title.casefold()
    ]
    matching_videos.sort(key=lambda video: (
        _title_match_rank(video.title, casefolded_query),
        video.title.casefold(),
        video.video_id,
    ))
    results = matching_videos[:limit]

    return TitleSearchResponse(
        query=normalized_query,
        count=len(results),
        results=results,
    )

@app.get("/search", response_model=SearchResponse)
def get_videos(
    query: str = Query(min_length=1, max_length=500),
    limit: int = Query(default=10, ge=1, le=100),
):
    normalized_query = query.strip()
    if not normalized_query:
        raise SearchValidationError()

    query_vector = get_embedding(normalized_query)
    raw_results = search_items(query_vector, limit)

    try:
        results = []
        for row in raw_results:
            # Use int(round(...)) to prevent decimal mismatches on frame snapshots.
            start_sec = int(round(row["start_time"]))

            results.append(SearchResultItem(
                video_id=row["video_id"],
                # Retrieve exact extension stored in LanceDB, fallback to .mp4 for legacy rows.
                video_filename=row.get("video_filename", f"{row['video_id']}.mp4"),
                title=row["title"],
                start_time=row["start_time"],
                end_time=row["end_time"],
                text=row.get("text", ""),
                thumbnail_url=f"/snapshots/{row['video_id']}_{start_sec}s.jpg",
                similarity_score=1 - row.get("_distance", 0),
            ))
    except (KeyError, TypeError, ValueError) as exc:
        raise DatabaseDataError() from exc

    return SearchResponse(query=normalized_query, count=len(results), results=results)

@app.post("/api/analyze", response_model=VideoAnalysisResponse)
async def analyze_video(
    file: UploadFile,
    title: str = Form(..., min_length=1, max_length=200),
):
    # Validate that an actual video was uploaded
    if not file.filename:
        raise UploadValidationError("No video file was uploaded.")

    title = title.strip()
    if not title:
        raise UploadValidationError("Video title is required.")

    original_filename = file.filename.replace("\\", "/").rsplit("/", 1)[-1]
    if not original_filename:
        raise UploadValidationError("The uploaded video has no filename.")

    # Generate a UUID-based video_id and preserve the original extension (.webm, .mp4, etc.)
    ext = original_filename.rsplit('.', 1)[-1] if '.' in original_filename else "mp4"
    ext = ext.lower()
    if ext not in SUPPORTED_VIDEO_EXTENSIONS:
        raise UnsupportedVideoError()

    video_id = uuid.uuid4().hex[:12]
    video_filename = f"{video_id}.{ext}"
    video_path = os.path.join(VIDEOS_DIR, video_filename)
    audio_filename = f"{video_id}.mp3"
    audio_path = os.path.join(VIDEOS_DIR, audio_filename)
    analysis_saved = False

    try:
        await _save_upload(file, video_path)

        await run_in_threadpool(extract_audio, video_path, audio_path)
        audio_db_items = await run_in_threadpool(
            process_audio,
            audio_path,
            video_id,
            title,
            video_filename,
            original_filename,
        )

        scenes, video_db_items = await run_in_threadpool(
            analyze_and_extract_video,
            video_path,
            SNAPSHOTS_DIR,
            video_id,
            title,
            video_filename,
            original_filename,
        )

        all_db_items = video_db_items + audio_db_items
        if not all_db_items:
            raise AnalysisEmptyError()

        # Extract snapshots for all indexed timestamps to prevent broken search thumbnails.
        all_timestamps = [int(round(item.start_time)) for item in all_db_items]
        await run_in_threadpool(
            extract_snapshots_for_timestamps,
            video_path,
            all_timestamps,
            SNAPSHOTS_DIR,
            video_id,
        )

        await run_in_threadpool(insert_to_lancedb, all_db_items)
        analysis_saved = True

        return VideoAnalysisResponse(
            video_filename=video_filename,
            original_filename=original_filename,
            title=title,
            total_scenes=len(scenes),
            scenes=scenes,
        )
    except Exception:
        if not analysis_saved:
            _cleanup_failed_upload(video_path, video_id)
        raise
    finally:
        _safe_remove(audio_path)
        try:
            await file.close()
        except Exception as exc:
            logger.warning("Could not close upload file: %r", exc)


async def _save_upload(file: UploadFile, video_path: str) -> None:
    total_bytes = 0
    try:
        destination = open(video_path, "wb")
    except OSError as exc:
        raise FileStorageError(storage_full=exc.errno == errno.ENOSPC) from exc

    try:
        with destination:
            while True:
                try:
                    chunk = await file.read(UPLOAD_CHUNK_SIZE)
                except Exception as exc:
                    raise UploadReadError() from exc

                if not chunk:
                    break

                total_bytes += len(chunk)
                if total_bytes > MAX_UPLOAD_SIZE_BYTES:
                    raise UploadTooLargeError(MAX_UPLOAD_SIZE_MB)

                try:
                    written_bytes = destination.write(chunk)
                except OSError as exc:
                    raise FileStorageError(storage_full=exc.errno == errno.ENOSPC) from exc
                if written_bytes != len(chunk):
                    raise FileStorageError()
    except AppError:
        raise
    except OSError as exc:
        raise FileStorageError(storage_full=exc.errno == errno.ENOSPC) from exc

    if total_bytes == 0:
        raise UploadValidationError("The uploaded video is empty.")


def _cleanup_failed_upload(video_path: str, video_id: str) -> None:
    _safe_remove(video_path)
    try:
        with os.scandir(SNAPSHOTS_DIR) as entries:
            for entry in entries:
                if entry.is_file() and entry.name.startswith(f"{video_id}_"):
                    _safe_remove(entry.path)
    except OSError as exc:
        logger.warning("Could not clean snapshots for video %s: %r", video_id, exc)


def _safe_remove(path: str) -> None:
    try:
        if os.path.exists(path):
            os.remove(path)
    except OSError as exc:
        logger.warning("Could not remove temporary file %s: %r", path, exc)
