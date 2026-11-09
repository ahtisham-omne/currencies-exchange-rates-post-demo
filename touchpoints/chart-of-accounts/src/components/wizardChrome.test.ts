import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

/* WizardChrome portals to <body>, so it cannot be rendered here the way the
   steps inside it can. What is worth pinning is not the markup anyway but the
   arithmetic of the panel's height, which is the one thing about this component
   nobody can check without a browser. */
const src = readFileSync(join(__dirname, 'WizardChrome.tsx'), 'utf8')

/* The component draws two wizards: a modal panel and a full-screen page. Only
   the panel has a height to hold, so the panel is what these read. */
const modal = src.split('\n  return createPortal(')[0]

/** The one class that sets the panel's height when `fixedHeight` is asked for. */
const fixed = src.match(/fixedHeight && '([^']+)'/)?.[1] ?? ''

describe('the panel held at one height', () => {
  it('sets that height in one place, so no step can disagree', () => {
    expect(src.match(/fixedHeight && '/g)).toHaveLength(1)
    expect(fixed).toBeTruthy()
  })

  it('caps it rather than taking a share of whatever display it lands on', () => {
    // A bare 90vh leaves the tallest step ending halfway down a tall display,
    // with the footer stranded a screenful below the last thing to read.
    expect(fixed).toMatch(/min\(/)
    expect(fixed).toMatch(/\d+px/)
  })

  it('still yields to a short viewport, so the footer cannot fall off one', () => {
    expect(fixed).toMatch(/100dvh/)
    expect(fixed).toMatch(/vh\s*,|,\s*\d+px/)
  })
})

/* The cap is only safe because the body absorbs what will not fit. A step taller
   than the cap has to scroll; if the header or footer could give instead, the
   reader would lose the trail or the button they came for. */
describe('what gives when a step outgrows the panel', () => {
  it('scrolls the body, and scrolls nothing else in the panel', () => {
    expect(modal).toContain('flex-1 min-h-0 overflow-y-auto')
    expect(modal.match(/overflow-y-auto/g)).toHaveLength(1)
  })

  it('holds the header and the footer at their own size', () => {
    expect(modal).toMatch(/pb-0 shrink-0 bg-white border-b/)
    expect(modal).toMatch(/shrink-0 border-t[^"]*bg-white/)
  })
})
