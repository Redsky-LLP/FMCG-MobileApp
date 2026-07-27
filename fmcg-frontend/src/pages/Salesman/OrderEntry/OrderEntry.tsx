// PATH: src/pages/Salesman/OrderEntry/OrderEntry.tsx
// FIXES:
// 1. Dark theme — slate-900 background, dark cards, high contrast text
// 2. Single "+" FAB button to open product sidebar (no top header toggle)
// 3. Product sidebar opens as full-screen bottom sheet on mobile (no clip issues)
// 4. Save Draft saves correctly; ID mismatch fix on update
// 5. FIX: Salesman cannot edit base price — price field is read-only for salesman
// 6. FIX: Cancel Order button appears when order has no items (Draft only)
// 7. FIX: Delete order API call when cancelling
// 8. FIX: Cancel Order redirects to Route Execution page (not My Routes)
// 9. FIX: Save Draft button centered in bottom bar
// 10. FIX: hasExistingOrder declared before use
// 11. FIX: Content no longer hidden behind bottom navigation bar
// 12. RESTORED: Price Variance Badge + ±10% range validation (was accidentally
//     dropped from this file at some point — restoring it here, layered on top
//     of the order-lookup-by-status fix, frozen name snapshot, out-of-stock
//     picker handling, and acting-as-admin banner-aware positioning, none of
//     which are touched by this restoration).

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Edit3, Lock, Save,
  CalendarDays, Trash2, CheckCircle2, Clock,
  ChevronLeft, ChevronRight, Search, X, Package,
  AlertTriangle, Trash, Phone, MapPin,
} from 'lucide-react';
import { customersApi, ordersApi, productsApi } from '../../../api/services';
import {
  OrderStatus, CustomerOrderHistoryDto, CreateOrderCommand, ProductUnitPriceDto,
} from '../../../types';
import { Spinner } from '../../../components/ui';
import { LineItem } from './types';
import { PriceVarianceBadge } from './types';
import { PreviousOrdersModal } from './components/PreviousOrdersModal';
import { useIsMobile } from '../../../hooks/useIsMobile';

// ── Dark theme tokens ─────────────────────────────────────────────────────────
const D = {
  bg:      '#0f172a',
  card:    '#1e293b',
  card2:   '#243447',
  border:  '#334155',
  accent:  '#3b82f6',
  accentH: '#2563eb',
  green:   '#22c55e',
  red:     '#ef4444',
  text:    '#f1f5f9',
  muted:   '#94a3b8',
  sub:     '#64748b',
  orange:  '#f97316',
};

// ── Mobile nav height constant ──────────────────────────────────────────────
const MOBILE_NAV_HEIGHT = 70;

export default function OrderEntry() {
  const { routeId, customerId } = useParams<{ routeId: string; customerId: string }>();
  const navigate  = useNavigate();
  const location  = useLocation();
  const isMobile = useIsMobile();

  const executionContext = location.state as { executionId?: string; customerVisitId?: string } | null;

  const [customer,           setCustomer]           = useState<any>(null);
  const [allProducts,        setAllProducts]        = useState<any[]>([]);
  const [filteredProducts,   setFilteredProducts]   = useState<any[]>([]);
  const [search,             setSearch]             = useState('');
  const [existingOrder,      setExistingOrder]      = useState<any>(null);
  const [lines,              setLines]              = useState<LineItem[]>([]);
  const [remarks,            setRemarks]            = useState('');
  const [loading,            setLoading]            = useState(true);
  const [saving,             setSaving]             = useState(false);
  const [deleting,           setDeleting]           = useState(false);
  const [error,              setError]              = useState('');
  const [successMsg,         setSuccessMsg]         = useState('');
  const [previousOrders,     setPreviousOrders]     = useState<CustomerOrderHistoryDto[]>([]);
  const [showPreviousModal,  setShowPreviousModal]  = useState(false);
  const [showProducts,       setShowProducts]       = useState(false);
  const [tempQuantities,     setTempQuantities]     = useState<Record<string, string>>({});
  const [tempPrices,         setTempPrices]         = useState<Record<string, string>>({});
  const [unitPrices,         setUnitPrices]         = useState<Record<string, ProductUnitPriceDto>>({});
  const [showCancelConfirm,  setShowCancelConfirm]  = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // ── NEW: ref to the most-recently-rendered item card, so we can scroll it
  // into view automatically the moment it's added — instead of leaving it
  // below the fold and making the salesman scroll down manually to confirm
  // the tap actually registered. ──
  const lastItemRef = useRef<HTMLDivElement>(null);

  // ── FIX: Declare hasExistingOrder BEFORE using it in canCancel ──
  const hasExistingOrder = !!existingOrder;
  const isDraft = existingOrder?.status === OrderStatus.Draft;
  const canEdit = !existingOrder || existingOrder.status === OrderStatus.Draft;
  const totalItems  = lines.reduce((s, l) => s + l.qty, 0);
  const hasNoItems = lines.length === 0 && !remarks.trim();
  // ── NEW: Show cancel button for ANY existing draft order (even with items) ──
  const canCancel = isDraft && hasExistingOrder;

  // ── PERFORMANCE FIX: this used to call productsApi.getUnitPrices(product.id)
  // once for EVERY product in the entire active catalog, in sequential batches
  // of 5 — for a 100-product catalog, that's 20 sequential round-trips just to
  // open a single order screen, before a salesman could even see an empty "New"
  // order. Across a cross-cloud connection (app server and DB in different
  // data centers), each round-trip costs real time, which is exactly what was
  // causing the several-second delay on opening/saving orders. Replaced with
  // ONE call to a new batched endpoint that returns every product's default
  // unit price in a single response — same resulting priceMap shape as before,
  // just built from one API call instead of N. ──
  const loadUnitPrices = useCallback(async (products: any[]) => {
    const priceMap: Record<string, ProductUnitPriceDto> = {};
    try {
      const defaults = await productsApi.getDefaultUnitPrices();
      for (const def of defaults) {
        priceMap[def.productId] = def;
      }
    } catch {}
    setUnitPrices(priceMap);
    return priceMap;
  }, []);

  useEffect(() => {
    if (!routeId || !customerId) return;
    const cid = String(customerId);

    Promise.all([customersApi.getById(cid), productsApi.list({ isActive: true })])
      .then(async ([c, p]) => {
        setCustomer(c);
        setAllProducts(p);
        setFilteredProducts(p);
        const priceMap = await loadUnitPrices(p);

        try {
          const allOrders = await ordersApi.listByRoute(routeId);
          // ── FIX: this used to only count an order as "the one to edit" if its
          // orderDate matched today's calendar date. But a Draft order is meant to
          // stay open and editable across day boundaries until the admin actually
          // closes it — so filtering by date silently lost yesterday's still-open
          // order the moment the calendar rolled over, showing an empty "New" order
          // instead of the real Draft one with items already on it. Filtering by
          // status (not yet Closed, not locked) instead of date fixes this — the
          // most recent still-open order for this customer is always found,
          // regardless of which day it was originally created on. ──
          const existing  = allOrders
            .filter(o => String(o.customerId) === cid && o.status !== 'Closed' && !o.isLocked)
            .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())[0];

          if (existing) {
            const detail = await ordersApi.getById(existing.id);
            setExistingOrder(detail);
            setRemarks(detail.remarks ?? '');
            const mapped: LineItem[] = (detail.items ?? []).map((item: any) => {
              const prod = p.find((pp: any) => String(pp.id) === String(item.productId));
              if (!prod) return null;
              const up = priceMap[prod.id];
              return {
                // ── FIX: keep the frozen name from the order itself (item.productName /
                // item.productNameMalayalam — already correctly snapshot-preferred by the
                // backend) instead of the live product's current name. Everything else
                // about `prod` (unit info, base price for lookups, etc.) still comes from
                // the live product record, since that's needed for editing — only the
                // display name was wrong, because it was silently overwritten by whichever
                // name the product currently has, even after a rename. ──
                product: {
                  ...prod,
                  nameEnglish: item.productName || prod.nameEnglish,
                  nameMalayalam: item.productNameMalayalam || prod.nameMalayalam,
                },
                productId:    String(prod.id),
                qty:          item.quantity,
                sellingPrice: item.sellingPrice || (up?.salePrice ?? prod.basePrice),
                unit:         prod.productUnitName ?? 'Unit',
              };
            }).filter(Boolean) as LineItem[];
            setLines(mapped);
            return;
          }
        } catch {}

        try {
          const history = await ordersApi.getCustomerHistory(cid, 10);
          if (history?.length) setPreviousOrders(history);
        } catch {}
      })
      .catch(() => setError('Failed to load data. Please refresh.'))
      .finally(() => setLoading(false));
  }, [customerId, routeId, loadUnitPrices]);

  // Filter products — name/item code search only, no group filter
  useEffect(() => {
    let filtered = allProducts;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((p: any) =>
        p.nameEnglish?.toLowerCase().includes(q) ||
        p.nameMalayalam?.toLowerCase().includes(q) ||
        p.itemCode?.toLowerCase().includes(q)
      );
    }
    setFilteredProducts(filtered);
  }, [search, allProducts]);

  useEffect(() => {
    if (showProducts && searchInputRef.current) searchInputRef.current.focus();
  }, [showProducts]);

  // ── NEW: auto-scroll to the newly added item. New items are appended to
  // the end of `lines`, so after a tap in the picker they land below whatever
  // was already visible on screen — this brings the just-added item into
  // view automatically instead of requiring a manual scroll to confirm it
  // was actually added. A short delay lets the picker's close animation and
  // the new card's render settle first, so the scroll target is accurate. ──
  const prevLineCountRef = useRef(0);
  useEffect(() => {
    if (lines.length > prevLineCountRef.current) {
      const t = setTimeout(() => {
        lastItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
      prevLineCountRef.current = lines.length;
      return () => clearTimeout(t);
    }
    prevLineCountRef.current = lines.length;
  }, [lines.length]);

  // ── Add product — one tap adds one item, then the picker closes.
  // Tap "+" again to add the next item (deliberate: simpler, less error-prone
  // on a small mobile screen than a picker that stays open). ──
  const addProduct = useCallback((product: any) => {
    if (!canEdit) return;
    setLines(prev => {
      const ex = prev.find(l => l.product.id === product.id);
      if (ex) return prev.map(l => l.product.id === product.id ? { ...l, qty: l.qty + 1 } : l);
      return [...prev, { product, productId: String(product.id), qty: 0, sellingPrice: 0, unit: product.productUnitName ?? 'Unit' }];
    });
    setShowProducts(false);
    setSearch('');
  }, [canEdit]);

  const handleQtyInput = (productId: string, value: string) => {
    if (!canEdit) return;
    setTempQuantities(prev => ({ ...prev, [productId]: value }));
  };

  const handleQtyBlur = (productId: string) => {
    if (!canEdit) return;
    const tmp = tempQuantities[productId];
    if (tmp === undefined) return;
    setTempQuantities(prev => { const n = { ...prev }; delete n[productId]; return n; });
    const n = parseInt(tmp, 10);
    if (!tmp || isNaN(n) || n <= 0) setLines(prev => prev.filter(l => l.product.id !== productId));
    else setLines(prev => prev.map(l => l.product.id === productId ? { ...l, qty: n } : l));
  };

  // ── Price IS editable for the salesman — it varies per customer.
  // Staged in tempPrices while typing (same pattern as quantity) so a decimal
  // point or trailing zero isn't stripped mid-keystroke by the controlled input. ──
  const handlePriceInput = (productId: string, value: string) => {
    if (!canEdit) return;
    setTempPrices(prev => ({ ...prev, [productId]: value }));
  };

  const handlePriceBlur = (productId: string) => {
    if (!canEdit) return;
    const tmp = tempPrices[productId];
    if (tmp === undefined) return;
    setTempPrices(prev => { const n = { ...prev }; delete n[productId]; return n; });
    const n = parseFloat(tmp);
    // Invalid/empty entry — leave the price as it was rather than zeroing it out.
    if (tmp === '' || isNaN(n) || n < 0) return;
    setLines(prev => prev.map(l => l.product.id === productId ? { ...l, sellingPrice: n } : l));
  };

  const getDisplayPrice = (productId: string, price: number) => {
    const tmp = tempPrices[productId];
    return tmp !== undefined ? tmp : price === 0 ? '' : String(price);
  };

  // ── RESTORED: reads the live typed price (before blur commits it to `lines`)
  // so the variance badge and save-validation react immediately as the
  // salesman types, not only after they tab/click away from the field. Falls
  // back to the committed sellingPrice when nothing's actively being typed. ──
  const getEffectivePrice = (productId: string, committedPrice: number): number => {
    const tmp = tempPrices[productId];
    if (tmp !== undefined) {
      const n = parseFloat(tmp);
      if (!isNaN(n) && n >= 0) return n;
    }
    return committedPrice;
  };

  // ── RESTORED: selling price must stay within ±10% of base price. Returns
  // true when it's outside that band — used both to show the warning badge
  // and to block Save until it's corrected. ──
  const getPriceRangeIssue = (base: number, selling: number): boolean => {
    if (!base || !selling) return false;
    const lower = base * 0.9;
    const upper = base * 1.1;
    return selling < lower || selling > upper;
  };

  const removeItem = (productId: string) => {
    if (!canEdit) return;
    setLines(prev => prev.filter(l => l.product.id !== productId));
    setTempQuantities(prev => { const n = { ...prev }; delete n[productId]; return n; });
    setTempPrices(prev => { const n = { ...prev }; delete n[productId]; return n; });
  };

  const getDisplayQty = (productId: string, qty: number) => {
    const tmp = tempQuantities[productId];
    return tmp !== undefined ? tmp : qty === 0 ? '' : String(qty);
  };

  const buildPayload = (): CreateOrderCommand => ({
  customerId:      String(customerId),
  routeId:         String(routeId),
  orderDate:       new Date().toISOString(),
  items:           lines.map(l => ({ 
    productId: l.product.id, 
    quantity: l.qty, 
    unitId: l.product.productUnitId, 
    sellingPrice: l.sellingPrice 
  })),
  executionId:     executionContext?.executionId,
  customerVisitId: executionContext?.customerVisitId,
  ...(remarks ? { remarks } : {}),
});
  const handleSave = async () => {
  if (!canEdit) { 
    setError('Cannot edit this order.'); 
    return; 
  }
  
  if (lines.length === 0 && !remarks.trim()) { 
    setError('Add at least one product or retail remark.'); 
    return; 
  }
  
  const incomplete = lines.find(l => !l.qty || !l.sellingPrice);
  if (incomplete) {
    setError(`Enter quantity and price for "${incomplete.product.nameEnglish}" before saving.`);
    return;
  }

  // ── RESTORED: block save if any line's price is outside ±10% of its
  // product's base price. Checked against the EFFECTIVE price (live typed
  // value if present) so a field still mid-edit but out of range is caught
  // too, not just already-blurred/committed values. ──
  const outOfRange = lines.find(l =>
    getPriceRangeIssue(l.product.basePrice, getEffectivePrice(l.product.id, l.sellingPrice))
  );
  if (outOfRange) {
    const base = outOfRange.product.basePrice;
    setError(
      `Price for "${outOfRange.product.nameEnglish}" must be within ±10% of the base price ` +
      `(₹${(base * 0.9).toFixed(2)} – ₹${(base * 1.1).toFixed(2)}).`
    );
    return;
  }
  
  setSaving(true); 
  setError(''); 
  setSuccessMsg('');
  
  try {
    let result;
    const payload = buildPayload();
    
    if (existingOrder) {
      result = await ordersApi.update(existingOrder.id, { id: existingOrder.id, ...payload });
      setSuccessMsg('Order updated!');
    } else {
      result = await ordersApi.create(payload);
      setSuccessMsg('Saved as draft!');
    }
    
    setExistingOrder(result);
    
    // ── SCROLL TO TOP (Multiple methods to ensure it works) ──
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : 'Save failed');
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  } finally { 
    setSaving(false); 
  }
};

  // ── FIX: Cancel/Delete Order — redirect back to Route Execution ──
  const handleCancelOrder = async () => {
    if (!existingOrder) return;
    setDeleting(true);
    setError('');
    try {
      await ordersApi.delete(String(existingOrder.id));
      setSuccessMsg('Order cancelled successfully! You can now take a new order.');
      
      // ── FIX: Navigate back to Route Execution page ──
      // If we have execution context, go back to the execute page
      // Otherwise go back one step (which should be the route execution page)
      setTimeout(() => {
        if (executionContext?.executionId) {
          navigate(`/salesman/routes/${routeId}/execute`, { 
            state: { mode: 'order-taking' } 
          });
        } else {
          navigate(-1); // Fallback to previous page
        }
      }, 1500);
      
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to cancel order');
    } finally {
      setDeleting(false);
      setShowCancelConfirm(false);
    }
  };

  const copyFromPrevious = (order: CustomerOrderHistoryDto) => {
    if (!canEdit) return;
    const mapped: LineItem[] = order.items.map(item => {
      const prod = allProducts.find((pp: any) => String(pp.id) === String(item.productId));
      if (!prod) return null;
      const up = unitPrices[prod.id];
      return { product: prod, productId: String(prod.id), qty: item.quantity, sellingPrice: item.sellingPrice || (up?.salePrice ?? prod.basePrice), unit: prod.productUnitName ?? 'Unit' };
    }).filter(Boolean) as LineItem[];

    // Also copy remarks if present
    if (order.remarks) {
      setRemarks(order.remarks);
    }

    setLines(mapped);
    setShowPreviousModal(false);
    setSuccessMsg('Previous order loaded. Tap Save Draft to keep it.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: D.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner size={40} />
    </div>
  );

  const orderStatus = existingOrder?.status;

  return (
    <div style={{
      minHeight: '100vh',
      background: D.bg,
      color: D.text,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        background: D.bg,
        borderBottom: `1px solid ${D.border}`,
        flexShrink: 0,
        padding: '4px 10px 8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => navigate(-1)}
            style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(255,255,255,0.06)', border: `1px solid ${D.border}`, borderRadius: 6, padding: '3px 8px', color: D.muted, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <ArrowLeft size={12} /> Back
          </button>
          <div style={{ display: 'flex', gap: 3 }}>
            {previousOrders.length > 0 && canEdit && (
              <button
                onClick={() => setShowPreviousModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#312e81', border: '1px solid #4338ca', borderRadius: 6, padding: '3px 7px', color: '#a5b4fc', fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <ChevronLeft size={10} /><ChevronRight size={10} /> Prev
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => setShowCancelConfirm(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, padding: '3px 8px', color: '#ef4444', fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <Trash size={11} /> Cancel
              </button>
            )}
          </div>
        </div>

        <div style={{ marginTop: 4, padding: '6px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <h1 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: D.text }}>{customer?.nameEnglish}</h1>
          {customer?.nameMalayalam && <p style={{ margin: '1px 0 0', fontSize: 10, color: D.muted }} lang="ml">{customer.nameMalayalam}</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
            {customer?.phoneNumber && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', fontSize: 9, fontWeight: 700, color: D.text }}>
                <Phone size={9} color={D.accent} /> {customer.phoneNumber}
              </span>
            )}
            {customer?.address && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', fontSize: 9, fontWeight: 700, color: D.text }}>
                <MapPin size={9} color={D.accent} /> {customer.address}
              </span>
            )}
          </div>
          <div style={{ marginTop: 3 }}>
            {!existingOrder && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '1px 6px', background: '#422006', border: '1px solid #92400e', borderRadius: 12, fontSize: 8, fontWeight: 700, color: '#fb923c' }}><Edit3 size={8} /> New</span>}
            {orderStatus === OrderStatus.Draft && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '1px 6px', background: '#422006', border: '1px solid #92400e', borderRadius: 12, fontSize: 8, fontWeight: 700, color: '#fb923c' }}><Edit3 size={8} /> Draft</span>}
            {orderStatus === OrderStatus.Approved && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '1px 6px', background: '#14532d', border: '1px solid #16a34a', borderRadius: 12, fontSize: 8, fontWeight: 700, color: '#86efac' }}><CheckCircle2 size={8} /> Approved</span>}
            {orderStatus === OrderStatus.Closed && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '1px 6px', background: '#0c4a6e', border: '1px solid #0284c7', borderRadius: 12, fontSize: 8, fontWeight: 700, color: '#7dd3fc' }}><Lock size={8} /> Closed</span>}
          </div>
        </div>
      </div>

      {/* ── SCROLLABLE CONTENT ── */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '10px 16px',
        /* ── FIX: Large bottom padding to clear both Save button AND mobile nav ── */
        paddingBottom: isMobile 
          ? 'calc(130px + env(safe-area-inset-bottom, 0px) + ' + MOBILE_NAV_HEIGHT + 'px)' 
          : '130px',
      }}>

        {/* Alerts */}
        {error && (
          <div style={{ marginBottom: 10, padding: '10px 14px', background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.30)', borderRadius: 10, color: '#fca5a5', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
            <span>{error}</span>
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>✕</button>
          </div>
        )}
        {successMsg && (
          <div style={{ marginBottom: 10, padding: '10px 14px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.30)', borderRadius: 10, color: '#86efac', fontSize: 13, fontWeight: 700 }}>
            ✓ {successMsg}
          </div>
        )}
        {!canEdit && (
          <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.30)', borderRadius: 10, color: '#93c5fd', fontSize: 13, textAlign: 'center' }}>
            <Lock size={14} style={{ display: 'inline', marginRight: 5 }} />
            {orderStatus === OrderStatus.Closed ? 'Closed — no edits allowed.' : 'Submitted — waiting for admin approval.'}
          </div>
        )}

        {/* ── Empty state ── */}
        {lines.length === 0 && canEdit && (
          <div style={{ textAlign: 'center', padding: '32px 20px', background: D.card, border: `2px dashed ${D.border}`, borderRadius: 12, marginBottom: 12 }}>
            <Package size={40} color={D.border} style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: D.muted, margin: '0 0 4px' }}>No items in this order</p>
            <p style={{ fontSize: 12, color: D.sub, margin: 0 }}>Tap "Add Products" below to get started</p>
            {hasExistingOrder && isDraft && (
              <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', borderRadius: 8 }}>
                <p style={{ fontSize: 12, color: '#ef4444', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <AlertTriangle size={14} />
                  This order has no items. You can cancel it using the "Cancel Order" button above.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Item cards ── */}
        {lines.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: D.sub, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Items ({lines.length})
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lines.map((line, idx) => (
                <div
                  key={line.product.id}
                  ref={idx === lines.length - 1 ? lastItemRef : undefined}
                  style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 12, padding: '12px 14px' }}
                >
                  {/* Product name row */}
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: D.text }}>{line.product.nameEnglish}</p>
                    {line.product.nameMalayalam && (
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: D.muted }} lang="ml">{line.product.nameMalayalam}</p>
                    )}
                    {/* ── RESTORED: variance badge, driven by the live-typed effective
                    price so it updates as the salesman types, before blur commits it. ── */}
                    <PriceVarianceBadge
                      base={line.product.basePrice}
                      selling={getEffectivePrice(line.product.id, line.sellingPrice)}
                    />
                  </div>

                  {/* Fields row */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <div style={{ width: 110, flexShrink: 0, minWidth: 0 }}>
                      <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: D.sub, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Item Code</p>
                      <div style={{
                        padding: '8px 8px', borderRadius: 8, border: `1px solid ${D.border}`,
                        background: D.bg, fontSize: 13, fontWeight: 800, color: D.text,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {line.product.itemCode || '—'}
                      </div>
                    </div>

                    <div style={{ width: 56, flexShrink: 0 }}>
                      <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: D.sub, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Qty</p>
                      <input
                        type="text" inputMode="numeric"
                        value={getDisplayQty(line.product.id, line.qty)}
                        onChange={e => handleQtyInput(line.product.id, e.target.value)}
                        onBlur={() => handleQtyBlur(line.product.id)}
                        disabled={!canEdit}
                        style={{ width: '100%', textAlign: 'center', padding: '8px 4px', border: `1px solid ${D.border}`, borderRadius: 8, fontSize: 14, fontWeight: 800, background: canEdit ? D.card2 : D.bg, color: D.text, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div style={{ width: 76, flexShrink: 0 }}>
                      <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: D.sub, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Price ₹</p>
                      <input
                        type="text" inputMode="decimal"
                        value={getDisplayPrice(line.product.id, line.sellingPrice)}
                        onChange={e => handlePriceInput(line.product.id, e.target.value)}
                        onBlur={() => handlePriceBlur(line.product.id)}
                        disabled={!canEdit}
                        style={{ width: '100%', textAlign: 'center', padding: '8px 4px', border: `1px solid ${D.border}`, borderRadius: 8, fontSize: 14, fontWeight: 800, background: canEdit ? D.card2 : D.bg, color: D.text, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>

                    {canEdit && (
                      <button
                        onClick={() => removeItem(line.product.id)}
                        style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 8, color: '#f87171', cursor: 'pointer', padding: '8px 9px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ADD PRODUCTS - LARGE FLOATING PLUS BUTTON ── */}
        {canEdit && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            margin: lines.length > 0 ? '12px 0 16px' : '0 0 16px',
          }}>
            <button
              onClick={() => setShowProducts(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: `linear-gradient(135deg, #2563eb, #1d4ed8)`,
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: '0 4px 20px rgba(37,99,235,0.45)',
                touchAction: 'manipulation',
                transition: 'all 0.2s ease',
                fontSize: 36,
                fontWeight: 300,
                lineHeight: 1,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1.08)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 28px rgba(37,99,235,0.55)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(37,99,235,0.45)';
              }}
              onTouchStart={e => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(0.92)';
              }}
              onTouchEnd={e => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
              }}
            >
              +
            </button>

            <span style={{
              marginTop: 6,
              fontSize: 10,
              fontWeight: 600,
              color: '#94a3b8',
              letterSpacing: '0.04em',
            }}>
              ADD ITEMS
            </span>
          </div>
        )}

        {/* Retail remarks */}
        <div style={{ marginBottom: 10 }}>
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: D.sub, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🛍 Retail Items / Remarks
          </p>
          <textarea
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            disabled={!canEdit}
            placeholder="Enter retail items or remarks here..."
            rows={3}
            style={{ width: '100%', padding: '10px 12px', background: D.card, border: `1px solid ${D.border}`, borderRadius: 10, fontSize: 14, color: D.text, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
          />
        </div>
      </div>

      {/* ── Save Draft sticky bottom bar ── */}
      {canEdit && (lines.length > 0 || remarks.trim()) && (
        <div style={{
          position: 'fixed', 
          // ── Shifts up automatically when the "Acting as a salesman" banner is
          // showing (see ReturnToAdminBanner in App.tsx), instead of sitting at a
          // hardcoded bottom:0 and getting painted over by that banner. ──
          bottom: 'var(--acting-banner-h, 0px)', 
          left: 0, 
          right: 0, 
          zIndex: 45,
          background: D.bg, 
          borderTop: `1px solid ${D.border}`,
          padding: '10px 14px',
          /* ── FIX: Add bottom padding for mobile nav ── */
          paddingBottom: isMobile 
            ? 'calc(10px + env(safe-area-inset-bottom, 0px) + ' + MOBILE_NAV_HEIGHT + 'px)' 
            : '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '11px 32px',
              background: saving ? D.card : 'linear-gradient(135deg,#1e3a8a,#2563eb)',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 800,
              color: '#fff',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              boxShadow: saving ? 'none' : '0 4px 14px rgba(37,99,235,0.35)',
              touchAction: 'manipulation',
            }}
          >
            {saving ? <Spinner size={15} /> : <Save size={15} />}
            {saving ? 'Saving...' : hasExistingOrder ? 'Update Order' : 'Save as Draft'}
          </button>
        </div>
      )}

      {/* ── Product picker bottom sheet ── */}
      {showProducts && canEdit && (
        <>
          <div onClick={() => setShowProducts(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 60 }} />
          <div style={{
            position: 'fixed', bottom: 'var(--acting-banner-h, 0px)', left: 0, right: 0, zIndex: 70,
            background: D.card, borderRadius: '20px 20px 0 0',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.40)',
            display: 'flex', flexDirection: 'column',
            height: '85vh',
            maxHeight: '85vh',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: D.border }} />
            </div>
            <div style={{ padding: '4px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: D.text }}>Add Products</h2>
              <button onClick={() => setShowProducts(false)} style={{ background: D.bg, border: `1px solid ${D.border}`, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: D.muted }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '0 14px 8px', flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: D.sub, pointerEvents: 'none' }} />
                <input
                  ref={searchInputRef}
                  type="text" placeholder="Search products..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px 9px 32px', background: D.bg, border: `1px solid ${D.border}`, borderRadius: 9, fontSize: 14, color: D.text, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 11, color: D.sub }}>
                {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 16px' }}>
              {filteredProducts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 20px' }}>
                  <Package size={40} color={D.border} style={{ marginBottom: 8 }} />
                  <p style={{ color: D.sub, fontSize: 13 }}>
                    {search ? 'No products match your search' : 'No products available'}
                  </p>
                </div>
              ) : (
                filteredProducts.map((product: any) => {
                  const isInBill  = lines.some(l => l.product.id === product.id);
                  const billQty   = lines.find(l => l.product.id === product.id)?.qty ?? 0;
                  // ── NEW: Out of Stock — faded, disabled, can't add a new one. An item
                  // already sitting in this draft bill from before it went out of stock
                  // is left alone (that's handled elsewhere, not by this picker button). ──
                  const outOfStock = !!product.isOutOfStock;

                  return (
                    <button
                      key={product.id}
                      onClick={() => { if (!outOfStock) addProduct(product); }}
                      disabled={outOfStock}
                      style={{
                        width: '100%', textAlign: 'left',
                        padding: '13px 14px', marginBottom: 6, borderRadius: 10,
                        background: outOfStock ? '#f8fafc' : (isInBill ? '#f0fdf4' : '#ffffff'),
                        border: `1px solid ${outOfStock ? '#e2e8f0' : (isInBill ? 'rgba(34,197,94,0.35)' : '#e2e8f0')}`,
                        cursor: outOfStock ? 'not-allowed' : 'pointer',
                        opacity: outOfStock ? 0.5 : 1,
                        fontFamily: 'inherit',
                        display: 'block',
                        touchAction: 'manipulation',
                      }}
                    >
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#000000', fontFamily: "'Calibri', 'Segoe UI', sans-serif" }}>{product.nameEnglish}</p>
                      {product.nameMalayalam && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#334155', fontFamily: "'Calibri', 'Segoe UI', sans-serif" }} lang="ml">{product.nameMalayalam}</p>}
                      {outOfStock ? (
                        <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10, padding: '2px 7px', borderRadius: 8, background: 'rgba(239,68,68,0.15)', color: '#b91c1c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                          Out of Stock
                        </span>
                      ) : isInBill && (
                        <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10, padding: '2px 7px', borderRadius: 8, background: 'rgba(34,197,94,0.15)', color: '#15803d', fontWeight: 700 }}>
                          {billQty} in bill
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
            <div style={{ padding: '10px 14px', background: D.bg, borderTop: `1px solid ${D.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: D.sub }}>{lines.length} item{lines.length !== 1 ? 's' : ''} in bill</span>
              <button
                onClick={() => setShowProducts(false)}
                style={{ padding: '9px 18px', background: D.accent, border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 800, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', touchAction: 'manipulation' }}
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}

      <PreviousOrdersModal
        isOpen={showPreviousModal}
        onClose={() => setShowPreviousModal(false)}
        previousOrders={previousOrders}
        onUseOrder={copyFromPrevious}
      />

      {/* ── Cancel Confirmation Modal ── */}
      {showCancelConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: D.card, borderRadius: 16, maxWidth: 400, width: '100%', padding: 24, border: `1px solid ${D.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={20} color="#ef4444" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: D.text }}>Cancel Order?</h3>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: D.muted }}>
                  This will permanently delete this draft order.
                </p>
              </div>
            </div>
            <p style={{ fontSize: 14, color: D.muted, lineHeight: 1.6, marginBottom: 20 }}>
              This action cannot be undone. The order will be permanently deleted.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCancelConfirm(false)}
                style={{ padding: '10px 20px', borderRadius: 8, background: D.bg, border: `1px solid ${D.border}`, color: D.muted, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Keep Order
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={deleting}
                style={{ padding: '10px 20px', borderRadius: 8, background: '#ef4444', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {deleting ? <Spinner size={16} /> : <Trash size={16} />}
                {deleting ? 'Deleting...' : 'Yes, Cancel Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}