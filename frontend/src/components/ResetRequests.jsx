import { useEffect, useState } from 'react';
import { api } from '../api/client';

// Shown at the top of "Manage users": people who say they forgot their password.
export default function ResetRequests() {
  const [rows, setRows] = useState([]);
  const [issued, setIssued] = useState(null); // { full_name, ec_number, temporary_password }
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await api.listResetRequests();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      /* the rest of the page still works */
    }
  }

  async function issue(row) {
    setBusyId(row.id);
    setError(null);
    setCopied(false);
    try {
      const res = await api.issueTempPassword(row.id);
      setIssued(res);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      setError(err.message || 'Could not create a temporary password.');
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function dismiss(row) {
    setBusyId(row.id);
    try {
      await api.dismissResetRequest(row.id);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      setError(err.message || 'Could not dismiss that request.');
    } finally {
      setBusyId(null);
    }
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      /* the password is on screen to copy by hand */
    }
  }

  if (rows.length === 0 && !issued) return null;

  return (
    <section className="rr-box" aria-label="Password requests">
      <h2>Password requests{rows.length > 0 ? ` (${rows.length})` : ''}</h2>

      {issued && (
        <div className="rr-issued" role="status">
          <p>
            Temporary password for <strong>{issued.full_name}</strong> ({issued.ec_number}). It is shown only now, so
            pass it on in person or by phone. They must choose their own at first sign-in.
          </p>
          <div className="rr-code-row">
            <code className="rr-code">{issued.temporary_password}</code>
            <button type="button" className="btn btn-secondary" onClick={() => copy(issued.temporary_password)}>
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setIssued(null)}>Done</button>
          </div>
        </div>
      )}

      {error && <p className="rr-error" role="alert">{error}</p>}

      {rows.map((r) => (
        <div key={r.id} className="rr-row">
          <div className="rr-who">
            <strong>{r.full_name}</strong>
            <span>{r.ec_number} · {r.username}{r.department ? ` · ${r.department}` : ''}</span>
            <span className="rr-when">asked {new Date(r.requested_date + (r.requested_date.endsWith('Z') ? '' : 'Z')).toLocaleString()}</span>
          </div>
          <div className="rr-actions">
            <button type="button" className="btn btn-primary" disabled={busyId === r.id} onClick={() => issue(r)}>
              Give temporary password
            </button>
            <button type="button" className="btn btn-secondary" disabled={busyId === r.id} onClick={() => dismiss(r)}>
              Dismiss
            </button>
          </div>
        </div>
      ))}

      <style>{`
        .rr-box { background: var(--surface); border: 1px solid var(--border); border-left: 4px solid var(--gold, #c9a227);
          border-radius: 12px; padding: 14px 16px; margin: 0 0 18px; }
        .rr-box h2 { font-size: 15px; margin-bottom: 10px; }
        .rr-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0;
          border-top: 1px solid var(--border); flex-wrap: wrap; }
        .rr-who { display: flex; flex-direction: column; gap: 2px; min-width: 0; font-size: 13px; }
        .rr-who span { color: var(--text-secondary); font-size: 12.5px; overflow-wrap: anywhere; }
        .rr-when { color: var(--text-tertiary) !important; font-size: 12px !important; }
        .rr-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .rr-issued { background: var(--accent-bg, #e6f2ec); border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; font-size: 13px; }
        .rr-issued p { margin-bottom: 10px; line-height: 1.5; }
        .rr-code-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .rr-code { font-size: 18px; font-weight: 700; letter-spacing: 0.06em; background: #fff; border: 1px dashed var(--accent);
          border-radius: 8px; padding: 6px 12px; user-select: all; }
        .rr-error { color: var(--danger); font-size: 12.5px; margin-bottom: 8px; }
        @media (max-width: 600px) { .rr-actions { width: 100%; } .rr-actions .btn { flex: 1; } }
      `}</style>
    </section>
  );
}
