/* Role names are unique across the whole listing, whatever a role's status.
 * That matters most on the way OUT of the archive: a role sat archived while
 * other roles were created, so its old name may no longer be free, and the
 * unarchive stepper has to say so before it writes. These pin the rule the
 * stepper and Create Role both run on. */
import { describe, it, expect } from "vitest";
import { isRoleNameTaken, roleNameCollisionMessage } from "../app/data/roles-table-config";
import { roles } from "../app/data/roles-data";

const archived = roles.find((r) => r.status === "Archived")!;
const active = roles.find((r) => r.status === "Active" && !r.isSystem)!;
const system = roles.find((r) => r.isSystem)!;

describe("role name uniqueness", () => {
  it("the fixture data has an archived role to test against", () => {
    expect(archived).toBeDefined();
    expect(archived.status).toBe("Archived");
  });

  it("counts names regardless of status, archived and inactive included", () => {
    expect(isRoleNameTaken(archived.roleName)).toBe(true);
    expect(isRoleNameTaken(active.roleName)).toBe(true);
    expect(isRoleNameTaken(system.roleName)).toBe(true);
    for (const r of roles) {
      expect(isRoleNameTaken(r.roleName), r.roleName).toBe(true);
    }
  });

  it("is case- and whitespace-insensitive", () => {
    expect(isRoleNameTaken(archived.roleName.toUpperCase())).toBe(true);
    expect(isRoleNameTaken(`  ${archived.roleName.toLowerCase()}  `)).toBe(true);
  });

  it("a free name is free", () => {
    expect(isRoleNameTaken("Nobody Has This Name Yet")).toBe(false);
    expect(roleNameCollisionMessage("Nobody Has This Name Yet")).toBeNull();
  });

  /* The role being edited is itself in the listing, so without the exclusion
   * every unarchive and every rename-to-itself would report a collision. */
  it("excludes the role being edited, so keeping its own name is valid", () => {
    expect(isRoleNameTaken(archived.roleName, archived.id)).toBe(false);
    expect(roleNameCollisionMessage(archived.roleName, archived.id)).toBeNull();
    // …but it still collides with a DIFFERENT role's name
    expect(isRoleNameTaken(active.roleName, archived.id)).toBe(true);
    expect(roleNameCollisionMessage(active.roleName, archived.id)).toContain(active.roleName);
  });

  it("a blank name is a required-field error, not a collision", () => {
    expect(isRoleNameTaken("")).toBe(false);
    expect(isRoleNameTaken("   ")).toBe(false);
    expect(roleNameCollisionMessage("")).toBeNull();
    expect(roleNameCollisionMessage("   ")).toBeNull();
  });

  it("the message names the collision and reads the same everywhere", () => {
    expect(roleNameCollisionMessage(active.roleName)).toBe(
      `A role named "${active.roleName}" already exists. Each role must have a unique name.`,
    );
    // Trimmed input is echoed back trimmed.
    expect(roleNameCollisionMessage(`  ${active.roleName}  `)).toBe(
      `A role named "${active.roleName}" already exists. Each role must have a unique name.`,
    );
  });
});
