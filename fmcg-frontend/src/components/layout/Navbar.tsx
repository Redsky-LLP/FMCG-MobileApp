// PATH: src/components/layout/Navbar.tsx
// Redesigned — White & Blue corporate design system
// Drawer-first navigation, minimal top bar

import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Package, Route, Users, ShoppingCart, BarChart3, FileText,
  Settings, LogOut, Menu, X, Warehouse, Calculator, Home,
  TrendingUp, Gift, UserCog, CalendarDays, Boxes, ChevronRight,
  Bell, Search,
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
  { to: '/admin/assignments', label: 'Temp Assignments', icon: CalendarDays, roles: ['Admin', 'SuperAdmin'] },
  { to: '/admin/customers',   label: 'Customers',        icon: Users,        roles: ['Admin', 'SuperAdmin'] },
  { to: '/admin/products',    label: 'Products',         icon: Package,      roles: ['Admin', 'SuperAdmin'] },
  { to: '/admin/orders',      label: 'Orders',           icon: ShoppingCart, roles: ['Admin', 'SuperAdmin'] },
  { to: '/admin/settlement',  label: 'Settlement',       icon: Calculator,   roles: ['Admin', 'SuperAdmin'] },
  { to: '/admin/reports',     label: 'Reports',          icon: FileText,     roles: ['Admin', 'SuperAdmin'] },
  { to: '/admin/analytics',   label: 'Analytics',        icon: BarChart3,    roles: ['Admin', 'SuperAdmin'] },
  { to: '/admin/incentives',  label: 'Incentives',       icon: Gift,         roles: ['Admin', 'SuperAdmin'] },
  { to: '/admin/users',       label: 'Users',            icon: UserCog,      roles: ['Admin', 'SuperAdmin'] },
  { to: '/admin/settings',    label: 'Settings',         icon: Settings,     roles: ['Admin', 'SuperAdmin'] },

  // Salesman
  { to: '/salesman/routes',     label: 'My Routes',  icon: Route,        roles: ['Salesman'] },
  { to: '/salesman/incentives', label: 'Incentives', icon: TrendingUp,   roles: ['Salesman'] },

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
  Salesman:   ['/salesman/routes', '/salesman/incentives'],
  Accounts:   ['/accounts/settlement', '/accounts/reports'],
  Warehouse:  ['/warehouse/loading', '/warehouse/dashboard'],
};

// Role pill color
const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  SuperAdmin: { bg: '#FEF3C7', text: '#92400E' },
  Admin:      { bg: '#EFF6FF', text: '#1D4ED8' },
  Salesman:   { bg: '#F0FDF4', text: '#15803D' },
  Accounts:   { bg: '#FDF4FF', text: '#7E22CE' },
  Warehouse:  { bg: '#FFF7ED', text: '#C2410C' },
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
  const roleColor    = ROLE_COLORS[user.role] ?? { bg: '#EFF6FF', text: '#1D4ED8' };

  function handleLogout() {
    logout();
    navigate('/login');
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
      {/* ── Top Navbar ──────────────────────────────────────── */}
      <nav style={{
        position:      'fixed',
        top:           0, left: 0, right: 0,
        height:        'var(--nav-h)',
        background:    '#FFFFFF',
        borderBottom:  '1px solid var(--border)',
        boxShadow:     '0 1px 0 rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.04)',
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
              border:          '1px solid var(--border)',
              background:      'transparent',
              cursor:          'pointer',
              color:           'var(--text-sub)',
              transition:      'all 0.15s',
              flexShrink:      0,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'var(--ice)';
              (e.currentTarget as HTMLElement).style.color = 'var(--primary)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(37,99,235,0.25)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-sub)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
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
              background:     'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)',
              borderRadius:   9,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              boxShadow:      '0 2px 8px rgba(37,99,235,0.25)',
            }}>
              <Package size={17} color="#fff" strokeWidth={2.2} />
            </div>
            <span style={{
              fontWeight:    800,
              fontSize:      15,
              color:         'var(--navy)',
              letterSpacing: '-0.03em',
            }}>
              FMCG<span style={{ color: 'var(--primary)', fontWeight: 700 }}>Dist</span>
            </span>
          </Link>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0 }} className="hide-mobile" />

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
                  padding:        '6px 12px',
                  borderRadius:   8,
                  textDecoration: 'none',
                  fontSize:       13,
                  fontWeight:     600,
                  whiteSpace:     'nowrap',
                  color:          active ? 'var(--primary)' : 'var(--text-sub)',
                  background:     active ? 'var(--ice)' : 'transparent',
                  border:         `1px solid ${active ? 'rgba(37,99,235,0.20)' : 'transparent'}`,
                  transition:     'all 0.14s',
                  letterSpacing:  '-0.01em',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'var(--card-sub)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-body)';
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-sub)';
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
            style={{ position: 'relative' }}
            title="Notifications"
          >
            <Bell size={16} />
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
              border:         '1px solid var(--border)',
              background:     'var(--card-sub)',
              cursor:         'pointer',
              transition:     'all 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(37,99,235,0.25)';
              (e.currentTarget as HTMLElement).style.background = 'var(--ice)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
              (e.currentTarget as HTMLElement).style.background = 'var(--card-sub)';
            }}
          >
            {/* Avatar */}
            <div style={{
              width:          30, height: 30,
              borderRadius:   '50%',
              background:     'linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              flexShrink:     0,
            }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '0.02em' }}>
                {initials}
              </span>
            </div>
            <div className="hide-mobile" style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
                {user.name?.split(' ')[0] ?? 'User'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-sub)', lineHeight: 1.2 }}>{user.role}</div>
            </div>
            <ChevronRight size={12} style={{ color: 'var(--text-muted)', marginLeft: 2 }} className="hide-mobile" />
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
            background: 'rgba(15,23,42,0.40)',
            backdropFilter: 'blur(2px)',
            animation:  'fade-in 0.18s ease',
          }}
        />
      )}

      {/* ── Slide-out Drawer ─────────────────────────────────── */}
      <div
        ref={drawerRef}
        style={{
          position:      'fixed',
          top:           0,
          left:          0,
          bottom:        0,
          width:         292,
          background:    '#FFFFFF',
          borderRight:   '1px solid var(--border)',
          boxShadow:     '4px 0 32px rgba(15,23,42,0.12)',
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
          borderBottom: '1px solid var(--border)',
          flexShrink:   0,
        }}>
          {/* Logo row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width:          34, height: 34,
                background:     'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)',
                borderRadius:   9,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                boxShadow:      '0 2px 8px rgba(37,99,235,0.25)',
              }}>
                <Package size={17} color="#fff" strokeWidth={2.2} />
              </div>
              <span style={{
                fontWeight:    800,
                fontSize:      15,
                color:         'var(--navy)',
                letterSpacing: '-0.03em',
              }}>
                FMCG<span style={{ color: 'var(--primary)' }}>Dist</span>
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
                border:          '1px solid var(--border)',
                background:      'transparent',
                cursor:          'pointer',
                color:           'var(--text-sub)',
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
            background:   'var(--ice)',
            border:       '1px solid rgba(37,99,235,0.12)',
            borderRadius: 12,
          }}>
            <div style={{
              width:          42, height: 42,
              borderRadius:   '50%',
              background:     'linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              flexShrink:     0,
              boxShadow:      '0 2px 8px rgba(37,99,235,0.25)',
            }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{initials}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize:     14,
                fontWeight:   700,
                color:        'var(--navy)',
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
                  borderRadius:  20,
                  fontSize:      11,
                  fontWeight:    700,
                  background:    roleColor.bg,
                  color:         roleColor.text,
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
            color:         'var(--text-muted)',
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
                  color:          active ? 'var(--primary)' : 'var(--text-body)',
                  background:     active ? 'var(--ice)' : 'transparent',
                  border:         `1px solid ${active ? 'rgba(37,99,235,0.15)' : 'transparent'}`,
                  letterSpacing:  '-0.01em',
                  transition:     'all 0.12s',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'var(--card-sub)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
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
                  background:     active ? 'rgba(37,99,235,0.12)' : 'var(--card-sub)',
                  color:          active ? 'var(--primary)' : 'var(--text-sub)',
                  transition:     'all 0.12s',
                }}>
                  <item.icon size={16} strokeWidth={active ? 2.2 : 1.8} />
                </div>
                <span style={{ flex: 1 }}>{item.label}</span>
                {active && (
                  <div style={{
                    width:        6, height: 6,
                    borderRadius: '50%',
                    background:   'var(--primary)',
                    flexShrink:   0,
                  }} />
                )}
              </Link>
            );
          })}
        </div>

        {/* Drawer footer */}
        <div style={{
          padding:    '16px 12px',
          borderTop:  '1px solid var(--border)',
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
              border:         '1px solid var(--border)',
              background:     'transparent',
              cursor:         'pointer',
              width:          '100%',
              fontSize:       14,
              fontWeight:     600,
              color:          'var(--text-sub)',
              letterSpacing:  '-0.01em',
              transition:     'all 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'var(--red-bg)';
              (e.currentTarget as HTMLElement).style.color = 'var(--red)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(220,38,38,0.20)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-sub)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
            }}
          >
            <div style={{
              width:          32, height: 32,
              borderRadius:   8,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              background:     'var(--card-sub)',
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