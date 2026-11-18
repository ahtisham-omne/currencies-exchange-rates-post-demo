import {
  ArrowLeftRight,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Grid3X3,
  Handshake,
  Layers,
  MapPin,
  Package,
  Receipt,
  Send,
  ShoppingBag,
  ShoppingCart,
  Users,
  UsersRound,
  Warehouse,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { GLOBAL_ACCOUNT_ALERTS, PREDEFINED_ROLES } from "./predefined-roles";

/**
 * Alerts catalog: the single source of truth for the Alerts tab (user detail and
 * role detail) and for the global notifications modal in the header.
 *
 * Mirrored from the Alert Settings project's alerts module (`alertsData.ts` +
 * `AlertsSettingsPage.tsx`) so the module list, the alerts inside each module,
 * and the listing's quick filters match the alerts module exactly:
 *   - 7 categories → the quick-filter chips
 *   - 19 modules, 12 of which ship alerts today
 *   - 39 alert definitions
 *
 * Modules with `hasAlerts: false` have no alert definitions yet. They still
 * render in the listing, greyed out and marked "Coming soon", exactly as the
 * alerts module presents them.
 */

/* ─── Types ─── */

export interface AlertPreview {
  emailSubject: string;
  emailBody: string;
  pushText: string;
  inAppTitle: string;
  inAppText: string;
}

export interface AlertDefinition {
  /** Stable id, unique across the catalog. */
  id: string;
  /** Exact alert name. Joins against `PredefinedRoleMeta.alerts[].name`. */
  title: string;
  /** Delivery channels. Exactly the literals "email" | "in-app" | "push". */
  channels: string[];
  description: string;
  /** Account-level default: does this alert fire unless a tenant turns it off. */
  enabled: boolean;
  /** Policy-required alerts a user cannot opt out of. */
  isMandatory?: boolean;
  /** Who the alert routes to, shown in the modal's detail pane. */
  whoReceivesDescription?: string;
  /** Roles whose defaults include this alert. Derived, see `rolesForAlert`. */
  assignedThroughRoles: string[];
  preview: AlertPreview;
}

export interface AlertModuleDefinition {
  /** Module id used by the grid, the quick filters, and the modal. */
  moduleId: string;
  name: string;
  description: string;
  /** Category key, matches an `ALERT_CATEGORIES` entry. Drives quick filters. */
  categoryKey: string;
  icon: LucideIcon;
  /** False → no alerts defined yet, card renders as "Coming soon". */
  hasAlerts: boolean;
  alerts: AlertDefinition[];
}

/* ─── Categories (drive the listing's quick filters, in this order) ─── */

export interface AlertCategory {
  key: string;
  label: string;
}

export const ALERT_CATEGORIES: AlertCategory[] = [
  { key: "items-inventory", label: "Items & Inventory" },
  { key: "partners", label: "Partners Management" },
  { key: "supply-chain", label: "Supply Chain Management" },
  { key: "production", label: "Production & Planning" },
  { key: "sales", label: "Sales" },
  { key: "accounting", label: "Accounting & Finance" },
  { key: "people", label: "People Management" },
];

/* ─── Role attribution ───
 * `assignedThroughRoles` is derived rather than authored so the list a user sees
 * on an alert always agrees with the role defaults in `predefined-roles.ts`.
 * Account-level alerts every user receives resolve to "All Users". */

const GLOBAL_ALERT_NAMES = new Set<string>(GLOBAL_ACCOUNT_ALERTS.map((a) => a.name));

function rolesForAlert(title: string): string[] {
  if (GLOBAL_ALERT_NAMES.has(title)) return ["All Users"];
  return PREDEFINED_ROLES.filter((r) => r.alerts.some((a) => a.name === title)).map(
    (r) => r.name,
  );
}

/* ─── Catalog ─── */

type RawAlert = Omit<AlertDefinition, "assignedThroughRoles">;
type RawModule = Omit<AlertModuleDefinition, "alerts"> & { alerts: RawAlert[] };

const RAW_MODULES: RawModule[] = [
  /* ═══ Items & Inventory ═══ */
  {
    moduleId: "items-library",
    name: "Items Library",
    description:
      "Configure alert triggers for item creation, updates, and catalog changes.",
    categoryKey: "items-inventory",
    icon: Boxes,
    hasAlerts: true,
    alerts: [
      {
        id: "item-1",
        title: "Item Deactivated",
        channels: ["email", "in-app"],
        description:
          "Sent when an item is deactivated in the system. The item becomes blocked from all new transactions.",
        enabled: true,
        whoReceivesDescription:
          "The Item Owner and Procurement Managers who have active purchase orders referencing this item are notified automatically.",
        preview: {
          emailSubject: "Item Deactivated: SKU-4820 (Widget Pro X200)",
          emailBody:
            "Item SKU-4820 (Widget Pro X200) has been deactivated by the Item Manager. This item is now blocked from all new transactions including purchase orders, sales orders, and inventory movements. Existing open transactions referencing this item should be reviewed.",
          pushText: "Item SKU-4820 (Widget Pro X200) has been deactivated.",
          inAppTitle: "Item Deactivated",
          inAppText:
            "SKU-4820 (Widget Pro X200) has been deactivated and blocked from all new transactions.",
        },
      },
      {
        id: "item-2",
        title: "Vendor Removed from QVL",
        channels: ["email", "in-app"],
        description:
          "Sent when a vendor is removed from the Qualified Vendor List for a specific item. The vendor can no longer be selected for purchasing that item.",
        enabled: true,
        whoReceivesDescription:
          "The Procurement Manager and Item Owner are notified to review sourcing alternatives and update any pending purchase orders.",
        preview: {
          emailSubject: "QVL Update: Vendor Removed for SKU-3105",
          emailBody:
            "Vendor Apex Industrial Supply has been removed from the Qualified Vendor List for item SKU-3105 (Precision Valve Kit). This vendor can no longer be selected when creating purchase orders for this item. Please review sourcing alternatives if this was a primary supplier.",
          pushText: "Apex Industrial Supply removed from QVL for SKU-3105.",
          inAppTitle: "Vendor Removed from QVL",
          inAppText:
            "Apex Industrial Supply removed from QVL for SKU-3105 (Precision Valve Kit). Review sourcing alternatives.",
        },
      },
      {
        id: "item-3",
        title: "Part Number Updated",
        channels: ["email", "in-app"],
        description:
          "Sent when an item's part number is changed. Recipients should review and update any dependent documents that reference the old part number.",
        enabled: true,
        whoReceivesDescription:
          "The Item Owner, Procurement Managers, and Warehouse Supervisors with active references to this item are notified to update dependent documents.",
        preview: {
          emailSubject: "Part Number Changed: SKU-7291",
          emailBody:
            "The part number for item SKU-7291 (Industrial Bearing Assembly) has been updated from PN-4420-A to PN-4420-B. Please review and update any dependent documents, labels, or references that use the old part number to ensure accuracy across the system.",
          pushText: "Part number for SKU-7291 changed from PN-4420-A to PN-4420-B.",
          inAppTitle: "Part Number Updated",
          inAppText:
            "SKU-7291 (Industrial Bearing Assembly) part number changed: PN-4420-A → PN-4420-B. Update dependent documents.",
        },
      },
      {
        id: "item-4",
        title: "Item Ownership Added",
        channels: ["email", "in-app", "push"],
        description:
          "Sent when a user is assigned as the owner of an item. The newly assigned owner receives this notification.",
        enabled: true,
        whoReceivesDescription:
          "The user who has been assigned ownership of the item is notified directly.",
        preview: {
          emailSubject: "You've Been Assigned as Item Owner: SKU-5102",
          emailBody:
            "You have been assigned as the owner of item SKU-5102 (Hydraulic Pump Assembly). As the Item Owner, you are responsible for maintaining item data accuracy, reviewing vendor qualifications, and approving changes to specifications.",
          pushText: "You've been assigned as owner of SKU-5102 (Hydraulic Pump Assembly).",
          inAppTitle: "Ownership Assigned",
          inAppText:
            "You are now the owner of SKU-5102 (Hydraulic Pump Assembly). Review item details and responsibilities.",
        },
      },
      {
        id: "item-5",
        title: "Item Ownership Removed",
        channels: ["email", "in-app", "push"],
        description:
          "Sent when your ownership of an item is removed. You no longer have ownership responsibilities for this item.",
        enabled: true,
        whoReceivesDescription:
          "The user whose ownership has been removed is notified directly.",
        preview: {
          emailSubject: "Item Ownership Removed: SKU-5102",
          emailBody:
            "Your ownership of item SKU-5102 (Hydraulic Pump Assembly) has been removed. You no longer have ownership responsibilities for this item. If you believe this was done in error, please contact your Item Manager.",
          pushText: "Your ownership of SKU-5102 (Hydraulic Pump Assembly) has been removed.",
          inAppTitle: "Ownership Removed",
          inAppText:
            "Your ownership of SKU-5102 (Hydraulic Pump Assembly) has been removed. Contact your Item Manager if this was unexpected.",
        },
      },
    ],
  },
  {
    moduleId: "item-categories",
    name: "Categories",
    description:
      "Set alerts for category hierarchy changes and classification updates.",
    categoryKey: "items-inventory",
    icon: Grid3X3,
    hasAlerts: true,
    alerts: [
      {
        id: "cat-1",
        title: "Category Owner Removed",
        channels: ["email", "in-app", "push"],
        description:
          "Alerts when a category ownership is removed and the category requires immediate reassignment.",
        enabled: true,
        whoReceivesDescription:
          "The user whose category ownership was removed is notified directly.",
        preview: {
          emailSubject: "Category Ownership Removed: Electrical Components",
          emailBody:
            "Your ownership of the category 'Electrical Components' has been removed. This category requires immediate reassignment to a new owner to maintain data governance. If you believe this was done in error, please contact your Category Manager.",
          pushText: "Your ownership of category 'Electrical Components' has been removed.",
          inAppTitle: "Category Ownership Removed",
          inAppText:
            "Your ownership of 'Electrical Components' has been removed. The category requires reassignment.",
        },
      },
      {
        id: "cat-2",
        title: "Category Deactivated",
        channels: ["email", "in-app"],
        description:
          "Alerts when a category is deactivated. Associated items must be reviewed and reassigned.",
        enabled: true,
        whoReceivesDescription:
          "The Category Owner and Item Managers with items classified under this category are notified to review and reassign affected items.",
        preview: {
          emailSubject: "Category Deactivated: Legacy Fasteners",
          emailBody:
            "The category 'Legacy Fasteners' has been deactivated. 34 items currently classified under this category must be reviewed and reassigned to an active category. Please update item classifications at your earliest convenience to avoid disruption.",
          pushText: "Category 'Legacy Fasteners' has been deactivated. Review associated items.",
          inAppTitle: "Category Deactivated",
          inAppText:
            "'Legacy Fasteners' has been deactivated. 34 associated items need review and reassignment.",
        },
      },
    ],
  },
  {
    moduleId: "physical-inventory",
    name: "Physical Inventory",
    description:
      "Configure alerts for inventory counts and stock threshold breaches.",
    categoryKey: "items-inventory",
    icon: ClipboardList,
    hasAlerts: false,
    alerts: [],
  },
  {
    moduleId: "cycle-count",
    name: "Cycle Count",
    description:
      "Configure alerts for cycle count plan assignment, approvals, recounts, and reported issues.",
    categoryKey: "items-inventory",
    icon: ClipboardCheck,
    hasAlerts: true,
    alerts: [
      {
        id: "cc-1",
        title: "Cycle Count Plan Assignment",
        channels: ["email", "in-app", "push"],
        description:
          "Sent when a Cycle Count Plan is assigned to a user, notifying them to review the plan and begin counting.",
        enabled: true,
        whoReceivesDescription:
          "The user assigned to the cycle count plan is notified automatically.",
        preview: {
          emailSubject: "Cycle Count Plan Assigned: CC-2026-0049",
          emailBody:
            "You have been assigned to cycle count plan CC-2026-0049 for Zone A, Warehouse East. Please review the plan details and begin counting at your earliest convenience.",
          pushText: "You've been assigned to cycle count plan CC-2026-0049.",
          inAppTitle: "Plan Assigned to You",
          inAppText:
            "You've been assigned to cycle count plan CC-2026-0049 for Zone A, Warehouse East. Review and begin counting.",
        },
      },
      {
        id: "cc-2",
        title: "Cycle Count Plan Declined: Action Required",
        channels: ["email", "in-app"],
        description:
          "Sent when all assigned users have declined the plan. The Inventory Manager is notified to reassign the plan to new team members.",
        enabled: true,
        isMandatory: true,
        whoReceivesDescription:
          "The Inventory Manager who created the cycle count plan is notified automatically to reassign the plan to available team members.",
        preview: {
          emailSubject: "Cycle Count Plan Declined: CC-2026-0054",
          emailBody:
            "All assigned users have declined cycle count plan CC-2026-0054 for Zone A, Warehouse East. The plan requires reassignment to new team members to proceed. Please review and reassign at your earliest convenience.",
          pushText: "Cycle count plan CC-2026-0054 was declined by all assignees.",
          inAppTitle: "Plan Declined",
          inAppText:
            "All assigned users declined cycle count plan CC-2026-0054. Reassignment is required.",
        },
      },
      {
        id: "cc-3",
        title: "Cycle Count Plan Has Been Cancelled",
        channels: ["email", "in-app"],
        description:
          "Sent when a plan is cancelled. Both the Inventory Manager and Material Handler are informed that no further action is required.",
        enabled: true,
        whoReceivesDescription:
          "The Inventory Manager and all assigned Material Handlers are notified that the plan has been cancelled and no further action is needed.",
        preview: {
          emailSubject: "Cycle Count Plan Cancelled: CC-2026-0061",
          emailBody:
            "Cycle count plan CC-2026-0061 for Zone C, Warehouse North has been cancelled by the Inventory Manager. No further action is required on your part. If you have questions, please contact your manager.",
          pushText: "Cycle count plan CC-2026-0061 has been cancelled.",
          inAppTitle: "Plan Cancelled",
          inAppText:
            "Cycle count plan CC-2026-0061 has been cancelled. No further action is required.",
        },
      },
      {
        id: "cc-4",
        title: "Plan Discrepancy Requires Your Approval",
        channels: ["email", "in-app", "push"],
        description:
          "Sent when a completed plan has a discrepancy. The Inventory Manager must review and approve or reject the plan.",
        enabled: true,
        isMandatory: true,
        whoReceivesDescription:
          "The Inventory Manager responsible for the zone is notified automatically to review the discrepancy and approve or reject the completed count.",
        preview: {
          emailSubject: "Discrepancy Found: Cycle Count CC-2026-0072 Requires Approval",
          emailBody:
            "Cycle count plan CC-2026-0072 for Zone B, Warehouse East has been completed with discrepancies. 3 line items show quantity mismatches totalling 47 units. Please review the results and approve or reject the count.",
          pushText: "Discrepancy found in cycle count CC-2026-0072. Your approval is needed.",
          inAppTitle: "Discrepancy: Approval Required",
          inAppText:
            "Cycle count CC-2026-0072 completed with discrepancies. 3 items have quantity mismatches. Review and approve or reject.",
        },
      },
      {
        id: "cc-5",
        title: "Recount Requested for a Line Item",
        channels: ["email", "in-app"],
        description:
          "Sent when a recount is requested for a specific line item. The assigned Material Handler and Inventory Manager must recount and resubmit.",
        enabled: true,
        isMandatory: true,
        whoReceivesDescription:
          "The assigned Material Handler who performed the original count and the Inventory Manager are both notified to recount the specified line item.",
        preview: {
          emailSubject: "Recount Requested: Line Item SKU-7291 in CC-2026-0072",
          emailBody:
            "A recount has been requested for line item SKU-7291 (Industrial Bearing Assembly) in cycle count plan CC-2026-0072 at location Aisle D, Rack 08. Please recount the item and resubmit your results.",
          pushText: "Recount requested for SKU-7291 in cycle count CC-2026-0072.",
          inAppTitle: "Recount Requested",
          inAppText:
            "Recount requested for SKU-7291 (Industrial Bearing Assembly) at Aisle D, Rack 08 in plan CC-2026-0072.",
        },
      },
      {
        id: "cc-6",
        title: "Issue Reported on a Counted Item",
        channels: ["email", "in-app"],
        description:
          "Sent when an issue is flagged for a specific item and location. The Inventory Manager must investigate and resolve it.",
        enabled: false,
        whoReceivesDescription:
          "The Inventory Manager for the affected zone is notified to investigate and resolve the reported issue on the counted item.",
        preview: {
          emailSubject: "Issue Reported: SKU-3105 at Aisle F, Rack 02",
          emailBody:
            "An issue has been flagged for item SKU-3105 (Precision Valve Kit) at location Aisle F, Rack 02 during cycle count CC-2026-0088. The Material Handler reported: 'Items found damaged, packaging compromised, possible water exposure.' Please investigate and resolve.",
          pushText: "Issue reported on SKU-3105 at Aisle F, Rack 02 during count CC-2026-0088.",
          inAppTitle: "Issue Reported on Item",
          inAppText:
            "Issue flagged for SKU-3105 at Aisle F, Rack 02. Damaged packaging reported during cycle count CC-2026-0088.",
        },
      },
    ],
  },
  {
    moduleId: "inventory-movement",
    name: "Inventory Movement",
    description: "Set alerts for movement tracking and transfer activities.",
    categoryKey: "items-inventory",
    icon: ArrowLeftRight,
    hasAlerts: true,
    alerts: [
      {
        id: "mov-1",
        title: "Issue Reported During Movement",
        channels: ["email", "in-app"],
        description:
          "Sent when a staff member flags an issue during a movement, such as an empty pick location, a damaged item, or a quantity mismatch, so it can be addressed before operations are impacted.",
        enabled: true,
        whoReceivesDescription:
          "The Warehouse Manager and the staff member who initiated the movement are notified automatically to investigate and resolve the flagged issue.",
        preview: {
          emailSubject: "Issue Reported During Movement: MV-2026-0341",
          emailBody:
            "A staff member has flagged an issue during inventory movement MV-2026-0341: empty pick location at Aisle B, Rack 12. Item SKU-4820 (Widget Pro X200) could not be picked. Please investigate and resolve before downstream operations are impacted.",
          pushText:
            "Issue reported on movement MV-2026-0341: empty pick location at Aisle B, Rack 12.",
          inAppTitle: "Movement Issue Reported",
          inAppText:
            "An issue was flagged during movement MV-2026-0341: empty pick location for SKU-4820 at Aisle B, Rack 12.",
        },
      },
      {
        id: "mov-2",
        title: "Shipment Delay Expected: Movement Overdue",
        channels: ["email", "in-app", "push"],
        description:
          "Sent when a movement linked to an outbound shipment isn't completed on time, giving stakeholders a heads-up to act before the scheduled departure is missed.",
        enabled: true,
        whoReceivesDescription:
          "The Warehouse Manager and Logistics Coordinator linked to the outbound shipment are notified to expedite the overdue movement.",
        preview: {
          emailSubject: "Shipment Delay Expected: Movement MV-2026-0387 Overdue",
          emailBody:
            "Inventory movement MV-2026-0387 linked to outbound shipment SHP-2026-1120 has not been completed by the scheduled time. The shipment departure at 3:00 PM may be missed. Please take immediate action to expedite the movement.",
          pushText: "Movement MV-2026-0387 is overdue. Shipment SHP-2026-1120 may be delayed.",
          inAppTitle: "Movement Overdue",
          inAppText:
            "Movement MV-2026-0387 is overdue. Shipment SHP-2026-1120 departure at 3:00 PM may be missed.",
        },
      },
    ],
  },
  {
    moduleId: "items-maintenance",
    name: "Items Maintenance",
    description:
      "Configure alerts for maintenance plans and service schedule changes.",
    categoryKey: "items-inventory",
    icon: Wrench,
    hasAlerts: false,
    alerts: [],
  },
  {
    moduleId: "lot-management",
    name: "Lot Management",
    description:
      "Configure alerts for lot tracking, batch expiration, and serial number events.",
    categoryKey: "items-inventory",
    icon: Layers,
    hasAlerts: true,
    alerts: [
      {
        id: "lot-1",
        title: "Lot Expiry Warning",
        channels: ["email", "in-app", "push"],
        description:
          "Sent when a lot is approaching its expiration date. The Warehouse Manager is notified to prioritize consumption before the lot becomes unusable.",
        enabled: true,
        whoReceivesDescription:
          "The Warehouse Manager responsible for the storage location is notified to prioritize consumption or disposition of the expiring lot.",
        preview: {
          emailSubject: "Lot Expiry Warning: LOT-2026-0041 (SKU-3105)",
          emailBody:
            "Lot LOT-2026-0041 for item SKU-3105 (Precision Valve Kit) stored at Warehouse East, Aisle C, Rack 05 is approaching its expiration date of March 20, 2026. Please prioritize consumption or arrange disposition before the lot becomes unusable.",
          pushText: "Lot LOT-2026-0041 (SKU-3105) expires March 20, 2026. Prioritize usage.",
          inAppTitle: "Lot Expiry Warning",
          inAppText:
            "LOT-2026-0041 for SKU-3105 (Precision Valve Kit) expires March 20, 2026. Prioritize consumption.",
        },
      },
      {
        id: "lot-2",
        title: "Lot Expired",
        channels: ["email", "in-app", "push"],
        description:
          "Sent when a lot has passed its expiration date and is no longer usable. The Warehouse Manager is notified to remove or quarantine the lot immediately.",
        enabled: true,
        whoReceivesDescription:
          "The Warehouse Manager and Quality Inspector are notified to remove or quarantine the expired lot and update inventory records.",
        preview: {
          emailSubject: "Lot Expired: LOT-2026-0033 (SKU-7291)",
          emailBody:
            "Lot LOT-2026-0033 for item SKU-7291 (Industrial Bearing Assembly) has expired as of March 1, 2026. This lot is no longer usable and must be removed from active inventory or quarantined immediately. 85 units remain at Warehouse East, Aisle D, Rack 08.",
          pushText: "Lot LOT-2026-0033 (SKU-7291) has expired. Remove or quarantine immediately.",
          inAppTitle: "Lot Expired",
          inAppText:
            "LOT-2026-0033 for SKU-7291 (Industrial Bearing Assembly) expired March 1, 2026. 85 units require quarantine.",
        },
      },
      {
        id: "lot-3",
        title: "Lot Quarantined",
        channels: ["email", "in-app", "push"],
        description:
          "Sent when a lot is placed under quarantine and blocked from use. The Warehouse Manager is alerted until the hold is reviewed and resolved.",
        enabled: true,
        whoReceivesDescription:
          "The Warehouse Manager and Quality Inspector are notified to review the quarantine hold and resolve it by releasing, scrapping, or returning the lot.",
        preview: {
          emailSubject: "Lot Quarantined: LOT-2026-0058 (SKU-5102)",
          emailBody:
            "Lot LOT-2026-0058 for item SKU-5102 (Hydraulic Pump Assembly) has been placed under quarantine at Warehouse East, Aisle B, Rack 12. 40 units are now blocked from all transactions. Reason: Quality inspection required. Please review and resolve the hold.",
          pushText: "Lot LOT-2026-0058 (SKU-5102) quarantined. 40 units blocked from use.",
          inAppTitle: "Lot Quarantined",
          inAppText:
            "LOT-2026-0058 for SKU-5102 (Hydraulic Pump Assembly) quarantined. 40 units blocked. Review the hold.",
        },
      },
    ],
  },
  {
    moduleId: "location-management",
    name: "Location Management",
    description: "Set alerts for location hierarchy changes and assignments.",
    categoryKey: "items-inventory",
    icon: MapPin,
    hasAlerts: false,
    alerts: [],
  },
  {
    moduleId: "warehouse-management",
    name: "Warehouse Management",
    description:
      "Configure alerts for warehouse operations and capacity thresholds.",
    categoryKey: "items-inventory",
    icon: Warehouse,
    hasAlerts: false,
    alerts: [],
  },

  /* ═══ Partners Management ═══ */
  {
    moduleId: "partners",
    name: "Partners",
    description:
      "Configure alerts for partner onboarding, profile changes, and credit management.",
    categoryKey: "partners",
    icon: Handshake,
    hasAlerts: true,
    alerts: [
      {
        id: "pm-1",
        title: "Credit Limit Exceeded",
        channels: ["email", "in-app"],
        description:
          "Sent when transactions with a partner surpass the approved credit limit. Finance and Procurement Managers are notified to review and reassess the credit threshold.",
        enabled: true,
        whoReceivesDescription:
          "Finance and Procurement Managers assigned to the partner are notified automatically to review and reassess the credit threshold.",
        preview: {
          emailSubject: "Credit Limit Exceeded: Acme Corp",
          emailBody:
            "Partner Acme Corp has exceeded their credit limit of $50,000. Current outstanding balance is $62,350. Please review and take appropriate action.",
          pushText: "Acme Corp has exceeded their credit limit.",
          inAppTitle: "Credit Limit Exceeded",
          inAppText: "Acme Corp has exceeded their approved credit limit of $50,000.",
        },
      },
    ],
  },
  {
    moduleId: "partner-groups",
    name: "Partners Groups",
    description: "Set alerts for group membership and classification changes.",
    categoryKey: "partners",
    icon: UsersRound,
    hasAlerts: false,
    alerts: [],
  },
  {
    moduleId: "partner-reports",
    name: "Reports",
    description:
      "Configure alerts for report generation and scheduled report delivery.",
    categoryKey: "partners",
    icon: FileText,
    hasAlerts: false,
    alerts: [],
  },

  /* ═══ Supply Chain Management ═══ */
  {
    moduleId: "shipment",
    name: "Shipment",
    description:
      "Configure alerts for pick task assignments, shipment tracking, and delivery status changes.",
    categoryKey: "supply-chain",
    icon: Package,
    hasAlerts: true,
    alerts: [
      {
        id: "ship-1",
        title: "Pick Task Assignment",
        channels: ["email", "in-app", "push"],
        description:
          "Sent when a pick task is created and assigned. The assigned Picker or Material Handler is notified directly to review their pick list and begin fulfilling the shipment.",
        enabled: true,
        whoReceivesDescription:
          "The picker or material handler assigned to the task is notified automatically.",
        preview: {
          emailSubject: "Pick Task Assigned: PT-2026-0218",
          emailBody:
            "You have been assigned pick task PT-2026-0218 for shipment SHP-2026-1044. The pick list contains 12 line items across 3 zones in Warehouse East. Please review your pick list and begin fulfillment.",
          pushText: "You've been assigned pick task PT-2026-0218 for shipment SHP-2026-1044.",
          inAppTitle: "Pick Task Assigned to You",
          inAppText:
            "Pick task PT-2026-0218 has been assigned to you. 12 items for shipment SHP-2026-1044. Review and begin picking.",
        },
      },
    ],
  },
  {
    moduleId: "quotes",
    name: "Quotes & Proposals",
    description: "Configure alerts for quote expiration and approval requests.",
    categoryKey: "supply-chain",
    icon: Receipt,
    hasAlerts: true,
    alerts: [
      {
        id: "qt-1",
        title: "Quote Expiring Soon",
        channels: ["email", "in-app"],
        description:
          "Sent when a quote is approaching its expiration date to prompt timely follow-up.",
        enabled: true,
        whoReceivesDescription:
          "The Sales Representative who created the quote is notified automatically to follow up with the customer before the quote expires.",
        preview: {
          emailSubject: "Quote Expiring Soon: QT-2026-0183",
          emailBody:
            "Quote QT-2026-0183 for customer Globex Industries ($47,500) expires in 3 days on March 6, 2026. Please follow up with the customer to secure the order or extend the quote validity.",
          pushText: "Quote QT-2026-0183 for Globex Industries expires in 3 days.",
          inAppTitle: "Quote Expiring Soon",
          inAppText:
            "QT-2026-0183 for Globex Industries ($47,500) expires on March 6, 2026. Follow up promptly.",
        },
      },
      {
        id: "qt-2",
        title: "Quote Expired",
        channels: ["email", "in-app"],
        description:
          "Sent when a quote has passed its expiration date and requires renewal or archival.",
        enabled: true,
        whoReceivesDescription:
          "The Sales Representative who created the quote and the Sales Manager are notified to decide whether to renew or archive the expired quote.",
        preview: {
          emailSubject: "Quote Expired: QT-2026-0167",
          emailBody:
            "Quote QT-2026-0167 for customer Meridian Corp ($31,200) expired on February 28, 2026. The quote is no longer valid for order conversion. Please contact the customer to renew the quote with updated pricing or archive it if no longer needed.",
          pushText: "Quote QT-2026-0167 for Meridian Corp has expired.",
          inAppTitle: "Quote Expired",
          inAppText:
            "QT-2026-0167 for Meridian Corp ($31,200) expired on Feb 28, 2026. Renew or archive.",
        },
      },
      {
        id: "qt-3",
        title: "Quote Item Made Inactive",
        channels: ["email", "in-app", "push"],
        description:
          "Sent when a product in an active quote is discontinued and needs replacement.",
        enabled: true,
        whoReceivesDescription:
          "The Sales Representative who created the quote is notified to replace the discontinued item before the quote is sent or converted to an order.",
        preview: {
          emailSubject: "Quote Item Discontinued: SKU-4820 in QT-2026-0195",
          emailBody:
            "Item SKU-4820 (Widget Pro X200) included in active quote QT-2026-0195 for Apex Manufacturing has been discontinued. This item can no longer be fulfilled. Please update the quote with a replacement product before sending to the customer.",
          pushText: "SKU-4820 in quote QT-2026-0195 has been discontinued. Replace it.",
          inAppTitle: "Quote Item Discontinued",
          inAppText:
            "SKU-4820 (Widget Pro X200) in QT-2026-0195 is discontinued. Update the quote with a replacement.",
        },
      },
    ],
  },
  {
    moduleId: "sales-orders",
    name: "Sales Orders",
    description: "Set alerts for order creation, changes, and fulfillment status.",
    categoryKey: "supply-chain",
    icon: ShoppingBag,
    hasAlerts: true,
    alerts: [
      {
        id: "so-1",
        title: "Sales Order Cancelled",
        channels: ["email", "in-app"],
        description:
          "Sent when a sales order is cancelled. Notifies relevant stakeholders of cancellation reason and order details.",
        enabled: true,
        whoReceivesDescription:
          "The sales representative who created the order and the assigned warehouse manager are notified automatically.",
        preview: {
          emailSubject: "Sales Order Cancelled: SO-2024-0847",
          emailBody:
            "Sales Order SO-2024-0847 for customer Globex Industries has been cancelled. Please ensure all related fulfillment activities are halted.",
          pushText: "Sales Order SO-2024-0847 has been cancelled.",
          inAppTitle: "Order Cancelled",
          inAppText:
            "Sales Order SO-2024-0847 for Globex Industries has been cancelled.",
        },
      },
      {
        id: "so-2",
        title: "Insufficient Inventory for Order",
        channels: ["email", "in-app", "push"],
        description: "Sent when required inventory is unavailable to fulfill an order.",
        enabled: false,
        whoReceivesDescription:
          "The purchasing team and warehouse manager are notified automatically to arrange stock replenishment.",
        preview: {
          emailSubject: "Insufficient Inventory: SO-2024-0912",
          emailBody:
            "Sales Order SO-2024-0912 requires 500 units of Widget Pro X200, but only 120 are available. Please arrange replenishment or contact the customer.",
          pushText: "Insufficient inventory for SO-2024-0912.",
          inAppTitle: "Inventory Shortage",
          inAppText:
            "Sales Order SO-2024-0912 cannot be fulfilled. Only 120 of 500 required units are available.",
        },
      },
    ],
  },
  {
    moduleId: "purchase-orders",
    name: "Purchase Orders",
    description: "Configure alerts for PO creation, approval, and delivery updates.",
    categoryKey: "supply-chain",
    icon: ShoppingCart,
    hasAlerts: true,
    alerts: [
      {
        id: "po-1",
        title: "Complete Your Purchase Order",
        channels: ["email", "in-app"],
        description:
          "Sent when items remain in your PO cart without being converted to a purchase order.",
        enabled: true,
        whoReceivesDescription:
          "The Procurement Specialist who added items to the PO cart is notified automatically to complete or discard the pending order.",
        preview: {
          emailSubject: "Incomplete Purchase Order: PO Cart Has Pending Items",
          emailBody:
            "You have 8 items totalling $12,450 sitting in your PO cart that haven't been converted to a purchase order. Please review and submit or remove these items to keep your procurement pipeline current.",
          pushText: "You have pending items in your PO cart. Complete your purchase order.",
          inAppTitle: "PO Cart Pending",
          inAppText:
            "8 items ($12,450) are in your PO cart without a purchase order. Review and submit.",
        },
      },
      {
        id: "po-2",
        title: "Purchase Order Cancelled",
        channels: ["email", "in-app"],
        description: "Sent when a purchase order is cancelled in the system.",
        enabled: true,
        whoReceivesDescription:
          "The Procurement Manager who created the order and the assigned Warehouse Receiving team are notified automatically.",
        preview: {
          emailSubject: "Purchase Order Cancelled: PO-2026-0394",
          emailBody:
            "Purchase order PO-2026-0394 for vendor Apex Industrial Supply has been cancelled. 14 line items totalling $28,750 have been removed from the procurement pipeline. Please update any dependent plans accordingly.",
          pushText: "Purchase order PO-2026-0394 has been cancelled.",
          inAppTitle: "PO Cancelled",
          inAppText:
            "Purchase order PO-2026-0394 for Apex Industrial Supply has been cancelled. 14 items ($28,750) removed.",
        },
      },
      {
        id: "po-3",
        title: "Received More Than Ordered",
        channels: ["email", "in-app", "push"],
        description:
          "Sent when warehouse receives more items than specified in the purchase order.",
        enabled: true,
        whoReceivesDescription:
          "The Procurement Manager and Warehouse Receiving Supervisor are notified to review the over-receipt and determine disposition.",
        preview: {
          emailSubject: "Over-Receipt Detected: PO-2026-0412, SKU-3380",
          emailBody:
            "Purchase order PO-2026-0412 specified 200 units of SKU-3380 (Stainless Steel Bracket), but 245 units were received at Warehouse East Dock 3. The excess 45 units require disposition. Please review and approve or arrange a return.",
          pushText: "Over-receipt on PO-2026-0412: 245 of 200 units received for SKU-3380.",
          inAppTitle: "Over-Receipt Detected",
          inAppText:
            "PO-2026-0412: 245 of 200 ordered units received for SKU-3380. Review excess disposition.",
        },
      },
      {
        id: "po-4",
        title: "Damaged Items Received",
        channels: ["email", "in-app", "push"],
        description:
          "Sent when damage is discovered during receiving inspection of delivered items.",
        enabled: true,
        whoReceivesDescription:
          "The Procurement Manager and Quality Inspector are notified to document the damage and initiate a vendor claim or return.",
        preview: {
          emailSubject: "Damaged Items Received: PO-2026-0419, SKU-5102",
          emailBody:
            "During receiving inspection of PO-2026-0419 at Dock 2, 12 units of SKU-5102 (Hydraulic Pump Assembly) were found with visible damage: crushed packaging and fluid leakage detected. Photos have been attached to the receiving record. Please initiate a vendor claim.",
          pushText: "Damaged items found on PO-2026-0419: 12 units of SKU-5102.",
          inAppTitle: "Damaged Items Received",
          inAppText:
            "12 units of SKU-5102 received damaged on PO-2026-0419. Crushed packaging and fluid leakage detected.",
        },
      },
      {
        id: "po-5",
        title: "Delivery Past Due Date",
        channels: ["email", "in-app"],
        description:
          "Sent when the expected delivery date has passed without receiving confirmation.",
        enabled: false,
        whoReceivesDescription:
          "The Procurement Manager who placed the order is notified to follow up with the vendor and update the expected delivery timeline.",
        preview: {
          emailSubject: "Delivery Overdue: PO-2026-0388",
          emailBody:
            "Purchase order PO-2026-0388 from vendor Meridian Components was expected to arrive on Feb 28, 2026 but no receiving confirmation has been recorded. The order contains 6 line items totalling $19,200. Please follow up with the vendor.",
          pushText: "PO-2026-0388 delivery is past due. No receiving confirmation yet.",
          inAppTitle: "Delivery Past Due",
          inAppText:
            "PO-2026-0388 expected Feb 28, 2026 has not been received. Follow up with Meridian Components.",
        },
      },
    ],
  },
  {
    moduleId: "receiving-documents",
    name: "Receiving Documents",
    description:
      "Set alerts for receipt confirmations and discrepancy notifications.",
    categoryKey: "supply-chain",
    icon: FileText,
    hasAlerts: true,
    alerts: [
      {
        id: "recv-1",
        title: "Over Receipt on Delivery",
        channels: ["email", "in-app", "push"],
        description:
          "Sent when a warehouse worker completes a receipt and the received quantity exceeds the PO line item quantity.",
        enabled: true,
        whoReceivesDescription:
          "The Procurement Manager and Warehouse Manager are notified to review the over-receipt and determine the appropriate action.",
        preview: {
          emailSubject: "Over-Receipt Detected: PO-2026-0412, SKU-3380",
          emailBody:
            "Purchase order PO-2026-0412 specified 200 units of SKU-3380 (Stainless Steel Bracket), but 245 units were received at Warehouse East Dock 3. The excess 45 units require disposition. Please review and approve or arrange a return.",
          pushText: "Over-receipt on PO-2026-0412: 245 of 200 units received for SKU-3380.",
          inAppTitle: "Over-Receipt Detected",
          inAppText:
            "PO-2026-0412: 245 of 200 ordered units received for SKU-3380. Review excess disposition.",
        },
      },
      {
        id: "recv-2",
        title: "Item Mismatch on Receipt",
        channels: ["email", "in-app"],
        description:
          "Sent when a warehouse worker scans an item during receiving and the system cannot match it to any line item on the purchase order.",
        enabled: true,
        whoReceivesDescription:
          "The Warehouse Manager is notified to verify the item or cross-check the purchase order for potential errors.",
        preview: {
          emailSubject: "Item Mismatch During Receiving: PO-2026-0412",
          emailBody:
            "During receiving for PO-2026-0412, item barcode 7891234567890 was scanned but does not match any line item on the purchase order. Please verify the item identity and cross-check the PO for possible errors.",
          pushText: "Item mismatch on PO-2026-0412: scanned barcode not found on PO.",
          inAppTitle: "Item Mismatch Detected",
          inAppText:
            "Scanned barcode 7891234567890 does not match any line item on PO-2026-0412. Verify item or PO.",
        },
      },
      {
        id: "recv-3",
        title: "Lot Quarantined on Receipt",
        channels: ["email", "in-app", "push"],
        description:
          "Sent when a received lot is automatically quarantined based on predefined QC rules or manual inspection results during the receiving process.",
        enabled: true,
        whoReceivesDescription:
          "The Warehouse Manager and Engineering Manager are notified to investigate the quarantine and determine the corrective action.",
        preview: {
          emailSubject: "Lot Quarantined on Receipt: LOT-2026-0058 (SKU-5102)",
          emailBody:
            "Lot LOT-2026-0058 for item SKU-5102 (Hydraulic Pump Assembly) has been quarantined during the receiving process at Warehouse East. QC inspection flagged quality issues. Please investigate and determine corrective action.",
          pushText:
            "Lot LOT-2026-0058 (SKU-5102) quarantined during receiving. Investigation required.",
          inAppTitle: "Lot Quarantined on Receipt",
          inAppText:
            "LOT-2026-0058 for SKU-5102 quarantined during receiving. QC inspection failed. Investigate.",
        },
      },
    ],
  },

  /* ═══ People Management ═══ */
  {
    moduleId: "users",
    name: "Users",
    description:
      "Manage when and how users are notified about user-related activity.",
    categoryKey: "people",
    icon: Users,
    hasAlerts: true,
    alerts: [
      {
        id: "usr-1",
        title: "User Requested New Invitation Link",
        channels: ["email", "in-app"],
        description:
          "Sent when a user's invitation link has expired and they request a new one. The Tenant Admin is notified so they can resend the invitation.",
        enabled: true,
        preview: {
          emailSubject: "New Invitation Link Requested",
          emailBody:
            "User John Doe has requested a new invitation link because the previous one expired. Please review and resend the invitation.",
          pushText: "John Doe requested a new invitation link.",
          inAppTitle: "Invitation Request",
          inAppText: "John Doe has requested a new invitation link.",
        },
      },
      {
        id: "usr-2",
        title: "New Permission Request Submitted",
        channels: ["in-app"],
        description:
          "Sent when a user submits a request for additional permissions or a role change. The Tenant Admin reviews and approves or denies.",
        enabled: true,
        preview: {
          emailSubject: "New Permission Request: John Doe",
          emailBody:
            "John Doe has submitted a request for additional permissions. Please review the request in the admin console.",
          pushText: "New permission request from John Doe.",
          inAppTitle: "Permission Request",
          inAppText: "John Doe has submitted a request for additional permissions.",
        },
      },
      {
        id: "usr-3",
        title: "Pending Task Needs Reassignment",
        channels: ["email", "in-app", "push"],
        description:
          "Sent when a user is archived and their pending tasks are automatically unassigned. Task creators are notified to reassign.",
        enabled: true,
        preview: {
          emailSubject: "Action Required: Pending Tasks for Archived User",
          emailBody:
            "User Jane Smith has been archived. Their pending tasks require reassignment to ensure workflow continuity.",
          pushText: "Pending tasks for Jane Smith need reassignment.",
          inAppTitle: "Tasks Need Reassignment",
          inAppText:
            "User Jane Smith has been archived. Reassign their pending tasks.",
        },
      },
      {
        id: "usr-4",
        title: "License Upgraded for User",
        channels: ["email"],
        description:
          "Sent when a user's license is upgraded to Full Access. Admins are notified of the billing impact.",
        enabled: false,
        preview: {
          emailSubject: "License Upgraded: John Doe",
          emailBody:
            "The license for user John Doe has been upgraded to Full Access. This may impact your billing.",
          pushText: "John Doe's license was upgraded to Full Access.",
          inAppTitle: "License Upgraded",
          inAppText: "John Doe's license has been upgraded to Full Access.",
        },
      },
      {
        id: "usr-5",
        title: "Profile Updated by Admin",
        channels: ["email", "in-app"],
        description:
          "Sent to a user when an administrator makes changes to their profile so they're aware of the modification.",
        enabled: true,
        isMandatory: true,
        preview: {
          emailSubject: "Your Profile Has Been Updated",
          emailBody:
            "An administrator has updated your profile details. Please review the changes in your account settings.",
          pushText: "Your profile was updated by an administrator.",
          inAppTitle: "Profile Updated",
          inAppText: "An administrator has updated your profile details.",
        },
      },
      {
        id: "usr-6",
        title: "Role Removed from Your Profile",
        channels: ["email", "in-app"],
        description:
          "Sent to a user when an admin removes one of their assigned roles. Warns them about potential permission loss.",
        enabled: true,
        isMandatory: true,
        preview: {
          emailSubject: "Role Removed: Purchasing Agent",
          emailBody:
            "Your Purchasing Agent role has been removed by an administrator. You may no longer have access to features associated with this role.",
          pushText: "Purchasing Agent role removed from your profile.",
          inAppTitle: "Role Removed",
          inAppText:
            "Your Purchasing Agent role has been removed by an administrator.",
        },
      },
    ],
  },
  {
    moduleId: "invite-requests",
    name: "Invite Requests",
    description:
      "Configure alerts for invitation status changes and expiration notices.",
    categoryKey: "people",
    icon: Send,
    hasAlerts: false,
    alerts: [],
  },
];

/** The alerts catalog: 19 modules in listing order, with role attribution filled in. */
export const ALERT_MODULES: AlertModuleDefinition[] = RAW_MODULES.map((m) => ({
  ...m,
  alerts: m.alerts.map((a) => ({ ...a, assignedThroughRoles: rolesForAlert(a.title) })),
}));

/* ─── Lookups ─── */

/** moduleId → module definition */
export const ALERT_MODULES_LOOKUP: Record<string, AlertModuleDefinition> =
  ALERT_MODULES.reduce(
    (acc, m) => {
      acc[m.moduleId] = m;
      return acc;
    },
    {} as Record<string, AlertModuleDefinition>,
  );

/** alert id → the moduleId that alert belongs to */
export const ALERT_ID_TO_MODULE_ID: Record<string, string> = {};
ALERT_MODULES.forEach((m) => {
  m.alerts.forEach((a) => {
    ALERT_ID_TO_MODULE_ID[a.id] = m.moduleId;
  });
});

/** Every alert in the catalog, in module order. */
export const ALL_ALERTS: AlertDefinition[] = ALERT_MODULES.flatMap((m) => m.alerts);

/** The alerts defined for a module. Empty for "Coming soon" modules. */
export function getModuleAlerts(moduleId: string): AlertDefinition[] {
  return ALERT_MODULES_LOOKUP[moduleId]?.alerts ?? [];
}

/** Total alerts available for a module. */
export function getTotalAlertCount(moduleId: string): number {
  return getModuleAlerts(moduleId).length;
}

/** Alerts enabled by default for a module (account-level defaults). */
export function getEnabledAlertCount(moduleId: string): number {
  return getModuleAlerts(moduleId).filter((a) => a.enabled).length;
}

/* ─── Dev-only integrity checks ─── */
if (import.meta.env?.DEV) {
  const categoryKeys = new Set(ALERT_CATEGORIES.map((c) => c.key));
  const orphanCategories = ALERT_MODULES.filter((m) => !categoryKeys.has(m.categoryKey));
  if (orphanCategories.length) {
    // eslint-disable-next-line no-console
    console.warn(
      "[alerts-data] Modules pointing at an unknown category:",
      orphanCategories.map((m) => m.moduleId),
    );
  }

  const mismatched = ALERT_MODULES.filter((m) => m.hasAlerts !== (m.alerts.length > 0));
  if (mismatched.length) {
    // eslint-disable-next-line no-console
    console.warn(
      "[alerts-data] hasAlerts disagrees with the alert list:",
      mismatched.map((m) => m.moduleId),
    );
  }

  const seen = new Set<string>();
  const dupes = ALL_ALERTS.filter((a) => (seen.has(a.id) ? true : (seen.add(a.id), false)));
  if (dupes.length) {
    // eslint-disable-next-line no-console
    console.warn("[alerts-data] Duplicate alert ids:", dupes.map((a) => a.id));
  }
}
