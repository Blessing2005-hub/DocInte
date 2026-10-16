import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon from './Icon';

export function NavLinks({ onNavigate, unread = 0 }) {
  const { isAdmin } = useAuth();

  const links = [
    { to: '/', label: 'Home', icon: 'home', end: true },
    { to: '/inbox', label: 'Inbox', icon: 'inbox', badge: unread },
    { to: '/sent', label: 'Sent', icon: 'send' },
    { to: '/my-documents', label: 'My Documents', icon: 'file-text' },
    { to: '/library', label: 'Library', icon: 'library' },
    { to: '/assistant', label: 'AI Assistant', icon: 'sparkles' },
  ];

  if (isAdmin) {
    links.push(
      { to: '/admin/users', label: 'Manage Users', icon: 'users' },
      { to: '/admin/logs', label: 'Access Logs', icon: 'shield-check' }
    );
  }

  return (
    <nav className="side-nav" aria-label="Main navigation">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `side-link${isActive ? ' active' : ''}`
          }
        >
          <span className="side-link-icon">
            <Icon name={link.icon} />
          </span>
          <span className="side-link-label">{link.label}</span>

          {link.badge > 0 && (
            <span className="side-link-badge">
              {link.badge > 99 ? '99+' : link.badge}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export default function Sidebar({ onUpload, onNavigate, unread = 0 }) {
  return (
    <div className="side">
      <button
        type="button"
        className="side-upload"
        onClick={onUpload}
      >
        <span aria-hidden="true">＋</span>
        <span>Upload Document</span>
      </button>

      <NavLinks onNavigate={onNavigate} unread={unread} />

      <style>{`
        .side {
          width: 220px;
          min-height: 100%;
          padding: 16px 12px;
          background: var(--surface);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .side-upload {
          width: 100%;
          min-height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 0;
          border-radius: 9px;
          background: var(--accent);
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .side-upload:hover {
          filter: brightness(.96);
        }

        .side-nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .side-link {
          min-height: 42px;
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 10px 12px;
          border-radius: 8px;
          text-decoration: none;
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 500;
          transition: background .15s ease, color .15s ease;
        }

        .side-link:hover {
          background: var(--surface-alt);
          color: var(--text-primary);
        }

        .side-link.active {
          background: var(--accent-bg);
          color: var(--accent);
          font-weight: 650;
        }

        .side-link-icon {
          width: 20px;
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .side-link-label {
          flex: 1;
          min-width: 0;
        }

        .side-link-badge {
          min-width: 21px;
          padding: 2px 6px;
          border-radius: 20px;
          background: var(--accent);
          color: white;
          font-size: 10px;
          text-align: center;
          font-weight: 700;
        }

        @media (max-width: 768px) {
          .side {
            width: 100%;
            min-height: 100%;
          }
        }
      `}</style>
    </div>
  );
}