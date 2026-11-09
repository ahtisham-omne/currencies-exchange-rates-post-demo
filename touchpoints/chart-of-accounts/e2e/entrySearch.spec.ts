import { test, expect, type Page } from '@playwright/test'
import { settle, view } from './glPage'

/* Mahad, 2026-09-24: *"Search ignores the other lines of a journal entry, so
   matching entries are missed."*

   An entry is one document and its lines are sides of the same fact. Both
   surfaces that list postings searched a line at a time instead:

   - an account's register holds only that account's side, so a description
     carried on the other side matched nothing - though clicking any row there
     opens the entry whole and shows that very line;
   - the ledger's entries tab rebuilt each entry out of whichever of its lines
     had survived the search, so the same entry described itself differently
     depending on which of its two accounts had been typed.

   The ledger is seeded afresh per browser profile, so every fixture here is read
   out of the store rather than written down. */

type Pick = {
  je: string
  accountId: string
  accountName: string
  otherAccountName: string
  ownDescription: string
  otherLineDescription: string
}

/* A two-line entry whose sides carry different descriptions, and whose two
   accounts are quiet enough that one page of entries holds all of theirs - so
   nothing below has to page to find the entry it just searched for. */
async function twoSidedEntry(page: Page): Promise<Pick> {
  const found = await page.evaluate(async () => {
    const { useStore } = await import('/src/store.ts')
    const s = useStore.getState()
    const month = (d: string) => d.slice(0, 7)
    const latest = s.transactions.reduce((m, t) => (t.date > m ? t.date : m), '')
    const inPeriod = s.transactions.filter(t => month(t.date) === month(latest))

    const postings = new Map<string, number>()
    for (const t of inPeriod) postings.set(t.accountId, (postings.get(t.accountId) ?? 0) + 1)

    const byJe = new Map<string, typeof inPeriod>()
    for (const t of inPeriod) {
      const ls = byJe.get(t.jeNumber) ?? []
      ls.push(t)
      byJe.set(t.jeNumber, ls)
    }
    const acctById = new Map(s.accounts.map(a => [a.id, a]))
    for (const [je, ls] of byJe) {
      if (ls.length !== 2) continue
      if (ls[0].accountId === ls[1].accountId) continue
      if (ls[0].description === ls[1].description) continue
      if ((postings.get(ls[0].accountId) ?? 0) > 20) continue
      if ((postings.get(ls[1].accountId) ?? 0) > 20) continue
      const own = acctById.get(ls[0].accountId), other = acctById.get(ls[1].accountId)
      if (!own?.accountName || !other?.accountName) continue
      return {
        je, accountId: own.id, accountName: own.accountName,
        otherAccountName: other.accountName,
        ownDescription: ls[0].description,
        otherLineDescription: ls[1].description,
      }
    }
    return null
  })
  expect(found, 'the ledger holds a two-sided entry to search for').not.toBeNull()
  return found as Pick
}

test('an account register finds an entry by the line sitting on the other account', async ({ page }) => {
  await settle(page, '/chart-of-accounts')
  const pick = await twoSidedEntry(page)

  await page.evaluate(id => {
    window.history.pushState({}, '', `/chart-of-accounts/${id}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, pick.accountId)
  await page.getByRole('button', { name: 'Transactions', exact: true }).first().click()

  const search = page.getByPlaceholder('Search transactions')
  await search.waitFor()
  // The register opens on the last 30 days; the entry picked may be older.
  await page.getByRole('button', { name: /^Last 30 days/ }).first().click()
  await page.getByText('All time', { exact: true }).last().click()
  const entryRow = page.locator(`tbody tr:has-text("${pick.je}")`)

  // Its own side, so the register is searchable at all before anything is
  // claimed about the side it does not hold.
  await search.fill(pick.ownDescription)
  await expect(entryRow.first(), 'the entry answers to its own line').toBeVisible()

  await search.fill(pick.otherLineDescription)
  await expect(
    entryRow.first(),
    `${pick.je} answers to "${pick.otherLineDescription}", which is on its ${pick.otherAccountName} line`,
  ).toBeVisible()
})

test('the entries tab returns one entry, however the reader named it', async ({ page }) => {
  await settle(page, '/general-ledger')
  const pick = await twoSidedEntry(page)
  await view(page, 'Journal entries').click()

  const search = page.getByPlaceholder('Search entries')
  const rowOf = async (term: string) => {
    await search.fill(term)
    const row = page.locator(`tbody tr.gl-je-parent:has-text("${pick.je}")`).first()
    await expect(row, `${pick.je} is returned by "${term}"`).toBeVisible()
    return (await row.innerText()).replace(/\s+/g, ' ').trim()
  }

  // The entry number names the entry and nothing else, so what it returns is the
  // entry as the page would state it unprompted.
  const whole = await rowOf(pick.je)
  expect(await rowOf(pick.accountName), 'naming one side states the whole entry').toBe(whole)
  expect(await rowOf(pick.otherAccountName), 'naming the other side states the same entry').toBe(whole)
})
