import { useEffect, useState } from 'react';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import useNotifications from './hooks/useNotifications';
import UploadModal from './components/UploadModal';

import Login from './pages/Login';
import Home from './pages/Home';
import Inbox from './pages/Inbox';
import MyDocuments from './pages/MyDocuments';
import Library from './pages/Library';
import Assistant from './pages/Assistant';
import AdminUsers from './pages/AdminUsers';
import AdminLogs from './pages/AdminLogs';

function ProtectedShell() {
  const { user, loading, isAdmin } = useAuth();

  const [showUpload, setShowUpload] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { unread, groups, message, dismiss, refresh, markAllRead } =
    useNotifications(!!user);

  const navigate = useNavigate();
  function openChat(username) {
    navigate(username ? `/inbox?with=${encodeURIComponent(username)}` : '/inbox');
  }

  const location = useLocation();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refresh();
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [location.pathname, location.search, refresh]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    }

    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [mobileMenuOpen]);

  if (loading) {
    return <div className="app-loading">Loading…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  function openUpload() {
    setMobileMenuOpen(false);
    setShowUpload(true);
  }

  return (
    <div className="app-shell">
      <TopBar
        unread={unread}
        notifications={groups}
        onOpenChat={openChat}
        onMarkAllRead={markAllRead}
        onUpload={openUpload}
        onMenuToggle={() =>
          setMobileMenuOpen((open) => !open)
        }
        mobileMenuOpen={mobileMenuOpen}
      />

      <div className="app-body">
        {mobileMenuOpen && (
          <button
            type="button"
            className="mobile-sidebar-backdrop"
            aria-label="Close navigation menu"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        <aside
          id="app-navigation"
          className={
            `app-sidebar${mobileMenuOpen ? ' app-sidebar-open' : ''}`
          }
          aria-label="Main navigation"
          aria-hidden={
            typeof window !== 'undefined' &&
            window.matchMedia('(max-width: 768px)').matches
              ? !mobileMenuOpen
              : undefined
          }
          inert={
            typeof window !== 'undefined' &&
            window.matchMedia('(max-width: 768px)').matches &&
            !mobileMenuOpen
              ? ''
              : undefined
          }
        >
          <Sidebar
            unread={unread}
            onNavigate={() => setMobileMenuOpen(false)}
            onUpload={openUpload}
          />
        </aside>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route
              path="/inbox"
              element={<Inbox key={`inbox-${refreshKey}`} />}
            />
            <Route
              path="/sent"
              element={<Navigate to="/inbox" replace />}
            />
            <Route
              path="/my-documents"
              element={
                <MyDocuments key={`mine-${refreshKey}`} />
              }
            />
            <Route
              path="/library"
              element={<Library key={`library-${refreshKey}`} />}
            />
            <Route path="/assistant" element={<Assistant />} />

            {isAdmin && (
              <Route
                path="/admin/users"
                element={<AdminUsers />}
              />
            )}

            {isAdmin && (
              <Route
                path="/admin/logs"
                element={<AdminLogs />}
              />
            )}

            <Route
              path="*"
              element={<Navigate to="/" replace />}
            />
          </Routes>
        </main>
      </div>

      <footer className="app-footer">
        Ministry of Industry and Commerce 
      </footer>

      {message && (
        <button
          type="button"
          className="toast"
          role="status"
          onClick={() => { openChat(message.username); dismiss(); }}
        >
          <span>{message.text}</span>
          <small>Tap to open</small>
        </button>
      )}

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={() => {
            setShowUpload(false);
            setRefreshKey((key) => key + 1);
            refresh();
          }}
        />
      )}

      <style>{`
        * {
          box-sizing: border-box;
        }

        html,
        body,
        #root {
          width: 100%;
          min-width: 0;
          max-width: 100%;
          margin: 0;
        }

        body {
          overflow-x: hidden;
        }

        .app-shell {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          min-width: 0;
          width: 100%;
          max-width: 100%;
        }

        .app-body {
          display: flex;
          flex: 1;
          min-width: 0;
          width: 100%;
          max-width: 100%;
          position: relative;
        }

        .app-sidebar {
          flex: 0 0 220px;
          min-width: 0;
          border-right: 1px solid var(--border);
          background: var(--surface);
        }

        .app-main {
          flex: 1 1 0;
          min-width: 0;
          width: 0;
          max-width: 100%;
          overflow-wrap: anywhere;
        }

        .app-main > * {
          animation: page-in .22s ease both;
        }

        @keyframes page-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: none; }
        }

        .app-footer {
          background: var(--surface);
          border-top: 1px solid var(--border);
          text-align: center;
          color: var(--text-tertiary);
          font-size: 12px;
          padding: 12px 16px;
        }

        .app-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          color: var(--text-tertiary);
        }

        .mobile-sidebar-backdrop {
          display: none;
        }

        @media (max-width: 768px) {
          .app-body {
            overflow-x: clip;
          }

          .app-sidebar {
            position: fixed;
            top: 0;
            bottom: 0;
            left: 0;
            z-index: 1001;
            width: min(290px, 85vw);
            max-width: 85vw;
            min-height: 0;
            overflow-y: auto;
            overflow-x: hidden;
            transform: translateX(-105%);
            visibility: hidden;
            transition:
              transform .25s ease,
              visibility .25s ease;
            box-shadow: none;
          }

          .app-sidebar.app-sidebar-open {
            transform: translateX(0);
            visibility: visible;
            box-shadow: 8px 0 30px rgba(0, 0, 0, .15);
          }

          .mobile-sidebar-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 1000;
            width: 100%;
            height: 100%;
            border: 0;
            padding: 0;
            background: rgba(15, 23, 42, .45);
            cursor: pointer;
          }

          .app-main {
            width: 100%;
            min-width: 0;
            max-width: 100%;
          }

          .app-footer {
            padding: 10px 12px;
            font-size: 11px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .app-sidebar {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}

function LoginRoute() {
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/*" element={<ProtectedShell />} />
      </Routes>
    </AuthProvider>
  );
}
