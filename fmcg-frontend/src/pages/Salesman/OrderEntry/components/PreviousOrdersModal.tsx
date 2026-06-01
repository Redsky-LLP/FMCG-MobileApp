import { X, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { CustomerOrderHistoryDto, fmtNum } from '../../../../types';

interface PreviousOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  previousOrders: CustomerOrderHistoryDto[];
  onUseOrder: (order: CustomerOrderHistoryDto) => void;
}

export function PreviousOrdersModal({ isOpen, onClose, previousOrders, onUseOrder }: PreviousOrdersModalProps) {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[80vh] bg-white rounded-2xl shadow-xl z-50 flex flex-col">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div style={{ display:'flex', alignItems:'center', background:'linear-gradient(135deg,#7C3AED,#A855F7)', borderRadius:8, padding:'4px 8px', gap:0 }}>
              <ChevronLeft size={14} color="#fff" style={{ marginRight:-3 }} />
              <ChevronRight size={14} color="#fff" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Previous Orders</h2>
            <span className="text-sm text-slate-400">({previousOrders.length})</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {previousOrders.map((order, idx) => (
            <div key={order.orderId} className="bg-slate-50 rounded-xl p-4 border border-slate-200 hover:border-blue-300 transition-all">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-600">
                      {idx === 0 ? '🕐 Most Recent' : `${idx + 1} order${idx > 0 ? 's' : ''} ago`}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(order.orderDate).toLocaleDateString('en-IN', { 
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Order #{order.orderNumber?.slice(0, 8) || 'N/A'}</p>
                </div>
                <p className="text-lg font-bold text-emerald-600">₹{fmtNum(order.totalAmount)}</p>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-3">
                {order.items.slice(0, 4).map((item: any, i: number) => (
                  <span key={i} className="bg-white px-2 py-1 rounded-lg border border-slate-200 text-xs text-slate-600">
                    {item.productName} ({item.quantity})
                  </span>
                ))}
                {order.items.length > 4 && (
                  <span className="bg-white px-2 py-1 rounded-lg border border-slate-200 text-xs text-blue-500">
                    +{order.items.length - 4} more
                  </span>
                )}
              </div>
              
              {order.remarks && (
                <div className="text-xs text-slate-400 bg-white p-2 rounded-lg border border-slate-100 mb-3">
                  📝 Retail: {order.remarks.substring(0, 100)}{order.remarks.length > 100 ? '...' : ''}
                </div>
              )}
              
              <button
                onClick={() => onUseOrder(order)}
                className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Plus size={14} /> Use This Order
              </button>
            </div>
          ))}
        </div>
        
        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-3 rounded-b-2xl text-center text-xs text-slate-400">
          Click "Use This Order" to load items into current bill
        </div>
      </div>
    </>
  );
}