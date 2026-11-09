import { test, expect, type Page, type Locator } from '@playwright/test'

/* The block a new summary is offered, as settled in the design review of
   2026-09-24 (Eli, Nophil, Mahreen, Mahad):

   - Reserving is a switch, on by default, with the next block pre-filled:
     *"the default structure should be with the toggle on, with the preset next
     available reserve in there pre-done."* Off, nothing is pre-filled.
   - The offer is the next clean block one zero smaller than the parent's, never
     the leftover tail: *"you just took the last 500 numbers in this block."*
   - It is marked Recommended, and says why.
   - A reservation is a one-way block. It keeps accounts that are not under the
     summary out; it does not keep the summary's own in.
   - A refusal names the account in the way in a gray pill (Nophil).

   Read against the demo chart: Current Assets 11000 reserves 11000-11999, and
   the five summaries under it hold 11100-11199 through 11500-11599.

   In a browser because the offer is not a value the form holds - it is read off
   the chart through whichever parent the picker is pointing at. */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'Full view' }).last()
const field = (m: Locator, label: string) =>
  m.locator(`xpath=.//label[starts-with(normalize-space(.), "${label}")]/..`)

const start = (m: Locator) => m.getByLabel('Range start')
const end = (m: Locator) => m.getByLabel('Range end')
// The range's switch, not the Restricted account toggle below it.
const reserveSwitch = (m: Locator) => m.getByRole('switch').filter({ hasNotText: 'Restricted account' }).and(m.locator(':not([data-restricted-toggle] *)'))

/** An available block. The recommended one carries its tag inside the button. */
const blockPill = (m: Locator, label: string) => m.getByRole('button', { name: new RegExp(`^${label}`) })

/* Everything the group offers, in order, reached through its caption. */
const availableBlocks = (m: Locator, parent: string) =>
  m.locator(`xpath=.//div[normalize-space(.)="Available ranges under ${parent}"]/following-sibling::div[1]/button`)

/* The refusal under the fields, and the gray pill naming who is in the way. */
const refusal = (m: Locator) => m.locator('p.text-danger-600').first()
const pillIn = (m: Locator, name: string) => refusal(m).locator('span.rounded-md', { hasText: name })

async function newSummary(page: Page) {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Create GL account/ }).click()
  const m = modal(page)
  await m.getByRole('button', { name: /Continue/ }).first().click()
  await m.getByText('GL account details').first().waitFor()
  await field(m, 'GL account type').locator('button[aria-haspopup="listbox"]').click()
  await page.getByRole('option', { name: 'Summary', exact: true }).click()
  await expect(start(m)).toBeVisible()
  return m
}

async function pickParent(page: Page, m: Locator, number: string) {
  await field(m, 'Parent').locator('button[aria-haspopup="listbox"]').first().click()
  await page.getByRole('option', { name: new RegExp(number) }).first().click()
  await page.waitForTimeout(350)
}

test.describe('the block the form offers', () => {
  test('pre-fills the next clean block after what the parent holds, and marks it Recommended', async ({ page }) => {
    const m = await newSummary(page)
    await pickParent(page, m, '11000')
    await expect(start(m)).toHaveValue('11600')
    await expect(end(m)).toHaveValue('11699')
    await expect(blockPill(m, '11600–11699')).toContainText('Recommended')
    // The pill says Recommended on itself; no line under the pills restates it.
    await expect(m.getByText(/is the next full block of/)).toHaveCount(0)
  })

  /* Mahad, 2026-09-30: a block picked from the pills under Assets stayed in the
     fields when the parent went to Current Assets, where it is out of range.
     Only a range typed on the keyboard is the reader's own and stays; a picked
     one follows the parent, both ways. */
  test('re-offers the new parent\'s block when the parent changes, unless the range was typed', async ({ page }) => {
    const m = await newSummary(page)
    await pickParent(page, m, '10000')
    await expect(start(m)).toHaveValue('13000')
    // Picked from the pills, not typed.
    await availableBlocks(m, '10000').first().click()
    await expect(start(m)).toHaveValue('13000')
    await pickParent(page, m, '11000')
    await expect(start(m)).toHaveValue('11600')
    await expect(end(m)).toHaveValue('11699')
    await pickParent(page, m, '10000')
    await expect(start(m)).toHaveValue('13000')
    await expect(end(m)).toHaveValue('13999')

    // Typed: kept across the switch.
    await start(m).fill('14000')
    await end(m).fill('14999')
    await pickParent(page, m, '11000')
    await expect(start(m)).toHaveValue('14000')
    await expect(end(m)).toHaveValue('14999')
  })

  test('offers blocks one zero smaller than the parent, never the leftover tail', async ({ page }) => {
    const m = await newSummary(page)
    await pickParent(page, m, '11000')
    await expect(availableBlocks(m, '11000')).toHaveText([
      /^11600–11699/, '11700–11799', '11800–11899', '11900–11999',
    ])
    await expect(m.getByRole('button', { name: /^11600–11999/ })).toHaveCount(0)
  })

  test('moves when the parent moves, because the blocks it divides changed', async ({ page }) => {
    const m = await newSummary(page)
    await pickParent(page, m, '11000')
    await expect(start(m)).toHaveValue('11600')
    // Non-Current Assets reserves 12000-12999 and its summaries hold 12100-12399.
    await pickParent(page, m, '12000')
    await expect(start(m)).toHaveValue('12400')
    await expect(end(m)).toHaveValue('12499')
  })

  test('stops offering once the reader has typed a range of their own', async ({ page }) => {
    const m = await newSummary(page)
    await pickParent(page, m, '11000')
    await start(m).fill('11700')
    await end(m).fill('11750')
    await pickParent(page, m, '12000')
    await expect(start(m)).toHaveValue('11700')
    await expect(end(m)).toHaveValue('11750')
  })
})

test.describe('the reserve switch', () => {
  test('is on for a new summary', async ({ page }) => {
    const m = await newSummary(page)
    await expect(reserveSwitch(m)).toHaveAttribute('aria-checked', 'true')
  })

  test('off, takes the block away and pre-fills nothing, not even the number', async ({ page }) => {
    const m = await newSummary(page)
    await pickParent(page, m, '11000')
    await expect(field(m, 'GL account no.')).toContainText('11600')
    await reserveSwitch(m).click()
    await expect(start(m)).toHaveCount(0)
    await expect(field(m, 'GL account no.').locator('input')).toHaveValue('')
    await expect(m.getByText('No numbers are set aside.', { exact: false })).toBeVisible()
  })

  test('on again, brings the recommended block back', async ({ page }) => {
    const m = await newSummary(page)
    await pickParent(page, m, '11000')
    await reserveSwitch(m).click()
    await reserveSwitch(m).click()
    await expect(start(m)).toHaveValue('11600')
    await expect(end(m)).toHaveValue('11699')
  })
})

test.describe('what is left of the block', () => {
  test('says nothing about the blocks the siblings hold', async ({ page }) => {
    const m = await newSummary(page)
    await pickParent(page, m, '11000')
    for (const range of ['11100–11199', '11200–11299', '11300–11399', '11400–11499', '11500–11599']) {
      await expect(m.getByText(range, { exact: false })).toHaveCount(0)
    }
  })

  /* One thing the pills carry, so it cannot be lost quietly: the block in the
     fields is the filled pill. */
  test('fills the pill the fields are holding, and leaves the others open', async ({ page }) => {
    const m = await newSummary(page)
    await pickParent(page, m, '11000')
    await expect(blockPill(m, '11600–11699')).toHaveClass(/bg-brand-600/)
    await expect(blockPill(m, '11800–11899')).not.toHaveClass(/bg-brand-600/)
    await start(m).fill('11800')
    await end(m).fill('11899')
    await expect(blockPill(m, '11800–11899')).toHaveClass(/bg-brand-600/)
    await expect(blockPill(m, '11600–11699')).not.toHaveClass(/bg-brand-600/)
  })

  test('draws no range bar', async ({ page }) => {
    const m = await newSummary(page)
    await pickParent(page, m, '11000')
    await expect(m.locator('div.absolute.inset-y-0')).toHaveCount(0)
  })

  test('captions the group by its parent, without tallying it', async ({ page }) => {
    const m = await newSummary(page)
    await pickParent(page, m, '11000')
    await expect(m.getByText('Available ranges under 11000', { exact: true })).toBeVisible()
    await expect(m.getByText('Taken', { exact: true })).toHaveCount(0)
    await expect(m.getByText('Free', { exact: true })).toHaveCount(0)
  })
})

test.describe('picking an available block', () => {
  test('puts it in both fields, and numbers the summary with its first number', async ({ page }) => {
    const m = await newSummary(page)
    await pickParent(page, m, '11000')
    await blockPill(m, '11700–11799').click()
    await expect(start(m)).toHaveValue('11700')
    await expect(end(m)).toHaveValue('11799')
    await expect(field(m, 'GL account no.')).toContainText('11700')
    await expect(m.getByText(/already exists/i)).toHaveCount(0)
  })
})

test.describe('a reservation is a one-way block', () => {
  test('lets a range run past the parent\'s block where nothing else holds those numbers', async ({ page }) => {
    const m = await newSummary(page)
    await pickParent(page, m, '12000')
    await start(m).fill('12900')
    await end(m).fill('13050')
    await expect(m.locator('p.text-danger-600')).toHaveCount(0)
  })

  test('refuses a range reaching into another summary\'s block, naming it in a pill', async ({ page }) => {
    const m = await newSummary(page)
    await pickParent(page, m, '11000')
    await start(m).fill('11550')
    await end(m).fill('11650')
    await expect(pillIn(m, 'Prepaid Expenses and Other')).toBeVisible()
    await expect(refusal(m)).toContainText('sets aside (11500–11599)')
  })

  test('refuses a range over a number another account already holds', async ({ page }) => {
    const m = await newSummary(page)
    await pickParent(page, m, '11000')
    await start(m).fill('11050')
    await end(m).fill('11150')
    await expect(pillIn(m, 'Cash and Cash Equivalents')).toBeVisible()
    await expect(refusal(m)).toContainText('already uses a number in this range')
  })
})

test.describe('an existing summary', () => {
  test('keeps the range it was saved with, the switch on', async ({ page }) => {
    await page.goto('/chart-of-accounts/acct_11400', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /Edit account/i }).first().click()
    const m = modal(page)
    await expect(reserveSwitch(m)).toHaveAttribute('aria-checked', 'true')
    await expect(start(m)).toHaveValue('11400')
    await expect(end(m)).toHaveValue('11499')
  })

  test('does not count its own block against itself, so its range still fits', async ({ page }) => {
    await page.goto('/chart-of-accounts/acct_11400', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /Edit account/i }).first().click()
    const m = modal(page)
    await expect(blockPill(m, '11400–11499')).toHaveClass(/bg-brand-600/)
    await expect(m.locator('p.text-danger-600')).toHaveCount(0)
  })

  test('shows the switch off on a summary saved without a range', async ({ page }) => {
    // Long-Term Debt is the demo's summary left without a typed range.
    await page.goto('/chart-of-accounts/acct_22100', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /Edit account/i }).first().click()
    const m = modal(page)
    await expect(reserveSwitch(m)).toHaveAttribute('aria-checked', 'false')
    await expect(start(m)).toHaveCount(0)
  })
})
