import { useAuth } from '../context/AuthContext';
import logo from '../assets/ministry-logo.jpg';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="home-page">
      <div className="home-hero">
        <img src={logo} alt="Ministry of Industry and Commerce" className="home-logo" />
        <div>
          <h1>DocIntel</h1>
          <p className="home-sub">Ministry of Industry and Commerce — Document Intelligence Platform</p>
        </div>
      </div>

      <p className="home-welcome">Welcome back, {user?.full_name?.split(' ')[0]}.</p>

      <div className="feature-grid">
        <div className="feature-card">
          <span className="feature-icon">📥</span>
          <h3>Inbox &amp; Sharing</h3>
          <p>Documents sent directly to you, and files you've shared with colleagues.</p>
        </div>
        <div className="feature-card">
          <span className="feature-icon">📚</span>
          <h3>Shared Library</h3>
          <p>Browse and search documents available to the whole organization.</p>
        </div>
        <div className="feature-card">
          <span className="feature-icon">🤖</span>
          <h3>AI Assistant</h3>
          <p>Ask questions and get answers drawn only from documents you have access to.</p>
        </div>
      </div>

      <style>{`
        .home-page { padding: 32px 40px; max-width: 900px; }
        .home-hero { display: flex; align-items: center; gap: 20px; margin-bottom: 24px; }
        .home-logo { width: 72px; height: 72px; object-fit: contain; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 8px; }
        .home-hero h1 { font-size: 26px; }
        .home-sub { color: var(--text-secondary); font-size: 13px; margin-top: 4px; }
        .home-welcome { color: var(--text-secondary); font-size: 14px; margin-bottom: 28px; }
        .feature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .feature-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 20px; }
        .feature-icon { font-size: 22px; }
        .feature-card h3 { font-size: 14.5px; margin: 10px 0 6px; }
        .feature-card p { font-size: 12.5px; color: var(--text-secondary); }
        @media (max-width: 700px) { .feature-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
