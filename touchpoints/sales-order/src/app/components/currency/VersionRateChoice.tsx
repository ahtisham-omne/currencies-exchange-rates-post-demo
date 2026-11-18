import * as React from "react";
import { currentRateFor, type VersionRateChoice as Choice } from "@/app/components/so/soCurrency";
import { BASE_CURRENCY } from "@/app/currency/currencies";
import { formatMoney, formatRateDate, rateSentence } from "@/app/currency/money";
import { soFx, type SoFxFields } from "@/app/currency/soFx";
import { toBase } from "@/app/currency/rates";

/* ── A new version's rate: the locked one, or today's ─────────────────
 * Ported from the earlier Sales Orders touchpoint's revert prompt ("Restore
 * locked rate from V{n}" / "Refresh to today's rate"), in the words Purchase
 * Orders uses: "Use locked rate from V{n} or apply current rate?". Shown when
 * a version is started and when one is reverted to, on an order in a foreign
 * currency. The customer's amounts don't change either way; the base-currency
 * totals do. */

const FONT = "Inter, system-ui, sans-serif";

export interface VersionRateOptions {
  locked: string;
  current: string;
  /** False when today's rate is the locked one: nothing to choose. */
  differs: boolean;
}

/** The two options' lines for an order (at the rate the version locked in);
 *  null on a base-currency order. */
export function versionRateOptions(so: SoFxFields, total: number): VersionRateOptions | null {
  const fx = soFx(so);
  if (fx.isBase) return null;
  const now = currentRateFor(so);
  const before = formatMoney(toBase(total, fx.rate), BASE_CURRENCY);
  const after = formatMoney(toBase(total, now.exchangeRate), BASE_CURRENCY);
  return {
    locked: `${rateSentence(fx.currency, fx.rate)} · ${formatRateDate(fx.rateDate)} · total ${before}`,
    current: `${rateSentence(fx.currency, now.exchangeRate)} today · total ${before} → ${after}`,
    differs: Math.abs(now.exchangeRate - fx.rate) > 1e-9,
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
      <div className="mt-2 flex flex-col gap-2" role="radiogroup" aria-label="Exchange rate for the version">
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
                backgroundColor: active ? "rgba(10,119,255,0.06)" : "#FFFFFF",
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
