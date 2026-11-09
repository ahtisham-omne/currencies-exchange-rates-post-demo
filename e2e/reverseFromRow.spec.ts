import { test, expect } from '@playwright/test'
import { settle, view } from './glPage'

/* Mahad, 2026-10-08: a journal entry row's Actions menu reverses the entry. It
   opens the same flow as the entry's own "Reverse this entry" - date, reason,
   the mirrored lines. An entry already reversed has it greyed, naming the entry
   that reversed it (Mahad, 2026-10-11). */

test('reverses an entry from its row, and greys it on one already reversed', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await settle(page, '/general-ledger')
  await view(page, 'Journal entries').click()

  const menuFor = async (je: string) => {
    await page.getByRole('button', { name: `Actions for ${je}` }).first().click()
    return page.getByRole('button', { name: 'Reverse entry' })
  }
  const first = page.getByRole('button', { name: /^Actions for JE-/ }).first()
  const original = (await first.getAttribute('aria-label'))!.replace('Actions for ', '')

  await (await menuFor(original)).click()
  const dialog = page.getByRole('alertdialog').filter({ hasText: `Reverse ${original}?` })
  await expect(dialog).toBeVisible()
  // Mahad's copy and layout, 2026-10-08: the new number in a locked field, the lines as GL impact.
  await expect(dialog).toContainText('This posts a new entry with every debit and credit flipped. Both entries stay on the ledger and cancel each other out.')
  await expect(dialog.getByLabel('Journal entry number', { exact: true })).toContainText(/^JE-\d{4}-\d+$/)
  await expect(dialog.getByText('GL impact', { exact: true })).toBeVisible()
  await dialog.getByLabel('Reason for reversal').fill('Reversed from the listing')
  await dialog.getByRole('button', { name: /^Post JE-/ }).click()

  // Lands on the reversing entry, which names the one it backs out.
  await page.waitForURL(u => /\/general-ledger\/entry\//.test(u.pathname) && !decodeURIComponent(u.pathname).endsWith(original))
  await expect(page.getByText('Reversed from the listing')).toBeVisible()
  await expect(page.getByRole('link', { name: original })).toBeVisible()

  // Back on the listing, the original's menu greys it and opens nothing.
  await settle(page, '/general-ledger')
  await view(page, 'Journal entries').click()
  const reverse = await menuFor(original)
  await expect(reverse).toHaveAttribute('aria-disabled', 'true')
  await reverse.click({ force: true })
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
})
