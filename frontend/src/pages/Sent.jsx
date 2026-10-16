import { useEffect, useState } from 'react';
import { api } from '../api/client';
import DocumentList from '../components/DocumentList';
import { editFields } from '../utils/docFields';

export default function Sent() {
  const [rows, setRows] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const data = await api.getSent();
    setRows(data.map((d) => ({
      id: d.id,
      documentId: d.document_id,
      filename: d.filename,
      uploadType: 'sent',
      person: d.sender_name,
      personLabel: 'to',
      snippet: d.message,
      message: d.message,
      date: d.sent_date,
      read: true,
      ...editFields(d),
    })));
  }

  if (rows === null) return <div className="skeleton" style={{ height: 300, margin: 24 }} />;

  return <DocumentList title="Sent" rows={rows} emptyText="You haven't sent anything yet." onChanged={load} />;
}
