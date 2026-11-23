import { PARTNER_GROUPS } from "@/app/components/vendors/partnerConstants";
import { BASE_CURRENCY, getCurrency, isBaseCurrency } from "./currencies";
import { CORPORATE_RATES, DEFAULT_RATE_TYPE, LAST_SYNC, RATE_PROVIDER, rateOn, type RateQuote, type RateType } from "./rates";

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
 * documents start from: mid-market or corporate. Mid-market unless set on
 * the group. A partner inherits its primary group's and can override it,
 * stored like the currency: only when it differs from the group's. */

const isRateType = (v: unknown): v is RateType => v === "mid" || v === "corporate";

/** A group's default exchange rate: the one set on it, else mid-market. */
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
 * currency at today's mid-market rate, which is the provider's last synced
 * rate (the Currency & Exchange Rates module's own figures). */

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Today's mid-market rate for a currency: base currency per one unit. */
export const currentRate = (code: string): RateQuote => rateOn(code, todayIso(), "mid");

/** Today's rate of a type; corporate falls back to mid-market where finance has set none. */
export function rateNow(code: string, type: RateType): RateQuote {
  const quote = rateOn(code, todayIso(), type);
  return quote.rate == null && type === "corporate" ? currentRate(code) : quote;
}

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
