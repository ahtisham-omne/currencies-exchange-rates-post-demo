import { test, expect, type Page } from '@playwright/test'

/* "Move under a new summary account". It creates a summary, so it is asked for
   the way the create flow asks for one - the same modal, step tabs, Type and GL
   account details cards, number range card and placement preview - with what
   the move settles shown as locked fields. The explanation lives in How it
   works (Mahad, 2026-09-29), and the tree the design review of 2026-09-24 asked
   for is the preview step.

   Petty Cash (11110) sits under Cash and Cash Equivalents (11100). */

const body = (page: Page) => page.locator('[data-move-under-summary]')

async function open(page: Page) {
  await page.goto('/chart-of-accounts/acct_11110', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Account actions' }).first().click()
  await page.getByText('Move under a new summary account').first().click()
  await body(page).waitFor()
  return body(page)
}

test('asks for the summary the way the create flow does, with the move settled', async ({ page }) => {
  const b = await open(page)
  // The title names the account being moved (design review, 2026-09-30).
  await expect(page.getByText('Move Petty Cash under a new summary account')).toBeVisible()
  await expect(page.getByRole('button', { name: /Details/ }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Preview/ }).first()).toBeVisible()
  for (const title of ['Type', 'GL account details']) await expect(b.getByRole('heading', { name: title })).toBeVisible()
  await expect(b.getByText('Reserve a number range')).toBeVisible()
  await expect(b.getByLabel('GL account name')).toBeFocused()
  // What the move settles, as locked fields - and no halfway tree: the parent
  // and the account are shown in the preview, not here.
  const locked = (await b.locator('div.input').allInnerTexts()).map(t => t.trim())
  // The number directly in front of the account (design review, 2026-10-02).
  expect(locked).toEqual(expect.arrayContaining(['Summary', '11109']))
  expect(locked).not.toContain('11100 · Cash and Cash Equivalents')
  // And nothing else on the form: the explanation is in How it works.
  await expect(b.getByText('What happens when you move it')).toHaveCount(0)
})

test('says what the move means in a banner above Type, pointing to How it works', async ({ page }) => {
  const b = await open(page)
  const banner = b.getByText("A new summary takes Petty Cash's place")
  await expect(banner).toBeVisible()
  await expect(b).toContainText("shows all of the account's history, and you can add new accounts beside it")
  // Above the Type card.
  const bannerY = (await banner.boundingBox())!.y
  const typeY = (await b.getByRole('heading', { name: 'Type' }).boundingBox())!.y
  expect(bannerY).toBeLessThan(typeY)
  await b.getByRole('button', { name: 'See how it works' }).click()
  await expect(page.getByRole('dialog', { name: 'Moving an account under a new summary' })).toBeVisible()
})

/* At the end of the Details step since 2026-10-01 - Mahad: *"Can we have this
   animation at the end of the detail step."* It plays as the dialog opens and
   names the summary as it is typed; Preview keeps the placement table. */
test('plays the move out at the end of Details: before, then the summary in its place and the account under it', async ({ page }) => {
  const b = await open(page)
  const play = page.locator('[data-move-playback]')
  // Below the form it explains.
  const detailsY = (await b.getByRole('heading', { name: 'GL account details' }).boundingBox())!.y
  expect((await play.boundingBox())!.y).toBeGreaterThan(detailsY)
  await expect(play).toContainText('11109 · New summary')
  await b.getByLabel('GL account name').fill('Petty cash funds')
  // It waits below the fold until it is scrolled to, then plays.
  await expect(play).toHaveAttribute('data-move-playback', 'before')
  await play.scrollIntoViewIfNeeded()
  await expect(play).toHaveAttribute('data-move-playback', 'after', { timeout: 4000 })
  await expect(play).toContainText('After the move')
  await expect(play).toContainText('11100 · Cash and Cash Equivalents')
  await expect(play).toContainText('11109 · Petty cash funds')
  await expect(play).toContainText('11110 · Petty Cash')
  await expect(play).toContainText('Moves here')
  // On a loop, with nothing to press (design review, 2026-10-02): it starts
  // over by itself and plays again.
  await expect(play.getByRole('button', { name: 'Replay' })).toHaveCount(0)
  await expect(play).toHaveAttribute('data-move-playback', 'before', { timeout: 6000 })
  await expect(play).toHaveAttribute('data-move-playback', 'after', { timeout: 4000 })
  // Not played a second time on Preview.
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(body(page).getByText('Placement preview')).toBeVisible()
  await expect(play).toHaveCount(0)
})

test('previews the tree: the parent, the new summary, and the account under it', async ({ page }) => {
  const b = await open(page)
  await b.getByLabel('GL account name').fill('Petty cash funds')
  await page.getByRole('button', { name: 'Continue' }).click()
  const preview = body(page)
  await expect(preview.getByText('Placement preview')).toBeVisible()
  const rows = await preview.locator('tbody tr').allInnerTexts()
  const at = (text: string) => rows.findIndex(r => r.includes(text))
  expect(at('Cash and Cash Equivalents')).toBeGreaterThan(-1)
  expect(at('Petty cash funds')).toBe(at('Cash and Cash Equivalents') + 1)
  expect(rows[at('Petty cash funds')]).toContain('New')
  expect(rows[at('Petty cash funds') + 1]).toContain('Petty Cash')
  expect(rows[at('Petty cash funds') + 1]).toContain('Moves here')
})

test('explains the move in How it works', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'How it works' }).first().click()
  const guide = page.getByRole('dialog', { name: 'Moving an account under a new summary' })
  await expect(guide).toBeVisible()
  await guide.getByRole('button', { name: 'What happens to the history' }).click()
  await expect(guide).toContainText('inherits the account\'s whole history')
  await guide.getByRole('button', { name: 'Why it cannot go anywhere else' }).click()
  await expect(guide).toContainText('cannot move into a summary that already exists')
})

test('asks for a name before the preview, and refuses a number already on the chart', async ({ page }) => {
  const b = await open(page)
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(b).toContainText('Name the new summary account.')
  await b.getByLabel('GL account name').fill('Petty cash funds')
  // Without a block, the number is typed, and checked like any other.
  await b.getByRole('switch').click()
  await b.getByLabel('GL account no.').fill('11120')
  await expect(b).toContainText('11120 is already on the chart.')
})

test('creates the summary in place and moves the account under it', async ({ page }) => {
  const b = await open(page)
  await b.getByLabel('GL account name').fill('Petty cash funds')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Create and move' }).click()
  await expect(page.getByText('Petty Cash now sits under Petty cash funds')).toBeVisible()
  await page.waitForURL(url => !url.pathname.endsWith('acct_11110'))

  await page.getByTitle('Back to Chart of Accounts').first().click()
  await page.getByPlaceholder('Search accounts').fill('petty')
  await expect(page.locator('tbody tr', { hasText: 'Petty cash funds' })).toHaveCount(1)
  await expect(page.locator('tbody tr', { hasText: 'Petty Cash' }).filter({ hasNotText: 'funds' })).toHaveCount(1)
})

test('opens from the chart\'s row menu too', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  const row = page.locator('tbody tr', { hasText: 'Petty Cash' }).first()
  await row.hover()
  await row.getByRole('button', { name: /actions/i }).first().click()
  await page.getByText('Move under a new summary account').first().click()
  await expect(body(page)).toBeVisible()
})
