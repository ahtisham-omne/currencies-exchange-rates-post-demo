/* ─────────────────────────────────────────────────────────────
 * Role Owner: centralized success toast copy
 *
 * Used by both entry points (Role Detail → Owners tab and
 * User Profile → Permissions → Manage Roles → Configure) so wording
 * stays consistent with the spec.
 * ──────────────────────────────────────────────────────────────── */

export interface SingleOwnerToastInput {
  userName: string;
  roleName: string;
  /** Was the user already on the role before this assignment? */
  wasHolder: boolean;
  /** If non-holder: did the admin also add them to the role? */
  alsoAddedToRole?: boolean;
}

export function singleOwnerAssignedMessage(input: SingleOwnerToastInput): string {
  const { userName, roleName, wasHolder, alsoAddedToRole } = input;
  if (wasHolder) {
    return `${userName} is now a role owner for ${roleName}.`;
  }
  if (alsoAddedToRole) {
    return `${userName} is now a role owner for ${roleName} and is on the role.`;
  }
  return `${userName} is now a role owner for ${roleName}. They are not on the role itself.`;
}

export function multiOwnerAssignedMessage(count: number, roleName: string): string {
  return `${count} users are now role owners for ${roleName}.`;
}

export function manageRolesSavedMessage(
  userName: string,
  managingCount: number,
  ownerCount: number,
): string {
  return `Saved. ${userName} manages ${managingCount} role${
    managingCount === 1 ? "" : "s"
  } and is a role owner of ${ownerCount}.`;
}
