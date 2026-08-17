import lancedb
from src.models.models import Items

DB_PATH = "data/lancedb_storage"
TABLE_NAME = "video_scenes"

def get_or_create_table():
    db = lancedb.connect(DB_PATH)
    if TABLE_NAME in db.table_names():
        return db.open_table(TABLE_NAME)
    
    # Initialize schema with 384 dimensions (all-MiniLM-L6-v2 outputs 384, NOT 768)
    dummy_item = Items(vector=[0.0] * 384, video_id="init", title="init", start_time=0.0, end_time=0.0, text="")
    return db.create_table(TABLE_NAME, data=[dummy_item.model_dump()], mode="overwrite")

def insert_to_lancedb(items: list[Items]):
    if not items:
        return
    table = get_or_create_table()
    table.add([item.model_dump() for item in items])
    print(f"Successfully inserted {len(items)} records into LanceDB.")