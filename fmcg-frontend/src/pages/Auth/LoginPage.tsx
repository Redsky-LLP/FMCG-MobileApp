// PATH: src/pages/Auth/LoginPage.tsx
// Redesigned — White & Blue design system

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Package, Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { authApi } from '../../api/services';
import { useAuthStore, getRoleHome } from '../../store/authStore';
import type { UserRole, AuthUser } from '../../types';
import { Spinner } from '../../components/ui';
import PWAInstallPrompt from '../../components/PWAInstallPrompt';

export function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Email and password are required.'); return; }
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
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
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight:      '100vh',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      background:     'linear-gradient(135deg, #EFF6FF 0%, #F1F5F9 50%, #E0F2FE 100%)',
      padding:        20,
      position:       'relative',
      overflow:       'hidden',
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
        width: '100%', maxWidth: 400,
        animation: 'slide-up 0.35s cubic-bezier(0.34,1.2,0.64,1)',
        position: 'relative', zIndex: 1,
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 60, height: 60,
            background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)',
            borderRadius: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 32px rgba(37,99,235,0.28)',
          }}>
            <Package size={30} color="#fff" strokeWidth={2} />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.04em', margin: 0, color: '#0F172A' }}>
            FMCG<span style={{ color: '#2563EB' }}>Dist</span>
          </h1>
          <p style={{ color: '#64748B', fontSize: 13, marginTop: 6, fontWeight: 500 }}>
            Distribution Management Platform
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
            Sign In
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

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Email */}
            <div>
              <label style={{
                display: 'block', fontSize: 13, fontWeight: 600,
                color: '#334155', marginBottom: 6, letterSpacing: '-0.01em',
              }}>
                Email address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{
                  position: 'absolute', left: 13, top: '50%',
                  transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none',
                }} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  disabled={loading}
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
            </div>

            {/* Password */}
            <div>
              <label style={{
                display: 'block', fontSize: 13, fontWeight: 600,
                color: '#334155', marginBottom: 6, letterSpacing: '-0.01em',
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{
                  position: 'absolute', left: 13, top: '50%',
                  transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none',
                }} />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                  style={{
                    width: '100%', padding: '11px 44px 11px 38px',
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
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#94A3B8', display: 'flex', alignItems: 'center',
                    padding: 4, borderRadius: 6, transition: 'color 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#2563EB'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#94A3B8'}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit button */}
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
              {loading ? <Spinner size={18} /> : 'Sign In'}
            </button>
          </form>

          {/* Links */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 16, marginTop: 20, fontSize: 13,
          }}>
            <Link to="/pin-login" style={{ color: '#64748B', textDecoration: 'none', fontWeight: 500 }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#2563EB'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#64748B'}
            >
              PIN Login
            </Link>
            <span style={{ color: '#CBD5E1' }}>·</span>
            <Link to="/register" style={{ color: '#2563EB', textDecoration: 'none', fontWeight: 600 }}>
              Create account
            </Link>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#94A3B8', marginTop: 20 }}>
          FMCG Distribution Platform · Secure Access
        </p>

        <PWAInstallPrompt variant="default" autoShowDelay={3000} />
      </div>
    </div>
  );
}