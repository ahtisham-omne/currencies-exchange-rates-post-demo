// Mock data the simulated bank feed returns once the faux-Plaid sign-in
// completes - ported from Cash Management (`data/cash-management/mockBankSync.ts`)
// so the "Connect a bank feed" flow surfaces the same accounts here. Accounts
// are synthesised deterministically per institution so a walkthrough shows the
// same numbers on each run.

export type FeedAccountSubtype = 'checking' | 'savings' | 'money_market' | 'operating'

export interface FeedAccount {
  id: string
  displayName: string
  subtype: FeedAccountSubtype
  accountNumberMasked: string
  currencyCode: string
  currentBalance: number
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

const SUBTYPE_NAMES: Record<FeedAccountSubtype, string[]> = {
  checking: ['Business Checking', 'Operating Checking', 'Primary Checking'],
  savings: ['Business Savings', 'Reserve Savings', 'High-Yield Savings'],
  money_market: ['Money Market Premier', 'Money Market Plus'],
  operating: ['Operating Account', 'Main Operating', 'Treasury'],
}

const SUBTYPE_LABEL: Record<FeedAccountSubtype, string> = {
  checking: 'Checking',
  savings: 'Savings',
  money_market: 'Money Market',
  operating: 'Operating',
}

export function getFeedSubtypeLabel(subtype: FeedAccountSubtype): string {
  return SUBTYPE_LABEL[subtype]
}

// Return the accounts a given institution holds. Count (2–4), subtypes, masked
// numbers, and balances all derive deterministically from the institution id.
// When `matchLast4` is passed, the first account's masked number is forced to
// that last-4 so the wizard's last-4 match always resolves to a real row.
export function getInstitutionFeedAccounts(institutionId: string, matchLast4?: string): FeedAccount[] {
  const seed = hash(institutionId)
  const count = 2 + (seed % 3)
  const subtypeOrder: FeedAccountSubtype[] = ['checking', 'savings', 'money_market', 'operating']
  const out: FeedAccount[] = []
  for (let i = 0; i < count; i++) {
    const subtype = subtypeOrder[(seed + i) % subtypeOrder.length]
    const names = SUBTYPE_NAMES[subtype]
    const displayName = names[(seed + i * 7) % names.length]
    const last4 = String((seed + i * 137) % 10000).padStart(4, '0')
    const balanceBase = i === 0 ? 50_000 : 10_000
    const balance = balanceBase + ((seed + i * 31) % 80) * 1_250
    const currencyCode = institutionId === 'hsbc-usa' && i === count - 1 ? 'EUR' : 'USD'
    out.push({
      id: `${institutionId}-acc-${i}`,
      displayName,
      subtype,
      accountNumberMasked: `****${last4}`,
      currencyCode,
      currentBalance: Number(balance.toFixed(2)),
    })
  }
  if (matchLast4 && out.length > 0) {
    out[0] = { ...out[0], accountNumberMasked: `****${matchLast4}` }
  }
  return out
}
