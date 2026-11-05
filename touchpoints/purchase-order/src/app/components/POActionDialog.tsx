import React from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { FONT } from "./designTokens";

/* ── POActionDialog ──
   Glow-header confirmation window with a form body — same chrome as
   PODiscardDialog / POVersionSaveModal / PriceWarningShell (tinted
   gradient header, 64px icon tile, uppercase chip, centred 18px title,
   full-width stacked buttons on a white surface). Used by Cancel PO,
   Cancel remaining, Cancel line, Archive PO and Reactivate PO.

   Unlike PriceWarningShell the primary button does NOT auto-close:
   `onPrimary` validates first (buttons are never disabled — Eli's rule)
   and closes the window itself. */

const TONES = {
  red: {
    wash: "#FEF2F2",
    washSoft: "rgba(254,242,242,0.3)",
    glow: "#EF4444",
    iconBg: "#FEE2E2",
    iconColor: "hsl(var(--destructive))",
    chipBg: "#FEF2F2",
    chipFg: "#991B1B",
    primaryBg: "hsl(var(--destructive))",
  },
  blue: {
    wash: "#EFF6FF",
    washSoft: "rgba(239,246,255,0.3)",
    glow: "#3B82F6",
    iconBg: "#DBEAFE",
    iconColor: "hsl(var(--primary))",
    chipBg: "#EFF6FF",
    chipFg: "#1E40AF",
    primaryBg: "hsl(var(--primary))",
  },
} as const;

export interface POActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tone?: keyof typeof TONES;
  icon: React.ElementType;
  chipLabel: string;
  title: React.ReactNode;
  description: React.ReactNode;
  /** Form fields, rendered left-aligned between the copy and the buttons. */
  children?: React.ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel: string;
}

export function POActionDialog({
  open,
  onOpenChange,
  tone = "red",
  icon: Icon,
  chipLabel,
  title,
  description,
  children,
  primaryLabel,
  onPrimary,
  secondaryLabel,
}: POActionDialogProps) {
  const palette = TONES[tone];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] [&>button.absolute]:hidden"
        style={{ fontFamily: FONT, backgroundColor: "#FFFFFF" }}
      >
        <div
          className="relative flex flex-col items-center pt-10 pb-6"
          style={{ background: `linear-gradient(180deg, ${palette.wash} 0%, ${palette.washSoft} 70%, transparent 100%)` }}
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
            style={{ fontWeight: 600, backgroundColor: palette.chipBg, color: palette.chipFg, textTransform: "uppercase", letterSpacing: "0.05em" }}
          >
            {chipLabel}
          </span>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-white/50 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="flex flex-col px-8 pb-8">
          <div className="text-center">
            <DialogTitle
              className="text-[18px] tracking-[-0.02em]"
              style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}
            >
              {title}
            </DialogTitle>
            <DialogDescription
              className="text-[13px] mt-2 max-w-[340px] mx-auto"
              style={{ color: "hsl(var(--muted-foreground))", lineHeight: 1.65 }}
            >
              {description}
            </DialogDescription>
          </div>
          {children && <div className="mt-6 text-left">{children}</div>}
          <div className="w-full mt-7 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onPrimary}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
              style={{ fontWeight: 600, backgroundColor: palette.primaryBg, color: "#fff" }}
            >
              {primaryLabel}
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:bg-slate-100"
              style={{ fontWeight: 500, backgroundColor: "hsl(var(--muted))", color: "#334155" }}
            >
              {secondaryLabel}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
