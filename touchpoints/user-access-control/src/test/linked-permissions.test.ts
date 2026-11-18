/* Guards the linked-permission groups (data/linked-permissions.ts) against
 * catalog drift. Each group names permissions in DIFFERENT modules that edit
 * the same backend entity; the toggle UI keeps a group in lockstep, so a stale
 * id or a contradictory default would surface as a broken cascade. */
import { describe, it, expect } from "vitest";
import { PERMISSION_MODULES } from "../app/data/permissions-data";
import {
  LINKED_PERMISSION_GROUPS,
  getLinkedGroup,
  getLinkedPermissionRefs,
  getCrossModuleLinkedUpdates,
} from "../app/data/linked-permissions";

const ALL = PERMISSION_MODULES.flatMap((m) =>
  m.permissions.map((p) => ({ ...p, moduleId: m.id }))
);
const BY_ID = new Map(ALL.map((p) => [p.id, p]));

describe("linked permission groups", () => {
  it("every member id exists in the catalog", () => {
    LINKED_PERMISSION_GROUPS.forEach((group) => {
      group.permissionIds.forEach((pid) => {
        expect(BY_ID.has(pid), `${group.id}: unknown permission id ${pid}`).toBe(true);
      });
    });
  });

  it("groups have at least two members and no permission sits in two groups", () => {
    const seen = new Set<string>();
    LINKED_PERMISSION_GROUPS.forEach((group) => {
      expect(group.permissionIds.length).toBeGreaterThanOrEqual(2);
      group.permissionIds.forEach((pid) => {
        expect(seen.has(pid), `${pid} appears in more than one group`).toBe(false);
        seen.add(pid);
      });
    });
  });

  it("members of a group live in distinct modules (same-module duplicates would be a catalog bug)", () => {
    LINKED_PERMISSION_GROUPS.forEach((group) => {
      const moduleIds = group.permissionIds.map((pid) => BY_ID.get(pid)?.moduleId);
      expect(new Set(moduleIds).size).toBe(group.permissionIds.length);
    });
  });

  it("members of a group agree on defaultEnabled, so fresh roles seed consistently", () => {
    LINKED_PERMISSION_GROUPS.forEach((group) => {
      const defaults = new Set(
        group.permissionIds.map((pid) => BY_ID.get(pid)?.defaultEnabled)
      );
      expect(defaults.size, `${group.id} seeds a contradictory default`).toBe(1);
    });
  });

  it("lookups resolve both directions", () => {
    expect(getLinkedGroup("po-pricing-rules")?.id).toBe("pricing-rules");
    expect(getLinkedGroup("item-access")).toBeNull();

    const refs = getLinkedPermissionRefs("prt-manage-payment-terms");
    expect(refs.map((r) => r.permissionId)).toEqual(["pg-manage-payment-terms"]);
    expect(refs[0].moduleName).toBe("Partner Group");
    expect(getLinkedPermissionRefs("item-access")).toEqual([]);
  });

  it("cross-module cascade excludes the module the change came from", () => {
    const cross = getCrossModuleLinkedUpdates({ "po-pricing-rules": true }, "purchase-orders");
    expect(cross).toEqual({
      "qt-manage-pricing-rules": true,
      "so-manage-pricing-rules": true,
      "prt-manage-pricing-rules": true,
      "pg-manage-pricing-rules": true,
    });
    // Partners hosts two of the five: a change from Partners cascades to three.
    const fromPartners = getCrossModuleLinkedUpdates(
      { "prt-manage-pricing-rules": false },
      "partners"
    );
    expect(Object.keys(fromPartners).sort()).toEqual([
      "pg-manage-pricing-rules",
      "po-pricing-rules",
      "qt-manage-pricing-rules",
      "so-manage-pricing-rules",
    ]);
    expect(Object.values(fromPartners).every((v) => v === false)).toBe(true);
  });
});
