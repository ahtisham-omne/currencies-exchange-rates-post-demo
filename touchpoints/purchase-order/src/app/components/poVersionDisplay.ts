/**
 * Shared display helpers + config for the PO version-history UI.
 * Consumed by:
 *   · POVersionHistoryTab.tsx (composer)
 *   · POVersionsToolbar.tsx / POVersionRow.tsx / POVersionSnapshotPanel.tsx
 *     / POVersionChangeList.tsx / POVersionRevertModal.tsx
 *   · POCompareFullScreen.tsx (side-by-side comparison view)
 *
 * Extracted from the original 774-LOC POVersionHistoryTab.tsx (audit 2026-07-10)
 * so the version UI can be composed from focused pieces instead of one
 * mega-component. Mirrors the Sales Order module's
 * `pages/quote-detail/tabs/versions/versionDisplay.ts` shape.
 */

import type React from "react";
import type { POChangeType } from "./poStore";
import type { POVersionStatus } from "./poStore";
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

/* 2-decimal precision so unit prices like $479.99 don't truncate to $480. */
export const formatCurrency = (n: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

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
