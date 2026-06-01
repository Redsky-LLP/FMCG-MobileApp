import { useEffect, useState } from 'react';
import { Gift, TrendingUp, Package } from 'lucide-react';
import { incentivesApi } from '../../api/services';
import { SalesmanIncentiveSummaryDto, fmtNum } from '../../types';
import { Spinner, EmptyState } from '../../components/ui';
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

  if (loading) return <Spinner />;

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-10">
      <div className="px-4 pt-6 pb-4 border-b border-[var(--border)]">
        <h1 className="text-xl font-bold text-white">My Incentives</h1>
        <p className="text-sm text-[var(--muted)] mt-1">{user?.name}</p>
      </div>

      {error && (
        <div className="mx-4 mt-4 alert alert-error">{error}</div>
      )}

      {!summary && !error && (
        <EmptyState title="No incentive data" message="No incentives available for your account yet." />
      )}

      {summary && (
        <div className="px-4 mt-6 space-y-6">
          {/* KPI summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card text-center">
              <Gift size={24} className="mx-auto text-[var(--primary)] mb-2" />
              <p className="text-2xl font-bold text-white">₹{fmtNum(summary.totalIncentiveEarned ?? 0)}</p>
              <p className="text-xs text-[var(--muted)] mt-1">Total Earned</p>
            </div>
            <div className="card text-center">
              <TrendingUp size={24} className="mx-auto text-green-400 mb-2" />
              <p className="text-2xl font-bold text-white">₹{fmtNum(summary.pendingPayout ?? 0)}</p>
              <p className="text-xs text-[var(--muted)] mt-1">Pending Payout</p>
            </div>
          </div>

          {/* Per-product breakdown */}
          {summary.productBreakdown && summary.productBreakdown.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">Product Breakdown</h2>
              <div className="space-y-2">
                {summary.productBreakdown.map((item, i) => (
                  <div key={i} className="card flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[var(--primary)]/10 flex items-center justify-center">
                        <Package size={16} className="text-[var(--primary)]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{item.productName}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {item.unitsSold ?? 0} units ·{' '}
                          {item.incentiveType === 'PerUnit'
                            ? `₹${fmtNum(item.incentiveRate ?? 0)} / unit`
                            : `${item.incentiveRate}%`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-white">₹{fmtNum(item.earned ?? 0)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Period info */}
          {summary.periodStart && (
            <div className="card">
              <p className="text-xs text-[var(--muted)] mb-1">Incentive Period</p>
              <p className="text-sm font-semibold text-white">
                {new Date(summary.periodStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                {summary.periodEnd && ` – ${new Date(summary.periodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
