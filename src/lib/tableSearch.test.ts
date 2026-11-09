import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { listJoin, matchesSearch, searchMatcher, searchPatternSource } from './tableSearch'
import { Marked } from '../components/ui'

const marked = (text: string, q: string) => renderToStaticMarkup(createElement(Marked, { text, q }))

describe('what a table search finds', () => {
  it('ignores case', () => {
    expect(matchesSearch('Omne System', 'system')).toBe(true)
    expect(matchesSearch('Ayesha Khan', 'AYE')).toBe(true)
  })

  it('finds a figure with or without its thousands separators', () => {
    expect(matchesSearch('$ 1,250.00', '1250')).toBe(true)
    expect(matchesSearch('$ 1,250.00', '1,250')).toBe(true)
    expect(matchesSearch('$ 1250.00', '1,250')).toBe(true)
    expect(matchesSearch('$ 12,450,300.00', '2450300')).toBe(true)
    expect(matchesSearch('$ 1,250.00', '1350')).toBe(false)
  })

  it('reads a query as text, not as a pattern', () => {
    expect(matchesSearch('Cost (direct)', '(direct)')).toBe(true)
    expect(matchesSearch('abc', '.*')).toBe(false)
  })

  it('finds everything with an empty query, and nothing in an empty cell', () => {
    expect(searchMatcher('')('anything')).toBe(true)
    expect(searchPatternSource('   ')).toBeNull()
    expect(searchMatcher('a')('')).toBe(false)
    expect(searchMatcher('a')(undefined)).toBe(false)
  })
})

describe('what it marks is what it found', () => {
  it('marks the figure the separators split', () => {
    expect(marked('$ 1,250.00', '1250')).toContain('<mark class="mark">1,250</mark>')
  })

  it('marks every occurrence, in the cell\'s own case', () => {
    const html = marked('System posted by System', 'system')
    expect(html.match(/<mark class="mark">System<\/mark>/g)).toHaveLength(2)
  })

  it('leaves text alone when nothing is searched', () => {
    expect(marked('Ayesha Khan', '')).toBe('Ayesha Khan')
  })
})

describe('naming the columns a search brought out', () => {
  it('joins them the way a sentence does', () => {
    expect(listJoin(['Created by'])).toBe('Created by')
    expect(listJoin(['Created by', 'Dimensions'])).toBe('Created by and Dimensions')
    expect(listJoin(['A', 'B', 'C'])).toBe('A, B and C')
  })
})
