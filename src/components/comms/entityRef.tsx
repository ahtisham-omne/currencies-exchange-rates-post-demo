/* Ported from the financial reporting module's comms cluster
   (components/fr/comms/entityRef.ts and its ENTITY_META table).

   The reference is stored prefixed and displayed bare. The chrome around the
   chip already names the kind, through the chip's own colour and the type label
   printed next to it, so repeating the prefix inside the chip says the same
   word twice. Prefixes differ from the source's because the records do: it
   files mail against reports, templates and automations, this module files it
   against accounts and journal entries.

     formatEntityRef('ACC-1000')  => '1000'
     formatEntityRef('JE-0042')   => '0042'
     formatEntityRef('Unmatched') => 'Unmatched'

   The sentinels carry no prefix and come back untouched. */
import type { CommRecordKind } from '../../lib/comms'

export function formatEntityRef(ref: string | undefined | null): string {
  if (!ref) return ''
  if (ref === 'Unmatched' || ref === 'No record') return ref
  return ref.replace(/^[A-Z]+-/, '')
}

/* The chip tints, in the source's order, so a chip reads with the weight it did
   there. Only the kinds are this module's. */
export const ENTITY_META: Record<CommRecordKind, { color: string; bg: string; border: string }> = {
  'Account': { color: 'var(--color-sky-500)', bg: 'var(--color-brand-75)', border: 'var(--color-blue-200)' },
  'Journal Entry': { color: 'var(--color-emerald-600)', bg: 'var(--color-emerald-50)', border: 'var(--color-emerald-200)' },
  'Other': { color: 'var(--color-slate-500)', bg: 'var(--color-slate-100)', border: 'var(--color-slate-300)' },
}

/** The label printed beside the chip. `Other` means the thread is not filed
 *  against anything, which is what the Unmatched mailbox collects. */
export function entityLabelOf(kind: CommRecordKind): string {
  return kind === 'Other' ? 'Unmatched' : kind
}
