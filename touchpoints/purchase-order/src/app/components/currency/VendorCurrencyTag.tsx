import * as React from "react";
import { Globe } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { isBaseCurrency } from "@/app/currency/currencies";
import { CurrencyFlag, currencyChipLabel } from "./CurrencyChip";

/* ── The vendor's currency on Create PO (Nophil review item 6, 25 Nov 2026) ──
 * Nophil liked the price per unit, the total and the vendor's currency
 * together on Create PO, but the white currency pill read as almost
 * invisible. A foreign-currency vendor's tag now stands out, in one of three
 * treatments from the app's own palette; a base-currency vendor gets no tag,
 * as before. Used for every vendor-currency tag in the catalogue and the cart.
 *  1. Blue chip: flag + code on the primary tint (#EDF4FF / #0A77FF).
 *  2. Amber chip: amber-50 / amber-700 / amber-200, the FX hint colours, so it
 *     also reads as "foreign".
 *  3. Strong: flag + code in primary at weight 600 (no chip), and the vendor's
 *     group gets a thin primary left accent and a tinted header row.
 * The blue chip (1) is the default (D8, 27 Nov 2026); ?ccyAccent stays until
 * Monday's review. The PO page's "Prices in EUR" chip (PricesInChip) takes
 * the same treatment. */

export type CcyAccent = 1 | 2 | 3;

/** For design review only: pick the treatment with ?ccyAccent=1|2|3 (default 1). */
export const CCY_ACCENT: CcyAccent = (() => {
  try {
    const v = Number(new URLSearchParams(window.location.search).get("ccyAccent"));
    return v === 2 || v === 3 ? v : 1;
  } catch {
    return 1;
  }
})();

const CHIP = "inline-flex items-center gap-1 px-1.5 py-0 rounded-full text-[10px] leading-[16px] border shrink-0 cursor-default";

const ACCENT_CLASS: Record<CcyAccent, string> = {
  1: `${CHIP} bg-[#EDF4FF] text-[#0A77FF] border-[#0A77FF]/20`,
  2: `${CHIP} bg-amber-50 text-amber-700 border-amber-200`,
  3: "inline-flex items-center gap-1 text-[11px] leading-[16px] text-[#0A77FF] shrink-0 cursor-default",
};

/** The vendor's currency tag: nothing for a base-currency vendor. */
export function VendorCurrencyTag({ code, party = "Vendor" }: { code: string | null | undefined; party?: string }) {
  if (!code || isBaseCurrency(code)) return null;
  const upper = code.toUpperCase();
  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        <span className={ACCENT_CLASS[CCY_ACCENT]} style={{ fontWeight: CCY_ACCENT === 3 ? 600 : 500 }}>
          <CurrencyFlag code={upper} size={10} />
          {upper}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{currencyChipLabel(upper, party)}</TooltipContent>
    </Tooltip>
  );
}

/** "🌐 Prices in EUR" after a PO's Line Items title (Mahreen, 27 Nov 2026,
 *  PO-1): names the currency the PO's prices are kept in, the vendor's unless
 *  changed on the PO, whichever currency the page shows them in. Same
 *  treatment as the vendor's tag (CCY_ACCENT, the brand tint by default).
 *  Nothing on a PO in the base currency. */
export function PricesInChip({ code }: { code: string | null | undefined }) {
  if (!code || isBaseCurrency(code)) return null;
  const upper = code.toUpperCase();
  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        <span className={ACCENT_CLASS[CCY_ACCENT]} style={{ fontWeight: CCY_ACCENT === 3 ? 600 : 500 }}>
          <Globe className="w-2.5 h-2.5 shrink-0" />
          Prices in {upper}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{currencyChipLabel(upper, "PO")}</TooltipContent>
    </Tooltip>
  );
}

const strong = (code: string | null | undefined) => CCY_ACCENT === 3 && !!code && !isBaseCurrency(code);

/** Treatment 3 only: a vendor group in a foreign currency gets a thin primary
 *  left accent on its card. Spread onto the card's style. */
export function vendorGroupAccent(code: string | null | undefined): React.CSSProperties {
  return strong(code) ? { borderLeft: "2px solid #0A77FF" } : {};
}

/** Treatment 3 only: the group's header row on the primary tint (#EDF4FF),
 *  as a background colour (for headers styled inline) … */
export function vendorGroupHeaderBg(code: string | null | undefined): string | undefined {
  return strong(code) ? "rgba(237, 244, 255, 0.7)" : undefined;
}

/** … or as a class (for headers styled with Tailwind). */
export function vendorGroupHeaderClass(code: string | null | undefined): string {
  return strong(code) ? "bg-[#EDF4FF]/70" : "";
}
