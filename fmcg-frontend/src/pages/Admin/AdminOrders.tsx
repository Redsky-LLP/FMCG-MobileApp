// PATH: src/pages/Admin/AdminOrders.tsx
// FIXED: 
//  - Status filter now correctly maps string names to numeric enum values
//  - Status count boxes work as clickable filters
//  - Removed duplicate "Day Closed" button
//  - Date picker has white text on dark background
//  - Day Closed indicator shows the date
// UPDATED: Per-order "Closed [date] at [time]" line, shown once that specific
// order has actually been locked by a Close Day run — distinct from the
// order's own creation date/time, which never changes.
// FIXED: Edit button now respects isLocked AND uses string comparison for status
// FIXED: Close button also respects isLocked

import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShoppingCart, RefreshCw, CheckCircle, Search,
  Package, Eye, Edit2, Clock, X,
  User, Globe, Lock, AlertTriangle, List, CalendarDays,
  ArrowLeft,
} from 'lucide-react';
import { ordersApi, routesApi, settlementApi } from '../../api/services';
import type { OrderDto, RouteDto, OrderDetailDto, CustomerOrderHistoryDto } from '../../types';
import { OrderStatus, ORDER_STATUS_LABELS, fmt, fmtDate } from '../../types';
import { PageLoader, Spinner, Alert, Badge, EmptyState } from '../../components/ui';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useAuthStore } from '../../store/authStore';

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

// ── FIXED: Map status name to numeric enum value ─────────────────────────────
const STATUS_TO_NUMBER: Record<string, number> = {
  'Draft': 1,
  'PendingApproval': 2,
  'Approved': 3,
  'Packed': 4,
  'Closed': 5,
};

// ── Reverse map for display ──────────────────────────────────────────────────
const NUMBER_TO_STATUS: Record<number, string> = {
  1: 'Draft',
  2: 'PendingApproval',
  3: 'Approved',
  4: 'Packed',
  5: 'Closed',
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
  const { user } = useAuthStore();
  const isMobile = useIsMobile();
  const [orders,         setOrders]         = useState<OrderDto[]>([]);
  const [routes,         setRoutes]         = useState<RouteDto[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');
  const [success,        setSuccess]        = useState('');
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
  const [showCloseDayModal, setShowCloseDayModal] = useState(false);
  const [closingDay,     setClosingDay]     = useState(false);
  const [closeDayError,  setCloseDayError]  = useState('');
  const [closeDayNotes,  setCloseDayNotes]  = useState('');
  const [closureStatus,  setClosureStatus]  = useState<{ isClosed: boolean; closedAt?: string } | null>(null);
  const [currentDate,    setCurrentDate]    = useState('');

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!dateFilter) setDateFilter(today);
    const now = new Date();
    setCurrentDate(now.toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }));
  }, []);

  async function load() {
    setLoading(true); setError('');
    try {
      // ── FIXED: Convert status name to numeric enum value ──
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
        const status = await settlementApi.getStatus();
        setClosureStatus(status);
      } catch {
        // Ignore
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally { setLoading(false); }
  }

  async function loadRoutes() {
    try { const r = await routesApi.getAll(); setRoutes(r); setRouteFilter('all'); }
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

  async function handleApprove(orderId: string) {
    setApproving(orderId); setError('');
    try {
      await ordersApi.approve(orderId);
      setSuccess('Order approved!'); setShowModal(false); setReviewOrder(null);
      await load(); setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Approve failed'); }
    finally { setApproving(null); }
  }

  async function handleClose(orderId: string) {
    setClosing(orderId); setError('');
    try {
      await ordersApi.close(orderId);
      setSuccess('Order closed!'); setShowModal(false); setReviewOrder(null);
      await load(); setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Close failed'); }
    finally { setClosing(null); }
  }

  async function handleCloseDay() {
    setClosingDay(true); setCloseDayError('');
    try {
      const result = await settlementApi.closeDay(today, closeDayNotes || undefined);
      setShowCloseDayModal(false);
      setCloseDayNotes('');
      setSuccess(`✅ Day closed successfully! ${result.ordersLocked} orders locked. Revenue: ${fmt(result.totalRevenue)}`);
      
      const status = await settlementApi.getStatus();
      setClosureStatus(status);
      
      await load();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: unknown) {
      setCloseDayError(err instanceof Error ? err.message : 'Failed to close the day');
    } finally {
      setClosingDay(false);
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
      state: { orderId, customerId, routeId: routeFilter === 'all' ? undefined : routeFilter }
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

  return (
    <div style={{ minHeight: '100vh', background: D.bg, paddingBottom: 80 }}>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: isMobile ? 'var(--mobile-nav-h, 70px)' : 'var(--nav-h, 64px)', zIndex: 20,
        background: D.bg,
        borderBottom: `1px solid ${D.border}`,
        padding: '16px 20px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* ── Back Button ────────────────────────────────────────────────────── */}
          <div style={{ marginBottom: 14 }}>
            <Link 
              to={user?.role === 'Admin' || user?.role === 'SuperAdmin' ? '/admin/dashboard' : '/'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 10,
                background: D.surface,
                border: `1px solid ${D.border}`,
                color: D.muted,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'all 0.2s',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = D.text;
                e.currentTarget.style.borderColor = D.accent;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = D.muted;
                e.currentTarget.style.borderColor = D.border;
              }}
            >
              <ArrowLeft size={16} />
              Back to Dashboard
            </Link>
          </div>

          {/* Top row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: D.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 14px ${D.accentGlow}`,
              }}>
                <ShoppingCart size={20} color="#FFFFFF" />
              </div>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0, color: D.text, letterSpacing: '-0.02em' }}>
                  Orders
                </h1>
                <p style={{ fontSize: 14, color: D.muted, margin: 0, fontWeight: 600 }}>
                  {orders.length} order{orders.length !== 1 ? 's' : ''} · {currentDate}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={load}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 16px', borderRadius: 9,
                  border: `1px solid ${D.border}`,
                  background: D.surface,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 700,
                  color: D.muted,
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = D.accent; (e.currentTarget as HTMLElement).style.color = D.text; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = D.border; (e.currentTarget as HTMLElement).style.color = D.muted; }}
              >
                <RefreshCw size={15} />
                Refresh
              </button>
            </div>
          </div>

          {/* ── Status count boxes - NOW CLICKABLE FILTERS ── */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
                    flex: 1, minWidth: 100,
                    padding: '10px 14px',
                    borderRadius: 9,
                    background: isActive ? `${c.color}20` : D.surface,
                    border: isActive ? `1px solid ${c.color}66` : `1px solid ${D.border}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.borderColor = `${c.color}44`;
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.borderColor = D.border;
                    }
                  }}
                >
                  <span style={{ fontSize: 12, color: D.sub, fontWeight: 600 }}>
                    {c.label}
                    {isActive && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: c.color }}>✓</span>
                    )}
                  </span>
                  <span style={{ 
                    fontSize: 22, fontWeight: 900, color: c.color, display: 'block' 
                  }}>
                    {c.value}
                    {c.label === 'Closed' && closureStatus?.isClosed && c.value > 0 && (
                      <span style={{ 
                        fontSize: 10, fontWeight: 600, color: D.green, 
                        marginLeft: 6, display: 'inline-block' 
                      }}>
                        ✓
                      </span>
                    )}
                  </span>
                </button>
              );
            })}

            {/* ── Clear filter button ── */}
            {statusFilter && (
              <button
                onClick={clearStatusFilter}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '0 12px',
                  borderRadius: 9,
                  border: `1px solid ${D.border}`,
                  background: D.surface,
                  color: D.muted,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = D.accent; (e.currentTarget as HTMLElement).style.color = D.text; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = D.border; (e.currentTarget as HTMLElement).style.color = D.muted; }}
              >
                <X size={12} /> Clear
              </button>
            )}

            {/* ── Day Closed status indicator ── */}
            {closureStatus?.isClosed && closureStatus.closedAt && (
              <div style={{
                flex: 1, minWidth: 170,
                padding: '10px 14px',
                borderRadius: 9,
                background: 'rgba(34,197,94,0.08)',
                border: `1px solid rgba(34,197,94,0.25)`,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                <CheckCircle size={18} color={D.green} />
                <div>
                  <span style={{ fontSize: 11, color: D.green, fontWeight: 700, display: 'block' }}>
                    Day Closed ✓
                  </span>
                  <span style={{ fontSize: 10, color: D.muted }}>
                    {new Date(closureStatus.closedAt).toLocaleDateString('en-IN', { 
                      day: 'numeric', 
                      month: 'short', 
                      year: 'numeric' 
                    })} · {new Date(closureStatus.closedAt).toLocaleTimeString('en-IN', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>
              </div>
            )}

            {/* ── Close Day button (only when NOT closed) ── */}
            {!closureStatus?.isClosed && (
              <button
                onClick={() => { setShowCloseDayModal(true); setCloseDayError(''); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 16px',
                  borderRadius: 9,
                  border: 'none',
                  background: `linear-gradient(135deg, ${D.accent}, ${D.accentH})`,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#fff',
                  fontFamily: 'inherit',
                  boxShadow: `0 4px 14px ${D.accentGlow}`,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 20px ${D.accentGlow}`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 14px ${D.accentGlow}`;
                }}
              >
                <Lock size={15} />
                Close Day
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 20px' }}>
        {error   && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        {/* ── Filters ── */}
        <div style={{
          background: D.surface,
          borderRadius: 14,
          border: `1px solid ${D.border}`,
          padding: '12px 16px',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <select 
              style={selectStyle} 
              value={routeFilter} 
              onChange={e => setRouteFilter(e.target.value)}
            >
              <option value="all">🌍 All Routes</option>
              {routes.map(r => <option key={r.id} value={r.id}>📍 {r.name}</option>)}
            </select>

            <select 
              style={selectStyle} 
              value={statusFilter} 
              onChange={e => setStatusFilterQuick(e.target.value)}
            >
              <option value="">📋 All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="PendingApproval">Pending Approval</option>
              <option value="Approved">Approved</option>
              <option value="Packed">Packed</option>
              <option value="Closed">Closed</option>
            </select>

            <input
              type="date" 
              style={dateInputStyle}
              value={dateFilter} 
              onChange={e => setDateFilter(e.target.value)}
            />

            <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
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
                      // ── FIXED: Use string comparison for status ──
                      const statusKey = String(order.status);
                      const cfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG['Draft'];
                      const items = order.items ?? [];
                      const units = items.reduce((s, i) => s + i.quantity, 0);
                      
                      // ── FIXED: Use string comparison, NOT enum ──
                      const isEditable = (statusKey === 'Draft' || 
                                        statusKey === 'PendingApproval' || 
                                        statusKey === 'Approved') && !order.isLocked;
                      
                      // ── FIXED: Also require !isLocked for Close button ──
                      const isClosable = (statusKey === 'Approved' || 
                                        statusKey === 'Packed') && !order.isLocked;
                      
                      const isPending = statusKey === 'PendingApproval';
                      const isExpanded = expandedOrder === String(order.id);

                      return (
                        <div key={order.id} style={{
                          background: D.surface,
                          borderRadius: 14,
                          border: `1px solid ${isPending ? D.accent : D.border}`,
                          boxShadow: isPending
                            ? `0 2px 10px ${D.accentGlow}`
                            : 'none',
                          overflow: 'hidden',
                          transition: 'border-color 0.15s',
                        }}>
                          {/* Pending approval highlight bar */}
                          {isPending && (
                            <div style={{ height: 3, background: D.accent }} />
                          )}

                          {/* Main row */}
                          <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                            {/* Avatar */}
                            <div style={{
                              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                              background: D.accent,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <User size={18} style={{ color: '#FFFFFF' }} />
                            </div>

                            {/* Customer info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 800, fontSize: 16, color: D.text }}>{order.customerName}</span>

                                {/* Status badge */}
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 5,
                                  padding: '4px 10px', borderRadius: 6,
                                  fontSize: 12, fontWeight: 700,
                                  background: cfg.bg,
                                  color: cfg.color,
                                  border: `1px solid ${cfg.color}33`,
                                }}>
                                  {getStatusLabel(order.status)}
                                </span>

                                {/* Locked indicator — separate from status, since a Draft/PendingApproval/
                                    Approved order can also be locked by Close Day sweeping it up */}
                                {order.isLocked && (
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    padding: '4px 10px', borderRadius: 6,
                                    fontSize: 11, fontWeight: 700,
                                    background: 'rgba(148,163,184,0.12)',
                                    color: D.sub,
                                    border: `1px solid ${D.border}`,
                                  }}>
                                    <Lock size={10} /> Locked
                                  </span>
                                )}

                                {routeFilter === 'all' && order.routeName && (
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    padding: '3px 8px', borderRadius: 5,
                                    background: D.bg,
                                    fontSize: 12, color: D.sub, fontWeight: 600,
                                    border: `1px solid ${D.border}`,
                                  }}>
                                    <Globe size={11} />{order.routeName}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 13, color: D.sub, marginTop: 4, fontFamily: 'monospace' }}>
                                #{String(order.id).slice(0, 8)} · {fmtDate(order.orderDate)} at {new Date(order.orderDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </div>

                              {/* Closed-at line — only appears once THIS order has actually been
                                  swept up by a Close Day run. Stays separate from the line above,
                                  which always shows the order's real creation date/time. */}
                              {order.closedAt && (
                                <div style={{ fontSize: 12, color: D.sub, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Lock size={11} />
                                  Closed {new Date(order.closedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at{' '}
                                  {new Date(order.closedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}

                              {/* Items preview */}
                              {items.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                  {items.slice(0, 4).map((item, i) => (
                                    <span key={i} style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 4,
                                      fontSize: 12, padding: '3px 9px', borderRadius: 5,
                                      background: D.bg,
                                      border: `1px solid ${D.border}`,
                                      color: D.muted,
                                      fontWeight: 600,
                                    }}>
                                      <Package size={11} color={D.sub} />
                                      {item.productName} <span style={{ color: D.text, fontWeight: 800 }}>×{item.quantity}</span>
                                    </span>
                                  ))}
                                  {items.length > 4 && (
                                    <span style={{ fontSize: 12, color: D.muted, fontWeight: 700, padding: '3px 4px' }}>
                                      +{items.length - 4} more
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <button 
                                  onClick={() => handleReview(String(order.id))} 
                                  disabled={loadingReview}
                                  style={actionBtn(D.surface, D.muted)}
                                >
                                  <Eye size={14} /> Review
                                </button>

                                {isPending && (
                                  <button 
                                    onClick={() => handleApprove(String(order.id))} 
                                    disabled={approving === String(order.id)}
                                    style={actionBtn(D.accent, '#FFFFFF', true)}
                                  >
                                    {approving === String(order.id) ? <Spinner size={14} /> : <CheckCircle size={14} />}
                                    Approve
                                  </button>
                                )}

                                {isEditable && (
                                  <button 
                                    onClick={() => handleEdit(String(order.id), String(order.customerId))}
                                    style={actionBtn(D.surface, D.muted)}
                                  >
                                    <Edit2 size={14} /> Edit
                                  </button>
                                )}

                                {isClosable && (
                                  <button 
                                    onClick={() => handleClose(String(order.id))} 
                                    disabled={closing === String(order.id)}
                                    style={actionBtn(D.green, '#FFFFFF', true)}
                                  >
                                    {closing === String(order.id) ? <Spinner size={14} /> : <CheckCircle size={14} />}
                                    Close
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Previous orders toggle */}
                          <div style={{
                            borderTop: `1px solid ${D.border}`,
                            padding: '8px 18px',
                            background: D.bg,
                          }}>
                            <button
                              onClick={() => loadPreviousOrders(String(order.customerId), String(order.id))}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                fontSize: 13, color: D.accent, fontWeight: 600,
                                background: 'none', border: 'none', cursor: 'pointer',
                                fontFamily: 'inherit', padding: 0,
                              }}
                            >
                              {loadingHistory[String(order.id)] ? <Spinner size={11} /> : <Clock size={11} />}
                              {isExpanded ? 'Hide previous orders' : 'Show previous orders (last 3)'}
                            </button>

                            {isExpanded && previousOrders[String(order.id)] && (
                              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {previousOrders[String(order.id)].length === 0 ? (
                                  <p style={{ fontSize: 13, color: D.sub, fontStyle: 'italic', margin: 0 }}>No previous orders</p>
                                ) : (
                                  previousOrders[String(order.id)].map((prev, idx) => (
                                    <div key={idx} style={{
                                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                      padding: '8px 12px', borderRadius: 8,
                                      background: D.surface,
                                      border: `1px solid ${D.border}`,
                                    }}>
                                      <div>
                                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: D.muted }}>
                                          {idx === 0 ? '📋 Most recent' : `${idx + 1} orders ago`}
                                        </p>
                                        <p style={{ margin: '2px 0 0', fontSize: 13, color: D.sub }}>
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

      {/* ── Review Modal ────────────────────────────────────────────────────── */}
      {showModal && reviewOrder && (
        <div
          onClick={() => setShowModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.70)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: D.surface, borderRadius: 20, width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: `1px solid ${D.border}`, boxShadow: `0 24px 64px rgba(0,0,0,0.5)` }}
          >
            {/* Modal header */}
            <div style={{ padding: '18px 20px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${D.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Eye size={16} color={D.accent} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: D.text }}>Review Order</h3>
                  <p style={{ margin: 0, fontSize: 13, color: D.sub }}>#{String(reviewOrder.id).slice(0, 8)}</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${D.border}`, background: D.bg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={14} color={D.muted} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
              <div style={{
                padding: '12px 14px', borderRadius: 12,
                background: D.bg,
                border: `1px solid ${D.border}`,
                marginBottom: 14,
              }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: D.text }}>{reviewOrder.customerName}</div>
                <div style={{ fontSize: 13, color: D.sub, marginTop: 3 }}>{fmtDate(reviewOrder.orderDate)}</div>
                {reviewOrder.closedAt && (
                  <div style={{ fontSize: 12, color: D.sub, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Lock size={11} />
                    Closed {fmtDate(reviewOrder.closedAt)}
                  </div>
                )}
                <div style={{ marginTop: 8 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 10px', borderRadius: 6,
                    fontSize: 12, fontWeight: 700,
                    background: D.bg,
                    color: D.muted,
                    border: `1px solid ${D.border}`,
                  }}>
                    {getStatusLabel(reviewOrder.status)}
                  </span>
                </div>
              </div>

              <h4 style={{ fontSize: 13, fontWeight: 700, color: D.sub, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
                Items ({reviewOrder.items?.length ?? 0})
              </h4>
              {reviewOrder.items && reviewOrder.items.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto', marginBottom: 14 }}>
                  {reviewOrder.items.map((item, idx) => (
                    <div key={idx} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 12px', borderRadius: 10,
                      background: D.bg,
                      border: `1px solid ${D.border}`,
                    }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: D.text }}>{item.productName}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 13, color: D.sub }}>
                          {item.quantity} {item.unitSymbol || 'unit'} × {fmt(item.sellingPrice)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 0', marginBottom: 14 }}>
                  <List size={28} style={{ color: D.border, marginBottom: 6 }} />
                  <p style={{ fontSize: 14, color: D.sub, margin: 0 }}>No items — click Edit to add products</p>
                </div>
              )}

              <div style={{ borderTop: `1px solid ${D.border}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: D.sub }}>Items</span>
                  <span style={{ fontWeight: 600, color: D.text }}>{reviewOrder.items?.length ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: D.sub }}>Units</span>
                  <span style={{ fontWeight: 600, color: D.text }}>{reviewOrder.totalQuantity ?? 0}</span>
                </div>
              </div>

              {reviewOrder.remarks && (
                <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.10)', border: `1px solid rgba(245,158,11,0.25)` }}>
                  <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: D.amber }}>📝 Remarks</p>
                  <p style={{ margin: 0, fontSize: 13, color: D.muted }}>{reviewOrder.remarks}</p>
                </div>
              )}
            </div>

            {/* ── Modal footer actions ── */}
            <div style={{ padding: '14px 20px', borderTop: `1px solid ${D.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {reviewOrder.status === OrderStatus.PendingApproval && (
                <button
                  onClick={() => handleApprove(String(reviewOrder.id))}
                  disabled={approving === String(reviewOrder.id)}
                  style={{ ...actionBtn(D.accent, '#FFFFFF', true), padding: '9px 16px', fontSize: 13, borderRadius: 9 }}
                >
                  {approving === String(reviewOrder.id) ? <Spinner size={14} /> : <CheckCircle size={14} />}
                  Approve Order
                </button>
              )}
              
              {/* ── FIXED: Edit button uses string comparison and !isLocked ── */}
              {(() => {
                const modalStatusKey = String(reviewOrder.status);
                return (modalStatusKey === 'Draft' || modalStatusKey === 'PendingApproval' || modalStatusKey === 'Approved') && !reviewOrder.isLocked ? (
                  <button
                    onClick={() => handleEdit(String(reviewOrder.id), String(reviewOrder.customerId))}
                    style={{ ...actionBtn(D.surface, D.muted), padding: '9px 16px', fontSize: 13, borderRadius: 9 }}
                  >
                    <Edit2 size={14} /> Edit Order
                  </button>
                ) : null;
              })()}
              
              {/* ── FIXED: Close button uses string comparison and !isLocked ── */}
              {(() => {
                const modalStatusKey = String(reviewOrder.status);
                return (modalStatusKey === 'Approved' || modalStatusKey === 'Packed') && !reviewOrder.isLocked ? (
                  <button
                    onClick={() => handleClose(String(reviewOrder.id))}
                    disabled={closing === String(reviewOrder.id)}
                    style={{ ...actionBtn(D.green, '#FFFFFF', true), padding: '9px 16px', fontSize: 13, borderRadius: 9 }}
                  >
                    {closing === String(reviewOrder.id) ? <Spinner size={14} /> : <CheckCircle size={14} />}
                    Close Order
                  </button>
                ) : null;
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Close Day confirmation modal ── */}
      {showCloseDayModal && (
        <div
          onClick={() => !closingDay && setShowCloseDayModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.70)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: D.surface, borderRadius: 16, padding: 24, width: '100%', maxWidth: 420, border: `1px solid ${D.border}`, boxShadow: `0 20px 60px rgba(0,0,0,0.5)` }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: D.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Lock size={18} color="#fff" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 900, color: D.text, margin: 0 }}>Close Day?</h3>
            </div>

            <p style={{ fontSize: 14, color: D.muted, lineHeight: 1.6, fontWeight: 500, margin: '0 0 16px' }}>
              This locks every submitted order for <strong style={{ color: D.text }}>{today}</strong>, creates the settlement record,
              and closes every open route — they'll be fresh and startable again immediately.
              This action cannot be undone.
            </p>

            <label style={{ fontSize: 13, fontWeight: 700, color: D.sub, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>
              Notes (optional)
            </label>
            <textarea
              value={closeDayNotes}
              onChange={e => setCloseDayNotes(e.target.value)}
              placeholder="e.g. Any remarks for today's closure"
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 9,
                border: `1px solid ${D.border}`,
                background: D.bg,
                fontSize: 14,
                color: D.text,
                fontFamily: 'inherit',
                resize: 'vertical',
                marginBottom: 14,
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />

            {closeDayError && (
              <div style={{ marginBottom: 14 }}>
                <Alert variant="error">{closeDayError}</Alert>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowCloseDayModal(false)}
                disabled={closingDay}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: 9,
                  border: `1px solid ${D.border}`,
                  background: D.bg,
                  color: D.muted,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: closingDay ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCloseDay}
                disabled={closingDay}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: 9,
                  border: 'none',
                  background: closingDay ? D.border : `linear-gradient(135deg, ${D.accent}, ${D.accentH})`,
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: closingDay ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: closingDay ? 'none' : `0 4px 14px ${D.accentGlow}`,
                }}
              >
                {closingDay ? <Spinner size={15} /> : <Lock size={15} />}
                {closingDay ? 'Closing...' : 'Close Day'}
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
    gap: 5,
    padding: '8px 14px',
    borderRadius: 7,
    border: `1px solid ${bg === D.accent ? 'transparent' : D.border}`,
    background: bg,
    color: color,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: strong ? 800 : 700,
    transition: 'all 0.12s',
  };
}