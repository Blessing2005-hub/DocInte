import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/ministry-logo.jpg';

export default function Sidebar({ onUpload }) {
  const { user, isAdmin, logout } = useAuth();

  return (
    <aside className="rail">
      <div className="brand">
        <img src={logo} alt="" className="brand-mark" />
        <span className="brand-name">DocIntel</span>
      </div>

      <button className="compose-btn" onClick={onUpload}>＋ Upload document</button>

      <NavLink to="/inbox" className={({ isActive }) => `folder${isActive ? ' active' : ''}`}>📥 Inbox</NavLink>
      <NavLink to="/sent" className={({ isActive }) => `folder${isActive ? ' active' : ''}`}>📤 Sent</NavLink>
      <NavLink to="/my-documents" className={({ isActive }) => `folder${isActive ? ' active' : ''}`}>📁 My Documents</NavLink>
      <NavLink to="/library" className={({ isActive }) => `folder${isActive ? ' active' : ''}`}>📚 Library</NavLink>
      <NavLink to="/assistant" className={({ isActive }) => `folder${isActive ? ' active' : ''}`}>🤖 AI Assistant</NavLink>

      {isAdmin && (
        <>
          <div className="rail-section-label">Admin</div>
          <NavLink to="/admin/users" className={({ isActive }) => `folder${isActive ? ' active' : ''}`}>👥 Manage users</NavLink>
          <NavLink to="/admin/logs" className={({ isActive }) => `folder${isActive ? ' active' : ''}`}>🧾 Access logs</NavLink>
        </>
      )}

      <div className="rail-bottom">
        <strong>{user?.full_name}</strong>
        {user?.ec_number} · {user?.department} · {user?.role}
        <button className="btn-text logout-btn" onClick={logout}>Sign out</button>
      </div>

      <style>{`
        .rail { width: var(--rail-width); flex-shrink: 0; background: var(--surface); border-right: 1px solid var(--border);
          padding: 18px 14px; display: flex; flex-direction: column; height: 100vh; position: sticky; top: 0; }
        .brand { display: flex; align-items: center; gap: 9px; padding: 0 4px 18px; margin-bottom: 14px; border-bottom: 1px solid var(--border); }
        .brand-mark { width: 28px; height: 28px; object-fit: contain; }
        .brand-name { font-family: var(--font-display); font-weight: 800; font-size: 14.5px; }
        .compose-btn { display: flex; align-items: center; gap: 8px; height: 42px; border-radius: 8px; background: var(--accent);
          color: white; border: none; font-weight: 600; font-size: 13px; padding: 0 14px; cursor: pointer; margin-bottom: 18px; }
        .compose-btn:hover { background: var(--accent-hover); }
        .folder { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 0 8px 8px 0;
          border-left: 3px solid transparent; color: var(--text-secondary); font-weight: 500; font-size: 13px;
          text-decoration: none; }
        .folder.active { background: var(--accent-bg); color: var(--accent); border-left-color: var(--accent); font-weight: 600; }
        .folder:hover:not(.active) { background: var(--surface-alt); }
        .rail-section-label { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
          color: var(--text-tertiary); padding: 16px 12px 6px; }
        .rail-bottom { margin-top: auto; padding: 12px; background: var(--surface-alt); border-radius: 10px; font-size: 11.5px; color: var(--text-tertiary); }
        .rail-bottom strong { color: var(--text-secondary); display: block; margin-bottom: 2px; font-size: 12px; }
        .logout-btn { display: block; margin-top: 8px; padding: 0; font-size: 11.5px; }
      `}</style>
    </aside>
  );
}
