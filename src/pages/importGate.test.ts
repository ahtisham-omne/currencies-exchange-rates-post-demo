import { describe, it, expect } from 'vitest'
import { detectFileShape, patternFit, rowsWithoutDimensions } from '../lib/codeMapper'
import { gateWarningText } from './ImportAccounts'

/* Saying "no, these are one number" over a file whose numbers plainly come
   apart is the one answer nothing downstream can undo, so it is questioned
   once. What is guarded here is that the question is about the reader's own
   file: the separator and the count both have to come off what was uploaded,
   because a warning that says "a hyphen" over a file of slashes is worse than
   no warning at all. */

/** The warning as the wizard builds it, from numbers alone. */
function warn(numbers: string[]) {
  const shape = detectFileShape(numbers)
  // A shared leading block is what an ordinary numbering scheme looks like, so
  // only a separator is evidence enough to argue with the reader.
  if (!shape?.separator) return null
  const total = patternFit(numbers, shape).total
  const withDimensions = total - rowsWithoutDimensions(numbers, shape).length
  return { text: gateWarningText(shape.separator, withDimensions, total) }
}

const HYPHENS = ['01-100-5020', '01-100-5030', '01-200-5040', '02-100-5050']

describe('the warning is about the file in front of the reader', () => {
  it('says what the numbers carry, and names it', () => {
    expect(warn(HYPHENS)!.text)
      .toBe('Your account numbers contain a hyphen, so they may have multiple segments.')
  })

  // Every character that is not a letter or digit separates, so each one used is named.
  it('names every separator a file mixes', () => {
    expect(warn(['01-100.5020', '01-100.5030', '02-200.5040'])!.text).toContain('a hyphen and a full stop')
  })

  it('names the separator the file actually used, not the one the guide draws', () => {
    const slashes = HYPHENS.map(n => n.replace(/-/g, '/'))
    expect(warn(slashes)!.text).toContain('a slash')
    expect(warn(slashes)!.text).not.toContain('hyphen')
  })

  /* The plain sentence is a claim about all of them, so a file that only partly
     splits is counted instead. 5060 is a whole number in a file of split ones,
     and "your account numbers contain a hyphen" is a lie over it. */
  it('counts them instead of claiming all of them when only some come apart', () => {
    const mixed = [...HYPHENS, ...HYPHENS, '5060']
    expect(warn(mixed)!.text)
      .toBe('8 of your 9 account numbers contain a hyphen, so they may have multiple segments.')
  })

  /* Hedged on purpose, both halves of it: the file may split and the reader may
     still be right that it does not mean anything. What is stated flatly is the
     only thing the wizard knows for certain, which is what they answered. */
  it('says the numbers may have segments rather than that they do', () => {
    expect(warn(HYPHENS)!.text).toContain('may have multiple segments')
    expect(warn(HYPHENS)!.text).not.toContain('do have')
  })
})

describe('a file with no separator is never argued with', () => {
  it('says nothing about numbers that only share a leading block', () => {
    // 5020, 5030, 5040 read as split on the "50" they share, and calling that a
    // dimension would talk an ordinary chart out of the answer that is right.
    expect(warn(['5020', '5030', '5040'])).toBeNull()
    expect(warn(['015020', '015030', '015040', '025050'])).toBeNull()
  })
})
