import { test, expect } from '@playwright/test'

/* Mahad, 2026-10-08: every calendar's footer reads the same - Clear on the left
   in grey, red on hover; Today on the right in blue, on a light blue fill on
   hover. In a browser because hover colours only exist there. Opened on the
   communications filters, which used the browser's own date input until now. */

test('puts Clear left and Today right, and turns Clear red on hover', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/chart-of-accounts/acct_11130', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /^Communications/ }).first().click()
  await page.getByRole('button', { name: 'Filters' }).first().click()
  await page.getByRole('button', { name: 'From' }).click()
  const pop = page.locator('[data-date-popover]')
  await pop.getByRole('button', { name: '8', exact: true }).first().click()
  await page.getByRole('button', { name: 'From' }).click()
  await pop.waitFor()

  const clear = pop.getByRole('button', { name: 'Clear', exact: true })
  const today = pop.getByRole('button', { name: 'Today', exact: true })
  const c = (await clear.boundingBox())!
  const t = (await today.boundingBox())!
  expect(c.x).toBeLessThan(t.x)

  const style = (b: typeof clear) => b.evaluate(e => [getComputedStyle(e).color, getComputedStyle(e).backgroundColor])
  await clear.hover()
  // danger-600 on danger-50.
  await expect.poll(() => style(clear)).toEqual(['rgb(220, 38, 38)', 'rgb(254, 242, 242)'])
  await today.hover()
  await expect.poll(async () => (await style(today))[1]).toBe('rgba(10, 124, 255, 0.1)')
})
