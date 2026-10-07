import { useState } from 'react';
import { api } from '../api/client';

export default function NewVersionModal({ row, onClose, onSaved, onStale }) {
  const [file, setFile] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // Once the server says the document moved on, saving this file would
  // overwrite someone else's changes, so the form stays locked.
  const [stale, setStale] = useState(false);

  async function handleSave() {
    if (!file) {
      setError('Choose the edited file first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await api.uploadVersion(row.documentId, file, row.version, note);
      onSaved && onSaved(updated);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save the new version.');
      if (err.status === 409) {
        setStale(true);
        onStale && onStale();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ver-overlay" onClick={onClose}>
      <div className="ver-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Upload new version">
        <h2>Upload new version</h2>
        <p className="ver-sub">
          {row.filename} is at version {row.version}. Download it, make your changes, then upload the edited file here.
          The current version is kept in the history.
        </p>

        <div className="field">
          <label>Edited file ({row.fileType || 'same type as the original'})</label>
          <input
            type="file"
            accept={row.fileType || undefined}
            disabled={stale}
            onChange={(e) => setFile(e.target.files[0] || null)}
          />
        </div>

        <div className="field">
          <label>What did you change? (optional)</label>
          <textarea
            value={note}
            maxLength={500}
            disabled={stale}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Updated the leave policy in section 4"
          />
        </div>

        {error && <p className="ver-error">{error}</p>}

        <div className="ver-actions">
          <button className="btn btn-secondary" onClick={onClose}>{stale ? 'Close' : 'Cancel'}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={busy || stale}>
            {busy ? 'Uploading…' : 'Upload version'}
          </button>
        </div>
      </div>

      <style>{`
        .ver-overlay { position: fixed; inset: 0; background: rgba(30,36,31,0.4); display: flex; align-items: center; justify-content: center; z-index: 50; }
        .ver-modal { width: 480px; max-width: 92vw; max-height: 90vh; overflow-y: auto; background: var(--surface); border-radius: 16px; padding: 28px; box-shadow: 0 20px 60px rgba(0,0,0,0.25); }
        .ver-modal h2 { font-size: 18px; margin-bottom: 6px; }
        .ver-sub { color: var(--text-secondary); font-size: 13px; margin-bottom: 20px; }
        .ver-actions { display: flex; gap: 10px; margin-top: 6px; }
        .ver-actions .btn { flex: 1; }
        .ver-error { color: var(--danger); font-size: 12.5px; margin-bottom: 12px; }
      `}</style>
    </div>
  );
}
