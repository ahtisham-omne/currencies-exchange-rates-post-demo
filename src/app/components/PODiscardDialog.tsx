/* ═══════════════════════════════════════════════════════════════
   PODiscardDialog — canonical red-glow lifecycle modal for the
   unsaved-changes prompt on a Purchase Order detail view.

   Mirrors the partner module's discard prompt (Carrier Configuration
   section in `Partners/src/app/pages/VendorDetailsPage.tsx`) 1:1 so
   the discard interaction looks identical across the system:
     - centered AlertTriangle inside a soft red square
     - "Discard …" pill above the headline
     - "Discard unsaved changes?" headline
     - destructive primary action + "Continue editing" secondary

   The caller owns dirty tracking + the actual discard side effect.
   ═══════════════════════════════════════════════════════════════ */

"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

export interface PODiscardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Label shown on the small pill above the headline.
   *  Mirrors the partner pattern's "DISCARD CARRIER CONFIGURATION". */
  pillLabel?: string;
  /** Body copy under "Discard unsaved changes?". */
  description?: string;
  /** Fires when the user picks the destructive primary action. */
  onConfirmDiscard: () => void;
}

export function PODiscardDialog({
  open,
  onOpenChange,
  pillLabel = "Discard Purchase Order Edits",
  description = "Edits across every section will revert. This action cannot be undone.",
  onConfirmDiscard,
}: PODiscardDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
        style={{ zIndex: 290 }}
        onInteractOutside={() => onOpenChange(false)}
      >
        {/* Red glow + icon — same construction as partner module */}
        <div
          className="relative flex flex-col items-center pt-10 pb-6"
          style={{
            background:
              "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)",
          }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25"
            style={{ backgroundColor: "#EF4444" }}
          />
          <div
            className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: "#FEE2E2" }}
          >
            <AlertTriangle
              className="w-8 h-8"
              style={{ color: "hsl(var(--destructive))" }}
            />
          </div>
          <span
            className="mt-4 px-3 py-1 rounded-full text-[11px]"
            style={{
              fontWeight: 600,
              backgroundColor: "#FEF2F2",
              color: "#991B1B",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {pillLabel}
          </span>
        </div>

        {/* Headline + body + CTAs */}
        <div className="flex flex-col items-center text-center px-8 pb-8">
          <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
            <AlertDialogTitle
              className="text-[18px] tracking-[-0.02em]"
              style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}
            >
              Discard unsaved changes?
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription
            className="text-[13px] mt-2 max-w-[300px] mx-auto"
            style={{ color: "hsl(var(--muted-foreground))", lineHeight: 1.65 }}
          >
            {description}
          </AlertDialogDescription>
          <div className="w-full mt-7 flex flex-col gap-2.5">
            <button
              onClick={onConfirmDiscard}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
              style={{
                fontWeight: 600,
                backgroundColor: "hsl(var(--destructive))",
                color: "#fff",
              }}
            >
              Discard changes
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
              style={{
                fontWeight: 500,
                backgroundColor: "hsl(var(--muted))",
                color: "#334155",
              }}
            >
              Continue editing
            </button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
