import React from "react";
import { X, Package, PlusCircle, ArrowRight, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { FONT } from "./designTokens";

/* ══════════════════════════════════════════════════════════════════
   NewRequestTypeModal — the first step of "New Request" on the
   Purchase Requests listing. A picker for which of the two request
   starts the buyer wants:

     A · Existing item — the item is already in the catalogue. Opens
         PurchaseRequestModal with its default multi-select catalogue
         picker (initialFocus = "catalog").
     B · New item     — the item isn't on file yet. Opens
         PurchaseRequestModal with the new-item form already
         expanded (initialFocus = "new-item").

   Visual language mirrors Purchase-Order's Partners / cash-management
   picker recipe (SelectPaymentMethodModal shell). Shell: shadcn
   Dialog with a slim header (title + subtitle + X), card grid, and a
   footer strip. Cards: identity-tinted icon tile, hover border in
   the identity color, slate-800 pill CTA per card. One-click
   selection (no confirm) — parity with the Payment Terms picker.
   ══════════════════════════════════════════════════════════════════ */

export type NewRequestKind = "catalog" | "new-item";

interface NewRequestTypeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (kind: NewRequestKind) => void;
}

type OptionTone = {
  fg: string;
  bg: string;
  hover: string;
  glow: string;
  badgeBorder: string;
};

const TONE_EXISTING: OptionTone = {
  fg: "#0A77FF",
  bg: "#EFF6FF",
  hover: "#93C5FD",
  glow: "rgba(10,119,255,0.12)",
  badgeBorder: "#DBEAFE",
};

const TONE_NEW: OptionTone = {
  fg: "#7C3AED",
  bg: "#F5F3FF",
  hover: "#C4B5FD",
  glow: "rgba(124,58,237,0.14)",
  badgeBorder: "#EDE9FE",
};

function OptionCard({
  icon: Icon,
  title,
  description,
  badge,
  cta,
  tone,
  onSelect,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  badge: string;
  cta: string;
  tone: OptionTone;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative flex h-full flex-col rounded-xl border border-[#E8ECF1] bg-white p-5 text-left transition-all duration-200 hover:-translate-y-[1px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      style={{ fontFamily: FONT }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = tone.hover;
        e.currentTarget.style.boxShadow = `0 6px 20px -6px ${tone.glow}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#E8ECF1";
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.03)";
      }}
    >
      <div
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ backgroundColor: tone.bg }}
      >
        <Icon className="h-5 w-5" style={{ color: tone.fg }} />
      </div>

      <div className="mb-5 flex-1 space-y-1.5">
        <h3
          className="leading-tight text-foreground"
          style={{
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "-0.005em",
          }}
        >
          {title}
        </h3>
        <p
          className="text-slate-600 leading-snug"
          style={{ fontSize: 12, fontWeight: 400 }}
        >
          {description}
        </p>
        <div className="pt-1.5">
          <span
            className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5"
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: tone.fg,
              backgroundColor: tone.bg,
              borderColor: tone.badgeBorder,
            }}
          >
            <Check className="h-2.5 w-2.5" />
            {badge}
          </span>
        </div>
      </div>

      <div
        className="mt-auto flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-slate-800 text-white shadow-sm transition-all group-hover:bg-[#0f172a] group-active:scale-[0.98]"
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        {cta}
        <ArrowRight className="h-3 w-3" />
      </div>
    </button>
  );
}

export default function NewRequestTypeModal({
  open,
  onOpenChange,
  onSelect,
}: NewRequestTypeModalProps) {
  const pick = (kind: NewRequestKind) => {
    onSelect(kind);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[210] flex flex-col gap-0 overflow-hidden border-0 p-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.18)] [&>button.absolute]:hidden"
        style={{
          maxWidth: "min(92vw, 720px)",
          width: "calc(100% - 2rem)",
          borderRadius: 16,
          fontFamily: FONT,
        }}
      >
        <DialogTitle className="sr-only">New Purchase Request</DialogTitle>
        <DialogDescription className="sr-only">
          Choose how to start: an item already in the catalog, or a new item
          not in the catalog yet.
        </DialogDescription>

        <div className="flex items-start justify-between border-b border-[#EEF2F6] bg-card px-6 py-4">
          <div className="min-w-0">
            <h2
              className="text-foreground tracking-tight"
              style={{
                fontSize: 17,
                fontWeight: 700,
                letterSpacing: "-0.01em",
              }}
            >
              New Purchase Request
            </h2>
            <p
              className="mt-1 text-muted-foreground"
              style={{ fontSize: 12, fontWeight: 400 }}
            >
              Choose how to start: an item already in the catalog, or a new
              item not in the catalog yet.
            </p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
          <OptionCard
            icon={Package}
            title="Existing item"
            description="The item is already in the catalog. Pick one or more items and raise a request against them."
            badge="Linked to catalog"
            cta="Continue"
            tone={TONE_EXISTING}
            onSelect={() => pick("catalog")}
          />
          <OptionCard
            icon={PlusCircle}
            title="New item"
            description="Raise a request for something not in the catalog yet. Describe the item and it will be routed for review."
            badge="No catalog match needed"
            cta="Continue"
            tone={TONE_NEW}
            onSelect={() => pick("new-item")}
          />
        </div>

        <div className="flex items-center justify-between border-t border-[#EEF2F6] bg-[#FAFBFC] px-6 py-3">
          <p
            className="text-slate-400"
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Omne ERP
          </p>
          <button
            className="flex items-center gap-1 text-primary transition-colors hover:text-blue-700"
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            <span>Help Center</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
