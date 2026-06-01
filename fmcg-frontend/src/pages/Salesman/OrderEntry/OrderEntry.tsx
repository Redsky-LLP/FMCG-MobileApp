// PATH: src/pages/Salesman/OrderEntry/OrderEntry.tsx
// Updated with cleaner layout and per-unit pricing support

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Package, Printer, Edit3, Lock, Plus, Save, ChevronLeft, ChevronRight, ShoppingCart, X, CalendarDays } from 'lucide-react';
import { customersApi, ordersApi, productsApi } from '../../../api/services';
import { OrderStatus, fmtNum, CustomerOrderHistoryDto, CreateOrderCommand, ProductUnitPriceDto } from '../../../types';
import { Spinner } from '../../../components/ui';
import { useAuthStore } from '../../../store/authStore';
import { LineItem } from './types';
import { ProductSidebar } from './components/ProductSidebar';
import { WholesaleItemsTable } from './components/WholesaleItemsTable';
import { RetailItemsSection } from './components/RetailItemsSection';
import { OrderSummary } from './components/OrderSummary';
import { PreviousOrdersModal } from './components/PreviousOrdersModal';

export default function OrderEntry() {
  const { routeId, customerId } = useParams<{ routeId: string; customerId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const executionContext = location.state as { executionId?: string; customerVisitId?: string; } | null;

  const [customer, setCustomer] = useState<any>(null);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [existingOrder, setExistingOrder] = useState<any>(null);
  const [lines, setLines] = useState<LineItem[]>([]);
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [previousOrders, setPreviousOrders] = useState<CustomerOrderHistoryDto[]>([]);
  const [showPreviousModal, setShowPreviousModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [tempQuantities, setTempQuantities] = useState<Record<string, string>>({});
  const [unitPrices, setUnitPrices] = useState<Record<string, ProductUnitPriceDto>>({});
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();

  const isClosed = existingOrder?.status === OrderStatus.Closed;
  const canEdit = !existingOrder || existingOrder.status === OrderStatus.Draft;
  const totalAmount = lines.reduce((s, l) => s + l.qty * l.sellingPrice, 0);
  const totalItems = lines.reduce((s, l) => s + l.qty, 0);

  useEffect(() => {
    if (!routeId || routeId.length < 30) setError('Invalid route. Please go back.');
    if (!customerId) setError('Invalid customer. Please go back.');
  }, [routeId, customerId]);

  // Load unit prices for products
  const loadUnitPrices = useCallback(async (products: any[]) => {
    const priceMap: Record<string, ProductUnitPriceDto> = {};
    for (const product of products) {
      try {
        const prices = await productsApi.getUnitPrices(product.id);
        const defaultPrice = prices.find(p => p.isDefault) || prices[0];
        if (defaultPrice) {
          priceMap[product.id] = defaultPrice;
        }
      } catch {
        // No unit prices configured, use base price
      }
    }
    setUnitPrices(priceMap);
    return priceMap;
  }, []);

  useEffect(() => {
    if (!routeId || !customerId) return;
    const cid = String(customerId);
    const rid = routeId;

    Promise.all([
      customersApi.getById(cid),
      productsApi.list({ isActive: true }),
    ]).then(async ([c, p]) => {
      setCustomer(c);
      setAllProducts(p);
      setFilteredProducts(p);
      const loadedPriceMap = await loadUnitPrices(p);

      try {
        const orders = await ordersApi.listByRoute(rid);
        const today = new Date().toISOString().slice(0, 10);
        
        const existing = orders
          .filter(o => String(o.customerId) === cid && o.orderDate?.startsWith(today))
          .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())[0];
        
        if (existing) {
          setExistingOrder(existing);
          const detail = await ordersApi.getById(existing.id);
          setExistingOrder(detail);
          setRemarks(detail.remarks ?? '');
          
          const reconstructed: LineItem[] = detail.items?.map((item: any) => {
            const prod = p.find((pp: any) => String(pp.id) === String(item.productId));
            if (!prod) return null;
            const up = loadedPriceMap[prod.id];
            return {
              product: prod,
              productId: String(prod.id),
              qty: item.quantity,
              sellingPrice: item.sellingPrice || (up?.salePrice ?? prod.basePrice),
              unit: prod.productUnitName ?? 'Unit',
            };
          }).filter(Boolean) as LineItem[];
          setLines(reconstructed);
          return;
        }
      } catch { /* no existing order today */ }

      try {
        const history = await ordersApi.getCustomerHistory(cid, 10);
        if (history?.length) {
          setPreviousOrders(history);
        }
      } catch { /* no history */ }
    }).finally(() => setLoading(false));
  }, [customerId, routeId, loadUnitPrices]);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredProducts(allProducts);
    } else {
      const q = search.toLowerCase();
      setFilteredProducts(allProducts.filter((p: any) =>
        p.nameEnglish.toLowerCase().includes(q) ||
        (p.nameMalayalam && p.nameMalayalam.toLowerCase().includes(q)) ||
        (p.productGroupName && p.productGroupName.toLowerCase().includes(q))
      ));
    }
  }, [search, allProducts]);

  useEffect(() => {
    if (isSidebarOpen && searchInputRef.current && canEdit) {
      searchInputRef.current.focus();
    }
  }, [isSidebarOpen, canEdit]);

  const addProduct = useCallback((product: any) => {
    if (!canEdit) {
      setError('Cannot edit this order.');
      return;
    }
    const unitPrice = unitPrices[product.id];
    const priceToUse = unitPrice?.salePrice ?? product.basePrice;
    
    setLines(prev => {
      const existing = prev.find(l => l.product.id === product.id);
      if (existing) {
        return prev.map(l => l.product.id === product.id ? { ...l, qty: l.qty + 1 } : l);
      }
      return [...prev, {
        product,
        productId: String(product.id),
        qty: 1,
        sellingPrice: priceToUse,
        unit: product.productUnitName ?? 'Unit',
      }];
    });
  }, [canEdit, unitPrices]);

  const handleQuantityInput = (productId: string, value: string) => {
    if (!canEdit) return;
    setTempQuantities(prev => ({ ...prev, [productId]: value }));
  };

  const handleQuantityBlur = (productId: string) => {
    if (!canEdit) return;
    const tempValue = tempQuantities[productId];
    if (tempValue === undefined) return;
    
    setTempQuantities(prev => {
      const newPrev = { ...prev };
      delete newPrev[productId];
      return newPrev;
    });
    
    if (tempValue === '' || tempValue === '0') {
      setLines(prev => prev.filter(l => l.product.id !== productId));
      return;
    }
    
    const numValue = parseInt(tempValue, 10);
    if (isNaN(numValue) || numValue <= 0) {
      setLines(prev => prev.filter(l => l.product.id !== productId));
      return;
    }
    
    setLines(prev => prev.map(l => l.product.id === productId ? { ...l, qty: numValue } : l));
  };

  const updateQty = (productId: string, delta: number) => {
    if (!canEdit) return;
    setLines(prev => {
      const item = prev.find(l => l.product.id === productId);
      if (!item) return prev;
      const newQty = item.qty + delta;
      if (newQty <= 0) {
        return prev.filter(l => l.product.id !== productId);
      }
      return prev.map(l => l.product.id === productId ? { ...l, qty: newQty } : l);
    });
    setTempQuantities(prev => {
      const newPrev = { ...prev };
      delete newPrev[productId];
      return newPrev;
    });
  };

  const setPrice = (productId: string, val: string) => {
    if (!canEdit) return;
    const n = parseFloat(val);
    if (isNaN(n)) return;
    setLines(prev => prev.map(l => l.product.id === productId ? { ...l, sellingPrice: n } : l));
    setError('');
  };

  const removeItem = (productId: string) => {
    if (!canEdit) return;
    setLines(prev => prev.filter(l => l.product.id !== productId));
    setTempQuantities(prev => {
      const newPrev = { ...prev };
      delete newPrev[productId];
      return newPrev;
    });
  };

  const getDisplayQty = (productId: string, actualQty: number): string => {
    const tempValue = tempQuantities[productId];
    if (tempValue !== undefined) return tempValue;
    return actualQty === 0 ? '' : String(actualQty);
  };

  const buildPayload = (): CreateOrderCommand => ({
    customerId: String(customerId),
    routeId: String(routeId),
    orderDate: new Date().toISOString(),
    items: lines.map(l => ({
      productId: l.product.id,
      quantity: l.qty,
      unitId: l.product.productUnitId,
      sellingPrice: l.sellingPrice,
    })),
    executionId: executionContext?.executionId ?? undefined,
    customerVisitId: executionContext?.customerVisitId ?? undefined,
    ...(remarks ? { remarks } : {}),
  });

  const handleSaveOrder = async () => {
    if (!canEdit) {
      setError('Cannot save this order.');
      return;
    }
    
    if (lines.length === 0 && !remarks.trim()) {
      setError('Add at least one item before saving.');
      return;
    }
    
    setSaving(true); 
    setError(''); 
    setSuccessMsg('');
    
    try {
      let result;
      if (existingOrder) {
        result = await ordersApi.update(existingOrder.id, { ...buildPayload(), id: existingOrder.id });
        setSuccessMsg('Order updated successfully!');
      } else {
        result = await ordersApi.create(buildPayload());
        setSuccessMsg('Order created and saved as draft!');
      }
      setExistingOrder(result);
      
      setTimeout(() => {
        setSuccessMsg('');
      }, 3000);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Save failed';
      setError(errorMessage);
    } finally { 
      setSaving(false); 
    }
  };

  const copyFromPreviousOrder = (order: CustomerOrderHistoryDto) => {
    if (!canEdit) {
      setError('Cannot load previous order. Current order cannot be edited.');
      return;
    }
    const autofilled: LineItem[] = order.items.map(item => {
      const prod = allProducts.find((pp: any) => String(pp.id) === String(item.productId));
      if (!prod) return null;
      const up = unitPrices[prod.id];
      return {
        product: prod,
        productId: String(prod.id),
        qty: item.quantity,
        sellingPrice: item.sellingPrice || (up?.salePrice ?? prod.basePrice),
        unit: prod.productUnitName ?? 'Unit',
      };
    }).filter(Boolean) as LineItem[];
    setLines(autofilled);
    setShowPreviousModal(false);
    setSuccessMsg('Previous order loaded. Click Save to save.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handlePrintOrder = () => {
    window.print();
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Spinner size={40} />
    </div>
  );

  const hasExistingOrder = !!existingOrder;
  const orderStatus = existingOrder?.status;

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">
      <div className={`transition-all duration-300 ${isSidebarOpen && canEdit ? 'mr-[340px]' : 'mr-0'}`}>
        
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-4 shadow-sm print:shadow-none print:border-0">
          <div className="max-w-4xl mx-auto">
            {/* ── Top row: back + action buttons ── */}
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => navigate(`/salesman/routes/${routeId}/orders`)}
                className="flex items-center gap-2 text-slate-600 hover:text-blue-600 font-semibold text-sm print:hidden"
              >
                <ArrowLeft size={18} />
                <span>Back to Orders</span>
              </button>
              <div className="flex gap-2 print:hidden">
                {canEdit && (
                  <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    {isSidebarOpen ? <X size={14} /> : <Package size={14} />}
                    {isSidebarOpen ? 'Hide' : 'Products'}
                  </button>
                )}
                {previousOrders.length > 0 && canEdit && (
                  /* ── Page-flip style button — easy large tap target on tablet ── */
                  <button
                    onClick={() => setShowPreviousModal(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '7px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: 'linear-gradient(135deg,#7C3AED 0%,#A855F7 100%)',
                      color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                      boxShadow: '0 2px 8px rgba(124,58,237,0.28)', minHeight: 38,
                    }}
                  >
                    <ChevronLeft size={15} style={{ marginRight: -5 }} />
                    <ChevronRight size={15} style={{ marginRight: 4 }} />
                    Previous Orders
                    <span style={{
                      background: 'rgba(255,255,255,0.22)', borderRadius: 20,
                      padding: '1px 7px', fontSize: 11, fontWeight: 800, marginLeft: 2,
                    }}>
                      {previousOrders.length}
                    </span>
                  </button>
                )}
                <button
                  onClick={handlePrintOrder}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  <Printer size={14} /> Print
                </button>
              </div>
            </div>

            {/* ── Date highlight bar — always visible so salesman knows today's date ── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 14px', borderRadius: 10, marginBottom: 10,
              background: 'linear-gradient(135deg,#1E3A8A 0%,#2563EB 100%)',
              boxShadow: '0 2px 8px rgba(37,99,235,0.20)',
            }} className="print:hidden">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarDays size={15} color="rgba(255,255,255,0.85)" />
                <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
                  {new Date().toLocaleDateString('en-IN', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </span>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
                background: 'rgba(255,255,255,0.18)', color: '#fff',
                padding: '2px 8px', borderRadius: 20,
              }}>TODAY</span>
            </div>
            
            <div className="pb-2">
              <h1 className="text-xl font-bold text-slate-800">{customer?.nameEnglish}</h1>
              {customer?.nameMalayalam && (
                <p className="text-sm text-slate-500 mt-0.5" lang="ml">{customer.nameMalayalam}</p>
              )}
              <div className="flex gap-3 mt-1 text-xs text-slate-500">
                {customer?.phoneNumber && <span>📞 {customer.phoneNumber}</span>}
                {customer?.address && <span>📍 {customer.address}</span>}
              </div>
            </div>

            {/* Status Badge */}
            {!existingOrder && (
              <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-100 text-amber-700 rounded-md text-xs">
                <Edit3 size={12} /> New Order
              </div>
            )}
            {orderStatus === OrderStatus.Draft && (
              <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-100 text-amber-700 rounded-md text-xs">
                <Edit3 size={12} /> Draft - Editable
              </div>
            )}
            {orderStatus === OrderStatus.PendingApproval && (
              <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs">
                <Edit3 size={12} /> Pending Approval - Waiting for admin
              </div>
            )}
            {orderStatus === OrderStatus.Approved && (
              <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-md text-xs">
                <Edit3 size={12} /> Approved - Being prepared
              </div>
            )}
            {orderStatus === OrderStatus.Packed && (
              <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-xs">
                <Edit3 size={12} /> Packed - Ready for delivery
              </div>
            )}
            {orderStatus === OrderStatus.Closed && (
              <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs">
                <Lock size={12} /> Closed - Read only
              </div>
            )}
          </div>
        </div>

        {/* Main Bill Area */}
        <div className="max-w-4xl mx-auto px-5 py-5">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex justify-between">
              <span>{error}</span>
              <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">✕</button>
            </div>
          )}
          {successMsg && (
            <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700 flex justify-between">
              <span>✓ {successMsg}</span>
              <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-emerald-600">✕</button>
            </div>
          )}

          {!canEdit && (
            <div className="mb-5 bg-blue-50 border border-blue-200 rounded-lg p-3 text-center text-sm text-blue-700">
              <Lock size={16} className="inline mr-1" />
              {orderStatus === OrderStatus.Closed
                ? 'This order has been closed. No further edits allowed.'
                : 'This order has been submitted and is waiting for admin approval. No further edits allowed.'}
            </div>
          )}

          {/* Add Items Button - Only when no items */}
          {canEdit && lines.length === 0 && !isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="w-full mb-5 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50 text-blue-600 font-medium text-sm hover:bg-blue-100 transition-colors"
            >
              <Plus size={16} /> Add Wholesale Items
            </button>
          )}

          <WholesaleItemsTable
            lines={lines}
            totalAmount={totalAmount}
            totalItems={totalItems}
            canEdit={canEdit}
            isSidebarOpen={isSidebarOpen}
            onAddItem={() => setIsSidebarOpen(true)}
            onQuantityInput={handleQuantityInput}
            onQuantityBlur={handleQuantityBlur}
            onUpdateQty={updateQty}
            onSetPrice={setPrice}
            onRemoveItem={removeItem}
            getDisplayQty={getDisplayQty}
            fmtNum={fmtNum}
          />

          <RetailItemsSection
            remarks={remarks}
            canEdit={canEdit}
            onRemarksChange={setRemarks}
          />

          <OrderSummary
            linesCount={lines.length}
            totalAmount={totalAmount}
            remarks={remarks}
            fmtNum={fmtNum}
          />

          {/* Save Button - Fixed Bottom */}
          {canEdit && (
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 shadow-lg print:hidden z-30">
              <div className="max-w-4xl mx-auto flex items-center justify-between">
                <div className="text-sm text-slate-500">
                  {lines.length} item{lines.length !== 1 ? 's' : ''} · {totalItems} units
                </div>
                <button
                  onClick={handleSaveOrder}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Save size={16} />
                  {saving ? 'Saving...' : hasExistingOrder ? 'Update Order' : 'Save as Draft'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ProductSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        search={search}
        onSearchChange={setSearch}
        filteredProducts={filteredProducts}
        lines={lines}
        onAddProduct={addProduct}
        canEdit={canEdit}
        searchInputRef={searchInputRef}
      />

      <PreviousOrdersModal
        isOpen={showPreviousModal}
        onClose={() => setShowPreviousModal(false)}
        previousOrders={previousOrders}
        onUseOrder={copyFromPreviousOrder}
      />
    </div>
  );
}