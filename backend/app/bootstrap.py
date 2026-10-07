"""
Creates the first administrator from environment variables, for hosts where
you can't open a terminal to run `python -m app.create_admin` (e.g. a free
Render web service).

Set all of these to use it:
    DOCINTEL_ADMIN_EC          EC number to log in with
    DOCINTEL_ADMIN_USERNAME    username
    DOCINTEL_ADMIN_PASSWORD    password (8+ characters)
Optional:
    DOCINTEL_ADMIN_NAME        full name   (default: "Administrator")
    DOCINTEL_ADMIN_DEPARTMENT  department  (default: ICT)

It only acts when no Admin exists yet, so it never overwrites or duplicates
an account, and it does nothing at all if the variables are not set.
"""
import os

from app.auth import hash_password
from app.database import SessionLocal, User
from app.services.department_service import find_department


def ensure_bootstrap_admin():
    ec_number = os.environ.get("DOCINTEL_ADMIN_EC", "").strip()
    username = os.environ.get("DOCINTEL_ADMIN_USERNAME", "").strip()
    password = os.environ.get("DOCINTEL_ADMIN_PASSWORD", "")
    if not (ec_number and username and password):
        return

    if len(password) < 8:
        print("[bootstrap] DOCINTEL_ADMIN_PASSWORD must be at least 8 characters; admin not created.")
        return

    db = SessionLocal()
    try:
        if db.query(User).filter(User.role == "Admin").first():
            return

        department = find_department(db, os.environ.get("DOCINTEL_ADMIN_DEPARTMENT", "ICT")) or ""
        db.add(
            User(
                ec_number=ec_number,
                username=username,
                full_name=os.environ.get("DOCINTEL_ADMIN_NAME", "Administrator").strip() or "Administrator",
                password_hash=hash_password(password),
                role="Admin",
                department=department,
            )
        )
        db.commit()
        print(f"[bootstrap] Created administrator '{username}'.")
    finally:
        db.close()
