// PATH: src/pages/Salesman/OrderEntry/components/PreviousOrdersModal.tsx
// FIXES:
// 1. "+N more" is now an actual clickable button that expands to show every
//    item in that past order — previously it was static text with no way to
//    ever see the remaining items.
// 2. Each item shows the SELLING PRICE actually charged in that order
//    (sellingPrice — frozen at the time the order was placed, same snapshot
//    system used everywhere else in this app). Deliberately NOT the
//    product's current base price — base price can change after the fact,
//    but what the salesman needs here is what was actually charged.
// 3. REMOVED the order-level total amount — with per-item price now visible,
//    the aggregate total was redundant clutter.
// 4. Rebuilt in dark theme (same tokens as OrderEntry.tsx itself) instead of
//    a plain white popup that clashed against the dark page around it.

import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { CustomerOrderHistoryDto } from '../../../../types';

// ── Same dark theme tokens as OrderEntry.tsx, so this modal matches the page
// it appears on instead of standing out as a light popup on a dark screen. ──
const D = {
  bg:      '#0f172a',
  card:    '#1e293b',
  card2:   '#243447',
  border:  '#334155',
  accent:  '#3b82f6',
  accentH: '#2563eb',
  green:   '#22c55e',
  text:    '#f1f5f9',
  muted:   '#94a3b8',
  sub:     '#64748b',
};

interface PreviousOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  previousOrders: CustomerOrderHistoryDto[];
  onUseOrder: (order: CustomerOrderHistoryDto) => void;
}

export function PreviousOrdersModal({ isOpen, onClose, previousOrders, onUseOrder }: PreviousOrdersModalProps) {
  // ── which orders currently have their full item list expanded ──
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  function toggleExpanded(orderId: string) {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 500 }} onClick={onClose} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: '100%', maxWidth: 720, maxHeight: '88vh',
        background: D.bg, borderRadius: 18, zIndex: 500,
        border: `1px solid ${D.border}`, boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{
          position: 'sticky', top: 0, background: D.card,
          borderBottom: `1px solid ${D.border}`,
          padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', background: `linear-gradient(135deg, ${D.accent}, ${D.accentH})`, borderRadius: 9, padding: '6px 10px' }}>
              <ChevronLeft size={16} color="#fff" style={{ marginRight: -3 }} />
              <ChevronRight size={16} color="#fff" />
            </div>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: D.text }}>Previous Orders</h2>
            <span style={{ fontSize: 15, color: D.sub }}>({previousOrders.length})</span>
          </div>
          <button
            onClick={onClose}
            style={{ padding: 8, borderRadius: 8, background: 'transparent', border: 'none', color: D.muted, cursor: 'pointer', display: 'flex' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = D.card2}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {previousOrders.map((order, idx) => {
            const isExpanded = expandedOrders.has(String(order.orderId));
            const visibleItems = isExpanded ? order.items : order.items.slice(0, 4);
            const hiddenCount = order.items.length - 4;

            return (
              <div
                key={order.orderId}
                style={{
                  background: D.card, borderRadius: 16, padding: 18,
                  border: `1px solid ${D.border}`, transition: 'border-color 0.15s',
                }}
              >
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: D.text }}>
                      {idx === 0 ? '🕐 Most Recent' : `${idx + 1} orders ago`}
                    </span>
                    <span style={{ fontSize: 13, color: D.sub }}>
                      {new Date(order.orderDate).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: D.sub }}>Order #{order.orderNumber?.slice(0, 8) || 'N/A'}</p>
                </div>

                {/* ── Item list — each row shows the price actually charged that
                day (frozen), not today's current base price. ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {visibleItems.map((item: any, i: number) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                        background: D.bg, padding: '10px 14px', borderRadius: 10,
                        border: `1px solid ${D.border}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: D.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.productName}
                        </span>
                        <span style={{ fontSize: 13, color: D.sub, whiteSpace: 'nowrap' }}>
                          × {item.quantity}{item.unitSymbol ? ` ${item.unitSymbol}` : ''}
                        </span>
                      </div>
                      {item.sellingPrice != null && (
                        <span style={{ fontSize: 13, fontWeight: 700, color: D.muted, whiteSpace: 'nowrap' }}>
                          ₹{item.sellingPrice} <span style={{ fontWeight: 400, color: D.sub }}>each</span>
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* ── FIX: was static "+N more" text — now an actual button that
                expands the list in place, with "Show less" to collapse back. ── */}
                {order.items.length > 4 && (
                  <button
                    onClick={() => toggleExpanded(String(order.orderId))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      fontSize: 13, fontWeight: 700, color: D.accent,
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '2px 2px 12px', fontFamily: 'inherit',
                    }}
                  >
                    {isExpanded ? (
                      <>Show less <ChevronUp size={14} /></>
                    ) : (
                      <>+{hiddenCount} more item{hiddenCount !== 1 ? 's' : ''} <ChevronDown size={14} /></>
                    )}
                  </button>
                )}

                {order.remarks && (
                  <div style={{ fontSize: 13, color: D.muted, background: D.bg, padding: 10, borderRadius: 10, border: `1px solid ${D.border}`, marginBottom: 12 }}>
                    📝 Retail: {order.remarks}
                  </div>
                )}

                <button
                  onClick={() => onUseOrder(order)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '12px', borderRadius: 12, border: 'none',
                    background: `${D.accent}22`, color: D.accent,
                    fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = `${D.accent}33`}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = `${D.accent}22`}
                >
                  <Plus size={16} /> Use This Order
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}0