interface OrderSummaryProps {
  linesCount: number;
  totalAmount: number;
  remarks: string;
  fmtNum: (num: number) => string;
}

export function OrderSummary({ linesCount, totalAmount, remarks, fmtNum }: OrderSummaryProps) {
  if (linesCount === 0 && !remarks.trim()) return null;

  return (
    <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
      <h3 className="text-base font-bold text-slate-800 mb-2">Order Summary</h3>
      <div className="space-y-1 text-base">
        {linesCount > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-600">Wholesale Total:</span>
            <span className="font-semibold text-slate-800">₹{fmtNum(totalAmount)}</span>
          </div>
        )}
        {remarks.trim() && (
          <div className="flex justify-between">
            <span className="text-slate-600">Retail Items:</span>
            <span className="font-semibold text-slate-800">In remarks</span>
          </div>
        )}
        <div className="border-t border-blue-200 pt-2 mt-2 flex justify-between">
          <span className="font-bold text-slate-800">Order Total:</span>
          <span className="font-bold text-slate-800 text-xl">₹{fmtNum(totalAmount)}</span>
        </div>
      </div>
    </div>
  );
}