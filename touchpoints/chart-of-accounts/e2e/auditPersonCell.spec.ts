import { test, expect, type Page } from '@playwright/test'

/* The Created by and Last updated by cells, drawn the Partners way (Mahad,
   2026-10-05: *"Make sure we are using the same UI here as partners module."*).
   Ported from the Partners listing's Created By / Last Updated By cells: a
   pastel-tinted avatar in a hairline ring (or the person's photo), 32px with the
   name at 14px in Condensed, 40px with the name at 13px/500 and the role under it
   in Comfort, and a dark-header contact card on hovering the avatar.

   Pinned in the browser because each claim is about what renders: the size, the
   tint, the card - and that turning the column on never makes a row taller. */

const headers = (page: Page) =>
  page.$$eval('thead tr th', ths => ths.map(t => (t as HTMLElement).innerText.trim().split('\n')[0]))

async function showColumns(page: Page, keys: string[]) {
  for (const key of keys) {
    await page.getByRole('button', { name: /^Columns/ }).first().click()
    await page.locator(`[data-col-key="${key}"]`).getByTitle(/^(Hide|Show) column$/).click()
    await page.getByRole('button', { name: 'Close columns' }).click()
  }
}

async function comfort(page: Page) {
  await page.locator('button.fr-tool-btn').filter({ hasText: /Condensed|Comfort/ }).first().click()
  await page.getByText(/^Comfort$/).first().click()
  await page.keyboard.press('Escape')
}

const rowHeights = (page: Page) =>
  page.$$eval('tbody tr', rs => rs.slice(0, 12).map(r => Math.round(r.getBoundingClientRect().height)))

async function personCell(page: Page, rowText: string, header: string) {
  const at = (await headers(page)).indexOf(header)
  expect(at, `${header} is on screen`).toBeGreaterThan(-1)
  return page.locator('tbody tr', { hasText: rowText }).first().locator('td').nth(at)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
})

test('draws the Partners avatar and name in Condensed', async ({ page }) => {
  await showColumns(page, ['createdBy', 'updatedBy'])
  const cell = await personCell(page, 'Petty Cash', 'Created by')
  const avatar = cell.locator('[data-person-avatar] > div')
  const look = await avatar.evaluate(el => {
    const s = getComputedStyle(el)
    const ini = el.querySelector('span')!
    return { w: el.getBoundingClientRect().width, radius: s.borderRadius, border: s.border, bg: s.backgroundColor, ini: getComputedStyle(ini).color, weight: getComputedStyle(ini).fontWeight }
  })
  expect(look.w).toBe(32)
  expect(look.border).toBe('1px solid rgb(232, 236, 241)')
  // A pastel tint with slate initials, not the old solid colour with white ones.
  expect(look.bg).not.toBe('rgba(0, 0, 0, 0)')
  expect(look.ini).toBe('rgb(51, 65, 85)')
  expect(look.weight).toBe('700')
  const name = cell.getByText('Marcus Lee', { exact: true })
  expect(await name.evaluate(el => getComputedStyle(el).fontSize)).toBe('14px')
  // Condensed names the person and nothing else.
  await expect(cell).toHaveText('MLMarcus Lee')
})

test('grows to 40px and adds the role in Comfort', async ({ page }) => {
  await comfort(page)
  await showColumns(page, ['createdBy'])
  const cell = await personCell(page, 'Petty Cash', 'Created by')
  expect((await cell.locator('[data-person-avatar] > div').boundingBox())!.width).toBe(40)
  const name = cell.getByText('Marcus Lee', { exact: true })
  expect(await name.evaluate(el => [getComputedStyle(el).fontSize, getComputedStyle(el).fontWeight])).toEqual(['13px', '500'])
  await expect(cell.getByText('Accountant', { exact: true })).toBeVisible()
})

test('opens the contact card on hovering the avatar, and closes it on leaving', async ({ page }) => {
  await showColumns(page, ['createdBy'])
  const cell = await personCell(page, 'Petty Cash', 'Created by')
  await cell.locator('[data-person-avatar]').hover()
  const card = page.locator('[data-person-card]')
  await expect(card).toBeVisible()
  await expect(card).toContainText('Marcus Lee')
  await expect(card).toContainText('Accountant')
  await expect(card).toContainText('marcus.lee@omnesoft.com')
  await expect(card).toContainText('Accounting')
  // Its layout width: the box itself is still scaling in from 95%.
  expect(await card.evaluate(el => (el as HTMLElement).offsetWidth)).toBe(280)
  await page.mouse.move(5, 5)
  await expect(card).toHaveCount(0)
})

test('never makes a row taller, in either density or grid', async ({ page }) => {
  // Six page loads, each measured twice.
  test.setTimeout(90_000)
  const grids: [string, string | null, string[]][] = [
    ['/chart-of-accounts', null, ['createdBy', 'updatedBy']],
    ['/general-ledger', 'Journal entries', ['createdBy', 'updatedBy']],
    ['/general-ledger', 'General ledger', ['createdBy', 'updatedBy']],
  ]
  for (const [url, tab, keys] of grids) {
    for (const dense of [true, false]) {
      await page.goto(url, { waitUntil: 'networkidle' })
      if (tab) await page.getByRole('button', { name: tab }).click()
      await page.waitForSelector('thead th')
      if (!dense) await comfort(page)
      // Open a few accounts on the ledger's tree, so posting rows are measured.
      const expand = page.locator('tbody button[aria-label="Expand"]')
      if (tab === 'General ledger') for (let i = 0; i < 3; i++) await expand.first().click()
      const before = await rowHeights(page)
      await showColumns(page, keys)
      await expect(page.locator('[data-person-avatar]').first()).toBeVisible()
      expect(await rowHeights(page), `${url} ${tab ?? ''} ${dense ? 'condensed' : 'comfort'}`).toEqual(before)
    }
  }
})
