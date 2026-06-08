// PATH: src/pages/Admin/AdminRoutes/AdminRoutes.tsx
// UPDATED:
// 1. Modern UI — gradient header, stat pills, card-based table
// 2. Delete opens a new page (DeleteRoutePage) instead of modal
// 3. Back arrow in top-left corner
// 4. Override removed from RoutesTable props

import { useEffect, useState } from 'react';
import { Plus, X, RefreshCw, Route, ArrowLeft, Map, Users, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { routesApi, usersApi } from '../../../api/services';
import type { RouteDto, UserDto } from '../../../types';
import { PageLoader, Alert, EmptyState } from '../../../components/ui';
import { RoutesTable } from './components/RoutesTable';
import { AddRouteCard } from './components/AddRouteCard';
import type { RouteFormData } from './types';

export function AdminRoutes() {
  const navigate = useNavigate();
  const [routes,      setRoutes]      = useState<RouteDto[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');
  const [saving,      setSaving]      = useState(false);
  const [salesmen,    setSalesmen]    = useState<UserDto[]>([]);
  const [showAddCard, setShowAddCard] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try { setRoutes(await routesApi.getAll()); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to load routes'); }
    finally { setLoading(false); }
  }

  async function loadSalesmen() {
    try { setSalesmen(await usersApi.getAll('Salesman')); } catch {}
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { if (showAddCard) loadSalesmen(); }, [showAddCard]);

  async function handleAdd(form: RouteFormData) {
    if (!form.name.trim()) return;
    setSaving(true); setError('');
    try {
      await routesApi.create({
        name: form.name,
        description: form.description || undefined,
        assignedSalesmanId: form.assignedSalesmanId || undefined,
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

  function handleAssign(route: RouteDto) {
    navigate(`/admin/routes/assign/${route.id}`, { state: { routeId: route.id, routeName: route.name } });
  }

  // Delete navigates to a dedicated page instead of modal
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

  if (loading) return <PageLoader />;

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>

      {/* ── Hero Header ──────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 60%, #2563EB 100%)',
        padding: '0 0 0',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{
          position: 'absolute', top: -40, right: -40,
          width: 200, height: 200, borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, left: 100,
          width: 280, height: 280, borderRadius: '50%',
          background: 'rgba(255,255,255,0.03)', pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px 28px' }}>
          {/* Back arrow + breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <button
              onClick={() => navigate('/admin/dashboard')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 8,
                background: 'rgba(255,255,255,0.10)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.85)', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.18)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.10)'}
            >
              <ArrowLeft size={14} />
              Dashboard
            </button>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>/</span>
            <span style={{ color: 'rgba(255,255,255,0.70)', fontSize: 13, fontWeight: 600 }}>Routes</span>
          </div>

          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: 'rgba(255,255,255,0.12)',
                border: '1.5px solid rgba(255,255,255,0.20)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Map size={24} color="#fff" strokeWidth={1.8} />
              </div>
              <div>
                <h1 style={{
                  fontSize: 26, fontWeight: 800, color: '#fff',
                  margin: 0, letterSpacing: '-0.04em', lineHeight: 1.1,
                }}>
                  Route Management
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.60)', fontSize: 13, margin: '5px 0 0', fontWeight: 500 }}>
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
                  background: 'rgba(255,255,255,0.10)',
                  border: '1px solid rgba(255,255,255,0.20)',
                  color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.18)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.10)'}
              >
                <RefreshCw size={13} />
                Refresh
              </button>

              <button
                onClick={() => setShowAddCard(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '9px 20px', borderRadius: 9,
                  background: showAddCard ? 'rgba(255,255,255,0.10)' : '#fff',
                  border: showAddCard ? '1px solid rgba(255,255,255,0.20)' : 'none',
                  color: showAddCard ? '#fff' : '#1E3A8A',
                  cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 14, fontWeight: 700,
                  boxShadow: showAddCard ? 'none' : '0 4px 14px rgba(0,0,0,0.20)',
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
              { icon: Activity, label: 'Active Routes',     value: activeCount,      color: '#4ADE80' },
              { icon: Users,    label: 'Assigned',           value: assignedCount,    color: '#93C5FD' },
              { icon: Users,    label: 'Total Customers',   value: totalCustomers,   color: '#FCD34D' },
            ].map(s => (
              <div key={s.label} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 14px', borderRadius: 8,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}>
                <s.icon size={13} style={{ color: s.color }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>{s.label}:</span>
                <span style={{ fontSize: 13, color: '#fff', fontWeight: 800 }}>{s.value}</span>
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
              salesmen={salesmen}
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
            onAssign={handleAssign}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      </div>
    </div>
  );
}

export default AdminRoutes;