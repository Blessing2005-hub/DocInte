import logging
import os
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.bootstrap import ensure_bootstrap_admin
from app.config import CORS_ORIGINS
from app.database import engine, init_db
from app.routers import accounts, admin, ai, departments, documents, share

logging.basicConfig(level=os.environ.get("DOCINTEL_LOG_LEVEL", "INFO").upper(),
                    format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("docintel")

# Optional error alerts: set SENTRY_DSN (from sentry.io or a self-hosted Sentry)
# and every unhandled error is reported with its stack trace.
_SENTRY_DSN = os.environ.get("SENTRY_DSN", "").strip()
if _SENTRY_DSN:
    try:
        import sentry_sdk
        sentry_sdk.init(dsn=_SENTRY_DSN, traces_sample_rate=0.0, send_default_pii=False,
                        environment=os.environ.get("DOCINTEL_ENV", "production"))
        log.info("Error reporting is on.")
    except ImportError:
        log.warning("SENTRY_DSN is set but sentry-sdk is not installed.")

app = FastAPI(
    title="DocIntel",
    description="Document library, sharing, and AI assistant.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,  # the app uses Bearer tokens, not cookies
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_log(request: Request, call_next):
    """One log line per request: id, method, path, status, milliseconds. No query strings or tokens."""
    rid = uuid.uuid4().hex[:8]
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        log.exception("req=%s %s %s crashed", rid, request.method, request.url.path)
        return JSONResponse({"detail": "Something went wrong on the server."}, status_code=500,
                            headers={"X-Request-ID": rid})
    ms = (time.perf_counter() - started) * 1000
    if request.url.path != "/api/health" or response.status_code >= 400:
        log.info("req=%s %s %s -> %s in %.0f ms", rid, request.method, request.url.path, response.status_code, ms)
    response.headers["X-Request-ID"] = rid
    return response


@app.on_event("startup")
def on_startup():
    init_db()
    ensure_bootstrap_admin()


@app.get("/api/health")
def health():
    """For hosts and monitors: 200 when the app and its database are working, 503 when not."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        log.exception("Health check: the database is not reachable")
        return JSONResponse({"status": "error", "database": "down"}, status_code=503)
    return {"status": "ok", "database": "ok"}


app.include_router(accounts.router)
app.include_router(admin.router)
app.include_router(departments.router)
app.include_router(documents.router)
app.include_router(share.router)
app.include_router(ai.router)
