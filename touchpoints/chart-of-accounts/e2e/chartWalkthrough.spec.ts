import { test, expect, type Page } from '@playwright/test'

/* Your business leads to Dimensions now (2026-10-08). Skipped here: its tour's
   welcome is closed if it comes up, then the step is skipped. */
async function skipGuidedDimensions(page: Page) {
  await page.getByRole('button', { name: 'Continue' }).last().click()
  await expect(page.getByRole('heading', { name: 'What do you want to report by?' })).toBeVisible()
  const welcome = page.getByRole('button', { name: 'Skip for now' })
  await welcome.waitFor({ timeout: 2500 }).then(() => welcome.click()).catch(() => {})
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
}


/* The chart of accounts walkthrough: the tour Build from scratch has on its
   Dimensions step, now on the step where the chart is built, on both paths.
   Mahad, 2026-10-02: *"For the Chart of Accounts and Chart of Accounts
   Validation, I want us to design and build a Guided Setup (Build from Scratch)
   experience following that same approach."* Offered once on arrival, six
   cards (Mahad's copy of 2026-10-02), and back in from How it works. */

async function firstTime(page: Page, path: 'Start building' | 'Start guided setup') {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.locator('table tbody tr').first().waitFor()
  await page.getByRole('button', { name: /View as first-time user/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: path }).click()
  await expect(page.getByText('Set up your account numbers')).toBeVisible()
}

const tour = (page: Page) => page.getByRole('dialog', { name: 'Chart of accounts walkthrough' })
const welcome = (page: Page) => page.getByText('Welcome to your chart of accounts')

async function toScratchAccounts(page: Page) {
  await firstTime(page, 'Start building')
  await page.getByRole('button', { name: 'Continue' }).last().click()
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.getByRole('button', { name: /^Skip$/ }).last().click()
}

async function toGuidedAccounts(page: Page) {
  await firstTime(page, 'Start guided setup')
  await page.getByRole('button', { name: 'Continue' }).last().click()
  // The questions' own introduction comes first (2026-10-02).
  await page.getByRole('button', { name: 'Skip for now' }).click()
  // The accounting method is the one required answer (2026-10-02).
  await page.getByRole('button', { name: /^Accrual basis/ }).click()
  await skipGuidedDimensions(page)
}

/* Walks every card, recording each title and whether anything was lit. */
async function walk(page: Page, shots?: string) {
  await expect(welcome(page)).toBeVisible()
  if (shots) await page.screenshot({ path: `test-results/chart-tour/${shots}-0.png` })
  await page.getByRole('button', { name: /Start (walkthrough|tour)/ }).click()
  const titles: string[] = []
  for (let i = 0; i < 12; i++) {
    const card = tour(page)
    await expect(card).toBeVisible()
    await page.waitForTimeout(450)
    titles.push((await card.locator('h3, [data-card-title]').first().innerText().catch(() => '')).trim())
    if (shots) await page.screenshot({ path: `test-results/chart-tour/${shots}-${i + 1}.png` })
    const done = card.getByRole('button', { name: 'Done' })
    if (await done.count()) { await done.click(); break }
    await card.getByRole('button', { name: 'Next' }).click()
  }
  await expect(tour(page)).toHaveCount(0)
  return titles
}

test('build from scratch: offers itself on the Accounts step and walks six cards', async ({ page }) => {
  await toScratchAccounts(page)
  const titles = await walk(page, 'scratch')
  /* Six since 2026-10-08, when the account numbers card came out (Mahad). The
     "Where you are" card stays out. */
  // Guided setup's words, shared since 2026-10-08.
  expect(titles).toEqual(['The five categories', 'Summary and posting accounts', 'Add an account', 'Add an account above or below a row', 'Need help?', 'Publish your chart'])
  // The demo rows are gone once it closes.
  await expect(page.getByText('Accounts Receivable')).toHaveCount(0)
})

test('build from scratch: stands example accounts under Assets while a card points at rows', async ({ page }) => {
  await toScratchAccounts(page)
  await page.getByRole('button', { name: /Start (walkthrough|tour)/ }).click()
  await tour(page).getByRole('button', { name: 'Next' }).click()
  await expect(page.locator('tbody').getByText('Current Assets')).toBeVisible()
  await expect(page.locator('tbody').getByText('Accounts Receivable')).toBeVisible()
})

test('build from scratch: How it works carries publishing and the way back into the tour', async ({ page }) => {
  await toScratchAccounts(page)
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.getByRole('button', { name: 'How it works' }).click()
  const guide = page.getByRole('dialog', { name: 'Accounts' })
  await guide.getByRole('button', { name: 'What happens when I publish?' }).click()
  await expect(guide.getByText('Selecting Publish saves your accounts', { exact: false })).toBeVisible()
  await expect(page.getByText('6 short cards', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Take the walkthrough/ }).click()
  await expect(welcome(page)).toBeVisible()
})

/* Taken out on 2026-10-02 (Mahad) and asked back the same day in the design
   review - Eli: *"Why did I get that really nice overview and I don't get it on
   the guided setup?"* The chart tour runs on the chart guided setup built, and
   How it works carries the way back into it. */
test('guided setup: offers the walkthrough on Add your accounts too, and back from How it works', async ({ page }) => {
  await toGuidedAccounts(page)
  const titles = await walk(page)
  // Mahad's copy for this step, 2026-10-08.
  expect(titles).toEqual(['The five categories', 'Summary and posting accounts', 'Add an account', 'Add an account above or below a row', 'Need help?', 'Publish your chart'])
  await page.getByRole('button', { name: 'How it works' }).click()
  const guide = page.getByRole('dialog', { name: 'Accounts' })
  await expect(guide.getByText('How to add, organize, and publish the accounts in your chart.')).toBeVisible()
  await expect(guide.getByRole('button', { name: 'What happens when I publish?' })).toBeVisible()
  await page.getByRole('button', { name: /Take the walkthrough/ }).click()
  await expect(welcome(page)).toBeVisible()
})
