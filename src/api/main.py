import os
import uuid
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.ingest.vid2 import analyze_and_extract_video
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

@app.get("/search", response_model=SearchResponse)
def get_videos(query: str, limit: int = 10):
    query_vector = get_embedding(query)
    table = get_or_create_table()
    raw_results = table.search(query_vector).limit(limit).to_list()

    results = []
    for row in raw_results:
        results.append(SearchResultItem(
            video_id=row["video_id"],
            title=row["title"],
            start_time=row["start_time"],
            end_time=row["end_time"],
            text=row.get("text", ""),
            thumbnail_url=f"/snapshots/{row['video_id']}_{row['start_time']:.1f}.jpg",
            similarity_score=1 - row.get("_distance", 0),
        ))

    return SearchResponse(query=query, count=len(results), results=results)

@app.post("/api/analyze", response_model=VideoAnalysisResponse)
async def analyze_video(file: UploadFile):
    # Validate that an actual video was uploaded
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded.")

    # Generate a UUID-based video_id and preserve the original extension
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

    audio_db_items = process_audio(audio_path, video_id, title)

    scenes, video_db_items = analyze_and_extract_video(video_path, SNAPSHOTS_DIR, video_id, title)

    all_db_items = video_db_items + audio_db_items
    insert_to_lancedb(all_db_items)

    return VideoAnalysisResponse(
        video_filename=video_filename,
        total_scenes=len(scenes),
        scenes=scenes,
    )
