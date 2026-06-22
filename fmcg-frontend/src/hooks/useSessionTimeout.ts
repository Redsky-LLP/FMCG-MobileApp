// PATH: src/hooks/useSessionTimeout.ts
// FIXED: Use browser-compatible types instead of NodeJS.Timeout

import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

// ── Configuration ─────────────────────────────────────────────────────────────
const SESSION_TIMEOUT_MINUTES = 10;
const SESSION_TIMEOUT_MS = SESSION_TIMEOUT_MINUTES * 60 * 1000;

// ── Events that reset the inactivity timer ──────────────────────────────────
const RESET_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'touchmove',
  'click',
  'focus',
  'wheel',
  'pointerdown',
  'pointermove',
];

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useSessionTimeout() {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuthStore();
  
  // FIXED: Use ReturnType<typeof setTimeout> instead of NodeJS.Timeout
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningShownRef = useRef(false);

  // ── Logout function ──
  const handleLogout = useCallback(async () => {
    // Clear timers
    if (timerRef.current) clearTimeout(timerRef.current);
    if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
    warningShownRef.current = false;

    // Only proceed if user is authenticated
    if (isAuthenticated && user) {
      console.log('[Session] Auto-logout due to inactivity');
      
      // Perform logout
      await logout();
      
      // Navigate to login page with session expired message
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
    if (timerRef.current) clearTimeout(timerRef.current);
    if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
    warningShownRef.current = false;

    // Don't start timer if user is not logged in
    if (!isAuthenticated || !user) return;

    // ── Set timer for logout ──
    timerRef.current = setTimeout(() => {
      console.log('[Session] Inactivity timeout reached - logging out');
      handleLogout();
    }, SESSION_TIMEOUT_MS);

    // ── Optional: Show warning 1 minute before logout ──
    timeoutIdRef.current = setTimeout(() => {
      if (!warningShownRef.current && isAuthenticated) {
        warningShownRef.current = true;
        console.log('[Session] Warning: Session will expire in 1 minute');
        // Dispatch custom event for warning toast
        window.dispatchEvent(new CustomEvent('session-warning'));
      }
    }, SESSION_TIMEOUT_MS - 60000);
  }, [isAuthenticated, user, handleLogout]);

  // ── Setup event listeners ──
  useEffect(() => {
    // Don't setup if user is not logged in
    if (!isAuthenticated || !user) {
      // Clear timers when user logs out
      if (timerRef.current) clearTimeout(timerRef.current);
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
      warningShownRef.current = false;
      return;
    }

    // ── Debounced reset function ──
    let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
    
    const handleActivity = () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      debounceTimeout = setTimeout(() => {
        resetTimer();
        debounceTimeout = null;
      }, 500);
    };

    // ── Add event listeners ──
    RESET_EVENTS.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // ── Initial timer start ──
    resetTimer();

    // ── Cleanup ──
    return () => {
      RESET_EVENTS.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      if (timerRef.current) clearTimeout(timerRef.current);
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
      if (debounceTimeout) clearTimeout(debounceTimeout);
      warningShownRef.current = false;
    };
  }, [isAuthenticated, user, resetTimer]);

  // ── Expose manual reset function ──
  return { resetTimer };
}