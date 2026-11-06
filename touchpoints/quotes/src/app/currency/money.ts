import { BASE_CURRENCY, CURRENCIES, getCurrency } from './currencies';

/* ── Money in its own currency ────────────────────────────────────────
 * Every amount is written with its currency's symbol and decimals:
 * $12,400.00 · €980.50 · ¥15,000 · د.ك1,250.500 · ₨3,453,648.00.
 * A symbol several currencies share ($, £, kr, Fr, …) stays with one of
 * them (USD, GBP, …); the others are written with their code, so no amount
 * reads as the wrong currency: MXN 1,200.00, NIO 300.00 (C$ is CAD's). */

const SYMBOL_OWNER: Record<string, string> = { $: 'USD', '£': 'GBP', '¥': 'JPY', '₨': 'PKR', '₩': 'KRW', C$: 'CAD' };

const SHARED_SYMBOLS = (() => {
  const count = new Map<string, number>();
  for (const c of CURRENCIES) count.set(c.symbol, (count.get(c.symbol) ?? 0) + 1);
  return new Set([...count].filter(([, n]) => n > 1).map(([s]) => s));
})();

// Arabic-script symbols (د.إ, ﷼) would pull the digits after them right-to-left.
const RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

/** What an amount in this currency starts with: its symbol, or its code and a space. */
export function moneyPrefix(code: string | null | undefined): string {
  const cur = getCurrency(code || BASE_CURRENCY);
  if (!cur) return `${(code || '').toUpperCase()} `;
  const { symbol } = cur;
  if (!symbol || (SHARED_SYMBOLS.has(symbol) && SYMBOL_OWNER[symbol] !== cur.code)) return `${cur.code} `;
  return RTL.test(symbol) ? `${symbol}\u200E` : symbol;
}

export const currencyDecimals = (code: string | null | undefined) => getCurrency(code || BASE_CURRENCY)?.decimals ?? 2;

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

/** A rate to the 4 decimals the Exchange Rates module stores and shows
 *  (278.5200 · 1.9230), 6 for tiny ones (0.004512), so the figures it
 *  converts can be checked by hand. */
export function formatRate(rate: number): string {
  const abs = Math.abs(rate);
  const d = abs >= 0.01 ? 4 : 6;
  return rate.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** "1 USD = 278.52 PKR" */
export const rateSentence = (code: string, rate: number, base = BASE_CURRENCY) =>
  `1 ${code.toUpperCase()} = ${formatRate(rate)} ${base}`;

/** "Nov 04, 2026" from an ISO day, the way the module writes dates. */
export function formatRateDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}
