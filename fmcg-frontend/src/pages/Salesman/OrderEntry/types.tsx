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

export function PriceVarianceBadge({ base, selling }: { base: number; selling: number }) {
  if (!base || !selling) return null;
  const diff = ((selling - base) / base) * 100;
  const abs = Math.abs(diff).toFixed(1);
  if (Math.abs(diff) < 0.1) return <span className="text-xs text-emerald-600">✓ At base price</span>;
  if (diff < 0) {
    return (
      <span className="text-xs text-red-500 flex items-center gap-1">
        <AlertTriangle size={11} /> {abs}% below base
      </span>
    );
  }
  return <span className="text-xs text-emerald-600">▲ +{abs}% above base</span>;
}