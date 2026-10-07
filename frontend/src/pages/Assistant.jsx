import { useState } from 'react';
import { api } from '../api/client';

export default function Assistant() {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  async function handleAsk() {
    if (!question.trim()) return;
    const q = question;
    setQuestion('');
    setHistory((h) => [...h, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const res = await api.askAI(q);
      setHistory((h) => [...h, { role: 'ai', text: res.answer, sources: res.sources }]);
    } catch (err) {
      setHistory((h) => [...h, { role: 'ai', text: `Something went wrong: ${err.message}`, sources: [] }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="assistant-page">
      <div className="assistant-head">
        <h1>🤖 AI Assistant</h1>
        <p className="sub">Ask about any document you have access to. Answers only draw from documents you're permitted to see.</p>
      </div>

      <div className="chat-area">
        {history.length === 0 && (
          <div className="empty-hint">Ask something like "what's our policy on remote access?"</div>
        )}
        {history.map((msg, i) => (
          <div key={i} className={`bubble ${msg.role}`}>
            <p>{msg.text}</p>
            {msg.sources && msg.sources.length > 0 && (
              <div className="sources">Sources: {msg.sources.join(', ')}</div>
            )}
          </div>
        ))}
        {loading && <div className="bubble ai loading">Thinking…</div>}
      </div>

      <div className="ask-row">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
          placeholder="Ask a question about your documents…"
        />
        <button className="btn btn-primary" onClick={handleAsk} disabled={loading || !question.trim()}>Ask</button>
      </div>

      <style>{`
        .assistant-page { display: flex; flex-direction: column; height: 100%; padding: 0 24px; }
        .assistant-head { padding: 18px 0 14px; }
        .assistant-head h1 { font-size: 19px; }
        .sub { color: var(--text-tertiary); font-size: 12.5px; margin-top: 4px; }
        .chat-area { flex: 1; overflow-y: auto; padding: 12px 0; display: flex; flex-direction: column; gap: 12px; }
        .empty-hint { color: var(--text-tertiary); font-size: 13px; text-align: center; margin-top: 60px; }
        .bubble { max-width: 640px; padding: 12px 16px; border-radius: 12px; font-size: 13.5px; line-height: 1.6; }
        .bubble.user { align-self: flex-end; background: var(--accent); color: white; }
        .bubble.ai { align-self: flex-start; background: var(--surface-alt); }
        .bubble.loading { color: var(--text-tertiary); font-style: italic; }
        .sources { margin-top: 8px; font-size: 11px; color: var(--text-tertiary); }
        .ask-row { display: flex; gap: 10px; padding: 16px 0; border-top: 1px solid var(--border); }
        .ask-row input { flex: 1; height: 46px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface-alt); padding: 0 16px; }
        .ask-row input:focus { outline: none; border-color: var(--accent); background: var(--surface); }
      `}</style>
    </div>
  );
}
