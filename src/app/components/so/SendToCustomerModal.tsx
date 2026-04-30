import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Send, X, Mail, Check, Settings2, Loader2, FileText,
  Download, EyeOff, Printer, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useModalShortcuts, KbdHint } from "./ModalKeyboard";
import { useDiscardGuard } from "./ui/DiscardChangesDialog";
import { Button } from "./ui/Button";
import type { SalesOrder } from "./types";
import {
  DOC_C, getLineShipment, shipStatusColors,
  getLineComments, getLineAttachmentRefs,
  statusBadgeColors, getPaymentInfo, getHeaderMeta, getParties,
} from "./soDocumentData";

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
}

/* ── Currency formatter ── */
function fmtCurrency(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ═══════════════════════════════════════════════
   Main Modal — multi-page PDF preview with page navigation
   ═══════════════════════════════════════════════ */
export function SendToCustomerModal({ isOpen, so, isResend, mode = "send", onClose, onSend }: SendToCustomerModalProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set(MOCK_CONTACTS.filter(c => c.primary).map(c => c.email)));
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = 2;

  const isPrint = mode === "print";

  useEffect(() => {
    if (isOpen) { setSending(false); setSent(false); setShowOptions(false); setOptions(DEFAULT_OPTIONS); setCurrentPage(1); }
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
    setSending(true);
    setTimeout(() => { setSending(false); setSent(true); setTimeout(() => onSend(), 1200); }, 2500);
  }

  const modalTitle = isPrint ? "Print Sales Order" : isResend ? "Resend to Customer" : "Send to Customer";
  const modalSubtitle = isPrint ? "Preview before printing — customize what's visible" : "Preview before sending — customize what's visible";
  const ModalIcon = isPrint ? Printer : Send;

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
                <th key={c.label} style={{ padding: "10px 6px", fontSize: 10, fontWeight: 700, color: DOC_C.muted, textTransform: "uppercase", letterSpacing: "0.05em", width: c.w, textAlign: c.align as any }}>{c.label}</th>
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
              const attRefs = showAttachments ? getLineAttachmentRefs(li) : [];
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
                      {attRefs.length > 0 && (
                        <div style={{ marginTop: 4 }}>
                          {attRefs.map(a => (
                            <a key={a.idx} style={{ display: "inline-block", marginRight: 12, fontSize: 11, color: DOC_C.primary, fontWeight: 600 }}>[{a.idx}] {a.label}</a>
                          ))}
                        </div>
                      )}
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
            <div style={{ fontSize: 12, color: DOC_C.muted, marginBottom: 6 }}>Payment Method: <span style={{ fontWeight: 700, color: DOC_C.fg }}>ACH/Direct Deposit</span></div>
            <div style={{ fontSize: 12, color: DOC_C.muted }}>Payment Terms: <span style={{ fontWeight: 700, color: DOC_C.fg }}>{so.paymentTerms || "Net 30"}</span></div>
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
              Prices are guaranteed for 30 days from quote conversion. Payment terms are <strong style={{ color: DOC_C.fg }}>{so.paymentTerms || "Net 30"}</strong> days from invoice date. A 1.5% late fee will be applied to overdue invoices. Warranty covers defects in material and workmanship for one year. Customer is responsible for shipping costs on warranty returns. Full Terms and Conditions are included on the next page.
            </div>
          </div>
        )}

        {/* References */}
        {showAttachments && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: DOC_C.fg, marginBottom: 6 }}>References</div>
            <div style={{ fontSize: 11, color: DOC_C.primary, lineHeight: 1.7 }}>
              [1] https://pioneer-erp.com/docs/specs.pdf<br />
              [2] https://pioneer-erp.com/docs/certifications.pdf<br />
              [3] https://pioneer-erp.com/docs/drawings.pdf
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
            <li style={{ marginTop: 3 }}><strong>Payment Terms:</strong> {so.paymentTerms || "Net 30"} days from invoice date. 50% deposit due upon order acceptance.</li>
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

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: "var(--z-modal)", backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }} onClick={guardedClose}>

      {/* Sending / Sent overlay — PO-style glassmorphism, combines send + next state */}
      <AnimatePresence>
        {(sending || sent) && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-center justify-center"
            style={{
              backgroundColor: sent
                ? "color-mix(in srgb, var(--accent) 13%, transparent)"
                : "color-mix(in srgb, var(--chart-3) 11%, transparent)",
              backdropFilter: "blur(3px)",
              WebkitBackdropFilter: "blur(3px)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            <motion.div
              className="flex flex-col items-center gap-3 sm:gap-4 px-4 relative"
              initial={{ opacity: 0, scale: 0.9, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: -8 }}
              transition={{ type: "spring", stiffness: 400, damping: 26, mass: 0.85 }}
            >
              {/* Icon circle with glow ring */}
              <motion.div
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 56, height: 56,
                  backgroundColor: sent
                    ? "color-mix(in srgb, var(--accent) 16%, transparent)"
                    : "color-mix(in srgb, var(--chart-3) 13%, transparent)",
                  boxShadow: sent
                    ? "0 0 0 6px color-mix(in srgb, var(--accent) 24%, transparent), 0 4px 20px color-mix(in srgb, var(--accent) 24%, transparent)"
                    : "0 0 0 6px color-mix(in srgb, var(--chart-3) 20%, transparent), 0 4px 20px color-mix(in srgb, var(--chart-3) 20%, transparent)",
                }}
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.08, type: "spring", stiffness: 450, damping: 18, mass: 0.75 }}
              >
                {sent
                  ? <Check className="size-6" style={{ color: "var(--accent)" }} strokeWidth={2.5} />
                  : <Send className="size-6" style={{ color: "var(--chart-3)" }} strokeWidth={2} />
                }
              </motion.div>

              {/* Heading */}
              <motion.h2
                style={{ fontSize: "var(--text-h4)", fontWeight: 600, color: "var(--foreground)", lineHeight: 1.35, letterSpacing: "-0.01em" }}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.14, duration: 0.3 }}
              >
                {sent ? "Sent & Submitted for Review" : "Sending to Customer..."}
              </motion.h2>

              {/* From → To badge row */}
              <motion.div
                className="flex items-center gap-2.5"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, duration: 0.32 }}
              >
                <div className="px-3 py-1.5 rounded-full"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--card) 70%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--border) 60%, transparent)",
                    backdropFilter: "blur(8px)",
                  }}>
                  <span style={{ fontSize: "var(--text-label)", fontWeight: 500, color: "var(--muted-foreground)" }}>Draft</span>
                </div>
                <span className="text-muted-foreground/60" style={{ fontSize: 12 }}>→</span>
                <div className="px-3 py-1.5 rounded-full"
                  style={{
                    backgroundColor: sent
                      ? "color-mix(in srgb, var(--accent) 10%, transparent)"
                      : "color-mix(in srgb, var(--chart-3) 10%, transparent)",
                    border: sent
                      ? "1px solid color-mix(in srgb, var(--accent) 22%, transparent)"
                      : "1px solid color-mix(in srgb, var(--chart-3) 20%, transparent)",
                    backdropFilter: "blur(8px)",
                  }}>
                  <span style={{ fontSize: "var(--text-label)", fontWeight: 600, color: sent ? "var(--accent)" : "var(--chart-3)" }}>
                    {sent ? "Submitted for Review" : "Pending Review"}
                  </span>
                </div>
              </motion.div>

              {/* Progress bar */}
              {!sent && (
                <motion.div
                  className="w-[180px] sm:w-[220px] overflow-hidden"
                  style={{ height: 3, borderRadius: 2, backgroundColor: "color-mix(in srgb, var(--border) 50%, transparent)", marginTop: 4 }}
                  initial={{ opacity: 0, scaleX: 0.6 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ delay: 0.3, duration: 0.25 }}
                >
                  <motion.div
                    style={{ height: "100%", backgroundColor: "var(--chart-3)", borderRadius: 2 }}
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 1.8, ease: "easeInOut" }}
                  />
                </motion.div>
              )}

              {/* Bottom-right: Next State box */}
              <motion.div
                className="absolute -bottom-16 right-0"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.3 }}
              >
                <div className="px-3 py-2 rounded-xl"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--card) 80%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
                    backdropFilter: "blur(8px)",
                  }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Next State</div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--chart-3)" }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--chart-3)" }}>Pending Review</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal */}
      <div className="bg-card rounded-xl border border-border flex flex-col"
        style={{
          boxShadow: "var(--elevation-4)",
          width: showOptions ? 1060 : 780,
          maxWidth: "95vw",
          maxHeight: "90vh",
          transition: "width 300ms ease",
        }}
        onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-border" style={{ padding: "var(--space-card-padding) 20px" }}>
          <div className="flex items-center" style={{ gap: 12 }}>
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <ModalIcon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="text-foreground" style={{ ...captionSemi, fontSize: "var(--text-label)" }}>{modalTitle}</div>
              <div className="text-foreground/50" style={caption}>{modalSubtitle}</div>
            </div>
          </div>
          <div className="flex items-center" style={{ gap: 8 }}>
            <button onClick={() => setShowOptions(!showOptions)}
              className={`flex items-center rounded-lg border transition-colors ${showOptions ? "bg-primary text-primary-foreground border-primary" : "border-border text-foreground/60 hover:bg-secondary"}`}
              style={{ ...caption, gap: 8, padding: "8px 12px" }}>
              {showOptions ? <><EyeOff className="w-3.5 h-3.5" /> Hide Options</> : <><Settings2 className="w-3.5 h-3.5" /> Visibility Options</>}
            </button>
            <button onClick={guardedClose} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-secondary transition-colors">
              <X className="w-4 h-4 text-foreground/50" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Visibility panel */}
          {showOptions && (
            <div className="border-r border-border overflow-y-auto" style={{ width: 280, flexShrink: 0, padding: "var(--space-card-padding)" }}>
              <div className="flex items-center" style={{ gap: 6, marginBottom: 12 }}>
                <Settings2 className="w-3.5 h-3.5 text-foreground/40" />
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
                        <div className="text-foreground/40" style={{ ...caption, fontWeight: "var(--font-weight-normal)" }}>{opt.description}</div>
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
                      <Mail className="w-3.5 h-3.5 text-foreground/40" />
                      <span className="text-foreground" style={micro}>RECIPIENTS</span>
                    </div>
                    <span className="text-foreground/40" style={{ fontSize: 10 }}>{selectedContacts.size} selected</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {MOCK_CONTACTS.map(contact => {
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

          {/* Preview area with page navigation */}
          <div className="flex-1 flex flex-col min-h-0" style={{ background: "var(--secondary)" }}>
            {/* Page indicator + nav arrows */}
            <div className="flex items-center justify-between shrink-0" style={{ padding: "10px 16px 6px" }}>
              <span className="text-foreground/40" style={micro}>PREVIEW</span>
              <div className="flex items-center" style={{ gap: 8 }}>
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center justify-center rounded-md border border-border transition-colors hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ width: 28, height: 28, backgroundColor: "var(--card)" }}
                >
                  <ChevronLeft className="w-4 h-4 text-foreground/60" />
                </button>
                <span className="text-foreground/60" style={{ fontSize: 12, fontWeight: 500, minWidth: 70, textAlign: "center" }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center justify-center rounded-md border border-border transition-colors hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ width: 28, height: 28, backgroundColor: "var(--card)" }}
                >
                  <ChevronRight className="w-4 h-4 text-foreground/60" />
                </button>
              </div>
            </div>

            {/* Page content */}
            <div className="flex-1 overflow-y-auto" style={{ padding: "0 16px 16px" }}>
              <div className="bg-card rounded-lg border border-border" style={{ boxShadow: "var(--elevation-1)", padding: "32px 40px", minHeight: 500 }}>
                {currentPage === 1 ? renderPage1() : renderPage2()}
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between border-t border-border" style={{ padding: "12px 20px" }}>
          <div className="text-foreground/40" style={{ ...caption, fontWeight: "var(--font-weight-normal)" }}>
            {isPrint ? "Visibility changes only affect this printout." : "Changes only affect this export — they won't modify the sales order."}
          </div>
          <div className="flex items-center" style={{ gap: 8 }}>
            <Button variant="secondary" size="sm" onClick={guardedClose} icon={<X className="w-3.5 h-3.5" />}>
              Cancel <KbdHint keys="Esc" />
            </Button>
            {!isPrint && (
              <Button variant="secondary" size="sm" onClick={() => { handleAction(); }} icon={<Mail className="w-3.5 h-3.5" />}>
                Email to Customer
              </Button>
            )}
            <Button variant="success" size="sm" onClick={handleAction}
              disabled={!isPrint && selectedContacts.size === 0}
              icon={isPrint ? <Printer className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}>
              {isPrint ? "Print" : isResend ? "Resend" : "Send to Customer"} <KbdHint keys="⌘↵" variant="light" />
            </Button>
          </div>
        </div>
        {discardDialog}
      </div>
    </div>
  );
}
