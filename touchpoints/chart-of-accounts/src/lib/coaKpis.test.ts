import { describe, it, expect } from 'vitest'
import { todayIso } from './utils'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ALL_COA_KPIS, DEFAULT_COA_KPIS, KpiStatCard, coaKpiAvailable, coaKpiCaption, type CoaKpiCtx, type CoaKpiDefinition } from '../components/CoaInsights'
import { lastEndedPeriod, monthlyBalanceAsOf } from './monthlyLedger'
import { useStore } from '../store'
import { buildChartIndex } from './chartTree'
import { roleKpiAccounts, roleKpiBalance } from './coaKpis'
import { scopeAccountsToPeriod } from './periodSelection'
import { seedAccounts, seedPeriods, seedTransactions } from './seed'
import type { AccountRole } from '../types'

const def = (key: string): CoaKpiDefinition => {
  const found = ALL_COA_KPIS.find(k => k.key === key)
  if (!found) throw new Error(`no KPI definition for ${key}`)
  return found
}

const ctx = (over: Partial<CoaKpiCtx['kpis']> = {}): CoaKpiCtx => ({
  accounts: seedAccounts,
  kpis: {
    active: 0, byType: [], headers: 0, dormant: 0, recent: 0,
    pending: 0, lockOpen: 0, lockSoft: 0, lockHard: 0,
    topAccount: '', largestMovement: 0, largestMovementId: '', largestMovementLabel: '',
    periodNetChange: 0, cashPosition: 0, cashMovement: 0, receivables: 0, payables: 0,
    workingCapital: 0, multiCurrency: 0, totalAssets: 0, totalLiabilities: 0,
    monthCashMovement: 0, inventoryValue: 0, creditCardBalance: 0,
    lastClosedMonthLabel: 'July 2026', netIncome: 0, grossProfit: 0,
    ...over,
  },
})

// The shelf reads as two groups that work differently, and the titles are what
// carry the difference: "current" says point-in-time, so the card face stays
// short and the date detail lives in the tooltip. These are dictated copy - a
// reworded card is a changed promise, so they are pinned verbatim.
describe('KPI copy', () => {
  it('names the current balances by what they hold, as of today', () => {
    expect(def('cash_position').label).toBe('Current cash position')
    expect(def('cash_position').tooltip).toBe(
      'The total cash in your bank and cash accounts, including payments waiting to be deposited.')
    expect(def('receivables_balance').label).toBe('Current receivables balance')
    expect(def('receivables_balance').tooltip).toBe(
      'The total amount your customers owe you as of today, including the impact of any contra accounts.')
    expect(def('payables_balance').label).toBe('Current payables balance')
    expect(def('payables_balance').tooltip).toBe(
      'The total amount you owe your vendors as of today, including the impact of any contra accounts.')
    expect(def('inventory_value').label).toBe('Current inventory value')
    expect(def('inventory_value').tooltip).toBe(
      'The total value of inventory you have on hand as of today, including the impact of any contra accounts.')
    expect(def('credit_card_balance').label).toBe('Current credit card balance')
    expect(def('credit_card_balance').tooltip).toBe(
      'The total you currently owe across your credit card accounts, as of today.')
  })

  // One month, the last closed one (Mahad, 2026-10-10): not the year to date,
  // and not the period picked above.
  it('says of each performance figure that it is the last closed month alone', () => {
    expect(def('net_income').label).toBe('Net income')
    expect(def('net_income').tooltip).toBe("Everything posted to revenue accounts in the last full month, minus everything posted to expense accounts. The month is locked, so this figure won't change.")
    expect(def('gross_profit').label).toBe('Gross profit')
    expect(def('gross_profit').tooltip).toBe("Operating revenue for the last full month, net of contra revenue such as returns and discounts, minus everything posted to Cost of Goods Sold. Other income is left out. The month is locked, so this figure won't change.")
    // The period picker sits below the cards (Mahad, 2026-10-11).
    for (const k of ALL_COA_KPIS) expect(k.tooltip ?? '', k.key).not.toMatch(/\babove\b/)
    for (const k of ALL_COA_KPIS) expect(k.tooltip ?? '', k.key).not.toMatch(/year to date|fiscal year/i)
    for (const k of ALL_COA_KPIS) expect(k.tooltip ?? '', k.key).not.toContain('completed month')
  })

  /* The netted cards state a figure that is also stated as a summary total a
     few hundred pixels below them, and the two used to disagree because the
     card counted the account holding the thing and not the valuation account
     filed beside it. The copy names the netting rather than pointing at the
     other figure: a reader who reads "including the impact of any contra
     accounts" knows why a card and a total can both be right. */
  it('says of every netted card that the contras come off it', () => {
    for (const key of ['receivables_balance', 'payables_balance', 'inventory_value']) {
      expect(def(key).tooltip ?? '', key).toContain('contra accounts')
    }
  })

  it('groups every card the reader sees by default into one of the two groups', () => {
    for (const key of DEFAULT_COA_KPIS) {
      expect(['Current balances', 'Last full month'], key).toContain(def(key).category)
    }
  })

  it('says "current" on every point-in-time card and on no other', () => {
    for (const k of ALL_COA_KPIS) {
      expect(k.label.startsWith('Current '), k.label).toBe(k.category === 'Current balances')
    }
  })

  it('uses no em dashes and no retired vocabulary', () => {
    const BANNED = ['group', 'begin-total', 'end-total', 'heading', 'bracket', 'totaling']
    for (const k of ALL_COA_KPIS) {
      for (const s of [k.label, k.subtitle, k.tooltip ?? '']) {
        expect(s).not.toContain('—')
        for (const word of BANNED) expect(s.toLowerCase(), s).not.toContain(word)
      }
    }
  })
})

// Only the performance cards cover a fixed window, and only they say so.
describe('month stamp', () => {
  // Mahad, 2026-10-10: *"The card should name the month, for example 'August 2026.'"*
  it('names the month on the performance cards, and only the month', () => {
    expect(coaKpiCaption(def('net_income'), ctx())).toBe('July 2026')
    expect(coaKpiCaption(def('gross_profit'), ctx())).toBe('July 2026')
  })

  it('leaves the current-balance cards unstamped, since they are as of now', () => {
    expect(coaKpiCaption(def('cash_position'), ctx())).toBeUndefined()
    expect(coaKpiCaption(def('receivables_balance'), ctx())).toBeUndefined()
  })

  it('stamps nothing at all before a first month has ended', () => {
    expect(coaKpiCaption(def('net_income'), ctx({ lastClosedMonthLabel: '' }))).toBeUndefined()
  })
})

// The stamp rides on the value's baseline where the card is wide enough for
// both. A second line once made the two stamped cards taller than the five
// beside them, so the shelf read as ragged; the cards share a grid row and
// stretch to its height now, so a stamp that has to drop below does not.
describe('where the stamp sits', () => {
  const card = (caption?: string) =>
    renderToStaticMarkup(createElement(KpiStatCard, { label: 'Net income', value: '-$ 6,241', caption }))

  it('puts the month on the same line as the amount', () => {
    const html = card('July 2026')
    const between = html.slice(html.indexOf('-$ 6,241'), html.indexOf('July 2026'))
    expect(between, 'a closing div between the two means the month dropped to its own line')
      .not.toContain('</div>')
  })

  it('adds no line at all to a card with nothing to stamp', () => {
    expect(card()).not.toContain('text-10 text-slate-400')
  })

  /* Reversed 2026-10-07. The rule was the month keeps its width and the amount
     is cut, written when the stamp was a month ("July 2026"). The profit cards'
     stamp became "Year to date through September 2026" (COA-31), 180px, and the
     same rule squeezed Net income and Gross profit to a sliver - Mahad: *"There
     seems to be a bug in these two KPIs."* The amount is what the card is for. */
  it('never cuts the amount: a stamp too long to sit beside it goes under it', () => {
    const html = card('Year to date through September 2026')
    const amount = html.slice(html.lastIndexOf('<p', html.indexOf('-$ 6,241')), html.indexOf('-$ 6,241'))
    expect(amount).toContain('shrink-0')
    expect(amount).toContain('whitespace-nowrap')
    const stamp = html.slice(html.lastIndexOf('<span', html.indexOf('Year to date through')), html.indexOf('Year to date through'))
    expect(stamp).not.toContain('shrink-0')
    expect(stamp).toContain('max-w-full')
    // The row wraps, so the stamp drops below rather than pushing the amount.
    expect(html.slice(0, html.indexOf('-$ 6,241'))).toContain('flex-wrap')
  })
})

// A role-gated card is withheld rather than shown at zero: "$0.00 inventory"
// claims the company holds no stock, where the truth is it tracks none.
describe('role-gated cards', () => {
  it('offers inventory value, because the seeded chart has inventory accounts', () => {
    expect(coaKpiAvailable(def('inventory_value'), ctx())).toBe(true)
  })

  it('withholds the credit card balance, because no account carries that role', () => {
    expect(coaKpiAvailable(def('credit_card_balance'), ctx())).toBe(false)
  })

  it('never gates a card that is not tied to a role', () => {
    const ungated = ALL_COA_KPIS.filter(k => !k.requiresRole)
    for (const k of ungated) expect(coaKpiAvailable(k, ctx()), k.key).toBe(true)
  })

  it('does not count an archived account as evidence the company tracks stock', () => {
    const archivedOnly = seedAccounts
      .filter(a => a.accountRole === 'Inventory')
      .map(a => ({ ...a, status: 'Archived' as const }))
    expect(coaKpiAvailable(def('inventory_value'), { ...ctx(), accounts: archivedOnly })).toBe(false)
  })
})

/* A balance card and the summary total in the list below it state the same thing,
   so they have to state the same number. They did not: the card read $421,000 of
   receivables above a row reading $402,500, because a role lands on the account
   that holds the thing and never on the valuation account filed beside it. The
   figures below are the seeded chart's, pinned so the gap cannot reopen. */
describe('what a role-based balance card counts', () => {
  const posting = seedAccounts.filter(a => a.isPosting && a.status !== 'Archived')
  const numbers = (roles: AccountRole[]) =>
    roleKpiAccounts(posting, roles).map(a => a.accountNumber).sort()

  it('nets the allowance filed beside receivables, landing where the total does', () => {
    // 402,100 trade + 18,900 other - 18,500 allowance.
    expect(roleKpiBalance(posting, 'Accounts Receivable')).toBe(402500)
    expect(numbers(['Accounts Receivable'])).toEqual(['11310', '11320', '11330'])
  })

  it('nets the reserve filed beside inventory the same way', () => {
    // 96,400 + 44,800 + 176,400 - 14,200 reserve.
    expect(roleKpiBalance(posting, 'Inventory')).toBe(303400)
    expect(numbers(['Inventory'])).toEqual(['11410', '11420', '11430', '11440'])
  })

  // Accumulated depreciation is a contra asset too. Netting by account type
  // rather than by parentage would have subtracted the building's depreciation
  // from what the customers owe.
  it('leaves a contra under another summary where it is', () => {
    for (const roles of [['Accounts Receivable'], ['Inventory'], ['Bank', 'Cash on Hand']] as AccountRole[][]) {
      expect(numbers(roles).some(n => n >= '12000')).toBe(false)
    }
  })

  it('counts a branch with no contra as just the accounts themselves', () => {
    expect(numbers(['Accounts Payable'])).toEqual(['21110'])
  })

  /* The other half of the same agreement. Netting the contras made the card
     stop overstating its branch; this is the branch not overstating the card.
     AP Accrual (then Accrued Payables) sat under Accounts Payable carrying the AP Accrual role, so
     the summary rolled up $327,000 beneath a card reading $285,000 - a payable
     nobody has billed yet is not what the card counts, and the chart is where
     that has to be said. It now files beside the summary rather than inside it.

     Stated over every role set the page's cards read, because the shape of the
     fault is not particular to payables: park any account under a control
     summary without the role, and the row and the card part company. */
  it('leaves nothing under a control summary that its card does not count', () => {
    const CARD_ROLES: AccountRole[][] = [
      ['Bank', 'Cash on Hand', 'Payments to Deposit'],
      ['Accounts Receivable'],
      ['Accounts Payable'],
      ['Inventory'],
      ['Credit Card'],
    ]
    // Over the whole chart, not `posting`: the summaries are the thing being
    // read, and an index without them places nothing and finds no fault.
    const index = buildChartIndex(seedAccounts.filter(a => a.status !== 'Archived'))
    for (const roles of CARD_ROLES) {
      const counted = roleKpiAccounts(posting, roles)
      const inCard = new Set(counted.map(a => a.id))
      const summaries = new Set(counted.map(a => a.parentId).filter((p): p is string => !!p))
      for (const id of summaries) {
        const stranded = index.descendantsOf(id)
          .filter(a => a.isPosting && !inCard.has(a.id))
          .map(a => a.accountNumber)
        expect(stranded, roles.join('/')).toEqual([])
      }
    }
  })

  it('reports nothing at all for a role no account carries', () => {
    expect(roleKpiAccounts(posting, ['Credit Card'])).toEqual([])
    expect(roleKpiBalance(posting, 'Credit Card')).toBe(0)
  })

  it('counts an account once, even where it holds the role and is a contra', () => {
    const odd = posting.map(a => (a.accountNumber === '11330' ? { ...a, accountRole: 'Accounts Receivable' as const } : a))
    expect(roleKpiAccounts(odd, ['Accounts Receivable'])).toHaveLength(3)
  })
})

/* A card headed "Current" means today, and the period strip below it does not
   move today. The chart's rows do rewind - sort by balance and you sort by the
   figures on screen - so the page holds two views of the same accounts, and the
   cards have to be taken off the unscoped one. They were not, so winding the
   strip back to March restated what the customers owe you *now*. */
describe('what the period strip moves, and what it does not', () => {
  const posting = seedAccounts.filter(a => a.isPosting && a.status !== 'Archived')

  it('would restate every balance card, if the cards read the scoped chart', () => {
    const march = scopeAccountsToPeriod(posting, seedTransactions, { startDate: '2026-03-01', endDate: '2026-03-31' })
    expect(roleKpiBalance(march.filter(a => a.isPosting), 'Accounts Receivable'))
      .not.toBe(roleKpiBalance(posting, 'Accounts Receivable'))
  })

  it('takes the balance cards off the live chart, not the period-scoped one', () => {
    const page = readFileSync(join(__dirname, '..', 'pages', 'ChartOfAccounts.tsx'), 'utf8')
    expect(page).toMatch(/const liveAccounts = useStore\(s => s\.accounts\)/)
    expect(page).toMatch(/const posting = liveAccounts\.filter/)
    // And the window figures still come off the window.
    expect(page).toMatch(/const inWindow = transactions\.filter\(t => inRange\(t\.date\)\)/)
  })
})

/* What the two performance cards are struck on: the total each P&L account
   stands at when the last ended month runs out - its closing balance on the
   monthly chain, read at 23:59:59 on the last day, after which nothing dated
   inside the month can move it again.

   Not the month's own movement. The chart is authored on year-to-date totals,
   and the seeded postings carry only the recent slice of them, so August's
   movement read -$19,964 directly above a chart whose revenue reads 3.3m. The
   card said the business lost money; everything under it said otherwise. */
/* One month only, the last closed one - not the year to date, not all time, and
   not the period picked in the strip. Mahad, 2026-10-10: *"Fix the prototype's
   math. Net income and gross profit should add up one month only, the last
   closed month."* */
describe('the performance cards add up the last closed month alone', () => {
  const openings = useStore.getState().seedQ1Openings
  const byAcct = new Map<string, typeof seedTransactions>()
  for (const t of seedTransactions) {
    const l = byAcct.get(t.accountId)
    if (l) l.push(t); else byAcct.set(t.accountId, [t])
  }
  /* Exact amounts are not pinned here: the seeded postings are drawn back from
     today, so every figure moves from one day to the next (module review,
     2026-10-06, COA-31). What is pinned is the arithmetic. */
  const figuresAt = (end: string, read: 'movement' | 'closing') => {
    let revenue = 0, operating = 0, expense = 0, cogs = 0
    for (const a of seedAccounts) {
      if (!a.isPosting || (a.accountType !== 'REV' && a.accountType !== 'EXP')) continue
      const mb = monthlyBalanceAsOf(a, byAcct.get(a.id) ?? [], openings[a.id] ?? 0, seedPeriods, end)
      if (!mb) continue
      if (a.accountType === 'REV') {
        revenue += mb[read]
        if (a.statementClassification !== 'Other income') operating += mb[read]
      } else {
        expense += mb[read]
        if (a.accountRole === 'Cost of Goods Sold') cogs += mb[read]
      }
    }
    return { netIncome: revenue - expense, grossProfit: operating - cogs, revenue, cogs }
  }

  it('strikes August on what August alone traded, not the year up to it', () => {
    const august = lastEndedPeriod(seedPeriods, '2026-09-08')!
    expect(august.label).toBe('Aug 2026')
    const month = figuresAt(august.endDate, 'movement')
    // The year so far less the year to the end of July is August, and only August.
    const july = lastEndedPeriod(seedPeriods, '2026-08-07')!
    const ytdStep = figuresAt(august.endDate, 'closing').netIncome - figuresAt(july.endDate, 'closing').netIncome
    expect(month.netIncome).toBeCloseTo(ytdStep, 6)
    expect(month.netIncome).not.toBeCloseTo(figuresAt(august.endDate, 'closing').netIncome, 0)
  })

  it('nets the credit notes off revenue instead of adding them to it', () => {
    // Sales returns and discounts are contra revenue, debit-normal: their
    // movement counts against revenue on the normal side, never with it.
    const contra = seedAccounts.filter(a => a.accountType === 'REV' && a.normalBalance === 'Debit')
    expect(contra.length).toBeGreaterThan(0)
    for (const a of contra) expect(a.balance, a.accountName).toBeLessThan(0)
  })

  it('keeps other income out of gross profit, though net income still counts it', () => {
    /* Interest, rent and a gain on selling a truck are income, but they are not
       sales, so they cannot bear a cost of sales. */
    const otherIncome = seedAccounts
      .filter(a => a.isPosting && a.statementClassification === 'Other income')
      .reduce((s, a) => {
        const mb = monthlyBalanceAsOf(a, byAcct.get(a.id) ?? [], openings[a.id] ?? 0, seedPeriods, '2026-08-31')
        return s + (mb?.movement ?? 0)
      }, 0)
    const aug = figuresAt('2026-08-31', 'movement')
    expect(aug.grossProfit + otherIncome).toBeCloseTo(aug.revenue - aug.cogs, 6)
  })

  it('is read off the month movement, not the closing total, on the page', () => {
    const page = readFileSync(join(__dirname, '..', 'pages', 'ChartOfAccounts.tsx'), 'utf8')
    expect(page).toMatch(/const netIncome = revenueTotal - expenseTotal/)
    expect(page).toMatch(/const grossProfit = operatingRevenue - costOfSales/)
    expect(page).toMatch(/monthlyBalanceAsOf\([\s\S]{0,120}lastClosedMonth\.endDate\)/)
    expect(page).toMatch(/revenueTotal \+= mb\.movement/)
    expect(page).toMatch(/expenseTotal \+= mb\.movement/)
    expect(page).not.toMatch(/\+= mb\.closing/)
    expect(page).toMatch(/a\.statementClassification !== 'Other income'/)
  })
})

// Which month the performance figures cover. The subtlety is that this asks
// whether the month has *ended*, not whether its period has been closed.
describe('last ended month', () => {
  it('reads July when today is in August', () => {
    expect(lastEndedPeriod(seedPeriods, '2026-08-07')?.label).toBe('Jul 2026')
  })

  /* A month locks the day it ends (Mahad, 2026-10-11), so the last ended month
     is the last locked one, and its figure cannot move again. */
  it('is a locked month, so its figure is final', () => {
    const shown = lastEndedPeriod(seedPeriods, todayIso())
    expect(shown?.status).toBe('Hard-Locked')
  })

  it('never counts the month in progress, even on its last day', () => {
    expect(lastEndedPeriod(seedPeriods, '2026-08-31')?.label).toBe('Jul 2026')
    expect(lastEndedPeriod(seedPeriods, '2026-09-01')?.label).toBe('Aug 2026')
  })

  it('has nothing to show before the first month is out', () => {
    // The books open in January 2024 - the tenant carries two closed years behind
    // the current one so the period picker has a history to offer. Mid-January of
    // that first month is the only moment no month has ended yet.
    expect(seedPeriods[0].label).toBe('Jan 2024')
    expect(lastEndedPeriod(seedPeriods, '2024-01-15')).toBeUndefined()
  })

  it('is unmoved by the order the periods arrive in', () => {
    const shuffled = [...seedPeriods].reverse()
    expect(lastEndedPeriod(shuffled, '2026-08-07')?.label).toBe('Jul 2026')
  })
})
