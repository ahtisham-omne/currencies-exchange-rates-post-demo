import { test, expect, type Page } from '@playwright/test'

/* Mahad, 2026-09-22: *"the account column is too wide in the general ledger. I
   believe we need to truncate the names and this column should be resizable. Also,
   please also have a min width where there are still accounts that are readable."*

   Pinned in a browser because all three claims are about paint under a drag, and a
   source test can see none of them. The name truncates with a CSS ellipsis, so its
   text stays whole in the DOM however narrow the column gets - what changes is the
   width the span is painted at, which is why these assert geometry rather than text.

   The floor is the part that actually needed the test. The account cell packs the
   number and the posting count on either side of the name, both nowrap, so every
   pixel dragged off the column came out of the name between them: at the old flat
   60px floor the column still rendered, still passed a markup test, and read
   "1030 O". */

const GL_ACCOUNT = 'Operating - Chase Bank'

const colWidth = (page: Page, label: string) => page.evaluate((l) => {
  const th = Array.from(document.querySelectorAll('thead th'))
    .find(e => (e.textContent || '').trim().startsWith(l))
  return th ? Math.round(th.getBoundingClientRect().width) : null
}, label)

// Width the account *name* is actually painted at, which is what "readable" means
// here - the element keeps its full text either way.
const nameWidth = (page: Page) => page.evaluate((n) => {
  const el = document.querySelector(`span[title="${n}"]`)
  return el ? Math.round(el.getBoundingClientRect().width) : null
}, GL_ACCOUNT)

/* What the count beside the name currently reads, taken off the page. The seeded
   postings are dated against the calendar, so the number moves; what these tests
   are about is whether it is painted at all at a given column width. */
const postingCount = (page: Page) => page.evaluate((n) => {
  const sib = document.querySelector(`span[title="${n}"]`)?.nextElementSibling
  const text = sib?.textContent?.trim() ?? ''
  return /^· \d+ postings?$/.test(text) ? text : null
}, GL_ACCOUNT)

/** Drag the right edge of `label`'s header by `dx` (negative narrows it). */
async function dragEdge(page: Page, label: string, dx: number) {
  const box = await page.evaluate((l) => {
    const th = Array.from(document.querySelectorAll('thead th'))
      .find(e => (e.textContent || '').trim().startsWith(l))
    if (!th) return null
    const r = th.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  }, label)
  if (!box) throw new Error(`no header ${label}`)
  await page.mouse.move(box.x + box.w - 3, box.y + box.h / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.w - 3 + dx / 2, box.y + box.h / 2, { steps: 8 })
  await page.mouse.move(box.x + box.w - 3 + dx, box.y + box.h / 2, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(250)
}

test('a long account name truncates instead of setting the column width', async ({ page }) => {
  await page.goto('/general-ledger', { waitUntil: 'networkidle' })
  await expect(page.getByTitle(GL_ACCOUNT).first()).toBeVisible()

  // The column is narrower than the name it holds - so the name is being clipped,
  // not being allowed to dictate how much room the descriptive columns get.
  expect(await colWidth(page, 'Account')).toBe(280)
  const painted = await nameWidth(page)
  const whole = await page.evaluate((n) => {
    const el = document.querySelector(`span[title="${n}"]`) as HTMLElement
    return el ? el.scrollWidth : null
  }, GL_ACCOUNT)
  expect(whole!).toBeGreaterThan(painted!)
})

test('the account column resizes, and stops where a name still reads as a name', async ({ page }) => {
  await page.goto('/general-ledger', { waitUntil: 'networkidle' })
  await expect(page.getByTitle(GL_ACCOUNT).first()).toBeVisible()
  const count = await postingCount(page)
  expect(count).not.toBeNull()

  // It narrows on a drag at all - the thing that has to work before the floor matters.
  await dragEdge(page, 'Account', -50)
  expect(await colWidth(page, 'Account')).toBe(230)

  // Dragged past the floor it stops, rather than closing to the old 60px.
  await dragEdge(page, 'Account', -400)
  expect(await colWidth(page, 'Account')).toBe(210)

  /* And at that floor the name still holds most of the room going spare: the cell
     spends about 75 of its 178px on the disclosure, the five-digit number and their gaps, and
     the name takes what is left rather than yielding it to the posting count. With
     the count still in the row this rendered "1030 O". */
  expect(await nameWidth(page)).toBeGreaterThan(90)
  await expect(page.getByText(count!)).toHaveCount(0)
})

test('the account column widens again, bringing the posting count back', async ({ page }) => {
  await page.goto('/general-ledger', { waitUntil: 'networkidle' })
  await expect(page.getByTitle(GL_ACCOUNT).first()).toBeVisible()
  const count = await postingCount(page)
  expect(count).not.toBeNull()

  await dragEdge(page, 'Account', -400)
  await expect(page.getByText(count!)).toHaveCount(0)

  await dragEdge(page, 'Account', 200)
  expect(await colWidth(page, 'Account')).toBe(410)
  await expect(page.getByText(count!).first()).toBeVisible()
})

test('running balance keeps its header whole while debit and credit give up room', async ({ page }) => {
  await page.goto('/general-ledger', { waitUntil: 'networkidle' })
  // At least their floor: they print to the cent now, so a figure can widen them.
  expect(await colWidth(page, 'Debit')).toBeGreaterThanOrEqual(100)
  expect(await colWidth(page, 'Credit')).toBeGreaterThanOrEqual(100)

  /* Running balance is floored by its own label, not by its figures: the header is
     the widest thing in the column, so a narrower width would clip "Running balance"
     itself. It holds at 130 and refuses a drag below it. */
  expect(await colWidth(page, 'Running balance')).toBe(130)
  await dragEdge(page, 'Running balance', -80)
  expect(await colWidth(page, 'Running balance')).toBe(130)

  const header = page.getByRole('columnheader').filter({ hasText: 'Running balance' }).first()
  const clipped = await header.evaluate((el) => {
    const span = Array.from(el.querySelectorAll('span'))
      .find(s => s.textContent?.trim() === 'Running balance') as HTMLElement | undefined
    return span ? span.scrollWidth - span.clientWidth : null
  })
  expect(clipped).toBeLessThanOrEqual(0)
})

test('the list view bounds its account column too', async ({ page }) => {
  await page.goto('/general-ledger', { waitUntil: 'networkidle' })
  await page.getByText('Journal entries', { exact: true }).first().click()
  await expect(page.getByRole('columnheader').filter({ hasText: 'Journal entry' }).first()).toBeVisible()

  // Unpinned on this tab, it used to take the width of the longest name in the ledger.
  expect(await colWidth(page, 'Account')).toBe(280)
  await dragEdge(page, 'Account', -400)
  expect(await colWidth(page, 'Account')).toBe(210)
})
