// PATH: src/components/layout/Navbar.tsx
// UPDATED: Premium dark theme navbar with glass-morphism effect

import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Package, Route, Users, ShoppingCart, BarChart3, FileText,
  Settings, LogOut, Menu, X, Warehouse, Calculator, Home,
  TrendingUp, Gift, UserCog, CalendarDays, Boxes, ChevronRight,
  Bell, Search, Clock,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

interface NavItem {
  to:    string;
  label: string;
  icon:  React.ElementType;
  roles: string[];
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  // Admin / SuperAdmin
  { to: '/admin/dashboard',   label: 'Dashboard',        icon: Home,         roles: ['Admin', 'SuperAdmin'] },
  { to: '/admin/routes',      label: 'Routes',           icon: Route,        roles: ['Admin', 'SuperAdmin'] },
  { to: '/admin/customers',   label: 'Customers',        icon: Users,        roles: ['Admin', 'SuperAdmin'] },
  { to: '/admin/products',    label: 'Products',         icon: Package,      roles: ['Admin', 'SuperAdmin'] },
  { to: '/admin/orders',      label: 'Orders',           icon: ShoppingCart, roles: ['Admin', 'SuperAdmin'] },
  { to: '/admin/reports',     label: 'Reports',          icon: FileText,     roles: ['Admin', 'SuperAdmin'] },
  { to: '/admin/users',        label: 'Users',            icon: UserCog,      roles: ['Admin', 'SuperAdmin'] },
  { to: '/admin/session-log',  label: 'Session Log',      icon: Clock,        roles: ['Admin', 'SuperAdmin'] },

  // Salesman
  { to: '/salesman/routes',     label: 'My Routes',  icon: Route,        roles: ['Salesman'] },
  // Accounts
  { to: '/accounts/settlement', label: 'Settlement', icon: Calculator, roles: ['Accounts'] },
  { to: '/accounts/reports',    label: 'Reports',    icon: FileText,   roles: ['Accounts'] },

  // Warehouse
  { to: '/warehouse/loading',   label: 'Loading Sheet', icon: Warehouse, roles: ['Warehouse'] },
  { to: '/warehouse/dashboard', label: 'Pack Orders',   icon: Boxes,     roles: ['Warehouse'] },
];

// Role-specific primary shortcuts shown in the top nav (max 3 visible on desktop)
const PRIMARY_SHORTCUTS: Record<string, string[]> = {
  Admin:      ['/admin/dashboard', '/admin/orders', '/admin/routes'],
  SuperAdmin: ['/admin/dashboard', '/admin/orders', '/admin/routes'],
  Salesman:   ['/salesman/routes'],
  Accounts:   ['/accounts/settlement', '/accounts/reports'],
  Warehouse:  ['/warehouse/loading', '/warehouse/dashboard'],
};

// Role pill color - dark theme variants
const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  SuperAdmin: { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24', border: 'rgba(251,191,36,0.20)' },
  Admin:      { bg: 'rgba(96,165,250,0.15)', text: '#60a5fa', border: 'rgba(96,165,250,0.20)' },
  Salesman:   { bg: 'rgba(52,211,153,0.15)', text: '#34d399', border: 'rgba(52,211,153,0.20)' },
  Accounts:   { bg: 'rgba(167,139,250,0.15)', text: '#a78bfa', border: 'rgba(167,139,250,0.20)' },
  Warehouse:  { bg: 'rgba(251,146,60,0.15)',  text: '#fb923c', border: 'rgba(251,146,60,0.20)' },
};

// ── Dark theme tokens ─────────────────────────────────────────────────────────
const D = {
  bg:       '#0a0e1a',
  surface:  '#141b2d',
  border:   'rgba(255,255,255,0.06)',
  text:     '#f0f4ff',
  muted:    '#8892b0',
  sub:      '#5a6a8a',
  accent:   '#ea580c',
  accentGlow: 'rgba(234,88,12,0.25)',
  navBg:    'rgba(10,14,26,0.92)',
};

export function Navbar() {
  const { user, logout }  = useAuthStore();
  const location          = useLocation();
  const navigate          = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  if (!user) return null;

  const allItems     = NAV_ITEMS.filter(n => n.roles.includes(user.role));
  const shortcutKeys = PRIMARY_SHORTCUTS[user.role] ?? [];
  const shortcuts    = allItems.filter(n => shortcutKeys.includes(n.to));
  const roleColor    = ROLE_COLORS[user.role] ?? ROLE_COLORS.Admin;

  async function handleLogout() {
    await logout();
    navigate('/pin-login');
  }

  function isActive(to: string) {
    return location.pathname === to || location.pathname.startsWith(to + '/');
  }

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (drawerOpen && drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setDrawerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [drawerOpen]);

  // Prevent body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const initials = user.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? 'U';

  return (
    <>
      {/* ── Top Navbar ── Premium Dark Theme ───────────────────── */}
      <nav style={{
        position:      'fixed',
        top:           0, left: 0, right: 0,
        height:        'var(--nav-h)',
        background:    D.navBg,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom:  `1px solid ${D.border}`,
        boxShadow:     '0 2px 20px rgba(0,0,0,0.4)',
        zIndex:        100,
        display:       'flex',
        alignItems:    'center',
        padding:       '0 20px',
        gap:           12,
      }}>

        {/* Hamburger + Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              width:           38,
              height:          38,
              borderRadius:    10,
              border:          `1px solid ${D.border}`,
              background:      'rgba(255,255,255,0.03)',
              cursor:          'pointer',
              color:           D.muted,
              transition:      'all 0.15s',
              flexShrink:      0,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
              (e.currentTarget as HTMLElement).style.color = D.text;
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(234,88,12,0.3)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
              (e.currentTarget as HTMLElement).style.color = D.muted;
              (e.currentTarget as HTMLElement).style.borderColor = D.border;
            }}
            title="Open menu"
          >
            <Menu size={18} />
          </button>

          <Link
            to="/"
            style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}
          >
            <div style={{
              width:          34, height: 34,
              background:     'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
              borderRadius:   9,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              boxShadow:      '0 2px 12px rgba(234,88,12,0.30)',
            }}>
              <Package size={17} color="#fff" strokeWidth={2.2} />
            </div>
            <span style={{
              fontWeight:    800,
              fontSize:      15,
              color:         D.text,
              letterSpacing: '-0.03em',
            }}>
              FMCG<span style={{ color: D.accent, fontWeight: 700 }}>Dist</span>
            </span>
          </Link>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: D.border, flexShrink: 0 }} className="hide-mobile" />

        {/* Desktop shortcut nav */}
        <div
          className="hide-mobile"
          style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}
        >
          {shortcuts.map(item => {
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  gap:            6,
                  padding:        '6px 14px',
                  borderRadius:   8,
                  textDecoration: 'none',
                  fontSize:       13,
                  fontWeight:     600,
                  whiteSpace:     'nowrap',
                  color:          active ? D.text : D.muted,
                  background:     active ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border:         `1px solid ${active ? 'rgba(234,88,12,0.20)' : 'transparent'}`,
                  transition:     'all 0.14s',
                  letterSpacing:  '-0.01em',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                    (e.currentTarget as HTMLElement).style.color = D.text;
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = D.muted;
                    (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                  }
                }}
              >
                <item.icon size={14} />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>

          {/* Notification bell */}
          <button
            className="btn btn-ghost btn-icon hide-mobile"
            style={{
              position: 'relative',
              width: 36, height: 36,
              borderRadius: 8,
              border: `1px solid ${D.border}`,
              background: 'rgba(255,255,255,0.03)',
              cursor: 'pointer',
              color: D.muted,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
              (e.currentTarget as HTMLElement).style.color = D.text;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
              (e.currentTarget as HTMLElement).style.color = D.muted;
            }}
            title="Notifications"
          >
            <Bell size={16} />
            <span style={{
              position: 'absolute', top: 6, right: 6,
              width: 6, height: 6, borderRadius: '50%',
              background: D.accent,
              boxShadow: `0 0 8px ${D.accentGlow}`,
            }} />
          </button>

          {/* User chip */}
          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              display:        'flex',
              alignItems:     'center',
              gap:            8,
              padding:        '5px 12px 5px 6px',
              borderRadius:   24,
              border:         `1px solid ${D.border}`,
              background:     'rgba(255,255,255,0.03)',
              cursor:         'pointer',
              transition:     'all 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(234,88,12,0.30)';
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = D.border;
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
            }}
          >
            {/* Avatar */}
            <div style={{
              width:          30, height: 30,
              borderRadius:   '50%',
              background:     'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              flexShrink:     0,
              boxShadow:      '0 2px 8px rgba(234,88,12,0.25)',
            }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '0.02em' }}>
                {initials}
              </span>
            </div>
            <div className="hide-mobile" style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: D.text, lineHeight: 1.2, letterSpacing: '-0.01em' }}>
                {user.name?.split(' ')[0] ?? 'User'}
              </div>
              <div style={{ 
                fontSize: 10, 
                color: D.accent, 
                lineHeight: 1.2,
                fontWeight: 600,
              }}>
                {user.role}
              </div>
            </div>
            <ChevronRight size={12} style={{ color: D.muted, marginLeft: 2 }} className="hide-mobile" />
          </button>
        </div>
      </nav>

      {/* ── Drawer Overlay ───────────────────────────────────── */}
      {drawerOpen && (
        <div
          style={{
            position:   'fixed',
            inset:      0,
            zIndex:     200,
            background: 'rgba(0,0,0,0.60)',
            backdropFilter: 'blur(4px)',
            animation:  'fade-in 0.18s ease',
          }}
        />
      )}

      {/* ── Slide-out Drawer ── Premium Dark ─────────────────── */}
      <div
        ref={drawerRef}
        style={{
          position:      'fixed',
          top:           0,
          left:          0,
          bottom:        0,
          width:         292,
          background:    D.surface,
          borderRight:   `1px solid ${D.border}`,
          boxShadow:     '4px 0 40px rgba(0,0,0,0.5)',
          zIndex:        300,
          display:       'flex',
          flexDirection: 'column',
          transform:     drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition:    'transform 0.26s cubic-bezier(0.34, 1.2, 0.64, 1)',
          willChange:    'transform',
        }}
      >
        {/* Drawer header */}
        <div style={{
          padding:      '20px 20px 16px',
          borderBottom: `1px solid ${D.border}`,
          flexShrink:   0,
        }}>
          {/* Logo row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width:          34, height: 34,
                background:     'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
                borderRadius:   9,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                boxShadow:      '0 2px 12px rgba(234,88,12,0.30)',
              }}>
                <Package size={17} color="#fff" strokeWidth={2.2} />
              </div>
              <span style={{
                fontWeight:    800,
                fontSize:      15,
                color:         D.text,
                letterSpacing: '-0.03em',
              }}>
                FMCG<span style={{ color: D.accent }}>Dist</span>
              </span>
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                width:           32,
                height:          32,
                borderRadius:    8,
                border:          `1px solid ${D.border}`,
                background:      'rgba(255,255,255,0.03)',
                cursor:          'pointer',
                color:           D.muted,
                transition:      'all 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
                (e.currentTarget as HTMLElement).style.color = D.text;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                (e.currentTarget as HTMLElement).style.color = D.muted;
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* User profile card */}
          <div style={{
            display:      'flex',
            alignItems:   'center',
            gap:          12,
            padding:      '12px 14px',
            background:   'rgba(255,255,255,0.04)',
            border:       `1px solid ${D.border}`,
            borderRadius: 12,
          }}>
            <div style={{
              width:          42, height: 42,
              borderRadius:   '50%',
              background:     'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              flexShrink:     0,
              boxShadow:      '0 2px 10px rgba(234,88,12,0.25)',
            }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{initials}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize:     14,
                fontWeight:   700,
                color:        D.text,
                letterSpacing: '-0.02em',
                whiteSpace:   'nowrap',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
              }}>
                {user.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <span style={{
                  display:      'inline-flex',
                  alignItems:   'center',
                  padding:      '2px 8px',
                  borderRadius: 20,
                  fontSize:     10,
                  fontWeight:   700,
                  background:    roleColor.bg,
                  color:         roleColor.text,
                  border:        `1px solid ${roleColor.border}`,
                  letterSpacing: '0.02em',
                }}>
                  {user.role}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <div style={{
          flex:      1,
          overflowY: 'auto',
          padding:   '12px 12px',
        }}>
          <div style={{
            fontSize:      10,
            fontWeight:    700,
            color:         D.sub,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding:       '4px 8px 8px',
          }}>
            Navigation
          </div>

          {allItems.map(item => {
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setDrawerOpen(false)}
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  gap:            10,
                  padding:        '9px 12px',
                  borderRadius:   10,
                  textDecoration: 'none',
                  fontSize:       14,
                  fontWeight:     active ? 700 : 500,
                  marginBottom:   2,
                  color:          active ? D.text : D.muted,
                  background:     active ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border:         `1px solid ${active ? 'rgba(234,88,12,0.20)' : 'transparent'}`,
                  letterSpacing:  '-0.01em',
                  transition:     'all 0.12s',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                    (e.currentTarget as HTMLElement).style.color = D.text;
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = D.muted;
                    (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                  }
                }}
              >
                <div style={{
                  width:          32, height: 32,
                  borderRadius:   8,
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  flexShrink:     0,
                  background:     active ? 'rgba(234,88,12,0.15)' : 'rgba(255,255,255,0.04)',
                  color:          active ? D.accent : D.muted,
                  transition:     'all 0.12s',
                }}>
                  <item.icon size={16} strokeWidth={active ? 2.2 : 1.8} />
                </div>
                <span style={{ flex: 1 }}>{item.label}</span>
                {active && (
                  <div style={{
                    width:        6, height: 6,
                    borderRadius: '50%',
                    background:   D.accent,
                    flexShrink:   0,
                    boxShadow:    `0 0 8px ${D.accentGlow}`,
                  }} />
                )}
              </Link>
            );
          })}
        </div>

        {/* Drawer footer */}
        <div style={{
          padding:    '16px 12px',
          borderTop:  `1px solid ${D.border}`,
          flexShrink: 0,
        }}>
          <button
            onClick={handleLogout}
            style={{
              display:        'flex',
              alignItems:     'center',
              gap:            10,
              padding:        '10px 14px',
              borderRadius:   10,
              border:         `1px solid ${D.border}`,
              background:     'rgba(255,255,255,0.02)',
              cursor:         'pointer',
              width:          '100%',
              fontSize:       14,
              fontWeight:     600,
              color:          D.muted,
              letterSpacing:  '-0.01em',
              transition:     'all 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.10)';
              (e.currentTarget as HTMLElement).style.color = '#f87171';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.20)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)';
              (e.currentTarget as HTMLElement).style.color = D.muted;
              (e.currentTarget as HTMLElement).style.borderColor = D.border;
            }}
          >
            <div style={{
              width:          32, height: 32,
              borderRadius:   8,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              background:     'rgba(255,255,255,0.04)',
            }}>
              <LogOut size={15} />
            </div>
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}