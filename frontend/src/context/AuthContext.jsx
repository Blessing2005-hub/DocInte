import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('docintel_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api.me()
      .then(setUser)
      .catch(() => localStorage.removeItem('docintel_token'))
      .finally(() => setLoading(false));
  }, []);

  async function login(ecNumber, password) {
    const res = await api.login(ecNumber, password);
    localStorage.setItem('docintel_token', res.access_token);
    setUser(res.user);
    return res.user;
  }

  function logout() {
    localStorage.removeItem('docintel_token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin: user?.role === 'Admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
