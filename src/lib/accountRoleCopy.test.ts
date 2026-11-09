import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RoleFieldTooltip } from './accountRoleCopy'
import {
  ACCOUNT_ROLE_DESCRIPTIONS,
  ACCOUNT_ROLE_EXAMPLES,
  ALL_ACCOUNT_ROLES,
  CATEGORY_OF_ROLE,
  CONTROL_ACCOUNT_DETAIL,
  CONTROL_ACCOUNT_ROLES,
  CURRENCY_LOCKED_REASON,
  ROLES_BY_CATEGORY,
  isControlAccountRole,
  normalBalanceForRole,
  roleHoldsOwnCurrency,
} from '../types'
import { seedAccounts } from './seed'
import type { AccountRole } from '../types'

// The side each role locks, as specified. Spelled out rather than derived, so a
// change to the category mapping that would flip an account's normal balance
// fails here instead of silently reclassifying every account of that role.
const EXPECTED: Record<AccountRole, 'Debit' | 'Credit'> = {
  'Accounts Receivable': 'Debit',
  'Inventory': 'Debit',
  'Bank': 'Debit',
  'Cash on Hand': 'Debit',
  'Vendor Prepayments': 'Debit',
  'Payments to Deposit': 'Debit',
  'Accounts Payable': 'Credit',
  'Credit Card': 'Credit',
  'AP Accrual': 'Credit',
  'Customer Deposits': 'Credit',
  'Sales Tax Payable': 'Credit',
  'Opening Balance Equity': 'Credit',
  'Retained Earnings': 'Credit',
  'Retained Earnings Adjustments': 'Credit',
  'Current Year Earnings': 'Credit',
  'Sales Revenue': 'Credit',
  'Exchange Gain': 'Credit',
  'Cost of Goods Sold': 'Debit',
  'Exchange Loss': 'Debit',
}

describe('account roles - normal balance', () => {
  it('locks every role to the specified side', () => {
    for (const role of ALL_ACCOUNT_ROLES) {
      expect(normalBalanceForRole(role)).toBe(EXPECTED[role])
    }
  })

  it('agrees with the category the role sits in', () => {
    for (const role of ALL_ACCOUNT_ROLES) {
      const category = CATEGORY_OF_ROLE[role]
      expect(ROLES_BY_CATEGORY[category]).toContain(role)
      expect(normalBalanceForRole(role)).toBe(['AST', 'EXP'].includes(category) ? 'Debit' : 'Credit')
    }
  })

  it('places every role in exactly one category', () => {
    const seen = new Map<AccountRole, number>()
    for (const roles of Object.values(ROLES_BY_CATEGORY)) {
      for (const r of roles) seen.set(r, (seen.get(r) ?? 0) + 1)
    }
    expect(seen.size).toBe(ALL_ACCOUNT_ROLES.length)
    for (const [, count] of seen) expect(count).toBe(1)
  })
})

describe('account roles - tooltip copy', () => {
  it('gives every role a definition and a plain-language example', () => {
    for (const role of ALL_ACCOUNT_ROLES) {
      expect(ACCOUNT_ROLE_DESCRIPTIONS[role]?.trim()).toBeTruthy()
      expect(ACCOUNT_ROLE_EXAMPLES[role]?.trim()).toBeTruthy()
      // The example is meant to be recognizable, not a restatement of the term.
      expect(ACCOUNT_ROLE_EXAMPLES[role]).not.toBe(ACCOUNT_ROLE_DESCRIPTIONS[role])
    }
  })

  it('writes every line in sentence case, ending in a full stop, with no em dashes', () => {
    for (const role of ALL_ACCOUNT_ROLES) {
      for (const line of [ACCOUNT_ROLE_DESCRIPTIONS[role], ACCOUNT_ROLE_EXAMPLES[role]]) {
        expect(line).not.toContain('—')
        expect(line.endsWith('.')).toBe(true)
        expect(line[0]).toBe(line[0].toUpperCase())
      }
    }
  })
})

describe('control accounts', () => {
  // Spelled out rather than read back from the constant: which accounts a
  // subledger owns is a product decision, so widening the list has to be a
  // deliberate edit here and not a side effect of touching types.ts.
  const EXPECTED_CONTROL: AccountRole[] = [
    'Accounts Receivable',
    'Accounts Payable',
    'Inventory',
    'Vendor Prepayments',
    'Customer Deposits',
    'AP Accrual',
  ]

  it('treats exactly the six subledger-owned roles as control accounts', () => {
    expect([...CONTROL_ACCOUNT_ROLES].sort()).toEqual([...EXPECTED_CONTROL].sort())
    for (const role of ALL_ACCOUNT_ROLES) {
      expect(isControlAccountRole(role)).toBe(EXPECTED_CONTROL.includes(role))
    }
  })

  it('reads an absent role as not a control account', () => {
    expect(isControlAccountRole(undefined)).toBe(false)
    expect(isControlAccountRole('')).toBe(false)
  })

  it('keeps every control role inside the offered set', () => {
    for (const role of CONTROL_ACCOUNT_ROLES) {
      expect(ALL_ACCOUNT_ROLES).toContain(role)
      expect(ROLES_BY_CATEGORY[CATEGORY_OF_ROLE[role]]).toContain(role)
    }
  })

  it('explains every control account, and only those', () => {
    for (const role of ALL_ACCOUNT_ROLES) {
      const detail = CONTROL_ACCOUNT_DETAIL[role]
      if (isControlAccountRole(role)) expect(detail?.trim()).toBeTruthy()
      else expect(detail).toBeUndefined()
    }
  })

  it('writes the detail in sentence case with no em dashes, and leaves the heading to the panel', () => {
    for (const role of CONTROL_ACCOUNT_ROLES) {
      const detail = CONTROL_ACCOUNT_DETAIL[role]!
      expect(detail).not.toContain('—')
      expect(detail.endsWith('.')).toBe(true)
      expect(detail[0]).toBe(detail[0].toUpperCase())
      // The panel already says "Control account" above this line.
      expect(detail.toLowerCase()).not.toContain('control account')
    }
  })

  /* How the figures arrive is phrased per role, because what drives an inventory
     account is not what drives a payable. The lock is the one thing every control
     account says the same way, and it is the claim the picker has to honour, so it
     is the only phrasing pinned here. */
  it('states the manual posting lock in every control account\'s detail', () => {
    for (const role of CONTROL_ACCOUNT_ROLES) {
      expect(CONTROL_ACCOUNT_DETAIL[role]!.toLowerCase()).toContain('manual posting')
    }
  })

  /* The claim the copy makes is that manual posting is refused, so the set of
     accounts it is refused for has to be pinned. Only a posting account can be a
     control account: a summary holds no figure of its own, so the role would have
     nothing to own. */
  it('marks the seeded control accounts, all of them posting accounts', () => {
    const locked = seedAccounts.filter(a => isControlAccountRole(a.accountRole))
    expect(locked.map(a => a.accountNumber).sort()).toEqual(
      ['11310', '11320', '11410', '11420', '11430', '21110', '21200', '21620'],
    )
    for (const a of locked) expect(a.isPosting).toBe(true)
  })
})

/* No role explains itself on hover any more. Mahad, 2026-09-21: *"Remove hover
   from account roles."* Each role used to carry a card of its own on the picker
   pills, the role dropdown and the detail rail, and a card per pill meant a
   reader could not run their eye along the options without one opening over the
   form. The field label keeps its own tooltip, which answers the different
   question of what a role is for at all, so that is what is pinned here. */
describe('what a role still explains', () => {
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')

  it('has no per-role hover card left to render', async () => {
    const mod = await import('./accountRoleCopy')
    expect('RoleTooltip' in mod).toBe(false)
  })

  // Nor the flow panel that replaced it, removed 2026-09-29.
  it('has no per-role panel left to render either', async () => {
    const mod = await import('./accountRoleCopy')
    expect('RoleGuidePanel' in mod).toBe(false)
  })

  it('explains on the field label what a role is and warns that some are locked', () => {
    const card = text(renderToStaticMarkup(createElement(RoleFieldTooltip)))
    expect(card).toContain('A role tells the system what job this account does.')
    expect(card).toContain('It sets the normal balance')
    expect(card).toContain('Some roles are control accounts')
    expect(card).toContain('only the system can post to them')
  })
})

// Only the roles that carry a balance of their own may leave the base currency.
// Spelled out per role so widening the rule has to be a deliberate edit here.
const HOLDS_OWN_CURRENCY: AccountRole[] = ['Bank', 'Cash on Hand']

describe('which roles carry their own currency', () => {
  it('offers a currency only to the roles that carry a balance of their own', () => {
    for (const role of ALL_ACCOUNT_ROLES) {
      expect(roleHoldsOwnCurrency(role)).toBe(HOLDS_OWN_CURRENCY.includes(role))
    }
  })

  it('keeps an account with no role on the base currency', () => {
    expect(roleHoldsOwnCurrency('')).toBe(false)
    expect(roleHoldsOwnCurrency(undefined)).toBe(false)
  })

  // Decision 22, kept on the retest of 2026-10-07: Bank and Cash on Hand only.
  it('leaves a credit card on the base currency', () => {
    expect(roleHoldsOwnCurrency('Credit Card')).toBe(false)
  })

  it('names exactly those roles in the reason the field is locked', () => {
    expect(CURRENCY_LOCKED_REASON).toContain('bank and cash on hand')
  })
})
