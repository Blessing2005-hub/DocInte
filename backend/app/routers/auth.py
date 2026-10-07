from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import create_access_token, verify_password
from app.database import AccessLog, User, get_db
from app.dependencies import get_current_user
from app.schemas import LoginRequest, LoginResponse, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    ec_number = payload.ec_number.strip()

    user = db.query(User).filter(User.ec_number == ec_number).first()

    # Same generic error whether the EC number doesn't exist or the
    # password is wrong - this avoids confirming to an attacker which EC
    # numbers are valid accounts.
    invalid_credentials = HTTPException(status_code=401, detail="Invalid EC number or password")

    if not user or user.status != "Active":
        db.add(AccessLog(user_id=None, action="LOGIN_FAILED", detail=f"ec_number={ec_number}"))
        db.commit()
        raise invalid_credentials

    if not verify_password(payload.password, user.password_hash):
        db.add(AccessLog(user_id=user.id, action="LOGIN_FAILED", detail=""))
        db.commit()
        raise invalid_credentials

    token = create_access_token(user.id, user.role)

    db.add(AccessLog(user_id=user.id, action="LOGIN", detail=""))
    db.commit()

    return LoginResponse(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
