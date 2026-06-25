// PATH: src/pages/Admin/AdminOrderEdit.tsx
// UPDATED: Added "Add Products" button between items and retail remarks

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Search, Trash2, ShoppingCart, Save,
  ChevronDown, ChevronUp, AlertTriangle, ArrowLeft, Package, X, Edit2,
  Trash, Plus
} from 'lucide-react';
import { ordersApi, productsApi, customersApi } from '../../api/services';
import {
  CustomerDto, OrderDetailDto, ProductDto,
  OrderStatus, fmtNum, CreateOrderItemDto
} from '../../types';
import { Spinner, ConfirmModal, Alert } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
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

function ItemCard({
  line,
  isExpanded,
  onToggleExpand,
  onQtyChange,
  onPriceChange,
  onQtyBlur,
  onPriceBlur,
  onRemove,
  canEdit,
  isMobile,
  displayQty,
  displayPrice,
}: {
  line: LineItem;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onQtyChange: (productId: string, value: string) => void;
  onPriceChange: (productId: string, value: string) => void;
  onQtyBlur: (productId: string) => void;
  onPriceBlur: (productId: string) => void;
  onRemove: () => void;
  canEdit: boolean;
  isMobile: boolean;
  displayQty: string;
  displayPrice: string;
}) {
  const variance = line.product.basePrice
    ? ((line.sellingPrice - line.product.basePrice) / line.product.basePrice) * 100
    : 0;
  const hasNegativeVariance = variance < -0.1;

  return (
    <div
      style={{
        background: D.surface,
        borderRadius: 14,
        border: `1px solid ${hasNegativeVariance ? 'rgba(239,68,68,0.30)' : D.border}`,
        padding: '14px 16px',
        transition: 'border-color 0.15s',
      }}
    >
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
            onClick={onToggleExpand}
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
          {canEdit && (
            <button
              onClick={onRemove}
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
          )}
        </div>
      </div>

      {/* ── Responsive fields ── */}
      <div style={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 8 : 10, 
        alignItems: isMobile ? 'stretch' : 'flex-end'
      }}>
        {/* Item Code - full width on mobile */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: D.sub, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Item Code</p>
          <div style={{
            padding: '8px 8px',
            borderRadius: 8,
            border: `1px solid ${D.border}`,
            background: D.bg,
            fontSize: 13,
            fontWeight: 800,
            color: D.text,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {line.product.itemCode || '—'}
          </div>
        </div>

        {/* Qty - responsive width */}
        <div style={{ width: isMobile ? '100%' : 64, flexShrink: 0 }}>
          <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: D.sub, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Qty</p>
          <input
            type="text"
            inputMode="numeric"
            value={displayQty}
            onChange={(e) => onQtyChange(line.productId, e.target.value)}
            onBlur={() => onQtyBlur(line.productId)}
            onFocus={(e) => e.target.select()}
            disabled={!canEdit}
            style={{
              width: '100%',
              textAlign: 'center',
              padding: '8px 4px',
              border: `1px solid ${canEdit ? D.accent : D.border}`,
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 800,
              background: canEdit ? D.surface2 : D.bg,
              color: D.text,
              fontFamily: 'inherit',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'all 0.15s',
            }}
          />
        </div>

        {/* Price - responsive width */}
        <div style={{ width: isMobile ? '100%' : 84, flexShrink: 0 }}>
          <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: D.sub, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Price ₹</p>
          <input
            type="text"
            inputMode="decimal"
            value={displayPrice}
            onChange={(e) => onPriceChange(line.productId, e.target.value)}
            onBlur={() => onPriceBlur(line.productId)}
            onFocus={(e) => e.target.select()}
            disabled={!canEdit}
            placeholder={String(line.product.basePrice ?? 0)}
            style={{
              width: '100%',
              textAlign: 'center',
              padding: '8px 4px',
              border: `1px solid ${canEdit ? D.accent : D.border}`,
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 800,
              background: canEdit ? D.surface2 : D.bg,
              color: D.text,
              fontFamily: 'inherit',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'all 0.15s',
            }}
          />
        </div>

        {/* Delete button - full width on mobile, inline on desktop */}
        {canEdit && (
          <button
            onClick={onRemove}
            style={{
              width: isMobile ? '100%' : 'auto',
              padding: isMobile ? '10px' : '8px 9px',
              borderRadius: 8,
              border: '1px solid rgba(239,68,68,0.22)',
              background: 'rgba(239,68,68,0.10)',
              color: '#f87171',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontFamily: 'inherit',
              flexShrink: 0,
              marginTop: isMobile ? 0 : 'auto',
            }}
          >
            <Trash2 size={15} />
            {isMobile && <span style={{ fontSize: 12, fontWeight: 600 }}>Remove</span>}
          </button>
        )}
      </div>

      {isExpanded && (
        <div style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: `1px solid ${D.border}`,
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(120px, 1fr))',
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
}

export function AdminOrderEdit() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isMobile = useIsMobile();

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
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  
  // ── FIX: Use local state for input values, not temp state ──
  // We directly use line.qty and line.sellingPrice as the source of truth
  // and update them immediately on input change.

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
        } catch {}
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
      return [{
        product,
        productId: String(product.id),
        qty: 1,
        sellingPrice: product.basePrice,
        unit: product.productUnitName ?? 'Unit',
        isNew: true,
      }, ...prev];
    });
    setSearch('');
    setShowSearch(false);
  }, []);

  // ── FIX: Directly update qty on input change ──
  const handleQtyChange = (productId: string, value: string) => {
    const numValue = parseInt(value, 10);
    if (value === '' || value === '-') {
      // Allow empty or minus sign temporarily
      setLines(prev => prev.map(l => 
        l.productId === productId ? { ...l, qty: 0 } : l
      ));
      return;
    }
    if (!isNaN(numValue) && numValue >= 0) {
      setLines(prev => prev.map(l => 
        l.productId === productId ? { ...l, qty: numValue } : l
      ));
    }
  };

  // ── FIX: Directly update price on input change ──
  const handlePriceChange = (productId: string, value: string) => {
    const numValue = parseFloat(value);
    if (value === '' || value === '.') {
      // Allow empty or decimal point temporarily
      setLines(prev => prev.map(l => 
        l.productId === productId ? { ...l, sellingPrice: 0 } : l
      ));
      return;
    }
    if (!isNaN(numValue) && numValue >= 0) {
      setLines(prev => prev.map(l => 
        l.productId === productId ? { ...l, sellingPrice: numValue } : l
      ));
    }
  };

  // ── FIX: On blur, clean up invalid values ──
  const handleQtyBlur = (productId: string) => {
    setLines(prev => prev.map(l => {
      if (l.productId === productId) {
        // If qty is 0 or invalid, remove the item
        if (l.qty <= 0) {
          return null;
        }
        return l;
      }
      return l;
    }).filter((l): l is LineItem => l !== null));
  };

  const handlePriceBlur = (productId: string) => {
    setLines(prev => prev.map(l => {
      if (l.productId === productId) {
        // If price is 0 or invalid, set to base price
        if (l.sellingPrice <= 0) {
          const product = products.find(p => String(p.id) === productId);
          return { ...l, sellingPrice: product?.basePrice || 0 };
        }
        return l;
      }
      return l;
    }));
  };

  const removeItem = (productId: string) => {
    setLines(prev => prev.filter(l => l.productId !== productId));
  };

  const totalItems = lines.reduce((s, l) => s + l.qty, 0);

  const buildPayload = () => {
    const currentUser = user;
    return {
      id: orderId,
      salesmanId: currentUser?.id || '',
      isAdmin: true,
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
      })),
    };
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccessMsg('');

    try {
      const payload = buildPayload();
      console.log('[AdminOrderEdit] Saving payload:', payload);
      
      await ordersApi.update(orderId!, payload);
      setSuccessMsg(lines.length === 0 ? 'Order cleared successfully!' : 'Order updated successfully!');
      const updated = await ordersApi.getById(orderId!);
      setOrder(updated);
      setTimeout(() => {
        navigate('/admin/orders');
      }, 1500);
    } catch (err: unknown) {
      console.error('[AdminOrderEdit] Save error:', err);
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!orderId) return;
    setCancelling(true);
    setError('');
    try {
      await ordersApi.delete(orderId);
      setSuccessMsg('Order cancelled successfully!');
      setTimeout(() => navigate('/admin/orders'), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to cancel order');
    } finally {
      setCancelling(false);
      setShowCancelConfirm(false);
    }
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
        <button onClick={() => navigate('/admin/orders')} style={{ padding: '10px 20px', borderRadius: 10, background: D.surface, border: `1px solid ${D.border}`, color: D.muted, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          ← Back to Orders
        </button>
      </div>
    );
  }

  const orderStatus = order.status;
  const canEdit = orderStatus !== OrderStatus.Closed;
  const isDraft = orderStatus === OrderStatus.Draft;

  if (!canEdit) {
    return (
      <div style={{ minHeight: '100vh', background: D.bg, padding: '24px' }}>
        <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.30)', borderRadius: 12, padding: '16px', color: '#fca5a5', marginBottom: 16 }}>
          Cannot edit order in '{getStatusLabel(orderStatus)}' status.
        </div>
        <button onClick={() => navigate('/admin/orders')} style={{ padding: '10px 20px', borderRadius: 10, background: D.surface, border: `1px solid ${D.border}`, color: D.muted, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          ← Back to Orders
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: D.bg, paddingBottom: 100 }}>

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        background: D.bg,
        borderBottom: `1px solid ${D.border}`,
        padding: '14px 16px',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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

            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: D.text, letterSpacing: '-0.02em' }}>
                <Edit2 size={14} style={{ display: 'inline', marginRight: 6, color: D.accent }} />
                Edit Order
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: D.sub }}>
                {customer?.nameEnglish ?? order.customerName} · #{String(order.id).slice(0, 8)}
              </p>
            </div>

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
          </div>

          {orderStatus !== OrderStatus.Draft && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginTop: 10,
              padding: '6px 12px',
              borderRadius: 8,
              background: 'rgba(245,158,11,0.10)',
              border: '1px solid rgba(245,158,11,0.25)',
              color: D.amber,
              fontSize: 12,
              fontWeight: 600,
            }}>
              <AlertTriangle size={13} />
              Order is in {getStatusLabel(orderStatus)} status. Editing will update it.
            </div>
          )}

          {/* Search bar */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', gap: 10,
              marginTop: 10,
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
                      {p.nameMalayalam && <p style={{ margin: '2px 0 0', fontSize: 11, color: D.sub }} lang="ml">{p.nameMalayalam}</p>}
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
            
            {isDraft && (
              <button
                onClick={() => setShowCancelConfirm(true)}
                style={{
                  marginTop: 16,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 20px',
                  borderRadius: 10,
                  border: `1px solid ${D.red}44`,
                  background: 'rgba(239,68,68,0.10)',
                  color: D.red,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.20)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.10)'; }}
              >
                <Trash size={14} /> Cancel Order
              </button>
            )}
          </div>
        )}

        {/* ── Line items ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lines.map(line => {
            const isExpanded = expandedProduct === line.product.id;
            // ── FIX: Directly use line values for display ──
            const displayQty = line.qty === 0 ? '' : String(line.qty);
            const displayPrice = line.sellingPrice === 0 ? '' : String(line.sellingPrice);
            
            return (
              <ItemCard
                key={line.product.id}
                line={line}
                isExpanded={isExpanded}
                onToggleExpand={() => setExpandedProduct(isExpanded ? null : line.product.id)}
                onQtyChange={handleQtyChange}
                onPriceChange={handlePriceChange}
                onQtyBlur={handleQtyBlur}
                onPriceBlur={handlePriceBlur}
                onRemove={() => removeItem(line.productId)}
                canEdit={canEdit}
                isMobile={isMobile}
                displayQty={displayQty}
                displayPrice={displayPrice}
              />
            );
          })}
        </div>

        {/* ── ADD PRODUCTS BUTTON ── Between items and retail remarks ── */}
        {canEdit && (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0 14px' }}>
            <button
              onClick={() => setShowSearch(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '12px 28px',
                borderRadius: 28,
                background: `linear-gradient(135deg, ${D.accent}, ${D.accentH})`,
                border: 'none',
                color: '#fff',
                fontSize: 14,
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: `0 4px 16px ${D.accentGlow}`,
                touchAction: 'manipulation',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 24px ${D.accentGlow}`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${D.accentGlow}`;
              }}
            >
              <Plus size={18} strokeWidth={2.5} /> Add Products
            </button>
          </div>
        )}

        {/* ── Retail Remarks ── FULL WIDTH, NO PREVIEW BOX ──────────────────── */}
        <div style={{
          marginTop: 16,
          background: D.surface,
          borderRadius: 14,
          border: `1px solid ${D.border}`,
          padding: '16px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10,
            paddingBottom: 8,
            borderBottom: `2px solid ${D.accent}44`,
          }}>
            <span style={{ fontSize: 16 }}>🛍</span>
            <span style={{
              fontSize: 13,
              fontWeight: 800,
              color: D.accent,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Retail Items &amp; Remarks
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: 400,
              color: D.sub,
              marginLeft: 4,
            }}>
              (Enter one item per line)
            </span>
          </div>

          <textarea
            style={{
              width: '100%',
              padding: '12px 14px',
              background: D.bg,
              border: `1px solid ${D.border}`,
              borderRadius: 10,
              fontSize: 14,
              color: D.text,
              fontFamily: 'monospace',
              resize: 'vertical',
              outline: 'none',
              minHeight: 120,
              boxSizing: 'border-box',
            }}
            rows={6}
            placeholder={`Savala - 10 kg
Colli - 10 kg
Waz - 24 pieces
Duocsu - 24 units
Salt - 25 kg
Sugar - 50 kg`}
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 11, color: D.sub }}>
              💡 Press <kbd style={{
                padding: '1px 6px',
                borderRadius: 4,
                background: D.border,
                color: D.muted,
                fontSize: 10,
                fontWeight: 700,
              }}>Enter</kbd> for new line
            </span>
            <span style={{ fontSize: 11, color: remarks.length > 1000 ? D.amber : D.sub }}>
              {remarks.length}/1000
            </span>
          </div>
        </div>
      </div>

      {/* ── Fixed bottom footer ── SHOWN EVEN WHEN EMPTY ────────────────────── */}
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
        <div style={{ 
          maxWidth: 900, 
          margin: '0 auto', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          gap: 12, 
          flexWrap: 'wrap' 
        }}>
          {lines.length > 0 && (
            <span style={{ fontSize: 12, color: D.sub }}>
              {lines.length} product{lines.length > 1 ? 's' : ''} · {totalItems} unit{totalItems > 1 ? 's' : ''}
            </span>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 24px',
              borderRadius: 10,
              border: 'none',
              background: saving
                ? D.border
                : `linear-gradient(135deg, ${D.accent}, ${D.accentH})`,
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              boxShadow: saving
                ? 'none'
                : `0 4px 14px ${D.accentGlow}`,
              transition: 'all 0.18s',
              touchAction: 'manipulation',
            }}
          >
            <Save size={16} />
            {saving ? 'Saving...' : lines.length === 0 ? 'Clear & Save' : 'Save Changes'}
          </button>
        </div>
      </div>

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

      {/* ── Cancel Order confirmation ── */}
      <ConfirmModal
        open={showCancelConfirm}
        title="Cancel Order"
        message="Are you sure you want to permanently cancel this order? This action cannot be undone."
        confirmLabel="Cancel Order"
        danger={true}
        loading={cancelling}
        onConfirm={handleCancelOrder}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </div>
  );
}