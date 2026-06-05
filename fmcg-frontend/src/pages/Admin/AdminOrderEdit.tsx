// PATH: src/pages/Admin/AdminOrderEdit.tsx
// UPDATED: Allow editing Approved orders

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

interface LineItem {
  product: ProductDto;
  qty: number;
  sellingPrice: number;
  unit: string;
  productId: string;
  isNew?: boolean;
}

function PriceVarianceBadge({ base, selling }: { base: number; selling: number }) {
  if (!base || !selling) return null;
  const diff = ((selling - base) / base) * 100;
  const abs = Math.abs(diff).toFixed(1);
  if (Math.abs(diff) < 0.1) return <span className="text-xs text-emerald-600">✓ At base price</span>;
  if (diff < 0) {
    return (
      <span className="text-xs text-red-500 flex items-center gap-1">
        <AlertTriangle size={11} /> {abs}% below base
      </span>
    );
  }
  return <span className="text-xs text-emerald-600">▲ +{abs}% above base</span>;
}

const ORDER_STATUS_LABELS: Record<number, string> = {
  1: 'Draft',
  2: 'Pending Approval',
  3: 'Approved',
  4: 'Packed',
  5: 'Closed',
};

export function AdminOrderEdit() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'Admin' || user?.role === 'SuperAdmin';

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

  const totalAmount = lines.reduce((s, l) => s + l.qty * l.sellingPrice, 0);
  const totalItems = lines.reduce((s, l) => s + l.qty, 0);

  const buildPayload = () => {
    return {
      id: orderId,
      customerId: String(order?.customerId),
      routeId: String(order?.routeId),
      orderDate: order?.orderDate || new Date().toISOString(),
      remarks: remarks || undefined,
      items: lines.map(l => ({
        id: l.isNew ? undefined : l.productId,
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

  // Function to format remarks with line numbers
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Spinner />
    </div>
  );

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 mb-4">
          Order not found.
        </div>
        <button className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50" onClick={() => navigate('/admin/orders')}>
          ← Back to Orders
        </button>
      </div>
    );
  }

  const orderStatus = order.status;
  const isClosed = orderStatus === OrderStatus.Closed;
  
  // UPDATED: Admin can edit Draft, PendingApproval, or Approved orders
  // Only Closed orders cannot be edited
  const canEdit = orderStatus !== OrderStatus.Closed;

  if (!canEdit) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 mb-4">
          Cannot edit order in '{ORDER_STATUS_LABELS[orderStatus]}' status. 
          Only Draft, Pending Approval, or Approved orders can be edited. Closed orders are locked.
        </div>
        <button className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50" onClick={() => navigate('/admin/orders')}>
          ← Back to Orders
        </button>
      </div>
    );
  }

  const formattedRemarksPreview = formatRemarksWithNumbers(remarks);

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* Header - Fixed position with back button on left */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-6 py-3 shadow-sm">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            {/* Back button - left corner */}
            <button
              onClick={() => navigate('/admin/orders')}
              className="flex items-center gap-2 text-slate-500 hover:text-blue-600 text-sm transition-colors"
            >
              <ArrowLeft size={18} />
              <span>Back to Orders</span>
            </button>

            {/* Title and status - centered */}
            <div className="text-center">
              <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Edit2 size={16} className="text-blue-500" />
                Edit Order
              </h1>
              <p className="text-xs text-slate-500">
                {customer?.nameEnglish ?? order.customerName} · Order #{String(order.id).slice(0, 8)}
              </p>
            </div>

            {/* Status badge - right */}
            {(orderStatus === OrderStatus.PendingApproval || orderStatus === OrderStatus.Approved) && (
              <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                {ORDER_STATUS_LABELS[orderStatus]}
              </span>
            )}
            {orderStatus === OrderStatus.Draft && (
              <div className="w-20"></div>
            )}
          </div>

          {/* Warning banner for non-draft orders */}
          {orderStatus !== OrderStatus.Draft && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs mt-3">
              <AlertTriangle size={14} />
              Order is in {ORDER_STATUS_LABELS[orderStatus]} status. Editing will update it.
            </div>
          )}

          {/* Search bar */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="w-full flex items-center gap-3 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-left hover:bg-slate-100 transition-colors mt-3"
          >
            <Search size={16} className="text-slate-400" />
            <span className="flex-1 text-slate-500 text-sm">Add product to order...</span>
            {showSearch && <X size={14} className="text-slate-400" onClick={(e) => { e.stopPropagation(); setShowSearch(false); }} />}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Error/Success messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
            <span className="text-sm text-red-700">{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        )}
        {successMsg && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
            <span className="text-sm text-emerald-700">✓ {successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-emerald-600">✕</button>
          </div>
        )}

        {/* Product search panel */}
        {showSearch && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg mb-6 overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="Search product by name or group..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
              {filteredProducts.slice(0, 30).map(p => {
                const alreadyAdded = lines.some(l => l.product.id === p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => !alreadyAdded && addProduct(p)}
                    disabled={alreadyAdded}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                      alreadyAdded ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-800">{p.nameEnglish}</p>
                      {p.nameMalayalam && (
                        <p className="text-xs text-slate-400 mt-0.5" lang="ml">{p.nameMalayalam}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-0.5">
                        {p.productGroupName || 'General'} · {p.productUnitName || 'Unit'}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-sm font-semibold text-emerald-600">₹{fmtNum(p.basePrice)}</p>
                      {alreadyAdded && <p className="text-xs text-blue-500 mt-0.5">Already added</p>}
                    </div>
                  </button>
                );
              })}
              {filteredProducts.length === 0 && (
                <div className="text-center py-12">
                  <Package size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm text-slate-400">No products found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Line items */}
        {lines.length === 0 && !showSearch && (
          <div className="bg-white rounded-2xl border border-slate-200 text-center py-16">
            <ShoppingCart size={48} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">No items in this order</p>
            <p className="text-xs text-slate-400 mt-1">Click the search bar above to add products</p>
          </div>
        )}

        <div className="space-y-4">
          {lines.map(line => {
            const isExpanded = expandedProduct === line.product.id;
            const variance = line.product.basePrice
              ? ((line.sellingPrice - line.product.basePrice) / line.product.basePrice) * 100
              : 0;
            const hasNegativeVariance = variance < -0.1;

            return (
              <div
                key={line.product.id}
                className={`bg-white rounded-2xl border transition-all hover:shadow-md ${
                  hasNegativeVariance ? 'border-red-200 bg-red-50/5' : 'border-slate-200'
                }`}
              >
                <div className="p-5">
                  {/* Product Header */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-semibold text-slate-800 text-lg">{line.product.nameEnglish}</h3>
                        <PriceVarianceBadge base={line.product.basePrice} selling={line.sellingPrice} />
                      </div>
                      {line.product.nameMalayalam && (
                        <p className="text-sm text-slate-400 mt-1" lang="ml">{line.product.nameMalayalam}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-1">
                        {line.product.productGroupName || 'General'} · {line.unit}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setExpandedProduct(isExpanded ? null : line.product.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        title={isExpanded ? 'Show less' : 'Show more'}
                      >
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(line.product.id)}
                        className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Remove item"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Quantity and Price Controls */}
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-1">
                      <button
                        onClick={() => updateQty(line.product.id, -1)}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-700 transition-colors"
                      >
                        <Minus size={16} />
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={line.qty}
                        onChange={e => setQtyDirect(line.product.id, e.target.value)}
                        className="w-16 text-center text-lg font-semibold bg-transparent text-slate-800 focus:outline-none"
                      />
                      <button
                        onClick={() => updateQty(line.product.id, 1)}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-700 transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">{line.unit}</span>

                    <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                      <span className="text-slate-400 text-sm font-medium">₹</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={line.sellingPrice > 0 ? line.sellingPrice : ''}
                        onChange={e => setPrice(line.product.id, e.target.value)}
                        placeholder={String(line.product.basePrice ?? 0)}
                        className="w-24 bg-transparent text-slate-800 text-base font-medium focus:outline-none"
                      />
                    </div>

                    <div className="ml-auto text-right">
                      <p className="text-xl font-bold text-emerald-600">₹{fmtNum(line.qty * line.sellingPrice)}</p>
                      <p className="text-xs text-slate-400">total</p>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="bg-slate-50 rounded-xl p-3">
                        <span className="text-xs text-slate-400 block">Base Price</span>
                        <p className="font-semibold text-slate-800 mt-0.5">₹{fmtNum(line.product.basePrice)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3">
                        <span className="text-xs text-slate-400 block">Variance</span>
                        <p className={`font-semibold mt-0.5 ${variance < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                          {variance >= 0 ? '+' : ''}{variance.toFixed(1)}%
                        </p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3">
                        <span className="text-xs text-slate-400 block">Unit</span>
                        <p className="font-semibold text-slate-800 mt-0.5">{line.unit}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3">
                        <span className="text-xs text-slate-400 block">Line Total</span>
                        <p className="font-semibold text-slate-800 mt-0.5">{line.qty} × ₹{fmtNum(line.sellingPrice)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Remarks section with numbered preview */}
        {lines.length > 0 && (
          <div className="mt-6 bg-white rounded-2xl border border-slate-200 p-5">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Retail Items <span className="text-xs font-normal text-slate-400">(Enter one item per line)</span>
            </label>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Input area */}
              <div>
                <p className="text-xs text-slate-500 mb-1">Enter items:</p>
                <textarea
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-y font-mono"
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
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs text-slate-400">
                    Press Enter for new line
                  </p>
                  <p className={`text-xs ${remarks.length > 1000 ? 'text-amber-500' : 'text-slate-400'}`}>
                    {remarks.length}/1000 characters
                  </p>
                </div>
              </div>

              {/* Numbered preview */}
              <div>
                <p className="text-xs text-slate-500 mb-1">Preview (with line numbers):</p>
                <div className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono whitespace-pre-wrap min-h-[200px] max-h-[250px] overflow-y-auto">
                  {formattedRemarksPreview || <span className="text-slate-300 italic">No items entered yet</span>}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  These items will appear in the order's remarks section
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fixed bottom footer */}
      {lines.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg px-6"
        style={{ zIndex: 55, padding: '16px 24px', paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px) + 70px)' }}>
          <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm text-slate-500">{lines.length} products · {totalItems} units</p>
              <p className="text-2xl font-bold text-emerald-600">₹{fmtNum(totalAmount)}</p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || lines.length === 0}
              className="flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
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