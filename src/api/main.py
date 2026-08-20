import os
import uuid
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.ingest.vid2 import analyze_and_extract_video, extract_snapshots_for_timestamps
from src.ingest.aud import extract_audio, process_audio
from src.ingest.pipeline import insert_to_lancedb
from src.models.models import VideoAnalysisResponse, SearchResultItem, SearchResponse
from src.ingest.embedder import get_embedding
from src.ingest.pipeline import get_or_create_table

app = FastAPI(title="FrameIQ API")

VIDEOS_DIR = "data/videos"
SNAPSHOTS_DIR = "data/snapshots"
os.makedirs(VIDEOS_DIR, exist_ok=True)
os.makedirs(SNAPSHOTS_DIR, exist_ok=True)

app.mount("/snapshots", StaticFiles(directory=SNAPSHOTS_DIR), name="snapshots")
app.mount("/videos", StaticFiles(directory=VIDEOS_DIR), name="videos")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok", "service": "FrameIQ API"}

@app.get("/api/videos")
def list_videos():
    """Return all distinct analyzed videos with a representative thumbnail and scene count."""
    try:
        table = get_or_create_table()
        rows = table.to_arrow().to_pylist()
    except Exception:
        return {"videos": []}

    # Group rows by video_id, pick the earliest scene as representative
    grouped: dict[str, list] = {}
    for row in rows:
        vid = row["video_id"]
        if vid == "init":
            continue
        grouped.setdefault(vid, []).append(row)

    videos = []
    for vid, scenes in grouped.items():
        scenes.sort(key=lambda r: r["start_time"])
        first = scenes[0]
        last = scenes[-1]
        start_sec = int(round(first["start_time"]))
        total_duration = last["end_time"]
        mins = int(total_duration // 60)
        secs = int(total_duration % 60)

        videos.append({
            "video_id": vid,
            "video_filename": first.get("video_filename", f"{vid}.mp4"),
            "title": first["title"],
            "thumbnail_url": f"/snapshots/{vid}_{start_sec}s.jpg",
            "scene_count": len(scenes),
            "duration": f"{mins}:{secs:02d}",
        })

    return {"videos": videos}

@app.get("/search", response_model=SearchResponse)
def get_videos(query: str, limit: int = 10):
    query_vector = get_embedding(query)
    table = get_or_create_table()
    raw_results = table.search(query_vector).limit(limit).to_list()

    results = []
    for row in raw_results:
        # Use int(round(...)) to prevent decimal mismatches on frame snapshots
        start_sec = int(round(row["start_time"]))
        
        results.append(SearchResultItem(
            video_id=row["video_id"],
            # Retrieve exact extension stored in LanceDB, fallback to .mp4 for legacy rows
            video_filename=row.get("video_filename", f"{row['video_id']}.mp4"),
            title=row["title"],
            start_time=row["start_time"],
            end_time=row["end_time"],
            text=row.get("text", ""),
            thumbnail_url=f"/snapshots/{row['video_id']}_{start_sec}s.jpg",
            similarity_score=1 - row.get("_distance", 0),
        ))

    return SearchResponse(query=query, count=len(results), results=results)

@app.post("/api/analyze", response_model=VideoAnalysisResponse)
async def analyze_video(file: UploadFile):
    # Validate that an actual video was uploaded
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded.")

    # Generate a UUID-based video_id and preserve the original extension (.webm, .mp4, etc.)
    ext = file.filename.rsplit('.', 1)[-1] if '.' in file.filename else "mp4"
    video_id = uuid.uuid4().hex[:12]
    video_filename = f"{video_id}.{ext}"
    video_path = os.path.join(VIDEOS_DIR, video_filename)

    # Save uploaded file to disk
    contents = await file.read()
    with open(video_path, "wb") as f:
        f.write(contents)

    audio_filename = f"{video_id}.mp3"
    audio_path = os.path.join(VIDEOS_DIR, audio_filename)
    title = file.filename  # Use original filename as the title

    extract_audio(video_path, audio_path)

    # Process audio segments
    audio_db_items = process_audio(audio_path, video_id, title, video_filename)

    # Analyze video scenes
    scenes, video_db_items = analyze_and_extract_video(
        video_path, SNAPSHOTS_DIR, video_id, title, video_filename
    )

    all_db_items = video_db_items + audio_db_items

    # Extract snapshots for ALL indexed timestamps (video + audio) to prevent 404s on search results
    all_timestamps = [int(round(item.start_time)) for item in all_db_items]
    extract_snapshots_for_timestamps(video_path, all_timestamps, SNAPSHOTS_DIR, video_id)

    insert_to_lancedb(all_db_items)

    return VideoAnalysisResponse(
        video_filename=video_filename,
        total_scenes=len(scenes),
        scenes=scenes,
    )