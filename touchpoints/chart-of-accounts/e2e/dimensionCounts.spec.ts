import { test, expect, type Page } from '@playwright/test'

/* Mahad, 2026-10-13: *"when I select a location it shows me departments ... I
   click on engineering which shows me that it has 4 accounts, you can see that
   the table shows no accounts."* With a Location ticked, every Department count
   is what ticking that department shows. */

const panel = (page: Page) => page.locator('body > div').filter({ hasText: 'Show accounts carrying any of the values you tick.' }).last()
const values = (page: Page) => panel(page).locator('div[class*="max-h-[264px]"] > button')
const countOf = async (row: ReturnType<Page['locator']>) => Number((await row.locator('span.tabular-nums').innerText()).replace(/,/g, ''))
const empty = (page: Page) => page.getByText('No accounts match these filters')

test('with a location ticked, each department count is what ticking it shows', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
  await page.getByRole('button', { name: 'Filter by dimension' }).click()
  await panel(page).getByRole('button', { name: /^Location/ }).click()
  // The first location that holds any account.
  const locs = values(page)
  let picked = ''
  for (let i = 0; i < await locs.count(); i++) {
    if (await countOf(locs.nth(i)) > 0) { picked = (await locs.nth(i).locator('span.truncate').innerText()).trim(); await locs.nth(i).click(); break }
  }
  expect(picked).not.toBe('')

  await panel(page).getByRole('button', { name: /^Department/ }).click()
  const depts = values(page)
  const seen: string[] = []
  for (let i = 0; i < await depts.count(); i++) {
    const row = depts.nth(i)
    const name = (await row.locator('span.truncate').innerText()).trim()
    const n = await countOf(row)
    seen.push(`${name} ${n}`)
    await row.click()
    if (n > 0) await expect(empty(page), `${picked} + ${name} reads ${n}`).toHaveCount(0)
    else await expect(empty(page), `${picked} + ${name} reads 0`).toBeVisible()
    if (name === 'Engineering') await page.screenshot({ path: '/private/tmp/claude-501/-Users-mahad-Documents-Chart-of-Accounts-chart-of-accounts-v2-1/2c6fbcd7-160c-43c6-ac48-a99e1668ca44/scratchpad/dim-engineering.png' })
    await row.click()
  }
  console.log(picked, seen.join(', '))
})
