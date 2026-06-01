// PATH: src/pages/Salesman/SalesmanRoutes.tsx
// UPDATED: Added day closure check to disable delivery button when day not closed

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Route, Users, ChevronRight, RefreshCw,
  Play, Calendar, Info, CheckCircle2, MapPin,
  ShoppingBag, Truck, Package, Lock
} from 'lucide-react';
import { routesApi, routeAssignmentsApi, settlementApi } from '../../api/services';
import type { TodayRouteDto } from '../../types';
import { PageLoader, Alert, EmptyState, Badge, Spinner } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';

// ── Enriched route type (TodayRouteDto + execution state) ────
interface EnrichedRoute extends TodayRouteDto {
  customerCount?: number;
  description?:   string;
  executionStatus?: 'InProgress' | 'Completed' | null;
}

export function SalesmanRoutes() {
  const [routes,   setRoutes]   = useState<EnrichedRoute[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [starting, setStarting] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<'order' | 'delivery' | null>(null);
  const [isDayClosed, setIsDayClosed] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuthStore();

  async function load() {
    setLoading(true);
    setError('');
    try {
      const myRoutes = await routeAssignmentsApi.getMyRoutesToday();

      // Check if day is closed for today
      try {
        const closureStatus = await settlementApi.getStatus();
        setIsDayClosed(closureStatus?.isClosed ?? false);
      } catch {
        setIsDayClosed(false);
      }

      const enriched: EnrichedRoute[] = await Promise.all(
        myRoutes.map(async (r) => {
          let executionStatus: EnrichedRoute['executionStatus'] = null;
          let customerCount: number | undefined;
          let description: string | undefined;

          try {
            const detail = await routesApi.getById(r.routeId);
            customerCount = detail.customers?.length ?? detail.customerCount;
            description   = detail.description;
          } catch {}

          try {
            const exec = await routesApi.getCurrentExecution(r.routeId);
            if (exec?.executionId) {
              executionStatus = exec.status === 'InProgress'  ? 'InProgress'
                              : exec.status === 'Completed'   ? 'Completed'
                              : null;
            }
          } catch {}

          return { ...r, executionStatus, customerCount, description };
        })
      );

      setRoutes(enriched);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load routes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleStartOrderTaking(routeId: string) {
    if (!routeId || routeId === 'undefined' || routeId === 'NaN') {
      setError('Invalid route selected. Please refresh and try again.');
      return;
    }
    setStarting(routeId);
    setActiveMode('order');
    try {
      await routesApi.startOrderTaking(routeId);
      navigate(`/salesman/routes/${routeId}/execute`, { state: { mode: 'order-taking' } });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start order taking');
    } finally {
      setStarting(null);
      setActiveMode(null);
    }
  }

  async function handleStartDelivery(routeId: string) {
    if (!routeId || routeId === 'undefined' || routeId === 'NaN') {
      setError('Invalid route selected. Please refresh and try again.');
      return;
    }
    
    // Check if day is closed before attempting delivery
    if (!isDayClosed) {
      setError('Cannot start delivery. The day has not been closed by Admin yet. Please wait for admin to close today\'s operations.');
      return;
    }
    
    setStarting(routeId);
    setActiveMode('delivery');
    try {
      const execution = await routesApi.getCurrentExecution(routeId).catch(() => null);
      if (execution?.executionId && execution.status === 'InProgress') {
        navigate(`/salesman/routes/${routeId}/execute`, { state: { mode: 'delivery' } });
        return;
      }
      await routesApi.startExecution(routeId);
      navigate(`/salesman/routes/${routeId}/execute`, { state: { mode: 'delivery' } });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start delivery');
    } finally {
      setStarting(null);
      setActiveMode(null);
    }
  }

  function handleViewCustomers(routeId: string) {
    navigate(`/salesman/routes/${routeId}/customers`);
  }

  function handleViewOrders(routeId: string) {
    navigate(`/salesman/routes/${routeId}/orders`);
  }

  const activeRoute    = routes.find(r => r.executionStatus === 'InProgress');
  const overrides      = routes.filter(r => r.isOverride);
  const permanentRoutes = routes.filter(r => !r.isOverride);

  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-slate-800">My Routes</h1>
          <p className="text-base text-slate-500 mt-1">
            {activeRoute ? (
              <span className="text-amber-600 font-semibold">⚠️ Complete your active route before starting another</span>
            ) : routes.length > 0 ? (
              <span>{routes.length} route{routes.length !== 1 ? 's' : ''} assigned for today</span>
            ) : (
              <span>No routes assigned for today. Contact your admin.</span>
            )}
          </p>
          {/* Day closure status indicator */}
          {!isDayClosed && (
            <div className="mt-2 text-sm text-amber-600 bg-amber-50 inline-block px-3 py-1 rounded-full">
              <Lock size={12} className="inline mr-1" /> Day not closed - Delivery disabled
            </div>
          )}
          {isDayClosed && (
            <div className="mt-2 text-sm text-green-600 bg-green-50 inline-block px-3 py-1 rounded-full">
              ✓ Day closed - Delivery available
            </div>
          )}
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="max-w-7xl mx-auto px-5 py-5">
        {routes.length === 0 ? (
          <EmptyState
            title="No routes assigned for today"
            message="Your admin hasn't assigned any routes to you for today. Please contact them."
            icon={Route}
          />
        ) : (
          <div className="space-y-4">
            {routes.map(route => (
              <RouteCard
                key={route.routeId}
                route={route}
                isActive={!!activeRoute && activeRoute.routeId !== route.routeId}
                isInProgress={route.executionStatus === 'InProgress'}
                isCompleted={route.executionStatus === 'Completed'}
                onStartOrderTaking={() => handleStartOrderTaking(route.routeId)}
                onStartDelivery={() => handleStartDelivery(route.routeId)}
                onViewCustomers={() => handleViewCustomers(route.routeId)}
                onViewOrders={() => handleViewOrders(route.routeId)}
                starting={starting === route.routeId}
                activeMode={activeMode}
                isDayClosed={isDayClosed}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Route Card Component with Expandable Section ──
function RouteCard({
  route,
  isActive,
  isInProgress,
  isCompleted,
  onStartOrderTaking,
  onStartDelivery,
  onViewCustomers,
  onViewOrders,
  starting,
  activeMode,
  isDayClosed,
}: {
  route: EnrichedRoute;
  isActive: boolean;
  isInProgress: boolean;
  isCompleted: boolean;
  onStartOrderTaking: () => void;
  onStartDelivery: () => void;
  onViewCustomers: () => void;
  onViewOrders: () => void;
  starting: boolean;
  activeMode: 'order' | 'delivery' | null;
  isDayClosed: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isDisabled = isActive && !isInProgress;
  const isDeliveryDisabled = isDisabled || !isDayClosed;
  const isTodayOverride = route.isOverride;

  return (
    <div className={`bg-white rounded-xl border transition-all ${isInProgress ? 'border-blue-400 shadow-md' : 'border-slate-200 hover:shadow-md'}`}>
      {/* Main row - always visible */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          {/* Left section */}
          <div className="flex items-start gap-3 flex-1">
            {/* Icon */}
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isInProgress ? 'bg-blue-500' : isCompleted ? 'bg-green-500' : 'bg-slate-100'
            }`}>
              {isCompleted ? (
                <CheckCircle2 size={26} color="#fff" />
              ) : isInProgress ? (
                <Truck size={26} color="#fff" />
              ) : (
                <Route size={26} className="text-blue-500" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-800 text-lg">{route.routeName}</h3>
                {isInProgress && <Badge variant="primary">🟢 Active</Badge>}
                {isCompleted && <Badge variant="green">✓ Completed</Badge>}
                {isTodayOverride && !isInProgress && !isCompleted && <Badge variant="amber">📋 Today Only</Badge>}
              </div>

              {route.description && (
                <p className="text-sm text-slate-500 mt-1">{route.description}</p>
              )}

              <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Users size={14} /> {route.customerCount ?? 0} customers
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} /> {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              </div>

              {isTodayOverride && route.notes && !isCompleted && (
                <div className="mt-2 text-sm text-amber-600 bg-amber-50 inline-block px-2 py-1 rounded">
                  📋 {route.notes}
                </div>
              )}

              {/* Disabled warning */}
              {isDisabled && (
                <div className="mt-2 text-sm text-amber-600 bg-amber-50 inline-block px-2 py-1 rounded">
                  ⚠️ Complete your active route first
                </div>
              )}
              
              {/* Day not closed warning for delivery */}
              {!isDayClosed && !isCompleted && (
                <div className="mt-2 text-sm text-amber-600 bg-amber-50 inline-block px-2 py-1 rounded">
                  <Lock size={12} className="inline mr-1" /> Admin must close the day before delivery
                </div>
              )}
            </div>
          </div>

          {/* Action buttons - horizontal layout */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {!isCompleted && (
              <>
                <button
                  onClick={onStartOrderTaking}
                  disabled={starting || isDisabled}
                  className="flex items-center gap-2 px-4 py-2.5 text-base font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 active:scale-95 disabled:opacity-50 transition-all"
                >
                  {starting && activeMode === 'order' ? <Spinner size={16} /> : <ShoppingBag size={16} />}
                  Take Orders
                </button>
                <button
                  onClick={onStartDelivery}
                  disabled={starting || isDeliveryDisabled}
                  className="flex items-center gap-2 px-4 py-2.5 text-base font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all"
                  title={!isDayClosed ? "Day not closed by admin yet" : ""}
                >
                  {starting && activeMode === 'delivery' ? <Spinner size={16} /> : <Truck size={16} />}
                  Start Delivery
                </button>
              </>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
            >
              <ChevronRight size={20} className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded section - only shown when expanded */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 rounded-b-xl">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onViewCustomers}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Users size={14} /> View Customers ({route.customerCount ?? 0})
            </button>
            <button
              onClick={onViewOrders}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Package size={14} /> View Orders
            </button>
            {isTodayOverride && route.permanentSalesmanName && (
              <div className="text-sm text-slate-400 bg-slate-100 px-3 py-2 rounded-lg">
                Regular: {route.permanentSalesmanName}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Completed message - shown outside expanded section */}
      {isCompleted && (
        <div className="border-t border-green-100 px-4 py-2 bg-green-50 rounded-b-xl">
          <div className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle2 size={14} /> Route completed — Great job today! 🎉
          </div>
        </div>
      )}
    </div>
  );
}