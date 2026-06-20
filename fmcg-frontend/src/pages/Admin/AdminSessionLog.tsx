// PATH: src/pages/Admin/AdminSessionLog.tsx
// UPDATED: Dark theme with orange accent

import { useEffect, useState } from 'react';
import { LogIn, LogOut, Clock, RefreshCw, Search, X, Users } from 'lucide-react';
import { authApi } from '../../api/services';
import { PageLoader, Alert } from '../../components/ui';
import { useIsMobile } from '../../hooks/useIsMobile';

// ── Dark theme tokens ─────────────────────────────────────────────────────────
const D = {
  bg:       '#0f172a',
  surface:  '#1e293b',
  surface2: '#243447',
  border:   '#334155',
  accent:   '#ea580c',
  accentH:  '#c2410c',
  accentGlow: 'rgba(234,88,12,0.25)',
  text:     '#f1f5f9',
  muted:    '#94a3b8',
  sub:      '#64748b',
  green:    '#22c55e',
  red:      '#ef4444',
  amber:    '#f59e0b',
  card:     '#1e293b',
};

interface SessionRow {
  sessionId: string;
  userId: string;
  fullName: string;
  role: string;
  loginAt: string;
  logoutAt?: string;
  loginMethod: string;
  durationMinutes: number;
}

function fmtDT(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function fmtDuration(mins: number) {
  if (mins < 1) return '< 1 min';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function AdminSessionLog() {
  const isMobile = useIsMobile();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [search,   setSearch]   = useState('');
  const [roleFilter, setRoleFilter] = useState<'All' | 'Admin' | 'SuperAdmin' | 'Salesman' | 'Accounts' | 'Warehouse'>('All');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true); setError('');
    try {
      const data = await authApi.getSessions(undefined, 200);
      setSessions(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load sessions');
    } finally { setLoading(false); }
  }

  const filtered = sessions.filter(s => {
    const q = search.toLowerCase();
    const matchesSearch = !q || s.fullName.toLowerCase().includes(q);
    const matchesRole   = roleFilter === 'All' || s.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Calculate stats
  const totalSessions = sessions.length;
  const activeSessions = sessions.filter(s => !s.logoutAt).length;
  const uniqueUsers = new Set(sessions.map(s => s.userId)).size;

  if (loading) return (
    <div style={{ minHeight: '100vh', background: D.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: D.muted }}>Loading sessions...</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: D.bg, padding: '20px 16px 100px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: `${D.accent}22`,
                border: `1px solid ${D.accent}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Clock size={24} color={D.accent} />
              </div>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 900, color: D.text, margin: 0, letterSpacing: '-0.03em' }}>
                  Session Log
                </h1>
                <p style={{ color: D.muted, fontSize: 13, marginTop: 4, fontWeight: 500 }}>
                  Login &amp; logout times for all users
                </p>
              </div>
            </div>
            <button
              onClick={load}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 14px', borderRadius: 9,
                background: D.surface,
                border: `1px solid ${D.border}`,
                color: D.muted,
                fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = D.accent}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = D.border}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          <div style={{
            background: D.surface,
            border: `1px solid ${D.border}`,
            borderRadius: 12,
            padding: '14px 16px',
          }}>
            <span style={{ fontSize: 11, color: D.sub, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Sessions</span>
            <p style={{ fontSize: 24, fontWeight: 900, color: D.text, margin: '4px 0 0' }}>{totalSessions}</p>
          </div>
          <div style={{
            background: D.surface,
            border: `1px solid ${D.border}`,
            borderRadius: 12,
            padding: '14px 16px',
          }}>
            <span style={{ fontSize: 11, color: D.green, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Now</span>
            <p style={{ fontSize: 24, fontWeight: 900, color: D.green, margin: '4px 0 0' }}>{activeSessions}</p>
          </div>
          <div style={{
            background: D.surface,
            border: `1px solid ${D.border}`,
            borderRadius: 12,
            padding: '14px 16px',
          }}>
            <span style={{ fontSize: 11, color: D.accent, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unique Users</span>
            <p style={{ fontSize: 24, fontWeight: 900, color: D.accent, margin: '4px 0 0' }}>{uniqueUsers}</p>
          </div>
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        {/* Filters */}
        <div style={{
          background: D.surface,
          border: `1px solid ${D.border}`,
          borderRadius: 12,
          padding: '12px 16px',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: D.sub }} />
              <input
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 32px',
                  background: D.bg,
                  border: `1px solid ${D.border}`,
                  borderRadius: 8,
                  fontSize: 13,
                  color: D.text,
                  outline: 'none',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.15s',
                }}
                placeholder="Search by name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = D.accent}
                onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = D.border}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: D.sub }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(['All', 'Admin', 'SuperAdmin', 'Salesman', 'Accounts', 'Warehouse'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 16,
                    fontSize: 11,
                    fontWeight: 600,
                    border: `1px solid ${roleFilter === r ? D.accent : D.border}`,
                    background: roleFilter === r ? D.accent : D.surface,
                    color: roleFilter === r ? '#fff' : D.muted,
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                    fontFamily: 'inherit',
                  }}
                >
                  {r === 'All' ? '👥 All' : r}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '48px 20px',
            background: D.surface,
            borderRadius: 14,
            border: `1px solid ${D.border}`,
          }}>
            <Users size={40} color={D.border} style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 14, color: D.muted, margin: 0 }}>No sessions found</p>
            <p style={{ fontSize: 12, color: D.sub, marginTop: 4 }}>Try adjusting your filters</p>
          </div>
        ) : isMobile ? (
          // Mobile card view
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(s => {
              const isActive = !s.logoutAt;
              return (
                <div
                  key={s.sessionId}
                  style={{
                    background: D.surface,
                    border: `1px solid ${isActive ? D.green : D.border}`,
                    borderRadius: 12,
                    padding: '14px 16px',
                    borderLeft: `3px solid ${isActive ? D.green : D.border}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 15, color: D.text }}>{s.fullName}</span>
                      <span style={{
                        display: 'inline-block',
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 12,
                        marginLeft: 8,
                        background: s.role === 'Salesman' ? 'rgba(34,197,94,0.15)' : 'rgba(234,88,12,0.15)',
                        color: s.role === 'Salesman' ? D.green : D.accent,
                        border: `1px solid ${s.role === 'Salesman' ? 'rgba(34,197,94,0.25)' : 'rgba(234,88,12,0.25)'}`,
                      }}>
                        {s.role}
                      </span>
                    </div>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: 12,
                      background: isActive ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.10)',
                      color: isActive ? D.green : D.sub,
                      border: `1px solid ${isActive ? 'rgba(34,197,94,0.25)' : D.border}`,
                    }}>
                      {isActive ? '🟢 Active' : 'Logged out'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
                    <div>
                      <span style={{ color: D.sub }}>Method:</span>
                      <span style={{ color: D.text, fontWeight: 600, marginLeft: 4 }}>
                        {s.loginMethod === 'PIN' ? '🔢 PIN' : '📧 Email'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: D.sub }}>Duration:</span>
                      <span style={{ color: isActive ? D.green : D.text, fontWeight: 600, marginLeft: 4 }}>
                        {fmtDuration(s.durationMinutes)}{isActive && ' (active)'}
                      </span>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ color: D.sub }}>Login:</span>
                      <span style={{ color: D.text, fontWeight: 500, marginLeft: 4, fontSize: 11 }}>{fmtDT(s.loginAt)}</span>
                    </div>
                    {s.logoutAt && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span style={{ color: D.sub }}>Logout:</span>
                        <span style={{ color: D.text, fontWeight: 500, marginLeft: 4, fontSize: 11 }}>{fmtDT(s.logoutAt)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Desktop table view
          <div style={{
            background: D.surface,
            borderRadius: 14,
            border: `1px solid ${D.border}`,
            overflow: 'hidden',
          }}>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', minWidth: 800, borderCollapse: 'collapse', fontSize: 13, background: D.surface }}>
                <thead>
                  <tr>
                    {['Name', 'Role', 'Method', 'Login Time', 'Logout Time', 'Duration', 'Status'].map(h => (
                      <th key={h} style={{
                        background: D.bg,
                        color: D.muted,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase' as const,
                        padding: '10px 14px',
                        borderBottom: `1px solid ${D.border}`,
                        textAlign: 'left' as const,
                        whiteSpace: 'nowrap' as const,
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => {
                    const isActive = !s.logoutAt;
                    return (
                      <tr
                        key={s.sessionId}
                        style={{
                          borderBottom: `1px solid ${D.border}`,
                          transition: 'background 0.12s',
                          opacity: isActive ? 1 : 0.6,
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                      >
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: D.text, fontSize: 13 }}>
                          {s.fullName}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            display: 'inline-block',
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 12,
                            background: s.role === 'Salesman' ? 'rgba(34,197,94,0.15)' : 'rgba(234,88,12,0.15)',
                            color: s.role === 'Salesman' ? D.green : D.accent,
                            border: `1px solid ${s.role === 'Salesman' ? 'rgba(34,197,94,0.25)' : 'rgba(234,88,12,0.25)'}`,
                          }}>
                            {s.role}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ color: s.loginMethod === 'PIN' ? D.amber : D.accent, fontWeight: 600 }}>
                            {s.loginMethod === 'PIN' ? '🔢 PIN' : '📧 Email'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', color: D.text, fontSize: 12 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <LogIn size={12} color={D.green} />
                            {fmtDT(s.loginAt)}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', color: D.text, fontSize: 12 }}>
                          {s.logoutAt ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <LogOut size={12} color={D.red} />
                              {fmtDT(s.logoutAt)}
                            </span>
                          ) : (
                            <span style={{ color: D.sub, fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: isActive ? D.green : D.text }}>
                            <Clock size={12} />
                            {fmtDuration(s.durationMinutes)}
                            {isActive && <span style={{ color: D.green, fontSize: 10, fontWeight: 600 }}>(active)</span>}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            display: 'inline-block',
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: 12,
                            background: isActive ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.10)',
                            color: isActive ? D.green : D.sub,
                            border: `1px solid ${isActive ? 'rgba(34,197,94,0.25)' : D.border}`,
                          }}>
                            {isActive ? '🟢 Active' : 'Logged out'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{
          marginTop: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          fontSize: 12,
          color: D.sub,
        }}>
          <span>Showing {filtered.length} of {sessions.length} sessions</span>
          <span>All times in local timezone · Last 200 sessions</span>
        </div>
      </div>
    </div>
  );
}