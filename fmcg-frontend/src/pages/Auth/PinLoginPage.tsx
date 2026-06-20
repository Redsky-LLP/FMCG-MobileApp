// PATH: src/pages/Auth/PinLoginPage.tsx
// PIN-only login - Eastern-style dark theme

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';  // ← Removed Link
import { Package, Delete, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../../api/services';
import { useAuthStore, getRoleHome } from '../../store/authStore';
import type { UserRole, AuthUser } from '../../types';
import { Spinner } from '../../components/ui';

// ── Design tokens (Eastern dark) ─────────────────────────────
const T = {
  bg:       '#0f172a',
  surface:  '#1e293b',
  border:   '#334155',
  accent:   '#ea580c',
  accentHov:'#c2410c',
  text:     '#f1f5f9',
  muted:    '#94a3b8',
  sub:      '#64748b',
  green:    '#16a34a',
};

function DigitBtn({
  label, sub, onClick, disabled,
}: {
  label: string; sub?: string; onClick: () => void; disabled: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        width: '100%', paddingTop: 16, paddingBottom: 16,
        borderRadius: 12,
        border: `1px solid ${pressed ? T.accent : T.border}`,
        background: pressed ? T.accent : T.surface,
        color: pressed ? '#fff' : T.text,
        fontSize: 22, fontWeight: 500,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.08s, border-color 0.08s',
        gap: 2, fontFamily: 'inherit',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
      }}
    >
      <span>{label}</span>
      {sub && <span style={{ fontSize: 9, color: pressed ? 'rgba(255,255,255,0.7)' : T.sub, letterSpacing: 1, fontWeight: 400 }}>{sub}</span>}
    </button>
  );
}

const KEYS = [
  { label: '1', sub: '' },
  { label: '2', sub: 'ABC' },
  { label: '3', sub: 'DEF' },
  { label: '4', sub: 'GHI' },
  { label: '5', sub: 'JKL' },
  { label: '6', sub: 'MNO' },
  { label: '7', sub: 'PQRS' },
  { label: '8', sub: 'TUV' },
  { label: '9', sub: 'WXYZ' },
];

const PIN_LENGTH = 4;

export default function PinLoginPage() {
  const navigate  = useNavigate();
  const { setUser } = useAuthStore();

  const [pin,     setPin]     = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  function backspace() { setPin(p => p.slice(0, -1)); }

  async function submit(finalPin: string) {
    if (finalPin.length < 4) return;
    setError('');
    setLoading(true);
    try {
      const res = await authApi.pinLogin(finalPin);
      const user: AuthUser = {
        id:           res.userId,
        email:        res.email,
        name:         res.fullName,
        role:         res.role as UserRole,
        token:        res.token,
        refreshToken: res.refreshToken,
        sessionId:    res.sessionId,
      };
      setUser(user);
      navigate(getRoleHome(user.role));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid PIN. Please try again.');
      setPin('');
    } finally {
      setLoading(false);
    }
  }

  function handlePress(digit: string) {
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + digit;
    setPin(next);
    if (next.length >= 4) submit(next);
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: T.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px 16px',
      paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
    }}>
      <div style={{ width: '100%', maxWidth: 340 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, background: T.accent, borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
            boxShadow: '0 8px 24px rgba(234,88,12,0.35)',
          }}>
            <Package size={28} color="#fff" strokeWidth={2} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0, letterSpacing: '-0.02em' }}>
            FMCG<span style={{ color: T.accent }}>Dist</span>
          </h1>
          <p style={{ color: T.sub, fontSize: 12, marginTop: 4, fontWeight: 500 }}>
            Enter your PIN to login
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 20,
          padding: '24px 20px',
        }}>

          {/* Error */}
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 10, marginBottom: 16,
              background: 'rgba(220,38,38,0.12)',
              border: '1px solid rgba(220,38,38,0.30)',
              color: '#fca5a5', fontSize: 13, fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          {/* PIN Display */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            {/* PIN dots with show/hide toggle */}
            <div style={{ position: 'relative', width: '100%' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 14,
                padding: '12px 0',
              }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: i < pin.length ? T.accent : 'transparent',
                    border: `2px solid ${i < pin.length ? T.accent : T.border}`,
                    transition: 'all 0.15s cubic-bezier(0.34,1.4,0.64,1)',
                    transform: i < pin.length ? 'scale(1.15)' : 'scale(1)',
                    boxShadow: i < pin.length ? '0 2px 8px rgba(234,88,12,0.40)' : 'none',
                  }} />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: T.muted,
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Hidden PIN input for accessibility */}
            {showPin && (
              <div style={{ width: '100%' }}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: T.bg,
                    border: `1px solid ${T.border}`,
                    borderRadius: 10,
                    fontSize: 20,
                    color: T.text,
                    textAlign: 'center',
                    letterSpacing: 8,
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                  autoFocus
                />
              </div>
            )}

            <p style={{ color: T.sub, fontSize: 11, margin: 0 }}>
              {pin.length < 4 ? `Enter ${4 - pin.length} more digit${4 - pin.length > 1 ? 's' : ''}` : 'PIN complete ✓'}
            </p>
          </div>

          {/* Number Pad */}
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <Spinner size={36} />
              <p style={{ color: T.sub, fontSize: 13, marginTop: 12 }}>Verifying PIN...</p>
            </div>
          ) : (
            <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 16 }}>
              {KEYS.map(k => (
                <DigitBtn key={k.label} label={k.label} sub={k.sub}
                  onClick={() => handlePress(k.label)} disabled={loading} />
              ))}
              <div />
              <DigitBtn label="0" onClick={() => handlePress('0')} disabled={loading} />
              <button
                onClick={backspace}
                disabled={loading || pin.length === 0}
                style={{
                  width: '100%', paddingTop: 16, paddingBottom: 16,
                  borderRadius: 12,
                  border: `1px solid ${T.border}`, background: T.surface,
                  color: T.muted,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: pin.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: pin.length === 0 ? 0.35 : 1,
                  transition: 'all 0.12s', touchAction: 'manipulation',
                  fontFamily: 'inherit',
                }}
              >
                <Delete size={20} />
              </button>
            </div>
          )}

          {/* Footer links */}
          <div style={{
            marginTop: 20,
            textAlign: 'center',
            fontSize: 12,
            color: T.sub,
            borderTop: `1px solid ${T.border}`,
            paddingTop: 16,
          }}>
            <a href="/login" style={{ color: T.sub, textDecoration: 'none', fontWeight: 500 }}>
              Use email & password instead
            </a>
            {' · '}
            <span style={{ color: T.muted }}>
              💡 Contact admin if PIN is forgotten
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}