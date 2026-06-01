// PATH: src/pages/Salesman/OrderEntry/components/ProductSidebar.tsx
// FIXED: Added top offset for navbar, removed search icon

import { Package, X } from 'lucide-react';
import { ProductDto, fmtNum } from '../../../../types';

interface ProductSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  filteredProducts: ProductDto[];
  lines: Array<{ product: ProductDto; qty: number }>;
  onAddProduct: (product: ProductDto) => void;
  canEdit: boolean;
  searchInputRef: React.RefObject<HTMLInputElement>;
}

export function ProductSidebar({
  isOpen,
  onClose,
  search,
  onSearchChange,
  filteredProducts,
  lines,
  onAddProduct,
  canEdit,
  searchInputRef,
}: ProductSidebarProps) {
  if (!isOpen || !canEdit) return null;

  // Get navbar height from CSS variable or default to 64px
  const navbarHeight = typeof window !== 'undefined' 
    ? getComputedStyle(document.documentElement).getPropertyValue('--nav-h').trim() || '64px'
    : '64px';

  return (
    <div 
      className="fixed right-0 w-[340px] bg-white border-l border-slate-200 shadow-xl z-40 flex flex-col"
      style={{ 
        top: 'var(--nav-h, 64px)',
        height: `calc(100vh - var(--nav-h, 64px))`
      }}
    >
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 text-sm">Products</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 transition-colors text-slate-400"
          >
            <X size={16} />
          </button>
        </div>
        
        {/* Search input - Clean, no icon */}
        <div className="mt-3">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-slate-50"
          />
        </div>
        
        {/* Results count */}
        <div className="mt-1.5 text-xs text-slate-400">
          {filteredProducts.length} item{filteredProducts.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Product List - Scrollable */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredProducts.length === 0 && search && (
          <div className="text-center py-10">
            <Package size={36} className="mx-auto text-slate-300 mb-2 opacity-40" />
            <p className="text-slate-400 text-sm">No products found</p>
          </div>
        )}
        
        {filteredProducts.length === 0 && !search && (
          <div className="text-center py-10">
            <Package size={36} className="mx-auto text-slate-300 mb-2 opacity-40" />
            <p className="text-slate-400 text-sm">No products available</p>
          </div>
        )}

        {filteredProducts.map((product: ProductDto) => {
          const isInBill = lines.some(l => l.product.id === product.id);
          const existingQty = lines.find(l => l.product.id === product.id)?.qty || 0;
          
          return (
            <button
              key={product.id}
              onClick={() => onAddProduct(product)}
              className={`w-full text-left p-2.5 rounded-lg border transition-all duration-150 ${
                isInBill 
                  ? 'border-emerald-200 bg-emerald-50/40' 
                  : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/20 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-slate-800 text-sm truncate">{product.nameEnglish}</p>
                    {isInBill && (
                      <span className="inline-flex items-center text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full shrink-0">
                        {existingQty} in bill
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      {product.productGroupName || 'General'}
                    </span>
                    <span className="text-xs text-slate-400">{product.productUnitName || 'Unit'}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-emerald-600">₹{fmtNum(product.basePrice)}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="bg-slate-50 border-t border-slate-200 px-3 py-2 text-xs text-slate-400 text-center flex-shrink-0">
        Click to add to bill
      </div>
    </div>
  );
}