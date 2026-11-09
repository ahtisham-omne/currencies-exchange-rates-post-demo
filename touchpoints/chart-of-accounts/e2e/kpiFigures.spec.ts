import { test, expect } from '@playwright/test'

/* The Net income and Gross profit cards carry a stamp naming the month they
   add up. When it read "Year to date through <month>" it was wider than the
   room beside the amount on most screens, and it
   used to keep its width and squeeze the amount to a sliver. Mahad, 2026-10-07:
   *"There seems to be a bug in these two KPIs."* The amount is never cut now;
   the stamp goes under it, and every card in the row keeps one height.
   Measured in the browser, because a truncated figure is still in the markup. */

// 1000 to 1440 are the widths the retest of 2026-10-07 saw cut.
for (const width of [1000, 1100, 1280, 1440, 1600, 1920]) {
  test(`shows Net income and Gross profit whole at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
    for (const label of ['Net income', 'Gross profit']) {
      const card = page.locator('div.rounded-lg', { has: page.getByText(label, { exact: true }) }).last()
      const amount = card.locator('p.text-15')
      await expect(amount).toHaveText(/\$ [\d,]+/)
      const [shown, needed] = await amount.evaluate(el => [el.clientWidth, el.scrollWidth])
      expect(needed - shown, `${label} is cut`).toBeLessThanOrEqual(1)
      // The month alone (Mahad, 2026-10-10: *"for example 'August 2026.'"*).
      await expect(card.getByText(/^[A-Z][a-z]+ \d{4}$/)).toBeVisible()
    }
    // One row, one height.
    const heights = await page.evaluate(() => {
      const grid = [...document.querySelectorAll('div.grid')].find(g => g.textContent?.includes('Net income'))!
      const rows: Record<number, number[]> = {}
      for (const c of grid.children) { const r = c.getBoundingClientRect(); (rows[Math.round(r.top)] ??= []).push(Math.round(r.height)) }
      return Object.values(rows)
    })
    for (const row of heights) expect(new Set(row).size).toBe(1)
  })
}
