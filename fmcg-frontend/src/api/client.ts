// PATH: src/api/client.ts
import axios from 'axios';

// In production (Netlify), VITE_API_URL must be set in Netlify environment variables.
// In development, it falls back to localhost:5002.
const BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? 'https://fmcg-distribution-api.onrender.com'
    : 'http://localhost:5002');

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Flag to prevent multiple refresh requests
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach(promise => {
    if (error) promise.reject(error);
    else promise.resolve(token);
  });
  failedQueue = [];
};

// ── Request: attach JWT ───────────────────────────────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    const stored = localStorage.getItem('fmcg_auth');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const token = parsed?.state?.user?.token ?? parsed?.user?.token;
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch {
        // ignore
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response: handle 401 ─────────────────────────────────────────────────────
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const stored = localStorage.getItem('fmcg_auth');
        if (!stored) throw new Error('No stored auth');

        const parsed = JSON.parse(stored);
        const refreshToken =
          parsed?.state?.user?.refreshToken ?? parsed?.user?.refreshToken;

        if (!refreshToken) throw new Error('No refresh token');

        const response = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, {
          refreshToken,
        });
        const { token } = response.data;

        const auth = JSON.parse(localStorage.getItem('fmcg_auth') || '{}');
        if (auth.state) {
          auth.state.user.token = token;
          auth.state.token = token;
          localStorage.setItem('fmcg_auth', JSON.stringify(auth));
        }

        apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
        processQueue(null, token);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        localStorage.removeItem('fmcg_auth');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    const data = error.response?.data;
    let msg: string | null = null;
    if (typeof data === 'string' && data.trim()) {
      msg = data.trim();
    } else if (data && typeof data === 'object') {
      msg = data.error ?? data.message ?? null;
    }

    return msg ? Promise.reject(new Error(msg)) : Promise.reject(error);
  },
);

export default apiClient;