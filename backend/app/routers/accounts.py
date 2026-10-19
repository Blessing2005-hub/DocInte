from fastapi import APIRouter, Depends, HTTPException, Request
from typing import List

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import create_access_token, hash_password, verify_password
from app.database import AccessLog, PasswordResetRequest, User, get_db
from app.dependencies import get_current_user
from app.schemas import LoginRequest, LoginResponse, UserOut
from app.services.login_limiter import check_allowed, client_address, record_failure, record_success
from app.services.password_policy import validate_new_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ec_number = payload.ec_number.strip()
    address = client_address(request)
    check_allowed(ec_number, address)  # too many wrong passwords recently -> pause

    user = db.query(User).filter(User.ec_number == ec_number).first()

    # Same generic error whether the EC number doesn't exist or the
    # password is wrong - this avoids confirming to an attacker which EC
    # numbers are valid accounts.
    invalid_credentials = HTTPException(status_code=401, detail="Invalid EC number or password")

    if not user or user.status != "Active":
        record_failure(ec_number, address)
        db.add(AccessLog(user_id=None, action="LOGIN_FAILED", detail=f"ec_number={ec_number}"))
        db.commit()
        raise invalid_credentials

    if not verify_password(payload.password, user.password_hash):
        record_failure(ec_number, address)
        db.add(AccessLog(user_id=user.id, action="LOGIN_FAILED", detail=""))
        db.commit()
        raise invalid_credentials

    record_success(ec_number, address)
    token = create_access_token(user.id, user.role)

    db.add(AccessLog(user_id=user.id, action="LOGIN", detail=""))
    db.commit()

    return LoginResponse(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Let a signed-in user choose a new password, after proving they know the current one."""
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Your current password is not correct.")

    validate_new_password(payload.new_password)

    if payload.new_password == payload.current_password:
        raise HTTPException(status_code=400, detail="Choose a password different from your current one.")

    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    db.add(AccessLog(user_id=user.id, action="PASSWORD_CHANGE", detail=""))
    db.commit()
    return {"changed": True}


class ForgotPasswordRequest(BaseModel):
    ec_number: str
    username: str


FORGOT_MESSAGE = (
    "If those details match an account, your request has been sent to an administrator. "
    "They will give you a temporary password."
)


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    """
    Someone who can't sign in asks an administrator for a new password. The
    reply is the same whether or not the details match, so this can't be used to
    find out which EC numbers exist. Repeated tries are slowed down.
    """
    ec_number = payload.ec_number.strip()
    username = payload.username.strip()
    address = client_address(request)

    check_allowed(f"forgot:{ec_number}", address)
    record_failure(f"forgot:{ec_number}", address)  # every try counts towards the limit

    user = (
        db.query(User)
        .filter(User.ec_number == ec_number, User.status == "Active")
        .first()
    )
    if user and user.username.lower() == username.lower():
        already = (
            db.query(PasswordResetRequest)
            .filter(PasswordResetRequest.user_id == user.id, PasswordResetRequest.status == "pending")
            .first()
        )
        if not already:
            db.add(PasswordResetRequest(user_id=user.id))
            db.add(AccessLog(user_id=user.id, action="PASSWORD_RESET_REQUEST", detail=""))
            db.commit()
    return {"message": FORGOT_MESSAGE}


class DirectoryEntry(BaseModel):
    id: str
    username: str
    full_name: str
    department: str = ""

    class Config:
        from_attributes = True


@router.get("/directory", response_model=List[DirectoryEntry])
def user_directory(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Names of the other active people, so a sender can pick who to share with.
    Only name, username and department are shown (no EC numbers or roles)."""
    return (
        db.query(User)
        .filter(User.status == "Active", User.id != user.id)
        .order_by(User.full_name)
        .all()
    )
