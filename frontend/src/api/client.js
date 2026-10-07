const BASE_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;

function getToken() {
  return localStorage.getItem('docintel_token');
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // ignore
    }
    const error = new Error(detail);
    error.status = res.status;
    throw error;
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  login: (ec_number, password) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ ec_number, password }) }),
  me: () => request('/api/auth/me'),

  listUsers: () => request('/api/admin/users'),
  createUser: (payload) => request('/api/admin/users', { method: 'POST', body: JSON.stringify(payload) }),
  setUserStatus: (id, status) =>
    request(`/api/admin/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  setUserDepartment: (id, department) =>
    request(`/api/admin/users/${id}/department`, { method: 'PATCH', body: JSON.stringify({ department }) }),
  getAccessLogs: () => request('/api/admin/access-logs'),

  listDepartments: () => request('/api/departments'),
  createDepartment: (name) => request('/api/departments', { method: 'POST', body: JSON.stringify({ name }) }),

  uploadDocument: (file, uploadType, authorizedUsernames) => {
    const form = new FormData();
    form.append('file', file);
    form.append('upload_type', uploadType);
    form.append('authorized_usernames', authorizedUsernames || '');
    return request('/api/documents/upload', { method: 'POST', body: form });
  },
  listLibrary: () => request('/api/documents/library'),
  listMine: () => request('/api/documents/mine'),
  searchDocuments: (q) => request(`/api/documents/search?q=${encodeURIComponent(q)}`),
  downloadDocument: async (id, filename) => {
    const res = await fetch(`${BASE_URL}/api/documents/${id}/download`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error('Could not download this document.');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
  deleteDocument: (id) => request(`/api/documents/${id}`, { method: 'DELETE' }),

  uploadVersion: (id, file, baseVersion, note) => {
    const form = new FormData();
    form.append('file', file);
    form.append('base_version', String(baseVersion));
    form.append('note', note || '');
    return request(`/api/documents/${id}/versions`, { method: 'POST', body: form });
  },
  listVersions: (id) => request(`/api/documents/${id}/versions`),
  restoreVersion: (id, versionNumber) =>
    request(`/api/documents/${id}/versions/${versionNumber}/restore`, { method: 'POST' }),
  downloadVersion: async (id, versionNumber, filename) => {
    const res = await fetch(`${BASE_URL}/api/documents/${id}/versions/${versionNumber}/download`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error('Could not download this version.');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  sendDocument: (file, receiverUsername, message) => {
    const form = new FormData();
    form.append('file', file);
    form.append('receiver_username', receiverUsername);
    form.append('message', message || '');
    return request('/api/share/send', { method: 'POST', body: form });
  },
  getInbox: () => request('/api/share/inbox'),
  getSent: () => request('/api/share/sent'),
  markRead: (id) => request(`/api/share/inbox/${id}/read`, { method: 'POST' }),

  askAI: (question) => request('/api/ai/ask', { method: 'POST', body: JSON.stringify({ question }) }),
};

export { BASE_URL, getToken };
