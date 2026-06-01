import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { analyticsApi, routesApi, productGroupsApi } from '../../api/services';
import type {
  ProductProfitabilityDto, RouteProfitabilityDto, TopProductDto,
  RouteDto, ProductGroupDto,
} from '../../types';
import { fmt, fmtNum } from '../../types';
import { PageLoader, Alert, Badge } from '../../components/ui';

const today = new Date().toISOString().split('T')[0];
const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

export function AdminAnalytics() {
  const [routes,      setRoutes]      = useState<RouteDto[]>([]);
  const [groups,      setGroups]      = useState<ProductGroupDto[]>([]);
  const [prodProfit,  setProdProfit]  = useState<ProductProfitabilityDto[]>([]);
  const [routeProfit, setRouteProfit] = useState<RouteProfitabilityDto[]>([]);
  const [topProducts, setTopProducts] = useState<TopProductDto[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [fromDate,    setFromDate]    = useState(thirtyDaysAgo);
  const [toDate,      setToDate]      = useState(today);
  const [showNeg,     setShowNeg]     = useState(false);
  const [tab,         setTab]         = useState<'products' | 'routes' | 'top'>('products');

  async function load() {
    setLoading(true); setError('');
    try {
      const [pp, rp, tp] = await Promise.all([
        analyticsApi.getProductProfitability({ fromDate, toDate, showOnlyNegativeMargin: showNeg || undefined }),
        analyticsApi.getRouteProfitability({ fromDate, toDate, showOnlyNegativeMargin: showNeg || undefined }),
        analyticsApi.getTopProducts({ fromDate, toDate, limit: 15, sortBy: 'sales' }),
      ]);
      setProdProfit(pp); setRouteProfit(rp); setTopProducts(tp);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally { setLoading(false); }
  }

  useEffect(() => {
    Promise.all([routesApi.getAll(), productGroupsApi.getAll()])
      .then(([r, g]) => { setRoutes(r); setGroups(g); });
  }, []);

  useEffect(() => { load(); }, [fromDate, toDate, showNeg]);

  const tabs = [
    { key: 'products', label: 'Product Profitability' },
    { key: 'routes',   label: 'Route Profitability' },
    { key: 'top',      label: 'Top Products' },
  ] as const;

  function fmtMargin(n: number | undefined): string {
    if (n === undefined || n === null) return '0.00%';
    return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
  }

  return (
    <div className="page-content">
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Analytics</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Profitability & variance insights</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ width: 'auto' }} />
          <span style={{ color: 'var(--text-muted)' }}>to</span>
          <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ width: 'auto' }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={showNeg} onChange={(e) => setShowNeg(e.target.checked)} />
            Negative only
          </label>
          <button className="btn btn-outline btn-sm" onClick={load}><RefreshCw size={14} /></button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer',
              background: 'transparent', fontFamily: 'inherit',
              color: tab === t.key ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: `2px solid ${tab === t.key ? 'var(--primary)' : 'transparent'}`,
              marginBottom: -1, transition: 'all 0.12s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <PageLoader /> : (
        <>
          {/* Product Profitability */}
          {tab === 'products' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Product</th><th>Group</th><th>Qty Sold</th><th>Revenue</th>
                    <th>Variance</th><th>Margin%</th>
                  </tr>
                </thead>
                <tbody>
                  {prodProfit.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No data for this period</td></tr>
                  )}
                  {prodProfit.map((p) => (
                    <tr key={p.productId}>
                      <td style={{ fontWeight: 600 }}>{p.productName}</td>
                      <td style={{ fontSize: 13 }}>{p.productGroupName ?? '—'}</td>
                      <td>{fmtNum(p.totalQuantity)}</td>
                      <td style={{ color: 'var(--green)', fontWeight: 600 }}>{fmt(p.totalSales)}</td>
                      <td>
                        <span className={p.totalVariance < 0 ? 'profit-negative' : 'profit-positive'} style={{ fontWeight: 600 }}>
                          {p.totalVariance < 0 ? '▼' : '▲'} {fmt(Math.abs(p.totalVariance))}
                        </span>
                      </td>
                      <td>
                        <Badge variant={p.totalVariance < 0 ? 'red' : 'green'}>{fmtMargin(p.marginPercentage)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Route Profitability */}
          {tab === 'routes' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Route</th><th>Orders</th><th>Customers</th><th>Revenue</th>
                    <th>Variance</th><th>Margin%</th>
                  </tr>
                </thead>
                <tbody>
                  {routeProfit.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No data for this period</td></tr>
                  )}
                  {routeProfit.map((r) => (
                    <tr key={r.routeId}>
                      <td style={{ fontWeight: 600 }}>{r.routeName}</td>
                      <td>{fmtNum(r.orderCount)}</td>
                      <td>{fmtNum(r.customerCount)}</td>
                      <td style={{ color: 'var(--green)', fontWeight: 600 }}>{fmt(r.totalSales)}</td>
                      <td>
                        <span className={r.totalVariance < 0 ? 'profit-negative' : 'profit-positive'} style={{ fontWeight: 600 }}>
                          {r.totalVariance < 0 ? '▼' : '▲'} {fmt(Math.abs(r.totalVariance))}
                        </span>
                      </td>
                      <td>
                        <Badge variant={r.totalVariance < 0 ? 'red' : 'green'}>{fmtMargin(r.marginPercentage)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Top Products */}
          {tab === 'top' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="tbl">
                <thead>
                  <tr><th>#</th><th>Product</th><th>Qty</th><th>Revenue</th><th>Variance</th><th>Orders</th></tr>
                </thead>
                <tbody>
                  {topProducts.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No data for this period</td></tr>
                  )}
                  {topProducts.map((p, i) => (
                    <tr key={p.productId}>
                      <td>
                        <span style={{
                          display: 'inline-flex', width: 24, height: 24, borderRadius: 6,
                          background: i < 3 ? 'var(--primary-glow)' : 'var(--border-lite)',
                          color: i < 3 ? 'var(--primary)' : 'var(--text-muted)',
                          alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
                        }}>
                          {i + 1}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{p.productName}</td>
                      <td>{fmtNum(p.totalQuantity)}</td>
                      <td style={{ color: 'var(--green)', fontWeight: 600 }}>{fmt(p.totalSales)}</td>
                      <td className={p.totalVariance >= 0 ? 'profit-positive' : 'profit-negative'}>{fmt(p.totalVariance)}</td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{p.orderCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}