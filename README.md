# DocIntel

Document library, sharing, and AI assistant — rebuilt from the original
Streamlit prototype as FastAPI + React.

## What changed from the original, and why

**Security**
- Passwords are now hashed with **bcrypt** (random salt per user) instead of
  unsalted SHA-256. In the original database, two different users with the
  same password had identical hashes — that can't happen anymore.
- Sessions are real **JWT tokens** issued at login and verified on every
  request, instead of Streamlit's browser-session-tied `session_state`.
  This closes the main way someone could end up "logged in as" a
  previous user on a shared device.
- Admin-only actions (create user, disable user, view access logs) are
  enforced **server-side** via `require_admin` on the route itself — not
  just by hiding a button in the UI. A direct API call from a non-admin
  token is rejected regardless of what the frontend shows.
- No hardcoded credentials in source. `app/create_admin.py` prompts for
  the first admin account interactively instead.
- Document ownership is checked at the query level before delete —
  previously a delete only worked because the button wasn't drawn for
  other users' documents, not because the backend actually checked.

**File transfer / sharing**
- Sending a document now validates the receiver's username **before**
  anything uploads — the original let you silently "send" to a typo'd
  username with no error and no way to retrieve the file afterward.
- Files are stored under a UUID-based name on disk (original filename is
  kept separately for display/download), so two uploads with the same
  filename can never overwrite each other.
- File size and file type are validated on upload.

**AI Assistant**
- Every document is indexed **immediately on upload**, not via a manual
  `python indexer.py` step someone has to remember to run.
- Retrieval is **permission-scoped** — a user's question can only pull
  context from documents they're actually allowed to see. Previously the
  index covered every file in `uploads/` regardless of whether it was
  private or shared with someone else.
- Scanned/image-based PDFs now fall back to **OCR** (Tesseract) when
  there's no extractable text layer, instead of silently returning
  nothing.
- Default model is **`qwen2.5:7b-instruct`** via Ollama (see below).

## AI model

Runs fully on-prem via [Ollama](https://ollama.com) — no document content
ever leaves your server. This matters here specifically because the
library holds internal policy and HR documents.

```bash
# On the server:
ollama pull qwen2.5:7b-instruct
ollama serve
```

**Server sizing** (discussed and agreed on with you directly):
- CPU-only: 4+ cores, 16GB RAM — a few seconds per answer, fine for
  occasional internal use.
- With a GPU (8GB+ VRAM): 1-3 seconds per answer — worth it if the
  assistant will see regular use.

The model name is a config value (`DOCINTEL_AI_MODEL` env var, in
`backend/app/config.py`), not hardcoded — drop to a lighter model
(`qwen2.5:3b-instruct`) if the server ends up smaller than planned, or
point it at a hosted API later, without touching the service code.

## Setup

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

**OCR dependency** (for scanned PDFs) — install Tesseract separately, it's
not a Python package:
```bash
# Ubuntu/Debian
sudo apt install tesseract-ocr
# macOS
brew install tesseract
```

Create the first admin account:
```bash
python -m app.create_admin
```

Run the server:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev -- --host
```

## HTTPS

For local development, plain HTTP is fine. For real deployment:

**Simplest option — put Nginx or Caddy in front of both services** and let
it handle TLS termination. Caddy in particular gets you free automatic
HTTPS with a real domain in about 5 lines of config:
```
docintel.yourministry.gov.zw {
    reverse_proxy /api/* localhost:8000
    reverse_proxy /* localhost:5173
}
```

**Self-signed cert for internal-network-only deployment** (no public
domain): generate a cert and pass it to uvicorn directly:
```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
uvicorn app.main:app --host 0.0.0.0 --port 8000 --ssl-keyfile key.pem --ssl-certfile cert.pem
```

Either way, set `VITE_API_URL` in the frontend to the `https://` address
once TLS is in front of the backend.

## Admin vs. employee

Role lives in the JWT issued at login. The sidebar only *shows* the
admin section to admins, but the actual boundary is server-side: every
`/api/admin/*` route depends on `require_admin` and returns 403 for
anyone else, regardless of what the frontend renders.

## Editing documents (departments and versions)

**Departments.** Departments are a managed list (Admin > Manage users >
Departments), seeded with ICT, Accounts, HR and Gender. Every user is
assigned one when their account is created, from a dropdown, so spelling
can never drift. Department only affects *editing*; it has nothing to do
with the Admin / Manager / Employee role.

**Who can edit what**

| Document type | Who can save a new version |
|---|---|
| Library | The uploader, an Admin, or anyone in the **same department** as the document |
| Private | The uploader, an Admin, and the people the uploader authorized |
| Sent | The uploader (sender), an Admin, and the people it was sent to |

A document's department is stamped when it is uploaded (the uploader's
department at that moment), so it stays put if the uploader later moves.
Department plays no part for private or sent documents - a file sent to
one person in HR does not become editable by all of HR.

**Editing is versioned, never an overwrite.** Download the current version,
edit it, then use *Upload new version* in the document pane. The new file
must be the same type as the original. Every earlier version is kept and
can be downloaded from *Version history*. Only the uploader or an Admin can
*Restore* an earlier version, and restoring saves it as a new version so
nothing is lost.

- If someone else saved a newer version while you were editing, your upload
  is refused with a clear message instead of overwriting their work.
- For private and sent documents, everyone else with access gets an
  "edited" notice in their Inbox.
- Each save re-indexes the document, so the AI assistant answers from the
  latest text.
- Edits and restores appear in the Access logs as `EDIT` and `RESTORE`.

**Upgrading an existing database.** Nothing to run by hand. On the first
start, the new columns and tables are added in place, the department list
is built from the defaults plus any departments your users already have,
existing documents take their uploader's department, and every existing
document gets a version 1. Back up `backend/app/storage/` first as usual.

## Notes

- `backend/app/storage/` holds the SQLite database and uploaded files —
  back this up; it's the entire system's data.
- The embedding model (`all-MiniLM-L6-v2`, via sentence-transformers)
  downloads automatically on first run and needs internet access once,
  even though the LLM itself stays local via Ollama.
