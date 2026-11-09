import { test, expect } from '@playwright/test'

/* How it works, on every panel that uses it (Mahad, 2026-10-08): the whole
   header of a section is the button, padding included, and hovering it lifts the
   card the way the "Take the walkthrough" row lifts. In a browser because both
   are about where the pointer is. */

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'How it works' }).click()
})

const section = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('dialog', { name: 'Chart of accounts' }).getByRole('button', { name })

test('opens from the padding of its header, not only from its words', async ({ page }) => {
  const head = section(page, 'How do I add an account?')
  await expect(head).toHaveAttribute('aria-expanded', 'false')
  // Below the first section, which opens on arrival, so brought into view; and
  // the panel slides in, so read where it is once it has stopped moving.
  await head.scrollIntoViewIfNeeded()
  // The card's box, not the button's: the old header was a button the size of
  // its text inside the card's padding, so a corner of the button was still text.
  const card = head.locator('xpath=..')
  let b = (await card.boundingBox())!
  await expect.poll(async () => {
    const now = (await card.boundingBox())!
    const still = now.x === b.x && now.y === b.y
    b = now
    return still
  }).toBe(true)
  // The card's top-left corner, well clear of the title text.
  await page.mouse.click(b.x + 4, b.y + 4)
  await expect(head).toHaveAttribute('aria-expanded', 'true')
})

test('lifts a shut card on hover: the muted fill and the strong border', async ({ page }) => {
  const head = section(page, 'How do I add an account?')
  const card = head.locator('xpath=..')
  const style = () => card.evaluate(e => [getComputedStyle(e).backgroundColor, getComputedStyle(e).borderTopColor])
  const [bgBefore] = await style()
  await head.hover()
  await expect.poll(async () => (await style())[0]).not.toBe(bgBefore)
  // #CBD5E1, the module's strong rule - not the text colour an invalid value
  // falls back to.
  await expect.poll(async () => (await style())[1]).toBe('rgb(203, 213, 225)')
})
