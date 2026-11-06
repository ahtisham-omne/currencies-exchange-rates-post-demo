import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Search, Plus, Star } from "lucide-react";
import { PaymentMethodCard, getEntrySummary, typeLabel, typeCategory } from "@/app/components/external/partners/PaymentMethodCard";
import { FilterPills, type FilterPillOption } from "@/app/components/external/partners/FilterPills";
import { createEmptyPaymentEntry } from "@/app/components/external/partners/config-helpers";
import { PAYMENT_TYPE_CARDS, type PaymentMethodEntry, type PaymentMethodType } from "@/app/components/external/partners/partnerConstants";

/* ════════════════════════════════════════════════════════════════════
   Payment method picker for this module.

   Cards and the primary concept are Partner Management's: the ported
   PaymentMethodCard (icon tile, type chip, data rows, discount strip),
   a Star that sets the customer's primary method behind Partners'
   "Change Primary" confirmation, and the Primary pill on the primary
   card. Category pills are Partners' FilterPills over Partners' payment
   type categories, in Partners' 1 / 2 / 3 column card grid.

   Host additions: cards select like the payment terms picker (radio,
   primary border and tint), and the footer is the same Cancel /
   Confirm Selection pair. The picker has no edit flow, so cards show
   no pencil. Partners has no payment method picker of its own; the
   frame (header, search, footer) matches PaymentTermsLibrary.
   ════════════════════════════════════════════════════════════════════ */

interface PaymentMethod {
  id: string;
  /** The card title (Partners' nickname, else bank / holder / payee). */
  name: string;
  /** Payment type label, e.g. "ACH / Direct Deposit". */
  subtitle: string;
  category: string;
  Icon: React.ElementType;
  isPrimary: boolean;
  /** The full Partners entry behind the card. */
  entry: PaymentMethodEntry;
}

interface PaymentMethodSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** `isPrimary` is true when the confirmed method is the customer's
   *  primary payment method (set with the card's Star). */
  onSelect: (method: PaymentMethod, isPrimary: boolean) => void;
  currentMethodId?: string;
  customerName: string;
}

/* ─── Mock saved methods (per-customer instances, Partners shape) ──── */

function entry(id: string, type: PaymentMethodType, fields: Partial<PaymentMethodEntry>): PaymentMethodEntry {
  return { ...createEmptyPaymentEntry(type), id, expanded: false, isSaved: true, countryCode: "+1", ...fields };
}

const SAVED_METHODS: PaymentMethodEntry[] = [
  entry("pm-ach-1", "ach", {
    isPrimary: true, nickname: "Main operating account", bankName: "JPMorgan Chase", accountTitle: "Operating Acct",
    accountNumber: "4756", routingNumber: "021000021", accountType: "checking",
    applyDiscount: true, discountPercent: "0.5", discountMode: "percent",
  }),
  entry("pm-wire-1", "wire", {
    nickname: "Wire Transfer", bankName: "Citibank", accountTitle: "International AR",
    accountNumber: "6450", routingNumber: "021000089", swiftCode: "CITIUS33",
  }),
  entry("pm-check-1", "check", {
    nickname: "Check / Paper", payeeName: "Ford Motor Company", mailingAddress: "PO Box 4200, Houston TX",
  }),
  entry("pm-card-1", "card", {
    nickname: "Corporate Visa", cardholderName: "Sarah Chen", cardNumber: "2233", expiryDate: "08/27",
  }),
  entry("pm-wallet-1", "digital_wallet", {
    nickname: "PayPal Business", walletProvider: "PayPal", walletId: "ap@customer-billing.com",
  }),
  entry("pm-cash-1", "cash", {
    nickname: "Cash on delivery", recipientName: "Driver / agent", collectionPoint: "Customer site", phone: "(213) 223-4232",
    specialInstructions: "Counter-signed receipt required",
    applyDiscount: true, additionalCharges: "2", additionalChargesMode: "percent",
  }),
];

/* The customer's primary method, per customer, for this session. A
   prototype store: Partners owns the real record. */
const primaryByCustomer = new Map<string, string>();

function toMethod(e: PaymentMethodEntry): PaymentMethod {
  return {
    id: e.id,
    name: getEntrySummary(e),
    subtitle: typeLabel(e.type),
    category: typeCategory(e.type),
    Icon: PAYMENT_TYPE_CARDS.find((t) => t.id === e.type)?.icon ?? Star,
    isPrimary: e.isPrimary,
    entry: e,
  };
}

export type { PaymentMethod };

const CATEGORY_ORDER = ["Bank", "Card", "Digital", "Traditional", "Other"];

export function PaymentMethodSelectionModal({
  isOpen, onClose, onSelect, currentMethodId, customerName,
}: PaymentMethodSelectionModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [primaryChangeId, setPrimaryChangeId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [showError, setShowError] = useState(false);

  const defaultPrimary = SAVED_METHODS.find((m) => m.isPrimary)?.id ?? null;

  useEffect(() => {
    if (!isOpen) return;
    const primary = primaryByCustomer.get(customerName) ?? defaultPrimary;
    setPrimaryId(primary);
    setSelectedId(currentMethodId && SAVED_METHODS.some((m) => m.id === currentMethodId) ? currentMethodId : primary);
    setPrimaryChangeId(null);
    setSearch("");
    setCategory("all");
    setShowError(false);
  }, [isOpen, currentMethodId, customerName, defaultPrimary]);

  /* Escape closes the primary confirmation first, then the picker.
     Capture phase, and the key stops here, so page-level shortcuts
     underneath never see it. */
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      if (primaryChangeId) setPrimaryChangeId(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isOpen, primaryChangeId, onClose]);

  const entries = useMemo(
    () => SAVED_METHODS.map((m) => ({ ...m, isPrimary: m.id === primaryId })),
    [primaryId],
  );

  const pillOptions: FilterPillOption[] = useMemo(() => [
    { key: "all", label: "All", count: entries.length },
    ...CATEGORY_ORDER
      .map((c) => ({ key: c, label: c, count: entries.filter((e) => typeCategory(e.type) === c).length }))
      .filter((o) => o.count > 0),
  ], [entries]);

  const filtered = useMemo(() => entries.filter((e) => {
    if (category !== "all" && typeCategory(e.type) !== category) return false;
    const q = search.trim().toLowerCase();
    if (q && !getEntrySummary(e).toLowerCase().includes(q) && !typeLabel(e.type).toLowerCase().includes(q)) return false;
    return true;
  }), [entries, category, search]);

  const selected = entries.find((e) => e.id === selectedId) ?? null;
  const primaryCurrent = entries.find((e) => e.isPrimary) ?? null;
  const primaryChangeEntry = entries.find((e) => e.id === primaryChangeId) ?? null;

  /* Partners' handleSetPrimary: with no primary yet it applies at once,
     otherwise it asks first. */
  const handleSetPrimary = (id: string) => {
    if (!primaryCurrent || primaryCurrent.id === id) { applyPrimary(id); return; }
    setPrimaryChangeId(id);
  };
  const applyPrimary = (id: string) => {
    setPrimaryId(id);
    primaryByCustomer.set(customerName, id);
    setPrimaryChangeId(null);
  };

  /* Never disabled (suite validation pattern): with nothing selected,
     Confirm explains what is missing instead. */
  const handleConfirm = () => {
    if (!selected) { setShowError(true); return; }
    onSelect(toMethod(selected), selected.isPrimary);
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: 12100, backgroundColor: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(2px)" }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Payment Methods"
        data-state="open"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl shadow-2xl flex flex-col overflow-hidden bg-white"
        style={{ zIndex: 12101, width: "min(96vw, 1080px)", height: "min(92vh, 780px)", fontFamily: "Inter, system-ui, sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border">
          <div className="min-w-0">
            <h2 className="text-[17px] text-foreground leading-tight" style={{ fontWeight: 700 }}>Payment Methods</h2>
            <p className="text-[12px] text-muted-foreground mt-1">
              Select how {customerName || "the customer"} pays. Use the star to set their primary method.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Partners' customer-tinted Add CTA. */}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] transition-colors cursor-pointer bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46] hover:bg-[#D1FAE5]"
              style={{ fontWeight: 600 }}
            >
              <Plus className="w-3.5 h-3.5" /> Add Payment Method
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-muted hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>

        {/* Search + count, then category pills */}
        <div className="px-6 pt-3 pb-3 border-b border-border flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="relative w-[320px] max-w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search payment methods..."
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#D0D7E1] bg-white text-[13px] text-foreground placeholder:text-slate-400 outline-none shadow-[0_1px_2px_rgba(0,0,0,0.05)] focus:border-primary focus:shadow-[0_0_0_3px_rgba(10,119,255,0.08)]"
              />
            </div>
            <p className="text-xs text-muted-foreground ml-auto">
              <span style={{ fontWeight: 600 }}>{filtered.length}</span> payment method{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
          <FilterPills options={pillOptions} activeKey={category} onSelect={setCategory} />
        </div>

        {/* Card grid (Partners' 1 / 2 / 3 column container grid) */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 bg-[#FAFBFC]">
          {filtered.length === 0 ? (
            <p className="text-center text-[13px] text-muted-foreground py-12">No payment methods match the current filters.</p>
          ) : (
            <div className="@container/pmgrid w-full">
              <div role="radiogroup" aria-label="Payment methods" className="grid grid-cols-1 @[400px]/pmgrid:grid-cols-2 @[750px]/pmgrid:grid-cols-3 gap-3">
                {filtered.map((e) => (
                  <PaymentMethodCard
                    key={e.id}
                    entry={e}
                    selectable
                    isSelected={selectedId === e.id}
                    onView={() => { setSelectedId(e.id); setShowError(false); }}
                    onSetPrimary={() => handleSetPrimary(e.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer (same pair as the payment terms picker) */}
        <div className="shrink-0 border-t border-border bg-white px-5 py-3 flex items-center justify-end gap-2.5">
          {showError && !selected && (
            <span role="alert" className="text-red-500 text-xs">Select a payment method to continue.</span>
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

      {/* Primary-change confirmation: Partners' lifecycle modal (blue
          gradient header, filled Star, CHANGE PRIMARY pill, stacked
          Make Primary / Keep current primary). Rendered in this portal
          so it stacks above the picker. */}
      {primaryChangeEntry && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 12200, backgroundColor: "rgba(15, 23, 42, 0.45)" }} onClick={() => setPrimaryChangeId(null)}>
          <div
            role="alertdialog"
            aria-modal="true"
            data-state="open"
            aria-labelledby="pm-primary-title"
            className="w-[min(92vw,400px)] overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #EBF3FF 0%, rgba(239,246,255,0.3) 70%, transparent 100%)" }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#0A77FF" }} />
              <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#CFE6FF" }}>
                <Star className="w-8 h-8 fill-[#094D9F]" style={{ color: "#094D9F" }} />
              </div>
              <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#EBF3FF", color: "#0548A3", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Change Primary Customer Payment Method
              </span>
            </div>
            <div className="flex flex-col items-center text-center px-8 pb-8">
              <h3 id="pm-primary-title" className="text-[18px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600 }}>
                Make {getEntrySummary(primaryChangeEntry)} the primary payment method?
              </h3>
              <p className="text-[13px] mt-2 max-w-[340px] mx-auto text-muted-foreground" style={{ lineHeight: 1.65 }}>
                {primaryCurrent && primaryCurrent.id !== primaryChangeEntry.id ? (
                  <>New customer transactions will default to <span className="text-foreground" style={{ fontWeight: 600 }}>{getEntrySummary(primaryChangeEntry)}</span> instead of <span className="text-foreground" style={{ fontWeight: 600 }}>{getEntrySummary(primaryCurrent)}</span>. Existing records are unaffected. You can switch back any time.</>
                ) : (
                  <>New customer transactions will default to <span className="text-foreground" style={{ fontWeight: 600 }}>{getEntrySummary(primaryChangeEntry)}</span>. You can switch back any time.</>
                )}
              </p>
              <div className="w-full mt-7 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => applyPrimary(primaryChangeEntry.id)}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90 bg-primary text-white"
                  style={{ fontWeight: 600 }}
                >
                  Make Primary
                </button>
                <button
                  type="button"
                  onClick={() => setPrimaryChangeId(null)}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors bg-muted"
                  style={{ fontWeight: 500, color: "#334155" }}
                >
                  Keep current primary
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
