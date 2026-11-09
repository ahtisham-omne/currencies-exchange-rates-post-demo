import { describe, it, expect } from 'vitest'
import { validateAccountNumberAgainst, accountIdentity, MAX_NUMBER_LENGTH, suggestNextNumberAgainst } from '../store'
import { seedNumberingScheme } from './seed'
import { compareAccountNumbers, ALL_CLASSIFICATIONS, CATEGORY_OF_CLASSIFICATION } from '../types'
import type { Account } from '../types'

/* The one rule about account numbers, and it is shared: an account number is
   free text, and what has to be unique is the number together with the dimension
   values on it. Both halves of that used to be otherwise - the number had to
   match the numbering scheme's segment pattern, and the number alone had to be
   unique - so both are worth pinning.
 *
 * The import side of the same rule is in importPass.test.ts, which reaches it
 * through the file rather than through the form. */

const acct = (id: string, accountNumber: string, extra: Partial<Account> = {}): Account => ({
  id,
  internalId: id.toUpperCase(),
  accountNumber,
  accountName: `Account ${accountNumber}`,
  accountType: 'EXP',
  glAccountType: 'Posting',
  statementClassification: 'Operating expense',
  parentId: null,
  isPosting: true,
  normalBalance: 'Debit',
  currencyCode: 'USD',
  status: 'Active',
  effectiveDate: '2026-01-01',
  postingRestrictions: {},
  defaultDimensionValues: [],
  balance: 0,
  hasTransactions: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdBy: 'Test',
  updatedBy: 'Test',
  ...extra,
})

const check = (number: string, accounts: Account[] = [], values?: { dimensionId: string; value: string }[]) =>
  validateAccountNumberAgainst(seedNumberingScheme, accounts, number, undefined, values)

describe('what an account number is allowed to be', () => {
  /* The regression. A customer whose chart is numbered 01-71100-40 could not type
     their own account number, because the seeded scheme wants four digits. */
  it('takes a segmented number the numbering scheme would not match', () => {
    expect(check('01-71100-40')).toBeNull()
  })

  it('takes a number wider or narrower than the scheme', () => {
    expect(check('71100')).toBeNull()
    expect(check('200')).toBeNull()
  })

  /* Letters are ordinary. A chart numbered AR1100, or 71100A for the second of a
     pair, is a chart somebody keeps, and the form is not the place it gets
     refused. */
  it('takes letters anywhere in the number', () => {
    expect(check('71100A')).toBeNull()
    expect(check('AR-1100')).toBeNull()
    expect(check('A100')).toBeNull()
  })

  /* A letter is part of a number; a space or a slash is a sign the cell holds
     something other than one number. */
  it('refuses anything that is not letters, numbers and dashes', () => {
    expect(check('711 00')?.message).toContain('letters, numbers and dashes')
    expect(check('7110/0')?.message).toContain('letters, numbers and dashes')
    expect(check('')?.message).toContain('letters, numbers and dashes')
  })

  it('refuses one longer than it can store, and says how long it was', () => {
    const long = '1'.repeat(MAX_NUMBER_LENGTH + 1)
    expect(check(long)?.message).toContain(`${MAX_NUMBER_LENGTH + 1}`)
    expect(check('1'.repeat(MAX_NUMBER_LENGTH))).toBeNull()
  })
})

describe('what makes two accounts the same account', () => {
  it('catches the same number written with spaces or another case', () => {
    expect(check(' 71100 ', [acct('a', '71100')])?.message).toContain('already exists')
    expect(check('ar1100', [acct('a', 'AR1100')])?.message).toContain('already exists')
  })

  /* A leading zero is a real difference: 0100 and 100 are numbers someone chose
     to write differently, and a chart read out of segmented codes is full of them. */
  it('keeps a leading zero as a difference', () => {
    expect(check('0100', [acct('a', '100')])).toBeNull()
  })

  /* The heart of it. A chart read out of 01-71100-40 and 01-71100-50 holds 71100
     twice, and what tells them apart is the department. */
  it('lets one number repeat when the dimension values differ', () => {
    const london = acct('a', '71100', { defaultDimensionValues: [{ dimensionId: 'dept', value: 'Sales' }] })
    expect(check('71100', [london], [{ dimensionId: 'dept', value: 'Marketing' }])).toBeNull()
  })

  it('refuses the repeat when the dimension values match, and says why', () => {
    const london = acct('a', '71100', { defaultDimensionValues: [{ dimensionId: 'dept', value: 'Sales' }] })
    const e = check('71100', [london], [{ dimensionId: 'dept', value: 'Sales' }])
    expect(e?.message).toContain('nothing would tell the two apart')
  })

  /* Order of the values is not a difference, and neither is the case of one. */
  it('reads the same values written in another order as the same account', () => {
    expect(accountIdentity('71100', [{ dimensionId: 'b', value: 'x' }, { dimensionId: 'a', value: 'Y' }]))
      .toBe(accountIdentity('71100', [{ dimensionId: 'a', value: 'y' }, { dimensionId: 'b', value: 'X' }]))
  })

  it('reads a dimensionless account as not the same as one carrying values', () => {
    const plain = acct('a', '71100')
    expect(check('71100', [plain], [{ dimensionId: 'dept', value: 'Sales' }])).toBeNull()
  })
})

/* Letters in a number cost one thing, and this is where the price is paid: a
   suggestion is arithmetic, so a lettered number is kept out of it rather than
   reduced to the digits it happens to contain. Stripping AR1100 down to 1100
   would step off a number nobody has. Nothing else about the account changes:
   where it is filed comes from the category stated on it, which is as true of a
   plain number as of a lettered one. */
describe('what a lettered number cannot do', () => {
  it('gets no vote on the next number suggested', () => {
    const base = suggestNextNumberAgainst(seedNumberingScheme, [], 'Operating expense')
    expect(suggestNextNumberAgainst(seedNumberingScheme, [acct('a', 'ZZ9999')], 'Operating expense')).toBe(base)
    // The same call with a number that is a number does move, so the above means something.
    expect(suggestNextNumberAgainst(seedNumberingScheme, [acct('a', base)], 'Operating expense')).not.toBe(base)
  })
})

/* A suggestion counts up from the highest number its category already holds, and
   there is no ceiling for it to reach, so it always has an answer. This used to
   throw a RangeFullError once a category's band filled, which meant the account
   form could refuse to open a category rather than offer a number the customer
   could edit. */
describe('a suggestion for a category that is already busy', () => {
  it('keeps counting past where the old band ended', () => {
    // 300 expenses from 5000 in tens reach 7990, well past the 5999 the old band
    // stopped at, and the next one is offered rather than refused.
    const packed = Array.from({ length: 300 }, (_, i) => acct(`x${i}`, String(5000 + i * 10)))
    // A four-digit scheme, as the old band was; the demo's went to five digits.
    const flat4 = { segments: [{ index: 0, length: 4, meaning: 'Account', separator: '' }] }
    expect(suggestNextNumberAgainst(flat4, packed, 'Operating expense')).toBe('8000')
  })

  it('answers for every section, whatever the chart holds', () => {
    const packed = ALL_CLASSIFICATIONS.map((section, i) => acct(`y${i}`, String(9000 + i), { statementClassification: section, accountType: CATEGORY_OF_CLASSIFICATION[section] }))
    for (const section of ALL_CLASSIFICATIONS) {
      expect(suggestNextNumberAgainst(seedNumberingScheme, packed, section), section).toMatch(/^\d+$/)
    }
  })
})

/* Sorting is the one thing every surface shares, so it is derived once. Reduced
   to an integer key it used to read AR100 and BR100 as the same row. */
describe('how account numbers sort', () => {
  it('reads digit runs as numbers, so 1010 comes after 999', () => {
    expect(['1010', '999', '1100'].sort(compareAccountNumbers)).toEqual(['999', '1010', '1100'])
  })

  it('tells two lettered numbers apart rather than reading both as their digits', () => {
    expect(['BR100', 'AR100'].sort(compareAccountNumbers)).toEqual(['AR100', 'BR100'])
  })

  it('treats case as noise, matching what makes two accounts the same account', () => {
    expect(compareAccountNumbers('ar100', 'AR100')).toBe(0)
  })
})
