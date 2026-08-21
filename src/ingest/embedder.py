import os
from dotenv import load_dotenv
from google.genai import types
from google import genai
from scripts.getBackend import get_optimal_backend
from src.errors import EmbeddingServiceError, embedding_error


load_dotenv()
# Determine backend once at startup
_backend = get_optimal_backend()

# Client initialize karlo agar CPU hai
client = None
if _backend not in ("cuda", "apple_silicon"):
  print(
      "Plain CPU detected. Using Google hosted embeddings (no local"
      " sentence-transformers required)."
  )
else:
  print(f"Local hardware detected ({_backend}). Using local embeddings.")


def get_embedding(text: str) -> list[float]:
  global client
  if _backend in ("cuda", "apple_silicon"):
    try:
      # Lazy import: Sirf tab import aur load hoga jab GPU/Mac pe run hoga
      from sentence_transformers import SentenceTransformer

      if not hasattr(get_embedding, "_local_model"):
        get_embedding._local_model = SentenceTransformer("all-MiniLM-L6-v2")
      return get_embedding._local_model.encode(text).tolist()
    except Exception as exc:
      raise EmbeddingServiceError(
          code="LOCAL_EMBEDDING_FAILED",
          message="The local embedding model is unavailable.",
          status_code=503,
          retryable=True,
      ) from exc

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
        model="gemini-embedding-001", # Changed to the stable production endpoint
        contents=text,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_DOCUMENT"
        )
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
