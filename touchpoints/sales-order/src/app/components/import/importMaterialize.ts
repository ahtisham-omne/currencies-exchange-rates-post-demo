import type { ImportRecord } from "./importModel";
import type { SalesOrder, SOLine, SOStatus, SOPriority, ItemType } from "@/app/components/so/types";
import { ITEM_BY_CODE, priceListPrice } from "./importCatalog";
import { parseAdjustment } from "./importParse";
import { toModuleAdjustments, type ModuleAdjustment } from "./importAdjustments";
import { MOCK_CUSTOMERS } from "@/app/components/so/CreateSOModal";

/**
 * Turning a reviewed import row into a real sales order.
 *
 * Up to here the importer has only ever dealt in strings: the sheet's own
 * values, checked against the modules they point at. This is where a
 * record stops being a row and becomes a `SalesOrder` the listing and the
 * detail page can open, shaped as the `Partial<SalesOrder>` that
 * `store.createSO` already takes from the in-app creation flow, so an
 * imported order and a hand-made one are the same kind of object.
 *
 * Two things stay deliberately faithful to the file rather than to our
 * own conventions:
 *
 *   · the SO NUMBER is the legacy number, not a freshly generated one.
 *     Someone importing years of history needs to find the order by the
 *     number their old system printed on it.
 *   · the STATUS is the status the file claims. An order that shipped
 *     long ago should not land as a fresh Draft.
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
  /** The row numbers this order was assembled from, first row first. */
  sourceRows: number[];
  /** The number the legacy system used, kept even if the record is renumbered. */
  sourceKey: string;
}

/* The sheet carries the module's own status LABELS; the record stores the
   state behind them. "Released" is `Cleared`, exactly as `SO_STATUS_DISPLAY`
   maps it. A couple of legacy synonyms are tolerated on the way in, though
   the sheet's dropdown only ever offers the real labels. */
const STATUS_MAP: Record<string, SOStatus> = {
  "draft": "Draft",
  "pending review": "Pending Review",
  "released": "Cleared",
  "rejected": "Rejected",
  "partially shipped": "Partially Shipped",
  "shipped": "Shipped",
  "partially cancelled": "Partially Cancelled",
  "cancelled": "Cancelled",
  "archived": "Archived",
  /* legacy wording */
  "cleared": "Cleared",
  "open": "Draft",
};

/* The module holds three priorities. Legacy files often carry four, so
   Medium lands on Standard and Critical rides with High rather than
   inventing a fourth pill. */
const PRIORITY_MAP: Record<string, SOPriority> = {
  low: "Low", medium: "Standard", standard: "Standard", high: "High", critical: "High",
};

/** SO dates are stored as YYYY/MM/DD strings, not Date objects. */
function toSODate(raw: string | undefined): string {
  const v = (raw ?? "").trim();
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0].replace(/-/g, "/");
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

function initialsOf(name: string): string {
  return name.split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export interface MaterializedSO {
  partial: Partial<SalesOrder>;
  /** The number and status the file claims, applied after creation. */
  soNumber: string;
  status: SOStatus;
  /** One-time discounts and premiums from both template levels, in the
   *  shape `useAdjustments` seeds from on the detail page. */
  adjustments: ModuleAdjustment[];
}

export function materializeSO(
  record: ImportRecord,
  meta: Omit<LegacyImportMeta, "sourceRows" | "sourceKey">,
  index = 0,
): MaterializedSO {
  const v = record.values;
  /* A row with no number of its own still gets one in the module's own
     format. Nothing in the number marks it as legacy: that is the header
     pill's job, so an imported order reads like any other order. */
  const soNumber = (v.soNumber ?? "").trim() || `SO-000-000-${String(901 + index).padStart(3, "0")}`;

  /* Customer: the file gives a name, the module owns the record. A name
     that resolved during review will be found here; one that did not
     still shows on the order, so the gap stays visible. */
  const customerName = (v.customerName ?? "").trim();
  const customer = MOCK_CUSTOMERS.find((c: any) => c.name.toLowerCase() === customerName.toLowerCase());

  /* Delivery Location arrives as "Customer > Location" (the template's
     own notation); the location half is the ship-to. */
  const locationName = (v.deliveryLocation ?? "").split(">").pop()?.trim() ?? "";

  const contactName = (v.primaryContact ?? "").trim();
  const allPocs: any[] = (customer as any)?.pocs ?? [];
  const primary = allPocs.find((p) => p.name.toLowerCase() === contactName.toLowerCase());
  const secondaryNames = splitList(v.secondaryContacts);
  const pocs = [
    ...(primary
      ? [{ ...primary, isPrimary: true }]
      : contactName
        ? [{ id: `P-LEG-${index}`, name: contactName, email: "", initials: initialsOf(contactName), title: "", isPrimary: true }]
        : []),
    ...secondaryNames.map((name, i) => {
      const match = allPocs.find((p) => p.name.toLowerCase() === name.toLowerCase());
      return match
        ? { ...match, isPrimary: false }
        : { id: `P-LEG-${index}-${i}`, name, email: "", initials: initialsOf(name), title: "", isPrimary: false };
    }),
  ].map((p) => ({
    id: p.id, name: p.name, email: p.email ?? "", phone: p.phone,
    initials: p.initials ?? initialsOf(p.name), title: p.title ?? p.role ?? "", isPrimary: !!p.isPrimary,
  }));

  const repName = (v.salesRep ?? "").trim();
  const secondaryReps = splitList(v.secondarySalesReps);

  const lines: SOLine[] = record.lines.map((line, i) => {
    const lv = line.values;
    const code = (lv.lineItem ?? "").trim();
    const row = ITEM_BY_CODE[code];
    const qty = parseFloat((lv.lineQuantity ?? "").trim()) || 0;
    const priced = parseFloat((lv.linePricePerUnit ?? "").trim());
    const unitPrice = Number.isNaN(priced) ? (priceListPrice(code) ?? 0) : priced;
    /* Lines stay raw. One-time adjustments are a separate layer the
       module's own adjustments engine applies (percentages resolve
       against each line's own subtotal), so folding them into the unit
       price here would double-count them on the detail page. */
    return {
      id: `SOL-LEG-${soNumber.replace(/[^A-Za-z0-9]/g, "")}-${i}`,
      itemCode: code,
      itemName: row?.name ?? code,
      itemType: ((row?.type as ItemType) ?? "Non-Serialized"),
      warehouse: "Main Warehouse",
      orderedQty: qty,
      allocatedQty: 0, pickedQty: 0, shippedQty: 0, deliveredQty: 0,
      unitPrice,
      uom: (lv.lineUnitOfMeasure ?? "").trim() || "EA",
      taxRate: 0.08,
      allocations: [],
      cancelled: false, cancelledQty: 0, readyToPick: false,
    };
  });

  const partial: Partial<SalesOrder> = {
    soNumber,
    customer: customerName,
    customerInitials: (customer as any)?.initials ?? initialsOf(customerName),
    customerId: (customer as any)?.id,
    pocs: pocs as any,
    primaryPocId: pocs.find((p) => p.isPrimary)?.id,
    /* The legacy dates are the record's real dates. Only the import
       timestamp is ours, and it goes on the pill, not on the order. */
    orderDate: toSODate(v.requestedOn) || undefined,
    requestedDeliveryDate: toSODate(v.deliveryDate),
    currency: (v.currencyCode ?? "").trim() || "USD",
    paymentTerms: (v.paymentTerms ?? "").trim() || "Net 30",
    shippingAddress: locationName || (customer as any)?.address || "",
    description: (v.externalNotes ?? "").trim(),
    internalNotes: (v.internalNotes ?? "").trim(),
    lines,
    salesRep: repName || undefined,
    salesReps: [
      ...(repName ? [{ name: repName, primary: true }] : []),
      ...secondaryReps.map((name) => ({ name, primary: false })),
    ],
    priority: PRIORITY_MAP[(v.priority ?? "").trim().toLowerCase()] ?? "Standard",
    tags: splitList(v.tags),
    sourceQuoteRef: (v.sourceQuoteNo ?? "").trim(),
    rfqRef: (v.rFQRFPID ?? "").trim(),
    legacyImport: { ...meta, sourceRows: record.sourceRows, sourceKey: soNumber },
  };

  return {
    partial,
    soNumber,
    status: STATUS_MAP[(v.orderStatus ?? "").trim().toLowerCase()] ?? "Draft",
    adjustments: toModuleAdjustments(record, (li) => lines[li]?.id ?? `SOL-LEG-${li}`, `ADJ-${index}`),
  };
}

