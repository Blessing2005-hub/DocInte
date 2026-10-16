"""
Builds a simple, safe preview of Word / Excel / PowerPoint files on the server
(the browser can't open those itself). Returns plain data; the page draws it.
Old-format files (.doc, .xls, .ppt) can't be read this way.
"""
MAX_SHEETS = 6
MAX_ROWS = 200
MAX_COLS = 30
MAX_SLIDES = 80
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


def preview_docx_text(path: str) -> dict:
    from docx import Document

    doc = Document(path)
    parts = [p.text for p in doc.paragraphs if p.text.strip()]
    for table in doc.tables:
        for row in table.rows:
            parts.append(" | ".join(c.text.strip() for c in row.cells))
    return {"kind": "text", "text": "\n\n".join(parts)[:MAX_TEXT]}


def build_preview(path: str, ext: str) -> dict:
    ext = (ext or "").lower()
    try:
        if ext == ".xlsx":
            return preview_xlsx(path)
        if ext == ".pptx":
            return preview_pptx(path)
        if ext == ".docx":
            return preview_docx_text(path)
    except Exception as exc:  # corrupt or unusual file
        raise PreviewUnavailable("This file couldn't be read for preview. Download it to open it.") from exc
    raise PreviewUnavailable(
        "Old-format files (.doc, .xls, .ppt) can't be previewed. Download it, or re-save it as "
        ".docx / .xlsx / .pptx and upload that."
    )
