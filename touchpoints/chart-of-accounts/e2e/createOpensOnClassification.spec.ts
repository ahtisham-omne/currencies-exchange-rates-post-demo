import { test, expect, type Page, type Locator } from '@playwright/test'

/* Every Create GL account opens on step 1, Classification, wherever it was
   started. Mahad, 2026-10-09: *"instead of skipping directly to Step 2, we must
   show the Classification step as Step 1 first, and this logic needs to be
   implemented system-wide."* What the request settled - the category, from the
   summary it was started on or the category it was added in - is locked there;
   the statement classification stays a choice: *"the 'What kind of account is
   this?' field should be locked to Assets so it cannot be changed, but the
   Statement Classification should remain editable."* */

const form = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'Create GL account' }).filter({ has: page.locator('[aria-current="step"]') }).last()
const category = (m: Locator, name: string) => m.getByRole('button', { name: new RegExp(`^${name}\\b`) }).first()
const line = (m: Locator, name: string) => m.getByRole('button', { name: new RegExp(`^${name}`) }).first()

async function opensOnClassification(page: Page) {
  const m = form(page)
  await expect(m).toBeVisible()
  await expect(m.locator('[aria-current="step"]')).toContainText('Classification')
  return m
}

/* The category is the one the request named, picked and not changeable; the
   statement line starts where it was handed over and can be moved. */
async function categoryLockedLineOpen(m: Locator, cat: string, other: string, startLine: string, otherLine: string) {
  await expect(category(m, cat)).toHaveAttribute('aria-pressed', 'true')
  await expect(category(m, cat)).toBeDisabled()
  await expect(category(m, other)).toBeDisabled()
  await expect(line(m, startLine)).toHaveAttribute('aria-pressed', 'true')
  await line(m, otherLine).click()
  await expect(line(m, otherLine)).toHaveAttribute('aria-pressed', 'true')
  // On to Details, which comes second.
  await m.getByRole('button', { name: /^Continue/ }).click()
  await expect(m.locator('[aria-current="step"]')).toContainText('Details')
}

async function rowMenu(page: Page, name: string) {
  const row = page.locator('tbody tr', { hasText: name }).first()
  await row.scrollIntoViewIfNeeded()
  await row.getByRole('button', { name: `Actions for ${name}` }).click()
}

test.describe('the chart', () => {
  test('Create GL account in the header asks the category on step 1, unlocked', async ({ page }) => {
    await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Create GL account' }).first().click()
    const m = await opensOnClassification(page)
    await expect(category(m, 'Liability')).toBeEnabled()
  })

  test("a summary's Create GL account locks its category and leaves the line open", async ({ page }) => {
    await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
    await page.locator('tbody tr').first().waitFor()
    await rowMenu(page, 'Cash and Cash Equivalents')
    await page.getByRole('button', { name: /^Create GL account/ }).last().click()
    const m = await opensOnClassification(page)
    await expect(m.getByText('Set by 11100 · Cash and Cash Equivalents.')).toBeVisible()
    await categoryLockedLineOpen(m, 'Asset', 'Liability', 'Current asset', 'Non-current asset')
  })

  test('Create account below locks the category of the row it was started on', async ({ page }) => {
    await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
    await page.locator('tbody tr').first().waitFor()
    await rowMenu(page, 'Petty Cash')
    await page.getByRole('button', { name: 'Create account below' }).click()
    const m = await opensOnClassification(page)
    await categoryLockedLineOpen(m, 'Asset', 'Expense', 'Current asset', 'Non-current asset')
  })
})

test.describe("an account's page", () => {
  // A liability summary: the form used to open as an asset from here.
  test('Create GL account takes the summary\'s own category', async ({ page }) => {
    await page.goto('/chart-of-accounts/acct_21100', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Account actions' }).click()
    await page.getByRole('button', { name: /^Create GL account/ }).last().click()
    const m = await opensOnClassification(page)
    await expect(m.getByText('Set by 21100 · Accounts Payable.')).toBeVisible()
    await categoryLockedLineOpen(m, 'Liability', 'Asset', 'Current liability', 'Non-current liability')
  })

  test('Create account above opens on step 1 too', async ({ page }) => {
    await page.goto('/chart-of-accounts/acct_11120', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Account actions' }).click()
    await page.getByRole('button', { name: 'Create account above' }).click()
    const m = await opensOnClassification(page)
    await categoryLockedLineOpen(m, 'Asset', 'Revenue', 'Current asset', 'Non-current asset')
  })
})

test.describe('build from scratch', () => {
  async function toScratchAccounts(page: Page) {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
    await page.locator('table tbody tr').first().waitFor()
    await page.getByRole('button', { name: /View as first-time user/ }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Start building' }).click()
    await page.getByRole('button', { name: 'Skip for now' }).click()
    await page.getByRole('button', { name: 'Continue' }).last().click()
    await page.getByRole('button', { name: 'Skip for now' }).click()
    await page.getByRole('button', { name: /^Skip$/ }).last().click()
    await page.getByRole('button', { name: 'Skip for now' }).click()
  }

  test("a category's Add row locks the category", async ({ page }) => {
    await toScratchAccounts(page)
    await page.getByRole('button', { name: /Add row/ }).nth(1).click()
    const m = await opensOnClassification(page)
    await categoryLockedLineOpen(m, 'Liability', 'Asset', 'Current liability', 'Non-current liability')
  })

  test("a category anchor's Create GL account locks the category", async ({ page }) => {
    await toScratchAccounts(page)
    await rowMenu(page, 'Expense')
    await page.getByRole('button', { name: /^Create GL account/ }).last().click()
    const m = await opensOnClassification(page)
    await categoryLockedLineOpen(m, 'Expense', 'Revenue', 'Operating expense', 'Cost of goods sold')
  })

  test('Add account asks the category, unlocked', async ({ page }) => {
    await toScratchAccounts(page)
    await page.getByRole('button', { name: 'Add account' }).first().click()
    const m = await opensOnClassification(page)
    await expect(category(m, 'Equity')).toBeEnabled()
  })
})

test.describe('guided setup', () => {
  const footer = (page: Page) => page.getByRole('button', { name: /^(Continue|Skip|Review accounts|Publish chart|Publish)$/ }).last()
  async function dismissWelcome(page: Page) {
    const welcome = page.getByRole('button', { name: 'Skip for now' })
    await welcome.waitFor({ timeout: 2500 }).then(() => welcome.click()).catch(() => {})
  }

  test('Create account below on a proposed account opens on step 1, its category locked', async ({ page }) => {
    await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /View as first-time user/ }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Start guided setup' }).click()
    await dismissWelcome(page)
    await footer(page).click()                                   // Number length
    await dismissWelcome(page)
    await page.getByRole('button', { name: /^Accrual basis/ }).click()
    await footer(page).click()                                   // Your business
    await dismissWelcome(page)
    await footer(page).click()                                   // Dimensions, skipped
    await dismissWelcome(page)

    await page.getByRole('button', { name: 'Actions for Petty Cash' }).first().click()
    await page.getByRole('button', { name: 'Create account below' }).click()
    const m = await opensOnClassification(page)
    await categoryLockedLineOpen(m, 'Asset', 'Liability', 'Current asset', 'Non-current asset')
  })
})
