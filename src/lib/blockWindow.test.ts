import { describe, expect, it } from 'vitest'
import { blockOffsets, blocksInView } from './blockWindow'

// Four blocks of 2,000px; an 800px viewport; a 400px margin.
const offsets = blockOffsets([2000, 2000, 2000, 2000])
const at = (top: number) => blocksInView(offsets, top, top + 800, 400)

describe('blocksInView', () => {
  it('draws the first block alone on arrival', () => {
    expect(at(0)).toEqual({ first: 0, last: 0 })
  })

  it('brings in the next block before the reader reaches it', () => {
    expect(at(799)).toEqual({ first: 0, last: 0 })
    expect(at(800)).toEqual({ first: 0, last: 1 })
  })

  it('lets the first block go once the reader is a margin past it', () => {
    expect(at(2000)).toEqual({ first: 0, last: 1 })
    expect(at(2500)).toEqual({ first: 1, last: 1 })
    expect(at(2800)).toEqual({ first: 1, last: 2 })
  })

  it('brings a block back before the reader scrolls up into it', () => {
    expect(at(2400)).toEqual({ first: 0, last: 1 })
    expect(at(2401)).toEqual({ first: 1, last: 1 })
  })

  it('never draws more than two blocks, even on a screen taller than one', () => {
    for (let top = 0; top < 8000; top += 100) {
      const { first, last } = blocksInView(offsets, top, top + 3000, 400)
      expect(last - first).toBeLessThanOrEqual(1)
    }
  })

  it('stops at the last block', () => {
    expect(at(7200)).toEqual({ first: 3, last: 3 })
    expect(at(9000)).toEqual({ first: 3, last: 3 })
  })

  it('draws a list of one block whole', () => {
    expect(blocksInView(blockOffsets([500]), 0, 800, 400)).toEqual({ first: 0, last: 0 })
    expect(blocksInView(blockOffsets([]), 0, 800, 400)).toEqual({ first: 0, last: 0 })
  })
})
