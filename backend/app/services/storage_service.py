import os
import uuid

from fastapi import HTTPException, UploadFile

from app.config import ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES, UPLOADS_DIR


def save_upload(file: UploadFile) -> dict:
    original_name = file.filename or "untitled"
    ext = os.path.splitext(original_name)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type '{ext}' is not allowed.")

    contents = file.file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds the {MAX_UPLOAD_BYTES // (1024*1024)} MB upload limit.",
        )
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="File is empty.")

    # UUID-based storage name - two uploads with the same original
    # filename (from the same or different users) can never collide or
    # overwrite each other on disk. The original filename is preserved
    # separately in the database for display and download.
    storage_name = f"{uuid.uuid4().hex}{ext}"
    storage_path = os.path.join(UPLOADS_DIR, storage_name)

    with open(storage_path, "wb") as f:
        f.write(contents)

    return {
        "original_name": original_name,
        "storage_name": storage_name,
        "storage_path": storage_path,
        "file_type": ext,
        "file_size": len(contents),
    }


def delete_file(storage_path: str):
    if os.path.exists(storage_path):
        os.remove(storage_path)
