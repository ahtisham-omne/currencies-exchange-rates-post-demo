/**
 * Maps each role to the set of permission IDs that role grants.
 *
 * Permission IDs here are the verified source of truth defined in
 * `permissions-data.ts` (PERMISSION_MODULES). Keys are `optionId`s
 * (= roleNameToOptionId(displayName)); the 25 predefined roles' keys match
 * `PREDEFINED_ROLES[].optionId` exactly.
 *
 * Each bundle is translated verbatim from the spec's permission NAMES to
 * catalog IDs, synced to Predefined Roles Pioneer v2.12 (14 Oct 26, rev 175)
 * against the Permission Catalogue: Compiled Tables (Pioneer). What moved
 * since the v2.4 sync:
 *   • v2.5, the Partners split (ERP-5549). Manage Payment Terms went to
 *     Finance Controller (Credit and Terms). Manage Pricing Rules went to
 *     Procurement Manager and Sales Manager (Pricing and Discounts). Manage
 *     Vendor Qualification went to Procurement Manager and Vendor Manager.
 *     Manage Customer Qualification went to Sales Representative and Sales
 *     Manager (Pricing and Discounts).
 *   • v2.8, View Declared Value on Shipment Documents deferred (ERP-5546). It
 *     came off Shipment Manager, Finance Controller (Credit and Terms), and
 *     Dispatch Clerk. The permission itself stays parked in
 *     BACKLOGGED_PERMISSIONS.
 *   • v2.11, Eli's purchase order rulings (ERP-5543). Every role with Create
 *     and Edit Purchase Orders holds Purchase from Non-Qualified Vendors, Apply
 *     Pricing Rules, Add One-Time Discounts and Premiums, and Manage Vendor
 *     Qualification. That moved Buyer and Procurement Manager.
 *   • v2.12, Module Defaults (ERP-8617). Access Module Defaults Module is on
 *     for every Full Access role. Field User roles hold neither Module Defaults
 *     permission. The all-access three pick up both from ALL_PERMISSION_IDS.
 *
 * Linked permissions (linked-permissions.ts) are held exactly as the spec
 * lists them per module. Procurement Manager holds Manage Pricing Rules on its
 * Partners row only, not the other four surfaces of that shared record, and
 * the roles the spec lists under both Item Library and Partners hold both
 * Manage Vendor Qualification ids.
 *
 * Two spec rows do not map one to one onto the catalog, and the build keeps
 * its own mapping for both. "Modify Pricing Rules" on Quotes and Sales Orders
 * is the pre-split name: the catalog splits it into Manage Pricing Rules and
 * Apply Pricing Rules, and Sales Manager (Pricing and Discounts) holds both
 * halves. "Cancel Quotes" and "Archive Quotes" are one catalog permission,
 * Cancel or Archive Quotes (qt-cancel). So Sales Representative resolves to 21
 * where the spec states 22, and Sales Manager (Pricing and Discounts) to 34
 * where the spec states 33.
 *
 * No permission is invented. Name→id examples:
 *   "Operations Access" → so-operations-access, "Allocate inventory to orders"
 *   → so-allocate, "Bulk Import POs" → po-bulk-import, "Manage locations"
 *   → wl-create-edit, "Confirm departure" → ship-dispatch, "Configure pricing
 *   rules (group)" → pg-manage-pricing.
 *
 * Permissions are standalone: none requires another to be granted first, so
 * each bundle is taken from the spec verbatim (e.g. Finance Controller has
 * Configure Payment Terms without Configure Vendor/Customer Settings).
 *
 * Used across the Create User wizard, user/role detail, and the permission
 * catalog to show which permissions are active for a given set of roles.
 */
import { BACKLOGGED_PERMISSION_IDS, PERMISSION_MODULES } from "./permissions-data";
import { PREDEFINED_ROLES } from "./predefined-roles";

/** Every permission ID, derived from the source of truth so this file can
 *  never drift from the real permission catalog. */
const ALL_PERMISSION_IDS: string[] = PERMISSION_MODULES.flatMap((m) =>
  m.permissions.map((p) => p.id)
);

export const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  /* ═══ Administration and Access ═══ */

  // ── Account Owner: every permission in every module. ──
  account_owner: [...ALL_PERMISSION_IDS],

  // ── Super Administrator: same all-access breadth, not protected. ──
  super_administrator: [...ALL_PERMISSION_IDS],

  // ── System Configuration Manager: everything except the one remaining
  //    nuclear action, Delete MFA policy. Delete roles was removed from the
  //    catalog in Users and Roles v1.3, which collapsed "the two nuclear
  //    actions" to one and left this role a single permission apart from
  //    Super Administrator. ──
  system_configuration_manager: ALL_PERMISSION_IDS.filter(
    (id) => id !== "mfa-delete"
  ),

  // ── Access and Security Manager: access governance + MFA + audit.
  //    Holds the role lifecycle permissions (single-role deactivate/reactivate
  //    and archive/unarchive, plus the bulk pair) because all three were split
  //    out of Create and edit roles, which this role already had. ──
  access_and_security_manager: [
    "ur-access", "ur-assign-roles", "ur-create-role",
    "ur-deactivate-role", "ur-archive-role",
    "ur-bulk-roles-destructive", "ur-manage-permissions", "ur-manage-roles",
    "ur-view-audit",
    "mfa-access", "mfa-manage", "mfa-delete",
    "md-access",
  ],

  // ── IT Helpdesk: broad read visibility + password reset. No escalation. ──
  it_helpdesk: [
    "ur-access", "ur-create-user", "ur-reset-password", "ur-export-users",
    "ur-view-audit",
    "item-access", "cat-access", "prt-access", "ct-access",
    "pi-access", "mv-access", "cc-access", "rcv-access", "ship-access",
    "po-access", "qt-access", "so-access", "wl-access", "mfa-access",
    "md-access",
  ],

  /* ═══ People and HR ═══ */

  // ── HR Administrator: user lifecycle. Cannot grant access. Holds both
  //    halves of the old bundled Archive user, since its purpose includes
  //    deactivating leavers. ──
  hr_administrator: [
    "ur-access", "ur-create-user", "ur-reset-password",
    "ur-deactivate-user", "ur-bulk-deactivate-users",
    "ur-archive-user", "ur-bulk-archive",
    "ur-bulk-import-users", "ur-export-users",
    "md-access",
  ],

  /* ═══ Procurement and Supply ═══ */

  // ── Buyer: raises and edits POs, including pricing rules and one-time
  //    discounts, and can buy from an unlisted vendor location for a single
  //    order (Eli's ERP-5543 rulings, v2.11). Manage Vendor Qualification is
  //    listed under both Item Library and Partners. ──
  buyer: [
    "po-access", "po-create", "po-nonqualified", "po-apply-pricing", "po-discounts",
    "item-access", "item-view-cost", "item-manage-vendors",
    "prt-access", "prt-vendor-qualification",
    "md-access",
  ],

  // ── Procurement Manager: cancel, bulk import, and pricing rule authority.
  //    Since v2.11 the PO pricing pair (Apply Pricing Rules, Add One-Time
  //    Discounts and Premiums) goes to every role with Create and Edit Purchase
  //    Orders. Manage Pricing Rules is held on its Partners row only, which is
  //    the one row the spec lists for it. ──
  procurement_manager: [
    "po-access", "po-create", "po-nonqualified", "po-cancel", "po-bulk-import",
    "po-apply-pricing", "po-discounts",
    "item-access", "item-view-cost", "item-manage-vendors",
    "prt-access", "prt-create-edit", "prt-config-vendor",
    "prt-manage-pricing-rules", "prt-manage-pricing", "prt-vendor-qualification",
    "md-access",
  ],

  // ── Vendor Manager: supplier master + terms at partner and group level.
  //    Holds the apply half of payment terms and pricing rules, not the
  //    global Manage half (ERP-5549). ──
  vendor_manager: [
    "prt-access", "prt-create-edit", "prt-config-vendor", "prt-payment-terms",
    "prt-manage-pricing", "prt-payment-method", "prt-vendor-qualification",
    "prt-deactivate",
    "pg-access", "pg-create-edit", "pg-config-vendor", "pg-manage-pricing",
    "ct-access", "ct-create-edit",
    "item-access", "item-manage-vendors",
    "md-access",
  ],

  /* ═══ Warehouse and Inventory ═══ */

  // ── Warehouse Supervisor: bins/zones, plan+approve counts and movements.
  //    Holds Quarantine and check out inventory (v2.2): flagging stock on the
  //    floor is part of running it. ──
  warehouse_supervisor: [
    "wl-access", "wl-create-edit",
    "cc-access", "cc-create-plan", "cc-execute", "cc-adjust",
    "mv-access", "mv-create", "mv-execute",
    "rcv-access", "rcv-receive",
    "pi-access", "pi-view-valuation", "pi-quarantine",
    "ship-access", "ship-pick",
    "md-access",
  ],

  // ── Inventory Controller (Adjust and Value): the inventory accountant.
  //    Quarantine added in v2.2 alongside the adjustment authority. ──
  "inventory_controller_(adjust_and_value)": [
    "pi-access", "pi-adjust", "pi-view-valuation", "pi-quarantine",
    "cc-access", "cc-adjust",
    "item-access", "item-view-cost",
    "md-access",
  ],

  // ── Item Data Administrator: catalog + taxonomy. No cost/pricing.
  //    Item configuration is part of Create and edit items since ERP-5537, so
  //    this role keeps that authority without a separate permission for it. ──
  item_data_administrator: [
    "item-access", "item-create-edit", "item-edit-minmax",
    "item-archive", "item-bulk-import",
    "cat-access", "cat-create-edit", "cat-bulk-ops",
    "uom-access", "uom-manage",
    "md-access",
  ],

  // ── Item Pricing Administrator: item pricing + valuation method. Edit item
  //    pricing carries the selling price since ERP-5537, which retired the
  //    separate cost-edit permission this role used to hold. ──
  item_pricing_administrator: [
    "item-access", "item-manage-pricing",
    "item-valuation-method", "item-view-cost",
    "md-access",
  ],

  /* ═══ Receiving ═══ */

  // ── Receiving Supervisor: runs inbound receipts, plans the put-away that
  //    follows, and reads the purchase order behind the delivery. The three
  //    post-Pioneer permissions it used to carry are gone, and the movement
  //    planning plus PO visibility are what keep it above the field clerk. ──
  receiving_supervisor: [
    "rcv-access", "rcv-receive", "rcv-labels",
    "mv-access", "mv-create", "mv-execute",
    "po-access",
    "md-access",
  ],

  /* ═══ Shipping and Outbound ═══ */

  // ── Shipment Manager: plan/build/cancel shipments. View Declared Value on
  //    Shipment Documents came off in v2.8 (ERP-5546). ──
  shipment_manager: [
    "ship-access", "ship-create", "ship-cancel",
    "md-access",
  ],

  /* ═══ Sales ═══ */

  // ── Sales Representative: quotes/orders within catalog pricing + customers.
  //    Manage Customer Qualification from ERP-5549. The spec's Cancel Quotes
  //    and Archive Quotes rows are the one catalog permission qt-cancel. ──
  sales_representative: [
    "qt-access", "qt-view-pricing", "qt-edit", "qt-send", "qt-approve-convert",
    "qt-cancel", "qt-attachments", "qt-export",
    "so-access", "so-view-pricing", "so-create", "so-attachments", "so-export",
    "prt-access", "prt-create-edit", "prt-config-customer", "prt-payment-method",
    "prt-customer-qualification",
    "ct-access", "ct-create-edit",
    "md-access",
  ],

  // ── Sales Manager (Pricing and Discounts): pricing rules, discounts, bulk.
  //    The spec's Modify Pricing Rules on Quotes and Sales Orders is the
  //    catalog's Manage plus Apply pair on each. On Partners it holds both
  //    halves too, plus Manage Customer Qualification (ERP-5549). ──
  "sales_manager_(pricing_and_discounts)": [
    "qt-access", "qt-view-pricing", "qt-edit",
    "qt-manage-pricing-rules", "qt-apply-pricing-rules", "qt-discount",
    "qt-send", "qt-approve-convert", "qt-cancel", "qt-attachments",
    "qt-manage-reps", "qt-export", "qt-bulk-export",
    "so-access", "so-view-pricing", "so-create",
    "so-manage-pricing-rules", "so-apply-pricing-rules", "so-discount",
    "so-archive", "so-attachments", "so-manage-reps", "so-export", "so-bulk-export",
    "prt-access", "prt-create-edit", "prt-config-customer",
    "prt-manage-pricing-rules", "prt-manage-pricing",
    "prt-payment-method", "prt-customer-qualification",
    "ct-access", "ct-create-edit",
    "md-access",
  ],

  /* ═══ Operations and Commercial ═══ */

  // ── Operations Clearance Specialist: clears orders + allocates stock. ──
  operations_clearance_specialist: [
    "so-access", "so-operations-access", "so-allocate",
    "pi-access",
    "md-access",
  ],

  /* ═══ Finance and Accounting ═══ */

  // ── Finance Controller (Credit and Terms): commercial terms, billing,
  //    licensing, cost visibility. Does not write sales documents. Holds
  //    Manage Payment Terms on its Partners row (ERP-5549), not Manage Pricing
  //    Rules. View Declared Value on Shipment Documents came off in v2.8.
  //
  //    KNOWN DEPENDENCY BREAK (Predefined Roles v2.2, still an open item in
  //    v2.12).
  //    pg-credit-limit and pg-payment-terms both need a Partner Group settings
  //    permission, which in turn needs Create and edit partner group. This role
  //    holds none of those gates, so those two cannot be exercised. The
  //    documented set is kept verbatim and the break is reported in the console
  //    below rather than resolved by quietly adding a gate this role is not
  //    supposed to have. ──
  "finance_controller_(credit_and_terms)": [
    "prt-access", "prt-manage-payment-terms", "prt-payment-terms",
    "prt-manage-pricing", "prt-credit-limit", "prt-payment-method",
    "pg-access", "pg-credit-limit", "pg-payment-terms",
    "item-access", "item-view-cost",
    "pi-access", "pi-view-valuation",
    "qt-access", "qt-view-pricing",
    "so-access", "so-view-pricing",
    "po-access",
    "ship-access",
    "ur-access", "ur-view-billing", "ur-manage-licenses", "ur-bulk-license",
    "ur-export-users",
    "md-access",
  ],

  /* ═══ Field and Mobile (Field User license) ═══ */

  // ── Material Handler: moves and picks, web + mobile. ──
  material_handler: [
    "mv-access", "mv-execute",
    "ship-access", "ship-pick",
  ],

  // ── Cycle Counter: counts stock on web and handheld. ──
  cycle_counter: [
    "cc-access", "cc-execute",
  ],

  // ── Dispatch Clerk: outbound boundary; picks, stages, confirms departure.
  //    View Declared Value on Shipment Documents came off in v2.8. ──
  dispatch_clerk: [
    "mv-access", "mv-execute",
    "ship-access", "ship-pick", "ship-dispatch",
  ],

  // ── Receiving Clerk: inbound boundary; receives, puts away, labels. Every
  //    permission on it is Field User, so the seat derives Field User. ──
  receiving_clerk: [
    "mv-access", "mv-execute",
    "rcv-access", "rcv-receive", "rcv-labels",
  ],

  // ── Field Operative: the universal field seat; all physical task execution
  //    and nothing administrative. Quarantine stays (floor work, Field User
  //    tier); Adjust inventory came off in v2.4, which keeps executing work
  //    apart from writing value into stock. Every permission here is Field
  //    User, so the seat derives Field User. ──
  field_operative: [
    "cc-access", "cc-execute",
    "mv-access", "mv-execute",
    "rcv-access", "rcv-receive", "rcv-labels",
    "pi-access", "pi-quarantine",
    "ship-access", "ship-pick", "ship-dispatch",
  ],

  /* ═══ Default Seat ═══ */

  // ── Basic User: safe read-only landing seat, no actions. All five
  //    permissions are module access gates on administrative modules, so the
  //    seat it consumes is Full Access. ──
  basic_user: [
    "item-access", "cat-access", "prt-access", "ct-access",
    "md-access",
  ],

  /* ═══ Custom roles (examples of admin-created roles + edge-case fixtures) ═══
   * Not predefined, so the v2.12 Module Defaults grant does not reach them. */

  // ── Compliance Auditor: read-only across inventory/receiving/sales + audit
  //    trail. A read-only auditor extended with access audit logs. ──
  compliance_auditor: [
    "item-access", "item-view-cost", "cat-access", "uom-access",
    "pi-access", "pi-view-valuation", "wl-access",
    "rcv-access", "cc-access", "mv-access",
    "po-access", "ship-access", "ship-view-value",
    "qt-access", "qt-view-pricing", "so-access", "so-view-pricing",
    "prt-access",
    "ur-access", "ur-view-audit",
  ],

  // ── Sales Operations Analyst: reads/exports quotes & sales orders with cost
  //    visibility for reporting (Archived). ──
  sales_operations_analyst: [
    "item-access", "item-view-cost", "cat-access", "prt-access",
    "qt-access", "qt-view-pricing", "qt-export",
    "so-access", "so-view-pricing", "so-export",
    "pi-access", "pi-view-valuation",
  ],

  // ── Senior Buyer: Buyer + cancel, bulk import, qualified vendors, partner
  //    setup (a step below Procurement Manager). ──
  senior_buyer: [
    "po-access", "po-create", "po-cancel", "po-bulk-import",
    "item-access", "item-view-cost", "item-manage-vendors",
    "prt-access", "prt-create-edit", "prt-config-vendor",
    "ct-access",
  ],

  // ── Warehouse Operator: Field User floor seat: cycle count, movement,
  //    receiving, and picking execution only. All permissions are Field-User
  //    tier by design, so this is the fixture that exercises the tier-raise
  //    path, adding an admin action (e.g. Adjust Inventory) promotes it to
  //    Full Access and fires the "This Role Now Requires Full Access" modal. ──
  warehouse_operator: [
    "cc-access", "cc-execute",
    "mv-access", "mv-execute",
    "rcv-access", "rcv-receive",
    "ship-access", "ship-pick", "ship-dispatch",
  ],
};

/* Safety net for permissions parked in BACKLOGGED_PERMISSIONS. No predefined
 * bundle lists one as of v2.12 (the all-access three derive from the catalog,
 * which already leaves them out), but a fixture or a future spec row can. Drop
 * them so no role grants or counts a permission the catalog doesn't show. */
for (const key of Object.keys(ROLE_PERMISSION_MAP)) {
  ROLE_PERMISSION_MAP[key] = ROLE_PERMISSION_MAP[key].filter(
    (id) => !BACKLOGGED_PERMISSION_IDS.has(id)
  );
}

/** Map of role IDs (optionId) to display names. Kept in sync with the map keys. */
const ROLE_DISPLAY_NAMES: Record<string, string> = {
  ...Object.fromEntries(PREDEFINED_ROLES.map((r) => [r.optionId, r.name])),
  compliance_auditor: "Compliance Auditor",
  sales_operations_analyst: "Sales Operations Analyst",
  senior_buyer: "Senior Buyer",
  warehouse_operator: "Warehouse Operator",
};

/**
 * Given a list of selected role IDs, return the union of all permission IDs
 * those roles grant.
 */
export function getPermissionsForRoles(roleIds: string[]): Set<string> {
  const perms = new Set<string>();
  for (const roleId of roleIds) {
    const rolePerms = ROLE_PERMISSION_MAP[roleId];
    if (rolePerms) {
      rolePerms.forEach((p) => perms.add(p));
    }
  }
  return perms;
}

/**
 * Build a toggle map (permissionId → boolean) from selected roles.
 */
export function buildTogglesFromRoles(roleIds: string[]): Record<string, boolean> {
  const active = getPermissionsForRoles(roleIds);
  const toggles: Record<string, boolean> = {};
  for (const pid of ALL_PERMISSION_IDS) {
    toggles[pid] = active.has(pid);
  }
  return toggles;
}

/**
 * Given a list of selected role IDs, return a map of permissionId → role names
 * that grant that permission. Only includes permissions that at least one role grants.
 */
export function getPermissionSources(roleIds: string[]): Record<string, string[]> {
  const sources: Record<string, string[]> = {};
  for (const roleId of roleIds) {
    const rolePerms = ROLE_PERMISSION_MAP[roleId];
    const roleName = ROLE_DISPLAY_NAMES[roleId] || roleId;
    if (rolePerms) {
      rolePerms.forEach((pid) => {
        if (!sources[pid]) sources[pid] = [];
        sources[pid].push(roleName);
      });
    }
  }
  return sources;
}

/**
 * Given a role name (display name), return its ID in the ROLE_PERMISSION_MAP.
 */
export function getRoleIdByName(roleName: string): string | undefined {
  for (const [id, name] of Object.entries(ROLE_DISPLAY_NAMES)) {
    if (name === roleName) return id;
  }
  return undefined;
}

/**
 * For each module, return the count of roles that grant ANY permission in that module.
 * Used by the UAC Main → Permissions catalog view to show "Assigned to N roles".
 *
 * `modulePermissionIds`: map of moduleId → list of permission IDs in that module.
 */
export function getModuleRoleUsageCounts(
  modulePermissionIds: Record<string, string[]>
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [moduleId, permIds] of Object.entries(modulePermissionIds)) {
    const permSet = new Set(permIds);
    let usageCount = 0;
    for (const rolePerms of Object.values(ROLE_PERMISSION_MAP)) {
      if (rolePerms.some((p) => permSet.has(p))) usageCount++;
    }
    counts[moduleId] = usageCount;
  }
  return counts;
}

/* ─── Runtime permission writes ───────────────────────────────────────
 * ROLE_PERMISSION_MAP ships static for predefined + fixture roles, but a
 * custom role created or imported at runtime gets its granted-permission
 * set written here. The listing (permission count) and role detail read
 * this map at render time, so a write followed by a notify refreshes both.
 * Callers pair setRolePermissions with the higher-level applyRolePermissions
 * orchestrator (roles-table-config) that also flips status and license. */
type PermsListener = () => void;
const permsListeners = new Set<PermsListener>();

export function subscribeRolePermissions(fn: PermsListener): () => void {
  permsListeners.add(fn);
  return () => {
    permsListeners.delete(fn);
  };
}

export function notifyRolePermissionsChange(): void {
  permsListeners.forEach((fn) => fn());
}

/** The granted-permission id set for a role, keyed by optionId
 *  (roleNameToOptionId(roleName)). Empty array when the role has none. */
export function getRolePermissions(optionId: string): string[] {
  return ROLE_PERMISSION_MAP[optionId] ?? [];
}

/** Overwrite the granted-permission id set for a role (keyed by optionId).
 *  Registers a display name if one isn't known yet so source/name lookups
 *  resolve. Does not notify, applyRolePermissions handles the refresh. */
export function setRolePermissions(
  optionId: string,
  permissionIds: string[],
  displayName?: string,
): void {
  const valid = new Set(ALL_PERMISSION_IDS);
  ROLE_PERMISSION_MAP[optionId] = [...new Set(permissionIds)].filter((id) => valid.has(id));
  if (displayName && !ROLE_DISPLAY_NAMES[optionId]) {
    ROLE_DISPLAY_NAMES[optionId] = displayName;
  }
}

/* ─── Dev consistency check ───────────────────────────────────────────
 * Every predefined role's optionId must have a permission bundle, every
 * permission id in every bundle must exist in the catalog, every bundle key
 * must have a display name, and no bundle may hold a granular permission
 * without its module's Access gate. Logs one grouped warning on drift. */
(function assertRolePermissionMapConsistent() {
  const issues: string[] = [];
  const validIds = new Set(ALL_PERMISSION_IDS);
  for (const r of PREDEFINED_ROLES) {
    if (!ROLE_PERMISSION_MAP[r.optionId]) {
      issues.push(`no ROLE_PERMISSION_MAP entry for ${r.optionId} (${r.name})`);
    }
  }
  for (const [key, ids] of Object.entries(ROLE_PERMISSION_MAP)) {
    if (!ROLE_DISPLAY_NAMES[key]) issues.push(`no display name for ${key}`);
    ids.forEach((id) => {
      if (!validIds.has(id)) issues.push(`${key}: unknown permission id ${id}`);
    });
    const granted = new Set(ids);
    for (const mod of PERMISSION_MODULES) {
      if (!mod.permissions.some((p) => granted.has(p.id))) continue;
      const gate = mod.permissions.find((p) => p.category === "Module access");
      if (gate && !granted.has(gate.id)) {
        issues.push(`${key}: holds ${mod.name} permissions without ${gate.name}`);
      }
    }
  }
  if (issues.length && typeof console !== "undefined") {
    console.warn("[role-permissions-map] consistency issues:", issues);
  }
})();

/* ─── Documented dependency breaks ────────────────────────────────────
 * Predefined Roles v2.2 grants Finance Controller (Credit and Terms) two
 * group-level commercial permissions without the Partner Group gates they
 * depend on. v2.12 still records it as an open item awaiting a product
 * decision, so the set is kept and the break is reported here, on its own, and
 * deliberately not fixed. Remove this block once product resolves it. */
(function reportKnownDependencyBreaks() {
  const financeController = ROLE_PERMISSION_MAP["finance_controller_(credit_and_terms)"] ?? [];
  const held = new Set(financeController);
  const ungated = ["pg-credit-limit", "pg-payment-terms"].filter((id) => held.has(id));
  const hasGroupSettingsGate = held.has("pg-config-vendor") || held.has("pg-config-customer");
  if (ungated.length > 0 && !hasGroupSettingsGate && typeof console !== "undefined") {
    console.warn(
      "[role-permissions-map] Finance Controller (Credit and Terms): " +
        `${ungated.join(", ")} cannot be exercised. Both require a Partner Group ` +
        "settings permission, which requires Create and edit partner group. Documented " +
        "in Predefined Roles v2.2 and awaiting product's decision, do not add the gate.",
      ungated
    );
  }
})();
