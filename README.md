# DocIntel

Ministry of Industry and Commerce document library: sharing, versioned editing, departments and an AI assistant.

- `backend/`  FastAPI + SQLite (run from inside `backend`: `uvicorn app.main:app`)
- `frontend/` React + Vite

## Render (free tier)

**Backend (Web Service)** - Root Directory: empty
- Build: `pip install fastapi "uvicorn[standard]" sqlalchemy pydantic python-multipart bcrypt pyjwt requests pymupdf python-docx openpyxl python-pptx pillow pytesseract`
- Start: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Environment: `DOCINTEL_JWT_SECRET`, `DOCINTEL_ADMIN_EC`, `DOCINTEL_ADMIN_USERNAME`, `DOCINTEL_ADMIN_PASSWORD`, `DOCINTEL_ADMIN_NAME`, `DOCINTEL_ADMIN_DEPARTMENT`, `DOCINTEL_AI_ENABLED=false`

**Frontend (Static Site)** - Root Directory: `frontend`
- Build: `npm install; npm run build`   Publish directory: `dist`
- Environment: `VITE_API_URL=<your backend URL>`
- Redirect/Rewrite rule: `/*` -> `/index.html` (rewrite)

On a server with Ollama, install `backend/requirements.txt` instead and remove `DOCINTEL_AI_ENABLED`.

## Running on a server with Docker (recommended for real use)

This runs everything on one machine: the website, the API, a PostgreSQL database
and a disk for uploaded files. LibreOffice is included, so old `.doc`, `.xls` and `.ppt`
files can be previewed.

1. Install Docker and Docker Compose on the server.
2. Copy `.env.example` to `.env` and fill in the values (secrets, first admin, `SITE_URL`).
3. Run `docker compose up -d --build`.
4. Open `SITE_URL`. Put HTTPS in front of it (a reverse proxy or the organisation's certificate).

Data lives in two Docker volumes: `dbdata` (database) and `files` (uploads). **Back both up.**
Example daily backup of the database:
`docker compose exec -T db pg_dump -U docintel docintel > backup-$(date +%F).sql`

Health check: `GET /api/health` returns 200 when the app and database are working, 503 when not.
Set `SENTRY_DSN` to get error alerts. The API logs one line per request.

### Render (paid) instead
- Backend: New Web Service, Language **Docker**, Root Directory `backend`, add a **Disk** mounted at `/data`,
  health check path `/api/health`, and set `DOCINTEL_DATABASE_URL` to a Render PostgreSQL address.
- Frontend: unchanged (Static Site).
