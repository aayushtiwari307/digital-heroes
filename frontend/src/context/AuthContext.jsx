import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { endpoints } from '../api/endpoints';
import {
  clearTokens,
  extractApiError,
  getAccessToken,
  getRefreshToken,
  logoutServerSide,
  setAuthFailureHandler,
  setTokens,
} from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    return setAuthFailureHandler(() => setUser(null));
  }, []);

  useEffect(() => {
    let alive = true;

    async function boot() {
      if (!getAccessToken() && !getRefreshToken()) {
        if (alive) setBooting(false);
        return;
      }

      try {
        const response = await endpoints.auth.me();
        if (alive) setUser(response.data.user);
      } catch (error) {
        // A transient backend/network failure should not destroy a locally
        // stored session. The Axios interceptor already clears tokens when
        // refresh genuinely fails.
        if (error?.response?.status === 401 || error?.response?.status === 403) {
          clearTokens();
          if (alive) setUser(null);
        }
      } finally {
        if (alive) setBooting(false);
      }
    }

    boot();
    return () => {
      alive = false;
    };
  }, []);

  async function login(payload) {
    try {
      const response = await endpoints.auth.login(payload);
      setTokens(response.data);
      setUser(response.data.user);
      return response.data.user;
    } catch (error) {
      throw new Error(extractApiError(error, 'Unable to log in.'));
    }
  }

  async function signup(payload) {
    try {
      const response = await endpoints.auth.signup(payload);
      setTokens(response.data);
      setUser(response.data.user);
      return response.data.user;
    } catch (error) {
      throw new Error(extractApiError(error, 'Unable to create your account.'));
    }
  }

  async function logout() {
    await logoutServerSide();
    clearTokens();
    setUser(null);
  }

  async function refreshUser() {
    const response = await endpoints.auth.me();
    setUser(response.data.user);
    return response.data.user;
  }

  const value = useMemo(
    () => ({ user, booting, login, signup, logout, refreshUser }),
    [user, booting],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
