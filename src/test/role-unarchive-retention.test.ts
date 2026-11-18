/* Unarchiving a role restores the role, not a fresh one.
 *
 * Archiving retains the permission bundle, so the permissions an admin sees in
 * the unarchive stepper (and the ones the role comes back with) must be the
 * role's OWN saved set. Nothing is defaulted on: a create-flow baseline applied
 * here would silently overwrite real configuration, which is what the
 * "some permissions are on by default" notice would be describing if it were
 * still shown on this flow.
 *
 * The other half of the restore is deliberate loss: assigned users and role
 * owners are cleared, so every people-derived surface has to report zero. */
import { describe, it, expect } from "vitest";
import { roles, roleNameToOptionId } from "../app/data/roles-data";
import {
  buildTogglesFromRoles,
  getRolePermissions,
} from "../app/data/role-permissions-map";
import {
  buildPermissionGroupsForRole,
  applyRoleEdits,
} from "../app/data/role-detail-data";
import { buildDefaultToggles } from "../app/data/permissions-data";
import { getRoleDetailInsights } from "../app/data/role-detail-insights-data";

const archived = roles.find((r) => r.status === "Archived")!;

/** The ids the unarchive stepper seeds ON, keyed exactly as the modal keys them. */
function seededOnIds(roleName: string): string[] {
  const toggles = buildTogglesFromRoles([roleNameToOptionId(roleName)]);
  return Object.entries(toggles)
    .filter(([, on]) => on)
    .map(([id]) => id)
    .sort();
}

describe("unarchive keeps the role's own permissions", () => {
  it("the fixture data has an archived role carrying permissions", () => {
    expect(archived).toBeDefined();
    expect(getRolePermissions(roleNameToOptionId(archived.roleName)).length).toBeGreaterThan(0);
  });

  it("seeds the stepper from the role's saved bundle, not the catalog defaults", () => {
    const saved = [...getRolePermissions(roleNameToOptionId(archived.roleName))].sort();
    expect(seededOnIds(archived.roleName)).toEqual(saved);
  });

  it("does not turn on the create-flow default baseline", () => {
    const defaultsOn = Object.entries(buildDefaultToggles())
      .filter(([, on]) => on)
      .map(([id]) => id);
    expect(defaultsOn.length).toBeGreaterThan(0);

    const seeded = new Set(seededOnIds(archived.roleName));
    const saved = new Set(getRolePermissions(roleNameToOptionId(archived.roleName)));
    // A default-on permission the role never held must stay off.
    for (const id of defaultsOn) {
      if (!saved.has(id)) expect(seeded.has(id), id).toBe(false);
    }
  });

  it("matches what the role detail Permissions tab derives for the same role", () => {
    const fromGroups = buildPermissionGroupsForRole(archived.roleName)
      .flatMap((g) => g.permissions)
      .filter((p) => p.granted)
      .map((p) => p.key)
      .sort();
    expect(seededOnIds(archived.roleName)).toEqual(fromGroups);
  });

  it("carries the bundle across a rename made in the stepper", () => {
    const original = archived.roleName;
    const before = seededOnIds(original);
    const renamed = `${original} (Restored)`;
    try {
      applyRoleEdits(archived.id, { roleName: renamed });
      expect(seededOnIds(renamed)).toEqual(before);
      // The freed name must not leave a ghost bundle behind for a future role.
      expect(getRolePermissions(roleNameToOptionId(original))).toEqual([]);
    } finally {
      applyRoleEdits(archived.id, { roleName: original });
    }
    expect(seededOnIds(original)).toEqual(before);
  });
});

describe("a role with no users reports no people", () => {
  const groups = buildPermissionGroupsForRole(archived.roleName);

  it("zeroes every people-derived insight", () => {
    const metrics = getRoleDetailInsights(archived.id, 0, groups);
    const byId = Object.fromEntries(metrics.map((m) => [m.id, m.value]));
    expect(byId["assigned-users"]).toBe("0");
    expect(byId["new-assignments"]).toBe("0");
    expect(byId["active-sessions"]).toBe("0");
    expect(byId["avg-tenure"]).toBe("—");
  });

  it("still reports them once the role has members again", () => {
    const metrics = getRoleDetailInsights(archived.id, 3, groups);
    const byId = Object.fromEntries(metrics.map((m) => [m.id, m.value]));
    expect(byId["assigned-users"]).toBe("3");
    expect(byId["avg-tenure"]).not.toBe("—");
  });
});
