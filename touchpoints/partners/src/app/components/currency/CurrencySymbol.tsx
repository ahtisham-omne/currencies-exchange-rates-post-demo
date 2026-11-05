import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { cn } from "@/app/components/ui/utils";
import { getCurrency } from "@/app/currency/currencies";
import { moneyPrefix } from "@/app/currency/money";
import { CurrencyFlag } from "./CurrencyFlag";

/**
 * A currency's symbol on its own (an input adornment, a prefix on a card),
 * with its flag, code and name one hover away. A symbol several currencies
 * share is written as the code (MXN, not $), as amounts are.
 */
export function CurrencySymbol({
  code,
  className,
  side = "top",
}: {
  /** ISO 4217 code, any case. */
  code: string;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
}) {
  const cur = getCurrency(code);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("cursor-help", className)}>{moneyPrefix(code).trim()}</span>
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={6} className="px-2.5 py-1.5">
        <span className="flex items-center gap-2 text-[11px]">
          <CurrencyFlag code={code} />
          <span className="text-foreground" style={{ fontWeight: 700 }}>{code.toUpperCase()}</span>
          {cur && <span className="text-slate-500">— {cur.name}</span>}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
