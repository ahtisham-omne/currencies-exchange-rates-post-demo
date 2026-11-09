import { test, expect, type Page, type Locator } from '@playwright/test'

/* Flags are pictures, everywhere in the module. Mahad, 2026-10-05: *"We still
   have flag emojis in this dropdown ... Can you make sure we use these ones
   everywhere through out the module?"* - pointing at Guided setup's country
   picker, which draws FlagImage. Windows ships no flag emoji: 🇺🇸 draws there as
   the letters "US" (design review, 2026-10-02).

   Each surface that shows a flag is opened and read two ways: the flags are
   <img data-flag>, and no regional-indicator character is anywhere in the text. */

const FLAG_EMOJI = /[\u{1F1E6}-\u{1F1FF}]/u
const textHasNoFlagEmoji = async (page: Page) =>
  expect(await page.evaluate(() => document.body.innerText)).not.toMatch(FLAG_EMOJI)

const imgFlags = (scope: Locator) => scope.locator('img[data-flag]')

test('the journal entry Currency field draws flag pictures, in the list and on the field', async ({ page }) => {
  await page.goto('/general-ledger', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'New journal entry' }).first().click()
  const m = page.locator('body > div.fixed').filter({ hasText: 'New journal entry' }).last()
  await m.getByText('Journal lines').first().waitFor()

  const field = m.getByRole('button', { name: 'Currency' })
  await expect(field).toContainText('USD · US Dollar')
  await expect(imgFlags(field)).toHaveCount(1)
  await expect(imgFlags(field).first()).toHaveAttribute('data-flag', 'us')

  await field.click()
  const list = page.getByRole('listbox').last()
  const options = list.getByRole('option')
  const count = await options.count()
  expect(count).toBeGreaterThan(5)
  await expect(imgFlags(list)).toHaveCount(count)
  await expect(imgFlags(list.getByRole('option', { name: /EUR · Euro/ }))).toHaveAttribute('data-flag', 'eu')
  await textHasNoFlagEmoji(page)

  // The picked currency carries its flag onto the field.
  await list.getByRole('option', { name: /GBP · British Pound/ }).click()
  await expect(imgFlags(field).first()).toHaveAttribute('data-flag', 'gb')
  await textHasNoFlagEmoji(page)
})

test('the partner group picker on a new bank account draws flag pictures', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Create GL account/ }).click()
  const m = page.locator('body > div.fixed').filter({ hasText: 'Full view' }).last()
  await m.getByText('What kind of account is this?').first().waitFor()
  await m.getByRole('button', { name: /^Asset What your business owns/ }).click()
  await m.getByRole('button', { name: /^Current asset/ }).click()
  await m.getByRole('button', { name: /Continue/ }).first().click()
  await m.getByText('GL account details').first().waitFor()
  await m.getByRole('button', { name: 'Select type' }).click()
  await page.locator('[role=option]:visible').filter({ hasText: 'Posting' }).first().click()
  // The form no longer picks a parent (Mahad, 2026-10-08).
  await m.locator('xpath=.//label[starts-with(normalize-space(.), "Parent")]/..').locator('button[aria-haspopup="listbox"]').first().click()
  await page.getByRole('option', { name: /10000/ }).first().click()
  await m.getByRole('button', { name: /Select a role/ }).click()
  await page.getByRole('option', { name: /^Bank Tracks/ }).click()
  await m.getByPlaceholder('e.g. Office supplies').fill('Flag check bank')
  await m.getByPlaceholder('e.g. 10000').fill('10010')
  await m.getByRole('button', { name: /Continue/ }).first().click()

  await m.getByText(/Also add this bank as a partner/).click()
  const group = m.getByRole('button', { name: /Assign a partner group/ })
  await group.click()
  const list = page.getByRole('listbox').last()
  // Every group but "Others", which is no country's.
  const groups = list.getByRole('option').filter({ hasNotText: /^Others/ })
  await expect(imgFlags(list)).toHaveCount(await groups.count())
  await textHasNoFlagEmoji(page)
  await list.getByRole('option', { name: /Seats & Interior Trim/ }).click()
  // Named by the group it now holds.
  await expect(imgFlags(m.getByRole('button', { name: /Seats & Interior Trim/ })).first()).toHaveAttribute('data-flag', 'de')
})

test('no page that shows a currency prints a flag emoji', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
  await page.getByPlaceholder('Search accounts').fill('EUR')
  await expect(imgFlags(page.locator('tbody')).first()).toBeVisible()
  await textHasNoFlagEmoji(page)

  // An account held in euros, on its own page.
  await page.locator('tbody tr').filter({ has: page.locator('img[data-flag="eu"]') }).first().getByRole('button').first().click()
  await page.waitForURL(/\/chart-of-accounts\/acct_/)
  await page.waitForLoadState('networkidle')
  await textHasNoFlagEmoji(page)
})
