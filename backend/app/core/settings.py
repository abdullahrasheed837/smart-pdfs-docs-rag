# backend/app/core/settings.py
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    OPENAI_API_KEY: str
    # CHAT_MODEL: str = "gpt-3.5-turbo"
    CHAT_MODEL: str = "gpt-4o-mini"
    EMBEDDING_MODEL: str = "text-embedding-3-large"

    PINECONE_API_KEY: str
    PINECONE_INDEX: str
    PINECONE_CLOUD: str = "aws"
    PINECONE_REGION: str = "us-east-1"
    PINECONE_NAMESPACE: str = "default"

    # Frontend runs on port 3002 according to vite.config.ts
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3002",
        "http://127.0.0.1:3002",
        "http://localhost:5173",  # Keep for flexibility
        "http://127.0.0.1:5173",
    ]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
