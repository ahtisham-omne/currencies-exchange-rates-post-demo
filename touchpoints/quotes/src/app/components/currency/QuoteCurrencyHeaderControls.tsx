import * as React from "react";

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
  // No Currency button in the header (25 Nov 2026): the configuration opens
  // from the summary's currency card (View configuration).
  return null;
}
