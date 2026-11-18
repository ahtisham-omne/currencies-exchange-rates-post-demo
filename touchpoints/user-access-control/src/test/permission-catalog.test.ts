/* Guards the permission catalog and everything derived from it against drift.
 * Pinned to the August 2026 update: Purchase Orders per the ERP-5543 18 Aug
 * recut (Modify pricing rules split into Manage and Apply, eight active), Users and Roles v1.3 (3 out, 3 in, 1 renamed), the ERP-5550
 * catalogue recut of 11 Aug (role lifecycle split out of Create and edit roles,
 * taking Users and Roles to 20, and nine permissions marked mobile-capable),
 * the Item Library recut of ERP-5537 (nine permissions: configuration folded
 * into Create and edit items, selling price onto Edit item pricing),
 * the ERP-6378 licence table (13 Field User permissions, the rest Full Access),
 * the Predefined Roles v2.12 role bundles (14 Oct 26), the 10 Sep 26 catalogue
 * revision that added General Settings (ERP-7228) as the eighteenth module and
 * swept attachment handling into the permissions that already own each record,
 * and the Oct 26 revision (129 active across 19 modules): Module Defaults
 * (ERP-8617) as the nineteenth module, Edit Account Owner removed from General
 * Settings, View declared value on shipment documents deferred out of Pioneer,
 * and Apply Pricing Rules plus one-time discounts on POs On by default. The
 * build holds the 129 active rows: the three post-Pioneer Receiving permissions
 * are parked in BACKLOGGED_PERMISSIONS (ERP-5506 AC30, 9 Nov 26). ERP-11305
 * (12 Nov 26) takes Physical Inventory to six with Bulk Import and Bulk Export
 * Physical Inventory (131 active) and turns View Inventory Valuation Data on
 * by default. Counts here
 * are stated so the
 * DERIVED result can be verified, they are not a second source of truth: if a
 * spec change lands, update the catalog first and these numbers second. */
import { describe, it, expect } from "vitest";
import { BACKLOGGED_PERMISSIONS, BACKLOGGED_PERMISSION_IDS, PERMISSION_MODULES, buildDefaultToggles } from "../app/data/permissions-data";
import { ROLE_PERMISSION_MAP } from "../app/data/role-permissions-map";
import { PREDEFINED_ROLES } from "../app/data/predefined-roles";
import { VIEW_IN_MODULE_DATA } from "../app/data/view-in-module-data";
import { getPermissionRecommendations, MODULE_ACCESS_GATES } from "../app/data/permission-recommendations";
import { permissionRequiresFullAccess, computeRoleTier } from "../app/lib/permission-tier";
import { getRolesWithPermission } from "../app/data/permission-holders";
import { getLinkedGroup } from "../app/data/linked-permissions";
import { roles } from "../app/data/roles-data";
import { roleNameToOptionId } from "../app/data/roles-data";

const ALL = PERMISSION_MODULES.flatMap((m) => m.permissions);
const IDS = new Set(ALL.map((p) => p.id));

describe("UAC Aug-2026 update", () => {
  it("backlogged permissions stay out of the catalogue and every role", () => {
    for (const id of BACKLOGGED_PERMISSION_IDS) {
      expect(IDS.has(id), id).toBe(false);
      for (const [key, ids] of Object.entries(ROLE_PERMISSION_MAP)) expect(ids, key).not.toContain(id);
    }
  });

  it("totals", () => {
    expect(ALL.length).toBe(131); // ERP-5506 AC30: three Receiving rows parked; ERP-11305: +2 Physical Inventory
    expect(PERMISSION_MODULES.find((m) => m.id === "physical-inventory")!.permissions.map((p) => p.id)).toEqual([
      "pi-access", "pi-view-valuation", "pi-adjust", "pi-quarantine", "pi-bulk-import", "pi-bulk-export",
    ]);
    expect(PERMISSION_MODULES.length).toBe(19);
    expect(PERMISSION_MODULES.find((m) => m.id === "partner-group")!.permissions.length).toBe(10);
    expect(PERMISSION_MODULES.find((m) => m.id === "purchase-orders")!.permissions.length).toBe(8);
    expect(PERMISSION_MODULES.find((m) => m.id === "users-roles")!.permissions.length).toBe(20);
    expect(PERMISSION_MODULES.find((m) => m.id === "cycle-count")!.permissions.length).toBe(4);
    expect(PERMISSION_MODULES.find((m) => m.id === "item-library")!.permissions.length).toBe(9);
    expect(PERMISSION_MODULES.find((m) => m.id === "general-settings")!.permissions.length).toBe(3);
    expect(PERMISSION_MODULES.find((m) => m.id === "module-defaults")!.permissions.length).toBe(2);
    expect(PERMISSION_MODULES.find((m) => m.id === "shipments")!.permissions.length).toBe(9);
  });

  it("domain totals", () => {
    const sum = (ids: string[]) =>
      ids.reduce((n, id) => n + PERMISSION_MODULES.find((m) => m.id === id)!.permissions.length, 0);
    expect(sum(["item-library", "item-categories", "cycle-count", "unit-of-measure", "physical-inventory", "warehouse-locations"])).toBe(27);
    expect(sum(["purchase-orders", "receiving", "inventory-movement", "shipments"])).toBe(23);
    expect(sum(["quotes", "sales-orders"])).toBe(27);
    expect(sum(["partners", "partner-group", "contacts"])).toBe(26);
    expect(sum(["general-settings", "module-defaults", "users-roles", "global-mfa"])).toBe(28);
  });

  /* Defaults follow the compiled Permission Catalogue (Pioneer). The field-
   * licence floor gates are On there: Cycle Count access and execute, UOM
   * access, Receiving access and confirm, and the Quotes access gate. Warehouse
   * Manage Locations is Off, matching its Manage Warehouses sibling. The Oct 26
   * revision adds three: Apply Pricing Rules and Add one-time discounts and
   * premiums on POs, and the Module Defaults access gate. */
  /* ERP-11305 AC 2 (Eli, 8 Nov 26): View Inventory Valuation Data starts On. */
  it("default-on set is 43 and matches the spec list", () => {
    const on = Object.entries(buildDefaultToggles()).filter(([, v]) => v).map(([k]) => k).sort();
    expect(on.length).toBe(43);
    expect(on).toEqual([
      "cc-access", "cc-execute",
      "ct-access", "ct-create-edit",
      "md-access",
      "mv-access", "mv-create", "mv-execute",
      "pg-access", "pg-config-customer", "pg-config-vendor",
      "pi-access", "pi-quarantine", "pi-view-valuation",
      "po-access", "po-apply-pricing", "po-discounts", "po-nonqualified",
      "prt-access", "prt-config-customer", "prt-config-vendor", "prt-create-edit", "prt-payment-method",
      "qt-access", "qt-approve-convert", "qt-attachments", "qt-cancel", "qt-edit",
      "qt-export", "qt-manage-reps", "qt-send", "qt-view-pricing",
      "rcv-access", "rcv-labels", "rcv-receive",
      "ship-access",
      "so-access", "so-attachments", "so-create", "so-export", "so-manage-reps", "so-view-pricing",
      "uom-access",
    ].sort());
  });

  /* ERP-5550 (15 Aug): every one of the twenty is off by default. The build
   * carried View Billing Overview and Cost Impact and Send Secure Login /
   * Password Reset Instructions switched on; the story calls both out as wrong.
   * Pinned as a whole-module property so a future recut cannot reintroduce a
   * default-on permission here without failing. */
  it("no Users and Roles permission is on by default", () => {
    const ur = PERMISSION_MODULES.find((m) => m.id === "users-roles")!.permissions;
    expect(ur.length).toBe(20);
    expect(ur.filter((p) => p.defaultEnabled).map((p) => p.id)).toEqual([]);
  });

  /* ERP-7228, added to the compiled catalogue on 10 Sep 26. Three permissions
   * since Edit Account Owner was removed on 8 Oct 26, every one Off and every
   * one Full Access, and Purchase Storage depends on the module gate, which the
   * Rule A gate map already carries. Edit Account Owner is parked in
   * BACKLOGGED_PERMISSIONS and must stay out of the catalogue. */
  it("General Settings seeds the three ERP-7228 permissions", () => {
    const gs = PERMISSION_MODULES.find((m) => m.id === "general-settings")!;
    expect(gs.permissions.map((p) => p.id)).toEqual([
      "gs-access", "gs-edit-company", "gs-purchase-storage",
    ]);
    expect(gs.permissions.map((p) => p.name)).toEqual([
      "Access General Settings Module",
      "Edit Company Information & Global Preferences",
      "Purchase Storage",
    ]);
    expect(gs.permissions.filter((p) => p.defaultEnabled)).toEqual([]);
    for (const p of gs.permissions) {
      expect(permissionRequiresFullAccess(p), p.id).toBe(true);
      expect(p.platform, p.id).toBeUndefined(); // web only
    }
    expect(MODULE_ACCESS_GATES["general-settings"]).toBe("gs-access");
    expect(
      getPermissionRecommendations("gs-purchase-storage")
        .flatMap((g) => g.options.map((o) => o.permissionId))
    ).toContain("gs-access");
  });

  /* ERP-8617, the nineteenth module. Both Full Access and web only. Access is
   * On by default and Manage is Off, and Manage recommends the gate because it
   * has no effect without it. The all-access roles pick both up from
   * ALL_PERMISSION_IDS. */
  it("Module Defaults seeds the two ERP-8617 permissions", () => {
    const md = PERMISSION_MODULES.find((m) => m.id === "module-defaults")!;
    expect(md.permissions.map((p) => p.id)).toEqual(["md-access", "md-manage"]);
    expect(md.permissions.map((p) => p.name)).toEqual([
      "Access Module Defaults Module",
      "Manage Module Defaults",
    ]);
    expect(md.permissions.filter((p) => p.defaultEnabled).map((p) => p.id)).toEqual(["md-access"]);
    for (const p of md.permissions) {
      expect(permissionRequiresFullAccess(p), p.id).toBe(true);
      expect(p.platform, p.id).toBeUndefined(); // web only
    }
    expect(MODULE_ACCESS_GATES["module-defaults"]).toBe("md-access");
    expect(
      getPermissionRecommendations("md-manage")
        .flatMap((g) => g.options.map((o) => o.permissionId))
    ).toContain("md-access");
    expect(getRolesWithPermission("md-manage").map((r) => r.roleName).sort()).toEqual([
      "Account Owner", "Super Administrator", "System Configuration Manager",
    ]);
  });

  it("removed permissions are gone everywhere", () => {
    for (const dead of ["ur-delete-role", "ur-approve-requests", "ur-view-requests"]) {
      expect(IDS.has(dead), `catalog still has ${dead}`).toBe(false);
      expect(VIEW_IN_MODULE_DATA[dead], `view-in-module still has ${dead}`).toBeUndefined();
      for (const [k, ids] of Object.entries(ROLE_PERMISSION_MAP)) {
        expect(ids.includes(dead), `${k} still holds ${dead}`).toBe(false);
      }
    }
  });

  it("new permissions exist with the right defaults and groups", () => {
    const byId = Object.fromEntries(ALL.map((p) => [p.id, p]));
    expect(byId["po-pricing-rules"].category).toBe("Pricing");
    expect(byId["po-pricing-rules"].name).toBe("Manage Pricing Rules");
    expect(byId["po-apply-pricing"].category).toBe("Pricing");
    expect(byId["po-apply-pricing"].name).toBe("Apply Pricing Rules");
    expect(byId["po-discounts"].category).toBe("Pricing");
    expect(byId["ur-deactivate-user"].name).toBe("Deactivate User");
    expect(byId["ur-deactivate-user"].category).toBe("User lifecycle");
    expect(byId["ur-bulk-deactivate-users"].category).toBe("User lifecycle");
    expect(byId["ur-archive-user"].name).toBe("Archive User");
    expect(byId["ur-archive-user"].category).toBe("Destructive action");
    expect(byId["ur-bulk-roles-destructive"].category).toBe("Role management");
    expect(byId["ur-assign-roles"].name).toBe("Assign Roles");
    for (const id of ["po-pricing-rules", "ur-deactivate-user", "ur-bulk-deactivate-users", "ur-bulk-roles-destructive"]) {
      expect(byId[id].defaultEnabled, id).toBe(false);
    }
    // ERP-5543 as compiled in Oct 26: both PO pricing-application permissions are On.
    for (const id of ["po-apply-pricing", "po-discounts"]) {
      expect(byId[id].defaultEnabled, id).toBe(true);
    }
  });

  /* The per-permission licence table, taken from the License column of each
   * module's own story as gathered in the compiled catalogue: 18 on Field User
   * and the rest on Full Access. Pinned by id, because the value has to be the
   * same everywhere and stable over time: it is a product decision, not
   * something read off a permission's wording.
   *
   * This supersedes the flat ERP-6378 table, which listed 120 permissions with
   * 13 on Field User. ERP-6378 predates the Sales Orders licence column and so
   * missed the six Sales Orders permissions ERP-5548 puts on a field seat. The
   * compilation's rule is that the module story wins. */
  it("the licence table matches the compiled catalogue: 18 Field User, the rest Full Access", () => {
    const fieldUser = ALL.filter((p) => !permissionRequiresFullAccess(p)).map((p) => p.id).sort();
    expect(fieldUser).toEqual([
      "cc-access", "cc-execute",
      "mv-access", "mv-execute",
      "pi-access", "pi-quarantine",
      "rcv-access", "rcv-labels", "rcv-receive",
      "ship-access", "ship-dispatch", "ship-pick",
      "so-access", "so-view-pricing", "so-create",
      "so-attachments", "so-manage-reps", "so-export",
    ].sort());
    expect(fieldUser.length).toBe(18); // ship-view-value is backlogged
    /* 128 in the catalogue less the 19 field seats. The Sales Orders six are the
     * read-and-work-the-order half of that module; its commercial and
     * operational half (the pricing pair, one-time discounts, Operations Access,
     * the allocation pair, cancel or archive, bulk export) stays Full Access. */
    expect(ALL.length - fieldUser.length).toBe(113); // ERP-5506 AC30: three Full Access Receiving rows parked; ERP-11305: +2 Full Access
    // Every permission carries a value, and only these two exist.
    for (const p of ALL) {
      expect(["Full Access", "Field User"]).toContain(
        permissionRequiresFullAccess(p) ? "Full Access" : "Field User",
      );
    }
  });

  /* The three post-Pioneer Receiving permissions are Full Access like anything
   * else. Since ERP-5506 AC30 they are parked in BACKLOGGED_PERMISSIONS, so
   * they are off the grid entirely and a Field User role stays Field User. */
  it("the post-Pioneer Receiving permissions are Full Access and do not move a tier", () => {
    const byId = Object.fromEntries(BACKLOGGED_PERMISSIONS.map((b) => [b.permission.id, b.permission]));
    for (const id of ["rcv-discrepancy", "rcv-edit-confirmed", "rcv-void"]) {
      expect(permissionRequiresFullAccess(byId[id]), id).toBe(true);
    }
    // A Field-User-only set stays Field User; the three are off, as they always are.
    expect(computeRoleTier({ "rcv-access": true, "rcv-receive": true, "rcv-labels": true })).toBe(
      "Field User",
    );
  });

  /* AC 8 to 11: one Full Access permission is enough, nothing is enough for
   * Field User, and the value follows the toggles both ways. */
  it("a role's tier is derived from its toggles alone", () => {
    expect(computeRoleTier({})).toBe("Field User");
    expect(computeRoleTier({ "ship-pick": true, "ship-dispatch": true })).toBe("Field User");
    expect(computeRoleTier({ "ship-pick": true, "ship-create": true })).toBe("Full Access");
    // turning the one Full Access permission back off returns it to Field User
    expect(computeRoleTier({ "ship-pick": true, "ship-create": false })).toBe("Field User");
  });

  /* Partners, ERP-5549: all thirteen rows, all Full Access and web only, with the
   * five the story names on by default. Payment terms and pricing rules are each
   * split into a Manage half (global authorship, cross-module with Partner Group)
   * and an Apply half (attaching to a partner). */
  it("Partners matches the ERP-5549 table", () => {
    const prt = PERMISSION_MODULES.find((m) => m.id === "partners")!.permissions;
    expect(prt.map((p) => p.id)).toEqual([
      "prt-access", "prt-create-edit", "prt-config-vendor", "prt-config-customer",
      "prt-manage-payment-terms", "prt-payment-terms",
      "prt-manage-pricing-rules", "prt-manage-pricing",
      "prt-credit-limit", "prt-payment-method",
      "prt-vendor-qualification", "prt-customer-qualification", "prt-deactivate",
    ]);
    expect(prt.map((p) => p.name)).toEqual([
      "Access Partners Module", "Create and Edit Partner",
      "Configure Vendor Settings", "Configure Customer Settings",
      "Manage Payment Terms", "Apply Payment Terms",
      "Manage Pricing Rules", "Apply Pricing Rules",
      "Configure Credit Limits", "Configure Payment Method",
      "Manage Vendor Qualification", "Manage Customer Qualification",
      "Archive Partner",
    ]);
    for (const p of prt) {
      expect(permissionRequiresFullAccess(p), p.id).toBe(true);
      expect(p.platform ?? "web", p.id).toBe("web");
    }
    expect(prt.filter((p) => p.defaultEnabled).map((p) => p.id)).toEqual([
      "prt-access", "prt-create-edit", "prt-config-vendor", "prt-config-customer",
      "prt-payment-method",
    ]);
    const byId = Object.fromEntries(prt.map((p) => [p.id, p]));
    expect(byId["prt-credit-limit"].name).toBe("Configure Credit Limits");
    /* New in this story and off by default. Predefined Roles v2.5 to v2.11 hand
     * each one to the roles named below, on top of the all-access three. */
    const ALL_ACCESS = ["account_owner", "super_administrator", "system_configuration_manager"];
    const expectedHolders: Record<string, string[]> = {
      "prt-vendor-qualification": ["buyer", "procurement_manager", "vendor_manager"],
      "prt-customer-qualification": [
        "sales_representative", "sales_manager_(pricing_and_discounts)",
      ],
      "prt-manage-payment-terms": ["finance_controller_(credit_and_terms)"],
      "prt-manage-pricing-rules": [
        "procurement_manager", "sales_manager_(pricing_and_discounts)",
      ],
    };
    for (const [id, scoped] of Object.entries(expectedHolders)) {
      expect(byId[id].defaultEnabled, id).toBe(false);
      const holders = Object.entries(ROLE_PERMISSION_MAP)
        .filter(([, v]) => v.includes(id)).map(([k]) => k).sort();
      expect(holders, id).toEqual([...ALL_ACCESS, ...scoped].sort());
    }
  });

  /* Partner Group, ERP-6242: all ten rows, all Full Access and web only, with
   * the three the story names on by default. Mirrors what ERP-5549 did to
   * Partners: payment terms and pricing rules each split into a Manage half
   * (global authorship, cross-module with Partners) and an Apply half (attaching
   * to this group). Configure Payment Method is deliberately absent, it lives on
   * Partners only. */
  it("Partner Group matches the ERP-6242 table", () => {
    const pg = PERMISSION_MODULES.find((m) => m.id === "partner-group")!.permissions;
    expect(pg.map((p) => p.id)).toEqual([
      "pg-access", "pg-create-edit", "pg-config-vendor", "pg-config-customer",
      "pg-manage-payment-terms", "pg-payment-terms",
      "pg-manage-pricing-rules", "pg-manage-pricing",
      "pg-credit-limit", "pg-archive",
    ]);
    expect(pg.map((p) => p.name)).toEqual([
      "Access Partner Groups Module", "Create and Edit Partner Group",
      "Configure Vendor Settings", "Configure Customer Settings",
      "Manage Payment Terms", "Apply Payment Terms",
      "Manage Pricing Rules", "Apply Pricing Rules",
      "Configure Credit Limits", "Archive Partner Group",
    ]);
    for (const p of pg) {
      expect(permissionRequiresFullAccess(p), p.id).toBe(true);
      expect(p.platform ?? "web", p.id).toBe("web");
    }
    expect(pg.filter((p) => p.defaultEnabled).map((p) => p.id)).toEqual([
      "pg-access", "pg-config-vendor", "pg-config-customer",
    ]);
  });

  /* Configure Payment Method was dropped from Partner Group by ERP-6242. It
   * survives on Partners, so this pins the group-level id specifically. */
  it("the retired group payment method permission is gone everywhere", () => {
    expect(IDS.has("pg-payment-method")).toBe(false);
    expect(VIEW_IN_MODULE_DATA["pg-payment-method"]).toBeUndefined();
    expect(getPermissionRecommendations("pg-payment-method")).toEqual([]);
    for (const [k, ids] of Object.entries(ROLE_PERMISSION_MAP)) {
      expect(ids.includes("pg-payment-method"), `${k} still holds it`).toBe(false);
    }
    // The Partners equivalent is untouched.
    expect(IDS.has("prt-payment-method")).toBe(true);
  });

  /* Shipments, ERP-5546: nine active permissions (View declared value on
   * shipment documents is deferred and not seeded), three on a Field seat, every
   * one exercisable on web and mobile, and only the module gate on by default.
   * The story's "on by default for Material Handler" note on Execute picking
   * tasks and Confirm departure is a ROLE default, not a catalogue one, so both
   * stay off here. */
  it("Shipments matches ERP-5546", () => {
    const ship = PERMISSION_MODULES.find((m) => m.id === "shipments")!.permissions;
    expect(ship.map((p) => p.id)).toEqual([
      "ship-access", "ship-create",
      "ship-allocate", "ship-release-allocation", "ship-overship",
      "ship-pick", "ship-approve-short", "ship-dispatch", "ship-cancel",
    ]);
    expect(ship.filter((p) => !permissionRequiresFullAccess(p)).map((p) => p.id)).toEqual([
      "ship-access", "ship-pick", "ship-dispatch",
    ]);
    for (const p of ship) expect(p.platform, p.id).toBe("both");
    expect(ship.filter((p) => p.defaultEnabled).map((p) => p.id)).toEqual(["ship-access"]);
    // The allocation pair: Full Access, web and mobile, off, held by no scoped role.
    for (const id of ["ship-allocate", "ship-release-allocation"]) {
      expect(getRolesWithPermission(id).map((r) => r.roleName).sort()).toEqual([
        "Account Owner", "Super Administrator", "System Configuration Manager",
      ].sort());
    }
  });

  /* Sales Orders, ERP-5548: fourteen active permissions in this order, with six
   * on by default. Modify pricing rules is split into Manage Pricing Rules
   * (global rule authorship, shared across five modules) and Apply Pricing Rules
   * (per-order application, independent per module), matching Purchase Orders,
   * Partners, and Partner Group. Release Allocation is now active in the
   * compiled catalogue rather than proposed, which is what takes this module to
   * fourteen; it stays off by default and held by the all-permission roles only.
   * Six of the fourteen sit on a Field User seat per the story's License
   * column. */
  it("Sales Orders matches ERP-5548", () => {
    const so = PERMISSION_MODULES.find((m) => m.id === "sales-orders")!.permissions;
    expect(so.map((p) => p.id)).toEqual([
      "so-access", "so-view-pricing", "so-create",
      "so-manage-pricing-rules", "so-apply-pricing-rules",
      "so-discount", "so-operations-access", "so-allocate", "so-release-allocation",
      "so-archive", "so-attachments", "so-manage-reps", "so-export", "so-bulk-export",
    ]);
    expect(so.filter((p) => p.defaultEnabled).map((p) => p.id)).toEqual([
      "so-access", "so-view-pricing", "so-create",
      "so-attachments", "so-manage-reps", "so-export",
    ]);
    /* The compiled catalogue marks the pricing pair, Manage sales representatives,
     * Print and export, and Bulk export as web only; the rest carry both. */
    const webOnly = new Set([
      "so-manage-pricing-rules", "so-apply-pricing-rules",
      "so-manage-reps", "so-export", "so-bulk-export",
    ]);
    for (const p of so) {
      expect(p.platform ?? "web", p.id).toBe(webOnly.has(p.id) ? "web" : "both");
    }
    /* The story's License column: the read-and-work-the-order half on a field
     * seat, the commercial and operational half on Full Access. */
    const fieldSeat = new Set([
      "so-access", "so-view-pricing", "so-create",
      "so-attachments", "so-manage-reps", "so-export",
    ]);
    for (const p of so) {
      expect(permissionRequiresFullAccess(p), p.id).toBe(!fieldSeat.has(p.id));
    }
    /* Release Allocation: active in the catalogue, off by default, and held by
     * the all-permission roles only. Its scoped-role seeding is a Predefined
     * Roles decision, not a catalogue one. */
    const byId = Object.fromEntries(so.map((p) => [p.id, p]));
    expect(byId["so-release-allocation"].name).toBe("Release Allocation");
    expect(byId["so-release-allocation"].defaultEnabled).toBe(false);
    expect(getRolesWithPermission("so-release-allocation").map((r) => r.roleName).sort()).toEqual([
      "Account Owner", "Super Administrator", "System Configuration Manager",
    ].sort());
    // Shipments carries its own allocation pair (ERP-5546); Sales Orders' Release
    // Allocation is a separate switch that moves with it.
    expect(IDS.has("ship-allocate")).toBe(true);
    expect(IDS.has("ship-release-allocation")).toBe(true);
  });

  /* Release Allocation is wired on both surfaces the compiled catalogue gives it,
   * Shipments and Sales Orders. It spent a while marked proposed on the Sales
   * Orders side, which is how it ended up in the catalogue with no simulator
   * entry, so this pins every surface it has to appear on: the catalogue row, the
   * seat, the linked pair that keeps the two ends of the shared allocation engine
   * in step, and the View-in-Module preview. */
  it("Release Allocation is present and fully wired on both surfaces", () => {
    const byId = Object.fromEntries(ALL.map((p) => [p.id, p]));
    for (const id of ["ship-release-allocation", "so-release-allocation"]) {
      const p = byId[id];
      expect(p, `${id} missing from the catalogue`).toBeDefined();
      expect(p.name).toBe("Release Allocation");
      expect(p.category).toBe("Inventory allocation");
      expect(p.defaultEnabled, `${id} is off by default`).toBe(false);
      expect(p.platform, `${id} is web and mobile`).toBe("both");
      // More severe than Allocate, and Allocate is Full Access, so this is too.
      expect(permissionRequiresFullAccess(p), id).toBe(true);
      // The simulator has to render it rather than fall back to catalogue copy.
      expect(VIEW_IN_MODULE_DATA[id], `${id} has no View-in-Module entry`).toBeDefined();
      expect(VIEW_IN_MODULE_DATA[id].permissionName).toBe("Release Allocation");
    }
    /* The two ends move together: releasing reverses the same shared engine that
     * Allocate Inventory commits to, so the pair is linked, and the release group
     * is distinct from the allocate group. */
    const group = getLinkedGroup("so-release-allocation");
    expect(group?.id).toBe("release-allocation");
    expect([...(group?.permissionIds ?? [])].sort()).toEqual([
      "ship-release-allocation", "so-release-allocation",
    ]);
    expect(getLinkedGroup("ship-release-allocation")?.id).toBe("release-allocation");
    expect(getLinkedGroup("so-allocate")?.id).toBe("allocate-inventory");
  });

  /* Purchase Orders, ERP-5543 (18 Aug recut): eight active permissions in this
   * order, all Full Access and web, with the module gate, Purchase from
   * non-qualified vendors, Apply Pricing Rules, and Add one-time discounts and
   * premiums on by default and the other four off. Modify pricing
   * rules was split into Manage Pricing Rules (global rule authorship, shared
   * cross-module) and Apply Pricing Rules (per-PO application, independent per
   * module), mirroring Partners and Partner Group. Approve purchase orders is
   * deferred: it is not seeded and no approval path exists, so it must not
   * appear in the catalogue or in the View-in-Module simulator. */
  it("Purchase Orders seeds the eight active ERP-5543 permissions", () => {
    const po = PERMISSION_MODULES.find((m) => m.id === "purchase-orders")!.permissions;
    expect(po.map((p) => p.id)).toEqual([
      "po-access",
      "po-create",
      "po-nonqualified",
      "po-cancel",
      "po-bulk-import",
      "po-pricing-rules",
      "po-apply-pricing",
      "po-discounts",
    ]);
    for (const p of po) {
      expect(permissionRequiresFullAccess(p), p.id).toBe(true);
      expect(p.platform ?? "web", p.id).toBe("web");
    }
    expect(po.filter((p) => p.defaultEnabled).map((p) => p.id)).toEqual([
      "po-access",
      "po-nonqualified",
      "po-apply-pricing",
      "po-discounts",
    ]);
  });

  it("Approve purchase orders is nowhere in the build", () => {
    for (const dead of ["po-approve", "po-reopen"]) {
      expect(IDS.has(dead), `catalog has ${dead}`).toBe(false);
      expect(VIEW_IN_MODULE_DATA[dead], `simulator has ${dead}`).toBeUndefined();
      for (const [k, ids] of Object.entries(ROLE_PERMISSION_MAP)) {
        expect(ids.includes(dead), `${k} holds ${dead}`).toBe(false);
      }
    }
  });

  /* AC 2: four PO permissions carry an AND dependency on Create and edit
   * purchase orders, over and above the implicit module gate. The build surfaces
   * them as recommendations; nothing enforces the grant, which is the open
   * question the story flags. */
  it("the four PO permissions recommend Create and edit purchase orders", () => {
    for (const id of ["po-nonqualified", "po-bulk-import", "po-apply-pricing", "po-discounts"]) {
      const recommended = getPermissionRecommendations(id).flatMap((g) => g.options.map((o) => o.permissionId));
      expect(recommended, id).toContain("po-create");
      expect(recommended, id).toContain("po-access");
    }
  });

  /* Item Library, ERP-5537: nine permissions, in this order. Configuration
   * lives inside Create and edit items and the selling price inside Edit item
   * pricing, which is why there is no Manage item configuration and no
   * cost-edit permission. */
  it("Item Library seeds the nine ERP-5537 permissions", () => {
    expect(PERMISSION_MODULES.find((m) => m.id === "item-library")!.permissions.map((p) => p.id)).toEqual([
      "item-access",
      "item-view-cost",
      "item-create-edit",
      "item-edit-minmax",
      "item-manage-vendors",
      "item-archive",
      "item-bulk-import",
      "item-manage-pricing",
      "item-valuation-method",
    ]);
    const byId = Object.fromEntries(ALL.map((p) => [p.id, p]));
    expect(byId["item-manage-pricing"].name).toBe("Edit Item Pricing");
    /* Every Item Library permission: Full Access, web, off by default. The
     * View-in-Module label is deliberately NOT compared: that string is a label
     * inside a mock of the Item Library UI, not the canonical permission name,
     * and 26 entries across the build word it differently on purpose. */
    for (const p of PERMISSION_MODULES.find((m) => m.id === "item-library")!.permissions) {
      expect(permissionRequiresFullAccess(p), p.id).toBe(true);
      expect(p.platform ?? "web", p.id).toBe("web");
      expect(p.defaultEnabled, p.id).toBe(false);
      expect(VIEW_IN_MODULE_DATA[p.id], `no simulator entry for ${p.id}`).toBeDefined();
    }
  });

  /* The two retired by ERP-5537 must not come back through any door. */
  it("the retired Item Library permissions are gone everywhere", () => {
    for (const dead of ["item-edit-cost", "item-manage-config"]) {
      expect(IDS.has(dead), `catalog still has ${dead}`).toBe(false);
      expect(VIEW_IN_MODULE_DATA[dead], `view-in-module still has ${dead}`).toBeUndefined();
      for (const [k, ids] of Object.entries(ROLE_PERMISSION_MAP)) {
        expect(ids.includes(dead), `${k} still holds ${dead}`).toBe(false);
      }
    }
  });

  /* Every permission in the module needs a Full Access seat. Platform is no
   * longer uniform: the ERP-5550 dev note marks nine as exercisable in the
   * People Management mobile app, and the rest stay web only. */
  it("Users and Roles is uniformly Full Access, and nine permissions are mobile-capable", () => {
    const ur = PERMISSION_MODULES.find((m) => m.id === "users-roles")!.permissions;
    for (const p of ur) expect(permissionRequiresFullAccess(p), p.id).toBe(true);
    expect(ur.filter((p) => p.platform === "both").map((p) => p.id)).toEqual([
      "ur-access", "ur-create-user", "ur-reset-password", "ur-deactivate-user",
      "ur-bulk-deactivate-users", "ur-archive-user", "ur-bulk-archive",
      "ur-manage-licenses", "ur-assign-roles",
    ]);
    for (const p of ur) {
      if (p.platform !== "both") expect(p.platform ?? "web", p.id).toBe("web");
    }
  });

  it("Users and Roles renders in the spec order", () => {
    expect(PERMISSION_MODULES.find((m) => m.id === "users-roles")!.permissions.map((p) => p.id)).toEqual([
      "ur-access", "ur-view-billing", "ur-create-user", "ur-reset-password",
      "ur-deactivate-user", "ur-bulk-deactivate-users", "ur-archive-user", "ur-bulk-archive",
      "ur-manage-licenses", "ur-bulk-license", "ur-bulk-import-users", "ur-export-users",
      "ur-assign-roles", "ur-manage-permissions", "ur-create-role",
      "ur-deactivate-role", "ur-archive-role", "ur-bulk-roles-destructive",
      "ur-manage-roles", "ur-view-audit",
    ]);
  });

  /* Role lifecycle: the single-role pair is its own authority now, so Create
   * and edit roles no longer implies it, and only the governance roles hold
   * both halves. */
  it("role lifecycle permissions exist and are confined", () => {
    const byId = Object.fromEntries(ALL.map((p) => [p.id, p]));
    expect(byId["ur-deactivate-role"].name).toBe("Deactivate or Reactivate Role");
    expect(byId["ur-deactivate-role"].category).toBe("Role management");
    expect(byId["ur-archive-role"].name).toBe("Archive or Unarchive Role");
    expect(byId["ur-archive-role"].category).toBe("Destructive action");
    for (const id of ["ur-deactivate-role", "ur-archive-role"]) {
      expect(byId[id].defaultEnabled, id).toBe(false);
      expect(byId[id].platform ?? "web", id).toBe("web");
      const holders = Object.entries(ROLE_PERMISSION_MAP)
        .filter(([, v]) => v.includes(id)).map(([k]) => k).sort();
      expect(holders, id).toEqual([
        "access_and_security_manager", "account_owner",
        "super_administrator", "system_configuration_manager",
      ].sort());
    }
  });

  it("every role bundle resolves against the catalog", () => {
    for (const [key, ids] of Object.entries(ROLE_PERMISSION_MAP)) {
      for (const id of ids) expect(IDS.has(id), `${key}: unknown ${id}`).toBe(true);
    }
  });

  it("role-specific reconciliation", () => {
    const ur = (key: string) => ROLE_PERMISSION_MAP[key].filter((id) => id.startsWith("ur-")).sort();
    expect(ur("access_and_security_manager")).toEqual([
      "ur-access", "ur-assign-roles", "ur-bulk-roles-destructive", "ur-create-role",
      "ur-deactivate-role", "ur-archive-role",
      "ur-manage-permissions", "ur-manage-roles", "ur-view-audit",
    ].sort());
    expect(ur("it_helpdesk")).toEqual([
      "ur-access", "ur-create-user", "ur-export-users", "ur-reset-password", "ur-view-audit",
    ].sort());
    expect(ur("hr_administrator")).toEqual([
      "ur-access", "ur-archive-user", "ur-bulk-archive", "ur-bulk-deactivate-users",
      "ur-bulk-import-users", "ur-create-user", "ur-deactivate-user", "ur-export-users",
      "ur-reset-password",
    ].sort());
    expect(ROLE_PERMISSION_MAP.account_owner.length).toBe(131); // ERP-5506 AC30; ERP-11305 +2
    expect(ROLE_PERMISSION_MAP.super_administrator.length).toBe(131);
    expect(ROLE_PERMISSION_MAP.system_configuration_manager.length).toBe(130);
    expect(ROLE_PERMISSION_MAP.system_configuration_manager).not.toContain("mfa-delete");
    /* v2.11, Eli's ERP-5543 rulings: every predefined role with Create and Edit
     * Purchase Orders holds Purchase from Non-Qualified Vendors, Apply Pricing
     * Rules, and Add One-Time Discounts and Premiums. The PO surface of Manage
     * Pricing Rules is listed for no scoped role. */
    for (const r of ["procurement_manager", "buyer"]) {
      for (const id of ["po-create", "po-nonqualified", "po-apply-pricing", "po-discounts"]) {
        expect(ROLE_PERMISSION_MAP[r], `${r} / ${id}`).toContain(id);
      }
    }
    for (const r of PREDEFINED_ROLES.filter((x) => !x.allAccess)) {
      expect(ROLE_PERMISSION_MAP[r.optionId], r.name).not.toContain("po-pricing-rules");
    }
    // The rulings cover predefined roles only; the custom fixtures are untouched.
    for (const r of ["vendor_manager", "senior_buyer"]) {
      expect(ROLE_PERMISSION_MAP[r]).not.toContain("po-pricing-rules");
      expect(ROLE_PERMISSION_MAP[r]).not.toContain("po-discounts");
    }
    expect(ROLE_PERMISSION_MAP.procurement_manager.filter((id) => id.startsWith("po-")).length).toBe(7);
    expect(ROLE_PERMISSION_MAP.buyer.filter((id) => id.startsWith("po-")).length).toBe(5);
    // bulk grants are confined
    const holders = (id: string) => Object.entries(ROLE_PERMISSION_MAP).filter(([, v]) => v.includes(id)).map(([k]) => k).sort();
    expect(holders("ur-bulk-deactivate-users")).toEqual(
      ["account_owner", "hr_administrator", "super_administrator", "system_configuration_manager"].sort());
    expect(holders("ur-bulk-roles-destructive")).toEqual(
      ["access_and_security_manager", "account_owner", "super_administrator", "system_configuration_manager"].sort());
  });

  /* Predefined Roles v2.2 sync. Quarantine and check out inventory goes to the
   * three roles that do floor-level stock work and stays off the three whose
   * Physical Inventory access is view, read, or allocation only. */
  it("quarantine is confined to the v2.2 holders", () => {
    const holders = Object.entries(ROLE_PERMISSION_MAP)
      .filter(([, ids]) => ids.includes("pi-quarantine"))
      .map(([k]) => k);
    for (const yes of [
      "warehouse_supervisor",
      "inventory_controller_(adjust_and_value)",
      "field_operative",
      "account_owner",
      "super_administrator",
      "system_configuration_manager",
    ]) {
      expect(holders, yes).toContain(yes);
    }
    for (const no of [
      "finance_controller_(credit_and_terms)",
      "it_helpdesk",
      "operations_clearance_specialist",
    ]) {
      expect(holders, no).not.toContain(no);
    }
  });

  /* Section 2 of the sync: a role can never hold a granular permission in a
   * module without that module's Access gate. Checked across every bundle,
   * predefined and fixture alike. */
  it("every bundle carries the access gate for each module it touches", () => {
    const offenders: string[] = [];
    for (const [key, ids] of Object.entries(ROLE_PERMISSION_MAP)) {
      const granted = new Set(ids);
      for (const mod of PERMISSION_MODULES) {
        if (!mod.permissions.some((p) => granted.has(p.id))) continue;
        const gate = mod.permissions.find((p) => p.category === "Module access")!;
        if (!granted.has(gate.id)) offenders.push(`${key}: ${mod.id}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  /* The one documented exception to "every permission is exercisable": Finance
   * Controller's two group-level permissions have no Partner Group gate. Kept
   * per spec and pinned here so it cannot be silently "fixed" or forgotten. */
  it("Finance Controller keeps its documented, ungated group permissions", () => {
    const fc = ROLE_PERMISSION_MAP["finance_controller_(credit_and_terms)"];
    expect(fc).toContain("pg-access");
    expect(fc).toContain("pg-credit-limit");
    expect(fc).toContain("pg-payment-terms");
    expect(fc).not.toContain("pg-config-vendor");
    expect(fc).not.toContain("pg-config-customer");
    expect(fc).not.toContain("pg-create-edit");
  });

  it("no role carries the deferred permission-request alert", () => {
    for (const r of PREDEFINED_ROLES) {
      expect(r.alerts.map((a) => a.name)).not.toContain("New Permission Request Submitted");
    }
    // the invitation-lifecycle alert survives
    expect(PREDEFINED_ROLES.find((r) => r.name === "IT Helpdesk")!.alerts.map((a) => a.name))
      .toContain("User Requested New Invitation Link");
  });

  it("recommendations: PO pricing pair added, Manage Roles chip and bulk pairs absent", () => {
    const names = (id: string) => getPermissionRecommendations(id).flatMap((g) => g.options.map((o) => o.permissionId));
    // Manage Pricing Rules keeps only the module gate: rule authorship is
    // global, so the po-create dependency moved to Apply Pricing Rules.
    expect(names("po-pricing-rules")).toEqual(["po-access"]);
    expect(names("po-apply-pricing")).toEqual(["po-access", "po-create"]);
    expect(names("po-discounts")).toEqual(["po-access", "po-create"]);
    expect(names("ur-manage-roles")).toEqual(["ur-access"]);
    expect(names("ur-bulk-archive")).toEqual(["ur-access"]);
    expect(names("ur-bulk-deactivate-users")).toEqual(["ur-access"]);
    expect(names("ur-bulk-license")).toEqual(["ur-access"]);
    expect(names("ur-bulk-roles-destructive")).toEqual(["ur-access"]);
    // ERP-5550 AC5, 8 Nov: import and export stand alone, with no Create and
    // Edit Users or Create and Edit Roles chip, and the export has no billing
    // columns.
    expect(names("ur-bulk-import-users")).toEqual(["ur-access"]);
    expect(names("ur-export-users")).toEqual(["ur-access"]);
  });

  /* Every predefined role's derived tier now agrees with its documented one.
   * Predefined Roles v2.4 closed the last three gaps: Receiving Clerk and
   * Warehouse Supervisor lost Log and resolve discrepancies, Field Operative
   * lost Adjust inventory, and Basic User was restated as Full Access because
   * every gate it holds is administrative (five since v2.12 added Module
   * Defaults). Nothing derives against its label any more, so this expects an
   * empty list rather than a known-bad set. */
  it("every predefined role's derived licence tier matches its documented tier", () => {
    const bad: string[] = [];
    for (const r of PREDEFINED_ROLES) {
      const toggles: Record<string, boolean> = {};
      ROLE_PERMISSION_MAP[r.optionId].forEach((id) => { toggles[id] = true; });
      if (computeRoleTier(toggles) !== r.licenseTier) bad.push(r.name);
    }
    expect(bad).toEqual([]);
  });

  /* v2.4's set shape: 25 roles, 20 Full Access and 5 Field User, and the five
   * field roles are named. Basic User sits outside them on a full seat. */
  it("the predefined set is 20 Full Access and 5 Field User", () => {
    expect(PREDEFINED_ROLES).toHaveLength(25);
    const field = PREDEFINED_ROLES.filter((r) => r.licenseTier === "Field User").map((r) => r.name);
    expect(field).toEqual([
      "Material Handler",
      "Cycle Counter",
      "Dispatch Clerk",
      "Receiving Clerk",
      "Field Operative",
    ]);
    expect(PREDEFINED_ROLES.filter((r) => r.licenseTier === "Full Access")).toHaveLength(20);
    expect(PREDEFINED_ROLES.find((r) => r.name === "Basic User")!.licenseTier).toBe("Full Access");
  });

  /* v2.4, change 14: after this no Pioneer role depends on a permission that
   * does not ship. That is what lets a Field User role stay Field User with the
   * three on the grid. */
  it("no scoped role holds a post-Pioneer Receiving permission", () => {
    const POST_PIONEER = ["rcv-discrepancy", "rcv-edit-confirmed", "rcv-void"];
    /* The all-access three hold every permission in the catalogue by
     * definition. Since ERP-5506 AC30 the three post-Pioneer ones are parked
     * out of the catalogue, so they no longer hold them. Change 14 is about the
     * roles that pick permissions: Warehouse Supervisor, Receiving Clerk, and
     * Receiving Supervisor each carried one or more and now carry none. */
    for (const r of PREDEFINED_ROLES.filter((x) => !x.allAccess)) {
      for (const dead of POST_PIONEER) {
        expect(ROLE_PERMISSION_MAP[r.optionId].includes(dead), `${r.name} holds ${dead}`).toBe(false);
      }
    }
    for (const key of ["warehouse_supervisor", "receiving_clerk", "receiving_supervisor"]) {
      for (const dead of POST_PIONEER) {
        expect(ROLE_PERMISSION_MAP[key].includes(dead), `${key} holds ${dead}`).toBe(false);
      }
    }
    // no custom fixture role reintroduces them either
    for (const key of ["compliance_auditor", "sales_operations_analyst", "senior_buyer", "warehouse_operator"]) {
      for (const dead of POST_PIONEER) {
        expect(ROLE_PERMISSION_MAP[key].includes(dead), `${key} holds ${dead}`).toBe(false);
      }
    }
  });

  /* v2.4, change 15: the renamed Receiving Supervisor is supervisory on its own
   * merits, movement planning plus the purchase order behind the delivery,
   * rather than through two permissions that never shipped. */
  it("Receiving Supervisor is renamed and rebuilt", () => {
    const rs = PREDEFINED_ROLES.find((r) => r.name === "Receiving Supervisor")!;
    expect(rs.optionId).toBe("receiving_supervisor");
    expect(PREDEFINED_ROLES.some((r) => /Edit and Void/.test(r.name))).toBe(false);
    expect([...ROLE_PERMISSION_MAP[rs.optionId]].sort()).toEqual([
      "rcv-access", "rcv-receive", "rcv-labels",
      "mv-access", "mv-create", "mv-execute",
      "po-access",
      "md-access",
    ].sort());
  });

  /* Predefined Roles v2.12 (14 Oct 26): each scoped role's resolved count. The
   * all-access three derive from the catalogue and are pinned above. Two
   * differ from the spec's stated count on purpose, see SPEC_COUNT_GAPS. */
  it("every scoped predefined role resolves to its v2.12 count", () => {
    const V212: Record<string, number> = {
      access_and_security_manager: 13,
      it_helpdesk: 20,
      hr_administrator: 10,
      buyer: 11,
      procurement_manager: 17,
      vendor_manager: 17,
      warehouse_supervisor: 17,
      "inventory_controller_(adjust_and_value)": 9,
      item_data_administrator: 11,
      item_pricing_administrator: 5,
      receiving_supervisor: 8,
      shipment_manager: 4,
      sales_representative: 22,
      "sales_manager_(pricing_and_discounts)": 33,
      operations_clearance_specialist: 5,
      "finance_controller_(credit_and_terms)": 25,
      material_handler: 4,
      cycle_counter: 2,
      dispatch_clerk: 5,
      receiving_clerk: 5,
      field_operative: 12,
      basic_user: 5,
    };
    /* The spec writes Cancel Quotes and Archive Quotes as two rows, and the
     * catalogue has one permission for both (qt-cancel): minus one for each
     * role holding it. The spec writes Modify Pricing Rules once on Quotes and
     * once on Sales Orders, and the catalogue splits each into Manage plus
     * Apply: plus two for Sales Manager. */
    const SPEC_COUNT_GAPS: Record<string, number> = {
      sales_representative: -1,
      "sales_manager_(pricing_and_discounts)": -1 + 2,
    };
    const scoped = PREDEFINED_ROLES.filter((r) => !r.allAccess);
    expect(scoped.map((r) => r.optionId).sort()).toEqual(Object.keys(V212).sort());
    for (const r of scoped) {
      const ids = ROLE_PERMISSION_MAP[r.optionId];
      expect(new Set(ids).size, `${r.name}: duplicate ids`).toBe(ids.length);
      expect(ids.length, r.name).toBe(V212[r.optionId] + (SPEC_COUNT_GAPS[r.optionId] ?? 0));
    }
  });

  /* ERP-8617, reviewed with Eli on 9 Oct 26 and recorded in Predefined Roles
   * v2.12: Access Module Defaults Module is on for every Full Access predefined
   * role and for no Field User role. Custom fixture roles are not predefined
   * and do not pick it up. Manage Module Defaults stays with the all-access
   * three (pinned in the Module Defaults test above). */
  it("Access Module Defaults Module is on every Full Access predefined role and nothing else", () => {
    const holders = Object.entries(ROLE_PERMISSION_MAP)
      .filter(([, ids]) => ids.includes("md-access"))
      .map(([k]) => k)
      .sort();
    const fullAccess = PREDEFINED_ROLES.filter((r) => r.licenseTier === "Full Access");
    expect(fullAccess).toHaveLength(20);
    expect(holders).toEqual(fullAccess.map((r) => r.optionId).sort());
    for (const r of PREDEFINED_ROLES.filter((x) => x.licenseTier === "Field User")) {
      expect(ROLE_PERMISSION_MAP[r.optionId], r.name).not.toContain("md-access");
      expect(ROLE_PERMISSION_MAP[r.optionId], r.name).not.toContain("md-manage");
    }
    for (const key of ["compliance_auditor", "sales_operations_analyst", "senior_buyer", "warehouse_operator"]) {
      expect(ROLE_PERMISSION_MAP[key], key).not.toContain("md-access");
    }
    /* The "Roles with This Permission" panel agrees with the bundles. */
    expect(getRolesWithPermission("md-access").map((r) => r.roleName).sort()).toEqual(
      fullAccess.map((r) => r.name).sort(),
    );
  });

  /* Linked groups are held exactly as the spec lists them per module. The two
   * vendor qualification surfaces go together wherever the spec lists both,
   * and Procurement Manager holds the Partners surface of Manage Pricing Rules
   * only. */
  it("linked permissions follow the spec's per-module rows", () => {
    for (const key of ["buyer", "procurement_manager", "vendor_manager"]) {
      expect(ROLE_PERMISSION_MAP[key], key).toContain("item-manage-vendors");
      expect(ROLE_PERMISSION_MAP[key], key).toContain("prt-vendor-qualification");
    }
    const pm = ROLE_PERMISSION_MAP.procurement_manager;
    expect(pm).toContain("prt-manage-pricing-rules");
    for (const id of ["po-pricing-rules", "qt-manage-pricing-rules", "so-manage-pricing-rules", "pg-manage-pricing-rules"]) {
      expect(pm, id).not.toContain(id);
    }
    const fc = ROLE_PERMISSION_MAP["finance_controller_(credit_and_terms)"];
    expect(fc).toContain("prt-manage-payment-terms");
    expect(fc).not.toContain("pg-manage-payment-terms");
    expect(fc).not.toContain("prt-manage-pricing-rules");
  });

  /* Field Operative keeps quarantine (floor work) and loses Adjust inventory,
   * which is what keeps it a field seat. */
  it("Field Operative is field-only after losing Adjust inventory", () => {
    const ids = ROLE_PERMISSION_MAP.field_operative;
    expect(ids).not.toContain("pi-adjust");
    expect(ids).toContain("pi-quarantine");
    for (const id of ids) {
      const p = ALL.find((x) => x.id === id)!;
      expect(permissionRequiresFullAccess(p), `${id} on Field Operative`).toBe(false);
    }
  });

  it("roles listing rows still resolve to a bundle", () => {
    for (const row of roles) {
      const key = roleNameToOptionId(row.roleName);
      if (row.isSystem) expect(ROLE_PERMISSION_MAP[key], row.roleName).toBeDefined();
    }
  });
});
