// PATH: src/pages/Dashboard/MainHub.tsx
// Premium dashboard with 4-5 navigation blocks and clean spacing

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MapPin, ShoppingCart, Users, Wallet, ClipboardList, Plus,
  ChevronRight, TrendingUp, CheckCircle2, Clock, Package,
  Truck, Calendar, BarChart3, FileText, Settings, HelpCircle
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { HeaderSearch } from '../../components/dashboard/HeaderSearch';

interface NavBlock {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  color: string;
  bgColor: string;
  borderColor: string;
  stats?: string;
}

const NAV_BLOCKS: NavBlock[] = [
  {
    id: 'route-tracker',
    title: 'Route Tracker',
    description: 'Track deliveries & beat progress',
    icon: MapPin,
    href: '/salesman/routes',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-100',
    stats: '1 active route'
  },
  {
    id: 'orders',
    title: 'Order Matrix',
    description: 'Create & manage customer orders',
    icon: ShoppingCart,
    href: '/salesman/routes',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-100',
    stats: '4 pending'
  },
  {
    id: 'customers',
    title: 'Customer Outlets',
    description: 'View customer directory',
    icon: Users,
    href: '/salesman/routes',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-100',
    stats: '2 active'
  },
  {
    id: 'collections',
    title: 'Collections',
    description: 'Track payments & dues',
    icon: Wallet,
    href: '/accounts/settlement',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-100',
    stats: '₹18.4K due'
  },
  {
    id: 'incentives',
    title: 'My Incentives',
    description: 'View earnings & targets',
    icon: TrendingUp,
    href: '/salesman/incentives',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-100',
    stats: '₹2,450 earned'
  }
];

interface Order {
  id: string;
  customerName: string;
  totalAmount: number;
  status: 'draft' | 'submitted' | 'closed';
  orderDate: string;
  itemCount: number;
  date: string;
}

function getRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function MainHub() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);

  // Mock orders data (replace with API call)
  const [orders] = useState<Order[]>([
    {
      id: '1',
      customerName: 'KN Stores',
      totalAmount: 9600,
      status: 'draft',
      orderDate: '2026-05-21T19:07:00',
      itemCount: 6,
      date: '2026-05-21'
    },
    {
      id: '2',
      customerName: 'KD stores',
      totalAmount: 6400,
      status: 'draft',
      orderDate: '2026-05-21T18:47:00',
      itemCount: 4,
      date: '2026-05-21'
    },
    {
      id: '3',
      customerName: 'City Mart',
      totalAmount: 12500,
      status: 'submitted',
      orderDate: '2026-05-20T15:30:00',
      itemCount: 8,
      date: '2026-05-20'
    },
    {
      id: '4',
      customerName: 'Metro Traders',
      totalAmount: 8200,
      status: 'closed',
      orderDate: '2026-05-20T11:15:00',
      itemCount: 5,
      date: '2026-05-20'
    }
  ]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredOrders = orders.filter(order =>
    order.customerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedOrders = filteredOrders.reduce((acc, order) => {
    const dateKey = order.orderDate.split('T')[0];
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(order);
    return acc;
  }, {} as Record<string, Order[]>);

  const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const draftCount = orders.filter(o => o.status === 'draft').length;
  const submittedCount = orders.filter(o => o.status === 'submitted').length;
  const closedCount = orders.filter(o => o.status === 'closed').length;

  const firstName = user?.name?.split(' ')[0] ?? 'Salesman';

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Modern Search Header */}
      <HeaderSearch onSearch={setSearchQuery} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Welcome Section */}
        <div className="mb-8 animate-slide-up">
          <h1 className="text-2xl font-bold text-slate-800">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {firstName} 👋
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 animate-slide-up" style={{ animationDelay: '0.05s' }}>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Orders</span>
              <ShoppingCart size={14} className="text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{orders.length}</p>
            <p className="text-xs text-slate-400 mt-1">this period</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Revenue</span>
              <Wallet size={14} className="text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-emerald-600">₹{totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-1">pending settlement</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Route</span>
              <Truck size={14} className="text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-slate-800">Thiruvalla</p>
            <p className="text-xs text-slate-400 mt-1">2 customers · 75% complete</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Dues</span>
              <Clock size={14} className="text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-amber-600">₹18,400</p>
            <p className="text-xs text-slate-400 mt-1">from 2 customers</p>
          </div>
        </div>

        {/* Navigation Hub - 5 main blocks */}
        <div className="mb-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Quick Access Hub</h2>
            <Link to="/salesman/routes" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              View All <ChevronRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {NAV_BLOCKS.map((block, idx) => (
              <Link
                key={block.id}
                to={block.href}
                className="group bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-all duration-200 hover:border-blue-200 hover:-translate-y-0.5"
                style={{ animationDelay: `${0.1 + idx * 0.03}s` }}
              >
                <div className={`w-10 h-10 rounded-xl ${block.bgColor} flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
                  <block.icon size={20} className={block.color} />
                </div>
                <h3 className="font-semibold text-slate-800 text-sm">{block.title}</h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{block.description}</p>
                {block.stats && (
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <span className="text-xs font-medium text-blue-600">{block.stats}</span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Orders Section */}
        <div className="animate-slide-up" style={{ animationDelay: '0.15s' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Recent Orders</h2>
            <div className="flex gap-2">
              <div className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                <span className="text-xs font-medium text-emerald-700">Draft: {draftCount}</span>
              </div>
              <div className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200">
                <span className="text-xs font-medium text-blue-700">Submitted: {submittedCount}</span>
              </div>
              <div className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200">
                <span className="text-xs font-medium text-slate-600">Closed: {closedCount}</span>
              </div>
            </div>
          </div>

          {Object.keys(groupedOrders).length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Package size={48} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">No orders found</p>
              <p className="text-xs text-slate-400 mt-1">Try adjusting your search</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedOrders)
                .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
                .map(([date, dateOrders]) => (
                  <div key={date}>
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar size={14} className="text-blue-500" />
                      <span className="text-sm font-semibold text-slate-700">
                        {getRelativeDate(date)}
                      </span>
                      <span className="text-xs text-slate-400">({dateOrders.length} orders)</span>
                    </div>
                    <div className="space-y-3">
                      {dateOrders.map((order) => (
                        <div
                          key={order.id}
                          onClick={() => navigate(`/salesman/routes/${order.id}/order/${order.id}`)}
                          className="bg-white rounded-xl border border-slate-200 p-4 cursor-pointer hover:shadow-md hover:border-blue-200 transition-all duration-200"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h3 className="font-semibold text-slate-800">{order.customerName}</h3>
                                <span className={`
                                  text-xs px-2 py-0.5 rounded-full font-medium
                                  ${order.status === 'draft' ? 'bg-amber-50 text-amber-700 border border-amber-200' : ''}
                                  ${order.status === 'submitted' ? 'bg-blue-50 text-blue-700 border border-blue-200' : ''}
                                  ${order.status === 'closed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : ''}
                                `}>
                                  {order.status === 'draft' ? 'Draft' : order.status === 'submitted' ? 'Submitted' : 'Closed'}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-500">
                                <span>📦 {order.itemCount} items</span>
                                <span>🕐 {formatTime(order.orderDate)}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-slate-800">₹{order.totalAmount.toLocaleString()}</p>
                              <button className="mt-1 text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                                View Details <ChevronRight size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Floating Action Button - Main CTA */}
        <div className="fixed right-6 z-50" style={{ bottom: 'calc(24px + 70px)' }}>
          <button
            onClick={() => navigate('/salesman/routes')}
            className="group w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-200 hover:scale-105 flex items-center justify-center"
          >
            <Plus size={24} strokeWidth={2} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out forwards;
          opacity: 0;
        }
        .scrollbar-thin::-webkit-scrollbar {
          height: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}