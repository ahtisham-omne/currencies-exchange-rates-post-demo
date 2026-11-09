import { test, expect, type Page, type Locator } from '@playwright/test'

/* An edit asks the same questions a create asks.

   Mahad: *"creation and editing flows are not the same fields wise. Edit removes
   some fields for you."* One field did: Parent, hidden outright on `isEdit`, so
   a reader editing an account was shown a form that never mentioned where the
   account sat.

   Locked is not removed. Several of these fields answer instead of asking - the
   category, the GL account type, the parent, the statement line - and they are
   all still put to the reader, with the answer and the reason it is settled.
   Mahad, 2026-09-22: *"locked fields must remain visible but explicitly grayed
   out / read-only ... rather than hidden or replaced with custom text."* What
   the parity here pins is the questions, not the controls.

   Pinned against the running page rather than the source, because the claim is
   about which fields a reader is shown - a gate that hides a field reads exactly
   like a field that was never built.

   The parity now covers a summary account too. It used to have its own modal,
   which asked three things and stated the rest as text; that modal is gone, and
   the last group below holds the one difference that remains - a summary has no
   side to post on and no role to be recognized by, so those two fields are not
   asked of it at all. */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'Full view' }).last()

const field = (m: Locator, label: string) =>
  m.locator(`xpath=.//label[starts-with(normalize-space(.), "${label}")]/..`)

const picker = (f: Locator) => f.locator('button[aria-haspopup="listbox"]')

// A field's two hover targets: the (i) beside the label, and - where the field
// is settled - the padlock inside the box.
const infoIcon = (f: Locator) => f.locator('label span.cursor-help')
const padlock = (f: Locator) => f.locator('div.input span.cursor-help')

/** Hover something and read back the card it puts up, then get off it. */
async function hint(page: Page, target: Locator) {
  await target.hover()
  const card = page.locator('body > span.fixed, body > div.fixed').last()
  await expect(card).toBeVisible()
  const text = (await card.innerText()).replace(/\s+/g, ' ').trim()
  await page.mouse.move(2, 2)
  return text
}

// The fields a step asks for, named by their labels. The asterisk a required
// field carries is part of the label element, so it comes off here.
const asked = async (m: Locator) =>
  (await m.locator('label').allInnerTexts()).map(t => t.replace(/\s*\*$/, '').trim())

// An edit opens on Details: the classification step is a create's, and an
// account that already is something is not asked what kind to be.
async function editDetails(page: Page, id: string) {
  await page.goto(`/chart-of-accounts/${id}`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /^Edit Account/ }).first().click()
  const m = modal(page)
  await m.getByText('GL account details').first().waitFor()
  return m
}

async function createDetails(page: Page, category: RegExp, glType: string) {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Create GL account/ }).first().click()
  const m = modal(page)
  await m.getByText('What kind of account is this?').first().waitFor()
  await m.getByRole('button', { name: category }).first().click()
  await m.getByRole('button', { name: /Continue/ }).first().click()
  await m.getByText('GL account details').first().waitFor()
  await picker(field(m, 'GL account type')).first().click()
  await page.getByRole('option', { name: glType, exact: true }).first().click()
  return m
}

test.describe('the details step asks the same fields either way', () => {
  test('on a posting account', async ({ page }) => {
    // acct_53020 is an expense posting account nothing has posted to.
    const edit = await asked(await editDetails(page, 'acct_53020'))
    const create = await asked(await createDetails(page, /Expense/, 'Posting'))
    for (const label of create) expect(edit).toContain(label)

    /* Three more on the edit, every one of them stated rather than offered. Two
       are the questions a create spends its first step on as card grids and an
       edit folds in here. The third is Currency, which a create leaves out
       where the account holds no currency of its own - on an edit it stands,
       greyed, because a field simply absent from a form the reader opened to
       change something cannot be told from one that was never built. */
    expect(edit.filter(l => !create.includes(l)))
      .toEqual(['GL account category', 'Statement classification', 'Currency'])
  })

  /* A summary walks the same form. Its own modal - three live fields over a
     read-only list of facts - is gone: Mahad, 2026-09-22, *"replace the
     cramped/weird UI with the spacious GL Account Details view framework."* */
  test('and on a summary, minus the two it has no answer for', async ({ page }) => {
    const posting = await asked(await editDetails(page, 'acct_53020'))
    const summary = await asked(await editDetails(page, 'acct_11200'))
    // Nothing posts to a summary, so it has no side to post on; and a role is
    // what a module recognizes an account's entries by, which it has none of.
    expect(summary).toEqual(posting.filter(l => l !== 'Normal balance' && l !== 'Account role'))
  })

  /* The one field only a summary has, and the one step only a posting account
     gets. Mahad: *"we don't assign dimensions to summary accounts; dimensions
     are only meant for posting accounts."* */
  test('asks a summary for its number range, and never for dimensions', async ({ page }) => {
    const m = await editDetails(page, 'acct_11200')
    await expect(m.getByLabel('Range start')).toBeVisible()
    await expect(m.getByLabel('Range end')).toBeVisible()
    await expect(m.getByText('Dimensions')).toHaveCount(0)
  })

  /* The headings the old modal sorted its fields under. Mahad: *"remove
     confusing helper text (such as 'what you can change' or 'set by the
     chart')."* A form that sorts its fields into what you may and may not touch
     is answering a question the padlocks already answer, field by field. */
  test('sorts nothing into what you may and may not change', async ({ page }) => {
    const m = await editDetails(page, 'acct_11200')
    await expect(m.getByText('What you can change')).toHaveCount(0)
    await expect(m.getByText('Set by the chart')).toHaveCount(0)
  })
})

/* And answers them in the same words.

   Mahad, 2026-09-24: *"Why does the edit flow show different UX copy in the
   tooltips? They should be the same as in the creation flow."* The (i) beside a
   settled field's label was being handed the reason for the lock, so the same
   icon on the same field compared Summary against Posting on a create and said
   "an account cannot be changed from one to the other" on an edit.

   Two icons, two questions. The (i) says what the field is, in one set of words
   wherever the form is opened from; the padlock says why it will not move. Read
   off the page in both flows at once - the copy is shared in source, and a test
   that only checked that would pass on a field whose (i) had been dropped.

   Two pages rather than one walked twice: navigating away from an open form
   with unsaved answers in it is its own dialogue, and not the one under test. */
test.describe('and answers them in the same words', () => {
  test('the (i) on a settled field says what it says on a create', async ({ page }) => {
    const create = await createDetails(page, /Asset/, 'Posting')
    const onCreate = {
      glType: await hint(page, infoIcon(field(create, 'GL account type'))),
      normalBalance: await hint(page, infoIcon(field(create, 'Normal balance'))),
    }
    expect(onCreate.glType, 'the create explains the type').toMatch(/Summary/)
    expect(onCreate.normalBalance, 'and the side').toMatch(/debit/)

    // 1030 has entries posted to it, so both fields are settled there.
    const posted = await page.context().newPage()
    const edit = await editDetails(posted, 'acct_11130')
    expect(await hint(posted, infoIcon(field(edit, 'GL account type')))).toBe(onCreate.glType)
    expect(await hint(posted, infoIcon(field(edit, 'Normal balance')))).toBe(onCreate.normalBalance)
  })

  test('and the padlock, not the (i), says why it will not move', async ({ page }) => {
    const m = await editDetails(page, 'acct_11130')
    expect(await hint(page, padlock(field(m, 'GL account type'))))
      .toMatch(/cannot be changed from one to the other/)
    expect(await hint(page, padlock(field(m, 'Normal balance')))).toMatch(/^Entries have posted/)
  })

  /* Where a create explains nothing, an edit explains nothing either: the
     number, the currency and the category are stated on a create and carry no
     (i) there, so growing one here would be the same drift running backwards.
     The reason still has somewhere to be - the padlock each of them already
     has. */
  test('grows no hint on a field a create leaves unexplained', async ({ page }) => {
    const m = await editDetails(page, 'acct_11130')
    for (const label of ['GL account category', 'GL account no.', 'Currency']) {
      await expect(infoIcon(field(m, label)), `${label} carries no (i)`).toHaveCount(0)
      await expect(padlock(field(m, label)), `${label} answers on its padlock`).toHaveCount(1)
    }
  })
})

/* The field is asked on an edit, and - once the account is in use - answered
   rather than offered.

   Mahad: *"Parent field should be locked as well in edit flow. The only way an
   account can have another parent is from this option"*, pointing at "Move under
   a new summary account". So a settled account's form states where it sits and
   names the way out; it is not a second, quieter route to the same change.

   What that route buys is being walked through moving figures that have already
   been reported, and an account nothing has posted to has none to move - so on
   2026-09-22 the lock moved from the edit to the use: *"it's a completely fresh
   new account - then I should be able to change everything."* 1030 is posted to,
   6530 is not, and the two are the two halves of the rule.

   Pinned here rather than in a unit test for the same reason the parity tests
   above are: a picker still rendered but ignored on save would read, to anyone
   looking at the page, exactly like a picker that works. */
test.describe('the parent, on an edit', () => {
  const parent = (m: Locator) => field(m, 'Parent')

  test('states where a posted account sits, with no picker to change it', async ({ page }) => {
    const m = await editDetails(page, 'acct_11130')
    await expect(picker(parent(m))).toHaveCount(0)

    // The same account the detail page names behind the modal, read out of the
    // locked box rather than off a trigger.
    const shown = (await parent(m).locator('div.input').first().innerText()).trim()
    await expect(page.locator('a[title]', { hasText: shown.split(' · ')[1] }).first()).toHaveCount(1)
  })

  // And offers one on an account nothing has posted to, where re-filing it is a
  // correction rather than a move.
  test('offers a picker on an account nothing has posted to', async ({ page }) => {
    const m = await editDetails(page, 'acct_53020')
    await expect(picker(parent(m))).toBeEnabled()
    // Opened on the parent it already has, not on an empty field.
    await expect(picker(parent(m))).toContainText('53000')
  })

  /* The lock says nothing under the field. Mahad, 2026-09-21: *"Remove UX copies
     from below the fields."* It used to print the way out - "Move under a new
     summary account" - under the locked box, and an instruction under every
     settled field turned the form into a manual. */
  test('prints no instructions under the locked field', async ({ page }) => {
    const m = await editDetails(page, 'acct_11130')
    await expect(parent(m).getByText(/Move under a new summary account/)).toHaveCount(0)
    // The value survives the copy going: a lock that takes the answer with it
    // leaves the reader worse off than the picker did.
    await expect(parent(m).locator('div.input').first()).not.toBeEmpty()
  })

  /* And the action the field no longer names is really there, on the page the
     reader came from - which is what makes the silence above affordable. */
  test('and that action is on the account’s own Actions menu', async ({ page }) => {
    await page.goto('/chart-of-accounts/acct_53020', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Account actions' }).first().click()
    await expect(page.getByText('Move under a new summary account').first()).toBeVisible()
  })

  /* A summary holds accounts rather than being moved between them, and the menu
     offers it "Create GL account" instead - so there is nothing to point it at.
     The field still states where it sits, with no control of any kind to suggest
     the placement is up for discussion here. */
  test('names no action on a summary, which has none', async ({ page }) => {
    const m = await editDetails(page, 'acct_11200')
    await expect(picker(parent(m))).toHaveCount(0)
    await expect(parent(m).locator('div.input').first()).not.toBeEmpty()
    await expect(m.getByText(/Move under a new summary account/)).toHaveCount(0)
  })

  /* The five category rows are the chart's spine: they sit at the top of their
     category by definition, so there is no account above them to name. The field
     still appears and still answers - one that vanished on the one row where the
     answer is nothing would read as a panel that failed to load rather than a
     chart that ends here. */
  test('says where a category row sits, which is nowhere above it', async ({ page }) => {
    const m = await editDetails(page, 'acct_10000')
    await expect(parent(m).locator('div.input').first()).toHaveText('None')
  })

  /* A create still asks. The lock is the edit flow's, not the field's. */
  test('is still a live choice on a create', async ({ page }) => {
    const m = await createDetails(page, /Expense/, 'Posting')
    await expect(picker(parent(m)).first()).toBeEnabled()
  })

  // "Move under a new summary account" has its own dialog now, which names the
  // parent in its tree: see moveUnderSummary.spec.ts.
})
