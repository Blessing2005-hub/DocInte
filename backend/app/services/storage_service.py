import os
import uuid

from fastapi import HTTPException, UploadFile

from app.config import ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES, UPLOADS_DIR

CHUNK = 1024 * 1024  # read uploads 1 MB at a time

_ZIP = (b"PK\x03\x04", b"PK\x05\x06")
_OLE = (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",)  # old Word/Excel/PowerPoint


def _looks_right(ext: str, head: bytes) -> bool:
    """Does the start of the file match what its extension claims?"""
    if ext == ".pdf":
        return b"%PDF" in head[:1024]
    if ext in (".docx", ".xlsx", ".pptx"):
        return head.startswith(_ZIP)
    if ext in (".doc", ".xls", ".ppt"):
        return head.startswith(_OLE) or head.startswith(_ZIP)
    if ext == ".png":
        return head.startswith(b"\x89PNG\r\n\x1a\n")
    if ext in (".jpg", ".jpeg"):
        return head.startswith(b"\xff\xd8\xff")
    if ext == ".txt":
        return b"\x00" not in head[:4096]  # plain text has no NUL bytes
    return True


def save_upload(file: UploadFile) -> dict:
    original_name = file.filename or "untitled"
    ext = os.path.splitext(original_name)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type '{ext}' is not allowed.")

    # UUID-based storage name - two uploads with the same original
    # filename (from the same or different users) can never collide or
    # overwrite each other on disk. The original filename is preserved
    # separately in the database for display and download.
    storage_name = f"{uuid.uuid4().hex}{ext}"
    storage_path = os.path.join(UPLOADS_DIR, storage_name)

    size = 0
    head = b""
    try:
        with open(storage_path, "wb") as out:
            while True:
                chunk = file.file.read(CHUNK)
                if not chunk:
                    break
                if size == 0:
                    head = chunk[:4096]
                    if not _looks_right(ext, head):
                        raise HTTPException(
                            status_code=400,
                            detail=f"This file doesn't look like a real '{ext}' file, so it was not accepted.",
                        )
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=400,
                        detail=f"File exceeds the {MAX_UPLOAD_BYTES // (1024*1024)} MB upload limit.",
                    )
                out.write(chunk)
        if size == 0:
            raise HTTPException(status_code=400, detail="File is empty.")
    except Exception:
        # Never leave a partial or rejected file behind.
        if os.path.exists(storage_path):
            os.remove(storage_path)
        raise

    return {
        "original_name": original_name,
        "storage_name": storage_name,
        "storage_path": storage_path,
        "file_type": ext,
        "file_size": size,
    }


def delete_file(storage_path: str):
    if os.path.exists(storage_path):
        os.remove(storage_path)
