from __future__ import annotations

from typing import Any


class AppError(Exception):
    """A safe, structured error that can be returned by the API."""

    def __init__(
        self,
        *,
        code: str,
        message: str,
        status_code: int,
        retryable: bool = False,
        details: Any | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.retryable = retryable
        self.details = details


class UploadValidationError(AppError):
    def __init__(self, message: str = "A valid video upload is required.") -> None:
        super().__init__(
            code="INVALID_UPLOAD",
            message=message,
            status_code=400,
        )


class SearchValidationError(AppError):
    def __init__(self, message: str = "A non-empty search query is required.") -> None:
        super().__init__(
            code="INVALID_SEARCH_QUERY",
            message=message,
            status_code=400,
        )


class UploadReadError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="UPLOAD_READ_FAILED",
            message="The uploaded video could not be read. Please select it again.",
            status_code=400,
        )


class UploadTooLargeError(AppError):
    def __init__(self, max_size_mb: int) -> None:
        super().__init__(
            code="UPLOAD_TOO_LARGE",
            message=f"The video exceeds the {max_size_mb} MB upload limit.",
            status_code=413,
            details={"max_size_mb": max_size_mb},
        )


class UnsupportedVideoError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="UNSUPPORTED_VIDEO_TYPE",
            message="Use an MP4, MOV, AVI, WebM, MKV, or M4V video file.",
            status_code=415,
        )


class FileStorageError(AppError):
    def __init__(self, *, storage_full: bool = False) -> None:
        super().__init__(
            code="STORAGE_FULL" if storage_full else "FILE_STORAGE_FAILED",
            message=(
                "The server does not have enough storage for this upload."
                if storage_full
                else "The server could not save the uploaded video."
            ),
            status_code=507 if storage_full else 500,
            retryable=not storage_full,
        )


class MediaToolUnavailableError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="FFMPEG_UNAVAILABLE",
            message="Video processing is temporarily unavailable on the server.",
            status_code=503,
            retryable=True,
        )


class MediaProcessingTimeoutError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="MEDIA_PROCESSING_TIMEOUT",
            message="Video processing took too long. Try a shorter video.",
            status_code=504,
            retryable=True,
        )


class AudioExtractionError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="AUDIO_EXTRACTION_FAILED",
            message="Audio could not be extracted from this video. Check that the file has a supported audio track.",
            status_code=422,
        )


class AudioFileReadError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="AUDIO_FILE_READ_FAILED",
            message="The extracted audio could not be read by the server.",
            status_code=500,
            retryable=True,
        )


class VideoDecodeError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="VIDEO_DECODE_FAILED",
            message="The video could not be decoded. The file may be damaged or unsupported.",
            status_code=422,
        )


class SnapshotExtractionError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="SNAPSHOT_EXTRACTION_FAILED",
            message="Frame snapshots could not be created for this video.",
            status_code=500,
            retryable=True,
        )


class GeminiServiceError(AppError):
    pass


class GroqServiceError(AppError):
    pass


class EmbeddingServiceError(AppError):
    pass


class InvalidProviderResponseError(AppError):
    pass


class DatabaseError(AppError):
    pass


class DatabaseDataError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="DATABASE_DATA_INVALID",
            message="The video database contains invalid data.",
            status_code=500,
        )


class AnalysisEmptyError(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="ANALYSIS_EMPTY",
            message="The AI services did not return any searchable scenes or audio.",
            status_code=502,
            retryable=True,
        )


def database_error(operation: str, exc: Exception) -> DatabaseError:
    operation_labels = {
        "connect": ("DATABASE_UNAVAILABLE", "The video database is temporarily unavailable."),
        "read": ("DATABASE_READ_FAILED", "Saved videos could not be loaded."),
        "query": ("DATABASE_QUERY_FAILED", "The video database could not complete the search."),
        "write": ("DATABASE_WRITE_FAILED", "The video analysis could not be saved."),
        "migrate": ("DATABASE_MIGRATION_FAILED", "The video database could not be upgraded."),
    }
    code, message = operation_labels.get(
        operation,
        ("DATABASE_ERROR", "The video database operation failed."),
    )
    error = DatabaseError(
        code=code,
        message=message,
        status_code=503,
        retryable=True,
        details={"operation": operation},
    )
    error.__cause__ = exc
    return error


def gemini_error(exc: Exception, operation: str) -> GeminiServiceError:
    return _provider_error(
        error_type=GeminiServiceError,
        prefix="GEMINI",
        service_name="Gemini",
        operation=operation,
        exc=exc,
    )


def groq_error(exc: Exception, operation: str = "transcription") -> GroqServiceError:
    return _provider_error(
        error_type=GroqServiceError,
        prefix="GROQ",
        service_name="Groq transcription",
        operation=operation,
        exc=exc,
    )


def embedding_error(exc: Exception) -> EmbeddingServiceError:
    return _provider_error(
        error_type=EmbeddingServiceError,
        prefix="EMBEDDING",
        service_name="Embedding",
        operation="embedding",
        exc=exc,
    )


def _provider_error(
    *,
    error_type: type[AppError],
    prefix: str,
    service_name: str,
    operation: str,
    exc: Exception,
) -> AppError:
    upstream_status = _upstream_status_code(exc)
    exception_name = type(exc).__name__.lower()
    details = {"service": prefix.lower(), "operation": operation}

    if upstream_status == 429 or "ratelimit" in exception_name:
        error = error_type(
            code=f"{prefix}_RATE_LIMITED",
            message=f"{service_name} is busy right now. Please try again shortly.",
            status_code=429,
            retryable=True,
            details=details,
        )
    elif upstream_status in (408, 504) or "timeout" in exception_name:
        error = error_type(
            code=f"{prefix}_TIMEOUT",
            message=f"{service_name} took too long to respond.",
            status_code=504,
            retryable=True,
            details=details,
        )
    elif upstream_status in (401, 403, 404):
        error = error_type(
            code=f"{prefix}_CONFIGURATION_ERROR",
            message=f"{service_name} is not configured correctly on the server.",
            status_code=503,
            details=details,
        )
    elif upstream_status in (400, 415, 422) and prefix in ("GEMINI", "GROQ"):
        rejected_code = "VIDEO_REJECTED" if prefix == "GEMINI" else "AUDIO_REJECTED"
        error = error_type(
            code=f"{prefix}_{rejected_code}",
            message=f"{service_name} could not process this media file.",
            status_code=422,
            details=details,
        )
    elif (
        upstream_status is None
        and ("connection" in exception_name or "connect" in exception_name)
    ) or (upstream_status is not None and upstream_status >= 500):
        error = error_type(
            code=f"{prefix}_UNAVAILABLE",
            message=f"{service_name} is temporarily unavailable.",
            status_code=503,
            retryable=True,
            details=details,
        )
    else:
        error = error_type(
            code=f"{prefix}_FAILED",
            message=f"{service_name} could not complete the request.",
            status_code=502,
            retryable=True,
            details=details,
        )

    error.__cause__ = exc
    return error


def _upstream_status_code(exc: Exception) -> int | None:
    for attribute in ("status_code", "code"):
        value = getattr(exc, attribute, None)
        if isinstance(value, int) and not isinstance(value, bool):
            return value

    response = getattr(exc, "response", None)
    value = getattr(response, "status_code", None)
    if isinstance(value, int) and not isinstance(value, bool):
        return value
    return None
