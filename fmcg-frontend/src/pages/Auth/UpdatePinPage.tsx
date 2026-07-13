// PATH: src/pages/Auth/UpdatePinPage.tsx
// Forced PIN migration screen - shown once after a PIN login if the user's
// PIN hasn't been confirmed as the new 6-digit format yet (RequiresPinUpdate).
// Reuses the Eastern dark theme from PinLoginPage.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Delete, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { authApi } from '../../api/services';
import { useAuthStore, getRoleHome } from '../../store/authStore';
import { Spinner } from '../../components/ui';

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

const PIN_LENGTH = 6;

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
        width: '100%',
        paddingTop: 12,
        paddingBottom: 12,
        borderRadius: 10,
        border: `1px solid ${pressed ? T.accent : T.border}`,
        background: pressed ? T.accent : T.surface,
        color: pressed ? '#fff' : T.text,
        fontSize: 20,
        fontWeight: 500,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.08s, border-color 0.08s',
        gap: 1,
        fontFamily: 'inherit',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
        minHeight: 44,
      }}
    >
      <span>{label}</span>
      {sub && <span style={{ fontSize: 8, color: pressed ? 'rgba(255,255,255,0.7)' : T.sub, letterSpacing: 1, fontWeight: 400 }}>{sub}</span>}
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

type Stage = 'enter' | 'confirm';

export default function UpdatePinPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();

  const [stage,   setStage]   = useState<Stage>('enter');
  const [pin,     setPin]     = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const activePin = stage === 'enter' ? pin : confirmPin;

  function backspace() {
    if (stage === 'enter') setPin(p => p.slice(0, -1));
    else setConfirmPin(p => p.slice(0, -1));
  }

  function reset() {
    setStage('enter');
    setPin('');
    setConfirmPin('');
    setError('');
  }

  async function handlePress(digit: string) {
    if (activePin.length >= PIN_LENGTH) return;
    const next = activePin + digit;

    if (stage === 'enter') {
      setPin(next);
      if (next.length === PIN_LENGTH) {
        setStage('confirm');
      }
      return;
    }

    setConfirmPin(next);
    if (next.length === PIN_LENGTH) {
      await trySubmit(pin, next);
    }
  }

  async function trySubmit(newPin: string, confirmation: string) {
    if (newPin !== confirmation) {
      setError("PINs don't match. Try again.");
      setStage('enter');
      setPin('');
      setConfirmPin('');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await authApi.setPin(newPin);
      if (user) setUser({ ...user, requiresPinUpdate: false });
      navigate(user ? getRoleHome(user.role) : '/pin-login', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update PIN. Please try again.');
      reset();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      height: '100vh',
      background: T.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '12px 16px',
      paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
      overflow: 'hidden',
    }}>
      <div style={{ width: '100%', maxWidth: 320 }}>

        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{
            width: 44,
            height: 44,
            background: T.accent,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 8px',
            boxShadow: '0 6px 20px rgba(234,88,12,0.30)',
          }}>
            <Package size={22} color="#fff" strokeWidth={2} />
          </div>
          <h1 style={{
            fontSize: 18,
            fontWeight: 700,
            color: T.text,
            margin: 0,
            letterSpacing: '-0.02em',
          }}>
            FMCG<span style={{ color: T.accent }}>Dist</span>
          </h1>
          <p style={{
            color: T.sub,
            fontSize: 11,
            marginTop: 2,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}>
            <ShieldCheck size={12} />
            {stage === 'enter' ? 'Set your new 6-digit PIN' : 'Confirm your new PIN'}
          </p>
        </div>

        <div style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 16,
          padding: '16px 16px 14px',
        }}>
          <div style={{
            padding: '8px 10px',
            borderRadius: 8,
            marginBottom: 10,
            background: 'rgba(234,88,12,0.10)',
            border: '1px solid rgba(234,88,12,0.25)',
            color: T.text,
            fontSize: 12,
            lineHeight: 1.4,
          }}>
            PINs are now 6 digits for extra security. Please set a new PIN to continue.
          </div>

          {error && (
            <div style={{
              padding: '6px 10px',
              borderRadius: 8,
              marginBottom: 10,
              background: 'rgba(220,38,38,0.12)',
              border: '1px solid rgba(220,38,38,0.30)',
              color: '#fca5a5',
              fontSize: 12,
              fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 10,
                padding: '6px 0',
              }}>
                {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                  <div key={i} style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: i < activePin.length ? T.accent : 'transparent',
                    border: `2px solid ${i < activePin.length ? T.accent : T.border}`,
                    transition: 'all 0.15s cubic-bezier(0.34,1.4,0.64,1)',
                    transform: i < activePin.length ? 'scale(1.1)' : 'scale(1)',
                    boxShadow: i < activePin.length ? '0 2px 6px rgba(234,88,12,0.35)' : 'none',
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
                  padding: 2,
                }}
              >
                {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {!showPin && (
              <p style={{ color: T.sub, fontSize: 10, margin: 0 }}>
                {activePin.length < PIN_LENGTH
                  ? `Enter ${PIN_LENGTH - activePin.length} more digit${PIN_LENGTH - activePin.length > 1 ? 's' : ''}`
                  : 'PIN complete ✓'}
              </p>
            )}
          </div>

          {loading ? (
            <div style={{ padding: 16, textAlign: 'center' }}>
              <Spinner size={32} />
              <p style={{ color: T.sub, fontSize: 12, marginTop: 8 }}>Saving your new PIN...</p>
            </div>
          ) : (
            <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 10 }}>
              {KEYS.map(k => (
                <DigitBtn key={k.label} label={k.label} sub={k.sub}
                  onClick={() => handlePress(k.label)} disabled={loading} />
              ))}
              <div />
              <DigitBtn label="0" onClick={() => handlePress('0')} disabled={loading} />
              <button
                onClick={backspace}
                disabled={loading || activePin.length === 0}
                style={{
                  width: '100%',
                  paddingTop: 12,
                  paddingBottom: 12,
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  background: T.surface,
                  color: T.muted,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: activePin.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: activePin.length === 0 ? 0.35 : 1,
                  transition: 'all 0.12s',
                  touchAction: 'manipulation',
                  fontFamily: 'inherit',
                  minHeight: 44,
                }}
              >
                <Delete size={18} />
              </button>
            </div>
          )}

          {stage === 'confirm' && !loading && (
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <button
                onClick={reset}
                style={{ background: 'none', border: 'none', color: T.sub, fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Start over
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}