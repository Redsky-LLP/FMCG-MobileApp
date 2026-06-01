// PATH: src/pages/Admin/AdminProducts.tsx
// Kyte-style redesign:
//  • Product cards in a responsive grid (icon, name, group, price badge, unit)
//  • Inline slide-down Add Product form (Kyte "+ Product" pattern)
//  • Edit in right slide-out panel
//  • Price update and history in focused modals
//  • NEW: Unit Price Manager button for per-unit pricing

import React, { useEffect, useState, useRef } from 'react';
import {
  Plus, Edit2, Trash2, Package, Search, RefreshCw,
  IndianRupee, History, X, Save, TrendingUp, TrendingDown, DollarSign,
} from 'lucide-react';
import { productsApi, productGroupsApi, unitsApi } from '../../api/services';
import type { ProductDto, ProductGroupDto, UnitDto, PriceHistoryDto } from '../../types';
import { fmt, fmtDate } from '../../types';
import { PageLoader, Spinner, Alert, ConfirmModal } from '../../components/ui';
import { ProductUnitPriceManager } from '../../components/admin/ProductUnitPriceManager';

// ── Product icon tile ────────────────────────────────────────
function ProductTile({ name }: { name: string }) {
  const colors = ['#2563EB', '#1E3A8A', '#7C3AED', '#0891B2', '#D97706', '#16A34A'];
  const color  = colors[name.charCodeAt(0) % colors.length];
  return (
    <div style={{
      width: 52, height: 52, borderRadius: 14, flexShrink: 0,
      background: `${color}12`, border: `1px solid ${color}22`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Package size={24} color={color} strokeWidth={1.8} />
    </div>
  );
}

// ── Reusable input helpers ───────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  background: '#F8FAFC', border: '1px solid #E2E8F0',
  borderRadius: 10, fontSize: 14, color: '#334155',
  outline: 'none', fontFamily: 'inherit',
  boxSizing: 'border-box', transition: 'all 0.15s',
};
function onFoc(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = '#2563EB';
  e.target.style.boxShadow   = '0 0 0 3px rgba(37,99,235,0.10)';
  (e.target as HTMLElement).style.background = '#fff';
}
function onBlr(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = '#E2E8F0';
  e.target.style.boxShadow   = 'none';
  (e.target as HTMLElement).style.background = '#F8FAFC';
}

// ── Product Card ─────────────────────────────────────────────
function ProductCard({
  product, onEdit, onPrice, onHistory, onDelete, onUnitPrices,
}: {
  product:      ProductDto;
  onEdit:       () => void;
  onPrice:      () => void;
  onHistory:    () => void;
  onDelete:     () => void;
  onUnitPrices: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${hovered ? 'rgba(37,99,235,0.25)' : '#E2E8F0'}`,
        borderRadius: 14, padding: '18px 18px 14px',
        transition: 'all 0.18s',
        boxShadow: hovered ? '0 4px 20px rgba(37,99,235,0.08)' : '0 1px 3px rgba(15,23,42,0.05)',
        position: 'relative' as const,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Status dot */}
      <div style={{ position: 'absolute', top: 14, right: 14, width: 8, height: 8, borderRadius: '50%', background: product.isActive ? '#16A34A' : '#94A3B8' }} title={product.isActive ? 'Active' : 'Inactive'} />

      {/* Icon + name */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
        <ProductTile name={product.nameEnglish} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 2 }}>
            {product.nameEnglish}
          </div>
          {product.nameMalayalam && (
            <div style={{ fontSize: 12, color: '#64748B', fontFamily: "'Manjari', sans-serif" }}>
              {product.nameMalayalam}
            </div>
          )}
          <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
            {product.productGroupName && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', background: '#EFF6FF', border: '1px solid rgba(37,99,235,0.15)', padding: '2px 8px', borderRadius: 6 }}>
                {product.productGroupName}
              </span>
            )}
            {product.productUnitName && (
              <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', background: '#F1F5F9', border: '1px solid #E2E8F0', padding: '2px 8px', borderRadius: 6 }}>
                {product.productUnitName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Price prominent display */}
      <div style={{ padding: '12px 14px', borderRadius: 10, background: '#EFF6FF', border: '1px solid rgba(37,99,235,0.15)', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>Base Price</span>
        <span style={{ fontSize: 20, fontWeight: 900, color: '#1E3A8A', letterSpacing: '-0.03em' }}>
          ₹{fmt(product.basePrice)}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, borderTop: '1px solid #F1F5F9', paddingTop: 12, flexWrap: 'wrap' as const }}>
        <button onClick={onUnitPrices} title="Unit Prices"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px', borderRadius: 8, border: '1px solid rgba(37,99,235,0.20)', background: '#EFF6FF', fontSize: 12, fontWeight: 700, color: '#2563EB', cursor: 'pointer', transition: 'all 0.13s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#DBEAFE'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#EFF6FF'; }}
        >
          <DollarSign size={12} /> Unit Prices
        </button>
        <button onClick={onPrice} title="Update price"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px', borderRadius: 8, border: '1px solid rgba(37,99,235,0.20)', background: '#EFF6FF', fontSize: 12, fontWeight: 700, color: '#2563EB', cursor: 'pointer', transition: 'all 0.13s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#DBEAFE'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#EFF6FF'; }}
        >
          <IndianRupee size={12} /> Price
        </button>
        <button onClick={onHistory} title="Price history"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: 12, fontWeight: 700, color: '#64748B', cursor: 'pointer', transition: 'all 0.13s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F1F5F9'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#F8FAFC'; }}
        >
          <History size={12} /> History
        </button>
        <button onClick={onEdit} title="Edit"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: 12, fontWeight: 700, color: '#334155', cursor: 'pointer', transition: 'all 0.13s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(37,99,235,0.25)'; (e.currentTarget as HTMLElement).style.color = '#2563EB'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E2E8F0'; (e.currentTarget as HTMLElement).style.color = '#334155'; }}
        >
          <Edit2 size={12} /> Edit
        </button>
        <button onClick={onDelete} title="Delete"
          style={{ width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#94A3B8', cursor: 'pointer', transition: 'all 0.13s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FEF2F2'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(220,38,38,0.25)'; (e.currentTarget as HTMLElement).style.color = '#DC2626'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#F8FAFC'; (e.currentTarget as HTMLElement).style.borderColor = '#E2E8F0'; (e.currentTarget as HTMLElement).style.color = '#94A3B8'; }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Form fields shared between Add and Edit ──────────────────
function ProductFormFields({
  form, setForm, groups, units, autoFocus,
}: {
  form:      { name: string; nameMl: string; productGroupId: string; unitId: string; basePrice: string };
  setForm:   React.Dispatch<React.SetStateAction<any>>;
  groups:    ProductGroupDto[];
  units:     UnitDto[];
  autoFocus?: boolean;
}) {
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 700, color: '#334155',
    marginBottom: 6, letterSpacing: '0.02em', textTransform: 'uppercase' as const,
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={lbl}>Product Name <span style={{ color: '#DC2626' }}>*</span></label>
        <input value={form.name} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))}
          placeholder="Name in English" style={inp} onFocus={onFoc} onBlur={onBlr} autoFocus={autoFocus} />
      </div>
      <div>
        <label style={lbl}>Malayalam Name <span style={{ fontSize: 10, color: '#94A3B8' }}>(optional)</span></label>
        <input value={form.nameMl} onChange={e => setForm((p: any) => ({ ...p, nameMl: e.target.value }))}
          placeholder="മലയാളം" lang="ml" style={inp} onFocus={onFoc} onBlur={onBlr} />
      </div>

      {/* Price - prominent */}
      <div style={{ padding: '16px', borderRadius: 12, background: '#EFF6FF', border: '1px solid rgba(37,99,235,0.18)' }}>
        <label style={{ ...lbl, color: '#1E3A8A' }}>Base Price (₹) <span style={{ color: '#DC2626' }}>*</span></label>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: '#1E3A8A', fontSize: 16 }}>₹</span>
          <input type="number" step="0.01" min="0" value={form.basePrice}
            onChange={e => setForm((p: any) => ({ ...p, basePrice: e.target.value }))}
            placeholder="0.00" style={{ ...inp, paddingLeft: 32, fontSize: 18, fontWeight: 800, color: '#1E3A8A', background: '#fff', border: '1px solid rgba(37,99,235,0.20)' }}
            onFocus={onFoc} onBlur={onBlr} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={lbl}>Product Group <span style={{ color: '#DC2626' }}>*</span></label>
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

// ═══════════════════════════════════════════════════════════
// AdminProducts page
// ═══════════════════════════════════════════════════════════
export function AdminProducts() {
  const [products,       setProducts]       = useState<ProductDto[]>([]);
  const [groups,         setGroups]         = useState<ProductGroupDto[]>([]);
  const [units,          setUnits]          = useState<UnitDto[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');
  const [search,         setSearch]         = useState('');
  const [groupFilter,    setGroupFilter]    = useState('');
  const [showAdd,        setShowAdd]        = useState(false);
  const [editModal,      setEditModal]      = useState<ProductDto | null>(null);
  const [priceModal,     setPriceModal]     = useState<ProductDto | null>(null);
  const [historyModal,   setHistoryModal]   = useState<ProductDto | null>(null);
  const [unitPriceModal, setUnitPriceModal] = useState<ProductDto | null>(null);
  const [priceHistory,   setPriceHistory]   = useState<PriceHistoryDto[]>([]);
  const [confirm,        setConfirm]        = useState<string | null>(null);
  const [saving,         setSaving]         = useState(false);
  const [deleting,       setDeleting]       = useState(false);
  const [newPrice,       setNewPrice]       = useState('');
  const [priceReason,    setPriceReason]    = useState('');
  const addCardRef = useRef<HTMLDivElement>(null);

  const emptyForm = { name: '', nameMl: '', productGroupId: '', unitId: '', basePrice: '' };
  const [addForm,  setAddForm]  = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);

  async function load() {
    setLoading(true); setError('');
    try {
      const [p, g, u] = await Promise.all([
        productsApi.getAll(groupFilter ? { productGroupId: groupFilter } : undefined),
        productGroupsApi.getAll(),
        unitsApi.getAll(),
      ]);
      setProducts(p); setGroups(g); setUnits(u);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [groupFilter]);

  useEffect(() => {
    if (showAdd) {
      setAddForm({ ...emptyForm, productGroupId: groups[0]?.id ?? '' });
      setTimeout(() => addCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    }
  }, [showAdd]);

  function openEdit(p: ProductDto) {
    setEditForm({ name: p.nameEnglish, nameMl: p.nameMalayalam ?? '', productGroupId: p.productGroupId, unitId: p.productUnitId ?? '', basePrice: p.basePrice.toString() });
    setEditModal(p);
  }

  function openPrice(p: ProductDto) {
    setNewPrice(p.basePrice.toString()); setPriceReason(''); setPriceModal(p);
  }

  async function openHistory(p: ProductDto) {
    setHistoryModal(p);
    try { setPriceHistory(await productsApi.getPriceHistory(p.id, 20)); }
    catch { setPriceHistory([]); }
  }

  async function handleAdd() {
    if (!addForm.name.trim() || !addForm.productGroupId || !addForm.basePrice) { setError('Fill all required fields'); return; }
    setSaving(true); setError('');
    try {
      await productsApi.create({
        nameEnglish: addForm.name, nameMalayalam: addForm.nameMl || undefined,
        productGroupId: addForm.productGroupId, productUnitId: addForm.unitId || undefined,
        basePrice: parseFloat(addForm.basePrice),
      });
      setShowAdd(false); setAddForm(emptyForm); load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  async function handleEdit() {
    if (!editForm.name.trim() || !editForm.productGroupId || !editForm.basePrice || !editModal) return;
    setSaving(true); setError('');
    try {
      await productsApi.update(editModal.id, {
        id: editModal.id, isActive: editModal.isActive,
        nameEnglish: editForm.name, nameMalayalam: editForm.nameMl || undefined,
        productGroupId: editForm.productGroupId, productUnitId: editForm.unitId || undefined,
        basePrice: parseFloat(editForm.basePrice),
      });
      setEditModal(null); load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  async function handleUpdatePrice() {
    if (!priceModal || !newPrice) return;
    setSaving(true);
    try {
      await productsApi.updateBasePrice(priceModal.id, parseFloat(newPrice), priceReason || undefined);
      setPriceModal(null); load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Price update failed'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm) return;
    setDeleting(true);
    try { await productsApi.delete(confirm); setConfirm(null); load(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Delete failed'); }
    finally { setDeleting(false); }
  }

  const filtered = products.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (p.nameEnglish || '').toLowerCase().includes(q)
      || (p.nameMalayalam || '').toLowerCase().includes(q)
      || (p.productGroupName || '').toLowerCase().includes(q);
  });

  if (loading) return <PageLoader />;

  return (
    <div className="page-content">

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' as const }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--navy)', letterSpacing: '-0.03em' }}>Products</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 3 }}>{filtered.length} item{filtered.length !== 1 ? 's' : ''} registered</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load}><RefreshCw size={14} /></button>
        <button
          onClick={() => setShowAdd(v => !v)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 10, fontSize: 14, fontWeight: 800, color: showAdd ? '#64748B' : '#fff', border: showAdd ? '1px solid #E2E8F0' : 'none', background: showAdd ? 'transparent' : 'linear-gradient(135deg,#1E3A8A,#2563EB)', cursor: 'pointer', fontFamily: 'inherit', boxShadow: showAdd ? 'none' : '0 3px 10px rgba(37,99,235,0.28)', transition: 'all 0.15s' }}
        >
          {showAdd ? <><X size={15} /> Cancel</> : <><Plus size={15} /> Add Product</>}
        </button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' as const }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product name, group..."
            style={{ ...inp, paddingLeft: 38, background: '#fff', border: '1px solid #E2E8F0' }} onFocus={onFoc} onBlur={onBlr} />
        </div>
        <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} style={{ ...inp, width: 'auto', minWidth: 160, background: '#fff', cursor: 'pointer' }} onFocus={onFoc} onBlur={onBlr}>
          <option value="">All Groups</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      {/* Inline Add card */}
      {showAdd && (
        <div ref={addCardRef} style={{ background: '#fff', border: '1.5px solid rgba(37,99,235,0.25)', borderRadius: 16, padding: '24px 24px 20px', boxShadow: '0 4px 24px rgba(37,99,235,0.10)', marginBottom: 24, animation: 'slide-up 0.22s cubic-bezier(0.34,1.2,0.64,1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#1E3A8A,#2563EB)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#1E3A8A', letterSpacing: '-0.02em' }}>New Product</div>
              <div style={{ fontSize: 12, color: '#64748B' }}>Fill in the details to register a product</div>
            </div>
          </div>
          <ProductFormFields form={addForm} setForm={setAddForm} groups={groups} units={units} autoFocus />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, borderTop: '1px solid #F1F5F9', paddingTop: 18 }}>
            <button onClick={() => { setShowAdd(false); setError(''); }} style={{ padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 700, color: '#64748B', border: '1px solid #E2E8F0', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={handleAdd} disabled={saving || !addForm.name.trim() || !addForm.productGroupId || !addForm.basePrice}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 24px', borderRadius: 10, fontSize: 14, fontWeight: 800, color: '#fff', border: 'none', background: 'linear-gradient(135deg,#1E3A8A,#2563EB)', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: '0 3px 10px rgba(37,99,235,0.25)' }}
            >
              {saving ? <Spinner size={15} /> : <><Save size={15} /> Save Product</>}
            </button>
          </div>
        </div>
      )}

      {/* Product grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#94A3B8' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Package size={28} style={{ opacity: 0.5 }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#334155', marginBottom: 6 }}>
            {products.length === 0 ? 'No products yet' : 'No products match your filters'}
          </div>
          <div style={{ fontSize: 13 }}>
            {products.length === 0 ? 'Click "+ Add Product" to register your first item.' : 'Try clearing your filters.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filtered.map(p => (
            <ProductCard key={p.id} product={p}
              onEdit={() => openEdit(p)}
              onPrice={() => openPrice(p)}
              onHistory={() => openHistory(p)}
              onDelete={() => setConfirm(p.id)}
              onUnitPrices={() => setUnitPriceModal(p)}
            />
          ))}
        </div>
      )}

      {/* ── Unit Price Manager Modal ──────────────────────────────────────── */}
      {unitPriceModal && (
        <ProductUnitPriceManager
          product={unitPriceModal}
          onClose={() => setUnitPriceModal(null)}
          onUpdate={load}
        />
      )}

      {/* ── Edit slide panel ─────────────────────────────────── */}
      {editModal && (
        <>
          <div onClick={() => setEditModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.40)', zIndex: 200, backdropFilter: 'blur(2px)' }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 460, background: '#fff', zIndex: 210, display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 40px rgba(15,23,42,0.14)', animation: 'slide-in-right 0.26s cubic-bezier(0.34,1.2,0.64,1)' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <ProductTile name={editModal.nameEnglish} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1E3A8A' }}>Edit Product</div>
                <div style={{ fontSize: 13, color: '#64748B' }}>{editModal.nameEnglish}</div>
              </div>
              <button onClick={() => setEditModal(null)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E2E8F0', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}>
                <X size={15} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {error && <Alert variant="error">{error}</Alert>}
              <ProductFormFields form={editForm} setForm={setEditForm} groups={groups} units={units} />
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
              <button onClick={() => setEditModal(null)} style={{ padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, color: '#64748B', border: '1px solid #E2E8F0', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={handleEdit} disabled={saving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 800, color: '#fff', border: 'none', background: 'linear-gradient(135deg,#1E3A8A,#2563EB)', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: '0 3px 10px rgba(37,99,235,0.25)' }}
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
          <div onClick={() => setPriceModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.40)', zIndex: 200, backdropFilter: 'blur(2px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '90%', maxWidth: 420, background: '#fff', borderRadius: 20, zIndex: 210, boxShadow: '0 20px 60px rgba(15,23,42,0.18)', overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(135deg,#1E3A8A,#2563EB)', padding: '20px 24px' }}>
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
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '0.02em' }}>New Price (₹) *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: '#1E3A8A', fontSize: 16 }}>₹</span>
                  <input type="number" step="0.01" min="0" value={newPrice} onChange={e => setNewPrice(e.target.value)}
                    style={{ ...inp, paddingLeft: 32, fontSize: 18, fontWeight: 800, color: '#1E3A8A' }} onFocus={onFoc} onBlur={onBlr} autoFocus />
                </div>
                {newPrice && priceModal.basePrice && (
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, color: parseFloat(newPrice) > priceModal.basePrice ? '#16A34A' : '#DC2626' }}>
                    {parseFloat(newPrice) > priceModal.basePrice ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {parseFloat(newPrice) > priceModal.basePrice ? '+' : ''}{(((parseFloat(newPrice) - priceModal.basePrice) / priceModal.basePrice) * 100).toFixed(1)}% change
                  </div>
                )}
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '0.02em' }}>Reason</label>
                <input value={priceReason} onChange={e => setPriceReason(e.target.value)} placeholder="Price revision, supplier update..." style={inp} onFocus={onFoc} onBlur={onBlr} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setPriceModal(null)} style={{ flex: 1, padding: '12px', borderRadius: 10, fontSize: 14, fontWeight: 700, color: '#64748B', border: '1px solid #E2E8F0', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={handleUpdatePrice} disabled={saving || !newPrice}
                  style={{ flex: 2, padding: '12px', borderRadius: 10, fontSize: 14, fontWeight: 800, color: '#fff', border: 'none', background: saving || !newPrice ? '#93C5FD' : 'linear-gradient(135deg,#1E3A8A,#2563EB)', cursor: saving || !newPrice ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
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
          <div onClick={() => setHistoryModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.40)', zIndex: 200, backdropFilter: 'blur(2px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '90%', maxWidth: 520, background: '#fff', borderRadius: 20, zIndex: 210, boxShadow: '0 20px 60px rgba(15,23,42,0.18)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1E3A8A' }}>Price History</div>
                <div style={{ fontSize: 13, color: '#64748B' }}>{historyModal.nameEnglish}</div>
              </div>
              <button onClick={() => setHistoryModal(null)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E2E8F0', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}>
                <X size={15} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              {priceHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8' }}>
                  <History size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                  <div style={{ fontWeight: 700 }}>No price history yet</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {priceHistory.map((h, i) => (
                    <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 10, background: i === 0 ? '#EFF6FF' : '#F8FAFC', border: `1px solid ${i === 0 ? 'rgba(37,99,235,0.18)' : '#E2E8F0'}` }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>{fmtDate(h.effectiveDate)}</div>
                        {h.reason && <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{h.reason}</div>}
                      </div>
                      <div style={{ textAlign: 'right' as const }}>
                        {h.previousPrice != null && (
                          <div style={{ fontSize: 11, color: '#94A3B8', textDecoration: 'line-through' }}>₹{fmt(h.previousPrice)}</div>
                        )}
                        <div style={{ fontSize: 15, fontWeight: 900, color: i === 0 ? '#1E3A8A' : '#334155' }}>₹{fmt(h.price)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid #E2E8F0', flexShrink: 0 }}>
              <button onClick={() => setHistoryModal(null)} style={{ width: '100%', padding: '11px', borderRadius: 10, fontSize: 14, fontWeight: 700, color: '#64748B', border: '1px solid #E2E8F0', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
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
  );
}