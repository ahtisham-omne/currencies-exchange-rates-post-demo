// Ported from chart-of-accounts-v2.1/src/store.ts (toasts slice: ToastMsg, pushToast, dismissToast); adapted: a tiny module store read with useSyncExternalStore instead of zustand.
import { useSyncExternalStore } from 'react'
import { uid } from './utils'

export interface ToastMsg {
  id: string
  message: string
  tone: 'success' | 'info' | 'danger'
  description?: string
  // Optional inline action (e.g. "Undo"). Rendered as a small button; clicking
  // runs onClick and then dismisses the toast.
  action?: { label: string; onClick: () => void }
}

let toasts: ToastMsg[] = []
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

function subscribe(l: () => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}
const snapshot = () => toasts

/** Fire a toast. Same signature and timings as CoA's store: auto-dismisses after
 *  4000ms, or 7000ms when it carries an action so the reader has time to act. */
export function pushToast(message: string, tone: ToastMsg['tone'] = 'success', description?: string, action?: ToastMsg['action']): string {
  const id = uid('toast')
  toasts = [...toasts, { id, message, tone, description, action }]
  emit()
  // Toasts with an action linger longer so the user has time to act (e.g. Undo).
  setTimeout(() => dismissToast(id), action ? 7000 : 4000)
  return id
}

export function dismissToast(id: string) {
  if (!toasts.some(t => t.id === id)) return
  toasts = toasts.filter(t => t.id !== id)
  emit()
}

export function useToasts(): ToastMsg[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

/** CoA call sites read `useStore.getState().pushToast(...)`; this keeps that shape
 *  available for code ported verbatim. */
export const toastStore = { getState: () => ({ pushToast, dismissToast, toasts }) }
