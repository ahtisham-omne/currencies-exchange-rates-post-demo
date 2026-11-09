import { test, expect, type Page, type Locator } from '@playwright/test'

/* The chart survives a reload.

   Stakeholders read a demo that forgets everything as a demo of nothing, so the
   store now writes itself to IndexedDB and reads itself back on boot. IndexedDB
   rather than localStorage because the seeded store serializes to ~4.2MB - the
   11,499 demo transactions are almost all of it - and localStorage caps at ~5MB,
   which leaves no room for the entries a reader posts.

   Pinned against the running page because every claim here is about what is on
   screen *after a reload*, and a source-text test cannot reload anything. The
   partialize list in store.ts reads the same whether the saved blob is written,
   read back, or quietly dropped on a version bump. */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'Full view' }).last()

const field = (m: Locator, label: string) =>
  m.locator(`xpath=.//label[starts-with(normalize-space(.), "${label}")]/..`)

async function listing(page: Page) {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
}

/* Wait for the debounced write to land rather than sleeping past it. The store
   coalesces bursts on a 400ms trailing timer, so asserting straight after a save
   would race it - and a blind sleep would pass just as happily if the write never
   happened at all. The needle is matched inside the page so the 4.2MB blob does
   not cross back into node. */
async function savedStateHolds(page: Page, needle: string): Promise<boolean> {
  return page.evaluate(
    text =>
      new Promise<boolean>(resolve => {
        const req = indexedDB.open('omne-coa', 1)
        req.onsuccess = () => {
          const tx = req.result.transaction('state', 'readonly')
          const got = tx.objectStore('state').get('coa-store')
          got.onsuccess = () => resolve(typeof got.result === 'string' && got.result.includes(text))
          got.onerror = () => resolve(false)
        }
        req.onerror = () => resolve(false)
      }),
    needle,
  )
}

const waitForSave = async (page: Page, needle: string) =>
  expect.poll(() => savedStateHolds(page, needle), { timeout: 5_000 }).toBe(true)

// The listing's tally, "N of M accounts". M is the whole set including archived
// and never moves with a filter, so a new account has to raise it.
const tally = (page: Page) => page.locator('span.tabular-nums').filter({ hasText: /of .* accounts/ }).first()

/* The form is a stepper and the steps between details and the preview vary with
   what has been answered, so the walk forward is "Continue until the button that
   commits appears" rather than a fixed number of clicks. Scoped to the modal
   throughout: the page's own "Create GL account" header button sits behind the
   overlay and matches the same text. */
async function createAccount(page: Page, number: string, name: string) {
  await listing(page)
  await page.getByRole('button', { name: /Create GL account/ }).click()
  const m = modal(page)
  await m.getByRole('button', { name: /Continue/ }).first().click()
  await m.getByText('GL account details').first().waitFor()

  await field(m, 'GL account type').locator('button[aria-haspopup="listbox"]').click()
  await page.getByRole('option', { name: 'Posting', exact: true }).click()
  // The form no longer picks a parent (Mahad, 2026-10-08).
  await field(m, 'Parent').locator('button[aria-haspopup="listbox"]').first().click()
  await page.getByRole('option', { name: /11000/ }).first().click()
  await field(m, 'GL account no.').locator('input').fill(number)
  await field(m, 'GL account name').locator('input').fill(name)

  const commit = m.getByRole('button', { name: 'Create account', exact: true })
  for (let step = 0; step < 6 && !(await commit.count()); step++) {
    await m.getByRole('button', { name: /^Continue$/ }).first().click()
    await page.waitForTimeout(120)
  }
  await commit.click()
  await expect(modal(page)).toHaveCount(0)
}

test.describe('an account a reader created', () => {
  test('is still there on a fresh load', async ({ page }) => {
    await createAccount(page, '1375', 'Persisted probe account')
    await waitForSave(page, 'Persisted probe account')

    await listing(page)
    await expect(page.getByText('Persisted probe account').first()).toBeVisible()
  })

  /* The count has to come back too, not just the row. The denominator is the
     whole account set and is derived from the same array the table draws, so a
     restore that rebuilt one without the other would show a row the tally does
     not admit exists. */
  test('is counted in the tally on a fresh load', async ({ page }) => {
    await listing(page)
    const before = await tally(page).innerText()
    const total = Number(before.match(/of ([\d,]+) accounts/)![1].replace(/,/g, ''))

    await createAccount(page, '1376', 'Counted probe account')
    await waitForSave(page, 'Counted probe account')

    await listing(page)
    await expect(tally(page)).toContainText(`of ${total + 1} accounts`)
  })
})

/* Two slices are deliberately left out of the save, and both are the kind of
   thing that only shows itself on the reload after. */
test.describe('what a reload deliberately forgets', () => {
  /* A toast announces something that just happened. Saved and replayed, it would
     announce it again every time the reader opened the app, days later. */
  test('does not replay the toast from the last visit', async ({ page }) => {
    await createAccount(page, '1377', 'Toast probe account')
    await expect(page.getByText(/created successfully/i).first()).toBeVisible()
    await waitForSave(page, 'Toast probe account')

    await listing(page)
    await expect(page.getByText('Toast probe account').first()).toBeVisible()
    await expect(page.getByText(/created successfully/i)).toHaveCount(0)
  })
})

/* Reset is the way back to the chart as it ships. It reloads rather than setting
   state back to the seed, because seed.ts dates its demo history from the day it
   is evaluated - so only a fresh load puts those postings against today. */
test('Reset demo data restores the seeded chart', async ({ page }) => {
  await createAccount(page, '1378', 'Discarded probe account')
  await waitForSave(page, 'Discarded probe account')
  await listing(page)
  await expect(page.getByText('Discarded probe account').first()).toBeVisible()

  await page.getByRole('button', { name: /Reset demo data/ }).click()
  await page.getByRole('button', { name: /^Reset demo data$/ }).last().click()

  await page.waitForSelector('thead th')
  await expect(page.getByText('Discarded probe account')).toHaveCount(0)
  await expect.poll(() => savedStateHolds(page, 'Discarded probe account')).toBe(false)
})
