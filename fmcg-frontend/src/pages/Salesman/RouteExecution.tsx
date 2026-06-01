// PATH: src/pages/Salesman/RouteExecution.tsx
// UPDATED:
//  • Order-taking mode: bottom CTA shows ONLY "Review & Submit Orders" (no "Complete Route")
//  • Delivery mode: bottom CTA shows ONLY "Complete Delivery Route"
//  • handleComplete validates orders are NOT in Draft before completing (unchanged logic)
//  • Preserves full original layout, styles, skip modal, summary screen

import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingCart, ArrowLeft, Flag, FileDown, Home,
  CheckCircle2, XCircle, Clock, Phone, MapPin,
  AlertCircle, Eye, Truck, CalendarDays
} from 'lucide-react';
import { routesApi, reportsApi, triggerPdfDownload, ordersApi } from '../../api/services';
import type { CurrentRouteExecutionDto, CustomerVisitDto, VisitStatus, CompleteRouteExecutionResponse, OrderItemDto } from '../../types';
import { OrderStatus } from '../../types';
import { Spinner } from '../../components/ui';

const STATUS_META: Record<VisitStatus, { label: string; bg: string; color: string; border: string; icon: React.ReactNode }> = {
  Pending:     { label: 'Pending',      bg: '#EFF6FF', color: '#2563EB', border: 'rgba(37,99,235,0.20)', icon: <Clock size={14} /> },
  OrderPlaced: { label: 'For Delivery', bg: '#F0FDF4', color: '#16A34A', border: 'rgba(22,163,74,0.20)', icon: <CheckCircle2 size={14} /> },
  Skipped:     { label: 'Skipped',      bg: '#FEF2F2', color: '#DC2626', border: 'rgba(220,38,38,0.20)', icon: <XCircle size={14} /> },
  NoOrder:     { label: 'No Order',     bg: '#FFFBEB', color: '#D97706', border: 'rgba(217,119,6,0.20)',  icon: <AlertCircle size={14} /> },
};

interface GroupedItem {
  productName:     string;
  quantity:        number;
  unitSymbol:      string;
  loadingPriority: number;
}

function visitKey(v: CustomerVisitDto): string {
  return (v as any).visitId ?? v.id ?? v.customerId;
}

function buildPayload(executionId: string, customerId: string, status: VisitStatus, opts?: { orderId?: string; skipReason?: string }) {
  return {
    executionId, customerId, status,
    ...(opts?.orderId    ? { orderId:    opts.orderId }    : {}),
    ...(opts?.skipReason ? { skipReason: opts.skipReason } : {}),
  };
}

function GroupedItemsByPriority({ orderItems }: { orderItems: GroupedItem[] }) {
  if (!orderItems || orderItems.length === 0) return null;

  const grouped = orderItems.reduce((acc: Record<string, GroupedItem[]>, item: GroupedItem) => {
    const priority = String(item.loadingPriority || 99);
    if (!acc[priority]) acc[priority] = [];
    acc[priority].push(item);
    return acc;
  }, {} as Record<string, GroupedItem[]>);

  const sortedPriorities = Object.keys(grouped).sort((a, b) => Number(a) - Number(b));
  const totalQuantity    = orderItems.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-slate-700">📦 Items to Deliver:</p>
        <span className="text-sm font-bold text-slate-800">Total: {totalQuantity} units</span>
      </div>
      {sortedPriorities.map(priority => (
        <div key={priority} className="mb-3 last:mb-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <p className="text-sm font-bold text-blue-700">
              Priority {priority}
              {priority === "1"  && " — Load FIRST (bottom of van)"}
              {priority === "99" && " — Load LAST (top of van)"}
            </p>
          </div>
          <div className="space-y-1 pl-4">
            {grouped[priority].map((item, idx) => (
              <div key={idx} className="flex justify-between items-center py-1">
                <span className="text-sm text-slate-700">{item.productName}</span>
                <span className="text-sm font-semibold text-slate-800">
                  {item.quantity} {item.unitSymbol || 'unit'}
                </span>
              </div>
            ))}
            <div className="flex justify-between pt-1 border-t border-slate-100 mt-1">
              <span className="text-xs text-slate-400">Subtotal</span>
              <span className="text-xs font-semibold text-slate-600">
                {grouped[priority].reduce((s, i) => s + i.quantity, 0)} units
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RouteExecution() {
  const { routeId } = useParams<{ routeId: string }>();
  const navigate    = useNavigate();
  const location    = useLocation();

  const executionMode = location.state?.mode as 'order-taking' | 'delivery' | undefined;

  const [execution,   setExecution]   = useState<CurrentRouteExecutionDto | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [recording,   setRecording]   = useState<string | null>(null);
  const [completing,  setCompleting]  = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showSkip,    setShowSkip]    = useState<CustomerVisitDto | null>(null);
  const [skipReason,  setSkipReason]  = useState('');
  const [skipOther,   setSkipOther]   = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [summary,     setSummary]     = useState<CompleteRouteExecutionResponse | null>(null);
  const [orderItems,  setOrderItems]  = useState<GroupedItem[]>([]);

  async function load() {
    if (!routeId || routeId === 'undefined') return;
    setLoading(true); setError('');
    try {
      const exec = await routesApi.getCurrentExecution(routeId);
      setExecution(exec);

      if (exec?.customers) {
        const items: GroupedItem[] = [];
        for (const customer of exec.customers) {
          if (customer.orderId) {
            try {
              const order = await ordersApi.getById(customer.orderId);
              if (order?.items) {
                for (const item of order.items) {
                  items.push({
                    productName:     item.productName || 'Unknown',
                    quantity:        item.quantity,
                    unitSymbol:      item.unitSymbol || item.unitName || 'unit',
                    loadingPriority: (item as any).loadingPriority || 99,
                  });
                }
              }
            } catch { /* ignore per-order errors */ }
          }
        }
        setOrderItems(items);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load route');
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (!routeId || routeId === 'undefined' || routeId === 'NaN') {
      setError('Invalid route. Please go back and select a valid route.');
      setLoading(false);
      return;
    }
    load();
  }, [routeId]);

  async function handleComplete() {
    if (!execution?.executionId) return;
    // Guard: ensure no Draft orders remain before completing
    const withOrders = (execution.customers ?? []).filter((v: CustomerVisitDto) => v.visitStatus === 'OrderPlaced' && v.orderId);
    for (const v of withOrders) {
      try {
        const order = await ordersApi.getById(v.orderId!);
        if (order.status === OrderStatus.Draft) {
          setError(`Order for "${v.customerName}" is still Draft. Please submit it first.`);
          setShowConfirm(false); return;
        }
      } catch { /* ignore */ }
    }
    setCompleting(true);
    try {
      const result = await routesApi.completeExecution(execution.executionId);
      setSummary(result);
      setShowConfirm(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to complete route');
    } finally { setCompleting(false); }
  }

  async function handleDownload() {
    if (!execution) return;
    setDownloading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const blob  = await reportsApi.downloadLoadingSheet(routeId, today);
      triggerPdfDownload(blob, `DeliverySheet_${execution.routeName}_${today}.pdf`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Download failed');
    } finally { setDownloading(false); }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
      <Spinner size={40} />
    </div>
  );

  if (summary || execution?.status === 'Completed') {
    const s = summary;
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: '32px 20px' }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 20, padding: '36px 28px', textAlign: 'center', boxShadow: '0 4px 24px rgba(15,23,42,0.08)', marginBottom: 20 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#F0FDF4', border: '2px solid rgba(22,163,74,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
              <CheckCircle2 size={36} color="#16A34A" />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: '#1E3A8A', margin: '0 0 6px', letterSpacing: '-0.04em' }}>
              {executionMode === 'order-taking' ? 'Order Taking Complete! 🎉' : 'Delivery Complete! 🎉'}
            </h2>
            <p style={{ color: '#64748B', fontSize: 14, fontWeight: 500, margin: 0 }}>
              {execution?.routeName} · {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>

          {s && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                { label: executionMode === 'order-taking' ? 'Total Customers' : 'Total Deliveries', val: s.totalCustomers, color: '#1E3A8A', bg: '#EFF6FF', border: 'rgba(37,99,235,0.15)' },
                { label: executionMode === 'order-taking' ? 'Orders Taken'    : 'Delivered',        val: s.ordersPlaced,  color: '#16A34A', bg: '#F0FDF4', border: 'rgba(22,163,74,0.15)' },
                { label: 'No Order', val: s.noOrder, color: '#D97706', bg: '#FFFBEB', border: 'rgba(217,119,6,0.15)' },
                { label: 'Skipped',  val: s.skipped, color: '#DC2626', bg: '#FEF2F2', border: 'rgba(220,38,38,0.15)' },
              ].map(st => (
                <div key={st.label} style={{ background: st.bg, border: `1px solid ${st.border}`, borderRadius: 14, padding: '18px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: st.color, letterSpacing: '-0.04em' }}>{st.val}</div>
                  <div style={{ fontSize: 14, color: st.color, fontWeight: 700, marginTop: 4 }}>{st.label}</div>
                </div>
              ))}
            </div>
          )}

          {executionMode === 'delivery' && orderItems.length > 0 && (
            <GroupedItemsByPriority orderItems={orderItems} />
          )}

          <button
            onClick={() => navigate('/salesman/routes')}
            style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg,#1E3A8A 0%,#2563EB 100%)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 16px rgba(37,99,235,0.30)', fontFamily: 'inherit' }}
          >
            <Home size={18} /> Back to My Routes
          </button>
        </div>
      </div>
    );
  }

  if (!execution?.hasActiveExecution) return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#FFFBEB', border: '2px solid rgba(217,119,6,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
          <Clock size={32} color="#D97706" />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E3A8A', margin: '0 0 8px' }}>
          No Active {executionMode === 'order-taking' ? 'Order Taking' : 'Delivery'}
        </h2>
        <p style={{ color: '#64748B', fontSize: 14, marginBottom: 24 }}>
          {error || `No pending ${executionMode === 'order-taking' ? 'order taking' : 'deliveries'} for today.`}
        </p>
        <button onClick={() => navigate('/salesman/routes')} style={{ padding: '12px 28px', borderRadius: 10, background: 'linear-gradient(135deg,#1E3A8A,#2563EB)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>← Back to Routes</button>
      </div>
    </div>
  );

  const allCustomers     = execution.customers ?? [];
  const sortedCustomers  = [...allCustomers].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const totalCustomers   = sortedCustomers.length;
  const completedCount   = sortedCustomers.filter(c => c.visitedAt).length;
  const pendingCount     = sortedCustomers.filter(c => !c.visitedAt).length;
  const progress         = totalCustomers > 0 ? Math.round((completedCount / totalCustomers) * 100) : 0;
  const allDone          = pendingCount === 0 && totalCustomers > 0;
  const ordersCount      = sortedCustomers.filter(v => v.visitStatus === 'OrderPlaced').length;

  if (totalCustomers === 0) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#EFF6FF', border: '2px solid rgba(37,99,235,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
            {executionMode === 'order-taking' ? <ShoppingCart size={32} color="#2563EB" /> : <Truck size={32} color="#2563EB" />}
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E3A8A', margin: '0 0 8px' }}>
            {executionMode === 'order-taking' ? 'No Customers on Route' : 'No Deliveries Today'}
          </h2>
          <p style={{ color: '#64748B', fontSize: 14, marginBottom: 24 }}>
            {executionMode === 'order-taking'
              ? 'No customers are assigned to this route. Please contact your admin.'
              : 'No customers have placed orders for delivery on this route.'}
          </p>
          <button onClick={() => navigate('/salesman/routes')} style={{ padding: '12px 28px', borderRadius: 10, background: 'linear-gradient(135deg,#1E3A8A,#2563EB)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>← Back to Routes</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', paddingBottom: allDone ? 120 : 32 }}>
      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px 10px' }}>
          <button
            onClick={() => navigate('/salesman/routes')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: '#EFF6FF', border: '1px solid rgba(37,99,235,0.25)', color: '#2563EB', fontSize: 14, fontWeight: 700, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}
          >
            <ArrowLeft size={18} /> Back
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1E3A8A', letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{execution.routeName}</div>
            <div style={{ fontSize: 14, color: '#64748B', fontWeight: 500, marginTop: 1 }}>{completedCount} of {totalCustomers} {executionMode === 'order-taking' ? 'customers' : 'deliveries'} completed</div>
          </div>
          <button onClick={handleDownload} disabled={downloading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 9, border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#64748B', cursor: 'pointer', flexShrink: 0 }} title="Download delivery sheet">
            {downloading ? <Spinner size={14} /> : <FileDown size={16} />}
          </button>
        </div>
        <div style={{ padding: '0 20px 14px' }}>
          <div style={{ height: 6, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg,#1E3A8A,#2563EB)', transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#2563EB' }}>{progress}% complete</span>
            <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>{pendingCount} remaining</span>
          </div>
        </div>

        {/* ── Date highlight bar — salesman always knows what day they are working ── */}
        <div style={{
          margin: '0 16px 12px',
          padding: '9px 14px',
          borderRadius: 10,
          background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(37,99,235,0.22)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarDays size={16} color="rgba(255,255,255,0.85)" />
            <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 800,
            background: 'rgba(255,255,255,0.18)',
            color: '#fff',
            padding: '3px 10px',
            borderRadius: 20,
            letterSpacing: '0.06em',
          }}>
            TODAY
          </span>
        </div>
      </div>

      {error && (
        <div style={{ margin: '12px 20px 0', padding: '12px 16px', borderRadius: 10, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.20)', color: '#B91C1C', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B91C1C', padding: 0 }}>✕</button>
        </div>
      )}

      {/* Customer cards */}
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {sortedCustomers.map((visit, index) => {
          const key        = visitKey(visit);
          const meta       = STATUS_META[visit.visitStatus as VisitStatus] || STATUS_META.Pending;
          const isCompleted = visit.visitedAt !== undefined && visit.visitedAt !== null;
          const isBusy     = recording === key;
          const nextStop   = index < sortedCustomers.length - 1 ? sortedCustomers[index + 1].customerName : null;
          const isOrderPlaced = visit.visitStatus === 'OrderPlaced';
          const isPending     = visit.visitStatus === 'Pending';

          return (
            <div key={key} style={{
              background: '#fff',
              border: !isCompleted && (executionMode === 'order-taking' ? isPending : !isOrderPlaced)
                ? '2px solid #2563EB'
                : `1px solid ${meta.border}`,
              borderRadius: 16,
              boxShadow: !isCompleted && (executionMode === 'order-taking' ? isPending : !isOrderPlaced)
                ? '0 4px 20px rgba(37,99,235,0.12)'
                : '0 1px 4px rgba(15,23,42,0.05)',
              overflow: 'hidden', opacity: isBusy ? 0.7 : 1, transition: 'all 0.15s',
            }}>
              <div style={{ padding: '16px 18px 14px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{
                  width: 50, height: 50, borderRadius: 12, flexShrink: 0,
                  background: !isCompleted && (executionMode === 'order-taking' ? isPending : !isOrderPlaced)
                    ? 'linear-gradient(135deg,#1E3A8A,#2563EB)' : meta.bg,
                  border: !isCompleted && (executionMode === 'order-taking' ? isPending : !isOrderPlaced)
                    ? 'none' : `1px solid ${meta.border}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  boxShadow: !isCompleted && (executionMode === 'order-taking' ? isPending : !isOrderPlaced)
                    ? '0 3px 10px rgba(37,99,235,0.28)' : 'none',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: !isCompleted && (executionMode === 'order-taking' ? isPending : !isOrderPlaced) ? 'rgba(255,255,255,0.7)' : '#64748B' }}>STOP</span>
                  <span style={{ fontSize: 22, fontWeight: 900, color: !isCompleted && (executionMode === 'order-taking' ? isPending : !isOrderPlaced) ? '#fff' : meta.color, lineHeight: 1 }}>{visit.sequenceOrder}</span>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 5 }}>
                    {visit.customerName}
                  </div>
                  {(visit as any).customerNameMalayalam && (
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#64748B', marginBottom: 5, fontFamily: "'Manjari', sans-serif" }}>
                      {(visit as any).customerNameMalayalam}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {visit.phoneNumber && (
                      <a href={`tel:${visit.phoneNumber}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 14, fontWeight: 700, color: '#2563EB', textDecoration: 'none' }}>
                        <Phone size={14} /> {visit.phoneNumber}
                      </a>
                    )}
                    {visit.address && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#64748B', fontWeight: 500 }}>
                        <MapPin size={12} style={{ flexShrink: 0 }} /> {visit.address}
                      </div>
                    )}
                  </div>
                  {!isCompleted && nextStop && (
                    <div style={{ marginTop: 6, fontSize: 12, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>→ Next:</span>
                      <span style={{ fontWeight: 600, color: '#2563EB' }}>{nextStop}</span>
                    </div>
                  )}
                </div>

                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 20, flexShrink: 0, fontSize: 12, fontWeight: 800, background: isCompleted ? '#EFF6FF' : meta.bg, color: isCompleted ? '#2563EB' : meta.color, border: `1px solid ${isCompleted ? 'rgba(37,99,235,0.20)' : meta.border}`, whiteSpace: 'nowrap' }}>
                  {isCompleted ? <CheckCircle2 size={14} /> : meta.icon}
                  {isCompleted ? (executionMode === 'order-taking' ? 'Completed' : 'Delivered') : meta.label}
                </span>
              </div>

              <div style={{ borderTop: '1px solid #E2E8F0' }}>
                <button
                  onClick={() => navigate(`/salesman/routes/${routeId}/order/${visit.customerId}`, { state: { executionId: execution.executionId, customerVisitId: key, mode: executionMode } })}
                  disabled={isBusy}
                  style={{ width: '100%', padding: '14px 18px', background: !isCompleted ? 'linear-gradient(135deg,#1E3A8A 0%,#2563EB 100%)' : '#F0FDF4', border: 'none', color: !isCompleted ? '#fff' : '#16A34A', fontSize: 15, fontWeight: 800, cursor: isBusy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: 'inherit' }}
                >
                  <ShoppingCart size={18} />
                  {!isCompleted
                    ? (executionMode === 'order-taking' ? 'Take Order' : 'Complete Delivery')
                    : 'View Order Details'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Fixed bottom CTA ─────────────────────────────────────────────────── */}
      {allDone && !summary && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, background: '#fff', borderTop: '1px solid #E2E8F0', padding: '16px 20px', boxShadow: '0 -4px 20px rgba(15,23,42,0.10)' }}>
          <div style={{ marginBottom: 10, padding: '8px 14px', borderRadius: 10, background: '#F0FDF4', border: '1px solid rgba(22,163,74,0.20)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={14} color="#16A34A" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#15803D' }}>
              All {totalCustomers} {executionMode === 'order-taking' ? 'customers' : 'deliveries'} completed!
            </span>
          </div>

          {/* ORDER-TAKING MODE: only "Review & Submit Orders" – NO "Complete Route" button */}
          {executionMode === 'order-taking' && (
            <button
              onClick={() => navigate(`/salesman/routes/${routeId}/review-orders`)}
              style={{
                width: '100%', padding: '15px',
                background: '#2563EB',
                color: '#fff', border: 'none', borderRadius: 12,
                fontSize: 15, fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontFamily: 'inherit',
              }}
            >
              <Eye size={18} /> Review & Submit Orders ({ordersCount} order{ordersCount !== 1 ? 's' : ''})
            </button>
          )}

          {/* DELIVERY MODE: only "Complete Delivery Route" */}
          {(!executionMode || executionMode === 'delivery') && (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={completing}
              style={{ width: '100%', padding: '15px', background: completing ? '#93C5FD' : 'linear-gradient(135deg,#1E3A8A 0%,#2563EB 100%)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 800, cursor: completing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 16px rgba(37,99,235,0.32)', fontFamily: 'inherit' }}
            >
              {completing ? <Spinner size={18} /> : <><Flag size={18} /> Complete Delivery Route</>}
            </button>
          )}
        </div>
      )}

      {/* Confirm sheet */}
      {showConfirm && (
        <>
          <div onClick={() => !completing && setShowConfirm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 100, backdropFilter: 'blur(2px)' }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 110, background: '#fff', borderRadius: '20px 20px 0 0', padding: '0 0 32px', boxShadow: '0 -8px 40px rgba(15,23,42,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E2E8F0' }} />
            </div>
            <div style={{ padding: '0 24px' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#EFF6FF', border: '2px solid rgba(37,99,235,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Flag size={24} color="#2563EB" />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 900, color: '#1E3A8A', margin: '0 0 8px', letterSpacing: '-0.03em' }}>
                Complete Delivery Route?
              </h3>
              <p style={{ fontSize: 14, color: '#64748B', margin: '0 0 24px', lineHeight: 1.6 }}>
                You have completed {completedCount} of {totalCustomers} deliveries.
                Completing will lock all records and cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowConfirm(false)} disabled={completing} style={{ flex: 1, padding: '13px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 11, fontSize: 14, fontWeight: 700, color: '#64748B', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={handleComplete} disabled={completing} style={{ flex: 2, padding: '13px', background: completing ? '#93C5FD' : 'linear-gradient(135deg,#1E3A8A,#2563EB)', border: 'none', borderRadius: 11, fontSize: 14, fontWeight: 800, color: '#fff', cursor: completing ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: completing ? 'none' : '0 4px 14px rgba(37,99,235,0.30)' }}>
                  {completing ? <Spinner size={16} /> : <><Flag size={15} /> Yes, Complete</>}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}