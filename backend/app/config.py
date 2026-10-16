import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STORAGE_DIR = os.path.join(BASE_DIR, "storage")
UPLOADS_DIR = os.path.join(STORAGE_DIR, "uploads")
DB_PATH = os.path.join(STORAGE_DIR, "docintel.db")

os.makedirs(UPLOADS_DIR, exist_ok=True)

DATABASE_URL = f"sqlite:///{DB_PATH}"

# ---- Auth ----
# In production, set JWT_SECRET via environment variable rather than
# relying on this default.
JWT_SECRET = os.environ.get("DOCINTEL_JWT_SECRET", "change-this-secret-before-deploying")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60 * 8  # 8-hour session

# ---- CORS ----
CORS_ORIGINS = os.environ.get("DOCINTEL_CORS_ORIGINS", "*").split(",")

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
