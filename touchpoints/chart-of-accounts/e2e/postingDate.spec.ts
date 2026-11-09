import { test, expect, type Page, type Locator } from '@playwright/test'
import { settle } from './glPage'

/* Mahad, 2026-09-24: *"Dates display one day earlier than selected, which risks
   posting to the wrong period."*

   Run in New York, because that is the only place the fault was ever visible. A
   calendar day written as `2026-09-02` parses as UTC midnight, which is the 1st
   at 8pm for a reader on the east coast - and the whole module renders it. On
   this machine, at UTC+5, every wrong answer rounded back to the right day, so a
   test in the local zone would have passed against the broken code.

   The picker was never the problem and is not what this watches: it builds its
   value component by component. What is watched is the round trip - the day the
   reader chose, read back out of the ledger it was posted into. */
test.use({ timezoneId: 'America/New_York' })

/* The 2nd of the month in progress: a month locks when it ends (Mahad,
   2026-10-11), so the day picked has to be in the one still open. */
const NOW = new Date()
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const CHOSEN = { month: MONTHS[NOW.getMonth()], year: String(NOW.getFullYear()), day: '2', reads: `${MONTHS[NOW.getMonth()]} 2, ${NOW.getFullYear()}` }
const MEMO = 'Posting date round trip'

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'New journal entry' }).last()

async function pickDate(page: Page, m: Locator) {
  await m.getByLabel('Date', { exact: true }).click()
  const cal = page.locator('[data-date-popover]')
  await cal.waitFor()
  await cal.getByLabel('Year', { exact: true }).selectOption(CHOSEN.year)
  await cal.getByLabel('Month', { exact: true }).selectOption({ label: CHOSEN.month })
  await cal.getByRole('button', { name: CHOSEN.day, exact: true }).first().click()
  await expect(cal).toHaveCount(0)
}

// Both pickers live in the lines table, so they are indexed from there rather
// than from the modal - the adjustment flow's reason is a picker too.
async function fillLine(page: Page, m: Locator, row: number, number: string, col: 'debit' | 'credit') {
  const picker = m.locator('table button[aria-haspopup="listbox"]').nth(row)
  await picker.click()
  const list = page.getByRole('listbox').last()
  await list.getByPlaceholder('Search account by name or number').fill(number)
  await list.getByRole('option').first().click()
  await expect(list).toHaveCount(0)
  // Indexed off the inputs rather than off the rows: a line carrying dimensions
  // renders a second `tr` under its own, so row n is not always the nth `tr`.
  await m.locator('table').getByLabel(col, { exact: true }).nth(row).fill('100.00')
}

test('posts on the day that was picked, and reads it back as that day', async ({ page }) => {
  await settle(page, '/general-ledger')
  await page.getByRole('button', { name: 'New journal entry' }).first().click()
  const m = modal(page)
  await m.getByText('Journal lines').first().waitFor()

  await pickDate(page, m)
  // The field's own answer first: a trigger that already reads the 1st would put
  // the fault before the ledger and make the rest of this test meaningless.
  await expect(m.getByLabel('Date', { exact: true })).toContainText(CHOSEN.reads)

  await m.getByLabel('Memo').fill(MEMO)
  await fillLine(page, m, 0, '52110', 'debit')
  await fillLine(page, m, 1, '11130', 'credit')

  await m.getByRole('button', { name: 'Post journal entry' }).click()
  await expect(modal(page)).toHaveCount(0)

  // Posting lands on the entry's own page, which is where the date it was filed
  // under is stated back.
  await expect(page).toHaveURL(/\/general-ledger\/entry\//)
  await expect(page.getByText(MEMO).first()).toBeVisible()
  const dateCell = page.getByText('Date', { exact: true }).first().locator('xpath=ancestor::div[2]')
  await expect(dateCell).toContainText(CHOSEN.reads)
})
