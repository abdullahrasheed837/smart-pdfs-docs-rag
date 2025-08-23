# backend/app/services/llm.py
from typing import Iterable
from openai import OpenAI
from ..core.settings import settings

_client = None

def get_client():
    global _client
    if _client is None:
        _client = OpenAI(api_key=settings.OPENAI_API_KEY)
    return _client

def stream_chat(prompt: str, system: str = "You are a helpful AI assistant.") -> Iterable[str]:
    client = get_client()
    with client.chat.completions.with_streaming_response.create(
        model=settings.CHAT_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
    ) as stream:
        for event in stream:
            if event.type == "content.delta":
                delta = event.delta
                if delta and delta.get("content"):
                    yield delta["content"]
