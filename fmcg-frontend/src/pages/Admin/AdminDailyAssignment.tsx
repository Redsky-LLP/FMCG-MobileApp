// PATH: src/pages/Admin/AdminDailyAssignment.tsx
// UPDATED: Mobile-responsive week grid (scrollable) + stacked day list on very small screens

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Plus, Trash2, CalendarDays, List } from 'lucide-react';
import { routeAssignmentsApi, usersApi, routesApi } from '../../api/services';
import type { RouteAssignmentDto, UserDto, RouteDto } from '../../types';
import { PageLoader, Spinner, Alert, EmptyState } from '../../components/ui';
import { useIsMobile } from '../../hooks/useIsMobile';

function dateStr(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function weekStart(d: Date) {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay() + 1);
  return r;
}
function fmtDay(d: Date) {
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function AdminDailyAssignment() {
  const isMobile = useIsMobile();
  const [weekAnchor, setWeekAnchor] = useState(weekStart(new Date()));
  const [assignments, setAssignments] = useState<RouteAssignmentDto[]>([]);
  const [routes,      setRoutes]      = useState<RouteDto[]>([]);
  const [salesmen,    setSalesmen]    = useState<UserDto[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');
  const [mobileView,  setMobileView]  = useState<'grid' | 'list'>('list');

  const [addModal,    setAddModal]    = useState<string | null>(null);
  const [addRouteId,  setAddRouteId]  = useState('');
  const [addSalesId,  setAddSalesId]  = useState('');
  const [addNotes,    setAddNotes]    = useState('');
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState<string | null>(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekAnchor, i));
  const from = dateStr(weekDays[0]);
  const to   = dateStr(weekDays[6]);

  async function load() {
    setLoading(true); setError('');
    try {
      const [a, r, s] = await Promise.all([
        routeAssignmentsApi.getByDateRange(from, to),
        routesApi.getAll(),
        usersApi.getAll('Salesman'),
      ]);
      setAssignments(a);
      setRoutes(r);
      setSalesmen(s);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [from]);

  async function handleSave() {
    if (!addModal || !addRouteId || !addSalesId) return;
    setSaving(true); setError('');
    try {
      await routeAssignmentsApi.upsert({
        routeId:        addRouteId,
        salesmanId:     addSalesId,
        assignmentDate: addModal,
        notes:          addNotes || undefined,
      });
      setSuccess('Assignment saved.');
      setAddModal(null); setAddRouteId(''); setAddSalesId(''); setAddNotes('');
      await load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await routeAssignmentsApi.delete(id);
      setSuccess('Override removed.');
      await load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally { setDeleting(null); }
  }

  if (loading) return <PageLoader />;

  // Shared day card renderer
  const renderDayCard = (day: Date, compact = false) => {
    const ds = dateStr(day);
    const isToday = ds === dateStr(new Date());
    const dayAssignments = assignments.filter(
      a => dateStr(new Date(a.assignmentDate)) === ds
    );

    return (
      <div
        key={ds}
        style={{
          border: `1px solid ${isToday ? 'var(--primary)' : 'var(--border)'}`,
          borderRadius: 12,
          padding: compact ? '10px 12px' : 10,
          background: isToday ? 'var(--primary-glow)' : 'var(--card)',
          minHeight: compact ? 'auto' : 160,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <p style={{ fontSize: compact ? 12 : 11, color: isToday ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600, margin: 0 }}>
              {compact
                ? day.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
                : day.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase()}
            </p>
            {!compact && (
              <p style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                {day.getDate()}
              </p>
            )}
          </div>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => { setAddModal(ds); setAddRouteId(''); setAddSalesId(''); setAddNotes(''); }}
            title="Add assignment"
          >
            <Plus size={14} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {dayAssignments.length === 0 && (
            <p style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>No overrides</p>
          )}
          {dayAssignments.map(a => (
            <div
              key={a.id}
              style={{
                background: a.isPermanent ? 'var(--border)' : 'var(--primary-glow)',
                border: `1px solid ${a.isPermanent ? 'var(--border)' : 'var(--primary)'}`,
                borderRadius: 6, padding: '4px 6px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 10, fontWeight: 700, margin: 0, color: a.isPermanent ? 'var(--text-muted)' : 'var(--primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {a.routeName}
                </p>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {a.salesmanName}
                </p>
              </div>
              {!a.isPermanent && a.id !== '00000000-0000-0000-0000-000000000000' && (
                <button
                  onClick={() => handleDelete(a.id)}
                  disabled={deleting === a.id}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 4px', color: 'var(--text-muted)', flexShrink: 0 }}
                >
                  {deleting === a.id ? <Spinner size={10} /> : <Trash2 size={10} />}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="page-content">
      {/* Header */}
      <div className="section-header" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Daily Route Assignment</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Assign salesmen to routes per day. Overrides the permanent assignment for that date.
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load}><RefreshCw size={14} /></button>
      </div>

      {/* Info banner */}
      <div className="alert alert-info" style={{ marginBottom: 16, background: 'var(--amber-bg)', border: '1px solid var(--amber)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 20 }}>📅</span>
          <div>
            <strong style={{ color: 'var(--amber)' }}>When to use Daily Assignment:</strong>
            <ul style={{ margin: '4px 0 0 20px', fontSize: 12, color: 'var(--text-muted)' }}>
              <li>Salesman is on leave (sick, vacation)</li>
              <li>Route needs to be covered by a different salesman for a specific day</li>
              <li>Training a new salesman (shadowing an experienced one)</li>
            </ul>
            <p style={{ marginTop: 6, fontSize: 11, color: 'var(--amber)', background: 'rgba(245,158,11,0.1)', padding: '6px 10px', borderRadius: 6 }}>
              💡 This overrides the permanent assignment ONLY for the selected date.
            </p>
          </div>
        </div>
      </div>

      {error   && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* Week navigator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn btn-outline btn-sm" onClick={() => setWeekAnchor(w => addDays(w, -7))}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 200 }}>
          <CalendarDays size={14} style={{ display: 'inline', marginRight: 6 }} />
          {fmtDay(weekDays[0])} — {fmtDay(weekDays[6])}
        </span>
        <button className="btn btn-outline btn-sm" onClick={() => setWeekAnchor(w => addDays(w, 7))}>
          <ChevronRight size={16} />
        </button>
        <button className="btn btn-outline btn-sm" onClick={() => setWeekAnchor(weekStart(new Date()))}>
          This Week
        </button>
        {/* Mobile view toggle */}
        {isMobile && (
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setMobileView(v => v === 'list' ? 'grid' : 'list')}
            title="Toggle view"
          >
            <List size={14} />
          </button>
        )}
      </div>

      {/* Week grid / list */}
      {isMobile && mobileView === 'list' ? (
        /* Mobile: stacked list of days */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {weekDays.map(day => renderDayCard(day, true))}
        </div>
      ) : isMobile ? (
        /* Mobile: compact horizontal scroll */
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(130px, 1fr))', gap: 8, minWidth: 910 }}>
            {weekDays.map(day => renderDayCard(day, false))}
          </div>
        </div>
      ) : (
        /* Desktop: 7-col grid */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {weekDays.map(day => renderDayCard(day, false))}
        </div>
      )}

      {/* Add Assignment Modal */}
      {addModal && (
        <div className="modal-overlay" onClick={() => setAddModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 'min(calc(100vw - 32px), 400px)' }}>
            <h3 style={{ marginTop: 0, fontWeight: 700 }}>
              Assign Route — {new Date(addModal + 'T00:00:00').toLocaleDateString('en-IN', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Route *</label>
                <select className="input" value={addRouteId} onChange={e => setAddRouteId(e.target.value)}>
                  <option value="">Select route…</option>
                  {routes.map(r => <option key={String(r.id)} value={String(r.id)}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Salesman *</label>
                <select className="input" value={addSalesId} onChange={e => setAddSalesId(e.target.value)}>
                  <option value="">Select salesman…</option>
                  {salesmen.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Notes (optional)</label>
                <input className="input" placeholder="e.g. Covering for Rajesh" value={addNotes} onChange={e => setAddNotes(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setAddModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !addRouteId || !addSalesId}>
                {saving ? <Spinner size={16} /> : 'Save Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}