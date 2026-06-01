import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore, useIsAdmin, useIsSalesman, useIsAccounts, useIsWarehouse } from './store/authStore';
import { Navbar } from './components/layout/Navbar';
import { PageLoader } from './components/ui';

// ── Auth ────────────────────────────────────────────────────────────────────
const LoginPage    = lazy(() => import('./pages/Auth/LoginPage').then(m => ({ default: m.LoginPage })));
const PinLoginPage = lazy(() => import('./pages/Auth/PinLoginPage'));
const RegisterPage = lazy(() => import('./pages/Auth/RegisterPage').then(m => ({ default: m.RegisterPage })));

// ── Home Hub ───────────────────────────────────────────────────────────────
const HomeHub = lazy(() => import('./pages/Dashboard/HomeHub').then(m => ({ default: m.HomeHub })));
const MainHub = lazy(() => import('./pages/Dashboard/MainHub').then(m => ({ default: m.MainHub })));

// ── Landing Page ───────────────────────────────────────────────────────────
const LandingPage = lazy(() => import('./pages/Landing/LandingPage').then(m => ({ default: m.LandingPage })));

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
const AdminUsers      = lazy(() =>import('./pages/Admin/AdminUsers').then(m => ({ default: m.AdminUsers })));
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
function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token);
  const location = useLocation();
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />;
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

// ── Shell ───────────────────────────────────────────────────────────────────
function AppShell() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Navbar />
      <main style={{ paddingTop: 'var(--nav-h)' }}>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

// ── Root redirect ────────────────────────────────────────────────────────────
function RootRedirect() {
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.token);
  if (!token || !user) return <Navigate to="/login" replace />;
  const role = user.role?.toLowerCase() ?? '';
  if (role === 'superadmin' || role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (role === 'salesman')  return <Navigate to="/salesman/dashboard"  replace />;
  if (role === 'accounts')  return <Navigate to="/accounts/dashboard"  replace />;
  if (role === 'warehouse') return <Navigate to="/warehouse/dashboard" replace />;
  return <Navigate to="/login" replace />;
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
          {/* Public */}
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/pin-login"  element={<PinLoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Public landing — unauthenticated users see this; LandingPage itself redirects logged-in users */}
          <Route path="/" element={<LandingPage />} />

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
              <Route path="routes/edit/:id" element={<EditRoutePage />} />
              <Route path="routes/assign/:id" element={<AssignRoutePage />} />
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