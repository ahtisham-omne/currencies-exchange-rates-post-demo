import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { formatInScheme, displayAccountNumber, ALL_CLASSIFICATIONS, type Account, type NumberingScheme } from '../types'
import { detectGluedCodes, buildSegmentDefs } from './codeMapper'
import { suggestNextNumberAgainst } from '../store'

// A scheme is its segments and nothing else: no band, no bounds, so a suggestion
// is decided by the numbers the chart already holds.
const wide = (segments: NumberingScheme['segments']): NumberingScheme => ({ segments })
// A flat four-digit scheme, stated here rather than borrowed from the demo's,
// which went to five digits on 2026-09-25 and would pad these fixtures.
const FLAT4: NumberingScheme = { segments: [{ index: 0, length: 4, meaning: 'Account', separator: '' }] }
const SECTION = ALL_CLASSIFICATIONS[0]
// A suggestion counts the accounts of the number's own category, so the fixtures
// have to state one. Current Assets is the section under test, so AST it is.
const mk = (accountNumber: string, extra: Partial<Account> = {}): Account =>
  ({ accountNumber, accountType: 'AST', ...extra } as Account)

const DASH_342 = buildSegmentDefs(detectGluedCodes(['100-2000-200']).segments, ['Company', undefined, 'Department'])

// The suggested number must come out shaped like the customer's own numbers.
describe('formatInScheme', () => {
  it('leaves a flat scheme as a bare number', () => {
    expect(formatInScheme(FLAT4, 1050)).toBe('1050')
  })

  it('zero-fills the other segments of a glued scheme when there is no template', () => {
    expect(formatInScheme(wide(DASH_342), 2010)).toBe('000-2010-000')
  })

  it('copies the other segments from a template number when given one', () => {
    expect(formatInScheme(wide(DASH_342), 2010, '100-2000-200')).toBe('100-2010-200')
  })
})

/* The import flow lets a glued chart choose to be read short. It is a display
   setting and nothing else: the account keeps the number the file carried, so
   these assertions are as much about what the helper refuses to change as about
   what it shortens. */
describe('displayAccountNumber', () => {
  const long = wide(DASH_342)
  const short = { ...long, numberDisplay: 'short' as const }

  it('shows a glued number whole until the chart says otherwise', () => {
    expect(displayAccountNumber(long, '100-2000-200')).toBe('100-2000-200')
    expect(displayAccountNumber({ ...long, numberDisplay: 'full' }, '100-2000-200')).toBe('100-2000-200')
  })

  it('shows the account part alone once shortened', () => {
    expect(displayAccountNumber(short, '100-2000-200')).toBe('2000')
  })

  it('reads the part the scheme calls the account, not the middle one', () => {
    // Same digits, and 'Account' now marks the first part rather than the second.
    const front = { ...short, segments: short.segments.map((s, i) => ({ ...s, meaning: i === 0 ? 'Account' : s.meaning })) }
    expect(displayAccountNumber(front, '100-2000-200')).toBe('100')
  })

  it('leaves a flat chart alone even if it somehow asked to shorten', () => {
    // One segment is the account, so there is nothing to take off it.
    expect(displayAccountNumber({ ...FLAT4, numberDisplay: 'short' }, '1020')).toBe('1020')
  })

  /* Numbers are accepted verbatim at import, so a chart can hold one that does
     not fit its own scheme. Showing nothing, or a slice of the wrong part, would
     lose the only identifier the row has. */
  it('falls back to the whole number when it does not fit the scheme', () => {
    expect(displayAccountNumber(short, '2000')).toBe('2000')
    expect(displayAccountNumber(short, '01-71100-40')).toBe('01-71100-40')
    expect(displayAccountNumber(short, '')).toBe('')
  })

  it('shortens for display without touching what two accounts are stored as', () => {
    // Two departments of one account collapse to the same label on screen, which
    // is the point: the dimension tells them apart, and the stored numbers still
    // differ.
    const rows = ['100-2000-200', '100-2000-300']
    expect(rows.map(n => displayAccountNumber(short, n))).toEqual(['2000', '2000'])
    expect(rows.map(n => displayAccountNumber(long, n))).toEqual(rows)
  })
})

/* Shortening is a reading of the number, so the modules that produce a file, a
   stored value or a match have to keep using the stored one. Nothing in a type
   signature stops them: displayAccountNumber takes a string and returns a
   string, so routing an export column through it would compile, pass every other
   test, and quietly hand the customer a spreadsheet of numbers their chart does
   not contain. Grepping the source is crude, but it is the only place this can
   be caught before a download goes out. */
describe('the shortened reading stays out of what leaves the app', () => {
  const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

  it.each([
    'pages/ExportAccounts.tsx',
    'lib/importTemplate.ts',
    'lib/uploadValidation.ts',
  ])('%s writes the stored number', file => {
    expect(src(file)).not.toContain('displayAccountNumber')
  })
})

describe('suggestNextNumberAgainst', () => {
  it('suggests the next flat number as before', () => {
    expect(suggestNextNumberAgainst(wide(FLAT4.segments), [mk('2010')], SECTION)).toBe('2020')
  })

  it('starts a category at its first number when it holds nothing yet', () => {
    expect(suggestNextNumberAgainst(wide(FLAT4.segments), [], SECTION)).toBe('1000')
  })

  it('suggests a glued number in the customer style, reading the account segment', () => {
    const scheme = wide(DASH_342)
    expect(suggestNextNumberAgainst(scheme, [mk('100-2000-200')], SECTION)).toBe('000-2010-000')
  })

  it('copies the parent block into the other segments of a glued suggestion', () => {
    const scheme = wide(DASH_342)
    const parent = mk('100-2000-000')
    expect(suggestNextNumberAgainst(scheme, [mk('100-2000-200')], SECTION, parent)).toBe('100-2010-000')
  })
})
