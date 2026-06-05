// PATH: src/pages/Accounts/AccountsSettlement.tsx
// UPDATED: Phase 5 - Mobile-enhanced settlement view

import { useEffect, useState } from 'react';
import { DollarSign, Users, AlertCircle, CheckCircle2, RefreshCw, Search, X, Phone, MapPin, IndianRupee, CreditCard } from 'lucide-react';
import { settlementApi, routesApi } from '../../api/services';
import {
  SettlementSummaryDto, OutstandingCustomerDto, fmtNum, fmtDate
} from '../../types';
import { Spinner, EmptyState, ConfirmModal } from '../../components/ui';

export default function AccountsSettlement() {
  const [summary, setSummary] = useState<SettlementSummaryDto | null>(null);
  const [outstanding, setOutstanding] = useState<OutstandingCustomerDto[]>([]);
  const [routes, setRoutes] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentModal, setPaymentModal] = useState<{ customer: OutstandingCustomerDto } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paying, setPaying] = useState(false);
  const [search, setSearch] = useState('');
  const [routeFilter, setRouteFilter] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [s, o, r] = await Promise.all([
        settlementApi.summary(),
        settlementApi.outstanding(),
        routesApi.getAll().catch(() => []),
      ]);
      setSummary(s);
      setOutstanding(o);
      setRoutes(r.map(route => ({ id: String(route.id), name: route.name })));
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
      setError('Enter a valid amount');
      return;
    }
    setPaying(true);
    setError('');
    try {
      await settlementApi.recordPayment({
        customerId: paymentModal.customer.customerId,
        amount,
        note: paymentNote,
        paymentDate: new Date().toISOString(),
        paymentMode: paymentMode,
      });
      setSuccess(`Payment of ₹${fmtNum(amount)} recorded successfully!`);
      setPaymentModal(null);
      setPaymentAmount('');
      setPaymentNote('');
      setPaymentMode('Cash');
      await load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
      setError(e.message ?? 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  // Filter outstanding by route and search
  const filteredOutstanding = outstanding.filter(o => {
    if (routeFilter && o.routeName !== routeFilter) return false;
    if (search && !o.customerName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalOutstanding = filteredOutstanding.reduce((sum, o) => sum + o.outstanding, 0);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Spinner size={40} />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-slate-800">Settlement</h1>
              <p className="text-sm text-slate-500 mt-0.5">Accounts Portal</p>
            </div>
            <button 
              onClick={load} 
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col gap-3 mt-3">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-base focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="Search customer..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            
            {routes.length > 0 && (
              <select
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-base focus:outline-none focus:border-blue-400 bg-white"
                value={routeFilter}
                onChange={e => setRouteFilter(e.target.value)}
              >
                <option value="">All Routes</option>
                {routes.map(route => (
                  <option key={route.id} value={route.name}>{route.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-5">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between">
            <span className="text-sm text-red-700">{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        )}
        {success && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
            <span className="text-sm text-emerald-700">✓ {success}</span>
            <button onClick={() => setSuccess('')} className="text-emerald-400 hover:text-emerald-600">✕</button>
          </div>
        )}

        {/* KPI Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <DollarSign size={20} className="text-blue-600" />
                <span className="text-xs font-medium text-slate-400">Total Billed</span>
              </div>
              <p className="text-2xl font-bold text-slate-800">₹{fmtNum(summary.totalBilled ?? 0)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle2 size={20} className="text-emerald-600" />
                <span className="text-xs font-medium text-slate-400">Collected</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600">₹{fmtNum(summary.totalCollected ?? 0)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <AlertCircle size={20} className="text-red-600" />
                <span className="text-xs font-medium text-slate-400">Outstanding</span>
              </div>
              <p className="text-2xl font-bold text-red-600">₹{fmtNum(totalOutstanding)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <Users size={20} className="text-purple-600" />
                <span className="text-xs font-medium text-slate-400">Customers</span>
              </div>
              <p className="text-2xl font-bold text-slate-800">{filteredOutstanding.length}</p>
            </div>
          </div>
        )}

        {/* Outstanding Customers List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Outstanding Customers</h2>
            <span className="text-xs text-slate-400">{filteredOutstanding.length} customers</span>
          </div>

          {filteredOutstanding.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <CheckCircle2 size={48} className="mx-auto text-emerald-300 mb-3" />
              <p className="text-slate-500 font-medium">No outstanding dues</p>
              <p className="text-sm text-slate-400 mt-1">All customers are settled.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOutstanding.map((customer) => (
                <div 
                  key={customer.customerId} 
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-800 text-base">{customer.customerName}</h3>
                        {customer.routeName && (
                          <p className="text-sm text-slate-500 mt-0.5">{customer.routeName}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-red-600">₹{fmtNum(customer.outstanding)}</p>
                        <p className="text-xs text-slate-400">due</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mt-2">
                      {customer.lastPaymentDate && (
                        <div className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-full">
                          Last payment: {fmtDate(customer.lastPaymentDate)}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => { 
                        setPaymentModal({ customer }); 
                        setPaymentAmount(String(customer.outstanding));
                        setPaymentMode('Cash');
                        setPaymentNote('');
                      }}
                      className="w-full mt-3 flex items-center justify-center gap-2 py-3 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all"
                    >
                      <IndianRupee size={16} /> Record Payment
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal - Mobile Optimized */}
      {paymentModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-50" 
            onClick={() => setPaymentModal(null)} 
          />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl animate-slide-up"
          style={{ zIndex: 65, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-12 h-1 bg-slate-300 rounded-full" />
            </div>
            
            <div className="p-5">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-slate-800">Record Payment</h3>
                <p className="text-sm text-slate-500 mt-1">{paymentModal.customer.customerName}</p>
              </div>

              <div className="space-y-4">
                {/* Outstanding amount display */}
                <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-amber-700">Outstanding Amount:</span>
                    <span className="text-lg font-bold text-amber-700">₹{fmtNum(paymentModal.customer.outstanding)}</span>
                  </div>
                </div>

                {/* Amount input */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-base focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    placeholder="Enter amount"
                    autoFocus
                  />
                </div>

                {/* Payment mode selector */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Payment Mode</label>
                  <div className="flex gap-2">
                    {['Cash', 'UPI', 'NEFT', 'Cheque'].map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPaymentMode(mode)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                          paymentMode === mode
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-slate-100 text-slate-600 active:scale-[0.98]'
                        }`}
                      >
                        {mode === 'Cash' && '💵 Cash'}
                        {mode === 'UPI' && '📱 UPI'}
                        {mode === 'NEFT' && '🏦 NEFT'}
                        {mode === 'Cheque' && '📝 Cheque'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Note input */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Note (optional)</label>
                  <input
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-base focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    value={paymentNote}
                    onChange={e => setPaymentNote(e.target.value)}
                    placeholder="Transaction reference, remarks..."
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setPaymentModal(null)}
                  className="flex-1 py-3 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 active:scale-[0.98] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePayment}
                  disabled={paying}
                  className="flex-1 py-3 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {paying ? <Spinner size={18} /> : <><CreditCard size={16} /> Record Payment</>}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}