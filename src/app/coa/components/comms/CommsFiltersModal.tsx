import { useEffect, useState } from 'react'
import { Button, Modal, Toggle } from '../ui'
import { DEFAULT_COMM_FILTERS, countActiveCommFilters, type CommChannel, type CommFilters, type CommRecordKind } from '../../lib/comms'
import { ENTITY_META, formatEntityRef } from './entityRef'
import { cn } from '../../lib/utils'
import { DateField } from '../DateField'

/* Filters for the correspondence list, in a modal rather than a dropdown.

   That is the module's standing rule for a filter set and it earns itself again
   here: nine dimensions with a description under each will not fit in a popover
   without becoming a scrolling menu, which is the pattern the rule exists to
   avoid. Ported from the reporting module's own filters modal, with all of its
   dimensions. */

function Section({ title, description, children }: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="py-3 border-b border-border last:border-0">
      <p className="text-[12.5px] text-fg" style={{ fontWeight: 600 }}>{title}</p>
      <p className="text-[11.5px] text-fg-muted mt-0.5">{description}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Choice({ active, onClick, count, children }: {
  active: boolean
  onClick: () => void
  /** How many threads this option alone would leave. Stated on the chip so the
   *  reader can see a dead end before choosing it. */
  count?: number
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-7 px-2.5 rounded-lg border text-[12px] inline-flex items-center gap-1.5 transition-colors cursor-pointer',
        active ? 'border-primary bg-accent text-primary' : 'border-border bg-white text-fg-muted hover:bg-bg-subtle',
      )}
      style={{ fontWeight: active ? 600 : 500 }}
    >
      {children}
      {count !== undefined && (
        <span
          className={cn(
            'min-w-[17px] h-[17px] rounded-full text-[10px] inline-flex items-center justify-center px-1',
            active ? 'bg-primary/10 text-primary' : 'bg-bg-muted text-fg-subtle',
          )}
          style={{ fontWeight: 600 }}
        >
          {count}
        </span>
      )}
    </button>
  )
}

export interface FilterableRecord { ref: string; label: string; kind: CommRecordKind }

export function CommsFiltersModal({ open, onClose, value, onApply, records, resultCount }: {
  open: boolean
  onClose: () => void
  value: CommFilters
  onApply: (next: CommFilters) => void
  /** The records the visible threads are filed against, deduplicated by the
   *  modal. On a record page this is normally one, and the control still shows
   *  it: a thread moved here from somewhere else keeps its own ref, and this is
   *  where the reader sees that there is more than one. */
  records: FilterableRecord[]
  /** How many threads the pending selection would show. Computed by the caller,
   *  which already owns the list, so the footer can name the outcome. */
  resultCount: (draft: CommFilters) => number
}) {
  const [draft, setDraft] = useState(value)
  const uniqueRecords = [...new Map(records.map(r => [r.ref, r])).values()]

  // Reopening shows what is actually applied. A draft left over from a visit the
  // reader cancelled would claim filters that are not in force.
  useEffect(() => { if (open) setDraft(value) }, [open, value])

  const toggleIn = <T extends string>(list: T[], v: T): T[] =>
    list.includes(v) ? list.filter(x => x !== v) : [...list, v]

  const count = resultCount(draft)
  const active = countActiveCommFilters(draft)

  /* Chip counts are live against the rest of the pending selection rather than
     absolute over the whole list. Absolute counts contradict the footer: a chip
     promising eleven next to a button promising two is the reader's problem to
     reconcile, and they cannot, because nothing on screen explains the gap. */
  const countWith = (patch: Partial<CommFilters>) => resultCount({ ...draft, ...patch })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Filters"
      subtitle="Narrow the correspondence on this record."
      width="md"
      subheader={active > 0 ? (
        <div className="px-5 pb-3 -mt-1 flex items-center gap-1.5">
          <span
            className="min-w-[20px] h-5 rounded-full text-[11px] inline-flex items-center justify-center px-1.5 text-white bg-primary"
            style={{ fontWeight: 600 }}
          >
            {active}
          </span>
          <span className="text-[11.5px] text-fg-muted">
            {active === 1 ? 'filter set' : 'filters set'}
          </span>
        </div>
      ) : undefined}
      footerAlign="between"
      footer={
        <>
          <button
            onClick={() => setDraft(DEFAULT_COMM_FILTERS)}
            disabled={active === 0}
            className={cn(
              'text-[12.5px] transition-colors',
              active === 0 ? 'text-fg-subtle cursor-not-allowed' : 'text-primary hover:underline cursor-pointer',
            )}
            style={{ fontWeight: 500 }}
          >
            Clear All
          </button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={() => { onApply(draft); onClose() }}>
              Show {count} Email{count === 1 ? '' : 's'}
            </Button>
          </div>
        </>
      }
    >
      <div className="-my-1">
        <div className="py-3 border-b border-border">
          <p className="text-[12.5px] text-fg" style={{ fontWeight: 600 }}>Keyword</p>
          <p className="text-[11.5px] text-fg-muted mt-0.5">
            Searched over every message body, not just the line the list shows.
          </p>
          <input
            value={draft.keyword}
            onChange={e => setDraft(d => ({ ...d, keyword: e.target.value }))}
            placeholder="A word or phrase in the mail"
            aria-label="Keyword"
            className="input h-8 text-[12px] mt-2"
          />
        </div>

        {uniqueRecords.length > 0 && (
          <Section title="Records" description="Show conversations about the records you pick.">
            <Choice
              active={draft.records.length === 0}
              onClick={() => setDraft(d => ({ ...d, records: [] }))}
              count={countWith({ records: [] })}
            >
              Any
            </Choice>
            {uniqueRecords.map(r => {
              const meta = ENTITY_META[r.kind]
              const active = draft.records.includes(r.ref)
              return (
                <button
                  key={r.ref}
                  onClick={() => setDraft(d => ({ ...d, records: toggleIn(d.records, r.ref) }))}
                  aria-pressed={active}
                  className={cn(
                    'h-7 px-2.5 rounded-lg border text-[12px] inline-flex items-center gap-1.5 transition-colors cursor-pointer',
                    active ? 'border-primary bg-accent text-primary' : 'border-border bg-white text-fg-muted hover:bg-bg-subtle',
                  )}
                  style={{ fontWeight: active ? 600 : 500 }}
                >
                  <span
                    className="inline-flex items-center h-[16px] px-1.5 rounded text-[9.5px]"
                    style={{ fontWeight: 600, backgroundColor: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
                  >
                    {formatEntityRef(r.ref)}
                  </span>
                  {r.label || r.kind}
                  <span
                    className={cn(
                      'min-w-[17px] h-[17px] rounded-full text-[10px] inline-flex items-center justify-center px-1',
                      active ? 'bg-primary/10 text-primary' : 'bg-bg-muted text-fg-subtle',
                    )}
                    style={{ fontWeight: 600 }}
                  >
                    {countWith({ records: [r.ref] })}
                  </span>
                </button>
              )
            })}
          </Section>
        )}

        {/* Every dimension leads with Any, which is the source's shape and also
            the only affordance that clears one dimension without clearing the
            rest. Without it the reader's only way back is Clear all. */}
        <Section title="Channel" description="Notes stay inside Omne. Emails were also sent out.">
          <Choice
            active={draft.channels.length === 0}
            onClick={() => setDraft(d => ({ ...d, channels: [] }))}
            count={countWith({ channels: [] })}
          >
            Any
          </Choice>
          {(['Note', 'Email'] as CommChannel[]).map(c => (
            <Choice
              key={c}
              active={draft.channels.includes(c)}
              onClick={() => setDraft(d => ({ ...d, channels: toggleIn(d.channels, c) }))}
              count={countWith({ channels: [c] })}
            >
              {c}
            </Choice>
          ))}
        </Section>

        <Section title="Email Type" description="Show only the kinds of email you pick.">
          <Choice
            active={draft.writtenBy.length === 0}
            onClick={() => setDraft(d => ({ ...d, writtenBy: [] }))}
            count={countWith({ writtenBy: [] })}
          >
            Any
          </Choice>
          {[{ v: 'user', l: 'User' }, { v: 'automated', l: 'Automated' }].map(o => (
            <Choice
              key={o.v}
              active={draft.writtenBy.includes(o.v)}
              onClick={() => setDraft(d => ({ ...d, writtenBy: toggleIn(d.writtenBy, o.v) }))}
              count={countWith({ writtenBy: [o.v] })}
            >
              {o.l}
            </Choice>
          ))}
        </Section>

        <Section title="Status" description="Show read or unread conversations.">
          <Choice
            active={draft.status.length === 0}
            onClick={() => setDraft(d => ({ ...d, status: [] }))}
            count={countWith({ status: [] })}
          >
            Any
          </Choice>
          {[{ v: 'unread', l: 'Unread' }, { v: 'read', l: 'Read' }].map(o => (
            <Choice
              key={o.v}
              active={draft.status.includes(o.v)}
              onClick={() => setDraft(d => ({ ...d, status: toggleIn(d.status, o.v) }))}
              count={countWith({ status: [o.v] })}
            >
              {o.l}
            </Choice>
          ))}
        </Section>

        <Section title="Sender" description="Show conversations by who sent the last message.">
          <Choice
            active={draft.lastWord.length === 0}
            onClick={() => setDraft(d => ({ ...d, lastWord: [] }))}
            count={countWith({ lastWord: [] })}
          >
            Any
          </Choice>
          {[{ v: 'me', l: 'Me' }, { v: 'other', l: 'Other' }].map(o => (
            <Choice
              key={o.v}
              active={draft.lastWord.includes(o.v)}
              onClick={() => setDraft(d => ({ ...d, lastWord: toggleIn(d.lastWord, o.v) }))}
              count={countWith({ lastWord: [o.v] })}
            >
              {o.l}
            </Choice>
          ))}
        </Section>

        <Section title="Attachments" description="Show conversations with or without attachments.">
          <Choice
            active={draft.hasAttachments === null}
            onClick={() => setDraft(d => ({ ...d, hasAttachments: null }))}
            count={countWith({ hasAttachments: null })}
          >
            Any
          </Choice>
          {[{ v: true, l: 'Has Attachments' }, { v: false, l: 'No Attachments' }].map(o => (
            <Choice
              key={String(o.v)}
              active={draft.hasAttachments === o.v}
              onClick={() => setDraft(d => ({ ...d, hasAttachments: d.hasAttachments === o.v ? null : o.v }))}
              count={countWith({ hasAttachments: o.v })}
            >
              {o.l}
            </Choice>
          ))}
        </Section>

        {/* Kept alongside "Email type: user" even though the two narrow to the
            same set, because the source has both and they are reached at
            different moments: one is a reader choosing what to look at, this is
            a reader clearing the noise out of what they already had open. */}
        <div className="py-3 border-b border-border">
          <p className="text-[12.5px] text-fg" style={{ fontWeight: 600 }}>Quick Filters</p>
          <p className="text-[11.5px] text-fg-muted mt-0.5">Toggle common filters.</p>
          <div className="mt-2.5">
            <Toggle
              checked={draft.hideAutomated}
              onChange={v => setDraft(d => ({ ...d, hideAutomated: v }))}
              label="Hide Automated Emails"
              hint="System-generated notification emails sent by Omne."
            />
          </div>
        </div>

        <div className="py-3">
          <p className="text-[12.5px] text-fg" style={{ fontWeight: 600 }}>Date Range</p>
          <p className="text-[11.5px] text-fg-muted mt-0.5">Filter by when the thread was last written to.</p>
          {/* The module's own calendar, not the browser's, so its Today and
              Clear read as they do everywhere else (Mahad, 2026-10-08). */}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <DateField ariaLabel="From" placeholder="From" clearable value={draft.dateFrom}
              onChange={v => setDraft(d => ({ ...d, dateFrom: v }))} />
            <DateField ariaLabel="To" placeholder="To" clearable value={draft.dateTo}
              onChange={v => setDraft(d => ({ ...d, dateTo: v }))} />
          </div>
        </div>
      </div>
    </Modal>
  )
}
