import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/ministry-logo.jpg';
import Icon from './Icon';
import ChangePasswordModal from './ChangePasswordModal';

function initialsOf(name) {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export default function TopBar({
  unread = 0,
  onUpload,
  onMenuToggle,
  mobileMenuOpen = false,
}) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const menuRef = useRef(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  useEffect(() => {
    function handleOutsideClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    function handleEscape(event) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  function enableNotifications() {
    setMenuOpen(false);
    if (typeof Notification === 'undefined') return;
    Notification.requestPermission().then(setPermission).catch(() => {});
  }

  return (
    <>
      <header className="topbar">
        <button
          type="button"
          className="tb-burger"
          onClick={onMenuToggle}
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <span className="tb-x">✕</span> : (<><span /><span /><span /></>)}
        </button>

        <Link to="/" className="tb-brand" aria-label="DocIntel home">
          <img src={logo} alt="" className="tb-logo" />
          <span className="tb-title">
            <strong>DocIntel</strong>
            <small>Ministry of Industry and Commerce</small>
          </span>
        </Link>

        <div className="tb-space" />

        {typeof onUpload === 'function' && (
          <button type="button" className="tb-upload" onClick={onUpload} aria-label="Upload document">
            <Icon name="upload" size={17} />
            <span>Upload</span>
          </button>
        )}

        <Link
          to="/inbox"
          className="tb-bell"
          aria-label={unread > 0 ? `Inbox, ${unread} unread` : 'Inbox'}
        >
          <Icon name="bell" size={21} />
          {unread > 0 && <span className="tb-dot">{unread > 9 ? '9+' : unread}</span>}
        </Link>

        <div className="tb-account" ref={menuRef}>
          <button
            type="button"
            className="tb-avatar"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Account menu"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <span className="tb-initials">{initialsOf(user?.full_name)}</span>
            <span className="tb-name">{user?.full_name}</span>
          </button>

          {menuOpen && (
            <div className="tb-menu" role="menu">
              <div className="tb-me">
                <strong>{user?.full_name}</strong>
                <span>
                  {user?.ec_number}
                  {user?.department ? ` · ${user.department}` : ''}
                  {user?.role ? ` · ${user.role}` : ''}
                </span>
              </div>
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setShowPassword(true); }}>
                Change password
              </button>
              {permission === 'default' && (
                <button type="button" role="menuitem" onClick={enableNotifications}>
                  Turn on notifications
                </button>
              )}
              <button type="button" role="menuitem" onClick={logout}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>
      <div className="tb-stripe" />

      {showPassword && <ChangePasswordModal onClose={() => setShowPassword(false)} />}

      <style>{`
        .topbar { position: sticky; top: 0; z-index: 50; height: 64px; display: flex; align-items: center; gap: 12px;
          padding: 0 16px; background: var(--accent); color: #fff; }
        .tb-brand { display: flex; align-items: center; gap: 10px; min-width: 0; color: inherit; text-decoration: none; }
        .tb-logo { width: 40px; height: 40px; flex: 0 0 40px; object-fit: contain; background: #fff; border-radius: 8px; padding: 3px; }
        .tb-title { display: flex; flex-direction: column; min-width: 0; }
        .tb-title strong { font-family: var(--font-display); font-size: 16px; font-weight: 800; line-height: 1.2; }
        .tb-title small { font-size: 12px; opacity: 0.85; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tb-space { flex: 1; }
        .tb-burger { display: none; flex-direction: column; justify-content: center; align-items: center; gap: 5px; width: 36px; height: 36px;
          padding: 0; background: transparent; border: none; color: #fff; cursor: pointer; flex-shrink: 0; }
        .tb-burger span { display: block; width: 22px; height: 2px; background: #fff; border-radius: 2px; }
        .tb-burger .tb-x { width: auto; height: auto; background: none; font-size: 20px; line-height: 1; }
        .tb-bell { position: relative; color: #fff; display: grid; place-items: center; width: 38px; height: 38px; flex-shrink: 0; }
        .tb-dot { position: absolute; top: 2px; right: 0; min-width: 17px; height: 17px; border-radius: 9px; padding: 0 4px;
          background: #fff; color: var(--accent); font-size: 10.5px; font-weight: 700; display: grid; place-items: center; }
        .tb-account { position: relative; flex-shrink: 0; }
        .tb-avatar { display: flex; align-items: center; gap: 9px; padding: 0; border: none; background: transparent; color: #fff; cursor: pointer; }
        .tb-initials { width: 38px; height: 38px; border-radius: 50%; background: #fff; color: var(--accent);
          display: grid; place-items: center; font-weight: 700; font-size: 13px; }
        .tb-name { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 600; }
        .tb-upload { display: inline-flex; align-items: center; gap: 7px; height: 38px; padding: 0 14px; border: none; border-radius: 8px;
          background: #fff; color: var(--accent); font-weight: 700; font-size: 13px; cursor: pointer; flex-shrink: 0; }
        .tb-upload:hover { background: var(--accent-bg); }
        .tb-menu { position: absolute; top: calc(100% + 12px); right: 0; z-index: 100; width: 250px; background: #fff;
          color: var(--text-primary); border: 1px solid var(--border); border-radius: 8px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.15); overflow: hidden; }
        .tb-me { padding: 12px 14px; border-bottom: 1px solid var(--border); }
        .tb-me strong { display: block; font-size: 13.5px; }
        .tb-me span { color: var(--text-tertiary); font-size: 12px; }
        .tb-menu button { display: block; width: 100%; text-align: left; padding: 11px 14px; background: none; border: none;
          font-size: 13.5px; color: var(--text-primary); cursor: pointer; }
        .tb-menu button:hover { background: var(--surface-alt); }
        .tb-stripe { position: sticky; top: 64px; z-index: 49; height: 6px; opacity: 0.55;
          background: repeating-linear-gradient(135deg, var(--accent) 0 6px, transparent 6px 12px); }

        @media (max-width: 768px) { .tb-burger { display: flex; } .tb-name { display: none; } .tb-upload { width: 38px; padding: 0; justify-content: center; } .tb-upload span { display: none; } }
        @media (max-width: 600px) { .tb-title small { display: none; } .topbar { padding: 0 10px; gap: 8px; } }
      `}</style>
    </>
  );
}
