import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import logo from '../assets/ministry-logo.jpg';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [ecNumber, setEcNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [forgot, setForgot] = useState(false);
  const [fUsername, setFUsername] = useState('');
  const [fMessage, setFMessage] = useState(null);
  const [fError, setFError] = useState(null);
  const [fBusy, setFBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(ecNumber, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Invalid EC number or password');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e) {
    e.preventDefault();
    setFBusy(true);
    setFError(null);
    try {
      const res = await api.forgotPassword(ecNumber.trim(), fUsername.trim());
      setFMessage(res.message);
    } catch (err) {
      setFError(err.message || 'Could not send the request. Please try again.');
    } finally {
      setFBusy(false);
    }
  }

  function openForgot() {
    setForgot(true);
    setFMessage(null);
    setFError(null);
  }

  return (
    <div className="login-page">
      <div className="login-head">
        <img src={logo} alt="Ministry of Industry and Commerce" className="login-logo" />
        <h1>DocIntel</h1>
        <p>Ministry of Industry and Commerce</p>
      </div>
      <div className="login-stripe" aria-hidden="true" />

      {forgot ? (
        <form className="login-card" onSubmit={handleForgot}>
          <h2>Forgot your password?</h2>
          <p className="login-sub">
            Enter your EC number and username. An administrator will be asked to give you a temporary password.
          </p>

          {fMessage ? (
            <>
              <p className="login-ok">{fMessage}</p>
              <button type="button" className="btn btn-primary login-btn" onClick={() => setForgot(false)}>
                Back to sign in
              </button>
            </>
          ) : (
            <>
              <div className="field">
                <label htmlFor="f-ec">EC number</label>
                <input id="f-ec" value={ecNumber} onChange={(e) => setEcNumber(e.target.value)} placeholder="EC1001" autoFocus />
              </div>
              <div className="field">
                <label htmlFor="f-user">Username</label>
                <input id="f-user" value={fUsername} onChange={(e) => setFUsername(e.target.value)} placeholder="your username" />
              </div>

              {fError && <p className="login-error" role="alert">{fError}</p>}

              <button className="btn btn-primary login-btn" disabled={fBusy || !ecNumber.trim() || !fUsername.trim()}>
                {fBusy ? 'Sending…' : 'Ask for a new password'}
              </button>
              <button type="button" className="login-link" onClick={() => setForgot(false)}>Back to sign in</button>
            </>
          )}
        </form>
      ) : (
        <form className="login-card" onSubmit={handleSubmit}>
          <h2>Sign in</h2>

          <div className="field">
            <label htmlFor="ec">EC number</label>
            <input id="ec" value={ecNumber} onChange={(e) => setEcNumber(e.target.value)} placeholder="EC1001" autoFocus autoComplete="username" />
          </div>
          <div className="field">
            <label htmlFor="pw">Password</label>
            <div className="pw-wrap">
              <input
                id="pw"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                autoComplete="current-password"
              />
              <button type="button" className="pw-toggle" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && <p className="login-error" role="alert">{error}</p>}

          <button className="btn btn-primary login-btn" disabled={loading || !ecNumber || !password}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          <button type="button" className="login-link" onClick={openForgot}>Forgot password?</button>
        </form>
      )}

      <style>{`
        .login-page {
          min-height: 100vh; background: var(--accent); display: flex; flex-direction: column;
          align-items: center; justify-content: center; padding: 24px 16px; gap: 20px;
        }
        .login-head { text-align: center; color: #fff; }
        .login-logo { width: 84px; height: 84px; object-fit: contain; background: #fff; border-radius: 14px; padding: 10px; margin-bottom: 12px; }
        .login-head h1 { font-size: 28px; color: #fff; }
        .login-head p { font-size: 13px; opacity: 0.85; margin-top: 4px; }
        .login-stripe {
          width: 380px; max-width: 100%; height: 6px; border-radius: 6px; opacity: 0.5;
          background: repeating-linear-gradient(135deg, #fff 0 8px, transparent 8px 16px);
        }
        .login-card {
          width: 380px; max-width: 100%; background: var(--surface); color: var(--text-primary);
          border-radius: 18px; padding: 28px 28px 24px; box-shadow: 0 18px 40px rgba(0, 0, 0, 0.2);
          display: flex; flex-direction: column;
        }
        .login-card h2 { font-size: 18px; margin-bottom: 18px; }
        .login-sub { font-size: 13px; color: var(--text-secondary); margin: -8px 0 18px; line-height: 1.5; }
        .login-error { color: var(--danger); font-size: 13px; margin-bottom: 14px; }
        .login-ok { color: var(--accent); font-size: 13.5px; line-height: 1.5; margin-bottom: 18px; }
        .login-btn { width: 100%; }
        .login-link {
          background: none; border: none; color: var(--accent); font-weight: 600; font-size: 13px;
          cursor: pointer; margin-top: 14px; padding: 4px 0; align-self: center;
        }
        .pw-wrap { position: relative; }
        .pw-wrap input { padding-right: 64px; }
        .pw-toggle {
          position: absolute; right: 6px; top: 50%; transform: translateY(-50%); background: none; border: none;
          color: var(--text-tertiary); font-size: 12.5px; font-weight: 600; cursor: pointer; padding: 8px;
        }
        .pw-toggle:hover { color: var(--accent); }
      `}</style>
    </div>
  );
}
