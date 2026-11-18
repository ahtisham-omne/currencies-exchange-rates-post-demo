import { useSyncExternalStore } from "react";
import { getCompanyName, isNewTenant } from "../../data/tenant";
import { BASE_CURRENCY } from "../../currency/currencies";

/* ── General Settings: the company profile and its global preferences ──
 * The values the General Settings prototype (alert-settings-omne, Company
 * Profile tab) shows for the sample company, kept for the session: saving an
 * edit changes them everywhere the page reads them, and a reload starts over,
 * as the rest of UAC's sample data does. The base currency is the one the
 * Currency & Exchange Rates module uses (PKR), chosen with the currency
 * dropdown every module shares. */

export interface CompanyProfile {
  legalName: string;
  address: string;
  email: string;
  /** Dialling code, e.g. "+1". */
  phoneCode: string;
  phone: string;
  website: string;
  industry: string;
  country: string;
  state: string;
  /** MM/DD/YYYY, as the page shows dates. */
  dateOfRegistration: string;
  /** Set by billing, not editable here. */
  billingAnchorDate: string;
}

export type TimeFormat = "12-hour" | "24-hour";
export type FirstDayOfWeek = "Saturday" | "Sunday" | "Monday";

export interface GlobalPreferences {
  timezone: string;
  dateFormat: string;
  timeFormat: TimeFormat;
  /** ISO 4217 code. */
  baseCurrency: string;
  language: string;
  firstDayOfWeek: FirstDayOfWeek;
  requireMfa: boolean;
}

export interface GeneralSettings {
  profile: CompanyProfile;
  preferences: GlobalPreferences;
}

export const INDUSTRIES = [
  "Manufacturing",
  "Distribution & Wholesale",
  "Retail",
  "Logistics & Transportation",
  "Construction",
  "Food & Beverage",
  "Pharmaceuticals",
  "Automotive",
  "Aerospace & Defense",
  "Electronics & Semiconductors",
  "Energy & Utilities",
  "Other",
] as const;

export const DATE_FORMATS = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"] as const;

let state: GeneralSettings = {
  profile: {
    // A company onboarding set up opens under its own legal name.
    legalName: isNewTenant() ? getCompanyName() : "Omnesoft Industries Inc.",
    address: "1200 Market Street, Suite 400, San Francisco, CA 94102, USA",
    email: "info@omnesoft.com",
    phoneCode: "+1",
    phone: "415 555 0100",
    website: "https://omnesoft.com",
    industry: "Manufacturing",
    country: "United States",
    state: "Delaware",
    dateOfRegistration: "03/03/2009",
    billingAnchorDate: "02/01/2024",
  },
  preferences: {
    timezone: "UTC",
    dateFormat: "MM/DD/YYYY",
    timeFormat: "12-hour",
    baseCurrency: BASE_CURRENCY,
    language: "English (US)",
    firstDayOfWeek: "Sunday",
    requireMfa: true,
  },
};

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useGeneralSettings(): GeneralSettings {
  return useSyncExternalStore(subscribe, () => state);
}

export function saveProfile(profile: CompanyProfile) {
  state = { ...state, profile };
  listeners.forEach((l) => l());
}

/* ── When the base currency locks ──────────────────────────────────────
 * Mahad, 2026-11-18: *"This locks after 1st transaction to the general
 * ledger."* Every amount the ledger holds is kept in the base currency, so
 * once anything has posted it can't change. The sample company has posted
 * since it opened its books; a company onboarding just set up has posted
 * nothing, so its base currency stays open until its first transaction.
 * Asked at render time, as the tenant can change while the app is open. */
export const FIRST_LEDGER_POSTING = { entry: "JE-2024-0001", date: "Jan 2, 2024" } as const;

/** Why the base currency can't change, or null while nothing has posted. */
export function baseCurrencyLock(code: string): string | null {
  if (isNewTenant()) return null;
  return `Locked after the first transaction posted to the general ledger (${FIRST_LEDGER_POSTING.entry}, ${FIRST_LEDGER_POSTING.date}). Every amount in the books is kept in ${code}, so it can't change.`;
}

export function savePreferences(preferences: GlobalPreferences) {
  state = { ...state, preferences };
  listeners.forEach((l) => l());
}
