import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sourceDocumentUrl } from './sourceDocumentLink'
import { SOURCE_DOC } from './seed'
import { TX_SCENARIOS } from './txScenarios'

/* A linked document leaves the app. Mahad, 2026-09-11: *"Any 'Linked Document'
   we display must always open in a separate location… the main idea we need to
   convey is that clicking a linked document takes the user directly to the
   actual source document where the transaction took place."*

   Two halves are worth pinning, and they pull against each other. Every source
   the seed can produce a reference for must have somewhere to go, or a reader
   clicks a live-looking link and nothing happens. And no source *without* paper
   behind it may get one, or a manual entry starts claiming an invoice. */

const read = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8')

describe('where a linked document opens', () => {
  it('sends every source the ledger can reference somewhere', () => {
    const linked = Object.keys(SOURCE_DOC).filter(s => SOURCE_DOC[s].linked)
    // Guards the list itself: a new linked source added to SOURCE_DOC and not
    // to the map would otherwise slip through as an empty expectation.
    expect(linked.length).toBeGreaterThan(4)
    expect(linked.filter(s => !sourceDocumentUrl(s, 'INV-2026-1004'))).toEqual([])
  })

  it('covers every source the seeded scenarios actually use', () => {
    const used = [...new Set(TX_SCENARIOS.filter(s => SOURCE_DOC[s.source]?.linked).map(s => s.source))]
    expect(used.filter(s => !sourceDocumentUrl(s, 'REF-1'))).toEqual([])
  })

  it('offers nothing for a posting with no paper behind it', () => {
    expect(sourceDocumentUrl('Manual JE', 'JE-2026-2001')).toBeUndefined()
    // A source the ledger no longer produces opens nothing either.
    expect(sourceDocumentUrl('Inventory Adjust', 'ADJ-2026-2001')).toBeUndefined()
    // A linked source with no reference is the same case: nothing to open.
    expect(sourceDocumentUrl('Vendor Invoice', '')).toBeUndefined()
  })

  /* One destination for all of them, which Mahad chose on 2026-09-18: *"Can the
     linked document everywhere lead to this specific page?"* The routes used to
     be per-source and derived from the reference. A real route is only half of a
     landing though - the record at the end has to exist, and these references are
     seeded in this repo, so no app in the fleet holds an INV-2026-1004 to show.
     Pinned as the literal URL he supplied: a typo here is a reader on a 404. */
  it('opens the one document that is really there, whatever raised the posting', () => {
    const linked = Object.keys(SOURCE_DOC).filter(s => SOURCE_DOC[s].linked)
    for (const source of linked) {
      expect(sourceDocumentUrl(source, 'REF-1'), source)
        .toBe('https://vendor-invoicing-payments.lovable.app/invoices/INV-2024-1011')
    }
  })

  /* The reference is the ledger's own and names no page now, so it must not be
     spliced into the path - that is how the per-source routes worked, and leaving
     one behind would send that source to a document that does not exist. */
  it('does not build the path out of the reference', () => {
    expect(sourceDocumentUrl('Vendor Invoice', 'INV-2026-1004'))
      .toBe(sourceDocumentUrl('Customer Invoice', 'CINV-2026-1254'))
  })

  it('leaves this app on every destination', () => {
    const urls = Object.keys(SOURCE_DOC)
      .map(s => sourceDocumentUrl(s, 'REF-1'))
      .filter((u): u is string => !!u)
    expect(urls.every(u => u.startsWith('https://'))).toBe(true)
    // Nothing may resolve back into the chart-of-accounts module.
    expect(urls.filter(u => u.includes('chart-of-accounts') || u.includes('general-ledger'))).toEqual([])
  })
})

describe('nothing previews a source document in the app any more', () => {
  it('has no quick view left to open', () => {
    for (const page of ['GeneralLedger.tsx', 'JournalEntryDetail.tsx', 'AccountDetail.tsx']) {
      const src = read('pages', page)
      expect(src, page).not.toContain('SourceDocumentQuickView')
      expect(src, page).not.toMatch(/quickDoc/)
    }
  })

  /* The two files behind the preview are gone rather than left behind unread -
     the derivation existed only to fill a card this module no longer shows. */
  it('leaves neither of the files that served it', () => {
    for (const p of [['components', 'SourceDocumentQuickView.tsx'], ['lib', 'sourceDocument.ts']]) {
      expect(() => read(...p), p.join('/')).toThrow()
    }
  })

  /* Both link forms open the document themselves, so no page is handed the job
     and none can quietly keep it in-app. */
  it('opens from the link itself, in a new tab', () => {
    const linkedDoc = read('components', 'LinkedDoc.tsx')
    expect(linkedDoc).not.toMatch(/onOpen/)
    expect((linkedDoc.match(/onClick=\{\(\) => openSourceDocument\(source, reference\)\}/g) ?? []).length).toBe(2)
    const lib = read('lib', 'sourceDocumentLink.ts')
    expect(lib).toContain(`window.open(url, '_blank', 'noopener,noreferrer')`)
  })
})
