// PATH: src/pages/Salesman/RouteExecution.tsx
// UPDATED: Red borders for pending, orange Take Order button

import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingCart, ArrowLeft, Flag, Home,
  CheckCircle2, XCircle, Clock, Phone, MapPin,
  AlertCircle, Eye, CalendarDays, ChevronRight, Search, X, RotateCcw, Check,
} from 'lucide-react';
import { routesApi, ordersApi } from '../../api/services';
import type { CurrentRouteExecutionDto, CustomerVisitDto, VisitStatus, CompleteRouteExecutionResponse } from '../../types';
import { OrderStatus } from '../../types';
import { Spinner } from '../../components/ui';
import { useIsMobile } from '../../hooks/useIsMobile';

// ── Dark theme tokens ─────────────────────────────────────────────────────────
const D = {
  bg:       '#0f172a',
  surface:  '#1e293b',
  surface2: '#243447',
  border:   '#334155',
  accent:   '#ea580c',        // Orange for Take Order button
  accentH:  '#c2410c',        // Darker orange on hover
  accentGlow: 'rgba(234,88,12,0.25)',
  text:     '#f1f5f9',
  muted:    '#94a3b8',
  sub:      '#64748b',
  green:    '#22c55e',
  red:      '#ef4444',        // Red for pending cards
  redGlow:  'rgba(239,68,68,0.20)',
  blue:     '#2563eb',
  amber:    '#f59e0b',
  card:     '#1e293b',
};

const STATUS_META: Record<VisitStatus, { label: string; bg: string; color: string; border: string; icon: React.ReactNode }> = {
  Pending:     { label: 'Pending',    bg: 'rgba(239,68,68,0.10)', color: D.red, border: 'rgba(239,68,68,0.30)', icon: <Clock size={14} /> },
  OrderPlaced: { label: 'Order Done', bg: 'rgba(34,197,94,0.12)', color: D.green, border: 'rgba(34,197,94,0.25)', icon: <CheckCircle2 size={14} /> },
  Skipped:     { label: 'Skipped',    bg: 'rgba(239,68,68,0.12)', color: D.red, border: 'rgba(239,68,68,0.25)', icon: <XCircle size={14} /> },
  NoOrder:     { label: 'No Order',   bg: 'rgba(239,68,68,0.12)', color: D.red, border: 'rgba(239,68,68,0.25)', icon: <AlertCircle size={14} /> },
};

export default function RouteExecution() {
  const { routeId } = useParams<{ routeId: string }>();
  const navigate    = useNavigate();
  const location    = useLocation();
  const executionMode = location.state?.mode as 'order-taking' | 'delivery' | undefined;
  const isMobile = useIsMobile();

  const [execution,   setExecution]   = useState<CurrentRouteExecutionDto | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [successMsg,  setSuccessMsg]  = useState('');
  const [recording,   setRecording]   = useState<string | null>(null);
  const [completing,  setCompleting]  = useState(false);
  const [showSkip,    setShowSkip]    = useState<CustomerVisitDto | null>(null);
  const [skipReason,  setSkipReason]  = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState<CustomerVisitDto | null>(null);
  const [resetting,   setResetting]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [summary,     setSummary]     = useState<CompleteRouteExecutionResponse | null>(null);
  const [orderData,   setOrderData]   = useState<Record<string, any>>({});
  const [nextCustomer, setNextCustomer] = useState<string | null>(null);
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | VisitStatus>('All');

  async function load() {
    if (!routeId || routeId === 'undefined') return;
    setLoading(true); setError(''); setSuccessMsg(''); setNextCustomer(null);
    setActiveCustomerId(null);
    try {
      const exec = await routesApi.getCurrentExecution(routeId);

      if (exec && exec.status && exec.status !== 'InProgress') {
        navigate('/salesman/routes', { replace: true });
        return;
      }

      setExecution(exec);
      
      if (exec?.customers) {
        const sorted = [...exec.customers].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
        const nextPending = sorted.find(c => c.visitStatus === 'Pending');
        if (nextPending) {
          setNextCustomer(nextPending.customerName);
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load route');
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (!routeId || routeId === 'undefined' || routeId === 'NaN') {
      setError('Invalid route. Please go back.'); setLoading(false); return;
    }
    load();
  }, [routeId]);

  function getNextPendingCustomer(currentCustomerId: string): CustomerVisitDto | null {
    if (!execution?.customers) return null;
    const sorted = [...execution.customers].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    const currentIndex = sorted.findIndex(c => c.customerId === currentCustomerId);
    for (let i = currentIndex + 1; i < sorted.length; i++) {
      if (sorted[i].visitStatus === 'Pending') {
        return sorted[i];
      }
    }
    return null;
  }

  function scrollToNextCustomer(customerId: string) {
    setTimeout(() => {
      const element = document.getElementById(`customer-${customerId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.style.transition = 'border-color 0.3s, box-shadow 0.3s';
        element.style.borderColor = '#ef4444';
        element.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.25)';
        setTimeout(() => {
          element.style.borderColor = '';
          element.style.boxShadow = '';
        }, 1500);
      }
    }, 300);
  }

  async function markNoOrder(visit: CustomerVisitDto) {
    if (!execution?.executionId) {
      setError('No active execution found.');
      return;
    }
    
    if (execution.status === 'Completed') {
      navigate('/salesman/routes', { replace: true });
      return;
    }
    
    if (visit.visitStatus !== 'Pending') {
      setError(`This customer is already marked as ${visit.visitStatus}`);
      return;
    }
    
    if (recording === visit.customerId) return;
    
    setRecording(visit.customerId);
    setError('');
    
    try {
      await routesApi.recordVisit({
        executionId: execution.executionId,
        customerId: String(visit.customerId),
        visitStatus: 'NoOrder',
      });
      
      const nextPending = getNextPendingCustomer(visit.customerId);
      await load();
      
      if (nextPending) {
        scrollToNextCustomer(nextPending.customerId);
        setSuccessMsg(`✓ No order recorded for ${visit.customerName}. Moving to ${nextPending.customerName}...`);
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setSuccessMsg(`✓ No order recorded for ${visit.customerName}. All customers visited!`);
        setTimeout(() => setSuccessMsg(''), 3000);
      }
      
    } catch (e: unknown) {
      console.error('[NoOrder] Error:', e);
      const msg = e instanceof Error ? e.message : 'Failed to mark No Order';

      if (msg.toLowerCase().includes('completed') || msg.toLowerCase().includes('refresh the page')) {
        navigate('/salesman/routes', { replace: true });
        return;
      }

      setError(msg);
    } finally {
      setRecording(null);
    }
  }

  async function handleResetVisit(visit: CustomerVisitDto) {
    const visitId = (visit as any).visitId ?? (visit as any).id;
    if (!visitId) { setError('Could not find this visit to reset.'); setShowResetConfirm(null); return; }
    setResetting(true); setError('');
    try {
      await routesApi.resetVisit(String(visitId));
      setShowResetConfirm(null);
      await load();
      setSuccessMsg(`Reset ${visit.customerName} — you can take a new order now.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to reset this stop');
      setShowResetConfirm(null);
    } finally {
      setResetting(false);
    }
  }

  async function markSkipped(visit: CustomerVisitDto, reason: string) {
    if (!execution?.executionId) {
      setError('No active execution found.');
      return;
    }
    
    if (execution.status === 'Completed') {
      navigate('/salesman/routes', { replace: true });
      return;
    }
    
    if (visit.visitStatus !== 'Pending') {
      setError(`This customer is already marked as ${visit.visitStatus}`);
      setShowSkip(null);
      return;
    }
    
    if (recording === visit.customerId) return;
    
    setRecording(visit.customerId);
    setError('');
    
    try {
      await routesApi.recordVisit({
        executionId: execution.executionId,
        customerId: String(visit.customerId),
        visitStatus: 'Skipped',
        skipReason: reason || 'No reason',
      });
      
      setShowSkip(null);
      setSkipReason('');
      
      const nextPending = getNextPendingCustomer(visit.customerId);
      await load();
      
      if (nextPending) {
        scrollToNextCustomer(nextPending.customerId);
        setSuccessMsg(`⏭️ Skipped ${visit.customerName}. Moving to ${nextPending.customerName}...`);
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setSuccessMsg(`⏭️ Skipped ${visit.customerName}. All customers visited!`);
        setTimeout(() => setSuccessMsg(''), 3000);
      }
      
    } catch (e: unknown) {
      console.error('[Skip] Error:', e);
      const msg = e instanceof Error ? e.message : 'Failed to mark Skipped';

      if (msg.toLowerCase().includes('completed') || msg.toLowerCase().includes('refresh the page')) {
        setShowSkip(null);
        navigate('/salesman/routes', { replace: true });
        return;
      }

      setError(msg);
      setShowSkip(null);
    } finally {
      setRecording(null);
    }
  }

  async function handleComplete() {
    if (!execution?.executionId) return;
    const withOrders = (execution.customers ?? []).filter(v => v.visitStatus === 'OrderPlaced' && v.orderId);
    for (const v of withOrders) {
      try {
        const order = await ordersApi.getById(v.orderId!);
        if (order.status === OrderStatus.Draft) {
          setError(`Order for "${v.customerName}" is still Draft. Submit it first.`);
          setShowConfirm(false); return;
        }
      } catch {}
    }
    setCompleting(true);
    try {
      const result = await routesApi.completeExecution(execution.executionId);
      setSummary(result); setShowConfirm(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to complete route');
    } finally { setCompleting(false); }
  }

  async function handlePrint() {
    if (!execution) return;
    const customers = execution.customers ?? [];
    const withOrders = customers.filter(v => v.visitStatus === 'OrderPlaced' && v.orderId);

    const newOrderData: Record<string, any> = {};
    for (const v of withOrders) {
      try { newOrderData[v.customerId] = await ordersApi.getById(v.orderId!); } catch {}
    }
    setOrderData(newOrderData);

    const sorted = [...customers].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    const noOrderList = sorted.filter(v => v.visitStatus === 'NoOrder');
    const skippedList = sorted.filter(v => v.visitStatus === 'Skipped');

    const unitGroups: Record<string, { total: number; byProduct: Record<string, number> }> = {};
    Object.values(newOrderData).forEach((order: any) => {
      (order?.items ?? []).forEach((item: any) => {
        const unit = item.unitSymbol || item.unitName || 'pc';
        const name = item.productName ?? 'Product';
        if (!unitGroups[unit]) unitGroups[unit] = { total: 0, byProduct: {} };
        unitGroups[unit].total += item.quantity;
        unitGroups[unit].byProduct[name] = (unitGroups[unit].byProduct[name] ?? 0) + item.quantity;
      });
    });
    const unitSummary = Object.entries(unitGroups).sort((a, b) => b[1].total - a[1].total);

    const rows = sorted.filter(v => v.visitStatus === 'OrderPlaced').map(visit => {
      const order = newOrderData[visit.customerId];
      const items = order?.items ?? [];
      return `
        <div class="customer-block">
          <div class="customer-header">
            <div>
              <div class="customer-name">Stop ${visit.sequenceOrder} — ${visit.customerName}</div>
              ${visit.address ? `<div class="meta">${visit.address}</div>` : ''}
            </div>
            <div class="meta">${visit.phoneNumber ?? ''}</div>
          </div>
          <table>
            <thead><tr><th>#</th><th>Product</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit</th></tr></thead>
            <tbody>
              ${items.map((item: any, i: number) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${item.productName ?? 'Product'}</td>
                  <td style="text-align:right">${item.quantity}</td>
                  <td style="text-align:right">${item.unitSymbol || item.unitName || 'pc'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
          ${order?.remarks ? `<p class="remarks">📝 ${order.remarks}</p>` : ''}
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><title>Order Sheet — ${execution.routeName}</title><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;font-size:12px;color:#000;background:#fff;padding:15mm 12mm}
      h1{font-size:18px;font-weight:bold;text-align:center;margin-bottom:4px}
      .subtitle{text-align:center;font-size:12px;color:#555;margin-bottom:12px}
      .divider{border-top:2px solid #000;margin:8px 0}
      .summary{display:flex;gap:12px;margin-bottom:14px}
      .summary-box{flex:1;border:1px solid #ccc;padding:8px;text-align:center;border-radius:4px}
      .summary-val{font-size:20px;font-weight:bold}
      .summary-lbl{font-size:10px;color:#666;margin-top:2px}
      .unit-summary{margin:12px 0 16px;border:1px solid #ccc;border-radius:4px;padding:10px 12px;page-break-inside:avoid}
      .unit-summary h2{font-size:13px;margin-bottom:8px}
      .unit-row{display:flex;justify-content:space-between;align-items:baseline;padding:4px 0;border-bottom:1px solid #eee}
      .unit-row:last-child{border-bottom:none}
      .unit-row .unit-name{font-weight:bold;font-size:13px}
      .unit-row .unit-total{font-weight:bold;font-size:13px}
      .unit-breakdown{font-size:10px;color:#555;margin:2px 0 6px;padding-left:4px}
      .customer-block{margin:14px 0;page-break-inside:avoid}
      .customer-header{background:#f5f5f5;padding:6px 10px;border-radius:4px;display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
      .customer-name{font-size:13px;font-weight:bold}
      .meta{font-size:10px;color:#555}
      table{width:100%;border-collapse:collapse;margin-top:4px}
      th{background:#333;color:#fff;text-align:left;padding:5px 8px;font-size:11px}
      td{padding:5px 8px;border-bottom:1px solid #eee;font-size:11px}
      .no-order{padding:5px 10px;background:#fffbeb;border:1px solid #fde68a;border-radius:4px;font-size:11px;color:#92400e;margin-bottom:5px}
      .skipped{padding:5px 10px;background:#fef2f2;border:1px solid #fca5a5;border-radius:4px;font-size:11px;color:#dc2626;margin-bottom:5px}
      .remarks{font-size:10px;color:#666;margin-top:4px;padding:4px 8px;background:#f8fafc;border-radius:4px}
      .footer{margin-top:16px;font-size:10px;color:#999;text-align:center}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body>
      <h1>Order Sheet</h1>
      <p class="subtitle">${execution.routeName} · ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <div class="divider"></div>
      <div class="summary" style="margin-top:10px">
        ${[
          { lbl: 'Orders', val: withOrders.length },
          { lbl: 'No Order', val: noOrderList.length },
          { lbl: 'Skipped', val: skippedList.length },
        ].map(s => `<div class="summary-box"><div class="summary-val">${s.val}</div><div class="summary-lbl">${s.lbl}</div></div>`).join('')}
      </div>
      ${unitSummary.length > 0 ? `
        <div class="unit-summary">
          <h2>Loading Summary — by Unit</h2>
          ${unitSummary.map(([unit, g]) => `
            <div class="unit-row"><span class="unit-name">${unit}</span><span class="unit-total">${g.total}</span></div>
            <div class="unit-breakdown">${Object.entries(g.byProduct).map(([name, qty]) => `${name}: ${qty}`).join(' · ')}</div>
          `).join('')}
        </div>
      ` : ''}
      <div class="divider"></div>
      ${rows}
      ${noOrderList.length > 0 ? `
        <div class="divider" style="margin-top:14px"></div>
        <p style="font-weight:bold;font-size:13px;margin:8px 0">No Order Shops (${noOrderList.length})</p>
        ${noOrderList.map(v => `<div class="no-order">Stop ${v.sequenceOrder} — ${v.customerName}${v.phoneNumber ? ` · ${v.phoneNumber}` : ''}</div>`).join('')}
      ` : ''}
      ${skippedList.length > 0 ? `
        <p style="font-weight:bold;font-size:13px;margin:10px 0 6px">Skipped (${skippedList.length})</p>
        ${skippedList.map(v => `<div class="skipped">Stop ${v.sequenceOrder} — ${v.customerName}</div>`).join('')}
      ` : ''}
      <p class="footer">Printed on ${new Date().toLocaleString('en-IN')}</p>
    </body></html>`;

    const w = window.open('', '_blank', 'width=800,height=600');
    if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 400); }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: D.bg }}>
      <Spinner size={40} />
    </div>
  );

  if (summary || execution?.status === 'Completed') {
    const s = summary;
    const customers = execution?.customers ?? [];
    return (
      <div style={{ background: D.bg, padding: '32px 20px' }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 20, padding: '36px 28px', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.3)', marginBottom: 20 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
              <CheckCircle2 size={36} color={D.green} />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: D.text, margin: '0 0 6px' }}>
              {executionMode === 'order-taking' ? 'Order Taking Complete! 🎉' : 'Delivery Complete! 🎉'}
            </h2>
            <p style={{ color: D.muted, fontSize: 14, margin: 0 }}>
              {execution?.routeName} · {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
          {s && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Total Shops',   val: s.totalCustomers, color: D.text, bg: D.surface2 },
                { label: 'Orders Taken',  val: s.ordersPlaced,   color: D.green, bg: 'rgba(34,197,94,0.10)' },
                
              ].map(st => (
                <div key={st.label} style={{ background: st.bg, borderRadius: 14, padding: '18px 16px', textAlign: 'center', border: `1px solid ${D.border}` }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: st.color }}>{st.val}</div>
                  <div style={{ fontSize: 13, color: D.muted, fontWeight: 700, marginTop: 4 }}>{st.label}</div>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => { window.location.href = '/salesman/routes'; }}
            style={{ width: '100%', padding: '14px', background: `linear-gradient(135deg, ${D.accent}, ${D.accentH})`, color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit', boxShadow: `0 4px 14px ${D.accentGlow}` }}
          >
            <Home size={18} /> Back to My Routes
          </button>
        </div>
      </div>
    );
  }

  if (!execution?.hasActiveExecution) return (
    <div style={{ minHeight: '60vh', background: D.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <p style={{ color: D.muted, fontSize: 14, marginBottom: 24 }}>{error || 'No active execution found.'}</p>
        <button onClick={() => navigate('/salesman/routes')} style={{ padding: '12px 28px', borderRadius: 10, background: `linear-gradient(135deg, ${D.accent}, ${D.accentH})`, color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: `0 4px 14px ${D.accentGlow}` }}>
          ← Back to Routes
        </button>
      </div>
    </div>
  );

  const sorted       = [...(execution.customers ?? [])].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const total        = sorted.length;
  const pendingList  = sorted.filter(c => c.visitStatus === 'Pending');
  const pendingCount = pendingList.length;
  const doneCount    = total - pendingCount;
  const progress     = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const ordersCount  = sorted.filter(v => v.visitStatus === 'OrderPlaced').length;
  const allDone      = pendingCount === 0 && total > 0;
  const visibleList = sorted.filter(v => {
    if (statusFilter !== 'All' && v.visitStatus !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const searchableText = [
      String(v.sequenceOrder),
      v.customerName || '',
      v.phoneNumber || '',
      v.address || '',
      `stop ${v.sequenceOrder}`
    ].join(' ').toLowerCase();
    return searchableText.includes(q);
  });

  const FILTER_CHIPS: { key: 'All' | VisitStatus; label: string }[] = [
    { key: 'All', label: `All (${total})` },
    { key: 'Pending', label: `Pending (${pendingCount})` },
    { key: 'OrderPlaced', label: `Done (${ordersCount})` },
  
  ];

  return (
    <div style={{ background: D.bg, paddingBottom: allDone ? 130 : 32 }}>
      <div style={{ background: D.bg, borderBottom: `1px solid ${D.border}`, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px 4px' }}>
          <button
            onClick={() => navigate('/salesman/routes')}
            style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 6, background: 'rgba(234,88,12,0.12)', border: `1px solid rgba(234,88,12,0.30)`, color: D.accent, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <ArrowLeft size={12} /> Back
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: D.text }}>{execution.routeName}</div>
            <div style={{ fontSize: 10, color: D.muted }}>{doneCount} of {total} done · {pendingCount} pending</div>
            {nextCustomer && pendingCount > 0 && (
              <div style={{ fontSize: 9, color: D.red, fontWeight: 600 }}>
                → Next: {nextCustomer}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '0 10px 4px' }}>
          <div style={{ height: 3, background: D.border, borderRadius: 1, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: allDone ? D.green : D.accent }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: allDone ? D.green : D.accent }}>{progress}%</span>
            <span style={{ fontSize: 9, color: D.sub }}>{allDone ? 'All done!' : `${pendingCount} remaining`}</span>
          </div>
        </div>

        <div style={{ padding: '0 10px 6px' }}>
          <div style={{ position: 'relative', marginBottom: 4 }}>
            <Search size={11} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: D.sub, pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search shop..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '3px 8px 3px 24px', border: `1px solid ${D.border}`, borderRadius: 6, fontSize: 10, color: D.text, background: D.surface, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: D.sub, cursor: 'pointer', padding: 2 }}>
                <XCircle size={12} />
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 3, overflowX: 'auto', paddingBottom: 1 }}>
            {FILTER_CHIPS.map(chip => (
              <button
                key={chip.key}
                onClick={() => setStatusFilter(chip.key)}
                style={{
                  padding: '1px 8px', borderRadius: 10, fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap',
                  background: statusFilter === chip.key ? D.accent : D.surface,
                  color: statusFilter === chip.key ? '#fff' : D.muted,
                  border: `1px solid ${statusFilter === chip.key ? D.accent : D.border}`,
                  cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Success/Error messages ── */}
      {error && (
        <div style={{ margin: '12px 20px 0', padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.10)', border: `1px solid rgba(239,68,68,0.25)`, color: D.red, fontSize: 14, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: D.red, padding: 0, fontFamily: 'inherit' }}>✕</button>
        </div>
      )}
      {successMsg && (
        <div style={{ margin: '12px 20px 0', padding: '10px 14px', borderRadius: 10, background: 'rgba(34,197,94,0.10)', border: `1px solid rgba(34,197,94,0.25)`, color: D.green, fontSize: 13, fontWeight: 600 }}>
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ padding: '16px 20px', gap: 14, alignItems: 'start' }}>
        {visibleList.length === 0 && (search.trim() || statusFilter !== 'All') && (
          <div style={{ textAlign: 'center', padding: '32px 16px', background: D.surface, border: `1px dashed ${D.border}`, borderRadius: 14, gridColumn: '1 / -1' }}>
            <Search size={28} color={D.border} style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 14, color: D.muted, fontWeight: 600, margin: 0 }}>No shops match your search/filter</p>
            <button
              onClick={() => { setSearch(''); setStatusFilter('All'); }}
              style={{ marginTop: 10, padding: '7px 16px', borderRadius: 9, background: `${D.accent}22`, border: `1px solid ${D.accent}44`, color: D.accent, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Clear filters
            </button>
          </div>
        )}
        {visibleList.map((visit) => {
          const index     = sorted.findIndex(c => c.customerId === visit.customerId);
          const meta      = STATUS_META[visit.visitStatus as VisitStatus] || STATUS_META.Pending;
          const isPending = visit.visitStatus === 'Pending';
          const isBusy    = recording === visit.customerId;
          const nextStop  = index < sorted.length - 1 ? sorted[index + 1].customerName : null;
          const visitId   = (visit as any).visitId ?? (visit as any).id;
          const isNext = isPending && (
            activeCustomerId
              ? visit.customerId === activeCustomerId
              : nextCustomer === visit.customerName
          );

          return (
            <div 
              key={visit.customerId}
              id={`customer-${visit.customerId}`}
              style={{
                background: D.surface, 
                borderRadius: 16, 
                overflow: 'hidden',
                border: isPending
                  ? `2px solid ${D.red}`      // Red border for pending
                  : visit.visitStatus === 'OrderPlaced'
                    ? `2px solid ${D.green}`   // Green border for done
                    : `2px solid ${D.red}`,    // Red border for skipped/no order
                boxShadow: isPending
                  ? `0 2px 12px ${D.redGlow}`
                  : visit.visitStatus === 'OrderPlaced'
                    ? `0 2px 8px rgba(34,197,94,0.12)`
                    : `0 2px 8px rgba(239,68,68,0.10)`,
                opacity: isBusy ? 0.7 : 1, 
                transition: 'all 0.3s ease',
              }}
            >
              <div style={{ padding: '16px 18px 14px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{
                  width: 50, height: 50, borderRadius: 12, flexShrink: 0,
                  background: isPending ? D.red : meta.bg,
                  border: isPending ? 'none' : `1px solid ${meta.border}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isPending ? `0 3px 10px ${D.redGlow}` : 'none',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: isPending ? 'rgba(255,255,255,0.7)' : D.muted }}>STOP</span>
                  <span style={{ fontSize: 22, fontWeight: 900, color: isPending ? '#fff' : meta.color, lineHeight: 1 }}>{visit.sequenceOrder}</span>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 900, color: D.text, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 4 }}>
                    {visit.customerName}
                  </div>
                  {(visit as any).customerNameMalayalam && (
                    <div style={{ fontSize: 13, color: D.muted, marginBottom: 4 }}>{(visit as any).customerNameMalayalam}</div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {visit.phoneNumber && (
                      <a href={`tel:${visit.phoneNumber}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: D.accent, textDecoration: 'none' }}>
                        <Phone size={13} /> {visit.phoneNumber}
                      </a>
                    )}
                    {visit.address && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: D.muted }}>
                        <MapPin size={11} style={{ flexShrink: 0 }} /> {visit.address}
                      </div>
                    )}
                  </div>
                  {isPending && nextStop && (
                    <div style={{ marginTop: 5, fontSize: 11, color: D.sub }}>
                      → Next: <span style={{ fontWeight: 600, color: D.red }}>{nextStop}</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {isPending ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, whiteSpace: 'nowrap' }}>
                      {meta.icon} {meta.label}
                    </span>
                  ) : visit.visitStatus === 'OrderPlaced' ? (
                    <div title="Order taken" style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: D.green, color: '#fff',
                    }}>
                      <Check size={18} strokeWidth={3} />
                    </div>
                  ) : (
                    <div title={visit.visitStatus === 'NoOrder' ? 'No order' : 'Skipped'} style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: D.red, color: '#fff',
                    }}>
                      <X size={18} strokeWidth={3} />
                    </div>
                  )}
                </div>
              </div>

              {/* ── Action buttons ── */}
              {isPending ? (
                <div style={{ borderTop: `1px solid ${D.border}` }}>
                  <button
                    onClick={() => {
                      setActiveCustomerId(visit.customerId);
                      setTimeout(() => {
                        navigate(`/salesman/routes/${routeId}/order/${visit.customerId}`, {
                          state: { executionId: execution.executionId, customerVisitId: visitId, mode: executionMode }
                        });
                      }, 80);
                    }}
                    disabled={isBusy}
                    style={{ width: '100%', padding: '13px 18px', background: `linear-gradient(135deg, ${D.accent}, ${D.accentH})`, border: 'none', color: '#fff', fontSize: 14, fontWeight: 800, cursor: isBusy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit', boxShadow: `0 4px 14px ${D.accentGlow}` }}
                  >
                    {isBusy ? <Spinner size={15} /> : <ShoppingCart size={17} />}
                    Take Order
                  </button>
                </div>
              ) : visit.visitStatus === 'OrderPlaced' ? (
                <div style={{ borderTop: `1px solid ${D.border}` }}>
                  <button
                    onClick={() => navigate(`/salesman/routes/${routeId}/order/${visit.customerId}`, {
                      state: { executionId: execution.executionId, customerVisitId: visitId, mode: executionMode }
                    })}
                    style={{ width: '100%', padding: '13px 18px', background: 'rgba(34,197,94,0.08)', border: 'none', color: D.green, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit' }}
                  >
                    <Eye size={15} /> View Order
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* ── Bottom CTA ── */}
      {allDone && !summary && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 55, background: D.surface, borderTop: `1px solid ${D.border}`, padding: '14px 20px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px) + 70px)', boxShadow: '0 -4px 20px rgba(0,0,0,0.3)' }}>
          <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(34,197,94,0.10)', border: `1px solid rgba(34,197,94,0.20)`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={15} color={D.green} />
            <span style={{ fontSize: 13, fontWeight: 700, color: D.green }}>All {total} shops visited! {ordersCount} orders saved.</span>
          </div>
          {executionMode === 'order-taking' ? (
            <button
              onClick={() => navigate('/salesman/routes')}
              style={{ width: '100%', padding: '14px', background: `linear-gradient(135deg, ${D.accent}, ${D.accentH})`, color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit', boxShadow: `0 4px 14px ${D.accentGlow}` }}
            >
              <Home size={17} /> Back to My Routes
            </button>
          ) : (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={completing}
              style={{ width: '100%', padding: '14px', background: completing ? D.border : `linear-gradient(135deg, ${D.accent}, ${D.accentH})`, color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: completing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit', boxShadow: completing ? 'none' : `0 4px 14px ${D.accentGlow}` }}
            >
              {completing ? <Spinner size={17} /> : <><Flag size={17} /> Complete Delivery Route</>}
            </button>
          )}
        </div>
      )}

      {/* ── Confirm complete modal ── */}
      {showConfirm && (
        <>
          <div onClick={() => !completing && setShowConfirm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 110, background: D.surface, borderRadius: '20px 20px 0 0', padding: '0 0 32px', boxShadow: '0 -8px 40px rgba(0,0,0,0.4)', borderTop: `1px solid ${D.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: D.border }} />
            </div>
            <div style={{ padding: '0 24px' }}>
              <h3 style={{ fontSize: 20, fontWeight: 900, color: D.text, margin: '0 0 8px' }}>Complete Delivery Route?</h3>
              <p style={{ fontSize: 14, color: D.muted, margin: '0 0 24px', lineHeight: 1.6 }}>
                {doneCount} of {total} deliveries done. This will lock all records.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowConfirm(false)} disabled={completing} style={{ flex: 1, padding: '13px', background: D.bg, border: `1px solid ${D.border}`, borderRadius: 11, fontSize: 14, fontWeight: 700, color: D.muted, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={handleComplete} disabled={completing} style={{ flex: 2, padding: '13px', background: completing ? D.border : `linear-gradient(135deg, ${D.accent}, ${D.accentH})`, border: 'none', borderRadius: 11, fontSize: 14, fontWeight: 800, color: '#fff', cursor: completing ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: completing ? 'none' : `0 4px 14px ${D.accentGlow}` }}>
                  {completing ? <Spinner size={15} /> : <><Flag size={15} /> Yes, Complete</>}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Skip modal ── */}
      {showSkip && (
        <>
          <div onClick={() => setShowSkip(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 110, background: D.surface, borderRadius: '20px 20px 0 0', padding: '0 0 32px', boxShadow: '0 -8px 40px rgba(0,0,0,0.4)', borderTop: `1px solid ${D.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: D.border }} />
            </div>
            <div style={{ padding: '0 24px' }}>
              <h3 style={{ fontSize: 18, fontWeight: 900, color: D.text, margin: '0 0 12px' }}>Skip {showSkip.customerName}?</h3>
              <textarea
                placeholder="Reason for skipping (optional)"
                value={skipReason}
                onChange={e => setSkipReason(e.target.value)}
                rows={3}
                style={{ width: '100%', padding: '10px 12px', border: `1px solid ${D.border}`, borderRadius: 8, fontSize: 14, fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box', outline: 'none', background: D.bg, color: D.text }}
                onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = D.accent}
                onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = D.border}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button onClick={() => setShowSkip(null)} style={{ flex: 1, padding: '12px', background: D.bg, border: `1px solid ${D.border}`, borderRadius: 9, fontSize: 14, fontWeight: 700, color: D.muted, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={() => markSkipped(showSkip, skipReason)} style={{ flex: 1, padding: '12px', background: D.red, border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 800, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <XCircle size={14} /> Skip
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showResetConfirm && (
        <>
          <div onClick={() => setShowResetConfirm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 110, background: D.surface, borderRadius: '20px 20px 0 0', padding: '0 0 32px', boxShadow: '0 -8px 40px rgba(0,0,0,0.4)', borderTop: `1px solid ${D.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: D.border }} />
            </div>
            <div style={{ padding: '0 24px' }}>
              <h3 style={{ fontSize: 18, fontWeight: 900, color: D.text, margin: '0 0 8px' }}>Reset {showResetConfirm.customerName}?</h3>
              <p style={{ fontSize: 13, color: D.muted, margin: '0 0 16px', lineHeight: 1.5 }}>
                {showResetConfirm.visitStatus === 'OrderPlaced'
                  ? "This unlinks the order from this stop and sets it back to Pending so you can take a fresh order. The original order itself isn't deleted."
                  : 'This sets the stop back to Pending so you can take an order for it.'}
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowResetConfirm(null)} style={{ flex: 1, padding: '12px', background: D.bg, border: `1px solid ${D.border}`, borderRadius: 9, fontSize: 14, fontWeight: 700, color: D.muted, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button
                  onClick={() => handleResetVisit(showResetConfirm)}
                  disabled={resetting}
                  style={{ flex: 1, padding: '12px', background: D.red, border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 800, color: '#fff', cursor: resetting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: resetting ? 0.7 : 1 }}
                >
                  {resetting ? <Spinner size={14} /> : <RotateCcw size={14} />} Reset
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}