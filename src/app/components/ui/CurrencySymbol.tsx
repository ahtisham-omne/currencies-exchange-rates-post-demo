import * as React from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "./tooltip";
import { CurrencyFlag } from "./CurrencyFlag";
import { getLibraryCurrency } from "@/app/data/currencyLibrary";
import { cn } from "./utils";

interface CurrencySymbolProps {
  /** ISO 4217 alpha-3 code (any case). */
  code: string;
  /** Override for the rendered glyph (defaults to the currency's symbol, falling back to the ISO code). */
  symbol?: string;
  /** Extra classes for the visible glyph span. */
  className?: string;
  /** Side the tooltip appears on. */
  side?: "top" | "bottom" | "left" | "right";
}

/**
 * Small, inline currency-symbol label with a hover tooltip revealing the ISO
 * code, full currency name, and flag. Use everywhere a standalone currency
 * glyph is rendered outside of `<CurrencyAmount>` (e.g. input adornments,
 * prefixes on cards) so the code is one hover away.
 */
export function CurrencySymbol({ code, symbol, className, side = "top" }: CurrencySymbolProps) {
  const cur = getLibraryCurrency(code);
  const displaySymbol = symbol ?? cur?.symbol ?? cur?.code ?? code.toUpperCase();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("cursor-help", className)}>{displaySymbol}</span>
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={6} className="px-2.5 py-1.5">
        <span className="flex items-center gap-2 text-[11px]">
          {cur && <CurrencyFlag currency={cur} size={14} />}
          <span className="text-foreground" style={{ fontWeight: 700 }}>{code.toUpperCase()}</span>
          {cur?.name && <span className="text-slate-500">— {cur.name}</span>}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
