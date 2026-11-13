import { PARTNER_GROUPS } from "@/app/components/vendors/partnerConstants";
import { BASE_CURRENCY, getCurrency } from "./currencies";
import { CORPORATE_RATES, LAST_SYNC, RATE_PROVIDER, rateOn, type RateQuote } from "./rates";

/* ── A partner's currency (spec 4.2) ──────────────────────────────────
 * A Partner Group carries a default currency, the base currency unless set
 * on the group. A partner inherits its primary group's currency and can
 * override it; whichever applies is the default for every transaction with
 * the partner. Both are kept as the design stores them: a lower-case id
 * ("usd") in the group's template and in the partner's
 * configData.creditLimitConfig (Configure → Billing & Shipping). */

type GroupLike = { id: string; name?: string; template?: { currency?: string } };
type PartnerLike = {
  partnerGroup?: string;
  configData?: { creditLimitConfig?: { currency?: string } };
};

/* The partner groups as the store has them now. PartnerGroupsProvider keeps
   this in step on every render, so code without the store (column filters,
   the importer, KPI helpers) resolves a partner's currency the way the page
   shows it, including a group currency changed in this session. */
let currentGroups: GroupLike[] = PARTNER_GROUPS;
export function syncPartnerGroups(groups: GroupLike[]) {
  currentGroups = groups;
}

/** A stored currency id ("usd", "USD") as the library's code; undefined when the library doesn't list it. */
export function currencyCodeOf(id: string | null | undefined): string | undefined {
  return getCurrency(id)?.code;
}

/** The id the design stores for a currency code ("USD" → "usd"). */
export const currencyIdOf = (code: string) => code.toLowerCase();

/** A Partner Group's default currency: the one set on the group, else the base currency. */
export function groupCurrencyOf(group: GroupLike | null | undefined): string {
  return currencyCodeOf(group?.template?.currency) ?? BASE_CURRENCY;
}

export interface PartnerCurrency {
  code: string;
  /** "partner": set on the partner, overriding its group's; "group": its group's. */
  source: "partner" | "group";
  /** The primary group it comes from, or would inherit from. */
  group?: GroupLike;
}

/** A partner's currency and where it comes from. */
export function partnerCurrencyInfo(partner: PartnerLike, groups: GroupLike[] = currentGroups): PartnerCurrency {
  const group = groups.find((g) => g.id === partner.partnerGroup);
  const inherited = groupCurrencyOf(group);
  // Inherited is stored as no currency. One saved equal to the group's
  // (older records) still reads as inherited.
  const own = currencyCodeOf(partner.configData?.creditLimitConfig?.currency);
  if (own && own !== inherited) return { code: own, source: "partner", group };
  return { code: inherited, source: "group", group };
}

/** A partner's currency code (ISO 4217): its own, else its primary group's, else base. */
export const partnerCurrencyOf = (partner: PartnerLike, groups?: GroupLike[]) => partnerCurrencyInfo(partner, groups).code;

/* ── Today's rate ─────────────────────────────────────────────────────
 * A partner's totals (credit limit, spend, balances) are kept in its own
 * currency. Seen beside other partners they are converted to the base
 * currency at today's mid-market rate, which is the provider's last synced
 * rate (the Currency & Exchange Rates module's own figures). */

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Today's mid-market rate for a currency: base currency per one unit. */
export const currentRate = (code: string): RateQuote => rateOn(code, todayIso(), "mid");

/** An amount in a currency, in base currency at today's mid-market rate. */
export function toBaseNow(amount: number, code: string | null | undefined): number {
  if (!code) return amount;
  return amount * (currentRate(code).rate ?? 1);
}

/** An amount from one currency to another, through the base currency at today's rates. */
export function convertNow(amount: number, from: string, to: string): number {
  const rate = currentRate(to).rate;
  return rate ? toBaseNow(amount, from) / rate : amount;
}

/* ── The sync stamp, as the module writes it ──────────────────────────── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad2 = (n: number) => String(n).padStart(2, "0");

/** LAST_SYNC in Pakistan time (UTC+5): "Apr 10, 2026 at 19:30 PKT". */
const SYNC = (() => {
  const d = new Date(new Date(LAST_SYNC).getTime() + 5 * 3600 * 1000);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} at ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} PKT`;
})();

/** "Updated as of Apr 10, 2026 at 19:30 PKT" */
export const MID_RATE_UPDATED = `Updated as of ${SYNC}`;
/** "Synced from Open Exchange Rates · Updated as of …" */
export const MID_RATE_SYNC_LINE = `Synced from ${RATE_PROVIDER} · ${MID_RATE_UPDATED}`;

/** When the corporate rates in use took effect: "Effective from Apr 1, 2026". */
export const CORPORATE_RATE_EFFECTIVE = (() => {
  const latest = CORPORATE_RATES.map((r) => r.effectiveDate).sort().at(-1);
  if (!latest) return "No corporate rates set";
  const [y, m, d] = latest.split("-").map(Number);
  return `Effective from ${MONTHS[m - 1]} ${d}, ${y}`;
})();
