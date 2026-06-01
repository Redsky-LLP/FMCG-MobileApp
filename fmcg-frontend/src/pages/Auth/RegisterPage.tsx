// PATH: src/pages/Auth/RegisterPage.tsx
// Redesigned — White & Blue design system

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Package, User, Mail, Lock, ShieldCheck } from 'lucide-react';
import { authApi } from '../../api/services';
import { Spinner } from '../../components/ui';

const ROLES = ['Admin', 'Salesman', 'Accounts', 'Warehouse'];

const ROLE_DESCRIPTIONS: Record<string, string> = {
  Admin:     'Full platform access',
  Salesman:  'Field orders & routes',
  Accounts:  'Settlement & reports',
  Warehouse: 'Loading & packing',
};

export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '', role: 'Salesman',
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  function update(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      await authApi.register(form.email, form.password, form.name, form.role);
      setSuccess('Account created! Redirecting to login...');
      setTimeout(() => navigate('/login'), 1800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = (focused = false): React.CSSProperties => ({
    width: '100%', padding: '11px 14px 11px 38px',
    background: focused ? '#fff' : '#F8FAFC',
    border: `1px solid ${focused ? '#2563EB' : '#E2E8F0'}`,
    borderRadius: 10, fontSize: 14, color: '#334155',
    outline: 'none', fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
    boxShadow: focused ? '0 0 0 3px rgba(37,99,235,0.12)' : 'none',
  });

  function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
    e.target.style.borderColor = '#2563EB';
    e.target.style.boxShadow   = '0 0 0 3px rgba(37,99,235,0.12)';
    (e.target as HTMLElement).style.background  = '#fff';
  }
  function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
    e.target.style.borderColor = '#E2E8F0';
    e.target.style.boxShadow   = 'none';
    (e.target as HTMLElement).style.background  = '#F8FAFC';
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #EFF6FF 0%, #F1F5F9 50%, #E0F2FE 100%)',
      padding: '40px 20px', position: 'relative', overflow: 'hidden',
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
        width: '100%', maxWidth: 460,
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
          <p style={{ color: '#64748B', fontSize: 13, marginTop: 5, fontWeight: 500 }}>
            Create your account
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 20,
          padding: '32px 28px',
          boxShadow: '0 4px 24px rgba(15,23,42,0.08), 0 1px 4px rgba(15,23,42,0.04)',
        }}>
          <h2 style={{
            fontSize: 20, fontWeight: 800, color: '#0F172A',
            marginBottom: 24, marginTop: 0, letterSpacing: '-0.03em',
          }}>
            Register
          </h2>

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
          {success && (
            <div style={{
              padding: '10px 14px', borderRadius: 10,
              background: 'rgba(22,163,74,0.06)',
              border: '1px solid rgba(22,163,74,0.20)',
              color: '#15803D', fontSize: 13, fontWeight: 500, marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <ShieldCheck size={15} /> {success}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Full Name */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Full Name
              </label>
              <div style={{ position: 'relative' }}>
                <User size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                <input
                  style={inputStyle()}
                  value={form.name}
                  onChange={e => update('name', e.target.value)}
                  placeholder="John Doe"
                  disabled={loading}
                  onFocus={onFocus}
                  onBlur={onBlur}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                <input
                  type="email"
                  style={inputStyle()}
                  value={form.email}
                  onChange={e => update('email', e.target.value)}
                  placeholder="you@company.com"
                  disabled={loading}
                  onFocus={onFocus}
                  onBlur={onBlur}
                />
              </div>
            </div>

            {/* Role selector */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                Role
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {ROLES.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => update('role', r)}
                    disabled={loading}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: `1px solid ${form.role === r ? 'rgba(37,99,235,0.40)' : '#E2E8F0'}`,
                      background: form.role === r ? '#EFF6FF' : '#F8FAFC',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.14s',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: form.role === r ? '#1D4ED8' : '#334155' }}>
                      {r}
                    </div>
                    <div style={{ fontSize: 11, color: form.role === r ? '#3B82F6' : '#94A3B8', marginTop: 1 }}>
                      {ROLE_DESCRIPTIONS[r]}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                <input
                  type="password"
                  style={inputStyle()}
                  value={form.password}
                  onChange={e => update('password', e.target.value)}
                  placeholder="Min. 6 characters"
                  disabled={loading}
                  onFocus={onFocus}
                  onBlur={onBlur}
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Confirm Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                <input
                  type="password"
                  style={inputStyle()}
                  value={form.confirmPassword}
                  onChange={e => update('confirmPassword', e.target.value)}
                  placeholder="Repeat password"
                  disabled={loading}
                  onFocus={onFocus}
                  onBlur={onBlur}
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '13px',
                background: loading ? '#BFDBFE' : 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)',
                color: '#fff', border: 'none', borderRadius: 12,
                fontSize: 15, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: loading ? 'none' : '0 4px 16px rgba(37,99,235,0.30)',
                transition: 'all 0.18s', letterSpacing: '-0.01em',
                fontFamily: 'inherit', marginTop: 4,
              }}
              onMouseEnter={e => {
                if (!loading) {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(37,99,235,0.38)';
                }
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(37,99,235,0.30)';
              }}
            >
              {loading ? <Spinner size={18} /> : 'Create Account'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#64748B' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#2563EB', textDecoration: 'none', fontWeight: 600 }}>
              Sign in
            </Link>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#94A3B8', marginTop: 20 }}>
          FMCG Distribution Platform · Secure Registration
        </p>
      </div>
    </div>
  );
}