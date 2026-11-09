import { test, expect, type Page } from '@playwright/test'

/* Dimensions in Guided setup, and "Add dimensions" on a row. Mahad, 2026-10-08:
   *"The guided setup in our first-time view is missing a dimension. Just like we
   added dimensions in Build from Scratch, we need to add dimensions here as
   well. The walkthrough will appear just like before ... Below Edit Account,
   there should be a second point: Add Dimensions. When we click on it, only the
   dimension modal should open, allowing us to link the already created
   dimensions to that account. This should only appear if we have already
   created dimensions."* */

const footer = (page: Page) => page.getByRole('button', { name: /^(Continue|Skip|Review accounts|Publish chart|Publish)$/ }).last()

async function dismissWelcome(page: Page) {
  const welcome = page.getByRole('button', { name: 'Skip for now' })
  await welcome.waitFor({ timeout: 2500 }).then(() => welcome.click()).catch(() => {})
}

async function toGuidedDimensions(page: Page) {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /View as first-time user/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Start guided setup' }).click()
  await dismissWelcome(page)
  await footer(page).click()                                   // Number length
  await dismissWelcome(page)
  await page.getByRole('button', { name: /^Accrual basis/ }).click()
  await footer(page).click()                                   // Your business
  await expect(page.getByRole('heading', { name: 'What do you want to report by?' })).toBeVisible()
}

async function defineLocation(page: Page) {
  await page.getByRole('button', { name: 'Add dimension' }).first().click()
  await page.getByPlaceholder('e.g. Location').fill('Location')
  const value = page.getByPlaceholder('e.g. London')
  for (const v of ['USA', 'Singapore']) { await value.fill(v); await value.press('Enter') }
  await page.getByRole('button', { name: 'Add dimension' }).last().click()
  await expect(page.getByText('1 dimension defined')).toBeVisible()
}

async function rowMenu(page: Page, name: string) {
  await page.getByRole('button', { name: `Actions for ${name}` }).first().click()
  const panel = page.locator('body > div.fixed').filter({ has: page.getByRole('button', { name: 'Edit account' }) }).last()
  await panel.getByRole('button', { name: 'Edit account' }).waitFor()
  return panel
}
const items = async (panel: ReturnType<Page['locator']>) =>
  (await panel.locator('button').allInnerTexts()).map(t => t.trim()).filter(Boolean)

test('guided setup asks for dimensions before the accounts, with its tour', async ({ page }) => {
  await toGuidedDimensions(page)
  // The stepper names the step where Build from scratch names it: before the accounts.
  const steps = await page.locator('button', { hasText: /^(\d\s*)?(Number length|Your business|Dimensions|Add your accounts)$/ }).allInnerTexts()
  expect(steps.map(s => s.replace(/^\d\s*/, '').trim())).toEqual(['Number length', 'Your business', 'Dimensions', 'Add your accounts'])
  // The same walkthrough Build from scratch offers on this step.
  await expect(page.getByRole('button', { name: 'Skip for now' })).toBeVisible({ timeout: 4000 })
  await page.getByRole('button', { name: 'Skip for now' }).click()
  // Skippable, and the button says so until something is defined.
  await expect(footer(page)).toHaveText('Skip')
  await defineLocation(page)
  await expect(footer(page)).toHaveText('Review accounts')
})

test('guided setup: with no dimension, a row offers nothing to link', async ({ page }) => {
  await toGuidedDimensions(page)
  await dismissWelcome(page)
  await footer(page).click()                                   // Skip
  await dismissWelcome(page)
  const menu = await rowMenu(page, 'Petty Cash')
  expect(await items(menu)).not.toContain('Add dimensions')
})

test('guided setup: Add dimensions sits under Edit account and opens only the dimension modal', async ({ page }) => {
  await toGuidedDimensions(page)
  await dismissWelcome(page)
  await defineLocation(page)
  await footer(page).click()                                   // Review accounts
  await dismissWelcome(page)

  const menu = await rowMenu(page, 'Petty Cash')
  const list = await items(menu)
  expect(list.indexOf('Add dimensions')).toBe(list.indexOf('Edit account') + 1)
  await menu.getByRole('button', { name: 'Add dimensions' }).click()

  // The modal on its own: no account form behind it, and no new dimension offered.
  const m = page.locator('[data-account-dimensions-modal]')
  await expect(m).toBeVisible()
  await expect(page.getByText('GL account details')).toHaveCount(0)
  await m.getByRole('button', { name: 'Add a dimension' }).click()
  await m.getByRole('button', { name: 'Dimension 1', exact: true }).click()
  await expect(page.getByRole('listbox').getByText(/Create new dimension/)).toHaveCount(0)
  await page.getByRole('option', { name: 'Location' }).click()
  await m.getByRole('button', { name: 'Location value for this account' }).click()
  await page.getByRole('listbox').getByRole('option', { name: /^USA/ }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Save dimensions' }).click()
  await expect(m).toHaveCount(0)

  // The row says so, in the Dimensions column that shows once a dimension exists.
  const row = page.locator('tbody tr', { hasText: 'Petty Cash' }).first()
  await expect(row).toContainText('Location: USA')
  await page.locator('[data-walkthrough="chart-table"]').screenshot({ path: 'test-results/guided-add-dimensions.png' })

  // And the chart it creates carries it.
  await footer(page).click()                                   // Publish chart
  await page.waitForURL(/\/chart-of-accounts$/)
  await page.getByRole('textbox', { name: 'Search accounts' }).fill('Petty Cash')
  await expect(page.locator('tbody tr', { hasText: 'Petty Cash' }).first()).toContainText('Location: USA')
})

test('build from scratch offers the same action once a dimension exists', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /View as first-time user/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Start building' }).click()
  await dismissWelcome(page)
  await footer(page).click()                                   // Number length
  await dismissWelcome(page)
  await defineLocation(page)
  await footer(page).click()                                   // Continue to Accounts
  await dismissWelcome(page)
  // The anchors are the only rows; add one posting account to have a row to open.
  await page.getByRole('button', { name: 'Add account' }).first().click()
  const form = page.locator('body > div.fixed').filter({ hasText: 'Full view' }).last()
  await form.getByRole('button', { name: /^Asset What your business owns/ }).click()
  await form.getByRole('button', { name: /^Current asset/ }).click()
  await form.getByRole('button', { name: /Continue/ }).first().click()
  await form.getByRole('button', { name: 'Select type' }).click()
  await page.locator('[role=option]:visible').filter({ hasText: 'Posting' }).first().click()
  // The form no longer picks a parent (Mahad, 2026-10-08); a fresh Asset has only itself.
  await form.locator('xpath=.//label[starts-with(normalize-space(.), "Parent")]/..').locator('button[aria-haspopup="listbox"]').first().click()
  await page.getByRole('option', { name: /10000/ }).first().click()
  await form.getByPlaceholder('e.g. Office supplies').fill('Office Petty Cash')
  await form.getByPlaceholder('e.g. 10000').fill('10010')
  await form.getByRole('button', { name: /Continue/ }).first().click()
  // Its Dimensions step is offered, since a dimension exists; skip past it.
  await form.getByRole('button', { name: /Continue/ }).first().click()
  await form.getByRole('button', { name: 'Create account' }).click()
  const menu = await rowMenu(page, 'Office Petty Cash')
  const list = await items(menu)
  expect(list.indexOf('Add dimensions')).toBe(list.indexOf('Edit account') + 1)
})
