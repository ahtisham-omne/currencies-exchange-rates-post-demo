import type { ReactNode } from 'react';
import { X, Truck, FileText, Wallet, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/app/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';
import type { ArInvoiceKind } from '@/app/data/ar/arPaymentTerms';

/* Customer invoice type picker (PRD §6, Screen 3). A verbatim fork of the
 * vendor InvoiceTypeSelectionModal (round 2 directive: same modal, only
 * data and flow differ): same 992px shell, same three-card grid, same
 * icon tiles, hover borders, glows and per-card Continue. Identities
 * follow the vendor cards: Shipment = blue (the inventory-invoice card),
 * Advance = violet (the pre-invoice card), Standalone = teal. */
interface CustomerInvoiceStartModalProps {
  onClose: () => void;
  onContinue: (kind: ArInvoiceKind) => void;
  /** Shipments with something left to bill (Ready to Invoice shipment rows). */
  shipmentsWaiting: number;
  /** Sales Rep (PRD §15): only Advance Invoice can be created. */
  advanceOnly?: boolean;
  /** Kept for the orchestrator's Back path; the vendor picker has no preselection. */
  initialKind?: ArInvoiceKind;
}

const ROLE_LOCK = 'Your role can create advance invoices from quotes only.';

export function CustomerInvoiceStartModal({ onClose, onContinue, shipmentsWaiting, advanceOnly = false }: CustomerInvoiceStartModalProps) {
  const pick = (kind: ArInvoiceKind) => {
    if (advanceOnly && kind !== 'Advance Invoice') {
      toast.error('Not available for your role', { description: ROLE_LOCK });
      return;
    }
    onContinue(kind);
  };

  // Role lock (Sales Rep): the card stays in the grid, drained of colour
  // like the vendor's locked cards, with the reason on hover.
  const lockable = (kind: ArInvoiceKind, card: ReactNode) =>
    advanceOnly && kind !== 'Advance Invoice' ? (
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md">
          <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>Not available for your role</p>
          <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{ROLE_LOCK}</p>
        </TooltipContent>
      </Tooltip>
    ) : (
      card
    );
  const isLocked = (kind: ArInvoiceKind) => advanceOnly && kind !== 'Advance Invoice';

  const continueButton = (kind: ArInvoiceKind) => (
    <Button
      onClick={() => pick(kind)}
      className={`w-full h-9 rounded-lg text-[11px] transition-all shadow-sm active:scale-[0.98] ${
        isLocked(kind) ? 'bg-slate-200 hover:bg-slate-200 text-slate-500 cursor-not-allowed gap-1.5' : 'bg-slate-800 hover:bg-[#0f172a] text-white'
      }`}
      style={{ fontWeight: 600 }}
    >
      {isLocked(kind) && <Lock className="w-3 h-3" />}
      Continue
    </Button>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Same 992px shell as the vendor picker: three ~304px cards. */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[992px] overflow-hidden border border-border animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 pt-6 pb-2 text-center relative">
          <h2 className="text-[17px] text-foreground tracking-tight" style={{ fontWeight: 700 }}>New Customer Invoice</h2>
          <p className="text-[12px] text-slate-500 mt-1" style={{ fontWeight: 400 }}>
            {advanceOnly
              ? 'Sales reps bill advances from a sent quote.'
              : 'Pick a starting point: bill goods that shipped, bill ahead of shipping, or bill a charge directly.'}
          </p>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Option 1: Shipment Invoice, BLUE identity (vendor inventory card). */}
          {lockable(
            'Shipment Invoice',
            <div
              className={`group relative flex flex-col h-full border border-border rounded-xl p-5 bg-white transition-all duration-200 ${
                isLocked('Shipment Invoice') ? 'bg-slate-50/80' : 'hover:border-blue-300 hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.12)]'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-all duration-200 ${
                  isLocked('Shipment Invoice') ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600 group-hover:bg-primary group-hover:text-white'
                }`}
              >
                <Truck className="w-5 h-5" />
              </div>

              <div className="flex-1 space-y-2 mb-6">
                <h3 className={`text-[15px] leading-tight ${isLocked('Shipment Invoice') ? 'text-slate-500' : 'text-foreground'}`} style={{ fontWeight: 700 }}>
                  Shipment Invoice
                </h3>
                <p className="text-[12px] text-slate-600 leading-snug">
                  Bill goods that have shipped, from sales orders and their shipments.
                </p>
                <div className="pt-1">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] border ${
                      isLocked('Shipment Invoice') ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-blue-50 text-blue-700 border-blue-100'
                    }`}
                    style={{ fontWeight: 500 }}
                  >
                    {shipmentsWaiting > 0
                      ? `${shipmentsWaiting} ${shipmentsWaiting === 1 ? 'Shipment' : 'Shipments'} Waiting`
                      : 'Nothing Waiting to Bill'}
                  </span>
                </div>
              </div>

              {continueButton('Shipment Invoice')}
            </div>,
          )}

          {/* Option 2: Advance Invoice, VIOLET identity (vendor pre-invoice card). */}
          <div className="group relative flex flex-col h-full border border-border rounded-xl p-5 bg-white transition-all duration-200 hover:border-violet-300 hover:shadow-[0_4px_16px_-4px_rgba(139,92,246,0.12)]">
            <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center text-violet-600 mb-4 transition-all duration-200 group-hover:bg-violet-600 group-hover:text-white">
              <Wallet className="w-5 h-5" />
            </div>

            <div className="flex-1 space-y-2 mb-6">
              <h3 className="text-[15px] text-foreground leading-tight" style={{ fontWeight: 700 }}>
                Advance Invoice
              </h3>
              <p className="text-[12px] text-slate-600 leading-snug">
                {advanceOnly
                  ? 'Bill part of a quote before the order ships. Needs a quote sent to the customer.'
                  : 'Bill part of an order before it ships. Needs a confirmed order or a sent quote. The advance is carried on the shipment invoices.'}
              </p>
              <div className="pt-1">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] bg-violet-50 text-violet-700 border border-violet-100"
                  style={{ fontWeight: 500 }}
                >
                  Before Shipping
                </span>
              </div>
            </div>

            {continueButton('Advance Invoice')}
          </div>

          {/* Option 3: Standalone Invoice, TEAL identity. */}
          {lockable(
            'Standalone',
            <div
              className={`group relative flex flex-col h-full border border-border rounded-xl p-5 bg-white transition-all duration-200 ${
                isLocked('Standalone') ? 'bg-slate-50/80' : 'hover:border-teal-300 hover:shadow-[0_4px_16px_-4px_rgba(20,184,166,0.12)]'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-all duration-200 ${
                  isLocked('Standalone') ? 'bg-slate-100 text-slate-400' : 'bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white'
                }`}
              >
                <FileText className="w-5 h-5" />
              </div>

              <div className="flex-1 space-y-2 mb-6">
                <h3 className={`text-[15px] leading-tight ${isLocked('Standalone') ? 'text-slate-500' : 'text-foreground'}`} style={{ fontWeight: 700 }}>
                  Standalone Invoice
                </h3>
                <p className="text-[12px] text-slate-600 leading-snug">
                  Bill a charge with no order or shipment, such as service fees, tooling, or recharges.
                </p>
                <div className="pt-1">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] border ${
                      isLocked('Standalone') ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-teal-50 text-teal-700 border-teal-100'
                    }`}
                    style={{ fontWeight: 500 }}
                  >
                    No Documents Required
                  </span>
                </div>
              </div>

              {continueButton('Standalone')}
            </div>,
          )}

        </div>
      </div>
    </div>
  );
}
