import { CURRENCIES, currencyPluralLabel, getBaseCurrency, getCurrency } from './currencies';

/* ── OMNE currency kit: writing money ─────────────────────────────────
 * Every amount is written with its own currency's symbol and decimals:
 * $12,400.00 · €980.50 · ¥15,000 · د.ك1,250.500 · ₨3,453,648.00.
 * A symbol several currencies share ($, £, kr, Fr, …) stays with one of
 * them (USD, GBP, …); the others are written with their code, so no amount
 * reads as the wrong currency: MXN 1,200.00, NIO 300.00 (C$ is CAD's).
 * Never format money by hand in a module (no "Rs", no toFixed, no
 * Intl currency style): use these, so every module reads the same.
 *
 * Shared file. Do not edit it in a module. */

const SYMBOL_OWNER: Record<string, string> = { $: 'USD', '£': 'GBP', '¥': 'JPY', '₨': 'PKR', '₩': 'KRW', C$: 'CAD' };

const SHARED_SYMBOLS = (() => {
  const count = new Map<string, number>();
  for (const c of CURRENCIES) count.set(c.symbol, (count.get(c.symbol) ?? 0) + 1);
  return new Set([...count].filter(([, n]) => n > 1).map(([s]) => s));
})();

// Arabic-script symbols (د.إ, ﷼) would pull the digits after them right to left.
const RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/;

const codeOf = (code: string | null | undefined) => (code || getBaseCurrency()).trim().toUpperCase();

/** What an amount in this currency starts with: its symbol, or its code and a space. */
export function moneyPrefix(code: string | null | undefined): string {
  const cur = getCurrency(codeOf(code));
  if (!cur) return `${codeOf(code)} `;
  const { symbol } = cur;
  if (!symbol || (SHARED_SYMBOLS.has(symbol) && SYMBOL_OWNER[symbol] !== cur.code)) return `${cur.code} `;
  return RTL.test(symbol) ? `${symbol}‎` : symbol;
}

export const currencyDecimals = (code: string | null | undefined) => getCurrency(codeOf(code))?.decimals ?? 2;

/** A value rounded to the currency's minor unit (¥ to whole yen, KWD to 3 places). */
export function roundToCurrency(value: number, code: string | null | undefined): number {
  const f = 10 ** currencyDecimals(code);
  return Math.round(value * f) / f;
}

/** The number alone, with the currency's decimals: 12,400.00 · 15,000 · 1,250.500. */
export function formatAmount(value: number, code: string | null | undefined): string {
  const d = currencyDecimals(code);
  return Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** $12,400.00 · −€980.50 (a typographic minus, as the module writes credits). */
export function formatMoney(value: number, code: string | null | undefined): string {
  const sign = value < 0 && Math.abs(value) >= 10 ** -currencyDecimals(code) / 2 ? '−' : '';
  return `${sign}${moneyPrefix(code)}${formatAmount(value, code)}`;
}

/** "$10,136.20 USD": an amount with its code, as currency blocks and hovers write it. */
export function formatMoneyWithCode(value: number, code: string | null | undefined): string {
  const c = codeOf(code);
  const t = formatMoney(value, c);
  return t.includes(c) ? t : `${t} ${c}`;
}

/** Whole amounts, for summaries and KPIs that drop the minor unit: ₨4,652,301 · $1,400,000. */
export function formatWholeMoney(value: number, code: string | null | undefined): string {
  const sign = value < 0 && Math.round(Math.abs(value)) > 0 ? '−' : '';
  return `${sign}${moneyPrefix(code)}${Math.round(Math.abs(value)).toLocaleString('en-US')}`;
}

/** KPI-sized: ₨750.3M · $2.7M · $503K · ₨1.2B. */
export function formatCompactMoney(value: number, code: string | null | undefined): string {
  const prefix = moneyPrefix(code);
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  const one = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (abs >= 1e9) return `${sign}${prefix}${one(abs / 1e9)}B`;
  if (abs >= 1e6) return `${sign}${prefix}${one(abs / 1e6)}M`;
  if (abs >= 1e3) return `${sign}${prefix}${(abs / 1e3).toLocaleString('en-US', { maximumFractionDigits: 0 })}K`;
  return `${sign}${prefix}${Math.round(abs).toLocaleString('en-US')}`;
}

/** "≈ ₨2,833,270.62": an amount that is an estimate (converted at a rate
 *  that isn't final, or a base figure beside a real one). Always the "≈". */
export function formatEstimate(value: number, code: string | null | undefined): string {
  return `≈ ${formatMoney(value, code)}`;
}

/** For PDFs: jsPDF's built-in fonts carry $, €, £ and ¥ but not ₨ or Arabic
 *  script, so other currencies lead with their code: "PKR 21,201.00". */
const PDF_SAFE_SYMBOLS = new Set(['$', '€', '£', '¥']);
export function formatMoneyPdf(value: number, code: string | null | undefined): string {
  const sign = value < 0 && Math.abs(value) >= 10 ** -currencyDecimals(code) / 2 ? '-' : '';
  const prefix = moneyPrefix(code);
  return `${sign}${PDF_SAFE_SYMBOLS.has(prefix) ? prefix : `${codeOf(code)} `}${formatAmount(value, code)}`;
}

/** A rate to the 4 decimals the Exchange Rates module stores and shows
 *  (278.5200 · 1.9230), 6 for tiny ones (0.004512), so the figures it
 *  converts can be checked by hand. */
export function formatRate(rate: number): string {
  const abs = Math.abs(rate);
  const d = abs >= 0.01 ? 4 : 6;
  return rate.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** "1 USD = ₨278.5200 PKR": one unit of `code` in `to` (the base unless
 *  given), written the way the Currencies module writes a rate. A direct
 *  cross rate passes `to`: "1 USD = C$1.3935 CAD". */
export function rateSentence(code: string, rate: number, to: string = getBaseCurrency()): string {
  const target = to.toUpperCase();
  return `1 ${code.toUpperCase()} = ${moneyPrefix(target).trim()}${formatRate(rate)} ${target}`;
}

/** "Nov 04, 2026" from an ISO day, the way the modules write dates. */
export function formatRateDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

/** "25 Nov 2026". The modules write dates with formatRateDate ("Nov 25, 2026");
 *  this is for a document that asks for day-month-year. */
export function formatDayMonthYear(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, day] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !day) return iso;
  return `${day} ${MONTHS[m - 1]} ${y}`;
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ── Printed documents ─────────────────────────────────────────────── */

/** "All amounts in United States Dollars (USD)." A document printed in the
 *  base currency instead says what it was converted from and at which rate:
 *  "All amounts in Pakistani Rupees (PKR), converted from United States
 *  Dollars (USD) at 1 USD = ₨278.5200 PKR." */
export function currencyFootnote(code: string, convertedFrom?: { currency: string; rate: number } | null): string {
  const shown = currencyPluralLabel(code);
  return convertedFrom
    ? `All amounts in ${shown}, converted from ${currencyPluralLabel(convertedFrom.currency)} at ${rateSentence(convertedFrom.currency, convertedFrom.rate)}.`
    : `All amounts in ${shown}.`;
}

/** "Grand Total (USD)": a printed total names its currency. */
export const printTotalLabel = (code: string, label = 'Grand Total') => `${label} (${code.toUpperCase()})`;
