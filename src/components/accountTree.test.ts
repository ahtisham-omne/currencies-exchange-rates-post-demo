import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { AccountTable, AccountTree, DEFAULT_COLUMNS, DEFAULT_COLUMN_ORDER, INDENT_STEP, LEAF_LEAD, NAME_INDENT_BASE } from './AccountTable'
import { seedAccounts } from '../lib/seed'
import type { Account } from '../types'

// Collapsing is the one part of the tree that only exists as rendered output:
// which rows are on screen is not a value any pure function returns, so nothing
// else in this suite can see it. It has broken silently once - a collapsed
// category still drew its whole subtree, because hiding the accounts under the
// category head used to mean filtering a flat row list and now means not walking
// this row's own children - so it is worth the cost of a render.
//
// A static render is enough: expansion is driven entirely by the two props below,
// so passing the state a click would produce shows what the click would show.

const live = seedAccounts.filter(a => a.status !== 'Archived')
const allSummaries = new Set(live.filter(a => !a.isPosting).map(a => a.id))
const CATEGORIES = ['AST', 'LIA', 'EQT', 'REV', 'EXP']

// The account numbers the tree prints, which is what "visible" means here.
function visibleNumbers(expanded: Set<string>, collapsedGroups: Set<string>): Set<string> {
  const html = renderToStaticMarkup(
    createElement(MemoryRouter, null,
      createElement(AccountTree as any, {
        accounts: live, query: '', density: 'condensed', columns: DEFAULT_COLUMNS,
        onAction: () => {}, onOpen: () => {}, onToggle: () => {}, onToggleGroup: () => {},
        expanded, collapsedGroups, readOnly: true,
      })))
  return new Set([...html.matchAll(/tabular-nums[^>]*>(?:<span[^>]*>)?(\d{5})</g)].map(m => m[1]))
}

describe('account tree collapsing', () => {
  const everything = visibleNumbers(allSummaries, new Set())

  it('shows the whole chart when nothing is collapsed', () => {
    expect(everything.size).toBe(live.length)
  })

  it('hides the accounts under a summary, keeping the summary itself', () => {
    const cash = live.find(a => a.accountNumber === '11100')!
    const under = new Set(live.filter(a => a.parentId === cash.id).map(a => a.accountNumber))
    expect(under.size).toBeGreaterThan(0)

    const collapsed = new Set(allSummaries); collapsed.delete(cash.id)
    const shown = visibleNumbers(collapsed, new Set())
    expect(shown.has('11100')).toBe(true)
    for (const n of under) expect(shown.has(n), n).toBe(false)
  })

  it('collapses a category to its head without touching the others', () => {
    const shown = visibleNumbers(allSummaries, new Set(['AST']))
    expect(shown.has('10000')).toBe(true)
    expect([...shown].some(n => n.startsWith('1') && n !== '10000')).toBe(false)
    // Every other category still reads in full.
    for (const n of everything) if (!n.startsWith('1')) expect(shown.has(n), n).toBe(true)
  })

  it('collapses all the way down to the five category heads', () => {
    const shown = visibleNumbers(new Set(), new Set(CATEGORIES))
    expect([...shown].sort()).toEqual(['10000', '20000', '30000', '40000', '50000'])
  })

  it('restores the hidden accounts when the category reopens', () => {
    expect(visibleNumbers(allSummaries, new Set())).toEqual(everything)
  })
})

// The list and the tree are two views of one chart, so a row has to sit at the
// same level in both. They reach that level by different routes - the tree by
// recursing, the list by looking each row's parents up - which is exactly the
// split that let them disagree before, on a filtered chart: the list indented a
// row for parents that were not on screen.

// Each rendered row's number and the padding on its name cell, which is the
// indent the reader sees.
function indents(markup: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const tr of markup.split('<tr').slice(1)) {
    const num = tr.match(/tabular-nums[^>]*>(?:<span[^>]*>)?(\d{5})</)
    if (!num) continue
    const pad = tr.match(/padding-left:([\d.]+)px[^"]*"[^>]*>(?:<span aria-hidden|<div class="flex items-center gap-1\.5)/)
    out.set(num[1], pad?.[1] ?? 'none')
  }
  return out
}

const shared = {
  query: '', density: 'condensed', columns: DEFAULT_COLUMNS, order: DEFAULT_COLUMN_ORDER,
  onAction: () => {}, onOpen: () => {}, readOnly: true, noInlineInsert: true,
}
const listMarkup = (accounts: Account[], extra: object = {}) => renderToStaticMarkup(createElement(MemoryRouter, null,
  createElement(AccountTable as any, { ...shared, accounts, ...extra })))
const treeMarkup = (accounts: Account[], extra: object = {}) => renderToStaticMarkup(createElement(MemoryRouter, null,
  createElement(AccountTree as any, {
    ...shared, accounts, expanded: allSummaries, onToggle: () => {}, collapsedGroups: new Set(), onToggleGroup: () => {}, ...extra,
  })))
const listIndents = (accounts: Account[]) => indents(listMarkup(accounts))
const treeIndents = (accounts: Account[]) => indents(treeMarkup(accounts))

describe('list and tree indent the same chart the same way', () => {
  it('agrees on every row of the whole chart', () => {
    expect(listIndents(live)).toEqual(treeIndents(live))
  })

  it('agrees when a filter leaves only leaves, re-rooting rather than indenting for absent parents', () => {
    const leaves = live.filter(a => /petty|prepaid/i.test(a.accountName))
    expect(leaves.length).toBeGreaterThan(1)
    const list = listIndents(leaves)
    expect(list).toEqual(treeIndents(leaves))
    // Specifically: a posting three levels down in the full chart reads at the
    // top level once its parents are filtered out.
    expect(list.get('11110')).toBe(String(NAME_INDENT_BASE))
  })

  // The two views used to size Name differently - a responsive class in the tree, a
  // fixed pin width in the list - so the same column of the same listing came out a
  // different width depending on which way you were looking at it.
  it('pins the name column to the same width in both views', () => {
    // Every cell pinned at the Number column's width is a name cell.
    const nameWidths = (markup: string) =>
      new Set([...markup.matchAll(/left:76px;[^"]*?max-width:([\d.]+)px/g)].map(m => m[1]))
    const list = nameWidths(listMarkup(live))
    expect(list.size).toBe(1)
    expect(nameWidths(treeMarkup(live))).toEqual(list)
  })
})

// Both views drop a vertical guide per level. Elbows are tree-only: an elbow points
// at the toggle it branches into, and only the tree has toggles.
//
// Within the tree, the rounded elbow means "this row hangs off the line above it", so
// every nested row draws exactly one. A summary draws one too: it is a child of the
// row above and a parent of the rows below, and those are two different lines. Easy
// to get wrong in either direction - the elbow is drawn at whichever level is
// innermost and every row has one of those, so a row can end up with several or with
// none.

// Each rendered row's number against how many elbows its name cell draws.
function elbows(markup: string): Map<string, number> {
  const out = new Map<string, number>()
  for (const tr of markup.split('<tr').slice(1)) {
    const num = tr.match(/tabular-nums[^>]*>(?:<span[^>]*>)?(\d{5})</)
    if (num) out.set(num[1], (tr.match(/rounded-bl-\[\d+px\]/g) ?? []).length)
  }
  return out
}

// Each rendered row's number against whether it takes the short lead: the small
// placeholder a row with nothing to expand puts where the button would be.
const SHORT_LEAD = new RegExp(`class="shrink-0" style="width:${LEAF_LEAD}px"`)
function shortLeads(markup: string): Map<string, boolean> {
  const out = new Map<string, boolean>()
  for (const tr of markup.split('<tr').slice(1)) {
    const num = tr.match(/tabular-nums[^>]*>(?:<span[^>]*>)?(\d{5})</)
    if (num) out.set(num[1], SHORT_LEAD.test(tr))
  }
  return out
}

// Where a row's name actually begins: the name cell's own indent - the only inline
// padding-left on the row, since the frozen pins set left and width - plus whatever
// the row put before the name, plus the flex gap between the two.
const TOGGLE_W = 20
const NAME_GAP = 6
function nameStarts(markup: string): Map<string, number> {
  const out = new Map<string, number>()
  for (const tr of markup.split('<tr').slice(1)) {
    const num = tr.match(/tabular-nums[^>]*>(?:<span[^>]*>)?(\d{5})</)
    const pad = tr.match(/padding-left:([\d.]+)px/)
    if (num && pad) out.set(num[1], Number(pad[1]) + (SHORT_LEAD.test(tr) ? LEAF_LEAD : TOGGLE_W) + NAME_GAP)
  }
  return out
}

// Each rendered row's number against how many vertical guide lines it draws.
function trunks(markup: string): Map<string, number> {
  const out = new Map<string, number>()
  for (const tr of markup.split('<tr').slice(1)) {
    const num = tr.match(/tabular-nums[^>]*>(?:<span[^>]*>)?(\d{5})</)
    if (num) out.set(num[1], (tr.match(/class="absolute w-px bg-slate-200/g) ?? []).length)
  }
  return out
}

describe('every nested row in the tree is branched into', () => {
  const byNumber = new Map(live.map(a => [a.accountNumber, a]))

  it('draws exactly one elbow per nested row, summaries included', () => {
    const drawn = elbows(treeMarkup(live))
    expect(drawn.size).toBe(live.length)
    for (const [number, count] of drawn) {
      const a = byNumber.get(number)!
      // A top-level row has no parent to hang off, so it draws nothing.
      expect(count, `${number} ${a.accountName}`).toBe(a.parentId ? 1 : 0)
    }
    // Nested summaries exist, so "summaries included" is not vacuous.
    const nestedSummaries = live.filter(a => !a.isPosting && a.parentId)
    expect(nestedSummaries.length).toBeGreaterThan(20)
    for (const a of nestedSummaries) expect(drawn.get(a.accountNumber), a.accountName).toBe(1)
  })

  it('keeps the vertical guides but draws no elbow in list view', () => {
    const markup = listMarkup(live)
    // An elbow points at the toggle it branches into, and the list has no toggles.
    expect([...elbows(markup).values()].filter(Boolean)).toEqual([])
    const lines = trunks(markup)
    for (const [number, count] of lines) {
      const a = byNumber.get(number)!
      expect(count > 0, `${number} ${a.accountName}`).toBe(!!a.parentId)
    }
    expect([...lines.values()].filter(n => n > 0).length).toBeGreaterThan(90)
  })

  it('carries a vertical guide per level above every nested row', () => {
    const drawn = trunks(treeMarkup(live))
    const hasKids = (a: Account) => live.some(k => k.parentId === a.id)
    for (const [number, count] of drawn) {
      const a = byNumber.get(number)!
      // A nested row hangs off at least the trunk it branches from. A root has no
      // trunk above it, and draws only the line dropping out of its own toggle.
      expect(count > 0, `${number} ${a.accountName}`).toBe(!!a.parentId || hasKids(a))
    }
    expect([...drawn.values()].filter(n => n > 0).length).toBeGreaterThan(90)
  })

  it('stops the elbow short of the row it points at, never touching the toggle', () => {
    // The elbow hangs off the parent's toggle centre and reaches back toward the
    // child's own indent. It has to stop short: run it the whole way and the tip
    // lands on the child's expand toggle, which reads as the line growing out of
    // the button rather than pointing at it.
    const drawn = [...treeMarkup(live).matchAll(/rounded-bl-\[\d+px\]" style="left:([\d.]+)px;[^"]*width:([\d.]+)px/g)]
      .map(m => ({ left: Number(m[1]), reach: Number(m[1]) + Number(m[2]) }))
    expect(drawn.length).toBeGreaterThan(90)
    const levels = new Set<number>()
    for (const { left, reach } of drawn) {
      // Which row an elbow serves follows from where it hangs: one level in from the
      // parent whose toggle centre it sits on.
      const level = Math.round((left - NAME_INDENT_BASE - 10) / INDENT_STEP) + 1
      levels.add(level)
      const content = NAME_INDENT_BASE + level * INDENT_STEP
      expect(content - reach, `elbow at ${left}`).toBeGreaterThanOrEqual(3)
    }
    // Rows hang at more than one level, so the arithmetic above is exercised.
    expect(levels.size).toBeGreaterThan(1)
  })

  // The lead a row puts before its name follows from that row alone: a button if it
  // has one to give, the short placeholder if it has not. Sizing it to whether some
  // sibling happened to be expandable pushed a name 14px right of where its own
  // depth put it, clear of the elbow pointing at it, and close enough to the level
  // below that the two read as one.
  it('gives every row with nothing to expand the same short lead', () => {
    const leads = shortLeads(treeMarkup(live))
    const hasKids = (id: string) => live.some(a => a.parentId === id)
    let leaves = 0
    for (const [number, short] of leads) {
      const a = byNumber.get(number)!
      expect(short, `${number} ${a.accountName}`).toBe(!hasKids(a.id))
      if (!hasKids(a.id)) leaves++
    }
    expect(leaves).toBeGreaterThan(80)
  })

  it('starts a childless name at one place per depth, and a step in from the depth above', () => {
    const depthOf = (a: Account): number => {
      let d = 0
      for (let p = a.parentId; p; p = live.find(x => x.id === p)?.parentId ?? null) d++
      return d
    }
    const hasKids = (id: string) => live.some(a => a.parentId === id)
    const byDepth = new Map<number, Set<number>>()
    for (const [number, start] of nameStarts(treeMarkup(live))) {
      const a = byNumber.get(number)!
      if (hasKids(a.id)) continue
      const d = depthOf(a)
      byDepth.set(d, (byDepth.get(d) ?? new Set()).add(start))
    }
    expect(byDepth.size).toBeGreaterThan(2)
    for (const [d, starts] of byDepth) {
      expect([...starts], `depth ${d}`).toEqual([NAME_INDENT_BASE + d * INDENT_STEP + LEAF_LEAD + NAME_GAP])
    }
  })
})

// Selection is the same control in both views, which means the same checkbox on
// every row and the same two frozen columns sitting to the right of it. The
// offsets are worth asserting because they are computed independently in each
// view, and a mismatch reads as the Number column drifting when you scroll
// sideways rather than as anything to do with selection.

const selectable = { selectable: true, onToggleSelect: () => {}, onToggleAll: () => {}, selectedIds: new Set<string>() }
const checkboxes = (markup: string) => (markup.match(/class="coa-check"/g) ?? []).length
// The `left` offsets of the pinned header cells, which fix where the frozen
// columns start once the selection column is in front of them.
const headerPins = (markup: string) =>
  [...markup.slice(0, markup.indexOf('</thead>')).matchAll(/left:(-?[\d.]+)px/g)].map(m => m[1])

describe('bulk selection', () => {
  it('puts a checkbox on every row in both views, plus the header one', () => {
    expect(checkboxes(treeMarkup(live, selectable))).toBe(live.length + 1)
    expect(checkboxes(listMarkup(live, selectable))).toBe(live.length + 1)
  })

  it('pins the frozen columns at the same offsets in both views', () => {
    expect(headerPins(treeMarkup(live, selectable))).toEqual(headerPins(listMarkup(live, selectable)))
  })

  it('offers no checkbox at all when selection is off', () => {
    expect(checkboxes(treeMarkup(live))).toBe(0)
  })

  it('reaches only the rows on screen, so a collapsed chart selects its five heads', () => {
    const shut = treeMarkup(live, {
      ...selectable, expanded: new Set(), collapsedGroups: new Set(['AST', 'LIA', 'EQT', 'REV', 'EXP']),
    })
    expect(checkboxes(shut)).toBe(5 + 1)
  })

  it('tints the selected row and checks only its own box', () => {
    const one = live.find(a => a.accountNumber === '11110')!
    const markup = treeMarkup(live, { ...selectable, selectedIds: new Set([one.id]) })
    // Counted a tag at a time rather than by matching class and checked side by
    // side: nothing keeps those two attributes adjacent, and giving the box its
    // accessible name landed between them and broke this.
    const ticked = (markup.match(/<input[^>]*>/g) ?? [])
      .filter(t => t.includes('coa-check') && t.includes('checked=""'))
    expect(ticked.length).toBe(1)
    expect(markup).toContain('bg-[#F8FAFF]')
  })
})

// The hover-to-insert strip between two rows belongs to the chart builders only,
// and it broke silently once: it used to be drawn between consecutive *roots* of
// a category, and declared parentId nesting leaves each category with exactly one
// root, so every strip vanished. It is invisible until hovered, which is why
// nothing but a render catches it.

// Each strip's indent, keyed by the account number of the row it sits above.
function insertStrips(markup: string): Map<string, number> {
  const out = new Map<string, number>()
  const chunks = markup.split('<tr')
  for (let i = 1; i < chunks.length; i++) {
    if (!chunks[i].includes('Insert account here')) continue
    const left = chunks[i].match(/left:([\d.]+)px/)
    const below = chunks[i + 1]?.match(/tabular-nums[^>]*>(?:<span[^>]*>)?(\d{5})</)
    if (left && below) out.set(below[1], Number(left[1]))
  }
  return out
}

const builder = { readOnly: false, noInlineInsert: false, onCreateRow: () => {} }

describe('between-row insertion on the tree', () => {
  const strips = insertStrips(treeMarkup(live, builder))

  it('offers a strip between siblings, not just between category roots', () => {
    expect(strips.size).toBeGreaterThan(50)
  })

  it('never straddles two categories, so no strip sits above a category head', () => {
    for (const head of ['10000', '20000', '30000', '40000', '50000']) expect(strips.has(head), head).toBe(false)
  })

  it('indents the strip to the level of the account it would create', () => {
    // 1015 Cash and Cash Equivalents is a summary sitting under its category
    // root, so the strip above it creates a sibling of 1015 while the strip above
    // 1015's own first child creates a child of 1015 - one step further in.
    const cash = live.find(a => a.accountNumber === '11100')!
    const kids = live.filter(a => a.parentId === cash.id)
      .sort((x, y) => x.accountNumber.localeCompare(y.accountNumber))
    expect(kids.length).toBeGreaterThan(1)
    const atCash = strips.get('11100')!
    expect(atCash).toBeGreaterThan(0)
    expect(strips.get(kids[0].accountNumber)).toBe(atCash + INDENT_STEP)
    // A posting's next sibling is created beside it, so the strip stays put.
    expect(strips.get(kids[1].accountNumber)).toBe(atCash + INDENT_STEP)
  })

  it('offers none inside a collapsed summary', () => {
    const cash = live.find(a => a.accountNumber === '11100')!
    const shut = new Set(allSummaries); shut.delete(cash.id)
    const kids = live.filter(a => a.parentId === cash.id).map(a => a.accountNumber)
    const after = insertStrips(treeMarkup(live, { ...builder, expanded: shut }))
    for (const n of kids) expect(after.has(n), n).toBe(false)
  })

  it('offers none at all on the published listing, which opts out', () => {
    expect(insertStrips(treeMarkup(live, { ...builder, noInlineInsert: true })).size).toBe(0)
  })

  /* Opting out takes the "Add row" under the last row with it. Half an opt-out
     left the listing with one row still inviting a number to be typed into it,
     which is the act the opt-out exists to keep off this screen. */
  it('leaves no add row standing on the listing either', () => {
    for (const markup of [
      treeMarkup(live, { ...builder, noInlineInsert: true }),
      listMarkup(live, { ...builder, noInlineInsert: true }),
    ]) {
      expect(markup).not.toContain('Add row')
    }
    // Still offered where a chart is being built rather than read.
    expect(listMarkup(live, builder)).toContain('Add row')
  })
})

// Role and Normal balance are the two columns a reader scans to catch an account
// that was set up wrong: classified as the wrong kind, or growing on the wrong
// side. Both are only useful if they are on by default, and Normal balance is
// only trustworthy if the stored value still agrees with what the category and
// the contra flag imply - it is the field every ledger figure takes its sign
// from, so a stale one is invisible until a statement is wrong.

// Each rendered row's number against the text of its normal-balance chip.
function normalBalances(markup: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const tr of markup.split('<tr').slice(1)) {
    const num = tr.match(/tabular-nums[^>]*>(?:<span[^>]*>)?(\d{5})</)
    if (num) out.set(num[1], tr.match(/>(Debit|Credit)</)?.[1] ?? 'none')
  }
  return out
}

describe('role and normal balance on the listing', () => {
  const byNumber = new Map(live.map(a => [a.accountNumber, a]))
  const expected = (a: Account) => {
    const base = a.accountType === 'AST' || a.accountType === 'EXP' ? 'Debit' : 'Credit'
    return a.isContra ? (base === 'Debit' ? 'Credit' : 'Debit') : base
  }

  it('shows both columns without the reader opening the Columns panel', () => {
    expect(DEFAULT_COLUMNS.role).toBe(true)
    expect(DEFAULT_COLUMNS.normalBalance).toBe(true)
    expect(DEFAULT_COLUMN_ORDER).toContain('normalBalance')
  })

  it('prints a side on every row, in both views, matching category and contra', () => {
    for (const markup of [listMarkup(live), treeMarkup(live)]) {
      const drawn = normalBalances(markup)
      expect(drawn.size).toBe(live.length)
      for (const [number, side] of drawn) {
        const a = byNumber.get(number)!
        expect(side, `${number} ${a.accountName}`).toBe(expected(a))
      }
    }
  })

  it('flips the contra accounts, so the assertion above is not just the category', () => {
    const contra = live.filter(a => a.isContra)
    expect(contra.length).toBeGreaterThan(3)
    for (const a of contra) expect(a.normalBalance, a.accountName).not.toBe(expected({ ...a, isContra: false }))
  })

  it('keeps the stored side in step with the category it derives from', () => {
    for (const a of seedAccounts) expect(a.normalBalance, `${a.accountNumber} ${a.accountName}`).toBe(expected(a))
  })

  /* The role used to raise its whole explanatory card on hover, and no longer
     does: a pointer crossing the column on its way somewhere else threw a card
     over the rows underneath, and the reader who wanted the explanation was not
     the one who triggered it. The card still opens where a role is chosen. */
  it('names the role as plain text, with nothing on hover', () => {
    const classified = live.filter(a => !!a.accountRole)
    expect(classified.length).toBeGreaterThan(20)
    let checked = 0
    for (const tr of listMarkup(classified).split('<tr').slice(1)) {
      const num = tr.match(/tabular-nums[^>]*>(?:<span[^>]*>)?(\d{5})</)
      if (!num) continue
      const a = byNumber.get(num[1])!
      // Found by its text rather than by position: the row carries other plain
      // text now, the statement classification among it.
      const spans = [...tr.matchAll(/<span class="([^"]*)">\s*([^<]+?)\s*<\/span>/g)]
      const el = spans.find(m => m[2] === a.accountRole)
      expect(el, `${num[1]} ${a.accountName}`).toBeTruthy()
      /* No cursor-help, which is the static tell that a hover would say more, and
         no pill: a bordered chip here would read as a status alongside the
         Category and GL type chips. */
      expect(el![1], `${num[1]} ${a.accountName}`).not.toMatch(/cursor-help|rounded|border-/)
      checked++
    }
    expect(checked).toBe(classified.length)
  })
})

// A chart imported with its own segmented codes (100-1000-000) carries numbers
// three times as long as the four digits a chart is usually numbered in. Sized for
// four digits, the column had no way to show one but to wrap it onto three lines,
// and one such number set the height of every row around it.
describe('the number column sizes itself to the numbers it holds', () => {
  // Ids the store does not know, so the table folds them into the chart it
  // measures. Re-rooted, because their parents are not among the rendered rows.
  const segmented = live.slice(0, 8).map(a => ({
    ...a, id: `seg_${a.id}`, parentId: null, accountNumber: `100-${a.accountNumber}-000`,
  }))
  // The pinned Number column is the run's first, so it is the cell pinned at 0.
  const numberWidth = (markup: string) => {
    const found = new Set([...markup.matchAll(/left:0;[^"]*?;width:(\d+)px/g)].map(m => m[1]))
    expect(found.size).toBe(1)
    return Number([...found][0])
  }

  it('keeps the narrow default on a four-digit chart', () => {
    expect(numberWidth(listMarkup(live))).toBe(76)
    expect(numberWidth(treeMarkup(live))).toBe(76)
  })

  it('widens for segmented numbers, by the same amount in both views', () => {
    const w = numberWidth(listMarkup(segmented))
    expect(w).toBeGreaterThan(76)
    expect(numberWidth(treeMarkup(segmented))).toBe(w)
  })

  it('starts the name column where the number column ends', () => {
    const w = numberWidth(listMarkup(segmented))
    for (const markup of [listMarkup(segmented), treeMarkup(segmented)]) {
      expect(markup).toContain(`left:${w}px`)
    }
  })

  it('clips a number too long for the column instead of wrapping it', () => {
    for (const markup of [listMarkup(segmented), treeMarkup(segmented)]) {
      for (const a of segmented) {
        // The full number stays reachable on hover, which is the whole point of
        // clipping rather than shrinking the text.
        expect(markup, a.accountNumber).toContain(`class="block truncate" title="${a.accountNumber}"`)
      }
    }
  })
})

