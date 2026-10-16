import { useEffect, useState } from 'react';
import { api } from '../api/client';
import DocumentList from '../components/DocumentList';
import { editFields } from '../utils/docFields';

export default function MyDocuments() {
  const [rows, setRows] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const data = await api.listMine();
    setRows(data.map(mapDoc));
  }

  function mapDoc(d) {
    return {
      id: d.id,
      documentId: d.id,
      filename: d.filename,
      uploadType: d.upload_type,
      date: d.upload_date,
      read: true,
      ...editFields(d),
    };
  }

  function handleDeleted(row) {
    setRows((prev) => prev.filter((r) => r.documentId !== row.documentId));
  }

  if (rows === null) return <div className="skeleton" style={{ height: 300, margin: 24 }} />;

  return <DocumentList title="My Documents" rows={rows} emptyText="You haven't uploaded anything yet." allowDelete onDeleted={handleDeleted} onChanged={load} />;
}
