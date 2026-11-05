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
  onConfirm: (reason: string) => void;
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
}: POVersionRevertModalProps) {
  const [reason, setReason] = useState("");

  return (
    <AlertDialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <AlertDialogContent
        className="p-0 gap-0 overflow-hidden border-0"
        style={positioningStyle}
        onInteractOutside={() => onClose()}
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
            Revert to V{version}
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
              Revert to V{version}?
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
            V{version} will become the current version of this purchase order.
            Its existing status is preserved. The next material change starts a
            new version.
          </AlertDialogDescription>

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
              Reason for revert{" "}
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
              onClick={() => onConfirm(reason.trim())}
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
              Revert to V{version}
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
