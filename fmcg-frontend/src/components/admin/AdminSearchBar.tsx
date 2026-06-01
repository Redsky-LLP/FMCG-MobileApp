// PATH: src/components/admin/AdminSearchBar.tsx
// Premium Admin Search Bar — White & Blue Design System
// Standalone component; pass onSearch callback and optional placeholder.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search, X, Clock, TrendingUp, FileText,
  ShoppingCart, Users, Route,
} from 'lucide-react';

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

export function AdminSearchBar({
  onSearch,
  placeholder = 'Search routes, active distributors, salesmen logs, or transaction invoices…',
  className = '',
}: AdminSearchBarProps) {
  const [query,     setQuery]     = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [recent,    setRecent]    = useState<string[]>([]);
  const inputRef     = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /* Persist recent searches in session */
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

  /* Close dropdown on outside click */
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
      {/* ── Input container ── */}
      <div
        className={`
          relative flex items-center bg-white rounded-2xl border transition-all duration-200
          ${isFocused
            ? 'border-blue-400 shadow-[0_0_0_3px_rgba(37,99,235,0.15),0_4px_20px_rgba(37,99,235,0.12)]'
            : 'border-slate-200 shadow-[0_1px_4px_rgba(15,23,42,0.06)] hover:border-slate-300'
          }
        `}
      >
        {/* Search icon */}
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

        {/* Clear button */}
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* ── Dropdown suggestions ── */}
      {showDropdown && (
        <div
          className="
            absolute top-full left-0 right-0 mt-2 z-50
            bg-white rounded-2xl border border-slate-100
            shadow-[0_12px_48px_rgba(15,23,42,0.14),0_4px_16px_rgba(15,23,42,0.06)]
            overflow-hidden
          "
        >
          {/* Recent searches */}
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
                    <Clock size={13} className="text-slate-400" />
                  </div>
                  <span className="truncate">{r}</span>
                </button>
              ))}
            </div>
          )}

          {/* Quick suggestions */}
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

          {/* Keyboard hint */}
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