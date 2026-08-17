import os
from dotenv import load_dotenv
from google import genai
from scripts.getBackend import get_optimal_backend


load_dotenv()
# Determine backend once at startup
_backend = get_optimal_backend()

# Client initialize karlo agar CPU hai
client = None
if _backend not in ("cuda", "apple_silicon"):
  print(
      "💻 Plain CPU detected. Using Google hosted embeddings (no local"
      " sentence-transformers required)."
  )
  client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
else:
  print(f"🚀 Local hardware detected ({_backend}). Using local embeddings.")


def get_embedding(text: str) -> list[float]:
  if _backend in ("cuda", "apple_silicon"):
    # Lazy import: Sirf tab import aur load hoga jab GPU/Mac pe run hoga
    from sentence_transformers import SentenceTransformer

    if not hasattr(get_embedding, "_local_model"):
      get_embedding._local_model = SentenceTransformer("all-MiniLM-L6-v2")
    return get_embedding._local_model.encode(text).tolist()
  else:
    # CPU-only machine (Person 2) ke liye hosted API
    response = client.models.embed_content(
        model="text-embedding-004",
        contents=text,
    )
    return response.embedding.values