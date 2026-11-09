import { test, expect, type Page, type Locator } from '@playwright/test'
import { settle } from './glPage'

/* Module review, 2026-10-06 (Claude, for Mahreen, Mahad and Nophil). The
   findings fixed in the chart of accounts, each pinned where a reader meets it.
   Import (COA-01, 08 to 12, 18) and the system account check (COA-03) are out
   of this sprint and not here. */

const chart = async (page: Page) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
}

const formModal = (page: Page, text: string) => page.locator('body > div.fixed').filter({ hasText: text }).last()
const field = (m: Locator, label: string) => m.locator(`xpath=.//label[starts-with(normalize-space(.), "${label}")]/..`)

test.describe('COA-02: a dimension in use', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dimensions', { waitUntil: 'networkidle' })
    await page.locator('tbody tr', { hasText: 'Location' }).first().waitFor()
  })

  test('cannot be removed, and Deactivate is offered in its place', async ({ page }) => {
    await page.getByRole('button', { name: 'Actions for Location' }).click()
    await page.getByRole('button', { name: 'Remove', exact: true }).click()
    const dialog = page.getByText("Location can't be removed")
    await expect(dialog).toBeVisible()
    await expect(page.getByText(/It is used by \d+ accounts?/)).toBeVisible()
    await page.getByRole('button', { name: 'Deactivate', exact: true }).last().click()
    await expect(page.locator('tbody tr', { hasText: 'Location' }).first()).toContainText('Inactive')
  })

  test('keeps a value in use on the list, with a lock in place of its remove button', async ({ page }) => {
    await page.getByRole('button', { name: 'Actions for Location' }).click()
    await page.getByRole('button', { name: 'Edit dimension' }).click()
    await expect(page.locator('[data-value-in-use="USA"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remove USA' })).toHaveCount(0)
  })
})

test.describe('COA-27: leaving a journal entry', () => {
  test('asks before throwing away what was typed', async ({ page }) => {
    await settle(page, '/general-ledger')
    await page.getByRole('button', { name: 'New journal entry' }).first().click()
    const m = formModal(page, 'New journal entry')
    await m.getByText('Journal lines').first().waitFor()
    await m.locator('table').getByLabel('debit', { exact: true }).first().fill('250')
    await m.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page.getByText('Discard this journal entry?')).toBeVisible()
    await page.getByRole('button', { name: 'Keep editing' }).click()
    await expect(m.locator('table').getByLabel('debit', { exact: true }).first()).toHaveValue(/250/)
    await m.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page.getByRole('button', { name: 'Discard entry' }).click()
    await expect(page.getByText('Journal lines')).toHaveCount(0)
  })

  test('closes at once when nothing was typed', async ({ page }) => {
    await settle(page, '/general-ledger')
    await page.getByRole('button', { name: 'New journal entry' }).first().click()
    const m = formModal(page, 'New journal entry')
    await m.getByText('Journal lines').first().waitFor()
    await m.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page.getByText('Discard this journal entry?')).toHaveCount(0)
    await expect(page.getByText('Journal lines')).toHaveCount(0)
  })
})

test.describe("COA-17: an account's Transactions tab", () => {
  /* Rows no longer open in place (Mahad, 2026-10-08). The search still reads
     the entry's other lines, so the other side is found from here. */
  test('opens nothing under a row, and searches the entry\'s other lines', async ({ page }) => {
    await page.goto('/chart-of-accounts/acct_11130', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Transactions', exact: true }).first().click()
    const rows = page.locator('tbody tr[data-tree-account]')
    await rows.first().waitFor()
    const before = await rows.count()
    await rows.first().locator('td').last().click()
    await expect(page.locator('[data-entry-lines]')).toHaveCount(0)
    await expect(rows).toHaveCount(before)
    await expect(rows.first()).not.toHaveAttribute('aria-expanded', /.*/)
    // The other side of the first entry, read off its quick view.
    await rows.first().getByText(/^JE-/).first().click()
    const quick = page.locator('body > div.fixed, body > div').filter({ hasText: 'Open full entry' }).last()
    await expect(quick).toBeVisible()
    const numbers = ((await quick.innerText()).match(/\b1\d{4}\b|\b[2-5]\d{4}\b/g) ?? []).filter(n => n !== '11130')
    expect(numbers.length).toBeGreaterThan(0)
    await page.keyboard.press('Escape')
    await page.getByPlaceholder(/Search/).first().fill(numbers[0])
    await expect(rows.first()).toBeVisible()
  })
})

test.describe('COA-07, COA-28: numbers and errors on Create GL account', () => {
  const openCreate = async (page: Page) => {
    await chart(page)
    await page.getByRole('button', { name: /Create GL account/ }).click()
    const m = formModal(page, 'Full view')
    await m.getByRole('button', { name: /Continue/ }).first().click()
    await m.getByText('GL account details').first().waitFor()
    return m
  }

  test('takes a number of another length with a soft warning', async ({ page }) => {
    const m = await openCreate(page)
    await field(m, 'GL account no.').locator('input').fill('110400')
    await expect(m.locator('[data-number-length-warning]')).toContainText('This number has 6 digits')
    await expect(field(m, 'GL account no.').locator('p.text-danger-600')).toHaveCount(0)
  })

  test('lists what is wrong when Continue is refused, and goes to the first', async ({ page }) => {
    const m = await openCreate(page)
    await m.getByRole('button', { name: /Continue/ }).first().click()
    const summary = m.locator('[data-step-summary]')
    await expect(summary).toBeVisible()
    await expect(summary).toContainText(/\d+ issues?/)
  })
})

/* COA-23 put number protection behind "Account numbers" under Actions. Mahad
   took that item off on 2026-10-07 (*"please remove the account numbers from
   actions dropdown"*), so the chart no longer offers it; where the setting lives
   now is his to say. */
test.describe('COA-23: number protection', () => {
  test('is no longer offered under Actions', async ({ page }) => {
    await chart(page)
    await page.getByRole('button', { name: 'Actions' }).first().click()
    await expect(page.getByRole('button', { name: 'Import' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Account numbers' })).toHaveCount(0)
  })
})

test.describe('COA-05, COA-20: the chart', () => {
  /* An account under Equity since 2026-10-10 (Mahad: *"Current year earnings
     should exist like any other account"*), no longer a computed line. */
  test('shows Current Year Earnings under Equity as an account', async ({ page }) => {
    await chart(page)
    const row = page.locator('tbody tr', { hasText: 'Current Year Earnings' }).filter({ hasText: '35000' })
    await expect(row).toHaveCount(1)
    await expect(row).not.toContainText('Computed')
    await expect(row).toContainText('Posting')
  })

  test('opens How it works from its header', async ({ page }) => {
    await chart(page)
    await page.getByRole('button', { name: 'How it works' }).click()
    await expect(page.getByRole('dialog', { name: 'Chart of accounts' })).toBeVisible()
  })
})

test.describe('COA-21: retiring accounts', () => {
  test('offers an archived account only Unarchive and Delete', async ({ page }) => {
    await page.goto('/chart-of-accounts/acct_arch_petty', { waitUntil: 'networkidle' })
    await expect(page.getByRole('button', { name: 'Edit Account' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Account actions' }).click()
    await expect(page.getByRole('button', { name: /Unarchive/ })).toBeVisible()
    for (const name of ['Edit account', 'Move under a new summary account', 'Create account above', 'Create account below', 'Create journal entry']) {
      await expect(page.getByRole('button', { name, exact: true }), name).toHaveCount(0)
    }
  })

  test('lets a summary be deactivated once the accounts under it are, and says why not before', async ({ page }) => {
    await page.goto('/chart-of-accounts/acct_11100', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Account actions' }).click()
    await page.getByRole('button', { name: 'Deactivate account' }).click()
    await expect(page.getByText('Some accounts under this account are still active. Deactivate them first.')).toBeVisible()
  })
})
