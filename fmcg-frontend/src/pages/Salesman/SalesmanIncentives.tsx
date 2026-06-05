// src/pages/Salesman/SalesmanIncentives.tsx
import { useEffect, useState } from 'react';
import { Gift, TrendingUp, Package, Calendar, ArrowUpRight, Award, Clock, CheckCircle2 } from 'lucide-react';
import { incentivesApi } from '../../api/services';
import { SalesmanIncentiveSummaryDto, fmtNum } from '../../types';
import { Spinner, EmptyState, Alert } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';

export default function SalesmanIncentives() {
  const user = useAuthStore(s => s.user);
  const [summary, setSummary] = useState<SalesmanIncentiveSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    incentivesApi.salesmanSummary()
      .then(setSummary)
      .catch(e => setError(e.message ?? 'Failed to load incentives'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Spinner size={40} />
    </div>
  );

  const firstName = user?.name?.split(' ')[0] ?? 'Salesman';
  const currentMonth = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">My Incentives</h1>
              <p className="text-sm text-slate-500 mt-0.5">{firstName} · {currentMonth}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full">Salesman</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 py-6">
        {error && (
          <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            ⚠️ {error}
          </div>
        )}

        {!summary && !error && (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <Gift size={48} className="mx-auto text-slate-300 mb-3 opacity-50" />
            <p className="text-slate-500 font-medium">No incentive data available</p>
            <p className="text-sm text-slate-400 mt-1">Incentives will appear here once orders are approved.</p>
          </div>
        )}

        {summary && (
          <div className="space-y-6">
            {/* Hero Section - KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Total Earned Card */}
              <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-5 text-white shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="bg-white/20 p-2 rounded-xl">
                    <Gift size={20} className="text-white" />
                  </div>
                  <span className="text-xs bg-white/20 px-2 py-1 rounded-full">This Period</span>
                </div>
                <p className="text-3xl font-bold">₹{fmtNum(summary.totalIncentiveEarned ?? 0)}</p>
                <p className="text-sm text-blue-100 mt-1">Total Earned</p>
              </div>

              {/* Pending Payout Card */}
              <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="bg-white/20 p-2 rounded-xl">
                    <Clock size={20} className="text-white" />
                  </div>
                  <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Awaiting</span>
                </div>
                <p className="text-3xl font-bold">₹{fmtNum(summary.pendingPayout ?? 0)}</p>
                <p className="text-sm text-amber-100 mt-1">Pending Payout</p>
              </div>

              {/* Qualified Orders Card */}
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="bg-white/20 p-2 rounded-xl">
                    <Award size={20} className="text-white" />
                  </div>
                  <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Earned</span>
                </div>
                <p className="text-3xl font-bold">{summary.qualifiedOrders ?? 0}</p>
                <p className="text-sm text-emerald-100 mt-1">Qualified Orders</p>
              </div>
            </div>

            {/* Period Info */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Calendar size={18} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Incentive Period</p>
                  <p className="font-semibold text-slate-800">
                    {summary.periodStart && new Date(summary.periodStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {summary.periodEnd && ` – ${new Date(summary.periodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <CheckCircle2 size={14} className="text-emerald-500" />
                <span>Incentives calculated automatically</span>
              </div>
            </div>

            {/* Product Breakdown Section */}
            {summary.productBreakdown && summary.productBreakdown.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-5 py-4 border-b border-slate-200">
                  <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Package size={18} className="text-blue-600" />
                    Product-wise Breakdown
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">Incentives earned per product</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {summary.productBreakdown.map((item, i) => (
                    <div key={i} className="px-5 py-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <Package size={14} className="text-blue-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800">{item.productName}</p>
                              <p className="text-xs text-slate-400">
                                {item.unitsSold ?? 0} units sold · 
                                {item.incentiveType === 'PerUnit' 
                                  ? ` ₹${fmtNum(item.incentiveRate ?? 0)} / unit`
                                  : ` ${item.incentiveRate}% of sale`}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-emerald-600">₹{fmtNum(item.earned ?? 0)}</p>
                          <span className="text-xs text-slate-400 flex items-center gap-1 justify-end">
                            <TrendingUp size={10} /> earned
                          </span>
                        </div>
                      </div>
                      
                      {/* Progress bar for visual */}
                      {summary.totalIncentiveEarned && summary.totalIncentiveEarned > 0 && (
                        <div className="mt-2">
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
                              style={{ width: `${((item.earned ?? 0) / summary.totalIncentiveEarned) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State with helpful message */}
            {(!summary.productBreakdown || summary.productBreakdown.length === 0) && (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <TrendingUp size={24} className="text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">No incentives earned yet</h3>
                <p className="text-slate-500 text-sm max-w-md mx-auto">
                  Incentives are calculated based on your sales performance. 
                  Complete more orders to start earning!
                </p>
              </div>
            )}

            {/* Tip Section */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <ArrowUpRight size={14} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-800">How to earn more?</p>
                  <p className="text-xs text-blue-600 mt-1">
                    Each product has its own incentive rate. Check with your admin for 
                    current incentive offers on high-margin products.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}