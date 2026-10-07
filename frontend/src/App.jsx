import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import UploadModal from './components/UploadModal';
import Login from './pages/Login';
import Home from './pages/Home';
import Inbox from './pages/Inbox';
import Sent from './pages/Sent';
import MyDocuments from './pages/MyDocuments';
import Library from './pages/Library';
import Assistant from './pages/Assistant';
import AdminUsers from './pages/AdminUsers';
import AdminLogs from './pages/AdminLogs';

function ProtectedShell() {
  const { user, loading, isAdmin } = useAuth();
  const [showUpload, setShowUpload] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  if (loading) return <div className="app-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="app-shell">
      <Sidebar onUpload={() => setShowUpload(true)} />
      <div className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/inbox" element={<Inbox key={refreshKey} />} />
          <Route path="/sent" element={<Sent key={refreshKey} />} />
          <Route path="/my-documents" element={<MyDocuments key={refreshKey} />} />
          <Route path="/library" element={<Library key={refreshKey} />} />
          <Route path="/assistant" element={<Assistant />} />
          {isAdmin && <Route path="/admin/users" element={<AdminUsers />} />}
          {isAdmin && <Route path="/admin/logs" element={<AdminLogs />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {showUpload && (
        <UploadModal onClose={() => setShowUpload(false)} onUploaded={() => setRefreshKey((k) => k + 1)} />
      )}

      <style>{`
        .app-shell { display: flex; min-height: 100vh; }
        .app-main { flex: 1; min-width: 0; }
        .app-loading { display: flex; align-items: center; justify-content: center; height: 100vh; color: var(--text-tertiary); }
      `}</style>
    </div>
  );
}

function LoginRoute() {
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;
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
