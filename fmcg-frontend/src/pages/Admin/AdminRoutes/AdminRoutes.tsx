// PATH: src/pages/Admin/AdminRoutes/AdminRoutes.tsx
// UPDATED: Dark theme with orange accent

import { useEffect, useState } from 'react';
import { Plus, X, RefreshCw, Route, ArrowLeft, Map, Users, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { routesApi, usersApi } from '../../../api/services';
import type { RouteDto, UserDto } from '../../../types';
import { PageLoader, Alert, EmptyState } from '../../../components/ui';
import { RoutesTable } from './components/RoutesTable';
import { AddRouteCard } from './components/AddRouteCard';
import type { RouteFormData } from './types';

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

export function AdminRoutes() {
  const navigate = useNavigate();
  const [routes,      setRoutes]      = useState<RouteDto[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');
  const [saving,      setSaving]      = useState(false);
  // const [salesmen,    setSalesmen]    = useState<UserDto[]>([]);
  const [showAddCard, setShowAddCard] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try { setRoutes(await routesApi.getAll()); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to load routes'); }
    finally { setLoading(false); }
  }

  
  useEffect(() => { load(); }, []);
  // useEffect(() => { if (showAddCard) loadSalesmen(); }, [showAddCard]);

  async function handleAdd(form: RouteFormData) {
    if (!form.name.trim()) return;
    setSaving(true); setError('');
    try {
      await routesApi.create({
        name: form.name,
        description: form.description || undefined,
        // assignedSalesmanId: form.assignedSalesmanId || undefined,
      });
      setShowAddCard(false);
      setSuccess('Route created successfully!');
      setTimeout(() => setSuccess(''), 3000);
      await load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  function handleEdit(route: RouteDto) {
    navigate(`/admin/routes/edit/${route.id}`, { state: { route } });
  }

  

  function handleDelete(routeId: string) {
    const route = routes.find(r => String(r.id) === routeId);
    navigate(`/admin/routes/delete/${routeId}`, {
      state: { routeId, routeName: route?.name ?? 'Route' }
    });
  }

  // Stats
  const activeCount   = routes.filter(r => r.isActive).length;
  const assignedCount = routes.filter(r => r.assignedSalesmanName).length;
  const totalCustomers = routes.reduce((s, r) => s + (r.customerCount ?? 0), 0);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: D.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <PageLoader />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: D.bg, padding: '0 0 40px' }}>

      {/* ── Hero Header ──────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(135deg, #0F172A 0%, #1E293B 60%, ${D.accent}22 100%)`,
        padding: '20px 24px 28px',
        borderBottom: `1px solid ${D.border}`,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{
          position: 'absolute', top: -40, right: -40,
          width: 200, height: 200, borderRadius: '50%',
          background: 'rgba(234,88,12,0.05)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, left: 100,
          width: 280, height: 280, borderRadius: '50%',
          background: 'rgba(234,88,12,0.03)', pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* Back arrow + breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <button
              onClick={() => navigate('/admin/dashboard')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 8,
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid rgba(255,255,255,0.10)`,
                color: D.muted, cursor: 'pointer',
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
            >
              <ArrowLeft size={14} />
              Dashboard
            </button>
            <span style={{ color: D.sub, fontSize: 13 }}>/</span>
            <span style={{ color: D.muted, fontSize: 13, fontWeight: 600 }}>Routes</span>
          </div>

          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: `${D.accent}22`,
                border: `1px solid ${D.accent}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Map size={24} color={D.accent} strokeWidth={1.8} />
              </div>
              <div>
                <h1 style={{
                  fontSize: 26, fontWeight: 900, color: D.text,
                  margin: 0, letterSpacing: '-0.04em', lineHeight: 1.1,
                }}>
                  Route Management
                </h1>
                <p style={{ color: D.muted, fontSize: 13, margin: '5px 0 0', fontWeight: 500 }}>
                  {routes.length} route{routes.length !== 1 ? 's' : ''} configured
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                onClick={load}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 14px', borderRadius: 9,
                  background: D.surface,
                  border: `1px solid ${D.border}`,
                  color: D.muted, cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = D.accent}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = D.border}
              >
                <RefreshCw size={13} />
                Refresh
              </button>

              <button
                onClick={() => setShowAddCard(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '9px 20px', borderRadius: 9,
                  background: showAddCard ? D.surface : `linear-gradient(135deg, ${D.accent}, ${D.accentH})`,
                  border: showAddCard ? `1px solid ${D.border}` : 'none',
                  color: showAddCard ? D.muted : '#fff',
                  cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 14, fontWeight: 700,
                  boxShadow: showAddCard ? 'none' : `0 4px 14px ${D.accentGlow}`,
                  transition: 'all 0.18s',
                }}
              >
                {showAddCard ? <><X size={14} /> Cancel</> : <><Plus size={14} /> Add Route</>}
              </button>
            </div>
          </div>

          {/* Stat pills */}
          <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
            {[
              { icon: Activity, label: 'Active Routes',     value: activeCount,      color: D.green },
              { icon: Users,    label: 'Assigned',           value: assignedCount,    color: '#3B82F6' },
              { icon: Users,    label: 'Total Customers',   value: totalCustomers,   color: D.amber },
            ].map(s => (
              <div key={s.label} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 14px', borderRadius: 8,
                background: D.surface,
                border: `1px solid ${D.border}`,
              }}>
                <s.icon size={13} style={{ color: s.color }} />
                <span style={{ fontSize: 12, color: D.muted, fontWeight: 500 }}>{s.label}:</span>
                <span style={{ fontSize: 13, color: D.text, fontWeight: 800 }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
        {error   && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        {/* Add Route Card */}
        {showAddCard && (
          <div style={{ marginBottom: 20 }}>
            <AddRouteCard
              // salesmen={salesmen}
              saving={saving}
              error={error}
              onSave={handleAdd}
              onCancel={() => { setShowAddCard(false); setError(''); }}
            />
          </div>
        )}

        {/* Routes Table */}
        {routes.length === 0 && !showAddCard ? (
          <EmptyState
            title="No routes yet"
            message="Add your first delivery route to get started."
            icon={Route}
          />
        ) : (
          <RoutesTable
            routes={routes}
            // onAssign={handleAssign}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      </div>
    </div>
  );
}

export default AdminRoutes;