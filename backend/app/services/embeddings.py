# backend/app/services/embeddings.py
from langchain_openai import OpenAIEmbeddings
from ..core.settings import settings

_embeddings = None

def get_embedding_model():
    global _embeddings
    if _embeddings is None:
        _embeddings = OpenAIEmbeddings(
            model=settings.EMBEDDING_MODEL,
            api_key=settings.OPENAI_API_KEY,
        )
    return _embeddings

def embed_texts(texts: list[str]) -> list[list[float]]:
    emb = get_embedding_model()
    return emb.embed_documents(texts)

def embed_query(text: str) -> list[float]:
    emb = get_embedding_model()
    return emb.embed_query(text)
