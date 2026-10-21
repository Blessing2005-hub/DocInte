import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import DocumentList from '../components/DocumentList';
import { editFields } from '../utils/docFields';

const DATE_OPTIONS = [
  { value: 'any', label: 'Any time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '365', label: 'Last year' },
];

// Every file type the app accepts, so the filter always has choices.
// Each group matches a list of extensions.
const TYPE_GROUPS = [
  { value: 'pdf', label: 'PDF', exts: ['.pdf'] },
  { value: 'word', label: 'Word', exts: ['.doc', '.docx'] },
  { value: 'excel', label: 'Excel', exts: ['.xls', '.xlsx'] },
  { value: 'powerpoint', label: 'PowerPoint', exts: ['.ppt', '.pptx'] },
  { value: 'image', label: 'Images', exts: ['.png', '.jpg', '.jpeg'] },
  { value: 'text', label: 'Text', exts: ['.txt'] },
];

export default function Library() {
  const [allDepartments, setAllDepartments] = useState([]);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [dept, setDept] = useState('');
  const [type, setType] = useState('');
  const [when, setWhen] = useState('any');

  useEffect(() => {
    load();
    api.listDepartments()
      .then((list) => setAllDepartments((Array.isArray(list) ? list : []).map((d) => d.name)))
      .catch(() => {});
  }, []);

  async function load() {
    try {
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
    } catch (err) {
      setError(err.message || 'Could not load the library.');
    }
  }

  const departments = useMemo(
    () => [...new Set([...allDepartments, ...(rows || []).map((r) => r.department).filter(Boolean)])].sort(),
    [allDepartments, rows],
  );

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    const cutoff = when === 'any' ? null : Date.now() - Number(when) * 86400000;
    return rows.filter((r) => {
      if (q && !`${r.filename} ${r.person || ''} ${r.department || ''}`.toLowerCase().includes(q)) return false;
      if (dept && r.department !== dept) return false;
      if (type) {
        const group = TYPE_GROUPS.find((g) => g.value === type);
        const ext = (r.fileType || '').toLowerCase();
        const dotted = ext.startsWith('.') ? ext : `.${ext}`;
        if (!group || !group.exts.includes(dotted)) return false;
      }
      if (cutoff && new Date(r.date).getTime() < cutoff) return false;
      return true;
    });
  }, [rows, query, dept, type, when]);

  if (error) return <div className="empty-state" style={{ padding: 40 }}>{error}</div>;
  if (rows === null) return <div className="skeleton" style={{ height: 300, margin: 24 }} />;

  const active = query || dept || type || when !== 'any';
  function clear() { setQuery(''); setDept(''); setType(''); setWhen('any'); }

  const toolbar = (
    <div className="lib-filters">
      <input type="search" placeholder="Search by name, uploader or department…" value={query}
        onChange={(e) => setQuery(e.target.value)} />
      <select value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department">
        <option value="">All departments</option>
        {departments.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
      <select value={type} onChange={(e) => setType(e.target.value)} aria-label="File type">
        <option value="">All types</option>
        {TYPE_GROUPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
      </select>
      <select value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Date">
        {DATE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {active && <button className="btn btn-secondary lib-clear" onClick={clear}>Clear</button>}
      <style>{`
        .lib-filters { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 24px 12px; border-bottom: 1px solid var(--border); }
        .lib-filters input { flex: 1 1 220px; min-width: 0; }
        .lib-filters select { flex: 0 1 auto; max-width: 100%; }
        .lib-clear { padding: 6px 12px; }
        @media (max-width: 820px) { .lib-filters { padding: 0 14px 10px; } }
      `}</style>
    </div>
  );

  return (
    <DocumentList
      title="Library"
      rows={filtered}
      totalCount={rows.length}
      toolbar={toolbar}
      emptyText={active ? 'No documents match your filters.' : 'No documents in the shared library yet.'}
      onChanged={load}
    />
  );
}
