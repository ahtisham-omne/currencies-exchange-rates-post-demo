import { test, expect, type Page, type Locator } from '@playwright/test'
import { settle } from './glPage'

/* COA open fixes, 2026-10-07 (Claude, for Mahreen): what the retest of the
   October 6 findings left open, each pinned where a reader meets it. The card
   amounts at 1000 to 1440 pixels are in kpiFigures.spec.ts. */

const chart = async (page: Page) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
}
const modal = (page: Page, text = 'Full view') => page.locator('body > div.fixed').filter({ hasText: text }).last()
const field = (m: Locator, label: string) => m.locator(`xpath=.//label[starts-with(normalize-space(.), "${label}")]/..`)
const picker = (f: Locator) => f.locator('button[aria-haspopup="listbox"]')
const money = (s: string) => [...s.matchAll(/-?\$\s?-?[\d,]+\.\d{2}/g)].map(m => Number(m[0].replace(/[$,\s]/g, '')))
const rowByNumber = (page: Page, number: string) => page.locator('tbody tr[data-tree-account]').filter({ hasText: number }).first()

test.describe('the chart page', () => {
  test('counts Equity the same in its row and its pill', async ({ page }) => {
    await chart(page)
    const pill = await page.getByRole('button', { name: /^Equity\s*\d+/ }).first().innerText()
    const band = await rowByNumber(page, '30000').innerText()
    const pillCount = pill.match(/\d+/)![0]
    expect(band).toContain(`(${pillCount})`)
  })

  /* The card names its month. Current Year Earnings is an account since
     2026-10-10, and carries no date note beside its name: no other account does. */
  test('dates the profit card, and lists Current Year Earnings like any account', async ({ page }) => {
    await chart(page)
    await expect(page.locator('div.rounded-lg', { has: page.getByText('Net income', { exact: true }) }).last().getByText(/^[A-Z][a-z]+ \d{4}$/)).toBeVisible()
    await expect(page.locator('[data-earnings-span]')).toHaveCount(0)
  })

  test('opens How it works on the chart in use, not on setup', async ({ page }) => {
    await chart(page)
    await page.getByRole('button', { name: 'How it works' }).click()
    const guide = page.getByRole('dialog', { name: 'Chart of accounts' })
    // The setups' Accounts guide since 2026-10-08, less publishing.
    await expect(guide).toContainText('What are the five categories?')
    await expect(guide).not.toContainText('How build from scratch works')
    await expect(guide).not.toContainText('What happens when I publish?')
  })
})

test.describe('Create GL account', () => {
  const openDetails = async (page: Page) => {
    await chart(page)
    await page.getByRole('button', { name: /Create GL account/ }).click()
    const m = modal(page)
    await m.getByText('What kind of account is this?').first().waitFor()
    await m.getByRole('button', { name: /Continue/ }).first().click()
    await m.getByText('GL account details').first().waitFor()
    return m
  }

  test('moves focus to the first field in error, and lists them in field order', async ({ page }) => {
    const m = await openDetails(page)
    await m.getByRole('button', { name: /Continue/ }).first().click()
    await expect(picker(field(m, 'GL account type'))).toBeFocused()
    const items = await m.locator('[data-step-summary] li').allInnerTexts()
    expect(items.slice(0, 3)).toEqual(['Select a GL account type.', 'Enter a GL account name.', 'Enter a GL account number.'])
  })

  test('keeps a Current asset under 12100 and flags the override on the chart', async ({ page }) => {
    const m = await openDetails(page)
    await picker(field(m, 'GL account type')).click()
    await page.getByRole('option', { name: 'Posting', exact: true }).click()
    await picker(field(m, 'Parent')).click()
    await page.getByRole('option').filter({ hasText: '12100' }).first().click()
    await expect(m.getByText(/This account keeps current asset, and the chart flags it as an override\./)).toBeVisible()
    await field(m, 'GL account name').locator('input').fill('Retest override')
    await field(m, 'GL account no.').locator('input').fill('12170')
    const create = m.getByRole('button', { name: 'Create account' })
    for (let i = 0; i < 4 && !(await create.count()); i++) await m.getByRole('button', { name: /Continue/ }).first().click()
    await create.first().click()
    await expect(modal(page)).toHaveCount(0)
    // Saving opens the new account. Back to the chart in the app, not by a
    // reload: the account is still being written to storage.
    await page.waitForURL(u => /^\/chart-of-accounts\/.+/.test(u.pathname))
    // A new account opens with nothing written on it: no notes, no
    // correspondence, no files (COA-31).
    await page.getByRole('button', { name: 'Activity', exact: true }).first().waitFor()
    const tabs = (await page.locator('div.border-t.border-muted.overflow-x-auto > button').allInnerTexts()).map(t => t.trim())
    for (const name of ['Notes', 'Attachments', 'Communications']) {
      expect(tabs.find(t => t.startsWith(name)), name).toMatch(new RegExp(`^${name}(\\s*0)?$`))
    }
    await page.locator('a[href="/chart-of-accounts"]').first().dispatchEvent('click')
    await page.waitForSelector('thead th')
    await page.getByRole('button', { name: 'Expand all' }).click()
    const made = rowByNumber(page, '12170')
    await expect(made).toContainText('Current asset')
    await expect(made.locator('[data-classification-override]')).toBeVisible()
  })
})

test.describe('the guide', () => {
  test('limits a currency of its own to bank and cash on hand, and keeps the digits 6 to 9 out of it', async ({ page }) => {
    await chart(page)
    await page.getByRole('button', { name: 'How it works' }).click()
    const guide = page.getByRole('dialog', { name: 'Chart of accounts' })
    await guide.getByPlaceholder(/Search/).fill('currency')
    await expect(guide).toContainText('Only Bank and Cash on Hand accounts can have their own currency.')
    await expect(guide).not.toContainText(/credit card accounts can have their own currency|cash on hand and credit cards/)
    // The copy of 2026-10-09 says nothing of the digits 6 to 9; the old advice to
    // keep them for other income and taxes must not come back.
    await guide.getByPlaceholder(/Search/).fill('6 to 9')
    await expect(guide).not.toContainText('left free')
  })
})

test.describe('archiving', () => {
  test('keeps the archived account in its parent\'s opening, and lists it for the period', async ({ page }) => {
    await chart(page)
    const openingOf = async (number: string) => money(await rowByNumber(page, number).innerText())[0]
    const assetBefore = await openingOf('10000')
    const prepaidBefore = await openingOf('11500')

    await page.goto('/chart-of-accounts/acct_11540', { waitUntil: 'networkidle' })
    const dialog = page.locator('body > div.fixed').filter({ hasText: 'Move and archive' }).last()
    await expect(async () => {
      await page.getByRole('button', { name: 'Account actions' }).click()
      await page.getByRole('button', { name: /^Archive/ }).first().click({ timeout: 2000 })
      await expect(dialog).toBeVisible({ timeout: 2000 })
    }).toPass({ timeout: 20000 })
    // Only under the account's own summary since 2026-10-08 (Mahad): 11510,
    // beside it under 11500, is offered, and 11210 under another is not.
    await expect(dialog.getByText(/You can only move it to an account under\s*11500\s*Prepaid Expenses and Other\./)).toBeVisible()
    await dialog.getByRole('button', { name: /Select account/ }).click()
    const options = page.getByRole('listbox').last().getByRole('option')
    await expect(options.filter({ hasText: '11210' })).toHaveCount(0)
    await options.filter({ hasText: '11510' }).first().click()
    await dialog.getByRole('button', { name: 'Move and archive' }).click()
    await expect(dialog).toHaveCount(0)

    // In the app, not a reload, for the same reason.
    await page.locator('a[href="/chart-of-accounts"]').first().dispatchEvent('click')
    await page.waitForSelector('thead th')
    await page.getByRole('button', { name: 'Expand all' }).click()
    expect(await openingOf('10000')).toBe(assetBefore)
    expect(await openingOf('11500')).toBe(prepaidBefore)
    await expect(rowByNumber(page, '11540')).toContainText('Archived')
  })
})

test.describe('the journal entry form', () => {
  // The line under Notify someone is gone (Mahad, 2026-10-08).
  test('says nothing under Notify someone', async ({ page }) => {
    await settle(page, '/general-ledger')
    await page.getByRole('button', { name: 'New journal entry' }).first().click()
    const m = modal(page, 'New journal entry')
    await m.getByText('Journal lines').first().waitFor()
    await expect(m.getByText('Notify someone')).toBeVisible()
    await expect(m.getByText(/They get an email about the entry/)).toHaveCount(0)
  })
})

