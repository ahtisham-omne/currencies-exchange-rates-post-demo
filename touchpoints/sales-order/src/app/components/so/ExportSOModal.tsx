import { useState } from "react";
import { X, Download, Mail, Settings2, EyeOff } from "lucide-react";
import { Switch } from "@/app/components/ui/switch";
import { useModalShortcuts, KbdHint } from "./ModalKeyboard";
import { toast } from "sonner";
import { useDiscardGuard } from "./ui/DiscardChangesDialog";
import type { SalesOrder } from "./types";
import { Button } from "./ui/Button";
import {
  PdfDocument, DEFAULT_SO_TERMS,
  type PdfDocumentData, type PdfLineItem, type PdfAdjustment, type PdfVisibility,
  type PdfLinePricingRule, type PdfLineAdjustment,
} from "@/app/components/shared/pdfDocument";
import {
  getLineShipment, getLineComments, getHeaderMeta, getParties, getPaymentInfo, getItemPhoto, docPaymentTerms, docPaymentMethod,
} from "./soDocumentData";
import { getExternalLinksList } from "@/app/data/linksRepository";

const font: React.CSSProperties = {};
const caption: React.CSSProperties = { ...font, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" };
const captionSemi: React.CSSProperties = { ...font, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" };
const micro: React.CSSProperties = { ...font, fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", letterSpacing: "0.04em", textTransform: "uppercase" as const };

interface VisibilityOption {
  key: string;
  label: string;
  description: string;
  icon: string;
  enabled: boolean;
}

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
    <button
      onClick={() => onChange(!enabled)}
      className="relative shrink-0 rounded-full transition-colors"
      style={{
        width: 40, height: 22,
        backgroundColor: enabled ? "var(--primary)" : "var(--border)",
      }}
    >
      <div
        className="absolute top-[2px] rounded-full bg-card transition-transform"
        style={{
          width: 18, height: 18,
          transform: enabled ? "translateX(20px)" : "translateX(2px)",
          boxShadow: "var(--elevation-1)",
        }}
      />
    </button>
  );
}

/* ── Mock pricing rules per line ── */
function getLinePricingRules(itemCode: string) {
  const rules: { label: string; type: "discount" | "premium"; percent: number }[] = [];
  if (itemCode.includes("001") || itemCode.includes("002")) {
    rules.push({ label: "Fleet Volume Discount", type: "discount", percent: 8 });
  }
  if (itemCode.includes("049") || itemCode.includes("059")) {
    rules.push({ label: "Govt. Contract Premium", type: "premium", percent: 3 });
  }
  if (itemCode.includes("026")) {
    rules.push({ label: "Bulk Lighting Discount", type: "discount", percent: 5 });
  }
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

/* ── Order-level adjustments ── */
const ORDER_ADJUSTMENTS = [
  { label: "Early payment incentive (2/10 Net 30)", amount: -1250 },
  { label: "Freight surcharge — oversized load", amount: 780 },
];

const ORDER_PRICING_RULES = [
  { label: "Annual Volume Rebate Tier 2", type: "discount" as const, percent: 2 },
];

export function ExportSOModal({ open, so, onClose }: { open: boolean; so: SalesOrder; onClose: () => void }) {
  /* Visibility Options is hidden for now per product. The state + side panel
     + per-field config object are intentionally preserved so we can re-enable
     the flow later by flipping VISIBILITY_OPTIONS_ENABLED to true. */
  const VISIBILITY_OPTIONS_ENABLED = false;
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  /* Include-attachments toggle — when true, the download would bundle
     the SO's attachments alongside the PDF (zip). UI only for now. */
  const [includeAttachments, setIncludeAttachments] = useState(false);

  const toggleOption = (key: string) => {
    setOptions(prev => prev.map(o => o.key === key ? { ...o, enabled: !o.enabled } : o));
  };

  const activeLines = so.lines.filter(l => !l.cancelled);
  const subtotal = activeLines.reduce((s, l) => s + l.orderedQty * l.unitPrice, 0);

  // Compute pricing adjustments
  const showPricing = options.find(o => o.key === "pricing")?.enabled;
  const showAdjustments = options.find(o => o.key === "adjustments")?.enabled;
  const showAttachments = options.find(o => o.key === "attachments")?.enabled;
  const showNotes = options.find(o => o.key === "notes")?.enabled;

  // Line-level pricing & adjustments
  let totalLinePricingAdj = 0;
  let totalLineAdj = 0;
  activeLines.forEach(l => {
    const lineTotal = l.orderedQty * l.unitPrice;
    getLinePricingRules(l.itemCode).forEach(r => {
      const amt = r.type === "discount" ? -(lineTotal * r.percent / 100) : (lineTotal * r.percent / 100);
      totalLinePricingAdj += amt;
    });
    const adj = getLineAdjustment(l.itemCode);
    if (adj) totalLineAdj += adj.amount;
  });

  // Order-level
  const orderPricingAdj = ORDER_PRICING_RULES.reduce((s, r) => s + (r.type === "discount" ? -(subtotal * r.percent / 100) : (subtotal * r.percent / 100)), 0);
  const orderAdj = ORDER_ADJUSTMENTS.reduce((s, a) => s + a.amount, 0);

  const grandTotal = subtotal + (showPricing ? totalLinePricingAdj + orderPricingAdj : 0) + (showAdjustments ? totalLineAdj + orderAdj : 0);

  const handleExport = () => {
    toast.success(`Exporting Sales Order ${so.soNumber} as PDF…`);
    onClose();
  };

  const handleEmail = () => {
    toast.success(`Emailing Sales Order ${so.soNumber} to customer…`);
    onClose();
  };

  const isDirty = options.some((o, i) => o.enabled !== DEFAULT_OPTIONS[i].enabled);
  const { guardedClose, discardDialog } = useDiscardGuard(isDirty, onClose);
  useModalShortcuts({ onConfirm: handleExport, onClose: guardedClose, confirmDisabled: !open });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: "var(--z-modal)", backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(2px)" }}
      onClick={guardedClose}
    >
      <div
        className="bg-card rounded-xl border border-border"
        style={{
          boxShadow: "var(--elevation-4)",
          width: showOptions ? 1200 : 920,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          transition: "width 300ms ease",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header — Quotes canonical: 32px icon chip (bg-accent), 14px title, 11px muted subtitle, 28px close. */}
        <div className="flex items-center justify-between border-b border-border" style={{ padding: "16px 20px" }}>
          <div className="flex items-center" style={{ gap: 12 }}>
            <div className="rounded-lg bg-accent flex items-center justify-center" style={{ width: 32, height: 32 }}>
              <Download className="text-primary" style={{ width: 16, height: 16 }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", lineHeight: 1, marginBottom: 5 }}>Export Sales Order</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.4 }}>Preview before exporting — customize what's visible</div>
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
          {/* Visibility Settings panel */}
          {showOptions && (
            <div className="border-r border-border overflow-y-auto" style={{ width: 280, flexShrink: 0, padding: "var(--space-card-padding)" }}>
              <div className="flex items-center" style={{ gap: 6, marginBottom: 12 }}>
                <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-foreground" style={{ ...micro }}>VISIBILITY SETTINGS</span>
              </div>
              <div className="text-foreground/50" style={{ ...caption, fontWeight: "var(--font-weight-normal)", marginBottom: 16 }}>
                Choose what your customer will see on this sales order.
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
            </div>
          )}

          {/* Preview area — shared PdfDocument for parity with the
              SendToCustomerModal preview and the Quote-side PDF. */}
          {(() => {
            const showHeader = !!options.find(o => o.key === "header")?.enabled;
            const showTerms = !!options.find(o => o.key === "terms")?.enabled;
            const meta = getHeaderMeta(so);
            const parties = getParties(so);
            const payment = getPaymentInfo(so, grandTotal);
            /* Sum discounts so the totals row shows them explicitly. */
            let totalDiscounts = 0;
            /* Gate live carrier + tracking + delivered/in-transit
               statuses so pre-fulfilment SOs (Draft / Pending Review /
               Cleared) don't claim data they don't have. Only orders
               that have actually started shipping surface those fields. */
            const fulfilmentActive = so.status === "Partially Shipped" || so.status === "Shipped";
            const preFulfilmentStatus = so.status === "Draft" ? "Planned"
              : so.status === "Pending Review" ? "Awaiting approval"
              : so.status === "Cleared" ? "Ready to ship"
              : so.status === "Cancelled" ? "Cancelled"
              : so.status === "Archived" ? "Archived"
              : undefined;
            const items: PdfLineItem[] = activeLines.map((li, idx) => {
              const lineNet = li.orderedQty * li.unitPrice;
              const rules = showPricing ? getLinePricingRules(li.itemCode) : [];
              const linePricingRules: PdfLinePricingRule[] = rules.map(r => ({
                label: r.label,
                kind: r.type,
                percent: r.percent,
                amount: r.type === "discount"
                  ? -(lineNet * r.percent / 100)
                  : (lineNet * r.percent / 100),
              }));
              const rulesDelta = linePricingRules.reduce((s, r) => s + r.amount, 0);
              const discountAmt = linePricingRules
                .filter(r => r.kind === "discount")
                .reduce((s, r) => s + Math.abs(r.amount), 0);
              if (showPricing) totalDiscounts += discountAmt;
              const lineAdj = showAdjustments ? getLineAdjustment(li.itemCode) : null;
              const lineAdjustments: PdfLineAdjustment[] = lineAdj
                ? [{ label: lineAdj.label, amount: lineAdj.amount }]
                : [];
              const adjDelta = lineAdjustments.reduce((s, a) => s + a.amount, 0);
              const ship = getLineShipment(li, idx);
              const comments = showNotes ? getLineComments(li) : null;
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
                /* Line-item `[N]` reference markers dropped — refs are
                   now a plain URL list rendered in the References
                   section, not inline per line. */
                refs: undefined,
              };
            });
            /* Pricing rules apply per line and are already surfaced
               in each item's card breakdown — don't repeat them at
               the order level. `ORDER_PRICING_RULES` is still
               referenced in the totals math above so the grand total
               reconciles with the customer's expected number. */
            void ORDER_PRICING_RULES;
            const adjustments: PdfAdjustment[] = ORDER_ADJUSTMENTS.map(a => ({
              label: a.label,
              amount: a.amount,
              kind: a.amount < 0 ? "discount" : "premium",
            }));
            const data: PdfDocumentData = {
              kind: "so",
              docNumber: `${so.soNumber.replace(/^SO-?/i, "") || so.soNumber}-V${meta.versionNum}`,
              statusLabel: so.status,
              statusTone:
                so.status === "Shipped" ? "success"
                : so.status === "Cancelled" || so.status === "Expired" ? "warning"
                : so.status === "Draft" ? "neutral" : "info",
              brand: { name: "Omne ERP", tagline: "Sales & Order Management" },
              metaLeft: [
                { label: "Order Date", value: meta.orderDate },
                { label: "Customer PO #", value: meta.customerPo },
                { label: "Customer PO Date", value: meta.customerPoDate },
                { label: "Estimated Delivery Date", value: meta.estDelivery },
                { label: "Reference Quote #", value: meta.refQuote },
                { label: "Freight Method", value: so.freightMethod || "Carrier Ship" },
              ],
              metaRight: [
                { label: "Recipient", value: meta.recipient },
                { label: "Effective From", value: meta.effectiveFrom },
                { label: "Sales Person", value: meta.salesPerson },
                { label: "Sales Person Contact", value: meta.salesPersonContact },
                { label: "Payment Terms", value: docPaymentTerms(so) },
                /* Invoice # intentionally omitted — an SO can produce
                   multiple invoices (deposit / milestones / balance)
                   under a single payment schedule, so pinning one
                   invoice number to the SO PDF would misrepresent the
                   billing lifecycle. Invoices reference the SO number,
                   not the other way around. */
              ],
              customer: {
                displayName: parties[0]?.name || so.customer,
                phone: parties[0]?.phone,
                street: parties[0]?.address?.split("\n")[0],
                city: parties[0]?.address?.split("\n").slice(1).join(", "),
              },
              shipTo: {
                displayName: parties[1]?.name || (so.warehouse || "Main Warehouse"),
                phone: parties[1]?.phone,
                street: parties[1]?.address?.split("\n")[0],
                city: parties[1]?.address?.split("\n").slice(1).join(", "),
              },
              billTo: {
                displayName: parties[2]?.name || so.customer,
                phone: parties[2]?.phone,
                street: parties[2]?.address?.split("\n")[0],
                city: parties[2]?.address?.split("\n").slice(1).join(", "),
              },
              items,
              currency: so.currency || "USD",
              unitLabel: "Unit",
              totalItemCount: activeLines.length,
              /* Order-level pricingRules dropped — the customer sees
                 each rule on the line it was applied to. */
              adjustments: showAdjustments && adjustments.length > 0 ? adjustments : undefined,
              paymentMethod: docPaymentMethod(so),
              paymentTerms: docPaymentTerms(so),
              subtotal,
              discountsTotal: showPricing ? totalDiscounts : 0,
              adjustmentsTotal: showAdjustments ? (totalLineAdj + orderAdj) : 0,
              grandTotal,
              notes: showNotes ? [
                "The amount of this Sales Order is the agreed fixed price and shall not be exceeded without advanced written consent from the Bill To contact identified on the order.",
                `Include Sales Order# <strong>${so.soNumber}</strong> and Invoice# in ACH addenda (CCD/CTX) or remittance email.`,
                "Remittance Advice Email: <strong>ap@omne-erp.com</strong>",
                "Important Security information: Banking details on file. We do not accept account changes via email. Verify all payment changes by voice with your account manager.",
              ] : undefined,
              /* References section is populated from the External
                 Links textarea on Deal Information. One URL per line,
                 no `[N]` markers. */
              references: showAttachments ? getExternalLinksList(so.id) : undefined,
              terms: showTerms ? DEFAULT_SO_TERMS : undefined,
              /* Sales Order PDFs omit the signature block — see the
                 SendToCustomerModal comment for the ERP-convention
                 rationale. */
              signature: undefined,
              poweredBy: "Omne ERP",
            };
            const visibility: PdfVisibility = {
              brand: showHeader,
              meta: true,
              addresses: true,
              items: true,
              pricingRules: !!showPricing,
              adjustments: !!showAdjustments,
              payment: true,
              totals: true,
              notes: !!showNotes,
              references: !!showAttachments,
              terms: showTerms,
              signature: false,
            };
            return (
              <div className="flex-1 overflow-auto" style={{ background: "var(--secondary)" }}>
                <PdfDocument data={data} visibility={visibility} />
              </div>
            );
          })()}
        </div>

        {/* ── Footer ── Include-attachments toggle on the left,
            primary + secondary CTAs anchored bottom-right per Partner
            modal chrome. */}
        <div className="flex items-center justify-between border-t border-border" style={{ padding: "12px 20px", gap: 12 }}>
          <label className="flex items-center gap-2 cursor-pointer select-none" title="Include the SO's attachments in the download — they'll be zipped with the PDF.">
            <Switch
              checked={includeAttachments}
              onCheckedChange={setIncludeAttachments}
              aria-label="Include attachments"
            />
            <span className="text-muted-foreground" style={{ fontSize: 12, fontWeight: 500 }}>
              Include attachments
            </span>
          </label>
          <div className="flex items-center" style={{ gap: 8 }}>
            <Button variant="secondary" size="sm" onClick={guardedClose} icon={<X className="w-3.5 h-3.5" />}>
              Cancel <KbdHint keys="Esc" />
            </Button>
            <Button variant="secondary" size="sm" onClick={handleEmail} icon={<Mail className="w-3.5 h-3.5" />}>
              Email to Customer
            </Button>
            <Button variant="primary" size="sm" onClick={handleExport} icon={<Download className="w-3.5 h-3.5" />}>
              Export Sales Order <KbdHint keys="⌘↵" variant="light" />
            </Button>
          </div>
        </div>
        {discardDialog}
      </div>
    </div>
  );
}
