from sqlalchemy.orm import Session

from app.database import Document, DocumentPermission, SharedDocument, User


def can_view_document(db: Session, user: User, document: Document) -> bool:
    """
    The single place that decides whether a user can see a document's
    content - used identically by the download endpoint, the preview
    endpoint, and the AI assistant's retrieval step. This is what closes
    the gap the original had: the AI could previously surface content
    from documents a user had no right to see, because indexing/search
    never checked this at all.
    """
    if user.role == "Admin":
        return True

    if document.uploader_id == user.id:
        return True

    if document.upload_type == "library":
        return True

    if document.upload_type == "private":
        has_permission = (
            db.query(DocumentPermission)
            .filter(
                DocumentPermission.document_id == document.id,
                DocumentPermission.user_id == user.id,
            )
            .first()
        )
        return has_permission is not None

    if document.upload_type == "sent":
        was_receiver = (
            db.query(SharedDocument)
            .filter(
                SharedDocument.document_id == document.id,
                SharedDocument.receiver_id == user.id,
            )
            .first()
        )
        return was_receiver is not None

    return False


def visible_document_ids(db: Session, user: User) -> set:
    """
    Every document ID this user is allowed to see, used to scope the AI
    assistant's retrieval so it only ever searches within documents the
    asking user actually has permission to view.
    """
    if user.role == "Admin":
        return {d.id for d in db.query(Document.id).all()}

    ids = set()

    for (doc_id,) in db.query(Document.id).filter(Document.uploader_id == user.id).all():
        ids.add(doc_id)

    for (doc_id,) in db.query(Document.id).filter(Document.upload_type == "library").all():
        ids.add(doc_id)

    for (doc_id,) in (
        db.query(DocumentPermission.document_id)
        .filter(DocumentPermission.user_id == user.id)
        .all()
    ):
        ids.add(doc_id)

    for (doc_id,) in (
        db.query(SharedDocument.document_id)
        .filter(SharedDocument.receiver_id == user.id)
        .all()
    ):
        ids.add(doc_id)

    return ids


def _same_department(a: str, b: str) -> bool:
    """Both must be set; compared case-insensitively so 'hr' and 'HR' match."""
    a = (a or "").strip().lower()
    b = (b or "").strip().lower()
    return bool(a) and a == b


def can_edit_document(db: Session, user: User, document: Document) -> bool:
    """
    Who may save a new version of a document. Editing never overwrites -
    it adds a version - but this is still the gate for it.

    - Admins and the original uploader can always edit.
    - Library: anyone in the same department as the document.
    - Private: the people the uploader authorized.
    - Sent: the people it was sent to.

    Department deliberately plays no part for private/sent documents: a
    file sent to one person in HR must not become editable by all of HR.
    """
    if user.role == "Admin":
        return True

    if document.uploader_id == user.id:
        return True

    if document.upload_type == "library":
        return _same_department(user.department, document.department)

    if document.upload_type == "private":
        return (
            db.query(DocumentPermission)
            .filter(
                DocumentPermission.document_id == document.id,
                DocumentPermission.user_id == user.id,
            )
            .first()
            is not None
        )

    if document.upload_type == "sent":
        return (
            db.query(SharedDocument)
            .filter(
                SharedDocument.document_id == document.id,
                SharedDocument.receiver_id == user.id,
                SharedDocument.kind == "share",
            )
            .first()
            is not None
        )

    return False


def can_restore_version(user: User, document: Document) -> bool:
    """Rolling back is stricter than editing: only the uploader or an Admin."""
    return user.role == "Admin" or document.uploader_id == user.id
