// PATH: src/components/layout/MobileLayout.tsx
// UPDATED: Fixed duplicate keys in navigation items

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
    { to: '/salesman/routes', label: 'Routes', icon: MapPin, roles: ['Salesman'] },
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

// Role colors for avatar badge
const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  SuperAdmin: { bg: '#FEF3C7', text: '#92400E' },
  Admin: { bg: '#EFF6FF', text: '#1D4ED8' },
  Salesman: { bg: '#F0FDF4', text: '#15803D' },
  Accounts: { bg: '#FDF4FF', text: '#7E22CE' },
  Warehouse: { bg: '#FFF7ED', text: '#C2410C' },
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
    // Special case for Salesman orders page
    if (to === '/salesman/orders' && location.pathname.includes('/salesman/routes/')) {
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

  const handleLogout = () => {
    logout();
    navigate('/login');
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
            background: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
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
              border: '1px solid #E2E8F0',
              background: 'transparent',
              cursor: 'pointer',
              color: '#64748B',
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
              color: '#1E3A8A',
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
          background: '#FFFFFF',
          borderTop: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '8px 12px',
          paddingBottom: `calc(8px + env(safe-area-inset-bottom, 0px))`,
          zIndex: 60,
          boxShadow: '0 -2px 10px rgba(15,23,42,0.05)',
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
                color: active ? '#2563EB' : '#94A3B8',
                background: active ? '#EFF6FF' : 'transparent',
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
            background: 'rgba(15,23,42,0.40)',
            backdropFilter: 'blur(2px)',
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
          background: '#FFFFFF',
          boxShadow: '4px 0 32px rgba(15,23,42,0.12)',
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
            borderBottom: '1px solid #E2E8F0',
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
                background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)',
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
                color: '#1E3A8A',
                letterSpacing: '-0.03em',
              }}
            >
              FMCG<span style={{ color: '#2563EB' }}>Dist</span>
            </span>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748B',
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
            background: '#EFF6FF',
            borderRadius: 12,
            border: '1px solid rgba(37,99,235,0.12)',
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
              background: 'linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{initials}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: '#1E3A8A',
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
              color: '#94A3B8',
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
                  color: active ? '#2563EB' : '#334155',
                  background: active ? '#EFF6FF' : 'transparent',
                  border: `1px solid ${active ? 'rgba(37,99,235,0.15)' : 'transparent'}`,
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
                    background: active ? 'rgba(37,99,235,0.12)' : '#F8FAFC',
                    color: active ? '#2563EB' : '#64748B',
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
                      background: '#2563EB',
                      flexShrink: 0,
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
            borderTop: '1px solid #E2E8F0',
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
              border: '1px solid #FEE2E2',
              background: '#FEF2F2',
              cursor: 'pointer',
              width: '100%',
              fontSize: 14,
              fontWeight: 600,
              color: '#DC2626',
              transition: 'all 0.15s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = '#FEE2E2';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = '#FEF2F2';
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
                background: '#FEE2E2',
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