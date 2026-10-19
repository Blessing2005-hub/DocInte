import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import ResetRequests from '../components/ResetRequests';

const EMPTY_FORM = {
  ec_number: '',
  username: '',
  full_name: '',
  department: '',
  role: 'Employee',
  password: '',
};

export default function AdminUsers() {
  const { user: me } = useAuth();

  const [dialog, setDialog] = useState(null);
  const [dialogError, setDialogError] = useState(null);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [users, setUsers] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [newDepartment, setNewDepartment] = useState('');
  const [deptError, setDeptError] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setPageError(null);

      const [data, depts] = await Promise.all([
        api.listUsers(),
        api.listDepartments(),
      ]);

      setUsers(Array.isArray(data) ? data : []);
      setDepartments(Array.isArray(depts) ? depts : []);
    } catch (err) {
      setPageError(err.message || 'Could not load users.');
      setUsers((current) => current ?? []);
    }
  }

  async function handleAddDepartment(e) {
    e.preventDefault();
    const name = newDepartment.trim();

    if (!name) return;

    setDeptError(null);

    try {
      await api.createDepartment(name);
      setNewDepartment('');
      await load();
      setNotice('Department added successfully.');
    } catch (err) {
      setDeptError(err.message || 'Could not add department.');
    }
  }

  async function handleChangeDepartment(user, department) {
    setDeptError(null);

    try {
      await api.setUserDepartment(user.id, department);
      setNotice(`Department updated for ${user.full_name}.`);
      await load();
    } catch (err) {
      setDeptError(err.message || 'Could not update department.');
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await api.createUser(form);
      setForm(EMPTY_FORM);
      setShowForm(false);
      setNotice('User created successfully.');
      await load();
    } catch (err) {
      setError(err.message || 'Could not create user.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(user) {
    try {
      const next = user.status === 'Active' ? 'Disabled' : 'Active';
      await api.setUserStatus(user.id, next);
      setNotice(`${user.full_name} is now ${next.toLowerCase()}.`);
      await load();
    } catch (err) {
      setNotice(err.message || 'Could not update user status.');
    }
  }

  function openDialog(type, user) {
    setDialogError(null);
    setDialog({
      type,
      user,
      full_name: user.full_name || '',
      ec_number: user.ec_number || '',
      username: user.username || '',
      new_password: '',
    });
  }

  async function submitDialog(e) {
    e.preventDefault();
    if (!dialog) return;

    setDialogBusy(true);
    setDialogError(null);

    try {
      const user = dialog.user;

      if (dialog.type === 'edit') {
        await api.updateUser(user.id, {
          full_name: dialog.full_name,
          ec_number: dialog.ec_number,
          username: dialog.username,
        });

        setNotice(`Saved changes for ${dialog.full_name}.`);
      } else if (dialog.type === 'password') {
        await api.resetPassword(user.id, dialog.new_password);

        setNotice(
          `Password reset for ${user.full_name}. Ask them to change it after signing in.`
        );
      } else if (dialog.type === 'delete') {
        await api.deleteUser(user.id);
        setNotice(`${user.full_name} was deleted.`);
      }

      setDialog(null);
      await load();
    } catch (err) {
      setDialogError(err.message || 'The operation could not be completed.');
    } finally {
      setDialogBusy(false);
    }
  }

  if (users === null) {
    return (
      <div
        className="skeleton"
        style={{ height: 300, margin: 24 }}
      />
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-head">
        <div className="admin-title">
          <h1>Manage users</h1>
          <p className="sub">Create accounts and control access.</p>
        </div>

        <button
          type="button"
          className="btn btn-primary new-user-btn"
          onClick={() => {
            setShowForm((current) => !current);
            setError(null);
          }}
        >
          {showForm ? 'Cancel' : '＋ New user'}
        </button>
      </header>

      {pageError && (
        <div className="page-error" role="alert">
          <span>{pageError}</span>
          <button type="button" className="btn-text" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {notice && (
        <div className="notice-bar" role="status">
          <span>{notice}</span>
          <button
            type="button"
            className="btn-text dismiss-notice"
            aria-label="Dismiss notification"
            onClick={() => setNotice(null)}
          >
            ✕
          </button>
        </div>
      )}

      <ResetRequests />

      {showForm && (
        <form
          className="card card-pad create-form"
          onSubmit={handleCreate}
        >
          <div className="form-grid">
            <div className="field">
              <label htmlFor="new-ec">EC Number</label>
              <input
                id="new-ec"
                value={form.ec_number}
                onChange={(e) =>
                  setForm({ ...form, ec_number: e.target.value })
                }
                required
              />
            </div>

            <div className="field">
              <label htmlFor="new-username">Username</label>
              <input
                id="new-username"
                value={form.username}
                onChange={(e) =>
                  setForm({ ...form, username: e.target.value })
                }
                required
              />
            </div>

            <div className="field">
              <label htmlFor="new-full-name">Full name</label>
              <input
                id="new-full-name"
                value={form.full_name}
                onChange={(e) =>
                  setForm({ ...form, full_name: e.target.value })
                }
                required
              />
            </div>

            <div className="field">
              <label htmlFor="new-department">Department</label>
              <select
                id="new-department"
                value={form.department}
                onChange={(e) =>
                  setForm({ ...form, department: e.target.value })
                }
                required
              >
                <option value="">Select a department</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.name}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="new-role">Role</label>
              <select
                id="new-role"
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value })
                }
              >
                <option>Employee</option>
                <option>Manager</option>
                <option>Admin</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="new-password">Temporary password</label>
              <input
                id="new-password"
                type="password"
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy}
          >
            {busy ? 'Creating…' : 'Create user'}
          </button>
        </form>
      )}

      <section className="card card-pad dept-card">
        <h3>Departments</h3>
        <p className="sub department-description">
          A department is chosen for every user. People can edit Library
          documents uploaded by their own department.
        </p>

        <div className="dept-chips">
          {departments.map((department) => (
            <span
              key={department.id}
              className="badge badge-library dept-chip"
            >
              {department.name}
            </span>
          ))}

          {departments.length === 0 && (
            <span className="sub">No departments added yet.</span>
          )}
        </div>

        <form className="dept-add" onSubmit={handleAddDepartment}>
          <input
            value={newDepartment}
            onChange={(e) => setNewDepartment(e.target.value)}
            placeholder="New department name"
            aria-label="New department name"
            maxLength={80}
            required
          />

          <button
            type="submit"
            className="btn btn-secondary"
            disabled={!newDepartment.trim()}
          >
            Add department
          </button>
        </form>

        {deptError && <p className="form-error">{deptError}</p>}
      </section>

      <section className="card users-table-card">
        <div
          className="users-table-scroll"
          role="region"
          aria-label="Users table. Swipe horizontally to see all columns."
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>EC Number</th>
                <th>Username</th>
                <th>Department</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.full_name}</td>
                  <td className="mono">{user.ec_number}</td>
                  <td>{user.username}</td>
                  <td>
                    <select
                      className="dept-select"
                      value={user.department || ''}
                      onChange={(e) =>
                        handleChangeDepartment(user, e.target.value)
                      }
                      aria-label={`Department for ${user.full_name}`}
                    >
                      <option value="">None</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.name}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        user.role === 'Admin' ? 'badge-admin' : 'badge-library'
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td>{user.status}</td>
                  <td className="row-actions">
                    <button
                      type="button"
                      className="btn-text"
                      onClick={() => openDialog('edit', user)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="btn-text"
                      onClick={() => openDialog('password', user)}
                    >
                      Reset password
                    </button>

                    {user.id !== me?.id && (
                      <>
                        <button
                          type="button"
                          className="btn-text"
                          onClick={() => toggleStatus(user)}
                        >
                          {user.status === 'Active' ? 'Disable' : 'Enable'}
                        </button>

                        <button
                          type="button"
                          className="btn-text danger-text"
                          onClick={() => openDialog('delete', user)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}

              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-users">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {dialog && (
        <div
          className="um-overlay"
          onClick={() => {
            if (!dialogBusy) setDialog(null);
          }}
        >
          <form
            className="um-modal card"
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitDialog}
          >
            {dialog.type === 'edit' && (
              <>
                <h2>Edit {dialog.user.full_name}</h2>

                <div className="field">
                  <label htmlFor="edit-full-name">Full name</label>
                  <input
                    id="edit-full-name"
                    value={dialog.full_name}
                    onChange={(e) =>
                      setDialog({ ...dialog, full_name: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="edit-ec">EC Number</label>
                  <input
                    id="edit-ec"
                    value={dialog.ec_number}
                    onChange={(e) =>
                      setDialog({ ...dialog, ec_number: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="edit-username">Username</label>
                  <input
                    id="edit-username"
                    value={dialog.username}
                    onChange={(e) =>
                      setDialog({ ...dialog, username: e.target.value })
                    }
                    required
                  />
                </div>

                <p className="sub">
                  The person signs in with their EC number, so tell them if it
                  changes.
                </p>
              </>
            )}

            {dialog.type === 'password' && (
              <>
                <h2>Reset password for {dialog.user.full_name}</h2>

                <div className="field">
                  <label htmlFor="reset-password">
                    New password (at least 8 characters)
                  </label>
                  <input
                    id="reset-password"
                    type="password"
                    value={dialog.new_password}
                    onChange={(e) =>
                      setDialog({ ...dialog, new_password: e.target.value })
                    }
                    required
                    minLength={8}
                    autoComplete="new-password"
                    autoFocus
                  />
                </div>
              </>
            )}

            {dialog.type === 'delete' && (
              <>
                <h2>Delete {dialog.user.full_name}?</h2>
                <p>
                  This permanently removes the account ({dialog.user.ec_number}).
                  It cannot be undone. If you only want to stop them signing in,
                  use Disable instead.
                </p>
              </>
            )}

            {dialogError && <p className="form-error">{dialogError}</p>}

            <div className="um-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDialog(null)}
                disabled={dialogBusy}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={dialogBusy}
              >
                {dialogBusy
                  ? 'Working…'
                  : dialog.type === 'delete'
                    ? 'Delete user'
                    : dialog.type === 'password'
                      ? 'Reset password'
                      : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      <style>{`
        .admin-page,
        .admin-page * {
          box-sizing: border-box;
        }

        .admin-page {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          padding: 28px 32px;
          overflow-x: clip;
        }

        .admin-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 20px;
          min-width: 0;
        }

        .admin-title {
          min-width: 0;
        }

        .admin-head h1 {
          font-size: 20px;
          overflow-wrap: anywhere;
        }

        .sub {
          color: var(--text-tertiary);
          font-size: 12.5px;
          line-height: 1.6;
          margin-top: 4px;
        }

        .notice-bar,
        .page-error {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          overflow-wrap: anywhere;
        }

        .notice-bar {
          background: var(--accent-bg);
          border: 1px solid var(--accent);
        }

        .page-error {
          background: var(--surface-alt);
          border: 1px solid var(--border);
        }

        .create-form {
          width: 100%;
          min-width: 0;
          margin-bottom: 20px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px 16px;
          margin-bottom: 16px;
        }

        .form-grid > *,
        .field {
          min-width: 0;
        }

        .form-grid input,
        .form-grid select,
        .um-modal input {
          width: 100%;
          max-width: 100%;
          min-width: 0;
        }

        .form-error {
          color: var(--danger);
          font-size: 13px;
          line-height: 1.5;
          margin: 8px 0 12px;
          overflow-wrap: anywhere;
        }

        .dept-card {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          margin-bottom: 20px;
          overflow: hidden;
        }

        .dept-card h3 {
          font-size: 15px;
          margin-bottom: 4px;
        }

        .department-description {
          overflow-wrap: anywhere;
        }

        .dept-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          min-width: 0;
          margin: 14px 0;
        }

        .dept-chip {
          max-width: 100%;
          text-transform: none;
          letter-spacing: 0;
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .dept-add {
          display: flex;
          flex-wrap: wrap;
          align-items: stretch;
          gap: 10px;
          width: 100%;
          min-width: 0;
          margin-top: 12px;
        }

        .dept-add input {
          flex: 1 1 200px;
          width: auto;
          min-width: 0;
          height: 44px;
          padding: 0 12px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-alt);
          font-size: 14px;
        }

        .dept-add button {
          flex: 0 0 auto;
          min-height: 44px;
          padding: 8px 16px;
          white-space: nowrap;
          overflow-wrap: normal;
          word-break: normal;
        }

        .dept-select {
          width: 100%;
          max-width: 160px;
          min-width: 0;
          height: 36px;
          padding: 0 8px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--surface);
        }

        .users-table-card {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
        }

        .users-table-scroll {
          display: block;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-x: contain;
          scrollbar-width: thin;
        }

        .users-table-scroll table {
          width: 100%;
          min-width: 850px;
          border-collapse: collapse;
        }

        .users-table-scroll th,
        .users-table-scroll td {
          padding: 12px;
          white-space: nowrap;
          text-align: left;
        }

        .row-actions {
          min-width: 220px;
          white-space: nowrap;
        }

        .row-actions .btn-text {
          margin-right: 10px;
        }

        .danger-text {
          color: var(--danger);
        }

        .empty-users {
          padding: 24px;
          text-align: center;
        }

        .um-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: rgba(0, 0, 0, 0.4);
          overflow-y: auto;
        }

        .um-modal {
          width: 100%;
          max-width: 420px;
          max-height: calc(100vh - 32px);
          max-height: calc(100dvh - 32px);
          min-width: 0;
          overflow-y: auto;
          padding: 24px;
          background: var(--surface);
        }

        .um-modal h2 {
          margin-bottom: 16px;
          font-size: 17px;
          overflow-wrap: anywhere;
        }

        .um-actions {
          display: flex;
          justify-content: flex-end;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 16px;
        }

        @media (max-width: 700px) {
          .admin-page {
            padding: 18px 12px;
          }

          .admin-head {
            flex-wrap: wrap;
            align-items: center;
            gap: 12px;
          }

          .admin-head h1 {
            font-size: 19px;
          }

          .admin-head .new-user-btn {
            flex-shrink: 0;
            min-height: 44px;
            padding: 10px 12px;
            font-size: 13px;
          }

          .form-grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 12px;
          }

          .dept-card {
            padding: 16px;
          }

          .dept-add input,
          .dept-add button {
            flex: 1 1 100%;
          }

          .dept-select {
            max-width: 140px;
          }

          .users-table-scroll table {
            min-width: 850px;
          }

          .um-overlay {
            padding: 12px;
          }

          .um-modal {
            padding: 18px;
            max-height: calc(100vh - 24px);
            max-height: calc(100dvh - 24px);
          }

          .um-actions {
            justify-content: stretch;
          }

          .um-actions button {
            flex: 1 1 100px;
            min-width: 0;
          }
        }

        @media (max-width: 380px) {
          .admin-page {
            padding: 14px 8px;
          }

          .admin-head h1 {
            font-size: 17px;
          }

          .admin-head .new-user-btn {
            padding: 9px;
          }

          .dept-card {
            padding: 12px;
          }

          .dept-add input {
            font-size: 13px;
          }
        }
      `}</style>
    </div>
  );
}
