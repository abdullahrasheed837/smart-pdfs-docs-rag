# backend/app/services/vectorstore.py
import time
from typing import List, Dict, Any, Iterable
from pinecone import Pinecone, ServerlessSpec
from ..core.settings import settings

DIMENSIONS = 3072  # text-embedding-3-large

def get_pinecone_index():
    pc = Pinecone(api_key=settings.PINECONE_API_KEY)
    indexes = {i["name"] for i in pc.list_indexes()}
    if settings.PINECONE_INDEX not in indexes:
        pc.create_index(
            name=settings.PINECONE_INDEX,
            dimension=DIMENSIONS,
            metric="cosine",
            spec=ServerlessSpec(cloud=settings.PINECONE_CLOUD, region=settings.PINECONE_REGION),
        )
        # wait until ready
        while True:
            desc = pc.describe_index(settings.PINECONE_INDEX)
            if desc.status["ready"]:
                break
            time.sleep(1)
    return pc.Index(settings.PINECONE_INDEX)

def upsert_embeddings(
    items: Iterable[Dict[str, Any]],
    namespace: str = None,
):
    """
    items: [{id, values, metadata}]
    """
    index = get_pinecone_index()
    index.upsert(vectors=list(items), namespace=namespace or settings.PINECONE_NAMESPACE)

def query_embeddings(
    embedding: List[float],
    top_k: int = 6,
    namespace: str = None,
    filter: Dict[str, Any] | None = None,
):
    index = get_pinecone_index()
    res = index.query(
        vector=embedding,
        top_k=top_k,
        include_metadata=True,
        namespace=namespace or settings.PINECONE_NAMESPACE,
        filter=filter,
    )
    return res
