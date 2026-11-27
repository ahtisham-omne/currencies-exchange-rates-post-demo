import { currentRateFor, versionRateFields } from "@/app/components/so/soCurrency";
import type { SalesOrder } from "@/app/components/so/types";
import { BASE_CURRENCY, isBaseCurrency } from "@/app/currency/currencies";
import { formatMoney, rateSentence } from "@/app/currency/money";
import { toBase } from "@/app/currency/rates";
import { RateTypeChip } from "./SOCurrencyConfig";

/* ── Revert to a version: the exchange rate it takes ──────────────────
 * Ported from Purchase Orders' POVersionRevertModal (25 Nov 2026). A
 * restored version always takes today's rate (store.revertToVersion), so on
 * an order in a foreign currency the revert confirm says so under its
 * description: today's rate of the version's type, with that chip, and the
 * version's total in base at its own rate → at today's. Nothing on a
 * base-currency order. Without the version's total (`total` left out) only
 * the first two rows show.
 *
 * Sits as the first child of the shared ConfirmDiscardModal, whose children
 * wrapper already gives the 20px (mt-5) under the description; the 20px
 * below keeps the reason field where PO has it. */
export function RevertRateBox({ so, version, total }: {
  so?: SalesOrder;
  /** The version being restored. */
  version: number;
  /** The version's total, in the order's currency. */
  total?: number;
}) {
  if (!so) return null;
  const locked = versionRateFields(so, version);
  if (isBaseCurrency(locked.currency)) return null;
  // Today's rate of the version's own type (the daily market rate when no corporate rate is set).
  const today = currentRateFor({ ...so, ...locked });

  return (
    <div
      className="w-full rounded-lg border text-left"
      style={{ borderColor: "#E2E8F0", backgroundColor: "#FFFFFF", padding: "10px 12px", marginBottom: 20 }}
    >
      <div className="flex items-center justify-between" style={{ gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#64748B" }}>Exchange rate</span>
        <RateTypeChip type={today.rateType} />
      </div>
      <div className="tabular-nums" style={{ fontSize: 13, color: "#0F172A", marginTop: 4 }}>
        Today's rate: <span style={{ fontWeight: 600 }}>{rateSentence(locked.currency, today.exchangeRate)}</span>
      </div>
      {total != null && (
        <div className="tabular-nums" style={{ fontSize: 12.5, color: "#64748B", marginTop: 2 }}>
          {BASE_CURRENCY} total: {formatMoney(toBase(total, locked.exchangeRate), BASE_CURRENCY)} →{" "}
          <span style={{ fontWeight: 600, color: "#0F172A" }}>{formatMoney(toBase(total, today.exchangeRate), BASE_CURRENCY)}</span>
        </div>
      )}
    </div>
  );
}
