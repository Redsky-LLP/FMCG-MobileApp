// PATH: src/pages/Warehouse/WarehouseLoading.tsx
// FIXED: Proper routeId handling (GUID strings, not numbers)
// FIXED: Loading sheet download with correct parameters

import { useEffect, useState } from 'react';
import { Truck, Download, Loader2, Package, CheckCircle2 } from 'lucide-react';
import { reportsApi, routesApi } from '../../api/services';
import type { RouteDto } from '../../types';

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function WarehouseLoading() {
  const [routes,      setRoutes]      = useState<RouteDto[]>([]);
  const [date,        setDate]        = useState(today());
  const [routeId,     setRouteId]     = useState<string>(''); // Always string (GUID)
  const [downloading, setDownloading] = useState(false);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState(false);

  useEffect(() => {
    routesApi.list().then(r => {
      setRoutes(r);
      // Auto-select first route if available
      if (r.length > 0) {
        setRouteId(String(r[0].id));
      }
    }).catch((err) => {
      console.error('Failed to load routes:', err);
      setError('Could not load routes. Please refresh the page.');
    });
  }, []);

  const download = async () => {
    setError('');
    setSuccess(false);
    
    if (!routeId) { 
      setError('Please select a route first.'); 
      return; 
    }
    
    if (!date) {
      setError('Please select a date.');
      return;
    }
    
    setDownloading(true);
    
    try {
      // Call the API with routeId as string (GUID)
      const blob = await reportsApi.loadingSheet(date, routeId);
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Find route name for filename
      const selectedRoute = routes.find(r => String(r.id) === routeId);
      const routeName = selectedRoute?.name || routeId;
      const safeRouteName = routeName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      
      a.download = `loading-sheet-${date}-${safeRouteName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (e: unknown) {
      console.error('Download error:', e);
      const errorMessage = e instanceof Error ? e.message : 'Download failed. Please try again.';
      setError(errorMessage);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="page-content">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg,#0E7490 0%,#06B6D4 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(6,182,212,0.30)',
            flexShrink: 0,
          }}>
            <Truck size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.03em' }}>
              Loading Sheet
            </h1>
            <p style={{ color: 'var(--text-sub)', fontSize: 14, marginTop: 2 }}>
              Warehouse Portal — Generate & download route PDF
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* ── Left: What is a Loading Sheet ──────────────────────────────── */}
        <div className="card" style={{ borderLeft: '4px solid #06B6D4' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'rgba(6,182,212,0.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Package size={18} color="#0E7490" />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                What is a Loading Sheet?
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.7 }}>
                The loading sheet lists all products and quantities to be loaded onto the vehicle
                for a route on a given day. Select the date and route, then download the PDF to
                hand off to the loading team.
              </p>
            </div>
          </div>
        </div>

        {/* ── Right: Generate Report form ─────────────────────────────────── */}
        <div className="card">
          <h2 style={{
            fontSize: 12, fontWeight: 700, color: 'var(--text-sub)',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20,
          }}>
            Generate Report
          </h2>

          {/* Date */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
              Date
            </label>
            <input
              type="date"
              className="input"
              style={{ width: '100%' }}
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>

          {/* Route */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
              Route
            </label>
            <select
              className="input"
              style={{ width: '100%' }}
              value={routeId}
              onChange={e => setRouteId(e.target.value)}
            >
              <option value="">Select a route…</option>
              {routes.map(r => (
                <option key={String(r.id)} value={String(r.id)}>
                  {r.name} {r.assignedSalesmanName ? `(${r.assignedSalesmanName})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Error / Success */}
          {error && (
            <div style={{
              background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 14,
              fontSize: 13, color: '#DC2626',
            }}>
              ⚠️ {error}
            </div>
          )}
          {success && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 14,
              fontSize: 13, color: '#16A34A',
            }}>
              <CheckCircle2 size={15} />
              Loading sheet downloaded successfully!
            </div>
          )}

          {/* Download Button */}
          <button
            onClick={download}
            disabled={downloading || !routeId}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, padding: '12px 20px', borderRadius: 10, border: 'none',
              background: routeId && !downloading
                ? 'linear-gradient(135deg,#0E7490 0%,#06B6D4 100%)'
                : '#E2E8F0',
              color: routeId && !downloading ? '#fff' : '#94A3B8',
              fontSize: 14, fontWeight: 700, cursor: routeId && !downloading ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              boxShadow: routeId && !downloading ? '0 4px 14px rgba(6,182,212,0.30)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {downloading
              ? <><Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} /> Generating PDF…</>
              : <><Download size={17} /> Download Loading Sheet</>
            }
          </button>
        </div>
      </div>

      {/* ── Quick-Select Route Grid ──────────────────────────────────────── */}
      {routes.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{
            fontSize: 12, fontWeight: 700, color: 'var(--text-sub)',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14,
          }}>
            Quick Select Route
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {routes.map(r => {
              const isActive = routeId === String(r.id);
              return (
                <button
                  key={String(r.id)}
                  onClick={() => setRouteId(String(r.id))}
                  style={{
                    background: isActive ? 'rgba(6,182,212,0.08)' : '#fff',
                    border: isActive ? '2px solid #06B6D4' : '1px solid var(--border)',
                    borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                    textAlign: 'left', transition: 'all 0.15s', fontFamily: 'inherit',
                    boxShadow: isActive ? '0 0 0 3px rgba(6,182,212,0.12)' : 'var(--shadow-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 9,
                      background: isActive ? 'rgba(6,182,212,0.15)' : '#F1F5F9',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Truck size={16} color={isActive ? '#0E7490' : '#94A3B8'} />
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: isActive ? '#0E7490' : 'var(--text)', margin: 0 }}>
                        {r.name}
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {r.assignedSalesmanName || 'Unassigned'}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}