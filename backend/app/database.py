import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint,
    create_engine, text,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

from app.config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def gen_id():
    return str(uuid.uuid4())


DEFAULT_DEPARTMENTS = ["ICT", "Accounts", "HR", "Gender"]


class Department(Base):
    """The managed list of organisational departments (admins add to it)."""
    __tablename__ = "departments"

    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, unique=True, nullable=False)


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_id)
    ec_number = Column(String, unique=True, nullable=False, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    full_name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="Employee")  # Employee | Admin
    department = Column(String, default="")
    status = Column(String, default="Active")  # Active | Disabled
    created_date = Column(DateTime, default=datetime.utcnow)


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=gen_id)
    filename = Column(String, nullable=False)          # original name, shown to users
    storage_name = Column(String, nullable=False)       # uuid-based name on disk, never collides
    file_path = Column(String, nullable=False)
    file_type = Column(String, default="")
    file_size = Column(Integer, default=0)
    upload_type = Column(String, nullable=False)         # library | private | sent
    uploader_id = Column(String, ForeignKey("users.id"), nullable=False)
    upload_date = Column(DateTime, default=datetime.utcnow, index=True)
    indexed = Column(Boolean, default=False)

    # Department of the uploader at the moment of upload. Stamped on the
    # document so it stays with its original department if the uploader
    # later moves. Only used to decide who may edit Library documents.
    department = Column(String, default="")
    # Current version number; the matching file is file_path above.
    version = Column(Integer, nullable=False, default=1)
    updated_date = Column(DateTime, nullable=True)
    updated_by_id = Column(String, ForeignKey("users.id"), nullable=True)

    uploader = relationship("User", foreign_keys=[uploader_id])
    updated_by = relationship("User", foreign_keys=[updated_by_id])


class DocumentVersion(Base):
    """One saved copy of a document. Edits add a row; nothing is overwritten."""
    __tablename__ = "document_versions"
    __table_args__ = (UniqueConstraint("document_id", "version_number", name="uq_document_version"),)

    id = Column(String, primary_key=True, default=gen_id)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    storage_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, default=0)
    editor_id = Column(String, ForeignKey("users.id"), nullable=False)
    note = Column(Text, default="")
    created_date = Column(DateTime, default=datetime.utcnow)

    editor = relationship("User", foreign_keys=[editor_id])


class DocumentPermission(Base):
    __tablename__ = "document_permissions"

    id = Column(String, primary_key=True, default=gen_id)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)


class SharedDocument(Base):
    __tablename__ = "shared_documents"

    id = Column(String, primary_key=True, default=gen_id)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False, index=True)
    sender_id = Column(String, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    message = Column(Text, default="")
    sent_date = Column(DateTime, default=datetime.utcnow, index=True)
    read = Column(Boolean, default=False)
    # "share" = a document someone sent you; "edit" = a notice that someone
    # saved a new version of a document you have access to.
    kind = Column(String, nullable=False, default="share")


class DocumentChunk(Base):
    """Text chunks used by the AI assistant's retrieval index."""
    __tablename__ = "document_chunks"

    id = Column(String, primary_key=True, default=gen_id)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    embedding_json = Column(Text, nullable=False)  # JSON-encoded float vector


class AccessLog(Base):
    __tablename__ = "access_logs"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)   # LOGIN | LOGIN_FAILED | UPLOAD | DOWNLOAD | SHARE | DELETE | ASK_AI
    detail = Column(String, default="")
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", foreign_keys=[user_id])


def _column_names(conn, table):
    return {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}


def _add_missing_columns():
    """
    create_all() creates new tables but never alters existing ones, so an
    existing docintel.db needs the new columns added in place. Safe to run
    on every startup: it only acts when a column is missing.
    """
    with engine.begin() as conn:
        doc_cols = _column_names(conn, "documents")
        if "department" not in doc_cols:
            conn.execute(text("ALTER TABLE documents ADD COLUMN department VARCHAR DEFAULT ''"))
        if "version" not in doc_cols:
            conn.execute(text("ALTER TABLE documents ADD COLUMN version INTEGER NOT NULL DEFAULT 1"))
        if "updated_date" not in doc_cols:
            conn.execute(text("ALTER TABLE documents ADD COLUMN updated_date DATETIME"))
        if "updated_by_id" not in doc_cols:
            conn.execute(text("ALTER TABLE documents ADD COLUMN updated_by_id VARCHAR"))

        shared_cols = _column_names(conn, "shared_documents")
        if "kind" not in shared_cols:
            conn.execute(text("ALTER TABLE shared_documents ADD COLUMN kind VARCHAR NOT NULL DEFAULT 'share'"))


def _seed_and_backfill():
    """Fill in the data the new features need for databases that already exist."""
    db = SessionLocal()
    try:
        # 1. Department list: defaults, plus anything users already have.
        if db.query(Department).count() == 0:
            names = list(DEFAULT_DEPARTMENTS)
            seen = {n.lower() for n in names}
            for (dept,) in db.query(User.department).distinct().all():
                d = (dept or "").strip()
                if d and d.lower() not in seen:
                    names.append(d)
                    seen.add(d.lower())
            for n in names:
                db.add(Department(name=n))
            db.commit()

        # 2. Make user departments match the list's exact spelling/casing.
        canonical = {d.name.lower(): d.name for d in db.query(Department).all()}
        for u in db.query(User).all():
            d = (u.department or "").strip()
            if d and d.lower() in canonical and canonical[d.lower()] != u.department:
                u.department = canonical[d.lower()]
        db.commit()

        # 3. Existing documents take their uploader's department.
        for doc in db.query(Document).all():
            if not (doc.department or "").strip() and doc.uploader and doc.uploader.department:
                doc.department = doc.uploader.department
        db.commit()

        # 4. Every document needs a version-1 row to anchor its history.
        for doc in db.query(Document).all():
            has_version = db.query(DocumentVersion.id).filter(DocumentVersion.document_id == doc.id).first()
            if not has_version:
                db.add(
                    DocumentVersion(
                        document_id=doc.id,
                        version_number=doc.version or 1,
                        storage_name=doc.storage_name,
                        file_path=doc.file_path,
                        file_size=doc.file_size,
                        editor_id=doc.uploader_id,
                        note="Original upload",
                        created_date=doc.upload_date,
                    )
                )
        db.commit()
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    _add_missing_columns()
    _seed_and_backfill()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
