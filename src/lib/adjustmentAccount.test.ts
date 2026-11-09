import { describe, it, expect } from 'vitest'
import {
  ADJUSTMENT_ACCEPTS_ENTRIES,
  ADJUSTMENT_REDUCE_HINT,
  ADJUSTMENT_REDUCE_QUESTION,
  ADJUSTMENT_DIMENSION_NAME,
  ADJUSTMENT_TARGET_HINT,
  ADJUSTMENT_TARGET_REQUIRED,
  ADJUSTMENT_WHY,
  adjustmentDimensionFor,
  adjustmentDimensionValue,
  adjustmentTargets,
  buildAdjustmentInput,
  suggestAdjustment,
  validateAdjustment,
  type AdjustmentDraft,
} from './adjustmentAccount'
import { seedAccounts, seedNumberingScheme, seedDimensions } from './seed'
import { buildAccount } from '../store'
import { isControlAccountRole, type Account, type NumberingScheme } from '../types'

const byNumber = (n: string): Account => {
  const a = seedAccounts.find(x => x.accountNumber === n)
  if (!a) throw new Error(`no seeded account ${n}`)
  return a
}

// 11300 Accounts Receivable (Summary) with 11310 Trade Receivables sealed beneath
// it: the exact shape an adjustment is created into.
const TRADE_AR = byNumber('11310')
const AR_SUMMARY = byNumber('11300')

const draftFor = (target: Account, over: Partial<AdjustmentDraft> = {}): AdjustmentDraft => ({
  targetId: target.id,
  accountName: 'Allowance for doubtful accounts',
  accountNumber: '11311',
  reducesTotal: true,
  ...over,
})

/* Who an adjustment can be created beside. Only a sealed account needs one: an
   ordinary posting account already takes hand entries, so a neighbour would be
   an account that stands for nothing. */
describe('adjustmentTargets', () => {
  const targets = adjustmentTargets(seedAccounts)

  it('offers the sealed posting accounts', () => {
    expect(targets.map(a => a.accountNumber)).toContain('11310')
    expect(targets.map(a => a.accountNumber)).toContain('21110')
    expect(targets.every(a => isControlAccountRole(a.accountRole))).toBe(true)
  })

  it('leaves out summaries and ordinary posting accounts', () => {
    const numbers = targets.map(a => a.accountNumber)
    // 11300 is the summary they sit under; 11330 is an existing adjustment account.
    expect(numbers).not.toContain('11300')
    expect(numbers).not.toContain('11330')
  })

  it('reads in number order', () => {
    expect(targets.map(a => a.accountNumber)).toEqual([...targets.map(a => a.accountNumber)].sort())
  })
})

/* The suggestion. The point of putting the adjustment next to the account it
   stands for is that a reader running down the chart finds the two together, so
   the number has to land beside the target rather than at the end of the block. */
describe('suggestAdjustment', () => {
  it('suggests the first free number after the target', () => {
    const s = suggestAdjustment(TRADE_AR, seedAccounts, seedNumberingScheme)
    expect(s).toEqual({ accountName: 'Trade Receivables adjustment', accountNumber: '11311' })
  })

  it('walks past a run of taken numbers', () => {
    const taken = ['11311', '11312', '11313'].map(n => ({ ...TRADE_AR, id: `x_${n}`, accountNumber: n }))
    const s = suggestAdjustment(TRADE_AR, [...seedAccounts, ...taken], seedNumberingScheme)
    expect(s.accountNumber).toBe('11314')
  })

  /* A glued chart keeps its shape: only the account segment moves, and the parts
     that carry a meaning are copied from the account it sits beside, or the
     adjustment would land in another company or department. */
  it('moves only the account segment of a glued number', () => {
    const scheme: NumberingScheme = {
      ...seedNumberingScheme,
      segments: [
        { index: 0, length: 3, meaning: 'Company', separator: '-' },
        { index: 1, length: 4, meaning: 'Account', separator: '-' },
        { index: 2, length: 3, meaning: 'Department', separator: '' },
      ],
    }
    const target = { ...TRADE_AR, accountNumber: '100-1075-200' }
    const s = suggestAdjustment(target, [target], scheme)
    expect(s.accountNumber).toBe('100-1076-200')
  })
})

describe('validateAdjustment', () => {
  /* The one requirement that is new. Without a target the account is an ordinary
     posting account wearing a dimension that points at nothing. */
  it('refuses to save without a target', () => {
    const errors = validateAdjustment(draftFor(TRADE_AR, { targetId: '' }))
    expect(errors.targetId).toBe(ADJUSTMENT_TARGET_REQUIRED)
  })

  it('asks for a name and a number', () => {
    const errors = validateAdjustment(draftFor(TRADE_AR, { accountName: '  ', accountNumber: '' }))
    expect(errors.accountName).toBeTruthy()
    expect(errors.accountNumber).toBeTruthy()
  })

  it('passes a complete draft', () => {
    expect(validateAdjustment(draftFor(TRADE_AR))).toEqual({})
  })
})

describe('the Adjustment dimension', () => {
  it('names the target it points at', () => {
    expect(adjustmentDimensionValue(TRADE_AR)).toBe('11310 Trade Receivables')
  })

  it('is a new dimension when the chart has none', () => {
    const { dimension, values, value } = adjustmentDimensionFor(seedDimensions, TRADE_AR)
    expect(dimension).toBeNull()
    expect(values).toEqual(['11310 Trade Receivables'])
    expect(value).toBe('11310 Trade Receivables')
  })

  it('adds the target to the dimension that already exists', () => {
    const existing = [...seedDimensions, { ...seedDimensions[0], id: 'dim_adj', name: ADJUSTMENT_DIMENSION_NAME, values: ['21110 Accounts Payable'] }]
    const { dimension, values } = adjustmentDimensionFor(existing, TRADE_AR)
    expect(dimension?.id).toBe('dim_adj')
    expect(values).toEqual(['21110 Accounts Payable', '11310 Trade Receivables'])
  })

  it('does not list a target twice', () => {
    const existing = [...seedDimensions, { ...seedDimensions[0], id: 'dim_adj', name: ADJUSTMENT_DIMENSION_NAME, values: ['11310 Trade Receivables'] }]
    expect(adjustmentDimensionFor(existing, TRADE_AR).values).toEqual(['11310 Trade Receivables'])
  })
})

describe('buildAdjustmentInput', () => {
  const input = buildAdjustmentInput(draftFor(TRADE_AR), TRADE_AR, 'dim_adj', '11310 Trade Receivables')

  it('sits under the same summary as the account it stands beside', () => {
    expect(input.parentId).toBe(AR_SUMMARY.id)
    expect(input.accountType).toBe(TRADE_AR.accountType)
    expect(input.statementClassification).toBe(TRADE_AR.statementClassification)
  })

  /* An ordinary posting account, and that is the whole mechanism. A control role
     is what seals an account against hand entries, so an adjustment account must
     never carry one - it would be sealed against the entries it exists to take. */
  it('is an ordinary posting account with no role', () => {
    expect(input.glAccountType).toBe('Posting')
    expect(input.isPosting).toBe(true)
    expect(input.accountRole).toBeUndefined()
    expect(isControlAccountRole(input.accountRole)).toBe(false)
  })

  it('carries the Adjustment dimension pointed at its target', () => {
    expect(input.defaultDimensionValues).toEqual([{ dimensionId: 'dim_adj', value: '11310 Trade Receivables' }])
  })

  /* The reduce-the-total question is the only thing the user is asked about
     sides, and it has to come out the other end as a normal balance: an asset
     that reduces its total is a credit. */
  it('turns the reduce answer into the opposite normal balance', () => {
    expect(input.isContra).toBe(true)
    expect(buildAccount(input).normalBalance).toBe('Credit')
  })

  it('leaves the normal balance natural for an adjustment that adds', () => {
    const adds = buildAdjustmentInput(draftFor(TRADE_AR, { reducesTotal: false }), TRADE_AR, 'dim_adj', 'v')
    expect(adds.isContra).toBe(false)
    expect(buildAccount(adds).normalBalance).toBe('Debit')
  })

  it('leaves the sealed account it sits beside untouched', () => {
    expect(TRADE_AR.accountRole).toBe('Accounts Receivable')
    expect(TRADE_AR.parentId).toBe(AR_SUMMARY.id)
  })

  it('trims what the user typed', () => {
    const messy = buildAdjustmentInput(
      draftFor(TRADE_AR, { accountName: '  Allowance  ', accountNumber: ' 1076 ', description: '   ' }),
      TRADE_AR, 'dim_adj', 'v',
    )
    expect(messy.accountName).toBe('Allowance')
    expect(messy.accountNumber).toBe('1076')
    expect(messy.description).toBeUndefined()
  })
})

// The house copy rules, which an adjustment account is no exception to.
describe('the copy', () => {
  const all = [
    ADJUSTMENT_WHY,
    ADJUSTMENT_REDUCE_QUESTION,
    ADJUSTMENT_REDUCE_HINT,
    ADJUSTMENT_ACCEPTS_ENTRIES,
    ADJUSTMENT_TARGET_HINT,
    ADJUSTMENT_TARGET_REQUIRED,
  ]

  it('uses no em dashes', () => {
    for (const s of all) expect(s, s).not.toContain('—')
  })

  it('never names a retired account type', () => {
    for (const s of all) {
      for (const word of ['begin-total', 'end-total', 'heading', 'bracket', 'totaling']) {
        expect(s.toLowerCase(), s).not.toContain(word)
      }
    }
  })

  /* "Offset" is the customer-and-vendor netting feature. An adjustment account
     is not one, and borrowing the word would make two features one. */
  it('never calls an adjustment account an offset account', () => {
    for (const s of all) expect(s.toLowerCase(), s).not.toContain('offset')
  })
})
