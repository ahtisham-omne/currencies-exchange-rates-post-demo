import { useSyncExternalStore } from 'react';

/* ── System settings (8/5/26 review) ──────────────────────────────────
 * Company-setup-level switches, not per-view UI prefs. GL depth on
 * confirmations is for controllers, not every user; the payment run ID
 * format is a company convention. Backed by localStorage with a module
 * store so every consumer (including non-React code like nextRunId)
 * reads the same values. */

export type RunIdFormat = 'iso' | 'mmddyy';

export type ReceivingDateBasis = 'earliest' | 'latest';

export interface SystemSettings {
  /** Debits and credits shown inside record-payment and prepayment
   *  confirmation steps. The GL Impact tabs on detail pages always stay. */
  showGlOnConfirmations: boolean;
  runIdFormat: RunIdFormat;
  /** When an invoice spans multiple receivings and the payment term's
   *  trigger is Receiving, which receiving date starts the payment clock
   *  (8/25/26 meeting). Default is latest. */
  receivingDateBasis: ReceivingDateBasis;
  /** Company Setup → document numbering (FAD 11/2): the number printed on
   *  customer invoices. No module-only numbering screen. */
  customerInvoiceNumbering: DocumentNumbering;
}

export interface DocumentNumbering {
  prefix: string;
  digits: number;
  start: number;
}

export function formatDocumentNumber(n: DocumentNumbering, seq: number): string {
  return `${n.prefix}${String(seq).padStart(n.digits, '0')}`;
}

const STORAGE_KEY = 'omnesoft:system-settings';

const DEFAULTS: SystemSettings = {
  showGlOnConfirmations: true,
  runIdFormat: 'iso',
  receivingDateBasis: 'latest',
  customerInvoiceNumbering: { prefix: 'SI-', digits: 6, start: 1 },
};

function load(): SystemSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<SystemSettings>) };
  } catch {
    return DEFAULTS;
  }
}

let current: SystemSettings = load();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Read outside React (e.g. nextRunId in the data layer). */
export function getSystemSettings(): SystemSettings {
  return current;
}

export function updateSystemSettings(patch: Partial<SystemSettings>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable: settings still apply for the session */
  }
  listeners.forEach((l) => l());
}

export function useSystemSettings(): SystemSettings {
  return useSyncExternalStore(subscribe, getSystemSettings, () => DEFAULTS);
}
