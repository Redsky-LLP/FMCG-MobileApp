// PATH: src/pages/Dashboard/HomeHub.tsx
// UPDATED:
// 1. Products + Settings moved to large cards, removed from More Tools
// 2. System Status pill changed from green to indigo/blue
// 3. Analytics + Collections shown as small stat cards
// 4. Modern UI with stylish highlighted buttons
// 5. Admin priority: Route Hub, Orders, Customers, Collections, Analytics, Products, Settings

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Route, ShoppingCart, Users, IndianRupee, BarChart3,
  Plus, X, ClipboardList, Banknote, ScanBarcode,
  Package, Warehouse, FileText, Calculator,
  Zap, ChevronRight, TrendingUp, Clock, Shield,
  ArrowUpRight, Settings, Sparkles,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

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
    accent: '#EFF6FF', accentText: '#2563EB', roles: ['Admin', 'SuperAdmin'],
  },
  {
    id: 'orders', label: 'Orders Panel',
    description: 'Create, track, and manage customer orders',
    icon: ShoppingCart, to: '/admin/orders',
    badge: '12 Pending', badgeColor: 'blue',
    accent: '#EFF6FF', accentText: '#2563EB', roles: ['Admin', 'SuperAdmin'],
  },
  {
    id: 'customers', label: 'Customers',
    description: 'Browse and manage customer catalog',
    icon: Users, to: '/admin/customers',
    badge: '248 Active', badgeColor: 'blue',
    accent: '#FDF4FF', accentText: '#7E22CE', roles: ['Admin', 'SuperAdmin'],
  },
  // Products + Settings as large cards for Admin
  {
    id: 'products', label: 'Products',
    description: 'Manage product catalog and pricing',
    icon: Package, to: '/admin/products',
    accent: '#F0FDF4', accentText: '#15803D', roles: ['Admin', 'SuperAdmin'],
  },
  {
    id: 'settings', label: 'Settings',
    description: 'Product groups, units and configuration',
    icon: Settings, to: '/admin/settings',
    accent: '#F8FAFC', accentText: '#475569', roles: ['Admin', 'SuperAdmin'],
  },
  // ── Accounts ──
  {
    id: 'accounts-settlement', label: 'Settlement',
    description: 'Process daily collections and closures',
    icon: IndianRupee, to: '/accounts/settlement',
    badge: 'Today', badgeColor: 'blue',
    accent: '#FFF7ED', accentText: '#C2410C', roles: ['Accounts'],
  },
  {
    id: 'accounts-reports', label: 'Reports',
    description: 'Daily and monthly financial reports',
    icon: FileText, to: '/accounts/reports',
    accent: '#EFF6FF', accentText: '#1E3A8A', roles: ['Accounts'],
  },
  // ── Warehouse ──
  {
    id: 'loading', label: 'Loading Sheet',
    description: 'Manage warehouse packing and dispatch',
    icon: Warehouse, to: '/warehouse/loading',
    badge: 'Ready', badgeColor: 'green',
    accent: '#EFF6FF', accentText: '#2563EB', roles: ['Warehouse'],
  },
  {
    id: 'pack-orders', label: 'Pack Orders',
    description: 'Process and pack confirmed orders',
    icon: Package, to: '/warehouse/dispatch',
    accent: '#EFF6FF', accentText: '#2563EB', roles: ['Warehouse'],
  },
];

// ── Small stat cards for Admin ─────────────────────────────────
const STAT_CARDS: StatCard[] = [
  {
    id: 'collections', label: 'Collections & Settlement',
    value: '₹2.4L Due', icon: IndianRupee,
    to: '/admin/settlement',
    color: '#C2410C', bg: '#FFF7ED', roles: ['Admin', 'SuperAdmin'],
  },
  {
    id: 'analytics', label: 'Analytics',
    value: 'View Insights', icon: BarChart3,
    to: '/admin/analytics',
    color: '#1E3A8A', bg: '#EFF6FF', roles: ['Admin', 'SuperAdmin'],
  },
];

// ── Quick Actions ──────────────────────────────────────────────
const QUICK_ACTIONS: QuickAction[] = [
  { id: 'new-order', label: 'New Order', description: 'Create a fresh customer order', icon: ClipboardList, to: '/admin/orders', color: '#2563EB', roles: ['Admin', 'SuperAdmin', 'Salesman'] },
  { id: 'record-payment', label: 'Record Payment', description: 'Log a collection or payment', icon: Banknote, to: '/admin/settlement', color: '#16A34A', roles: ['Admin', 'SuperAdmin', 'Accounts'] },
  { id: 'scan-sku', label: 'Scan Product', description: 'Scan barcode or search SKU', icon: ScanBarcode, to: '/admin/products', color: '#7E22CE', roles: ['Admin', 'SuperAdmin', 'Warehouse'] },
  { id: 'add-customer', label: 'Add Customer', description: 'Register a new customer', icon: Users, to: '/admin/customers', color: '#D97706', roles: ['Admin', 'SuperAdmin', 'Salesman'] },
  { id: 'view-routes', label: 'View Routes', description: 'Check today\'s route map', icon: Route, to: '/salesman/routes', color: '#C2410C', roles: ['Salesman'] },
  { id: 'start-route', label: 'Start Route', description: 'Begin executing a delivery route', icon: Zap, to: '/salesman/routes', color: '#0891B2', roles: ['Salesman'] },
  { id: 'reports', label: 'View Reports', description: 'Open financial and sales reports', icon: FileText, to: '/admin/reports', color: '#475569', roles: ['Admin', 'SuperAdmin', 'Accounts'] },
  { id: 'settlement', label: 'Daily Settlement', description: 'Close and settle today\'s accounts', icon: Calculator, to: '/accounts/settlement', color: '#15803D', roles: ['Admin', 'SuperAdmin', 'Accounts'] },
];

const BADGE_STYLES: Record<string, { bg: string; color: string }> = {
  blue:   { bg: 'rgba(37,99,235,0.10)',  color: '#1D4ED8' },
  green:  { bg: 'rgba(22,163,74,0.10)',  color: '#15803D' },
  amber:  { bg: 'rgba(217,119,6,0.10)',  color: '#B45309' },
  red:    { bg: 'rgba(220,38,38,0.10)',  color: '#B91C1C' },
  violet: { bg: 'rgba(124,58,237,0.10)', color: '#6D28D9' },
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
  const { user }          = useAuthStore();
  const navigate          = useNavigate();
  const [fabOpen, setFabOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setFabOpen(false); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!user) return null;

  const role         = user.role;
  const firstName    = user.name?.split(' ')[0] ?? 'there';
  const isAdmin      = role === 'Admin' || role === 'SuperAdmin';

  // Filter large nav blocks — for admin: Route Hub, Orders, Customers, Products, Settings
  const blocks       = NAV_BLOCKS.filter(b => b.roles.includes(role));
  const statCards    = STAT_CARDS.filter(s => s.roles.includes(role));
  const quickActions = QUICK_ACTIONS.filter(a => a.roles.includes(role));

  // Admin main grid: first 3 (Route Hub, Orders, Customers) in top row
  // Then Products + Settings in bottom row
  const mainBlocks   = isAdmin ? blocks.filter(b => ['admin-routes','orders','customers'].includes(b.id)) : blocks;
  const extraBlocks  = isAdmin ? blocks.filter(b => ['products','settings'].includes(b.id)) : [];

  return (
    <div className="page-wrapper" style={{ background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '32px 20px 120px' }}>

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
            background: 'var(--ice)',
            border: '1px solid rgba(37,99,235,0.15)',
            marginBottom: 14,
          }}>
            <Clock size={12} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', letterSpacing: '0.01em' }}>
              {getDateString()}
            </span>
          </div>

          <h1 style={{
            fontSize: 28, fontWeight: 800, color: 'var(--navy)',
            letterSpacing: '-0.04em', margin: 0, lineHeight: 1.1,
          }}>
            {getGreeting()}, {firstName} 👋
          </h1>
          <p style={{ color: 'var(--text-sub)', fontSize: 14, marginTop: 8, marginBottom: 0, fontWeight: 500 }}>
            Here's your operations overview for today.
          </p>
        </div>

        {/* ── Status Strip ──────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap',
          opacity: mounted ? 1 : 0,
          transition: 'all 0.4s 0.08s cubic-bezier(0.34,1.2,0.64,1)',
        }}>
          {/* System Status — indigo instead of green */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 10,
            background: '#EEF2FF', border: '1px solid rgba(99,102,241,0.25)',
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#6366F1',
              boxShadow: '0 0 0 3px rgba(99,102,241,0.25)',
              animation: 'pulse-ring 2s ease infinite',
            }} />
            <span style={{ fontSize: 12, color: '#4338CA', fontWeight: 700 }}>System Status:</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#4338CA' }}>Operational</span>
          </div>

          {/* Active Role */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 10,
            background: '#EFF6FF', border: '1px solid rgba(37,99,235,0.20)',
          }}>
            <ArrowUpRight size={13} style={{ color: '#2563EB' }} />
            <span style={{ fontSize: 12, color: '#2563EB', fontWeight: 700 }}>Active Role:</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#2563EB' }}>{role}</span>
          </div>

          {/* Sparkle badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10,
            background: 'linear-gradient(135deg,#FFF7ED,#FEF3C7)',
            border: '1px solid rgba(217,119,6,0.20)',
          }}>
            <Sparkles size={13} style={{ color: '#D97706' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#92400E' }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'short' })} — Let's get it done!
            </span>
          </div>
        </div>

        {/* ── Main Nav Grid (Route Hub + Orders + Customers) ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: mainBlocks.length >= 3 ? 'repeat(3,1fr)' : mainBlocks.length === 2 ? 'repeat(2,1fr)' : '1fr',
          gap: 16, marginBottom: 16,
          opacity: mounted ? 1 : 0,
          transition: 'all 0.42s 0.12s cubic-bezier(0.34,1.2,0.64,1)',
        }}>
          {mainBlocks.map((block, idx) => (
            <NavBlockCard key={block.id} block={block} delay={idx * 0.05} fullWidth={false} />
          ))}
        </div>

        {/* ── Admin Stat Cards (Collections + Analytics) ───── */}
        {isAdmin && statCards.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${statCards.length}, 1fr)`,
            gap: 16, marginBottom: 16,
            opacity: mounted ? 1 : 0,
            transition: 'all 0.42s 0.18s cubic-bezier(0.34,1.2,0.64,1)',
          }}>
            {statCards.map(card => (
              <Link key={card.id} to={card.to} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '18px 20px', borderRadius: 16,
                  background: card.bg,
                  border: `1px solid ${card.color}22`,
                  cursor: 'pointer', transition: 'all 0.18s',
                }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${card.color}20`;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: `${card.color}15`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <card.icon size={20} style={{ color: card.color }} strokeWidth={1.8} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: `${card.color}99`, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      {card.label}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: card.color, marginTop: 2 }}>
                      {card.value}
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: `${card.color}60`, flexShrink: 0 }} />
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* ── Products + Settings as large cards ─────────── */}
        {extraBlocks.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2,1fr)',
            gap: 16, marginBottom: 16,
            opacity: mounted ? 1 : 0,
            transition: 'all 0.42s 0.22s cubic-bezier(0.34,1.2,0.64,1)',
          }}>
            {extraBlocks.map((block, idx) => (
              <NavBlockCard key={block.id} block={block} delay={idx * 0.05} fullWidth={false} />
            ))}
          </div>
        )}

        {/* ── Secondary Tools (Reports, Users, etc.) ────── */}
        {isAdmin && (
          <div style={{
            marginTop: 8, padding: '18px 22px',
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 16, boxShadow: 'var(--shadow-sm)',
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.4s 0.3s ease',
          }}>
            <h3 style={{
              fontSize: 11, fontWeight: 700, color: 'var(--text-sub)',
              margin: '0 0 14px', letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              More Tools
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: 8,
            }}>
              {[
                { label: 'Reports',     to: '/admin/reports',     color: '#64748B', icon: FileText },
                { label: 'Users',       to: '/admin/users',       color: '#0891B2', icon: Users },
                { label: 'Incentives',  to: '/admin/incentives',  color: '#D97706', icon: TrendingUp },
                { label: 'Assignments', to: '/admin/assignments', color: '#16A34A', icon: Route },
              ].map(l => (
                <Link key={l.to} to={l.to} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 12px', borderRadius: 10, textDecoration: 'none',
                  fontSize: 13, fontWeight: 600, color: 'var(--text-body)',
                  background: 'var(--card-sub)', border: '1px solid var(--border)',
                  transition: 'all 0.14s',
                }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = `${l.color}33`;
                    el.style.background  = `${l.color}0d`;
                    el.style.color       = l.color;
                    el.style.transform   = 'translateY(-1px)';
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = 'var(--border)';
                    el.style.background  = 'var(--card-sub)';
                    el.style.color       = 'var(--text-body)';
                    el.style.transform   = 'translateY(0)';
                  }}
                >
                  <l.icon size={14} style={{ color: l.color, flexShrink: 0 }} />
                  {l.label}
                </Link>
              ))}
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
          background: 'linear-gradient(135deg,#1E3A8A 0%,#2563EB 100%)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(37,99,235,0.40),0 2px 8px rgba(15,23,42,0.15)',
          zIndex: 150, transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.transform = 'scale(1.10)';
          el.style.boxShadow = '0 12px 40px rgba(37,99,235,0.50),0 4px 12px rgba(15,23,42,0.18)';
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.transform = 'scale(1)';
          el.style.boxShadow = '0 8px 32px rgba(37,99,235,0.40),0 2px 8px rgba(15,23,42,0.15)';
        }}
        title="Quick Actions"
      >
        <Plus size={24} color="#fff" strokeWidth={2.5} />
      </button>

      {/* ── Quick Action Modal ──────────────────────────────── */}
      {fabOpen && (
        <>
          <div onClick={() => setFabOpen(false)} style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
            backdropFilter: 'blur(4px)', zIndex: 160,
          }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 170,
            background: '#FFFFFF', borderRadius: '20px 20px 0 0',
            padding: '0 0 32px',
            boxShadow: '0 -8px 40px rgba(15,23,42,0.18)',
            maxHeight: '80vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 24px 20px', borderBottom: '1px solid var(--border)',
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--navy)', letterSpacing: '-0.03em' }}>
                  Quick Actions
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-sub)' }}>
                  High-frequency shortcuts for your role
                </p>
              </div>
              <button onClick={() => setFabOpen(false)} style={{
                width: 36, height: 36, borderRadius: '50%',
                border: '1px solid var(--border)', background: 'var(--card-sub)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-sub)',
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
                  border: '1px solid var(--border)', background: '#fff',
                  textDecoration: 'none', cursor: 'pointer',
                  transition: 'all 0.18s cubic-bezier(0.34,1.3,0.64,1)',
                  boxShadow: 'var(--shadow-sm)',
                }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = `${action.color}30`;
                    el.style.background  = `${action.color}08`;
                    el.style.transform   = 'translateY(-2px)';
                    el.style.boxShadow   = `0 8px 24px ${action.color}20`;
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = 'var(--border)';
                    el.style.background  = '#fff';
                    el.style.transform   = 'translateY(0)';
                    el.style.boxShadow   = 'var(--shadow-sm)';
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: `${action.color}15`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <action.icon size={20} style={{ color: action.color }} strokeWidth={1.8} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                      {action.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 3, lineHeight: 1.3 }}>
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
function NavBlockCard({ block, delay, fullWidth }: { block: NavBlock; delay: number; fullWidth: boolean }) {
  const [hovered, setHovered] = useState(false);
  const badgeStyle = block.badgeColor ? BADGE_STYLES[block.badgeColor] : BADGE_STYLES.blue;

  return (
    <Link to={block.to} style={{
      gridColumn: fullWidth ? '1 / -1' : undefined,
      display: 'flex', flexDirection: 'column',
      padding: '24px', borderRadius: 18,
      border: `1px solid ${hovered ? 'rgba(37,99,235,0.25)' : 'var(--border)'}`,
      background: hovered ? 'var(--ice)' : 'var(--card)',
      textDecoration: 'none', cursor: 'pointer',
      transition: 'all 0.22s cubic-bezier(0.34,1.2,0.64,1)',
      boxShadow: hovered
        ? '0 12px 40px rgba(37,99,235,0.12),0 4px 12px rgba(15,23,42,0.06)'
        : 'var(--shadow-sm)',
      transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
      animationDelay: `${delay}s`,
      minHeight: 150, position: 'relative', overflow: 'hidden',
    }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Accent glow */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 120, height: 120,
        borderRadius: '50%',
        background: `radial-gradient(circle,${block.accentText}08 0%,transparent 70%)`,
        transform: 'translate(30%,-30%)',
        pointerEvents: 'none',
        opacity: hovered ? 1 : 0, transition: 'opacity 0.22s',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'auto' }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: hovered ? `${block.accentText}15` : block.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.22s',
          boxShadow: hovered ? `0 4px 16px ${block.accentText}25` : 'none',
        }}>
          <block.icon size={24} style={{ color: block.accentText }} strokeWidth={hovered ? 2.2 : 1.8} />
        </div>

        {block.badge && (
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '4px 10px', borderRadius: 20,
            fontSize: 11, fontWeight: 700, letterSpacing: '0.02em',
            background: badgeStyle.bg, color: badgeStyle.color,
          }}>
            {block.badge}
          </span>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <h3 style={{
            fontSize: 15, fontWeight: 800, color: 'var(--navy)',
            margin: 0, letterSpacing: '-0.02em', lineHeight: 1.2,
          }}>
            {block.label}
          </h3>
          <ChevronRight size={14} style={{
            transition: 'transform 0.18s,color 0.15s',
            transform: hovered ? 'translateX(3px)' : 'translateX(0)',
            color: hovered ? block.accentText : 'var(--text-muted)',
          }} />
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-sub)', margin: 0, lineHeight: 1.4, fontWeight: 500 }}>
          {block.description}
        </p>
      </div>
    </Link>
  );
}