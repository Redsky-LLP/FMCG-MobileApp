// PATH: src/components/salesman/SubmitAllOrdersModal.tsx
// NEW FILE - Modal for submitting all orders

import { X, Send, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Spinner } from '../ui';

interface SubmitAllOrdersModalProps {
  isOpen: boolean;
  draftCount: number;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SubmitAllOrdersModal({
  isOpen,
  draftCount,
  isSubmitting,
  onConfirm,
  onCancel,
}: SubmitAllOrdersModalProps) {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onCancel}
      />
      <div
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl z-50 animate-slide-up"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1 bg-slate-300 rounded-full" />
        </div>

        <div className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Send size={18} className="text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Submit All Orders</h2>
                <p className="text-xs text-slate-500">{draftCount} draft order(s) ready</p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X size={18} className="text-slate-400" />
            </button>
          </div>

          {/* Warning Message */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Important Notice</p>
                <p className="text-sm text-amber-700 mt-1">
                  You are about to submit {draftCount} draft order(s). Once submitted, they will be sent to the admin for approval and cannot be edited further.
                </p>
              </div>
            </div>
          </div>

          {/* What happens next */}
          <div className="bg-slate-50 rounded-xl p-4 mb-6">
            <p className="text-sm font-semibold text-slate-700 mb-3">What happens next?</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-600">1</span>
                </div>
                <span className="text-sm text-slate-600">Admin reviews your orders</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-600">2</span>
                </div>
                <span className="text-sm text-slate-600">Admin approves the orders</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-600">3</span>
                </div>
                <span className="text-sm text-slate-600">You can start delivery once orders are closed</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 active:scale-95 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isSubmitting}
              className="flex-1 py-3 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <Spinner size={18} />
              ) : (
                <>
                  <Send size={16} />
                  Submit {draftCount} Order{draftCount > 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}