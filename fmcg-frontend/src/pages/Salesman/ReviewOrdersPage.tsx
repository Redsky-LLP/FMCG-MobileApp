// PATH: src/pages/Salesman/ReviewOrdersPage.tsx
// FIXES:
// - Submit All REMOVED from header top
// - Submit All shown as sticky bottom orange bar (always visible)
// - Individual Submit button per order card
// - After submit: completeExecution → hard navigate back
// - FIX: Auto-complete RouteExecution even if executionId is not available

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Home, Send, CheckCircle2, Package,
  Eye, Edit2, ChevronDown, ChevronUp, Flag,
} from 'lucide-react';
import { ordersApi, customersApi, routesApi } from '../../api/services';
import { OrderDto, CustomerDto, RouteDto, OrderStatus, fmt } from '../../types';
import { Spinner } from '../../components/ui';

interface ConsolidatedItem {
  productName: string; quantity: number; unit: string;
  sellingPrice: number; total: number;
  customerName: string; customerId: string;
}

export default function ReviewOrdersPage() {
  const { routeId } = useParams<{ routeId: string }>();
  const navigate = useNavigate();

  const [route,       setRoute]       = useState<RouteDto | null>(null);
  const [customers,   setCustomers]   = useState<CustomerDto[]>([]);
  const [orders,      setOrders]      = useState<OrderDto[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [submitting,  setSubmitting]  = useState<string | 'all' | null>(null);
  const [error,       setError]       = useState('');
  const [successMsg,  setSuccessMsg]  = useState('');
  const [expanded,    setExpanded]    = useState<Record<string, boolean>>({});
  const [executionId, setExecutionId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!routeId) { navigate('/salesman/routes'); return; }
    loadData();
  }, [routeId]);

  async function loadData() {
    setLoading(true); setError('');
    try {
      const [r, c, o] = await Promise.all([
        routesApi.getById(routeId!),
        customersApi.list(routeId!),
        ordersApi.getByRoute(routeId!),
      ]);
      setRoute(r);
      setCustomers(c);
      setOrders(o.filter(order => order.orderDate?.startsWith(today)));
      try {
        const exec = await routesApi.getCurrentExecution(routeId!);
        if (exec?.executionId) setExecutionId(exec.executionId);
      } catch {}
    } catch (err: any) {
      setError(err.message || 'Failed to load');
    } finally { setLoading(false); }
  }

  const draftOrders  = orders.filter(o => o.status === OrderStatus.Draft);
  const totalAmount  = orders.reduce((s, o) => s + (o.totalAmount || 0), 0);
  const allSubmitted = orders.length > 0 && draftOrders.length === 0;

  const consolidatedItems = (): ConsolidatedItem[] => {
    const map = new Map<string, ConsolidatedItem>();
    orders.forEach(order => {
      order.items?.forEach(item => {
        const key = `${item.productId}-${order.customerId}`;
        const ex  = map.get(key);
        if (ex) { ex.quantity += item.quantity; ex.total = ex.quantity * ex.sellingPrice; }
        else map.set(key, {
          productName:  item.productName || 'Unknown',
          quantity:     item.quantity,
          unit:         item.unitSymbol || item.unitName || 'pc',
          sellingPrice: item.sellingPrice,
          total:        item.sellingPrice * item.quantity,
          customerName: order.customerName || 'Unknown',
          customerId:   String(order.customerId),
        });
      });
    });
    return Array.from(map.values());
  };
  const items = consolidatedItems();

  async function handleSubmitOne(orderId: string | number) {
    setSubmitting(String(orderId)); setError('');
    try {
      await ordersApi.submit(String(orderId));
      await loadData();
      setSuccessMsg('Order submitted ✓');
      setTimeout(() => setSuccessMsg(''), 2000);
    } catch (err: any) {
      setError(err.message || 'Submit failed');
    } finally { setSubmitting(null); }
  }

  async function handleSubmitAll() {
    if (draftOrders.length === 0) { setError('No draft orders to submit.'); return; }
    setSubmitting('all'); setError('');
    try {
      // ── Submit all draft orders ──
      for (const order of draftOrders) {
        await ordersApi.submit(String(order.id));
      }
      
      // ── FIX: Always try to complete the RouteExecution ──
      // Even if we don't have executionId, try to get it from the route
      let execId = executionId;
      if (!execId) {
        try {
          const exec = await routesApi.getCurrentExecution(routeId!);
          if (exec?.executionId) {
            execId = exec.executionId;
          }
        } catch (e) {
          console.warn('Could not get execution ID:', e);
        }
      }
      
      if (execId) {
        try {
          await routesApi.completeExecution(execId);
          console.log('[ReviewOrders] Route execution completed successfully');
        } catch (completeErr: any) {
          // If the error is "already completed", that's fine
          if (completeErr?.message?.includes('already') || 
              completeErr?.response?.status === 400) {
            console.log('[ReviewOrders] Execution already completed or invalid');
          } else {
            console.warn('[ReviewOrders] Failed to complete execution:', completeErr);
          }
        }
      } else {
        console.warn('[ReviewOrders] No execution ID found to complete');
      }
      
      setSuccessMsg(`✅ ${draftOrders.length} order${draftOrders.length > 1 ? 's' : ''} submitted!`);
      setTimeout(() => { 
        window.location.href = '/salesman/routes'; 
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Submission failed');
      setSubmitting(null);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Spinner size={40} /></div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-32">

      {/* ── Header — My Routes link + title only, NO submit button ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/salesman/routes')}
            className="flex items-center gap-2 text-slate-600 hover:text-blue-600 font-semibold text-sm"
          >
            <Home size={16} /> My Routes
          </button>
          <div>
            <h1 className="text-base font-bold text-slate-800 text-center">Order Review</h1>
            <p className="text-xs text-slate-400 text-center">{route?.name}</p>
          </div>
          {/* Intentionally empty — no submit here */}
          <div style={{ width: 80 }} />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-4">

        {/* Alerts */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="ml-2 font-bold">✕</button>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700 font-semibold">
            {successMsg}
          </div>
        )}

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Customers', val: customers.length,        cls: 'text-slate-800' },
            { label: 'Orders',    val: orders.length,           cls: 'text-slate-800' },
            { label: 'Drafts',    val: draftOrders.length,      cls: draftOrders.length > 0 ? 'text-amber-600' : 'text-slate-800' },
            { label: 'Total',     val: `₹${fmt(totalAmount)}`,  cls: 'text-emerald-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-3 text-center shadow-sm">
              <p className="text-xs text-slate-400 uppercase tracking-wide">{s.label}</p>
              <p className={`text-base font-bold mt-0.5 ${s.cls}`}>{s.val}</p>
            </div>
          ))}
        </div>

        {/* Date */}
        <div className="text-center text-sm text-slate-500 mb-4">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>

        {/* All items table */}
        {items.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-5">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
              <h2 className="font-semibold text-slate-700 flex items-center gap-2 text-sm">
                <Package size={16} /> All Items ({items.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['#','Customer','Product','Qty','Unit','Price','Total',''].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-xs text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2 text-sm font-medium text-slate-800">{item.customerName}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{item.productName}</td>
                      <td className="px-3 py-2 text-center text-sm font-semibold">{item.quantity}</td>
                      <td className="px-3 py-2 text-center text-xs text-slate-500">{item.unit}</td>
                      <td className="px-3 py-2 text-right text-sm">₹{fmt(item.sellingPrice)}</td>
                      <td className="px-3 py-2 text-right text-sm font-semibold">₹{fmt(item.total)}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => navigate(`/salesman/routes/${routeId}/order/${item.customerId}`)} className="text-blue-500 hover:text-blue-700">
                          <Edit2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td colSpan={6} className="px-3 py-3 text-right font-bold text-slate-700 text-sm">GRAND TOTAL</td>
                    <td className="px-3 py-3 text-right font-bold text-lg text-emerald-600">₹{fmt(totalAmount)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Per-customer order cards with individual submit */}
        <div className="space-y-3 mb-4">
          {orders.map(order => {
            const isDraft   = order.status === OrderStatus.Draft;
            const isOpen    = expanded[String(order.id)];
            const isThisOne = submitting === String(order.id);

            return (
              <div key={order.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isDraft ? 'border-amber-200' : 'border-slate-200'}`}>
                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800">{order.customerName}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {order.items?.length || 0} items · ₹{fmt(order.totalAmount || 0)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isDraft ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                      {isDraft ? 'Draft' : '✓ Submitted'}
                    </span>
                    {isDraft && (
                      <button
                        onClick={() => handleSubmitOne(order.id)}
                        disabled={!!submitting}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      >
                        {isThisOne ? <Spinner size={11} /> : <Send size={11} />}
                        Submit
                      </button>
                    )}
                    <button
                      onClick={() => setExpanded(p => ({ ...p, [String(order.id)]: !isOpen }))}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100 px-4 py-3 space-y-1.5">
                    {order.items?.map((item, i) => (
                      <div key={i} className="flex justify-between items-center text-sm py-1 border-b border-slate-50">
                        <span className="text-slate-700">{item.productName}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-slate-400">{item.quantity} {item.unitSymbol || 'pc'}</span>
                          <span className="font-semibold text-emerald-600">₹{fmt(item.sellingPrice * item.quantity)}</span>
                        </div>
                      </div>
                    ))}
                    {order.remarks && (
                      <p className="text-xs text-slate-400 bg-slate-50 p-2 rounded mt-1">📝 {order.remarks}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* All submitted state */}
        {allSubmitted && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 text-center mb-4">
            <CheckCircle2 size={32} className="mx-auto mb-2" style={{ color: '#4f46e5' }} />
            <p className="font-bold text-indigo-700 text-base">All orders submitted!</p>
            <p className="text-sm text-indigo-500 mt-1">Route marked as completed</p>
            <button
              onClick={() => { window.location.href = '/salesman/routes'; }}
              className="mt-4 flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-lg mx-auto transition-colors"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}
            >
              <Home size={15} /> Back to My Routes
            </button>
          </div>
        )}

        <div className="text-center text-xs text-slate-400 py-2">
          Generated on {new Date().toLocaleString('en-IN')}
        </div>
      </div>

      {/* ── Sticky bottom Submit All bar ── */}
      {draftOrders.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 55,
          background: '#0f172a', borderTop: '1px solid #1e293b',
          padding: '12px 16px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px) + 70px)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {draftOrders.length} draft order{draftOrders.length > 1 ? 's' : ''} pending
            </p>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#f1f5f9' }}>
              ₹{fmt(totalAmount)}
            </p>
          </div>

          <button
            onClick={handleSubmitAll}
            disabled={submitting === 'all'}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 20px',
              background: submitting === 'all' ? '#334155' : 'linear-gradient(135deg,#ea580c,#dc2626)',
              border: 'none', borderRadius: 12,
              fontSize: 14, fontWeight: 800, color: '#fff',
              cursor: submitting === 'all' ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', flexShrink: 0,
              boxShadow: submitting === 'all' ? 'none' : '0 4px 16px rgba(234,88,12,0.40)',
              touchAction: 'manipulation',
            }}
          >
            {submitting === 'all' ? <Spinner size={16} /> : <Flag size={16} />}
            {submitting === 'all' ? 'Submitting...' : `Submit All (${draftOrders.length})`}
          </button>
        </div>
      )}
    </div>
  );
}