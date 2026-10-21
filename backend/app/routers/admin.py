from typing import List, Optional

import secrets

import bcrypt
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import hash_password
from app.database import (
    AccessLog,
    Department,
    Document,
    DocumentPermission,
    DocumentVersion,
    PasswordResetRequest,
    SavedDocument,
    SharedDocument,
    User,
    get_db,
)
from app.dependencies import require_admin
from app.schemas import (
    AccessLogOut,
    CreateUserRequest,
    UpdateUserDepartmentRequest,
    UpdateUserStatusRequest,
    UserOut,
)
from app.services.department_service import resolve_department
from app.services.password_policy import validate_new_password
from app.services.user_import_service import MAX_FILE_BYTES, check_file, temp_password

router = APIRouter(prefix="/api/admin", tags=["admin"])


class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = None
    ec_number: Optional[str] = None
    username: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    new_password: str


@router.get("/users", response_model=List[UserOut])
def list_users(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(User).order_by(User.created_date.desc()).all()


@router.post("/users", response_model=UserOut)
def create_user(payload: CreateUserRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    ec_number = payload.ec_number.strip()
    username = payload.username.strip()

    if not ec_number or not username or not payload.password:
        raise HTTPException(status_code=400, detail="EC number, username, and password are required.")

    existing = (
        db.query(User)
        .filter((User.ec_number == ec_number) | (User.username == username))
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="A user with that EC number or username already exists.")

    role = "User" if payload.role == "Employee" else payload.role   # "Employee" is the old name for "User"
    if role not in ("User", "Manager", "Admin"):
        raise HTTPException(status_code=400, detail="Invalid role.")

    validate_new_password(payload.password)

    # Department must come from the managed list (this is what edit rights
    # depend on, so "HR" and "hr " can't end up as two departments).
    department = resolve_department(db, payload.department)

    user = User(
        ec_number=ec_number,
        username=username,
        full_name=payload.full_name.strip(),
        password_hash=hash_password(payload.password),
        role=role,
        department=department,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/import")
def import_users(
    file: UploadFile = File(...),
    dry_run: bool = Form(True),
    create_departments: bool = Form(False),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Create many accounts from a spreadsheet. With dry_run=true it only checks the
    file and reports every row; with dry_run=false it creates the rows that passed
    and returns each person's temporary password (shown once, not stored).
    """
    data = file.file.read(MAX_FILE_BYTES + 1)
    result = check_file(db, file.filename or "", data, create_departments)
    if dry_run:
        return result

    created, skipped = [], []
    try:
        for name in result["new_departments"]:
            db.add(Department(name=name))
        for r in result["rows"]:
            if r["status"] != "ok":
                skipped.append({"row": r["row"], "ec_number": r["ec_number"], "full_name": r["full_name"], "message": r["message"]})
                continue
            pw = temp_password()
            # A lighter bcrypt cost keeps a big import quick. These passwords are random,
            # single-use, and replaced by each person at first sign-in.
            hashed = bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt(rounds=10)).decode("utf-8")
            db.add(User(
                ec_number=r["ec_number"], username=r["username"], full_name=r["full_name"],
                password_hash=hashed, role=r["role"] or "User", department=r["department"],
                must_change_password=True,
            ))
            created.append({
                "ec_number": r["ec_number"], "full_name": r["full_name"], "username": r["username"],
                "department": r["department"], "role": r["role"] or "User", "temporary_password": pw,
            })
        db.add(AccessLog(user_id=admin.id, action="USER_IMPORT", detail=f"created {len(created)}, skipped {len(skipped)}"))
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Someone with one of those EC numbers or usernames was added while you were importing. Check again.")
    return {"created": created, "skipped": skipped}


@router.patch("/users/{user_id}/status", response_model=UserOut)
def update_user_status(
    user_id: str,
    payload: UpdateUserStatusRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if payload.status not in ("Active", "Disabled"):
        raise HTTPException(status_code=400, detail="Status must be 'Active' or 'Disabled'.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.id == admin.id and payload.status == "Disabled":
        raise HTTPException(status_code=400, detail="You cannot disable your own account.")

    user.status = payload.status
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}/department", response_model=UserOut)
def update_user_department(
    user_id: str,
    payload: UpdateUserDepartmentRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Only affects documents they upload from now on; existing documents
    # keep the department they were uploaded under.
    user.department = resolve_department(db, payload.department)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    payload: UpdateUserRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Edit a user's name, EC number and/or username. Only the fields sent are changed."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    changed = []

    if payload.full_name is not None:
        full_name = " ".join(payload.full_name.split())
        if not full_name:
            raise HTTPException(status_code=400, detail="The name can't be empty.")
        if full_name != user.full_name:
            changed.append("name")
        new_full_name = full_name
    else:
        new_full_name = user.full_name

    new_ec = user.ec_number
    if payload.ec_number is not None:
        new_ec = payload.ec_number.strip()
        if not new_ec:
            raise HTTPException(status_code=400, detail="The EC number can't be empty.")
        if new_ec != user.ec_number:
            changed.append("EC number")

    new_username = user.username
    if payload.username is not None:
        new_username = payload.username.strip()
        if not new_username:
            raise HTTPException(status_code=400, detail="The username can't be empty.")
        if new_username != user.username:
            changed.append("username")

    # EC number and username must stay unique across all other accounts.
    conditions = []
    if new_ec != user.ec_number:
        conditions.append(User.ec_number == new_ec)
    if new_username != user.username:
        conditions.append(User.username == new_username)
    if conditions and db.query(User).filter(User.id != user.id, or_(*conditions)).first():
        raise HTTPException(
            status_code=409,
            detail="Another account already uses that EC number or username.",
        )

    if not changed:
        return user

    old_label = f"{user.username} ({user.ec_number})"
    user.full_name = new_full_name
    user.ec_number = new_ec
    user.username = new_username
    db.add(AccessLog(user_id=admin.id, action="USER_EDIT", detail=f"{old_label}: changed {', '.join(changed)}"))
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/reset-password")
def reset_user_password(
    user_id: str,
    payload: ResetPasswordRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Set a new password for a user (for example when they have forgotten theirs)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    validate_new_password(payload.new_password)

    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = True   # they must choose their own at next sign-in
    db.add(AccessLog(user_id=admin.id, action="PASSWORD_RESET", detail=f"{user.username} ({user.ec_number})"))
    db.commit()
    return {"reset": True}


# ---- "I forgot my password" requests -------------------------------------

_TEMP_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"  # no look-alike letters


class ResetRequestOut(BaseModel):
    id: str
    user_id: str
    full_name: str
    ec_number: str
    username: str
    department: str = ""
    requested_date: datetime


@router.get("/password-requests", response_model=List[ResetRequestOut])
def list_password_requests(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = (
        db.query(PasswordResetRequest, User)
        .join(User, User.id == PasswordResetRequest.user_id)
        .filter(PasswordResetRequest.status == "pending")
        .order_by(PasswordResetRequest.requested_date.asc())
        .all()
    )
    return [
        ResetRequestOut(
            id=r.id, user_id=u.id, full_name=u.full_name, ec_number=u.ec_number,
            username=u.username, department=u.department or "", requested_date=r.requested_date,
        )
        for r, u in rows
    ]


@router.post("/password-requests/{request_id}/issue")
def issue_temporary_password(request_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Give the person a random temporary password. It is shown once, here, and not stored."""
    req = db.query(PasswordResetRequest).filter(
        PasswordResetRequest.id == request_id, PasswordResetRequest.status == "pending"
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="That request is no longer open.")
    user = db.query(User).filter(User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    temp = "".join(secrets.choice(_TEMP_CHARS) for _ in range(10))
    user.password_hash = hash_password(temp)
    user.must_change_password = True
    req.status = "done"
    db.add(AccessLog(user_id=admin.id, action="PASSWORD_RESET", detail=f"{user.username} ({user.ec_number}) via request"))
    db.commit()
    return {"temporary_password": temp, "full_name": user.full_name, "ec_number": user.ec_number}


@router.delete("/password-requests/{request_id}")
def dismiss_password_request(request_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    req = db.query(PasswordResetRequest).filter(PasswordResetRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Not found.")
    req.status = "dismissed"
    db.commit()
    return {"dismissed": True}


@router.delete("/users/{user_id}")
def delete_user(user_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You can't delete your own account.")

    # Documents and their version history point at the person who uploaded or
    # edited them. Deleting that person would leave records with no owner, so
    # such accounts are disabled instead.
    owns_documents = db.query(Document.id).filter(Document.uploader_id == user.id).first()
    saved_versions = db.query(DocumentVersion.id).filter(DocumentVersion.editor_id == user.id).first()
    if owns_documents or saved_versions:
        raise HTTPException(
            status_code=409,
            detail=(
                "This person has uploaded or edited documents, so the account can't be deleted. "
                "Disable it instead: they will no longer be able to sign in."
            ),
        )

    label = f"{user.full_name} ({user.ec_number})"

    # Remove what only mattered to this person; keep the activity log but
    # detach it from the account that is going away.
    db.query(DocumentPermission).filter(DocumentPermission.user_id == user.id).delete()
    db.query(PasswordResetRequest).filter(PasswordResetRequest.user_id == user.id).delete()
    db.query(SavedDocument).filter(SavedDocument.user_id == user.id).delete()
    db.query(SharedDocument).filter(
        or_(SharedDocument.sender_id == user.id, SharedDocument.receiver_id == user.id)
    ).delete(synchronize_session=False)
    db.query(AccessLog).filter(AccessLog.user_id == user.id).update(
        {"user_id": None}, synchronize_session=False
    )
    db.delete(user)

    db.add(AccessLog(user_id=admin.id, action="USER_DELETE", detail=label))
    db.commit()
    return {"deleted": True}


@router.get("/access-logs", response_model=List[AccessLogOut])
def get_access_logs(limit: int = 200, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.query(AccessLog).order_by(AccessLog.timestamp.desc()).limit(limit).all()
    out = []
    for r in rows:
        user_name = r.user.full_name if r.user_id and getattr(r, "user", None) else None
        out.append(AccessLogOut(id=r.id, user_name=user_name, action=r.action, detail=r.detail, timestamp=r.timestamp))
    return out
