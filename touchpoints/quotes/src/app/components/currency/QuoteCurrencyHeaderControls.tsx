import * as React from "react";
import { Settings2 } from "lucide-react";

/* ── The quote header's Currency button ───────────────────────────────
 * Opens the quote's currency configuration. The Currency Touchpoints Map
 * (24 Nov 2026) puts only a currency tag (after the quote number, on a
 * quote in a foreign currency) and this button in the header: the
 * Base Currency | Customer Currency toggle of 18 Nov is gone, and the page
 * shows every amount in base with the customer's amount on hover. Sized to
 * the header's buttons beside it (36px, 32px once the header compresses on
 * scroll). */

const FONT = "Inter, system-ui, sans-serif";

export function QuoteCurrencyHeaderControls({
  onOpenConfig,
  compact = false,
}: {
  onOpenConfig: () => void;
  /** The header has compressed on scroll. */
  compact?: boolean;
}) {
  const height = compact ? 32 : 36;
  return (
    <button
      type="button"
      onClick={onOpenConfig}
      title="Currency configuration for this quote"
      aria-label="Open currency configuration"
      className="inline-flex items-center gap-1.5 px-2.5 rounded-lg border border-border bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-800 transition-colors cursor-pointer text-[11.5px] shrink-0"
      style={{ height, fontWeight: 500, fontFamily: FONT }}
    >
      <Settings2 className="w-3.5 h-3.5" />
      Currency
    </button>
  );
}
