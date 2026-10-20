import { useRef, useState } from 'react';
import { api } from '../api/client';

const TEMPLATE = 'ec_number,full_name,username,department,role\nEC1001,Tendai Moyo,,ICT,User\nEC1002,Rudo Chikwanha,rchikwanha,Accounts,User\n';

function downloadCsv(filename, text) {
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// "Manage users" > import many people from a spreadsheet in one go.
export default function ImportUsers({ onImported }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [createDepts, setCreateDepts] = useState(false);
  const [check, setCheck] = useState(null);    // result of the dry run
  const [result, setResult] = useState(null);  // result of the real import
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  function reset(closeToo) {
    setFile(null);
    setCheck(null);
    setResult(null);
    setError(null);
    setCreateDepts(false);
    if (inputRef.current) inputRef.current.value = '';
    if (closeToo) setOpen(false);
  }

  async function runCheck(f = file, depts = createDepts) {
    if (!f) return;
    setBusy(true);
    setError(null);
    try {
      setCheck(await api.importUsers(f, true, depts));
    } catch (err) {
      setCheck(null);
      setError(err.message || 'Could not read that file.');
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.importUsers(file, false, createDepts);
      setResult(res);
      setCheck(null);
      onImported && onImported();
    } catch (err) {
      setError(err.message || 'The import failed.');
    } finally {
      setBusy(false);
    }
  }

  function saveCredentials() {
    const head = 'ec_number,full_name,username,department,role,temporary_password';
    const lines = result.created.map((c) =>
      [c.ec_number, c.full_name, c.username, c.department, c.role, c.temporary_password].map(csvCell).join(','));
    downloadCsv('new-users-temporary-passwords.csv', [head, ...lines].join('\n') + '\n');
  }

  if (!open) {
    return (
      <div className="imp-collapsed">
        <span>Adding many people? Import them from a spreadsheet.</span>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>Import users</button>
        <style>{styles}</style>
      </div>
    );
  }

  return (
    <section className="imp-box" aria-label="Import users">
      <div className="imp-top">
        <h2>Import users</h2>
        <button type="button" className="imp-x" onClick={() => reset(true)} aria-label="Close">✕</button>
      </div>

      {result ? (
        <>
          <p className="imp-good">
            Created {result.created.length} user{result.created.length === 1 ? '' : 's'}
            {result.skipped.length > 0 ? `, skipped ${result.skipped.length}` : ''}.
          </p>
          {result.created.length > 0 && (
            <>
              <p className="imp-note">
                Each person has a temporary password below. It is shown only now, so save the list and pass each one on
                in person or by phone. They must choose their own at first sign-in.
              </p>
              <div className="imp-wrap">
                <table className="imp-table">
                  <thead><tr><th>Name</th><th>Temporary password</th><th>EC number</th><th>Username</th><th>Department</th></tr></thead>
                  <tbody>
                    {result.created.map((c) => (
                      <tr key={c.ec_number}>
                        <td>{c.full_name}</td><td><code>{c.temporary_password}</code></td>
                        <td>{c.ec_number}</td><td>{c.username}</td><td>{c.department || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="imp-actions">
                <button type="button" className="btn btn-primary" onClick={saveCredentials}>Save list as spreadsheet (CSV)</button>
              </div>
            </>
          )}
          {result.skipped.length > 0 && (
            <>
              <p className="imp-note imp-warn">Not created:</p>
              <ul className="imp-skipped">
                {result.skipped.map((s) => (
                  <li key={s.row}>Row {s.row}{s.full_name ? ` (${s.full_name})` : ''}: {s.message}</li>
                ))}
              </ul>
            </>
          )}
          <div className="imp-actions">
            <button type="button" className="btn btn-secondary" onClick={() => reset(true)}>Done</button>
          </div>
        </>
      ) : (
        <>
          <p className="imp-note">
            Upload a spreadsheet (.csv or .xlsx) with a heading row. Needed columns: <strong>ec_number</strong> and{' '}
            <strong>full_name</strong>. Optional: <strong>username</strong> (made from the name if blank),{' '}
            <strong>department</strong> and <strong>role</strong> (User, Manager or Admin). Up to 300 people at a time.
          </p>
          <div className="imp-actions">
            <button type="button" className="btn btn-secondary" onClick={() => downloadCsv('users-template.csv', TEMPLATE)}>
              Download template
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.txt"
              onChange={(e) => {
                const f = e.target.files[0] || null;
                setFile(f);
                setCheck(null);
                setError(null);
                if (f) runCheck(f, createDepts);
              }}
            />
          </div>
          <label className="imp-check">
            <input
              type="checkbox"
              checked={createDepts}
              onChange={(e) => {
                setCreateDepts(e.target.checked);
                if (file) runCheck(file, e.target.checked);
              }}
            />
            <span>Create departments that don't exist yet</span>
          </label>

          {busy && !check && <p className="imp-note">Checking the file…</p>}
          {error && <p className="imp-error" role="alert">{error}</p>}

          {check && (
            <>
              <p className="imp-summary">
                <strong>{check.valid}</strong> ready to create
                {check.total - check.valid > 0 && <> · <span className="imp-bad">{check.total - check.valid} need attention</span></>}
                {check.new_departments.length > 0 && <> · new department{check.new_departments.length > 1 ? 's' : ''}: {check.new_departments.join(', ')}</>}
              </p>
              <div className="imp-wrap">
                <table className="imp-table">
                  <thead><tr><th>Name</th><th>Result</th><th>EC number</th><th>Username</th><th>Department</th><th>Role</th><th>Row</th></tr></thead>
                  <tbody>
                    {check.rows.map((r) => (
                      <tr key={r.row} className={r.status === 'error' ? 'imp-err-row' : ''}>
                        <td>{r.full_name || '—'}</td>
                        <td>{r.status === 'ok' ? <span className="imp-ok">✓ ready</span> : <span className="imp-bad">{r.message}</span>}</td>
                        <td>{r.ec_number || '—'}</td><td>{r.username || '—'}</td><td>{r.department || '—'}</td><td>{r.role || '—'}</td>
                        <td>{r.row}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="imp-actions">
                <button type="button" className="btn btn-primary" disabled={busy || check.valid === 0} onClick={runImport}>
                  {busy ? 'Creating…' : `Create ${check.valid} user${check.valid === 1 ? '' : 's'}`}
                </button>
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => reset(false)}>Choose another file</button>
              </div>
              {check.total - check.valid > 0 && (
                <p className="imp-note">Rows that need attention are skipped. Fix them in your spreadsheet and import again if you need them.</p>
              )}
            </>
          )}
        </>
      )}
      <style>{styles}</style>
    </section>
  );
}

const styles = `
  .imp-collapsed { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
    background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px 16px; margin: 0 0 18px;
    font-size: 13px; color: var(--text-secondary); }
  .imp-box { background: var(--surface); border: 1px solid var(--border); border-left: 4px solid var(--accent);
    border-radius: 12px; padding: 14px 16px 16px; margin: 0 0 18px; min-width: 0; }
  .imp-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .imp-top h2 { font-size: 15px; }
  .imp-x { background: none; border: none; font-size: 15px; color: var(--text-tertiary); cursor: pointer; padding: 6px; }
  .imp-note { font-size: 13px; color: var(--text-secondary); line-height: 1.55; margin: 0 0 12px; }
  .imp-warn { color: var(--danger); font-weight: 600; margin-top: 12px; }
  .imp-good { font-size: 14px; font-weight: 600; color: var(--accent); margin-bottom: 8px; }
  .imp-error { color: var(--danger); font-size: 13px; margin: 8px 0; }
  .imp-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 4px 0 12px; }
  .imp-actions input[type=file] { font-size: 12.5px; max-width: 100%; }
  .imp-check { display: flex; align-items: center; gap: 8px; font-size: 13px; margin: 0 0 12px; cursor: pointer; }
  .imp-check input { width: auto; height: auto; }
  .imp-summary { font-size: 13.5px; margin: 6px 0 8px; }
  .imp-ok { color: var(--accent); font-weight: 600; white-space: nowrap; }
  .imp-bad { color: var(--danger); font-weight: 600; }
  .imp-wrap { overflow: auto; max-height: 340px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 12px; }
  .imp-table { border-collapse: collapse; font-size: 12.5px; width: 100%; }
  .imp-table th { position: sticky; top: 0; background: var(--surface-alt); text-align: left; padding: 7px 10px; font-size: 11.5px; white-space: nowrap; }
  .imp-table td { padding: 6px 10px; border-top: 1px solid var(--border); white-space: nowrap; }
  .imp-table td:nth-child(2) { white-space: normal; min-width: 130px; }
  .imp-err-row { background: var(--danger-bg); }
  .imp-table code { font-size: 13px; font-weight: 700; letter-spacing: 0.04em; user-select: all; }
  .imp-skipped { margin: 0 0 12px 18px; font-size: 12.5px; color: var(--text-secondary); line-height: 1.6; }
`;
