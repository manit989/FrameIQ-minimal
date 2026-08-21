import os
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from fastapi import FastAPI, Form
from fastapi.testclient import TestClient

from src.api.error_handlers import register_error_handlers
from src.errors import (
    GeminiServiceError,
    AudioExtractionError,
    MediaToolUnavailableError,
    SnapshotExtractionError,
    database_error,
    gemini_error,
    groq_error,
)


class ErrorHandlerTests(unittest.TestCase):
    def setUp(self) -> None:
        app = FastAPI()
        register_error_handlers(app)

        @app.get("/gemini")
        def gemini_failure():
            raise GeminiServiceError(
                code="GEMINI_UNAVAILABLE",
                message="Gemini is temporarily unavailable.",
                status_code=503,
                retryable=True,
            )

        @app.get("/snapshot")
        def snapshot_failure():
            raise SnapshotExtractionError()

        @app.get("/unexpected")
        def unexpected_failure():
            raise RuntimeError("sensitive internal detail")

        @app.post("/validated")
        def validated(title: str = Form(...)):
            return {"title": title}

        self.client = TestClient(app, raise_server_exceptions=False)

    def test_custom_gemini_error_has_stable_envelope(self) -> None:
        response = self.client.get("/gemini")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["error"]["code"], "GEMINI_UNAVAILABLE")
        self.assertTrue(response.json()["error"]["retryable"])
        self.assertEqual(
            response.json()["error"]["request_id"],
            response.headers["X-Request-ID"],
        )

    def test_distinct_500_error_does_not_leak_internal_details(self) -> None:
        snapshot_response = self.client.get("/snapshot")
        unexpected_response = self.client.get("/unexpected")

        self.assertEqual(snapshot_response.status_code, 500)
        self.assertEqual(
            snapshot_response.json()["error"]["code"],
            "SNAPSHOT_EXTRACTION_FAILED",
        )
        self.assertEqual(unexpected_response.status_code, 500)
        self.assertEqual(unexpected_response.json()["error"]["code"], "INTERNAL_ERROR")
        self.assertNotIn("sensitive internal detail", unexpected_response.text)

    def test_request_validation_uses_same_error_contract(self) -> None:
        response = self.client.post("/validated")

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["code"], "REQUEST_VALIDATION_ERROR")
        self.assertIsInstance(response.json()["error"]["details"], list)


class ProviderMappingTests(unittest.TestCase):
    def test_gemini_rate_limit_is_429(self) -> None:
        upstream = type("ProviderError", (Exception,), {"code": 429})()
        error = gemini_error(upstream, "video analysis")

        self.assertEqual(error.status_code, 429)
        self.assertEqual(error.code, "GEMINI_RATE_LIMITED")
        self.assertTrue(error.retryable)

    def test_groq_bad_media_is_422(self) -> None:
        upstream = type("ProviderError", (Exception,), {"status_code": 400})()
        error = groq_error(upstream)

        self.assertEqual(error.status_code, 422)
        self.assertEqual(error.code, "GROQ_AUDIO_REJECTED")

    def test_database_write_failure_is_503(self) -> None:
        error = database_error("write", OSError("disk unavailable"))

        self.assertEqual(error.status_code, 503)
        self.assertEqual(error.code, "DATABASE_WRITE_FAILED")


class MediaBoundaryTests(unittest.TestCase):
    def test_missing_ffmpeg_is_503(self) -> None:
        from src.ingest import aud

        with (
            tempfile.TemporaryDirectory() as temp_dir,
            patch.object(aud.subprocess, "run", side_effect=FileNotFoundError()),
        ):
            with self.assertRaises(MediaToolUnavailableError) as raised:
                aud.extract_audio("video.mp4", os.path.join(temp_dir, "audio.mp3"))

        self.assertEqual(raised.exception.status_code, 503)
        self.assertEqual(raised.exception.code, "FFMPEG_UNAVAILABLE")

    def test_ffmpeg_rejected_media_is_422(self) -> None:
        from src.ingest import aud

        failure = subprocess.CalledProcessError(1, "ffmpeg", stderr=b"invalid media")
        with (
            tempfile.TemporaryDirectory() as temp_dir,
            patch.object(aud.subprocess, "run", side_effect=failure),
        ):
            with self.assertRaises(AudioExtractionError) as raised:
                aud.extract_audio("video.mp4", os.path.join(temp_dir, "audio.mp3"))

        self.assertEqual(raised.exception.status_code, 422)
        self.assertEqual(raised.exception.code, "AUDIO_EXTRACTION_FAILED")


class AnalyzeEndpointErrorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        from src.api import main

        cls.main = main
        cls.client = TestClient(main.app, raise_server_exceptions=False)

    def test_unsupported_file_has_415_code(self) -> None:
        response = self.client.post(
            "/api/analyze",
            data={"title": "Not a video"},
            files={"file": ("notes.txt", b"plain text", "text/plain")},
        )

        self.assertEqual(response.status_code, 415)
        self.assertEqual(response.json()["error"]["code"], "UNSUPPORTED_VIDEO_TYPE")

    def test_upload_size_limit_has_413_code_and_cleans_partial_file(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            with (
                patch.object(self.main, "VIDEOS_DIR", temp_dir),
                patch.object(self.main, "SNAPSHOTS_DIR", temp_dir),
                patch.object(self.main, "MAX_UPLOAD_SIZE_BYTES", 4),
            ):
                response = self.client.post(
                    "/api/analyze",
                    data={"title": "Too large"},
                    files={"file": ("large.mp4", b"12345", "video/mp4")},
                )

            self.assertEqual(response.status_code, 413)
            self.assertEqual(response.json()["error"]["code"], "UPLOAD_TOO_LARGE")
            self.assertEqual(os.listdir(temp_dir), [])

    def test_empty_upload_has_400_code(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            with (
                patch.object(self.main, "VIDEOS_DIR", temp_dir),
                patch.object(self.main, "SNAPSHOTS_DIR", temp_dir),
            ):
                response = self.client.post(
                    "/api/analyze",
                    data={"title": "Empty"},
                    files={"file": ("empty.mp4", b"", "video/mp4")},
                )

            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json()["error"]["code"], "INVALID_UPLOAD")
            self.assertEqual(os.listdir(temp_dir), [])

    def test_gemini_failure_is_distinct_and_cleans_local_files(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            with (
                patch.object(self.main, "VIDEOS_DIR", temp_dir),
                patch.object(self.main, "SNAPSHOTS_DIR", temp_dir),
                patch.object(self.main, "extract_audio"),
                patch.object(self.main, "process_audio", return_value=[]),
                patch.object(
                    self.main,
                    "analyze_and_extract_video",
                    side_effect=GeminiServiceError(
                        code="GEMINI_UNAVAILABLE",
                        message="Gemini is temporarily unavailable.",
                        status_code=503,
                        retryable=True,
                    ),
                ),
            ):
                response = self.client.post(
                    "/api/analyze",
                    data={"title": "Example title"},
                    files={"file": ("example.mp4", b"video bytes", "video/mp4")},
                )

            self.assertEqual(response.status_code, 503)
            self.assertEqual(response.json()["error"]["code"], "GEMINI_UNAVAILABLE")
            self.assertEqual(os.listdir(temp_dir), [])

    def test_database_read_failure_is_not_an_empty_library(self) -> None:
        with patch.object(
            self.main,
            "get_video_metadata_items",
            side_effect=database_error("read", OSError("database offline")),
        ):
            response = self.client.get("/api/videos")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["error"]["code"], "DATABASE_READ_FAILED")


if __name__ == "__main__":
    unittest.main()
