import { useEffect, useState } from 'react';
import { api } from '../api/client';
import DocumentList from '../components/DocumentList';
import { editFields } from '../utils/docFields';

// Everything that is "yours": documents you uploaded or sent, plus documents
// other people sent to you.
export default function MyDocuments() {
  const [rows, setRows] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const [mine, inbox] = await Promise.all([
      api.listMine(),
      api.getInbox().catch(() => []), // if this fails, still show your own uploads
    ]);

    const own = mine.map((d) => ({
      id: `own-${d.id}`,
      documentId: d.id,
      filename: d.filename,
      uploadType: d.upload_type,
      date: d.upload_date,
      read: true,
      canDelete: true,
      ...editFields(d),
    }));

    // Received documents: one row per document (newest), skipping "edited" notices
    // and anything you also uploaded yourself.
    const ownIds = new Set(mine.map((d) => d.id));
    const seen = new Set();
    const received = [];
    for (const d of inbox) {
      if (d.kind === 'edit' || ownIds.has(d.document_id) || seen.has(d.document_id)) continue;
      seen.add(d.document_id);
      received.push({
        id: `recv-${d.id}`,
        documentId: d.document_id,
        filename: d.filename,
        uploadType: 'sent',
        badge: 'received',
        person: d.sender_name,
        personLabel: 'from',
        snippet: d.message,
        message: d.message,
        date: d.sent_date,
        read: true,
        canDelete: false,
        ...editFields(d),
      });
    }

    setRows([...own, ...received].sort((a, b) => new Date(b.date) - new Date(a.date)));
  }

  function handleDeleted(row) {
    setRows((prev) => prev.filter((r) => r.documentId !== row.documentId));
  }

  if (rows === null) return <div className="skeleton" style={{ height: 300, margin: 24 }} />;

  return (
    <DocumentList
      title="My Documents"
      rows={rows}
      emptyText="Nothing here yet. Documents you upload, send or receive will show up here."
      allowDelete
      onDeleted={handleDeleted}
      onChanged={load}
    />
  );
}
