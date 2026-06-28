// PATH: src/components/layout/MobileLayout.tsx
// UPDATED: Dark theme to match Navbar.tsx and the rest of the app

import React, { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, getRoleHome } from '../../store/authStore';

import {
  MapPin,
  ShoppingCart,
  TrendingUp,
  LayoutDashboard,
  Truck,
  FileText,
  Calculator,
  Users,
  Package,
  Home,
  LogOut,
  Menu,
  X,
  User,
  Settings,
  ChevronRight,
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
    { to: '/salesman/incentives', label: 'Incentives', icon: TrendingUp, roles: ['Salesman'] },
  ],
  Warehouse: [
    { to: '/warehouse/loading', label: 'Loading', icon: Truck, roles: ['Warehouse'] },
    { to: '/warehouse/dispatch', label: 'Dispatch', icon: Package, roles: ['Warehouse'] },
    { to: '/warehouse/dashboard', label: 'Reports', icon: FileText, roles: ['Warehouse'] },
  ],
  Accounts: [
    { to: '/accounts/settlement', label: 'Settlement', icon: Calculator, roles: ['Accounts'] },
    { to: '/accounts/reports', label: 'Reports', icon: FileText, roles: ['Accounts'] },
    { to: '/accounts/settlement', label: 'Outstanding', icon: Users, roles: ['Accounts'] },
  ],
  Admin: [
    { to: '/admin/dashboard', label: 'Home', icon: LayoutDashboard, roles: ['Admin', 'SuperAdmin'] },
    { to: '/admin/routes', label: 'Routes', icon: MapPin, roles: ['Admin', 'SuperAdmin'] },
    { to: '/admin/orders', label: 'Orders', icon: ShoppingCart, roles: ['Admin', 'SuperAdmin'] },
    { to: '/admin/settlement', label: 'Settle', icon: Calculator, roles: ['Admin', 'SuperAdmin'] },
  ],
  SuperAdmin: [
    { to: '/admin/dashboard', label: 'Home', icon: LayoutDashboard, roles: ['SuperAdmin'] },
    { to: '/admin/routes', label: 'Routes', icon: MapPin, roles: ['SuperAdmin'] },
    { to: '/admin/orders', label: 'Orders', icon: ShoppingCart, roles: ['SuperAdmin'] },
    { to: '/admin/settlement', label: 'Settle', icon: Calculator, roles: ['SuperAdmin'] },
  ],
};

// Pages that have their OWN fixed bottom action bar — hide mobile top bar
const FULL_SCREEN_PAGES = [
  '/order/',
  '/execute',
  '/review-orders',
];

// Nav height constant
export const MOBILE_NAV_HEIGHT = 70;

// ── Dark theme tokens (matching Navbar.tsx) ────────────────────────────────
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

// Role colors for avatar badge — dark theme variants (matching Navbar.tsx)
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

  // Inject CSS variable so pages can reference nav height
  useEffect(() => {
    document.documentElement.style.setProperty('--mobile-nav-h', `${MOBILE_NAV_HEIGHT}px`);
    return () => {
      document.documentElement.style.removeProperty('--mobile-nav-h');
    };
  }, []);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when drawer open
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
    // Any sub-page of a route (execute / order entry / review-orders / customers)
    // belongs to the "My Routes" tab, not "Orders"
    if (to === '/salesman/routes' && location.pathname.includes('/salesman/routes')) {
      return true;
    }
    // Handle dashboard routes
    if (to === '/admin/dashboard' && location.pathname === '/admin/dashboard') return true;
    if (to === '/accounts/settlement' && location.pathname.includes('/accounts/settlement')) return true;
    if (to === '/warehouse/loading' && location.pathname.includes('/warehouse/loading')) return true;
    if (to === '/warehouse/dispatch' && location.pathname.includes('/warehouse/dispatch')) return true;
    // Exact match for all others
    return location.pathname === to;
  };

  const isFullScreen = FULL_SCREEN_PAGES.some(p => location.pathname.includes(p));

  const getPageTitle = () => {
    if (title) return title;
    const path = location.pathname;
    if (path.includes('/salesman/routes') && path.includes('/order/')) return 'Order Entry';
    if (path.includes('/salesman/routes') && path.includes('/execute')) return 'Route Execution';
    if (path.includes('/salesman/routes') && path.includes('/review')) return 'Review Orders';
    if (path.includes('/salesman/routes')) return 'My Routes';
    if (path.includes('/salesman/orders')) return 'My Orders';
    if (path.includes('/salesman/incentives')) return 'My Incentives';
    if (path.includes('/warehouse/loading')) return 'Loading Sheet';
    if (path.includes('/warehouse/dispatch')) return 'Pack Orders';
    if (path.includes('/warehouse/dashboard')) return 'Dashboard';
    if (path.includes('/accounts/settlement')) return 'Settlement';
    if (path.includes('/accounts/reports')) return 'Reports';
    if (path.includes('/admin/dashboard')) return 'Dashboard';
    if (path.includes('/admin/routes')) return 'Routes';
    if (path.includes('/admin/orders') && path.includes('/edit')) return 'Edit Order';
    if (path.includes('/admin/orders')) return 'Orders';
    if (path.includes('/admin/settlement')) return 'Settlement';
    if (path.includes('/admin/products')) return 'Products';
    if (path.includes('/admin/customers')) return 'Customers';
    if (path.includes('/admin/users')) return 'Users';
    if (path.includes('/admin/reports')) return 'Reports';
    if (path.includes('/admin/analytics')) return 'Analytics';
    if (path.includes('/admin/incentives')) return 'Incentives';
    if (path.includes('/admin/settings')) return 'Settings';
    if (path.includes('/admin/assignments')) return 'Assignments';
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
      className="mobile-layout"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        paddingBottom: `calc(${MOBILE_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      {/* Top App Bar - hidden on full-screen pages */}
      {!isFullScreen && (
        <div
          className="mobile-top-bar"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 40,
            background: D.navBg,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: `1px solid ${D.border}`,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Hamburger Menu Button */}
          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: 10,
              border: `1px solid ${D.border}`,
              background: 'rgba(255,255,255,0.03)',
              cursor: 'pointer',
              color: D.muted,
              flexShrink: 0,
            }}
          >
            <Menu size={20} />
          </button>

          {/* Page Title */}
          <h1
            style={{
              fontSize: '1.1rem',
              fontWeight: 800,
              color: D.text,
              margin: 0,
              letterSpacing: '-0.03em',
              textAlign: 'center',
              flex: 1,
            }}
          >
            {getPageTitle()}
          </h1>

          {/* Spacer for alignment */}
          <div style={{ width: 40, flexShrink: 0 }} />
        </div>
      )}

      {/* Main Content */}
      <div className="mobile-content" style={{ flex: 1 }}>
        {children}
      </div>

      {/* Bottom Navigation Bar */}
      <div
        className="mobile-bottom-nav"
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
          padding: '8px 12px',
          paddingBottom: `calc(8px + env(safe-area-inset-bottom, 0px))`,
          zIndex: 60,
          boxShadow: '0 -2px 20px rgba(0,0,0,0.4)',
        }}
      >
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          // Use unique key combining to and index to avoid duplicates
          const uniqueKey = `${item.to}-${index}`;
          return (
            <Link
              key={uniqueKey}
              to={item.to}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                padding: '4px 12px',
                borderRadius: 10,
                textDecoration: 'none',
                color: active ? D.accent : D.muted,
                background: active ? 'rgba(234,88,12,0.12)' : 'transparent',
                transition: 'all 0.15s',
                minWidth: 56,
                minHeight: 44,
                justifyContent: 'center',
              }}
            >
              <Icon size={20} />
              <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, letterSpacing: '-0.01em' }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Drawer Overlay */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.60)',
            backdropFilter: 'blur(4px)',
            zIndex: 200,
            animation: 'fade-in 0.18s ease',
          }}
        />
      )}

      {/* Slide-out Drawer Menu */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 280,
          background: D.surface,
          boxShadow: '4px 0 32px rgba(0,0,0,0.5)',
          zIndex: 210,
          display: 'flex',
          flexDirection: 'column',
          transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.26s cubic-bezier(0.34, 1.2, 0.64, 1)',
          willChange: 'transform',
        }}
      >
        {/* Drawer Header with Close Button */}
        <div
          style={{
            padding: '20px 16px 16px',
            borderBottom: `1px solid ${D.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 36,
                height: 36,
                background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Package size={18} color="#fff" strokeWidth={2.2} />
            </div>
            <span
              style={{
                fontWeight: 800,
                fontSize: 16,
                color: D.text,
                letterSpacing: '-0.03em',
              }}
            >
              FMCG<span style={{ color: D.accent }}>Dist</span>
            </span>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: `1px solid ${D.border}`,
              background: 'rgba(255,255,255,0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: D.muted,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* User Profile Section */}
        <div
          style={{
            padding: '16px',
            margin: '12px 16px',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 12,
            border: `1px solid ${D.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 10px rgba(234,88,12,0.25)',
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{initials}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: D.text,
                letterSpacing: '-0.02em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 8px',
                  borderRadius: 20,
                  fontSize: 10,
                  fontWeight: 700,
                  background: roleColor.bg,
                  color: roleColor.text,
                  letterSpacing: '0.02em',
                }}
              >
                {user.role}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 12px',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: D.sub,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '8px 8px 4px',
            }}
          >
            Menu
          </div>

          {navItems.map((item, index) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            const uniqueKey = `drawer-${item.to}-${index}`;
            return (
              <Link
                key={uniqueKey}
                to={item.to}
                onClick={() => setDrawerOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 10,
                  textDecoration: 'none',
                  fontSize: 14,
                  fontWeight: active ? 700 : 500,
                  marginBottom: 2,
                  color: active ? D.text : D.muted,
                  background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border: `1px solid ${active ? 'rgba(234,88,12,0.20)' : 'transparent'}`,
                  transition: 'all 0.12s',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    background: active ? 'rgba(234,88,12,0.15)' : 'rgba(255,255,255,0.04)',
                    color: active ? D.accent : D.muted,
                  }}
                >
                  <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
                </div>
                <span style={{ flex: 1 }}>{item.label}</span>
                {active && (
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: D.accent,
                      flexShrink: 0,
                      boxShadow: `0 0 8px ${D.accentGlow}`,
                    }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* Footer with Sign Out */}
        <div
          style={{
            padding: '16px',
            borderTop: `1px solid ${D.border}`,
            flexShrink: 0,
          }}
        >
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid rgba(239,68,68,0.20)',
              background: 'rgba(239,68,68,0.10)',
              cursor: 'pointer',
              width: '100%',
              fontSize: 14,
              fontWeight: 600,
              color: '#f87171',
              transition: 'all 0.15s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.18)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.10)';
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(239,68,68,0.15)',
              }}
            >
              <LogOut size={15} />
            </div>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}