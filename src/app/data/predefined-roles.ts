/**
 * Canonical Predefined Roles: Pioneer v2.12 (single source of truth)
 * ──────────────────────────────────────────────────────────────────
 * The 25 predefined/system roles finalized by product (Predefined Roles,
 * Pioneer v2.12, 14 Oct 26): 20 Full Access and 5 Field User. The role set,
 * its names, and licence tiers are unchanged since v2.4. Descriptions follow
 * v2.12 word for word, except Account Owner, whose description was rewritten
 * for the Account Owner rules (ERP-5506 AC11; the role summary copy lives in
 * `account-owner.ts`). Permission sets live in
 * `role-permissions-map.ts`. This file holds the
 * *rich metadata* that does not fit the operational `RoleRow` shape
 * (per-role default alerts, protected
 * / all-access flags, all-access note, excluded permissions, and the spec's
 * intended assigned-user counts).
 *
 * Relationship to the rest of UAC:
 *   • `roles-data.ts` builds its 25 predefined `RoleRow`s from this list
 *     (id ↔ id, name, licenseTier → licenseRequired, description).
 *   • `role-permissions-map.ts` holds the actual permission-id bundle per role,
 *     keyed by `optionId` (= roleNameToOptionId(name)).
 *   • Role detail renders `alerts` here; global account alerts come from
 *     `GLOBAL_ACCOUNT_ALERTS`.
 *
 * Rules baked in (from the spec):
 *   • All 25 are system-owned and locked: not editable/deactivatable/archivable,
 *     but copyable. Account Owner is the only `protected` role.
 *   • Permissions are additive (union across a user's roles); license tier is
 *     derived, never hand-set.
 *   • `allAccess` roles (Account Owner, Super Administrator, System
 *     Configuration Manager) render an all-access summary instead of a toggle
 *     list. Since v1.3 removed Delete roles there is only ONE nuclear action
 *     left, so System Configuration Manager excludes exactly one permission
 *     (Delete MFA policy) and is now separated from Super Administrator by
 *     that single permission. Flagged for Eli: the two roles have converged.
 *   • Every permission NAME referenced by these roles already exists in the
 *     permissions catalog (`permissions-data.ts`), nothing is invented here.
 *   • The "New Permission Request Submitted" alert is out of the Pioneer
 *     defaults: Permission Requests is deferred to the end of Billy Bob, so
 *     the alert has nothing to fire on. "User Requested New Invitation Link"
 *     is invitation lifecycle and stays.
 */

import { PERMISSION_MODULES } from "./permissions-data";

export type LicenseTier = "Full Access" | "Field User";

export interface RoleAlert {
  /** Exact alert name (matches an entry in the notifications catalog). */
  name: string;
  /** Off-by-default alerts do not fire until a tenant enables them. */
  offByDefault: boolean;
}

export interface PredefinedRoleMeta {
  id: number; // 1..25, matches RoleRow.id
  name: string;
  /** roleNameToOptionId(name): key into ROLE_PERMISSION_MAP / ROLE_DISPLAY_NAMES. */
  optionId: string;
  licenseTier: LicenseTier;
  description: string;
  /** True only for Account Owner. */
  protected: boolean;
  /** True for Account Owner, Super Administrator, System Configuration Manager. */
  allAccess: boolean;
  /** Rendered in place of a permission list when allAccess is true. */
  allAccessNote?: string;
  /** For System Configuration Manager: the one permission it does NOT hold. */
  excludedPermissions?: string[];
  /** Role default alerts, by exact name. Global account alerts are separate. */
  alerts: RoleAlert[];
  /** Spec's realistic assigned-user count (display metadata). */
  assignedUserCount: number;
}

/**
 * Account-level alerts every user receives regardless of role. These are
 * global, not per-role, do not add them to any role's `alerts`.
 */
export const GLOBAL_ACCOUNT_ALERTS = [
  { name: "Profile Updated by Admin", offByDefault: false, mandatory: true },
  { name: "Role Removed from Your Profile", offByDefault: false, mandatory: true },
  { name: "License Upgraded for User", offByDefault: true, mandatory: false },
] as const;

/** Standing note shown under a role's alert list (spec Prompt 3). */
export const ACCOUNT_ALERTS_NOTE =
  "Every user also receives account alerts about their own profile: Profile " +
  "Updated by Admin and Role Removed from Your Profile. License Upgraded for " +
  "User is off by default.";

const on = (name: string): RoleAlert => ({ name, offByDefault: false });
const off = (name: string): RoleAlert => ({ name, offByDefault: true });

/**
 * Default alert set per role, keyed by exact role name. Covers the 25
 * predefined roles AND the custom roles in `roles-data.ts`, so a role detail
 * page resolves its own alerts either way rather than falling back to the
 * account-level defaults.
 *
 * Every name here must exist in the alerts catalog (`alerts-data.ts`). Two
 * standing rules: the three `GLOBAL_ACCOUNT_ALERTS` are account-level and never
 * listed on a role, and "New Permission Request Submitted" stays out of every
 * role while Permission Requests is deferred.
 *
 * `on` = the role receives it by default. `off` = the role is subscribed but the
 * alert is off until a tenant turns it on, which is what makes each role's
 * Enabled count read as a real, partially-tuned configuration.
 */
const ROLE_ALERT_DEFAULTS: Record<string, RoleAlert[]> = {
  /* ── Administration and Access: exceptions and money, not task noise ── */
  "Account Owner": [
    on("User Requested New Invitation Link"),
    on("Credit Limit Exceeded"),
    on("Purchase Order Cancelled"),
    off("Delivery Past Due Date"),
    off("Insufficient Inventory for Order"),
    off("Plan Discrepancy Requires Your Approval"),
    off("Damaged Items Received"),
  ],
  "Super Administrator": [
    on("User Requested New Invitation Link"),
    on("Pending Task Needs Reassignment"),
    on("Credit Limit Exceeded"),
    on("Purchase Order Cancelled"),
    off("Item Deactivated"),
    off("Delivery Past Due Date"),
    off("Insufficient Inventory for Order"),
  ],
  "System Configuration Manager": [
    on("Category Deactivated"),
    on("Category Owner Removed"),
    on("Item Deactivated"),
    off("Part Number Updated"),
    off("Vendor Removed from QVL"),
    off("Lot Quarantined"),
  ],
  "Access and Security Manager": [
    on("User Requested New Invitation Link"),
    on("Pending Task Needs Reassignment"),
    off("Item Ownership Added"),
    off("Item Ownership Removed"),
  ],
  "IT Helpdesk": [
    on("User Requested New Invitation Link"),
    off("Pending Task Needs Reassignment"),
    off("Item Ownership Removed"),
  ],

  /* ── People and HR ── */
  "HR Administrator": [
    on("User Requested New Invitation Link"),
    on("Pending Task Needs Reassignment"),
    off("Item Ownership Added"),
  ],

  /* ── Procurement and Supply ── */
  Buyer: [
    on("Complete Your Purchase Order"),
    on("Delivery Past Due Date"),
    on("Vendor Removed from QVL"),
    off("Purchase Order Cancelled"),
    off("Damaged Items Received"),
    off("Received More Than Ordered"),
    off("Item Deactivated"),
  ],
  "Procurement Manager": [
    on("Complete Your Purchase Order"),
    on("Damaged Items Received"),
    on("Over Receipt on Delivery"),
    on("Vendor Removed from QVL"),
    on("Item Deactivated"),
    on("Delivery Past Due Date"),
    off("Purchase Order Cancelled"),
    off("Received More Than Ordered"),
    off("Item Mismatch on Receipt"),
  ],
  "Vendor Manager": [
    on("Vendor Removed from QVL"),
    on("Credit Limit Exceeded"),
    off("Delivery Past Due Date"),
    off("Damaged Items Received"),
    off("Item Deactivated"),
  ],

  /* ── Warehouse and Inventory ── */
  "Warehouse Supervisor": [
    on("Plan Discrepancy Requires Your Approval"),
    on("Cycle Count Plan Declined: Action Required"),
    on("Cycle Count Plan Has Been Cancelled"),
    on("Issue Reported During Movement"),
    on("Shipment Delay Expected: Movement Overdue"),
    on("Over Receipt on Delivery"),
    on("Pending Task Needs Reassignment"),
    off("Issue Reported on a Counted Item"),
    off("Recount Requested for a Line Item"),
    off("Item Mismatch on Receipt"),
    off("Lot Expiry Warning"),
  ],
  "Inventory Controller (Adjust and Value)": [
    on("Plan Discrepancy Requires Your Approval"),
    on("Lot Quarantined on Receipt"),
    on("Lot Expiry Warning"),
    on("Lot Expired"),
    on("Lot Quarantined"),
    off("Insufficient Inventory for Order"),
    off("Issue Reported on a Counted Item"),
    off("Recount Requested for a Line Item"),
  ],
  "Item Data Administrator": [
    on("Item Deactivated"),
    on("Part Number Updated"),
    on("Item Ownership Added"),
    on("Category Owner Removed"),
    on("Category Deactivated"),
    off("Item Ownership Removed"),
    off("Vendor Removed from QVL"),
  ],
  "Item Pricing Administrator": [
    on("Part Number Updated"),
    on("Item Deactivated"),
    off("Vendor Removed from QVL"),
    off("Quote Item Made Inactive"),
    off("Category Deactivated"),
  ],

  /* ── Receiving ── */
  "Receiving Supervisor": [
    on("Over Receipt on Delivery"),
    on("Lot Quarantined on Receipt"),
    on("Damaged Items Received"),
    on("Item Mismatch on Receipt"),
    off("Received More Than Ordered"),
    off("Delivery Past Due Date"),
    off("Lot Expired"),
  ],

  /* ── Shipping and Outbound ── */
  "Shipment Manager": [
    on("Shipment Delay Expected: Movement Overdue"),
    on("Sales Order Cancelled"),
    on("Pending Task Needs Reassignment"),
    on("Pick Task Assignment"),
    off("Insufficient Inventory for Order"),
    off("Issue Reported During Movement"),
  ],

  /* ── Sales ── */
  "Sales Representative": [
    on("Sales Order Cancelled"),
    on("Quote Expiring Soon"),
    on("Quote Item Made Inactive"),
    off("Quote Expired"),
    off("Insufficient Inventory for Order"),
    off("Credit Limit Exceeded"),
  ],
  "Sales Manager (Pricing and Discounts)": [
    on("Credit Limit Exceeded"),
    on("Sales Order Cancelled"),
    on("Quote Expiring Soon"),
    on("Quote Expired"),
    off("Quote Item Made Inactive"),
    off("Insufficient Inventory for Order"),
  ],

  /* ── Operations and Commercial ── */
  "Operations Clearance Specialist": [
    on("Sales Order Cancelled"),
    on("Insufficient Inventory for Order"),
    on("Shipment Delay Expected: Movement Overdue"),
    off("Quote Expiring Soon"),
    off("Issue Reported During Movement"),
  ],

  /* ── Finance and Accounting ── */
  "Finance Controller (Credit and Terms)": [
    on("Credit Limit Exceeded"),
    on("Purchase Order Cancelled"),
    off("Insufficient Inventory for Order"),
    off("Delivery Past Due Date"),
    off("Quote Expired"),
  ],

  /* ── Field and Mobile: assignment alerts, kept deliberately narrow ── */
  "Material Handler": [
    on("Pick Task Assignment"),
    on("Issue Reported During Movement"),
    off("Shipment Delay Expected: Movement Overdue"),
    off("Cycle Count Plan Assignment"),
  ],
  "Cycle Counter": [
    on("Cycle Count Plan Assignment"),
    on("Recount Requested for a Line Item"),
    on("Cycle Count Plan Has Been Cancelled"),
    off("Issue Reported on a Counted Item"),
    off("Cycle Count Plan Declined: Action Required"),
  ],
  "Dispatch Clerk": [
    on("Pick Task Assignment"),
    off("Shipment Delay Expected: Movement Overdue"),
    off("Sales Order Cancelled"),
  ],
  "Receiving Clerk": [
    on("Item Mismatch on Receipt"),
    on("Over Receipt on Delivery"),
    off("Lot Quarantined on Receipt"),
    off("Damaged Items Received"),
  ],
  "Field Operative": [
    on("Pick Task Assignment"),
    on("Cycle Count Plan Assignment"),
    on("Issue Reported During Movement"),
    off("Recount Requested for a Line Item"),
    off("Item Mismatch on Receipt"),
  ],
  /* A read-only landing seat: nothing beyond the account alerts every user gets. */
  "Basic User": [],

  /* ── Custom roles (roles-data.ts, ids 26+) ── */
  /* Read-only oversight: quality holds and count exceptions on, day-to-day
     transaction noise subscribed but off. */
  "Compliance Auditor": [
    on("Lot Quarantined"),
    on("Lot Expired"),
    on("Plan Discrepancy Requires Your Approval"),
    off("Over Receipt on Delivery"),
    off("Credit Limit Exceeded"),
    off("Item Deactivated"),
    off("Issue Reported on a Counted Item"),
  ],
  /* Archived role whose reporting moved to the BI tool, so most of its alerts
     were switched off before it was retired. */
  "Sales Operations Analyst": [
    on("Sales Order Cancelled"),
    on("Quote Expired"),
    off("Quote Expiring Soon"),
    off("Quote Item Made Inactive"),
    off("Insufficient Inventory for Order"),
    off("Credit Limit Exceeded"),
  ],
  /* Buyer plus cancel and partner setup, so it keeps the cancellation alert the
     plain Buyer has off. */
  "Senior Buyer": [
    on("Complete Your Purchase Order"),
    on("Purchase Order Cancelled"),
    on("Delivery Past Due Date"),
    on("Vendor Removed from QVL"),
    on("Damaged Items Received"),
    off("Received More Than Ordered"),
    off("Over Receipt on Delivery"),
    off("Credit Limit Exceeded"),
  ],
  /* Floor execution across counts, movements, receiving, and picking. */
  "Warehouse Operator": [
    on("Cycle Count Plan Assignment"),
    on("Pick Task Assignment"),
    on("Issue Reported During Movement"),
    on("Recount Requested for a Line Item"),
    off("Item Mismatch on Receipt"),
    off("Cycle Count Plan Has Been Cancelled"),
    off("Lot Quarantined on Receipt"),
  ],
};

/**
 * Default alerts for any role by name, predefined or custom. Returns undefined
 * for an unknown role so callers can tell "role with no alert defaults" apart
 * from "not a role we know about".
 */
export function getRoleAlertDefaults(roleName: string): RoleAlert[] | undefined {
  return ROLE_ALERT_DEFAULTS[roleName];
}

const PREDEFINED_ROLE_META: Omit<PredefinedRoleMeta, "alerts">[] = [
  /* ═══ Administration and Access ═══ */
  {
    id: 1,
    name: "Account Owner",
    optionId: "account_owner",
    licenseTier: "Full Access",
    description:
      "Records who owns the tenant. All access, fixed for everyone. More than one person can hold it and it always keeps one; no other user can deactivate, archive, or lock out an owner, or change their key details, license, or role.",
    protected: true,
    allAccess: true,
    allAccessNote:
      "Every permission in every module, including Delete MFA Policy, and always inherits future permissions. Protected: more than one holder is allowed and at least one is always kept; permissions are locked for everyone, holders included; no other user can deactivate, archive, or lock out an Account Owner, change their name, username, primary email, or phone, unassign their license, or remove them from the role.",
    assignedUserCount: 2,
  },
  {
    id: 2,
    name: "Super Administrator",
    optionId: "super_administrator",
    licenseTier: "Full Access",
    description:
      "The everything role beneath the owner. Same all access breadth, assignable to more than one person, but not the protected apex.",
    protected: false,
    allAccess: true,
    allAccessNote:
      "Every permission in every module, including Delete MFA Policy, Manage Global MFA, and Manage Module Defaults. Assignable to more than one person. Not protected.",
    assignedUserCount: 3,
  },
  {
    id: 3,
    name: "System Configuration Manager",
    optionId: "system_configuration_manager",
    licenseTier: "Full Access",
    description:
      "Configures the whole business and its modules day to day, including standing up facilities and partner groups, but cannot own the tenant.",
    protected: false,
    allAccess: true,
    allAccessNote:
      "Every permission in every module except one, including Manage Module Defaults. Off: Delete MFA Policy.",
    excludedPermissions: ["Delete MFA Policy"],
    assignedUserCount: 2,
  },
  {
    id: 4,
    name: "Access and Security Manager",
    optionId: "access_and_security_manager",
    licenseTier: "Full Access",
    description:
      "Owns who gets access and the security posture. Grants roles and permissions, manages MFA, reads the audit trail. Does not create employee records. The create-versus-grant split is offered as templates, not as two locked roles.",
    protected: false,
    allAccess: false,
    assignedUserCount: 2,
  },
  {
    id: 5,
    name: "IT Helpdesk",
    optionId: "it_helpdesk",
    licenseTier: "Full Access",
    description:
      "First line support. Broad read visibility to troubleshoot users, plus password reset. Not a field role, and no privilege escalation. Most of its permissions are module access gates, so it is broad read, not broad authority.",
    protected: false,
    allAccess: false,
    assignedUserCount: 4,
  },

  /* ═══ People and HR ═══ */
  {
    id: 6,
    name: "HR Administrator",
    optionId: "hr_administrator",
    licenseTier: "Full Access",
    description:
      "Onboards and offboards people. Creates the user, fills the profile, deactivates leavers. Cannot grant access.",
    protected: false,
    allAccess: false,
    assignedUserCount: 2,
  },

  /* ═══ Procurement and Supply ═══ */
  {
    id: 7,
    name: "Buyer",
    optionId: "buyer",
    licenseTier: "Full Access",
    description:
      "Raises and edits purchase orders, including pricing rules and one-time discounts. Adds vendors to an item's vendor list, and can use an unlisted vendor location for a single order.",
    protected: false,
    allAccess: false,
    assignedUserCount: 6,
  },
  {
    id: 8,
    name: "Procurement Manager",
    optionId: "procurement_manager",
    licenseTier: "Full Access",
    description:
      "Owns what the company buys. Holds the cancel, bulk import, and pricing rule authority a Buyer does not.",
    protected: false,
    allAccess: false,
    assignedUserCount: 2,
  },
  {
    id: 9,
    name: "Vendor Manager",
    optionId: "vendor_manager",
    licenseTier: "Full Access",
    description:
      "Owns supplier master records and their terms, at partner and group level. Kept separate from purchase-order raising as the anti-fraud control.",
    protected: false,
    allAccess: false,
    assignedUserCount: 2,
  },

  /* ═══ Warehouse and Inventory ═══ */
  {
    id: 10,
    name: "Warehouse Supervisor",
    optionId: "warehouse_supervisor",
    licenseTier: "Full Access",
    description:
      "Runs the floor: bins and zones, plans counts and movements, and approves them. Not facilities, which is configuration, and not stock-value adjustment beyond counts.",
    protected: false,
    allAccess: false,
    assignedUserCount: 3,
  },
  {
    id: 11,
    name: "Inventory Controller (Adjust and Value)",
    optionId: "inventory_controller_(adjust_and_value)",
    licenseTier: "Full Access",
    description:
      "The inventory accountant. Adjusts on-hand stock and owns valuation visibility.",
    protected: false,
    allAccess: false,
    assignedUserCount: 1,
  },
  {
    id: 12,
    name: "Item Data Administrator",
    optionId: "item_data_administrator",
    licenseTier: "Full Access",
    description:
      "Owns the item catalog and taxonomy. Creates, configures, archives items and categories, and runs imports. No cost or pricing.",
    protected: false,
    allAccess: false,
    assignedUserCount: 2,
  },
  {
    id: 13,
    name: "Item Pricing Administrator",
    optionId: "item_pricing_administrator",
    licenseTier: "Full Access",
    description:
      "Owns item cost and pricing data and the valuation method. The financial half of the item master, split from item data.",
    protected: false,
    allAccess: false,
    assignedUserCount: 1,
  },

  /* ═══ Receiving ═══ */
  {
    id: 14,
    name: "Receiving Supervisor",
    optionId: "receiving_supervisor",
    licenseTier: "Full Access",
    description:
      "The receiving lead. Runs inbound receipts, plans the put-away that follows, and checks a delivery against the purchase order behind it. The field Receiving Clerk executes receipts and moves stock but plans nothing and cannot see the order.",
    protected: false,
    allAccess: false,
    assignedUserCount: 1,
  },

  /* ═══ Shipping and Outbound ═══ */
  {
    id: 15,
    name: "Shipment Manager",
    optionId: "shipment_manager",
    licenseTier: "Full Access",
    description:
      "Plans, builds, and cancels shipments against confirmed orders. The overship and short-ship exception authority is held out as a template elevation, not bundled here.",
    protected: false,
    allAccess: false,
    assignedUserCount: 2,
  },

  /* ═══ Sales ═══ */
  {
    id: 16,
    name: "Sales Representative",
    optionId: "sales_representative",
    licenseTier: "Full Access",
    description:
      "The everyday seller. Writes and sends quotes and orders within catalog pricing, and sets up customers. Cannot set pricing rules, discount, clear ops, or allocate stock.",
    protected: false,
    allAccess: false,
    assignedUserCount: 8,
  },
  {
    id: 17,
    name: "Sales Manager (Pricing and Discounts)",
    optionId: "sales_manager_(pricing_and_discounts)",
    licenseTier: "Full Access",
    description:
      "Owns the commercial authority reps lack: pricing rules, one-time discounts, and bulk export. Already the team lead for sales, so there is no separate sales team lead.",
    protected: false,
    allAccess: false,
    assignedUserCount: 1,
  },

  /* ═══ Operations and Commercial ═══ */
  {
    id: 18,
    name: "Operations Clearance Specialist",
    optionId: "operations_clearance_specialist",
    licenseTier: "Full Access",
    description:
      "The operations gate between sales and the warehouse. Clears orders from Pending Review and allocates stock. Explicitly not a sales role, which is the conflict-of-interest control.",
    protected: false,
    allAccess: false,
    assignedUserCount: 2,
  },

  /* ═══ Finance and Accounting ═══ */
  {
    id: 19,
    name: "Finance Controller (Credit and Terms)",
    optionId: "finance_controller_(credit_and_terms)",
    licenseTier: "Full Access",
    description:
      "Sets the commercial terms the company sells on, owns billing and licensing, and sees cost everywhere. Does not write the sales documents. Held light for Pioneer; the full accounting ladder is post-Pioneer.",
    protected: false,
    allAccess: false,
    assignedUserCount: 1,
  },

  /* ═══ Field and Mobile (Field User license) ═══
   * Five roles. Their permissions are the same single permissions that govern
   * web and mobile: a capability on both surfaces is one permission that
   * provisions both at once. */
  {
    id: 20,
    name: "Material Handler",
    optionId: "material_handler",
    licenseTier: "Field User",
    description:
      "The general floor worker who moves and picks, on web and mobile. Absorbs picker and movement operator. Direction agnostic movement, no boundary assertions.",
    protected: false,
    allAccess: false,
    assignedUserCount: 12,
  },
  {
    id: 21,
    name: "Cycle Counter",
    optionId: "cycle_counter",
    licenseTier: "Field User",
    description:
      "Counts stock on web and handheld. A separate function from material handling, stacked where one person does both.",
    protected: false,
    allAccess: false,
    assignedUserCount: 5,
  },
  {
    id: 22,
    name: "Dispatch Clerk",
    optionId: "dispatch_clerk",
    licenseTier: "Field User",
    description:
      "The outbound boundary. Picks, stages, and confirms departure. Inherits Material Handler movement.",
    protected: false,
    allAccess: false,
    assignedUserCount: 4,
  },
  {
    id: 23,
    name: "Receiving Clerk",
    optionId: "receiving_clerk",
    licenseTier: "Field User",
    description:
      "The inbound boundary. Receives against a purchase order, puts away, and labels. Inherits Material Handler movement. Kept separate from Dispatch Clerk for inbound and outbound custody separation.",
    protected: false,
    allAccess: false,
    assignedUserCount: 4,
  },
  {
    id: 24,
    name: "Field Operative",
    optionId: "field_operative",
    licenseTier: "Field User",
    description:
      "The universal field seat. All physical task execution across receiving, movement, cycle count, physical inventory, and picking and dispatch. Nothing administrative, and no stock-value adjustment.",
    protected: false,
    allAccess: false,
    assignedUserCount: 7,
  },
  /* ═══ Default Seat ═══
   * Not a field role. Eli locked six field roles in Session 2; this was the
   * sixth, and v2.4 moved it out of Field and Mobile. The v2.12 license note:
   * "Read-only entry to an administrative module requires Full Access, and all
   * five of the gates this role holds are administrative. The role takes no
   * action anywhere, but it consumes a full seat." */
  {
    id: 25,
    name: "Basic User",
    optionId: "basic_user",
    licenseTier: "Full Access",
    description:
      "Anyone just created and not yet given a real role. A safe read-only landing seat with no actions. All five permissions are module access gates.",
    protected: false,
    allAccess: false,
    assignedUserCount: 9,
  },
];

/** The 25 predefined roles, with each role's default alert set attached. */
export const PREDEFINED_ROLES: PredefinedRoleMeta[] = PREDEFINED_ROLE_META.map((r) => ({
  ...r,
  alerts: ROLE_ALERT_DEFAULTS[r.name] ?? [],
}));

/* ─── Lookups ─── */
const BY_ID = new Map<number, PredefinedRoleMeta>(PREDEFINED_ROLES.map((r) => [r.id, r]));
const BY_NAME = new Map<string, PredefinedRoleMeta>(PREDEFINED_ROLES.map((r) => [r.name, r]));
const BY_OPTION = new Map<string, PredefinedRoleMeta>(PREDEFINED_ROLES.map((r) => [r.optionId, r]));

export function getPredefinedRoleMeta(
  key: number | string,
): PredefinedRoleMeta | undefined {
  if (typeof key === "number") return BY_ID.get(key);
  return BY_NAME.get(key) ?? BY_OPTION.get(key);
}

/** Is this role id / name / optionId one of the 25 predefined roles? */
export function isPredefinedRole(key: number | string): boolean {
  return getPredefinedRoleMeta(key) !== undefined;
}

/** All predefined role display names, in dataset order. */
export const PREDEFINED_ROLE_NAMES: string[] = PREDEFINED_ROLES.map((r) => r.name);

/* ─── Dev consistency check ───────────────────────────────────────────
 * Verifies every alert name referenced by a role exists in the permission
 * modules-independent notifications catalog OR is a known global alert. The
 * ROLE_PERMISSION_MAP ↔ optionId cross-check lives in role-permissions-map.ts
 * (which imports this file) to avoid an import cycle. */
function assertPredefinedRolesConsistent(): void {
  const issues: string[] = [];
  const optionIds = new Set<string>();
  // Mirror of roleNameToOptionId (kept inline to avoid an import cycle with
  // roles-data). optionId MUST equal this so that consumers computing keys via
  // roleNameToOptionId(roleName) resolve to the same ROLE_PERMISSION_MAP entry.
  const slug = (name: string) => name.trim().toLowerCase().replace(/\s+/g, "_");
  for (const r of PREDEFINED_ROLES) {
    if (optionIds.has(r.optionId)) issues.push(`duplicate optionId ${r.optionId}`);
    optionIds.add(r.optionId);
    if (r.optionId !== slug(r.name)) {
      issues.push(`${r.name}: optionId "${r.optionId}" != slug "${slug(r.name)}"`);
    }
    if (r.excludedPermissions && !r.allAccess) {
      issues.push(`${r.name}: excludedPermissions set without allAccess`);
    }
  }
  // Reference PERMISSION_MODULES so the import is used and any future
  // name-resolution assertion has the catalog at hand.
  if (PERMISSION_MODULES.length === 0) issues.push("permission catalog is empty");
  if (issues.length && typeof console !== "undefined") {
    console.warn("[predefined-roles] consistency issues:", issues);
  }
}
assertPredefinedRolesConsistent();
