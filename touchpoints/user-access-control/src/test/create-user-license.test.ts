import { describe, it, expect } from "vitest";
import { deriveUserLicense, FIELD_USER_PERMISSION_IDS } from "../app/lib/permission-tier";
import {
  PERMISSION_MODULES,
  buildEmptyTogglesForModule,
  buildDefaultTogglesForModule,
} from "../app/data/permissions-data";

/**
 * Creating a user is an identity action, not an access grant.
 *
 * Default-on permissions belong to ROLE authoring: a role has to do something,
 * so the catalogue suggests a starting set. A user does not. An admin who walks
 * past the Roles & Permissions step must get an account that holds nothing and
 * costs nothing, and the seat has to follow the access actually chosen, with
 * roles and directly-granted permissions weighed the same way.
 */

const aFieldPermissionId = "cc-execute";
const aFullAccessPermissionId = "ur-view-audit";

describe("the seat a newly created user gets", () => {
  it("is No License when neither a role nor a permission was chosen", () => {
    expect(deriveUserLicense([], {})).toBe("No License");
  });

  it("is No License when permissions were opened but all left off", () => {
    const allOff = PERMISSION_MODULES.reduce<Record<string, boolean>>(
      (acc, m) => ({ ...acc, ...buildEmptyTogglesForModule(m.id) }),
      {},
    );
    expect(Object.keys(allOff).length).toBeGreaterThan(0);
    expect(deriveUserLicense([], allOff)).toBe("No License");
  });

  it("is Field User from a field-tier role alone", () => {
    expect(deriveUserLicense(["Field User"], {})).toBe("Field User");
  });

  it("is Field User from a field-tier permission alone, with no role", () => {
    expect(
      deriveUserLicense([], { [aFieldPermissionId]: true }),
    ).toBe("Field User");
  });

  it("is Full Access from a full-access role alone", () => {
    expect(deriveUserLicense(["Field User", "Full Access"], {})).toBe("Full Access");
  });

  it("is Full Access from a direct full-access permission, even with no role", () => {
    expect(
      deriveUserLicense([], { [aFullAccessPermissionId]: true }),
    ).toBe("Full Access");
  });

  it("is Full Access when a field-tier role is paired with a full-access grant", () => {
    expect(
      deriveUserLicense(["Field User"], { [aFullAccessPermissionId]: true }),
    ).toBe("Full Access");
  });

  it("ignores permissions that are present but switched off", () => {
    expect(
      deriveUserLicense([], {
        [aFullAccessPermissionId]: false,
        [aFieldPermissionId]: false,
      }),
    ).toBe("No License");
  });
});

describe("the fixtures the seat rule is written against", () => {
  it("still classify the two sample permissions as this test assumes", () => {
    expect(FIELD_USER_PERMISSION_IDS.has(aFieldPermissionId)).toBe(true);
    expect(FIELD_USER_PERMISSION_IDS.has(aFullAccessPermissionId)).toBe(false);
  });
});

describe("the empty seed the user-creation surfaces use", () => {
  it("names every permission in the module and turns each one off", () => {
    for (const mod of PERMISSION_MODULES) {
      const empty = buildEmptyTogglesForModule(mod.id);
      expect(Object.keys(empty).sort()).toEqual(
        mod.permissions.map((p) => p.id).sort(),
      );
      expect(Object.values(empty).every((v) => v === false)).toBe(true);
    }
  });

  it("differs from the catalogue defaults, which are role authoring's concern", () => {
    const anyDefaultOn = PERMISSION_MODULES.some((mod) =>
      Object.values(buildDefaultTogglesForModule(mod.id)).some(Boolean),
    );
    expect(
      anyDefaultOn,
      "catalogue has default-on permissions, so seeding user creation with it would pre-grant access",
    ).toBe(true);
  });
});
