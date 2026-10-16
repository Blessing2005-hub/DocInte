import json
import re

import requests
from sqlalchemy.orm import Session

from app.config import AI_ENABLED, AI_SEARCH_RESULTS, EMBEDDING_MODEL, OLLAMA_HOST, OLLAMA_MODEL
from app.database import Document, DocumentChunk
from app.services.text_extraction_service import create_chunks, extract_text

_embedding_model = None


def _get_model():
    global _embedding_model
    if _embedding_model is None:
        # Imported here, not at the top of the file: importing sentence-transformers
        # pulls in PyTorch, which costs hundreds of MB the moment the server starts.
        from sentence_transformers import SentenceTransformer

        _embedding_model = SentenceTransformer(EMBEDDING_MODEL)
    return _embedding_model


def index_document(db: Session, document: Document):
    """
    Called immediately after a document is uploaded or received - this is
    the fix for the original's biggest AI Assistant complaint. There is
    no separate manual "rebuild index" step and no in-memory cache that
    goes stale; each document is embedded and stored the moment it
    lands, so it's searchable right away.
    """
    if not AI_ENABLED:
        document.indexed = False
        db.commit()
        return

    text = extract_text(document.file_path)
    chunks = create_chunks(text)

    # Clear any previous chunks for this document (covers re-indexing).
    db.query(DocumentChunk).filter(DocumentChunk.document_id == document.id).delete()

    if chunks:
        model = _get_model()
        embeddings = model.encode(chunks)

        for i, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
            db.add(
                DocumentChunk(
                    document_id=document.id,
                    chunk_index=i,
                    text=chunk_text,
                    embedding_json=json.dumps(embedding.tolist()),
                )
            )

    document.indexed = True
    db.commit()


def search_chunks(db: Session, question: str, allowed_document_ids: set, top_k: int = AI_SEARCH_RESULTS):
    """
    Retrieval is scoped to allowed_document_ids before anything else -
    this is what stops the AI assistant from ever answering using a
    document the asking user isn't permitted to see, regardless of how
    semantically relevant that document's content might be.
    """
    if not AI_ENABLED or not allowed_document_ids:
        return []

    rows = (
        db.query(DocumentChunk, Document.filename)
        .join(Document, Document.id == DocumentChunk.document_id)
        .filter(DocumentChunk.document_id.in_(allowed_document_ids))
        .all()
    )

    if not rows:
        return []

    import numpy as np

    model = _get_model()
    question_vec = model.encode([question])[0]

    scored = []
    for chunk, filename in rows:
        chunk_vec = np.array(json.loads(chunk.embedding_json))
        # Cosine similarity
        denom = (np.linalg.norm(question_vec) * np.linalg.norm(chunk_vec)) or 1e-9
        score = float(np.dot(question_vec, chunk_vec) / denom)
        scored.append((score, filename, chunk.text))

    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[:top_k]


CREATOR_NAME = "Blessing Nyashadzashe Chingwangwa"

# Matches questions like "who created this app", "who made you",
# "who developed DocIntel", "who is your creator / developer / author".
_ABOUT_APP = r"(you|your|yourself|this (app|application|system|platform|tool|software|website|site|assistant|ai|bot)|docintel)"
_CREATOR_QUESTION = re.compile(
    # "who created/made/built/developed/designed/programmed ... you / this app / DocIntel"
    r"\bwho\b[^?]{0,40}\b(creat\w*|made|built|build|develop\w*|design\w*|programm?\w*|coded)\b[^?]{0,40}\b" + _ABOUT_APP + r"\b"
    # "who is your creator", "who is the developer of this app"
    r"|\bwho\b[^?]{0,20}\b(creator|developer|author|maker|programmer|builder|owner)\b[^?]{0,30}\b" + _ABOUT_APP + r"\b"
    r"|\b(your|docintel'?s?|this (app|system|platform|tool)'?s?)\s+(creator|developer|author|maker|programmer|builder)\b",
    re.IGNORECASE,
)


def _creator_answer(question: str):
    """Answered directly, before searching any documents: this is a fact about
    the app itself, not something that lives in an uploaded file."""
    if _CREATOR_QUESTION.search(question or ""):
        return f"DocIntel was created by {CREATOR_NAME}."
    return None


def generate_answer(question: str, results: list) -> str:
    about_app = _creator_answer(question)
    if about_app:
        return about_app

    if not AI_ENABLED:
        return "The AI assistant is turned off on this server. Everything else in DocIntel works as normal."

    if not results:
        return (
            "I couldn't find anything relevant in the documents you have access to. "
            "Try rephrasing the question, or check that the document has been uploaded."
        )

    context = "\n\n".join(f"Document: {filename}\n{text}" for _, filename, text in results)

    prompt = f"""You are the DocIntel assistant. Answer the question using ONLY the document \
information provided below. The person asking may have typos or unclear phrasing in their \
question - interpret their intent charitably and answer what they most likely meant to ask. \
If the answer genuinely isn't in the provided information, say so plainly rather than guessing.

Question: {question}

Document information:
{context}

Reply in at most 3 short sentences, or a short bullet list if the answer has several parts. \
Start with the answer itself, with no introduction and no repeating the question. \
End with one short line naming the source document, like: Source: filename.pdf. \
Do not add extra explanations, background or advice unless the person asks for more detail."""

    try:
        response = requests.post(
            f"{OLLAMA_HOST}/api/chat",
            json={
                "model": OLLAMA_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "options": {"temperature": 0.2, "num_predict": 220},
            },
            timeout=60,
        )
        response.raise_for_status()
        return response.json()["message"]["content"]
    except requests.RequestException as exc:
        return (
            f"The AI model isn't reachable right now ({exc}). "
            f"Make sure Ollama is running and the '{OLLAMA_MODEL}' model is pulled."
        )
