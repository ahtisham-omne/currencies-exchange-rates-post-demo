import type { SalesOrder, SOVersion } from "./types";
import { BASE_CURRENCY, isBaseCurrency } from "@/app/currency/currencies";
import { formatRate, rateSentence } from "@/app/currency/money";
import { rateOn, type RateType } from "@/app/currency/rates";
import { crossRate, localTodayIso, roundTo, soFx, type SoFxFields } from "@/app/currency/soFx";
import { getCompanyAccount, resolveReceiveAccount, type CompanyAccount } from "@/app/currency/companyAccounts";

/** A choice made in the order's currency configuration. */
export interface SOCurrencyChoice {
  currency: string;
  rateType: RateType;
  exchangeRate: number;
  rateEdited?: boolean;
  /** "You receive" as a bare currency (an older choice); unchanged when left out. */
  settlementCurrency?: string;
  /** "You receive": the pay-to account (currency/companyAccounts.ts). Its
   *  currency becomes the order's `settlementCurrency`. */
  payToAccount?: string;
}

/* ── When the order's currency configuration turns read-only ──────────
 * An order is confirmed once it leaves Draft (submitted for review, or
 * released); from then on its currency configuration can't change. The
 * exchange rate itself shows no lock anywhere (25 Nov 2026): no Locked /
 * Unlocked chip, no "locks when…" text. */

/** Is the order's currency configuration fixed? It is once the order is confirmed (leaves Draft). */
export const soRateLocked = (so: Pick<SalesOrder, "status">) => so.status !== "Draft";

/** The account an order is received into (its pay-to account, resolved). */
export function soReceiveAccount(so: SoFxFields & { settlementCurrency?: string; payToAccount?: string }): CompanyAccount {
  return resolveReceiveAccount(soFx(so).currency, so.payToAccount, so.settlementCurrency);
}

/**
 * The fields to update when an order moves to `next` (spec 4.3): another
 * currency converts every price and freight charge at the cross rate
 * between the two rates; documents already raised keep their currency. A
 * rate change alone converts nothing; it only changes what the order is
 * worth in base. Flat one-time adjustments live on the SO page and are
 * converted there with `factor`. "You receive" is an account in any
 * currency (25 Nov 2026): a currency change keeps it.
 */
export function withSOCurrency(so: SalesOrder, next: SOCurrencyChoice): { updates: Partial<SalesOrder>; factor: number } {
  const before = soFx(so);
  const code = next.currency.toUpperCase();
  const rate = isBaseCurrency(code) ? 1 : next.exchangeRate;
  const account =
    next.payToAccount || next.settlementCurrency
      ? resolveReceiveAccount(code, next.payToAccount, next.settlementCurrency)
      : code !== before.currency
        ? resolveReceiveAccount(code, so.payToAccount, so.settlementCurrency)
        : null;
  const rateFields = {
    currency: code,
    exchangeRate: rate,
    rateType: next.rateType,
    rateDate: before.rateDate,
    rateEdited: next.rateType === "corporate" && !!next.rateEdited,
    ...(account && { payToAccount: account.id, settlementCurrency: account.currency }),
  };
  if (code === before.currency) return { updates: rateFields, factor: 1 };
  const factor = crossRate(before.rate, rate);
  const convert = (n: number) => roundTo(code, n * factor);
  return {
    factor,
    updates: {
      ...rateFields,
      ...(typeof so.freightCost === "number" && { freightCost: convert(so.freightCost) }),
      lines: so.lines.map((l) => ({
        ...l,
        unitPrice: convert(l.unitPrice),
        ...(typeof l.shipmentCost === "number" && { shipmentCost: convert(l.shipmentCost) }),
      })),
      linkedTransactions: so.linkedTransactions.map((t) => (t.currency ? t : { ...t, currency: before.currency })),
    },
  };
}

/* ── The order's rate fields ─────────────────────────────────────────── */

export type SORateFields = Required<Pick<SalesOrder, "currency" | "exchangeRate" | "rateType" | "rateDate" | "rateEdited" | "settlementCurrency" | "payToAccount">>;

/** The currency fields an order carries, as `soFx` resolves them. */
export function soRateFields(so: SoFxFields & { settlementCurrency?: string; payToAccount?: string }): SORateFields {
  const fx = soFx(so);
  const account = soReceiveAccount(so);
  return {
    currency: fx.currency,
    exchangeRate: fx.rate,
    rateType: fx.rateType,
    rateDate: fx.rateDate,
    rateEdited: !!so.rateEdited,
    settlementCurrency: account.currency,
    payToAccount: account.id,
  };
}

const accountName = (id: string) => getCompanyAccount(id)?.label ?? id;

/** "USD → EUR · 1 EUR = 304.8150 PKR", "1 USD = 278.5200 → 279.0000 PKR",
 *  "1010 · JPMorgan Operating → 1040 · Global FX Settlement" (what the
 *  customer pays unchanged, only "You receive"). */
export function describeRateChange(before: SORateFields, after: SORateFields): string {
  const from = before.currency.toUpperCase();
  const to = after.currency.toUpperCase();
  const pays = before.payToAccount !== after.payToAccount ? `${accountName(before.payToAccount)} → ${accountName(after.payToAccount)}` : null;
  if (from === to && before.exchangeRate === after.exchangeRate && before.rateType === after.rateType && pays) return pays;
  if (from !== to) {
    return isBaseCurrency(to) ? `${from} → ${to}` : `${from} → ${to} · ${rateSentence(to, after.exchangeRate)}`;
  }
  return `1 ${to} = ${formatRate(before.exchangeRate)} → ${formatRate(after.exchangeRate)} ${BASE_CURRENCY}`;
}

/* ── A new version's rate: the one locked in, or today's ──────────────
 * Ported from the earlier Sales Orders touchpoint's revert prompt ("Restore
 * locked rate" / "Refresh to today's rate"), in the Currency Touchpoints
 * Map's words since 24 Nov 2026 ("Keep version {n}'s rate" / "Use today's
 * rate"). An order keeps the rate stamped on it (its order date's) from
 * version to version. Applying the current rate restamps it with today's
 * rate of the same type (finance's corporate rate, when that's the type and
 * one is set; otherwise mid-market). Prices stay in the order's currency, so
 * what the customer pays is unchanged, apart from fixed pricing-rule amounts
 * (written in base, converted at the order's rate); what the order is worth
 * in base moves. */
/** A new version's rate: the one it locked in, or today's of either type
 *  (corporate only when one is set; Mahreen, 2026-11-20). */
export type VersionRateChoice = "locked" | "current-mid" | "current-corporate";

/** The type of today's rate a choice takes, or null when it keeps the locked one. */
export const todaysRateType = (choice: VersionRateChoice): RateType | null =>
  choice === "locked" ? null : choice === "current-corporate" ? "corporate" : "mid";

/** Today's rate for an order, of `type` (the order's own by default).
 *  Corporate falls back to mid-market when no corporate rate is set. */
export function currentRateFor(so: SoFxFields, type?: RateType): { exchangeRate: number; rateType: RateType; rateDate: string } {
  const fx = soFx(so);
  const today = localTodayIso();
  if (fx.isBase) return { exchangeRate: 1, rateType: fx.rateType, rateDate: today };
  const corp = (type ?? fx.rateType) === "corporate" ? rateOn(fx.currency, today, "corporate") : null;
  const quote = corp?.rate != null ? corp : rateOn(fx.currency, today, "mid");
  return { exchangeRate: quote.rate ?? fx.rate, rateType: quote.type, rateDate: today };
}

/** The order restamped with today's rate: the fields to update and the
 *  activity line, or null on a base-currency order. */
export function withCurrentRate(so: SalesOrder, type?: RateType): { updates: Partial<SalesOrder>; detail: string | null } | null {
  const before = soRateFields(so);
  if (isBaseCurrency(before.currency)) return null;
  const now = currentRateFor(so, type);
  const updates = { exchangeRate: now.exchangeRate, rateType: now.rateType, rateDate: now.rateDate, rateEdited: false };
  const same = before.exchangeRate === now.exchangeRate && before.rateType === now.rateType;
  return {
    updates,
    detail: same ? null : `${describeRateChange(before, soRateFields({ ...so, ...updates }))} · today's rate applied`,
  };
}

/** A version entry stamped with the order's rate, unless it has one. */
export function stampVersionRate(v: SOVersion, so: SalesOrder, force = false): SOVersion {
  if (!force && v.exchangeRate != null) return v;
  return { ...v, ...soRateFields(so) };
}

/** The rate a version locked in: its own, when it was stamped in the order's
 *  current currency, else the order's (seeded history, or a version in
 *  another currency: a revert keeps the order's lines, so its currency). */
export function versionRateFields(so: SalesOrder, versionNumber: number): SORateFields {
  const own = soRateFields(so);
  const v = (so.versions ?? []).find((x) => x.number === versionNumber);
  if (!v || v.exchangeRate == null || (v.currency ?? "").toUpperCase() !== own.currency) return own;
  // The account the version was received into; one stamped before accounts carries only its currency.
  const account =
    v.payToAccount || v.settlementCurrency
      ? resolveReceiveAccount(own.currency, v.payToAccount, v.settlementCurrency)
      : getCompanyAccount(own.payToAccount) ?? resolveReceiveAccount(own.currency, own.payToAccount);
  return {
    currency: own.currency,
    exchangeRate: v.exchangeRate,
    rateType: v.rateType ?? own.rateType,
    rateDate: v.rateDate ?? own.rateDate,
    rateEdited: !!v.rateEdited,
    settlementCurrency: account.currency,
    payToAccount: account.id,
  };
}
