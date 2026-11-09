import { test, expect, type Page, type Locator } from '@playwright/test'

/* The placement preview leaves the listing's air between an elbow and the name it
   points at. Mahad, 2026-10-01: *"Can we have a bit more spacing of the text from
   the lines? Right now it feels too congested."* No preview row has a toggle, so
   the name used to start four pixels past the elbow's tip. */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'Full view' }).last()
const field = (m: Locator, label: string) =>
  m.locator(`xpath=.//label[starts-with(normalize-space(.), "${label}")]/..`)

async function preview(page: Page) {
  await page.goto('/chart-of-accounts', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Create GL account/ }).click()
  const m = modal(page)
  await m.getByRole('button', { name: /Continue/ }).first().click()
  await m.getByText('GL account details').first().waitFor()
  await field(m, 'GL account type').locator('button[aria-haspopup="listbox"]').click()
  await page.getByRole('option', { name: 'Summary', exact: true }).click()
  await field(m, 'Parent').locator('button[aria-haspopup="listbox"]').first().click()
  await page.getByRole('option', { name: /10000/ }).first().click()
  await field(m, 'GL account name').locator('input').fill('Test Fixtures')
  for (let i = 0; i < 3; i++) {
    if (await m.getByText('Placement preview').first().isVisible()) break
    await m.getByRole('button', { name: /Continue/ }).first().click()
  }
  await m.getByText('Placement preview').first().waitFor()
  return m
}

test('every nested name sits at least 12px clear of the elbow pointing at it', async ({ page }) => {
  const m = await preview(page)
  const gaps = await m.locator('table tbody tr td').evaluateAll(tds => tds.flatMap(td => {
    const elbow = td.querySelector('span.rounded-bl-\\[8px\\]') as HTMLElement | null
    const name = td.querySelector('span.flex > span') as HTMLElement | null
    if (!elbow || !name) return []
    return [name.getBoundingClientRect().left - elbow.getBoundingClientRect().right]
  }))
  expect(gaps.length).toBeGreaterThan(1)
  for (const g of gaps) expect(g).toBeGreaterThanOrEqual(12)
  await m.locator('table').first().screenshot({ path: 'test-results/preview-spacing.png' })
})
