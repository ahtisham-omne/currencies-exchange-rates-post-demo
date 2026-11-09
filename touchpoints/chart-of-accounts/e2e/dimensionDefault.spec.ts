import { test, expect, type Page, type Locator } from '@playwright/test'
import { settle } from './glPage'

/* One default per dimension. Mahad, 2026-10-02: an account may carry Location
   USA and Singapore, but *"one line amount can only land in one place"*. So a
   second value makes a default required, the account says which it is, and a
   journal line takes the default.

   52210 is the seeded account carrying both, USA its default. */
const ACCOUNT = '/chart-of-accounts/acct_52210'

const card = (page: Page) => page.locator('[data-dimension-row="Location"]')

test('the account says which of its values is the default', async ({ page }) => {
  await page.goto(ACCOUNT, { waitUntil: 'networkidle' })
  await expect(card(page)).toContainText('USA')
  await expect(card(page)).toContainText('Singapore')
  await expect(card(page).getByText('Default', { exact: true })).toHaveCount(1)
  await expect(card(page).locator('span', { hasText: /^USA/ }).first()).toContainText('Default')
  await page.locator('[data-dimension-row="Location"]').locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]').screenshot({ path: 'test-results/dimension-default-rail.png' })
})

/* Mahad, 2026-10-02: a multi-select in the field, ticks on the right, chips
   inside the field, and the first value picked is the default - moved from the
   list or from a chip, never asked for in a field of its own. */
test('the first value picked is the default, and it moves from the list or a chip', async ({ page }) => {
  await page.goto('/chart-of-accounts/acct_52220', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Add dimension' }).click()
  const m = page.locator('body > div.fixed').filter({ hasText: 'Save dimensions' }).last()
  // 52220 carries Department Sales only. Add Location, then two values.
  await m.getByRole('button', { name: /Add another dimension/ }).click()
  await m.getByRole('button', { name: 'Dimension 2', exact: true }).click()
  await page.getByRole('option', { name: 'Location' }).click()
  const field = m.getByRole('button', { name: 'Location value for this account' })
  await field.click()
  const option = (v: string) => page.getByRole('listbox').getByRole('option', { name: new RegExp(`^${v}`) })
  await option('USA').click()
  // Still open: ticked on the right, and the chip inside the field.
  await expect(option('USA')).toHaveAttribute('aria-selected', 'true')
  await option('Singapore').click()
  await expect(option('Singapore')).toHaveAttribute('aria-selected', 'true')
  // Inside the field, beside the control that opens the list. Location is the second card.
  const chips = m.locator('[data-dimension-values]').nth(1).locator('> span')
  await expect(chips).toHaveCount(2)
  // The first picked is the default, in the list and on its chip.
  await expect(option('USA')).toContainText('Default')
  await expect(chips.first()).toContainText('Default')
  await expect(m.locator('[data-dimension-default]')).toHaveCount(0)
  await expect(m.getByRole('button', { name: 'Save dimensions' })).toBeEnabled()
  await page.screenshot({ path: 'test-results/dimension-picker-open.png' })

  // From the list.
  await option('Singapore').hover()
  await page.getByRole('listbox').getByRole('button', { name: 'Set as default' }).click()
  await expect(option('Singapore')).toContainText('Default')
  await expect(option('USA')).not.toContainText('Default')

  // From a chip.
  await page.keyboard.press('Escape')
  await m.getByRole('button', { name: 'Make USA the default' }).click()
  await expect(chips.first()).toContainText('Default')
  await m.screenshot({ path: 'test-results/dimension-picker-closed.png' })

  // Taking the default away hands it to the next in line.
  await m.getByRole('button', { name: 'Remove USA' }).click()
  await expect(chips).toHaveCount(1)
  await field.click()
  await option('Hong Kong').click()
  await expect(option('Singapore')).toContainText('Default')
  await page.keyboard.press('Escape')

  await m.getByRole('button', { name: 'Save dimensions' }).click()
  await expect(card(page).locator('span', { hasText: /^Singapore/ }).first()).toContainText('Default')
})

async function pickAccount(page: Page, m: Locator, number: string) {
  await m.locator('table button[aria-haspopup="listbox"]').first().click()
  const list = page.getByRole('listbox').last()
  await list.getByPlaceholder('Search account by name or number').fill(number)
  await list.getByRole('option').filter({ hasText: `${number} · ` }).first().click()
}

/* Design review, 2026-10-02 - Eli: the line starts on the account's default and
   can take any other value configured for the account, one per dimension. */
test('a journal line starts on the default, and can take the account\'s other value', async ({ page }) => {
  await settle(page, '/general-ledger')
  await page.getByRole('button', { name: 'New journal entry' }).first().click()
  const m = page.locator('body > div.fixed').filter({ hasText: 'New journal entry' }).last()
  await m.getByText('Journal lines').first().waitFor()
  await pickAccount(page, m, '52210')
  const dims = m.locator('[data-line-dimensions]').first()
  // One value for Department: nothing to choose, so the chart's pill.
  await expect(dims).toContainText('Department: Sales')
  // Two for Location: a choice, opening on the default.
  const location = dims.locator('[data-line-dimension="dim_location"]')
  await expect(location).toContainText('Location')
  const picker = location.getByRole('button', { name: 'Location for this line' })
  await expect(picker).toContainText('USA (default)')
  await picker.click()
  const list = page.getByRole('listbox').last()
  // The account's values, and no others the dimension has.
  await expect(list.getByRole('option')).toHaveText(['USA (default)', 'Singapore'])
  await list.getByRole('option', { name: 'Singapore' }).click()
  await expect(picker).toContainText('Singapore')
  await m.locator('table').first().screenshot({ path: 'test-results/je-line-dimensions.png' })

  // And it posts to the value the line chose.
  await m.locator('table').getByLabel('debit', { exact: true }).first().fill('75')
  await m.locator('table button[aria-haspopup="listbox"]').filter({ hasText: /Search account/ }).first().click()
  const accounts = page.getByRole('listbox').last()
  await accounts.getByPlaceholder('Search account by name or number').fill('11130')
  await accounts.getByRole('option').filter({ hasText: '11130 · ' }).first().click()
  await m.locator('table').getByLabel('credit', { exact: true }).nth(1).fill('75')
  await m.getByRole('button', { name: 'Post journal entry' }).click()
  await expect(page).toHaveURL(/\/general-ledger\/entry\//)
  const line = page.locator('tbody tr', { hasText: '52210' }).first()
  // Location is the second pill, behind +1.
  await line.getByText('+1').hover()
  await expect(page.getByText('Singapore', { exact: true }).last()).toBeVisible()
  await expect(page.getByText('USA', { exact: true })).toHaveCount(0)
})
