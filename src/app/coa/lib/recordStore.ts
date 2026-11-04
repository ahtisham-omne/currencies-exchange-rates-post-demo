// Ported from chart-of-accounts-v2.1/src/store.ts (recordNotes / removedNotes / addRecordNote / removeRecordNote / restoreRecordNote, accountAttachments) and src/lib/notes.ts (RecordNote, noteKey); adapted: an in-memory module store read with useSyncExternalStore, keyed by any record key.
import { useSyncExternalStore } from 'react'
import { uid } from './utils'
import type { AttachmentFile } from '../components/AttachmentsTab'

/* ─────────────────────────── A record's notes and files ───────────────────────────
   What the team wrote against a record and the files they attached, keyed by the
   record (`recordKey('currency', 'USD')` = "currency:USD"). In memory only: it
   survives navigation and resets on reload, like the currency contexts do. */

export interface RecordNote {
  id: string
  text: string
  author: string
  at: string
  /** Where a note carried over came from, drawn as a chip before its author. */
  tag?: string
}

/** The key a record's notes and files are kept under: one slice for every kind. */
export const recordKey = (kind: string, id: string) => `${kind}:${id}`
/** CoA's name for the same thing. */
export const noteKey = recordKey

interface State {
  recordNotes: Record<string, RecordNote[]>
  removedNotes: string[]
  attachments: Record<string, AttachmentFile[]>
}

let state: State = { recordNotes: {}, removedNotes: [], attachments: {} }
const listeners = new Set<() => void>()
const set = (fn: (s: State) => Partial<State>) => { state = { ...state, ...fn(state) }; listeners.forEach(l => l()) }
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }

export function useRecordStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => select(state), () => select(state))
}

export const recordStore = {
  getState: () => state,
  addRecordNote: (key: string, text: string, author = 'Ahtisham Ahmad (You)') => set(s => ({
    recordNotes: { ...s.recordNotes, [key]: [{ id: uid('note'), text, author, at: new Date().toISOString() }, ...(s.recordNotes[key] ?? [])] },
  })),
  /** Takes a note off; Undo hands the same note back to `restoreRecordNote`. */
  removeRecordNote: (key: string, note: RecordNote) => set(s => ({
    recordNotes: { ...s.recordNotes, [key]: (s.recordNotes[key] ?? []).filter(n => n.id !== note.id) },
    removedNotes: s.removedNotes.includes(note.id) ? s.removedNotes : [...s.removedNotes, note.id],
  })),
  /** `written`: the reader wrote it, so it goes back on the record as well. A
   *  derived note only stops being hidden. */
  restoreRecordNote: (key: string, note: RecordNote, written: boolean) => set(s => ({
    removedNotes: s.removedNotes.filter(id => id !== note.id),
    recordNotes: written && !(s.recordNotes[key] ?? []).some(n => n.id === note.id)
      ? { ...s.recordNotes, [key]: [note, ...(s.recordNotes[key] ?? [])] }
      : s.recordNotes,
  })),
  setAttachments: (key: string, files: AttachmentFile[]) => set(s => ({ attachments: { ...s.attachments, [key]: files } })),
}

const NO_FILES: AttachmentFile[] = []
/** A record's files, seeded once from `seed` the first time the record is read. */
export function useRecordAttachments(key: string, seed?: () => AttachmentFile[]): [AttachmentFile[], (files: AttachmentFile[]) => void] {
  const files = useRecordStore(s => s.attachments[key])
  if (files === undefined && seed) {
    // Seeding is a one-off write outside render's view: queue it.
    const initial = seed()
    queueMicrotask(() => { if (recordStore.getState().attachments[key] === undefined) recordStore.setAttachments(key, initial) })
    return [initial, f => recordStore.setAttachments(key, f)]
  }
  return [files ?? NO_FILES, f => recordStore.setAttachments(key, f)]
}
