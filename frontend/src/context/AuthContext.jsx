import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutos

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const inactivityTimer = useRef(null);

  const formatApiErrorDetail = (detail) => {
    if (detail == null) return "Algo deu errado. Tente novamente.";
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail))
      return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
    if (detail && typeof detail.msg === "string") return detail.msg;
    return String(detail);
  };

  const performLogout = useCallback(async () => {
    try {
      await axios.post(`${API_URL}/api/auth/logout`, {}, { withCredentials: true });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(false);
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
        inactivityTimer.current = null;
      }
    }
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    inactivityTimer.current = setTimeout(() => {
      if (user) {
        performLogout();
      }
    }, INACTIVITY_TIMEOUT);
  }, [user, performLogout]);

  // Track user activity
  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const handler = () => resetInactivityTimer();

    events.forEach(event => window.addEventListener(event, handler, { passive: true }));
    resetInactivityTimer();

    return () => {
      events.forEach(event => window.removeEventListener(event, handler));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [user, resetInactivityTimer]);

  const checkAuth = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/me`, { withCredentials: true });
      setUser(response.data);
    } catch (error) {
      setUser(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, { email, password }, { withCredentials: true });
      setUser(response.data);
      return { success: true };
    } catch (error) {
      return { success: false, error: formatApiErrorDetail(error.response?.data?.detail) || error.message };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await axios.post(`${API_URL}/api/auth/change-password`, { current_password: currentPassword, new_password: newPassword }, { withCredentials: true });
      return { success: true };
    } catch (error) {
      return { success: false, error: formatApiErrorDetail(error.response?.data?.detail) || error.message };
    }
  };

  const value = {
    user, loading, login,
    logout: performLogout,
    checkAuth, changePassword,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
