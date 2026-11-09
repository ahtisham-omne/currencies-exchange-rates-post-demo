import { test, expect, type Page } from '@playwright/test'

/* Every How it works panel is one component, ReadingRoom, and its sections open
   on a `0fr → 1fr` grid row whose body sits in an overflow-hidden box. The body
   carried a -6px top margin inside that box, which lifted its first line past
   the box's top edge and cut it off in every open section of every guide.
   Mahad, 2026-10-09: *"whenever I open any 'How It Works' accordion, the top few
   lines are getting slightly cut off."* Only a real render can see this: the
   markup is the same either way. */

// How far the first line of each section, opened in turn, sits above the box
// that clips it. Positive means part of the line is cut off.
async function cuts(page: Page) {
  const panel = page.locator('.coa-sheet').filter({ has: page.getByLabel('Search this guide') })
  const heads = panel.locator('.coa-guide-head')
  const out: { title: string; cut: number }[] = []
  for (let i = 0; i < await heads.count(); i++) {
    const head = heads.nth(i)
    if ((await head.getAttribute('aria-expanded')) !== 'true') await head.click()
    // Past the 240ms open, so the row has reached the body's full height.
    await page.waitForTimeout(350)
    out.push(await head.evaluate(btn => {
      const clip = btn.parentElement!.querySelector('.overflow-hidden')!
      const walker = document.createTreeWalker(clip, NodeFilter.SHOW_TEXT, { acceptNode: t => (t.textContent!.trim() ? 1 : 3) })
      const range = document.createRange()
      range.selectNodeContents(walker.nextNode()!)
      return { title: btn.textContent!.trim(), cut: clip.getBoundingClientRect().top - range.getClientRects()[0].top }
    }))
  }
  return out
}

const expectNoneCut = async (page: Page) => {
  const sections = await cuts(page)
  expect(sections.length).toBeGreaterThan(1)
  for (const s of sections) expect(s.cut, s.title).toBeLessThanOrEqual(0)
}

test('the chart page guide shows the first line of every section', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'How it works' }).first().click()
  await expectNoneCut(page)
})

test('the dimensions page guide shows the first line of every section', async ({ page }) => {
  await page.goto('/dimensions', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Learn' }).click()
  await expectNoneCut(page)
})

test('the import guide shows the first line of every section', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Actions' }).first().click()
  await page.getByRole('menuitem', { name: /Import/ }).or(page.getByRole('button', { name: /^Import/ })).first().click()
  const skip = page.getByRole('button', { name: /Skip for now/i })
  await skip.first().waitFor({ timeout: 3000 }).then(() => skip.first().click(), () => {})
  await page.getByRole('button', { name: 'How it works' }).last().click()
  await expectNoneCut(page)
})
