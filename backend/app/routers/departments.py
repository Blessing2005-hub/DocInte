from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import Department, User, get_db
from app.dependencies import get_current_user, require_admin
from app.schemas import CreateDepartmentRequest, DepartmentOut
from app.services.department_service import find_department

router = APIRouter(prefix="/api/departments", tags=["departments"])


@router.get("", response_model=List[DepartmentOut])
def list_departments(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Department).order_by(Department.name).all()


@router.post("", response_model=DepartmentOut)
def create_department(
    payload: CreateDepartmentRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    name = " ".join(payload.name.split())
    if not name:
        raise HTTPException(status_code=400, detail="Enter a department name.")
    if len(name) > 80:
        raise HTTPException(status_code=400, detail="Department names can be at most 80 characters.")
    if find_department(db, name):
        raise HTTPException(status_code=409, detail="That department already exists.")

    department = Department(name=name)
    db.add(department)
    db.commit()
    db.refresh(department)
    return department
