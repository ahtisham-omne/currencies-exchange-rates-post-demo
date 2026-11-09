import { test, expect, type Page, type Locator } from '@playwright/test'

/* The create form answers the account number only where the chart can answer it,
   and asks otherwise.

   It used to arrive filled in: the category's highest number plus ten, so every
   new asset opened on 1370 whatever the reader was making and wherever they were
   filing it. Mahad: *"I am not exactly sure why it is doing this ... I think we
   shouldn't pre-populate it at all. We can just leave the field blank and let
   the user enter the number manually themselves."* Two things went: the number
   the form opened with, and the effect that rewrote it whenever the category,
   type or parent changed.

   What the guess lacked was a reservation to be the next number in - the version
   he said would have made sense - and summaries now carry one. So a suggestion
   came back on 2026-09-23, *"For posting accounts, suggest the next available
   number under the parent"*, read off a block that exists rather than off a
   category's high-water mark. It sits under the field rather than in it (Mahad
   again, 2026-09-24: *"Do not pre-populate with the account number. It should be
   an option below to select"*), so the box is empty even where the chart has
   plenty to say; that half lives in `accountNumberInRange.spec.ts`.

   What this file holds is the other half: where the chart has nothing to say,
   the form says nothing at all, not even an offer. No type chosen yet, or a
   parent reserving no block - and the field is empty, with an example for a
   placeholder. Pinned against the running page because the claim is about what a
   reader finds in a field, and because an empty field is only right if an empty
   one is also refused - a form that opens empty and saves empty is worse than
   the guess. */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'Full view' }).last()

// Found through the label: no control in this form is tied to its label by `for`.
const field = (m: Locator, label: string) =>
  m.locator(`xpath=.//label[starts-with(normalize-space(.), "${label}")]/..`)

const numberField = (m: Locator) => field(m, 'GL account no.')
const numberInput = (m: Locator) => numberField(m).locator('input')

async function listing(page: Page) {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
}

/* The details step, reached from the classification step the form opens on.
   Waited for by the section only it has, so an assertion cannot read the step
   before. */
async function details(page: Page, m: Locator) {
  await m.getByRole('button', { name: /Continue/ }).first().click()
  await m.getByText('GL account details').first().waitFor()
  return m
}

async function openCreate(page: Page) {
  await listing(page)
  await page.getByRole('button', { name: /Create GL account/ }).click()
  return details(page, modal(page))
}

test.describe('creating an account', () => {
  test('offers an empty number, and an example of one', async ({ page }) => {
    const m = await openCreate(page)
    await expect(numberInput(m)).toHaveValue('')
    /* The placeholder is an example and has to read as one: it is the only thing
       in the box now, and a bare "10000" sitting there is the pre-populated number
       again as far as a reader is concerned. Every other field in this form says
       "e.g." too. */
    await expect(numberInput(m)).toHaveAttribute('placeholder', /^e\.g\. /)
  })

  /* The effect that rewrote the field on every category, type and parent change.
     It wrote whenever the field still held the last thing it had written, so a
     reader who had not yet typed watched the number change under them. */
  test('leaves it empty when the category changes', async ({ page }) => {
    await listing(page)
    await page.getByRole('button', { name: /Create GL account/ }).click()
    const m = modal(page)
    await m.getByText('What kind of account is this?').first().waitFor()
    await m.getByRole('button', { name: /^Liability/ }).first().click()
    await details(page, m)

    await expect(numberInput(m)).toHaveValue('')
    // The example follows the category, which is the whole of what the form now
    // offers about numbering.
    await expect(numberInput(m)).toHaveAttribute('placeholder', 'e.g. 20000')
  })

  /* The other half of the same effect: it also overwrote a number that had been
     typed, whenever the typed one happened to match what it last suggested.

     The type change is waited on by the field only a Summary has, not merely
     issued. A rewrite lands a tick after the change, so asserting straight after
     the click reads the number the reader typed and passes whether or not
     anything is about to overwrite it - which is what this test did until a
     deliberate regression sailed through it. */
  test('keeps the number the reader typed', async ({ page }) => {
    const m = await openCreate(page)
    await numberInput(m).fill('AST-01')
    await field(m, 'GL account type').locator('button[aria-haspopup="listbox"]').click()
    await page.getByRole('option', { name: 'Summary', exact: true }).click()
    await m.getByText('Number range').first().waitFor()
    await expect(numberInput(m)).toHaveValue('AST-01')
  })

  /* A second door into the same form, because "empty" is a property of the form
     and not of the button that opened it. Nothing is read here because nothing
     has been said yet about what kind of account this is, and a block is only
     worth reading once there is something to put in it. */
  test('offers an empty number from Create GL account too', async ({ page }) => {
    await page.goto('/chart-of-accounts/acct_11200', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Account actions' }).click()
    await page.locator('body > div.fixed').filter({ has: page.locator('button') }).last()
      .getByRole('button', { name: /Create GL account/ }).click()
    const m = await details(page, modal(page))
    await expect(numberInput(m)).toHaveValue('')
  })

  /* A parent that reserves no block still has its own accounts to count along -
     Long-Term Debt holds 22110, 22120, 22130 without a range, and number
     protection keeps that run for it (design review, 2026-09-24) - so the next one
     is offered beneath the field. Offered, never written in: the field stays
     empty until the reader takes it. */
  test('offers the next number along a parent that reserves no block, without writing it in', async ({ page }) => {
    const m = await openCreate(page)
    await m.getByRole('button', { name: /^Back/ }).click()
    await m.getByRole('button', { name: /^Liability/ }).first().click()
    await details(page, m)
    await field(m, 'GL account type').locator('button[aria-haspopup="listbox"]').click()
    await page.getByRole('option', { name: 'Posting', exact: true }).click()
    await field(m, 'Parent').locator('button[aria-haspopup="listbox"]').first().click()
    await page.getByRole('option', { name: /22100/ }).first().click()
    await expect(numberInput(m)).toHaveValue('')
    await expect(m.getByText(/^Next recommended under 22100 Long-Term Debt/)).toBeVisible()
    await expect(m.getByRole('button', { name: '22140', exact: true })).toBeVisible()
  })

  // Empty is what those cases leave behind, so empty has to be refused on the way
  // out or the form would create numberless accounts.
  test('refuses to move on without one', async ({ page }) => {
    const m = await openCreate(page)
    await field(m, 'GL account type').locator('button[aria-haspopup="listbox"]').click()
    await page.getByRole('option', { name: 'Posting', exact: true }).click()
    await field(m, 'GL account name').locator('input').fill('Probe account')
    // Cleared by hand, which is the state a reader can always reach whether or
    // not the parent had a block to read.
    await numberInput(m).fill('')
    await m.getByRole('button', { name: /Continue/ }).first().click()

    await expect(m.locator('p').filter({ hasText: 'Enter a GL account number.' })).toBeVisible()
    await expect(m.getByText('GL account details').first()).toBeVisible()
  })
})

/* The discard prompt reads the number to decide whether there is work to lose.
   It used to compare against the suggestion; with nothing suggested it compares
   against empty, and both halves are asserted because "never prompt" and "always
   prompt" each satisfy one of them. */
test.describe('closing a create nobody has typed in', () => {
  const discard = (page: Page) => page.getByText(/Discard/)

  test('closes without asking', async ({ page }) => {
    const m = await openCreate(page)
    await m.getByRole('button', { name: 'Cancel' }).click()
    await expect(discard(page)).toHaveCount(0)
  })

  test('asks once a number has been typed', async ({ page }) => {
    const m = await openCreate(page)
    await numberInput(m).fill('1375')
    await m.getByRole('button', { name: 'Cancel' }).click()
    await expect(discard(page).first()).toBeVisible()
  })
})

/* And editing still shows the account its own number: the field was emptied for
   the create flow, not emptied outright. Read off the locked box rather than an
   input, because an edit no longer offers one - see `editRestrictions.spec.ts` -
   and a lock that swallowed the value would leave the reader unable to quote the
   number of the account they are looking at. */
test('editing an account still shows the number it has', async ({ page }) => {
  await page.goto('/chart-of-accounts/acct_11130', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /^Edit Account/ }).first().click()
  // No Continue on the way in: an edit opens on Details, where a create has a
  // classification step to clear first.
  const m = modal(page)
  await m.getByText('GL account details').first().waitFor()
  await expect(numberField(m)).toContainText('11130')
})
