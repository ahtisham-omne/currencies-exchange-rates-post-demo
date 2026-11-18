import { mulberry32 } from './seededRandom';

// Seeded so the vendor / PO / line-item dataset is stable across
// reloads — see mockInvoices.ts for the rationale.
const rand = mulberry32(0x4E7D0F5);

export interface LineItem {
  id: string;
  sku: string;
  description: string;
  quantity: number;
  uom: string;
  unitPrice: number;
  totalPrice: number;
  receivedQty?: number;
  invoicedQty?: number;
  image?: string;
  [key: string]: any;
}

/** A vendor site a PO can be placed with and goods received from. The
 *  headquarters entry is the vendor itself, so a single-site vendor still
 *  has exactly one origin and the return flow collapses to one group. */
export interface VendorLocation {
  id: string;
  name: string;
  isHeadquarters?: boolean;
}

const VENDOR_STREETS = [
  'W Loop Dr',
  'Industrial Pkwy',
  'Commerce St',
  'Harbour Way',
  'Foundry Rd',
  'Old Mill Ave',
  'Cedar Point Blvd',
  'Dockside Ln',
];

const VENDOR_CITIES: { city: string; state: string; zip: string }[] = [
  { city: 'Dallas', state: 'TX', zip: '75207' },
  { city: 'Sacramento', state: 'CA', zip: '95814' },
  { city: 'Atlanta', state: 'GA', zip: '30318' },
  { city: 'Newark', state: 'NJ', zip: '07102' },
  { city: 'Chicago', state: 'IL', zip: '60607' },
  { city: 'Columbus', state: 'OH', zip: '43215' },
  { city: 'Phoenix', state: 'AZ', zip: '85004' },
  { city: 'Charlotte', state: 'NC', zip: '28203' },
];

/**
 * A vendor's primary address.
 *
 * The one field that actually tells two partners of the same name apart --
 * which Home Depot, the people in Chicago -- and the master carries it for
 * almost everybody. A description does not: it is the phone book's notes
 * field, empty on most records, so the flow leans on this instead and shows a
 * description only where somebody wrote one.
 *
 * Null on about one vendor in twenty, because the real data has holes and a
 * screen that assumes it never does breaks on the first one.
 */
export function vendorAddress(vendorCode: string): string | null {
  // Three separate hashes, not three slices of one. Shifting a single hash
  // gave neighbouring vendor codes the same street number and the same city,
  // and a column of identical addresses is worse than none.
  const seed = (salt: string) => {
    let h = 0;
    const key = `${salt}:${vendorCode}`;
    for (let i = 0; i < key.length; i++) h = (h * 131 + key.charCodeAt(i) * 7919) >>> 0;
    return h;
  };
  if (seed('has-address') % 20 === 0) return null;
  const street = VENDOR_STREETS[seed('street') % VENDOR_STREETS.length]!;
  const place = VENDOR_CITIES[seed('city') % VENDOR_CITIES.length]!;
  const number = 100 + (seed('number') % 8900);
  return `${number} ${street}, ${place.city}, ${place.state} ${place.zip}`;
}

const VENDOR_BRANCH_CITIES = ['Dallas', 'California', 'Atlanta', 'Newark'];

export function buildVendorLocations(
  vendorCode: string,
  vendorName: string,
): VendorLocation[] {
  const hq: VendorLocation = {
    id: `${vendorCode}-hq`,
    name: vendorName,
    isHeadquarters: true,
  };
  const seq = parseInt(vendorCode.split('-')[1] || '0', 10);
  // Every fourth vendor is single-site so the create flow keeps exercising
  // the collapsed one-origin case, not only the fan-out case.
  if (seq % 4 === 3) return [hq];
  return [
    hq,
    ...[0, 1].map((n) => {
      const city = VENDOR_BRANCH_CITIES[(seq + n) % VENDOR_BRANCH_CITIES.length]!;
      return { id: `${vendorCode}-${city.toLowerCase()}`, name: `${vendorName} ${city}` };
    }),
  ];
}

/** Which site a PO was placed with. The first two POs are pinned to
 *  headquarters because generateGRNs folds them into one consolidated
 *  receipt, and a receipt can never span two sites. */
function originForPOIndex(index: number, locations: VendorLocation[]): string {
  return (index < 2 ? locations[0]! : locations[index % locations.length]!).id;
}

export interface VendorPO {
  poNumber: string;
  /** Vendor site the PO was placed with. Every unit on a PO arrives from
   *  this one site, which is what makes it the return origin. */
  originId: string;
  poDate: string;
  poAmount: number;
  status: string;
  itemCount: number;
  items: LineItem[];
  invoicedAmount?: number; // New: track invoiced amount at PO level
}

export interface VendorGRN {
  grnNumber: string;
  /** Vendor site the goods physically came from — inherited from the PO. */
  originId: string;
  grnDate: string;
  receivedQty: number;
  poNumber: string;
  status: string;
  items: LineItem[];
  vendorName?: string; // For global view
  vendorCode?: string; // For global view
}

export interface Vendor {
  id: string;
  vendorCode: string;
  vendorName: string;
  category: string;
  currency: string;
  paymentTerms: string;
  purchaseOrders: VendorPO[];
  receivingDocuments: VendorGRN[];
  /** Sites goods can be ordered from and returned to. Always at least one. */
  locations: VendorLocation[];
  /** Vendors that trade as branches of one group. A branch is a vendor in its
   *  own right -- its own code, terms, address and ledger -- so goods from two
   *  of them are two returns. Being family only means the group can absorb a
   *  sibling's return if the returner asks it to, which is the one case where
   *  merging two vendors into one document is a real option. */
  familyCode?: string;
  familyName?: string;
  createdBy: string;
  createdOn: string;
  type: 'Domestic' | 'International' | 'Service' | 'Manufacturing';
  imageUrl?: string;
  /** Partner-level default expense account (GL) used to pre-fill standalone
   *  invoice line items for this vendor. Optional — not every vendor has one
   *  configured, in which case the line GL starts empty. */
  defaultExpenseAccount?: string;
  /** Partner-level payment methods this vendor accepts (values match
   *  PAYMENT_METHODS in mockPayments). The Record-payment flow offers these and
   *  defaults to `primaryPaymentMethod`. */
  paymentMethods?: string[];
  primaryPaymentMethod?: string;
  /** The vendor's standard restocking fee, as a percentage of the value of
   *  the goods coming back. Absent on most of them, because most vendors have
   *  never been asked and the buyer finds out on the first return. That gap is
   *  the whole point of asking: a fee quoted once is worth keeping. */
  restockingFeePct?: number;
}

// Deterministic per-vendor payment-method sets (values match
// mockPayments.PAYMENT_METHODS). Pulled into the Record-payment flow so the
// method field reflects what the partner actually accepts, defaulting to the
// primary. Index-seeded so a vendor always gets the same set.
const VENDOR_METHOD_SETS: { methods: string[]; primary: string }[] = [
  { methods: ['ACH', 'Wire', 'Check'], primary: 'ACH' },
  { methods: ['Wire', 'Bank Transfer'], primary: 'Wire' },
  { methods: ['Card', 'ACH'], primary: 'Card' },
  { methods: ['Check', 'ACH', 'Bank Transfer'], primary: 'Check' },
  { methods: ['Bank Transfer', 'ACH', 'Wire', 'Card'], primary: 'Bank Transfer' },
];

/** What a vendor is, in the words the picker already uses.
 *
 *  This is `StandaloneVendorSelectionModal`'s `describeVendor`, lifted here so
 *  the RMA cards and the picker say the same thing about the same vendor
 *  rather than each carrying their own sentence. It is long on purpose: the
 *  cards truncate it to a line and expand it on `more`, the same way an item's
 *  description behaves on the first step.
 *
 *  Empty for a name that is not in the book, which is what an invoice-sourced
 *  vendor can be. A card with no subtitle reads better than one carrying a
 *  sentence about a vendor nobody has on file. */
export function vendorDescription(vendorName: string): string {
  const v = mockVendors.find((x) => x.vendorName === vendorName);
  if (!v) return '';
  return `${v.category} vendor specializing in ${v.type.toLowerCase()} operations. Established supplier with ${v.currency} settlements on ${v.paymentTerms} terms. Active across multiple purchase orders with consistent on-time delivery and competitive pricing for the supply chain.`;
}

/** Deterministic per-vendor payment methods by name — works for any vendor
 *  string (including invoice-sourced names that aren't in mockVendors), so the
 *  Record-payment flow can always resolve a partner-level method set + primary. */
export function paymentMethodsForVendor(vendorName: string): { methods: string[]; primary: string } {
  const h = (vendorName || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  return VENDOR_METHOD_SETS[h % VENDOR_METHOD_SETS.length];
}

const vendorCategories = [
  'Seller (Items)',
  'Sub Contractor',
  'Service Provider',
  'Carrier'
];

/** Vendors added after the original forty, and their branches.
 *
 *  Held apart rather than appended to `VENDOR_NAMES`, because a vendor's index
 *  is what its supply, its serialized roster and its sole-sourced parts are
 *  keyed on: adding a name in the middle of that list would have moved every
 *  vendor after it and rewritten stock nobody asked to change. These take the
 *  indices after the families instead, so the first forty-six are exactly
 *  where they were. */
const EXTRA_VENDORS = [
  'Acme Industrial Supply',
  'Toyota Material Handling',
  'Honda Power Equipment',
];
/** Where they start, which is straight after the family branches. */
const EXTRA_FROM = 46;
/** They all sell parts, so the four-way category cycle does not decide it for
 *  them: a maker of forklifts is not a carrier because of where it landed in
 *  a list. */
const EXTRA_CATEGORY = 'Seller (Items)';

/** Numbered stock is billed in full.
 *
 *  Mock, and deliberate: the credit-or-refund step only exists where the money
 *  has already gone out, so with the ordinary spread of invoice states a
 *  serialized return reached the end of the flow without ever being asked how
 *  it settles. Every unit that carries a number is invoiced, so every return
 *  of one has the decision to make. Counted stock keeps the mixed states,
 *  which is where the unbilled and part-billed cases are demonstrated. */
const invoicedQtyForLine = (sku: string, qty: number, invoiced: number) => {
  if (modeOfSku(sku) === 'serialized' || modeOfSku(sku) === 'lot-serialized') return qty;
  if (invoiced > 0) return invoiced;
  // Counted stock keeps its mixed states, but "never billed at all" was most
  // of the book: more than half of counted receipt lines carried no invoice,
  // so a return laid across the newest deliveries usually found nothing paid
  // and the settlement step had nothing to ask about. One line in four stays
  // unbilled, which is the state worth demonstrating; the rest are billed for
  // most of what they carry and settle in part.
  // Billed for most of what it carries, always. Whether any of it has been
  // *paid* is the five-band question in `paidQtyForReceiptLine`, and that is
  // where the unbilled-looking states come from. Leaving receipts uninvoiced
  // here as well meant a vendor could hold a part whose every delivery was
  // open, and a return of it reached the end of the flow with nothing to
  // settle and no question asked.
  return Math.max(1, Math.round(qty * 0.75));
};

/**
 * Vendor names, written out rather than assembled.
 *
 * They used to be a prefix crossed with a suffix -- Global Corp, Premier Corp,
 * Superior Corp -- which read as filler and, worse, made vendors hard to tell
 * apart: three suppliers on one item all looked like the same company with a
 * different adjective. These are distinct enough to recognise at a glance and
 * to search for.
 *
 * Ordered to match the category cycle in `vendorCategories`, so a vendor's name
 * suits the work it does: suppliers and distributors, then fabrication shops,
 * then service firms, then hauliers, repeating.
 */
const VENDOR_NAMES = [
  // 0 Seller · 1 Sub Contractor · 2 Service Provider · 3 Carrier, repeating.
  'Halverson Industrial Supply', 'Vantage Fabrication Works', 'Sable Calibration Services', 'Harrow Freight Lines',
  'Brightwater Materials', 'Redstone Machining Co.', 'Orchard Testing Laboratories', 'Sterling Road Transport',
  'Kestrel Fasteners & Fixings', 'Copperfield Welding', 'Fenwick Inspection Group', 'Bayline Logistics',
  'Ironvale Steel & Alloy', 'Arbor Precision Engineering', 'Bellrock Maintenance Services', 'Crestwood Carriers',
  'Northgate Electrical Supply', 'Waypoint Assembly Services', 'Thistledown Consulting', 'Juniper Freight Systems',
  'Cedarline Components', 'Kilnhouse Metalworks', 'Marlowe Field Services', 'Oakmoor Transport',
  'Blackrock Bearings', 'Trellis Sheet Metal', 'Ridgeway Technical Services', 'Silverbrook Logistics',
  'Sandalwood Packaging', 'Granite Tooling Partners', 'Aldercroft Quality Assurance', 'Tallgrass Freight',
  'Meridian Tool & Abrasive', 'Ashford Fabrication', 'Pinnacle Compliance Partners', 'Winslow Shipping Lines',
  'Foxglove Chemical Supply', 'Larkspur Manufacturing', 'Weatherby Engineering Services', 'Drayton Haulage',
];

/**
 * The six vendors that used to be three pairs of branches.
 *
 * They were modelled as families -- Calderon Supply California and Texas,
 * Ardmore North and South, Kellerman East and West -- so a return could land on
 * two branches of one company and be asked whether to merge them. Every vendor
 * is its own company now, with a name nobody can mistake for another's, so
 * there is nothing to merge and no sibling to keep beside anything.
 *
 * They keep their indices, because a vendor's supply, its serialized roster and
 * its sole-sourced parts are keyed on them.
 */
const SPLIT_VENDOR_NAMES: Record<number, string> = {
  40: 'Calderon Supply',
  41: 'Marchetti Components',
  42: 'Ardmore Industrial',
  43: 'Fairhaven Supply Group',
  44: 'Kellerman Metals',
  45: 'Stonebridge Alloys',
};

/** Vendors that carry the broad book rather than one corner of it. The three
 *  pairs did, between them, and a catalogue with no deep suppliers in it makes
 *  the by-vendor route a list of shortlists. */
const BROAD_LINE = new Set<number>([40, 41, 42, 43, 44, 45, EXTRA_FROM, EXTRA_FROM + 1, EXTRA_FROM + 2]);



/** Mirrors `trackingModeFor` in mockRMAs, which reads this file: importing it
 *  back would close the loop. The prefixes have to be kept in step. */
const isSerializedSku = (sku: string) =>
  sku.startsWith('ELEC-') || sku.startsWith('SENS-') || sku.startsWith('TECH-');

/** The four control types, from the same prefixes, for the same reason. */
const modeOfSku = (sku: string): 'serialized' | 'lot-serialized' | 'lot' | 'none' => {
  if (isSerializedSku(sku)) return 'serialized';
  if (sku.startsWith('WASH-') || sku.startsWith('CAB-')) return 'lot-serialized';
  if (sku.startsWith('BOLT-') || sku.startsWith('NUT-')) return 'lot';
  return 'none';
};

/** What a numbered part is counted in.
 *
 *  Whatever its catalogue says. A serial is a rule about divisibility, not
 *  about eaches: a pallet, a truckload or a metre stick can each carry one
 *  number, and what makes it serialized is that it goes back whole. There is
 *  no partial consumption and no conversion into another unit. A lot is the
 *  divisible equivalent, which is why a lot can be counted out and a serial
 *  cannot.
 *
 *  Eaches are the common case and the catalogue is written that way, so this
 *  is deliberately not a rule the data enforces. */
const uomOfSku = (_sku: string, catalogueUom: string): string => catalogueUom;

function generateVendorName(index: number): string {
  if (SPLIT_VENDOR_NAMES[index]) return SPLIT_VENDOR_NAMES[index]!;
  if (index >= EXTRA_FROM) return EXTRA_VENDORS[index - EXTRA_FROM] ?? VENDOR_NAMES[index % VENDOR_NAMES.length]!;
  return VENDOR_NAMES[index % VENDOR_NAMES.length]!;
}

// Shared image pool — every catalogue entry picks one of these via a
// deterministic hash so we don't store unique image URLs per item.
const ITEM_IMG_POOL = [
  'https://images.unsplash.com/photo-1672689933227-2ce1249c46a9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80',
  'https://images.unsplash.com/photo-1767340078306-89630b12d81c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80',
  'https://images.unsplash.com/photo-1769355104335-acef3aa4c9b6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80',
  'https://images.unsplash.com/photo-1758857087505-957823893209?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80',
  'https://images.unsplash.com/photo-1713575882582-8938739db351?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80',
  'https://images.unsplash.com/photo-1737223450913-2af6885945e1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80',
  'https://images.unsplash.com/photo-1759159091728-e2c87b9d9315?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80',
  'https://images.unsplash.com/photo-1661069387900-54d5843b704d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80',
];
const imgForSku = (sku: string) => {
  let h = 0;
  for (let i = 0; i < sku.length; i++) h = sku.charCodeAt(i) + ((h << 5) - h);
  return ITEM_IMG_POOL[Math.abs(h) % ITEM_IMG_POOL.length];
};

// 35-entry catalogue spanning electronics, hardware, hydraulic, safety,
// packaging, office, machinery, tooling, raw material, and consumables.
// Picker rendering can now sample broadly so adjacent POs surface
// noticeably different line items.
const ITEM_CATALOGUE = [
  // Electronics. ELEC-, SENS- and TECH- are serialized in trackingModeFor,
  // and a serial identifies one physical unit, so these are always EA.
  { sku: 'ELEC-M-992', desc: 'Power Management IC - High Efficiency 450V', uom: 'EA' },
  { sku: 'ELEC-CAP-470', desc: 'Capacitor 470uF 50V Electrolytic', uom: 'EA' },
  { sku: 'ELEC-PCB-A4', desc: 'PCB Substrate FR4 - Single Layer', uom: 'EA' },
  { sku: 'ELEC-LED-W5', desc: 'High-Lumen White LED Module 5W', uom: 'EA' },
  { sku: 'ELEC-SENS-T1', desc: 'Industrial Temperature Sensor PT100', uom: 'EA' },
  // Cabling. CAB- is lot-serialized in trackingModeFor -- a batch of
  // numbered drums -- and a numbered unit is one thing, so these are EA
  // rather than a length.
  { sku: 'CAB-XL-10', desc: 'Heavy Duty 10AWG Copper Cable - Shielded', uom: 'EA' },
  { sku: 'CAB-FOC-12', desc: 'Fiber Optic Cable 12-Strand Single-Mode', uom: 'EA' },
  { sku: 'CAB-CAT6-FT', desc: 'CAT6 Ethernet Cable - Plenum Rated', uom: 'EA' },
  // Hardware
  { sku: 'BRKT-IND-22', desc: 'Mounting Brackets - Galvanized Steel', uom: 'units' },
  { sku: 'BOLT-M12-H', desc: 'Hex Head Bolts M12 x 50mm - Stainless', uom: 'BOX' },
  { sku: 'NUT-M12-L', desc: 'Lock Nuts M12 - Nyloc Stainless', uom: 'BOX' },
  // WASH- is lot-serialized too, so the same rule: EA, not a box.
  { sku: 'WASH-M12', desc: 'Flat Washers M12 - Zinc Plated', uom: 'EA' },
  // Raw material
  { sku: 'STEEL-001', desc: 'Industrial Steel Pipes 2"', uom: 'EA' },
  { sku: 'STEEL-SHEET-4', desc: 'Steel Sheet 4mm Hot-Rolled', uom: 'SHT' },
  { sku: 'ALU-EXT-2X', desc: 'Aluminum Extrusion 2"x2" T-Slot', uom: 'FT' },
  { sku: 'COPPER-042', desc: 'Copper Fittings 1/2" NPT', uom: 'FT' },
  // Welding / Tools
  { sku: 'WELD-99', desc: 'Welding Rods Pack E7018', uom: 'PK' },
  { sku: 'WELD-WIRE-S', desc: 'MIG Welding Wire 0.045" - Steel', uom: 'RL' },
  { sku: 'TOOL-DRL-18V', desc: 'Cordless Drill Driver 18V', uom: 'SET' },
  { sku: 'TOOL-WRN-MET', desc: 'Metric Combination Wrench Set 8-19mm', uom: 'SET' },
  { sku: 'TOOL-CAL-DG', desc: 'Digital Caliper 6" Stainless', uom: 'EA' },
  // Sold by one vendor group each, across both of that group's branches.
  { sku: 'PUMP-CI-40', desc: 'Cast Iron Centrifugal Pump 40mm, close-coupled', uom: 'EA' },
  { sku: 'PLATE-AL-6', desc: 'Aluminium Plate 6mm 5052-H32, mill finish', uom: 'SHT' },
  // Hydraulic
  { sku: 'HYD-FL-5L', desc: 'Hydraulic Fluid AW46 - 5L', uom: 'LBS' },
  { sku: 'HYD-HOSE-1', desc: 'Hydraulic Hose 1" SAE 100R2 - Per Foot', uom: 'FT' },
  { sku: 'HYD-PMP-A2', desc: 'Hydraulic Gear Pump 2.5GPM', uom: 'EA' },
  // Safety / PPE
  { sku: 'SAFE-H-01', desc: 'Safety Helmets - ANSI Class E', uom: 'EA' },
  { sku: 'SAFE-GLASS', desc: 'Anti-Fog Safety Glasses', uom: 'EA' },
  { sku: 'SAFE-VEST-HV', desc: 'High-Visibility Safety Vest Class 2', uom: 'EA' },
  { sku: 'GLOVE-B', desc: 'Work Gloves (Bulk Pack)', uom: 'KG' },
  { sku: 'EAR-PRO-PK', desc: 'Disposable Ear Plugs Pack of 200', uom: 'BOX' },
  // Office / Tech
  { sku: 'TECH-PC-01', desc: 'Office Workstation Hardware Pro', uom: 'EA' },
  { sku: 'TECH-MON-27', desc: '27" 4K Monitor - HDMI/DP', uom: 'EA' },
  { sku: 'OFFICE-CHR', desc: 'Ergonomic Task Chair - Mesh Back', uom: 'EA' },
  // Packaging / Consumables
  { sku: 'PKG-BOX-L', desc: 'Corrugated Shipping Box Large 18x18x18', uom: 'BOX' },
  { sku: 'PKG-WRAP-R', desc: 'Stretch Wrap Roll 18" x 1500ft', uom: 'RL' },
  { sku: 'PKG-LABEL-4', desc: 'Thermal Shipping Labels 4x6 Pack', uom: 'PK' },
];

/** Where one section of the catalogue stops and the next begins. The list is
 *  authored in runs -- electronics, cabling, hardware, raw material, welding
 *  and tooling, hydraulic, safety, office, packaging -- and a vendor sells
 *  sections of it, not a scattering of unrelated parts. */
const CATEGORY_SPANS: Array<[number, number]> = [
  [0, 5], [5, 8], [8, 12], [12, 16], [16, 21], [21, 24], [24, 29], [29, 32], [32, 35],
];

/** Parts exactly one vendor sells.
 *
 *  A single-source part answers its own vendor question: the return locks to
 *  that vendor and never asks. The flow has always been able to show that --
 *  a line locks when it finds one supplier -- but it could never happen while
 *  every vendor sold every part, so the branch was unreachable. */
const SOLE_SOURCED: Record<string, number> = {
  'HYD-PMP-A2': 13,
  'TECH-MON-27': 21,
  'PKG-LABEL-4': 6,
};

/** Who is allowed to sell a serialized part.
 *
 *  Every ELEC- and TECH- part was on twelve vendors' books across all three
 *  families, so naming a handful of units on a serialized line opened a merge
 *  and split step with a dozen cards on it -- more vendors than anyone raising
 *  one return has ever dealt with, and too many branches to see the grouping
 *  decision inside. The roster is the shape the step is meant to show:
 *
 *    two companies with their branches nested under them, and three more
 *    vendors standing on their own.
 *
 *  Ardmore and Kellerman are the nested pairs, which is what keeps the merge
 *  case reachable off any serialized line. Calderon Texas carries the group's
 *  serialized side on its own. The last two are ordinary vendors, one of them
 *  the sole source of TECH-MON-27.
 *
 *  Counted stock is untouched: it is the broad book, and a washer being on
 *  thirty vendors' shelves is the reason the vendor step has a search on it. */
const SERIALIZED_SELLERS = new Set<number>([
  46, 47, 48, // Acme, Toyota and Honda -- names people go looking for, so a
  //             serialized part has to be able to come back to them

  42, 43, // Ardmore Industrial North / South -- nested under Ardmore Industrial
  44, 45, // Kellerman Metals East / West     -- nested under Kellerman Metals
  41, //     Calderon Supply Texas            -- on its own
  21, //     sole source of TECH-MON-27       -- on its own
  9, //      on its own
]);

/** Which parts a vendor actually sells.
 *
 *  A vendor that carries the entire catalogue is not a supply chain, it is a
 *  rendering artifact -- and it was the reason a return had to ask which of
 *  forty vendors a washer came back from. Real supply is skewed: a couple of
 *  broad-line distributors carry most of the book, a few mid-range houses
 *  carry several sections, and everyone else sells their own corner. The
 *  by-vendor route needs the deep catalogues to have something worth
 *  searching; the by-item route needs parts that are not sold by everyone. */
function supplyFor(vendorCode: string): typeof ITEM_CATALOGUE {
  // Codes read V-01000 upward, so the trailing number is the vendor's index
  // in the list -- which is what the tiers and the sole-source owners key on.
  const n = (parseInt(vendorCode.replace(/\D/g, ''), 10) || 1000) - 1000;
  // The broad-line suppliers carry the whole book.
  //
  // They were three pairs of branches, and each pair held everything so that a
  // return could always find two branches of one company to be asked about.
  // The companies are six separate vendors now, and what is worth keeping from
  // that arrangement is the depth: a catalogue whose every vendor sells one
  // corner makes the by-vendor route a list of shortlists, and leaves a part
  // with two suppliers where it should have five.
  if (BROAD_LINE.has(n)) {
    const book = ITEM_CATALOGUE.filter(
      (item) =>
        (!isSerializedSku(item.sku) || SERIALIZED_SELLERS.has(n)) &&
        SOLE_SOURCED[item.sku] === undefined,
    );
    // One of each control type, always. A vendor missing a whole tracking kind
    // is a vendor half the flow cannot be demonstrated against.
    (['serialized', 'lot-serialized', 'lot', 'none'] as const).forEach((mode) => {
      if (book.some((item) => modeOfSku(item.sku) === mode)) return;
      const entry = ITEM_CATALOGUE.find(
        (item) => modeOfSku(item.sku) === mode && SOLE_SOURCED[item.sku] === undefined,
      );
      if (entry) book.push(entry);
    });
    return book;
  }
  const sections = n % 19 === 2 ? 5 : n % 7 === 3 ? 2 : 1;
  // Step by 4, not 3: three shares a factor with nine, so a step of three
  // would land every specialist on one of three sections and leave two thirds
  // of the catalogue sold only by the distributors.
  const start = (n * 4) % CATEGORY_SPANS.length;
  const picked: typeof ITEM_CATALOGUE = [];
  for (let s = 0; s < sections; s++) {
    const [from, to] = CATEGORY_SPANS[(start + s) % CATEGORY_SPANS.length]!;
    picked.push(...ITEM_CATALOGUE.slice(from, to));
  }
  const out = picked.filter(
    (item) =>
      (SOLE_SOURCED[item.sku] ?? n) === n &&
      // Off the roster, a serialized part is not on this vendor's book at all.
      (!isSerializedSku(item.sku) || SERIALIZED_SELLERS.has(n)),
  );
  // And on it, it is -- whichever sections of the catalogue this vendor's
  // rotation happened to land on. A roster of five that only three of them
  // could actually supply is not a roster.
  if (SERIALIZED_SELLERS.has(n)) {
    ITEM_CATALOGUE.forEach((item) => {
      if (!isSerializedSku(item.sku)) return;
      if ((SOLE_SOURCED[item.sku] ?? n) !== n) return;
      if (out.some((i) => i.sku === item.sku)) return;
      out.push(item);
    });
  }
  // Its one vendor carries it wherever in the catalogue it happens to sit.
  Object.entries(SOLE_SOURCED).forEach(([sku, owner]) => {
    if (owner !== n || out.some((i) => i.sku === sku)) return;
    const entry = ITEM_CATALOGUE.find((i) => i.sku === sku);
    if (entry) out.push(entry);
  });
  return out;
}

function generatePOs(vendorCode: string, count: number, locations: VendorLocation[]): VendorPO[] {
  const pos: VendorPO[] = [];
  const statuses = ['Open', 'Partially Received', 'Fully Received', 'Closed', 'Partially Invoiced', 'Fully Invoiced'];

  // A PO can only list what this vendor sells, so every count and every
  // rotation below is bounded by their book rather than by the catalogue.
  const supply = supplyFor(vendorCode);

  // Per-PO line-count buckets so adjacent POs visibly differ in scale.
  // Cycle through small / medium / large / extra-large so a vendor's
  // PO list reads as a mix.
  const countBuckets: Array<[number, number]> = [
    [8, 14],   // small PO
    [18, 26],  // medium
    [34, 44],  // large
    [50, 60],  // extra large
  ];

  for (let i = 0; i < count; i++) {
    const year = 2024;
    const month = (i % 12) + 1;
    const [minCnt, maxCnt] = countBuckets[i % countBuckets.length];
    // A PO never lists the same product twice, so it cannot run longer than
    // the catalogue it is drawn from.
    const itemCount = Math.min(
      Math.floor(rand() * (maxCnt - minCnt + 1)) + minCnt,
      supply.length,
    );
    const items: LineItem[] = [];
    let poAmount = 0;
    let invoicedAmount = 0;

    const poStatus = statuses[i % statuses.length];

    // Each PO advances its starting offset by a non-trivial step so
    // adjacent POs sample different sections of the catalogue. Prime
    // step (7) over a 35-entry list keeps the rotation aperiodic
    // across the typical 5-7 POs per vendor.
    const itemListOffset = (i * 7) % supply.length;
    for (let j = 0; j < itemCount; j++) {
      const baseItem = supply[(j + itemListOffset) % supply.length];
      const qty = Math.floor(rand() * 50) + 10;
      const price = Math.round((rand() * 50 + 5) * 100) / 100;
      const total = Math.round(qty * price * 100) / 100;
      
      let receivedQty = 0;
      let invoicedQty = 0;

      if (poStatus === 'Fully Received' || poStatus === 'Fully Invoiced' || poStatus === 'Closed') {
        receivedQty = qty;
      } else if (poStatus === 'Partially Received') {
        receivedQty = Math.floor(qty * 0.5);
      }

      if (poStatus === 'Fully Invoiced' || poStatus === 'Closed') {
        invoicedQty = qty;
      } else if (poStatus === 'Partially Invoiced') {
        invoicedQty = Math.floor(qty * 0.4);
      }

      poAmount += total;
      invoicedAmount += (invoicedQty * price);

      // The catalogue item number is the item number. Two vendors quoting the
      // same product have to land on the same row when the picker leads with
      // the item, which a per-line suffix would break.
      items.push({
        id: `item-${vendorCode}-${i}-${j}`,
        sku: baseItem.sku,
        description: baseItem.desc,
        quantity: qty,
        uom: uomOfSku(baseItem.sku, baseItem.uom),
        unitPrice: price,
        totalPrice: total,
        receivedQty: receivedQty,
        invoicedQty: invoicedQtyForLine(baseItem.sku, qty, invoicedQty),
        image: imgForSku(baseItem.sku),
      });
    }

    pos.push({
      // Plain integer PO sequence per BA UX feedback — vendor index
      // determines the hundred (V002 -> 1020s, V003 -> 1030s, …) so
      // numbers stay unique across the dataset while still reading
      // as a flat sequence to the user.
      poNumber: String(1000 + parseInt(vendorCode.split('-')[1] || '0') * 10 + i + 1),
      originId: originForPOIndex(i, locations),
      poDate: `${year}-${String(month).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
      poAmount: Math.round(poAmount * 100) / 100,
      invoicedAmount: Math.round(invoicedAmount * 100) / 100,
      status: poStatus,
      itemCount: itemCount,
      items: items
    });
  }
  
  return pos;
}

// Receiving documents read as one flat four-digit sequence (Rec-1231)
// across the dataset, the same convention PO numbers follow. Module scope
// keeps it stable: the vendor data is built once at import.
/** A receipt is partially invoiced line by line, not as a block: the vendor
 *  can bill one line in full, part of the next, and none of the third. Keyed
 *  off the line's position so a receipt reads the same on every reload. */
function partialInvoicedQty(qty: number, idx: number): number {
  if (qty <= 0) return 0;
  if (idx % 3 === 0) return 0;
  if (idx % 3 === 1) return qty;
  if (qty === 1) return 1;
  return Math.min(qty - 1, Math.max(1, Math.round(qty * 0.45)));
}

let receivingSeq = 1200;
const nextReceivingNumber = () => `Rec-${receivingSeq++}`;

function generateGRNs(pos: VendorPO[]): VendorGRN[] {
  const grns: VendorGRN[] = [];
  const statuses = ['Received', 'Inspected', 'Accepted', 'Partially Invoiced', 'Fully Invoiced'];
  
  // Logic for Multi-PO and Multi-GRN mapping
  // We'll process some POs normally, and some in a complex way
  
  const processedPOIndices = new Set<number>();

  // 1. Create a consolidated GRN that spans multiple POs
  if (pos.length >= 2) {
    const po1 = pos[0];
    const po2 = pos[1];
    
    const combinedItems: LineItem[] = [];
    [po1, po2].forEach(po => {
      po.items.slice(0, 3).forEach(item => {
        if ((item.receivedQty || 0) > 0) {
          combinedItems.push({
            ...item,
            quantity: item.receivedQty || 0,
            totalPrice: Math.round((item.unitPrice * (item.receivedQty || 0)) * 100) / 100,
            invoicedQty: invoicedQtyForLine(item.sku, item.receivedQty || 0, item.invoicedQty ?? 0),
          });
        }
      });
    });

    if (combinedItems.length > 0) {
      grns.push({
        grnNumber: nextReceivingNumber(),
        originId: po1!.originId,
        grnDate: '2024-12-15',
        receivedQty: combinedItems.reduce((sum, item) => sum + item.quantity, 0),
        poNumber: `${po1.poNumber}, ${po2.poNumber}`,
        status: 'Accepted',
        items: combinedItems
      });
    }
  }

  // 2. Create multiple receiving documents for 3 POs (to ensure 3+ GRNs)
  const poIndicesToSplit = [2, 3, 4].filter(idx => idx < pos.length);
  
  poIndicesToSplit.forEach(idx => {
    const po = pos[idx];
    if (po.status === 'Open' || po.items.every(i => (i.receivedQty || 0) === 0)) return;
    
    const splitCount = 3 + (idx % 2); // 3 or 4
    const testItems = po.items.filter(item => (item.receivedQty || 0) > 0);
    
    if (testItems.length === 0) return;

    // We track how much of each item has been assigned to GRNs
    const assignedQtys = new Map<string, number>();

    for (let i = 0; i < splitCount; i++) {
      const grnDate = new Date(po.poDate);
      grnDate.setDate(grnDate.getDate() + 5 + i + (idx * 2));

      const grnItems = testItems.map(item => {
        const totalReceived = item.receivedQty || 0;
        const previouslyAssigned = assignedQtys.get(item.id) || 0;
        const remaining = totalReceived - previouslyAssigned;
        
        if (remaining <= 0) return null;

        let qty = 0;
        if (i === splitCount - 1) {
          // Last GRN gets the rest
          qty = remaining;
        } else {
          // Randomly decide if this item is in this GRN (80% chance for variety)
          if (rand() > 0.8 && testItems.length > 3) return null;
          
          // Assign a random portion (between 10% and 50% of total)
          const randomFactor = 0.1 + (rand() * 0.4);
          qty = Math.max(1, Math.floor(totalReceived * randomFactor));
          qty = Math.min(qty, remaining - (splitCount - 1 - i)); // Ensure enough left for future GRNs
        }
        
        if (qty <= 0) return null;
        
        assignedQtys.set(item.id, previouslyAssigned + qty);
          
        return {
          ...item,
          quantity: qty,
          totalPrice: Math.round((item.unitPrice * qty) * 100) / 100,
          invoicedQty: invoicedQtyForLine(item.sku, qty, item.invoicedQty ?? 0),
        };
      }).filter((item): item is LineItem => item !== null);

      if (grnItems.length > 0) {
        grns.push({
          grnNumber: nextReceivingNumber(),
          originId: po!.originId,
          grnDate: grnDate.toISOString().split('T')[0],
          receivedQty: grnItems.reduce((sum, item) => sum + item.quantity, 0),
          poNumber: po.poNumber,
          status: 'Received',
          items: grnItems
        });
      }
    }
    processedPOIndices.add(idx);
  });

  // 3. Process remaining POs normally
  pos.forEach((po, index) => {
    if (processedPOIndices.has(index)) return;
    if (po.status === 'Open' || po.items.every(i => (i.receivedQty || 0) === 0)) return;

    const poDate = new Date(po.poDate);
    const grnDate = new Date(poDate);
    grnDate.setDate(grnDate.getDate() + Math.floor(rand() * 10) + 5);
    
    const grnItems: LineItem[] = po.items
      .filter(item => (item.receivedQty || 0) > 0)
      .map(item => ({
        ...item,
        quantity: item.receivedQty || 0,
        totalPrice: Math.round((item.unitPrice * (item.receivedQty || 0)) * 100) / 100,
        invoicedQty: invoicedQtyForLine(item.sku, item.receivedQty || 0, item.invoicedQty ?? 0),
      }));

    if (grnItems.length > 0) {
      grns.push({
        grnNumber: nextReceivingNumber(),
        originId: po.originId,
        grnDate: grnDate.toISOString().split('T')[0],
        receivedQty: grnItems.reduce((sum, item) => sum + item.quantity, 0),
        poNumber: po.poNumber,
        status: po.status === 'Fully Invoiced' ? 'Fully Invoiced' : statuses[index % statuses.length],
        items: grnItems
      });
    }
  });
  
  return grns;
}

export const mockVendors: Vendor[] = Array.from({ length: EXTRA_FROM + EXTRA_VENDORS.length }, (_, index) => {
  const vendorCode = `V-${String(1000 + index).padStart(5, '0')}`;
  const vendorName = generateVendorName(index);
  const category =
    index >= EXTRA_FROM ? EXTRA_CATEGORY : vendorCategories[index % vendorCategories.length];
  
  const locations = buildVendorLocations(vendorCode, vendorName);

  let pos: VendorPO[];
  let grns: VendorGRN[];

  if (index === 0) {
    // Special case for the first vendor to have complex data
    // We need: Open, Partially Received, Fully Received, Partially Invoiced
    const statuses = ['Open', 'Partially Received', 'Fully Received', 'Partially Invoiced', 'Closed', 'Fully Invoiced'];
    pos = [];
    grns = [];

    // Per-PO size variance for Acme so the picker shows genuinely
    // different scales side-by-side (10, 28, 18, 42, 14, 50).
    const acmeItemCounts = [10, 28, 18, 42, 14, 50];
    // Per-PO unit price so totals don't all collapse to the same number.
    const acmePrices = [45.0, 28.5, 62.0, 51.25, 38.75, 84.0];
    // The broadest book in the list, but not a universal one: a part with a
    // single source has that source, and the head distributor is not it. Nor
    // is it on the serialized roster -- the head distributor carrying every
    // serialized part is what put itself on top of every serialized return's
    // vendor list, and this is the one vendor whose book is written here
    // rather than by `supplyFor`, so the roster has to be applied twice.
    const acmeSupply = ITEM_CATALOGUE.filter(
      (item) =>
        SOLE_SOURCED[item.sku] === undefined &&
        (!isSerializedSku(item.sku) || SERIALIZED_SELLERS.has(index)),
    );

    statuses.forEach((status, i) => {
      const itemCount = Math.min(acmeItemCounts[i] ?? 12, acmeSupply.length);
      const items: LineItem[] = [];
      let poAmount = 0;
      let invoicedAmount = 0;

      // Each Acme PO samples a different aperiodic slice of the shared
      // catalogue (prime step over 35 entries) so PO 1 shows
      // electronics, PO 2 shows hardware/raw material, PO 3 shows
      // safety/PPE, etc., without overlap.
      const offset = (i * 11) % acmeSupply.length;
      for (let j = 0; j < itemCount; j++) {
        const baseItem = acmeSupply[(j + offset) % acmeSupply.length];

        const qty = 100;
        const price = acmePrices[i] ?? 50.0;
        const total = qty * price;

        let receivedQty = 0;
        let invoicedQty = 0;

        // Received Qty Logic
        if (status === 'Fully Received' || status === 'Fully Invoiced' || status === 'Closed') {
          receivedQty = qty;
        } else if (status === 'Partially Received' || status === 'Partially Invoiced') {
          receivedQty = 60;
        } else if (status === 'Open') {
          receivedQty = 0;
        }

        // Invoiced Qty Logic
        if (status === 'Fully Invoiced' || status === 'Closed') {
          invoicedQty = qty;
        } else if (status === 'Partially Invoiced') {
          invoicedQty = 30;
        } else if (status === 'Open' && i === 0) {
          // Special case: Open PO that is Pre-Invoiced (no receipts, but invoiced)
          invoicedQty = 40;
        }

        poAmount += total;
        invoicedAmount += (invoicedQty * price);

        items.push({
          id: `item-${vendorCode}-${i}-${j}`,
          sku: baseItem.sku,
          description: baseItem.desc,
          quantity: qty,
          uom: uomOfSku(baseItem.sku, baseItem.uom),
          unitPrice: price,
          totalPrice: total,
          receivedQty: receivedQty,
          invoicedQty: invoicedQtyForLine(baseItem.sku, qty, invoicedQty),
          image: imgForSku(baseItem.sku),
        });
      }

      // V001 special-case POs land in 1001-1099 so they don't collide
      // with the V002+ band (1021+) emitted by generatePOs.
      const poNumber = String(1000 + i + 1);
      pos.push({
        poNumber,
        originId: originForPOIndex(i, locations),
        poDate: `2024-01-${String(i + 1).padStart(2, '0')}`,
        poAmount,
        invoicedAmount,
        status: status === 'Open' && invoicedAmount > 0 ? 'Partially Invoiced' : status,
        itemCount,
        items
      });

      // Create GRNs only for POs with receipts
      if (status !== 'Open') {
        const receivedItems = items.filter(item => (item.receivedQty || 0) > 0);
        if (receivedItems.length > 0) {
          // Distribute GRNs with random variety
          const splitCount = i < 3 ? 4 : 2;
          const assignedQtys = new Map<string, number>();
          
          for (let s = 0; s < splitCount; s++) {
             let grnStatus = 'Not Invoiced';
             
             // Target specific GRN distributions
             if (status === 'Partially Invoiced') {
                if (s === 0) grnStatus = 'Fully Invoiced';
                else if (s === 1) grnStatus = 'Partially Invoiced';
                else grnStatus = 'Not Invoiced';
             } else if (status === 'Fully Invoiced' || status === 'Closed') {
                grnStatus = 'Fully Invoiced';
             } else {
                // Receipt progress and billing progress are different axes: a
                // PO can still be filling while the receipts it has already
                // taken get billed at their own pace. Cycling the splits keeps
                // a return raised off these POs from reading as a column of
                // "Not invoiced".
                const cycle = ['Partially Invoiced', 'Fully Invoiced', 'Not Invoiced', 'Partially Invoiced'];
                grnStatus = cycle[(s + i) % cycle.length]!;
             }

             const finalItems = receivedItems.map((item, itemIdx) => {
                const totalReceived = item.receivedQty!;
                const previouslyAssigned = assignedQtys.get(item.id) || 0;
                const remaining = totalReceived - previouslyAssigned;

                if (remaining <= 0) return null;

                let share = 0;
                if (s === splitCount - 1) {
                  share = remaining;
                } else if (s === 0 && receivedItems.length >= 5) {
                  // Showcase a "partial GRN" case — the FIRST split keeps
                  // a deterministic subset (every 3rd item: indices 0, 3,
                  // 6, 9 …) instead of a random skip, so users can reliably
                  // demo the cross-tab selection sync: selecting this GRN
                  // ticks only those rows on the PO tab.
                  if (itemIdx % 3 !== 0) return null;
                  share = Math.max(1, Math.min(remaining, Math.floor(totalReceived * 0.4)));
                } else {
                  // Other splits: randomly skip some items (30% chance) and
                  // assign a 15-45% portion.
                  if (rand() > 0.7 && receivedItems.length > 2) return null;
                  const factor = 0.15 + (rand() * 0.3);
                  share = Math.max(1, Math.floor(totalReceived * factor));
                  share = Math.min(share, remaining - (splitCount - 1 - s));
                }

                if (share <= 0) return null;
                assignedQtys.set(item.id, previouslyAssigned + share);
                
                let itemInvoicedQty = 0;
                if (grnStatus === 'Fully Invoiced') itemInvoicedQty = share;
                else if (grnStatus === 'Partially Invoiced') itemInvoicedQty = partialInvoicedQty(share, itemIdx);

                return {
                  ...item,
                  quantity: share,
                  totalPrice: Math.round(share * item.unitPrice * 100) / 100,
                  invoicedQty: invoicedQtyForLine(item.sku, share, itemInvoicedQty)
                };
             }).filter((item): item is any => item != null) as LineItem[];

             if (finalItems.length > 0) {
                grns.push({
                  grnNumber: nextReceivingNumber(),
                  originId: originForPOIndex(i, locations),
                  grnDate: `2024-02-${String(1 + s * 5 + (i * 2)).padStart(2, '0')}`,
                  receivedQty: finalItems.reduce((sum, item) => sum + item.quantity, 0),
                  poNumber,
                  status: grnStatus,
                  items: finalItems,
                  vendorName,
                  vendorCode
                });
             }
          }
        }
      }
    });
  } else {
    const poCount = Math.floor(rand() * 3) + 8; 
    pos = generatePOs(vendorCode, poCount, locations);
    grns = generateGRNs(pos).map((grn, gIdx) => {
      // Cycled across every receipt rather than only the first few, so
      // branch origins get the same spread of statuses as headquarters.
      let grnStatus = grn.status;
      if (grnStatus !== 'Fully Invoiced' && grnStatus !== 'Partially Invoiced') {
        const slot = gIdx % 4;
        if (slot === 1) grnStatus = 'Fully Invoiced';
        else if (slot === 2 || slot === 3) grnStatus = 'Partially Invoiced';
        else grnStatus = 'Not Invoiced';
      }
      // The override has to reach the lines too. Without it a receipt reads
      // as invoiced while every line on it still says nothing was billed,
      // which is what the return flow shows per item.
      const items = grnStatus === grn.status
        ? grn.items
        : grn.items.map((item, idx) => ({
            ...item,
            invoicedQty:
              grnStatus === 'Fully Invoiced'
                ? item.quantity
                : grnStatus === 'Partially Invoiced'
                  ? partialInvoicedQty(item.quantity, idx)
                  : 0,
          }));
      return {
        ...grn,
        status: grnStatus,
        // The broad-line suppliers shipped last. Both defaults on the second
        // step read recency -- counted stock ranks its suppliers by it, and
        // named units take their vendor from whichever receipt the serial sits
        // in, in receipt order -- so dating these later puts a deep supplier on
        // the return rather than leaving it to be found in a list of five.
        grnDate: BROAD_LINE.has(index)
          ? `2025-0${1 + (gIdx % 6)}-${String(2 + (gIdx % 26)).padStart(2, '0')}`
          : grn.grnDate,
        items,
        vendorName,
        vendorCode
      };
    });
  }
  
  // First four rows pinned to the real team (feedback 7/16/26) — the same
  // convention as mockInvoices/mockPayments, so every data table leads
  // with Ahtisham, Eli, Mahreen and Rida.
  const creators = ['Ahtisham Ahmad', 'Eli Rosenbloom', 'Mahreen Ghafoor', 'Rida Iftikhar', 'Areeb Tanvir', 'Nophil', 'Sarah Chen', 'James Wilson', 'Maria Garcia', 'Robert Taylor', 'Linda Martinez'];
  const types: ('Domestic' | 'International' | 'Service' | 'Manufacturing')[] = ['Domestic', 'International', 'Service', 'Manufacturing'];
  
  const createdOn = `2024-${String(Math.floor(rand() * 12) + 1).padStart(2, '0')}-${String(Math.floor(rand() * 28) + 1).padStart(2, '0')}`;

  // Partner-level default expense account — seeded on ~2 of every 3 vendors
  // so the standalone-invoice auto-pull demos both the "pre-filled" and the
  // "no default configured" states. Every 3rd vendor intentionally has none.
  const expenseDefaults = ['6000 General & Admin', '6100 Office Supplies', '5000 Cost of Goods Sold'];
  let defaultExpenseAccount = index % 3 === 2 ? undefined : expenseDefaults[index % expenseDefaults.length];
  // Demo guarantee: the standalone vendor picker is sorted "Newest first", so
  // its first row (Superior Industries) is pinned to NO default — showing the
  // empty / must-pick case — and its second row (Acme Industries) carries a
  // default — showing the auto-pull case.
  if (vendorName === 'Superior Industries') defaultExpenseAccount = undefined;
  else if (vendorName === 'Acme Industries') defaultExpenseAccount = '6000 General & Admin';

  return {
    id: `vendor-${index + 1}`,
    vendorCode,
    vendorName,
    category,
    currency: 'USD',
    paymentTerms: ['Net 30', 'Net 45', 'Net 60', '2/10 Net 30'][index % 4],
    purchaseOrders: pos,
    receivingDocuments: grns,
    locations,
    createdBy: creators[index % creators.length],
    createdOn: createdOn,
    type: types[index % types.length],
    imageUrl: index % 3 === 0 ? `https://images.unsplash.com/photo-${index % 2 === 0 ? '1486406146926-c627a92ad1ab' : '1497366216548-37526070297c'}?auto=format&fit=crop&q=80&w=100&h=100` : undefined,
    defaultExpenseAccount,
    paymentMethods: paymentMethodsForVendor(vendorName).methods,
    primaryPaymentMethod: paymentMethodsForVendor(vendorName).primary,
    // About one vendor in four has a restocking fee on file. The rest have
    // never been asked, which is the state the approval prompt exists for: a
    // buyer who learns the fee on a call can put it on the record instead of
    // learning it again next quarter.
    ...(index % 4 === 2
      ? { restockingFeePct: [10, 15, 20, 25][Math.floor(index / 4) % 4]! }
      : {}),
  };
});
