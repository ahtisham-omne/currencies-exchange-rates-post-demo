import { PERMISSION_MODULES } from "./permissions-data";

/* ─── Linked permissions ─────────────────────────────────────────────────────
 *
 * Some permissions surface in more than one module but edit the same entity on
 * the back end: one capability, several doors into it. Granting one door and
 * not the other is a contradiction the backend cannot honor, so the UI keeps
 * the whole group in lockstep. Toggling any member on or off toggles every
 * member with it, after the admin confirms in the linked-permissions modal.
 *
 * This module is the single source of those relationships. It is read by:
 *   - PermissionDetailModal, which intercepts toggles on linked permissions
 *     with a confirmation modal and cascades the change to the rest of the group
 *   - LinkedPermissionsCard, the info banner in the permission detail panel
 *   - PermissionsModuleGrid, which cascades module-level Enable All / Disable All
 *
 * Unlike permission-recommendations.ts (advisory pairings, nothing cascades),
 * everything in this catalog is enforced by the toggle UI.
 */

export interface LinkedPermissionGroup {
  id: string;
  /** The shared backend entity, woven into banner and confirm-modal copy
   *  ("...edit the same {entity} on the back end"). */
  entity: string;
  /** One sentence on why the group is linked, shown in the info banner. */
  reason: string;
  permissionIds: string[];
}

export const LINKED_PERMISSION_GROUPS: LinkedPermissionGroup[] = [
  {
    id: "pricing-rules",
    entity: "pricing rules",
    reason:
      "Pricing rules are global records managed in one shared submodule that is reachable from Purchase Orders, Quotes, Sales Orders, Partners, and Partner Group. All five permissions gate that same submodule.",
    permissionIds: [
      "po-pricing-rules", // Purchase Orders: Manage Pricing Rules
      "qt-manage-pricing-rules", // Quotes: Manage Pricing Rules
      "so-manage-pricing-rules", // Sales Orders: Manage Pricing Rules
      "prt-manage-pricing-rules", // Partners: Manage Pricing Rules
      "pg-manage-pricing-rules", // Partner Group: Manage Pricing Rules
    ],
  },
  {
    id: "payment-terms",
    entity: "payment terms",
    reason:
      "Payment terms are global records. The catalog already states it on both entries: the permission is present in Partners and Partner Group, and turning it on or off anywhere changes it everywhere.",
    permissionIds: [
      "prt-manage-payment-terms", // Partners: Manage Payment Terms
      "pg-manage-payment-terms", // Partner Group: Manage Payment Terms
    ],
  },
  {
    id: "vendor-qualification",
    entity: "qualified vendor list",
    reason:
      "An item's qualified vendor list is one record edited from two directions: per item in Item Library, and per vendor in Partners. Both permissions write the same item-vendor qualification.",
    permissionIds: [
      "item-manage-vendors", // Item Library: Manage Vendor Qualification
      "prt-vendor-qualification", // Partners: Manage Vendor Qualification
    ],
  },
  {
    id: "allocate-inventory",
    entity: "allocation engine",
    reason:
      "Sales Orders and Shipments share one allocation engine, and the catalog calls allocation a single global permission that is not scoped per entity type. Both toggles gate that same engine.",
    permissionIds: [
      "ship-allocate", // Shipments: Allocate Inventory
      "so-allocate", // Sales Orders: Allocate Inventory to Orders
    ],
  },
  {
    id: "release-allocation",
    entity: "allocation engine",
    reason:
      "Releasing an allocation reverses the same shared engine that creates one. The Sales Orders permission mirrors Shipments' Release Allocation, so the pair moves together.",
    permissionIds: [
      "ship-release-allocation", // Shipments: Release Allocation
      "so-release-allocation", // Sales Orders: Release Allocation
    ],
  },
];

/** A linked-group member resolved against the catalog, ready for display. */
export interface LinkedPermissionRef {
  permissionId: string;
  permissionName: string;
  moduleId: string;
  moduleName: string;
}

/* Resolve every group member once at module load. A permission id that has
 * left the catalog resolves to nothing rather than a dead chip. */
const PERMISSION_INDEX = new Map<string, LinkedPermissionRef>();
PERMISSION_MODULES.forEach((mod) => {
  mod.permissions.forEach((p) => {
    PERMISSION_INDEX.set(p.id, {
      permissionId: p.id,
      permissionName: p.name,
      moduleId: mod.id,
      moduleName: mod.name,
    });
  });
});

const GROUP_BY_PERMISSION = new Map<string, LinkedPermissionGroup>();
LINKED_PERMISSION_GROUPS.forEach((group) => {
  group.permissionIds.forEach((pid) => GROUP_BY_PERMISSION.set(pid, group));
});

/** The linked group a permission belongs to, or null for the unlinked majority. */
export function getLinkedGroup(permissionId: string): LinkedPermissionGroup | null {
  return GROUP_BY_PERMISSION.get(permissionId) ?? null;
}

/** The OTHER members of a permission's linked group, resolved for display.
 *  Empty for a permission that is not linked to anything. */
export function getLinkedPermissionRefs(permissionId: string): LinkedPermissionRef[] {
  const group = GROUP_BY_PERMISSION.get(permissionId);
  if (!group) return [];
  return group.permissionIds
    .filter((pid) => pid !== permissionId)
    .map((pid) => PERMISSION_INDEX.get(pid))
    .filter((ref): ref is LinkedPermissionRef => !!ref);
}

/** Cross-module cascade for a batch change (bulk edit, Enable All, Disable
 *  All): every linked counterpart of a changed permission that lives OUTSIDE
 *  `currentModuleId`, set to the same value. Same-module counterparts are the
 *  caller's job, they live in its own toggle map. */
export function getCrossModuleLinkedUpdates(
  changes: Record<string, boolean>,
  currentModuleId: string
): Record<string, boolean> {
  const cross: Record<string, boolean> = {};
  Object.entries(changes).forEach(([pid, val]) => {
    getLinkedPermissionRefs(pid).forEach((ref) => {
      if (ref.moduleId !== currentModuleId) cross[ref.permissionId] = val;
    });
  });
  return cross;
}

/** How many permissions a set holds, counting each linked group once.
 *  ERP-5531 AC3: a linked permission is one shared capability shown as a
 *  separate entry in each module that reaches it, so holding it under Item
 *  Library and Partners is still one permission (ERP-5500 AC23, QA 6 Nov).
 *  Use it for a "N permissions" total; the module-by-module list keeps every
 *  entry. */
export function countDistinctPermissions(permissionIds: Iterable<string>): number {
  const seen = new Set<string>();
  for (const pid of permissionIds) {
    const group = GROUP_BY_PERMISSION.get(pid);
    seen.add(group ? `group:${group.id}` : pid);
  }
  return seen.size;
}
