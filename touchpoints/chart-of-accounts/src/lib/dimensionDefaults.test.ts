import { describe, it, expect } from 'vitest'
import { defaultValueOf, missingDefaults, normaliseDefaults, postingDimensions, withDefault } from './dimensionDefaults'
import { dimensionsOfAccount } from './journalEntry'

/* One default per dimension (Mahad, 2026-10-02): an account may carry USA and
   Singapore, but a line posted to it lands on one of them. */
const loc = (value: string, isDefault?: boolean) => ({ dimensionId: 'dim_location', value, ...(isDefault ? { isDefault } : {}) })
const dept = (value: string) => ({ dimensionId: 'dim_department', value })

describe('one default per dimension', () => {
  it('takes a lone value as the default, with no mark needed', () => {
    expect(defaultValueOf([loc('USA')], 'dim_location')).toBe('USA')
    expect(missingDefaults([loc('USA'), dept('Sales')])).toEqual([])
  })

  it('takes the marked value where a dimension holds several', () => {
    const pairs = [loc('USA'), loc('Singapore', true), dept('Sales')]
    expect(defaultValueOf(pairs, 'dim_location')).toBe('Singapore')
    expect(postingDimensions(pairs)).toEqual([{ dimensionId: 'dim_location', value: 'Singapore' }, { dimensionId: 'dim_department', value: 'Sales' }])
  })

  it('requires a default as soon as a second value is added', () => {
    expect(missingDefaults([loc('USA'), loc('Singapore')])).toEqual(['dim_location'])
  })

  it('guesses nothing: a dimension without its default is left off the posting', () => {
    expect(postingDimensions([loc('USA'), loc('Singapore'), dept('Sales')])).toEqual([{ dimensionId: 'dim_department', value: 'Sales' }])
  })

  it('posts a journal line with one value per dimension, never two', () => {
    const line = dimensionsOfAccount({ defaultDimensionValues: [loc('USA', true), loc('Singapore'), dept('Sales')] })
    expect(line.filter(v => v.dimensionId === 'dim_location')).toEqual([{ dimensionId: 'dim_location', value: 'USA' }])
  })

  it('marks one value and unmarks the rest', () => {
    const next = withDefault([loc('USA', true), loc('Singapore')], 'dim_location', 'Singapore')
    expect(next).toEqual([loc('USA'), loc('Singapore', true)])
  })

  it('keeps the mark only where it records a choice', () => {
    expect(normaliseDefaults([loc('USA', true)])).toEqual([loc('USA')])
    expect(normaliseDefaults([loc('USA', true), loc('Singapore', true)])).toEqual([loc('USA', true), loc('Singapore')])
  })
})
