/* ── Currency Library ─────────────────────────────────────────────────
 * Every active currency, exactly as the Currency & Exchange Rates module
 * keeps it (src/app/data/currencies.ts in currencies-exchange-rates-post-demo):
 * its name, symbol, minor-unit decimals and the flag the module draws for it
 * (flag-icons' 4:3 set; shared currencies take a member's flag, e.g. EUR the
 * EU's, XOF Senegal's). Every selection point offers the full list (spec 2.3). */

export interface Currency {
  /** ISO 4217 alpha-3. */
  code: string;
  name: string;
  symbol: string;
  /** Minor-unit decimals (JPY 0, KWD 3, most 2). */
  decimals: number;
  /** flag-icons file name (ISO 3166 alpha-2, lower case, or e.g. "eu"). */
  flag: string | null;
  /** The country or area the library lists the currency under. */
  country: string;
}

/** The company's base currency (Company Setup). Ledgers, KPIs and A/P post in it. */
export const BASE_CURRENCY = 'PKR';

export const CURRENCIES: Currency[] = [
  { code: "AED", name: "United Arab Emirates Dirham", symbol: "د.إ", decimals: 2, flag: "ae", country: "United Arab Emirates" },
  { code: "AFN", name: "Afghan Afghani", symbol: "؋", decimals: 2, flag: "af", country: "Afghanistan" },
  { code: "ALL", name: "Albanian Lek", symbol: "L", decimals: 2, flag: "al", country: "Albania" },
  { code: "AMD", name: "Armenian Dram", symbol: "֏", decimals: 2, flag: "am", country: "Armenia" },
  { code: "AOA", name: "Angolan Kwanza", symbol: "Kz", decimals: 2, flag: "ao", country: "Angola" },
  { code: "ARS", name: "Argentine Peso", symbol: "$", decimals: 2, flag: "ar", country: "Argentina" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", decimals: 2, flag: "au", country: "Australia" },
  { code: "AWG", name: "Aruban Florin", symbol: "ƒ", decimals: 2, flag: "aw", country: "Aruba" },
  { code: "AZN", name: "Azerbaijani Manat", symbol: "₼", decimals: 2, flag: "az", country: "Azerbaijan" },
  { code: "BAM", name: "Bosnia and Herzegovina Convertible Mark", symbol: "KM", decimals: 2, flag: "ba", country: "Bosnia and Herzegovina" },
  { code: "BBD", name: "Barbados Dollar", symbol: "$", decimals: 2, flag: "bb", country: "Barbados" },
  { code: "BDT", name: "Bangladeshi Taka", symbol: "৳", decimals: 2, flag: "bd", country: "Bangladesh" },
  { code: "BGN", name: "Bulgarian Lev", symbol: "лв", decimals: 2, flag: "bg", country: "Bulgaria" },
  { code: "BHD", name: "Bahraini Dinar", symbol: "BD", decimals: 3, flag: "bh", country: "Bahrain" },
  { code: "BIF", name: "Burundian Franc", symbol: "Fr", decimals: 0, flag: "bi", country: "Burundi" },
  { code: "BMD", name: "Bermudian Dollar", symbol: "$", decimals: 2, flag: "bm", country: "Bermuda" },
  { code: "BND", name: "Brunei Dollar", symbol: "$", decimals: 2, flag: "bn", country: "Brunei" },
  { code: "BOB", name: "Boliviano", symbol: "Bs", decimals: 2, flag: "bo", country: "Bolivia" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", decimals: 2, flag: "br", country: "Brazil" },
  { code: "BSD", name: "Bahamian Dollar", symbol: "$", decimals: 2, flag: "bs", country: "Bahamas" },
  { code: "BTN", name: "Bhutanese Ngultrum", symbol: "Nu", decimals: 2, flag: "bt", country: "Bhutan" },
  { code: "BWP", name: "Botswana Pula", symbol: "P", decimals: 2, flag: "bw", country: "Botswana" },
  { code: "BYN", name: "Belarusian Ruble", symbol: "Br", decimals: 2, flag: "by", country: "Belarus" },
  { code: "BZD", name: "Belize Dollar", symbol: "$", decimals: 2, flag: "bz", country: "Belize" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", decimals: 2, flag: "ca", country: "Canada" },
  { code: "CDF", name: "Congolese Franc", symbol: "Fr", decimals: 2, flag: "cd", country: "Democratic Republic of the Congo" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", decimals: 2, flag: "ch", country: "Switzerland" },
  { code: "CLP", name: "Chilean Peso", symbol: "$", decimals: 0, flag: "cl", country: "Chile" },
  { code: "CNY", name: "Renminbi", symbol: "¥", decimals: 2, flag: "cn", country: "China" },
  { code: "COP", name: "Colombian Peso", symbol: "$", decimals: 2, flag: "co", country: "Colombia" },
  { code: "CRC", name: "Costa Rican Colón", symbol: "₡", decimals: 2, flag: "cr", country: "Costa Rica" },
  { code: "CUP", name: "Cuban Peso", symbol: "$", decimals: 2, flag: "cu", country: "Cuba" },
  { code: "CVE", name: "Cape Verdean Escudo", symbol: "$", decimals: 2, flag: "cv", country: "Cape Verde" },
  { code: "CZK", name: "Czech Koruna", symbol: "Kč", decimals: 2, flag: "cz", country: "Czech Republic" },
  { code: "DJF", name: "Djiboutian Franc", symbol: "Fr", decimals: 0, flag: "dj", country: "Djibouti" },
  { code: "DKK", name: "Danish Krone", symbol: "kr", decimals: 2, flag: "dk", country: "Denmark" },
  { code: "DOP", name: "Dominican Peso", symbol: "$", decimals: 2, flag: "do", country: "Dominican Republic" },
  { code: "DZD", name: "Algerian Dinar", symbol: "د.ج", decimals: 2, flag: "dz", country: "Algeria" },
  { code: "EGP", name: "Egyptian Pound", symbol: "£", decimals: 2, flag: "eg", country: "Egypt" },
  { code: "ERN", name: "Eritrean Nakfa", symbol: "Nfk", decimals: 2, flag: "er", country: "Eritrea" },
  { code: "ETB", name: "Ethiopian Birr", symbol: "Br", decimals: 2, flag: "et", country: "Ethiopia" },
  { code: "EUR", name: "Euro", symbol: "€", decimals: 2, flag: "eu", country: "Eurozone" },
  { code: "FJD", name: "Fiji Dollar", symbol: "$", decimals: 2, flag: "fj", country: "Fiji" },
  { code: "FKP", name: "Falkland Islands Pound", symbol: "£", decimals: 2, flag: "fk", country: "Falkland Islands" },
  { code: "GBP", name: "Pound Sterling", symbol: "£", decimals: 2, flag: "gb", country: "United Kingdom" },
  { code: "GEL", name: "Georgian Lari", symbol: "₾", decimals: 2, flag: "ge", country: "Georgia" },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "₵", decimals: 2, flag: "gh", country: "Ghana" },
  { code: "GIP", name: "Gibraltar Pound", symbol: "£", decimals: 2, flag: "gi", country: "Gibraltar" },
  { code: "GMD", name: "Gambian Dalasi", symbol: "D", decimals: 2, flag: "gm", country: "Gambia" },
  { code: "GNF", name: "Guinean Franc", symbol: "Fr", decimals: 0, flag: "gn", country: "Guinea" },
  { code: "GTQ", name: "Guatemalan Quetzal", symbol: "Q", decimals: 2, flag: "gt", country: "Guatemala" },
  { code: "GYD", name: "Guyanese Dollar", symbol: "$", decimals: 2, flag: "gy", country: "Guyana" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", decimals: 2, flag: "hk", country: "Hong Kong" },
  { code: "HNL", name: "Honduran Lempira", symbol: "L", decimals: 2, flag: "hn", country: "Honduras" },
  { code: "HTG", name: "Haitian Gourde", symbol: "G", decimals: 2, flag: "ht", country: "Haiti" },
  { code: "HUF", name: "Hungarian Forint", symbol: "Ft", decimals: 2, flag: "hu", country: "Hungary" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", decimals: 2, flag: "id", country: "Indonesia" },
  { code: "ILS", name: "Israeli New Shekel", symbol: "₪", decimals: 2, flag: "il", country: "Israel" },
  { code: "INR", name: "Indian Rupee", symbol: "₹", decimals: 2, flag: "in", country: "India" },
  { code: "IQD", name: "Iraqi Dinar", symbol: "ع.د", decimals: 3, flag: "iq", country: "Iraq" },
  { code: "IRR", name: "Iranian Rial", symbol: "﷼", decimals: 2, flag: "ir", country: "Iran" },
  { code: "ISK", name: "Icelandic Króna", symbol: "kr", decimals: 0, flag: "is", country: "Iceland" },
  { code: "JMD", name: "Jamaican Dollar", symbol: "$", decimals: 2, flag: "jm", country: "Jamaica" },
  { code: "JOD", name: "Jordanian Dinar", symbol: "د.ا", decimals: 3, flag: "jo", country: "Jordan" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", decimals: 0, flag: "jp", country: "Japan" },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", decimals: 2, flag: "ke", country: "Kenya" },
  { code: "KGS", name: "Kyrgyzstani Som", symbol: "с", decimals: 2, flag: "kg", country: "Kyrgyzstan" },
  { code: "KHR", name: "Cambodian Riel", symbol: "៛", decimals: 2, flag: "kh", country: "Cambodia" },
  { code: "KMF", name: "Comoro Franc", symbol: "Fr", decimals: 0, flag: "km", country: "Comoros" },
  { code: "KPW", name: "North Korean Won", symbol: "₩", decimals: 2, flag: "kp", country: "North Korea" },
  { code: "KRW", name: "South Korean Won", symbol: "₩", decimals: 0, flag: "kr", country: "South Korea" },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "د.ك", decimals: 3, flag: "kw", country: "Kuwait" },
  { code: "KYD", name: "Cayman Islands Dollar", symbol: "$", decimals: 2, flag: "ky", country: "Cayman Islands" },
  { code: "KZT", name: "Kazakhstani Tenge", symbol: "₸", decimals: 2, flag: "kz", country: "Kazakhstan" },
  { code: "LAK", name: "Lao Kip", symbol: "₭", decimals: 2, flag: "la", country: "Laos" },
  { code: "LBP", name: "Lebanese Pound", symbol: "ل.ل", decimals: 2, flag: "lb", country: "Lebanon" },
  { code: "LKR", name: "Sri Lankan Rupee", symbol: "₨", decimals: 2, flag: "lk", country: "Sri Lanka" },
  { code: "LRD", name: "Liberian Dollar", symbol: "$", decimals: 2, flag: "lr", country: "Liberia" },
  { code: "LSL", name: "Lesotho Loti", symbol: "L", decimals: 2, flag: "ls", country: "Lesotho" },
  { code: "LYD", name: "Libyan Dinar", symbol: "ل.د", decimals: 3, flag: "ly", country: "Libya" },
  { code: "MAD", name: "Moroccan Dirham", symbol: "د.م.", decimals: 2, flag: "ma", country: "Morocco" },
  { code: "MDL", name: "Moldovan Leu", symbol: "L", decimals: 2, flag: "md", country: "Moldova" },
  { code: "MGA", name: "Malagasy Ariary", symbol: "Ar", decimals: 2, flag: "mg", country: "Madagascar" },
  { code: "MKD", name: "Macedonian Denar", symbol: "ден", decimals: 2, flag: "mk", country: "North Macedonia" },
  { code: "MMK", name: "Myanmar Kyat", symbol: "K", decimals: 2, flag: "mm", country: "Myanmar" },
  { code: "MNT", name: "Mongolian Tögrög", symbol: "₮", decimals: 2, flag: "mn", country: "Mongolia" },
  { code: "MOP", name: "Macanese Pataca", symbol: "P", decimals: 2, flag: "mo", country: "Macau" },
  { code: "MRU", name: "Mauritanian Ouguiya", symbol: "UM", decimals: 2, flag: "mr", country: "Mauritania" },
  { code: "MUR", name: "Mauritian Rupee", symbol: "₨", decimals: 2, flag: "mu", country: "Mauritius" },
  { code: "MVR", name: "Maldivian Rufiyaa", symbol: "ރ", decimals: 2, flag: "mv", country: "Maldives" },
  { code: "MWK", name: "Malawian Kwacha", symbol: "MK", decimals: 2, flag: "mw", country: "Malawi" },
  { code: "MXN", name: "Mexican Peso", symbol: "$", decimals: 2, flag: "mx", country: "Mexico" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", decimals: 2, flag: "my", country: "Malaysia" },
  { code: "MZN", name: "Mozambican Metical", symbol: "MT", decimals: 2, flag: "mz", country: "Mozambique" },
  { code: "NAD", name: "Namibian Dollar", symbol: "$", decimals: 2, flag: "na", country: "Namibia" },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", decimals: 2, flag: "ng", country: "Nigeria" },
  { code: "NIO", name: "Nicaraguan Córdoba", symbol: "C$", decimals: 2, flag: "ni", country: "Nicaragua" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr", decimals: 2, flag: "no", country: "Norway" },
  { code: "NPR", name: "Nepalese Rupee", symbol: "₨", decimals: 2, flag: "np", country: "Nepal" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "$", decimals: 2, flag: "nz", country: "New Zealand" },
  { code: "OMR", name: "Omani Rial", symbol: "ر.ع.", decimals: 3, flag: "om", country: "Oman" },
  { code: "PAB", name: "Panamanian Balboa", symbol: "B/.", decimals: 2, flag: "pa", country: "Panama" },
  { code: "PEN", name: "Peruvian Sol", symbol: "S/.", decimals: 2, flag: "pe", country: "Peru" },
  { code: "PGK", name: "Papua New Guinean Kina", symbol: "K", decimals: 2, flag: "pg", country: "Papua New Guinea" },
  { code: "PHP", name: "Philippine Peso", symbol: "₱", decimals: 2, flag: "ph", country: "Philippines" },
  { code: "PKR", name: "Pakistani Rupee", symbol: "₨", decimals: 2, flag: "pk", country: "Pakistan" },
  { code: "PLN", name: "Polish Złoty", symbol: "zł", decimals: 2, flag: "pl", country: "Poland" },
  { code: "PYG", name: "Paraguayan Guaraní", symbol: "₲", decimals: 0, flag: "py", country: "Paraguay" },
  { code: "QAR", name: "Qatari Riyal", symbol: "ر.ق", decimals: 2, flag: "qa", country: "Qatar" },
  { code: "RON", name: "Romanian Leu", symbol: "lei", decimals: 2, flag: "ro", country: "Romania" },
  { code: "RSD", name: "Serbian Dinar", symbol: "din", decimals: 2, flag: "rs", country: "Serbia" },
  { code: "RUB", name: "Russian Ruble", symbol: "₽", decimals: 2, flag: "ru", country: "Russia" },
  { code: "RWF", name: "Rwandan Franc", symbol: "Fr", decimals: 0, flag: "rw", country: "Rwanda" },
  { code: "SAR", name: "Saudi Riyal", symbol: "ر.س", decimals: 2, flag: "sa", country: "Saudi Arabia" },
  { code: "SBD", name: "Solomon Islands Dollar", symbol: "$", decimals: 2, flag: "sb", country: "Solomon Islands" },
  { code: "SCR", name: "Seychelles Rupee", symbol: "₨", decimals: 2, flag: "sc", country: "Seychelles" },
  { code: "SDG", name: "Sudanese Pound", symbol: "£", decimals: 2, flag: "sd", country: "Sudan" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr", decimals: 2, flag: "se", country: "Sweden" },
  { code: "SGD", name: "Singapore Dollar", symbol: "$", decimals: 2, flag: "sg", country: "Singapore" },
  { code: "SHP", name: "Saint Helena Pound", symbol: "£", decimals: 2, flag: "sh", country: "Saint Helena" },
  { code: "SLE", name: "Sierra Leonean Leone", symbol: "Le", decimals: 2, flag: "sl", country: "Sierra Leone" },
  { code: "SOS", name: "Somalian Shilling", symbol: "Sh", decimals: 2, flag: "so", country: "Somalia" },
  { code: "SRD", name: "Surinamese Dollar", symbol: "$", decimals: 2, flag: "sr", country: "Suriname" },
  { code: "SSP", name: "South Sudanese Pound", symbol: "£", decimals: 2, flag: "ss", country: "South Sudan" },
  { code: "STN", name: "São Tomé and Príncipe Dobra", symbol: "Db", decimals: 2, flag: "st", country: "São Tomé and Príncipe" },
  { code: "SVC", name: "Salvadoran Colón", symbol: "₡", decimals: 2, flag: "sv", country: "El Salvador" },
  { code: "SYP", name: "Syrian Pound", symbol: "£", decimals: 2, flag: "sy", country: "Syria" },
  { code: "SZL", name: "Swazi Lilangeni", symbol: "L", decimals: 2, flag: "sz", country: "Eswatini" },
  { code: "THB", name: "Thai Baht", symbol: "฿", decimals: 2, flag: "th", country: "Thailand" },
  { code: "TJS", name: "Tajikistani Somoni", symbol: "SM", decimals: 2, flag: "tj", country: "Tajikistan" },
  { code: "TMT", name: "Turkmenistan Manat", symbol: "T", decimals: 2, flag: "tm", country: "Turkmenistan" },
  { code: "TND", name: "Tunisian Dinar", symbol: "د.ت", decimals: 3, flag: "tn", country: "Tunisia" },
  { code: "TOP", name: "Tongan Paʻanga", symbol: "T$", decimals: 2, flag: "to", country: "Tonga" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", decimals: 2, flag: "tr", country: "Turkey" },
  { code: "TTD", name: "Trinidad and Tobago Dollar", symbol: "$", decimals: 2, flag: "tt", country: "Trinidad and Tobago" },
  { code: "TWD", name: "New Taiwan Dollar", symbol: "$", decimals: 2, flag: "tw", country: "Taiwan" },
  { code: "TZS", name: "Tanzanian Shilling", symbol: "Sh", decimals: 2, flag: "tz", country: "Tanzania" },
  { code: "UAH", name: "Ukrainian Hryvnia", symbol: "₴", decimals: 2, flag: "ua", country: "Ukraine" },
  { code: "UGX", name: "Ugandan Shilling", symbol: "Sh", decimals: 0, flag: "ug", country: "Uganda" },
  { code: "USD", name: "United States Dollar", symbol: "$", decimals: 2, flag: "us", country: "United States" },
  { code: "UYU", name: "Uruguayan Peso", symbol: "$", decimals: 2, flag: "uy", country: "Uruguay" },
  { code: "UZS", name: "Uzbekistani Sum", symbol: "so'm", decimals: 2, flag: "uz", country: "Uzbekistan" },
  { code: "VED", name: "Venezuelan Digital Bolívar", symbol: "Bs.D", decimals: 2, flag: "ve", country: "Venezuela" },
  { code: "VES", name: "Venezuelan Sovereign Bolívar", symbol: "Bs.S", decimals: 2, flag: "ve", country: "Venezuela" },
  { code: "VND", name: "Vietnamese Đồng", symbol: "₫", decimals: 0, flag: "vn", country: "Vietnam" },
  { code: "VUV", name: "Vanuatu Vatu", symbol: "Vt", decimals: 0, flag: "vu", country: "Vanuatu" },
  { code: "WST", name: "Samoan Tala", symbol: "T", decimals: 2, flag: "ws", country: "Samoa" },
  { code: "XAF", name: "CFA Franc BEAC", symbol: "Fr", decimals: 0, flag: "cm", country: "Cameroon" },
  { code: "XCD", name: "East Caribbean Dollar", symbol: "$", decimals: 2, flag: "ag", country: "Anguilla" },
  { code: "XCG", name: "Caribbean Guilder", symbol: "ƒ", decimals: 2, flag: "cw", country: "Curaçao" },
  { code: "XOF", name: "CFA Franc BCEAO", symbol: "Fr", decimals: 0, flag: "sn", country: "Benin" },
  { code: "XPF", name: "CFP Franc", symbol: "Fr", decimals: 0, flag: "pf", country: "French Polynesia" },
  { code: "YER", name: "Yemeni Rial", symbol: "﷼", decimals: 2, flag: "ye", country: "Yemen" },
  { code: "ZAR", name: "South African Rand", symbol: "R", decimals: 2, flag: "za", country: "South Africa" },
  { code: "ZMW", name: "Zambian Kwacha", symbol: "ZK", decimals: 2, flag: "zm", country: "Zambia" },
  { code: "ZWG", name: "Zimbabwe Gold", symbol: "ZiG", decimals: 2, flag: "zw", country: "Zimbabwe" },
];

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

export function getCurrency(code: string | null | undefined): Currency | undefined {
  return code ? BY_CODE.get(code.toUpperCase()) : undefined;
}

export const isBaseCurrency = (code: string | null | undefined) => (code || BASE_CURRENCY).toUpperCase() === BASE_CURRENCY;

/** "United States Dollar (USD)", or the bare code for one the library doesn't list. */
export function currencyLabel(code: string): string {
  const c = getCurrency(code);
  return c ? `${c.name} (${c.code})` : code;
}
