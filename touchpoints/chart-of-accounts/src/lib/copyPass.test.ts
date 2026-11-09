import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { STATUS_MEANING } from './accountLifecycle'

/* Copy the module has committed to using in one specific way. Each rule was a
   fault noticed on a real screen, so the check is worth the file it takes.
   Locked as strings because comments and TypeScript types cannot pin what the
   reader is going to see. */

const read = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8')

describe('the running balance explainer says what the sign means', () => {
  const table = read('components', 'AccountTable.tsx')

  it('states the sign rule the grid uses, so a $110k contra reads as a contra rather than a bug', () => {
    /* Without this, a reader lands on a running balance for Sales returns and
       allowances and sees six figures on a revenue account with no clue
       whether the sign is wrong or the amount is. The sentence tells them the
       column reads signed against the account's normal side. */
    const line = table.match(/runningBalance: \{[\s\S]*?\}/)![0]
    // The grid reads on the category's side, contras negative (COA-24).
    expect(line).toMatch(/category's side/i)
    expect(line).toMatch(/contra/i)
    expect(line).toMatch(/negative/i)
    expect(line).toMatch(/110,000|110k/i)
  })

  it('names Sales returns as the worked example, not a made-up account', () => {
    // The example exists in the seeded chart, so a reader who wonders can
    // click through and see the exact figure the copy is talking about.
    const line = table.match(/runningBalance: \{[\s\S]*?\}/)![0]
    expect(line).toMatch(/sales returns/i)
  })
})

describe('the account role info says what the role is for, not what kind it is', () => {
  const roleCopy = read('lib', 'accountRoleCopy.tsx')
  const table = read('components', 'AccountTable.tsx')

  it('answers "what is a role for" on both surfaces that describe the field', () => {
    /* The card in the create form and the info popover on the listing column
       describe the same field, and both have to answer the same question. They
       word it differently on purpose - the card goes on to name what a role
       switches on, which a reader picking one needs and a reader scanning a
       column does not - but neither may drift back to naming a kind. */
    expect(roleCopy).toContain('what job this account does')
    const listing = table.match(/role: \{[\s\S]{0,400}\}/)![0]
    expect(listing).toMatch(/how and where the account is used/i)
    expect(listing).not.toMatch(/recognized kind/i)
  })

  it('grounds the listing copy in an account the reader would recognize', () => {
    // Supplied copy. The example is the half that makes an abstract field land.
    const listing = table.match(/role: \{[\s\S]{0,400}\}/)![0]
    expect(listing).toMatch(/accounts payable/i)
    expect(listing).toMatch(/vendor invoicing/i)
  })
})

describe('every performance card says "last closed month", never "completed"', () => {
  it('is what the KPI category label reads', () => {
    // Locked in coaKpis.test.ts too, but repeated here so the copy pass is
    // one place a reader can go to see the whole rule.
    const src = read('components', 'CoaInsights.tsx')
    for (const bad of /completed month/gi[Symbol.matchAll](src) ?? []) {
      expect.fail(`found "completed month" in CoaInsights.tsx: ${bad}`)
    }
    // The user-facing category label is exactly "Last full month" (Mahad,
    // 2026-10-10; it read "Year to date" from COA-04).
    expect(src).toContain("category: 'Last full month'")
    expect(src).not.toContain("category: 'Year to date'")
  })
})

describe('deactivate defines "active transactions" as pending, not posted', () => {
  /* The old copy said "active transactions" and left the reader to guess: does a
     year of posted invoices count? It does not - what blocks is something not
     yet posted. That naming now lives only on the refusal, because the status
     picker was cut back to what each state *is*; so this pins the refusal, which
     is the surface a blocked reader actually meets. */
  it('names the pending work by kind on the refusal, rather than "active transactions"', () => {
    const src = read('lib', 'accountLifecycle.ts')
    const line = src.match(/const BLOCKED_UNPOSTED_WORK = '[^']*'/)![0]
    expect(line).toMatch(/draft/i)
    expect(line).toMatch(/approval/i)
    expect(line).toMatch(/purchase order/i)
    // It also has to say what to do about it, or it names a wall with no door.
    expect(line).toMatch(/post it, void it, or close it first/i)
  })

  it('keeps the blocking conditions off the status picker', () => {
    expect(STATUS_MEANING.Inactive.Posting).toBe('Posting account: No longer available for transactions.')
  })
})

describe('one capitalisation style: sentence case', () => {
  it('uses sentence case on every Edit account menu item', () => {
    const src = read('components', 'AccountTable.tsx')
    // Menu locations - all read the same phrase, so the copy pass owes every
    // one, or the same action reads as two features across the table.
    const hits = src.match(/>Edit account</g)?.length ?? 0
    expect(hits).toBeGreaterThan(0)
    expect(src).not.toContain('>Edit Account<')
  })

  it('uses sentence case on the create modal title', () => {
    const src = read('pages', 'CreateAccount.tsx')
    // The stepped wizard already used "Create GL account"; the flat variants
    // said "Create New GL Account" for the same modal.
    expect(src).toContain("'Create GL account'")
    expect(src).not.toContain('Create New GL Account')
  })

  it('uses sentence case on the placement preview heading', () => {
    const src = read('pages', 'CreateAccount.tsx')
    expect(src).toContain('Placement preview')
    expect(src).not.toContain('Placement Preview')
  })
})
