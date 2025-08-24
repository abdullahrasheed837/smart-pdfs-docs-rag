# backend/scripts/create_index.py
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.vectorstore import get_pinecone_index
from app.core.settings import settings

if __name__ == "__main__":
    idx = get_pinecone_index()
    print("Index ready:", settings.PINECONE_INDEX)
