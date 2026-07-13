// PATH: src/pages/Admin/AdminProducts.tsx
// UPDATED: Added Size Group support to product form

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Plus, Edit2, Trash2, Package, Search, RefreshCw,
  IndianRupee, History, X, Save, TrendingUp, TrendingDown, DollarSign,
  Settings, Ruler, Boxes, ChevronRight, ArrowUp, ArrowDown, ArrowLeft,
} from 'lucide-react';
import { productsApi, productGroupsApi, unitsApi, sizeGroupsApi } from '../../api/services';
import type { ProductDto, ProductGroupDto, UnitDto, UnitPriorityDto, PriceHistoryDto, SizeGroupDto } from '../../types';
import { fmt, fmtDate } from '../../types';
import { PageLoader, Spinner, Alert, ConfirmModal, Field } from '../../components/ui';
import { ProductUnitPriceManager } from '../../components/admin/ProductUnitPriceManager';
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

// ── Helper: Generate item code from prefix and price ────────
function generateItemCode(prefix: string, price: number): string {
  const cleanPrefix = prefix.trim();
  // If prefix already has a dash, remove the price part
  const basePrefix = cleanPrefix.includes('-') 
    ? cleanPrefix.substring(0, cleanPrefix.lastIndexOf('-') + 1)
    : cleanPrefix + '-';
  return `${basePrefix}${Math.round(price)}`;
}

// ── Helper: Extract prefix from item code ─────────────────────
function extractItemCodePrefix(code: string): string {
  if (!code || !code.includes('-')) return '1000-';
  const lastDashIndex = code.lastIndexOf('-');
  return code.substring(0, lastDashIndex + 1);
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
            {product.sizeGroupName && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#A78BFA', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.33)', padding: '2px 8px', borderRadius: 6 }}>
                {product.sizeGroupName}
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
  form, setForm, groups, units, sizeGroups, autoFocus, isEdit = false,
}: {
  form: { name: string; nameMl: string; productGroupId: string; unitId: string; basePrice: string; itemCode: string; sizeGroupId: string };
  setForm: React.Dispatch<React.SetStateAction<any>>;
  groups: ProductGroupDto[];
  units: UnitDto[];
  sizeGroups: SizeGroupDto[];
  autoFocus?: boolean;
  isEdit?: boolean;
}) {
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 700, color: D.muted,
    marginBottom: 6, letterSpacing: '0.02em', textTransform: 'uppercase' as const,
  };

  // ── When base price changes, auto-update item code ──
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPrice = e.target.value;
    setForm((p: any) => {
      const updated = { ...p, basePrice: newPrice };
      
      // Auto-generate item code from price
      const priceNum = parseFloat(newPrice);
      if (!isNaN(priceNum) && priceNum >= 0) {
        // Use existing prefix or default
        const prefix = p.itemCode && p.itemCode.includes('-') 
          ? extractItemCodePrefix(p.itemCode) 
          : '1000-';
        updated.itemCode = generateItemCode(prefix, priceNum);
      }
      return updated;
    });
  };

  // ── When item code changes, update base price ──
  const handleItemCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCode = e.target.value;
    setForm((p: any) => {
      const updated = { ...p, itemCode: newCode };
      // Try to parse price from the new item code
      const parsedPrice = parsePriceFromItemCode(newCode);
      if (parsedPrice !== null) {
        updated.basePrice = String(parsedPrice);
      }
      return updated;
    });
  };

  // Get the current price from the form
  const currentPrice = parseFloat(form.basePrice);
  const isValidPrice = !isNaN(currentPrice) && currentPrice >= 0;
  const currentPrefix = form.itemCode && form.itemCode.includes('-') 
    ? extractItemCodePrefix(form.itemCode) 
    : '1000-';
  const autoGeneratedCode = isValidPrice ? generateItemCode(currentPrefix, currentPrice) : '';

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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={lbl}>Item Group <span style={{ color: D.red }}>*</span></label>
          <select value={form.productGroupId} onChange={e => setForm((p: any) => ({ ...p, productGroupId: e.target.value }))}
            style={{ ...inp, cursor: 'pointer' }} onFocus={onFoc} onBlur={onBlr}>
            <option value="">Select group</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Packing Category</label>
          <select value={form.unitId} onChange={e => setForm((p: any) => ({ ...p, unitId: e.target.value }))}
            style={{ ...inp, cursor: 'pointer' }} onFocus={onFoc} onBlur={onBlr}>
            <option value="">None</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </div>

      {/* ── NEW: Size Group field ── */}
      <div>
        <label style={lbl}>Size Group</label>
        <select 
          value={form.sizeGroupId} 
          onChange={e => setForm((p: any) => ({ ...p, sizeGroupId: e.target.value }))}
          style={{ ...inp, cursor: 'pointer' }} 
          onFocus={onFoc} onBlur={onBlr}
        >
          <option value="">Select size group</option>
          {sizeGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      {/* ── Base Price field (FIRST) ── */}
      <div>
        <label style={lbl}>Base Price (₹) <span style={{ color: D.red }}>*</span></label>
        <input 
          type="number" 
          step="0.01" 
          min="0"
          value={form.basePrice} 
          onChange={handlePriceChange}
          placeholder="Enter base price" 
          style={{ ...inp, fontSize: 18, fontWeight: 700, color: D.accent }}
          onFocus={onFoc} onBlur={onBlr} 
        />
        {autoGeneratedCode && (
          <p style={{ margin: '6px 0 0', fontSize: 11, color: D.sub }}>
            Item code will be: <strong style={{ color: D.accent }}>{autoGeneratedCode}</strong>
          </p>
        )}
      </div>

      {/* ── Item Code field (SECOND - auto-generated) ── */}
      <div style={{ padding: '16px', borderRadius: 12, background: `${D.accent}10`, border: `1px solid ${D.accent}33` }}>
        <label style={{ ...lbl, color: D.accent }}>Item Code <span style={{ color: D.red }}>*</span></label>
        <input 
          value={form.itemCode} 
          onChange={handleItemCodeChange}
          placeholder="Auto-generated from price" 
          style={{ ...inp, fontSize: 18, fontWeight: 800, color: D.accent, background: D.surface2, border: `1px solid ${D.accent}33` }}
          onFocus={onFoc} onBlur={onBlr} 
        />
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
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// AdminProducts page
// ═══════════════════════════════════════════════════════════
export function AdminProducts() {
  const { user } = useAuthStore();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [groups, setGroups] = useState<ProductGroupDto[]>([]);
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [priorities, setPriorities] = useState<UnitPriorityDto[]>([]);
  // ── NEW: Size Groups state ──
  const [sizeGroups, setSizeGroups] = useState<SizeGroupDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
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

  // ── Default item code prefix ──
  const DEFAULT_ITEM_CODE_PREFIX = '1000-';

  const emptyForm = { 
    name: '', 
    nameMl: '', 
    productGroupId: '', 
    unitId: '', 
    basePrice: '', 
    itemCode: DEFAULT_ITEM_CODE_PREFIX,
    sizeGroupId: '',  // ── NEW ──
  };
  const [addForm, setAddForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);

  async function loadAll() {
    setLoading(true);
    try {
      const [p, g, u, sg, pri] = await Promise.all([
        productsApi.getAll(groupFilter ? { productGroupId: groupFilter } : undefined),
        productGroupsApi.getAll(),
        unitsApi.getAll(),
        sizeGroupsApi.getAll().catch(() => [] as SizeGroupDto[]),  // ── NEW ──
        unitsApi.getPriorities().catch(() => [] as UnitPriorityDto[]),
      ]);
      setProducts(p);
      setGroups(g);
      setUnits(u);
      setSizeGroups(sg);  // ── NEW ──
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
    const prefix = p.itemCode ? extractItemCodePrefix(p.itemCode) : DEFAULT_ITEM_CODE_PREFIX;
    setEditForm({
      name: p.nameEnglish,
      nameMl: p.nameMalayalam ?? '',
      productGroupId: p.productGroupId,
      unitId: p.productUnitId ?? '',
      basePrice: p.basePrice.toString(),
      itemCode: p.itemCode ?? generateItemCode(prefix, p.basePrice),
      sizeGroupId: p.sizeGroupId ?? '',  // ── NEW ──
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
    if (!addForm.name.trim() || !addForm.productGroupId) {
      setError('Fill all required fields.');
      return;
    }
    // Parse price from either the item code or the base price field
    let parsedPrice = parsePriceFromItemCode(addForm.itemCode);
    if (parsedPrice === null) {
      parsedPrice = parseFloat(addForm.basePrice);
    }
    if (parsedPrice === null || parsedPrice <= 0) {
      setError('Please enter a valid price (either in Base Price or Item Code).');
      return;
    }
    // Ensure item code has the correct price
    const prefix = addForm.itemCode && addForm.itemCode.includes('-') 
      ? extractItemCodePrefix(addForm.itemCode) 
      : DEFAULT_ITEM_CODE_PREFIX;
    const finalItemCode = generateItemCode(prefix, parsedPrice);
    
    setSaving(true);
    setError('');
    try {
      await productsApi.create({
        nameEnglish: addForm.name,
        nameMalayalam: addForm.nameMl || undefined,
        productGroupId: addForm.productGroupId,
        productUnitId: addForm.unitId || undefined,
        basePrice: parsedPrice,
        itemCode: finalItemCode,
        sizeGroupId: addForm.sizeGroupId || undefined,  // ── NEW ──
      });
      setShowAdd(false);
      setAddForm(emptyForm);
      loadAll();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  async function handleEdit() {
    if (!editForm.name.trim() || !editForm.productGroupId || !editModal) {
      setError('Fill all required fields.');
      return;
    }
    // Parse price from either the item code or the base price field
    let parsedPrice = parsePriceFromItemCode(editForm.itemCode);
    if (parsedPrice === null) {
      parsedPrice = parseFloat(editForm.basePrice);
    }
    if (parsedPrice === null || parsedPrice <= 0) {
      setError('Please enter a valid price.');
      return;
    }
    // Ensure item code has the correct price
    const prefix = editForm.itemCode && editForm.itemCode.includes('-') 
      ? extractItemCodePrefix(editForm.itemCode) 
      : DEFAULT_ITEM_CODE_PREFIX;
    const finalItemCode = generateItemCode(prefix, parsedPrice);
    
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
        itemCode: finalItemCode,
        sizeGroupId: editForm.sizeGroupId || undefined,  // ── NEW ──
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
      || (p.itemCode || '').toLowerCase().includes(q)
      || (p.sizeGroupName || '').toLowerCase().includes(q);
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
          
          {/* ── Catalog Config Link ── */}
          <Link
            to={user?.role === 'Admin' || user?.role === 'SuperAdmin' ? '/admin/catalog' : '#'}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 14px', borderRadius: 9,
              background: D.surface,
              border: `1px solid ${D.border}`,
              color: D.muted,
              fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              textDecoration: 'none',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = D.accent; (e.currentTarget as HTMLElement).style.color = D.accent; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = D.border; (e.currentTarget as HTMLElement).style.color = D.muted; }}
          >
            <Settings size={16} /> Catalog Config
          </Link>
          
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
            <ProductFormFields 
              form={addForm} 
              setForm={setAddForm} 
              groups={groups} 
              units={units} 
              sizeGroups={sizeGroups}
              autoFocus 
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, borderTop: `1px solid ${D.border}`, paddingTop: 18 }}>
              <button onClick={() => { setShowAdd(false); setError(''); }} style={{ padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 700, color: D.sub, border: `1px solid ${D.border}`, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={handleAdd} disabled={saving || !addForm.name.trim() || !addForm.productGroupId}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '10px 24px', borderRadius: 10, fontSize: 14, fontWeight: 800,
                  color: '#fff', border: 'none',
                  background: `linear-gradient(135deg, ${D.accent}, ${D.accentH})`,
                  cursor: saving || !addForm.name.trim() || !addForm.productGroupId ? 'not-allowed' : 'pointer',
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
                <ProductFormFields 
                  form={editForm} 
                  setForm={setEditForm} 
                  groups={groups} 
                  units={units} 
                  sizeGroups={sizeGroups}
                  isEdit={true} 
                />
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