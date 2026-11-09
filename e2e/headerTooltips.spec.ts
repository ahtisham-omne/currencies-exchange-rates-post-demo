import { test, expect, type Page } from '@playwright/test'

/* Supplied copy for the listing's column tooltips, pinned against the running
   page. A tooltip is the one kind of copy a source-text test cannot vouch for:
   the string can sit in HEADER_DEFS, spelled right, and still never reach the
   reader because the column is off by default or the (i) never opened. */

const COPY: Record<string, string> = {
  'Dimensions':
    'A dimension is something your company organizes or filters accounts by, such as Location or Department.',
  'Number range':
    'The range of account numbers reserved for a summary account.',
  'GL account type':
    'Defines whether the account is a Summary account or a Posting account.',
  'Statement classification':
    'The section of the financial statement where the account appears, e.g. Current asset or Non-current asset.',
  'Account role':
    'The account role tells Omne how and where the account is used. For example, an Accounts Payable account can be used for Vendor Invoicing.',
  'Normal balance':
    'The side where the account balance normally increases. Assets and expenses normally have a debit balance, while liabilities, equity, and revenue normally have a credit balance.',
  'Opening balance':
    'The account balance at the start of the selected period, before any transactions are recorded for that period.',
  'Running balance':
    'The account balance after each transaction, showing the current balance as transactions are posted.',
  // Straight apostrophes, which is what the module uses everywhere else; the
  // supplied copy's curly pair was the only two in the file.
  'Foreign balance':
    "The account balance shown in the account's foreign currency instead of the company's base currency.",
}

/* The (i) is a `cursor-help` span inside the header cell; the header itself is a
   sort button, so hovering the cell at large would not raise the tooltip. */
const infoIcon = (page: Page, header: string) =>
  page.locator('thead th', { hasText: header }).first().locator('.cursor-help').first()

/* Tooltip portals to the body with no role of its own, same as Menu does - and a
   plain one portals a `span`, where the rich card portals a `div`. Matching only
   the div is how this spec first went green-looking-red against copy that was in
   fact on the screen. */
const tip = (page: Page) => page.locator('body > span.fixed, body > div.fixed').last()

test.describe('the listing explains its columns in the words supplied for them', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
    await page.waitForSelector('thead th')
  })

  for (const [header, copy] of Object.entries(COPY)) {
    test(`says it on ${header}`, async ({ page }) => {
      // On by default, or the reader never meets the tooltip at all.
      await expect(page.locator('thead th', { hasText: header }).first()).toBeVisible()

      await infoIcon(page, header).hover()
      await expect(tip(page)).toContainText(copy)
    })
  }

  /* Running balance carries a second sentence the supplied copy does not: the
     sign rule the grid uses - read on the category's side, so a contra reads
     negative. Module review, 2026-10-06 (COA-24): it used to say a contra reads
     positive, which the grid does not do. */
  test('goes on to say why a contra reads negative', async ({ page }) => {
    await infoIcon(page, 'Running balance').hover()
    await expect(tip(page)).toContainText('Sales Returns at -$110,000, reads negative because it is a deduction, not an error')
  })

  /* The listing states the field; it does not tell the reader to change it,
     because here they cannot. That sentence belongs to the create form. */
  test('leaves when-to-change off the Normal balance column', async ({ page }) => {
    await infoIcon(page, 'Normal balance').hover()
    // The positive half first: on its own the assertion below would also hold
    // for a tooltip that opened empty.
    await expect(tip(page)).toContainText('normally have a debit balance')
    await expect(tip(page)).not.toContainText('Accumulated Depreciation')
  })
})
