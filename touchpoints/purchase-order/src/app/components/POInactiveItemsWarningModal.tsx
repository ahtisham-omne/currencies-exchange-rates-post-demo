import { CircleSlash } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "./ui/alert-dialog";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { FONT } from "./designTokens";
import type { POLineItem } from "./poStore";

/**
 * Non-blocking warning shown when a Draft PO that contains inactive line
 * items is moved toward an active state (Send to Vendor / Mark as
 * Confirmed). Inactive never cancels an existing PO — the buyer can
 * always proceed; this only makes sure they do it knowingly.
 *
 * Visual recipe: Partners `GroupStatusChangeDialog` amber tone (the same
 * one Partners uses for "Mark as Inactive") — gradient wash + glow behind
 * a 64px icon tile, uppercase status chip, centered title/description,
 * stacked full-width buttons. Mirrors `POVersionRevertModal` structure.
 */

export type InactiveWarningMode = "send" | "confirm";

interface POInactiveItemsWarningModalProps {
  open: boolean;
  mode: InactiveWarningMode;
  lines: POLineItem[];
  onClose: () => void;
  onConfirm: () => void;
}

/* Partners amber tone (`GroupStatusChangeDialog.amberTone`). */
const TONE = {
  wash: "#FFFBEB",
  washSoft: "rgba(255,251,235,0.3)",
  glow: "#F59E0B",
  iconBg: "#FEF3C7",
  iconColor: "#B45309",
  chipBg: "#FFFBEB",
  chipFg: "#92400E",
  primaryBg: "#F59E0B",
} as const;

/* Same inline re-centering the revert modal uses (tailwind-merge can drop
   shadcn's layout classes when overridden). */
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
};

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function POInactiveItemsWarningModal({
  open,
  mode,
  lines,
  onClose,
  onConfirm,
}: POInactiveItemsWarningModalProps) {
  const n = lines.length;
  const single = n === 1;
  const verb = mode === "send" ? "Send" : "Confirm";

  const title = `${verb} with ${single ? "an inactive item" : `${n} inactive items`}?`;
  const desc = single
    ? `${lines[0]?.itemNumber ?? "This item"} is no longer active. You can still continue with this PO.`
    : `These items are no longer active. You can still continue with this PO.`;

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <AlertDialogContent
        className="p-0 gap-0 overflow-hidden border-0"
        style={positioningStyle}
      >
        {/* Amber gradient banner — glow blur behind the icon tile. */}
        <div
          className="relative flex flex-col items-center pt-10 pb-6"
          style={{ background: `linear-gradient(180deg, ${TONE.wash} 0%, ${TONE.washSoft} 70%, transparent 100%)` }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full blur-[50px] opacity-25"
            style={{ width: 180, height: 80, backgroundColor: TONE.glow }}
          />
          <div
            className="relative flex items-center justify-center"
            style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: TONE.iconBg }}
          >
            <CircleSlash style={{ width: 32, height: 32, color: TONE.iconColor }} />
          </div>
          <span
            className="mt-4 rounded-full"
            style={{
              padding: "4px 12px",
              fontSize: 11,
              fontWeight: 600,
              color: TONE.chipFg,
              backgroundColor: TONE.chipBg,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontFamily: FONT,
            }}
          >
            {single ? "Inactive item" : `${n} inactive items`}
          </span>
        </div>

        {/* Body */}
        <div className="flex flex-col items-center text-center px-8 pb-8 overflow-y-auto">
          <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
            <AlertDialogTitle
              className="tracking-[-0.02em]"
              style={{ fontSize: 18, fontWeight: 600, color: "#0F172A", fontFamily: FONT }}
            >
              {title}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription
            className="mt-2 mx-auto"
            style={{ fontSize: 13, color: "#64748B", lineHeight: 1.65, maxWidth: 340, fontFamily: FONT }}
          >
            {desc}
          </AlertDialogDescription>

          {/* Affected lines */}
          <div
            className="w-full mt-5 flex flex-col text-left overflow-hidden"
            style={{ border: "1px solid #E2E8F0", borderRadius: 12, maxHeight: 200, overflowY: "auto" }}
          >
            {lines.map((li, idx) => (
              <div
                key={li.id}
                className="flex items-center gap-3 px-3 py-2.5"
                style={{ borderTop: idx === 0 ? "none" : "1px solid #F1F5F9", backgroundColor: "#FFFFFF" }}
              >
                <div
                  className="shrink-0 overflow-hidden"
                  style={{ width: 40, height: 40, borderRadius: 8, border: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}
                >
                  <ImageWithFallback src={li.image} alt={li.descriptiveName} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0 flex-1" style={{ fontFamily: FONT }}>
                  <div className="truncate" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", lineHeight: "18px" }}>
                    {li.itemNumber}
                  </div>
                  <div className="truncate" style={{ fontSize: 12, color: "#64748B", lineHeight: "16px" }}>
                    {li.descriptiveName}
                  </div>
                  {li.inactive && (
                    <div className="truncate" style={{ fontSize: 11, color: "#94A3B8", lineHeight: "16px", marginTop: 2 }} title={`Marked inactive by ${li.inactive.by} (${li.inactive.role})`}>
                      Inactive since {formatDate(li.inactive.at)} · by {li.inactive.by}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Stacked buttons — amber proceed on top, grey stay-in-draft below. */}
          <div className="w-full mt-7 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onConfirm}
              className="w-full transition-opacity hover:opacity-90"
              style={{
                height: 44,
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 12,
                border: 0,
                backgroundColor: TONE.primaryBg,
                color: "#FFFFFF",
                cursor: "pointer",
                fontFamily: FONT,
              }}
            >
              {mode === "send" ? "Send to Vendor anyway" : "Mark as Confirmed anyway"}
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
              Keep as Draft
            </button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
