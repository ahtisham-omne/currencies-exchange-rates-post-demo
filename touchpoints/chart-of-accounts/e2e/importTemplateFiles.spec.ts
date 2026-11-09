import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/* The import template is Mahad's two files, handed out as they are (2026-10-02),
   and the importer reads what it hands out. */
const shipped = (name: string) => readFileSync(join(process.cwd(), 'public/templates', name))

async function openImport(page: Page) {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.locator('table tbody tr').first().waitFor()
  await page.getByRole('button', { name: 'Actions', exact: true }).click()
  await page.getByText('Import', { exact: true }).click()
  await page.locator('input[type=file]').waitFor({ state: 'attached' })
  // The import's walkthrough offers itself on opening; not this spec's subject.
  const skip = page.getByRole('button', { name: /^Skip/ }).first()
  await skip.waitFor({ timeout: 3000 }).then(() => skip.click()).catch(() => {})
  await expect(page.locator('[data-wizard-overlay]')).toHaveCount(0)
}

for (const [label, name] of [['Excel', 'chart-of-accounts-import-template.xlsx'], ['CSV', 'chart-of-accounts-import-template.csv']] as const) {
  test(`downloads the ${label} template exactly as supplied`, async ({ page }) => {
    await openImport(page)
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: label, exact: true }).click(),
    ])
    expect(download.suggestedFilename()).toBe(name)
    const path = await download.path()
    expect(readFileSync(path!).equals(shipped(name))).toBe(true)
  })
}

test('reads the CSV it hands out, and names its four examples', async ({ page }) => {
  await openImport(page)
  await page.locator('input[type=file]').setInputFiles({
    name: 'chart-of-accounts-import-template.csv', mimeType: 'text/csv',
    buffer: shipped('chart-of-accounts-import-template.csv'),
  })
  await expect(page.getByText('chart-of-accounts-import-template.csv')).toBeVisible()
  await page.getByRole('button', { name: 'Review data' }).click()
  await expect(page.getByText('Rows 2 to 5 look like the template examples.', { exact: false })).toBeVisible()
})
