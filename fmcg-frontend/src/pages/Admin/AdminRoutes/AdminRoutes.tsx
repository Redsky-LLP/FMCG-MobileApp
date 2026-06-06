import { useEffect, useState } from 'react';
import { Plus, X, RefreshCw, Route, Edit2, Calendar, ChevronDown, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { routesApi, usersApi } from '../../../api/services';
import type { RouteDto, UserDto } from '../../../types';
import { PageLoader, Alert, EmptyState, ConfirmModal, Badge } from '../../../components/ui';
import { RoutesTable } from './components/RoutesTable';
import { AddRouteCard } from './components/AddRouteCard';
import type { RouteFormData } from './types';

export function AdminRoutes() {
  const navigate = useNavigate();
  const [routes, setRoutes] = useState<RouteDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [salesmen, setSalesmen] = useState<UserDto[]>([]);
  const [showAddCard, setShowAddCard] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const loadedRoutes = await routesApi.getAll();
      setRoutes(loadedRoutes);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load routes');
    } finally {
      setLoading(false);
    }
  }

  async function loadSalesmen() {
    try {
      setSalesmen(await usersApi.getAll('Salesman'));
    } catch {}
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (showAddCard) {
      loadSalesmen();
    }
  }, [showAddCard]);

  // ── Add Route ────────────────────────────────────────────────
  async function handleAdd(form: RouteFormData) {
    if (!form.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await routesApi.create({
        name: form.name,
        description: form.description || undefined,
        assignedSalesmanId: form.assignedSalesmanId || undefined,
      });
      setShowAddCard(false);
      setSuccess('Route created successfully');
      setTimeout(() => setSuccess(''), 3000);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  // ── Delete Route ─────────────────────────────────────────────
  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    setError('');
    try {
      await routesApi.delete(confirmDelete);
      setConfirmDelete(null);
      await load();
      setSuccess('Route deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  // ── Navigation to separate pages ─────────────────────────────
  function handleEdit(route: RouteDto) {
    navigate(`/admin/routes/edit/${route.id}`, { state: { route } });
  }

  function handleAssign(route: RouteDto) {
    navigate(`/admin/routes/assign/${route.id}`, { state: { routeId: route.id, routeName: route.name } });
  }

  function handleOverride(route: RouteDto) {
    navigate(`/admin/routes/override/${route.id}`, { state: { routeId: route.id, routeName: route.name } });
  }

  if (loading) return <PageLoader />;

  return (
    <div className="page-content">
      {/* Header */}
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--navy)', letterSpacing: '-0.03em' }}>Routes</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            {routes.length} route{routes.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline btn-sm" onClick={load} title="Refresh">
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setShowAddCard(v => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '9px 20px',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              color: showAddCard ? 'var(--text-sub)' : '#fff',
              border: showAddCard ? '1px solid var(--border)' : 'none',
              background: showAddCard ? 'transparent' : 'linear-gradient(135deg,#1E3A8A 0%,#2563EB 100%)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: showAddCard ? 'none' : '0 3px 10px rgba(37,99,235,0.28)',
              transition: 'all 0.15s',
              letterSpacing: '-0.01em',
            }}
          >
            {showAddCard ? <><X size={15} /> Cancel</> : <><Plus size={15} /> Add Route</>}
          </button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* Routes Table */}
      {routes.length === 0 && !showAddCard ? (
        <EmptyState title="No routes yet" message="Add your first delivery route to get started." icon={Route} />
      ) : routes.length > 0 && (
        <RoutesTable
          routes={routes}
          onAssign={handleAssign}
          onEdit={handleEdit}
          onDelete={(routeId) => setConfirmDelete(routeId)}
        />
      )}

      {/* Inline Add Card */}
      {showAddCard && (
        <AddRouteCard
          salesmen={salesmen}
          saving={saving}
          error={error}
          onSave={handleAdd}
          onCancel={() => { setShowAddCard(false); setError(''); }}
        />
      )}

      {/* Delete Confirm Modal */}
      <ConfirmModal
        open={!!confirmDelete}
        title="Delete Route"
        message="This will permanently delete the route. All customer mappings will be lost. This action cannot be undone."
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

export default AdminRoutes;