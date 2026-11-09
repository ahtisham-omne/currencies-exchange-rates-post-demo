import { test, expect, type Page } from '@playwright/test'

/* Mahad, 2026-09-24: *"Bank setup loses bank name, title and type after
   saving."*

   Setup stages whole accounts and commits them at the end, and each commit
   wrote out by hand the fields it carried. That list was a second copy of
   `Account` kept by eye: of the bank block it named the routing and the account
   number, so a bank account reached the chart having dropped the three things
   the form had asked for and the reader had answered - the bank, the name on
   the account, and what kind of account it is. The number came through, which
   is why the account looked filled in rather than empty.

   Read at both ends: what the form was told, then what the published chart
   states back. The step between them is the only thing under test, so nothing
   here asserts on the staging table in the middle.

   Read off the page rather than the store: importing the store module inside
   `page.evaluate` builds a second instance of it, which rehydrates the same
   saved state and so answers plausibly while being unable to see the write the
   test just made. The card the reader would have been looking at is both the
   honest witness and the thing this was reported against. */

const BANK = { name: 'Bank of America', title: 'Omnesoft Operating', type: 'Savings', number: '12345678' }

const modalOf = (page: Page) => page.locator('body > div.fixed').last()

/* The scratch flow only exists for a tenant that has not set up yet, and the
   demo tenant has. The app's own "View as first-time user" is how that state is
   reached - the same door a reader uses. */
async function scratchSetup(page: Page) {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.locator('table tbody tr').first().waitFor()
  await page.getByRole('button', { name: /View as first-time user/ }).click()
  // The tenant is only reset once this is showing, and the setup route bounces
  // back to the chart until it is.
  await expect(page.getByText('Set up your chart of accounts')).toBeVisible()

  // Walked, not navigated to: a reload re-reads the saved tenant before the
  // reset has been written out, and the setup route bounces back to the chart.
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Start building' }).click()
  await expect(page.getByText('Set up your account numbers')).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByRole('button', { name: 'Add account' }).first()).toBeVisible()
  // The chart walkthrough offers itself on arriving here (2026-10-02); not this spec's subject.
  await page.getByRole('button', { name: 'Skip for now' }).click()
}

// A bank account built the way the form asks for one: category, then details,
// then the bank block.
async function addBankAccount(page: Page, accountName: string, accountNumber: string) {
  await page.getByRole('button', { name: 'Add account' }).first().click()
  const modal = modalOf(page)
  await modal.getByRole('button', { name: /^Asset What your business owns/ }).click()
  await modal.getByRole('button', { name: /^Current asset/ }).click()
  await modal.getByRole('button', { name: 'Continue' }).click()

  await modal.getByRole('button', { name: 'Select type' }).click()
  await page.locator('[role=option]:visible').filter({ hasText: 'Posting' }).first().click()
  // The form no longer picks a parent (Mahad, 2026-10-08); a fresh Asset has only itself.
  await modal.locator('xpath=.//label[starts-with(normalize-space(.), "Parent")]/..').locator('button[aria-haspopup="listbox"]').first().click()
  await page.getByRole('option', { name: /10000/ }).first().click()
  // The role is a dropdown; each option reads its name, then what it does.
  await modal.getByRole('button', { name: /Select a role/ }).click()
  await page.getByRole('option', { name: /^Bank Tracks/ }).click()
  await modal.getByPlaceholder('e.g. Office supplies').fill(accountName)
  await modal.getByPlaceholder('e.g. 10000').fill(accountNumber)
  await modal.getByRole('button', { name: 'Continue' }).click()

  // Bank name and account type are pickers behind a trigger, in that order.
  const triggers = modal.locator('button.input')
  await triggers.nth(0).click()
  await page.getByPlaceholder('Search banks…').fill(BANK.name)
  await page.locator('[role=listbox]').last().getByText(BANK.name, { exact: true }).first().click()
  await modal.getByPlaceholder('e.g. 4 to 17 digits').fill(BANK.number)
  await modal.getByPlaceholder('Name on the account').fill(BANK.title)
  await triggers.nth(1).click()
  await page.locator('[role=option]:visible').filter({ hasText: BANK.type }).first().click()

  // The step states all four back before it is left, so a field lost later was
  // held when the reader finished with it.
  await expect(triggers.nth(0)).toHaveText(new RegExp(BANK.name))
  await expect(triggers.nth(1)).toHaveText(new RegExp(BANK.type))
  await expect(modal.getByPlaceholder('e.g. 4 to 17 digits')).toHaveValue(BANK.number)
  await expect(modal.getByPlaceholder('Name on the account')).toHaveValue(BANK.title)

  await modal.getByRole('button', { name: 'Continue' }).click()
  await modal.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('cell', { name: accountName, exact: true })).toBeVisible()
}

test('a bank account reaches the published chart with the bank details it was built with', async ({ page }) => {
  await scratchSetup(page)
  await addBankAccount(page, 'Everyday Operating', '10100')

  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page).toHaveURL(/\/chart-of-accounts$/)

  /* The page's own copy of the store, not a fresh one. Once the dev server has
     reloaded a module it serves the store at a versioned URL, and importing the
     plain path gets a second, idle instance - one that rebuilds the seed and so
     reads plausibly while knowing nothing of what was just published. Reading
     the URL back off a module the page loaded keeps this on the real store. */
  const published = await page.evaluate(async () => {
    const source = await fetch('/src/pages/ChartOfAccounts.tsx').then(r => r.text())
    const url = source.match(/["'](\/src\/store\.ts(?:\?[^"']*)?)["']/)?.[1] ?? '/src/store.ts'
    const { useStore } = await import(/* @vite-ignore */ url)
    const a = useStore.getState().accounts.find((x: any) => x.accountName === 'Everyday Operating')
    return a && {
      bankName: a.bankName, bankAccountTitle: a.bankAccountTitle,
      bankAccountType: a.bankAccountType, bankAccountNumber: a.bankAccountNumber,
    }
  })
  expect(published, 'the account published at all').not.toBeNull()
  expect(published).toEqual({
    bankName: BANK.name,
    bankAccountTitle: BANK.title,
    bankAccountType: BANK.type,
    bankAccountNumber: BANK.number,
  })
})

test('the published account answers for itself as a set-up bank account', async ({ page }) => {
  await scratchSetup(page)
  await addBankAccount(page, 'Everyday Operating', '10100')
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page).toHaveURL(/\/chart-of-accounts$/)

  /* The chart flags a bank account still missing its details, and the detail
     page's bank card is drawn only for one that has a bank. Both read the same
     fields the publish drops, so an unfinished account is what the reader would
     actually have seen. */
  await page.getByPlaceholder('Search accounts').fill('Everyday Operating')
  const row = page.locator('tbody tr:has-text("Everyday Operating")').first()
  await expect(row).toBeVisible()
  await expect(row.getByRole('button', { name: 'Needs action' }), 'a published bank account is not unfinished').toHaveCount(0)

  await row.getByRole('button', { name: 'Everyday Operating', exact: true }).click()
  const card = page.locator('section, div').filter({ hasText: 'Bank account information' }).last()
  await expect(card).toContainText(BANK.name)
  await expect(card).toContainText(BANK.title)
  await expect(card).toContainText(BANK.type)
})
