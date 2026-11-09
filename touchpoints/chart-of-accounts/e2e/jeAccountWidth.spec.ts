import { test, expect } from '@playwright/test'
import { settle } from './glPage'

/* A long account name truncates in the line's picker rather than widening the
   Account column. Mahad, 2026-10-02: *"The input gets weirdly wide when I select
   an account with a long name."* */
test('keeps the account column its width whatever the account is called', async ({ page }) => {
  await settle(page, '/general-ledger')
  await page.getByRole('button', { name: 'New journal entry' }).first().click()
  const m = page.locator('body > div.fixed').filter({ hasText: 'New journal entry' }).last()
  await m.getByText('Journal lines').first().waitFor()
  const picker = m.locator('table button[aria-haspopup="listbox"]').first()
  const th = m.locator('table th').first()
  const before = (await picker.boundingBox())!.width
  const thBefore = (await th.boundingBox())!.width
  const tableBefore = (await m.locator('table').first().boundingBox())!.width
  await picker.click()
  const list = page.getByRole('listbox').last()
  await list.getByPlaceholder('Search account by name or number').fill('32200')
  await list.getByRole('option').filter({ hasText: '32200 · ' }).first().click()
  await expect(picker).toContainText('Manual GL Transactions')
  const after = (await picker.boundingBox())!.width
  /* The column keeps its share of the table. The table itself can move by a
     scrollbar's width as the form below it grows, so the share is what is held. */
  const share = async () => (await th.boundingBox())!.width / (await m.locator('table').first().boundingBox())!.width
  expect(Math.abs((await share()) - thBefore / tableBefore)).toBeLessThan(0.005)
  expect(after).toBeLessThanOrEqual((await th.boundingBox())!.width)
  void before
  // The amounts stay inside the modal.
  const table = (await m.locator('table').first().boundingBox())!
  const modal = (await m.locator('div').first().boundingBox())!
  expect(table.x + table.width).toBeLessThanOrEqual(modal.x + modal.width + 1)
  await m.locator('table').first().screenshot({ path: 'test-results/je-account-width.png' })
})
