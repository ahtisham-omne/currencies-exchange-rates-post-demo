import React, { useState, useEffect } from "react";
import {
  Send, X, Mail, Check, CheckCheck, Settings2, Loader2, FileText,
  Download, EyeOff, Printer,
} from "lucide-react";
import { Switch } from "@/app/components/ui/switch";
import { useModalShortcuts, KbdHint } from "./ModalKeyboard";
import { useDiscardGuard } from "./ui/DiscardChangesDialog";
import { Button } from "./ui/Button";
import type { SalesOrder } from "./types";
import {
  DOC_C, getLineShipment, shipStatusColors,
  getLineComments,
  statusBadgeColors, getPaymentInfo, getHeaderMeta, getParties, getItemPhoto, docPaymentTerms, docPaymentMethod, docPaymentTermsSentence,
} from "./soDocumentData";
import { StateTransitionOverlay } from "@/app/components/shared/StateTransitionOverlay";
import {
  PdfDocument, DEFAULT_SO_TERMS, getPdfPageCount,
  type PdfDocumentData, type PdfLineItem, type PdfAdjustment, type PdfVisibility,
  type PdfLinePricingRule, type PdfLineAdjustment,
} from "@/app/components/shared/pdfDocument";
import { PrintPageCount } from "@/app/components/shared/printPages";
import { getSOPrintAttachments } from "./AttachmentsTab";
import { getExternalLinksList } from "@/app/data/linksRepository";
import { FIELD_RULES } from "@/app/components/shared/fieldRequirements";

/* ── Styling tokens ── */
const caption: React.CSSProperties = { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" };
const captionSemi: React.CSSProperties = { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" };
const micro: React.CSSProperties = { fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", letterSpacing: "0.04em", textTransform: "uppercase" as const };

/* ── Visibility options ── */
interface VisibilityOption { key: string; label: string; description: string; icon: string; enabled: boolean; }

const DEFAULT_OPTIONS: VisibilityOption[] = [
  { key: "header", label: "Company Logo & Header", description: "Show your company branding at the top.", icon: "🏢", enabled: true },
  { key: "pricing", label: "Pricing Rules", description: "Calculation details and adjustments.", icon: "💰", enabled: true },
  { key: "adjustments", label: "Adjustments", description: "Item-level and order-level adjustments.", icon: "⚙️", enabled: true },
  { key: "attachments", label: "Attachments", description: "Include uploaded files or link references.", icon: "📎", enabled: true },
  { key: "charges", label: "Payment Charges", description: "Fees based on payment method.", icon: "💳", enabled: false },
  { key: "notes", label: "Notes", description: "Internal notes visible to customer.", icon: "📝", enabled: true },
  { key: "terms", label: "Terms & Conditions", description: "Standard terms and payment policies.", icon: "📃", enabled: true },
];

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!enabled)} className="relative shrink-0 rounded-full transition-colors"
      style={{ width: 40, height: 22, backgroundColor: enabled ? "var(--primary)" : "var(--border)" }}>
      <div className="absolute top-[2px] rounded-full bg-card transition-transform"
        style={{ width: 18, height: 18, transform: enabled ? "translateX(20px)" : "translateX(2px)", boxShadow: "var(--elevation-1)" }} />
    </button>
  );
}

/* ── Mock pricing ── */
function getLinePricingRules(itemCode: string) {
  const rules: { label: string; type: "discount" | "premium"; percent: number }[] = [];
  if (itemCode.includes("001") || itemCode.includes("002")) rules.push({ label: "Fleet Volume Discount", type: "discount", percent: 8 });
  if (itemCode.includes("049") || itemCode.includes("059")) rules.push({ label: "Govt. Contract Premium", type: "premium", percent: 3 });
  if (itemCode.includes("026")) rules.push({ label: "Bulk Lighting Discount", type: "discount", percent: 5 });
  return rules;
}
function getLineAdjustment(itemCode: string): { label: string; amount: number } | null {
  if (itemCode.includes("001")) return { label: "Chassis prep labor credit", amount: -350 };
  if (itemCode.includes("059")) return { label: "Extended warranty add-on", amount: 450 };
  return null;
}
function getLineNote(itemCode: string): string | null {
  if (itemCode.includes("001")) return "Chassis VIN to be confirmed prior to delivery. Customer requires DOT inspection cert.";
  if (itemCode.includes("059")) return "Must include CPR platform and IV mount per spec sheet rev. C.";
  return null;
}
const ORDER_ADJUSTMENTS = [
  { label: "Early payment incentive (2/10 Net 30)", amount: -1250 },
  { label: "Freight surcharge — oversized load", amount: 780 },
];
const ORDER_PRICING_RULES = [
  { label: "Annual Volume Rebate Tier 2", type: "discount" as const, percent: 2 },
];

/* Shipping helpers matching PrintSalesOrder */
function getItemShipMethod(itemCode: string): string {
  if (itemCode.includes("EV-") || itemCode.includes("TR-")) return "Freight Carrier";
  return "FedEx Express";
}
function getItemShipByDate(itemCode: string): string {
  if (itemCode.includes("EV-") || itemCode.includes("TR-")) return "Mar 1, 2025";
  return "Jan 15, 2025";
}

/* ── Recipient data ── */
interface Contact { name: string; email: string; title: string; primary: boolean; }
const MOCK_CONTACTS: Contact[] = [
  { name: "Sarah Moore", email: "sarah.moore@example.com", title: "Procurement Manager", primary: true },
  { name: "Tom Mitchell", email: "tom.m@example.com", title: "Fleet Manager", primary: false },
  { name: "Ben Parker", email: "ben.parker@example.com", title: "Procurement Officer", primary: false },
  { name: "Lisa Huang", email: "lisa.h@example.com", title: "Finance Director", primary: false },
];

const AVATAR_COLORS = [
  { bg: "rgba(10,119,255,0.12)", fg: "#1D4ED8" },
  { bg: "rgba(239,162,47,0.14)", fg: "#B45309" },
  { bg: "rgba(39,185,115,0.12)", fg: "#059650" },
  { bg: "rgba(87,78,250,0.14)", fg: "#4338E6" },
];
function getAvatarColor(name: string) { let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h); return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]; }
function getInitials(name: string) { return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2); }

/* ── Props ── */
export type SendModalMode = "send" | "print";

interface SendToCustomerModalProps {
  isOpen: boolean;
  so: SalesOrder;
  isResend?: boolean;
  mode?: SendModalMode;
  onClose: () => void;
  onSend: () => void;
  /** True when the send is coming from Sales View on a Draft SO, i.e. the
   *  send also submits the SO for review. Drives the "Send & Submit for
   *  Review" title / subtitle / CTA. Default true preserves the pre-existing
   *  behaviour; Approver View passes false so the copy reads as a plain send. */
  advancesToPendingReview?: boolean;
}

/* ── Currency formatter ── */
function fmtCurrency(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ═══════════════════════════════════════════════
   Main Modal — multi-page PDF preview with page navigation
   ═══════════════════════════════════════════════ */
export function SendToCustomerModal({ isOpen, so, isResend, mode = "send", onClose, onSend, advancesToPendingReview = true }: SendToCustomerModalProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  /* Which action triggered the active overlay — drives the heading
     and meta line so the user sees the right narrative for the path
     they chose (email send vs. mark as sent from external share). */
  const [actionMode, setActionMode] = useState<"send" | "mark">("send");
  /* Visibility Options is hidden for now per product. The state + side panel
     + per-field config object are intentionally preserved so we can re-enable
     the flow later by flipping VISIBILITY_OPTIONS_ENABLED to true. */
  const VISIBILITY_OPTIONS_ENABLED = false;
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  /* Recipients come from the order's points of contact. An empty
     list (customer with no contact on file) offers nobody and says so
     in the footer; only records that predate `pocs` use the demo list. */
  const contacts: Contact[] = so.pocs === undefined
    ? MOCK_CONTACTS
    : so.pocs.map(p => ({
        name: p.name,
        email: p.email || "",
        title: p.title || "",
        primary: p.id === so.primaryPocId || (!so.primaryPocId && !!p.isPrimary),
      }));
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set(contacts.filter(c => c.primary).map(c => c.email)));
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = 2;
  /* Include-attachments toggle — when true, the send/download would
     bundle the SO's attachments alongside the PDF (zip). No backend
     work is wired up yet; this is UI only so ops can preview the
     affordance and design language. */
  const [includeAttachments, setIncludeAttachments] = useState(false);

  const isPrint = mode === "print";

  useEffect(() => {
    if (isOpen) { setSending(false); setSent(false); setActionMode("send"); setShowOptions(false); setOptions(DEFAULT_OPTIONS); setCurrentPage(1); setIncludeAttachments(false); }
  }, [isOpen]);

  const toggleOption = (key: string) => setOptions(prev => prev.map(o => o.key === key ? { ...o, enabled: !o.enabled } : o));
  const toggleContact = (email: string) => setSelectedContacts(prev => { const n = new Set(prev); if (n.has(email)) n.delete(email); else n.add(email); return n; });

  const isDirty = options.some((o, i) => o.enabled !== DEFAULT_OPTIONS[i].enabled);
  const { guardedClose, discardDialog } = useDiscardGuard(isDirty, onClose);
  useModalShortcuts({ onConfirm: handleAction, onClose: guardedClose, confirmDisabled: !isOpen || (isPrint ? false : selectedContacts.size === 0) });

  if (!isOpen) return null;

  const activeLines = so.lines.filter(l => !l.cancelled);
  const cancelledLines = so.lines.filter(l => l.cancelled);
  const subtotal = activeLines.reduce((s, l) => s + l.orderedQty * l.unitPrice, 0);

  const showHeader = options.find(o => o.key === "header")?.enabled;
  const showPricing = options.find(o => o.key === "pricing")?.enabled;
  const showAdjustments = options.find(o => o.key === "adjustments")?.enabled;
  const showAttachments = options.find(o => o.key === "attachments")?.enabled;
  const showNotes = options.find(o => o.key === "notes")?.enabled;
  const showTerms = options.find(o => o.key === "terms")?.enabled;

  let totalLinePricingAdj = 0;
  let totalLineAdj = 0;
  let totalDiscounts = 0;
  let discountItemCount = 0;
  activeLines.forEach(l => {
    const lineTotal = l.orderedQty * l.unitPrice;
    getLinePricingRules(l.itemCode).forEach(r => {
      const adj = r.type === "discount" ? -(lineTotal * r.percent / 100) : (lineTotal * r.percent / 100);
      totalLinePricingAdj += adj;
      if (r.type === "discount") { totalDiscounts += lineTotal * r.percent / 100; discountItemCount++; }
    });
    const adj = getLineAdjustment(l.itemCode);
    if (adj) totalLineAdj += adj.amount;
  });
  const orderPricingAdj = ORDER_PRICING_RULES.reduce((s, r) => s + (r.type === "discount" ? -(subtotal * r.percent / 100) : (subtotal * r.percent / 100)), 0);
  const orderAdj = ORDER_ADJUSTMENTS.reduce((s, a) => s + a.amount, 0);
  const grandTotal = subtotal + (showPricing ? totalLinePricingAdj + orderPricingAdj : 0) + (showAdjustments ? totalLineAdj + orderAdj : 0);

  const attachmentRefs = so.attachments.filter(a => a.inOrder);

  const orderDate = so.orderDate || so.createdDate;
  const estDelivery = so.requestedDeliveryDate || "March 15, 2025";
  const versionNum = so.version?.number ?? 1;

  function handleAction() {
    if (isPrint) {
      window.print();
      onSend();
      return;
    }
    setActionMode("send");
    setSending(true);
    setTimeout(() => { setSending(false); setSent(true); setTimeout(() => onSend(), 1200); }, 2500);
  }

  /* Mark-as-Sent — for cases where the SO was shared to the customer
     via an out-of-system medium (printed handoff, in-person review,
     third-party portal, etc). Skips the email send but runs the same
     status-transition animation so the document still lands in the
     Sent state. No recipient selection required. */
  function handleMarkAsSent() {
    setActionMode("mark");
    setSending(true);
    setTimeout(() => { setSending(false); setSent(true); setTimeout(() => onSend(), 1200); }, 1600);
  }

  /* Dual-action context: when this modal is opened from a Draft SO (not a
     resend, not print preview), pressing Send to Customer ALSO submits the SO
     for review. The header title + subtitle carry that message; we surface
     the same point again on the CTA label so users see it at the moment of
     action. The redundant primary-tinted banner below the header was removed
     per design feedback — it duplicated the subtitle and crowded the surface. */
  /* Only surface the "Send & Submit for Review" narrative when the send
     actually advances the SO to Pending Review. Approver View sends the same
     document but doesn't submit-to-self, so the parent passes
     advancesToPendingReview=false and this collapses back to the plain
     Send to Customer copy. */
  const isFromDraft = so.status === "Draft" && !isResend && !isPrint && advancesToPendingReview;
  const modalTitle = isPrint
    ? "Print Sales Order"
    : isResend
      ? "Resend to Customer"
      : isFromDraft
        ? "Send to Customer & Submit for Review"
        : "Send to Customer";
  const modalSubtitle = isPrint
    ? "Preview before printing. Customize what's visible."
    : isFromDraft
      ? "Emails the SO and moves it to Pending Review in one action."
      : "Preview before sending. Customize what's visible.";
  const ModalIcon = isPrint ? Printer : Send;

  /* ── SO → PdfDocumentData adapter ──
     Maps the SO record + the visibility toggles + the pre-computed
     totals into the shared PDF template shape. Deliberately kept
     inside the component so it closes over the pricing / adjustment
     numbers already computed above (see `totalLinePricingAdj`,
     `orderPricingAdj`, `totalDiscounts`, `grandTotal`). */
  function soToPdfData(soIn: SalesOrder, opts: {
    showHeader: boolean;
    showPricing: boolean;
    showAdjustments: boolean;
    showAttachments: boolean;
    showNotes: boolean;
    showTerms: boolean;
    activeLines: SalesOrder["lines"];
    cancelledLines: SalesOrder["lines"];
    subtotal: number;
    totalLinePricingAdj: number;
    totalLineAdj: number;
    orderPricingAdj: number;
    orderAdj: number;
    totalDiscounts: number;
    grandTotal: number;
  }): PdfDocumentData {
    const meta = getHeaderMeta(soIn);
    const parties = getParties(soIn);
    const payment = getPaymentInfo(soIn, opts.grandTotal);

    /* Map each active SO line into a PdfLineItem. Discounts collapse
       any line-level pricing rules into a single `discountPercent`
       (best-effort — the shared template only shows one strike-through
       chip per line; multi-rule detail is surfaced in the order-level
       Pricing Rules block below). */
    /* Only surface real carrier + tracking + delivered/in-transit
       status once the order has moved past the pre-fulfilment stages.
       Draft / Pending Review / Cleared are all "not shipping yet" —
       showing a tracking number or a DELIVERED chip on those states
       would be a data-integrity lie. Cancelled / Archived also drop
       live tracking (the shipment either didn't happen or is closed). */
    const fulfilmentActive = soIn.status === "Partially Shipped" || soIn.status === "Shipped";
    /* Coarse plan-vs-actual label used when the order isn't shipping
       yet. `Ship by` still shows because it's a projection, but the
       tracking / status columns collapse. */
    const preFulfilmentStatus = soIn.status === "Draft" ? "Planned"
      : soIn.status === "Pending Review" ? "Awaiting approval"
      : soIn.status === "Cleared" ? "Ready to ship"
      : soIn.status === "Cancelled" ? "Cancelled"
      : soIn.status === "Archived" ? "Archived"
      : undefined;

    const items: PdfLineItem[] = opts.activeLines.map((li, idx) => {
      const lineNet = li.orderedQty * li.unitPrice;
      const rules = opts.showPricing ? getLinePricingRules(li.itemCode) : [];
      /* Turn each pricing rule into a `PdfLinePricingRule` with its
         signed amount computed off the base line so the PDF card can
         show the delta line-by-line. */
      const linePricingRules: PdfLinePricingRule[] = rules.map(r => ({
        label: r.label,
        kind: r.type,
        percent: r.percent,
        amount: r.type === "discount"
          ? -(lineNet * r.percent / 100)
          : (lineNet * r.percent / 100),
      }));
      const rulesDelta = linePricingRules.reduce((s, r) => s + r.amount, 0);
      /* Line-level one-time adjustment (credit / add-on) — surfaced
         alongside the rule breakdown so the customer sees WHY the
         line total differs from base. */
      const lineAdj = opts.showAdjustments ? getLineAdjustment(li.itemCode) : null;
      const lineAdjustments: PdfLineAdjustment[] = lineAdj
        ? [{ label: lineAdj.label, amount: lineAdj.amount }]
        : [];
      const adjDelta = lineAdjustments.reduce((s, a) => s + a.amount, 0);
      const ship = getLineShipment(li, idx);
      const comments = opts.showNotes ? getLineComments(li) : null;
      /* Per-line fulfilment gate. Once the order is shipping, we
         defer to the per-line status computed by `getLineShipment`
         (some lines might still be IN PRODUCTION while others are
         DELIVERED on a partially-shipped order). Before fulfilment,
         we blanket the whole SO with the same planning status and
         suppress carrier + tracking entirely. */
      const showLiveShipData = fulfilmentActive &&
        (ship.status === "DELIVERED" || ship.status === "SHIPPED" || ship.status === "IN TRANSIT");
      return {
        id: li.id,
        code: li.itemCode,
        description: li.itemName || "",
        imageUrl: getItemPhoto(li.itemCode),
        quantity: li.orderedQty,
        unitOfMeasure: "Each",
        unitPrice: li.unitPrice,
        pricingRules: linePricingRules.length > 0 ? linePricingRules : undefined,
        adjustments: lineAdjustments.length > 0 ? lineAdjustments : undefined,
        lineTotal: lineNet + rulesDelta + adjDelta,
        shipMethod: ship.shipMethod,
        shipCarrier: showLiveShipData && ship.carrier && ship.carrier !== ship.shipMethod
          ? ship.carrier
          : undefined,
        trackingNumber: showLiveShipData && ship.tracking && ship.tracking !== "Awaiting BOL"
          ? ship.tracking
          : undefined,
        shipStatus: fulfilmentActive ? ship.status : preFulfilmentStatus,
        shipByDate: ship.shipBy,
        comment: comments || undefined,
        /* Line-item `[N]` reference markers dropped — references are
           now a plain URL list in the References section, and sales
           reps inline a URL in the description when needed. */
        refs: undefined,
      };
    });

    /* Pricing rules apply per line item and are already surfaced in
       each line's card breakdown. We used to also render them as an
       order-level block (via `ORDER_PRICING_RULES`), but that
       duplicated the same rules the customer already sees on their
       items. The PDF only shows adjustments (one-time credits /
       surcharges) at the order level now. `ORDER_PRICING_RULES` is
       still referenced above for the order-level totals math since
       the customer's grand total math has to include those rules. */
    void ORDER_PRICING_RULES;

    const adjustments: PdfAdjustment[] = ORDER_ADJUSTMENTS.map(a => ({
      label: a.label,
      amount: a.amount,
      kind: a.amount < 0 ? "discount" : "premium",
    }));

    return {
      kind: "so",
      docNumber: `${soIn.soNumber.replace(/^SO-?/i, "") || soIn.soNumber}-V${meta.versionNum}`,
      statusLabel: soIn.status,
      statusTone:
        soIn.status === "Shipped" ? "success"
        : soIn.status === "Cancelled" || soIn.status === "Expired" ? "warning"
        : soIn.status === "Draft" ? "neutral" : "info",
      brand: {
        name: "Omne ERP",
        tagline: "Sales & Order Management",
      },
      metaLeft: [
        { label: "Order Date", value: meta.orderDate },
        { label: "Customer PO #", value: meta.customerPo },
        { label: "Customer PO Date", value: meta.customerPoDate },
        { label: "Estimated Delivery Date", value: meta.estDelivery },
        { label: "Reference Quote #", value: meta.refQuote },
        { label: "Freight Method", value: soIn.freightMethod || "Carrier Ship" },
      ],
      metaRight: [
        { label: "Recipient", value: meta.recipient },
        { label: "Effective From", value: meta.effectiveFrom },
        { label: "Sales Person", value: meta.salesPerson },
        { label: "Sales Person Contact", value: meta.salesPersonContact },
        { label: "Payment Terms", value: docPaymentTerms(soIn) },
        /* Invoice # is intentionally omitted. A Sales Order can spawn
           multiple invoices depending on the payment schedule
           (deposit + balance, milestone-based, post-shipment Net 30,
           etc.). Hardcoding a single invoice number here would
           misrepresent the billing lifecycle. Mainstream ERPs
           (SAP SD, Oracle, NetSuite, Odoo) treat invoices as separate
           documents referenced by the SO number, not the reverse. */
      ],
      customer: {
        displayName: parties[0]?.name || soIn.customer,
        phone: parties[0]?.phone,
        street: parties[0]?.address?.split("\n")[0],
        city: parties[0]?.address?.split("\n").slice(1).join(", "),
      },
      shipTo: {
        displayName: parties[1]?.name || (soIn.warehouse || "Main Warehouse"),
        phone: parties[1]?.phone,
        street: parties[1]?.address?.split("\n")[0],
        city: parties[1]?.address?.split("\n").slice(1).join(", "),
      },
      billTo: {
        displayName: parties[2]?.name || soIn.customer,
        phone: parties[2]?.phone,
        street: parties[2]?.address?.split("\n")[0],
        city: parties[2]?.address?.split("\n").slice(1).join(", "),
      },
      items,
      currency: soIn.currency || "USD",
      unitLabel: "Unit",
      totalItemCount: opts.activeLines.length + opts.cancelledLines.length,
      /* Pricing rules render on each item's card breakdown, not as
         an order-level section — the customer sees them once, in the
         line context where they were applied. */
      adjustments: opts.showAdjustments && adjustments.length > 0 ? adjustments : undefined,
      paymentMethod: docPaymentMethod(soIn),
      paymentTerms: docPaymentTerms(soIn),
      subtotal: opts.subtotal,
      discountsTotal: opts.showPricing ? opts.totalDiscounts : 0,
      adjustmentsTotal: opts.showAdjustments ? (opts.totalLineAdj + opts.orderAdj) : 0,
      grandTotal: opts.grandTotal,
      notes: opts.showNotes ? [
        "The amount of this Sales Order is the agreed fixed price and shall not be exceeded without advanced written consent from the Bill To contact identified on the order.",
        `Include Sales Order# <strong>${soIn.soNumber}</strong> and Invoice# in ACH addenda (CCD/CTX) or remittance email.`,
        "Remittance Advice Email: <strong>ap@omne-erp.com</strong>",
        "Important Security information: Banking details on file. We do not accept account changes via email. Verify all payment changes by voice with your account manager.",
        "Per-line shipment status will be updated automatically as carrier scans are received. For real-time status, visit the customer portal.",
      ] : undefined,
      /* References section is populated from the External Links
         textarea on Deal Information. One URL per line, no `[N]`
         markers, no dependence on attachments — the sales rep writes
         in exactly what shows up here. */
      references: opts.showAttachments ? getExternalLinksList(soIn.id) : undefined,
      terms: opts.showTerms ? DEFAULT_SO_TERMS : undefined,
      /* Sales Orders are confirmation documents — the customer's
         acceptance already happened on the referenced Quote (or via a
         customer PO). Mainstream ERPs (SAP SD, Oracle Fusion,
         NetSuite, Odoo, Dynamics 365) omit the signature block from
         SO acknowledgments for that reason; we follow suit. */
      signature: undefined,
      poweredBy: "Omne ERP",
    };
  }

  /* ── Page 1 Content (matches PrintSalesOrder reference docx layout) ── */
  function renderPage1() {
    const meta = getHeaderMeta(so);
    const parties = getParties(so);
    const payment = getPaymentInfo(so, grandTotal);
    const sb = statusBadgeColors(so.status);
    const totalUnits = activeLines.reduce((s, l) => s + l.orderedQty, 0);

    const metaCell = (label: string, val: string) => (
      <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
        <span style={{ color: DOC_C.muted, minWidth: 140, fontSize: 12 }}>{label}</span>
        <span style={{ fontWeight: 700, color: DOC_C.fg, fontSize: 12 }}>{val}</span>
      </div>
    );

    return (
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: DOC_C.fg }}>
        {/* Header bar */}
        {showHeader && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: DOC_C.headerBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "white" }}>O</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: DOC_C.fg, letterSpacing: "0.04em" }}>PIONEER ERP</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: DOC_C.fg, letterSpacing: "-0.01em" }}>
              Sales Order <span style={{ color: DOC_C.primary }}>{so.soNumber}</span>
            </div>
            <span style={{ display: "inline-block", padding: "5px 14px", borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", background: sb.bg, color: sb.fg, whiteSpace: "nowrap" }}>{so.status.toUpperCase()}</span>
          </div>
        )}

        {/* Order details grid (2 columns) */}
        <div style={{ background: DOC_C.panelBgSoft, border: `1px solid ${DOC_C.border}`, borderRadius: 10, padding: "16px 20px", marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 36, rowGap: 8 }}>
            {metaCell("Order Date:", meta.orderDate)}                {metaCell("Customer PO #:", meta.customerPo)}
            {metaCell("Estimated Delivery Date:", meta.estDelivery)} {metaCell("Customer PO Date:", meta.customerPoDate)}
            {metaCell("Reference Quote #:", meta.refQuote)}          {metaCell("Recipient:", meta.recipient)}
            {metaCell("Version:", String(meta.versionNum))}          {metaCell("Effective From:", meta.effectiveFrom)}
            {metaCell("Version Draft Date:", meta.versionDraftDate)} {metaCell("Sales Person:", meta.salesPerson)}
            <div /> {metaCell("Sales Person Contact:", meta.salesPersonContact)}
          </div>
        </div>

        {/* Customer / Ship To / Bill To */}
        <div style={{ display: "flex", gap: 24, marginBottom: 24 }}>
          {parties.map(p => (
            <div key={p.title} style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: DOC_C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{p.title}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: DOC_C.fg, marginBottom: 4, lineHeight: 1.3 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: DOC_C.fg, marginBottom: 3 }}>{p.phone}</div>
              <div style={{ fontSize: 11, color: DOC_C.muted, lineHeight: 1.55, whiteSpace: "pre-line" }}>{p.address}</div>
              {p.extra && (
                <div style={{ marginTop: 8, fontSize: 11, color: DOC_C.muted, lineHeight: 1.6 }}>
                  {p.extra.map(e => (
                    <div key={e.label}>{e.label}: <strong style={{ color: DOC_C.fg }}>{e.value}</strong></div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Item Details title */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: DOC_C.fg }}>Item Details</span>
          <span style={{ fontSize: 11, color: DOC_C.muted }}>({activeLines.length} items, {totalUnits} units total)</span>
        </div>

        {/* Line items table */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: DOC_C.panelBgSoft, borderTop: `1px solid ${DOC_C.border}`, borderBottom: `1px solid ${DOC_C.border}` }}>
              {[
                { label: "#", w: 30, align: "center" },
                { label: "Item Details", w: undefined as any, align: "left" },
                { label: "Qty", w: 44, align: "center" },
                { label: "Unit", w: 60, align: "center" },
                { label: "Unit Price", w: 90, align: "right" },
                { label: "Ship Method", w: 92, align: "center" },
                { label: "Subtotal", w: 100, align: "right" },
                { label: "Ship by", w: 78, align: "right" },
              ].map(c => (
                <th key={c.label} style={{ padding: "10px 6px", fontSize: 10, fontWeight: 700, color: DOC_C.muted, textTransform: "none", width: c.w, textAlign: c.align as any }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeLines.map((li, idx) => {
              const lineTotal = li.orderedQty * li.unitPrice;
              const pricingRules = getLinePricingRules(li.itemCode);
              const hasDiscount = pricingRules.some(r => r.type === "discount");
              const ship = getLineShipment(li, idx);
              const sc = shipStatusColors(ship.status);
              const comments = showNotes ? getLineComments(li) : null;
              return (
                <React.Fragment key={li.id}>
                  <tr style={{ verticalAlign: "top" }}>
                    <td style={{ padding: "14px 6px", color: DOC_C.muted, fontSize: 11, fontWeight: 600, textAlign: "center" }}>{String(idx + 1).padStart(2, "0")}</td>
                    <td style={{ padding: "14px 6px" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <div style={{ width: 48, height: 48, borderRadius: 6, background: DOC_C.panelBgSoft, border: `1px solid ${DOC_C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span style={{ fontSize: 20 }}>📦</span>
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: DOC_C.fg, marginBottom: 2 }}>{li.itemCode}</div>
                          <div style={{ fontSize: 11, color: DOC_C.muted, lineHeight: 1.4 }}>{li.itemName}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 6px", fontSize: 12, textAlign: "center", fontWeight: 600 }}>{li.orderedQty}</td>
                    <td style={{ padding: "14px 6px", fontSize: 11, textAlign: "center", color: DOC_C.muted }}>Each</td>
                    <td style={{ padding: "14px 6px", fontSize: 12, textAlign: "right" }}>
                      {showPricing && hasDiscount ? (
                        <>
                          <span style={{ display: "inline-block", padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700, background: DOC_C.greenBg, color: DOC_C.greenFg, marginBottom: 3 }}>5% off</span><br />
                          <span style={{ textDecoration: "line-through", color: DOC_C.muted, fontSize: 11 }}>{fmtCurrency(li.unitPrice)}</span><br />
                          <span style={{ fontWeight: 700 }}>{fmtCurrency(li.unitPrice * 0.95)}</span>
                        </>
                      ) : (
                        <span style={{ fontWeight: 600 }}>{fmtCurrency(li.unitPrice)}</span>
                      )}
                    </td>
                    <td style={{ padding: "14px 6px", fontSize: 11, textAlign: "center", color: DOC_C.fg, fontWeight: 500 }}>{ship.shipMethod}</td>
                    <td style={{ padding: "14px 6px", fontSize: 12, fontWeight: 700, textAlign: "right" }}>{fmtCurrency(lineTotal)}</td>
                    <td style={{ padding: "14px 6px", fontSize: 11, textAlign: "right", color: DOC_C.fg, fontWeight: 500, whiteSpace: "nowrap" }}>{ship.shipBy}</td>
                  </tr>
                  <tr key={`${li.id}-ship`}>
                    <td />
                    <td colSpan={7} style={{ padding: "0 6px 14px 6px", borderBottom: `1px solid ${DOC_C.border}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", background: DOC_C.panelBgSoft, borderRadius: 6, padding: "6px 10px", fontSize: 10 }}>
                        <span style={{ display: "inline-block", padding: "3px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", background: sc.bg, color: sc.fg }}>{ship.status}</span>
                        <span style={{ color: DOC_C.muted }}>Carrier: <strong style={{ color: DOC_C.fg }}>{ship.carrier}</strong></span>
                        <span style={{ color: DOC_C.muted }}>Tracking #: <strong style={{ color: ship.tracking === "Awaiting BOL" ? DOC_C.muted : DOC_C.primary }}>{ship.tracking}</strong></span>
                        <span style={{ marginLeft: "auto", fontWeight: 700, color: DOC_C.fg }}>{ship.etaLabel}</span>
                      </div>
                      {comments && (
                        <div style={{ marginTop: 6, fontSize: 11, color: DOC_C.muted, lineHeight: 1.5 }}>
                          <strong style={{ color: DOC_C.fg }}>Comments:</strong> {comments}
                        </div>
                      )}
                      {/* Line-item `[N]` attachment refs removed — the
                          References section at the bottom lists any
                          external URLs from the Deal Info textarea. */}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {/* Cancelled Lines */}
        {cancelledLines.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: DOC_C.destructive, padding: "8px 0", borderBottom: `2px solid ${DOC_C.destructive}`, marginBottom: 4 }}>Cancelled Lines ({cancelledLines.length})</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {cancelledLines.map(li => (
                  <tr key={li.id} style={{ borderBottom: `1px solid ${DOC_C.border}` }}>
                    <td style={{ padding: "8px 8px 8px 0", fontSize: 12, fontWeight: 500, textDecoration: "line-through", color: DOC_C.muted }}>{li.itemCode} — {li.itemName}</td>
                    <td style={{ padding: 8, fontSize: 12, textAlign: "center", color: DOC_C.muted }}>{li.cancelledQty || li.orderedQty}</td>
                    <td style={{ padding: 8, fontSize: 11, color: DOC_C.muted }}>{li.cancelledReason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Payment method + totals */}
        <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 32 }}>
          <div style={{ paddingTop: 4 }}>
            <div style={{ fontSize: 12, color: DOC_C.muted, marginBottom: 6 }}>Payment Method: <span style={{ fontWeight: 700, color: DOC_C.fg }}>{docPaymentMethod(so)}</span></div>
            <div style={{ fontSize: 12, color: DOC_C.muted }}>Payment Terms: <span style={{ fontWeight: 700, color: DOC_C.fg }}>{docPaymentTerms(so)}</span></div>
          </div>
          <div style={{ minWidth: 300 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12 }}>
              <span style={{ color: DOC_C.muted }}>Subtotal ({totalUnits} items)</span>
              <span style={{ fontWeight: 600, color: DOC_C.fg }}>{fmtCurrency(subtotal)}</span>
            </div>
            {showPricing && totalDiscounts > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12 }}>
                <span style={{ color: DOC_C.muted }}>Discounts Applied ({discountItemCount} items)</span>
                <span style={{ fontWeight: 600, color: DOC_C.green }}>-{fmtCurrency(totalDiscounts)}</span>
              </div>
            )}
            <div style={{ borderTop: `2px solid ${DOC_C.fg}`, marginTop: 8, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Total Amount</span>
              <span style={{ fontSize: 20, fontWeight: 700 }}>{fmtCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Payment status */}
        <div style={{ marginTop: 28, background: DOC_C.panelBgSoft, border: `1px solid ${DOC_C.border}`, borderRadius: 10, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: DOC_C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Payment Status</div>
            <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", background: DOC_C.amberBg, color: DOC_C.amberFg }}>{payment.status}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", rowGap: 7, fontSize: 12 }}>
            <span style={{ color: DOC_C.muted }}>Invoice #</span>             <span style={{ textAlign: "right", fontWeight: 700, color: DOC_C.primary }}>{payment.invoiceNumber}</span>
            <span style={{ color: DOC_C.muted }}>Invoice Date</span>          <span style={{ textAlign: "right", fontWeight: 600, color: DOC_C.fg }}>{payment.invoiceDate}</span>
            <span style={{ color: DOC_C.muted }}>Payment Due Date</span>      <span style={{ textAlign: "right", fontWeight: 600, color: DOC_C.fg }}>{payment.dueDate}</span>
            <span style={{ color: DOC_C.muted }}>Amount Invoiced</span>       <span style={{ textAlign: "right", fontWeight: 600, color: DOC_C.fg }}>{fmtCurrency(payment.amountInvoiced)}</span>
            <span style={{ color: DOC_C.muted }}>{payment.paidLabel}</span>   <span style={{ textAlign: "right", fontWeight: 700, color: DOC_C.green }}>{fmtCurrency(payment.amountPaid)}</span>
            <span style={{ color: DOC_C.muted }}>Outstanding Balance</span>   <span style={{ textAlign: "right", fontWeight: 700, color: DOC_C.destructive }}>{fmtCurrency(payment.amountInvoiced - payment.amountPaid)}</span>
          </div>
        </div>

        {/* Notes */}
        {showNotes && (
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: DOC_C.fg, marginBottom: 10 }}>Notes</div>
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: DOC_C.fg, lineHeight: 1.7 }}>
              <li>The amount of the Sales Order is the agreed fixed price and shall not be exceeded without advanced written consent from the Bill To contact identified on the order.</li>
              <li style={{ marginTop: 4 }}>Include Sales Order# and Invoice# in ACH addenda (CCD/CTX) or remittance email.</li>
              <li style={{ marginTop: 4 }}>Remittance Advice Email: <strong>ap@pioneer-erp.com</strong></li>
              <li style={{ marginTop: 4 }}>Important Security information: Banking details on file. We do not accept account changes via email, call AP at +1 (844)-372-8267 to verify.</li>
              <li style={{ marginTop: 4 }}>Per-line shipment status will be updated automatically as carrier scans are received. For real-time status, visit the customer portal.</li>
            </ol>
          </div>
        )}

        {/* Terms summary */}
        {showTerms && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: DOC_C.fg, marginBottom: 8 }}>Terms and Conditions</div>
            <div style={{ fontSize: 11, color: DOC_C.muted, lineHeight: 1.65 }}>
              Prices are guaranteed for 30 days from quote conversion. {docPaymentTermsSentence(so)} A 1.5% late fee will be applied to overdue invoices. Warranty covers defects in material and workmanship for one year. Customer is responsible for shipping costs on warranty returns. Full Terms and Conditions are included on the next page.
            </div>
          </div>
        )}

        {/* References — populated from the External Links textarea on
            Deal Information. One URL per line, no `[N]` markers. */}
        {showAttachments && getExternalLinksList(so.id).length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: DOC_C.fg, marginBottom: 6 }}>References</div>
            <div style={{ fontSize: 11, color: DOC_C.primary, lineHeight: 1.7 }}>
              {getExternalLinksList(so.id).map((url, i) => (
                <div key={`${i}-${url}`}>{url}</div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 36, paddingTop: 14, borderTop: `1px solid ${DOC_C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: DOC_C.mutedSoft }}>Sales Order# {so.soNumber}</span>
          <span style={{ fontSize: 10, color: DOC_C.mutedSoft }}>Page 1 of 2</span>
          <span style={{ fontSize: 10, color: DOC_C.mutedSoft }}>Powered by <strong style={{ color: DOC_C.fg }}>Pioneer ERP</strong></span>
        </div>
      </div>
    );
  }

  /* ── Page 2 Content (Terms & Conditions) ── */
  function renderPage2() {
    const meta = getHeaderMeta(so);
    return (
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: DOC_C.fg }}>
        <div style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: DOC_C.muted, marginBottom: 24, paddingTop: 8 }}>Pioneer ERP — Sales Order Terms and Conditions</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: DOC_C.fg, marginBottom: 18, letterSpacing: "0.02em" }}>TERMS AND CONDITIONS</div>

        <div style={{ fontSize: 11, color: DOC_C.fg, lineHeight: 1.65 }}>
          <p style={{ marginBottom: 12 }}><strong>1. ACCEPTANCE & VALIDITY:</strong> This Sales Order constitutes a binding contract upon issuance and references the customer's Purchase Order {meta.customerPo} and Quote #{meta.refQuote.split(" ")[0]}. Any changes after issuance require written agreement from both parties.</p>

          <p style={{ marginBottom: 6 }}><strong>2. PRICING & PAYMENT:</strong></p>
          <ul style={{ paddingLeft: 22, marginBottom: 12, listStyle: "disc" }}>
            <li><strong>Pricing:</strong> All prices are in {so.currency || "USD"} and locked at the values agreed in the referenced Quote.</li>
            <li style={{ marginTop: 3 }}><strong>Payment Terms:</strong> {docPaymentTermsSentence(so)} 50% deposit due upon order acceptance.</li>
            <li style={{ marginTop: 3 }}><strong>Late Payment:</strong> Overdue amounts incur 1.5% monthly interest. We may suspend deliveries and pursue collection, with the customer responsible for all collection costs.</li>
          </ul>

          <p style={{ marginBottom: 12 }}><strong>3. DELIVERY & SHIPPING:</strong> We are not liable for carrier delays. Each line item has its own shipping milestone shown in the Items table. Customer must inspect upon delivery and report damage/discrepancies within 7 days. Per-line tracking numbers are provided once carrier pickup is confirmed.</p>

          <p style={{ marginBottom: 12 }}><strong>4. WARRANTIES & DISCLAIMERS:</strong> Products are warranted against defects in materials and workmanship for 12 months from delivery. Our sole obligation is to repair or replace defective products. Warranty is void if products are modified, misused, or damaged by the customer. We disclaim all other warranties, express or implied, including merchantability and fitness for particular purpose.</p>

          <p style={{ marginBottom: 12 }}><strong>5. LIMITATION OF LIABILITY:</strong> Our total liability shall not exceed the price paid for the products. We are not liable for indirect, incidental, consequential, special, or punitive damages, including lost profits, business interruption, or data loss, regardless of cause.</p>

          <p style={{ marginBottom: 12 }}><strong>6. CANCELLATIONS & RETURNS:</strong> Orders cannot be cancelled after acceptance without written consent. Custom or made-to-order items (including all EV-series vehicles on this order) are non-cancellable and non-returnable. Standard products may be returned within 30 days with prior authorization, subject to a restocking fee. Products must be unused in their original packaging. Customer pays return shipping unless products are defective.</p>

          <p style={{ marginBottom: 12 }}><strong>7. COMPLIANCE & EXPORT:</strong> Customer must comply with all export control laws and sanctions regulations. Products may not be exported to prohibited countries or used for prohibited purposes. Customer warrants they are not on restricted party lists and will obtain required export licenses.</p>

          <p style={{ marginBottom: 12 }}><strong>8. INTELLECTUAL PROPERTY:</strong> All designs, specifications, documentation, and intellectual property remain our exclusive property. Customer receives no license except as necessary to use purchased products. Customer must maintain the confidentiality of proprietary information.</p>

          <p style={{ marginBottom: 12 }}><strong>9. PRODUCT SPECIFICATIONS:</strong> Specifications are based on current standards and may change to comply with regulations or improve products. We are not liable for minor deviations that do not affect functionality. Custom specifications require a separate written agreement.</p>

          <p style={{ marginBottom: 12 }}><strong>10. FORCE MAJEURE:</strong> Neither party is liable for delays or failures due to events beyond reasonable control, including natural disasters, war, pandemics, strikes, or government actions. Performance obligations are suspended during such events.</p>

          <p style={{ marginBottom: 12 }}><strong>11. GENERAL PROVISIONS:</strong> Entire Agreement: This Sales Order, together with the referenced Quote and Customer Purchase Order, constitutes the entire agreement and supersedes all prior communications.</p>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 36, paddingTop: 14, borderTop: `1px solid ${DOC_C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: DOC_C.mutedSoft }}>Sales Order# {so.soNumber}</span>
          <span style={{ fontSize: 10, color: DOC_C.mutedSoft }}>Page 2 of 2</span>
          <span style={{ fontSize: 10, color: DOC_C.mutedSoft }}>Powered by <strong style={{ color: DOC_C.fg }}>Pioneer ERP</strong></span>
        </div>
      </div>
    );
  }


  /* The preview's data and visibility, hoisted so the Print window's
     page count reads the same document the preview renders. */
  const previewData = soToPdfData(so, {
    showHeader: !!showHeader,
    showPricing: !!showPricing,
    showAdjustments: !!showAdjustments,
    showAttachments: !!showAttachments,
    showNotes: !!showNotes,
    showTerms: !!showTerms,
    activeLines,
    cancelledLines,
    subtotal,
    totalLinePricingAdj,
    totalLineAdj,
    orderPricingAdj,
    orderAdj,
    totalDiscounts,
    grandTotal,
  });
  const previewVisibility: PdfVisibility = {
    brand: !!showHeader,
    meta: true,
    addresses: true,
    items: true,
    pricingRules: !!showPricing,
    adjustments: !!showAdjustments,
    payment: true,
    totals: true,
    notes: !!showNotes,
    references: !!showAttachments,
    terms: !!showTerms,
    signature: !!showTerms,
  };
  const documentPages = getPdfPageCount(previewData, previewVisibility);
  const printAttachments = isPrint ? getSOPrintAttachments(so) : [];

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: "var(--z-modal)", backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }} onClick={guardedClose}>

      {/* Sending / Sent overlay — unified StateTransitionOverlay.
          Narrative branches on actionMode so the user sees the right
          framing: "Sending" for the email path, "Marking as Sent" for
          the out-of-system handoff path. End state is the same on both. */}
      <StateTransitionOverlay
        isActive={sending || sent}
        fromLabel="Draft"
        toLabel={
          sent
            ? "Submitted for Review"
            : actionMode === "mark"
              ? "Marking as Sent"
              : "Pending Review"
        }
        tone={sent ? "success" : actionMode === "mark" ? "info" : "warning"}
        Icon={sent ? Check : actionMode === "mark" ? CheckCheck : Send}
        heading={
          sent
            ? "Submitted for Review"
            : actionMode === "mark"
              ? "Marking as Sent"
              : "Sending to Customer"
        }
        meta={
          sent && actionMode === "mark"
            ? "Marked as sent (shared externally)"
            : undefined
        }
        duration={sent ? 1100 : 60000}
      />

      {/* Modal */}
      <div className="bg-card rounded-xl border border-border flex flex-col"
        style={{
          boxShadow: "var(--elevation-4)",
          width: showOptions ? 1200 : 920,
          maxWidth: "95vw",
          maxHeight: "90vh",
          transition: "width 300ms ease",
        }}
        onClick={e => e.stopPropagation()}>

        {/* Header — Quotes canonical: 32px icon chip (bg-accent), 14px title, 11px muted subtitle, 28px close. */}
        <div className="flex items-center justify-between border-b border-border" style={{ padding: "16px 20px" }}>
          <div className="flex items-center" style={{ gap: 12 }}>
            <div className="rounded-lg bg-accent flex items-center justify-center" style={{ width: 32, height: 32 }}>
              <ModalIcon className="text-primary" style={{ width: 16, height: 16 }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", lineHeight: 1, marginBottom: 5 }}>{modalTitle}</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.4 }}>{modalSubtitle}</div>
            </div>
          </div>
          <div className="flex items-center" style={{ gap: 8 }}>
            {VISIBILITY_OPTIONS_ENABLED && <button
              onClick={() => setShowOptions(!showOptions)}
              className={`flex items-center rounded-lg border transition-colors ${showOptions ? "bg-primary text-primary-foreground border-primary" : "border-border text-foreground-soft hover:bg-secondary"}`}
              style={{ fontSize: 12, fontWeight: 500, gap: 8, padding: "8px 12px" }}
            >
              {showOptions ? <><EyeOff className="w-3.5 h-3.5" /> Hide Options</> : <><Settings2 className="w-3.5 h-3.5" /> Visibility Options</>}
            </button>}
            <button
              onClick={guardedClose}
              className="rounded-md flex items-center justify-center transition-colors"
              style={{ width: 28, height: 28, border: "none", backgroundColor: "transparent", cursor: "pointer" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--muted)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <X style={{ width: 16, height: 16, color: "var(--muted-foreground)" }} />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Visibility panel */}
          {showOptions && (
            <div className="border-r border-border overflow-y-auto" style={{ width: 280, flexShrink: 0, padding: "var(--space-card-padding)" }}>
              <div className="flex items-center" style={{ gap: 6, marginBottom: 12 }}>
                <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-foreground" style={micro}>VISIBILITY SETTINGS</span>
              </div>
              <div className="text-foreground/50" style={{ ...caption, fontWeight: "var(--font-weight-normal)", marginBottom: 16 }}>
                Choose what {isPrint ? "to include in the printout" : "your customer will see"}.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {options.map(opt => (
                  <div key={opt.key} className="flex items-start justify-between" style={{ gap: 12 }}>
                    <div className="flex items-start" style={{ gap: 10 }}>
                      <span style={{ fontSize: "var(--text-base)", lineHeight: 1, marginTop: 2 }}>{opt.icon}</span>
                      <div>
                        <div className="text-foreground" style={captionSemi}>{opt.label}</div>
                        <div className="text-muted-foreground" style={{ ...caption, fontWeight: "var(--font-weight-normal)" }}>{opt.description}</div>
                      </div>
                    </div>
                    <Toggle enabled={opt.enabled} onChange={() => toggleOption(opt.key)} />
                  </div>
                ))}
              </div>

              {/* Recipient section for send mode */}
              {!isPrint && (
                <>
                  <div style={{ height: 1, backgroundColor: "var(--border)", margin: "20px 0" }} />
                  <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                    <div className="flex items-center" style={{ gap: 6 }}>
                      <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-foreground" style={micro}>RECIPIENTS</span>
                    </div>
                    <span className="text-muted-foreground" style={{ fontSize: 10 }}>{selectedContacts.size} selected</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {contacts.map(contact => {
                      const selected = selectedContacts.has(contact.email);
                      const ac = getAvatarColor(contact.name);
                      return (
                        <button key={contact.email} onClick={() => toggleContact(contact.email)}
                          className="flex items-center gap-2.5 w-full text-left transition-all rounded-lg"
                          style={{ padding: "7px 8px", border: selected ? "1px solid color-mix(in srgb, var(--primary) 25%, transparent)" : "1px solid var(--border)", backgroundColor: selected ? "color-mix(in srgb, var(--primary) 3%, transparent)" : "transparent" }}
                          onMouseEnter={e => { if (!selected) e.currentTarget.style.backgroundColor = "var(--secondary)"; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = selected ? "color-mix(in srgb, var(--primary) 3%, transparent)" : "transparent"; }}>
                          <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${selected ? "var(--primary)" : "var(--border)"}`, backgroundColor: selected ? "var(--primary)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {selected && <Check style={{ width: 11, height: 11, color: "white", strokeWidth: 3 }} />}
                          </div>
                          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: ac.bg }}>
                            <span style={{ fontSize: 8, fontWeight: 700, color: ac.fg }}>{getInitials(contact.name)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-foreground truncate" style={{ fontSize: 11, fontWeight: 600 }}>{contact.name}</span>
                              {contact.primary && <span style={{ fontSize: 8, fontWeight: 600, color: "var(--primary)", backgroundColor: "color-mix(in srgb, var(--primary) 8%, transparent)", padding: "1px 4px", borderRadius: 3, textTransform: "uppercase" }}>Primary</span>}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Mail style={{ width: 10, height: 10, color: "#a1a1aa" }} />
                              <span className="text-muted-foreground truncate" style={{ fontSize: 10 }}>{contact.email}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Preview area — routes through the shared `<PdfDocument>`
              so Quote + SO PDFs share the same paper-like chrome.
              The old renderPage1/2 inline layout below is retained
              (unreferenced) until we're confident on the port, but is
              no longer wired to the preview. */}
          {(() => {
            const data = previewData;
            const visibility = previewVisibility;
            return (
              <div className="flex-1 flex flex-col min-h-0" data-pdf-scroll-root style={{ background: "var(--secondary)" }}>
                <style>{`
                  @media print {
                    body * { visibility: hidden; }
                    [data-pdf-scroll-root], [data-pdf-scroll-root] * { visibility: visible; }
                    [data-pdf-scroll-root] {
                      position: absolute !important;
                      top: 0; left: 0; right: 0;
                      background: #FFFFFF !important;
                      overflow: visible !important;
                    }
                  }
                `}</style>
                <div className="flex-1 overflow-auto">
                  <PdfDocument data={data} visibility={visibility} />
                </div>
              </div>
            );
          })()}
        </div>

        {/* ── Footer ── Include-attachments toggle on the left,
            primary + secondary CTAs anchored bottom-right per Partner
            modal chrome. Print mode drops the toggle (nothing to zip
            when the user is going to a printer). */}
        <div className="flex items-center justify-between border-t border-border" style={{ padding: "12px 20px", gap: 12 }}>
          <div className="flex items-center" style={{ gap: 8 }}>
            <label className="flex items-center gap-2 cursor-pointer select-none" title={isPrint ? "Print the attachments alongside the PDF." : "Include the SO's attachments in the send — they'll be zipped with the PDF."}>
              <Switch
                checked={includeAttachments}
                onCheckedChange={setIncludeAttachments}
                aria-label="Include attachments"
              />
              <span className="text-muted-foreground" style={{ fontSize: 12, fontWeight: 500 }}>
                Include attachments
              </span>
            </label>
          </div>
          <div className="flex items-center" style={{ gap: 8 }}>
            {!isPrint && contacts.length === 0 && (
              <span role="status" style={{ fontSize: 12, color: "#64748B", marginRight: 4 }}>
                {FIELD_RULES.poc.emptyLabel} on this order. Add one in the sidebar before sending.
              </span>
            )}
            <Button variant="secondary" size="sm" onClick={guardedClose} icon={<X className="w-3.5 h-3.5" />}>
              Cancel <KbdHint keys="Esc" />
            </Button>
            {!isPrint && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleMarkAsSent}
                icon={<CheckCheck className="w-3.5 h-3.5" />}
                title="Mark this order as Sent without emailing — use when you've shared it through another medium (printed handoff, in-person review, third-party portal, etc)."
              >
                Mark as Sent
              </Button>
            )}
            {isPrint && (
              <PrintPageCount documentPages={documentPages} attachments={printAttachments} includeAttachments={includeAttachments} />
            )}
            <Button variant="success" size="sm" onClick={handleAction}
              disabled={!isPrint && selectedContacts.size === 0}
              icon={isPrint ? <Printer className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
              title={isFromDraft ? "Emails the SO to the customer and submits it for review at the same time." : undefined}
            >
              {isPrint
                ? "Print"
                : isResend
                  ? "Resend"
                  : isFromDraft
                    ? "Send & Submit for Review"
                    : "Send to Customer"} <KbdHint keys="⌘↵" variant="light" />
            </Button>
          </div>
        </div>
        {discardDialog}
      </div>
    </div>
  );
}
