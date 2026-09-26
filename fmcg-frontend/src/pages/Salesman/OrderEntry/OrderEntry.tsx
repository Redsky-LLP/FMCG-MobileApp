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
// 12. RESTORED: Price Variance Badge + ±10% range validation
// 13. NEW: Product picker is now search-first
// 14. FIX: SAVE RACE — the manual Save button and the autosave timer could
//     previously both fire near-simultaneously (e.g. tapping "Update Order"
//     right as autosave's debounce fired), each independently deciding
//     existingOrder was still null and each calling ordersApi.create() —
//     producing TWO separate Order rows for the same customer visit, each
//     holding a different subset of the same items. Downstream, every
//     report that merges a customer's orders for the day (Billing Sheet,
//     Loading Sheet, Retail Sheet) then correctly summed quantities/remarks
//     across BOTH orders — which is why it looked like quantities were
//     "doubled" and retail remarks were "duplicated": the merge logic was
//     working correctly on genuinely duplicated input. The old
//     autosaving/pendingAutosaveRetryRef flags only prevented two AUTOSAVES
//     from overlapping each other — they did nothing to stop a manual save
//     from landing mid-autosave. Every save (autosave or manual) now goes
//     through ONE shared FIFO queue (enqueueSave), so at most one save
//     request is ever in flight at a time, strictly ordered, regardless of
//     which trigger fired it. This is also what was producing the "Save
//     conflict. Please refresh the page and try again." toast — two
//     concurrent UPDATEs to the same order's item list racing on which rows
//     to add/remove.

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
import { MOBILE_NAV_HEIGHT } from '../../../components/layout/MobileLayout';

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
  const lastItemRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ── Autosave state ──
  const [autosaving,     setAutosaving]     = useState(false);
  const [lastAutosavedAt, setLastAutosavedAt] = useState<Date | null>(null);
  const autosaveTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextAutosaveRef = useRef(true); // true until the initial data load finishes

  // ── FIX: single shared save queue. Every call to enqueueSave() — whether
  // from performAutosave or handleSave — is chained onto whatever save is
  // currently in flight, so it only starts once the previous one has fully
  // resolved (success or failure). This is what makes it structurally
  // impossible for two save requests to be in flight for this order at the
  // same time, regardless of which one (auto or manual) triggered each.
  // The queue itself never rejects (a failed task's error is caught and
  // re-thrown to ITS OWN caller only, via the returned promise), so one
  // failed save can never permanently jam every save after it. ──
  const saveQueueRef = useRef<Promise<any>>(Promise.resolve());
  function enqueueSave<T>(task: () => Promise<T>): Promise<T> {
    const runningAfterPrevious = saveQueueRef.current.then(task, task);
    // Keep the queue alive even if this task fails — swallow here so a
    // failure doesn't propagate into the NEXT queued task's chain; the
    // failure still reaches this call's own caller via the returned promise.
    saveQueueRef.current = runningAfterPrevious.then(
      () => undefined,
      () => undefined,
    );
    return runningAfterPrevious;
  }

  const hasExistingOrder = !!existingOrder;
  const isDraft = existingOrder?.status === OrderStatus.Draft;
  const canEdit = !existingOrder || existingOrder.status === OrderStatus.Draft;
  const totalItems  = lines.reduce((s, l) => s + l.qty, 0);
  const hasNoItems = lines.length === 0 && !remarks.trim();
  const canCancel = isDraft && hasExistingOrder;

  useEffect(() => {
    if (!routeId || !customerId) return;
    const cid = String(customerId);

    Promise.all([
      customersApi.getById(cid),
      productsApi.list({ isActive: true }),
      productsApi.getDefaultUnitPrices().catch(() => []),
      ordersApi.listByRoute(routeId).catch(() => []),
    ])
      .then(async ([c, p, defaults, allOrders]) => {
        setCustomer(c);
        setAllProducts(p);
        setFilteredProducts(p);

        const priceMap: Record<string, ProductUnitPriceDto> = {};
        for (const def of defaults) {
          priceMap[def.productId] = def;
        }
        setUnitPrices(priceMap);

        const existing  = allOrders
          .filter(o => String(o.customerId) === cid && o.status !== 'Closed' && !o.isLocked)
          .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())[0];

        if (existing) {
          try {
            const detail = await ordersApi.getById(existing.id);
            setExistingOrder(detail);
            setRemarks(detail.remarks ?? '');
            const mapped: LineItem[] = (detail.items ?? []).map((item: any) => {
              const prod = p.find((pp: any) => String(pp.id) === String(item.productId));
              if (!prod) return null;
              const up = priceMap[prod.id];
              return {
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
          } catch {}
        }

        try {
          const history = await ordersApi.getCustomerHistory(cid, 10);
          if (history?.length) setPreviousOrders(history);
        } catch {}
      })
      .catch(() => setError('Failed to load data. Please refresh.'))
      .finally(() => {
        setLoading(false);
        skipNextAutosaveRef.current = true;
        setTimeout(() => { skipNextAutosaveRef.current = false; }, 0);
      });
  }, [customerId, routeId]);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredProducts([]);
      return;
    }
    const q = search.toLowerCase();
    const filtered = allProducts.filter((p: any) =>
      p.nameEnglish?.toLowerCase().includes(q) ||
      p.nameMalayalam?.toLowerCase().includes(q) ||
      p.itemCode?.toLowerCase().includes(q)
    );
    setFilteredProducts(filtered);
  }, [search, allProducts]);

  useEffect(() => {
    if (showProducts && searchInputRef.current) searchInputRef.current.focus();
  }, [showProducts]);

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
    if (tmp === '' || isNaN(n) || n < 0) return;
    setLines(prev => prev.map(l => l.product.id === productId ? { ...l, sellingPrice: n } : l));
  };

  const getDisplayPrice = (productId: string, price: number) => {
    const tmp = tempPrices[productId];
    return tmp !== undefined ? tmp : price === 0 ? '' : String(price);
  };

  const getEffectivePrice = (productId: string, committedPrice: number): number => {
    const tmp = tempPrices[productId];
    if (tmp !== undefined) {
      const n = parseFloat(tmp);
      if (!isNaN(n) && n >= 0) return n;
    }
    return committedPrice;
  };

  const getEffectiveQty = (productId: string, committedQty: number): number => {
    const tmp = tempQuantities[productId];
    if (tmp !== undefined) {
      const n = parseInt(tmp, 10);
      if (!isNaN(n) && n >= 0) return n;
    }
    return committedQty;
  };

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

  function scrollEverythingToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    let el: HTMLElement | null = scrollContainerRef.current;
    while (el) {
      if (el.scrollHeight > el.clientHeight) {
        el.scrollTo({ top: 0, behavior: 'smooth' });
      }
      el = el.parentElement;
    }
  }

  const buildPayload = (): CreateOrderCommand => ({
    customerId:      String(customerId),
    routeId:         String(routeId),
    orderDate:       new Date().toISOString(),
    items:           lines.map(l => ({
      productId: l.product.id,
      quantity: getEffectiveQty(l.product.id, l.qty),
      unitId: l.product.productUnitId,
      sellingPrice: getEffectivePrice(l.product.id, l.sellingPrice)
    })),
    executionId:     executionContext?.executionId,
    customerVisitId: executionContext?.customerVisitId,
    ...(remarks ? { remarks } : {}),
  });

  // ── FIX: the actual network call, with no state side-effects other than
  // returning the result or throwing — this is the single "unit of work"
  // enqueueSave serializes. IMPORTANT: it reads `existingOrder` at the
  // moment it actually RUNS (inside the queue), not at the moment it was
  // scheduled — so if an earlier queued save just created the order, a
  // later queued save correctly sees it as an update, never a second create. ──
  // ── FIX: doSave must always check the CURRENT existingOrder, not a value
  // captured in a stale closure. Without this, two Save clicks fired within
  // the same render tick — e.g. a double-tap on a touchscreen, where both
  // click events can land before React commits the button's `disabled`
  // state — would both close over the SAME stale `existingOrder` (null, if
  // this is the first save). Even with the queue correctly running them one
  // after another, the second task would still see the stale null and
  // incorrectly call create() a second time. This ref is kept in sync with
  // the existingOrder state and read at the moment each queued task
  // actually EXECUTES, so a save that runs after an earlier one has
  // already completed and updated existingOrder correctly sees it as an
  // update, never a duplicate create — this is what closed the near-
  // instant (sub-millisecond to low-millisecond) duplicate orders found in
  // production, which were too fast to be the autosave/manual-save timing
  // race and were actually double-fired Save clicks. ──
  const existingOrderRef = useRef(existingOrder);
  useEffect(() => { existingOrderRef.current = existingOrder; }, [existingOrder]);

  async function doSave(payload: CreateOrderCommand) {
    const current = existingOrderRef.current;
    if (current) {
      return await ordersApi.update(current.id, { id: current.id, ...payload });
    }
    return await ordersApi.create(payload);
  }

  // ── Silent autosave worker — same completeness rules as the manual Save
  // button, but no toast, no scroll, no navigation. Deliberately does NOT
  // check the ±10% price-range rule (that's a submission-time business
  // rule enforced in handleSave, not a data-loss concern — see the
  // reasoning kept from the earlier fix). Every save request — this one or
  // a manual one — goes through enqueueSave, so it can never overlap with
  // another save in flight. ──
  const performAutosave = async () => {
    if (!canEdit || saving) return;
    if (lines.length === 0 && !remarks.trim()) return;

    const incomplete = lines.some(l =>
      !getEffectiveQty(l.product.id, l.qty) || !getEffectivePrice(l.product.id, l.sellingPrice)
    );
    if (incomplete) return;

    setAutosaving(true);
    try {
      const payload = buildPayload();
      const result = await enqueueSave(() => doSave(payload));
      setExistingOrder(result);
      setLastAutosavedAt(new Date());
    } catch {
      // Silent — a failed autosave isn't worth interrupting the salesman
      // over; the next debounce cycle (or the manual Save button) will
      // retry, and manual Save still surfaces real errors normally.
    } finally {
      setAutosaving(false);
    }
  };

  // Debounced: waits for a pause in editing before autosaving.
  useEffect(() => {
    if (skipNextAutosaveRef.current) return;
    if (!canEdit) return;

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      performAutosave();
    }, 800);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, remarks, tempQuantities, tempPrices]);

  // ── FIX: synchronous guard against handleSave being invoked twice in the
  // same event-loop tick — the actual double-tap scenario. setSaving(true)
  // alone isn't enough to stop this: React state updates aren't applied
  // synchronously, so the button's `disabled` attribute doesn't visually
  // update until AFTER the current tick finishes, meaning two click events
  // dispatched back-to-back (a fast double-tap) can both start running
  // handleSave before either one sees `saving` as true. A plain ref,
  // checked and set synchronously, closes that gap immediately — the
  // second click returns instantly instead of ever reaching the save
  // logic at all. (The queue + live-ref fixes above are what protect
  // against the SLOWER race — autosave overlapping a manual save — which
  // this synchronous guard doesn't cover since a real 800ms-apart autosave
  // and click aren't in the same tick.) ──
  const saveClickInFlightRef = useRef(false);

  const handleSave = async () => {
    if (saveClickInFlightRef.current) return;
    saveClickInFlightRef.current = true;
    try {
      await handleSaveInner();
    } finally {
      saveClickInFlightRef.current = false;
    }
  };

  const handleSaveInner = async () => {
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

    // ── ±10% price-range check — manual Save only, same as before. ──
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
      const payload = buildPayload();
      // ── FIX: routed through the SAME queue as autosave. If an autosave is
      // currently in flight, this save simply waits its turn in line instead
      // of firing a second, independent request — this is what closes the
      // duplicate-order/"Save conflict" race. ──
      const result = await enqueueSave(() => doSave(payload));

      setExistingOrder(result);
      setSuccessMsg(hasExistingOrder ? 'Order updated!' : 'Saved as draft!');
      scrollEverythingToTop();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
      scrollEverythingToTop();
    } finally {
      setSaving(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!existingOrder) return;
    setDeleting(true);
    setError('');
    try {
      await ordersApi.delete(String(existingOrder.id));
      setSuccessMsg('Order cancelled successfully! You can now take a new order.');

      setTimeout(() => {
        if (executionContext?.executionId) {
          navigate(`/salesman/routes/${routeId}/execute`, {
            state: { mode: 'order-taking' }
          });
        } else {
          navigate(-1);
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

      <div ref={scrollContainerRef} style={{
        padding: '10px 16px',
        paddingBottom: isMobile
          ? 'calc(130px + env(safe-area-inset-bottom, 0px) + ' + MOBILE_NAV_HEIGHT + 'px)'
          : '130px',
      }}>

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
        {canEdit && (autosaving || lastAutosavedAt) && (
          <div style={{ marginBottom: 8, fontSize: 11, color: D.sub, display: 'flex', alignItems: 'center', gap: 5 }}>
            {autosaving ? (
              <>
                <Spinner size={10} />
                Saving…
              </>
            ) : (
              <>
                <CheckCircle2 size={11} color={D.sub} />
                Auto-saved {lastAutosavedAt!.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </>
            )}
          </div>
        )}
        {!canEdit && (
          <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.30)', borderRadius: 10, color: '#93c5fd', fontSize: 13, textAlign: 'center' }}>
            <Lock size={14} style={{ display: 'inline', marginRight: 5 }} />
            {orderStatus === OrderStatus.Closed ? 'Closed — no edits allowed.' : 'Submitted — waiting for admin approval.'}
          </div>
        )}

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
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: D.text }}>{line.product.nameEnglish}</p>
                    {line.product.nameMalayalam && (
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: D.muted }} lang="ml">{line.product.nameMalayalam}</p>
                    )}
                    <PriceVarianceBadge
                      base={line.product.basePrice}
                      selling={getEffectivePrice(line.product.id, line.sellingPrice)}
                    />
                  </div>

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

        {canEdit && !showProducts && (
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
            </span>
          </div>
        )}

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

      {canEdit && (lines.length > 0 || remarks.trim()) && (
        <div style={{
          position: 'fixed',
          bottom: 'var(--acting-banner-h, 0px)',
          left: 0,
          right: 0,
          zIndex: 45,
          background: D.bg,
          borderTop: `1px solid ${D.border}`,
          padding: '10px 14px',
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
              {search.trim() && (
                <p style={{ margin: '6px 0 0', fontSize: 11, color: D.sub }}>
                  {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 16px' }}>
              {!search.trim() ? (
                <div style={{ textAlign: 'center', padding: '32px 20px' }}>
                  <Search size={40} color={D.border} style={{ marginBottom: 8 }} />
                  <p style={{ color: D.sub, fontSize: 13 }}>
                    Start typing to search products
                  </p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 20px' }}>
                  <Package size={40} color={D.border} style={{ marginBottom: 8 }} />
                  <p style={{ color: D.sub, fontSize: 13 }}>
                    No products match your search
                  </p>
                </div>
              ) : (
                filteredProducts.map((product: any) => {
                  const isInBill  = lines.some(l => l.product.id === product.id);
                  const billQty   = lines.find(l => l.product.id === product.id)?.qty ?? 0;
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