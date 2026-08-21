import logging
import os
import requests
from dotenv import load_dotenv
from src.errors import EmbeddingServiceError, embedding_error

load_dotenv()
logger = logging.getLogger(__name__)

TARGET_DIM = 768
_cached_working_model = None


def _discover_embedding_model(api_key: str) -> tuple[str, str]:
    """Auto-detect an active embedding model supported by your specific API key."""
    global _cached_working_model
    if _cached_working_model:
        return _cached_working_model

    for version in ["v1beta", "v1"]:
        url = (
            f"https://generativelanguage.googleapis.com/{version}/models?key={api_key}"
        )
        try:
            res = requests.get(url, timeout=10)
            if res.status_code == 200:
                models = res.json().get("models", [])
                for m in models:
                    methods = m.get("supportedGenerationMethods", [])
                    m_name = m.get("name", "")
                    if "embedContent" in methods or "embed" in m_name.lower():
                        _cached_working_model = (version, m_name)
                        logger.info(
                            "Auto-detected active embedding model: %s (%s)",
                            m_name,
                            version,
                        )
                        return _cached_working_model
        except Exception as exc:
            logger.warning(
                "Model discovery attempt failed for %s: %s", version, exc
            )

    return ("v1beta", "models/text-embedding-004")


def get_embedding(text: str) -> list[float]:
    clean_text = text.replace("\n", " ").strip() if text else ""
    if not clean_text:
        return [0.0] * TARGET_DIM

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise EmbeddingServiceError(
            code="MISSING_API_KEY",
            message="GEMINI_API_KEY not found in environment (.env).",
            status_code=503,
        )

    api_key = api_key.strip()
    version, raw_model_name = _discover_embedding_model(api_key)
    model_id = raw_model_name.split("/")[-1]

    url = f"https://generativelanguage.googleapis.com/{version}/models/{model_id}:embedContent?key={api_key}"
    payload = {
        "model": f"models/{model_id}",
        "content": {"parts": [{"text": clean_text}]},
    }

    try:
        response = requests.post(url, json=payload, timeout=15)
        data = response.json()

        if response.status_code != 200:
            error_msg = data.get("error", {}).get(
                "message", "Unknown API error"
            )
            logger.error(
                "Gemini API Error (%d): %s", response.status_code, error_msg
            )
            global _cached_working_model
            _cached_working_model = None
            raise EmbeddingServiceError(
                code="API_ERROR",
                message=f"Gemini API Error ({response.status_code}): {error_msg}",
                status_code=503,
            )

        embedding_values = data.get("embedding", {}).get("values", [])
        if not embedding_values:
            raise ValueError("No embedding values returned in API response.")

        if len(embedding_values) > TARGET_DIM:
            return embedding_values[:TARGET_DIM]
        elif len(embedding_values) < TARGET_DIM:
            return embedding_values + [0.0] * (
                TARGET_DIM - len(embedding_values)
            )

        return embedding_values

    except Exception as exc:
        logger.error("Embedding request failed: %s", exc)
        if isinstance(exc, EmbeddingServiceError):
            raise exc
        raise embedding_error(exc) from exc