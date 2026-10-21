import { useEffect, useState } from 'react';
import { api } from '../api/client';
import DocumentList from '../components/DocumentList';
import { editFields } from '../utils/docFields';

// Documents you uploaded or sent, plus the ones you chose to save from your Inbox.
export default function MyDocuments() {
  const [rows, setRows] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const [mine, saved] = await Promise.all([
      api.listMine(),
      api.listSaved().catch(() => []), // if this fails, still show your own uploads
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

    const ownIds = new Set(mine.map((d) => d.id));
    const keptRows = saved
      .filter((d) => !ownIds.has(d.id))
      .map((d) => ({
        id: `saved-${d.id}`,
        documentId: d.id,
        filename: d.filename,
        uploadType: d.upload_type,
        badge: 'saved',
        person: d.uploader_name,
        personLabel: 'from',
        date: d.upload_date,
        read: true,
        canDelete: false,
        canUnsave: true,
        ...editFields(d),
      }));

    setRows([...own, ...keptRows].sort((a, b) => new Date(b.date) - new Date(a.date)));
  }

  function handleDeleted(row) {
    setRows((prev) => prev.filter((r) => r.documentId !== row.documentId));
  }

  if (rows === null) return <div className="skeleton" style={{ height: 300, margin: 24 }} />;

  return (
    <DocumentList
      title="My Documents"
      rows={rows}
      emptyText="Nothing here yet. Documents you upload, and ones you save from your Inbox, will show up here."
      allowDelete
      onDeleted={handleDeleted}
      onChanged={load}
    />
  );
}
