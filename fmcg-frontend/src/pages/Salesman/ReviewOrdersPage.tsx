// PATH: src/pages/Salesman/ReviewOrdersPage.tsx
// FIXED: After submit, navigate back to Routes page

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Printer, Send, CheckCircle2, 
  Package, Eye, Edit2, Home
} from 'lucide-react';
import { ordersApi, customersApi, routesApi } from '../../api/services';
import { OrderDto, CustomerDto, RouteDto, OrderStatus, fmt } from '../../types';
import { Spinner, ConfirmModal } from '../../components/ui';

interface ConsolidatedItem {
  productName: string;
  quantity: number;
  unit: string;
  sellingPrice: number;
  total: number;
  customerName: string;
  customerId: string;
}

export default function ReviewOrdersPage() {
  const { routeId } = useParams<{ routeId: string }>();
  const navigate = useNavigate();
  const [route, setRoute] = useState<RouteDto | null>(null);
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!routeId) {
      navigate('/salesman/routes');
      return;
    }
    loadData();
  }, [routeId]);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [r, c, o] = await Promise.all([
        routesApi.getById(routeId!),
        customersApi.list(routeId!),
        ordersApi.getByRoute(routeId!),
      ]);
      setRoute(r);
      setCustomers(c);
      
      const todayOrders = o.filter(order => order.orderDate?.startsWith(today));
      setOrders(todayOrders);
    } catch (err: any) {
      setError(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }

  const draftOrders = orders.filter(o => o.status === OrderStatus.Draft);
  const hasUnsubmitted = draftOrders.length > 0;

  const consolidatedItems = (): ConsolidatedItem[] => {
    const itemsMap = new Map<string, ConsolidatedItem>();
    
    orders.forEach(order => {
      order.items?.forEach(item => {
        const key = `${item.productId}-${order.customerId}`;
        const existing = itemsMap.get(key);
        
        if (existing) {
          existing.quantity += item.quantity;
          existing.total = existing.quantity * existing.sellingPrice;
        } else {
          itemsMap.set(key, {
            productName: item.productName || 'Unknown',
            quantity: item.quantity,
            unit: item.unitSymbol || item.unitName || 'pc',
            sellingPrice: item.sellingPrice,
            total: item.sellingPrice * item.quantity,
            customerName: order.customerName || 'Unknown',
            customerId: String(order.customerId),
          });
        }
      });
    });
    
    return Array.from(itemsMap.values());
  };

  const items = consolidatedItems();
  const totalAmount = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  const handleSubmitAll = async () => {
    if (draftOrders.length === 0) {
      setError('No draft orders to submit.');
      return;
    }
    
    setSubmitting(true);
    setError('');
    setSuccessMsg('');
    
    try {
      let submitted = 0;
      for (const order of draftOrders) {
        await ordersApi.submit(String(order.id));
        submitted++;
      }
      setSuccessMsg(`✅ ${submitted} order(s) submitted successfully! Redirecting to Routes...`);
      
      // Wait 2 seconds then go to Routes page
      setTimeout(() => {
        navigate('/salesman/routes');
      }, 2000);
      
    } catch (err: any) {
      setError(err.message || 'Submission failed');
      setSubmitting(false);
      setShowSubmitConfirm(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleEditOrder = (customerId: string) => {
    navigate(`/salesman/routes/${routeId}/order/${customerId}`);
  };

  const handleBackToRoutes = () => {
    navigate('/salesman/routes');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Spinner size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white pb-10">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-4 shadow-sm print:hidden">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <button
              onClick={handleBackToRoutes}
              className="flex items-center gap-2 text-slate-600 hover:text-blue-600 font-semibold text-sm"
            >
              <Home size={18} />
              <span>My Routes</span>
            </button>
            <div className="flex gap-3">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <Printer size={16} /> Print Order Sheet
              </button>
              {hasUnsubmitted && (
                <button
                  onClick={() => setShowSubmitConfirm(true)}
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  <Send size={16} />
                  {submitting ? 'Submitting...' : `Submit All (${draftOrders.length})`}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-5 py-5 print:px-0 print:py-0">
        
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 print:hidden">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700 print:hidden">
            {successMsg}
          </div>
        )}

        {/* Header Section */}
        <div className="text-center mb-6 border-b pb-4 print:border-b-2">
          <h1 className="text-2xl font-bold text-slate-800">Order Summary Sheet</h1>
          <p className="text-slate-500 mt-1">{route?.name}</p>
          <p className="text-slate-400 text-sm">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 print:mb-4">
          <div className="bg-white rounded-lg border border-slate-200 p-3 text-center shadow-sm">
            <p className="text-xs text-slate-400 uppercase">Customers</p>
            <p className="text-xl font-bold text-slate-800">{customers.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-3 text-center shadow-sm">
            <p className="text-xs text-slate-400 uppercase">Orders</p>
            <p className="text-xl font-bold text-slate-800">{orders.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-3 text-center shadow-sm">
            <p className="text-xs text-slate-400 uppercase">Items</p>
            <p className="text-xl font-bold text-slate-800">{items.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-emerald-200 p-3 text-center shadow-sm bg-emerald-50/30">
            <p className="text-xs text-slate-400 uppercase">Total Amount</p>
            <p className="text-xl font-bold text-emerald-600">₹{fmt(totalAmount)}</p>
          </div>
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6 print:mb-4">
          <div className="bg-amber-50 rounded-lg p-2 text-center border border-amber-200">
            <p className="text-xs text-amber-600">Draft</p>
            <p className="text-lg font-bold text-amber-700">{draftOrders.length}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-2 text-center border border-blue-200">
            <p className="text-xs text-blue-600">Submitted</p>
            <p className="text-lg font-bold text-blue-700">{orders.length - draftOrders.length}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-2 text-center border border-green-200">
            <p className="text-xs text-green-600">Pending</p>
            <p className="text-lg font-bold text-green-700">{draftOrders.length}</p>
          </div>
        </div>

        {/* Consolidated Items List */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6 print:border">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
            <h2 className="font-semibold text-slate-700 flex items-center gap-2">
              <Package size={18} /> All Items
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">#</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Customer</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Product</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 uppercase w-20">Qty</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 uppercase w-16">Unit</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase w-24">Price</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase w-28">Total</th>
                  <th className="px-4 py-2 text-center w-10 print:hidden"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-sm text-slate-500">{idx + 1}</td>
                    <td className="px-4 py-2 text-sm font-medium text-slate-800">{item.customerName}</td>
                    <td className="px-4 py-2 text-sm text-slate-700">{item.productName}</td>
                    <td className="px-4 py-2 text-center text-sm font-semibold text-slate-700">{item.quantity}</td>
                    <td className="px-4 py-2 text-center text-sm text-slate-500">{item.unit}</td>
                    <td className="px-4 py-2 text-right text-sm text-slate-600">₹{fmt(item.sellingPrice)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-800">₹{fmt(item.total)}</td>
                    <td className="px-4 py-2 text-center print:hidden">
                      <button onClick={() => handleEditOrder(item.customerId)} className="text-blue-500 hover:text-blue-700">
                        <Edit2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-right font-bold text-slate-700">GRAND TOTAL:</td>
                  <td className="px-4 py-3 text-right font-bold text-xl text-emerald-600">₹{fmt(totalAmount)}</td>
                  <td className="print:hidden"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Individual Orders */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden print:border">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
            <h2 className="font-semibold text-slate-700 flex items-center gap-2">
              <Eye size={18} /> Orders by Customer
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {orders.map(order => (
              <div key={order.id} className="p-4">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div>
                    <p className="font-semibold text-slate-800">{order.customerName}</p>
                    <p className="text-xs text-slate-400">{order.items?.length || 0} items</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      order.status === OrderStatus.Draft ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {order.status === OrderStatus.Draft ? 'Draft' : 'Submitted'}
                    </span>
                    <p className="font-bold text-emerald-600">₹{fmt(order.totalAmount || 0)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {order.items?.slice(0, 4).map((item, i) => (
                    <span key={i} className="text-xs bg-slate-100 px-2 py-1 rounded-full text-slate-600">
                      {item.productName} ({item.quantity})
                    </span>
                  ))}
                  {(order.items?.length || 0) > 4 && (
                    <span className="text-xs text-blue-500">+{(order.items?.length || 0) - 4} more</span>
                  )}
                </div>
                {order.remarks && (
                  <div className="mt-2 text-xs text-slate-400 bg-slate-50 p-2 rounded">
                    📝 {order.remarks}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 mt-6 pt-4 border-t print:mt-4 print:pt-2">
          <p>Generated on {new Date().toLocaleString()}</p>
        </div>
      </div>

      <ConfirmModal
        open={showSubmitConfirm}
        title="Submit All Orders"
        message={`Submit ${draftOrders.length} draft order(s) to admin? After submission, you will be redirected to the Routes page.`}
        confirmLabel={`Submit ${draftOrders.length} Order${draftOrders.length > 1 ? 's' : ''}`}
        onConfirm={handleSubmitAll}
        onCancel={() => setShowSubmitConfirm(false)}
        loading={submitting}
      />
    </div>
  );
}