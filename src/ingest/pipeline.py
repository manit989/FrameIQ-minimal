import lancedb
from src.models.models import Items
from scripts.getBackend import get_optimal_backend

DB_PATH = "data/lancedb_storage"
TABLE_NAME = "video_scenes"

# Determine embedding dimension based on backend:
#   - GPU/Apple Silicon → all-MiniLM-L6-v2 → 384 dims
#   - CPU               → gemini-embedding-001 → 3072 dims
_backend = get_optimal_backend()
VECTOR_DIM = 384 if _backend in ("cuda", "apple_silicon") else 3072

def get_or_create_table():
    db = lancedb.connect(DB_PATH)
    if TABLE_NAME in db.table_names():
        return db.open_table(TABLE_NAME)
    
    dummy_item = Items(
        vector=[0.0] * VECTOR_DIM,
        video_id="init",
        video_filename="init.mp4",  # Added missing required field
        title="init",
        start_time=0.0,
        end_time=0.0,
        text=""
    )
    return db.create_table(TABLE_NAME, data=[dummy_item.model_dump()], mode="overwrite")

def insert_to_lancedb(items: list[Items]):
    if not items:
        return
    table = get_or_create_table()
    table.add([item.model_dump() for item in items])
    print(f"Successfully inserted {len(items)} records into LanceDB.")