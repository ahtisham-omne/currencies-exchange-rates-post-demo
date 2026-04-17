// Currency code → ISO 3166-1 alpha-2 country code mapping
// Used to generate flag emoji or flag CDN URLs

const CURRENCY_TO_COUNTRY: Record<string, string> = {
  AED: "AE", AFN: "AF", ALL: "AL", AMD: "AM", AOA: "AO",
  ARS: "AR", AUD: "AU", AWG: "AW", AZN: "AZ", BAM: "BA", BBD: "BB",
  BDT: "BD", BGN: "BG", BHD: "BH", BIF: "BI", BMD: "BM",
  BND: "BN", BOB: "BO", BRL: "BR", BSD: "BS", BTN: "BT",
  BWP: "BW", BYN: "BY", BZD: "BZ", CAD: "CA", CDF: "CD",
  CHF: "CH", CLP: "CL", CNY: "CN", COP: "CO", CRC: "CR",
  CUP: "CU", CVE: "CV", CZK: "CZ", DJF: "DJ", DKK: "DK",
  DOP: "DO", DZD: "DZ", EGP: "EG", ERN: "ER", ETB: "ET",
  EUR: "EU", FJD: "FJ", FKP: "FK", GBP: "GB", GEL: "GE",
  GHS: "GH", GIP: "GI", GMD: "GM", GNF: "GN", GTQ: "GT",
  GYD: "GY", HKD: "HK", HNL: "HN", HRK: "HR", HTG: "HT",
  HUF: "HU", IDR: "ID", ILS: "IL", INR: "IN", IQD: "IQ",
  IRR: "IR", ISK: "IS", JMD: "JM", JOD: "JO", JPY: "JP",
  KES: "KE", KGS: "KG", KHR: "KH", KMF: "KM", KPW: "KP",
  KRW: "KR", KWD: "KW", KYD: "KY", KZT: "KZ", LAK: "LA",
  LBP: "LB", LKR: "LK", LRD: "LR", LSL: "LS", LYD: "LY",
  MAD: "MA", MDL: "MD", MGA: "MG", MKD: "MK", MMK: "MM",
  MNT: "MN", MOP: "MO", MRU: "MR", MUR: "MU", MVR: "MV",
  MWK: "MW", MXN: "MX", MYR: "MY", MZN: "MZ", NAD: "NA",
  NGN: "NG", NIO: "NI", NOK: "NO", NPR: "NP", NZD: "NZ",
  OMR: "OM", PAB: "PA", PEN: "PE", PGK: "PG", PHP: "PH",
  PKR: "PK", PLN: "PL", PYG: "PY", QAR: "QA", RON: "RO",
  RSD: "RS", RUB: "RU", RWF: "RW", SAR: "SA", SBD: "SB",
  SCR: "SC", SDG: "SD", SEK: "SE", SGD: "SG", SHP: "SH",
  SLL: "SL", SOS: "SO", SRD: "SR", SSP: "SS", STN: "ST",
  SYP: "SY", SZL: "SZ", THB: "TH", TJS: "TJ", TMT: "TM",
  TND: "TN", TOP: "TO", TRY: "TR", TTD: "TT", TWD: "TW",
  TZS: "TZ", UAH: "UA", UGX: "UG", USD: "US", UYU: "UY",
  UZS: "UZ", VES: "VE", VND: "VN", VUV: "VU", WST: "WS",
  XAF: "CM", XCD: "AG", XOF: "SN", XPF: "PF", YER: "YE",
  ZAR: "ZA", ZMW: "ZM", ZWL: "ZW",
};

const CURRENCY_TO_COUNTRY_NAME: Record<string, string> = {
  AED: "United Arab Emirates", AFN: "Afghanistan", ALL: "Albania", AMD: "Armenia", AOA: "Angola",
  ARS: "Argentina", AUD: "Australia", AWG: "Aruba", AZN: "Azerbaijan", BAM: "Bosnia & Herzegovina", BBD: "Barbados",
  BDT: "Bangladesh", BGN: "Bulgaria", BHD: "Bahrain", BIF: "Burundi", BMD: "Bermuda",
  BND: "Brunei", BOB: "Bolivia", BRL: "Brazil", BSD: "Bahamas", BTN: "Bhutan",
  BWP: "Botswana", BYN: "Belarus", BZD: "Belize", CAD: "Canada", CDF: "DR Congo",
  CHF: "Switzerland", CLP: "Chile", CNY: "China", COP: "Colombia", CRC: "Costa Rica",
  CUP: "Cuba", CVE: "Cabo Verde", CZK: "Czech Republic", DJF: "Djibouti", DKK: "Denmark",
  DOP: "Dominican Republic", DZD: "Algeria", EGP: "Egypt", ERN: "Eritrea", ETB: "Ethiopia",
  EUR: "European Union", FJD: "Fiji", FKP: "Falkland Islands", GBP: "United Kingdom", GEL: "Georgia",
  GHS: "Ghana", GIP: "Gibraltar", GMD: "Gambia", GNF: "Guinea", GTQ: "Guatemala",
  GYD: "Guyana", HKD: "Hong Kong", HNL: "Honduras", HRK: "Croatia", HTG: "Haiti",
  HUF: "Hungary", IDR: "Indonesia", ILS: "Israel", INR: "India", IQD: "Iraq",
  IRR: "Iran", ISK: "Iceland", JMD: "Jamaica", JOD: "Jordan", JPY: "Japan",
  KES: "Kenya", KGS: "Kyrgyzstan", KHR: "Cambodia", KMF: "Comoros", KPW: "North Korea",
  KRW: "South Korea", KWD: "Kuwait", KYD: "Cayman Islands", KZT: "Kazakhstan", LAK: "Laos",
  LBP: "Lebanon", LKR: "Sri Lanka", LRD: "Liberia", LSL: "Lesotho", LYD: "Libya",
  MAD: "Morocco", MDL: "Moldova", MGA: "Madagascar", MKD: "North Macedonia", MMK: "Myanmar",
  MNT: "Mongolia", MOP: "Macau", MRU: "Mauritania", MUR: "Mauritius", MVR: "Maldives",
  MWK: "Malawi", MXN: "Mexico", MYR: "Malaysia", MZN: "Mozambique", NAD: "Namibia",
  NGN: "Nigeria", NIO: "Nicaragua", NOK: "Norway", NPR: "Nepal", NZD: "New Zealand",
  OMR: "Oman", PAB: "Panama", PEN: "Peru", PGK: "Papua New Guinea", PHP: "Philippines",
  PKR: "Pakistan", PLN: "Poland", PYG: "Paraguay", QAR: "Qatar", RON: "Romania",
  RSD: "Serbia", RUB: "Russia", RWF: "Rwanda", SAR: "Saudi Arabia", SBD: "Solomon Islands",
  SCR: "Seychelles", SDG: "Sudan", SEK: "Sweden", SGD: "Singapore", SHP: "Saint Helena",
  SLL: "Sierra Leone", SOS: "Somalia", SRD: "Suriname", SSP: "South Sudan", STN: "São Tomé",
  SYP: "Syria", SZL: "Eswatini", THB: "Thailand", TJS: "Tajikistan", TMT: "Turkmenistan",
  TND: "Tunisia", TOP: "Tonga", TRY: "Turkey", TTD: "Trinidad & Tobago", TWD: "Taiwan",
  TZS: "Tanzania", UAH: "Ukraine", UGX: "Uganda", USD: "United States", UYU: "Uruguay",
  UZS: "Uzbekistan", VES: "Venezuela", VND: "Vietnam", VUV: "Vanuatu", WST: "Samoa",
  XAF: "Central Africa", XCD: "East Caribbean", XOF: "West Africa", XPF: "French Pacific", YER: "Yemen",
  ZAR: "South Africa", ZMW: "Zambia", ZWL: "Zimbabwe",
};

/**
 * Returns a flag image URL from flagcdn.com for a given currency code.
 * Rectangular flag style (w40 = 40px wide).
 */
export function getFlagUrl(currencyCode: string, width: number = 40): string {
  const country = CURRENCY_TO_COUNTRY[currencyCode.toUpperCase()];
  if (!country) return "";
  return `https://flagcdn.com/w${width}/${country.toLowerCase()}.png`;
}

/**
 * Returns the country code for a given currency code.
 */
export function getCountryCode(currencyCode: string): string | null {
  return CURRENCY_TO_COUNTRY[currencyCode.toUpperCase()] || null;
}

/**
 * Returns the country name for a given currency code.
 */
export function getCountryName(currencyCode: string): string {
  return CURRENCY_TO_COUNTRY_NAME[currencyCode.toUpperCase()] || "";
}
