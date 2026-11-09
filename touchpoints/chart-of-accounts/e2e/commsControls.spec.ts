import { test, expect, type Page } from '@playwright/test'

/* The Communication tab's controls that did nothing, or did the wrong thing.
   Eli, design review 2026-09-24: *"some of your buttons aren't working fully."*
   Each was found by clicking through the tab; each is pinned here by what the
   click now does.

   Read on 52310 Rent Expense, whose threads carry comments, attachments and
   unread mail. */

async function open(page: Page, id = 'acct_52310') {
  await page.goto(`/chart-of-accounts/${id}`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /^Communication/ }).first().click()
  const root = page.locator('[data-comms]').first()
  await root.locator('button[aria-current]').first().waitFor()
  return root
}

test('the density menu opens and changes the density', async ({ page }) => {
  const root = await open(page)
  await root.getByLabel(/View density/).click()
  await page.getByText('Compact view').click()
  await expect(root.getByLabel(/View density/)).toHaveAttribute('aria-label', 'View density: Condensed')
})

test('Mark as unread reaches the list, and opening the thread reads it again', async ({ page }) => {
  const root = await open(page)
  const rows = root.locator('button[aria-current]')
  await rows.first().click()
  const firstRow = rows.first()
  await expect(firstRow.locator('[aria-label="Unread"]')).toHaveCount(0)
  await root.getByLabel('More actions').click()
  await page.getByRole('button', { name: 'Mark as unread' }).click()
  // The list says so, not only the header.
  await expect(firstRow.locator('[aria-label="Unread"]')).toHaveCount(1)
  await expect(root.locator('h2').locator('..').getByText('Unread', { exact: true })).toBeVisible()
  // Away and back: opening it is reading it.
  await rows.nth(1).click()
  await rows.first().click()
  await expect(firstRow.locator('[aria-label="Unread"]')).toHaveCount(0)
})

test('the Comments pill counts what the panel counts', async ({ page }) => {
  const root = await open(page)
  await root.locator('button[aria-current]').filter({ hasText: 'Support for' }).first().click()
  const pill = root.getByRole('button', { name: /^Comments\s*\d/ })
  const pillCount = Number((await pill.innerText()).match(/\d+/)![0])
  await pill.click()
  const sub = await page.getByText(/comments? on this thread/).innerText()
  expect(Number(sub.match(/\d+/)![0])).toBe(pillCount)
})

test('a comment started from a message card lands on that card', async ({ page }) => {
  const root = await open(page)
  await root.locator('button[aria-current]').filter({ hasText: 'Support for' }).first().click()
  const cards = root.locator('li[data-message-id]')
  expect(await cards.count()).toBeGreaterThan(1)
  const commentBtn = (i: 'first' | 'last') => cards[i]().getByRole('button', { name: /^Comment/ })
  const countOf = async (i: 'first' | 'last') => Number(((await commentBtn(i).getAttribute('aria-label')) ?? '').match(/\d+/)?.[0] ?? 0)
  const [firstBefore, lastBefore] = [await countOf('first'), await countOf('last')]
  await commentBtn('first').click()
  await page.getByLabel('Add a comment').fill('On the first message')
  await page.getByRole('button', { name: 'Post' }).click()
  await page.keyboard.press('Escape')
  await expect.poll(() => countOf('first')).toBe(firstBefore + 1)
  expect(await countOf('last')).toBe(lastBefore)
})

test('a comments group header takes the reader to its message', async ({ page }) => {
  const root = await open(page)
  await root.locator('button[aria-current]').filter({ hasText: 'Support for' }).first().click()
  await root.getByRole('button', { name: /^Comments\s*\d/ }).click()
  await page.getByRole('button', { name: /^From:/ }).first().click()
  await expect(page.getByText(/comments? on this thread/)).toHaveCount(0)
})

test('a resolved comment can be reopened', async ({ page }) => {
  const root = await open(page)
  await root.locator('button[aria-current]').filter({ hasText: 'Support for' }).first().click()
  await root.getByRole('button', { name: /^Comments\s*\d/ }).click()
  const reopenBefore = await page.getByRole('button', { name: 'Reopen', exact: true }).count()
  await page.getByRole('button', { name: 'Resolve', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Reopen', exact: true })).toHaveCount(reopenBefore + 1)
})

test('Forward after Reply opens a fresh pane, not the reply\'s recipients', async ({ page }) => {
  const root = await open(page)
  await root.locator('button[aria-current]').filter({ hasText: 'Support for' }).first().click()
  const last = root.locator('li[data-message-id]').last()
  await last.getByRole('button', { name: 'Reply', exact: true }).first().click()
  const to = root.getByLabel('To recipients').locator('..')
  await expect(to).not.toHaveText(/^\s*$/)
  const replyTo = await to.innerText()
  await last.getByRole('button', { name: 'Forward', exact: true }).first().click()
  await expect(to).not.toHaveText(replyTo)
})

test('Export conversation downloads the conversation', async ({ page }) => {
  const root = await open(page)
  await root.locator('button[aria-current]').first().click()
  const download = page.waitForEvent('download')
  await root.getByLabel('More actions').click()
  await page.getByRole('button', { name: 'Export conversation' }).click()
  const d = await download
  expect(d.suggestedFilename()).toMatch(/\.txt$/)
})

test('a sent reply keeps its attachment and its confidential mark, and reads a proper time', async ({ page }) => {
  const root = await open(page)
  await root.locator('button[aria-current]').filter({ hasText: 'Support for' }).first().click()
  await root.locator('li[data-message-id]').last().getByRole('button', { name: 'Reply', exact: true }).first().click()
  await root.getByLabel('Message body').click()
  await page.keyboard.type('Attached, as asked.')
  await root.getByLabel('Mark as confidential').click()
  await page.locator('input[type=file]').last().setInputFiles({ name: 'proof.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') })
  await root.getByRole('button', { name: /^Send$/ }).click()
  const sent = root.locator('li[data-message-id]').last()
  await expect(sent).toContainText('Attached, as asked.')
  await expect(sent).toContainText('proof.pdf')
  await expect(sent).toContainText(/Confidential/i)
  await expect(sent).not.toContainText(/\d{4}-\d{2}-\d{2}T/)
})
