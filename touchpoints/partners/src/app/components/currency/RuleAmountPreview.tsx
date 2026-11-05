import * as React from "react";
import { BASE_CURRENCY } from "@/app/currency/currencies";
import { formatMoneyWithCode } from "@/app/currency/partnerAmounts";
import { convertNow } from "@/app/currency/partnerCurrency";

/**
 * Under a pricing-rule amount (written in the rules' currency): what it is in
 * the partner's or group's currency today, or in base when that is the
 * rules' currency too.
 */
export function RuleAmountPreview({ raw, from, to }: { raw: string; from: string; to: string }) {
  const n = parseFloat(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || n === 0) return null;
  const target = to.toUpperCase() === from.toUpperCase() ? BASE_CURRENCY : to.toUpperCase();
  return (
    <p className="text-[10.5px] text-slate-400 mt-1 tabular-nums" style={{ fontWeight: 400 }}>
      ≈ {formatMoneyWithCode(convertNow(n, from, target), target)} <span className="text-slate-300">· at today's rate</span>
    </p>
  );
}
