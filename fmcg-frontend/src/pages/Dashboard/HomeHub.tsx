// PATH: src/pages/Dashboard/HomeHub.tsx
// Role-aware home hub — white & blue design system
// 4-5 main nav blocks + Floating Action Button with Quick-Action modal

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Route, ShoppingCart, Users, IndianRupee, BarChart3,
  Plus, X, ClipboardList, Banknote, ScanBarcode,
  Package, Warehouse, FileText, Calculator,
  Zap, ChevronRight, TrendingUp, Clock, CheckCircle2,
  ArrowUpRight,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

// ── Types ──────────────────────────────────────────────────────
interface NavBlock {
  id:          string;
  label:       string;
  description: string;
  icon:        React.ElementType;
  to:          string;
  badge?:      string;
  badgeColor?: 'blue' | 'green' | 'amber' | 'red';
  accent:      string;       // CSS color for icon background
  accentText:  string;       // Icon foreground color
  roles:       string[];
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

// ── Nav block definitions (role-filtered) ───────────────────────
const NAV_BLOCKS: NavBlock[] = [
  {
    id:          'routes',
    label:       'Deliveries & Routes',
    description: 'View and manage today\'s delivery routes',
    icon:        Route,
    to:          '/salesman/routes',
    badge:       '3 Active',
    badgeColor:  'blue',
    accent:      '#EFF6FF',
    accentText:  '#2563EB',
    roles:       ['Salesman'],
  },
  {
    id:          'admin-routes',
    label:       'Route Hub',
    description: 'Assign routes and track live deliveries',
    icon:        Route,
    to:          '/admin/routes',
    badge:       'Live',
    badgeColor:  'green',
    accent:      '#EFF6FF',
    accentText:  '#2563EB',
    roles:       ['Admin', 'SuperAdmin'],
  },
  {
    id:          'orders',
    label:       'Orders Panel',
    description: 'Create, track, and manage customer orders',
    icon:        ShoppingCart,
    to:          '/admin/orders',
    badge:       '12 Pending',
    badgeColor:  'blue',
    accent:      '#EFF6FF',
    accentText:  '#2563EB',
    roles:       ['Admin', 'SuperAdmin'],
  },
  {
    id:          'salesman-orders',
    label:       'My Orders',
    description: 'View and submit field orders',
    icon:        ShoppingCart,
    to:          '/salesman/routes',
    badge:       '5 Open',
    badgeColor:  'blue',
    accent:      '#EFF6FF',
    accentText:  '#2563EB',
    roles:       ['Salesman'],
  },
  {
    id:          'customers',
    label:       'Customers',
    description: 'Browse and manage customer catalog',
    icon:        Users,
    to:          '/admin/customers',
    badge:       '248 Active',
    badgeColor:  'blue',
    accent:      '#FDF4FF',
    accentText:  '#7E22CE',
    roles:       ['Admin', 'SuperAdmin'],
  },
  {
    id:          'collections',
    label:       'Collections & Settlement',
    description: 'Manage payments and outstanding balances',
    icon:        IndianRupee,
    to:          '/admin/settlement',
    badge:       '₹2.4L Due',
    badgeColor:  'red',
    accent:      '#FFF7ED',
    accentText:  '#C2410C',
    roles:       ['Admin', 'SuperAdmin'],
  },
  {
    id:          'accounts-settlement',
    label:       'Settlement',
    description: 'Process daily collections and closures',
    icon:        IndianRupee,
    to:          '/accounts/settlement',
    badge:       'Today',
    badgeColor:  'blue',
    accent:      '#FFF7ED',
    accentText:  '#C2410C',
    roles:       ['Accounts'],
  },
  {
    id:          'analytics',
    label:       'Analytics',
    description: 'Performance metrics and business insights',
    icon:        BarChart3,
    to:          '/admin/analytics',
    accent:      '#EFF6FF',
    accentText:  '#1E3A8A',
    roles:       ['Admin', 'SuperAdmin'],
  },
  {
    id:          'incentives',
    label:       'My Incentives',
    description: 'Track earnings and performance targets',
    icon:        TrendingUp,
    to:          '/salesman/incentives',
    accent:      '#EFF6FF',
    accentText:  '#2563EB',
    roles:       ['Salesman'],
  },
  {
    id:          'loading',
    label:       'Loading Sheet',
    description: 'Manage warehouse packing and dispatch',
    icon:        Warehouse,
    to:          '/warehouse/loading',
    badge:       'Ready',
    badgeColor:  'green',
    accent:      '#EFF6FF',
    accentText:  '#2563EB',
    roles:       ['Warehouse'],
  },
  {
    id:          'pack-orders',
    label:       'Pack Orders',
    description: 'Process and pack confirmed orders',
    icon:        Package,
    to:          '/warehouse/dispatch',
    accent:      '#EFF6FF',
    accentText:  '#2563EB',
    roles:       ['Warehouse'],
  },
  {
    id:          'accounts-reports',
    label:       'Reports',
    description: 'Daily and monthly financial reports',
    icon:        FileText,
    to:          '/accounts/reports',
    accent:      '#EFF6FF',
    accentText:  '#1E3A8A',
    roles:       ['Accounts'],
  },
];

// ── Quick action definitions (role-filtered) ────────────────────
const QUICK_ACTIONS: QuickAction[] = [
  {
    id:    'new-order',
    label: 'New Order',
    description: 'Create a fresh customer order',
    icon:  ClipboardList,
    to:    '/admin/orders',
    color: '#2563EB',
    roles: ['Admin', 'SuperAdmin', 'Salesman'],
  },
  {
    id:    'record-payment',
    label: 'Record Payment',
    description: 'Log a collection or payment',
    icon:  Banknote,
    to:    '/admin/settlement',
    color: '#16A34A',
    roles: ['Admin', 'SuperAdmin', 'Accounts'],
  },
  {
    id:    'scan-sku',
    label: 'Scan Product',
    description: 'Scan barcode or search SKU',
    icon:  ScanBarcode,
    to:    '/admin/products',
    color: '#7E22CE',
    roles: ['Admin', 'SuperAdmin', 'Warehouse'],
  },
  {
    id:    'add-customer',
    label: 'Add Customer',
    description: 'Register a new customer',
    icon:  Users,
    to:    '/admin/customers',
    color: '#D97706',
    roles: ['Admin', 'SuperAdmin', 'Salesman'],
  },
  {
    id:    'view-routes',
    label: 'View Routes',
    description: 'Check today\'s route map',
    icon:  Route,
    to:    '/salesman/routes',
    color: '#C2410C',
    roles: ['Salesman'],
  },
  {
    id:    'start-route',
    label: 'Start Route',
    description: 'Begin executing a delivery route',
    icon:  Zap,
    to:    '/salesman/routes',
    color: '#0891B2',
    roles: ['Salesman'],
  },
  {
    id:    'reports',
    label: 'View Reports',
    description: 'Open financial and sales reports',
    icon:  FileText,
    to:    '/admin/reports',
    color: '#475569',
    roles: ['Admin', 'SuperAdmin', 'Accounts'],
  },
  {
    id:    'settlement',
    label: 'Daily Settlement',
    description: 'Close and settle today\'s accounts',
    icon:  Calculator,
    to:    '/accounts/settlement',
    color: '#15803D',
    roles: ['Admin', 'SuperAdmin', 'Accounts'],
  },
];

// ── Badge color map ────────────────────────────────────────────
const BADGE_STYLES: Record<string, { bg: string; color: string }> = {
  blue:  { bg: 'rgba(37,99,235,0.10)',  color: '#1D4ED8' },
  green: { bg: 'rgba(22,163,74,0.10)',  color: '#15803D' },
  amber: { bg: 'rgba(217,119,6,0.10)',  color: '#B45309' },
  red:   { bg: 'rgba(220,38,38,0.10)',  color: '#B91C1C' },
};

// ── Greeting ───────────────────────────────────────────────────
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
// HomeHub Component
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

  // Close modal on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setFabOpen(false); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!user) return null;

  const role         = user.role;
  const blocks       = NAV_BLOCKS.filter(b => b.roles.includes(role)).slice(0, 5);
  const quickActions = QUICK_ACTIONS.filter(a => a.roles.includes(role));
  const firstName    = user.name?.split(' ')[0] ?? 'there';

  // Grid layout varies by block count
  const gridCols = blocks.length <= 2
    ? 'repeat(2, 1fr)'
    : blocks.length === 3
      ? 'repeat(3, 1fr)'
      : blocks.length === 4
        ? 'repeat(2, 1fr)'
        : 'repeat(3, 1fr)';   // 5: 3+2 — handled with CSS special case

  return (
    <div className="page-wrapper" style={{ background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '32px 20px 120px' }}>

        {/* ── Welcome Header ─────────────────────────────────── */}
        <div
          style={{
            opacity:    mounted ? 1 : 0,
            transform:  mounted ? 'translateY(0)' : 'translateY(12px)',
            transition: 'all 0.4s cubic-bezier(0.34, 1.2, 0.64, 1)',
            marginBottom: 36,
          }}
        >
          {/* Date chip */}
          <div style={{
            display:      'inline-flex',
            alignItems:   'center',
            gap:          6,
            padding:      '5px 12px',
            borderRadius: 20,
            background:   'var(--ice)',
            border:       '1px solid rgba(37,99,235,0.15)',
            marginBottom: 14,
          }}>
            <Clock size={12} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', letterSpacing: '0.01em' }}>
              {getDateString()}
            </span>
          </div>

          <h1 style={{
            fontSize:      28,
            fontWeight:    800,
            color:         'var(--navy)',
            letterSpacing: '-0.04em',
            margin:        0,
            lineHeight:    1.1,
          }}>
            {getGreeting()}, {firstName} 👋
          </h1>
          <p style={{
            color:      'var(--text-sub)',
            fontSize:   14,
            marginTop:  8,
            marginBottom: 0,
            fontWeight:  500,
          }}>
            Here's your operations overview for today.
          </p>
        </div>

        {/* ── Status strip (role-contextual) ─────────────────── */}
        <div
          style={{
            display:      'flex',
            gap:          12,
            marginBottom: 32,
            flexWrap:     'wrap',
            opacity:      mounted ? 1 : 0,
            transform:    mounted ? 'translateY(0)' : 'translateY(8px)',
            transition:   'all 0.4s 0.08s cubic-bezier(0.34, 1.2, 0.64, 1)',
          }}
        >
          {[
            { label: 'System Status', value: 'Operational', icon: CheckCircle2, color: '#16A34A', bg: '#F0FDF4', border: 'rgba(22,163,74,0.20)' },
            { label: 'Active Role',   value: role,           icon: ArrowUpRight, color: '#2563EB', bg: '#EFF6FF', border: 'rgba(37,99,235,0.20)' },
          ].map(s => (
            <div key={s.label} style={{
              display:      'flex',
              alignItems:   'center',
              gap:          8,
              padding:      '8px 16px',
              borderRadius: 10,
              background:   s.bg,
              border:       `1px solid ${s.border}`,
            }}>
              <s.icon size={14} style={{ color: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: s.color, fontWeight: 700 }}>{s.label}:</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* ── Main Navigation Grid ────────────────────────────── */}
        <div
          style={{
            display:               'grid',
            gridTemplateColumns:   gridCols,
            gap:                   16,
            opacity:               mounted ? 1 : 0,
            transform:             mounted ? 'translateY(0)' : 'translateY(12px)',
            transition:            'all 0.42s 0.12s cubic-bezier(0.34, 1.2, 0.64, 1)',
          }}
        >
          {blocks.map((block, idx) => (
            <NavBlockCard
              key={block.id}
              block={block}
              delay={idx * 0.05}
              // Make 5th card span full-width on 3-col grid
              fullWidth={blocks.length === 5 && idx === 4}
            />
          ))}
        </div>

        {/* ── Secondary quick links (for admin) ──────────────── */}
        {(role === 'Admin' || role === 'SuperAdmin') && (
          <div
            style={{
              marginTop:  24,
              padding:    '20px 24px',
              background: 'var(--card)',
              border:     '1px solid var(--border)',
              borderRadius: 16,
              boxShadow:  'var(--shadow-sm)',
              opacity:    mounted ? 1 : 0,
              transition: 'opacity 0.4s 0.3s ease',
            }}
          >
            <div style={{
              display:       'flex',
              alignItems:    'center',
              justifyContent: 'space-between',
              marginBottom:  16,
            }}>
              <h3 style={{
                fontSize:      13,
                fontWeight:    700,
                color:         'var(--text-sub)',
                margin:        0,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>
                More Tools
              </h3>
            </div>
            <div style={{
              display:             'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap:                 8,
            }}>
              {[
                { label: 'Reports',     to: '/admin/reports',     color: '#64748B', icon: FileText },
                { label: 'Products',    to: '/admin/products',    color: '#7E22CE', icon: Package },
                { label: 'Users',       to: '/admin/users',       color: '#0891B2', icon: Users },
                { label: 'Incentives',  to: '/admin/incentives',  color: '#D97706', icon: TrendingUp },
                { label: 'Assignments', to: '/admin/assignments',  color: '#16A34A', icon: Route },
                { label: 'Settings',    to: '/admin/settings',    color: '#94A3B8', icon: Calculator },
              ].map(l => (
                <Link
                  key={l.to}
                  to={l.to}
                  style={{
                    display:        'flex',
                    alignItems:     'center',
                    gap:            8,
                    padding:        '9px 12px',
                    borderRadius:   10,
                    textDecoration: 'none',
                    fontSize:       13,
                    fontWeight:     600,
                    color:          'var(--text-body)',
                    background:     'var(--card-sub)',
                    border:         '1px solid var(--border)',
                    transition:     'all 0.14s',
                    letterSpacing:  '-0.01em',
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

      {/* ── Floating Action Button ──────────────────────────────── */}
      <button
        onClick={() => setFabOpen(true)}
        style={{
          position:       'fixed',
          bottom:          'calc(28px + 70px)',
          right:           24,
          width:           58,
          height:          58,
          borderRadius:    '50%',
          background:      'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)',
          border:          'none',
          cursor:          'pointer',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          boxShadow:       '0 8px 32px rgba(37,99,235,0.40), 0 2px 8px rgba(15,23,42,0.15)',
          zIndex:          150,
          transition:      'all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
          animation:       'pulse-ring 3s ease-in-out infinite',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.transform  = 'scale(1.10)';
          el.style.boxShadow  = '0 12px 40px rgba(37,99,235,0.50), 0 4px 12px rgba(15,23,42,0.18)';
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.transform  = 'scale(1)';
          el.style.boxShadow  = '0 8px 32px rgba(37,99,235,0.40), 0 2px 8px rgba(15,23,42,0.15)';
        }}
        title="Quick Actions"
      >
        <Plus size={24} color="#fff" strokeWidth={2.5} />
      </button>

      {/* ── Quick Action Modal ──────────────────────────────────── */}
      {fabOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setFabOpen(false)}
            style={{
              position:   'fixed',
              inset:      0,
              background: 'rgba(15,23,42,0.45)',
              backdropFilter: 'blur(4px)',
              zIndex:     160,
              animation:  'fade-in 0.15s ease',
            }}
          />

          {/* Modal sheet */}
          <div
            style={{
              position:      'fixed',
              bottom:         0,
              left:           0,
              right:          0,
              zIndex:         170,
              paddingBottom:  'env(safe-area-inset-bottom, 0px)',
              background:     '#FFFFFF',
              borderRadius:   '20px 20px 0 0',
              padding:        '0 0 32px',
              boxShadow:      '0 -8px 40px rgba(15,23,42,0.18)',
              animation:      'slide-up 0.28s cubic-bezier(0.34, 1.2, 0.64, 1)',
              maxHeight:      '80vh',
              overflowY:      'auto',
            }}
          >
            {/* Handle bar */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
            </div>

            {/* Header */}
            <div style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              padding:        '16px 24px 20px',
              borderBottom:   '1px solid var(--border)',
            }}>
              <div>
                <h2 style={{
                  margin:        0,
                  fontSize:      18,
                  fontWeight:    800,
                  color:         'var(--navy)',
                  letterSpacing: '-0.03em',
                }}>
                  Quick Actions
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-sub)' }}>
                  High-frequency shortcuts for your role
                </p>
              </div>
              <button
                onClick={() => setFabOpen(false)}
                style={{
                  width:          36, height: 36,
                  borderRadius:   '50%',
                  border:         '1px solid var(--border)',
                  background:     'var(--card-sub)',
                  cursor:         'pointer',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  color:          'var(--text-sub)',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Action grid */}
            <div style={{
              display:             'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap:                 12,
              padding:             '20px 24px',
            }}>
              {quickActions.map(action => (
                <Link
                  key={action.id}
                  to={action.to}
                  onClick={() => setFabOpen(false)}
                  style={{
                    display:        'flex',
                    flexDirection:  'column',
                    alignItems:     'flex-start',
                    gap:            12,
                    padding:        '16px 14px',
                    borderRadius:   14,
                    border:         '1px solid var(--border)',
                    background:     '#fff',
                    textDecoration: 'none',
                    cursor:         'pointer',
                    transition:     'all 0.18s cubic-bezier(0.34, 1.3, 0.64, 1)',
                    boxShadow:      'var(--shadow-sm)',
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
                    width:          40, height: 40,
                    borderRadius:   10,
                    background:     `${action.color}15`,
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                  }}>
                    <action.icon size={20} style={{ color: action.color }} strokeWidth={1.8} />
                  </div>
                  <div>
                    <div style={{
                      fontSize:      13,
                      fontWeight:    700,
                      color:         'var(--navy)',
                      letterSpacing: '-0.02em',
                      lineHeight:    1.2,
                    }}>
                      {action.label}
                    </div>
                    <div style={{
                      fontSize:   11,
                      color:      'var(--text-sub)',
                      marginTop:  3,
                      lineHeight: 1.3,
                    }}>
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
// NavBlockCard — individual large navigation card
// ═══════════════════════════════════════════════════════════════
interface NavBlockCardProps {
  block:     NavBlock;
  delay:     number;
  fullWidth: boolean;
}

function NavBlockCard({ block, delay, fullWidth }: NavBlockCardProps) {
  const [hovered, setHovered] = useState(false);
  const badgeStyle = block.badgeColor ? BADGE_STYLES[block.badgeColor] : BADGE_STYLES.blue;

  return (
    <Link
      to={block.to}
      style={{
        gridColumn:     fullWidth ? '1 / -1' : undefined,
        display:        'flex',
        flexDirection:  'column',
        padding:        '24px',
        borderRadius:   18,
        border:         `1px solid ${hovered ? 'rgba(37,99,235,0.25)' : 'var(--border)'}`,
        background:     hovered ? 'var(--ice)' : 'var(--card)',
        textDecoration: 'none',
        cursor:         'pointer',
        transition:     'all 0.22s cubic-bezier(0.34, 1.2, 0.64, 1)',
        boxShadow:      hovered
          ? '0 12px 40px rgba(37,99,235,0.12), 0 4px 12px rgba(15,23,42,0.06)'
          : 'var(--shadow-sm)',
        transform:      hovered ? 'translateY(-3px)' : 'translateY(0)',
        animationDelay: `${delay}s`,
        minHeight:      160,
        position:       'relative',
        overflow:       'hidden',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Subtle accent gradient on hover */}
      <div style={{
        position:   'absolute',
        top:         0,
        right:       0,
        width:       120,
        height:      120,
        borderRadius: '50%',
        background:  `radial-gradient(circle, ${block.accentText}08 0%, transparent 70%)`,
        transform:   'translate(30%, -30%)',
        pointerEvents: 'none',
        opacity:     hovered ? 1 : 0,
        transition:  'opacity 0.22s',
      }} />

      {/* Top row: icon + badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'auto' }}>
        <div style={{
          width:          52, height: 52,
          borderRadius:   14,
          background:     hovered ? `${block.accentText}15` : block.accent,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          transition:     'all 0.22s',
          boxShadow:      hovered ? `0 4px 16px ${block.accentText}25` : 'none',
        }}>
          <block.icon
            size={24}
            style={{ color: block.accentText }}
            strokeWidth={hovered ? 2.2 : 1.8}
          />
        </div>

        {block.badge && (
          <span style={{
            display:      'inline-flex',
            alignItems:   'center',
            padding:      '4px 10px',
            borderRadius:  20,
            fontSize:      11,
            fontWeight:    700,
            letterSpacing: '0.02em',
            background:    badgeStyle.bg,
            color:         badgeStyle.color,
          }}>
            {block.badge}
          </span>
        )}
      </div>

      {/* Label + description */}
      <div style={{ marginTop: 20 }}>
        <div style={{
          display:     'flex',
          alignItems:  'center',
          gap:         6,
          marginBottom: 6,
        }}>
          <h3 style={{
            fontSize:      15,
            fontWeight:    800,
            color:         'var(--navy)',
            margin:        0,
            letterSpacing: '-0.02em',
            lineHeight:    1.2,
            transition:    'color 0.15s',
          }}>
            {block.label}
          </h3>
          <ChevronRight
            size={14}
            style={{
              transition: 'transform 0.18s, color 0.15s',
              transform:   hovered ? 'translateX(3px)' : 'translateX(0)',
              color:       hovered ? block.accentText : 'var(--text-muted)',
            }}
          />
        </div>
        <p style={{
          fontSize:   13,
          color:      'var(--text-sub)',
          margin:     0,
          lineHeight: 1.4,
          fontWeight: 500,
        }}>
          {block.description}
        </p>
      </div>
    </Link>
  );
}