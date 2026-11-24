import * as React from "react";
import type { VersionRateChoice as Choice } from "@/app/data/quoteStore";
import { BASE_CURRENCY, isBaseCurrency } from "@/app/currency/currencies";
import { formatMoney, formatRateDate, rateSentence } from "@/app/currency/money";
import { currentRateFor } from "@/app/currency/qFx";
import { RATE_TYPE_LABEL, toBase, type RateType } from "@/app/currency/rates";
import { useDocCurrency } from "./docCurrencyContext";
import { RateTypeChip } from "./QuoteCurrencyConfig";

const FONT = "Inter, system-ui, sans-serif";

/* ── A rate choice: the one kept, or today's ──────────────────────────
 * Ported from the earlier touchpoint's "Use locked rate or apply current
 * rate?", as Purchase Orders has it, in the Currency Touchpoints Map's words
 * (24 Nov 2026): "Keep version 1's rate  1 USD = 276.1000 PKR" or "Use
 * today's rate  1 USD = 278.5200 PKR". Shown when a version is created (a
 * material change on a sent quote, Edit as a new version, Reactivate) and
 * when reverting to one, on a quote in a foreign currency; the same cards
 * ask on Duplicate ("Keep the original rate") and Convert to sales order
 * ("Keep the quote's rate"). Each option names its rate, then its type, day
 * and the base total; today's can be mid-market or corporate when a
 * corporate rate is set (Mahreen, 2026-11-20). The customer's amounts don't
 * change either way; the base-currency totals do. */

export interface RateLine {
  /** "1 USD = 278.5200 PKR" */
  rate: string;
  /** "Mid-market · Nov 19, 2026 · total ₨3,977,265.60" */
  meta: string;
}

export interface VersionRateOptions {
  /** The rate kept (the version's, the original quote's, the quote's). */
  locked: RateLine;
  /** Today's rate of each type; corporate only when a corporate rate is set. */
  today: { mid: TodayRate; corporate?: TodayRate | undefined };
  /** The type "Use today's rate" starts on: the kept rate's, when today
   *  has one of that type. */
  defaultType: RateType;
}

interface TodayRate extends RateLine {
  /** False when it is the kept rate. */
  differs: boolean;
}

type Stamp = { exchangeRate: number; rateType: RateType; rateDate: string };

function buildOptions(
  currency: string,
  locked: { rate: number; rateType: RateType; rateDate: string },
  todayOf: (type: RateType) => Stamp,
  total?: number,
): VersionRateOptions {
  const withTotal = total != null && Number.isFinite(total);
  const inBase = (rate: number) => formatMoney(toBase(total ?? 0, rate), BASE_CURRENCY);
  const today = (type: RateType, now: Stamp): TodayRate => {
    const differs = now.rateType !== locked.rateType || Math.abs(now.exchangeRate - locked.rate) > 1e-9;
    const totals = !withTotal ? "" : differs ? ` · total ${inBase(locked.rate)} → ${inBase(now.exchangeRate)}` : ` · total ${inBase(now.exchangeRate)}`;
    return {
      rate: rateSentence(currency, now.exchangeRate),
      meta: `${RATE_TYPE_LABEL[type]} · Today, ${formatRateDate(now.rateDate)}${totals}`,
      differs,
    };
  };
  // Today's corporate rate falls back to mid-market when none is set: then there is no corporate option.
  const corp = todayOf("corporate");
  const corporate = corp.rateType === "corporate" ? today("corporate", corp) : undefined;
  return {
    locked: {
      rate: rateSentence(currency, locked.rate),
      meta: `${RATE_TYPE_LABEL[locked.rateType]} · ${formatRateDate(locked.rateDate)}${withTotal ? ` · total ${inBase(locked.rate)}` : ""}`,
    },
    today: { mid: today("mid", todayOf("mid")), corporate },
    defaultType: locked.rateType === "corporate" && corporate ? "corporate" : "mid",
  };
}

/** What the cards say: the two titles, the question above them, and what
 *  today's line adds when it is the kept rate. */
export interface RateChoiceCopy {
  heading?: string;
  question?: string;
  keep: string;
  today: string;
  /** "same as version 3" */
  same: string;
  ariaLabel: string;
}

/** The two cards: keep the rate, or use today's (mid-market or corporate). */
export function RateChoiceCards({
  copy,
  options,
  value,
  onChange,
}: {
  copy: RateChoiceCopy;
  options: VersionRateOptions;
  value: Choice;
  onChange: (choice: Choice) => void;
}) {
  const corporate = options.today.corporate;
  /* Today's rate type: the one picked, else the one it starts on. */
  const type: RateType = value === "current-corporate" && corporate ? "corporate" : value === "current-mid" ? "mid" : options.defaultType;
  const today = (type === "corporate" && corporate) || options.today.mid;
  const pickToday = (t: RateType) => onChange(t === "corporate" ? "current-corporate" : "current-mid");
  const cards = [
    { key: "locked", active: value === "locked", title: copy.keep, rate: options.locked.rate, meta: options.locked.meta, pick: () => onChange("locked") },
    {
      key: "current",
      active: value !== "locked",
      title: copy.today,
      rate: today.rate,
      meta: today.differs ? today.meta : `${today.meta} · ${copy.same}`,
      pick: () => pickToday(type),
    },
  ];
  return (
    <div className="w-full text-left" style={{ fontFamily: FONT }}>
      {copy.heading && (
        <p className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>
          {copy.heading}
        </p>
      )}
      {copy.question && <p className="text-[11.5px] text-slate-500 mt-0.5">{copy.question}</p>}
      <div className={`${copy.heading || copy.question ? "mt-2" : ""} flex flex-col gap-2`} role="radiogroup" aria-label={copy.ariaLabel}>
        {cards.map((c) => (
          <div
            key={c.key}
            role="radio"
            aria-checked={c.active}
            tabIndex={0}
            onClick={c.pick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                c.pick();
              }
            }}
            className="flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A77FF]/25"
            style={{
              borderColor: c.active ? "var(--primary)" : "#E2E8F0",
              backgroundColor: c.active ? "#EDF4FF" : "#FFFFFF",
            }}
          >
            <span
              className="mt-0.5 flex items-center justify-center w-4 h-4 rounded-full shrink-0 border"
              style={{
                borderColor: c.active ? "var(--primary)" : "#CBD5E1",
                backgroundColor: c.active ? "var(--primary)" : "#FFFFFF",
              }}
            >
              {c.active && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <span className="text-[12.5px] text-slate-800" style={{ fontWeight: 600 }}>
                  {c.title}
                </span>
                <span className="text-[12px] text-slate-800 tabular-nums whitespace-nowrap" style={{ fontWeight: 600 }}>
                  {c.rate}
                </span>
              </div>
              <span className="block text-[11px] text-slate-500 tabular-nums mt-0.5 leading-relaxed">{c.meta}</span>
              {/* Today's rate as mid-market or corporate, when a corporate rate is set. */}
              {c.key === "current" && corporate && (
                <div
                  role="radiogroup"
                  aria-label="Today's rate type"
                  className="mt-2 inline-flex items-center gap-0.5 rounded-lg border border-border bg-white p-0.5"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  {(["mid", "corporate"] as const).map((t) => {
                    const on = type === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => pickToday(t)}
                        className={`px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap transition-colors cursor-pointer ${
                          on ? "bg-[#EDF4FF] text-[#0A77FF]" : "text-muted-foreground hover:bg-muted"
                        }`}
                        style={{ fontWeight: on ? 500 : 400 }}
                      >
                        {RATE_TYPE_LABEL[t]}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A version's rate, or today's: "Keep version 3's rate" / "Use today's rate". */
export function VersionRateChoice({
  fromVersion,
  options,
  value,
  onChange,
}: {
  fromVersion: number;
  options: VersionRateOptions;
  value: Choice;
  onChange: (choice: Choice) => void;
}) {
  /* A new version, or a restored one, always takes today's rate (25 Nov
     2026): no "Keep version N's rate" choice. The type stays the version's
     when today has one of that type (a corporate rate set), else mid-market. */
  const todayChoice: Choice = options.defaultType === "corporate" && options.today.corporate ? "current-corporate" : "current-mid";
  React.useEffect(() => {
    if (value !== todayChoice) onChange(todayChoice);
  }, [value, todayChoice]); // eslint-disable-line react-hooks/exhaustive-deps
  const today = (todayChoice === "current-corporate" && options.today.corporate) || options.today.mid;
  return (
    <div className="w-full text-left">
      <p className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>
        Exchange rate
      </p>
      <p className="text-[11.5px] text-slate-500 mt-0.5">
        Uses today's rate. The customer's amounts don't change; the quote's total in {BASE_CURRENCY} follows the rate.
      </p>
      <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5" aria-label="Exchange rate for the new version">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-[12.5px] text-slate-800" style={{ fontWeight: 600 }}>
            Today's rate
          </span>
          <span className="text-[12px] text-slate-700 tabular-nums whitespace-nowrap" style={{ fontWeight: 500 }}>
            {today.rate}
          </span>
        </span>
        <span className="block text-[11px] text-slate-500 tabular-nums mt-0.5 leading-relaxed">
          {today.differs ? today.meta : `${today.meta} · same as version ${fromVersion}'s`}
        </span>
      </div>
    </div>
  );
}

/** The rate a version keeps: a quote's, or a version's on record. */
export interface LockedRate {
  currency: string;
  rate: number;
  rateType: RateType;
  rateDate: string;
}

/** The options' lines for a rate; null on a base-currency quote. With
 *  `total` (in the quote's currency) they give the base total each way. */
export function versionRateOptions(locked: LockedRate, total?: number): VersionRateOptions | null {
  if (isBaseCurrency(locked.currency)) return null;
  const fields = { currency: locked.currency, exchangeRate: locked.rate, rateType: locked.rateType, rateDate: locked.rateDate };
  return buildOptions(locked.currency, locked, (type) => currentRateFor(fields, type), total);
}

/** The options for reverting to (or making a version from) `version`, at the
 *  rate it locked in; the quote's own when `version` is left out. */
export function useVersionRateOptions(version?: number, total?: number): VersionRateOptions | null {
  const doc = useDocCurrency();
  const fx = (version != null ? doc.versionFx?.(version) : null) ?? doc.fx;
  if (!fx) return null;
  return versionRateOptions({ currency: doc.currency, rate: fx.rate, rateType: fx.rateType, rateDate: fx.rateDate }, total);
}

/* ── Restoring a version: the Exchange rate box ───────────────────────
 * A restored version always takes today's rate (25 Nov 2026), so the
 * revert confirmations ask nothing: on a quote in a foreign currency they
 * say so in a box under the description, as Purchase Orders'
 * POVersionRevertModal does: today's rate with its type, and the total in
 * the base currency before (at the version's rate) and after. */

/** The rate a version kept and today's of the same type (mid-market when no
 *  corporate rate is set); null on a base-currency quote. */
export function useRevertRate(version: number) {
  const doc = useDocCurrency();
  const fx = doc.versionFx?.(version) ?? doc.fx;
  if (!fx || isBaseCurrency(doc.currency)) return null;
  const today = currentRateFor({ currency: doc.currency, exchangeRate: fx.rate, rateType: fx.rateType, rateDate: fx.rateDate });
  /** The choice that names today's rate of that type, for callers whose
   *  handlers take a choice literally (the listing's revert). */
  const todayChoice: Choice = today.rateType === "corporate" ? "current-corporate" : "current-mid";
  return { currency: doc.currency, rate: fx.rate, today, todayChoice };
}

/** "Exchange rate [chip] / Today's rate: 1 USD = 278.5200 PKR / PKR total:
 *  ₨old → ₨new". The total row needs `total` (in the quote's currency). Sits
 *  in ConfirmDiscardModal's children, whose wrapper puts it mt-5 under the
 *  description; mb-5 keeps the reason field the same distance below. */
export function RevertRateBox({ version, total }: { version: number; total?: number }) {
  const r = useRevertRate(version);
  if (!r) return null;
  const withTotal = total != null && Number.isFinite(total);
  return (
    <div
      className="w-full mb-5 rounded-lg border text-left"
      style={{ borderColor: "#E2E8F0", backgroundColor: "#FFFFFF", padding: "10px 12px", fontFamily: FONT }}
    >
      <div className="flex items-center justify-between" style={{ gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#64748B" }}>Exchange rate</span>
        <RateTypeChip type={r.today.rateType} />
      </div>
      <div className="tabular-nums" style={{ fontSize: 13, color: "#0F172A", marginTop: 4 }}>
        Today's rate: <span style={{ fontWeight: 600 }}>{rateSentence(r.currency, r.today.exchangeRate)}</span>
      </div>
      {withTotal && (
        <div className="tabular-nums" style={{ fontSize: 12.5, color: "#64748B", marginTop: 2 }}>
          {BASE_CURRENCY} total: {formatMoney(toBase(total, r.rate), BASE_CURRENCY)} →{" "}
          <span style={{ fontWeight: 600, color: "#0F172A" }}>{formatMoney(toBase(total, r.today.exchangeRate), BASE_CURRENCY)}</span>
        </div>
      )}
    </div>
  );
}
