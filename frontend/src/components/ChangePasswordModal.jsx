import { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function ChangePasswordModal({ onClose }) {
  const { logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (next.length < 8) {
      setError('The new password must be at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      setError('The new passwords do not match.');
      return;
    }
    if (next === current) {
      setError('Choose a password different from your current one.');
      return;
    }
    setBusy(true);
    try {
      await api.changePassword(current, next);
      setDone(true);
    } catch (err) {
      setError(err.message || 'Could not change the password. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pw-overlay" onClick={done ? undefined : onClose}>
      <div className="pw-modal card" onClick={(e) => e.stopPropagation()}>
        <h2>Change password</h2>
        {done ? (
          <>
            <p className="pw-ok">Your password has been changed. Please sign in again with the new password.</p>
            <button className="btn btn-primary" onClick={logout}>Sign in again</button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="pw-current">Current password</label>
              <input id="pw-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password" required autoFocus />
            </div>
            <div className="field">
              <label htmlFor="pw-new">New password (at least 8 characters)</label>
              <input id="pw-new" type="password" value={next} onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password" required minLength={8} />
            </div>
            <div className="field">
              <label htmlFor="pw-confirm">Confirm new password</label>
              <input id="pw-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password" required minLength={8} />
            </div>
            {error && <p className="pw-error" role="alert">{error}</p>}
            <div className="pw-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
            </div>
          </form>
        )}
      </div>

      <style>{`
        .pw-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center;
          justify-content: center; z-index: 100; padding: 16px; overflow-y: auto; }
        .pw-modal { width: 100%; max-width: 400px; padding: 24px; background: var(--surface); }
        .pw-modal h2 { font-size: 17px; margin-bottom: 16px; }
        .pw-error { color: var(--danger); font-size: 13px; margin: 4px 0 12px; }
        .pw-ok { font-size: 13.5px; margin-bottom: 16px; }
        .pw-actions { display: flex; justify-content: flex-end; gap: 10px; }
      `}</style>
    </div>
  );
}
