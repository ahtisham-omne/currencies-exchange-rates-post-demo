import { SOURCE_DOC } from './seed'

/* A linked document is not ours to open. The invoice, the bank transaction, the
   payment run - each is a record in the module that raised it, and the ledger
   holds only the reference. So the click leaves the app entirely: a new tab on
   the document's own page in its own module, never a preview of it here.

   The previous behaviour was an in-app quick view of what the ledger knew about
   the document, which answered "is this the invoice I meant?" but stopped short
   of the document itself. Mahad, 2026-09-11: *"Any 'Linked Document' we display
   must always open in a separate location… the main idea we need to convey is
   that clicking a linked document takes the user directly to the actual source
   document where the transaction took place."*

   Every linked reference opens the same invoice, which Mahad chose on 2026-09-18:
   *"Can the linked document everywhere lead to this specific page?"* The routes
   used to be per-source and were read off each owning module's real router, but
   a real route is only half of a landing - the record at the end of it has to
   exist, and this ledger's references are seeded here, so nothing in the fleet
   holds an INV-2026-1004 or an EXP-2026-1254 to show. A reader who clicks
   through to an empty page learns less than one who lands on a real invoice. So
   the destination is one document that is actually there, and what is being
   demonstrated is the leaving. */

const SOURCE_DOCUMENT = 'https://vendor-invoicing-payments.lovable.app/invoices/INV-2024-1011'

/** Where a linked document opens, or undefined for a source with no paper behind
 *  it (a manual entry, an inventory adjustment) - those render no link at all. */
export function sourceDocumentUrl(source: string, reference: string): string | undefined {
  if (!SOURCE_DOC[source]?.linked || !reference) return undefined
  return SOURCE_DOCUMENT
}

export function openSourceDocument(source: string, reference: string) {
  const url = sourceDocumentUrl(source, reference)
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}
