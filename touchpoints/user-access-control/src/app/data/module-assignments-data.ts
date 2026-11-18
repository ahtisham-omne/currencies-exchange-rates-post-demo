/**
 * Mock data for the UAC Main → Permissions catalog view.
 * For each permission module, lists which roles and users currently have
 * access to ANY permission in that module (whether through role inheritance
 * or direct assignment).
 *
 * Used by the "Assigned to Roles" and "Assigned to Users" columns / card
 * footer in the catalog view only, NOT used by Role Detail or Create User
 * permissions views (those are scoped to a single role/user context).
 *
 * Module Defaults is the one entry derived from the real role bundles rather
 * than mocked: Predefined Roles v2.12 (ERP-8617) puts Access Module Defaults
 * Module on every Full Access predefined role, so its holders are most of the
 * tenant and a hand-picked list would understate it.
 */

import { getRolesWithPermission, getUsersWithPermission } from "./permission-holders";
import { PERMISSION_MODULES } from "./permissions-data";
import { isNewTenant } from "./tenant";

export interface ModuleAssignmentEntry {
  /** Total count of roles assigned to this module (for column header / popover count) */
  rolesCount: number;
  /** Total count of users assigned to this module */
  usersCount: number;
  /** Role IDs (matches roles-data.ts numeric ids), used to render popover list */
  roleIds: number[];
  /** User IDs (matches users-data.ts numeric ids), used to render popover list */
  userIds: number[];
}

/** Role pool: IDs from roles-data.ts (1-17, with 11+ being misc roles) */
const R = {
  sysAdmin: 1,
  erpAdmin: 2,
  warehouseMgr: 3,
  procurementMgr: 4,
  financeMgr: 5,
  engineeringMgr: 6,
  basicUser: 7,
  hrMgr: 8,
  fieldTech: 9,
  qaLead: 10,
  itSecurity: 11,
  marketingCoord: 12,
  projectMgr: 13,
  auditor: 14,
  customerSupport: 15,
  dataAnalyst: 16,
  opsSupervisor: 17,
};

/** Sample user pools: mix from users-data.ts (ids 1-48+) */
const U_BROAD = [1, 2, 4, 5, 7, 8, 9, 10, 11, 12, 14, 15, 17, 18, 19, 20, 21, 22, 24, 25];
const U_OPS = [1, 3, 5, 7, 8, 10, 12, 14, 17, 19, 20, 22, 25, 27, 30];
const U_FINANCE = [2, 4, 8, 11, 14, 18, 23, 28, 32];
const U_MOBILE = [1, 5, 7, 9, 12, 14, 17, 19, 22, 25, 27];
const U_ADMIN = [2, 4, 8, 14];

/**
 * Module ID → assignment data.
 * Counts here drive the cell display; the IDs drive the popover list (capped
 * at first 8 in the popover, with "View all" fallback for the rest).
 */
export const MODULE_ASSIGNMENTS: Record<string, ModuleAssignmentEntry> = {
  "item-library": {
    rolesCount: 10, usersCount: 87,
    roleIds: [R.sysAdmin, R.erpAdmin, R.warehouseMgr, R.procurementMgr, R.financeMgr, R.engineeringMgr, R.auditor, R.projectMgr, R.opsSupervisor, R.qaLead],
    userIds: U_BROAD,
  },
  "item-categories": {
    rolesCount: 8, usersCount: 45,
    roleIds: [R.sysAdmin, R.erpAdmin, R.warehouseMgr, R.procurementMgr, R.financeMgr, R.engineeringMgr, R.auditor, R.projectMgr],
    userIds: U_OPS,
  },
  "cycle-count": {
    rolesCount: 4, usersCount: 18,
    roleIds: [R.sysAdmin, R.erpAdmin, R.warehouseMgr, R.auditor],
    userIds: U_OPS.slice(0, 12),
  },
  "unit-of-measure": {
    rolesCount: 12, usersCount: 110,
    roleIds: [R.sysAdmin, R.erpAdmin, R.warehouseMgr, R.procurementMgr, R.financeMgr, R.engineeringMgr, R.auditor, R.projectMgr, R.opsSupervisor, R.qaLead, R.dataAnalyst, R.itSecurity],
    userIds: U_BROAD,
  },
  "physical-inventory": {
    rolesCount: 9, usersCount: 52,
    roleIds: [R.sysAdmin, R.erpAdmin, R.warehouseMgr, R.financeMgr, R.engineeringMgr, R.basicUser, R.fieldTech, R.auditor, R.opsSupervisor],
    userIds: U_BROAD.slice(0, 15),
  },
  "warehouse-locations": {
    rolesCount: 11, usersCount: 95,
    roleIds: [R.sysAdmin, R.erpAdmin, R.warehouseMgr, R.procurementMgr, R.engineeringMgr, R.auditor, R.projectMgr, R.opsSupervisor, R.qaLead, R.fieldTech, R.dataAnalyst],
    userIds: U_BROAD,
  },
  "partners": {
    rolesCount: 6, usersCount: 28,
    roleIds: [R.sysAdmin, R.erpAdmin, R.procurementMgr, R.financeMgr, R.auditor, R.projectMgr],
    userIds: U_OPS,
  },
  "purchase-orders": {
    rolesCount: 6, usersCount: 31,
    roleIds: [R.sysAdmin, R.erpAdmin, R.procurementMgr, R.financeMgr, R.auditor, R.projectMgr],
    userIds: U_OPS.slice(0, 12),
  },
  "receiving": {
    rolesCount: 3, usersCount: 10,
    roleIds: [R.sysAdmin, R.erpAdmin, R.warehouseMgr],
    userIds: U_OPS.slice(0, 10),
  },
  "inventory-movement": {
    rolesCount: 4, usersCount: 14,
    roleIds: [R.sysAdmin, R.erpAdmin, R.warehouseMgr, R.auditor],
    userIds: U_OPS.slice(0, 10),
  },
  "shipments": {
    rolesCount: 7, usersCount: 34,
    roleIds: [R.sysAdmin, R.erpAdmin, R.warehouseMgr, R.auditor, R.projectMgr, R.opsSupervisor, R.qaLead],
    userIds: U_OPS,
  },
  "quotes": {
    rolesCount: 5, usersCount: 19,
    roleIds: [R.sysAdmin, R.erpAdmin, R.financeMgr, R.auditor, R.projectMgr],
    userIds: U_FINANCE.concat([1, 5, 7, 12, 17]),
  },
  "sales-orders": {
    rolesCount: 5, usersCount: 22,
    roleIds: [R.sysAdmin, R.erpAdmin, R.financeMgr, R.auditor, R.projectMgr],
    userIds: U_FINANCE.concat([1, 5, 7, 12, 17]),
  },
  "users-roles": {
    rolesCount: 3, usersCount: 6,
    roleIds: [R.sysAdmin, R.erpAdmin, R.hrMgr],
    userIds: U_ADMIN,
  },
  "global-mfa": {
    rolesCount: 3, usersCount: 12,
    roleIds: [R.sysAdmin, R.erpAdmin, R.itSecurity],
    userIds: U_ADMIN.concat([5, 9, 11, 17, 19]),
  },
  "general-settings": {
    rolesCount: 2, usersCount: 4,
    roleIds: [R.sysAdmin, R.erpAdmin],
    userIds: U_ADMIN,
  },
  /* "module-defaults" is derived in getModuleAssignment below. */
  "physical-inventory-app": {
    rolesCount: 4, usersCount: 24,
    roleIds: [R.sysAdmin, R.erpAdmin, R.warehouseMgr, R.fieldTech],
    userIds: U_MOBILE,
  },
  "receiving-app": {
    rolesCount: 3, usersCount: 15,
    roleIds: [R.sysAdmin, R.erpAdmin, R.fieldTech],
    userIds: U_MOBILE.slice(0, 10),
  },
  "movement-app": {
    rolesCount: 4, usersCount: 16,
    roleIds: [R.sysAdmin, R.erpAdmin, R.warehouseMgr, R.fieldTech],
    userIds: U_MOBILE.slice(0, 10),
  },
  "cycle-count-app": {
    rolesCount: 4, usersCount: 22,
    roleIds: [R.sysAdmin, R.erpAdmin, R.warehouseMgr, R.fieldTech],
    userIds: U_MOBILE,
  },
};

/** Module Defaults holders, read from the role bundles and direct grants.
 *  Every holder of Manage Module Defaults also holds the Access gate, so the
 *  gate's holders are everyone with any permission in the module. */
function moduleDefaultsAssignment(): ModuleAssignmentEntry {
  const roleIds = getRolesWithPermission("md-access").map((r) => r.id);
  const userIds = getUsersWithPermission("md-access").map((u) => u.id);
  return { rolesCount: roleIds.length, usersCount: userIds.length, roleIds, userIds };
}

/** Holders of any permission in a module, read from the role bundles and
 *  direct grants, the way Module Defaults is read above. */
function derivedAssignment(moduleId: string): ModuleAssignmentEntry {
  const permissionIds = PERMISSION_MODULES.find((m) => m.id === moduleId)?.permissions.map((p) => p.id) ?? [];
  const roleIds = new Set<number>();
  const userIds = new Set<number>();
  for (const id of permissionIds) {
    getRolesWithPermission(id).forEach((r) => roleIds.add(r.id));
    getUsersWithPermission(id).forEach((u) => userIds.add(u.id));
  }
  return { rolesCount: roleIds.size, usersCount: userIds.size, roleIds: [...roleIds], userIds: [...userIds] };
}

export function getModuleAssignment(moduleId: string): ModuleAssignmentEntry {
  if (moduleId === "module-defaults") return moduleDefaultsAssignment();
  /* The hand-picked lists above name the sample company's people and old
   * role ids. A company from onboarding is read from what it actually holds. */
  if (isNewTenant()) return derivedAssignment(moduleId);
  return (
    MODULE_ASSIGNMENTS[moduleId] ?? {
      rolesCount: 0,
      usersCount: 0,
      roleIds: [],
      userIds: [],
    }
  );
}
