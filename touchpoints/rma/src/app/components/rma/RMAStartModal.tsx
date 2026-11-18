/**
 * How the return starts.
 *
 * The old flow opened straight onto a picker that searched items, vendors,
 * orders and receipts at once and rearranged one result set under four lenses.
 * That worked while every route led to the same place. It stops working now
 * the two routes genuinely diverge:
 *
 *   by item    the returner has goods in hand and knows the part number. The
 *              vendor is a consequence -- for anything traceable it is derived
 *              from the unit and never asked.
 *   by vendor  the returner is clearing a vendor. The item is the question,
 *              and with six hundred parts on one supplier it has to be a
 *              searchable grid rather than a list to scroll.
 *
 * The card itself is `InvoiceTypeSelectionModal` from vendor invoicing,
 * unchanged: same shell, same two-column split, same per-option colour
 * identity, same footer. Raising a return and raising an invoice are the same
 * kind of decision at the same point in the journey, so they are the same
 * screen with different words in it.
 */

import { X, Package, Building2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

export type RMAStartMode = 'item' | 'vendor';

export function RMAStartModal({
  onClose,
  onSelectMode,
}: {
  onClose: () => void;
  onSelectMode: (mode: RMAStartMode) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-border animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 pt-6 pb-2 text-center relative">
          <h2 className="text-[17px] text-foreground tracking-tight" style={{ fontWeight: 700 }}>Select What to Return</h2>
          <p className="text-[12px] text-slate-500 mt-1" style={{ fontWeight: 400 }}>
            Start from the item you're sending back, or from the vendor you're returning to.
          </p>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content — two option cards. Each card has its own tone (blue/purple) for icon
            tile, hover border, and corner accent. The corner blob fades in on hover so
            the hover state visually reinforces the card identity instead of going blue
            for both. */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Option 1: By item — BLUE identity */}
          <div className="group relative flex flex-col h-full border border-border rounded-xl p-5 bg-white transition-all duration-200 hover:border-blue-300 hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.12)]">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 mb-4 transition-all duration-200 group-hover:bg-primary group-hover:text-white">
              <Package className="w-5 h-5" />
            </div>

            <div className="flex-1 space-y-2 mb-6">
              <h3 className="text-[15px] text-foreground leading-tight" style={{ fontWeight: 700 }}>
                Search by item
              </h3>
              <p className="text-[12px] text-slate-600 leading-snug">
                Search for the items to return and add them. Quantity, serial numbers and lots come next.
              </p>
              <div className="pt-1">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] bg-blue-50 text-blue-700 border border-blue-100"
                  style={{ fontWeight: 500 }}
                >
                  Traces the vendor for you
                </span>
              </div>
            </div>

            <Button
              onClick={() => onSelectMode('item')}
              className="w-full bg-primary hover:bg-blue-700 text-white h-9 rounded-lg text-[11px] uppercase tracking-wider transition-all shadow-sm active:scale-[0.98]"
              style={{ fontWeight: 600 }}
            >
              Continue
            </Button>
          </div>

          {/* Option 2: By vendor — PURPLE identity */}
          <div className="group relative flex flex-col h-full border border-border rounded-xl p-5 bg-white transition-all duration-200 hover:border-purple-300 hover:shadow-[0_4px_16px_-4px_rgba(168,85,247,0.12)]">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600 mb-4 transition-all duration-200 group-hover:bg-purple-500 group-hover:text-white">
              <Building2 className="w-5 h-5" />
            </div>

            <div className="flex-1 space-y-2 mb-6">
              <h3 className="text-[15px] text-foreground leading-tight" style={{ fontWeight: 700 }}>
                Search by vendor
              </h3>
              <p className="text-[12px] text-slate-600 leading-snug">
                Select the vendor first, then select the items you received against their orders.
              </p>
              <div className="pt-1">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] bg-purple-50 text-purple-700 border border-purple-100"
                  style={{ fontWeight: 500 }}
                >
                  Shows what you received
                </span>
              </div>
            </div>

            <Button
              onClick={() => onSelectMode('vendor')}
              className="w-full bg-primary hover:bg-blue-700 text-white h-9 rounded-lg text-[11px] uppercase tracking-wider transition-all shadow-sm active:scale-[0.98]"
              style={{ fontWeight: 600 }}
            >
              Continue
            </Button>
          </div>

        </div>

        {/* The band stays: it closes the card off against the page and gives
            the two choices above it a floor. What it held did not -- a product
            name the user is already inside, and a Help Center link that went
            nowhere. */}
        <div className="px-6 py-3 bg-[#FAFBFC] border-t border-[#EEF2F6] h-[42px]" />
      </div>
    </div>
  );
}
