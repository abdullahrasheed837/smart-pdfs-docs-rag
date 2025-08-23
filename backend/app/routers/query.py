# backend/app/routers/query.py
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from ..services.embeddings import embed_query
from ..services.vectorstore import query_embeddings
from ..services.llm import stream_chat
from ..core.settings import settings

router = APIRouter()

SYSTEM_PROMPT = (
    "You are a precise RAG assistant. Use ONLY the provided context to answer. "
    "If the answer isn't in the context, say you don't know. Be concise and cite chunk indices like [#]."
)

def build_prompt(question: str, matches: Any) -> str:
    lines: List[str] = ["Context:"]
    for i, m in enumerate(matches.matches):
        meta = m.get("metadata", {}) if hasattr(m, "get") else m.metadata
        txt = meta.get("text") if isinstance(meta, dict) else meta["text"]
        lines.append(f"[{i}] {txt}")
    lines.append("\nQuestion:")
    lines.append(question)
    lines.append("\nInstructions: Answer strictly from the context above. If missing, say you don't know.")
    return "\n".join(lines)

@router.post("/query/stream")
def rag_stream(payload: Dict[str, Any]):
    question = payload.get("question")
    top_k = int(payload.get("top_k", 6))
    dataset = payload.get("dataset")  # optional filter

    if not question or not question.strip():
        raise HTTPException(status_code=400, detail="Question is required.")

    qvec = embed_query(question)
    flt = {"dataset": {"$eq": dataset}} if dataset else None
    search = query_embeddings(qvec, top_k=top_k, filter=flt)

    prompt = build_prompt(question, search)
    generator = stream_chat(prompt, system=SYSTEM_PROMPT)

    def event_stream():
        for token in generator:
            yield token

    return StreamingResponse(event_stream(), media_type="text/event-stream")

@router.post("/query")
def rag_once(payload: Dict[str, Any]):
    """Non-streaming (returns full text)."""
    question = payload.get("question")
    top_k = int(payload.get("top_k", 6))
    dataset = payload.get("dataset")
    if not question:
        raise HTTPException(status_code=400, detail="Question is required.")

    qvec = embed_query(question)
    flt = {"dataset": {"$eq": dataset}} if dataset else None
    search = query_embeddings(qvec, top_k=top_k, filter=flt)
    prompt = build_prompt(question, search)

    # quick, non-streaming completion
    from openai import OpenAI
    client = OpenAI()
    res = client.chat.completions.create(
        model=settings.CHAT_MODEL,
        messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}],
        temperature=0.2,
    )
    return {"answer": res.choices[0].message.content}
