// PATH: src/pages/Salesman/OrderEntry/types.tsx
import { ProductDto, CustomerOrderHistoryDto } from '../../../types';
import { AlertTriangle } from 'lucide-react';

export interface LineItem {
  product: ProductDto;
  qty: number;
  sellingPrice: number;
  unit: string;
  productId: string;
}

// ── Selling price must stay within ±10% of the product's base price.
// Below base*0.9 → "less than 10%" warning. Above base*1.1 → "greater than
// 10%" warning. Inside that band, nothing is shown. ──
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