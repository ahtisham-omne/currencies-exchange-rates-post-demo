export type VendorStatus = "active" | "inactive" | "archived";
export type PartnerType = "vendor" | "customer";
export type VendorCategory =
  | "raw_materials"
  | "services"
  | "equipment"
  | "logistics"
  | "technology"
  | "consulting"
  | "maintenance"
  | "office_supplies";

export type PaymentTerms =
  | "net_15"
  | "net_30"
  | "net_45"
  | "net_60"
  | "net_90"
  | "due_on_receipt"
  | "cod";

export interface VendorContact {
  name: string;
  email: string;
  phone: string;
  designation: string;
}

export interface VendorAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface ContactPerson {
  initials: string;
  name: string;
  bgColor: string;
}

// Extended config data from partner creation Step 3
export interface SavedPaymentMethod {
  id: string;
  type: string;
  typeLabel: string;
  bankName?: string;
  accountNumber?: string;
  routingNumber?: string;
  cardNumber?: string;
  expiryDate?: string;
  walletProvider?: string;
  walletId?: string;
  wireRoutingNumber?: string;
  checkPayableTo?: string;
  discountPercent?: number;
  additionalChargesPercent?: number;
  isSaved: boolean;
}

export interface SavedPaymentTermConfig {
  id: string;
  name: string;
  type: string;
  trigger: string;
  description: string;
  duration?: string;
  discountPercent?: string;
  discountPeriod?: string;
}

export interface SavedPricingRule {
  id: string;
  name: string;
  type: string;
  basis: string;
  description: string;
  tiers?: { from: number; to: number; discount: number }[];
}

export interface SavedShippingConfig {
  carrierServices: { name: string; description: string; minDays: number; maxDays: number; isDefault: boolean }[];
  vendorPreferences: { carrier: string; methods: string[]; isDefault: boolean }[];
}

export interface EnrichedContactPerson {
  id: string;
  name: string;
  email: string;
  phone: string;
  secondaryPhone?: string;
  extension?: string;
  department: string;
  avatarColor: string;
  role?: string;
}

export interface VendorConfigData {
  paymentMethods?: SavedPaymentMethod[];
  paymentTermConfig?: SavedPaymentTermConfig;
  pricingRules?: SavedPricingRule[];
  pointsOfContact?: EnrichedContactPerson[];
  creditLimitConfig?: {
    currency: string;
    maxCreditLimit: number;
    warningThreshold: number;
    enforcement: string;
  };
  shippingConfig?: SavedShippingConfig;
  description?: string;
  vendorSubTypes?: string[];
  customerSubTypes?: string[];
}

export interface Vendor {
  id: string;
  code: string;
  companyName: string;
  displayName: string;
  // New partner-level fields
  partnerTypes: PartnerType[];
  vendorType: string;
  vendorSubTypes?: string[];
  customerSubTypes?: string[];
  itemCodes: string[];
  partnerLocations: string[];
  globalPointOfContacts: ContactPerson[];
  partnerGroup: string;
  netProfitMargin: number;
  creditUtilization: number;
  services: string;
  defaultCarrierVendor: string;
  defaultCarrierCustomer: string;
  country: string;
  countryFlag: string;
  emailAddress: string;
  createdByContact: ContactPerson;
  profileImage?: string | null;
  description?: string;
  // Existing fields
  category: VendorCategory;
  status: VendorStatus;
  primaryContact: VendorContact;
  billingAddress: VendorAddress;
  shippingAddress?: VendorAddress;
  taxId: string;
  paymentTerms: PaymentTerms;
  creditLimit: number;
  outstandingBalance: number;
  totalOrders: number;
  totalSpent: number;
  rating: number;
  website: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  // Optional enriched config data from creation modal Step 3
  configData?: VendorConfigData;
}

export const CATEGORY_LABELS: Record<VendorCategory, string> = {
  raw_materials: "Raw Materials",
  services: "Services",
  equipment: "Equipment",
  logistics: "Logistics",
  technology: "Technology",
  consulting: "Consulting",
  maintenance: "Maintenance",
  office_supplies: "Office Supplies",
};

export const PAYMENT_TERMS_LABELS: Record<PaymentTerms, string> = {
  net_15: "Net 15",
  net_30: "Net 30",
  net_45: "Net 45",
  net_60: "Net 60",
  net_90: "Net 90",
  due_on_receipt: "Due on Receipt",
  cod: "Cash on Delivery",
};

export const STATUS_LABELS: Record<VendorStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
};

const CARRIERS = [
  "FedEx",
  "TCS (Tranzum Courier Service)",
  "DHL Express",
  "UPS (United Parcel Service)",
  "SF Express",
  "Japan Post",
  "Purolator",
  "Aramex",
  "Blue Dart",
  "Australia Post",
];

const _manualVendors: Vendor[] = [
  {
    id: "v-001",
    code: "100219-42",
    companyName: "Toyota International",
    displayName: "Toyota International",
    partnerTypes: ["vendor"],
    vendorType: "Seller",
    itemCodes: ["100219-42", "100219-43", "100219-44", "100219-45", "100219-46", "100219-47", "100219-48", "100219-49", "100219-50", "100219-51", "100219-52", "100219-53"],
    partnerLocations: ["Toyota Technical Center", "Toyota Motor Manufacturing", "Toyota Financial Services", "Toyota Logistics", "Toyota Parts Center", "Toyota Motor Sales", "Toyota Engineering", "Toyota Design Center", "Toyota Research", "Toyota North America HQ", "Toyota Distribution", "Toyota Quality Center", "Toyota Training Center", "Toyota Innovation Lab", "Toyota Service Center", "Toyota Warehouse East", "Toyota Warehouse West", "Toyota Fleet Center", "Toyota Assembly Plant", "Toyota Test Facility", "Toyota Supply Chain", "Toyota Customer Center", "Toyota Admin Office", "Toyota Data Center", "Toyota Marketing HQ"],
    globalPointOfContacts: [
      { initials: "TB", name: "Tanya Bailey", bgColor: "#0ea5e9" },
      { initials: "RK", name: "Robert Kim", bgColor: "#8b5cf6" },
      { initials: "JL", name: "Jennifer Lee", bgColor: "#f59e0b" },
      { initials: "MS", name: "Mark Stevens", bgColor: "#10b981" },
      { initials: "AC", name: "Anna Chen", bgColor: "#ef4444" },
      { initials: "DW", name: "David Wang", bgColor: "#6366f1" },
      { initials: "SP", name: "Sarah Park", bgColor: "#ec4899" },
      { initials: "TJ", name: "Tom Johnson", bgColor: "#14b8a6" },
      { initials: "LM", name: "Lisa Martinez", bgColor: "#f97316" },
      { initials: "KN", name: "Kevin Nguyen", bgColor: "#84cc16" },
      { initials: "BH", name: "Beth Harris", bgColor: "#a855f7" },
      { initials: "CR", name: "Chris Robinson", bgColor: "#0891b2" },
      { initials: "NP", name: "Nina Patel", bgColor: "#e11d48" },
    ],
    partnerGroup: "PG-1-1",
    netProfitMargin: 347.59,
    creditUtilization: 2000,
    services: "Laser cutting",
    defaultCarrierVendor: "FedEx",
    defaultCarrierCustomer: "Australia Post",
    country: "USA",
    countryFlag: "🇺🇸",
    emailAddress: "support@toyota.international.com",
    createdByContact: { initials: "AA", name: "Ahtisham Ahmad", bgColor: "#6366f1" },
    category: "equipment",
    status: "active",
    primaryContact: {
      name: "Tanya Bailey",
      email: "support@toyota.international.com",
      phone: "+1 (555) 234-5678",
      designation: "Account Manager",
    },
    billingAddress: {
      street: "1 Toyota Drive",
      city: "Plano",
      state: "TX",
      zipCode: "75024",
      country: "United States",
    },
    taxId: "82-4567123",
    paymentTerms: "net_30",
    creditLimit: 10000,
    outstandingBalance: 2000,
    totalOrders: 156,
    totalSpent: 1245000,
    rating: 4.8,
    website: "toyota.inter.com",
    notes: "Major automotive partner. Preferred vendor for vehicle parts and equipment.",
    createdAt: "2024-12-23T10:00:00Z",
    updatedAt: "2025-12-10T14:30:00Z",
    configData: {
      paymentMethods: [
        { id: "pm-t1", type: "ach", typeLabel: "ACH / Direct Deposit", bankName: "Chase Bank", accountNumber: "9283746501", routingNumber: "021000021", isSaved: true, discountPercent: 2 },
        { id: "pm-t2", type: "wire", typeLabel: "Wire Transfer", bankName: "Bank of America", accountNumber: "7461829305", routingNumber: "026009593", wireRoutingNumber: "BOFAUS3N", isSaved: true },
        { id: "pm-t3", type: "card", typeLabel: "Credit / Debit Card", cardNumber: "4111111111113456", expiryDate: "09/27", isSaved: true },
      ],
    },
  },
  {
    id: "v-002",
    code: "100219-51",
    companyName: "UPS",
    displayName: "UPS",
    partnerTypes: ["vendor"],
    vendorType: "Carrier",
    itemCodes: ["100219-51", "100219-52", "100219-53", "100219-54", "100219-55", "100219-56", "100219-57", "100219-58", "100219-59", "100219-60", "100219-61", "100219-62", "100219-63", "100219-64", "100219-65", "100219-66", "100219-67", "100219-68", "100219-69", "100219-70", "100219-71", "100219-72", "100219-73", "100219-74", "100219-75", "100219-76", "100219-77", "100219-78", "100219-79", "100219-80", "100219-81", "100219-82", "100219-83", "100219-84", "100219-85"],
    partnerLocations: ["Ford USA", "Ford Europe", "Ford Asia Pacific", "Ford Mexico", "Ford Canada", "Ford Brazil", "Ford Australia", "Ford India", "Ford South Africa", "Ford Middle East", "Ford UK"],
    globalPointOfContacts: [
      { initials: "DW", name: "Daniel Whitaker", bgColor: "#6366f1" },
      { initials: "SM", name: "Sandra Mitchell", bgColor: "#ec4899" },
      { initials: "JR", name: "James Rodriguez", bgColor: "#10b981" },
      { initials: "KL", name: "Karen Lewis", bgColor: "#f59e0b" },
      { initials: "BT", name: "Brian Turner", bgColor: "#ef4444" },
    ],
    partnerGroup: "PG-1-1",
    netProfitMargin: 951.82,
    creditUtilization: 3410,
    services: "Laser cutting",
    defaultCarrierVendor: "TCS (Tranzum Courier Service)",
    defaultCarrierCustomer: "Blue Dart",
    country: "China",
    countryFlag: "🇨🇳",
    emailAddress: "feamster@verizon.net",
    createdByContact: { initials: "FK", name: "Faizan Khan", bgColor: "#10b981" },
    category: "logistics",
    status: "active",
    primaryContact: {
      name: "Daniel Whitaker",
      email: "feamster@verizon.net",
      phone: "+1 (555) 876-5432",
      designation: "Operations Head",
    },
    billingAddress: {
      street: "55 Glenlake Pkwy NE",
      city: "Atlanta",
      state: "GA",
      zipCode: "30328",
      country: "United States",
    },
    taxId: "94-7821345",
    paymentTerms: "net_30",
    creditLimit: 5000,
    outstandingBalance: 3410,
    totalOrders: 289,
    totalSpent: 890000,
    rating: 4.5,
    website: "fordmotorcompany.com",
    notes: "Primary logistics and shipping partner.",
    createdAt: "2024-11-25T08:00:00Z",
    updatedAt: "2025-11-22T09:15:00Z",
    configData: {
      paymentMethods: [
        { id: "pm-u1", type: "ach", typeLabel: "ACH / Direct Deposit", bankName: "Wells Fargo", accountNumber: "5038291640", routingNumber: "121000248", isSaved: true },
        { id: "pm-u2", type: "digital_wallet", typeLabel: "Digital Wallet", walletProvider: "PayPal", walletId: "payments@ups.com", isSaved: true, discountPercent: 1.5 },
      ],
    },
  },
  {
    id: "v-003",
    code: "100219-51-01",
    companyName: "General Motors (GM)",
    displayName: "General Motors (GM)",
    partnerTypes: ["customer"],
    vendorType: "",
    itemCodes: ["100219-51-01", "100219-51-02", "100219-51-03", "100219-51-04", "100219-51-05", "100219-51-06", "100219-51-07", "100219-51-08", "100219-51-09", "100219-51-10", "100219-51-11", "100219-51-12", "100219-51-13", "100219-51-14", "100219-51-15", "100219-51-16"],
    partnerLocations: ["General Motors US", "GM Canada", "GM Mexico", "GM China", "GM Europe", "GM Brazil", "GM India", "GM Korea", "GM Australia"],
    globalPointOfContacts: [
      { initials: "KA", name: "Kimora Avila", bgColor: "#f59e0b" },
      { initials: "RS", name: "Ryan Scott", bgColor: "#0ea5e9" },
      { initials: "MP", name: "Michelle Park", bgColor: "#8b5cf6" },
      { initials: "DL", name: "Derek Lee", bgColor: "#10b981" },
      { initials: "JW", name: "Janet Wilson", bgColor: "#ef4444" },
      { initials: "TC", name: "Tyler Chen", bgColor: "#6366f1" },
      { initials: "AH", name: "Amy Harris", bgColor: "#ec4899" },
      { initials: "BM", name: "Ben Martinez", bgColor: "#14b8a6" },
      { initials: "LP", name: "Linda Patel", bgColor: "#f97316" },
    ],
    partnerGroup: "PG-1-1",
    netProfitMargin: 750.65,
    creditUtilization: 3410,
    services: "Laser cutting",
    defaultCarrierVendor: "DHL Express",
    defaultCarrierCustomer: "DHL Express",
    country: "Mexico",
    countryFlag: "🇲🇽",
    emailAddress: "crandall@live.com",
    createdByContact: { initials: "AT", name: "Areeb Tanveer", bgColor: "#0ea5e9" },
    category: "equipment",
    status: "active",
    primaryContact: {
      name: "Kimora Avila",
      email: "crandall@live.com",
      phone: "+1 (555) 345-6789",
      designation: "Procurement Lead",
    },
    billingAddress: {
      street: "300 Renaissance Center",
      city: "Detroit",
      state: "MI",
      zipCode: "48265",
      country: "United States",
    },
    taxId: "62-9034567",
    paymentTerms: "net_45",
    creditLimit: 10000,
    outstandingBalance: 3410,
    totalOrders: 98,
    totalSpent: 2500000,
    rating: 4.2,
    website: "toyota.inter.com",
    notes: "Major automotive customer. Large volume orders.",
    createdAt: "2024-10-29T12:00:00Z",
    updatedAt: "2026-01-15T16:00:00Z",
    configData: {
      paymentMethods: [
        { id: "pm-f1", type: "wire", typeLabel: "Wire Transfer", bankName: "Citibank", accountNumber: "8192736450", routingNumber: "021000089", wireRoutingNumber: "CITIUS33", isSaved: true },
        { id: "pm-f2", type: "check", typeLabel: "Check / Paper", checkPayableTo: "Ford Motor Company", isSaved: true },
        { id: "pm-f3", type: "ach", typeLabel: "ACH / Direct Deposit", bankName: "JPMorgan Chase", accountNumber: "3829104756", routingNumber: "021000021", isSaved: true, additionalChargesPercent: 0.5 },
      ],
    },
  },
  {
    id: "v-004",
    code: "100219-51-01RC",
    companyName: "Tesla, Inc.",
    displayName: "Tesla, Inc.",
    partnerTypes: ["vendor"],
    vendorType: "Online vendor, Seller",
    itemCodes: ["100219-51-01RC", "100219-52-01", "100219-52-02", "100219-52-03", "100219-52-04", "100219-52-05", "100219-52-06", "100219-52-07", "100219-52-08", "100219-52-09", "100219-52-10", "100219-52-11", "100219-52-12", "100219-52-13", "100219-52-14", "100219-52-15", "100219-52-16", "100219-52-17", "100219-52-18", "100219-52-19", "100219-52-20", "100219-52-21", "100219-52-22", "100219-52-23", "100219-52-24"],
    partnerLocations: ["Tesla, Texas", "Tesla Fremont", "Tesla Shanghai", "Tesla Berlin"],
    globalPointOfContacts: [
      { initials: "LZ", name: "Laney Zavala", bgColor: "#8b5cf6" },
      { initials: "KP", name: "Kyle Peters", bgColor: "#0ea5e9" },
      { initials: "RM", name: "Rachel Moore", bgColor: "#f59e0b" },
      { initials: "SJ", name: "Steve Johnson", bgColor: "#10b981" },
      { initials: "NR", name: "Nina Rodriguez", bgColor: "#ef4444" },
      { initials: "DC", name: "David Clark", bgColor: "#6366f1" },
      { initials: "ML", name: "Maria Lopez", bgColor: "#ec4899" },
      { initials: "TW", name: "Tom Wright", bgColor: "#14b8a6" },
      { initials: "JK", name: "Jane Kim", bgColor: "#f97316" },
      { initials: "BN", name: "Brad Nelson", bgColor: "#84cc16" },
      { initials: "AW", name: "Amy Watson", bgColor: "#a855f7" },
      { initials: "CH", name: "Chris Hall", bgColor: "#0891b2" },
      { initials: "EP", name: "Emma Price", bgColor: "#e11d48" },
      { initials: "GS", name: "Gary Smith", bgColor: "#4f46e5" },
      { initials: "HT", name: "Helen Taylor", bgColor: "#059669" },
      { initials: "IB", name: "Ivan Brown", bgColor: "#d97706" },
    ],
    partnerGroup: "PG-1-1",
    netProfitMargin: 481.98,
    creditUtilization: 3000,
    services: "Laser cutting",
    defaultCarrierVendor: "UPS (United Parcel Service)",
    defaultCarrierCustomer: "SF Express",
    country: "Malaysia",
    countryFlag: "🇲🇾",
    emailAddress: "glenz@icloud.com",
    createdByContact: { initials: "AA", name: "Ahtisham Ahmad", bgColor: "#6366f1" },
    category: "technology",
    status: "active",
    primaryContact: {
      name: "Laney Zavala",
      email: "glenz@icloud.com",
      phone: "+1 (555) 456-7890",
      designation: "Supply Chain Manager",
    },
    billingAddress: {
      street: "3500 Deer Creek Road",
      city: "Palo Alto",
      state: "CA",
      zipCode: "94304",
      country: "United States",
    },
    taxId: "04-5678901",
    paymentTerms: "net_30",
    creditLimit: 20000,
    outstandingBalance: 3000,
    totalOrders: 67,
    totalSpent: 1850000,
    rating: 4.7,
    website: "toyota.inter.com",
    notes: "EV technology partner. Battery and powertrain components.",
    createdAt: "2024-12-23T09:30:00Z",
    updatedAt: "2025-06-30T11:00:00Z",
    configData: {
      paymentMethods: [
        { id: "pm-byd1", type: "wire", typeLabel: "Wire Transfer", bankName: "HSBC", accountNumber: "6174920385", routingNumber: "022000020", wireRoutingNumber: "HSBCHKHH", isSaved: true },
        { id: "pm-byd2", type: "digital_wallet", typeLabel: "Digital Wallet", walletProvider: "Alipay", walletId: "byd-treasury@byd.com", isSaved: true },
      ],
    },
  },
  {
    id: "v-005",
    code: "100219-51-02",
    companyName: "Chrysler (Stellantis N.V.)",
    displayName: "Chrysler (Stellantis N.V.)",
    partnerTypes: ["vendor"],
    vendorType: "Seller",
    itemCodes: ["100219-51-02", "100219-51-03", "100219-51-04", "100219-51-05", "100219-51-06", "100219-51-07", "100219-51-08", "100219-51-09", "100219-51-10", "100219-51-11", "100219-51-12", "100219-51-13", "100219-51-14", "100219-51-15", "100219-51-16", "100219-51-17", "100219-51-18", "100219-51-19", "100219-51-20", "100219-51-21", "100219-51-22", "100219-51-23", "100219-51-24", "100219-51-25", "100219-51-26", "100219-51-27", "100219-51-28", "100219-51-29", "100219-51-30", "100219-51-31", "100219-51-32", "100219-51-33", "100219-51-34", "100219-51-35", "100219-51-36", "100219-51-37", "100219-51-38", "100219-51-39", "100219-51-40", "100219-51-41", "100219-51-42", "100219-51-43", "100219-51-44", "100219-51-45", "100219-51-46", "100219-51-47", "100219-51-48", "100219-51-49", "100219-51-50", "100219-51-51", "100219-51-52", "100219-51-53", "100219-51-54", "100219-51-55"],
    partnerLocations: ["Chrysler (Stellantis...)", "Stellantis USA", "Stellantis Italy", "Stellantis France", "Stellantis Germany", "Stellantis Brazil", "Stellantis Canada", "Stellantis Mexico", "Stellantis UK"],
    globalPointOfContacts: [
      { initials: "WB", name: "Wyatt Bates", bgColor: "#10b981" },
      { initials: "LK", name: "Laura King", bgColor: "#8b5cf6" },
      { initials: "MR", name: "Michael Ross", bgColor: "#0ea5e9" },
      { initials: "JN", name: "Jessica Nelson", bgColor: "#f59e0b" },
      { initials: "PH", name: "Patrick Hill", bgColor: "#ef4444" },
      { initials: "DG", name: "Diana Garcia", bgColor: "#6366f1" },
    ],
    partnerGroup: "PG-1-1",
    netProfitMargin: 5.32,
    creditUtilization: 20000,
    services: "Laser cutting",
    defaultCarrierVendor: "SF Express",
    defaultCarrierCustomer: "Blue Dart",
    country: "Slovenia",
    countryFlag: "🇸🇮",
    emailAddress: "bester@live.com",
    createdByContact: { initials: "FK", name: "Faizan Khan", bgColor: "#10b981" },
    category: "equipment",
    status: "active",
    primaryContact: {
      name: "Wyatt Bates",
      email: "bester@live.com",
      phone: "+1 (555) 567-8901",
      designation: "VP Sales",
    },
    billingAddress: {
      street: "1000 Chrysler Drive",
      city: "Auburn Hills",
      state: "MI",
      zipCode: "48326",
      country: "United States",
    },
    taxId: "38-1234567",
    paymentTerms: "net_60",
    creditLimit: 20000,
    outstandingBalance: 20000,
    totalOrders: 42,
    totalSpent: 980000,
    rating: 4.1,
    website: "toyota.inter.com",
    notes: "Stellantis group partner. Supplies automotive parts.",
    createdAt: "2024-12-23T07:00:00Z",
    updatedAt: "2026-02-01T13:45:00Z",
  },
  {
    id: "v-006",
    code: "100219-52",
    companyName: "Rivian Automotive",
    displayName: "Rivian Automotive",
    partnerTypes: ["customer"],
    vendorType: "",
    itemCodes: ["100219-52", "100219-52-01", "100219-52-02", "100219-52-03", "100219-52-04", "100219-52-05", "100219-52-06", "100219-52-07", "100219-52-08", "100219-52-09", "100219-52-10", "100219-52-11", "100219-52-12", "100219-52-13", "100219-52-14", "100219-52-15", "100219-52-16", "100219-52-17", "100219-52-18", "100219-52-19", "100219-52-20", "100219-52-21", "100219-52-22", "100219-52-23", "100219-52-24", "100219-52-25", "100219-52-26", "100219-52-27", "100219-52-28", "100219-52-29", "100219-52-30", "100219-52-31", "100219-52-32", "100219-52-33", "100219-52-34", "100219-52-35", "100219-52-36", "100219-52-37", "100219-52-38", "100219-52-39", "100219-52-40", "100219-52-41", "100219-52-42", "100219-52-43", "100219-52-44"],
    partnerLocations: ["Rivian Automotive...", "Rivian Normal IL", "Rivian Irvine CA", "Rivian Plymouth MI", "Rivian Carson CA", "Rivian Palo Alto CA", "Rivian Vancouver BC", "Rivian Atlanta GA", "Rivian Woking UK", "Rivian Stuttgart DE", "Rivian Shanghai CN", "Rivian Tokyo JP", "Rivian Seoul KR", "Rivian Sydney AU", "Rivian Dubai AE", "Rivian Sao Paulo BR", "Rivian Mexico City MX", "Rivian Toronto ON", "Rivian London UK", "Rivian Paris FR", "Rivian Berlin DE", "Rivian Milan IT", "Rivian Amsterdam NL", "Rivian Stockholm SE", "Rivian Oslo NO", "Rivian Helsinki FI", "Rivian Copenhagen DK", "Rivian Zurich CH", "Rivian Vienna AT", "Rivian Brussels BE", "Rivian Lisbon PT", "Rivian Madrid ES", "Rivian Warsaw PL", "Rivian Prague CZ", "Rivian Budapest HU", "Rivian Bucharest RO", "Rivian Sofia BG", "Rivian Athens GR", "Rivian Istanbul TR", "Rivian Cairo EG", "Rivian Nairobi KE", "Rivian Lagos NG", "Rivian Johannesburg ZA", "Rivian Mumbai IN"],
    globalPointOfContacts: [
      { initials: "KF", name: "Kaleb Figueroa", bgColor: "#f59e0b" },
      { initials: "HT", name: "Hannah Thompson", bgColor: "#8b5cf6" },
      { initials: "RL", name: "Ryan Lewis", bgColor: "#0ea5e9" },
      { initials: "MC", name: "Maria Clark", bgColor: "#10b981" },
      { initials: "JD", name: "Jake Davis", bgColor: "#ef4444" },
      { initials: "SW", name: "Sophia Wilson", bgColor: "#6366f1" },
      { initials: "AN", name: "Alex Nguyen", bgColor: "#ec4899" },
      { initials: "BJ", name: "Brian Jones", bgColor: "#14b8a6" },
      { initials: "CK", name: "Cathy Kim", bgColor: "#f97316" },
      { initials: "DM", name: "Derek Moore", bgColor: "#84cc16" },
    ],
    partnerGroup: "PG-1-1",
    netProfitMargin: 77.81,
    creditUtilization: 5000,
    services: "Laser cutting",
    defaultCarrierVendor: "Japan Post",
    defaultCarrierCustomer: "FedEx",
    country: "Belgium",
    countryFlag: "🇧🇪",
    emailAddress: "toyota.inter.com",
    createdByContact: { initials: "AT", name: "Areeb Tanveer", bgColor: "#0ea5e9" },
    category: "equipment",
    status: "active",
    primaryContact: {
      name: "Kaleb Figueroa",
      email: "k.figueroa@rivian.com",
      phone: "+1 (555) 678-9012",
      designation: "Purchasing Manager",
    },
    billingAddress: {
      street: "14600 Myford Road",
      city: "Irvine",
      state: "CA",
      zipCode: "92606",
      country: "United States",
    },
    taxId: "75-3456789",
    paymentTerms: "net_30",
    creditLimit: 5000,
    outstandingBalance: 5000,
    totalOrders: 34,
    totalSpent: 456000,
    rating: 4.3,
    website: "toyota.inter.com",
    notes: "EV manufacturer customer. Growing partnership.",
    createdAt: "2024-10-29T10:00:00Z",
    updatedAt: "2026-02-10T10:00:00Z",
    configData: {
      paymentMethods: [
        { id: "pm-riv1", type: "ach", typeLabel: "ACH / Direct Deposit", bankName: "Silicon Valley Bank", accountNumber: "2048571936", routingNumber: "121140399", isSaved: true },
        { id: "pm-riv2", type: "card", typeLabel: "Credit / Debit Card", cardNumber: "5500000000007890", expiryDate: "11/28", isSaved: true, discountPercent: 3 },
      ],
    },
  },
  {
    id: "v-007",
    code: "100219-52-02",
    companyName: "Lucid Motors",
    displayName: "Lucid Motors",
    partnerTypes: ["vendor"],
    vendorType: "Seller",
    itemCodes: ["100219-52-02", "100219-52-03", "100219-52-04", "100219-52-05", "100219-52-06", "100219-52-07", "100219-52-08", "100219-52-09", "100219-52-10", "100219-52-11", "100219-52-12", "100219-52-13"],
    partnerLocations: ["Lucid Motors USA", "Lucid Motors EU", "Lucid Motors Middle East", "Lucid Motors Canada", "Lucid Motors UK", "Lucid Motors Germany", "Lucid Motors France", "Lucid Motors China", "Lucid Motors Japan", "Lucid Motors Korea", "Lucid Motors Australia", "Lucid Motors India"],
    globalPointOfContacts: [
      { initials: "KN", name: "Kylie Norton", bgColor: "#ec4899" },
      { initials: "TR", name: "Tyler Roberts", bgColor: "#0ea5e9" },
      { initials: "AF", name: "Alice Fisher", bgColor: "#f59e0b" },
      { initials: "BG", name: "Brian Garcia", bgColor: "#10b981" },
      { initials: "CM", name: "Catherine Miller", bgColor: "#8b5cf6" },
      { initials: "DS", name: "Daniel Scott", bgColor: "#ef4444" },
      { initials: "EW", name: "Emma Wright", bgColor: "#6366f1" },
      { initials: "FP", name: "Frank Park", bgColor: "#14b8a6" },
      { initials: "GH", name: "Grace Hall", bgColor: "#f97316" },
      { initials: "HK", name: "Henry Kim", bgColor: "#84cc16" },
      { initials: "IJ", name: "Iris Johnson", bgColor: "#a855f7" },
      { initials: "JB", name: "Jack Brown", bgColor: "#0891b2" },
    ],
    partnerGroup: "PG-1-1",
    netProfitMargin: 109.96,
    creditUtilization: 10000,
    services: "Laser cutting",
    defaultCarrierVendor: "Purolator",
    defaultCarrierCustomer: "SF Express",
    country: "Portugal",
    countryFlag: "🇵🇹",
    emailAddress: "gtaylor@yahoo.com",
    createdByContact: { initials: "ER", name: "Eli Rosenbloom", bgColor: "#8b5cf6" },
    category: "equipment",
    status: "active",
    primaryContact: {
      name: "Kylie Norton",
      email: "gtaylor@yahoo.com",
      phone: "+1 (555) 789-0123",
      designation: "Account Executive",
    },
    billingAddress: {
      street: "7373 Gateway Blvd",
      city: "Newark",
      state: "CA",
      zipCode: "94560",
      country: "United States",
    },
    taxId: "36-2345678",
    paymentTerms: "net_30",
    creditLimit: 10000,
    outstandingBalance: 10000,
    totalOrders: 56,
    totalSpent: 780000,
    rating: 4.4,
    website: "toyota.inter.com",
    notes: "Luxury EV partner. Premium vehicle components supplier.",
    createdAt: "2024-09-15T08:30:00Z",
    updatedAt: "2026-01-20T10:15:00Z",
    configData: {
      paymentMethods: [
        { id: "pm-luc1", type: "wire", typeLabel: "Wire Transfer", bankName: "Goldman Sachs", accountNumber: "9150384726", routingNumber: "021000089", wireRoutingNumber: "GOLDUS33", isSaved: true },
      ],
    },
  },
  {
    id: "v-008",
    code: "100120-70",
    companyName: "FedEx",
    displayName: "FedEx",
    partnerTypes: ["vendor"],
    vendorType: "Carrier",
    itemCodes: ["100120-70", "100120-71", "100120-72", "100120-73", "100120-74", "100120-75", "100120-76", "100120-77", "100120-78"],
    partnerLocations: ["Honda Motor Co...", "Honda North America", "Honda Japan", "Honda UK", "Honda Germany", "Honda China", "Honda India", "Honda Thailand", "Honda Brazil"],
    globalPointOfContacts: [
      { initials: "AB", name: "Anya Blevins", bgColor: "#6366f1" },
      { initials: "KJ", name: "Kyle Jenkins", bgColor: "#0ea5e9" },
      { initials: "MN", name: "Maria Nguyen", bgColor: "#f59e0b" },
      { initials: "RS", name: "Ryan Smith", bgColor: "#10b981" },
      { initials: "TL", name: "Tina Lee", bgColor: "#8b5cf6" },
      { initials: "WC", name: "William Chen", bgColor: "#ef4444" },
      { initials: "AH", name: "Amy Harris", bgColor: "#ec4899" },
      { initials: "BD", name: "Ben Davis", bgColor: "#14b8a6" },
      { initials: "CF", name: "Chloe Fisher", bgColor: "#f97316" },
      { initials: "DG", name: "Derek Garcia", bgColor: "#84cc16" },
      { initials: "EK", name: "Emily Kim", bgColor: "#a855f7" },
      { initials: "FW", name: "Frank Wilson", bgColor: "#0891b2" },
      { initials: "GR", name: "Grace Robinson", bgColor: "#e11d48" },
      { initials: "HM", name: "Henry Moore", bgColor: "#4f46e5" },
      { initials: "IP", name: "Iris Park", bgColor: "#059669" },
      { initials: "JT", name: "Jack Taylor", bgColor: "#d97706" },
      { initials: "KR", name: "Karen Roberts", bgColor: "#7c3aed" },
      { initials: "LN", name: "Leo Nguyen", bgColor: "#0284c7" },
      { initials: "MS", name: "Mia Scott", bgColor: "#db2777" },
      { initials: "NJ", name: "Nathan Jones", bgColor: "#16a34a" },
      { initials: "OL", name: "Olivia Lewis", bgColor: "#ea580c" },
      { initials: "PH", name: "Patrick Hall", bgColor: "#9333ea" },
      { initials: "QW", name: "Quinn Wright", bgColor: "#0891b2" },
      { initials: "RC", name: "Rachel Clark", bgColor: "#dc2626" },
      { initials: "SK", name: "Samuel Kim", bgColor: "#2563eb" },
    ],
    partnerGroup: "PG-1-1",
    netProfitMargin: 304.88,
    creditUtilization: 8000,
    services: "Laser cutting",
    defaultCarrierVendor: "Aramex",
    defaultCarrierCustomer: "UPS (United Parcel Service)",
    country: "Sri Lanka",
    countryFlag: "🇱🇰",
    emailAddress: "gerlo@mac.com",
    createdByContact: { initials: "NA", name: "Nophil Anwer", bgColor: "#f59e0b" },
    category: "logistics",
    status: "active",
    primaryContact: {
      name: "Anya Blevins",
      email: "gerlo@mac.com",
      phone: "+1 (555) 890-1234",
      designation: "Service Manager",
    },
    billingAddress: {
      street: "942 South Shady Grove Road",
      city: "Memphis",
      state: "TN",
      zipCode: "38120",
      country: "United States",
    },
    taxId: "86-4567890",
    paymentTerms: "net_15",
    creditLimit: 20000,
    outstandingBalance: 8000,
    totalOrders: 312,
    totalSpent: 1560000,
    rating: 4.6,
    website: "toyota.inter.com",
    notes: "Primary express shipping carrier. Priority delivery services.",
    createdAt: "2024-08-18T09:00:00Z",
    updatedAt: "2025-09-15T08:00:00Z",
    configData: {
      paymentMethods: [
        { id: "pm-fed1", type: "ach", typeLabel: "ACH / Direct Deposit", bankName: "US Bank", accountNumber: "7283019465", routingNumber: "091000019", isSaved: true, discountPercent: 1 },
        { id: "pm-fed2", type: "digital_wallet", typeLabel: "Digital Wallet", walletProvider: "Stripe", walletId: "acct_fedex_corp", isSaved: true },
        { id: "pm-fed3", type: "wire", typeLabel: "Wire Transfer", bankName: "Deutsche Bank", accountNumber: "4829103765", routingNumber: "021000089", wireRoutingNumber: "DEUTDEFF", isSaved: true },
        { id: "pm-fed4", type: "check", typeLabel: "Check / Paper", checkPayableTo: "FedEx Corporation", isSaved: true },
      ],
    },
  },
  {
    id: "v-009",
    code: "100120-71",
    companyName: "Nissan North America",
    displayName: "Nissan North America",
    partnerTypes: ["vendor"],
    vendorType: "In-store Vendor",
    itemCodes: ["100120-71", "100120-72", "100120-73", "100120-74", "100120-75"],
    partnerLocations: ["Nissan North Amer...", "Nissan Japan", "Nissan UK", "Nissan Mexico", "Nissan Brazil"],
    globalPointOfContacts: [
      { initials: "JM", name: "Jimena Morrow", bgColor: "#14b8a6" },
      { initials: "AK", name: "Andrew Kim", bgColor: "#0ea5e9" },
      { initials: "BL", name: "Beth Lewis", bgColor: "#f59e0b" },
      { initials: "CP", name: "Chris Park", bgColor: "#10b981" },
      { initials: "DH", name: "Diana Harris", bgColor: "#8b5cf6" },
      { initials: "EW", name: "Eric Wilson", bgColor: "#ef4444" },
      { initials: "FG", name: "Fiona Garcia", bgColor: "#6366f1" },
      { initials: "GJ", name: "George Johnson", bgColor: "#ec4899" },
      { initials: "HM", name: "Holly Martinez", bgColor: "#f97316" },
      { initials: "IT", name: "Ivan Thompson", bgColor: "#84cc16" },
      { initials: "JC", name: "Julia Clark", bgColor: "#a855f7" },
      { initials: "KD", name: "Kevin Davis", bgColor: "#0891b2" },
      { initials: "LF", name: "Laura Fisher", bgColor: "#e11d48" },
      { initials: "MN", name: "Mike Nguyen", bgColor: "#4f46e5" },
      { initials: "NS", name: "Nancy Scott", bgColor: "#059669" },
      { initials: "OL", name: "Oscar Lee", bgColor: "#d97706" },
      { initials: "PR", name: "Pat Robinson", bgColor: "#7c3aed" },
    ],
    partnerGroup: "PG-1-1",
    netProfitMargin: 851.57,
    creditUtilization: 5000,
    services: "Laser cutting",
    defaultCarrierVendor: "Blue Dart",
    defaultCarrierCustomer: "DHL Express",
    country: "Russia",
    countryFlag: "🇷🇺",
    emailAddress: "grossman@icloud.com",
    createdByContact: { initials: "IA", name: "Irtaza Abid", bgColor: "#ef4444" },
    category: "equipment",
    status: "inactive",
    primaryContact: {
      name: "Jimena Morrow",
      email: "grossman@icloud.com",
      phone: "+1 (555) 901-2345",
      designation: "Regional Manager",
    },
    billingAddress: {
      street: "One Nissan Way",
      city: "Franklin",
      state: "TN",
      zipCode: "37067",
      country: "United States",
    },
    taxId: "76-5678901",
    paymentTerms: "net_45",
    creditLimit: 5000,
    outstandingBalance: 5000,
    totalOrders: 87,
    totalSpent: 920000,
    rating: 4.0,
    website: "toyota.inter.com",
    notes: "Automotive manufacturer partner. Parts and components.",
    createdAt: "2024-07-23T11:00:00Z",
    updatedAt: "2026-02-05T15:30:00Z",
  },
  {
    id: "v-010",
    code: "100120-72",
    companyName: "BMW of North America",
    displayName: "BMW of North America",
    partnerTypes: ["customer"],
    vendorType: "",
    itemCodes: ["100120-72", "100120-73", "100120-74", "100120-75", "100120-76", "100120-77", "100120-78", "100120-79", "100120-80", "100120-81", "100120-82", "100120-83", "100120-84", "100120-85", "100120-86", "100120-87", "100120-88", "100120-89"],
    partnerLocations: ["BMW of North A...", "BMW Germany", "BMW UK", "BMW China", "BMW India", "BMW South Africa", "BMW Australia", "BMW Japan", "BMW Korea", "BMW France", "BMW Italy", "BMW Spain", "BMW Brazil", "BMW Mexico", "BMW Canada", "BMW Netherlands", "BMW Austria", "BMW Sweden", "BMW Norway"],
    globalPointOfContacts: [
      { initials: "VD", name: "Vivian Davila", bgColor: "#a855f7" },
      { initials: "JL", name: "Jason Lee", bgColor: "#0ea5e9" },
      { initials: "KM", name: "Karen Moore", bgColor: "#f59e0b" },
      { initials: "RS", name: "Ryan Smith", bgColor: "#10b981" },
      { initials: "TH", name: "Tina Harris", bgColor: "#8b5cf6" },
      { initials: "WG", name: "William Garcia", bgColor: "#ef4444" },
      { initials: "AC", name: "Amy Clark", bgColor: "#6366f1" },
      { initials: "BD", name: "Ben Davis", bgColor: "#ec4899" },
      { initials: "CN", name: "Claire Nguyen", bgColor: "#14b8a6" },
      { initials: "DP", name: "Derek Park", bgColor: "#f97316" },
      { initials: "EK", name: "Emily Kim", bgColor: "#84cc16" },
      { initials: "FW", name: "Frank Wilson", bgColor: "#0891b2" },
      { initials: "GJ", name: "Grace Johnson", bgColor: "#e11d48" },
      { initials: "HT", name: "Henry Taylor", bgColor: "#4f46e5" },
      { initials: "IR", name: "Iris Robinson", bgColor: "#059669" },
      { initials: "JB", name: "Jack Brown", bgColor: "#d97706" },
      { initials: "KF", name: "Karen Fisher", bgColor: "#7c3aed" },
      { initials: "LH", name: "Leo Hall", bgColor: "#0284c7" },
      { initials: "MM", name: "Mia Martinez", bgColor: "#db2777" },
      { initials: "NS", name: "Nathan Scott", bgColor: "#16a34a" },
    ],
    partnerGroup: "PG-1-1",
    netProfitMargin: 590.84,
    creditUtilization: 5000,
    services: "Laser cutting",
    defaultCarrierVendor: "Australia Post",
    defaultCarrierCustomer: "TCS (Tranzum Courier Service)",
    country: "Georgia",
    countryFlag: "🇬🇪",
    emailAddress: "matthjs@att.net",
    createdByContact: { initials: "AA", name: "Ahtisham Ahmad", bgColor: "#6366f1" },
    category: "equipment",
    status: "active",
    primaryContact: {
      name: "Vivian Davila",
      email: "matthjs@att.net",
      phone: "+1 (555) 012-3456",
      designation: "Sales Engineer",
    },
    billingAddress: {
      street: "300 Chestnut Ridge Road",
      city: "Woodcliff Lake",
      state: "NJ",
      zipCode: "07677",
      country: "United States",
    },
    taxId: "58-6789012",
    paymentTerms: "net_30",
    creditLimit: 5000,
    outstandingBalance: 5000,
    totalOrders: 78,
    totalSpent: 1340000,
    rating: 4.5,
    website: "toyota.inter.com",
    notes: "Premium automotive brand customer. High-value components.",
    createdAt: "2024-06-14T14:00:00Z",
    updatedAt: "2026-01-28T12:00:00Z",
  },
  {
    id: "v-011",
    code: "100120-73",
    companyName: "Toyota China Motors",
    displayName: "Toyota China Motors",
    partnerTypes: ["vendor"],
    vendorType: "Online vendor",
    itemCodes: ["100120-73", "100120-74", "100120-75", "100120-76", "100120-77", "100120-78", "100120-79", "100120-80", "100120-81", "100120-82", "100120-83", "100120-84", "100120-85"],
    partnerLocations: ["Toyota Technical...", "Toyota China HQ", "Toyota Guangzhou", "Toyota Shanghai", "Toyota Beijing", "Toyota Chengdu", "Toyota Tianjin", "Toyota Shenzhen", "Toyota Wuhan", "Toyota Hangzhou", "Toyota Nanjing", "Toyota Changchun", "Toyota Xi'an", "Toyota Shenyang", "Toyota Dalian", "Toyota Qingdao", "Toyota Zhengzhou", "Toyota Kunming", "Toyota Hefei", "Toyota Fuzhou", "Toyota Xiamen", "Toyota Nanning", "Toyota Harbin", "Toyota Changsha", "Toyota Jinan"],
    globalPointOfContacts: [
      { initials: "TM", name: "Tianna Mcdowell", bgColor: "#0ea5e9" },
      { initials: "JL", name: "Jason Lee", bgColor: "#f59e0b" },
      { initials: "KW", name: "Karen Wang", bgColor: "#10b981" },
      { initials: "RL", name: "Ryan Li", bgColor: "#8b5cf6" },
      { initials: "SW", name: "Sophia Wu", bgColor: "#ef4444" },
    ],
    partnerGroup: "PG-1-1",
    netProfitMargin: 251.79,
    creditUtilization: 3410,
    services: "Laser cutting",
    defaultCarrierVendor: "FedEx",
    defaultCarrierCustomer: "Australia Post",
    country: "Dominica",
    countryFlag: "🇩🇲",
    emailAddress: "mjewel@hotmail.com",
    createdByContact: { initials: "ER", name: "Eli Rosenbloom", bgColor: "#8b5cf6" },
    category: "equipment",
    status: "active",
    primaryContact: {
      name: "Tianna Mcdowell",
      email: "mjewel@hotmail.com",
      phone: "+86 (21) 5049-8888",
      designation: "China Operations Manager",
    },
    billingAddress: {
      street: "1-4-18 Koraku",
      city: "Shanghai",
      state: "SH",
      zipCode: "200000",
      country: "China",
    },
    taxId: "CN-1234567",
    paymentTerms: "net_30",
    creditLimit: 10000,
    outstandingBalance: 3410,
    totalOrders: 134,
    totalSpent: 2100000,
    rating: 4.3,
    website: "toyota.inter.com",
    notes: "Toyota's China division. Major manufacturing partner.",
    createdAt: "2024-09-15T09:00:00Z",
    updatedAt: "2025-12-10T14:30:00Z",
  },
  {
    id: "v-012",
    code: "100120-74",
    companyName: "Ford Motor Company",
    displayName: "Ford Motor Company",
    partnerTypes: ["vendor", "customer"],
    vendorType: "",
    itemCodes: ["100120-74", "100120-75", "100120-76", "100120-77", "100120-78", "100120-79", "100120-80"],
    partnerLocations: ["Ford USA", "Ford Europe", "Ford Canada", "Ford Mexico", "Ford Brazil", "Ford Australia", "Ford China", "Ford India", "Ford UK", "Ford Germany", "Ford Spain"],
    globalPointOfContacts: [
      { initials: "KK", name: "Kristin Krause", bgColor: "#ef4444" },
      { initials: "JL", name: "Jason Lee", bgColor: "#0ea5e9" },
      { initials: "MW", name: "Maria Wang", bgColor: "#f59e0b" },
    ],
    partnerGroup: "PG-1-1",
    netProfitMargin: 837.38,
    creditUtilization: 8000,
    services: "Laser cutting",
    defaultCarrierVendor: "TCS (Tranzum Courier Service)",
    defaultCarrierCustomer: "Blue Dart",
    country: "Serbia",
    countryFlag: "🇷🇸",
    emailAddress: "msher@icloud.com",
    createdByContact: { initials: "NA", name: "Nophil Anwer", bgColor: "#f59e0b" },
    category: "equipment",
    status: "active",
    primaryContact: {
      name: "Kristin Krause",
      email: "msher@icloud.com",
      phone: "+1 (313) 322-3000",
      designation: "Global Procurement",
    },
    billingAddress: {
      street: "One American Road",
      city: "Dearborn",
      state: "MI",
      zipCode: "48126",
      country: "United States",
    },
    taxId: "MI-3456789",
    paymentTerms: "net_60",
    creditLimit: 20000,
    outstandingBalance: 8000,
    totalOrders: 203,
    totalSpent: 3200000,
    rating: 4.7,
    website: "toyota.inter.com",
    notes: "Both vendor and customer. Major automotive conglomerate.",
    createdAt: "2024-08-18T10:00:00Z",
    updatedAt: "2026-01-28T12:00:00Z",
  },
  {
    id: "v-013",
    code: "100120-75",
    companyName: "General Motors (GM)",
    displayName: "General Motors (GM)",
    partnerTypes: ["vendor"],
    vendorType: "In-store Vendor",
    itemCodes: ["100120-75", "100120-76", "100120-77"],
    partnerLocations: ["General Motors US", "GM Canada", "GM Mexico", "GM Brazil", "GM China", "GM Europe", "GM India", "GM Korea", "GM Australia"],
    globalPointOfContacts: [
      { initials: "KH", name: "Kason Hoover", bgColor: "#10b981" },
      { initials: "JL", name: "Jason Lee", bgColor: "#0ea5e9" },
      { initials: "MP", name: "Maria Park", bgColor: "#f59e0b" },
      { initials: "RS", name: "Ryan Smith", bgColor: "#8b5cf6" },
      { initials: "TH", name: "Tina Harris", bgColor: "#ef4444" },
      { initials: "WG", name: "William Garcia", bgColor: "#6366f1" },
      { initials: "AC", name: "Amy Clark", bgColor: "#ec4899" },
      { initials: "BD", name: "Ben Davis", bgColor: "#14b8a6" },
    ],
    partnerGroup: "PG-1-1",
    netProfitMargin: 850.41,
    creditUtilization: 3410,
    services: "Laser cutting",
    defaultCarrierVendor: "DHL Express",
    defaultCarrierCustomer: "DHL Express",
    country: "Mauritania",
    countryFlag: "🇲🇷",
    emailAddress: "bescoto@live.com",
    createdByContact: { initials: "IA", name: "Irtaza Abid", bgColor: "#ef4444" },
    category: "equipment",
    status: "active",
    primaryContact: {
      name: "Kason Hoover",
      email: "bescoto@live.com",
      phone: "+1 (313) 556-5000",
      designation: "Vendor Relations",
    },
    billingAddress: {
      street: "300 Renaissance Center",
      city: "Detroit",
      state: "MI",
      zipCode: "48265",
      country: "United States",
    },
    taxId: "MI-7890123",
    paymentTerms: "net_30",
    creditLimit: 10000,
    outstandingBalance: 3410,
    totalOrders: 145,
    totalSpent: 2800000,
    rating: 4.4,
    website: "toyota.inter.com",
    notes: "GM vendor division. Supplies automotive components.",
    createdAt: "2024-07-23T10:00:00Z",
    updatedAt: "2026-01-15T16:00:00Z",
  },
  {
    id: "v-014",
    code: "100219-42",
    companyName: "Tesla, Inc.",
    displayName: "Tesla, Inc.",
    partnerTypes: ["customer"],
    vendorType: "",
    itemCodes: ["100219-42", "100219-43"],
    partnerLocations: ["Tesla, Texas", "Tesla Fremont", "Tesla Shanghai", "Tesla Berlin"],
    globalPointOfContacts: [
      { initials: "AL", name: "Annabella Leon", bgColor: "#f97316" },
      { initials: "KP", name: "Kyle Peters", bgColor: "#0ea5e9" },
      { initials: "RM", name: "Rachel Moore", bgColor: "#f59e0b" },
      { initials: "SJ", name: "Steve Johnson", bgColor: "#10b981" },
      { initials: "NR", name: "Nina Rodriguez", bgColor: "#ef4444" },
      { initials: "DC", name: "David Clark", bgColor: "#6366f1" },
      { initials: "ML", name: "Maria Lopez", bgColor: "#ec4899" },
      { initials: "TW", name: "Tom Wright", bgColor: "#14b8a6" },
      { initials: "JK", name: "Jane Kim", bgColor: "#f97316" },
      { initials: "BN", name: "Brad Nelson", bgColor: "#84cc16" },
      { initials: "AW", name: "Amy Watson", bgColor: "#a855f7" },
      { initials: "CH", name: "Chris Hall", bgColor: "#0891b2" },
      { initials: "EP", name: "Emma Price", bgColor: "#e11d48" },
      { initials: "GS", name: "Gary Smith", bgColor: "#4f46e5" },
    ],
    partnerGroup: "PG-1-1",
    netProfitMargin: 728.72,
    creditUtilization: 20000,
    services: "Laser cutting",
    defaultCarrierVendor: "UPS (United Parcel Service)",
    defaultCarrierCustomer: "SF Express",
    country: "Singapore",
    countryFlag: "🇸🇬",
    emailAddress: "leviathan@comcast.net",
    createdByContact: { initials: "AA", name: "Ahtisham Ahmad", bgColor: "#6366f1" },
    category: "technology",
    status: "active",
    primaryContact: {
      name: "Annabella Leon",
      email: "leviathan@comcast.net",
      phone: "+1 (555) 456-7890",
      designation: "Customer Relations",
    },
    billingAddress: {
      street: "3500 Deer Creek Road",
      city: "Palo Alto",
      state: "CA",
      zipCode: "94304",
      country: "United States",
    },
    taxId: "CA-5678901",
    paymentTerms: "net_30",
    creditLimit: 20000,
    outstandingBalance: 20000,
    totalOrders: 89,
    totalSpent: 1950000,
    rating: 4.6,
    website: "toyota.inter.com",
    notes: "Tesla customer division. Major EV manufacturer.",
    createdAt: "2024-06-14T09:30:00Z",
    updatedAt: "2025-06-30T11:00:00Z",
  },
  {
    id: "v-015",
    code: "100219-51",
    companyName: "Chrysler (Stellantis N.V.)",
    displayName: "Chrysler (Stellantis N.V.)",
    partnerTypes: ["vendor"],
    vendorType: "Online vendor, Seller, Carrier",
    itemCodes: ["100219-51", "100219-52", "100219-53", "100219-54", "100219-55", "100219-56", "100219-57", "100219-58", "100219-59", "100219-60"],
    partnerLocations: ["Chrysler (Stellantis...)", "Stellantis USA", "Stellantis Italy", "Stellantis France", "Stellantis Germany", "Stellantis Brazil", "Stellantis Canada", "Stellantis Mexico", "Stellantis UK"],
    globalPointOfContacts: [
      { initials: "NB", name: "Nola Blanchard", bgColor: "#0ea5e9" },
      { initials: "LK", name: "Laura King", bgColor: "#8b5cf6" },
      { initials: "MR", name: "Michael Ross", bgColor: "#f59e0b" },
      { initials: "JN", name: "Jessica Nelson", bgColor: "#10b981" },
      { initials: "PH", name: "Patrick Hill", bgColor: "#ef4444" },
    ],
    partnerGroup: "PG-1-1",
    netProfitMargin: 828.57,
    creditUtilization: 8000,
    services: "Laser cutting",
    defaultCarrierVendor: "SF Express",
    defaultCarrierCustomer: "Blue Dart",
    country: "Zimbabwe",
    countryFlag: "🇿🇼",
    emailAddress: "cidac@mac.com",
    createdByContact: { initials: "AA", name: "Ahtisham Ahmad", bgColor: "#6366f1" },
    category: "equipment",
    status: "active",
    primaryContact: {
      name: "Nola Blanchard",
      email: "cidac@mac.com",
      phone: "+1 (555) 567-8901",
      designation: "Business Development",
    },
    billingAddress: {
      street: "1000 Chrysler Drive",
      city: "Auburn Hills",
      state: "MI",
      zipCode: "48326",
      country: "United States",
    },
    taxId: "MI-2345678",
    paymentTerms: "net_45",
    creditLimit: 20000,
    outstandingBalance: 8000,
    totalOrders: 76,
    totalSpent: 1100000,
    rating: 4.2,
    website: "toyota.inter.com",
    notes: "Stellantis group vendor. Multi-service provider.",
    createdAt: "2024-12-23T07:00:00Z",
    updatedAt: "2026-02-01T13:45:00Z",
  },
  {
    id: "v-016",
    code: "100219-51-01",
    companyName: "Rivian Automotive",
    displayName: "Rivian Automotive",
    partnerTypes: ["vendor"],
    vendorType: "Carrier",
    itemCodes: ["100219-51-01", "100219-51-02", "100219-51-03", "100219-51-04", "100219-51-05", "100219-51-06", "100219-51-07", "100219-51-08", "100219-51-09", "100219-51-10", "100219-51-11", "100219-51-12", "100219-51-13", "100219-51-14", "100219-51-15", "100219-51-16", "100219-51-17", "100219-51-18", "100219-51-19", "100219-51-20", "100219-51-21", "100219-51-22"],
    partnerLocations: ["Rivian Automotive US", "Rivian Normal IL", "Rivian Irvine CA", "Rivian Plymouth MI", "Rivian Carson CA", "Rivian Palo Alto CA", "Rivian Vancouver BC", "Rivian Atlanta GA", "Rivian Woking UK", "Rivian Stuttgart DE", "Rivian Shanghai CN", "Rivian Tokyo JP", "Rivian Seoul KR", "Rivian Sydney AU", "Rivian Dubai AE", "Rivian Sao Paulo BR", "Rivian Mexico City MX", "Rivian Toronto ON", "Rivian London UK", "Rivian Paris FR", "Rivian Berlin DE", "Rivian Milan IT", "Rivian Amsterdam NL", "Rivian Stockholm SE", "Rivian Oslo NO", "Rivian Helsinki FI", "Rivian Copenhagen DK", "Rivian Zurich CH", "Rivian Vienna AT", "Rivian Brussels BE", "Rivian Lisbon PT", "Rivian Madrid ES", "Rivian Warsaw PL", "Rivian Prague CZ", "Rivian Budapest HU", "Rivian Bucharest RO", "Rivian Sofia BG", "Rivian Athens GR", "Rivian Istanbul TR", "Rivian Cairo EG", "Rivian Nairobi KE", "Rivian Lagos NG", "Rivian Johannesburg ZA", "Rivian Mumbai IN"],
    globalPointOfContacts: [
      { initials: "TW", name: "Tyrese Webb", bgColor: "#8b5cf6" },
      { initials: "HT", name: "Hannah Thompson", bgColor: "#0ea5e9" },
      { initials: "RL", name: "Ryan Lewis", bgColor: "#f59e0b" },
      { initials: "MC", name: "Maria Clark", bgColor: "#10b981" },
      { initials: "JD", name: "Jake Davis", bgColor: "#ef4444" },
      { initials: "SW", name: "Sophia Wilson", bgColor: "#6366f1" },
      { initials: "AN", name: "Alex Nguyen", bgColor: "#ec4899" },
      { initials: "BJ", name: "Brian Jones", bgColor: "#14b8a6" },
      { initials: "CK", name: "Cathy Kim", bgColor: "#f97316" },
      { initials: "DM", name: "Derek Moore", bgColor: "#84cc16" },
      { initials: "EF", name: "Elena Fisher", bgColor: "#a855f7" },
      { initials: "GH", name: "George Harris", bgColor: "#0891b2" },
      { initials: "IJ", name: "Iris Johnson", bgColor: "#e11d48" },
      { initials: "KL", name: "Kevin Lee", bgColor: "#4f46e5" },
      { initials: "MN", name: "Mia Nguyen", bgColor: "#059669" },
      { initials: "OP", name: "Oscar Park", bgColor: "#d97706" },
      { initials: "QR", name: "Quinn Roberts", bgColor: "#7c3aed" },
    ],
    partnerGroup: "PG-1-1",
    netProfitMargin: 830.98,
    creditUtilization: 10000,
    services: "Laser cutting",
    defaultCarrierVendor: "Japan Post",
    defaultCarrierCustomer: "FedEx",
    country: "Tonga",
    countryFlag: "🇹🇴",
    emailAddress: "bester@me.com",
    createdByContact: { initials: "FK", name: "Faizan Khan", bgColor: "#10b981" },
    category: "logistics",
    status: "active",
    primaryContact: {
      name: "Tyrese Webb",
      email: "bester@me.com",
      phone: "+1 (555) 678-9012",
      designation: "Logistics Coordinator",
    },
    billingAddress: {
      street: "14600 Myford Road",
      city: "Irvine",
      state: "CA",
      zipCode: "92606",
      country: "United States",
    },
    taxId: "CA-7890123",
    paymentTerms: "net_30",
    creditLimit: 10000,
    outstandingBalance: 10000,
    totalOrders: 56,
    totalSpent: 670000,
    rating: 4.1,
    website: "toyota.inter.com",
    notes: "Rivian vendor division. Carrier services.",
    createdAt: "2024-11-25T10:00:00Z",
    updatedAt: "2026-02-10T10:00:00Z",
  },
  {
    id: "v-017",
    code: "100219-52",
    companyName: "Lucid Motors",
    displayName: "Lucid Motors",
    partnerTypes: ["vendor"],
    vendorType: "In-store Vendor",
    itemCodes: ["100219-52", "100219-53", "100219-54", "100219-55", "100219-56", "100219-57", "100219-58"],
    partnerLocations: ["Lucid Motors USA", "Lucid Motors EU", "Lucid Motors Middle East", "Lucid Motors Canada", "Lucid Motors UK", "Lucid Motors Germany", "Lucid Motors France", "Lucid Motors China", "Lucid Motors Japan", "Lucid Motors Korea", "Lucid Motors Australia", "Lucid Motors India"],
    globalPointOfContacts: [
      { initials: "RA", name: "Ruth Acosta", bgColor: "#ef4444" },
      { initials: "TR", name: "Tyler Roberts", bgColor: "#0ea5e9" },
      { initials: "AF", name: "Alice Fisher", bgColor: "#f59e0b" },
      { initials: "BG", name: "Brian Garcia", bgColor: "#10b981" },
      { initials: "CM", name: "Catherine Miller", bgColor: "#8b5cf6" },
      { initials: "DS", name: "Daniel Scott", bgColor: "#6366f1" },
      { initials: "EW", name: "Emma Wright", bgColor: "#ec4899" },
      { initials: "FP", name: "Frank Park", bgColor: "#14b8a6" },
      { initials: "GH", name: "Grace Hall", bgColor: "#f97316" },
      { initials: "HK", name: "Henry Kim", bgColor: "#84cc16" },
      { initials: "IJ", name: "Iris Johnson", bgColor: "#a855f7" },
      { initials: "JB", name: "Jack Brown", bgColor: "#0891b2" },
      { initials: "KL", name: "Kevin Lee", bgColor: "#e11d48" },
      { initials: "LM", name: "Laura Moore", bgColor: "#4f46e5" },
      { initials: "MN", name: "Maria Nguyen", bgColor: "#059669" },
      { initials: "OP", name: "Oscar Park", bgColor: "#d97706" },
      { initials: "QR", name: "Quinn Roberts", bgColor: "#7c3aed" },
      { initials: "ST", name: "Sophia Taylor", bgColor: "#0284c7" },
      { initials: "UV", name: "Uma Varma", bgColor: "#db2777" },
      { initials: "WX", name: "William Xu", bgColor: "#16a34a" },
      { initials: "YZ", name: "Yvonne Zhang", bgColor: "#ea580c" },
      { initials: "AB", name: "Adam Bell", bgColor: "#9333ea" },
      { initials: "CD", name: "Claire Davis", bgColor: "#0891b2" },
      { initials: "EF", name: "Elena Fisher", bgColor: "#dc2626" },
      { initials: "GH", name: "George Harris", bgColor: "#2563eb" },
    ],
    partnerGroup: "PG-1-1",
    netProfitMargin: 238.60,
    creditUtilization: 8000,
    services: "Laser cutting",
    defaultCarrierVendor: "Purolator",
    defaultCarrierCustomer: "SF Express",
    country: "Armenia",
    countryFlag: "🇦🇲",
    emailAddress: "jyoliver@comcast.net",
    createdByContact: { initials: "AT", name: "Areeb Tanveer", bgColor: "#0ea5e9" },
    category: "equipment",
    status: "active",
    primaryContact: {
      name: "Ruth Acosta",
      email: "jyoliver@comcast.net",
      phone: "+1 (555) 789-0123",
      designation: "In-store Operations",
    },
    billingAddress: {
      street: "7373 Gateway Blvd",
      city: "Newark",
      state: "CA",
      zipCode: "94560",
      country: "United States",
    },
    taxId: "CA-3456789",
    paymentTerms: "net_30",
    creditLimit: 10000,
    outstandingBalance: 8000,
    totalOrders: 43,
    totalSpent: 520000,
    rating: 4.0,
    website: "toyota.inter.com",
    notes: "Lucid Motors in-store vendor. Retail operations.",
    createdAt: "2024-10-29T10:00:00Z",
    updatedAt: "2026-01-20T10:15:00Z",
  },
  {
    id: "v-018",
    code: "100219-52-02",
    companyName: "Honda Motor Co., Ltd. (USA)",
    displayName: "Honda Motor Co., Ltd. (USA)",
    partnerTypes: ["vendor"],
    vendorType: "Online vendor, Seller, Carrier",
    itemCodes: ["100219-52-02", "100219-52-03", "100219-52-04", "100219-52-05", "100219-52-06", "100219-52-07", "100219-52-08", "100219-52-09", "100219-52-10", "100219-52-11", "100219-52-12", "100219-52-13"],
    partnerLocations: ["Honda Motor Co...", "Honda North America", "Honda Japan", "Honda UK", "Honda Germany", "Honda China", "Honda India", "Honda Thailand", "Honda Brazil"],
    globalPointOfContacts: [
      { initials: "JM", name: "Journey Macias", bgColor: "#14b8a6" },
      { initials: "AK", name: "Andrew Kim", bgColor: "#0ea5e9" },
      { initials: "BL", name: "Beth Lewis", bgColor: "#f59e0b" },
      { initials: "CP", name: "Chris Park", bgColor: "#10b981" },
      { initials: "DH", name: "Diana Harris", bgColor: "#8b5cf6" },
      { initials: "EW", name: "Eric Wilson", bgColor: "#ef4444" },
      { initials: "FG", name: "Fiona Garcia", bgColor: "#6366f1" },
      { initials: "GJ", name: "George Johnson", bgColor: "#ec4899" },
      { initials: "HM", name: "Holly Martinez", bgColor: "#f97316" },
      { initials: "IT", name: "Ivan Thompson", bgColor: "#84cc16" },
      { initials: "JC", name: "Julia Clark", bgColor: "#a855f7" },
      { initials: "KD", name: "Kevin Davis", bgColor: "#0891b2" },
      { initials: "LF", name: "Laura Fisher", bgColor: "#e11d48" },
      { initials: "MN", name: "Mike Nguyen", bgColor: "#4f46e5" },
      { initials: "NS", name: "Nancy Scott", bgColor: "#059669" },
      { initials: "OL", name: "Oscar Lee", bgColor: "#d97706" },
    ],
    partnerGroup: "PG-1-1",
    netProfitMargin: 480.86,
    creditUtilization: 20000,
    services: "Laser cutting",
    defaultCarrierVendor: "Aramex",
    defaultCarrierCustomer: "UPS (United Parcel Service)",
    country: "Angola",
    countryFlag: "🇦🇴",
    emailAddress: "tfinniga@att.net",
    createdByContact: { initials: "AA", name: "Ahtisham Ahmad", bgColor: "#6366f1" },
    category: "equipment",
    status: "active",
    primaryContact: {
      name: "Journey Macias",
      email: "tfinniga@att.net",
      phone: "+1 (310) 783-2000",
      designation: "Sales Director",
    },
    billingAddress: {
      street: "1919 Torrance Blvd",
      city: "Torrance",
      state: "CA",
      zipCode: "90501",
      country: "United States",
    },
    taxId: "CA-8901234",
    paymentTerms: "net_45",
    creditLimit: 20000,
    outstandingBalance: 20000,
    totalOrders: 167,
    totalSpent: 2450000,
    rating: 4.8,
    website: "toyota.inter.com",
    notes: "Honda USA division. Comprehensive automotive partnership.",
    createdAt: "2024-12-23T10:00:00Z",
    updatedAt: "2026-02-05T15:30:00Z",
  },
  {
    id: "v-019",
    code: "100120-72",
    companyName: "Nissan North America",
    displayName: "Nissan North America",
    partnerTypes: ["vendor"],
    vendorType: "Seller",
    itemCodes: ["100120-72", "100120-73", "100120-74", "100120-75", "100120-76", "100120-77", "100120-78", "100120-79", "100120-80", "100120-81", "100120-82", "100120-83", "100120-84", "100120-85", "100120-86", "100120-87", "100120-88", "100120-89"],
    partnerLocations: ["Honda Motor Co...", "Honda North America", "Honda Japan", "Honda UK", "Honda Germany", "Honda China", "Honda India", "Honda Thailand", "Honda Brazil"],
    globalPointOfContacts: [
      { initials: "LB", name: "Lilliana Burnett", bgColor: "#6366f1" },
      { initials: "AK", name: "Andrew Kim", bgColor: "#0ea5e9" },
      { initials: "BL", name: "Beth Lewis", bgColor: "#f59e0b" },
      { initials: "CP", name: "Chris Park", bgColor: "#10b981" },
      { initials: "DH", name: "Diana Harris", bgColor: "#8b5cf6" },
      { initials: "EW", name: "Eric Wilson", bgColor: "#ef4444" },
      { initials: "FG", name: "Fiona Garcia", bgColor: "#ec4899" },
      { initials: "GJ", name: "George Johnson", bgColor: "#14b8a6" },
      { initials: "HM", name: "Holly Martinez", bgColor: "#f97316" },
      { initials: "IT", name: "Ivan Thompson", bgColor: "#84cc16" },
      { initials: "JC", name: "Julia Clark", bgColor: "#a855f7" },
      { initials: "KD", name: "Kevin Davis", bgColor: "#0891b2" },
      { initials: "LF", name: "Laura Fisher", bgColor: "#e11d48" },
      { initials: "MN", name: "Mike Nguyen", bgColor: "#4f46e5" },
      { initials: "NS", name: "Nancy Scott", bgColor: "#059669" },
      { initials: "OL", name: "Oscar Lee", bgColor: "#d97706" },
      { initials: "PR", name: "Pat Robinson", bgColor: "#7c3aed" },
      { initials: "QS", name: "Quinn Smith", bgColor: "#0284c7" },
    ],
    partnerGroup: "PG-1-1",
    netProfitMargin: 84.43,
    creditUtilization: 3410,
    services: "Laser cutting",
    defaultCarrierVendor: "Blue Dart",
    defaultCarrierCustomer: "DHL Express",
    country: "Australia",
    countryFlag: "🇦🇺",
    emailAddress: "aardo@hotmail.com",
    createdByContact: { initials: "FK", name: "Faizan Khan", bgColor: "#10b981" },
    category: "equipment",
    status: "active",
    primaryContact: {
      name: "Lilliana Burnett",
      email: "aardo@hotmail.com",
      phone: "+1 (555) 901-2345",
      designation: "Sales Representative",
    },
    billingAddress: {
      street: "One Nissan Way",
      city: "Franklin",
      state: "TN",
      zipCode: "37067",
      country: "United States",
    },
    taxId: "TN-1234567",
    paymentTerms: "net_30",
    creditLimit: 5000,
    outstandingBalance: 3410,
    totalOrders: 92,
    totalSpent: 870000,
    rating: 4.2,
    website: "toyota.inter.com",
    notes: "Nissan vendor. Automotive parts and assembly components.",
    createdAt: "2024-11-25T10:00:00Z",
    updatedAt: "2026-02-05T15:30:00Z",
  },
];

/* ── Patch existing vendors with sub-types ── */
const existingSubTypePatch: Record<string, { v?: string[]; c?: string[] }> = {
  "v-001": { v: ["Seller (Items)", "Service Provider"] },
  "v-002": { v: ["Carrier"] },
  "v-003": { c: ["Wholesale Buyer", "B2B Client"] },
  "v-004": { v: ["Online Vendor", "Seller (Items)"] },
  "v-005": { v: ["Seller (Items)", "Sub Contractor"] },
  "v-006": { c: ["Retail Buyer", "End Consumer"] },
  "v-007": { v: ["Seller (Items)"] },
  "v-008": { v: ["Carrier", "Service Provider"] },
  "v-009": { v: ["In-Store Vendor", "Seller (Items)"] },
  "v-010": { c: ["Wholesale Buyer", "Distributor"] },
  "v-011": { v: ["Online Vendor"] },
  "v-012": { v: ["Seller (Items)"], c: ["B2B Client"] },
  "v-013": { v: ["In-Store Vendor"] },
  "v-014": { c: ["Retail Buyer", "Reseller"] },
  "v-015": { v: ["Online Vendor", "Seller (Items)", "Carrier"] },
  "v-016": { v: ["Carrier", "Service Provider"] },
  "v-017": { v: ["In-Store Vendor", "Sub Contractor"] },
  "v-018": { v: ["Online Vendor", "Seller (Items)", "Carrier"] },
  "v-019": { v: ["Seller (Items)"] },
};

_manualVendors.forEach((v) => {
  const patch = existingSubTypePatch[v.id];
  if (patch) {
    if (patch.v) v.vendorSubTypes = patch.v;
    if (patch.c) v.customerSubTypes = patch.c;
  }
});

/* ── Generate additional vendors to reach 100 total ── */
const COMPANY_DATA: { name: string; partnerTypes: PartnerType[]; vSubs?: string[]; cSubs?: string[]; country: string; flag: string; category: VendorCategory; email: string; website: string }[] = [
  { name: "Bosch Automotive", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "Service Provider"], country: "Germany", flag: "🇩🇪", category: "equipment", email: "contact@bosch-auto.de", website: "bosch.com" },
  { name: "Magna International", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "Sub Contractor"], country: "Canada", flag: "🇨🇦", category: "raw_materials", email: "info@magna.com", website: "magna.com" },
  { name: "Continental AG", partnerTypes: ["vendor"], vSubs: ["Seller (Items)"], country: "Germany", flag: "🇩🇪", category: "equipment", email: "sales@continental.de", website: "continental.com" },
  { name: "Denso Corporation", partnerTypes: ["vendor", "customer"], vSubs: ["Seller (Items)", "Online Vendor"], cSubs: ["B2B Client"], country: "Japan", flag: "🇯🇵", category: "technology", email: "info@denso.co.jp", website: "denso.com" },
  { name: "ZF Friedrichshafen", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "Sub Contractor"], country: "Germany", flag: "🇩🇪", category: "equipment", email: "info@zf.com", website: "zf.com" },
  { name: "Aisin Seiki Co.", partnerTypes: ["vendor"], vSubs: ["Seller (Items)"], country: "Japan", flag: "🇯🇵", category: "equipment", email: "sales@aisin.co.jp", website: "aisin.com" },
  { name: "Hyundai Mobis", partnerTypes: ["vendor", "customer"], vSubs: ["Seller (Items)", "In-Store Vendor"], cSubs: ["Wholesale Buyer"], country: "South Korea", flag: "🇰🇷", category: "equipment", email: "contact@mobis.co.kr", website: "mobis.co.kr" },
  { name: "Valeo SA", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "Service Provider"], country: "France", flag: "🇫🇷", category: "technology", email: "info@valeo.com", website: "valeo.com" },
  { name: "Lear Corporation", partnerTypes: ["vendor"], vSubs: ["Seller (Items)"], country: "USA", flag: "🇺🇸", category: "raw_materials", email: "info@lear.com", website: "lear.com" },
  { name: "BorgWarner Inc.", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "Sub Contractor"], country: "USA", flag: "🇺🇸", category: "equipment", email: "sales@borgwarner.com", website: "borgwarner.com" },
  { name: "Aptiv PLC", partnerTypes: ["customer"], cSubs: ["B2B Client", "Distributor"], country: "Ireland", flag: "🇮🇪", category: "technology", email: "contact@aptiv.com", website: "aptiv.com" },
  { name: "Schaeffler Group", partnerTypes: ["vendor"], vSubs: ["Seller (Items)"], country: "Germany", flag: "🇩🇪", category: "equipment", email: "info@schaeffler.de", website: "schaeffler.com" },
  { name: "Panasonic Automotive", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "Online Vendor"], country: "Japan", flag: "🇯🇵", category: "technology", email: "auto@panasonic.co.jp", website: "panasonic.com" },
  { name: "Samsung SDI", partnerTypes: ["vendor"], vSubs: ["Seller (Items)"], country: "South Korea", flag: "🇰🇷", category: "technology", email: "sdi@samsung.com", website: "samsungsdi.com" },
  { name: "LG Energy Solution", partnerTypes: ["vendor", "customer"], vSubs: ["Seller (Items)", "Service Provider"], cSubs: ["B2B Client"], country: "South Korea", flag: "🇰🇷", category: "technology", email: "contact@lgenergy.com", website: "lgensol.com" },
  { name: "CATL (Contemporary Amperex)", partnerTypes: ["vendor"], vSubs: ["Seller (Items)"], country: "China", flag: "🇨🇳", category: "technology", email: "sales@catl.com", website: "catl.com" },
  { name: "Flex Ltd.", partnerTypes: ["vendor"], vSubs: ["Sub Contractor", "Service Provider"], country: "Singapore", flag: "🇸🇬", category: "services", email: "info@flex.com", website: "flex.com" },
  { name: "Dana Incorporated", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "Sub Contractor"], country: "USA", flag: "🇺🇸", category: "equipment", email: "info@dana.com", website: "dana.com" },
  { name: "Cummins Inc.", partnerTypes: ["vendor", "customer"], vSubs: ["Seller (Items)"], cSubs: ["Wholesale Buyer", "Distributor"], country: "USA", flag: "🇺🇸", category: "equipment", email: "info@cummins.com", website: "cummins.com" },
  { name: "Eaton Corporation", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "Service Provider"], country: "Ireland", flag: "🇮🇪", category: "equipment", email: "contact@eaton.com", website: "eaton.com" },
  { name: "Faurecia (Forvia)", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "Sub Contractor"], country: "France", flag: "🇫🇷", category: "raw_materials", email: "info@forvia.com", website: "forvia.com" },
  { name: "Hella GmbH", partnerTypes: ["vendor"], vSubs: ["Seller (Items)"], country: "Germany", flag: "🇩🇪", category: "equipment", email: "sales@hella.com", website: "hella.com" },
  { name: "Mahle GmbH", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "In-Store Vendor"], country: "Germany", flag: "🇩🇪", category: "equipment", email: "info@mahle.com", website: "mahle.com" },
  { name: "NXP Semiconductors", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "Online Vendor"], country: "Netherlands", flag: "🇳🇱", category: "technology", email: "sales@nxp.com", website: "nxp.com" },
  { name: "Infineon Technologies", partnerTypes: ["vendor"], vSubs: ["Seller (Items)"], country: "Germany", flag: "🇩🇪", category: "technology", email: "info@infineon.com", website: "infineon.com" },
  { name: "Autoliv Inc.", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "Service Provider"], country: "Sweden", flag: "🇸🇪", category: "equipment", email: "info@autoliv.com", website: "autoliv.com" },
  { name: "Gestamp Automoción", partnerTypes: ["vendor"], vSubs: ["Sub Contractor"], country: "Spain", flag: "🇪🇸", category: "raw_materials", email: "info@gestamp.com", website: "gestamp.com" },
  { name: "Yanfeng International", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "In-Store Vendor"], country: "China", flag: "🇨🇳", category: "equipment", email: "sales@yanfeng.com", website: "yanfeng.com" },
  { name: "Mando Corporation", partnerTypes: ["vendor"], vSubs: ["Seller (Items)"], country: "South Korea", flag: "🇰🇷", category: "equipment", email: "info@mando.com", website: "mando.com" },
  { name: "Marelli Holdings", partnerTypes: ["vendor", "customer"], vSubs: ["Seller (Items)"], cSubs: ["End Consumer", "Reseller"], country: "Japan", flag: "🇯🇵", category: "equipment", email: "info@marelli.com", website: "marelli.com" },
  { name: "Plastic Omnium", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "Sub Contractor"], country: "France", flag: "🇫🇷", category: "raw_materials", email: "contact@plasticomnium.com", website: "plasticomnium.com" },
  { name: "Toyoda Gosei Co.", partnerTypes: ["vendor"], vSubs: ["Seller (Items)"], country: "Japan", flag: "🇯🇵", category: "raw_materials", email: "info@toyodagosei.co.jp", website: "toyodagosei.com" },
  { name: "Sumitomo Electric", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "Online Vendor"], country: "Japan", flag: "🇯🇵", category: "technology", email: "info@sei.co.jp", website: "sumitomoelectric.com" },
  { name: "Rheinmetall Automotive", partnerTypes: ["vendor"], vSubs: ["Seller (Items)"], country: "Germany", flag: "🇩🇪", category: "equipment", email: "auto@rheinmetall.com", website: "rheinmetall.com" },
  { name: "Brembo S.p.A.", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "Service Provider"], country: "Italy", flag: "🇮🇹", category: "equipment", email: "info@brembo.it", website: "brembo.com" },
  { name: "NGK Spark Plug Co.", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "In-Store Vendor"], country: "Japan", flag: "🇯🇵", category: "equipment", email: "sales@ngkntk.co.jp", website: "ngkntk.co.jp" },
  { name: "Wacker Chemie AG", partnerTypes: ["vendor"], vSubs: ["Seller (Items)"], country: "Germany", flag: "🇩🇪", category: "raw_materials", email: "info@wacker.com", website: "wacker.com" },
  { name: "Knorr-Bremse AG", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "Sub Contractor"], country: "Germany", flag: "🇩🇪", category: "equipment", email: "info@knorr-bremse.com", website: "knorr-bremse.com" },
  { name: "Gentex Corporation", partnerTypes: ["vendor"], vSubs: ["Seller (Items)"], country: "USA", flag: "🇺🇸", category: "technology", email: "info@gentex.com", website: "gentex.com" },
  { name: "Visteon Corporation", partnerTypes: ["customer"], cSubs: ["Retail Buyer", "B2B Client"], country: "USA", flag: "🇺🇸", category: "technology", email: "info@visteon.com", website: "visteon.com" },
  { name: "Tenneco Inc.", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "Service Provider"], country: "USA", flag: "🇺🇸", category: "equipment", email: "contact@tenneco.com", website: "tenneco.com" },
  { name: "Nexteer Automotive", partnerTypes: ["vendor"], vSubs: ["Seller (Items)"], country: "USA", flag: "🇺🇸", category: "equipment", email: "info@nexteer.com", website: "nexteer.com" },
  { name: "American Axle & Mfg.", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "Sub Contractor"], country: "USA", flag: "🇺🇸", category: "equipment", email: "info@aam.com", website: "aam.com" },
  { name: "Modine Manufacturing", partnerTypes: ["vendor", "customer"], vSubs: ["Seller (Items)"], cSubs: ["Wholesale Buyer"], country: "USA", flag: "🇺🇸", category: "equipment", email: "info@modine.com", website: "modine.com" },
  { name: "Tata AutoComp Systems", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "In-Store Vendor", "Sub Contractor"], country: "India", flag: "🇮🇳", category: "equipment", email: "info@tataautocomp.com", website: "tataautocomp.com" },
  { name: "Motherson Sumi Systems", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "Sub Contractor"], country: "India", flag: "🇮🇳", category: "raw_materials", email: "info@motherson.com", website: "motherson.com" },
  { name: "Bharat Forge Ltd.", partnerTypes: ["vendor"], vSubs: ["Sub Contractor"], country: "India", flag: "🇮🇳", category: "raw_materials", email: "forge@bharatforge.com", website: "bharatforge.com" },
  { name: "Grupo Antolin", partnerTypes: ["vendor"], vSubs: ["Seller (Items)"], country: "Spain", flag: "🇪🇸", category: "equipment", email: "info@grupoantolin.com", website: "grupoantolin.com" },
  { name: "CIE Automotive", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "Sub Contractor"], country: "Spain", flag: "🇪🇸", category: "equipment", email: "info@cieautomotive.com", website: "cieautomotive.com" },
  { name: "Webasto SE", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "Service Provider"], country: "Germany", flag: "🇩🇪", category: "equipment", email: "info@webasto.com", website: "webasto.com" },
  { name: "Nemak S.A.", partnerTypes: ["vendor"], vSubs: ["Sub Contractor"], country: "Mexico", flag: "🇲🇽", category: "raw_materials", email: "info@nemak.com", website: "nemak.com" },
  { name: "Martinrea International", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "Sub Contractor"], country: "Canada", flag: "🇨🇦", category: "raw_materials", email: "info@martinrea.com", website: "martinrea.com" },
  { name: "Linamar Corporation", partnerTypes: ["customer"], cSubs: ["B2B Client", "Distributor"], country: "Canada", flag: "🇨🇦", category: "equipment", email: "info@linamar.com", website: "linamar.com" },
  { name: "ABC Technologies", partnerTypes: ["vendor"], vSubs: ["Seller (Items)"], country: "Canada", flag: "🇨🇦", category: "technology", email: "info@abctech.com", website: "abctech.com" },
  { name: "Tower International", partnerTypes: ["vendor"], vSubs: ["Sub Contractor", "Service Provider"], country: "USA", flag: "🇺🇸", category: "raw_materials", email: "info@towerint.com", website: "towerint.com" },
  { name: "Shiloh Industries", partnerTypes: ["vendor"], vSubs: ["Sub Contractor"], country: "USA", flag: "🇺🇸", category: "raw_materials", email: "info@shiloh.com", website: "shiloh.com" },
  { name: "Minth Group", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "In-Store Vendor"], country: "China", flag: "🇨🇳", category: "equipment", email: "sales@minthgroup.com", website: "minthgroup.com" },
  { name: "CITIC Dicastal", partnerTypes: ["vendor"], vSubs: ["Seller (Items)"], country: "China", flag: "🇨🇳", category: "raw_materials", email: "info@dicastal.com", website: "dicastal.com" },
  { name: "Wanxiang Group", partnerTypes: ["vendor", "customer"], vSubs: ["Seller (Items)"], cSubs: ["Wholesale Buyer", "Reseller"], country: "China", flag: "🇨🇳", category: "equipment", email: "info@wanxiang.com", website: "wanxiang.com" },
  { name: "Weichai Power", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "Service Provider"], country: "China", flag: "🇨🇳", category: "equipment", email: "info@weichai.com", website: "weichai.com" },
  { name: "Dongfeng Motor Parts", partnerTypes: ["customer"], cSubs: ["Retail Buyer", "End Consumer"], country: "China", flag: "🇨🇳", category: "equipment", email: "parts@dongfeng.com", website: "dongfeng.com" },
  { name: "Aisan Industry Co.", partnerTypes: ["vendor"], vSubs: ["Seller (Items)"], country: "Japan", flag: "🇯🇵", category: "equipment", email: "info@aisan-ind.co.jp", website: "aisan-ind.co.jp" },
  { name: "Calsonic Kansei", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "Sub Contractor"], country: "Japan", flag: "🇯🇵", category: "equipment", email: "info@calsonickansei.co.jp", website: "calsonickansei.com" },
  { name: "Unipres Corporation", partnerTypes: ["vendor"], vSubs: ["Sub Contractor"], country: "Japan", flag: "🇯🇵", category: "raw_materials", email: "info@unipres.co.jp", website: "unipres.co.jp" },
  { name: "Remy International", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "Online Vendor"], country: "USA", flag: "🇺🇸", category: "equipment", email: "info@remyinc.com", website: "remyinc.com" },
  { name: "Standard Motor Products", partnerTypes: ["vendor", "customer"], vSubs: ["Seller (Items)", "In-Store Vendor"], cSubs: ["Retail Buyer", "Distributor"], country: "USA", flag: "🇺🇸", category: "equipment", email: "info@smpcorp.com", website: "smpcorp.com" },
  { name: "Dorman Products", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "Online Vendor", "In-Store Vendor"], country: "USA", flag: "🇺🇸", category: "equipment", email: "info@dormanproducts.com", website: "dormanproducts.com" },
  { name: "Gentherm Inc.", partnerTypes: ["vendor"], vSubs: ["Seller (Items)"], country: "USA", flag: "🇺🇸", category: "technology", email: "info@gentherm.com", website: "gentherm.com" },
  { name: "Pirelli & C. S.p.A.", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "Service Provider"], country: "Italy", flag: "🇮🇹", category: "raw_materials", email: "info@pirelli.com", website: "pirelli.com" },
  { name: "Bridgestone Corporation", partnerTypes: ["vendor", "customer"], vSubs: ["Seller (Items)"], cSubs: ["Wholesale Buyer", "B2B Client"], country: "Japan", flag: "🇯🇵", category: "raw_materials", email: "info@bridgestone.co.jp", website: "bridgestone.com" },
  { name: "Michelin Group", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "Online Vendor"], country: "France", flag: "🇫🇷", category: "raw_materials", email: "contact@michelin.com", website: "michelin.com" },
  { name: "Yokohama Rubber Co.", partnerTypes: ["vendor"], vSubs: ["Seller (Items)"], country: "Japan", flag: "🇯🇵", category: "raw_materials", email: "info@yokohama.co.jp", website: "y-yokohama.com" },
  { name: "Hankook Tire", partnerTypes: ["customer"], cSubs: ["End Consumer", "Reseller"], country: "South Korea", flag: "🇰🇷", category: "raw_materials", email: "info@hankook.com", website: "hankooktire.com" },
  { name: "Toyo Tire Corporation", partnerTypes: ["vendor"], vSubs: ["Seller (Items)"], country: "Japan", flag: "🇯🇵", category: "raw_materials", email: "info@toyotire.co.jp", website: "toyotires.com" },
  { name: "Cooper Tire & Rubber", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "In-Store Vendor"], country: "USA", flag: "🇺🇸", category: "raw_materials", email: "info@coopertire.com", website: "coopertire.com" },
  { name: "SKF Group", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "Service Provider"], country: "Sweden", flag: "🇸🇪", category: "equipment", email: "info@skf.com", website: "skf.com" },
  { name: "Timken Company", partnerTypes: ["vendor"], vSubs: ["Seller (Items)"], country: "USA", flag: "🇺🇸", category: "equipment", email: "info@timken.com", website: "timken.com" },
  { name: "NSK Ltd.", partnerTypes: ["vendor"], vSubs: ["Seller (Items)", "Online Vendor"], country: "Japan", flag: "🇯🇵", category: "equipment", email: "info@nsk.com", website: "nsk.com" },
  { name: "NTN Corporation", partnerTypes: ["vendor"], vSubs: ["Seller (Items)"], country: "Japan", flag: "🇯🇵", category: "equipment", email: "info@ntn.co.jp", website: "ntn.co.jp" },
  { name: "Federal-Mogul (Tenneco)", partnerTypes: ["vendor", "customer"], vSubs: ["Seller (Items)", "Sub Contractor"], cSubs: ["B2B Client", "Wholesale Buyer"], country: "USA", flag: "🇺🇸", category: "equipment", email: "info@federalmogul.com", website: "federalmogul.com" },
  { name: "ElringKlinger AG", partnerTypes: ["vendor"], vSubs: ["Seller (Items)"], country: "Germany", flag: "🇩🇪", category: "equipment", email: "info@elringklinger.de", website: "elringklinger.com" },
];

const FIRST_NAMES = ["James", "Emma", "Liam", "Olivia", "Noah", "Ava", "William", "Sophia", "Mason", "Isabella", "Ethan", "Mia", "Alexander", "Charlotte", "Henry", "Amelia", "Sebastian", "Harper", "Daniel", "Evelyn", "Matthew", "Abigail", "Joseph", "Emily", "David", "Elizabeth", "Owen", "Sofia", "Luke", "Ella", "Ryan", "Grace", "Nathan", "Chloe", "Carter", "Victoria", "Leo", "Riley", "Jack", "Aria"];
const LAST_NAMES = ["Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson", "Garcia", "Martinez", "Robinson", "Clark", "Rodriguez", "Lewis", "Lee", "Walker", "Hall", "Allen", "Young", "King", "Wright", "Lopez", "Hill", "Scott", "Green", "Adams", "Baker", "Gonzalez", "Nelson", "Carter", "Mitchell", "Perez", "Roberts", "Turner", "Phillips", "Campbell", "Parker", "Evans", "Edwards", "Collins", "Stewart"];
const BG_COLORS = ["#0ea5e9", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#6366f1", "#ec4899", "#14b8a6", "#f97316", "#84cc16", "#a855f7", "#0891b2", "#e11d48", "#4f46e5", "#059669", "#d97706"];
const SERVICES_LIST = ["Laser cutting", "CNC machining", "Welding", "Stamping", "Injection molding", "Die casting", "Forging", "Assembly", "Painting", "Heat treatment", "Surface finishing", "Quality inspection"];
const PARTNER_GROUPS = ["PG-1-1", "PG-1-2", "PG-2-1", "PG-2-2", "PG-3-1"];
const DESIGNATIONS = ["Account Manager", "Sales Director", "Operations Head", "Procurement Lead", "Supply Chain Manager", "VP Sales", "Regional Manager", "Sales Engineer", "Business Development", "Logistics Coordinator", "Customer Relations", "Technical Director"];
const PAYMENT_TERMS_LIST: PaymentTerms[] = ["net_15", "net_30", "net_45", "net_60", "net_90", "due_on_receipt"];
const CREATORS = [
  { initials: "AA", name: "Ahtisham Ahmad", bgColor: "#6366f1" },
  { initials: "FK", name: "Faizan Khan", bgColor: "#10b981" },
  { initials: "AT", name: "Areeb Tanveer", bgColor: "#0ea5e9" },
  { initials: "ER", name: "Eli Rosenbloom", bgColor: "#8b5cf6" },
  { initials: "NA", name: "Nophil Anwer", bgColor: "#f59e0b" },
  { initials: "IA", name: "Irtaza Abid", bgColor: "#ef4444" },
];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateAdditionalVendors(): Vendor[] {
  const rand = seededRandom(42);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  const pickN = <T,>(arr: T[], min: number, max: number): T[] => {
    const n = min + Math.floor(rand() * (max - min + 1));
    const shuffled = [...arr].sort(() => rand() - 0.5);
    return shuffled.slice(0, Math.min(n, arr.length));
  };

  return COMPANY_DATA.map((co, i) => {
    const idx = 20 + i;
    const id = `v-${String(idx).padStart(3, "0")}`;
    const code = `${100200 + Math.floor(rand() * 900)}-${10 + Math.floor(rand() * 90)}`;

    const contactCount = 1 + Math.floor(rand() * 5);
    const contacts: ContactPerson[] = [];
    for (let c = 0; c < contactCount; c++) {
      const fn = pick(FIRST_NAMES);
      const ln = pick(LAST_NAMES);
      contacts.push({ initials: `${fn[0]}${ln[0]}`, name: `${fn} ${ln}`, bgColor: pick(BG_COLORS) });
    }

    const itemCount = 2 + Math.floor(rand() * 12);
    const items: string[] = [];
    for (let it = 0; it < itemCount; it++) items.push(`${code}-${String(it + 1).padStart(2, "0")}`);

    const locCount = 1 + Math.floor(rand() * 6);
    const locs: string[] = [];
    for (let l = 0; l < locCount; l++) locs.push(l === 0 ? `${co.name} HQ` : `${co.name} Site ${l}`);

    const creditLimit = [5000, 10000, 15000, 20000, 25000, 50000][Math.floor(rand() * 6)];
    const creditUtil = Math.floor(rand() * creditLimit);
    const statuses: VendorStatus[] = ["active", "active", "active", "active", "active", "active", "active", "inactive", "archived"];

    const vendorTypeLabels: string[] = [];
    if (co.vSubs) {
      co.vSubs.forEach((s) => {
        if (s === "Seller (Items)") vendorTypeLabels.push("Seller");
        else if (s === "In-Store Vendor") vendorTypeLabels.push("In-store Vendor");
        else vendorTypeLabels.push(s);
      });
    }

    const startDate = new Date(2024, Math.floor(rand() * 12), 1 + Math.floor(rand() * 28));
    const updateDate = new Date(2025, Math.floor(rand() * 12), 1 + Math.floor(rand() * 28));

    const v: Vendor = {
      id,
      code,
      companyName: co.name,
      displayName: co.name,
      partnerTypes: co.partnerTypes,
      vendorType: vendorTypeLabels.join(", "),
      vendorSubTypes: co.vSubs,
      customerSubTypes: co.cSubs,
      itemCodes: items,
      partnerLocations: locs,
      globalPointOfContacts: contacts,
      partnerGroup: pick(PARTNER_GROUPS),
      netProfitMargin: Math.round(rand() * 1000 * 100) / 100,
      creditUtilization: creditUtil,
      services: pick(SERVICES_LIST),
      defaultCarrierVendor: pick(CARRIERS),
      defaultCarrierCustomer: pick(CARRIERS),
      country: co.country,
      countryFlag: co.flag,
      emailAddress: co.email,
      createdByContact: pick(CREATORS),
      category: co.category,
      status: pick(statuses),
      primaryContact: {
        name: contacts[0].name,
        email: co.email,
        phone: `+1 (555) ${String(100 + Math.floor(rand() * 900))}-${String(1000 + Math.floor(rand() * 9000))}`,
        designation: pick(DESIGNATIONS),
      },
      billingAddress: {
        street: `${100 + Math.floor(rand() * 9900)} Industrial Blvd`,
        city: pick(["Detroit", "Munich", "Tokyo", "Seoul", "Shanghai", "Paris", "Milan", "Toronto", "Bangalore", "Stuttgart"]),
        state: pick(["MI", "CA", "TX", "NY", "IL", "OH", "PA", "GA", "NC", "WA"]),
        zipCode: String(10000 + Math.floor(rand() * 90000)),
        country: co.country,
      },
      taxId: `${co.flag.codePointAt(0)?.toString(16).slice(0, 2).toUpperCase() ?? "XX"}-${String(1000000 + Math.floor(rand() * 9000000))}`,
      paymentTerms: pick(PAYMENT_TERMS_LIST),
      creditLimit,
      outstandingBalance: creditUtil,
      totalOrders: Math.floor(rand() * 300) + 10,
      totalSpent: Math.floor(rand() * 5000000) + 100000,
      rating: Math.round((3.5 + rand() * 1.5) * 10) / 10,
      website: co.website,
      notes: `${co.name} partner. Key automotive industry supplier.`,
      createdAt: startDate.toISOString(),
      updatedAt: updateDate.toISOString(),
    };
    return v;
  });
}

const _additionalVendors = generateAdditionalVendors();
export const mockVendors: Vendor[] = [..._manualVendors, ..._additionalVendors];

let vendorIdCounter = 120;

export function generateVendorCode(): string {
  const code = `VND-${String(vendorIdCounter).padStart(3, "0")}`;
  return code;
}

export function generateVendorId(): string {
  const id = `v-${String(vendorIdCounter).padStart(3, "0")}`;
  vendorIdCounter++;
  return id;
}
