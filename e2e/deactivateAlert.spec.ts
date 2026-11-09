import { test, expect, type Page, type Locator } from '@playwright/test'

/* Mahad, 2026-09-24: *"when we deactivate an active account, whether we do it
   from the status column or the actions column, we get a validation alert.
   However, when we do this same thing in the edit flow, we don't get anything,
   so it should appear in the edit flow as well ... Also, in the deactive alert,
   You can not deactivate a posting account with active transactions so please
   update this as well."*

   Two halves of one thing: the dialog says the whole of what deactivating means,
   and every way of asking for it raises the same dialog. The Status field on the
   edit form was the third way in and the only silent one - it shadows a menu
   action, so it cannot be the door that takes an account out of service without
   saying so.

   In a browser because neither half is a value anything holds. The dialog is
   built from a plan the form runs at Save, and "Cancel wrote nothing" is only
   true of a page you can go back and read. */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'Full view' }).last()

// No control in this form is tied to its label by `for`.
const field = (m: Locator, label: string) =>
  m.locator(`xpath=.//label[starts-with(normalize-space(.), "${label}")]/..`)
const picker = (f: Locator) => f.locator('button[aria-haspopup="listbox"]')

/* The dialog itself, told from the edit modal it can sit on top of. Matched by
   its own heading, because the two are the same kind of portalled box. */
const alert = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'Deactivate account?' }).last()

// The portalled menu panel: the box that has buttons in it. A tooltip raised by
// hovering the control lands in the same place and looks the same to a selector.
const menuPanel = (page: Page) =>
  page.locator('body > div.fixed').filter({ has: page.locator('button') }).last()

const EFFECT = /will stop accepting new postings\. It stays in your chart of accounts with its balance and history, and you can activate it again anytime\./
const RULE = /An account with work still on its way in cannot be deactivated until that work is posted, voided or closed\./

// 1035 Payroll - Chase Bank: the active posting account Mahad was looking at.
const ID = 'acct_11140'
const NAME = 'Payroll - Chase Bank'

async function editForm(page: Page) {
  await page.goto(`/chart-of-accounts/${ID}`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /^Edit Account/ }).first().click()
  const m = modal(page)
  await m.getByText('GL account details').first().waitFor()
  return m
}

async function setStatus(page: Page, m: Locator, status: string) {
  await picker(field(m, 'Status')).click()
  await page.getByRole('option', { name: status, exact: true }).click()
}

/* Save runs from the Review step, so an edit is clicked through to it rather
   than submitted from Details - the reader's own route as well. */
async function save(m: Locator) {
  const saveButton = m.getByRole('button', { name: /Save changes/ })
  for (let i = 0; i < 4 && !(await saveButton.count()); i++) {
    await m.getByRole('button', { name: /Continue/ }).first().click()
  }
  await saveButton.first().click()
}

/** The state the chart holds, read back off the account's own page rather than
 *  off the form that set it. The store coalesces writes on a 400ms trailing
 *  timer, which a navigation does not wait for. */
async function statusInChart(page: Page) {
  await page.waitForTimeout(800)
  await page.goto(`/chart-of-accounts/${ID}`, { waitUntil: 'networkidle' })
  return page.getByRole('button', { name: /^Status: / })
}

test.describe('what the alert says', () => {
  /* Module review, 2026-10-06 (COA-21): the dialog stated the pending-work rule
     to every account, telling each one it had work on its way in. An account
     reaching it has passed that gate, so the dialog says only the effect; the
     rule is said on the refusal, where it applies. */
  test('names the effect, and not the rule it has already passed, from the Actions menu', async ({ page }) => {
    await page.goto(`/chart-of-accounts/${ID}`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Account actions' }).click()
    await menuPanel(page).getByRole('button', { name: /^Deactivate/ }).first().click()

    const a = alert(page)
    await expect(a.getByText(EFFECT)).toBeVisible()
    await expect(a.getByText(RULE)).toHaveCount(0)
  })

  test('says the same thing from the status column', async ({ page }) => {
    await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
    await page.waitForSelector('thead th')
    const chip = page.locator('tbody tr', { hasText: NAME }).first()
      .locator('.rounded-full', { hasText: /^(Active|Inactive|Archived)$/ }).first()
    /* The Status column sits off to the right, so reaching the chip scrolls the
       table sideways - and `Menu` closes on any scroll, so the panel would open
       and vanish. Settle the scroll before the click, as a reader does. */
    await chip.scrollIntoViewIfNeeded()
    await page.waitForTimeout(200)
    await chip.click()
    await menuPanel(page).getByRole('button', { name: /^Deactivate/ }).first().click()

    await expect(alert(page).getByText(EFFECT)).toBeVisible()
    await expect(alert(page).getByText(RULE)).toHaveCount(0)
  })
})

test.describe('the edit form asks too', () => {
  test('raises the same alert when Save would turn the account off', async ({ page }) => {
    const m = await editForm(page)
    await setStatus(page, m, 'Inactive')
    await save(m)

    const a = alert(page)
    await expect(a.getByText(EFFECT)).toBeVisible()
    await expect(a.getByText(RULE)).toHaveCount(0)
  })

  test('asks at Save, not at the pick, because nothing is written until then', async ({ page }) => {
    const m = await editForm(page)
    await setStatus(page, m, 'Inactive')
    /* A dialog raised here would be confirming something that had not happened,
       and its Cancel would have to undo a field the reader had just set. */
    await expect(alert(page)).toHaveCount(0)
    await expect(field(m, 'Status')).toContainText('Inactive')
  })

  test('leaves the form standing and the account on when cancelled', async ({ page }) => {
    const m = await editForm(page)
    await setStatus(page, m, 'Inactive')
    await save(m)
    await alert(page).getByRole('button', { name: 'Cancel' }).click()

    // Still open, on the step it was pressed from, still holding the change.
    await expect(alert(page)).toHaveCount(0)
    await expect(modal(page)).toBeVisible()
    await expect(modal(page).locator('tr', { hasText: 'Status' })).toContainText(['Inactive'])

    // And the chart never heard about it.
    await expect(await statusInChart(page)).toHaveAttribute('aria-label', /^Status: Active\./)
  })

  test('writes the change once the alert is answered', async ({ page }) => {
    const m = await editForm(page)
    await setStatus(page, m, 'Inactive')
    await save(m)
    await alert(page).getByRole('button', { name: 'Deactivate account' }).click()

    await expect(modal(page)).toHaveCount(0)
    await expect(await statusInChart(page)).toHaveAttribute('aria-label', /^Status: Inactive\./)
  })

  /* And the door opens both ways without a dialog in it. Turning an account back
     on closes nothing and needs no explaining, so a confirmation there would ask
     the reader to agree to nothing - which is how a form teaches people to click
     through the one that matters. */
  test('saves an account back on without asking', async ({ page }) => {
    const first = await editForm(page)
    await setStatus(page, first, 'Inactive')
    await save(first)
    await alert(page).getByRole('button', { name: 'Deactivate account' }).click()
    await expect(modal(page)).toHaveCount(0)

    /* Reopening the form reloads the page, and the store's 400ms trailing write
       does not survive one. A form built from the chart as it was would see
       Active already and offer nothing to save. */
    await page.waitForTimeout(800)
    const m = await editForm(page)
    await setStatus(page, m, 'Active')
    await save(m)
    await expect(modal(page)).toHaveCount(0)
    await expect(await statusInChart(page)).toHaveAttribute('aria-label', /^Status: Active\./)
  })
})
