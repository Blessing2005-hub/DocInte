import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function VersionHistoryModal({ row, onClose, onChanged }) {
  const [versions, setVersions] = useState(null);
  const [error, setError] = useState(null);
  const [busyVersion, setBusyVersion] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setVersions(await api.listVersions(row.documentId));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDownload(v) {
    setError(null);
    try {
      await api.downloadVersion(row.documentId, v.version_number, row.filename);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRestore(v) {
    if (!window.confirm(`Restore version ${v.version_number}? It will be saved as a new version, and nothing is lost.`)) return;
    setBusyVersion(v.version_number);
    setError(null);
    try {
      await api.restoreVersion(row.documentId, v.version_number);
      await load();
      onChanged && onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyVersion(null);
    }
  }

  return (
    <div className="ver-overlay" onClick={onClose}>
      <div className="ver-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Version history">
        <h2>Version history</h2>
        <p className="ver-sub">{row.filename}</p>

        {error && <p className="ver-error">{error}</p>}

        {versions === null && !error && <div className="skeleton" style={{ height: 120 }} />}

        {versions && (
          <ul className="ver-list">
            {versions.map((v) => (
              <li key={v.version_number} className="ver-item">
                <div className="ver-item-main">
                  <div className="ver-item-title">
                    Version {v.version_number}
                    {v.is_current && <span className="badge badge-library ver-current">Current</span>}
                  </div>
                  <div className="ver-item-meta">
                    {v.editor_name} on {new Date(v.created_date).toLocaleString()}
                  </div>
                  {v.note && <div className="ver-item-note">{v.note}</div>}
                </div>
                <div className="ver-item-actions">
                  <button className="btn-text" onClick={() => handleDownload(v)}>Download</button>
                  {row.canRestore && !v.is_current && (
                    <button className="btn-text" disabled={busyVersion !== null} onClick={() => handleRestore(v)}>
                      {busyVersion === v.version_number ? 'Restoring…' : 'Restore'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="ver-actions">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>

      <style>{`
        .ver-overlay { position: fixed; inset: 0; background: rgba(30,36,31,0.4); display: flex; align-items: center; justify-content: center; z-index: 50; }
        .ver-modal { width: 520px; max-width: 92vw; max-height: 90vh; overflow-y: auto; background: var(--surface); border-radius: 16px; padding: 28px; box-shadow: 0 20px 60px rgba(0,0,0,0.25); }
        .ver-modal h2 { font-size: 18px; margin-bottom: 6px; }
        .ver-sub { color: var(--text-secondary); font-size: 13px; margin-bottom: 16px; word-break: break-word; }
        .ver-error { color: var(--danger); font-size: 12.5px; margin-bottom: 12px; }
        .ver-list { list-style: none; margin: 0 0 18px; padding: 0; border: 1px solid var(--border); border-radius: 10px; }
        .ver-item { display: flex; justify-content: space-between; gap: 12px; padding: 12px 14px; border-bottom: 1px solid var(--border); }
        .ver-item:last-child { border-bottom: none; }
        .ver-item-main { min-width: 0; }
        .ver-item-title { font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 8px; }
        .ver-current { text-transform: none; letter-spacing: 0; }
        .ver-item-meta { color: var(--text-tertiary); font-size: 12px; margin-top: 2px; }
        .ver-item-note { color: var(--text-secondary); font-size: 12.5px; margin-top: 6px; word-break: break-word; }
        .ver-item-actions { display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0; }
        .ver-actions { display: flex; gap: 10px; }
        .ver-actions .btn { flex: 1; }
      `}</style>
    </div>
  );
}
