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
