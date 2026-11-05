/**
 * The entities this import can point at but never create.
 *
 * Every list here is the set that already exists in Sales Orders. The importer
 * resolves a file value against these and, when it misses, offers the
 * user two exits: repoint the cell at something real, or go create the
 * record in its own module and leave this one failed for a later pass.
 *
 * The values are the module's own demo data, deliberately: the point of a
 * dry run is to see real names in the picker, and a customer or item that
 * does not exist here is exactly the failure the review sheet is for.
 */

export type CatalogKey =
  | "customer" | "item" | "uom" | "pricingRule" | "user"
  | "location" | "paymentTerm" | "paymentMethod" | "contact" | "sourceQuote";

export const CUSTOMERS = [
  "Metro City Fire & Rescue",
  "Tri-County EMS Authority",
  "Lakewood Community Hospital",
  "Pinecrest Volunteer Fire Dept",
  "Summit Regional Medical Center",
  "Eagle County Sheriff's Office",
  "Pacific Northwest Ambulance",
  "Riverside Utility District",
  "Heartland Air Ambulance",
  "Great Plains Fire Protection",
  "Coastal Search & Rescue",
  "Valley Health Systems",
  "Northern Plains Medical Transport",
  "Bay Area Critical Care",
  "Appalachian Rescue Teams",
] as const;

/** The module's real sellable items, from `CATALOG` in the SO store.
 *  Carries the full name and short description so the item picker can use
 *  the same row shape the line-item tables use, rather than a bare code. */
export interface CatalogItemRow {
  code: string;
  /** Long spec-style name, the text the line tables clamp with `more`. */
  name: string;
  /** Short human description. */
  description: string;
  type: string;
  price: number;
}

export const ITEMS: CatalogItemRow[] = [
  { code: "000-100-001", name: "Cutaway cab-chassis with 178\" wheelbase, 10,360 GVWR, 3.5L EcoBoost V6 turbocharged engine with 10-speed automatic transmission, factory ambulance prep package includes heavy-duty alternator (240A), auxiliary idle control, and reinforced rear frame section for modular body mounting", description: "Heavy-duty ambulance chassis", type: "Serialized", price: 42500 },
  { code: "000-100-002", name: "E-450 stripped chassis, 176\" WB, 7.3L V8 gas engine, dual rear wheels, 16,000 GVWR, heavy-duty front and rear stabilizer bars, ambulance prep with reinforced frame rails, upgraded 210A alternator, engine block heater, and transmission PTO provision for hydraulic equipment", description: "Ambulance prep with reinforced frame", type: "Serialized", price: 48200 },
  { code: "000-100-019", name: "Type III Ambulance Module, standard 152\" patient compartment, cutaway-mount modular body with 72\" headroom, full walk-through cab access, aluminum/composite construction, KKK-A-1822F compliant", description: "Cutaway modular body, KKK-A-1822F compliant", type: "Serialized", price: 94200 },
  { code: "000-100-026", name: "54\" full-size LED lightbar with 16 independently addressable modules in red/white split pattern for ambulance application, integrated alley lights and takedown floods, 62 programmable flash patterns with traffic advisor mode, low-profile aerodynamic housing with UV-stabilized polycarbonate lens, conformal-coated electronics rated IP67", description: "Integrated alley/takedown lights, programmable flash patterns", type: "Non-Serialized", price: 3250 },
  { code: "000-100-041", name: "200-watt electronic siren amplifier with integrated PA system, includes wail, yelp, phaser, and hi-lo tone selections with configurable priority override, radio rebroadcast input for simultaneous PA and radio operation, backlit tactile controls with night-mode dimming, meets SAE J1849 and KKK-A-1822F specifications", description: "Radio rebroadcast input, backlit controls", type: "Non-Serialized", price: 685 },
  { code: "000-100-049", name: "Multi-band P25 Phase II digital mobile radio covering VHF (136-174 MHz), UHF (380-512 MHz), 700 MHz, and 800 MHz bands with TDMA technology, AES-256 and DES-OFB encryption, integrated GPS receiver with location reporting, Bluetooth 5.0, Over-The-Air Programming (OTAP) ready, built-in IP packet data modem for AVL and messaging", description: "AES 256 encryption, GPS, Bluetooth, OTAP ready", type: "Serialized", price: 7850 },
  { code: "000-100-059", name: "Powered hydraulic stretcher with 700 lb patient capacity, battery-operated lift mechanism with proportional hydraulic control, auto-loading base with isokinetic lowering system, compatible with Power-LOAD cot fastener, Fowler/Trendelenburg positioning, retractable head section, IV pole mount, integrated CPR platform, antimicrobial powder-coated aluminum frame with stainless steel components", description: "Auto-loading with isokinetic lowering, Power-LOAD compatible", type: "Serialized", price: 18500 },
  { code: "000-100-079", name: "Automatic shoreline power inlet with auto-eject on engine start, 20A/125V marine-grade weatherproof connector with corrosion-resistant stainless steel housing, includes integrated GFCI protection, LED status indicator for shore power connection state, and auto-transfer relay that switches between shore and inverter power sources without interrupting patient compartment equipment", description: "Weatherproof marine-grade connector", type: "Lot Non-Serialized", price: 1250 },
  { code: "000-100-081", name: "AIMS 3000W pure sine wave inverter/charger, 3000W continuous and 9000W surge, integrated 100A shore-power charger with auto-transfer relay", description: "Pure sine inverter with shore-power charger", type: "Non-Serialized", price: 2400 },
  { code: "000-100-171", name: "Complete body preparation, prime, paint, and graphics installation labor package including surface prep with DA sanding and chemical etching, high-build epoxy primer with moisture barrier, base coat/clear coat in Imron polyurethane with UV protection, full agency decal/stripe/Chevron graphics per customer-supplied artwork and NFPA 1901 retroreflective markings", description: "Complete vehicle finishing service", type: "Non-Serialized", price: 5200 },
  { code: "000-100-195", name: "Field-ready AED with traceable smart battery. Unique per-unit serial number for asset/warranty tracking AND lot-numbered battery cells for recall + expiration management. FDA Class III, CE marked, 8-year shelf life, biphasic 200J defibrillator with metronome-guided CPR coaching.", description: "Serial-tracked AED with lot-controlled battery cells", type: "Lot Serialized", price: 2150 },
  { code: "000-100-003", name: "ProMaster 3500 extended 159\" WB, high-roof body, front-wheel drive, 3.6L Pentastar V6 with 9-speed automatic, ambulance chassis package includes upgraded suspension with load-leveling rear air springs, heavy-duty brakes, and dual battery system with smart isolator relay", description: "3.6L Pentastar ambulance chassis", type: "Serialized", price: 39800 },
  { code: "000-100-175", name: "8-hour on-site operator training session covering all installed vehicle systems including chassis operation, emergency lighting and siren controls, HVAC and climate management, electrical distribution panels, patient compartment equipment orientation, radio programming basics, Power-LOAD stretcher loading/unloading procedures with hands-on practicals and written competency assessment", description: "Patient compartment equipment orientation", type: "Non-Serialized", price: 1500 },
];

export const ITEM_BY_CODE: Record<string, CatalogItemRow> = Object.fromEntries(
  ITEMS.map((i) => [i.code, i]),
);

export const ITEM_CODES = ITEMS.map((i) => i.code);

/** List price per item, for the price-differs warning. */
export const ITEM_PRICES: Record<string, number> = Object.fromEntries(
  ITEMS.map((i) => [i.code, i.price]),
);

/** Units each item may be sold in. A unit outside this set is an error. */
export const ITEM_UNITS: Record<string, string[]> = {
  "000-100-003": ["EA"],
  "000-100-175": ["EA", "Box"],
  "000-100-001": ["EA"],
  "000-100-002": ["EA", "Box"],
  "000-100-019": ["EA", "Box"],
  "000-100-026": ["EA", "Box", "Carton"],
  "000-100-041": ["EA", "Box", "Carton"],
  "000-100-049": ["EA"],
  "000-100-059": ["EA"],
  "000-100-079": ["EA", "Box"],
  "000-100-081": ["EA", "Box"],
  "000-100-171": ["EA", "Box", "Carton", "Pallet"],
  "000-100-195": ["EA", "Box"],
};

export const UOM_CODES = [
  "EA",
  "Box",
  "Carton",
  "Pallet",
] as const;

/* The module's actual pricing rules, from `pricingRulesData.ts`. These are
   matched by name, so an invented name here would fail every real file. */
/** Long names for each unit, from `data/uomSets.ts`, so the unit dropdown
 *  reads "Box · Box (12 units)" rather than a bare code. */
export const UOM_FULL_NAMES: Record<string, string> = {
  EA: "Each",
  Box: "Box (12 units)",
  Carton: "Carton (24 units)",
  Pallet: "Pallet (480 units)",
};

export const PRICING_RULES = [
  "Fleet Volume Discount",
  "Government Contract Pricing",
  "Communications Bundle",
  "Patient-Care Bulk Discount",
  "Expedited Build Premium",
  "Lighting Package Volume",
  "Services & Training Bundle",
] as const;

export const USER_EMAILS = [
  "yahya.naveed@omnesoft.com",
  "marcus.taylor@omnesoft.com",
  "sarah.chen@omnesoft.com",
  "michael.rodriguez@omnesoft.com",
  "emily.rios@omnesoft.com",
  "david.kowalski@omnesoft.com",
] as const;

/* From `shared/customerDefaults.ts`. "2/10 Net 30" is kept because the
   template's own sample row uses it; the rest are the module's set. */
export const PAYMENT_TERMS = [
  "Net 15",
  "Net 30",
  "Net 45",
  "Net 60",
  "2/10 Net 30",
] as const;

/* From `shared/customerDefaults.ts`. "ACH" is kept as an accepted alias
   for the module's "ACH/Direct Deposit" because the template ships it. */
export const PAYMENT_METHODS = [
  "ACH/Direct Deposit",
  "ACH",
  "Wire Transfer",
  "Corporate Card",
  "Check",
] as const;

export const CONTACTS = [
  "Jennifer Anderson",
  "James Mitchell",
  "Robert Chen",
  "Laura Whitfield",
  "fleet@metrocityfire.gov",
  "billing@metrocityfire.gov",
  "qa@metrocityfire.gov",
  "receiving@metrocityfire.gov",
] as const;

/** Locations owned by each customer. Feeds the third-party-delivery warning. */
export const CUSTOMER_LOCATIONS: Record<string, string[]> = {
  "Metro City Fire & Rescue": ["Station 1 HQ", "Central Maintenance Depot"],
  "Tri-County EMS Authority": ["Dispatch Center", "North Substation"],
  "Lakewood Community Hospital": ["Receiving Dock"],
  "Riverside Fire District": ["Main Firehouse"],
};

/** Warehouses on their own, plus every `Customer > Location` pair. */
export const LOCATIONS = [
  "Columbus Conversion Plant",
  "Lancaster Assembly Center",
  "San Antonio Build Facility",
  "Tacoma Cross Dock",
  "Midwest Returns Hub",
  "Metro City Fire & Rescue > Station 1 HQ",
  "Metro City Fire & Rescue > Central Maintenance Depot",
  "Tri-County EMS Authority > Dispatch Center",
  "Tri-County EMS Authority > North Substation",
  "Lakewood Community Hospital > Receiving Dock",
  "Riverside Fire District > Main Firehouse",
] as const;

/** Quote numbers already in Omne, for the Source Quote No link. */
export const SOURCE_QUOTES = [
  "Q-000-100-001",
  "Q-000-100-002",
  "Q-000-100-003",
  "Q-2026-0001",
  "Q-2026-0002",
] as const;


/* ── Lookup helpers ───────────────────────────────────────────────── */

const norm = (v: string) => v.trim().toLowerCase();

function indexBy(values: readonly string[]): Map<string, string> {
  return new Map(values.map((v) => [norm(v), v]));
}

export interface EntityIndex {
  /** Canonical values, in display order, for the resolve picker. */
  options: string[];
  /** normalised → canonical, for matching a file value. */
  index: Map<string, string>;
}

function makeIndex(values: readonly string[]): EntityIndex {
  return { options: [...values], index: indexBy(values) };
}

export const CATALOG: Record<CatalogKey, EntityIndex> = {
  customer: makeIndex(CUSTOMERS),
  item: makeIndex(ITEM_CODES),
  uom: makeIndex(UOM_CODES),
  pricingRule: makeIndex(PRICING_RULES),
  user: makeIndex(USER_EMAILS),
  location: makeIndex(LOCATIONS),
  paymentTerm: makeIndex(PAYMENT_TERMS),
  paymentMethod: makeIndex(PAYMENT_METHODS),
  contact: makeIndex(CONTACTS),
  sourceQuote: makeIndex(SOURCE_QUOTES),
};

/** Resolve a file value to its canonical form, or null when unknown. */
export function resolveEntity(kind: CatalogKey, raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  return CATALOG[kind].index.get(norm(v)) ?? null;
}

/** Units permitted for one item. Mirrors how the modules gate UoM per item. */
export function unitsForItem(itemCode: string): string[] {
  return ITEM_UNITS[itemCode] ?? [...UOM_CODES];
}

/** Price-list price for an item, used for the price-differs warning. */
export function priceListPrice(itemCode: string): number | null {
  const p = ITEM_PRICES[itemCode];
  return typeof p === "number" ? p : null;
}

/** Locations belonging to one customer, for the third-party warning. */
export function locationsForCustomer(customer: string): string[] {
  return CUSTOMER_LOCATIONS[customer] ?? [];
}

/**
 * Near-matches for a value that failed to resolve, so the picker can lead
 * with "did you mean". Cheap token overlap plus prefix, which is enough to
 * surface Toyita → Toyota without pulling in a fuzzy-match dependency.
 */
export function suggestions(kind: CatalogKey, raw: string, limit = 4): string[] {
  const q = norm(raw).replace(/[^a-z0-9 ]/g, "");
  if (!q) return [];
  const qTokens = new Set(q.split(/\s+/).filter(Boolean));
  const scored = CATALOG[kind].options.map((opt) => {
    const o = norm(opt).replace(/[^a-z0-9 ]/g, "");
    let score = 0;
    if (o.startsWith(q.slice(0, 4))) score += 3;
    if (o.includes(q) || q.includes(o)) score += 4;
    const oTokens = o.split(/\s+/).filter(Boolean);
    for (const t of oTokens) {
      if (qTokens.has(t)) score += 2;
      else for (const qt of qTokens) {
        if (t.length > 3 && qt.length > 3 && (t.startsWith(qt.slice(0, 4)) || qt.startsWith(t.slice(0, 4)))) score += 1;
      }
    }
    return { opt, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.opt);
}
