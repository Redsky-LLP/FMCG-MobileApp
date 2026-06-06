// src/components/PWAInstallPrompt.tsx
// REPLACE with this improved version

import { useEffect, useState } from 'react';
import { Download, Share, X, Smartphone, Monitor } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Platform = 'android' | 'ios' | 'desktop' | null;

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isAndroid = /Android/.test(ua);
  const isMobile = isIOS || isAndroid;

  if (isIOS) return 'ios';
  if (isAndroid) return 'android';
  if (!isMobile) return 'desktop';
  return null;
}

function isRunningAsInstalledPWA(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

function isDismissed(): boolean {
  return localStorage.getItem('pwa_install_dismissed') === 'true';
}

function markDismissed() {
  localStorage.setItem('pwa_install_dismissed', 'true');
}

export interface PWAInstallPromptProps {
  /** Show on landing page with different styling */
  variant?: 'landing' | 'default';
  /** Auto-show after delay (milliseconds) */
  autoShowDelay?: number;
}

export default function PWAInstallPrompt(props: PWAInstallPromptProps) {
  const { variant = 'default', autoShowDelay = 3000 } = props;
  const [platform, setPlatform] = useState<Platform>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showIOSSteps, setShowIOSSteps] = useState(false);
  const [manualDismissed, setManualDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed or previously dismissed
    if (isRunningAsInstalledPWA() || isDismissed()) return;

    const p = detectPlatform();
    setPlatform(p);

    // Listen for the browser's install event (Android/Desktop Chrome)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show the prompt after delay, but only if not manually dismissed
      setTimeout(() => {
        if (!manualDismissed && !isDismissed() && !isRunningAsInstalledPWA()) {
          setShow(true);
        }
      }, autoShowDelay);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // iOS: Safari doesn't fire beforeinstallprompt, show after delay
    if (p === 'ios') {
      setTimeout(() => {
        if (!manualDismissed && !isDismissed() && !isRunningAsInstalledPWA()) {
          setShow(true);
        }
      }, autoShowDelay);
    }

    // Android/Desktop Chrome with no event? Show after delay as fallback
    if (p === 'android' || p === 'desktop') {
      // If no beforeinstallprompt event after 5 seconds, show the custom prompt anyway
      const timeout = setTimeout(() => {
        if (!deferredPrompt && !manualDismissed && !isDismissed() && !isRunningAsInstalledPWA()) {
          setShow(true);
        }
      }, autoShowDelay + 2000);
      return () => clearTimeout(timeout);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [autoShowDelay, manualDismissed]);

  function dismiss() {
    setShow(false);
    setManualDismissed(true);
    markDismissed();
  }

  async function handleInstall() {
    if (!deferredPrompt) {
      // No native prompt available, show instructions
      if (platform === 'ios') {
        setShowIOSSteps(true);
      } else {
        alert('To install this app:\n\n1. Tap the menu button (⋮) in your browser\n2. Select "Install App" or "Add to Home Screen"');
      }
      return;
    }
    
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShow(false);
        markDismissed();
      }
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
    }
  }

  // Nothing to show
  if (!show) return null;

  // Landing page variant (more prominent)
  if (variant === 'landing') {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          left: 24,
          maxWidth: 400,
          margin: '0 auto',
          zIndex: 200,
          background: '#fff',
          borderRadius: 20,
          boxShadow: '0 8px 32px rgba(15,23,42,0.16), 0 2px 8px rgba(0,0,0,0.08)',
          border: '1px solid #E2E8F0',
          animation: 'slide-up 0.3s cubic-bezier(0.34,1.2,0.64,1)',
        }}
      >
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, flexShrink: 0,
              background: 'linear-gradient(135deg,#1E3A8A,#2563EB)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Download size={22} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: '#0F172A' }}>Install FMCGDist</p>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748B' }}>Get faster access, work offline, and receive updates instantly.</p>
            </div>
            <button
              onClick={dismiss}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#94A3B8', flexShrink: 0 }}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button
              onClick={dismiss}
              style={{
                flex: 1, padding: '10px', borderRadius: 10,
                border: '1px solid #E2E8F0', background: 'transparent',
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
                color: '#64748B', fontFamily: 'inherit',
              }}
            >
              Not now
            </button>
            <button
              onClick={handleInstall}
              disabled={installing}
              style={{
                flex: 2, padding: '10px', borderRadius: 10,
                border: 'none',
                background: installing ? '#93C5FD' : 'linear-gradient(135deg,#1E3A8A,#2563EB)',
                cursor: installing ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 700, color: '#fff',
                fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Download size={14} />
              {installing ? 'Installing…' : 'Install App'}
            </button>
          </div>

          {platform === 'ios' && showIOSSteps && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #E2E8F0' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 8 }}>How to install on iOS:</p>
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#64748B', lineHeight: 1.6 }}>
                <li>Tap the Share button <span style={{ fontSize: 14 }}>⬆️</span> at the bottom of Safari</li>
                <li>Scroll down and tap "Add to Home Screen"</li>
                <li>Tap "Add" — the app icon appears on your home screen</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    );
  }

  // iOS banner (original style)
  if (platform === 'ios') {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: 'calc(70px + env(safe-area-inset-bottom, 0px) + 12px)',
          left: 16, right: 16, zIndex: 200,
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 20,
          boxShadow: '0 -4px 32px rgba(15,23,42,0.14), 0 8px 32px rgba(15,23,42,0.12)',
          padding: '20px 20px 16px',
          animation: 'slide-up 0.3s cubic-bezier(0.34,1.2,0.64,1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 12,
              background: 'linear-gradient(135deg,#1E3A8A,#2563EB)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Smartphone size={22} color="#fff" />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: '#0F172A' }}>Install FMCGDist</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748B' }}>Add to your home screen for quick access</p>
            </div>
          </div>
          <button onClick={dismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#94A3B8' }}>
            <X size={18} />
          </button>
        </div>

        <button
          onClick={() => setShowIOSSteps(v => !v)}
          style={{
            width: '100%', padding: '11px 16px',
            background: '#EFF6FF', border: '1px solid rgba(37,99,235,0.20)',
            borderRadius: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: '#2563EB',
          }}
        >
          <Share size={16} />
          {showIOSSteps ? 'Hide Steps' : 'How to Install'}
        </button>

        {showIOSSteps && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { step: 1, icon: '⬆️', text: 'Tap the Share button at the bottom of Safari' },
              { step: 2, icon: '➕', text: 'Scroll down and tap "Add to Home Screen"' },
              { step: 3, icon: '✅', text: 'Tap "Add" — the app icon appears on your home screen' },
            ].map(s => (
              <div key={s.step} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: 'rgba(37,99,235,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800, color: '#2563EB',
                }}>
                  {s.step}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: '#334155', lineHeight: 1.5, paddingTop: 4 }}>
                  {s.icon} {s.text}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Android / Desktop banner
  const isDesktop = platform === 'desktop';
  return (
    <div
      style={{
        position: 'fixed',
        bottom: isDesktop ? 24 : 'calc(70px + env(safe-area-inset-bottom, 0px) + 12px)',
        left: isDesktop ? 'auto' : 16,
        right: isDesktop ? 24 : 16,
        width: isDesktop ? 340 : 'auto',
        zIndex: 200,
        background: '#fff',
        border: '1px solid #E2E8F0',
        borderRadius: 20,
        boxShadow: '0 -4px 32px rgba(15,23,42,0.14), 0 8px 32px rgba(15,23,42,0.12)',
        padding: '18px 18px 14px',
        animation: 'slide-up 0.3s cubic-bezier(0.34,1.2,0.64,1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 12, flexShrink: 0,
          background: 'linear-gradient(135deg,#1E3A8A,#2563EB)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isDesktop ? <Monitor size={22} color="#fff" /> : <Smartphone size={22} color="#fff" />}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: '#0F172A' }}>Install FMCGDist</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748B' }}>
            {isDesktop
              ? 'Open from your taskbar without a browser'
              : 'Works offline · Opens from home screen'}
          </p>
        </div>
        <button onClick={dismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#94A3B8', flexShrink: 0 }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={dismiss}
          style={{
            flex: 1, padding: '10px', borderRadius: 12,
            border: '1px solid #E2E8F0', background: 'transparent',
            cursor: 'pointer', fontSize: 14, fontWeight: 600,
            color: '#64748B', fontFamily: 'inherit',
          }}
        >
          Not now
        </button>
        <button
          onClick={handleInstall}
          disabled={installing}
          style={{
            flex: 2, padding: '10px', borderRadius: 12,
            border: 'none',
            background: installing ? '#93C5FD' : 'linear-gradient(135deg,#1E3A8A,#2563EB)',
            cursor: installing ? 'not-allowed' : 'pointer',
            fontSize: 14, fontWeight: 700, color: '#fff',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 4px 14px rgba(37,99,235,0.30)',
          }}
        >
          <Download size={16} />
          {installing ? 'Installing…' : 'Install App'}
        </button>
      </div>
    </div>
  );
}