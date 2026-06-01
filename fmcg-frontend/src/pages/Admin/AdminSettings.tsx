import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Settings, RefreshCw, ArrowUp, ArrowDown } from 'lucide-react';
import { productGroupsApi, unitsApi } from '../../api/services';
import type { ProductGroupDto, UnitDto, UnitPriorityDto } from '../../types';
import { Spinner, Alert, EmptyState, Field, ConfirmModal } from '../../components/ui';

export function AdminSettings() {
  const [groups,   setGroups]   = useState<ProductGroupDto[]>([]);
  const [units,    setUnits]    = useState<UnitDto[]>([]);
  const [priorities, setPriorities] = useState<UnitPriorityDto[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [priorityLoading, setPriorityLoading] = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');
  const [tab,      setTab]      = useState<'groups' | 'units' | 'priorities'>('groups');
  const [updatingPriority, setUpdatingPriority] = useState<string | null>(null);

  // Groups form state
  const [gModal,   setGModal]   = useState<'add' | 'edit' | null>(null);
  const [gSelected, setGSelected] = useState<ProductGroupDto | null>(null);
  const [gForm, setGForm] = useState({ name: '', nameMl: '' });
  const [gSaving, setGSaving] = useState(false);
  const [gConfirm, setGConfirm] = useState<string | null>(null);
  const [gDeleting, setGDeleting] = useState(false);

  // Units form state
  const [uModal,   setUModal]   = useState<'add' | 'edit' | null>(null);
  const [uSelected, setUSelected] = useState<UnitDto | null>(null);
  const [uForm, setUForm] = useState({ name: '', abbreviation: '' });
  const [uSaving, setUSaving] = useState(false);
  const [uConfirm, setUConfirm] = useState<string | null>(null);
  const [uDeleting, setUDeleting] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try {
      const [g, u] = await Promise.all([productGroupsApi.getAll(), unitsApi.getAll()]);
      setGroups(g); setUnits(u);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally { setLoading(false); }
  }

  async function loadPriorities() {
    setPriorityLoading(true);
    try {
      const p = await unitsApi.getPriorities();
      setPriorities(p);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load priorities');
    } finally {
      setPriorityLoading(false);
    }
  }

  async function handleUpdatePriority(unitId: string, newPriority: number) {
    setUpdatingPriority(unitId);
    try {
      await unitsApi.updatePriority(unitId, newPriority);
      await loadPriorities();
      setSuccess('Loading priority updated.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setUpdatingPriority(null);
    }
  }

  useEffect(() => { load(); loadPriorities(); }, []);

  // Group handlers
  async function saveGroup() {
    if (!gForm.name.trim()) return;
    setGSaving(true); setError('');
    try {
      if (gModal === 'add') await productGroupsApi.create(gForm.name, gForm.nameMl || undefined);
      else if (gSelected) await productGroupsApi.update(gSelected.id, gForm.name, gForm.nameMl || undefined);
      setGModal(null); load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setGSaving(false); }
  }

  async function deleteGroup() {
    if (!gConfirm) return;
    setGDeleting(true);
    try { await productGroupsApi.delete(gConfirm); setGConfirm(null); load(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Delete failed'); }
    finally { setGDeleting(false); }
  }

  // Unit handlers
  async function saveUnit() {
    if (!uForm.name.trim()) return;
    setUSaving(true); setError('');
    try {
      if (uModal === 'add') await unitsApi.create(uForm.name, uForm.abbreviation || undefined);
      else if (uSelected) await unitsApi.update(uSelected.id, uForm.name, uForm.abbreviation || undefined);
      setUModal(null); load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setUSaving(false); }
  }

  async function deleteUnit() {
    if (!uConfirm) return;
    setUDeleting(true);
    try { await unitsApi.delete(uConfirm); setUConfirm(null); load(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Delete failed'); }
    finally { setUDeleting(false); }
  }

  return (
    <div className="page-content">
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Settings</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Product groups and measurement units</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load}><RefreshCw size={14} /></button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {[['groups', 'Product Groups'], ['units', 'Units'], ['priorities', 'Loading Priorities']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as 'groups' | 'units' | 'priorities')} style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer',
            background: 'transparent', fontFamily: 'inherit',
            color: tab === k ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: `2px solid ${tab === k ? 'var(--primary)' : 'transparent'}`,
            marginBottom: -1, transition: 'all 0.12s',
          }}>{l}</button>
        ))}
      </div>

      {/* Product Groups */}
      {tab === 'groups' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Product Groups ({groups.length})</h3>
            <button className="btn btn-primary btn-sm" onClick={() => { setGSelected(null); setGForm({ name: '', nameMl: '' }); setGModal('add'); }}>
              <Plus size={14} /> Add Group
            </button>
          </div>
          {groups.length === 0 ? (
            <EmptyState title="No groups yet" icon={Settings} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {groups.map((g) => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{g.name}</span>
                    {g.nameMl && <span style={{ color: 'var(--text-muted)', fontSize: 13, marginLeft: 8 }}>{g.nameMl}</span>}
                    {g.productCount !== undefined && <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 8 }}>({g.productCount} products)</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setGSelected(g); setGForm({ name: g.name, nameMl: g.nameMl ?? '' }); setGModal('edit'); }}><Edit2 size={13} /></button>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setGConfirm(g.id)}><Trash2 size={13} color="var(--red)" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Units */}
      {tab === 'units' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Units ({units.length})</h3>
            <button className="btn btn-primary btn-sm" onClick={() => { setUSelected(null); setUForm({ name: '', abbreviation: '' }); setUModal('add'); }}>
              <Plus size={14} /> Add Unit
            </button>
          </div>
          {units.length === 0 ? (
            <EmptyState title="No units yet" icon={Settings} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {units.map((u) => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</span>
                    {u.abbreviation && <span style={{ color: 'var(--primary)', fontSize: 12, marginLeft: 8, fontFamily: 'monospace' }}>[{u.abbreviation}]</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setUSelected(u); setUForm({ name: u.name, abbreviation: u.abbreviation ?? '' }); setUModal('edit'); }}><Edit2 size={13} /></button>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setUConfirm(u.id)}><Trash2 size={13} color="var(--red)" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Group modal */}
      {gModal && (
        <div className="modal-overlay" onClick={() => setGModal(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, fontWeight: 700 }}>{gModal === 'add' ? 'Add' : 'Edit'} Product Group</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Group Name" required><input className="input" value={gForm.name} onChange={(e) => setGForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Beverages" /></Field>
              <Field label="Malayalam Name"><input className="input" value={gForm.nameMl} onChange={(e) => setGForm((p) => ({ ...p, nameMl: e.target.value }))} placeholder="ഗ്രൂപ്പ് (optional)" lang="ml" /></Field>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-outline" onClick={() => setGModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveGroup} disabled={gSaving}>{gSaving ? <Spinner size={16} /> : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Unit modal */}
      {uModal && (
        <div className="modal-overlay" onClick={() => setUModal(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, fontWeight: 700 }}>{uModal === 'add' ? 'Add' : 'Edit'} Unit</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Unit Name" required><input className="input" value={uForm.name} onChange={(e) => setUForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Kilogram" /></Field>
              <Field label="Abbreviation"><input className="input" value={uForm.abbreviation} onChange={(e) => setUForm((p) => ({ ...p, abbreviation: e.target.value }))} placeholder="e.g. kg" /></Field>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-outline" onClick={() => setUModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveUnit} disabled={uSaving}>{uSaving ? <Spinner size={16} /> : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Priorities */}
      {tab === 'priorities' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Unit Loading Priorities</h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Lower number = Load FIRST in van
            </div>
          </div>

          {success && <Alert variant="success">{success}</Alert>}

          <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, lineHeight: 1.6 }}>
            <strong>📦 Loading Priority Guide:</strong><br/>
            • Priority 1: Load FIRST (e.g., Heavy bags go at bottom)<br/>
            • Priority 99: Load LAST (e.g., Small items go on top)<br/>
            • Items are grouped by priority when generating Loading Sheet
          </div>

          {priorityLoading ? (
            <Spinner />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 2fr 1fr 100px',
                padding: '10px 14px',
                background: 'var(--border-lite)',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-muted)',
              }}>
                <div>Priority</div>
                <div>Unit Name</div>
                <div>Symbol</div>
                <div style={{ textAlign: 'center' }}>Actions</div>
              </div>

              {priorities.length === 0 ? (
                <EmptyState title="No units with priorities" />
              ) : (
                priorities.map((unit) => (
                  <div key={unit.id} style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 2fr 1fr 100px',
                    alignItems: 'center',
                    padding: '10px 14px',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: unit.loadingPriority <= 5 ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                  }}>
                    <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 14 }}>
                      {unit.loadingPriority}
                    </div>
                    <div style={{ fontWeight: 600 }}>{unit.name}</div>
                    <div style={{ color: 'var(--text-muted)' }}>{unit.symbol || '—'}</div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => handleUpdatePriority(unit.id, Math.max(1, unit.loadingPriority - 1))}
                        disabled={updatingPriority === unit.id || unit.loadingPriority <= 1}
                        title="Increase priority (load earlier)"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => handleUpdatePriority(unit.id, unit.loadingPriority + 1)}
                        disabled={updatingPriority === unit.id}
                        title="Decrease priority (load later)"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--border-lite)', padding: 12, borderRadius: 8 }}>
              <p style={{ fontWeight: 600, margin: '0 0 8px 0' }}>📦 How Loading Priority Works:</p>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>Priority 1 items are loaded FIRST (bottom of van)</li>
                <li>Priority 99 items are loaded LAST (top of van, unloaded first)</li>
                <li>First delivery customer's items should have HIGHEST priority numbers</li>
                <li>Last delivery customer's items should have LOWEST priority numbers</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {gConfirm && <ConfirmModal title="Delete Group" message="This will delete the product group." danger loading={gDeleting} onConfirm={deleteGroup} onCancel={() => setGConfirm(null)} />}
      {uConfirm && <ConfirmModal title="Delete Unit" message="This will delete the measurement unit." danger loading={uDeleting} onConfirm={deleteUnit} onCancel={() => setUConfirm(null)} />}
    </div>
  );
}
