import { test, expect, type Page } from '@playwright/test'

/* Mahad, 2026-09-23: *"'Create new value' in the Choose dropdown doesn't do
   anything when you click it. Either fix it or take it out."*

   It was pinned under the list whether or not anything had been typed, so on an
   empty search it offered to create a value it had no name for and answered the
   click with nothing. It was taken out, and then — 2026-09-29, once the whole
   step became dimension cards — asked back: *"there should be an option to add
   new value on the go... similar to create new dimension"*. So the row stands
   again, at the top of the list this time, and what changed is that it now has
   somewhere to go. Typed, the name is the whole of a value and it is made on the
   spot; untyped, the row opens a form that asks for the name. Either way the
   click lands, which is the whole of the original complaint.

   In a browser because that complaint was that a click did nothing: the row is in
   the markup either way, so only a real click can tell the two apart. */

const ACCOUNT = 'Operating - Chase Bank'

async function openEditor(page: Page) {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.getByText(ACCOUNT, { exact: true }).first().click()
  await page.getByRole('button', { name: 'Add dimension' }).click()
  await expect(page.getByText('Values for this account')).toBeVisible()
}

const picker = (page: Page, dimension: string) =>
  page.getByRole('button', { name: `${dimension} value for this account` })

const search = (page: Page) => page.getByPlaceholder(/^Search /)

/* The dimensions the editor is answering for, in the order it draws them. Read
   off the value pickers rather than the cards' remove buttons: the detail page
   behind the modal has removable widgets of its own, and a card whose dimension
   is still unpicked names no dimension yet - which is the right answer, since
   the account does not carry it until it does. */
const carried = (page: Page) =>
  page.getByRole('button', { name: / value for this account$/ }).evaluateAll(els =>
    els.map(el => (el.getAttribute('aria-label') ?? '').replace(/ value for this account$/, '')))

/* One account, several values of one dimension - used in Singapore and in the
   USA. Design review, 2026-09-30. */
test('takes more than one value for a dimension, each removable', async ({ page }) => {
  await openEditor(page)
  const chips = page.locator('[data-dimension-values] > span')
  const before = await chips.count()
  // The list stays open while values are ticked (Mahad, 2026-10-02).
  await picker(page, 'Location').click()
  await page.locator('[role="option"][aria-selected="false"]').first().click()
  await expect(chips).toHaveCount(before + 1)
  await page.locator('[role="option"][aria-selected="false"]').first().click()
  await expect(chips).toHaveCount(before + 2)
  const last = (await chips.last().innerText()).trim()
  await page.getByRole('button', { name: `Remove ${last}` }).click()
  await expect(chips).toHaveCount(before + 1)
})

test.describe('creating a value from the picker', () => {
  test('stands above the list before anything is typed, naming no value it has not got', async ({ page }) => {
    await openEditor(page)
    await picker(page, 'Location').click()
    await expect(search(page)).toBeVisible()

    const create = page.getByRole('button', { name: 'Create new Location value' })
    await expect(create).toBeVisible()
    // Above the list it is a way out of, not under the failure to scroll past.
    const [createY, firstOptionY] = await Promise.all([
      create.boundingBox().then(b => b!.y),
      page.getByRole('option').first().boundingBox().then(b => b!.y),
    ])
    expect(createY).toBeLessThan(firstOptionY)
  })

  test('asks for a name when it was clicked without one, and answers the row with it', async ({ page }) => {
    await openEditor(page)
    await picker(page, 'Location').click()
    await page.getByRole('button', { name: 'Create new Location value' }).click()

    // The click lands somewhere, which is the whole of the 2026-09-23 complaint.
    const field = page.getByRole('textbox').last()
    await expect(field).toBeVisible()
    await field.fill('Zurich')
    await page.getByRole('button', { name: 'Add value', exact: true }).click()

    // Taken on as a chip under the picker, which stays free for the next one.
    await expect(page.locator('[data-dimension-values]')).toContainText('Zurich')
  })

  test('will not make one the dimension already holds', async ({ page }) => {
    await openEditor(page)
    await picker(page, 'Location').click()
    await page.getByRole('button', { name: 'Create new Location value' }).click()
    await page.getByRole('textbox').last().fill('USA')
    await expect(page.getByText('Location already has this value.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add value', exact: true })).toBeDisabled()
  })

  test('offers the typed name, and picking it adds the value and answers the row', async ({ page }) => {
    await openEditor(page)
    await picker(page, 'Location').click()
    await search(page).fill('Berlin')

    // Typed, the name is the whole record, so no form stands between the two.
    const create = page.getByRole('button', { name: 'Create "Berlin"' })
    await expect(create).toBeVisible()
    await create.click()

    // The click has to land twice over: the value joins the dimension, and the
    // row it was typed on is now answered with it.
    await expect(page.locator('[data-dimension-values]')).toContainText('Berlin')
    // The list stays open, with the new value in it, ticked.
    await expect(page.getByRole('option', { name: 'Berlin' })).toHaveAttribute('aria-selected', 'true')
  })

  test('stops naming what was typed once the dimension already holds it', async ({ page }) => {
    await openEditor(page)
    await picker(page, 'Location').click()
    await search(page).fill('usa')
    await expect(page.getByRole('option', { name: 'USA' })).toBeVisible()
    // The standing offer remains - it is a way to make a new one, not a second
    // USA - but it stops claiming it would create what is already there.
    await expect(page.getByRole('button', { name: /^Create "/ })).toHaveCount(0)
  })
})

/* Mahad, 2026-09-23: *"When you add a dimension from one account, it shows up on
   every account. User thought it got applied to all of them."*

   That used to be answered by labelling: a table listing every dimension the
   tenant had defined, split under "Set on this account" and "Available, not
   applied". The cards answer it by construction - only what the account carries
   is drawn - so what these now guard is that the two stay distinct: carried is a
   card, merely available is an option inside the dropdown, and nothing else. */
test.describe('what this account carries, against what it could', () => {
  test('draws a card only for what the account carries', async ({ page }) => {
    await openEditor(page)
    expect(await carried(page)).toEqual(['Location'])
    // Available everywhere, applied here to nothing: no card, and no field
    // sitting on the account waiting to be misread as answered.
    await expect(picker(page, 'Department')).toHaveCount(0)
  })

  test('keeps the ones it does not carry inside the dropdown, and takes one on', async ({ page }) => {
    await openEditor(page)
    await page.getByRole('button', { name: 'Add another dimension' }).click()

    const chooser = page.getByRole('button', { name: 'Dimension 2', exact: true })
    await chooser.click()
    // The one already carried is not offered twice - two cards for Location
    // would be two answers to one question.
    await expect(page.getByRole('option', { name: 'Location' })).toHaveCount(0)
    await page.getByRole('option', { name: 'Department' }).click()

    await picker(page, 'Department').click()
    await page.getByRole('option', { name: 'Design' }).click()
    expect(await carried(page)).toEqual(['Location', 'Department'])
  })

  test('hands one back when its card is removed', async ({ page }) => {
    await openEditor(page)
    await page.getByRole('button', { name: 'Remove Location', exact: true }).click()

    /* The last card goes too - an account carrying no dimensions is a legal
       account, so what is left is the empty state rather than a stuck row. */
    expect(await carried(page)).toEqual([])
    await expect(page.getByText('No dimensions on this account')).toBeVisible()

    // And what was removed is offered again, rather than being spent.
    await page.getByRole('button', { name: 'Add a dimension' }).click()
    await page.getByRole('button', { name: 'Dimension 1', exact: true }).click()
    await expect(page.getByRole('option', { name: 'Location' })).toBeVisible()
  })
})
