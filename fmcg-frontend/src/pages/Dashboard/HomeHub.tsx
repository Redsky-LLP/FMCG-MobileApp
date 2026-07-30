// PATH: src/pages/Dashboard/HomeHub.tsx
// UPDATED: Removed Record Payment, Scan Product, Daily Settlement from Quick Actions
//          Removed Analytics - View Insights from main page
// FIX: Combined primary admin cards into one uniform 3×2 grid

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
import { useIsMobile } from '../../hooks/useIsMobile';

// ── Premium Dark Theme tokens ─────────────────────────────────────────────────
const D = {
  bg:       '#0a0e1a',      // Deeper navy-black
  bgGrad:   'linear-gradient(180deg, #0a0e1a 0%, #0f172a 40%, #1a1a2e 100%)',
  surface:  '#141b2d',      // Darker card background
  surface2: '#1a2236',      // Slightly lighter for hover
  border:   '#2a3450',      // Softer border with blue tint
  borderGlow: 'rgba(234,88,12,0.15)',
  accent:   '#ea580c',      // Orange accent
  accentH:  '#f97316',
  accentGlow: 'rgba(234,88,12,0.25)',
  accentGrad: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
  text:     '#f0f4ff',      // Slightly blue-tinted white
  muted:    '#8892b0',      // Muted blue-grey
  sub:      '#5a6a8a',      // Darker muted
  green:    '#34d399',      // Softer green
  greenBg:  'rgba(52,211,153,0.12)',
  red:      '#f87171',
  redBg:    'rgba(248,113,113,0.12)',
  amber:    '#fbbf24',
  amberBg:  'rgba(251,191,36,0.12)',
  blue:     '#60a5fa',
  blueBg:   'rgba(96,165,250,0.12)',
  purple:   '#a78bfa',
  purpleBg: 'rgba(167,139,250,0.12)',
  card:     '#141b2d',
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
const NAV_BLOCKS: NavBlock[] = [
  // ── Salesman ──
  {
    id: 'routes', label: 'Deliveries & Routes',
    description: 'View and manage today\'s delivery routes',
    icon: Route, to: '/salesman/routes',
    badge: '3 Active', badgeColor: 'blue',
    accent: D.blueBg, accentText: D.blue, roles: ['Salesman'],
  },
  {
    id: 'salesman-orders', label: 'My Orders',
    description: 'View and submit field orders',
    icon: ShoppingCart, to: '/salesman/routes',
    badge: '5 Open', badgeColor: 'blue',
    accent: D.blueBg, accentText: D.blue, roles: ['Salesman'],
  },
  // ── Admin priority order ──
  {
    id: 'admin-routes', label: 'Route Masters',
    description: 'Assign routes and track live deliveries',
    icon: Route, to: '/admin/routes',
    badge: 'Live', badgeColor: 'green',
    accent: D.accent, accentText: D.accent, roles: ['Admin', 'SuperAdmin'],
  },
  {
    id: 'customers', label: 'Customers Masters',
    description: 'Browse and manage customer catalog',
    icon: Users, to: '/admin/customers',
    badge: '248 Active', badgeColor: 'blue',
    accent: D.purpleBg, accentText: D.purple, roles: ['Admin', 'SuperAdmin'],
  },
  // Products card
  {
    id: 'products', label: 'Products Masters',
    description: 'Manage product catalog and pricing',
    icon: Package, to: '/admin/products',
    accent: D.greenBg, accentText: D.green, roles: ['Admin', 'SuperAdmin'],
  },
  // ── NEW: Catalog Config Card ──
  {
    id: 'catalog', label: 'Catalog Config',
    description: 'Manage product groups and measurement units',
    icon: Settings, to: '/admin/catalog',
    accent: D.purpleBg, accentText: D.purple, roles: ['Admin', 'SuperAdmin'],
    size: 'small',
  },
  // Users card - ENLARGED
  {
    id: 'users', label: 'User Management',
    description: 'Manage users, roles, and permissions across the platform',
    icon: UserCog, to: '/admin/users',
    accent: D.blueBg, accentText: D.blue, roles: ['Admin', 'SuperAdmin'],
    size: 'large',
  },
  // Reports card - ENLARGED
  {
    id: 'reports', label: 'Report Masters',
    description: 'Generate and view detailed business reports and analytics',
    icon: FileText, to: '/admin/reports',
    accent: D.greenBg, accentText: D.green, roles: ['Admin', 'SuperAdmin'],
    size: 'large',
  },
  // ── Accounts ──
  {
    id: 'accounts-settlement', label: 'Settlement',
    description: 'Process daily collections and closures',
    icon: IndianRupee, to: '/accounts/settlement',
    badge: 'Today', badgeColor: 'blue',
    accent: D.amberBg, accentText: D.amber, roles: ['Accounts'],
  },
  {
    id: 'accounts-reports', label: 'Reports',
    description: 'Daily and monthly financial reports',
    icon: FileText, to: '/accounts/reports',
    accent: D.greenBg, accentText: D.green, roles: ['Accounts'],
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

// ── REMOVED: Analytics stat card ──
// The "View Insights" card has been removed from the main page

// ── Quick Actions ──
// REMOVED: Record Payment, Scan Product, Daily Settlement
const QUICK_ACTIONS: QuickAction[] = [
  { id: 'new-order', label: 'New Order', description: 'Create a fresh customer order', icon: ClipboardList, to: '/admin/orders', color: D.accent, roles: ['Admin', 'SuperAdmin', 'Salesman'] },
  { id: 'add-customer', label: 'Add Customer', description: 'Register a new customer', icon: Users, to: '/admin/customers', color: D.amber, roles: ['Admin', 'SuperAdmin', 'Salesman'] },
  { id: 'view-routes', label: 'View Routes', description: 'Check today\'s route map', icon: Route, to: '/salesman/routes', color: D.accent, roles: ['Salesman'] },
  { id: 'start-route', label: 'Start Route', description: 'Begin executing a delivery route', icon: Zap, to: '/salesman/routes', color: '#06B6D4', roles: ['Salesman'] },
  { id: 'reports', label: 'View Reports', description: 'Open financial and sales reports', icon: FileText, to: '/admin/reports', color: D.green, roles: ['Admin', 'SuperAdmin', 'Accounts'] },
  { id: 'users', label: 'Manage Users', description: 'Add or edit system users', icon: UserCog, to: '/admin/users', color: D.blue, roles: ['Admin', 'SuperAdmin'] },
];

const BADGE_STYLES: Record<string, { bg: string; color: string }> = {
  blue:   { bg: 'rgba(96,165,250,0.15)',  color: '#60a5fa' },
  green:  { bg: 'rgba(52,211,153,0.15)',  color: '#34d399' },
  amber:  { bg: 'rgba(251,191,36,0.15)',  color: '#fbbf24' },
  red:    { bg: 'rgba(248,113,113,0.15)', color: '#f87171' },
  violet: { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa' },
};

// function getGreeting(): string {
//   const h = new Date().getHours();
//   if (h < 12) return 'Good morning';
//   if (h < 17) return 'Good afternoon';
//   return 'Good evening';
// }

function getDateString(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ═══════════════════════════════════════════════════════════════
export function HomeHub() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
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

  // ── Force dark theme on body ──────────────────────────────────────────────
  useEffect(() => {
    document.body.style.background = D.bg;
    document.body.style.color = D.text;
    return () => {
      document.body.style.background = '';
      document.body.style.color = '';
    };
  }, []);

  if (!user) return null;

  const role         = user.role;
  const firstName    = user.name?.split(' ')[0] ?? 'there';
  const isAdmin      = role === 'Admin' || role === 'SuperAdmin';

  const blocks       = NAV_BLOCKS.filter(b => b.roles.includes(role));
  const quickActions = QUICK_ACTIONS.filter(a => a.roles.includes(role));

  // ── All primary admin cards now render at the same uniform size, in one
  // grid, in this fixed order. "large" sizing is no longer used — every
  // card gets identical padding/height via NavBlockCard. ──
  const primaryBlockIds = ['admin-routes', 'customers', 'products', 'catalog', 'users', 'reports'];
  const primaryBlocks = isAdmin
    ? primaryBlockIds
        .map(id => blocks.find(b => b.id === id))
        .filter((b): b is NavBlock => !!b)
    : blocks;
  // Everything else goes to more tools
  const moreTools = isAdmin ? blocks.filter(b => !primaryBlockIds.includes(b.id)) : [];

  function liveBadge(blockId: string): string | undefined {
    if (blockId === 'admin-routes') return liveStats.routesCount !== undefined ? `${liveStats.routesCount} Routes` : undefined;
    if (blockId === 'customers')    return liveStats.customersCount !== undefined ? `${liveStats.customersCount} Active` : undefined;
    return undefined;
  }

  return (
    <div style={{
      background: D.bg,
      backgroundImage: D.bgGrad,
      color: D.text,
      minHeight: '100vh',
      padding: '20px 20px 120px',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* ── Welcome Header ──────────────────────────────────── */}
        <div style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(12px)',
          transition: 'all 0.4s cubic-bezier(0.34,1.2,0.64,1)',
          marginBottom: 28,
        }}>
          {/* Date chip */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 14px',
            borderRadius: 20,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
            marginBottom: 16,
          }}>
            <Clock size={13} style={{ color: D.accent }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: D.muted, letterSpacing: '0.02em' }}>
              {getDateString()}
            </span>
            <span style={{
              width: 4, height: 4, borderRadius: '50%',
              background: D.green, margin: '0 4px',
              boxShadow: `0 0 8px ${D.green}44`,
            }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: D.green }}>Live</span>
          </div>
        </div>

        {/* ── Status Strip ──────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap',
          opacity: mounted ? 1 : 0,
          transition: 'all 0.4s 0.08s cubic-bezier(0.34,1.2,0.64,1)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: D.green,
              boxShadow: `0 0 0 3px rgba(52,211,153,0.25)`,
              animation: 'pulse-ring 2s ease infinite',
            }} />
            <span style={{ fontSize: 12, color: D.muted, fontWeight: 600 }}>System:</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: D.green }}>Operational</span>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <ArrowUpRight size={13} style={{ color: D.accent }} />
            <span style={{ fontSize: 12, color: D.muted, fontWeight: 600 }}>Role:</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: D.accent }}>{role}</span>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <Sparkles size={13} style={{ color: D.amber }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: D.muted }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'short' })} — Let's get it done!
            </span>
          </div>
        </div>

        {/* ── Primary Nav Grid — every card the same size, 3 per row ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)',
          gap: 14,
          marginBottom: 14,
          opacity: mounted ? 1 : 0,
          transition: 'all 0.42s 0.12s cubic-bezier(0.34,1.2,0.64,1)',
        }}>
          {primaryBlocks.map((block, idx) => (
            <NavBlockCard
              key={block.id}
              block={block}
              delay={idx * 0.05}
              fullWidth={false}
              badgeOverride={liveBadge(block.id)}
            />
          ))}
        </div>

        {/* ── More Tools (everything else) ────── */}
        {isAdmin && moreTools.length > 0 && (
          <div style={{
            marginTop: 6,
            padding: '16px 20px',
            background: D.surface,
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 14,
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.4s 0.3s ease',
          }}>
            <h3 style={{
              fontSize: 11, fontWeight: 700, color: D.muted,
              margin: '0 0 12px', letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              More Tools
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 8,
            }}>
              {moreTools.map(tool => {
                const colorMap: Record<string, string> = {
                  'incentives': D.purple,
                  'assignments': D.green,
                  'session-log': D.purple,
                  'settlement': D.amber,
                  'accounts-settlement': D.amber,
                  'accounts-reports': D.green,
                  'loading': D.accent,
                  'pack-orders': D.accent,
                };
                const color = colorMap[tool.id] || D.muted;
                return (
                  <Link key={tool.to} to={tool.to} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px',
                    borderRadius: 10,
                    textDecoration: 'none',
                    fontSize: 13, fontWeight: 500,
                    color: D.muted,
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.04)',
                    transition: 'all 0.15s',
                  }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.borderColor = `${color}44`;
                      el.style.background  = `${color}12`;
                      el.style.color       = color;
                      el.style.transform   = 'translateY(-1px)';
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.borderColor = 'rgba(255,255,255,0.04)';
                      el.style.background  = 'rgba(255,255,255,0.02)';
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
          width: 56, height: 56, borderRadius: '50%',
          background: D.accentGrad,
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 8px 32px rgba(234,88,12,0.35)`,
          zIndex: 150, transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.transform = 'scale(1.10)';
          el.style.boxShadow = `0 12px 40px rgba(234,88,12,0.45)`;
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.transform = 'scale(1)';
          el.style.boxShadow = `0 8px 32px rgba(234,88,12,0.35)`;
        }}
        title="Quick Actions"
      >
        <Plus size={24} color="#fff" strokeWidth={2.5} />
      </button>

      {/* ── Quick Action Modal ── */}
      {fabOpen && (
        <>
          <div onClick={() => setFabOpen(false)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.70)',
            backdropFilter: 'blur(6px)', zIndex: 160,
          }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 170,
            background: D.surface,
            borderRadius: '20px 20px 0 0',
            padding: '0 0 28px',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
            maxHeight: '80vh', overflowY: 'auto',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)' }} />
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 24px 18px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
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
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.04)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: D.muted,
              }}>
                <X size={16} />
              </button>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill,minmax(155px,1fr))',
              gap: 10, padding: '18px 20px',
            }}>
              {quickActions.map(action => (
                <Link key={action.id} to={action.to} onClick={() => setFabOpen(false)} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  gap: 10, padding: '14px 16px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(255,255,255,0.02)',
                  textDecoration: 'none', cursor: 'pointer',
                  transition: 'all 0.18s cubic-bezier(0.34,1.3,0.64,1)',
                }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = `${action.color}44`;
                    el.style.background  = `${action.color}12`;
                    el.style.transform   = 'translateY(-2px)';
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = 'rgba(255,255,255,0.06)';
                    el.style.background  = 'rgba(255,255,255,0.02)';
                    el.style.transform   = 'translateY(0)';
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: `${action.color}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <action.icon size={17} style={{ color: action.color }} strokeWidth={1.8} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: D.text, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                      {action.label}
                    </div>
                    <div style={{ fontSize: 11, color: D.muted, marginTop: 2, lineHeight: 1.3 }}>
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
function NavBlockCard({ block, delay, fullWidth, badgeOverride }: { 
  block: NavBlock; 
  delay: number; 
  fullWidth: boolean; 
  badgeOverride?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const badgeStyle = block.badgeColor ? BADGE_STYLES[block.badgeColor] : BADGE_STYLES.blue;
  const badgeText = badgeOverride ?? block.badge;

  return (
    <Link to={block.to} style={{
      gridColumn: fullWidth ? '1 / -1' : undefined,
      display: 'flex', flexDirection: 'column',
      padding: '20px 18px',
      borderRadius: 16,
      border: `1px solid ${hovered ? `${block.accentText}44` : 'rgba(255,255,255,0.06)'}`,
      background: hovered ? `${block.accentText}10` : D.surface,
      textDecoration: 'none', cursor: 'pointer',
      transition: 'all 0.25s cubic-bezier(0.34,1.2,0.64,1)',
      transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
      minHeight: 140,
      position: 'relative', overflow: 'hidden',
      boxShadow: hovered ? `0 8px 32px rgba(0,0,0,0.4)` : 'none',
    }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Glow effect */}
      <div style={{
        position: 'absolute',
        top: 0, right: 0,
        width: 120, height: 120,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${block.accentText}15 0%, transparent 70%)`,
        transform: 'translate(30%, -30%)',
        pointerEvents: 'none',
        opacity: hovered ? 1 : 0,
        transition: 'opacity 0.3s',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'auto' }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          background: hovered ? `${block.accentText}18` : 'rgba(255,255,255,0.04)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.25s',
          border: hovered ? `1px solid ${block.accentText}22` : '1px solid rgba(255,255,255,0.04)',
        }}>
          <block.icon size={20} style={{ color: block.accentText }} strokeWidth={hovered ? 2.2 : 1.8} />
        </div>

        {badgeText && (
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '3px 10px',
            borderRadius: 20,
            fontSize: 10, fontWeight: 700, letterSpacing: '0.02em',
            background: badgeStyle.bg,
            color: badgeStyle.color,
            border: `1px solid ${badgeStyle.color}22`,
          }}>
            {badgeText}
          </span>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <h3 style={{
            fontSize: 14,
            fontWeight: 800,
            color: D.text,
            margin: 0,
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}>
            {block.label}
          </h3>
          <ChevronRight size={13} style={{
            transition: 'transform 0.2s,color 0.15s',
            transform: hovered ? 'translateX(4px)' : 'translateX(0)',
            color: hovered ? block.accentText : D.muted,
          }} />
        </div>
        <p style={{
          fontSize: 12,
          color: D.muted,
          margin: 0,
          lineHeight: 1.5,
          fontWeight: 400,
        }}>
          {block.description}
        </p>
      </div>
    </Link>
  );
}