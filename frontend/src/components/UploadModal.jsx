import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function UploadModal({ onClose, onUploaded }) {
  const [mode, setMode] = useState(null); // library | private | send
  const [file, setFile] = useState(null);
  const [authorizedUsernames, setAuthorizedUsernames] = useState('');
  const [receiverUsername, setReceiverUsername] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [people, setPeople] = useState([]);
  const [peopleError, setPeopleError] = useState(false);
  const [filter, setFilter] = useState('');
  const [editAccess, setEditAccess] = useState('department');

  useEffect(() => {
    api.getDirectory().then((list) => setPeople(Array.isArray(list) ? list : [])).catch(() => setPeopleError(true));
  }, []);

  const selected = authorizedUsernames.split(',').map((s) => s.trim()).filter(Boolean);
  function togglePerson(username) {
    const next = selected.includes(username) ? selected.filter((u) => u !== username) : [...selected, username];
    setAuthorizedUsernames(next.join(', '));
  }
  const shown = people.filter((p) =>
    `${p.full_name} ${p.username} ${p.department}`.toLowerCase().includes(filter.trim().toLowerCase())
  );

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
          setError('Choose who to send this to.');
          setBusy(false);
          return;
        }
        await api.sendDocument(file, receiverUsername, message);
      } else {
        await api.uploadDocument(file, mode, authorizedUsernames, editAccess);
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
              <button className="mode-card" onClick={() => { setMode('library'); setEditAccess('department'); }}>
                <span className="mode-icon">📚</span>
                <span className="mode-title">Shared Library</span>
                <span className="mode-desc">Visible to everyone in the organization</span>
              </button>
              <button className="mode-card" onClick={() => { setMode('private'); setEditAccess('everyone'); }}>
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
                <label>Who else can see it? (optional){selected.length > 0 ? ` — ${selected.length} selected` : ''}</label>
                {peopleError ? (
                  <input value={authorizedUsernames} onChange={(e) => setAuthorizedUsernames(e.target.value)} placeholder="mary, john" />
                ) : (
                  <>
                    <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search name or department…" />
                    <div className="people-list">
                      {shown.map((p) => (
                        <label key={p.id} className="person-row">
                          <input type="checkbox" checked={selected.includes(p.username)} onChange={() => togglePerson(p.username)} />
                          <span>{p.full_name}<small>{p.username}{p.department ? ` · ${p.department}` : ''}</small></span>
                        </label>
                      ))}
                      {shown.length === 0 && <p className="people-empty">No people found.</p>}
                    </div>
                  </>
                )}
              </div>
            )}

            {mode === 'send' && (
              <>
                <div className="field">
                  <label>Send to</label>
                  {peopleError ? (
                    <input value={receiverUsername} onChange={(e) => setReceiverUsername(e.target.value)} placeholder="Receiver username" />
                  ) : (
                    <>
                      <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search name or department…" />
                      <div className="people-list">
                        {shown.map((p) => (
                          <label key={p.id} className={`person-row ${receiverUsername === p.username ? 'chosen' : ''}`}>
                            <input type="radio" name="receiver" checked={receiverUsername === p.username} onChange={() => setReceiverUsername(p.username)} />
                            <span>{p.full_name}<small>{p.username}{p.department ? ` · ${p.department}` : ''}</small></span>
                          </label>
                        ))}
                        {shown.length === 0 && <p className="people-empty">No people found.</p>}
                      </div>
                    </>
                  )}
                </div>
                <div className="field">
                  <label>Message</label>
                  <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Optional note…" />
                </div>
              </>
            )}

            {(mode === 'library' || mode === 'private') && (
              <div className="field">
                <label>Who can edit it?</label>
                <label className="radio-row">
                  <input type="radio" name="edit-access" checked={editAccess === 'everyone'} onChange={() => setEditAccess('everyone')} />
                  <span>Everyone who can open it<small>{mode === 'library' ? 'Anyone in the organization can save new versions' : 'Everyone you chose above can save new versions'}</small></span>
                </label>
                <label className="radio-row">
                  <input type="radio" name="edit-access" checked={editAccess === 'department'} onChange={() => setEditAccess('department')} />
                  <span>Only my department<small>Others can read it, but only people in your department can edit</small></span>
                </label>
              </div>
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
        .modal select { width: 100%; }
        .people-list { max-height: 160px; overflow-y: auto; margin-top: 8px; border: 1px solid var(--border); border-radius: 8px; }
        .person-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; cursor: pointer; border-bottom: 1px solid var(--border); }
        .person-row:last-child { border-bottom: none; }
        .person-row:hover { background: var(--surface-alt); }
        .person-row.chosen { background: var(--accent-soft, #e6f2ec); }
        .person-row input { width: auto; margin: 0; }
        .person-row span { display: flex; flex-direction: column; font-size: 13px; }
        .person-row small { color: var(--text-tertiary); font-size: 11.5px; }
        .radio-row { display: flex; align-items: flex-start; gap: 10px; padding: 6px 0; cursor: pointer; }
        .radio-row input { width: auto; margin: 3px 0 0; }
        .radio-row span { display: flex; flex-direction: column; font-size: 13px; }
        .radio-row small { color: var(--text-tertiary); font-size: 11.5px; }
        .people-empty { padding: 12px; font-size: 12.5px; color: var(--text-tertiary); }
        .modal-error { color: var(--danger); font-size: 12.5px; margin-bottom: 12px; }
      `}</style>
    </div>
  );
}
