// PATH: src/pages/Auth/PinLoginPage.tsx
// Redesigned — White & Blue design system

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Package, Delete, Mail, ArrowLeft } from 'lucide-react';
import { authApi } from '../../api/services';
import { useAuthStore, getRoleHome } from '../../store/authStore';
import type { UserRole, AuthUser } from '../../types';
import { Spinner } from '../../components/ui';

// ── PIN digit button ──────────────────────────────────────────
function DigitBtn({
  label, sub, onClick, disabled,
}: {
  label: string; sub?: string; onClick: () => void; disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 72, height: 72, borderRadius: 14,
        border: '1px solid #E2E8F0',
        background: '#F8FAFC',
        color: '#0F172A', fontSize: 22, fontWeight: 700,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.12s',
        gap: 1,
        WebkitTapHighlightColor: 'transparent',
        fontFamily: 'inherit',
      }}
      onMouseEnter={e => {
        if (!disabled) {
          (e.currentTarget as HTMLElement).style.background    = '#EFF6FF';
          (e.currentTarget as HTMLElement).style.borderColor   = 'rgba(37,99,235,0.30)';
          (e.currentTarget as HTMLElement).style.color         = '#2563EB';
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background  = '#F8FAFC';
        (e.currentTarget as HTMLElement).style.borderColor = '#E2E8F0';
        (e.currentTarget as HTMLElement).style.color       = '#0F172A';
      }}
      onPointerDown={e => {
        (e.currentTarget as HTMLButtonElement).style.background  = '#DBEAFE';
        (e.currentTarget as HTMLButtonElement).style.transform   = 'scale(0.95)';
      }}
      onPointerUp={e => {
        (e.currentTarget as HTMLButtonElement).style.background  = '#F8FAFC';
        (e.currentTarget as HTMLButtonElement).style.transform   = 'scale(1)';
      }}
    >
      <span>{label}</span>
      {sub && <span style={{ fontSize: 9, color: '#94A3B8', letterSpacing: 1 }}>{sub}</span>}
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
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  const [email,   setEmail]   = useState('');
  const [pin,     setPin]     = useState('');
  const [step,    setStep]    = useState<'email' | 'pin'>('email');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  function handleEmailNext() {
    setError('');
    if (!email.trim()) { setError('Please enter your email.'); return; }
    setStep('pin');
  }

  function backspace() { setPin(p => p.slice(0, -1)); }

  async function submit(finalPin: string) {
    if (finalPin.length < 4) return;
    setError('');
    setLoading(true);
    try {
      const res = await authApi.pinLogin(email, finalPin);
      const user: AuthUser = {
        id:    res.userId,
        email: res.email,
        name:  res.fullName,
        role:  res.role as UserRole,
        token: res.token,
      };
      setUser(user);
      navigate(getRoleHome(user.role));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed.');
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
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #EFF6FF 0%, #F1F5F9 50%, #E0F2FE 100%)',
      padding: 20, position: 'relative', overflow: 'hidden',
    }}>

      {/* Decorative blobs */}
      <div style={{
        position: 'fixed', top: '-10%', right: '-5%',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(37,99,235,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed', bottom: '-15%', left: '-8%',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(30,58,138,0.05) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%', maxWidth: 360,
        animation: 'slide-up 0.35s cubic-bezier(0.34,1.2,0.64,1)',
        position: 'relative', zIndex: 1,
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56,
            background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)',
            borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
            boxShadow: '0 8px 28px rgba(37,99,235,0.28)',
          }}>
            <Package size={27} color="#fff" strokeWidth={2} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em', margin: 0, color: '#0F172A' }}>
            FMCG<span style={{ color: '#2563EB' }}>Dist</span>
          </h1>
          <p style={{ color: '#64748B', fontSize: 12, marginTop: 5, fontWeight: 500 }}>
            Salesman Quick Login
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 20,
          padding: '28px 24px',
          boxShadow: '0 4px 24px rgba(15,23,42,0.08), 0 1px 4px rgba(15,23,42,0.04)',
        }}>

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 10,
              background: 'rgba(220,38,38,0.06)',
              border: '1px solid rgba(220,38,38,0.20)',
              color: '#B91C1C', fontSize: 13, fontWeight: 500, marginBottom: 20,
            }}>
              {error}
            </div>
          )}

          {/* Step 1: Email */}
          {step === 'email' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{
                margin: 0, fontSize: 17, fontWeight: 800,
                color: '#0F172A', letterSpacing: '-0.03em',
              }}>
                Enter your email
              </h2>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{
                  position: 'absolute', left: 13, top: '50%',
                  transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none',
                }} />
                <input
                  type="email"
                  placeholder="salesman@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleEmailNext()}
                  autoFocus
                  autoComplete="email"
                  style={{
                    width: '100%', padding: '11px 14px 11px 38px',
                    background: '#F8FAFC', border: '1px solid #E2E8F0',
                    borderRadius: 10, fontSize: 14, color: '#334155',
                    outline: 'none', fontFamily: 'inherit',
                    transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = '#2563EB';
                    e.target.style.boxShadow   = '0 0 0 3px rgba(37,99,235,0.12)';
                    e.target.style.background  = '#fff';
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = '#E2E8F0';
                    e.target.style.boxShadow   = 'none';
                    e.target.style.background  = '#F8FAFC';
                  }}
                />
              </div>
              <button
                onClick={handleEmailNext}
                style={{
                  padding: '12px',
                  background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)',
                  color: '#fff', border: 'none', borderRadius: 11,
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(37,99,235,0.28)',
                  fontFamily: 'inherit', letterSpacing: '-0.01em',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 20px rgba(37,99,235,0.36)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(37,99,235,0.28)';
                }}
              >
                Continue →
              </button>
              <Link to="/login" style={{
                textAlign: 'center', fontSize: 13,
                color: '#64748B', textDecoration: 'none', fontWeight: 500,
              }}>
                Use password instead
              </Link>
            </div>
          )}

          {/* Step 2: PIN keypad */}
          {step === 'pin' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>

              {/* Back + user info */}
              <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => { setStep('email'); setPin(''); setError(''); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 32, height: 32, borderRadius: 8,
                    border: '1px solid #E2E8F0', background: '#F8FAFC',
                    cursor: 'pointer', color: '#64748B', flexShrink: 0,
                    transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background   = '#EFF6FF';
                    (e.currentTarget as HTMLElement).style.borderColor  = 'rgba(37,99,235,0.25)';
                    (e.currentTarget as HTMLElement).style.color        = '#2563EB';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background   = '#F8FAFC';
                    (e.currentTarget as HTMLElement).style.borderColor  = '#E2E8F0';
                    (e.currentTarget as HTMLElement).style.color        = '#64748B';
                  }}
                >
                  <ArrowLeft size={15} />
                </button>
                <div>
                  <p style={{ margin: 0, fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>Enter PIN for</p>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#0F172A' }}>{email}</p>
                </div>
              </div>

              {/* PIN dots */}
              <div style={{ display: 'flex', gap: 14 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{
                    width: 14, height: 14, borderRadius: '50%',
                    background: i < pin.length
                      ? 'linear-gradient(135deg, #1E3A8A, #2563EB)'
                      : '#E2E8F0',
                    boxShadow: i < pin.length ? '0 2px 8px rgba(37,99,235,0.35)' : 'none',
                    transition: 'all 0.18s cubic-bezier(0.34,1.4,0.64,1)',
                    transform: i < pin.length ? 'scale(1.15)' : 'scale(1)',
                  }} />
                ))}
              </div>

              {loading
                ? <div style={{ padding: 16 }}><Spinner size={32} /></div>
                : (
                  <>
                    {/* Keypad */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gap: 10 }}>
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
                          width: 72, height: 72, borderRadius: 14,
                          border: '1px solid #E2E8F0', background: '#F8FAFC',
                          color: '#64748B',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: pin.length === 0 ? 'not-allowed' : 'pointer',
                          opacity: pin.length === 0 ? 0.4 : 1,
                          transition: 'all 0.12s',
                        }}
                        onMouseEnter={e => {
                          if (pin.length > 0) {
                            (e.currentTarget as HTMLElement).style.background   = '#FEF2F2';
                            (e.currentTarget as HTMLElement).style.borderColor  = 'rgba(220,38,38,0.25)';
                            (e.currentTarget as HTMLElement).style.color        = '#DC2626';
                          }
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.background   = '#F8FAFC';
                          (e.currentTarget as HTMLElement).style.borderColor  = '#E2E8F0';
                          (e.currentTarget as HTMLElement).style.color        = '#64748B';
                        }}
                      >
                        <Delete size={20} />
                      </button>
                    </div>
                  </>
                )
              }
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#94A3B8', marginTop: 18 }}>
          <Link to="/login" style={{ color: '#94A3B8', textDecoration: 'none' }}>Password login</Link>
          {' · '}
          <a href="#" style={{ color: '#94A3B8', textDecoration: 'none' }}>Help</a>
        </p>
      </div>
    </div>
  );
}