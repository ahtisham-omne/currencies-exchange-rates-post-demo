// Guided Setup Wizard - data + pure logic (no React).
//
// The third first-time-setup path (alongside Upload and Build-from-scratch).
// Everyone starts on a curated baseline chart; nine plain-language questions
// each ADD accounts on top and carry a one-line reason. Only the accounting
// method is required. Any other question can be skipped - an unanswered one adds
// nothing, or contributes a safe default at publish time - because the goal is a
// good starting chart, not a complete one. Two of them, ownership and sales tax,
// are asked of US businesses only. The questions, their helpers and their
// tooltips are Mahad's spec of 2026-10-02, verbatim.
//
// Three rules decide which questions exist at all.
//
// Only ask what the software cannot work out for itself. The holding account for
// goods that arrive before their invoice is implied by carrying stock, and
// purchasing will book against it either way, so it is derived rather than asked.
//
// Store what the answer controls, not the label it arrived with. Ownership is
// kept as the equity pattern it selects, so the option list can be relabelled
// per market without touching the chart it builds.
//
// A question whose answer changes the chart is multi-select when reality is.
// Making and reselling are different charts and plenty of companies do both, so
// the answer is a list and the account sets merge.
//
// We deliberately reuse the MasterChartEntry shape (mining names/numbers from
// MASTER_CHART) so the shared preview chrome - WizardRightPane / WizardChartTree
// and the entry→Account projection - works with zero adapters. This is a fresh,
// self-contained mapping: it does NOT reuse WizardTrigger / computeWizardChart.

import { MASTER_CHART, MASTER_CHART_ROLES, MasterChartEntry, TYPE_TO_CODE } from './masterChart'
import type { Account, NumberingScheme, StatementClassification } from '../types'
import { CATEGORY_FIRST_DIGIT, CLASSIFICATIONS_BY_CATEGORY, DEFAULT_NUMBER_WIDTH } from '../types'
import { categoryBlock, childBlock } from './numberRange'
import { seedCategoryAccounts } from './seed'

export type GuidedQuestionId =
  | 'country' | 'activities' | 'method' | 'ownership'
  | 'customers' | 'vendors' | 'currency' | 'tax' | 'payroll' | 'assets'

// What the business does. Making and reselling are separate answers because they
// build different charts, and a company that does both gets the union.
export type GuidedActivity = 'manufacture' | 'resell' | 'services' | 'subscriptions' | 'construction'

// The US legal forms the ownership question offers. Asked for US businesses only:
// the forms, and the equity accounts each one sets up, are US ones.
export type GuidedOwnership = 'sole' | 'partnership' | 'scorp' | 'ccorp'

export type GuidedCustomerPayment = 'invoice' | 'pos'
export type GuidedVendorPayment = 'invoice' | 'card'
export type GuidedAsset = 'own' | 'lease' | 'loans' | 'none'

// A baseline/addition entry: a master-chart row, optionally locked (system) and
// tagged with the question that introduced it plus a plain-language reason.
export interface GuidedEntry extends MasterChartEntry {
  system?: boolean            // locked (Retained Earnings, Opening Balance Equity)
  addedBy?: GuidedQuestionId  // which question introduced it; undefined = baseline
  reason?: string             // "why this is here", surfaced as Account.setupNote
}

export interface GuidedAnswers {
  country: string | null
  activities: GuidedActivity[]
  method: 'accrual' | 'cash' | null
  ownership: GuidedOwnership | null
  customers: GuidedCustomerPayment[]
  vendors: GuidedVendorPayment[]
  currency: 'yes' | 'no' | null
  tax: 'yes' | 'no' | null
  payroll: 'yes' | 'no' | null
  assets: GuidedAsset[]
}

export const EMPTY_GUIDED_ANSWERS: GuidedAnswers = {
  country: null, activities: [], method: null, ownership: null,
  customers: [], vendors: [], currency: null, tax: null, payroll: null, assets: [],
}

// A list answer is unanswered while it is empty; every other field is unanswered
// while it is null. Both mean "fall back to the safe default at publish time".
export function isGuidedAnswered(value: unknown): boolean {
  return Array.isArray(value) ? value.length > 0 : value != null
}

// ============================================================================
// Country. Tailored setup is US-only today: a US business is asked about its
// legal form and sales tax, and somewhere else gets the general chart with those
// two questions skipped. Every chart this wizard builds is structured to US GAAP.
//
// Known limitation: IFRS markets get that same GAAP-shaped chart. The accounts
// post correctly either way, but IFRS presentation differs (inventory wording,
// how development costs and revaluations are carried), so a UK or German company
// may need to reshape statement grouping. Fixing it means a presentation layer
// per framework, not a second chart per country - do not fork the account sets.
// ============================================================================
/* Every country, so a business anywhere can say where it is. Design review,
   2026-10-02 - Eli: *"this doesn't seem like a comprehensive country list. There's
   192 recognized countries and about 10 unrecognized"*. The list was 34. These
   are the ISO 3166 codes in use for a place people live and trade - territories
   included, the uninhabited ones left off - plus Kosovo (XK), which has no
   official code but is written that way everywhere. Names are the English ones,
   written out here rather than read from the browser so they read the same on
   every machine.

   `taxTerm` is what the country calls its sales tax, where we have checked it.
   Nothing reads it yet; tailored setup is US-only (see above). */
export interface GuidedCountry { code: string; name: string; taxTerm?: string }
export const GUIDED_COUNTRIES: GuidedCountry[] = [
  { code: 'AD', name: 'Andorra' },
  { code: 'AE', name: 'United Arab Emirates', taxTerm: 'VAT' },
  { code: 'AF', name: 'Afghanistan' },
  { code: 'AG', name: 'Antigua & Barbuda' },
  { code: 'AI', name: 'Anguilla' },
  { code: 'AL', name: 'Albania' },
  { code: 'AM', name: 'Armenia' },
  { code: 'AO', name: 'Angola' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AS', name: 'American Samoa' },
  { code: 'AT', name: 'Austria' },
  { code: 'AU', name: 'Australia', taxTerm: 'GST' },
  { code: 'AW', name: 'Aruba' },
  { code: 'AX', name: 'Åland Islands' },
  { code: 'AZ', name: 'Azerbaijan' },
  { code: 'BA', name: 'Bosnia & Herzegovina' },
  { code: 'BB', name: 'Barbados' },
  { code: 'BD', name: 'Bangladesh', taxTerm: 'VAT' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'BI', name: 'Burundi' },
  { code: 'BJ', name: 'Benin' },
  { code: 'BL', name: 'St. Barthélemy' },
  { code: 'BM', name: 'Bermuda' },
  { code: 'BN', name: 'Brunei' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BQ', name: 'Caribbean Netherlands' },
  { code: 'BR', name: 'Brazil', taxTerm: 'VAT' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BT', name: 'Bhutan' },
  { code: 'BW', name: 'Botswana' },
  { code: 'BY', name: 'Belarus' },
  { code: 'BZ', name: 'Belize' },
  { code: 'CA', name: 'Canada', taxTerm: 'GST' },
  { code: 'CC', name: 'Cocos (Keeling) Islands' },
  { code: 'CD', name: 'Democratic Republic of the Congo' },
  { code: 'CF', name: 'Central African Republic' },
  { code: 'CG', name: 'Republic of the Congo' },
  { code: 'CH', name: 'Switzerland', taxTerm: 'VAT' },
  { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'CK', name: 'Cook Islands' },
  { code: 'CL', name: 'Chile' },
  { code: 'CM', name: 'Cameroon' },
  { code: 'CN', name: 'China', taxTerm: 'VAT' },
  { code: 'CO', name: 'Colombia' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'CU', name: 'Cuba' },
  { code: 'CV', name: 'Cape Verde' },
  { code: 'CW', name: 'Curaçao' },
  { code: 'CX', name: 'Christmas Island' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czechia' },
  { code: 'DE', name: 'Germany', taxTerm: 'VAT' },
  { code: 'DJ', name: 'Djibouti' },
  { code: 'DK', name: 'Denmark' },
  { code: 'DM', name: 'Dominica' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'DZ', name: 'Algeria' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'EE', name: 'Estonia' },
  { code: 'EG', name: 'Egypt' },
  { code: 'EH', name: 'Western Sahara' },
  { code: 'ER', name: 'Eritrea' },
  { code: 'ES', name: 'Spain', taxTerm: 'VAT' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'FI', name: 'Finland' },
  { code: 'FJ', name: 'Fiji' },
  { code: 'FK', name: 'Falkland Islands' },
  { code: 'FM', name: 'Micronesia' },
  { code: 'FO', name: 'Faroe Islands' },
  { code: 'FR', name: 'France', taxTerm: 'VAT' },
  { code: 'GA', name: 'Gabon' },
  { code: 'GB', name: 'United Kingdom', taxTerm: 'VAT' },
  { code: 'GD', name: 'Grenada' },
  { code: 'GE', name: 'Georgia' },
  { code: 'GF', name: 'French Guiana' },
  { code: 'GG', name: 'Guernsey' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GI', name: 'Gibraltar' },
  { code: 'GL', name: 'Greenland' },
  { code: 'GM', name: 'Gambia' },
  { code: 'GN', name: 'Guinea' },
  { code: 'GP', name: 'Guadeloupe' },
  { code: 'GQ', name: 'Equatorial Guinea' },
  { code: 'GR', name: 'Greece' },
  { code: 'GS', name: 'South Georgia & South Sandwich Islands' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'GU', name: 'Guam' },
  { code: 'GW', name: 'Guinea-Bissau' },
  { code: 'GY', name: 'Guyana' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'HN', name: 'Honduras' },
  { code: 'HR', name: 'Croatia' },
  { code: 'HT', name: 'Haiti' },
  { code: 'HU', name: 'Hungary' },
  { code: 'ID', name: 'Indonesia', taxTerm: 'VAT' },
  { code: 'IE', name: 'Ireland', taxTerm: 'VAT' },
  { code: 'IL', name: 'Israel' },
  { code: 'IM', name: 'Isle of Man' },
  { code: 'IN', name: 'India', taxTerm: 'GST' },
  { code: 'IO', name: 'British Indian Ocean Territory' },
  { code: 'IQ', name: 'Iraq' },
  { code: 'IR', name: 'Iran' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IT', name: 'Italy', taxTerm: 'VAT' },
  { code: 'JE', name: 'Jersey' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'JO', name: 'Jordan' },
  { code: 'JP', name: 'Japan', taxTerm: 'Consumption Tax' },
  { code: 'KE', name: 'Kenya', taxTerm: 'VAT' },
  { code: 'KG', name: 'Kyrgyzstan' },
  { code: 'KH', name: 'Cambodia' },
  { code: 'KI', name: 'Kiribati' },
  { code: 'KM', name: 'Comoros' },
  { code: 'KN', name: 'St. Kitts & Nevis' },
  { code: 'KP', name: 'North Korea' },
  { code: 'KR', name: 'South Korea', taxTerm: 'VAT' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'KY', name: 'Cayman Islands' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'LA', name: 'Laos' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'LC', name: 'St. Lucia' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'LR', name: 'Liberia' },
  { code: 'LS', name: 'Lesotho' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LY', name: 'Libya' },
  { code: 'MA', name: 'Morocco' },
  { code: 'MC', name: 'Monaco' },
  { code: 'MD', name: 'Moldova' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'MF', name: 'St. Martin' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'MH', name: 'Marshall Islands' },
  { code: 'MK', name: 'North Macedonia' },
  { code: 'ML', name: 'Mali' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'MN', name: 'Mongolia' },
  { code: 'MO', name: 'Macao' },
  { code: 'MP', name: 'Northern Mariana Islands' },
  { code: 'MQ', name: 'Martinique' },
  { code: 'MR', name: 'Mauritania' },
  { code: 'MS', name: 'Montserrat' },
  { code: 'MT', name: 'Malta' },
  { code: 'MU', name: 'Mauritius' },
  { code: 'MV', name: 'Maldives' },
  { code: 'MW', name: 'Malawi' },
  { code: 'MX', name: 'Mexico', taxTerm: 'VAT' },
  { code: 'MY', name: 'Malaysia', taxTerm: 'Sales Tax' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'NA', name: 'Namibia' },
  { code: 'NC', name: 'New Caledonia' },
  { code: 'NE', name: 'Niger' },
  { code: 'NF', name: 'Norfolk Island' },
  { code: 'NG', name: 'Nigeria', taxTerm: 'VAT' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'NL', name: 'Netherlands', taxTerm: 'VAT' },
  { code: 'NO', name: 'Norway', taxTerm: 'VAT' },
  { code: 'NP', name: 'Nepal' },
  { code: 'NR', name: 'Nauru' },
  { code: 'NU', name: 'Niue' },
  { code: 'NZ', name: 'New Zealand', taxTerm: 'GST' },
  { code: 'OM', name: 'Oman' },
  { code: 'PA', name: 'Panama' },
  { code: 'PE', name: 'Peru' },
  { code: 'PF', name: 'French Polynesia' },
  { code: 'PG', name: 'Papua New Guinea' },
  { code: 'PH', name: 'Philippines', taxTerm: 'VAT' },
  { code: 'PK', name: 'Pakistan', taxTerm: 'Sales Tax' },
  { code: 'PL', name: 'Poland', taxTerm: 'VAT' },
  { code: 'PM', name: 'St. Pierre & Miquelon' },
  { code: 'PN', name: 'Pitcairn Islands' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'PS', name: 'Palestine' },
  { code: 'PT', name: 'Portugal' },
  { code: 'PW', name: 'Palau' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'QA', name: 'Qatar' },
  { code: 'RE', name: 'Réunion' },
  { code: 'RO', name: 'Romania' },
  { code: 'RS', name: 'Serbia' },
  { code: 'RU', name: 'Russia' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'SA', name: 'Saudi Arabia', taxTerm: 'VAT' },
  { code: 'SB', name: 'Solomon Islands' },
  { code: 'SC', name: 'Seychelles' },
  { code: 'SD', name: 'Sudan' },
  { code: 'SE', name: 'Sweden', taxTerm: 'VAT' },
  { code: 'SG', name: 'Singapore', taxTerm: 'GST' },
  { code: 'SH', name: 'St. Helena' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'SJ', name: 'Svalbard & Jan Mayen' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SL', name: 'Sierra Leone' },
  { code: 'SM', name: 'San Marino' },
  { code: 'SN', name: 'Senegal' },
  { code: 'SO', name: 'Somalia' },
  { code: 'SR', name: 'Suriname' },
  { code: 'SS', name: 'South Sudan' },
  { code: 'ST', name: 'São Tomé & Príncipe' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'SX', name: 'Sint Maarten' },
  { code: 'SY', name: 'Syria' },
  { code: 'SZ', name: 'Eswatini' },
  { code: 'TC', name: 'Turks & Caicos Islands' },
  { code: 'TD', name: 'Chad' },
  { code: 'TG', name: 'Togo' },
  { code: 'TH', name: 'Thailand', taxTerm: 'VAT' },
  { code: 'TJ', name: 'Tajikistan' },
  { code: 'TK', name: 'Tokelau' },
  { code: 'TL', name: 'Timor-Leste' },
  { code: 'TM', name: 'Turkmenistan' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'TO', name: 'Tonga' },
  { code: 'TR', name: 'Türkiye' },
  { code: 'TT', name: 'Trinidad & Tobago' },
  { code: 'TV', name: 'Tuvalu' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'UG', name: 'Uganda' },
  { code: 'US', name: 'United States', taxTerm: 'Sales Tax' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'UZ', name: 'Uzbekistan' },
  { code: 'VA', name: 'Vatican City' },
  { code: 'VC', name: 'St. Vincent & Grenadines' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'VG', name: 'British Virgin Islands' },
  { code: 'VI', name: 'U.S. Virgin Islands' },
  { code: 'VN', name: 'Vietnam', taxTerm: 'VAT' },
  { code: 'VU', name: 'Vanuatu' },
  { code: 'WF', name: 'Wallis & Futuna' },
  { code: 'WS', name: 'Samoa' },
  { code: 'XK', name: 'Kosovo' },
  { code: 'YE', name: 'Yemen' },
  { code: 'YT', name: 'Mayotte' },
  { code: 'ZA', name: 'South Africa', taxTerm: 'VAT' },
  { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabwe' },
]
const COUNTRY_BY_CODE = new Map(GUIDED_COUNTRIES.map(c => [c.code, c]))
export const guidedCountryName = (code: string | null): string | undefined => COUNTRY_BY_CODE.get(code ?? '')?.name

// Fast lookup into the master chart. Clone-on-read via `m()` so callers never
// mutate the shared source rows.
const MASTER_BY_NUMBER = new Map(MASTER_CHART.map(e => [e.number, e]))
function m(number: string, patch?: Partial<GuidedEntry>): GuidedEntry {
  const base = MASTER_BY_NUMBER.get(number)
  if (!base) throw new Error(`guidedSetup: unknown master account ${number}`)
  return { ...base, ...patch }
}

// ============================================================================
// The baseline - the starter chart that keeps the books valid on its own: the
// five category scaffolds, the locked system accounts, and the everyday expense
// lines almost every business has. Skip the whole wizard and this is what you
// keep. The 13 expense lines are flattened directly under 6000 for visual
// simplicity; question additions introduce sub-headers as needed.
// ============================================================================
const BASELINE_REASON = 'Part of the starter chart every business needs.'
export const BASELINE_ENTRIES: GuidedEntry[] = [
  // Category scaffolds (structural headers, excluded from the "new accounts" count).
  m('1000'), m('1010'),
  m('2000'), m('2010'),
  m('3000'),
  m('4000'), m('4500'),
  m('6000'),
  // Assets
  m('1040'),
  // Equity - locked system accounts. Retained earnings is decision 101's pair
  // under one Retained Earnings summary (the statement line's own, see
  // GROUP_NAMES): Retained System Earnings, which only the year-end close posts
  // to, and Manual GL Transactions, where corrections made by hand go. Module
  // review, 2026-10-06 (COA-06): guided setup made one locked account.
  m('3900', { name: 'Retained System Earnings', system: true }),
  authored('3910', 'Manual GL Transactions', 'EQT', 'Retained earnings', '3000', 'Corrections to retained earnings made by hand, each with a written reason', { wizardTrigger: 'Always' }),
  m('3500', { system: true }),
  // Revenue
  m('4510'),
  m('4990', { name: 'Other Income' }),
  // Everyday expenses (renamed to plain language, flattened under 6000).
  m('6310', { name: 'Advertising & Marketing', parentNumber: '6000' }),
  m('6510', { name: 'Bank Fees', parentNumber: '6000' }),
  m('6060', { name: 'Contractor & Professional Fees', parentNumber: '6000' }),
  m('6500', { name: 'Insurance', parentNumber: '6000' }),
  m('6330', { name: 'Meals & Entertainment', parentNumber: '6000' }),
  m('6210', { name: 'Office Supplies & Software', parentNumber: '6000' }),
  m('6110', { name: 'Rent & Lease', parentNumber: '6000' }),
  m('6130', { name: 'Repairs & Maintenance', parentNumber: '6000' }),
  m('6800', { name: 'Subscriptions & Dues', parentNumber: '6000' }),
  m('6140', { name: 'Taxes & Licenses', parentNumber: '6000' }),
  m('6230', { name: 'Telephone & Internet', parentNumber: '6000' }),
  m('6320', { name: 'Travel', parentNumber: '6000' }),
  m('6120', { name: 'Utilities', parentNumber: '6000' }),
].map(e => ({ ...e, reason: e.reason ?? BASELINE_REASON }))

// ---- Addition fragments, one per answer. De-dup by number handles the
// overlaps, so a company that makes and resells gets the union and an account
// two answers both need is created once. Every account a question adds is named
// in that option's tooltip, and named the way the tooltip names it: the
// tooltip is the promise, and this is the chart it promises (Mahad, 2026-10-02).

// An account the master chart has no row for, numbered in a free slot of the
// band it belongs to.
function authored(
  number: string, name: string, type: MasterChartEntry['type'],
  statementClassification: StatementClassification, parentNumber: string,
  description: string, extra?: Partial<GuidedEntry>,
): GuidedEntry {
  return { number, name, type, statementClassification, parentNumber, posting: 'Posting', wizardTrigger: 'Optional', description, ...extra }
}

const PRODUCT_SALES = m('4010')

// Raw materials, work in process and finished goods under one Inventory
// summary, so the value of stock at each stage reads off the chart; the three
// costs that together are what a product costs to make; and the price
// variance, freight and adjustments that land on inventory.
const MANUFACTURING: GuidedEntry[] = [
  m('1200'), m('5000'),
  m('1210', { name: 'Raw Materials' }),
  m('1220', { name: 'Work in Process' }),
  m('1230', { name: 'Finished Goods' }),
  m('5010', { name: 'Direct Materials' }),
  m('5020', { name: 'Direct Labor' }),
  authored('5200', 'Manufacturing Overhead', 'EXP', 'Cost of goods sold', '5000', 'Factory costs such as utilities and equipment upkeep'),
  authored('5300', 'Purchase Price Variance', 'EXP', 'Cost of goods sold', '5000', 'The difference between the price expected for materials and the price paid'),
  m('5030', { name: 'Freight-In' }),
  m('5070', { name: 'Inventory Adjustments' }),
  PRODUCT_SALES,
]

// One Inventory account holding what goods cost until they sell, and the cost
// of goods sold line that receives it at the sale. A company that also makes
// things already has an Inventory summary, so its bought-in goods take a line
// under it rather than a second account called Inventory.
function resale(a: GuidedAnswers): GuidedEntry[] {
  const making = a.activities.includes('manufacture')
  return [
    making
      ? authored('1240', 'Merchandise Inventory', 'AST', 'Current asset', '1200', 'Goods bought to resell, at cost until they are sold')
      : m('1200', { name: 'Inventory', posting: 'Posting' }),
    m('5000'),
    authored('5005', 'Cost of Goods Sold', 'EXP', 'Cost of goods sold', '5000', 'The cost of goods sold, moved out of inventory when each sale happens'),
    m('5030', { name: 'Freight-In' }),
    authored('5080', 'Purchase Discounts', 'EXP', 'Cost of goods sold', '5000', 'Savings for paying vendors early', { isContra: true }),
    m('5070', { name: 'Inventory Adjustments' }),
    PRODUCT_SALES,
  ]
}

const SERVICES: GuidedEntry[] = [m('4020'), m('5000'), m('5100')]
const SUBSCRIPTIONS: GuidedEntry[] = [m('2400', { name: 'Deferred Revenue' }), m('4030')]
const CONTRACTS: GuidedEntry[] = [
  authored('1250', 'Contract Assets', 'AST', 'Current asset', '1010', 'Work done but not yet invoiced'),
  authored('2410', 'Contract Liabilities', 'LIA', 'Current liability', '2010', 'Amounts invoiced ahead of the work'),
  authored('1120', 'Retainage Receivable', 'AST', 'Current asset', '1010', 'The share of each customer payment held back until the job is finished'),
  authored('2040', 'Retainage Payable', 'LIA', 'Current liability', '2010', 'The share of each subcontractor payment held back until the job is finished'),
  m('4040'),
]

// The equity each US legal form sets up. A C corporation pays its own income
// tax, so it is the one form that also adds the tax accounts.
const COMMON_STOCK = m('3100')
const APIC = m('3120', { name: 'Additional Paid-in Capital' })
const OWNERSHIP: Record<GuidedOwnership, GuidedEntry[]> = {
  sole: [
    m('3010', { name: "Owner's Contributions" }),
    m('3020', { name: "Owner's Draws" }),
  ],
  /* A capital and a draws account for each partner, two partners by default
     (usability test, 2026-06-05; Outline 04). Module review, 2026-10-06
     (COA-15): one shared pair left the second partner to be added by hand. A
     third partner's pair is added on the next step, like any account. */
  partnership: [
    m('3030', { name: 'Partner 1 Capital' }),
    m('3040', { name: 'Partner 1 Draws', isContra: true }),
    { ...m('3030'), number: '3035', name: 'Partner 2 Capital' },
    { ...m('3040'), number: '3045', name: 'Partner 2 Draws', isContra: true },
  ],
  scorp: [COMMON_STOCK, APIC, m('3200')],
  ccorp: [
    COMMON_STOCK, APIC,
    m('3210', { name: 'Dividends Declared' }),
    m('8000'), m('8100'),
    m('2600', { name: 'Income Taxes Payable' }),
  ],
}

// Authored rather than mined: the clearing account for goods received before
// their invoice. Its number is the one purchasing and the module checklist
// look it up by (GUIDED_CONTROL_NUMBERS.apAccrual).
const ACCRUED_PURCHASES = authored('2025', 'AP Accrual', 'LIA', 'Current liability', '2010', 'What is owed for goods received before the vendor’s invoice arrives')

/* Tailored setup is US-only today: the tooltips, the legal forms and the
   accounts they add are written to US GAAP. Any other country gets the general
   chart and skips the two questions only a US business can answer. */
export const isUsBusiness = (a: GuidedAnswers) => a.country === 'US'
const usOnly = (a: GuidedAnswers) => isUsBusiness(a)

export interface GuidedOption {
  value: string
  label: string
  description?: string
  // Plain-English explainer: what the term means and what picking it changes.
  // Every option carries one, because the wizard asks about things a first-time
  // bookkeeper has no reason to already know.
  explainer?: string
  /* An answer that adds accounts shows them on its hover card, each with its
     own description (see `optionAdditions`), and nothing else. The explainer
     is the card of an answer that adds nothing. The closing "why" sentence
     each answer used to carry came off on 2026-10-07 (Mahad: *"we can only show
     the accounts that will be added"*). */
}

type GuidedText = string | ((a: GuidedAnswers) => string)
export const guidedText = (t: GuidedText, a: GuidedAnswers): string => (typeof t === 'function' ? t(a) : t)

export interface GuidedQuestion {
  id: GuidedQuestionId
  field: keyof GuidedAnswers
  title: GuidedText
  // The helper line under the heading. Omitted where the heading is the whole
  // question.
  subtitle?: GuidedText
  // The "why" for a question whose answer has no option cards to hang one off:
  // the country list.
  explainer?: string
  options: GuidedOption[]
  reason: (a: GuidedAnswers) => string
  additions: (a: GuidedAnswers) => GuidedEntry[]
  skipAdditions?: (a: GuidedAnswers) => GuidedEntry[]
  // The answer is a list, and picking an option toggles it.
  multi?: boolean
  // A list option that clears every other choice, and is cleared by any of them.
  exclusive?: string
  // Rendered as a searchable list rather than option cards.
  input?: 'country'
  // Continue waits for an answer.
  required?: boolean
  // Asked only when this holds. A question not asked adds nothing.
  shownWhen?: (a: GuidedAnswers) => boolean
  // A message under the answer, stated rather than warned.
  notice?: (a: GuidedAnswers) => string | null
  /* A way into How it works, under the question, for a choice a hover card
     cannot do justice to. The section is a heading in the guided guide. */
  learnMore?: { label: string; section: string }
}

/** The accounts one answer adds on its own, for its hover card: the posting
 *  accounts, each once. The summaries they sit under are structure the wizard
 *  supplies, not something the answer asked for. Read with the rest of the
 *  answers as they stand, so an answer whose accounts depend on another (the
 *  country, say) lists what it will really add. */
export function optionAdditions(question: GuidedQuestion, value: string, answers: GuidedAnswers): GuidedEntry[] {
  const solo = { ...answers, [question.field]: question.multi ? [value] : value } as GuidedAnswers
  const seen = new Set<string>()
  return question.additions(solo).filter(e => e.posting === 'Posting' && !seen.has(e.number) && !!seen.add(e.number))
}

export const GUIDED_QUESTIONS: GuidedQuestion[] = [
  {
    id: 'country', field: 'country',
    input: 'country',
    title: 'Where is your business based?',
    explainer: 'Your chart is tailored to US accounting standards (GAAP, the Generally Accepted Accounting Principles US businesses follow). If you choose another country, you get a general-purpose chart that you can adjust on Add your accounts.',
    options: [],
    reason: () => 'Recorded on your company profile.',
    additions: () => [],
    notice: a => a.country && !isUsBusiness(a)
      ? "Our tailored setup is currently only available for US businesses. You can still answer the questions, and we'll create a general chart for you. Questions we don't have tailored support for, like ownership and sales tax, will be skipped."
      : null,
  },
  {
    id: 'activities', field: 'activities',
    multi: true,
    title: 'What does your business do?',
    // Mahad's copy, 2026-10-08.
    subtitle: "Select all that apply, and we'll add the accounts each activity needs.",
    options: [
      {
        value: 'manufacture', label: 'Manufacture products',
        description: 'You turn raw materials into finished goods',
        explainer: 'Adds three inventory accounts so you can see the value of stock at each stage: Raw Materials (materials not yet used), Work in Process (products partly made) and Finished Goods (products ready to sell). Adds three cost of goods sold accounts, which together show what each product really costs to make: Direct Materials, Direct Labor and Manufacturing Overhead (factory costs such as utilities and equipment upkeep). Also adds Purchase Price Variance (the difference between the price you expected to pay for materials and the price you paid), Freight-In (shipping costs on purchases, added to inventory cost) and Inventory Adjustments (for counts, damage and write-downs).',
      },
      {
        value: 'resell', label: 'Resell products you buy',
        description: 'Wholesale, distribution, retail or e-commerce',
        explainer: 'Adds Inventory, which holds the cost of goods you’ve bought until you sell them, and Cost of Goods Sold, which receives that cost when the sale happens, so each sale shows its true margin. Also adds Freight-In (shipping costs on purchases, added to inventory cost), Purchase Discounts (savings for paying vendors early) and Inventory Adjustments (for counts, shrinkage and damaged goods).',
      },
      {
        value: 'services', label: 'Provide services',
        description: 'Consulting, repair, installation or professional work',
        explainer: 'Adds Service Revenue, kept separate from product sales so you can see what each line of business earns, and Cost of Services, which holds the labor and materials used to deliver the work.',
      },
      {
        value: 'subscriptions', label: 'Sell subscriptions or prepaid plans',
        description: 'Software, memberships or maintenance contracts',
        explainer: 'Adds Deferred Revenue and Subscription Revenue. Under GAAP’s revenue rule (ASC 606), you count income when you deliver what the customer paid for, not when the money arrives. A customer who pays $1,200 upfront for a year’s plan has bought 12 months of service. The $1,200 starts in Deferred Revenue, a liability because you still owe the service, and $100 moves to Subscription Revenue each month as you deliver.',
      },
      {
        value: 'construction', label: 'Work on long-term contracts',
        description: 'Construction, installation or projects billed in stages',
        explainer: 'Adds the accounts that keep billing and earned income in step on jobs that run for months. Under GAAP’s revenue rule (ASC 606), income on these jobs is counted as the work progresses, which often differs from what you’ve invoiced. Contract Assets hold work you’ve done but not yet invoiced. Contract Liabilities hold amounts you’ve invoiced ahead of the work. Retainage Receivable and Retainage Payable hold the share of each payment held back until the job is finished, either by your customer or by you from a subcontractor. Contract Revenue records the income earned.',
      },
    ],
    reason: () => 'Adds the income and cost accounts your kind of work needs.',
    additions: a => {
      const out: GuidedEntry[] = []
      if (a.activities.includes('manufacture')) out.push(...MANUFACTURING)
      if (a.activities.includes('resell')) out.push(...resale(a))
      if (a.activities.includes('services')) out.push(...SERVICES)
      if (a.activities.includes('subscriptions')) out.push(...SUBSCRIPTIONS)
      if (a.activities.includes('construction')) out.push(...CONTRACTS)
      return out
    },
    skipAdditions: () => [m('4010', { name: 'Sales' })],
  },
  {
    id: 'method', field: 'method',
    required: true,
    title: 'Which accounting method does your business use?',
    /* Decision 33: explain both and warn that the choice is hard to reverse.
       Module review, 2026-10-06 (COA-25). */
    // Mahad's copy, 2026-10-08. The method is saved on the company at publish.
    subtitle: "This doesn't add any accounts. We save this information because it decides when your income and expenses are recorded.",
    /* The difference is more than a hover card can hold - who uses which, and
       when US law decides for you. Design review, 2026-10-02 - Eli: *"give a
       basic overview here and then definitely guide them to go to how it works
       to learn more."* */
    learnMore: { label: 'When to use each method', section: 'Which accounting method does your business use?' },
    options: [
      {
        value: 'accrual', label: 'Accrual basis',
        description: 'Record income when you earn it and expenses when you incur them',
        explainer: 'Income counts when you invoice or deliver, and costs when you receive the goods or the bill, even if the money moves later. Example: you invoice a customer in March and they pay in April. The income counts in March.',
      },
      {
        value: 'cash', label: 'Cash basis',
        description: 'Record income when money comes in and expenses when money goes out',
        explainer: 'Income counts when the customer’s money arrives, and costs when you pay them. Example: you invoice a customer in March and they pay in April. The income counts in April.',
      },
    ],
    reason: () => 'Sets when income and expenses are recorded.',
    // Decides when things are recorded, not which accounts exist: neither
    // tooltip promises an account.
    additions: () => [],
  },
  {
    id: 'ownership', field: 'ownership',
    shownWhen: usOnly,
    title: 'How is your business legally set up?',
    subtitle: 'Your legal structure decides how money the owners put in and take out is recorded.',
    options: [
      {
        value: 'sole', label: 'Sole proprietorship or single-member LLC',
        description: 'One owner, not taxed as a corporation',
        explainer: 'Adds Owner’s Contributions, for money you put into the business, and Owner’s Draws, for money you take out for yourself. Draws reduce your equity in the business. They are not a business expense, so they don’t lower your profit.',
      },
      {
        value: 'partnership', label: 'Partnership or multi-member LLC',
        description: 'Two or more owners',
        explainer: 'Adds a capital account and a draws account for each partner, two partners to start, so each owner’s investment and withdrawals are tracked separately. Add a pair for any other partner on Add your accounts. Draws reduce that partner’s equity. They are not a business expense, so they don’t lower your profit.',
      },
      {
        value: 'scorp', label: 'S corporation',
        description: 'A corporation or LLC that has chosen S corporation tax status',
        explainer: 'Adds Common Stock (the value of shares issued to owners), Additional Paid-in Capital (money owners paid in above that value) and Shareholder Distributions (profits paid out to owners). Distributions reduce equity. They are not a business expense, so they don’t lower your profit.',
      },
      {
        value: 'ccorp', label: 'C corporation',
        description: 'Taxed as a corporation',
        explainer: 'Adds Common Stock (the value of shares issued to owners), Additional Paid-in Capital (money owners paid in above that value) and Dividends Declared (profits the company has approved to pay to shareholders). Because a C corporation pays its own income tax, it also adds Income Tax Expense and Income Taxes Payable.',
      },
    ],
    reason: () => 'Matches how money the owners put in and take out is recorded.',
    additions: a => (a.ownership ? OWNERSHIP[a.ownership] : []),
    skipAdditions: () => OWNERSHIP.sole,
  },
  {
    id: 'customers', field: 'customers',
    multi: true,
    title: 'How do customers pay you?',
    subtitle: 'Select all that apply.',
    options: [
      {
        value: 'invoice', label: 'We invoice and get paid later',
        description: 'For example, payment due in 30 days',
        explainer: 'Adds Accounts Receivable, which tracks what each customer owes you, and Customer Deposits, which holds advance payments until you deliver. Also adds Allowance for Credit Losses. GAAP’s credit loss rule (ASC 326) asks you to estimate how much of what customers owe you won’t be collected and set that amount aside, so your balance sheet shows what you realistically expect to receive. For example, if customers owe $100,000 and you expect $2,000 won’t be paid, you set aside $2,000.',
      },
      {
        value: 'pos', label: 'They pay at the time of sale',
        description: 'Card, cash or online checkout',
        explainer: 'Adds Payments to Deposit, which holds payments you’ve received but haven’t yet seen in your bank account, such as card sales that settle a day or two later. Adds Cash on Hand for cash kept on site, and Merchant Fees for the charges card processors deduct from each sale.',
      },
    ],
    reason: () => 'Tracks what customers owe you and payments waiting to clear.',
    additions: a => {
      const out: GuidedEntry[] = []
      if (a.customers.includes('invoice')) out.push(m('1100'), m('2450'), m('1110', { name: 'Allowance for Credit Losses', isContra: true }))
      if (a.customers.includes('pos')) {
        out.push(
          m('1050', { name: 'Payments to Deposit' }),
          authored('1045', 'Cash on Hand', 'AST', 'Current asset', '1010', 'Cash kept on site'),
          m('5000'), m('5060', { name: 'Merchant Fees' }),
        )
      }
      return out
    },
    skipAdditions: () => [m('1100'), m('1050', { name: 'Payments to Deposit' })],
  },
  {
    id: 'vendors', field: 'vendors',
    multi: true,
    title: 'How do you pay vendors?',
    subtitle: 'Select all that apply.',
    options: [
      {
        value: 'invoice', label: 'Vendors invoice you and you pay later',
        description: 'For example, payment due in 30 days',
        explainer: 'Adds Accounts Payable, which tracks what you owe each vendor, and Vendor Prepayments, for deposits you pay before goods arrive. Also adds AP Accrual, which records what you owe for goods you’ve received when the vendor’s invoice hasn’t arrived yet. Accrual accounting (GAAP) records a cost when you receive the goods, not when the invoice comes, so this account keeps your costs and amounts owed accurate in the meantime.',
      },
      {
        value: 'card', label: 'By company credit card',
        description: 'You pay at the time of purchase',
        explainer: 'Adds Credit Card Payable, which tracks what you owe the card company until you pay the statement. Each purchase is recorded on the day you make it, so your costs stay up to date.',
      },
    ],
    reason: () => 'Tracks what you owe vendors and the card company.',
    additions: a => {
      const out: GuidedEntry[] = []
      if (a.vendors.includes('invoice')) {
        out.push(
          m('2020'),
          authored('1350', 'Vendor Prepayments', 'AST', 'Current asset', '1010', 'Deposits paid to vendors before goods arrive'),
          { ...ACCRUED_PURCHASES },
        )
      }
      if (a.vendors.includes('card')) out.push(m('2030'))
      return out
    },
    skipAdditions: () => [m('2020')],
  },
  {
    id: 'currency', field: 'currency',
    // Mahad's copy, 2026-10-08.
    title: 'Do you deal in multiple currencies?',
    subtitle: "Select Yes if you buy, sell, or hold money in more than one currency. We'll add the accounts to track gains and losses when exchange rates change.",
    options: [
      {
        value: 'yes', label: 'Yes, we use other currencies',
        explainer: 'Adds Realized Foreign Exchange Gain or Loss and Unrealized Foreign Exchange Gain or Loss. When you invoice or pay in another currency, the amount in US dollars can change between the invoice date and the payment date. GAAP\u2019s foreign currency rule (ASC 830) asks you to record that difference in your profit. If the payment has happened, it goes to the realized account. If the invoice is still open at month end and you revalue it at that day\u2019s exchange rate, it goes to the unrealized account. For example, you invoice \u20ac10,000 when \u20ac1 is worth $1.10, so $11,000, and the customer pays when \u20ac1 is worth $1.08, so $10,800. The $200 difference is recorded as a realized loss. You can add a bank account in each foreign currency on Add your accounts.',
      },
      {
        value: 'no', label: 'No, just one currency',
        explainer: 'No foreign exchange accounts are added. If you start doing business in another currency later, you can add these accounts at any time.',
      },
    ],
    reason: () => 'Records the gain or loss when an exchange rate moves before a foreign-currency amount settles.',
    // One account each for realized and unrealized, carrying gains and losses
    // alike, as the tooltip names them.
    additions: a => (a.currency === 'yes'
      ? [
          m('4520', { name: 'Realized Foreign Exchange Gain or Loss' }),
          m('4530', { name: 'Unrealized Foreign Exchange Gain or Loss' }),
        ]
      : []),
  },
  {
    id: 'tax', field: 'tax',
    shownWhen: usOnly,
    title: 'Do you collect sales tax from customers?',
    options: [
      {
        value: 'yes', label: 'Yes, we charge sales tax',
        explainer: 'Adds Sales Tax Payable. The sales tax you collect belongs to the state, so it’s recorded as money you owe, not as income. It stays in this account until you pay it to the state. OMNE records the tax on each invoice line but doesn’t calculate it for you.',
      },
      {
        value: 'no', label: 'No, we don’t charge sales tax',
        explainer: 'No sales tax account is added. If you start collecting sales tax later, you can add a Sales Tax Payable account at any time.',
      },
    ],
    reason: () => 'Sales tax you collect is money you owe, kept separate from income.',
    additions: a => (a.tax === 'yes' ? [m('2300', { name: 'Sales Tax Payable' })] : []),
  },
  {
    id: 'payroll', field: 'payroll',
    title: 'Do you have employees on payroll?',
    options: [
      {
        value: 'yes', label: 'Yes',
        explainer: 'Adds Wages Expense for employee pay, Payroll Tax Expense for the taxes the business pays on wages, and Payroll Liabilities for amounts you’ve held back from paychecks, such as income tax and Social Security, until you pay them to the government. If you manufacture products, wages for production work are recorded in Direct Labor instead, so they become part of what each product costs.',
      },
      {
        value: 'no', label: 'Not yet',
        explainer: 'No payroll accounts are added. When you hire your first employee, you can add them at any time.',
      },
    ],
    reason: () => 'Splits payroll costs from payroll money you’re holding to pay out.',
    additions: a => (a.payroll === 'yes'
      ? [
          m('6020', { name: 'Wages Expense', parentNumber: '6000' }),
          m('6040', { parentNumber: '6000' }),
          m('2200', { posting: 'Posting' }),
        ]
      : []),
  },
  {
    id: 'assets', field: 'assets',
    multi: true,
    exclusive: 'none',
    title: 'Do you own or lease long-term assets, or have business loans?',
    subtitle: 'Select all that apply. Anything your business uses for more than a year is recorded as an asset and expensed gradually, not all at once.',
    options: [
      {
        value: 'own', label: 'We own equipment, vehicles or property',
        explainer: 'Adds asset accounts for Machinery and Equipment, Vehicles, and Furniture and Fixtures. Also adds Accumulated Depreciation and Depreciation Expense. Depreciation spreads an asset’s cost over the years you use it, so each year’s profit carries its fair share. For example, a $50,000 machine expected to last 10 years adds $5,000 of expense each year instead of $50,000 in the year you bought it.',
      },
      {
        value: 'lease', label: 'We lease equipment or space',
        explainer: 'Adds Right-of-Use Assets and Lease Liabilities. The lease cost itself posts to the Rent & Lease account every chart starts with. Under GAAP’s lease rule (ASC 842), most leases longer than 12 months go on your balance sheet. The right to use the space or equipment is recorded as an asset, and the payments you’ve committed to are recorded as a liability. Lease Liabilities is split into the amount due within the next year and the amount due after that.',
      },
      {
        value: 'loans', label: 'We have loans or financing',
        explainer: 'Adds Notes Payable, split into the amount due within the next year and the amount due after that, so your balance sheet shows near-term debt separately. Also adds Interest Expense for the cost of borrowing. Only the interest part of each loan payment is an expense. The rest pays down the loan.',
      },
      {
        value: 'none', label: 'None of these',
        explainer: 'Nothing is added. You can add asset, lease or loan accounts later if you need them.',
      },
    ],
    reason: () => 'Long-term assets, leases and loans are tracked over time, not expensed at once.',
    additions: a => {
      const out: GuidedEntry[] = []
      if (a.assets.includes('own')) {
        out.push(
          m('1500'),
          m('1540', { name: 'Machinery and Equipment' }),
          m('1550'),
          m('1560', { name: 'Furniture and Fixtures' }),
          m('1545', { name: 'Accumulated Depreciation', isContra: true }),
          m('6600'),
        )
      }
      if (a.assets.includes('lease')) {
        out.push(
          m('1500'),
          authored('1580', 'Right-of-Use Assets', 'AST', 'Non-current asset', '1500', 'The right to use leased space or equipment'),
          authored('2510', 'Lease Liabilities - Current', 'LIA', 'Current liability', '2010', 'Lease payments due within the next year'),
          m('2700'),
          m('2730', { name: 'Lease Liabilities - Non-current' }),
          /* No Lease Expense: the starter chart's Rent & Lease (6110) is that
             account, and a second one beside it split one cost across two
             (module review, 2026-10-06, COA-16). */
        )
      }
      if (a.assets.includes('loans')) {
        out.push(
          m('2500', { name: 'Notes Payable - Current' }),
          m('2700'),
          m('2710', { name: 'Notes Payable - Non-current' }),
          m('8000'),
          m('8010'),
        )
      }
      return out
    },
  },
]

const QUESTION_BY_ID = new Map(GUIDED_QUESTIONS.map(q => [q.id, q]))

// What to record as the company's industry. Derived from the activities rather
// than asked twice.
const ACTIVITY_LABELS: Record<GuidedActivity, string> = {
  manufacture: 'Manufacturing',
  resell: 'Retail and distribution',
  services: 'Services',
  subscriptions: 'Software and subscriptions',
  construction: 'Construction',
}
export function guidedIndustryLabel(a: GuidedAnswers): string | undefined {
  if (!a.activities.length) return undefined
  return a.activities.map(x => ACTIVITY_LABELS[x]).join(', ')
}

// The full guided chart for a set of answers: baseline ∪ each answered
// question's additions, de-duplicated by number (first occurrence wins) and
// sorted numerically (parents precede children under this hierarchical scheme).
// When `applyDefaults` is set, skipped questions contribute their safe default -
// used only at publish time, not during the live preview.
/** The questions this reader is asked, in order: the US-only two drop out for
    anywhere else. */
export const visibleGuidedQuestions = (a: GuidedAnswers): GuidedQuestion[] =>
  GUIDED_QUESTIONS.filter(q => !q.shownWhen || q.shownWhen(a))

export function computeGuidedChart(answers: GuidedAnswers, applyDefaults = false): GuidedEntry[] {
  const collected: GuidedEntry[] = [...BASELINE_ENTRIES]
  // A question not asked adds nothing, even if it was answered before the
  // country changed.
  for (const q of visibleGuidedQuestions(answers)) {
    const answered = isGuidedAnswered(answers[q.field])
    let adds: GuidedEntry[] = []
    if (answered) adds = q.additions(answers)
    else if (applyDefaults && q.skipAdditions) adds = q.skipAdditions(answers)
    for (const e of adds) {
      collected.push({ ...e, addedBy: q.id, reason: e.reason ?? q.reason(answers) })
    }
  }
  const seen = new Set<string>()
  const deduped = collected.filter(e => (seen.has(e.number) ? false : (seen.add(e.number), true)))
  return deduped.sort((a, b) => Number(a.number) - Number(b.number))
}

// The accounts a single question contributed: the entries present with the
// current answers that would disappear if this question were unanswered.
// Compared by number (stable identity). Powers the focused right pane.
export function guidedStepDiff(qId: GuidedQuestionId, answers: GuidedAnswers): GuidedEntry[] {
  const q = QUESTION_BY_ID.get(qId)
  if (!q) return []
  const after = computeGuidedChart(answers, false)
  const cleared = Array.isArray(answers[q.field]) ? [] : null
  const before = computeGuidedChart({ ...answers, [q.field]: cleared }, false)
  const beforeNums = new Set(before.map(e => e.number))
  return after.filter(e => !beforeNums.has(e.number))
}

// Project a guided entry into a full Account for staging/preview. Mirrors the
// scratch/wizard projection in Setup.tsx: local `acct_${number}` ids, inferred
// glAccountType / normalBalance, and the guided-specific setupNote + trigger +
// masterChartRef + pendingReview carried through to publish.
export function guidedEntryToAccount(
  e: GuidedEntry,
  ctx: { baseCurrency: string; fiscalYearStart: string },
): Account {
  const code = TYPE_TO_CODE[e.type]
  return {
    id: `acct_${e.number}`,
    // Staged, not created: see the note on the import's preview builder. The
    // internal id is issued when the wizard publishes, not while it previews.
    internalId: '',
    accountNumber: e.number,
    accountName: e.name,
    accountType: code,
    statementClassification: e.statementClassification,
    glAccountType: e.posting,
    accountRole: e.posting === 'Posting' ? MASTER_CHART_ROLES[e.number] : undefined,
    isPosting: e.posting === 'Posting',
    normalBalance: ['AST', 'EXP'].includes(code) ? 'Debit' : 'Credit',
    currencyCode: e.currency ?? ctx.baseCurrency,
    status: 'Active',
    effectiveDate: ctx.fiscalYearStart,
    postingRestrictions: {},
    defaultDimensionValues: [],
    isContra: e.isContra ?? false,
    parentId: e.parentNumber ? `acct_${e.parentNumber}` : null,
    subsidiaryId: 'sub_main',
    balance: 0,
    hasTransactions: false,
    description: e.description,
    setupNote: e.reason,
    wizardTrigger: e.addedBy,
    masterChartRef: e.number,
    pendingReview: true,
    createdAt: '', updatedAt: '', createdBy: '', updatedBy: '',
  }
}

/* The summary a guided chart files each statement line under. Named the way the
   line prints, so the chart reads as the statements will. */
const GROUP_NAMES: Record<StatementClassification, string> = {
  'Current asset': 'Current Assets',
  'Non-current asset': 'Non-Current Assets',
  'Current liability': 'Current Liabilities',
  'Non-current liability': 'Non-Current Liabilities',
  'Contributed capital': 'Contributed Capital',
  'Retained earnings': 'Retained Earnings',
  'Distributions': 'Distributions',
  'Operating revenue': 'Operating Revenue',
  'Other income': 'Other Income',
  'Cost of goods sold': 'Cost of Goods Sold',
  'Operating expense': 'Operating Expenses',
  'Other expense': 'Other Expenses',
  'Income tax expense': 'Income Tax',
}

/* The summary a set of related accounts rolls up into inside its statement
   line, named as the master chart names it. Mahad, 2026-10-02: *"The guided
   setup should also create summary account for you in the next step."* So the
   preview arrives structured: Inventory over its stages, and operating expenses
   in Payroll and Benefits, Occupancy, Office and Admin, Sales and Marketing and
   Professional Services, rather than one long flat list. A group is made only
   where it would hold two accounts or more; a summary of one is just a heading. */
const SUBGROUPS: { number: string; name: string; members: string[] }[] = [
  { number: '1200', name: 'Inventory', members: ['1210', '1220', '1230', '1240'] },
  { number: '6010', name: 'Payroll & Benefits', members: ['6020', '6040'] },
  { number: '6100', name: 'Occupancy', members: ['6110', '6120', '6130', '6140'] },
  { number: '6200', name: 'Office & Admin', members: ['6210', '6230'] },
  { number: '6300', name: 'Sales & Marketing', members: ['6310', '6320', '6330'] },
  { number: '6400', name: 'Professional Services', members: ['6060'] },
]
const SUBGROUP_OF = new Map(SUBGROUPS.flatMap(g => g.members.map(n => [n, g] as const)))

/* The step between numbers that fits `count` accounts after a start number and
   before `end`: tens where there is room, then fives, then ones. null when they
   do not fit at all. */
function stepFor(count: number, start: number, end: number): number | null {
  for (const step of [10, 5, 1]) if (start + step * count <= end) return step
  return null
}

// The staged chart the preview step edits: the five category summary anchors,
// a summary for every statement line the answers put an account on, the
// summaries related accounts roll up into inside a line (SUBGROUPS), and every
// guided posting account under the summary it belongs to.
//
// Numbered at the width the reader chose on the first step, not at the master
// chart's own four-digit numbers - the preview used to put 10000 ASSETS over
// 1040 Petty Cash. Laid out as the cascade Omne uses for any chart it builds
// (design review, 2026-09-24): each category reserves its whole block, each line
// summary under it the next block one zero smaller, in statement order, and a
// group inside a line the next block smaller again. A line's own accounts step
// through the start of its block, ahead of its first group.
//
// Every one of these is a default. The reader can renumber, rename, move or
// remove any row on the preview step, and the ranges are edited on the summaries
// like anyone else's. The master number stays on each account as masterChartRef,
// which is what the locks and the module checklist read.
export function guidedPreviewAccounts(
  scheme: NumberingScheme,
  answers: GuidedAnswers,
  ctx: { baseCurrency: string; fiscalYearStart: string },
): Account[] {
  const width = Math.max(3, scheme.segments[0]?.length ?? DEFAULT_NUMBER_WIDTH)
  const anchors = seedCategoryAccounts(scheme, { currencyCode: ctx.baseCurrency, effectiveDate: ctx.fiscalYearStart })
  const entries = computeGuidedChart(answers, true).filter(e => e.posting === 'Posting')
  const out: Account[] = [...anchors]

  const summary = (anchor: Account, id: string, name: string, cls: StatementClassification, parentId: string, block: { start: number; end: number }, masterRef?: string): Account => ({
    ...anchor,
    id,
    internalId: '',
    accountNumber: String(block.start),
    accountName: name,
    statementClassification: cls,
    parentId,
    numberRangeStart: block.start,
    numberRangeEnd: block.end,
    description: undefined,
    ...(masterRef ? { masterChartRef: masterRef } : {}),
  })
  const place = (members: GuidedEntry[], parentId: string, start: number, end: number) => {
    const step = stepFor(members.length, start, end) ?? 1
    members.forEach((e, i) => {
      out.push({ ...guidedEntryToAccount(e, ctx), accountNumber: String(start + step * (i + 1)), parentId })
    })
  }

  for (const anchor of anchors) {
    const code = anchor.accountType
    // The block the anchor reserves - the one setup was given, or the width's.
    const catBlock = anchor.numberRangeStart != null && anchor.numberRangeEnd != null
      ? { start: anchor.numberRangeStart, end: anchor.numberRangeEnd }
      : categoryBlock(CATEGORY_FIRST_DIGIT[code], width)
    let slot = 0
    for (const cls of CLASSIFICATIONS_BY_CATEGORY[code]) {
      const members = entries.filter(e => TYPE_TO_CODE[e.type] === code && e.statementClassification === cls)
      if (!members.length) continue
      slot++
      const block = childBlock(catBlock, slot)
      if (!block) break
      const lineId = `seed_grp_${code}_${slot}`
      out.push(summary(anchor, lineId, GROUP_NAMES[cls], cls, anchor.id, block))

      // The groups this line's accounts fill, in the order they are listed.
      const groups = SUBGROUPS
        .map(g => ({ g, held: members.filter(e => SUBGROUP_OF.get(e.number) === g) }))
        .filter(x => x.held.length >= 2)
      const grouped = new Set(groups.flatMap(x => x.held))
      const direct = members.filter(e => !grouped.has(e))
      const firstGroup = groups.length ? childBlock(block, 1) : null
      // Room for the line's own accounts ahead of its first group, and a block
      // for every group. A width too short for either files the line flat.
      const fits = !groups.length || (
        !!firstGroup
        && stepFor(direct.length, block.start, firstGroup.start - 1) !== null
        && groups.every((_, k) => childBlock(block, k + 1))
      )
      if (!fits) { place(members, lineId, block.start, block.end); continue }

      place(direct, lineId, block.start, firstGroup ? firstGroup.start - 1 : block.end)
      groups.forEach(({ g, held }, k) => {
        const sub = childBlock(block, k + 1)!
        const subId = `seed_sub_${g.number}`
        out.push(summary(anchor, subId, g.name, cls, lineId, sub, g.number))
        place(held, subId, sub.start, sub.end)
      })
    }
  }
  return out
}

// The numbers of the locked system accounts the preview must not let the user
// rename or remove.
export const GUIDED_LOCKED_NUMBERS = new Set(
  BASELINE_ENTRIES.filter(e => e.system).map(e => e.number),
)

// Company-level control accounts the guided wizard wires up automatically; used
// to derive module-setup readiness. Keyed by the master number.
export const GUIDED_CONTROL_NUMBERS = {
  apAccrual: '2025',
  salesTaxPayable: '2300',
  paymentsToDeposit: '1050',
} as const
