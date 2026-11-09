import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { formatInternalId, internalIdSeq, nextInternalId, nextInternalIds, INTERNAL_ID_HELP, INTERNAL_ID_LABEL } from './internalId'
import { DEFAULT_COLUMNS, DEFAULT_COLUMN_ORDER, HEADER_DEFS, blankFilter, matchesColFilters } from '../components/AccountTable'
import { auditFieldLabel } from './auditFieldLabels'
import { useStore, buildAccount } from '../store'
import { seedAccounts } from './seed'
import { searchHits } from './accountSearch'
import type { AccountDraft } from '../types'

/* The internal id exists because the account number does not stay put. A number
   belongs to the customer and they renumber - so every promise the field makes
   is a promise about what happens to it when something else about the account
   changes. Those are the promises pinned here:

   - it is issued once, and never issued a second time, not even to fill the gap
     a deleted account left;
   - it survives a renumber, a rename and an archiving;
   - nothing on the chart holds a blank one, because a blank cannot name
     anything.

   The renumber itself is the fourth, and where it can be done from has moved
   twice. It is a store operation - a chart being reconciled against another
   system has to be able to take that system's numbers - and it is not a thing
   the edit form offers a reader, because the number is what saved reports,
   exports and other modules already name the account by. */

const read = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8')

const draft = (over: Partial<AccountDraft> = {}): AccountDraft => ({
  accountNumber: '6100',
  accountName: 'Test expense',
  accountType: 'EXP',
  glAccountType: 'Posting',
  statementClassification: 'Operating expense',
  isPosting: true,
  currencyCode: 'USD',
  status: 'Active',
  effectiveDate: '2026-01-01',
  postingRestrictions: {},
  defaultDimensionValues: [],
  isContra: false,
  parentId: null,
  subsidiaryId: 'sub_main',
  balance: 0,
  hasTransactions: false,
  ...over,
} as AccountDraft)

describe('the shape of an internal id', () => {
  it('is a fixed-width sequence behind one prefix, so two of them line up', () => {
    expect(formatInternalId(1)).toBe('ACC-000001')
    expect(formatInternalId(4210)).toBe('ACC-004210')
  })

  it('reads its own number back, and gives 0 for anything that is not one', () => {
    expect(internalIdSeq('ACC-000042')).toBe(42)
    expect(internalIdSeq('')).toBe(0)
    expect(internalIdSeq(undefined)).toBe(0)
    // A partner id, an account id, a hand-typed number: none of them is ours,
    // and reading one as a sequence would put the counter somewhere arbitrary.
    expect(internalIdSeq('acc-000042')).toBe(0)
    expect(internalIdSeq('ACC-12AB')).toBe(0)
    expect(internalIdSeq('1030')).toBe(0)
  })
})

describe('issuing the next internal id', () => {
  it('starts at one on an empty chart', () => {
    expect(nextInternalId([])).toBe('ACC-000001')
  })

  it('goes above the highest issued, not above the count', () => {
    // The gap is the point: three accounts, but one of them holds 000009, so the
    // next is 000010 rather than 000004.
    const chart = [{ internalId: 'ACC-000001' }, { internalId: 'ACC-000009' }, { internalId: 'ACC-000003' }]
    expect(nextInternalId(chart)).toBe('ACC-000010')
  })

  it('never reissues a deleted account\'s id', () => {
    const chart = [{ internalId: 'ACC-000001' }, { internalId: 'ACC-000002' }]
    const afterDelete = [chart[1]]
    // 000001 is gone from the chart, and something outside this module may still
    // be naming it. The next id has to clear the highest survivor.
    expect(nextInternalId(afterDelete)).toBe('ACC-000003')
  })

  it('hands out a run without repeating inside it', () => {
    const ids = nextInternalIds([{ internalId: 'ACC-000005' }], 3)
    expect(ids).toEqual(['ACC-000006', 'ACC-000007', 'ACC-000008'])
    expect(new Set(ids).size).toBe(3)
  })
})

describe('every account on the chart holds one', () => {
  it('is on all of the seeded accounts, archived ones included, with no repeats', () => {
    const ids = seedAccounts.map(a => a.internalId)
    expect(ids.every(id => internalIdSeq(id) > 0)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('is issued by the store, not accepted from the caller', () => {
    const created = useStore.getState().createAccount(draft())
    expect(internalIdSeq(created.internalId)).toBeGreaterThan(0)
    // Above every id already on the chart, so no live account shares it.
    const others = useStore.getState().accounts.filter(a => a.id !== created.id)
    expect(others.every(a => internalIdSeq(a.internalId) < internalIdSeq(created.internalId))).toBe(true)
  })

  it('is issued against the whole chart, so two creates cannot collide', () => {
    const a = useStore.getState().createAccount(draft({ accountNumber: '6101' }))
    const b = useStore.getState().createAccount(draft({ accountNumber: '6102' }))
    expect(a.internalId).not.toBe(b.internalId)
  })

  it('does not leak the import preview\'s blank into the chart', () => {
    // The review grid builds Account-shaped previews with a blank id, because a
    // row that may never be imported must not burn one. The publish path drops
    // the blank rather than spreading it through.
    expect(read('pages', 'ImportAccounts.tsx')).toMatch(/const \{ id, internalId,/)
    expect(useStore.getState().accounts.every(a => !!a.internalId)).toBe(true)
  })

  it('is left off buildAccount\'s input type entirely', () => {
    // AccountDraft omits it, so a create flow cannot pass one even by accident.
    const built = buildAccount(draft(), [{ internalId: 'ACC-000700' }])
    expect(built.internalId).toBe('ACC-000701')
  })
})

describe('a renumber', () => {
  let id: string
  beforeEach(() => {
    id = useStore.getState().createAccount(draft({ accountNumber: '6200', accountName: 'Renumber me' })).id
  })

  it('goes through, now that nothing has posted to the account', () => {
    useStore.getState().updateAccount(id, { accountNumber: '6250' }, 'Renumbered to fit the new scheme')
    expect(useStore.getState().accounts.find(a => a.id === id)!.accountNumber).toBe('6250')
  })

  it('leaves the internal id exactly where it was', () => {
    const before = useStore.getState().accounts.find(a => a.id === id)!.internalId
    useStore.getState().updateAccount(id, { accountNumber: '6251', accountName: 'Renamed too' })
    const after = useStore.getState().accounts.find(a => a.id === id)!
    expect(after.internalId).toBe(before)
  })

  it('lands in the activity log with both numbers on it', () => {
    useStore.getState().updateAccount(id, { accountNumber: '6252' }, 'Matched to the acquired chart')
    const entry = useStore.getState().auditLog
      .filter(e => e.accountId === id && e.field === 'accountNumber')
      .slice(-1)[0]
    expect(entry).toBeDefined()
    expect(entry!.action).toBe('Edit')
    expect(entry!.oldValue).toBe('6200')
    expect(entry!.newValue).toBe('6252')
    expect(entry!.reason).toBe('Matched to the acquired chart')
  })

  /* And from the edit form, but only while the account is still not in use.

     Mahad asked for the flat lock on 2026-09-18 - *"Account numbers to be locked
     for all types of accounts in edit flow"* - and drew the line differently on
     2026-09-22: *"when I create a new account and there are no transactions in
     it ... then I should be able to change everything. In the edit view, the
     things we have locked were done solely because for accounts where
     transactions have already taken place, you cannot make changes."*

     The reason for the lock is what saved reports, exports and other modules
     quote, and they quote nothing about an account nothing has landed in. So the
     condition is `inUse`, the same one every other structural lock on the form
     reads, and the number is back in the patch - `updateAccount` logs a diff, so
     carrying a field the form could not change costs nothing.

     Pinned at the source because a lock's condition is not something a browser
     test can read off the screen. The visible halves are in
     `e2e/editRestrictions.spec.ts` (a settled account offers no input and says
     why) and `e2e/freshAccountEdit.spec.ts` (a fresh one offers all of them). */
  it('is something the edit form builds a patch for, so an unlocked field can save', () => {
    const form = read('pages', 'CreateAccount.tsx')
    const edits = form.slice(form.indexOf('const edits = {'), form.indexOf('const edits = {') + 1600)
    expect(edits).toContain('accountNumber: form.accountNumber')
    expect(edits).toContain('parentId: pickedParent?.id ?? null')
  })

  it('is locked by the use, not by the edit', () => {
    const form = read('pages', 'CreateAccount.tsx')
    expect(form).toContain('editAccount?.hasTransactions')
    expect(form).toMatch(/const numberInUseLock = inUse/)
    // `inUse` is the transactions *or* the accounts filed under a summary, which
    // is what stops this reading as a posting-account-only rule.
    expect(form).toMatch(/const inUse = posted \|\| childCount > 0/)
    // And use still wins over the other reason the field can be stated: a summary
    // being created is numbered by its range, but an account in service is
    // numbered by what already refers to it.
    expect(form).toMatch(/const numberLock = numberInUseLock\s*\?\?/)
    // The old copy stated a transaction history on every edit, including the
    // accounts that have none.
    expect(form).not.toContain('cannot be changed as the account has existing transaction history')
  })
})

describe('reading the log back', () => {
  it('names the field in the reader\'s words, not the property\'s', () => {
    expect(auditFieldLabel('accountNumber')).toBe('GL account no.')
    // The category is what every other screen calls it; no rule gets there from
    // `accountType`.
    expect(auditFieldLabel('accountType')).toBe('GL account category')
    expect(auditFieldLabel('defaultDimensionValues')).toBe('default dimensions')
  })

  it('still reads as words for a field nobody has named', () => {
    expect(auditFieldLabel('someNewField')).toBe('some New Field')
  })

  it('is what the timeline renders, so no entry reads "updated accountnumber"', () => {
    const detail = read('pages', 'AccountDetail.tsx')
    expect(detail).toContain('auditFieldLabel(String(a.field))')
    expect(detail).not.toContain('String(a.field).toLowerCase()')
  })
})

/* On the listing and on the account page, since the design review of
   2026-09-24. Eli: *"So the system ID, expose it in the table so it becomes
   searchable ... And expose it in the detail view of the item. You could put it
   at the bottom in a bottom card, something out of the way."*

   It had been nowhere since 2026-09-10, when Mahad cut the closed "System
   information" card along with the rest of the page's explanatory copy (*"We
   can remove system information since we don't need it now."*). That cut stands:
   the id comes back as one field in the bottom block the rail already has,
   beside who made the account and when, not as a card of its own. */
describe('where the internal id is shown', () => {
  it('is a field in the account page rail, not a card of its own', () => {
    const detail = read('pages', 'AccountDetail.tsx')
    expect(detail).not.toContain('SystemInfoCard')
    // Once on the posting rail and once on the summary rail, through the field
    // the journal entry page shares (components/InternalIdField.tsx).
    expect(detail.match(/<InternalIdField id=\{account\.internalId\} help=\{INTERNAL_ID_HELP\} \/>/g)).toHaveLength(2)
  })

  it('is a column on the listing, shipped hidden', () => {
    expect(DEFAULT_COLUMN_ORDER).toContain('internalId')
    expect(DEFAULT_COLUMNS.internalId).toBe(false)
    expect(HEADER_DEFS.internalId.label).toBe(INTERNAL_ID_LABEL)
  })

  it('is named and explained the same way on both', () => {
    const detail = read('pages', 'AccountDetail.tsx')
    expect(detail).toContain('help={INTERNAL_ID_HELP}')
    const field = read('components', 'InternalIdField.tsx')
    // The account page takes the default name; the entry page passes its own.
    expect(field).toContain('label = INTERNAL_ID_LABEL')
    expect(field).toContain('{label}')
    expect(field).toContain('tooltip={help}')
    expect(HEADER_DEFS.internalId.info).toBe(INTERNAL_ID_HELP)
  })

  it('sorts by the sequence, not the text', () => {
    // ACC-000010 after ACC-000009, which a string sort also gets right at a
    // fixed width - but not once a tenant passes 999,999.
    expect(internalIdSeq('ACC-1000000')).toBeGreaterThan(internalIdSeq('ACC-999999'))
  })

  /* Search has to find it whether or not the column is on. Typing the id is how
     someone holding it from another system looks for the account, not something
     they do after turning a column on. */
  it('is found by the chart search and the summary rollup search', () => {
    // One search for both: lib/accountSearch, which reads every column whether
    // or not it is on. The summary's Accounts tab calls the same searchHits, and
    // e2e/accountTabsSearch.spec.ts finds an account by its ID there.
    const a = seedAccounts[11]
    expect(searchHits(a, a.internalId.toLowerCase())).toContain('internalId')
    expect(read('pages', 'AccountDetail.tsx')).toMatch(/searchHits\(a, debouncedQ, searchCtx\)/)
  })

  it('filters by what is typed into its column header', () => {
    const a = seedAccounts[11]
    const f = { ...blankFilter('internalId'), text: a.internalId.toLowerCase() }
    expect(matchesColFilters(a, { internalId: f }, seedAccounts)).toBe(true)
    expect(matchesColFilters(seedAccounts[12], { internalId: f }, seedAccounts)).toBe(false)
  })
})
