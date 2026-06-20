// PATH: src/pages/Admin/AdminDashboard.tsx
// COMPLETE REWRITE - Dark theme with orange accent, uniform card sizes, sorted by priority, sticky note for password reminder

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  TrendingUp, ShoppingCart, Route, Users, AlertCircle,
  ArrowUpRight, ArrowDownRight, Lock, RefreshCw,
  MapPin, Package, FileText, IndianRupee, BarChart3,
  PlusCircle, ChevronRight, CheckCircle2, Clock4,
  Activity, Landmark, UserCog, CalendarDays, Gift,
  Search, X, StickyNote, Edit3,
} from 'lucide-react';
import { analyticsApi, settlementApi } from '../../api/services';
import type { DashboardKpisDto, DailyClosureStatusDto, DailyClosureResultDto } from '../../types';
import { fmt, fmtNum } from '../../types';
import { PageLoader, Spinner, Alert, ConfirmModal } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';

// ── Dark theme tokens ─────────────────────────────────────────────────────────
const D = {
  bg:       '#0f172a',     // slate-950
  surface:  '#1e293b',     // slate-800
  surface2: '#243447',     // slate-800 variant
  border:   '#334155',     // slate-700
  accent:   '#ea580c',     // orange-600
  accentH:  '#c2410c',     // orange-700
  accentGlow: 'rgba(234,88,12,0.25)',
  text:     '#f1f5f9',     // slate-100
  muted:    '#94a3b8',     // slate-400
  sub:      '#64748b',     // slate-500
  green:    '#22c55e',     // green-500
  red:      '#ef4444',     // red-500
  amber:    '#f59e0b',     // amber-500
  card:     '#1e293b',     // slate-800
};

// ── Navigation configuration - Sorted by Admin Priority ──────────────────────
interface NavHub {
  id: string;
  to: string;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  accent: string;
  accentBg: string;
  badge?: string;
  priority: number;
}

const NAV_HUBS: NavHub[] = [
  { id: 'routes', to: '/admin/routes', label: 'Route Hub', sublabel: 'Assign routes and track live deliveries', icon: MapPin, accent: D.accent, accentBg: `${D.accent}22`, priority: 1 },
  { id: 'orders', to: '/admin/orders', label: 'Orders Panel', sublabel: 'Create, track, and manage customer orders', icon: ShoppingCart, accent: '#3B82F6', accentBg: 'rgba(59,130,246,0.15)', priority: 2 },
  { id: 'customers', to: '/admin/customers', label: 'Customers', sublabel: 'Browse and manage customer catalog', icon: Users, accent: '#8B5CF6', accentBg: 'rgba(139,92,246,0.15)', priority: 3 },
  { id: 'products', to: '/admin/products', label: 'Products', sublabel: 'Manage product catalog and pricing', icon: Package, accent: '#22C55E', accentBg: 'rgba(34,197,94,0.15)', priority: 4 },
  { id: 'settlement', to: '/admin/settlement', label: 'Collections & Ledger', sublabel: 'Financial settlements · Receivables', icon: IndianRupee, accent: '#F59E0B', accentBg: 'rgba(245,158,11,0.15)', priority: 5 },
  { id: 'analytics', to: '/admin/analytics', label: 'System Analytics', sublabel: 'Performance metrics · Reports', icon: BarChart3, accent: '#EC4899', accentBg: 'rgba(236,72,153,0.15)', priority: 6 },
  { id: 'reports', to: '/admin/reports', label: 'Reports', sublabel: 'Download PDF operational reports', icon: FileText, accent: '#14B8A6', accentBg: 'rgba(20,184,166,0.15)', priority: 7 },
  { id: 'incentives', to: '/admin/incentives', label: 'Incentives', sublabel: 'SKU-level salesman incentive configuration', icon: Gift, accent: '#F472B6', accentBg: 'rgba(244,114,182,0.15)', priority: 8 },
  { id: 'users', to: '/admin/users', label: 'User Management', sublabel: 'Manage users and roles', icon: UserCog, accent: '#60A5FA', accentBg: 'rgba(96,165,250,0.15)', priority: 9 },
  { id: 'assignments', to: '/admin/assignments', label: 'Temp Assignments', sublabel: 'Daily route assignment overrides', icon: CalendarDays, accent: '#34D399', accentBg: 'rgba(52,211,153,0.15)', priority: 10 },
  { id: 'session-log', to: '/admin/session-log', label: 'Session Log', sublabel: 'Login & logout times for all users', icon: Clock4, accent: '#A78BFA', accentBg: 'rgba(167,139,250,0.15)', priority: 11 },
  { id: 'settings', to: '/admin/settings', label: 'Settings', sublabel: 'Product groups and measurement units', icon: Landmark, accent: '#94A3B8', accentBg: 'rgba(148,163,184,0.15)', priority: 12 },
];

// ── KPI Card ─────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
}

function KpiCard({ label, value, icon: Icon, color, bgColor, sub, trend }: KpiCardProps) {
  return (
    <div style={{
      background: D.surface,
      borderRadius: 14,
      border: `1px solid ${D.border}`,
      padding: '16px 18px',
      transition: 'all 0.2s',
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLElement).style.borderColor = `${color}44`;
      (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLElement).style.borderColor = D.border;
      (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
    }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={17} style={{ color }} />
        </div>
        {trend && trend !== 'neutral' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 2,
            padding: '2px 8px', borderRadius: 12,
            fontSize: 11, fontWeight: 700,
            background: trend === 'up' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            color: trend === 'up' ? D.green : D.red,
          }}>
            {trend === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          </div>
        )}
      </div>
      <div>
        <p style={{ fontSize: 20, fontWeight: 900, color: D.text, lineHeight: 1.2, letterSpacing: '-0.02em' }}>{value}</p>
        {sub && <p style={{ fontSize: 12, color: D.sub, marginTop: 2 }}>{sub}</p>}
      </div>
      <p style={{ fontSize: 12, color: D.muted, fontWeight: 600, marginTop: 6 }}>{label}</p>
    </div>
  );
}

// ── Hub Block ────────────────────────────────────────────────────────────────
function HubBlock({ hub }: { hub: NavHub }) {
  const Icon = hub.icon;
  return (
    <Link
      to={hub.to}
      style={{
        background: D.surface,
        border: `1px solid ${D.border}`,
        borderRadius: 14,
        padding: '18px 20px',
        textDecoration: 'none',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        minHeight: 80,
        height: '100%',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = `${hub.accent}55`;
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 20px ${hub.accent}22`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = D.border;
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      }}
    >
      <div style={{ width: 44, height: 44, borderRadius: 11, flexShrink: 0, background: hub.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={20} style={{ color: hub.accent }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: D.text, margin: 0, letterSpacing: '-0.01em' }}>{hub.label}</p>
        <p style={{ fontSize: 12, color: D.muted, margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hub.sublabel}</p>
      </div>
      <ChevronRight size={16} style={{ color: D.sub, flexShrink: 0 }} />
    </Link>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [kpis, setKpis] = useState<DashboardKpisDto | null>(null);
  const [closure, setClosure] = useState<DailyClosureStatusDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closeNotes, setCloseNotes] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [closureResult, setClosureResult] = useState<DailyClosureResultDto | null>(null);
  const [showStickyNote, setShowStickyNote] = useState(true);

  // Sticky note state - for admin password reminder
  const [stickyNote, setStickyNote] = useState(() => {
    return localStorage.getItem('admin_sticky_note') || 'Default password: Admin@123';
  });
  const [editingNote, setEditingNote] = useState(false);

  const saveStickyNote = (text: string) => {
    setStickyNote(text);
    localStorage.setItem('admin_sticky_note', text);
    setEditingNote(false);
  };

  async function load() {
    setLoading(true);
    try {
      const [k, c] = await Promise.all([
        analyticsApi.getDashboardKpis(),
        settlementApi.getStatus(),
      ]);
      setKpis(k);
      setClosure(c);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCloseDay() {
    setClosing(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await settlementApi.closeDay(today, closeNotes || undefined);
      setClosureResult(res);
      setMsg(`Day closed successfully. ${res.ordersLocked} orders locked. Revenue: ${fmt(res.totalRevenue)}`);
      setConfirmClose(false);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to close day');
    } finally {
      setClosing(false);
    }
  }

  if (loading) return <PageLoader />;

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = user?.name?.split(' ')[0] ?? 'Admin';

  const kpiCards: KpiCardProps[] = kpis ? [
    { label: 'Today Revenue', value: fmt(kpis.todayRevenue), icon: TrendingUp, color: D.accent, bgColor: `${D.accent}22`, trend: 'up' },
    { label: 'Today Orders', value: fmtNum(kpis.todayOrders), icon: ShoppingCart, color: '#3B82F6', bgColor: 'rgba(59,130,246,0.15)' },
    { label: 'Today Variance', value: fmt(kpis.todayVariance), icon: kpis.todayVariance >= 0 ? ArrowUpRight : ArrowDownRight, color: kpis.todayVariance >= 0 ? D.green : D.red, bgColor: kpis.todayVariance >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', trend: kpis.todayVariance >= 0 ? 'up' : 'down' },
    { label: 'Active Routes', value: fmtNum(kpis.activeRoutes), icon: Route, color: '#22C55E', bgColor: 'rgba(34,197,94,0.15)' },
    { label: 'Active Customers', value: fmtNum(kpis.activeCustomers), icon: Users, color: '#8B5CF6', bgColor: 'rgba(139,92,246,0.15)' },
    { label: 'Pending Settlement', value: fmt(kpis.pendingSettlement), icon: AlertCircle, color: D.red, bgColor: 'rgba(239,68,68,0.15)' },
    { label: 'MTD Revenue', value: fmt(kpis.mtdRevenue), icon: TrendingUp, color: D.green, bgColor: 'rgba(34,197,94,0.15)', sub: `${fmtNum(kpis.mtdOrders)} orders`, trend: 'up' },
    { label: 'Top Route', value: kpis.topRouteName ?? 'N/A', icon: Activity, color: D.accent, bgColor: `${D.accent}22`, sub: kpis.topRouteRevenue ? fmt(kpis.topRouteRevenue) : undefined },
  ] : [];

  const sortedHubs = [...NAV_HUBS].sort((a, b) => a.priority - b.priority);

  // Force dark background on body for this page
  React.useEffect(() => {
    document.body.style.background = D.bg;
    return () => {
      document.body.style.background = '';
    };
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: D.bg }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px 40px' }}>

        {/* ── Sticky Note ────────────────────────────────────────────────────── */}
        {showStickyNote && (
          <div style={{
            position: 'sticky',
            top: 0,
            zIndex: 50,
            marginBottom: 20,
            background: 'rgba(245,158,11,0.10)',
            border: `1px solid rgba(245,158,11,0.25)`,
            borderRadius: 12,
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <StickyNote size={18} color={D.amber} style={{ flexShrink: 0 }} />
            
            {editingNote ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                <input
                  type="text"
                  value={stickyNote}
                  onChange={e => setStickyNote(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveStickyNote(stickyNote); }}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: `1px solid ${D.border}`,
                    background: D.bg,
                    color: D.text,
                    fontSize: 13,
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                  autoFocus
                />
                <button onClick={() => saveStickyNote(stickyNote)} style={{ padding: '4px 14px', borderRadius: 6, border: 'none', background: D.accent, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
                <button onClick={() => { setEditingNote(false); setStickyNote(localStorage.getItem('admin_sticky_note') || 'Default password: Admin@123'); }} style={{ padding: '4px 12px', borderRadius: 6, border: `1px solid ${D.border}`, background: 'transparent', color: D.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: D.muted, flex: 1, margin: 0 }}>
                  🔑 <strong style={{ color: D.amber }}>Password Reminder:</strong> {stickyNote}
                </p>
                <button onClick={() => setEditingNote(true)} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${D.border}`, background: 'transparent', color: D.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}><Edit3 size={13} /> Edit</button>
                <button onClick={() => setShowStickyNote(false)} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: 'transparent', color: D.sub, cursor: 'pointer', fontFamily: 'inherit' }}><X size={14} /></button>
              </>
            )}
          </div>
        )}

        {/* ── Welcome Header ────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: D.text, letterSpacing: '-0.03em', margin: 0 }}>
            {getGreeting()}, {firstName} 🎉
          </h1>
          <p style={{ color: D.muted, fontSize: 14, marginTop: 4, fontWeight: 500 }}>
            Here's your operations overview for today.
          </p>
        </div>

        {/* ── Status Strip ───────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, background: D.surface, border: `1px solid ${D.border}` }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: D.green, boxShadow: `0 0 0 3px rgba(34,197,94,0.25)`, animation: 'pulse-ring 2s ease infinite' }} />
            <span style={{ fontSize: 12, color: D.muted, fontWeight: 600 }}>System Status:</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: D.green }}>Operational</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, background: D.surface, border: `1px solid ${D.border}` }}>
            <ArrowUpRight size={14} style={{ color: D.accent }} />
            <span style={{ fontSize: 12, color: D.muted, fontWeight: 600 }}>Active Role:</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: D.accent }}>{user?.role ?? 'Admin'}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: D.surface, border: `1px solid ${D.border}` }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: D.muted }}>{new Date().toLocaleDateString('en-IN', { weekday: 'short' })} — Let's get it done!</span>
          </div>

          {!closure?.isClosed && (
            <button onClick={() => setConfirmClose(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${D.accent}, ${D.accentH})`, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: `0 4px 14px ${D.accentGlow}`, marginLeft: 'auto' }}>
              <Lock size={14} /> Close Day
            </button>
          )}
        </div>

        {/* ── Navigation Hubs ────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {sortedHubs.map(hub => (
              <HubBlock key={hub.id} hub={hub} />
            ))}
          </div>
        </div>

        {/* ── Analytics Card ────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <Link to="/admin/analytics" style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 14, padding: '18px 20px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${D.accent}55`; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = D.border; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: `${D.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart3 size={20} color={D.accent} />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: D.text, margin: 0, letterSpacing: '-0.01em' }}>Analytics</p>
                <p style={{ fontSize: 12, color: D.muted, margin: '2px 0 0' }}>View Insights</p>
              </div>
            </div>
            <ChevronRight size={18} style={{ color: D.sub }} />
          </Link>
        </div>

        {/* ── KPI Metrics ────────────────────────────────────────────────────── */}
        {kpis && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: D.muted, margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Today at a Glance</h2>
              <span style={{ fontSize: 12, color: D.sub }}>Live metrics</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {kpiCards.map((k, i) => (
                <KpiCard key={i} {...k} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Close Day Modal ─────────────────────────────────────────────────── */}
      {confirmClose && (
        <ConfirmModal
          open={confirmClose}
          title="Close Operational Day"
          message="This will lock all submitted orders for today. This action cannot be undone."
          confirmLabel={closing ? 'Closing…' : 'Close Day'}
          danger
          onConfirm={handleCloseDay}
          onCancel={() => setConfirmClose(false)}
        />
      )}
    </div>
  );
}