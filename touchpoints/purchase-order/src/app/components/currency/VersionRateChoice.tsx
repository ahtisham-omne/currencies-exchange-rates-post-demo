import * as React from "react";
import { FONT } from "../designTokens";
import { currentRateFor, type VersionRateChoice as Choice } from "../poStore";
import { BASE_CURRENCY } from "@/app/currency/currencies";
import { formatMoney, formatRateDate, rateSentence } from "@/app/currency/money";
import { poFx, type PoFxFields } from "@/app/currency/poFx";
import { RATE_TYPE_LABEL, toBase, type RateType } from "@/app/currency/rates";

/* ── A new version's rate: the locked one, or today's ─────────────────
 * Ported from the earlier touchpoint's "Create new version" prompt, in the
 * Currency Touchpoints Map's words (24 Nov): "Keep version 1's rate  1 USD =
 * 276.1000 PKR" or "Use today's rate  1 USD = 278.5200 PKR". Shown when
 * saving a version and when reverting to one, on a PO in a foreign currency.
 * Under each rate: its type, its day and the base total (Mahreen,
 * 2026-11-20); today's can be mid-market or corporate when a corporate rate
 * is set. The vendor's amounts don't change either way; the base-currency
 * totals do. */

export interface VersionRateOptions {
  /** The rate the version locked in. */
  locked: RateOption;
  /** Today's rate of each type; corporate only when a corporate rate is set. */
  today: { mid: TodayRate; corporate?: TodayRate | undefined };
  /** The type "Use today's rate" starts on: the locked rate's, when today
   *  has one of that type. */
  defaultType: RateType;
}

interface RateOption {
  /** "1 USD = 276.1000 PKR" */
  sentence: string;
  /** "Mid-market · Nov 19, 2026 · total ₨2,823,134.42" */
  meta: string;
}

interface TodayRate extends RateOption {
  /** False when it is the locked rate. */
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
      sentence: rateSentence(currency, now.exchangeRate),
      meta: `${RATE_TYPE_LABEL[type]} · Today, ${formatRateDate(now.rateDate)}${totals}`,
      differs,
    };
  };
  // Today's corporate rate falls back to mid-market when none is set: then there is no corporate option.
  const corp = todayOf("corporate");
  const corporate = corp.rateType === "corporate" ? today("corporate", corp) : undefined;
  return {
    locked: {
      sentence: rateSentence(currency, locked.rate),
      meta: `${RATE_TYPE_LABEL[locked.rateType]} · ${formatRateDate(locked.rateDate)}${withTotal ? ` · total ${inBase(locked.rate)}` : ""}`,
    },
    today: { mid: today("mid", todayOf("mid")), corporate },
    defaultType: locked.rateType === "corporate" && corporate ? "corporate" : "mid",
  };
}

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
  const corporate = options.today.corporate;
  /* Today's rate type: the one picked, else the one it starts on. */
  const type: RateType = value === "current-corporate" && corporate ? "corporate" : value === "current-mid" ? "mid" : options.defaultType;
  const today = (type === "corporate" && corporate) || options.today.mid;
  const pickToday = (t: RateType) => onChange(t === "corporate" ? "current-corporate" : "current-mid");
  const cards = [
    {
      key: "locked",
      active: value === "locked",
      title: `Keep version ${fromVersion}'s rate`,
      sentence: options.locked.sentence,
      sub: options.locked.meta,
      pick: () => onChange("locked"),
    },
    {
      key: "current",
      active: value !== "locked",
      title: "Use today's rate",
      sentence: today.sentence,
      sub: today.differs ? today.meta : `${today.meta} · same as version ${fromVersion}'s`,
      pick: () => pickToday(type),
    },
  ];
  return (
    <div className="w-full text-left" style={{ fontFamily: FONT }}>
      <p className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>
        Exchange rate
      </p>
      <p className="text-[11.5px] text-slate-500 mt-0.5">
        The vendor's amounts don't change. The PO's total in {BASE_CURRENCY} follows the rate.
      </p>
      <div className="mt-2 flex flex-col gap-2" role="radiogroup" aria-label="Exchange rate for the new version">
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
              borderColor: c.active ? "hsl(var(--primary))" : "#E2E8F0",
              backgroundColor: c.active ? "hsl(var(--primary-tint))" : "#FFFFFF",
            }}
          >
            <span
              className="mt-0.5 flex items-center justify-center w-4 h-4 rounded-full shrink-0 border"
              style={{
                borderColor: c.active ? "hsl(var(--primary))" : "#CBD5E1",
                backgroundColor: c.active ? "hsl(var(--primary))" : "#FFFFFF",
              }}
            >
              {c.active && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
            </span>
            <div className="flex-1 min-w-0">
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-[12.5px] text-slate-800" style={{ fontWeight: 600 }}>
                  {c.title}
                </span>
                <span className="text-[12px] text-slate-700 tabular-nums whitespace-nowrap" style={{ fontWeight: 500 }}>
                  {c.sentence}
                </span>
              </span>
              <span className="block text-[11px] text-slate-500 tabular-nums mt-0.5 leading-relaxed">{c.sub}</span>
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

/** The options' lines for a PO; null on a base-currency PO. */
export function versionRateOptions(po: PoFxFields, total: number): VersionRateOptions | null {
  const fx = poFx(po);
  if (fx.isBase) return null;
  return buildOptions(fx.currency, fx, (type) => currentRateFor(po, type), total);
}
