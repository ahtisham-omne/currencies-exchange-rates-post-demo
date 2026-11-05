import * as React from "react";
import { BASE_CURRENCY, isBaseCurrency } from "@/app/currency/currencies";
import { formatMoneyWithCode } from "@/app/currency/partnerAmounts";
import { toBaseNow } from "@/app/currency/partnerCurrency";

/** Under an amount typed in a partner's currency: what it is in the base currency today. */
export function BaseCurrencyPreview({ raw, fromCode }: { raw: string; fromCode: string }) {
  const n = parseFloat(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || n === 0 || isBaseCurrency(fromCode)) return null;
  return (
    <p className="text-[10.5px] text-slate-400 mt-1 tabular-nums" style={{ fontWeight: 400 }}>
      ≈ {formatMoneyWithCode(toBaseNow(n, fromCode), BASE_CURRENCY)} <span className="text-slate-300">· at today's rate</span>
    </p>
  );
}
