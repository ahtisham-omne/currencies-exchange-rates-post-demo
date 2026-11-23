import * as React from "react";
import type { VersionRateChoice as Choice } from "@/app/data/quoteStore";
import { BASE_CURRENCY, isBaseCurrency } from "@/app/currency/currencies";
import { formatMoney, formatRateDate, rateSentence } from "@/app/currency/money";
import { currentRateFor } from "@/app/currency/qFx";
import { RATE_TYPE_LABEL, toBase, type RateType } from "@/app/currency/rates";
import { useDocCurrency } from "./docCurrencyContext";

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
                  className="mt-2 inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5"
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
                        className="rounded px-2 py-0.5 text-[11px] transition-colors cursor-pointer"
                        style={{
                          backgroundColor: on ? "#FFFFFF" : "transparent",
                          color: on ? "#0F172A" : "#64748B",
                          fontWeight: on ? 600 : 500,
                          boxShadow: on ? "0 1px 2px rgba(15,23,42,0.08)" : undefined,
                        }}
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
  return (
    <RateChoiceCards
      copy={{
        heading: "Exchange rate",
        question: `Keep version ${fromVersion}'s rate or use today's?`,
        keep: `Keep version ${fromVersion}'s rate`,
        today: "Use today's rate",
        same: `same as version ${fromVersion}`,
        ariaLabel: "Exchange rate for the new version",
      }}
      options={options}
      value={value}
      onChange={onChange}
    />
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
