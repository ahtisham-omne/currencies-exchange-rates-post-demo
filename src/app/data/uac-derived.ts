/**
 * UAC Single Source of Truth
 * ──────────────────────────
 * Every count, list, and filter result across the User Access Control module
 * derives from the data in this file:
 *
 *   - USER_ROLE_IDS  : userId → roleIds the user is assigned to
 *   - USER_OWNED_IDS : userId → roleIds the user owns (Role Owner)
 *   - USER_TASKS     : userId → explicit list of open tasks (no generators)
 *
 * If any number appears on screen, it traces back to one of these three maps.
 * On module load we also rewrite each user's `assignedRoles` string array
 * and each role's `usersCount` so legacy callers continue to read consistent
 * values without any code changes.
 */

import { roles, type RoleRow } from "./roles-data";
import { users, type UserRow } from "./users-data";
import { CARRIERS, CUSTOMERS, VENDORS, WAREHOUSES, AISLES, pick } from "./task-fixtures";
import { WORKFORCE_ROLE_IDS, isWorkforceUserId } from "./workforce-users";

/* ─────────────────────────────────────────────────────────────
 * Canonical role membership per user.
 *
 * Realistic assignment: each user holds 1–3 roles that fit a plausible job,
 * rather than a long, arbitrary list. Role bundles (see role-permissions-map)
 * then give each user a coherent permission set. Owner-membership invariants
 * and a few intentional edge cases are preserved:
 *   • Kassandra (10) is the member-and-sole-owner of QA Lead (10).
 *   • Brenda Robbins (17) keeps a Field-User license while holding the
 *     Full-Access Project Manager role (13), the license-conflict fixture,
 *     and remains sole owner of Field Technician (9).
 *   • Eli (4) and Nophil (5) hold only the Account Owner role, which holds
 *     every permission. Nophil still owns Sales Representative (16) WITHOUT
 *     membership, the owner-via-Manage-Roles fixture.
 *   • Ahtisham (1) owns Auditor (14) via Manage Roles WITHOUT membership.
 *   • Users 55/56 (No License) keep a Full-Access role for the warning fixtures.
 * Field-User-licensed users otherwise hold only Field-User roles (7, 9).
 * ─────────────────────────────────────────────────────────── */
/* New predefined-role id space (Pioneer v2.0):
 *   1 Account Owner (protected)   2 Super Administrator   3 System Config Mgr
 *   4 Access & Security Mgr       5 IT Helpdesk           6 HR Administrator
 *   7 Buyer   8 Procurement Mgr   9 Vendor Mgr
 *   10 Warehouse Supervisor  11 Inventory Controller  12 Item Data Admin
 *   13 Item Pricing Admin    14 Receiving Supervisor  15 Shipment Manager
 *   16 Sales Representative  17 Sales Manager  18 Operations Clearance
 *   19 Finance Controller
 *   20 Material Handler  21 Cycle Counter  22 Dispatch Clerk
 *   23 Receiving Clerk   24 Field Operative  25 Basic User   (20-25 = Field User)
 * Custom roles: 26 Compliance Auditor, 27 Sales Operations Analyst (Archived),
 *   28 Senior Buyer.
 * License-safe: Field-User users (17,25,29,36,43,45,58) hold only field roles
 *   (20-25), EXCEPT user 17 who also holds Sales Manager (17), the intentional
 *   license-conflict fixture. No-License users (18,47,55,56) keep a role for
 *   the warning fixtures.
 * Archived users hold no roles: archiving clears a user's access, so no role
 *   lists them (39 Lucas Andersson is the seeded archived user).
 * The three Draft users sit one per licence tier on purpose (41 Full Access,
 *   43 Field User, 47 No License): ERP-5203 AC 3 says all three tiers count and
 *   Draft does not, which is only provable when a draft exists at each tier. */
export const USER_ROLE_IDS: Record<number, number[]> = {
  1:  [2, 10, 17],       // Ahtisham: Super Admin + Warehouse Sup + Sales Mgr; owns 10,17,18,2
  2:  [11, 19],          // Inventory Controller + Finance Controller
  3:  [8, 16],           // Procurement Mgr + Sales Rep (owns 16)
  4:  [1],               // Eli Rosenbloom: ACCOUNT OWNER (first owner, from onboarding). Also owns 26.
  5:  [1],               // Nophil Anwer: ACCOUNT OWNER (second holder, added by OMNE). Owns 2 & 16 via Manage Roles.
  6:  [10, 17],          // Warehouse Sup + Sales Mgr (owns 10,17), Inactive
  7:  [10, 17, 18],      // Warehouse Sup + Sales Mgr + Ops Clearance (owns 18 as member)
  8:  [6, 16],           // HR Admin + Sales Rep (owns 16)
  9:  [17],              // Sales Manager, Invite Sent
  10: [11],              // Inventory Controller, member & sole owner (required-role fixture)
  11: [17],              // Sales Manager
  12: [8, 16, 28],       // Procurement Mgr + Sales Rep (owns 16) + Senior Buyer (owns 28)
  13: [18, 23],          // Operations Clearance Specialist + Receiving Clerk (owns 23)
  14: [10],              // Warehouse Supervisor (owns 10), 22-item deactivation fixture
  15: [17],              // Sales Manager
  16: [6, 12, 13],       // HR Admin + Item Data Admin + Item Pricing Admin (owns 13)
  17: [24, 17],          // Field Operative (owns 24) + Sales Manager (Full), LICENSE-CONFLICT fixture
  18: [25, 24],          // Basic User + Field Operative, No License, Inactive
  19: [18, 10, 14],      // Ops Clearance + Warehouse Sup + Receiving Supervisor (owns 14)
  20: [4],               // Access & Security Manager (owns 4)
  21: [5, 17, 3],        // IT Helpdesk + Sales Manager + System Config Mgr (owns 3)
  22: [8, 16],           // Lena Okafor: clean deactivation user (no tasks, no ownership)
  23: [18, 10, 15],      // Ops Clearance + Warehouse Sup + Shipment Manager (owns 15)
  24: [6, 16],           // HR Admin + Sales Rep
  25: [24, 21, 20, 29],  // Field Operative + Cycle Counter + Material Handler + Warehouse Operator (Field User license)
  26: [11, 9],           // Inventory Controller + Vendor Manager (owns 9)
  27: [10],              // Warehouse Supervisor, Inactive
  28: [6],               // HR Administrator
  29: [25, 24],          // Field roles, Invite Sent (Field User license)
  30: [19],              // Finance Controller
  31: [10],              // Warehouse Supervisor, Inactive
  32: [16],              // Sales Representative
  33: [4],               // Access & Security Manager, Inactive
  34: [16],              // Sales Representative
  35: [5],               // IT Helpdesk
  36: [25, 24, 21, 29],  // Field roles + Warehouse Operator (Field User license)
  37: [17],              // Sales Manager
  38: [8, 7],            // Procurement Manager (owns 8) + Buyer (owns 7)
  39: [],                // Archived, so no roles
  40: [6],               // HR Administrator
  41: [10],              // Warehouse Supervisor, Draft on a Full Access seat
  42: [11],              // Inventory Controller
  43: [20, 21],          // Material Handler + Cycle Counter, Draft on a Field User seat
  44: [16],              // Sales Representative
  45: [24, 20, 21, 29],  // Field roles + Warehouse Operator (Field User license)
  46: [12, 16],          // Item Data Admin + Sales Rep
  47: [10],              // Warehouse Supervisor, Draft on a No License seat (warning fixture)
  48: [19, 27, 26],      // Finance Controller + Sales Ops Analyst + Compliance Auditor (owns 26)
  49: [17],              // Sales Manager, Invite Sent
  /* Admin & core-team users. */
  50: [2],               // Andrea Davis: Super Administrator
  51: [2],               // Taylor Dimas: Super Administrator
  52: [4],               // Dana Johansen: Access and Security Manager
  53: [18, 22],          // Autumn Myers: Ops Clearance + Dispatch Clerk (owns 22)
  54: [16],              // Sarah Chen: Inactive (warning fixture)
  55: [25, 16],          // Miguel Torres: No License + Full-Access Sales Rep (warning fixture)
  56: [25, 27],          // Anna Kowalski: No License + Sales Operations Analyst, Inactive (warning fixture)
  57: [17],              // Priya Nair: Sales Manager (Invite Expired)
  58: [24],              // Marcus Bennett: Field Operative (Invite Expired, Field User license)
  59: [16],              // Sofia Russo: Sales Representative (Invite Expired)
  60: [6],               // Fatima Masood: HR Administrator (people operations)
  /* The plant workforce (ids 61+): one role each, the one their job needs. */
  ...WORKFORCE_ROLE_IDS,
};

/* ─────────────────────────────────────────────────────────────
 * Role Owners
 *   Most owners are members of the role they own.
 *   Nophil (5) owns Sales Representative (16) WITHOUT being a member,
 *   the "owner via Manage Roles permission" edge case.
 * ─────────────────────────────────────────────────────────── */
export const USER_OWNED_IDS: Record<number, number[]> = {
  // ── Ahtisham (1): owns 4 roles, covers Role assignment + Manage Roles cases
  //   • Warehouse Supervisor (10): Role assignment, 3 owners total (member)
  //   • Sales Manager (17): Role assignment, 2 owners total (member)
  //   • Operations Clearance (18): Manage Roles, WITHOUT membership
  //   • Super Administrator (2): Role assignment (member), 2 owners total
  1:  [10, 17, 18, 2],
  14: [10],         // Heather: co-owner of Warehouse Supervisor
  6:  [10, 17],     // Irtaza: third WS owner + second Sales Mgr owner
  10: [11],         // Kassandra: sole owner of Inventory Controller (required-role edge case)
  5:  [2, 16],      // Nophil: owner of Sales Rep WITHOUT being a member; co-owner of Super Admin (Manage Roles)
  8:  [16],         // Aden: co-owner of Sales Rep
  12: [16, 28],     // Malachi: co-owner of Sales Rep + owner of Senior Buyer (member)
  3:  [16],         // Areeb: co-owner of Sales Rep
  17: [24],         // Brenda Robbins: sole owner of Field Operative (Field User license edge case)
  20: [4],          // Priya Sharma: owner of Access & Security Manager (member)
  4:  [1, 26],      // Eli Rosenbloom: owner of Account Owner (1, member) + Compliance Auditor (26) WITHOUT membership
  7:  [18],         // Muhammad Ghufran: member co-owner of Operations Clearance
  13: [23],         // Fabian: owner of Receiving Clerk (member)
  16: [13],         // Owner of Item Pricing Admin (member)
  19: [14],         // Owner of Receiving Supervisor (member)
  21: [3],          // Owner of System Configuration Manager (member)
  23: [15],         // Owner of Shipment Manager (member)
  25: [20],         // Randall: sole owner of Material Handler (member, Field User license)
  26: [9],          // Owner of Vendor Manager (member)
  28: [6],          // Owner of HR Administrator (member)
  30: [19],         // Owner of Finance Controller (member)
  35: [5],          // Owner of IT Helpdesk (member)
  36: [21],         // Owner of Cycle Counter (member, Field User license)
  38: [8, 7],       // Owner of Procurement Manager + Buyer (member of both)
  45: [29],         // Owner of Warehouse Operator (member, Field User license)
  46: [12],         // Owner of Item Data Admin (member)
  48: [26],         // Member co-owner of Compliance Auditor
  53: [22],         // Autumn: owner of Dispatch Clerk (member)
  // Every role has at least one MEMBER owner so the Users-tab crown is always
  // visible, except: Basic User (25) and Sales Operations Analyst (27) have
  // zero owners, the Owners-tab empty-state edge cases (25 active, 27 archived).
};

/* Granting source per (roleId,userId) ownership pair.
 * "role-assignment" = designated as owner from the role detail page; user holds the role.
 * "manage-roles"    = user has the system-level Manage Roles permission, which
 *                     allows them to own/configure roles without being assigned.
 * Default when unspecified is "role-assignment".
 */
export type OwnershipGrantedVia = "role-assignment" | "manage-roles";
export const OWNERSHIP_GRANT_VIA: Record<string, OwnershipGrantedVia> = {
  // Ahtisham
  "10:1": "role-assignment",
  "17:1": "role-assignment",
  "18:1": "manage-roles",      // Ahtisham: owns Operations Clearance WITHOUT membership
  "2:1":  "role-assignment",   // Ahtisham: member of Super Administrator
  // Other Warehouse Supervisor / Sales Manager co-owners (assignment)
  "10:14": "role-assignment",
  "10:6":  "role-assignment",
  "17:6":  "role-assignment",
  // Nophil
  "2:5":  "manage-roles",      // Nophil: Manage Roles owner of Super Administrator (no membership)
  "16:5": "manage-roles",      // Nophil: owner of Sales Rep without holding the role
  // Sales Rep co-owners
  "16:8":  "role-assignment",
  "16:12": "role-assignment",
  "16:3":  "role-assignment",
  // Brenda
  "24:17": "role-assignment",
  // Kassandra
  "11:10": "role-assignment",
  // Priya Sharma
  "4:20":  "role-assignment",
  // Eli
  "1:4":  "role-assignment",   // Account Owner: owned by Eli, the first owner
  "26:4": "manage-roles",      // Compliance Auditor: Eli owns WITHOUT membership
  // Member-owners of their own role
  "18:7":  "role-assignment",  // Operations Clearance (co-owner alongside Ahtisham's manage-roles grant)
  "28:12": "role-assignment",  // Senior Buyer
  "23:13": "role-assignment",  // Receiving Clerk
  "13:16": "role-assignment",  // Item Pricing Admin
  "14:19": "role-assignment",  // Receiving Supervisor
  "3:21":  "role-assignment",  // System Configuration Manager
  "15:23": "role-assignment",  // Shipment Manager
  "20:25": "role-assignment",  // Material Handler
  "9:26":  "role-assignment",  // Vendor Manager
  "6:28":  "role-assignment",  // HR Administrator
  "19:30": "role-assignment",  // Finance Controller
  "5:35":  "role-assignment",  // IT Helpdesk
  "21:36": "role-assignment",  // Cycle Counter
  "8:38":  "role-assignment",  // Procurement Manager
  "7:38":  "role-assignment",  // Buyer
  "29:45": "role-assignment",  // Warehouse Operator
  "12:46": "role-assignment",  // Item Data Admin
  "26:48": "role-assignment",  // Compliance Auditor (member co-owner)
  "22:53": "role-assignment",  // Dispatch Clerk
};

export function getOwnershipGrantedVia(roleId: number, userId: number): OwnershipGrantedVia {
  return OWNERSHIP_GRANT_VIA[`${roleId}:${userId}`] ?? "role-assignment";
}

/* ─────────────────────────────────────────────────────────────
 * Open Tasks per user, every label is built from realistic fixtures.
 * Tasks are explicit so the deactivation modal's "12 open tasks"
 * means literally 12 rows.
 * ─────────────────────────────────────────────────────────── */
export type TaskType = "Cycle Count" | "Movement" | "Shipment" | "Sales Order" | "Role Ownership";

export interface CanonicalTask {
  id: string;
  type: TaskType;
  label: string;
}

function pad4(n: number): string {
  return String(n).padStart(4, "0");
}

/** Build a Cycle Count task with realistic warehouse + aisle. */
function ccTask(seed: number, n: number): CanonicalTask {
  const wh = pick(WAREHOUSES, `${seed}-cc-${n}`);
  const aisle = pick(AISLES, `${seed}-cc-${n}-a`);
  const id = `CC-DC${(n % 6) + 1}-${pad4(seed * 7 + n * 13)}`;
  return { id, type: "Cycle Count", label: `Cycle Count: ${wh}, ${aisle} (${id})` };
}
function mvTask(seed: number, n: number): CanonicalTask {
  const from = pick(WAREHOUSES, `${seed}-mv-${n}-f`);
  const to = pick(WAREHOUSES, `${seed}-mv-${n}-t`);
  const id = `MV-WH${(n % 4) + 1}-${pad4(seed * 9 + n * 17)}`;
  return { id, type: "Movement", label: `Stock Movement: ${from} → ${to} (${id})` };
}
function shTask(seed: number, n: number): CanonicalTask {
  const cust = pick(CUSTOMERS, `${seed}-sh-${n}`);
  const carrier = pick(CARRIERS, `${seed}-sh-${n}-c`);
  const id = `SH-OD-${pad4(seed * 11 + n * 23)}`;
  return { id, type: "Shipment", label: `Shipment: ${cust} outbound via ${carrier} (${id})` };
}
function soTask(seed: number, n: number): CanonicalTask {
  const cust = pick(CUSTOMERS, `${seed}-so-${n}`);
  const id = `SO-2026-${pad4(seed * 5 + n * 19)}`;
  return { id, type: "Sales Order", label: `${cust}, order ${id}` };
}
function poTask(seed: number, n: number): CanonicalTask {
  const v = pick(VENDORS, `${seed}-po-${n}`);
  const id = `PO-2026-${pad4(seed * 3 + n * 29)}`;
  return { id, type: "Movement", label: `Inbound receipt: ${v} (${id})` };
}

function buildSpread(userId: number, counts: Partial<Record<TaskType, number>>): CanonicalTask[] {
  const out: CanonicalTask[] = [];
  for (let i = 0; i < (counts["Cycle Count"] ?? 0); i++) out.push(ccTask(userId, i));
  for (let i = 0; i < (counts["Movement"] ?? 0); i++) {
    out.push(i % 2 === 0 ? mvTask(userId, i) : poTask(userId, i));
  }
  for (let i = 0; i < (counts["Shipment"] ?? 0); i++) out.push(shTask(userId, i));
  for (let i = 0; i < (counts["Sales Order"] ?? 0); i++) out.push(soTask(userId, i));
  return out;
}

/* Per-user task spreads. Edge cases:
 *   22 (Lena Okafor): empty: clean deactivation path
 *   14 (Heather Rowland): 21 task entries + Role Ownership of WM = 22 total reassignment items
 *   Admins / archived / unlicensed users get 0 tasks.
 */
export const USER_TASKS: Record<number, CanonicalTask[]> = {
  1:  buildSpread(1,  { "Cycle Count": 2, "Movement": 1, "Shipment": 3, "Sales Order": 5 }),  // 11 (8 Full-Access-dependent: SH+SO)
  2:  buildSpread(2,  { "Cycle Count": 1, "Movement": 1 }),                                    // 2
  3:  buildSpread(3,  { "Sales Order": 2, "Shipment": 1 }),                                    // 3
  4:  buildSpread(4,  { "Cycle Count": 1, "Sales Order": 1 }),                                 // 2
  5:  buildSpread(5,  { "Movement": 1 }),                                                       // 1
  6:  [],                                                                                       // Inactive
  7:  buildSpread(7,  { "Sales Order": 3, "Shipment": 2 }),                                    // 5
  8:  buildSpread(8,  { "Cycle Count": 1, "Movement": 2 }),                                    // 3
  9:  [],                                                                                       // Invite Sent
  10: buildSpread(10, { "Cycle Count": 2, "Shipment": 5, "Sales Order": 7 }),                  // 14 (12 Full-Access-dependent: SH+SO)
  11: buildSpread(11, { "Shipment": 3, "Sales Order": 3 }),                                    // 6 (all Full-Access-dependent: SH+SO)
  12: buildSpread(12, { "Cycle Count": 1, "Movement": 1, "Shipment": 1 }),                     // 3
  13: buildSpread(13, { "Shipment": 2, "Sales Order": 2 }),                                    // 4
  14: buildSpread(14, { "Cycle Count": 6, "Movement": 5, "Shipment": 5, "Sales Order": 5 }),   // 21 + 1 ownership = 22
  15: buildSpread(15, { "Cycle Count": 1, "Sales Order": 1 }),                                 // 2
  16: buildSpread(16, { "Cycle Count": 2, "Movement": 1 }),                                    // 3
  17: buildSpread(17, { "Sales Order": 4, "Shipment": 2 }),                                    // 6
  18: [],                                                                                       // Inactive (No License)
  19: buildSpread(19, { "Cycle Count": 1 }),                                                   // 1
  20: buildSpread(20, { "Cycle Count": 1, "Movement": 1 }),                                    // 2
  21: buildSpread(21, { "Movement": 2 }),                                                       // 2
  22: [],                                                                                       // Lena Okafor, clean
  23: buildSpread(23, { "Sales Order": 3, "Shipment": 1 }),                                    // 4
  24: buildSpread(24, { "Cycle Count": 1, "Sales Order": 1 }),                                 // 2
  25: buildSpread(25, { "Movement": 1, "Shipment": 1 }),                                       // 2
  26: buildSpread(26, { "Cycle Count": 2 }),                                                   // 2
  27: [],                                                                                       // Inactive
  28: buildSpread(28, { "Sales Order": 1 }),                                                   // 1
  29: [],                                                                                       // Invite Sent
  30: buildSpread(30, { "Movement": 1 }),                                                       // 1
  31: [],                                                                                       // Inactive
  32: buildSpread(32, { "Movement": 1, "Shipment": 1 }),                                       // 2
  33: [],                                                                                       // Inactive
  34: buildSpread(34, { "Sales Order": 2 }),                                                   // 2
  35: buildSpread(35, { "Cycle Count": 1 }),                                                   // 1
  36: buildSpread(36, { "Cycle Count": 1, "Sales Order": 1 }),                                 // 2
  37: buildSpread(37, { "Shipment": 2 }),                                                       // 2
  38: buildSpread(38, { "Sales Order": 1 }),                                                   // 1
  39: [],                                                                                       // Archived
  40: buildSpread(40, { "Movement": 1 }),                                                       // 1
  41: [],                                                                                       // Draft, never signed in
  42: buildSpread(42, { "Sales Order": 1 }),                                                   // 1
  43: [],                                                                                       // Draft, never signed in
  44: buildSpread(44, { "Sales Order": 1 }),                                                   // 1
  45: [],                                                                                       // Field user no tasks
  46: buildSpread(46, { "Shipment": 1 }),                                                       // 1
  47: [],                                                                                       // Draft, never signed in
  48: buildSpread(48, { "Sales Order": 1 }),                                                   // 1
  49: [],                                                                                       // Invite Sent
  50: [],                                                                                       // Andrea (admin)
  51: [],                                                                                       // Taylor (admin)
  52: [],                                                                                       // Dana (admin)
  53: [],                                                                                       // Autumn
  54: [],                                                                                       // Sarah Chen, Inactive
  55: [],                                                                                       // Miguel, No License
  56: [],                                                                                       // Anna, No License + Inactive
};

/* ─────────────────────────────────────────────────────────────
 * Pub/Sub for membership / ownership / task mutations.
 * Mutations call notifyUacChange(); legacy stores
 * (role-owners-data, role-detail-data) re-export this so
 * existing useSyncExternalStore wiring continues to work.
 * ─────────────────────────────────────────────────────────── */
const listeners = new Set<() => void>();
export function subscribeUacData(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
export function notifyUacChange(): void {
  listeners.forEach((cb) => cb());
}

/* ─────────────────────────────────────────────────────────────
 * Read API: every screen should derive from these.
 * ─────────────────────────────────────────────────────────── */
export function getRoleIdsForUser(userId: number): number[] {
  return USER_ROLE_IDS[userId] ?? [];
}

export function getUsersForRole(roleId: number): UserRow[] {
  return users.filter((u) => (USER_ROLE_IDS[u.id] ?? []).includes(roleId));
}

/**
 * Distinct users across a set of roles, the people-not-assignments count.
 *
 * Summing each role's `usersCount` double-counts anyone who holds more than one
 * of the selected roles: pick 4 roles covering 10 people where 2 of them hold
 * two roles each and the sum reads 12. Every "users impacted / affected" figure
 * in a bulk role action, and the success message that follows it, resolves
 * membership through here so both always report the same 10.
 */
export function getUsersForRoles(roleIds: Array<number | string>): UserRow[] {
  const ids = new Set(roleIds.map((id) => Number(id)));
  if (ids.size === 0) return [];
  return users.filter((u) =>
    (USER_ROLE_IDS[u.id] ?? []).some((rid) => ids.has(rid))
  );
}

/** Headcount of {@link getUsersForRoles}: one person counts once. */
export function getUniqueUserCountForRoles(roleIds: Array<number | string>): number {
  return getUsersForRoles(roleIds).length;
}

export function getRoleUsersCount(roleId: number): number {
  return getUsersForRole(roleId).length;
}

/**
 * Cached owner-id arrays per role. We must return a stable reference for
 * `useSyncExternalStore` consumers, otherwise React detects a "changed"
 * snapshot on every render and loops forever. Cache is invalidated by
 * bumping `_ownerCacheVersion` whenever the underlying ownership map mutates.
 */
let _ownerCacheVersion = 0;
const _ownerCache = new Map<number, { v: number; key: string; arr: number[] }>();

export function bumpOwnerCacheVersion(): void {
  _ownerCacheVersion++;
}

export function getOwnerIdsForRole(roleId: number): number[] {
  const cached = _ownerCache.get(roleId);
  // Build current key for this role
  const out: number[] = [];
  for (const uid in USER_OWNED_IDS) {
    if (USER_OWNED_IDS[uid].includes(roleId)) out.push(Number(uid));
  }
  const key = out.join(",");
  if (cached && cached.v === _ownerCacheVersion && cached.key === key) {
    return cached.arr;
  }
  _ownerCache.set(roleId, { v: _ownerCacheVersion, key, arr: out });
  return out;
}

const EMPTY_NUM_ARR: number[] = [];
export function getOwnedRoleIdsForUser(userId: number): number[] {
  return USER_OWNED_IDS[userId] ?? EMPTY_NUM_ARR;
}

export function isSoleOwner(roleId: number, userId: number): boolean {
  const owners = getOwnerIdsForRole(roleId);
  return owners.length === 1 && owners[0] === userId;
}

export function getTasksForUser(userId: number): CanonicalTask[] {
  return USER_TASKS[userId] ?? [];
}

export function getTasksForUsers(userIds: Array<number | string>): CanonicalTask[] {
  const ids = new Set(userIds.map((x) => Number(x)));
  const out: CanonicalTask[] = [];
  ids.forEach((id) => out.push(...getTasksForUser(id)));
  return out;
}

/** Resolve a list of role IDs to their role names (using real role data). */
export function roleIdsToNames(roleIds: number[]): string[] {
  return roleIds
    .map((id) => roles.find((r) => r.id === id)?.roleName)
    .filter((n): n is string => Boolean(n));
}

/* ─────────────────────────────────────────────────────────────
 * Mutation API: keeps everything in lockstep.
 * ─────────────────────────────────────────────────────────── */
export function addUserToRole(userId: number, roleId: number): void {
  const list = USER_ROLE_IDS[userId] ?? (USER_ROLE_IDS[userId] = []);
  if (!list.includes(roleId)) {
    list.push(roleId);
    syncLegacyFields();
    notifyUacChange();
  }
}
export function removeUserFromRole(userId: number, roleId: number): void {
  const list = USER_ROLE_IDS[userId];
  if (!list) return;
  const i = list.indexOf(roleId);
  if (i >= 0) {
    list.splice(i, 1);
    // Removing membership also strips any ownership of that role.
    const owned = USER_OWNED_IDS[userId];
    if (owned) {
      const j = owned.indexOf(roleId);
      if (j >= 0) owned.splice(j, 1);
    }
    syncLegacyFields();
    notifyUacChange();
  }
}
/** Take a user out of every role they hold, the role side of archiving.
 *  Ownership is left alone, since dropping it here could leave a role with no
 *  owner. */
export function removeUserFromAllRoles(userId: number): void {
  const list = USER_ROLE_IDS[userId];
  if (!list || list.length === 0) return;
  list.length = 0;
  syncLegacyFields();
  notifyUacChange();
}
/** Empty the directory: every user goes, with the roles they hold, the roles
 *  they own and their tasks. Omne Home's onboarding hand-off uses it to open
 *  UAC as a new company holding only the people setup created (see
 *  onboarding-handoff.ts). Roles themselves stay; they just have no holders. */
export function clearDirectory(): void {
  users.length = 0;
  for (const map of [USER_ROLE_IDS, USER_OWNED_IDS, USER_TASKS] as Record<number, unknown>[]) {
    for (const key of Object.keys(map)) delete map[Number(key)];
  }
  bumpOwnerCacheVersion();
  syncLegacyFields();
  notifyUacChange();
}

export function setRoleOwners(roleId: number, userIds: number[]): void {
  // Clear current owners
  for (const uid in USER_OWNED_IDS) {
    const owned = USER_OWNED_IDS[uid];
    const i = owned.indexOf(roleId);
    if (i >= 0) owned.splice(i, 1);
  }
  // Add new
  userIds.forEach((uid) => {
    const list = USER_OWNED_IDS[uid] ?? (USER_OWNED_IDS[uid] = []);
    if (!list.includes(roleId)) list.push(roleId);
  });
  notifyUacChange();
}
export function addRoleOwner(roleId: number, userId: number): void {
  const list = USER_OWNED_IDS[userId] ?? (USER_OWNED_IDS[userId] = []);
  if (!list.includes(roleId)) {
    list.push(roleId);
    notifyUacChange();
  }
}
export function removeRoleOwnerById(roleId: number, userId: number): void {
  const owned = USER_OWNED_IDS[userId];
  if (!owned) return;
  const i = owned.indexOf(roleId);
  if (i >= 0) {
    owned.splice(i, 1);
    notifyUacChange();
  }
}

/* ─────────────────────────────────────────────────────────────
 * Sync legacy backing fields so existing components continue
 * to work without changes:
 *   • UserRow.assignedRoles  ← role names from USER_ROLE_IDS
 *   • RoleRow.usersCount     ← derived count
 * ─────────────────────────────────────────────────────────── */
export function syncLegacyFields(): void {
  // Update users
  users.forEach((u) => {
    const ids = USER_ROLE_IDS[u.id] ?? [];
    const names = ids
      .map((id) => roles.find((r) => r.id === id)?.roleName.toLowerCase())
      .filter((n): n is string => Boolean(n));
    u.assignedRoles = names;
  });
  // Update roles
  roles.forEach((r) => {
    r.usersCount = getRoleUsersCount(r.id);
  });
}

/* ─────────────────────────────────────────────────────────────
 * Realistic membership floor.
 *
 * The curated USER_ROLE_IDS above encodes the owner / license-conflict / edge
 * cases, but on its own leaves several roles with only a handful of members,
 * unrealistically sparse for a populated tenant. This pass tops every role up
 * to a realistic headcount (>= 15) by adding eligible users, WITHOUT touching
 * any curated entry:
 *   • License is respected: a Full-Access role only takes Full-Access users;
 *     a Field role takes any licensed (non-"No License") user. No new
 *     license-conflict warnings are introduced.
 *   • Non-member-owner fixtures are preserved: a user who owns a role without
 *     being a member (e.g. Nophil → Support Agent, Ahtisham → Auditor) is never
 *     padded into it.
 * Deterministic (users added in id order) so counts are stable across renders.
 * ─────────────────────────────────────────────────────────── */
/* The protected Account Owner (role 1) is never padded, it keeps its two
 * curated holders (Eli Rosenbloom, Nophil Anwer). Every other role is padded
 * to at least 10 members.
 * Archived roles are not padded (their members are unassigned on archive). */
const NO_PAD_ROLE_IDS = new Set<number>([1]);

/** No user may hold more than this many roles. */
const MAX_ROLES_PER_USER = 8;

function padRoleMembership(): void {
  const isNonMemberOwner = (userId: number, roleId: number) =>
    (USER_OWNED_IDS[userId]?.includes(roleId) ?? false) &&
    !(USER_ROLE_IDS[userId]?.includes(roleId) ?? false);

  // An Account Owner who holds nothing else (Eli and Nophil) stays that way,
  // never padded into other roles: the role already holds every permission.
  const isAccountOwnerHolder = (userId: number) => {
    const ids = USER_ROLE_IDS[userId] ?? [];
    return ids.length === 1 && ids[0] === 1;
  };

  // The plant workforce, and the people-operations user added with it (60,
  // Fatima Masood), hold exactly the roles their jobs need, so they are never
  // padded: a machinist must not pick up Buyer to make a headcount, and the
  // original 59 users keep the roles they had.
  const sortedUsers = [...users]
    .filter((u) => !isWorkforceUserId(u.id) && u.id !== 60)
    .sort((a, b) => a.id - b.id);

  roles.forEach((role) => {
    if (NO_PAD_ROLE_IDS.has(role.id)) return;
    if (role.status === "Archived") return;
    // Every non-Account-Owner role is populated to a realistic floor of >= 10.
    const target = 10 + (role.id % 5);
    // Counted over the padded set only, so the workforce's large field-role
    // membership never changes what the original users are padded into.
    const paddedCount = () =>
      sortedUsers.filter((x) => (USER_ROLE_IDS[x.id] ?? []).includes(role.id)).length;
    for (const u of sortedUsers) {
      if (paddedCount() >= target) break;
      const current = USER_ROLE_IDS[u.id] ?? (USER_ROLE_IDS[u.id] = []);
      if (current.includes(role.id)) continue;
      if (current.length >= MAX_ROLES_PER_USER) continue; // no user holds > 8 roles
      if (isNonMemberOwner(u.id, role.id)) continue;
      if (isAccountOwnerHolder(u.id)) continue;
      if (u.status === "Archived") continue; // archived users hold no roles
      // License compatibility: Full-Access roles require a Full-Access user;
      // Field roles accept Full-Access or Field-User (but not No License).
      if (role.licenseRequired === "Full Access" && u.license !== "Full Access") continue;
      if (role.licenseRequired === "Field User" && u.license === "No License") continue;
      current.push(role.id);
    }
  });
}

padRoleMembership();

// Run sync immediately at module load so everything is consistent
// before the first render.
syncLegacyFields();

/* ─────────────────────────────────────────────────────────────
 * Dev consistency check: logs a single grouped warning if any
 * invariant fails. Helps prevent silent drift in future edits.
 * ─────────────────────────────────────────────────────────── */
function runConsistencyCheck(): void {
  const issues: string[] = [];
  const validRoleIds = new Set<number>(roles.map((r: RoleRow) => r.id));
  const validUserIds = new Set<number>(users.map((u: UserRow) => u.id));

  const archivedUserIds = new Set<number>(
    users.filter((u: UserRow) => u.status === "Archived").map((u: UserRow) => u.id),
  );
  for (const uid in USER_ROLE_IDS) {
    if (!validUserIds.has(Number(uid))) issues.push(`USER_ROLE_IDS references unknown user ${uid}`);
    if (archivedUserIds.has(Number(uid)) && USER_ROLE_IDS[uid].length > 0) {
      issues.push(`Archived user ${uid} still holds roles`);
    }
    USER_ROLE_IDS[uid].forEach((rid) => {
      if (!validRoleIds.has(rid)) issues.push(`User ${uid} assigned to unknown role ${rid}`);
    });
  }
  for (const uid in USER_OWNED_IDS) {
    if (!validUserIds.has(Number(uid))) issues.push(`USER_OWNED_IDS references unknown user ${uid}`);
    USER_OWNED_IDS[uid].forEach((rid) => {
      if (!validRoleIds.has(rid)) issues.push(`User ${uid} owns unknown role ${rid}`);
    });
  }
  // Task IDs unique
  const seen = new Set<string>();
  for (const uid in USER_TASKS) {
    USER_TASKS[uid].forEach((t) => {
      if (seen.has(t.id)) issues.push(`Duplicate task id ${t.id}`);
      seen.add(t.id);
    });
  }
  if (issues.length && typeof console !== "undefined") {
    // eslint-disable-next-line no-console
    console.warn("[uac-derived] consistency issues:", issues);
  }
}
runConsistencyCheck();
