import { test, expect, type Page } from '@playwright/test'

/* A step's welcome opens a moment after the step does (2026-10-02). Closed if it
   came, so it never lands over whatever the test is pressing at the time. */
async function skipTour(page: Page) {
  try { await page.getByRole('button', { name: 'Skip for now' }).click({ timeout: 2500 }) } catch { /* none came */ }
}

/* The Number length step sits in the same frame on both paths. Mahad,
   2026-10-02: *"The margins in these two are different. Can you please make
   them same? Use build from scratch's one."* */

async function chooser(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.locator('table tbody tr').first().waitFor()
  await page.getByRole('button', { name: /View as first-time user/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
}

async function numberStep(page: Page, path: 'Start building' | 'Start guided setup') {
  await page.getByRole('button', { name: path }).click()
  const heading = page.getByText('Set up your account numbers')
  await expect(heading).toBeVisible()
  await page.waitForTimeout(400)
  const card = page.getByText('Default account number length', { exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded")][1]')
  const h = (await heading.boundingBox())!
  const c = (await card.boundingBox())!
  const weight = await heading.evaluate(el => getComputedStyle(el).fontWeight)
  await page.screenshot({ path: `test-results/number-frame-${path === 'Start building' ? 'scratch' : 'guided'}.png` })
  return { headingX: Math.round(h.x), cardX: Math.round(c.x), cardW: Math.round(c.width), weight }
}

test('build from scratch and guided setup frame the Number length step alike', async ({ page }) => {
  await chooser(page)
  const scratch = await numberStep(page, 'Start building')
  await skipTour(page)
  await page.getByRole('button', { name: 'Cancel' }).click()
  const guided = await numberStep(page, 'Start guided setup')
  expect(guided).toEqual(scratch)
})
