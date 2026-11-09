import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { accountPatchFromEdit } from './ImportAccounts'
import { needsBankDetails } from '../types'
import type { Account } from '../types'
import type { ParsedRow } from '../lib/uploadValidation'

/* What happens after the accounts land. The import used to end on a dialog whose
   only clickable tile went where the button below it already went, and whose
   "Accounts updated" number could not be anything but zero. Now the reader can
   look at their chart, go back to the rows, change something and apply it - so
   what is guarded here is the second pass: that a change carries onto the account
   it wrote, and that it carries nothing else with it. */

const acct = (extra: Partial<Account> = {}): Account => ({
  id: 'a1',
  accountNumber: '6215',
  accountName: 'Printing',
  accountType: 'EXP',
  glAccountType: 'Posting',
  isPosting: true,
  normalBalance: 'Debit',
  status: 'Active',
  currencyCode: 'USD',
  parentId: null,
  balance: 0,
  hasTransactions: false,
  ...extra,
} as unknown as Account)

const row = (extra: Partial<ParsedRow> = {}): ParsedRow => ({
  row: 2, number: '6215', name: 'Printing', type: 'Expense', glType: 'Posting', ...extra,
})

const patch = (edit: Partial<ParsedRow>, before = row(), account = acct(), chart: Account[] = []) =>
  accountPatchFromEdit(edit, before, account, chart)

describe('carrying a change back onto the account it imported', () => {
  it('sends nothing when nothing moved', () => {
    // The Update button counts accounts with a patch, so a cell retyped to what
    // it already said must not make one: it would offer to update nothing.
    expect(patch({})).toEqual({})
    expect(patch({ name: 'Printing' })).toEqual({})
    expect(patch({ name: '  Printing  ' })).toEqual({})
  })

  it('sends only the fields that moved', () => {
    expect(patch({ name: 'Printing and stationery' })).toEqual({ accountName: 'Printing and stationery' })
  })

  /* A spreadsheet cannot tell an empty cell from a column nobody filled in, so a
     blank is read as silence on every field an account cannot be without. The
     description is the exception, because emptying it is a thing someone means. */
  it('reads a cleared cell as silence, except where blank is an answer', () => {
    expect(patch({ name: '' })).toEqual({})
    expect(patch({ number: '' })).toEqual({})
    expect(patch({ currency: '' })).toEqual({})
    expect(patch({ description: '' }, row({ description: 'Old note' }))).toEqual({ description: '' })
  })

  /* Archiving is a lifecycle move with its own guards and its own confirmation.
     A status cell reaches the two states the import template offers and no more. */
  it('reaches Active and Inactive from a status cell, and nothing else', () => {
    expect(patch({ status: 'Inactive' }, row({ status: 'Active' }))).toEqual({ status: 'Inactive' })
    expect(patch({ status: 'Archived' }, row({ status: 'Active' }))).toEqual({})
    expect(patch({ status: 'nonsense' }, row({ status: 'Active' }))).toEqual({})
  })

  /* Two things a cell must not be allowed to state directly. Omne works the
     normal balance out from the category and the contra flag, and Posting is
     what "takes entries" means - a row that said Summary while the account still
     claimed to be postable would be an account disagreeing with itself. */
  it('recomputes the balance side and the postability rather than reading them', () => {
    expect(patch({ glType: 'Summary' })).toEqual({ glAccountType: 'Summary', isPosting: false })
    expect(patch({ contra: 'Yes' })).toEqual({ isContra: true, normalBalance: 'Credit' })
    expect(patch({ type: 'Revenue' })).toMatchObject({ accountType: 'REV', normalBalance: 'Credit' })
    // The file's own opinion about the side is never taken.
    expect(patch({ normalBalance: 'Credit' })).toEqual({})
  })

  it('moves the account under a parent the chart actually holds', () => {
    const parent = acct({ id: 'p1', accountNumber: '6200', glAccountType: 'Summary', isPosting: false })
    expect(patch({ parent: '6200' }, row(), acct(), [parent])).toEqual({ parentId: 'p1' })
    // Blank is the one parent answer that is readable on its own: no parent.
    expect(patch({ parent: '' }, row({ parent: '6200' }), acct(), [parent])).toEqual({ parentId: null })
  })

  /* A number nobody has is a typo, and reading it as "no parent" would move the
     account to the top of its category on a slip of the keyboard. */
  it('leaves the parent alone when the number names nothing', () => {
    expect(patch({ parent: '9999' })).toEqual({})
  })

  it('never lets an account be its own parent', () => {
    const self = acct({ id: 'a1', accountNumber: '6215' })
    expect(patch({ parent: '6215' }, row(), self, [self])).toEqual({})
  })
})

const page = () => readFileSync(join(__dirname, 'ImportAccounts.tsx'), 'utf8')

describe('the summary dialog', () => {
  /* The complaint that started this: the Accounts created tile and the green
     button under it both closed the wizard and dropped the reader on the chart.
     One destination does not need two controls, and the tile was the one that
     could not say where it went. */
  it('states its four numbers without any of them being a way out', () => {
    const src = page()
    expect(src).toContain('function StatCard({ label, value }')
    const card = src.slice(src.indexOf('function StatCard({ label, value }'))
    const body = card.slice(0, card.indexOf('\n}'))
    expect(body).not.toContain('onClick')
    expect(body).not.toContain('<button')
  })

  it('offers the look before the leave', () => {
    // Scoped to the dialog: "Go to chart of accounts" is also the preview step's
    // own button, which sits earlier in the file and nowhere near this stack.
    const src = page()
    const dialog = src.slice(src.indexOf('function ImportDoneDialog'))
    expect(dialog).toContain('Preview my chart')
    // The grey Preview sits above the green button, so the order on screen is
    // look first, leave second.
    expect(dialog.indexOf('Preview my chart')).toBeLessThan(dialog.indexOf('Go to chart of accounts'))
  })

  /* The same dialog is the end of both passes, so it has to be able to say which
     one just finished. Four numbers under an "Import complete" heading after an
     update would report the import again. */
  it('names the pass that just finished', () => {
    const src = page()
    expect(src).toContain("'Update complete' : 'Import complete'")
  })
})

describe('the second pass', () => {
  /* The grid shows a snapshot taken before the write, because re-validating
     against the chart would match every imported account against itself and read
     the whole file as already there. So a change made after the import cannot go
     into the map that feeds validation - it goes into one of its own. */
  it('keeps the changes made after the import apart from the ones made before', () => {
    const src = page()
    expect(src).toContain('const [postEdits, setPostEdits]')
    expect(src).toContain('if (landed) setPostEdits(apply); else setEdits(apply)')
  })

  /* Nothing to apply is not the same as an Update that applies nothing. The
     button counts what it would do and says so, and says why when it cannot. */
  it('offers Update only when there is something to update', () => {
    const src = page()
    expect(src).toContain('disabled={!pending}')
    expect(src).toContain('Change a row to update the account it imported.')
  })

  /* Applying the same change twice would double the Accounts updated count and
     rewrite fields nobody touched again. The snapshot takes the changes and the
     map is emptied, so a second Update has nothing left to find. */
  it('folds an applied change into the snapshot and forgets it', () => {
    const src = page()
    expect(src).toContain('setPostEdits({})')
    expect(src).toContain('setSummary(s => ({ ...s, updated: total }))')
  })

  /* The reader is looking at the real chart, not a projection of one: the
     accounts are already written by the time Preview is reachable, so a second
     tree built from the rows could only ever disagree with the first. It is read
     straight off the chart index and drawn by the same table the placement
     preview draws, so the two read as one picture of the same chart. */
  it('previews the chart itself, read only', () => {
    const src = page()
    expect(src).toContain('function ChartPreviewStep')
    expect(src).toContain('buildChartIndex(accounts)')
    expect(src).toContain('<PreviewChartTable')
  })

  /* The one column the reader answered three steps about, and the one they
     cannot check anywhere else in the flow. Dropped when nothing carries a
     value, so a flat-numbered file gets no header over an empty column. */
  it('shows the dimensions an account was filed under', () => {
    const src = page()
    expect(src).toContain("['number', 'name', 'glType', 'currency', 'status', 'dimensions']")
    // The header comes from the table's own defaults. This flow used to override
    // it, back when the import said "group filter" and the standing pages said
    // "dimension"; one noun means one label and nothing to keep in step.
    expect(src).not.toContain('headerLabels')
    expect(src).toContain('accounts.some(a => a.defaultDimensionValues.length > 0)')
  })

  /* A picture of the chart, so it does not offer what the chart offers. The rows
     open nothing and say so by not looking clickable; the one marker left beside
     a name is the one thing the import could not finish. */
  it('is a picture rather than a table, and says so', () => {
    const src = page()
    const step = src.slice(src.indexOf('function ChartPreviewStep'))
    const body = step.slice(0, step.indexOf('\n}'))
    expect(body).toContain('Preview only. Nothing on this screen can be changed.')
    expect(body).toContain('needsBankDetails(a) ? <NeedsBankDetailsPill /> : undefined')
    expect(body).not.toContain('Imported')
    // The step opens nothing and toggles nothing: no row click, no expander.
    expect(body).not.toContain('onOpen')
    expect(body).not.toContain('onToggle')
    expect(body).toContain('<PreviewChartTable')

    /* And the table it draws is inert by construction, not by a prop withheld:
       PreviewChartTable is built without a row click, a hover affordance or the
       New badge, so there is nothing on it to make active. The working listing's
       AccountTree keeps all three; this is a different table on purpose. */
    const table = readFileSync(join(__dirname, '../components/AccountTable.tsx'), 'utf8')
    const preview = table.slice(table.indexOf('export function PreviewChartTable'))
    const previewBody = preview.slice(0, preview.indexOf('\nexport function useTreeExpansion'))
    expect(previewBody).not.toContain('onOpen')
    expect(previewBody).not.toContain('cursor-pointer')
    expect(previewBody).not.toContain('NewBadge')
  })

  /* Not a copy of the chart listing's chrome. The working listing carries a
     toolbar - search, density, sorting - because it is worked in; a picture is
     only read, so it borrows none of it and draws the same bare card the
     placement preview draws. */
  it('drops the working listing chrome it used to borrow', () => {
    const src = page()
    const step = src.slice(src.indexOf('function ChartPreviewStep'))
    const body = step.slice(0, step.indexOf('\n}'))
    expect(body).not.toContain('TableToolbar')
    expect(body).not.toContain('density=')
    expect(body).not.toContain('Density')
    expect(body).toContain('<PreviewChartTable')
  })

  /* Framed, not edge to edge - but the frame is the table's own. Run a bare
     table to the modal's walls and the account numbers sit against the window
     with nothing to say where one ends and the other starts. PreviewChartTable
     draws itself inside a rounded, bordered card, so the step adds only a tinted
     gutter around it rather than wrapping it in a second panel. */
  it('frames the table as a card, drawn by the table itself', () => {
    const src = page()
    const step = src.slice(src.indexOf('function ChartPreviewStep'))
    const body = step.slice(0, step.indexOf('\n}'))
    // No second frame around the one the table already brings.
    expect(body).not.toContain('<Card')
    // A tinted gutter between the card and the modal walls.
    expect(body).toContain('bg-bg-subtle/40')
    expect(body).toContain('p-4')
    // Nothing may claw the gutter back.
    expect(body).not.toContain('-mx-')

    // The frame the table carries.
    const table = readFileSync(join(__dirname, '../components/AccountTable.tsx'), 'utf8')
    const preview = table.slice(table.indexOf('export function PreviewChartTable'))
    expect(preview).toContain('rounded-xl border border-border bg-white')
  })

  /* One thing to do in the footer, and the way back inside the sentence that
     says why anyone would want it. A file whose numbers hold no structure is
     shown no step trail, so the trail cannot be the only way back. */
  it('leaves one button in the footer and carries the way back in its own copy', () => {
    const src = page()
    const footer = src.slice(src.indexOf("if (step === 'preview') {"))
    const arm = footer.slice(0, footer.indexOf('\n    }'))
    expect(arm).toContain('Go to chart of accounts')
    expect(arm).not.toContain('variant="ghost"')
    expect(src).toContain('onBackToReview={() => setStep(\'review\')}')
    expect(src).toContain('go back to Review')
  })

  it('says the accounts are already in the chart before it offers to discard', () => {
    const src = page()
    expect(src).toContain('Close without updating?')
    expect(src).toContain('Your accounts are already in your chart.')
  })
})

describe('an imported bank account, once it is on the chart', () => {
  const bank = (extra: Partial<Account> = {}) =>
    acct({ accountRole: 'Bank', accountType: 'AST', ...extra })
  const card = (extra: Partial<Account> = {}) =>
    acct({ accountRole: 'Credit Card', accountType: 'LIA', ...extra })

  /* No import template carries an issuer or an account number, so every bank and
     card account arrives unfinished. The chip says so on the chart, which is the
     only place the reader will look for it once the wizard is closed. */
  it('is unfinished until it has the details the file could not carry', () => {
    expect(needsBankDetails(bank())).toBe(true)
    expect(needsBankDetails(bank({ bankName: 'Chase' }))).toBe(true)
    expect(needsBankDetails(bank({ bankName: 'Chase', bankAccountNumber: '483920175566' }))).toBe(false)
  })

  // A card is billed, not reconciled against a routing number, so the issuer is
  // the whole of what it needs. Same rule the Create GL account form keeps.
  it('asks a card for its issuer and nothing more', () => {
    expect(needsBankDetails(card())).toBe(true)
    expect(needsBankDetails(card({ bankName: 'Amex' }))).toBe(false)
  })

  it('says nothing about an account that was never a bank account', () => {
    expect(needsBankDetails(acct())).toBe(false)
    expect(needsBankDetails(acct({ accountRole: 'Cash on Hand' }))).toBe(false)
  })

  it('reads whitespace as absence, the way every other field does', () => {
    expect(needsBankDetails(bank({ bankName: '   ', bankAccountNumber: '  ' }))).toBe(true)
  })

  /* The seeded chart is a company that finished setting up, so none of its bank
     accounts may wear the chip. If one did, the chip would read as decoration on
     the roles rather than as a thing to go and do. */
  it('leaves the seeded chart unchipped', async () => {
    const { seedAccounts } = await import('../lib/seed')
    expect(seedAccounts.filter(needsBankDetails)).toEqual([])
    // And the accounts it would have chipped exist, so the check is not vacuous.
    expect(seedAccounts.some(a => a.accountRole === 'Bank')).toBe(true)
  })

  /* Clicking it opens the one thing it named, and nothing else. Walking the
     reader through category, naming, dimensions and a preview would ask them
     to restate what the import already said, on their way to the single field
     the chip was about. */
  it('opens the bank details alone, from the chart', () => {
    const coa = readFileSync(join(__dirname, 'ChartOfAccounts.tsx'), 'utf8')
    expect(coa).toContain('Needs action')
    expect(coa).toContain('openBankDetails(a)')
    expect(coa).toContain('bankDetailsOnly={editBankOnly}')
    // The row menu's own Edit still opens the whole account.
    expect(coa).toContain("if (action === 'edit') openEdit(a)")
    // The chip sits inside a clickable row, so it has to stop the row opening too.
    expect(coa).toContain('e.stopPropagation()')
    /* The chip rides the chart, and the chart is the tree - the flat list is
       retired, so there is one table to carry it rather than two to keep in
       step. Still asserted, because a chip on no table is a chip nobody sees. */
    expect(coa.match(/rowBadge=\{rowBadge\}/g) ?? []).toHaveLength(1)
  })

  /* What "alone" has to mean, held to the four things that would otherwise show:
     the step trail, the steps either side of banking, and Continue. */
  it('drops the steps around it, and saves instead of continuing', () => {
    const form = readFileSync(join(__dirname, 'CreateAccount.tsx'), 'utf8')
    expect(form).toContain('bankDetailsOnly?: boolean')
    // One step, so classification, GL account details, dimensions and preview
    // are not rendered and not reachable.
    expect(form).toContain("const wizardSteps: WizardStep[] = bankOnly ? ['banking'] : [")
    /* The other side of the ternary is wherever the flow would otherwise open -
       'details' since an edit stopped asking what kind of account it is. What is
       pinned here is that bankOnly lands on its one step and nothing before it. */
    expect(form).toContain("setStep(bankOnly ? 'banking' : 'details')")
    // No trail over a single step, and no Continue at the end of it.
    expect(form).toContain('headerExtra={bankOnly ? undefined : stepTabs}')
    expect(form).toContain('<Button onClick={saveBankDetails}>Save</Button>')
  })

  /* The toggle on that step is one of the three things the reader came to do, so
     it has to reach the Partners directory from an edit and not only from a
     create. It used to return early on isEdit, which made it decoration. */
  it('adds the partner the toggle offers, on an edit as well as a create', () => {
    const form = readFileSync(join(__dirname, 'CreateAccount.tsx'), 'utf8')
    expect(form).toContain('if (!isBankSub || !partnerEnabled || partnerMatch) return')
    expect(form).not.toContain('if (isEdit || !isBankSub || !partnerEnabled')
    /* Anchored on the edit's write, and asserted found: `indexOf` answers -1 for
       a string that has moved on, which slices the tail of the file instead and
       fails on the wrong thing. */
    const write = form.indexOf('store.updateAccount(editAccount.id, edits)')
    expect(write).toBeGreaterThan(-1)
    const edit = form.slice(write)
    expect(edit.slice(0, edit.indexOf('\n      return'))).toContain('maybeAddPartner()')
  })

  /* The wizard behind it had grown to the height of the screen. Capped in pixels
     as well as in vh, which is the cap WizardChrome already uses, so a tall
     monitor does not strand the footer hundreds of pixels under the last field. */
  it('caps the account wizard in pixels, not just in viewport height', () => {
    const form = readFileSync(join(__dirname, 'CreateAccount.tsx'), 'utf8')
    expect(form).not.toContain("sm:h-[90vh]")
    expect(form).not.toContain("sm:max-h-[90vh]")
    expect(form).toContain("'sm:h-[min(90vh,760px)]'")

    const chrome = readFileSync(join(__dirname, '../components/WizardChrome.tsx'), 'utf8')
    expect(chrome).toContain('sm:h-[min(90vh,760px)]')
  })

  it('keeps the chip and its tooltip in the house voice', () => {
    const coa = readFileSync(join(__dirname, 'ChartOfAccounts.tsx'), 'utf8')
    const chip = coa.slice(coa.indexOf('function NeedsActionChip'))
    const body = chip.slice(0, chip.indexOf('\n}'))
    expect(body).not.toContain('—')
    expect(body).not.toContain('’')
    expect(body).not.toMatch(/\bwe('|’)?ll\b/i)
    // Sentence case: the tag is a thing to do, not a proper noun.
    expect(body).toContain('Needs action')
    expect(body).not.toContain('Needs Action')
  })
})
