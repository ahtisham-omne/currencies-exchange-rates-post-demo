import { useSyncExternalStore } from 'react';

/* ── Customer invoicing settings + role (PRD §15, BR-011, D6) ────────
 * Company settings for the AR module plus the prototype's acting role,
 * so reviewers can walk the flow as a clerk or an approver. Same store
 * recipe as useSystemSettings (omnesoft: prefix, so the boot sweep
 * resets it). Vendor settings are untouched. */

export type ArRole = 'Accounting Manager' | 'Billing Clerk' | 'Sales Rep' | 'General User';

export const AR_ROLES: ArRole[] = ['Accounting Manager', 'Billing Clerk', 'Sales Rep', 'General User'];

/** FAD 11/2 pre-invoice treatment. Never: hold the money as a deposit until
 *  goods ship. Always: book revenue at invoice and lock the units.
 *  Optional: the user picks per invoice, starting from the default. */
export type PreInvoiceTreatmentMode = 'Never' | 'Always' | 'Optional';

export interface ArSettings {
  role: ArRole;
  /** BR-011: the A/R account on an invoice can be changed. */
  allowArOverride: boolean;
  /** PRD §8.4: the customer deposit account on an advance can be changed. */
  allowDepositOverride: boolean;
  /** D6: when off, a finished invoice approves on submit for anyone. */
  approvalRequired: boolean;
  companyName: string;
  /** Book pre-invoices as revenue: Never / Always / Optional. */
  preInvoiceTreatment: PreInvoiceTreatmentMode;
  /** Optional mode: what a new pre-invoice starts as. */
  preInvoiceDefault: 'Revenue' | 'Deposit';
  /** (Proposed) Revenue only for units on hand and allocatable. */
  revenueGate: boolean;
}

const STORAGE_KEY = 'omnesoft:ar-settings';

const DEFAULTS: ArSettings = {
  role: 'Accounting Manager',
  allowArOverride: false,
  allowDepositOverride: false,
  approvalRequired: true,
  companyName: 'Omnesoft Industries',
  preInvoiceTreatment: 'Optional',
  preInvoiceDefault: 'Deposit',
  revenueGate: true,
};

function load(): ArSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<ArSettings>) };
  } catch {
    return DEFAULTS;
  }
}

let current: ArSettings = load();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getArSettings(): ArSettings {
  return current;
}

export function updateArSettings(patch: Partial<ArSettings>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable: settings still apply for the session */
  }
  listeners.forEach((l) => l());
}

export function useArSettings(): ArSettings {
  return useSyncExternalStore(subscribe, getArSettings, () => DEFAULTS);
}

// Permission matrix (PRD §15). Users without a permission don't see the button.
export interface ArPermissions {
  canCreate: boolean;
  /** Sales Rep: advance invoices from a quote only. */
  advanceFromQuoteOnly: boolean;
  canApprove: boolean;
  canSend: boolean;
  canChangePrice: boolean;
  canChangeArAccount: boolean;
}

export function permissionsFor(s: ArSettings): ArPermissions {
  const r = s.role;
  return {
    canCreate: r === 'Accounting Manager' || r === 'Billing Clerk' || r === 'Sales Rep',
    advanceFromQuoteOnly: r === 'Sales Rep',
    // D6: with approval off, everyone who can create finishes straight to Approved.
    canApprove: r === 'Accounting Manager' || (!s.approvalRequired && r === 'Billing Clerk'),
    canSend: r === 'Accounting Manager' || r === 'Billing Clerk',
    canChangePrice: r === 'Accounting Manager',
    canChangeArAccount: r === 'Accounting Manager' && s.allowArOverride,
  };
}

export function useArPermissions(): ArPermissions {
  return permissionsFor(useArSettings());
}
