/**
 * Mock data for the Purchasing subsystem — Slice 1A.
 *
 * • Qualified Vendors: 9 seeded entries copied verbatim from reference
 *   project b57d8e19-bdc7-48b9-ad8e-29d7b4909996 (`src/app/App.tsx`).
 * • Purchase Orders: deterministic generator copied verbatim from
 *   `src/app/components/purchase-orders-panel.tsx::generateMockOrders`.
 * • All 10 items in INITIAL_ITEMS receive their own QV + PO sets keyed
 *   by item id — the same id always yields the same data.
 */
import { INITIAL_ITEMS } from "../ItemsContext";
import type {
  AvailableVendor,
  PurchaseOrder,
  POStatus,
  QualifiedVendor,
  QualifiedVendorConfig,
  VendorContact,
} from "./types";

/* ================================================================
   Reference seed — 9 qualified vendors (verbatim copy)
   ================================================================ */
const SEED_QVS: QualifiedVendor[] = [
  {
    id: "1",
    priority: 1,
    vendorName: "Toyota International",
    vendorId: "V-99281",
    location: "Toyota City, Aichi, Japan",
    pricePerUnit: 986.37,
    currency: "$",
    acceptedDeviation: 5,
    vendorUOM: "m (Meter)",
    isPrimary: false,
    lastPOLeadTime: 12,
    averageLeadTime: 7,
    lastPOTotalAmount: 10919.33,
    lastPOPricePerUnit: 21.09,
    averagePricePerUnit: 919.83,
    priceFluctuation30d: -259.78,
    shipOnTime: 89,
    totalShipments: 56,
    onTimeShipments: 50,
    lotPerLeadTime: 12,
    onTimeAccuracy: 89,
    deliveryReliability: 95,
    rating: 5,
    partnerGroup: "Tier 1 Automotive",
    email: "procurement@toyota-intl.com",
    website: "www.toyota-intl.com",
    phone: "+1 (310) 781-4000",
    minOrderQty: 100,
    maxOrderQty: 5000,
    multiples: 50,
    pricingRules: "contracted",
  },
  {
    id: "2",
    priority: 2,
    vendorName: "Binford Ltd.",
    vendorId: "V-88742",
    location: "Shenzhen, Guangdong, China",
    pricePerUnit: 842.15,
    currency: "$",
    acceptedDeviation: 10,
    vendorUOM: "cm (Centimeter)",
    isPrimary: false,
    lastPOLeadTime: 10,
    averageLeadTime: 5,
    lastPOTotalAmount: 20235.56,
    lastPOPricePerUnit: 21.56,
    averagePricePerUnit: 920.56,
    priceFluctuation30d: -84.44,
    shipOnTime: 83,
    totalShipments: 42,
    onTimeShipments: 35,
    lotPerLeadTime: 10,
    onTimeAccuracy: 83,
    deliveryReliability: 90,
    rating: 4,
    partnerGroup: "Precision Parts",
    email: "orders@binford-ltd.cn",
    website: "www.binford-ltd.cn",
    phone: "+86 755 8888 1234",
    minOrderQty: 50,
    maxOrderQty: 3000,
    multiples: 25,
    pricingRules: "standard",
  },
  {
    id: "3",
    priority: 3,
    vendorName: "Barone LLC.",
    vendorId: "V-77293",
    location: "Port Melbourne, VIC, Australia",
    pricePerUnit: 1124.5,
    currency: "$",
    acceptedDeviation: 7,
    vendorUOM: "in (Inch)",
    isPrimary: false,
    lastPOLeadTime: 18,
    averageLeadTime: 14,
    lastPOTotalAmount: 7602.23,
    lastPOPricePerUnit: 25.23,
    averagePricePerUnit: 1022.23,
    priceFluctuation30d: 624.67,
    shipOnTime: 87,
    totalShipments: 31,
    onTimeShipments: 27,
    lotPerLeadTime: 18,
    onTimeAccuracy: 87,
    deliveryReliability: 92,
    rating: 5,
    partnerGroup: "Specialty Materials",
    email: "supply@barone.com.au",
    website: "www.barone.com.au",
    phone: "+61 3 9000 5678",
    minOrderQty: 200,
    maxOrderQty: 10000,
    multiples: 100,
    pricingRules: "volume",
  },
  {
    id: "4",
    priority: 4,
    vendorName: "Abstergo Ltd.",
    vendorId: "V-66104",
    location: "Houston, TX, United States",
    pricePerUnit: 753.2,
    currency: "$",
    acceptedDeviation: 7,
    vendorUOM: "ft (Feet)",
    isPrimary: false,
    lastPOLeadTime: 19,
    averageLeadTime: 14,
    lastPOTotalAmount: 4901.08,
    lastPOPricePerUnit: 28.08,
    averagePricePerUnit: 921.08,
    priceFluctuation30d: -596.13,
    shipOnTime: 83,
    totalShipments: 24,
    onTimeShipments: 20,
    lotPerLeadTime: 19,
    onTimeAccuracy: 83,
    deliveryReliability: 88,
    rating: 4,
    partnerGroup: "Industrial Supply",
    email: "vendorsupport@abstergo.com",
    website: "www.abstergo-ltd.com",
    phone: "+1 (806) 555-0142",
    minOrderQty: 75,
    maxOrderQty: 4000,
    multiples: 25,
    pricingRules: "standard",
  },
  {
    id: "5",
    priority: 5,
    vendorName: "Acme Co.",
    vendorId: "V-55782",
    location: "Detroit, MI, United States",
    pricePerUnit: 1298.75,
    currency: "$",
    acceptedDeviation: 12,
    vendorUOM: "km (Kilometer)",
    isPrimary: false,
    lastPOLeadTime: 9,
    averageLeadTime: 7,
    lastPOTotalAmount: 5031.01,
    lastPOPricePerUnit: 31.01,
    averagePricePerUnit: 931.01,
    priceFluctuation30d: -58.78,
    shipOnTime: 83,
    totalShipments: 48,
    onTimeShipments: 40,
    lotPerLeadTime: 9,
    onTimeAccuracy: 83,
    deliveryReliability: 85,
    rating: 3,
    partnerGroup: "General Manufacturing",
    email: "sales@acme-co.com",
    website: "www.acme-co.com",
    phone: "+1 (313) 555-0198",
    minOrderQty: 150,
    maxOrderQty: 8000,
    multiples: 50,
    pricingRules: "seasonal",
  },
  {
    id: "6",
    priority: 6,
    vendorName: "Lear Corporation",
    vendorId: "V-44921",
    location: "Southfield, MI, United States",
    pricePerUnit: 672.9,
    currency: "$",
    acceptedDeviation: 15,
    vendorUOM: "m (Meter)",
    isPrimary: false,
    lastPOLeadTime: 5,
    averageLeadTime: 4,
    lastPOTotalAmount: 1935.0,
    lastPOPricePerUnit: 35.0,
    averagePricePerUnit: 935.0,
    priceFluctuation30d: 139.75,
    shipOnTime: 80,
    totalShipments: 60,
    onTimeShipments: 48,
    lotPerLeadTime: 5,
    onTimeAccuracy: 80,
    deliveryReliability: 88,
    rating: 4,
    partnerGroup: "Tier 1 Automotive",
    email: "purchasing@lear.com",
    website: "www.lear.com",
    phone: "+1 (312) 555-0234",
    minOrderQty: 100,
    maxOrderQty: 6000,
    multiples: 100,
    pricingRules: "contracted",
  },
  {
    id: "7",
    priority: 7,
    vendorName: "Delphi Technologies",
    vendorId: "V-33421",
    location: "Gillingham, Kent, United Kingdom",
    pricePerUnit: 1475.0,
    currency: "$",
    acceptedDeviation: 2,
    vendorUOM: "km (Kilometer)",
    isPrimary: false,
    lastPOLeadTime: 10,
    averageLeadTime: 8,
    lastPOTotalAmount: 8937.53,
    lastPOPricePerUnit: 37.53,
    averagePricePerUnit: 937.53,
    priceFluctuation30d: 435.02,
    shipOnTime: 76,
    totalShipments: 38,
    onTimeShipments: 29,
    lotPerLeadTime: 10,
    onTimeAccuracy: 76,
    deliveryReliability: 82,
    rating: 3,
    partnerGroup: "Electronics & Sensors",
    email: "supply@delphitech.com",
    website: "www.delphitech.com",
    phone: "+1 (248) 555-0376",
    minOrderQty: 50,
    maxOrderQty: 2000,
    multiples: 10,
    pricingRules: "volume",
  },
  {
    id: "8",
    priority: 8,
    vendorName: "Magna International",
    vendorId: "V-22918",
    location: "Aurora, ON, Canada",
    pricePerUnit: 915.4,
    currency: "$",
    acceptedDeviation: 7,
    vendorUOM: "in (Inch)",
    isPrimary: false,
    lastPOLeadTime: 7,
    averageLeadTime: 6,
    lastPOTotalAmount: 3938.04,
    lastPOPricePerUnit: 38.04,
    averagePricePerUnit: 938.04,
    priceFluctuation30d: -120.5,
    shipOnTime: 80,
    totalShipments: 45,
    onTimeShipments: 36,
    lotPerLeadTime: 7,
    onTimeAccuracy: 80,
    deliveryReliability: 85,
    rating: 4,
    partnerGroup: "Tier 1 Automotive",
    email: "vendor.relations@magna.com",
    website: "www.magna.com",
    phone: "+1 (310) 555-0412",
    minOrderQty: 25,
    maxOrderQty: 1500,
    multiples: 25,
    pricingRules: "standard",
  },
  {
    id: "9",
    priority: 9,
    vendorName: "Adiant",
    vendorId: "V-11002",
    location: "Burscheid, NRW, Germany",
    pricePerUnit: 1089.6,
    currency: "$",
    acceptedDeviation: 8,
    vendorUOM: "ft (Feet)",
    isPrimary: false,
    lastPOLeadTime: 9,
    averageLeadTime: 7,
    lastPOTotalAmount: 6939.27,
    lastPOPricePerUnit: 39.27,
    averagePricePerUnit: 939.27,
    priceFluctuation30d: 251.79,
    shipOnTime: 73,
    totalShipments: 33,
    onTimeShipments: 24,
    lotPerLeadTime: 9,
    onTimeAccuracy: 73,
    deliveryReliability: 80,
    rating: 3,
    partnerGroup: "European Suppliers",
    email: "kontakt@adiant.de",
    website: "www.adiant.de",
    phone: "+49 711 555 0890",
    minOrderQty: 100,
    maxOrderQty: 5000,
    multiples: 50,
    pricingRules: "standard",
  },
];

/* ================================================================
   Reference PO generator (verbatim copy of generateMockOrders)
   ================================================================ */
const PARTNER_NAMES = [
  "General Motors (GM)",
  "Toyota Technical Center (TTC)",
  "Ford Motor Company",
  "Tesla, Inc.",
  "Chrysler (Stellantis N.V.)",
  "Rivian Automotive",
  "Lucid Motors",
  "Honda Motor Co., Ltd. (USA)",
  "Nissan North America",
  "BMW of North America",
  "Hyundai Motor America",
  "Volkswagen Group of America",
];

const CONTACT_NAMES = [
  "Sherry Brown",
  "Cameron Williamson",
  "Leslie Alexander",
  "Jerome Bell",
  "Marvin McKinney",
  "Brooklyn Simmons",
  "Savannah Nguyen",
  "Eli Rosenbloom",
  "Nophil Anwer",
  "Irtaza Abid",
];

const CREATED_BY = [
  "Antisham Ahmad",
  "Faizan Khan",
  "Areeb Tanveer",
  "Eli Rosenbloom",
  "Nophil Anwer",
  "Irtaza Abid",
];

const PO_LOCATIONS = [
  "Pasadena, Oklahoma",
  "Great Falls, Maryland",
  "Lansing, Illinois",
  "Portland, Illinois",
  "Lafayette, California",
  "Stockton, New Hampshire",
  "Troy, Michigan",
  "El Segundo, California",
  "Dearborn, Michigan",
  "Austin, Texas",
];

const STATUSES: POStatus[] = [
  "draft",
  "sent",
  "active_with_cancellation",
  "draft",
  "sent",
  "active_with_cancellation",
  "confirmed",
  "partially_received",
  "cancelled",
  "fully_received",
];

const ITEM_CODES = [
  "100219-51-01",
  "100219-51-01",
  "100219-51-01",
  "3212-41-02",
  "IT8249-96",
  "099282-98",
  "100219-51-01",
  "100219-51-01",
  "100219-51-01",
  "100219-51-01",
];

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function generateMockOrders(seed: string, count: number): PurchaseOrder[] {
  const h = hashStr(seed);
  const orders: PurchaseOrder[] = [];

  for (let i = 0; i < count; i++) {
    const idx = (h + i) % PARTNER_NAMES.length;
    const sIdx = (h + i * 3) % STATUSES.length;
    const cIdx = (h + i * 7) % CONTACT_NAMES.length;
    const cbIdx = (h + i * 5) % CREATED_BY.length;
    const lIdx = (h + i * 11) % PO_LOCATIONS.length;
    const iIdx = (h + i * 2) % ITEM_CODES.length;
    const moreCount = ((h + i * 13) % 5) + 1;

    const baseMonth = 12 - (i % 7);
    const baseDay = 9 + ((i * 3) % 20);
    const dueDay = baseDay + 14;

    orders.push({
      id: `po-${seed}-${i}`,
      poNumber: `395-${9825 + i}`,
      partnerName: PARTNER_NAMES[idx],
      status: STATUSES[sIdx],
      orderedItems: ITEM_CODES[iIdx],
      orderedItemsMore: moreCount > 0 ? moreCount : undefined,
      pointOfContact: CONTACT_NAMES[cIdx],
      location: PO_LOCATIONS[lIdx],
      createdByName: CREATED_BY[cbIdx],
      dueDeliveryDate: `${MONTH_LABELS[baseMonth - 1]} ${Math.min(dueDay, 28)}, 2024`,
      orderDate: `${MONTH_LABELS[baseMonth - 1]} ${Math.min(baseDay, 28)}, 2024`,
    });
  }

  return orders;
}

/* ================================================================
   AVAILABLE_VENDORS — pool used by the Add QV wizard (slice 1C).
   Names mirror the reference partner pool.
   ================================================================ */
/* Per-vendor reference data for the Add Qualified Vendor modal:
   - code: short avatar abbreviation matching the reference design
     (uses parenthesized abbreviation when present, otherwise a single letter)
   - address: full street address (street + city + state + zip)
   - avatarColor: saturated brand-ish hex used as the avatar bg */
const VENDOR_PROFILE: Record<
  string,
  { code: string; address: string; avatarColor: string }
> = {
  "General Motors (GM)": {
    code: "GM",
    address: "300 Renaissance Center, Detroit, Michigan 48243",
    avatarColor: "#1E3A8A",
  },
  "Toyota Technical Center (TTC)": {
    code: "TT",
    address: "1555 Woodridge Ave., Ann Arbor, Michigan 48105",
    avatarColor: "#B91C1C",
  },
  "Ford Motor Company": {
    code: "Fd",
    address: "1 American Road, Dearborn, Michigan 48126",
    avatarColor: "#0F172A",
  },
  "Tesla, Inc.": {
    code: "T",
    address: "1 Tesla Road, Austin, Texas 78725",
    avatarColor: "#111111",
  },
  "Chrysler (Stellantis N.V.)": {
    code: "C",
    address: "1000 Chrysler Drive, Auburn Hills, Michigan 48326",
    avatarColor: "#475569",
  },
  "Rivian Automotive": {
    code: "R",
    address: "100 N Riverview Dr., Plymouth, Michigan 48170",
    avatarColor: "#64748B",
  },
  "Lucid Motors": {
    code: "L",
    address: "7373 Gateway Blvd., Newark, California 94560",
    avatarColor: "#1F2937",
  },
  "Honda Motor Co., Ltd. (USA)": {
    code: "H",
    address: "1919 Torrance Blvd., Torrance, California 90501",
    avatarColor: "#B91C1C",
  },
  "Nissan North America": {
    code: "N",
    address: "1 Nissan Way, Franklin, Tennessee 37067",
    avatarColor: "#0F172A",
  },
  "BMW of North America": {
    code: "BMW",
    address: "300 Chestnut Ridge Rd., Woodcliff Lake, New Jersey 07677",
    avatarColor: "#1E40AF",
  },
  "Hyundai Motor America": {
    code: "HY",
    address: "10550 Talbert Ave., Fountain Valley, California 92708",
    avatarColor: "#0E7490",
  },
  "Volkswagen Group of America": {
    code: "VW",
    address: "2200 Ferdinand Porsche Dr., Herndon, Virginia 20171",
    avatarColor: "#1E3A8A",
  },
};

/* AVAILABLE_VENDORS is defined further down — right after buildContacts — so
   its seeding can reuse buildContacts() for the Points of Contact column
   without hitting a temporal-dead-zone on the CONTACT_* consts. */

/* ================================================================
   Per-item seeding — every item id maps to a deterministic QV + PO set
   ================================================================ */
function seedQVsForItem(itemId: string): QualifiedVendor[] {
  const h = hashStr(itemId);
  /* Rotate the canonical 9 vendors so each item gets a stable order;
     priorities are re-sequenced from 1. */
  const offset = h % SEED_QVS.length;
  return SEED_QVS.map((qv, i) => {
    const src = SEED_QVS[(i + offset) % SEED_QVS.length];
    return {
      ...src,
      id: `qv-${itemId}-${i + 1}`,
      ...buildVendorDetailExtras(src, itemId, i),
      // Priority allows ties: seed the top two vendors tied at rank 1 so the
      // tier behavior is visible. No default is pre-selected — the default
      // (auto-PO anchor) is chosen intentionally by starring a Priority 1 vendor.
      priority: i === 0 ? 1 : i,
      isPrimary: false,
    };
  });
}

/* ================================================================
   Slice 1D — Partner Detail extras (deterministic per vendor + item)
   ================================================================ */
const TIER_OPTIONS = [
  "Tier 1 Automotive",
  "Tier 2 Supplier",
  "Strategic Partner",
  "Preferred Vendor",
  "Approved Supplier",
];
const PAYMENT_TERMS = ["Net 30", "Net 45", "Net 60", "2/10 Net 30", "Due on Receipt"];
const PAYMENT_METHODS = ["Wire Transfer", "ACH", "Check", "Credit Card"];
const SHIPPING_METHODS = ["Ground", "Air Freight", "Ocean Freight", "Express"];
const INCOTERMS_LIST = ["FOB", "CIF", "EXW", "DDP", "FCA"];
const CONTACT_DEPT_ROLES: Record<
  "Sales" | "Procurement" | "Finance",
  string[]
> = {
  Sales: ["Sales Rep", "Account Manager", "Sales Director", "Regional Lead"],
  Procurement: [
    "Buyer",
    "Procurement Specialist",
    "Supply Chain Analyst",
    "Category Manager",
    "Procurement Lead",
  ],
  Finance: [
    "Accounts Payable",
    "Finance Analyst",
    "Credit Controller",
    "Billing Specialist",
    "Finance Manager",
  ],
};
const CONTACT_FIRST = [
  "Emily", "James", "Sarah", "Michael", "Olivia",
  "David", "Sophia", "Robert", "Linda", "Thomas",
];
const CONTACT_LAST = [
  "Turner", "Anderson", "Mitchell", "Garcia", "Nguyen",
  "Patel", "Kim", "Williams", "Chen", "Martinez",
];

/** Generate 10 contacts grouped by department (Sales 2 / Procurement 4 / Finance 4)
 *  matching the reference Partner Detail "Point of Contacts" tab. */
function buildContacts(seed: number, vendorId: string, _count: number): VendorContact[] {
  void _count;
  const out: VendorContact[] = [];
  const layout: { dept: VendorContact["department"]; count: number }[] = [
    { dept: "Sales", count: 2 },
    { dept: "Procurement", count: 4 },
    { dept: "Finance", count: 4 },
  ];
  let idx = 0;
  for (const { dept, count } of layout) {
    const roles = CONTACT_DEPT_ROLES[dept!];
    for (let i = 0; i < count; i++) {
      const fIdx = (seed + idx * 7 + i * 3) % CONTACT_FIRST.length;
      const lIdx = (seed + idx * 11 + i * 5 + 1) % CONTACT_LAST.length;
      const rIdx = (seed + idx + i) % roles.length;
      const first = CONTACT_FIRST[fIdx];
      const last = CONTACT_LAST[lIdx];
      const areaCode = String(200 + ((seed + idx * 13) % 700));
      const phoneRest = `${String(100 + ((seed * 3 + idx * 17) % 900)).padStart(3, "0")}-${String(1000 + ((seed * 7 + idx * 13) % 9000)).padStart(4, "0")}`;
      const mobileRest = `${String(100 + ((seed * 5 + idx * 23) % 900)).padStart(3, "0")}-${String(1000 + ((seed * 11 + idx * 19) % 9000)).padStart(4, "0")}`;
      const ext = String(1000 + ((seed + idx * 37) % 9000));
      out.push({
        id: `${vendorId}-c${idx}`,
        name: `${first} ${last}`,
        title: roles[rIdx],
        department: dept,
        email: `${first.toLowerCase()}.${last.toLowerCase()}@company.com`,
        phone: `(${areaCode}) ${phoneRest}`,
        ext: `Ext. ${ext}`,
        mobile: `(${areaCode}) ${mobileRest}`,
      });
      idx++;
    }
  }
  return out;
}

/* Brand → country of origin for the Browse-vendor Country column. This is the
   partner's home country (independent of the US site shown in Partner
   Locations); anything not listed defaults to United States. */
const VENDOR_ORIGIN: Record<string, { country: string; flag: string }> = {
  Toyota: { country: "Japan", flag: "🇯🇵" },
  Honda: { country: "Japan", flag: "🇯🇵" },
  Nissan: { country: "Japan", flag: "🇯🇵" },
  BMW: { country: "Germany", flag: "🇩🇪" },
  Volkswagen: { country: "Germany", flag: "🇩🇪" },
  Hyundai: { country: "South Korea", flag: "🇰🇷" },
};
const AV_SITE_TYPES = ["Distribution Center", "Regional Warehouse", "Manufacturing Plant", "Logistics Hub"];
const AV_CARRIER_POOL = ["FedEx Express", "DHL Express", "UPS", "Maersk", "Aramex", "SF Express", "USPS", "TCS"];

/* AVAILABLE_VENDORS — pool used by the Add QV wizard's Browse picker. Seeded
   with the same partner-identity fields as the listing (partnerLocations,
   country, carrierVendor, creditLimit, contacts) so the Browse table renders
   the shared partnerCells exactly like QVTable. Defined here (after
   buildContacts) so it can reuse that helper at module init. */
export const AVAILABLE_VENDORS: AvailableVendor[] = PARTNER_NAMES.map((name, i) => {
  const profile = VENDOR_PROFILE[name];
  const location = profile?.address ?? PO_LOCATIONS[i % PO_LOCATIONS.length];
  const seed = hashStr(`av-${i}-${name}`);
  const originKey = Object.keys(VENDOR_ORIGIN).find((k) => name.includes(k));
  const origin = originKey ? VENDOR_ORIGIN[originKey] : { country: "United States", flag: "🇺🇸" };
  /* Primary site label = "City, State" parsed from the address (profile
     addresses are "Street, City, State Zip"; PO_LOCATIONS are "City, State"),
     with the trailing ZIP stripped. */
  const locParts = location.split(",").map((s) => s.trim());
  const cityState = (locParts.length >= 3 ? locParts.slice(1).join(", ") : locParts.join(", "))
    .replace(/\s*\d{5}(-\d{4})?$/, "")
    .trim();
  const city = locParts[locParts.length >= 3 ? 1 : 0];
  const nExtra = seed % 4; // 0..3 extra named sites → exercises the "+N more" overflow
  const partnerLocations = [
    cityState,
    ...Array.from({ length: nExtra }, (_, k) => `${city} ${AV_SITE_TYPES[(seed + k) % AV_SITE_TYPES.length]}`),
  ];
  return {
    id: `av-${i}`,
    name,
    location,
    address: profile?.address,
    code: profile?.code,
    avatarColor: profile?.avatarColor,
    partnerGroup:
      i % 3 === 0
        ? "Tier 1 Automotive"
        : i % 3 === 1
          ? "Precision Parts"
          : "General Manufacturing",
    /* Mix of vendor-only, customer-only, and dual-role partners.
       Deterministic so the pickers are stable across reloads. */
    partnerRoles:
      i % 3 === 0
        ? ["Vendor", "Customer"]
        : i % 3 === 1
          ? ["Customer"]
          : ["Vendor"],
    /* Lifecycle status + breadth of catalog — deterministic so the
       Select-Vendor table stays stable across reloads. Most vendors are
       Active; a deterministic few are Pending/Inactive for visual variety. */
    status: i % 7 === 0 ? "Pending" : i % 11 === 5 ? "Inactive" : "Active",
    itemsSupplied: 18 + ((i * 37) % 242),
    /* ── Partner-listing parity fields (rendered by the shared partnerCells) ── */
    partnerLocations,
    country: origin.country,
    countryFlag: origin.flag,
    carrierVendor: AV_CARRIER_POOL[seed % AV_CARRIER_POOL.length],
    creditLimit: 20000 + ((seed % 5) * 5000),
    contacts: buildContacts(seed, `av-${i}`, 10),
  };
});

/* ================================================================
   Seed the captured qualify-config so the LISTING reflects real
   qualification data — including multi-UoM tiers, freight methods and
   pricing rules — exactly as a wizard-added vendor would. Deterministic
   by row index so the table is stable across reloads, with a deliberate
   mix of single- and multi-unit vendors.
   ================================================================ */
const QV_SEED_PACK_TIERS = [
  { uom: "Case (24)", mult: 24, factor: 0.94 },
  { uom: "Pallet (480)", mult: 480, factor: 0.85 },
  { uom: "Box (12)", mult: 12, factor: 0.97 },
];
const QV_SEED_EXTRA_COUNTS = [2, 1, 0, 3, 1, 2, 0, 1, 2];
/* Pricing-rule id sets per row — a deliberate mix of discount-only and
   discount+premium combos (and a few single-rule rows) so the listing's
   Pricing Rules column and its hover card show varied, meaningful content. */
const QV_SEED_RULE_SETS: string[][] = [
  ["early-pay-2-10", "volume-tier-100"],
  ["early-pay-2-10", "volume-tier-100", "fuel-surcharge"],
  ["early-pay-2-10"],
  ["volume-tier-100", "fuel-surcharge"],
  ["early-pay-2-10", "fuel-surcharge"],
  ["early-pay-2-10", "volume-tier-100"],
  ["fuel-surcharge"],
  ["early-pay-2-10", "volume-tier-100", "fuel-surcharge"],
  ["early-pay-2-10", "volume-tier-100"],
];

function buildSeedConfig(src: QualifiedVendor, i: number): QualifiedVendorConfig {
  const base = src.pricePerUnit;
  const minP = src.minOrderQty ?? 10 + (i % 4) * 10;
  const maxP = src.maxOrderQty ?? minP * (8 + (i % 3) * 4);
  const multP = src.multiples ?? 1 + (i % 3);
  const lead = src.lastPOLeadTime || 5 + (i % 4) * 3;
  const dev = src.acceptedDeviation ?? 5;
  const extraCount = QV_SEED_EXTRA_COUNTS[i % QV_SEED_EXTRA_COUNTS.length];
  const additionalPrices = Array.from({ length: extraCount }, (_, k) => {
    const t = QV_SEED_PACK_TIERS[k % QV_SEED_PACK_TIERS.length];
    return {
      uom: t.uom,
      price: (base * t.mult * t.factor).toFixed(2),
      minOrderQty: String(Math.max(1, Math.round(minP / t.mult))),
      maxOrderQty: String(Math.max(2, Math.round(maxP / t.mult))),
      multiples: "1",
      acceptedDeviationPct: String(dev),
      leadTimeDays: String(lead + (k + 1) * 2),
    };
  });
  return {
    priority: String(i + 1),
    pricePerUnit: base.toFixed(2),
    uom: src.vendorUOM,
    additionalPrices,
    minOrderQty: String(minP),
    maxOrderQty: String(maxP),
    multiples: String(multP),
    acceptedDeviationPct: String(dev),
    leadTimeDays: String(lead),
    shippingMethodIds: ["fedex-air", "dhl-express"],
    defaultShippingMethodId: "fedex-air",
    appliedPricingRuleIds: QV_SEED_RULE_SETS[i % QV_SEED_RULE_SETS.length],
  };
}

function buildVendorDetailExtras(
  src: QualifiedVendor,
  itemId: string,
  i: number,
): Partial<QualifiedVendor> {
  const seed = hashStr(`${itemId}-${src.vendorId}-${i}`);
  const creditLimit = 20000 + ((seed % 5) * 5000);
  const creditPctSeed = seed % 100;
  /* Spread vendors across utilization buckets so the bar shows green/amber/red. */
  const usagePct = i === 0 ? 92 : i === 1 ? 68 : i === 2 ? 42 : 30 + (creditPctSeed % 60);
  const creditUsed = Math.round((creditLimit * usagePct) / 100 * 100) / 100;

  /* ── Partner-listing parity fields ──────────────────────────────
     country + flag come straight off the row's location string; the
     partner-locations array seeds the primary city plus a deterministic
     handful of named sites so the "+N more" overflow has something to
     show; carrierVendor picks a real carrier so CarrierIcon resolves a
     logo. Mirrors VendorsListPage's vendor.country / partnerLocations /
     defaultCarrierVendor. */
  const COUNTRY_FLAGS: Record<string, string> = {
    "United States": "🇺🇸",
    "United Kingdom": "🇬🇧",
    Canada: "🇨🇦",
    Germany: "🇩🇪",
    Japan: "🇯🇵",
    China: "🇨🇳",
    Australia: "🇦🇺",
  };
  const locParts = src.location.split(",").map((s) => s.trim());
  const country = locParts[locParts.length - 1] || "";
  const countryFlag = COUNTRY_FLAGS[country] ?? "🌍";
  const primarySite = locParts.slice(0, 2).join(", ");
  const SITE_TYPES = ["Distribution Center", "Regional Warehouse", "Manufacturing Plant", "Logistics Hub"];
  const nExtra = seed % 4; // 0..3 extra sites → exercises the "+N more" overflow
  const partnerLocations = [
    primarySite,
    ...Array.from({ length: nExtra }, (_, k) => `${locParts[0]} ${SITE_TYPES[(seed + k) % SITE_TYPES.length]}`),
  ];
  const CARRIER_POOL = ["FedEx Express", "DHL Express", "UPS", "Maersk", "Aramex", "SF Express", "USPS", "TCS"];
  const carrierVendor = CARRIER_POOL[seed % CARRIER_POOL.length];

  return {
    tier: src.partnerGroup ?? TIER_OPTIONS[seed % TIER_OPTIONS.length],
    creditLimit,
    creditUsed,
    partnerLocations,
    country,
    countryFlag,
    carrierVendor,
    contacts: buildContacts(seed, src.vendorId, 10),
    paymentTerms: PAYMENT_TERMS[seed % PAYMENT_TERMS.length],
    paymentMethod: PAYMENT_METHODS[seed % PAYMENT_METHODS.length],
    shippingMethod: SHIPPING_METHODS[seed % SHIPPING_METHODS.length],
    shippingAddress: src.location,
    incoterms: INCOTERMS_LIST[seed % INCOTERMS_LIST.length],
    config: buildSeedConfig(src, i),
  };
}

/** Map of `itemId → QualifiedVendor[]` — rendered in slice 1B. */
export const QVS_BY_ITEM: Record<string, QualifiedVendor[]> = INITIAL_ITEMS.reduce(
  (acc, item) => {
    acc[item.id] = seedQVsForItem(item.id);
    return acc;
  },
  {} as Record<string, QualifiedVendor[]>,
);

/** Map of `itemId → PurchaseOrder[]` — rendered in slice 2A. */
export const POS_BY_ITEM: Record<string, PurchaseOrder[]> = INITIAL_ITEMS.reduce(
  (acc, item) => {
    const orders = generateMockOrders(`item-${item.id}`, 22);
    // VALV-BAL-316 (id "2") is the archive "clean case": keep a rich PO history
    // but mark every order closed (received / cancelled) so it has zero OPEN
    // transactions — a prerequisite for archiving per the lifecycle matrix.
    acc[item.id] =
      item.id === "2"
        ? orders.map((o, i) => ({ ...o, status: (i % 3 === 0 ? "cancelled" : "fully_received") as POStatus }))
        : orders;
    return acc;
  },
  {} as Record<string, PurchaseOrder[]>,
);