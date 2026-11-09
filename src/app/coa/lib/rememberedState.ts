import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'

/* State a page gets back when the reader comes back to it.

   A list page loses everything in `useState` the moment the reader opens a row,
   because the detail page replaces it and it unmounts. So a reader who searched
   the chart for "petty", opened Petty Cash and pressed Back came home to an empty
   search box and the whole chart. Design review, 2026-09-28 - Eli: *"When I
   click on a detail and I go back, I lose the search that I'm looking at and it
   forgets it."*

   Held in memory for the tab's session rather than in storage: coming back from
   a detail page is the case, and a reload starting the page afresh is what a
   reload is for. Keyed by the caller, so each page keeps its own.

   The key may be left out, for a shared piece (the chart's table, a table's
   look) that one caller wants remembered and another does not: without a key
   it is plain state and nothing is kept. */
const memory = new Map<string, unknown>()

export function useRememberedState<T>(key: string | undefined, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (key && memory.has(key)) return memory.get(key) as T
    return typeof initial === 'function' ? (initial as () => T)() : initial
  })
  const set = useCallback<Dispatch<SetStateAction<T>>>(next => {
    setValue(prev => {
      const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
      if (key) memory.set(key, v)
      return v
    })
  }, [key])
  return [value, set]
}

/** What a remembered value was left at, for code that has to read it outside the hook. */
export function rememberedValue<T>(key: string): T | undefined {
  return memory.get(key) as T | undefined
}

/** Forget everything - for tests, and for a demo reset that should start clean. */
export function forgetRememberedState() {
  memory.clear()
}

/* A choice the reader expects back after a reload too, like how many records a
   page shows: kept in this browser's storage under the key. Storage can be
   missing or full (a private window, say); the choice then lasts as long as
   the page does. */
const STORED_PREFIX = 'omne.coa:'

function readStored<T>(key: string): { value: T } | null {
  try {
    const raw = window.localStorage.getItem(STORED_PREFIX + key)
    return raw == null ? null : { value: JSON.parse(raw) as T }
  } catch {
    return null
  }
}

export function useStoredState<T>(key: string | undefined, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => (key ? readStored<T>(key)?.value ?? initial : initial))
  const set = useCallback<Dispatch<SetStateAction<T>>>(next => {
    setValue(prev => {
      const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
      if (key) {
        try { window.localStorage.setItem(STORED_PREFIX + key, JSON.stringify(v)) } catch { /* kept for this page only */ }
      }
      return v
    })
  }, [key])
  return [value, set]
}
