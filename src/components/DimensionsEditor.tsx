import { useEffect, useState, forwardRef, useImperativeHandle } from 'react'
import { Plus, X, Pencil, Layers, Lock } from 'lucide-react'
import { Button, Input, EmptyState, FormModal, ConfirmModal, Menu, MenuItem, Banner } from './ui'
import { cn } from '../lib/utils'
import type { Dimension } from '../types'
import { describeUse, type DimensionUse } from '../lib/dimensionDefaults'

/* The dimension editor for a wizard step: a short list of what the reader has
   defined so far, with the form over it. The standing page (`Dimensions.tsx`)
   reads the same records as a table, because there they are records you came to
   manage; here they are answers to the step's question, and the step is the
   subject.

   What the two surfaces do share is `DimensionFormModal` below, and they share it
   for the reason there is only one of them: a dimension defined during setup
   and one defined a month later have to be the same thing, and two forms would
   drift until one of them could not express something the other could.

   Nothing is posted during a setup run, so a dimension defined here cannot
   need the softer move that Deactivate exists to be. There is no status on this
   surface at all - every one on screen is Active, and a column of one repeated
   word is not a column.

   It owns no data. Everything it changes goes out through the callbacks, so the
   caller decides whether that means the store now or a draft held until a wizard
   step is committed. */

export interface DimensionDraft {
  name: string
  values: string[]
  status: 'Active' | 'Inactive'
}

/** What a dimension looks like before it has been saved anywhere. */
export const EMPTY_DRAFT: DimensionDraft = { name: '', values: [], status: 'Active' }

/* One word for the thing, everywhere it is named. It used to be a prop, because
   the setup flows said "group filter" while the standing page said "dimension"
   and each surface had to name it in its own words. There is one word now, so
   there is nothing to pass. */
export const DIMENSION_NOUN = { one: 'dimension', many: 'dimensions' }
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export interface DimensionsEditorProps {
  dimensions: Dimension[]
  onCreate: (draft: DimensionDraft) => void
  onUpdate: (id: string, patch: Partial<Dimension>) => void
  /** Removal outright, which a surface with nothing posted yet can offer. */
  onDelete?: (id: string) => void
  /** Shown above the list when the surface has something to say about scope. */
  notice?: string
  emptyHint?: string
}

/* So a page can put its create button where a page's create button goes - top
   right, next to the title - without owning the modal or duplicating the form. */
export interface DimensionsEditorHandle { openNew: () => void }

export const DimensionsEditor = forwardRef<DimensionsEditorHandle, DimensionsEditorProps>(function DimensionsEditor({
  dimensions, onCreate, onUpdate, onDelete, notice, emptyHint,
}, ref) {
  // `null` is closed; a string id is editing that one; 'new' is creating.
  const [editing, setEditing] = useState<string | null>(null)
  const [initial, setInitial] = useState<DimensionDraft>(EMPTY_DRAFT)
  const [confirmDelete, setConfirmDelete] = useState<Dimension | null>(null)

  const openNew = () => { setInitial(EMPTY_DRAFT); setEditing('new') }
  useImperativeHandle(ref, () => ({ openNew }))
  const openEdit = (d: Dimension) => {
    setInitial({ name: d.name, values: [...d.values], status: d.status })
    setEditing(d.id)
  }

  return (
    <div className="space-y-3">
      {notice && <Banner tone="info">{notice}</Banner>}

      {dimensions.length === 0 ? (
        <div className="rounded-xl border border-border bg-white">
          <EmptyState
            icon={<Layers size={20} />}
            title={`No ${DIMENSION_NOUN.many} yet`}
            description={emptyHint ?? `A ${DIMENSION_NOUN.one} is something you want to report by, such as Location or Department. Define one here and you can pick its values while creating accounts.`}
            /* Both Add buttons wear the tour's handle, and only one of them is
               ever mounted: the empty state's, or the list footer's. */
            action={<Button data-walkthrough="dimensions-add" icon={<Plus size={14} />} onClick={openNew}>Add {DIMENSION_NOUN.one}</Button>}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-white overflow-clip">
          <div className="flex items-center h-8 bg-bg-subtle/60 border-b border-border px-4 text-11 text-fg-subtle">
            <span className="flex-1 min-w-0">{cap(DIMENSION_NOUN.one)}</span>
            <span className="w-[96px] shrink-0">Values</span>
            <span className="w-8 shrink-0" />
          </div>
          {dimensions.map((d, i) => (
            <div key={d.id} className={cn('flex items-center px-4 py-2.5', i > 0 && 'border-t border-border')}>
              <div className="flex-1 min-w-0">
                <span className="block text-13 text-fg truncate" style={{ fontWeight: 600 }}>{d.name}</span>
                {/* The values are what a report will actually offer, so a few of
                    them are on the row rather than one click away. */}
                <span className="block mt-0.5 text-11 text-fg-subtle truncate">
                  {d.values.length ? d.values.slice(0, 5).join(', ') : 'No values yet'}
                  {d.values.length > 5 && ` +${d.values.length - 5} more`}
                </span>
              </div>
              <span className="w-[96px] shrink-0 text-13 text-fg-muted tabular-nums">{d.values.length}</span>
              <span className="w-8 shrink-0 flex justify-end">
                <Menu align="right" trigger={
                  <button aria-label={`Actions for ${d.name}`} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-subtle hover:bg-bg-subtle hover:text-fg">
                    <Pencil size={13} />
                  </button>
                }>
                  {close => (
                    <>
                      <MenuItem icon={<Pencil size={14} />} onClick={() => { close(); openEdit(d) }}>Edit {DIMENSION_NOUN.one}</MenuItem>
                      {onDelete && (
                        <MenuItem icon={<X size={14} />} danger onClick={() => { close(); setConfirmDelete(d) }}>Remove</MenuItem>
                      )}
                    </>
                  )}
                </Menu>
              </span>
            </div>
          ))}
          <div className="border-t border-border px-4 py-2.5">
            <Button data-walkthrough="dimensions-add" variant="secondary" size="sm" icon={<Plus size={13} />} onClick={openNew}>Add {DIMENSION_NOUN.one}</Button>
          </div>
        </div>
      )}

      <DimensionFormModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        dimensions={dimensions}
        editing={editing === 'new' ? null : editing}
        initial={initial}
        onSubmit={draft => {
          if (editing === 'new') onCreate(draft)
          else if (editing) onUpdate(editing, { name: draft.name, values: draft.values, status: draft.status })
        }}
      />

      <ConfirmModal
        open={!!confirmDelete}
        tone="danger"
        badge="Remove"
        title={`Remove ${confirmDelete?.name ?? ''}?`}
        description={[
          `This deletes the ${DIMENSION_NOUN.one} and its ${confirmDelete?.values.length ?? 0} value${confirmDelete?.values.length === 1 ? '' : 's'}.`,
          // No "deactivate instead" here: this surface has no status to set.
          'Any account defaults using it are dropped.',
        ]}
        confirmLabel={`Remove ${DIMENSION_NOUN.one}`}
        dismissLabel="Cancel"
        onConfirm={() => { if (confirmDelete && onDelete) onDelete(confirmDelete.id); setConfirmDelete(null) }}
        onDismiss={() => setConfirmDelete(null)}
      />
    </div>
  )
})

/* The form on its own, so a surface that keeps its own list - the standing
   Dimensions page - can have the form without the editor's list under it, and so
   can a surface that keeps no list at all: an account's defaults offer it from
   the empty row and from under the table. Pulled out rather than copied, because
   a dimension defined from a setup step, one defined while creating an account
   and one defined from the standing page have to be the same thing.

   It owns the draft, seeded from `initial` each time it opens, so a caller
   holding no draft of its own does not have to invent one. */
export function DimensionFormModal({
  open, onClose, dimensions, editing = null, initial = EMPTY_DRAFT, onSubmit, valuesInUse,
}: {
  open: boolean
  onClose: () => void
  /** The ones already defined, so a name cannot be taken twice. */
  dimensions: Dimension[]
  /** The id being edited, or null while the modal is defining a new one. */
  editing?: string | null
  initial?: DimensionDraft
  /** The finished draft, with its name trimmed. Closing is the modal's own job. */
  onSubmit: (draft: DimensionDraft) => void
  /** Values an account or a posting uses, which can't be taken off the list. */
  valuesInUse?: Map<string, DimensionUse>
}) {
  const [draft, setDraft] = useState<DimensionDraft>(initial)
  // Seeded on the way open, not on every render: between opening and saving the
  // draft is the reader's, and `initial` is only where it started.
  useEffect(() => { if (open) setDraft(initial) }, [open])  // eslint-disable-line react-hooks/exhaustive-deps

  /* A name has to be there and has to be its own. Two dimensions called
     Department would be indistinguishable everywhere they are read - on an
     account's defaults, in a GL column header, in a filter. */
  const trimmed = draft.name.trim()
  const clash = dimensions.some(d => d.id !== editing && d.name.trim().toLowerCase() === trimmed.toLowerCase())
  const nameError = !trimmed ? undefined : clash ? `You already have a ${DIMENSION_NOUN.one} with this name.` : undefined

  /* A new dimension has to arrive with something to report by. An empty one is
     offered on every account and answers nothing, and the reader who made it has
     no way to tell from the list that it is unfinished. Not asked of an edit:
     dimensions predating the rule exist and still have to be renameable. */
  const needsValue = !editing && draft.values.length === 0

  const commit = () => {
    if (!trimmed || clash || needsValue) return
    onSubmit({ ...draft, name: trimmed })
    onClose()
  }

  return (
    <FormModal
      open={open}
      onClose={onClose}
      icon={<Layers size={16} />}
      title={editing ? `Edit ${DIMENSION_NOUN.one}` : `Add a ${DIMENSION_NOUN.one}`}
      subtitle="Name what you want to report by, then add its values."
      widthClass="max-w-[520px]"
      // A name and a value list have nothing to gain from edge-to-edge, and the
      // button costs the header enough width to wrap the subtitle onto a second
      // line.
      hideFullView
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={commit} disabled={!trimmed || clash || needsValue}>
            {editing ? 'Save changes' : `Add ${DIMENSION_NOUN.one}`}
          </Button>
        </div>
      }
    >
      {/* FormModal's body carries no padding of its own, so the form supplies
          it. px-6 to match the footer, which is the block directly below. */}
      <div className="px-6 py-5 space-y-4">
        <Input
          label="Name"
          required
          value={draft.name}
          onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
          placeholder="e.g. Location"
          error={nameError}
          autoFocus
        />
        <ValueListEditor
          values={draft.values}
          onChange={values => setDraft(d => ({ ...d, values }))}
          required={!editing}
          inUse={valuesInUse}
        />
      </div>
    </FormModal>
  )
}

/* The values, added one at a time. Free text rather than a fixed list because
   nobody else knows what a customer's locations are called, and a value is only
   ever a label on a report. */
function ValueListEditor({ values, onChange, required, inUse }: {
  values: string[]
  onChange: (v: string[]) => void
  /* A value an account carries or a posting was booked with stays on the list:
     removing it would leave them pointing at nothing (decision 89; module
     review, 2026-10-06, COA-02). Its pill wears a lock in place of the X, and
     says why on hover. Deactivating the dimension is how it stops being used. */
  inUse?: Map<string, DimensionUse>
  /* Whether the list has to be non-empty before the form can be submitted. True
     on create only: a dimension already in the chart may hold no values yet, and
     a gate that applied to it would block renaming the thing. */
  required?: boolean
}) {
  const [entry, setEntry] = useState('')
  const trimmed = entry.trim()
  const duplicate = values.some(v => v.toLowerCase() === trimmed.toLowerCase())

  const add = () => {
    if (!trimmed || duplicate) return
    onChange([...values, trimmed])
    setEntry('')
  }

  return (
    <div>
      {/* block, so the 6px below matches the gap Input puts under its own label. */}
      <span className="label block">Values</span>
      <div className="mt-1.5 flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <Input
            value={entry}
            onChange={e => setEntry(e.target.value)}
            // Enter adds, because typing a list of ten locations should not mean
            // ten trips to a button.
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            placeholder="e.g. London"
            error={trimmed && duplicate ? 'This value is already on the list.' : undefined}
          />
        </div>
        <Button variant="secondary" icon={<Plus size={14} />} onClick={add} disabled={!trimmed || duplicate}>Add</Button>
      </div>

      {values.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {values.map(v => {
            const use = inUse?.get(v)
            return (
            <span key={v} className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-subtle/60 pl-2.5 pr-1 py-0.5 text-13 text-fg">
              {v}
              {use ? (
                <span
                  data-value-in-use={v}
                  data-tip={`Used by ${describeUse(use)}, so it can't be removed.`}
                  aria-label={`${v} is used by ${describeUse(use)}, so it can't be removed`}
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-fg-subtle cursor-help"
                >
                  <Lock size={10} />
                </span>
              ) : (
              <button
                type="button"
                onClick={() => onChange(values.filter(x => x !== v))}
                aria-label={`Remove ${v}`}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-fg-subtle hover:bg-bg-muted hover:text-fg"
              >
                <X size={11} />
              </button>
              )}
            </span>
            )
          })}
        </div>
      )}

      {/* Sits under the whole field, so it clears the pills by more than they
          clear each other - otherwise it reads as a caption on the last pill. */}
      <p className="mt-2.5 text-11 text-fg-subtle">
        {required
          ? 'Add at least one value. You can add more later.'
          : 'You can add more values later.'}
      </p>
    </div>
  )
}
