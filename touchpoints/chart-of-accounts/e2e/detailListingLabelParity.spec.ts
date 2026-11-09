import { test, expect, type Page, type Locator } from '@playwright/test'

/* The detail page names a fact the way the listing's column names it.

   Mahad: *"The information in the details page of the accounts should match the
   listing page columns. E.g. arrived as should be renamed to prior account
   number."*

   Two ways a rail can fail that, and both were live:

     a *different name* for the same fact - "Arrived as" for Prior account
     number, "Base currency" for Currency - which reads as a second fact and
     leaves a reader unable to tell they have already seen it; and

     a *missing* one - the summary rail stated neither the statement
     classification nor the normal balance, both of which the listing ships as
     columns that are on by default, so the one page that could not say which
     side a total grows on was the totals page.

   The two rails are separate components (`OverviewTab` for a posting account,
   `RollupOverview` for a summary, chosen by `templateOf`), which is how they
   drifted apart in the first place, so both are read here.

   Against the running page rather than the source: a label is only shared if a
   reader sees the same words, and half the claim is a negative - a source test
   cannot tell a string that was renamed from one still rendered by the other
   template. The listing labels are the literals from `HEADER_DEFS`; the unit
   test in `src/components/accountProvenance.test.ts` is what ties the provenance
   one back to that constant so a rename there cannot leave this behind. */

// Labels a rail is allowed to carry that no column answers: they are facts about
// the record's history and its place in the chart, not about the account as the
// listing tabulates it.
const RAIL_ONLY = new Set([
  'Parent', 'Created on', 'Created by', 'Last updated', 'Last updated by', 'Why included',
  // The bank card, which is a whole card the listing has no columns for.
  'Setup', 'Nickname', 'Bank name', 'Account title', 'Bank account number', 'Routing number',
  // What the setup form calls the type, which is the card's word on a card.
  'Bank account type', 'Card type',
])

// Every column label the chart offers, whether or not it ships on.
const COLUMN_LABELS = ([
  'GL account name', 'GL account no.', 'Number range', 'GL account category',
  'Statement classification', 'GL account type', 'Account role', 'Normal balance',
  'Posting', 'Currency', 'Opening balance', 'Running balance', 'Foreign balance',
  'Status', 'Description', 'Dimensions', 'Effective', 'Internal ID', 'Prior account number', 'Imported', 'Restricted',
]) as string[]

async function detail(page: Page, id: string) {
  await page.goto(`/chart-of-accounts/${id}`, { waitUntil: 'networkidle' })
  await page.getByText('GL account information').first().waitFor()
}

/* The rail's field labels. `DashInfoLabel` is the only thing on the page drawing
   a 10px slate-400 paragraph, so the shape is the selector - none of these are
   tied to their value by `for`, and several are headings rather than labels. */
const railLabels = async (page: Page): Promise<string[]> => {
  const rail = page.locator('div').filter({ has: page.getByText('GL account information') }).last()
  return (await rail.locator('p[class*="text-[10px]"][class*="text-slate-400"]').allTextContents())
    .map(t => t.trim()).filter(Boolean)
}

for (const [id, kind] of [['acct_11130', 'a posting account'], ['acct_11200', 'a summary']] as const) {
  test(`every field ${kind}'s rail names is named that on the listing`, async ({ page }) => {
    await detail(page, id)
    const labels = await railLabels(page)
    // Or the selector has stopped matching and every assertion below is vacuous.
    expect(labels.length).toBeGreaterThan(5)
    for (const label of labels) {
      if (RAIL_ONLY.has(label)) continue
      expect(COLUMN_LABELS, `"${label}" is on the rail but is no column's name`).toContain(label)
    }
  })
}

/* The two renames, each on the template that carried the wrong word. Asserted by
   name rather than through the sweep above, because the sweep would also pass a
   rail that had dropped the field entirely. */
test.describe('the fields that were named twice', () => {
  test('calls an imported account’s old number what the column calls it', async ({ page }) => {
    // acct_11130 came in as 1020-00, so the sub-label and its pill both render.
    await detail(page, 'acct_11130')
    await expect(page.getByText('Prior account number', { exact: true })).toBeVisible()
    await expect(page.getByText('1020-00', { exact: true })).toBeVisible()
    await expect(page.getByText('Arrived as', { exact: false })).toHaveCount(0)
  })

  /* acct_11300 is a summary a file states once per entity, and it used to stack
     every old header it answers for. Mahad, 2026-09-22: *"prior account number is
     always one number that was imported."* Singular here too, and no branch left
     that could make it plural again. */
  test('says number, singular, for a summary several rows folded into', async ({ page }) => {
    await detail(page, 'acct_11300')
    await expect(page.getByText('Prior account number', { exact: true })).toBeVisible()
    await expect(page.getByText('Prior account numbers', { exact: true })).toHaveCount(0)
    await expect(page.getByText('1200', { exact: true })).toBeVisible()
    await expect(page.getByText('1210', { exact: true })).toHaveCount(0)
  })

  /* "Base currency" is the company's reporting currency, which is a real thing
     and is stated on the Setup page. The summary rail was using the phrase for
     the account's own currency, which may not be the base one at all. */
  test('calls the account’s currency Currency, on the summary rail too', async ({ page }) => {
    await detail(page, 'acct_11200')
    await expect(page.getByText('Currency', { exact: true })).toBeVisible()
    await expect(page.getByText('Base currency', { exact: false })).toHaveCount(0)
  })
})

/* The two columns the summary rail did not answer at all. Both ship on, so a
   reader arriving from the listing has already seen them for this account. */
test.describe('what the summary rail was missing', () => {
  test('states the statement classification it prints on', async ({ page }) => {
    await detail(page, 'acct_11200')
    await expect(page.getByText('Statement classification', { exact: true })).toBeVisible()
    await expect(page.getByText('Current asset', { exact: true }).first()).toBeVisible()
  })

  test('states the side its total grows on', async ({ page }) => {
    await detail(page, 'acct_11200')
    await expect(page.getByText('Normal balance', { exact: true })).toBeVisible()
    await expect(page.getByText('Debit', { exact: true }).first()).toBeVisible()
  })

})

/* The five category accounts carry neither the header's category pill nor a
   Statement classification row. Mahad, 2026-09-30: *"Remove these pills and this
   but only from the 5 category accounts only."* A category spans both sides of
   the current line, so it has no one classification; and with no parent to name,
   the header pill fell back to the category, which the rail's GL account
   category already states. That field stays. */
const CATEGORIES = [
  ['acct_10000', 'Asset'], ['acct_20000', 'Liability'], ['acct_30000', 'Equity'],
  ['acct_40000', 'Revenue'], ['acct_50000', 'Expense'],
] as const
// The row the name sits in: number, name, then the badges.
const headerBadges = (page: Page) => page.locator('h1').first().locator('xpath=..')

test.describe('a category account', () => {
  for (const [id, label] of CATEGORIES) {
    test(`${label}: no category pill in the header, no Statement classification`, async ({ page }) => {
      await detail(page, id)
      await expect(headerBadges(page).getByText('Summary', { exact: true })).toBeVisible()
      await expect(headerBadges(page).getByText(label, { exact: true })).toHaveCount(0)
      await expect(page.getByText('Statement classification', { exact: true })).toHaveCount(0)
      await expect(page.getByText(/^Spans /)).toHaveCount(0)
      // Still said once, in the rail.
      await expect(page.getByText('GL account category', { exact: true })).toBeVisible()
    })
  }

  // Only those five: a summary under one keeps both.
  test('leaves both on a summary under a category', async ({ page }) => {
    await detail(page, 'acct_11000')
    await expect(headerBadges(page).getByText('Asset', { exact: true })).toBeVisible()
    await expect(page.getByText('Statement classification', { exact: true })).toBeVisible()
    await expect(page.getByText('Current asset', { exact: true }).first()).toBeVisible()
  })
})
