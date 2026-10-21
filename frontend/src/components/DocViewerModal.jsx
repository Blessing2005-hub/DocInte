import { useState } from 'react';
import { api } from '../api/client';
import DocPreview from './DocPreview';
import NewVersionModal from './NewVersionModal';
import VersionHistoryModal from './VersionHistoryModal';
import ManageAccessModal from './ManageAccessModal';

// Everything you can do with one document opened from a conversation.
export default function DocViewerModal({ row, onClose, onChanged }) {
  const [saved, setSaved] = useState(!!row.saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAccess, setShowAccess] = useState(false);

  async function download() {
    setError(null);
    try {
      await api.downloadDocument(row.documentId, row.filename);
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleSave() {
    setBusy(true);
    setError(null);
    try {
      if (saved) await api.unsaveDocument(row.documentId);
      else await api.saveDocument(row.documentId);
      setSaved(!saved);
      setNotice(saved ? 'Removed from My Documents.' : 'Saved to My Documents.');
      onChanged && onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dv-overlay" onClick={onClose}>
      <div className="dv-modal card" onClick={(e) => e.stopPropagation()}>
        <div className="dv-head">
          <div className="dv-title">
            <h2>{row.filename}</h2>
            <span>{row.department ? `${row.department} · ` : ''}version {row.version}</span>
          </div>
          <button className="dv-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <DocPreview key={`${row.documentId}-${row.version}`} row={row} />

        {error && <p className="dv-error">{error}</p>}
        {notice && <p className="dv-ok">{notice}</p>}

        <div className="dv-actions">
          <button className="btn btn-primary" onClick={download}>Download</button>
          {!row.isOwn && (
            <button className="btn btn-secondary" onClick={toggleSave} disabled={busy}>
              {saved ? '✓ Saved to My Documents' : 'Save to My Documents'}
            </button>
          )}
          {row.canEdit && <button className="btn btn-secondary" onClick={() => setShowNew(true)}>Upload new version</button>}
          {row.version > 1 && (
            <button className="btn btn-secondary" onClick={() => setShowHistory(true)}>Version history</button>
          )}
          {row.canManageAccess && <button className="btn btn-secondary" onClick={() => setShowAccess(true)}>Manage access</button>}
        </div>
      </div>

      {showNew && (
        <NewVersionModal
          row={row}
          onClose={() => setShowNew(false)}
          onSaved={(u) => { setNotice(`Saved as version ${u.version}.`); onChanged && onChanged(); }}
          onStale={() => onChanged && onChanged()}
        />
      )}
      {showHistory && (
        <VersionHistoryModal row={row} onClose={() => setShowHistory(false)} onChanged={() => onChanged && onChanged()} />
      )}
      {showAccess && (
        <ManageAccessModal
          row={row}
          onClose={() => setShowAccess(false)}
          onSaved={() => { setNotice('Access updated.'); onChanged && onChanged(); }}
        />
      )}

      <style>{`
        .dv-overlay { position: fixed; inset: 0; background: rgba(30,36,31,0.4); z-index: 40; display: flex;
          align-items: center; justify-content: center; padding: 16px; }
        .dv-modal { width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; padding: 18px; background: var(--surface); }
        .dv-head { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 12px; }
        .dv-title { flex: 1; min-width: 0; }
        .dv-title h2 { font-size: 16px; word-break: break-word; }
        .dv-title span { font-size: 12px; color: var(--text-tertiary); }
        .dv-x { border: 0; background: none; font-size: 16px; cursor: pointer; color: var(--text-secondary); padding: 4px; }
        .dv-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
        .dv-error { color: var(--danger); font-size: 13px; margin-top: 10px; }
        .dv-ok { color: var(--accent); font-size: 13px; margin-top: 10px; }
      `}</style>
    </div>
  );
}
