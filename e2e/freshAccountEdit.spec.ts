import { test, expect, type Page, type Locator } from '@playwright/test'

/* An account nobody has posted to is still a draft, and its form says so.

   Mahad, 2026-09-22: *"right now, if I create a new account, a new posting
   account inside any summary account, and when I go to edit it, everything or
   almost everything is locked ... when I create a new account and there are no
   transactions in it - meaning transactions don't exist in it yet, it's a
   completely fresh new account - then I should be able to change everything. In
   the edit view, the things we have locked were done solely because for accounts
   where transactions have already taken place, you cannot make changes."*

   The field-by-field state of that is pinned in `editRestrictions.spec.ts`. What
   is pinned here is his scenario end to end - create an account, reopen it,
   change the structural things, save - because each of those fields was unlocked
   by a different rule and the three have to cooperate: the category decides which
   summaries the parent field offers, the parent decides the statement line, and
   the save has to carry all of it. A form that unlocks three fields and patches
   none of them looks identical until you come back to the account.

   Second half of the same session, and in the same file because it is the other
   side of "what a summary is": a summary is archived, never deactivated. Nothing
   posts to one, so there is nothing to close it to. */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'Full view' }).last()

// Found through the label: no control in this form is tied to its label by `for`.
const field = (m: Locator, label: string) =>
  m.locator(`xpath=.//label[starts-with(normalize-space(.), "${label}")]/..`)

const picker = (f: Locator) => f.locator('button[aria-haspopup="listbox"]')

/* A row is not a link - the whole `tr` carries the navigation - so an account is
   reached from the listing by searching for it and clicking the row that comes
   back. Which is also the reader's route, and the point of reading back off the
   listing rather than off the page that saved. */
const find = (page: Page, text: string) => {
  const search = page.getByPlaceholder('Search accounts')
  /* The store coalesces writes on a 400ms trailing timer and flushes on
     `pagehide`, which a reload does not wait for - so a reload straight after a
     save can read back the chart as it was before it. A reader navigating in the
     app never reloads at all; the test does, to prove the change outlived the
     page that made it, and so it waits out the timer the reader never sees. */
  const listing = async () => {
    await page.waitForTimeout(800)
    await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
    await page.waitForSelector('thead th')
    await search.fill(text)
    return page.locator('tbody tr', { hasText: text }).first()
  }
  return {
    async click() { await (await listing()).click() },
    row: listing,
  }
}

async function editDetails(page: Page, id: string) {
  await page.goto(`/chart-of-accounts/${id}`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /^Edit Account/ }).first().click()
  const m = modal(page)
  await m.getByText('GL account details').first().waitFor()
  return m
}

/* Save runs from the Preview step, so an edit is clicked through rather than
   submitted from Details - which is the reader's own route to it too. How many
   steps stand in between depends on the account: a bank account has its banking
   details, a posting account its dimensions. */
async function save(page: Page, m: Locator) {
  const saveButton = m.getByRole('button', { name: /Save changes/ })
  for (let i = 0; i < 4 && !(await saveButton.count()); i++) {
    await m.getByRole('button', { name: /Continue/ }).first().click()
  }
  await saveButton.first().click()
  await expect(modal(page)).toHaveCount(0)
}

/* Mahad's own scenario, made rather than borrowed: a posting account created
   inside a summary, this minute, with nothing in it. 6530 is the seeded stand-in
   for one and the rest of the file uses it, but the complaint was about an
   account the reader had just made, and a seeded account cannot show that the
   form treats those two the same. */
async function createFreshAccount(page: Page, number: string, name: string) {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Create GL account/ }).click()
  const m = modal(page)
  await m.getByText('What kind of account is this?').first().waitFor()
  await m.getByRole('button', { name: /Continue/ }).first().click()
  await m.getByText('GL account details').first().waitFor()

  // The type comes first: the parent field is only asked once the form knows
  // whether it is placing a posting account or a summary.
  await picker(field(m, 'GL account type')).click()
  await page.getByRole('option', { name: 'Posting', exact: true }).click()
  // The form no longer picks a parent (Mahad, 2026-10-08).
  await field(m, 'Parent').locator('button[aria-haspopup="listbox"]').first().click()
  await page.getByRole('option', { name: /11000/ }).first().click()
  await field(m, 'GL account no.').locator('input').fill(number)
  await field(m, 'GL account name').locator('input').fill(name)
  // The parent defaults to the first eligible summary, so the account lands
  // inside one without being told to - which is the case he described.
  const parent = (await picker(field(m, 'Parent')).innerText()).trim()

  const createButton = m.getByRole('button', { name: 'Create account' })
  for (let i = 0; i < 4 && !(await createButton.count()); i++) {
    await m.getByRole('button', { name: /Continue/ }).first().click()
  }
  await createButton.first().click()
  await expect(modal(page)).toHaveCount(0)
  return parent
}

test.describe('an account created a minute ago', () => {
  test('opens its edit form with every structural field live', async ({ page }) => {
    await createFreshAccount(page, 'AST-FRESH-1', 'Probe fresh asset')
    await find(page, 'Probe fresh asset').click()
    const m = modal(page)
    await page.getByRole('button', { name: /^Edit Account/ }).first().click()
    await m.getByText('GL account details').first().waitFor()

    await expect(field(m, 'GL account no.').locator('input')).toBeEditable()
    await expect(picker(field(m, 'GL account category'))).toBeEnabled()
    await expect(picker(field(m, 'Parent'))).toBeEnabled()
    await expect(picker(field(m, 'Status'))).toBeEnabled()
    // The one that stays settled: a posting account never becomes a summary.
    await expect(picker(field(m, 'GL account type'))).toHaveCount(0)
  })

  /* And the change reaches the account. This is the half a lock hides: a field
     can be unlocked, accept a value, and be dropped from the patch on the way
     out, and the only way to tell is to come back and look. */
  test('saves a renumber, and the account is found under the new number', async ({ page }) => {
    const m = await editDetails(page, 'acct_53020')
    // Inside the block Other Expenses reserves, which is the only place its
    // number can go while it stays there (design review, 2026-09-24).
    await field(m, 'GL account no.').locator('input').fill('53025')
    await save(page, m)
    await expect(page.getByText('53025').first()).toBeVisible()

    // Read back off the listing, not only off the page that saved it.
    await expect(await find(page, '53025').row()).toContainText(/Loss on Sale of Assets/i)
  })

  /* Re-filing, which is the correction the whole change is for: an account
     filed under the wrong summary an hour ago. The parent picker offers the
     summaries of its category, and the account moves to the one picked.

     With a number from the new branch: 53020 sits inside the block Other
     Expenses reserves, and a reservation keeps every account that is not under
     it out (design review, 2026-09-24) - so the move is refused until the number
     moves too, and saved once it has. */
  test('re-files under another summary, and lands there', async ({ page }) => {
    const m = await editDetails(page, 'acct_53020')
    await picker(field(m, 'Parent')).click()
    await page.getByRole('option', { name: /52300/ }).first().click()
    await expect(m.getByText(/sets aside \(53000–53999\)/)).toBeVisible()

    await field(m, 'GL account no.').locator('input').fill('52370')
    await expect(m.getByText(/reserves 53000–53999/)).toHaveCount(0)
    await save(page, m)

    // The detail page names the summary the account now sits under.
    await expect(page.getByRole('link', { name: /General and Administrative/ }).first()).toBeVisible()
  })

  /* The cascade, which is why the category could not be unlocked on its own: an
     account is in its parent's category by arithmetic, so a category the reader
     changes has to take the parent with it or the two would disagree. */
  test('changing its category re-offers the parents of the category it moved to', async ({ page }) => {
    const m = await editDetails(page, 'acct_53020')
    await picker(field(m, 'GL account category')).click()
    await page.getByRole('option', { name: 'Liability', exact: true }).click()

    await picker(field(m, 'Parent')).click()
    const shown = await page.getByRole('option').allInnerTexts()
    expect(shown.length).toBeGreaterThan(0)
    // Liability numbers, not the 6xxx expense summaries it was filed under. The
    // option leads with the trunk glyph that places it in the tree, so the
    // number is read out of the line rather than off the front of it.
    for (const o of shown) expect(o.match(/(\S+) ·/)?.[1], o).toMatch(/^2/)
  })
})

/* The counterweight. Every assertion above is only worth having if the lock is
   still there on the account it was written for - otherwise this is a change
   that unlocked the form rather than one that moved the rule. */
test('an account entries have posted to keeps all three settled', async ({ page }) => {
  const m = await editDetails(page, 'acct_11130')
  await expect(field(m, 'GL account no.').locator('input')).toHaveCount(0)
  await expect(picker(field(m, 'GL account category'))).toHaveCount(0)
  await expect(picker(field(m, 'Parent'))).toHaveCount(0)
})

/* Mahad, same message: *"I don't think summary accounts should allow direct
   transaction postings - that doesn't make sense. I think summary account should
   be archieved only but only when there is no child account under it."*

   Deactivate closes an account to postings. Nothing posts to a summary, so the
   state said nothing about one, and offering it implied the opposite - that a
   summary had been open to transactions until you turned it off. It is gone from
   every control that offered it, which is three: the row menu, the status menu on
   the row, and the Status field on the edit form. */
/* Decision 53 (Eli, 2026-09-04) settled it the other way: a summary can be
   deactivated once every account under it is inactive. Module review,
   2026-10-06 (COA-21). So every control offers it, and the attempt is what is
   refused, with the reason (decision 52). */
test.describe('a summary can be deactivated once its accounts are', () => {
  /* `Menu` portals its panel into the body with no role of its own, and a
     tooltip raised by hovering the kebab portals to the same place - so the
     panel is the portalled box that holds buttons, not simply the last one.
     Same reading as `rowActions.spec.ts`, which is the file that owns the rule
     that a row and a detail page offer the same set. */
  const panel = (page: Page) =>
    page.locator('body > div.fixed').filter({ has: page.locator('button') }).last()

  const rowItems = async (page: Page, rowText: string) => {
    await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
    await page.waitForSelector('thead th')
    await page.locator('tbody tr', { hasText: rowText }).first().locator('td').last().locator('button').last().click()
    const p = panel(page)
    await p.locator('button').first().waitFor()
    return (await p.locator('button').allInnerTexts()).map(t => t.trim().split('\n')[0]).filter(Boolean)
  }

  test('offers Deactivate and Archive on a summary row', async ({ page }) => {
    const items = await rowItems(page, 'Short-Term Investments')
    expect(items.some(i => /^Deactivate/.test(i)), items.join(' | ')).toBe(true)
    expect(items.some(i => /^Archive/.test(i)), items.join(' | ')).toBe(true)
  })

  // And the posting account beside it still has both, or the item was removed
  // rather than withheld from the one kind that has no use for it.
  test('leaves both on a posting row', async ({ page }) => {
    const items = await rowItems(page, 'Operating - Chase Bank')
    expect(items.some(i => /^Deactivate/.test(i)), items.join(' | ')).toBe(true)
    expect(items.some(i => /^Archive/.test(i)), items.join(' | ')).toBe(true)
  })

  /* The status chip is the second way into the lifecycle, and it states what
     each state means. A state a summary cannot reach has no meaning to state. */
  test('offers a summary all three states in the status menu', async ({ page }) => {
    await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
    await page.waitForSelector('thead th')
    const chip = page.locator('tbody tr', { hasText: 'Short-Term Investments' }).first()
      // A chip that opens the lifecycle is a button, so match the shape not the tag.
      .locator('.rounded-full', { hasText: /^(Active|Inactive|Archived)$/ }).first()
    /* The Status column sits off to the right, so reaching the chip scrolls the
       table sideways - and a scroll event is delivered on the next frame, after
       the click that follows it has already opened the menu. `Menu` closes on
       any scroll, so the panel would open and vanish. The scroll is settled
       before the click rather than after, which is also what a reader does. */
    await chip.scrollIntoViewIfNeeded()
    await page.waitForTimeout(200)
    await chip.click()
    const menu = panel(page)
    await menu.locator('button').first().waitFor()
    const states = (await menu.locator('button').allInnerTexts()).map(t => t.trim().split('\n')[0])
    // The state it is in reads as the state; the ones it can move to read as moves.
    expect(states).toEqual(['Active', 'Deactivate', 'Archive'])
    await expect(menu.getByText(/No longer available as a parent/)).toBeVisible()
  })

  test('offers Inactive on a summary edit form, as on its row', async ({ page }) => {
    const m = await editDetails(page, 'acct_11100')
    await expect(picker(field(m, 'Status'))).toHaveCount(1)
    await expect(field(m, 'Status')).toContainText('Active')
  })

  /* But the rule is about an account that exists. Mahad, 2026-09-23: *"Status is
     locked on create, and it shouldn't be. Default it to Active but let people
     change it."* The same padlock had been standing on the create form, where
     there is no lifecycle to agree with: choosing the state a new account opens in
     closes nothing to postings, because nothing is there yet. */
  test('offers the choice on a create, whichever kind is being created', async ({ page }) => {
    for (const type of ['Posting', 'Summary']) {
      await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: /Create GL account/ }).click()
      const m = modal(page)
      await m.getByRole('button', { name: /Continue/ }).first().click()
      await m.getByText('GL account details').first().waitFor()
      await field(m, 'GL account type').locator('button[aria-haspopup="listbox"]').click()
      await page.getByRole('option', { name: type, exact: true }).click()

      const status = field(m, 'Status')
      await expect(status, type).toContainText('Active')
      await picker(status).click()
      expect(await page.getByRole('option').allInnerTexts(), type).toEqual(['Active', 'Inactive'])
      await page.keyboard.press('Escape')
    }
  })

  /* And the state that opens has to be a state you can leave, or the create form
     is offering a one-way door. Activate is allowed on a summary - only
     deactivate is refused - so the field goes on offering it. */
  test('lets a summary created inactive be brought back from the same field', async ({ page }) => {
    await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /Create GL account/ }).click()
    const m = modal(page)
    await m.getByRole('button', { name: /Continue/ }).first().click()
    await m.getByText('GL account details').first().waitFor()
    await picker(field(m, 'GL account type')).click()
    await page.getByRole('option', { name: 'Summary', exact: true }).click()
    // The form no longer picks a parent (Mahad, 2026-10-08).
    await field(m, 'Parent').locator('button[aria-haspopup="listbox"]').first().click()
    await page.getByRole('option', { name: /11000/ }).first().click()
    // No number is typed: a summary is numbered by the block it reserves, and the
    // form offers one off the chart. Found again by name, which is the only part
    // of it this test has any business choosing.
    await field(m, 'GL account name').locator('input').fill('Probe dormant summary')
    await picker(field(m, 'Status')).click()
    await page.getByRole('option', { name: 'Inactive', exact: true }).click()

    const createButton = m.getByRole('button', { name: 'Create account' })
    for (let i = 0; i < 4 && !(await createButton.count()); i++) {
      await m.getByRole('button', { name: /Continue/ }).first().click()
    }
    await createButton.first().click()
    await expect(modal(page)).toHaveCount(0)

    await find(page, 'Probe dormant summary').click()
    const e = modal(page)
    await page.getByRole('button', { name: /^Edit Account/ }).first().click()
    await e.getByText('GL account details').first().waitFor()
    await expect(field(e, 'Status')).toContainText('Inactive')
    await picker(field(e, 'Status')).click()
    await expect(page.getByRole('option', { name: 'Active', exact: true })).toBeVisible()
  })
})
