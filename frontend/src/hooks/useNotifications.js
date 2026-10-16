import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

const POLL_MS = 30000;

// Checks the inbox every 30 seconds while the app is open. When something new
// arrives it returns a short message (shown as a toast) and, if the person
// allowed browser notifications and the tab is in the background, also sends
// a system notification.
export default function useNotifications() {
  const [unread, setUnread] = useState(0);
  const [message, setMessage] = useState(null);
  const known = useRef(null); // ids of unread items we've already seen

  const check = useCallback(async () => {
    try {
      const rows = await api.getInbox();
      const unreadRows = rows.filter((r) => !r.read);
      setUnread(unreadRows.length);

      if (known.current) {
        const fresh = unreadRows.filter((r) => !known.current.has(r.id));
        if (fresh.length > 0) {
          const first = fresh[0];
          const text =
            fresh.length > 1
              ? `${fresh.length} new items in your inbox`
              : first.kind === 'edit'
                ? `${first.sender_name} edited ${first.filename}`
                : `${first.sender_name} sent you ${first.filename}`;
          setMessage(text);
          if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
            try { new Notification('DocIntel', { body: text }); } catch { /* ignore */ }
          }
        }
      }
      known.current = new Set(unreadRows.map((r) => r.id));
    } catch {
      // Offline or the server is waking up: try again on the next round.
    }
  }, []);

  useEffect(() => {
    check();
    const timer = setInterval(check, POLL_MS);
    const onVisible = () => { if (!document.hidden) check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [check]);

  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(() => setMessage(null), 6000);
    return () => clearTimeout(t);
  }, [message]);

  return { unread, message, dismiss: () => setMessage(null), refresh: check };
}
