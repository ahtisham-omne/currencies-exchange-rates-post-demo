import { test, expect, type Page } from '@playwright/test'

/* A walkthrough lights only what the reader can see. Mahad, 2026-10-07, on
   guided setup outside full view: *"The spotlight is going beyond the modal."*
   The question panel scrolls inside the modal, so the questions it lights run
   on below the panel's edge; the spotlight is clipped to every ancestor that
   clips them, and to the window. */

const spot = (page: Page) => page.evaluate(() => {
  const el = [...document.querySelectorAll<HTMLElement>('div')].find(d => d.style.boxShadow.includes('9999px'))
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }
})

test('guided setup: the questions tour stays inside the panel it lights', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /View as first-time user/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Start guided setup' }).click()
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.getByRole('button', { name: 'Continue' }).last().click()
  await expect(page.getByText('Tell us about your business').last()).toBeVisible()
  await page.getByRole('button', { name: /Start (walkthrough|tour)/ }).click()
  const card = page.getByRole('dialog', { name: 'Your business walkthrough' })
  await expect(card).toBeVisible()

  // The footer under the panel holds Back; the lit area ends above it.
  const back = await page.getByRole('button', { name: 'Back', exact: true }).last().boundingBox()
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(500)
    const s = await spot(page)
    if (s) {
      expect(s.bottom, `card ${i + 1} lights past the panel`).toBeLessThanOrEqual(back!.y + 1)
      expect(s.bottom).toBeLessThanOrEqual(800)
      expect(s.top).toBeGreaterThanOrEqual(0)
    }
    const next = card.getByRole('button', { name: 'Next' })
    if (!(await next.count())) break
    await next.click()
  }
})
