import { test, expect, type Page, type Locator } from '@playwright/test'
import { settle } from './glPage'

/* Mahad's ledger pointers of 2026-09-29, read off the running page.

   1. An archived account's running balance ends at zero. The transfer was
      numbered BT-<account>-<date>, which sorted ahead of every JE posted the
      same day, so the register ran it first and read the account back up after.
   2. Amounts keep their cents: 12.34 is $ 12.34, not $ 12.
   3. "Created on" is when the entry was written, not the day it is dated.
   6. Archiving moves a balance only to an account in the same currency.
   7-8. A reversal asks for its date and a required reason, and keeps the reason.
   9-10. The archive transfer takes the next JE number, and is called what it is
      on its source and its memo. (Its type was stated too, until the entry page
      stopped showing a type on 2026-09-30.) */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'New journal entry' }).last()

async function fillLine(page: Page, m: Locator, row: number, number: string, col: 'debit' | 'credit', amount: string) {
  await m.locator('table button[aria-haspopup="listbox"]').nth(row).click()
  const list = page.getByRole('listbox').last()
  await list.getByPlaceholder('Search account by name or number').fill(number)
  await list.getByRole('option').filter({ hasText: `${number} · ` }).first().click()
  await expect(list).toHaveCount(0)
  await m.locator('table').getByLabel(col, { exact: true }).nth(row).fill(amount)
}

/* The month in progress: a month locks when it ends (Mahad, 2026-10-11), so
   these entries are dated in the one still open. */
const NOW = new Date()
const MON = NOW.toLocaleString('en-US', { month: 'short' })
const YEAR = String(NOW.getFullYear())
const day = (d: string) => `${MON} ${d}, ${YEAR}`

async function pickDay(page: Page, trigger: Locator, day: string) {
  await trigger.click()
  const cal = page.locator('[data-date-popover]')
  await cal.waitFor()
  await cal.getByLabel('Year', { exact: true }).selectOption(YEAR)
  await cal.getByLabel('Month', { exact: true }).selectOption({ label: MON })
  await cal.getByRole('button', { name: day, exact: true }).first().click()
  await expect(cal).toHaveCount(0)
}

/** Posts debit/credit of `amount` and lands on the new entry's page. */
async function postEntry(page: Page, debit: string, credit: string, amount: string, day?: string) {
  await settle(page, '/general-ledger')
  await page.getByRole('button', { name: 'New journal entry' }).first().click()
  const m = modal(page)
  await m.getByText('Journal lines').first().waitFor()
  if (day) await pickDay(page, m.getByLabel('Date', { exact: true }), day)
  await fillLine(page, m, 0, debit, 'debit', amount)
  await fillLine(page, m, 1, credit, 'credit', amount)
  await m.getByRole('button', { name: 'Post journal entry' }).click()
  await page.waitForURL(/\/general-ledger\/entry\//)
  return decodeURIComponent(page.url().split('/entry/')[1])
}

const todayText = () => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const rail = (page: Page, label: string) =>
  page.getByText(label, { exact: true }).locator('xpath=ancestor::div[1]/following-sibling::*[1] | ancestor::div[1]/..').first()

test('keeps the cents, and says when the entry was written rather than the day it is dated', async ({ page }) => {
  await postEntry(page, '52110', '11130', '12.34', '1')
  const lines = page.locator('table').first()
  await expect(lines).toContainText('$ 12.34')
  await expect(lines).not.toContainText(/\$ 12(?!\.)/)
  // Dated the 1st, written today.
  await expect(page.getByText(day('1')).first()).toBeVisible()
  await expect(rail(page, 'Created on')).toContainText(todayText())
})

test('asks for a reversal date and a reason, and keeps the reason on the reversing entry', async ({ page }) => {
  const original = await postEntry(page, '52110', '11130', '12.34', '10')
  await page.getByRole('button', { name: 'Reverse this entry' }).click()
  const dialog = page.getByRole('alertdialog').filter({ hasText: `Reverse ${original}?` })
  const date = dialog.getByLabel('Reversal date', { exact: true })
  await expect(date).toContainText(day('10'))

  // Before the entry it reverses is refused, and Post with it.
  await pickDay(page, date, '9')
  await expect(dialog).toContainText("can't be dated before the entry it reverses")
  await expect(dialog.getByRole('button', { name: /^Post JE-/ })).toBeDisabled()

  await pickDay(page, date, '15')
  await expect(dialog).toContainText(`Posting period: ${MON} ${YEAR}`)
  // No reason, no reversal.
  await dialog.getByRole('button', { name: /^Post JE-/ }).click()
  await expect(dialog).toContainText('Enter a reason for the reversal.')

  await dialog.getByLabel('Reason for reversal').fill('Posted to the wrong expense account')
  await dialog.getByRole('button', { name: /^Post JE-/ }).click()
  await page.waitForURL(u => !decodeURIComponent(u.toString()).endsWith(original))
  await expect(page.getByText(day('15')).first()).toBeVisible()
  await expect(page.getByText('Reversal reason', { exact: true })).toBeVisible()
  await expect(page.getByText('Posted to the wrong expense account')).toBeVisible()
})

test('archives to any currency, numbers the transfer in the run, names it, and ends the register at zero', async ({ page }) => {
  // A same-day posting on the account first: the transfer has to run after it.
  const posted = await postEntry(page, '11130', '11120', '12.34')

  // In the app, not a reload: the entry is still being written to storage.
  await page.locator('a[href="/chart-of-accounts/acct_11120"]').first().click()
  await page.waitForURL(/acct_11120/)
  const dialog = page.locator('body > div.fixed').filter({ hasText: 'Move and archive' }).last()
  await expect(async () => {
    await page.getByRole('button', { name: 'Account actions' }).click()
    await page.getByRole('button', { name: /^Archive/ }).first().click({ timeout: 2000 })
    await expect(dialog).toBeVisible({ timeout: 2000 })
  }).toPass({ timeout: 20000 })
  await expect(dialog).toContainText('$ 8,387.66')

  await dialog.getByRole('button', { name: /Select account/ }).click()
  const list = page.getByRole('listbox').last()
  await expect(list).toContainText('11130')
  // Any currency since 2026-10-10 (Mahad: *"the same behavior as we have in the
  // USD account for now"*): the GBP and EUR accounts are on offer too.
  await expect(list).toContainText('11160')
  await expect(list).toContainText('11170')
  await list.getByRole('option').filter({ hasText: '11130' }).first().click()
  await dialog.getByRole('button', { name: 'Move and archive' }).click()

  await page.getByRole('button', { name: /^Transactions/ }).first().click()
  const transfer = page.locator('tbody tr').filter({ hasText: 'Archive transfer' })
  await expect(transfer).toHaveCount(1)
  // Spelt as the entry's Type spells it. `hasText` ignores case, so the cell is
  // read exactly - "Archive Transfer" is what the column used to say.
  await expect(transfer.getByText('Archive transfer', { exact: true })).toHaveCount(1)
  await expect(transfer.getByText('Archive Transfer', { exact: true })).toHaveCount(0)
  const number = (await transfer.getByRole('button', { name: /^JE-/ }).innerText()).trim()
  // The next in the run after the entry posted just before it.
  const seq = (n: string) => Number(n.split('-').pop())
  expect(number).toMatch(/^JE-2026-\d{4}$/)
  expect(seq(number)).toBe(seq(posted) + 1)
  await expect(transfer).toContainText('Balance moved from 11120 Cash on Hand on archive')
  await expect(transfer.locator('td').last()).toHaveText('$ 0.00')
  // Newest first, so the register opens on the zero the dashboard states - not
  // with what was posted here stranded under the oldest row.
  await expect(page.locator('tbody tr').first()).toContainText(/archive transfer/i)

  await transfer.getByRole('button', { name: /^JE-/ }).click()
  await page.getByRole('link', { name: /Open full entry/i }).or(page.getByRole('button', { name: /Open full entry/i })).first().click()
  await page.waitForURL(/\/general-ledger\/entry\//)
  // Named by its memo; the page states no type, so neither "Archive transfer"
  // as one nor the "Closing" it was once mislabelled as.
  await expect(page.getByText('Balance moved from 11120 Cash on Hand on archive').first()).toBeVisible()
  await expect(page.locator('h1').first().locator('xpath=..').getByText('Archive transfer', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Closing', { exact: true })).toHaveCount(0)
})
