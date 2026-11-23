import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "./ui/alert-dialog";
import { FONT } from "./designTokens";
import type { POVersionSnapshot, VersionRateChoice } from "./poStore";
import { VersionRateChoice as VersionRateChoiceCards, versionRateOptions } from "./currency/VersionRateChoice";
import { useDocView } from "./currency/docCurrencyContext";
import { formatCurrency, rateTypeText, useDocFx, versionFx } from "./poVersionDisplay";
import { BASE_CURRENCY } from "@/app/currency/currencies";
import { formatRate, rateSentence } from "@/app/currency/money";
import type { PoFx } from "@/app/currency/poFx";
import { toBase } from "@/app/currency/rates";
import { CurrencyFlag } from "./currency/CurrencyChip";

/**
 * Revert-to-version confirmation modal — ported from the Sales Orders V5
 * shared `ConfirmDiscardModal` destructive variant (buyer 2026-07-22:
 * "update the revert modal as well see in sales order repo").
 *
 * Nested inside the Version History Dialog. Uses the shadcn/Radix
 * AlertDialog primitive so Radix's layer stack handles pointer-event
 * routing over the parent Version History Dialog.
 *
 * Design:
 *   - 440px rounded-2xl card, centered via inline fixed positioning
 *   - Red gradient banner + red glow behind a 64px icon tile
 *   - Uppercase red badge pill ("REVERT TO V{n}")
 *   - Centered title + description
 *   - Optional Reason textarea (buyer-supplied context)
 *   - Stacked buttons: red confirm (h-11) on top, grey Cancel below
 */
interface POVersionRevertModalProps {
  version: number;
  onClose: () => void;
  /** With the rate the PO takes: the version's locked one, or today's. */
  onConfirm: (reason: string, rateChoice: VersionRateChoice) => void;
  /** The version being restored. When given, its total is shown in its
      own currency, with a note when reverting changes the PO's currency
      or rate (the snapshot's are restored with it). */
  snapshot?: POVersionSnapshot;
  /** The PO's currency and rate now. Defaults to the PO page's (DocCurrency). */
  currentFx?: PoFx | null;
}

/* What reverting does to the PO's currency or rate, if anything. */
function rateChangeNote(fx: PoFx, now: PoFx): string | null {
  if (fx.currency !== now.currency) {
    return fx.isBase
      ? `Puts the PO back in ${fx.currency} (now ${now.currency}); no conversion.`
      : `Puts the PO back in ${fx.currency} (now ${now.currency}) at ${rateSentence(fx.currency, fx.rate)} · ${rateTypeText(fx)}.`;
  }
  if (fx.isBase) return null;
  const typeChanged = fx.rateType !== now.rateType;
  if (formatRate(fx.rate) === formatRate(now.rate) && !typeChanged) return null;
  return `Restores the rate ${rateSentence(fx.currency, fx.rate)} · ${rateTypeText(fx)} (now ${formatRate(now.rate)}${typeChanged ? `, ${rateTypeText(now)}` : ""}).`;
}

/* Positioning — kills shadcn's translate-50% centering and re-centers
   via inline `fixed`. Inline beats class-based positioning because
   tailwind-merge can drop the layout classes when we override
   defaults. Same pattern SO uses. */
const positioningStyle: React.CSSProperties = {
  position: "fixed",
  top: "50%",
  left: "50%",
  right: "auto",
  bottom: "auto",
  translate: "none",
  transform: "translate(-50%, -50%)",
  margin: 0,
  width: "calc(100% - 2rem)",
  height: "auto",
  maxWidth: 440,
  maxHeight: "calc(100dvh - 2rem)",
  backgroundColor: "#FFFFFF",
  borderRadius: 16,
  boxShadow: "0 24px 80px -12px rgba(0,0,0,0.25)",
  /* Sit above the Version History Dialog (z-50 by default). 14000 is
     the SO convention for the destructive confirm layer. */
  zIndex: 14000,
};

export default function POVersionRevertModal({
  version,
  onClose,
  onConfirm,
  snapshot,
  currentFx,
}: POVersionRevertModalProps) {
  const [reason, setReason] = useState("");
  const [rateChoice, setRateChoice] = useState<VersionRateChoice>("locked");
  const view = useDocView();
  const docFx = useDocFx();
  const nowFx = currentFx ?? docFx;
  const fx = snapshot ? versionFx(snapshot, nowFx) : null;
  // Only a snapshot that recorded its currency restores one.
  const note = fx && nowFx && snapshot?.currency ? rateChangeNote(fx, nowFx) : null;
  // A foreign version: keep its locked rate, or apply today's.
  const rateOptions = fx && snapshot && !fx.isBase
    ? versionRateOptions({ ...snapshot, currency: fx.currency, exchangeRate: fx.rate, rateType: fx.rateType, rateDate: fx.rateDate }, snapshot.total)
    : null;
  // The page's view: base (vendor amount beside it) or the vendor's (base beside it).
  const showBase = !!fx && !fx.isBase && view.inBase;

  return (
    <AlertDialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      {/* No outside-click close: Radix's AlertDialog blocks it (its own
          onInteractOutside wins), so the old handler never ran. */}
      <AlertDialogContent
        className="p-0 gap-0 overflow-hidden border-0"
        style={positioningStyle}
      >
        {/* Red gradient banner — glow blur behind the icon tile. */}
        <div
          className="relative flex flex-col items-center pt-10 pb-6"
          style={{
            background:
              "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)",
          }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full blur-[50px] opacity-25"
            style={{ width: 180, height: 80, backgroundColor: "#EF4444" }}
          />
          <div
            className="relative flex items-center justify-center"
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              backgroundColor: "#FEE2E2",
            }}
          >
            <AlertTriangle style={{ width: 32, height: 32, color: "hsl(var(--destructive))" }} />
          </div>
          <span
            className="mt-4 rounded-full"
            style={{
              padding: "4px 12px",
              fontSize: 11,
              fontWeight: 600,
              color: "#991B1B",
              backgroundColor: "#FEF2F2",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontFamily: FONT,
            }}
          >
            Restore version {version}
          </span>
        </div>

        {/* Body */}
        <div className="flex flex-col items-center text-center px-8 pb-8">
          <AlertDialogHeader className="p-0 gap-0 text-center">
            <AlertDialogTitle
              className="tracking-[-0.02em]"
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#0F172A",
                fontFamily: FONT,
              }}
            >
              Restore version {version}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription
            className="mt-2 mx-auto"
            style={{
              fontSize: 13,
              color: "#64748B",
              lineHeight: 1.65,
              maxWidth: 320,
              fontFamily: FONT,
            }}
          >
            Version {version} will become the current version of this purchase order.
            Its existing status is preserved. The next material change starts a
            new version.
          </AlertDialogDescription>

          {/* The version's total in its own currency (base equivalent
              inline: a hover card would sit under this z-14000 layer). */}
          {fx && snapshot && (
            <div
              className="w-full mt-5 rounded-lg border text-left"
              style={{
                borderColor: "#E2E8F0",
                backgroundColor: "#F8FAFC",
                padding: "10px 12px",
                fontFamily: FONT,
              }}
            >
              <div className="flex items-center justify-between" style={{ gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B", lineHeight: 1 }}>
                  Version {version} total
                </span>
                <span className="inline-flex items-baseline tabular-nums" style={{ gap: 6, lineHeight: 1 }}>
                  {!fx.isBase && (
                    <span style={{ fontSize: 11, fontWeight: 400, color: "#94A3B8" }}>
                      ≈ {showBase ? formatCurrency(snapshot.total, fx.currency) : formatCurrency(toBase(snapshot.total, fx.rate), BASE_CURRENCY)}
                    </span>
                  )}
                  <span
                    className="inline-flex items-center"
                    style={{ gap: 5, fontSize: 13, fontWeight: 600, color: "#0F172A" }}
                  >
                    <CurrencyFlag code={showBase ? BASE_CURRENCY : fx.currency} size={11} />
                    {showBase ? formatCurrency(toBase(snapshot.total, fx.rate), BASE_CURRENCY) : formatCurrency(snapshot.total, fx.currency)}
                  </span>
                </span>
              </div>
              {note && (
                <div style={{ fontSize: 11, color: "#64748B", lineHeight: 1.5, marginTop: 6 }}>
                  {note}
                </div>
              )}
            </div>
          )}

          {/* The rate the PO takes: V{version}'s locked one, or today's. */}
          {rateOptions && (
            <div className="w-full mt-5">
              <VersionRateChoiceCards fromVersion={version} options={rateOptions} value={rateChoice} onChange={setRateChoice} />
            </div>
          )}

          {/* Reason input — same "optional" affordance SO uses. */}
          <div className="w-full mt-5 text-left">
            <label
              className="block"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#64748B",
                marginBottom: 6,
                lineHeight: 1,
                fontFamily: FONT,
              }}
            >
              Reason for restoring{" "}
              <span style={{ color: "#94A3B8", fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Vendor wants to go back to the original configuration..."
              rows={3}
              className="w-full"
              style={{
                fontSize: 13,
                fontWeight: 400,
                color: "#0F172A",
                border: "1px solid #E2E8F0",
                borderRadius: 8,
                padding: "10px 12px",
                outline: "none",
                resize: "none",
                fontFamily: FONT,
                lineHeight: 1.5,
                boxSizing: "border-box",
                transition: "border-color 150ms, box-shadow 150ms",
                backgroundColor: "#FFFFFF",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(10,119,255,0.4)";
                e.currentTarget.style.boxShadow = "0 0 0 2px rgba(10,119,255,0.15)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#E2E8F0";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          {/* Stacked buttons — red confirm on top, grey Cancel below. */}
          <div className="w-full mt-7 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => onConfirm(reason.trim(), rateOptions ? rateChoice : "locked")}
              className="w-full transition-all"
              style={{
                height: 44,
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 12,
                border: 0,
                backgroundColor: "hsl(var(--destructive))",
                color: "#FFFFFF",
                cursor: "pointer",
                fontFamily: FONT,
              }}
            >
              Restore
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full transition-colors hover:opacity-90"
              style={{
                height: 44,
                fontSize: 14,
                fontWeight: 500,
                borderRadius: 12,
                border: 0,
                backgroundColor: "#F1F5F9",
                color: "#334155",
                cursor: "pointer",
                fontFamily: FONT,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
