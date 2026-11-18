/**
 * Types and constants for the Create User wizard.
 * Domain types are re-exported from the shared types module.
 */
export type {
  PhoneEntry,
  AddressEntry,
  EmergencyContact,
  CitizenshipEntry,
  LanguageEntry,
} from "../../types/shared";

import type {
  PhoneEntry,
  AddressEntry,
  EmergencyContact,
  CitizenshipEntry,
  LanguageEntry,
} from "../../types/shared";
import { roles as MAIN_ROLES, roleNameToOptionId } from "../../data/roles-data";

export interface AdditionalEmailEntry {
  email: string;
  type: string;
}

export interface AttachmentFile {
  id: string;
  name: string;
  size: string;
  type: string;
}

export interface AdditionalDetails {
  nickname: string;
  pronouns: string;
  languages: LanguageEntry[];
  additionalEmails: AdditionalEmailEntry[];
  phones: PhoneEntry[];
  addresses: AddressEntry[];
  emergencyContacts: EmergencyContact[];
  citizenships: CitizenshipEntry[];
  notes: string;
  attachments: AttachmentFile[];
}

export const EMAIL_TYPE_OPTIONS = ["Work", "Personal", "Other"] as const;

export interface RoleOption {
  id: string;
  name: string;
  license: "Full Access" | "Field User";
  description: string;
  usersCount: number;
  /** True for predefined system roles */
  isSystem?: boolean;
  /** True for the Account Owner role: shown in the Assign Roles step but never
   *  pickable there (ERP-5154 AC12). */
  isProtected?: boolean;
}

export interface CreateUserFormData {
  firstName: string;
  middleName: string;
  lastName: string;
  username: string;
  primaryEmail: string;
  gender: string;
  dateOfBirth: string;
  jobTitle: string;
  inviteLinkExpiry: string;
  additionalDetails: AdditionalDetails;
  assignedRoles: string[];
  primaryRole: string;
  /** Permissions granted to this user directly, outside any role, keyed by
   *  permission id. Owned here rather than inside the Permissions tab's grid so
   *  the selection survives switching back to the Roles tab, and so the license
   *  tier can be derived from roles and direct grants together. */
  directPermissions: Record<string, boolean>;
  profilePicture?: string | null;
}

/* ─── Static options ─── */

/**
 * Roles shown in the Assign Roles step: Create User → Step 2, Quick Invite →
 * Assign Roles, and the Reactivate and Unarchive steppers.
 *
 * Derived directly from the canonical `roles` array in `roles-data.ts` so the
 * selection surfaces (and Step 3 Review) automatically reflect anything
 * added/renamed/removed in the main Roles listing. Archived roles are filtered
 * out so they can't be assigned to a fresh user. The Account Owner stays in
 * the list as a disabled card: only Omne changes who holds it (ERP-5154 AC12,
 * ERP-5152 AC23, ERP-5172 AC13, ERP-5175 AC11), and a user who already holds
 * it keeps it picked.
 *
 * Do not hand-edit this list, edit `roles-data.ts` instead.
 */
export const ASSIGN_STEP_ROLES: RoleOption[] = MAIN_ROLES
  .filter((r) => r.status !== "Archived")
  .map((r) => ({
    id: roleNameToOptionId(r.roleName),
    name: r.roleName,
    license: r.licenseRequired,
    description: r.description,
    usersCount: r.usersCount,
    isSystem: r.isSystem,
    isProtected: r.isProtected,
  }));

/** The roles a person can actually pick. AddRolesModal reads this list, so the
 *  Account Owner can't be added to an existing user from the profile either. */
export const AVAILABLE_ROLES: RoleOption[] = ASSIGN_STEP_ROLES.filter((r) => !r.isProtected);

/** True for an option id that shows in the Assign Roles step but can't be
 *  picked or taken off there (the Account Owner). */
export function isLockedRoleOption(optionId: string): boolean {
  return !!ASSIGN_STEP_ROLES.find((r) => r.id === optionId)?.isProtected;
}

export const GENDER_OPTIONS = ["Male", "Female", "Non-binary", "Prefer not to say"];
export const EXPIRY_OPTIONS = ["24 hours", "3 days", "7 days", "14 days", "30 days"];
export const PRONOUN_OPTIONS = ["He/Him", "She/Her", "They/Them", "Ze/Zir", "Prefer not to say"];
export const RELATIONSHIP_OPTIONS = ["Spouse", "Parent", "Sibling", "Child", "Friend", "Other"];

export const LANGUAGE_OPTIONS = [
  { flag: "\u{1F1FA}\u{1F1F8}", name: "English", native: "EN" },
  { flag: "\u{1F1F5}\u{1F1F0}", name: "Urdu", native: "\u0627\u0631\u062F\u0648" },
  { flag: "\u{1F1EA}\u{1F1F8}", name: "Spanish", native: "Espa\u00F1ol" },
  { flag: "\u{1F1F8}\u{1F1E6}", name: "Arabic", native: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629" },
  { flag: "\u{1F1EB}\u{1F1F7}", name: "French", native: "Fran\u00E7ais" },
  { flag: "\u{1F1EE}\u{1F1F7}", name: "Persian", native: "\u0641\u0627\u0631\u0633\u06CC" },
  { flag: "\u{1F1E8}\u{1F1F3}", name: "Chinese", native: "\u7B80\u4F53\u4E2D\u6587" },
  { flag: "\u{1F1E9}\u{1F1EA}", name: "German", native: "Deutsch" },
  { flag: "\u{1F1F9}\u{1F1ED}", name: "Thai", native: "\u0E44\u0E17\u0E22" },
  { flag: "\u{1F1EE}\u{1F1F3}", name: "Hindi", native: "\u0939\u093F\u0928\u094D\u0926\u0940" },
  { flag: "\u{1F1F5}\u{1F1F9}", name: "Portuguese", native: "Portugu\u00EAs" },
  { flag: "\u{1F1EF}\u{1F1F5}", name: "Japanese", native: "\u65E5\u672C\u8A9E" },
  { flag: "\u{1F1F0}\u{1F1F7}", name: "Korean", native: "\uD55C\uAD6D\uC5B4" },
  { flag: "\u{1F1EE}\u{1F1F9}", name: "Italian", native: "Italiano" },
  { flag: "\u{1F1F3}\u{1F1F1}", name: "Dutch", native: "Nederlands" },
  { flag: "\u{1F1F7}\u{1F1FA}", name: "Russian", native: "\u0420\u0443\u0441\u0441\u043A\u0438\u0439" },
  { flag: "\u{1F1F9}\u{1F1F7}", name: "Turkish", native: "T\u00FCrk\u00E7e" },
  { flag: "\u{1F1F8}\u{1F1EA}", name: "Swedish", native: "Svenska" },
];

export const PROFICIENCY_OPTIONS = ["Native", "Fluent", "Advanced", "Intermediate", "Basic"];


export const COUNTRY_CODES = [
  { code: "+1", flag: "\u{1F1FA}\u{1F1F8}", label: "US" },
  { code: "+44", flag: "\u{1F1EC}\u{1F1E7}", label: "UK" },
  { code: "+91", flag: "\u{1F1EE}\u{1F1F3}", label: "IN" },
  { code: "+49", flag: "\u{1F1E9}\u{1F1EA}", label: "DE" },
  { code: "+33", flag: "\u{1F1EB}\u{1F1F7}", label: "FR" },
  { code: "+81", flag: "\u{1F1EF}\u{1F1F5}", label: "JP" },
  { code: "+86", flag: "\u{1F1E8}\u{1F1F3}", label: "CN" },
  { code: "+61", flag: "\u{1F1E6}\u{1F1FA}", label: "AU" },
  { code: "+971", flag: "\u{1F1E6}\u{1F1EA}", label: "AE" },
  { code: "+55", flag: "\u{1F1E7}\u{1F1F7}", label: "BR" },
];

export const COUNTRY_OPTIONS = [
  "United States", "United Kingdom", "India", "Germany", "France",
  "Japan", "China", "Australia", "United Arab Emirates", "Brazil",
  "Canada", "Mexico", "South Korea", "Italy", "Spain",
];