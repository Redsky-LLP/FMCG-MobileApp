// PATH: src/pages/Admin/AdminSettings.tsx
// UPDATED: Add Product Group and Add Unit moved into separate page cards (not inline forms)
// They now show as proper card modals triggered by prominent buttons

import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Settings, RefreshCw, ArrowUp, ArrowDown, Package, Ruler, X, ChevronRight } from 'lucide-react';
import { productGroupsApi, unitsApi } from '../../api/services';
import type { ProductGroupDto, UnitDto, UnitPriorityDto } from '../../types';
import { Spinner, Alert, EmptyState, Field, ConfirmModal } from '../../components/ui';
import { useIsMobile } from '../../hooks/useIsMobile';

export function AdminSettings() {
  const isMobile = useIsMobile();
  const [groups,     setGroups]     = useState<ProductGroupDto[]>([]);
  const [units,      setUnits]      = useState<UnitDto[]>([]);
  const [priorities, setPriorities] = useState<UnitPriorityDto[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [priorityLoading, setPriorityLoading] = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');
  const [tab,      setTab]      = useState<'groups' | 'units' | 'priorities'>('groups');
  const [updatingPriority, setUpdatingPriority] = useState<string | null>(null);

  const [gModal,    setGModal]    = useState<'add' | 'edit' | null>(null);
  const [gSelected, setGSelected] = useState<ProductGroupDto | null>(null);
  const [gForm,     setGForm]     = useState({ name: '', nameMl: '' });
  const [gSaving,   setGSaving]   = useState(false);
  const [gConfirm,  setGConfirm]  = useState<string | null>(null);
  const [gDeleting, setGDeleting] = useState(false);

  const [uModal,    setUModal]    = useState<'add' | 'edit' | null>(null);
  const [uSelected, setUSelected] = useState<UnitDto | null>(null);
  const [uForm,     setUForm]     = useState({ name: '', abbreviation: '' });
  const [uSaving,   setUSaving]   = useState(false);
  const [uConfirm,  setUConfirm]  = useState<string | null>(null);
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
    } finally { setPriorityLoading(false); }
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
    } finally { setUpdatingPriority(null); }
  }

  useEffect(() => { load(); loadPriorities(); }, []);

  async function saveGroup() {
    if (!gForm.name.trim()) return;
    setGSaving(true); setError('');
    try {
      if (gModal === 'add') await productGroupsApi.create(gForm.name, gForm.nameMl || undefined);
      else if (gSelected) await productGroupsApi.update(gSelected.id, gForm.name, gForm.nameMl || undefined);
      setGModal(null); load();
      setSuccess(gModal === 'add' ? 'Product group added!' : 'Product group updated!');
      setTimeout(() => setSuccess(''), 3000);
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

  async function saveUnit() {
    if (!uForm.name.trim()) return;
    setUSaving(true); setError('');
    try {
      if (uModal === 'add') await unitsApi.create(uForm.name, uForm.abbreviation || undefined);
      else if (uSelected) await unitsApi.update(uSelected.id, uForm.name, uForm.abbreviation || undefined);
      setUModal(null); load();
      setSuccess(uModal === 'add' ? 'Unit added!' : 'Unit updated!');
      setTimeout(() => setSuccess(''), 3000);
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
      {/* Header */}
      <div className="section-header" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Settings</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Product groups and measurement units</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load}><RefreshCw size={14} /></button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {[['groups', 'Product Groups'], ['units', 'Units'], ['priorities', 'Loading Priorities']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as 'groups' | 'units' | 'priorities')} style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer',
            background: 'transparent', fontFamily: 'inherit', whiteSpace: 'nowrap',
            color: tab === k ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: `2px solid ${tab === k ? 'var(--primary)' : 'transparent'}`,
            marginBottom: -1, transition: 'all 0.12s',
          }}>{l}</button>
        ))}
      </div>

      {/* ── Product Groups Tab ── */}
      {tab === 'groups' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Add Product Group — Separate card */}
          <div style={{
            background: '#fff', border: '1px solid var(--border)',
            borderRadius: 16, padding: '20px 24px',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Package size={20} color="#2563EB" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--navy)' }}>Add Product Group</h3>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                    Create a new product category group
                  </p>
                </div>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => { setGSelected(null); setGForm({ name: '', nameMl: '' }); setGModal('add'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                }}
              >
                <Plus size={16} />
                Add Group
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Groups List */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Product Groups ({groups.length})</h3>
            </div>
            {loading ? <Spinner /> : groups.length === 0 ? (
              <EmptyState title="No groups yet" icon={Settings} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {groups.map((g) => (
                  <div key={g.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', border: '1px solid var(--border)',
                    borderRadius: 10, gap: 8, background: '#FAFBFD',
                    transition: 'all 0.12s',
                  }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F5FF'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#FAFBFD'}
                  >
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563EB', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{g.name}</span>
                      {g.nameMl && <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{g.nameMl}</span>}
                      {g.productCount !== undefined && (
                        <span style={{
                          color: '#2563EB', fontSize: 11, fontWeight: 700,
                          background: '#EFF6FF', padding: '2px 7px', borderRadius: 6,
                        }}>
                          {g.productCount} products
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => { setGSelected(g); setGForm({ name: g.name, nameMl: g.nameMl ?? '' }); setGModal('edit'); }}>
                        <Edit2 size={13} />
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setGConfirm(g.id)}>
                        <Trash2 size={13} color="var(--red)" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Units Tab ── */}
      {tab === 'units' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Add Unit — Separate card */}
          <div style={{
            background: '#fff', border: '1px solid var(--border)',
            borderRadius: 16, padding: '20px 24px',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ruler size={20} color="#16A34A" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--navy)' }}>Add Unit</h3>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                    Add a new measurement unit (kg, litre, piece, etc.)
                  </p>
                </div>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => { setUSelected(null); setUForm({ name: '', abbreviation: '' }); setUModal('add'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                  background: '#16A34A', borderColor: '#16A34A',
                }}
              >
                <Plus size={16} />
                Add Unit
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Units List */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Units ({units.length})</h3>
            </div>
            {loading ? <Spinner /> : units.length === 0 ? (
              <EmptyState title="No units yet" icon={Settings} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {units.map((u) => (
                  <div key={u.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', border: '1px solid var(--border)',
                    borderRadius: 10, gap: 8, background: '#FAFBFD',
                    transition: 'all 0.12s',
                  }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F0FDF8'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#FAFBFD'}
                  >
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</span>
                      {u.abbreviation && (
                        <span style={{
                          color: '#16A34A', fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
                          background: '#F0FDF4', padding: '2px 7px', borderRadius: 6,
                          border: '1px solid #BBF7D0',
                        }}>
                          [{u.abbreviation}]
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => { setUSelected(u); setUForm({ name: u.name, abbreviation: u.abbreviation ?? '' }); setUModal('edit'); }}>
                        <Edit2 size={13} />
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setUConfirm(u.id)}>
                        <Trash2 size={13} color="var(--red)" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Loading Priorities Tab ── */}
      {tab === 'priorities' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Unit Loading Priorities</h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Lower number = Load FIRST</div>
          </div>

          {success && <Alert variant="success">{success}</Alert>}

          <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, lineHeight: 1.6 }}>
            <strong>📦 Priority 1</strong> = Load FIRST (heavy bags, bottom of van) ·
            <strong> Priority 99</strong> = Load LAST (small items, top of van)
          </div>

          {priorityLoading ? <Spinner /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {!isMobile && (
                <div style={{
                  display: 'grid', gridTemplateColumns: '80px 1fr 80px 100px',
                  padding: '10px 14px', background: 'var(--border-lite)',
                  borderRadius: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
                }}>
                  <div>Priority</div><div>Unit Name</div><div>Symbol</div>
                  <div style={{ textAlign: 'center' }}>Actions</div>
                </div>
              )}

              {priorities.length === 0 ? <EmptyState title="No units with priorities" /> : (
                priorities.map((unit) => (
                  <div key={unit.id} style={{
                    display: isMobile ? 'flex' : 'grid',
                    gridTemplateColumns: isMobile ? undefined : '80px 1fr 80px 100px',
                    alignItems: 'center',
                    justifyContent: isMobile ? 'space-between' : undefined,
                    padding: '12px 14px', border: '1px solid var(--border)',
                    borderRadius: 8, gap: 12,
                    background: unit.loadingPriority <= 5 ? 'rgba(59,130,246,0.05)' : 'transparent',
                  }}>
                    {isMobile ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, color: 'var(--primary)' }}>
                            {unit.loadingPriority}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{unit.name}</div>
                            {unit.symbol && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{unit.symbol}</div>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleUpdatePriority(unit.id, Math.max(1, unit.loadingPriority - 1))} disabled={updatingPriority === unit.id || unit.loadingPriority <= 1}><ArrowUp size={14} /></button>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleUpdatePriority(unit.id, unit.loadingPriority + 1)} disabled={updatingPriority === unit.id}><ArrowDown size={14} /></button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 14 }}>{unit.loadingPriority}</div>
                        <div style={{ fontWeight: 600 }}>{unit.name}</div>
                        <div style={{ color: 'var(--text-muted)' }}>{unit.symbol || '—'}</div>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleUpdatePriority(unit.id, Math.max(1, unit.loadingPriority - 1))} disabled={updatingPriority === unit.id || unit.loadingPriority <= 1} title="Increase priority (load earlier)"><ArrowUp size={14} /></button>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleUpdatePriority(unit.id, unit.loadingPriority + 1)} disabled={updatingPriority === unit.id} title="Decrease priority (load later)"><ArrowDown size={14} /></button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Group modal — shown as full page card overlay ── */}
      {gModal && (
        <div className="modal-overlay" onClick={() => setGModal(null)}>
          <div style={{
            background: '#fff', borderRadius: 20, padding: 32,
            width: 'min(calc(100vw - 32px), 440px)',
            boxShadow: '0 24px 64px rgba(15,23,42,0.20)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={18} color="#2563EB" />
                </div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{gModal === 'add' ? 'Add' : 'Edit'} Product Group</h3>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setGModal(null)}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Group Name" required>
                <input className="input" value={gForm.name} onChange={(e) => setGForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Beverages" autoFocus />
              </Field>
              <Field label="Malayalam Name">
                <input className="input" value={gForm.nameMl} onChange={(e) => setGForm(p => ({ ...p, nameMl: e.target.value }))} placeholder="ഗ്രൂപ്പ് (optional)" lang="ml" />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button className="btn btn-outline" onClick={() => setGModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveGroup} disabled={gSaving || !gForm.name.trim()}>
                {gSaving ? <Spinner size={16} /> : (gModal === 'add' ? 'Add Group' : 'Save Changes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Unit modal — shown as full page card overlay ── */}
      {uModal && (
        <div className="modal-overlay" onClick={() => setUModal(null)}>
          <div style={{
            background: '#fff', borderRadius: 20, padding: 32,
            width: 'min(calc(100vw - 32px), 440px)',
            boxShadow: '0 24px 64px rgba(15,23,42,0.20)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Ruler size={18} color="#16A34A" />
                </div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{uModal === 'add' ? 'Add' : 'Edit'} Unit</h3>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setUModal(null)}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Unit Name" required>
                <input className="input" value={uForm.name} onChange={(e) => setUForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Kilogram" autoFocus />
              </Field>
              <Field label="Abbreviation">
                <input className="input" value={uForm.abbreviation} onChange={(e) => setUForm(p => ({ ...p, abbreviation: e.target.value }))} placeholder="e.g. kg" />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button className="btn btn-outline" onClick={() => setUModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveUnit} disabled={uSaving || !uForm.name.trim()}
                style={{ background: '#16A34A', borderColor: '#16A34A' }}>
                {uSaving ? <Spinner size={16} /> : (uModal === 'add' ? 'Add Unit' : 'Save Changes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {gConfirm && <ConfirmModal title="Delete Group" message="This will delete the product group." danger loading={gDeleting} onConfirm={deleteGroup} onCancel={() => setGConfirm(null)} />}
      {uConfirm && <ConfirmModal title="Delete Unit" message="This will delete the measurement unit." danger loading={uDeleting} onConfirm={deleteUnit} onCancel={() => setUConfirm(null)} />}
    </div>
  );
}