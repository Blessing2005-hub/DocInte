import { useEffect, useState } from 'react';
import { api } from '../api/client';
import DocumentList from '../components/DocumentList';
import { editFields } from '../utils/docFields';

export default function Library() {
  const [rows, setRows] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const data = await api.listLibrary();
    setRows(data.map((d) => ({
      id: d.id,
      documentId: d.id,
      filename: d.filename,
      uploadType: 'library',
      person: d.uploader_name,
      personLabel: 'by',
      date: d.upload_date,
      read: true,
      ...editFields(d),
    })));
  }

  if (rows === null) return <div className="skeleton" style={{ height: 300, margin: 24 }} />;

  return <DocumentList title="Library" rows={rows} emptyText="No documents in the shared library yet." onChanged={load} />;
}
