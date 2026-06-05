// PATH: src/components/PWAInstallPrompt.tsx
// Smart install prompt:
//  - Android/Chrome: shows native "Add to Home Screen" banner
//  - iOS Safari: shows step-by-step Share → Add to Home Screen instructions
//  - Desktop Chrome: shows install button
//  - Already installed or dismissed: hidden forever (stored in localStorage)

import { useEffect, useState } from 'react';
import { Download, Share, X, Smartphone, Monitor } from 'lucide-react';

// The beforeinstallprompt event is non-standard — type it manually
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

// ─────────────────────────────────────────────────────────────────────────────
export default function PWAInstallPrompt() {
  const [platform, setPlatform]           = useState<Platform>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow]                   = useState(false);
  const [installing, setInstalling]       = useState(false);
  const [showIOSSteps, setShowIOSSteps]   = useState(false);

  useEffect(() => {
    // Don't show if already installed or previously dismissed
    if (isRunningAsInstalledPWA() || isDismissed()) return;

    const p = detectPlatform();
    setPlatform(p);

    // Android / Desktop Chrome: listen for the browser's install event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Small delay so the page has loaded before showing the banner
      setTimeout(() => setShow(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // iOS: show manually since Safari doesn't fire beforeinstallprompt
    if (p === 'ios') {
      setTimeout(() => setShow(true), 3000);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function dismiss() {
    setShow(false);
    markDismissed();
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
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

  // ── iOS banner ───────────────────────────────────────────────────────────
  if (platform === 'ios') {
    return (
      <div
        role="dialog"
        aria-label="Install app"
        style={{
          position:     'fixed',
          bottom:       'calc(70px + env(safe-area-inset-bottom, 0px) + 12px)',
          left:         16,
          right:        16,
          zIndex:       200,
          background:   '#fff',
          border:       '1px solid #E2E8F0',
          borderRadius: 20,
          boxShadow:    '0 -4px 32px rgba(15,23,42,0.14), 0 8px 32px rgba(15,23,42,0.12)',
          padding:      '20px 20px 16px',
          animation:    'slide-up 0.3s cubic-bezier(0.34,1.2,0.64,1)',
        }}
      >
        {/* Header */}
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
          <button
            onClick={dismiss}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#94A3B8' }}
            aria-label="Dismiss"
          >
            <X size={18} />
          </button>
        </div>

        {/* Steps toggle */}
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

  // ── Android / Desktop banner ─────────────────────────────────────────────
  const isDesktop = platform === 'desktop';
  return (
    <div
      role="dialog"
      aria-label="Install app"
      style={{
        position:     'fixed',
        bottom:       isDesktop ? 24 : 'calc(70px + env(safe-area-inset-bottom, 0px) + 12px)',
        left:         isDesktop ? 'auto' : 16,
        right:        isDesktop ? 24 : 16,
        width:        isDesktop ? 340 : 'auto',
        zIndex:       200,
        background:   '#fff',
        border:       '1px solid #E2E8F0',
        borderRadius: 20,
        boxShadow:    '0 -4px 32px rgba(15,23,42,0.14), 0 8px 32px rgba(15,23,42,0.12)',
        padding:      '18px 18px 14px',
        animation:    'slide-up 0.3s cubic-bezier(0.34,1.2,0.64,1)',
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
        <button
          onClick={dismiss}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#94A3B8', flexShrink: 0 }}
          aria-label="Dismiss"
        >
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
            fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
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