import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  ShoppingCart, RefreshCw, CheckCircle, Search,
  Package, Eye, Edit2, Clock, X,
  User, Globe, Lock, AlertTriangle, List, CalendarDays,
  ArrowLeft, RotateCcw,
} from 'lucide-react';
import { ordersApi, routesApi, settlementApi } from '../../api/services';
import type { OrderDto, RouteDto, OrderDetailDto, CustomerOrderHistoryDto } from '../../types';
import { OrderStatus, ORDER_STATUS_LABELS, fmt, fmtDate } from '../../types';
import { PageLoader, Spinner, Alert, Badge, EmptyState } from '../../components/ui';
import { useIsMobile } from '../../hooks/useIsMobile';

// Real time the order was actually taken. orderDate only carries the
// business day (stamped at midnight UTC from the route execution date, so
// it always renders as the same fixed clock time) — createdAt is the real
// submission timestamp. Falls back to orderDate only if createdAt wasn't
// sent by the API.
function orderTimestamp(order: { createdAt?: string | null; orderDate: string }): Date {
  return new Date(order.createdAt || order.orderDate);
}

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
  amberH:   '#d97706',
  amberGlow: 'rgba(245,158,11,0.35)',
  card:     '#1e293b',
};

// ── FIXED: Map status name to numeric enum value ─────────────────────────────
const STATUS_TO_NUMBER: Record<string, number> = {
  'Draft': 1,
  'PendingApproval': 2,
  'Approved': 3,
  'Packed': 4,
  'Closed': 5,
};

const STATUS_LABELS: Record<string, string> = {
  'Draft': 'Draft',
  'PendingApproval': 'Pending Approval',
  'Approved': 'Approved',
  'Packed': 'Packed',
  'Closed': 'Closed',
};

const getStatusLabel = (status: OrderStatus | string): string => {
  return STATUS_LABELS[String(status)] ?? String(status);
};

const STATUS_CONFIG: Record<string, { bg: string; color: string; dot: string }> = {
  'Draft':           { bg: D.surface2, color: D.muted, dot: D.muted },
  'PendingApproval': { bg: D.surface2, color: D.amber, dot: D.amber },
  'Approved':        { bg: D.surface2, color: D.green, dot: D.green },
  'Packed':          { bg: D.surface2, color: D.accent, dot: D.accent },
  'Closed':          { bg: D.surface2, color: D.sub, dot: D.sub },
};

// ── Date input style with white text ──────────────────────────────────────────
const dateInputStyle = {
  padding: '7px 12px',
  borderRadius: 8,
  border: `1px solid ${D.border}`,
  background: D.bg,
  fontSize: 13,
  fontFamily: 'inherit',
  color: D.text,
  outline: 'none',
  cursor: 'pointer',
  colorScheme: 'dark',
};

// ── Select style ──────────────────────────────────────────────────────────────
const selectStyle = {
  padding: '7px 12px',
  borderRadius: 8,
  border: `1px solid ${D.border}`,
  background: D.bg,
  fontSize: 13,
  fontFamily: 'inherit',
  color: D.text,
  outline: 'none',
  cursor: 'pointer',
};

export function AdminOrders() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [orders,         setOrders]         = useState<OrderDto[]>([]);
  const [routes,         setRoutes]         = useState<RouteDto[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');
  const [routeFilter,    setRouteFilter]    = useState('');
  const [statusFilter,   setStatusFilter]   = useState<string>('');
  const [dateFilter,     setDateFilter]     = useState('');
  const [search,         setSearch]         = useState('');
  const [approving,      setApproving]      = useState<string | null>(null);
  const [closing,        setClosing]        = useState<string | null>(null);
  const [expandedOrder,  setExpandedOrder]  = useState<string | null>(null);
  const [previousOrders, setPreviousOrders] = useState<Record<string, CustomerOrderHistoryDto[]>>({});
  const [loadingHistory, setLoadingHistory] = useState<Record<string, boolean>>({});
  const [reviewOrder,    setReviewOrder]    = useState<OrderDetailDto | null>(null);
  const [showModal,      setShowModal]      = useState(false);
  const [loadingReview,  setLoadingReview]  = useState(false);

  // ── Per-route close state ────────────────────────────────────────────────
  const [closingRouteId, setClosingRouteId] = useState<string | null>(null);
  const [closingDay,     setClosingDay]     = useState(false);
  const [closeDayError,  setCloseDayError]  = useState('');
  const [closeDayNotes,  setCloseDayNotes]  = useState('');
  const [closureStatus,  setClosureStatus]  = useState<{ isClosed: boolean; closedAt?: string } | null>(null);

  // ── Reopen Route state ──────────────────────────────────────────────────────
  const [reopeningRouteId, setReopeningRouteId] = useState<string | null>(null);
  const [reopening,        setReopening]        = useState(false);

  // ─── BANNER TOAST STATE ────────────────────────────────────────────────────
  const [bannerToast, setBannerToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ─── Helper function to show banner toast ─────────────────────────────────
  const showBannerToast = (message: string, type: 'success' | 'error' = 'success') => {
    setBannerToast({ message, type });
    setTimeout(() => setBannerToast(null), 3000);
  };

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    // FIX: previously always defaulted to today, even when returning from the
    // Edit page after editing an order for a DIFFERENT date — the calendar
    // would silently jump back to today instead of staying on whatever date
    // was actually selected before. Now prefers the date passed back via
    // navigation state (see handleEdit below / AdminOrderEdit's return
    // navigation), falling back to today only when nothing was passed
    // (i.e. a fresh visit to this page, not a return trip).
    if (!dateFilter) setDateFilter((location.state as any)?.dateFilter || today);
    const now = new Date();
    setCurrentDate(now.toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }));
  }, []);

  async function load() {
    setLoading(true); setError('');
    try {
      const statusNumber = statusFilter ? STATUS_TO_NUMBER[statusFilter] : undefined;

      let allOrders: OrderDto[] = [];
      if (!routeFilter || routeFilter === 'all') {
        const results = await Promise.all(
          routes.map(r => ordersApi.getByRoute(String(r.id), statusNumber).catch(() => []))
        );
        allOrders = results.flat();
      } else {
        allOrders = await ordersApi.getByRoute(routeFilter, statusNumber);
      }
      let filtered = dateFilter ? allOrders.filter(o => o.orderDate?.startsWith(dateFilter)) : allOrders;
      filtered.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
      setOrders(filtered);

      try {
        if (routeFilter && routeFilter !== 'all') {
          const status = await settlementApi.getStatus(dateFilter || today, routeFilter);
          setClosureStatus(status);
        } else {
          setClosureStatus(null);
        }
      } catch {
        // Ignore
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally { setLoading(false); }
  }

  async function loadRoutes() {
    try {
      const r = await routesApi.getAll();
      setRoutes(r);
      // FIX: same reasoning as the date filter above — preserve the route
      // selection passed back from the Edit page, instead of always
      // resetting to "all" on every remount.
      setRouteFilter((location.state as any)?.routeFilter || 'all');
    }
    catch { setError('Failed to load routes'); }
  }

  useEffect(() => { loadRoutes(); }, []);
  useEffect(() => { if (routes.length > 0 || routeFilter === 'all') load(); }, [routeFilter, statusFilter, dateFilter, routes.length]);

  function setStatusFilterQuick(status: string) {
    setStatusFilter(status);
  }

  function clearStatusFilter() {
    setStatusFilter('');
  }

  // ─── handleApprove - ONLY BANNER TOAST ────────────────────────────────────
  async function handleApprove(orderId: string) {
    setApproving(orderId); setError('');
    try {
      await ordersApi.approve(orderId);
      showBannerToast('✅ Order approved successfully', 'success');
      setShowModal(false);
      setReviewOrder(null);
      await load();
    } catch (err: unknown) { 
      setError(err instanceof Error ? err.message : 'Approve failed');
      showBannerToast('❌ Failed to approve order', 'error');
    }
    finally { setApproving(null); }
  }

  // ─── handleClose - ONLY BANNER TOAST ──────────────────────────────────────
  async function handleClose(orderId: string) {
    setClosing(orderId); setError('');
    try {
      await ordersApi.close(orderId);
      showBannerToast('✅ Order closed successfully', 'success');
      setShowModal(false);
      setReviewOrder(null);
      await load();
    } catch (err: unknown) { 
      setError(err instanceof Error ? err.message : 'Close failed');
      showBannerToast('❌ Failed to close order', 'error');
    }
    finally { setClosing(null); }
  }

  // ─── handleCloseRoute - ONLY BANNER TOAST ─────────────────────────────────
  async function handleCloseRoute(routeId: string) {
    const route = routes.find(r => String(r.id) === routeId);
    setClosingDay(true); setCloseDayError('');
    try {
      const result = await settlementApi.closeDay(dateFilter || today, routeId, closeDayNotes || undefined);
      setClosingRouteId(null);
      setCloseDayNotes('');
      
      // ─── BANNER TOAST ───
      showBannerToast(`✅ ${route?.name ?? 'Route'} closed successfully`, 'success');

      setClosureStatus({ isClosed: true, closedAt: new Date().toISOString() });

      const status = await settlementApi.getStatus(dateFilter || today, routeId);
      setClosureStatus(status);

      await load();
    } catch (err: unknown) {
      setCloseDayError(err instanceof Error ? err.message : `Failed to close ${route?.name ?? 'the route'}`);
      showBannerToast(`❌ Failed to close ${route?.name ?? 'route'}`, 'error');
    } finally {
      setClosingDay(false);
    }
  }

  // ─── handleReopenRoute - ONLY BANNER TOAST ────────────────────────────────
  async function handleReopenRoute(routeId: string) {
    const route = routes.find(r => String(r.id) === routeId);
    setReopening(true); setCloseDayError('');
    try {
      const result = await settlementApi.reopenRoute(dateFilter || today, routeId);
      setReopeningRouteId(null);
      
      // ─── BANNER TOAST ───
      showBannerToast(`✅ ${route?.name ?? 'Route'} reopened successfully`, 'success');

      setClosureStatus({ isClosed: false });

      await load();
    } catch (err: unknown) {
      setCloseDayError(err instanceof Error ? err.message : `Failed to reopen ${route?.name ?? 'the route'}`);
      showBannerToast(`❌ Failed to reopen ${route?.name ?? 'route'}`, 'error');
    } finally {
      setReopening(false);
    }
  }

  async function loadPreviousOrders(customerId: string, orderId: string) {
    if (previousOrders[orderId]) { setExpandedOrder(expandedOrder === orderId ? null : orderId); return; }
    setLoadingHistory(p => ({ ...p, [orderId]: true }));
    try {
      const history = await ordersApi.getCustomerHistory(customerId, 3);
      setPreviousOrders(p => ({ ...p, [orderId]: history.filter(h => h.orderId !== orderId) }));
      setExpandedOrder(orderId);
    } catch { /* ignore */ }
    finally { setLoadingHistory(p => ({ ...p, [orderId]: false })); }
  }

  async function handleReview(orderId: string) {
    setLoadingReview(true); setError('');
    try {
      const detail = await ordersApi.getById(orderId);
      if (!detail.items) detail.items = [];
      setReviewOrder(detail); setShowModal(true);
    } catch {
      const o = orders.find(o => String(o.id) === orderId);
      if (o) {
        setReviewOrder({
          ...o, items: o.items || [],
          totalBasePrice: 0, totalSelling: 0, totalVariance: 0, variancePct: 0,
        } as OrderDetailDto);
        setShowModal(true);
      }
    } finally { setLoadingReview(false); }
  }

  function handleEdit(orderId: string, customerId: string) {
    navigate(`/admin/orders/${orderId}/edit`, {
      // FIX: added dateFilter/returnRouteFilter so the Edit page can hand
      // them straight back on its own return navigation — see AdminOrderEdit.tsx.
      state: { orderId, customerId, routeId: routeFilter === 'all' ? undefined : routeFilter, dateFilter, returnRouteFilter: routeFilter }
    });
  }

  const ordersByDate = orders.reduce((acc, o) => {
    const d = o.orderDate?.split('T')[0] || 'Unknown';
    if (!acc[d]) acc[d] = [];
    acc[d].push(o); return acc;
  }, {} as Record<string, OrderDto[]>);

  const filteredByDate = Object.entries(ordersByDate).reduce((acc, [date, dos]) => {
    const f = dos.filter(o => !search || o.customerName?.toLowerCase().includes(search.toLowerCase()));
    if (f.length) acc[date] = f; return acc;
  }, {} as Record<string, OrderDto[]>);

  const counts = {
    total:  orders.length,
    draft:  orders.filter(o => o.status === OrderStatus.Draft).length,
    closed: orders.filter(o => o.status === OrderStatus.Closed).length,
  };

  useEffect(() => {
    if (closureStatus?.isClosed) {
      load();
    }
  }, [closureStatus?.isClosed]);

  // ── Current date state ──
  const [currentDate, setCurrentDate] = useState('');

  const selectedRouteName = routes.find(r => String(r.id) === routeFilter)?.name ?? 'Route';

  return (
    <div style={{ background: D.bg, minHeight: '100vh', paddingBottom: 8 }}>
      {/* ── TOP HEADER ── */}
      <div style={{
        padding: '12px 20px 8px',
        borderBottom: `1px solid ${D.border}`,
        background: D.bg,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link
              to="/admin/reports"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 8,
                background: D.surface,
                border: `1px solid ${D.border}`,
                color: D.muted,
                fontSize: 12,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <ArrowLeft size={14} /> Reports
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: D.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ShoppingCart size={16} color="#FFFFFF" />
              </div>
              <div>
                <h1 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: D.text }}>Orders</h1>
                <p style={{ fontSize: 11, color: D.muted, margin: 0 }}>{orders.length} orders</p>
              </div>
            </div>
          </div>
          <button
            onClick={load}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 12px',
              borderRadius: 8,
              border: `1px solid ${D.border}`,
              background: D.surface,
              color: D.muted,
              fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* ── STATS CARDS + CLOSE / REOPEN ROUTE ── */}
        <div style={{
          display: 'flex',
          gap: 12,
          marginTop: 12,
          alignItems: 'stretch',
          flexWrap: 'wrap'
        }}>
          {/* Stats cards */}
          {[
            { label: 'Total', value: counts.total, color: D.text, filterValue: '' },
            { label: 'Draft', value: counts.draft, color: D.amber, filterValue: 'Draft' },
            { label: 'Closed', value: counts.closed, color: D.green, filterValue: 'Closed' },
          ].map(c => {
            const isActive = statusFilter === c.filterValue;
            return (
              <button
                key={c.label}
                onClick={() => setStatusFilterQuick(c.filterValue)}
                style={{
                  flex: '0 0 auto',
                  minWidth: 90,
                  padding: '8px 16px',
                  borderRadius: 10,
                  background: isActive ? `${c.color}20` : D.surface,
                  border: isActive ? `1px solid ${c.color}66` : `1px solid ${D.border}`,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 10, color: D.sub, fontWeight: 600, display: 'block' }}>
                  {c.label}
                  {isActive && <span style={{ marginLeft: 4, fontSize: 9 }}>✓</span>}
                </span>
                <span style={{ fontSize: 20, fontWeight: 900, color: c.color }}>
                  {c.value}
                </span>
              </button>
            );
          })}

          {/* ── Spacer ── */}
          <div style={{ flex: 1 }} />

          {/* ── Close / Reopen toggle ── */}
          {routeFilter && routeFilter !== 'all' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {!closureStatus?.isClosed ? (
                <button
                  onClick={() => { setClosingRouteId(routeFilter); setCloseDayError(''); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 18px',
                    borderRadius: 10,
                    border: 'none',
                    background: `linear-gradient(135deg, ${D.accent}, ${D.accentH})`,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#fff',
                    fontFamily: 'inherit',
                    boxShadow: `0 2px 12px ${D.accentGlow}`,
                    transition: 'all 0.15s',
                    alignSelf: 'center',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 18px ${D.accentGlow}`;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 2px 12px ${D.accentGlow}`;
                  }}
                >
                  <Lock size={15} />
                  Close {selectedRouteName}
                </button>
              ) : (
                <>
                  <span style={{ fontSize: 12, color: D.sub, fontWeight: 600, alignSelf: 'center' }}>
                    {selectedRouteName} closed at{' '}
                    {closureStatus.closedAt
                      ? new Date(closureStatus.closedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                      : ''}
                  </span>
                  <button
                    onClick={() => { setReopeningRouteId(routeFilter); setCloseDayError(''); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 18px',
                      borderRadius: 10,
                      border: 'none',
                      background: `linear-gradient(135deg, ${D.amber}, ${D.amberH})`,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#fff',
                      fontFamily: 'inherit',
                      boxShadow: `0 2px 12px ${D.amberGlow}`,
                      transition: 'all 0.15s',
                      alignSelf: 'center',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 18px ${D.amberGlow}`;
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 2px 12px ${D.amberGlow}`;
                    }}
                  >
                    <RotateCcw size={15} />
                    Reopen Route
                  </button>
                </>
              )}
            </div>
          ) : (
            <span style={{ fontSize: 12, color: D.sub, alignSelf: 'center', fontStyle: 'italic' }}>
              Select a route above to close or reopen it
            </span>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 20px' }}>
        {/* ─── BANNER TOAST ─── */}
        {bannerToast && (
          <div style={{
            padding: '12px 16px',
            borderRadius: 10,
            marginBottom: 16,
            background: bannerToast.type === 'success' 
              ? 'rgba(34,197,94,0.15)' 
              : 'rgba(239,68,68,0.15)',
            border: bannerToast.type === 'success' 
              ? '1px solid #22c55e' 
              : '1px solid #ef4444',
            color: bannerToast.type === 'success' ? '#22c55e' : '#ef4444',
            fontSize: 14,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span>{bannerToast.message}</span>
            <button
              onClick={() => setBannerToast(null)}
              style={{
                background: 'none',
                border: 'none',
                color: bannerToast.type === 'success' ? '#22c55e' : '#ef4444',
                cursor: 'pointer',
                fontSize: 18,
                fontWeight: 700,
                padding: '0 4px',
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* ─── ERROR (only for other errors) ─── */}
        {error && <Alert variant="error">{error}</Alert>}

        {/* ── Filters ── */}
        <div style={{
          background: D.surface,
          borderRadius: 12,
          border: `1px solid ${D.border}`,
          padding: '10px 14px',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <select
              style={selectStyle}
              value={routeFilter}
              onChange={e => setRouteFilter(e.target.value)}
            >
              <option value="all">🌍 All Routes</option>
              {routes.map(r => <option key={r.id} value={r.id}>📍 {r.name}</option>)}
            </select>

            <input
              type="date"
              style={dateInputStyle}
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
            />

            <div style={{ flex: 1, minWidth: 160, position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: D.sub }} />
              <input
                style={{ ...selectStyle, paddingLeft: 32, width: '100%' }}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search customer..."
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: D.sub, display: 'flex' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Orders List ────────────────────────────────────────────────────── */}
        {loading ? <PageLoader /> : Object.keys(filteredByDate).length === 0 ? (
          <EmptyState title="No orders found" message="No orders match your current filters." icon={ShoppingCart} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {Object.entries(filteredByDate)
              .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
              .map(([date, dateOrders]) => (
                <div key={date}>
                  {/* Date header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 3, height: 16, borderRadius: 2, background: D.accent }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: D.text }}>
                      {new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                    <span style={{ fontSize: 14, color: D.sub, fontWeight: 500 }}>
                      {dateOrders.length} order{dateOrders.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {dateOrders.map(order => {
                      const statusKey = String(order.status);
                      const cfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG['Draft'];
                      const items = order.items ?? [];

                      const isClosable = (statusKey === 'Approved' ||
                                        statusKey === 'Packed') && !order.isLocked;

                      const isPending = statusKey === 'PendingApproval';
                      const isExpanded = expandedOrder === String(order.id);

                      return (
                        <div key={order.id} style={{
                          background: D.surface,
                          borderRadius: 12,
                          border: `1px solid ${isPending ? D.accent : D.border}`,
                          boxShadow: isPending ? `0 2px 10px ${D.accentGlow}` : 'none',
                          overflow: 'hidden',
                          transition: 'border-color 0.15s',
                        }}>
                          {/* Pending approval highlight bar */}
                          {isPending && (
                            <div style={{ height: 3, background: D.accent }} />
                          )}

                          {/* Main row */}
                          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            {/* Avatar */}
                            <div style={{
                              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                              background: D.accent,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <User size={16} style={{ color: '#FFFFFF' }} />
                            </div>

                            {/* Customer info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700, fontSize: 15, color: D.text }}>{order.customerName}</span>

                                {/* Status badge */}
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  padding: '2px 8px', borderRadius: 12,
                                  fontSize: 10, fontWeight: 700,
                                  background: cfg.bg,
                                  color: cfg.color,
                                  border: `1px solid ${cfg.color}33`,
                                }}>
                                  {getStatusLabel(order.status)}
                                </span>

                                {order.isLocked && (
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 3,
                                    padding: '2px 8px', borderRadius: 12,
                                    fontSize: 9, fontWeight: 700,
                                    background: 'rgba(148,163,184,0.12)',
                                    color: D.sub,
                                    border: `1px solid ${D.border}`,
                                  }}>
                                    <Lock size={9} /> Locked
                                  </span>
                                )}

                                {routeFilter === 'all' && order.routeName && (
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 3,
                                    padding: '2px 6px', borderRadius: 4,
                                    background: D.bg,
                                    fontSize: 10, color: D.sub, fontWeight: 600,
                                  }}>
                                    <Globe size={10} />{order.routeName}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 12, color: D.sub, marginTop: 2, fontFamily: 'monospace' }}>
                                #{String(order.id).slice(0, 8)} · {fmtDate(orderTimestamp(order))} at {orderTimestamp(order).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </div>

                              {order.closedAt && (
                                <div style={{ fontSize: 11, color: D.sub, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Lock size={10} />
                                  Closed {new Date(order.closedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at{' '}
                                  {new Date(order.closedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}

                              {/* Items preview */}
                              {items.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                  {items.slice(0, 3).map((item, i) => (
                                    <span key={i} style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 3,
                                      fontSize: 11, padding: '2px 8px', borderRadius: 4,
                                      background: D.bg,
                                      border: `1px solid ${D.border}`,
                                      color: D.muted,
                                      fontWeight: 600,
                                    }}>
                                      <Package size={10} color={D.sub} />
                                      {item.productName} <span style={{ color: D.text, fontWeight: 700 }}>×{item.quantity}</span>
                                    </span>
                                  ))}
                                  {items.length > 3 && (
                                    <span style={{ fontSize: 11, color: D.muted, fontWeight: 600, padding: '2px 4px' }}>
                                      +{items.length - 3} more
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                              <button
                                onClick={() => handleReview(String(order.id))}
                                disabled={loadingReview}
                                style={actionBtn(D.surface, D.muted)}
                              >
                                <Eye size={13} /> Review
                              </button>

                              {/* ── NEW: Edit option for previous/closed orders. handleEdit()
                              already existed in this file but was never wired to a button —
                              this page is admin-only (routed under /admin), matching the
                              "Admin/SuperAdmin only" requirement without needing an extra
                              role check here; the backend enforces this too. ── */}
                              <button
                                onClick={() => handleEdit(String(order.id), String(order.customerId))}
                                style={actionBtn(D.surface, D.muted)}
                              >
                                <Edit2 size={13} /> Edit
                              </button>

                              {isPending && (
                                <button
                                  onClick={() => handleApprove(String(order.id))}
                                  disabled={approving === String(order.id)}
                                  style={actionBtn(D.accent, '#FFFFFF', true)}
                                >
                                  {approving === String(order.id) ? <Spinner size={13} /> : <CheckCircle size={13} />}
                                  Approve
                                </button>
                              )}

                              {isClosable && (
                                <button
                                  onClick={() => handleClose(String(order.id))}
                                  disabled={closing === String(order.id)}
                                  style={actionBtn(D.green, '#FFFFFF', true)}
                                >
                                  {closing === String(order.id) ? <Spinner size={13} /> : <CheckCircle size={13} />}
                                  Close
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Previous orders toggle */}
                          <div style={{
                            borderTop: `1px solid ${D.border}`,
                            padding: '6px 16px',
                            background: D.bg,
                          }}>
                            <button
                              onClick={() => loadPreviousOrders(String(order.customerId), String(order.id))}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                fontSize: 12, color: D.accent, fontWeight: 600,
                                background: 'none', border: 'none', cursor: 'pointer',
                                fontFamily: 'inherit', padding: '4px 0',
                              }}
                            >
                              {loadingHistory[String(order.id)] ? <Spinner size={10} /> : <Clock size={11} />}
                              {isExpanded ? 'Hide previous orders' : 'Show previous orders (last 3)'}
                            </button>

                            {isExpanded && previousOrders[String(order.id)] && (
                              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {previousOrders[String(order.id)].length === 0 ? (
                                  <p style={{ fontSize: 12, color: D.sub, fontStyle: 'italic', margin: 0 }}>No previous orders</p>
                                ) : (
                                  previousOrders[String(order.id)].map((prev, idx) => (
                                    <div key={idx} style={{
                                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                      padding: '6px 10px', borderRadius: 6,
                                      background: D.surface,
                                      border: `1px solid ${D.border}`,
                                    }}>
                                      <div>
                                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: D.muted }}>
                                          {idx === 0 ? '📋 Most recent' : `${idx + 1} orders ago`}
                                        </p>
                                        <p style={{ margin: '1px 0 0', fontSize: 11, color: D.sub }}>
                                          {fmtDate(prev.orderDate)} · {prev.itemCount} items
                                        </p>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* ── Review Modal ── */}
      {showModal && reviewOrder && (
        <div
          onClick={() => setShowModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.70)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: D.surface, borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: `1px solid ${D.border}`, boxShadow: `0 24px 64px rgba(0,0,0,0.5)` }}
          >
            {/* Modal header */}
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${D.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Eye size={14} color={D.accent} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: D.text }}>Review Order</h3>
                  <p style={{ margin: 0, fontSize: 12, color: D.sub }}>#{String(reviewOrder.id).slice(0, 8)}</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${D.border}`, background: D.bg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={13} color={D.muted} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '14px 18px', overflowY: 'auto', flex: 1 }}>
              <div style={{
                padding: '10px 12px', borderRadius: 10,
                background: D.bg,
                border: `1px solid ${D.border}`,
                marginBottom: 12,
              }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: D.text }}>{reviewOrder.customerName}</div>
                <div style={{ fontSize: 12, color: D.sub, marginTop: 2 }}>{fmtDate(reviewOrder.orderDate)}</div>
                {reviewOrder.closedAt && (
                  <div style={{ fontSize: 11, color: D.sub, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Lock size={10} /> Closed {fmtDate(reviewOrder.closedAt)}
                  </div>
                )}
                <div style={{ marginTop: 6 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    padding: '2px 8px', borderRadius: 12,
                    fontSize: 10, fontWeight: 700,
                    background: D.bg,
                    color: D.muted,
                    border: `1px solid ${D.border}`,
                  }}>
                    {getStatusLabel(reviewOrder.status)}
                  </span>
                </div>
              </div>

              <h4 style={{ fontSize: 12, fontWeight: 700, color: D.sub, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>
                Items ({reviewOrder.items?.length ?? 0})
              </h4>
              {reviewOrder.items && reviewOrder.items.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto', marginBottom: 12 }}>
                  {reviewOrder.items.map((item, idx) => (
                    <div key={idx} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 10px', borderRadius: 8,
                      background: D.bg,
                      border: `1px solid ${D.border}`,
                    }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: D.text }}>{item.productName}</p>
                        <p style={{ margin: '1px 0 0', fontSize: 12, color: D.sub }}>
                          {item.quantity} {item.unitSymbol || 'unit'} × {fmt(item.sellingPrice)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px 0', marginBottom: 12 }}>
                  <List size={24} style={{ color: D.border, marginBottom: 4 }} />
                  <p style={{ fontSize: 13, color: D.sub, margin: 0 }}>No items</p>
                </div>
              )}

              <div style={{ borderTop: `1px solid ${D.border}`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: D.sub }}>Items</span>
                  <span style={{ fontWeight: 600, color: D.text }}>{reviewOrder.items?.length ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: D.sub }}>Units</span>
                  <span style={{ fontWeight: 600, color: D.text }}>{reviewOrder.totalQuantity ?? 0}</span>
                </div>
              </div>

              {reviewOrder.remarks && (
                <div style={{
                  marginTop: 10,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'rgba(245,158,11,0.08)',
                  border: `1px solid rgba(245,158,11,0.20)`
                }}>
                  <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: D.amber }}>📝 Retail Items</p>
                  <div style={{
                    fontSize: 12,
                    color: D.muted,
                    lineHeight: 1.6,
                    fontFamily: 'monospace',
                  }}>
                    {reviewOrder.remarks
                      .split(/\n|,/)
                      .map((item: string) => item.trim())
                      .filter((item: string) => item.length > 0)
                      .map((item: string, idx: number, arr: string[]) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8,
                            padding: '2px 0',
                            borderBottom: idx < arr.length - 1
                              ? `1px solid rgba(245,158,11,0.10)`
                              : 'none',
                          }}
                        >
                          <span style={{
                            fontWeight: 700,
                            color: D.amber,
                            minWidth: 24,
                            flexShrink: 0,
                          }}>
                            {idx + 1}.
                          </span>
                          <span style={{ color: D.text, fontWeight: 500 }}>
                            {item}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Modal footer ── */}
            <div style={{ padding: '12px 18px', borderTop: `1px solid ${D.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {reviewOrder.status === OrderStatus.PendingApproval && (
                <button
                  onClick={() => handleApprove(String(reviewOrder.id))}
                  disabled={approving === String(reviewOrder.id)}
                  style={{ ...actionBtn(D.accent, '#FFFFFF', true), padding: '8px 14px', fontSize: 12, borderRadius: 8 }}
                >
                  {approving === String(reviewOrder.id) ? <Spinner size={13} /> : <CheckCircle size={13} />}
                  Approve
                </button>
              )}

              {(() => {
                const modalStatusKey = String(reviewOrder.status);
                return (modalStatusKey === 'Approved' || modalStatusKey === 'Packed') && !reviewOrder.isLocked ? (
                  <button
                    onClick={() => handleClose(String(reviewOrder.id))}
                    disabled={closing === String(reviewOrder.id)}
                    style={{ ...actionBtn(D.green, '#FFFFFF', true), padding: '8px 14px', fontSize: 12, borderRadius: 8 }}
                  >
                    {closing === String(reviewOrder.id) ? <Spinner size={13} /> : <CheckCircle size={13} />}
                    Close
                  </button>
                ) : null;
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Close Route confirmation modal ── */}
      {closingRouteId && (
        <div
          onClick={() => !closingDay && setClosingRouteId(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.70)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: D.surface, borderRadius: 14, padding: 20, width: '100%', maxWidth: 400, border: `1px solid ${D.border}`, boxShadow: `0 20px 60px rgba(0,0,0,0.5)` }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: D.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Lock size={16} color="#fff" />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 900, color: D.text, margin: 0 }}>
                Close {routes.find(r => String(r.id) === closingRouteId)?.name ?? 'Route'}?
              </h3>
            </div>

            <p style={{ fontSize: 13, color: D.muted, lineHeight: 1.5, fontWeight: 500, margin: '0 0 12px' }}>
              This locks every submitted order for{' '}
              <strong style={{ color: D.text }}>{routes.find(r => String(r.id) === closingRouteId)?.name}</strong>{' '}
              on <strong style={{ color: D.text }}>{dateFilter || today}</strong> and generates its loading sheet.
              Only this route is affected — other routes keep taking orders normally.
              This action cannot be undone.
            </p>

            <label style={{ fontSize: 12, fontWeight: 700, color: D.sub, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>
              Notes (optional)
            </label>
            <textarea
              value={closeDayNotes}
              onChange={e => setCloseDayNotes(e.target.value)}
              placeholder="Remarks for this route's closure"
              rows={2}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 8,
                border: `1px solid ${D.border}`, background: D.bg, fontSize: 13,
                color: D.text, fontFamily: 'inherit', resize: 'vertical',
                marginBottom: 12, boxSizing: 'border-box', outline: 'none',
              }}
            />

            {closeDayError && (
              <div style={{
                marginBottom: 12,
                padding: '12px 14px',
                borderRadius: 10,
                background: 'rgba(239,68,68,0.12)',
                border: `1px solid ${D.red}66`,
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}>
                <AlertTriangle size={17} color={D.red} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 13, color: D.text, lineHeight: 1.5, fontWeight: 500 }}>
                  {closeDayError}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setClosingRouteId(null)}
                disabled={closingDay}
                style={{
                  flex: 1, padding: '10px', borderRadius: 8, border: `1px solid ${D.border}`,
                  background: D.bg, color: D.muted, fontWeight: 700, fontSize: 13,
                  cursor: closingDay ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleCloseRoute(closingRouteId)}
                disabled={closingDay}
                style={{
                  flex: 1, padding: '10px', borderRadius: 8, border: 'none',
                  background: closingDay ? D.border : `linear-gradient(135deg, ${D.accent}, ${D.accentH})`,
                  color: '#fff', fontWeight: 700, fontSize: 13,
                  cursor: closingDay ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  boxShadow: closingDay ? 'none' : `0 2px 12px ${D.accentGlow}`,
                }}
              >
                {closingDay ? <Spinner size={14} /> : <Lock size={14} />}
                {closingDay ? 'Closing…' : 'Close Route'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reopen Route confirmation modal ── */}
      {reopeningRouteId && (
        <div
          onClick={() => !reopening && setReopeningRouteId(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.70)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: D.surface, borderRadius: 14, padding: 20, width: '100%', maxWidth: 400, border: `1px solid ${D.border}`, boxShadow: `0 20px 60px rgba(0,0,0,0.5)` }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: D.amber, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <RotateCcw size={16} color="#fff" />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 900, color: D.text, margin: 0 }}>
                Reopen {routes.find(r => String(r.id) === reopeningRouteId)?.name ?? 'Route'}?
              </h3>
            </div>

            <p style={{ fontSize: 13, color: D.muted, lineHeight: 1.5, fontWeight: 500, margin: '0 0 16px' }}>
              This unlocks orders for this route and puts it back in progress, as if it was never closed.
              It'll be blocked automatically if the salesman already started a new cycle, or if warehouse
              has already started packing.
            </p>

            {closeDayError && (
              <div style={{
                marginBottom: 12,
                padding: '12px 14px',
                borderRadius: 10,
                background: 'rgba(239,68,68,0.12)',
                border: `1px solid ${D.red}66`,
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}>
                <AlertTriangle size={17} color={D.red} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 13, color: D.text, lineHeight: 1.5, fontWeight: 500 }}>
                  {closeDayError}
                </div>
              </div>
            )}


            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setReopeningRouteId(null)}
                disabled={reopening}
                style={{
                  flex: 1, padding: '10px', borderRadius: 8, border: `1px solid ${D.border}`,
                  background: D.bg, color: D.muted, fontWeight: 700, fontSize: 13,
                  cursor: reopening ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleReopenRoute(reopeningRouteId)}
                disabled={reopening}
                style={{
                  flex: 1, padding: '10px', borderRadius: 8, border: 'none',
                  background: reopening ? D.border : `linear-gradient(135deg, ${D.amber}, ${D.amberH})`,
                  color: '#fff', fontWeight: 700, fontSize: 13,
                  cursor: reopening ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  boxShadow: reopening ? 'none' : `0 2px 12px ${D.amberGlow}`,
                }}
              >
                {reopening ? <Spinner size={14} /> : <RotateCcw size={14} />}
                {reopening ? 'Reopening…' : 'Reopen Route'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function actionBtn(bg: string, color: string, strong = false): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    borderRadius: 6,
    border: `1px solid ${bg === D.accent || bg === D.green ? 'transparent' : D.border}`,
    background: bg,
    color: color,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: strong ? 800 : 700,
    transition: 'all 0.12s',
  };
}