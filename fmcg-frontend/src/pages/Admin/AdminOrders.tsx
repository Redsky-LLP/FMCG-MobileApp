// PATH: src/pages/Admin/AdminOrders.tsx
// UPDATED: Modern compact UI — removed congestion, tighter layout, live pulse indicators,
// better typography, fits page without excess whitespace. All functionality preserved.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart, RefreshCw, CheckCircle, Search,
  Package, Eye, Edit2, Clock, ChevronRight, X,
  TrendingUp, Zap, List, User, Globe,
} from 'lucide-react';
import { ordersApi, routesApi } from '../../api/services';
import type { OrderDto, RouteDto, OrderDetailDto, CustomerOrderHistoryDto } from '../../types';
import { OrderStatus, ORDER_STATUS_LABELS, fmt, fmtDate } from '../../types';
import { PageLoader, Spinner, Alert, Badge, EmptyState } from '../../components/ui';

// Status config
const STATUS_CONFIG: Record<number, { bg: string; color: string; dot: string }> = {
  [OrderStatus.Draft]:           { bg: '#FFFBEB', color: '#B45309', dot: '#F59E0B' },
  [OrderStatus.PendingApproval]: { bg: '#FAF5FF', color: '#6D28D9', dot: '#8B5CF6' },
  [OrderStatus.Approved]:        { bg: '#EFF6FF', color: '#1D4ED8', dot: '#3B82F6' },
  [OrderStatus.Packed]:          { bg: '#F0F9FF', color: '#0369A1', dot: '#0EA5E9' },
  [OrderStatus.Closed]:          { bg: '#F0FDF4', color: '#15803D', dot: '#22C55E' },
};

export function AdminOrders() {
  const navigate = useNavigate();
  const [orders,         setOrders]         = useState<OrderDto[]>([]);
  const [routes,         setRoutes]         = useState<RouteDto[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');
  const [success,        setSuccess]        = useState('');
  const [routeFilter,    setRouteFilter]    = useState('');
  const [statusFilter,   setStatusFilter]   = useState('');
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

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => { if (!dateFilter) setDateFilter(today); }, []);

  async function load() {
    setLoading(true); setError('');
    try {
      let allOrders: OrderDto[] = [];
      if (!routeFilter || routeFilter === 'all') {
        const results = await Promise.all(
          routes.map(r => ordersApi.getByRoute(String(r.id), statusFilter !== '' ? parseInt(statusFilter) : undefined).catch(() => []))
        );
        allOrders = results.flat();
      } else {
        allOrders = await ordersApi.getByRoute(routeFilter, statusFilter !== '' ? parseInt(statusFilter) : undefined);
      }
      let filtered = dateFilter ? allOrders.filter(o => o.orderDate?.startsWith(dateFilter)) : allOrders;
      filtered.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
      setOrders(filtered);
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
      const items = detail.items;
      if (detail.totalBasePrice === undefined) {
        detail.totalBasePrice = items.reduce((s, i) => s + (i.basePrice || 0) * i.quantity, 0);
        detail.totalSelling   = items.reduce((s, i) => s + (i.sellingPrice || 0) * i.quantity, 0);
        detail.totalVariance  = detail.totalSelling - detail.totalBasePrice;
        detail.variancePct    = detail.totalBasePrice > 0 ? (detail.totalVariance / detail.totalBasePrice) * 100 : 0;
      }
      setReviewOrder(detail); setShowModal(true);
    } catch {
      const o = orders.find(o => String(o.id) === orderId);
      if (o) {
        const items = o.items || [];
        setReviewOrder({
          ...o, items,
          totalBasePrice: items.reduce((s, i) => s + (i.basePrice || 0) * i.quantity, 0),
          totalSelling:   items.reduce((s, i) => s + (i.sellingPrice || 0) * i.quantity, 0),
          totalVariance:  0, variancePct: 0,
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

  // Derived
  const ordersByDate = orders.reduce((acc, o) => {
    const d = o.orderDate?.split('T')[0] || 'Unknown';
    if (!acc[d]) acc[d] = [];
    acc[d].push(o); return acc;
  }, {} as Record<string, OrderDto[]>);

  const filteredByDate = Object.entries(ordersByDate).reduce((acc, [date, dos]) => {
    const f = dos.filter(o => !search || o.customerName?.toLowerCase().includes(search.toLowerCase()));
    if (f.length) acc[date] = f; return acc;
  }, {} as Record<string, OrderDto[]>);

  const totalRevenue = orders.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
  const counts = {
    draft:    orders.filter(o => o.status === OrderStatus.Draft).length,
    pending:  orders.filter(o => o.status === OrderStatus.PendingApproval).length,
    approved: orders.filter(o => o.status === OrderStatus.Approved || o.status === OrderStatus.Packed).length,
    closed:   orders.filter(o => o.status === OrderStatus.Closed).length,
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', paddingBottom: 80 }}>

      {/* ── Compact Header ──────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: '#fff', borderBottom: '1px solid #E2E8F0',
        boxShadow: '0 1px 8px rgba(15,23,42,0.06)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '14px 20px' }}>
          {/* Top row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'linear-gradient(135deg,#EFF6FF,#DBEAFE)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ShoppingCart size={18} color="#2563EB" />
              </div>
              <div>
                <h1 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#0F172A', letterSpacing: '-0.03em' }}>
                  Orders
                </h1>
                <p style={{ fontSize: 12, color: '#64748B', margin: 0, fontWeight: 500 }}>
                  {orders.length} orders · <span style={{ color: '#059669', fontWeight: 700 }}>{fmt(totalRevenue)}</span> total
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {/* Live indicator */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 8,
                background: '#F0FDF4', border: '1px solid #BBF7D0',
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', animation: 'pulse-ring 2s ease infinite' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#15803D' }}>Live</span>
              </div>
              <button
                onClick={load}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 8, border: '1px solid #E2E8F0',
                  background: '#F8FAFC', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  color: '#64748B', fontFamily: 'inherit', transition: 'all 0.12s',
                }}
              >
                <RefreshCw size={13} />
                Refresh
              </button>
            </div>
          </div>

          {/* Workflow strip — compact */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
            padding: '8px 12px', borderRadius: 8,
            background: '#F1F5F9', fontSize: 11, color: '#64748B',
          }}>
            <Zap size={11} color="#2563EB" />
            {[
              { label: 'Draft', color: '#F59E0B' },
              { label: 'Pending', color: '#8B5CF6' },
              { label: 'Approved', color: '#3B82F6' },
              { label: 'Packed', color: '#0EA5E9' },
              { label: 'Closed', color: '#22C55E' },
            ].map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <ChevronRight size={10} style={{ color: '#CBD5E1' }} />}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 8px', borderRadius: 5,
                  background: `${s.color}15`, color: s.color, fontWeight: 700,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                  {s.label}
                </span>
              </React.Fragment>
            ))}
          </div>

          {/* Status count chips */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto', paddingBottom: 2 }}>
            {[
              { label: 'Total',    value: orders.length, bg: '#F1F5F9', color: '#475569' },
              { label: 'Draft',    value: counts.draft,  bg: '#FFFBEB', color: '#B45309' },
              { label: 'Pending',  value: counts.pending, bg: '#FAF5FF', color: '#6D28D9' },
              { label: 'Approved', value: counts.approved, bg: '#EFF6FF', color: '#1D4ED8' },
              { label: 'Closed',   value: counts.closed, bg: '#F0FDF4', color: '#15803D' },
            ].map(c => (
              <div key={c.label} style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 7,
                background: c.bg, border: `1px solid ${c.color}22`,
              }}>
                <span style={{ fontSize: 11, color: c.color, fontWeight: 600 }}>{c.label}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: c.color }}>{c.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 20px' }}>
        {error   && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        {/* ── Filters — compact horizontal row ────────────── */}
        <div style={{
          background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0',
          padding: '12px 16px', marginBottom: 16,
          boxShadow: '0 1px 4px rgba(15,23,42,0.04)',
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <select style={selectStyle} value={routeFilter} onChange={e => setRouteFilter(e.target.value)}>
              <option value="all">🌍 All Routes</option>
              {routes.map(r => <option key={r.id} value={r.id}>📍 {r.name}</option>)}
            </select>

            <select style={selectStyle} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="1">Draft</option>
              <option value="2">Pending Approval</option>
              <option value="3">Approved</option>
              <option value="4">Packed</option>
              <option value="5">Closed</option>
            </select>

            <input
              type="date" style={selectStyle}
              value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            />

            <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              <input
                style={{ ...selectStyle, paddingLeft: 32, width: '100%' }}
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search customer..."
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}>
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Orders List ────────────────────────────────────── */}
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
                    <div style={{ width: 3, height: 16, borderRadius: 2, background: '#2563EB' }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
                      {new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                    <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>
                      {dateOrders.length} order{dateOrders.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {dateOrders.map(order => {
                      const cfg   = STATUS_CONFIG[order.status] ?? STATUS_CONFIG[OrderStatus.Draft];
                      const items = order.items ?? [];
                      const units = items.reduce((s, i) => s + i.quantity, 0);
                      const isEditable  = [OrderStatus.Draft, OrderStatus.PendingApproval, OrderStatus.Approved].includes(order.status);
                      const isClosable  = [OrderStatus.Approved, OrderStatus.Packed].includes(order.status);
                      const isPending   = order.status === OrderStatus.PendingApproval;
                      const isExpanded  = expandedOrder === String(order.id);

                      return (
                        <div key={order.id} style={{
                          background: '#fff', borderRadius: 14,
                          border: `1px solid ${isPending ? '#DDD6FE' : '#E2E8F0'}`,
                          boxShadow: isPending
                            ? '0 2px 12px rgba(139,92,246,0.10)'
                            : '0 1px 4px rgba(15,23,42,0.05)',
                          overflow: 'hidden',
                          transition: 'box-shadow 0.15s',
                        }}>
                          {/* Pending approval highlight bar */}
                          {isPending && (
                            <div style={{ height: 3, background: 'linear-gradient(90deg,#8B5CF6,#A78BFA)', borderRadius: '14px 14px 0 0' }} />
                          )}

                          {/* Main row */}
                          <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                            {/* Avatar */}
                            <div style={{
                              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                              background: cfg.bg, border: `1.5px solid ${cfg.dot}33`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <User size={16} style={{ color: cfg.color }} />
                            </div>

                            {/* Customer info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>{order.customerName}</span>

                                {/* Status badge with live dot */}
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 5,
                                  padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                                  background: cfg.bg, color: cfg.color,
                                  border: `1px solid ${cfg.dot}22`,
                                }}>
                                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, display: 'inline-block' }} />
                                  {ORDER_STATUS_LABELS[order.status]}
                                </span>

                                {routeFilter === 'all' && order.routeName && (
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    padding: '2px 7px', borderRadius: 5,
                                    background: '#F1F5F9', fontSize: 11, color: '#64748B',
                                  }}>
                                    <Globe size={9} />{order.routeName}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3, fontFamily: 'monospace' }}>
                                #{String(order.id).slice(0, 8)} · {fmtDate(order.orderDate)} at {new Date(order.orderDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </div>

                              {/* Items preview */}
                              {items.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
                                  {items.slice(0, 4).map((item, i) => (
                                    <span key={i} style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 4,
                                      fontSize: 11, padding: '2px 7px', borderRadius: 5,
                                      background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569',
                                    }}>
                                      <Package size={9} color="#94A3B8" />
                                      {item.productName} <span style={{ color: '#94A3B8' }}>×{item.quantity}</span>
                                    </span>
                                  ))}
                                  {items.length > 4 && (
                                    <span style={{ fontSize: 11, color: '#3B82F6', padding: '2px 4px' }}>+{items.length - 4} more</span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Amount + actions */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 18, fontWeight: 800, color: '#059669', letterSpacing: '-0.02em' }}>
                                  {fmt(order.totalAmount)}
                                </div>
                                <div style={{ fontSize: 11, color: '#94A3B8' }}>
                                  {items.length} items · {units} units
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => handleReview(String(order.id))} disabled={loadingReview}
                                  style={actionBtn('#F1F5F9', '#475569')}>
                                  <Eye size={12} /> Review
                                </button>

                                {isPending && (
                                  <button onClick={() => handleApprove(String(order.id))} disabled={approving === String(order.id)}
                                    style={actionBtn('#EDE9FE', '#6D28D9', true)}>
                                    {approving === String(order.id) ? <Spinner size={12} /> : <CheckCircle size={12} />}
                                    Approve
                                  </button>
                                )}

                                {isEditable && (
                                  <button onClick={() => handleEdit(String(order.id), String(order.customerId))}
                                    style={actionBtn('#FEF3C7', '#B45309')}>
                                    <Edit2 size={12} /> Edit
                                  </button>
                                )}

                                {isClosable && (
                                  <button onClick={() => handleClose(String(order.id))} disabled={closing === String(order.id)}
                                    style={actionBtn('#D1FAE5', '#065F46')}>
                                    {closing === String(order.id) ? <Spinner size={12} /> : <CheckCircle size={12} />}
                                    Close
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Previous orders toggle */}
                          <div style={{
                            borderTop: '1px solid #F1F5F9',
                            padding: '8px 18px',
                            background: '#FAFBFD',
                          }}>
                            <button
                              onClick={() => loadPreviousOrders(String(order.customerId), String(order.id))}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                fontSize: 11, color: '#3B82F6', fontWeight: 600,
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
                                  <p style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic', margin: 0 }}>No previous orders</p>
                                ) : (
                                  previousOrders[String(order.id)].map((prev, idx) => (
                                    <div key={idx} style={{
                                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                      padding: '8px 12px', borderRadius: 8,
                                      background: '#fff', border: '1px solid #E2E8F0',
                                    }}>
                                      <div>
                                        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#475569' }}>
                                          {idx === 0 ? '📋 Most recent' : `${idx + 1} orders ago`}
                                        </p>
                                        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94A3B8' }}>
                                          {fmtDate(prev.orderDate)} · {prev.itemCount} items
                                        </p>
                                      </div>
                                      <span style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>{fmt(prev.totalAmount)}</span>
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

      {/* ── Review Modal ──────────────────────────────────────── */}
      {showModal && reviewOrder && (
        <div
          onClick={() => setShowModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.50)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(15,23,42,0.25)' }}
          >
            {/* Modal header */}
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Eye size={16} color="#2563EB" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0F172A' }}>Review Order</h3>
                  <p style={{ margin: 0, fontSize: 11, color: '#94A3B8' }}>#{String(reviewOrder.id).slice(0, 8)}</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={14} color="#64748B" />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
              {/* Customer + status */}
              <div style={{
                padding: '12px 14px', borderRadius: 12,
                background: STATUS_CONFIG[reviewOrder.status]?.bg ?? '#F8FAFC',
                border: `1px solid ${STATUS_CONFIG[reviewOrder.status]?.dot ?? '#E2E8F0'}22`,
                marginBottom: 14,
              }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}>{reviewOrder.customerName}</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>{fmtDate(reviewOrder.orderDate)}</div>
                <div style={{ marginTop: 8 }}>
                  <Badge variant={reviewOrder.status === OrderStatus.Closed ? 'green' : reviewOrder.status === OrderStatus.Approved || reviewOrder.status === OrderStatus.Packed ? 'blue' : reviewOrder.status === OrderStatus.PendingApproval ? 'primary' : 'amber'}>
                    {ORDER_STATUS_LABELS[reviewOrder.status]}
                  </Badge>
                </div>
              </div>

              {/* Items */}
              <h4 style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
                Items ({reviewOrder.items?.length ?? 0})
              </h4>
              {reviewOrder.items && reviewOrder.items.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto', marginBottom: 14 }}>
                  {reviewOrder.items.map((item, idx) => (
                    <div key={idx} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 12px', borderRadius: 10,
                      background: '#F8FAFC', border: '1px solid #E2E8F0',
                    }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{item.productName}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94A3B8' }}>
                          {item.quantity} {item.unitSymbol || 'unit'} × {fmt(item.sellingPrice)}
                        </p>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#059669' }}>{fmt(item.sellingPrice * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 0', marginBottom: 14 }}>
                  <List size={28} style={{ color: '#CBD5E1', marginBottom: 6 }} />
                  <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>No items — click Edit to add products</p>
                </div>
              )}

              {/* Totals */}
              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { label: 'Items', value: String(reviewOrder.items?.length ?? 0) },
                  { label: 'Units', value: String(reviewOrder.totalQuantity ?? 0) },
                  { label: 'Base Price', value: fmt(reviewOrder.totalBasePrice) },
                  { label: 'Variance', value: `${fmt(reviewOrder.totalVariance)} (${reviewOrder.variancePct?.toFixed(1)}%)`, highlight: (reviewOrder.totalVariance ?? 0) >= 0 ? '#059669' : '#DC2626' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#64748B' }}>{row.label}</span>
                    <span style={{ fontWeight: 600, color: row.highlight ?? '#334155' }}>{row.value}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
                  <span style={{ color: '#0F172A' }}>Grand Total</span>
                  <span style={{ color: '#059669' }}>{fmt(reviewOrder.totalAmount)}</span>
                </div>
              </div>

              {reviewOrder.remarks && (
                <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#B45309' }}>📝 Remarks</p>
                  <p style={{ margin: 0, fontSize: 13, color: '#92400E' }}>{reviewOrder.remarks}</p>
                </div>
              )}
            </div>

            {/* Modal footer actions */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {reviewOrder.status === OrderStatus.PendingApproval && (
                <button
                  onClick={() => handleApprove(String(reviewOrder.id))}
                  disabled={approving === String(reviewOrder.id)}
                  style={{ ...actionBtn('#EDE9FE', '#6D28D9', true), padding: '9px 16px', fontSize: 13, borderRadius: 9 }}
                >
                  {approving === String(reviewOrder.id) ? <Spinner size={14} /> : <CheckCircle size={14} />}
                  Approve Order
                </button>
              )}
              {(reviewOrder.status === OrderStatus.Draft || reviewOrder.status === OrderStatus.PendingApproval || reviewOrder.status === OrderStatus.Approved) && (
                <button
                  onClick={() => handleEdit(String(reviewOrder.id), String(reviewOrder.customerId))}
                  style={{ ...actionBtn('#FEF3C7', '#B45309'), padding: '9px 16px', fontSize: 13, borderRadius: 9 }}
                >
                  <Edit2 size={14} /> Edit Order
                </button>
              )}
              {(reviewOrder.status === OrderStatus.Approved || reviewOrder.status === OrderStatus.Packed) && (
                <button
                  onClick={() => handleClose(String(reviewOrder.id))}
                  disabled={closing === String(reviewOrder.id)}
                  style={{ ...actionBtn('#D1FAE5', '#065F46'), padding: '9px 16px', fontSize: 13, borderRadius: 9 }}
                >
                  {closing === String(reviewOrder.id) ? <Spinner size={14} /> : <CheckCircle size={14} />}
                  Close Order
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────
const selectStyle: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 8, border: '1px solid #E2E8F0',
  background: '#F8FAFC', fontSize: 13, fontFamily: 'inherit',
  color: '#334155', outline: 'none', cursor: 'pointer',
};

function actionBtn(bg: string, color: string, strong = false): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '6px 12px', borderRadius: 7, border: 'none',
    background: bg, color, cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 12, fontWeight: strong ? 700 : 600,
    transition: 'all 0.12s',
  };
}