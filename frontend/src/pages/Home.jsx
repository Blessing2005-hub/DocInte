import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icons';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function timeAgo(value) {
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return '';
  const secs = Math.max(0, (Date.now() - then.getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return then.toLocaleDateString();
}

// Short label + colour for the little file badge.
function fileKind(type = '', name = '') {
  const t = `${type} ${name}`.toLowerCase();
  if (t.includes('pdf')) return { label: 'PDF', color: '#B3261E' };
  if (t.includes('doc')) return { label: 'DOC', color: '#2B579A' };
  if (t.includes('xls') || t.includes('sheet') || t.includes('csv')) return { label: 'XLS', color: '#1E7145' };
  if (t.includes('ppt') || t.includes('presentation')) return { label: 'PPT', color: '#C43E1C' };
  if (/(png|jpe?g|image|gif)/.test(t)) return { label: 'IMG', color: '#7B4EA3' };
  return { label: 'TXT', color: '#5F6B63' };
}

const BADGE_CLASS = { library: 'Library', private: 'Private', sent: 'Sent' };

export default function Home() {
  const { user } = useAuth();
  const [counts, setCounts] = useState({ inbox: null, mine: null, library: null });
  const [recent, setRecent] = useState(null);

  useEffect(() => {
    let mine = [];
    let library = [];
    let pending = 2;
    const done = () => {
      pending -= 1;
      if (pending > 0) return;
      const byId = new Map();
      [...mine, ...library].forEach((d) => byId.set(d.id, d));
      const sorted = [...byId.values()].sort(
        (a, b) => new Date(b.updated_date || b.upload_date) - new Date(a.updated_date || a.upload_date)
      );
      setRecent(sorted.slice(0, 5));
    };

    api.getInbox().then((r) => setCounts((c) => ({ ...c, inbox: r.filter((x) => !x.read).length }))).catch(() => {});
    api.listMine()
      .then((r) => { mine = r; setCounts((c) => ({ ...c, mine: r.length })); })
      .catch(() => {})
      .finally(done);
    api.listLibrary()
      .then((r) => { library = r; setCounts((c) => ({ ...c, library: r.length })); })
      .catch(() => {})
      .finally(done);
  }, []);

  const first = user?.full_name?.split(' ')[0];
  const num = (n) => (n === null ? <span className="skeleton home-skel-num" /> : n);

  return (
    <div className="home">
      <section className="home-card">
        <div className="home-badges">
          <span className="pill">{user?.role}</span>
          {user?.department && <span className="pill solid">{user.department}</span>}
        </div>
        <h1>{greeting()}, {first}</h1>
        <p className="home-sub">{user?.ec_number} · Welcome to DocIntel</p>
        <div className="home-actions">
          <Link to="/inbox" className="home-btn">Open inbox</Link>
          <Link to="/library" className="home-btn alt">Browse the Library</Link>
        </div>
      </section>

      <div className="home-grid">
        <Link to="/inbox" className="home-tile">
          <Icon name="inbox" />
          <h3>Inbox</h3>
          <b>{num(counts.inbox)}</b>
          <span>unread</span>
        </Link>
        <Link to="/my-documents" className="home-tile">
          <Icon name="folder" />
          <h3>My Documents</h3>
          <b>{num(counts.mine)}</b>
          <span>uploaded by you</span>
        </Link>
        <Link to="/library" className="home-tile">
          <Icon name="book" />
          <h3>Library</h3>
          <b>{num(counts.library)}</b>
          <span>shared with everyone</span>
        </Link>
      </div>

      <section className="home-recent">
        <h2>Recent documents</h2>
        {recent === null && (
          <div className="home-list">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton home-skel-row" />)}
          </div>
        )}
        {recent !== null && recent.length === 0 && (
          <div className="home-empty">
            <strong>No documents yet</strong>
            <span>Use “Upload” at the top to add your first document.</span>
          </div>
        )}
        {recent !== null && recent.length > 0 && (
          <div className="home-list">
            {recent.map((d) => {
              const kind = fileKind(d.file_type, d.filename);
              return (
                <Link key={d.id} to={d.upload_type === 'library' ? '/library' : '/my-documents'} className="home-row">
                  <span className="home-file" style={{ background: kind.color }}>{kind.label}</span>
                  <span className="home-row-main">
                    <strong>{d.filename}</strong>
                    <small>{d.uploader_name} · {timeAgo(d.updated_date || d.upload_date)}</small>
                  </span>
                  <span className={`home-tag tag-${d.upload_type}`}>{BADGE_CLASS[d.upload_type] || d.upload_type}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <style>{`
        .home { padding: 24px; max-width: 880px; }
        .home-card, .home-tile { background: var(--surface); border: 1px solid var(--border); border-left: 4px solid var(--accent); border-radius: 8px; }
        .home-card { padding: 20px; margin-bottom: 14px; }
        .home-badges { display: flex; gap: 8px; margin-bottom: 10px; }
        .pill { font-size: 12px; font-weight: 600; padding: 3px 12px; border-radius: 999px; border: 1px solid var(--border); color: var(--accent); background: #fff; }
        .pill.solid { background: var(--accent); border-color: var(--accent); color: #fff; }
        .home-card h1 { font-size: 22px; margin-bottom: 4px; }
        .home-sub { color: var(--text-secondary); margin-bottom: 14px; }
        .home-actions { display: flex; gap: 10px; }
        .home-btn { flex: 1; text-align: center; text-decoration: none; padding: 12px; border-radius: 6px; font-weight: 600;
          background: var(--accent); color: #fff; transition: background 120ms ease; }
        .home-btn:hover { background: var(--accent-hover); }
        .home-btn.alt { background: #fff; color: var(--text-primary); border: 1px solid var(--border); }
        .home-btn.alt:hover { background: var(--surface-alt); }
        .home-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 22px; }
        .home-tile { display: flex; flex-direction: column; gap: 2px; padding: 18px; text-decoration: none; color: var(--text-primary);
          transition: transform 120ms ease, box-shadow 120ms ease; }
        .home-tile:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.07); }
        .home-tile svg { color: var(--accent); margin-bottom: 6px; }
        .home-tile h3 { font-size: 15px; }
        .home-tile b { font-size: 26px; color: var(--accent); font-family: var(--font-display); min-height: 34px; }
        .home-tile span { color: var(--text-tertiary); font-size: 12.5px; }
        .home-skel-num { display: block; width: 48px; height: 26px; }
        .home-recent h2 { font-size: 15px; margin-bottom: 10px; }
        .home-list { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
        .home-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; text-decoration: none; color: var(--text-primary);
          border-bottom: 1px solid var(--border); transition: background 120ms ease; }
        .home-row:last-child { border-bottom: none; }
        .home-row:hover { background: var(--surface-alt); }
        .home-file { flex: 0 0 38px; height: 38px; border-radius: 8px; color: #fff; font-size: 10.5px; font-weight: 700;
          display: grid; place-items: center; letter-spacing: 0.02em; }
        .home-row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .home-row-main strong { font-size: 13.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .home-row-main small { color: var(--text-tertiary); font-size: 12px; }
        .home-tag { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 999px; background: var(--accent-bg); color: var(--accent); flex-shrink: 0; }
        .home-tag.tag-private { background: var(--gold-bg); color: var(--gold); }
        .home-tag.tag-sent { background: var(--blue-bg); color: var(--blue); }
        .home-skel-row { height: 62px; border-radius: 0; margin: 0; border-bottom: 1px solid var(--border); }
        .home-empty { display: flex; flex-direction: column; gap: 4px; padding: 26px 18px; text-align: center; background: var(--surface);
          border: 1px dashed var(--border); border-radius: 8px; }
        .home-empty span { color: var(--text-tertiary); font-size: 13px; }
        @media (max-width: 700px) {
          .home { padding: 14px; }
          .home-grid { gap: 8px; }
          .home-tile { padding: 12px 10px; }
          .home-tile svg { width: 20px; height: 20px; margin-bottom: 2px; }
          .home-tile h3 { font-size: 12px; }
          .home-tile b { font-size: 22px; min-height: 28px; }
          .home-tile span { font-size: 11px; }
          .home-actions { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}
