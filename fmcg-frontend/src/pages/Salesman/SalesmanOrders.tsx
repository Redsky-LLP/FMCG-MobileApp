// PATH: src/pages/Salesman/SalesmanOrders.tsx
// UPDATED:
//  - Shows "No Order" shops section (customers visited with NoOrder status)
//  - Salesman/admin can call customer directly from No Order card
//  - Dark theme matching other pages
//  - Fixed TypeScript errors with status types

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, Clock, Calendar, Package, Eye,
  User, Search, Send, RefreshCw, Edit2, ClipboardList,
  Filter, X, CheckCircle, Ban, Phone, MapPin, AlertCircle,
} from 'lucide-react';
import { customersApi, ordersApi, routesApi } from '../../api/services';
import { CustomerDto, OrderDto, RouteDto, OrderStatus, fmt, OrderItemDto } from '../../types';
import { Spinner } from '../../components/ui';
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

// ── Status badge ───────────────────────────────────────────────
function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const cfg: Record<OrderStatus, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
    [OrderStatus.Draft]:            { label: 'Draft',            bg: 'rgba(234,88,12,0.15)', color: D.accent, icon: <Edit2 size={11} /> },
    [OrderStatus.PendingApproval]:  { label: 'Pending Approval', bg: 'rgba(59,130,246,0.15)', color: '#3B82F6', icon: <Clock size={11} /> },
    [OrderStatus.Approved]:         { label: 'Approved',         bg: 'rgba(79,70,229,0.15)', color: '#4F46E5', icon: <CheckCircle size={11} /> },
    [OrderStatus.Packed]:           { label: 'Packed',           bg: 'rgba(124,58,237,0.15)', color: '#7C3AED', icon: <Package size={11} /> },
    [OrderStatus.Closed]:           { label: 'Closed',           bg: 'rgba(34,197,94,0.15)', color: D.green, icon: <CheckCircle2 size={11} /> },
  };
  const isMobile = useIsMobile();
  const c = cfg[status] || cfg[OrderStatus.Draft];
  
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700,
      background: c.bg, color: c.color,
    }}>
      {c.icon} {c.label}
    </span>
  );
}

// ── Order card ─────────────────────────────────────────────────
function OrderCard({
  order, routeId, onEdit,
}: {
  order: OrderDto;
  routeId: string;
  onEdit: (customerId: string) => void;
}) {
  const [showItems, setShowItems] = useState(false);
  const isDraft   = order.status === OrderStatus.Draft;
  const isClosed  = order.status === OrderStatus.Closed;
  const isPending = order.status === OrderStatus.PendingApproval;
  const isApproved = order.status === OrderStatus.Approved;
  const isPacked  = order.status === OrderStatus.Packed;

  const deliveryMsg =
    isPending  ? { text: 'Waiting for admin approval', color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' } :
    isApproved ? { text: 'Approved — ready for packing', color: '#4F46E5', bg: 'rgba(79,70,229,0.08)' } :
    isPacked   ? { text: 'Packed — ready for delivery', color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' } :
    isClosed   ? { text: 'Delivered ✓', color: D.green, bg: 'rgba(34,197,94,0.08)' } : null;

  return (
    <div style={{ background: D.surface, borderRadius: 12, overflow: 'hidden', border: `1px solid ${D.border}`, marginBottom: 8 }}>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${D.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <User size={17} color={D.accent} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: D.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {order.customerName}
              </p>
              {order.customerNameMalayalam && (
                <p style={{ margin: '1px 0 0', fontSize: 12, color: D.sub }} lang="ml">{order.customerNameMalayalam}</p>
              )}
            </div>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: D.sub }}>📦 {order.items?.length ?? 0} items</span>
            <span style={{ fontSize: 12, color: D.sub }}>📊 {order.items?.reduce((s, i) => s + i.quantity, 0) ?? 0} units</span>
            <span style={{ fontSize: 12, color: D.sub }}>
              🕐 {new Date(order.orderDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: D.text }}>₹{fmt(order.totalAmount ?? 0)}</p>
        </div>

        {/* Delivery status */}
        {deliveryMsg && (
          <div style={{ marginTop: 8, padding: '6px 10px', background: deliveryMsg.bg, borderRadius: 7, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={12} color={deliveryMsg.color} />
            <span style={{ fontSize: 12, color: deliveryMsg.color, fontWeight: 600 }}>{deliveryMsg.text}</span>
          </div>
        )}

        {/* Items toggle */}
        {(order.items?.length ?? 0) > 0 && (
          <button
            onClick={() => setShowItems(!showItems)}
            style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: D.accent, fontSize: 12, cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontWeight: 600, touchAction: 'manipulation' }}
          >
            <Eye size={13} /> {showItems ? 'Hide items' : `View ${order.items!.length} item(s)`}
          </button>
        )}

        {showItems && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(order.items ?? []).map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: D.bg, borderRadius: 7 }}>
                <span style={{ fontSize: 13, color: D.muted, flex: 1 }}>{item.productName ?? 'Product'}</span>
                <span style={{ fontSize: 12, color: D.sub, marginRight: 10 }}>{item.quantity} {item.unitSymbol || 'pc'}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: D.accent }}>₹{fmt(item.sellingPrice * item.quantity)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit button for drafts */}
      {isDraft && (
        <div style={{ borderTop: `1px solid ${D.border}`, padding: '8px 14px', background: D.bg, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => onEdit(String(order.customerId))}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: `${D.accent}22`, border: `1px solid ${D.accent}44`, borderRadius: 8, fontSize: 12, fontWeight: 700, color: D.accent, cursor: 'pointer', fontFamily: 'inherit', touchAction: 'manipulation' }}
          >
            <Edit2 size={13} /> Edit Order
          </button>
        </div>
      )}
    </div>
  );
}

// ── No Order card ──────────────────────────────────────────────
function NoOrderCard({ customer }: { customer: CustomerDto & { skipReason?: string } }) {
  return (
    <div style={{
      background: 'rgba(245,158,11,0.08)', borderRadius: 12, overflow: 'hidden',
      border: `1px solid ${D.amber}44`, marginBottom: 8,
    }}>
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Ban size={17} color={D.amber} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: D.text }}>{customer.nameEnglish}</p>
          {customer.nameMalayalam && (
            <p style={{ margin: '1px 0 0', fontSize: 12, color: D.sub }} lang="ml">{customer.nameMalayalam}</p>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
            {customer.address && (
              <span style={{ fontSize: 11, color: D.amber, display: 'flex', alignItems: 'center', gap: 3 }}>
                <MapPin size={11} />{customer.address}
              </span>
            )}
          </div>
          {(customer as any).skipReason && (
            <p style={{ margin: '4px 0 0', fontSize: 11, color: D.amber, background: 'rgba(245,158,11,0.10)', padding: '3px 8px', borderRadius: 5 }}>
              Note: {(customer as any).skipReason}
            </p>
          )}
        </div>
        <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 20, background: 'rgba(245,158,11,0.15)', color: D.amber, fontWeight: 700, flexShrink: 0 }}>
          No Order
        </span>
      </div>
      {customer.phoneNumber && (
        <a
          href={`tel:${customer.phoneNumber}`}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '10px', borderTop: `1px solid ${D.amber}44`,
            background: 'rgba(245,158,11,0.05)', color: D.amber, fontWeight: 700, fontSize: 13,
            textDecoration: 'none',
          }}
        >
          <Phone size={14} /> Call {customer.phoneNumber}
        </a>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
export default function SalesmanOrders() {
  const { routeId } = useParams<{ routeId: string }>();
  const navigate    = useNavigate();
  const location    = useLocation();
  const { user }    = useAuthStore();
  const isMobile    = useIsMobile();

  const [route,        setRoute]        = useState<RouteDto | null>(null);
  const [customers,    setCustomers]    = useState<CustomerDto[]>([]);
  const [orders,       setOrders]       = useState<OrderDto[]>([]);
  const [noOrderCustomers, setNoOrderCustomers] = useState<CustomerDto[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [error,        setError]        = useState('');
  const [successMsg,   setSuccessMsg]   = useState('');
  const [submittingAll, setSubmittingAll] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  async function load() {
    if (!routeId || routeId === 'NaN' || routeId === 'undefined') {
      setError('Invalid route selected.');
      setLoading(false);
      return;
    }
    setLoading(true); setError('');
    try {
      const [r, c, o] = await Promise.all([
        routesApi.getById(routeId),
        customersApi.list(routeId),
        ordersApi.getByRoute(routeId),
      ]);
      setRoute(r);
      setCustomers(c);
      const todayOrders = o
        .filter(order => order.orderDate?.startsWith(today))
        .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
      setOrders(todayOrders);

      // Get NoOrder customers from today's execution
      try {
        const exec = await routesApi.getCurrentExecution(routeId);
        if (exec?.customers) {
          const noOrderIds = new Set(
            exec.customers
              .filter(v => v.visitStatus === 'NoOrder')
              .map(v => String(v.customerId))
          );
          const noOrderCusts = c.filter(cu => noOrderIds.has(String(cu.id)));
          setNoOrderCustomers(noOrderCusts);
        }
      } catch { setNoOrderCustomers([]); }

    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [routeId, location.state]);

  const handleSubmitAll = async () => {
    const drafts = orders.filter(o => o.status === OrderStatus.Draft);
    if (drafts.length === 0) { setError('No draft orders to submit.'); return; }
    setSubmittingAll(true); setError('');
    try {
      for (const order of drafts) await ordersApi.submit(String(order.id));
      setSuccessMsg(`${drafts.length} order${drafts.length > 1 ? 's' : ''} submitted ✓`);
      await load();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Submission failed');
    } finally { setSubmittingAll(false); }
  };

  const draftCount    = orders.filter(o => o.status === OrderStatus.Draft).length;
  const pendingCount  = orders.filter(o => o.status === OrderStatus.PendingApproval).length;
  const approvedCount = orders.filter(o => [OrderStatus.Approved, OrderStatus.Packed].includes(o.status)).length;
  const closedCount   = orders.filter(o => o.status === OrderStatus.Closed).length;
  const totalAmount   = orders.reduce((s, o) => s + (o.totalAmount ?? 0), 0);

  const filteredOrders = orders.filter(order => {
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    if (!search) return true;
    return order.customerName?.toLowerCase().includes(search.toLowerCase()) ||
           order.customerNameMalayalam?.toLowerCase().includes(search.toLowerCase());
  });

  const orderedCustomerIds = new Set(orders.map(o => String(o.customerId)));
  const unvisitedCustomers = customers.filter(c =>
    !orderedCustomerIds.has(String(c.id)) &&
    !noOrderCustomers.some(nc => String(nc.id) === String(c.id))
  );

  if (loading) return (
    <div style={{ minHeight: '100vh', background: D.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner size={40} />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: D.bg, paddingBottom: 100 }}>

      {/* ── Sticky header ───────────────────────────────── */}
      <div style={{ position: 'sticky', top: isMobile ? 'var(--mobile-nav-h, 70px)' : 'var(--nav-h, 64px)', zIndex: 20, background: `linear-gradient(135deg, ${D.accent}, ${D.accentH})` }}>
        <div style={{ padding: '12px 14px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => navigate('/salesman/routes')}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.20)', border: 'none', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', touchAction: 'manipulation' }}
              >
                <ArrowLeft size={15} /> Routes
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={load} style={{ background: 'rgba(255,255,255,0.20)', border: 'none', borderRadius: 8, padding: '7px 10px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', touchAction: 'manipulation' }}>
                <RefreshCw size={13} /> Refresh
              </button>
              {draftCount > 0 && (
                <button
                  onClick={handleSubmitAll}
                  disabled={submittingAll}
                  style={{ background: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', color: D.accent, cursor: submittingAll ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800, fontFamily: 'inherit', touchAction: 'manipulation', opacity: submittingAll ? 0.6 : 1 }}
                >
                  {submittingAll ? <Spinner size={13} /> : <Send size={13} />}
                  Submit All ({draftCount})
                </button>
              )}
            </div>
          </div>

          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
            {route?.name ?? 'Route Orders'}
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
            {customers.length} customers · ₹{fmt(totalAmount)} total · {today}
          </p>
        </div>

        {/* Stats strip */}
        <div style={{ display: 'flex', gap: 0, background: 'rgba(0,0,0,0.15)', overflowX: 'auto', padding: '0 14px 10px' }}>
          {[
            { label: 'All', val: orders.length, active: statusFilter === 'all', onClick: () => setStatusFilter('all') },
            { label: 'Draft', val: draftCount, active: statusFilter === OrderStatus.Draft, onClick: () => setStatusFilter(OrderStatus.Draft) },
            { label: 'Pending', val: pendingCount, active: statusFilter === OrderStatus.PendingApproval, onClick: () => setStatusFilter(OrderStatus.PendingApproval) },
            { label: 'Approved', val: approvedCount, active: statusFilter === OrderStatus.Approved, onClick: () => setStatusFilter(OrderStatus.Approved) },
            { label: 'Closed', val: closedCount, active: statusFilter === OrderStatus.Closed, onClick: () => setStatusFilter(OrderStatus.Closed) },
          ].map(s => (
            <button key={s.label} onClick={s.onClick} style={{ flexShrink: 0, background: s.active ? '#fff' : 'rgba(255,255,255,0.18)', border: 'none', borderRadius: 20, padding: '4px 12px', marginRight: 6, color: s.active ? D.accent : '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', touchAction: 'manipulation' }}>
              {s.label} {s.val}
            </button>
          ))}
        </div>

        {/* Progress bar */}
        {customers.length > 0 && (
          <div style={{ margin: '0 14px 10px' }}>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.25)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${(orders.length / customers.length) * 100}%`, height: '100%', background: '#fff', borderRadius: 2, transition: 'width 0.4s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>Order Progress</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', fontWeight: 700 }}>{orders.length} of {customers.length} customers</span>
            </div>
          </div>
        )}

        {/* Search */}
        <div style={{ margin: '0 14px 12px', position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.6)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customer or order..."
            style={{ width: '100%', padding: '8px 34px 8px 32px', background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, fontSize: 13, color: '#fff', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: 2, touchAction: 'manipulation' }}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div style={{ margin: '10px 10px 0', padding: '10px 14px', background: 'rgba(239,68,68,0.10)', border: `1px solid ${D.red}33`, borderRadius: 10, color: D.red, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: D.red, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
        </div>
      )}
      {successMsg && (
        <div style={{ margin: '10px 10px 0', padding: '10px 14px', background: 'rgba(34,197,94,0.10)', border: `1px solid ${D.green}33`, borderRadius: 10, color: D.green, fontSize: 13, fontWeight: 700 }}>
          {successMsg}
        </div>
      )}

      <div style={{ padding: '10px 10px' }}>

        {/* ── Today's Orders ─────────────────────────────────── */}
        {filteredOrders.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: D.muted, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5 }}>
              <ClipboardList size={13} /> Today's Orders ({filteredOrders.length})
            </p>
            {filteredOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                routeId={routeId!}
                onEdit={(cid) => navigate(`/salesman/routes/${routeId}/order/${cid}`)}
              />
            ))}
          </div>
        )}

        {/* Empty orders state */}
        {filteredOrders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 20px', background: D.surface, borderRadius: 12, border: `1px solid ${D.border}`, marginBottom: 16 }}>
            <Package size={40} color={D.border} style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 14, color: D.muted, margin: 0 }}>
              {search || statusFilter !== 'all' ? 'No orders match your filters' : 'No orders today yet'}
            </p>
            {(search || statusFilter !== 'all') && (
              <button onClick={() => { setSearch(''); setStatusFilter('all'); }} style={{ marginTop: 8, fontSize: 12, color: D.accent, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* ── No Order section ───────────────────────────────── */}
        {noOrderCustomers.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: D.amber, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Ban size={13} /> No Order Shops ({noOrderCustomers.length})
            </p>
            <div style={{ marginBottom: 8, padding: '8px 12px', background: 'rgba(245,158,11,0.08)', border: `1px solid ${D.amber}44`, borderRadius: 8, fontSize: 12, color: D.amber }}>
              💡 These shops were visited but had no orders today. You or admin can call them to follow up.
            </div>
            {noOrderCustomers.map(c => (
              <NoOrderCard key={c.id} customer={c} />
            ))}
          </div>
        )}

        {/* ── Unvisited customers ────────────────────── */}
        {unvisitedCustomers.length > 0 && !search && (
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: D.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Remaining Shops ({unvisitedCustomers.length})
            </p>
            {unvisitedCustomers.map(c => (
              <div key={c.id} style={{ background: D.surface, borderRadius: 10, border: `1px solid ${D.border}`, padding: '10px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: D.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <User size={16} color={D.sub} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: D.text }}>{c.nameEnglish}</p>
                  {c.nameMalayalam && <p style={{ margin: '1px 0 0', fontSize: 11, color: D.sub }} lang="ml">{c.nameMalayalam}</p>}
                </div>
                <button
                  onClick={() => navigate(`/salesman/routes/${routeId}/order/${c.id}`)}
                  style={{ padding: '6px 12px', background: `linear-gradient(135deg, ${D.accent}, ${D.accentH})`, color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', touchAction: 'manipulation', flexShrink: 0 }}
                >
                  + Order
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}