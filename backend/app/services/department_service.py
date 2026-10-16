from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.database import Department


def find_department(db: Session, name: str) -> Optional[str]:
    """Return the department's exact stored name for a case-insensitive match, or None."""
    wanted = (name or "").strip().lower()
    if not wanted:
        return None
    for dept in db.query(Department).all():
        if dept.name.lower() == wanted:
            return dept.name
    return None


def resolve_department(db: Session, name: str, required: bool = False) -> str:
    """
    Validate a department chosen in the UI/API against the managed list and
    return its canonical spelling. An empty value is allowed unless required.
    """
    name = (name or "").strip()
    if not name:
        if required:
            raise HTTPException(status_code=400, detail="A department is required.")
        return ""
    canonical = find_department(db, name)
    if canonical is None:
        raise HTTPException(
            status_code=400,
            detail=f"'{name}' is not a department. Choose one from the list, or ask an admin to add it.",
        )
    return canonical
