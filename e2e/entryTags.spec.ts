import { test, expect, type Locator, type Page } from '@playwright/test'
import { settle } from './glPage'

/* Tags on a journal entry (Mahad, 2026-09-30, to the EntityTagChip spec): a Tags
   field while the entry is written, and the same chips on its page, where Add Tag
   opens an input with Save and Cancel. One validator behind both - duplicates
   ignore case, whitespace is collapsed, eight per entry, thirty characters each. */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'New journal entry' }).last()

async function fillLine(page: Page, m: Locator, row: number, number: string, col: 'debit' | 'credit', amount: string) {
  await m.locator('table button[aria-haspopup="listbox"]').nth(row).click()
  const list = page.getByRole('listbox').last()
  await list.getByPlaceholder('Search account by name or number').fill(number)
  await list.getByRole('option').filter({ hasText: `${number} · ` }).first().click()
  await expect(list).toHaveCount(0)
  await m.locator('table').getByLabel(col, { exact: true }).nth(row).fill(amount)
}

const chip = (scope: Page | Locator, label: string) => scope.getByRole('button', { name: `Remove tag ${label}`, exact: true })

test('tags typed while writing the entry arrive on its page, and can be added and removed there', async ({ page }) => {
  await settle(page, '/general-ledger')
  await page.getByRole('button', { name: 'New journal entry' }).first().click()
  const m = modal(page)
  await m.getByText('Journal lines').first().waitFor()

  const field = m.getByLabel('Tags', { exact: true })
  await expect(m).toContainText('Press enter or comma to add tags. Up to 8 tags, 30 characters each.')
  // Enter and comma both add; inner whitespace is collapsed.
  await field.fill('quarterly')
  await field.press('Enter')
  await field.pressSequentially('dock   5,')
  await expect(chip(m, 'quarterly')).toBeVisible()
  await expect(chip(m, 'dock 5')).toBeVisible()
  // A duplicate, in other case, is refused with the spec's wording.
  await field.fill('QUARTERLY')
  await field.press('Enter')
  await expect(m).toContainText('"QUARTERLY" is already added.')
  await field.fill('')
  // Clamped as it is typed, not refused afterwards.
  await field.fill('x'.repeat(40))
  await expect(field).toHaveValue('x'.repeat(30))
  await field.fill('')
  // Removed from the chip's own x.
  await field.fill('scratch')
  await field.press('Enter')
  await chip(m, 'scratch').click()
  await expect(chip(m, 'scratch')).toHaveCount(0)

  await fillLine(page, m, 0, '52110', 'debit', '40')
  await fillLine(page, m, 1, '11130', 'credit', '40')
  await m.getByRole('button', { name: 'Post journal entry' }).click()
  await page.waitForURL(/\/general-ledger\/entry\//)

  const card = page.locator('div').filter({ has: page.getByText('Journal entry information', { exact: true }) }).last()
  await expect(chip(card, 'quarterly')).toBeVisible()
  await expect(chip(card, 'dock 5')).toBeVisible()

  // Add Tag opens the editor; Save commits and closes.
  await card.getByRole('button', { name: 'Add Tag' }).click()
  const input = card.getByLabel('New tag')
  await input.fill('east-annex')
  await card.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(chip(card, 'east-annex')).toBeVisible()
  await expect(input).toHaveCount(0)

  // Cancel discards, even with text in the box - nothing commits on blur.
  await card.getByRole('button', { name: 'Add Tag' }).click()
  await card.getByLabel('New tag').fill('never-saved')
  await card.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(chip(card, 'never-saved')).toHaveCount(0)

  // Escape discards too.
  await card.getByRole('button', { name: 'Add Tag' }).click()
  await card.getByLabel('New tag').fill('escaped')
  await card.getByLabel('New tag').press('Escape')
  await expect(chip(card, 'escaped')).toHaveCount(0)
  await expect(card.getByLabel('New tag')).toHaveCount(0)

  // A duplicate is refused in place, and the editor stays open to fix it.
  await card.getByRole('button', { name: 'Add Tag' }).click()
  await card.getByLabel('New tag').fill('Dock 5')
  await card.getByLabel('New tag').press('Enter')
  await expect(card).toContainText('"Dock 5" is already added.')
  await card.getByRole('button', { name: 'Cancel', exact: true }).click()

  // Removing from the page sticks.
  await chip(card, 'quarterly').click()
  await expect(chip(card, 'quarterly')).toHaveCount(0)

  // Eight on the record and Add Tag goes.
  for (const t of ['a1', 'a2', 'a3', 'a4', 'a5', 'a6']) {
    await card.getByRole('button', { name: 'Add Tag' }).click()
    await card.getByLabel('New tag').fill(t)
    await card.getByLabel('New tag').press('Enter')
  }
  await expect(card.getByRole('button', { name: /^Remove tag / })).toHaveCount(8)
  await expect(card.getByRole('button', { name: 'Add Tag' })).toHaveCount(0)
})
