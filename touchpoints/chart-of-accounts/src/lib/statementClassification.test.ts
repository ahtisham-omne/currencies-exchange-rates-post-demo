import { describe, it, expect } from 'vitest'
import {
  ALL_CLASSIFICATIONS, CLASSIFICATIONS_BY_CATEGORY, CATEGORY_OF_CLASSIFICATION,
  CLASSIFICATION_DESCRIPTIONS, CLASSIFICATIONS_FOR_ROLE, ALL_ACCOUNT_ROLES,
  CATEGORY_OF_ROLE, UNOFFERED_ROLES, rolesForClassification, classificationForRole,
  roleNamedByClassification,
  DEFAULT_CLASSIFICATION_BY_CATEGORY, CATEGORY_ORDER, isCategoryRoot, classificationOverride, type Account,
} from '../types'
import { runUploadValidation, type ParsedRow } from './uploadValidation'
import { MASTER_CHART } from './masterChart'
import { FULL_CHART, classificationFor } from './fullChart'
import { validateAccountAgainst } from '../store'
import { seedAccounts, seedCompany, seedNumberingScheme } from './seed'
import { bankTypesFor } from '../pages/CreateAccount'

/* A summary account prints as a single line on a statement, so everything it
   totals has to belong on that line. That makes agreement between a parent and
   its children the whole content of the rule: a summary classified as a current
   asset holds current assets and nothing else.

   The five category roots are the exception. A root spans its category by
   nature - "Assets" covers both current and non-current - so it is read for the
   span rather than for the value it carries. */
describe('a parent and its children agree on classification', () => {
  it('holds across the master chart the wizard publishes', () => {
    const by = new Map(MASTER_CHART.map(e => [e.number, e]))
    const disagree = MASTER_CHART.filter(e => {
      const p = e.parentNumber ? by.get(e.parentNumber) : undefined
      if (!p || (p.parentNumber === null && p.posting === 'Summary')) return false
      return p.statementClassification !== e.statementClassification
    })
    expect(disagree.map(e => `${e.number} ${e.name}`)).toEqual([])
  })

  it('holds across the demo chart', () => {
    const by = new Map(FULL_CHART.map(e => [e.number, e]))
    const classOf = (num: string) => {
      const r = by.get(num)!
      return classificationFor(r.number, r.cat)
    }
    const disagree = FULL_CHART.filter(e => {
      const p = e.parent ? by.get(e.parent) : undefined
      if (!p || (p.parent === null && p.glType === 'Summary')) return false
      return classOf(p.number) !== classOf(e.number)
    })
    expect(disagree.map(e => `${e.number} ${e.name}`)).toEqual([])
  })
})

describe('the thirteen classifications', () => {
  it('are partitioned by category, with nothing shared and nothing left out', () => {
    expect(ALL_CLASSIFICATIONS).toHaveLength(13)
    expect(new Set(ALL_CLASSIFICATIONS).size).toBe(13)
    for (const c of ALL_CLASSIFICATIONS) {
      expect(CLASSIFICATIONS_BY_CATEGORY[CATEGORY_OF_CLASSIFICATION[c]]).toContain(c)
    }
  })

  it('each carry a description, so no card ships with a blank line', () => {
    for (const c of ALL_CLASSIFICATIONS) expect(CLASSIFICATION_DESCRIPTIONS[c], c).toBeTruthy()
  })

  it('default to one their own category lists', () => {
    for (const cat of CATEGORY_ORDER) {
      expect(CLASSIFICATIONS_BY_CATEGORY[cat]).toContain(DEFAULT_CLASSIFICATION_BY_CATEGORY[cat])
    }
  })
})

/* A role is a job an account does, and the job settles where it prints. Bank is
   the one that genuinely spans - a CD maturing beyond a year is a non-current
   asset - and the exchange gain and loss accounts can be read as operating or
   not, so those three are allowed a choice and the other fourteen are not. */
describe('roles and the classifications they allow', () => {
  const SPANNING = ['Bank', 'Exchange Gain', 'Exchange Loss']

  it('offer only classifications from the role\'s own category', () => {
    for (const role of ALL_ACCOUNT_ROLES) {
      for (const c of CLASSIFICATIONS_FOR_ROLE[role]) {
        expect(CATEGORY_OF_CLASSIFICATION[c], role).toBe(CATEGORY_OF_ROLE[role])
      }
    }
  })

  it('lock to one classification except for the three that span', () => {
    for (const role of ALL_ACCOUNT_ROLES) {
      const locked = classificationForRole(role) !== undefined
      expect(locked, role).toBe(!SPANNING.includes(role))
    }
  })

  it('are reachable from the classification they lock to', () => {
    for (const role of ALL_ACCOUNT_ROLES) {
      if (UNOFFERED_ROLES.includes(role)) continue
      for (const c of CLASSIFICATIONS_FOR_ROLE[role]) {
        expect(rolesForClassification(c), `${role} under ${c}`).toContain(role)
      }
    }
  })

  it('keep a role already on the account even when it is no longer offered', () => {
    expect(rolesForClassification('Current liability')).not.toContain('Sales Tax Payable')
    expect(rolesForClassification('Current liability', { keep: 'Sales Tax Payable' }))
      .toContain('Sales Tax Payable')
  })
})

/* Bank is one of the three roles that does not settle its own classification,
   and this is the reason: the kind of cash account is what decides. */
describe('the bank account types a classification allows', () => {
  it('offers every cash account on a current asset', () => {
    expect(bankTypesFor('Current asset').map(o => o.value))
      .toEqual(['Checking', 'Savings', 'Money Market', 'Certificate of Deposit'])
  })

  it('offers only the certificate of deposit on a non-current asset', () => {
    expect(bankTypesFor('Non-current asset').map(o => o.value))
      .toEqual(['Certificate of Deposit'])
  })
})

/* An import is the one path that can state a classification without a form
   narrowing the choice first, and `createAccount` does not validate, so what the
   engine settles on is what the chart is created with.

   Three answers in order for a cell the file left blank: the role where the role
   settles it, then the parent summary, then the category's default. */
describe('an imported row settles its classification', () => {
  const EXP_ROOT: Account = {
    id: 'root_exp', internalId: 'ACC-000001', accountNumber: '50000', accountName: 'Expenses',
    accountType: 'EXP', glAccountType: 'Summary', statementClassification: 'Operating expense',
    isPosting: false, normalBalance: 'Debit', currencyCode: 'USD', status: 'Active',
    effectiveDate: '2026-01-01', postingRestrictions: {}, defaultDimensionValues: [],
    isContra: false, parentId: null, subsidiaryId: 'sub_main', balance: 0, hasTransactions: false,
    createdAt: '', updatedAt: '', createdBy: '', updatedBy: '',
  }
  // Classified apart from the category's default, so inheriting it is visible.
  const COGS_SUMMARY: Account = {
    ...EXP_ROOT, id: 's_5100', accountNumber: '5100', accountName: 'Cost of Sales',
    statementClassification: 'Cost of goods sold', parentId: 'root_exp',
  }
  const CHART = [EXP_ROOT, COGS_SUMMARY]

  const row = (over: Partial<ParsedRow>): ParsedRow => ({
    row: 2, number: '5210', name: 'Imported expense', type: 'Expense', glType: 'Posting', ...over,
  })
  const settled = (over: Partial<ParsedRow>) =>
    runUploadValidation([row(over)], CHART).newAccounts[0]?.statementClassification

  it('from the role, when the role allows only one', () => {
    expect(settled({ role: 'Cost of Goods Sold' })).toBe('Cost of goods sold')
  })

  it('from the parent summary, when the file said nothing', () => {
    expect(settled({ parent: '5100' })).toBe('Cost of goods sold')
  })

  it('from the category, when nothing narrower was said', () => {
    expect(settled({})).toBe(DEFAULT_CLASSIFICATION_BY_CATEGORY.EXP)
  })

  it('from the category root, which spans and so settles nothing', () => {
    expect(settled({ parent: '50000' })).toBe(DEFAULT_CLASSIFICATION_BY_CATEGORY.EXP)
  })

  it('taking the cell over the parent when the two can both be true', () => {
    expect(settled({ classification: 'Other expense' })).toBe('Other expense')
  })

  /* The role says what the account is for; the classification only says where
     that prints. So the role wins, and the row is told rather than refused. */
  it('warning when a role overrules the cell rather than refusing the row', () => {
    const { newAccounts, warned, invalid } = runUploadValidation(
      [row({ role: 'Cost of Goods Sold', classification: 'Other expense' })], CHART)
    expect(invalid).toEqual([])
    expect(warned[0].columns).toContain('classification')
    expect(newAccounts[0].statementClassification).toBe('Cost of goods sold')
  })

  /* Refused rather than corrected: a summary prints as one line, and an account
     filed on a line its parent's total does not appear on is a chart that
     disagrees with itself in a way nothing downstream would fix. */
  it('refusing a cell its parent summary contradicts', () => {
    const { invalid } = runUploadValidation([row({ parent: '5100', classification: 'Other expense' })], CHART)
    expect(invalid[0].columns).toContain('classification')
    expect(invalid[0].errors.join(' ')).toContain('cost of goods sold')
  })

  it('refusing a value that belongs to another category', () => {
    const { invalid } = runUploadValidation([row({ classification: 'Current asset' })], CHART)
    expect(invalid[0].columns).toContain('classification')
  })

  it('refusing a value that is not a classification at all', () => {
    const { invalid } = runUploadValidation([row({ classification: 'Overheads' })], CHART)
    expect(invalid[0].columns).toContain('classification')
  })
})

/* Decision 3: the classification defaults from the parent, and an override is
   allowed but flagged. So the store takes either, and the chart flags the
   override (module review, 2026-10-06, COA-13). */
describe('saving an account takes a classification other than its parent\'s', () => {
  const draft = (parentId: string, classification: typeof ALL_CLASSIFICATIONS[number]) =>
    validateAccountAgainst(seedNumberingScheme, seedAccounts, seedCompany, {
      accountNumber: 'CLS-TEST-1',
      accountName: 'Classification backstop',
      accountType: 'AST',
      statementClassification: classification,
      parentId,
    }).map(e => e.field)

  it('takes a non-current asset under a current asset summary, as an override', () => {
    const parent = seedAccounts.find(a =>
      a.glAccountType === 'Summary' && !isCategoryRoot(a) && a.statementClassification === 'Current asset')!
    expect(draft(parent.id, 'Non-current asset')).not.toContain('statementClassification')
    expect(classificationOverride(parent, 'Non-current asset')).toBe(true)
    expect(classificationOverride(parent, 'Current asset')).toBe(false)
  })

  it('takes either side under a category anchor, which spans both', () => {
    const root = seedAccounts.find(a => isCategoryRoot(a) && a.accountType === 'AST')!
    for (const c of CLASSIFICATIONS_BY_CATEGORY.AST) {
      expect(draft(root.id, c), c).not.toContain('statementClassification')
    }
  })
})

/* The store's backstop for the range on a Summary. The create form runs its
   own check while typing and disables Save on any conflict, but a range
   arriving from an import, a bulk edit, or a stale form has to be refused
   somewhere too - here.

   Built on a synthetic chart, not the seeded one: the seeded summaries do not
   yet carry ranges, and pinning the rule to seeded state would let the rule
   quietly go unpinned the day it does. */
describe('saving a summary checks its range against the chart', () => {
  const parent: any = {
    id: 'p_current', accountNumber: '1000', accountName: 'Current assets',
    accountType: 'AST', statementClassification: 'Current asset',
    glAccountType: 'Summary', isPosting: false, parentId: null,
    numberRangeStart: 1000, numberRangeEnd: 1999,
    internalId: 'ACC-000001', currencyCode: 'USD', status: 'Active',
    effectiveDate: seedCompany.fiscalYearStart, postingRestrictions: {},
    defaultDimensionValues: [], balance: 0, hasTransactions: false,
    normalBalance: 'Debit', createdAt: '', updatedAt: '', createdBy: '', updatedBy: '',
  }
  const sibling: any = { ...parent, id: 's_inv', accountNumber: '1500', accountName: 'Inventory', parentId: 'p_current', numberRangeStart: 1500, numberRangeEnd: 1599, internalId: 'ACC-000002' }
  const chart = [parent, sibling]

  const under = (start?: number, end?: number, exceptId?: string) =>
    validateAccountAgainst(seedNumberingScheme, chart, seedCompany, {
      accountNumber: 'RNG-TEST-1',
      accountName: 'Range backstop',
      accountType: 'AST',
      glAccountType: 'Summary',
      statementClassification: 'Current asset',
      parentId: parent.id,
      numberRangeStart: start,
      numberRangeEnd: end,
    }, exceptId).map(e => e.field)

  it('takes a range that sits inside the parent and clears its siblings', () => {
    expect(under(1100, 1200)).not.toContain('numberRange')
  })

  /* A reservation is a one-way block (design review, 2026-09-24): the parent's
     block keeps strangers out, and does not keep its own summaries in. */
  it('takes a range that runs past the parent, where nothing else holds those numbers', () => {
    expect(under(1900, 2100)).not.toContain('numberRange')
  })

  it('refuses a range over a number another account already holds', () => {
    const withStranger = [...chart, { ...sibling, id: 'x_other', accountNumber: '2050', accountName: 'Elsewhere', parentId: null, glAccountType: 'Posting', numberRangeStart: undefined, numberRangeEnd: undefined }]
    const errs = validateAccountAgainst(seedNumberingScheme, withStranger, seedCompany, {
      accountNumber: 'RNG-TEST-1', accountName: 'Range backstop', accountType: 'AST', glAccountType: 'Summary',
      statementClassification: 'Current asset', parentId: parent.id, numberRangeStart: 1900, numberRangeEnd: 2100,
    }).map(e => e.field)
    expect(errs).toContain('numberRange')
  })

  it('refuses an overlap with a sibling summary', () => {
    // 1550 sits inside the sibling's 1500-1599 and the proposed 1400-1600.
    expect(under(1400, 1600)).toContain('numberRange')
  })

  it('refuses a range with only one end set', () => {
    expect(under(1000, undefined)).toContain('numberRange')
    expect(under(undefined, 1999)).toContain('numberRange')
  })

  it('refuses a range whose ends are reversed', () => {
    expect(under(1999, 1000)).toContain('numberRange')
  })

  it('has nothing to check on a Posting, whose range is not a field it holds', () => {
    // A Posting is a leaf. The store should not read the range fields off it
    // at all; nothing there could contradict anything.
    const errs = validateAccountAgainst(seedNumberingScheme, chart, seedCompany, {
      accountNumber: 'RNG-POSTING-1',
      accountName: 'Not a summary',
      accountType: 'AST',
      glAccountType: 'Posting',
      statementClassification: 'Current asset',
      parentId: parent.id,
      // Values that would be a conflict on a Summary; here they are ignored.
      numberRangeStart: 999999,
      numberRangeEnd: 999998,
    }).map(e => e.field)
    expect(errs).not.toContain('numberRange')
  })
})

/* Two classifications are the same words as a role, and there the create form
   fills the role in rather than ask the reader the same thing twice. What makes
   that safe is how narrow it is, so the narrowness is what these check: a role
   added later that happens to name its own line would join the list silently,
   and a rule written any wider would start answering questions the reader has
   not been asked. */
describe('a classification that names a role answers for it', () => {
  it('names one for retained earnings and for cost of goods sold, and for nothing else', () => {
    const named = ALL_CLASSIFICATIONS
      .filter(c => roleNamedByClassification(c))
      .map(c => `${c} -> ${roleNamedByClassification(c)}`)
    expect(named).toEqual([
      'Retained earnings -> Retained Earnings',
      'Cost of goods sold -> Cost of Goods Sold',
    ])
  })

  /* The pre-selected role has to be one the picker on the next step actually
     offers, or the reader meets a filled-in field with no lit option in it. */
  it('only ever names a role that classification offers', () => {
    for (const c of ALL_CLASSIFICATIONS) {
      const named = roleNamedByClassification(c)
      if (named) expect(rolesForClassification(c), c).toContain(named)
    }
  })

  /* The tempting shorter rule - "the classification offers exactly one role" -
     is wrong, and these are the two that prove it. Non-current asset offers only
     Bank, and most non-current assets are not bank accounts; other expense
     offers only Exchange Loss, and most are not currency movements. */
  it('leaves a classification that offers one unrelated role alone', () => {
    expect(rolesForClassification('Non-current asset')).toEqual(['Bank'])
    expect(roleNamedByClassification('Non-current asset')).toBeUndefined()
    expect(rolesForClassification('Other expense')).toEqual(['Exchange Loss'])
    expect(roleNamedByClassification('Other expense')).toBeUndefined()
  })

  /* Picking a category settles a classification too, so a default that named a
     role would fill the field in before the reader had said anything narrower
     than "expense". None of the five do, and that is load-bearing. */
  it('names nothing from the classification a category falls back to', () => {
    for (const cat of CATEGORY_ORDER) {
      expect(roleNamedByClassification(DEFAULT_CLASSIFICATION_BY_CATEGORY[cat]), cat).toBeUndefined()
    }
  })
})

/* Whatever ranges the seed carries have to survive the store's own check, so
   the demo chart cannot ship with a conflict of its own that would refuse the
   first edit of any summary that carries one. */
describe('the seeded chart holds no range conflict of its own', () => {
  const seeded = seedAccounts.filter(a => a.glAccountType === 'Summary' && typeof a.numberRangeStart === 'number')
  it('has at least one summary with a range, so the check is not empty', () => {
    expect(seeded.length).toBeGreaterThan(0)
  })
  it('accepts every seeded range in place, one at a time', () => {
    for (const s of seeded) {
      const errs = validateAccountAgainst(seedNumberingScheme, seedAccounts, seedCompany, {
        accountNumber: s.accountNumber,
        accountName: s.accountName,
        accountType: s.accountType,
        glAccountType: 'Summary',
        statementClassification: s.statementClassification,
        parentId: s.parentId,
        numberRangeStart: s.numberRangeStart,
        numberRangeEnd: s.numberRangeEnd,
      }, s.id).map(e => e.field)
      expect(errs, `${s.accountNumber} ${s.accountName}`).not.toContain('numberRange')
    }
  })
})
