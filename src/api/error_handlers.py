from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError, ResponseValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.errors import AppError

logger = logging.getLogger(__name__)


def register_error_handlers(app: FastAPI) -> None:
    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        request_id = uuid.uuid4().hex[:12]
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        request_id = _request_id(request)
        _log_app_error(exc, request_id)
        return _error_response(
            status_code=exc.status_code,
            code=exc.code,
            message=exc.message,
            retryable=exc.retryable,
            request_id=request_id,
            details=exc.details,
        )

    @app.exception_handler(RequestValidationError)
    async def handle_request_validation(
        request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        details = [
            {
                "field": ".".join(str(part) for part in error.get("loc", [])),
                "message": error.get("msg", "Invalid value"),
                "type": error.get("type", "validation_error"),
            }
            for error in exc.errors()
        ]
        return _error_response(
            status_code=422,
            code="REQUEST_VALIDATION_ERROR",
            message="The request contains invalid or missing fields.",
            retryable=False,
            request_id=_request_id(request),
            details=details,
        )

    @app.exception_handler(ResponseValidationError)
    async def handle_response_validation(
        request: Request,
        exc: ResponseValidationError,
    ) -> JSONResponse:
        request_id = _request_id(request)
        logger.error(
            "Response validation failed request_id=%s errors=%r",
            request_id,
            exc.errors(),
        )
        return _error_response(
            status_code=500,
            code="RESPONSE_VALIDATION_ERROR",
            message="The server produced an invalid response.",
            retryable=False,
            request_id=request_id,
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(
        request: Request,
        exc: StarletteHTTPException,
    ) -> JSONResponse:
        message = exc.detail if isinstance(exc.detail, str) else "The request failed."
        return _error_response(
            status_code=exc.status_code,
            code=f"HTTP_{exc.status_code}",
            message=message,
            retryable=exc.status_code >= 500,
            request_id=_request_id(request),
            headers=exc.headers,
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        request_id = _request_id(request)
        logger.error(
            "Unhandled API error request_id=%s",
            request_id,
            exc_info=(type(exc), exc, exc.__traceback__),
        )
        return _error_response(
            status_code=500,
            code="INTERNAL_ERROR",
            message="An unexpected server error occurred.",
            retryable=False,
            request_id=request_id,
        )


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", uuid.uuid4().hex[:12])


def _log_app_error(exc: AppError, request_id: str) -> None:
    log_message = "API error code=%s status=%s request_id=%s"
    cause = exc.__cause__
    if exc.status_code >= 500 and cause is not None:
        logger.error(
            log_message,
            exc.code,
            exc.status_code,
            request_id,
            exc_info=(type(cause), cause, cause.__traceback__),
        )
    elif exc.status_code >= 500:
        logger.error(log_message, exc.code, exc.status_code, request_id)
    else:
        logger.warning(log_message, exc.code, exc.status_code, request_id)


def _error_response(
    *,
    status_code: int,
    code: str,
    message: str,
    retryable: bool,
    request_id: str,
    details: Any | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    error: dict[str, Any] = {
        "code": code,
        "message": message,
        "retryable": retryable,
        "request_id": request_id,
    }
    if details is not None:
        error["details"] = details

    response_headers = dict(headers or {})
    response_headers["X-Request-ID"] = request_id
    return JSONResponse(
        status_code=status_code,
        content={"error": error},
        headers=response_headers,
    )
