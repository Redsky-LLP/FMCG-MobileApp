// PATH: src/pages/Admin/AdminReports.tsx
// UPDATED: Dark theme with orange accent, added Back to Dashboard button

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Download, RefreshCw, Loader, CalendarDays, Route as RouteIcon, ArrowLeft } from 'lucide-react';
import { reportsApi, routesApi, productGroupsApi, triggerPdfDownload } from '../../api/services';
import type { RouteDto, ProductGroupDto } from '../../types';
import { Alert } from '../../components/ui';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useAuthStore } from '../../store/authStore';

// ── Dark theme tokens ─────────────────────────────────────────────────────────
const D = {
  bg:       '#0f172a',
  surface:  '#1e293b',
  surface2: '#243447',
  border:   '#334155',
  accent:   '#ea580c',
  accentH:  '#c2410c',
  accentGlow: 'rgba(234,88,12,0.25)',
  text:     '#f1f5f9',
  muted:    '#94a3b8',
  sub:      '#64748b',
  green:    '#22c55e',
  red:      '#ef4444',
  amber:    '#f59e0b',
  card:     '#1e293b',
};

const today = new Date().toISOString().split('T')[0];
const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

export function AdminReports() {
  const { user } = useAuthStore();
  const isMobile = useIsMobile();
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
      .catch(() => setError('Failed to load routes/groups'))
      .finally(() => setLoading(false));
  }, []);

  async function download(key: string, fn: () => Promise<Blob>, filename: string) {
    setDownloading(key); setError(''); setMsg('');
    try {
      const blob = await fn();
      triggerPdfDownload(blob, filename);
      setMsg(`${filename} downloaded.`);
      setTimeout(() => setMsg(''), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally { setDownloading(null); }
  }

  // Report configurations
  const reports = [
    {
      key: 'loading',
      title: 'Loading Sheet',
      desc: 'Warehouse picking list for today\'s deliveries',
      icon: '📦',
      color: D.accent,
      roles: 'Warehouse / Admin',
      filters: (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select 
            className="input" 
            value={loadRoute} 
            onChange={(e) => setLoadRoute(e.target.value)} 
            style={{ 
              width: isMobile ? '100%' : 'auto', 
              background: D.bg, 
              border: `1px solid ${D.border}`,
              color: D.text,
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">🌍 All Routes</option>
            {routes.map((r) => <option key={r.id} value={r.id}>📍 {r.name}</option>)}
          </select>
          <input 
            className="input" 
            type="date" 
            value={loadDate} 
            onChange={(e) => setLoadDate(e.target.value)} 
            style={{ 
              width: isMobile ? '100%' : 'auto', 
              background: D.bg, 
              border: `1px solid ${D.border}`,
              color: D.text,
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
        </div>
      ),
      onDownload: () => download('loading', () => reportsApi.downloadLoadingSheet(loadRoute || undefined, loadDate), `LoadingSheet_${loadDate}.pdf`),
    },
    {
      key: 'billing',
      title: 'Billing Sheet',
      desc: 'Accounts billing report with customer-wise totals',
      icon: '🧾',
      color: '#22C55E',
      roles: 'Accounts / Admin',
      filters: (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select 
            className="input" 
            value={billRoute} 
            onChange={(e) => setBillRoute(e.target.value)} 
            style={{ 
              width: isMobile ? '100%' : 'auto', 
              background: D.bg, 
              border: `1px solid ${D.border}`,
              color: D.text,
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">🌍 All Routes</option>
            {routes.map((r) => <option key={r.id} value={r.id}>📍 {r.name}</option>)}
          </select>
          <input 
            className="input" 
            type="date" 
            value={billDate} 
            onChange={(e) => setBillDate(e.target.value)} 
            style={{ 
              width: isMobile ? '100%' : 'auto', 
              background: D.bg, 
              border: `1px solid ${D.border}`,
              color: D.text,
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
        </div>
      ),
      onDownload: () => download('billing', () => reportsApi.downloadBillingSheet(billRoute || undefined, billDate), `BillingSheet_${billDate}.pdf`),
    },
    {
      key: 'routeSummary',
      title: 'Route Summary Report',
      desc: 'Route-wise performance summary for a date range',
      icon: '📊',
      color: '#3B82F6',
      roles: 'Admin',
      filters: (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select 
            className="input" 
            value={routeRptRoute} 
            onChange={(e) => setRouteRptRoute(e.target.value)} 
            style={{ 
              width: isMobile ? '100%' : 'auto', 
              background: D.bg, 
              border: `1px solid ${D.border}`,
              color: D.text,
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">🌍 All Routes</option>
            {routes.map((r) => <option key={r.id} value={r.id}>📍 {r.name}</option>)}
          </select>
          <input 
            className="input" 
            type="date" 
            value={routeFrom} 
            onChange={(e) => setRouteFrom(e.target.value)} 
            style={{ 
              width: isMobile ? '100%' : 'auto', 
              background: D.bg, 
              border: `1px solid ${D.border}`,
              color: D.text,
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          <span style={{ color: D.sub, fontSize: 13, alignSelf: 'center' }}>to</span>
          <input 
            className="input" 
            type="date" 
            value={routeTo} 
            onChange={(e) => setRouteTo(e.target.value)} 
            style={{ 
              width: isMobile ? '100%' : 'auto', 
              background: D.bg, 
              border: `1px solid ${D.border}`,
              color: D.text,
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
        </div>
      ),
      onDownload: () => download('routeSummary', () => reportsApi.downloadRouteSummary(routeRptRoute || undefined, routeFrom, routeTo), `RouteSummary_${routeFrom}_${routeTo}.pdf`),
    },
    {
      key: 'productSummary',
      title: 'Product Summary Report',
      desc: 'SKU-level movement and revenue analysis',
      icon: '📦',
      color: '#8B5CF6',
      roles: 'Admin',
      filters: (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select 
            className="input" 
            value={prodGroup} 
            onChange={(e) => setProdGroup(e.target.value)} 
            style={{ 
              width: isMobile ? '100%' : 'auto', 
              background: D.bg, 
              border: `1px solid ${D.border}`,
              color: D.text,
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">📦 All Groups</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <input 
            className="input" 
            type="date" 
            value={prodFrom} 
            onChange={(e) => setProdFrom(e.target.value)} 
            style={{ 
              width: isMobile ? '100%' : 'auto', 
              background: D.bg, 
              border: `1px solid ${D.border}`,
              color: D.text,
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          <span style={{ color: D.sub, fontSize: 13, alignSelf: 'center' }}>to</span>
          <input 
            className="input" 
            type="date" 
            value={prodTo} 
            onChange={(e) => setProdTo(e.target.value)} 
            style={{ 
              width: isMobile ? '100%' : 'auto', 
              background: D.bg, 
              border: `1px solid ${D.border}`,
              color: D.text,
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
        </div>
      ),
      onDownload: () => download('productSummary', () => reportsApi.downloadProductSummary(prodGroup || undefined, prodFrom, prodTo), `ProductSummary_${prodFrom}_${prodTo}.pdf`),
    },
    {
      key: 'daily',
      title: 'Daily Summary Report',
      desc: 'Full operational day summary',
      icon: '📋',
      color: '#14B8A6',
      roles: 'Admin / Accounts',
      filters: (
        <input 
          className="input" 
          type="date" 
          value={dailyDate} 
          onChange={(e) => setDailyDate(e.target.value)} 
          style={{ 
            width: isMobile ? '100%' : 'auto', 
            background: D.bg, 
            border: `1px solid ${D.border}`,
            color: D.text,
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 13,
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
      ),
      onDownload: () => download('daily', () => reportsApi.downloadDailySummary(dailyDate), `DailySummary_${dailyDate}.pdf`),
    },
  ];

  if (loading) return (
    <div style={{ minHeight: '100vh', background: D.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: D.muted }}>Loading reports...</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: D.bg, padding: '20px 16px 100px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* ── Back Button ────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <Link 
            to={user?.role === 'Admin' || user?.role === 'SuperAdmin' ? '/admin/dashboard' : '/'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 10,
              background: D.surface,
              border: `1px solid ${D.border}`,
              color: D.muted,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'all 0.2s',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = D.text;
              e.currentTarget.style.borderColor = D.accent;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = D.muted;
              e.currentTarget.style.borderColor = D.border;
            }}
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: `${D.accent}22`,
              border: `1px solid ${D.accent}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileText size={24} color={D.accent} />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 900, color: D.text, margin: 0, letterSpacing: '-0.03em' }}>
                Reports
              </h1>
              <p style={{ color: D.muted, fontSize: 13, marginTop: 4, fontWeight: 500 }}>
                Download PDF operational reports
              </p>
            </div>
          </div>
        </div>

        {error && <Alert variant="error">{error}</Alert>}
        {msg   && <Alert variant="success">{msg}</Alert>}

        {/* Report Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {reports.map((report) => (
            <div
              key={report.key}
              style={{
                background: D.surface,
                border: `1px solid ${D.border}`,
                borderRadius: 14,
                padding: '20px 22px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = `${report.color}44`;
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = D.border;
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  {/* Title row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 20 }}>{report.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 16, color: D.text }}>
                      {report.title}
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: D.sub,
                      background: D.bg,
                      padding: '2px 8px',
                      borderRadius: 12,
                      border: `1px solid ${D.border}`,
                    }}>
                      {report.roles}
                    </span>
                  </div>
                  <p style={{ color: D.muted, fontSize: 13, margin: '0 0 14px' }}>
                    {report.desc}
                  </p>
                  {report.filters}
                </div>

                <button
                  onClick={report.onDownload}
                  disabled={downloading === report.key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 20px',
                    borderRadius: 10,
                    border: 'none',
                    background: downloading === report.key
                      ? D.border
                      : `linear-gradient(135deg, ${report.color}, ${report.color}dd)`,
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: downloading === report.key ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    boxShadow: downloading === report.key
                      ? 'none'
                      : `0 4px 14px ${report.color}33`,
                    transition: 'all 0.15s',
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => {
                    if (downloading !== report.key) {
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 20px ${report.color}44`;
                    }
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                    if (downloading !== report.key) {
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 14px ${report.color}33`;
                    }
                  }}
                >
                  {downloading === report.key
                    ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
                    : <><Download size={16} /> Download PDF</>
                  }
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div style={{
          marginTop: 24,
          padding: '12px 16px',
          borderRadius: 10,
          background: D.surface,
          border: `1px solid ${D.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <CalendarDays size={16} color={D.sub} />
          <span style={{ fontSize: 12, color: D.muted }}>
            Reports are generated in PDF format. All dates are in IST.
          </span>
        </div>
      </div>
    </div>
  );
}