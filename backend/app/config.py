import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Where uploaded files (and the SQLite file, if used) live. On a host with a
# persistent disk, set DOCINTEL_STORAGE_DIR to the disk's mount path.
STORAGE_DIR = os.environ.get("DOCINTEL_STORAGE_DIR") or os.path.join(BASE_DIR, "storage")
UPLOADS_DIR = os.path.join(STORAGE_DIR, "uploads")
DB_PATH = os.path.join(STORAGE_DIR, "docintel.db")

os.makedirs(UPLOADS_DIR, exist_ok=True)

# Use PostgreSQL by setting DOCINTEL_DATABASE_URL (or DATABASE_URL) to the
# connection address. Without it the app uses the local SQLite file.
DATABASE_URL = os.environ.get("DOCINTEL_DATABASE_URL") or os.environ.get("DATABASE_URL") or f"sqlite:///{DB_PATH}"
if DATABASE_URL.startswith("postgres://"):  # older style some hosts hand out
    DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgres://"):]

# ---- Auth ----
# The secret signs every login token, so it must come from the environment.
# The app refuses to start without a real one. For local testing only, set
# DOCINTEL_ENV=dev to allow a built-in throwaway secret.
_DEV_SECRET = "change-this-secret-before-deploying"
JWT_SECRET = os.environ.get("DOCINTEL_JWT_SECRET", "").strip()
if not JWT_SECRET or JWT_SECRET == _DEV_SECRET:
    if os.environ.get("DOCINTEL_ENV", "").strip().lower() == "dev":
        JWT_SECRET = _DEV_SECRET
    else:
        raise RuntimeError(
            "DOCINTEL_JWT_SECRET is not set (or is the default). Set it to a long random "
            "string in the environment. For local testing only, set DOCINTEL_ENV=dev."
        )
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60 * 8  # 8-hour session

# ---- CORS ----
# Set DOCINTEL_CORS_ORIGINS to your website's address (comma-separated if more
# than one), e.g. https://docintel-9425.onrender.com - then only that site can
# talk to the API from a browser. Left unset, any site is allowed (testing only).
CORS_ORIGINS = [o.strip().rstrip("/") for o in os.environ.get("DOCINTEL_CORS_ORIGINS", "*").split(",") if o.strip()] or ["*"]

# ---- Login protection ----
LOGIN_MAX_FAILS = 5          # wrong passwords allowed...
LOGIN_WINDOW_SECONDS = 15 * 60   # ...within this many seconds before a pause

# ---- Uploads ----
MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB
ALLOWED_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".ppt", ".pptx", ".png", ".jpg", ".jpeg", ".txt",
}

# ---- AI ----
# Model name is a config value, not hardcoded - swap it (or move to a
# hosted API) without touching the service logic. qwen2.5:7b-instruct is
# the recommended default: strong instruction-following in its size
# class, tolerant of typos/phrasing errors, and runs fully on-prem via
# Ollama so document content never leaves your server.
OLLAMA_MODEL = os.environ.get("DOCINTEL_AI_MODEL", "qwen2.5:7b-instruct")
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
AI_SEARCH_RESULTS = 5

# Set DOCINTEL_AI_ENABLED=false on small hosts (e.g. a 512 MB free tier).
# The AI libraries (PyTorch) alone need more memory than that. With it off,
# documents are still uploaded, shared, edited and versioned as normal - they
# just aren't indexed for the AI assistant, which then says it is turned off.
AI_ENABLED = os.environ.get("DOCINTEL_AI_ENABLED", "true").strip().lower() not in ("false", "0", "no", "off")
