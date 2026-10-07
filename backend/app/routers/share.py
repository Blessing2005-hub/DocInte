from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import AccessLog, Document, SharedDocument, User, get_db
from app.dependencies import get_current_user
from app.schemas import SharedDocumentOut
from app.services.ai_service import index_document
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
    )


@router.post("/send", response_model=SharedDocumentOut)
def send_document(
    file: UploadFile = File(...),
    receiver_username: str = Form(...),
    message: str = Form(""),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    receiver_username = receiver_username.strip()

    # This is the fix for the original's silent-orphan bug: the receiver
    # must exist before anything is uploaded at all.
    receiver = db.query(User).filter(User.username == receiver_username).first()
    if not receiver:
        raise HTTPException(status_code=404, detail=f"No user found with username '{receiver_username}'.")

    if receiver.id == user.id:
        raise HTTPException(status_code=400, detail="You can't send a document to yourself.")

    saved = save_upload(file)

    document = Document(
        filename=saved["original_name"],
        storage_name=saved["storage_name"],
        file_path=saved["storage_path"],
        file_type=saved["file_type"],
        file_size=saved["file_size"],
        upload_type="sent",
        uploader_id=user.id,
        department=user.department or "",
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    record_initial_version(db, document, user.id)
    db.commit()

    index_document(db, document)

    shared = SharedDocument(
        document_id=document.id,
        sender_id=user.id,
        receiver_id=receiver.id,
        message=message,
    )
    db.add(shared)

    db.add(AccessLog(user_id=user.id, action="SHARE", detail=f"{document.filename} -> {receiver.username}"))
    db.commit()
    db.refresh(shared)

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
