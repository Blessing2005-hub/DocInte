import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { REFRESH_EVENT } from '../hooks/useNotifications';
import DocViewerModal from '../components/DocViewerModal';
import { editFields } from '../utils/docFields';

const isPhone = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 820px)').matches;

function initials(name) {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

function shortTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function dayLabel(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const yest = new Date(); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function Inbox() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(null);       // username of the open conversation
  const [extra, setExtra] = useState([]);           // people you started a chat with but haven't sent to yet
  const [query, setQuery] = useState('');
  const [viewing, setViewing] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [phone, setPhone] = useState(isPhone());
  const [params] = useSearchParams();
  const wanted = params.get('with');
  const locationKey = useLocation().key;

  useEffect(() => {
    const onResize = () => setPhone(isPhone());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  async function load() {
    try {
      const data = await api.getThread();
      setItems(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError((prev) => prev || err.message || 'Could not load your messages.');
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 30000);
    return () => clearInterval(t);
  }, []);

  const conversations = useMemo(() => {
    const map = new Map();
    (items || []).forEach((it) => {
      if (!map.has(it.person_username)) {
        map.set(it.person_username, {
          username: it.person_username, name: it.person_name, department: it.person_department, items: [], unread: 0,
        });
      }
      const c = map.get(it.person_username);
      c.items.push(it);
      if (it.direction === 'in' && !it.read) c.unread += 1;
    });
    map.forEach((c) => c.items.sort((a, b) => new Date(a.sent_date) - new Date(b.sent_date)));
    extra.forEach((p) => {
      if (!map.has(p.username)) map.set(p.username, { username: p.username, name: p.full_name, department: p.department, items: [], unread: 0 });
    });
    return [...map.values()].sort((a, b) => {
      const ta = a.items.length ? new Date(a.items[a.items.length - 1].sent_date) : new Date();
      const tb = b.items.length ? new Date(b.items[b.items.length - 1].sent_date) : new Date();
      return tb - ta;
    });
  }, [items, extra]);

  const current = conversations.find((c) => c.username === active) || null;

  // A notification (or link) can ask for a particular person's conversation.
  useEffect(() => {
    if (wanted) setActive(wanted);
  }, [wanted, locationKey]);

  // Desktop: open the newest conversation by default.
  useEffect(() => {
    if (!phone && !active && conversations.length) setActive(conversations[0].username);
  }, [phone, active, conversations]);

  // Opening a conversation marks what they sent you as read.
  const unreadHere = current ? current.unread : 0;
  useEffect(() => {
    if (!current || unreadHere === 0) return;
    api.markThreadRead(current.username)
      .catch(() => {})
      .then(() => window.dispatchEvent(new Event(REFRESH_EVENT)));
    setItems((prev) => prev && prev.map((it) =>
      it.person_username === current.username && it.direction === 'in' ? { ...it, read: true } : it));
  }, [current?.username, unreadHere]);

  const q = query.trim().toLowerCase();
  const shown = conversations.filter((c) => !q || `${c.name} ${c.department} ${c.items.map((i) => i.filename).join(' ')}`.toLowerCase().includes(q));

  function openDoc(it) {
    setViewing({
      id: it.id,
      documentId: it.document_id,
      filename: it.filename,
      uploadType: 'sent',
      isOwn: it.direction === 'out',
      saved: it.saved,
      ...editFields(it),
    });
  }

  if (error && items === null) return <div className="empty-state" style={{ padding: 40 }}>{error}</div>;
  if (items === null) return <div className="skeleton" style={{ height: 300, margin: 24 }} />;

  const showList = !phone || !current;
  const showThread = !phone || !!current;

  return (
    <div className="chat-shell">
      {showList && (
        <div className="chat-list">
          <div className="chat-list-head">
            <h1>Inbox</h1>
            <button className="btn btn-primary chat-new" onClick={() => setShowPicker(true)}>+ New</button>
          </div>
          <input className="chat-search" type="search" placeholder="Search people or files…" value={query}
            onChange={(e) => setQuery(e.target.value)} />
          {shown.length === 0 && (
            <div className="empty-state">{conversations.length === 0 ? 'No messages yet. Tap “+ New” to send a document.' : 'No matches.'}</div>
          )}
          {shown.map((c) => {
            const last = c.items[c.items.length - 1];
            return (
              <div key={c.username} className={`chat-conv ${current?.username === c.username ? 'on' : ''}`}
                onClick={() => setActive(c.username)}>
                <div className="chat-av">{initials(c.name)}</div>
                <div className="chat-conv-mid">
                  <b>{c.name}</b>
                  <small>{last ? `${last.direction === 'out' ? 'You: ' : ''}${last.kind === 'edit' ? '✏️ ' : '📄 '}${last.filename}` : 'No messages yet'}</small>
                </div>
                <div className="chat-conv-meta">
                  {last && <span>{shortTime(last.sent_date)}</span>}
                  {c.unread > 0 && <span className="chat-badge">{c.unread}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showThread && (
        <div className="chat-thread">
          {current ? (
            <Thread
              key={current.username}
              conversation={current}
              phone={phone}
              onBack={() => setActive(null)}
              onOpen={openDoc}
              onSent={load}
            />
          ) : (
            <div className="empty-state" style={{ margin: 'auto' }}>Select a conversation, or tap “+ New”.</div>
          )}
        </div>
      )}

      {viewing && <DocViewerModal row={viewing} onClose={() => setViewing(null)} onChanged={load} />}
      {showPicker && (
        <PersonPicker
          onClose={() => setShowPicker(false)}
          onPick={(p) => {
            setExtra((e) => (e.some((x) => x.username === p.username) ? e : [...e, p]));
            setActive(p.username);
            setShowPicker(false);
          }}
        />
      )}

      <style>{`
        /* A fixed height (screen minus top bar and footer) keeps the search box and the
           message bar on screen; only the lists and the messages scroll. */
        .chat-shell { display: flex; height: calc(100vh - 112px); height: calc(100dvh - 112px); min-height: 360px; overflow: hidden; }
        .chat-list { width: 310px; flex: none; border-right: 1px solid var(--border); overflow-y: auto; background: var(--surface); }
        .chat-list-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 16px 10px; }
        .chat-list-head h1 { font-size: 19px; }
        .chat-new { padding: 6px 12px; font-size: 13px; }
        .chat-search { display: block; width: calc(100% - 24px); margin: 0 12px 8px; }
        .chat-conv { display: flex; gap: 10px; align-items: center; padding: 11px 14px; border-bottom: 1px solid var(--border); cursor: pointer; }
        .chat-conv:hover { background: var(--surface-alt); }
        .chat-conv.on { background: var(--accent-bg); }
        .chat-av { width: 38px; height: 38px; border-radius: 50%; background: var(--accent); color: #fff; display: grid;
          place-items: center; font-weight: 600; font-size: 13px; flex: none; }
        .chat-conv-mid { flex: 1; min-width: 0; }
        .chat-conv-mid b { display: block; font-size: 14px; }
        .chat-conv-mid small { display: block; color: var(--text-tertiary); font-size: 12px; white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis; }
        .chat-conv-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; font-size: 11px; color: var(--text-tertiary); }
        .chat-badge { background: var(--accent); color: #fff; border-radius: 10px; padding: 1px 7px; font-size: 11px; font-weight: 600; }
        .chat-thread { flex: 1; min-width: 0; display: flex; flex-direction: column; background: var(--bg); }
        @media (max-width: 820px) {
          .chat-list { width: 100%; border-right: 0; }
          .chat-shell { height: calc(100vh - 106px); height: calc(100dvh - 106px); }
        }
      `}</style>
    </div>
  );
}

function Thread({ conversation, phone, onBack, onOpen, onSent }) {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [showOpts, setShowOpts] = useState(false);
  const [extras, setExtras] = useState([]);          // more people to send the same file to
  const [publish, setPublish] = useState(false);     // also publish to the Library
  const [picking, setPicking] = useState(false);
  const endRef = useRef(null);
  const fileRef = useRef(null);
  const count = conversation.items.length;

  useEffect(() => { endRef.current && endRef.current.scrollIntoView({ block: 'end' }); }, [count]);

  async function send() {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.sendDocument(file, conversation.username, message.trim(), {
        also: extras.map((p) => p.username),
        publishLibrary: publish,
      });
      setExtras([]);
      setPublish(false);
      setShowOpts(false);
      setFile(null);
      setMessage('');
      if (fileRef.current) fileRef.current.value = '';
      await onSent();
    } catch (err) {
      setError(err.message || 'Could not send. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  let lastDay = null;
  return (
    <>
      <div className="th-head">
        {phone && <button className="th-back" onClick={onBack} aria-label="Back">←</button>}
        <div className="chat-av">{initials(conversation.name)}</div>
        <div>
          <b>{conversation.name}</b>
          <small>{conversation.department}</small>
        </div>
      </div>

      <div className="th-msgs">
        {count === 0 && <div className="empty-state">No documents yet. Attach one below to send it to {conversation.name}.</div>}
        {conversation.items.map((it) => {
          const day = dayLabel(it.sent_date);
          const header = day !== lastDay ? <div className="th-day">{day}</div> : null;
          lastDay = day;
          const mine = it.direction === 'out';
          const edit = it.kind === 'edit';
          return (
            <div key={it.id} className="th-row">
              {header}
              <div className={`th-bubble ${mine ? 'me' : ''}`}>
                <button className="th-file" onClick={() => onOpen(it)}>
                  <span className="th-icon">{edit ? '✏️' : '📄'}</span>
                  <span className="th-fname">
                    {it.filename}
                    <small>
                      {(it.file_type || '').replace('.', '').toUpperCase()} · v{it.version}
                      {edit && <span className="th-tag">edited</span>}
                    </small>
                  </span>
                </button>
                {it.message && <div className="th-text">{it.message}</div>}
                <div className="th-time">{shortTime(it.sent_date)}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="th-compose">
        {error && <p className="th-error" role="alert">{error}</p>}
        {file && (
          <div className="th-chip">
            📎 {file.name}
            <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }} aria-label="Remove file">✕</button>
          </div>
        )}
        {file && (
          <div className="th-more">
            <button className="th-morebtn" onClick={() => setShowOpts((v) => !v)}>
              ⚙ More sharing options{extras.length || publish ? ' •' : ''}
            </button>
            {showOpts && (
              <div className="th-opts">
                <div className="th-opt-title">Also send to other people</div>
                <div className="th-people">
                  {extras.map((p) => (
                    <span key={p.username} className="th-person">
                      {p.full_name}
                      <button onClick={() => setExtras((e) => e.filter((x) => x.username !== p.username))} aria-label={`Remove ${p.full_name}`}>✕</button>
                    </span>
                  ))}
                  <button className="th-add" onClick={() => setPicking(true)}>+ Add</button>
                </div>
                <label className="th-check">
                  <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
                  Publish to the Library
                </label>
                <small>{publish ? 'Everyone in the ministry will be able to open it.' : 'Only the people you pick can open it.'}</small>
              </div>
            )}
          </div>
        )}
        <div className="th-bar">
          <input ref={fileRef} type="file" hidden onChange={(e) => setFile(e.target.files[0] || null)} />
          <button className="th-attach" onClick={() => fileRef.current && fileRef.current.click()} aria-label="Attach a document">📎</button>
          <input className="th-input" type="text" placeholder={file ? 'Add a message (optional)' : 'Attach a document to send…'}
            value={message} onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }} maxLength={500} />
          <button className="btn btn-primary th-send" onClick={send} disabled={!file || busy}>{busy ? 'Sending…' : publish ? 'Send & publish' : extras.length ? `Send to ${extras.length + 1}` : 'Send'}</button>
        </div>
      </div>

      {picking && (
        <PersonPicker
          onClose={() => setPicking(false)}
          onPick={(p) => {
            if (p.username !== conversation.username) {
              setExtras((e) => (e.some((x) => x.username === p.username) ? e : [...e, p]));
            }
            setPicking(false);
          }}
        />
      )}

      <style>{`
        .th-more { margin-bottom: 6px; }
        .th-morebtn { border: 0; background: none; color: var(--accent); font-size: 12.5px; cursor: pointer; padding: 2px 0; }
        .th-opts { border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; background: var(--bg); margin-top: 4px; }
        .th-opt-title { font-size: 12.5px; font-weight: 600; margin-bottom: 6px; }
        .th-people { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
        .th-person { background: var(--accent-bg); border-radius: 12px; padding: 2px 4px 2px 10px; font-size: 12px; display: inline-flex; gap: 4px; align-items: center; }
        .th-person button { border: 0; background: none; cursor: pointer; color: var(--text-secondary); }
        .th-add { border: 1px dashed var(--border); background: none; border-radius: 12px; padding: 2px 10px; font-size: 12px; cursor: pointer; color: var(--accent); }
        .th-check { display: flex; gap: 8px; align-items: center; font-size: 13px; }
        .th-opts small { display: block; color: var(--text-tertiary); margin: 2px 0 0 24px; font-size: 12px; }
        .th-head { display: flex; align-items: center; gap: 10px; padding: 10px 16px; background: var(--surface); border-bottom: 1px solid var(--border); }
        .th-head b { display: block; font-size: 14.5px; }
        .th-head small { color: var(--text-tertiary); font-size: 12px; }
        .th-back { border: 0; background: none; font-size: 20px; cursor: pointer; padding: 0 6px 0 0; color: var(--text-primary); }
        .th-msgs { flex: 1; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; min-height: 0; }
        .th-row { display: flex; flex-direction: column; gap: 8px; }
        .th-day { align-self: center; font-size: 11.5px; color: var(--text-tertiary); background: var(--surface-alt);
          padding: 2px 10px; border-radius: 10px; margin: 6px 0; }
        .th-bubble { max-width: 72%; padding: 8px 10px; border-radius: 12px; background: var(--surface);
          box-shadow: 0 1px 1px rgba(0,0,0,0.06); align-self: flex-start; min-width: 0; }
        .th-bubble.me { align-self: flex-end; background: var(--accent-bg); }
        .th-file { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; border: 1px solid var(--border);
          background: var(--bg); border-radius: 8px; padding: 8px 10px; cursor: pointer; font: inherit; color: inherit; }
        .th-file:hover { border-color: var(--accent); }
        .th-icon { font-size: 20px; }
        .th-fname { font-size: 13.5px; font-weight: 500; min-width: 0; word-break: break-word; }
        .th-fname small { display: block; color: var(--text-tertiary); font-weight: 400; font-size: 11.5px; }
        .th-tag { margin-left: 6px; background: var(--gold-bg); color: var(--gold); border-radius: 6px; padding: 0 6px; }
        .th-text { margin-top: 6px; font-size: 13.5px; white-space: pre-wrap; word-break: break-word; }
        .th-time { font-size: 11px; color: var(--text-tertiary); text-align: right; margin-top: 3px; }
        .th-compose { background: var(--surface); border-top: 1px solid var(--border); padding: 8px 12px; }
        .th-bar { display: flex; gap: 8px; align-items: center; }
        .th-attach { border: 0; background: none; font-size: 20px; cursor: pointer; padding: 4px 6px; }
        .th-input { flex: 1; min-width: 0; }
        .th-send { padding: 8px 16px; }
        .th-chip { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; background: var(--surface-alt);
          border-radius: 12px; padding: 3px 10px; margin-bottom: 6px; max-width: 100%; word-break: break-all; }
        .th-chip button { border: 0; background: none; cursor: pointer; color: var(--text-secondary); }
        .th-error { color: var(--danger); font-size: 12.5px; margin-bottom: 6px; }
        @media (max-width: 820px) { .th-bubble { max-width: 88%; } }
      `}</style>
    </>
  );
}

function PersonPicker({ onClose, onPick }) {
  const [people, setPeople] = useState(null);
  const [query, setQuery] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api.getDirectory().then((l) => setPeople(Array.isArray(l) ? l : [])).catch(() => setFailed(true));
  }, []);

  const q = query.trim().toLowerCase();
  const shown = (people || []).filter((p) => !q || `${p.full_name} ${p.department || ''}`.toLowerCase().includes(q));

  return (
    <div className="pp-overlay" onClick={onClose}>
      <div className="pp-modal card" onClick={(e) => e.stopPropagation()}>
        <h2>New conversation</h2>
        <input type="search" placeholder="Search people…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
        <div className="pp-list">
          {failed && <div className="pp-empty">Could not load people.</div>}
          {!failed && people === null && <div className="pp-empty">Loading…</div>}
          {people && shown.length === 0 && <div className="pp-empty">No one found.</div>}
          {shown.map((p) => (
            <div key={p.username} className="pp-item" onClick={() => onPick(p)}>
              <span>{p.full_name}</span><small>{p.department}</small>
            </div>
          ))}
        </div>
        <div className="pp-actions"><button className="btn btn-secondary" onClick={onClose}>Cancel</button></div>
      </div>
      <style>{`
        .pp-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 50; display: flex; align-items: center; justify-content: center; padding: 16px; }
        .pp-modal { width: 100%; max-width: 380px; padding: 18px; background: var(--surface); }
        .pp-modal h2 { font-size: 16px; margin-bottom: 10px; }
        .pp-modal input { width: 100%; margin-bottom: 8px; }
        .pp-list { max-height: 280px; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px; }
        .pp-item { display: flex; justify-content: space-between; gap: 10px; padding: 9px 12px; border-bottom: 1px solid var(--border); cursor: pointer; font-size: 13.5px; }
        .pp-item:last-child { border-bottom: 0; }
        .pp-item:hover { background: var(--surface-alt); }
        .pp-item small { color: var(--text-tertiary); }
        .pp-empty { padding: 18px; text-align: center; color: var(--text-tertiary); font-size: 13px; }
        .pp-actions { display: flex; justify-content: flex-end; margin-top: 10px; }
      `}</style>
    </div>
  );
}
