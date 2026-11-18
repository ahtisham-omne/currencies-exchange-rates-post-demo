import { describe, expect, it } from "vitest";
import {
  GLOBAL_ACCOUNT_ALERTS,
  PREDEFINED_ROLES,
  getRoleAlertDefaults,
} from "../app/data/predefined-roles";
import { ALL_ALERTS } from "../app/data/alerts-data";
import { roles } from "../app/data/roles-data";

const CATALOG_TITLES = new Set(ALL_ALERTS.map((a) => a.title));

describe("role alert defaults", () => {
  /* Role alerts join to the catalog on the alert TITLE, so a renamed title
   * silently drops a role's alert to zero rather than failing loudly. */
  it("every role's alert names exist in the alerts catalog", () => {
    const orphans: string[] = [];
    for (const role of roles) {
      for (const a of getRoleAlertDefaults(role.roleName) ?? []) {
        if (!CATALOG_TITLES.has(a.name)) orphans.push(`${role.roleName} → ${a.name}`);
      }
    }
    expect(orphans).toEqual([]);
  });

  it("every role in the listing has alert defaults, predefined and custom", () => {
    const missing = roles.filter((r) => getRoleAlertDefaults(r.roleName) === undefined);
    expect(missing.map((r) => r.roleName)).toEqual([]);
  });

  it("account-level global alerts are never listed on a role", () => {
    const globals = new Set<string>(GLOBAL_ACCOUNT_ALERTS.map((a) => a.name));
    const leaked: string[] = [];
    for (const role of roles) {
      for (const a of getRoleAlertDefaults(role.roleName) ?? []) {
        if (globals.has(a.name)) leaked.push(`${role.roleName} → ${a.name}`);
      }
    }
    expect(leaked).toEqual([]);
  });

  it("no role lists the same alert twice", () => {
    const dupes: string[] = [];
    for (const role of roles) {
      const names = (getRoleAlertDefaults(role.roleName) ?? []).map((a) => a.name);
      if (names.length !== new Set(names).size) dupes.push(role.roleName);
    }
    expect(dupes).toEqual([]);
  });

  /* The point of the on/off mix: each role should read as a real, partially
   * tuned configuration rather than "everything on". Basic User is the one
   * deliberate empty set (a read-only landing seat). */
  it("roles carry a genuine mix of enabled and off-by-default alerts", () => {
    const withAlerts = PREDEFINED_ROLES.filter((r) => r.alerts.length > 0);
    expect(withAlerts.length).toBe(24); // all but Basic User
    for (const r of withAlerts) {
      expect(r.alerts.some((a) => !a.offByDefault), `${r.name} has no enabled alert`).toBe(true);
      expect(r.alerts.some((a) => a.offByDefault), `${r.name} has no off-by-default alert`).toBe(true);
    }
    // and no role is fully on across the board
    const totalOff = PREDEFINED_ROLES.flatMap((r) => r.alerts).filter((a) => a.offByDefault).length;
    expect(totalOff).toBeGreaterThan(30);
  });
});
