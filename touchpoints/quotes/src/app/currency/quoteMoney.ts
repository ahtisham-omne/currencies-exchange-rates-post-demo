import { BASE_CURRENCY } from "./currencies";
import { formatCompactMoney, formatMoney, moneyPrefix } from "./money";
import { DESIGN_CURRENCY, LAST_SYNC_DAY, convertOn } from "./qFx";

/** A whole amount in a currency, as Quote Summary writes them: "$1,400,000",
 *  "€16,692", "¥1,812,005". Negative amounts take a leading minus. */
export function formatWhole(n: number, code: string | null | undefined): string {
  return `${n < 0 ? "-" : ""}${moneyPrefix(code)}${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
}

/** An item master's list price (the design writes it in USD) in the base
 *  currency, where Items keeps item prices: "₨2,785.20". */
export function itemListPrice(usd: number): string {
  return formatMoney(convertOn(usd, DESIGN_CURRENCY, BASE_CURRENCY, LAST_SYNC_DAY), BASE_CURRENCY);
}

/** The design's fixed USD figures in a currency, at the mid-market rate on a
 *  day: mock history (version snapshots and change notes) is written in $. */
export function restateDesign(usd: number, code: string, day: string): number {
  return convertOn(usd, DESIGN_CURRENCY, code, day);
}

/** Text from the design with "$1,200" amounts in it ("Qty: 2 EA · $3,200/EA",
 *  "−$1,000/unit"), restated in a currency as whole amounts. */
export function restateDesignText(text: string, code: string, day: string, compact = false): string {
  if (code.toUpperCase() === DESIGN_CURRENCY) return text;
  return text.replace(/\$([\d,]+(?:\.\d+)?)/g, (_m, n: string) => {
    const value = restateDesign(Number(n.replace(/,/g, "")), code, day);
    return compact ? formatCompactMoney(value, code) : formatWhole(value, code);
  });
}
