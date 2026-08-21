import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from src.api import main
from src.errors import database_error
from src.ingest import pipeline


def scene_row(
    video_id: str,
    title: str,
    start_time: float,
    end_time: float,
    *,
    video_filename: str | None = None,
    original_filename: str | None = None,
) -> dict:
    row = {
        "video_id": video_id,
        "title": title,
        "start_time": start_time,
        "end_time": end_time,
        "text": f"Scene from {title}",
    }
    if video_filename is not None:
        row["video_filename"] = video_filename
    if original_filename is not None:
        row["original_filename"] = original_filename
    return row


class TitleSearchEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(main.app, raise_server_exceptions=False)

    def test_title_search_is_case_insensitive_ranked_and_deduplicated(self) -> None:
        rows = [
            scene_row("init", "init", 0, 0),
            scene_row("contains", "My Holiday Album", 5, 15),
            scene_row("prefix", "Holiday in Goa", 0, 20),
            scene_row(
                "exact",
                "HOLIDAY",
                12,
                65,
                video_filename="exact.webm",
                original_filename="camera-upload.webm",
            ),
            scene_row(
                "exact",
                "HOLIDAY",
                2,
                10,
                video_filename="exact.webm",
                original_filename="camera-upload.webm",
            ),
            scene_row("other", "Cooking Tutorial", 0, 30),
        ]

        with (
            patch.object(main, "get_video_metadata_items", return_value=rows),
            patch.object(main, "get_embedding", side_effect=AssertionError("AI search was called")),
            patch.object(main, "search_items", side_effect=AssertionError("Vector search was called")),
        ):
            response = self.client.get(
                "/api/videos/search",
                params={"query": "  holiday  ", "limit": 10},
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["query"], "holiday")
        self.assertEqual(body["count"], 3)
        self.assertEqual(
            [result["video_id"] for result in body["results"]],
            ["exact", "prefix", "contains"],
        )
        exact = body["results"][0]
        self.assertEqual(exact["scene_count"], 2)
        self.assertEqual(exact["thumbnail_url"], "/snapshots/exact_2s.jpg")
        self.assertEqual(exact["duration"], "1:05")
        self.assertEqual(exact["video_filename"], "exact.webm")
        self.assertEqual(exact["original_filename"], "camera-upload.webm")

    def test_title_search_limit_applies_to_distinct_videos(self) -> None:
        rows = [
            scene_row("one", "Trip One", 0, 10),
            scene_row("one", "Trip One", 10, 20),
            scene_row("two", "Trip Two", 0, 15),
            scene_row("three", "A Trip Three", 0, 30),
        ]

        with patch.object(main, "get_video_metadata_items", return_value=rows):
            response = self.client.get(
                "/api/videos/search",
                params={"query": "trip", "limit": 2},
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["count"], 2)
        self.assertEqual(
            [result["video_id"] for result in body["results"]],
            ["one", "two"],
        )

    def test_title_search_returns_empty_results_for_no_match(self) -> None:
        with patch.object(
            main,
            "get_video_metadata_items",
            return_value=[scene_row("video", "Cooking Tutorial", 0, 30)],
        ):
            response = self.client.get(
                "/api/videos/search",
                params={"query": "wildlife"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "query": "wildlife",
            "count": 0,
            "results": [],
        })

    def test_same_title_on_different_videos_returns_both(self) -> None:
        rows = [
            scene_row("video-b", "Shared Title", 0, 10),
            scene_row("video-a", "Shared Title", 0, 20),
        ]

        with patch.object(main, "get_video_metadata_items", return_value=rows):
            response = self.client.get(
                "/api/videos/search",
                params={"query": "shared title"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [result["video_id"] for result in response.json()["results"]],
            ["video-a", "video-b"],
        )

    def test_title_search_treats_punctuation_as_literal_text(self) -> None:
        rows = [scene_row("special", "Budget 100%_It's Ready!", 0, 10)]

        for query in ("100%_", "it's", "ready!"):
            with self.subTest(query=query), patch.object(
                main,
                "get_video_metadata_items",
                return_value=rows,
            ):
                response = self.client.get(
                    "/api/videos/search",
                    params={"query": query},
                )

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["count"], 1)

    def test_title_search_rejects_whitespace_only_query(self) -> None:
        response = self.client.get(
            "/api/videos/search",
            params={"query": "   "},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "INVALID_SEARCH_QUERY")

    def test_title_search_validates_limit(self) -> None:
        response = self.client.get(
            "/api/videos/search",
            params={"query": "trip", "limit": 0},
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["code"], "REQUEST_VALIDATION_ERROR")

        response = self.client.get(
            "/api/videos/search",
            params={"query": "trip", "limit": 101},
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["code"], "REQUEST_VALIDATION_ERROR")

    def test_title_search_validates_missing_and_overlong_queries(self) -> None:
        missing = self.client.get("/api/videos/search")
        overlong = self.client.get(
            "/api/videos/search",
            params={"query": "x" * 501},
        )

        self.assertEqual(missing.status_code, 422)
        self.assertEqual(missing.json()["error"]["code"], "REQUEST_VALIDATION_ERROR")
        self.assertEqual(overlong.status_code, 422)
        self.assertEqual(overlong.json()["error"]["code"], "REQUEST_VALIDATION_ERROR")

    def test_title_search_uses_legacy_filename_fallbacks(self) -> None:
        with patch.object(
            main,
            "get_video_metadata_items",
            return_value=[scene_row("legacy", "Legacy Clip", 0, 10)],
        ):
            response = self.client.get(
                "/api/videos/search",
                params={"query": "legacy"},
            )

        self.assertEqual(response.status_code, 200)
        result = response.json()["results"][0]
        self.assertEqual(result["video_filename"], "legacy.mp4")
        self.assertEqual(result["original_filename"], "Legacy Clip")

    def test_title_search_exposes_database_read_failure(self) -> None:
        with patch.object(
            main,
            "get_video_metadata_items",
            side_effect=database_error("read", OSError("database offline")),
        ):
            response = self.client.get(
                "/api/videos/search",
                params={"query": "trip"},
            )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["error"]["code"], "DATABASE_READ_FAILED")

    def test_title_search_reports_malformed_database_rows(self) -> None:
        with patch.object(main, "get_video_metadata_items", return_value=[{"video_id": "broken"}]):
            response = self.client.get(
                "/api/videos/search",
                params={"query": "trip"},
            )

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json()["error"]["code"], "DATABASE_DATA_INVALID")


class SemanticSearchRegressionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(main.app, raise_server_exceptions=False)

    def test_semantic_search_still_uses_embeddings_and_vector_results(self) -> None:
        vector_result = {
            "video_id": "semantic-video",
            "video_filename": "semantic-video.mp4",
            "title": "Unrelated title",
            "start_time": 4.4,
            "end_time": 9.0,
            "text": "A person cooking pasta",
            "_distance": 0.25,
        }

        with (
            patch.object(main, "get_embedding", return_value=[0.1, 0.2]) as embedding,
            patch.object(main, "search_items", return_value=[vector_result]) as vector_search,
        ):
            response = self.client.get(
                "/search",
                params={"query": "person making dinner", "limit": 5},
            )

        self.assertEqual(response.status_code, 200)
        embedding.assert_called_once_with("person making dinner")
        vector_search.assert_called_once_with([0.1, 0.2], 5)
        result = response.json()["results"][0]
        self.assertEqual(result["video_id"], "semantic-video")
        self.assertEqual(result["thumbnail_url"], "/snapshots/semantic-video_4s.jpg")
        self.assertAlmostEqual(result["similarity_score"], 0.75)


class VideoMetadataRegressionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(main.app, raise_server_exceptions=False)

    def test_metadata_scan_does_not_load_embedding_vectors(self) -> None:
        table = MagicMock()
        query = MagicMock()
        table.search.return_value = query
        query.select.return_value = query
        query.to_list.return_value = [{"video_id": "video"}]

        with patch.object(pipeline, "get_or_create_table", return_value=table):
            rows = pipeline.get_video_metadata_items()

        self.assertEqual(rows, [{"video_id": "video"}])
        table.search.assert_called_once_with()
        query.select.assert_called_once_with(pipeline.VIDEO_METADATA_COLUMNS)
        query.to_list.assert_called_once_with()

    def test_video_library_response_still_uses_distinct_video_shape(self) -> None:
        rows = [
            scene_row(
                "library-video",
                "Library Video",
                0,
                10,
                video_filename="library.mov",
                original_filename="original.mov",
            ),
            scene_row("library-video", "Library Video", 10, 70),
        ]

        with patch.object(main, "get_video_metadata_items", return_value=rows):
            response = self.client.get("/api/videos")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "videos": [{
                "video_id": "library-video",
                "video_filename": "library.mov",
                "original_filename": "original.mov",
                "title": "Library Video",
                "thumbnail_url": "/snapshots/library-video_0s.jpg",
                "scene_count": 2,
                "duration": "1:10",
            }],
        })


if __name__ == "__main__":
    unittest.main()
