/* Ported from the reporting module's comms cluster (its composePopoutRegistry.ts).

   Three dock slots along the bottom edge: left, center, right. A popout reserves
   one on mount, so a second compose lands beside the first instead of on top of
   it. When all three are taken the oldest is evicted and its slot reused, which
   is why the `forceClose` a popout hands in has to be a hard unmount: a
   "discard draft?" prompt at that point would leave the slot occupied by a
   popout the user has already lost.

   State is module-level on purpose. Every host's popouts share the same dock
   space, so a registry owned by any single host would not help. */

export type PopoutDockPos = 'left' | 'center' | 'right'

interface Slot {
  id: string
  dock: PopoutDockPos
  forceClose: () => void
  openedAt: number
}

let slots: Slot[] = []
const listeners = new Set<() => void>()

/* Right first, because the bottom-right corner is where a compose is expected.
   Then left, the opposite corner, so two open popouts sit at the edges with the
   middle as breathing room: on a 1280-1440px viewport the right + center pair
   overlapped geometrically. Center is the last-resort slot. */
const DOCK_PREFERENCE: PopoutDockPos[] = ['right', 'left', 'center']

function notify() {
  listeners.forEach(fn => fn())
}

export function getPopoutSlots(): readonly Slot[] {
  return slots
}

export function subscribePopoutRegistry(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function freeDocks(excludeId?: string): PopoutDockPos[] {
  return DOCK_PREFERENCE.filter(d => !slots.some(s => s.dock === d && s.id !== excludeId))
}

/** Allocate a dock for a newly-mounting popout, evicting the oldest and reusing
 *  its slot when all three are occupied. */
export function reservePopoutDock(id: string, forceClose: () => void): PopoutDockPos {
  const existing = slots.find(s => s.id === id)
  if (existing) return existing.dock

  const free = freeDocks()
  let dock: PopoutDockPos
  if (free.length > 0) {
    dock = free[0]
  } else {
    const oldest = slots.reduce((a, b) => (a.openedAt < b.openedAt ? a : b))
    dock = oldest.dock
    slots = slots.filter(s => s.id !== oldest.id)
    // Deferred to a microtask: reservation runs inside another component's
    // render, and calling forceClose synchronously would set state during it.
    Promise.resolve().then(() => oldest.forceClose())
  }
  slots = [...slots, { id, dock, forceClose, openedAt: Date.now() }]
  notify()
  return dock
}

/** Move a registered popout to a new dock, shifting whatever sits there to the
 *  next free dock, or closing it when none is free. */
export function setPopoutDock(id: string, newDock: PopoutDockPos): void {
  const self = slots.find(s => s.id === id)
  if (!self || self.dock === newDock) {
    if (self) return
    slots = slots.map(s => (s.id === id ? { ...s, dock: newDock } : s))
    notify()
    return
  }

  const conflict = slots.find(s => s.id !== id && s.dock === newDock)
  slots = slots.map(s => (s.id === id ? { ...s, dock: newDock } : s))

  if (conflict) {
    const free = freeDocks(conflict.id)
    if (free.length > 0) {
      slots = slots.map(s => (s.id === conflict.id ? { ...s, dock: free[0] } : s))
    } else {
      slots = slots.filter(s => s.id !== conflict.id)
      Promise.resolve().then(() => conflict.forceClose())
    }
  }
  notify()
}

/** Remove a popout from the registry on unmount. */
export function releasePopoutDock(id: string): void {
  if (!slots.some(s => s.id === id)) return
  slots = slots.filter(s => s.id !== id)
  notify()
}
