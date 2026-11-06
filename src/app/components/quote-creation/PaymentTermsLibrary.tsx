import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { PaymentTermsPickerModal } from "@/app/components/external/partners/PaymentTermsPickerModal";
import {
  PAYMENT_TERM_PRESETS,
  type PaymentTermPreset as PartnerPaymentTermPreset,
} from "@/app/components/external/partners/partnerConstants";

/* ════════════════════════════════════════════════════════════════════
   Payment terms picker for this module.

   Header and body are Partner Management's shared PaymentTermsPickerModal
   (search, NET / Pre / Split type toggle, Template / Custom / Created by
   Me / In Use pills, sort, card grid). Cards use vendor invoicing's
   radio-card selection: clicking a card selects it, and View Details sits
   on the card's hover icon. The footer is this module's
   own: "Save as default for <customer>" plus Cancel / Confirm Selection,
   built from Partners' footer checkbox and buttons (PocModals).

   Unlike Partners, selecting a card (or Apply in its detail view) only
   selects the term; the picker stays open so the user can also choose to save it
   as the customer's default, then confirms from the footer.
   ════════════════════════════════════════════════════════════════════ */

/** The term shape callers receive. Partner presets count partners as
 *  `vendorsApplied`; this module calls them customers. */
export interface PaymentTermPreset {
  id: string;
  name: string;
  category: "net" | "prepayment" | "split";
  typeBadge: string;
  badgeColor: string;
  trigger: string;
  description: string;
  customersApplied: number;
  duration?: string;
  applyDiscount?: boolean;
  discountPercent?: string;
  discountMode?: "percent" | "fixed";
  discountPeriod?: string;
}

// Backward compatibility export for existing imports.
export type PaymentTerm = PaymentTermPreset;

interface PaymentTermsLibraryProps {
  isOpen?: boolean;
  onClose: () => void;
  onSelect: (term: PaymentTermPreset, saveAsDefault: boolean) => void;
  /** Applied term, by Partner preset id or by name. */
  currentTermId?: string;
  /** Names the customer in the "Save as default" option. Without one
   *  (e.g. the import flow) the option is hidden. */
  customerName?: string;
}

/* Ids this module stored before it used the Partner presets. Only the
   creation default still reaches the picker; map it by name. */
const LEGACY_TERM_NAMES: Record<string, string> = { net30: "Net 30" };

function resolveTermId(current?: string): string | null {
  if (!current) return null;
  if (PAYMENT_TERM_PRESETS.some((p) => p.id === current)) return current;
  const name = LEGACY_TERM_NAMES[current] ?? current;
  return PAYMENT_TERM_PRESETS.find((p) => p.name === name)?.id ?? null;
}

function toModuleTerm(t: PartnerPaymentTermPreset): PaymentTermPreset {
  const { vendorsApplied, ...rest } = t;
  return { ...rest, category: t.category as PaymentTermPreset["category"], customersApplied: vendorsApplied };
}

export function PaymentTermsLibrary({
  isOpen, onClose, onSelect, currentTermId, customerName,
}: PaymentTermsLibraryProps) {
  const open = !!isOpen;
  /* The applied term, preselected on open. The picker opens on its tab
     (NET / Pre / Split) with its card in view. */
  const appliedId = useMemo(() => resolveTermId(currentTermId), [currentTermId]);
  /* This session's pick. Cleared on close, so a pick that was cancelled
     never shows on the next open. */
  const [pickedId, setPickedId] = useState<string | null>(null);
  const selectedId = pickedId ?? appliedId;
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (open) return;
    setPickedId(null);
    setSaveAsDefault(false);
    setShowError(false);
  }, [open]);

  const selected = PAYMENT_TERM_PRESETS.find((p) => p.id === selectedId) ?? null;

  /* Never disabled (suite validation pattern): with nothing selected,
     Confirm explains what is missing instead. */
  const handleConfirm = () => {
    if (!selected) { setShowError(true); return; }
    onSelect(toModuleTerm(selected), saveAsDefault);
    onClose();
  };

  const footer = (
    <div className={`shrink-0 border-t border-border bg-white px-5 py-3 flex items-center ${customerName ? "justify-between" : "justify-end"} gap-3 sm:rounded-b-2xl`}>
      {customerName && (
        <button
          type="button"
          onClick={() => setSaveAsDefault((v) => !v)}
          className="flex items-center gap-2 cursor-pointer select-none group/check min-w-0"
          aria-pressed={saveAsDefault}
        >
          <div className={`w-[18px] h-[18px] shrink-0 rounded-[5px] border-[1.5px] flex items-center justify-center transition-all duration-150 ${saveAsDefault ? "bg-primary border-primary" : "border-slate-300 bg-white group-hover/check:border-slate-400"}`}>
            {saveAsDefault && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
          </div>
          <span className="text-[13px] text-muted-foreground group-hover/check:text-slate-700 transition-colors truncate" style={{ fontWeight: 500 }}>
            Save as default for {customerName}
          </span>
        </button>
      )}
      <div className="flex items-center gap-2.5 shrink-0">
        {showError && !selected && (
          <span role="alert" className="text-red-500 text-xs">Select a payment term to continue.</span>
        )}
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-border bg-white text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          style={{ fontWeight: 500 }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="px-5 py-2 rounded-lg text-[13px] text-white transition-all shadow-sm cursor-pointer inline-flex items-center gap-1.5 bg-primary hover:bg-[#0960D9]"
          style={{ fontWeight: 600 }}
        >
          Confirm Selection
        </button>
      </div>
    </div>
  );

  return (
    <PaymentTermsPickerModal
      open={open}
      onClose={onClose}
      selectedTermId={selectedId}
      onApply={(t) => { setPickedId(t.id); setShowError(false); }}
      keepOpenOnApply
      footer={footer}
      subtitle={customerName ? `Browse templates and apply payment terms for ${customerName}` : undefined}
    />
  );
}
