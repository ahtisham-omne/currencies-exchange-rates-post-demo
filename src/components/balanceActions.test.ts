import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { BalanceMenuItems } from './AccountTable'
import { useStore } from '../store'
import type { Account } from '../types'

/* Two verbs about an account's money, as opposed to its record: state where the
   balance started, and move it. They live in one component because the listing's
   row menu and the account's own page must offer the same pair - a reader who
   found the action on a row and then opened the account should not lose it. */

const CHART = useStore.getState().accounts
const posting = CHART.find(a => a.glAccountType === 'Posting' && a.status === 'Active' && !a.accountRole)!
const summary = CHART.find(a => a.glAccountType === 'Summary')!
const as = (patch: Partial<Account>): Account => ({ ...posting, ...patch })

const render = (a: Account) => renderToStaticMarkup(
  createElement(MemoryRouter, null,
    createElement(BalanceMenuItems, { a, onAction: () => {}, close: () => {}, size: 14 })))

const TOOLTIP_WRAP = '<span class="relative inline-flex w-full">'

// One item's markup up to its label, with the tooltip wrapper included when it
// has one - which is how a reason shows up here at all. The reason's own text is
// only in the document once hovered, so what is checkable statically is whether
// one was attached: MenuItem renders the bare button when given none.
const itemOf = (html: string, label: string) => {
  const at = html.indexOf(label)
  expect(at, label).toBeGreaterThan(-1)
  const open = html.lastIndexOf('<button', at)
  const from = html.slice(0, open).endsWith(TOOLTIP_WRAP) ? open - TOOLTIP_WRAP.length : open
  return html.slice(from, at)
}
const disabled = (html: string, label: string) => itemOf(html, label).includes('aria-disabled="true"')
const carriesReason = (html: string, label: string) => itemOf(html, label).startsWith(TOOLTIP_WRAP)

describe('what the two items are', () => {
  it('offers both on a posting account', () => {
    const html = render(posting)
    expect(html).toContain('Enter opening balance')
    expect(html).toContain('Create journal entry')
  })

  /* A summary has no balance of its own - it is the total of the accounts under
     it. An opening balance stated on one is a figure its children then
     contradict, and nothing posts to it directly. */
  it('offers neither on a summary account', () => {
    expect(render(summary)).toBe('')
  })

  it('leaves both live on an ordinary active account', () => {
    const html = render(posting)
    expect(disabled(html, 'Enter opening balance')).toBe(false)
    expect(disabled(html, 'Create journal entry')).toBe(false)
  })
})

/* Disabled rather than absent, and always with the reason. A missing verb sends
   the reader hunting for one that is right there; a greyed one with a sentence
   beside it answers the question they were about to ask. */
describe('where an entry cannot reach the account', () => {
  /* Not a control account, or retained earnings: the entry takes them, and
     asks for a reason and the document once the account is on a line (design
     review, 2026-09-28). Refusing here would send the reader round the one door
     the entry itself now opens. */
  it('lets a journal entry start on a control account or the manual retained earnings account', () => {
    expect(disabled(render(as({ accountRole: 'Accounts Receivable' })), 'Create journal entry')).toBe(false)
    expect(disabled(render(as({ accountRole: 'Retained Earnings Adjustments' })), 'Create journal entry')).toBe(false)
  })

  // The system half of retained earnings too, since 2026-10-09: the entry's
  // picker holds back summaries and nothing else (Mahad: *"Only make summary
  // accounts unselectable. all the others can be select"*), so the menu that
  // opens it does the same.
  it('lets a journal entry start on the system retained earnings account', () => {
    expect(disabled(render(as({ accountRole: 'Retained Earnings' })), 'Create journal entry')).toBe(false)
  })

  it('stops a journal entry on a deactivated account', () => {
    const html = render(as({ status: 'Inactive' }))
    expect(disabled(html, 'Create journal entry')).toBe(true)
    expect(carriesReason(html, 'Create journal entry')).toBe(true)
  })

  // Opening balance is the one that is only stopped here: a control account's
  // starting figure is still a real figure, and a deactivated account keeps its.
  it('stops both on an archived account, whose figures are closed', () => {
    const html = render(as({ status: 'Archived' }))
    expect(disabled(html, 'Enter opening balance')).toBe(true)
    expect(disabled(html, 'Create journal entry')).toBe(true)
  })

  it('still lets an opening balance be stated on a control account', () => {
    expect(disabled(render(as({ accountRole: 'Accounts Receivable' })), 'Enter opening balance')).toBe(false)
  })
})
