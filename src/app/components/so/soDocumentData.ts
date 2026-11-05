/* ═══════════════════════════════════════════════════════════════
   Shared data + helpers for the Sales Order document
   (used by PrintSalesOrder + SendToCustomerModal preview)
   ═══════════════════════════════════════════════════════════════ */

import type { SalesOrder, SOLine } from "./types";
import { FIELD_RULES, isMissing } from "@/app/components/shared/fieldRequirements";
import { isSparseCustomer } from "@/app/components/shared/customerDefaults";

export const DOC_C = {
  bg: "#ffffff",
  fg: "#1F2937",
  muted: "#6B7280",
  mutedSoft: "#9CA3AF",
  border: "#E5E7EB",
  panelBg: "#F3F4F6",
  panelBgSoft: "#F9FAFB",
  primary: "#0a77ff",
  accent: "#27b973",
  destructive: "#DC2626",
  green: "#059669",
  greenBg: "#D1FAE5",
  greenFg: "#065F46",
  amberBg: "#FEF3C7",
  amberFg: "#92400E",
  blueBg: "#DBEAFE",
  blueFg: "#1E40AF",
  grayBg: "#F3F4F6",
  grayFg: "#4B5563",
  headerBg: "#111827",
};

export function fmtCurrency(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ── Per-line mock metadata (consistent across print + preview) ── */

export type LineShipStatus = "DELIVERED" | "IN TRANSIT" | "SHIPPED" | "IN PRODUCTION" | "CONFIRMED";

export interface LineShipmentInfo {
  status: LineShipStatus;
  carrier: string;
  tracking: string;
  etaLabel: string;   // "Delivered: Jan 17, 2025" or "ETA: Mar 1, 2025"
  shipMethod: string;
  shipBy: string;
}

/** Stable per-line shipment metadata seeded from itemCode */
export function getLineShipment(line: SOLine, idx: number): LineShipmentInfo {
  const isFreight = line.itemCode.includes("EV-") || line.itemCode.includes("TR-");
  const shipMethod = isFreight ? "Freight Carrier" : "FedEx Express";
  const shipBy = isFreight ? "Mar 1, 2025" : "Jan 15, 2025";

  // Round-robin pseudo-status by index so we get a realistic mix
  const statuses: LineShipStatus[] = ["DELIVERED", "IN TRANSIT", "IN PRODUCTION", "DELIVERED", "SHIPPED", "DELIVERED", "CONFIRMED"];
  let status: LineShipStatus = statuses[idx % statuses.length];
  if (isFreight && status !== "IN PRODUCTION" && status !== "CONFIRMED") status = idx % 2 === 0 ? "IN PRODUCTION" : "CONFIRMED";

  const carrier = isFreight ? "Estes Forwarding (LTL)" : "FedEx Express";
  let tracking = `7712-3456-${7890 + idx}`;
  let etaLabel = `ETA: Jan ${15 + idx}, 2025`;

  switch (status) {
    case "DELIVERED":
      etaLabel = `Delivered: Jan ${16 + idx}, 2025`;
      break;
    case "IN TRANSIT":
    case "SHIPPED":
      etaLabel = `ETA: Jan ${18 + idx}, 2025`;
      break;
    case "IN PRODUCTION":
    case "CONFIRMED":
      tracking = "Awaiting BOL";
      etaLabel = "ETA: Mar 1, 2025";
      break;
  }

  return { status, carrier, tracking, etaLabel, shipMethod, shipBy };
}

export function shipStatusColors(status: LineShipStatus): { bg: string; fg: string } {
  switch (status) {
    case "DELIVERED": return { bg: DOC_C.greenBg, fg: DOC_C.greenFg };
    case "IN TRANSIT": return { bg: DOC_C.amberBg, fg: DOC_C.amberFg };
    case "SHIPPED": return { bg: DOC_C.blueBg, fg: DOC_C.blueFg };
    case "IN PRODUCTION":
    case "CONFIRMED":
      return { bg: DOC_C.grayBg, fg: DOC_C.grayFg };
  }
}

export function getLineComments(line: SOLine): string | null {
  if (line.itemCode.includes("001") || line.itemCode.includes("EVT")) return line.itemName;
  return null;
}

export function getLineAttachmentRefs(line: SOLine): { idx: number; label: string }[] {
  if (line.itemCode.includes("001")) return [{ idx: 1, label: "Specifications" }, { idx: 2, label: "ISO Certifications" }];
  return [];
}

export function getLinePricingRules(itemCode: string): { label: string; type: "discount" | "premium"; percent: number }[] {
  const rules: { label: string; type: "discount" | "premium"; percent: number }[] = [];
  if (itemCode.includes("001") || itemCode.includes("002")) rules.push({ label: "Fleet Volume Discount", type: "discount", percent: 5 });
  if (itemCode.includes("049") || itemCode.includes("059")) rules.push({ label: "Govt. Contract Premium", type: "premium", percent: 3 });
  return rules;
}

/* ── Status badge for the header ── */
export function statusBadgeColors(s: string): { bg: string; fg: string } {
  const map: Record<string, { bg: string; fg: string }> = {
    Draft: { bg: "#F3F4F6", fg: "#4B5563" },
    "Pending Review": { bg: "#FEF3C7", fg: "#92400E" },
    Cleared: { bg: "#D1FAE5", fg: "#065F46" },
    "Partially Shipped": { bg: "#FEF3C7", fg: "#92400E" },
    Shipped: { bg: "#D1FAE5", fg: "#065F46" },
    Cancelled: { bg: "#FEE2E2", fg: "#991B1B" },
    Archived: { bg: "#FEE2E2", fg: "#991B1B" },
  };
  return map[s] || map.Draft;
}

/* ── Payment data (mock to match reference docx) ── */
export interface PaymentInfo {
  status: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amountInvoiced: number;
  amountPaid: number;
  paidLabel: string;
}

export function getPaymentInfo(so: SalesOrder, total: number): PaymentInfo {
  return {
    status: "INVOICED — PARTIAL PAYMENT RECEIVED",
    invoiceNumber: `INV-${so.soNumber.replace(/^SO-/, "")}`,
    invoiceDate: "January 5, 2025",
    dueDate: "February 4, 2025  (Net 30)",
    amountInvoiced: total,
    amountPaid: total / 2,
    paidLabel: "Amount Paid (50% Deposit — Jan 4, 2025)",
  };
}

/* ── Header meta fields shown in the top details grid ── */
export interface HeaderMeta {
  orderDate: string;
  estDelivery: string;
  refQuote: string;
  versionNum: number;
  versionDraftDate: string;
  customerPo: string;
  customerPoDate: string;
  recipient: string;
  effectiveFrom: string;
  salesPerson: string;
  salesPersonContact: string;
}

export function getHeaderMeta(so: SalesOrder): HeaderMeta {
  return {
    orderDate: so.orderDate || so.createdDate,
    estDelivery: so.requestedDeliveryDate || "March 15, 2025",
    refQuote: so.sourceQuoteRef || "312627  (Dec 30, 2024)",
    versionNum: so.version?.number ?? 1,
    versionDraftDate: so.version?.date || so.createdDate,
    customerPo: "PO-EBG-241230-1187",
    customerPoDate: "January 3, 2025",
    recipient: docRecipient(so),
    effectiveFrom: `${so.orderDate || so.createdDate} · 09:14:00 AM`,
    salesPerson: so.salesRep || FIELD_RULES.salesRep.emptyLabel,
    salesPersonContact: so.salesRep ? "+1 (844)-372-8267" : "",
  };
}

/* ── Party blocks (Customer / Ship To / Bill To) ── */
export interface Party {
  title: string;
  name: string;
  phone: string;
  address: string;
  extra?: { label: string; value: string }[];
}

/* ── Record-backed document values ──
   Every document (print, export, send preview) reads these, so an
   empty field shows the same FIELD_RULES empty label everywhere
   instead of a hardcoded demo value. `undefined` (older mock records
   that predate a field) keeps the previous demo value. */
function docAddress(raw: string | undefined, legacy: string): string {
  if (raw === undefined) return legacy;
  if (isMissing(raw)) return "";
  const [street, ...rest] = raw.split(",").map((p) => p.trim());
  return rest.length ? `${street}\n${rest.join(", ")}` : street;
}

export function docPaymentTerms(so: SalesOrder): string {
  return isMissing(so.paymentTerms) ? FIELD_RULES.paymentTerms.emptyLabel : so.paymentTerms;
}

export function docPaymentMethod(so: SalesOrder): string {
  if (so.paymentMethod === undefined) return "ACH / Direct Deposit";
  return isMissing(so.paymentMethod) ? FIELD_RULES.paymentMethod.emptyLabel : so.paymentMethod;
}

/** Sentence for the terms paragraph; reads correctly when terms are empty. */
export function docPaymentTermsSentence(so: SalesOrder): string {
  return isMissing(so.paymentTerms)
    ? "Payment terms have not been set for this order."
    : `Payment terms are ${so.paymentTerms} days from invoice date.`;
}

function docRecipient(so: SalesOrder): string {
  if (so.pocs === undefined) return so.salesReps?.find(r => r.primary)?.name || "Sherry Brown";
  const primary = so.pocs.find(p => p.id === so.primaryPocId) ?? so.pocs.find(p => p.isPrimary) ?? so.pocs[0];
  return primary?.name || FIELD_RULES.poc.emptyLabel;
}

export function getParties(so: SalesOrder): Party[] {
  const sparse = isSparseCustomer(so.customer);
  const shipTo = docAddress(so.shippingAddress, "1231 Tech Ct, Westminster\nMD 21157\nUnited States");
  const billTo = docAddress(so.billingAddress, "1234 Elmwood Drive Apt 5B, San Mateo\nCA 94401\nUnited States");
  return [
    {
      title: "CUSTOMER",
      name: so.customer,
      phone: sparse ? "" : "+1 (866) 590-2588",
      address: sparse ? FIELD_RULES.customerAddress.emptyLabel : "45-02 Northern Blvd, Long Island City\nNY 11101\nUnited States",
    },
    {
      title: "SHIP TO",
      name: shipTo ? (so.warehouse || "Main Warehouse") : so.customer,
      phone: shipTo ? "+1 (844)-372-8267" : "",
      address: shipTo || FIELD_RULES.shipTo.emptyLabel,
      extra: [
        { label: "Carrier", value: "FedEx Express" },
        { label: "Tracking #", value: "7712-3456-7890" },
      ],
    },
    {
      title: "BILL TO",
      name: so.customer,
      phone: billTo ? "+1 (412) 456-6879" : "",
      address: billTo || FIELD_RULES.billTo.emptyLabel,
    },
  ];
}

/* Product photo pool for the PDF's per-item thumbnails. Same
 * Unsplash catalogue used by Partner Management's item cells so
 * previews across modules read as a family. Deterministically
 * indexed off the item code so the same code always renders with
 * the same photo. */
const ITEM_PHOTOS = [
  "https://images.unsplash.com/photo-1772209049802-cd0e0ff1a5d3?w=160&h=160&fit=crop",
  "https://images.unsplash.com/photo-1713575882582-8938739db351?w=160&h=160&fit=crop",
  "https://images.unsplash.com/photo-1737223450913-2af6885945e1?w=160&h=160&fit=crop",
  "https://images.unsplash.com/photo-1759159091728-e2c87b9d9315?w=160&h=160&fit=crop",
  "https://images.unsplash.com/photo-1661069387900-54d5843b704d?w=160&h=160&fit=crop",
  "https://images.unsplash.com/photo-1758873263527-ca53b938fbd4?w=160&h=160&fit=crop",
];

export function getItemPhoto(itemCode: string): string {
  let h = 0;
  for (let i = 0; i < itemCode.length; i++) {
    h = itemCode.charCodeAt(i) + ((h << 5) - h);
  }
  return ITEM_PHOTOS[Math.abs(h) % ITEM_PHOTOS.length];
}
