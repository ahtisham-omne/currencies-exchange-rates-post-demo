import { PARTNER_GROUPS } from "@/app/components/vendors/partnerConstants";
import { BASE_CURRENCY, getCurrency, isBaseCurrency } from "./currencies";
import { formatRateDate } from "./money";
import { DEFAULT_RATE_TYPE, RATES_READ_ON, corporateCodesOn, corporateRateOn, rateOn, type RateQuote, type RateType } from "./rates";

/* ── A partner's currency (spec 4.2) ──────────────────────────────────
 * A Partner Group carries a default currency, the base currency unless set
 * on the group. A partner inherits its primary group's currency and can
 * override it; whichever applies is the default for every transaction with
 * the partner. Both are kept as the design stores them: a lower-case id
 * ("usd") in the group's template and in the partner's
 * configData.creditLimitConfig (Configure → Billing & Shipping). */

type GroupLike = { id: string; name?: string; template?: { currency?: string; rateType?: string } };
type PartnerLike = {
  partnerGroup?: string;
  configData?: { creditLimitConfig?: { currency?: string; rateType?: string } };
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

/** The currency a worked example (pricing rules, payment terms) is shown in:
 *  the partner's own when it isn't the base currency, else US dollars
 *  (euros when the base currency is USD). Takes a code or a stored id. */
export function exampleDocumentCurrency(partnerCurrency: string | null | undefined): string {
  const code = currencyCodeOf(partnerCurrency) ?? partnerCurrency?.toUpperCase();
  if (code && !isBaseCurrency(code)) return code;
  return isBaseCurrency("USD") ? "EUR" : "USD";
}

/* ── Default exchange rate (Currency Touchpoints Map, 24 Nov 2026) ─────
 * Beside its currency, a group carries the rate type its partners'
 * documents start from: the daily market rate or the corporate rate. The
 * daily market rate unless set on the group. A partner inherits its
 * primary group's and can override it,
 * stored like the currency: only when it differs from the group's. */

const isRateType = (v: unknown): v is RateType => v === "mid" || v === "corporate";

/** A group's default exchange rate: the one set on it, else the daily market rate. */
export function groupRateTypeOf(group: GroupLike | null | undefined): RateType {
  const t = group?.template?.rateType;
  return isRateType(t) ? t : DEFAULT_RATE_TYPE;
}

export interface PartnerRateType {
  type: RateType;
  /** "partner": set on the partner, overriding its group's; "group": its group's. */
  source: "partner" | "group";
  group?: GroupLike;
}

/** A partner's default exchange rate and where it comes from. */
export function partnerRateTypeInfo(partner: PartnerLike, groups: GroupLike[] = currentGroups): PartnerRateType {
  const group = groups.find((g) => g.id === partner.partnerGroup);
  const inherited = groupRateTypeOf(group);
  const own = partner.configData?.creditLimitConfig?.rateType;
  if (isRateType(own) && own !== inherited) return { type: own, source: "partner", group };
  return { type: inherited, source: "group", group };
}

/* ── Saving Configure's currency settings ─────────────────────────────
 * Configure (create or Edit Partner) has a Billing & Shipping per side.
 * The partner keeps one currency and one default exchange rate: whichever
 * side overrides its group's (the vendor side's first). Left inherited,
 * nothing is stored, so the partner follows its group. */

type SideConfig = Record<string, unknown> & {
  configCreditLimit?: { currency?: string; rateType?: string };
  currencyInherited?: boolean;
  rateTypeInherited?: boolean;
};

export interface PartnerCurrencySettings {
  /** Lower-case id, only when overridden. */
  currency?: string;
  /** Only when overridden. */
  rateType?: RateType;
}

/** The overrides in a Configure payload: the vendor side flattened onto it,
 *  the customer side under `customerConfig`. Null when neither side's
 *  Billing & Shipping was set up, so a save leaves the partner's as it is. */
export function currencySettingsFromConfig(data: Record<string, unknown>): PartnerCurrencySettings | null {
  const customer = (data.customerConfig as SideConfig | undefined) ?? {};
  const sides = [data as SideConfig, customer].filter((c) => c.configCreditLimit);
  if (!sides.length) return null;
  const rateType = sides.find((c) => c.rateTypeInherited === false)?.configCreditLimit?.rateType;
  return {
    currency: sides.find((c) => c.currencyInherited === false)?.configCreditLimit?.currency,
    rateType: isRateType(rateType) ? rateType : undefined,
  };
}

/* ── Open documents (Edit Partner's currency-change prompt) ────────────
 * Partners holds no documents of its own (orders and invoices live in
 * their modules), so the count is a stand-in derived from the partner:
 * none for a partner with no orders, else 3 to 16, the same every time. */
export function openDocumentCount(partner: { id?: unknown; totalOrders?: unknown } | null | undefined): number {
  const id = typeof partner?.id === "string" ? partner.id : "";
  const orders = typeof partner?.totalOrders === "number" ? partner.totalOrders : 0;
  if (!id || orders <= 0) return 0;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return Math.min(orders, 3 + (Math.abs(h) % 14));
}

/* ── Today's rate ─────────────────────────────────────────────────────
 * A partner's totals (credit limit, spend, balances) are kept in its own
 * currency. Seen beside other partners they are converted to the base
 * currency at today's daily market rate, read once a day from the provider
 * and fixed for that date (the Currency & Exchange Rates module's own
 * figures). */

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Today's daily market rate for a currency: base currency per one unit. */
export const currentRate = (code: string): RateQuote => rateOn(code, todayIso(), "mid");

/** Today's rate of a type; corporate falls back to the daily market rate where none is set. */
export function rateNow(code: string, type: RateType): RateQuote {
  const quote = rateOn(code, todayIso(), type);
  return quote.rate == null && type === "corporate" ? currentRate(code) : quote;
}

/** An amount in a currency, in base currency at today's daily market rate. */
export function toBaseNow(amount: number, code: string | null | undefined): number {
  if (!code) return amount;
  return amount * (currentRate(code).rate ?? 1);
}

/** An amount from one currency to another, through the base currency at today's rates. */
export function convertNow(amount: number, from: string, to: string): number {
  const rate = currentRate(to).rate;
  return rate ? toBaseNow(amount, from) / rate : amount;
}

/* ── When today's rates were read (Eli's ruling, 26 Nov 2026) ──────────
 * A rate is read once a day and fixed for that date, so it carries a day,
 * never a time: "Read on Nov 27, 2026". */

/** "Read on Nov 27, 2026": today's daily market rates. */
export const MID_RATE_UPDATED = `Read on ${formatRateDate(RATES_READ_ON)}`;

/** The corporate rates in effect today, for the listing's Corporate Rate
 *  insight, which spans every currency: "6 currencies, last set on Oct 01,
 *  2026". Each currency has its own history (USD's last change is May 01),
 *  so the day is the latest of the rates in effect, not one for all. */
export const CORPORATE_RATES_SET = (() => {
  const inEffect = corporateCodesOn(RATES_READ_ON)
    .map((code) => corporateRateOn(code, RATES_READ_ON)?.effectiveDate)
    .filter((d): d is string => !!d);
  if (!inEffect.length) return "No corporate rates set";
  const latest = inEffect.sort().at(-1)!;
  return `${inEffect.length} ${inEffect.length === 1 ? "currency" : "currencies"}, last set on ${formatRateDate(latest)}`;
})();
