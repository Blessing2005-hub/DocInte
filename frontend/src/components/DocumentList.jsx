import { useState } from 'react';
import { api } from '../api/client';
import NewVersionModal from './NewVersionModal';
import VersionHistoryModal from './VersionHistoryModal';
import DocPreview from './DocPreview';
import ManageAccessModal from './ManageAccessModal';

const TYPE_BADGE = { library: 'library', private: 'private', sent: 'sent' };
const TYPE_ICON = { library: '📚', private: '🔒', sent: '📨' };

export default function DocumentList({ title, rows, emptyText, onDeleted, allowDelete, onChanged, toolbar, totalCount }) {
  // Keep only the id, and look the row up each render, so that after a
  // reload the pane shows the latest version number (editing is checked
  // against it) instead of a stale copy.
  const isPhone = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 820px)').matches;
  const [selectedId, setSelectedId] = useState(() => (isPhone() ? null : rows[0]?.id || null));
  const selected = rows.find((r) => r.id === selectedId) || null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [showNewVersion, setShowNewVersion] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAccess, setShowAccess] = useState(false);

  function selectRow(row) {
    setSelectedId(row.id);
    setError(null);
    setNotice(null);
  }

  async function handleDownload(row) {
    setError(null);
    try {
      await api.downloadDocument(row.documentId, row.filename);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(row) {
    setBusy(true);
    setError(null);
    try {
      await api.deleteDocument(row.documentId);
      onDeleted && onDeleted(row);
      if (selected?.documentId === row.documentId) setSelectedId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="doc-list-shell">
      <div className="doc-list">
        <div className="list-head">
          <h1>{title}</h1>
          <span className="sub">{rows.length}{totalCount != null && totalCount !== rows.length ? ` of ${totalCount}` : ''} document{rows.length === 1 ? '' : 's'}</span>
        </div>
        {toolbar}

        {rows.length === 0 ? (
          <div className="empty-state">{emptyText}</div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className={`row ${!row.read ? 'unread' : ''} ${selected?.id === row.id ? 'selected' : ''}`}
              onClick={() => selectRow(row)}
            >
              <span className={`type-dot ${row.uploadType}`} />
              <span className="row-icon">{row.icon || TYPE_ICON[row.uploadType] || '📄'}</span>
              <div className="row-main">
                <div className="row-title-line">
                  <span className="row-title">{row.filename}</span>
                  {row.person && <span className="row-from">{row.personLabel} {row.person}</span>}
                </div>
                {row.snippet && <div className="row-snippet">{row.snippet}</div>}
              </div>
              <span className={`badge badge-${TYPE_BADGE[row.uploadType] || 'library'}`}>{row.badge || row.uploadType}</span>
              <span className="row-date">{formatDate(row.date)}</span>
            </div>
          ))
        )}
      </div>

      {selected && (
        <div className="pane">
          <button className="pane-back" onClick={() => setSelectedId(null)}>← Back to list</button>
          <span className={`badge badge-${TYPE_BADGE[selected.uploadType] || 'library'}`}>{selected.uploadType}</span>
          <h2>{selected.filename}</h2>
          <div className="pane-meta">
            {selected.person && `${selected.personLabel} ${selected.person} · `}
            {formatDate(selected.date, true)}
          </div>

          {(selected.department || selected.version > 1) && (
            <div className="pane-facts">
              {selected.department && <div>Department: {selected.department}</div>}
              <div>
                Version {selected.version}
                {selected.updatedBy ? `, last edited by ${selected.updatedBy}` : ''}
              </div>
            </div>
          )}

          {selected.message && <div className="pane-message">"{selected.message}"</div>}

          <DocPreview key={`${selected.id}-${selected.version}`} row={selected} />

          {error && <p className="pane-error">{error}</p>}
          {notice && <p className="pane-ok">{notice}</p>}

          <div className="pane-actions">
            <button className="pane-btn" onClick={() => handleDownload(selected)}>Download</button>
            {allowDelete && selected.canDelete !== false && (
              <button className="pane-btn danger" onClick={() => handleDelete(selected)} disabled={busy}>
                Delete
              </button>
            )}
          </div>

          <div className="pane-actions pane-actions-more">
            {selected.canEdit && (
              <button className="pane-btn plain" onClick={() => setShowNewVersion(true)}>Upload new version</button>
            )}
            {selected.canManageAccess && (
              <button className="pane-btn plain" onClick={() => setShowAccess(true)}>Manage access</button>
            )}
            <button className="pane-btn plain" onClick={() => setShowHistory(true)}>Version history</button>
          </div>
        </div>
      )}

      {selected && showNewVersion && (
        <NewVersionModal
          row={selected}
          onClose={() => setShowNewVersion(false)}
          onSaved={(updated) => {
            setNotice(`Saved as version ${updated.version}.`);
            onChanged && onChanged();
          }}
          onStale={() => onChanged && onChanged()}
        />
      )}

      {selected && showAccess && (
        <ManageAccessModal
          row={selected}
          onClose={() => setShowAccess(false)}
          onSaved={(count) => {
            setNotice(count ? `Access updated: ${count} ${count === 1 ? 'person' : 'people'} can open this document.` : 'Access updated: only you can open this document.');
            onChanged && onChanged();
          }}
        />
      )}

      {selected && showHistory && (
        <VersionHistoryModal
          row={selected}
          onClose={() => setShowHistory(false)}
          onChanged={() => onChanged && onChanged()}
        />
      )}

      <style>{`
        .doc-list-shell { display: flex; height: 100%; }
        .doc-list { flex: 1; overflow-y: auto; }
        .list-head { display: flex; align-items: baseline; gap: 10px; padding: 18px 24px 10px; }
        .list-head h1 { font-size: 19px; }
        .sub { color: var(--text-tertiary); font-size: 12.5px; }
        .empty-state { padding: 60px 24px; text-align: center; color: var(--text-tertiary); font-size: 13px; }
        .row { display: flex; align-items: center; gap: 14px; padding: 13px 24px; border-bottom: 1px solid var(--border); cursor: pointer; }
        .row:hover { background: var(--surface-alt); }
        .row.unread { background: #FCFCFA; }
        .row.selected { background: var(--accent-bg); }
        .type-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .type-dot.library { background: var(--accent); }
        .type-dot.private { background: var(--gold); }
        .type-dot.sent { background: var(--blue); }
        .row-icon { font-size: 16px; flex-shrink: 0; width: 20px; text-align: center; }
        .row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .row-title-line { display: flex; align-items: baseline; gap: 8px; }
        .row-title { font-weight: 600; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .row.unread .row-title { font-weight: 700; }
        .row-from { color: var(--text-tertiary); font-size: 12px; white-space: nowrap; }
        .row-snippet { color: var(--text-tertiary); font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .row-date { color: var(--text-tertiary); font-size: 12px; width: 70px; text-align: right; flex-shrink: 0; }
        .pane { width: 380px; flex-shrink: 0; border-left: 1px solid var(--border); background: var(--surface); padding: 24px; overflow-y: auto; }
        .pane h2 { font-size: 16.5px; margin: 12px 0 6px; line-height: 1.3; }
        .pane-meta { color: var(--text-tertiary); font-size: 12px; margin-bottom: 16px; }
        .pane-message { font-style: italic; color: var(--text-secondary); font-size: 13px; margin-bottom: 16px; padding: 10px 12px; background: var(--surface-alt); border-radius: 8px; }
        .pane-preview { height: 200px; border-radius: 10px; background: var(--surface-alt); border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); font-size: 12px; margin-bottom: 18px; flex-direction: column; gap: 8px; }
        .pane-actions { display: flex; gap: 10px; }
        .pane-btn { flex: 1; height: 38px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); font-weight: 600; font-size: 12.5px; cursor: pointer; }
        .pane-btn:first-child { background: var(--accent); color: white; border: none; }
        .pane-btn.danger { color: var(--danger); border-color: var(--danger-bg); }
        .pane-error { color: var(--danger); font-size: 12.5px; margin-bottom: 10px; }
        .pane-ok { color: var(--accent); font-size: 12.5px; margin-bottom: 10px; }
        .pane-facts { color: var(--text-secondary); font-size: 12.5px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 2px; }
        .pane-actions-more { margin-top: 10px; }
        .pane-btn.plain { background: var(--surface); color: var(--text-primary); border: 1px solid var(--border); }
        .pane-btn.plain:hover { background: var(--surface-alt); }
        .pane-back { display: none; }
        .row-title-line { min-width: 0; }
        @media (max-width: 820px) {
          .doc-list-shell { display: block; height: auto; }
          .list-head { padding: 14px 14px 8px; }
          .row { padding: 12px 14px; gap: 10px; }
          .row-date { width: auto; min-width: 44px; }
          .row-from { display: none; }
          .pane { position: fixed; top: 70px; left: 0; right: 0; bottom: 0; width: auto; z-index: 40;
                  border-left: none; padding: 14px 16px 24px; overflow-y: auto; }
          .pane-back { display: inline-block; border: none; background: none; color: var(--accent); font-weight: 600;
                       font-size: 13px; padding: 4px 0 10px; cursor: pointer; }
          .pane h2 { font-size: 15.5px; overflow-wrap: anywhere; }
        }
      `}</style>
    </div>
  );
}

function formatDate(dateStr, full = false) {
  const d = new Date(dateStr);
  if (full) return d.toLocaleString();
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
