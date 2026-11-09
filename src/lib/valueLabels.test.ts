import { describe, it, expect } from 'vitest'
import { labelProgress } from './valueLabels'
import { VALUE_MEANS_NOTHING } from './codeMapper'

const CODES = ['01', '02', '03']

/* All that is left of this module. It used to also read a paste of code/name
   pairs and lift names out of a column the file carried, and the tests that
   pinned both are gone with the controls that reached them: naming is optional,
   so the bulk routes were machinery for a job nobody has to finish. The count
   survives because each dimension's tab still shows how many of its codes are
   named. */
describe('how much naming is done', () => {
  it('separates named codes from the ones importing as digits', () => {
    expect(labelProgress(CODES, { '01': 'UK Ltd' })).toEqual({ named: 1, meansNothing: 0, asCode: 2 })
  })

  it('counts a code that means nothing apart from an unnamed one', () => {
    expect(labelProgress(CODES, { '01': 'UK Ltd', '02': VALUE_MEANS_NOTHING }))
      .toEqual({ named: 1, meansNothing: 1, asCode: 1 })
  })

  // A name typed and then cleared is not a name, so it imports as the code.
  it('does not count a name that was cleared', () => {
    expect(labelProgress(CODES, { '01': '   ' }).asCode).toBe(3)
  })

  it('counts nothing when the part has no codes', () => {
    expect(labelProgress([], {})).toEqual({ named: 0, meansNothing: 0, asCode: 0 })
  })
})
