import { useEffect, useRef, useState } from 'react';

const BASE_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;

function kindOf(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext)) return 'image';
  if (['txt', 'csv', 'md', 'json', 'log'].includes(ext)) return 'text';
  if (ext === 'docx') return 'docx';
  return 'none';
}

const MIME = { pdf: 'application/pdf' };

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

function PreviewWindow({ row, kind, onClose }) {
  const [state, setState] = useState(kind === 'none' ? 'unsupported' : 'loading'); // loading | ready | error | unsupported
  const [url, setUrl] = useState(null);
  const [text, setText] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const docxRef = useRef(null);

  useEffect(() => {
    if (kind === 'none') return undefined;
    let revoked = false;
    let objectUrl = null;
    (async () => {
      try {
        const token = localStorage.getItem('docintel_token');
        const res = await fetch(`${BASE_URL}/api/documents/${row.documentId}/download`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Could not load this document.');
        const blob = await res.blob();
        if (revoked) return;
        if (kind === 'text') {
          setText(await blob.text());
        } else if (kind === 'docx') {
          const { renderAsync } = await import('docx-preview');
          setState('ready'); // show the container first so it exists
          await new Promise((r) => setTimeout(r, 0));
          if (docxRef.current) {
            docxRef.current.innerHTML = '';
            await renderAsync(blob, docxRef.current, undefined, { inWrapper: true, ignoreWidth: false });
          }
          return;
        } else {
          objectUrl = URL.createObjectURL(MIME[kind] ? new Blob([blob], { type: MIME[kind] }) : blob);
          setUrl(objectUrl);
        }
        setState('ready');
      } catch (e) {
        if (!revoked) {
          setErrMsg(e.message || 'Preview failed.');
          setState('error');
        }
      }
    })();
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [row.documentId, row.version, kind]);

  return (
    <div className="pv-overlay" onClick={onClose}>
      <div className="pv-window" onClick={(e) => e.stopPropagation()}>
        <div className="pv-head">
          <span className="pv-title">{row.filename}</span>
          <button className="pv-close" onClick={onClose}>Close</button>
        </div>
        <div className="pv-body">
          {state === 'loading' && <p className="pv-msg">Loading preview…</p>}
          {state === 'error' && <p className="pv-msg">{errMsg}</p>}
          {state === 'unsupported' && <p className="pv-msg">A preview isn't available for this file type yet. Use Download to open it.</p>}
          {kind === 'pdf' && url && <iframe title="Preview" src={url} className="pv-frame" />}
          {kind === 'image' && url && <img alt={row.filename} src={url} className="pv-img" />}
          {kind === 'text' && state === 'ready' && <pre className="pv-text">{text}</pre>}
          {kind === 'docx' && <div ref={docxRef} className="pv-docx" />}
        </div>
      </div>
      <style>{`
        .pv-overlay { position: fixed; inset: 0; background: rgba(30,36,31,0.55); z-index: 80; display: flex; align-items: center; justify-content: center; padding: 14px; }
        .pv-window { width: 100%; max-width: 980px; height: 100%; max-height: 92vh; background: var(--surface); border-radius: 14px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
        .pv-head { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--border); }
        .pv-title { flex: 1; min-width: 0; font-weight: 600; font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pv-close { height: 34px; padding: 0 16px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); font-weight: 600; cursor: pointer; }
        .pv-body { flex: 1; min-height: 0; overflow: auto; background: var(--surface-alt); }
        .pv-msg { padding: 40px 20px; text-align: center; color: var(--text-tertiary); font-size: 13px; }
        .pv-frame { width: 100%; height: 100%; border: 0; background: white; }
        .pv-img { display: block; max-width: 100%; margin: 0 auto; }
        .pv-text { padding: 16px; font-size: 12.5px; white-space: pre-wrap; word-break: break-word; }
        .pv-docx { padding: 8px 0; }
        .pv-docx .docx-wrapper { background: transparent !important; padding: 8px !important; }
        @media (max-width: 768px) { .pv-overlay { padding: 0; } .pv-window { border-radius: 0; max-height: 100vh; } }
      `}</style>
    </div>
  );
}
