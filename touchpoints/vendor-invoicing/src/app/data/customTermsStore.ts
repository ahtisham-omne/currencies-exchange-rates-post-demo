import { useSyncExternalStore } from 'react';
import type { PaymentTermPreset } from './paymentTermPresets';

/* ── Runtime custom payment terms (9/1/26) ────────────────────────────
 * Session-scoped store behind the Create Payment Term flow: terms the
 * user creates or duplicates while invoicing land here and surface in
 * the browse catalog next to the static presets. Also carries the
 * lifecycle status (active/inactive/archived) the term detail modal's
 * Archive and Disable actions write, for custom terms only — presets
 * are immutable. Deliberately NOT persisted: refresh resets state
 * (user-testing requirement, see main.tsx boot sweep). */

export type RuntimeTermStatus = 'active' | 'inactive' | 'archived';

let runtimeTerms: PaymentTermPreset[] = [];
let statuses: Record<string, RuntimeTermStatus> = {};
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function addRuntimeTerm(term: PaymentTermPreset) {
  runtimeTerms = [...runtimeTerms, term];
  emit();
}

export function findRuntimeTerm(labelOrId: string): PaymentTermPreset | undefined {
  return runtimeTerms.find((t) => t.name === labelOrId || t.id === labelOrId);
}

export function getTermStatus(id: string): RuntimeTermStatus {
  return statuses[id] ?? 'active';
}

export function setTermStatus(id: string, status: RuntimeTermStatus) {
  statuses = { ...statuses, [id]: status };
  emit();
}

/** Live list of runtime-created terms (browse catalog merge). */
export function useRuntimeTerms(): PaymentTermPreset[] {
  return useSyncExternalStore(subscribe, () => runtimeTerms);
}

/** Live status map (term detail status pill + lifecycle actions). */
export function useTermStatuses(): Record<string, RuntimeTermStatus> {
  return useSyncExternalStore(subscribe, () => statuses);
}
