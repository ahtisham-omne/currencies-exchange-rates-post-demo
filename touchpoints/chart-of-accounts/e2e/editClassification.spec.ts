import { test, expect, type Page, type Locator } from '@playwright/test'

/* The two questions a create opens with - which category, and which line of the
   statement - and what becomes of them when the answers are already settled.

   They used to open an edit too, on a step of their own, under a four-line amber
   warning, and answered in two different shapes: the category as cards, dimmed
   and ticked, the classification as a disabled input with a padlock. Mahad:
   *"This screen too bloted because of the warning message above. Also, for the
   classification, I dont think there should be a locked input field. It should
   be locked as it was during the creation flow (i.e. a card)"*. The banner went
   and both became cards.

   The step itself has since gone from the edit - 2026-09-22, *"rename the first
   step simply to 'Details'"* - and the two questions moved down onto Details,
   where a settled one takes the shape every other settled field there takes: the
   value, greyed, with a padlock. That is not the locked input the complaint was
   about. What Mahad rejected was one field answering differently from its
   neighbours on a step of dimmed cards; what is there now is one field answering
   the same way as every neighbour it has.

   So the card-shaped lock still exists, and this pins where: a create opened
   from a summary, which answers both questions before the reader arrives. */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'Full view' }).last()

/* The cards for one question, found through the heading above them: the h3, out
   to the block that holds it and its explanation, then the grid that follows.
   Located by structure because the category cards and these are the same
   control, and so cannot be told apart by anything on the buttons. */
const cards = (m: Locator, heading: string) =>
  m.locator(`xpath=.//h3[text()="${heading}"]/../following-sibling::div[1]`)
    .locator('button[aria-pressed]')

const field = (m: Locator, label: string) =>
  m.locator(`xpath=.//label[starts-with(normalize-space(.), "${label}")]/..`)

async function edit(page: Page, id = 'acct_11130') {
  await page.goto(`/chart-of-accounts/${id}`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /^Edit Account/ }).first().click()
  const m = modal(page)
  await m.getByText('GL account details').first().waitFor()
  return m
}

test.describe('editing an account cannot change its classification', () => {
  /* The step is gone, and so is everything that stood on it to explain itself.
     Mahad, 2026-09-22: locked fields are *"grayed out / read-only ... rather
     than hidden or replaced with custom text"* - a grid of dimmed cards under a
     sentence apologising for them is custom text with extra height. */
  test('asks it on no step of its own, and explains itself nowhere', async ({ page }) => {
    const m = await edit(page)
    await expect(m.getByText('What kind of account is this?')).toHaveCount(0)
    await expect(m.getByText(/The category is set when the account is created/)).toHaveCount(0)
    // The amber block, by the tone that made it shout rather than by its copy.
    await expect(m.locator('.bg-warning-50')).toHaveCount(0)
  })

  /* Both questions, in the one shape the rest of the step answers in. Read by
     the absence of a trigger rather than by the text, because a box holding the
     right value while taking a click is exactly the failure. */
  test('states both answers the way every other settled field on the step does', async ({ page }) => {
    const m = await edit(page)
    for (const label of ['GL account category', 'Statement classification']) {
      await expect(field(m, label).locator('button[aria-haspopup="listbox"]')).toHaveCount(0)
      await expect(field(m, label).locator('div.input')).not.toBeEmpty()
    }
    await expect(field(m, 'Statement classification').locator('div.input')).toHaveText('Current asset')
  })

  /* Creating is untouched: the same cards, live. Guards the change against
     being made by locking the step for everyone. */
  test('leaves the create flow choosing freely', async ({ page }) => {
    await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
    await page.waitForSelector('thead th')
    await page.getByRole('button', { name: /Create GL account/ }).click()
    const m = modal(page)
    await m.getByText('What kind of account is this?').first().waitFor()
    const cs = cards(m, 'Statement classification')
    expect(await cs.count()).toBeGreaterThan(1)
    for (const c of await cs.all()) await expect(c).toBeEnabled()
    await expect(m.getByRole('button', { name: /^Liability/ }).first()).toBeEnabled()
  })
})

/* Where the card-shaped lock still lives. A create started from a summary is
   filed inside it before the reader sees the step, and everything inside a
   summary is in that summary's total - so both questions arrive answered. The
   flow opens on Details because there is nothing on the step before it to
   decide, but the step is still there, still reachable, and still shows its
   answers as dimmed cards rather than dropping them. */
test.describe('a create started from a summary', () => {
  async function fromSummary(page: Page) {
    await page.goto('/chart-of-accounts/acct_11200', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Account actions' }).click()
    await page.getByText('Create GL account', { exact: true }).click()
    const m = modal(page)
    // Opened on, not stepped past: every create starts on Classification
    // (Mahad, 2026-10-09).
    await m.getByText('What kind of account is this?').first().waitFor()
    return m
  }

  /* Decision 3: the category is the parent's, and the classification starts as
     the parent's but can be overridden, which the chart flags (module review,
     2026-10-06, COA-13). So the category cards are locked and the
     classification cards are open, starting on the summary's. */
  test('locks the category to the summary, and opens the classification on its line', async ({ page }) => {
    const m = await fromSummary(page)
    const cs = cards(m, 'Statement classification')
    expect(await cs.count()).toBeGreaterThan(1)
    for (const c of await cs.all()) await expect(c).toBeEnabled()
    await expect(cs.and(m.locator('[aria-pressed="true"]'))).toHaveCount(1)
    // The category cards above it are locked the same way.
    await expect(m.getByRole('button', { name: /^Asset/ }).first()).toBeDisabled()
    await expect(m.getByRole('button', { name: /^Liability/ }).first()).toBeDisabled()
  })

  test('shows which line it will print on, and which it will not', async ({ page }) => {
    const m = await fromSummary(page)
    const cs = cards(m, 'Statement classification')
    // Anchored: "Non-current asset" contains "current asset", and an unanchored
    // filter matched both cards and resolved to neither.
    await expect(cs.filter({ hasText: /^Current asset/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(cs.filter({ hasText: /^Non-current asset/ })).toHaveAttribute('aria-pressed', 'false')
  })
})
