import os
import shutil
import uuid
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import UPLOADS_DIR
from app.database import (
    AccessLog,
    Document,
    DocumentChunk,
    DocumentPermission,
    DocumentVersion,
    User,
    get_db,
)
from app.dependencies import get_current_user
from app.schemas import DocumentOut, VersionOut
from app.services.ai_service import index_document
from app.services.permission_service import (
    can_edit_document,
    can_restore_version,
    can_view_document,
)
from app.services.storage_service import delete_file, save_upload
from app.services.versioning_service import notify_of_edit, record_initial_version

router = APIRouter(prefix="/api/documents", tags=["documents"])


def _to_out(db: Session, user: User, doc: Document) -> DocumentOut:
    return DocumentOut(
        id=doc.id,
        filename=doc.filename,
        file_type=doc.file_type,
        file_size=doc.file_size,
        upload_type=doc.upload_type,
        uploader_name=doc.uploader.full_name if doc.uploader else "Unknown",
        upload_date=doc.upload_date,
        department=doc.department or "",
        version=doc.version or 1,
        updated_date=doc.updated_date,
        updated_by_name=doc.updated_by.full_name if doc.updated_by else None,
        can_edit=can_edit_document(db, user, doc),
        can_restore=can_restore_version(user, doc),
    )


def _get_document_or_404(db: Session, document_id: str) -> Document:
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")
    return document


def _stale_edit_error(db: Session, document: Document) -> HTTPException:
    """The document changed after the person opened it - never overwrite silently."""
    db.refresh(document)
    who = document.updated_by.full_name if document.updated_by else "someone else"
    return HTTPException(
        status_code=409,
        detail=(
            f"This document was updated by {who} (now version {document.version}) after you opened it. "
            "Close this window, download the latest version, and apply your changes to that one."
        ),
    )


def _reindex_safely(db: Session, document: Document) -> None:
    """
    Refresh the AI index for the new text. If indexing fails, the edit has
    already been saved - flag the document as not indexed rather than
    failing the person's save.
    """
    try:
        index_document(db, document)
    except Exception:
        db.rollback()
        db.query(Document).filter(Document.id == document.id).update(
            {"indexed": False}, synchronize_session=False
        )
        db.commit()


def _commit_new_version(
    db: Session,
    user: User,
    document: Document,
    base_version: int,
    saved: dict,
    note: str,
    action: str,
    verb: str,
) -> DocumentOut:
    """
    Make `saved` the document's new current version, atomically.

    The UPDATE only matches if the version is still `base_version`, so if two
    people save at the same moment exactly one wins and the other gets a
    clear conflict instead of silently overwriting.
    """
    new_number = base_version + 1

    updated = (
        db.query(Document)
        .filter(Document.id == document.id, Document.version == base_version)
        .update(
            {
                "storage_name": saved["storage_name"],
                "file_path": saved["storage_path"],
                "file_size": saved["file_size"],
                "version": new_number,
                "updated_date": datetime.utcnow(),
                "updated_by_id": user.id,
                "indexed": False,
            },
            synchronize_session=False,
        )
    )
    if updated != 1:
        db.rollback()
        delete_file(saved["storage_path"])
        raise _stale_edit_error(db, document)

    db.add(
        DocumentVersion(
            document_id=document.id,
            version_number=new_number,
            storage_name=saved["storage_name"],
            file_path=saved["storage_path"],
            file_size=saved["file_size"],
            editor_id=user.id,
            note=note,
        )
    )
    db.add(AccessLog(user_id=user.id, action=action, detail=f"{document.filename} (v{new_number})"))

    message = f"{user.full_name} {verb} version {new_number}"
    if note:
        message += f": {note}"
    notify_of_edit(db, document, user, message)

    db.commit()
    db.refresh(document)

    _reindex_safely(db, document)
    db.refresh(document)
    return _to_out(db, user, document)


@router.post("/upload", response_model=DocumentOut)
def upload_document(
    file: UploadFile = File(...),
    upload_type: str = Form(...),               # library | private
    authorized_usernames: str = Form(""),        # comma-separated, only used for "private"
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if upload_type not in ("library", "private"):
        raise HTTPException(status_code=400, detail="upload_type must be 'library' or 'private'.")

    saved = save_upload(file)

    document = Document(
        filename=saved["original_name"],
        storage_name=saved["storage_name"],
        file_path=saved["storage_path"],
        file_type=saved["file_type"],
        file_size=saved["file_size"],
        upload_type=upload_type,
        uploader_id=user.id,
        department=user.department or "",
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    record_initial_version(db, document, user.id)
    db.commit()

    if upload_type == "private" and authorized_usernames.strip():
        usernames = [u.strip() for u in authorized_usernames.split(",") if u.strip()]
        found_users = db.query(User).filter(User.username.in_(usernames)).all()
        found_usernames = {u.username for u in found_users}

        missing = set(usernames) - found_usernames
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown username(s), not added: {', '.join(sorted(missing))}",
            )

        for u in found_users:
            db.add(DocumentPermission(document_id=document.id, user_id=u.id))
        db.commit()

    # Index immediately - no separate manual step, no stale cache.
    index_document(db, document)

    db.add(AccessLog(user_id=user.id, action="UPLOAD", detail=document.filename))
    db.commit()

    return _to_out(db, user, document)


@router.get("/library", response_model=List[DocumentOut])
def list_library(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    docs = db.query(Document).filter(Document.upload_type == "library").order_by(Document.upload_date.desc()).all()
    return [_to_out(db, user, d) for d in docs]


@router.get("/mine", response_model=List[DocumentOut])
def list_mine(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    docs = db.query(Document).filter(Document.uploader_id == user.id).order_by(Document.upload_date.desc()).all()
    return [_to_out(db, user, d) for d in docs]


@router.get("/search", response_model=List[DocumentOut])
def search_documents(q: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not q.strip():
        return []

    candidates = db.query(Document).filter(Document.filename.ilike(f"%{q}%")).all()
    visible = [d for d in candidates if can_view_document(db, user, d)]
    return [_to_out(db, user, d) for d in visible]


@router.get("/{document_id}/download")
def download_document(document_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    document = _get_document_or_404(db, document_id)

    if not can_view_document(db, user, document):
        raise HTTPException(status_code=403, detail="You don't have access to this document.")

    if not os.path.exists(document.file_path):
        raise HTTPException(status_code=404, detail="File is missing from storage.")

    db.add(AccessLog(user_id=user.id, action="DOWNLOAD", detail=document.filename))
    db.commit()

    return FileResponse(document.file_path, filename=document.filename)


@router.post("/{document_id}/versions", response_model=DocumentOut)
def upload_new_version(
    document_id: str,
    file: UploadFile = File(...),
    base_version: int = Form(...),   # the version the person downloaded and edited
    note: str = Form(""),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = _get_document_or_404(db, document_id)

    # Enforced here on the server - not just by which buttons the UI shows.
    if not can_edit_document(db, user, document):
        raise HTTPException(status_code=403, detail="You don't have permission to edit this document.")

    new_ext = os.path.splitext(file.filename or "")[1].lower()
    if new_ext != (document.file_type or "").lower():
        raise HTTPException(
            status_code=400,
            detail=f"The new version must be a {document.file_type} file, the same type as the original.",
        )

    if base_version != document.version:
        raise _stale_edit_error(db, document)

    saved = save_upload(file)
    return _commit_new_version(
        db, user, document, base_version, saved,
        note=note.strip()[:500], action="EDIT", verb="saved",
    )


@router.get("/{document_id}/versions", response_model=List[VersionOut])
def list_versions(document_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    document = _get_document_or_404(db, document_id)

    if not can_view_document(db, user, document):
        raise HTTPException(status_code=403, detail="You don't have access to this document.")

    versions = (
        db.query(DocumentVersion)
        .filter(DocumentVersion.document_id == document.id)
        .order_by(DocumentVersion.version_number.desc())
        .all()
    )
    return [
        VersionOut(
            version_number=v.version_number,
            editor_name=v.editor.full_name if v.editor else "Unknown",
            note=v.note or "",
            file_size=v.file_size or 0,
            created_date=v.created_date,
            is_current=v.version_number == document.version,
        )
        for v in versions
    ]


@router.get("/{document_id}/versions/{version_number}/download")
def download_version(
    document_id: str,
    version_number: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    document = _get_document_or_404(db, document_id)

    if not can_view_document(db, user, document):
        raise HTTPException(status_code=403, detail="You don't have access to this document.")

    version = (
        db.query(DocumentVersion)
        .filter(DocumentVersion.document_id == document.id, DocumentVersion.version_number == version_number)
        .first()
    )
    if not version:
        raise HTTPException(status_code=404, detail="Version not found.")
    if not os.path.exists(version.file_path):
        raise HTTPException(status_code=404, detail="File for that version is missing from storage.")

    db.add(AccessLog(user_id=user.id, action="DOWNLOAD", detail=f"{document.filename} (v{version_number})"))
    db.commit()

    return FileResponse(version.file_path, filename=document.filename)


@router.post("/{document_id}/versions/{version_number}/restore", response_model=DocumentOut)
def restore_version(
    document_id: str,
    version_number: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Bring an earlier version back as a NEW version, so the history stays intact."""
    document = _get_document_or_404(db, document_id)

    if not can_restore_version(user, document):
        raise HTTPException(
            status_code=403,
            detail="Only the person who uploaded this document, or an admin, can restore an earlier version.",
        )

    if version_number == document.version:
        raise HTTPException(status_code=400, detail="That is already the current version.")

    target = (
        db.query(DocumentVersion)
        .filter(DocumentVersion.document_id == document.id, DocumentVersion.version_number == version_number)
        .first()
    )
    if not target:
        raise HTTPException(status_code=404, detail="Version not found.")
    if not os.path.exists(target.file_path):
        raise HTTPException(status_code=404, detail="File for that version is missing from storage.")

    # Copy rather than point at the old file, so every version owns its file.
    ext = os.path.splitext(target.storage_name)[1]
    storage_name = f"{uuid.uuid4().hex}{ext}"
    storage_path = os.path.join(UPLOADS_DIR, storage_name)
    shutil.copyfile(target.file_path, storage_path)

    saved = {
        "storage_name": storage_name,
        "storage_path": storage_path,
        "file_size": os.path.getsize(storage_path),
    }
    return _commit_new_version(
        db, user, document, document.version, saved,
        note=f"Restored from version {version_number}", action="RESTORE", verb="restored",
    )


@router.delete("/{document_id}")
def delete_document(document_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    document = _get_document_or_404(db, document_id)

    # Ownership (or admin) is enforced here, in the query logic itself -
    # not just by which button the frontend happens to render.
    if document.uploader_id != user.id and user.role != "Admin":
        raise HTTPException(status_code=403, detail="You can only delete documents you uploaded.")

    # Every version owns its own file; remove them all with the document.
    versions = db.query(DocumentVersion).filter(DocumentVersion.document_id == document.id).all()
    for v in versions:
        delete_file(v.file_path)
    delete_file(document.file_path)
    db.query(DocumentVersion).filter(DocumentVersion.document_id == document.id).delete()
    db.query(DocumentChunk).filter(DocumentChunk.document_id == document.id).delete()

    db.query(DocumentPermission).filter(DocumentPermission.document_id == document.id).delete()
    db.delete(document)

    db.add(AccessLog(user_id=user.id, action="DELETE", detail=document.filename))
    db.commit()

    return {"deleted": True}
