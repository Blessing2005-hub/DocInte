from typing import Set

from sqlalchemy.orm import Session

from app.database import (
    Document,
    DocumentPermission,
    DocumentVersion,
    SharedDocument,
    User,
)


def record_initial_version(db: Session, document: Document, editor_id: str) -> None:
    """Anchor a brand-new document's history with version 1."""
    db.add(
        DocumentVersion(
            document_id=document.id,
            version_number=1,
            storage_name=document.storage_name,
            file_path=document.file_path,
            file_size=document.file_size,
            editor_id=editor_id,
            note="Original upload",
        )
    )


def _people_with_access(db: Session, document: Document) -> Set[str]:
    """Everyone who should hear about an edit. Library documents notify nobody."""
    ids: Set[str] = set()
    if document.upload_type == "private":
        ids.add(document.uploader_id)
        for (uid,) in db.query(DocumentPermission.user_id).filter(
            DocumentPermission.document_id == document.id
        ):
            ids.add(uid)
    elif document.upload_type == "sent":
        ids.add(document.uploader_id)
        for (uid,) in db.query(SharedDocument.receiver_id).filter(
            SharedDocument.document_id == document.id,
            SharedDocument.kind == "share",
        ):
            ids.add(uid)
    return ids


def notify_of_edit(db: Session, document: Document, editor: User, message: str) -> None:
    """
    Drop an "edit" notice in the inbox of everyone else with access to a
    private or sent document. The caller commits.
    """
    for uid in _people_with_access(db, document) - {editor.id}:
        db.add(
            SharedDocument(
                document_id=document.id,
                sender_id=editor.id,
                receiver_id=uid,
                message=message,
                kind="edit",
            )
        )
