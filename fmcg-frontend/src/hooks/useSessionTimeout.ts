// PATH: src/hooks/useSessionTimeout.ts
// FIXED: More robust activity detection with logging for debugging

import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

// ── Configuration ─────────────────────────────────────────────────────────────
const SESSION_TIMEOUT_MINUTES = 60;
const SESSION_TIMEOUT_MS = SESSION_TIMEOUT_MINUTES * 60 * 1000;

// ── Events that reset the inactivity timer ──────────────────────────────────
// Expanded to include more events
const RESET_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'keyup',
  'scroll',
  'touchstart',
  'touchmove',
  'touchend',
  'click',
  'dblclick',
  'focus',
  'wheel',
  'pointerdown',
  'pointermove',
  'pointerup',
];

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useSessionTimeout() {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuthStore();

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningShownRef = useRef(false);
  const lastActivityRef = useRef<number>(Date.now());

  // ── Logout function ──
  const handleLogout = useCallback(async () => {
    // Clear timers
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
    warningShownRef.current = false;

    // Only proceed if user is authenticated
    if (isAuthenticated && user) {
      console.log(`[Session] Auto-logout due to ${SESSION_TIMEOUT_MINUTES} minutes of inactivity. Last activity: ${new Date(lastActivityRef.current).toLocaleTimeString()}`);
      
      await logout();
      
      navigate('/pin-login', {
        state: {
          sessionExpired: true,
          message: `Session expired due to ${SESSION_TIMEOUT_MINUTES} minutes of inactivity. Please log in again.`
        }
      });
    }
  }, [isAuthenticated, user, logout, navigate]);

  // ── Reset the timer ──
  const resetTimer = useCallback(() => {
    // Clear existing timers
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
    warningShownRef.current = false;
    lastActivityRef.current = Date.now();

    // Don't start timer if user is not logged in
    if (!isAuthenticated || !user) return;

    console.log(`[Session] Timer reset. Next timeout in ${SESSION_TIMEOUT_MINUTES} minutes`);

    // ── Set timer for logout (1 hour) ──
    timerRef.current = setTimeout(() => {
      console.log('[Session] Inactivity timeout reached - logging out');
      handleLogout();
    }, SESSION_TIMEOUT_MS);

    // ── Show warning 5 minutes before logout ──
    timeoutIdRef.current = setTimeout(() => {
      if (!warningShownRef.current && isAuthenticated) {
        warningShownRef.current = true;
        console.log('[Session] Warning: Session will expire in 5 minutes');
        window.dispatchEvent(new CustomEvent('session-warning'));
      }
    }, SESSION_TIMEOUT_MS - 300000);
  }, [isAuthenticated, user, handleLogout]);

  // ── Handle activity (resets timer) ──
  const handleActivity = useCallback(() => {
    if (!isAuthenticated || !user) return;
    
    // Don't reset on every tiny event - only if enough time has passed
    const now = Date.now();
    if (now - lastActivityRef.current > 1000) {
      lastActivityRef.current = now;
      console.log('[Session] Activity detected - resetting timer');
      resetTimer();
    }
  }, [isAuthenticated, user, resetTimer]);

  // ── Setup event listeners ──
  useEffect(() => {
    // Don't setup if user is not logged in
    if (!isAuthenticated || !user) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      warningShownRef.current = false;
      return;
    }

    console.log('[Session] Setting up activity listeners');

    // ── Add event listeners ──
    RESET_EVENTS.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Also listen for visibility change (tab becomes active)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('[Session] Tab became visible - resetting timer');
        resetTimer();
      }
    });

    // ── Initial timer start ──
    resetTimer();

    // ── Cleanup ──
    return () => {
      console.log('[Session] Cleaning up activity listeners');
      RESET_EVENTS.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', resetTimer);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      warningShownRef.current = false;
    };
  }, [isAuthenticated, user, resetTimer, handleActivity]);

  // ── Expose manual reset function ──
  return { resetTimer };
}