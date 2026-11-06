import type { ImportRecord } from "./importModel";
import type { Quote, QuoteStatus, Priority, LineItem } from "@/app/types/quote";
import type { CreatedLineItem } from "@/app/data/quoteStore";
import { ITEM_BY_CODE, priceListPrice } from "./importCatalog";
import { parseAdjustment } from "./importParse";
import { toModuleAdjustments, type ModuleAdjustment } from "./importAdjustments";
import { MOCK_CUSTOMERS, MOCK_CONTACTS } from "@/app/components/quote-creation/Step1CustomerSelection";
import { SALES_REP_ROSTER, CURRENT_USER_REP } from "@/app/components/shared/salesRepRoster";
import { getLineItemImage } from "@/app/data/lineItemImage";

/**
 * Turning a reviewed import row into a real quote.
 *
 * Up to here the importer has only ever dealt in strings: the sheet's
 * own values, checked against the modules they point at. This is where
 * a record stops being a row and becomes a `Quote` the listing and the
 * detail page can open, built the same way the create-quote flow builds
 * one (`handleQuoteCreated` in QuotesListPage) so an imported quote and
 * a hand-made one are the same kind of object.
 *
 * Two things stay deliberately faithful to the file rather than to our
 * own conventions:
 *
 *   · the quote NUMBER is the legacy number, not a freshly generated
 *     one. Someone importing five years of history needs to find the
 *     quote by the number their old system printed on it.
 *   · the STATUS is the status the file claims. A legacy quote that was
 *     sent and confirmed years ago should not land as a fresh Draft.
 *
 * Everything the file does not carry is left empty rather than invented,
 * so the detail page shows real gaps instead of plausible fiction.
 */

/** What the header pill needs to explain where a record came from. */
export interface LegacyImportMeta {
  importedAt: string;
  /** The run's description, when the person naming it gave one. */
  importName?: string;
  fileName?: string;
  /** The row numbers this quote was assembled from, first row first. */
  sourceRows: number[];
  /** The number the legacy system used, kept even if the record is renumbered. */
  sourceKey: string;
}

/* The sheet carries the module's own status LABELS; the record stores the
   state behind them. "Confirmed by Customer" is `Unconfirmed SO` and
   "Converted to SO" is `Confirmed SO`, exactly as the badge maps them. A few
   legacy synonyms are tolerated on the way in, though the sheet's dropdown
   only ever offers the real labels. */
const STATUS_MAP: Record<string, QuoteStatus> = {
  "draft": "Draft",
  "sent to customer": "Sent to Customer",
  "confirmed by customer": "Unconfirmed SO",
  "converted to so": "Confirmed SO",
  "expired": "Expired",
  "rejected": "Rejected",
  "cancelled": "Cancelled",
  "archived": "Archived",
  /* legacy wording */
  "sent": "Sent to Customer",
  "confirmed": "Unconfirmed SO",
};

/* The module holds three priorities. Legacy files often carry four, so
   Medium lands on Standard and Critical rides with High rather than
   inventing a fourth pill. */
const PRIORITY_MAP: Record<string, Priority> = {
  low: "Low", medium: "Standard", standard: "Standard", high: "High", critical: "High",
};

function parseDate(raw: string | undefined): Date | undefined {
  const v = (raw ?? "").trim();
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** `Label:-2%` and `Label:+2400` both land here. Percentages scale the
 *  base, absolutes shift it; anything unparseable is left alone. */
function applyAdjustments(base: number, raw: string | undefined): number {
  const list = (raw ?? "").split("|").map((s) => s.trim()).filter(Boolean);
  let out = base;
  for (const entry of list) {
    const parsed = parseAdjustment(entry);
    if (!parsed) continue;
    const num = parseFloat(parsed.value.replace(/[+,]/g, ""));
    if (Number.isNaN(num)) continue;
    out += parsed.value.includes("%") ? out * (num / 100) : num;
  }
  return out;
}

function splitList(raw: string | undefined): string[] {
  return (raw ?? "").split("|").map((s) => s.trim()).filter(Boolean);
}

export interface MaterializedQuote {
  quote: Quote;
  lineItems: CreatedLineItem[];
  /** One-time discounts and premiums from both template levels, in the
   *  shape `useAdjustments` seeds from on the detail page. */
  adjustments: ModuleAdjustment[];
}

export function materializeQuote(
  record: ImportRecord,
  meta: Omit<LegacyImportMeta, "sourceRows" | "sourceKey">,
  index = 0,
): MaterializedQuote {
  const v = record.values;
  /* A row with no number of its own still gets one in the module's own
     format. Nothing in the number marks it as legacy: that is the header
     pill's job, so an imported quote reads like any other quote. */
  const quoteNumber = (v.quoteNo ?? "").trim() || `Q-000-000-${String(901 + index).padStart(3, "0")}`;
  const id = `quote-import-${quoteNumber.replace(/[^A-Za-z0-9]/g, "")}`;

  /* Customer: the file gives a name, the module owns the record. A name
     that resolved during review will be found here; one that did not
     still shows on the quote, so the gap stays visible. */
  const customerName = (v.customerName ?? "").trim();
  const customer = MOCK_CUSTOMERS.find((c) => c.name.toLowerCase() === customerName.toLowerCase());
  /* Delivery Location arrives as "Customer > Location" (the template's
     own notation), so the location half is what belongs on the quote. */
  const locationName = (v.deliveryLocation ?? "").split(">").pop()?.trim();

  const contactName = (v.primaryContact ?? "").trim();
  const contact = MOCK_CONTACTS.find((c: any) => c.name.toLowerCase() === contactName.toLowerCase());

  const repName = (v.salesRep ?? "").trim();
  const rep = SALES_REP_ROSTER.find(
    (r) => r.name.toLowerCase() === repName.toLowerCase() || r.email.toLowerCase() === repName.toLowerCase(),
  );

  const items: LineItem[] = [];
  const created: CreatedLineItem[] = [];
  record.lines.forEach((line, i) => {
    const lv = line.values;
    const code = (lv.lineItem ?? "").trim();
    const catalogRow = ITEM_BY_CODE[code];
    const qty = parseFloat((lv.lineQuantity ?? "").trim()) || 0;
    const priced = parseFloat((lv.linePricePerUnit ?? "").trim());
    const unitPrice = Number.isNaN(priced) ? (priceListPrice(code) ?? 0) : priced;
    /* Lines stay raw. One-time adjustments are a separate layer the
       module's own adjustments engine applies (percentages resolve
       against each line's own subtotal), so folding them into the line
       total here would double-count them on the detail page. */
    const entry: CreatedLineItem = {
      id: `li-${id}-${i}`,
      productId: code,
      name: catalogRow?.name ?? code,
      description: (lv.lineDescription ?? "").trim() || catalogRow?.description || "",
      quantity: qty,
      unitPrice,
      discount: 0,
      total: qty * unitPrice,
      image: getLineItemImage(code),
    };
    created.push(entry);
    items.push({ ...entry, uom: (lv.lineUnitOfMeasure ?? "").trim() || undefined });
  });

  const linesTotal = items.reduce((s, l) => s + l.total, 0);
  /* The listing figure is a snapshot that includes both adjustment
     levels, so the value column agrees with the detail page's grand
     total the moment the quote lands. */
  const adjustments = toModuleAdjustments(record, (li) => `li-${id}-${li}`, `ADJ-${index}`);
  const totalValue = adjustments.reduce((sum, a) => {
    const base = a.scope === "item"
      ? items.filter((l) => (a.appliedTo ?? []).includes(l.id)).reduce((s2, l) => s2 + l.total, 0)
      : linesTotal;
    const magnitude = a.amountType === "%" ? base * (a.amount / 100) : a.amount;
    return sum + (a.type === "discount" ? -magnitude : magnitude);
  }, linesTotal);

  const requested = parseDate(v.requestedOn);
  const expiry = parseDate(v.expirationDate);
  const now = new Date();

  const quote: Quote = {
    id,
    quoteNumber,
    version: 1,
    status: STATUS_MAP[(v.quoteStatus ?? "").trim().toLowerCase()] ?? "Draft",
    priority: PRIORITY_MAP[(v.priority ?? "").trim().toLowerCase()] ?? "Standard",
    customer: {
      id: customer?.id ?? "cust-legacy",
      name: customerName,
      location: locationName ? { name: locationName, isPrimary: true } : undefined,
    },
    primaryPoC: contact
      ? { id: contact.id, name: contact.name, email: contact.email, phone: contact.phone, role: contact.title, isPrimary: true }
      : { id: `poc-legacy-${index}`, name: contactName, email: "", isPrimary: true },
    additionalPoCs: splitList(v.secondaryContacts).map((name, i) => {
      const match = MOCK_CONTACTS.find((c: any) => c.name.toLowerCase() === name.toLowerCase());
      return {
        id: match?.id ?? `poc-legacy-${index}-${i}`,
        name,
        email: match?.email ?? "",
        phone: match?.phone,
        role: match?.title,
        isPrimary: false,
      };
    }),
    salesRep: rep
      ? { id: rep.id, name: rep.name, email: rep.email }
      : { id: "rep-legacy", name: repName || "Unassigned", email: "" },
    additionalSalesReps: splitList(v.secondarySalesReps).map((name, i) => {
      const match = SALES_REP_ROSTER.find((r) => r.name.toLowerCase() === name.toLowerCase());
      return { id: match?.id ?? `rep-legacy-${index}-${i}`, name, email: match?.email ?? "" };
    }),
    totalValue,
    /* The legacy dates are the record's real dates. Only the import
       timestamp is ours, and it goes on the pill, not on the quote. */
    createdDate: requested ?? now,
    expiryDate: expiry ?? requested ?? now,
    requestedDate: requested,
    respondBy: parseDate(v.respondBy),
    lastUpdated: now,
    hasUnreadMessages: false,
    unreadMessageCount: 0,
    daysInCurrentStage: 0,
    tags: splitList(v.tags),
    winProbability: (() => {
      const n = parseFloat((v.winProbability ?? "").trim());
      return Number.isNaN(n) ? undefined : n;
    })(),
    description: (v.externalNotes ?? "").trim(),
    items,
    subtotal: linesTotal,
    total: totalValue,
    legacyImport: { ...meta, sourceRows: record.sourceRows, sourceKey: quoteNumber },
  };

  return { quote, lineItems: created, adjustments };
}
