from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import hash_password
from app.database import AccessLog, User, get_db
from app.dependencies import require_admin
from app.schemas import (
    AccessLogOut,
    CreateUserRequest,
    UpdateUserDepartmentRequest,
    UpdateUserStatusRequest,
    UserOut,
)
from app.services.department_service import resolve_department

router = APIRouter(prefix="/api/admin", tags=["admin"])


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

    if payload.role not in ("Employee", "Manager", "Admin"):
        raise HTTPException(status_code=400, detail="Invalid role.")

    # Department must come from the managed list (this is what edit rights
    # depend on, so "HR" and "hr " can't end up as two departments).
    department = resolve_department(db, payload.department)

    user = User(
        ec_number=ec_number,
        username=username,
        full_name=payload.full_name.strip(),
        password_hash=hash_password(payload.password),
        role=payload.role,
        department=department,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


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


@router.get("/access-logs", response_model=List[AccessLogOut])
def get_access_logs(limit: int = 200, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.query(AccessLog).order_by(AccessLog.timestamp.desc()).limit(limit).all()
    out = []
    for r in rows:
        user_name = r.user.full_name if r.user_id and getattr(r, "user", None) else None
        out.append(AccessLogOut(id=r.id, user_name=user_name, action=r.action, detail=r.detail, timestamp=r.timestamp))
    return out
