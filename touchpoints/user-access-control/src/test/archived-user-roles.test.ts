import { describe, it, expect } from "vitest";
import { roles } from "../app/data/roles-data";
import { users } from "../app/data/users-data";
import {
  getRoleIdsForUser,
  getUsersForRole,
  getOwnerIdsForRole,
  addUserToRole,
  removeUserFromAllRoles,
} from "../app/data/uac-derived";
import { setUserRoles } from "../app/data/user-detail-data";

/**
 * Archiving clears a user's roles, as every archive confirmation says. So an
 * archived user is never listed by a role: not in the Users count, not in the
 * users popover on the Roles listing, not on the role detail Users tab.
 */
describe("archived users hold no roles", () => {
  it("no role lists an archived user in the seed data", () => {
    const archived = users.filter((u) => u.status === "Archived");
    expect(archived.length, "fixture needs an archived user").toBeGreaterThan(0);
    for (const u of archived) {
      expect(getRoleIdsForUser(u.id), `${u.fullName} (${u.id})`).toEqual([]);
    }
    for (const r of roles) {
      const listed = getUsersForRole(r.id).filter((u) => u.status === "Archived");
      expect(listed.map((u) => u.fullName), r.roleName).toEqual([]);
    }
  });

  it("archiving takes the user out of every role and keeps role ownership", () => {
    // Ahtisham holds Super Admin, Warehouse Supervisor and Sales Manager, and
    // owns Warehouse Supervisor, so ownership can be checked on a held role.
    const userId = 1;
    const before = [...getRoleIdsForUser(userId)];
    expect(before.length).toBeGreaterThan(1);
    expect(getOwnerIdsForRole(10)).toContain(userId);

    removeUserFromAllRoles(userId);
    expect(getRoleIdsForUser(userId)).toEqual([]);
    for (const rid of before) {
      expect(getUsersForRole(rid).some((u) => u.id === userId)).toBe(false);
    }
    expect(getOwnerIdsForRole(10)).toContain(userId);

    before.forEach((rid) => addUserToRole(userId, rid));
    expect(getRoleIdsForUser(userId).sort()).toEqual([...before].sort());
  });
});

describe("restoring a user commits the roles confirmed at Review", () => {
  it("sets exactly the confirmed roles, adding and removing as needed", () => {
    const userId = 39; // Lucas Andersson, archived, starts with no roles
    expect(getRoleIdsForUser(userId)).toEqual([]);

    setUserRoles(userId, ["Field Operative", "Basic User"]);
    expect(getRoleIdsForUser(userId).sort()).toEqual([24, 25]);

    // Reactivate case: a deselected role is removed, a new one is added.
    setUserRoles(userId, ["Basic User", "Cycle Counter"]);
    expect(getRoleIdsForUser(userId).sort()).toEqual([21, 25]);

    setUserRoles(userId, []);
    expect(getRoleIdsForUser(userId)).toEqual([]);
  });
});
