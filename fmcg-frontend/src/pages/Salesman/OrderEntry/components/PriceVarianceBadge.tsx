// PATH: src/pages/Salesman/OrderEntry/components/PriceVarianceBadge.tsx
import { AlertTriangle } from 'lucide-react';

// ── Kept in sync with the copy of this component in ../types.tsx (the one
// OrderEntry.tsx actually imports). Selling price must stay within ±10% of
// base price; outside that band, a warning is shown. ──
export function PriceVarianceBadge({ base, selling }: { base: number; selling: number }) {
  if (!base || !selling) return null;

  const lowerBound = base * 0.9;
  const upperBound = base * 1.1;

  if (selling < lowerBound) {
    return (
      <p style={{ margin: '6px 0 0', fontSize: 11, fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
        <AlertTriangle size={12} /> Price is less than 10% of base price (min ₹{lowerBound.toFixed(2)})
      </p>
    );
  }

  if (selling > upperBound) {
    return (
      <p style={{ margin: '6px 0 0', fontSize: 11, fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
        <AlertTriangle size={12} /> Price is greater than 10% of base price (max ₹{upperBound.toFixed(2)})
      </p>
    );
  }

  return null;
}