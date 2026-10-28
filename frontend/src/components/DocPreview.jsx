import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const BASE_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;

export function kindOf(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext)) return 'image';
  if (['txt', 'csv', 'md', 'json', 'log'].includes(ext)) return 'text';
  // PDF, Word, Excel and PowerPoint are read on the server, so they also work on phones.
  if (['pdf', 'docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt'].includes(ext)) return 'server';
  return 'none';
}

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('docintel_token')}` };
}

async function loadServerPreview(documentId) {
  const res = await fetch(`${BASE_URL}/api/documents/${documentId}/preview-data`, { headers: authHeaders() });
  if (!res.ok) {
    let detail = 'Could not load a preview.';
    try { detail = (await res.json()).detail || detail; } catch { /* ignore */ }
    throw new Error(detail);
  }
  return res.json();
}

export default function DocPreview({ row }) {
  const [open, setOpen] = useState(false);
  const kind = kindOf(row.filename);

  return (
    <>
      <button className="preview-card" onClick={() => setOpen(true)}>
        <span className="preview-card-icon">👁</span>
        <span>Preview document</span>
        <small>{kind === 'none' ? 'Not available for this file type' : 'Opens in a viewer'}</small>
      </button>
      {open && <PreviewWindow row={row} kind={kind} onClose={() => setOpen(false)} />}
      <style>{`
        .preview-card { width: 100%; height: 110px; border-radius: 10px; background: var(--surface-alt); border: 1px solid var(--border);
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; cursor: pointer;
          color: var(--text-secondary); font-size: 13px; font-weight: 600; margin-bottom: 18px; }
        .preview-card:hover { border-color: var(--accent); }
        .preview-card small { font-weight: 400; font-size: 11.5px; color: var(--text-tertiary); }
        .preview-card-icon { font-size: 20px; }
      `}</style>
    </>
  );
}

function SheetsView({ data }) {
  const [tab, setTab] = useState(0);
  const sheet = data.sheets[tab] || { rows: [] };
  const width = Math.max(1, ...sheet.rows.map((r) => r.length));
  return (
    <div className="pv-sheets">
      <div className="pv-tabs">
        {data.sheets.map((s, i) => (
          <button key={i} className={i === tab ? 'on' : ''} onClick={() => setTab(i)}>{s.name}</button>
        ))}
      </div>
      {sheet.rows.length === 0 ? (
        <p className="pv-msg">This sheet is empty.</p>
      ) : (
        <div className="pv-table-wrap">
          <table className="pv-table">
            <tbody>
              {sheet.rows.map((r, ri) => (
                <tr key={ri}>
                  {Array.from({ length: width }).map((_, ci) => (
                    <td key={ci}>{r[ci] ?? ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(sheet.truncated || data.more_sheets) && (
        <p className="pv-note">Showing the first part only{data.more_sheets ? ' (and the first sheets)' : ''}. Download to see everything.</p>
      )}
    </div>
  );
}

function SlidesView({ data }) {
  return (
    <div className="pv-slides">
      {data.slides.map((s) => (
        <div key={s.number} className="pv-slide">
          <div className="pv-slide-no">Slide {s.number}</div>
          {s.lines.length === 0 ? <p className="pv-faint">(no text on this slide)</p> : s.lines.map((l, i) => <p key={i}>{l}</p>)}
        </div>
      ))}
      {data.more && <p className="pv-note">Showing the first slides only. Download to see everything.</p>}
    </div>
  );
}

function PdfPage({ documentId, number }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);
  const holder = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;
    const node = holder.current;

    async function load() {
      try {
        const res = await fetch(`${BASE_URL}/api/documents/${documentId}/preview-page/${number}`, { headers: authHeaders() });
        if (!res.ok) throw new Error('page');
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    // Draw each page only when it scrolls near the screen.
    let observer = null;
    if (node && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          load();
        }
      }, { rootMargin: '600px' });
      observer.observe(node);
    } else {
      load();
    }
    return () => {
      cancelled = true;
      if (observer) observer.disconnect();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId, number]);

  return (
    <div ref={holder} className="pv-pdfpage">
      {src ? <img src={src} alt={`Page ${number}`} /> : <div className="pv-pdfwait">{failed ? `Page ${number} could not be drawn` : `Page ${number}…`}</div>}
    </div>
  );
}

function PdfView({ documentId, data }) {
  return (
    <div className="pv-pdf">
      {Array.from({ length: data.pages }).map((_, i) => <PdfPage key={i} documentId={documentId} number={i + 1} />)}
      {data.total > data.pages && <p className="pv-note">Showing the first {data.pages} of {data.total} pages. Download to see everything.</p>}
    </div>
  );
}

function DocView({ data }) {
  return (
    <div className="pv-doc">
      {data.blocks.length === 0 && <p className="pv-faint">(This document has no readable text.)</p>}
      {data.blocks.map((b, i) => {
        if (b.type === 'heading') {
          const Tag = `h${Math.min(b.level + 1, 4)}`;
          return <Tag key={i}>{b.text}</Tag>;
        }
        if (b.type === 'bullet') return <p key={i} className="pv-bullet">• {b.text}</p>;
        if (b.type === 'table') {
          return (
            <div key={i} className="pv-table-wrap pv-inline">
              <table className="pv-table">
                <tbody>
                  {b.rows.map((r, ri) => (
                    <tr key={ri}>{r.map((c, ci) => <td key={ci}>{c}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return <p key={i}>{b.text}</p>;
      })}
    </div>
  );
}

// The big document window: preview fills the space, details sit in the header and
// the actions stay pinned at the bottom, so nothing needs scrolling to be found.
// `actions` is a list of { label, onClick, kind: 'primary' | 'plain' | 'danger', disabled }.
export function PreviewWindow({ row, kind: kindProp, onClose, meta, message, notice, error, actions = [] }) {
  const kind = kindProp || kindOf(row.filename);
  const [state, setState] = useState(kind === 'none' ? 'unsupported' : 'loading'); // loading | ready | error | unsupported
  const [url, setUrl] = useState(null);
  const [text, setText] = useState('');
  const [server, setServer] = useState(null);
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    if (kind === 'none') return undefined;
    let cancelled = false;
    let objectUrl = null;

    (async () => {
      try {
        if (kind === 'server') {
          const data = await loadServerPreview(row.documentId);
          if (cancelled) return;
          setServer(data);
          setState('ready');
          return;
        }
        const res = await fetch(`${BASE_URL}/api/documents/${row.documentId}/download?preview=true`, { headers: authHeaders() });
        if (!res.ok) throw new Error('Could not load this document.');
        const blob = await res.blob();
        if (cancelled) return;
        if (kind === 'text') {
          setText(await blob.text());
        } else {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
        setState('ready');
      } catch (e) {
        if (!cancelled) {
          setErrMsg(e.message || 'Preview failed.');
          setState('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [row.documentId, row.version, kind]);

  return createPortal(
    <div className="pv-overlay" onClick={onClose}>
      <div className="pv-window" onClick={(e) => e.stopPropagation()}>
        <div className="pv-head">
          <div className="pv-titles">
            <span className="pv-title">{row.filename}</span>
            {meta && <span className="pv-meta">{meta}</span>}
          </div>
          <button className="pv-close" onClick={onClose}>Close</button>
        </div>
        {(message || notice || error) && (
          <div className="pv-strip">
            {message && <span className="pv-strip-msg">"{message}"</span>}
            {notice && <span className="pv-strip-ok">{notice}</span>}
            {error && <span className="pv-strip-err">{error}</span>}
          </div>
        )}
        <div className="pv-body">
          {state === 'loading' && <p className="pv-msg">Loading preview…</p>}
          {state === 'error' && <p className="pv-msg">{errMsg}</p>}
          {state === 'unsupported' && <p className="pv-msg">A preview isn't available for this file type. Use Download to open it.</p>}
          {kind === 'image' && url && <img alt={row.filename} src={url} className="pv-img" />}
          {kind === 'text' && state === 'ready' && <pre className="pv-text">{text}</pre>}
          {server && server.kind === 'pdf' && <PdfView documentId={row.documentId} data={server} />}
          {server && server.kind === 'doc' && <DocView data={server} />}
          {server && server.kind === 'sheets' && <SheetsView data={server} />}
          {server && server.kind === 'slides' && <SlidesView data={server} />}
        </div>
        {actions.length > 0 && (
          <div className="pv-actions">
            {actions.map((a) => (
              <button key={a.label} type="button" className={`pv-btn ${a.kind || 'plain'}`} onClick={a.onClick} disabled={a.disabled}>
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <style>{`
        .pv-overlay { position: fixed; inset: 0; background: rgba(30,36,31,0.55); z-index: 80; display: flex; align-items: center; justify-content: center; padding: 14px; }
        .pv-window { width: 100%; max-width: 980px; height: 100%; max-height: 92vh; background: var(--surface); border-radius: 14px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
        .pv-head { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--border); }
        .pv-titles { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .pv-meta { font-size: 12px; color: var(--text-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pv-strip { display: flex; flex-wrap: wrap; gap: 4px 14px; padding: 8px 16px; font-size: 12.5px; background: var(--surface); border-bottom: 1px solid var(--border); }
        .pv-strip-msg { font-style: italic; color: var(--text-secondary); }
        .pv-strip-ok { color: var(--accent); }
        .pv-strip-err { color: var(--danger); }
        .pv-actions { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 16px; border-top: 1px solid var(--border); background: var(--surface); }
        .pv-btn { height: 36px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface);
          font-weight: 600; font-size: 12.5px; cursor: pointer; color: var(--text-primary); }
        .pv-btn:hover { background: var(--surface-alt); }
        .pv-btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
        .pv-btn.primary:hover { background: var(--accent-hover); }
        .pv-btn.danger { color: var(--danger); border-color: var(--danger-bg); margin-left: auto; }
        .pv-btn:disabled { opacity: 0.55; cursor: default; }
        .pv-title { flex: 1; min-width: 0; font-weight: 600; font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pv-close { height: 34px; padding: 0 16px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); font-weight: 600; cursor: pointer; }
        .pv-body { flex: 1; min-height: 0; overflow: auto; background: var(--surface-alt); }
        .pv-msg { padding: 40px 20px; text-align: center; color: var(--text-tertiary); font-size: 13px; }
        .pv-note { padding: 10px 16px; font-size: 12px; color: var(--text-tertiary); }
        .pv-faint { color: var(--text-tertiary); font-size: 12.5px; }
        .pv-frame { width: 100%; height: 100%; border: 0; background: white; }
        .pv-img { display: block; max-width: 100%; margin: 0 auto; }
        .pv-text { padding: 16px; font-size: 12.5px; white-space: pre-wrap; word-break: break-word; font-family: inherit; line-height: 1.6; }
        .pv-pdf { padding: 10px; display: flex; flex-direction: column; gap: 10px; align-items: center; }
        .pv-pdfpage { width: 100%; max-width: 820px; min-height: 200px; background: #fff; border: 1px solid var(--border); box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
        .pv-pdfpage img { display: block; width: 100%; height: auto; }
        .pv-pdfwait { padding: 80px 16px; text-align: center; color: var(--text-tertiary); font-size: 12.5px; }
        .pv-doc { max-width: 820px; margin: 12px auto; background: var(--surface); padding: 22px 26px; border: 1px solid var(--border); border-radius: 8px; line-height: 1.65; font-size: 14px; }
        .pv-doc p { margin: 0 0 10px; overflow-wrap: anywhere; }
        .pv-doc h2 { font-size: 20px; margin: 18px 0 8px; } .pv-doc h3 { font-size: 17px; margin: 16px 0 6px; } .pv-doc h4 { font-size: 15px; margin: 14px 0 6px; }
        .pv-bullet { padding-left: 14px; }
        .pv-inline { margin: 8px 0 14px; }
        .pv-tabs { display: flex; gap: 6px; padding: 10px 12px 0; flex-wrap: wrap; position: sticky; left: 0; }
        .pv-tabs button { border: 1px solid var(--border); background: var(--surface); border-radius: 8px 8px 0 0; padding: 6px 14px; font-size: 12.5px; cursor: pointer; }
        .pv-tabs button.on { background: var(--accent); color: #fff; border-color: var(--accent); }
        .pv-table-wrap { overflow: auto; background: var(--surface); margin: 0 12px 12px; border: 1px solid var(--border); }
        .pv-table { border-collapse: collapse; font-size: 12.5px; }
        .pv-table td { border: 1px solid var(--border); padding: 5px 10px; white-space: nowrap; max-width: 280px; overflow: hidden; text-overflow: ellipsis; }
        .pv-table tr:first-child td { font-weight: 600; background: var(--surface-alt); }
        .pv-slides { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
        .pv-slide { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }
        .pv-slide p { font-size: 13.5px; line-height: 1.6; margin: 2px 0; }
        .pv-slide-no { font-size: 11px; font-weight: 700; color: var(--accent); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
        @media (max-width: 768px) { .pv-overlay { padding: 0; } .pv-window { border-radius: 0; max-height: 100vh; max-height: 100dvh; } .pv-actions { padding: 8px 10px; gap: 6px; } .pv-btn { height: 34px; padding: 0 10px; font-size: 12px; } .pv-btn.danger { margin-left: 0; } }
      `}</style>
    </div>,
    document.body
  );
}
