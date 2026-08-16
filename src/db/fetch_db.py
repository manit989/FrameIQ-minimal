import lancedb
from models.models import Items

db_path = "../../data/lancedb_storage"
db = lancedb.connect(db_path)

vid : Items = Items(vector=[],video_id="",title="",start_time=0,end_time=0)

table_name = "video_scenes"
table = db.create_table(table_name, data=[vid.model_dump()], mode="overwrite")

def insertVideo(Items):
    table.merge_insert(Items)

vid : Items = Items(vector=[],video_id="",title="",start_time=0,end_time=0)
insertVideo(vid.model_dump())
