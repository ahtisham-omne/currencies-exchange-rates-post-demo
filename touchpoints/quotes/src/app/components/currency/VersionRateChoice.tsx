import * as React from "react";
import type { VersionRateChoice as Choice } from "@/app/data/quoteStore";
import { BASE_CURRENCY, isBaseCurrency } from "@/app/currency/currencies";
import { formatMoney, formatRateDate, rateSentence } from "@/app/currency/money";
import { currentRateFor } from "@/app/currency/qFx";
import { toBase, type RateType } from "@/app/currency/rates";
import { useDocCurrency } from "./docCurrencyContext";

/* ── A new version's rate: the locked one, or today's ─────────────────
 * Ported from the earlier touchpoint's "Use locked rate or apply current
 * rate?", as Purchase Orders has it. Shown when a version is created (a
 * material change on a sent quote, Edit as a new version, Reactivate) and
 * when reverting to one, on a quote in a foreign currency. The customer's
 * amounts don't change either way; the base-currency totals do. */

const FONT = "Inter, system-ui, sans-serif";

export interface VersionRateOptions {
  locked: string;
  current: string;
  /** False when today's rate is the locked one: nothing to choose. */
  differs: boolean;
}

/** The rate a version keeps: a quote's, or a version's on record. */
export interface LockedRate {
  currency: string;
  rate: number;
  rateType: RateType;
  rateDate: string;
}

/** The two options' lines for a rate; null on a base-currency quote. With
 *  `total` (in the quote's currency) they give the base total each way. */
export function versionRateOptions(locked: LockedRate, total?: number): VersionRateOptions | null {
  if (isBaseCurrency(locked.currency)) return null;
  const now = currentRateFor({ currency: locked.currency, exchangeRate: locked.rate, rateType: locked.rateType, rateDate: locked.rateDate });
  const withTotal = total != null && Number.isFinite(total);
  const before = withTotal ? formatMoney(toBase(total, locked.rate), BASE_CURRENCY) : "";
  const after = withTotal ? formatMoney(toBase(total, now.exchangeRate), BASE_CURRENCY) : "";
  return {
    locked: `${rateSentence(locked.currency, locked.rate)} · ${formatRateDate(locked.rateDate)}${withTotal ? ` · total ${before}` : ""}`,
    current: `${rateSentence(locked.currency, now.exchangeRate)} today${withTotal ? ` · total ${before} → ${after}` : ""}`,
    differs: Math.abs(now.exchangeRate - locked.rate) > 1e-9,
  };
}

/** The options for reverting to (or making a version from) `version`, at the
 *  rate it locked in; the quote's own when `version` is left out. */
export function useVersionRateOptions(version?: number, total?: number): VersionRateOptions | null {
  const doc = useDocCurrency();
  const fx = (version != null ? doc.versionFx?.(version) : null) ?? doc.fx;
  if (!fx) return null;
  return versionRateOptions({ currency: doc.currency, rate: fx.rate, rateType: fx.rateType, rateDate: fx.rateDate }, total);
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
  const cards: { key: Choice; title: string; sub: string }[] = [
    { key: "locked", title: `Use locked rate from V${fromVersion}`, sub: options.locked },
    {
      key: "current",
      title: "Apply current rate",
      sub: options.differs ? `Recompute totals against today's market snapshot: ${options.current}` : `Today's rate is the same: ${options.current}`,
    },
  ];
  return (
    <div className="w-full text-left" style={{ fontFamily: FONT }}>
      <p className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>
        Exchange rate
      </p>
      <p className="text-[11.5px] text-slate-500 mt-0.5">
        Use locked rate from V{fromVersion} or apply current rate?
      </p>
      <div className="mt-2 flex flex-col gap-2" role="radiogroup" aria-label="Exchange rate for the new version">
        {cards.map((c) => {
          const active = value === c.key;
          return (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(c.key)}
              className="flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer"
              style={{
                borderColor: active ? "var(--primary)" : "#E2E8F0",
                backgroundColor: active ? "#EDF4FF" : "#FFFFFF",
              }}
            >
              <span
                className="mt-0.5 flex items-center justify-center w-4 h-4 rounded-full shrink-0 border"
                style={{
                  borderColor: active ? "var(--primary)" : "#CBD5E1",
                  backgroundColor: active ? "var(--primary)" : "#FFFFFF",
                }}
              >
                {active && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[12.5px] text-slate-800" style={{ fontWeight: 600 }}>
                  {c.title}
                </span>
                <span className="block text-[11px] text-slate-500 tabular-nums mt-0.5 leading-relaxed">{c.sub}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
