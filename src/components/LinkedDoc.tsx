import { Receipt, ExternalLink } from 'lucide-react'
import { sourceDocLabel, sourceDocName } from '../lib/seed'
import { openSourceDocument, sourceDocumentUrl } from '../lib/sourceDocumentLink'
import { cn } from '../lib/utils'
import { Marked } from './ui'

// A linked document reads as one thing everywhere in the module: the Receipt
// icon in primary blue, exactly the treatment a journal entry gets from
// FileText. The source type varies (vendor invoice, customer payments, cash
// management…) but it names the record in the tooltip and the tile's subtitle
// rather than splitting the icon or the colour - one link type, one look.
//
// Both forms open the document themselves, in a new tab on the module that owns
// it (see lib/sourceDocumentLink). Neither takes a handler from its page - a
// page that renders a reference has already said everything needed to reach the
// document, and the one thing the click must never do is keep the reader here.

// Table-cell form, used by the Linked Document column in both the General Ledger
// and an account's register so the two read identically.
export function LinkedDocLink({ source, reference, className, q }: {
  source: string
  reference: string
  className?: string
  /** The table's search term, so a reference matched on gets the same mark the
   *  rest of the row's matched columns get. */
  q?: string
}) {
  return (
    <button
      type="button"
      onClick={() => openSourceDocument(source, reference)}
      title={`Open ${sourceDocLabel(source)} ${reference} in a new tab`}
      className={cn('inline-flex items-center gap-1.5 max-w-full tabular-nums text-primary hover:text-[#0862D0] hover:underline underline-offset-2 transition-colors cursor-pointer', className)}
      style={{ fontWeight: 600 }}
    >
      <Receipt size={12} className="text-primary/60 shrink-0" />
      <span className="truncate"><Marked text={reference} q={q ?? ''} /></span>
      {/* Says the click leaves, before it does. */}
      <ExternalLink size={10} className="text-primary/50 shrink-0" />
    </button>
  )
}

// Rail / panel form: the same icon in a tinted tile, with the reference and the
// document type stacked beside it. A source with no document behind it renders
// the dashed no-source-document state, since an entry that originated in the
// ledger has no record to open.
export function LinkedDocTile({ source, reference }: {
  source: string
  reference?: string
}) {
  if (!reference || !sourceDocumentUrl(source, reference)) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-border px-2.5 py-2">
        <div className="w-8 h-8 rounded-lg bg-bg-muted flex items-center justify-center shrink-0">
          <Receipt className="w-4 h-4 text-slate-400" />
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          No source document. This entry was created directly in the ledger.
        </p>
      </div>
    )
  }

  return (
    <button
      onClick={() => openSourceDocument(source, reference)}
      title={`Open ${sourceDocLabel(source)} ${reference} in a new tab`}
      className="group w-full flex items-center gap-2.5 rounded-lg border border-border bg-white px-2.5 py-2 text-left hover:border-primary/40 hover:bg-accent/40 transition-colors cursor-pointer"
    >
      <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
        <Receipt className="w-4 h-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-primary truncate" style={{ fontWeight: 600 }}>{reference}</p>
        <p className="text-[11px] text-slate-500 truncate">{sourceDocName(source)}</p>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-primary/60 shrink-0 group-hover:text-primary transition-colors" />
    </button>
  )
}
