import React, { useEffect, useState } from 'react';
import { FileText, Download, RefreshCw, Loader } from 'lucide-react';
import { reportsApi, routesApi, productGroupsApi, triggerPdfDownload } from '../../api/services';
import type { RouteDto, ProductGroupDto } from '../../types';
import { Alert } from '../../components/ui';

const today = new Date().toISOString().split('T')[0];
const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

export function AdminReports() {
  const [routes,     setRoutes]     = useState<RouteDto[]>([]);
  const [groups,     setGroups]     = useState<ProductGroupDto[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error,      setError]      = useState('');
  const [msg,        setMsg]        = useState('');

  // Filters per report
  const [loadRoute,  setLoadRoute]  = useState('');
  const [loadDate,   setLoadDate]   = useState(today);
  const [billRoute,  setBillRoute]  = useState('');
  const [billDate,   setBillDate]   = useState(today);
  const [routeRptRoute, setRouteRptRoute] = useState('');
  const [routeFrom, setRouteFrom]  = useState(thirtyDaysAgo);
  const [routeTo,   setRouteTo]    = useState(today);
  const [prodGroup, setProdGroup]   = useState('');
  const [prodFrom,  setProdFrom]    = useState(thirtyDaysAgo);
  const [prodTo,    setProdTo]      = useState(today);
  const [dailyDate, setDailyDate]   = useState(today);

  useEffect(() => {
    Promise.all([routesApi.getAll(), productGroupsApi.getAll()])
      .then(([r, g]) => { setRoutes(r); setGroups(g); })
      .finally(() => setLoading(false));
  }, []);

  async function download(key: string, fn: () => Promise<Blob>, filename: string) {
    setDownloading(key); setError(''); setMsg('');
    try {
      const blob = await fn();
      triggerPdfDownload(blob, filename);
      setMsg(`${filename} downloaded.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally { setDownloading(null); }
  }

  const reports = [
    {
      key: 'loading',
      title: 'Loading Sheet',
      desc: 'Warehouse picking list for today\'s deliveries (Warehouse / Admin)',
      color: 'var(--amber)',
      filters: (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select className="input" value={loadRoute} onChange={(e) => setLoadRoute(e.target.value)} style={{ width: 'auto' }}>
            <option value="">All Routes</option>
            {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <input className="input" type="date" value={loadDate} onChange={(e) => setLoadDate(e.target.value)} style={{ width: 'auto' }} />
        </div>
      ),
      onDownload: () => download('loading', () => reportsApi.downloadLoadingSheet(loadRoute || undefined, loadDate), `LoadingSheet_${loadDate}.pdf`),
    },
    {
      key: 'billing',
      title: 'Billing Sheet',
      desc: 'Accounts billing report with customer-wise totals (Accounts / Admin)',
      color: 'var(--green)',
      filters: (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select className="input" value={billRoute} onChange={(e) => setBillRoute(e.target.value)} style={{ width: 'auto' }}>
            <option value="">All Routes</option>
            {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <input className="input" type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} style={{ width: 'auto' }} />
        </div>
      ),
      onDownload: () => download('billing', () => reportsApi.downloadBillingSheet(billRoute || undefined, billDate), `BillingSheet_${billDate}.pdf`),
    },
    {
      key: 'routeSummary',
      title: 'Route Summary Report',
      desc: 'Route-wise performance summary for a date range',
      color: 'var(--primary)',
      filters: (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select className="input" value={routeRptRoute} onChange={(e) => setRouteRptRoute(e.target.value)} style={{ width: 'auto' }}>
            <option value="">All Routes</option>
            {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <input className="input" type="date" value={routeFrom} onChange={(e) => setRouteFrom(e.target.value)} style={{ width: 'auto' }} />
          <input className="input" type="date" value={routeTo}   onChange={(e) => setRouteTo(e.target.value)}   style={{ width: 'auto' }} />
        </div>
      ),
      onDownload: () => download('routeSummary', () => reportsApi.downloadRouteSummary(routeRptRoute || undefined, routeFrom, routeTo), `RouteSummary_${routeFrom}_${routeTo}.pdf`),
    },
    {
      key: 'productSummary',
      title: 'Product Summary Report',
      desc: 'SKU-level movement and revenue analysis',
      color: 'var(--blue)',
      filters: (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select className="input" value={prodGroup} onChange={(e) => setProdGroup(e.target.value)} style={{ width: 'auto' }}>
            <option value="">All Groups</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <input className="input" type="date" value={prodFrom} onChange={(e) => setProdFrom(e.target.value)} style={{ width: 'auto' }} />
          <input className="input" type="date" value={prodTo}   onChange={(e) => setProdTo(e.target.value)}   style={{ width: 'auto' }} />
        </div>
      ),
      onDownload: () => download('productSummary', () => reportsApi.downloadProductSummary(prodGroup || undefined, prodFrom, prodTo), `ProductSummary_${prodFrom}_${prodTo}.pdf`),
    },
    {
      key: 'daily',
      title: 'Daily Summary Report',
      desc: 'Full operational day summary (Admin / Accounts)',
      color: 'var(--text-sub)',
      filters: (
        <input className="input" type="date" value={dailyDate} onChange={(e) => setDailyDate(e.target.value)} style={{ width: 'auto' }} />
      ),
      onDownload: () => download('daily', () => reportsApi.downloadDailySummary(dailyDate), `DailySummary_${dailyDate}.pdf`),
    },
  ];

  return (
    <div className="page-content">
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Reports</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Download PDF operational reports</p>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {msg   && <Alert variant="success">{msg}</Alert>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {reports.map((r) => (
          <div key={r.key} className="card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <FileText size={18} color={r.color} />
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{r.title}</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 14px' }}>{r.desc}</p>
                {r.filters}
              </div>
              <button
                className="btn btn-primary"
                onClick={r.onDownload}
                disabled={downloading === r.key}
                style={{ flexShrink: 0, marginTop: 4 }}
              >
                {downloading === r.key ? <Loader size={16} className="animate-spin" /> : <Download size={16} />}
                Download PDF
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
