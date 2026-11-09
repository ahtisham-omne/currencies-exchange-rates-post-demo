import type { Account, Transaction } from '../types'
import { normalSideDelta } from './monthlyLedger'
// Currency metadata, code → full name + flag, for the rich Currency column
// (flag + code chip + full form). Falls back to the bare code for anything not
// listed.
/* Two rates, and they are deliberately not the same number.

   `bookedRate` is the rate the balance was last revalued at, and it is the only
   one the ledger has ever seen. A foreign-currency balance is carried in base
   at the rate in force when it was last struck and it stays there until the
   next revaluation posts the movement to FX Gain/Loss. Every base-currency
   figure in this module - the balance column, the totals, the export - is that
   booked value.

   `rate` is today's indicative spot rate. Nothing has been posted at it. It
   answers "what would this be worth if we revalued now", which is a question
   about the future, not a reading of the ledger.

   They have to be held apart for the distinction to survive at all. Deriving
   the own-currency figure from the base balance at today's rate and then
   converting it back returns the base balance, so the unrealized difference
   would read zero for every account and the hover card would be restating its
   own input. */
export interface CurrencyMeta { code: string; name: string; flag: string; rate: number; bookedRate: number }

/* Rates carry four decimals because that is how a rate is quoted and how it is
   contracted on. Two decimals is not a shorter way of writing the same number:
   at 0.92 against 0.9243, a million-dollar balance is out by 4,300. */
export const CURRENCY_META: Record<string, CurrencyMeta> = {
  USD: { code: 'USD', name: 'US Dollar', flag: '🇺🇸', rate: 1, bookedRate: 1 },
  EUR: { code: 'EUR', name: 'Euro', flag: '🇪🇺', rate: 0.9243, bookedRate: 0.9310 },
  GBP: { code: 'GBP', name: 'British Pound', flag: '🇬🇧', rate: 0.7914, bookedRate: 0.7862 },
  HKD: { code: 'HKD', name: 'Hong Kong Dollar', flag: '🇭🇰', rate: 7.8215, bookedRate: 7.8098 },
  JPY: { code: 'JPY', name: 'Japanese Yen', flag: '🇯🇵', rate: 157.2485, bookedRate: 155.8940 },
  CAD: { code: 'CAD', name: 'Canadian Dollar', flag: '🇨🇦', rate: 1.3718, bookedRate: 1.3795 },
  AUD: { code: 'AUD', name: 'Australian Dollar', flag: '🇦🇺', rate: 1.5106, bookedRate: 1.5023 },
  SGD: { code: 'SGD', name: 'Singapore Dollar', flag: '🇸🇬', rate: 1.3482, bookedRate: 1.3531 },
  CHF: { code: 'CHF', name: 'Swiss Franc', flag: '🇨🇭', rate: 0.8967, bookedRate: 0.8894 },
  CNY: { code: 'CNY', name: 'Chinese Yuan', flag: '🇨🇳', rate: 7.2519, bookedRate: 7.2410 },
  INR: { code: 'INR', name: 'Indian Rupee', flag: '🇮🇳', rate: 83.4162, bookedRate: 83.1875 },
  AED: { code: 'AED', name: 'UAE Dirham', flag: '🇦🇪', rate: 3.6725, bookedRate: 3.6725 },
  PKR: { code: 'PKR', name: 'Pakistani Rupee', flag: '🇵🇰', rate: 278.5340, bookedRate: 277.0900 },
}

/* Currencies whose booked rate and spot rate agree because the currency is
   pegged to the base, not because the revaluation was skipped. AED has sat at
   3.6725 to the dollar since 1997. A peg is the one case where an account shows
   no unrealized difference and the card is telling the truth by showing zero. */
export const PEGGED_TO_BASE: ReadonlySet<string> = new Set(['USD', 'AED'])

export function currencyMeta(code: string): CurrencyMeta {
  return CURRENCY_META[code] ?? { code, name: code, flag: '🏳️', rate: 1, bookedRate: 1 }
}

/* How a rate reads wherever one is shown, so the hover cards cannot quote the
   same rate two ways. Four decimals is the floor, including on 1.0000, since a
   rate shown to fewer decimals than it was quoted at reads as a different rate.
   The ceiling sits above the floor so a currency that genuinely needs more
   precision keeps it rather than being rounded to fit. */
export function formatRate(rate: number): string {
  return rate.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })
}

/* Restate a booked base-currency amount in `code`, at the rate it was booked
   at. This is the only direction the ledger supports: the base figure is what
   was posted, and the booked rate is what it was posted at, so the two are two
   readings of one entry rather than a conversion of one into the other.

   Every own-currency figure in the module comes through here - the Foreign
   balance column, its sort and filter, the export and the hover card - so the
   column and the card cannot quote different numbers for the same balance. */
export function bookedFromBase(base: number, code: string): number {
  return base * currencyMeta(code).bookedRate
}

/* What was typed, where it was typed in the account's own currency. Mahad,
   2026-10-11: *"On the EUR account, show the euro amount that was actually typed
   in (€123.45), not €124.34. Add up the euro balance from those real amounts."*
   An entry written in euros posts its base figure at that day's rate; restating
   the base back at the booked rate lands a little off what was typed. So a line
   written in the account's own currency reads as typed, and the balance takes
   those real amounts in place of their restatements. A posting written in base
   has no typed euro, and still reads restated. */
type TypedPosting = Pick<Transaction, 'entryCurrency' | 'fxDebit' | 'fxCredit' | 'debit' | 'credit'>

/** Whether the posting was typed in this currency. */
export const typedIn = (t: TypedPosting, code: string): boolean =>
  t.entryCurrency === code && (t.fxDebit != null || t.fxCredit != null)

/** One side of a posting in the account's own currency: as typed, or restated. */
export function ownSide(t: TypedPosting, side: 'debit' | 'credit', code: string): number {
  if (typedIn(t, code)) return (side === 'debit' ? t.fxDebit : t.fxCredit) ?? 0
  return bookedFromBase(t[side], code)
}

/** What the typed amounts change about an account's own-currency balance: each
 *  typed posting's real amount less its base amount restated, on the account's
 *  normal side. Postings dated after `upTo` are left out. */
export function typedCorrection(
  account: Pick<Account, 'id' | 'currencyCode' | 'normalBalance' | 'isContra'>,
  transactions: Transaction[],
  upTo?: string,
): number {
  const code = account.currencyCode
  let out = 0
  for (const t of transactions) {
    if (t.accountId !== account.id || !typedIn(t, code)) continue
    if (upTo && t.date.slice(0, 10) > upTo) continue
    out += normalSideDelta(account, { debit: t.fxDebit ?? 0, credit: t.fxCredit ?? 0 })
      - bookedFromBase(normalSideDelta(account, t), code)
  }
  return out
}

/** An account's balance in its own currency: its base balance restated, with
 *  what was typed in that currency counted as typed. */
export const ownBalanceOf = (a: Pick<Account, 'balance' | 'currencyCode' | 'typedCorrection'>): number =>
  bookedFromBase(a.balance, a.currencyCode) + (a.typedCorrection ?? 0)

/** The same, as it stands today whatever period the chart is scoped to: what the
 *  Running balance and Foreign balance read. */
export const currentOwnBalanceOf = (a: Pick<Account, 'balance' | 'currencyCode' | 'typedCorrection' | 'currentBalance' | 'currentTypedCorrection'>): number =>
  bookedFromBase(a.currentBalance ?? a.balance, a.currencyCode) + (a.currentTypedCorrection ?? a.typedCorrection ?? 0)

/* Everything the hover card states about one balance, derived together so the
   booked leg and the indicative leg cannot drift apart.

   `booked` is the base-currency value the ledger holds. `own` is that same
   entry read in the account's own currency. `indicative` is what `own` would be
   worth in base if it were revalued at today's rate, and `difference` is the
   gap - unrealized, and not posted to FX Gain/Loss until a revaluation runs. */
export interface FxStanding {
  code: string
  own: number
  booked: number
  bookedRate: number
  indicative: number
  rate: number
  difference: number
}

export function fxStanding(booked: number, code: string, ownAmount?: number): FxStanding {
  const { rate, bookedRate } = currencyMeta(code)
  // What the account holds in its own currency: as typed where it was, else the
  // booked figure restated.
  const own = ownAmount ?? booked * bookedRate
  const indicative = own / rate
  return { code, own, booked, bookedRate, indicative, rate, difference: indicative - booked }
}

// Rate provenance shown in the FX-rate hover card. The demo's rates are one
// snapshot, stated as of this morning: the card says "at today's rate", and a
// fixed June date under it contradicted that (module review, 2026-10-06, COA-31).
export const RATE_SOURCE = 'Open Exchange Rates'
const longDay = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
export const RATE_AS_OF = `${longDay(new Date())} 09:00`

/* When the booked rates were last struck. Revaluation runs at period close, so
   this is a month end - the last one before today - and always sits behind
   RATE_AS_OF; the gap between the two is exactly what the unrealized
   difference measures. */
export const REVALUED_ON = (() => {
  const now = new Date()
  return longDay(new Date(now.getFullYear(), now.getMonth(), 0))
})()

// The complete ISO 4217 active set (code, display name, flag). Shared by the
// Currency field and by the import engine, which has to tell a real code from a
// typo before it decides whether an account can hold its own currency.
export interface CurrencyOption { code: string; name: string; flag: string }

export const CURRENCIES: CurrencyOption[] = [
  { code: 'AED', name: 'UAE Dirham', flag: '🇦🇪' },
  { code: 'AFN', name: 'Afghan Afghani', flag: '🇦🇫' },
  { code: 'ALL', name: 'Albanian Lek', flag: '🇦🇱' },
  { code: 'AMD', name: 'Armenian Dram', flag: '🇦🇲' },
  { code: 'ANG', name: 'Netherlands Antillean Guilder', flag: '🇨🇼' },
  { code: 'AOA', name: 'Angolan Kwanza', flag: '🇦🇴' },
  { code: 'ARS', name: 'Argentine Peso', flag: '🇦🇷' },
  { code: 'AUD', name: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'AWG', name: 'Aruban Florin', flag: '🇦🇼' },
  { code: 'AZN', name: 'Azerbaijani Manat', flag: '🇦🇿' },
  { code: 'BAM', name: 'Bosnia-Herzegovina Convertible Mark', flag: '🇧🇦' },
  { code: 'BBD', name: 'Barbadian Dollar', flag: '🇧🇧' },
  { code: 'BDT', name: 'Bangladeshi Taka', flag: '🇧🇩' },
  { code: 'BGN', name: 'Bulgarian Lev', flag: '🇧🇬' },
  { code: 'BHD', name: 'Bahraini Dinar', flag: '🇧🇭' },
  { code: 'BIF', name: 'Burundian Franc', flag: '🇧🇮' },
  { code: 'BMD', name: 'Bermudan Dollar', flag: '🇧🇲' },
  { code: 'BND', name: 'Brunei Dollar', flag: '🇧🇳' },
  { code: 'BOB', name: 'Bolivian Boliviano', flag: '🇧🇴' },
  { code: 'BRL', name: 'Brazilian Real', flag: '🇧🇷' },
  { code: 'BSD', name: 'Bahamian Dollar', flag: '🇧🇸' },
  { code: 'BTN', name: 'Bhutanese Ngultrum', flag: '🇧🇹' },
  { code: 'BWP', name: 'Botswanan Pula', flag: '🇧🇼' },
  { code: 'BYN', name: 'Belarusian Ruble', flag: '🇧🇾' },
  { code: 'BZD', name: 'Belize Dollar', flag: '🇧🇿' },
  { code: 'CAD', name: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'CDF', name: 'Congolese Franc', flag: '🇨🇩' },
  { code: 'CHF', name: 'Swiss Franc', flag: '🇨🇭' },
  { code: 'CLP', name: 'Chilean Peso', flag: '🇨🇱' },
  { code: 'CNY', name: 'Chinese Yuan', flag: '🇨🇳' },
  { code: 'COP', name: 'Colombian Peso', flag: '🇨🇴' },
  { code: 'CRC', name: 'Costa Rican Colón', flag: '🇨🇷' },
  { code: 'CUP', name: 'Cuban Peso', flag: '🇨🇺' },
  { code: 'CVE', name: 'Cape Verdean Escudo', flag: '🇨🇻' },
  { code: 'CZK', name: 'Czech Koruna', flag: '🇨🇿' },
  { code: 'DJF', name: 'Djiboutian Franc', flag: '🇩🇯' },
  { code: 'DKK', name: 'Danish Krone', flag: '🇩🇰' },
  { code: 'DOP', name: 'Dominican Peso', flag: '🇩🇴' },
  { code: 'DZD', name: 'Algerian Dinar', flag: '🇩🇿' },
  { code: 'EGP', name: 'Egyptian Pound', flag: '🇪🇬' },
  { code: 'ERN', name: 'Eritrean Nakfa', flag: '🇪🇷' },
  { code: 'ETB', name: 'Ethiopian Birr', flag: '🇪🇹' },
  { code: 'EUR', name: 'Euro', flag: '🇪🇺' },
  { code: 'FJD', name: 'Fijian Dollar', flag: '🇫🇯' },
  { code: 'FKP', name: 'Falkland Islands Pound', flag: '🇫🇰' },
  { code: 'GBP', name: 'British Pound', flag: '🇬🇧' },
  { code: 'GEL', name: 'Georgian Lari', flag: '🇬🇪' },
  { code: 'GHS', name: 'Ghanaian Cedi', flag: '🇬🇭' },
  { code: 'GIP', name: 'Gibraltar Pound', flag: '🇬🇮' },
  { code: 'GMD', name: 'Gambian Dalasi', flag: '🇬🇲' },
  { code: 'GNF', name: 'Guinean Franc', flag: '🇬🇳' },
  { code: 'GTQ', name: 'Guatemalan Quetzal', flag: '🇬🇹' },
  { code: 'GYD', name: 'Guyanaese Dollar', flag: '🇬🇾' },
  { code: 'HKD', name: 'Hong Kong Dollar', flag: '🇭🇰' },
  { code: 'HNL', name: 'Honduran Lempira', flag: '🇭🇳' },
  { code: 'HRK', name: 'Croatian Kuna', flag: '🇭🇷' },
  { code: 'HTG', name: 'Haitian Gourde', flag: '🇭🇹' },
  { code: 'HUF', name: 'Hungarian Forint', flag: '🇭🇺' },
  { code: 'IDR', name: 'Indonesian Rupiah', flag: '🇮🇩' },
  { code: 'ILS', name: 'Israeli New Shekel', flag: '🇮🇱' },
  { code: 'INR', name: 'Indian Rupee', flag: '🇮🇳' },
  { code: 'IQD', name: 'Iraqi Dinar', flag: '🇮🇶' },
  { code: 'IRR', name: 'Iranian Rial', flag: '🇮🇷' },
  { code: 'ISK', name: 'Icelandic Króna', flag: '🇮🇸' },
  { code: 'JMD', name: 'Jamaican Dollar', flag: '🇯🇲' },
  { code: 'JOD', name: 'Jordanian Dinar', flag: '🇯🇴' },
  { code: 'JPY', name: 'Japanese Yen', flag: '🇯🇵' },
  { code: 'KES', name: 'Kenyan Shilling', flag: '🇰🇪' },
  { code: 'KGS', name: 'Kyrgystani Som', flag: '🇰🇬' },
  { code: 'KHR', name: 'Cambodian Riel', flag: '🇰🇭' },
  { code: 'KMF', name: 'Comorian Franc', flag: '🇰🇲' },
  { code: 'KPW', name: 'North Korean Won', flag: '🇰🇵' },
  { code: 'KRW', name: 'South Korean Won', flag: '🇰🇷' },
  { code: 'KWD', name: 'Kuwaiti Dinar', flag: '🇰🇼' },
  { code: 'KYD', name: 'Cayman Islands Dollar', flag: '🇰🇾' },
  { code: 'KZT', name: 'Kazakhstani Tenge', flag: '🇰🇿' },
  { code: 'LAK', name: 'Laotian Kip', flag: '🇱🇦' },
  { code: 'LBP', name: 'Lebanese Pound', flag: '🇱🇧' },
  { code: 'LKR', name: 'Sri Lankan Rupee', flag: '🇱🇰' },
  { code: 'LRD', name: 'Liberian Dollar', flag: '🇱🇷' },
  { code: 'LSL', name: 'Lesotho Loti', flag: '🇱🇸' },
  { code: 'LYD', name: 'Libyan Dinar', flag: '🇱🇾' },
  { code: 'MAD', name: 'Moroccan Dirham', flag: '🇲🇦' },
  { code: 'MDL', name: 'Moldovan Leu', flag: '🇲🇩' },
  { code: 'MGA', name: 'Malagasy Ariary', flag: '🇲🇬' },
  { code: 'MKD', name: 'Macedonian Denar', flag: '🇲🇰' },
  { code: 'MMK', name: 'Myanmar Kyat', flag: '🇲🇲' },
  { code: 'MNT', name: 'Mongolian Tugrik', flag: '🇲🇳' },
  { code: 'MOP', name: 'Macanese Pataca', flag: '🇲🇴' },
  { code: 'MRU', name: 'Mauritanian Ouguiya', flag: '🇲🇷' },
  { code: 'MUR', name: 'Mauritian Rupee', flag: '🇲🇺' },
  { code: 'MVR', name: 'Maldivian Rufiyaa', flag: '🇲🇻' },
  { code: 'MWK', name: 'Malawian Kwacha', flag: '🇲🇼' },
  { code: 'MXN', name: 'Mexican Peso', flag: '🇲🇽' },
  { code: 'MYR', name: 'Malaysian Ringgit', flag: '🇲🇾' },
  { code: 'MZN', name: 'Mozambican Metical', flag: '🇲🇿' },
  { code: 'NAD', name: 'Namibian Dollar', flag: '🇳🇦' },
  { code: 'NGN', name: 'Nigerian Naira', flag: '🇳🇬' },
  { code: 'NIO', name: 'Nicaraguan Córdoba', flag: '🇳🇮' },
  { code: 'NOK', name: 'Norwegian Krone', flag: '🇳🇴' },
  { code: 'NPR', name: 'Nepalese Rupee', flag: '🇳🇵' },
  { code: 'NZD', name: 'New Zealand Dollar', flag: '🇳🇿' },
  { code: 'OMR', name: 'Omani Rial', flag: '🇴🇲' },
  { code: 'PAB', name: 'Panamanian Balboa', flag: '🇵🇦' },
  { code: 'PEN', name: 'Peruvian Sol', flag: '🇵🇪' },
  { code: 'PGK', name: 'Papua New Guinean Kina', flag: '🇵🇬' },
  { code: 'PHP', name: 'Philippine Peso', flag: '🇵🇭' },
  { code: 'PKR', name: 'Pakistani Rupee', flag: '🇵🇰' },
  { code: 'PLN', name: 'Polish Zloty', flag: '🇵🇱' },
  { code: 'PYG', name: 'Paraguayan Guarani', flag: '🇵🇾' },
  { code: 'QAR', name: 'Qatari Rial', flag: '🇶🇦' },
  { code: 'RON', name: 'Romanian Leu', flag: '🇷🇴' },
  { code: 'RSD', name: 'Serbian Dinar', flag: '🇷🇸' },
  { code: 'RUB', name: 'Russian Ruble', flag: '🇷🇺' },
  { code: 'RWF', name: 'Rwandan Franc', flag: '🇷🇼' },
  { code: 'SAR', name: 'Saudi Riyal', flag: '🇸🇦' },
  { code: 'SBD', name: 'Solomon Islands Dollar', flag: '🇸🇧' },
  { code: 'SCR', name: 'Seychellois Rupee', flag: '🇸🇨' },
  { code: 'SDG', name: 'Sudanese Pound', flag: '🇸🇩' },
  { code: 'SEK', name: 'Swedish Krona', flag: '🇸🇪' },
  { code: 'SGD', name: 'Singapore Dollar', flag: '🇸🇬' },
  { code: 'SHP', name: 'Saint Helena Pound', flag: '🇸🇭' },
  { code: 'SLE', name: 'Sierra Leonean Leone', flag: '🇸🇱' },
  { code: 'SOS', name: 'Somali Shilling', flag: '🇸🇴' },
  { code: 'SRD', name: 'Surinamese Dollar', flag: '🇸🇷' },
  { code: 'SSP', name: 'South Sudanese Pound', flag: '🇸🇸' },
  { code: 'STN', name: 'São Tomé & Príncipe Dobra', flag: '🇸🇹' },
  { code: 'SVC', name: 'Salvadoran Colón', flag: '🇸🇻' },
  { code: 'SYP', name: 'Syrian Pound', flag: '🇸🇾' },
  { code: 'SZL', name: 'Swazi Lilangeni', flag: '🇸🇿' },
  { code: 'THB', name: 'Thai Baht', flag: '🇹🇭' },
  { code: 'TJS', name: 'Tajikistani Somoni', flag: '🇹🇯' },
  { code: 'TMT', name: 'Turkmenistani Manat', flag: '🇹🇲' },
  { code: 'TND', name: 'Tunisian Dinar', flag: '🇹🇳' },
  { code: 'TOP', name: 'Tongan Paʻanga', flag: '🇹🇴' },
  { code: 'TRY', name: 'Turkish Lira', flag: '🇹🇷' },
  { code: 'TTD', name: 'Trinidad & Tobago Dollar', flag: '🇹🇹' },
  { code: 'TWD', name: 'New Taiwan Dollar', flag: '🇹🇼' },
  { code: 'TZS', name: 'Tanzanian Shilling', flag: '🇹🇿' },
  { code: 'UAH', name: 'Ukrainian Hryvnia', flag: '🇺🇦' },
  { code: 'UGX', name: 'Ugandan Shilling', flag: '🇺🇬' },
  { code: 'USD', name: 'United States Dollar', flag: '🇺🇸' },
  { code: 'UYU', name: 'Uruguayan Peso', flag: '🇺🇾' },
  { code: 'UZS', name: 'Uzbekistani Som', flag: '🇺🇿' },
  { code: 'VES', name: 'Venezuelan Bolívar', flag: '🇻🇪' },
  { code: 'VND', name: 'Vietnamese Dong', flag: '🇻🇳' },
  { code: 'VUV', name: 'Vanuatu Vatu', flag: '🇻🇺' },
  { code: 'WST', name: 'Samoan Tala', flag: '🇼🇸' },
  { code: 'XAF', name: 'Central African CFA Franc', flag: '🇨🇲' },
  { code: 'XCD', name: 'East Caribbean Dollar', flag: '🇦🇬' },
  { code: 'XOF', name: 'West African CFA Franc', flag: '🇸🇳' },
  { code: 'XPF', name: 'CFP Franc', flag: '🇵🇫' },
  { code: 'YER', name: 'Yemeni Rial', flag: '🇾🇪' },
  { code: 'ZAR', name: 'South African Rand', flag: '🇿🇦' },
  { code: 'ZMW', name: 'Zambian Kwacha', flag: '🇿🇲' },
  { code: 'ZWL', name: 'Zimbabwean Dollar', flag: '🇿🇼' },
]

const CURRENCY_CODES = new Set(CURRENCIES.map(c => c.code))

// Whether a code names a currency at all. Compared uppercase, since a file may
// spell it either way.
export function isKnownCurrency(code: string): boolean {
  return CURRENCY_CODES.has(code.trim().toUpperCase())
}
