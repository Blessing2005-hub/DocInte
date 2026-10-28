"""
Turns old-format Office files (.doc, .xls, .ppt) into PDF with LibreOffice, so
they can be previewed like any PDF. LibreOffice is installed in the Docker image
(see backend/Dockerfile); where it is not installed, `available()` is False and
the preview simply says to download the file.

Converted files are cached next to the uploads, so each file is converted once.
"""
import os
import shutil
import subprocess
import tempfile
import threading

from app.config import STORAGE_DIR

CACHE_DIR = os.path.join(STORAGE_DIR, "preview_cache")
TIMEOUT_SECONDS = 90

# LibreOffice is heavy: convert one file at a time so a burst of previews
# can't use all of the server's memory.
_gate = threading.Semaphore(1)


class ConversionError(Exception):
    pass


def _binary():
    return shutil.which("soffice") or shutil.which("libreoffice")


def available() -> bool:
    return _binary() is not None


def _cache_path(source_path: str) -> str:
    base = os.path.splitext(os.path.basename(source_path))[0]
    return os.path.join(CACHE_DIR, base + ".pdf")


def to_pdf(source_path: str) -> str:
    """Path of a PDF copy of `source_path`, converting it first if needed."""
    binary = _binary()
    if not binary:
        raise ConversionError("LibreOffice is not installed on this server.")

    target = _cache_path(source_path)
    if os.path.exists(target) and os.path.getmtime(target) >= os.path.getmtime(source_path):
        return target

    os.makedirs(CACHE_DIR, exist_ok=True)
    with _gate:
        if os.path.exists(target):  # another request finished it while we waited
            return target
        with tempfile.TemporaryDirectory(prefix="docintel_lo_") as work:
            # A private profile per run avoids "already running" lock clashes.
            profile = os.path.join(work, "profile")
            out_dir = os.path.join(work, "out")
            os.makedirs(out_dir)
            cmd = [
                binary,
                f"-env:UserInstallation=file://{profile}",
                "--headless", "--norestore", "--nolockcheck",
                "--convert-to", "pdf", "--outdir", out_dir, source_path,
            ]
            try:
                subprocess.run(cmd, check=True, timeout=TIMEOUT_SECONDS,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except subprocess.TimeoutExpired as exc:
                raise ConversionError("Converting this file took too long.") from exc
            except (subprocess.CalledProcessError, OSError) as exc:
                raise ConversionError("This file could not be converted.") from exc

            produced = os.path.join(out_dir, os.path.splitext(os.path.basename(source_path))[0] + ".pdf")
            if not os.path.exists(produced):
                raise ConversionError("This file could not be converted.")
            shutil.move(produced, target)
    return target


def drop_cached(source_path: str) -> None:
    """Remove the cached PDF for a file that is being deleted."""
    try:
        os.remove(_cache_path(source_path))
    except OSError:
        pass
