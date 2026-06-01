// PATH: src/pages/Warehouse/WarehouseDashboard.tsx
// FIXED:
//  1. Shows Approved, Packed, AND Closed orders (Closed tab answers "where did they go?")
//  2. Proper status tabs: Pending Pack | Packed | Closed
//  3. WarehouseController now targets OrderStatus.Approved for packing,
//     but Closed orders are visible in history tab.
//  4. Fixed empty-state text — no longer says "submitted", uses correct status names.

import { useEffect, useState, useCallback } from 'react';
import {
  Package, CheckCircle2, Clock, Search, Filter,
  RefreshCw, Loader2, CheckSquare, Square, Boxes, History,
  XCircle, Eye, ChevronDown, ChevronUp,
} from 'lucide-react';
import { warehouseApi, routesApi } from '../../api/services';
import type { WarehouseOrderDto, RouteDto } from '../../types';
import { Spinner, Alert, EmptyState } from '../../components/ui';

// ── Status helpers ────────────────────────────────────────────────────────────
const PACKING_STATUS = {
  0: { label: 'Pending',  color: 'text-amber-600 bg-amber-50 border border-amber-200', icon: <Clock size={12} /> },
  1: { label: 'Packed',   color: 'text-green-600  bg-green-50  border border-green-200',  icon: <CheckCircle2 size={12} /> },
  2: { label: 'Partial',  color: 'text-blue-600   bg-blue-50   border border-blue-200',   icon: <Package size={12} /> },
} as const;

function todayStr() { return new Date().toISOString().slice(0, 10); }
function tomorrowStr() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ── Order Detail Modal ────────────────────────────────────────────────────────
function OrderDetailModal({
  order, onClose, onPack,
}: {
  order: WarehouseOrderDto;
  onClose: () => void;
  onPack: (id: string, partial: boolean) => Promise<void>;
}) {
  const [packing, setPacking] = useState(false);
  const meta = PACKING_STATUS[order.packingStatus as keyof typeof PACKING_STATUS] ?? PACKING_STATUS[0];

  async function handlePack(partial: boolean) {
    setPacking(true);
    try { await onPack(order.id, partial); onClose(); }
    finally { setPacking(false); }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.50)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(15,23,42,0.20)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: 16, color: '#0F172A' }}>{order.orderNumber}</h3>
            <p style={{ color: '#64748B', fontSize: 13, marginTop: 3 }}>{order.customerName} · {order.routeName}</p>
            <p style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>
              Salesman: {order.salesmanName} · {new Date(order.orderDate).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 10px', borderRadius: 20, fontWeight: 700 }} className={meta.color}>
            {meta.icon} {meta.label}
          </span>
        </div>

        {/* Items */}
        <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['Product', 'Qty', 'Bags', 'Boxes', 'Tins'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Product' ? 'left' : 'right', color: '#64748B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{item.productName}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{item.quantity}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748B' }}>{item.quantityBags ?? '—'}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748B' }}>{item.quantityBoxes ?? '—'}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748B' }}>{item.quantityTins ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid #E2E8F0', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#64748B', fontFamily: 'inherit' }}
          >
            Close
          </button>
          {order.packingStatus !== 1 && (
            <>
              <button
                onClick={() => handlePack(true)}
                disabled={packing}
                style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid #BFDBFE', background: '#EFF6FF', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#2563EB', fontFamily: 'inherit' }}
              >
                {packing ? <Spinner size={13} /> : 'Partial Pack'}
              </button>
              <button
                onClick={() => handlePack(false)}
                disabled={packing}
                style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#16A34A,#22C55E)', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 3px 10px rgba(22,163,74,0.28)' }}
              >
                {packing ? <Spinner size={13} /> : <><CheckCircle2 size={14} /> Mark Packed</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
type ActiveTab = 'pending' | 'packed' | 'closed';

export default function WarehouseDashboard() {
  const [orders,      setOrders]      = useState<WarehouseOrderDto[]>([]);
  const [routes,      setRoutes]      = useState<RouteDto[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');
  const [activeTab,   setActiveTab]   = useState<ActiveTab>('pending');

  // Filters
  const [fromDate,     setFromDate]     = useState(todayStr());
  const [toDate,       setToDate]       = useState(tomorrowStr());
  const [routeFilter,  setRouteFilter]  = useState('');
  const [search,       setSearch]       = useState('');
  const [showFilters,  setShowFilters]  = useState(false);

  // Selection
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [bulkPacking, setBulkPacking] = useState(false);
  const [detailOrder, setDetailOrder] = useState<WarehouseOrderDto | null>(null);

  // We fetch ALL relevant orders (Pending + Packed) from the warehouse API,
  // and Closed orders come from a separate all-status query on the ordersApi.
  const [closedOrders, setClosedOrders] = useState<WarehouseOrderDto[]>([]);

  const pendingOrders = orders.filter(o => o.packingStatus === 0);
  const packedOrders  = orders.filter(o => o.packingStatus === 1);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [o, r] = await Promise.all([
        // Fetch pending+packed (Approved status)
        warehouseApi.getPendingOrders({
          fromDate,
          toDate,
          routeId: routeFilter || undefined,
          search:  search || undefined,
        }),
        routesApi.getAll(),
      ]);
      setOrders(o);
      setRoutes(r);

      // Also fetch closed orders (packingStatus doesn't matter; these are done)
      // We reuse the same endpoint but filter by packingStatus=1 (already packed+closed)
      // The backend WarehouseController now also returns Closed orders when requested
      try {
        const closed = await warehouseApi.getClosedOrders({
          fromDate,
          toDate,
          routeId: routeFilter || undefined,
          search:  search || undefined,
        });
        setClosedOrders(closed);
      } catch {
        setClosedOrders([]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load orders');
    } finally { setLoading(false); }
  }, [fromDate, toDate, routeFilter, search]);

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  async function handlePackOne(orderId: string, partial: boolean) {
    try {
      await warehouseApi.packOrder(orderId, partial);
      setSuccess(partial ? 'Order marked as partially packed.' : 'Order marked as packed! ✓');
      await load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Pack failed');
    }
  }

  async function handleBulkPack() {
    if (!selected.size) return;
    setBulkPacking(true);
    try {
      const count = await warehouseApi.bulkPack([...selected]);
      setSuccess(`${count} order(s) marked as Packed. ✓`);
      setSelected(new Set());
      await load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Bulk pack failed');
    } finally { setBulkPacking(false); }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const ids = pendingOrders.map(o => o.id);
    if (selected.size === ids.length && selected.size > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(ids));
    }
  }

  const allPendingSelected = pendingOrders.length > 0 &&
    pendingOrders.every(o => selected.has(o.id));

  // Filter search client-side
  const filterBySearch = (list: WarehouseOrderDto[]) => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(o =>
      o.customerName.toLowerCase().includes(q) ||
      o.salesmanName.toLowerCase().includes(q) ||
      o.orderNumber.toLowerCase().includes(q) ||
      o.routeName.toLowerCase().includes(q)
    );
  };

  const tabs: { id: ActiveTab; label: string; count: number; color: string }[] = [
    { id: 'pending', label: '⏳ Pending Pack', count: pendingOrders.length, color: 'amber' },
    { id: 'packed',  label: '✅ Packed',        count: packedOrders.length,  color: 'green' },
    { id: 'closed',  label: '📦 Closed',         count: closedOrders.length,  color: 'slate' },
  ];

  const tabOrders: Record<ActiveTab, WarehouseOrderDto[]> = {
    pending: filterBySearch(pendingOrders),
    packed:  filterBySearch(packedOrders),
    closed:  filterBySearch(closedOrders),
  };

  const visibleOrders = tabOrders[activeTab];

  return (
    <div className="page-content">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text)', letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Boxes size={22} color="var(--primary)" />
            Pack Orders
          </h1>
          <p style={{ color: 'var(--text-sub)', fontSize: 13, marginTop: 4 }}>
            {pendingOrders.length} pending · {packedOrders.length} packed · {closedOrders.length} closed
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowFilters(f => !f)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1px solid var(--border)', background: showFilters ? 'var(--ice)' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: showFilters ? 'var(--primary)' : 'var(--text-sub)', fontFamily: 'inherit' }}
          >
            <Filter size={14} />
            Filters
            {showFilters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <button
            onClick={load}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 9, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', color: 'var(--text-sub)' }}
          >
            {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
          </button>
        </div>
      </div>

      {error   && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* ── Filters ──────────────────────────────────────────────────────────── */}
      {showFilters && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-sub)', display: 'block', marginBottom: 4, fontWeight: 600 }}>From Date</label>
              <input type="date" className="input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-sub)', display: 'block', marginBottom: 4, fontWeight: 600 }}>To Date</label>
              <input type="date" className="input" value={toDate} onChange={e => setToDate(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-sub)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Route</label>
              <select className="input" value={routeFilter} onChange={e => setRouteFilter(e.target.value)}>
                <option value="">All Routes</option>
                {routes.map(r => <option key={String(r.id)} value={String(r.id)}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-sub)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Search</label>
              <input
                className="input"
                placeholder="Customer, salesman, order…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <button
            className="btn btn-primary btn-sm"
            style={{ marginTop: 12 }}
            onClick={load}
          >
            Apply Filters
          </button>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 18px', borderRadius: '10px 10px 0 0',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 700,
              background: activeTab === tab.id ? '#fff' : 'transparent',
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-sub)',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -2,
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 800,
                background: tab.id === 'pending' && tab.count > 0 ? 'var(--amber-bg)' : 'var(--ice)',
                color: tab.id === 'pending' && tab.count > 0 ? 'var(--amber)' : 'var(--primary)',
                padding: '1px 7px', borderRadius: 20,
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Closed orders notice ───────────────────────────────────────────────── */}
      {activeTab === 'closed' && closedOrders.length > 0 && (
        <div style={{ background: 'rgba(148,163,184,0.10)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-sub)' }}>
          <History size={15} />
          <span>These orders were <strong>approved → packed → closed</strong> by Admin. They are read-only and shown for reference.</span>
        </div>
      )}

      {/* ── Bulk Actions ────────────────────────────────────────────────────── */}
      {activeTab === 'pending' && selected.size > 0 && (
        <div style={{
          background: 'var(--primary-glow)', border: '1px solid var(--primary)',
          borderRadius: 10, padding: '10px 16px', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
            {selected.size} order{selected.size > 1 ? 's' : ''} selected
          </span>
          <button
            onClick={handleBulkPack}
            disabled={bulkPacking}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#16A34A,#22C55E)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}
          >
            {bulkPacking
              ? <><Spinner size={13} /> Packing…</>
              : <><CheckCircle2 size={13} /> Mark All as Packed</>
            }
          </button>
          <button
            onClick={() => setSelected(new Set())}
            style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-sub)', fontFamily: 'inherit' }}
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Orders Table ────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spinner size={32} /></div>
      ) : visibleOrders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            {activeTab === 'closed' ? <History size={28} color="#94A3B8" /> : <Package size={28} color="#94A3B8" />}
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
            {activeTab === 'pending' ? 'No orders pending packing'
              : activeTab === 'packed' ? 'No packed orders'
              : 'No closed orders for this period'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-sub)' }}>
            {activeTab === 'pending'
              ? 'Orders appear here once Admin approves them.'
              : activeTab === 'packed'
              ? 'Pack orders from the Pending tab to see them here.'
              : 'Closed orders from Admin will appear here. Try adjusting the date range.'}
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {activeTab === 'pending' && (
                  <th style={{ width: 40, padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                    <button
                      onClick={toggleAll}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sub)', padding: 0 }}
                    >
                      {allPendingSelected
                        ? <CheckSquare size={15} color="var(--primary)" />
                        : <Square size={15} />
                      }
                    </button>
                  </th>
                )}
                {['Order #', 'Date', 'Salesman', 'Customer', 'Route', 'Items', 'Qty', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', textAlign: h === 'Items' || h === 'Qty' ? 'right' : 'left', color: '#64748B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map(order => {
                const meta       = PACKING_STATUS[order.packingStatus as keyof typeof PACKING_STATUS] ?? PACKING_STATUS[0];
                const isPending  = order.packingStatus === 0;
                const isSelected = selected.has(order.id);
                const isClosed   = activeTab === 'closed';

                return (
                  <tr
                    key={order.id}
                    style={{
                      background: isSelected ? 'var(--primary-glow)' : isClosed ? '#FAFBFD' : 'transparent',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border-lite)',
                    }}
                    onClick={() => setDetailOrder(order)}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#FAFBFD'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isSelected ? 'var(--primary-glow)' : isClosed ? '#FAFBFD' : 'transparent'; }}
                  >
                    {activeTab === 'pending' && (
                      <td onClick={e => e.stopPropagation()} style={{ padding: '10px 14px' }}>
                        {isPending && (
                          <button
                            onClick={() => toggleSelect(order.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-sub)' }}
                          >
                            {isSelected
                              ? <CheckSquare size={14} color="var(--primary)" />
                              : <Square size={14} />
                            }
                          </button>
                        )}
                      </td>
                    )}
                    <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 12, color: 'var(--primary)' }}>{order.orderNumber}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-sub)' }}>
                      {new Date(order.orderDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      <span style={{ display: 'block', fontSize: 11, color: '#94A3B8' }}>
                        {new Date(order.orderDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{order.salesmanName}</td>
                    <td style={{ padding: '10px 14px' }}>{order.customerName}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-sub)', fontSize: 12 }}>{order.routeName}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>{order.itemCount}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>{order.totalQty.toFixed(0)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 8px', borderRadius: 12, fontWeight: 700 }} className={meta.color}>
                        {meta.icon} {meta.label}
                      </span>
                    </td>
                    <td onClick={e => e.stopPropagation()} style={{ padding: '8px 14px' }}>
                      {isPending && activeTab === 'pending' && (
                        <button
                          style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg,#16A34A,#22C55E)', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', boxShadow: '0 2px 6px rgba(22,163,74,0.25)' }}
                          onClick={() => handlePackOne(order.id, false)}
                        >
                          Pack ✓
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Detail Modal ──────────────────────────────────────────────────────── */}
      {detailOrder && (
        <OrderDetailModal
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
          onPack={handlePackOne}
        />
      )}
    </div>
  );
}