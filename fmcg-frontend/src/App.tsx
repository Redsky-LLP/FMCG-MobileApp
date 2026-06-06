// PATH: src/App.tsx
// FIX: Landing page was flashing to /login because Zustand rehydrates
// localStorage ASYNCHRONOUSLY. For ~50ms on first paint token=null even
// when user IS logged in. RequireAuth saw null → navigated to /login.
//
// Fix: read localStorage SYNCHRONOUSLY with getTokenFromStorage().
// No new dependencies, no hooks needed.

import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore, useIsAdmin, useIsSalesman, useIsAccounts, useIsWarehouse } from './store/authStore';
import { Navbar } from './components/layout/Navbar';
import { PageLoader } from './components/ui';
import { useIsMobile } from './hooks/useIsMobile';
import { MobileLayout } from './components/layout/MobileLayout';
import PWAInstallPrompt from './components/PWAInstallPrompt';

// ── Synchronous auth check ───────────────────────────────────────────────────
// Reads localStorage directly — same data Zustand persist uses, but synchronously.
// Returns the stored user object, or null if not logged in.
function getStoredAuth(): { token: string; role: string } | null {
  try {
    const raw = localStorage.getItem('fmcg_auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Zustand persist wraps state under { state: { ... } }
    const state = parsed?.state ?? parsed;
    const token = state?.token ?? state?.user?.token;
    const role  = state?.user?.role;
    if (token && role) return { token, role };
    return null;
  } catch {
    return null;
  }
}

// ── Auth ────────────────────────────────────────────────────────────────────
const LoginPage    = lazy(() => import('./pages/Auth/LoginPage').then(m => ({ default: m.LoginPage })));
const PinLoginPage = lazy(() => import('./pages/Auth/PinLoginPage'));
const RegisterPage = lazy(() => import('./pages/Auth/RegisterPage').then(m => ({ default: m.RegisterPage })));

// ── Home Hub ───────────────────────────────────────────────────────────────
const HomeHub = lazy(() => import('./pages/Dashboard/HomeHub').then(m => ({ default: m.HomeHub })));
const MainHub = lazy(() => import('./pages/Dashboard/MainHub').then(m => ({ default: m.MainHub })));

// ── Landing Page ───────────────────────────────────────────────────────────
// The original import was failing (module not found). Use a safe fallback inline
// component to prevent build errors when the module is missing. If the real
// LandingPage component exists at a different path, update this import.
const LandingPage = lazy(() => import('./pages/Landing/LandingPage_live').then(m => ({ default: m.LandingPage })));

// ── Admin ───────────────────────────────────────────────────────────────────
const AdminDashboard  = lazy(() => import('./pages/Admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminRoutes     = lazy(() => import('./pages/Admin/AdminRoutes/AdminRoutes').then(m => ({ default: m.AdminRoutes })));
const EditRoutePage = lazy(() => import('./pages/Admin/AdminRoutes/EditRoutePage'));
const AssignRoutePage = lazy(() => import('./pages/Admin/AdminRoutes/AssignRoutePage'));
const OverrideRoutePage = lazy(() => import('./pages/Admin/AdminRoutes/OverrideRoutePage'));
const AdminCustomers  = lazy(() => import('./pages/Admin/AdminCustomers').then(m => ({ default: m.AdminCustomers })));
const AdminProducts   = lazy(() => import('./pages/Admin/AdminProducts').then(m => ({ default: m.AdminProducts })));
const AdminOrders     = lazy(() => import('./pages/Admin/AdminOrders').then(m => ({ default: m.AdminOrders })));
const AdminOrderEdit = lazy(() => import('./pages/Admin/AdminOrderEdit').then(m => ({ default: m.AdminOrderEdit })));
const AdminSettlement = lazy(() => import('./pages/Admin/AdminSettlement').then(m => ({ default: m.AdminSettlement })));
const AdminReports    = lazy(() => import('./pages/Admin/AdminReports').then(m => ({ default: m.AdminReports })));
const AdminAnalytics  = lazy(() => import('./pages/Admin/AdminAnalytics').then(m => ({ default: m.AdminAnalytics })));
const AdminIncentives = lazy(() => import('./pages/Admin/AdminIncentives').then(m => ({ default: m.AdminIncentives })));
const AdminSettings   = lazy(() => import('./pages/Admin/AdminSettings').then(m => ({ default: m.AdminSettings })));
const AdminUsers      = lazy(() => import('./pages/Admin/AdminUsers').then(m => ({ default: m.AdminUsers })));
const AdminDailyAssignment = lazy(() =>
  import('./pages/Admin/AdminDailyAssignment').then(m => ({ default: m.AdminDailyAssignment }))
);
const WarehouseDashboard = lazy(() =>
  import('./pages/Warehouse/WarehouseDashboard')
);

// ── Salesman ────────────────────────────────────────────────────────────────
const SalesmanRoutes    = lazy(() => import('./pages/Salesman/SalesmanRoutes').then(m => ({ default: m.SalesmanRoutes })));
const SalesmanOrders    = lazy(() => import('./pages/Salesman/SalesmanOrders'));
const OrderEntry = lazy(() => import('./pages/Salesman/OrderEntry/OrderEntry'));
const ReviewOrdersPage = lazy(() => import('./pages/Salesman/ReviewOrdersPage'));
const SalesmanIncentives = lazy(() => import('./pages/Salesman/SalesmanIncentives'));
const RouteExecution    = lazy(() => import('./pages/Salesman/RouteExecution'));
const SalesmanCustomers = lazy(() => import('./pages/Salesman/SalesmanCustomers'));

// ── Accounts ────────────────────────────────────────────────────────────────
const AccountsSettlement = lazy(() => import('./pages/Accounts/AccountsSettlement'));
const AccountsReports    = lazy(() => import('./pages/Accounts/AccountsReports'));

// ── Warehouse ───────────────────────────────────────────────────────────────
const WarehouseLoading = lazy(() => import('./pages/Warehouse/WarehouseLoading'));

// ── Guards ──────────────────────────────────────────────────────────────────

// RequireAuth: uses synchronous localStorage read so there is no race with
// Zustand's async rehydration. If the token is in localStorage, the user
// passes through immediately — no flash redirect to /login.
function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  // First check synchronous localStorage (instant, no async gap)
  const stored = getStoredAuth();
  // Also check Zustand store in case it was set this session without page reload
  const zustandToken = useAuthStore(s => s.token);

  if (!stored?.token && !zustandToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

function RequireRole({ allowed, children }: { allowed: string[]; children: React.ReactNode }) {
  const user = useAuthStore(s => s.user);
  if (!user) return <Navigate to="/login" replace />;
  const role = user.role?.toLowerCase() ?? '';
  const ok = allowed.some(r => r.toLowerCase() === role);
  if (!ok) return <Navigate to="/unauthorized" replace />;
  return <>{children}</>;
}

// ── "/" route — RootRoute ────────────────────────────────────────────────────
// Reads auth state synchronously from localStorage.
// Logged-in user → redirect to their dashboard immediately, zero flash.
// Guest → render the public landing page.
function RootRoute() {
  const stored = getStoredAuth();

  if (stored?.token && stored?.role) {
    const role = stored.role.toLowerCase();
    if (role === 'superadmin' || role === 'admin') return <Navigate to="/admin/dashboard"     replace />;
    if (role === 'salesman')                        return <Navigate to="/salesman/routes"     replace />;
    if (role === 'accounts')                        return <Navigate to="/accounts/settlement" replace />;
    if (role === 'warehouse')                       return <Navigate to="/warehouse/loading"   replace />;
  }

  // Not logged in — show the public marketing page
  return (
    <Suspense fallback={<PageLoader />}>
      <LandingPage />
    </Suspense>
  );
}

// ── Shell ───────────────────────────────────────────────────────────────────
function AppShell() {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="min-h-screen bg-[var(--bg)]">
        <main>
          <Suspense fallback={<PageLoader />}>
            <MobileLayout>
              <Outlet />
            </MobileLayout>
          </Suspense>
        </main>
        {/* PWA install prompt — shows above mobile nav bar */}
        <PWAInstallPrompt variant="default" autoShowDelay={5000} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Navbar />
      <main style={{ paddingTop: 'var(--nav-h)' }}>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      {/* PWA install prompt for desktop */}
      <PWAInstallPrompt variant="default" autoShowDelay={5000} />
    </div>
  );
}

function Unauthorized() {
  const user = useAuthStore(s => s.user);
  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">🚫</div>
        <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-[var(--muted)] text-sm mb-6">
          Your role ({user?.role ?? 'unknown'}) does not have permission to view this page.
        </p>
        <a href="/" className="btn btn-primary">Go to Dashboard</a>
      </div>
    </div>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public auth pages */}
          <Route path="/login"        element={<LoginPage />} />
          <Route path="/pin-login"    element={<PinLoginPage />} />
          <Route path="/register"     element={<RegisterPage />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Root: shows landing page for guests, redirects logged-in users */}
          <Route path="/" element={<RootRoute />} />

          {/* Protected shell */}
          <Route element={<RequireAuth><AppShell /></RequireAuth>}>

            {/* ── Admin / SuperAdmin ── */}
            <Route
              path="/admin"
              element={<RequireRole allowed={['Admin', 'SuperAdmin']}><Outlet /></RequireRole>}
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard"  element={<HomeHub />} />
              <Route path="routes"     element={<AdminRoutes />} />
              <Route path="routes/edit/:id"     element={<EditRoutePage />} />
              <Route path="routes/assign/:id"   element={<AssignRoutePage />} />
              <Route path="routes/override/:id" element={<OverrideRoutePage />} />
              <Route path="assignments" element={<AdminDailyAssignment />} />
              <Route path="customers"  element={<AdminCustomers />} />
              <Route path="products"   element={<AdminProducts />} />
              <Route path="orders"     element={<AdminOrders />} />
              <Route path="orders/:orderId/edit" element={<AdminOrderEdit />} />
              <Route path="settlement" element={<AdminSettlement />} />
              <Route path="reports"    element={<AdminReports />} />
              <Route path="analytics"  element={<AdminAnalytics />} />
              <Route path="incentives" element={<AdminIncentives />} />
              <Route path="settings"   element={<AdminSettings />} />
              <Route path="users"      element={<AdminUsers />} />
            </Route>

            {/* ── Salesman ── */}
            <Route
              path="/salesman"
              element={<RequireRole allowed={['Salesman', 'Admin', 'SuperAdmin']}><Outlet /></RequireRole>}
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard"                                 element={<MainHub />} />
              <Route path="routes"                                    element={<SalesmanRoutes />} />
              <Route path="routes/:routeId/execute"                   element={<RouteExecution />} />
              <Route path="routes/:routeId/orders"                    element={<SalesmanOrders />} />
              <Route path="routes/:routeId/order/:customerId"         element={<OrderEntry />} />
              <Route path="routes/:routeId/review-orders"             element={<ReviewOrdersPage />} />
              <Route path="routes/:routeId/customers"                 element={<SalesmanCustomers />} />
              <Route path="incentives"                                element={<SalesmanIncentives />} />
            </Route>

            {/* ── Accounts ── */}
            <Route
              path="/accounts"
              element={<RequireRole allowed={['Accounts', 'Admin', 'SuperAdmin']}><Outlet /></RequireRole>}
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard"  element={<HomeHub />} />
              <Route path="settlement" element={<AccountsSettlement />} />
              <Route path="reports"    element={<AccountsReports />} />
            </Route>

            {/* ── Warehouse ── */}
            <Route
              path="/warehouse"
              element={<RequireRole allowed={['Warehouse', 'Admin', 'SuperAdmin']}><Outlet /></RequireRole>}
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<HomeHub />} />
              <Route path="loading"   element={<WarehouseLoading />} />
              <Route path="dispatch"  element={<WarehouseDashboard />} />
            </Route>

          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}