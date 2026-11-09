import { test, expect, type Page, type Locator } from '@playwright/test'
import { settle, view } from './glPage'

/* The New journal entry form, as the design review of 2026-09-28 left it.

   - Memo is the design system's text box: an input's height to begin with, and
     growing with the text rather than scrolling inside itself.
   - No "Prior period adjustment" switch. Retained earnings and the control
     accounts are offered like any account, and picking one is what brings up
     the adjustment flow - a reason, the document behind it, and who to tell.
   - Any entry can notify someone, with the notification picker the rest of Omne
     uses, and the notification lands on the entry's Communications tab.

   Replaces priorPeriodAdjustment.spec.ts, which pinned the switch this removed. */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'New journal entry' }).last()

/* Retained earnings is a summary (32000) over the system account the close
   posts to (32100) and the manual adjustments account hand corrections go to
   (32200). 11310 is a receivables control account, 11180 one of the rows the
   seed ships archived, and 52110 / 11130 two ordinary accounts. */
const RETAINED_EARNINGS = '32200'
const RETAINED_EARNINGS_SYSTEM = '32100'
const CONTROL = '11310'
const ARCHIVED = '11180'
const DEACTIVATED = '53020'

async function openEntry(page: Page) {
  await settle(page, '/general-ledger')
  await page.getByRole('button', { name: 'New journal entry' }).first().click()
  const m = modal(page)
  await m.getByText('Journal lines').first().waitFor()
  return m
}

const linePicker = (m: Locator, row = 0) => m.locator('table button[aria-haspopup="listbox"]').nth(row)

async function pickAccount(page: Page, m: Locator, row: number, number: string) {
  await linePicker(m, row).click()
  const list = page.getByRole('listbox').last()
  await list.getByPlaceholder('Search account by name or number').fill(number)
  // By its own number: another row's note can name this one (32100 says
  // "corrections go to 32200").
  await list.getByRole('option').filter({ hasText: `${number} · ` }).first().click()
  await expect(list).toHaveCount(0)
}

async function fillLine(page: Page, m: Locator, row: number, number: string, col: 'debit' | 'credit', amount: string) {
  await pickAccount(page, m, row, number)
  await m.locator('table').getByLabel(col, { exact: true }).nth(row).fill(amount)
}

/* Whether the first line's picker offers this account, and how it labels it. */
async function offered(page: Page, m: Locator, number: string) {
  await linePicker(m).click()
  const list = page.getByRole('listbox').last()
  await list.getByPlaceholder('Search account by name or number').fill(number)
  const row = list.getByRole('option').filter({ hasText: `${number} · ` }).first()
  await expect(row).toBeVisible()
  const state = { label: (await row.innerText()).replace(/\s+/g, ' ').trim(), selectable: await row.isEnabled() }
  // Closed on the trigger rather than with Escape, which would close the entry.
  await linePicker(m).click()
  await expect(list).toHaveCount(0)
  return state
}

/* Whether an account is in the open list at all, by number. */
async function listed(page: Page, m: Locator, number: string) {
  await linePicker(m).click()
  const list = page.getByRole('listbox').last()
  await list.getByPlaceholder('Search account by name or number').fill(number)
  await page.waitForTimeout(150)
  const count = await list.getByRole('option').filter({ hasText: `${number} · ` }).count()
  await linePicker(m).click()
  await expect(list).toHaveCount(0)
  return count > 0
}

async function pickRecipient(page: Page, scope: Locator, name: string) {
  await scope.getByRole('button', { name: /Add notification recipients|^Manage$/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Notification recipients' })
  await dialog.getByPlaceholder(/Search users/).fill(name.split(' ')[0])
  await dialog.getByRole('button', { name: new RegExp(name) }).first().click()
  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(dialog).toHaveCount(0)
}

test.describe('the memo', () => {
  test('starts at an input\'s height and grows with the text, never scrolling inside', async ({ page }) => {
    const m = await openEntry(page)
    const memo = m.getByLabel('Memo')
    expect(await memo.evaluate(el => el.tagName)).toBe('TEXTAREA')
    const start = (await memo.boundingBox())!.height
    expect(start).toBeLessThanOrEqual(40)

    await memo.fill('Reclassify the August state income tax accrual that was booked to the wrong department, after the controller reviewed the schedule and the payroll register for the month.')
    await expect.poll(async () => (await memo.boundingBox())!.height).toBeGreaterThan(start + 10)
    // All of it on screen: nothing hidden behind an inner scroll.
    expect(await memo.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true)

    await memo.fill('Short again')
    await expect.poll(async () => (await memo.boundingBox())!.height).toBeLessThanOrEqual(start + 1)
  })
})

/* No Description field. Design review, 2026-09-28 added one apart from the memo;
   Mahad, 2026-09-30, took it off the form: *"Remove this from New journal entry
   modal."* The entry is named the way an untitled manual entry always was, and
   the memo still reaches the entry page and the ledger. */
test.describe('no description field', () => {
  test('asks for nothing called Description', async ({ page }) => {
    const m = await openEntry(page)
    await expect(m.getByLabel('Description', { exact: true })).toHaveCount(0)
    await expect(m.getByText('It names the entry in the ledger')).toHaveCount(0)
    await expect(m.getByPlaceholder('e.g. August state income tax accrual')).toHaveCount(0)
  })

  test('titles the posted entry by its number, and keeps its memo', async ({ page }) => {
    const m = await openEntry(page)
    await m.getByLabel('Memo').fill('Landlord invoice arrives after month end')
    await fillLine(page, m, 0, '52110', 'debit', '300')
    await fillLine(page, m, 1, '11130', 'credit', '300')
    await m.getByRole('button', { name: 'Post journal entry' }).click()

    await page.waitForURL(/\/general-ledger\/entry\//)
    const je = decodeURIComponent(page.url().split('/entry/')[1])
    await expect(page.locator('h1').first()).toHaveText(je)
    await expect(page.getByText('Landlord invoice arrives after month end').first()).toBeVisible()

    await page.getByTitle('Back to General Ledger').first().click()
    await view(page, 'Journal entries').click()
    await page.getByPlaceholder('Search entries').fill(je)
    const row = page.locator('tr.gl-je-parent')
    await expect(row).toHaveCount(1)
    await expect(row).toContainText('Landlord invoice arrives after month end')
  })
})

test.describe('no switch in front of every entry', () => {
  test('opens with no prior period adjustment switch', async ({ page }) => {
    const m = await openEntry(page)
    await expect(m.getByText('Prior period adjustment')).toHaveCount(0)
    await expect(m.getByRole('switch')).toHaveCount(0)
    await expect(m.locator('[data-adjustment-flow]')).toHaveCount(0)
  })

  test('offers retained earnings and control accounts, marked, and leaves out archived and deactivated ones', async ({ page }) => {
    const m = await openEntry(page)
    const re = await offered(page, m, RETAINED_EARNINGS)
    expect(re.selectable).toBe(true)
    expect(re.label).toContain('Corrections to retained earnings')

    const ctl = await offered(page, m, CONTROL)
    expect(ctl.selectable).toBe(true)
    expect(ctl.label).toContain('Control account')

    // Mahad, 2026-10-08: no archived, deactivated or deleted accounts in the list.
    expect(await listed(page, m, ARCHIVED)).toBe(false)
    expect(await listed(page, m, DEACTIVATED)).toBe(false)
    expect(await listed(page, m, CONTROL)).toBe(true)
  })

  // The date no longer declares anything. A day in a month that has ended but is
  // still open is an ordinary entry; a closed month cannot be posted into at all.
  test('asks nothing extra for a date in a month that has already ended', async ({ page }) => {
    const m = await openEntry(page)
    await m.getByLabel('Date', { exact: true }).click()
    const cal = page.locator('[data-date-popover]')
    await cal.getByLabel('Year', { exact: true }).selectOption('2026')
    await cal.getByLabel('Month', { exact: true }).selectOption({ label: 'Jul' })
    await cal.getByRole('button', { name: '15', exact: true }).first().click()
    await expect(m.locator('[data-adjustment-flow]')).toHaveCount(0)
  })
})

test.describe('the adjustment flow', () => {
  test('appears when retained earnings is picked, and goes when it is changed', async ({ page }) => {
    const m = await openEntry(page)
    await pickAccount(page, m, 0, RETAINED_EARNINGS)
    const flow = m.locator('[data-adjustment-flow]')
    await expect(flow).toBeVisible()
    await expect(flow).toContainText('You\'re adjusting retained earnings')
    await expect(flow).toContainText('profit the business has kept')

    await pickAccount(page, m, 0, '52110')
    await expect(flow).toHaveCount(0)
  })

  test('names a control account when one is picked', async ({ page }) => {
    const m = await openEntry(page)
    await pickAccount(page, m, 0, CONTROL)
    await expect(m.locator('[data-adjustment-flow]')).toContainText('a control account')
  })

  // Mahad's copy, 2026-10-02.
  test('says what retained earnings is and why a reason is required', async ({ page }) => {
    const m = await openEntry(page)
    await expect(m.getByText('Each line can contain either a debit or a credit.', { exact: true })).toBeVisible()
    await expect(m.getByText(/Entering one disables the other field/)).toHaveCount(0)
    await fillLine(page, m, 0, RETAINED_EARNINGS, 'debit', '500')
    // The form describes the manual account the entry can reach, not the one
    // the close posts to (module review, 2026-10-06, COA-06).
    await expect(m.getByText('Manual GL Transactions is where corrections to retained earnings made by hand go. Only the year-end close posts to the system account, so a correction to a prior year that has already been closed lands here instead.')).toBeVisible()
    await expect(m.getByText('Because this changes figures that may already have been reported, a reason is required. We also recommend attaching supporting documentation.')).toBeVisible()
    await m.locator('[data-adjustment-flow]').screenshot({ path: 'test-results/je-re-copy.png' })
  })

  // Written, not picked; the document is recommended, not required.
  test('holds the entry back until the reason is written, and posts it with the entry', async ({ page }) => {
    const m = await openEntry(page)
    await fillLine(page, m, 0, RETAINED_EARNINGS, 'debit', '500')
    await fillLine(page, m, 1, '11130', 'credit', '500')
    await m.getByRole('button', { name: 'Post journal entry' }).click()
    const banner = m.getByText(/This entry can't post yet/).locator('..')
    await expect(banner).toContainText('Write why this adjustment is needed.')
    await expect(banner).not.toContainText('Attach the document')

    await m.getByLabel('Reason for this adjustment').fill('2025 insurance expense was 500 short')
    await m.getByRole('button', { name: 'Post journal entry' }).click()
    await page.waitForURL(/\/general-ledger\/entry\//)
    // Flagged with vendor invoicing's exception banner (Mahad, 2026-10-05), with
    // the reason and who posted it, and the line that made it an adjustment
    // carries the Adjustment badge. See adjustmentFlag.spec.ts.
    const flag = page.locator('[data-system-account-flag-card]')
    await expect(flag).toBeVisible()
    await expect(flag).toContainText('Retained earnings adjustment')
    await expect(flag).toContainText('2025 insurance expense was 500 short')
    await expect(flag).toContainText(/ · by .+ on /)
    await expect(page.locator('[data-system-account-flag]')).toHaveCount(1)
    await expect(page.locator('[data-system-account-flag]')).toContainText('Adjustment')
    await flag.screenshot({ path: 'test-results/je-flag.png' })
    await page.screenshot({ path: 'test-results/je-flag-page.png' })
  })

  /* Only a summary is held back. Mahad, 2026-10-09: *"Only make summary accounts
     unselectable. all the others can be select, do not add any other validation
     here."* The system half of retained earnings used to be greyed to the close,
     and an account already on one line dropped off the others; both are picked
     like any account now. */
  test('holds back summaries and nothing else', async ({ page }) => {
    const m = await openEntry(page)
    expect((await offered(page, m, '11100')).selectable).toBe(false)
    const system = await offered(page, m, RETAINED_EARNINGS_SYSTEM)
    expect(system.selectable).toBe(true)
    expect(system.label).not.toContain('Year-end close only')

    // The same account on both lines.
    await pickAccount(page, m, 0, '11130')
    await pickAccount(page, m, 1, '11130')
    await expect(linePicker(m, 1)).toContainText('11130')
  })

  test('opens the retained earnings guide from Learn more, with the worked example', async ({ page }) => {
    const m = await openEntry(page)
    await pickAccount(page, m, 0, RETAINED_EARNINGS)
    await m.getByRole('button', { name: 'Learn more about correcting retained earnings' }).click()
    const guide = page.getByRole('dialog', { name: 'Correcting retained earnings' })
    await expect(guide).toBeVisible()
    await guide.getByRole('button', { name: 'A worked example: insurance nobody expensed' }).click()
    await expect(guide).toContainText('11510 Prepaid Insurance')
    await expect(guide).toContainText('32200 Manual GL Transactions')
    await guide.getByRole('button', { name: 'Close guide' }).click()
    await expect(guide).toHaveCount(0)
    // The entry is still there behind it.
    await expect(m.locator('[data-adjustment-flow]')).toBeVisible()
  })

  test('opens the system accounts guide for a control account', async ({ page }) => {
    const m = await openEntry(page)
    await pickAccount(page, m, 0, CONTROL)
    await m.getByRole('button', { name: 'Learn more about accounts the system keeps' }).click()
    await expect(page.getByRole('dialog', { name: 'Accounts the system keeps' })).toBeVisible()
  })

  // Offered once: inside the flow, in its warning tint, rather than twice.
  test('carries the notify step inside it, in place of the ordinary one', async ({ page }) => {
    const m = await openEntry(page)
    await expect(m.locator('[data-notify-picker]')).toHaveCount(1)
    await pickAccount(page, m, 0, RETAINED_EARNINGS)
    await expect(m.locator('[data-notify-picker]')).toHaveCount(1)
    await expect(m.locator('[data-adjustment-flow] [data-notify-picker]')).toContainText('Let someone know about this adjustment')
  })
})

test('explains journal entries in general from How it works', async ({ page }) => {
  const m = await openEntry(page)
  await m.getByRole('button', { name: 'How it works' }).click()
  const guide = page.getByRole('dialog', { name: 'Journal entries' })
  await expect(guide).toBeVisible()
  await expect(guide).toContainText('Debits and credits in one minute')
})

test.describe('notify someone', () => {
  test('picks a colleague with the notification picker, and can take them off again', async ({ page }) => {
    const m = await openEntry(page)
    await pickRecipient(page, m, 'Ayesha Khan')
    // Vendor invoicing's summary row: initials, the count, Manage. The name is
    // on the hover card, and Manage is the one way to change who is picked.
    const picker = m.locator('[data-notify-picker]')
    await expect(picker).toContainText('1 recipient')
    await picker.getByText('AK', { exact: true }).hover()
    await expect(page.getByText('Ayesha Khan').last()).toBeVisible()
    await picker.getByRole('button', { name: 'Manage' }).click()
    const dialog = page.getByRole('dialog', { name: 'Notification recipients' })
    await dialog.getByRole('button', { name: 'Users', exact: false }).first().click()
    await dialog.getByRole('button', { name: /Ayesha Khan/ }).click()
    await dialog.getByRole('button', { name: 'Done' }).click()
    await expect(picker).not.toContainText('recipient selected')
    await expect(picker.getByRole('button', { name: 'Add notification recipients' })).toBeVisible()
  })

  // Mahad, 2026-10-14: *"remove department dropdown from here please."*
  test('offers no Department filter, and keeps the Department column', async ({ page }) => {
    const m = await openEntry(page)
    await m.getByRole('button', { name: 'Add notification recipients' }).click()
    const dialog = page.getByRole('dialog', { name: 'Notification recipients' })
    await expect(dialog.getByRole('button', { name: /^Roles/ })).toBeVisible()
    await expect(dialog.getByRole('button', { name: /^Department/ })).toHaveCount(0)
    await expect(dialog.getByText('Department', { exact: true })).toHaveCount(1)
    await dialog.screenshot({ path: '/private/tmp/claude-501/-Users-mahad-Documents-Chart-of-Accounts-chart-of-accounts-v2-1/2c6fbcd7-160c-43c6-ac48-a99e1668ca44/scratchpad/notify.png' })
  })

  test('tells them once the entry posts, on the entry\'s Communications tab', async ({ page }) => {
    const m = await openEntry(page)
    await fillLine(page, m, 0, '52110', 'debit', '120')
    await fillLine(page, m, 1, '11130', 'credit', '120')
    await pickRecipient(page, m, 'Ayesha Khan')
    await m.getByRole('button', { name: 'Post journal entry' }).click()

    await expect(page.getByText(/notified Ayesha Khan/)).toBeVisible()
    await page.waitForURL(/\/general-ledger\/entry\//)
    const je = decodeURIComponent(page.url().split('/entry/')[1])
    await page.getByRole('button', { name: /^Communication/ }).first().click()
    await expect(page.getByText(`Journal entry ${je} posted`).first()).toBeVisible()
  })
})
