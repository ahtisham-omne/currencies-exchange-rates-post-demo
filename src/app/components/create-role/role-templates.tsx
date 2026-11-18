/**
 * Role templates offered when a role is being built.
 *
 * The set of 12, synced to Predefined Roles, Pioneer v2.12 (14 Oct 26, rev
 * 175): 10 Full Access and 2 Field User. Read-only entry to an administrative
 * module needs a full seat, so a template that takes no action anywhere can
 * still cost one; Support Agent, Auditor (Read-Only), and Inventory Specialist
 * carry a licence note explaining it on the card. What moved since the v2.4
 * sync: Finance Controller gained Manage Payment Terms and Procurement Officer
 * and Supply Chain Coordinator gained Manage Vendor Qualification on Partners
 * (v2.5, ERP-5549); View declared value on shipment documents came off Finance
 * Controller and Shipping Supervisor (v2.8, ERP-5546); Procurement Officer and
 * Supply Chain Coordinator gained the three purchase order permissions every
 * template with Create and edit purchase orders holds (v2.11, ERP-5543); and
 * every Full Access template gained Access Module Defaults module (v2.12,
 * ERP-8617). No template holds Manage Module Defaults, and the two Field User
 * templates hold neither. A template is NOT a role: it has no
 * entry in the Roles listing, holds no users, cannot be assigned, and the role
 * created from it keeps no link back to it.
 *
 * WHY THESE ARE DECLARED BY NAME. Each template lists the module and the
 * permission names the spec gives it, and those names are resolved against
 * PERMISSION_MODULES at module load. Nothing here invents, renames, or
 * duplicates a permission: a name that does not resolve is dropped (the
 * permission stays unchecked) and reported to the console, which is what the
 * spec asks for. Resolving by name inside a named module is also what keeps
 * "Apply payment terms" on Partners distinct from the identically named
 * permission on Partner Group.
 *
 * WHAT A TEMPLATE DOES NOT CARRY. No licence. The Full Access / Field User
 * labels below are display grouping for the picker, exactly as the spec states,
 * and the licence a created role requires is always derived from the checked
 * permission set by computeRoleTier, the same way every other surface in the
 * module derives it. Nothing here sets it.
 *
 * Consumed by Step1RoleBasicInfo (the first six, A to Z), AllTemplatesModal
 * (all 12), TemplateCard / TemplateSummaryModal (display), and the Assign
 * Permissions wizard that fixes imported Draft roles.
 */

import { BACKLOGGED_PERMISSIONS, PERMISSION_MODULES, type Permission } from "../../data/permissions-data";
import { countDistinctPermissions } from "../../data/linked-permissions";

/** Display grouping on the cards. Not a licence, see the file header. */
export type RoleTemplateGroup = "Full Access" | "Field User";

export interface RoleTemplate {
  /** Stable slug. Cards key off this, not the name. */
  id: string;
  name: string;
  description: string;
  group: RoleTemplateGroup;
  /** Catalog permission ids this template checks on the permissions step. */
  permissionIds: string[];
  /** Catalog names of those same permissions, in the same order. Search reads
   *  this so the library can match on permission name, not just template text. */
  permissionNames: string[];
  /** Why this template costs the seat it costs, for the sets where that is not
   *  obvious from the name. Surfaced on the card as secondary text. */
  licenseNote?: string;
}

/* ─── Seeds: the spec's own wording, module by module ─────────────────────── */

interface ModuleSeed {
  /** Module label as the spec writes it. Null means "resolve catalog-wide",
   *  used by the two read-only templates that list only access gates. */
  module: string | null;
  permissions: string[];
}

interface TemplateSeed {
  id: string;
  name: string;
  description: string;
  group: RoleTemplateGroup;
  /** Permission count the spec states for this template. Compared against what
   *  actually resolved, so a catalog change that silently shrinks a template is
   *  reported instead of shipping quietly. A linked permission listed under two
   *  modules counts once (ERP-5531 AC3, ERP-5500 AC23), the same rule the card
   *  and summary use through countDistinctPermissions. */
  statedCount: number;
  licenseNote?: string;
  modules: ModuleSeed[];
}

const TEMPLATE_SEEDS: TemplateSeed[] = [
  /* ═══ Full Access templates ═══ */
  {
    id: "warehouse-manager",
    name: "Warehouse Manager",
    description:
      "Runs the whole warehouse. Covers facility structure, counts, movements, receiving, inventory control, and outbound work.",
    group: "Full Access",
    statedCount: 25,
    modules: [
      {
        module: "Warehouse and Locations",
        permissions: ["Access Warehouse and Locations module", "Manage warehouses", "Manage locations"],
      },
      {
        module: "Cycle Count",
        permissions: [
          "Access Cycle Count module",
          "Create and edit cycle counts",
          "Execute cycle counts",
          "Approve counts and adjust inventory",
        ],
      },
      {
        module: "Inventory Movement",
        permissions: ["Access Inventory Movement module", "Manage movement plans", "Execute movements"],
      },
      {
        module: "Receiving",
        permissions: ["Access Receiving module", "Confirm receipt of goods", "Print receiving labels"],
      },
      {
        module: "Physical Inventory",
        permissions: [
          "Access Physical Inventory module",
          "Adjust inventory",
          "View inventory valuation data",
          "Quarantine and check out inventory",
        ],
      },
      {
        module: "Shipments",
        permissions: [
          "Access Shipments module",
          "Create and manage shipments",
          "Execute picking tasks",
          "Approve short shipments",
          "Confirm departure",
        ],
      },
      { module: "Item Library", permissions: ["Access Items module", "View cost and pricing data"] },
      { module: "Module Defaults", permissions: ["Access Module Defaults module"] },
    ],
  },
  {
    id: "finance-controller",
    name: "Finance Controller",
    description:
      "Same intent as the predefined Finance Controller (Credit and Terms). Sets commercial terms, owns billing and licensing, and sees cost everywhere. Does not write sales documents. Offered as a template so a company can adjust the bundle.",
    group: "Full Access",
    statedCount: 25,
    modules: [
      {
        module: "Partners",
        permissions: [
          "Access Partners module",
          "Manage payment terms",
          "Apply payment terms",
          "Apply pricing rules",
          "Configure credit limits",
          "Configure payment method",
        ],
      },
      {
        module: "Partner Group",
        permissions: [
          "Access Partner Groups module",
          "Configure credit limits (group)",
          "Apply payment terms (group)",
        ],
      },
      { module: "Item Library", permissions: ["Access Items module", "View cost and pricing data"] },
      { module: "Physical Inventory", permissions: ["Access Physical Inventory module", "View inventory valuation data"] },
      { module: "Quotes", permissions: ["Access Quotes module", "View pricing on quotes"] },
      { module: "Sales Orders", permissions: ["Access Sales Orders module", "View pricing on sales orders"] },
      { module: "Purchase Orders", permissions: ["Access Purchase Orders module"] },
      { module: "Shipments", permissions: ["Access Shipments module"] },
      {
        module: "Users and Roles",
        permissions: [
          "Access Users and Roles module",
          "View billing overview and cost impact",
          "Upgrade / downgrade user license",
          "Bulk license changes",
          "Bulk export users and roles",
        ],
      },
      { module: "Module Defaults", permissions: ["Access Module Defaults module"] },
    ],
  },
  {
    id: "supply-chain-coordinator",
    name: "Supply Chain Coordinator",
    description:
      "Coordinates the flow from purchasing to inbound to internal movement. Raises purchase orders. Keeps replenishment thresholds and the qualified vendor list. Plans movements and watches stock.",
    group: "Full Access",
    // 17, not 18: Manage Vendor Qualification is listed under Item Library and
    // Partners but is one linked permission (ERP-5500 AC23, QA 6 Nov).
    statedCount: 17,
    modules: [
      {
        module: "Purchase Orders",
        permissions: [
          "Access Purchase Orders module",
          "Create and edit purchase orders",
          "Purchase from non-qualified vendors",
          "Apply pricing rules",
          "Add one-time discounts and premiums",
        ],
      },
      {
        module: "Item Library",
        permissions: [
          "Access Items module",
          "View cost and pricing data",
          "Edit min/max stock levels",
          "Manage vendor qualification",
        ],
      },
      { module: "Receiving", permissions: ["Access Receiving module"] },
      { module: "Inventory Movement", permissions: ["Access Inventory Movement module", "Manage movement plans"] },
      { module: "Physical Inventory", permissions: ["Access Physical Inventory module", "View inventory valuation data"] },
      { module: "Shipments", permissions: ["Access Shipments module"] },
      { module: "Partners", permissions: ["Access Partners module", "Manage vendor qualification"] },
      { module: "Module Defaults", permissions: ["Access Module Defaults module"] },
    ],
  },
  {
    id: "procurement-officer",
    name: "Procurement Officer",
    description:
      "Sits between the predefined Buyer and Procurement Manager. Raises, edits, and closes purchase orders. Maintains vendor qualification and vendor records. Holds no bulk import or pricing rule authority.",
    group: "Full Access",
    // 15, not 16: Manage Vendor Qualification is listed under Item Library and
    // Partners but is one linked permission (ERP-5500 AC23, QA 6 Nov).
    statedCount: 15,
    modules: [
      {
        module: "Purchase Orders",
        permissions: [
          "Access Purchase Orders module",
          "Create and edit purchase orders",
          "Purchase from non-qualified vendors",
          "Cancel or archive purchase orders",
          "Apply pricing rules",
          "Add one-time discounts and premiums",
        ],
      },
      {
        module: "Item Library",
        permissions: ["Access Items module", "View cost and pricing data", "Manage vendor qualification"],
      },
      {
        module: "Partners",
        permissions: [
          "Access Partners module",
          "Create and edit partner",
          "Configure vendor settings",
          "Manage vendor qualification",
        ],
      },
      { module: "Contacts Directory", permissions: ["Access Contacts module", "Create and edit contact"] },
      { module: "Module Defaults", permissions: ["Access Module Defaults module"] },
    ],
  },
  {
    id: "sales-operations-lead",
    name: "Sales Operations Lead",
    description:
      "Runs the order book rather than selling. Clears and allocates orders. Manages representatives and documents on quotes and orders. Owns pipeline exports. Holds no pricing or discount authority.",
    group: "Full Access",
    statedCount: 21,
    modules: [
      {
        module: "Sales Orders",
        permissions: [
          "Access Sales Orders module",
          "View pricing on sales orders",
          "Create and edit sales orders",
          "Operations Access",
          "Allocate inventory to orders",
          "Cancel or archive sales orders",
          "Manage sales order attachments",
          "Manage sales representatives on sales orders",
          "Print and export sales orders",
          "Bulk export sales orders",
        ],
      },
      {
        module: "Quotes",
        permissions: [
          "Access Quotes module",
          "View pricing on quotes",
          "Manage sales representatives on quote",
          "Print and export quotes",
          "Bulk export quotes",
        ],
      },
      { module: "Physical Inventory", permissions: ["Access Physical Inventory module"] },
      { module: "Partners", permissions: ["Access Partners module", "Configure customer settings"] },
      { module: "Contacts Directory", permissions: ["Access Contacts module", "Create and edit contact"] },
      { module: "Module Defaults", permissions: ["Access Module Defaults module"] },
    ],
  },
  {
    id: "hr-coordinator",
    name: "HR Coordinator",
    description:
      "The create side of the create-versus-grant split offered through templates. Creates people and sends credentials. Holds no lifecycle, bulk, or access-granting authority.",
    group: "Full Access",
    statedCount: 5,
    modules: [
      {
        module: "Users and Roles",
        permissions: [
          "Access Users and Roles module",
          "Create and edit users",
          "Send secure login / password reset instructions",
          "Bulk export users and roles",
        ],
      },
      { module: "Module Defaults", permissions: ["Access Module Defaults module"] },
    ],
  },
  {
    id: "it-administrator",
    name: "IT Administrator",
    description:
      "The grant side of the create-versus-grant split, plus system administration. Covers user lifecycle, role assignment, the role library, direct grants, audit visibility, imports, and MFA policy management. Does not hold Delete MFA Policy.",
    group: "Full Access",
    statedCount: 16,
    modules: [
      {
        module: "Users and Roles",
        permissions: [
          "Access Users and Roles module",
          "Create and edit users",
          "Send secure login / password reset instructions",
          "Deactivate user",
          "Archive user",
          "Bulk import users",
          "Bulk export users and roles",
          "Assign roles",
          "Manage granular permissions",
          "Create and edit roles",
          "Deactivate or reactivate role",
          "Archive or unarchive role",
          "View access audit logs",
        ],
      },
      { module: "Global MFA", permissions: ["Access Global MFA module", "Manage Global MFA"] },
      { module: "Module Defaults", permissions: ["Access Module Defaults module"] },
    ],
  },

  /* Support Agent, Auditor (Read-Only), and Inventory Specialist were Field
   * User templates until v2.4 moved them to Full Access. */
  {
    id: "support-agent",
    name: "Support Agent",
    description:
      "Broad read across operational modules to answer questions and troubleshoot. Takes no actions. It holds no Users and Roles permissions, so credential support stays with the administrative roles. All ten permissions are module access gates.",
    group: "Full Access",
    statedCount: 10,
    licenseNote:
      "Eight of these ten gates are on administrative modules, and read-only entry to an administrative module requires Full Access. The template takes no action anywhere, but it consumes a full seat.",
    modules: [
      {
        module: null,
        permissions: [
          "Access Items module",
          "Access Categories module",
          "Access Partners module",
          "Access Contacts module",
          "Access Sales Orders module",
          "Access Quotes module",
          "Access Shipments module",
          "Access Purchase Orders module",
          "Access Receiving module",
          "Access Module Defaults module",
        ],
      },
    ],
  },
  {
    id: "auditor-read-only",
    name: "Auditor (Read-Only)",
    description:
      "A pure read seat across the whole operational system. All sixteen permissions are module access gates. No actions and no financial visibility permissions.",
    group: "Full Access",
    statedCount: 16,
    licenseNote:
      "Eleven of these sixteen gates are on administrative modules. A read seat across the whole system is a full seat.",
    modules: [
      {
        module: null,
        permissions: [
          "Access Items module",
          "Access Categories module",
          "Access UOM module",
          "Access Warehouse and Locations module",
          "Access Physical Inventory module",
          "Access Cycle Count module",
          "Access Inventory Movement module",
          "Access Receiving module",
          "Access Shipments module",
          "Access Purchase Orders module",
          "Access Quotes module",
          "Access Sales Orders module",
          "Access Partners module",
          "Access Partner Groups module",
          "Access Contacts module",
          "Access Module Defaults module",
        ],
      },
    ],
  },
  {
    id: "inventory-specialist",
    name: "Inventory Specialist",
    description: "Hands-on stock work. Adjusts, quarantines, counts, and moves.",
    group: "Full Access",
    statedCount: 9,
    licenseNote:
      "Adjust Inventory writes value into inventory and requires Full Access, and the read gates on Items and Module Defaults are administrative. Adjusting stock is the purpose of this template, so the license moves rather than the permission. The predefined Field Operative is the field equivalent without Adjust Inventory.",
    modules: [
      {
        module: "Physical Inventory",
        permissions: ["Access Physical Inventory module", "Adjust inventory", "Quarantine and check out inventory"],
      },
      { module: "Cycle Count", permissions: ["Access Cycle Count module", "Execute cycle counts"] },
      { module: "Inventory Movement", permissions: ["Access Inventory Movement module", "Execute movements"] },
      { module: "Item Library", permissions: ["Access Items module"] },
      { module: "Module Defaults", permissions: ["Access Module Defaults module"] },
    ],
  },

  /* ═══ Field User templates ═══
   * Neither holds a Module Defaults permission: both require Full Access. */
  {
    id: "shipping-supervisor",
    name: "Shipping Supervisor",
    description:
      "The execution side of outbound. Picks, confirms departure, and moves stock.",
    group: "Field User",
    statedCount: 5,
    modules: [
      {
        module: "Shipments",
        permissions: ["Access Shipments module", "Execute picking tasks", "Confirm departure"],
      },
      { module: "Inventory Movement", permissions: ["Access Inventory Movement module", "Execute movements"] },
    ],
  },
  {
    id: "quality-inspector",
    name: "Quality Inspector",
    description:
      "Inspects inbound goods and stock. Quarantines and releases inventory. Confirms and labels receipts. Counts.",
    group: "Field User",
    statedCount: 7,
    modules: [
      {
        module: "Physical Inventory",
        permissions: ["Access Physical Inventory module", "Quarantine and check out inventory"],
      },
      {
        module: "Receiving",
        permissions: ["Access Receiving module", "Confirm receipt of goods", "Print receiving labels"],
      },
      { module: "Cycle Count", permissions: ["Access Cycle Count module", "Execute cycle counts"] },
    ],
  },
];

/* ─── Name resolution ─────────────────────────────────────────────────────── */

/** Catalog names are Title Case and use "&"; the spec writes sentence case and
 *  spells "and", and it suffixes access gates with "module" where the catalog
 *  sometimes does not. Normalizing both sides absorbs exactly that, and nothing
 *  more: two different permissions can never normalize to the same string. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ module$/, "")
    /* Partners catalog v1.4 puts "(group)" on all six group-level commercial
     * permissions and the spec writes them that way; this catalog carries the
     * suffix on two of the six. Dropping it on both sides resolves the name to
     * the right permission, and since resolution is scoped to the named module
     * it cannot collide with the Partners permission of the same name. */
    .replace(/ \(group\)$/, "");
}

/** Module label → module id, for the labels whose spec wording differs from the
 *  catalog's own module name. Everything else resolves through normalize(). */
const MODULE_ALIASES: Record<string, string> = {
  "warehouse and locations": "warehouse-locations",
};

const MODULE_BY_LABEL = new Map<string, (typeof PERMISSION_MODULES)[number]>();
for (const mod of PERMISSION_MODULES) MODULE_BY_LABEL.set(normalize(mod.name), mod);

const PERMISSION_BY_MODULE = new Map<string, Map<string, Permission>>();
for (const mod of PERMISSION_MODULES) {
  const index = new Map<string, Permission>();
  for (const p of mod.permissions) index.set(normalize(p.name), p);
  PERMISSION_BY_MODULE.set(mod.id, index);
}

/** Catalog-wide index for the templates that list only access gates. Names that
 *  appear in more than one module are excluded, so a catalog-wide lookup can
 *  never silently pick the wrong module's permission. */
const PERMISSION_GLOBAL = new Map<string, Permission | null>();
for (const mod of PERMISSION_MODULES) {
  for (const p of mod.permissions) {
    const key = normalize(p.name);
    PERMISSION_GLOBAL.set(key, PERMISSION_GLOBAL.has(key) ? null : p);
  }
}

interface Unresolved {
  template: string;
  module: string;
  permission: string;
  reason: string;
}

const unresolved: Unresolved[] = [];
const invariantWarnings: string[] = [];

/** Parked permissions by module id and normalized name. No seed lists one as
 *  of v2.12, but if a spec row names a parked permission again, resolution
 *  skips it rather than reporting it unresolved. */
const BACKLOGGED_BY_MODULE = new Map<string, Set<string>>();
for (const { moduleId, permission } of BACKLOGGED_PERMISSIONS) {
  if (!BACKLOGGED_BY_MODULE.has(moduleId)) BACKLOGGED_BY_MODULE.set(moduleId, new Set());
  BACKLOGGED_BY_MODULE.get(moduleId)!.add(normalize(permission.name));
}

function resolveSeed(seed: TemplateSeed): { ids: string[]; names: string[]; parked: number } {
  const ids: string[] = [];
  const names: string[] = [];
  const seen = new Set<string>();
  let parked = 0;

  for (const group of seed.modules) {
    const mod = group.module
      ? MODULE_BY_LABEL.get(normalize(group.module)) ??
        PERMISSION_MODULES.find((m) => m.id === MODULE_ALIASES[normalize(group.module!)])
      : null;

    if (group.module && !mod) {
      for (const name of group.permissions) {
        unresolved.push({
          template: seed.name,
          module: group.module,
          permission: name,
          reason: "module not in the catalog",
        });
      }
      continue;
    }

    for (const name of group.permissions) {
      const key = normalize(name);
      if (mod && BACKLOGGED_BY_MODULE.get(mod.id)?.has(key)) {
        parked++;
        continue;
      }
      const found = mod ? PERMISSION_BY_MODULE.get(mod.id)!.get(key) : PERMISSION_GLOBAL.get(key) ?? undefined;

      if (!found) {
        unresolved.push({
          template: seed.name,
          module: group.module ?? "any module",
          permission: name,
          reason: mod
            ? "no permission with this name in that module"
            : PERMISSION_GLOBAL.has(key)
              ? "name exists in more than one module, list it under its module"
              : "no permission with this name in the catalog",
        });
        continue;
      }
      if (seen.has(found.id)) continue;
      seen.add(found.id);
      ids.push(found.id);
      names.push(found.name);
    }
  }

  return { ids, names, parked };
}

/** A template can never carry a granular permission in a module without that
 *  module's own Access gate, and the resolved set has to match the count the
 *  spec states. Both are reported rather than patched: silently adding a gate
 *  or hiding a shortfall would make the card lie about what it checks. */
function checkInvariants(seed: TemplateSeed, ids: string[], parked: number): void {
  const granted = new Set(ids);

  for (const mod of PERMISSION_MODULES) {
    const touched = mod.permissions.filter((p) => granted.has(p.id));
    if (touched.length === 0) continue;
    const gate = mod.permissions.find((p) => p.category === "Module access");
    if (gate && !granted.has(gate.id)) {
      invariantWarnings.push(
        `${seed.name}: carries ${mod.name} permissions without "${gate.name}"`
      );
    }
  }

  const resolved = countDistinctPermissions(ids) + parked;
  if (resolved !== seed.statedCount) {
    invariantWarnings.push(
      `${seed.name}: spec states ${seed.statedCount} permissions, ${resolved} resolved`
    );
  }
}

function buildTemplate(seed: TemplateSeed): RoleTemplate {
  const { ids, names, parked } = resolveSeed(seed);
  checkInvariants(seed, ids, parked);
  return {
    id: seed.id,
    name: seed.name,
    description: seed.description,
    group: seed.group,
    permissionIds: ids,
    permissionNames: names,
    licenseNote: seed.licenseNote,
  };
}

/* ─── The library ─────────────────────────────────────────────────────────── */

/** All 12, A to Z by name. Alphabetical rather than in the spec's listed order,
 *  and one flat list rather than a Full access section and a Field user one: the
 *  picker is something an admin scans by name, each card already carries its own
 *  licence chip, and a fixed alphabet is the only ordering that stays
 *  predictable as templates are added. */
export const ALL_ROLE_TEMPLATES: RoleTemplate[] = TEMPLATE_SEEDS.map(buildTemplate).sort((a, b) =>
  a.name.localeCompare(b.name)
);

/** The first six alphabetically, shown on the Basic Details step. The rest are
 *  one click away in the full library. */
export const DEFAULT_ROLE_TEMPLATES: RoleTemplate[] = ALL_ROLE_TEMPLATES.slice(0, 6);

export const FULL_ACCESS_ROLE_TEMPLATES: RoleTemplate[] = ALL_ROLE_TEMPLATES.filter(
  (t) => t.group === "Full Access"
);
export const FIELD_USER_ROLE_TEMPLATES: RoleTemplate[] = ALL_ROLE_TEMPLATES.filter(
  (t) => t.group === "Field User"
);

/** True when the query matches the template's name, description, or any of its
 *  permission names. The library and the compact set search the same way. */
export function templateMatchesQuery(template: RoleTemplate, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    template.name.toLowerCase().includes(q) ||
    template.description.toLowerCase().includes(q) ||
    template.permissionNames.some((n) => n.toLowerCase().includes(q))
  );
}

/** Permission names in a template that match the query, so a card can show why
 *  it survived a search that its name and description did not match. */
export function matchingPermissionNames(template: RoleTemplate, query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return template.permissionNames.filter((n) => n.toLowerCase().includes(q));
}

/* ─── Drift reporting ───
 * Surfaced in the console rather than thrown: a template that lost a permission
 * to a catalog rename must still render, with that permission simply unchecked.
 * Anything printed here is a spec-versus-catalog mismatch to reconcile, not a
 * runtime failure. */
if (unresolved.length > 0) {
  console.warn(
    `[role templates] ${unresolved.length} permission name(s) did not resolve against the permissions catalog and are left unchecked:`,
    unresolved
  );
}
if (invariantWarnings.length > 0) {
  console.warn("[role templates] template invariants not met:", invariantWarnings);
}
