// ─── Currency Library — Seed Data & Types ───

export interface OpenTransaction {
  ref: string;
  vendor: string;
  amount: string;
  status: string;
  date: string;
}

export interface AuditLogEntry {
  dateTime: string;
  action: "Activated" | "Deactivated" | "System";
  changedBy: string;
  reason: string;
}

export interface PaymentTransaction {
  ref: string;
  party: string;
  amount: string;
  type: "Vendor Payment" | "Customer Payment";
  date: string;
}

export interface UsageSummary {
  openInvoices: OpenTransaction[];
  openCustomerInvoices: OpenTransaction[];
  openPurchaseOrders: OpenTransaction[];
  openSalesOrders: OpenTransaction[];
  openPayments: PaymentTransaction[];
  bankAccounts: number;
  unsettledPayments: number;
  exchangeRateEntries: number;
  totalLifetimeDocuments: number;
}

export interface Currency {
  code: string;
  name: string;
  numericCode: string;
  symbol: string;
  decimalPlaces: number;
  country: string;
  additionalCountries?: string[];
  status: "active" | "inactive";
  isBaseCurrency: boolean;
  usage: UsageSummary;
  auditLog: AuditLogEntry[];
}

/** Helper to count all open documents for a currency */
export function countOpenDocuments(c: Currency): number {
  return (
    c.usage.openInvoices.length +
    c.usage.openCustomerInvoices.length +
    c.usage.openPurchaseOrders.length +
    c.usage.openSalesOrders.length
  );
}

/** Check if a currency has any open documents */
export function hasOpenDocuments(c: Currency): boolean {
  return countOpenDocuments(c) > 0;
}

/* ─── Region mapping ─── */
export const REGION_LIST = [
  "Middle East",
  "South Asia",
  "Southeast Asia",
  "East Asia",
  "Europe",
  "North America",
  "South America",
  "Central America & Caribbean",
  "Sub-Saharan Africa",
  "North Africa",
  "Central Asia",
  "Oceania",
] as const;

export type Region = (typeof REGION_LIST)[number];

const COUNTRY_TO_REGION: Record<string, Region> = {
  "United Arab Emirates": "Middle East",
  "Afghanistan": "South Asia",
  "Albania": "Europe",
  "Armenia": "Central Asia",
  "Angola": "Sub-Saharan Africa",
  "Argentina": "South America",
  "Australia": "Oceania",
  "Aruba": "Central America & Caribbean",
  "Azerbaijan": "Central Asia",
  "Bosnia and Herzegovina": "Europe",
  "Barbados": "Central America & Caribbean",
  "Bangladesh": "South Asia",
  "Bulgaria": "Europe",
  "Bahrain": "Middle East",
  "Burundi": "Sub-Saharan Africa",
  "Bermuda": "North America",
  "Brunei": "Southeast Asia",
  "Bolivia": "South America",
  "Brazil": "South America",
  "Bahamas": "Central America & Caribbean",
  "Bhutan": "South Asia",
  "Botswana": "Sub-Saharan Africa",
  "Belarus": "Europe",
  "Belize": "Central America & Caribbean",
  "Canada": "North America",
  "Democratic Republic of the Congo": "Sub-Saharan Africa",
  "Switzerland": "Europe",
  "Chile": "South America",
  "China": "East Asia",
  "Colombia": "South America",
  "Costa Rica": "Central America & Caribbean",
  "Cuba": "Central America & Caribbean",
  "Cape Verde": "Sub-Saharan Africa",
  "Czech Republic": "Europe",
  "Djibouti": "Sub-Saharan Africa",
  "Denmark": "Europe",
  "Dominican Republic": "Central America & Caribbean",
  "Algeria": "North Africa",
  "Egypt": "North Africa",
  "Eritrea": "Sub-Saharan Africa",
  "Ethiopia": "Sub-Saharan Africa",
  "European Union": "Europe",
  "Eurozone": "Europe",
  "Fiji": "Oceania",
  "Falkland Islands": "South America",
  "United Kingdom": "Europe",
  "Georgia": "Central Asia",
  "Ghana": "Sub-Saharan Africa",
  "Gibraltar": "Europe",
  "Gambia": "Sub-Saharan Africa",
  "Guinea": "Sub-Saharan Africa",
  "Guatemala": "Central America & Caribbean",
  "Guyana": "South America",
  "Hong Kong": "East Asia",
  "Honduras": "Central America & Caribbean",
  "Haiti": "Central America & Caribbean",
  "Hungary": "Europe",
  "Indonesia": "Southeast Asia",
  "Israel": "Middle East",
  "India": "South Asia",
  "Iraq": "Middle East",
  "Iran": "Middle East",
  "Iceland": "Europe",
  "Jamaica": "Central America & Caribbean",
  "Jordan": "Middle East",
  "Japan": "East Asia",
  "Kenya": "Sub-Saharan Africa",
  "Kyrgyzstan": "Central Asia",
  "Cambodia": "Southeast Asia",
  "Comoros": "Sub-Saharan Africa",
  "North Korea": "East Asia",
  "South Korea": "East Asia",
  "Kuwait": "Middle East",
  "Cayman Islands": "Central America & Caribbean",
  "Kazakhstan": "Central Asia",
  "Laos": "Southeast Asia",
  "Lebanon": "Middle East",
  "Sri Lanka": "South Asia",
  "Liberia": "Sub-Saharan Africa",
  "Lesotho": "Sub-Saharan Africa",
  "Libya": "North Africa",
  "Morocco": "North Africa",
  "Moldova": "Europe",
  "Madagascar": "Sub-Saharan Africa",
  "North Macedonia": "Europe",
  "Myanmar": "Southeast Asia",
  "Mongolia": "East Asia",
  "Macau": "East Asia",
  "Mauritania": "Sub-Saharan Africa",
  "Mauritius": "Sub-Saharan Africa",
  "Maldives": "South Asia",
  "Malawi": "Sub-Saharan Africa",
  "Mexico": "North America",
  "Malaysia": "Southeast Asia",
  "Mozambique": "Sub-Saharan Africa",
  "Namibia": "Sub-Saharan Africa",
  "Nigeria": "Sub-Saharan Africa",
  "Nicaragua": "Central America & Caribbean",
  "Norway": "Europe",
  "Nepal": "South Asia",
  "New Zealand": "Oceania",
  "Oman": "Middle East",
  "Panama": "Central America & Caribbean",
  "Peru": "South America",
  "Papua New Guinea": "Oceania",
  "Philippines": "Southeast Asia",
  "Pakistan": "South Asia",
  "Poland": "Europe",
  "Paraguay": "South America",
  "Qatar": "Middle East",
  "Romania": "Europe",
  "Serbia": "Europe",
  "Russia": "Europe",
  "Rwanda": "Sub-Saharan Africa",
  "Saudi Arabia": "Middle East",
  "Solomon Islands": "Oceania",
  "Seychelles": "Sub-Saharan Africa",
  "Sudan": "North Africa",
  "Sweden": "Europe",
  "Singapore": "Southeast Asia",
  "Saint Helena": "Sub-Saharan Africa",
  "Sierra Leone": "Sub-Saharan Africa",
  "Somalia": "Sub-Saharan Africa",
  "Suriname": "South America",
  "South Sudan": "Sub-Saharan Africa",
  "São Tomé and Príncipe": "Sub-Saharan Africa",
  "El Salvador": "Central America & Caribbean",
  "Syria": "Middle East",
  "Eswatini": "Sub-Saharan Africa",
  "Thailand": "Southeast Asia",
  "Tajikistan": "Central Asia",
  "Turkmenistan": "Central Asia",
  "Tunisia": "North Africa",
  "Tonga": "Oceania",
  "Turkey": "Europe",
  "Trinidad and Tobago": "Central America & Caribbean",
  "Taiwan": "East Asia",
  "Tanzania": "Sub-Saharan Africa",
  "Ukraine": "Europe",
  "Uganda": "Sub-Saharan Africa",
  "United States": "North America",
  "Uruguay": "South America",
  "Uzbekistan": "Central Asia",
  "Venezuela": "South America",
  "Vietnam": "Southeast Asia",
  "Vanuatu": "Oceania",
  "Samoa": "Oceania",
  "Cameroon": "Sub-Saharan Africa",
  "Anguilla": "Central America & Caribbean",
  "Curaçao": "Central America & Caribbean",
  "Benin": "Sub-Saharan Africa",
  "French Polynesia": "Oceania",
  "Yemen": "Middle East",
  "South Africa": "Sub-Saharan Africa",
  "Zambia": "Sub-Saharan Africa",
  "Zimbabwe": "Sub-Saharan Africa",
  "Christmas Island": "Oceania",
  "Cocos (Keeling) Islands": "Oceania",
  "Heard Island and McDonald Islands": "Oceania",
  "Kiribati": "Oceania",
  "Nauru": "Oceania",
  "Norfolk Island": "Oceania",
  "Tuvalu": "Oceania",
  "Liechtenstein": "Europe",
  "Faroe Islands": "Europe",
  "Greenland": "Europe",
  "Andorra": "Europe",
  "Kosovo": "Europe",
  "Monaco": "Europe",
  "Montenegro": "Europe",
  "San Marino": "Europe",
  "Vatican City": "Europe",
  "Austria": "Europe",
  "Belgium": "Europe",
  "Croatia": "Europe",
  "Cyprus": "Europe",
  "Estonia": "Europe",
  "Finland": "Europe",
  "France": "Europe",
  "Germany": "Europe",
  "Greece": "Europe",
  "Ireland": "Europe",
  "Italy": "Europe",
  "Latvia": "Europe",
  "Lithuania": "Europe",
  "Luxembourg": "Europe",
  "Malta": "Europe",
  "Netherlands": "Europe",
  "Portugal": "Europe",
  "Slovakia": "Europe",
  "Slovenia": "Europe",
  "Spain": "Europe",
  "Isle of Man": "Europe",
  "Jersey": "Europe",
  "Guernsey": "Europe",
  "Tristan da Cunha": "Sub-Saharan Africa",
  "Western Sahara": "North Africa",
  "Svalbard and Jan Mayen": "Europe",
  "Bouvet Island": "Europe",
  "Cook Islands": "Oceania",
  "Niue": "Oceania",
  "Pitcairn Islands": "Oceania",
  "Tokelau": "Oceania",
  "Ascension Island": "Sub-Saharan Africa",
  "American Samoa": "Oceania",
  "British Indian Ocean Territory": "South Asia",
  "British Virgin Islands": "Central America & Caribbean",
  "Bonaire Sint Eustatius and Saba": "Central America & Caribbean",
  "Ecuador": "South America",
  "Guam": "Oceania",
  "Marshall Islands": "Oceania",
  "Federated States of Micronesia": "Oceania",
  "Northern Mariana Islands": "Oceania",
  "Palau": "Oceania",
  "Puerto Rico": "Central America & Caribbean",
  "Timor-Leste": "Southeast Asia",
  "Turks and Caicos Islands": "Central America & Caribbean",
  "US Virgin Islands": "Central America & Caribbean",
  "United States Minor Outlying Islands": "Oceania",
  "Central African Republic": "Sub-Saharan Africa",
  "Republic of the Congo": "Sub-Saharan Africa",
  "Chad": "Sub-Saharan Africa",
  "Equatorial Guinea": "Sub-Saharan Africa",
  "Gabon": "Sub-Saharan Africa",
  "Antigua and Barbuda": "Central America & Caribbean",
  "Dominica": "Central America & Caribbean",
  "Grenada": "Central America & Caribbean",
  "Montserrat": "Central America & Caribbean",
  "Saint Kitts and Nevis": "Central America & Caribbean",
  "Saint Lucia": "Central America & Caribbean",
  "Saint Vincent and the Grenadines": "Central America & Caribbean",
  "Sint Maarten": "Central America & Caribbean",
  "Burkina Faso": "Sub-Saharan Africa",
  "Ivory Coast": "Sub-Saharan Africa",
  "Guinea-Bissau": "Sub-Saharan Africa",
  "Mali": "Sub-Saharan Africa",
  "Niger": "Sub-Saharan Africa",
  "Senegal": "Sub-Saharan Africa",
  "Togo": "Sub-Saharan Africa",
  "New Caledonia": "Oceania",
  "Wallis and Futuna": "Oceania",
};

export function getRegionForCountry(country: string): Region | undefined {
  return COUNTRY_TO_REGION[country];
}

const emptyUsage = (): UsageSummary => ({
  openInvoices: [],
  openCustomerInvoices: [],
  openPurchaseOrders: [],
  openSalesOrders: [],
  openPayments: [],
  bankAccounts: 0,
  unsettledPayments: 0,
  exchangeRateEntries: 0,
  totalLifetimeDocuments: 0,
});

/** Helper to create a currency entry with sensible defaults */
function cur(
  code: string,
  name: string,
  numericCode: string,
  symbol: string,
  decimalPlaces: number,
  country: string,
  additionalCountries?: string[],
  overrides?: Omit<Partial<Currency>, 'usage'> & { usage?: Partial<UsageSummary> }
): Currency {
  const base: Currency = {
    code,
    name,
    numericCode,
    symbol,
    decimalPlaces,
    country,
    additionalCountries: additionalCountries && additionalCountries.length > 0 ? additionalCountries : undefined,
    status: "active",
    isBaseCurrency: false,
    usage: { ...emptyUsage(), ...(overrides?.usage ?? {}) } as UsageSummary,
    auditLog: [
      { dateTime: "2025-01-15T09:00:00Z", action: "Activated", changedBy: "System", reason: "System initialization" },
    ],
  };
  if (overrides) {
    if (overrides.status) base.status = overrides.status;
    if (overrides.isBaseCurrency) base.isBaseCurrency = overrides.isBaseCurrency;
    if (overrides.auditLog) base.auditLog = overrides.auditLog;
  }
  return base;
}

export const SEED_CURRENCIES: Currency[] = [
  cur("AED", "United Arab Emirates Dirham", "784", "د.إ", 2, "United Arab Emirates", [], {
    usage: {
      openInvoices: [
        { ref: "INV-2025-0710", vendor: "Dubai Steel Industries", amount: "د.إ85,000.00", status: "Open", date: "2025-11-18" },
      ],
      openCustomerInvoices: [
        { ref: "AR-2025-0130", vendor: "Abu Dhabi Exports LLC", amount: "د.إ42,500.00", status: "Open", date: "2025-12-01" },
      ],
      openPurchaseOrders: [
        { ref: "PO-2025-0420", vendor: "Sharjah Building Materials", amount: "د.إ67,200.00", status: "Pending", date: "2025-11-25" },
      ],
      openSalesOrders: [],
      bankAccounts: 2, unsettledPayments: 1, exchangeRateEntries: 3, totalLifetimeDocuments: 48,
    },
  }),
  cur("AFN", "Afghan Afghani", "971", "؋", 2, "Afghanistan", []),
  cur("ALL", "Albanian Lek", "008", "L", 2, "Albania", []),
  cur("AMD", "Armenian Dram", "051", "֏", 2, "Armenia", []),
  cur("AOA", "Angolan Kwanza", "973", "Kz", 2, "Angola", []),
  cur("ARS", "Argentine Peso", "032", "$", 2, "Argentina", []),
  cur("AUD", "Australian Dollar", "036", "A$", 2, "Australia", ["Christmas Island", "Cocos (Keeling) Islands", "Heard Island and McDonald Islands", "Kiribati", "Nauru", "Norfolk Island", "Tuvalu"], {
    usage: {
      openInvoices: [
        { ref: "INV-2025-0622", vendor: "Sydney Mining Corp.", amount: "A$32,400.00", status: "Open", date: "2025-10-30" },
      ],
      openCustomerInvoices: [
        { ref: "AR-2025-0078", vendor: "Melbourne Retail Group", amount: "A$18,750.00", status: "Overdue", date: "2025-09-20" },
      ],
      openPurchaseOrders: [],
      openSalesOrders: [
        { ref: "SO-2025-0055", vendor: "Brisbane Logistics Pty.", amount: "A$24,000.00", status: "Open", date: "2025-11-28" },
      ],
      bankAccounts: 1, unsettledPayments: 1, exchangeRateEntries: 2, totalLifetimeDocuments: 35,
    },
  }),
  cur("AWG", "Aruban Florin", "533", "ƒ", 2, "Aruba", []),
  cur("AZN", "Azerbaijani Manat", "944", "₼", 2, "Azerbaijan", []),
  cur("BAM", "Bosnia and Herzegovina Convertible Mark", "977", "KM", 2, "Bosnia and Herzegovina", []),
  cur("BBD", "Barbados Dollar", "052", "$", 2, "Barbados", []),
  cur("BDT", "Bangladeshi Taka", "050", "৳", 2, "Bangladesh", []),
  cur("BGN", "Bulgarian Lev", "975", "лв", 2, "Bulgaria", []),
  cur("BHD", "Bahraini Dinar", "048", "BD", 3, "Bahrain", [], {
    usage: { ...emptyUsage(), exchangeRateEntries: 1, totalLifetimeDocuments: 5 },
  }),
  cur("BIF", "Burundian Franc", "108", "Fr", 0, "Burundi", []),
  cur("BMD", "Bermudian Dollar", "060", "$", 2, "Bermuda", []),
  cur("BND", "Brunei Dollar", "096", "$", 2, "Brunei", []),
  cur("BOB", "Boliviano", "068", "Bs", 2, "Bolivia", []),
  cur("BRL", "Brazilian Real", "986", "R$", 2, "Brazil", [], {
    usage: { ...emptyUsage(), totalLifetimeDocuments: 12 },
  }),
  cur("BSD", "Bahamian Dollar", "044", "$", 2, "Bahamas", []),
  cur("BTN", "Bhutanese Ngultrum", "064", "Nu", 2, "Bhutan", []),
  cur("BWP", "Botswana Pula", "072", "P", 2, "Botswana", []),
  cur("BYN", "Belarusian Ruble", "933", "Br", 2, "Belarus", []),
  cur("BZD", "Belize Dollar", "084", "$", 2, "Belize", []),
  cur("CAD", "Canadian Dollar", "124", "C$", 2, "Canada", [], {
    usage: {
      openInvoices: [
        { ref: "INV-2025-0455", vendor: "Toronto Manufacturing Inc.", amount: "C$28,600.00", status: "Open", date: "2025-11-12" },
        { ref: "INV-2025-0478", vendor: "Vancouver Imports Ltd.", amount: "C$15,300.00", status: "Pending", date: "2025-12-03" },
      ],
      openCustomerInvoices: [],
      openPurchaseOrders: [
        { ref: "PO-2025-0340", vendor: "Montreal Supplies Co.", amount: "C$9,800.00", status: "Open", date: "2025-11-20" },
      ],
      openSalesOrders: [],
      bankAccounts: 1, unsettledPayments: 0, exchangeRateEntries: 4, totalLifetimeDocuments: 42,
    },
  }),
  cur("CDF", "Congolese Franc", "976", "Fr", 2, "Democratic Republic of the Congo", []),
  cur("CHF", "Swiss Franc", "756", "CHF", 2, "Switzerland", ["Liechtenstein"], {
    usage: {
      openInvoices: [
        { ref: "INV-2025-0350", vendor: "Zurich Precision AG", amount: "CHF 52,800.00", status: "Open", date: "2025-11-14" },
      ],
      openCustomerInvoices: [
        { ref: "AR-2025-0060", vendor: "Geneva Watches SA", amount: "CHF 34,500.00", status: "Open", date: "2025-11-30" },
      ],
      openPurchaseOrders: [],
      openSalesOrders: [],
      bankAccounts: 1, unsettledPayments: 0, exchangeRateEntries: 2, totalLifetimeDocuments: 28,
    },
  }),
  cur("CLP", "Chilean Peso", "152", "$", 0, "Chile", []),
  cur("CNY", "Renminbi", "156", "¥", 2, "China", [], {
    usage: {
      openInvoices: [
        { ref: "INV-2025-0412", vendor: "Shenzhen Electronics Co.", amount: "¥245,000.00", status: "Open", date: "2025-11-15" },
        { ref: "INV-2025-0489", vendor: "Beijing Industrial Ltd.", amount: "¥128,500.00", status: "Pending", date: "2025-12-02" },
      ],
      openCustomerInvoices: [
        { ref: "AR-2025-0088", vendor: "Shanghai Exports Inc.", amount: "¥312,000.00", status: "Open", date: "2025-11-20" },
      ],
      openPurchaseOrders: [
        { ref: "PO-2025-0178", vendor: "Guangzhou Materials", amount: "¥89,200.00", status: "Open", date: "2025-11-28" },
      ],
      openSalesOrders: [],
      bankAccounts: 2, unsettledPayments: 1, exchangeRateEntries: 5, totalLifetimeDocuments: 67,
    },
  }),
  cur("COP", "Colombian Peso", "170", "$", 2, "Colombia", []),
  cur("CRC", "Costa Rican Colón", "188", "₡", 2, "Costa Rica", []),
  cur("CUP", "Cuban Peso", "192", "$", 2, "Cuba", []),
  cur("CVE", "Cape Verdean Escudo", "132", "$", 2, "Cape Verde", []),
  cur("CZK", "Czech Koruna", "203", "Kč", 2, "Czech Republic", []),
  cur("DJF", "Djiboutian Franc", "262", "Fr", 0, "Djibouti", []),
  cur("DKK", "Danish Krone", "208", "kr", 2, "Denmark", ["Faroe Islands", "Greenland"]),
  cur("DOP", "Dominican Peso", "214", "$", 2, "Dominican Republic", []),
  cur("DZD", "Algerian Dinar", "012", "د.ج", 2, "Algeria", []),
  cur("EGP", "Egyptian Pound", "818", "£", 2, "Egypt", [], {
    usage: {
      openInvoices: [
        { ref: "INV-2025-0620", vendor: "Cairo Textiles Ltd.", amount: "£125,000.00", status: "Open", date: "2025-11-10" },
      ],
      openCustomerInvoices: [],
      openPurchaseOrders: [],
      openSalesOrders: [],
      bankAccounts: 1, unsettledPayments: 0, exchangeRateEntries: 2, totalLifetimeDocuments: 18,
    },
  }),
  cur("ERN", "Eritrean Nakfa", "232", "Nfk", 2, "Eritrea", []),
  cur("ETB", "Ethiopian Birr", "230", "Br", 2, "Ethiopia", []),
  cur("EUR", "Euro", "978", "€", 2, "Eurozone", ["Andorra", "Kosovo", "Monaco", "Montenegro", "San Marino", "Vatican City", "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Estonia", "Finland", "France", "Germany", "Greece", "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Netherlands", "Portugal", "Slovakia", "Slovenia", "Spain"], {
    usage: {
      openInvoices: [
        { ref: "INV-2025-0301", vendor: "Deutsche Maschinenbau GmbH", amount: "€42,750.00", status: "Open", date: "2025-10-22" },
      ],
      openCustomerInvoices: [
        { ref: "AR-2025-0045", vendor: "Paris Luxury Goods SA", amount: "€18,900.00", status: "Open", date: "2025-11-05" },
        { ref: "AR-2025-0067", vendor: "Milan Fashion House SRL", amount: "€27,300.00", status: "Overdue", date: "2025-09-15" },
      ],
      openPurchaseOrders: [],
      openSalesOrders: [
        { ref: "SO-2025-0112", vendor: "Amsterdam Trading BV", amount: "€55,000.00", status: "Open", date: "2025-12-01" },
      ],
      bankAccounts: 2, unsettledPayments: 0, exchangeRateEntries: 8, totalLifetimeDocuments: 95,
    },
  }),
  cur("FJD", "Fiji Dollar", "242", "$", 2, "Fiji", []),
  cur("FKP", "Falkland Islands Pound", "238", "£", 2, "Falkland Islands", []),
  cur("GBP", "Pound Sterling", "826", "£", 2, "United Kingdom", ["Isle of Man", "Jersey", "Guernsey", "Tristan da Cunha"], {
    usage: {
      ...emptyUsage(),
      openCustomerInvoices: [
        { ref: "AR-2025-0091", vendor: "London Consulting Ltd.", amount: "£14,200.00", status: "Open", date: "2025-11-28" },
      ],
      bankAccounts: 1, exchangeRateEntries: 6, totalLifetimeDocuments: 72,
    },
  }),
  cur("GEL", "Georgian Lari", "981", "₾", 2, "Georgia", []),
  cur("GHS", "Ghanaian Cedi", "936", "₵", 2, "Ghana", []),
  cur("GIP", "Gibraltar Pound", "292", "£", 2, "Gibraltar", []),
  cur("GMD", "Gambian Dalasi", "270", "D", 2, "Gambia", []),
  cur("GNF", "Guinean Franc", "324", "Fr", 0, "Guinea", []),
  cur("GTQ", "Guatemalan Quetzal", "320", "Q", 2, "Guatemala", []),
  cur("GYD", "Guyanese Dollar", "328", "$", 2, "Guyana", []),
  cur("HKD", "Hong Kong Dollar", "344", "HK$", 2, "Hong Kong", [], {
    usage: { ...emptyUsage(), totalLifetimeDocuments: 15 },
  }),
  cur("HNL", "Honduran Lempira", "340", "L", 2, "Honduras", []),
  cur("HTG", "Haitian Gourde", "332", "G", 2, "Haiti", []),
  cur("HUF", "Hungarian Forint", "348", "Ft", 2, "Hungary", []),
  cur("IDR", "Indonesian Rupiah", "360", "Rp", 2, "Indonesia", []),
  cur("ILS", "Israeli New Shekel", "376", "₪", 2, "Israel", []),
  cur("INR", "Indian Rupee", "356", "₹", 2, "India", ["Bhutan"], {
    usage: {
      openInvoices: [
        { ref: "INV-2025-0390", vendor: "Mumbai Textiles Pvt.", amount: "₹1,850,000.00", status: "Open", date: "2025-11-05" },
        { ref: "INV-2025-0412", vendor: "Delhi Pharmaceuticals Ltd.", amount: "₹720,000.00", status: "Pending", date: "2025-11-22" },
      ],
      openCustomerInvoices: [
        { ref: "AR-2025-0055", vendor: "Bangalore IT Services", amount: "₹2,100,000.00", status: "Open", date: "2025-10-28" },
      ],
      openPurchaseOrders: [
        { ref: "PO-2025-0280", vendor: "Chennai Auto Parts", amount: "₹450,000.00", status: "Open", date: "2025-12-01" },
      ],
      openSalesOrders: [
        { ref: "SO-2025-0033", vendor: "Hyderabad Electronics", amount: "₹980,000.00", status: "Open", date: "2025-11-15" },
      ],
      bankAccounts: 2, unsettledPayments: 1, exchangeRateEntries: 3, totalLifetimeDocuments: 88,
    },
  }),
  cur("IQD", "Iraqi Dinar", "368", "ع.د", 3, "Iraq", []),
  cur("IRR", "Iranian Rial", "364", "﷼", 2, "Iran", []),
  cur("ISK", "Icelandic Króna", "352", "kr", 0, "Iceland", []),
  cur("JMD", "Jamaican Dollar", "388", "$", 2, "Jamaica", []),
  cur("JOD", "Jordanian Dinar", "400", "د.ا", 3, "Jordan", []),
  cur("JPY", "Japanese Yen", "392", "¥", 0, "Japan", [], {
    usage: {
      openInvoices: [
        { ref: "INV-2025-0280", vendor: "Tokyo Electronics Ltd.", amount: "¥3,250,000", status: "Open", date: "2025-11-08" },
      ],
      openCustomerInvoices: [
        { ref: "AR-2025-0042", vendor: "Osaka Trading Co.", amount: "¥1,800,000", status: "Open", date: "2025-11-25" },
      ],
      openPurchaseOrders: [],
      openSalesOrders: [],
      bankAccounts: 1, unsettledPayments: 0, exchangeRateEntries: 4, totalLifetimeDocuments: 55,
    },
  }),
  cur("KES", "Kenyan Shilling", "404", "KSh", 2, "Kenya", []),
  cur("KGS", "Kyrgyzstani Som", "417", "с", 2, "Kyrgyzstan", []),
  cur("KHR", "Cambodian Riel", "116", "៛", 2, "Cambodia", []),
  cur("KMF", "Comoro Franc", "174", "Fr", 0, "Comoros", []),
  cur("KPW", "North Korean Won", "408", "₩", 2, "North Korea", []),
  cur("KRW", "South Korean Won", "410", "₩", 0, "South Korea", [], {
    usage: { ...emptyUsage(), exchangeRateEntries: 1, totalLifetimeDocuments: 8 },
  }),
  cur("KWD", "Kuwaiti Dinar", "414", "د.ك", 3, "Kuwait", [], {
    usage: { ...emptyUsage(), exchangeRateEntries: 1, totalLifetimeDocuments: 6 },
  }),
  cur("KYD", "Cayman Islands Dollar", "136", "$", 2, "Cayman Islands", []),
  cur("KZT", "Kazakhstani Tenge", "398", "₸", 2, "Kazakhstan", []),
  cur("LAK", "Lao Kip", "418", "₭", 2, "Laos", []),
  cur("LBP", "Lebanese Pound", "422", "ل.ل", 2, "Lebanon", []),
  cur("LKR", "Sri Lankan Rupee", "144", "₨", 2, "Sri Lanka", []),
  cur("LRD", "Liberian Dollar", "430", "$", 2, "Liberia", []),
  cur("LSL", "Lesotho Loti", "426", "L", 2, "Lesotho", []),
  cur("LYD", "Libyan Dinar", "434", "ل.د", 3, "Libya", []),
  cur("MAD", "Moroccan Dirham", "504", "د.م.", 2, "Morocco", ["Western Sahara"]),
  cur("MDL", "Moldovan Leu", "498", "L", 2, "Moldova", []),
  cur("MGA", "Malagasy Ariary", "969", "Ar", 2, "Madagascar", []),
  cur("MKD", "Macedonian Denar", "807", "ден", 2, "North Macedonia", []),
  cur("MMK", "Myanmar Kyat", "104", "K", 2, "Myanmar", []),
  cur("MNT", "Mongolian Tögrög", "496", "₮", 2, "Mongolia", []),
  cur("MOP", "Macanese Pataca", "446", "P", 2, "Macau", []),
  cur("MRU", "Mauritanian Ouguiya", "929", "UM", 2, "Mauritania", []),
  cur("MUR", "Mauritian Rupee", "480", "₨", 2, "Mauritius", []),
  cur("MVR", "Maldivian Rufiyaa", "462", "ރ", 2, "Maldives", []),
  cur("MWK", "Malawian Kwacha", "454", "MK", 2, "Malawi", []),
  cur("MXN", "Mexican Peso", "484", "$", 2, "Mexico", [], {
    usage: {
      openInvoices: [
        { ref: "INV-2025-0580", vendor: "Mexico City Imports SA", amount: "$320,000.00", status: "Open", date: "2025-11-15" },
      ],
      openCustomerInvoices: [],
      openPurchaseOrders: [],
      openSalesOrders: [],
      bankAccounts: 1, unsettledPayments: 0, exchangeRateEntries: 3, totalLifetimeDocuments: 22,
    },
  }),
  cur("MYR", "Malaysian Ringgit", "458", "RM", 2, "Malaysia", []),
  cur("MZN", "Mozambican Metical", "943", "MT", 2, "Mozambique", []),
  cur("NAD", "Namibian Dollar", "516", "$", 2, "Namibia", []),
  cur("NGN", "Nigerian Naira", "566", "₦", 2, "Nigeria", []),
  cur("NIO", "Nicaraguan Córdoba", "558", "C$", 2, "Nicaragua", []),
  cur("NOK", "Norwegian Krone", "578", "kr", 2, "Norway", ["Svalbard and Jan Mayen", "Bouvet Island"]),
  cur("NPR", "Nepalese Rupee", "524", "₨", 2, "Nepal", []),
  cur("NZD", "New Zealand Dollar", "554", "$", 2, "New Zealand", ["Cook Islands", "Niue", "Pitcairn Islands", "Tokelau"]),
  cur("OMR", "Omani Rial", "512", "ر.ع.", 3, "Oman", []),
  cur("PAB", "Panamanian Balboa", "590", "B/.", 2, "Panama", []),
  cur("PEN", "Peruvian Sol", "604", "S/.", 2, "Peru", []),
  cur("PGK", "Papua New Guinean Kina", "598", "K", 2, "Papua New Guinea", []),
  cur("PHP", "Philippine Peso", "608", "₱", 2, "Philippines", []),
  cur("PKR", "Pakistani Rupee", "586", "₨", 2, "Pakistan", [], {
    isBaseCurrency: true,
    usage: {
      openInvoices: [
        { ref: "INV-2025-0601", vendor: "Lahore Textiles Pvt.", amount: "₨1,250,000.00", status: "Open", date: "2025-11-10" },
      ],
      openCustomerInvoices: [],
      openPurchaseOrders: [],
      openSalesOrders: [
        { ref: "SO-2025-0044", vendor: "Karachi Trading Co.", amount: "₨890,000.00", status: "Open", date: "2025-12-03" },
      ],
      bankAccounts: 3, unsettledPayments: 0, exchangeRateEntries: 12, totalLifetimeDocuments: 120,
    },
    auditLog: [
      { dateTime: "2025-01-15T09:00:00Z", action: "System", changedBy: "System", reason: "Set as base currency during system initialization" },
      { dateTime: "2025-01-15T09:00:00Z", action: "Activated", changedBy: "System", reason: "System initialization" },
    ],
  }),
  cur("PLN", "Polish Złoty", "985", "zł", 2, "Poland", []),
  cur("PYG", "Paraguayan Guaraní", "600", "₲", 0, "Paraguay", []),
  cur("QAR", "Qatari Riyal", "634", "ر.ق", 2, "Qatar", [], {
    usage: { ...emptyUsage(), exchangeRateEntries: 1, totalLifetimeDocuments: 4 },
  }),
  cur("RON", "Romanian Leu", "946", "lei", 2, "Romania", []),
  cur("RSD", "Serbian Dinar", "941", "din", 2, "Serbia", []),
  cur("RUB", "Russian Ruble", "643", "₽", 2, "Russia", []),
  cur("RWF", "Rwandan Franc", "646", "Fr", 0, "Rwanda", []),
  cur("SAR", "Saudi Riyal", "682", "ر.س", 2, "Saudi Arabia", [], {
    usage: {
      ...emptyUsage(),
      openPurchaseOrders: [
        { ref: "PO-2025-0310", vendor: "Riyadh Steel Corp.", amount: "SR 45,000.00", status: "Open", date: "2025-11-22" },
      ],
      bankAccounts: 1, exchangeRateEntries: 3, totalLifetimeDocuments: 30,
    },
  }),
  cur("SBD", "Solomon Islands Dollar", "090", "$", 2, "Solomon Islands", []),
  cur("SCR", "Seychelles Rupee", "690", "₨", 2, "Seychelles", []),
  cur("SDG", "Sudanese Pound", "938", "£", 2, "Sudan", []),
  cur("SEK", "Swedish Krona", "752", "kr", 2, "Sweden", []),
  cur("SGD", "Singapore Dollar", "702", "$", 2, "Singapore", [], {
    usage: { ...emptyUsage(), exchangeRateEntries: 2, totalLifetimeDocuments: 14 },
  }),
  cur("SHP", "Saint Helena Pound", "654", "£", 2, "Saint Helena", ["Ascension Island"]),
  cur("SLE", "Sierra Leonean Leone", "925", "Le", 2, "Sierra Leone", []),
  cur("SOS", "Somalian Shilling", "706", "Sh", 2, "Somalia", []),
  cur("SRD", "Surinamese Dollar", "968", "$", 2, "Suriname", []),
  cur("SSP", "South Sudanese Pound", "728", "£", 2, "South Sudan", []),
  cur("STN", "São Tomé and Príncipe Dobra", "930", "Db", 2, "São Tomé and Príncipe", []),
  cur("SVC", "Salvadoran Colón", "222", "₡", 2, "El Salvador", []),
  cur("SYP", "Syrian Pound", "760", "£", 2, "Syria", []),
  cur("SZL", "Swazi Lilangeni", "748", "L", 2, "Eswatini", []),
  cur("THB", "Thai Baht", "764", "฿", 2, "Thailand", []),
  cur("TJS", "Tajikistani Somoni", "972", "SM", 2, "Tajikistan", []),
  cur("TMT", "Turkmenistan Manat", "934", "T", 2, "Turkmenistan", []),
  cur("TND", "Tunisian Dinar", "788", "د.ت", 3, "Tunisia", []),
  cur("TOP", "Tongan Paʻanga", "776", "T$", 2, "Tonga", []),
  cur("TRY", "Turkish Lira", "949", "₺", 2, "Turkey", [], {
    usage: { ...emptyUsage(), exchangeRateEntries: 1, totalLifetimeDocuments: 7 },
  }),
  cur("TTD", "Trinidad and Tobago Dollar", "780", "$", 2, "Trinidad and Tobago", []),
  cur("TWD", "New Taiwan Dollar", "901", "$", 2, "Taiwan", []),
  cur("TZS", "Tanzanian Shilling", "834", "Sh", 2, "Tanzania", []),
  cur("UAH", "Ukrainian Hryvnia", "980", "₴", 2, "Ukraine", []),
  cur("UGX", "Ugandan Shilling", "800", "Sh", 0, "Uganda", []),
  cur("USD", "United States Dollar", "840", "$", 2, "United States", ["American Samoa", "British Indian Ocean Territory", "British Virgin Islands", "Bonaire Sint Eustatius and Saba", "Ecuador", "El Salvador", "Guam", "Marshall Islands", "Federated States of Micronesia", "Northern Mariana Islands", "Palau", "Panama", "Puerto Rico", "Timor-Leste", "Turks and Caicos Islands", "US Virgin Islands", "United States Minor Outlying Islands"], {
    usage: {
      openInvoices: [
        { ref: "INV-2025-0520", vendor: "Acme Corp", amount: "$18,500.00", status: "Open", date: "2025-11-01" },
        { ref: "INV-2025-0533", vendor: "Global Supplies Inc.", amount: "$7,200.00", status: "Pending", date: "2025-11-20" },
        { ref: "INV-2025-0541", vendor: "Pacific Trading LLC", amount: "$34,100.00", status: "Open", date: "2025-12-05" },
      ],
      openCustomerInvoices: [
        { ref: "AR-2025-0102", vendor: "New York Imports LLC", amount: "$22,800.00", status: "Open", date: "2025-11-08" },
        { ref: "AR-2025-0115", vendor: "Texas Energy Co.", amount: "$41,500.00", status: "Overdue", date: "2025-10-01" },
      ],
      openPurchaseOrders: [
        { ref: "PO-2025-0290", vendor: "Acme Corp", amount: "$12,000.00", status: "Open", date: "2025-11-10" },
        { ref: "PO-2025-0305", vendor: "Summit Materials", amount: "$5,800.00", status: "Pending", date: "2025-12-01" },
      ],
      openSalesOrders: [
        { ref: "SO-2025-0089", vendor: "Midwest Distributors", amount: "$15,600.00", status: "Open", date: "2025-11-25" },
        { ref: "SO-2025-0094", vendor: "Coastal Retailers Inc.", amount: "$8,400.00", status: "Draft", date: "2025-12-10" },
      ],
      bankAccounts: 3, unsettledPayments: 2, exchangeRateEntries: 10, totalLifetimeDocuments: 150,
    },
  }),
  cur("UYU", "Uruguayan Peso", "858", "$", 2, "Uruguay", []),
  cur("UZS", "Uzbekistani Sum", "860", "so'm", 2, "Uzbekistan", []),
  cur("VED", "Venezuelan Digital Bolívar", "926", "Bs.D", 2, "Venezuela", []),
  cur("VES", "Venezuelan Sovereign Bolívar", "928", "Bs.S", 2, "Venezuela", []),
  cur("VND", "Vietnamese Đồng", "704", "₫", 0, "Vietnam", []),
  cur("VUV", "Vanuatu Vatu", "548", "Vt", 0, "Vanuatu", []),
  cur("WST", "Samoan Tala", "882", "T", 2, "Samoa", []),
  cur("XAF", "CFA Franc BEAC", "950", "Fr", 0, "Cameroon", ["Central African Republic", "Republic of the Congo", "Chad", "Equatorial Guinea", "Gabon"]),
  cur("XCD", "East Caribbean Dollar", "951", "$", 2, "Anguilla", ["Antigua and Barbuda", "Dominica", "Grenada", "Montserrat", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines"]),
  cur("XCG", "Caribbean Guilder", "532", "ƒ", 2, "Curaçao", ["Sint Maarten"]),
  cur("XOF", "CFA Franc BCEAO", "952", "Fr", 0, "Benin", ["Burkina Faso", "Ivory Coast", "Guinea-Bissau", "Mali", "Niger", "Senegal", "Togo"]),
  cur("XPF", "CFP Franc", "953", "Fr", 0, "French Polynesia", ["New Caledonia", "Wallis and Futuna"]),
  cur("YER", "Yemeni Rial", "886", "﷼", 2, "Yemen", []),
  cur("ZAR", "South African Rand", "710", "R", 2, "South Africa", ["Eswatini", "Lesotho", "Namibia"], {
    usage: { ...emptyUsage(), exchangeRateEntries: 1, totalLifetimeDocuments: 9 },
  }),
  cur("ZMW", "Zambian Kwacha", "967", "ZK", 2, "Zambia", []),
  cur("ZWG", "Zimbabwe Gold", "924", "ZiG", 2, "Zimbabwe", []),
];
