import { test, expect, type Page } from '@playwright/test'

/* Mahad, 2026-10-08: the panel of accounts added from your answers scrolls on
   its own when the pointer is over it - "very important in the smaller view of
   the modal". It is sticky, so without a height of its own a long list ran off
   the bottom with no way to reach it but scrolling the questions. In a browser
   because it is about wheel events and layout. */

async function toQuestions(page: Page, size: { width: number; height: number }) {
  await page.setViewportSize(size)
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.locator('table tbody tr').first().waitFor()
  await page.getByRole('button', { name: /View as first-time user/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Start guided setup' }).click()
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.getByRole('button', { name: 'Continue' }).last().click()
  await page.getByRole('button', { name: 'Skip for now' }).click()
  // Enough answers that the list outgrows the panel.
  for (const name of [/^Manufacture products/, /^Resell products you buy/, /^Provide services/, /^Sell subscriptions/, /^Work on long-term contracts/]) {
    await page.getByRole('button', { name }).first().click()
  }
  await page.getByRole('button', { name: /Core accounts/ }).first().click().catch(() => {})
}

for (const size of [{ width: 1280, height: 720 }, { width: 1440, height: 900 }]) {
  test(`scrolls the added accounts on their own, at ${size.width}x${size.height}`, async ({ page }) => {
    await toQuestions(page, size)
    const pane = page.locator('[data-added-pane]')
    const body = page.locator('[data-added-pane]').locator('xpath=ancestor::div[contains(@class,"overflow-y-auto")][1]')

    // Taller content than it shows, and inside what the body shows.
    await expect.poll(() => pane.evaluate(e => e.scrollHeight > e.clientHeight + 20)).toBe(true)
    const p = (await pane.boundingBox())!
    const b = (await body.boundingBox())!
    expect(p.y + p.height).toBeLessThanOrEqual(b.y + b.height + 1)

    // The wheel over it moves it, and leaves the questions where they were.
    const bodyTop = await body.evaluate(e => e.scrollTop)
    await page.mouse.move(p.x + p.width / 2, p.y + p.height / 2)
    await page.mouse.wheel(0, 400)
    await expect.poll(() => pane.evaluate(e => e.scrollTop)).toBeGreaterThan(0)
    expect(await body.evaluate(e => e.scrollTop)).toBe(bodyTop)
  })
}
