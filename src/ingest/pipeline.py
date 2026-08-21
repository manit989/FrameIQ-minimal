import os
import logging
import threading
import lancedb
from dotenv import load_dotenv
from src.models.models import Items
from src.errors import AppError, database_error

load_dotenv()
logger = logging.getLogger(__name__)

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

VECTOR_DIM = 768
_db_lock = threading.Lock()

def get_or_create_table():
    with _db_lock:
        os.makedirs(DB_PATH, exist_ok=True)
        try:
            db = lancedb.connect(DB_PATH)
        except Exception as exc:
            raise database_error("connect", exc) from exc

        try:
            if TABLE_NAME in db.table_names():
                return db.open_table(TABLE_NAME)
        except Exception as exc:
            logger.warning("Failed checking table existence: %r", exc)

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
    try:
        return get_or_create_table().search().select(VIDEO_METADATA_COLUMNS).to_list()
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
    logger.info("Successfully inserted %d records into LanceDB.", len(items))