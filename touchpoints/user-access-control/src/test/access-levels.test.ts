/* Keeps the access-level capability model tied to the permission catalogue.
 *
 * The access levels (All Access, View Only, Create / Edit, Grant Access,
 * Approve) are not a second permission system. Every capability is declared to
 * stand for a real permission id in the Users and Roles module, and the
 * capability matrix prints that id next to each row. Nothing enforced that
 * claim, so each catalogue recut quietly drifted the two apart: ERP-5550 added
 * Bulk Deactivate Users and Bulk Deactivate or Archive Roles as permissions of
 * their own and neither had a capability for months.
 *
 * These tests make the drift fail loudly instead: a permission added to the
 * module with no capability to represent it, or a capability citing an id the
 * catalogue no longer has, both break here.
 *
 * SCOPE. The levels gate the Users and Roles module only, which is what the
 * matrix page says ("in this module") and what the levels' own descriptions say
 * ("Can only view users and roles"). Global MFA is a separate module with no
 * access-mode gating on its page, so its permissions are deliberately outside
 * this model and are asserted as such below. */
import { describe, it, expect } from "vitest";
import { PERMISSION_MODULES } from "../app/data/permissions-data";
import {
  ACCESS_LEVELS,
  CAPABILITY_GROUPS,
  type AccessCapabilities,
} from "../app/components/access-mode";

const UR = PERMISSION_MODULES.find((m) => m.id === "users-roles")!.permissions;
const UR_IDS = new Set(UR.map((p) => p.id));

/** The sentinel the matrix prints for a capability with no backing permission. */
const DEFERRED = "no catalog permission, deferred";

/** Every concrete permission id cited by the matrix, one row may cite several. */
const CITED = new Set(
  CAPABILITY_GROUPS.flatMap((g) => g.items)
    .map((i) => i.permissionId)
    .filter((p) => p !== DEFERRED)
    .flatMap((p) => p.split(",").map((s) => s.trim())),
);

describe("access levels track the permission catalogue", () => {
  it("every permission id the matrix cites still exists", () => {
    for (const id of [...CITED].sort()) {
      expect(UR_IDS.has(id), `matrix cites ${id}, which is not in users-roles`).toBe(true);
    }
  });

  /* The direction that actually broke. A new permission lands in the catalogue
   * and nothing forces a capability to represent it, so the level model
   * silently stops covering the module. */
  it("every Users and Roles permission is represented by a capability", () => {
    const uncovered = UR.filter((p) => !CITED.has(p.id)).map((p) => `${p.id} (${p.name})`);
    expect(uncovered, "permissions with no capability in the access model").toEqual([]);
  });

  /* Only these two are allowed to have no backing permission, and only because
   * Users and Roles v1.3 retired both when Permission Requests was deferred out
   * of Pioneer while the prototype surface stayed built. Anything else claiming
   * "deferred" is a capability that was never wired to the catalogue. */
  it("only the deferred permission-request pair has no backing permission", () => {
    const deferred = CAPABILITY_GROUPS.flatMap((g) => g.items)
      .filter((i) => i.permissionId === DEFERRED)
      .map((i) => i.key)
      .sort();
    expect(deferred).toEqual(["canApproveRequests", "canViewRequests"]);
  });

  it("Global MFA is out of scope and cites nothing", () => {
    const mfa = PERMISSION_MODULES.find((m) => m.id === "global-mfa")!.permissions;
    for (const p of mfa) {
      expect(CITED.has(p.id), `${p.id} should not be in the Users and Roles access model`).toBe(false);
    }
  });

  /* The matrix renders one row per capability. A capability that exists on the
   * type but is missing from CAPABILITY_GROUPS is invisible in the UI even
   * though it gates real surfaces, which is how a gap hides. */
  it("every capability appears exactly once in the matrix", () => {
    const keys = CAPABILITY_GROUPS.flatMap((g) => g.items).map((i) => i.key);
    expect(new Set(keys).size, "a capability is listed twice").toBe(keys.length);

    // All Access holds every capability, so its own shape is the full key set.
    const all = ACCESS_LEVELS.find((l) => l.level === "all")!;
    const capabilityKeys = Object.keys(all).filter((k): k is keyof AccessCapabilities =>
      k.startsWith("can"),
    );
    expect([...keys].sort()).toEqual(capabilityKeys.sort());
  });

  /* Bulk permissions are granted independently of their single-record
   * counterparts, which the catalogue is explicit about. So a bulk capability
   * must never be the same boolean as the single-record one it resembles: they
   * may agree per level, but they have to be separately addressable. */
  it("bulk capabilities are distinct from their single-record counterparts", () => {
    for (const [bulk, single] of [
      ["canBulkDeactivateUsers", "canArchiveUser"],
      ["canBulkArchive", "canArchiveUser"],
      ["canBulkRoleLifecycle", "canManageRoleLifecycle"],
    ] as const) {
      expect(CITED.has(
        CAPABILITY_GROUPS.flatMap((g) => g.items).find((i) => i.key === bulk)!.permissionId,
      ), `${bulk} needs its own permission id`).toBe(true);
      expect(bulk).not.toBe(single);
    }
  });

  /* All Access is the unrestricted level: it must hold everything, or the
   * default persona is quietly denying something. */
  it("All Access holds every capability", () => {
    const all = ACCESS_LEVELS.find((l) => l.level === "all")!;
    for (const { key } of CAPABILITY_GROUPS.flatMap((g) => g.items)) {
      expect(all[key], `All Access is missing ${key}`).toBe(true);
    }
  });

  /* View Only is the read floor: it may hold read capabilities but nothing that
   * writes. Pinned so a new write capability defaulting to true somewhere
   * cannot land in the read-only persona unnoticed. */
  it("View Only holds no write capability", () => {
    const viewOnly = ACCESS_LEVELS.find((l) => l.level === "view_only")!;
    const reads: (keyof AccessCapabilities)[] = [
      "canAccessModule", "canViewBilling", "canViewAudit", "canViewRequests", "canExportUsers",
    ];
    for (const { key } of CAPABILITY_GROUPS.flatMap((g) => g.items)) {
      if (reads.includes(key)) continue;
      expect(viewOnly[key], `View Only should not hold ${key}`).toBe(false);
    }
  });

  /* The two capabilities added when ERP-5550's permissions were finally
   * represented were attribution, not restriction: they mirror the capability
   * that used to stand in for them, so no level lost an action. */
  it("the ERP-5550 bulk capabilities mirror what previously gated them", () => {
    for (const l of ACCESS_LEVELS) {
      expect(l.canBulkDeactivateUsers, `${l.level} bulk deactivate`).toBe(l.canBulkArchive);
      expect(l.canBulkRoleLifecycle, `${l.level} bulk role lifecycle`).toBe(l.canManageRoleLifecycle);
    }
  });
});
