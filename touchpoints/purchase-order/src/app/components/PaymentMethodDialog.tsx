import React, { useState, useEffect } from "react";
import {
  Check,
  Copy,
  Phone,
  User,
  Info,
  Wallet,
} from "lucide-react";

import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";

import { FONT } from "./designTokens";

/* ═══════════════════════════════════════════════════════════════
   TYPOGRAPHY — CSS-variable bound, Inter only
   Same pattern as VendorSelectionDialog: medium weight max,
   no bold, all sizes via CSS variables.
   ═══════════════════════════════════════════════════════════════ */

const st = {
  dialogTitle: {
    fontSize: "var(--text-base)",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.4",
    fontFamily: FONT,
  } as React.CSSProperties,
  dialogDesc: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,
  bankName: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,
  typeBadge: {
    fontSize: "10px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.3",
    fontFamily: FONT,
    letterSpacing: "0.02em",
  } as React.CSSProperties,
  fieldLabel: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,
  fieldValue: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.4",
    fontFamily: FONT,
  } as React.CSSProperties,
  contactText: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,
  noteText: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.45",
    fontFamily: FONT,
  } as React.CSSProperties,
  feeLabel: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,
  feeValue: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,
  btnLabel: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,
  countBadge: {
    fontSize: "10px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.3",
    fontFamily: FONT,
  } as React.CSSProperties,
};

/* ═══════════════════════════════════════════════════════════════
   PAYMENT METHOD DATA MODEL
   ═══════════════════════════════════════════════════════════════ */

export type PaymentMethodType = "Wire Transfer" | "ACH" | "Check" | "Credit Card";

export interface PaymentMethod {
  id: string;
  bankName: string;
  type: PaymentMethodType;
  order: number;
  iban: string;
  contactName: string;
  contactPhone: string;
  referenceNote: string;
  discountPct: number;
  additionalChargesPct: number;
  isDefault?: boolean;
}

/* ── Type badge color mapping — neutral base, typed accents ── */
const METHOD_TYPE_COLORS: Record<PaymentMethodType, { bg: string; text: string }> = {
  "Wire Transfer": { bg: "var(--avatar-1-bg)", text: "hsl(var(--primary))" },
  ACH: { bg: "var(--avatar-2-bg)", text: "hsl(var(--accent))" },
  Check: { bg: "var(--avatar-3-bg)", text: "var(--avatar-3-text)" },
  "Credit Card": { bg: "var(--avatar-4-bg)", text: "var(--avatar-4-text)" },
};

/* ── Mock payment methods — realistic ERP data ──
   Exported (2026-06) so the new `SelectPaymentMethodModal` picker
   can share the same data source and `resolvePaymentMethodByName`
   stays consistent across the legacy + new modal surfaces. */
export const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: "pm-1",
    bankName: "Bank of America",
    type: "Wire Transfer",
    order: 1,
    iban: "DE89 3704 0044 0532 0130 00",
    contactName: "Ahtisham Ahmad",
    contactPhone: "+1 555-123-4567",
    referenceNote: "Please mention the order number in the transfer reference.",
    discountPct: 5,
    additionalChargesPct: 0,
    isDefault: true,
  },
  {
    id: "pm-2",
    bankName: "ABC Bank",
    type: "Wire Transfer",
    order: 2,
    iban: "DE89 3704 0044 0532 0130 00",
    contactName: "Areeb Tanvir",
    contactPhone: "+1 555-123-4567",
    referenceNote: "Please mention the order number in the transfer reference.",
    discountPct: 5,
    additionalChargesPct: 0,
  },
  {
    id: "pm-3",
    bankName: "Chase Business",
    type: "ACH",
    order: 3,
    iban: "US64 0210 0001 7890 1234 56",
    contactName: "Sarah Mitchell",
    contactPhone: "+1 555-987-6543",
    referenceNote: "Include PO number in the ACH memo field.",
    discountPct: 3,
    additionalChargesPct: 0,
  },
  {
    id: "pm-4",
    bankName: "Wells Fargo",
    type: "Check",
    order: 4,
    iban: "US72 0420 0007 6543 2109 88",
    contactName: "David Chen",
    contactPhone: "+1 555-456-7890",
    referenceNote: "Mail checks to the billing address on file.",
    discountPct: 0,
    additionalChargesPct: 2,
  },
];

/* ═══════════════════════════════════════════════════════════════
   PAYMENT METHOD CARD — Individual selectable card
   Matches VendorSelectionDialog card language:
   • Neutral base, subtle primary tint on selection
   • Round radio-style indicator instead of heavy checkbox
   • Spacious layout with clear information grouping
   ═══════════════════════════════════════════════════════════════ */

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
  const typeColor = METHOD_TYPE_COLORS[method.type];

  return (
    <div
      className={`rounded-[var(--radius-md)] border transition-all cursor-pointer ${
        isSelected
          ? "border-primary/25 bg-card shadow-[var(--elevation-card)]"
          : "border-border/60 bg-card hover:border-border"
      }`}
      style={{ fontFamily: FONT }}
      onClick={onSelect}
    >
      {/* ── Header: radio indicator + bank name + type badge ── */}
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        {/* Radio-style selection — matches VendorSelectionDialog LocationCard */}
        <div
          className={`flex items-center justify-center size-4 rounded-full shrink-0 border transition-colors ${
            isSelected
              ? "border-primary bg-primary"
              : "border-foreground/15 bg-transparent"
          }`}
        >
          {isSelected && <Check className="size-2.5 text-primary-foreground" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`truncate ${isSelected ? "text-foreground" : "text-foreground/80"}`} style={st.bankName}>
              {method.bankName}
            </span>
            <span
              className="inline-flex items-center px-1.5 py-px rounded-[var(--radius-sm)] shrink-0"
              style={{
                backgroundColor: typeColor.bg,
                color: typeColor.text,
                ...st.typeBadge,
              }}
            >
              #{method.order} {method.type}
            </span>
          </div>
        </div>
      </div>

      {/* ── IBAN row ── */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground shrink-0" style={st.fieldLabel}>IBAN</span>
          <span className="text-foreground/60 shrink-0" style={st.fieldLabel}>&middot;</span>
          <span className="text-foreground truncate" style={st.fieldValue}>
            {method.iban}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCopy(method.iban, method.id);
            }}
            className="flex items-center justify-center size-5 rounded-[var(--radius-sm)] text-muted-foreground/40 hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer shrink-0"
            title="Copy IBAN"
          >
            {copiedId === method.id ? (
              <Check className="size-3 text-accent" />
            ) : (
              <Copy className="size-3" />
            )}
          </button>
        </div>
      </div>

      {/* ── Contact row ── */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <User className="size-3 text-muted-foreground/40 shrink-0" />
            <span className="text-muted-foreground" style={st.contactText}>
              {method.contactName}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Phone className="size-3 text-muted-foreground/40 shrink-0" />
            <span className="text-muted-foreground" style={st.contactText}>
              {method.contactPhone}
            </span>
          </div>
        </div>
      </div>

      <div className="pb-1" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAYMENT METHOD DIALOG — Main exported dialog

   Design follows VendorSelectionDialog principles:
   • Header: primary-tinted icon + title + description (no X button)
   • Clean neutral base with balanced accents on selected state
   • Medium weight typography max (no bold)
   • Footer: Cancel + Confirm only (no redundant close)
   • Fixed height for visual consistency
   ═══════════════════════════════════════════════════════════════ */

interface PaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMethod: string;
  onConfirm: (methodName: string) => void;
}

export default function PaymentMethodDialog({
  open,
  onOpenChange,
  currentMethod,
  onConfirm,
}: PaymentMethodDialogProps) {
  /* ── Resolve initially selected method ── */
  const resolveInitial = () => {
    const match = PAYMENT_METHODS.find(
      (m) => m.bankName === currentMethod || `${m.bankName} - ${m.type}` === currentMethod
    );
    return match?.id || PAYMENT_METHODS.find((m) => m.isDefault)?.id || PAYMENT_METHODS[0]?.id || "";
  };

  const [selectedId, setSelectedId] = useState(resolveInitial);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) setSelectedId(resolveInitial());
  }, [open, currentMethod]);

  const handleCopy = async (iban: string, methodId: string) => {
    try {
      await navigator.clipboard.writeText(iban.replace(/\s/g, ""));
      setCopiedId(methodId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* clipboard not available */
    }
  };

  const handleConfirm = () => {
    const method = PAYMENT_METHODS.find((m) => m.id === selectedId);
    if (method) {
      onConfirm(method.bankName);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[740px] p-0 gap-0 overflow-hidden flex flex-col"
        style={{ fontFamily: FONT, height: "min(90vh, 680px)" }}
      >
        {/* ── Header — matches VendorSelectionDialog: tinted icon + title + desc ── */}
        <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-border shrink-0">
          <div className="flex items-center justify-center size-8 rounded-[var(--radius-md)] bg-primary-tint shrink-0">
            <Wallet className="size-3.5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle style={st.dialogTitle} className="text-foreground">
              Select payment method
            </DialogTitle>
            <DialogDescription style={st.dialogDesc} className="text-muted-foreground mt-0.5">
              Choose your preferred payment method from the available options
            </DialogDescription>
          </div>
          {/* Method count badge */}
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary text-muted-foreground shrink-0"
            style={st.countBadge}
          >
            {PAYMENT_METHODS.length} methods
          </span>
        </div>

        {/* ── Card Grid — scrollable content area ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: "thin" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PAYMENT_METHODS.map((method) => (
              <PaymentMethodCard
                key={method.id}
                method={method}
                isSelected={method.id === selectedId}
                onSelect={() => setSelectedId(method.id)}
                copiedId={copiedId}
                onCopy={handleCopy}
              />
            ))}
          </div>
        </div>

        {/* ── Footer — clean, just Cancel + Confirm ── */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 cursor-pointer"
            style={st.btnLabel}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5 px-4 cursor-pointer"
            style={st.btnLabel}
            onClick={handleConfirm}
            disabled={!selectedId}
          >
            <Check className="size-3.5" />
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HELPER — resolve method display info by name
   ═══════════════════════════════════════════════════════════════ */

export function resolvePaymentMethodByName(name: string): PaymentMethod | undefined {
  return PAYMENT_METHODS.find(
    (m) => m.bankName === name || `${m.bankName} - ${m.type}` === name
  );
}