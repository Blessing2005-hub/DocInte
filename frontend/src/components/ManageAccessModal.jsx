import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function ManageAccessModal({ row, onClose, onSaved }) {
  const [people, setPeople] = useState([]);
  const [chosen, setChosen] = useState(null); // null until loaded
  const [query, setQuery] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([api.getDirectory(), api.getAccess(row.documentId)])
      .then(([dir, access]) => {
        if (!alive) return;
        const list = Array.isArray(dir) ? dir : [];
        const current = (access.people || []).map((p) => p.username);
        // Keep anyone with access in the list even if they are not in the directory (e.g. disabled).
        const extra = (access.people || []).filter((p) => !list.some((d) => d.username === p.username));
        setPeople([...list, ...extra]);
        setChosen(current);
      })
      .catch((err) => alive && setError(err.message || 'Could not load the access list.'));
    return () => { alive = false; };
  }, [row.documentId]);

  function toggle(username) {
    setChosen((c) => (c.includes(username) ? c.filter((u) => u !== username) : [...c, username]));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.setAccess(row.documentId, chosen);
      onSaved && onSaved((res.people || []).length);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save. Please try again.');
      setBusy(false);
    }
  }

  const q = query.trim().toLowerCase();
  const shown = people.filter((p) => !q || `${p.full_name} ${p.department || ''} ${p.username}`.toLowerCase().includes(q));

  return (
    <div className="ma-overlay" onClick={onClose}>
      <div className="ma-modal card" onClick={(e) => e.stopPropagation()}>
        <h2>Who can see this document</h2>
        <p className="ma-sub">{row.filename}</p>
        <input className="ma-search" type="search" placeholder="Search people…" value={query}
          onChange={(e) => setQuery(e.target.value)} />
        <div className="ma-list">
          {chosen === null && !error && <div className="ma-empty">Loading…</div>}
          {chosen !== null && shown.length === 0 && <div className="ma-empty">No one found.</div>}
          {chosen !== null && shown.map((p) => (
            <label key={p.username} className="ma-item">
              <input type="checkbox" checked={chosen.includes(p.username)} onChange={() => toggle(p.username)} />
              <span className="ma-name">{p.full_name}</span>
              <span className="ma-dept">{p.department}</span>
            </label>
          ))}
        </div>
        <p className="ma-count">{chosen ? `${chosen.length} selected` : ''} · You always keep access.</p>
        {error && <p className="ma-error" role="alert">{error}</p>}
        <div className="ma-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={busy || chosen === null}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      <style>{`
        .ma-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center;
          justify-content: center; z-index: 50; padding: 16px; }
        .ma-modal { width: 100%; max-width: 420px; padding: 20px; background: var(--surface); }
        .ma-modal h2 { font-size: 16px; margin-bottom: 2px; }
        .ma-sub { font-size: 12.5px; color: var(--text-tertiary); margin-bottom: 12px; word-break: break-word; }
        .ma-search { width: 100%; margin-bottom: 8px; }
        .ma-list { max-height: 260px; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px; }
        .ma-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid var(--border);
          cursor: pointer; font-size: 13.5px; }
        .ma-item:last-child { border-bottom: none; }
        .ma-item:hover { background: var(--surface-alt); }
        .ma-name { flex: 1; min-width: 0; }
        .ma-dept { color: var(--text-tertiary); font-size: 12px; }
        .ma-empty { padding: 20px; text-align: center; color: var(--text-tertiary); font-size: 13px; }
        .ma-count { font-size: 12px; color: var(--text-tertiary); margin: 8px 0; }
        .ma-error { color: var(--danger); font-size: 13px; margin: 4px 0 8px; }
        .ma-actions { display: flex; justify-content: flex-end; gap: 10px; }
      `}</style>
    </div>
  );
}
