/* ─────────────────────────────────────────────────────────────
 * Role Owners: thin wrapper over the canonical USER_OWNED_IDS map
 * in uac-derived.ts. All reads/writes funnel through that store so
 * Role Detail → Owners tab, User Detail → Roles crown, and the
 * deactivation modal's "sole owner" warning all stay in lockstep.
 * ──────────────────────────────────────────────────────────────── */

import {
  addRoleOwner as addRoleOwnerCanonical,
  getOwnedRoleIdsForUser,
  getOwnerIdsForRole,
  removeRoleOwnerById as removeRoleOwnerCanonical,
  setRoleOwners as setRoleOwnersCanonical,
  subscribeUacData,
} from "./uac-derived";
import { CURRENT_USER } from "./current-user";

export interface RoleOwner {
  /** ID of the user designated as the role owner */
  userId: number;
  /** Date the user was made a role owner, MM/DD/YYYY */
  assignedOn: string;
  /** Full name of the admin who designated them */
  assignedBy: string;
}

/* Per-role metadata (assignedOn/assignedBy), kept in a side map. */
const ownerMeta: Map<string, { assignedOn: string; assignedBy: string }> = new Map();
function metaKey(roleId: number, userId: number): string {
  return `${roleId}:${userId}`;
}

const roleOwnersCache = new Map<number, { key: string; owners: RoleOwner[] }>();

/* Seed metadata for the canonical owners. Keys are (roleId:userId) pairs in the
 * Pioneer v2.0 id space; kept in lockstep with USER_OWNED_IDS/OWNERSHIP_GRANT_VIA. */
ownerMeta.set(metaKey(10, 1),  { assignedOn: "04/15/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(10, 14), { assignedOn: "04/18/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(10, 6),  { assignedOn: "04/20/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(11, 10), { assignedOn: "03/28/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(16, 5),  { assignedOn: "04/01/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(16, 8),  { assignedOn: "04/02/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(16, 12), { assignedOn: "04/05/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(16, 3),  { assignedOn: "04/10/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(17, 1),  { assignedOn: "03/12/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(17, 6),  { assignedOn: "03/14/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(18, 1),  { assignedOn: "02/22/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(2, 1),   { assignedOn: "02/26/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(2, 5),   { assignedOn: "03/02/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(4, 20),  { assignedOn: "03/08/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(24, 17), { assignedOn: "03/30/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(26, 4),  { assignedOn: "03/22/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(1, 4),   { assignedOn: "01/05/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(18, 7),  { assignedOn: "03/04/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(28, 12), { assignedOn: "04/12/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(23, 13), { assignedOn: "02/11/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(13, 16), { assignedOn: "02/17/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(14, 19), { assignedOn: "02/03/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(3, 21),  { assignedOn: "01/28/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(15, 23), { assignedOn: "02/06/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(20, 25), { assignedOn: "03/06/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(9, 26),  { assignedOn: "01/30/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(6, 28),  { assignedOn: "02/18/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(19, 30), { assignedOn: "03/16/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(5, 35),  { assignedOn: "02/25/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(21, 36), { assignedOn: "03/18/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(8, 38),  { assignedOn: "02/09/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(7, 38),  { assignedOn: "02/14/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(29, 45), { assignedOn: "04/07/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(12, 46), { assignedOn: "03/25/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(26, 48), { assignedOn: "03/27/2026", assignedBy: "Abdullah Malik" });
ownerMeta.set(metaKey(22, 53), { assignedOn: "02/20/2026", assignedBy: "Abdullah Malik" });

/* ─── Subscriptions (delegated to canonical store) ─── */
export function subscribeRoleOwners(cb: () => void): () => void {
  return subscribeUacData(cb);
}

/* ─── Read API ─── */
export function getRoleOwners(roleId: number): RoleOwner[] {
  const ownerIds = getOwnerIdsForRole(roleId);
  const key = ownerIds
    .map((userId) => {
      const m = ownerMeta.get(metaKey(roleId, userId));
      return `${userId}:${m?.assignedOn ?? ""}:${m?.assignedBy ?? ""}`;
    })
    .join("|");
  const cached = roleOwnersCache.get(roleId);
  if (cached?.key === key) return cached.owners;

  const owners = ownerIds.map((userId) => {
    const m = ownerMeta.get(metaKey(roleId, userId));
    return {
      userId,
      assignedOn: m?.assignedOn ?? todayMMDDYYYY(),
      assignedBy: m?.assignedBy ?? "Abdullah Malik",
    };
  });
  roleOwnersCache.set(roleId, { key, owners });
  return owners;
}

export function getRoleOwnerUserIds(roleId: number): number[] {
  return getOwnerIdsForRole(roleId);
}

export function isRoleOwner(roleId: number, userId: number): boolean {
  return getOwnerIdsForRole(roleId).includes(userId);
}

export function getRolesOwnedByUser(userId: number): number[] {
  return getOwnedRoleIdsForUser(userId);
}

/* ─── Write API ─── */
function todayMMDDYYYY(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

export function assignRoleOwners(
  roleId: number,
  userIds: number[],
  /* Whoever is signed in: the sample's admin, or the person from Home. */
  assignedBy = CURRENT_USER.name,
): void {
  const assignedOn = todayMMDDYYYY();
  userIds.forEach((uid) => {
    addRoleOwnerCanonical(roleId, uid);
    ownerMeta.set(metaKey(roleId, uid), { assignedOn, assignedBy });
  });
  roleOwnersCache.delete(roleId);
}

export function removeRoleOwner(roleId: number, userId: number): void {
  removeRoleOwnerCanonical(roleId, userId);
  ownerMeta.delete(metaKey(roleId, userId));
  roleOwnersCache.delete(roleId);
}

export function clearRoleOwners(roleId: number): void {
  const current = getOwnerIdsForRole(roleId);
  setRoleOwnersCanonical(roleId, []);
  current.forEach((uid) => ownerMeta.delete(metaKey(roleId, uid)));
  roleOwnersCache.delete(roleId);
}
