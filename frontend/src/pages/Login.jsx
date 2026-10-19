import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/ministry-logo.jpg';
import { api } from '../api/client';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [ecNumber, setEcNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [fUsername, setFUsername] = useState('');
  const [fMessage, setFMessage] = useState(null);
  const [fError, setFError] = useState(null);
  const [fBusy, setFBusy] = useState(false);

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

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-side">
          <img src={logo} alt="Ministry of Industry and Commerce" className="login-logo" />
          <h1>DocIntel</h1>
          <div className="login-side-foot mono">Ministry of Industry and Commerce</div>
        </div>

        {forgot ? (
          <form className="login-form-col" onSubmit={handleForgot}>
            <h2>Forgot your password?</h2>
            <p className="login-sub">
              Enter your EC number and username. An administrator will be asked to give you a temporary password.
            </p>

            {fMessage ? (
              <>
                <p className="login-ok">{fMessage}</p>
                <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={() => setForgot(false)}>
                  Back to sign in
                </button>
              </>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="f-ec">EC Number</label>
                  <input id="f-ec" value={ecNumber} onChange={(e) => setEcNumber(e.target.value)} placeholder="EC1001" autoFocus />
                </div>
                <div className="field">
                  <label htmlFor="f-user">Username</label>
                  <input id="f-user" value={fUsername} onChange={(e) => setFUsername(e.target.value)} placeholder="your username" />
                </div>

                {fError && <p className="login-error">{fError}</p>}

                <button className="btn btn-primary" style={{ width: '100%' }} disabled={fBusy || !ecNumber.trim() || !fUsername.trim()}>
                  {fBusy ? 'Sending…' : 'Ask for a new password'}
                </button>
                <button type="button" className="login-link" onClick={() => setForgot(false)}>Back to sign in</button>
              </>
            )}
          </form>
        ) : (
        <form className="login-form-col" onSubmit={handleSubmit}>
          <h2>Sign in</h2>
          <p className="login-sub">Use your EC number and password to continue.</p>

          <div className="field">
            <label htmlFor="ec">EC Number</label>
            <input id="ec" value={ecNumber} onChange={(e) => setEcNumber(e.target.value)} placeholder="EC1001" autoFocus />
          </div>
          <div className="field">
            <label htmlFor="pw">Password</label>
            <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••" />
          </div>

          {error && <p className="login-error">{error}</p>}

          <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading || !ecNumber || !password}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          <button type="button" className="login-link" onClick={openForgot}>Forgot password?</button>
        </form>
        )}
      </div>

      <style>{`
        .login-page {
          min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg);
        }
        .login-card {
          display: flex; width: 920px; max-width: 94vw; background: var(--surface); border-radius: 16px;
          overflow: hidden; box-shadow: 0 1px 2px rgba(30,36,31,0.06), 0 12px 32px rgba(30,36,31,0.08);
          border: 1px solid var(--border);
        }
        .login-side {
          width: 340px; background: var(--accent); color: #EFF6F3; padding: 40px 32px;
          display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between;
        }
        .login-logo { width: 84px; height: 84px; object-fit: contain; background: white; border-radius: 12px; padding: 10px; margin-bottom: 18px; }
        .login-side h1 { font-size: 24px; color: white; }
        .login-side-foot { font-size: 11px; color: rgba(239,246,243,0.75); }
        .login-form-col { flex: 1; padding: 44px 40px; display: flex; flex-direction: column; justify-content: center; }
        .login-form-col h2 { font-size: 21px; margin-bottom: 6px; }
        .login-sub { font-size: 13px; color: var(--text-secondary); margin-bottom: 26px; }
        .login-error { color: var(--danger); font-size: 13px; margin-bottom: 14px; }
        .login-ok { color: var(--accent); font-size: 13.5px; line-height: 1.5; margin-bottom: 18px; }
        .login-link { background: none; border: none; color: var(--accent); font-weight: 600; font-size: 13px; cursor: pointer; margin-top: 14px; padding: 4px 0; align-self: flex-start; }
        @media (max-width: 700px) {
          .login-card { flex-direction: column; width: 420px; }
          .login-side { width: auto; }
        }
      `}</style>
    </div>
  );
}
