/* Review row <-> Item record. Used by ItemsContext.upsertImportedItems
 * (row -> new Item / update patch) and by export.ts (Item -> file
 * vocabulary). Depends only on spec.data.mjs and helpers.ts so the store can
 * import it without a cycle through the UI modules. */

import type { Item } from "@/app/context/ItemsContext";
import { COLUMNS, ENUMS, ITEM_IMAGE_PLACEHOLDER, VOCAB, type ItemReviewField } from "./spec.data.mjs";
import { canonical, joinList, knownOnly, matchOption, parseTags, parseYesNo, splitList } from "./helpers";

export type ItemReviewRow = Record<ItemReviewField, string>;

/** Lower-cased -> canonical maps used to canonicalise names on apply. Any map may be omitted. */
export interface MapperLookups {
  categories?: Map<string, string>;
  units?: Map<string, string>;
  priceUnits?: Map<string, string>;
  locations?: Map<string, string>;
  partners?: Map<string, string>;
  users?: Map<string, string>;
  approvers?: Map<string, string>;
}

export interface MapperActor {
  currentUserId: string;
  currentUserName: string;
}

const DEFAULTS: Record<ItemReviewField, string> = Object.fromEntries(COLUMNS.map((c) => [c.key, c.defaultValue])) as Record<
  ItemReviewField,
  string
>;

const ACQ_LABEL: Record<"Purchase" | "Manufacturing", "Purchased" | "Manufactured"> = {
  Purchase: "Purchased",
  Manufacturing: "Manufactured",
};

function num(value: string): number | null {
  const v = String(value ?? "").trim().replace(/,/g, "");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function vocab<T extends string>(table: Record<string, T>, value: string): T | null {
  const v = String(value ?? "").trim().toLowerCase();
  return v && v in table ? table[v] : null;
}

export function parseAlternativeUnits(value: string, units?: Map<string, string>): { id: string; unit: string; conversionFactor: string }[] {
  const out: { id: string; unit: string; conversionFactor: string }[] = [];
  for (const part of splitList(value)) {
    const m = part.match(/^(.+?)\s*=\s*(\d+(?:\.\d+)?)$/);
    if (!m) continue;
    const unit = canonical(m[1], units);
    if (!unit || !(Number(m[2]) > 0)) continue;
    out.push({ id: `alt-${out.length + 1}`, unit, conversionFactor: m[2] });
  }
  return out;
}

export function parsePricing(value: string, priceUnits?: Map<string, string>): { id: string; price: string; uom: string }[] {
  const out: { id: string; price: string; uom: string }[] = [];
  for (const part of splitList(value)) {
    const m = part.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
    if (!m) continue;
    const uom = canonical(m[2], priceUnits);
    if (!uom) continue;
    out.push({ id: String(out.length + 1), price: Number(m[1]).toFixed(2), uom });
  }
  return out;
}

function acquisition(row: ItemReviewRow, fallbackToDefault: boolean) {
  const methods: ("Purchase" | "Manufacturing")[] = [];
  for (const m of splitList(row.acquisitionMethods)) {
    const v = vocab(VOCAB.acquisition, m);
    if (v && !methods.includes(v)) methods.push(v);
  }
  if (methods.length === 0) {
    if (!fallbackToDefault) return null;
    methods.push("Purchase");
  }
  const primaryFile = matchOption(row.primaryAcquisition, ENUMS.acquisitionMethods);
  const primaryWanted = primaryFile ? vocab(VOCAB.acquisition, primaryFile) : null;
  const primary: "Purchase" | "Manufacturing" =
    primaryWanted && methods.includes(primaryWanted) ? primaryWanted : methods.length === 1 ? methods[0] : "Purchase";
  const legacy: Item["acquisitionMethod"] =
    methods.length > 1 ? { methods: methods.map((m) => ACQ_LABEL[m]), primary: ACQ_LABEL[primary] } : ACQ_LABEL[methods[0]];
  return { methods, primary, legacy };
}

function categoryList(row: ItemReviewRow, primary: string, lookups: MapperLookups): string[] {
  const list = knownOnly(splitList(row.additionalCategories, lookups.categories), lookups.categories);
  return list.filter((c) => c.toLowerCase() !== primary.toLowerCase());
}

/* ─── Row -> new Item ─── */

/** Build a complete Item (minus id / timestamps) from a review row. Blank
 *  cells take the Create New Item defaults. Names are canonicalised through
 *  `lookups`; unknown names are dropped (the validator already warned). */
export function reviewRowToItem(
  row: ItemReviewRow,
  actor: MapperActor,
  lookups: MapperLookups = {},
): Omit<Item, "id" | "createdAt" | "updatedAt"> {
  const partNumber = row.partNumber.trim();
  const primaryCategory = canonical(row.primaryCategory, lookups.categories) ?? row.primaryCategory.trim();
  const control = vocab(VOCAB.inventoryControlType, row.inventoryControlType) ?? "Non-Serialized";
  const lotControl = parseYesNo(row.lotControl) ?? false;
  const unit = canonical(row.unit, lookups.units) ?? DEFAULTS.unit;
  const altUnits = parseAlternativeUnits(row.alternativeUnits, lookups.units);
  const acq = acquisition(row, true)!;
  const inbound = knownOnly(splitList(row.inboundLocations, lookups.locations), lookups.locations);
  const outbound = knownOnly(splitList(row.outboundLocations, lookups.locations), lookups.locations);
  const inboundLocations = inbound.length ? inbound : [DEFAULTS.inboundLocations];
  const outboundLocations = outbound.length ? outbound : [DEFAULTS.outboundLocations];
  const sellingScope = vocab(VOCAB.sellingScope, row.sellingScope) ?? "all";
  const pricing = parsePricing(row.pricing, lookups.priceUnits);
  const shelfLife = num(row.shelfLifeValue);
  const mh = knownOnly(splitList(row["owners.materialHandling"], lookups.users), lookups.users);

  return {
    partNumber,
    description: row.description.trim(),
    status: matchOption(row.status, ENUMS.status) ?? "Active",
    stockStatus: "In Stock",
    images: [ITEM_IMAGE_PLACEHOLDER],
    inventoryControlType: control,
    primaryCategory,
    additionalCategories: categoryList(row, primaryCategory, lookups),
    tags: parseTags(row.tags).tags,
    onHandQty: 0,
    onOrderQty: 0,
    unit,
    alternativeStockingUnits: altUnits.length ? `${altUnits[0].unit} (${altUnits[0].conversionFactor})` : "-",
    alternativeUnits: altUnits,
    inboundLocations,
    outboundLocations,
    defaultInboundLocation: inboundLocations[0],
    defaultOutboundLocation: outboundLocations[0],
    receivingStagingLocation: knownOnly(splitList(row.receivingStagingLocation, lookups.locations), lookups.locations),
    shippingStagingLocation: knownOnly(splitList(row.shippingStagingLocation, lookups.locations), lookups.locations),
    acquisitionMethod: acq.legacy,
    acquisitionMethods: acq.methods,
    primaryAcquisition: acq.primary,
    lotControl,
    lotIdSource: lotControl ? (vocab(VOCAB.lotIdSource, row.lotIdSource) ?? "system") : undefined,
    shelfLifeValue: shelfLife !== null && shelfLife >= 0 ? shelfLife : undefined,
    shelfLifeUnit: shelfLife !== null && shelfLife >= 0 ? (vocab(VOCAB.shelfLifeUnit, row.shelfLifeUnit) ?? "days") : undefined,
    inventoryType: vocab(VOCAB.inventoryType, row.inventoryType) ?? "Stock",
    valuationMethod: vocab(VOCAB.valuationMethod, row.valuationMethod) ?? "fifo",
    minStock: num(row.minStock) ?? Number(DEFAULTS.minStock),
    maxStock: num(row.maxStock) ?? Number(DEFAULTS.maxStock),
    minPurchase: num(row.minPurchase) ?? Number(DEFAULTS.minPurchase),
    maxPurchase: num(row.maxPurchase) ?? Number(DEFAULTS.maxPurchase),
    multiples: num(row.multiples) ?? Number(DEFAULTS.multiples),
    shortageRule: vocab(VOCAB.shortageRule, row.shortageRule) ?? "demand",
    sellingScope,
    specificPartners: sellingScope === "specific" ? knownOnly(splitList(row.specificPartners, lookups.partners), lookups.partners) : [],
    pricing: pricing.length ? pricing : [{ id: "1", price: "0.00", uom: "Each" }],
    owners: {
      materialHandling: mh,
      purchasing: canonical(row["owners.purchasing"], lookups.users),
      finance: canonical(row["owners.finance"], lookups.users),
    },
    cycleTolerance: num(row.cycleTolerance) ?? 0,
    approvers: knownOnly(splitList(row.approvers, lookups.approvers), lookups.approvers),
    scanLocation: parseYesNo(row.scanLocation) ?? false,
    scanItem: parseYesNo(row.scanItem) ?? false,
    scanLot: parseYesNo(row.scanLot) ?? false,
    scanSerial: control === "Serialized" ? (parseYesNo(row.scanSerial) ?? false) : false,
    manufacturer: "Internal",
    mpn: partNumber,
    ownerId: actor.currentUserId,
    createdBy: actor.currentUserName,
  };
}

/* ─── Row -> update patch ─── */

/** Patch for an existing item: only the columns the row fills in. Part Number
 *  is the key and is never written. Blank cells leave values unchanged. */
export function reviewRowToPatch(row: ItemReviewRow, existing: Item, lookups: MapperLookups = {}): Partial<Item> {
  const p: Partial<Item> = {};
  const has = (f: ItemReviewField) => row[f].trim().length > 0;

  if (has("description")) p.description = row.description.trim();
  if (has("status")) {
    const s = matchOption(row.status, ENUMS.status);
    if (s) p.status = s;
  }
  if (has("tags")) p.tags = parseTags(row.tags).tags;
  let primary = existing.primaryCategory;
  if (has("primaryCategory")) {
    const c = canonical(row.primaryCategory, lookups.categories);
    if (c) {
      p.primaryCategory = c;
      primary = c;
    }
  }
  if (has("additionalCategories")) p.additionalCategories = categoryList(row, primary, lookups);
  if (has("inventoryType")) {
    const v = vocab(VOCAB.inventoryType, row.inventoryType);
    if (v) p.inventoryType = v;
  }
  let control = existing.inventoryControlType;
  if (has("inventoryControlType")) {
    const v = vocab(VOCAB.inventoryControlType, row.inventoryControlType);
    if (v) {
      p.inventoryControlType = v;
      control = v;
    }
  }
  let lotOn = existing.lotControl;
  if (has("lotControl")) {
    const v = parseYesNo(row.lotControl);
    if (v !== null) {
      p.lotControl = v;
      lotOn = v;
    }
  }
  if (has("lotIdSource") && lotOn) {
    const v = vocab(VOCAB.lotIdSource, row.lotIdSource);
    if (v) p.lotIdSource = v;
  }
  if (has("shelfLifeValue")) {
    const n = num(row.shelfLifeValue);
    if (n !== null && n >= 0) {
      p.shelfLifeValue = n;
      if (!existing.shelfLifeUnit && !has("shelfLifeUnit")) p.shelfLifeUnit = "days";
    }
  }
  if (has("shelfLifeUnit")) {
    const v = vocab(VOCAB.shelfLifeUnit, row.shelfLifeUnit);
    if (v) p.shelfLifeUnit = v;
  }
  if (has("unit")) {
    const u = canonical(row.unit, lookups.units);
    if (u) p.unit = u;
  }
  if (has("alternativeUnits")) {
    const alts = parseAlternativeUnits(row.alternativeUnits, lookups.units);
    p.alternativeUnits = alts;
    p.alternativeStockingUnits = alts.length ? `${alts[0].unit} (${alts[0].conversionFactor})` : existing.alternativeStockingUnits;
  }
  if (has("acquisitionMethods") || has("primaryAcquisition")) {
    const base: ItemReviewRow = {
      ...row,
      acquisitionMethods: has("acquisitionMethods")
        ? row.acquisitionMethods
        : joinList((existing.acquisitionMethods ?? []).map((m) => ACQ_LABEL[m])),
    };
    const acq = acquisition(base, false);
    if (acq) {
      p.acquisitionMethods = acq.methods;
      p.primaryAcquisition = acq.primary;
      p.acquisitionMethod = acq.legacy;
    }
  }
  if (has("minStock")) {
    const n = num(row.minStock);
    if (n !== null) p.minStock = n;
  }
  if (has("maxStock")) {
    const n = num(row.maxStock);
    if (n !== null) p.maxStock = n;
  }
  if (has("inboundLocations")) {
    const l = knownOnly(splitList(row.inboundLocations, lookups.locations), lookups.locations);
    if (l.length) {
      p.inboundLocations = l;
      p.defaultInboundLocation = l[0];
    }
  }
  if (has("outboundLocations")) {
    const l = knownOnly(splitList(row.outboundLocations, lookups.locations), lookups.locations);
    if (l.length) {
      p.outboundLocations = l;
      p.defaultOutboundLocation = l[0];
    }
  }
  if (has("receivingStagingLocation")) p.receivingStagingLocation = knownOnly(splitList(row.receivingStagingLocation, lookups.locations), lookups.locations);
  if (has("shippingStagingLocation")) p.shippingStagingLocation = knownOnly(splitList(row.shippingStagingLocation, lookups.locations), lookups.locations);
  if (has("minPurchase")) {
    const n = num(row.minPurchase);
    if (n !== null) p.minPurchase = n;
  }
  if (has("maxPurchase")) {
    const n = num(row.maxPurchase);
    if (n !== null) p.maxPurchase = n;
  }
  if (has("multiples")) {
    const n = num(row.multiples);
    if (n !== null && n > 0) p.multiples = n;
  }
  if (has("shortageRule")) {
    const v = vocab(VOCAB.shortageRule, row.shortageRule);
    if (v) p.shortageRule = v;
  }
  let scope = existing.sellingScope ?? "all";
  if (has("sellingScope")) {
    const v = vocab(VOCAB.sellingScope, row.sellingScope);
    if (v) {
      p.sellingScope = v;
      scope = v;
      if (v === "all") p.specificPartners = [];
    }
  }
  if (has("specificPartners") && scope === "specific") {
    p.specificPartners = knownOnly(splitList(row.specificPartners, lookups.partners), lookups.partners);
  }
  if (has("pricing")) {
    const tiers = parsePricing(row.pricing, lookups.priceUnits);
    if (tiers.length) p.pricing = tiers;
  }
  if (has("valuationMethod")) {
    const v = vocab(VOCAB.valuationMethod, row.valuationMethod);
    if (v) p.valuationMethod = v;
  }
  if (has("owners.materialHandling") || has("owners.purchasing") || has("owners.finance")) {
    const owners = { materialHandling: [] as string[], purchasing: null as string | null, finance: null as string | null, ...(existing.owners ?? {}) };
    if (has("owners.materialHandling")) owners.materialHandling = knownOnly(splitList(row["owners.materialHandling"], lookups.users), lookups.users);
    if (has("owners.purchasing")) owners.purchasing = canonical(row["owners.purchasing"], lookups.users) ?? owners.purchasing;
    if (has("owners.finance")) owners.finance = canonical(row["owners.finance"], lookups.users) ?? owners.finance;
    p.owners = owners;
  }
  if (has("cycleTolerance")) {
    const n = num(row.cycleTolerance);
    if (n !== null && n >= 0 && n <= 100) p.cycleTolerance = n;
  }
  if (has("approvers")) p.approvers = knownOnly(splitList(row.approvers, lookups.approvers), lookups.approvers);
  for (const f of ["scanLocation", "scanItem", "scanLot"] as const) {
    if (has(f)) {
      const v = parseYesNo(row[f]);
      if (v !== null) p[f] = v;
    }
  }
  if (has("scanSerial")) {
    const v = parseYesNo(row.scanSerial);
    if (v !== null) p.scanSerial = control === "Serialized" ? v : false;
  }
  return p;
}

/* ─── Item -> row (file vocabulary), used by export and re-import round trips ─── */

const LOT_ID_LABEL: Record<string, string> = { system: "System Generated", vendor: "Vendor Lot" };
const SHELF_LABEL: Record<string, string> = { days: "Days", months: "Months", years: "Years" };
const RULE_LABEL: Record<string, string> = { demand: "Demand", min: "Min", zero: "Zero", off: "Off" };
const SCOPE_LABEL: Record<string, string> = { all: "All", specific: "Specific" };
const VAL_LABEL: Record<string, string> = { fifo: "FIFO", lifo: "LIFO", wac: "WAC", specific: "Specific" };
const yn = (v: boolean | undefined) => (v === undefined ? "" : v ? "Yes" : "No");
const numStr = (v: number | undefined | null) => (v === undefined || v === null ? "" : String(v));

export function itemToReviewRow(item: Item): ItemReviewRow {
  const methods = item.acquisitionMethods ?? [];
  return {
    partNumber: item.partNumber ?? "",
    description: item.description ?? "",
    status: item.status ?? "",
    tags: joinList(item.tags),
    primaryCategory: item.primaryCategory ?? "",
    additionalCategories: joinList(item.additionalCategories),
    inventoryType: item.inventoryType ?? "",
    inventoryControlType: item.inventoryControlType ?? "",
    lotControl: yn(item.lotControl),
    lotIdSource: item.lotIdSource ? LOT_ID_LABEL[item.lotIdSource] ?? "" : "",
    shelfLifeValue: numStr(item.shelfLifeValue),
    shelfLifeUnit: item.shelfLifeUnit ? SHELF_LABEL[item.shelfLifeUnit] ?? "" : "",
    unit: item.unit ?? "",
    alternativeUnits: joinList((item.alternativeUnits ?? []).map((a) => `${a.unit}=${a.conversionFactor}`)),
    acquisitionMethods: joinList(methods.map((m) => ACQ_LABEL[m])),
    primaryAcquisition: item.primaryAcquisition ? ACQ_LABEL[item.primaryAcquisition] : "",
    minStock: numStr(item.minStock),
    maxStock: numStr(item.maxStock),
    inboundLocations: joinList(item.inboundLocations),
    outboundLocations: joinList(item.outboundLocations),
    receivingStagingLocation: joinList(item.receivingStagingLocation),
    shippingStagingLocation: joinList(item.shippingStagingLocation),
    minPurchase: numStr(item.minPurchase),
    maxPurchase: numStr(item.maxPurchase),
    multiples: numStr(item.multiples),
    shortageRule: item.shortageRule ? RULE_LABEL[item.shortageRule] ?? "" : "",
    sellingScope: item.sellingScope ? SCOPE_LABEL[item.sellingScope] ?? "" : "",
    specificPartners: joinList(item.specificPartners),
    pricing: joinList((item.pricing ?? []).map((t) => `${t.price} ${t.uom}`)),
    valuationMethod: item.valuationMethod ? VAL_LABEL[item.valuationMethod] ?? "" : "",
    "owners.materialHandling": joinList(item.owners?.materialHandling),
    "owners.purchasing": item.owners?.purchasing ?? "",
    "owners.finance": item.owners?.finance ?? "",
    cycleTolerance: numStr(item.cycleTolerance),
    approvers: joinList(item.approvers),
    scanLocation: yn(item.scanLocation),
    scanItem: yn(item.scanItem),
    scanLot: yn(item.scanLot),
    scanSerial: yn(item.scanSerial),
  };
}
