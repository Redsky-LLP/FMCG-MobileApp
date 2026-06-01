import { ShoppingCart, AlertTriangle, Eye } from 'lucide-react';

interface RetailItemsSectionProps {
  remarks: string;
  canEdit: boolean;
  onRemarksChange: (value: string) => void;
}

const QUICK_ITEMS = ['Savala - 10 kg', 'Colli - 10 kg', 'Waz - 24', 'Duocsu - 24', 'Salt - 25 kg', 'Sugar - 50 kg'];

export function RetailItemsSection({ remarks, canEdit, onRemarksChange }: RetailItemsSectionProps) {
  return (
    <div className="mb-6">
      <label className="flex flex-wrap items-center gap-2 text-base font-bold text-slate-800 mb-2">
        <ShoppingCart size={18} className="text-blue-600" />
        Retail Items
        <span className="text-xs font-normal text-slate-400 ml-2">(Enter smaller items here)</span>
        {remarks && remarks.trim() && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full ml-2">
            ✓ Added
          </span>
        )}
      </label>
      
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
        <p className="text-sm text-amber-700 flex items-center gap-1">
          <AlertTriangle size={12} />
          <span className="font-medium">Example format:</span> Savala - 10 kg, Colli - 10 kg, Waz - 24, Duocsu - 24
        </p>
        <p className="text-xs text-amber-600 mt-1 ml-5">
          💡 Tip: Enter each item on a new line or separate with commas
        </p>
      </div>
      
      <textarea
        className={`w-full px-4 py-3 border border-slate-200 rounded-xl text-base focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none bg-white font-mono ${!canEdit ? 'bg-slate-50 text-slate-500' : ''}`}
        rows={4}
        placeholder={`Enter retail items here (one per line or comma separated)

Examples:
Savala - 10 kg
Colli - 10 kg
Waz - 24 pieces
Duocsu - 24 units
Salt - 25 kg
Sugar - 50 kg`}
        value={remarks}
        onChange={e => canEdit && onRemarksChange(e.target.value)}
        disabled={!canEdit}
      />
      
      {canEdit && (
        <div className="mt-3">
          <p className="text-sm text-slate-500 mb-2">Quick add common items:</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_ITEMS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  const newRemarks = remarks ? `${remarks}\n${item}` : item;
                  onRemarksChange(newRemarks);
                }}
                className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-full transition-colors"
              >
                + {item}
              </button>
            ))}
          </div>
        </div>
      )}
      
      <div className="flex justify-between items-center mt-2">
        <p className="text-sm text-slate-400">
          These items will appear in the order's remarks/notes section
        </p>
        <p className={`text-sm ${remarks.length > 500 ? 'text-amber-500' : 'text-slate-400'}`}>
          {remarks.length}/1000 characters
        </p>
      </div>
      
      {remarks && remarks.trim() && (
        <div className="mt-3 bg-slate-50 rounded-lg p-3 border border-slate-200">
          <p className="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-1">
            <Eye size={12} /> Preview:
          </p>
          <div className="whitespace-pre-wrap font-mono text-sm bg-white p-2 rounded border border-slate-100 max-h-32 overflow-y-auto text-slate-700">
            {remarks}
          </div>
        </div>
      )}
    </div>
  );
}