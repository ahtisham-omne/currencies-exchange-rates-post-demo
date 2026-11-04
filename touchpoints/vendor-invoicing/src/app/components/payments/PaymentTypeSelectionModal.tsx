import { X, Banknote, Wallet } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import type { RecordPaymentMode } from '@/app/components/payments/RecordPaymentFlow';

interface PaymentTypeSelectionModalProps {
  onClose: () => void;
  onSelectType: (mode: RecordPaymentMode) => void;
}

// Mirrors InvoiceTypeSelectionModal — the "pick a starting point" two-card
// picker. Payment owns a green identity, Prepayment a purple one.
export function PaymentTypeSelectionModal({ onClose, onSelectType }: PaymentTypeSelectionModalProps) {
  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-border animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 pt-6 pb-2 text-center relative">
          <h2 className="text-[17px] text-foreground tracking-tight" style={{ fontWeight: 700 }}>Record Vendor Payment</h2>
          <p className="text-[12px] text-slate-500 mt-1" style={{ fontWeight: 400 }}>
            Pay against an existing invoice, or record an advance before invoicing.
          </p>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content — two option cards, each with its own tone (green / purple). */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Option 1: Payment — GREEN identity */}
          <div className="group relative flex flex-col h-full border border-border rounded-xl p-5 bg-white transition-all duration-200 hover:border-emerald-300 hover:shadow-[0_4px_16px_-4px_rgba(16,185,129,0.12)]">
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 mb-4 transition-all duration-200 group-hover:bg-emerald-600 group-hover:text-white">
              <Banknote className="w-5 h-5" />
            </div>

            <div className="flex-1 space-y-2 mb-6">
              <h3 className="text-[15px] text-foreground leading-tight" style={{ fontWeight: 700 }}>
                Pay Invoices
              </h3>
              <p className="text-[12px] text-slate-600 leading-snug">
                Settle approved invoices you already have. Record full or partial payments, one per vendor.
              </p>
              <div className="pt-1">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100"
                  style={{ fontWeight: 500 }}
                >
                  Invoice Already Exists
                </span>
              </div>
            </div>

            <Button
              onClick={() => onSelectType('pay')}
              className="w-full bg-slate-800 hover:bg-[#0f172a] text-white h-9 rounded-lg text-[11px] transition-all shadow-sm active:scale-[0.98]"
              style={{ fontWeight: 600 }}
            >
              Continue
            </Button>
          </div>

          {/* Option 2: Prepayment — PURPLE identity */}
          <div className="group relative flex flex-col h-full border border-border rounded-xl p-5 bg-white transition-all duration-200 hover:border-purple-300 hover:shadow-[0_4px_16px_-4px_rgba(168,85,247,0.12)]">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600 mb-4 transition-all duration-200 group-hover:bg-purple-500 group-hover:text-white">
              <Wallet className="w-5 h-5" />
            </div>

            <div className="flex-1 space-y-2 mb-6">
              <h3 className="text-[15px] text-foreground leading-tight" style={{ fontWeight: 700 }}>
                Record Prepayment
              </h3>
              <p className="text-[12px] text-slate-600 leading-snug">
                Record a prepayment against a pre-invoice, or against the vendor, then apply it to an invoice later.
              </p>
              <div className="pt-1">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] bg-purple-50 text-purple-700 border border-purple-100"
                  style={{ fontWeight: 500 }}
                >
                  Before an Invoice Exists
                </span>
              </div>
            </div>

            <Button
              onClick={() => onSelectType('prepay')}
              className="w-full bg-slate-800 hover:bg-[#0f172a] text-white h-9 rounded-lg text-[11px] transition-all shadow-sm active:scale-[0.98]"
              style={{ fontWeight: 600 }}
            >
              Continue
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}
