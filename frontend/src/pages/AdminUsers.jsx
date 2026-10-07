import { useEffect, useState } from 'react';
import { api } from '../api/client';

const EMPTY_FORM = { ec_number: '', username: '', full_name: '', department: '', role: 'Employee', password: '' };

export default function AdminUsers() {
  const [users, setUsers] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [newDepartment, setNewDepartment] = useState('');
  const [deptError, setDeptError] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const [data, depts] = await Promise.all([api.listUsers(), api.listDepartments()]);
    setUsers(data);
    setDepartments(depts);
  }

  async function handleAddDepartment(e) {
    e.preventDefault();
    setDeptError(null);
    try {
      await api.createDepartment(newDepartment);
      setNewDepartment('');
      load();
    } catch (err) {
      setDeptError(err.message);
    }
  }

  async function handleChangeDepartment(user, department) {
    setDeptError(null);
    try {
      await api.setUserDepartment(user.id, department);
    } catch (err) {
      setDeptError(err.message);
    }
    load();
  }

  async function handleCreate(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createUser(form);
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(user) {
    const next = user.status === 'Active' ? 'Disabled' : 'Active';
    await api.setUserStatus(user.id, next);
    load();
  }

  if (users === null) return <div className="skeleton" style={{ height: 300, margin: 24 }} />;

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div>
          <h1>Manage users</h1>
          <p className="sub">Create accounts and control access.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : '＋ New user'}
        </button>
      </div>

      {showForm && (
        <form className="card card-pad create-form" onSubmit={handleCreate}>
          <div className="form-grid">
            <div className="field">
              <label>EC Number</label>
              <input value={form.ec_number} onChange={(e) => setForm({ ...form, ec_number: e.target.value })} required />
            </div>
            <div className="field">
              <label>Username</label>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            </div>
            <div className="field">
              <label>Full name</label>
              <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
            <div className="field">
              <label>Department</label>
              <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required>
                <option value="">Select a department</option>
                {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option>Employee</option>
                <option>Manager</option>
                <option>Admin</option>
              </select>
            </div>
            <div className="field">
              <label>Temporary password</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
            </div>
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create user'}</button>
        </form>
      )}

      <div className="card card-pad dept-card">
        <h3>Departments</h3>
        <p className="sub">
          A department is chosen for every user. People can edit Library documents uploaded by their own department.
        </p>
        <div className="dept-chips">
          {departments.map((d) => <span key={d.id} className="badge badge-library dept-chip">{d.name}</span>)}
        </div>
        <form className="dept-add" onSubmit={handleAddDepartment}>
          <input
            value={newDepartment}
            onChange={(e) => setNewDepartment(e.target.value)}
            placeholder="New department name"
            maxLength={80}
            aria-label="New department name"
          />
          <button className="btn btn-secondary" disabled={!newDepartment.trim()}>Add department</button>
        </form>
        {deptError && <p className="form-error">{deptError}</p>}
      </div>

      <div className="card">
        <table>
          <thead>
            <tr><th>Name</th><th>EC Number</th><th>Username</th><th>Department</th><th>Role</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.full_name}</td>
                <td className="mono">{u.ec_number}</td>
                <td>{u.username}</td>
                <td>
                  <select
                    className="dept-select"
                    value={u.department || ''}
                    onChange={(e) => handleChangeDepartment(u, e.target.value)}
                    aria-label={`Department for ${u.full_name}`}
                  >
                    <option value="">None</option>
                    {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </td>
                <td><span className={`badge ${u.role === 'Admin' ? 'badge-admin' : 'badge-library'}`}>{u.role}</span></td>
                <td>{u.status}</td>
                <td><button className="btn-text" onClick={() => toggleStatus(u)}>{u.status === 'Active' ? 'Disable' : 'Enable'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`
        .admin-page { padding: 28px 32px; }
        .admin-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
        .admin-head h1 { font-size: 20px; }
        .sub { color: var(--text-tertiary); font-size: 12.5px; margin-top: 4px; }
        .create-form { margin-bottom: 20px; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; }
        .form-error { color: var(--danger); font-size: 13px; margin-bottom: 12px; }
        .dept-card { margin-bottom: 20px; }
        .dept-card h3 { font-size: 14.5px; margin-bottom: 4px; }
        .dept-chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0; }
        .dept-chip { text-transform: none; letter-spacing: 0; font-size: 12px; }
        .dept-add { display: flex; gap: 10px; }
        .dept-add input { flex: 1; height: 42px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface-alt); padding: 0 14px; }
        .dept-select { height: 32px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); padding: 0 8px; }
      `}</style>
    </div>
  );
}
