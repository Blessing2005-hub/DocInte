import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

const POLL_MS = 30000;
export const REFRESH_EVENT = 'docintel:refresh-notifications';

// Groups unread incoming items by person, newest first, like a chat app's
// notification list: one entry per person with a count and their latest file.
function groupByPerson(unreadRows) {
  const map = new Map();
  unreadRows.forEach((r) => {
    if (!map.has(r.person_username)) {
      map.set(r.person_username, {
        username: r.person_username,
        name: r.person_name,
        count: 0,
        latest: r,
      });
    }
    const g = map.get(r.person_username);
    g.count += 1;
    if (new Date(r.sent_date) > new Date(g.latest.sent_date)) g.latest = r;
  });
  return [...map.values()].sort((a, b) => new Date(b.latest.sent_date) - new Date(a.latest.sent_date));
}

// Checks for new documents every 30 seconds while the app is open.
// Returns the unread count, the unread items grouped by person (for the bell's
// list), and a toast message that knows which conversation it belongs to.
export default function useNotifications(enabled = true) {
  const [unread, setUnread] = useState(0);
  const [groups, setGroups] = useState([]);
  const [message, setMessage] = useState(null); // { text, username }
  const known = useRef(null); // ids of unread items we've already seen

  const check = useCallback(async () => {
    if (!enabled) return;
    try {
      const rows = await api.getThread();
      const unreadRows = (Array.isArray(rows) ? rows : []).filter((r) => r.direction === 'in' && !r.read);
      setUnread(unreadRows.length);
      setGroups(groupByPerson(unreadRows));

      if (known.current) {
        const fresh = unreadRows.filter((r) => !known.current.has(r.id));
        if (fresh.length > 0) {
          const people = new Set(fresh.map((r) => r.person_username));
          const first = fresh[0];
          const text =
            fresh.length === 1
              ? first.kind === 'edit'
                ? `${first.person_name} edited ${first.filename}`
                : `${first.person_name} sent you ${first.filename}`
              : people.size === 1
                ? `${fresh.length} new items from ${first.person_name}`
                : `${fresh.length} new items in your inbox`;
          const username = people.size === 1 ? first.person_username : null;
          setMessage({ text, username });
          if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
            try {
              const n = new Notification('DocIntel', { body: text, tag: username || 'docintel' });
              n.onclick = () => {
                window.focus();
                window.location.assign(username ? `/inbox?with=${encodeURIComponent(username)}` : '/inbox');
              };
            } catch { /* ignore */ }
          }
        }
      }
      known.current = new Set(unreadRows.map((r) => r.id));
    } catch {
      // Offline or the server is waking up: try again on the next round.
    }
  }, [enabled]);

  const markAllRead = useCallback(async () => {
    const names = groups.map((g) => g.username);
    setUnread(0);
    setGroups([]);
    await Promise.all(names.map((u) => api.markThreadRead(u).catch(() => {})));
    check();
  }, [groups, check]);

  useEffect(() => {
    if (!enabled) return undefined;
    check();
    const timer = setInterval(check, POLL_MS);
    const onVisible = () => { if (!document.hidden) check(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(REFRESH_EVENT, check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(REFRESH_EVENT, check);
    };
  }, [check, enabled]);

  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(() => setMessage(null), 7000);
    return () => clearTimeout(t);
  }, [message]);

  return { unread, groups, message, dismiss: () => setMessage(null), refresh: check, markAllRead };
}
