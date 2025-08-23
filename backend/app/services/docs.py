# backend/app/services/docs.py
from typing import Tuple, List
from pathlib import Path
from langchain.text_splitter import RecursiveCharacterTextSplitter
from pypdf import PdfReader
import docx

def read_pdf(path: Path) -> str:
    reader = PdfReader(str(path))
    texts = []
    for page in reader.pages:
        txt = page.extract_text() or ""
        texts.append(txt)
    return "\n".join(texts)

def read_docx(path: Path) -> str:
    d = docx.Document(str(path))
    return "\n".join(p.text for p in d.paragraphs)

def load_text_from_file(path: Path) -> Tuple[str, str]:
    ext = path.suffix.lower()
    if ext == ".pdf":
        return "pdf", read_pdf(path)
    if ext in (".docx",):
        return "docx", read_docx(path)
    if ext in (".txt", ".md"):
        return "text", path.read_text(encoding="utf-8", errors="ignore")
    raise ValueError(f"Unsupported file type: {ext}")

def split_text(text: str) -> List[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1200,
        chunk_overlap=200,
        length_function=len,
        separators=["\n\n", "\n", " ", ""],
    )
    return splitter.split_text(text)
