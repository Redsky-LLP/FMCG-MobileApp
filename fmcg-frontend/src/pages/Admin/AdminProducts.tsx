// PATH: src/pages/Admin/AdminProducts.tsx
// UPDATED: Added Back to Dashboard button

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Edit2, Trash2, Package, Search, RefreshCw,
  IndianRupee, History, X, Save, TrendingUp, TrendingDown, DollarSign,
  Settings, Ruler, Boxes, ChevronRight, ArrowUp, ArrowDown, ArrowLeft,
} from 'lucide-react';
import { productsApi, productGroupsApi, unitsApi } from '../../api/services';
import type { ProductDto, ProductGroupDto, UnitDto, UnitPriorityDto, PriceHistoryDto } from '../../types';
import { fmt, fmtDate } from '../../types';
import { PageLoader, Spinner, Alert, ConfirmModal, Field } from '../../components/ui';
import { ProductUnitPriceManager } from '../../components/admin/ProductUnitPriceManager';
import { useIsMobile } from '../../hooks/useIsMobile';

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

// ── Product icon tile ────────────────────────────────────────
function ProductTile({ name }: { name: string }) {
  const colors = ['#ea580c', '#3B82F6', '#8B5CF6', '#22C55E', '#F59E0B', '#EC4899'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div style={{
      width: 52, height: 52, borderRadius: 14, flexShrink: 0,
      background: `${color}15`, border: `1px solid ${color}33`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Package size={24} color={color} strokeWidth={1.8} />
    </div>
  );
}

// ── Reusable input helpers ───────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  background: D.bg, border: `1px solid ${D.border}`,
  borderRadius: 10, fontSize: 14, color: D.text,
  outline: 'none', fontFamily: 'inherit',
  boxSizing: 'border-box', transition: 'all 0.15s',
};

function onFoc(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = D.accent;
  e.target.style.boxShadow = `0 0 0 3px ${D.accentGlow}`;
  (e.target as HTMLElement).style.background = D.surface2;
}

function onBlr(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = D.border;
  e.target.style.boxShadow = 'none';
  (e.target as HTMLElement).style.background = D.bg;
}

function parsePriceFromItemCode(code: string): number | null {
  if (!code || !code.includes('-')) return null;
  const lastDashIndex = code.lastIndexOf('-');
  const pricePart = code.slice(lastDashIndex + 1).trim();
  if (!pricePart) return null;
  const n = parseFloat(pricePart);
  return !isNaN(n) && n >= 0 ? n : null;
}

// ── Product Card ─────────────────────────────────────────────
function ProductCard({
  product, onEdit, onPrice, onHistory, onDelete, onUnitPrices,
}: {
  product: ProductDto;
  onEdit: () => void;
  onPrice: () => void;
  onHistory: () => void;
  onDelete: () => void;
  onUnitPrices: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        background: D.surface,
        border: `1px solid ${hovered ? D.accent : D.border}`,
        borderRadius: 14, padding: '18px 18px 14px',
        transition: 'all 0.18s',
        boxShadow: hovered ? `0 4px 20px ${D.accentGlow}` : 'none',
        position: 'relative' as const,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ position: 'absolute', top: 14, right: 14, width: 8, height: 8, borderRadius: '50%', background: product.isActive ? D.green : D.sub }} title={product.isActive ? 'Active' : 'Inactive'} />

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
        <ProductTile name={product.nameEnglish} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: D.text, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 2 }}>
            {product.nameEnglish}
          </div>
          {product.nameMalayalam && (
            <div style={{ fontSize: 12, color: D.sub, fontFamily: "'Manjari', sans-serif" }}>
              {product.nameMalayalam}
            </div>
          )}
          <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
            {product.itemCode && (
              <span style={{ fontSize: 11, fontWeight: 700, color: D.muted, background: D.bg, border: `1px solid ${D.border}`, padding: '2px 8px', borderRadius: 6 }}>
                #{product.itemCode}
              </span>
            )}
            {product.productGroupName && (
              <span style={{ fontSize: 11, fontWeight: 700, color: D.accent, background: `${D.accent}15`, border: `1px solid ${D.accent}33`, padding: '2px 8px', borderRadius: 6 }}>
                {product.productGroupName}
              </span>
            )}
            {product.productUnitName && (
              <span style={{ fontSize: 11, fontWeight: 600, color: D.sub, background: D.bg, border: `1px solid ${D.border}`, padding: '2px 8px', borderRadius: 6 }}>
                {product.productUnitName}
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 14px', borderRadius: 10, background: `${D.accent}15`, border: `1px solid ${D.accent}33`, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: D.sub }}>Base Price</span>
        <span style={{ fontSize: 20, fontWeight: 900, color: D.accent, letterSpacing: '-0.03em' }}>
          ₹{fmt(product.basePrice)}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, borderTop: `1px solid ${D.border}`, paddingTop: 12, flexWrap: 'wrap' as const }}>
        <button onClick={onUnitPrices} title="Unit Prices"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px', borderRadius: 8, border: `1px solid ${D.accent}33`, background: `${D.accent}15`, fontSize: 12, fontWeight: 700, color: D.accent, cursor: 'pointer', transition: 'all 0.13s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${D.accent}25`; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${D.accent}15`; }}
        >
          <DollarSign size={12} /> Unit Prices
        </button>
        <button onClick={onPrice} title="Update price"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px', borderRadius: 8, border: `1px solid ${D.accent}33`, background: `${D.accent}15`, fontSize: 12, fontWeight: 700, color: D.accent, cursor: 'pointer', transition: 'all 0.13s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${D.accent}25`; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${D.accent}15`; }}
        >
          <IndianRupee size={12} /> Price
        </button>
        <button onClick={onHistory} title="Price history"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px', borderRadius: 8, border: `1px solid ${D.border}`, background: D.bg, fontSize: 12, fontWeight: 700, color: D.muted, cursor: 'pointer', transition: 'all 0.13s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = D.accent; (e.currentTarget as HTMLElement).style.color = D.accent; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = D.border; (e.currentTarget as HTMLElement).style.color = D.muted; }}
        >
          <History size={12} /> History
        </button>
        <button onClick={onEdit} title="Edit"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px', borderRadius: 8, border: `1px solid ${D.border}`, background: D.bg, fontSize: 12, fontWeight: 700, color: D.muted, cursor: 'pointer', transition: 'all 0.13s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = D.accent; (e.currentTarget as HTMLElement).style.color = D.accent; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = D.border; (e.currentTarget as HTMLElement).style.color = D.muted; }}
        >
          <Edit2 size={12} /> Edit
        </button>
        <button onClick={onDelete} title="Delete"
          style={{ width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: `1px solid ${D.border}`, background: D.bg, color: D.sub, cursor: 'pointer', transition: 'all 0.13s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.15)'; (e.currentTarget as HTMLElement).style.borderColor = D.red; (e.currentTarget as HTMLElement).style.color = D.red; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = D.bg; (e.currentTarget as HTMLElement).style.borderColor = D.border; (e.currentTarget as HTMLElement).style.color = D.sub; }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Product Form Fields ────────────────────────────────────
function ProductFormFields({
  form, setForm, groups, units, autoFocus,
}: {
  form: { name: string; nameMl: string; productGroupId: string; unitId: string; basePrice: string; itemCode: string };
  setForm: React.Dispatch<React.SetStateAction<any>>;
  groups: ProductGroupDto[];
  units: UnitDto[];
  autoFocus?: boolean;
}) {
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 700, color: D.muted,
    marginBottom: 6, letterSpacing: '0.02em', textTransform: 'uppercase' as const,
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={lbl}>Product Name <span style={{ color: D.red }}>*</span></label>
        <input value={form.name} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))}
          placeholder="Name in English" style={inp} onFocus={onFoc} onBlur={onBlr} autoFocus={autoFocus} />
      </div>
      <div>
        <label style={lbl}>Malayalam Name <span style={{ fontSize: 10, color: D.sub }}>(optional)</span></label>
        <input value={form.nameMl} onChange={e => setForm((p: any) => ({ ...p, nameMl: e.target.value }))}
          placeholder="മലയാളം" lang="ml" style={inp} onFocus={onFoc} onBlur={onBlr} />
      </div>
      <div style={{ padding: '16px', borderRadius: 12, background: `${D.accent}10`, border: `1px solid ${D.accent}33` }}>
        <label style={{ ...lbl, color: D.accent }}>Item Code <span style={{ color: D.red }}>*</span></label>
        <input value={form.itemCode} onChange={e => setForm((p: any) => ({ ...p, itemCode: e.target.value }))}
          placeholder="e.g. 1000-90" style={{ ...inp, fontSize: 18, fontWeight: 800, color: D.accent, background: D.surface2, border: `1px solid ${D.accent}33` }}
          onFocus={onFoc} onBlur={onBlr} />
        <p style={{ margin: '8px 0 0', fontSize: 11, color: D.sub }}>
          Format: <strong>code-price</strong> — the number after the last dash is the price. "1000-90" → price ₹90.
        </p>
        {(() => {
          const parsed = parsePriceFromItemCode(form.itemCode);
          if (!form.itemCode) return null;
          return parsed !== null ? (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: D.accent, fontWeight: 600 }}>
              Salesman will see: <strong>{form.itemCode}</strong> · price ₹{parsed}
            </p>
          ) : (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: D.red, fontWeight: 600 }}>
              ⚠ No price found — add a dash and the price at the end, e.g. "{form.itemCode}-90".
            </p>
          );
        })()}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={lbl}>Product Group <span style={{ color: D.red }}>*</span></label>
          <select value={form.productGroupId} onChange={e => setForm((p: any) => ({ ...p, productGroupId: e.target.value }))}
            style={{ ...inp, cursor: 'pointer' }} onFocus={onFoc} onBlur={onBlr}>
            <option value="">Select group</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Unit</label>
          <select value={form.unitId} onChange={e => setForm((p: any) => ({ ...p, unitId: e.target.value }))}
            style={{ ...inp, cursor: 'pointer' }} onFocus={onFoc} onBlur={onBlr}>
            <option value="">None</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

// ── Settings Modal ─────────────────────────────────────────
function SettingsModal({ isOpen, onClose, groups, units, priorities, onGroupUpdate, onUnitUpdate, onPriorityUpdate }: {
  isOpen: boolean;
  onClose: () => void;
  groups: ProductGroupDto[];
  units: UnitDto[];
  priorities: UnitPriorityDto[];
  onGroupUpdate: () => void;
  onUnitUpdate: () => void;
  onPriorityUpdate: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'groups' | 'units' | 'priorities'>('groups');
  
  // Group state
  const [gModal, setGModal] = useState<'add' | 'edit' | null>(null);
  const [gSelected, setGSelected] = useState<ProductGroupDto | null>(null);
  const [gForm, setGForm] = useState({ name: '', nameMl: '' });
  const [gSaving, setGSaving] = useState(false);
  const [gConfirm, setGConfirm] = useState<string | null>(null);
  const [gDeleting, setGDeleting] = useState(false);

  // Unit state
  const [uModal, setUModal] = useState<'add' | 'edit' | null>(null);
  const [uSelected, setUSelected] = useState<UnitDto | null>(null);
  const [uForm, setUForm] = useState({ name: '', abbreviation: '' });
  const [uSaving, setUSaving] = useState(false);
  const [uConfirm, setUConfirm] = useState<string | null>(null);
  const [uDeleting, setUDeleting] = useState(false);
  const [updatingPriority, setUpdatingPriority] = useState<string | null>(null);

  async function saveGroup() {
    if (!gForm.name.trim()) return;
    setGSaving(true);
    try {
      if (gModal === 'add') await productGroupsApi.create(gForm.name, gForm.nameMl || undefined);
      else if (gSelected) await productGroupsApi.update(gSelected.id, gForm.name, gForm.nameMl || undefined);
      setGModal(null);
      onGroupUpdate();
    } catch (err: unknown) { console.error(err); }
    finally { setGSaving(false); }
  }

  async function deleteGroup() {
    if (!gConfirm) return;
    setGDeleting(true);
    try { await productGroupsApi.delete(gConfirm); setGConfirm(null); onGroupUpdate(); }
    catch (err: unknown) { console.error(err); }
    finally { setGDeleting(false); }
  }

  async function saveUnit() {
    if (!uForm.name.trim()) return;
    setUSaving(true);
    try {
      if (uModal === 'add') await unitsApi.create(uForm.name, uForm.abbreviation || undefined);
      else if (uSelected) await unitsApi.update(uSelected.id, uForm.name, uForm.abbreviation || undefined);
      setUModal(null);
      onUnitUpdate();
    } catch (err: unknown) { console.error(err); }
    finally { setUSaving(false); }
  }

  async function deleteUnit() {
    if (!uConfirm) return;
    setUDeleting(true);
    try { await unitsApi.delete(uConfirm); setUConfirm(null); onUnitUpdate(); }
    catch (err: unknown) { console.error(err); }
    finally { setUDeleting(false); }
  }

  async function handleUpdatePriority(unitId: string, newPriority: number) {
    setUpdatingPriority(unitId);
    try {
      await unitsApi.updatePriority(unitId, newPriority);
      onPriorityUpdate();
    } catch (err: unknown) { console.error(err); }
    finally { setUpdatingPriority(null); }
  }

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-40" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#1e293b] rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] z-50 shadow-xl border border-[#334155] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Settings size={20} className="text-[#ea580c]" />
            <h2 className="text-xl font-bold text-[#f1f5f9]">Catalog Config</h2>
            <span className="text-xs text-[#64748b] bg-[#0f172a] px-2 py-1 rounded-full">Product Groups & Units</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#334155] text-[#94a3b8]">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${D.border}`, marginBottom: 16, overflowX: 'auto', flexShrink: 0 }}>
          {[
            ['groups', `Groups (${groups.length})`],
            ['units', `Units (${units.length})`],
            ['priorities', 'Loading Priorities']
          ].map(([k, l]) => (
            <button key={k} onClick={() => setActiveTab(k as 'groups' | 'units' | 'priorities')} style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: 'transparent', fontFamily: 'inherit', whiteSpace: 'nowrap',
              color: activeTab === k ? D.accent : D.muted,
              borderBottom: `2px solid ${activeTab === k ? D.accent : 'transparent'}`,
              marginBottom: -1, transition: 'all 0.12s',
            }}>{l}</button>
          ))}
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Product Groups Tab ── */}
          {activeTab === 'groups' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                onClick={() => { setGSelected(null); setGForm({ name: '', nameMl: '' }); setGModal('add'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 18px', borderRadius: 10,
                  background: `linear-gradient(135deg, ${D.accent}, ${D.accentH})`,
                  border: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: `0 4px 14px ${D.accentGlow}`,
                  width: 'fit-content',
                }}
              >
                <Plus size={16} /> Add Product Group
              </button>

              {groups.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 20px', color: D.sub, background: D.surface, borderRadius: 12, border: `1px solid ${D.border}` }}>
                  <Boxes size={32} color={D.border} style={{ marginBottom: 8 }} />
                  <p>No product groups yet</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {groups.map((g) => (
                    <div key={g.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', border: `1px solid ${D.border}`,
                      borderRadius: 10, gap: 8, background: D.bg,
                      transition: 'all 0.12s',
                    }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = D.surface2}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = D.bg}
                    >
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: D.accent, flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, fontSize: 14, color: D.text }}>{g.name}</span>
                        {g.nameMl && <span style={{ color: D.sub, fontSize: 13 }}>{g.nameMl}</span>}
                        {g.productCount !== undefined && (
                          <span style={{ color: D.accent, fontSize: 11, fontWeight: 700, background: `${D.accent}15`, padding: '2px 7px', borderRadius: 6 }}>
                            {g.productCount} products
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button className="btn btn-ghost btn-icon btn-sm"
                          onClick={() => { setGSelected(g); setGForm({ name: g.name, nameMl: g.nameMl ?? '' }); setGModal('edit'); }}>
                          <Edit2 size={13} color={D.muted} />
                        </button>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setGConfirm(g.id)}>
                          <Trash2 size={13} color={D.red} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Units Tab ── */}
          {activeTab === 'units' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                onClick={() => { setUSelected(null); setUForm({ name: '', abbreviation: '' }); setUModal('add'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 18px', borderRadius: 10,
                  background: `linear-gradient(135deg, ${D.green}, ${D.green}dd)`,
                  border: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: `0 4px 14px rgba(34,197,94,0.25)`,
                  width: 'fit-content',
                }}
              >
                <Plus size={16} /> Add Unit
              </button>

              {units.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 20px', color: D.sub, background: D.surface, borderRadius: 12, border: `1px solid ${D.border}` }}>
                  <Ruler size={32} color={D.border} style={{ marginBottom: 8 }} />
                  <p>No units yet</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {units.map((u) => (
                    <div key={u.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', border: `1px solid ${D.border}`,
                      borderRadius: 10, gap: 8, background: D.bg,
                      transition: 'all 0.12s',
                    }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = D.surface2}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = D.bg}
                    >
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: D.green, flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, fontSize: 14, color: D.text }}>{u.name}</span>
                        {u.abbreviation && (
                          <span style={{ color: D.green, fontSize: 11, fontWeight: 700, fontFamily: 'monospace', background: `${D.green}15`, padding: '2px 7px', borderRadius: 6, border: `1px solid ${D.green}33` }}>
                            [{u.abbreviation}]
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button className="btn btn-ghost btn-icon btn-sm"
                          onClick={() => { setUSelected(u); setUForm({ name: u.name, abbreviation: u.abbreviation ?? '' }); setUModal('edit'); }}>
                          <Edit2 size={13} color={D.muted} />
                        </button>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setUConfirm(u.id)}>
                          <Trash2 size={13} color={D.red} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Loading Priorities Tab ── */}
          {activeTab === 'priorities' && (
            <div style={{ background: D.surface, borderRadius: 12, border: `1px solid ${D.border}`, padding: '16px' }}>
              <div style={{ fontSize: 12, color: D.muted, marginBottom: 12 }}>
                <strong style={{ color: D.accent }}>Priority 1</strong> = Load FIRST (heavy bags, bottom of van) ·
                <strong style={{ color: D.accent }}> Priority 99</strong> = Load LAST (small items, top of van)
              </div>
              {priorities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: D.sub }}>No units with priorities</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {priorities.map((unit) => (
                    <div key={unit.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', border: `1px solid ${D.border}`,
                      borderRadius: 8, background: D.bg,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: `${D.accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: D.accent }}>
                          {unit.loadingPriority}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: D.text }}>{unit.name}</div>
                          {unit.symbol && <div style={{ color: D.sub, fontSize: 12 }}>{unit.symbol}</div>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleUpdatePriority(unit.id, Math.max(1, unit.loadingPriority - 1))} disabled={updatingPriority === unit.id || unit.loadingPriority <= 1}>
                          <ArrowUp size={14} color={D.muted} />
                        </button>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleUpdatePriority(unit.id, unit.loadingPriority + 1)} disabled={updatingPriority === unit.id}>
                          <ArrowDown size={14} color={D.muted} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 mt-4 pt-4 border-t border-[#334155] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#334155] text-[#94a3b8] hover:bg-[#334155] transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>

      {/* Group Modal */}
      {gModal && (
        <div className="fixed inset-0 bg-black/70 z-60 flex items-center justify-center p-4" onClick={() => setGModal(null)}>
          <div style={{ background: D.surface, borderRadius: 20, padding: 32, width: 'min(calc(100vw - 32px), 440px)', border: `1px solid ${D.border}`, boxShadow: `0 24px 64px rgba(0,0,0,0.5)` }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${D.accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Boxes size={18} color={D.accent} />
                </div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: D.text }}>{gModal === 'add' ? 'Add' : 'Edit'} Product Group</h3>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setGModal(null)}><X size={16} color={D.muted} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Group Name" required>
                <input className="input" value={gForm.name} onChange={(e) => setGForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Beverages" style={{ background: D.bg, border: `1px solid ${D.border}`, color: D.text }} autoFocus />
              </Field>
              <Field label="Malayalam Name">
                <input className="input" value={gForm.nameMl} onChange={(e) => setGForm(p => ({ ...p, nameMl: e.target.value }))} placeholder="ഗ്രൂപ്പ് (optional)" lang="ml" style={{ background: D.bg, border: `1px solid ${D.border}`, color: D.text }} />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button className="btn btn-outline" onClick={() => setGModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveGroup} disabled={gSaving || !gForm.name.trim()} style={{ background: `linear-gradient(135deg, ${D.accent}, ${D.accentH})`, border: 'none', color: '#fff', boxShadow: `0 4px 14px ${D.accentGlow}` }}>
                {gSaving ? <Spinner size={16} /> : (gModal === 'add' ? 'Add Group' : 'Save Changes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unit Modal */}
      {uModal && (
        <div className="fixed inset-0 bg-black/70 z-60 flex items-center justify-center p-4" onClick={() => setUModal(null)}>
          <div style={{ background: D.surface, borderRadius: 20, padding: 32, width: 'min(calc(100vw - 32px), 440px)', border: `1px solid ${D.border}`, boxShadow: `0 24px 64px rgba(0,0,0,0.5)` }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Ruler size={18} color={D.green} />
                </div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: D.text }}>{uModal === 'add' ? 'Add' : 'Edit'} Unit</h3>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setUModal(null)}><X size={16} color={D.muted} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Unit Name" required>
                <input className="input" value={uForm.name} onChange={(e) => setUForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Kilogram" style={{ background: D.bg, border: `1px solid ${D.border}`, color: D.text }} autoFocus />
              </Field>
              <Field label="Abbreviation">
                <input className="input" value={uForm.abbreviation} onChange={(e) => setUForm(p => ({ ...p, abbreviation: e.target.value }))} placeholder="e.g. kg" style={{ background: D.bg, border: `1px solid ${D.border}`, color: D.text }} />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button className="btn btn-outline" onClick={() => setUModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveUnit} disabled={uSaving || !uForm.name.trim()} style={{ background: `linear-gradient(135deg, ${D.green}, ${D.green}dd)`, border: 'none', color: '#fff', boxShadow: `0 4px 14px rgba(34,197,94,0.25)` }}>
                {uSaving ? <Spinner size={16} /> : (uModal === 'add' ? 'Add Unit' : 'Save Changes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {gConfirm && <ConfirmModal title="Delete Group" message="This will delete the product group." danger loading={gDeleting} onConfirm={deleteGroup} onCancel={() => setGConfirm(null)} />}
      {uConfirm && <ConfirmModal title="Delete Unit" message="This will delete the measurement unit." danger loading={uDeleting} onConfirm={deleteUnit} onCancel={() => setUConfirm(null)} />}
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// AdminProducts page
// ═══════════════════════════════════════════════════════════
export function AdminProducts() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [groups, setGroups] = useState<ProductGroupDto[]>([]);
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [priorities, setPriorities] = useState<UnitPriorityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editModal, setEditModal] = useState<ProductDto | null>(null);
  const [priceModal, setPriceModal] = useState<ProductDto | null>(null);
  const [historyModal, setHistoryModal] = useState<ProductDto | null>(null);
  const [unitPriceModal, setUnitPriceModal] = useState<ProductDto | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryDto[]>([]);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [priceReason, setPriceReason] = useState('');
  const addCardRef = useRef<HTMLDivElement>(null);

  const emptyForm = { name: '', nameMl: '', productGroupId: '', unitId: '', basePrice: '', itemCode: '' };
  const [addForm, setAddForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);

  async function loadAll() {
    setLoading(true);
    try {
      const [p, g, u, pri] = await Promise.all([
        productsApi.getAll(groupFilter ? { productGroupId: groupFilter } : undefined),
        productGroupsApi.getAll(),
        unitsApi.getAll(),
        unitsApi.getPriorities().catch(() => [] as UnitPriorityDto[]),
      ]);
      setProducts(p);
      setGroups(g);
      setUnits(u);
      setPriorities(pri);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally { setLoading(false); }
  }

  useEffect(() => { loadAll(); }, [groupFilter]);

  useEffect(() => {
    if (showAdd) {
      setAddForm({ ...emptyForm, productGroupId: groups[0]?.id ?? '' });
      setTimeout(() => addCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    }
  }, [showAdd]);

  function openEdit(p: ProductDto) {
    setEditForm({
      name: p.nameEnglish, nameMl: p.nameMalayalam ?? '',
      productGroupId: p.productGroupId, unitId: p.productUnitId ?? '',
      basePrice: p.basePrice.toString(), itemCode: p.itemCode ?? '',
    });
    setEditModal(p);
  }

  function openPrice(p: ProductDto) {
    setNewPrice(p.basePrice.toString());
    setPriceReason('');
    setPriceModal(p);
  }

  async function openHistory(p: ProductDto) {
    setHistoryModal(p);
    try { setPriceHistory(await productsApi.getPriceHistory(p.id, 20)); }
    catch { setPriceHistory([]); }
  }

  async function handleAdd() {
    if (!addForm.name.trim() || !addForm.productGroupId || !addForm.itemCode.trim()) {
      setError('Fill all required fields (Item Code is mandatory).');
      return;
    }
    const parsedPrice = parsePriceFromItemCode(addForm.itemCode);
    if (parsedPrice === null) {
      setError('Item Code must include a price after a dash, e.g. "1000-90".');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await productsApi.create({
        nameEnglish: addForm.name,
        nameMalayalam: addForm.nameMl || undefined,
        productGroupId: addForm.productGroupId,
        productUnitId: addForm.unitId || undefined,
        basePrice: parsedPrice,
        itemCode: addForm.itemCode,
      });
      setShowAdd(false);
      setAddForm(emptyForm);
      loadAll();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  async function handleEdit() {
    if (!editForm.name.trim() || !editForm.productGroupId || !editForm.itemCode.trim() || !editModal) {
      setError('Fill all required fields (Item Code is mandatory).');
      return;
    }
    const parsedPrice = parsePriceFromItemCode(editForm.itemCode) ?? parseFloat(editForm.basePrice);
    setSaving(true);
    setError('');
    try {
      await productsApi.update(editModal.id, {
        id: editModal.id,
        isActive: editModal.isActive,
        nameEnglish: editForm.name,
        nameMalayalam: editForm.nameMl || undefined,
        productGroupId: editForm.productGroupId,
        productUnitId: editForm.unitId || undefined,
        basePrice: parsedPrice,
        itemCode: editForm.itemCode,
      });
      setEditModal(null);
      loadAll();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  async function handleUpdatePrice() {
    if (!priceModal || !newPrice) return;
    setSaving(true);
    try {
      await productsApi.updateBasePrice(priceModal.id, parseFloat(newPrice), priceReason || undefined);
      setPriceModal(null);
      loadAll();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Price update failed'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm) return;
    setDeleting(true);
    try { await productsApi.delete(confirm); setConfirm(null); loadAll(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Delete failed'); }
    finally { setDeleting(false); }
  }

  const filtered = products.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (p.nameEnglish || '').toLowerCase().includes(q)
      || (p.nameMalayalam || '').toLowerCase().includes(q)
      || (p.productGroupName || '').toLowerCase().includes(q)
      || (p.itemCode || '').toLowerCase().includes(q);
  });

  if (loading) return <PageLoader />;

  return (
    <div style={{ minHeight: '100vh', background: D.bg, padding: '20px 16px 100px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* ── Back Button ────────────────────────────────────────────────────── */}
        <button
          onClick={() => navigate('/admin/dashboard')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 9,
            background: D.surface,
            border: `1px solid ${D.border}`,
            color: D.muted,
            fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all 0.15s',
            marginBottom: 16,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = D.accent; (e.currentTarget as HTMLElement).style.color = D.text; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = D.border; (e.currentTarget as HTMLElement).style.color = D.muted; }}
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: D.text, letterSpacing: '-0.03em' }}>Products</h1>
            <p style={{ color: D.muted, fontSize: 13, marginTop: 3, fontWeight: 500 }}>
              {filtered.length} item{filtered.length !== 1 ? 's' : ''} registered
            </p>
          </div>
          
          {/* Settings Button */}
          <button
            onClick={() => setShowSettings(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 14px', borderRadius: 9,
              background: D.surface,
              border: `1px solid ${D.border}`,
              color: D.muted,
              fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = D.accent; (e.currentTarget as HTMLElement).style.color = D.accent; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = D.border; (e.currentTarget as HTMLElement).style.color = D.muted; }}
          >
            <Settings size={16} /> Catalog Config
          </button>
          
          <button 
            onClick={loadAll} 
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 14px', borderRadius: 9,
              background: D.surface, border: `1px solid ${D.border}`,
              color: D.muted, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = D.accent}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = D.border}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          
          <button
            onClick={() => setShowAdd(v => !v)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '9px 20px', borderRadius: 10, fontSize: 14, fontWeight: 800,
              color: showAdd ? D.muted : '#fff',
              border: showAdd ? `1px solid ${D.border}` : 'none',
              background: showAdd ? 'transparent' : `linear-gradient(135deg, ${D.accent}, ${D.accentH})`,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: showAdd ? 'none' : `0 4px 14px ${D.accentGlow}`,
              transition: 'all 0.15s',
            }}
          >
            {showAdd ? <><X size={15} /> Cancel</> : <><Plus size={15} /> Add Product</>}
          </button>
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        {/* Filters */}
        <div style={{
          background: D.surface, borderRadius: 12,
          border: `1px solid ${D.border}`,
          padding: '12px 16px',
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: D.sub, pointerEvents: 'none' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search product name, group..."
                style={{
                  width: '100%', padding: '9px 12px 9px 38px',
                  background: D.bg, border: `1px solid ${D.border}`,
                  borderRadius: 8, fontSize: 13, color: D.text,
                  outline: 'none', fontFamily: 'inherit',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => { e.target.style.borderColor = D.accent; e.target.style.boxShadow = `0 0 0 3px ${D.accentGlow}`; }}
                onBlur={e => { e.target.style.borderColor = D.border; e.target.style.boxShadow = 'none'; }}
              />
            </div>
            <select
              value={groupFilter}
              onChange={e => setGroupFilter(e.target.value)}
              style={{
                padding: '9px 14px',
                background: D.bg, border: `1px solid ${D.border}`,
                borderRadius: 8, fontSize: 13, color: D.text,
                outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
                minWidth: 140,
              }}
              onFocus={e => { e.target.style.borderColor = D.accent; e.target.style.boxShadow = `0 0 0 3px ${D.accentGlow}`; }}
              onBlur={e => { e.target.style.borderColor = D.border; e.target.style.boxShadow = 'none'; }}
            >
              <option value="">All Groups</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>

        {/* Inline Add card */}
        {showAdd && (
          <div ref={addCardRef} style={{
            background: D.surface,
            border: `1px solid ${D.accent}`,
            borderRadius: 16, padding: '24px 24px 20px',
            boxShadow: `0 4px 24px ${D.accentGlow}`,
            marginBottom: 24, animation: 'slide-up 0.22s cubic-bezier(0.34,1.2,0.64,1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: D.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={16} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: D.text, letterSpacing: '-0.02em' }}>New Product</div>
                <div style={{ fontSize: 12, color: D.sub }}>Fill in the details to register a product</div>
              </div>
            </div>
            <ProductFormFields form={addForm} setForm={setAddForm} groups={groups} units={units} autoFocus />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, borderTop: `1px solid ${D.border}`, paddingTop: 18 }}>
              <button onClick={() => { setShowAdd(false); setError(''); }} style={{ padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 700, color: D.sub, border: `1px solid ${D.border}`, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={handleAdd} disabled={saving || !addForm.name.trim() || !addForm.productGroupId || !addForm.itemCode.trim()}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '10px 24px', borderRadius: 10, fontSize: 14, fontWeight: 800,
                  color: '#fff', border: 'none',
                  background: `linear-gradient(135deg, ${D.accent}, ${D.accentH})`,
                  cursor: saving || !addForm.name.trim() || !addForm.productGroupId || !addForm.itemCode.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', boxShadow: `0 4px 14px ${D.accentGlow}`,
                }}
              >
                {saving ? <Spinner size={15} /> : <><Save size={15} /> Save Product</>}
              </button>
            </div>
          </div>
        )}

        {/* Product grid */}
        {filtered.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            background: D.surface, borderRadius: 14,
            border: `1px solid ${D.border}`,
          }}>
            <Package size={48} color={D.border} style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 16, fontWeight: 800, color: D.text, marginBottom: 6 }}>
              {products.length === 0 ? 'No products yet' : 'No products match your filters'}
            </div>
            <div style={{ fontSize: 13, color: D.sub }}>
              {products.length === 0 ? 'Click "+ Add Product" to register your first item.' : 'Try clearing your filters.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {filtered.map(p => (
              <ProductCard
                key={p.id}
                product={p}
                onEdit={() => openEdit(p)}
                onPrice={() => openPrice(p)}
                onHistory={() => openHistory(p)}
                onDelete={() => setConfirm(p.id)}
                onUnitPrices={() => setUnitPriceModal(p)}
              />
            ))}
          </div>
        )}

        {/* ── Settings Modal ──────────────────────────────────────── */}
        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          groups={groups}
          units={units}
          priorities={priorities}
          onGroupUpdate={loadAll}
          onUnitUpdate={loadAll}
          onPriorityUpdate={loadAll}
        />

        {/* ── Unit Price Manager Modal ──────────────────────────────────────── */}
        {unitPriceModal && (
          <ProductUnitPriceManager
            product={unitPriceModal}
            onClose={() => setUnitPriceModal(null)}
            onUpdate={loadAll}
          />
        )}

        {/* ── Edit slide panel ─────────────────────────────────── */}
        {editModal && (
          <>
            <div onClick={() => setEditModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.60)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
            <div style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 460,
              background: D.surface, zIndex: 210,
              display: 'flex', flexDirection: 'column',
              boxShadow: '-8px 0 40px rgba(0,0,0,0.4)',
              animation: 'slide-in-right 0.26s cubic-bezier(0.34,1.2,0.64,1)',
              borderLeft: `1px solid ${D.border}`,
            }}>
              <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <ProductTile name={editModal.nameEnglish} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: D.text, letterSpacing: '-0.02em' }}>Edit Product</div>
                  <div style={{ fontSize: 13, color: D.sub }}>{editModal.nameEnglish}</div>
                </div>
                <button onClick={() => setEditModal(null)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${D.border}`, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: D.sub }}>
                  <X size={15} />
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                {error && <Alert variant="error">{error}</Alert>}
                <ProductFormFields form={editForm} setForm={setEditForm} groups={groups} units={units} />
              </div>
              <div style={{ padding: '16px 24px', borderTop: `1px solid ${D.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
                <button onClick={() => setEditModal(null)} style={{ padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, color: D.sub, border: `1px solid ${D.border}`, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={handleEdit} disabled={saving}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 800,
                    color: '#fff', border: 'none',
                    background: `linear-gradient(135deg, ${D.accent}, ${D.accentH})`,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', boxShadow: `0 4px 14px ${D.accentGlow}`,
                  }}
                >
                  {saving ? <Spinner size={15} /> : <><Save size={14} /> Save Changes</>}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Price update modal ───────────────────────────────── */}
        {priceModal && (
          <>
            <div onClick={() => setPriceModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.60)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
            <div style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              width: '90%', maxWidth: 420, background: D.surface, borderRadius: 20, zIndex: 210,
              border: `1px solid ${D.border}`, boxShadow: `0 20px 60px rgba(0,0,0,0.5)`,
              overflow: 'hidden',
            }}>
              <div style={{ background: `linear-gradient(135deg, ${D.accent}, ${D.accentH})`, padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>Update Base Price</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.70)', marginTop: 2 }}>{priceModal.nameEnglish}</div>
                  </div>
                  <button onClick={() => setPriceModal(null)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.20)', background: 'rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                    <X size={14} />
                  </button>
                </div>
                <div style={{ marginTop: 12, fontSize: 13, color: 'rgba(255,255,255,0.80)' }}>
                  Current: <strong style={{ color: '#fff' }}>₹{fmt(priceModal.basePrice)}</strong>
                </div>
              </div>
              <div style={{ padding: '20px 24px' }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: D.muted, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '0.02em' }}>New Price (₹) *</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: D.accent, fontSize: 16 }}>₹</span>
                    <input type="number" step="0.01" min="0" value={newPrice} onChange={e => setNewPrice(e.target.value)}
                      style={{ ...inp, paddingLeft: 32, fontSize: 18, fontWeight: 800, color: D.accent }} onFocus={onFoc} onBlur={onBlr} autoFocus />
                  </div>
                  {newPrice && priceModal.basePrice && (
                    <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, color: parseFloat(newPrice) > priceModal.basePrice ? D.green : D.red }}>
                      {parseFloat(newPrice) > priceModal.basePrice ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {parseFloat(newPrice) > priceModal.basePrice ? '+' : ''}{(((parseFloat(newPrice) - priceModal.basePrice) / priceModal.basePrice) * 100).toFixed(1)}% change
                    </div>
                  )}
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: D.muted, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '0.02em' }}>Reason</label>
                  <input value={priceReason} onChange={e => setPriceReason(e.target.value)} placeholder="Price revision, supplier update..." style={inp} onFocus={onFoc} onBlur={onBlr} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setPriceModal(null)} style={{ flex: 1, padding: '12px', borderRadius: 10, fontSize: 14, fontWeight: 700, color: D.sub, border: `1px solid ${D.border}`, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                  <button onClick={handleUpdatePrice} disabled={saving || !newPrice}
                    style={{
                      flex: 2, padding: '12px', borderRadius: 10, fontSize: 14, fontWeight: 800,
                      color: '#fff', border: 'none',
                      background: saving || !newPrice ? D.border : `linear-gradient(135deg, ${D.accent}, ${D.accentH})`,
                      cursor: saving || !newPrice ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      boxShadow: saving || !newPrice ? 'none' : `0 4px 14px ${D.accentGlow}`,
                    }}
                  >
                    {saving ? <Spinner size={15} /> : <><IndianRupee size={14} /> Update Price</>}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Price history modal ──────────────────────────────── */}
        {historyModal && (
          <>
            <div onClick={() => setHistoryModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.60)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
            <div style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              width: '90%', maxWidth: 520, background: D.surface, borderRadius: 20, zIndex: 210,
              border: `1px solid ${D.border}`, boxShadow: `0 20px 60px rgba(0,0,0,0.5)`,
              maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}>
              <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: D.text, letterSpacing: '-0.02em' }}>Price History</div>
                  <div style={{ fontSize: 13, color: D.sub }}>{historyModal.nameEnglish}</div>
                </div>
                <button onClick={() => setHistoryModal(null)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${D.border}`, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: D.sub }}>
                  <X size={15} />
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                {priceHistory.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: D.sub }}>
                    <History size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                    <div style={{ fontWeight: 700 }}>No price history yet</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {priceHistory.map((h, i) => (
                      <div key={h.id} style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '12px 16px', borderRadius: 10,
                        background: i === 0 ? `${D.accent}15` : D.bg,
                        border: `1px solid ${i === 0 ? D.accent : D.border}`,
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: D.sub, fontWeight: 600 }}>{fmtDate(h.effectiveDate)}</div>
                          {h.reason && <div style={{ fontSize: 12, color: D.sub, marginTop: 2 }}>{h.reason}</div>}
                        </div>
                        <div style={{ textAlign: 'right' as const }}>
                          {h.previousPrice != null && (
                            <div style={{ fontSize: 11, color: D.sub, textDecoration: 'line-through' }}>₹{fmt(h.previousPrice)}</div>
                          )}
                          <div style={{ fontSize: 15, fontWeight: 900, color: i === 0 ? D.accent : D.text }}>₹{fmt(h.price)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ padding: '14px 24px', borderTop: `1px solid ${D.border}`, flexShrink: 0 }}>
                <button onClick={() => setHistoryModal(null)} style={{ width: '100%', padding: '11px', borderRadius: 10, fontSize: 14, fontWeight: 700, color: D.sub, border: `1px solid ${D.border}`, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
              </div>
            </div>
          </>
        )}

        {confirm && (
          <ConfirmModal
            title="Delete Product"
            message="This will permanently delete the product. This cannot be undone."
            danger loading={deleting}
            onConfirm={handleDelete}
            onCancel={() => setConfirm(null)}
          />
        )}
      </div>
    </div>
  );
}