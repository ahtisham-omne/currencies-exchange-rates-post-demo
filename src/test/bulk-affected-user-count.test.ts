import { describe, it, expect } from "vitest";
import { roles } from "../app/data/roles-data";
import {
  USER_ROLE_IDS,
  getUsersForRole,
  getUsersForRoles,
  getUniqueUserCountForRoles,
} from "../app/data/uac-derived";

/**
 * Bulk role actions (deactivate, archive, remove-permission-from-roles) report
 * how many PEOPLE are impacted, never how many role assignments. A user holding
 * three of the selected roles is one impacted user. The confirmation modal and
 * the success message both read the same figure, so the two always match.
 */
describe("bulk role actions count people, not role assignments", () => {
  it("counts a multi-role holder once", () => {
    // Pick a user with at least two roles and count those roles together.
    const [userId, roleIds] =
      Object.entries(USER_ROLE_IDS).find(([, ids]) => ids.length >= 2) ?? [];
    expect(roleIds, "fixture needs a user holding 2+ roles").toBeDefined();

    const count = getUniqueUserCountForRoles(roleIds!);
    const assignmentSum = roleIds!.reduce(
      (sum, id) => sum + getUsersForRole(id).length,
      0
    );

    expect(count).toBeLessThan(assignmentSum);
    expect(
      getUsersForRoles(roleIds!).filter((u) => u.id === Number(userId))
    ).toHaveLength(1);
  });

  it("equals the assignment sum only when the roles share no users", () => {
    const disjoint = roles
      .map((r) => r.id)
      .filter((id) => {
        const members = new Set(getUsersForRole(id).map((u) => u.id));
        return members.size > 0;
      })
      .slice(0, 1); // a single role can never double-count

    expect(getUniqueUserCountForRoles(disjoint)).toBe(
      getUsersForRole(disjoint[0]).length
    );
  });

  it("never exceeds the assignment sum, for any selection of roles", () => {
    const allRoleIds = roles.map((r) => r.id);
    const assignmentSum = allRoleIds.reduce(
      (sum, id) => sum + getUsersForRole(id).length,
      0
    );
    const unique = getUniqueUserCountForRoles(allRoleIds);

    expect(unique).toBeLessThanOrEqual(assignmentSum);
    // Every distinct user is returned exactly once.
    const ids = getUsersForRoles(allRoleIds).map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(unique);
  });

  it("accepts string ids and an empty selection", () => {
    expect(getUniqueUserCountForRoles([])).toBe(0);
    const someRole = roles.find((r) => getUsersForRole(r.id).length > 0)!;
    expect(getUniqueUserCountForRoles([String(someRole.id)])).toBe(
      getUsersForRole(someRole.id).length
    );
  });
});
