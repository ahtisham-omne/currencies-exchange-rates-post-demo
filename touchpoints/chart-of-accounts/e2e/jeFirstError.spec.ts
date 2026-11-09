import { test, expect, type Page, type Locator } from '@playwright/test'
import { settle } from './glPage'

/* Design review, 2026-10-02, the new journal entry form.

   - The error rule (to go into the design system): a refused Post says what is
     wrong and how many things are, and takes the reader to the first of them
     and highlights it - every press, the first one still left, in page order.
     Eli: *"If I hit post, always take me to the first error on the message.
     Once I fix that, then take me to the next one."*
   - An account the picker greys out says why on hover. Eli could not pick
     Operating revenue and could not tell why; Nophil: *"there should be a hover
     state that tells you why it's not selectable."*

   Pinned on the running page: where focus lands and what turns red are what a
   reader sees, and neither can be read off the source. */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'New journal entry' }).last()

async function openEntry(page: Page) {
  await settle(page, '/general-ledger')
  await page.getByRole('button', { name: 'New journal entry' }).first().click()
  const m = modal(page)
  await m.getByText('Journal lines').first().waitFor()
  return m
}

const linePicker = (m: Locator, row = 0) => m.locator('table button[aria-haspopup="listbox"]').nth(row)
const amount = (m: Locator, row: number, col: 'debit' | 'credit') => m.locator('table').getByLabel(col, { exact: true }).nth(row)

async function pickAccount(page: Page, m: Locator, row: number, number: string) {
  await linePicker(m, row).click()
  const list = page.getByRole('listbox').last()
  await list.getByPlaceholder('Search account by name or number').fill(number)
  await list.getByRole('option').filter({ hasText: `${number} · ` }).first().click()
  await expect(list).toHaveCount(0)
}

const post = (m: Locator) => m.getByRole('button', { name: 'Post journal entry' }).click()

// Which field Post took the reader to: the one holding focus.
const focusedTarget = (page: Page) =>
  page.evaluate(() => document.activeElement?.closest('[data-je-target]')?.getAttribute('data-je-target') ?? null)

test.describe('a refused Post takes the reader to the first thing to fix', () => {
  test('lands on the first line\'s account when no line is filled, and reddens both lines it needs', async ({ page }) => {
    const m = await openEntry(page)
    await post(m)
    await expect.poll(() => focusedTarget(page)).toMatch(/^line-.+-account$/)
    const first = await focusedTarget(page)
    expect(first).toBe(await m.locator('[data-je-target$="-account"]').first().getAttribute('data-je-target'))
    // Both lines owe an account and an amount, and say so where they stand.
    await expect(m.getByText('Pick an account and enter an amount for this line.')).toHaveCount(2)
    for (const row of [0, 1]) await expect(linePicker(m, row)).toHaveClass(/border-danger-500/)
    // And the banner still says what and how many.
    await expect(m.getByText("This entry can't post yet - 1 thing to fix.")).toBeVisible()
  })

  test('moves on to the next one once the first is fixed', async ({ page }) => {
    const m = await openEntry(page)
    await pickAccount(page, m, 0, '52110')
    await amount(m, 0, 'debit').fill('250')
    await pickAccount(page, m, 1, '11130')
    await post(m)
    // The second line has its account and no amount.
    await expect.poll(() => focusedTarget(page)).toMatch(/^line-.+-amount$/)
    await expect(m.getByText('Enter a debit or a credit for this line.')).toBeVisible()

    await amount(m, 1, 'credit').fill('200')
    await post(m)
    // Lines complete, totals $50 apart: the totals strip, its fix button in hand.
    await expect.poll(() => focusedTarget(page)).toBe('balance')
    await expect(page.locator(':focus')).toHaveText(/Add balancing line/)

    await amount(m, 1, 'credit').fill('250')
    await expect(m.getByText('Balanced').first()).toBeVisible()
  })

  test('ends on the reason, which sits below the lines', async ({ page }) => {
    const m = await openEntry(page)
    await pickAccount(page, m, 0, '32200')
    await amount(m, 0, 'debit').fill('100')
    await pickAccount(page, m, 1, '11130')
    await amount(m, 1, 'credit').fill('90')
    await post(m)
    // Out of balance and no reason: the balance first, being higher on the page.
    await expect.poll(() => focusedTarget(page)).toBe('balance')
    const items = m.locator('[data-je-field="problems"] li')
    await expect(items).toHaveText(['Debits and credits must match. They are $ 10.00 apart.', 'Write why this adjustment is needed.'])

    await amount(m, 1, 'credit').fill('100')
    await post(m)
    await expect.poll(() => focusedTarget(page)).toBe('reason')
  })

  test('blinks the border of the field it lands on', async ({ page }) => {
    const m = await openEntry(page)
    await post(m)
    await expect(m.locator('.form-error-flash')).toHaveCount(1)
    // The field's own bordered box blinks, inside the first line's account cell (2026-10-08).
    await expect(m.locator('[data-je-target^="line-"][data-je-target$="-account"] .form-error-flash, .form-error-flash[data-je-target$="-account"]')).toHaveCount(1)
  })
})

test.describe('an account the picker greys out says why', () => {
  async function hoverOption(page: Page, m: Locator, search: string, label: RegExp) {
    await linePicker(m).click()
    const list = page.getByRole('listbox').last()
    await list.getByPlaceholder('Search account by name or number').fill(search)
    const option = list.getByRole('option').filter({ hasText: label }).first()
    await expect(option).toHaveAttribute('aria-disabled', 'true')
    await option.hover()
  }

  test('a summary account', async ({ page }) => {
    const m = await openEntry(page)
    await hoverOption(page, m, 'Current Assets', /11000 · Current Assets/)
    await expect(page.getByText('Current Assets is a summary account. It adds up the accounts under it, so it can\'t take entries itself. Pick one of the accounts under it.')).toBeVisible()
  })

  /* Mahad, 2026-10-05: the card sat at the panel's left edge for every account,
     however deep it was nested, so it pointed at nothing in particular. It lines
     up with where the hovered account's text starts. */
  test('opens under the account it explains, at any depth', async ({ page }) => {
    const m = await openEntry(page)
    for (const [search, label, text] of [
      ['Current Assets', /11000 · Current Assets/, 'Current Assets is a summary account.'],
      ['Short-Term', /11200 · Short-Term Investments/, 'Short-Term Investments is a summary account.'],
    ] as const) {
      await hoverOption(page, m, search, label)
      const option = page.getByRole('listbox').last().getByRole('option').filter({ hasText: label }).first()
      const mark = (await option.locator('[data-option-text]').boundingBox())!
      const card = (await page.getByText(text).boundingBox())!
      const row = (await option.boundingBox())!
      expect(Math.abs(card.x - mark.x), `${text} lines up with its account`).toBeLessThan(2)
      expect(card.y).toBeGreaterThanOrEqual(row.y + row.height)
      await page.keyboard.press('Escape')
    }
  })

  // Archived and deactivated accounts are not in the list at all (Mahad, 2026-10-08).
  test('an archived or deactivated account is not offered', async ({ page }) => {
    const m = await openEntry(page)
    for (const number of ['11180', '53020']) {
      await linePicker(m).click()
      const list = page.getByRole('listbox').last()
      await list.getByPlaceholder('Search account by name or number').fill(number)
      await expect(list.getByRole('option').filter({ hasText: new RegExp(`${number} · `) })).toHaveCount(0)
      await linePicker(m).click()
    }
  })
})
