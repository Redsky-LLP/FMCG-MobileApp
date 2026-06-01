// PATH: src/pages/Salesman/SalesmanOrders.tsx
// FIXED: Show only today's orders, improved submit all flow

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, Plus, ChevronRight, CheckCircle2, Clock, 
  Calendar, Package, Eye, List, User, Search, Send, 
  RefreshCw, AlertCircle, Edit2, ClipboardList, Truck
} from 'lucide-react';
import { customersApi, ordersApi, routesApi } from '../../api/services';
import { CustomerDto, OrderDto, RouteDto, OrderStatus, fmt, OrderItemDto } from '../../types';
import { Spinner, EmptyState, Badge, Alert, ConfirmModal } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';

const statusMeta: Record<number, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  [OrderStatus.Draft]:           { label: 'Draft',           color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: <Clock size={14} /> },
  [OrderStatus.PendingApproval]: { label: 'Pending Approval', color: 'text-blue-700',  bg: 'bg-blue-50', border: 'border-blue-200',   icon: <CheckCircle2 size={14} /> },
  [OrderStatus.Approved]:        { label: 'Approved',        color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', icon: <CheckCircle2 size={14} /> },
  [OrderStatus.Packed]:          { label: 'Packed',          color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', icon: <CheckCircle2 size={14} /> },
  [OrderStatus.Closed]:          { label: 'Closed',          color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', icon: <CheckCircle2 size={14} /> },
};

// Order item card component
function OrderItemCard({ 
  order, 
  routeId, 
  onNavigate,
  onEdit 
}: { 
  order: OrderDto; 
  routeId: string; 
  onNavigate: (customerId: string) => void;
  onEdit: (orderId: string, customerId: string) => void;
}) {
  const [showItems, setShowItems] = useState(false);
  const itemCount = order.items?.length ?? 0;
  const totalQuantity = order.items?.reduce((sum, i) => sum + i.quantity, 0) ?? 0;
  const status = statusMeta[order.status] || statusMeta[OrderStatus.Draft];
  const isDraft = order.status === OrderStatus.Draft;

  const getProductName = (item: OrderItemDto): string => {
    return item.productName || item.productNameMl || 'Unknown';
  };

  const getUnitSymbol = (item: OrderItemDto): string => {
    return item.unitSymbol || item.unitName || 'pc';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden transition-all hover:shadow-md">
      <div className="p-4 cursor-pointer" onClick={() => onNavigate(String(order.customerId))}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <User size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-800">{order.customerName}</p>
              {order.customerNameMalayalam && (
                <p className="text-sm text-slate-500" lang="ml">{order.customerNameMalayalam}</p>
              )}
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full font-medium border ${status.bg} ${status.color} ${status.border} flex-shrink-0`}>
            {status.icon} {status.label}
          </span>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-4 flex-wrap text-sm text-slate-500">
            <span className="flex items-center gap-1.5">📦 {itemCount} item{itemCount !== 1 ? 's' : ''}</span>
            <span className="flex items-center gap-1.5">📊 {totalQuantity} units</span>
            <span className="flex items-center gap-1.5">🕐 {new Date(order.orderDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-slate-800">{fmt(order.totalAmount ?? 0)}</p>
          </div>
        </div>
        
        {order.items && order.items.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <button
              onClick={(e) => { e.stopPropagation(); setShowItems(!showItems); }}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Eye size={14} />
              {showItems ? 'Hide items' : `View ${order.items.length} item(s)`}
            </button>
            {showItems && (
              <div className="mt-2 space-y-2">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm bg-slate-50 p-3 rounded-lg">
                    <div className="flex-1">
                      <p className="text-slate-700 text-base font-medium">{getProductName(item)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-700">{item.quantity} {getUnitSymbol(item)}</p>
                      <p className="text-sm font-semibold text-slate-800">{fmt(item.sellingPrice * item.quantity)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {isDraft && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 flex justify-end">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(String(order.id), String(order.customerId)); }}
            className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            <Edit2 size={14} /> Edit Order
          </button>
        </div>
      )}
    </div>
  );
}

// Customer list item component
function CustomerListItem({ customer, routeId, onNavigate }: {
  customer: CustomerDto;
  routeId: string;
  onNavigate: (customerId: string) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 transition-all hover:shadow-md">
      <button
        onClick={() => onNavigate(String(customer.id))}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <User size={20} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-800 text-base truncate">{customer.nameEnglish}</span>
                {customer.nameMalayalam && (
                  <span className="text-sm text-slate-500 truncate" lang="ml">{customer.nameMalayalam}</span>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-0.5">{customer.phoneNumber ?? customer.address ?? 'No contact'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full font-medium bg-blue-50 text-blue-600 border border-blue-200">
              <Plus size={14} /> New Order
            </span>
            <ChevronRight size={18} className="text-slate-400" />
          </div>
        </div>
      </button>
    </div>
  );
}

export default function SalesmanOrders() {
  const { routeId } = useParams<{ routeId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const [route, setRoute] = useState<RouteDto | null>(null);
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submittingAll, setSubmittingAll] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().slice(0, 10);

  async function load() {
    if (!routeId || routeId === 'NaN' || routeId === 'undefined') {
      setError('Invalid route selected. Please go back and select a valid route.');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const id = routeId;
      const [r, c, o] = await Promise.all([
        routesApi.getById(id),
        customersApi.list(id),
        ordersApi.getByRoute(id),
      ]);
      setRoute(r);
      setCustomers(c);
      
      // Filter orders to show only TODAY's orders
      const todayOrders = o.filter(order => order.orderDate?.startsWith(today));
      const sortedOrders = [...todayOrders].sort((a, b) => 
        new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
      );
      setOrders(sortedOrders);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [routeId, location.state]);

  // Submit all draft orders at once
  const handleSubmitAllOrders = async () => {
    const draftOrders = orders.filter(o => o.status === OrderStatus.Draft);
    if (draftOrders.length === 0) {
      setError('No draft orders to submit.');
      return;
    }
    
    setSubmittingAll(true);
    setError('');
    setSuccessMsg('');
    
    try {
      let submitted = 0;
      for (const order of draftOrders) {
        await ordersApi.submit(String(order.id));
        submitted++;
      }
      setSuccessMsg(`✅ ${submitted} order(s) submitted for admin approval! Redirecting to Routes...`);
      
      // Wait 2 seconds then go to Routes page
      setTimeout(() => {
        navigate('/salesman/routes');
      }, 2000);
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Submission failed';
      setError(errorMessage);
      setSubmittingAll(false);
      setShowSubmitConfirm(false);
    }
  };

  const customersWithOrders = new Set(orders.map(o => String(o.customerId)));
  const customersWithoutOrders = customers.filter(c => !customersWithOrders.has(String(c.id)));

  const filteredCustomers = customersWithoutOrders.filter(c =>
    c.nameEnglish.toLowerCase().includes(search.toLowerCase()) ||    
    (c.nameMalayalam && c.nameMalayalam.toLowerCase().includes(search.toLowerCase())) ||
    (c.phoneNumber && c.phoneNumber.includes(search))
  );

  const filteredOrders = orders.filter(order =>
    order.customerName?.toLowerCase().includes(search.toLowerCase())
  );

  const totalAmount = orders.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
  const draftCount = orders.filter(o => o.status === OrderStatus.Draft).length;
  const pendingCount = orders.filter(o => o.status === OrderStatus.PendingApproval).length;
  const closedCount = orders.filter(o => o.status === OrderStatus.Closed).length;
  const allCustomersDone = customers.length > 0 && customersWithOrders.size === customers.length;

  const handleNavigateToOrder = (customerId: string) => {
    navigate(`/salesman/routes/${routeId}/order/${customerId}`);
  };

  const handleEditOrder = (orderId: string, customerId: string) => {
    navigate(`/salesman/routes/${routeId}/order/${customerId}`);
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Spinner size={40} />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigate('/salesman/routes')} 
                className="flex items-center gap-2 text-slate-600 hover:text-blue-600 font-semibold text-base transition-colors"
              >
                <ArrowLeft size={20} />
                <span className="text-base">Routes</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={load}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                title="Refresh"
              >
                <RefreshCw size={14} /> Refresh
              </button>
              {draftCount > 0 && (
                <button
                  onClick={() => setShowSubmitConfirm(true)}
                  disabled={submittingAll}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-sm"
                >
                  {submittingAll ? <Spinner size={16} /> : <Send size={16} />}
                  Submit All ({draftCount})
                </button>
              )}
            </div>
          </div>
          
          <div>
            <h1 className="text-xl font-bold text-slate-800">{route?.name ?? 'Route Orders'}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {customers.length} customers · {fmt(totalAmount)} total · {today}
            </p>
          </div>

          {/* Stats chips */}
          <div className="flex gap-3 mt-3 mb-3 overflow-x-auto pb-1">
            <div className="shrink-0 bg-white border border-slate-200 rounded-lg px-4 py-2 shadow-sm">
              <span className="text-sm text-slate-500">Orders Today</span>
              <span className="ml-2 font-bold text-slate-800">{orders.length}/{customers.length}</span>
            </div>
            <div className="shrink-0 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
              <span className="text-sm text-amber-600">Draft</span>
              <span className="ml-2 font-bold text-amber-700">{draftCount}</span>
            </div>
            <div className="shrink-0 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
              <span className="text-sm text-blue-600">Pending Approval</span>
              <span className="ml-2 font-bold text-blue-700">{pendingCount}</span>
            </div>
            <div className="shrink-0 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
              <span className="text-sm text-green-600">Closed</span>
              <span className="ml-2 font-bold text-green-700">{closedCount}</span>
            </div>
          </div>

          {/* Progress indicator */}
          {customers.length > 0 && (
            <div className="mt-2 mb-3">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Order Progress</span>
                <span>{orders.length} of {customers.length} customers</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${(orders.length / customers.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Completion message */}
          {allCustomersDone && draftCount === 0 && (
            <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-center text-sm text-emerald-700">
              <CheckCircle2 size={16} className="inline mr-1" />
              All customers have orders! Click "Submit All" to send to admin.
            </div>
          )}

          {/* Search input */}
          <div className="relative mt-3">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-base focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              placeholder="Search customer or order…"
              lang="ml"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Error/Success messages */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between">
            <span className="text-sm text-red-700">{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        </div>
      )}
      {successMsg && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
            <span className="text-sm text-emerald-700">{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-emerald-600">✕</button>
          </div>
        </div>
      )}

      {/* Today's Orders */}
      <div className="max-w-7xl mx-auto px-4 mt-4">
        <h2 className="text-base font-bold text-slate-700 mb-3 flex items-center gap-2">
          <ClipboardList size={16} /> Today's Orders
        </h2>
        
        {filteredOrders.length === 0 && !search && (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <Package size={48} className="mx-auto text-slate-300 mb-3 opacity-40" />
            <p className="text-slate-500">No orders yet today</p>
            <p className="text-sm text-slate-400 mt-1">Create orders from the customer list below</p>
          </div>
        )}
        
        {filteredOrders.length === 0 && search && (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <p className="text-slate-500">No orders match "{search}"</p>
          </div>
        )}

        <div className="space-y-3">
          {filteredOrders.map(order => (
            <OrderItemCard 
              key={order.id} 
              order={order} 
              routeId={routeId!} 
              onNavigate={handleNavigateToOrder}
              onEdit={handleEditOrder}
            />
          ))}
        </div>
      </div>

      {/* Customers without orders - New Order section */}
      {filteredCustomers.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 mt-6 mb-8">
          <h2 className="text-base font-bold text-slate-700 mb-3 flex items-center gap-2">
            <Plus size={16} /> New Orders Needed
          </h2>
          <div className="space-y-3">
            {filteredCustomers.map(customer => (
              <CustomerListItem 
                key={customer.id}
                customer={customer}
                routeId={routeId!}
                onNavigate={handleNavigateToOrder}
              />
            ))}
          </div>
        </div>
      )}

      {/* Submit All Confirmation Modal */}
      <ConfirmModal
        open={showSubmitConfirm}
        title="Submit All Orders"
        message={`You are about to submit ${draftCount} draft order(s). Once submitted, they will be sent to the admin for approval and cannot be edited further. Do you want to continue?`}
        confirmLabel={`Submit ${draftCount} Order${draftCount > 1 ? 's' : ''}`}
        onConfirm={handleSubmitAllOrders}
        onCancel={() => setShowSubmitConfirm(false)}
        loading={submittingAll}
      />
    </div>
  );
}