import React, { useState, useRef, useEffect } from "react";
import { Check, CreditCard, Pencil, Star, Eye, EyeOff, Building2, Hash, Phone, MapPin, FileText, Wallet, User, AlertCircle } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "../../ui/tooltip";
import { PrimaryPill } from "./PrimaryPill";
import { type PaymentMethodType, type PaymentMethodEntry, PAYMENT_TYPE_CARDS } from "./partnerConstants";

/* ════════════════════════════════════════════════════════════════════
   Partner Management's PaymentMethodCard, ported from the current
   Partners PaymentMethodsSection (card, DataRow, data rows, masking,
   discount / charges strip). The copy in ./PaymentMethodsSection is an
   older export with a different card; this one is the source of truth
   for payment method cards in this module.

   Host addition (`selectable`): the picker's radio-card selection, the
   same treatment as PaymentTermCard's `selectable`. The whole card
   selects, a radio sits at the header's right, and the selected card
   takes the primary border and #F5F9FF fill. The Star / Primary pill
   stay exactly as Partners has them. Edit (pencil) is shown only when
   the host passes `onEdit`, since the picker has no edit flow.
   Tooltips sit above the host's portalled modal (z 12101).
   ════════════════════════════════════════════════════════════════════ */

const catColor: Record<string, string> = {
  Bank: "var(--primary)",
  Traditional: "var(--violet)",
  Card: "var(--warning)",
  Digital: "var(--success)",
  Other: "#64748B",
};
const catBg: Record<string, string> = {
  Bank: "var(--accent)",
  Traditional: "#F0EBFF",
  Card: "#FEF3C7",
  Digital: "#ECFDF5",
  Other: "var(--muted)",
};

const TOOLTIP_Z = "z-[12300]";

export function typeLabel(type: PaymentMethodType) {
  return PAYMENT_TYPE_CARDS.find((t) => t.id === type)?.label || type;
}
function typeIcon(type: PaymentMethodType) {
  return PAYMENT_TYPE_CARDS.find((t) => t.id === type)?.icon || CreditCard;
}
export function typeCategory(type: PaymentMethodType): string {
  return PAYMENT_TYPE_CARDS.find((t) => t.id === type)?.category || "Other";
}

export function getEntrySummary(e: PaymentMethodEntry): string {
  if (e.nickname) return e.nickname;
  if (e.bankName) return e.bankName;
  if (e.cardholderName) return e.cardholderName;
  if (e.walletProvider) return e.walletProvider;
  if (e.payeeName) return e.payeeName;
  if (e.recipientName) return e.recipientName;
  if (e.methodName) return e.methodName;
  return typeLabel(e.type);
}

// ── Mask sensitive value: •••• 1234 ──
function maskValue(value: string): string {
  const clean = value.replace(/\s/g, "");
  if (clean.length <= 4) return clean;
  return `•••• ${clean.slice(-4)}`;
}

// ── "Store last-N only" display: always •••• 1234, never revealable ──
// Card Number and Account Number retain only the last 4 (classification rule #1),
// so they are shown truncated with no reveal toggle; the full number is never held.
function lastFourDisplay(value: string): string {
  const clean = (value || "").replace(/\s/g, "");
  return clean ? `•••• ${clean.slice(-4)}` : "";
}

// ── Inline Data Row ──
function DataRow({ icon: Icon, label, value, sensitive = false }: { icon: React.ElementType; label: string; value?: string; sensitive?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  // Values get at most 50% of the card row; anything longer truncates on
  // the right and surfaces the full text in a hover tooltip (same approach
  // as the description tooltips elsewhere in the system). Overflow is
  // measured on the rendered span so short values never grow a tooltip.
  const valueRef = useRef<HTMLSpanElement>(null);
  const [overflowed, setOverflowed] = useState(false);
  const displayed = value ? (sensitive && !revealed ? maskValue(value) : value) : "";
  useEffect(() => {
    const el = valueRef.current;
    if (el) setOverflowed(el.scrollWidth > el.clientWidth + 1);
  }, [displayed]);
  if (!value) return null;
  const valueSpan = (
    <span
      ref={valueRef}
      className="text-[10px] text-foreground truncate text-right max-w-[50%] ml-auto"
      style={{ fontWeight: 500, letterSpacing: sensitive ? "0.5px" : undefined }}
    >
      {displayed}
    </span>
  );
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
      <span className="text-[10px] text-muted-foreground shrink-0" style={{ fontWeight: 500 }}>{label}</span>
      {overflowed ? (
        <Tooltip>
          <TooltipTrigger asChild>{valueSpan}</TooltipTrigger>
          <TooltipContent side="top" sideOffset={6} className={`max-w-[280px] ${TOOLTIP_Z}`}>
            <p className="text-xs break-words">{displayed}</p>
          </TooltipContent>
        </Tooltip>
      ) : valueSpan}
      {sensitive && (
        <button
          onClick={(ev) => { ev.stopPropagation(); setRevealed(!revealed); }}
          className="p-0.5 rounded hover:bg-accent transition-colors cursor-pointer shrink-0"
          title={revealed ? "Hide" : "Reveal"}
        >
          {revealed ? <EyeOff className="w-2.5 h-2.5 text-muted-foreground" /> : <Eye className="w-2.5 h-2.5 text-muted-foreground" />}
        </button>
      )}
    </div>
  );
}

// ── Get all displayable fields for an entry ──
function getEntryDataRows(e: PaymentMethodEntry): { icon: React.ElementType; label: string; value?: string; sensitive?: boolean }[] {
  const rows: { icon: React.ElementType; label: string; value?: string; sensitive?: boolean }[] = [];

  // Common: nickname shown as title, so skip
  if (e.type === "ach" || e.type === "wire") {
    rows.push({ icon: Building2, label: "Bank", value: e.bankName });
    rows.push({ icon: User, label: "Account", value: e.accountTitle });
    rows.push({ icon: Hash, label: "Acct #", value: lastFourDisplay(e.accountNumber) });
    // Routing numbers are public bank identifiers, not sensitive — shown
    // plain with no mask/eye toggle.
    rows.push({ icon: Hash, label: "Routing", value: e.routingNumber });
    if (e.type === "ach" && e.accountType) rows.push({ icon: FileText, label: "Type", value: { checking: "Checking", savings: "Savings", money_market: "Money Market", cd: "Certificate of Deposit", loan: "Loan" }[e.accountType] || e.accountType });
    if (e.type === "wire" && e.swiftCode) rows.push({ icon: Hash, label: "SWIFT", value: e.swiftCode, sensitive: true });
  }
  if (e.type === "card") {
    rows.push({ icon: User, label: "Holder", value: e.cardholderName });
    rows.push({ icon: CreditCard, label: "Card #", value: lastFourDisplay(e.cardNumber) });
    rows.push({ icon: FileText, label: "Expiry", value: e.expiryDate });
    if (e.billingAddress) rows.push({ icon: MapPin, label: "Billing", value: e.billingAddress });
  }
  if (e.type === "digital_wallet") {
    rows.push({ icon: Wallet, label: "Provider", value: e.walletProvider });
    rows.push({ icon: Hash, label: "Wallet ID", value: e.walletId, sensitive: true });
  }
  if (e.type === "check") {
    rows.push({ icon: User, label: "Payee", value: e.payeeName });
    rows.push({ icon: MapPin, label: "Address", value: e.mailingAddress });
  }
  if (e.type === "cash") {
    rows.push({ icon: User, label: "Recipient", value: e.recipientName });
    rows.push({ icon: MapPin, label: "Location", value: e.collectionPoint });
  }
  if (e.type === "other") {
    rows.push({ icon: FileText, label: "Method", value: e.methodName });
    if (e.description) rows.push({ icon: FileText, label: "Desc", value: e.description });
  }
  // Common fields
  if (e.phone) rows.push({ icon: Phone, label: "Phone", value: `${e.countryCode} ${e.phone}` });
  if (e.type !== "other" && e.specialInstructions) rows.push({ icon: AlertCircle, label: "Notes", value: e.specialInstructions });

  return rows;
}

export function PaymentMethodCard({
  entry: pe,
  onView,
  onEdit,
  onSetPrimary,
  selectable = false,
  isSelected = false,
}: {
  entry: PaymentMethodEntry;
  /** Whole-card click. Partners opens the read-only view; in
   *  `selectable` mode the host selects the card. */
  onView: () => void;
  /** Top-right Edit (pencil). Hidden when omitted. */
  onEdit?: () => void;
  onSetPrimary: () => void;
  /** Host addition: radio-card selection (see header). */
  selectable?: boolean;
  isSelected?: boolean;
}) {
  const PeIcon = typeIcon(pe.type);
  const cat = typeCategory(pe.type);
  const color = catColor[cat] || "#64748B";
  const bg = catBg[cat] || "var(--muted)";
  const dataRows = getEntryDataRows(pe);

  return (
    <div
      onClick={onView}
      role={selectable ? "radio" : undefined}
      aria-checked={selectable ? isSelected : undefined}
      tabIndex={selectable ? 0 : undefined}
      onKeyDown={selectable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onView(); } } : undefined}
      className={`rounded-xl group transition-all duration-200 flex flex-col relative cursor-pointer ${
        selectable && isSelected
          ? "bg-[#F5F9FF] border-[1.5px] border-primary shadow-[0_2px_12px_rgba(10,119,255,0.10)]"
          : pe.isPrimary
            ? "bg-white border-[1.5px] border-primary/40 shadow-[0_2px_12px_-4px_rgba(10,119,255,0.12)] hover:shadow-[0_4px_20px_-4px_rgba(10,119,255,0.18)]"
            : "bg-white border border-border hover:border-slate-300 hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)]"
      }`}
    >
      <div className="p-3 flex-1 flex flex-col gap-2">
        {/* Header: icon + name + actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: bg }}>
              <PeIcon className="w-3.5 h-3.5" style={{ color }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-foreground truncate leading-tight" style={{ fontWeight: 600 }}>{getEntrySummary(pe)}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] px-1.5 py-[1px] rounded-full" style={{ fontWeight: 600, color, backgroundColor: bg }}>
                  {typeLabel(pe.type)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            {pe.isPrimary ? (
              <PrimaryPill />
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onSetPrimary}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-slate-300 hover:text-primary hover:bg-blue-50 transition-colors cursor-pointer"
                    aria-label="Set as primary"
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className={TOOLTIP_Z}><p className="text-xs">Set as primary</p></TooltipContent>
              </Tooltip>
            )}
            {onEdit && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-primary hover:bg-blue-50 transition-colors cursor-pointer"
                    aria-label="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className={TOOLTIP_Z}><p className="text-xs">Edit</p></TooltipContent>
              </Tooltip>
            )}
            {selectable && (
              <span
                aria-hidden
                onClick={onView}
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  isSelected ? "bg-primary" : "border-2 border-slate-300 bg-white group-hover:border-slate-400"
                }`}
              >
                {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
              </span>
            )}
          </div>
        </div>

        {/* Data rows */}
        {dataRows.length > 0 && (
          <div className="flex flex-col gap-[5px] py-1.5 px-2 rounded-lg bg-[#FAFBFC] border border-muted">
            {dataRows.map((row, i) => (
              <DataRow key={i} icon={row.icon} label={row.label} value={row.value} sensitive={row.sensitive} />
            ))}
          </div>
        )}

        {/* Discount/charges strip — only shown when the user actually
            entered a value in at least one field ("0" counts as entered;
            checkbox-only with both fields blank renders nothing). When
            shown, BOTH cells render so the pair always reads together;
            the untouched field shows a hyphen (Partners uses an em dash;
            this module's copy rule does not). */}
        {(() => {
          const hasDiscountVal = (pe.discountPercent ?? "").trim() !== "";
          const hasChargesVal = (pe.additionalCharges ?? "").trim() !== "";
          if (!pe.applyDiscount || (!hasDiscountVal && !hasChargesVal)) return null;
          return (
            <div className="flex items-center justify-between px-2 py-1 rounded-md bg-[#FAFBFC] border border-muted">
              <span className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>Discount</span>
              <span className="text-[10px] text-foreground" style={{ fontWeight: 600 }}>
                {hasDiscountVal
                  ? `${(pe.discountMode ?? "percent") === "fixed" ? "$" : ""}${pe.discountPercent}${(pe.discountMode ?? "percent") === "percent" ? "%" : ""}`
                  : "-"}
              </span>
              <span className="text-[10px] text-slate-300 mx-1">|</span>
              <span className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>Charges</span>
              <span className="text-[10px] text-foreground ml-1" style={{ fontWeight: 600 }}>
                {hasChargesVal
                  ? `${(pe.additionalChargesMode ?? "percent") === "fixed" ? "$" : ""}${pe.additionalCharges}${(pe.additionalChargesMode ?? "percent") === "percent" ? "%" : ""}`
                  : "-"}
              </span>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
