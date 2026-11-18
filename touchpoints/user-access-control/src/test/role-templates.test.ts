/* Guards the role-template library (Predefined Roles, Pioneer v2.12, 14 Oct
 * 26) against catalog drift. The permission COUNTS below are the ones the spec
 * states per template; they are verified against what actually resolves out of
 * the catalog, so a rename in permissions-data shows up here rather than as a
 * quietly smaller template in the picker. */
import { describe, it, expect, vi } from "vitest";
import {
  ALL_ROLE_TEMPLATES,
  DEFAULT_ROLE_TEMPLATES,
  FIELD_USER_ROLE_TEMPLATES,
  FULL_ACCESS_ROLE_TEMPLATES,
  templateMatchesQuery,
} from "../app/components/create-role/role-templates";
import { PERMISSION_MODULES } from "../app/data/permissions-data";
import { getTemplateDetail, getTemplateStats } from "../app/data/role-template-details";
import { countDistinctPermissions } from "../app/data/linked-permissions";

const PERMISSION_BY_ID = new Map(
  PERMISSION_MODULES.flatMap((m) => m.permissions.map((p) => [p.id, p] as const))
);
const MODULE_OF = new Map(
  PERMISSION_MODULES.flatMap((m) => m.permissions.map((p) => [p.id, m] as const))
);

/** template name → permission count the spec states (v2.12). A linked
 *  permission listed under two modules counts once (ERP-5531 AC3, ERP-5500
 *  AC23): Supply Chain Coordinator and Procurement Officer each list Manage
 *  Vendor Qualification under Item Library and Partners. */
const STATED: Record<string, number> = {
  "Warehouse Manager": 25,
  "Finance Controller": 25,
  "Supply Chain Coordinator": 17,
  "Procurement Officer": 15,
  "Sales Operations Lead": 21,
  "HR Coordinator": 5,
  "IT Administrator": 16,
  "Support Agent": 10,
  "Auditor (Read-Only)": 16,
  "Inventory Specialist": 9,
  "Shipping Supervisor": 5,
  "Quality Inspector": 7,
};

describe("role template library", () => {
  it("is the 12, A to Z, split 10 full access and 2 field user", () => {
    const names = ALL_ROLE_TEMPLATES.map((t) => t.name);
    expect(names).toEqual(Object.keys(STATED).sort((a, b) => a.localeCompare(b)));
    expect(names).toHaveLength(12);
    expect(FULL_ACCESS_ROLE_TEMPLATES).toHaveLength(10);
    expect(FIELD_USER_ROLE_TEMPLATES).toHaveLength(2);
    /* v2.4 moved these three from Field User to Full Access. */
    for (const name of ["Support Agent", "Auditor (Read-Only)", "Inventory Specialist"]) {
      expect(ALL_ROLE_TEMPLATES.find((t) => t.name === name)!.group, name).toBe("Full Access");
    }
    expect(FIELD_USER_ROLE_TEMPLATES.map((t) => t.name)).toEqual([
      "Quality Inspector",
      "Shipping Supervisor",
    ]);
  });

  /* The three that changed group carry the note that explains the seat, so an
   * admin reading the card understands why a read-only template is not free. */
  it("the three reclassified templates explain their seat", () => {
    for (const name of ["Support Agent", "Auditor (Read-Only)", "Inventory Specialist"]) {
      const t = ALL_ROLE_TEMPLATES.find((x) => x.name === name)!;
      expect(t.licenseNote, name).toBeTruthy();
      expect(t.licenseNote, name).toMatch(/full seat|Full Access/);
    }
    // Nothing else carries one.
    expect(ALL_ROLE_TEMPLATES.filter((t) => t.licenseNote).length).toBe(3);
  });

  /* Finance Controller's Partner Group permissions are written with the
   * "(group)" suffix the spec and the Partners catalog use. This catalog carries
   * the suffix on two of the six, so the resolver drops it inside the module. */
  it("the (group) suffix resolves to the Partner Group permissions", () => {
    const fc = ALL_ROLE_TEMPLATES.find((t) => t.name === "Finance Controller")!;
    expect(fc.permissionIds).toContain("pg-credit-limit");
    expect(fc.permissionIds).toContain("pg-payment-terms");
    expect(fc.permissionIds).toContain("pg-access");
    // and not the Partners permissions of the same name
    expect(fc.permissionIds).toContain("prt-credit-limit");
    expect(fc.permissionIds).toContain("prt-payment-terms");
  });

  it("the Basic Details step shows the first six alphabetically", () => {
    expect(DEFAULT_ROLE_TEMPLATES).toHaveLength(6);
    expect(DEFAULT_ROLE_TEMPLATES.map((t) => t.name)).toEqual(
      ALL_ROLE_TEMPLATES.slice(0, 6).map((t) => t.name)
    );
  });

  it("every permission resolves against the catalog, with the stated count", () => {
    for (const t of ALL_ROLE_TEMPLATES) {
      for (const id of t.permissionIds) {
        expect(PERMISSION_BY_ID.has(id), `${t.name}: unknown ${id}`).toBe(true);
      }
      expect(new Set(t.permissionIds).size, `${t.name}: duplicate ids`).toBe(t.permissionIds.length);
      expect(countDistinctPermissions(t.permissionIds), t.name).toBe(STATED[t.name]);
      expect(t.permissionNames.length, t.name).toBe(t.permissionIds.length);
    }
  });

  it("no template carries a granular permission without that module's access gate", () => {
    for (const t of ALL_ROLE_TEMPLATES) {
      const granted = new Set(t.permissionIds);
      const touched = new Set(t.permissionIds.map((id) => MODULE_OF.get(id)!.id));
      for (const modId of touched) {
        const gate = PERMISSION_MODULES.find((m) => m.id === modId)!.permissions.find(
          (p) => p.category === "Module access"
        );
        expect(granted.has(gate!.id), `${t.name}: ${modId} without its access gate`).toBe(true);
      }
    }
  });

  /* Section 3 of the spec: three Receiving permissions are post-Pioneer, and
   * Authorize overship is out entirely. Approve short shipments is allowed on
   * Warehouse Manager alone. */
  it("excluded permissions appear nowhere", () => {
    for (const t of ALL_ROLE_TEMPLATES) {
      for (const dead of ["rcv-discrepancy", "rcv-edit-confirmed", "rcv-void", "ship-overship"]) {
        expect(t.permissionIds.includes(dead), `${t.name} holds ${dead}`).toBe(false);
      }
    }
    const shortShip = ALL_ROLE_TEMPLATES.filter((t) => t.permissionIds.includes("ship-approve-short"));
    expect(shortShip.map((t) => t.name)).toEqual(["Warehouse Manager"]);
  });

  /* Delete role is out of the catalog, and the two deferred permission-request
   * permissions never existed in Pioneer. Nothing may reintroduce them. */
  it("no template references a permission the catalog dropped", () => {
    for (const t of ALL_ROLE_TEMPLATES) {
      for (const dead of ["ur-delete-role", "ur-approve-requests", "ur-view-requests"]) {
        expect(t.permissionIds.includes(dead), `${t.name} holds ${dead}`).toBe(false);
      }
    }
  });

  /* IT Administrator is the template that depends on the 11 Aug role-lifecycle
   * split (ERP-5550). Without those two permissions it would silently ship
   * two short. */
  it("IT Administrator carries the split role-lifecycle permissions", () => {
    const it = ALL_ROLE_TEMPLATES.find((t) => t.name === "IT Administrator")!;
    expect(it.permissionIds).toContain("ur-deactivate-role");
    expect(it.permissionIds).toContain("ur-archive-role");
    expect(it.permissionIds).not.toContain("mfa-delete");
  });

  it("the compact set is a subset of the library", () => {
    expect(DEFAULT_ROLE_TEMPLATES.length).toBeGreaterThan(0);
    for (const t of DEFAULT_ROLE_TEMPLATES) {
      expect(ALL_ROLE_TEMPLATES).toContain(t);
    }
  });

  /* ERP-5500 AC23 (QA, 6 Nov): Manage Vendor Qualification is one linked
   * permission shown under Item Library and Partners. The summary keeps both
   * module lines; only the count dedupes. */
  it("a linked permission listed under two modules shows twice but counts once", () => {
    for (const [name, count] of [["Procurement Officer", 15], ["Supply Chain Coordinator", 17]] as const) {
      const t = ALL_ROLE_TEMPLATES.find((x) => x.name === name)!;
      expect(t.permissionIds, name).toEqual(expect.arrayContaining(["item-manage-vendors", "prt-vendor-qualification"]));
      expect(t.permissionIds.length, name).toBe(count + 1);
      const detail = getTemplateDetail(t.permissionIds)!;
      const lines = detail.modules.flatMap((m) => m.permissions.map((p) => `${m.id}:${p.name}`));
      expect(lines, name).toEqual(expect.arrayContaining([
        "item-library:Manage Vendor Qualification",
        "partners:Manage Vendor Qualification",
      ]));
      expect(getTemplateStats(detail).totalPermissions, name).toBe(count);
    }
  });

  it("detail expansion agrees with the template's own set", () => {
    for (const t of ALL_ROLE_TEMPLATES) {
      const detail = getTemplateDetail(t.permissionIds)!;
      const stats = getTemplateStats(detail);
      expect(stats.totalPermissions, t.name).toBe(countDistinctPermissions(t.permissionIds));
      expect(stats.moduleCount, t.name).toBe(
        new Set(t.permissionIds.map((id) => MODULE_OF.get(id)!.id)).size
      );
    }
  });

  /* ERP-8617 as recorded in v2.12: every Full Access template gains Access
   * Module Defaults Module, no template holds Manage Module Defaults, and the
   * two Field User templates hold neither. */
  it("Access Module Defaults Module is on every Full Access template and no Field User one", () => {
    for (const t of FULL_ACCESS_ROLE_TEMPLATES) {
      expect(t.permissionIds, t.name).toContain("md-access");
    }
    for (const t of FIELD_USER_ROLE_TEMPLATES) {
      expect(t.permissionIds, t.name).not.toContain("md-access");
    }
    for (const t of ALL_ROLE_TEMPLATES) {
      expect(t.permissionIds, t.name).not.toContain("md-manage");
    }
    expect(
      ALL_ROLE_TEMPLATES.filter((t) => t.permissionIds.includes("md-access")).map((t) => t.name)
    ).toHaveLength(10);
  });

  /* v2.5 (ERP-5549), v2.8 (ERP-5546), and v2.11 (ERP-5543). */
  it("carries the Partners split, the purchase order rulings, and the declared value removal", () => {
    const byName = (n: string) => ALL_ROLE_TEMPLATES.find((t) => t.name === n)!;
    const fc = byName("Finance Controller");
    expect(fc.permissionIds).toContain("prt-manage-payment-terms");
    expect(fc.permissionIds).not.toContain("pg-manage-payment-terms");
    expect(fc.permissionIds).not.toContain("prt-manage-pricing-rules");
    for (const n of ["Procurement Officer", "Supply Chain Coordinator"]) {
      const t = byName(n);
      for (const id of [
        "po-create", "po-nonqualified", "po-apply-pricing", "po-discounts",
        "item-manage-vendors", "prt-vendor-qualification",
      ]) {
        expect(t.permissionIds, `${n} / ${id}`).toContain(id);
      }
      expect(t.permissionIds, n).not.toContain("po-pricing-rules");
      expect(t.permissionIds, n).not.toContain("po-bulk-import");
    }
    /* Every template with Create and Edit Purchase Orders holds the trio. */
    for (const t of ALL_ROLE_TEMPLATES.filter((x) => x.permissionIds.includes("po-create"))) {
      for (const id of ["po-nonqualified", "po-apply-pricing", "po-discounts"]) {
        expect(t.permissionIds, `${t.name} / ${id}`).toContain(id);
      }
    }
    for (const t of ALL_ROLE_TEMPLATES) {
      expect(t.permissionIds, t.name).not.toContain("ship-view-value");
    }
  });

  /* Each seed's statedCount equals what resolves, so loading the library
   * prints no drift warning (unresolved names or invariant breaks). */
  it("loads without a drift warning", async () => {
    vi.resetModules();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await import("../app/components/create-role/role-templates");
      const own = warn.mock.calls.filter((c) => String(c[0]).startsWith("[role templates]"));
      expect(own).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });

  it("search matches name, description, and permission name", () => {
    const wm = ALL_ROLE_TEMPLATES.find((t) => t.name === "Warehouse Manager")!;
    expect(templateMatchesQuery(wm, "warehouse")).toBe(true);
    expect(templateMatchesQuery(wm, "outbound work")).toBe(true);
    expect(templateMatchesQuery(wm, "Approve Short Shipments")).toBe(true);
    expect(templateMatchesQuery(wm, "delete mfa policy")).toBe(false);
  });
});
