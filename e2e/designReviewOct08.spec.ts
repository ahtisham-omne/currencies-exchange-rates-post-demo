import { test, expect, type Page } from '@playwright/test'

/* Design review, 2026-10-08: the How it works button, the error blink, and
   guided setup's questions and country list. Restricted account access is in
   restrictedAccess.spec.ts. */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'Full view' }).last()

test('How it works is the "i" button just before Create GL account', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  const how = page.getByRole('button', { name: 'How it works' })
  await expect(how).toBeVisible()
  await expect(how.locator('svg.lucide-info')).toHaveCount(1)
  await expect(how.locator('svg.lucide-circle-help, svg.lucide-help-circle')).toHaveCount(0)
  // Nothing stands between it and the primary action.
  const next = await how.evaluate(el => {
    let n = (el.closest('[data-tooltip-trigger]') ?? el) as Element | null
    const create = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Create GL account')!
    const a = el.getBoundingClientRect(), c = create.getBoundingClientRect()
    const between = [...document.querySelectorAll('header button, main button')].filter(b => {
      const r = b.getBoundingClientRect()
      return r.top < a.bottom && r.bottom > a.top && r.left >= a.right && r.right <= c.left
    })
    void n
    return { leftOfCreate: a.right <= c.left, between: between.length }
  })
  expect(next).toEqual({ leftOfCreate: true, between: 0 })
})

test('a refused Continue blinks the first field\'s own border', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Create GL account/ }).click()
  const m = modal(page)
  await m.getByRole('button', { name: /Continue/ }).first().click()
  await m.getByText('GL account details').first().waitFor()
  await m.getByRole('button', { name: /Continue/ }).first().click()
  const flash = m.locator('.form-error-flash')
  await expect(flash).toHaveCount(1)
  // The bordered control itself, not the block around its label and message.
  await expect(flash).toHaveClass(/\binput\b/)
  await expect(flash.locator('label')).toHaveCount(0)
  // After the blink it stays red, ring and all, though it has the focus.
  await expect(flash).toHaveCount(0, { timeout: 3000 })
  const field = m.locator('xpath=.//label[starts-with(normalize-space(.), "GL account type")]/..').locator('button[aria-haspopup="listbox"]')
  await expect(field).toBeFocused()
  const [border, shadow] = await field.evaluate(el => [getComputedStyle(el).borderTopColor, getComputedStyle(el).boxShadow])
  const red = await page.evaluate(() => { const p = document.createElement('div'); p.className = 'border-danger-500'; document.body.appendChild(p); const c = getComputedStyle(p).borderTopColor; p.remove(); return c })
  expect(border).toBe(red)
  expect(shadow).not.toBe('none')
  expect(shadow).toContain('4px')
})

async function guidedQuestions(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.locator('table tbody tr').first().waitFor()
  await page.getByRole('button', { name: /View as first-time user/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Start guided setup' }).click()
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.getByRole('button', { name: 'Continue' }).last().click()
  await page.getByRole('button', { name: 'Skip for now' }).click()
}

test('Continue on the questions says the accounting method is missing, and goes to it', async ({ page }) => {
  await guidedQuestions(page)
  const next = page.getByRole('button', { name: 'Continue' }).last()
  await expect(next).toBeEnabled()
  await next.click()
  await expect(page.locator('[data-step-summary]')).toContainText("You can't continue yet - 1 thing to fix.")
  await expect(page.locator('[data-step-summary]')).toContainText('Choose an accounting method.')
  await expect(page.locator('#guided-q-method [data-field-error]')).toHaveText('Choose an accounting method.')
  // Still on the questions.
  await expect(page.getByText('Tell us about your business').first()).toBeVisible()
})

test('the country list starts with the United States', async ({ page }) => {
  await guidedQuestions(page)
  const box = page.locator('#guided-q-country button[aria-haspopup]').first()
  await box.scrollIntoViewIfNeeded()
  await box.click()
  await expect(page.getByRole('option').first()).toContainText('United States')
})

/* One backdrop behind every sheet and modal: the Customize insights panel's,
   25% black with no blur (Mahad, 2026-10-08). How it works used to wash the page
   white and blur it; Create GL account and Filters blurred a darker tint. */
test('How it works, Create GL account and Filters dim the page as Customize insights does', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  const scrim = () => page.locator('.coa-scrim').last()
  const look = async () => scrim().evaluate(el => {
    const cs = getComputedStyle(el)
    return { bg: cs.backgroundColor, blur: cs.backdropFilter }
  })
  const expected = { bg: 'rgba(0, 0, 0, 0.25)', blur: 'none' }

  await page.getByRole('button', { name: 'How it works' }).click()
  await expect(page.getByRole('dialog', { name: 'Chart of accounts' })).toBeVisible()
  expect(await look()).toEqual(expected)
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: /Create GL account/ }).click()
  await modal(page).getByText('What kind of account is this?').first().waitFor()
  expect(await look()).toEqual(expected)
  await modal(page).getByRole('button', { name: 'Cancel', exact: true }).click()

  await page.getByRole('button', { name: /^Filters/ }).first().click()
  expect(await look()).toEqual(expected)
})
