/* ═══════════════════════════════════════════════════════════════
   PriceConfirmationDialog — prompts the user when entered price
   differs from (or is missing on) the master vendor-item record.

   Chrome ported from Partner Management's warning-confirm dialog
   pattern (`GroupStatusChangeDialog` in ahtisham-omne/Partner-
   Management---Vendor): amber gradient wash + glow behind the
   icon, uppercase category chip, stacked full-width primary and
   secondary CTAs. Same visual language as the Outdated Configs
   modal so pricing warnings and PM warnings read as one family.

   Scenarios:
     A) Master has no price for this (vendor, unit) → offer to save
        the entered price as the new default for this vendor+unit.
     B) Master has a different price for this (vendor, unit) → offer
        to update the master, OR keep the entered price as a one-off.
     C) Price matches master → caller should NOT mount this dialog.
     D) Price is $0 / blank → caller should NOT mount this dialog.
   ═══════════════════════════════════════════════════════════════ */

"use client";

import * as React from "react";
import { AlertTriangle, Trash2, Plus, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { formatMoney } from "@/app/currency/money";
import { vendorCurrency } from "@/app/currency/poFx";

const FONT = "'PP Object Sans', system-ui, -apple-system, BlinkMacSystemFont, sans-serif";

export type PriceConfirmationScenario = "save-as-default" | "update-default";

/* Tone palettes — mirrors Partner Management's warning / destructive
   variants (see `GroupStatusChangeDialog` and the archive/delete
   dialogs in ContactsDirectoryPage). Amber for warnings that
   preserve data (edit / change default); red for destructive
   removals (remove tier). */
const AMBER = {
  wash: "#FFFBEB",
  washSoft: "rgba(255,251,235,0.3)",
  glow: "#F59E0B",
  iconBg: "#FEF3C7",
  iconColor: "#B45309",
  chipBg: "#FFFBEB",
  chipFg: "#92400E",
  primaryBg: "#F59E0B",
};
const RED = {
  wash: "#FEF2F2",
  washSoft: "rgba(254,242,242,0.3)",
  glow: "#EF4444",
  iconBg: "#FEE2E2",
  iconColor: "#DC2626",
  chipBg: "#FEF2F2",
  chipFg: "#991B1B",
  primaryBg: "#DC2626",
};
/* Blue "add" tone — mirrors Partner Management's Save-Version /
   Create-* modals (see `POVersionSaveModal`). Used when the buyer
   is adding a brand-new tier so the entry-point feels constructive
   rather than warning-y. */
const BLUE = {
  wash: "#EFF6FF",
  washSoft: "rgba(239,246,255,0.3)",
  glow: "#3B82F6",
  iconBg: "#DBEAFE",
  iconColor: "hsl(var(--primary))",
  chipBg: "#EFF6FF",
  chipFg: "#1E40AF",
  primaryBg: "hsl(var(--primary))",
};

/* ── Presentational shell — the shared amber warning chrome ──
   Consumers pass the copy (chip / title / description / labels)
   and the two handlers. Used by PriceConfirmationDialog below
   for the entered-price scenarios AND directly from the pricing-
   tier surfaces for delete / set-default flows (OrderFlow.tsx).
   Keeping one shell means all four pricing warnings look
   identical and any chrome tweak only needs to happen once. */
export type PriceWarningTone = "amber" | "red" | "blue";

export interface PriceWarningShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chipLabel: string;
  title: string;
  description: React.ReactNode;
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
  /** Colour + icon family. Amber (default) for edit / set-default;
   *  red for destructive remove-tier — matches Partner Management's
   *  archive / deactivate dialogs. */
  tone?: PriceWarningTone;
  /** Optional third "back out" action — a quiet text button under the
   *  two CTAs plus a close X in the header. Both just close the window
   *  (via `onCancel`, else `onOpenChange(false)`), applying nothing. */
  cancelLabel?: string;
  onCancel?: () => void;
}

export function PriceWarningShell({
  open,
  onOpenChange,
  chipLabel,
  title,
  description,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  tone = "amber",
  cancelLabel,
  onCancel,
}: PriceWarningShellProps) {
  const palette = tone === "red" ? RED : tone === "blue" ? BLUE : AMBER;
  const Icon = tone === "red" ? Trash2 : tone === "blue" ? Plus : AlertTriangle;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
        style={{ zIndex: 300, fontFamily: FONT, backgroundColor: "#FFFFFF" }}
        onInteractOutside={() => onOpenChange(false)}
      >
        <div
          className="relative flex flex-col items-center pt-10 pb-6"
          style={{
            background: `linear-gradient(180deg, ${palette.wash} 0%, ${palette.washSoft} 70%, transparent 100%)`,
          }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25"
            style={{ backgroundColor: palette.glow }}
          />
          <div
            className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: palette.iconBg }}
          >
            <Icon className="w-8 h-8" style={{ color: palette.iconColor }} />
          </div>
          <span
            className="mt-4 px-3 py-1 rounded-full text-[11px]"
            style={{
              fontWeight: 600,
              backgroundColor: palette.chipBg,
              color: palette.chipFg,
              textTransform: "uppercase" as const,
              letterSpacing: "0.05em",
            }}
          >
            {chipLabel}
          </span>
          {cancelLabel && (
            <button
              type="button"
              onClick={() => {
                onCancel?.();
                onOpenChange(false);
              }}
              className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-white/50 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>

        <div className="flex flex-col items-center text-center px-8 pb-8">
          <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
            <AlertDialogTitle
              className="text-[18px] tracking-[-0.02em]"
              style={{ fontWeight: 600, color: "var(--foreground)" }}
            >
              {title}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription
            className="text-[13px] mt-2 max-w-[340px] mx-auto"
            style={{ color: "var(--muted-foreground)", lineHeight: "1.65" }}
          >
            {description}
          </AlertDialogDescription>
          <div className="w-full mt-7 flex flex-col gap-2.5">
            <button
              onClick={() => {
                onPrimary();
                onOpenChange(false);
              }}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
              style={{
                fontWeight: 600,
                backgroundColor: palette.primaryBg,
                color: "#fff",
              }}
            >
              {primaryLabel}
            </button>
            <button
              onClick={() => {
                onSecondary();
                onOpenChange(false);
              }}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:bg-slate-100"
              style={{
                fontWeight: 500,
                backgroundColor: "var(--muted)",
                color: "#334155",
              }}
            >
              {secondaryLabel}
            </button>
            {cancelLabel && (
              <button
                type="button"
                onClick={() => {
                  onCancel?.();
                  onOpenChange(false);
                }}
                className="w-full h-9 text-[13px] rounded-xl border-0 bg-transparent cursor-pointer transition-colors hover:bg-slate-50"
                style={{ fontWeight: 500, color: "hsl(var(--muted-foreground))" }}
              >
                {cancelLabel}
              </button>
            )}
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export interface PriceConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenario: PriceConfirmationScenario;
  vendorName: string;
  unit: string;
  enteredPrice: number;
  existingDefaultPrice?: number;
  /** Primary action: save / update the master record */
  onConfirmDefault: () => void;
  /** Secondary action: use the price on this PO only, leave master untouched */
  onUseOnce: () => void;
  /** "add" swaps the amber warning chrome for Partner Management's
   *  blue Save-Version chrome + adding-copy — used when the buyer
   *  is genuinely adding a new tier, not warning about a mismatch. */
  variant?: "warning" | "add";
  /** The prices' currency; defaults to the vendor's. */
  currency?: string;
}

/** A vendor price-book amount, in that vendor's currency (spec 4.2) unless
 *  the caller says which. */
function fmt(price: number, vendorName: string, currency?: string): string {
  return formatMoney(price, currency ?? vendorCurrency(vendorName));
}

export function PriceConfirmationDialog({
  open,
  onOpenChange,
  scenario,
  vendorName,
  unit,
  enteredPrice,
  existingDefaultPrice,
  onConfirmDefault,
  onUseOnce,
  variant = "warning",
  currency,
}: PriceConfirmationDialogProps) {
  const isSaveAsDefault = scenario === "save-as-default";
  const isAdd = variant === "add";

  const chipLabel = isAdd
    ? "Add Price"
    : isSaveAsDefault
      ? "Save Vendor Price"
      : "Update Vendor Price";
  const title = isAdd
    ? "Add this price to the qualified vendor?"
    : isSaveAsDefault
      ? "Save this price for the qualified vendor?"
      : "Update the qualified vendor's price?";
  const description = isAdd ? (
    <>
      You're adding{" "}
      <strong>
        {fmt(enteredPrice, vendorName, currency)} / {unit}
      </strong>{" "}
      for <strong>{vendorName}</strong>. Add it to the qualified vendor so it
      appears on future POs too, or add it only for this PO?
    </>
  ) : isSaveAsDefault ? (
    <>
      No saved price exists for <strong>{vendorName}</strong> per{" "}
      <strong>{unit}</strong>. Save{" "}
      <strong>
        {fmt(enteredPrice, vendorName, currency)} / {unit}
      </strong>{" "}
      to the qualified vendor so it applies here and on future POs, or use it
      only on this PO?
    </>
  ) : (
    <>
      The saved price for <strong>{vendorName}</strong> per{" "}
      <strong>{unit}</strong> is{" "}
      <strong>{fmt(existingDefaultPrice ?? 0, vendorName, currency)}</strong>. You entered{" "}
      <strong>{fmt(enteredPrice, vendorName, currency)}</strong>. Update the qualified vendor to{" "}
      <strong>{fmt(enteredPrice, vendorName, currency)}</strong> (applies here and on future POs), or
      use the new price only on this PO?
    </>
  );
  const primaryLabel = isAdd
    ? "Add to Qualified Vendor & Use Here"
    : "Update Qualified Vendor & Use Here";
  const secondaryLabel = isAdd ? "Add on This PO Only" : "Use on This PO Only";

  return (
    <PriceWarningShell
      open={open}
      onOpenChange={onOpenChange}
      tone={isAdd ? "blue" : "amber"}
      chipLabel={chipLabel}
      title={title}
      description={description}
      primaryLabel={primaryLabel}
      secondaryLabel={secondaryLabel}
      onPrimary={onConfirmDefault}
      onSecondary={onUseOnce}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   Helpers for the two additional pricing warnings raised from
   the tier table (Remove tier · Set-as-default). Callers build
   the copy via these, then feed the result into PriceWarningShell.
   Kept next to the entered-price scenarios so a future audit of
   pricing warnings only has to read one file.
   ═══════════════════════════════════════════════════════════════ */

export interface RemovePriceCopy {
  chipLabel: string;
  title: string;
  description: React.ReactNode;
  primaryLabel: string;
  secondaryLabel: string;
  tone: PriceWarningTone;
}

export function removePriceCopy(opts: {
  vendorName: string;
  unit: string;
  price: number;
  isDefault: boolean;
  fallbackUnit?: string;
  currency?: string;
}): RemovePriceCopy {
  const { vendorName, unit, price, isDefault, fallbackUnit, currency } = opts;
  return {
    tone: "red",
    chipLabel: "Caution",
    title: `Remove the ${unit} price?`,
    description: (
      <>
        This removes <strong>{fmt(price, vendorName, currency)} / {unit}</strong> for{" "}
        <strong>{vendorName}</strong> from the qualified vendor and from this
        PO. Future POs won't see this tier either.
        {isDefault && fallbackUnit ? (
          <>
            {" "}It's the current default — the <strong>{fallbackUnit}</strong>{" "}
            tier will become the new default automatically.
          </>
        ) : isDefault ? (
          <>
            {" "}It's the current default and no other tiers are configured —
            you'll need to add a new price before this vendor can be used.
          </>
        ) : null}
      </>
    ),
    primaryLabel: "Remove from Qualified Vendor and Here",
    secondaryLabel: "Cancel",
  };
}

export interface ChangeDefaultCopy {
  chipLabel: string;
  title: string;
  description: React.ReactNode;
  primaryLabel: string;
  secondaryLabel: string;
  tone: PriceWarningTone;
}

export function changeDefaultCopy(opts: {
  vendorName: string;
  oldUnit: string;
  oldPrice: number;
  newUnit: string;
  newPrice: number;
  currency?: string;
}): ChangeDefaultCopy {
  const { vendorName, oldUnit, oldPrice, newUnit, newPrice, currency } = opts;
  return {
    tone: "amber",
    chipLabel: "Change Default Unit",
    title: `Set ${newUnit} as the default?`,
    description: (
      <>
        The default for <strong>{vendorName}</strong> on this item is{" "}
        <strong>{oldUnit}</strong> at <strong>{fmt(oldPrice, vendorName, currency)}</strong>. Set{" "}
        <strong>{fmt(newPrice, vendorName, currency)} / {newUnit}</strong> as the default on the
        qualified vendor (applies here and on future POs), or use it as the
        default only on this PO?
      </>
    ),
    primaryLabel: "Update Qualified Vendor & Use Here",
    secondaryLabel: "Use on This PO Only",
  };
}

/* ═══════════════════════════════════════════════════════════════
   Helper — classify a price entry against the master record.
   Centralizes the "should we prompt?" decision so every touch
   point follows the same rule:
     - $0 / NaN / blank        → silent (no prompt)
     - no master tier          → save-as-default prompt
     - master tier differs     → update-default prompt
     - master tier matches     → silent (no prompt)
   ═══════════════════════════════════════════════════════════════ */

export type PriceCheckOutcome =
  | { kind: "silent" }
  | { kind: "save-as-default"; vendorName: string; unit: string; enteredPrice: number }
  | { kind: "update-default"; vendorName: string; unit: string; enteredPrice: number; existingDefaultPrice: number };

export function classifyPriceChange(opts: {
  vendorName: string;
  unit: string;
  enteredPrice: number;
  existingMasterPrice: number | undefined;
}): PriceCheckOutcome {
  const { vendorName, unit, enteredPrice, existingMasterPrice } = opts;
  // $0 / blank / NaN entries are always silent — zero-priced lines are first-class.
  if (!Number.isFinite(enteredPrice) || enteredPrice <= 0) return { kind: "silent" };
  // No master record (or master is 0/blank) → invite save-as-default.
  if (!Number.isFinite(existingMasterPrice ?? NaN) || (existingMasterPrice ?? 0) <= 0) {
    return { kind: "save-as-default", vendorName, unit, enteredPrice };
  }
  // Within half-a-cent → treat as matching, no prompt.
  if (Math.abs((existingMasterPrice as number) - enteredPrice) < 0.005) return { kind: "silent" };
  return {
    kind: "update-default",
    vendorName,
    unit,
    enteredPrice,
    existingDefaultPrice: existingMasterPrice as number,
  };
}
