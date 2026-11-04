import * as React from "react";
import { Lock } from "lucide-react";
import {
  BASE_CURRENCY,
  getLibraryCurrency,
} from "@/app/data/currencyLibrary";
import type { POVersionEntry } from "../poStore";

interface Props {
  version: POVersionEntry;
  /** Render in compact form (single chip, no inline rate). */
  dense?: boolean;
}

/**
 * Tiny visual marker that surfaces a version's rate type, lock status, and
 * the partner→base rate that was active when the version was recorded.
 *
 * Renders nothing if the version has no rate snapshot or its currency was
 * already PKR — there's nothing meaningful to show in either case.
 */
export function POVersionRateChip({ version, dense }: Props) {
  const snap = version.rateSnapshot;
  if (!snap) return null;

  const partnerCode = (version.snapshot.vendorAmountCurrency ?? BASE_CURRENCY).toUpperCase();
  if (partnerCode === BASE_CURRENCY) return null;

  const partnerCur = getLibraryCurrency(partnerCode);
  const baseCur = getLibraryCurrency(BASE_CURRENCY);
  const baseSym = baseCur?.symbol ?? BASE_CURRENCY;

  const typeLabel = snap.rateType === "market" ? "Mid-market" : "Corporate";
  const typeHex = snap.rateType === "market" ? "#7c3aed" : "#d97706";
  const typeBg = snap.rateType === "market"
    ? "color-mix(in srgb, #7c3aed 8%, transparent)"
    : "color-mix(in srgb, #d97706 10%, transparent)";

  const lockedAtDate = (() => {
    try {
      return new Date(snap.lockedAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
    } catch {
      return null;
    }
  })();

  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
        style={{ color: typeHex, backgroundColor: typeBg, fontWeight: 600 }}
        title={`${typeLabel} · ${partnerCode} → ${BASE_CURRENCY}`}
      >
        <span className="inline-block w-1 h-1 rounded-full" style={{ backgroundColor: typeHex }} />
        {typeLabel}
      </span>
      {snap.locked && (
        <span
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px]"
          style={{ color: "#047857", backgroundColor: "#ecfdf5", border: "1px solid #a7f3d0", fontWeight: 600 }}
          title={lockedAtDate ? `Locked on ${lockedAtDate}` : "Locked"}
        >
          <Lock className="w-2.5 h-2.5" />
          {lockedAtDate ?? "Locked"}
        </span>
      )}
      {!dense && snap.lockedRate && partnerCur && (
        <span className="text-[10px] text-slate-500">
          1 {partnerCode} = {baseSym}
          {snap.lockedRate.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      )}
    </span>
  );
}
