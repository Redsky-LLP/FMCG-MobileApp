// PATH: src/components/layout/MobileLayout.tsx
// COMPLETE FIX - Proper fixed header with content scrolling below
// UPDATED: Drawer header/footer now reserve space for the device's safe area
// (status bar at top, system nav bar at bottom) — the fixed bottom TAB nav
// already did this (paddingBottom: env(safe-area-inset-bottom)), but the
// side DRAWER (hamburger menu) never got the same treatment, so on tablets
// its header could sit under the status bar and its "Sign Out" footer sat
// flush against the system nav bar, both getting visually clipped.

import React, { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

import {
  MapPin,
  ShoppingCart,
  LayoutDashboard,
  Truck,
  FileText,
  Calculator,
  Package,
  LogOut,
  Menu,
  X,
  CalendarDays,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  roles: string[];
}

const NAV_ITEMS: Record<string, NavItem[]> = {
  Salesman: [
    { to: '/salesman/routes', label: 'My Routes', icon: MapPin, roles: ['Salesman'] },
    { to: '/salesman/orders', label: 'Orders', icon: ShoppingCart, roles: ['Salesman'] },
  ],
  Warehouse: [
    { to: '/warehouse/loading', label: 'Loading', icon: Truck, roles: ['Warehouse'] },
    { to: '/warehouse/dispatch', label: 'Dispatch', icon: Package, roles: ['Warehouse'] },
  ],
  Accounts: [
    { to: '/accounts/settlement', label: 'Settlement', icon: Calculator, roles: ['Accounts'] },
    { to: '/accounts/reports', label: 'Reports', icon: FileText, roles: ['Accounts'] },
  ],
  Admin: [
    { to: '/admin/dashboard', label: 'Home', icon: LayoutDashboard, roles: ['Admin', 'SuperAdmin'] },
    { to: '/admin/routes', label: 'Routes', icon: MapPin, roles: ['Admin', 'SuperAdmin'] },
    { to: '/admin/orders', label: 'Orders', icon: ShoppingCart, roles: ['Admin', 'SuperAdmin'] },
  ],
  SuperAdmin: [
    { to: '/admin/dashboard', label: 'Home', icon: LayoutDashboard, roles: ['SuperAdmin'] },
    { to: '/admin/routes', label: 'Routes', icon: MapPin, roles: ['SuperAdmin'] },
    { to: '/admin/orders', label: 'Orders', icon: ShoppingCart, roles: ['SuperAdmin'] },
  ],
};

export const MOBILE_NAV_HEIGHT = 52;
export const MOBILE_HEADER_HEIGHT = 44;
export const MOBILE_DATE_BAR_HEIGHT = 26;
export const MOBILE_TOTAL_HEADER_HEIGHT = MOBILE_HEADER_HEIGHT + MOBILE_DATE_BAR_HEIGHT;

const D = {
  bg:         '#0a0e1a',
  surface:    '#141b2d',
  border:     'rgba(255,255,255,0.06)',
  text:       '#f0f4ff',
  muted:      '#8892b0',
  sub:        '#5a6a8a',
  accent:     '#ea580c',
  accentGlow: 'rgba(234,88,12,0.25)',
  navBg:      'rgba(10,14,26,0.92)',
};

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  SuperAdmin: { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24' },
  Admin:      { bg: 'rgba(96,165,250,0.15)', text: '#60a5fa' },
  Salesman:   { bg: 'rgba(52,211,153,0.15)', text: '#34d399' },
  Accounts:   { bg: 'rgba(167,139,250,0.15)', text: '#a78bfa' },
  Warehouse:  { bg: 'rgba(251,146,60,0.15)',  text: '#fb923c' },
};

interface MobileLayoutProps {
  children: ReactNode;
  title?: string;
}

export function MobileLayout({ children, title }: MobileLayoutProps) {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Set CSS variables
  useEffect(() => {
    document.documentElement.style.setProperty('--mobile-nav-h', `${MOBILE_NAV_HEIGHT}px`);
    document.documentElement.style.setProperty('--mobile-header-h', `${MOBILE_TOTAL_HEADER_HEIGHT}px`);
    return () => {
      document.documentElement.style.removeProperty('--mobile-nav-h');
      document.documentElement.style.removeProperty('--mobile-header-h');
    };
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  if (!user) {
    return <>{children}</>;
  }

  const role = user.role;
  const navItems = NAV_ITEMS[role] || NAV_ITEMS.Admin;
  const roleColor = ROLE_COLORS[role] || ROLE_COLORS.Admin;

  const isActive = (to: string) => {
    if (to === '/salesman/routes' && location.pathname.includes('/salesman/routes')) return true;
    if (to === '/admin/dashboard' && location.pathname === '/admin/dashboard') return true;
    if (to === '/accounts/settlement' && location.pathname.includes('/accounts/settlement')) return true;
    if (to === '/warehouse/loading' && location.pathname.includes('/warehouse/loading')) return true;
    if (to === '/warehouse/dispatch' && location.pathname.includes('/warehouse/dispatch')) return true;
    return location.pathname === to;
  };

  const getPageTitle = () => {
    if (title) return title;
    const path = location.pathname;
    if (path.includes('/salesman/routes') && path.includes('/order/')) return 'Order Entry';
    if (path.includes('/salesman/routes') && path.includes('/execute')) return 'Route Execution';
    if (path.includes('/salesman/routes')) return 'My Routes';
    if (path.includes('/salesman/orders')) return 'My Orders';
    if (path.includes('/warehouse/loading')) return 'Loading Sheet';
    if (path.includes('/warehouse/dispatch')) return 'Pack Orders';
    if (path.includes('/warehouse/dashboard')) return 'Dashboard';
    if (path.includes('/accounts/settlement')) return 'Settlement';
    if (path.includes('/accounts/reports')) return 'Reports';
    if (path.includes('/admin/dashboard')) return 'Dashboard';
    if (path.includes('/admin/routes')) return 'Routes';
    if (path.includes('/admin/orders') && path.includes('/edit')) return 'Edit Order';
    if (path.includes('/admin/orders')) return 'Orders';
    if (path.includes('/admin/products')) return 'Products';
    if (path.includes('/admin/customers')) return 'Customers';
    if (path.includes('/admin/users')) return 'Users';
    if (path.includes('/admin/reports')) return 'Reports';
    return 'FMCG Dist';
  };

  const handleLogout = async () => {
    await logout();
    navigate('/pin-login');
    setDrawerOpen(false);
  };

  const initials = user.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? 'U';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
        background: D.bg,
      }}
    >
      {/* ── FIXED HEADER ── */}
      <div
        style={{
          position: 'relative',
          zIndex: 50,
          background: D.bg,
          borderBottom: `1px solid ${D.border}`,
          height: `calc(${MOBILE_HEADER_HEIGHT}px + env(safe-area-inset-top, 0px))`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 10px',
          // FIX: reserve the status bar's height on top, same as the drawer
          // fix — on devices that render edge-to-edge (seen on tablets, and
          // apparently some phones too), the OS status bar (clock/wifi/
          // battery) overlays the app instead of pushing it down, so without
          // this the hamburger button and title sat directly underneath it.
          paddingTop: 'env(safe-area-inset-top, 0px)',
          flexShrink: 0,
          boxSizing: 'border-box',
        }}
      >
        <button
          onClick={() => setDrawerOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 30,
            height: 30,
            borderRadius: 6,
            border: `1px solid ${D.border}`,
            background: 'rgba(255,255,255,0.05)',
            cursor: 'pointer',
            color: D.muted,
            flexShrink: 0,
          }}
        >
          <Menu size={17} />
        </button>

        <h1
          style={{
            fontSize: '0.85rem',
            fontWeight: 700,
            color: D.text,
            margin: 0,
            letterSpacing: '-0.02em',
            textAlign: 'center',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            padding: '0 4px',
          }}
        >
          {getPageTitle()}
        </h1>

        <div style={{ width: 30, flexShrink: 0 }} />
      </div>

      {/* ── DATE STATUS BAR ── */}
      <div
        style={{
          position: 'relative',
          zIndex: 49,
          background: 'linear-gradient(135deg, #ea580c, #c2410c)',
          padding: '2px 10px',
          height: MOBILE_DATE_BAR_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <CalendarDays size={10} color="rgba(255,255,255,0.85)" />
          <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        </div>
        <span style={{ fontSize: 7, fontWeight: 800, background: 'rgba(255,255,255,0.18)', color: '#fff', padding: '1px 6px', borderRadius: 10 }}>TODAY</span>
      </div>

      {/* ── SCROLLABLE CONTENT ── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '8px 10px',
          paddingBottom: `${MOBILE_NAV_HEIGHT + 8}px`,
          WebkitOverflowScrolling: 'touch',
          background: D.bg,
        }}
      >
        {children}
      </div>

      {/* ── FIXED BOTTOM NAV ── */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: D.navBg,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: `1px solid ${D.border}`,
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          height: MOBILE_NAV_HEIGHT,
          zIndex: 60,
          padding: '0 4px',
          // FIX: env(safe-area-inset-bottom) can resolve to 0 on devices/
          // WebView configs where the system navigation bar still visually
          // overlaps this fixed bar — same underlying class of problem as
          // the status-bar/hamburger overlap fixed earlier, just at the
          // bottom instead of the top. max() guarantees at least 12px of
          // real clearance even when the reported inset is 0, so labels
          // can't get visually swallowed by the system bar.
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)',
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0,
                padding: '2px 10px',
                borderRadius: 6,
                textDecoration: 'none',
                color: active ? D.accent : D.muted,
                background: active ? 'rgba(234,88,12,0.12)' : 'transparent',
                transition: 'all 0.15s',
                minWidth: 44,
                minHeight: 36,
                justifyContent: 'center',
              }}
            >
              <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
              <span style={{ fontSize: 8, fontWeight: active ? 700 : 500 }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* ── DRAWER ── */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.60)',
            backdropFilter: 'blur(4px)',
            zIndex: 200,
          }}
        />
      )}

      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 260,
          background: D.surface,
          boxShadow: '4px 0 32px rgba(0,0,0,0.5)',
          zIndex: 210,
          display: 'flex',
          flexDirection: 'column',
          transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.26s cubic-bezier(0.34, 1.2, 0.64, 1)',
          willChange: 'transform',
          // FIX: reserve the device's safe area on both ends of the drawer,
          // same as the bottom tab nav already does — otherwise the header
          // (top) and Sign Out button (bottom) can sit under the status bar
          // / system nav bar and get visually clipped on tablets.
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '12px 14px',
            borderBottom: `1px solid ${D.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 28,
                height: 28,
                background: 'linear-gradient(135deg, #ea580c, #f97316)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Package size={14} color="#fff" />
            </div>
            <span style={{ fontWeight: 800, fontSize: 13, color: D.text }}>
              FMCG<span style={{ color: D.accent }}>Dist</span>
            </span>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              border: `1px solid ${D.border}`,
              background: 'rgba(255,255,255,0.03)',
              cursor: 'pointer',
              color: D.muted,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={13} />
          </button>
        </div>

        {/* User Profile */}
        <div
          style={{
            padding: '10px',
            margin: '6px 10px',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 8,
            border: `1px solid ${D.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ea580c, #f97316)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{initials}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: D.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user.name}
            </div>
            <div style={{ marginTop: 1 }}>
              <span
                style={{
                  display: 'inline-flex',
                  padding: '1px 6px',
                  borderRadius: 10,
                  fontSize: 7,
                  fontWeight: 700,
                  background: roleColor.bg,
                  color: roleColor.text,
                }}
              >
                {user.role}
              </span>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setDrawerOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 6,
                  textDecoration: 'none',
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  color: active ? D.text : D.muted,
                  background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border: `1px solid ${active ? 'rgba(234,88,12,0.20)' : 'transparent'}`,
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: active ? 'rgba(234,88,12,0.15)' : 'rgba(255,255,255,0.04)',
                    color: active ? D.accent : D.muted,
                  }}
                >
                  <Icon size={13} />
                </div>
                <span style={{ flex: 1 }}>{item.label}</span>
                {active && (
                  <div
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      background: D.accent,
                    }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* Sign Out */}
        <div style={{ padding: '8px 10px', borderTop: `1px solid ${D.border}`, flexShrink: 0 }}>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid rgba(239,68,68,0.20)',
              background: 'rgba(239,68,68,0.10)',
              cursor: 'pointer',
              width: '100%',
              fontSize: 11,
              fontWeight: 600,
              color: '#f87171',
              fontFamily: 'inherit',
            }}
          >
            <LogOut size={13} />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}