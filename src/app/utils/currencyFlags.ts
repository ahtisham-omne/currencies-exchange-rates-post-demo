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
  SLE: "SL", SLL: "SL", SOS: "SO", SRD: "SR", SSP: "SS", STN: "ST",
  SVC: "SV", SYP: "SY", SZL: "SZ", THB: "TH", TJS: "TJ", TMT: "TM",
  TND: "TN", TOP: "TO", TRY: "TR", TTD: "TT", TWD: "TW",
  TZS: "TZ", UAH: "UA", UGX: "UG", USD: "US", UYU: "UY",
  UZS: "UZ", VED: "VE", VES: "VE", VND: "VN", VUV: "VU", WST: "WS",
  XAF: "CM", XCD: "AG", XCG: "CW", XOF: "SN", XPF: "PF", YER: "YE",
  ZAR: "ZA", ZMW: "ZM", ZWG: "ZW", ZWL: "ZW",
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
  SLE: "Sierra Leone", SLL: "Sierra Leone", SOS: "Somalia", SRD: "Suriname", SSP: "South Sudan", STN: "São Tomé",
  SVC: "El Salvador", SYP: "Syria", SZL: "Eswatini", THB: "Thailand", TJS: "Tajikistan", TMT: "Turkmenistan",
  TND: "Tunisia", TOP: "Tonga", TRY: "Turkey", TTD: "Trinidad & Tobago", TWD: "Taiwan",
  TZS: "Tanzania", UAH: "Ukraine", UGX: "Uganda", USD: "United States", UYU: "Uruguay",
  UZS: "Uzbekistan", VED: "Venezuela", VES: "Venezuela", VND: "Vietnam", VUV: "Vanuatu", WST: "Samoa",
  XAF: "Central Africa", XCD: "East Caribbean", XCG: "Curaçao", XOF: "West Africa", XPF: "French Pacific", YER: "Yemen",
  ZAR: "South Africa", ZMW: "Zambia", ZWG: "Zimbabwe", ZWL: "Zimbabwe",
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

// Country name → ISO 3166-1 alpha-2. Covers every name used in SEED_CURRENCIES
// primary and additionalCountries arrays so the flag tooltip always resolves.
const COUNTRY_NAME_TO_ALPHA2: Record<string, string> = {
  "American Samoa": "AS", "Andorra": "AD", "Antigua and Barbuda": "AG",
  "Ascension Island": "AC", "Austria": "AT", "Belgium": "BE",
  "Bhutan": "BT", "Bonaire Sint Eustatius and Saba": "BQ", "Bouvet Island": "BV",
  "British Indian Ocean Territory": "IO", "British Virgin Islands": "VG",
  "Bulgaria": "BG", "Burkina Faso": "BF", "Central African Republic": "CF",
  "Chad": "TD", "Christmas Island": "CX", "Cocos (Keeling) Islands": "CC",
  "Cook Islands": "CK", "Croatia": "HR", "Cyprus": "CY", "Dominica": "DM",
  "Ecuador": "EC", "El Salvador": "SV", "Equatorial Guinea": "GQ",
  "Estonia": "EE", "Eswatini": "SZ", "Faroe Islands": "FO",
  "Federated States of Micronesia": "FM", "Finland": "FI", "France": "FR",
  "Gabon": "GA", "Germany": "DE", "Greece": "GR", "Greenland": "GL",
  "Grenada": "GD", "Guam": "GU", "Guernsey": "GG", "Guinea-Bissau": "GW",
  "Heard Island and McDonald Islands": "HM", "Ireland": "IE",
  "Isle of Man": "IM", "Italy": "IT", "Ivory Coast": "CI", "Jersey": "JE",
  "Kiribati": "KI", "Kosovo": "XK", "Latvia": "LV", "Lesotho": "LS",
  "Liechtenstein": "LI", "Lithuania": "LT", "Luxembourg": "LU",
  "Mali": "ML", "Malta": "MT", "Marshall Islands": "MH", "Monaco": "MC",
  "Montenegro": "ME", "Montserrat": "MS", "Namibia": "NA", "Nauru": "NR",
  "Netherlands": "NL", "New Caledonia": "NC", "Niger": "NE", "Niue": "NU",
  "Norfolk Island": "NF", "Northern Mariana Islands": "MP", "Palau": "PW",
  "Panama": "PA", "Pitcairn Islands": "PN", "Portugal": "PT",
  "Puerto Rico": "PR", "Republic of the Congo": "CG",
  "Saint Kitts and Nevis": "KN", "Saint Lucia": "LC",
  "Saint Vincent and the Grenadines": "VC", "San Marino": "SM",
  "Senegal": "SN", "Sint Maarten": "SX", "Slovakia": "SK", "Slovenia": "SI",
  "Spain": "ES", "Svalbard and Jan Mayen": "SJ", "Timor-Leste": "TL",
  "Togo": "TG", "Tokelau": "TK", "Tristan da Cunha": "SH",
  "Turks and Caicos Islands": "TC", "Tuvalu": "TV",
  "US Virgin Islands": "VI", "United States Minor Outlying Islands": "UM",
  "Vatican City": "VA", "Wallis and Futuna": "WF", "Western Sahara": "EH",
};

/**
 * Returns a flagcdn.com URL for a country name (as stored in currency data).
 * Empty string if the name has no mapping.
 */
export function getFlagUrlByCountry(countryName: string, width: number = 40): string {
  const code = COUNTRY_NAME_TO_ALPHA2[countryName];
  if (!code) return "";
  return `https://flagcdn.com/w${width}/${code.toLowerCase()}.png`;
}
