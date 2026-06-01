import { useEffect, useState } from 'react';
import { DollarSign, Users, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { settlementApi } from '../../api/services';
import {
  SettlementSummaryDto, OutstandingCustomerDto, fmtNum, fmtDate
} from '../../types';
import { Spinner, EmptyState, ConfirmModal } from '../../components/ui';

export default function AccountsSettlement() {
  const [summary, setSummary] = useState<SettlementSummaryDto | null>(null);
  const [outstanding, setOutstanding] = useState<OutstandingCustomerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentModal, setPaymentModal] = useState<{ customer: OutstandingCustomerDto } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paying, setPaying] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [s, o] = await Promise.all([
        settlementApi.summary(),
        settlementApi.outstanding(),
      ]);
      setSummary(s);
      setOutstanding(o);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load settlement data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handlePayment = async () => {
    if (!paymentModal) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Enter a valid amount');
      return;
    }
    setPaying(true);
    try {
      await settlementApi.recordPayment({
        customerId: paymentModal.customer.customerId,
        amount,
        note: paymentNote,
        paymentDate: new Date().toISOString(),
      });
      setPaymentModal(null);
      setPaymentAmount('');
      setPaymentNote('');
      await load();
    } catch (e: any) {
      alert(e.message ?? 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  const filtered = outstanding.filter(o =>
    o.customerName.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Spinner />;

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-10">
      <div className="px-4 pt-6 pb-4 border-b border-[var(--border)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Settlement</h1>
            <p className="text-sm text-[var(--muted)] mt-1">Accounts Portal</p>
          </div>
          <button onClick={load} className="btn btn-secondary flex items-center gap-2">
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      <div className="px-4 mt-6 space-y-6">
        {error && <div className="alert alert-error">{error}</div>}

        {/* KPI cards */}
        {summary && (
          <div className="grid grid-cols-2 gap-3">
            <div className="card">
              <DollarSign size={20} className="text-[var(--primary)] mb-2" />
              <p className="text-xl font-bold text-white">₹{fmtNum(summary.totalBilled ?? 0)}</p>
              <p className="text-xs text-[var(--muted)] mt-1">Total Billed</p>
            </div>
            <div className="card">
              <CheckCircle2 size={20} className="text-green-400 mb-2" />
              <p className="text-xl font-bold text-white">₹{fmtNum(summary.totalCollected ?? 0)}</p>
              <p className="text-xs text-[var(--muted)] mt-1">Collected</p>
            </div>
            <div className="card">
              <AlertCircle size={20} className="text-red-400 mb-2" />
              <p className="text-xl font-bold text-white">₹{fmtNum(summary.totalOutstanding ?? 0)}</p>
              <p className="text-xs text-[var(--muted)] mt-1">Outstanding</p>
            </div>
            <div className="card">
              <Users size={20} className="text-blue-400 mb-2" />
              <p className="text-xl font-bold text-white">{summary.customersWithDues ?? 0}</p>
              <p className="text-xs text-[var(--muted)] mt-1">Customers with Dues</p>
            </div>
          </div>
        )}

        {/* Outstanding customers */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider">Outstanding</h2>
            <span className="text-xs text-[var(--muted)]">{outstanding.length} customers</span>
          </div>

          <input
            className="input w-full mb-3"
            placeholder="Search customer…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          {filtered.length === 0 && <EmptyState title="No outstanding dues" message="All customers are settled." />}

          <div className="space-y-2">
            {filtered.map(o => (
              <div key={o.customerId} className="card flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm truncate">{o.customerName}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {o.routeName} · Last: {o.lastPaymentDate ? fmtDate(o.lastPaymentDate) : 'Never'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-400">₹{fmtNum(o.outstanding)}</p>
                    <p className="text-xs text-[var(--muted)]">due</p>
                  </div>
                  <button
                    onClick={() => { setPaymentModal({ customer: o }); setPaymentAmount(String(o.outstanding)); }}
                    className="btn btn-primary text-xs px-3 py-2 h-auto"
                  >
                    Pay
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payment modal */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-white mb-1">Record Payment</h3>
            <p className="text-sm text-[var(--muted)] mb-4">{paymentModal.customer.customerName}</p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">Amount (₹)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  className="input w-full"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  placeholder={String(paymentModal.customer.outstanding)}
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">Note (optional)</label>
                <input
                  className="input w-full"
                  value={paymentNote}
                  onChange={e => setPaymentNote(e.target.value)}
                  placeholder="Cash / UPI / Cheque…"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setPaymentModal(null)} className="btn btn-secondary flex-1">Cancel</button>
              <button onClick={handlePayment} disabled={paying} className="btn btn-primary flex-1">
                {paying ? 'Recording…' : 'Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
