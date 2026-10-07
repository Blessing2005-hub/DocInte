import { useEffect, useState } from 'react';
import { api } from '../api/client';
import DocumentList from '../components/DocumentList';
import { editFields } from '../utils/docFields';

export default function Inbox() {
  const [rows, setRows] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const data = await api.getInbox();
    setRows(data.map((d) => ({
      id: d.id,
      documentId: d.document_id,
      filename: d.filename,
      uploadType: 'sent',
      // An "edit" row is a notice that someone saved a new version.
      icon: d.kind === 'edit' ? '✏️' : undefined,
      badge: d.kind === 'edit' ? 'edited' : undefined,
      person: d.sender_name,
      personLabel: 'from',
      snippet: d.message,
      message: d.message,
      date: d.sent_date,
      read: d.read,
      ...editFields(d),
    })));
    data.filter((d) => !d.read).forEach((d) => api.markRead(d.id));
  }

  if (rows === null) return <div className="skeleton" style={{ height: 300, margin: 24 }} />;

  return <DocumentList title="Inbox" rows={rows} emptyText="Your inbox is empty." onChanged={load} />;
}
