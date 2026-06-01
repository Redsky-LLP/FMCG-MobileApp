// PATH: src/api/client.ts
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '';

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Flag to prevent multiple refresh requests
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: unknown) => void; reject: (reason?: unknown) => void }> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach(promise => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
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

// ── Response: handle 401 + token refresh ─────────────────────────────────────
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    
    // If 401 and not a retry attempt
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue the request while token is being refreshed
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        }).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const stored = localStorage.getItem('fmcg_auth');
        if (!stored) {
          throw new Error('No stored auth');
        }
        
        const parsed = JSON.parse(stored);
        const refreshToken = parsed?.state?.user?.refreshToken ?? parsed?.user?.refreshToken;
        
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        // Call refresh endpoint
        const response = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, { refreshToken });
        const { token } = response.data;
        
        // Update stored token
        const auth = JSON.parse(localStorage.getItem('fmcg_auth') || '{}');
        if (auth.state) {
          auth.state.user.token = token;
          auth.state.token = token;
          localStorage.setItem('fmcg_auth', JSON.stringify(auth));
        }
        
        // Update Authorization header
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