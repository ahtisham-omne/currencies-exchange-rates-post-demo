import { test, expect, type Page } from '@playwright/test'

/* The detail page states the account. It does not explain the chart.

   Mahad, 2026-09-10: *"I think again too many UX copies in the details pages. We
   can remove system information since we don't need it now and default
   dimensions should just show dimensions for this account. Show empty state if
   the account doesn't have any."*

   The cut is by what a line does, not by how long it is. A line that *describes*
   a value the reader is already looking at ("Current asset: turns into cash
   within a year", "Tracks the value of inventory on hand") is gone from the page
   and lives in the field's tooltip, where it was already offered on the listing.
   A line that states a *restriction* stays, because it is the answer to the
   question that brought the reader here: why the journal entry picker refuses
   this account. So the control-account lock and its escape link survive the pass.

   Run against the page rather than the source because the claim is about what a
   reader finds, and because half of it is a negative - a source-text test cannot
   tell a string that was deleted from one that moved into a tooltip and is now
   sitting in the DOM. */

const RAIL_PROSE_REMOVED = [
  // Described the Statement classification value printed directly above it.
  'within the operating cycle',
  // Described the Account role badge printed directly above it.
  'Tracks the value of inventory on hand',
  // Said in words what the padlocked-in-the-edit-form rule already says.
  'set by the role',
  // Both explained the Normal balance value rather than stating it.
  'carries the opposite side to its category',
  'Positive figures on this page move toward',
  // Explained the "Connected" chip beside it.
  'Bank feed is connected',
  // Explained the Default dimensions feature to a reader already reading it.
  'Postings start with these',
  'Nothing is pre-set',
  // Explained how an import infers a parent, under an Imported: Yes.
  'The file named the accounts under this one',
]

async function detail(page: Page, id: string) {
  await page.goto(`/chart-of-accounts/${id}`, { waitUntil: 'networkidle' })
  await page.getByText('GL account information').first().waitFor()
}

test.describe('the account detail rail', () => {
  /* Every removed line at once, on the account Mahad screenshotted. Asserting
     them one per test would pass a page that had regrown any single one of them
     while the suite still read green overall. */
  test('states the account without explaining the fields', async ({ page }) => {
    await detail(page, 'acct_11120')
    for (const prose of RAIL_PROSE_REMOVED) {
      await expect(page.getByText(prose, { exact: false })).toHaveCount(0)
    }
  })

  /* The values themselves are the point of the card, so their removal has to
     fail this test too - a rail stripped of its fields would satisfy every
     negative above. */
  test('still states the values the prose described', async ({ page }) => {
    await detail(page, 'acct_11120')
    await expect(page.getByText('Statement classification')).toBeVisible()
    await expect(page.getByText('Current asset', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Normal balance')).toBeVisible()
  })

  /* The internal ID came back on 2026-09-24 (design review: *"put it at the
     bottom in a bottom card, something out of the way"*), but as one field in
     the rail's bottom block, not as the card that was cut. */
  test('has no System information card, on either template', async ({ page }) => {
    // Posting template.
    await detail(page, 'acct_11120')
    await expect(page.getByText('System information')).toHaveCount(0)
    await expect(page.getByText('Internal ID', { exact: true })).toHaveCount(1)
    // Summary template, which had its own copy of the card.
    await detail(page, 'acct_11200')
    await expect(page.getByText('System information')).toHaveCount(0)
    await expect(page.getByText('Internal ID', { exact: true })).toHaveCount(1)
  })

  /* The restriction copy, which is the half that stayed. Read on a control
     account, where the page is refusing the reader something. */
  test('still says why a control account refuses a posting', async ({ page }) => {
    await detail(page, 'acct_11420')
    await expect(page.getByText('Control account, so only the system posts here')).toBeVisible()
    await expect(page.getByRole('button', { name: /Add an adjustment account beside it/ })).toBeVisible()
    // And the role's description is gone from the same block it used to lead.
    await expect(page.getByText('Tracks the value of inventory on hand')).toHaveCount(0)
  })

  // The contra flag is a fact about the account that its Debit/Credit value does
  // not give, so the badge stays even though the sentence under it went.
  test('still badges a contra account', async ({ page }) => {
    await detail(page, 'acct_11330')
    await expect(page.getByText('Contra', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('carries the opposite side to its category')).toHaveCount(0)
  })

  /* Where the removed prose went. This is the half that makes the cut a move
     rather than a deletion, and it is the half a source-text test cannot see:
     the page passing the right props to `NormalBalanceHelp` is not the same
     claim as a reader being able to open it.

     Read on the contra account, because it is the one whose normal balance does
     not follow from its category - the account that most needs the explanation
     and the one that was carrying two of the removed lines. */
  const infoIcon = (page: Page, label: string) =>
    page.getByText(label).locator('..').locator('svg').first()

  test('keeps the explanations one hover away', async ({ page }) => {
    await detail(page, 'acct_11330')
    await infoIcon(page, 'Normal balance').hover()
    await expect(page.getByText('carries the opposite side to its category')).toBeVisible()
    await expect(page.getByText('Positive figures on this page move toward credit')).toBeVisible()

    await infoIcon(page, 'Statement classification').hover()
    await expect(page.getByText('within the operating cycle if that runs longer')).toBeVisible()
  })
})

/* Mahad, 2026-09-21: *"Make it dimensions instead of default dimensions... edit
   defaults should be add dimension."* The card is named for what it holds, and
   the one way into it is named for what opening it is for. */
test.describe('dimensions', () => {
  const card = (page: Page) =>
    page.locator('div').filter({ has: page.getByText('Dimensions', { exact: true }) }).last()

  test('is named for what it holds, not for what it does to a posting', async ({ page }) => {
    await detail(page, 'acct_11420')
    await expect(page.getByText('Default dimensions')).toHaveCount(0)
  })

  test('lists the ones the account has, and nothing else', async ({ page }) => {
    await detail(page, 'acct_11420')
    const c = card(page)
    await expect(c.getByText('Postings start with these')).toHaveCount(0)
    // acct_11420 carries two, so both dimension names are stated.
    await expect(c.getByRole('button', { name: /Add dimension/ })).toBeVisible()
    await expect(c.getByText('No dimensions', { exact: true })).toHaveCount(0)
  })

  test('shows an empty state when it has none', async ({ page }) => {
    await detail(page, 'acct_11120')
    const c = card(page)
    await expect(c.getByText('No dimensions', { exact: true })).toBeVisible()
    // The empty state is a way in, not a dead end - and it is the same way in
    // as the full one, because what it opens is the same table.
    await expect(c.getByRole('button', { name: /Add dimension/ })).toBeVisible()
  })

  // The editor behind the card is untouched: the copy was cut, not the feature.
  test('still opens the editor from the empty state', async ({ page }) => {
    await detail(page, 'acct_11120')
    await card(page).getByRole('button', { name: /Add dimension/ }).click()
    await expect(page.getByRole('button', { name: 'Save dimensions' })).toBeVisible()
    /* An account with none opens on its empty state, so the field only exists
       once there is a card to hold it - which is the act the empty state offers. */
    await page.getByRole('button', { name: 'Add a dimension' }).click()
    // The editor's own field, renamed with it.
    await expect(page.getByText('Values for this account')).toBeVisible()
    await expect(page.getByText('Starts as')).toHaveCount(0)
  })
})
