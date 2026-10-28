# DocIntel API. Build from the backend folder:  docker build -t docintel-api ./backend
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

# LibreOffice lets the app preview old .doc / .xls / .ppt files; tesseract reads scanned pages.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libreoffice-writer libreoffice-calc libreoffice-impress \
        fonts-liberation fonts-dejavu-core tesseract-ocr curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# INSTALL_AI=true also installs the AI assistant's libraries (large; needs a strong server and Ollama).
ARG INSTALL_AI=false
COPY requirements.txt requirements-render.txt ./
RUN if [ "$INSTALL_AI" = "true" ]; then pip install --no-cache-dir -r requirements.txt; \
    else pip install --no-cache-dir -r requirements-render.txt; fi \
    && pip install --no-cache-dir sentry-sdk

COPY app ./app

# Uploaded files and previews live in /data: mount a volume or disk there.
RUN useradd -m -u 10001 docintel && mkdir -p /data && chown -R docintel:docintel /data /app
ENV DOCINTEL_STORAGE_DIR=/data HOME=/home/docintel
USER docintel

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s \
    CMD curl -fsS "http://localhost:${PORT:-8000}/api/health" || exit 1

# One worker on purpose: the login-attempt limit is kept in memory.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --proxy-headers --forwarded-allow-ips='*'"]
