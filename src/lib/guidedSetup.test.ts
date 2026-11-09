import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { GUIDED_YOUR_BUSINESS_READING_ROOM } from '../components/BuildEducation'
import { describe, it, expect } from 'vitest'
import {
  BASELINE_ENTRIES, EMPTY_GUIDED_ANSWERS, GUIDED_COUNTRIES, GUIDED_LOCKED_NUMBERS, GUIDED_QUESTIONS,
  computeGuidedChart, guidedStepDiff, guidedEntryToAccount, guidedPreviewAccounts, visibleGuidedQuestions,
  type GuidedAnswers,
} from './guidedSetup'
import { MASTER_CHART_ROLES } from './masterChart'
import { seedCategoryAccounts, seedNumberingScheme } from './seed'
import { buildChartIndex } from './chartTree'
import { chartConflicts } from './numberRange'

const numbers = (entries: { number: string }[]) => entries.map(e => e.number)
const CTX = { baseCurrency: 'USD', fiscalYearStart: '2026-01-01' }
const answers = (patch: Partial<GuidedAnswers>): GuidedAnswers => ({ ...EMPTY_GUIDED_ANSWERS, ...patch })

describe('guidedSetup', () => {
  it('baseline is the chart when nothing is answered and no defaults applied', () => {
    const chart = computeGuidedChart(EMPTY_GUIDED_ANSWERS, false)
    expect(numbers(chart).sort()).toEqual(numbers(BASELINE_ENTRIES).sort())
  })

  it('sorts numerically so parents precede children', () => {
    const chart = computeGuidedChart(answers({ assets: ['own', 'lease', 'loans'] }), false)
    const nums = numbers(chart).map(Number)
    expect(nums).toEqual([...nums].sort((a, b) => a - b))
  })

  it('names a parent for every account it adds', () => {
    // Every question answered, so nothing that lands in the chart can be an
    // orphan pointing at a summary the answers never brought along.
    const chart = computeGuidedChart(answers({
      country: 'US', activities: ['manufacture', 'resell', 'services', 'subscriptions', 'construction'],
      method: 'accrual', ownership: 'ccorp', customers: ['invoice', 'pos'], vendors: ['invoice', 'card'],
      tax: 'yes', payroll: 'yes', assets: ['own', 'lease', 'loans'],
    }), true)
    const present = new Set(numbers(chart))
    const orphans = chart.filter(e => e.parentNumber && !present.has(e.parentNumber))
    expect(orphans.map(e => `${e.number}→${e.parentNumber}`)).toEqual([])
  })

  it('projects locked system accounts and carries guided metadata', () => {
    const chart = computeGuidedChart(EMPTY_GUIDED_ANSWERS, false)
    const obe = chart.find(e => e.number === '3500')!
    const acct = guidedEntryToAccount(obe, CTX)
    expect(GUIDED_LOCKED_NUMBERS.has('3500')).toBe(true)
    expect(acct.pendingReview).toBe(true)
    expect(acct.masterChartRef).toBe('3500')
    expect(acct.parentId).toBe('acct_3000')
  })

  // `isPosting` is a derived mirror of the type, and it is what every aggregate
  // filters on. Let the two disagree and a summary account counts as a leaf, so
  // its children are added to its own total and the figure doubles.
  it('mirrors isPosting off the type on every projected account', () => {
    const chart = computeGuidedChart(EMPTY_GUIDED_ANSWERS, true)
    const wrong = chart
      .map(e => guidedEntryToAccount(e, CTX))
      .filter(a => a.isPosting !== (a.glAccountType === 'Posting'))
    expect(wrong.map(a => a.accountNumber)).toEqual([])
  })

  it('holds no balance on a projected account, whatever its type', () => {
    const chart = computeGuidedChart(EMPTY_GUIDED_ANSWERS, true)
    for (const e of chart) {
      const a = guidedEntryToAccount(e, CTX)
      expect(a.balance, a.accountNumber).toBe(0)
      expect(a.netChange, a.accountNumber).toBeUndefined()
    }
  })
})

/* The nine questions, their helpers and their tooltips are Mahad's spec of
   2026-10-02. What each option's tooltip says it adds is what it adds, named
   the way the tooltip names it: the tooltip is the promise. */
const chartOf = (patch: Partial<GuidedAnswers>) => computeGuidedChart(answers(patch), false)
const names = (patch: Partial<GuidedAnswers>) => chartOf(patch).map(e => e.name)
const added = (patch: Partial<GuidedAnswers>) => {
  const base = new Set(computeGuidedChart(answers({ country: patch.country ?? 'US' }), false).map(e => e.number))
  return chartOf({ country: 'US', ...patch }).filter(e => !base.has(e.number) && e.posting === 'Posting').map(e => e.name)
}
const q = (id: string) => GUIDED_QUESTIONS.find(x => x.id === id)!

describe('the questions, in the order asked', () => {
  it('asks ten, in the spec\'s order', () => {
    expect(GUIDED_QUESTIONS.map(x => x.id)).toEqual(['country', 'activities', 'method', 'ownership', 'customers', 'vendors', 'currency', 'tax', 'payroll', 'assets'])
    expect(GUIDED_QUESTIONS.map(x => x.title)).toEqual([
      'Where is your business based?',
      'What does your business do?',
      'Which accounting method does your business use?',
      'How is your business legally set up?',
      'How do customers pay you?',
      'How do you pay vendors?',
      'Do you deal in multiple currencies?',
      'Do you collect sales tax from customers?',
      'Do you have employees on payroll?',
      'Do you own or lease long-term assets, or have business loans?',
    ])
  })

  it('makes the accounting method the one required answer', () => {
    expect(GUIDED_QUESTIONS.filter(x => x.required).map(x => x.id)).toEqual(['method'])
  })

  it('skips ownership and sales tax for a business outside the US, and says so', () => {
    expect(visibleGuidedQuestions(answers({ country: 'US' })).map(x => x.id)).toContain('ownership')
    const gb = visibleGuidedQuestions(answers({ country: 'GB' })).map(x => x.id)
    expect(gb).not.toContain('ownership')
    expect(gb).not.toContain('tax')
    expect(q('country').notice!(answers({ country: 'GB' }))).toBe("Our tailored setup is currently only available for US businesses. You can still answer the questions, and we'll create a general chart for you. Questions we don't have tailored support for, like ownership and sales tax, will be skipped.")
    expect(q('country').notice!(answers({ country: 'US' }))).toBeNull()
    expect(q('country').notice!(answers({ country: null }))).toBeNull()
  })

  it('adds nothing for a question that is not asked, even one answered before the country changed', () => {
    const gb = numbers(chartOf({ country: 'GB', ownership: 'ccorp', tax: 'yes' }))
    expect(gb).not.toContain('2300')
    expect(gb).not.toContain('3100')
  })

  it('gives every option a tooltip, and the country question its own', () => {
    const bare = GUIDED_QUESTIONS.flatMap(x => x.options.filter(o => !o.explainer).map(o => `${x.id}/${o.value}`))
    expect(bare).toEqual([])
    expect(q('country').explainer).toContain('US accounting standards (GAAP')
  })
})

describe('what the business does', () => {
  it('builds a manufacturer three stages of stock and three costs of making', () => {
    expect(added({ activities: ['manufacture'] })).toEqual(expect.arrayContaining([
      'Raw Materials', 'Work in Process', 'Finished Goods',
      'Direct Materials', 'Direct Labor', 'Manufacturing Overhead',
      'Purchase Price Variance', 'Freight-In', 'Inventory Adjustments',
    ]))
  })

  it('gives a reseller one Inventory and the cost of goods sold it empties into', () => {
    const r = added({ activities: ['resell'] })
    expect(r).toEqual(expect.arrayContaining(['Inventory', 'Cost of Goods Sold', 'Freight-In', 'Purchase Discounts', 'Inventory Adjustments']))
    expect(chartOf({ activities: ['resell'] }).find(e => e.name === 'Purchase Discounts')!.isContra).toBe(true)
  })

  it('creates an account two activities need once', () => {
    const both = chartOf({ activities: ['manufacture', 'resell'] })
    expect(both.filter(e => e.name === 'Freight-In')).toHaveLength(1)
    expect(both.filter(e => e.name === 'Inventory Adjustments')).toHaveLength(1)
    expect(new Set(numbers(both)).size).toBe(both.length)
    // Bought-in goods take a line under the manufacturer's Inventory, not a second Inventory.
    expect(both.filter(e => e.name === 'Inventory')).toHaveLength(1)
    expect(both.find(e => e.name === 'Merchandise Inventory')!.parentNumber).toBe('1200')
  })

  it('adds service, subscription and contract accounts by their tooltip names', () => {
    expect(added({ activities: ['services'] })).toEqual(expect.arrayContaining(['Service Revenue', 'Cost of Services']))
    expect(added({ activities: ['subscriptions'] })).toEqual(expect.arrayContaining(['Deferred Revenue', 'Subscription Revenue']))
    expect(added({ activities: ['construction'] })).toEqual(expect.arrayContaining([
      'Contract Assets', 'Contract Liabilities', 'Retainage Receivable', 'Retainage Payable', 'Contract Revenue',
    ]))
  })

  it('is never the assumed answer', () => {
    const skipped = numbers(computeGuidedChart(EMPTY_GUIDED_ANSWERS, true))
    expect(skipped).toContain('4010')
    for (const n of ['1210', '1220', '5200', '5300']) expect(skipped).not.toContain(n)
    expect(q('activities').multi).toBe(true)
  })
})

describe('accounting method', () => {
  it('decides when things are recorded, and adds no account', () => {
    expect(chartOf({ method: 'accrual' })).toEqual(chartOf({ method: 'cash' }))
    expect(q('method').options.map(o => o.label)).toEqual(['Accrual basis', 'Cash basis'])
  })
})

describe('ownership, for a US business', () => {
  it('stores the legal form the spec lists', () => {
    expect(q('ownership').options.map(o => o.value)).toEqual(['sole', 'partnership', 'scorp', 'ccorp'])
  })

  it('adds the equity each form sets up', () => {
    expect(added({ ownership: 'sole' })).toEqual(["Owner's Contributions", "Owner's Draws"])
    // A pair per partner, two partners by default (COA-15).
    expect(added({ ownership: 'partnership' })).toEqual(['Partner 1 Capital', 'Partner 2 Capital', 'Partner 1 Draws', 'Partner 2 Draws'])
    expect(added({ ownership: 'scorp' })).toEqual(['Common Stock', 'Additional Paid-in Capital', 'Shareholder Distributions'])
  })

  it('gives a C corporation its own income tax accounts', () => {
    expect(added({ ownership: 'ccorp' })).toEqual(expect.arrayContaining([
      'Common Stock', 'Additional Paid-in Capital', 'Dividends Declared', 'Income Tax Expense', 'Income Taxes Payable',
    ]))
  })
})

describe('how money comes in and goes out', () => {
  it('adds receivables, deposits and the credit-loss allowance for invoiced customers', () => {
    expect(added({ customers: ['invoice'] })).toEqual(expect.arrayContaining(['Accounts Receivable', 'Customer Deposits', 'Allowance for Credit Losses']))
  })

  it('adds the clearing, cash and fee accounts for payment at the sale', () => {
    expect(added({ customers: ['pos'] })).toEqual(expect.arrayContaining(['Payments to Deposit', 'Cash on Hand', 'Merchant Fees']))
  })

  it('adds payables, prepayments and accrued purchases for invoiced vendors', () => {
    const v = chartOf({ vendors: ['invoice'] })
    expect(v.map(e => e.name)).toEqual(expect.arrayContaining(['Accounts Payable', 'Vendor Prepayments', 'AP Accrual']))
    // AP Accrual is the account purchasing looks the goods-received balance up by.
    expect(v.find(e => e.name === 'AP Accrual')!.number).toBe('2025')
  })

  it('adds Credit Card Payable for card purchases', () => {
    expect(added({ vendors: ['card'] })).toEqual(['Credit Card Payable'])
  })
})

describe('other currencies', () => {
  it('adds one realized and one unrealized exchange account, carrying gains and losses alike', () => {
    expect(added({ currency: 'yes' })).toEqual(['Realized Foreign Exchange Gain or Loss', 'Unrealized Foreign Exchange Gain or Loss'])
    expect(added({ currency: 'no' })).toEqual([])
  })

  it('is asked wherever the business is', () => {
    expect(visibleGuidedQuestions(answers({ country: 'GB' })).map(x => x.id)).toContain('currency')
  })
})

describe('sales tax and payroll', () => {
  it('adds Sales Tax Payable only when tax is charged', () => {
    expect(added({ tax: 'yes' })).toEqual(['Sales Tax Payable'])
    expect(added({ tax: 'no' })).toEqual([])
    expect(MASTER_CHART_ROLES['2300']).toBe('Sales Tax Payable')
  })

  it('adds wages, payroll tax and payroll liabilities for a business with employees', () => {
    expect(added({ payroll: 'yes' })).toEqual(expect.arrayContaining(['Wages Expense', 'Payroll Tax Expense', 'Payroll Liabilities']))
    expect(added({ payroll: 'no' })).toEqual([])
  })
})

describe('long-term assets, leases and loans', () => {
  it('adds the owned-asset accounts and their depreciation', () => {
    expect(added({ assets: ['own'] })).toEqual(expect.arrayContaining([
      'Machinery and Equipment', 'Vehicles', 'Furniture and Fixtures', 'Accumulated Depreciation', 'Depreciation Expense',
    ]))
  })

  it('splits lease liabilities and notes payable into the next year and after', () => {
    expect(added({ assets: ['lease'] })).toEqual(expect.arrayContaining([
      'Right-of-Use Assets', 'Lease Liabilities - Current', 'Lease Liabilities - Non-current',
    ]))
    const loans = chartOf({ assets: ['loans'] })
    expect(loans.find(e => e.name === 'Notes Payable - Current')!.statementClassification).toBe('Current liability')
    expect(loans.find(e => e.name === 'Notes Payable - Non-current')!.statementClassification).toBe('Non-current liability')
    expect(loans.map(e => e.name)).toContain('Interest Expense')
  })

  it('offers None of these as the one choice that clears the others', () => {
    expect(q('assets').exclusive).toBe('none')
    expect(added({ assets: ['none'] })).toEqual([])
  })
})

describe('skip defaults', () => {
  it('applies them only when requested', () => {
    const withoutDefaults = numbers(computeGuidedChart(answers({ country: 'US' }), false))
    const withDefaults = numbers(computeGuidedChart(answers({ country: 'US' }), true))
    expect(withoutDefaults).not.toContain('3010')
    for (const n of ['3010', '4010', '1100', '2020']) expect(withDefaults).toContain(n)
  })

  it('leaves out what a wrong guess would cost more than it saves', () => {
    const withDefaults = numbers(computeGuidedChart(answers({ country: 'US' }), true))
    for (const n of ['2300', '2200', '6020', '1540', '6600']) expect(withDefaults).not.toContain(n)
  })

  it('guidedStepDiff returns only the accounts a question introduced', () => {
    expect(numbers(guidedStepDiff('tax', answers({ country: 'US', tax: 'yes' })))).toEqual(['2300'])
  })
})

// The preview the wizard shows is the five category anchors with the guided
// posting accounts parented onto them. It is assembled inside the component, so
// what is checked here is the part that can be got wrong in data: that an anchor
// exists for every category a guided account belongs to, and that the tree it
// forms is one the chart index can actually walk.
describe('guided preview nesting', () => {
  const anchors = seedCategoryAccounts(seedNumberingScheme, { currencyCode: 'USD', effectiveDate: '2026-01-01' })
  const postings = computeGuidedChart(answers({ activities: ['manufacture'] }), true)
    .filter(e => e.posting === 'Posting')
    .map(e => {
      const a = guidedEntryToAccount(e, CTX)
      return { ...a, parentId: `seed_cat_${a.accountType}` }
    })

  it('anchors every category a guided account lands in', () => {
    const anchorIds = new Set(anchors.map(a => a.id))
    expect(postings.filter(a => !anchorIds.has(a.parentId!)).map(a => a.accountNumber)).toEqual([])
  })

  it('nests the whole preview under the five anchors, with nothing stranded', () => {
    const index = buildChartIndex([...anchors, ...postings])
    expect(index.unreachable).toEqual([])
    expect(index.roots.map(a => a.accountNumber)).toEqual(anchors.map(a => a.accountNumber))
    for (const a of postings) expect(index.depthOf(a.id), a.accountNumber).toBe(1)
  })

  it('keeps every anchor the same category as the accounts under it', () => {
    const index = buildChartIndex([...anchors, ...postings])
    for (const anchor of anchors) {
      for (const child of index.childrenOf(anchor.id)) {
        expect(child.accountType, child.accountNumber).toBe(anchor.accountType)
      }
    }
  })
})

// The picker draws a flag picture (FlagImage) from the code alone, so a country
// whose code is not two letters would fetch no flag at all.
describe('country flags', () => {
  it('gives every listed country a flag', () => {
    for (const c of GUIDED_COUNTRIES) expect(c.code, c.name).toMatch(/^[A-Z]{2}$/)
  })

  /* Design review, 2026-10-02 - Eli: the list was 34 long, and there are about
     two hundred countries. */
  it('lists every country, not a short list of the likely ones', () => {
    const codes = new Set(GUIDED_COUNTRIES.map(c => c.code))
    expect(codes.size).toBeGreaterThanOrEqual(195)
    for (const c of ['US', 'UY', 'FI', 'IL', 'KZ', 'PE', 'TW', 'XK', 'ZW']) expect(codes.has(c), c).toBe(true)
  })

  it('lists each country once', () => {
    const codes = GUIDED_COUNTRIES.map(c => c.code)
    expect(new Set(codes).size).toBe(codes.length)
  })
})

/* Design review, 2026-09-24: a chart Omne builds is numbered at the width the
   reader chose and laid out as the cascade - each category keeps its whole
   block, each statement-line summary the next block one zero smaller - so it
   starts out keeping every rule number protection holds it to. */
describe('the guided preview, numbered at the chosen width', () => {
  const answers: GuidedAnswers = {
    ...EMPTY_GUIDED_ANSWERS,
    country: 'US', activities: ['manufacture'], method: 'accrual', ownership: 'scorp',
    customers: ['invoice', 'pos'], vendors: ['invoice'], tax: 'yes', payroll: 'yes', assets: ['own', 'loans'],
  }
  const ctx = { baseCurrency: 'USD', fiscalYearStart: '2026-01-01' }
  const at = (width: number) => guidedPreviewAccounts(
    { segments: [{ index: 0, length: width, meaning: 'Account', separator: '' }] }, answers, ctx)

  it('writes every account at the width asked for, never the master chart\'s four digits', () => {
    for (const width of [4, 5, 6]) {
      const nums = at(width).map(a => a.accountNumber)
      expect(nums.every(n => n.length === width), `width ${width}`).toBe(true)
      expect(new Set(nums).size, `width ${width}`).toBe(nums.length)
    }
  })

  it('gives each category its whole block', () => {
    const assets = at(5).find(a => a.id === 'seed_cat_AST')!
    expect([assets.numberRangeStart, assets.numberRangeEnd]).toEqual([10000, 19999])
  })

  it('files accounts under a summary per statement line, each keeping a block one zero smaller', () => {
    const chart = at(5)
    const current = chart.find(a => a.accountName === 'Current Assets')!
    expect(current.glAccountType).toBe('Summary')
    expect(current.parentId).toBe('seed_cat_AST')
    expect([current.accountNumber, current.numberRangeStart, current.numberRangeEnd]).toEqual(['11000', 11000, 11999])
    const under = chart.filter(a => a.parentId === current.id)
    expect(under.length).toBeGreaterThan(1)
    expect(under.every(a => Number(a.accountNumber) > 11000 && Number(a.accountNumber) <= 11999)).toBe(true)
  })

  /* Every statement line the answers reach gets its summary, one account or
     many (Mahad, 2026-10-02: *"The guided setup should also create summary
     account for you in the next step"*). */
  it('makes a summary for every statement line, even one holding a single account', () => {
    const chart = at(5)
    const single = chart.find(a => a.accountName === 'Notes Payable - Non-current')!
    const line = chart.find(a => a.id === single.parentId)!
    expect(line.accountName).toBe('Non-Current Liabilities')
    expect(line.glAccountType).toBe('Summary')
    expect(line.parentId).toBe('seed_cat_LIA')
  })

  it('rolls related accounts up into the summaries the master chart names', () => {
    const chart = at(5)
    const parentName = (name: string) => chart.find(a => a.id === chart.find(x => x.accountName === name)!.parentId)!.accountName
    // Inventory over its three stages, inside Current Assets.
    for (const stage of ['Raw Materials', 'Work in Process', 'Finished Goods']) expect(parentName(stage), stage).toBe('Inventory')
    expect(parentName('Inventory')).toBe('Current Assets')
    // Operating expenses in their families rather than one flat list.
    expect(parentName('Wages Expense')).toBe('Payroll & Benefits')
    expect(parentName('Utilities')).toBe('Occupancy')
    expect(parentName('Travel')).toBe('Sales & Marketing')
    expect(parentName('Payroll & Benefits')).toBe('Operating Expenses')
    // A family that would hold one account is not made.
    expect(chart.some(a => a.accountName === 'Professional Services')).toBe(false)
  })

  it('keeps a group inside its line\'s block, one zero smaller', () => {
    const chart = at(5)
    const inv = chart.find(a => a.accountName === 'Inventory' && a.glAccountType === 'Summary')!
    const line = chart.find(a => a.id === inv.parentId)!
    expect(inv.numberRangeStart! >= line.numberRangeStart! && inv.numberRangeEnd! <= line.numberRangeEnd!).toBe(true)
    expect(inv.numberRangeEnd! - inv.numberRangeStart! + 1).toBe((line.numberRangeEnd! - line.numberRangeStart! + 1) / 10)
  })

  it('keeps the master number on each account for the locks and the checklist', () => {
    const re = at(5).find(a => a.masterChartRef === '3900')!
    expect(re.accountName).toBe('Retained System Earnings')
    expect(re.accountNumber).not.toBe('3900')
  })

  it('breaks none of its own reservations', () => {
    for (const width of [4, 5, 6]) expect(chartConflicts(at(width), true), `width ${width}`).toEqual([])
  })
})

/* Module review, 2026-10-06. */
describe('the module review, on guided setup', () => {
  // Decision 33 (COA-25). Since 2026-10-08 the question says only that it adds
  // no accounts and why it is kept (Mahad's copy); the warning is one click away,
  // in the How it works section its link opens.
  it('warns that the accounting method is hard to change', () => {
    const method = GUIDED_QUESTIONS.find(q => q.id === 'method')!
    expect(method.subtitle).toContain("This doesn't add any accounts")
    const section = GUIDED_YOUR_BUSINESS_READING_ROOM.sections.find(x => x.title === method.learnMore!.section)!
    expect(renderToStaticMarkup(createElement(Fragment, null, section.body))).toContain('difficult to change')
  })

  // One account per cost (COA-16).
  it('posts the lease cost to Rent & Lease rather than adding a second account', () => {
    const names = chartOf({ assets: ['lease'] }).map(e => e.name)
    expect(names).not.toContain('Lease Expense')
    expect(names).toContain('Rent & Lease')
  })

  // Decision 101 (COA-06): the system account and the manual one, with their roles.
  it('builds retained earnings as decision 101 names it', () => {
    const chart = chartOf({})
    const system = chart.find(e => e.name === 'Retained System Earnings')!
    const manual = chart.find(e => e.name === 'Manual GL Transactions')!
    expect(system.system).toBe(true)
    expect(MASTER_CHART_ROLES[system.number]).toBe('Retained Earnings')
    expect(MASTER_CHART_ROLES[manual.number]).toBe('Retained Earnings Adjustments')
  })
})
