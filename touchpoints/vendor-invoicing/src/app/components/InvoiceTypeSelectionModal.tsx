import { X, Package, FileText, Wallet } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

/* Three separate creation flows (9/4/26 Eli review, D-01 — "the only big
 * thing we've settled on is creating two separate flows" + standalone):
 * one flow ALWAYS creates an invoice, one flow ALWAYS creates a
 * pre-invoice, regardless of PO state. Pre vs post stops being inferred
 * from the selection. Identities: Inventory = blue, Pre-Invoice = violet
 * (the established prepayment identity), Standalone moves off purple to
 * teal so it can't be confused with violet at card scale. */
interface InvoiceTypeSelectionModalProps {
  onClose: () => void;
  onSelectType: (type: 'pre-invoice' | 'inventory' | 'standalone') => void;
}

export function InvoiceTypeSelectionModal({ onClose, onSelectType }: InvoiceTypeSelectionModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Card width stays IDENTICAL to the two-card starting modals the
          other modules use (9/5/26 review): the 2-card shell is max-w-2xl
          (672px) → ~304px per card, so three cards at that same width
          need 3×304 + 2×16 gap + 48 padding = 992px. The modal widens;
          the cards never shrink. */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[992px] overflow-hidden border border-border animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 pt-6 pb-2 text-center relative">
          <h2 className="text-[17px] text-foreground tracking-tight" style={{ fontWeight: 700 }}>New Vendor Invoice</h2>
          <p className="text-[12px] text-slate-500 mt-1" style={{ fontWeight: 400 }}>
            Pick a starting point: invoice received goods, pay ahead of receiving, or invoice the vendor directly.
          </p>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content — three option cards. Each card has its own tone (blue /
            violet / teal) for icon tile, hover border, and hover glow so the
            hover state reinforces the card identity. */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Option 1: Inventory Invoice — BLUE identity. Always creates a
              real (post-receiving) invoice. */}
          <div className="group relative flex flex-col h-full border border-border rounded-xl p-5 bg-white transition-all duration-200 hover:border-blue-300 hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.12)]">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 mb-4 transition-all duration-200 group-hover:bg-primary group-hover:text-white">
              <Package className="w-5 h-5" />
            </div>

            <div className="flex-1 space-y-2 mb-6">
              <h3 className="text-[15px] text-foreground leading-tight" style={{ fontWeight: 700 }}>
                Inventory Invoice
              </h3>
              <p className="text-[12px] text-slate-600 leading-snug">
                Create an invoice for goods you've received, from purchase orders and receiving documents.
              </p>
              <div className="pt-1">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] bg-blue-50 text-blue-700 border border-blue-100"
                  style={{ fontWeight: 500 }}
                >
                  Linked to Receivings
                </span>
              </div>
            </div>

            <Button
              onClick={() => onSelectType('inventory')}
              className="w-full bg-slate-800 hover:bg-[#0f172a] text-white h-9 rounded-lg text-[11px] transition-all shadow-sm active:scale-[0.98]"
              style={{ fontWeight: 600 }}
            >
              Continue
            </Button>
          </div>

          {/* Option 2: Pre-Invoice — VIOLET identity (the system-wide
              prepayment color). Always creates a pre-invoice. */}
          <div className="group relative flex flex-col h-full border border-border rounded-xl p-5 bg-white transition-all duration-200 hover:border-violet-300 hover:shadow-[0_4px_16px_-4px_rgba(139,92,246,0.12)]">
            <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center text-violet-600 mb-4 transition-all duration-200 group-hover:bg-violet-600 group-hover:text-white">
              <Wallet className="w-5 h-5" />
            </div>

            <div className="flex-1 space-y-2 mb-6">
              {/* "(Pro-Forma)" rides along (Eli 9/8): the industry term, so
                  users who know it recognize the flow at a glance. */}
              <h3 className="text-[15px] text-foreground leading-tight" style={{ fontWeight: 700 }}>
                Pre-Invoice (Pro-Forma)
              </h3>
              <p className="text-[12px] text-slate-600 leading-snug">
                Create a pre-invoice from a purchase order before goods arrive. Payments record as vendor advances and reconcile when the goods are received and invoiced.
              </p>
              <div className="pt-1">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] bg-violet-50 text-violet-700 border border-violet-100"
                  style={{ fontWeight: 500 }}
                >
                  Before Receiving
                </span>
              </div>
            </div>

            <Button
              onClick={() => onSelectType('pre-invoice')}
              className="w-full bg-slate-800 hover:bg-[#0f172a] text-white h-9 rounded-lg text-[11px] transition-all shadow-sm active:scale-[0.98]"
              style={{ fontWeight: 600 }}
            >
              Continue
            </Button>
          </div>

          {/* Option 3: Standalone Invoice — TEAL identity. */}
          <div className="group relative flex flex-col h-full border border-border rounded-xl p-5 bg-white transition-all duration-200 hover:border-teal-300 hover:shadow-[0_4px_16px_-4px_rgba(20,184,166,0.12)]">
            <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center text-teal-600 mb-4 transition-all duration-200 group-hover:bg-teal-600 group-hover:text-white">
              <FileText className="w-5 h-5" />
            </div>

            <div className="flex-1 space-y-2 mb-6">
              <h3 className="text-[15px] text-foreground leading-tight" style={{ fontWeight: 700 }}>
                Standalone Invoice
              </h3>
              <p className="text-[12px] text-slate-600 leading-snug">
                Create an invoice without a purchase order, such as utilities, rent, or services.
              </p>
              <div className="pt-1">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] bg-teal-50 text-teal-700 border border-teal-100"
                  style={{ fontWeight: 500 }}
                >
                  No Documents Required
                </span>
              </div>
            </div>

            <Button
              onClick={() => onSelectType('standalone')}
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
