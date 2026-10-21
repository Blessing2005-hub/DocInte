"""
Who can open a PRIVATE document, and keeping each of those people's Inbox in step.

A private document is visible to its uploader, administrators, and the people on
its access list. Adding someone puts the document in their Inbox; removing
someone takes it out again.
"""
from typing import List, Tuple

from sqlalchemy.orm import Session

from app.database import Document, DocumentPermission, SharedDocument, User

SHARED_NOTE = "Shared with you privately."


def can_manage_access(user: User, document: Document) -> bool:
    return document.upload_type == "private" and (user.role == "Admin" or document.uploader_id == user.id)


def current_people(db: Session, document: Document) -> List[User]:
    return (
        db.query(User)
        .join(DocumentPermission, DocumentPermission.user_id == User.id)
        .filter(DocumentPermission.document_id == document.id)
        .order_by(User.full_name)
        .all()
    )


def set_private_access(db: Session, document: Document, sender: User, users: List[User]) -> Tuple[List[str], List[str]]:
    """
    Make the access list exactly `users`. Returns (usernames added, usernames removed).
    The caller commits.
    """
    wanted = {u.id: u for u in users if u.id != document.uploader_id}
    existing = {p.user_id: p for p in db.query(DocumentPermission).filter(DocumentPermission.document_id == document.id).all()}

    added, removed = [], []

    for uid, user in wanted.items():
        if uid not in existing:
            db.add(DocumentPermission(document_id=document.id, user_id=uid))
            added.append(user.username)

    for uid, perm in existing.items():
        if uid not in wanted:
            db.delete(perm)
            # They lose the document from their Inbox as well (shares and edit notices).
            db.query(SharedDocument).filter(
                SharedDocument.document_id == document.id, SharedDocument.receiver_id == uid
            ).delete(synchronize_session=False)
            gone = db.query(User).filter(User.id == uid).first()
            removed.append(gone.username if gone else uid)

    # Everyone on the list should find the document in their Inbox.
    for uid in wanted:
        has_row = (
            db.query(SharedDocument.id)
            .filter(
                SharedDocument.document_id == document.id,
                SharedDocument.receiver_id == uid,
                SharedDocument.kind == "share",
            )
            .first()
        )
        if not has_row:
            db.add(SharedDocument(
                document_id=document.id, sender_id=sender.id, receiver_id=uid,
                message=SHARED_NOTE, kind="share",
            ))

    return added, removed
