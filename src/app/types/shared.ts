/**
 * Shared domain types used across create-user wizard and user-detail pages.
 * Single source of truth: all modules re-export from here.
 */

export interface PhoneEntry {
  type: string;
  countryCode: string;
  number: string;
}

export interface AddressEntry {
  type: string;
  address: string;
}

export interface EmergencyContact {
  fullName: string;
  relationship: string;
  countryCode: string;
  phone: string;
  isPrimary?: boolean;
}

export interface CitizenshipEntry {
  country: string;
  isPrimary: boolean;
}

export interface LanguageEntry {
  language: string;
  proficiency: string;
  flag?: string;
}
