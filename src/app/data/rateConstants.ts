// Local stand-in for the shared `currencyLibrary.ts` used by the PO, Quotes,
// and Partners touchpoint repos. Once itemsv2 adopts that module, swap these
// constants for `useRateContext()` + the real rate snapshot. The currency
// library and mid-market rate table below are ported from the Partners repo.

export const BASE_CURRENCY = 'PKR';
export const BASE_CURRENCY_NAME = 'Pakistani Rupee';

export const RATE_TYPE_LABEL = 'Mid-market rate';
export const RATE_TYPE_HEX = '#7c3aed';
export const RATE_SOURCE = 'Open Exchange Rates';
export const RATE_LAST_SYNC_ISO = '2026-05-04T08:30:00Z';

/**
 * Single source of truth for currency selection across the modal. Mirrors
 * the Currency Library data source used in the Partners touchpoint.
 *
 * - `code`     ISO 4217 alpha-3, uppercase
 * - `name`     Full currency name
 * - `country`  ISO 3166-1 alpha-2 (lowercase) for flagcdn.com.
 *              `null` for multi-country currencies (EUR, XAF, XOF, XCD, XCG, XPF) —
 *              the consumer should render a globe fallback icon.
 * - `region`   Country / region label used as additional search target.
 * - `symbol`   Display symbol where commonly known (optional).
 */
export interface LibraryCurrency {
  code: string;
  name: string;
  country: string | null;
  region: string;
  symbol?: string;
}

export const CURRENCY_LIBRARY: LibraryCurrency[] = [
  { code: 'AED', name: 'UAE Dirham', country: 'ae', region: 'United Arab Emirates', symbol: 'د.إ' },
  { code: 'AFN', name: 'Afghan Afghani', country: 'af', region: 'Afghanistan', symbol: '؋' },
  { code: 'ALL', name: 'Albanian Lek', country: 'al', region: 'Albania', symbol: 'L' },
  { code: 'AMD', name: 'Armenian Dram', country: 'am', region: 'Armenia', symbol: '֏' },
  { code: 'ANG', name: 'Netherlands Antillean Guilder', country: 'cw', region: 'Curaçao, Sint Maarten', symbol: 'ƒ' },
  { code: 'AOA', name: 'Angolan Kwanza', country: 'ao', region: 'Angola', symbol: 'Kz' },
  { code: 'ARS', name: 'Argentine Peso', country: 'ar', region: 'Argentina', symbol: '$' },
  { code: 'AUD', name: 'Australian Dollar', country: 'au', region: 'Australia', symbol: 'A$' },
  { code: 'AWG', name: 'Aruban Florin', country: 'aw', region: 'Aruba', symbol: 'ƒ' },
  { code: 'AZN', name: 'Azerbaijani Manat', country: 'az', region: 'Azerbaijan', symbol: '₼' },
  { code: 'BAM', name: 'Bosnia and Herzegovina Convertible Mark', country: 'ba', region: 'Bosnia and Herzegovina', symbol: 'KM' },
  { code: 'BBD', name: 'Barbadian Dollar', country: 'bb', region: 'Barbados', symbol: 'Bds$' },
  { code: 'BDT', name: 'Bangladeshi Taka', country: 'bd', region: 'Bangladesh', symbol: '৳' },
  { code: 'BGN', name: 'Bulgarian Lev', country: 'bg', region: 'Bulgaria', symbol: 'лв' },
  { code: 'BHD', name: 'Bahraini Dinar', country: 'bh', region: 'Bahrain', symbol: 'BD' },
  { code: 'BIF', name: 'Burundian Franc', country: 'bi', region: 'Burundi', symbol: 'FBu' },
  { code: 'BMD', name: 'Bermudian Dollar', country: 'bm', region: 'Bermuda', symbol: 'BD$' },
  { code: 'BND', name: 'Brunei Dollar', country: 'bn', region: 'Brunei', symbol: 'B$' },
  { code: 'BOB', name: 'Bolivian Boliviano', country: 'bo', region: 'Bolivia', symbol: 'Bs.' },
  { code: 'BRL', name: 'Brazilian Real', country: 'br', region: 'Brazil', symbol: 'R$' },
  { code: 'BSD', name: 'Bahamian Dollar', country: 'bs', region: 'Bahamas', symbol: 'B$' },
  { code: 'BTN', name: 'Bhutanese Ngultrum', country: 'bt', region: 'Bhutan', symbol: 'Nu.' },
  { code: 'BWP', name: 'Botswana Pula', country: 'bw', region: 'Botswana', symbol: 'P' },
  { code: 'BYN', name: 'Belarusian Ruble', country: 'by', region: 'Belarus', symbol: 'Br' },
  { code: 'BZD', name: 'Belize Dollar', country: 'bz', region: 'Belize', symbol: 'BZ$' },
  { code: 'CAD', name: 'Canadian Dollar', country: 'ca', region: 'Canada', symbol: 'C$' },
  { code: 'CDF', name: 'Congolese Franc', country: 'cd', region: 'Democratic Republic of the Congo', symbol: 'FC' },
  { code: 'CHF', name: 'Swiss Franc', country: 'ch', region: 'Switzerland, Liechtenstein', symbol: 'CHF' },
  { code: 'CLP', name: 'Chilean Peso', country: 'cl', region: 'Chile', symbol: 'CL$' },
  { code: 'CNY', name: 'Chinese Yuan', country: 'cn', region: 'China', symbol: '¥' },
  { code: 'COP', name: 'Colombian Peso', country: 'co', region: 'Colombia', symbol: 'CO$' },
  { code: 'CRC', name: 'Costa Rican Colón', country: 'cr', region: 'Costa Rica', symbol: '₡' },
  { code: 'CUP', name: 'Cuban Peso', country: 'cu', region: 'Cuba', symbol: '$MN' },
  { code: 'CVE', name: 'Cape Verdean Escudo', country: 'cv', region: 'Cape Verde', symbol: 'Esc' },
  { code: 'CZK', name: 'Czech Koruna', country: 'cz', region: 'Czech Republic', symbol: 'Kč' },
  { code: 'DJF', name: 'Djiboutian Franc', country: 'dj', region: 'Djibouti', symbol: 'Fdj' },
  { code: 'DKK', name: 'Danish Krone', country: 'dk', region: 'Denmark, Greenland, Faroe Islands', symbol: 'kr' },
  { code: 'DOP', name: 'Dominican Peso', country: 'do', region: 'Dominican Republic', symbol: 'RD$' },
  { code: 'DZD', name: 'Algerian Dinar', country: 'dz', region: 'Algeria', symbol: 'DA' },
  { code: 'EGP', name: 'Egyptian Pound', country: 'eg', region: 'Egypt', symbol: 'E£' },
  { code: 'ERN', name: 'Eritrean Nakfa', country: 'er', region: 'Eritrea', symbol: 'Nfk' },
  { code: 'ETB', name: 'Ethiopian Birr', country: 'et', region: 'Ethiopia', symbol: 'Br' },
  { code: 'EUR', name: 'Euro', country: null, region: 'European Union (multi-country)', symbol: '€' },
  { code: 'FJD', name: 'Fijian Dollar', country: 'fj', region: 'Fiji', symbol: 'FJ$' },
  { code: 'FKP', name: 'Falkland Islands Pound', country: 'fk', region: 'Falkland Islands', symbol: '£' },
  { code: 'GBP', name: 'British Pound', country: 'gb', region: 'United Kingdom', symbol: '£' },
  { code: 'GEL', name: 'Georgian Lari', country: 'ge', region: 'Georgia', symbol: '₾' },
  { code: 'GHS', name: 'Ghanaian Cedi', country: 'gh', region: 'Ghana', symbol: 'GH₵' },
  { code: 'GIP', name: 'Gibraltar Pound', country: 'gi', region: 'Gibraltar', symbol: '£' },
  { code: 'GMD', name: 'Gambian Dalasi', country: 'gm', region: 'Gambia', symbol: 'D' },
  { code: 'GNF', name: 'Guinean Franc', country: 'gn', region: 'Guinea', symbol: 'FG' },
  { code: 'GTQ', name: 'Guatemalan Quetzal', country: 'gt', region: 'Guatemala', symbol: 'Q' },
  { code: 'GYD', name: 'Guyanese Dollar', country: 'gy', region: 'Guyana', symbol: 'GY$' },
  { code: 'HKD', name: 'Hong Kong Dollar', country: 'hk', region: 'Hong Kong', symbol: 'HK$' },
  { code: 'HNL', name: 'Honduran Lempira', country: 'hn', region: 'Honduras', symbol: 'L' },
  { code: 'HTG', name: 'Haitian Gourde', country: 'ht', region: 'Haiti', symbol: 'G' },
  { code: 'HUF', name: 'Hungarian Forint', country: 'hu', region: 'Hungary', symbol: 'Ft' },
  { code: 'IDR', name: 'Indonesian Rupiah', country: 'id', region: 'Indonesia', symbol: 'Rp' },
  { code: 'ILS', name: 'Israeli New Shekel', country: 'il', region: 'Israel', symbol: '₪' },
  { code: 'INR', name: 'Indian Rupee', country: 'in', region: 'India', symbol: '₹' },
  { code: 'IQD', name: 'Iraqi Dinar', country: 'iq', region: 'Iraq', symbol: 'ع.د' },
  { code: 'IRR', name: 'Iranian Rial', country: 'ir', region: 'Iran', symbol: '﷼' },
  { code: 'ISK', name: 'Icelandic Króna', country: 'is', region: 'Iceland', symbol: 'kr' },
  { code: 'JMD', name: 'Jamaican Dollar', country: 'jm', region: 'Jamaica', symbol: 'J$' },
  { code: 'JOD', name: 'Jordanian Dinar', country: 'jo', region: 'Jordan', symbol: 'JD' },
  { code: 'JPY', name: 'Japanese Yen', country: 'jp', region: 'Japan', symbol: '¥' },
  { code: 'KES', name: 'Kenyan Shilling', country: 'ke', region: 'Kenya', symbol: 'KSh' },
  { code: 'KGS', name: 'Kyrgyzstani Som', country: 'kg', region: 'Kyrgyzstan', symbol: 'с' },
  { code: 'KHR', name: 'Cambodian Riel', country: 'kh', region: 'Cambodia', symbol: '៛' },
  { code: 'KMF', name: 'Comorian Franc', country: 'km', region: 'Comoros', symbol: 'CF' },
  { code: 'KPW', name: 'North Korean Won', country: 'kp', region: 'North Korea', symbol: '₩' },
  { code: 'KRW', name: 'South Korean Won', country: 'kr', region: 'South Korea', symbol: '₩' },
  { code: 'KWD', name: 'Kuwaiti Dinar', country: 'kw', region: 'Kuwait', symbol: 'د.ك' },
  { code: 'KYD', name: 'Cayman Islands Dollar', country: 'ky', region: 'Cayman Islands', symbol: 'CI$' },
  { code: 'KZT', name: 'Kazakhstani Tenge', country: 'kz', region: 'Kazakhstan', symbol: '₸' },
  { code: 'LAK', name: 'Lao Kip', country: 'la', region: 'Laos', symbol: '₭' },
  { code: 'LBP', name: 'Lebanese Pound', country: 'lb', region: 'Lebanon', symbol: 'ل.ل' },
  { code: 'LKR', name: 'Sri Lankan Rupee', country: 'lk', region: 'Sri Lanka', symbol: 'Rs' },
  { code: 'LRD', name: 'Liberian Dollar', country: 'lr', region: 'Liberia', symbol: 'L$' },
  { code: 'LSL', name: 'Lesotho Loti', country: 'ls', region: 'Lesotho', symbol: 'L' },
  { code: 'LYD', name: 'Libyan Dinar', country: 'ly', region: 'Libya', symbol: 'LD' },
  { code: 'MAD', name: 'Moroccan Dirham', country: 'ma', region: 'Morocco, Western Sahara', symbol: 'MAD' },
  { code: 'MDL', name: 'Moldovan Leu', country: 'md', region: 'Moldova', symbol: 'L' },
  { code: 'MGA', name: 'Malagasy Ariary', country: 'mg', region: 'Madagascar', symbol: 'Ar' },
  { code: 'MKD', name: 'Macedonian Denar', country: 'mk', region: 'North Macedonia', symbol: 'ден' },
  { code: 'MMK', name: 'Myanmar Kyat', country: 'mm', region: 'Myanmar', symbol: 'K' },
  { code: 'MNT', name: 'Mongolian Tögrög', country: 'mn', region: 'Mongolia', symbol: '₮' },
  { code: 'MOP', name: 'Macanese Pataca', country: 'mo', region: 'Macau', symbol: 'MOP$' },
  { code: 'MRU', name: 'Mauritanian Ouguiya', country: 'mr', region: 'Mauritania', symbol: 'UM' },
  { code: 'MUR', name: 'Mauritian Rupee', country: 'mu', region: 'Mauritius', symbol: 'Rs' },
  { code: 'MVR', name: 'Maldivian Rufiyaa', country: 'mv', region: 'Maldives', symbol: 'Rf' },
  { code: 'MWK', name: 'Malawian Kwacha', country: 'mw', region: 'Malawi', symbol: 'MK' },
  { code: 'MXN', name: 'Mexican Peso', country: 'mx', region: 'Mexico', symbol: 'MX$' },
  { code: 'MYR', name: 'Malaysian Ringgit', country: 'my', region: 'Malaysia', symbol: 'RM' },
  { code: 'MZN', name: 'Mozambican Metical', country: 'mz', region: 'Mozambique', symbol: 'MT' },
  { code: 'NAD', name: 'Namibian Dollar', country: 'na', region: 'Namibia', symbol: 'N$' },
  { code: 'NGN', name: 'Nigerian Naira', country: 'ng', region: 'Nigeria', symbol: '₦' },
  { code: 'NIO', name: 'Nicaraguan Córdoba', country: 'ni', region: 'Nicaragua', symbol: 'C$' },
  { code: 'NOK', name: 'Norwegian Krone', country: 'no', region: 'Norway', symbol: 'kr' },
  { code: 'NPR', name: 'Nepalese Rupee', country: 'np', region: 'Nepal', symbol: '₨' },
  { code: 'NZD', name: 'New Zealand Dollar', country: 'nz', region: 'New Zealand', symbol: 'NZ$' },
  { code: 'OMR', name: 'Omani Rial', country: 'om', region: 'Oman', symbol: '﷼' },
  { code: 'PAB', name: 'Panamanian Balboa', country: 'pa', region: 'Panama', symbol: 'B/.' },
  { code: 'PEN', name: 'Peruvian Sol', country: 'pe', region: 'Peru', symbol: 'S/.' },
  { code: 'PGK', name: 'Papua New Guinean Kina', country: 'pg', region: 'Papua New Guinea', symbol: 'K' },
  { code: 'PHP', name: 'Philippine Peso', country: 'ph', region: 'Philippines', symbol: '₱' },
  { code: 'PKR', name: 'Pakistani Rupee', country: 'pk', region: 'Pakistan', symbol: '₨' },
  { code: 'PLN', name: 'Polish Złoty', country: 'pl', region: 'Poland', symbol: 'zł' },
  { code: 'PYG', name: 'Paraguayan Guaraní', country: 'py', region: 'Paraguay', symbol: '₲' },
  { code: 'QAR', name: 'Qatari Riyal', country: 'qa', region: 'Qatar', symbol: '﷼' },
  { code: 'RON', name: 'Romanian Leu', country: 'ro', region: 'Romania', symbol: 'lei' },
  { code: 'RSD', name: 'Serbian Dinar', country: 'rs', region: 'Serbia', symbol: 'din' },
  { code: 'RUB', name: 'Russian Ruble', country: 'ru', region: 'Russia', symbol: '₽' },
  { code: 'RWF', name: 'Rwandan Franc', country: 'rw', region: 'Rwanda', symbol: 'RF' },
  { code: 'SAR', name: 'Saudi Riyal', country: 'sa', region: 'Saudi Arabia', symbol: '﷼' },
  { code: 'SBD', name: 'Solomon Islands Dollar', country: 'sb', region: 'Solomon Islands', symbol: 'SI$' },
  { code: 'SCR', name: 'Seychellois Rupee', country: 'sc', region: 'Seychelles', symbol: 'SR' },
  { code: 'SDG', name: 'Sudanese Pound', country: 'sd', region: 'Sudan', symbol: 'ج.س.' },
  { code: 'SEK', name: 'Swedish Krona', country: 'se', region: 'Sweden', symbol: 'kr' },
  { code: 'SGD', name: 'Singapore Dollar', country: 'sg', region: 'Singapore', symbol: 'S$' },
  { code: 'SHP', name: 'Saint Helena Pound', country: 'sh', region: 'Saint Helena, Ascension, Tristan da Cunha', symbol: '£' },
  { code: 'SLE', name: 'Sierra Leonean Leone', country: 'sl', region: 'Sierra Leone', symbol: 'Le' },
  { code: 'SOS', name: 'Somali Shilling', country: 'so', region: 'Somalia', symbol: 'Sh' },
  { code: 'SRD', name: 'Surinamese Dollar', country: 'sr', region: 'Suriname', symbol: 'Sr$' },
  { code: 'SSP', name: 'South Sudanese Pound', country: 'ss', region: 'South Sudan', symbol: '£' },
  { code: 'STN', name: 'São Tomé and Príncipe Dobra', country: 'st', region: 'São Tomé and Príncipe', symbol: 'Db' },
  { code: 'SVC', name: 'Salvadoran Colón', country: 'sv', region: 'El Salvador', symbol: '₡' },
  { code: 'SYP', name: 'Syrian Pound', country: 'sy', region: 'Syria', symbol: '£S' },
  { code: 'SZL', name: 'Swazi Lilangeni', country: 'sz', region: 'Eswatini', symbol: 'L' },
  { code: 'THB', name: 'Thai Baht', country: 'th', region: 'Thailand', symbol: '฿' },
  { code: 'TJS', name: 'Tajikistani Somoni', country: 'tj', region: 'Tajikistan', symbol: 'ЅМ' },
  { code: 'TMT', name: 'Turkmenistani Manat', country: 'tm', region: 'Turkmenistan', symbol: 'T' },
  { code: 'TND', name: 'Tunisian Dinar', country: 'tn', region: 'Tunisia', symbol: 'DT' },
  { code: 'TOP', name: 'Tongan Paʻanga', country: 'to', region: 'Tonga', symbol: 'T$' },
  { code: 'TRY', name: 'Turkish Lira', country: 'tr', region: 'Turkey', symbol: '₺' },
  { code: 'TTD', name: 'Trinidad and Tobago Dollar', country: 'tt', region: 'Trinidad and Tobago', symbol: 'TT$' },
  { code: 'TWD', name: 'New Taiwan Dollar', country: 'tw', region: 'Taiwan', symbol: 'NT$' },
  { code: 'TZS', name: 'Tanzanian Shilling', country: 'tz', region: 'Tanzania', symbol: 'TSh' },
  { code: 'UAH', name: 'Ukrainian Hryvnia', country: 'ua', region: 'Ukraine', symbol: '₴' },
  { code: 'UGX', name: 'Ugandan Shilling', country: 'ug', region: 'Uganda', symbol: 'USh' },
  { code: 'USD', name: 'United States Dollar', country: 'us', region: 'United States', symbol: '$' },
  { code: 'UYU', name: 'Uruguayan Peso', country: 'uy', region: 'Uruguay', symbol: '$U' },
  { code: 'UZS', name: 'Uzbekistani Som', country: 'uz', region: 'Uzbekistan', symbol: 'сўм' },
  { code: 'VES', name: 'Venezuelan Bolívar Soberano', country: 've', region: 'Venezuela', symbol: 'Bs.S' },
  { code: 'VND', name: 'Vietnamese Đồng', country: 'vn', region: 'Vietnam', symbol: '₫' },
  { code: 'VUV', name: 'Vanuatu Vatu', country: 'vu', region: 'Vanuatu', symbol: 'VT' },
  { code: 'WST', name: 'Samoan Tālā', country: 'ws', region: 'Samoa', symbol: 'WS$' },
  { code: 'XAF', name: 'Central African CFA Franc', country: null, region: 'Central African Economic and Monetary Community (multi-country)', symbol: 'FCFA' },
  { code: 'XCD', name: 'East Caribbean Dollar', country: null, region: 'Organisation of Eastern Caribbean States (multi-country)', symbol: 'EC$' },
  { code: 'XCG', name: 'Caribbean Guilder', country: null, region: 'Curaçao, Sint Maarten (multi-country)', symbol: 'Cg' },
  { code: 'XOF', name: 'West African CFA Franc', country: null, region: 'West African Economic and Monetary Union (multi-country)', symbol: 'CFA' },
  { code: 'XPF', name: 'CFP Franc', country: null, region: 'French Polynesia, New Caledonia, Wallis and Futuna (multi-country)', symbol: '₣' },
  { code: 'YER', name: 'Yemeni Rial', country: 'ye', region: 'Yemen', symbol: '﷼' },
  { code: 'ZAR', name: 'South African Rand', country: 'za', region: 'South Africa', symbol: 'R' },
  { code: 'ZMW', name: 'Zambian Kwacha', country: 'zm', region: 'Zambia', symbol: 'ZK' },
  { code: 'ZWG', name: 'Zimbabwe Gold', country: 'zw', region: 'Zimbabwe', symbol: 'ZiG' },
];

const BY_CODE = new Map(CURRENCY_LIBRARY.map((c) => [c.code, c]));

export function getLibraryCurrency(code: string | null | undefined): LibraryCurrency | undefined {
  if (!code) return undefined;
  return BY_CODE.get(code.toUpperCase());
}

/**
 * Mid-market rate table — PKR per 1 unit of CODE. Currencies present in
 * `CURRENCY_LIBRARY` but missing from this table are still selectable but
 * have no auto-conversion (the modal falls back to manual entry).
 */
export const MARKET_RATES: Record<string, number> = {
  PKR: 1,
  USD: 278.50,
  EUR: 305,
  GBP: 355,
  JPY: 1.85,
  CHF: 320,
  CAD: 205,
  AUD: 182,
  CNY: 39,
  INR: 3.35,
  KRW: 0.21,
  SGD: 207,
  HKD: 35.6,
  TWD: 8.7,
  THB: 7.8,
  MYR: 62,
  IDR: 0.017,
  PHP: 4.9,
  VND: 0.011,
  NZD: 168,
  BDT: 2.5,
  LKR: 0.92,
  MXN: 14.2,
  BRL: 55,
  ARS: 0.29,
  CLP: 0.29,
  COP: 0.068,
  PEN: 74.3,
  SEK: 26.5,
  NOK: 26.1,
  DKK: 40.9,
  PLN: 70.3,
  CZK: 12.2,
  HUF: 0.78,
  RON: 61.4,
  BGN: 156,
  TRY: 8.6,
  RUB: 2.9,
  UAH: 6.8,
  ISK: 2.0,
  AED: 75.7,
  SAR: 74.1,
  QAR: 76.4,
  KWD: 905,
  BHD: 738,
  OMR: 722,
  JOD: 392,
  ILS: 75.2,
  EGP: 5.7,
  ZAR: 15.1,
  NGN: 0.19,
  KES: 2.15,
  KZT: 0.58,
  GEL: 103,
  RSD: 2.6,
};

/** Returns the mid-market rate (PKR per 1 unit of `code`) or undefined if unknown. */
export function rateToBase(code: string | null | undefined): number | undefined {
  if (!code) return undefined;
  return MARKET_RATES[code.toUpperCase()];
}

/** Builds a flagcdn.com URL — null country (multi-country currencies) returns null. */
export function flagUrlFor(country: string | null): string | null {
  if (!country) return null;
  return `https://flagcdn.com/w40/${country}.png`;
}

/**
 * Flag URL for a specific currency. Prefers the currency's country flag, but
 * supplies a representative flag for known multi-country currencies (the EU
 * flag for EUR) so the row doesn't fall back to a generic globe.
 */
export function flagUrlForCurrency(currency: LibraryCurrency): string | null {
  if (currency.code === 'EUR') return 'https://flagcdn.com/w40/eu.png';
  return flagUrlFor(currency.country);
}

export function formatRateUpdatedAs(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatPartnerAmount(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
