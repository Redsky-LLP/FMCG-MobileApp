// PATH: src/pages/Admin/AdminOrderEdit.tsx
// UPDATED: Fixed TypeScript errors - OrderStatus is string enum

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Search, Minus, Plus, Trash2, ShoppingCart, Save,
  ChevronDown, ChevronUp, AlertTriangle, ArrowLeft, Package, X, Edit2
} from 'lucide-react';
import { ordersApi, productsApi, customersApi } from '../../api/services';
import {
  CustomerDto, OrderDetailDto, ProductDto,
  OrderStatus, fmtNum, CreateOrderItemDto
} from '../../types';
import { Spinner, ConfirmModal, Alert } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';

// ── Dark theme tokens ─────────────────────────────────────────────────────────
const D = {
  bg:       '#0f172a',     // slate-950
  surface:  '#1e293b',     // slate-800
  surface2: '#243447',     // slate-800 variant
  border:   '#334155',     // slate-700
  accent:   '#ea580c',     // orange-600
  accentH:  '#c2410c',     // orange-700
  accentGlow: 'rgba(234,88,12,0.25)',
  text:     '#f1f5f9',     // slate-100
  muted:    '#94a3b8',     // slate-400
  sub:      '#64748b',     // slate-500
  green:    '#22c55e',     // green-500
  red:      '#ef4444',     // red-500
  amber:    '#f59e0b',     // amber-500
  card:     '#1e293b',     // slate-800
};

interface LineItem {
  product: ProductDto;
  qty: number;
  sellingPrice: number;
  unit: string;
  productId: string;
  itemId?: string;
  isNew?: boolean;
}

function PriceVarianceBadge({ base, selling }: { base: number; selling: number }) {
  if (!base || !selling) return null;
  const diff = ((selling - base) / base) * 100;
  const abs = Math.abs(diff).toFixed(1);
  if (Math.abs(diff) < 0.1) return <span className="text-xs text-emerald-400">✓ At base price</span>;
  if (diff < 0) {
    return (
      <span className="text-xs text-red-400 flex items-center gap-1">
        <AlertTriangle size={11} /> {abs}% below base
      </span>
    );
  }
  return <span className="text-xs text-emerald-400">▲ +{abs}% above base</span>;
}

// ── Status label helper (OrderStatus is a string enum) ──────────────────────
const STATUS_LABELS: Record<string, string> = {
  'Draft': 'Draft',
  'PendingApproval': 'Pending Approval',
  'Approved': 'Approved',
  'Packed': 'Packed',
  'Closed': 'Closed',
};

const getStatusLabel = (status: OrderStatus | string): string => {
  return STATUS_LABELS[String(status)] ?? String(status);
};

export function AdminOrderEdit() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [order, setOrder] = useState<OrderDetailDto | null>(null);
  const [customer, setCustomer] = useState<CustomerDto | null>(null);
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [lines, setLines] = useState<LineItem[]>([]);
  const [remarks, setRemarks] = useState('');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setError('Invalid order ID');
      setLoading(false);
      return;
    }

    Promise.all([
      ordersApi.getById(orderId),
      productsApi.list(),
    ]).then(async ([o, p]) => {
      setOrder(o);
      setProducts(p);
      setRemarks(o.remarks ?? '');

      if (o.customerId) {
        try {
          const c = await customersApi.getById(String(o.customerId));
          setCustomer(c);
        } catch {
          // Customer not found
        }
      }

      const reconstructed: LineItem[] = (o.items ?? []).map(item => {
        const prod = p.find(pp => String(pp.id) === String(item.productId));
        if (!prod) return null;
        return {
          product: prod,
          productId: String(prod.id),
          itemId: String(item.id),
          qty: item.quantity,
          sellingPrice: item.sellingPrice,
          unit: prod.productUnitName ?? 'Unit',
        };
      }).filter(Boolean) as LineItem[];
      setLines(reconstructed);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load order');
    }).finally(() => setLoading(false));
  }, [orderId]);

  const filteredProducts = products.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.nameEnglish.toLowerCase().includes(q) ||
      (p.nameMalayalam && p.nameMalayalam.toLowerCase().includes(q)) ||
      (p.productGroupName && p.productGroupName.toLowerCase().includes(q))
    );
  });

  const addProduct = useCallback((product: ProductDto) => {
    setLines(prev => {
      if (prev.find(l => l.product.id === product.id)) return prev;
      return [...prev, {
        product,
        productId: String(product.id),
        qty: 1,
        sellingPrice: product.basePrice,
        unit: product.productUnitName ?? 'Unit',
        isNew: true,
      }];
    });
    setSearch('');
    setShowSearch(false);
  }, []);

  const updateQty = (productId: string, delta: number) => {
    setLines(prev =>
      prev.map(l => {
        if (l.product.id !== productId) return l;
        const newQty = l.qty + delta;
        if (newQty < 0) return l;
        if (newQty === 0) return null;
        return { ...l, qty: newQty };
      }).filter(Boolean) as LineItem[]
    );
  };

  const setQtyDirect = (productId: string, val: string) => {
    let n = parseInt(val, 10);
    if (isNaN(n) || n < 0) return;
    if (n === 0) {
      setLines(prev => prev.filter(l => l.product.id !== productId));
      return;
    }
    setLines(prev =>
      prev.map(l =>
        l.product.id === productId ? { ...l, qty: n } : l
      )
    );
  };

  const setPrice = (productId: string, val: string) => {
    let n = parseFloat(val);
    if (isNaN(n)) return;
    setLines(prev => prev.map(l =>
      l.product.id === productId ? { ...l, sellingPrice: n } : l
    ));
  };

  const removeItem = (productId: string) => {
    setLines(prev => prev.filter(l => l.product.id !== productId));
  };

  const totalItems = lines.reduce((s, l) => s + l.qty, 0);

  const buildPayload = () => {
    return {
      id: orderId,
      customerId: String(order?.customerId),
      routeId: String(order?.routeId),
      orderDate: order?.orderDate || new Date().toISOString(),
      remarks: remarks || undefined,
      items: lines.map(l => ({
        id: l.isNew ? undefined : l.itemId,
        productId: l.productId,
        quantity: l.qty,
        unitId: l.product.productUnitId,
        sellingPrice: l.sellingPrice,
      } as CreateOrderItemDto)),
    };
  };

  const handleSave = async () => {
    if (lines.length === 0) {
      setError('Add at least one item to the order.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccessMsg('');

    try {
      await ordersApi.update(orderId!, buildPayload());
      setSuccessMsg('Order updated successfully!');
      setTimeout(() => {
        navigate('/admin/orders');
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const formatRemarksWithNumbers = (text: string): string => {
    if (!text) return '';
    const lines = text.split(/\r?\n/);
    return lines.map((line, index) => {
      const trimmedLine = line.trim();
      if (trimmedLine === '') return '';
      return `${index + 1}. ${trimmedLine}`;
    }).filter(line => line !== '').join('\n');
  };

  const handleRemarksChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setRemarks(e.target.value);
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: D.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner />
    </div>
  );

  if (!order) {
    return (
      <div style={{ minHeight: '100vh', background: D.bg, padding: '24px' }}>
        <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.30)', borderRadius: 12, padding: '16px', color: '#fca5a5', marginBottom: 16 }}>
          Order not found.
        </div>
        <button 
          onClick={() => navigate('/admin/orders')}
          style={{
            padding: '10px 20px',
            borderRadius: 10,
            background: D.surface,
            border: `1px solid ${D.border}`,
            color: D.muted,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ← Back to Orders
        </button>
      </div>
    );
  }

  const orderStatus = order.status;
  const canEdit = orderStatus !== OrderStatus.Closed;

  if (!canEdit) {
    return (
      <div style={{ minHeight: '100vh', background: D.bg, padding: '24px' }}>
        <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.30)', borderRadius: 12, padding: '16px', color: '#fca5a5', marginBottom: 16 }}>
          Cannot edit order in '{getStatusLabel(orderStatus)}' status. 
          Only Draft, Pending Approval, or Approved orders can be edited. Closed orders are locked.
        </div>
        <button 
          onClick={() => navigate('/admin/orders')}
          style={{
            padding: '10px 20px',
            borderRadius: 10,
            background: D.surface,
            border: `1px solid ${D.border}`,
            color: D.muted,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ← Back to Orders
        </button>
      </div>
    );
  }

  const formattedRemarksPreview = formatRemarksWithNumbers(remarks);

  return (
    <div style={{ minHeight: '100vh', background: D.bg, paddingBottom: 100 }}>

      {/* ── Sticky Dark Header ──────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        background: D.bg,
        borderBottom: `1px solid ${D.border}`,
        padding: '14px 16px',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          {/* Top row: Back + Title + Status */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <button
              onClick={() => navigate('/admin/orders')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px',
                borderRadius: 9,
                background: D.surface,
                border: `1px solid ${D.border}`,
                color: D.muted,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = D.accent; (e.currentTarget as HTMLElement).style.color = D.text; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = D.border; (e.currentTarget as HTMLElement).style.color = D.muted; }}
            >
              <ArrowLeft size={15} /> Back
            </button>

            <div style={{ textAlign: 'center' }}>
              <h1 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: D.text, letterSpacing: '-0.02em' }}>
                <Edit2 size={14} style={{ display: 'inline', marginRight: 6, color: D.accent }} />
                Edit Order
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: D.sub }}>
                {customer?.nameEnglish ?? order.customerName} · #{String(order.id).slice(0, 8)}
              </p>
            </div>

            {(orderStatus === OrderStatus.PendingApproval || orderStatus === OrderStatus.Approved) && (
              <span style={{
                padding: '4px 12px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                background: 'rgba(234,88,12,0.15)',
                color: D.accent,
                border: `1px solid ${D.accentGlow}`,
              }}>
                {getStatusLabel(orderStatus)}
              </span>
            )}
            {orderStatus === OrderStatus.Draft && <div style={{ width: 80 }} />}
          </div>

          {/* Warning banner for non-draft orders */}
          {orderStatus !== OrderStatus.Draft && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginTop: 12,
              padding: '8px 14px',
              borderRadius: 9,
              background: 'rgba(245,158,11,0.10)',
              border: '1px solid rgba(245,158,11,0.25)',
              color: D.amber,
              fontSize: 12,
              fontWeight: 600,
            }}>
              <AlertTriangle size={14} />
              Order is in {getStatusLabel(orderStatus)} status. Editing will update it.
            </div>
          )}

          {/* Search bar */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', gap: 10,
              marginTop: 12,
              padding: '10px 14px',
              borderRadius: 10,
              background: D.surface,
              border: `1px solid ${D.border}`,
              color: D.sub,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = D.accent; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = D.border; }}
          >
            <Search size={15} color={D.muted} />
            <span style={{ flex: 1, textAlign: 'left' }}>Add product to order...</span>
            {showSearch && <X size={14} onClick={(e) => { e.stopPropagation(); setShowSearch(false); }} />}
          </button>
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px' }}>

        {/* Error/Success messages */}
        {error && (
          <div style={{
            marginBottom: 12,
            padding: '12px 16px',
            borderRadius: 10,
            background: 'rgba(239,68,68,0.10)',
            border: '1px solid rgba(239,68,68,0.25)',
            color: '#fca5a5',
            fontSize: 13,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>{error}</span>
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
        )}
        {successMsg && (
          <div style={{
            marginBottom: 12,
            padding: '12px 16px',
            borderRadius: 10,
            background: 'rgba(34,197,94,0.10)',
            border: '1px solid rgba(34,197,94,0.25)',
            color: '#86efac',
            fontSize: 13,
            fontWeight: 700,
          }}>
            ✓ {successMsg}
          </div>
        )}

        {/* ── Product search panel ── */}
        {showSearch && (
          <div style={{
            background: D.surface,
            borderRadius: 14,
            border: `1px solid ${D.border}`,
            marginBottom: 16,
            overflow: 'hidden',
          }}>
            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${D.border}` }}>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: D.sub, pointerEvents: 'none' }} />
                <input
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 34px',
                    background: D.bg,
                    border: `1px solid ${D.border}`,
                    borderRadius: 9,
                    fontSize: 13,
                    color: D.text,
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                  placeholder="Search product by name or group..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {filteredProducts.slice(0, 30).map(p => {
                const alreadyAdded = lines.some(l => l.product.id === p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => !alreadyAdded && addProduct(p)}
                    disabled={alreadyAdded}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderBottom: `1px solid ${D.border}`,
                      background: 'transparent',
                      cursor: alreadyAdded ? 'not-allowed' : 'pointer',
                      opacity: alreadyAdded ? 0.5 : 1,
                      transition: 'background 0.12s',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                    }}
                    onMouseEnter={e => { if (!alreadyAdded) (e.currentTarget as HTMLElement).style.background = 'rgba(234,88,12,0.06)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: D.text }}>{p.nameEnglish}</p>
                      {p.nameMalayalam && (
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: D.sub }} lang="ml">{p.nameMalayalam}</p>
                      )}
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: D.sub }}>
                        {p.productGroupName || 'General'} · {p.productUnitName || 'Unit'}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: D.accent }}>₹{fmtNum(p.basePrice)}</p>
                      {alreadyAdded && <p style={{ margin: '2px 0 0', fontSize: 10, color: D.accent }}>Added</p>}
                    </div>
                  </button>
                );
              })}
              {filteredProducts.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                  <Package size={32} color={D.border} style={{ marginBottom: 8 }} />
                  <p style={{ fontSize: 13, color: D.sub }}>No products found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {lines.length === 0 && !showSearch && (
          <div style={{
            textAlign: 'center',
            padding: '48px 20px',
            background: D.surface,
            borderRadius: 14,
            border: `1px solid ${D.border}`,
          }}>
            <ShoppingCart size={40} color={D.border} style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 14, color: D.muted, margin: 0 }}>No items in this order</p>
            <p style={{ fontSize: 12, color: D.sub, marginTop: 4 }}>Click the search bar above to add products</p>
          </div>
        )}

        {/* ── Line items ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lines.map(line => {
            const isExpanded = expandedProduct === line.product.id;
            const variance = line.product.basePrice
              ? ((line.sellingPrice - line.product.basePrice) / line.product.basePrice) * 100
              : 0;
            const hasNegativeVariance = variance < -0.1;

            return (
              <div
                key={line.product.id}
                style={{
                  background: D.surface,
                  borderRadius: 14,
                  border: `1px solid ${hasNegativeVariance ? 'rgba(239,68,68,0.30)' : D.border}`,
                  padding: '14px 16px',
                  transition: 'border-color 0.15s',
                }}
              >
                {/* Product Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: D.text }}>
                        {line.product.nameEnglish}
                      </h3>
                      <PriceVarianceBadge base={line.product.basePrice} selling={line.sellingPrice} />
                    </div>
                    {line.product.nameMalayalam && (
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: D.sub }} lang="ml">{line.product.nameMalayalam}</p>
                    )}
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: D.sub }}>
                      {line.product.productGroupName || 'General'} · {line.unit}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={() => setExpandedProduct(isExpanded ? null : line.product.id)}
                      style={{
                        padding: '6px 8px',
                        borderRadius: 8,
                        background: 'transparent',
                        border: 'none',
                        color: D.sub,
                        cursor: 'pointer',
                      }}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(line.product.id)}
                      style={{
                        padding: '6px 8px',
                        borderRadius: 8,
                        background: 'transparent',
                        border: 'none',
                        color: D.sub,
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Quantity and Price Controls - Item total removed */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: D.bg,
                    borderRadius: 10,
                    padding: '2px',
                  }}>
                    <button
                      onClick={() => updateQty(line.product.id, -1)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        border: 'none',
                        background: 'transparent',
                        color: D.muted,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={line.qty}
                      onChange={e => setQtyDirect(line.product.id, e.target.value)}
                      style={{
                        width: 48,
                        textAlign: 'center',
                        fontSize: 15,
                        fontWeight: 700,
                        background: 'transparent',
                        border: 'none',
                        color: D.text,
                        outline: 'none',
                        fontFamily: 'inherit',
                      }}
                    />
                    <button
                      onClick={() => updateQty(line.product.id, 1)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        border: 'none',
                        background: 'transparent',
                        color: D.muted,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <span style={{ fontSize: 12, color: D.sub, background: D.bg, padding: '4px 10px', borderRadius: 6 }}>
                    {line.unit}
                  </span>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: D.bg,
                    borderRadius: 10,
                    padding: '4px 10px',
                    border: `1px solid ${D.border}`,
                  }}>
                    <span style={{ fontSize: 13, color: D.sub, fontWeight: 600 }}>₹</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={line.sellingPrice > 0 ? line.sellingPrice : ''}
                      onChange={e => setPrice(line.product.id, e.target.value)}
                      placeholder={String(line.product.basePrice ?? 0)}
                      style={{
                        width: 80,
                        background: 'transparent',
                        border: 'none',
                        color: D.text,
                        fontSize: 14,
                        fontWeight: 600,
                        outline: 'none',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>
                </div>

                {/* Expanded details - Item total removed, shows Qty × Price only */}
                {isExpanded && (
                  <div style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: `1px solid ${D.border}`,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                    gap: 8,
                  }}>
                    <div style={{ background: D.bg, borderRadius: 8, padding: '8px 12px' }}>
                      <span style={{ fontSize: 10, color: D.sub, display: 'block' }}>Base Price</span>
                      <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: D.text }}>₹{fmtNum(line.product.basePrice)}</p>
                    </div>
                    <div style={{ background: D.bg, borderRadius: 8, padding: '8px 12px' }}>
                      <span style={{ fontSize: 10, color: D.sub, display: 'block' }}>Variance</span>
                      <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: variance < 0 ? D.red : D.green }}>
                        {variance >= 0 ? '+' : ''}{variance.toFixed(1)}%
                      </p>
                    </div>
                    <div style={{ background: D.bg, borderRadius: 8, padding: '8px 12px' }}>
                      <span style={{ fontSize: 10, color: D.sub, display: 'block' }}>Unit</span>
                      <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: D.text }}>{line.unit}</p>
                    </div>
                    <div style={{ background: D.bg, borderRadius: 8, padding: '8px 12px' }}>
                      <span style={{ fontSize: 10, color: D.sub, display: 'block' }}>Qty × Price</span>
                      <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: D.accent }}>{line.qty} × ₹{fmtNum(line.sellingPrice)}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Retail Remarks ── */}
        {lines.length > 0 && (
          <div style={{
            marginTop: 16,
            background: D.surface,
            borderRadius: 14,
            border: `1px solid ${D.border}`,
            padding: '16px',
          }}>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 700,
              color: D.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 8,
            }}>
              🛍 Retail Items <span style={{ fontSize: 10, fontWeight: 400, color: D.sub }}>(Enter one item per line)</span>
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Input area */}
              <div>
                <p style={{ fontSize: 11, color: D.sub, marginBottom: 4 }}>Enter items:</p>
                <textarea
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: D.bg,
                    border: `1px solid ${D.border}`,
                    borderRadius: 10,
                    fontSize: 13,
                    color: D.text,
                    fontFamily: 'monospace',
                    resize: 'vertical',
                    outline: 'none',
                    minHeight: 180,
                  }}
                  rows={8}
                  placeholder={`Savala - 10 kg
Colli - 10 kg
Waz - 24 pieces
Duocsu - 24 units
Salt - 25 kg
Sugar - 50 kg`}
                  value={remarks}
                  onChange={handleRemarksChange}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: D.sub }}>Press Enter for new line</span>
                  <span style={{ fontSize: 11, color: remarks.length > 1000 ? D.amber : D.sub }}>
                    {remarks.length}/1000
                  </span>
                </div>
              </div>

              {/* Preview */}
              <div>
                <p style={{ fontSize: 11, color: D.sub, marginBottom: 4 }}>Preview (with line numbers):</p>
                <div style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: D.bg,
                  border: `1px solid ${D.border}`,
                  borderRadius: 10,
                  fontSize: 13,
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  minHeight: 180,
                  maxHeight: 250,
                  overflowY: 'auto',
                  color: D.muted,
                }}>
                  {formattedRemarksPreview || <span style={{ color: D.sub, fontStyle: 'italic' }}>No items entered yet</span>}
                </div>
                <p style={{ fontSize: 11, color: D.sub, marginTop: 6 }}>
                  These items will appear in the order's remarks section
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Fixed bottom footer ── */}
      {lines.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 55,
          background: D.bg,
          borderTop: `1px solid ${D.border}`,
          padding: '10px 16px',
          paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px) + 70px)',
        }}>
          <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, color: D.sub }}>
                {lines.length} products · {totalItems} units
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || lines.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 24px',
                borderRadius: 10,
                border: 'none',
                background: saving || lines.length === 0
                  ? D.border
                  : `linear-gradient(135deg, ${D.accent}, ${D.accentH})`,
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: saving || lines.length === 0 ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                boxShadow: saving || lines.length === 0
                  ? 'none'
                  : `0 4px 14px ${D.accentGlow}`,
                transition: 'all 0.18s',
                touchAction: 'manipulation',
              }}
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ── */}
      <ConfirmModal
        open={!!showDeleteConfirm}
        title="Remove Item"
        message="Are you sure you want to remove this item from the order?"
        confirmLabel="Remove"
        danger={true}
        onConfirm={() => {
          if (showDeleteConfirm) {
            removeItem(showDeleteConfirm);
            setShowDeleteConfirm(null);
          }
        }}
        onCancel={() => setShowDeleteConfirm(null)}
      />
    </div>
  );
}