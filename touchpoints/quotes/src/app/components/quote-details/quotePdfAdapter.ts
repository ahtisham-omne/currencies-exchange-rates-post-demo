/**
 * quotePdfAdapter — Quote → shared `PdfDocumentData` adapter
 * ──────────────────────────────────────────────────────────
 * Both `PDFPreviewModal` (download / print) and `SendToCustomerModal`
 * (email + preview) render the same shared `<PdfDocument>` template.
 * This adapter is the single source of truth that maps a Quote record
 * + optional detail-page state (contact, addresses, dates) into the
 * template's shape, so both preview surfaces show identical content.
 *
 * Line items are derived deterministically off the quote number when
 * the record itself doesn't carry `items` — same seed → same items,
 * so preview stays stable across renders and page reloads. Each
 * generated line carries a mock pricing rule + one-time adjustment
 * on ~1 in 3 items so the itemised breakdown block on the PDF surfaces
 * WHERE the line total came from.
 */
import {
  DEFAULT_QUOTE_TERMS,
  type PdfDocumentData,
  type PdfLineItem,
  type PdfLinePricingRule,
  type PdfLineAdjustment,
} from "../shared/pdfDocument";
import type { Quote } from "../../types/quote";
import { FIELD_RULES } from "../shared/fieldRequirements";
import { getExternalLinksList } from "../../data/linksRepository";
import { customerCurrency, quoteFx } from "@/app/currency/qFx";

export interface LegacyQuoteInput {
  quoteNumber: string;
  customerName: string;
  version?: number;
  items?: unknown[];
  subtotal?: number;
  tax?: number;
  total?: number;
  status?: string;
  /** The quote's currency; without one the document is in the customer's default. */
  currency?: string;
}

export interface QuotePdfDetail {
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  salesRepName?: string;
  salesRepContact?: string;
  billingAddress?: { line?: string; cityStateZip?: string };
  shippingAddress?: { line?: string; cityStateZip?: string };
  paymentMethod?: string;
  paymentTerms?: string;
  createdDateDisplay?: string;
  expiryDateDisplay?: string;
  requestedDateDisplay?: string;
  deliveryDateDisplay?: string;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
  return Math.abs(h);
}

const ITEM_CODES = ["BP-1001", "RT-2002", "EV-0001", "SP-3003", "TR-EVT1", "MG-4204", "ST-5501", "HD-2210"];
/* Product photo pool — shared with Partner Management's `ITEM_PHOTOS_CELL`
 * (PartnersVendorsListPage.tsx:2001). Auto-manufacturing-adjacent Unsplash
 * photos so PDF thumbnails look like real inventory rather than placeholder
 * initial tiles. Deterministically indexed by item-code hash so a given
 * item always renders with the same image across previews. */
const ITEM_PHOTOS = [
  "https://images.unsplash.com/photo-1772209049802-cd0e0ff1a5d3?w=160&h=160&fit=crop",
  "https://images.unsplash.com/photo-1713575882582-8938739db351?w=160&h=160&fit=crop",
  "https://images.unsplash.com/photo-1737223450913-2af6885945e1?w=160&h=160&fit=crop",
  "https://images.unsplash.com/photo-1759159091728-e2c87b9d9315?w=160&h=160&fit=crop",
  "https://images.unsplash.com/photo-1661069387900-54d5843b704d?w=160&h=160&fit=crop",
  "https://images.unsplash.com/photo-1758873263527-ca53b938fbd4?w=160&h=160&fit=crop",
];
const ITEM_DESCRIPTIONS = [
  "High-performance ceramic brake pad kit ensuring precision braking under extreme temperature and varied loads.",
  "Durable 12-inch slotted brake rotor designed for optimal heat dissipation and consistent performance.",
  "State-of-the-art electric crossover vehicle offering long range, advanced safety features, and luxury cabin.",
  "High-quality spark plug box with twelve units engineered for consistent ignition and improved fuel efficiency.",
  "Electric transit van with spacious cargo area, zero emissions, and advanced driver assistance suite.",
  "Precision-machined aluminum manifold gasket set rated for high-boost forced-induction applications.",
  "Heavy-duty starter motor assembly with reinforced solenoid, tested for cold-start reliability in fleet duty.",
  "Reinforced heavy-duty engine mount bracket kit compatible with commercial delivery-van chassis.",
];
const UOMS = ["Each", "Set", "Palette of roll of 10 of 12", "Box", "Unit"];
const SHIP_METHODS = ["FedEx Express", "Freight Carrier", "UPS Ground", "Customer Pickup"];
const RULE_LABELS = ["Fleet Volume Discount", "Bulk Lighting Discount", "Govt. Contract Premium"];
const ADJUSTMENT_LABELS: { label: string; amount: number }[] = [
  { label: "Chassis prep labor credit", amount: -350 },
  { label: "Extended warranty add-on", amount: 450 },
  { label: "Freight surcharge", amount: 120 },
];

/** Build deterministic mock line items. Same seed → same items, so
 *  every preview render for a given quote is stable. */
export function deriveMockItems(seed: string, subtotal: number): PdfLineItem[] {
  const h = hashString(seed);
  const count = 3 + (h % 6);
  const items: PdfLineItem[] = [];
  const targetTotal = subtotal > 0 ? subtotal : 45000;
  let running = 0;
  for (let i = 0; i < count; i++) {
    const codeIdx = (h + i) % ITEM_CODES.length;
    const descIdx = (h + i * 3) % ITEM_DESCRIPTIONS.length;
    const uomIdx = (h + i * 5) % UOMS.length;
    const shipIdx = (h + i * 7) % SHIP_METHODS.length;
    const qty = 1 + ((h + i * 11) % 8);
    const basePrice = 50 + ((h * 13 + i * 211) % 100000);
    const lineNet = basePrice * qty;

    /* Alternate rules across items so the demo showcases both
       discount and premium chrome. */
    const pricingRules: PdfLinePricingRule[] = [];
    if (i % 3 === 0) {
      const pct = 5 + (i % 4);
      pricingRules.push({
        label: RULE_LABELS[0],
        kind: "discount",
        percent: pct,
        amount: -(lineNet * pct / 100),
      });
    } else if (i % 3 === 1) {
      const pct = 3;
      pricingRules.push({
        label: RULE_LABELS[2],
        kind: "premium",
        percent: pct,
        amount: (lineNet * pct / 100),
      });
    }

    const adjustments: PdfLineAdjustment[] = [];
    if (i % 4 === 0) {
      adjustments.push(ADJUSTMENT_LABELS[i % ADJUSTMENT_LABELS.length]);
    }

    const rulesDelta = pricingRules.reduce((s, r) => s + r.amount, 0);
    const adjDelta = adjustments.reduce((s, a) => s + a.amount, 0);
    const lineTotal = lineNet + rulesDelta + adjDelta;
    running += lineTotal;

    const shipMethod = SHIP_METHODS[shipIdx];
    const isPickup = shipMethod === "Customer Pickup";
    items.push({
      id: `mock-${i}`,
      code: ITEM_CODES[codeIdx],
      description: ITEM_DESCRIPTIONS[descIdx],
      imageUrl: ITEM_PHOTOS[(h + i * 17) % ITEM_PHOTOS.length],
      quantity: qty,
      unitOfMeasure: UOMS[uomIdx],
      unitPrice: basePrice,
      pricingRules: pricingRules.length > 0 ? pricingRules : undefined,
      adjustments: adjustments.length > 0 ? adjustments : undefined,
      lineTotal,
      shipMethod,
      /* Quotes are pre-fulfilment — no carrier assignment, no tracking,
         no shipped/delivered status. The shipping method + projected
         ship-by date + origin location are all a customer sees at the
         quote stage. Tracking + carrier show up once the quote is
         converted to an SO and that SO enters fulfilment. */
      shipFrom: isPickup ? undefined : "Main Warehouse · Westminster, MD",
      shipByDate: `Jan ${1 + ((h + i * 3) % 27)}, 2026`,
      comment: i === 0
        ? "Confirm final finish colour and hardware kit prior to production. Customer requires DOT inspection certificate at delivery."
        : undefined,
      /* Line-item `[N]` reference markers dropped — refs are now a
         plain URL list in the References section from the External
         Links textarea, and the rep inlines a URL in the description
         when they want to point at a specific one. */
      refs: undefined,
    });
  }
  /* Rescale so the sum of line totals matches the record's subtotal
     when the caller supplied one. Keeps the preview total honest. */
  if (subtotal > 0 && running > 0 && Math.abs(running - subtotal) > 0.5) {
    const factor = subtotal / running;
    items.forEach(it => {
      it.unitPrice = Math.round(it.unitPrice * factor * 100) / 100;
      it.lineTotal = Math.round(it.lineTotal * factor * 100) / 100;
      if (it.pricingRules) {
        it.pricingRules = it.pricingRules.map(r => ({ ...r, amount: r.amount * factor }));
      }
      if (it.adjustments) {
        it.adjustments = it.adjustments.map(a => ({ ...a, amount: a.amount * factor }));
      }
    });
  }
  void targetTotal;
  return items;
}

function statusToTone(status: string | undefined): PdfDocumentData["statusTone"] {
  const s = (status || "").toLowerCase();
  if (s.includes("confirmed") || s.includes("won")) return "success";
  if (s.includes("expired") || s.includes("cancelled")) return "warning";
  if (s.includes("draft")) return "neutral";
  return "info";
}

function fmtDate(d: Date | string | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Map a Quote (full or subset) + optional detail-page state into
 * the shared `PdfDocumentData` shape. Pure — no React refs.
 */
export function adaptQuoteToPdfData(
  quote: (Quote | LegacyQuoteInput) | undefined,
  detail: QuotePdfDetail | undefined,
): PdfDocumentData {
  const q = quote ?? {} as Partial<Quote>;
  const isFull = q && "customer" in q;
  const quoteNumber = (q as LegacyQuoteInput).quoteNumber || (q as Quote).quoteNumber || "Q-000-000-000";
  const version = (q as { version?: number }).version ?? 1;
  const customerName = isFull
    ? ((q as Quote).customer?.name || "")
    : ((q as LegacyQuoteInput).customerName || "");
  const status = (q as { status?: string }).status || "Draft";

  const contactName = detail?.contactName || (isFull ? (q as Quote).primaryPoC?.name : undefined) || "";
  const contactPhone = detail?.contactPhone || "";
  const contactEmail = detail?.contactEmail || "";
  const salesRepName = detail?.salesRepName || (isFull ? (q as Quote).salesRep?.name : undefined) || "";
  const salesRepContact = detail?.salesRepContact || "";

  const subtotal = (q as { subtotal?: number }).subtotal ?? (q as Quote).totalValue ?? 0;
  const explicitTotal = (q as { total?: number }).total;
  const explicitTax = (q as { tax?: number }).tax ?? 0;
  const items = deriveMockItems(quoteNumber, subtotal);
  const derivedSubtotal = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
  const derivedGrand = items.reduce((s, it) => s + it.lineTotal, 0);
  const grandTotal = explicitTotal ?? (subtotal + explicitTax) || derivedGrand;

  const totalDiscounts = items.reduce((s, it) => {
    if (!it.pricingRules) return s;
    return s + it.pricingRules
      .filter(r => r.kind === "discount")
      .reduce((sum, r) => sum + Math.abs(r.amount), 0);
  }, 0);
  const totalPremiums = items.reduce((s, it) => {
    if (!it.pricingRules) return s;
    return s + it.pricingRules
      .filter(r => r.kind === "premium")
      .reduce((sum, r) => sum + r.amount, 0);
  }, 0);
  const totalAdjustments = items.reduce((s, it) => {
    if (!it.adjustments) return s;
    return s + it.adjustments.reduce((sum, a) => sum + a.amount, 0);
  }, 0);

  const createdDate = detail?.createdDateDisplay
    || (isFull ? fmtDate((q as Quote).createdDate) : "")
    || fmtDate(new Date());
  const expiryDate = detail?.expiryDateDisplay
    || (isFull ? fmtDate((q as Quote).expiryDate) : "")
    || "";
  const requestedDate = detail?.requestedDateDisplay
    || (isFull ? fmtDate((q as Quote).requestedDate) : "");
  const deliveryDate = detail?.deliveryDateDisplay || "";

  const billing = detail?.billingAddress;
  const shipping = detail?.shippingAddress || detail?.billingAddress;
  /* `detail` passes '' for a field that is explicitly not set on the
     quote; that renders the field's empty label. `undefined` (no
     detail at all) keeps the legacy document defaults. */
  const termsLine = detail?.paymentTerms !== undefined
    ? (detail.paymentTerms || FIELD_RULES.paymentTerms.emptyLabel)
    : "Net 30";
  const methodLine = detail?.paymentMethod !== undefined
    ? (detail.paymentMethod || FIELD_RULES.paymentMethod.emptyLabel)
    : "ACH / Direct Deposit";

  return {
    kind: "quote",
    docNumber: `${quoteNumber}-V${version}`,
    statusLabel: status,
    statusTone: statusToTone(status),
    brand: {
      name: "Omne ERP",
      tagline: "Sales & Order Management",
    },
    metaLeft: [
      { label: "Order Date", value: createdDate },
      { label: "Estimated Delivery Date", value: deliveryDate || requestedDate || "TBD" },
      /* Version + draft date live in the header subtitle already,
         so we don't repeat them in the meta grid. Only the draft
         date is surfaced here as a standalone data point. */
      { label: "Version Draft Date", value: createdDate },
      { label: "Freight Method", value: "Carrier Ship" },
    ],
    metaRight: [
      { label: "Recipient", value: contactName || FIELD_RULES.poc.emptyLabel },
      { label: "Effective From", value: createdDate },
      { label: "Valid Till", value: expiryDate || "—" },
      { label: "Sales Person", value: salesRepName || FIELD_RULES.salesRep.emptyLabel },
      { label: "Sales Person Contact", value: salesRepContact || "—" },
    ],
    customer: {
      displayName: customerName || "Customer",
      street: billing?.line,
      city: billing?.cityStateZip,
      phone: contactPhone,
    },
    shipTo: {
      displayName: customerName || "Customer",
      street: shipping?.line ?? FIELD_RULES.shipTo.emptyLabel,
      city: shipping?.cityStateZip,
      phone: contactPhone,
      email: contactEmail,
    },
    billTo: {
      displayName: customerName || "Customer",
      street: billing?.line ?? FIELD_RULES.billTo.emptyLabel,
      city: billing?.cityStateZip,
      email: contactEmail,
    },
    items,
    /* The quote's currency (spec 4.3): the document prints in it. */
    currency: (q as { currency?: string }).currency || (isFull ? quoteFx(q as Quote).currency : customerCurrency(customerName)),
    unitLabel: "Unit",
    totalItemCount: items.length,
    paymentMethod: methodLine,
    paymentTerms: termsLine,
    subtotal: derivedSubtotal || subtotal,
    discountsTotal: totalDiscounts,
    premiumsTotal: totalPremiums,
    adjustmentsTotal: totalAdjustments,
    grandTotal: derivedGrand || grandTotal,
    notes: [
      "The amount of this Quote is the agreed fixed price and shall not be exceeded without advanced written consent from the Bill To contact identified on the order.",
      `Include Quote# <strong>${quoteNumber}</strong> and Invoice# in ACH addenda (CCD/CTX) or remittance email.`,
      "Remittance Advice Email: <strong>ap@omne-erp.com</strong>",
      "Important Security information: Banking details on file. We do not accept account changes via email. Verify all payment changes by voice with your account manager.",
    ],
    /* References section is populated from the External Links textarea
       on Deal Information. One URL per line, no `[N]` markers. Fallback
       to an empty list so the section collapses when nothing's pasted. */
    references: getExternalLinksList(quoteNumber),
    terms: DEFAULT_QUOTE_TERMS,
    signature: {
      heading: "I acknowledge and agree to the terms listed above",
      body: "By signing below, the customer confirms acceptance of the pricing, delivery, and terms stated in this quote. This document becomes a binding contract upon signature. Signed copies may be returned by email to the sales person listed above.",
      slotCount: 1,
    },
    poweredBy: "Omne ERP",
  };
}
