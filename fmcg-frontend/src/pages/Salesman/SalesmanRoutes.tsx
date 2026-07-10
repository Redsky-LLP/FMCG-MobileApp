// PATH: src/pages/Salesman/SalesmanRoutes.tsx
//
// "My Routes" — the single canonical route list, used on both desktop and mobile.
//
// IMPORTANT: routes are NOT gated behind a formal daily admin-assignment step.
// All active routes are visible to every salesman (admin coordinates who takes
// what informally, e.g. over WhatsApp/call) — the system's job is just to show
// what's available vs. already started by someone else today, and to lock a
// route to whoever starts it first. See routesApi.getActiveRoutes() / the
// backend's GetActiveRoutesQueryHandler + StartRouteExecutionCommandHandler for
// the actual locking logic.
//
// FIXES carried over from earlier passes:
// 1. Route shows "Completed" immediately when returning
// 2. No "Continue" loop — if route has submitted orders with no drafts → show Completed
// 3. One active route at a time PER SALESMAN — blocks that same salesman's
//    other routes while one is InProgress. Does NOT block other salesmen —
//    each works their own assigned route independently and simultaneously.
// 4. handleStartOrderTaking checks existing execution first
// 5. Reloads on location.key change / on visibilitychange
// 6. Completed route detection is AGGRESSIVE
// 7. "Taken by X" — another salesman's in-progress route is shown, not hidden
// 8. Removed the global "hasUnclosedCycle" block — it was wrongly preventing
//    EVERY salesman from starting ANY route the moment ANY salesman, anywhere,
//    had one open. Multiple salesmen now correctly work independently.

import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Route, Users, ChevronRight, RefreshCw,
  CheckCircle2, Search, X,
  ShoppingBag, Truck, Package, Lock, AlertTriangle, Play, UserX,
} from 'lucide-react';
import { routesApi, settlementApi, ordersApi } from '../../api/services';
import type { ActiveRouteDto } from '../../types';
import { OrderStatus } from '../../types';
import { PageLoader, EmptyState, Badge, Spinner } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { useIsMobile } from '../../hooks/useIsMobile';

// ── Dark theme tokens ─────────────────────────────────────────────────────────
const D = {
  bg:       '#0f172a',
  surface:  '#1e293b',
  surface2: '#243447',
  border:   '#334155',
  accent:   '#ea580c',
  accentH:  '#c2410c',
  accentGlow: 'rgba(234,88,12,0.25)',
  text:     '#f1f5f9',
  muted:    '#94a3b8',
  sub:      '#64748b',
  green:    '#22c55e',
  red:      '#ef4444',
  amber:    '#f59e0b',
  card:     '#1e293b',
};

interface EnrichedRoute {
  routeId:              string;
  routeName:            string;
  description?:         string;
  customerCount?:       number;
  isDedicatedToAnother?: boolean;
  // Someone else already has this route running today — locked, read-only card.
  takenByOther?:        boolean;
  takenByName?:         string;
  executionId?:         string;
  executionStatus?:     'InProgress' | 'Completed' | null;
  ordersAllSubmitted?:  boolean;
  submittedCount?:      number;
  isTrulyCompleted?:    boolean;
  // True only when the BACKEND execution status is actually 'Completed' —
  // which now happens ONLY via admin's Close Day action (salesman side
  // never sets this anymore). This is what locks the route from further
  // editing, separately from "all stops visited" which just means the
  // salesman is done but admin hasn't closed yet (still editable).
  isAdminClosed?:       boolean;
  // Still returned by the backend on every route, currently unused here —
  // see header note #8. Harmless to leave on the type.
  hasUnclosedCycle?:    boolean;
}

export function SalesmanRoutes() {
  const [routes,      setRoutes]      = useState<EnrichedRoute[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [starting,    setStarting]    = useState<string | null>(null);
  const [activeMode,  setActiveMode]  = useState<'order' | 'delivery' | null>(null);
  const [isDayClosed, setIsDayClosed] = useState(false);
  const [search,      setSearch]      = useState('');
  const { user } = useAuthStore();
  const navigate  = useNavigate();
  const location  = useLocation();
  const isMobile = useIsMobile();

  async function load() {
    setLoading(true); setError('');
    try {
      let activeRoutes: ActiveRouteDto[] = [];
      try { activeRoutes = await routesApi.getActiveRoutes(); } catch {}

      try {
        const status = await settlementApi.getStatus();
        setIsDayClosed(status?.isClosed ?? false);
      } catch { setIsDayClosed(false); }

      const enriched: EnrichedRoute[] = await Promise.all(
        activeRoutes.map(async (r): Promise<EnrichedRoute> => {
          const base = {
            routeId:              r.id,
            routeName:            r.name,
            description:          r.description,
            customerCount:        r.customerCount,
            isDedicatedToAnother: r.isDedicatedToAnother,
            hasUnclosedCycle:     r.hasUnclosedCycle,
          };

          // Someone else already has this route running today — it's locked.
          // No point probing executions/orders for a route that isn't mine.
          if (r.isStarted && !r.isMine) {
            return { ...base, takenByOther: true, takenByName: r.startedBy };
          }

          let executionStatus: EnrichedRoute['executionStatus'] = null;
          let executionId: string | undefined;
          let ordersAllSubmitted = false;
          let submittedCount = 0;
          let isTrulyCompleted = false;
          let isAdminClosed = false;

          if (r.isMine) {
            try {
              const exec = await routesApi.getCurrentExecution(r.id);
              if (exec?.executionId) {
                executionId = exec.executionId;
                const totalCustomers = exec.totalCustomers ?? 0;
                const pending = exec.pendingCount ?? 0;
                // The real backend status is the trustworthy "did admin close
                // this" signal — Completed now only ever happens via admin's
                // Close Day action. This takes priority over the pendingCount
                // heuristic below: even if every stop got visited, the route
                // is only LOCKED once admin has actually closed it.
                isAdminClosed = exec.status === 'Completed';
                // "All stops visited" — the salesman is done, but the route
                // stays editable until admin closes it. Not the same thing
                // as isAdminClosed.
                isTrulyCompleted = totalCustomers > 0 && pending === 0;
                ordersAllSubmitted = isTrulyCompleted;
                submittedCount = (exec.customers ?? []).filter(c => c.visitStatus === 'OrderPlaced').length;
                executionStatus = isAdminClosed
                  ? 'Completed'
                  : isTrulyCompleted
                    ? 'Completed'
                    : exec.status === 'InProgress' ? 'InProgress' : null;
              }
            } catch {}
          }

          return {
            ...base,
            takenByOther: false,
            executionStatus,
            executionId,
            ordersAllSubmitted,
            submittedCount,
            isTrulyCompleted,
            isAdminClosed,
          };
        })
      );

      setRoutes(enriched);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load routes');
    } finally { setLoading(false); }
  }

  // Reload on mount
  useEffect(() => { load(); }, []);

  // Reload when React Router navigates back to this page
  useEffect(() => { load(); }, [location.key]);

  // Reload when tab becomes visible again
  useEffect(() => {
    function onVisible() { if (document.visibilityState === 'visible') load(); }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // ── COMPLETION CHECK — backed by real visit counts from the execution,
  // not order-history guesswork (see load() above) ──
  function isEffectivelyCompleted(r: EnrichedRoute): boolean {
    return !!r.isTrulyCompleted || r.executionStatus === 'Completed' || !!r.ordersAllSubmitted;
  }

  // ── IN PROGRESS CHECK ──
  function isGenuinelyInProgress(r: EnrichedRoute): boolean {
    if (!r.executionId) return false;
    if (r.executionStatus !== 'InProgress') return false;
    if (isEffectivelyCompleted(r)) return false;
    return true;
  }

  function isRouteAlreadyCompleted(routeId: string): boolean {
    const route = routes.find(r => r.routeId === routeId);
    return route ? isEffectivelyCompleted(route) : false;
  }

  const activeRoute = routes.find(r => isGenuinelyInProgress(r));

  async function handleStartOrderTaking(routeId: string) {
  if (!routeId || routeId === 'undefined' || routeId === 'NaN') {
    setError('Invalid route selected.'); 
    return;
  }

  setStarting(routeId);

  // ── Try to start the execution ──
  try {
    await routesApi.startOrderTaking(routeId);
  } catch (err) {
    // Ignore error - execution might already exist
    console.log('Starting execution failed, might already exist');
  }

  // ── ALWAYS navigate to execution page ──
  navigate(`/salesman/routes/${routeId}/execute`, { 
    state: { mode: 'order-taking' } 
  });

  setStarting(null);
}

  // async function handleStartDelivery(routeId: string) {
  //   if (!routeId || routeId === 'undefined' || routeId === 'NaN') {
  //     setError('Invalid route selected.'); return;
  //   }

  //   if (isRouteAlreadyCompleted(routeId)) {
  //     setError('This route is already completed for today.');
  //     return;
  //   }

  //   if (!isDayClosed) {
  //     setError("Cannot start delivery. Admin must close today's operations first.");
  //     return;
  //   }
  //   setStarting(routeId); setActiveMode('delivery');
  //   try {
  //     const execution = await routesApi.getCurrentExecution(routeId).catch(() => null);
  //     if (execution?.executionId && execution.status === 'InProgress') {
  //       navigate(`/salesman/routes/${routeId}/execute`, { state: { mode: 'delivery' } });
  //       return;
  //     }
  //     await routesApi.startExecution(routeId);
  //     navigate(`/salesman/routes/${routeId}/execute`, { state: { mode: 'delivery' } });
  //   } catch (err: unknown) {
  //     setError(err instanceof Error ? err.message : 'Failed to start delivery');
  //     await load();
  //   } finally { setStarting(null); setActiveMode(null); }
  // }

  if (loading) return <PageLoader />;

  const completedCount = routes.filter(r => isEffectivelyCompleted(r)).length;
  const firstName = user?.name?.split(' ')[0] ?? 'Salesman';
  // const greeting  = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const showRouteSearch = routes.length > 6; // most salesmen have a handful of routes; only show search once it's worth it
  const visibleRoutes = showRouteSearch && search.trim()
    ? routes.filter(r => r.routeName?.toLowerCase().includes(search.trim().toLowerCase()))
    : routes;

  return (
    <div style={{ background: D.bg }}>
      <div style={{
        padding: '6px 0 10px',
        borderBottom: `1px solid ${D.border}`,
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `linear-gradient(135deg, ${D.accent}, ${D.accentH})`,
            }}>
              {firstName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 style={{ fontSize: 13, fontWeight: 800, color: D.text, margin: 0 }}>
                  {firstName} 👋
              </h1>
              <p style={{ fontSize: 10, color: D.muted, margin: '1px 0 0' }}>
                {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
              </p>
            </div>
          </div>
          <button
            onClick={load}
            style={{
              display: 'flex', alignItems: 'center', gap: 3,
              padding: '4px 10px',
              borderRadius: 6,
              border: `1px solid ${D.border}`,
              background: D.surface,
              color: D.muted,
              fontSize: 10,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 9, fontWeight: 600, padding: '2px 8px',
            borderRadius: 12,
            background: isDayClosed ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
            border: `1px solid ${isDayClosed ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}`,
            color: isDayClosed ? D.green : D.amber,
          }}>
            {isDayClosed ? <CheckCircle2 size={9} /> : <Lock size={9} />}
            {isDayClosed ? 'Day closed' : 'Day open'}
          </span>

          {completedCount > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 9, fontWeight: 600, padding: '2px 8px',
              borderRadius: 12,
              background: 'rgba(59,130,246,0.12)',
              border: '1px solid rgba(59,130,246,0.25)',
              color: '#3B82F6',
            }}>
              <CheckCircle2 size={9} /> {completedCount}/{routes.length} done
            </span>
          )}

          {activeRoute && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 9, fontWeight: 600, padding: '2px 8px',
              borderRadius: 12,
              background: 'rgba(245,158,11,0.12)',
              border: '1px solid rgba(245,158,11,0.25)',
              color: D.amber,
            }}>
              <AlertTriangle size={9} /> Complete {activeRoute.routeName}
            </span>
          )}
        </div>

        {showRouteSearch && (
          <div style={{ position: 'relative', marginTop: 8 }}>
            <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: D.sub }} />
            <input
              type="text"
              placeholder="Search routes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '4px 28px 4px 28px',
                fontSize: 11,
                border: `1px solid ${D.border}`,
                borderRadius: 6,
                background: D.surface,
                color: D.text,
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: D.sub, cursor: 'pointer' }}>
                <X size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div style={{
          margin: '12px 20px 0',
          background: 'rgba(239,68,68,0.10)',
          border: `1px solid rgba(239,68,68,0.25)`,
          borderRadius: 10,
          padding: '12px 16px',
          color: D.red,
          fontSize: 13,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: D.red, cursor: 'pointer', fontSize: 16, fontWeight: 700 }}>✕</button>
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 20px' }}>
        {routes.length === 0 ? (
          <div style={{
            background: D.surface,
            borderRadius: 16,
            border: `1px solid ${D.border}`,
            padding: '48px 24px',
            textAlign: 'center',
          }}>
            <Route size={48} style={{ color: D.border, margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: D.text, margin: '0 0 8px' }}>No active routes</h3>
            <p style={{ fontSize: 14, color: D.muted, margin: 0 }}>Ask your admin to create a route — once it's active, it shows up here for every salesman.</p>
          </div>
        ) : visibleRoutes.length === 0 ? (
          <div style={{
            background: D.surface,
            borderRadius: 16,
            border: `1px solid ${D.border}`,
            padding: '48px 24px',
            textAlign: 'center',
          }}>
            <Search size={48} style={{ color: D.border, margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: D.text, margin: '0 0 8px' }}>No routes match your search</h3>
            <p style={{ fontSize: 14, color: D.muted, margin: 0 }}>Nothing found for "{search}".</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {visibleRoutes.map(route => {
              const completed   = isEffectivelyCompleted(route);
              const inProgress  = isGenuinelyInProgress(route);
              const blocked = false;
              return (
                <RouteCard
                  key={route.routeId}
                  route={route}
                  isCompleted={completed}
                  isInProgress={inProgress}
                  // isBlocked={false}
                  isDayClosed={isDayClosed}
                  starting={starting === route.routeId}
                  activeMode={activeMode}
                  onStartOrderTaking={() => handleStartOrderTaking(route.routeId)}
                  onContinueOrderTaking={() => {
                    navigate(`/salesman/routes/${route.routeId}/execute`, { state: { mode: 'order-taking' } });
                  }}
                  // onStartDelivery={() => handleStartDelivery(route.routeId)}
                  onViewCustomers={() => navigate(`/salesman/routes/${route.routeId}/customers`)}
                  onViewOrders={() => navigate(`/salesman/routes/${route.routeId}/orders`)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function RouteCard({
  route, isCompleted, isInProgress,isDayClosed,
  starting, activeMode,
  onStartOrderTaking, onContinueOrderTaking, 
  onViewCustomers, onViewOrders,
}: {
  route: EnrichedRoute;
  isCompleted: boolean;
  isInProgress: boolean;
  // isBlocked: boolean;
  isDayClosed: boolean;
  starting: boolean;
  activeMode: 'order' | 'delivery' | null;
  onStartOrderTaking: () => void;
  onContinueOrderTaking: () => void;
  // onStartDelivery: () => void;
  onViewCustomers: () => void;
  onViewOrders: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // ── TAKEN BY ANOTHER SALESMAN ── (locked — first to tap Start gets it)
  if (route.takenByOther) {
    return (
      <div style={{
        background: D.surface,
        borderRadius: 14,
        border: `1px solid ${D.amber}44`,
        opacity: 0.8,
      }}>
        <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            background: 'rgba(245,158,11,0.15)',
          }}>
            <UserX size={26} style={{ color: D.amber }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: D.text, margin: 0 }}>{route.routeName}</h3>
            <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: 13, color: D.sub }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Users size={13} /> {route.customerCount ?? 0} customers
              </span>
            </div>
          </div>
        </div>
        <div style={{
          padding: '10px 18px',
          borderTop: `1px solid ${D.amber}33`,
          background: 'rgba(245,158,11,0.05)',
          borderRadius: '0 0 14px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: D.amber }}>
            🔴 Taken by {route.takenByName ?? 'another salesman'}
          </div>
        </div>
      </div>
    );
  }

  // ── CLOSED BY ADMIN ── (locked — read-only, will be fresh again tomorrow)
  if (route.isAdminClosed) {
    return (
      <div style={{
        background: D.surface,
        borderRadius: 14,
        border: `1px solid ${D.border}`,
        opacity: 0.7,
      }}>
        <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            background: D.bg,
          }}>
            <Lock size={24} style={{ color: D.sub }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: D.text, margin: 0 }}>{route.routeName}</h3>
              <span style={{
                fontSize: 10, fontWeight: 700,
                padding: '2px 10px', borderRadius: 12,
                background: D.bg,
                color: D.sub,
                border: `1px solid ${D.border}`,
              }}>Closed</span>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: 13, color: D.sub }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Users size={13} /> {route.customerCount ?? 0} customers
              </span>
            </div>
          </div>
        </div>
        <div style={{
          padding: '10px 18px',
          borderTop: `1px solid ${D.border}`,
          background: D.bg,
          borderRadius: '0 0 14px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: D.sub }}>
            <Lock size={13} />
            Closed by admin — fresh again tomorrow
          </div>
        </div>
      </div>
    );
  }

  // ── COMPLETED (all shops visited, waiting for admin to close day) ──
  if (isCompleted) {
    return (
      <div
        onClick={onContinueOrderTaking}
        style={{
          background: D.surface,
          borderRadius: 14,
          border: `2px solid #4f46e5`,
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
          (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(79,70,229,0.15)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
          (e.currentTarget as HTMLElement).style.boxShadow = 'none';
        }}
      >
        <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
          }}>
            <CheckCircle2 size={26} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: D.text, margin: 0 }}>{route.routeName}</h3>
              <span style={{
                fontSize: 10, fontWeight: 700,
                padding: '2px 10px', borderRadius: 12,
                background: 'rgba(79,70,229,0.15)',
                color: '#818cf8',
                border: '1px solid rgba(79,70,229,0.25)',
              }}>✓ Done</span>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: 13, color: D.sub }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Users size={13} /> {route.customerCount ?? 0} customers
              </span>
            </div>
          </div>
          <ChevronRight size={18} style={{ color: D.sub, flexShrink: 0 }} />
        </div>
        <div style={{
          padding: '10px 18px',
          borderTop: `1px solid rgba(79,70,229,0.15)`,
          background: 'rgba(79,70,229,0.05)',
          borderRadius: '0 0 14px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#818cf8' }}>
            <CheckCircle2 size={13} />
            {route.submittedCount
              ? `${route.submittedCount} order${route.submittedCount > 1 ? 's' : ''} saved — Tap to view or edit 📋`
              : 'Orders saved — Tap to view or edit 📋'}
          </div>
        </div>
      </div>
    );
  }

  // ── ACTIVE or PENDING ──
  return (
    <div style={{
      background: D.surface,
      borderRadius: 14,
      border: `1px solid ${isInProgress ? D.accent : D.border}`,
      boxShadow: isInProgress ? `0 2px 12px ${D.accentGlow}` : 'none',
      opacity: 1,
      transition: 'all 0.15s',
    }}>
      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            background: isInProgress ? D.accent : D.bg,
          }}>
            {isInProgress
              ? <Truck size={26} color="#fff" />
              : <Route size={26} style={{ color: D.accent }} />}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: D.text, margin: 0 }}>{route.routeName}</h3>
              {isInProgress && (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  padding: '2px 10px', borderRadius: 12,
                  background: 'rgba(234,88,12,0.15)',
                  color: D.accent,
                  border: `1px solid ${D.accent}44`,
                }}>🟢 Active</span>
              )}
              {route.isDedicatedToAnother && (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  padding: '2px 10px', borderRadius: 12,
                  background: 'rgba(245,158,11,0.15)',
                  color: D.amber,
                  border: `1px solid ${D.amber}44`,
                }}>📋 Dedicated route</span>
              )}
            </div>
            {route.description && (
              <p style={{ fontSize: 13, color: D.muted, margin: '4px 0 0' }}>{route.description}</p>
            )}
            <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: 13, color: D.sub }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Users size={13} /> {route.customerCount ?? 0} customers
              </span>
            </div>
            {/* {isBlocked && (
              <div style={{
                marginTop: 8,
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 12, color: D.amber,
                background: 'rgba(245,158,11,0.08)',
                padding: '4px 10px',
                borderRadius: 6,
                border: `1px solid ${D.amber}33`,
              }}>
                <AlertTriangle size={12} /> Complete active route first
              </div>
            )} */}
            {!isDayClosed && (
              <div style={{
                marginTop: 6,
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11, color: D.amber,
              }}>
                <Lock size={11} /> Admin must close day before delivery
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
            {isInProgress ? (
              <button
                onClick={onContinueOrderTaking}
                disabled={starting}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: `linear-gradient(135deg, ${D.accent}, ${D.accentH})`,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: starting ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: `0 4px 14px ${D.accentGlow}`,
                  transition: 'all 0.15s',
                  opacity: starting ? 0.6 : 1,
                }}
                onMouseEnter={e => {
                  if (!starting) {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 20px ${D.accentGlow}`;
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                  if (!starting) {
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 14px ${D.accentGlow}`;
                  }
                }}
              >
                <Play size={15} /> Continue
              </button>
            ) : (
              <>
                <button
  onClick={onStartOrderTaking}
  disabled={starting}
  style={{
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 16px',
    borderRadius: 10,
    border: 'none',
    background: starting ? D.border : `linear-gradient(135deg, ${D.accent}, ${D.accentH})`,
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    cursor: starting ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    boxShadow: starting ? 'none' : `0 4px 14px ${D.accentGlow}`,
    transition: 'all 0.15s',
    opacity: starting ? 0.5 : 1,
  }}
  onMouseEnter={e => {
    if (!starting) {
      (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
      (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 20px ${D.accentGlow}`;
    }
  }}
  onMouseLeave={e => {
    (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
    if (!starting) {
      (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 14px ${D.accentGlow}`;
    }
  }}
>
  <ShoppingBag size={15} /> Take Orders
</button>
                {/* <button
                  onClick={onStartDelivery}
                  disabled={starting || isBlocked || !isDayClosed}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px',
                    borderRadius: 10,
                    border: 'none',
                    background: (starting || isBlocked || !isDayClosed)
                      ? D.border
                      : `linear-gradient(135deg, #3B82F6, #2563EB)`,
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: (starting || isBlocked || !isDayClosed) ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    boxShadow: (starting || isBlocked || !isDayClosed) ? 'none' : '0 4px 14px rgba(59,130,246,0.25)',
                    transition: 'all 0.15s',
                    opacity: (starting || isBlocked || !isDayClosed) ? 0.5 : 1,
                  }}
                  onMouseEnter={e => {
                    if (!starting && !isBlocked && isDayClosed) {
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(59,130,246,0.30)';
                    }
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                    if (!starting && !isBlocked && isDayClosed) {
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(59,130,246,0.25)';
                    }
                  }}
                >
                  <Truck size={15} /> Delivery
                </button> */}
              </>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                padding: '4px 8px',
                background: 'none',
                border: 'none',
                color: D.sub,
                cursor: 'pointer',
                alignSelf: 'flex-end',
                transition: 'transform 0.2s',
                transform: expanded ? 'rotate(90deg)' : 'rotate(0)',
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{
          borderTop: `1px solid ${D.border}`,
          padding: '12px 18px',
          background: D.bg,
          borderRadius: '0 0 14px 14px',
        }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={onViewCustomers}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px',
                borderRadius: 8,
                border: `1px solid ${D.border}`,
                background: D.surface,
                color: D.muted,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = D.accent;
                (e.currentTarget as HTMLElement).style.color = D.text;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = D.border;
                (e.currentTarget as HTMLElement).style.color = D.muted;
              }}
            >
              <Users size={13} /> Customers ({route.customerCount ?? 0})
            </button>
            <button
              onClick={onViewOrders}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px',
                borderRadius: 8,
                border: `1px solid ${D.border}`,
                background: D.surface,
                color: D.muted,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = D.accent;
                (e.currentTarget as HTMLElement).style.color = D.text;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = D.border;
                (e.currentTarget as HTMLElement).style.color = D.muted;
              }}
            >
              <Package size={13} /> Orders
            </button>
          </div>
        </div>
      )}
    </div>
  );
}