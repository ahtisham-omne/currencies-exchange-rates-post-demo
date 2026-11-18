import { PERMISSION_MODULES } from "./permissions-data";

/* ─── Recommended companion permissions ─────────────────────────────────────
 *
 * Some permissions are more useful when other permissions are on alongside
 * them. This module is the single source of those relationships, read by the
 * "Recommended permissions to turn on" card in the permission detail panel.
 *
 * These are suggestions only. Nothing here gates, cascades, or auto-enables
 * anything, and none of it is enforced at save time. The parent/child model
 * this module used to have was removed on purpose (see a080a4f0), so keep this
 * catalog advisory: it exists to explain a pairing, never to require one.
 */

/** Rule A: the access gate for each module. Every permission in a module
 *  recommends its own module's gate, except the gate itself. */
export const MODULE_ACCESS_GATES: Record<string, string> = {
  "item-library": "item-access",
  "item-categories": "cat-access",
  "unit-of-measure": "uom-access",
  "physical-inventory": "pi-access",
  "warehouse-locations": "wl-access",
  "cycle-count": "cc-access",
  "inventory-movement": "mv-access",
  receiving: "rcv-access",
  "purchase-orders": "po-access",
  shipments: "ship-access",
  quotes: "qt-access",
  "sales-orders": "so-access",
  partners: "prt-access",
  "partner-group": "pg-access",
  contacts: "ct-access",
  "users-roles": "ur-access",
  "global-mfa": "mfa-access",
  "general-settings": "gs-access",
  "module-defaults": "md-access",
};

/** A single permission id recommends that one permission. A pair recommends
 *  either one of the two, not both. */
type RecommendationSpec = string | [string, string];

/** Rule B: extra recommendations, in addition to the module gate. Permissions
 *  absent from this map get the gate suggestion only. */
const SPECIFIC_RECOMMENDATIONS: Record<string, RecommendationSpec[]> = {
  // ── Purchase Orders ──
  //    ERP-5543 AC 2: these four carry the AND dependency on Create and edit
  //    purchase orders. Manage Pricing Rules (po-pricing-rules) deliberately
  //    does not: rules go to a global library, so rule authorship is not a
  //    PO-specific action.
  "po-nonqualified": ["po-create"],
  "po-bulk-import": ["po-create"],
  "po-apply-pricing": ["po-create"],
  "po-discounts": ["po-create"],

  // ── Shipments ──
  "ship-approve-short": ["ship-create"],

  // ── Quotes ──
  // Manage Pricing Rules stands on the module access gate alone; only Apply depends on edit.
  "qt-apply-pricing-rules": ["qt-edit"],
  "qt-discount": ["qt-edit"],
  "qt-approve-convert": ["so-access"], // cross-module, Sales Orders
  "qt-bulk-export": ["qt-export"],
  "qt-export": ["qt-view-pricing"],

  // ── Sales Orders ──
  // Manage Pricing Rules stands on the module access gate alone; only Apply depends on create.
  "so-apply-pricing-rules": ["so-create"],
  "so-discount": ["so-create"],
  "so-allocate": ["pi-access"], // cross-module, Physical Inventory
  "so-bulk-export": ["so-export"],
  "so-export": ["so-view-pricing"],

  // ── Partners: all four are either-of pairs ──
  "prt-payment-terms": [["prt-config-vendor", "prt-config-customer"]],
  "prt-manage-pricing": [["prt-config-vendor", "prt-config-customer"]],
  "prt-credit-limit": [["prt-config-vendor", "prt-config-customer"]],
  "prt-payment-method": [["prt-config-vendor", "prt-config-customer"]],

  // ── Partner Group ──
  //    Only the Apply halves gate on a config surface. Manage Payment Terms and
  //    Manage Pricing Rules author the global record, so they need neither, the
  //    same way their Partners counterparts carry no recommendation.
  "pg-config-vendor": ["pg-create-edit"],
  "pg-config-customer": ["pg-create-edit"],
  "pg-payment-terms": [["pg-config-vendor", "pg-config-customer"]],
  "pg-manage-pricing": [["pg-config-vendor", "pg-config-customer"]],
  "pg-credit-limit": [["pg-config-vendor", "pg-config-customer"]],

  // ── Users & Roles ──
  //    No bulk permission recommends its single-record counterpart. Bulk
  //    deactivate users, Bulk archive users, Bulk licence changes, and Bulk
  //    deactivate or archive roles are each granted independently, so pairing
  //    them here would imply a dependency the spec rejects.
  //    Manage Roles deliberately carries no Assign roles chip either: the
  //    dependency was removed, and the privilege ceiling binds the granter,
  //    not the holder.
  //    Bulk Import Users and Bulk Export Users and Roles stand alone:
  //    neither needs Create and Edit Users or Create and Edit Roles
  //    (ERP-5550 AC5), so neither carries a chip. The export also has
  //    no billing columns, so it carries no billing chip either.

  // ── Global MFA ──
  "mfa-delete": ["mfa-manage"],
};

/* ─── Resolution ─── */

/** A recommended permission, resolved against the catalog so the card can name
 *  it and tell whether it lives in another module. */
export interface RecommendedPermission {
  permissionId: string;
  permissionName: string;
  moduleId: string;
  moduleName: string;
}

/** Both kinds render as plain chips. The difference is when they stop showing:
 *  a `one` group drops once that permission is on, an `either` group drops as
 *  soon as either of its two options is on. */
export interface RecommendationGroup {
  kind: "one" | "either";
  options: RecommendedPermission[];
}

/** permission id → its catalog entry + owning module. */
const PERMISSION_INDEX: Map<string, RecommendedPermission> = new Map();
PERMISSION_MODULES.forEach((mod) => {
  mod.permissions.forEach((perm) => {
    PERMISSION_INDEX.set(perm.id, {
      permissionId: perm.id,
      permissionName: perm.name,
      moduleId: mod.id,
      moduleName: mod.name,
    });
  });
});

const CACHE: Map<string, RecommendationGroup[]> = new Map();

/**
 * Every recommendation for a permission: its module's access gate first, then
 * the specific pairings. Returns an empty array for the many permissions that
 * have none, which is the signal for the card not to render at all.
 *
 * This is the full catalog of recommendations, ignoring current toggle state.
 * Filtering out the ones already turned on is the card's job.
 */
export function getPermissionRecommendations(permissionId: string): RecommendationGroup[] {
  const cached = CACHE.get(permissionId);
  if (cached) return cached;

  const groups: RecommendationGroup[] = [];
  const self = PERMISSION_INDEX.get(permissionId);

  if (self) {
    const addOne = (id: string) => {
      if (id === permissionId) return;
      const item = PERMISSION_INDEX.get(id);
      if (!item) return;
      const already = groups.some(
        (g) => g.kind === "one" && g.options[0].permissionId === id
      );
      if (!already) groups.push({ kind: "one", options: [item] });
    };

    // Rule A, the module's own gate
    addOne(MODULE_ACCESS_GATES[self.moduleId] ?? "");

    // Rule B, specific pairings
    for (const spec of SPECIFIC_RECOMMENDATIONS[permissionId] ?? []) {
      if (typeof spec === "string") {
        addOne(spec);
        continue;
      }
      const options = spec
        .map((id) => PERMISSION_INDEX.get(id))
        .filter((item): item is RecommendedPermission => !!item);
      if (options.length === spec.length) groups.push({ kind: "either", options });
    }
  }

  CACHE.set(permissionId, groups);
  return groups;
}
