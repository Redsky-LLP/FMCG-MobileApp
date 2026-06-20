// PATH: src/pages/Dashboard/HomeHub.tsx
// UPDATED: Dark theme with orange accent - Settings removed, Users & Reports enlarged

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Route, ShoppingCart, Users, IndianRupee, BarChart3,
  Plus, X, ClipboardList, Banknote, ScanBarcode,
  Package, Warehouse, FileText, Calculator,
  Zap, ChevronRight, TrendingUp, Clock, Shield,
  ArrowUpRight, Settings, Sparkles, MapPin,
  Gift, UserCog, CalendarDays, Boxes,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { routesApi, customersApi, ordersApi, settlementApi } from '../../api/services';
import { fmt } from '../../types';

// ── Dark theme tokens ─────────────────────────────────────────────────────────
const D = {
  bg:       '#0f172a',
  surface:  '#1e293b',
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

interface NavBlock {
  id:          string;
  label:       string;
  description: string;
  icon:        React.ElementType;
  to:          string;
  badge?:      string;
  badgeColor?: 'blue' | 'green' | 'amber' | 'red' | 'violet';
  accent:      string;
  accentText:  string;
  roles:       string[];
  size?:       'large' | 'small';
}

interface StatCard {
  id:    string;
  label: string;
  value: string;
  icon:  React.ElementType;
  to:    string;
  color: string;
  bg:    string;
  roles: string[];
}

interface QuickAction {
  id:          string;
  label:       string;
  description: string;
  icon:        React.ElementType;
  to:          string;
  color:       string;
  roles:       string[];
}

// ── Large Nav Blocks (priority order for admin) ────────────────
// REMOVED: 'settings' - Settings card removed
// ADDED: 'users' and 'reports' as large cards
const NAV_BLOCKS: NavBlock[] = [
  // ── Salesman ──
  {
    id: 'routes', label: 'Deliveries & Routes',
    description: 'View and manage today\'s delivery routes',
    icon: Route, to: '/salesman/routes',
    badge: '3 Active', badgeColor: 'blue',
    accent: '#EFF6FF', accentText: '#2563EB', roles: ['Salesman'],
  },
  {
    id: 'salesman-orders', label: 'My Orders',
    description: 'View and submit field orders',
    icon: ShoppingCart, to: '/salesman/routes',
    badge: '5 Open', badgeColor: 'blue',
    accent: '#EFF6FF', accentText: '#2563EB', roles: ['Salesman'],
  },
  // ── Admin priority order ──
  {
    id: 'admin-routes', label: 'Route Hub',
    description: 'Assign routes and track live deliveries',
    icon: Route, to: '/admin/routes',
    badge: 'Live', badgeColor: 'green',
    accent: D.accent, accentText: D.accent, roles: ['Admin', 'SuperAdmin'],
  },
  {
    id: 'orders', label: 'Orders Panel',
    description: 'Create, track, and manage customer orders',
    icon: ShoppingCart, to: '/admin/orders',
    badge: '12 Pending', badgeColor: 'blue',
    accent: '#3B82F6', accentText: '#3B82F6', roles: ['Admin', 'SuperAdmin'],
  },
  {
    id: 'customers', label: 'Customers',
    description: 'Browse and manage customer catalog',
    icon: Users, to: '/admin/customers',
    badge: '248 Active', badgeColor: 'blue',
    accent: '#8B5CF6', accentText: '#8B5CF6', roles: ['Admin', 'SuperAdmin'],
  },
  // Products card (kept as normal card)
  {
    id: 'products', label: 'Products',
    description: 'Manage product catalog and pricing',
    icon: Package, to: '/admin/products',
    accent: '#22C55E', accentText: '#22C55E', roles: ['Admin', 'SuperAdmin'],
  },
  // ❌ Settings card REMOVED - no longer here
  // ✅ Users card - ENLARGED (moved from More Tools)
  {
    id: 'users', label: 'User Management',
    description: 'Manage users, roles, and permissions across the platform',
    icon: UserCog, to: '/admin/users',
    accent: '#60A5FA', accentText: '#60A5FA', roles: ['Admin', 'SuperAdmin'],
    size: 'large',
  },
  // ✅ Reports card - ENLARGED (moved from More Tools)
  {
    id: 'reports', label: 'Reports',
    description: 'Generate and view detailed business reports and analytics',
    icon: FileText, to: '/admin/reports',
    accent: '#14B8A6', accentText: '#14B8A6', roles: ['Admin', 'SuperAdmin'],
    size: 'large',
  },
  // ── Accounts ──
  {
    id: 'accounts-settlement', label: 'Settlement',
    description: 'Process daily collections and closures',
    icon: IndianRupee, to: '/accounts/settlement',
    badge: 'Today', badgeColor: 'blue',
    accent: '#F59E0B', accentText: '#F59E0B', roles: ['Accounts'],
  },
  {
    id: 'accounts-reports', label: 'Reports',
    description: 'Daily and monthly financial reports',
    icon: FileText, to: '/accounts/reports',
    accent: '#14B8A6', accentText: '#14B8A6', roles: ['Accounts'],
  },
  // ── Warehouse ──
  {
    id: 'loading', label: 'Loading Sheet',
    description: 'Manage warehouse packing and dispatch',
    icon: Warehouse, to: '/warehouse/loading',
    badge: 'Ready', badgeColor: 'green',
    accent: D.accent, accentText: D.accent, roles: ['Warehouse'],
  },
  {
    id: 'pack-orders', label: 'Pack Orders',
    description: 'Process and pack confirmed orders',
    icon: Package, to: '/warehouse/dispatch',
    accent: D.accent, accentText: D.accent, roles: ['Warehouse'],
  },
];

// ── Small stat cards for Admin ─────────────────────────────────
const STAT_CARDS: StatCard[] = [
  {
    id: 'analytics', label: 'Analytics',
    value: 'View Insights', icon: BarChart3,
    to: '/admin/analytics',
    color: D.accent, bg: `${D.accent}22`, roles: ['Admin', 'SuperAdmin'],
  },
];

// ── Quick Actions ──────────────────────────────────────────────
const QUICK_ACTIONS: QuickAction[] = [
  { id: 'new-order', label: 'New Order', description: 'Create a fresh customer order', icon: ClipboardList, to: '/admin/orders', color: D.accent, roles: ['Admin', 'SuperAdmin', 'Salesman'] },
  { id: 'record-payment', label: 'Record Payment', description: 'Log a collection or payment', icon: Banknote, to: '/admin/settlement', color: '#22C55E', roles: ['Admin', 'SuperAdmin', 'Accounts'] },
  { id: 'scan-sku', label: 'Scan Product', description: 'Scan barcode or search SKU', icon: ScanBarcode, to: '/admin/products', color: '#8B5CF6', roles: ['Admin', 'SuperAdmin', 'Warehouse'] },
  { id: 'add-customer', label: 'Add Customer', description: 'Register a new customer', icon: Users, to: '/admin/customers', color: '#F59E0B', roles: ['Admin', 'SuperAdmin', 'Salesman'] },
  { id: 'view-routes', label: 'View Routes', description: 'Check today\'s route map', icon: Route, to: '/salesman/routes', color: D.accent, roles: ['Salesman'] },
  { id: 'start-route', label: 'Start Route', description: 'Begin executing a delivery route', icon: Zap, to: '/salesman/routes', color: '#06B6D4', roles: ['Salesman'] },
  { id: 'reports', label: 'View Reports', description: 'Open financial and sales reports', icon: FileText, to: '/admin/reports', color: '#14B8A6', roles: ['Admin', 'SuperAdmin', 'Accounts'] },
  { id: 'settlement', label: 'Daily Settlement', description: 'Close and settle today\'s accounts', icon: Calculator, to: '/accounts/settlement', color: '#22C55E', roles: ['Admin', 'SuperAdmin', 'Accounts'] },
  { id: 'users', label: 'Manage Users', description: 'Add or edit system users', icon: UserCog, to: '/admin/users', color: '#60A5FA', roles: ['Admin', 'SuperAdmin'] },
];

const BADGE_STYLES: Record<string, { bg: string; color: string }> = {
  blue:   { bg: 'rgba(59,130,246,0.15)',  color: '#3B82F6' },
  green:  { bg: 'rgba(34,197,94,0.15)',  color: '#22C55E' },
  amber:  { bg: 'rgba(245,158,11,0.15)',  color: '#F59E0B' },
  red:    { bg: 'rgba(239,68,68,0.15)',  color: '#EF4444' },
  violet: { bg: 'rgba(139,92,246,0.15)', color: '#8B5CF6' },
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getDateString(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ═══════════════════════════════════════════════════════════════
export function HomeHub() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [fabOpen, setFabOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [liveStats, setLiveStats] = useState<{
    routesCount?: number; pendingOrders?: number; customersCount?: number; outstanding?: number;
  }>({});

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  // ── Real numbers for the dashboard badges ──
  useEffect(() => {
    if (!user || (user.role !== 'Admin' && user.role !== 'SuperAdmin')) return;
    (async () => {
      const [routes, customers, pendingOrders, outstanding] = await Promise.all([
        routesApi.getAll().catch(() => [] as any[]),
        customersApi.getAll().catch(() => [] as any[]),
        ordersApi.getPendingApprovalCount().catch(() => undefined as number | undefined),
        settlementApi.getOutstanding().catch(() => undefined as { totalOutstanding: number } | undefined),
      ]);
      setLiveStats({
        routesCount: routes.length,
        customersCount: customers.length,
        pendingOrders,
        outstanding: outstanding?.totalOutstanding,
      });
    })();
  }, [user]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setFabOpen(false); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Inject dark theme styles ──────────────────────────────────────────────
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'homehub-dark-theme';
    style.innerHTML = `
      .homehub-dark {
        background: #0f172a !important;
        color: #f1f5f9 !important;
        min-height: 100vh !important;
      }
      .homehub-dark .page-wrapper {
        background: #0f172a !important;
        padding-top: 0 !important;
      }
      .homehub-dark .mobile-content {
        background: #0f172a !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById('homehub-dark-theme');
      if (el) el.remove();
    };
  }, []);

  if (!user) return null;

  const role         = user.role;
  const firstName    = user.name?.split(' ')[0] ?? 'there';
  const isAdmin      = role === 'Admin' || role === 'SuperAdmin';

  const blocks       = NAV_BLOCKS.filter(b => b.roles.includes(role));
  const statCards    = STAT_CARDS.filter(s => s.roles.includes(role));
  const quickActions = QUICK_ACTIONS.filter(a => a.roles.includes(role));

  // Filter blocks: main blocks (Route Hub, Orders, Customers)
  const mainBlocks   = isAdmin ? blocks.filter(b => ['admin-routes','orders','customers'].includes(b.id)) : blocks;
  // Filter large blocks: Products, Users, Reports (Settings removed)
  const largeBlocks  = isAdmin ? blocks.filter(b => ['products','users','reports'].includes(b.id)) : [];
  // Everything else goes to more tools
  const moreTools    = isAdmin ? blocks.filter(b => !['admin-routes','orders','customers','products','users','reports'].includes(b.id)) : [];

  function liveBadge(blockId: string): string | undefined {
    if (blockId === 'admin-routes') return liveStats.routesCount !== undefined ? `${liveStats.routesCount} Routes` : undefined;
    if (blockId === 'orders')       return liveStats.pendingOrders !== undefined ? `${liveStats.pendingOrders} Pending` : undefined;
    if (blockId === 'customers')    return liveStats.customersCount !== undefined ? `${liveStats.customersCount} Active` : undefined;
    return undefined;
  }

  return (
    <div className="homehub-dark" style={{
      background: D.bg,
      color: D.text,
      minHeight: '100vh',
      padding: '20px 16px 120px',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>

        {/* ── Welcome Header ──────────────────────────────────── */}
        <div style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(12px)',
          transition: 'all 0.4s cubic-bezier(0.34,1.2,0.64,1)',
          marginBottom: 32,
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 20,
            background: D.surface,
            border: `1px solid ${D.border}`,
            marginBottom: 14,
          }}>
            <Clock size={12} style={{ color: D.accent }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: D.muted, letterSpacing: '0.01em' }}>
              {getDateString()}
            </span>
          </div>

          <h1 style={{
            fontSize: 28, fontWeight: 900, color: D.text,
            letterSpacing: '-0.04em', margin: 0, lineHeight: 1.1,
          }}>
            {getGreeting()}, {firstName} 🎉
          </h1>
          <p style={{ color: D.muted, fontSize: 14, marginTop: 8, marginBottom: 0, fontWeight: 500 }}>
            Here's your operations overview for today.
          </p>
        </div>

        {/* ── Status Strip ──────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap',
          opacity: mounted ? 1 : 0,
          transition: 'all 0.4s 0.08s cubic-bezier(0.34,1.2,0.64,1)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 10,
            background: D.surface, border: `1px solid ${D.border}`,
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: D.green,
              boxShadow: `0 0 0 3px rgba(34,197,94,0.25)`,
              animation: 'pulse-ring 2s ease infinite',
            }} />
            <span style={{ fontSize: 12, color: D.muted, fontWeight: 700 }}>System Status:</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: D.green }}>Operational</span>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 10,
            background: D.surface, border: `1px solid ${D.border}`,
          }}>
            <ArrowUpRight size={13} style={{ color: D.accent }} />
            <span style={{ fontSize: 12, color: D.muted, fontWeight: 700 }}>Active Role:</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: D.accent }}>{role}</span>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10,
            background: D.surface, border: `1px solid ${D.border}`,
          }}>
            <Sparkles size={13} style={{ color: D.amber }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: D.muted }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'short' })} — Let's get it done!
            </span>
          </div>
        </div>

        {/* ── Main Nav Grid (Route Hub, Orders, Customers) ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: mainBlocks.length >= 3 ? 'repeat(3,1fr)' : mainBlocks.length === 2 ? 'repeat(2,1fr)' : '1fr',
          gap: 16, marginBottom: 16,
          opacity: mounted ? 1 : 0,
          transition: 'all 0.42s 0.12s cubic-bezier(0.34,1.2,0.64,1)',
        }}>
          {mainBlocks.map((block, idx) => (
            <NavBlockCard key={block.id} block={block} delay={idx * 0.05} fullWidth={false} badgeOverride={liveBadge(block.id)} />
          ))}
        </div>

        {/* ── Admin Large Cards: Products, Users, Reports ── */}
        {isAdmin && largeBlocks.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: largeBlocks.length === 3 ? 'repeat(3,1fr)' : largeBlocks.length === 2 ? 'repeat(2,1fr)' : '1fr',
            gap: 16, marginBottom: 16,
            opacity: mounted ? 1 : 0,
            transition: 'all 0.42s 0.18s cubic-bezier(0.34,1.2,0.64,1)',
          }}>
            {largeBlocks.map((block, idx) => (
              <NavBlockCard key={block.id} block={block} delay={idx * 0.05} fullWidth={false} isLarge={true} />
            ))}
          </div>
        )}

        {/* ── Admin Stat Cards ───── */}
        {isAdmin && statCards.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${statCards.length}, 1fr)`,
            gap: 16, marginBottom: 16,
            opacity: mounted ? 1 : 0,
            transition: 'all 0.42s 0.22s cubic-bezier(0.34,1.2,0.64,1)',
          }}>
            {statCards.map(card => {
              const displayValue = card.id === 'collections' && liveStats.outstanding !== undefined
                ? `₹${fmt(liveStats.outstanding)} Due`
                : card.value;
              return (
              <Link key={card.id} to={card.to} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '18px 20px', borderRadius: 16,
                  background: D.surface,
                  border: `1px solid ${D.border}`,
                  cursor: 'pointer', transition: 'all 0.18s',
                }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                    (e.currentTarget as HTMLElement).style.borderColor = `${D.accent}55`;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                    (e.currentTarget as HTMLElement).style.borderColor = D.border;
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: `${card.color}22`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <card.icon size={20} style={{ color: card.color }} strokeWidth={1.8} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: `${card.color}99`, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      {card.label}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: card.color, marginTop: 2 }}>
                      {displayValue}
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: `${card.color}60`, flexShrink: 0 }} />
                </div>
              </Link>
              );
            })}
          </div>
        )}

        {/* ── More Tools (everything else) ────── */}
        {isAdmin && moreTools.length > 0 && (
          <div style={{
            marginTop: 8, padding: '18px 22px',
            background: D.surface, border: `1px solid ${D.border}`,
            borderRadius: 16,
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.4s 0.3s ease',
          }}>
            <h3 style={{
              fontSize: 11, fontWeight: 700, color: D.muted,
              margin: '0 0 14px', letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              More Tools
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: 8,
            }}>
              {moreTools.map(tool => {
                // Define color mapping for remaining tools
                const colorMap: Record<string, string> = {
                  'incentives': '#F472B6',
                  'assignments': '#34D399',
                  'session-log': '#A78BFA',
                  'settlement': '#F59E0B',
                  'accounts-settlement': '#F59E0B',
                  'accounts-reports': '#14B8A6',
                  'loading': D.accent,
                  'pack-orders': D.accent,
                };
                const color = colorMap[tool.id] || '#94A3B8';
                return (
                  <Link key={tool.to} to={tool.to} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '9px 12px', borderRadius: 10, textDecoration: 'none',
                    fontSize: 13, fontWeight: 600, color: D.muted,
                    background: D.bg, border: `1px solid ${D.border}`,
                    transition: 'all 0.14s',
                  }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.borderColor = `${color}55`;
                      el.style.background  = `${color}15`;
                      el.style.color       = color;
                      el.style.transform   = 'translateY(-1px)';
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.borderColor = D.border;
                      el.style.background  = D.bg;
                      el.style.color       = D.muted;
                      el.style.transform   = 'translateY(0)';
                    }}
                  >
                    <tool.icon size={14} style={{ color, flexShrink: 0 }} />
                    {tool.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Floating Action Button ─────────────────────────── */}
      <button
        onClick={() => setFabOpen(true)}
        style={{
          position: 'fixed', bottom: 'calc(28px + 70px)', right: 24,
          width: 58, height: 58, borderRadius: '50%',
          background: `linear-gradient(135deg, ${D.accent} 0%, ${D.accentH} 100%)`,
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 8px 32px ${D.accentGlow}`,
          zIndex: 150, transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.transform = 'scale(1.10)';
          el.style.boxShadow = `0 12px 40px ${D.accentGlow}`;
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.transform = 'scale(1)';
          el.style.boxShadow = `0 8px 32px ${D.accentGlow}`;
        }}
        title="Quick Actions"
      >
        <Plus size={24} color="#fff" strokeWidth={2.5} />
      </button>

      {/* ── Quick Action Modal ──────────────────────────────── */}
      {fabOpen && (
        <>
          <div onClick={() => setFabOpen(false)} style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.70)',
            backdropFilter: 'blur(4px)', zIndex: 160,
          }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 170,
            background: D.surface, borderRadius: '20px 20px 0 0',
            padding: '0 0 32px',
            boxShadow: `0 -8px 40px rgba(0,0,0,0.4)`,
            maxHeight: '80vh', overflowY: 'auto',
            borderTop: `1px solid ${D.border}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: D.border }} />
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 24px 20px', borderBottom: `1px solid ${D.border}`,
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: D.text, letterSpacing: '-0.03em' }}>
                  Quick Actions
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: D.muted }}>
                  High-frequency shortcuts for your role
                </p>
              </div>
              <button onClick={() => setFabOpen(false)} style={{
                width: 36, height: 36, borderRadius: '50%',
                border: `1px solid ${D.border}`, background: D.bg,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: D.muted,
              }}>
                <X size={16} />
              </button>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))',
              gap: 12, padding: '20px 24px',
            }}>
              {quickActions.map(action => (
                <Link key={action.id} to={action.to} onClick={() => setFabOpen(false)} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  gap: 12, padding: '16px 14px', borderRadius: 14,
                  border: `1px solid ${D.border}`, background: D.bg,
                  textDecoration: 'none', cursor: 'pointer',
                  transition: 'all 0.18s cubic-bezier(0.34,1.3,0.64,1)',
                }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = `${action.color}55`;
                    el.style.background  = `${action.color}15`;
                    el.style.transform   = 'translateY(-2px)';
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = D.border;
                    el.style.background  = D.bg;
                    el.style.transform   = 'translateY(0)';
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: `${action.color}22`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <action.icon size={20} style={{ color: action.color }} strokeWidth={1.8} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: D.text, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                      {action.label}
                    </div>
                    <div style={{ fontSize: 11, color: D.muted, marginTop: 3, lineHeight: 1.3 }}>
                      {action.description}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
function NavBlockCard({ block, delay, fullWidth, badgeOverride, isLarge }: { 
  block: NavBlock; 
  delay: number; 
  fullWidth: boolean; 
  badgeOverride?: string;
  isLarge?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const badgeStyle = block.badgeColor ? BADGE_STYLES[block.badgeColor] : BADGE_STYLES.blue;
  const badgeText = badgeOverride ?? block.badge;
  const large = isLarge || block.size === 'large';

  return (
    <Link to={block.to} style={{
      gridColumn: fullWidth ? '1 / -1' : undefined,
      display: 'flex', flexDirection: 'column',
      padding: large ? '28px 24px' : '24px',
      borderRadius: 18,
      border: `1px solid ${hovered ? `${D.accent}55` : D.border}`,
      background: hovered ? `${D.accent}10` : D.surface,
      textDecoration: 'none', cursor: 'pointer',
      transition: 'all 0.22s cubic-bezier(0.34,1.2,0.64,1)',
      transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
      minHeight: large ? 180 : 150,
      position: 'relative', overflow: 'hidden',
    }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ position: 'absolute', top: 0, right: 0, width: 140, height: 140, borderRadius: '50%', background: `radial-gradient(circle,${block.accentText}15 0%,transparent 70%)`, transform: 'translate(30%,-30%)', pointerEvents: 'none', opacity: hovered ? 1 : 0, transition: 'opacity 0.22s' }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'auto' }}>
        <div style={{
          width: large ? 60 : 52,
          height: large ? 60 : 52,
          borderRadius: 16,
          background: hovered ? `${block.accentText}22` : `${block.accentText}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.22s',
        }}>
          <block.icon size={large ? 28 : 24} style={{ color: block.accentText }} strokeWidth={hovered ? 2.2 : 1.8} />
        </div>

        {badgeText && (
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '4px 10px', borderRadius: 20,
            fontSize: 11, fontWeight: 700, letterSpacing: '0.02em',
            background: badgeStyle.bg, color: badgeStyle.color,
          }}>
            {badgeText}
          </span>
        )}
      </div>

      <div style={{ marginTop: large ? 24 : 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <h3 style={{
            fontSize: large ? 18 : 15,
            fontWeight: 800, color: D.text,
            margin: 0, letterSpacing: '-0.02em', lineHeight: 1.2,
          }}>
            {block.label}
          </h3>
          <ChevronRight size={large ? 16 : 14} style={{
            transition: 'transform 0.18s,color 0.15s',
            transform: hovered ? 'translateX(3px)' : 'translateX(0)',
            color: hovered ? block.accentText : D.muted,
          }} />
        </div>
        <p style={{ 
          fontSize: large ? 14 : 13, 
          color: D.muted, 
          margin: 0, 
          lineHeight: 1.5, 
          fontWeight: 500 
        }}>
          {block.description}
        </p>
        {large && block.id === 'users' && (
          <div style={{ marginTop: 12, display: 'flex', gap: 16 }}>
            <span style={{ fontSize: 12, color: D.green, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: D.green }} /> 12 Active
            </span>
            <span style={{ fontSize: 12, color: D.amber, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: D.amber }} /> 6 Pending
            </span>
          </div>
        )}
        {large && block.id === 'reports' && (
          <div style={{ marginTop: 12, display: 'flex', gap: 16 }}>
            <span style={{ fontSize: 12, color: D.accent, display: 'flex', alignItems: 'center', gap: 4 }}>
              <FileText size={12} /> 5 New Reports
            </span>
            <span style={{ fontSize: 12, color: D.green, display: 'flex', alignItems: 'center', gap: 4 }}>
              <ArrowUpRight size={12} /> +12% This Week
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}