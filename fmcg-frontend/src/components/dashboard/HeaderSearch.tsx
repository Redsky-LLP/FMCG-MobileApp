// PATH: src/components/dashboard/HeaderSearch.tsx
// Modern, interactive search header with blue/white aesthetic

import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, User, ChevronDown, Menu, X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

interface HeaderSearchProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export function HeaderSearch({ onSearch, placeholder = "Search orders, customers, or invoice numbers..." }: HeaderSearchProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();

  const handleSearch = (value: string) => {
    setQuery(value);
    onSearch(value);
  };

  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? 'U';

  return (
    <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        {/* Top bar with user info and actions */}
        <div className="flex items-center justify-between mb-4">
          {/* Logo / Brand */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-800 to-blue-600 flex items-center justify-center shadow-md">
              <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
            </div>
            <div>
              <span className="font-bold text-slate-800 text-sm">FMCG<span className="text-blue-600">Dist</span></span>
              <span className="text-xs text-slate-400 ml-2 hidden sm:inline">Distribution Platform</span>
            </div>
          </div>

          {/* User menu - desktop */}
          <div className="hidden sm:flex items-center gap-4">
            <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
              <Bell size={18} className="text-slate-500" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full"></span>
            </button>
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-700 to-blue-500 flex items-center justify-center shadow-sm">
                <span className="text-xs font-bold text-white">{initials}</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-700">{user?.name?.split(' ')[0] ?? 'User'}</p>
                <p className="text-xs text-slate-400">{user?.role}</p>
              </div>
              <ChevronDown size={14} className="text-slate-400" />
            </div>
          </div>

          {/* Mobile menu button */}
          <button className="sm:hidden p-2 rounded-lg hover:bg-slate-100">
            <Menu size={20} className="text-slate-600" />
          </button>
        </div>

        {/* Search bar area */}
        <div className="relative">
          <div className={`
            relative transition-all duration-200
            ${isFocused ? 'transform scale-[1.01]' : ''}
          `}>
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search size={18} className={`
                transition-colors duration-200
                ${isFocused ? 'text-blue-500' : 'text-slate-400'}
              `} />
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={placeholder}
              className={`
                w-full pl-11 pr-12 py-3.5 rounded-xl text-sm
                bg-slate-50 hover:bg-white
                border transition-all duration-200
                ${isFocused 
                  ? 'border-blue-400 bg-white shadow-lg shadow-blue-500/10 ring-2 ring-blue-500/20' 
                  : 'border-slate-200 hover:border-slate-300'
                }
                placeholder:text-slate-400
                focus:outline-none
                text-slate-700
              `}
            />
            {query && (
              <button
                onClick={() => handleSearch('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center"
              >
                <X size={16} className="text-slate-400 hover:text-slate-600 transition-colors" />
              </button>
            )}
          </div>

          {/* Search hints - shows when focused */}
          {isFocused && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden z-20 animate-fade-in">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quick Suggestions</p>
              </div>
              <div className="py-2">
                {['Recent orders', 'Today\'s routes', 'Pending collections', 'Customer statements'].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSearch(suggestion)}
                    className="w-full px-4 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-3"
                  >
                    <Search size={14} className="text-slate-400" />
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick stats chips */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-1 scrollbar-thin">
          <div className="flex-shrink-0 px-4 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
            <span className="text-xs font-semibold text-emerald-700">📋 Active Orders: 4</span>
          </div>
          <div className="flex-shrink-0 px-4 py-2 rounded-lg bg-blue-50 border border-blue-200">
            <span className="text-xs font-semibold text-blue-700">🚚 Routes Today: 1</span>
          </div>
          <div className="flex-shrink-0 px-4 py-2 rounded-lg bg-amber-50 border border-amber-200">
            <span className="text-xs font-semibold text-amber-700">💰 Pending: ₹18,400</span>
          </div>
        </div>
      </div>
    </div>
  );
}