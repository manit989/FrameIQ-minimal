import logging
from src.ingest.embedder import get_embedding
from src.ingest.pipeline import search_items, get_video_metadata_items
from src.models.models import SearchResponse, SearchResultItem

logger = logging.getLogger(__name__)

SNAPSHOT_BASE_URL = "/snapshots"


def search_vector_database(query: str, limit: int = 10) -> SearchResponse:
    """
    Generates an embedding for the search query and retrieves the top-k 
    matching visual/audio items from LanceDB.
    """
    clean_query = query.strip()
    if not clean_query:
        return SearchResponse(query=query, count=0, results=[])

    query_vector = get_embedding(clean_query)
    raw_results = search_items(query_vector=query_vector, limit=limit)

    results = []
    for item in raw_results:
        # LanceDB returns distance as '_distance'. Convert to a similarity score [0, 1]
        distance = item.get("_distance", 1.0)
        similarity_score = max(0.0, 1.0 - (distance / 2.0))

        start_time_int = int(item.get("start_time", 0))
        video_id = item.get("video_id", "")
        thumbnail_url = f"{SNAPSHOT_BASE_URL}/{video_id}_{start_time_int}s.jpg"

        result_item = SearchResultItem(
            video_id=video_id,
            video_filename=item.get("video_filename", ""),
            title=item.get("title", ""),
            start_time=item.get("start_time", 0.0),
            end_time=item.get("end_time", 0.0),
            text=item.get("text", ""),
            thumbnail_url=thumbnail_url,
            similarity_score=round(similarity_score, 4),
        )
        results.append(result_item)

    return SearchResponse(
        query=query,
        count=len(results),
        results=results,
    )