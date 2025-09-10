# backend/app/routers/ingest.py
import uuid
import re
from pathlib import Path
from typing import List, Dict, Any
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi import BackgroundTasks
from ..services.docs import load_text_from_file, split_text
from ..services.embeddings import embed_texts
from ..services.vectorstore import upsert_embeddings
from ..core.settings import settings

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

router = APIRouter()

def _background_ingest(file_path: Path, file_id: str, dataset: str | None, original_filename: str | None):
    try:
        kind, text = load_text_from_file(file_path)
        chunks = split_text(text)
        embeddings = embed_texts(chunks)

        items: List[Dict[str, Any]] = []
        for i, vec in enumerate(embeddings):
            items.append({
                "id": f"{file_id}::chunk::{i}",
                "values": vec,
                "metadata": {
                    "file_id": file_id,
                    "chunk_index": i,
                    "source_path": str(file_path.name),
                    "original_filename": original_filename or str(file_path.name),
                    "type": kind,
                    "dataset": dataset or "default",
                    "text": chunks[i],  # full text for better retrieval
                }
            })
        upsert_embeddings(items, namespace=settings.PINECONE_NAMESPACE)
    finally:
        # keep the file on disk for traceability; delete if you prefer
        pass

@router.post("/file")
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    dataset: str | None = Form(default=None),
):
    ext = Path(file.filename).suffix.lower()
    if ext not in [".pdf", ".docx", ".txt", ".md"]:
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, TXT, MD are supported.")
    file_id = str(uuid.uuid4())
    # Sanitize original filename (keep alphanumerics, dash, underscore, dot)
    safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", Path(file.filename).stem)[:80]
    dest = UPLOAD_DIR / f"{file_id}__{safe_name}{ext}"
    with dest.open("wb") as f:
        f.write(await file.read())

    background_tasks.add_task(_background_ingest, dest, file_id, dataset, file.filename)
    return {"status": "queued", "file_id": file_id, "filename": file.filename}
