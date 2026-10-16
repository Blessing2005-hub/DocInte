from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.bootstrap import ensure_bootstrap_admin
from app.config import CORS_ORIGINS
from app.database import init_db
from app.routers import admin, ai, auth, departments, documents, share

app = FastAPI(
    title="DocIntel",
    description="Document library, sharing, and AI assistant.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()
    ensure_bootstrap_admin()


@app.get("/api/health")
def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(departments.router)
app.include_router(documents.router)
app.include_router(share.router)
app.include_router(ai.router)
