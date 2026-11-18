/**
 * Active assignments held by users, used by the Deactivate/Archive
 * user flow to require admin reassignment before deactivation.
 *
 * Source of truth is uac-derived.ts:
 *   • Cycle Count / Movement / Shipment / Sales Order: USER_TASKS
 *   • Role Ownership: synthesized from USER_OWNED_IDS so any user who
 *     owns a role automatically has a Role Ownership reassignment item.
 */
import { users as allUsers, type UserRow } from "./users-data";
import { isProtectedRoleId, roles } from "./roles-data";
import {
  getOwnedRoleIdsForUser,
  getRoleIdsForUser,
  removeUserFromRole,
  getTasksForUser as getCanonicalTasksForUser,
  type CanonicalTask,
} from "./uac-derived";
import { assignRoleOwners, removeRoleOwner } from "./role-owners-data";

export type AssignmentType =
  | "Cycle Count"
  | "Movement"
  | "Shipment"
  | "Sales Order"
  | "Role Ownership";

export interface UserAssignment {
  id: string;
  type: AssignmentType;
  label: string;
  ownerId: number;
}

export interface EligibleAssignee {
  id: number;
  fullName: string;
  email: string;
}

/* ─── Eligibility ─── per assignment type, which users can be reassigned to. */
function activeLicensedUsers(): UserRow[] {
  return allUsers.filter(
    (u) => u.status === "Active" && u.license !== "No License",
  );
}

export function getEligibleAssignees(
  type: AssignmentType,
  excludeIds: number[] = [],
): EligibleAssignee[] {
  const exclude = new Set(excludeIds);
  const matches = activeLicensedUsers().filter((u) => {
    if (exclude.has(u.id)) return false;
    const r = u.assignedRoles.join(" ").toLowerCase();
    switch (type) {
      case "Cycle Count":   return /inventory|warehouse|quality|cycle|inspector|stock/.test(r);
      case "Movement":      return /warehouse|logistics|inventory|distribution|operations/.test(r);
      case "Shipment":      return /shipping|logistics|warehouse|distribution|freight|picking/.test(r);
      case "Sales Order":   return /sales|account|territory|pipeline|crm|revenue/.test(r);
      case "Role Ownership":return /admin|manager|director|head|lead|owner/.test(r);
    }
  });
  return matches.slice(0, 8).map((u) => ({
    id: u.id,
    fullName: u.fullName,
    email: u.email,
  }));
}

/* ─── Assemble assignments for a single user ─── */
function ownershipTasks(userId: number): UserAssignment[] {
  return getOwnedRoleIdsForUser(userId).map((roleId) => {
    const role = roles.find((r) => r.id === roleId);
    const name = role?.roleName ?? `Role #${roleId}`;
    return {
      id: `RO-${String(roleId).padStart(4, "0")}-${userId}`,
      type: "Role Ownership" as const,
      label: `Role Owner: ${name}`,
      ownerId: userId,
    };
  });
}

function toAssignment(t: CanonicalTask, userId: number): UserAssignment {
  return { id: t.id, type: t.type, label: t.label, ownerId: userId };
}

/* A Draft user has never signed in, so they hold no open work and own no
 * role: archiving one must not open the reassignment flow (ERP-5203, ruled
 * 17 Sep 2026). Enforced here rather than in the wizard so the rule holds for
 * every caller, single and bulk alike, and cannot be reintroduced by a fixture.
 * Read off the static record deliberately: importing the live row-state store
 * would close an import cycle through users-table-config → UserActionsMenu →
 * DeactivateUserWizard → this module. */
function isDraftUser(userId: number): boolean {
  return allUsers.find((u) => u.id === userId)?.status === "Pending Setup";
}

export function getActiveAssignmentsForUser(userId: number): UserAssignment[] {
  if (isDraftUser(userId)) return [];
  const tasks = getCanonicalTasksForUser(userId).map((t) => toAssignment(t, userId));
  return [...tasks, ...ownershipTasks(userId)];
}

export function getActiveAssignmentsForUsers(
  userIds: Array<number | string>,
): UserAssignment[] {
  const ids = Array.from(new Set(userIds.map((x) => Number(x))));
  return ids.flatMap((id) => getActiveAssignmentsForUser(id));
}

export const ASSIGNMENT_TYPE_ORDER: AssignmentType[] = [
  "Cycle Count",
  "Movement",
  "Shipment",
  "Sales Order",
  "Role Ownership",
];

/* ─── Full-Access dependency (downgrade flow) ─────────────────────────
 * When a user is downgraded from Full Access to a lower tier, only the
 * work that *depended on the higher tier* needs reassigning. We tag that
 * work here (mock logic for the prototype):
 *   • Tasks: Sales Orders and Shipments touch customer commitments and
 *                outbound fulfilment that require elevated permissions.
 *                Cycle Counts and Movements are floor-level tasks any
 *                Field User can still perform after a downgrade.
 *   • Roles: any role whose `licenseRequired` is "Full Access".
 */
const FULL_ACCESS_TASK_TYPES = new Set<AssignmentType>(["Sales Order", "Shipment"]);

/** Does this role require a Full Access license? */
export function roleRequiresFullAccess(roleId: number): boolean {
  return roles.find((r) => r.id === roleId)?.licenseRequired === "Full Access";
}

/** Does this assignment break when the owner loses Full Access? */
export function assignmentRequiresFullAccess(a: UserAssignment): boolean {
  if (a.type === "Role Ownership") {
    // Id shape: RO-<paddedRoleId>-<userId>
    const m = a.id.match(/^RO-(\d+)-/);
    return m ? roleRequiresFullAccess(Number(m[1])) : false;
  }
  return FULL_ACCESS_TASK_TYPES.has(a.type);
}

/** True when downgrading this user would orphan Full-Access-dependent
 *  tasks or role ownerships, i.e. the reassignment flow has something to
 *  show. When false, the downgrade skips straight to a simple confirmation. */
export function hasFullAccessDependentWork(userId: number): boolean {
  const taskHit = getActiveAssignmentsForUser(userId).some(
    (a) => a.type !== "Role Ownership" && assignmentRequiresFullAccess(a),
  );
  const roleHit = getOwnedRoleIdsForUser(userId).some(
    (rid) => roleRequiresFullAccess(rid) && !isProtectedRoleId(rid),
  );
  return taskHit || roleHit;
}

/**
 * Commit a Full Access → lower-tier downgrade's role side effects:
 *   1. Persist any role-ownership the admin reassigned to a new owner.
 *   2. Unassign every Full-Access role (membership + ownership) from the
 *      downgraded user, since the lower tier can no longer hold them.
 *      The Account Owner role is the exception: an owner who lowers their own
 *      license keeps it, and it takes effect again once they hold Full Access
 *      (Eli, Oct 6; ERP-5186 AC8).
 * Reused by both the reassignment-wizard path and the simple confirmation
 * path so the detail page / listing reflect the same outcome either way.
 */
export function applyLicenseDowngrade(
  userId: number,
  ownerReassignments: Record<number, number | undefined> = {},
): void {
  Object.entries(ownerReassignments).forEach(([rid, newOwner]) => {
    if (newOwner != null) assignRoleOwners(Number(rid), [newOwner]);
  });
  const faRoles = new Set<number>(
    [
      ...getRoleIdsForUser(userId).filter(roleRequiresFullAccess),
      ...getOwnedRoleIdsForUser(userId).filter(roleRequiresFullAccess),
    ].filter((rid) => !isProtectedRoleId(rid)),
  );
  faRoles.forEach((rid) => {
    removeUserFromRole(userId, rid); // membership + ownership when a member
    removeRoleOwner(rid, userId); // covers ownership held without membership
  });
}

export function getOwnerName(ownerId: number): string {
  return allUsers.find((u) => u.id === ownerId)?.fullName ?? "Unknown";
}
