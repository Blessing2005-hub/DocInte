import { useState } from 'react';
import { api } from '../api/client';

export default function UploadModal({ onClose, onUploaded }) {
  const [mode, setMode] = useState(null); // library | private | send
  const [file, setFile] = useState(null);
  const [authorizedUsernames, setAuthorizedUsernames] = useState('');
  const [receiverUsername, setReceiverUsername] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleUpload() {
    if (!file) {
      setError('Choose a file first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === 'send') {
        if (!receiverUsername.trim()) {
          setError('Enter a receiver username.');
          setBusy(false);
          return;
        }
        await api.sendDocument(file, receiverUsername, message);
      } else {
        await api.uploadDocument(file, mode, authorizedUsernames);
      }
      onUploaded && onUploaded();
      onClose();
    } catch (err) {
      setError(err.message || 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {!mode ? (
          <>
            <h2>Upload a document</h2>
            <p className="modal-sub">Choose where this document should go.</p>
            <div className="mode-grid">
              <button className="mode-card" onClick={() => setMode('library')}>
                <span className="mode-icon">📚</span>
                <span className="mode-title">Shared Library</span>
                <span className="mode-desc">Visible to everyone in the organization</span>
              </button>
              <button className="mode-card" onClick={() => setMode('private')}>
                <span className="mode-icon">🔒</span>
                <span className="mode-title">Private</span>
                <span className="mode-desc">Only you and specific people you choose</span>
              </button>
              <button className="mode-card" onClick={() => setMode('send')}>
                <span className="mode-icon">📨</span>
                <span className="mode-title">Send to Someone</span>
                <span className="mode-desc">Delivered directly to one person's inbox</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>{mode === 'library' ? 'Upload to Library' : mode === 'private' ? 'Private Document' : 'Send Document'}</h2>

            {mode === 'private' && (
              <div className="field">
                <label>Authorized usernames (comma-separated, optional)</label>
                <input value={authorizedUsernames} onChange={(e) => setAuthorizedUsernames(e.target.value)} placeholder="mary, john" />
              </div>
            )}

            {mode === 'send' && (
              <>
                <div className="field">
                  <label>Receiver username</label>
                  <input value={receiverUsername} onChange={(e) => setReceiverUsername(e.target.value)} placeholder="mary" />
                </div>
                <div className="field">
                  <label>Message</label>
                  <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Optional note…" />
                </div>
              </>
            )}

            <div className="field">
              <label>File</label>
              <input type="file" onChange={(e) => setFile(e.target.files[0])} />
            </div>

            {error && <p className="modal-error">{error}</p>}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setMode(null)}>Back</button>
              <button className="btn btn-primary" onClick={handleUpload} disabled={busy}>
                {busy ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        .modal-overlay { position: fixed; inset: 0; background: rgba(30,36,31,0.4); display: flex; align-items: center; justify-content: center; z-index: 50; }
        .modal { width: 480px; max-width: 92vw; background: var(--surface); border-radius: 16px; padding: 28px; box-shadow: 0 20px 60px rgba(0,0,0,0.25); }
        .modal h2 { font-size: 18px; margin-bottom: 6px; }
        .modal-sub { color: var(--text-secondary); font-size: 13px; margin-bottom: 20px; }
        .mode-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
        .mode-card { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 14px 16px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface); cursor: pointer; text-align: left; }
        .mode-card:hover { background: var(--surface-alt); border-color: var(--accent); }
        .mode-icon { font-size: 20px; }
        .mode-title { font-weight: 600; font-size: 13.5px; }
        .mode-desc { font-size: 12px; color: var(--text-tertiary); }
        .modal-actions { display: flex; gap: 10px; margin-top: 6px; }
        .modal-actions .btn { flex: 1; }
        .modal-error { color: var(--danger); font-size: 12.5px; margin-bottom: 12px; }
      `}</style>
    </div>
  );
}
