import type { LucideIcon } from "lucide-react";
import {
  Package,
  FolderTree,
  RefreshCw,
  Ruler,
  Warehouse,
  MapPin,
  ShoppingCart,
  PackageCheck,
  ArrowLeftRight,
  Truck,
  FileText,
  Receipt,
  Users,
  UserCog,
  ShieldCheck,
  Building2,
  Contact,
  SlidersHorizontal,
  Settings2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type PermissionCategory =
  | "Module access"
  | "Financial visibility"
  | "Item management"
  | "Financial editing"
  | "Inventory thresholds"
  | "Vendor assignment"
  | "Lifecycle management"
  | "Catalog administration"
  | "Configuration"
  | "Pricing configuration"
  | "Financial configuration"
  | "Destructive action"
  | "Floor operations"
  | "Elevated authority"
  | "Document management"
  | "Approval authority"
  | "Workflow management"
  | "Data management"
  | "Security policy"
  | "Access governance"
  | "Record management"
  | "Task execution"
  | "Adjustment authority"
  | "Partner management"
  | "Location management"
  | "Commercial configuration"
  | "Cross-module trigger"
  | "Post-approval editing"
  | "Unplanned operations"
  | "Post-confirmation editing"
  | "Reversal authority"
  | "Dispatch operations"
  | "Exception handling"
  | "Label generation"
  | "Cross-user editing"
  | "Shipment planning"
  | "PO management"
  | "Quote management"
  | "Quote lifecycle"
  | "Documents"
  | "Pricing"
  | "Workflow"
  | "Order creation"
  | "Status management"
  | "Inventory allocation"
  | "Fulfillment tracking"
  | "Shipment visibility"
  | "Cross-module authority"
  | "Order operations"
  | "User administration"
  | "License management"
  | "Role management"
  | "Policy administration"
  | "Mobile operations"
  | "Inventory adjustment"
  // ── v0.9 additions ──
  | "Planning and administration"
  | "Financial authorization"
  | "Full administration"
  | "Structure, facility level"
  | "Structure, local"
  | "Elevated procurement"
  | "Bulk operation"
  | "Core receiving action"
  | "Order management"
  | "Workflow gate"
  | "Partner group management"
  | "Contact management"
  | "Access control"
  | "Core receipt capture"
  // ── Physical Inventory quarantine addition ──
  | "Inventory control"
  // ── Users and Roles v1.3: deactivate split out of the bundled Archive user ──
  | "User lifecycle"
  // ── General Settings (ERP-7228) ──
  | "Tenant configuration"
  | "Billing authority";


export type ThresholdType = "monetary" | "percentage" | "quantity" | "descriptive";

export interface ThresholdConfig {
  type: ThresholdType;
  label: string;
  description: string;
  unit: string;
  unitPosition: "prefix" | "suffix";
  helperText: string;
  /** Default value shown in the input (numeric string, or empty for "No limit") */
  defaultValue?: string;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  category: PermissionCategory;
  whatItGrants: string;
  whenToRestrict: string;
  scope: string | null; // null = no scope configuration
  defaultEnabled: boolean;
  /** If present, this permission supports configurable thresholds */
  thresholdConfig?: ThresholdConfig;
  /** Platform this permission applies to. Absent = "web". A "both" permission is
   *  a single capability that spans web and the mobile app at once, web and the
   *  mobile apps run on the same API, so there are no separate mobile toggles.
   *  Combined modules (Cycle Count, Physical Inventory, Inventory Movement, and
   *  the shared Receiving permissions) tag their permissions "both"; granting or
   *  removing one applies to web and mobile together. The card shows both the web
   *  and mobile platform icons. */
  platform?: "web" | "mobile" | "both";
}

export interface PermissionModule {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  permissions: Permission[];
}

// ─── Category color mapping ─────────────────────────────────────────────────

export const CATEGORY_COLORS: Record<PermissionCategory, { bg: string; text: string; border: string }> = {
  "Module access":          { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
  "Financial visibility":   { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A" },
  "Item management":        { bg: "#F0FDF4", text: "#15803D", border: "#BBF7D0" },
  "Financial editing":      { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA" },
  "Inventory thresholds":   { bg: "#FAF5FF", text: "#7E22CE", border: "#E9D5FF" },
  "Vendor assignment":      { bg: "#F0FDFA", text: "#0F766E", border: "#99F6E4" },
  "Lifecycle management":   { bg: "#FFF1F2", text: "#BE123C", border: "#FECDD3" },
  "Catalog administration": { bg: "#EEF2FF", text: "#4338CA", border: "#C7D2FE" },
  "Configuration":          { bg: "#F8FAFC", text: "#475569", border: "#CBD5E1" },
  "Pricing configuration":  { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0" },
  "Financial configuration":{ bg: "#FFF1F2", text: "#9F1239", border: "#FECDD3" },
  "Destructive action":     { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" },
  "Floor operations":       { bg: "#ECFEFF", text: "#0E7490", border: "#A5F3FC" },
  "Elevated authority":     { bg: "#F5F3FF", text: "#6D28D9", border: "#DDD6FE" },
  "Document management":    { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE" },
  "Approval authority":     { bg: "#FDF4FF", text: "#A21CAF", border: "#F0ABFC" },
  "Workflow management":    { bg: "#F0F9FF", text: "#0369A1", border: "#BAE6FD" },
  "Data management":        { bg: "#F8FAFC", text: "#334155", border: "#E2E8F0" },
  "Security policy":        { bg: "#FEF9C3", text: "#854D0E", border: "#FDE047" },
  "Access governance":      { bg: "#F5F3FF", text: "#5B21B6", border: "#DDD6FE" },
  "Record management":      { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
  "Task execution":         { bg: "#F0F9FF", text: "#075985", border: "#BAE6FD" },
  "Adjustment authority":   { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  "Partner management":     { bg: "#FFF7ED", text: "#9A3412", border: "#FDBA74" },
  "Location management":    { bg: "#ECFEFF", text: "#155E75", border: "#A5F3FC" },
  "Commercial configuration": { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0" },
  "Cross-module trigger":   { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE" },
  "Post-approval editing":  { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA" },
  "Unplanned operations":   { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  "Post-confirmation editing": { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA" },
  "Reversal authority":     { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" },
  "Dispatch operations":    { bg: "#F0F9FF", text: "#0369A1", border: "#BAE6FD" },
  "Exception handling":     { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A" },
  "Label generation":       { bg: "#F8FAFC", text: "#475569", border: "#CBD5E1" },
  "Cross-user editing":     { bg: "#F5F3FF", text: "#6D28D9", border: "#DDD6FE" },
  "Shipment planning":      { bg: "#F0F9FF", text: "#075985", border: "#BAE6FD" },
  "PO management":          { bg: "#F0F9FF", text: "#0369A1", border: "#BAE6FD" },
  "Quote management":       { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
  "Quote lifecycle":        { bg: "#FFF7ED", text: "#9A3412", border: "#FDBA74" },
  "Documents":              { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE" },
  "Pricing":                { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0" },
  "Workflow":               { bg: "#F0F9FF", text: "#0369A1", border: "#BAE6FD" },
  "Order creation":         { bg: "#F0FDF4", text: "#15803D", border: "#BBF7D0" },
  "Status management":      { bg: "#FDF4FF", text: "#A21CAF", border: "#F0ABFC" },
  "Inventory allocation":   { bg: "#FAF5FF", text: "#7E22CE", border: "#E9D5FF" },
  "Fulfillment tracking":   { bg: "#F0F9FF", text: "#075985", border: "#BAE6FD" },
  "Shipment visibility":    { bg: "#ECFEFF", text: "#0E7490", border: "#A5F3FC" },
  "Cross-module authority":  { bg: "#F5F3FF", text: "#6D28D9", border: "#DDD6FE" },
  "Order operations":       { bg: "#F8FAFC", text: "#475569", border: "#CBD5E1" },
  "User administration":    { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE" },
  "License management":     { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A" },
  "Role management":        { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
  "Policy administration":  { bg: "#FDF4FF", text: "#A21CAF", border: "#F0ABFC" },
  "Mobile operations":      { bg: "#F0F9FF", text: "#0369A1", border: "#BAE6FD" },
  "Inventory adjustment":   { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA" },
  // ── v0.9 additions ──
  "Planning and administration": { bg: "#F0F9FF", text: "#0369A1", border: "#BAE6FD" },
  "Financial authorization": { bg: "#FFF1F2", text: "#9F1239", border: "#FECDD3" },
  "Full administration":    { bg: "#F8FAFC", text: "#475569", border: "#CBD5E1" },
  "Structure, facility level": { bg: "#ECFEFF", text: "#155E75", border: "#A5F3FC" },
  "Structure, local":       { bg: "#ECFEFF", text: "#0E7490", border: "#A5F3FC" },
  "Elevated procurement":   { bg: "#F5F3FF", text: "#6D28D9", border: "#DDD6FE" },
  "Bulk operation":         { bg: "#EEF2FF", text: "#4338CA", border: "#C7D2FE" },
  "Core receiving action":  { bg: "#ECFEFF", text: "#0E7490", border: "#A5F3FC" },
  "Order management":       { bg: "#F0FDF4", text: "#15803D", border: "#BBF7D0" },
  "Workflow gate":          { bg: "#F0F9FF", text: "#0369A1", border: "#BAE6FD" },
  "Partner group management": { bg: "#FFF7ED", text: "#9A3412", border: "#FDBA74" },
  "Contact management":     { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE" },
  "Access control":         { bg: "#F5F3FF", text: "#5B21B6", border: "#DDD6FE" },
  "Core receipt capture":   { bg: "#ECFEFF", text: "#0E7490", border: "#A5F3FC" },
  // ── Physical Inventory quarantine addition ──
  "Inventory control":      { bg: "#ECFEFF", text: "#155E75", border: "#A5F3FC" },
  // ── Users and Roles v1.3 ──
  "User lifecycle":         { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A" },
  // ── General Settings (ERP-7228) ──
  "Tenant configuration":   { bg: "#F8FAFC", text: "#475569", border: "#CBD5E1" },
  "Billing authority":      { bg: "#FFF1F2", text: "#9F1239", border: "#FECDD3" },
};

// ─── Module Definitions ─────────────────────────────────────────────────────

export const PERMISSION_MODULES: PermissionModule[] = [
  // 1. Item Library: 9 permissions (ERP-5537, 13 Aug 26)
  //    Item configuration folded into Create and edit items, and the selling
  //    price moved onto Edit item pricing, which retired the separate
  //    Manage item configuration and Edit item cost permissions.
  {
    id: "item-library",
    name: "Item Library",
    description: "Item catalog management, cost visibility, and vendor assignments",
    icon: Package,
    permissions: [
      {
        id: "item-access",
        name: "Access Items Module",
        description: "The master gate for the Items module: without it the module cannot be opened.",
        category: "Module access",
        whatItGrants: "The user can open and browse the Items module and its item records. Item identity fields still render for everyone on purchase orders, sales orders, quotes, and shipments, so this governs the catalog itself and nothing else.",
        whenToRestrict: "Only for roles with no reason to open the catalog, an HR role for instance.",
        scope: null,
        defaultEnabled: false,
      },
      {
        id: "item-view-cost",
        name: "View Cost and Pricing Data",
        description: "Controls visibility of an item's cost and pricing figures. Item data only: pricing on shipments, quote pricing, sales order pricing, and inventory valuation each have their own permission and are unaffected by this one.",
        category: "Financial visibility",
        whatItGrants: "The user can see an item's selling price, configured purchasing price, last purchase price, open PO value, and the Sales tab revenue figures, on the item record and in any other Items screen, export, or printed document.",
        whenToRestrict: "For roles that should not see margins, warehouse operators for instance. Turn it on for procurement managers, finance, and senior leadership.",
        scope: "Follows item category scope. Item cost and pricing fields only, the money visibility in other modules is governed by their own permissions.",
        defaultEnabled: false,
      },
      {
        id: "item-create-edit",
        name: "Create and Edit Items",
        description: "Administrative authority over an item's identity and configuration. Reorder point and maximum stock quantity are not included, they need Edit min/max stock levels.",
        category: "Item management",
        whatItGrants: "The user can add new items and edit basic information (part number, description, tags), item-level attachments, and item configuration: inventory type, control type, lot tracking, base and alternative unit of measure, acquisition method, inbound and outbound default locations, and selling scope.",
        whenToRestrict: "For operational roles that should not touch master item data. Warehouse staff and sales reps who reference item records should not be creating or modifying them.",
        scope: "All items and categories. Restrict to specific categories. Covers identity fields, attachments, and configuration.",
        defaultEnabled: false,
      },
      {
        id: "item-edit-minmax",
        name: "Edit Min/Max Stock Levels",
        description: "Controls who can move the reorder thresholds that drive replenishment. Held separately from Create and edit items, which cannot touch these two values.",
        category: "Inventory thresholds",
        whatItGrants: "The user can edit the reorder point and the maximum stock quantity. These two numbers decide when the system asks you to buy more.",
        whenToRestrict: "Restrict for personnel who should not have the ability to manage stock of items. The person responding to a reorder signal should not be the one who sets the threshold that fires it.",
        scope: "Follows item category scope.",
        defaultEnabled: false,
      },
      {
        id: "item-manage-vendors",
        name: "Manage Vendor Qualification",
        description: "Controls who can decide which vendors are approved to supply which items. The item-vendor qualification list is one global record, viewed from two sides: the qualified vendor list on an item, and qualification directly on the partner.",
        category: "Vendor assignment",
        whatItGrants: "The user can add, edit, and remove item-vendor qualification links from either side: vendors on an item's qualified vendor list, or items on a vendor. This is one permission with one state, so turning it on or off in either module permission set changes it in both.",
        whenToRestrict: "Keep it on for procurement managers who own supplier relationships. Restrict sales, warehouse, and engineering roles.",
        scope: "Follows item category scope.",
        defaultEnabled: false,
      },
      {
        id: "item-archive",
        name: "Archive/Deactivate Items",
        description: "Lifecycle restriction control. Both actions affect every workflow that references the item.",
        category: "Lifecycle management",
        whatItGrants: "The user can archive an item, which removes it from active use and preserves its history, or deactivate it, which makes it unavailable for new transactions.",
        whenToRestrict: "Restrict for everyone except item administrators, and verify there are no active dependencies first.",
        scope: "Follows item category scope.",
        defaultEnabled: false,
      },
      {
        id: "item-bulk-import",
        name: "Bulk Import/Mass Edit",
        description: "Authority to change many item records in one operation. A single error propagates across every record in the batch.",
        category: "Catalog administration",
        whatItGrants: "The user can import items and apply mass edits across multiple records at once.",
        whenToRestrict: "Restrict for roles that should not have the ability to manage items. The person who creates individual items is not the one who should run catalog-wide imports.",
        scope: "All items and categories. Restrict to specific categories.",
        defaultEnabled: false,
      },
      {
        id: "item-manage-pricing",
        name: "Edit Item Pricing",
        description: "Controls an item's selling-side pricing.",
        category: "Pricing configuration",
        whatItGrants: "The user can set the item's selling price, custom price per unit, price points, and partner-specific pricing.",
        whenToRestrict: "Restrict for any role outside sales and finance.",
        scope: "Follows item category scope. Covers selling price, custom price per unit, price points, and partner-specific pricing.",
        defaultEnabled: false,
      },
      {
        id: "item-valuation-method",
        name: "Manage Inventory Valuation Method",
        description: "Controls the system-wide accounting method used to value inventory, not a per-item setting.",
        category: "Financial configuration",
        whatItGrants: "The user can change the costing method between FIFO, LIFO, WAC, and Specific Identification. The setting is system wide, and changing it part-way through a cycle moves reported cost of goods sold.",
        whenToRestrict: "Usually restricted for all roles except finance or accounting. This is not an operational decision.",
        scope: "System-wide. Costing method changes affect COGS and balance sheet across all items and modules.",
        defaultEnabled: false,
      },
    ],
  },

  // 2. Item Categories: 3 permissions
  {
    id: "item-categories",
    name: "Item Categories",
    description: "Category structure and bulk operations",
    icon: FolderTree,
    permissions: [
      {
        id: "cat-access",
        name: "Access Categories Module",
        description: "The master gate for the Categories module; without it the module can't be opened.",
        category: "Module access",
        whatItGrants: "Grants access to the module's listing and detail pages. Without it, the module is not accessible. All tabs are view only.",
        whenToRestrict: "Off for all operational roles. Category management is administrative work for a small group. Users without this permission can still view category data in context within other modules, for example category name or code in the item listing or on partners.",
        scope: null,
        defaultEnabled: false,
      },
      {
        id: "cat-create-edit",
        name: "Create/Edit/Deactivate Categories",
        description: "Controls whether a user can author, modify, and retire category records.",
        category: "Catalog administration",
        whatItGrants: "Grants the ability to create, edit, and deactivate categories. In the edit case, changes save at the category level only, with no bulk push to items. In the deactivate case, a category can be deactivated only if no mass actions are required, i.e. the category has no items using it as primary. Without this permission, categories are read only. This also grants the ability to manage attachments on a category.",
        whenToRestrict: "Off for roles that use categories for filtering but do not own the taxonomy.",
        scope: "All categories. Covers category attachments.",
        defaultEnabled: false,
      },
      {
        id: "cat-bulk-ops",
        name: "Bulk Actions Through Categories",
        description: "Controls whether category-level changes can be pushed down to the items in that category.",
        category: "Catalog administration",
        whatItGrants: "Grants the ability to perform the following bulk actions: a) in the case of edit, push configuration changes to items from editing a category; b) in the case of deactivation, reassign items to a new primary category and push the new category's config to those items.",
        whenToRestrict: "Catalog administrators only. Editing a single category's metadata carries a very different risk profile from pushing a change to hundreds of live items at once. That is execution, not configuration, which is why this is kept separate from Create/Edit/Deactivate Categories.",
        scope: "All categories.",
        defaultEnabled: false,
      },
    ],
  },

  // 3. Cycle Count: 4 permissions
  {
    id: "cycle-count",
    name: "Cycle Count",
    description: "Count planning, execution, and inventory adjustments",
    icon: RefreshCw,
    permissions: [
      {
        id: "cc-access",
        name: "Access Cycle Count Module",
        description: "The master gate for Cycle Count; without it the module can't be opened on either surface.",
        category: "Module access",
        whatItGrants: "The user can open the module and view count records, count history, attachments, and count detail. It also grants view-only access to everything in the module, including fields that come from other modules. This applies to both the main listing and the detail pages.",
        whenToRestrict: "Only for roles with no reason to see counts.",
        scope: "All items and categories.",
        defaultEnabled: true,
        platform: "both",
      },
      {
        id: "cc-create-plan",
        name: "Create and Edit Cycle Counts",
        description: "Controls who can plan counts and decide the fate of a submitted count.",
        category: "Planning and administration",
        whatItGrants: "The user can create a count plan, attach and delete attachments at the plan level, edit its parameters before execution, and reject a submitted count (send for recount or keep the system count).",
        whenToRestrict: "Restrict for floor operation roles that execute but should not plan counts.",
        scope: "Follows category scope.",
        defaultEnabled: false,
        platform: "both",
      },
      {
        id: "cc-execute",
        name: "Execute Cycle Counts",
        description: "Controls who can perform the physical count on the floor.",
        category: "Floor operations",
        whatItGrants: "The user can start a count session, enter physical quantities, attach files, edit their own submitted count while it is Awaiting Approval, and submit results. Cannot approve or adjust.",
        whenToRestrict: "For planning and approval roles that should not enter counts themselves.",
        scope: "Follows category scope.",
        defaultEnabled: true,
        platform: "both",
      },
      {
        id: "cc-adjust",
        name: "Approve Counts and Adjust Inventory",
        description: "The financial authority to accept a count and book the resulting inventory adjustment.",
        category: "Financial authorization",
        whatItGrants: "The user can approve a submitted count, edit valuation for a new serial, and create the resulting inventory adjustment. This is the only action that writes an adjustment.",
        whenToRestrict: "For everyone except roles trusted with inventory financial authority; keep separate from whoever executes counts.",
        scope: "Follows category scope.",
        defaultEnabled: false,
        platform: "both",
      },
    ],
  },

  // 4. Unit of Measure: 2 permissions
  {
    id: "unit-of-measure",
    name: "Unit of Measure",
    description: "Unit of measure administration",
    icon: Ruler,
    permissions: [
      {
        id: "uom-access",
        name: "Access UOM Module",
        description: "The master gate for the Unit of Measure table: without it the table cannot be opened, though unit and conversion values still render on items, POs, receipts, movements, and every transaction that references a unit.",
        category: "Module access",
        whatItGrants: "The user can open the Unit of Measure table in read state.",
        whenToRestrict: "Rarely restricted. Only for roles with no reason to open the UOM table.",
        scope: null,
        defaultEnabled: true,
      },
      {
        id: "uom-manage",
        name: "Manage Units of Measure",
        description: "Controls who can change the units and conversion rules the whole system relies on.",
        category: "Configuration",
        whatItGrants: "The user can create, edit, archive, import, and export units of measure and conversion rules. No subset is separately gated.",
        whenToRestrict: "Restrict for all roles except those who maintain the UOM master: conversion changes ripple across every item and transaction.",
        scope: "All units and conversion categories.",
        defaultEnabled: false,
      },
    ],
  },

  // 5. Physical Inventory: 6 permissions. ERP-11305 (12 Nov 2026) adds Bulk
  // Import and Bulk Export Physical Inventory (Eli, 3 and 5 Nov 2026) and
  // turns View Inventory Valuation Data on by default (Eli, 8 Nov 2026).
  {
    id: "physical-inventory",
    name: "Physical Inventory",
    description: "Inventory records, valuations, and manual adjustments",
    icon: Warehouse,
    permissions: [
      {
        id: "pi-access",
        name: "Access Physical Inventory Module",
        description: "The master gate for the Physical Inventory module: without it the module cannot be opened on either surface.",
        category: "Module access",
        whatItGrants: "The user can open Physical Inventory and see live stock levels, the analytics dashboard, transaction history, location breakdown, serial units, and attachments. Stock quantity data on sales orders, purchase orders, and shipments flows through regardless, so a sales rep can see stock availability on an order without needing access to this module.",
        whenToRestrict: "Default on for any role that needs stock visibility. Off for office-based staff and finance-only roles who access inventory value through reports rather than directly browsing stock.",
        scope: "All items and categories.",
        defaultEnabled: true,
        platform: "both",
      },
      {
        id: "pi-view-valuation",
        name: "View Inventory Valuation Data",
        description: "Financial visibility control for the cost-based fields shown against stock.",
        category: "Financial visibility",
        whatItGrants: "The user can see the cost-based fields on Physical Inventory: stock value, average unit cost, total on-hand value, and the analytics views that surface those numbers. The cross-module rule applies, so denying this holds everywhere in the system, not only on Physical Inventory.",
        whenToRestrict: "On by default for Full Access roles. Turn it off for warehouse operators and receiving staff who need quantities but not values. A Field User role can't hold it, so it stays off there.",
        scope: "Follows access scope. Cross-module: valuation visibility is removed across all modules. A user with Adjust Inventory still enters Price Per Unit on an adjustment without it.",
        defaultEnabled: true,
        platform: "both",
      },
      {
        id: "pi-adjust",
        name: "Adjust Inventory",
        description: "Authority to record on-hand adjustments outside the receiving and fulfillment workflows.",
        category: "Inventory adjustment",
        whatItGrants: "The user can record on-hand adjustments outside the receiving and fulfillment workflows, covering both increases and decreases. For serialized items they enter or remove serial numbers individually, each with its own reason and attachments; for non-serialized items they enter the unit count to add or remove. Every adjustment takes a target location and a required reason. Increase and decrease are deliberately one permission: anyone trusted to add stock by hand is also trusted to correct it downward, and splitting them adds configuration overhead with no real control benefit.",
        whenToRestrict: "Off for almost everyone. Inventory managers with explicit adjustment authority only. A receiving operative who processes formal receipts should not have freeform adjustment access outside that workflow.",
        scope: "Location scope. Adjustment threshold applies.",
        defaultEnabled: false,
        thresholdConfig: {
          type: "quantity",
          label: "Adjustment Threshold",
          description: "Set the maximum quantity this user can adjust in a single manual adjustment. Adjustments above this amount will require a secondary review.",
          unit: "units",
          unitPosition: "suffix",
          helperText: "Adjustments above this threshold will be held for supervisor review before posting.",
          defaultValue: "",
        },
        platform: "both",
      },
      {
        id: "pi-quarantine",
        name: "Quarantine and Check Out Inventory",
        description: "Inventory control action that flags units and lots as unavailable without changing the stock figure.",
        category: "Inventory control",
        whatItGrants: "The user can mark serialized units and lot-tracked items as quarantined or checked out, at the unit level and the lot level. Quarantining or checking out part of a lot non-serialized creates a child lot; for a lot serialized item the unit stays in its lot and the lot shows Mixed. Start quarantine, end quarantine, check out, and check in are all bundled under this one permission, since releasing items back to availability is one continuous controlled flow with quarantining and checking out. Bulk variants of each action are governed by the same permission, so there is no separate bulk permission.",
        whenToRestrict: "On by default. Quarantining and checking out do not change inventory; they only flag items as unavailable, and the action is easily reversible. The one damage scenario is limited: a user could quarantine stock unnecessarily, reducing visible availability for other users, for example a buyer sees 90 available instead of 100 because 10 are flagged. This is detectable on the availability context view, where the quarantined count shows alongside on-hand, and is trivially reversible. The action does not remove or destroy stock.",
        scope: null,
        defaultEnabled: true,
        platform: "both",
      },
      {
        id: "pi-bulk-import",
        name: "Bulk Import Physical Inventory",
        description: "Brings stock into Physical Inventory from a template file.",
        category: "Documents",
        whatItGrants: "The user can download the template, upload a file, review and fix rows, and start, complete or cancel an import, in the Physical Inventory module and in Data Import/Export. Without it, Import is hidden and Cancel Import is not shown. It only works with Access Physical Inventory Module or access to Data Import/Export. It does not need Adjust Inventory.",
        whenToRestrict: "A bad file can change stock across many items and locations at once. Keep it to inventory managers running opening balances or migrations.",
        scope: null,
        defaultEnabled: false,
        platform: "web",
      },
      {
        id: "pi-bulk-export",
        name: "Bulk Export Physical Inventory",
        description: "Exports stock records from Physical Inventory.",
        category: "Documents",
        whatItGrants: "The user can export stock data to a file and choose the format and columns, from the Physical Inventory module and in Data Import/Export. Without it, Export is hidden. It only works with Access Physical Inventory Module or access to Data Import/Export. It does not need Adjust Inventory.",
        whenToRestrict: "One export can take every stock level and location out of the system. Keep it to inventory managers and finance.",
        scope: null,
        defaultEnabled: false,
        platform: "web",
      },
    ],
  },

  // 6. Warehouse Locations: 3 permissions
  {
    id: "warehouse-locations",
    name: "Warehouse Locations",
    description: "Warehouse and location structure, facility and bin level.",
    icon: MapPin,
    permissions: [
      {
        id: "wl-access",
        name: "Access Warehouse & Locations",
        description: "The master gate for the module: without it the module cannot be opened.",
        category: "Module access",
        whatItGrants: "The user can open the module and view the warehouse list, location tree, contacts, attachments, and activity log.",
        whenToRestrict: "Only for roles with no reason to open the module.",
        scope: null,
        defaultEnabled: false,
      },
      {
        id: "wl-manage-warehouses",
        name: "Manage Warehouses",
        description: "Controls who can create, edit, or decommission a facility.",
        category: "Structure, facility level",
        whatItGrants: "The user can create, edit, deactivate, reactivate, and archive a warehouse, including its contacts and attachments.",
        whenToRestrict: "For all roles except facility administrators: changing a warehouse affects everything stored under it.",
        scope: null,
        defaultEnabled: false,
      },
      {
        id: "wl-create-edit",
        name: "Manage Locations",
        description: "Controls who can change the storage locations within a warehouse.",
        category: "Structure, local",
        whatItGrants: "The user can create, edit, deactivate, and reactivate a location, including its contacts and attachments. Status is set on the location edit surface and is reversible.",
        whenToRestrict: "For roles that use locations but should not restructure them.",
        scope: null,
        defaultEnabled: false,
      },
    ],
  },

  // 7. Purchase Orders: 8 permissions (ERP-5543, 18 Aug 26). The 18 Aug recut
  //    split Modify pricing rules into Manage Pricing Rules (authorship of the
  //    global rule library, cross-module) and Apply Pricing Rules (attach or
  //    remove a rule on a PO, independent per module), mirroring how Partners
  //    and Partner Group handle it. Approve purchase orders is deferred and is
  //    deliberately NOT seeded: no approval path is built in Pioneer.
  {
    id: "purchase-orders",
    name: "Purchase Orders",
    description: "Purchase order lifecycle from creation to receiving",
    icon: ShoppingCart,
    permissions: [
      {
        id: "po-access",
        name: "Access Purchase Orders Module",
        description: "The master gate for the Purchase Orders module: without it the module cannot be opened.",
        category: "Module access",
        whatItGrants: "The user can view PO records including line items, quantities, delivery dates, vendor details, and history, and can print and download an individual PO.",
        whenToRestrict: "Only for roles with no reason to open the module, HR, sales-only, or finance-only roles for instance.",
        scope: "All items and categories.",
        defaultEnabled: true,
      },
      {
        id: "po-create",
        name: "Create and Edit Purchase Orders",
        description: "Administrative authority over PO creation and lifecycle actions.",
        category: "PO management",
        whatItGrants: "The user can create POs, edit them at any active stage, move them between lifecycle states, duplicate a PO, reactivate a cancelled one, and add or remove attachments on a PO. Reopening or revising a PO past Draft creates a new version. Moving a line to a different vendor location and duplicating a PO are both covered by this permission alone and do not require Purchase from Non-Qualified Vendors; neither action carries an acceptance over.",
        whenToRestrict: "For any role outside procurement. Most operational roles should not be able to initiate spending.",
        scope: "Vendor scope. Category scope. Maximum PO value applies.",
        defaultEnabled: false,
        thresholdConfig: {
          type: "monetary",
          label: "Maximum PO Value",
          description: "Set the maximum purchase order value this role can create. Orders exceeding this amount will require approval from a higher authority.",
          unit: "$",
          unitPosition: "prefix",
          helperText: "POs above this value will be routed for additional approval before they can be submitted.",
          defaultValue: "50000",
        },
      },
      {
        id: "po-nonqualified",
        name: "Purchase from Non-Qualified Vendors",
        description: "Controls whether a buyer can use a vendor location that is not on the item's list, for one PO.",
        category: "Elevated procurement",
        whatItGrants: "The user can use a vendor location that is not on the item's list, for one PO. Without this permission, the system blocks any PO line whose vendor location is not on the item's list. An acceptance is per vendor location and per PO, and never carries over on a line move or duplicate. When a PO is sent or confirmed, each flagged line is marked accepted in the same save, under the sender's name and the time. If the send does not carry the person's confirmation, it is refused and the off-list lines are listed.",
        whenToRestrict: "Only for large enterprises with formal vendor vetting in place. On by default, because most companies do not regulate this.",
        scope: null,
        defaultEnabled: true,
      },
      {
        id: "po-cancel",
        name: "Cancel or Archive Purchase Orders",
        description: "Lifecycle end control. Both actions end the PO's active lifecycle.",
        category: "Destructive action",
        whatItGrants: "The user can cancel a PO, which moves it to Cancelled and keeps it visible, or archive it, which removes it from active views.",
        whenToRestrict: "Restrict for everyone except procurement managers or administrators. Cancelling or archiving an active PO before receipt causes missed inventory and stockouts that often surface late.",
        scope: null,
        defaultEnabled: false,
      },
      {
        id: "po-bulk-import",
        name: "Bulk Import POs",
        description: "Authority to create many POs in one operation.",
        category: "Bulk operation",
        whatItGrants: "The user can import multiple POs by CSV or file upload. Each imported PO is subject to the same validation as a manually created one and lands in the state set by the import file.",
        whenToRestrict: "Restrict for everyone except senior procurement, ops leads, or data migration roles. A bad import file can create thousands of incorrect POs at once with no easy rollback.",
        scope: null,
        defaultEnabled: false,
      },
      {
        id: "po-pricing-rules",
        name: "Manage Pricing Rules",
        description: "Controls authorship of pricing rules in the global pricing rule library. This is a single shared permission surfaced in five module permission sets: Purchase Orders, Quotes, Sales Orders, Partners, and Partner Groups.",
        category: "Pricing",
        whatItGrants: "The user can create and edit pricing rules in the global pricing rule library, reached from any of the five modules. Rules are global records, so a rule authored from one module is available to every module that applies pricing rules. This is one permission with one state: turning it on or off in any of the five module permission sets changes it in all of them. It does not grant applying a rule to a record.",
        whenToRestrict: "Restrict for anyone who is not a sales manager, procurement manager, or commercial lead. Because the permission is shared, granting it from any one module grants pricing-rule authorship across all five, so it should not be given to a role trusted with only one side of the business.",
        scope: null,
        defaultEnabled: false,
      },
      {
        id: "po-apply-pricing",
        name: "Apply Pricing Rules",
        description: "Controls whether a user can attach or remove a pricing rule on a PO.",
        category: "Pricing",
        whatItGrants: "The user can apply and remove pricing rules on POs. Requires Create and Edit Purchase Orders. This permission is independent per module: the setting here controls PO application only and does not affect Partners or Sales Orders.",
        whenToRestrict: "For roles that create POs but should not change negotiated or contract pricing at the PO level.",
        scope: null,
        defaultEnabled: true,
      },
      {
        id: "po-discounts",
        name: "Add One-Time Discounts and Premiums",
        description: "Ad-hoc price adjustments applied to a single PO.",
        category: "Pricing",
        whatItGrants: "The user can apply an ad-hoc discount or premium at line-item or PO level. Requires Create and Edit Purchase Orders. The adjustment affects only the PO it is applied to and does not alter vendor pricing rules, the item-vendor pricing configuration, or any other PO.",
        whenToRestrict: "Restrict for buyer roles that should not have pricing discretion beyond standard vendor rates.",
        scope: null,
        defaultEnabled: true,
      },
    ],
  },

  // 8. Receiving: 3 permissions (ERP-5506 AC30). Log and Resolve
  //    Discrepancies, Edit Receipts After Confirmation, and Void a Confirmed
  //    Receipt do not ship in Pioneer, so they are parked in
  //    BACKLOGGED_PERMISSIONS below.
  {
    id: "receiving",
    name: "Receiving",
    description: "Goods receipt, discrepancy handling, and confirmations",
    icon: PackageCheck,
    permissions: [
      {
        id: "rcv-access",
        name: "Access Receiving Module",
        description: "The master gate for Receiving: without it the module cannot be opened on either surface.",
        category: "Module access",
        whatItGrants: "The user can view receiving records, including line items, received quantities, their locations, the purchase order received against, and attachments.",
        whenToRestrict: "Only for roles with no reason to see receiving.",
        scope: "All items and categories.",
        defaultEnabled: true,
        platform: "both",
      },
      {
        id: "rcv-receive",
        name: "Confirm Receipt of Goods",
        description: "The core floor action: controls who can receive goods against a PO.",
        category: "Core receiving action",
        whatItGrants: "The user can mark items received against a PO and enter received quantities. Confirmation writes the inventory update and advances the PO's receiving status. This permission covers every field in the receiving document, attachments included.",
        whenToRestrict: "For roles that should not book stock into inventory.",
        scope: "Follows item category scope.",
        defaultEnabled: true,
        platform: "both",
      },
      {
        id: "rcv-labels",
        name: "Print Receiving Labels",
        description: "Controls who can produce labels for received items.",
        category: "Label generation",
        whatItGrants: "The user can generate and reprint barcode labels for received items.",
        whenToRestrict: "Rarely restricted: most receiving roles need this.",
        scope: null,
        defaultEnabled: true,
        platform: "both",
      },
    ],
  },

  // 9. Inventory Movement: 3 permissions
  {
    id: "inventory-movement",
    name: "Inventory Movement",
    description: "Planned and ad-hoc inventory transfers",
    icon: ArrowLeftRight,
    permissions: [
      {
        id: "mv-access",
        name: "Access Inventory Movement Module",
        description: "The master gate for the Inventory Movement module: without it the module cannot be opened on either surface.",
        category: "Module access",
        whatItGrants: "The user can open Inventory Movement and see all movement tasks, including status, item details, source and destination locations, quantities, assigned personnel, the full activity log, and any attachments on the movement.",
        whenToRestrict: "Default on. Off only for roles with no warehouse involvement, and sales is the typical exclusion. Procurement and finance both touch movement data routinely (tracing what moved where, reconciling against receipts, accounting for inventory shifts) and usually need access.",
        scope: "All items, categories, and locations.",
        defaultEnabled: true,
        platform: "both",
      },
      {
        id: "mv-create",
        name: "Manage Movement Plans",
        description: "Planning authority: controls who can direct other operatives' movement work.",
        category: "Planning and administration",
        whatItGrants: "The user can create movement tasks for future execution, edit task details such as dates, destinations, and quantities, assign or reassign tasks to other users, and edit or cancel tasks created by others. Adding and removing attachments on a movement rides along with this permission, so anyone who can create or edit a movement can attach supporting files and remove them. Attachment management is not gated separately.",
        whenToRestrict: "Default on for supervisors, warehouse managers, and anyone who organizes other operatives' work. Off for floor operatives who should only execute tasks assigned to them and not direct others.",
        scope: "Follows access scope.",
        defaultEnabled: true,
        platform: "both",
      },
      {
        id: "mv-execute",
        name: "Execute Movements",
        description: "The core floor action: controls who can carry out and complete a movement.",
        category: "Floor operations",
        whatItGrants: "The user can carry out movement tasks: accept assigned tasks, perform the transfer, and mark tasks complete. This includes declining a task with a required reason, reporting issues encountered during execution, and starting an ad-hoc movement when an unplanned transfer is needed. Ad-hoc execution is not gated separately.",
        whenToRestrict: "Default on. Off only for roles that have no business touching stock physically.",
        scope: "Follows access scope.",
        defaultEnabled: true,
        platform: "both",
      },
    ],
  },

  // 10. Shipments: 9 permissions (ERP-5546, 14 Aug 26). View declared value
  //     on shipment documents is deferred out of Pioneer in the story, so it
  //     is parked in BACKLOGGED_PERMISSIONS below.
  {
    id: "shipments",
    name: "Shipments",
    description: "Outbound shipment planning, picking, and dispatch",
    icon: Truck,
    permissions: [
      {
        id: "ship-access",
        name: "Access Shipments Module",
        description: "The master gate for the Shipments module: without it the module cannot be opened.",
        category: "Module access",
        whatItGrants: "The user can open Shipments and see all shipment records including headers, addresses, line items, status, carrier, carrier method and tracking info, attachments, and the audit trail. It also grants view-only access to everything in the module, including fields that come from other modules, on both the main listing and the detail pages. Shipment status on sales orders and inventory flows through regardless, so a sales rep can see an order's shipment status without this permission.",
        whenToRestrict: "Hard to think of an admin-level role that never ships anything. Restrict for non-administrative floor workers such as machine operators and production staff with no shipping responsibilities.",
        scope: "All items and categories.",
        defaultEnabled: true,
        platform: "both",
      },
      {
        id: "ship-create",
        name: "Create and Manage Shipments",
        description: "Administrative authority over shipment plan creation and header-level editing.",
        category: "Shipment planning",
        whatItGrants: "The user can create shipment plans against one or more confirmed sales orders for the same customer and ship-to address, edit shipment headers (departure type, carrier, shipment method), manage assignees, edit the ship-by date and picking start and end dates, address, and shipment lines and quantities, release a shipment from draft to ready-to-pick, and attach or delete attachments at the shipment level. It also carries the cross-module fields on the shipment, such as carrier and ship-to. Does not include allocating or unallocating inventory.",
        whenToRestrict: "Shipment Managers only. Pickers and Material Handlers work within plans created for them.",
        scope: "All items and categories.",
        defaultEnabled: false,
        platform: "both",
      },
      {
        id: "ship-allocate",
        name: "Allocate Inventory",
        description: "Controls allocation for Sales Orders and Shipments.",
        category: "Inventory allocation",
        whatItGrants: "The user can create allocations, including auto-allocation and manual pre-allocation, against shipment or sales order lines. This is a single global permission gating the shared allocation engine used by both modules, and it is not currently scoped per entity type.",
        whenToRestrict: "Off by default for sales roles: a person should not receive this simply because they can create or manage a shipment or sales order. Salespeople should never hold it, since they will prioritise their own customers over the wider order book when supply is short.",
        scope: null,
        defaultEnabled: false,
        platform: "both",
      },
      {
        id: "ship-release-allocation",
        name: "Release Allocation",
        description: "Reverses an existing allocation commitment.",
        category: "Inventory allocation",
        whatItGrants: "The user can release or reassign an existing allocation, returning the allocated inventory to the available pool.",
        whenToRestrict: "Off by default, and more severe than Allocate inventory: reversing a commitment already made to a customer is a bigger trust break. Should sit with a more senior or deciding persona than day-to-day shipment planning.",
        scope: null,
        defaultEnabled: false,
        platform: "both",
      },
      {
        id: "ship-overship",
        name: "Authorize Overship",
        description: "Allows shipping beyond ordered quantity.",
        category: "Elevated authority",
        whatItGrants: "The user can enter a line quantity exceeding the amount originally ordered.",
        whenToRestrict: "Off by default. Senior Shipment Managers only, standard planners should not have this.",
        scope: "Follows Create and manage shipments scope.",
        defaultEnabled: false,
        platform: "both",
      },
      {
        id: "ship-pick",
        name: "Execute Picking Tasks",
        description: "Operational permission for completing pick lists on the warehouse floor.",
        category: "Floor operations",
        whatItGrants: "The user works through the pick list, confirms picked items, enters quantities and lot or serial numbers, reports shortages, and attaches files to line items. If no picker is assigned to a shipment, everyone with this permission sees it in their backlog.",
        whenToRestrict: "Picker personas only. Shipment Managers who plan shipments do not need floor-level picking access.",
        scope: "Follows access scope.",
        defaultEnabled: false,
        platform: "both",
      },
      {
        id: "ship-approve-short",
        name: "Approve Short Shipments",
        description: "Authorizes approving a shipment that falls short of the full ordered quantity.",
        category: "Elevated authority",
        whatItGrants: "The user reviews reported shortages and approves a short ship, authorizing the shipment to proceed with less than the full quantity. Resolution options are backorder the remaining quantity or create a follow-up shipment.",
        whenToRestrict: "Off by default. Pickers should not self-approve their own shortages, which is the separation of duties here. Shipment Managers and supervisors only.",
        scope: "Follows access scope.",
        defaultEnabled: false,
        platform: "both",
      },
      {
        id: "ship-dispatch",
        name: "Confirm Departure",
        description: "Final-step permission that records a shipment as physically departed.",
        category: "Dispatch operations",
        whatItGrants: "The user records the physical departure of goods, can add attachments, and can edit departure type, carrier, and shipment method if needed. Packing list, shipping label, and bill of lading become available to print or preview at this stage.",
        whenToRestrict: "Material Handler or Dispatch personas only. Pickers complete their tasks before this stage.",
        scope: null,
        defaultEnabled: false,
        platform: "both",
      },
      {
        id: "ship-cancel",
        name: "Cancel Shipment",
        description: "Terminal permission that cancels a shipment and reverses its inventory commitments.",
        category: "Destructive action",
        whatItGrants: "The user cancels a shipment and rolls back its inventory allocations, which affects the associated sales orders. The rollback is handled inside this permission and does not require Allocate inventory or Release allocation.",
        whenToRestrict: "Off by default. Shipment Managers and supervisors only.",
        scope: null,
        defaultEnabled: false,
        platform: "both",
      },
    ],
  },

  // 11. Quotes: 13 permissions
  {
    id: "quotes",
    name: "Quotes",
    description: "Quote lifecycle, pricing, approvals, and documents",
    icon: FileText,
    permissions: [
      {
        id: "qt-access",
        name: "Access Quotes Module",
        description: "Module access gate: without it the module cannot be opened.",
        category: "Module access",
        whatItGrants: "The user can open Quotes and see all quote records across all tabs, including line items, deal information, attachments, linked transactions, and version history. Quote status on linked orders and shipments flows through regardless.",
        whenToRestrict: "On by default. Off for roles with no sales involvement, including warehouse, procurement, receiving, and HR.",
        scope: "All customers. Restrict to the assigned representative's quotes.",
        defaultEnabled: true,
      },
      {
        id: "qt-view-pricing",
        name: "View Pricing on Quotes",
        description: "Financial visibility control for quote pricing.",
        category: "Financial visibility",
        whatItGrants: "The user can see unit prices, pricing rules, discounts, premiums, and the total quote value. Cross-module: without it the user cannot see pricing on quote records and the system will not produce a priced PDF for them.",
        whenToRestrict: "On by default. Off for support roles who manage quote logistics without pricing visibility.",
        scope: "Follows access scope. Cross-module: pricing visibility is removed from printed and exported documents sent to customers.",
        defaultEnabled: true,
      },
      {
        id: "qt-edit",
        name: "Create and Edit Quotes",
        description: "Primary quote management authority.",
        category: "Quote management",
        whatItGrants: "The user can create and edit quote content: line items, deal information, timeline dates, customer details, shipping and billing locations, and payment terms. This includes duplicating, reopening cancelled or archived quotes, and reviving expired quotes. Uploading attachments is implicit here; editing, deleting, and changing the visibility of those files is governed by Manage Quote Attachments.",
        whenToRestrict: "On by default. Off for finance reviewers or read-only stakeholders who must not alter quote content.",
        scope: "All customers. Restrict to own quotes or team quotes.",
        defaultEnabled: true,
      },
      {
        id: "qt-manage-pricing-rules",
        name: "Manage Pricing Rules",
        description: "Controls authorship of pricing rules in the global pricing rule library. This is a single shared permission surfaced in five module permission sets: Purchase Orders, Quotes, Sales Orders, Partners, and Partner Groups.",
        category: "Pricing",
        whatItGrants: "The user can create and edit pricing rules in the global pricing rule library, reached from any of the five modules. Rules are global records, so a rule authored from one module is available to every module that applies pricing rules. This is one permission with one state: turning it on or off in any of the five module permission sets changes it in all of them. It does not grant applying a rule to a record.",
        whenToRestrict: "Restrict for anyone who is not a sales manager, procurement manager, or commercial lead. Because the permission is shared, granting it from any one module grants pricing-rule authorship across all five, so it should not be given to a role trusted with only one side of the business.",
        scope: null,
        defaultEnabled: false,
      },
      {
        id: "qt-apply-pricing-rules",
        name: "Apply Pricing Rules",
        description: "Controls whether a user can attach or remove a pricing rule on a quote.",
        category: "Pricing",
        whatItGrants: "The user can apply and remove pricing rules on quotes. This permission is independent per module: the setting here controls Quotes application only and does not affect Sales Orders, Purchase Orders, or Partners.",
        whenToRestrict: "Off by default. For roles that create or edit quotes but should not change negotiated or contract pricing at the quote level.",
        scope: "Follows Create and edit quotes scope.",
        defaultEnabled: false,
      },
      {
        id: "qt-discount",
        name: "Add One-Time Discounts and Premiums",
        description: "Ad-hoc price adjustment authority on a single quote.",
        category: "Pricing",
        whatItGrants: "The user can apply an ad-hoc discount or premium at line-item or quote level. It affects only the quote it is applied on and does not alter the catalog, pricing rules, or any other quote.",
        whenToRestrict: "Off by default. This is a commercial-authority gate: reps should not apply unauthorized discounts without manager review.",
        scope: "Discount and premium threshold applies.",
        defaultEnabled: false,
        thresholdConfig: {
          type: "percentage",
          label: "Discount and Premium Limit",
          description: "Set the maximum discount or premium this user can apply to a single quote. Amounts beyond this limit will require manager approval.",
          unit: "%",
          unitPosition: "suffix",
          helperText: "Discounts or premiums above this threshold will be flagged for manager review before the quote can be sent.",
          defaultValue: "15",
        },
      },
      {
        id: "qt-send",
        name: "Send Quote to Customer",
        description: "Workflow action that sends a quote externally.",
        category: "Workflow",
        whatItGrants: "The user can transition a quote from Draft to Sent. This is the formal external communication action.",
        whenToRestrict: "On by default. Off for reps who draft quotes but require manager review before external communication.",
        scope: null,
        defaultEnabled: true,
      },
      {
        id: "qt-approve-convert",
        name: "Convert Quote to Sales Order",
        description: "Elevated authority to create a binding sales order.",
        category: "Elevated authority",
        whatItGrants: "The user can convert a customer-confirmed quote into a sales order, with downstream inventory, fulfillment, and financial implications. The landing state depends on whether the user also holds Operations Access on Sales Orders. Marking a quote Confirmed by Customer does not require this.",
        whenToRestrict: "On by default. The Operations Access gate on Sales Orders is the real control point. Off only where conversion authority needs tighter organizational control.",
        scope: "No scope restriction.",
        defaultEnabled: true,
      },
      {
        id: "qt-cancel",
        name: "Cancel or Archive Quotes",
        description: "Lifecycle end control; both actions close the quote's active record.",
        category: "Quote lifecycle",
        whatItGrants: "The user can cancel a quote, moving it to Cancelled, which is reversible through Create and edit quotes, or archive it, moving it to Archived.",
        whenToRestrict: "On by default. Off where cancellation or archival authority needs formal pipeline governance. Most reps can cancel or archive their own quotes.",
        scope: null,
        defaultEnabled: true,
      },
      {
        id: "qt-attachments",
        name: "Manage Quote Attachments",
        description: "Attachment editing and visibility control.",
        category: "Quote management",
        whatItGrants: "The user can edit, delete, and toggle the visibility of attachments at the pre-quote, quote, and item levels. Uploading is governed by Create and Edit Quotes.",
        whenToRestrict: "On by default. Off for users who should not manage compliance documentation or customer-submitted RFQ files.",
        scope: "No scope restriction. Covers all attachment levels: pre-quote, quote-level, and item-level.",
        defaultEnabled: true,
      },
      {
        id: "qt-manage-reps",
        name: "Manage Sales Representatives on Quote",
        description: "Rep assignment authority on a quote.",
        category: "Quote management",
        whatItGrants: "The user can link or remove additional sales reps on a quote and bulk-assign representatives.",
        whenToRestrict: "On by default. Off for individual reps who should not reassign deals to themselves or remove colleagues.",
        scope: null,
        defaultEnabled: true,
      },
      {
        id: "qt-export",
        name: "Print and Export Quotes",
        description: "Single-record document generation.",
        category: "Documents",
        whatItGrants: "The user can generate a quote PDF or export a single quote's data. Pricing on the output is governed by View Pricing on Quotes.",
        whenToRestrict: "On by default. Off for junior sales assistants who should not produce customer-facing PDFs without manager review.",
        scope: "No scope restriction. Pricing visibility on exported documents is governed by View pricing on quotes.",
        defaultEnabled: true,
      },
      {
        id: "qt-bulk-export",
        name: "Bulk Export Quotes",
        description: "Batch export of many quotes at once.",
        category: "Documents",
        whatItGrants: "The user can select multiple quotes from the listing and export them as a batch (CSV, Excel, or PDF), pulling the complete filtered pipeline out in one action.",
        whenToRestrict: "Off by default. The blast radius is materially larger than single-record export. Sales managers and administrators only.",
        scope: null,
        defaultEnabled: false,
      },
    ],
  },

  // 12. Sales Orders: 13 permissions (ERP-5548, 14 Aug 26)
  {
    id: "sales-orders",
    name: "Sales Orders",
    description: "Order management, fulfillment, and allocation",
    icon: Receipt,
    permissions: [
      {
        id: "so-access",
        name: "Access Sales Orders Module",
        description: "Foundational access permission for the Sales Orders module. Every other Sales Orders permission requires this to function.",
        category: "Module access",
        whatItGrants: "The user can open Sales Orders and see all orders across every tab, including line items, deal information, customer details, status, fulfillment progress, allocation tracking, attachments, linked transactions, and activity history.",
        whenToRestrict: "On by default for roles with order management or fulfillment involvement. Off for roles with neither.",
        scope: "All orders and customers.",
        defaultEnabled: true,
        platform: "both",
      },
      {
        id: "so-view-pricing",
        name: "View Pricing on Sales Orders",
        description: "Visibility control for order-level pricing and totals shown on sales orders. Order pricing is not sourced purely from Items, so it stays separate from item pricing.",
        category: "Financial visibility",
        whatItGrants: "The user can see unit prices, line totals, and order values on a sales order. Denying it removes order pricing visibility wherever order pricing appears.",
        whenToRestrict: "On by default. Off for warehouse and fulfillment roles.",
        scope: "Follows access scope. Cross-module: order pricing visibility is removed system-wide.",
        defaultEnabled: true,
        platform: "both",
      },
      {
        id: "so-create",
        name: "Create and Edit Sales Orders",
        description: "Primary order-management permission for creating and maintaining sales order content. Cancellation is governed separately by Cancel or archive sales orders.",
        category: "Order management",
        whatItGrants: "The user can create sales orders directly, without a quote conversion, and modify existing order content: line items, deal information, customer details, shipping and billing locations, payment terms, and status changes during the working lifecycle.",
        whenToRestrict: "On by default for sales reps and account managers responsible for orders. Off for finance reviewers or read-only stakeholders who need pipeline visibility but must not alter order content.",
        scope: "All customers.",
        defaultEnabled: true,
        platform: "both",
      },
      {
        id: "so-manage-pricing-rules",
        name: "Manage Pricing Rules",
        description: "Controls authorship of pricing rules in the global pricing rule library. This is a single shared permission surfaced in five module permission sets: Purchase Orders, Quotes, Sales Orders, Partners, and Partner Groups.",
        category: "Pricing",
        whatItGrants: "The user can create and edit pricing rules in the global pricing rule library, reached from any of the five modules. Rules are global records, so a rule authored from one module is available to every module that applies pricing rules. This is one permission with one state: turning it on or off in any of the five module permission sets changes it in all of them. It does not grant applying a rule to a record.",
        whenToRestrict: "Restrict for anyone who is not a sales manager, procurement manager, or commercial lead. Because the permission is shared, granting it from any one module grants pricing-rule authorship across all five, so it should not be given to a role trusted with only one side of the business.",
        scope: null,
        defaultEnabled: false,
      },
      {
        id: "so-apply-pricing-rules",
        name: "Apply Pricing Rules",
        description: "Controls whether a user can attach or remove a pricing rule on a sales order.",
        category: "Pricing",
        whatItGrants: "The user can apply and remove pricing rules on sales orders. This permission is independent per module: the setting here controls Sales Orders application only and does not affect Quotes, Purchase Orders, or Partners.",
        whenToRestrict: "Off by default. For roles that create or edit orders but should not change negotiated or contract pricing at the order level.",
        scope: null,
        defaultEnabled: false,
      },
      {
        id: "so-discount",
        name: "Add One-Time Discounts and Premiums",
        description: "Commercial authority to apply ad-hoc discounts or premiums on individual sales orders.",
        category: "Pricing",
        whatItGrants: "The user can add ad-hoc discounts or premiums at line-item or order level. The adjustment applies only to the order it is added on, does not affect the catalog or pricing rules, and does not carry across to other orders.",
        whenToRestrict: "Off by default. This is a commercial-authority gate: sales reps should not apply unauthorised discounts without manager review.",
        scope: null,
        defaultEnabled: false,
        platform: "both",
      },
      {
        id: "so-operations-access",
        name: "Operations Access",
        description: "Workflow gate that lets operations staff clear sales orders for fulfillment.",
        category: "Workflow gate",
        whatItGrants: "The user can clear other users' sales orders from Pending Review to Cleared by Ops. As a secondary effect, when they convert their own quote to a sales order, the new order lands directly in Cleared by Ops instead of Pending Review.",
        whenToRestrict: "Off by default. Operations-team members responsible for the ops review gate only. Held outside operations it lets someone clear other users' orders without oversight, and bypass the review step by converting their own quotes straight into the cleared state.",
        scope: null,
        defaultEnabled: false,
        platform: "both",
      },
      {
        id: "so-allocate",
        name: "Allocate Inventory to Orders",
        description: "Inventory allocation permission that commits on-hand stock against a sales order.",
        category: "Inventory allocation",
        whatItGrants: "The user can assign specific on-hand stock to a sales order, committing that stock against the order.",
        whenToRestrict: "Off by default. Allocation is a distinct operations function and should not sit with sales: a salesperson with allocation authority could prioritise their own customers over others. Warehouse and ops staff only, and typically not even a VP of Sales.",
        scope: null,
        defaultEnabled: false,
        platform: "both",
      },
      {
        id: "so-release-allocation",
        name: "Release Allocation",
        description: "Authority to undo a prior inventory commitment on a sales order and return stock to the available pool.",
        category: "Inventory allocation",
        whatItGrants: "The user can release or reassign an existing inventory allocation on a sales order, returning the allocated inventory to the available pool. It mirrors Shipments' Release allocation, and is separate from Allocate inventory to orders for the same reason.",
        whenToRestrict: "Off by default, and more restricted than Allocate inventory to orders: reversing a commitment already made to a customer is a bigger trust break than not being able to promise inventory in the first place. Warehouse and ops staff only, the same population as Allocate inventory to orders.",
        scope: null,
        defaultEnabled: false,
        platform: "both",
      },
      {
        id: "so-archive",
        name: "Cancel or Archive Sales Orders",
        description: "Destructive-action permission that closes a sales order's active lifecycle.",
        category: "Destructive action",
        whatItGrants: "The user can move a sales order to Cancelled or Archived. Both end the order's active lifecycle, roll back inventory allocations, and affect any in-progress shipments linked to it. An active order can be archived directly, not only from a cancelled state, with the same downstream impact either way.",
        whenToRestrict: "Off by default. Unlike quotes, cancelling or archiving an order touches allocated stock and in-progress shipments. Sales managers and ops leads only.",
        scope: null,
        defaultEnabled: false,
        platform: "both",
      },
      {
        id: "so-attachments",
        name: "Manage Sales Order Attachments",
        description: "Order-management permission for editing and controlling visibility of order attachments. Uploading is governed separately by Create and edit sales orders.",
        category: "Order management",
        whatItGrants: "The user can edit, delete, and toggle the visibility of attachments at pre-order, order, and item level.",
        whenToRestrict: "On by default. Off for users who should not manage compliance documentation or customer-submitted files: editing, deleting, or hiding a file after the fact carries audit risk.",
        scope: null,
        defaultEnabled: true,
        platform: "both",
      },
      {
        id: "so-manage-reps",
        name: "Manage Sales Representatives on Sales Orders",
        description: "Order-management permission for assigning and reassigning sales reps on orders.",
        category: "Order management",
        whatItGrants: "The user can link or remove additional sales reps on a sales order, and bulk-assign representatives.",
        whenToRestrict: "On by default. Off for individual reps who should not reassign orders to themselves or remove colleagues.",
        scope: null,
        defaultEnabled: true,
      },
      {
        id: "so-export",
        name: "Print and Export Sales Orders",
        description: "Document-generation permission for producing a single sales order as a PDF or export.",
        category: "Documents",
        whatItGrants: "The user can generate a sales order PDF or export a single order's data. Pricing on the document follows their other permissions: without View pricing on sales orders, the PDF carries no pricing.",
        whenToRestrict: "On by default. Off for junior sales assistants who should not produce customer-facing PDFs without manager review.",
        scope: null,
        defaultEnabled: true,
      },
      {
        id: "so-bulk-export",
        name: "Bulk Export Sales Orders",
        description: "Document-generation permission for exporting multiple sales orders as a batch.",
        category: "Documents",
        whatItGrants: "The user can select multiple sales orders from the listing and export them as a batch in CSV, Excel, or PDF, pulling the complete filtered order book out of the system in one action.",
        whenToRestrict: "Off by default. The blast radius is materially different from single-record export: one action can extract every order, customer, quantity, and price point the user can reach. Sales managers, finance, and administrators only.",
        scope: null,
        defaultEnabled: false,
      },
    ],
  },
  // Partners: 9 permissions
  {
    id: "partners",
    name: "Partners",
    description: "Partner records, commercial configuration, pricing rules, and credit terms.",
    icon: Users,
    permissions: [
      {
        id: "prt-access",
        name: "Access Partners Module",
        description: "The master gate for the Partners module: without it the module cannot be opened.",
        category: "Module access",
        whatItGrants: "The user can reach the partner listing and detail page, with view-only access to every tab including partner locations.",
        whenToRestrict: "Almost every role touches a partner in some way, so access is rarely restricted. Off only for the rare role with no partner exposure at all.",
        scope: "All partners.",
        defaultEnabled: true,
      },
      {
        id: "prt-create-edit",
        name: "Create and Edit Partner",
        description: "Controls whether a user can author and modify partner records.",
        category: "Partner management",
        whatItGrants: "The user can create and edit partners, including the partner locations, assigned POCs, and attachments linked to them. Without it, partner records are read-only.",
        whenToRestrict: "For any role that should view partner data but not modify it.",
        scope: null,
        defaultEnabled: true,
      },
      {
        id: "prt-config-vendor",
        name: "Configure Vendor Settings",
        description: "Controls exposure of the vendor-side commercial configuration on a partner and location.",
        category: "Commercial configuration",
        whatItGrants: "The user can open the vendor-side commercial config on a partner and its locations. Without it the vendor configs button is hidden. It also carries billing and shipping, and freight, logistics, and carrier, on the vendor side, since no separate permissions exist for those.",
        whenToRestrict: "For sales roles, which have no need to modify vendor-side configurations.",
        scope: null,
        defaultEnabled: true,
      },
      {
        id: "prt-config-customer",
        name: "Configure Customer Settings",
        description: "Controls exposure of the customer-side commercial configuration on a partner and location.",
        category: "Commercial configuration",
        whatItGrants: "The user can open the customer-side commercial config on a partner and its locations. Without it the customer configs button is hidden. It also carries billing and shipping, and freight, logistics, and carrier, on the customer side, since no separate permissions exist for those.",
        whenToRestrict: "For procurement roles, which have no operational need to modify customer-facing configurations.",
        scope: null,
        defaultEnabled: true,
      },
      {
        id: "prt-manage-payment-terms",
        name: "Manage Payment Terms",
        description: "Controls authorship of payment terms as global records.",
        category: "Commercial configuration",
        whatItGrants: "The user can create and edit payment terms globally. Without it, payment terms cannot be managed. This is a cross-module permission, present in Partner Group as well: turning it on or off anywhere changes it everywhere.",
        whenToRestrict: "For all roles except finance managers and system administrators. Terms authored here are global, so a bad definition propagates into Quotes, Sales Orders, and Purchase Orders for every partner using it.",
        scope: null,
        defaultEnabled: false,
      },
      {
        id: "prt-payment-terms",
        name: "Apply Payment Terms",
        description: "Controls whether a user can attach an existing payment term to a partner.",
        category: "Commercial configuration",
        whatItGrants: "The user can apply payment terms to a partner. Without it, payment terms cannot be applied to partners.",
        whenToRestrict: "For roles that record partner data but should not set commercial terms on an account.",
        scope: null,
        defaultEnabled: false,
      },
      {
        id: "prt-manage-pricing-rules",
        name: "Manage Pricing Rules",
        description: "Controls authorship of pricing rules in the global pricing rule library. One shared permission surfaced in five module permission sets: Purchase Orders, Quotes, Sales Orders, Partners, and Partner Group.",
        category: "Commercial configuration",
        whatItGrants: "The user can create and edit pricing rules in the global library, reached from any of the five modules. Rules are global records, so a rule authored from one module is available to every module that applies pricing rules. This is one permission with one state: turning it on or off in any of the five module permission sets changes it in all of them. It does not grant applying a rule to a record.",
        whenToRestrict: "Restrict for anyone who is not a sales manager, procurement manager, or commercial lead. Because the permission is shared, granting it from any one module grants pricing-rule authorship across all five, so it should not be given to a role trusted with only one side of the business.",
        scope: null,
        defaultEnabled: false,
      },
      {
        id: "prt-manage-pricing",
        name: "Apply Pricing Rules",
        description: "Controls whether a user can attach an existing pricing rule to a partner.",
        category: "Commercial configuration",
        whatItGrants: "The user can apply pricing rules to partners. Without it, pricing rules cannot be applied.",
        whenToRestrict: "For roles that record partner data but should not set negotiated or contract pricing on an account.",
        scope: "Partner.",
        defaultEnabled: false,
      },
      {
        id: "prt-credit-limit",
        name: "Configure Credit Limits",
        description: "Controls who can set the credit ceiling on a partner.",
        category: "Commercial configuration",
        whatItGrants: "The user can set and enforce credit limits on a partner. Without it, credit limits cannot be configured.",
        whenToRestrict: "Credit limit is a management-level decision that either comes from a standard group limit or is set by a manager. Sales reps are not authorised to configure it. Restrict to finance managers and system administrators.",
        scope: null,
        defaultEnabled: false,
      },
      {
        id: "prt-payment-method",
        name: "Configure Payment Method",
        description: "Controls selection of the payment method on a partner.",
        category: "Commercial configuration",
        whatItGrants: "The user can select the payment method on a partner. Without it, the payment method cannot be managed.",
        whenToRestrict: "Rarely restricted. Selecting a payment method is not destructive, so it is on for anyone inputting partner data, including salespeople and payment staff.",
        scope: null,
        defaultEnabled: true,
      },
      {
        id: "prt-vendor-qualification",
        name: "Manage Vendor Qualification",
        description: "Controls which items a vendor is approved to supply. The same permission also exists at the item level, and turning it on or off in either place does it in both.",
        category: "Vendor assignment",
        whatItGrants: "The user can add, edit, and remove item-vendor qualification links from either side: vendors on an item's qualified vendor list, or items on a vendor. This is one permission with one state, so turning it on or off in either module permission set changes it in both.",
        whenToRestrict: "Keep it on for procurement managers who own supplier relationships. Restrict sales, warehouse, and engineering roles.",
        scope: null,
        defaultEnabled: false,
      },
      {
        id: "prt-customer-qualification",
        name: "Manage Customer Qualification",
        description: "Controls which items a customer is approved to buy.",
        category: "Partner management",
        whatItGrants: "The user can add and remove items inside the Items They Buy tab on a partner. Without it, that qualification list is read-only.",
        whenToRestrict: "Turned on for sales managers and reps who own customer relationships. Engineers and warehouse staff should not be modifying customer qualifications.",
        scope: null,
        defaultEnabled: false,
      },
      {
        id: "prt-deactivate",
        name: "Archive Partner",
        description: "Controls the ability to retire partner and location records from active use.",
        category: "Destructive action",
        whatItGrants: "The user can archive and deactivate partner and location records. Without it, neither can be archived or deactivated.",
        whenToRestrict: "Restrict to system administrators and senior managers. Archiving is typically a cleanup action for a partner no longer in business, so it stays off by default.",
        scope: null,
        defaultEnabled: false,
      },
    ],
  },

  // Partner Group: 10 permissions (ERP-6242 catalogue, 14 Aug 26)
  //     Module-uniform facts: every permission here requires the Full Access
  //     licence and is web only. Three are on by default: the module gate,
  //     Configure Vendor Settings, and Configure Customer Settings.
  //
  //     The 14 Aug recut mirrors what ERP-5549 already did to Partners. Payment
  //     terms and pricing rules are each split into a Manage half (authorship of
  //     the global record, cross-module with Partners, on or off anywhere
  //     changes it everywhere) and an Apply half (attaching an existing record
  //     to this group). The Apply halves stay deliberately separate from their
  //     partner-level equivalents: a group inherits to every partner attached to
  //     it, so the blast radius is higher and the spec gives it its own persona.
  //
  //     Configure Payment Method is NOT in this catalogue. It exists on Partners
  //     only (prt-payment-method); the group-level pg-payment-method it used to
  //     carry was dropped here.
  {
    id: "partner-group",
    name: "Partner Group",
    description: "Partner group records and the commercial configuration that inherits to attached partners.",
    icon: Building2,
    permissions: [
      {
        id: "pg-access",
        name: "Access Partner Groups Module",
        description: "The master gate for the Partner Group module; without it the module can't be opened.",
        category: "Module access",
        whatItGrants: "Grants view only access to partner group listing and all tabs inside detail page. Without it, the module is not accessible.",
        whenToRestrict: "Seeing a group is low risk, the same way seeing a category is low risk. Off only for the rare role with no partner exposure at all.",
        scope: "All partner groups.",
        defaultEnabled: true,
      },
      {
        id: "pg-create-edit",
        name: "Create and Edit Partner Group",
        description: "Controls whether a user can author and modify partner group records.",
        category: "Partner group management",
        whatItGrants: "Grants the ability to create and edit partner groups. Without it, partner group records are read-only. Having this permission will also grant permission to add/remove and manage attachments and add/remove/manage linked partners.",
        whenToRestrict: "A single group edit can push changes to every partner attached to that group, making this the highest-blast-radius action in the module. Limit it to the roles that configure the system, not the users who create individual partners. Recommended for setup roles only.",
        scope: null,
        defaultEnabled: false,
      },
      {
        id: "pg-config-vendor",
        name: "Configure Vendor Settings",
        description: "Controls exposure of the vendor-side commercial configuration on a partner group.",
        category: "Commercial configuration",
        whatItGrants: "Grants the ability to access/view only vendor-side commercial config on a partner group. Without it, vendor configs button would be hidden. This will also auto grant the ability to configure Billing and Shipping, and Freight and Logistics and Carrier Profile sections on vendor config side, as no separate permissions exist for it.",
        whenToRestrict: "For roles with no vendor-side responsibility.",
        scope: null,
        defaultEnabled: true,
      },
      {
        id: "pg-config-customer",
        name: "Configure Customer Settings",
        description: "Controls exposure of the customer-side commercial configuration on a partner group.",
        category: "Commercial configuration",
        whatItGrants: "Grants the ability to access/view only customer-side commercial config on a partner group. Without it, customer configs button would be hidden. This will also auto grant the ability to configure Billing and Shipping, and Freight and Logistics and Carrier Profile sections on customer config side, as no separate permissions exist for it.",
        whenToRestrict: "For roles with no customer-side responsibility.",
        scope: null,
        defaultEnabled: true,
      },
      {
        id: "pg-manage-payment-terms",
        name: "Manage Payment Terms",
        description: "Controls authorship of payment terms as global records. Cross-module permission, shared with Partners.",
        category: "Commercial configuration",
        whatItGrants: "Grants the ability to create and edit payment terms globally. Without it, payment terms cannot be managed. This is a cross module permission, present in Partners as well. Turning it on or off anywhere changes it everywhere.",
        whenToRestrict: "For all roles except finance managers and system administrators. Damage scenario: terms authored here are global, so a bad definition propagates into Quotes, Sales Orders, and Purchase Orders for every partner using it.",
        scope: null,
        defaultEnabled: false,
      },
      {
        id: "pg-payment-terms",
        name: "Apply Payment Terms",
        description: "Controls whether a user can attach an existing payment term to a partner group. Separate from the partner-level equivalent.",
        category: "Commercial configuration",
        whatItGrants: "Grants the ability to apply payment terms to partner group. Without it, payment terms cannot be applied to partner groups. This is independent of the permission to apply payment terms on a partner, because the blast radius of a partner group is significantly higher and a separate persona exists.",
        whenToRestrict: "For any role that should not set commercial terms that inherit to every partner in a group. Narrower than the partner-level equivalent because of inheritance.",
        scope: null,
        defaultEnabled: false,
      },
      {
        id: "pg-manage-pricing-rules",
        name: "Manage Pricing Rules",
        description: "Controls authorship of pricing rules in the global pricing rule library. One shared permission surfaced in five module permission sets: Purchase Orders, Quotes, Sales Orders, Partners, and Partner Group.",
        category: "Commercial configuration",
        whatItGrants: "The user can create and edit pricing rules in the global library, reached from any of the five modules. Rules are global records, so a rule authored from one module is available to every module that applies pricing rules. This is one permission with one state: turning it on or off in any of the five module permission sets changes it in all of them. It does not grant applying a rule to a record.",
        whenToRestrict: "Restrict for anyone who is not a sales manager, procurement manager, or commercial lead. Because the permission is shared, granting it from any one module grants pricing-rule authorship across all five, so it should not be given to a role trusted with only one side of the business.",
        scope: null,
        defaultEnabled: false,
      },
      {
        id: "pg-manage-pricing",
        name: "Apply Pricing Rules",
        description: "Controls whether a user can attach an existing pricing rule to a partner group. Separate from the partner-level equivalent.",
        category: "Commercial configuration",
        whatItGrants: "Grants the ability to apply pricing rules to partner group. Without it, pricing rules cannot be applied. This is independent of the permission to apply pricing rules on a partner, because the blast radius of a partner group is significantly higher and a separate persona exists.",
        whenToRestrict: "For any role that should not set negotiated or contract pricing that inherits to every partner in a group.",
        scope: "Group.",
        defaultEnabled: false,
      },
      {
        id: "pg-credit-limit",
        name: "Configure Credit Limits",
        description: "Controls who can set the standard credit ceiling at group level. Separate from the partner-level equivalent.",
        category: "Commercial configuration",
        whatItGrants: "Grants the ability to set and enforce credit limits on a group. Without it, group credit limits cannot be configured. This is independent of the equivalent permission in Partners.",
        whenToRestrict: "Credit limit is a management-level decision and this is the standard group limit. Restrict to finance managers and system administrators.",
        scope: null,
        defaultEnabled: false,
      },
      {
        id: "pg-archive",
        name: "Archive Partner Group",
        description: "Controls the ability to retire partner group records from active use.",
        category: "Destructive action",
        whatItGrants: "Grants the ability to archive partner groups. Without it, partner groups cannot be archived.",
        whenToRestrict: "Restrict to system administrators and senior managers. Archiving a group is a management-level action because of its inheritance and blast radius.",
        scope: null,
        defaultEnabled: false,
      },
    ],
  },

  // Contacts Directory: 3 permissions
  //     Module-uniform facts: every permission here requires the Full Access
  //     licence and is web only. Access Contacts Module and Create and Edit
  //     Contact are on by default; Archive Contact is off.
  //
  //     The module id stays "contacts". Only the display name is Contacts
  //     Directory, matching the sidebar entry and the segment label.
  {
    id: "contacts",
    name: "Contacts Directory",
    description: "Contact records attached to partners and partner groups.",
    icon: Contact,
    permissions: [
      {
        id: "ct-access",
        name: "Access Contacts Module",
        description: "The master gate for the Contacts module; without it the module can't be opened.",
        category: "Module access",
        whatItGrants: "Grants access to the contact directory module list and detail page with all the tabs (in view only). This also grants access to linking of POCs in partners and other modules, given the user has create/edit permission in the respective module. Without it, those sections are not accessible, as it needs to be controlled from here.",
        whenToRestrict: "POC visibility is low risk and broadly useful. Off only for the rare role with no need to see contacts. Note that turning this off also removes the POC linking sections in Partners and other modules.",
        scope: "All contacts.",
        defaultEnabled: true,
      },
      {
        id: "ct-create-edit",
        name: "Create and Edit Contact",
        description: "Controls whether a user can author and modify contact records.",
        category: "Contact management",
        whatItGrants: "Grants the ability to create and edit contacts and their details. Without it, contact records are read-only. It also grants add/remove attachment permission.",
        whenToRestrict: "For any role that should view contact data but not modify it. Creating a POC is a low-risk action that we want to encourage and not get users stuck on.",
        scope: null,
        defaultEnabled: true,
      },
      {
        id: "ct-archive",
        name: "Archive Contact",
        description: "Controls the ability to retire contact records from active use.",
        category: "Destructive action",
        whatItGrants: "Grants the ability to archive contact records. Without it, contacts cannot be archived.",
        whenToRestrict: "Restrict to system administrators and senior managers. Destructive action, so it stays off and is granted deliberately.",
        scope: null,
        defaultEnabled: false,
      },
    ],
  },

  // 14. Users & Roles: 20 permissions (ERP-5550 catalogue, 15 Aug 26)
  //     Module-uniform facts: every permission here requires the Full Access
  //     licence (Field User carries no access to this module), and EVERY ONE
  //     of the twenty is off by default.
  //
  //     The all-off default is a statement about this module, not the system.
  //     A new role still seeds from the baseline of every catalogue permission
  //     carrying a default of On; none of those live here, so a new role
  //     reaches the permissions step with all twenty of these switched off.
  //     View billing overview and cost impact and Send secure login / password
  //     reset instructions used to be seeded on. The 15 Aug story calls both
  //     out as wrong and requires them off.
  //
  //     Role lifecycle is no longer folded into Create and edit roles. The
  //     11 Aug recut split out Deactivate or reactivate role and Archive or
  //     unarchive role as their own permissions, mirroring how the user side
  //     already separates Deactivate user and Archive user from Create and
  //     edit users. Bulk stays as Bulk deactivate or archive roles.
  //
  //     Platform: nine permissions are exercisable in the People Management
  //     mobile app (v1.0.0), tagged "both" below. Role management, direct
  //     permission assignment, Manage roles scope configuration, import,
  //     export, billing overview, and audit logs are web only.
  {
    id: "users-roles",
    name: "Users & Roles",
    description: "User administration, roles, and access governance",
    icon: UserCog,
    permissions: [
      {
        id: "ur-access",
        name: "Access Users and Roles Module",
        description: "Opens the module: the directory, profiles, the role list, and role definitions.",
        category: "Module access",
        whatItGrants: "The user can open Users and Roles and look through the directory, individual profiles including their attachments, the role list, and role definitions including their attachments.",
        whenToRestrict: "Most users do not need to see the full directory or role assignments. Keep it to IT administrators, HR, and people managers.",
        scope: "All users.",
        defaultEnabled: false,
        platform: "both",
      },
      {
        id: "ur-view-billing",
        name: "View Billing Overview and Cost Impact",
        description: "Shows license cost, billing impact, and spend summaries.",
        category: "Financial visibility",
        whatItGrants: "The user can see what licenses cost: spend summaries and what a change would do to the bill.",
        whenToRestrict: "Do not grant it to roles that manage users but should not see cost and billing figures.",
        scope: "Read-only.",
        defaultEnabled: false,
      },
      {
        id: "ur-create-user",
        name: "Create and Edit Users",
        description: "Creates accounts and edits profile fields, including adding and removing attachments on a user profile. Does not cover roles, license, archiving, or credentials.",
        category: "User administration",
        whatItGrants: "The user can add people and edit their profile details, including adding and removing attachments on a user profile. Roles, license, archiving, and credentials each need their own permission.",
        whenToRestrict: "User creation has license cost and security implications. Keep it to IT administrators and designated HR staff.",
        scope: "All users.",
        defaultEnabled: false,
        platform: "both",
      },
      {
        id: "ur-reset-password",
        name: "Send Secure Login / Password Reset Instructions",
        description: "Sends a secure login link or password reset to an existing user. Also covers sending, resending, and cancelling invites on Draft, Invite Sent, and Invite Expired users.",
        category: "User administration",
        whatItGrants: "The user can send someone a fresh sign-in link or a password reset, and can send, resend, or cancel an invite on a user who has not signed in yet.",
        whenToRestrict: "Keep it with IT help desk and administrators, and log it for security audit. Do not grant it to HR admins who edit profiles but should not touch login credentials.",
        scope: "All users.",
        defaultEnabled: false,
        platform: "both",
      },
      {
        id: "ur-deactivate-user",
        name: "Deactivate User",
        description: "Deactivates a single user, reversibly, removing their access while keeping their roles, permissions, and MFA intact for when they return.",
        category: "User lifecycle",
        whatItGrants: "The user can switch someone's access off for a while. Their roles, permissions, and MFA stay on the record, so switching it back on restores everything.",
        whenToRestrict: "Keep it to IT administrators and HR following offboarding steps. Team leads who only need to pause access can hold this without archiving authority.",
        scope: "All users.",
        defaultEnabled: false,
        platform: "both",
      },
      {
        id: "ur-bulk-deactivate-users",
        name: "Bulk Deactivate Users",
        description: "Deactivates several users at once, with the same reversible behavior as the single action.",
        category: "User lifecycle",
        whatItGrants: "The user can switch off access for a group of people in one action. Each one can be switched back on the same way.",
        whenToRestrict: "Higher impact than the single action, since one confirm affects many users. Keep it to senior IT administrators during planned changes.",
        scope: "All users.",
        defaultEnabled: false,
        platform: "both",
      },
      {
        id: "ur-archive-user",
        name: "Archive User",
        description: "Archives or unarchives a single user. Archiving clears the user's roles, direct permissions, and MFA, so it is offboarding rather than a pause. Unarchiving returns the user to Draft.",
        category: "Destructive action",
        whatItGrants: "The user can archive someone who has left and unarchive them if they return. Archiving clears their roles, direct permissions, and MFA enrollments, and unarchiving brings them back as a Draft user to set up again.",
        whenToRestrict: "Higher consequences than deactivation. Keep it to senior HR and IT administrators following offboarding steps.",
        scope: "All users.",
        defaultEnabled: false,
        platform: "both",
      },
      {
        id: "ur-bulk-archive",
        name: "Bulk Archive Users",
        description: "Archives several users at once, with the same clearing behavior as the single action.",
        category: "Destructive action",
        whatItGrants: "The user can archive a group of people in one action, clearing roles, direct permissions, and MFA for each of them.",
        whenToRestrict: "Higher impact than the single action, since one confirm clears roles, permissions, and MFA for many users. Keep it to senior IT administrators during planned changes.",
        scope: "All users.",
        defaultEnabled: false,
        platform: "both",
      },
      {
        id: "ur-manage-licenses",
        name: "Upgrade / Downgrade User License",
        description: "Changes one user's license, which affects billing.",
        category: "License management",
        whatItGrants: "The user can move someone onto a different license. The bill moves with them.",
        whenToRestrict: "Billing impact. Keep it to IT administrators and finance-approved designees.",
        scope: "All users.",
        defaultEnabled: false,
        platform: "both",
      },
      {
        id: "ur-bulk-license",
        name: "Bulk License Changes",
        description: "Changes the license for several users at once.",
        category: "License management",
        whatItGrants: "The user can change the license for many people at once, which moves the bill by that much more.",
        whenToRestrict: "High impact and billing-affecting, since one confirm can raise cost across many users. Keep it to senior IT administrators during planned changes.",
        scope: "All users.",
        defaultEnabled: false,
      },
      {
        id: "ur-bulk-import-users",
        name: "Bulk Import Users",
        description: "Imports users from a file, in the Users and Roles module and in Data Import/Export. It works on its own, without Create and Edit Users.",
        category: "User administration",
        whatItGrants: "The user can import users from a file. Through the file, the user can create users and edit their details, change a sign-in email, give, raise, lower and remove licenses, send invitations, create users already deactivated or archived, deactivate, reactivate and archive existing users, and give and take away roles. None of this needs the permission that controls the same action one by one. A file cannot unarchive a user, deactivate or archive an Account Owner or a user whose work Omne would ask to reassign, or give the Account Owner role. It only works with Access Users and Roles Module or access to Data Import/Export.",
        whenToRestrict: "One file can change many accounts, licenses, statuses and roles at once, beyond what the user's other permissions allow. Give it only to roles that should hold all of those powers, such as the Account Owner, Super Administrator and HR Administrator.",
        scope: null,
        defaultEnabled: false,
      },
      {
        id: "ur-export-users",
        name: "Bulk Export Users and Roles",
        description: "Exports users and roles to a file, from the Users and Roles module and in Data Import/Export. It works on its own, without Create and Edit Users or Create and Edit Roles.",
        category: "Documents",
        whatItGrants: "The user can export the users list with profiles, contact details, roles, licenses, and security and activity data, and the roles list with owners and users. Without it, Export is hidden. It only works with Access Users and Roles Module or access to Data Import/Export.",
        whenToRestrict: "A single export can take the whole directory, including personal data, out of Omne. Keep it to compliance officers and administrators running access reviews.",
        scope: null,
        defaultEnabled: false,
      },
      {
        id: "ur-assign-roles",
        name: "Assign Roles",
        description: "Controls which users belong to a role and which do not. A user with this permission can place someone into a role or take them out of it, for any role in the system. It covers only the act of assigning: it does not manage the role itself, and it does not cover the tasks or permission requests that a role may involve.",
        category: "Access control",
        whatItGrants: "The user can add other users to any existing role and remove them again. This is limited to assigning and unassigning. It does not let the user change what a role contains, and it does not include the operational work attached to a role. For example, a person in an HR or administrator position who keeps everyone in the right roles across the company could work entirely through this permission.",
        whenToRestrict: "Assigning someone to a role changes what that person can reach in the system, so this permission carries real weight even though it looks simple. It suits a user whose job is company-wide user management and nothing more. A team lead who only needs to look after the roles for their own department would not need this one, and would be better served by Manage Roles.",
        scope: "Entity scope: privilege ceiling.",
        defaultEnabled: false,
        thresholdConfig: {
          type: "descriptive",
          label: "Privilege Ceiling",
          description: "This role can only assign roles that are at or below its own privilege level. The ceiling is determined by the role hierarchy, administrators can assign any role, while managers can only assign roles up to their own tier.",
          unit: "",
          unitPosition: "prefix",
          helperText: "Users with this permission cannot assign roles that carry higher privileges than their own assigned roles. This prevents privilege escalation.",
        },
        platform: "both",
      },
      {
        id: "ur-manage-permissions",
        name: "Manage Granular Permissions",
        description: "Adds and removes direct permission assignments on one user, layered over what their roles grant. A role-inherited permission cannot be removed for a single user, and the most permissive source always wins.",
        category: "Access control",
        whatItGrants: "The user can grant one person a permission on top of their roles, and take that grant back. Anything a role gives cannot be removed this way.",
        whenToRestrict: "Direct per-user assignments complicate the model, so prefer role-based assignment. Keep it to security architects.",
        scope: "Per user, all modules.",
        defaultEnabled: false,
      },
      {
        id: "ur-create-role",
        name: "Create and Edit Roles",
        description: "Creates roles, edits role names, descriptions, metadata, and the permissions a role grants, and copies a role as a starting point, including adding and removing attachments on a role. Does not cover deactivating, archiving, or their reversals.",
        category: "Role management",
        whatItGrants: "The user can build and edit roles, choose what each one grants, and copy an existing role as a starting point, including adding and removing attachments on a role. Pausing and archiving a role are separate permissions.",
        whenToRestrict: "Role definitions are the foundation of the access model. Keep it to senior IT administrators and security architects.",
        scope: "All modules/permissions.",
        defaultEnabled: false,
      },
      {
        id: "ur-deactivate-role",
        name: "Deactivate or Reactivate Role",
        description: "Deactivates a single custom role and reactivates it. Deactivation is a reversible pause: it unassigns the role's current holders but keeps the role's permissions and owners, and reactivating restores it for reassignment.",
        category: "Role management",
        whatItGrants: "The user can pause a custom role and bring it back. Pausing takes the role off its current holders while the role itself, its permissions, and its owners stay as they were.",
        whenToRestrict: "Pausing a role is lower-authority than editing the role library. Team leads and department managers who need to pause a role can hold this without library authority.",
        scope: "Per role, one role at a time.",
        defaultEnabled: false,
      },
      {
        id: "ur-archive-role",
        name: "Archive or Unarchive Role",
        description: "Archives a single custom role and unarchives it. Archiving clears the role's owners and unassigns every holder but keeps its permissions; unarchiving returns it with those permissions and no users or owners.",
        category: "Destructive action",
        whatItGrants: "The user can archive a custom role, which clears its owners and takes it off everyone holding it. Unarchiving brings the role back with its permissions, ready to reassign users and owners.",
        whenToRestrict: "High-consequence, since it clears the role's owners and unassigns everyone in it. Keep it to senior System administrators and the Account Owner.",
        scope: "Per role, one role at a time.",
        defaultEnabled: false,
      },
      {
        id: "ur-bulk-roles-destructive",
        name: "Bulk Deactivate or Archive Roles",
        description: "Deactivates or archives several roles at once through the Roles bulk actions bar.",
        category: "Role management",
        whatItGrants: "The user can deactivate or archive several roles at once from the bulk actions bar. Everyone holding those roles is affected together.",
        whenToRestrict: "Higher impact than the single-role lifecycle actions, since one confirm affects many roles and their holders. Keep it to the Account Owner and senior System administrators. Granted independently of the single-role lifecycle permissions.",
        scope: "All roles.",
        defaultEnabled: false,
      },
      {
        id: "ur-manage-roles",
        name: "Manage Roles",
        description: "Lets a user look after the roles they are responsible for, either a specific set of roles or all of them. This goes beyond simple assignment: the user runs the membership of those roles today, and once the later features arrive, will also handle the operational side of a role, such as its tasks and permission requests. A user with this permission can also be made an owner of the roles in their scope. An owner runs the membership of a role but does not change what the role is made of.",
        category: "Access governance",
        whatItGrants: "The user can manage who belongs to the roles in their scope, adding and removing users, without any broader control over the wider access system. They can also be made an owner of those roles, which covers running membership and does not extend to editing the role definition. When the scope is set to all roles, the reach over membership is the same as Assign Roles for now. For example, an HR business partner responsible for a defined set of roles, or a team lead who runs the roles built for their own function, could use this permission.",
        whenToRestrict: "This permission suits a user who is meant to own particular roles in the context of the work those roles do, rather than assign roles as a routine task across the company. An HR business partner scoped to certain roles, or a manager who runs their department's roles, would be a natural fit. A user whose only job is broad, company-wide assignment would not need this one, and would be better served by Assign Roles.",
        scope: "Configured per user. Choose 'All roles' or pick specific roles. Designate Role Owner per role for approval routing.",
        defaultEnabled: false,
        thresholdConfig: {
          type: "descriptive",
          label: "Per-User Scope",
          description: "Each user with this permission configures which specific roles they can manage and whether they're a Role Owner for each. Scope is set on the User Detail page, not at the role level.",
          unit: "",
          unitPosition: "prefix",
          helperText: "Role members configure scope on their individual User Detail pages.",
        },
      },
      {
        id: "ur-view-audit",
        name: "View Access Audit Logs",
        description: "Shows login history, permission and role change logs, and security events. Read-only.",
        category: "Security policy",
        whatItGrants: "The user can read the access trail: sign-ins, who changed which role or permission, and security events.",
        whenToRestrict: "Audit logs expose sensitive access patterns. Keep it to security officers, compliance, and IT administrators.",
        scope: "All users, read-only.",
        defaultEnabled: false,
      },
    ],
  },

  // 15. Global MFA: 3 permissions
  {
    id: "global-mfa",
    name: "Global MFA",
    description: "Multi-factor authentication policies",
    icon: ShieldCheck,
    permissions: [
      {
        id: "mfa-access",
        name: "Access Global MFA Module",
        description: "Opens the Global MFA module, showing enforcement status, all policy cards, accepted authentication methods, enrollment progress, and the full activity log.",
        category: "Module access",
        whatItGrants: "The user can open Global MFA and see enforcement status, the policies in place, accepted methods, enrollment progress, and the activity log.",
        whenToRestrict: "Turn this on for Admin (Tenant) only. Turn this off for all other roles.",
        scope: "Organization-wide. On for Admin (Tenant) only.",
        defaultEnabled: false,
      },
      {
        id: "mfa-manage",
        name: "Manage Global MFA",
        description: "Creates, edits, and modifies MFA policies including enforcement rules, allowed methods, grace periods, and exemptions. Also covers user-level MFA support actions: resetting enrolled devices, generating bypass codes, and managing individual user MFA status.",
        category: "Policy administration",
        whatItGrants: "The user can write and change MFA policy, including who it covers, which methods count, and how long the grace period runs. They can also reset someone's device or issue a bypass code.",
        whenToRestrict: "Turn this on for Admin (Tenant) only. Turn this off for all other roles.",
        scope: "Organization-wide. Covers both policy-level administration and user-level MFA support actions.",
        defaultEnabled: false,
      },
      {
        id: "mfa-delete",
        name: "Delete MFA Policy",
        description: "Permanently removes an MFA policy. Deletion is irreversible. Users governed by that policy immediately lose its enforcement rules. Off by default for all roles including Admin (Tenant).",
        category: "Destructive action",
        whatItGrants: "The user can delete an MFA policy for good. Everyone it covered stops being governed by it straight away.",
        whenToRestrict: "Turn this off by default for all roles including Admin (Tenant). Must be explicitly granted.",
        scope: "Per policy. No bulk delete.",
        defaultEnabled: false,
      },
    ],
  },

  // 18. General Settings: 3 permissions (ERP-7228). Added to the compiled
  //     Permission Catalogue (Pioneer) in the 10 Sep 26 revision. All three
  //     are Off by default and all three need Full Access. Purchase Storage
  //     depends on the module gate, which Rule A in permission-recommendations.ts
  //     already covers. Edit Account Owner was removed from the catalogue on
  //     8 Oct 26 (only an Account Owner, signed in as themselves, can edit their
  //     own details, and Omne can change them from back office), and is parked
  //     in BACKLOGGED_PERMISSIONS below.
  {
    id: "general-settings",
    name: "General Settings",
    description: "Company profile, tenant-wide preferences, and storage",
    icon: SlidersHorizontal,
    permissions: [
      {
        id: "gs-access",
        name: "Access General Settings Module",
        description: "The master gate for General Settings: without it the module cannot be opened. Covers the Company Profile tab and the Storage tab, since storage usage is visible to anyone who can open the module.",
        category: "Module access",
        whatItGrants: "The user can open General Settings and read the Company Information, Account Owner, and Global Preferences cards, and open the Storage tab to see capacity, where it comes from, and consumption by type and by user. Read only.",
        whenToRestrict: "Off for every operational and sales role. On only for roles that configure, bill, or audit the tenant.",
        scope: null,
        defaultEnabled: false,
      },
      {
        id: "gs-edit-company",
        name: "Edit Company Information & Global Preferences",
        description: "Changes the company identity record and the tenant-wide display settings every module reads.",
        category: "Tenant configuration",
        whatItGrants: "The user can edit the Company Information card (name, logo, address, contacts, industry, legal registration, with the legal fields syncing to back office) and the Global Preferences card (timezone, date and time formats, default display currency, first day of week).",
        whenToRestrict: "Off for anyone who does not administer the tenant. Legal fields reach back office, and one preference change reaches every screen in the system.",
        scope: "Tenant-wide. Global preferences are read by every module.",
        defaultEnabled: false,
      },
      {
        id: "gs-purchase-storage",
        name: "Purchase Storage",
        description: "Commits the company to a storage upgrade request. Requires Access General Settings Module.",
        category: "Billing authority",
        whatItGrants: "The user can submit a request in the Upgrade Storage modal, reached from the Storage tab or from the low-storage warning. The request is emailed to the team for confirmation and no charge is taken.",
        whenToRestrict: "Off for anyone who does not own billing.",
        scope: null,
        defaultEnabled: false,
      },
    ],
  },

  // 19. Module Defaults: 2 permissions (ERP-8617). Added to the compiled
  //     Permission Catalogue (Pioneer) as the nineteenth module, reviewed with
  //     Eli on 9 Oct 26. Both need Full Access and both are web only. Access is
  //     On by default and Manage is Off. Manage has no effect without Access,
  //     because Module Defaults is the only place a default can be changed, and
  //     Rule A in permission-recommendations.ts carries that pairing. In
  //     Pioneer, Manage covers every module at once, Restore All Omne Defaults
  //     included; finer scoping by module group is backlogged.
  {
    id: "module-defaults",
    name: "Module Defaults",
    description: "Company-wide defaults for every active module, and restoring them to the Omne defaults",
    icon: Settings2,
    permissions: [
      {
        id: "md-access",
        name: "Access Module Defaults Module",
        description: "Opens Module Defaults in read-only mode.",
        category: "Module access",
        whatItGrants: "The user can open Module Defaults and view the defaults of every active module. Nothing can be changed.",
        whenToRestrict: "Viewing the defaults carries no risk. It stays off only for Field User roles, because it requires Full Access.",
        scope: null,
        defaultEnabled: true,
      },
      {
        id: "md-manage",
        name: "Manage Module Defaults",
        description: "Changes and restores the company's defaults for each module.",
        category: "Tenant configuration",
        whatItGrants: "The user can change any default in any active module. The user can also restore one module or all modules to the Omne defaults, which are the starting values that come with Omne. Restore All Omne Defaults is part of this permission.",
        whenToRestrict: "A change affects every user of that module. Keep it to System Configuration Manager, Account Owner, and Super Administrator. It covers every module at once, so a sales manager who holds it can also change the Receiving defaults.",
        scope: "Every active module at once. Finer scoping by module group is backlogged after Pioneer.",
        defaultEnabled: false,
      },
    ],
  },

];

// ─── Backlogged permissions ─────────────────────────────────────────────────
// Kept out of PERMISSION_MODULES, so no surface shows them (catalog, role and
// user permission lists, role maps, toggles, counts). Each entry records the
// module it came from; to restore one, move it back into that module's list
// and update the counts in src/test/permission-catalog.test.ts.
export const BACKLOGGED_PERMISSIONS: { moduleId: string; permission: Permission }[] = [
  // Hidden 12 Oct 26, may return later. Sat between gs-edit-company and
  // gs-purchase-storage.
  {
    moduleId: "general-settings",
    permission: {
      id: "gs-edit-account-owner",
      name: "Edit Account Owner",
      description: "Changes the Account Owner record: name, email, and phone.",
      category: "Elevated authority",
      whatItGrants: "The user can edit the Account Owner card. The Account Owner is Omnesoft's billing and contact record and is not necessarily a system user, so the email is contact information rather than a login. Where the owner is also a user, this permission governs that record in User Access Control, which is why Create and Edit Users excludes the Account Owner.",
      whenToRestrict: "Off for everyone but the Account Owner and the Super Administrator. This is the elevated corporate owner record tied to billing.",
      scope: "The Account Owner record only.",
      defaultEnabled: false,
    },
  },
  // Hidden 12 Oct 26, may return later. Sat between ship-access and
  // ship-create. The predefined roles and role templates no longer list it
  // (ERP-5546, Predefined Roles v2.12); any fixture that still does has it
  // dropped while it is parked here.
  {
    moduleId: "shipments",
    permission: {
      id: "ship-view-value",
      name: "View Declared Value on Shipment Documents",
      description: "Controls visibility of declared value on shipment documents.",
      category: "Financial visibility",
      whatItGrants: "The user can see the declared value field on shipment documents, including printed documents that leave with the shipment.",
      whenToRestrict: "Off for picking operatives: declared value reveals commercial terms and insurance levels, creating risk of targeted theft or insurance fraud. Dispatch and labeling roles may legitimately need it for customs, insurance, and carrier requirements.",
      scope: "Follows access scope. Cross-module: declared value visibility applies to printed documents that leave with the shipment.",
      defaultEnabled: false,
      platform: "both",
    },
  },
  // ERP-5506 AC30 (Predefined Roles v2.15, 9 Nov 26): these three Receiving
  // permissions do not ship in Pioneer. Parked so the catalog and every
  // all-access role count 129, not 132. Sat at the end of the Receiving
  // list, after rcv-labels, in this order.
  {
    moduleId: "receiving",
    permission: {
      id: "rcv-discrepancy",
      name: "Log and Resolve Discrepancies",
      description: "Controls who can raise and clear a receiving discrepancy.",
      category: "Exception handling",
      whatItGrants: "The user can flag and resolve a quantity or quality discrepancy found during receiving.",
      whenToRestrict: "For roles that receive but should not adjudicate discrepancies.",
      scope: "Discrepancy threshold applies.",
      defaultEnabled: false,
      thresholdConfig: {
        type: "quantity",
        label: "Discrepancy Threshold",
        description: "Set the maximum discrepancy this user can resolve independently. Discrepancies above this amount will escalate to a supervisor.",
        unit: "units",
        unitPosition: "suffix",
        helperText: "Discrepancies above this threshold will be escalated automatically.",
        defaultValue: "",
      },
    },
  },
  {
    moduleId: "receiving",
    permission: {
      id: "rcv-edit-confirmed",
      name: "Edit Receipts After Confirmation",
      description: "Post-confirmation correction authority: changes a receipt after it is final and writes the matching inventory change.",
      category: "Post-confirmation editing",
      whatItGrants: "The user can modify a confirmed receipt. The change writes a corresponding entry to the inventory ledger.",
      whenToRestrict: "For everyone except roles trusted to alter confirmed inventory. Keep it separate from whoever confirms receipts (separation of duties).",
      scope: null,
      defaultEnabled: false,
    },
  },
  {
    moduleId: "receiving",
    permission: {
      id: "rcv-void",
      name: "Void a Confirmed Receipt",
      description: "Reversal authority: rolls back a confirmed receipt in full.",
      category: "Reversal authority",
      whatItGrants: "The user can reverse a confirmed receipt. The reversal rolls back the entire inventory change the receipt created.",
      whenToRestrict: "For everyone except roles trusted with reversals. Keep it separate from whoever confirms receipts (separation of duties).",
      scope: null,
      defaultEnabled: false,
    },
  },
];

/** Ids of the parked permissions, for the role bundles and templates that
 *  still list them by spec. */
export const BACKLOGGED_PERMISSION_IDS: ReadonlySet<string> = new Set(
  BACKLOGGED_PERMISSIONS.map((b) => b.permission.id)
);

// ─── Default toggle seeding ─────────────────────────────────────────────────
// A brand-new role or user initializes every permission toggle to the catalog
// default (defaultEnabled), not all-off / all-on. Used by the Create Role and
// Create User wizards and any reset-to-defaults control.
export function buildDefaultToggles(): Record<string, boolean> {
  const init: Record<string, boolean> = {};
  PERMISSION_MODULES.forEach((mod) => {
    mod.permissions.forEach((p) => {
      init[p.id] = p.defaultEnabled;
    });
  });
  return init;
}

/** All-off toggle map: every permission set to false. Used to seed the Create
 *  Role wizard so a fresh role grants nothing until the admin opts in (or a
 *  template preselects a set). Optionally pass a list of permission IDs to turn
 *  on (e.g. a template's bundle). */
export function buildEmptyToggles(enabledIds: string[] = []): Record<string, boolean> {
  const enabled = new Set(enabledIds);
  const init: Record<string, boolean> = {};
  PERMISSION_MODULES.forEach((mod) => {
    mod.permissions.forEach((p) => {
      init[p.id] = enabled.has(p.id);
    });
  });
  return init;
}

/** Catalog-default toggle map for a single module (used to seed wizard steps per module). */
export function buildDefaultTogglesForModule(moduleId: string): Record<string, boolean> {
  const mod = PERMISSION_MODULES.find((m) => m.id === moduleId);
  const init: Record<string, boolean> = {};
  mod?.permissions.forEach((p) => {
    init[p.id] = p.defaultEnabled;
  });
  return init;
}

/** All-off toggle map for a single module.
 *
 *  The counterpart to `buildDefaultTogglesForModule` for surfaces that must not
 *  hand out access nobody asked for. Catalog defaults describe what a *role*
 *  typically starts with, so they belong to role authoring; a user being created
 *  starts with nothing granted directly and picks up access from the roles
 *  assigned to them. */
export function buildEmptyTogglesForModule(moduleId: string): Record<string, boolean> {
  const mod = PERMISSION_MODULES.find((m) => m.id === moduleId);
  const init: Record<string, boolean> = {};
  mod?.permissions.forEach((p) => {
    init[p.id] = false;
  });
  return init;
}
