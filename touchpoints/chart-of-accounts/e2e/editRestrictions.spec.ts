import { test, expect, type Page, type Locator } from '@playwright/test'

/* What an edit may change, and what it may not.

   The rule is the use, not the edit. An account in use has its structure quoted
   by something outside the form: a posted line names the side it went on, what
   the account is recognized as, the category it fell under and the statement
   line it printed on; an account filed under a summary takes its category and
   its statement line from that summary. Mahad: *"lock account role for me after
   I have transactions against this account"*, *"once transactions exist, you are
   only allowed to change GL Account Name and Account Status"*, and 2026-09-22,
   on the two sides of the rule - unused is *"fully editable, including Account
   Type, Statement Classification, and Currency"*, in use has its *"structural
   parameters locked"*.

   So the two conditions below are one rule read on the two kinds of account. A
   posting account is used by being posted to; a summary holds no figures of its
   own and is used by the accounts filed beneath it.

   One field sits outside that rule and is settled at creation regardless: the
   GL account type, because a posting account and a summary hold their figures
   differently and the conversion is unsafe in both directions.

   The number and the parent used to sit outside it too - the number since
   2026-09-18, *"Account numbers to be locked for all types of accounts in edit
   flow"*, the parent because moving one is an Actions-menu walk-through. Both
   came back inside on 2026-09-22: *"when I create a new account and there are no
   transactions in it ... then I should be able to change everything. In the edit
   view, the things we have locked were done solely because for accounts where
   transactions have already taken place, you cannot make changes."* What each
   lock protects - saved reports quoting a number, reported figures moving with
   an account - exists only once the account is in use, so `inUse` is the whole
   rule. See also `e2e/freshAccountEdit.spec.ts`, which follows a re-filing all
   the way through a save.

   Pinned against the running page rather than the source because every claim
   here is about what a control will let a reader do, and a field that reads the
   right value while accepting a click is exactly the failure. Four accounts
   carry the whole rule between them:

     acct_11130  a posting account with entries against it
     acct_53020  a posting account nothing has posted to
     acct_11100  a summary with accounts filed under it
     acct_10000  a category row, which has no lifecycle in either place */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'Full view' }).last()

/* The field's block, found through its label: no control here is tied to its
   label by `for`, and the locked and live shapes of one field are different
   elements, so structure is the only thing both answer to. */
const field = (m: Locator, label: string) =>
  m.locator(`xpath=.//label[starts-with(normalize-space(.), "${label}")]/..`)

// The Select's trigger, which is what a live field has and a locked one does not.
const picker = (f: Locator) => f.locator('button[aria-haspopup="listbox"]')

/* The padlock, which is where a settled field says why. The (i) beside the
   label answers a different question - what the field is - and says it in the
   create's words; see `editFieldParity.spec.ts`. */
const padlock = (f: Locator) => f.locator('div.input span.cursor-help')

/* An edit opens on Details. It used to open on the classification step and be
   clicked through; that step is a create's, and an account that already is
   something is not asked what kind to be - its two questions moved down here,
   stated where they are settled and asked where they are not. */
async function editDetails(page: Page, id: string) {
  await page.goto(`/chart-of-accounts/${id}`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /^Edit Account/ }).first().click()
  const m = modal(page)
  await m.getByText('GL account details').first().waitFor()
  return m
}

test.describe('an account entries have posted to', () => {
  test('locks its number, type, side, role and classification', async ({ page }) => {
    const m = await editDetails(page, 'acct_11130')

    // Each locked field, by the control a live one would have and it does not.
    await expect(field(m, 'GL account no.').locator('input')).toHaveCount(0)
    await expect(picker(field(m, 'GL account type'))).toHaveCount(0)
    await expect(picker(field(m, 'Normal balance'))).toHaveCount(0)
    await expect(picker(field(m, 'GL account category'))).toHaveCount(0)
    await expect(picker(field(m, 'Statement classification'))).toHaveCount(0)

    /* The role is a dropdown since the design review of 2026-09-24, so it
       locks the way every other dropdown here does: the value, greyed, with a
       padlock, and no picker to open. */
    await expect(picker(field(m, 'Account role'))).toHaveCount(0)
    await expect(field(m, 'Account role')).toContainText('Bank')
    await expect(field(m, 'Account role').locator('div.input span.cursor-help')).toHaveCount(1)
  })

  /* The two the create spends its first step on, on the step the edit opens on,
     in the shape every other settled field takes - the value, greyed, with a
     padlock. Mahad, 2026-09-22: *"locked fields must remain visible but
     explicitly grayed out / read-only ... rather than hidden or replaced with
     custom text."* The dimmed card grid they used to be was a way of asking, and
     an account already in use is not being asked. */
  test('states the category and classification it posted under', async ({ page }) => {
    const m = await editDetails(page, 'acct_11130')
    await expect(field(m, 'GL account category').locator('div.input')).toHaveText(/Asset/)
    await expect(field(m, 'Statement classification').locator('div.input')).not.toBeEmpty()
    // And no grid of cards anywhere on the step to suggest either is on offer.
    await expect(m.getByText('What kind of account is this?')).toHaveCount(0)
  })

  // The whole point of the change: one sentence for the rule, where there were
  // five notes saying it once per field. Counted, not merely found.
  test('says why once, not under every field it settles', async ({ page }) => {
    const m = await editDetails(page, 'acct_11130')
    await expect(m.getByText(/they name its number/)).toHaveCount(1)
    // The number's own hint was one of the five copies.
    await expect(field(m, 'GL account no.').getByText(/posted/)).toHaveCount(0)
  })
})

test.describe('an account nothing has posted to', () => {
  /* The same fields, live. Without this the rule above is satisfied just as well
     by locking them on every edit, which is what the form used to do to the
     classification and would leave the reader no way to correct a mistake on an
     account that has never been used. */
  test('leaves its side and role editable', async ({ page }) => {
    const m = await editDetails(page, 'acct_53020')

    await expect(picker(field(m, 'Normal balance'))).toBeEnabled()
    for (const pill of await field(m, 'Account role').locator('button[aria-pressed]').all()) {
      await expect(pill).toBeEnabled()
    }
    // And no transactions rule to explain, because neither is locked by one.
    await expect(m.getByText(/they name its number/)).toHaveCount(0)
  })

  /* And the three that used to be settled by the fact of editing rather than by
     the transactions. Mahad, 2026-09-22: *"when I create a new account and there
     are no transactions in it ... then I should be able to change everything. In
     the edit view, the things we have locked were done solely because for
     accounts where transactions have already taken place, you cannot make
     changes."* 6530 carries an opening balance and nothing else, so it is the
     fresh account that rule is about.

     The category, the parent and the number move together on purpose: the parent
     is what settles the category, so locking one and not the other would be a
     padlock on half of a decision whose other half is open. */
  test('puts its category, parent and number back in play', async ({ page }) => {
    const m = await editDetails(page, 'acct_53020')
    await expect(picker(field(m, 'GL account category'))).toBeEnabled()
    await expect(picker(field(m, 'Parent'))).toBeEnabled()
    await expect(field(m, 'GL account no.').locator('input')).toBeEditable()
    // Nothing greyed says a rule that does not apply to it.
    await expect(m.getByText(/they name its number/)).toHaveCount(0)
  })

  /* The statement line stays settled, and by where the account sits rather than
     by what has posted to it: 53020 is filed inside 53000, and everything inside a
     summary is in that summary's total, so it prints on the summary's line. The
     way to change it is to change the parent, which is now on offer beside it.

     Which means the padlock has to be able to say which rule it is. A field
     greyed for a reason the reader cannot get at is just a control that stopped
     working, so the reason is read here rather than the lock merely counted. */
  /* Decision 3 (module review, 2026-10-06, COA-13): the statement line starts as
     the summary's, and an override is allowed and flagged rather than locked.
     Only use locks it, and nothing has posted to 53020. */
  test('leaves its statement line open, and flags a line other than the summary\'s', async ({ page }) => {
    const m = await editDetails(page, 'acct_53020')
    await expect(picker(field(m, 'Statement classification'))).toHaveCount(1)
    await expect(m.getByText(/they name its number/)).toHaveCount(0)
  })

  /* The one lock that is not the transactions and does not lift with them. A
     posting account and a summary hold their figures differently, so the
     conversion is unsafe in both directions - and at zero transactions the
     account can be deleted and made again, so an editable field would buy
     nothing delete does not already offer. */
  test('still cannot be turned from a posting account into a summary', async ({ page }) => {
    const m = await editDetails(page, 'acct_53020')
    await expect(picker(field(m, 'GL account type'))).toHaveCount(0)
    // The value is what the field is left saying, and it has to keep saying it.
    await expect(field(m, 'GL account type')).toContainText('Posting')
  })

  /* Mahad, 2026-09-21: *"Remove UX copies from below the fields."* Each locked
     field used to print the way out under it - delete the account and create it
     again - and three of those on one step read as a manual rather than a form.
     The padlock says the field is settled; nothing recites what to do about it.
     Counted across the whole step, because the complaint was the accumulation. */
  test('recites no recovery instructions under any field', async ({ page }) => {
    const m = await editDetails(page, 'acct_53020')
    await expect(m.getByText(/create it again/)).toHaveCount(0)
    await expect(m.getByText(/Set when the account was created/)).toHaveCount(0)
    await expect(m.getByText(/settled when it is created/)).toHaveCount(0)
  })
})

/* The other half of the use rule. A summary takes no postings, so the thing that
   settles it is what has been filed beneath it - those accounts take their
   category and their statement line from here, and moving it moves them.
   Mahad, 2026-09-22: *"child accounts linked under a Summary"* is in use. */
test.describe('a summary with accounts filed under it', () => {
  test('locks the category and statement line its children take from it', async ({ page }) => {
    const m = await editDetails(page, 'acct_11100')
    await expect(picker(field(m, 'GL account category'))).toHaveCount(0)
    await expect(picker(field(m, 'Statement classification'))).toHaveCount(0)
    // Said once, in the summary's own terms rather than the posted account's.
    await expect(m.getByText(/Accounts are filed under this summary/)).toHaveCount(1)
  })

  // What it is used by is the children, so the reason has to name them. A
  // summary reported as locked by transactions it cannot have is just wrong.
  test('does not claim entries posted to it', async ({ page }) => {
    const m = await editDetails(page, 'acct_11100')
    await expect(m.getByText(/they name its number/)).toHaveCount(0)
  })

  // The three the lock leaves open, which are what a summary is asked for.
  test('leaves its name, range and description open', async ({ page }) => {
    const m = await editDetails(page, 'acct_11100')
    await expect(field(m, 'GL account name').locator('input')).toBeEditable()
    await expect(m.getByLabel('Range start')).toBeEditable()
    await expect(m.getByLabel('Range end')).toBeEditable()
    await expect(field(m, 'Description').locator('textarea')).toBeEditable()
  })
})

/* Locked on every kind of account, not just the posting account the two tests
   above use. All three kinds now walk the same form, so the number is a locked
   box on each of them - stated, padlocked, and with nothing to type into. */
test.describe('the number, on every kind of account', () => {
  for (const [id, number, kind] of [['acct_11100', '11100', 'a summary'], ['acct_10000', '10000', 'a category row']] as const) {
    test(`is locked on ${kind}`, async ({ page }) => {
      const m = await editDetails(page, id)
      await expect(field(m, 'GL account no.')).toContainText(number)
      await expect(field(m, 'GL account no.').locator('input')).toHaveCount(0)
    })
  }
})

test.describe('status, on the form as well as in the menu', () => {
  /* It was a padlocked box reading "Changed from the Actions menu, not here."
     Mahad: *"If we are allowing users to edit from the actions menu, we should
     allow them to edit from here as well."* */
  test('offers no message sending the reader to the menu', async ({ page }) => {
    const m = await editDetails(page, 'acct_11130')
    await expect(m.getByText(/Actions menu, not here/)).toHaveCount(0)
    await expect(picker(field(m, 'Status'))).toBeEnabled()
  })

  // Editable even on the account the rest of the step is locked on: status is
  // one of the two things a posted account may still change.
  test('is editable on an account entries have posted to', async ({ page }) => {
    const m = await editDetails(page, 'acct_11130')
    await expect(picker(field(m, 'Status'))).toBeEnabled()
    await expect(field(m, 'GL account no.').locator('input')).toHaveCount(0)
  })

  test('saves the change it was given', async ({ page }) => {
    // Matched on the shape, not the tag: a chip that opens the lifecycle is a
    // button now and one that only states it stays a span.
    const chip = () => page.locator('.rounded-full', { hasText: /^(Active|Inactive|Archived)$/ })
    const m = await editDetails(page, 'acct_53020')
    await expect(chip().first()).toHaveText('Inactive')

    await picker(field(m, 'Status')).click()
    await page.getByRole('option', { name: 'Active', exact: true }).click()
    await save(page, m)

    await expect(chip().first()).toHaveText('Active')
  })

  /* A summary's status used to be off its form entirely - its own modal asked
     three things and stated the rest - so the one way in was the Actions menu.
     That modal is gone and a summary walks the same form, where the field is
     asked like every other.

     It is answered rather than offered, and not by the use rule this file is
     about: a summary has one state it can move to and archiving asks where the
     balance goes, so the move is an Actions-menu item and the field states where
     the account stands. That half is pinned in `freshAccountEdit.spec.ts`. */
  test('is asked of a summary too, which used to only state it', async ({ page }) => {
    const m = await editDetails(page, 'acct_11100')
    await expect(field(m, 'Status')).toContainText('Active')
  })
})

/* Nothing asks the reader to justify an edit. Mahad: *"I don't think we should
   be recording this reason manually. As long as the change is being captured
   and reflected in the audit log, it is perfectly fine."* */
test('asks for no reason for the change', async ({ page }) => {
  const m = await editDetails(page, 'acct_11130')
  await expect(m.getByText('Reason for change')).toHaveCount(0)
  await expect(m.getByText(/Recorded against the account/)).toHaveCount(0)
})

// Save sits on the last step, and how many steps are between depends on the
// account: a bank account has a banking step, a summary does not.
async function save(page: Page, m: Locator) {
  const saveButton = m.getByRole('button', { name: /Save changes/ })
  for (let i = 0; i < 4 && !(await saveButton.count()); i++) {
    await m.getByRole('button', { name: /Continue/ }).first().click()
  }
  await saveButton.first().click()
}
