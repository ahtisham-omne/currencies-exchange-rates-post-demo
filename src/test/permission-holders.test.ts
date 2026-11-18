/* The "Roles & Users with This Permission" panel has to agree with the role
 * bundles, because an admin uses it to answer "who can do this". It used to
 * answer from a hash of the permission id: 3 to 5 roles and 8 to 14 users picked
 * deterministically, which listed holders that did not hold the permission and
 * contradicted the role detail page. These pin the derivation to the real data. */
import { describe, it, expect } from "vitest";
import {
  getRolesWithPermission,
  getUsersWithPermission,
  getGrantingRoleNames,
  getPermissionSourceForUser,
  roleHoldsPermission,
} from "../app/data/permission-holders";
import { roles, roleNameToOptionId } from "../app/data/roles-data";
import { ROLE_PERMISSION_MAP } from "../app/data/role-permissions-map";
import { PERMISSION_MODULES } from "../app/data/permissions-data";
import { USER_DIRECT_PERMISSIONS } from "../app/data/user-direct-permissions-data";
import { USER_ROLE_IDS } from "../app/data/uac-derived";

const ALL_IDS = PERMISSION_MODULES.flatMap((m) => m.permissions.map((p) => p.id));

describe("permission holders", () => {
  it("every listed role actually grants the permission", () => {
    for (const id of ALL_IDS) {
      for (const r of getRolesWithPermission(id)) {
        expect(
          (ROLE_PERMISSION_MAP[roleNameToOptionId(r.roleName)] ?? []).includes(id),
          `${r.roleName} listed for ${id} without holding it`,
        ).toBe(true);
      }
    }
  });

  it("no role that grants the permission is left out", () => {
    for (const id of ALL_IDS) {
      const listed = new Set(getRolesWithPermission(id).map((r) => r.id));
      for (const r of roles) {
        if (roleHoldsPermission(r, id)) {
          expect(listed.has(r.id), `${r.roleName} grants ${id} but is not listed`).toBe(true);
        }
      }
    }
  });

  /* The all-access three hold every permission, so every permission has at least
   * three role holders. A permission nothing else grants must show exactly those,
   * which is what the hash version got wrong most visibly. */
  it("a permission no scoped role grants shows only the all-access roles", () => {
    for (const id of ["pg-manage-payment-terms", "pg-manage-pricing-rules"]) {
      expect(getRolesWithPermission(id).map((r) => r.roleName).sort()).toEqual([
        "Account Owner",
        "Super Administrator",
        "System Configuration Manager",
      ]);
    }
  });

  it("every listed user holds it through a role or directly", () => {
    for (const id of ALL_IDS) {
      for (const u of getUsersWithPermission(id)) {
        const viaRole = getGrantingRoleNames(u.id, id).length > 0;
        const direct = (USER_DIRECT_PERMISSIONS[u.id] ?? []).includes(id);
        expect(viaRole || direct, `${u.fullName} listed for ${id} with neither source`).toBe(true);
      }
    }
  });

  it("granting role names are roles the user is actually in", () => {
    for (const id of ALL_IDS) {
      for (const u of getUsersWithPermission(id)) {
        const heldRoleNames = (USER_ROLE_IDS[u.id] ?? [])
          .map((rid) => roles.find((r) => r.id === rid)?.roleName)
          .filter(Boolean);
        for (const name of getGrantingRoleNames(u.id, id)) {
          expect(heldRoleNames, `${u.fullName} / ${id}`).toContain(name);
        }
      }
    }
  });

  /* Granted Via has three states and each has to mean what it says. */
  it("the Granted Via state matches the user's real sources", () => {
    // Malachi (12) holds po-create directly AND through Procurement Manager.
    const both = getPermissionSourceForUser(12, "po-create");
    expect(both.type).toBe("both");
    expect(both.roles.length).toBeGreaterThan(0);

    // Marcus (21) holds item-view-cost directly AND through two of his roles,
    // so it is "both" and both roles are named.
    const marcus = getPermissionSourceForUser(21, "item-view-cost");
    expect(marcus.type).toBe("both");
    expect(marcus.roles).toEqual(["System Configuration Manager", "Item Pricing Administrator"]);

    // Elena (30) holds po-create directly and through no role: direct only.
    const direct = getPermissionSourceForUser(30, "po-create");
    expect(direct.type).toBe("direct");
    expect(direct.roles).toEqual([]);

    // Eli (Account Owner) holds everything through the role, nothing directly.
    const viaRole = getPermissionSourceForUser(4, "mfa-delete");
    expect(viaRole.type).toBe("role");
    expect(viaRole.roles).toContain("Account Owner");
  });

  it("a user with no source reports direct with no roles, not a fabricated role", () => {
    const eli = getPermissionSourceForUser(4, "prt-vendor-qualification");
    expect(eli.roles.length).toBeGreaterThan(0); // Account Owner does hold it
    // Someone who holds neither: sources are empty rather than invented.
    const noSource = getUsersWithPermission("prt-vendor-qualification").map((u) => u.id);
    const outsider = [...Array(60).keys()].find((i) => i > 0 && !noSource.includes(i));
    if (outsider !== undefined) {
      const src = getPermissionSourceForUser(outsider, "prt-vendor-qualification");
      expect(src.roles).toEqual([]);
    }
  });
});
