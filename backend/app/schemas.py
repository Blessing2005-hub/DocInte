from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class LoginRequest(BaseModel):
    ec_number: str
    password: str


class UserOut(BaseModel):
    id: str
    ec_number: str
    username: str
    full_name: str
    role: str
    department: str

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class CreateUserRequest(BaseModel):
    ec_number: str
    username: str
    full_name: str
    password: str
    role: str = "Employee"
    department: str = ""


class UpdateUserStatusRequest(BaseModel):
    status: str  # Active | Disabled


class UpdateUserDepartmentRequest(BaseModel):
    department: str


class DepartmentOut(BaseModel):
    id: str
    name: str

    class Config:
        from_attributes = True


class CreateDepartmentRequest(BaseModel):
    name: str


class DocumentOut(BaseModel):
    id: str
    filename: str
    file_type: str
    file_size: int
    upload_type: str
    uploader_name: str
    upload_date: datetime
    department: str = ""
    version: int = 1
    updated_date: Optional[datetime] = None
    updated_by_name: Optional[str] = None
    can_edit: bool = False
    can_restore: bool = False

    class Config:
        from_attributes = True


class VersionOut(BaseModel):
    version_number: int
    editor_name: str
    note: str
    file_size: int
    created_date: datetime
    is_current: bool


class SharedDocumentOut(BaseModel):
    id: str
    document_id: str
    filename: str
    sender_name: str
    message: str
    sent_date: datetime
    read: bool
    kind: str = "share"          # share | edit (an edit notice)
    file_type: str = ""
    department: str = ""
    version: int = 1
    can_edit: bool = False
    can_restore: bool = False

    class Config:
        from_attributes = True


class AskRequest(BaseModel):
    question: str


class AskResponse(BaseModel):
    answer: str
    sources: List[str]


class AccessLogOut(BaseModel):
    id: str
    user_name: Optional[str]
    action: str
    detail: str
    timestamp: datetime

    class Config:
        from_attributes = True
