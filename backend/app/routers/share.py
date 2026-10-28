from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database import AccessLog, Document, SavedDocument, SharedDocument, User, get_db
from app.dependencies import get_current_user
from app.schemas import DocumentOut, SharedDocumentOut
from app.services.ai_service import index_document
from app.services.access_service import can_manage_access, set_private_access
from app.services.permission_service import can_edit_document, can_restore_version
from app.services.storage_service import save_upload
from app.services.versioning_service import record_initial_version

router = APIRouter(prefix="/api/share", tags=["share"])


def _to_out(db, user, shared, doc, person_name):
    """Build the inbox/sent row, including what the viewer may do with the document."""
    return SharedDocumentOut(
        id=shared.id,
        document_id=doc.id,
        filename=doc.filename,
        sender_name=person_name,
        message=shared.message,
        sent_date=shared.sent_date,
        read=shared.read,
        kind=shared.kind or "share",
        file_type=doc.file_type,
        department=doc.department or "",
        version=doc.version or 1,
        can_edit=can_edit_document(db, user, doc),
        can_restore=can_restore_version(user, doc),
        can_manage_access=can_manage_access(user, doc),
    )


@router.post("/send", response_model=SharedDocumentOut)
def send_document(
    file: UploadFile = File(...),
    receiver_username: str = Form(...),
    message: str = Form(""),
    also_usernames: str = Form(""),
    publish_library: bool = Form(False),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Send a document to a person, optionally to more people at once and/or
    publish it to the Library. One document is stored however many people get it.
    """
    receiver_username = receiver_username.strip()
    wanted = [receiver_username] + [u.strip() for u in also_usernames.split(",") if u.strip()]
    wanted = list(dict.fromkeys(wanted))  # drop duplicates, keep order
    if len(wanted) > 100:
        raise HTTPException(status_code=400, detail="You can send to at most 100 people at once.")

    # Every recipient must exist before anything is uploaded at all.
    people = []
    for name in wanted:
        person = db.query(User).filter(User.username == name, User.status == "Active").first()
        if not person:
            raise HTTPException(status_code=404, detail=f"No active user found with username '{name}'.")
        if person.id == user.id:
            raise HTTPException(status_code=400, detail="You can't send a document to yourself.")
        people.append(person)

    saved = save_upload(file)

    if publish_library:
        upload_type = "library"
    elif len(people) > 1:
        upload_type = "private"   # a chosen group: the access list can be changed later
    else:
        upload_type = "sent"

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

    index_document(db, document)

    if upload_type == "private":
        set_private_access(db, document, user, people)   # access list + one inbox entry each
        db.flush()   # sessions here don't auto-flush, so make the new inbox rows visible
        if message:
            for row in db.query(SharedDocument).filter(
                SharedDocument.document_id == document.id, SharedDocument.kind == "share"
            ).all():
                row.message = message
    else:
        for person in people:
            db.add(SharedDocument(document_id=document.id, sender_id=user.id, receiver_id=person.id, message=message))

    for person in people:
        db.add(AccessLog(user_id=user.id, action="SHARE", detail=f"{document.filename} -> {person.username}"))
    if publish_library:
        db.add(AccessLog(user_id=user.id, action="UPLOAD", detail=document.filename))
    db.commit()

    shared = (
        db.query(SharedDocument)
        .filter(SharedDocument.document_id == document.id, SharedDocument.receiver_id == people[0].id)
        .first()
    )
    return _to_out(db, user, shared, document, user.full_name)


@router.get("/inbox", response_model=List[SharedDocumentOut])
def get_inbox(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (
        db.query(SharedDocument, Document, User)
        .join(Document, Document.id == SharedDocument.document_id)
        .join(User, User.id == SharedDocument.sender_id)
        .filter(SharedDocument.receiver_id == user.id)
        .order_by(SharedDocument.sent_date.desc())
        .all()
    )
    return [_to_out(db, user, shared, doc, sender.full_name) for shared, doc, sender in rows]


@router.post("/inbox/{shared_id}/read")
def mark_read(shared_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    shared = db.query(SharedDocument).filter(
        SharedDocument.id == shared_id, SharedDocument.receiver_id == user.id
    ).first()
    if not shared:
        raise HTTPException(status_code=404, detail="Not found.")
    shared.read = True
    db.commit()
    return {"read": True}


@router.get("/sent", response_model=List[SharedDocumentOut])
def get_sent(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (
        db.query(SharedDocument, Document, User)
        .join(Document, Document.id == SharedDocument.document_id)
        .join(User, User.id == SharedDocument.receiver_id)
        .filter(SharedDocument.sender_id == user.id, SharedDocument.kind == "share")
        .order_by(SharedDocument.sent_date.desc())
        .all()
    )
    # sender_name is reused here as "who this row is about" (the receiver).
    return [_to_out(db, user, shared, doc, receiver.full_name) for shared, doc, receiver in rows]


def _thread_row(db, user, shared, doc, other, saved_ids):
    out = _to_out(db, user, shared, doc, other.full_name)
    out.direction = "out" if shared.sender_id == user.id else "in"
    out.person_username = other.username
    out.person_name = other.full_name
    out.person_department = other.department or ""
    out.saved = doc.id in saved_ids or doc.uploader_id == user.id
    return out


@router.get("/thread", response_model=List[SharedDocumentOut])
def get_thread(
    limit: int = Query(500, ge=1, le=1000),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Everything you sent and received, newest first. The page groups it by person."""
    saved_ids = {r.document_id for r in db.query(SavedDocument).filter(SavedDocument.user_id == user.id).all()}
    rows = (
        db.query(SharedDocument, Document)
        .join(Document, Document.id == SharedDocument.document_id)
        .filter(
            (SharedDocument.receiver_id == user.id)
            | ((SharedDocument.sender_id == user.id) & (SharedDocument.kind == "share"))
        )
        .order_by(SharedDocument.sent_date.desc())
        .limit(limit)
        .all()
    )
    people = {}
    out = []
    for shared, doc in rows:
        other_id = shared.sender_id if shared.receiver_id == user.id else shared.receiver_id
        if other_id not in people:
            people[other_id] = db.query(User).filter(User.id == other_id).first()
        other = people[other_id]
        if other is None:
            continue
        out.append(_thread_row(db, user, shared, doc, other, saved_ids))
    return out


@router.post("/thread/{username}/read")
def mark_thread_read(username: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    other = db.query(User).filter(User.username == username).first()
    if not other:
        raise HTTPException(status_code=404, detail="Person not found.")
    db.query(SharedDocument).filter(
        SharedDocument.receiver_id == user.id,
        SharedDocument.sender_id == other.id,
        SharedDocument.read == False,  # noqa: E712
    ).update({"read": True}, synchronize_session=False)
    db.commit()
    return {"read": True}


def _can_open(db, user, doc) -> bool:
    """You may save a document only if it was sent to you or you could already open it."""
    if doc.uploader_id == user.id or user.role == "Admin":
        return True
    return (
        db.query(SharedDocument.id)
        .filter(SharedDocument.document_id == doc.id, SharedDocument.receiver_id == user.id)
        .first()
        is not None
    )


@router.post("/save/{document_id}")
def save_document(document_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc or not _can_open(db, user, doc):
        raise HTTPException(status_code=404, detail="Document not found.")
    exists = db.query(SavedDocument.id).filter(
        SavedDocument.user_id == user.id, SavedDocument.document_id == doc.id
    ).first()
    if not exists:
        db.add(SavedDocument(user_id=user.id, document_id=doc.id))
        db.commit()
    return {"saved": True}


@router.delete("/save/{document_id}")
def unsave_document(document_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.query(SavedDocument).filter(
        SavedDocument.user_id == user.id, SavedDocument.document_id == document_id
    ).delete()
    db.commit()
    return {"saved": False}


@router.get("/saved", response_model=List[DocumentOut])
def list_saved(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from app.routers.documents import _to_out as doc_out  # local import: avoids a circular import

    docs = (
        db.query(Document)
        .join(SavedDocument, SavedDocument.document_id == Document.id)
        .filter(SavedDocument.user_id == user.id)
        .order_by(SavedDocument.saved_date.desc())
        .limit(500)
        .all()
    )
    return [doc_out(db, user, d) for d in docs]
