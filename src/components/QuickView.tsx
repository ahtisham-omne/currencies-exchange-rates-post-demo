import type { ElementType, ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { FormModal, Button, Badge, type BadgeTone } from './ui'
import { cn } from '../lib/utils'

/* A quick view previews a record without leaving the list it was opened from.
   A journal entry and the document behind it are different records, but the
   reader's question is the same shape both times - what is this, and is it the
   one I wanted - so they share one shell: the ID as the title, a meta row of
   facts about the record, a compact body, and exactly one way out to the full
   record. Learn it on the entry, and the document needs no learning.

   Chrome is the Partners module's detail modal: a grey canvas carrying white
   cards, each card led by an accent icon tile, and a footer holding the single
   way out to the full record. */

export interface QuickViewMeta {
  status?: { label: string; tone: BadgeTone }
  /* Short plain facts shown beside the status. Two is the practical limit
     before the row stops being scannable. */
  facts?: string[]
}

export function QuickViewModal({
  open, onClose, icon, id, title, meta, openLabel, onOpen, widthClass, children,
}: {
  open: boolean
  onClose: () => void
  icon: ReactNode
  /** The record's own identifier - the JE number, the document reference. */
  id: string
  title?: string
  meta?: QuickViewMeta
  openLabel: string
  onOpen: () => void
  widthClass?: string
  children: ReactNode
}) {
  const facts = meta?.facts?.filter(Boolean) ?? []
  return (
    <FormModal
      open={open}
      onClose={onClose}
      hideFullView
      widthClass={widthClass ?? 'max-w-[880px]'}
      icon={icon}
      title={id}
      subtitle={title}
      titleMeta={(meta?.status || facts.length) ? (
        <div className="flex items-center gap-2 flex-wrap">
          {meta?.status && <Badge tone={meta.status.tone}>{meta.status.label}</Badge>}
          {facts.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-2 text-11 text-slate-500">
              {(i > 0 || meta?.status) && <span className="text-border">|</span>}
              {f}
            </span>
          ))}
        </div>
      ) : undefined}
      footer={
        <Button variant="primary" size="sm" iconRight={<ArrowUpRight size={14} />} onClick={onOpen}>
          {openLabel}
        </Button>
      }
    >
      <div className="bg-slate-50 px-5 py-4 space-y-4">{children}</div>
    </FormModal>
  )
}

/* Partners' ModalContentCard. `flush` drops the body padding so a table can run
   edge to edge; `action` holds a right-aligned header accessory. */
export function QuickViewCard({ title, icon: Icon, count, action, flush, children }: {
  title: string
  icon?: ElementType
  count?: number
  action?: ReactNode
  flush?: boolean
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-muted flex items-center gap-2">
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </div>
        )}
        <span className="text-13 text-fg" style={{ fontWeight: 600 }}>{title}</span>
        {typeof count === 'number' && (
          <span className="text-10 text-slate-500 bg-muted px-1.5 py-0.5 rounded-full ml-1" style={{ fontWeight: 500 }}>{count}</span>
        )}
        {action && <div className="ml-auto shrink-0">{action}</div>}
      </div>
      <div className={flush ? undefined : 'p-4'}>{children}</div>
    </div>
  )
}

export interface QuickViewField {
  label: string
  value: string
  /** Renders the value as an action - a party whose own record lives elsewhere. */
  onClick?: () => void
}

/* One column, label left and value right, the way the same facts read on a
   detail page's information rail. Two columns pairs fields that have nothing to
   do with each other and puts a document's amount next to its due date. */
export function QuickViewFields({ fields }: { fields: QuickViewField[] }) {
  return (
    <dl>
      {fields.map((f, i) => (
        <div
          key={f.label}
          className={cn(
            'flex items-baseline justify-between gap-4 py-2',
            i < fields.length - 1 && 'border-b border-border-subtle',
          )}
        >
          <dt className="text-11 text-slate-500 shrink-0">{f.label}</dt>
          <dd className="text-13 text-fg text-right min-w-0 truncate" style={{ fontWeight: 600 }}>
            {f.onClick ? (
              <button onClick={f.onClick} className="text-primary hover:underline truncate max-w-full">{f.value}</button>
            ) : f.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
