import { test, expect, type Page } from '@playwright/test'

/* Design review, 2026-10-02, Build from scratch and Guided setup.

   - The first step gets an introduction of its own, on both paths.
   - How it works is a book now, and can be searched.
   - Guided setup's answers say what they add as a list, the method points to
     a long explanation, and None of these says what it cleared.
   - Every country is listed, and flags are pictures, so they draw on Windows.
   - A row added under a liability is not a contra account.
   - The "Finish setting up your modules" card is gone from the chart. */

async function firstTime(page: Page, path: 'Start building' | 'Start guided setup') {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.locator('table tbody tr').first().waitFor()
  await page.getByRole('button', { name: /View as first-time user/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: path }).click()
  await expect(page.getByText('Set up your account numbers')).toBeVisible()
}

const tour = (page: Page, name: string) => page.getByRole('dialog', { name })

async function walk(page: Page, name: string) {
  await page.getByRole('button', { name: /Start (walkthrough|tour)/ }).click()
  const titles: string[] = []
  for (let i = 0; i < 10; i++) {
    const card = tour(page, name)
    await expect(card).toBeVisible()
    await page.waitForTimeout(350)
    titles.push((await card.locator('h3, [data-card-title]').first().innerText().catch(() => '')).trim())
    const done = card.getByRole('button', { name: 'Done' })
    if (await done.count()) { await done.click(); break }
    await card.getByRole('button', { name: 'Next' }).click()
  }
  return titles
}

test('build from scratch opens on an introduction to account numbers', async ({ page }) => {
  await firstTime(page, 'Start building')
  // Mahad, 2026-10-08: the setup's name, and no line under it.
  await expect(page.getByText('Welcome to Build from Scratch')).toBeVisible()
  await expect(page.getByText('Set how long your account numbers are', { exact: false })).toHaveCount(0)
  const titles = await walk(page, 'Account numbers walkthrough')
  // Guided setup's words, shared since 2026-10-08.
  expect(titles).toEqual(['Default account number length', 'Number ranges by category', 'Change a range', 'Need help?'])
})

test('guided setup greets the setup as a whole, then introduces the questions', async ({ page }) => {
  await firstTime(page, 'Start guided setup')
  await expect(page.getByText('Welcome to guided setup')).toBeVisible()
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.getByRole('button', { name: 'Continue' }).last().click()
  await expect(page.getByText('Tell us about your business').last()).toBeVisible()
  const titles = await walk(page, 'Your business walkthrough')
  expect(titles).toEqual(['Tell us about your business', 'See what each answer adds', 'Your accounts so far', 'Need help?'])
})

// Mahad's copy, 2026-10-07: guided setup's account numbers tour in its own words,
// opened with Start tour.
test('guided setup walks its account numbers step in its own words', async ({ page }) => {
  await firstTime(page, 'Start guided setup')
  await expect(page.getByText('Welcome to guided setup')).toBeVisible()
  // No line under the greeting (Mahad, 2026-10-08).
  await expect(page.getByText("First, let's set your account numbers.")).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Start tour' })).toBeVisible()
  const titles = await walk(page, 'Account numbers walkthrough')
  expect(titles).toEqual(['Default account number length', 'Number ranges by category', 'Change a range', 'Need help?'])
})

test('How it works can be searched, and marks what it found', async ({ page }) => {
  await firstTime(page, 'Start building')
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.getByRole('button', { name: 'How it works' }).click()
  // Number length's own guide, tailored from Guided setup's (2026-10-08), read from the top.
  const guide = page.getByRole('dialog', { name: 'Number length' })
  await expect(guide.getByText('Build from scratch has 3 steps:')).toBeInViewport()
  await expect(guide.getByText('19 core accounts', { exact: false })).toHaveCount(0)
  const search = guide.getByLabel('Search this guide')
  await search.fill('debit')
  const shown = guide.locator('[data-section]:not([hidden])')
  await expect(shown).not.toHaveCount(0)
  await expect(guide.getByRole('button', { name: 'What are the five categories?' })).toBeVisible()
  // Every shown section holds the word, and a section without it is hidden.
  for (const text of await shown.allInnerTexts()) expect(text.toLowerCase()).toContain('debit')
  await expect(guide.getByRole('button', { name: 'How build from scratch works' })).toBeHidden()
  await search.fill('zzzz')
  await expect(guide.locator('[data-guide-no-match]')).toBeVisible()
  await guide.getByRole('button', { name: 'Clear search' }).click()
  await expect(guide.getByRole('button', { name: 'How build from scratch works' })).toBeVisible()
})

async function guidedQuestions(page: Page) {
  await firstTime(page, 'Start guided setup')
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.getByRole('button', { name: 'Continue' }).last().click()
  await page.getByRole('button', { name: 'Skip for now' }).click()
}

test('an answer lists the accounts it adds, not a paragraph', async ({ page }) => {
  await guidedQuestions(page)
  await page.getByLabel('What Manufacture products adds').hover()
  const card = page.locator('[data-answer-card]')
  await expect(card).toBeVisible()
  await expect(card).toContainText(/Adds \d+ accounts/)
  await expect(card).toContainText('Raw Materials')
  await expect(card).toContainText('Materials awaiting production')
  // Only the accounts: no closing paragraph (Mahad, 2026-10-07), and before
  // each a tile in its category's badge colours, not a bare dot.
  await expect(card).not.toContainText('what each product really costs to make')
  await expect(card.locator('li .rounded-full')).toHaveCount(0)
  await expect(card.locator('li [data-category-tile]')).toHaveCount(await card.locator('li').count())
  await expect(card.locator('[data-category-tile="AST"]').first()).toHaveClass(/bg-violet-50/)
  await expect(card.locator('[data-category-tile="EXP"]').first()).toHaveClass(/bg-rose-50/)
})

/* In a setup, How it works keeps its words, in the frame of the Full view
   beside it (Mahad, 2026-10-07: *"We need to have a full 'How it works' button
   in setups."*). */
test('a setup wizard says How it works in full, as tall as Full view', async ({ page }) => {
  await firstTime(page, 'Start guided setup')
  await page.getByRole('button', { name: 'Skip for now' }).click()
  const help = page.getByRole('button', { name: 'How it works' }).last()
  await expect(help).toHaveText('How it works')
  const h = (await help.boundingBox())!.height
  const f = (await page.getByRole('button', { name: 'Full view' }).last().boundingBox())!.height
  expect(Math.abs(h - f)).toBeLessThan(0.5)
})

/* Mahad's copy, 2026-10-08: Number length has a guide of its own, headed as
   the button that opens it, that reads from the top and names all four steps. */
test('number length opens its own guide, from the top', async ({ page }) => {
  await firstTime(page, 'Start guided setup')
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.getByRole('button', { name: 'How it works' }).last().click()
  const guide = page.getByRole('dialog', { name: 'Number length' })
  await expect(guide.getByText('How it works', { exact: true })).toBeVisible()
  await expect(guide.getByText('How account numbers and number ranges work in your chart.')).toBeVisible()
  await expect(guide.getByText('Guided setup has 4 steps:')).toBeInViewport()
  await expect(guide.getByText('Publish chart', { exact: true }).first()).toBeVisible()
  await expect(guide.getByText('The owners\' share of the business')).toHaveCount(1)
})

/* Mahad's copy, 2026-10-08: Your business has a guide of its own, read from
   the top, and the method's link lands on the method inside it. */
test('your business opens its own guide, from the top', async ({ page }) => {
  await guidedQuestions(page)
  await page.getByRole('button', { name: 'How it works' }).last().click()
  const guide = page.getByRole('dialog', { name: 'Your business' })
  await expect(guide.getByText('What each question means and the accounts it adds.')).toBeVisible()
  await expect(guide.getByText('How do my answers add accounts?')).toBeInViewport()
  await expect(guide.getByText('A few add the basic accounts every business needs', { exact: false })).toBeVisible()
})

test('the accounting method points to the long explanation', async ({ page }) => {
  await guidedQuestions(page)
  await page.getByRole('button', { name: /When to use each method/ }).click()
  const guide = page.getByRole('dialog', { name: 'Your business' })
  await expect(guide.getByRole('button', { name: 'Which accounting method does your business use?' })).toBeInViewport()
  await expect(guide.getByText('US tax requirements:', { exact: false })).toBeVisible()
  await expect(guide.getByText('some businesses, such as C corporations above an annual IRS sales threshold', { exact: false })).toBeVisible()
})

test('None of these says what it cleared, and gives it back', async ({ page }) => {
  await guidedQuestions(page)
  const pick = (name: RegExp) => page.getByRole('button', { name }).first().click()
  await pick(/^We own equipment/)
  await pick(/^We have loans/)
  await pick(/^None of these/)
  const note = page.locator('[data-cleared-note]')
  await expect(note).toContainText('None of these cleared the 2 answers you had picked.')
  await note.getByRole('button', { name: 'Undo' }).click()
  await expect(note).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^We own equipment/ }).first()).toHaveAttribute('aria-pressed', 'true')
})

test('lists every country, each with a picture of its flag', async ({ page }) => {
  await guidedQuestions(page)
  await page.getByText('Choose a country').click()
  await page.getByPlaceholder('Search countries…').fill('Uruguay')
  const option = page.getByRole('option', { name: /Uruguay/ })
  await expect(option).toBeVisible()
  await expect(option.locator('img[data-flag="uy"]')).toHaveCount(1)
})

test('a row added beside a liability opens as a liability, not a contra', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
  // Scrolled to first: the menu closes when the page scrolls under it.
  const kebab = page.getByRole('button', { name: 'Actions for Accounts Payable' }).first()
  await kebab.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await kebab.click()
  await page.getByRole('button', { name: 'Create account below' }).click()
  const form = page.locator('body > div.fixed').filter({ hasText: 'Full view' }).last()
  // Classification first, as every create opens (Mahad, 2026-10-09).
  await form.getByText('What kind of account is this?').first().waitFor()
  await form.getByRole('button', { name: /^Continue/ }).click()
  await form.getByText('GL account details').first().waitFor()
  const field = (label: string) => form.locator(`xpath=.//label[starts-with(normalize-space(.), "${label}")]/..`)
  await expect(field('Normal balance')).toContainText('Credit')
  await expect(form.getByText('Contra', { exact: true })).toHaveCount(0)
})

test('the chart no longer shows the Finish setting up your modules card', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
  await expect(page.getByText('Finish setting up your modules')).toHaveCount(0)
})
