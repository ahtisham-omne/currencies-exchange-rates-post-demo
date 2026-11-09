import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  FISCAL_LOCKED_SETTINGS,
  FISCAL_LOCK_EXCEPTION,
  FISCAL_TIPS,
  FiscalYearPicker,
  fiscalYearOptions,
} from './FiscalYearPicker'
import { FISCAL_SETUP_BANNER } from '../pages/ChartOfAccounts'
import { EARLIER_YEARS_LEDE, EARLIER_YEARS_RULES } from '../pages/FiscalYearSettings'
import { buildPeriodsFromFirstYear, periodsWithEarlierYears } from '../lib/periodClose'

// The fiscal-year step is where a company's whole period structure is decided,
// and most of what it promises exists only as rendered output: which fields are
// offered, what each one says it does, and whether the inputs are still open.
// A static render is enough - the screen derives everything from the one date it
// is given, so passing that date shows what the reader would see.
//
// Two things the server renderer decides for us. useEffect never runs, so the
// mount commit does not fire and rendering leaves the store alone. And zustand
// serves the store's *initial* state to a server render, so setState cannot
// change what these renders see: the screen is always drawn for the seeded demo
// company, which has posted transactions. That makes the locked state the one
// reachable here; the rule that decides it is covered in periodClose.test.ts.
const render = (value?: string) =>
  renderToStaticMarkup(createElement(FiscalYearPicker as any, { value, onChange: () => {} }))

// A tooltip's body only mounts on hover, so the copy is pinned on the exported
// constants and the *triggers* are counted in the markup instead. Every trigger is
// the house 12px info icon, and no other icon on this screen is that size, so the
// count doubles as proof that all of them are the same control.
const infoTriggers = (html: string) => html.match(/height="12"/g)?.length ?? 0

describe('fiscal year screen - what it asks for', () => {
  it('asks two separate questions and no longer offers a cadence', () => {
    const html = render()
    expect(html).toContain('Fiscal year start month')
    // Mahad, 2026-10-08.
    expect(html).toContain('First fiscal year')
    // "In Omne" came off (2026-10-07): the reader is already in Omne.
    expect(html).not.toContain('in Omne')
    expect(html).not.toContain('First year of books')
    // Books are always kept monthly, so choosing quarterly could only cost the
    // reader their monthly closes.
    expect(html).not.toContain('Period length')
    expect(html).not.toContain('Quarterly')
  })

  it('asks its questions with nothing written under them', () => {
    // The fields used to restate the current answer as a sentence underneath
    // ("Your year will run July to June."), which said again what the field and
    // the preview beside it already showed. Every explanation is a hover away
    // now, so the two questions read as two questions.
    const thisYear = new Date().getFullYear()
    const january = render(`${thisYear}-01-01`)
    const july = render('2026-07-01')
    expect(january).not.toContain('Your year will run')
    expect(july).not.toContain('Your year will run')
    expect(july).not.toContain('will all call it')
    expect(render(`${thisYear - 2}-01-01`)).not.toContain('will build periods from')
  })

  it('keeps the reassurance and the exception on the explainer instead', () => {
    // Neither belongs on screen unprompted: one greets a reader who has nothing
    // to decide, the other a reader with no history to import. Both still have to
    // be reachable, which is what the tooltip is for.
    // Mahad's copy, 2026-10-08.
    expect(FISCAL_TIPS.firstYear).toBe("The year you'll start recording transactions in. If you're importing older transactions, pick the year they start in, or add earlier years later.")
    expect(render(`${new Date().getFullYear()}-01-01`)).not.toContain('importing')
  })

  it('offers one explainer per question, all on the same trigger', () => {
    // Fiscal year, start month, first year of books. The live preview's went
    // (Mahad, 2026-10-08).
    expect(infoTriggers(render(`${new Date().getFullYear()}-01-01`))).toBe(3)
    // Plus the naming question, which only a mid-year start asks.
    expect(infoTriggers(render('2026-07-01'))).toBe(4)
  })

  it('defines each term once, in its own tooltip, without an em dash', () => {
    const tips = Object.values(FISCAL_TIPS)
    expect(tips).toHaveLength(4)
    for (const tip of tips) {
      expect(tip).not.toContain('—')
      expect(tip).not.toContain('–')
      expect(tip.endsWith('.')).toBe(true)
    }
    // Mahad, 2026-10-08: one sentence.
    expect(FISCAL_TIPS.fiscalYear).toBe('The 12-month cycle Omne uses to group transactions and run reports.')
    // Mahad's copy, 2026-10-08.
    expect(FISCAL_TIPS.startMonth).toBe('The month your fiscal year starts. For example, April gives you a year that runs from April to March. You can change it until your first transaction posts to the General Ledger.')
    expect(FISCAL_TIPS.naming).toContain('only matters when your year spans two calendar years')
  })

  it('opens on this year, and offers the year as a year rather than an FY name', () => {
    const thisYear = new Date().getFullYear()
    const html = render()
    // The field asks for a year of books, so the choice itself is a plain year.
    expect(html).toContain(`<span class="truncate min-w-0">${thisYear}</span>`)
  })

  it('reaches twenty-five years back and never ahead, which is the history a migration can carry', () => {
    // The options live in the dropdown's popup, so the offer is pinned on the
    // function that builds it rather than on the closed trigger's markup.
    const offered = fiscalYearOptions(2026)
    expect(offered).toHaveLength(26)
    // Newest first: the list opens on the answer nearly everyone keeps, not on
    // the twenty-five-year-old floor of the window.
    expect(offered[0]).toBe(2026)
    expect(offered[offered.length - 1]).toBe(2001)
    // Books cannot begin in a year that has not begun.
    expect(Math.max(...offered)).toBe(2026)
    // A year already saved survives ageing out of the window, and sorts into
    // place rather than jumping to the top of the list.
    const withOld = fiscalYearOptions(2026, 1994)
    expect(withOld[0]).toBe(2026)
    expect(withOld[withOld.length - 1]).toBe(1994)
    expect(fiscalYearOptions(2026, 2024)).toEqual(offered)
  })

  it('locks every field once a period holds a posting', () => {
    const html = render(`${new Date().getFullYear()}-01-01`)
    expect(html).toContain('Transactions have posted into your periods, so your fiscal year settings are locked.')
    expect(html.match(/disabled=""/g)?.length).toBe(2)
    // Naming is only cosmetic, but a screen that announces a lock and leaves one
    // control live contradicts itself, and a year renamed after its reports have
    // been read is still a change to what those reports said.
    expect(render('2026-07-01').match(/disabled=""/g)?.length).toBe(3)
  })
})

describe('fiscal year screen - naming the year', () => {
  it('asks which calendar year names the year, but only when there are two', () => {
    // A January year ends in December, so both conventions agree and the question
    // would be a choice with no consequence.
    expect(render(`${new Date().getFullYear()}-01-01`)).not.toContain('Fiscal year naming convention')
    const july = render('2026-07-01')
    expect(july).toContain('Fiscal year naming convention')
    expect(july).toContain('<span class="truncate min-w-0">Start year</span>')
  })

})

describe('fiscal year screen - the live preview', () => {
  it('states the full span a January year runs', () => {
    const html = render('2026-01-01')
    expect(html).toContain('Jan 1, 2026')
    expect(html).toContain('Dec 31, 2026')
  })

  it('carries a mid-year start into the next calendar year', () => {
    const html = render('2026-07-01')
    expect(html).toContain('Jul 1, 2026')
    expect(html).toContain('Jun 30, 2027')
    // The last chip belongs to the following calendar year, and says so.
    expect(html).toContain('Jun</span><span class="text-fg-subtle">2027')
  })

  it('always shows twelve monthly periods, grouped into four quarters', () => {
    const html = render('2026-07-01')
    expect(html).toContain('· 12 monthly periods')
    expect(html.match(/text-11 tabular-nums/g)).toHaveLength(12)
    expect(['Q1', 'Q2', 'Q3', 'Q4'].every(q => html.includes(`>${q}</p>`))).toBe(true)
  })

  it('leads with the one name the year will carry, not the two calendar years it covers', () => {
    const thisYear = new Date().getFullYear()
    // Both a January and a mid-year start resolve to a single name, so nothing on
    // the screen leaves the reader to work out which year theirs is called.
    expect(render(`${thisYear}-01-01`)).toContain(`tracking-tight">FY${thisYear}</span>`)
    expect(render('2026-07-01')).toContain('tracking-tight">FY2026</span>')
    expect(render('2026-07-01')).not.toContain('2026–2027')
  })

  it('counts every year it will build without contradicting the twelve chips', () => {
    // Reaching back two years builds a year for each one since, so imported
    // history and today both have somewhere to post. Anchored on this year
    // because the count depends on how far the first year is from today.
    const thisYear = new Date().getFullYear()
    const html = render(`${thisYear - 2}-01-01`)
    expect(html).toContain('· 12 monthly periods')
    expect(html).toContain(`FY${thisYear - 2} through FY${thisYear} are all built, 36 monthly periods in total.`)
    // One year needs no such line - the chips are the whole answer.
    expect(render(`${thisYear}-01-01`)).not.toContain('in total.')
  })

  it('no longer welds the spanning-year fact to the opening-balances one', () => {
    // Those were two unrelated points in one amber box. Each now sits with the
    // question it answers: the spanning year with the field it makes necessary,
    // and the older-transactions point with the first fiscal year.
    const html = render('2026-07-01')
    expect(html).not.toContain('spans two calendar years')
    expect(html).not.toContain('prior-period activity')
    expect(FISCAL_TIPS.naming).toContain('spans two calendar years')
    expect(FISCAL_TIPS.firstYear).toContain("If you're importing older transactions")
  })

  it('groups quarters by the fiscal year, not the calendar year', () => {
    // A July start puts Jul-Aug-Sep in Q1, the same slicing the close engine uses.
    const q1 = render('2026-07-01').split('Q2</p>')[0]
    expect(q1).toContain('Jul')
    expect(q1).toContain('Sep')
    expect(q1).not.toContain('Jan')
  })
})

describe('fiscal year screen - what it warns about up front', () => {
  /* The lock itself is the page's subtitle, so the banner is only the half that
     answers it. Saying it in both places put the same warning twice on one
     screen, which reads as two different warnings until you compare them. */
  it('says what stays possible, and leaves the lock to the subtitle', () => {
    expect(FISCAL_SETUP_BANNER).toEqual([
      'You can add earlier years anytime.',
    ])
    expect(FISCAL_SETUP_BANNER.join(' ')).not.toContain('lock')
    expect(FISCAL_SETUP_BANNER.join(' ')).not.toContain('—')
  })

  /* It named the chart's Actions menu until that entry was removed. Directions to
     a control that is not there are worse than no directions, so if the line
     starts naming a way in again, that way in has to exist. */
  it('sends the reader nowhere it cannot send them', () => {
    const coa = readFileSync(join(__dirname, '../pages/ChartOfAccounts.tsx'), 'utf8')
    expect(coa).not.toContain('Fiscal year settings')
    expect(FISCAL_SETUP_BANNER.join(' ')).not.toContain('Actions')
  })

  it('names the three settings that freeze, once, with a reason each', () => {
    expect(FISCAL_LOCKED_SETTINGS).toHaveLength(3)
    // Named as their fields are.
    expect(FISCAL_LOCKED_SETTINGS[0]).toContain('Fiscal year start month')
    expect(FISCAL_LOCKED_SETTINGS[1]).toContain('Fiscal year naming')
    expect(FISCAL_LOCKED_SETTINGS[2]).toContain('First fiscal year')
    for (const line of FISCAL_LOCKED_SETTINGS) {
      // A lock with no reason reads as an arbitrary restriction.
      expect(line).toContain('because')
      expect(line).not.toContain('—')
    }
    // Reaching back is the exception, so the list cannot be read as freezing it.
    expect(FISCAL_LOCK_EXCEPTION).toContain('Adding earlier years')
  })

  it('says what freezes on the one trigger, not under every field', () => {
    // Each field used to carry its own "Locks after your first posted transaction"
    // line, which put the same sentence on screen up to three times before the
    // lock was anywhere near biting. The full list is a hover away instead.
    expect(render(`${new Date().getFullYear()}-01-01`)).not.toContain('Locks after your first posted')
    expect(FISCAL_TIPS.startMonth).toContain('until your first transaction posts')
  })
})

describe('fiscal year settings - the home for adding earlier years', () => {
  it('states the three rules that make reaching back safe', () => {
    expect(EARLIER_YEARS_RULES.map(r => r.title)).toEqual([
      'Same start month',
      'Same naming',
      'Where opening balances go',
    ])
    for (const r of EARLIER_YEARS_RULES) {
      expect(r.body.endsWith('.')).toBe(true)
      expect(r.body).not.toContain('—')
    }
    // The one thing a reader fears about reaching back, answered before they act.
    expect(EARLIER_YEARS_LEDE).toContain('Nothing already posted moves')
  })
})

describe('fiscal year settings - adding earlier years', () => {
  const TODAY = '2026-08-25'
  const built = (start: string) => buildPeriodsFromFirstYear(start, TODAY)

  it('builds every month back to the year picked, in the shape already saved', () => {
    const before = built('2026-07-01')
    const after = periodsWithEarlierYears(before, '2026-07-01', 2024, TODAY)
    expect(after.length).toBe(before.length + 24)
    // The mid-year start carries back, so the earliest month is a July.
    expect(after[0].startDate).toBe('2024-07-01')
  })

  it('leaves the periods it already has alone, close status and all', () => {
    const before = built('2026-01-01').map((p, i) => (i === 0 ? { ...p, status: 'Hard-Locked' as const } : p))
    const after = periodsWithEarlierYears(before, '2026-01-01', 2025, TODAY)
    expect(after).toHaveLength(before.length + 12)
    expect(after.find(p => p.id === before[0].id)?.status).toBe('Hard-Locked')
  })

  it('refuses a year that is not earlier, which would strand posted periods', () => {
    const before = built('2026-01-01')
    expect(periodsWithEarlierYears(before, '2026-01-01', 2026, TODAY)).toBe(before)
    expect(periodsWithEarlierYears(before, '2026-01-01', 2027, TODAY)).toBe(before)
  })
})
