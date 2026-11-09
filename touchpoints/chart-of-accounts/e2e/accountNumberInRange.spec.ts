import { test, expect, type Page, type Locator } from '@playwright/test'

/* Mahad, 2026-09-23: *"Right now you can enter a GL account number outside the
   account's own range. That shouldn't be allowed. For summary accounts, the GL
   number should default to the first number in the range, with a tooltip
   explaining why. Decide between locking the GL number to the range start or
   letting people edit both and auto-correcting with a message. I'm fine either
   way, so just pick one. For posting accounts, suggest the next available number
   under the parent."*

   Locked rather than auto-corrected, because auto-correcting rewrites a field
   under the reader's hand - the fault the old number guess was removed for. The
   number stays fully editable through the range start.

   In a browser because none of it is a value the form holds. The number is read
   off the chart through whichever parent the picker points at, and the field is
   a padlocked box on one kind, an input with an offer under it on the other; the
   source says `accountNumber: ''` throughout. */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'Full view' }).last()
const field = (m: Locator, label: string) =>
  m.locator(`xpath=.//label[starts-with(normalize-space(.), "${label}")]/..`)
const number = (m: Locator) => field(m, 'GL account no.')

async function openDetails(page: Page, type: 'Posting' | 'Summary') {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Create GL account/ }).click()
  const m = modal(page)
  await m.getByRole('button', { name: /Continue/ }).first().click()
  await m.getByText('GL account details').first().waitFor()
  await field(m, 'GL account type').locator('button[aria-haspopup="listbox"]').click()
  await page.getByRole('option', { name: type, exact: true }).click()
  return m
}

async function pickParent(page: Page, m: Locator, code: string) {
  await field(m, 'Parent').locator('button[aria-haspopup="listbox"]').first().click()
  await page.getByRole('option', { name: new RegExp(code) }).first().click()
}

test.describe('a summary is numbered by the block it reserves', () => {
  test('states the range start rather than asking for a number', async ({ page }) => {
    const m = await openDetails(page, 'Summary')
    // Current Assets reserves 11000-11999 and its summaries hold 11100-11599, so
    // the block on offer starts at 11600 - and so, therefore, does the account.
    await pickParent(page, m, '11000')
    await expect(m.getByLabel('Range start')).toHaveValue('11600')
    await expect(number(m)).toContainText('11600')
    // Stated, not asked: there is no input in the field at all.
    await expect(number(m).locator('input')).toHaveCount(0)
  })

  test('follows the range start when the reader moves it', async ({ page }) => {
    const m = await openDetails(page, 'Summary')
    await pickParent(page, m, '11000')
    await m.getByLabel('Range start').fill('11610')
    await expect(number(m)).toContainText('11610')
  })

  test('asks for a number again once the range is cleared', async ({ page }) => {
    // With no block there is no first number for the field to be stating.
    const m = await openDetails(page, 'Summary')
    await pickParent(page, m, '11000')
    await expect(number(m).locator('input')).toHaveCount(0)
    await m.getByLabel('Range start').fill('')
    await expect(number(m).locator('input')).toHaveCount(1)
  })

  test('says why it is stated, so the reader knows where to change it', async ({ page }) => {
    const m = await openDetails(page, 'Summary')
    await pickParent(page, m, '11000')
    // The padlock in the box is where a settled field says why (see editRestrictions.spec.ts).
    await number(m).locator('div.input span.cursor-help').hover()
    await expect(page.getByText(/Change the start of the range to change it/)).toBeVisible()
  })

  test('leaves an existing summary on the number it was saved with', async ({ page }) => {
    /* The lock holds on a create only. A summary whose number sits somewhere
       else in its block is a fact about the customer's chart, and opening its
       edit form is no occasion to renumber it silently. */
    await page.goto('/chart-of-accounts/acct_11400', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /Edit account/i }).first().click()
    const m = modal(page)
    await m.getByLabel('Range start').fill('11405')
    await expect(number(m)).toContainText('11400')
  })
})

/* Mahad, 2026-09-24: *"Do not pre-populate with the account number. It should be
   an option below to select. Something like a suggestion that this is the next
   available account number."* The same arithmetic used to be written into the
   field; it now sits under it as something to take. */
const offer = (m: Locator) => m.getByText(/^Next recommended under/)

test.describe('the next number free under the parent', () => {
  test('is offered beneath the field rather than written into it', async ({ page }) => {
    /* Cash and Cash Equivalents steps its accounts in tens, 11110 to 11180 (the
       last an archived account, which still holds its number), so the next one
       along is 11190 - on the step the branch keeps, not the lowest free. */
    const m = await openDetails(page, 'Posting')
    await pickParent(page, m, '11100')
    await expect(offer(m)).toContainText('11100 Cash and Cash Equivalents')
    await expect(offer(m).getByRole('button')).toHaveText('11190')
    // The half Mahad objected to: a number in the box reads as one he entered.
    await expect(number(m).locator('input')).toHaveValue('')
  })

  test('goes into the field when it is taken, and then has nothing left to say', async ({ page }) => {
    const m = await openDetails(page, 'Posting')
    await pickParent(page, m, '11100')
    await offer(m).getByRole('button').click()
    await expect(number(m).locator('input')).toHaveValue('11190')
    // Printing 11190 a line under a field reading 11190 says it twice.
    await expect(offer(m)).toHaveCount(0)
  })

  test('re-reads when the parent moves, because the block it was free in changed', async ({ page }) => {
    const m = await openDetails(page, 'Posting')
    await pickParent(page, m, '11100')
    await expect(offer(m).getByRole('button')).toHaveText('11190')
    await pickParent(page, m, '11200')
    await expect(offer(m).getByRole('button')).toHaveText('11230')
    await expect(number(m).locator('input')).toHaveValue('')
  })

  test('stands beside a number the reader typed instead of replacing it', async ({ page }) => {
    /* What the pre-fill could not do. It stopped offering for good at the first
       keystroke, because anything else would have rewritten the field; an offer
       can keep standing there, ignored, while the reader keeps their own. */
    const m = await openDetails(page, 'Posting')
    await pickParent(page, m, '11100')
    await number(m).locator('input').fill('11142')
    await expect(offer(m).getByRole('button')).toHaveText('11190')
    await pickParent(page, m, '11200')
    await expect(number(m).locator('input')).toHaveValue('11142')
    await expect(offer(m).getByRole('button')).toHaveText('11230')
  })
})

/* Mahad, 2026-09-24: *"This wont be the case for summary accounts... Only
   account number suggestion will be for posting account."*

   A summary's number comes from the block it reserves, and the range card above
   the field is where that block is chosen - so an offer underneath the field is
   a second source competing for the same box, naming a number counted along the
   free line rather than the start of any block. The offer never showed on a
   summary holding a range, because the field is a padlocked box there and the
   offer lives in the other branch; what it did reach was the states where that
   lock is off. */
test.describe('a summary is offered no number', () => {
  test('even where its field has gone back to asking for one', async ({ page }) => {
    const m = await openDetails(page, 'Summary')
    await pickParent(page, m, '11000')
    await m.getByLabel('Range start').fill('')
    // Clearing the range returns a real input - the branch the offer sits in.
    await expect(number(m).locator('input')).toHaveCount(1)
    await expect(offer(m)).toHaveCount(0)
  })

  test('under a parent that offers one to a posting account', async ({ page }) => {
    // The kind decides it, not the parent: same parent, other kind, an offer.
    const m = await openDetails(page, 'Posting')
    await pickParent(page, m, '11000')
    await expect(offer(m)).toBeVisible()
  })
})

/* Design review, 2026-09-24: a reservation is a one-way block. It keeps every
   account that is not under the summary out of its block, and does not keep the
   summary's own accounts in. With number protection on (the default), an account
   still has to sit near its branch, or it would stretch the branch across
   somebody else's numbers. Every refusal names the account in the way in a gray
   pill. */
const refusal = (m: Locator) => m.locator('p.text-danger-600').first()
const pillIn = (m: Locator, name: string) => refusal(m).locator('span.rounded-md', { hasText: name })

test.describe('a number inside a block it does not belong to', () => {
  test('is refused, naming the summary that holds it, and holds the reader on the step', async ({ page }) => {
    const m = await openDetails(page, 'Posting')
    await pickParent(page, m, '11100')
    // 11250 sits in the block Short-Term Investments reserves.
    await number(m).locator('input').fill('11250')
    await expect(pillIn(m, 'Short-Term Investments')).toBeVisible()
    await expect(refusal(m)).toContainText('sets aside (11200–11299)')
    await m.getByRole('button', { name: /Continue/ }).first().click()
    await expect(m.getByText('GL account details').first()).toBeVisible()
  })

  test('keeps an account from another category out of a category block', async ({ page }) => {
    await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /Create GL account/ }).click()
    const m = modal(page)
    await m.getByRole('button', { name: /^Liability/ }).first().click()
    await m.getByRole('button', { name: /Continue/ }).first().click()
    await m.getByText('GL account details').first().waitFor()
    await field(m, 'GL account type').locator('button[aria-haspopup="listbox"]').click()
    await page.getByRole('option', { name: 'Posting', exact: true }).click()
    await pickParent(page, m, '21000')
    await number(m).locator('input').fill('11133')
    await expect(pillIn(m, 'Cash and Cash Equivalents')).toBeVisible()
  })
})

test.describe("a number outside its own parent's block", () => {
  test('is refused while protection is on, if it would stretch the branch across another', async ({ page }) => {
    const m = await openDetails(page, 'Posting')
    await pickParent(page, m, '11100')
    await number(m).locator('input').fill('11650')
    await expect(refusal(m)).toContainText('too far from the other accounts under')
    // Named twice in the sentence - the branch that would stretch, and its accounts.
    await expect(pillIn(m, 'Cash and Cash Equivalents').first()).toBeVisible()
    await expect(pillIn(m, 'Short-Term Investments')).toBeVisible()
  })

  /* The same number taken with protection off lives in
     importNumberProtection.spec.ts, the import being the only thing that turns
     protection off now that the settings page is gone. */

  test("names the summary's own block first, being the nearer one", async ({ page }) => {
    /* Two blocks can govern one number, and the inner one is the more specific
       thing to be told. Reaching it takes a saved summary with nothing filed
       under it yet: on a create the number *is* the range start and cannot fall
       outside the block it starts. */
    const m = await openDetails(page, 'Summary')
    await pickParent(page, m, '11000')
    await field(m, 'GL account name').locator('input').fill('Probe empty block')
    const create = m.getByRole('button', { name: 'Create account' })
    while (!(await create.isVisible())) await m.getByRole('button', { name: /Continue/ }).first().click()
    await create.click()

    await page.waitForTimeout(800)
    await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
    await page.getByPlaceholder('Search accounts').fill('Probe empty block')
    await page.locator('tbody tr', { hasText: 'Probe empty block' }).first().click()
    await page.getByRole('button', { name: /^Edit Account/ }).first().click()

    const e = modal(page)
    await expect(e.getByLabel('Range start')).toHaveValue('11600')
    await e.getByLabel('Range start').fill('11610')
    await expect(
      // Decision 84: the first number of the range (module review, COA-14).
      e.getByText(/A summary's number is the first number of the range it reserves\. Use 11610, or change the range\./),
    ).toBeVisible()
  })

  test('lets a lettered number opt out of every block rather than break one', async ({ page }) => {
    const m = await openDetails(page, 'Posting')
    await pickParent(page, m, '11100')
    await number(m).locator('input').fill('AR100')
    await expect(m.locator('p.text-danger-600')).toHaveCount(0)
  })
})
