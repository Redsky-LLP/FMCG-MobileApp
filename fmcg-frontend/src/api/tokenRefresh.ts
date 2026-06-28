// PATH: src/api/tokenRefresh.ts
//
// Why this exists: the axios interceptor in client.ts only refreshes the
// token AFTER a request fails with 401. That's correct as a safety net, but
// for a salesman who's been walking between shops for 20 minutes and then
// opens the app again, it means the very first tap after reopening shows a
// brief failed-request flicker before silently recovering. Mobile users
// notice that. This module fixes it by checking the token's expiry the
// moment the tab/app becomes visible again, and refreshing proactively if
// it's close to expiring — so by the time they tap anything, it's already
// fresh.

import axios from 'axios';

// Hardcoded backend URL for production APK
const BASE_URL = 'https://fmcg-api.duckdns.org';
// Refresh if the token expires within this many seconds — gives a buffer so
// we're not racing the actual expiry.
const REFRESH_BUFFER_SECONDS = 5 * 60;

function decodeJwtExpiry(token: string): number | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    return typeof payload.exp === 'number' ? payload.exp : null; // seconds since epoch
  } catch {
    return null;
  }
}

let refreshInFlight: Promise<void> | null = null;

async function refreshIfNeeded() {
  const stored = localStorage.getItem('fmcg_auth');
  if (!stored) return;

  let auth: any;
  try { auth = JSON.parse(stored); } catch { return; }

  const user = auth?.state?.user;
  const token = user?.token;
  const refreshToken = user?.refreshToken;
  if (!token || !refreshToken) return;

  const exp = decodeJwtExpiry(token);
  if (exp == null) return;

  const secondsLeft = exp - Math.floor(Date.now() / 1000);
  if (secondsLeft > REFRESH_BUFFER_SECONDS) return; // still fresh, nothing to do

  // Avoid firing multiple overlapping refresh calls if several events
  // (visibilitychange + focus) land at once.
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const response = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, { refreshToken });
      const payload = response.data?.data ?? response.data;
      if (payload?.token) {
        auth.state.user.token = payload.token;
        auth.state.token = payload.token;
        if (payload.refreshToken) auth.state.user.refreshToken = payload.refreshToken;
        localStorage.setItem('fmcg_auth', JSON.stringify(auth));
      }
    } catch {
      // If this fails, the regular 401-retry interceptor in client.ts is
      // still the fallback — it'll catch it on the next real API call and
      // either recover or send the user to /login if truly expired.
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

let initialized = false;

/** Call once at app startup (see App.tsx). */
export function setupProactiveTokenRefresh() {
  if (initialized) return;
  initialized = true;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshIfNeeded();
  });

  // Some mobile browsers fire 'focus' more reliably than visibilitychange
  // when returning from the home screen / app switcher.
  window.addEventListener('focus', () => { refreshIfNeeded(); });

  // Also check once on initial load, in case the app was closed for a while
  // and reopened fresh (visibilitychange won't fire for the very first load).
  refreshIfNeeded();
}