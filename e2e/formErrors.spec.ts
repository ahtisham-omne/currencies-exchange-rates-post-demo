import { test, expect, type Page, type Locator } from '@playwright/test'

/* When a validation message goes away. Mahad, 2026-09-24, on a create form
   holding a type, a parent, a name and a number with all four still flagged:
   *"I did enter all the details... Why isn't the error states going away? I
   think this needs to be fixed..."*

   Errors were written only at the gates - Continue, Save, Create - so each
   message was a photograph of the moment one was pressed and stayed under its
   field however the form changed afterwards. A fully answered form went on
   reading as four failures, which leaves a reader nothing to tell the
   complaints they have dealt with from the ones they have not.

   In a browser because none of it is a value the form holds: the messages are
   in the markup before and after, and what changed is when they leave. */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'Full view' }).last()
const field = (m: Locator, label: string) =>
  m.locator(`xpath=.//label[starts-with(normalize-space(.), "${label}")]/..`)

const MESSAGES = /^(Select a GL account type\.|Pick a parent\.|Enter a GL account name\.|Enter a GL account number\.)$/
const complaints = (m: Locator) => m.getByText(MESSAGES)

async function openDetails(page: Page) {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Create GL account/ }).click()
  const m = modal(page)
  await m.getByRole('button', { name: /Continue/ }).first().click()
  await m.getByText('GL account details').first().waitFor()
  return m
}

const cont = (m: Locator) => m.getByRole('button', { name: /Continue/ }).first().click()

test('each message goes as its own field is answered', async ({ page }) => {
  const m = await openDetails(page)
  await cont(m)

  // The gate speaks for the fields left empty. Named rather than counted: which
  // fields it asks for depends on what the picker above them offers.
  await expect(m.locator('p').filter({ hasText: 'Select a GL account type.' })).toBeVisible()
  await expect(m.locator('p').filter({ hasText: 'Enter a GL account name.' })).toBeVisible()
  await expect(m.locator('p').filter({ hasText: 'Enter a GL account number.' })).toBeVisible()
  // And the summary above lists them, with the count (decision 120, COA-28).
  await expect(m.locator('[data-step-summary]')).toContainText(/\d+ issues/)
  await expect(m.locator('[data-step-summary]')).toContainText('Enter a GL account number.')

  await field(m, 'GL account type').locator('button[aria-haspopup="listbox"]').click()
  await page.getByRole('option', { name: 'Posting', exact: true }).click()
  await expect(m.locator('p').filter({ hasText: 'Select a GL account type.' })).toHaveCount(0)
  // And only its own: answering one field says nothing about the others.
  await expect(m.locator('p').filter({ hasText: 'Enter a GL account name.' })).toBeVisible()
  await expect(m.locator('p').filter({ hasText: 'Enter a GL account number.' })).toBeVisible()

  await field(m, 'GL account name').locator('input').fill('Hehe')
  await expect(m.locator('p').filter({ hasText: 'Enter a GL account name.' })).toHaveCount(0)

  // No parent is picked for the reader (Mahad, 2026-10-08), so it is asked
  // for like any other field, and goes once answered.
  await cont(m)
  await expect(m.locator('p').filter({ hasText: 'Pick a parent.' })).toBeVisible()
  await field(m, 'Parent').locator('button[aria-haspopup="listbox"]').first().click()
  await page.getByRole('option', { name: /10000/ }).first().click()
  await expect(m.locator('p').filter({ hasText: 'Pick a parent.' })).toHaveCount(0)

  await field(m, 'GL account no.').locator('input').fill('1001')
  await expect(complaints(m)).toHaveCount(0)
})

test('nothing is asked of a form nobody has pressed a gate on', async ({ page }) => {
  /* The other half of the fix: it only ever removes. Typing a name must not
     raise a fresh complaint about a number not reached yet - when to start
     asking is the gate's decision, and the prune runs on every keystroke. */
  const m = await openDetails(page)
  await field(m, 'GL account name').locator('input').fill('Hehe')
  await expect(complaints(m)).toHaveCount(0)
})

test('an answered field still does not let an unanswered one through', async ({ page }) => {
  // Clearing a spent message is not the same as dropping the requirement.
  const m = await openDetails(page)
  await cont(m)
  await field(m, 'GL account name').locator('input').fill('Hehe')
  await expect(m.locator('p').filter({ hasText: 'Enter a GL account name.' })).toHaveCount(0)

  await cont(m)
  await expect(m.locator('p').filter({ hasText: 'Enter a GL account number.' })).toBeVisible()
  await expect(m.getByText('GL account details').first()).toBeVisible()
})
