import axios from 'axios';

const rawApiUrl = import.meta.env.VITE_API_URL;
if (import.meta.env.PROD && !rawApiUrl) {
  throw new Error('VITE_API_URL is required in production.');
}

const API_URL = (rawApiUrl || 'http://localhost:4000').replace(/\/$/, '');
const ACCESS_KEY = 'dh_access_token';
const REFRESH_KEY = 'dh_refresh_token';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 45000,
});

export function getAccessToken() {
  return sessionStorage.getItem(ACCESS_KEY) || '';
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY) || '';
}

export function setTokens({ accessToken, refreshToken }) {
  if (accessToken) sessionStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  sessionStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

let refreshPromise = null;
let onAuthFailure = () => {};

export function setAuthFailureHandler(handler) {
  onAuthFailure = typeof handler === 'function' ? handler : () => {};
  return () => {
    if (onAuthFailure === handler) onAuthFailure = () => {};
  };
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token');

  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_URL}/api/auth/refresh`, { refreshToken }, { timeout: 15000 })
      .then((response) => {
        setTokens(response.data);
        return response.data.accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config || {};
    const isAuthRequest = /\/auth\/(login|signup|refresh|logout)/.test(original.url || '');

    if (
      error.response?.status === 401 &&
      !original._retry &&
      !isAuthRequest &&
      getRefreshToken()
    ) {
      original._retry = true;
      try {
        const accessToken = await refreshAccessToken();
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch (refreshError) {
        clearTokens();
        onAuthFailure();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export function extractApiError(error, fallback = 'Something went wrong.') {
  const data = error?.response?.data;
  const candidate = data?.error?.message ?? data?.error ?? data?.message ?? error?.message;
  if (candidate === undefined || candidate === null || candidate === '') return fallback;
  if (typeof candidate === 'string') return candidate;
  try {
    return JSON.stringify(candidate);
  } catch {
    return fallback;
  }
}

export const API_BASE_URL = API_URL;

export async function logoutServerSide() {
  const initialRefreshToken = getRefreshToken();
  if (!initialRefreshToken) return;

  try {
    if (!getAccessToken()) {
      await refreshAccessToken();
    }

    const refreshToken = getRefreshToken();
    await api.post('/auth/logout', { refreshToken });
  } catch (error) {
    if (error?.response?.status !== 401 || !getRefreshToken()) return;

    try {
      const accessToken = await refreshAccessToken();
      const refreshToken = getRefreshToken();

      await axios.post(
        `${API_URL}/api/auth/logout`,
        { refreshToken },
        {
          timeout: 15000,
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
    } catch {
      // Local logout still succeeds when the network or refresh token is unavailable.
    }
  }
}
