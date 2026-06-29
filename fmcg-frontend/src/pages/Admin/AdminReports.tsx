// PATH: src/pages/Admin/AdminReports.tsx
// FIX: Mobile PDF preview - use native viewer or fallback to download

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, Download, RefreshCw, Loader, CalendarDays, 
  ArrowLeft, Eye, X, CheckCircle, AlertCircle, Maximize2,
  Smartphone
} from 'lucide-react';
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

// ── Reusable date input style for better visibility ────────────────────────
const dateInputStyle = (isMobile: boolean): React.CSSProperties => ({
  width: isMobile ? '100%' : 'auto',
  background: D.surface,
  border: `1px solid ${D.border}`,
  color: D.text,
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
  colorScheme: 'dark',
  WebkitAppearance: 'none',
  minWidth: isMobile ? 'auto' : '150px',
});

const selectStyle = (isMobile: boolean): React.CSSProperties => ({
  width: isMobile ? '100%' : 'auto',
  background: D.surface,
  border: `1px solid ${D.border}`,
  color: D.text,
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
  cursor: 'pointer',
  minWidth: isMobile ? 'auto' : '140px',
});

// ── Preview Modal Component ──────────────────────────────────────────────────
// PATH: src/pages/Admin/AdminReports.tsx
// FIX: viewerUrl is not defined - define it properly

// ── Preview Modal Component ──────────────────────────────────────────────────
function PreviewModal({ 
  isOpen, 
  onClose, 
  pdfUrl, 
  title,
  isLoading,
  onDownload,
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  pdfUrl: string | null;
  title: string;
  isLoading: boolean;
  onDownload: () => void;
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isMobile = useIsMobile();

  if (!isOpen) return null;

  // ── FIX: Define viewerUrl here - it was missing ──
  // Use native PDF viewer with zoom=page-fit for better scaling
  const viewerUrl = pdfUrl 
    ? `${pdfUrl}#zoom=page-fit&toolbar=1&navpanes=1&scrollbar=1`
    : null;

  // ── On mobile, use direct URL navigation instead of iframe ──
  const handleOpenInBrowser = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(4px)',
          zIndex: 999,
        }}
      />
      
      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: isFullscreen ? '98vw' : 'min(calc(100vw - 32px), 1100px)',
          height: isFullscreen ? '98vh' : 'min(calc(100vh - 40px), 900px)',
          background: D.surface,
          borderRadius: isFullscreen ? 0 : 16,
          border: `1px solid ${D.border}`,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'all 0.3s ease',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: `1px solid ${D.border}`,
            flexShrink: 0,
            background: D.surface,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: `${D.accent}22`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <FileText size={16} color={D.accent} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: D.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {title}
              </div>
              <div style={{ fontSize: 11, color: D.sub }}>
                {isLoading ? 'Generating preview...' : pdfUrl ? (isMobile ? '✓ Ready - Tap to open' : '✓ Ready - Use mouse wheel to zoom') : 'No data'}
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: `1px solid ${D.border}`,
                background: 'transparent',
                cursor: 'pointer',
                color: D.muted,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              <Maximize2 size={14} />
            </button>
            <button
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: `1px solid ${D.border}`,
                background: 'transparent',
                cursor: 'pointer',
                color: D.muted,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* PDF Content */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            background: D.bg,
            minHeight: 400,
            position: 'relative',
          }}
        >
          {isLoading ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: 16,
                minHeight: 400,
              }}
            >
              <Loader size={48} style={{ animation: 'spin 1s linear infinite', color: D.accent }} />
              <span style={{ color: D.muted, fontSize: 14 }}>Generating preview...</span>
            </div>
          ) : viewerUrl && !isMobile ? (
            /* ── Desktop: iframe viewer ── */
            <iframe
              src={viewerUrl}
              style={{
                width: '100%',
                height: '100%',
                minHeight: 500,
                border: 'none',
                background: '#fff',
                borderRadius: 4,
              }}
              title="PDF Preview"
            />
          ) : viewerUrl && isMobile ? (
            /* ── Mobile: Show "Open PDF" button with preview info ── */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                minHeight: 400,
                gap: 20,
                padding: 24,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: `${D.accent}22`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FileText size={36} color={D.accent} />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: D.text, margin: 0 }}>
                  PDF Ready
                </h3>
                <p style={{ fontSize: 14, color: D.muted, marginTop: 4 }}>
                  {title}
                </p>
                <p style={{ fontSize: 12, color: D.sub, marginTop: 8 }}>
                  Tap the button below to open the PDF in your browser
                </p>
              </div>
              <button
                onClick={handleOpenInBrowser}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 32px',
                  borderRadius: 12,
                  border: 'none',
                  background: `linear-gradient(135deg, ${D.accent}, ${D.accentH})`,
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: `0 4px 16px ${D.accentGlow}`,
                }}
              >
                <Smartphone size={18} />
                Open PDF
              </button>
              <p style={{ fontSize: 11, color: D.sub, marginTop: 8 }}>
                ⚡ Opens in your device's PDF viewer
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                minHeight: 400,
                gap: 12,
                color: D.muted,
              }}
            >
              <AlertCircle size={48} color={D.amber} />
              <span style={{ fontSize: 16, fontWeight: 600, color: D.text }}>No Preview Available</span>
              <span style={{ fontSize: 13, color: D.sub }}>No data found for the selected filters</span>
              <span style={{ fontSize: 12, color: D.muted }}>Try adjusting your filters or download directly</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderTop: `1px solid ${D.border}`,
            flexShrink: 0,
            gap: 10,
            flexWrap: 'wrap',
            background: D.surface,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ 
              fontSize: 11, 
              color: pdfUrl ? D.green : D.sub,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              {pdfUrl ? (
                <><CheckCircle size={12} color={D.green} /> Preview ready</>
              ) : (
                <><AlertCircle size={12} color={D.amber} /> No data</>
              )}
            </span>
            {!isFullscreen && pdfUrl && !isMobile && (
              <span style={{ fontSize: 10, color: D.sub }}>
                🔍 Scroll to zoom · 📄 Auto-fit to page
              </span>
            )}
            {!isFullscreen && pdfUrl && isMobile && (
              <span style={{ fontSize: 10, color: D.sub }}>
                📱 Tap "Open PDF" to view
              </span>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 18px',
                borderRadius: 8,
                border: `1px solid ${D.border}`,
                background: 'transparent',
                color: D.muted,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Close
            </button>
            <button
              onClick={onDownload}
              disabled={!pdfUrl}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 20px',
                borderRadius: 8,
                border: 'none',
                background: pdfUrl ? `linear-gradient(135deg, ${D.accent}, ${D.accentH})` : D.border,
                color: pdfUrl ? '#fff' : D.muted,
                fontSize: 13,
                fontWeight: 700,
                cursor: pdfUrl ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
                boxShadow: pdfUrl ? `0 4px 14px ${D.accentGlow}` : 'none',
                opacity: pdfUrl ? 1 : 0.5,
              }}
            >
              <Download size={14} />
              Download PDF
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function AdminReports() {
  const { user } = useAuthStore();
  const isMobile = useIsMobile();
  const [routes,     setRoutes]     = useState<RouteDto[]>([]);
  const [groups,     setGroups]     = useState<ProductGroupDto[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error,      setError]      = useState('');
  const [msg,        setMsg]        = useState('');

  // ── Preview state ──
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewDownloadFn, setPreviewDownloadFn] = useState<(() => void) | null>(null);

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

  // ── Preview function ──
  async function previewReport(
    key: string,
    title: string,
    fn: () => Promise<Blob>,
    downloadFn: () => void
  ) {
    setPreviewTitle(title);
    setPreviewDownloadFn(() => downloadFn);
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewUrl(null);

    try {
      const blob = await fn();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate preview');
    } finally {
      setPreviewLoading(false);
    }
  }

  // ── Cleanup preview URL on close ──
  const handlePreviewClose = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewOpen(false);
    setPreviewUrl(null);
    setPreviewDownloadFn(null);
  };

  // ── Handle download from preview modal ──
  const handlePreviewDownload = () => {
    if (previewDownloadFn) {
      previewDownloadFn();
      setTimeout(() => handlePreviewClose(), 800);
    }
  };

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
            style={selectStyle(isMobile)}
          >
            <option value="">🌍 All Routes</option>
            {routes.map((r) => <option key={r.id} value={r.id}>📍 {r.name}</option>)}
          </select>
          <input 
            className="input" 
            type="date" 
            value={loadDate} 
            onChange={(e) => setLoadDate(e.target.value)} 
            style={dateInputStyle(isMobile)}
          />
        </div>
      ),
      onDownload: () => download('loading', () => reportsApi.downloadLoadingSheet(loadRoute || undefined, loadDate), `LoadingSheet_${loadDate}.pdf`),
      onPreview: () => {
        const fn = () => reportsApi.downloadLoadingSheet(loadRoute || undefined, loadDate);
        const downloadFn = () => download('loading', fn, `LoadingSheet_${loadDate}.pdf`);
        const routeName = loadRoute ? routes.find(r => r.id === loadRoute)?.name : 'All Routes';
        previewReport('loading', `Loading Sheet - ${loadDate} (${routeName})`, fn, downloadFn);
      },
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
            style={selectStyle(isMobile)}
          >
            <option value="">🌍 All Routes</option>
            {routes.map((r) => <option key={r.id} value={r.id}>📍 {r.name}</option>)}
          </select>
          <input 
            className="input" 
            type="date" 
            value={billDate} 
            onChange={(e) => setBillDate(e.target.value)} 
            style={dateInputStyle(isMobile)}
          />
        </div>
      ),
      onDownload: () => download('billing', () => reportsApi.downloadBillingSheet(billRoute || undefined, billDate), `BillingSheet_${billDate}.pdf`),
      onPreview: () => {
        const fn = () => reportsApi.downloadBillingSheet(billRoute || undefined, billDate);
        const downloadFn = () => download('billing', fn, `BillingSheet_${billDate}.pdf`);
        const routeName = billRoute ? routes.find(r => r.id === billRoute)?.name : 'All Routes';
        previewReport('billing', `Billing Sheet - ${billDate} (${routeName})`, fn, downloadFn);
      },
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
            style={selectStyle(isMobile)}
          >
            <option value="">🌍 All Routes</option>
            {routes.map((r) => <option key={r.id} value={r.id}>📍 {r.name}</option>)}
          </select>
          <input 
            className="input" 
            type="date" 
            value={routeFrom} 
            onChange={(e) => setRouteFrom(e.target.value)} 
            style={dateInputStyle(isMobile)}
          />
          <span style={{ color: D.sub, fontSize: 13, alignSelf: 'center' }}>to</span>
          <input 
            className="input" 
            type="date" 
            value={routeTo} 
            onChange={(e) => setRouteTo(e.target.value)} 
            style={dateInputStyle(isMobile)}
          />
        </div>
      ),
      onDownload: () => download('routeSummary', () => reportsApi.downloadRouteSummary(routeRptRoute || undefined, routeFrom, routeTo), `RouteSummary_${routeFrom}_${routeTo}.pdf`),
      onPreview: () => {
        const fn = () => reportsApi.downloadRouteSummary(routeRptRoute || undefined, routeFrom, routeTo);
        const downloadFn = () => download('routeSummary', fn, `RouteSummary_${routeFrom}_${routeTo}.pdf`);
        const routeName = routeRptRoute ? routes.find(r => r.id === routeRptRoute)?.name : 'All Routes';
        previewReport('routeSummary', `Route Summary - ${routeFrom} to ${routeTo} (${routeName})`, fn, downloadFn);
      },
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
            style={selectStyle(isMobile)}
          >
            <option value="">📦 All Groups</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <input 
            className="input" 
            type="date" 
            value={prodFrom} 
            onChange={(e) => setProdFrom(e.target.value)} 
            style={dateInputStyle(isMobile)}
          />
          <span style={{ color: D.sub, fontSize: 13, alignSelf: 'center' }}>to</span>
          <input 
            className="input" 
            type="date" 
            value={prodTo} 
            onChange={(e) => setProdTo(e.target.value)} 
            style={dateInputStyle(isMobile)}
          />
        </div>
      ),
      onDownload: () => download('productSummary', () => reportsApi.downloadProductSummary(prodGroup || undefined, prodFrom, prodTo), `ProductSummary_${prodFrom}_${prodTo}.pdf`),
      onPreview: () => {
        const fn = () => reportsApi.downloadProductSummary(prodGroup || undefined, prodFrom, prodTo);
        const downloadFn = () => download('productSummary', fn, `ProductSummary_${prodFrom}_${prodTo}.pdf`);
        const groupName = prodGroup ? groups.find(g => g.id === prodGroup)?.name : 'All Groups';
        previewReport('productSummary', `Product Summary - ${prodFrom} to ${prodTo} (${groupName})`, fn, downloadFn);
      },
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
          style={dateInputStyle(isMobile)}
        />
      ),
      onDownload: () => download('daily', () => reportsApi.downloadDailySummary(dailyDate), `DailySummary_${dailyDate}.pdf`),
      onPreview: () => {
        const fn = () => reportsApi.downloadDailySummary(dailyDate);
        const downloadFn = () => download('daily', fn, `DailySummary_${dailyDate}.pdf`);
        previewReport('daily', `Daily Summary - ${dailyDate}`, fn, downloadFn);
      },
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
                Preview & download PDF operational reports
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

                {/* ── Action Buttons ── */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignSelf: 'center' }}>
                  {/* Preview Button */}
                  <button
                    onClick={report.onPreview}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '10px 16px',
                      borderRadius: 10,
                      border: `1px solid ${report.color}44`,
                      background: `${report.color}15`,
                      color: report.color,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = `${report.color}25`;
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = `${report.color}15`;
                    }}
                  >
                    <Eye size={14} />
                    Preview
                  </button>

                  {/* Download Button */}
                  <button
                    onClick={report.onDownload}
                    disabled={downloading === report.key}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
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
                      : <><Download size={14} /> Download</>
                    }
                  </button>
                </div>
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
            <strong>Preview</strong> before downloading · Reports are generated in PDF format · All dates in IST
          </span>
        </div>
      </div>

      {/* ── Preview Modal ── */}
      <PreviewModal
        isOpen={previewOpen}
        onClose={handlePreviewClose}
        pdfUrl={previewUrl}
        title={previewTitle}
        isLoading={previewLoading}
        onDownload={handlePreviewDownload}
      />
    </div>
  );
}