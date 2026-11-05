import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import {
  X,
  Maximize2,
  Minimize2,
  Check,
  Copy,
  User,
  Phone,
  Building2,
  Banknote,
  CreditCard,
  FileText,
  Percent,
  Star,
} from "lucide-react";
import { FONT } from "./designTokens";
import {
  PAYMENT_METHODS,
  type PaymentMethod,
  type PaymentMethodType,
} from "./PaymentMethodDialog";

/* ──────────────────────────────────────────────────────────────────
   SelectPaymentMethodModal — picker that replaces the legacy
   `PaymentMethodDialog`. Visually it stitches together two pieces
   the buyer already knows from the rest of the PO Detail page:

     1. The **modal shell** comes from the Payment Terms modal
        (`BrowsePaymentTermsModal.tsx` — Dialog sizing, Full view ↔
        Exit full toggle, header with title + close, footer with
        Cancel + Confirm).
     2. The **cards** clone Partners' Vendor Payment Methods card
        (`Partners/.../PaymentMethodsSection.tsx:618-804`) — icon
        tile, bank name + type chip, data rows for IBAN / Contact /
        Phone, and an optional discount strip. The action menu /
        edit / delete / set-primary buttons are stripped because
        this surface is a selection picker, not a CRUD tab.
     3. The **selected state** matches `PaymentTermCardV2`
        (`PaymentTermCardV2.tsx:170-182`) — primary-tinted border,
        soft blue glow, and the floating top-right blue Check pill.

   The data source is the existing `PAYMENT_METHODS` array from
   `PaymentMethodDialog.tsx` so `resolvePaymentMethodByName` on the
   sidebar continues to render the saved method card correctly. ── */

interface SelectPaymentMethodModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Currently applied method (bankName or `bankName - type`). */
  currentMethod: string;
  /** Fired with `bankName` so the existing
   *  `resolvePaymentMethodByName` lookup keeps working downstream. */
  onConfirm: (methodName: string) => void;
}

/* ── Type-to-icon mapping. Mirrors Partners' `PAYMENT_TYPE_CARDS`
   icon choices so the card icon matches what users see in the
   partners app. */
const TYPE_ICON: Record<PaymentMethodType, React.ElementType> = {
  "Wire Transfer": Banknote,
  ACH: Building2,
  Check: FileText,
  "Credit Card": CreditCard,
};

/* ── Type chip palette by *Partners category*: Bank methods (Wire /
   ACH) lean blue, Card → purple, Check (traditional) → amber. */
const TYPE_CHIP: Record<PaymentMethodType, { color: string; bg: string }> = {
  "Wire Transfer": { color: "#0A77FF", bg: "#EFF6FF" },
  ACH: { color: "#0A77FF", bg: "#EFF6FF" },
  Check: { color: "#B45309", bg: "#FFFBEB" },
  "Credit Card": { color: "#6D28D9", bg: "#F5F3FF" },
};

/* ──────────────────────────────────────────────────────────────────
   DataRow — same row shape as Partners' `DataRow`
   (`PaymentMethodsSection.tsx:552-573`). Icon on the left, label
   muted, value strong on the right. ──────────────────────────── */
function DataRow({
  icon: Icon,
  label,
  value,
  trailing,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  /** Optional trailing slot (e.g. the IBAN copy button). */
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Icon className="w-3 h-3 text-slate-400 shrink-0" />
      <span
        className="text-[10px] text-slate-500 shrink-0"
        style={{ fontWeight: 500, fontFamily: FONT }}
      >
        {label}
      </span>
      <span
        className="text-[11px] text-foreground truncate flex-1"
        style={{ fontWeight: 500, fontFamily: FONT }}
        title={value}
      >
        {value}
      </span>
      {trailing}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   PaymentMethodCard — port of Partners' visual + the
   PaymentTermCard selected-state pattern. ─────────────────────── */
function PaymentMethodCard({
  method,
  isSelected,
  onSelect,
  copiedId,
  onCopy,
}: {
  method: PaymentMethod;
  isSelected: boolean;
  onSelect: () => void;
  copiedId: string | null;
  onCopy: (iban: string, id: string) => void;
}) {
  const Icon = TYPE_ICON[method.type];
  const chip = TYPE_CHIP[method.type];

  return (
    <div
      onClick={onSelect}
      // Selected-state classes copied byte-for-byte from
      // `PaymentTermCardV2.tsx:172-176`. The hover styles match
      // the default (un-selected) branch.
      className={`bg-white border rounded-xl cursor-pointer group transition-all duration-200 flex flex-col relative ${
        isSelected
          ? "border-primary/25 shadow-[0_2px_12px_rgba(10,119,255,0.10)]"
          : "border-[#E8ECF1] shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-blue-200 hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.10)]"
      }`}
      style={{ fontFamily: FONT }}
    >
      {/* Floating check pill — verbatim from PaymentTermCardV2:178-182. */}
      {isSelected && (
        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center z-10 shadow-sm">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}

      <div className="p-3 flex-1 flex flex-col gap-2">
        {/* Header row — icon tile + name + type chip. */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: chip.bg }}
            >
              <Icon className="w-3.5 h-3.5" style={{ color: chip.color }} />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-xs text-foreground truncate leading-tight"
                style={{ fontWeight: 600 }}
              >
                {method.bankName}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className="text-[9px] px-1.5 py-[1px] rounded-full"
                  style={{
                    fontWeight: 600,
                    color: chip.color,
                    backgroundColor: chip.bg,
                  }}
                >
                  #{method.order} {method.type}
                </span>
              </div>
            </div>
          </div>
          {/* Primary marker — matches the PrimaryPill used elsewhere
              in the app. The picker doesn't allow changing primary,
              so the icon is read-only here. */}
          {method.isDefault && (
            <div
              className="inline-flex items-center gap-1 px-1.5 py-[2px] rounded-full bg-blue-50 border border-blue-100 shrink-0"
              title="Primary method"
            >
              <Star className="w-2.5 h-2.5 text-primary fill-primary" />
              <span
                className="text-[9px] text-primary"
                style={{ fontWeight: 600 }}
              >
                Primary
              </span>
            </div>
          )}
        </div>

        {/* Data rows — IBAN / Contact / Phone. Visually mirrors the
            Partners' rounded-lg, slate-50 inner block. */}
        <div className="flex flex-col gap-[5px] py-1.5 px-2 rounded-lg bg-[#FAFBFC] border border-muted">
          <DataRow
            icon={Building2}
            label="IBAN"
            value={method.iban}
            trailing={
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCopy(method.iban, method.id);
                }}
                className="flex items-center justify-center w-5 h-5 rounded-md text-slate-400 hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                title="Copy IBAN"
              >
                {copiedId === method.id ? (
                  <Check className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            }
          />
          <DataRow icon={User} label="Contact" value={method.contactName} />
          <DataRow icon={Phone} label="Phone" value={method.contactPhone} />
        </div>

        {/* Discount / charges strip — only shown when at least one is
            non-zero. Same pattern as Partners' card. */}
        {(method.discountPct > 0 || method.additionalChargesPct > 0) && (
          <div className="flex items-center justify-between px-2 py-1 rounded-md bg-[#FAFBFC] border border-muted">
            {method.discountPct > 0 && (
              <>
                <div className="flex items-center gap-1">
                  <Percent className="w-2.5 h-2.5 text-primary" />
                  <span
                    className="text-[10px] text-slate-500"
                    style={{ fontWeight: 500 }}
                  >
                    Discount
                  </span>
                </div>
                <span
                  className="text-[10px] text-foreground tabular-nums"
                  style={{ fontWeight: 600 }}
                >
                  {method.discountPct}%
                </span>
              </>
            )}
            {method.discountPct > 0 && method.additionalChargesPct > 0 && (
              <span className="text-[10px] text-slate-300 mx-1">|</span>
            )}
            {method.additionalChargesPct > 0 && (
              <>
                <span
                  className="text-[10px] text-slate-500"
                  style={{ fontWeight: 500 }}
                >
                  Charges
                </span>
                <span
                  className="text-[10px] text-foreground tabular-nums ml-1"
                  style={{ fontWeight: 600 }}
                >
                  {method.additionalChargesPct}%
                </span>
              </>
            )}
          </div>
        )}

        {/* Reference note — short helper at the bottom. Slate-tinted
            so the body of the card stays the focus. */}
        {method.referenceNote && (
          <p
            className="text-[10px] text-slate-500 leading-snug line-clamp-2"
            style={{ fontWeight: 400, fontFamily: FONT }}
          >
            {method.referenceNote}
          </p>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Modal (orchestrator) ────────────────────────────────────────── */
export default function SelectPaymentMethodModal({
  open,
  onOpenChange,
  currentMethod,
  onConfirm,
}: SelectPaymentMethodModalProps) {
  /* Resolve the currently-applied method (used purely for the
     blue-tick highlight on the matching card). No staging state —
     per buyer feedback (2026-06), this picker behaves like the
     Payment Terms modal: clicking a card immediately applies the
     pick and closes the modal, so there's no in-flight "selected
     but not yet confirmed" state to track. */
  const currentMethodId =
    PAYMENT_METHODS.find(
      (m) =>
        m.bankName === currentMethod ||
        `${m.bankName} - ${m.type}` === currentMethod,
    )?.id ?? null;

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const handleCopy = async (iban: string, methodId: string) => {
    try {
      await navigator.clipboard.writeText(iban.replace(/\s/g, ""));
      setCopiedId(methodId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* clipboard not available */
    }
  };

  /** Click-to-apply: pick the method, hand it to the parent, and
   *  close the modal in one motion (no Confirm button, no footer).
   *  Mirrors `BrowsePaymentTermsModal.handleApply`. */
  const handlePickAndClose = (method: PaymentMethod) => {
    onConfirm(method.bankName);
    onOpenChange(false);
    setIsFullScreen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setIsFullScreen(false);
      }}
    >
      <DialogContent
        // `[&>button.absolute]:hidden` — hide shadcn's baked-in
        // close button so only our custom header X is shown
        // (matches BrowsePaymentTermsModal / SelectPOCsModal).
        className="z-[210] flex flex-col gap-0 overflow-hidden border-0 p-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.18)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] [&>button.absolute]:hidden"
        // Sizing class follows BrowsePaymentTermsModal exactly so the
        // morph between Full view and normal is identical.
        style={
          isFullScreen
            ? {
                maxWidth: "calc(100% - 1rem)",
                width: "calc(100% - 1rem)",
                height: "calc(100dvh - 1rem)",
                maxHeight: "calc(100dvh - 1rem)",
                borderRadius: 16,
              }
            : {
                maxWidth: "min(75vw, 1080px)",
                width: "calc(100% - 2rem)",
                height: "min(80vh, 720px)",
                maxHeight: "min(80vh, 720px)",
                minHeight: 520,
                borderRadius: 16,
              }
        }
      >
        <DialogTitle className="sr-only">Select Payment Method</DialogTitle>
        <DialogDescription className="sr-only">
          Pick a saved payment method from the vendor's directory.
        </DialogDescription>

        {/* Header — Payment Terms shell. */}
        <div className="flex items-center justify-between border-b border-[#EEF2F6] bg-card px-6 h-12 shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <h3
                className="text-[13px] text-foreground"
                style={{ fontWeight: 600, fontFamily: FONT }}
              >
                Payment Method
              </h3>
              <p
                className="text-[11px] text-muted-foreground"
                style={{ fontWeight: 400, fontFamily: FONT }}
              >
                Choose how this purchase order will be paid
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullScreen((v) => !v)}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              {isFullScreen ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
              {isFullScreen ? "Exit full" : "Full view"}
            </button>
            <button
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-foreground hover:bg-muted transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Card Grid — responsive via container queries (matches the
            Payment Terms grid). */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          <div className="@container/pmgrid">
            <div className="grid grid-cols-1 @[400px]/pmgrid:grid-cols-2 @[850px]/pmgrid:grid-cols-3 auto-rows-fr gap-4">
              {PAYMENT_METHODS.map((method) => (
                <PaymentMethodCard
                  key={method.id}
                  method={method}
                  /* Highlight the card matching the currently-applied
                     method so users see at a glance which one is in
                     effect. Click on ANY card (selected or not) picks
                     it and closes the modal — same as the Apply CTA
                     on the Payment Terms card. */
                  isSelected={method.id === currentMethodId}
                  onSelect={() => handlePickAndClose(method)}
                  copiedId={copiedId}
                  onCopy={handleCopy}
                />
              ))}
            </div>
          </div>
        </div>

        {/* No footer — clicking any card applies the pick and closes
            the modal in one motion (matches the Payment Terms modal).
            The header X is the only escape hatch for "cancel". */}
      </DialogContent>
    </Dialog>
  );
}
