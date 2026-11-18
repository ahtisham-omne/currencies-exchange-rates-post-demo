/**
 * Directly-assigned permissions per user.
 *
 * Most access comes from a user's roles (see role-permissions-map). A few users
 * additionally hold one or two permissions granted to them directly, a
 * deliberate, sparse set of realistic one-off grants (an extra capability the
 * person's role doesn't include, or a grant that also happens to be covered by
 * a role, producing the "Directly Assigned + Inherited" state in the UI).
 *
 * Permission IDs are the verified source of truth (permissions-data.ts).
 * Keeping the list small and intentional avoids the "everyone randomly has
 * dozens of direct grants" feel of seeded/hashed mock data.
 */

export const USER_DIRECT_PERMISSIONS: Record<number, string[]> = {
  1: ["ur-view-audit"],     // Ahtisham: audit visibility on top of his ops roles
  2: ["mfa-access"],        // Faizan: MFA console visibility
  7: ["po-access"],         // Muhammad: can view purchase orders
  12: ["po-create"],        // Malachi: also granted via Procurement role (both sources)
  13: ["wl-create-edit"],   // Fabian: manage locations on top of Operations
  21: ["item-view-cost"],   // Marcus: cost visibility for engineering/project work
  30: ["po-create"],        // Elena: can raise POs alongside Finance
  35: ["ur-view-billing"],  // Oleg: billing visibility
  40: ["ur-view-audit"],    // Nadia: audit visibility for HR
  44: ["qt-edit"],          // Sienna: can edit quotes on top of Support read access
};

/** Permission IDs granted directly to a user (independent of their roles). */
export function getDirectPermissionIds(userId: number): string[] {
  return USER_DIRECT_PERMISSIONS[userId] ?? [];
}

/** Whether a specific permission is directly assigned to a user. */
export function hasDirectPermission(userId: number, permissionId: string): boolean {
  return getDirectPermissionIds(userId).includes(permissionId);
}

/** Replace a user's direct grants. Used when a flow that can assign permissions
 *  outside a role commits (Create User), so the detail page, the permission
 *  holder lookups, and the restore snapshots all see the same set. Writing an
 *  empty list clears the entry rather than storing `[]`. */
export function setDirectPermissionIds(userId: number, permissionIds: string[]): void {
  if (permissionIds.length === 0) {
    delete USER_DIRECT_PERMISSIONS[userId];
    return;
  }
  USER_DIRECT_PERMISSIONS[userId] = [...permissionIds];
}
