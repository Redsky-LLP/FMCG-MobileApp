// PATH: src/pages/Admin/AdminOrders.tsx
// UPDATED: Added Approve button functionality and fixed item loading

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShoppingCart, RefreshCw, CheckCircle, Search, Send, Calendar, 
  Package, Eye, Edit2, User, Clock, ChevronRight, Filter, X, List, Globe
} from 'lucide-react';
import { ordersApi, routesApi } from '../../api/services';
import type { OrderDto, RouteDto, OrderDetailDto, CustomerOrderHistoryDto } from '../../types';
import { OrderStatus, ORDER_STATUS_LABELS, fmt, fmtDate } from '../../types';
import { PageLoader, Spinner, Alert, Badge, EmptyState } from '../../components/ui';

export function AdminOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [routes, setRoutes] = useState<RouteDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [routeFilter, setRouteFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [previousOrders, setPreviousOrders] = useState<Record<string, CustomerOrderHistoryDto[]>>({});
  const [loadingHistory, setLoadingHistory] = useState<Record<string, boolean>>({});
  const [reviewOrder, setReviewOrder] = useState<OrderDetailDto | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [loadingReview, setLoadingReview] = useState(false);
  const [success, setSuccess] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (dateFilter === '') {
      setDateFilter(today);
    }
  }, []);

  async function load() {
    setLoading(true); setError('');
    try {
      let allOrders: OrderDto[] = [];
      
      if (!routeFilter || routeFilter === 'all') {
        const routePromises = routes.map(route => 
          ordersApi.getByRoute(String(route.id), statusFilter !== '' ? parseInt(statusFilter) : undefined)
            .catch(() => [])
        );
        const results = await Promise.all(routePromises);
        allOrders = results.flat();
      } else {
        const status = statusFilter !== '' ? parseInt(statusFilter) : undefined;
        allOrders = await ordersApi.getByRoute(routeFilter, status);
      }
      
      let filteredOrders = allOrders;
      if (dateFilter) {
        filteredOrders = allOrders.filter(order => 
          order.orderDate?.startsWith(dateFilter)
        );
      }
      filteredOrders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
      setOrders(filteredOrders);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally { setLoading(false); }
  }

  async function loadRoutes() {
    try {
      const r = await routesApi.getAll();
      setRoutes(r);
      setRouteFilter('all');
    } catch (err) {
      setError('Failed to load routes');
    }
  }

  useEffect(() => { loadRoutes(); }, []);
  useEffect(() => { load(); }, [routeFilter, statusFilter, dateFilter]);

  async function handleSubmit(orderId: string) {
    setSubmitting(orderId); setError('');
    try {
      await ordersApi.submit(orderId);
      setShowReviewModal(false);
      setReviewOrder(null);
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submit failed';
      setError(msg);
      alert(msg);
    } finally { setSubmitting(null); }
  }

  // ── NEW: Approve Order Handler ─────────────────────────────────────────────
  async function handleApproveOrder(orderId: string) {
    setApproving(orderId);
    setError('');
    try {
      await ordersApi.approve(orderId);
      setSuccess('Order approved successfully!');
      setShowReviewModal(false);
      setReviewOrder(null);
      await load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setApproving(null);
    }
  }

  async function handleClose(orderId: string) {
    setClosing(orderId); setError('');
    try {
      await ordersApi.close(orderId);
      setSuccess('Order closed successfully!');
      await load();
      setShowReviewModal(false);
      setReviewOrder(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Close failed');
    } finally { setClosing(null); }
  }

  async function loadPreviousOrders(customerId: string, orderId: string) {
    if (previousOrders[orderId]) {
      setExpandedOrder(expandedOrder === orderId ? null : orderId);
      return;
    }
    
    setLoadingHistory(prev => ({ ...prev, [orderId]: true }));
    try {
      const history = await ordersApi.getCustomerHistory(customerId, 3);
      setPreviousOrders(prev => ({ ...prev, [orderId]: history.filter(h => h.orderId !== orderId) }));
      setExpandedOrder(orderId);
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setLoadingHistory(prev => ({ ...prev, [orderId]: false }));
    }
  }

  function calculateOrderDetailFromOrder(order: OrderDto): OrderDetailDto {
    const items = order.items || [];
    const totalBasePrice = items.reduce((sum, item) => sum + (item.basePrice || 0) * item.quantity, 0);
    const totalSelling = items.reduce((sum, item) => sum + (item.sellingPrice || 0) * item.quantity, 0);
    const totalVariance = totalSelling - totalBasePrice;
    const variancePct = totalBasePrice > 0 ? (totalVariance / totalBasePrice) * 100 : 0;
    
    return {
      id: order.id,
      customerId: order.customerId,
      customerName: order.customerName,
      customerNameMalayalam: order.customerNameMalayalam,
      routeId: order.routeId,
      routeName: order.routeName,
      salesmanId: order.salesmanId,
      salesmanName: order.salesmanName,
      status: order.status,
      orderDate: order.orderDate,
      totalAmount: order.totalAmount,
      totalVariance: order.totalVariance ?? totalVariance,
      totalQuantity: order.totalQuantity ?? 0,
      itemCount: order.itemCount ?? items.length,
      createdDate: order.createdDate,
      remarks: order.remarks,
      items: items,
      totalBasePrice: totalBasePrice,
      totalSelling: totalSelling,
      variancePct: variancePct,
    };
  }

  async function handleReviewOrder(orderId: string) {
    setLoadingReview(true);
    setError('');
    try {
      const orderDetail = await ordersApi.getById(orderId);
      
      if (!orderDetail.items) {
        orderDetail.items = [];
      }
      
      if (orderDetail.totalBasePrice === undefined) {
        const items = orderDetail.items;
        orderDetail.totalBasePrice = items.reduce((sum, item) => sum + (item.basePrice || 0) * item.quantity, 0);
        orderDetail.totalSelling = items.reduce((sum, item) => sum + (item.sellingPrice || 0) * item.quantity, 0);
        orderDetail.totalVariance = orderDetail.totalSelling - orderDetail.totalBasePrice;
        orderDetail.variancePct = orderDetail.totalBasePrice > 0 ? (orderDetail.totalVariance / orderDetail.totalBasePrice) * 100 : 0;
      }
      
      setReviewOrder(orderDetail);
      setShowReviewModal(true);
    } catch (err) {
      console.error('Failed to load order details:', err);
      setError('Failed to load order details. Please try again.');
      
      const existingOrder = orders.find(o => String(o.id) === orderId);
      if (existingOrder) {
        const fallbackDetail = calculateOrderDetailFromOrder(existingOrder);
        setReviewOrder(fallbackDetail);
        setShowReviewModal(true);
      }
    } finally {
      setLoadingReview(false);
    }
  }

  function handleEditOrder(orderId: string, customerId: string) {
    navigate(`/admin/orders/${orderId}/edit`, { 
      state: { orderId, customerId, routeId: routeFilter === 'all' ? undefined : routeFilter }
    });
  }

  const ordersByDate = orders.reduce((acc, order) => {
    const date = order.orderDate?.split('T')[0] || 'Unknown';
    if (!acc[date]) acc[date] = [];
    acc[date].push(order);
    return acc;
  }, {} as Record<string, OrderDto[]>);

  const totalRevenue = orders.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
  const draftCount = orders.filter(o => o.status === OrderStatus.Draft).length;
  const pendingApprovalCount = orders.filter(o => o.status === OrderStatus.PendingApproval).length;
  const approvedCount = orders.filter(o => o.status === OrderStatus.Approved).length;
  const packedCount = orders.filter(o => o.status === OrderStatus.Packed).length;
  const closedCount = orders.filter(o => o.status === OrderStatus.Closed).length;

  const filteredOrdersByDate = Object.entries(ordersByDate).reduce((acc, [date, dateOrders]) => {
    const filtered = dateOrders.filter(o => 
      search ? o.customerName?.toLowerCase().includes(search.toLowerCase()) : true
    );
    if (filtered.length > 0) acc[date] = filtered;
    return acc;
  }, {} as Record<string, OrderDto[]>);

  const getSelectedRouteName = () => {
    if (routeFilter === 'all') return 'All Orders';
    const route = routes.find(r => String(r.id) === routeFilter);
    return route?.name || 'Select Route';
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <div>
              <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <ShoppingCart size={22} className="text-blue-600" />
                Orders
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {orders.length} orders · {fmt(totalRevenue)} total
              </p>
            </div>
            <button 
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              onClick={load}
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>

          {/* Workflow Banner */}
          <div className="flex items-center gap-2 flex-wrap p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700">
            <Send size={12} />
            <span className="font-medium">Workflow:</span>
            <span>Salesman saves → <strong>Draft</strong></span>
            <ChevronRight size={10} />
            <span>Salesman submits → <strong>Pending Approval</strong></span>
            <ChevronRight size={10} />
            <span>Admin approves → <strong>Approved</strong></span>
            <ChevronRight size={10} />
            <span>Warehouse packs → <strong>Packed</strong></span>
            <ChevronRight size={10} />
            <span>Admin closes → <strong>Closed</strong></span>
          </div>

          {/* Stats Chips */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            <div className="shrink-0 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
              <span className="text-xs text-slate-500">Total</span>
              <span className="ml-1 font-semibold text-slate-700">{orders.length}</span>
            </div>
            <div className="shrink-0 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              <span className="text-xs text-amber-600">Draft</span>
              <span className="ml-1 font-semibold text-amber-700">{draftCount}</span>
            </div>
            <div className="shrink-0 bg-purple-50 border border-purple-200 rounded-lg px-3 py-1.5">
              <span className="text-xs text-purple-600">Pending Approval</span>
              <span className="ml-1 font-semibold text-purple-700">{pendingApprovalCount}</span>
            </div>
            <div className="shrink-0 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
              <span className="text-xs text-blue-600">Approved/Packed</span>
              <span className="ml-1 font-semibold text-blue-700">{approvedCount + packedCount}</span>
            </div>
            <div className="shrink-0 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
              <span className="text-xs text-emerald-600">Closed</span>
              <span className="ml-1 font-semibold text-emerald-700">{closedCount}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 py-5">
        {error && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        {/* Filters Row */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Filter size={14} />
              <span className="font-medium">Filters:</span>
            </div>
            <select 
              className="border-slate-200 rounded-xl px-3 py-2 text-sm bg-white min-w-[180px] border"
              value={routeFilter} 
              onChange={(e) => setRouteFilter(e.target.value)}
            >
              <option value="all">🌍 All Orders</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>📍 {r.name}</option>
              ))}
            </select>
            <select 
              className="border-slate-200 rounded-xl px-3 py-2 text-sm bg-white min-w-[140px] border"
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="1">Draft</option>
              <option value="2">Pending Approval</option>
              <option value="3">Approved</option>
              <option value="4">Packed</option>
              <option value="5">Closed</option>
            </select>
            <input 
              type="date" 
              className="border-slate-200 rounded-xl px-3 py-2 text-sm bg-white min-w-[160px] border"
              value={dateFilter} 
              onChange={(e) => setDateFilter(e.target.value)}
            />
            <div className="flex-1 min-w-[200px] relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                className="w-full pl-9 border-slate-200 rounded-xl py-2 text-sm bg-white border"
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                placeholder="Search customer..." 
              />
              {search && (
                <button 
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-2">
            <Globe size={12} className="text-blue-500" />
            <span className="text-xs text-slate-500">Showing:</span>
            <span className="text-xs font-medium text-slate-700">{getSelectedRouteName()}</span>
            {routeFilter !== 'all' && routes.length > 0 && (
              <button 
                onClick={() => setRouteFilter('all')}
                className="text-xs text-blue-500 hover:text-blue-700 ml-2"
              >
                View All Orders
              </button>
            )}
          </div>
        </div>

        {/* Orders List */}
        {loading ? <PageLoader /> : (
          Object.keys(filteredOrdersByDate).length === 0 ? (
            <EmptyState
              title={routeFilter === 'all' ? 'No orders found' : (routeFilter ? 'No orders found' : 'Select a route')}
              message={routeFilter === 'all' ? 'No orders match your filters across any route.' : (routeFilter ? 'No orders match your filters.' : 'Choose a route to view its orders.')}
              icon={ShoppingCart}
            />
          ) : (
            <div className="space-y-6">
              {Object.entries(filteredOrdersByDate)
                .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
                .map(([date, dateOrders]) => (
                  <div key={date}>
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar size={16} className="text-blue-500" />
                      <h3 className="text-sm font-semibold text-slate-700">
                        {new Date(date).toLocaleDateString('en-IN', { 
                          weekday: 'long', 
                          day: 'numeric', 
                          month: 'long', 
                          year: 'numeric' 
                        })}
                      </h3>
                      <span className="text-xs text-slate-400">({dateOrders.length} orders)</span>
                    </div>

                    <div className="space-y-3">
                      {dateOrders.map((order) => {
                        const itemCount = order.items?.length ?? 0;
                        const totalUnits = order.items?.reduce((sum, i) => sum + i.quantity, 0) ?? 0;
                        const isExpanded = expandedOrder === String(order.id);
                        const isEditable = order.status === OrderStatus.Draft || 
                                          order.status === OrderStatus.PendingApproval ||
                                          order.status === OrderStatus.Approved;
                        const isClosable = order.status === OrderStatus.Approved || order.status === OrderStatus.Packed;
                        
                        return (
                          <div key={order.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            {/* Order Header */}
                            <div className="p-5 border-b border-slate-100">
                              <div className="flex items-start justify-between flex-wrap gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                        <User size={14} className="text-blue-600" />
                                      </div>
                                      <h4 className="font-semibold text-slate-800 truncate">{order.customerName}</h4>
                                    </div>
                                    <Badge variant={
                                      order.status === OrderStatus.Closed ? 'green' :
                                      order.status === OrderStatus.Approved || order.status === OrderStatus.Packed ? 'blue' :
                                      order.status === OrderStatus.PendingApproval ? 'primary' : 'amber'
                                    }>
                                      {ORDER_STATUS_LABELS[order.status]}
                                    </Badge>
                                    {routeFilter === 'all' && order.routeName && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-xs text-slate-500">
                                        <Globe size={10} />
                                        {order.routeName}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-400 font-mono">
                                    Order #{String(order.id).slice(0, 8)} · {fmtDate(order.orderDate)} at {new Date(order.orderDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-xl font-bold text-emerald-600">{fmt(order.totalAmount)}</p>
                                  <p className="text-xs text-slate-400">{itemCount} items · {totalUnits} units</p>
                                </div>
                              </div>
                            </div>

                            {/* Order Items Preview */}
                            {order.items && order.items.length > 0 && (
                              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/30">
                                <div className="flex flex-wrap gap-2">
                                  {order.items.slice(0, 3).map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-1 text-xs bg-white px-2 py-1 rounded-full border border-slate-200">
                                      <Package size={10} className="text-slate-400" />
                                      <span className="text-slate-600">{item.productName}</span>
                                      <span className="text-slate-400">({item.quantity})</span>
                                    </div>
                                  ))}
                                  {order.items.length > 3 && (
                                    <span className="text-xs text-blue-500 px-2 py-1">+{order.items.length - 3} more</span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="px-5 py-3 flex flex-wrap justify-end gap-2">
                              <button
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                                onClick={() => handleReviewOrder(String(order.id))}
                                disabled={loadingReview}
                              >
                                <Eye size={13} />
                                Review
                              </button>

                              {/* Show Edit button for Draft, PendingApproval, and Approved orders */}
                              {isEditable && (
                                <button
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                                  onClick={() => handleEditOrder(String(order.id), String(order.customerId))}
                                >
                                  <Edit2 size={13} />
                                  Edit Order
                                </button>
                              )}

                              {/* Show Close button only for Approved or Packed orders */}
                              {isClosable && (
                                <button
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                  onClick={() => handleClose(String(order.id))}
                                  disabled={closing === String(order.id)}
                                >
                                  {closing === String(order.id) ? <Spinner size={13} /> : <CheckCircle size={13} />}
                                  Close Order
                                </button>
                              )}
                            </div>

                            {/* Previous Orders History Toggle */}
                            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/20">
                              <button
                                onClick={() => loadPreviousOrders(String(order.customerId), String(order.id))}
                                className="flex items-center gap-2 text-xs text-blue-500 hover:text-blue-700 transition-colors"
                              >
                                {loadingHistory[String(order.id)] ? (
                                  <Spinner size={12} />
                                ) : (
                                  <Clock size={12} />
                                )}
                                {isExpanded ? 'Hide previous orders' : 'Show previous orders (last 3)'}
                              </button>
                              
                              {isExpanded && previousOrders[String(order.id)] && (
                                <div className="mt-3 space-y-2">
                                  {previousOrders[String(order.id)].length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">No previous orders found</p>
                                  ) : (
                                    previousOrders[String(order.id)].map((prevOrder, idx) => (
                                      <div key={idx} className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                                        <div className="flex justify-between items-start flex-wrap gap-2">
                                          <div>
                                            <p className="text-xs font-semibold text-slate-600">
                                              {idx === 0 ? '📋 Most recent' : `${idx + 1} order${idx > 0 ? 's' : ''} ago`}
                                            </p>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                              {fmtDate(prevOrder.orderDate)} · {prevOrder.itemCount} items
                                            </p>
                                          </div>
                                          <p className="text-sm font-semibold text-emerald-600">{fmt(prevOrder.totalAmount)}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-1 mt-2">
                                          {prevOrder.items.slice(0, 3).map((item, i) => (
                                            <span key={i} className="text-xs text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                                              {item.productName} ({item.quantity})
                                            </span>
                                          ))}
                                          {prevOrder.items.length > 3 && (
                                            <span className="text-xs text-blue-400">+{prevOrder.items.length - 3} more</span>
                                          )}
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          )
        )}
      </div>

      {/* Review Order Modal - Fixed with Approve button */}
      {showReviewModal && reviewOrder && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" 
          onClick={() => setShowReviewModal(false)}
          style={{ zIndex: 9999 }}
        >
          <div 
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl" 
            onClick={(e) => e.stopPropagation()}
            style={{ marginTop: 0 }}
          >
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Eye size={18} className="text-blue-500" />
                Review Order
              </h3>
              <button className="p-1 rounded-lg hover:bg-slate-100 transition-colors" onClick={() => setShowReviewModal(false)}>
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <p className="text-base font-semibold text-slate-800">{reviewOrder.customerName}</p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Order #{String(reviewOrder.id).slice(0, 8)} · {fmtDate(reviewOrder.orderDate)}
                </p>
                <div className="mt-2">
                  <Badge variant={
                    reviewOrder.status === OrderStatus.Closed ? 'green' :
                    reviewOrder.status === OrderStatus.Approved || reviewOrder.status === OrderStatus.Packed ? 'blue' :
                    reviewOrder.status === OrderStatus.PendingApproval ? 'primary' : 'amber'
                  }>
                    {ORDER_STATUS_LABELS[reviewOrder.status]}
                  </Badge>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <Package size={14} />
                  Items ({reviewOrder.items?.length ?? 0})
                </h4>
                
                {reviewOrder.items && reviewOrder.items.length > 0 ? (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {reviewOrder.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-800">{item.productName}</p>
                          <p className="text-xs text-slate-400">
                            {item.quantity} {item.unitSymbol || 'unit'} × {fmt(item.sellingPrice)}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-emerald-600 ml-4">{fmt(item.sellingPrice * item.quantity)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200">
                    <List size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm text-slate-400">No items in this order</p>
                    <p className="text-xs text-slate-300 mt-1">Click Edit Order to add products</p>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 pt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Total Items:</span>
                  <span className="font-medium text-slate-700">{reviewOrder.items?.length ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Total Units:</span>
                  <span className="font-medium text-slate-700">{reviewOrder.totalQuantity ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Base Price:</span>
                  <span className="font-medium text-slate-700">{fmt(reviewOrder.totalBasePrice)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Variance:</span>
                  <span className={`font-medium ${reviewOrder.totalVariance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {fmt(reviewOrder.totalVariance)} ({reviewOrder.variancePct?.toFixed(1)}%)
                  </span>
                </div>
                <div className="flex justify-between text-lg pt-2 border-t border-slate-200">
                  <span className="font-semibold text-slate-800">Grand Total:</span>
                  <span className="font-bold text-emerald-600">{fmt(reviewOrder.totalAmount)}</span>
                </div>
              </div>

              {reviewOrder.remarks && (
                <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                  <p className="text-xs font-medium text-amber-700 mb-1">📝 Remarks</p>
                  <p className="text-sm text-amber-800">{reviewOrder.remarks}</p>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex gap-3 justify-end">
              {/* ── NEW: Approve button for Pending Approval orders ── */}
              {reviewOrder.status === OrderStatus.PendingApproval && (
                <button 
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  onClick={() => handleApproveOrder(String(reviewOrder.id))}
                  disabled={approving === String(reviewOrder.id)}
                >
                  {approving === String(reviewOrder.id) ? <Spinner size={14} /> : <CheckCircle size={14} />}
                  Approve Order
                </button>
              )}
              
              {/* Show Edit button for Draft, PendingApproval, and Approved orders */}
              {(reviewOrder.status === OrderStatus.Draft || 
                reviewOrder.status === OrderStatus.PendingApproval || 
                reviewOrder.status === OrderStatus.Approved) && (
                <button 
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                  onClick={() => handleEditOrder(String(reviewOrder.id), String(reviewOrder.customerId))}
                >
                  <Edit2 size={14} />
                  Edit Order
                </button>
              )}
              
              {/* Show Close button only for Approved or Packed orders */}
              {(reviewOrder.status === OrderStatus.Approved || reviewOrder.status === OrderStatus.Packed) && (
                <button 
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  onClick={() => handleClose(String(reviewOrder.id))}
                  disabled={closing === String(reviewOrder.id)}
                >
                  {closing === String(reviewOrder.id) ? <Spinner size={14} /> : <CheckCircle size={14} />}
                  Close Order
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}