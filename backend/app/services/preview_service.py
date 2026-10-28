"""
Builds a simple, safe preview of PDF / Word / Excel / PowerPoint files on the server
(phone browsers can't open those themselves). Returns plain data; the page draws it.
Old-format files (.doc, .xls, .ppt) can't be read this way.
"""
MAX_SHEETS = 6
MAX_ROWS = 200
MAX_COLS = 30
MAX_SLIDES = 80
MAX_PDF_PAGES = 40
MAX_TEXT = 200_000


class PreviewUnavailable(Exception):
    pass


def _cell(v):
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)[:200]


def preview_xlsx(path: str) -> dict:
    from openpyxl import load_workbook

    wb = load_workbook(path, read_only=True, data_only=True)
    try:
        sheets = []
        for ws in wb.worksheets[:MAX_SHEETS]:
            rows = []
            truncated = False
            for i, row in enumerate(ws.iter_rows(values_only=True)):
                if i >= MAX_ROWS:
                    truncated = True
                    break
                cells = [_cell(v) for v in list(row)[:MAX_COLS]]
                while cells and cells[-1] == "":
                    cells.pop()
                rows.append(cells)
            while rows and not rows[-1]:
                rows.pop()
            sheets.append({"name": ws.title, "rows": rows, "truncated": truncated})
        return {"kind": "sheets", "sheets": sheets, "more_sheets": len(wb.worksheets) > MAX_SHEETS}
    finally:
        wb.close()


def preview_pptx(path: str) -> dict:
    from pptx import Presentation

    prs = Presentation(path)
    slides = []
    for n, slide in enumerate(prs.slides, start=1):
        if n > MAX_SLIDES:
            break
        lines = []
        for shape in slide.shapes:
            if getattr(shape, "has_text_frame", False) and shape.has_text_frame:
                for p in shape.text_frame.paragraphs:
                    t = "".join(r.text for r in p.runs).strip()
                    if t:
                        lines.append(t)
            if getattr(shape, "has_table", False) and shape.has_table:
                for row in shape.table.rows:
                    lines.append(" | ".join(c.text.strip() for c in row.cells))
        slides.append({"number": n, "lines": lines})
    return {"kind": "slides", "slides": slides, "more": len(prs.slides) > MAX_SLIDES}


def preview_docx_blocks(path: str) -> dict:
    """Headings, paragraphs, bullet items and tables, kept in their original order."""
    from docx import Document
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    doc = Document(path)
    blocks = []
    total = 0
    for child in doc.element.body.iterchildren():
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "p":
            p = Paragraph(child, doc)
            text = p.text.strip()
            if not text:
                continue
            style = (p.style.name if p.style is not None else "") or ""
            if style.startswith("Heading") or style == "Title":
                digits = "".join(ch for ch in style if ch.isdigit())
                level = min(max(int(digits), 1), 3) if digits else 1
                blocks.append({"type": "heading", "level": level, "text": text})
            elif style.startswith("List"):
                blocks.append({"type": "bullet", "text": text})
            else:
                blocks.append({"type": "p", "text": text})
            total += len(text)
        elif tag == "tbl":
            table = Table(child, doc)
            rows = []
            for row in table.rows:
                cells = []
                seen = set()
                for c in row.cells:
                    if id(c._tc) in seen:   # merged cells repeat; show once
                        continue
                    seen.add(id(c._tc))
                    cells.append(c.text.strip()[:200])
                rows.append(cells)
            blocks.append({"type": "table", "rows": rows[:100]})
        if total > MAX_TEXT or len(blocks) > 3000:
            break
    return {"kind": "doc", "blocks": blocks}


def _pdf_module():
    try:
        import pymupdf as m   # current name
        return m
    except ImportError:
        import fitz as m      # older name
        return m


def preview_pdf(path: str) -> dict:
    m = _pdf_module()
    doc = m.open(path)
    try:
        total = len(doc)
    finally:
        doc.close()
    return {"kind": "pdf", "pages": min(total, MAX_PDF_PAGES), "total": total}


def render_pdf_page(path: str, index: int) -> bytes:
    """One PDF page as a PNG picture (index starts at 0)."""
    m = _pdf_module()
    doc = m.open(path)
    try:
        if index < 0 or index >= min(len(doc), MAX_PDF_PAGES):
            raise PreviewUnavailable("No such page.")
        pix = doc[index].get_pixmap(matrix=m.Matrix(1.4, 1.4))
        return pix.tobytes("png")
    finally:
        doc.close()


LEGACY_EXTS = (".doc", ".xls", ".ppt")


def pdf_source(path: str, ext: str):
    """The PDF to draw pages from: the file itself, or a LibreOffice copy of an old-format file."""
    ext = (ext or "").lower()
    if ext == ".pdf":
        return path
    if ext in LEGACY_EXTS:
        from app.services import convert_service
        if convert_service.available():
            return convert_service.to_pdf(path)
    return None


def build_preview(path: str, ext: str) -> dict:
    ext = (ext or "").lower()
    if ext in LEGACY_EXTS:
        try:
            converted = pdf_source(path, ext)
        except Exception as exc:
            raise PreviewUnavailable("This old-format file couldn't be converted for preview. Download it to open it.") from exc
        if converted:
            return preview_pdf(converted)
    try:
        if ext == ".xlsx":
            return preview_xlsx(path)
        if ext == ".pptx":
            return preview_pptx(path)
        if ext == ".docx":
            return preview_docx_blocks(path)
        if ext == ".pdf":
            return preview_pdf(path)
    except Exception as exc:  # corrupt or unusual file
        raise PreviewUnavailable("This file couldn't be read for preview. Download it to open it.") from exc
    raise PreviewUnavailable(
        "Old-format files (.doc, .xls, .ppt) can't be previewed. Download it, or re-save it as "
        ".docx / .xlsx / .pptx and upload that."
    )
