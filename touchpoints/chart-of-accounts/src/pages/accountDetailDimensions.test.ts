import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/* A dimension can be defined at the moment it is wanted, and the two moments
   are creating an account and reading one.

   Reading one is the one that was missing. The detail page showed an account's
   defaults as badges and offered no way to change them, so altering a single
   dropdown meant reopening the whole create form - past the number, the name and
   the classification, none of which were wrong. And what a reader notices there
   is rarely "this should be East"; it is "these should be split by region", and
   the dimension does not exist yet. Both of those end here now. */

const read = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8')

describe('default dimensions on the account page', () => {
  const detail = read('pages', 'AccountDetail.tsx')

  it('has a card of its own, next to the account\'s other facts', () => {
    expect(detail).toMatch(/function DefaultDimensionsCard/)
    expect(detail).toContain('<DefaultDimensionsCard account={account} />')
  })

  it('is on the posting template only, because a summary posts nothing', () => {
    // A default is what a posting starts with. A summary account produces a
    // figure from what is under it and has no entries of its own to seed.
    expect(detail.match(/<DefaultDimensionsCard /g)?.length).toBe(1)
  })

  it('edits through the same table the create flow uses', () => {
    // Not a second editor. A default set here and one set at creation have to be
    // set the same way, or the two surfaces drift until one can say something
    // the other cannot.
    // The modal is shared with the setup Accounts steps' "Add dimensions" since
    // 2026-10-08; the page opens it with a new dimension allowed, as the form does.
    const modal = read('components', 'AccountDimensionsModal.tsx')
    expect(modal).toContain('DimensionDefaultsEditor')
    expect(modal).toMatch(/DimensionDefaultsEditor[\s\S]{0,600}onCreateDimension/)
    expect(detail).toMatch(/<AccountDimensionsModal[\s\S]{0,300}allowNewDimension/)
  })

  it('saves through updateAccount, so the change lands in the activity log', () => {
    expect(detail).toMatch(/updateAccount\(account\.id, \{ defaultDimensionValues/)
  })

  it('opens the editor in a modal rather than squeezing it into the rail', () => {
    /* Three columns, one of them a dropdown that has to hold its longest value.
       The rail is a third of that wide, so the card states the answers and the
       modal is where they are given.

       Read as nesting rather than as "the modal is within N characters of the
       card", which was the same claim measured by proximity: it had spent all
       but 90 of its 3000 characters on the card's own markup, so the next
       comment written above the card failed it. */
    const card = detail.slice(detail.indexOf('function DefaultDimensionsCard'))
    const rail = card.indexOf('<DashInfoCard')
    const modal = card.indexOf('<AccountDimensionsModal')
    expect(modal).toBeGreaterThan(-1)
    // The rail card comes first and states the answers; the editor is inside
    // the modal that follows it, not inside the rail.
    expect(rail).toBeGreaterThan(-1)
    expect(rail).toBeLessThan(modal)
    const shared = read('components', 'AccountDimensionsModal.tsx')
    expect(shared.indexOf('<DimensionDefaultsEditor')).toBeGreaterThan(shared.indexOf('<FormModal'))
  })
})

describe('defining a dimension from the create flow', () => {
  const form = read('pages', 'CreateAccount.tsx')

  it('is wired to the store from both shapes of the form', () => {
    expect(form.match(/onCreateDimension=\{draft => store\.addDimension\(draft\)\}/g)?.length).toBe(2)
  })

  it('uses the standing page\'s form, not a copy of it', () => {
    // Two forms for one record would drift, and a dimension defined mid-create
    // and one defined a month later have to be the same thing.
    expect(form).toMatch(/import \{ DimensionFormModal,[^}]*\} from '\.\.\/components\/DimensionsEditor'/)
  })
})

describe('one Escape, one modal', () => {
  it('closes only the top one', () => {
    /* The dimension form opens over the create wizard. Every panel listened on
       the document, so the one keypress reached both and dismissing the little
       form took the half-filled account with it. */
    const ui = read('components', 'ui.tsx')
    expect(ui).toContain('const escapeStack')
    expect(ui).toMatch(/escapeStack\[escapeStack\.length - 1\] === me/)
    // No panel left listening on its own.
    expect(ui).not.toMatch(/if \(e\.key === 'Escape'\) onClose\(\)/)
    expect(ui.match(/useEscapeToClose\(/g)?.length).toBeGreaterThanOrEqual(5)
  })
})

describe('the word', () => {
  it('is dimension on every surface that shows a default', () => {
    for (const path of [['pages', 'CreateAccount.tsx'], ['pages', 'AccountDetail.tsx']]) {
      expect(read(...path)).not.toMatch(/group.filter/i)
    }
    // The step's own copy said "Leave a filter unset" long after the rename. It
    // now opens by defining the noun outright, which is the stronger pin: the
    // word cannot slip back without this sentence going with it.
    expect(read('pages', 'CreateAccount.tsx')).toContain('A dimension is something your company wants to organize or filter accounts by')
  })
})
