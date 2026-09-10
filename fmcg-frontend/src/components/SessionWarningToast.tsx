// PATH: src/components/SessionWarningToast.tsx
//
// ── FIX: disabled. This toast started its own local 60-second countdown the
// moment the 'session-warning' event fired — but useSessionTimeout.ts
// actually dispatches that event 5 MINUTES before the real inactivity
// logout, not 60 seconds. So the banner was telling the salesman "under a
// minute left" when they genuinely had up to 5 minutes remaining, and it
// never listened for the activity that was actively resetting the real
// timer elsewhere in the app — it just counted down and vanished on its
// own regardless of what the salesman was doing. That mismatch is what
// produced the "Session expiring soon — 15 seconds left" warning appearing
// mid-order, causing confusion and anxiety for no real reason.
//
// Autosave (OrderEntry.tsx) already protects in-progress order data well
// before any inactivity logout could occur, so the underlying concern this
// toast existed for is already covered. Rather than patch the countdown to
// show an accurate number, it's disabled outright — a warning that can only
// ever say "somewhere between a few seconds and 5 minutes remain" isn't
// useful to show a salesman mid-order taking anyway.
//
// The component is kept as a no-op (rather than deleted) so any existing
// import/usage of <SessionWarningToast /> elsewhere in the app continues to
// compile and simply renders nothing — no other file needed to change as
// part of this fix.
//
// The actual 60-minute inactivity auto-logout in useSessionTimeout.ts is
// UNCHANGED and still fully enforced; only this pre-warning banner is
// disabled. ──

export function SessionWarningToast() {
  return null;
}