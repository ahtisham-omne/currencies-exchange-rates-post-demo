import React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Lock } from "lucide-react";

/**
 * FieldUpgradeConfirmModal — confirmation for one-way (upgrade-only) field changes
 * (Control Type → Serialized, Lot Tracking → on). States what's changing and that
 * it can't be reversed. Visual language matches ItemLifecycleModal for consistency.
 *
 * Note: Categories does not ship this modal — it's net-new per the designer handoff.
 */
interface Props {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const amber = {
  wash: "#FFFBEB",
  washSoft: "rgba(255,251,235,0.3)",
  glow: "#F59E0B",
  iconBg: "#FEF3C7",
  iconColor: "#B45309",
  chipBg: "#FFFBEB",
  chipFg: "#92400E",
  primaryBg: "#F59E0B",
};

export function FieldUpgradeConfirmModal({ open, title, body, confirmLabel, onConfirm, onCancel }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialogContent
        className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] bg-white"
        style={{ zIndex: 240 }}
      >
        <div
          className="relative flex flex-col items-center pt-10 pb-6"
          style={{ background: `linear-gradient(180deg, ${amber.wash} 0%, ${amber.washSoft} 70%, transparent 100%)` }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25"
            style={{ backgroundColor: amber.glow }}
          />
          <div
            className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: amber.iconBg }}
          >
            <Lock className="w-7 h-7" style={{ color: amber.iconColor }} />
          </div>
          <span
            className="mt-4 px-3 py-1 rounded-full text-[11px]"
            style={{ fontWeight: 600, backgroundColor: amber.chipBg, color: amber.chipFg, textTransform: "uppercase", letterSpacing: "0.05em" }}
          >
            Permanent change
          </span>
        </div>
        <div className="flex flex-col items-center text-center px-8 pb-8">
          <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
            <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>
              {title}
            </AlertDialogTitle>
          </AlertDialogHeader>

          <AlertDialogDescription
            className="text-[13px] mt-4 max-w-[360px] mx-auto"
            style={{ color: "hsl(var(--muted-foreground))", lineHeight: "1.65" }}
          >
            {body}
          </AlertDialogDescription>

          <div className="w-full mt-7 flex flex-col gap-2.5">
            <button
              onClick={onConfirm}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
              style={{ fontWeight: 600, backgroundColor: amber.primaryBg, color: "#fff" }}
            >
              {confirmLabel}
            </button>
            <button
              onClick={onCancel}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
              style={{ fontWeight: 500, backgroundColor: "hsl(var(--muted))", color: "#334155" }}
            >
              Cancel
            </button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
