import { useSyncExternalStore } from 'react';

/* ── Vendor invoicing and payments settings (Currency & Exchange Rates) ──
 * The A/P side's module defaults and exchange-rate permissions, plus the
 * prototype's acting role so the rate fields can be walked as someone who
 * may change a rate and someone who may not. Same store recipe as
 * useArSettings (omnesoft: prefix, so the boot sweep resets it). */

export type ApRole = 'Accounting Manager' | 'AP Clerk' | 'General User';

export const AP_ROLES: ApRole[] = ['Accounting Manager', 'AP Clerk', 'General User'];

/** Which date's exchange rate a new vendor invoice takes. */
export type RateDateBasis = 'invoiceDate' | 'receivingDate' | 'poDate';

export interface ApSettings {
  role: ApRole;
  /** Module default: the date whose rate a vendor invoice uses. */
  rateDateBasis: RateDateBasis;
  /** Module default: how far "We're paying" may be from "Vendor billed"
   *  before the invoice needs review, as a percentage of what was billed. */
  allowedDifferencePct: number;
  /** Optional cap in the base currency; null for none. */
  allowedDifferenceBase: number | null;
  /** Permission: roles that may change the exchange rate on an invoice. */
  invoiceRateRoles: ApRole[];
  /** Optional limit on that change, as a percentage either side of the
   *  rate table's rate; null for no limit. */
  invoiceRateLimitPct: number | null;
  /** Permission: roles that may change the exchange rate on a payment. */
  paymentRateRoles: ApRole[];
}

const STORAGE_KEY = 'omnesoft:ap-settings';

const DEFAULTS: ApSettings = {
  role: 'Accounting Manager',
  rateDateBasis: 'invoiceDate',
  allowedDifferencePct: 1,
  allowedDifferenceBase: null,
  invoiceRateRoles: ['Accounting Manager'],
  invoiceRateLimitPct: 2,
  paymentRateRoles: ['Accounting Manager'],
};

function load(): ApSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<ApSettings>) };
  } catch {
    return DEFAULTS;
  }
}

let current: ApSettings = load();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getApSettings(): ApSettings {
  return current;
}

export function updateApSettings(patch: Partial<ApSettings>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable: settings still apply for the session */
  }
  listeners.forEach((l) => l());
}

export function useApSettings(): ApSettings {
  return useSyncExternalStore(subscribe, getApSettings, () => DEFAULTS);
}

/* ── Rate date ─────────────────────────────────────────────────────── */

export const RATE_DATE_BASIS_LABEL: Record<RateDateBasis, string> = {
  invoiceDate: 'Vendor invoice date',
  receivingDate: 'Receiving date',
  poDate: 'PO date',
};

/** The date the invoice's rate is taken on, by the module's rate-date basis.
 *  An invoice without receivings or a PO (a standalone one) falls back to
 *  its vendor invoice date. */
export function rateDateFor(
  basis: RateDateBasis,
  dates: { invoiceDate?: string; receivingDate?: string; poDate?: string },
): { date: string | undefined; basis: RateDateBasis } {
  if (basis === 'receivingDate' && dates.receivingDate) return { date: dates.receivingDate, basis };
  if (basis === 'poDate' && dates.poDate) return { date: dates.poDate, basis };
  return { date: dates.invoiceDate, basis: 'invoiceDate' };
}

/* ── Permissions ───────────────────────────────────────────────────── */

export interface ApPermissions {
  canChangeInvoiceRate: boolean;
  /** Percent either side of the table's rate; null for no limit. */
  invoiceRateLimitPct: number | null;
  canChangePaymentRate: boolean;
}

export function apPermissionsFor(s: ApSettings): ApPermissions {
  return {
    canChangeInvoiceRate: s.invoiceRateRoles.includes(s.role),
    invoiceRateLimitPct: s.invoiceRateLimitPct,
    canChangePaymentRate: s.paymentRateRoles.includes(s.role),
  };
}

export function useApPermissions(): ApPermissions {
  return apPermissionsFor(useApSettings());
}

/** How far a typed rate is from the table's, in percent (signed). */
export function rateChangePct(typed: number, table: number): number {
  return ((typed - table) / table) * 100;
}

/** Whether "We're paying" is far enough from "Vendor billed" to need review. */
export function differenceNeedsReview(
  s: Pick<ApSettings, 'allowedDifferencePct' | 'allowedDifferenceBase'>,
  billed: number,
  paying: number,
  differenceInBase: number,
): boolean {
  const diff = Math.abs(paying - billed);
  if (diff < 0.005) return false;
  const pct = billed !== 0 ? (diff / Math.abs(billed)) * 100 : 100;
  if (pct > s.allowedDifferencePct + 1e-9) return true;
  return s.allowedDifferenceBase != null && Math.abs(differenceInBase) > s.allowedDifferenceBase;
}
