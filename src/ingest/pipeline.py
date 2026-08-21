import os
import lancedb
from dotenv import load_dotenv
from src.models.models import Items
from scripts.getBackend import get_optimal_backend
from src.errors import AppError, database_error

load_dotenv()

DB_PATH = "data/lancedb_storage"
TABLE_NAME = "video_scenes"
VIDEO_METADATA_COLUMNS = [
    "video_id",
    "video_filename",
    "original_filename",
    "title",
    "start_time",
    "end_time",
]

# Determine embedding dimension based on backend:
#   - GPU / Apple Silicon -> all-MiniLM-L6-v2 -> 384 dims
#   - CPU                 -> text-embedding-004 -> 768 dims
_backend = get_optimal_backend()
VECTOR_DIM = 384 if _backend in ("cuda", "apple_silicon") else 768


def get_or_create_table():
    try:
        db = lancedb.connect(DB_PATH)
    except Exception as exc:
        raise database_error("connect", exc) from exc

    try:
        table_exists = TABLE_NAME in db.table_names()
    except Exception as exc:
        raise database_error("read", exc) from exc

    if table_exists:
        try:
            table = db.open_table(TABLE_NAME)
        except Exception as exc:
            raise database_error("read", exc) from exc

        if "original_filename" not in table.schema.names:
            try:
                # Legacy schema migration fallback
                table.add_columns({"original_filename": "title"})
            except Exception as exc:
                raise database_error("migrate", exc) from exc
        return table

    dummy_item = Items(
        vector=[0.0] * VECTOR_DIM,
        video_id="init",
        video_filename="init.mp4",
        original_filename="init.mp4",
        title="init",
        start_time=0.0,
        end_time=0.0,
        text="",
    )
    try:
        return db.create_table(
            TABLE_NAME,
            data=[dummy_item.model_dump()],
            mode="overwrite",
        )
    except Exception as exc:
        raise database_error("write", exc) from exc


def get_all_items() -> list[dict]:
    try:
        return get_or_create_table().to_arrow().to_pylist()
    except AppError:
        raise
    except Exception as exc:
        raise database_error("read", exc) from exc


def get_video_metadata_items() -> list[dict]:
    """Reads only required metadata columns to streamline listing and title matching."""
    try:
        return (
            get_or_create_table()
            .search()
            .select(VIDEO_METADATA_COLUMNS)
            .to_list()
        )
    except AppError:
        raise
    except Exception as exc:
        raise database_error("read", exc) from exc


def search_items(query_vector: list[float], limit: int) -> list[dict]:
    try:
        return get_or_create_table().search(query_vector).limit(limit).to_list()
    except AppError:
        raise
    except Exception as exc:
        raise database_error("query", exc) from exc


def insert_to_lancedb(items: list[Items]):
    if not items:
        return
    try:
        table = get_or_create_table()
        table.add([item.model_dump() for item in items])
    except AppError:
        raise
    except Exception as exc:
        raise database_error("write", exc) from exc
    print(f"Successfully inserted {len(items)} records into LanceDB.")