from fastapi import HTTPException

MIN_PASSWORD_LENGTH = 8
# bcrypt cannot hash more than 72 bytes; newer versions raise an error
# instead of silently cutting the password short, so it is refused up front.
MAX_PASSWORD_BYTES = 72


def validate_new_password(password: str) -> None:
    """Raise a clear 400 error if a new password is not acceptable."""
    if not password or not password.strip():
        raise HTTPException(status_code=400, detail="Enter a password.")
    if len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"The password must be at least {MIN_PASSWORD_LENGTH} characters.",
        )
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"The password is too long (at most {MAX_PASSWORD_BYTES} characters).",
        )
