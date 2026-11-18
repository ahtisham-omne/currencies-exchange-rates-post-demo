/**
 * Helpers for classifying a role (by name string) by required license tier
 * and for detecting roles that are inaccessible to a user given their
 * current license.
 *
 * Centralizes the heuristic previously duplicated inside OverflowTooltip's
 * synthetic role data so the user listing table, user overview banner,
 * and user-detail Roles tab all show consistent license-mismatch warnings.
 */

import type { LicenseType, UserRow } from "../data/users-data";
import { roles as ALL_ROLES } from "../data/roles-data";

const FULL_ACCESS_NAME_KEYWORDS = [
  "manager",
  "admin",
  "head",
  "lead",
  "officer",
  "director",
  "owner",
];

/**
 * Classify a free-form role name (e.g. "warehouse manager", "tester")
 * into the license tier it requires.
 *
 * 1. If the name matches a real role in `roles-data`, use that role's
 *    `licenseRequired` exactly.
 * 2. Otherwise fall back to a keyword heuristic: roles whose name contains
 *    manager/admin/head/lead/officer/director/owner are treated as
 *    "Full Access"; everything else is "Field User".
 */
export function getRoleLicenseRequirement(roleName: string): LicenseType {
  const lower = roleName.toLowerCase();
  const exact = ALL_ROLES.find((r) => r.roleName.toLowerCase() === lower);
  if (exact) return exact.licenseRequired;
  return FULL_ACCESS_NAME_KEYWORDS.some((k) => lower.includes(k))
    ? "Full Access"
    : "Field User";
}

/** Title-case a role name for display in tables ("sales director" → "Sales Director"). */
export function toTitleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Returns the subset of a user's assigned role names whose required license
 * tier is higher than what their current license can satisfy.
 *
 * - "Full Access" users  → no roles are inaccessible.
 * - "Field User" users   → roles requiring Full Access are inaccessible.
 * - "No License" users   → ALL roles are inaccessible.
 *
 * Archived users intentionally are not flagged here, that state is handled
 * by separate UX (status badge + page banner) and is not a license mismatch.
 */
export function getLicenseInaccessibleRoles(
  license: LicenseType | UserRow["license"],
  assignedRoles: string[],
): string[] {
  if (license === "Full Access") return [];
  if (license === "No License") return assignedRoles.slice();
  // Field User
  return assignedRoles.filter(
    (r) => getRoleLicenseRequirement(r) === "Full Access",
  );
}
