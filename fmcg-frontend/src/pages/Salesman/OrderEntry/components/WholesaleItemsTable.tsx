import { Package, Plus, Minus, Trash2 } from 'lucide-react';
import { LineItem } from '../types';
import { PriceVarianceBadge } from '../types';
import { useIsMobile } from '../../../../hooks/useIsMobile';

interface WholesaleItemsTableProps {
  lines: LineItem[];
  totalAmount: number;
  totalItems: number;
  canEdit: boolean;
  isSidebarOpen: boolean;
  onAddItem: () => void;
  onQuantityInput: (productId: string, value: string) => void;
  onQuantityBlur: (productId: string) => void;
  onUpdateQty: (productId: string, delta: number) => void;
  onSetPrice: (productId: string, value: string) => void;
  onRemoveItem: (productId: string) => void;
  getDisplayQty: (productId: string, actualQty: number) => string;
  fmtNum: (num: number) => string;
}

export function WholesaleItemsTable({
  lines,
  totalAmount,
  totalItems,
  canEdit,
  isSidebarOpen,
  onAddItem,
  onQuantityInput,
  onQuantityBlur,
  onUpdateQty,
  onSetPrice,
  onRemoveItem,
  getDisplayQty,
  fmtNum,
}: WholesaleItemsTableProps) {
  const isMobile = useIsMobile();

  if (lines.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <Package size={18} className="text-emerald-600" />
          Wholesale Items
        </h2>
        {canEdit && !isSidebarOpen && (
          <button
            onClick={onAddItem}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            <Plus size={14} /> Add Item
          </button>
        )}
      </div>

      {isMobile ? (
        /* ── Mobile: stacked cards ────────────────────────────────────────── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lines.map((line) => (
            <div
              key={line.product.id}
              style={{
                background: '#fff',
                border: '1px solid #E2E8F0',
                borderRadius: 14,
                padding: '14px 16px',
              }}
            >
              {/* Product name + remove */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>{line.product.nameEnglish}</div>
                  {line.product.nameMalayalam && (
                    <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }} lang="ml">{line.product.nameMalayalam}</div>
                  )}
                  <PriceVarianceBadge base={line.product.basePrice} selling={line.sellingPrice} />
                </div>
                {canEdit && (
                  <button onClick={() => onRemoveItem(line.product.id)} style={{ color: '#f87171', flexShrink: 0, padding: 4 }}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {/* Qty + Unit + Price row */}
              <div style={{ display: 'grid', gridTemplateColumns: canEdit ? '1fr 1fr' : '1fr 1fr 1fr', gap: 12 }}>
                {/* Quantity */}
                <div>
                  <div style={{ fontSize: 11, color: '#64748B', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Quantity</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {canEdit && (
                      <button
                        onClick={() => onUpdateQty(line.product.id, -1)}
                        style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#64748B', cursor: 'pointer' }}
                      >
                        <Minus size={14} />
                      </button>
                    )}
                    <input
                      type="text"
                      inputMode="numeric"
                      value={getDisplayQty(line.product.id, line.qty)}
                      onChange={(e) => onQuantityInput(line.product.id, e.target.value)}
                      onBlur={() => onQuantityBlur(line.product.id)}
                      disabled={!canEdit}
                      style={{
                        width: canEdit ? 52 : 60, textAlign: 'center',
                        padding: '6px 4px', border: '1px solid #E2E8F0',
                        borderRadius: 8, fontSize: 15, fontWeight: 700,
                        background: canEdit ? '#fff' : '#F8FAFC',
                        color: canEdit ? '#0F172A' : '#64748B',
                      }}
                    />
                    {canEdit && (
                      <button
                        onClick={() => onUpdateQty(line.product.id, 1)}
                        style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#64748B', cursor: 'pointer' }}
                      >
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>{line.unit}</div>
                </div>

                {/* Price + Total */}
                <div>
                  <div style={{ fontSize: 11, color: '#64748B', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Price (₹)</div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={line.sellingPrice}
                    onChange={e => onSetPrice(line.product.id, e.target.value)}
                    disabled={!canEdit}
                    style={{
                      width: '100%', textAlign: 'right',
                      padding: '6px 10px', border: '1px solid #E2E8F0',
                      borderRadius: 8, fontSize: 15, fontWeight: 700,
                      background: canEdit ? '#fff' : '#F8FAFC',
                      color: canEdit ? '#0F172A' : '#64748B',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ textAlign: 'right', marginTop: 6, fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                    = ₹{fmtNum(line.qty * line.sellingPrice)}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Total footer */}
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: '#166534', fontSize: 14 }}>Total Wholesale</span>
            <span style={{ fontWeight: 800, fontSize: 20, color: '#166534' }}>₹{fmtNum(totalAmount)}</span>
          </div>
        </div>
      ) : (
        /* ── Desktop: horizontal table ────────────────────────────────────── */
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-500 uppercase">Product</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-500 uppercase w-28">Quantity</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-500 uppercase w-28">Unit</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-500 uppercase w-32">Price (₹)</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-500 uppercase w-28">Total</th>
                {canEdit && <th className="px-4 py-3 text-center w-10"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((line) => (
                <tr key={line.product.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-semibold text-slate-800 text-base">{line.product.nameEnglish}</p>
                      {line.product.nameMalayalam && (
                        <p className="text-sm text-slate-400" lang="ml">{line.product.nameMalayalam}</p>
                      )}
                      <PriceVarianceBadge base={line.product.basePrice} selling={line.sellingPrice} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {canEdit && (
                        <button
                          onClick={() => onUpdateQty(line.product.id, -1)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                        >
                          <Minus size={14} />
                        </button>
                      )}
                      <input
                        type="text"
                        inputMode="numeric"
                        value={getDisplayQty(line.product.id, line.qty)}
                        onChange={(e) => onQuantityInput(line.product.id, e.target.value)}
                        onBlur={() => onQuantityBlur(line.product.id)}
                        disabled={!canEdit}
                        className={`w-16 text-center px-2 py-2 border border-slate-200 rounded-lg text-base focus:outline-none focus:border-blue-400 ${!canEdit ? 'bg-slate-50 text-slate-500' : ''}`}
                      />
                      {canEdit && (
                        <button
                          onClick={() => onUpdateQty(line.product.id, 1)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                        >
                          <Plus size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-base text-slate-500">{line.unit}</td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={line.sellingPrice}
                      onChange={e => onSetPrice(line.product.id, e.target.value)}
                      disabled={!canEdit}
                      className={`w-28 text-right px-2 py-2 border border-slate-200 rounded-lg text-base font-semibold focus:outline-none focus:border-blue-400 ${!canEdit ? 'bg-slate-50 text-slate-500' : 'text-slate-800'}`}
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800 text-base">
                    ₹{fmtNum(line.qty * line.sellingPrice)}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => onRemoveItem(line.product.id)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200">
              <tr>
                <td colSpan={canEdit ? 5 : 4} className="px-4 py-3 text-right font-semibold text-slate-700 text-base">
                  Total Wholesale:
                </td>
                <td className="px-4 py-3 text-right font-bold text-xl text-slate-800">
                  ₹{fmtNum(totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}