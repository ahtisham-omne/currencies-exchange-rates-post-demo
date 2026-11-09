import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { GL_TYPE_DESCRIPTION, GLTypeLegend } from './glAccountTypeCopy'
import { NORMAL_BALANCE_HELP, NORMAL_BALANCE_CHOOSING, NormalBalanceHelp } from './normalBalanceCopy'
import { HEADER_DEFS } from '../components/AccountTable'

const strip = (el: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(el).replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ')

// Both fields are explained in more than one place, so the wording is pinned
// here rather than at each surface. These are supplied copy, not paraphrase:
// changing a word is a product decision, and should have to come through here.
describe('what a GL account type says it is', () => {
  it('says of a posting account that you post to it and that its balance is what you posted', () => {
    expect(GL_TYPE_DESCRIPTION.Posting).toBe(
      'An account you post transactions to. Its balance is the total of everything recorded against it.',
    )
  })

  it('says of a summary account that it totals others and takes no postings', () => {
    expect(GL_TYPE_DESCRIPTION.Summary).toBe(
      "An account that groups others and shows their combined total. You don't post to it.",
    )
  })

  it('shows both types together, so the choice is made by comparison', () => {
    const text = strip(createElement(GLTypeLegend))
    expect(text).toContain(GL_TYPE_DESCRIPTION.Summary)
    expect(text).toContain(GL_TYPE_DESCRIPTION.Posting)
    // Summary first: a summary carries the number its accounts sit beneath, so
    // the legend reads in the order the chart does.
    expect(text.indexOf('Summary')).toBeLessThan(text.indexOf('Posting'))
  })
})

describe('what normal balance says it is', () => {
  it('names the side and which categories sit on which', () => {
    expect(NORMAL_BALANCE_HELP).toBe(
      'The side where the account balance normally increases. Assets and expenses normally have a debit balance, while liabilities, equity, and revenue normally have a credit balance.',
    )
  })

  it('keeps when-to-change apart, so only a surface that can change it says so', () => {
    // Split out of the definition: the listing column is read, not set. Still
    // one string, so the form and the detail page cannot drift from each other.
    expect(NORMAL_BALANCE_CHOOSING).toMatch(/contra account/i)
    expect(NORMAL_BALANCE_CHOOSING).toMatch(/accumulated depreciation/i)
    expect(strip(createElement(NormalBalanceHelp))).toContain(NORMAL_BALANCE_CHOOSING)
  })

  it('reaches the reader on the listing through the same copy, not a rewrite of it', () => {
    // Identity against the shared constant, not a match: a hand-typed second
    // explanation of the field is exactly what this is here to catch.
    expect(HEADER_DEFS.normalBalance.info).toBe(NORMAL_BALANCE_HELP)
    expect(HEADER_DEFS.normalBalance.infoRich).toBeUndefined()
  })
})

describe('both fields', () => {
  const all = [
    ...Object.values(GL_TYPE_DESCRIPTION),
    NORMAL_BALANCE_HELP,
    NORMAL_BALANCE_CHOOSING,
    strip(createElement(NormalBalanceHelp)),
    strip(createElement(GLTypeLegend)),
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
})
