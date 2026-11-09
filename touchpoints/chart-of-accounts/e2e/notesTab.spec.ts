import { test, expect, type Page } from '@playwright/test'

/* The Notes tab on every detail page that has one. Mahad, 2026-10-06: *"Here
   is the notes tab design. Please implement this in all the notes tab in
   detail pages."* "Add a note" over a text box and its button, then the notes
   as cards, newest first, each with its author, its time and a bin. */

const tab = (page: Page) => page.getByRole('button', { name: /^Notes/ }).first()
const box = (page: Page) => page.getByRole('textbox', { name: 'Add a note' })
const add = (page: Page) => page.getByRole('button', { name: 'Add Note', exact: true })
const notes = (page: Page) => page.locator('[data-note]')

async function openAccount(page: Page, id: string) {
  await page.goto(`/chart-of-accounts/${id}`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Activity', exact: true }).first().waitFor()
  await tab(page).click()
}

test('an account lists its notes, newest first, with who wrote each and when', async ({ page }) => {
  await openAccount(page, 'acct_11130')
  await expect(page.getByText('Add a note', { exact: true })).toBeVisible()
  await expect(box(page)).toHaveAttribute('placeholder', 'Write a note about this account...')
  await expect(notes(page)).toHaveCount(3)
  const first = notes(page).first()
  await expect(first).toContainText('statement cut-off')
  await expect(first).toContainText('Ayesha Khan')
  await expect(first).toContainText(/[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2} [AP]M/)
  // The role a seeded name carries is not printed.
  await expect(first).not.toContainText('(Controller)')
  await page.locator('[data-notes-tab]').screenshot({ path: 'test-results/notes-tab.png' })
})

test('adds a note at the top, counts it, and clears the box', async ({ page }) => {
  await openAccount(page, 'acct_11130')
  await expect(add(page)).toBeDisabled()
  await box(page).fill('   ')
  await expect(add(page)).toBeDisabled()
  await box(page).fill('Bank fee schedule changes in January.\nCheck the first statement.')
  await add(page).click()
  await expect(notes(page)).toHaveCount(4)
  await expect(notes(page).first()).toContainText('Bank fee schedule changes in January.')
  await expect(notes(page).first()).toContainText('Ahtisham Ahmad')
  await expect(box(page)).toHaveValue('')
  await expect(tab(page)).toContainText('4')
})

test('deletes a note, and Undo puts it back where it was', async ({ page }) => {
  await openAccount(page, 'acct_11130')
  const second = notes(page).nth(1)
  await expect(second).toContainText('wires to Meridian')
  await second.getByRole('button', { name: 'Delete note' }).click()
  await expect(notes(page)).toHaveCount(2)
  await expect(page.getByText('wires to Meridian')).toHaveCount(0)
  await expect(tab(page)).toContainText('2')
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(notes(page)).toHaveCount(3)
  await expect(notes(page).nth(1)).toContainText('wires to Meridian')
})

/* Every record opens with notes, as one in use would (Mahad, 2026-10-06: *"Can
   we have dummy data as well?"*), and takes more. */
test('a summary account and a journal entry open with notes, and take more', async ({ page }) => {
  await openAccount(page, 'acct_11000')
  await expect(box(page)).toBeVisible()
  const before = await notes(page).count()
  expect(before).toBeGreaterThanOrEqual(2)
  await expect(tab(page)).toContainText(String(before))
  // Cmd or Ctrl + Enter adds it.
  await box(page).fill('Cash summary reviewed for the quarter.')
  await box(page).press('ControlOrMeta+Enter')
  await expect(notes(page)).toHaveCount(before + 1)
  await expect(notes(page).first()).toContainText('Cash summary reviewed for the quarter.')
  await expect(tab(page)).toContainText(String(before + 1))

  await page.goto('/general-ledger', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Journal entries', exact: true }).first().click()
  await page.locator('tbody tr button[title="Open journal entry"]').first().click()
  await page.waitForURL(/\/general-ledger\/entry\//)
  await tab(page).click()
  await expect(box(page)).toHaveAttribute('placeholder', 'Write a note about this journal entry...')
  const onEntry = await notes(page).count()
  expect(onEntry).toBeGreaterThanOrEqual(2)
  await expect(tab(page)).toContainText(String(onEntry))
  await page.locator('[data-notes-tab]').screenshot({ path: 'test-results/notes-entry.png' })
  await box(page).fill('Matches the supplier statement.')
  await add(page).click()
  await expect(notes(page)).toHaveCount(onEntry + 1)
})

test('a note it opened with stays deleted, and comes back with Undo', async ({ page }) => {
  await openAccount(page, 'acct_11000')
  const first = (await notes(page).first().innerText()).split('\n')[0]
  const count = await notes(page).count()
  await notes(page).first().getByRole('button', { name: 'Delete note' }).click()
  await expect(notes(page)).toHaveCount(count - 1)
  // Away and back: still gone.
  await page.getByRole('button', { name: 'Activity', exact: true }).first().click()
  await tab(page).click()
  await expect(notes(page)).toHaveCount(count - 1)
  await expect(page.getByText(first, { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(notes(page)).toHaveCount(count)
})

/* Drawn to the design's measurements (Mahad, 2026-10-06: *"Please make it as it
   is in the screenshot I attached."*): read at the 1600px viewport, where the
   module's root font is the design's 16px. */
test('is drawn to the design\'s measurements', async ({ page }) => {
  await openAccount(page, 'acct_11110')
  const size = (sel: string) => page.locator(sel).first().evaluate(el => { const r = el.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)] })
  expect(await size('[data-notes-tab] textarea')).toEqual([600, 85])
  expect((await size('[data-note]'))[0]).toBe(600)
  expect(await add(page).evaluate(el => [Math.round(el.getBoundingClientRect().height), getComputedStyle(el).fontWeight])).toEqual([36, '600'])
  const avatar = notes(page).first().locator('span.rounded-full')
  expect(await avatar.evaluate(el => [el.getBoundingClientRect().width, getComputedStyle(el).backgroundColor])).toEqual([24, 'rgb(238, 244, 251)'])
  const text = notes(page).first().locator('p')
  expect(await text.evaluate(el => [getComputedStyle(el).fontSize, getComputedStyle(el).lineHeight])).toEqual(['14px', '22.75px'])
})

test('a note carried over from where the record came from wears its chip', async ({ page }) => {
  // 11110 Petty Cash arrived by import, so it brings the note it was imported with.
  await openAccount(page, 'acct_11110')
  await expect(page.locator('[data-note-tag]')).toHaveText(['Import Note'])
  // An entry raised by a vendor invoice brings that invoice's note.
  await page.goto('/general-ledger', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Journal entries', exact: true }).first().click()
  await page.locator('tbody tr').filter({ hasText: 'Vendor Invoice' }).locator('button[title="Open journal entry"]').first().click()
  await page.waitForURL(/\/general-ledger\/entry\//)
  await tab(page).click()
  await expect(page.locator('[data-note-tag]')).toHaveText(['Vendor Invoice Note'])
})
