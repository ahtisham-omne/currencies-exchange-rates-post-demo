/**
 * Permission licence tiers.
 *
 * Every permission requires either a Full Access or a Field User seat. There is
 * no third value and no permission is without one. The split is a fixed product
 * decision, not something derived from a permission's wording.
 *
 * The seat comes from the License column of each module's own story, as gathered
 * in the compiled Permission Catalogue (Pioneer): of the 129 permissions active
 * across its 19 modules, 18 are on Field User and the rest on Full Access.
 * General Settings (ERP-7228) and Module Defaults (ERP-8617) are Full Access
 * throughout, so they do not move this list. View declared value on shipment
 * documents is a Field User permission in the story, but it is deferred out of
 * Pioneer and parked in BACKLOGGED_PERMISSIONS. Its id stays on the list below
 * so restoring it needs no change here, and it counts toward nothing while
 * parked. This supersedes the flat ERP-6378 licence table,
 * which enumerated 120 permissions and put 13 on Field User. ERP-6378 predates
 * the Sales Orders story's licence column, so it missed the six Sales Orders
 * permissions the module story puts on a field seat. Where the two disagree the
 * module story wins, which is the compilation's own rule.
 *
 * Used by:
 *   - the licence chip on a permission card and in the permission detail window
 *   - the module / row / detail "Requires Full Access" chips
 *   - the licence-raise warning in the role create and edit flows
 *   - identifying users whose seat is too small for a role
 *
 * WHY A LIST AND NOT A RULE. This used to classify by name pattern ("Create",
 * "Manage", "Execute", …) with an ambiguous-means-Full-Access default. Two
 * permissions the spec puts on Field User matched no pattern at all, Print
 * receiving labels and the since-deferred View declared value on shipment
 * documents, so the default
 * silently made them Full Access. A permission's seat has to be the same
 * everywhere and stable over time, which a heuristic over display copy cannot
 * promise: renaming a permission would move its licence. The table is the
 * source of truth now, and anything not on it requires Full Access.
 *
 * The three post-Pioneer Receiving permissions (Log and resolve discrepancies,
 * Edit receipts after confirmation, Void a confirmed receipt) are Full Access
 * like any other permission. They cannot be turned on in Pioneer, so they never
 * move a role's tier on their own.
 */

import { PERMISSION_MODULES, type Permission } from "../data/permissions-data";
import type { LicenseType, UserRow } from "../data/users-data";

/**
 * The 18 active permissions a Field User seat can hold, plus the parked
 * ship-view-value. Everything else in the
 * catalogue requires Full Access. Keyed by permission id, so renaming a
 * permission's display copy cannot move its licence.
 */
export const FIELD_USER_PERMISSION_IDS: ReadonlySet<string> = new Set([
  // Cycle Count
  "cc-access",        // Access Cycle Count module
  "cc-execute",       // Execute cycle counts
  // Physical Inventory
  "pi-access",        // Access Physical Inventory module
  "pi-quarantine",    // Quarantine and check out inventory
  // Receiving
  "rcv-access",       // Access Receiving module
  "rcv-receive",      // Confirm receipt of goods
  "rcv-labels",       // Print receiving labels
  // Inventory Movement
  "mv-access",        // Access Inventory Movement module
  "mv-execute",       // Execute movements
  // Shipments
  "ship-access",      // Access Shipments module
  "ship-pick",        // Execute picking tasks
  "ship-dispatch",    // Confirm departure
  "ship-view-value",  // View declared value on shipment documents (backlogged)
  /* Sales Orders. ERP-5548 puts the read-and-work-the-order half of the module
   * on a field seat: opening orders, seeing their pricing, editing content,
   * attachments, rep assignment, and single-record export. The commercial and
   * operational half stays Full Access: the pricing rule pair, one-time
   * discounts, Operations Access, the allocation pair, cancel or archive, and
   * bulk export. */
  "so-access",        // Access Sales Orders module
  "so-view-pricing",  // View pricing on sales orders
  "so-create",        // Create and edit sales orders
  "so-attachments",   // Manage sales order attachments
  "so-manage-reps",   // Manage sales representatives on sales orders
  "so-export",        // Print and export sales orders
]);

/** Returns true if the permission requires a Full Access license. */
export function permissionRequiresFullAccess(permission: Permission): boolean {
  return !FIELD_USER_PERMISSION_IDS.has(permission.id);
}

/** The seat a single permission needs, as the value the UI renders. */
export function permissionLicenseRequirement(
  permission: Permission
): "Full Access" | "Field User" {
  return permissionRequiresFullAccess(permission) ? "Full Access" : "Field User";
}

/** Highest license required across a module's permissions. */
export function moduleLicenseRequirement(
  moduleId: string
): "Full Access" | "Field User" | null {
  const mod = PERMISSION_MODULES.find((m) => m.id === moduleId);
  if (!mod || mod.permissions.length === 0) return null;
  let hasField = false;
  for (const p of mod.permissions) {
    if (permissionRequiresFullAccess(p)) return "Full Access";
    hasField = true;
  }
  return hasField ? "Field User" : null;
}

/**
 * Compute the license tier required by a set of toggled permissions.
 * If any "on" permission requires Full Access, role tier is Full Access.
 * Otherwise (or if nothing is on) the tier is Field User.
 */
export function computeRoleTier(
  toggles: Record<string, boolean>
): "Full Access" | "Field User" {
  for (const mod of PERMISSION_MODULES) {
    for (const p of mod.permissions) {
      if (toggles[p.id] && permissionRequiresFullAccess(p)) {
        return "Full Access";
      }
    }
  }
  return "Field User";
}

/** Users whose license is insufficient for the given role tier. */
export function findUnderLicensedUsers<T extends Pick<UserRow, "license">>(
  users: T[],
  requiredLicense: LicenseType
): T[] {
  if (requiredLicense !== "Full Access") return [];
  return users.filter(
    (u) => u.license === "Field User" || u.license === "No License"
  );
}

/**
 * The seat a user should be created with, from the roles assigned to them and
 * the permissions granted to them directly.
 *
 * Unlike a role, which always requires one of the two paid seats, a user can
 * legitimately hold nothing at all. Creating a user is an identity action, not
 * an access grant, so an admin who walks past the Roles & Permissions step gets
 * an account that costs nothing and can do nothing until access is assigned.
 *
 *   nothing selected                  → "No License"
 *   anything needing a full seat      → "Full Access"
 *   otherwise                         → "Field User"
 *
 * Both inputs are weighed the same way: a Full Access role and a single
 * directly-granted Full Access permission each raise the seat on their own.
 */
export function deriveUserLicense(
  roleLicenses: ReadonlyArray<LicenseType>,
  directToggles: Record<string, boolean> = {}
): LicenseType {
  const hasDirect = Object.values(directToggles).some(Boolean);
  if (roleLicenses.length === 0 && !hasDirect) return "No License";
  if (roleLicenses.includes("Full Access")) return "Full Access";
  if (hasDirect && computeRoleTier(directToggles) === "Full Access") {
    return "Full Access";
  }
  return "Field User";
}
