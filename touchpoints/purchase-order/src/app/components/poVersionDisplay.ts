/**
 * Shared display helpers + config for the PO version-history UI.
 * Consumed by:
 *   · POVersionHistoryTab.tsx (composer)
 *   · POVersionsToolbar.tsx / POVersionRow.tsx / POVersionSnapshotPanel.tsx
 *     / POVersionChangeList.tsx / POVersionRevertModal.tsx
 *   · POCompareFullScreen.tsx (side-by-side comparison view)
 *   · POVersionHistoryModal.tsx / POVersionDropdown.tsx (version currency)
 *
 * Extracted from the original 774-LOC POVersionHistoryTab.tsx (audit 2026-07-10)
 * so the version UI can be composed from focused pieces instead of one
 * mega-component. Mirrors the Sales Order module's
 * `pages/quote-detail/tabs/versions/versionDisplay.ts` shape.
 */

import { useMemo } from "react";
import type React from "react";
import type { POChangeType, POVersionEntry, POVersionSnapshot } from "./poStore";
import type { POVersionStatus } from "./poStore";
import { isBaseCurrency } from "@/app/currency/currencies";
import { formatMoney, formatRate, formatRateDate, rateSentence } from "@/app/currency/money";
import { poFx, rateSourceLabel, type PoFx } from "@/app/currency/poFx";
import { snapshotOneTimeNet } from "./poOrderPricing";
import { useDocCurrency } from "./currency/docCurrencyContext";
import {
  Plus,
  Trash2,
  Edit,
  DollarSign,
  Tag,
  Send,
  CheckCircle2,
  FileText,
  Package,
  Paperclip,
  Scale,
  Percent,
  ArrowLeftRight,
} from "lucide-react";

/* ── Config — palette aligned to Partners' canonical status tints
   (see `Partners/.../VendorDetailsPage.tsx`):
     - slate  → Draft / Latest (neutral)
     - blue   → Sent (Vendor type-badge palette)
     - emerald→ Confirmed (Active status palette)
     - amber  → Partial / Revert (Inactive/historic palette)
   Each pill has an explicit border tint so it reads as a defined chip,
   not a fuzzy fill. Change-type icons retain their action semantics
   (added=emerald, removed=red, modified=amber, etc.) for at-a-glance
   diff comprehension.

   New taxonomy entries (attachment-added / rule-applied / adjustment-applied)
   mirror the Sales Order module's version-change categories. */
export const changeTypeConfig: Record<
  POChangeType,
  { icon: React.ElementType; color: string; bg: string; border: string }
> = {
  "line-item-added":     { icon: Plus,       color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0" },
  "line-item-removed":   { icon: Trash2,     color: "#991B1B", bg: "#FEF2F2", border: "#FECACA" },
  "line-item-modified":  { icon: Edit,       color: "#92400E", bg: "#FFFBEB", border: "#FDE68A" },
  "pricing-changed":     { icon: DollarSign, color: "#1E40AF", bg: "#EFF6FF", border: "#BFDBFE" },
  "vendor-changed":      { icon: Edit,       color: "#5B21B6", bg: "#F5F3FF", border: "#DDD6FE" },
  "config-changed":      { icon: Tag,        color: "#475569", bg: "#F1F5F9", border: "#E2E8F0" },
  "attachment-added":    { icon: Paperclip,  color: "#0F766E", bg: "#F0FDFA", border: "#99F6E4" },
  "rule-applied":        { icon: Scale,      color: "#6D28D9", bg: "#F5F3FF", border: "#DDD6FE" },
  "adjustment-applied":  { icon: Percent,    color: "#B45309", bg: "#FFFBEB", border: "#FDE68A" },
  // The PO's currency or exchange rate changed (spec 4.3).
  "exchange-rate-changed": { icon: ArrowLeftRight, color: "#0369A1", bg: "#F0F9FF", border: "#BAE6FD" },
};

export const versionStatusConfig: Record<
  POVersionStatus,
  { label: string; bg: string; color: string; border: string; icon: React.ElementType }
> = {
  draft:                { label: "Draft",              bg: "#F1F5F9", color: "#334155", border: "#E2E8F0", icon: FileText },
  sent:                 { label: "Sent",               bg: "#EFF6FF", color: "#1E40AF", border: "#BFDBFE", icon: Send },
  confirmed:            { label: "Confirmed",          bg: "#ECFDF5", color: "#065F46", border: "#A7F3D0", icon: CheckCircle2 },
  "partially-received": { label: "Partially Received", bg: "#FFFBEB", color: "#92400E", border: "#FDE68A", icon: Package },
};

/* Standard slate ladder used throughout the version UI (matches the rest of
   the Partners-aligned chrome). Defined once so the tokens are consistent. */
export const versionPalette = {
  border: "#E2E8F0",   // slate-200
  divider: "#F1F5F9",  // slate-100
  text900: "#0F172A",  // slate-900 — primary text
  text700: "#334155",  // slate-700 — secondary headings
  text600: "#475569",  // slate-600 — body
  text500: "#64748B",  // slate-500 — labels / muted body
  text400: "#94A3B8",  // slate-400 — captions / hints
  muted:   "#F8FAFC",  // slate-50 — hover bg
};

/* An amount in a version's currency, with that currency's symbol and
   decimals: $479.99 · €980.50 · ¥15,000 · MXN 1,200.00 (spec 4.3). */
export const formatCurrency = (n: number, code: string): string => formatMoney(n, code);

/* The one-time discounts/premiums net, signed: +$40.00 · −€12.50. */
export function formatSignedCurrency(n: number, code: string): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${formatMoney(Math.abs(n), code)}`;
}

/* ── A version's currency and rate ──────────────────────────────────
   Each snapshot records the currency and rate the PO had at that
   version. Snapshots saved before versions carried one fall back to the
   PO's current currency (`fallback`), else to their vendor's default. */
export function versionFx(snapshot: POVersionSnapshot, fallback?: PoFx | null): PoFx {
  if (!snapshot.currency && fallback) return fallback;
  return poFx({ ...snapshot, vendor: { name: snapshot.vendor?.name || snapshot.vendorName } });
}

/* The PO page's currency (its DocCurrencyProvider) as a PoFx: the fallback
   above. Null outside the PO page, where callers pass `poFx(po)` instead. */
export function useDocFx(): PoFx | null {
  const { currency, fx } = useDocCurrency();
  return useMemo(
    () =>
      fx
        ? {
            currency,
            rate: fx.rate,
            rateType: fx.rateType,
            rateDate: fx.rateDate,
            source: fx.source,
            provisional: false,
            isBase: isBaseCurrency(currency),
          }
        : null,
    [currency, fx],
  );
}

/* "Mid-market" · "Corporate" · "Corporate, changed on the PO". */
export function rateTypeText(fx: PoFx): string {
  if (fx.rateType === "mid") return "Mid-market";
  return fx.source === rateSourceLabel("corporate", true) ? "Corporate, changed on the PO" : "Corporate";
}

/* "1 USD = 274.3045 PKR · Mid-market · Feb 20, 2026", or "No conversion"
   for a version in the base currency. */
export function rateText(fx: PoFx): string {
  if (fx.isBase) return "No conversion";
  return `${rateSentence(fx.currency, fx.rate)} · ${rateTypeText(fx)} · ${formatRateDate(fx.rateDate)}`;
}

/* Versions whose currency differs from the version before or after them:
   their rows mark the currency next to the total. */
export function currencyShiftVersions(
  versions: POVersionEntry[],
  fallback?: PoFx | null,
): Set<number> {
  const ordered = [...versions].sort((a, b) => a.version - b.version);
  const codes = ordered.map((v) => versionFx(v.snapshot, fallback).currency);
  const out = new Set<number>();
  for (let i = 1; i < ordered.length; i++) {
    if (codes[i] !== codes[i - 1]) {
      out.add(ordered[i - 1].version);
      out.add(ordered[i].version);
    }
  }
  return out;
}

/* ── Compare rows (POCompareFullScreen + the history modal's CompareView) ──
   Amounts are written in each side's own currency. `n1`/`n2` carry the
   numbers behind the text only when both sides share a unit, so the
   up/down arrows never weigh dollars against euros. */
export interface VersionCompareField {
  label: string;
  kind: "count" | "currency" | "rate" | "money";
  val1: string;
  val2: string;
  n1?: number;
  n2?: number;
}

export function versionCompareFields(
  v1: POVersionEntry,
  v2: POVersionEntry,
  fx1: PoFx,
  fx2: PoFx,
): VersionCompareField[] {
  const s1 = v1.snapshot;
  const s2 = v2.snapshot;
  const sameCurrency = fx1.currency === fx2.currency;
  const money = (label: string, a: number, b: number, signed = false): VersionCompareField => ({
    label,
    kind: "money",
    val1: signed ? formatSignedCurrency(a, fx1.currency) : formatCurrency(a, fx1.currency),
    val2: signed ? formatSignedCurrency(b, fx2.currency) : formatCurrency(b, fx2.currency),
    ...(sameCurrency ? { n1: a, n2: b } : {}),
  });
  // A rate as shown (4 decimals), so float noise never reads as a change.
  const shownRate = (fx: PoFx) => Number(formatRate(fx.rate).replace(/,/g, ""));
  return [
    {
      label: "Line Items",
      kind: "count",
      val1: String(s1.lineItemCount),
      val2: String(s2.lineItemCount),
      n1: s1.lineItemCount,
      n2: s2.lineItemCount,
    },
    { label: "Currency", kind: "currency", val1: fx1.currency, val2: fx2.currency },
    {
      label: "Exchange rate",
      kind: "rate",
      val1: rateText(fx1),
      val2: rateText(fx2),
      ...(sameCurrency && !fx1.isBase ? { n1: shownRate(fx1), n2: shownRate(fx2) } : {}),
    },
    money("Subtotal", s1.subtotal, s2.subtotal),
    money("Discount", s1.discountTotal, s2.discountTotal),
    money("One-Time Discounts/Premiums", snapshotOneTimeNet(s1), snapshotOneTimeNet(s2), true),
    money("Total", s1.total, s2.total),
  ];
}

/* Deterministic per-user avatar colour. Keeps the same buyer's changes
   visually grouped across the version history. */
export function getUserColor(name: string): string {
  if (name === "Areeb Tanvir") return "#3B82F6";
  if (name === "Nophil Anwer") return "#8B5CF6";
  if (name === "Irtaza Abid") return "#F59E0B";
  if (name === "Shehryar Hasan") return "#10B981";
  if (name === "Eli Rosenbloom") return "#EC4899";
  return "#6B7280";
}

/* Two-letter initials from a "First Last" name. */
export function getUserInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase();
}

/* Re-export the status type so callers have a single import path
   (`./poVersionDisplay`) instead of reaching into `./poStore` directly. */
export type { POVersionStatus } from "./poStore";
