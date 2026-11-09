import { test, expect, type Locator, type Page } from '@playwright/test'

/* The "Why we recommend this number" card beside the create form's offered
   number. A rich Tooltip supplies only the white card, so the content carries
   its own chrome - and this one carried none, so its text fell back to the
   page's 16px. Mahad, 2026-10-01: *"what is this UI??? Please match the same as
   we have in our UI patterns."* Read against the Normal balance card on the same
   form, which is drawn the module's way. */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'Full view' }).last()
const field = (m: Locator, label: string) => m.locator(`xpath=.//label[starts-with(normalize-space(.), "${label}")]/..`)

async function postingForm(page: Page) {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
  await page.getByRole('button', { name: /Create GL account/ }).click()
  const m = modal(page)
  await m.getByRole('button', { name: /Continue/ }).first().click()
  await m.getByText('GL account details').first().waitFor()
  await field(m, 'GL account type').locator('button[aria-haspopup="listbox"]').click()
  await page.getByRole('option', { name: 'Posting', exact: true }).click()
  // The form no longer picks a parent (Mahad, 2026-10-08).
  await field(m, 'Parent').locator('button[aria-haspopup="listbox"]').first().click()
  await page.getByRole('option', { name: /11000/ }).first().click()
  return m
}

const look = (l: Locator) => l.evaluate(el => {
  const c = getComputedStyle(el)
  return { size: c.fontSize, color: c.color, line: c.lineHeight }
})

test('draws its text the way the module\'s other rich tooltips do', async ({ page }) => {
  const m = await postingForm(page)
  await m.getByLabel('Why this number').hover()
  const body = page.getByText('We number accounts in steps of 10', { exact: false })
  await expect(body).toBeVisible()
  expect((await look(body)).size).toBe('11px')
  const card = page.getByText('Why we recommend this number').locator('xpath=..')
  expect(Math.round((await card.boundingBox())!.width)).toBe(300)
  // The same text treatment as the Normal balance card beside it.
  const bodyLook = await look(body)
  await page.mouse.move(0, 0)
  await expect(body).toBeHidden()
  await m.locator('label', { hasText: /^Normal balance/ }).locator('svg').first().hover()
  const normal = page.locator('.w-\\[300px\\] p').first()
  await expect(normal).toBeVisible()
  expect(await look(normal)).toEqual(bodyLook)
})
