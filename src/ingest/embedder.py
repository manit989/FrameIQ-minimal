import os
import logging
from dotenv import load_dotenv
from google import genai
from google.genai import types
from scripts.getBackend import get_optimal_backend
from src.errors import EmbeddingServiceError, embedding_error

load_dotenv()
logger = logging.getLogger(__name__)

# Determine backend once at module startup
_backend = get_optimal_backend()
client = None

if _backend not in ("cuda", "apple_silicon"):
    logger.info("Plain CPU detected. Using Google hosted embeddings.")
else:
    logger.info("Local hardware detected (%s). Using local embeddings.", _backend)


def get_embedding(text: str) -> list[float]:
    global client

    # Sanitize and handle empty text safely
    clean_text = text.replace("\n", " ").strip() if text else ""
    if not clean_text:
        embedding_dim = 384 if _backend in ("cuda", "apple_silicon") else 768
        return [0.0] * embedding_dim

    # Local GPU/Silicon path
    if _backend in ("cuda", "apple_silicon"):
        try:
            from sentence_transformers import SentenceTransformer

            if not hasattr(get_embedding, "_local_model"):
                get_embedding._local_model = SentenceTransformer("all-MiniLM-L6-v2")
            return get_embedding._local_model.encode(clean_text).tolist()
        except Exception as exc:
            raise EmbeddingServiceError(
                code="LOCAL_EMBEDDING_FAILED",
                message="The local embedding model is unavailable.",
                status_code=503,
                retryable=True,
            ) from exc

    # Remote Gemini API path for CPU-only environments
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise EmbeddingServiceError(
            code="EMBEDDING_CONFIGURATION_ERROR",
            message="The embedding service is not configured on the server.",
            status_code=503,
        )

    if client is None:
        try:
            client = genai.Client(api_key=api_key)
        except Exception as exc:
            raise embedding_error(exc) from exc

    try:
        response = client.models.embed_content(
            model="text-embedding-004",
            contents=clean_text,
            config=types.EmbedContentConfig(
                task_type="RETRIEVAL_DOCUMENT"
            ),
        )
    except Exception as exc:
        raise embedding_error(exc) from exc

    if not response.embeddings or response.embeddings[0].values is None:
        raise EmbeddingServiceError(
            code="EMBEDDING_INVALID_RESPONSE",
            message="The embedding service returned an invalid response.",
            status_code=502,
            retryable=True,
        )

    return response.embeddings[0].values