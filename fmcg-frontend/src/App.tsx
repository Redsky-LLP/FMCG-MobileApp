// PATH: src/App.tsx
// FIX: Landing page was flashing to /login because Zustand rehydrates
// localStorage ASYNCHRONOUSLY. For ~50ms on first paint token=null even
// when user IS logged in. RequireAuth saw null → navigated to /login.
//
// Fix: read localStorage SYNCHRONOUSLY with getTokenFromStorage().
// No new dependencies, no hooks needed.

import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore, useIsAdmin, useIsSalesman, useIsAccounts, useIsWarehouse } from './store/authStore';
import { setupProactiveTokenRefresh } from './api/tokenRefresh';
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

// ── Landing Page ───────────────────────────────────────────────────────────
const LandingPage = lazy(() => import('./pages/Landing/LandingPage_live').then(m => ({ default: m.LandingPage })));

// ── Admin ───────────────────────────────────────────────────────────────────
const AdminRoutes     = lazy(() => import('./pages/Admin/AdminRoutes/AdminRoutes').then(m => ({ default: m.AdminRoutes })));
const EditRoutePage = lazy(() => import('./pages/Admin/AdminRoutes/EditRoutePage'));
const AssignRoutePage = lazy(() => import('./pages/Admin/AdminRoutes/AssignRoutePage'));
const OverrideRoutePage = lazy(() => import('./pages/Admin/AdminRoutes/OverrideRoutePage'));
const DeleteRoutePage = lazy(() => import('./pages/Admin/AdminRoutes/DeleteRoutePage'));
const AdminCustomers  = lazy(() => import('./pages/Admin/AdminCustomers').then(m => ({ default: m.AdminCustomers })));
const AdminProducts   = lazy(() => import('./pages/Admin/AdminProducts').then(m => ({ default: m.AdminProducts })));
const AdminOrders     = lazy(() => import('./pages/Admin/AdminOrders').then(m => ({ default: m.AdminOrders })));
const AdminOrderEdit = lazy(() => import('./pages/Admin/AdminOrderEdit').then(m => ({ default: m.AdminOrderEdit })));
const AdminSettlement = lazy(() => import('./pages/Admin/AdminSettlement').then(m => ({ default: m.AdminSettlement })));
const AdminReports    = lazy(() => import('./pages/Admin/AdminReports').then(m => ({ default: m.AdminReports })));
const AdminAnalytics  = lazy(() => import('./pages/Admin/AdminAnalytics').then(m => ({ default: m.AdminAnalytics })));
const AdminIncentives = lazy(() => import('./pages/Admin/AdminIncentives').then(m => ({ default: m.AdminIncentives })));
const AdminUsers      = lazy(() => import('./pages/Admin/AdminUsers').then(m => ({ default: m.AdminUsers })));
const AdminSessionLog = lazy(() => import('./pages/Admin/AdminSessionLog'));
const AdminDailyAssignment = lazy(() =>
  import('./pages/Admin/AdminDailyAssignment').then(m => ({ default: m.AdminDailyAssignment }))
);
// ── NEW: Catalog Config Page ─────────────────────────────────────────────────
const AdminCatalogConfig = lazy(() => 
  import('./pages/Admin/AdminCatalogConfig').then(m => ({ default: m.AdminCatalogConfig }))
);
const WarehouseDashboard = lazy(() =>
  import('./pages/Warehouse/WarehouseDashboard')
);

// ── Salesman ────────────────────────────────────────────────────────────────
const SalesmanRoutes    = lazy(() => import('./pages/Salesman/SalesmanRoutes').then(m => ({ default: m.SalesmanRoutes })));
const SalesmanOrders    = lazy(() => import('./pages/Salesman/SalesmanOrders'));
const OrderEntry = lazy(() => import('./pages/Salesman/OrderEntry/OrderEntry'));
// ReviewOrdersPage removed — submit-all now happens directly on the execute page
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
    return <Navigate to="/pin-login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

function RequireRole({ allowed, children }: { allowed: string[]; children: React.ReactNode }) {
  const user = useAuthStore(s => s.user);
  if (!user) return <Navigate to="/pin-login" replace />;
  const role = user.role?.toLowerCase() ?? '';
  const ok = allowed.some(r => r.toLowerCase() === role);
  if (!ok) return <Navigate to="/unauthorized" replace />;
  return <>{children}</>;
}

// ── "/" route — RootRoute ────────────────────────────────────────────────────
function RootRoute() {
  const stored = getStoredAuth();

  if (stored?.token && stored?.role) {
    const role = stored.role.toLowerCase();
    if (role === 'superadmin' || role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    if (role === 'salesman') return <Navigate to="/salesman/routes" replace />;
    if (role === 'accounts') return <Navigate to="/accounts/settlement" replace />;
    if (role === 'warehouse') return <Navigate to="/warehouse/loading" replace />;
  }

  // Not logged in — go straight to PIN login (salesman-first design)
  return <Navigate to="/pin-login" replace />;
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
        <a href="/pin-login" className="btn btn-primary">Go to Login</a>  {/* ← Changed to pin-login */}
      </div>
    </div>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  useEffect(() => {
    // Checks token expiry whenever the tab/app becomes visible again, and
    // refreshes ahead of time — this is what avoids the "first tap after
    // reopening the app shows a brief error" flicker for field salesmen.
    setupProactiveTokenRefresh();
  }, []);

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public auth pages */}
          <Route path="/login"        element={<LoginPage />} />
          <Route path="/pin-login"    element={<PinLoginPage />} />
          <Route path="/register"     element={<RegisterPage />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Root: redirects to PIN login for guests, redirects logged-in users to their dashboard */}
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
              <Route path="routes/delete/:id"   element={<DeleteRoutePage />} />
              <Route path="assignments" element={<AdminDailyAssignment />} />
              <Route path="customers"  element={<AdminCustomers />} />
              <Route path="products"   element={<AdminProducts />} />
              <Route path="orders"     element={<AdminOrders />} />
              <Route path="orders/:orderId/edit" element={<AdminOrderEdit />} />
              <Route path="settlement" element={<AdminSettlement />} />
              <Route path="reports"    element={<AdminReports />} />
              <Route path="analytics"  element={<AdminAnalytics />} />
              <Route path="incentives" element={<AdminIncentives />} />
              <Route path="users"        element={<AdminUsers />} />
              <Route path="session-log"  element={<AdminSessionLog />} />
              {/* ── NEW: Catalog Config Route ── */}
              <Route path="catalog"     element={<AdminCatalogConfig />} />
            </Route>

            {/* ── Salesman ── */}
            <Route
              path="/salesman"
              element={<RequireRole allowed={['Salesman', 'Admin', 'SuperAdmin']}><Outlet /></RequireRole>}
            >
              <Route index element={<Navigate to="routes" replace />} />
              {/* "dashboard" kept as an alias for old links/bookmarks — the */}
              {/* SalesmanDashboard.tsx page was merged into SalesmanRoutes  */}
              {/* (it used a legacy /start endpoint that caused mismatched   */}
              {/* execution modes — see SalesmanRoutes.tsx for the single   */}
              {/* canonical "My Routes" flow). */}
              <Route path="dashboard" element={<Navigate to="/salesman/routes" replace />} />
              <Route path="routes" element={<SalesmanRoutes />} />
              <Route path="routes/:routeId/execute" element={<RouteExecution />} />
              <Route path="routes/:routeId/orders" element={<SalesmanOrders />} />
              <Route path="routes/:routeId/order/:customerId" element={<OrderEntry />} />
              {/* review-orders route removed — submit happens on execute page */}
              <Route path="routes/:routeId/customers" element={<SalesmanCustomers />} />
              <Route path="incentives" element={<SalesmanIncentives />} />
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