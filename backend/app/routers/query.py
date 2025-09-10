# backend/app/routers/query.py
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from ..services.embeddings import embed_query
from ..services.vectorstore import query_embeddings
from ..services.llm import stream_chat, stream_chat_with_messages
from ..core.settings import settings

router = APIRouter()

SYSTEM_PROMPT = (
    "You are a precise RAG assistant. Use ONLY the provided context to answer. "
    "If the answer isn't in the context, say you don't know. Be concise and cite chunk indices like [#]."
)

# In-memory chat history store: chat_id -> messages list
# messages: [{"role": "user"|"assistant", "content": str}, ...]
CHAT_HISTORY: Dict[str, List[Dict[str, str]]] = {}
MAX_TURNS = 8  # keep last N user/assistant turns

def build_prompt(question: str, matches: Any) -> str:
    lines: List[str] = ["Context:"]
    if not matches.matches:
        lines.append("No relevant documents found.")
    else:
        for i, m in enumerate(matches.matches):
            meta = m.get("metadata", {}) if hasattr(m, "get") else m.metadata
            txt = meta.get("text") if isinstance(meta, dict) else meta["text"]
            score = getattr(m, 'score', 0.0)
            lines.append(f"[{i}] (score: {score:.3f}) {txt}")
    lines.append("\nQuestion:")
    lines.append(question)
    lines.append("\nInstructions: Answer strictly from the context above. If missing or irrelevant, say you don't know.")
    return "\n".join(lines)


def _get_history(chat_id: str) -> List[Dict[str, str]]:
    return CHAT_HISTORY.setdefault(chat_id, [])


def _capped(history: List[Dict[str, str]]) -> List[Dict[str, str]]:
    # Keep only last MAX_TURNS*2 messages (user+assistant per turn)
    return history[-(MAX_TURNS * 2) :]


@router.post("/query/stream")
def rag_stream(payload: Dict[str, Any]):
    question = payload.get("question")
    top_k = int(payload.get("top_k", 6))
    dataset = payload.get("dataset")  # optional filter
    chat_id = payload.get("chat_id", "default")

    if not question or not question.strip():
        raise HTTPException(status_code=400, detail="Question is required.")

    qvec = embed_query(question)
    flt = {"dataset": {"$eq": dataset}} if dataset else None
    search = query_embeddings(qvec, top_k=top_k, filter=flt)

    prompt = build_prompt(question, search)

    history = _get_history(chat_id)
    messages: List[Dict[str, str]] = (
        [{"role": "system", "content": SYSTEM_PROMPT}]
        + _capped(history)
        + [{"role": "user", "content": prompt}]
    )

    generator = stream_chat_with_messages(messages)

    def event_stream():
        collected: List[str] = []
        try:
            for token in generator:
                collected.append(token)
                yield token
        finally:
            # Persist the turn
            assistant_text = "".join(collected)
            history.append({"role": "user", "content": prompt})
            history.append({"role": "assistant", "content": assistant_text})
            CHAT_HISTORY[chat_id] = _capped(history)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/query")
def rag_once(payload: Dict[str, Any]):
    """Non-streaming (returns full text)."""
    question = payload.get("question")
    top_k = int(payload.get("top_k", 6))
    dataset = payload.get("dataset")
    chat_id = payload.get("chat_id", "default")

    if not question:
        raise HTTPException(status_code=400, detail="Question is required.")

    qvec = embed_query(question)
    flt = {"dataset": {"$eq": dataset}} if dataset else None
    search = query_embeddings(qvec, top_k=top_k, filter=flt)
    prompt = build_prompt(question, search)

    # Use history-based messages
    history = _get_history(chat_id)
    messages: List[Dict[str, str]] = (
        [{"role": "system", "content": SYSTEM_PROMPT}]
        + _capped(history)
        + [{"role": "user", "content": prompt}]
    )

    # quick, non-streaming completion
    from openai import OpenAI

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    res = client.chat.completions.create(
        model=settings.CHAT_MODEL,
        messages=messages,
        temperature=0.2,
    )
    answer = res.choices[0].message.content

    # Persist the turn
    history.append({"role": "user", "content": prompt})
    history.append({"role": "assistant", "content": answer})
    CHAT_HISTORY[chat_id] = _capped(history)

    return {"answer": answer, "chat_id": chat_id}
