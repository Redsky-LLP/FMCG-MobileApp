import React, { useEffect, useState } from 'react';
import { Calculator, RefreshCw, DollarSign, AlertCircle, CheckCircle2, Users } from 'lucide-react';
import { settlementApi, routesApi } from '../../api/services';
import type { ExpectedCashDto, OutstandingSummaryDto, RouteDto, DailyClosureStatusDto } from '../../types';
import { fmt, fmtDate } from '../../types';
import { PageLoader, Spinner, Alert, Badge, EmptyState, Field } from '../../components/ui';

export function AdminSettlement() {
  const [routes,      setRoutes]      = useState<RouteDto[]>([]);
  const [routeFilter, setRouteFilter] = useState('');
  const [summary,     setSummary]     = useState<ExpectedCashDto | null>(null);
  const [outstanding, setOutstanding] = useState<OutstandingSummaryDto | null>(null);
  const [closureStatus, setClosureStatus] = useState<DailyClosureStatusDto | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [payModal,    setPayModal]    = useState<string | null>(null); // customerId
  const [payForm, setPayForm] = useState({ amount: '', paymentMode: 'Cash', reference: '', remarks: '' });
  const [paying,      setPaying]      = useState(false);
  const [error,       setError]       = useState('');
  const [msg,         setMsg]         = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const [s, o, cs] = await Promise.all([
        settlementApi.getSummary(routeFilter || undefined),
        settlementApi.getOutstanding(routeFilter || undefined),
        settlementApi.getStatus(),
      ]);
      setSummary(s); setOutstanding(o); setClosureStatus(cs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally { setLoading(false); }
  }

  async function loadRoutes() {
    const r = await routesApi.getAll();
    setRoutes(r);
  }

  useEffect(() => { loadRoutes(); }, []);
  useEffect(() => { load(); }, [routeFilter]);

  async function handlePay(customerId: string) {
    if (!payForm.amount) return;
    setPaying(true);
    try {
      await settlementApi.recordPayment({
        customerId,
        amount: parseFloat(payForm.amount),
        paymentDate: new Date().toISOString(),
        paymentMode: payForm.paymentMode,
        paymentReference: payForm.reference || undefined,
        remarks: payForm.remarks || undefined,
      });
      setMsg('Payment recorded successfully.');
      setPayModal(null);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally { setPaying(false); }
  }

  if (loading) return <PageLoader />;

  return (
    <div className="page-content">
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Settlement</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Outstanding reconciliation & payment tracking
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select className="input" value={routeFilter} onChange={(e) => setRouteFilter(e.target.value)} style={{ width: 'auto' }}>
            <option value="">All Routes</option>
            {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button className="btn btn-outline btn-sm" onClick={load}><RefreshCw size={14} /></button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {msg   && <Alert variant="success">{msg}</Alert>}

      {/* Closure status */}
      {closureStatus && (
        <div className={`alert alert-${closureStatus.isClosed ? 'success' : 'warning'}`} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {closureStatus.isClosed ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {closureStatus.isClosed
              ? `Today closed · ${closureStatus.closedOrders} orders locked · Revenue: ${fmt(closureStatus.totalRevenue)}`
              : `Day still open · ${closureStatus.submittedOrders} submitted, ${closureStatus.totalOrders - closureStatus.closedOrders - closureStatus.submittedOrders} in draft`}
          </div>
        </div>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="kpi-grid" style={{ marginBottom: 24 }}>
          <SummCard label="Total Orders"      value={summary.orderCount.toString()}      icon={Calculator} color="var(--blue)" />
          <SummCard label="Expected Cash"     value={fmt(summary.totalOrderValue)}       icon={DollarSign} color="var(--green)" />
          <SummCard label="Collected"         value={fmt(summary.paidAmount)}            icon={CheckCircle2} color="var(--green)" />
          <SummCard label="Outstanding"       value={fmt(summary.outstandingAmount)}     icon={AlertCircle} color="var(--red)" />
        </div>
      )}

      {/* Outstanding by customer */}
      {outstanding && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Outstanding by Customer</h3>
            <span style={{ fontSize: 13, color: 'var(--red)', fontWeight: 600 }}>{fmt(outstanding.totalOutstanding)} total</span>
          </div>
          {outstanding.customers.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <CheckCircle2 size={32} color="var(--green)" />
              <p style={{ marginTop: 10 }}>No outstanding balances!</p>
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr><th>Customer</th><th>Route</th><th>Billed</th><th>Paid</th><th>Outstanding</th><th></th></tr>
              </thead>
              <tbody>
                {outstanding.customers.map((c) => (
                  <tr key={c.customerId}>
                    <td style={{ fontWeight: 600 }}>{c.customerName}</td>
                    <td style={{ fontSize: 13 }}>{c.routeName ?? '—'}</td>
                    <td>{fmt(c.totalBilled)}</td>
                    <td style={{ color: 'var(--green)' }}>{fmt(c.totalPaid)}</td>
                    <td style={{ color: c.outstanding > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>{fmt(c.outstanding)}</td>
                    <td>
                      {c.outstanding > 0 && (
                        <button className="btn btn-outline btn-sm" onClick={() => { setPayModal(String(c.customerId)); setPayForm({ amount: c.outstanding.toFixed(2), paymentMode: 'Cash', reference: '', remarks: '' }); }}>
                          <DollarSign size={13} /> Record Payment
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Payment modal */}
      {payModal && (
        <div className="modal-overlay" onClick={() => setPayModal(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, fontWeight: 700 }}>Record Payment</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Amount (₹)" required>
                <input className="input" type="number" step="0.01" value={payForm.amount} onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))} />
              </Field>
              <Field label="Payment Mode">
                <select className="input" value={payForm.paymentMode} onChange={(e) => setPayForm((p) => ({ ...p, paymentMode: e.target.value }))}>
                  {['Cash', 'UPI', 'NEFT', 'Cheque', 'Other'].map((m) => <option key={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Reference No">
                <input className="input" value={payForm.reference} onChange={(e) => setPayForm((p) => ({ ...p, reference: e.target.value }))} placeholder="UPI transaction / cheque no." />
              </Field>
              <Field label="Remarks">
                <input className="input" value={payForm.remarks} onChange={(e) => setPayForm((p) => ({ ...p, remarks: e.target.value }))} placeholder="Optional notes" />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-outline" onClick={() => setPayModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => handlePay(payModal)} disabled={paying || !payForm.amount}>
                {paying ? <Spinner size={16} /> : 'Save Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <div className="kpi-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="kpi-label">{label}</span>
        <Icon size={18} color={color} />
      </div>
      <div className="kpi-value" style={{ color }}>{value}</div>
    </div>
  );
}
