import { describe, it, expect } from "vitest";
import { roles } from "../app/data/roles-data";
import { PREDEFINED_ROLES } from "../app/data/predefined-roles";
import { ROLE_PERMISSION_MAP } from "../app/data/role-permissions-map";
import {
  USER_ROLE_IDS,
  USER_OWNED_IDS,
  getUsersForRole,
  getOwnerIdsForRole,
} from "../app/data/uac-derived";
import { users } from "../app/data/users-data";

describe("predefined-roles migration", () => {
  it("has 25 predefined + 4 custom roles", () => {
    expect(roles.filter((r) => r.isSystem)).toHaveLength(25);
    expect(roles.filter((r) => !r.isSystem)).toHaveLength(4);
  });

  it("every predefined optionId has a permission bundle", () => {
    for (const r of PREDEFINED_ROLES) {
      expect(ROLE_PERMISSION_MAP[r.optionId], `${r.name} (${r.optionId})`).toBeDefined();
    }
  });

  it("every USER_ROLE_IDS / USER_OWNED_IDS role id exists", () => {
    const valid = new Set(roles.map((r) => r.id));
    for (const ids of Object.values(USER_ROLE_IDS)) ids.forEach((id) => expect(valid.has(id)).toBe(true));
    for (const ids of Object.values(USER_OWNED_IDS)) ids.forEach((id) => expect(valid.has(id)).toBe(true));
  });

  it("Account Owner (1) is protected and held by Eli Rosenbloom (4) and Nophil Anwer (5)", () => {
    const ao = roles.find((r) => r.id === 1)!;
    expect(ao.isProtected).toBe(true);
    const holders = getUsersForRole(1);
    expect(holders.map((u) => u.id)).toEqual([4, 5]);
    expect(holders.map((u) => u.fullName)).toEqual(["Eli Rosenbloom", "Nophil Anwer"]);
    // Both hold only the Account Owner role, and use their @omnesoft.com address.
    for (const u of holders) {
      expect(USER_ROLE_IDS[u.id]).toEqual([1]);
      expect(u.email.endsWith("@omnesoft.com")).toBe(true);
    }
  });

  it("license-conflict fixture: user 17 (Field User) holds a Full-Access role", () => {
    const u17 = users.find((u) => u.id === 17)!;
    expect(u17.license).toBe("Field User");
    const roleIds = USER_ROLE_IDS[17];
    const holdsFull = roleIds.some((id) => roles.find((r) => r.id === id)?.licenseRequired === "Full Access");
    expect(holdsFull).toBe(true);
  });

  it("owner-without-membership fixture: Nophil (5) owns Sales Rep (16) without membership", () => {
    expect(USER_OWNED_IDS[5]).toContain(16);
    expect(USER_ROLE_IDS[5]).not.toContain(16);
    expect(getOwnerIdsForRole(16)).toContain(5);
  });

  it("ownership fixtures", () => {
    expect(getOwnerIdsForRole(27)).toHaveLength(0); // Data Analyst, zero owners
    expect(getOwnerIdsForRole(25)).toHaveLength(0); // Basic User, zero owners (empty-state fixture)
    // Compliance Auditor: Eli (non-member, Manage Roles) + member co-owner 48
    expect(getOwnerIdsForRole(26).sort((a, b) => a - b)).toEqual([4, 48]);
  });

  /* One intentional licence conflict in the fixture (user 17) and no accidental
   * ones. Predefined Roles v2.4 made Basic User a Full Access role, so the two
   * field-licensed users who held that landing seat were re-seated rather than
   * left silently under-licensed. */
  it("Field-license users hold only Field User roles except the conflict user", () => {
    // Field-role id set is derived, not hardcoded, so new Field User roles
    // (e.g. the Warehouse Operator custom role, id 29) don't break this.
    const fieldRoleIds = new Set(
      roles.filter((r) => r.licenseRequired === "Field User").map((r) => r.id),
    );
    const fieldUsers = users.filter((u) => u.license === "Field User").map((u) => u.id);
    for (const uid of fieldUsers) {
      if (uid === 17) continue; // intentional conflict
      for (const id of USER_ROLE_IDS[uid] ?? []) {
        expect(fieldRoleIds.has(id), `user ${uid} holds non-field role ${id}`).toBe(true);
      }
    }
  });

  it("every role except Account Owner (and archived) has at least 10 members", () => {
    const ao = getUsersForRole(1);
    expect(ao.length).toBe(2); // Account Owner, its two curated holders
    for (const r of roles) {
      if (r.id === 1) continue; // Account Owner exempt
      if (r.status === "Archived") continue; // archived roles are unpadded
      expect(getUsersForRole(r.id).length, `${r.roleName} (${r.id})`).toBeGreaterThanOrEqual(10);
    }
  });

  it("no user holds more than 8 roles", () => {
    for (const u of users) {
      const count = (USER_ROLE_IDS[u.id] ?? []).length;
      expect(count, `${u.fullName} (${u.id})`).toBeLessThanOrEqual(8);
    }
  });
});
