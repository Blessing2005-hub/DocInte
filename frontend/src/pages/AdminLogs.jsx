import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function AdminLogs() {
  const [logs, setLogs] = useState(null);

  useEffect(() => {
    api.getAccessLogs().then(setLogs);
  }, []);

  if (logs === null) return <div className="skeleton" style={{ height: 300, margin: 24 }} />;

  return (
    <div className="admin-page">
      <h1>Access logs</h1>
      <p className="sub">Every login, upload, download, share, edit, restore, deletion, and AI question, in order.</p>

      <div className="card" style={{ marginTop: 16 }}>
        <table>
          <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Detail</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="mono">{new Date(l.timestamp).toLocaleString()}</td>
                <td>{l.user_name || '—'}</td>
                <td><span className="badge badge-library">{l.action}</span></td>
                <td>{l.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`
        .admin-page { padding: 28px 32px; }
        .admin-page h1 { font-size: 20px; }
        .sub { color: var(--text-tertiary); font-size: 12.5px; margin-top: 4px; }
      `}</style>
    </div>
  );
}
