// PATH: src/pages/Admin/AdminDashboard.tsx
// COMPLETE REWRITE — Premium White & Blue Admin Hub
// Design System: Royal Blue (#2563EB) · Deep Navy (#1E3A8A) · Canvas White (#F8FAFC)

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  TrendingUp, ShoppingCart, Route, Users, AlertCircle,
  ArrowUpRight, ArrowDownRight, Lock, RefreshCw,
  MapPin, Package, FileText, IndianRupee, BarChart3,
  PlusCircle, ChevronRight, CheckCircle2, Clock4,
  Activity, Landmark, UserCog, CalendarDays, Gift,
  Search, X,
} from 'lucide-react';
import { analyticsApi, settlementApi } from '../../api/services';
import type { DashboardKpisDto, DailyClosureStatusDto, DailyClosureResultDto } from '../../types';
import { fmt, fmtNum } from '../../types';
import { PageLoader, Spinner, Alert, ConfirmModal } from '../../components/ui';

// ─── Inline AdminSearchBar Component ─────────────────────────────────────────

interface AdminSearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
}

interface Suggestion {
  icon: React.ElementType;
  label: string;
  category: string;
  color: string;
}

const QUICK_SUGGESTIONS: Suggestion[] = [
  { icon: ShoppingCart, label: 'Pending draft orders',         category: 'Orders',    color: '#2563EB' },
  { icon: Route,        label: "Today's active routes",        category: 'Routes',    color: '#7C3AED' },
  { icon: Users,        label: 'Salesman field activity',      category: 'Personnel', color: '#059669' },
  { icon: FileText,     label: 'Pending settlement invoices',  category: 'Finance',   color: '#D97706' },
  { icon: TrendingUp,   label: 'Month-to-date revenue report', category: 'Analytics', color: '#DC2626' },
];

function AdminSearchBar({
  onSearch,
  placeholder = 'Search routes, active distributors, salesmen logs, or transaction invoices…',
  className = '',
}: AdminSearchBarProps) {
  const [query,     setQuery]     = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [recent,    setRecent]    = useState<string[]>([]);
  const inputRef     = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('admin-search-recent');
    if (stored) setRecent(JSON.parse(stored));
  }, []);

  const pushRecent = (q: string) => {
    if (!q.trim()) return;
    const updated = [q, ...recent.filter(r => r !== q)].slice(0, 4);
    setRecent(updated);
    sessionStorage.setItem('admin-search-recent', JSON.stringify(updated));
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    onSearch(value);
  };

  const handleSelect = (value: string) => {
    setQuery(value);
    onSearch(value);
    pushRecent(value);
    setIsFocused(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim()) {
      pushRecent(query);
      setIsFocused(false);
      inputRef.current?.blur();
    }
    if (e.key === 'Escape') {
      setIsFocused(false);
      inputRef.current?.blur();
    }
  };

  const showDropdown = isFocused;

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div
        className={`
          relative flex items-center bg-white rounded-2xl border transition-all duration-200
          ${isFocused
            ? 'border-blue-400 shadow-[0_0_0_3px_rgba(37,99,235,0.15),0_4px_20px_rgba(37,99,235,0.12)]'
            : 'border-slate-200 shadow-[0_1px_4px_rgba(15,23,42,0.06)] hover:border-slate-300'
          }
        `}
      >
        <div className="absolute left-4 flex items-center pointer-events-none">
          <Search
            size={18}
            className={`transition-colors duration-200 ${isFocused ? 'text-blue-500' : 'text-slate-400'}`}
          />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="
            w-full pl-11 pr-12 py-3.5 bg-transparent rounded-2xl
            text-sm text-slate-700 placeholder:text-slate-400
            focus:outline-none
          "
        />

        {query && (
          <button
            onClick={handleClear}
            className="absolute right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          className="
            absolute top-full left-0 right-0 mt-2 z-50
            bg-white rounded-2xl border border-slate-100
            shadow-[0_12px_48px_rgba(15,23,42,0.14),0_4px_16px_rgba(15,23,42,0.06)]
            overflow-hidden
          "
        >
          {recent.length > 0 && !query && (
            <div className="border-b border-slate-100">
              <div className="px-4 pt-3 pb-2">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                  Recent
                </p>
              </div>
              {recent.map((r, i) => (
                <button
                  key={i}
                  onClick={() => handleSelect(r)}
                  className="
                    w-full px-4 py-2.5 text-left flex items-center gap-3
                    text-sm text-slate-600 hover:bg-slate-50 transition-colors
                  "
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Clock4 size={13} className="text-slate-400" />
                  </div>
                  <span className="truncate">{r}</span>
                </button>
              ))}
            </div>
          )}

          <div>
            <div className="px-4 pt-3 pb-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                {query ? 'Suggestions' : 'Quick Access'}
              </p>
            </div>
            {QUICK_SUGGESTIONS
              .filter(s => !query || s.label.toLowerCase().includes(query.toLowerCase()))
              .map((s, i) => {
                const Icon = s.icon;
                return (
                  <button
                    key={i}
                    onClick={() => handleSelect(s.label)}
                    className="
                      w-full px-4 py-2.5 text-left flex items-center gap-3
                      hover:bg-slate-50 transition-colors group
                    "
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${s.color}15` }}
                    >
                      <Icon size={13} style={{ color: s.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-slate-700 group-hover:text-slate-900 truncate block">
                        {s.label}
                      </span>
                    </div>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: `${s.color}12`, color: s.color }}
                    >
                      {s.category}
                    </span>
                  </button>
                );
              })}
          </div>

          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50">
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono shadow-sm">↵</kbd>
              to search ·
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono shadow-sm">Esc</kbd>
              to dismiss
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface NavHub {
  id: string;
  to: string;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  accent: string;        // hex
  accentBg: string;      // hex
  badge?: string;
}

// ─── Hub Navigation Configuration ────────────────────────────────────────────

const NAV_HUBS: NavHub[] = [
  {
    id:       'routes',
    to:       '/admin/routes',
    label:    'Salesmen & Routes',
    sublabel: 'Field personnel · Beat management',
    icon:     MapPin,
    accent:   '#2563EB',
    accentBg: '#EFF6FF',
  },
  {
    id:       'products',
    to:       '/admin/products',
    label:    'Global Inventory / SKUs',
    sublabel: 'Warehouse · Product catalogue',
    icon:     Package,
    accent:   '#7C3AED',
    accentBg: '#F5F3FF',
  },
  {
    id:       'orders',
    to:       '/admin/orders',
    label:    'Master Orders & Approvals',
    sublabel: 'Batch processing · Status review',
    icon:     ShoppingCart,
    accent:   '#0891B2',
    accentBg: '#ECFEFF',
  },
  {
    id:       'settlement',
    to:       '/admin/settlement',
    label:    'Collections & Ledger',
    sublabel: 'Financial settlements · Receivables',
    icon:     IndianRupee,
    accent:   '#059669',
    accentBg: '#ECFDF5',
  },
  {
    id:       'analytics',
    to:       '/admin/analytics',
    label:    'System Analytics',
    sublabel: 'Performance metrics · Reports',
    icon:     BarChart3,
    accent:   '#D97706',
    accentBg: '#FFFBEB',
  },
];

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label:   string;
  value:   string;
  icon:    React.ElementType;
  color:   string;
  bgColor: string;
  sub?:    string;
  trend?:  'up' | 'down' | 'neutral';
}

function KpiCard({ label, value, icon: Icon, color, bgColor, sub, trend }: KpiCardProps) {
  return (
    <div className="
      bg-white rounded-2xl border border-slate-100 p-5
      shadow-[0_1px_4px_rgba(15,23,42,0.06)]
      hover:shadow-[0_4px_16px_rgba(15,23,42,0.10)]
      hover:-translate-y-0.5 transition-all duration-200
      flex flex-col gap-3
    ">
      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: bgColor }}
        >
          <Icon size={18} style={{ color }} />
        </div>
        {trend && trend !== 'neutral' && (
          <div className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
            trend === 'up'
              ? 'bg-emerald-50 text-emerald-600'
              : 'bg-red-50 text-red-500'
          }`}>
            {trend === 'up'
              ? <ArrowUpRight size={12} />
              : <ArrowDownRight size={12} />
            }
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800 leading-none tracking-tight">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
      <p className="text-xs font-medium text-slate-500 leading-tight">{label}</p>
    </div>
  );
}

// ─── Hub Block ────────────────────────────────────────────────────────────────

function HubBlock({ hub }: { hub: NavHub }) {
  const Icon = hub.icon;
  return (
    <Link
      to={hub.to}
      className="
        group relative bg-white rounded-2xl border border-slate-100 p-6
        shadow-[0_1px_4px_rgba(15,23,42,0.05)]
        hover:shadow-[0_8px_28px_rgba(15,23,42,0.10)]
        hover:-translate-y-1 transition-all duration-200
        flex items-center gap-4 no-underline overflow-hidden
      "
    >
      {/* Accent sweep on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
        style={{
          background: `linear-gradient(135deg, ${hub.accentBg}80 0%, transparent 60%)`,
        }}
      />

      {/* Icon */}
      <div
        className="relative w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0
          group-hover:scale-110 transition-transform duration-200"
        style={{ backgroundColor: hub.accentBg }}
      >
        <Icon size={22} style={{ color: hub.accent }} />
      </div>

      {/* Text */}
      <div className="relative flex-1 min-w-0">
        <p className="text-[15px] font-700 text-slate-800 font-bold leading-tight">{hub.label}</p>
        <p className="text-xs text-slate-400 mt-0.5 truncate">{hub.sublabel}</p>
      </div>

      {/* Arrow */}
      <ChevronRight
        size={16}
        className="relative text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all duration-200 flex-shrink-0"
      />

      {/* Badge */}
      {hub.badge && (
        <span
          className="absolute top-3 right-10 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: `${hub.accent}18`, color: hub.accent }}
        >
          {hub.badge}
        </span>
      )}
    </Link>
  );
}

// ─── Closure Status Banner ────────────────────────────────────────────────────

function ClosureBanner({ closure }: { closure: DailyClosureStatusDto }) {
  if (closure.isClosed) {
    return (
      <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
        <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
        <p className="text-sm text-emerald-800 font-medium">
          Day closed at {new Date(closure.closedAt!).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} by{' '}
          <span className="font-bold">{closure.closedBy}</span>
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
      <Clock4 size={16} className="text-blue-600 flex-shrink-0" />
      <p className="text-sm text-blue-800 font-medium">
        <span className="font-bold">{closure.submittedOrders}</span> orders submitted ·{' '}
        <span className="font-bold">{closure.totalOrders - closure.closedOrders - closure.submittedOrders}</span> still in draft
      </p>
    </div>
  );
}

// ─── Quick Action Pill ────────────────────────────────────────────────────────

function QuickLink({ label, to, icon: Icon, color }: { label: string; to: string; icon: React.ElementType; color: string }) {
  return (
    <Link
      to={to}
      className="
        flex items-center gap-2 px-4 py-2.5 rounded-xl
        border border-slate-100 bg-white
        hover:bg-slate-50 hover:border-slate-200
        transition-all duration-150 no-underline
        text-sm font-semibold text-slate-600 hover:text-slate-800
        shadow-[0_1px_3px_rgba(15,23,42,0.05)]
        whitespace-nowrap
      "
    >
      <Icon size={14} style={{ color }} />
      {label}
    </Link>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminDashboard() {
  const navigate = useNavigate();
  const [kpis,         setKpis]         = useState<DashboardKpisDto | null>(null);
  const [closure,      setClosure]      = useState<DailyClosureStatusDto | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [closing,      setClosing]      = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closeNotes,   setCloseNotes]   = useState('');
  const [error,        setError]        = useState('');
  const [msg,          setMsg]          = useState('');
  const [closureResult, setClosureResult] = useState<DailyClosureResultDto | null>(null);
  const [searchQuery,  setSearchQuery]  = useState('');

  async function load() {
    setLoading(true);
    try {
      const [k, c] = await Promise.all([
        analyticsApi.getDashboardKpis(),
        settlementApi.getStatus(),
      ]);
      setKpis(k);
      setClosure(c);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCloseDay() {
    setClosing(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res   = await settlementApi.closeDay(today, closeNotes || undefined);
      setClosureResult(res);
      setMsg(`Day closed successfully. ${res.ordersLocked} orders locked. Revenue: ${fmt(res.totalRevenue)}`);
      setConfirmClose(false);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to close day');
    } finally {
      setClosing(false);
    }
  }

  if (loading) return <PageLoader />;

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  // Build KPI rows from data
  const kpiCards: KpiCardProps[] = kpis ? [
    {
      label:   'Today Revenue',
      value:   fmt(kpis.todayRevenue),
      icon:    TrendingUp,
      color:   '#2563EB',
      bgColor: '#EFF6FF',
      trend:   'up',
    },
    {
      label:   'Today Orders',
      value:   fmtNum(kpis.todayOrders),
      icon:    ShoppingCart,
      color:   '#7C3AED',
      bgColor: '#F5F3FF',
    },
    {
      label:   'Today Variance',
      value:   fmt(kpis.todayVariance),
      icon:    kpis.todayVariance >= 0 ? ArrowUpRight : ArrowDownRight,
      color:   kpis.todayVariance >= 0 ? '#059669' : '#DC2626',
      bgColor: kpis.todayVariance >= 0 ? '#ECFDF5' : '#FEF2F2',
      trend:   kpis.todayVariance >= 0 ? 'up' : 'down',
    },
    {
      label:   'Active Routes',
      value:   fmtNum(kpis.activeRoutes),
      icon:    Route,
      color:   '#0891B2',
      bgColor: '#ECFEFF',
    },
    {
      label:   'Active Customers',
      value:   fmtNum(kpis.activeCustomers),
      icon:    Users,
      color:   '#D97706',
      bgColor: '#FFFBEB',
    },
    {
      label:   'Pending Settlement',
      value:   fmt(kpis.pendingSettlement),
      icon:    AlertCircle,
      color:   '#DC2626',
      bgColor: '#FEF2F2',
    },
    {
      label:   'MTD Revenue',
      value:   fmt(kpis.mtdRevenue),
      icon:    TrendingUp,
      color:   '#059669',
      bgColor: '#ECFDF5',
      sub:     `${fmtNum(kpis.mtdOrders)} orders`,
      trend:   'up',
    },
    {
      label:   'Top Route',
      value:   kpis.topRouteName ?? 'N/A',
      icon:    Activity,
      color:   '#2563EB',
      bgColor: '#EFF6FF',
      sub:     kpis.topRouteRevenue ? fmt(kpis.topRouteRevenue) : undefined,
    },
  ] : [];

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-8">

        {/* ── PAGE HEADER ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-none">
              Operations Dashboard
            </h1>
            <p className="text-sm text-slate-400 mt-1.5 flex items-center gap-1.5">
              <CalendarDays size={13} />
              {today}
            </p>
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              className="btn btn-outline btn-sm flex items-center gap-1.5"
              onClick={load}
              title="Refresh dashboard"
            >
              <RefreshCw size={13} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {!closure?.isClosed && (
              <button
                className="btn btn-sm flex items-center gap-1.5 text-white"
                style={{ background: '#DC2626', boxShadow: '0 2px 8px rgba(220,38,38,0.28)' }}
                onClick={() => setConfirmClose(true)}
              >
                <Lock size={13} />
                Close Day
              </button>
            )}

            {/* FAB — primary action */}
            <button
              className="btn btn-primary btn-sm flex items-center gap-1.5"
              onClick={() => navigate('/admin/routes')}
            >
              <PlusCircle size={14} />
              <span className="hidden sm:inline">Assign New Route</span>
              <span className="sm:hidden">New Route</span>
            </button>
          </div>
        </div>

        {/* ── ALERTS ──────────────────────────────────────────────── */}
        {error && <Alert variant="error">{error}</Alert>}
        {msg   && (
          <div className="space-y-3">
            <Alert variant="success">{msg}</Alert>
            {/* Updated: using optional chaining with sheet URLs that may exist */}
            {(closureResult && (closureResult as any).loadingSheetUrl) && (
              <div className="flex gap-3 flex-wrap">
                <a
                  href={(closureResult as any).loadingSheetUrl}
                  target="_blank" rel="noreferrer"
                  className="btn btn-outline btn-sm"
                >
                  📦 Download Loading Sheet
                </a>
                {(closureResult as any).billingSheetUrl && (
                  <a
                    href={(closureResult as any).billingSheetUrl}
                    target="_blank" rel="noreferrer"
                    className="btn btn-outline btn-sm"
                  >
                    🧾 Download Billing Sheet
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── CLOSURE STATUS ───────────────────────────────────────── */}
        {closure && <ClosureBanner closure={closure} />}

        {/* ── SEARCH BAR ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5
          shadow-[0_1px_4px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Admin Search
          </p>
          <AdminSearchBar onSearch={setSearchQuery} />
        </div>

        {/* ── MACRO NAVIGATION HUBS ───────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-700">Control Centre</h2>
            <span className="text-xs text-slate-400">{NAV_HUBS.length} modules</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {NAV_HUBS.map(hub => (
              <HubBlock key={hub.id} hub={hub} />
            ))}
          </div>
        </div>

        {/* ── KPI METRICS ─────────────────────────────────────────── */}
        {kpis && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-700">Today at a Glance</h2>
              <span className="text-xs text-slate-400">Live metrics</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {kpiCards.map((k, i) => (
                <KpiCard key={i} {...k} />
              ))}
            </div>
          </div>
        )}

        {/* ── QUICK LINKS ──────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6
          shadow-[0_1px_4px_rgba(15,23,42,0.06)]">
          <h2 className="text-base font-bold text-slate-700 mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-2">
            <QuickLink label="View Orders"       to="/admin/orders"      icon={ShoppingCart} color="#2563EB" />
            <QuickLink label="Manage Routes"     to="/admin/routes"      icon={MapPin}       color="#7C3AED" />
            <QuickLink label="Settlement"        to="/admin/settlement"  icon={Landmark}     color="#059669" />
            <QuickLink label="Analytics"         to="/admin/analytics"   icon={BarChart3}    color="#D97706" />
            <QuickLink label="Reports"           to="/admin/reports"     icon={FileText}     color="#0891B2" />
            <QuickLink label="Incentives"        to="/admin/incentives"  icon={Gift}         color="#DC2626" />
            <QuickLink label="User Management"   to="/admin/users"       icon={UserCog}      color="#64748B" />
            <QuickLink label="Temp Assignments"  to="/admin/assignments" icon={CalendarDays} color="#2563EB" />
          </div>
        </div>

      </div>{/* /max-w-7xl */}

      {/* ── CLOSE DAY MODAL ─────────────────────────────────────── */}
      {confirmClose && (
        <ConfirmModal
          open={confirmClose}
          title="Close Operational Day"
          message="This will lock all submitted orders for today. This action cannot be undone."
          confirmLabel={closing ? 'Closing…' : 'Close Day'}
          danger
          onConfirm={handleCloseDay}
          onCancel={() => setConfirmClose(false)}
        />
      )}
    </div>
  );
}