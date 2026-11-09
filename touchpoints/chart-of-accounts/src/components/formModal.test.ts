import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

/* FormModal portals to <body> and drives its height from a ResizeObserver, so
   neither the panel nor its arithmetic can be rendered here. What these read is
   the one thing about it that no browser pass would catch either: that the two
   ways it can be sized cannot both apply at once. */
const ui = readFileSync(join(__dirname, 'ui.tsx'), 'utf8')
const createAccount = readFileSync(join(__dirname, '../pages/CreateAccount.tsx'), 'utf8')

describe('a form panel held at one height', () => {
  it('replaces the height that sizes to content instead of layering over it', () => {
    // `cn` is plain clsx, so both utilities would reach the element and
    // stylesheet order would decide which height won.
    expect(ui).toContain("fixedHeight ?? 'sm:h-auto'")
    // The class literal, not the prose above it that names the same class.
    expect(ui.match(/'sm:h-auto'/g)).toHaveLength(1)
  })

  it('measures nothing while it is held, so no inline height can outrank it', () => {
    // The measured height lands in a style attribute, which beats any class.
    expect(ui).toMatch(/if \(!open \|\| full \|\| fixedHeight \|\|/)
    expect(ui).toMatch(/\}, \[open, full, fixedHeight\]\)/)
  })
})

/* The GL creation wizard is the caller that asks for this, and it asks for the
   height of its tallest step. Pinned taller than its own cap the panel would be
   capped back and the two numbers would be a lie about each other; pinned
   shorter, the cap would never be reached and the tallest step would scroll
   inside a panel with room to spare.

   Both are handed over conditionally, because the same component renders the
   bank details on their own, and one short step with no siblings has nothing to
   stay level with. */
describe('the GL creation modal', () => {
  const asked = createAccount.match(/fixedHeight=\{[^}]*'sm:h-\[([^\]]+)\]'/)?.[1]
  const cap = createAccount.match(/maxHeightClass=\{[^}]*'sm:max-h-\[([^\]]+)\]'/)?.[1]

  it('holds every step at one height', () => {
    expect(asked).toBeTruthy()
  })

  it('holds them at the height it raised its own cap to', () => {
    expect(cap).toBeTruthy()
    expect(asked).toBe(cap)
  })

  /* A height written only in vh is a promise about the monitor rather than
     about the form, and on a tall one it drew a modal the height of the screen.
     The pixel cap is the second half of the expression. */
  it('caps that height in pixels as well', () => {
    expect(asked).toContain('px)')
  })
})
