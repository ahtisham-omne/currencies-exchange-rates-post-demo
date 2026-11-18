// ─── View in Module Data ─────────────────────────────────────────────────────
// Centralized content for the redesigned "View in Module" modal.
// Structured preview data for interactive UI previews, keyed by permission id.
// Entries are optional: a permission with no entry falls back to its catalog
// copy in ViewInModuleModal, so the map does not have to cover every id.

import type { ViewInModuleEntry } from "../components/permissions/view-in-module/types";

export type { ViewInModuleEntry } from "../components/permissions/view-in-module/types";

export const VIEW_IN_MODULE_DATA: Record<string, ViewInModuleEntry> = {
  // ─── Item Library (11 permissions) ──────────────────────────────────────────

  "item-access": {
    permissionName: "Access Items Module",
    moduleName: "Item Library",
    previewData: {
      type: "sidebarNav",
      moduleEntries: [
        { label: "Item Library", isTarget: true },
        { label: "Item Categories", isTarget: false },
        { label: "Cycle Count", isTarget: false },
        { label: "Unit of Measure", isTarget: false },
        { label: "Physical Inventory", isTarget: false },
        { label: "Warehouse Locations", isTarget: false },
        { label: "Partners & Partner Groups", isTarget: false },
        { label: "Purchase Orders", isTarget: false },
        { label: "Receiving", isTarget: false },
        { label: "Inventory Movement", isTarget: false },
        { label: "Shipments", isTarget: false },
        { label: "Quotes", isTarget: false },
        { label: "Sales Orders", isTarget: false },
        { label: "Users & Roles", isTarget: false },
        { label: "Global MFA", isTarget: false },
        { label: "General Settings", isTarget: false },
        { label: "Module Defaults", isTarget: false },
      ],
      pageTitle: "Item Library",
    },
    infoNoteOn: "This permission grants access to the complete Item Library module, allowing users to browse and manage inventory items.",
    infoNoteOff: "Without this permission, users cannot access the Item Library module and will see an access denied message.",
    path: "Navigation → Main Menu → Item Library",
  },

  "item-view-cost": {
    permissionName: "View Cost and Pricing Data",
    moduleName: "Item Library",
    previewData: {
      type: "listing",
      toolbarButtons: [],
      columns: [
        { header: "Item Name", highlighted: false },
        { header: "Category", highlighted: false },
        { header: "SKU", highlighted: false },
        { header: "Unit Cost", highlighted: true },
        { header: "Selling Price", highlighted: true },
        { header: "Margin %", highlighted: true },
        { header: "Status", highlighted: false },
      ],
      sampleRows: [
        { cells: ["Industrial Bearings SKU-4021", "Hardware", "SKU-4021", "$24.50", "$36.00", "31.6%", "Active"] },
        { cells: ["Copper Wire 12AWG", "Electrical", "CW-12A", "$8.75", "$14.25", "38.5%", "Active"] },
        { cells: ["Hydraulic Fluid ISO-46", "Fluids", "HF-ISO46", "$42.00", "$68.50", "38.9%", "Active"] },
        { cells: ["Steel Fasteners Box", "Hardware", "SF-BOX", "$5.25", "$8.95", "41.9%", "Active"] },
      ],
    },
    infoNoteOn: "Item cost and pricing figures are visible on the item record and in Items screens, exports, and printed documents: selling price, configured purchasing price, last purchase price, open PO value, and Sales tab revenue.",
    infoNoteOff: "Without this permission the item cost and pricing figures are hidden. Money visibility in other modules is governed by their own permissions and is unaffected.",
    path: "Item Library → Items List → Financial Data Columns",
  },

  "item-create-edit": {
    permissionName: "Create and Edit Items",
    moduleName: "Item Library",
    previewData: {
      type: "listing",
      toolbarButtons: [
        { label: "Create Item", highlighted: true },
        { label: "Import", highlighted: false },
        { label: "Export", highlighted: false },
        { label: "Filter", highlighted: false },
      ],
      columns: [
        { header: "Item Name", highlighted: false },
        { header: "Category", highlighted: false },
        { header: "SKU", highlighted: false },
        { header: "Unit Cost", highlighted: false },
        { header: "Selling Price", highlighted: false },
        { header: "Status", highlighted: false },
      ],
      sampleRows: [
        { cells: ["Industrial Bearings SKU-4021", "Hardware", "SKU-4021", "$24.50", "$36.00", "Active"] },
        { cells: ["Copper Wire 12AWG", "Electrical", "CW-12A", "$8.75", "$14.25", "Active"] },
        { cells: ["Hydraulic Fluid ISO-46", "Fluids", "HF-ISO46", "$42.00", "$68.50", "Active"] },
        { cells: ["Steel Fasteners Box", "Hardware", "SF-BOX", "$5.25", "$8.95", "Active"] },
      ],
      rowActions: [
        { label: "View", highlighted: false },
        { label: "Edit", highlighted: true },
        { label: "Duplicate", highlighted: false },
        { label: "Archive", highlighted: false },
        { label: "Deactivate", highlighted: false },
      ],
    },
    infoNoteOn: "This permission grants the ability to create new items and edit their basic information, attachments, and configuration.",
    infoNoteOff: "Without this permission, users cannot create items or edit their details or configuration; the create and edit controls are disabled.",
    path: "Item Library → Items List → Create Button & Row Edit Actions",
  },


  "item-edit-minmax": {
    permissionName: "Edit Min/Max Stock Levels",
    moduleName: "Item Library",
    previewData: {
      type: "detail",
      headerTitle: "Stock Thresholds",
      fields: [
        { label: "Reorder Point", value: "500 units", highlighted: true, offState: "readonly" as const },
        { label: "Min Stock", value: "200 units", highlighted: true, offState: "readonly" as const },
        { label: "Max Stock", value: "5,000 units", highlighted: true, offState: "readonly" as const },
        { label: "Safety Stock", value: "150 units", highlighted: true, offState: "readonly" as const },
      ],
    },
    infoNoteOn: "This permission allows users to set reorder points, minimum stock, maximum stock, and safety stock levels.",
    infoNoteOff: "Without this permission, users can view but not edit stock thresholds; all threshold fields are read-only.",
    path: "Item Library → Item Detail → Inventory Settings Tab → Stock Threshold Fields",
  },

  "item-manage-vendors": {
    permissionName: "Manage Vendor Qualification",
    moduleName: "Item Library",
    previewData: {
      type: "listing",
      toolbarButtons: [
        { label: "Add Vendor", highlighted: true },
      ],
      columns: [
        { header: "Rank", highlighted: false },
        { header: "Vendor Name", highlighted: false },
        { header: "Contact", highlighted: false },
        { header: "Lead Time", highlighted: false },
        { header: "Unit Cost", highlighted: false },
      ],
      sampleRows: [
        { cells: ["Primary", "Acme Corp", "John Smith", "5 days", "$24.50"] },
        { cells: ["Secondary", "Delta Supply", "Sarah Jones", "7 days", "$25.00"] },
        { cells: ["Backup", "GlobalTech", "Mike Chen", "10 days", "$26.25"] },
      ],
      rowActions: [
        { label: "View", highlighted: false },
        { label: "Edit", highlighted: false },
        { label: "Remove", highlighted: true },
      ],
    },
    infoNoteOn: "This permission allows users to add, remove, and reorder qualified vendors for items.",
    infoNoteOff: "Without this permission, users can view vendors but cannot add, remove, or reorder them.",
    path: "Item Library → Item Detail → Vendors Tab → Vendor List & Management",
  },

  "item-archive": {
    permissionName: "Archive/Deactivate Items",
    moduleName: "Item Library",
    previewData: {
      type: "actionsMenu",
      contextLabel: "Item Row: Actions Menu",
      actions: [
        { label: "View", highlighted: false },
        { label: "Edit", highlighted: false },
        { label: "Duplicate", highlighted: false },
        { label: "Archive", highlighted: true },
        { label: "Deactivate", highlighted: true, isDestructive: true },
      ],
      annotationText: "Lifecycle actions removed, archiving and deactivation are not available.",
    },
    infoNoteOn: "This permission allows users to archive or deactivate items to remove them from active use.",
    infoNoteOff: "Without this permission, users cannot archive or deactivate items; lifecycle controls are unavailable.",
    path: "Item Library → Items List → Row Actions → Archive & Deactivate Options",
  },

  "item-bulk-import": {
    permissionName: "Bulk Import/Mass Edit",
    moduleName: "Item Library",
    previewData: {
      type: "listing",
      toolbarButtons: [
        { label: "Create Item", highlighted: false },
        { label: "Import", highlighted: true },
        { label: "Mass Edit", highlighted: true },
        { label: "Export", highlighted: false },
      ],
      columns: [
        { header: "Item Name", highlighted: false },
        { header: "Category", highlighted: false },
        { header: "SKU", highlighted: false },
        { header: "Unit Cost", highlighted: false },
        { header: "Selling Price", highlighted: false },
        { header: "Status", highlighted: false },
      ],
      sampleRows: [
        { cells: ["Industrial Bearings SKU-4021", "Hardware", "SKU-4021", "$24.50", "$36.00", "Active"] },
        { cells: ["Copper Wire 12AWG", "Electrical", "CW-12A", "$8.75", "$14.25", "Active"] },
        { cells: ["Hydraulic Fluid ISO-46", "Fluids", "HF-ISO46", "$42.00", "$68.50", "Active"] },
        { cells: ["Steel Fasteners Box", "Hardware", "SF-BOX", "$5.25", "$8.95", "Active"] },
      ],
    },
    infoNoteOn: "This permission allows users to import items in bulk and perform mass edits on multiple items at once.",
    infoNoteOff: "Without this permission, users cannot use bulk import or mass edit functions; these operations are unavailable.",
    path: "Item Library → Items List → Bulk Operation Buttons",
  },


  "item-manage-pricing": {
    permissionName: "Edit Item Pricing",
    moduleName: "Item Library",
    previewData: {
      type: "listing",
      toolbarButtons: [
        { label: "Add Pricing Rule", highlighted: true },
      ],
      columns: [
        { header: "Rule Name", highlighted: false },
        { header: "Price", highlighted: false },
        { header: "Min Qty", highlighted: false },
        { header: "Type", highlighted: false },
        { header: "Status", highlighted: false },
      ],
      sampleRows: [
        { cells: ["Standard Price", "$36.00", "1", "Base", "Active"] },
        { cells: ["Volume Tier 1", "$34.00", "100", "Volume", "Active"] },
        { cells: ["Partner Price", "$31.50", "50", "Customer Group", "Active"] },
        { cells: ["Off-Season Discount", "$28.50", "1", "Date Range", "Inactive"] },
      ],
      rowActions: [
        { label: "Edit", highlighted: true },
        { label: "Duplicate", highlighted: false },
        { label: "Delete", highlighted: true },
      ],
    },
    infoNoteOn: "This permission allows users to set the item's selling price, custom price per unit, price points, and partner-specific pricing.",
    infoNoteOff: "Without this permission, users can view the item's selling-side pricing but cannot change it.",
    path: "Item Library → Item Detail → Pricing Tab → Pricing Rules Table",
  },

  "item-valuation-method": {
    permissionName: "Manage Inventory Valuation Method",
    moduleName: "Item Library",
    previewData: {
      type: "detail",
      headerTitle: "Valuation Configuration",
      fields: [
        { label: "Inventory Valuation Method", value: "Weighted Average", highlighted: true, offState: "disabled" as const },
        { label: "Last Changed", value: "01/15/2026", highlighted: false, offState: "disabled" as const },
        { label: "Changed By", value: "Sarah Chen", highlighted: false, offState: "disabled" as const },
      ],
      actionButtons: [
        { label: "Save", highlighted: true },
      ],
    },
    infoNoteOn: "This permission allows users to set the system-wide inventory valuation method to FIFO, LIFO, WAC, or Specific Identification.",
    infoNoteOff: "Without this permission, users can view but not change the inventory valuation method; the valuation setting is locked.",
    path: "Item Library → Item Detail → Valuation Settings Tab → Valuation Method Dropdown",
  },

  // ─── Item Categories (3 permissions) ────────────────────────────────────────

  "cat-access": {
    permissionName: "Access Categories Module",
    moduleName: "Item Categories",
    previewData: {
      type: "sidebarNav",
      moduleEntries: [
        { label: "Item Library", isTarget: false },
        { label: "Item Categories", isTarget: true },
        { label: "Cycle Count", isTarget: false },
        { label: "Unit of Measure", isTarget: false },
        { label: "Physical Inventory", isTarget: false },
        { label: "Warehouse Locations", isTarget: false },
        { label: "Partners & Partner Groups", isTarget: false },
        { label: "Purchase Orders", isTarget: false },
        { label: "Receiving", isTarget: false },
        { label: "Inventory Movement", isTarget: false },
        { label: "Shipments", isTarget: false },
        { label: "Quotes", isTarget: false },
        { label: "Sales Orders", isTarget: false },
        { label: "Users & Roles", isTarget: false },
        { label: "Global MFA", isTarget: false },
        { label: "General Settings", isTarget: false },
        { label: "Module Defaults", isTarget: false },
      ],
      pageTitle: "Item Categories",
    },
    infoNoteOn: "This permission grants access to the Item Categories module, allowing users to manage product categories.",
    infoNoteOff: "Without this permission, users cannot access the Item Categories module and will see an access denied message.",
    path: "Navigation → Main Menu → Item Categories",
  },

  "cat-create-edit": {
    permissionName: "Create/Edit/Deactivate Categories",
    moduleName: "Item Categories",
    previewData: {
      type: "listing",
      toolbarButtons: [
        { label: "Create Category", highlighted: true },
        { label: "Import", highlighted: false },
        { label: "Export", highlighted: false },
        { label: "Filter", highlighted: false },
      ],
      columns: [
        { header: "Category Name", highlighted: false },
        { header: "Parent Category", highlighted: false },
        { header: "Item Count", highlighted: false },
        { header: "Status", highlighted: false },
      ],
      sampleRows: [
        { cells: ["Hardware", "-", "1,247", "Active"] },
        { cells: ["Electrical", "-", "892", "Active"] },
        { cells: ["Fluids & Lubricants", "-", "456", "Active"] },
        { cells: ["Fasteners & Hardware", "Hardware", "734", "Active"] },
      ],
      rowActions: [
        { label: "View", highlighted: false },
        { label: "Edit", highlighted: true },
        { label: "Duplicate", highlighted: false },
        { label: "Deactivate", highlighted: true },
      ],
    },
    infoNoteOn: "This permission allows users to create new categories, edit existing categories, and deactivate categories.",
    infoNoteOff: "Without this permission, users can view categories but cannot create, edit, or deactivate them.",
    path: "Item Categories → Categories List → Create Button & Row Actions",
  },

  "cat-bulk-ops": {
    permissionName: "Bulk Actions Through Categories",
    moduleName: "Item Categories",
    previewData: {
      type: "listing",
      toolbarButtons: [
        { label: "Bulk Update Items", highlighted: true },
      ],
      columns: [
        { header: "Item Name", highlighted: false },
        { header: "SKU", highlighted: false },
        { header: "Unit Cost", highlighted: false },
        { header: "Selling Price", highlighted: false },
        { header: "Status", highlighted: false },
      ],
      sampleRows: [
        { cells: ["Industrial Bearings SKU-4021", "SKU-4021", "$24.50", "$36.00", "Active"] },
        { cells: ["Steel Fasteners Box", "SF-BOX", "$5.25", "$8.95", "Active"] },
        { cells: ["Stainless Steel Springs", "SS-SPRING", "$12.75", "$19.95", "Active"] },
        { cells: ["Aluminum Brackets", "AL-BRACK", "$8.50", "$13.25", "Active"] },
      ],
    },
    infoNoteOn: "This permission allows users to perform bulk updates on items within a category such as changing prices or status in bulk.",
    infoNoteOff: "Without this permission, users cannot perform bulk actions on items within categories; bulk update controls are unavailable.",
    path: "Item Categories → Category Detail → Items Tab → Bulk Update Button",
  },

  // ─── Cycle Count (4 permissions) ────────────────────────────────────────────

  "cc-access": {
    permissionName: "Access Cycle Count Module",
    moduleName: "Cycle Count",
    previewData: {
      type: "sidebarNav",
      moduleEntries: [
        { label: "Item Library", isTarget: false },
        { label: "Item Categories", isTarget: false },
        { label: "Cycle Count", isTarget: true },
        { label: "Unit of Measure", isTarget: false },
        { label: "Physical Inventory", isTarget: false },
        { label: "Warehouse Locations", isTarget: false },
        { label: "Partners & Partner Groups", isTarget: false },
        { label: "Purchase Orders", isTarget: false },
        { label: "Receiving", isTarget: false },
        { label: "Inventory Movement", isTarget: false },
        { label: "Shipments", isTarget: false },
        { label: "Quotes", isTarget: false },
        { label: "Sales Orders", isTarget: false },
        { label: "Users & Roles", isTarget: false },
        { label: "Global MFA", isTarget: false },
        { label: "General Settings", isTarget: false },
        { label: "Module Defaults", isTarget: false },
      ],
      pageTitle: "Cycle Count",
    },
    infoNoteOn: "This permission grants access to the Cycle Count module for managing inventory count operations.",
    infoNoteOff: "Without this permission, users cannot access the Cycle Count module.",
    path: "Navigation → Main Menu → Cycle Count",
  },

  "cc-create-plan": {
    permissionName: "Create/Edit/Archive Cycle Counts",
    moduleName: "Cycle Count",
    previewData: {
      type: "listing",
      toolbarButtons: [
        { label: "Create Cycle Count", highlighted: true },
        { label: "Export", highlighted: false },
        { label: "Filter", highlighted: false },
      ],
      columns: [
        { header: "Cycle Count Name", highlighted: false },
        { header: "Location", highlighted: false },
        { header: "Status", highlighted: false },
        { header: "Items", highlighted: false },
        { header: "Scheduled Date", highlighted: false },
      ],
      sampleRows: [
        { cells: ["Monthly Hardware Count", "Main Warehouse", "In Progress", "342", "2026-03-25"] },
        { cells: ["Quarterly Electrical", "Satellite Warehouse", "Pending", "156", "2026-04-10"] },
        { cells: ["Spot Check - Fluid Section", "Main Warehouse", "Completed", "78", "2026-03-22"] },
        { cells: ["Annual Physical Inventory", "All Locations", "Scheduled", "2,450", "2026-05-01"] },
      ],
      rowActions: [
        { label: "View", highlighted: false },
        { label: "Edit", highlighted: true },
        { label: "Duplicate", highlighted: false },
        { label: "Archive", highlighted: true },
        { label: "Deactivate", highlighted: true },
      ],
    },
    infoNoteOn: "This permission allows users to create new cycle counts, edit existing counts, and archive completed counts.",
    infoNoteOff: "Without this permission, users can view cycle counts but cannot create, edit, or archive them.",
    path: "Cycle Count → Cycle Counts List → Create Button & Row Actions",
  },

  "cc-execute": {
    permissionName: "Execute Cycle Counts",
    moduleName: "Cycle Count",
    previewData: {
      type: "detail",
      headerTitle: "Execution Panel: Monthly Hardware Count",
      fields: [
        { label: "Item Name", value: "Industrial Bearings SKU-4021", highlighted: false, offState: "disabled" as const },
        { label: "SKU", value: "SKU-4021", highlighted: false, offState: "disabled" as const },
        { label: "Quantity on System", value: "2,450 units", highlighted: false, offState: "disabled" as const },
        { label: "Quantity Counted", value: "-", highlighted: true, offState: "disabled" as const },
        { label: "Variance", value: "-", highlighted: false, offState: "disabled" as const },
      ],
      actionButtons: [
        { label: "Confirm Item Count", highlighted: true },
        { label: "Submit Results", highlighted: true },
      ],
    },
    infoNoteOn: "This permission allows users to execute cycle counts by entering counted quantities and submitting count results.",
    infoNoteOff: "Without this permission, users cannot perform count operations; all execution controls are disabled.",
    path: "Cycle Count → Cycle Count Detail → Execution Panel → Count Entry & Submit",
  },

  "cc-adjust": {
    permissionName: "Approve Counts and Adjust Inventory",
    moduleName: "Cycle Count",
    previewData: {
      type: "detail",
      headerTitle: "Review & Approval: Monthly Hardware Count",
      fields: [
        { label: "Total Items Counted", value: "342", highlighted: false, offState: "disabled" as const },
        { label: "Items with Variance", value: "28", highlighted: false, offState: "disabled" as const },
        { label: "Total Variance Value", value: "$3,420.50", highlighted: false, offState: "disabled" as const },
        { label: "Industrial Bearings SKU-4021", value: "Sys: 2,450 → Counted: 2,420 (−30)", highlighted: true, offState: "disabled" as const },
        { label: "Copper Wire 12AWG", value: "Sys: 1,850 → Counted: 1,880 (+30)", highlighted: true, offState: "disabled" as const },
      ],
      actionButtons: [
        { label: "Approve", highlighted: true },
        { label: "Reject", highlighted: true },
        { label: "Post Adjustment", highlighted: true },
      ],
    },
    infoNoteOn: "This permission allows users to review cycle count variances, approve counts, and post inventory adjustments.",
    infoNoteOff: "Without this permission, users can view count results but cannot approve or adjust inventory based on counts.",
    path: "Cycle Count → Cycle Count Detail → Review & Approval Panel → Approval & Adjustment Buttons",
  },

  // ─── Unit of Measure (2 permissions) ────────────────────────────────────────

  "uom-access": {
    permissionName: "Access UOM Module",
    moduleName: "Unit of Measure",
    previewData: {
      type: "sidebarNav",
      moduleEntries: [
        { label: "Item Library", isTarget: false },
        { label: "Item Categories", isTarget: false },
        { label: "Cycle Count", isTarget: false },
        { label: "Unit of Measure", isTarget: true },
        { label: "Physical Inventory", isTarget: false },
        { label: "Warehouse Locations", isTarget: false },
        { label: "Partners & Partner Groups", isTarget: false },
        { label: "Purchase Orders", isTarget: false },
        { label: "Receiving", isTarget: false },
        { label: "Inventory Movement", isTarget: false },
        { label: "Shipments", isTarget: false },
        { label: "Quotes", isTarget: false },
        { label: "Sales Orders", isTarget: false },
        { label: "Users & Roles", isTarget: false },
        { label: "Global MFA", isTarget: false },
        { label: "General Settings", isTarget: false },
        { label: "Module Defaults", isTarget: false },
      ],
      pageTitle: "Unit of Measure",
    },
    infoNoteOn: "This permission grants access to the Unit of Measure module for managing inventory UOM settings.",
    infoNoteOff: "Without this permission, users cannot access the Unit of Measure module.",
    path: "Navigation → Main Menu → Unit of Measure",
  },

  "uom-manage": {
    permissionName: "Manage Units of Measure",
    moduleName: "Unit of Measure",
    previewData: {
      type: "listing",
      toolbarButtons: [
        { label: "Create UOM", highlighted: true },
        { label: "Import", highlighted: true },
        { label: "Export", highlighted: true },
        { label: "Filter", highlighted: false },
      ],
      columns: [
        { header: "UOM Code", highlighted: false },
        { header: "UOM Name", highlighted: false },
        { header: "Category", highlighted: false },
        { header: "System", highlighted: false },
        { header: "Status", highlighted: false },
      ],
      sampleRows: [
        { cells: ["EA", "Each", "Base Units", "Base", "Active"] },
        { cells: ["BOX", "Box", "Packaging", "Converted", "Active"] },
        { cells: ["CASE", "Case", "Packaging", "Converted", "Active"] },
        { cells: ["KG", "Kilogram", "Weight", "Converted", "Active"] },
      ],
      rowActions: [
        { label: "View", highlighted: false },
        { label: "Edit", highlighted: true },
        { label: "Duplicate", highlighted: false },
        { label: "Archive", highlighted: true },
        { label: "Deactivate", highlighted: true },
      ],
    },
    infoNoteOn: "This permission allows users to create, edit, import, and archive units of measure.",
    infoNoteOff: "Without this permission, users can view UOM settings but cannot create, edit, or manage them.",
    path: "Unit of Measure → UOM List → Create/Import/Export Buttons & Row Actions",
  },

  // ─── Physical Inventory (6 permissions) ─────────────────────────────────────

  "pi-access": {
    permissionName: "Access Physical Inventory Module",
    moduleName: "Physical Inventory",
    previewData: {
      type: "sidebarNav",
      moduleEntries: [
        { label: "Item Library", isTarget: false },
        { label: "Item Categories", isTarget: false },
        { label: "Cycle Count", isTarget: false },
        { label: "Unit of Measure", isTarget: false },
        { label: "Physical Inventory", isTarget: true },
        { label: "Warehouse Locations", isTarget: false },
        { label: "Partners & Partner Groups", isTarget: false },
        { label: "Purchase Orders", isTarget: false },
        { label: "Receiving", isTarget: false },
        { label: "Inventory Movement", isTarget: false },
        { label: "Shipments", isTarget: false },
        { label: "Quotes", isTarget: false },
        { label: "Sales Orders", isTarget: false },
        { label: "Users & Roles", isTarget: false },
        { label: "Global MFA", isTarget: false },
        { label: "General Settings", isTarget: false },
        { label: "Module Defaults", isTarget: false },
      ],
      pageTitle: "Physical Inventory",
    },
    infoNoteOn: "This permission grants access to the Physical Inventory module to view on-hand inventory levels and locations.",
    infoNoteOff: "Without this permission, users cannot access the Physical Inventory module.",
    path: "Navigation → Main Menu → Physical Inventory",
  },

  "pi-view-valuation": {
    permissionName: "View Inventory Valuation Data",
    moduleName: "Physical Inventory",
    previewData: {
      type: "listing",
      toolbarButtons: [],
      columns: [
        { header: "Item Name", highlighted: false },
        { header: "Location", highlighted: false },
        { header: "Category", highlighted: false },
        { header: "Qty On Hand", highlighted: false },
        { header: "Unit Cost", highlighted: true },
        { header: "Total Value", highlighted: true },
        { header: "Status", highlighted: false },
      ],
      sampleRows: [
        { cells: ["Industrial Bearings SKU-4021", "Bin A-12", "Hardware", "2,450", "$24.50", "$59,925.00", "In Stock"] },
        { cells: ["Copper Wire 12AWG", "Bin C-05", "Electrical", "1,850", "$8.75", "$16,187.50", "In Stock"] },
        { cells: ["Hydraulic Fluid ISO-46", "Tank-02", "Fluids", "650", "$42.00", "$27,300.00", "Low Stock"] },
        { cells: ["Steel Fasteners Box", "Bin A-20", "Hardware", "3,200", "$5.25", "$16,800.00", "In Stock"] },
      ],
    },
    infoNoteOn: "This permission allows users to view unit costs and total valuations for inventory items across all locations.",
    infoNoteOff: "Without this permission, users cannot see valuation data; financial columns are hidden.",
    path: "Physical Inventory → Inventory List → Valuation Data Columns (Unit Cost & Total Value)",
  },

  "pi-quarantine": {
    permissionName: "Quarantine and Check Out Inventory",
    moduleName: "Physical Inventory",
    previewData: {
      type: "listing",
      toolbarButtons: [
        { label: "Start Quarantine", highlighted: true },
        { label: "End Quarantine", highlighted: true },
        { label: "Check Out", highlighted: true },
        { label: "Check In", highlighted: true },
      ],
      columns: [
        { header: "Serial / Lot", highlighted: false },
        { header: "Item Name", highlighted: false },
        { header: "Location", highlighted: false },
        { header: "Qty", highlighted: false },
        { header: "Availability", highlighted: true },
      ],
      sampleRows: [
        { cells: ["SN-88412", "Industrial Bearings SKU-4021", "Bin A-12", "1", "Quarantined"] },
        { cells: ["LOT-2207-B", "Hydraulic Fluid ISO-46", "Tank-02", "180", "Checked Out"] },
        { cells: ["LOT-2207-B.1", "Hydraulic Fluid ISO-46", "Tank-02", "20", "Quarantined (child lot)"] },
        { cells: ["SN-88420", "Industrial Bearings SKU-4021", "Bin A-12", "1", "Available"] },
      ],
    },
    infoNoteOn: "This permission allows users to quarantine and check out serialized units and lot-tracked items, including the bulk variants. Flagged stock shows as unavailable on the availability context view.",
    infoNoteOff: "Without this permission, the quarantine, check out, and check in actions are hidden; users can still view unit and lot availability.",
    path: "Physical Inventory → Serial Units / Lots → Quarantine & Check Out Actions",
  },

  /* ERP-11305 AC 1: web only, Off by default, standing alone (Eli, 5 Nov 2026). */
  "pi-bulk-import": {
    permissionName: "Bulk Import Physical Inventory",
    moduleName: "Physical Inventory",
    previewData: {
      type: "listing",
      toolbarButtons: [{ label: "Import", highlighted: true }],
      columns: [
        { header: "Item Name", highlighted: false },
        { header: "Location", highlighted: false },
        { header: "Category", highlighted: false },
        { header: "Qty On Hand", highlighted: false },
        { header: "Status", highlighted: false },
      ],
      sampleRows: [
        { cells: ["Industrial Bearings SKU-4021", "Bin A-12", "Hardware", "2,450", "In Stock"] },
        { cells: ["Copper Wire 12AWG", "Bin C-05", "Electrical", "1,850", "In Stock"] },
        { cells: ["Hydraulic Fluid ISO-46", "Tank-02", "Fluids", "650", "Low Stock"] },
      ],
    },
    infoNoteOn: "The Import action is available: bring stock in from a template file, here and in Data Import/Export.",
    infoNoteOff: "Without this permission, Import is hidden and Cancel Import is not shown.",
    path: "Physical Inventory → Actions → Import",
  },

  "pi-bulk-export": {
    permissionName: "Bulk Export Physical Inventory",
    moduleName: "Physical Inventory",
    previewData: {
      type: "listing",
      toolbarButtons: [{ label: "Export", highlighted: true }],
      columns: [
        { header: "Item Name", highlighted: false },
        { header: "Location", highlighted: false },
        { header: "Category", highlighted: false },
        { header: "Qty On Hand", highlighted: false },
        { header: "Status", highlighted: false },
      ],
      sampleRows: [
        { cells: ["Industrial Bearings SKU-4021", "Bin A-12", "Hardware", "2,450", "In Stock"] },
        { cells: ["Copper Wire 12AWG", "Bin C-05", "Electrical", "1,850", "In Stock"] },
        { cells: ["Hydraulic Fluid ISO-46", "Tank-02", "Fluids", "650", "Low Stock"] },
      ],
    },
    infoNoteOn: "The Export action is available: export stock data to a file, here and in Data Import/Export.",
    infoNoteOff: "Without this permission, Export is hidden.",
    path: "Physical Inventory → Actions → Export",
  },

  "pi-increase": {
    permissionName: "Increase Inventory",
    moduleName: "Physical Inventory",
    previewData: {
      type: "actionsMenu",
      contextLabel: "Physical Inventory: Item Actions",
      actions: [
        { label: "View", highlighted: false },
        { label: "Increase Inventory", highlighted: true },
        { label: "Decrease Inventory", highlighted: false },
      ],
      annotationText: "Increase inventory controls removed, inventory cannot be increased.",
    },
    infoNoteOn: "This permission allows users to increase inventory quantities through adjustment transactions.",
    infoNoteOff: "Without this permission, users cannot increase inventory; the increase action is unavailable.",
    path: "Physical Inventory → Inventory List & Detail → Row Actions → Increase Inventory Option",
  },

  "pi-decrease": {
    permissionName: "Decrease Inventory",
    moduleName: "Physical Inventory",
    previewData: {
      type: "actionsMenu",
      contextLabel: "Physical Inventory: Item Actions",
      actions: [
        { label: "View", highlighted: false },
        { label: "Increase Inventory", highlighted: false },
        { label: "Decrease Inventory", highlighted: true },
      ],
      annotationText: "Decrease inventory controls removed, inventory cannot be decreased.",
    },
    infoNoteOn: "This permission allows users to decrease inventory quantities through adjustment transactions.",
    infoNoteOff: "Without this permission, users cannot decrease inventory; the decrease action is unavailable.",
    path: "Physical Inventory → Inventory List & Detail → Row Actions → Decrease Inventory Option",
  },

  // ─── Warehouse Locations (3 permissions) ────────────────────────────────────

  "wl-access": {
    permissionName: "Access Warehouse Locations Module",
    moduleName: "Warehouse Locations",
    previewData: {
      type: "sidebarNav",
      moduleEntries: [
        { label: "Item Library", isTarget: false },
        { label: "Item Categories", isTarget: false },
        { label: "Cycle Count", isTarget: false },
        { label: "Unit of Measure", isTarget: false },
        { label: "Physical Inventory", isTarget: false },
        { label: "Warehouse Locations", isTarget: true },
        { label: "Partners & Partner Groups", isTarget: false },
        { label: "Purchase Orders", isTarget: false },
        { label: "Receiving", isTarget: false },
        { label: "Inventory Movement", isTarget: false },
        { label: "Shipments", isTarget: false },
        { label: "Quotes", isTarget: false },
        { label: "Sales Orders", isTarget: false },
        { label: "Users & Roles", isTarget: false },
        { label: "Global MFA", isTarget: false },
        { label: "General Settings", isTarget: false },
        { label: "Module Defaults", isTarget: false },
      ],
      pageTitle: "Warehouse Locations",
    },
    infoNoteOn: "This permission grants access to the Warehouse Locations module for managing storage locations.",
    infoNoteOff: "Without this permission, users cannot access the Warehouse Locations module.",
    path: "Navigation → Main Menu → Warehouse Locations",
  },

  "wl-create-edit": {
    permissionName: "Create and Edit Locations",
    moduleName: "Warehouse Locations",
    previewData: {
      type: "listing",
      toolbarButtons: [
        { label: "Create Location", highlighted: true },
        { label: "Create Zone", highlighted: true },
        { label: "Import", highlighted: false },
        { label: "Export", highlighted: false },
        { label: "Filter", highlighted: false },
      ],
      columns: [
        { header: "Location Code", highlighted: false },
        { header: "Location Name", highlighted: false },
        { header: "Warehouse", highlighted: false },
        { header: "Zone", highlighted: false },
        { header: "Type", highlighted: false },
        { header: "Capacity", highlighted: false },
        { header: "Status", highlighted: false },
      ],
      sampleRows: [
        { cells: ["BIN-A-12", "Bin A-12", "Main Warehouse", "Hardware Section", "Bin", "500 units", "Active"] },
        { cells: ["BIN-A-20", "Bin A-20", "Main Warehouse", "Hardware Section", "Bin", "1,000 units", "Active"] },
        { cells: ["TANK-02", "Tank 02", "Main Warehouse", "Fluid Storage", "Tank", "10,000L", "Active"] },
        { cells: ["RACK-C-05", "Rack C-05", "Satellite Warehouse", "Electrical", "Rack", "750 units", "Active"] },
      ],
      rowActions: [
        { label: "View", highlighted: false },
        { label: "Edit", highlighted: true },
        { label: "Move Items", highlighted: false },
        { label: "Merge Locations", highlighted: true },
      ],
    },
    infoNoteOn: "This permission allows users to create new warehouse locations and zones, and edit existing location details.",
    infoNoteOff: "Without this permission, users can view locations but cannot create or edit them.",
    path: "Warehouse Locations → Locations List → Create Location & Zone Buttons & Edit Action",
  },

  "wl-deactivate": {
    permissionName: "Archive Locations",
    moduleName: "Warehouse Locations",
    previewData: {
      type: "actionsMenu",
      contextLabel: "Warehouse Locations: Row Actions",
      actions: [
        { label: "View", highlighted: false },
        { label: "Edit", highlighted: false },
        { label: "Move Items", highlighted: false },
        { label: "Archive", highlighted: true },
        { label: "Deactivate", highlighted: true, isDestructive: true },
      ],
      annotationText: "Location lifecycle controls removed, archiving and deactivation are not available.",
    },
    infoNoteOn: "This permission allows users to archive or deactivate warehouse locations to remove them from active use.",
    infoNoteOff: "Without this permission, users cannot archive or deactivate locations; lifecycle controls are unavailable.",
    path: "Warehouse Locations → Locations List → Row Actions → Archive & Deactivate Options",
  },

  "prt-access": {
    permissionName: "Access Partners Module",
    moduleName: "Partners & Partner Groups",
    previewData: {
      type: "sidebarNav",
      moduleEntries: [
      { label: "Item Library", isTarget: false },
      { label: "Item Categories", isTarget: false },
      { label: "Cycle Count", isTarget: false },
      { label: "Unit of Measure", isTarget: false },
      { label: "Physical Inventory", isTarget: false },
      { label: "Warehouse Locations", isTarget: false },
      { label: "Partners & Partner Groups", isTarget: true },
      { label: "Purchase Orders", isTarget: false },
      { label: "Receiving", isTarget: false },
      { label: "Inventory Movement", isTarget: false },
      { label: "Shipments", isTarget: false },
      { label: "Quotes", isTarget: false },
      { label: "Sales Orders", isTarget: false },
      { label: "Users & Roles", isTarget: false },
      { label: "Global MFA", isTarget: false },
      { label: "General Settings", isTarget: false },
      { label: "Module Defaults", isTarget: false },
      ],
      pageTitle: "Partners & Partner Groups",
    },
    infoNoteOn: "Access to the Partners & Partner Groups module is available.",
    infoNoteOff: "Partners & Partner Groups module is hidden from navigation.",
    path: "Navigation Sidebar → Module Entry",
  },

  "prt-create-edit": {
    permissionName: "Create and Edit Partners and Groups",
    moduleName: "Partners & Partner Groups",
    previewData: {
      type: "listing",
      toolbarButtons: [
        { label: "Create Partner", highlighted: true },
        { label: "Create Group", highlighted: true },
      ],
      columns: [
        { header: "Partner Name", highlighted: false },
        { header: "Type", highlighted: false },
        { header: "POs", highlighted: false },
        { header: "Status", highlighted: false },
      ],
      sampleRows: [
        { cells: ["Acme Corp", "Vendor", "12 POs", "Active"] },
        { cells: ["Delta Supply", "Vendor", "8 POs", "Active"] },
        { cells: ["TechBridge Inc", "Customer", "5 POs", "Active"] },
      ],
      rowActions: [
        { label: "Edit", highlighted: true },
      ],
    },
    infoNoteOn: "Create new partners and groups, and edit existing partner details.",
    infoNoteOff: "Partner and group creation is disabled. Existing partners are read-only.",
    path: "Partners Listing → Toolbar Actions + Row Actions",
  },

  "prt-manage-pricing": {
    permissionName: "Configure Pricing Rules",
    moduleName: "Partners & Partner Groups",
    previewData: {
      type: "detail",
      headerTitle: "Acme Corp: Pricing Tab",
      fields: [
        { label: "Standard Discount", value: "5% off", highlighted: true, offState: "readonly" as const },
        { label: "Volume Tier", value: "8% off for orders $10K+", highlighted: true, offState: "readonly" as const },
        { label: "Contract Rate", value: "$24.50 per unit", highlighted: true, offState: "readonly" as const },
      ],
      actionButtons: [
        { label: "Add Pricing Rule", highlighted: true },
        { label: "Edit", highlighted: true },
        { label: "Delete", highlighted: true },
      ],
    },
    infoNoteOn: "Add, edit, and manage pricing rules for partners.",
    infoNoteOff: "Pricing rules cannot be modified.",
    path: "Partner Detail → Pricing Tab → Rules Section",
  },

  "prt-manage-locations": {
    permissionName: "Manage Partner Locations",
    moduleName: "Partners & Partner Groups",
    previewData: {
      type: "detail",
      headerTitle: "Delta Supply: Locations Tab",
      fields: [
        { label: "HQ", value: "123 Main Street, Suite 200 | Billing, Shipping", highlighted: true, offState: "readonly" as const },
        { label: "Warehouse A", value: "456 Industrial Boulevard | Shipping", highlighted: true, offState: "readonly" as const },
      ],
      actionButtons: [
        { label: "Add Location", highlighted: true },
        { label: "Edit", highlighted: true },
        { label: "Remove", highlighted: true },
      ],
    },
    infoNoteOn: "Add, edit, and remove partner locations and addresses.",
    infoNoteOff: "Partner locations cannot be modified.",
    path: "Partner Detail → Locations Tab → Address Cards",
  },

  "prt-deactivate": {
    permissionName: "Archive Partners and Groups",
    moduleName: "Partners & Partner Groups",
    previewData: {
      type: "actionsMenu",
      contextLabel: "Acme Corp: Row Actions",
      actions: [
        { label: "Edit Partner", highlighted: false },
        { label: "View History", highlighted: false },
        { label: "Archive Partner", highlighted: true },
      ],
      annotationText: "Archive action not available.",
    },
    infoNoteOn: "Archive inactive partners and partner groups.",
    infoNoteOff: "Archiving partners is not permitted.",
    path: "Partners Listing → Row Actions Menu",
  },

  "po-access": {
    permissionName: "Access Purchase Orders Module",
    moduleName: "Purchase Orders",
    previewData: {
      type: "sidebarNav",
      moduleEntries: [
      { label: "Item Library", isTarget: false },
      { label: "Item Categories", isTarget: false },
      { label: "Cycle Count", isTarget: false },
      { label: "Unit of Measure", isTarget: false },
      { label: "Physical Inventory", isTarget: false },
      { label: "Warehouse Locations", isTarget: false },
      { label: "Partners & Partner Groups", isTarget: false },
      { label: "Purchase Orders", isTarget: true },
      { label: "Receiving", isTarget: false },
      { label: "Inventory Movement", isTarget: false },
      { label: "Shipments", isTarget: false },
      { label: "Quotes", isTarget: false },
      { label: "Sales Orders", isTarget: false },
      { label: "Users & Roles", isTarget: false },
      { label: "Global MFA", isTarget: false },
      { label: "General Settings", isTarget: false },
      { label: "Module Defaults", isTarget: false },
      ],
      pageTitle: "Purchase Orders",
    },
    infoNoteOn: "Access to the Purchase Orders module is available.",
    infoNoteOff: "Purchase Orders module is hidden from navigation.",
    path: "Navigation Sidebar → Module Entry",
  },

  "po-view-cost": {
    permissionName: "View Pricing and Cost on POs",
    moduleName: "Purchase Orders",
    previewData: {
      type: "listing",
      toolbarButtons: [],
      columns: [
        { header: "PO Number", highlighted: false },
        { header: "Vendor", highlighted: false },
        { header: "Items", highlighted: false },
        { header: "Unit Cost", highlighted: true },
        { header: "Line Total", highlighted: true },
        { header: "PO Value", highlighted: true },
      ],
      sampleRows: [
        { cells: ["PO-2024-0847", "Acme Corp", "Industrial Bearings", "$42.50", "$21,250.00", "$21,250.00"] },
        { cells: ["PO-2024-0851", "Delta Supply", "Copper Wire 12AWG", "$18.75", "$3,750.00", "$8,720.00"] },
        { cells: ["PO-2024-0856", "GlobalTech Industries", "Aluminum Stock", "$156.00", "$4,680.00", "$4,680.00"] },
      ],
    },
    infoNoteOn: "View unit costs, line totals, and overall PO values.",
    infoNoteOff: "Cost and pricing information is not visible.",
    path: "PO Listing → Cost Columns",
  },

  "po-create": {
    permissionName: "Create and Edit Purchase Orders",
    moduleName: "Purchase Orders",
    previewData: {
      type: "listing",
      toolbarButtons: [
        { label: "Create Purchase Order", highlighted: true },
      ],
      columns: [
        { header: "PO Number", highlighted: false },
        { header: "Vendor", highlighted: false },
        { header: "Status", highlighted: false },
        { header: "Items", highlighted: false },
      ],
      sampleRows: [
        { cells: ["PO-2024-0847", "Acme Corp", "Draft", "Industrial Bearings"] },
        { cells: ["PO-2024-0851", "Delta Supply", "Pending Approval", "Copper Wire 12AWG"] },
        { cells: ["PO-2024-0856", "GlobalTech Industries", "Approved", "Aluminum Stock"] },
      ],
      rowActions: [
        { label: "Edit", highlighted: true },
      ],
    },
    infoNoteOn: "Create new purchase orders and edit existing PO details.",
    infoNoteOff: "PO creation and editing are disabled.",
    path: "PO Listing → Toolbar + Row Actions",
  },

  "po-nonqualified": {
    permissionName: "Purchase from Non-Qualified Vendors",
    moduleName: "Purchase Orders",
    previewData: {
      type: "detail",
      headerTitle: "Create Purchase Order: Vendor Selection",
      fields: [
        { label: "Acme Corp", value: "Qualified", highlighted: false, offState: "hidden" as const },
        { label: "Delta Supply", value: "Qualified", highlighted: false, offState: "hidden" as const },
        { label: "TechBridge Inc", value: "Non-Qualified", highlighted: true, offState: "hidden" as const },
        { label: "FastShip Materials", value: "Non-Qualified", highlighted: true, offState: "hidden" as const },
      ],
    },
    infoNoteOn: "Purchase from both qualified and non-qualified vendors.",
    infoNoteOff: "Purchasing is restricted to qualified vendors only.",
    path: "PO Detail → Vendor Selection Field",
  },



  "po-cancel": {
    permissionName: "Archive Purchase Orders",
    moduleName: "Purchase Orders",
    previewData: {
      type: "actionsMenu",
      contextLabel: "PO-2024-0847: Row Actions",
      actions: [
        { label: "Edit", highlighted: false },
        { label: "View History", highlighted: false },
        { label: "Archive PO", highlighted: true },
      ],
      annotationText: "Archive action not available.",
    },
    infoNoteOn: "Archive inactive purchase orders.",
    infoNoteOff: "Archiving POs is not permitted.",
    path: "PO Listing → Row Actions Menu",
  },

  "po-initiate-receipt": {
    permissionName: "Initiate Goods Receipt Against a PO",
    moduleName: "Purchase Orders",
    previewData: {
      type: "detail",
      headerTitle: "PO-2024-0847: Line Items",
      fields: [
        { label: "Industrial Bearings", value: "Qty: 500 | $42.50 each | $21,250.00", highlighted: false, offState: "readonly" as const },
      ],
      actionButtons: [
        { label: "Receive Goods", highlighted: true },
        { label: "Receive", highlighted: true },
      ],
    },
    infoNoteOn: "Start the goods receipt workflow from purchase order context.",
    infoNoteOff: "Goods receipt cannot be initiated from PO detail.",
    path: "PO Detail → Actions Bar + Line Items Section",
  },

  "rcv-access": {
    permissionName: "Access Receiving Module",
    moduleName: "Receiving",
    previewData: {
      type: "sidebarNav",
      moduleEntries: [
      { label: "Item Library", isTarget: false },
      { label: "Item Categories", isTarget: false },
      { label: "Cycle Count", isTarget: false },
      { label: "Unit of Measure", isTarget: false },
      { label: "Physical Inventory", isTarget: false },
      { label: "Warehouse Locations", isTarget: false },
      { label: "Partners & Partner Groups", isTarget: false },
      { label: "Purchase Orders", isTarget: false },
      { label: "Receiving", isTarget: true },
      { label: "Inventory Movement", isTarget: false },
      { label: "Shipments", isTarget: false },
      { label: "Quotes", isTarget: false },
      { label: "Sales Orders", isTarget: false },
      { label: "Users & Roles", isTarget: false },
      { label: "Global MFA", isTarget: false },
      { label: "General Settings", isTarget: false },
      { label: "Module Defaults", isTarget: false },
      ],
      pageTitle: "Receiving",
    },
    infoNoteOn: "Access to the Receiving module is available.",
    infoNoteOff: "Receiving module is hidden from navigation.",
    path: "Navigation Sidebar → Module Entry",
  },

  "rcv-receive": {
    permissionName: "Confirm Receipt of Goods",
    moduleName: "Receiving",
    previewData: {
      type: "detail",
      headerTitle: "Receipt for PO-2024-0847: Confirmation Panel",
      fields: [
        { label: "Industrial Bearings", value: "Expected: 500 | Received: [enter qty]", highlighted: true, offState: "disabled" as const },
        { label: "Copper Wire 12AWG", value: "Expected: 200 | Received: [enter qty]", highlighted: true, offState: "disabled" as const },
      ],
      actionButtons: [
        { label: "Mark as Received", highlighted: true },
        { label: "Confirm Receipt", highlighted: true },
      ],
    },
    infoNoteOn: "Confirm the receipt of ordered goods by entering received quantities.",
    infoNoteOff: "Receipt confirmation is disabled.",
    path: "Receipt Detail → Confirmation Panel",
  },

  "rcv-discrepancy": {
    permissionName: "Log and Resolve Discrepancies",
    moduleName: "Receiving",
    previewData: {
      type: "detail",
      headerTitle: "Receipt Detail: Discrepancies Section",
      fields: [
        { label: "Damaged Units", value: "Item: Industrial Bearings | Qty: 3 | Pending Resolution", highlighted: true, offState: "disabled" as const },
        { label: "Quantity Variance", value: "Item: Copper Wire | Expected: 200, Received: 195 | Resolved", highlighted: false, offState: "readonly" as const },
      ],
      actionButtons: [
        { label: "Log Discrepancy", highlighted: true },
        { label: "Resolve", highlighted: true },
      ],
    },
    infoNoteOn: "Log discrepancies during receipt and resolve them.",
    infoNoteOff: "Discrepancy logging is disabled.",
    path: "Receipt Detail → Discrepancies Section",
  },

  "rcv-labels": {
    permissionName: "Print Receiving Labels",
    moduleName: "Receiving",
    previewData: {
      type: "actionsMenu",
      contextLabel: "Receipt Detail: Actions Menu",
      actions: [
        { label: "View Receipt", highlighted: false },
        { label: "Print Labels", highlighted: true },
        { label: "View History", highlighted: false },
        { label: "Archive", highlighted: false },
      ],
      annotationText: "Print action not available.",
    },
    infoNoteOn: "Print receiving labels for received items.",
    infoNoteOff: "Printing receiving labels is disabled.",
    path: "Receipt Detail → Actions Menu",
  },

  "rcv-edit-confirmed": {
    permissionName: "Edit Receipts After Confirmation",
    moduleName: "Receiving",
    previewData: {
      type: "actionsMenu",
      contextLabel: "Confirmed Receipt: Actions Menu",
      actions: [
        { label: "View Receipt", highlighted: false },
        { label: "Edit Receipt", highlighted: true },
        { label: "View History", highlighted: false },
        { label: "Archive", highlighted: false },
      ],
      annotationText: "Confirmed receipts cannot be edited.",
    },
    infoNoteOn: "Edit receipt details even after confirmation.",
    infoNoteOff: "Confirmed receipts are locked from editing.",
    path: "Receipt Detail → Actions Menu",
  },

  "rcv-void": {
    permissionName: "Void a Confirmed Receipt",
    moduleName: "Receiving",
    previewData: {
      type: "actionsMenu",
      contextLabel: "Confirmed Receipt PO-2024-0847: Actions Menu",
      actions: [
        { label: "View Receipt", highlighted: false },
        { label: "Edit Receipt", highlighted: false },
        { label: "View History", highlighted: false },
        { label: "Void Receipt", highlighted: true, isDestructive: true },
      ],
      annotationText: "Void action not available.",
    },
    infoNoteOn: "Void confirmed receipts to reverse them.",
    infoNoteOff: "Voiding confirmed receipts is not permitted.",
    path: "Receipt Detail → Actions Menu",
  },

  "mv-access": {
    permissionName: "Access Inventory Movement Module",
    moduleName: "Inventory Movement",
    previewData: {
      type: "sidebarNav",
      moduleEntries: [
      { label: "Item Library", isTarget: false },
      { label: "Item Categories", isTarget: false },
      { label: "Cycle Count", isTarget: false },
      { label: "Unit of Measure", isTarget: false },
      { label: "Physical Inventory", isTarget: false },
      { label: "Warehouse Locations", isTarget: false },
      { label: "Partners & Partner Groups", isTarget: false },
      { label: "Purchase Orders", isTarget: false },
      { label: "Receiving", isTarget: false },
      { label: "Inventory Movement", isTarget: true },
      { label: "Shipments", isTarget: false },
      { label: "Quotes", isTarget: false },
      { label: "Sales Orders", isTarget: false },
      { label: "Users & Roles", isTarget: false },
      { label: "Global MFA", isTarget: false },
      { label: "General Settings", isTarget: false },
      { label: "Module Defaults", isTarget: false },
      ],
      pageTitle: "Inventory Movement",
    },
    infoNoteOn: "Access to the Inventory Movement module is available.",
    infoNoteOff: "Inventory Movement module is hidden from navigation.",
    path: "Navigation Sidebar → Module Entry",
  },

  "mv-create": {
    permissionName: "Manage Planned Movement Tasks",
    moduleName: "Inventory Movement",
    previewData: {
      type: "listing",
      toolbarButtons: [
        { label: "Create Task", highlighted: true },
      ],
      columns: [
        { header: "Task", highlighted: false },
        { header: "Item", highlighted: false },
        { header: "From → To", highlighted: false },
        { header: "Status", highlighted: false },
        { header: "Assigned", highlighted: false },
      ],
      sampleRows: [
        { cells: ["Move SKU-4021", "Industrial Bearings", "A1 → B3", "Pending", "John D."] },
        { cells: ["Restock Zone C", "Copper Wire", "C2 → C5", "In Progress", "Sarah M."] },
        { cells: ["Cycle Count A2-A5", "Steel Brackets", "A2 → A5", "Pending", "Unassigned"] },
      ],
      rowActions: [
        { label: "Edit", highlighted: true },
        { label: "Archive", highlighted: true },
        { label: "Assign", highlighted: true },
      ],
    },
    infoNoteOn: "Create and manage planned inventory movement tasks.",
    infoNoteOff: "Movement task creation and management are disabled.",
    path: "Movement Tasks Listing → Toolbar + Row Actions",
  },

  "mv-edit-others": {
    permissionName: "Edit Movements Created by Others",
    moduleName: "Inventory Movement",
    previewData: {
      type: "detail",
      headerTitle: "Move SKU-4021 from A1 to B3: Created by Sarah M.",
      fields: [
        { label: "SKU", value: "SKU-4021", highlighted: false, offState: "readonly" as const },
        { label: "Source Location", value: "A1", highlighted: true, offState: "readonly" as const },
        { label: "Destination Location", value: "B3", highlighted: true, offState: "readonly" as const },
        { label: "Quantity", value: "500", highlighted: true, offState: "readonly" as const },
        { label: "Priority", value: "High", highlighted: true, offState: "readonly" as const },
      ],
    },
    infoNoteOn: "Edit inventory movement tasks created by other team members.",
    infoNoteOff: "Tasks created by others are read-only.",
    path: "Movement Task Detail → Editable Fields",
  },

  "mv-execute": {
    permissionName: "Execute Movement Tasks",
    moduleName: "Inventory Movement",
    previewData: {
      type: "detail",
      headerTitle: "Move SKU-4021 from A1 to B3: Execution Panel",
      fields: [
        { label: "Scan Item Barcode", value: "[scan field]", highlighted: true, offState: "disabled" as const },
        { label: "Confirm Location", value: "B3", highlighted: true, offState: "disabled" as const },
        { label: "Quantity", value: "500 units", highlighted: true, offState: "disabled" as const },
      ],
      actionButtons: [
        { label: "Accept Task", highlighted: true },
        { label: "Confirm Location", highlighted: true },
        { label: "Complete Task", highlighted: true },
      ],
    },
    infoNoteOn: "Accept and execute movement tasks with scan and confirm controls.",
    infoNoteOff: "Task execution is disabled.",
    path: "Movement Task Detail → Execution Panel",
  },

  "mv-adhoc": {
    permissionName: "Start Ad-Hoc Movements",
    moduleName: "Inventory Movement",
    previewData: {
      type: "listing",
      toolbarButtons: [
        { label: "Create Task", highlighted: false },
        { label: "Ad-Hoc Movement", highlighted: true },
      ],
      columns: [
        { header: "Task", highlighted: false },
        { header: "Status", highlighted: false },
        { header: "Assigned", highlighted: false },
      ],
      sampleRows: [
        { cells: ["Move SKU-4021", "Pending", "John D."] },
        { cells: ["Restock Zone C", "In Progress", "Sarah M."] },
      ],
    },
    infoNoteOn: "Start immediate ad-hoc inventory movements outside planned tasks.",
    infoNoteOff: "Ad-hoc movement creation is not permitted.",
    path: "Movement Tasks Listing → Toolbar",
  },

  "ship-access": {
    permissionName: "Access Shipments Module",
    moduleName: "Shipments",
    previewData: {
      type: "sidebarNav",
      moduleEntries: [
      { label: "Item Library", isTarget: false },
      { label: "Item Categories", isTarget: false },
      { label: "Cycle Count", isTarget: false },
      { label: "Unit of Measure", isTarget: false },
      { label: "Physical Inventory", isTarget: false },
      { label: "Warehouse Locations", isTarget: false },
      { label: "Partners & Partner Groups", isTarget: false },
      { label: "Purchase Orders", isTarget: false },
      { label: "Receiving", isTarget: false },
      { label: "Inventory Movement", isTarget: false },
      { label: "Shipments", isTarget: true },
      { label: "Quotes", isTarget: false },
      { label: "Sales Orders", isTarget: false },
      { label: "Users & Roles", isTarget: false },
      { label: "Global MFA", isTarget: false },
      { label: "General Settings", isTarget: false },
      { label: "Module Defaults", isTarget: false },
      ],
      pageTitle: "Shipments",
    },
    infoNoteOn: "Access to the Shipments module is available.",
    infoNoteOff: "Shipments module is hidden from navigation.",
    path: "Navigation Sidebar → Module Entry",
  },

  "ship-view-value": {
    permissionName: "View Declared Value on Shipment Documents",
    moduleName: "Shipments",
    previewData: {
      type: "detail",
      headerTitle: "SHP-2024-1156: Declaration Section",
      fields: [
        { label: "Declared Value", value: "$12,500.00", highlighted: true, offState: "hidden" as const },
        { label: "Document Preview", value: "Packing List / Bill of Lading", highlighted: false, offState: "readonly" as const },
      ],
    },
    infoNoteOn: "View and see declared value amounts on shipment details and printed documents.",
    infoNoteOff: "Declared value information is not visible.",
    path: "Shipment Detail → Declaration Section + Documents",
  },

  "ship-create": {
    permissionName: "Create and Manage Shipments",
    moduleName: "Shipments",
    previewData: {
      type: "listing",
      toolbarButtons: [
        { label: "Create Shipment", highlighted: true },
      ],
      columns: [
        { header: "Shipment", highlighted: false },
        { header: "Customer", highlighted: false },
        { header: "Status", highlighted: false },
        { header: "Items", highlighted: false },
      ],
      sampleRows: [
        { cells: ["SHP-2024-1156", "Acme Corp", "Ready to Pick", "12"] },
        { cells: ["SHP-2024-1158", "Delta Supply", "Picking in Progress", "8"] },
        { cells: ["SHP-2024-1161", "GlobalTech Industries", "Packed", "15"] },
      ],
      rowActions: [
        { label: "Edit", highlighted: true },
        { label: "Release to Pick", highlighted: true },
      ],
    },
    infoNoteOn: "Create new shipments and manage shipment workflows.",
    infoNoteOff: "Shipment creation and management are disabled.",
    path: "Shipments Listing → Toolbar + Row Actions",
  },

  "ship-release-allocation": {
    permissionName: "Release Allocation",
    moduleName: "Shipments",
    previewData: {
      type: "detail",
      headerTitle: "SHP-2024-1156: Allocated Lines",
      fields: [
        { label: "Industrial Bearings", value: "Allocated: 500 · Lot L-4021", highlighted: true, offState: "readonly" as const },
        { label: "Copper Wire 12AWG", value: "Allocated: 220 · Lot L-1188", highlighted: true, offState: "readonly" as const },
        { label: "Hydraulic Fluid ISO-46", value: "Allocated: 80 · Lot L-3390", highlighted: true, offState: "readonly" as const },
      ],
      actionButtons: [
        { label: "Release Allocation", highlighted: true },
        { label: "Reassign", highlighted: true },
      ],
    },
    infoNoteOn: "Existing allocations can be released or reassigned, returning the allocated inventory to the available pool. This is one permission with Sales Orders' Release Allocation, since both reverse the same shared allocation engine.",
    infoNoteOff: "Allocations on this shipment are read only. Reversing a commitment already made to a customer sits with a more senior persona than day-to-day shipment planning.",
    path: "Shipment Detail → Allocated Lines → Release / Reassign",
  },

  "ship-overship": {
    permissionName: "Authorize Overship",
    moduleName: "Shipments",
    previewData: {
      type: "detail",
      headerTitle: "SHP-2024-1156: Line Items",
      fields: [
        { label: "Item", value: "Industrial Bearings", highlighted: false, offState: "readonly" as const },
        { label: "Qty Ordered", value: "500", highlighted: false, offState: "readonly" as const },
        { label: "Qty to Ship", value: "550 (Overship Authorized)", highlighted: true, offState: "disabled" as const },
      ],
    },
    infoNoteOn: "Ship more than the ordered quantity when needed.",
    infoNoteOff: "Shipment quantities are restricted to ordered amounts.",
    path: "Shipment Detail → Line Items Section",
  },

  "ship-pick": {
    permissionName: "Execute Picking Tasks",
    moduleName: "Shipments",
    previewData: {
      type: "detail",
      headerTitle: "SHP-2024-1156: Pick List Panel",
      fields: [
        { label: "Item", value: "Industrial Bearings", highlighted: false, offState: "readonly" as const },
        { label: "Location", value: "A5-C3", highlighted: false, offState: "readonly" as const },
        { label: "Qty to Pick", value: "500", highlighted: false, offState: "readonly" as const },
        { label: "Qty Picked", value: "[enter qty]", highlighted: true, offState: "disabled" as const },
        { label: "Lot/Serial", value: "[enter lot/serial]", highlighted: true, offState: "disabled" as const },
      ],
      actionButtons: [
        { label: "Start Picking", highlighted: true },
        { label: "Complete Pick", highlighted: true },
      ],
    },
    infoNoteOn: "Execute picking tasks and confirm picked quantities with lot and serial tracking.",
    infoNoteOff: "Picking task execution is disabled.",
    path: "Shipment Detail → Pick List Panel",
  },

  "ship-approve-short": {
    permissionName: "Approve Short Shipments",
    moduleName: "Shipments",
    previewData: {
      type: "detail",
      headerTitle: "SHP-2024-1156: Shortage Review Panel",
      fields: [
        { label: "Shortage Notice", value: "3 units of Industrial Bearings short", highlighted: false, offState: "readonly" as const },
        { label: "Resolution", value: "Backorder Remaining Units", highlighted: true, offState: "disabled" as const },
        { label: "Notes", value: "Enter resolution details…", highlighted: true, offState: "disabled" as const },
      ],
      actionButtons: [
        { label: "Approve Short Ship", highlighted: true },
      ],
    },
    infoNoteOn: "Approve partial shipments and select resolution for shortage items.",
    infoNoteOff: "Short shipment approval authority is not granted.",
    path: "Shipment Detail → Shortage Review Panel",
  },

  "ship-dispatch": {
    permissionName: "Confirm Departure",
    moduleName: "Shipments",
    previewData: {
      type: "actionsMenu",
      contextLabel: "SHP-2024-1156: Dispatch Section",
      actions: [
        { label: "Confirm Departure", highlighted: true },
        { label: "Print Packing List", highlighted: true },
        { label: "Print Shipping Label", highlighted: true },
        { label: "Print Bill of Lading", highlighted: true },
      ],
      annotationText: "Departure controls not available.",
    },
    infoNoteOn: "Confirm shipment departure and print all required dispatch documents.",
    infoNoteOff: "Departure confirmation and printing are disabled.",
    path: "Shipment Detail → Dispatch Section",
  },

  "ship-cancel": {
    permissionName: "Cancel Shipment",
    moduleName: "Shipments",
    previewData: {
      type: "actionsMenu",
      contextLabel: "SHP-2024-1156: Row Actions",
      actions: [
        { label: "View Shipment", highlighted: false },
        { label: "Edit Shipment", highlighted: false },
        { label: "Release to Pick", highlighted: false },
        { label: "Cancel Shipment", highlighted: true, isDestructive: true },
      ],
      annotationText: "Cancel action not available.",
    },
    infoNoteOn: "Cancel shipments to reverse them.",
    infoNoteOff: "Canceling shipments is not permitted.",
    path: "Shipments Listing → Row Actions Menu",
  },

  "qt-access": {
    permissionName: "Access Quotes Module",
    moduleName: "Quotes",
    previewData: {
      type: "sidebarNav",
      moduleEntries: [
        { label: "Dashboard", isTarget: false },
        { label: "Quotes", isTarget: true },
        { label: "Orders", isTarget: false },
        { label: "Customers", isTarget: false },
        { label: "Products", isTarget: false },
        { label: "Settings", isTarget: false },
      ],
      pageTitle: "Quotes",
    },
    infoNoteOn: "Full access to the Quotes module and all quote-related screens.",
    infoNoteOff: "Quotes module is not accessible to this user.",
    path: "Navigation → Sidebar → Quotes module",
  },

  "qt-view-pricing": {
    permissionName: "View Pricing on Quotes",
    moduleName: "Quotes",
    previewData: {
      type: "listing",
      toolbarButtons: [],
      columns: [
        { header: "Quote #", highlighted: false },
        { header: "Customer", highlighted: false },
        { header: "Items", highlighted: false },
        { header: "Unit Price", highlighted: true },
        { header: "Discount", highlighted: true },
        { header: "Total Value", highlighted: true },
      ],
      sampleRows: [
        { cells: ["QT-2024-1205", "Meridian Healthcare", "12", "$3,958.33", "5%", "$47,500.00"] },
        { cells: ["QT-2024-1210", "Summit Retail Group", "8", "$1,600.00", "0%", "$12,800.00"] },
        { cells: ["QT-2024-1218", "Valley Medical Systems", "15", "$2,466.67", "10%", "$37,000.00"] },
        { cells: ["QT-2024-1225", "Coastal Distribution", "6", "$4,166.67", "2.5%", "$25,000.00"] },
      ],
    },
    infoNoteOn: "Pricing details including unit prices, discounts, and total values are visible on all quotes.",
    infoNoteOff: "Pricing information is hidden throughout the Quotes module.",
    path: "Quotes → Listing → Pricing columns",
  },

  "qt-create": {
    permissionName: "Create Quotes",
    moduleName: "Quotes",
    previewData: {
      type: "listing",
      toolbarButtons: [
        { label: "Create Quote", highlighted: true },
        { label: "Bulk Actions", highlighted: false },
        { label: "Export", highlighted: false },
        { label: "Filter", highlighted: false },
      ],
      columns: [
        { header: "Quote #", highlighted: false },
        { header: "Customer", highlighted: false },
        { header: "Items", highlighted: false },
        { header: "Status", highlighted: false },
      ],
      sampleRows: [
        { cells: ["QT-2024-1205", "Meridian Healthcare", "12", "Active"] },
        { cells: ["QT-2024-1210", "Summit Retail Group", "8", "Sent"] },
        { cells: ["QT-2024-1218", "Valley Medical Systems", "15", "Draft"] },
        { cells: ["QT-2024-1225", "Coastal Distribution", "6", "Active"] },
      ],
      rowActions: [
        { label: "Duplicate", highlighted: true },
        { label: "View", highlighted: false },
      ],
    },
    infoNoteOn: "User can create new quotes and duplicate existing quotes.",
    infoNoteOff: "Quote creation and duplication are not available.",
    path: "Quotes → Listing → Create button + Row Actions → Duplicate",
  },

  "qt-edit": {
    permissionName: "Edit Quotes",
    moduleName: "Quotes",
    previewData: {
      type: "detail",
      headerTitle: "Quote QT-2024-1205: Meridian Healthcare",
      fields: [
        { label: "Line Items", value: "12 items configured", highlighted: true, offState: "readonly" as const },
        { label: "Deal Information", value: "Enterprise Renewal", highlighted: true, offState: "readonly" as const },
        { label: "Customer Details", value: "Meridian Healthcare", highlighted: true, offState: "readonly" as const },
        { label: "Payment Terms", value: "Net 30", highlighted: true, offState: "readonly" as const },
        { label: "Expected Close Date", value: "04/15/2026", highlighted: true, offState: "readonly" as const },
      ],
      actionButtons: [
        { label: "Save", highlighted: true },
        { label: "Cancel", highlighted: false },
      ],
    },
    infoNoteOn: "All quote fields and line items can be edited directly.",
    infoNoteOff: "Quote content is view-only and cannot be modified.",
    path: "Quotes → Detail → Editable fields and line items",
  },

  "qt-manage-pricing-rules": {
    permissionName: "Manage Pricing Rules",
    moduleName: "Quotes",
    previewData: {
      type: "detail",
      headerTitle: "Pricing Rules Library: opened from Quotes",
      fields: [
        { label: "Rule Name", value: "Tier Pricing, 100+ units", highlighted: true, offState: "readonly" as const },
        { label: "Rule Type", value: "Volume break", highlighted: true, offState: "readonly" as const },
        { label: "Adjustment", value: "−5%", highlighted: true, offState: "readonly" as const },
        { label: "Scope", value: "Global library, all modules", highlighted: false, offState: "readonly" as const },
        { label: "Status", value: "Active", highlighted: true, offState: "readonly" as const },
      ],
      actionButtons: [
        { label: "New Pricing Rule", highlighted: true },
        { label: "Edit Rule", highlighted: true },
        { label: "Deactivate", highlighted: true },
      ],
    },
    infoNoteOn: "Pricing rules can be created and edited from Quotes. Rules land in the global library, so the change applies in every module that reads it.",
    infoNoteOff: "The pricing rules library is read only from Quotes; existing rules can still be applied if Apply Pricing Rules is on.",
    path: "Quotes → Detail → Pricing Rules → Manage rules",
  },

  "qt-apply-pricing-rules": {
    permissionName: "Apply Pricing Rules",
    moduleName: "Quotes",
    previewData: {
      type: "detail",
      headerTitle: "Quote QT-2024-1205: Advanced Configurator",
      fields: [
        { label: "Product Name", value: "Sample Widget A", highlighted: false, offState: "readonly" as const },
        { label: "Quantity", value: "50", highlighted: false, offState: "readonly" as const },
        { label: "Base Price", value: "$2,000.00", highlighted: false, offState: "readonly" as const },
        { label: "Tier Pricing", value: "100+ units: −5%", highlighted: true, offState: "readonly" as const },
        { label: "Volume Discount", value: "2% if paid in 10 days", highlighted: true, offState: "readonly" as const },
      ],
      actionButtons: [
        { label: "Apply Pricing Rule", highlighted: true },
        { label: "Remove Rule", highlighted: true },
      ],
    },
    infoNoteOn: "Existing pricing rules can be attached to and removed from this quote. This setting controls Quotes only.",
    infoNoteOff: "Pricing rules cannot be attached or removed on quotes; only standard catalog pricing is applied.",
    path: "Quotes → Detail → Advanced Configurator → Pricing Rules section",
  },

  "qt-discount": {
    permissionName: "Add One-Time Discounts and Premiums",
    moduleName: "Quotes",
    previewData: {
      type: "detail",
      headerTitle: "Quote QT-2024-1205: Line Items",
      fields: [
        { label: "Product A", value: "Qty 10 × $500.00/ea", highlighted: false, offState: "readonly" as const },
        { label: "Product B", value: "Qty 5 × $1,200.00/ea", highlighted: false, offState: "readonly" as const },
        { label: "Product C", value: "Qty 25 × $150.00/ea", highlighted: false, offState: "readonly" as const },
        { label: "Line Discounts", value: "−$420.00", highlighted: true, offState: "readonly" as const },
        { label: "Line Premiums", value: "+$250.00", highlighted: true, offState: "readonly" as const },
      ],
      actionButtons: [
        { label: "Add Discount", highlighted: true },
        { label: "Add Premium", highlighted: true },
        { label: "Adjust", highlighted: true },
      ],
    },
    infoNoteOn: "Discounts and premiums can be added at line-item and quote levels.",
    infoNoteOff: "One-time discounts and premiums cannot be applied.",
    path: "Quotes → Detail → Line Items → Discount and Premium controls",
  },

  "qt-send": {
    permissionName: "Send Quote to Customer",
    moduleName: "Quotes",
    previewData: {
      type: "detail",
      headerTitle: "Quote QT-2024-1205: Meridian Healthcare",
      fields: [
        { label: "Customer", value: "Meridian Healthcare", highlighted: false, offState: "readonly" as const },
        { label: "Total Value", value: "$47,500.00", highlighted: false, offState: "readonly" as const },
        { label: "Status", value: "Draft", highlighted: false, offState: "readonly" as const },
      ],
      actionButtons: [
        { label: "Send to Customer", highlighted: true },
        { label: "Print", highlighted: false },
        { label: "Export", highlighted: false },
        { label: "More Actions", highlighted: false },
      ],
    },
    infoNoteOn: "Quotes can be sent directly to customers via email with portal access.",
    infoNoteOff: "Quote distribution to customers is not available.",
    path: "Quotes → Detail → Actions bar → Send to Customer button",
  },

  "qt-approve-convert": {
    permissionName: "Approve and Convert Quote to Sales Order",
    moduleName: "Quotes",
    previewData: {
      type: "detail",
      headerTitle: "Quote QT-2024-1205: Pending Approval",
      fields: [
        { label: "Customer", value: "Meridian Healthcare", highlighted: false, offState: "readonly" as const },
        { label: "Total", value: "$47,500.00", highlighted: false, offState: "readonly" as const },
        { label: "Items", value: "12 line items", highlighted: false, offState: "readonly" as const },
        { label: "Approval Notes", value: "Enter notes…", highlighted: true, offState: "hidden" as const },
      ],
      actionButtons: [
        { label: "Approve and Convert", highlighted: true },
      ],
    },
    infoNoteOn: "Approved quotes can be converted directly to sales orders.",
    infoNoteOff: "Quote approval and conversion to sales orders is not permitted.",
    path: "Quotes → Detail → Actions bar → Approve and Convert button",
  },

  "qt-cancel": {
    permissionName: "Cancel or Archive Quotes",
    moduleName: "Quotes",
    previewData: {
      type: "actionsMenu",
      contextLabel: "Quote QT-2024-1205: More Actions",
      actions: [
        { label: "Edit", highlighted: false },
        { label: "Duplicate", highlighted: false },
        { label: "Archive", highlighted: true },
        { label: "Cancel Quote", highlighted: true, isDestructive: true },
        { label: "Delete", highlighted: false },
      ],
      annotationText: "Quote cancellation and archival are not available.",
    },
    infoNoteOn: "Quotes can be cancelled, reopened later through Create and edit quotes, or archived to clear them out of the active list.",
    infoNoteOff: "Quote cancellation and archival are not available.",
    path: "Quotes → Detail → More Actions menu → Cancel Quote and Archive actions",
  },

  "qt-reopen": {
    permissionName: "Reopen Cancelled or Archived Quotes",
    moduleName: "Quotes",
    previewData: {
      type: "actionsMenu",
      contextLabel: "Quote QT-2024-1190: Cancelled/Archived",
      actions: [
        { label: "View", highlighted: false },
        { label: "Duplicate", highlighted: false },
        { label: "Reopen", highlighted: true },
        { label: "Permanently Delete", highlighted: false },
      ],
      annotationText: "Quote reopening is not available.",
    },
    infoNoteOn: "Cancelled and archived quotes can be reopened and returned to active status.",
    infoNoteOff: "Reopening quotes is not available.",
    path: "Quotes → Detail (Cancelled/Archived) → More Actions menu → Reopen action",
  },

  "qt-revive": {
    permissionName: "Revive Expired Quotes",
    moduleName: "Quotes",
    previewData: {
      type: "actionsMenu",
      contextLabel: "Quote QT-2024-1150: Expired",
      actions: [
        { label: "View", highlighted: false },
        { label: "Duplicate", highlighted: false },
        { label: "Revive", highlighted: true },
        { label: "Permanently Delete", highlighted: false },
      ],
      annotationText: "Quote revival is not available.",
    },
    infoNoteOn: "Expired quotes can be revived with a new expiration date.",
    infoNoteOff: "Quote revival is not available.",
    path: "Quotes → Detail (Expired) → More Actions menu → Revive action",
  },

  "qt-attachments": {
    permissionName: "Manage Quote Attachments",
    moduleName: "Quotes",
    previewData: {
      type: "detail",
      headerTitle: "Quote QT-2024-1205: Attachments",
      fields: [
        { label: "RFQ-Response.pdf", value: "PDF · John Smith · Mar 20", highlighted: true, offState: "readonly" as const },
        { label: "Compliance-Cert.docx", value: "Word · Maria Garcia · Mar 18", highlighted: true, offState: "readonly" as const },
        { label: "ProductSpec-v2.xlsx", value: "Excel · John Smith · Mar 15", highlighted: true, offState: "readonly" as const },
      ],
      actionButtons: [
        { label: "Upload File", highlighted: true },
        { label: "Edit", highlighted: true },
        { label: "Delete", highlighted: true },
      ],
    },
    infoNoteOn: "Files can be uploaded, edited, deleted, and their visibility can be controlled.",
    infoNoteOff: "File list is visible but file management controls are disabled.",
    path: "Quotes → Detail → Attachments tab → Upload and Edit controls",
  },

  "qt-manage-reps": {
    permissionName: "Manage Sales Representatives on Quote",
    moduleName: "Quotes",
    previewData: {
      type: "detail",
      headerTitle: "Quote QT-2024-1205: Deal Information",
      fields: [
        { label: "John Smith", value: "Primary", highlighted: true, offState: "readonly" as const },
        { label: "Maria Garcia", value: "Secondary", highlighted: true, offState: "readonly" as const },
      ],
      actionButtons: [
        { label: "Add Representative", highlighted: true },
        { label: "Edit", highlighted: true },
        { label: "Remove", highlighted: true },
      ],
    },
    infoNoteOn: "Sales representatives can be added, modified, and removed from quotes.",
    infoNoteOff: "Representative management is not available.",
    path: "Quotes → Detail → Deal Information → Representatives section",
  },

  "qt-export": {
    permissionName: "Print and Export Quotes",
    moduleName: "Quotes",
    previewData: {
      type: "detail",
      headerTitle: "Quote QT-2024-1205: Meridian Healthcare",
      fields: [
        { label: "Customer", value: "Meridian Healthcare", highlighted: false, offState: "readonly" as const },
        { label: "Total Value", value: "$47,500.00", highlighted: false, offState: "readonly" as const },
        { label: "Status", value: "Active", highlighted: false, offState: "readonly" as const },
      ],
      actionButtons: [
        { label: "Print", highlighted: true },
        { label: "Export", highlighted: true },
        { label: "Download PDF", highlighted: true },
      ],
    },
    infoNoteOn: "Quotes can be printed and exported as PDF or Excel files.",
    infoNoteOff: "Print and export functionality is not available.",
    path: "Quotes → Detail → Actions bar → Print and Export buttons",
  },

  "so-access": {
    permissionName: "Access Sales Orders Module",
    moduleName: "Sales Orders",
    previewData: {
      type: "sidebarNav",
      moduleEntries: [
        { label: "Dashboard", isTarget: false },
        { label: "Quotes", isTarget: false },
        { label: "Orders", isTarget: true },
        { label: "Customers", isTarget: false },
        { label: "Products", isTarget: false },
        { label: "Settings", isTarget: false },
      ],
      pageTitle: "Sales Orders",
    },
    infoNoteOn: "Full access to the Sales Orders module and all order-related screens.",
    infoNoteOff: "Sales Orders module is not accessible to this user.",
    path: "Navigation → Sidebar → Sales Orders module",
  },

  "so-view-pricing": {
    permissionName: "View Pricing on Sales Orders",
    moduleName: "Sales Orders",
    previewData: {
      type: "listing",
      toolbarButtons: [],
      columns: [
        { header: "Order #", highlighted: false },
        { header: "Customer", highlighted: false },
        { header: "Items", highlighted: false },
        { header: "Unit Price", highlighted: true },
        { header: "Line Total", highlighted: true },
        { header: "Order Value", highlighted: true },
      ],
      sampleRows: [
        { cells: ["SO-2024-0392", "Meridian Healthcare", "12", "$3,958.33", "$47,500.00", "$47,500.00"] },
        { cells: ["SO-2024-0398", "Summit Retail Group", "8", "$1,600.00", "$12,800.00", "$12,800.00"] },
        { cells: ["SO-2024-0405", "Valley Medical Systems", "15", "$2,466.67", "$37,000.00", "$37,000.00"] },
        { cells: ["SO-2024-0412", "Coastal Distribution", "6", "$4,166.67", "$25,000.00", "$25,000.00"] },
      ],
    },
    infoNoteOn: "Pricing details including unit prices, line totals, and order values are visible on all sales orders.",
    infoNoteOff: "Pricing information is hidden from sales orders.",
    path: "Sales Orders → Listing → Pricing columns",
  },

  "so-create": {
    permissionName: "Create Sales Orders",
    moduleName: "Sales Orders",
    previewData: {
      type: "listing",
      toolbarButtons: [
        { label: "Create Order", highlighted: true },
        { label: "Bulk Actions", highlighted: false },
        { label: "Export", highlighted: false },
        { label: "Filter", highlighted: false },
      ],
      columns: [
        { header: "Order #", highlighted: false },
        { header: "Customer", highlighted: false },
        { header: "Items", highlighted: false },
        { header: "Status", highlighted: false },
      ],
      sampleRows: [
        { cells: ["SO-2024-0392", "Meridian Healthcare", "12", "Draft"] },
        { cells: ["SO-2024-0398", "Summit Retail Group", "8", "Confirmed"] },
        { cells: ["SO-2024-0405", "Valley Medical Systems", "15", "In Progress"] },
        { cells: ["SO-2024-0412", "Coastal Distribution", "6", "Fulfilled"] },
      ],
    },
    infoNoteOn: "User can create new sales orders from scratch.",
    infoNoteOff: "Order creation is not available.",
    path: "Sales Orders → Listing → Create button",
  },

  "so-edit-status": {
    permissionName: "Edit Sales Order Status",
    moduleName: "Sales Orders",
    previewData: {
      type: "detail",
      headerTitle: "Sales Order SO-2024-0392: Meridian Healthcare",
      fields: [
        { label: "Customer", value: "Meridian Healthcare", highlighted: false, offState: "readonly" as const },
        { label: "Order Value", value: "$47,500.00", highlighted: false, offState: "readonly" as const },
        { label: "Status", value: "Draft → Confirmed → In Progress → Fulfilled → Closed", highlighted: true, offState: "disabled" as const },
      ],
      actionButtons: [
        { label: "Cancel Order", highlighted: true },
      ],
    },
    infoNoteOn: "Order status can be changed through the workflow states and orders can be cancelled.",
    infoNoteOff: "Order status editing and cancellation are not available.",
    path: "Sales Orders → Detail → Status dropdown + More Actions → Cancel Order",
  },

  "so-allocate": {
    permissionName: "Allocate Inventory to Orders",
    moduleName: "Sales Orders",
    previewData: {
      type: "detail",
      headerTitle: "Sales Order SO-2024-0392: Allocation",
      fields: [
        { label: "Product A", value: "Ordered: 50 · Available: 120 · Allocated: 50", highlighted: true, offState: "readonly" as const },
        { label: "Product B", value: "Ordered: 30 · Available: 45 · Allocated: 30", highlighted: true, offState: "readonly" as const },
        { label: "Product C", value: "Ordered: 25 · Available: 18 · Allocated: 18 · Short: 7", highlighted: true, offState: "readonly" as const },
      ],
      actionButtons: [
        { label: "Allocate Inventory", highlighted: true },
        { label: "Allocate", highlighted: true },
      ],
    },
    infoNoteOn: "Inventory can be allocated to order lines with quantity and warehouse controls.",
    infoNoteOff: "Inventory allocation is restricted to warehouse staff.",
    path: "Sales Orders → Detail → Allocation section → Allocate buttons",
  },

  "so-release-allocation": {
    permissionName: "Release Allocation",
    moduleName: "Sales Orders",
    previewData: {
      type: "detail",
      headerTitle: "Sales Order SO-2024-0392: Allocation",
      fields: [
        { label: "Product A", value: "Allocated: 50 of 50 ordered", highlighted: true, offState: "readonly" as const },
        { label: "Product B", value: "Allocated: 30 of 30 ordered", highlighted: true, offState: "readonly" as const },
        { label: "Product C", value: "Allocated: 18 of 25 ordered · Short: 7", highlighted: true, offState: "readonly" as const },
      ],
      actionButtons: [
        { label: "Release Allocation", highlighted: true },
        { label: "Reassign", highlighted: true },
      ],
    },
    infoNoteOn: "Existing allocations on the order can be released or reassigned, returning the inventory to the available pool. This is one permission with Shipments' Release Allocation, since both reverse the same shared allocation engine.",
    infoNoteOff: "Allocations on this order are read only. Releasing a commitment already made to a customer is a bigger trust break than not being able to promise inventory in the first place, so it sits with warehouse and ops staff only.",
    path: "Sales Orders → Detail → Allocation section → Release / Reassign",
  },

  "so-fulfill": {
    permissionName: "Update Fulfillment Status",
    moduleName: "Sales Orders",
    previewData: {
      type: "detail",
      headerTitle: "Sales Order SO-2024-0392: Fulfillment",
      fields: [
        { label: "Product A", value: "Qty: 50 · ☐ Mark Fulfilled · 50 remaining", highlighted: true, offState: "disabled" as const },
        { label: "Product B", value: "Qty: 30 · ☐ Mark Fulfilled · 30 remaining", highlighted: true, offState: "disabled" as const },
        { label: "Product C", value: "Qty: 25 · ☐ Mark Fulfilled · 25 remaining", highlighted: true, offState: "disabled" as const },
      ],
      actionButtons: [
        { label: "Mark Order Complete", highlighted: true },
      ],
    },
    infoNoteOn: "Fulfillment status can be updated at the line-item and order level.",
    infoNoteOff: "Fulfillment status updates are not available.",
    path: "Sales Orders → Detail → Fulfillment section → Mark Fulfilled + Mark Order Complete",
  },

  "so-track": {
    permissionName: "Track Item-Level Shipments",
    moduleName: "Sales Orders",
    previewData: {
      type: "detail",
      headerTitle: "Sales Order SO-2024-0392: Line Item Tracking",
      fields: [
        { label: "Product A (50 units)", value: "No tracking yet", highlighted: true, offState: "readonly" as const },
        { label: "Product B (30 units)", value: "FedEx 7892-4561-2389, Shipped", highlighted: true, offState: "readonly" as const },
        { label: "Product C (25 units)", value: "No tracking yet", highlighted: true, offState: "readonly" as const },
      ],
      actionButtons: [
        { label: "Add Tracking", highlighted: true },
        { label: "Update", highlighted: true },
      ],
    },
    infoNoteOn: "Shipment tracking information can be added and updated for each order line.",
    infoNoteOff: "Shipment tracking controls are not available.",
    path: "Sales Orders → Detail → Line Items → Tracking column with Add/Update actions",
  },

  "so-link-po": {
    permissionName: "Link Order Items to Purchase Orders",
    moduleName: "Sales Orders",
    previewData: {
      type: "detail",
      headerTitle: "Sales Order SO-2024-0392: PO Linking",
      fields: [
        { label: "Product A (50 units)", value: "[Link to PO]", highlighted: true, offState: "hidden" as const },
        { label: "Product B (30 units)", value: "→ PO-2024-0847", highlighted: true, offState: "readonly" as const },
        { label: "Product C (25 units)", value: "[Link to PO]", highlighted: true, offState: "hidden" as const },
      ],
      actionButtons: [
        { label: "Link to PO", highlighted: true },
        { label: "Edit", highlighted: true },
      ],
    },
    infoNoteOn: "Sales order line items can be linked to purchase orders for traceability.",
    infoNoteOff: "PO linking from sales orders is not available.",
    path: "Sales Orders → Detail → Line Items → PO Link column with Link and Edit actions",
  },

  "so-clone": {
    permissionName: "Clone Sales Orders",
    moduleName: "Sales Orders",
    previewData: {
      type: "actionsMenu",
      contextLabel: "Sales Order SO-2024-0392: More Actions",
      actions: [
        { label: "Edit", highlighted: false },
        { label: "Print", highlighted: false },
        { label: "Clone Order", highlighted: true },
        { label: "Archive", highlighted: false },
        { label: "Cancel Order", highlighted: false },
        { label: "Delete", highlighted: false },
      ],
      annotationText: "Order cloning is not available.",
    },
    infoNoteOn: "Sales orders can be cloned to create similar orders quickly.",
    infoNoteOff: "Order cloning is not available.",
    path: "Sales Orders → Detail → More Actions menu → Clone Order action",
  },

  "so-archive": {
    permissionName: "Archive Sales Orders",
    moduleName: "Sales Orders",
    previewData: {
      type: "actionsMenu",
      contextLabel: "Sales Order SO-2024-0392: More Actions",
      actions: [
        { label: "Edit", highlighted: false },
        { label: "Print", highlighted: false },
        { label: "Clone Order", highlighted: false },
        { label: "Archive", highlighted: true },
        { label: "Delete", highlighted: false },
      ],
      annotationText: "Order archival and restoration are not available.",
    },
    infoNoteOn: "Orders can be archived and unarchived to manage view clutter.",
    infoNoteOff: "Order archival and restoration are not available.",
    path: "Sales Orders → Detail → More Actions menu → Archive and Unarchive actions",
  },

  "ur-access": {
    permissionName: "Access Users & Roles Module",
    moduleName: "Users & Roles",
    previewData: {
      type: "sidebarNav",
      moduleEntries: [
        { label: "Item Library", isTarget: false },
        { label: "Item Categories", isTarget: false },
        { label: "Cycle Count", isTarget: false },
        { label: "Unit of Measure", isTarget: false },
        { label: "Physical Inventory", isTarget: false },
        { label: "Warehouse Locations", isTarget: false },
        { label: "Partners & Partner Groups", isTarget: false },
        { label: "Purchase Orders", isTarget: false },
        { label: "Receiving", isTarget: false },
        { label: "Inventory Movement", isTarget: false },
        { label: "Shipments", isTarget: false },
        { label: "Quotes", isTarget: false },
        { label: "Sales Orders", isTarget: false },
        { label: "Users & Roles", isTarget: true },
        { label: "Global MFA", isTarget: false },
        { label: "General Settings", isTarget: false },
        { label: "Module Defaults", isTarget: false },
      ],
      pageTitle: "Users & Roles",
    },
    infoNoteOn: "Users can access and navigate the Users & Roles module and all child pages.",
    infoNoteOff: "The Users & Roles module is hidden and inaccessible from the sidebar.",
    path: "Omne → Sidebar → Users & Roles Module",
    imageOn: "/view-in-module/ur-access-on.webp",
    imageOff: "/view-in-module/ur-access-off.webp",
    hotspotOn: { left: 3.07, top: 64.17, width: 14.2, height: 3.5 },
    hotspotOff: { left: 3.07, top: 64.17, width: 14.2, height: 3.5 },
  },

  "ur-view-billing": {
    permissionName: "View Billing Overview and Cost Impact",
    moduleName: "Users & Roles",
    previewData: {
      type: "listing",
      toolbarButtons: [],
      columns: [],
      sampleRows: [],
    },
    infoNoteOn: "License cost data, billing impact, and spend summaries are visible, including the Monthly License Cost insight.",
    infoNoteOff: "Cost and billing data is hidden. The Monthly License Cost insight is removed for this role.",
    path: "Users & Roles → Users → Performance Insights → License & Cost",
    imageOn: "/view-in-module/ur-view-billing-on.webp",
    imageOff: "/view-in-module/ur-view-billing-off.webp",
    hotspotOn: { left: 67.29, top: 27.06, width: 14.85, height: 5.97 },
    hotspotOff: { left: 67.29, top: 27.06, width: 14.85, height: 5.97 },
  },

  /* License figures follow lib/license-billing.ts: $5.00 and $0.50 per user
   * per day, monthly estimates over its 30-day cycle. */
  "ur-view-audit": {
    permissionName: "View Billing Overview and Cost Impact",
    moduleName: "Users & Roles",
    previewData: {
      type: "detail",
      headerTitle: "Users: Billing Overview",
      fields: [
        { label: "Total Monthly Cost", value: "$7,980", highlighted: true, offState: "hidden" as const },
        { label: "Full Access Licenses", value: "45 users × $5.00/user/day ≈ $6,750/mo", highlighted: true, offState: "hidden" as const },
        { label: "Field User Licenses", value: "82 users × $0.50/user/day ≈ $1,230/mo", highlighted: true, offState: "hidden" as const },
        { label: "Sarah Mitchell: License Cost", value: "$5.00/user/day (~$150.00/mo)", highlighted: true, offState: "hidden" as const },
        { label: "James Chen: License Cost", value: "$0.50/user/day (~$15.00/mo)", highlighted: true, offState: "hidden" as const },
        { label: "Fatima Al-Rashid: License Cost", value: "$5.00/user/day (~$150.00/mo)", highlighted: true, offState: "hidden" as const },
      ],
    },
    infoNoteOn: "View license costs, monthly spend, and cost impact of user changes across all license tiers.",
    infoNoteOff: "Billing overview and cost data are hidden from this view.",
    path: "Users & Roles → Users → Billing Overview Section",
  },

  "ur-create-user": {
    permissionName: "Create and Edit Users",
    moduleName: "Users & Roles",
    previewData: {
      type: "listing",
      toolbarButtons: [
        { label: "Create User", highlighted: true },
      ],
      columns: [
        { header: "Name", highlighted: false },
        { header: "Email", highlighted: false },
        { header: "Job Title", highlighted: false },
        { header: "Role", highlighted: false },
        { header: "Status", highlighted: false },
      ],
      sampleRows: [
        { cells: ["Sarah Mitchell", "sarah.mitchell@company.com", "Shift Supervisor", "Warehouse Supervisor", "Active"] },
        { cells: ["James Chen", "james.chen@company.com", "Inventory Planner", "Inventory Lead", "Active"] },
        { cells: ["Fatima Al-Rashid", "fatima.al-rashid@company.com", "Finance Analyst", "Finance Admin", "Active"] },
      ],
      rowActions: [
        { label: "Edit", highlighted: true },
      ],
    },
    infoNoteOn: "Create new users and edit existing user profiles including name, email, and job title.",
    infoNoteOff: "User creation and editing capabilities are restricted. User records can be viewed but not modified.",
    path: "Users & Roles → Users → Create / Edit Actions",
    imageOn: "/view-in-module/ur-create-user-on.webp",
    imageOff: "/view-in-module/ur-create-user-off.webp",
    hotspotOn: { left: 86.82, top: 8.67, width: 11.05, height: 4 },
    hotspotOff: { left: 86.82, top: 8.67, width: 11.05, height: 4 },
  },

  "ur-reset-password": {
    permissionName: "Send Secure Login and Password Reset Instructions",
    moduleName: "Users & Roles",
    previewData: {
      type: "actionsMenu",
      contextLabel: "User Detail: Sarah Mitchell",
      actions: [
        { label: "Send Login Instructions", highlighted: true },
        { label: "Reset Password", highlighted: true },
        { label: "Archive", highlighted: false },
        { label: "View Activity", highlighted: false },
      ],
      annotationText: "Login and password reset actions unavailable.",
    },
    infoNoteOn: "Send secure login instructions and password reset emails to users.",
    infoNoteOff: "Login and password reset instruction actions are not available.",
    path: "Users & Roles → Users → User Detail → Actions Menu",
  },

  "ur-deactivate-user": {
    permissionName: "Deactivate User",
    moduleName: "Users & Roles",
    previewData: {
      type: "actionsMenu",
      contextLabel: "User Detail: James Chen",
      actions: [
        { label: "View Profile", highlighted: false },
        { label: "Edit Profile", highlighted: false },
        { label: "Deactivate User", highlighted: true },
        { label: "Archive User", highlighted: false, isDestructive: true },
      ],
      annotationText: "Deactivate action not available.",
    },
    infoNoteOn: "Temporarily deactivate a user to revoke access. Reactivating restores their roles and permissions intact.",
    infoNoteOff: "The Deactivate User action is not available. Access cannot be paused from here.",
    path: "Users & Roles → Users → User Actions → Deactivate",
  },

  "ur-bulk-deactivate-users": {
    permissionName: "Bulk Deactivate Users",
    moduleName: "Users & Roles",
    previewData: {
      type: "actionsMenu",
      contextLabel: "Users: 12 selected",
      actions: [
        { label: "Change License", highlighted: false },
        { label: "Deactivate", highlighted: true },
        { label: "Archive", highlighted: false, isDestructive: true },
      ],
      annotationText: "Bulk deactivate not available.",
    },
    infoNoteOn: "The bulk Deactivate action appears in the selection bar: pause access for multiple selected users at once.",
    infoNoteOff: "The bulk Deactivate action is not visible. This role cannot deactivate users in bulk.",
    path: "Users & Roles → Users → Selection Bar → Deactivate",
  },

  "ur-archive-user": {
    permissionName: "Archive User",
    moduleName: "Users & Roles",
    previewData: {
      type: "actionsMenu",
      contextLabel: "User Detail: James Chen",
      actions: [
        { label: "View Profile", highlighted: false },
        { label: "Edit Profile", highlighted: false },
        { label: "Deactivate User", highlighted: false },
        { label: "Archive User", highlighted: true, isDestructive: true },
      ],
      annotationText: "Archive action not available.",
    },
    infoNoteOn: "Archive a user account. Archiving clears their roles, direct permission assignments, and MFA enrolments; Unarchive returns them as Draft, or as Invite Sent if a fresh invitation is sent with it.",
    infoNoteOff: "The Archive User action is not available. This role cannot archive users.",
    path: "Users & Roles → Users → User Actions → Archive",
  },

  "ur-manage-licenses": {
    permissionName: "Upgrade and Downgrade User License",
    moduleName: "Users & Roles",
    previewData: {
      type: "detail",
      headerTitle: "User Profile: Fatima Al-Rashid",
      fields: [
        { label: "Current License", value: "Field User ($0.50/user/day)", highlighted: true, offState: "readonly" as const },
        { label: "Available Tiers", value: "Full Access ($5.00/user/day) · Field User ($0.50/user/day) · No License ($0.00)", highlighted: true, offState: "hidden" as const },
        { label: "Upgrade Cost Impact", value: "+$4.50/user/day (~$135.00/mo)", highlighted: true, offState: "hidden" as const },
      ],
      actionButtons: [
        { label: "Change License", highlighted: true },
      ],
    },
    infoNoteOn: "Change a user license tier to upgrade to Full Access or downgrade to a lower-tier license.",
    infoNoteOff: "User license tier cannot be changed and is displayed as read-only.",
    path: "Users & Roles → User Detail → License Section",
  },

  "ur-export-users": {
    permissionName: "Bulk License Changes",
    moduleName: "Users & Roles",
    previewData: {
      type: "listing",
      toolbarButtons: [
        { label: "Bulk License Change", highlighted: true },
      ],
      columns: [
        { header: "☑", highlighted: false },
        { header: "Name", highlighted: false },
        { header: "Current License", highlighted: false },
        { header: "Status", highlighted: false },
      ],
      sampleRows: [
        { cells: ["☑", "Sarah Mitchell", "Full Access", "Active"], rowHighlighted: true },
        { cells: ["☑", "James Chen", "Field User", "Active"], rowHighlighted: true },
        { cells: ["☑", "Fatima Al-Rashid", "Full Access", "Active"], rowHighlighted: true },
      ],
    },
    infoNoteOn: "Change license tier for multiple users simultaneously and preview total cost impact.",
    infoNoteOff: "Bulk license change action is not available. Licenses must be changed individually.",
    path: "Users & Roles → Users → Bulk Actions",
  },

  "ur-assign-roles": {
    permissionName: "Assign Roles",
    moduleName: "Users & Roles",
    previewData: {
      type: "detail",
      headerTitle: "User Profile: Sarah Mitchell, Roles",
      fields: [
        { label: "Warehouse Supervisor", value: "Primary Role", highlighted: true, offState: "readonly" as const },
        { label: "Inventory Viewer", value: "Secondary Role", highlighted: true, offState: "readonly" as const },
      ],
      actionButtons: [
        { label: "Assign Role", highlighted: true },
      ],
    },
    infoNoteOn: "Assign one or more roles to a user, granting access to specific permissions within those roles.",
    infoNoteOff: "Role assignment is disabled. Existing roles are visible but cannot be modified.",
    path: "Users & Roles → User Detail → Roles Section / Create User → Step 1",
  },

  "ur-create-role": {
    permissionName: "Create and Edit Roles",
    moduleName: "Users & Roles",
    previewData: {
      type: "listing",
      toolbarButtons: [
        { label: "Create Role", highlighted: true },
      ],
      columns: [
        { header: "Role Name", highlighted: false },
        { header: "Description", highlighted: false },
        { header: "Category", highlighted: false },
        { header: "Users", highlighted: false },
      ],
      sampleRows: [
        { cells: ["Warehouse Supervisor", "Manages warehouse operations", "Operations", "12"] },
        { cells: ["Sales Lead", "Handles sales pipeline", "Sales", "8"] },
        { cells: ["IT Admin", "System administration", "IT", "3"] },
      ],
      rowActions: [
        { label: "Edit", highlighted: true },
      ],
    },
    infoNoteOn: "Create new roles and edit role details including name, description, and category.",
    infoNoteOff: "Role creation and editing are disabled. Existing roles can be viewed but not modified.",
    path: "Users & Roles → Roles → Create / Edit Actions",
  },

  "ur-deactivate-role": {
    permissionName: "Deactivate or Reactivate Role",
    moduleName: "Users & Roles",
    previewData: {
      type: "actionsMenu",
      contextLabel: "Role: Warehouse Supervisor",
      actions: [
        { label: "Deactivate Role", highlighted: true },
        { label: "Reactivate Role", highlighted: true },
      ],
      annotationText: "Role pause actions unavailable.",
    },
    infoNoteOn: "The Deactivate and Reactivate actions appear in a role's actions menu: pause a custom role and bring it back. Pausing unassigns its current holders and keeps its permissions and owners.",
    infoNoteOff: "The Deactivate and Reactivate actions are not visible. This role cannot pause a role or bring one back.",
    path: "Users & Roles → Roles → Row Actions → Deactivate / Reactivate",
  },

  "ur-archive-role": {
    permissionName: "Archive or Unarchive Role",
    moduleName: "Users & Roles",
    previewData: {
      type: "actionsMenu",
      contextLabel: "Role: Warehouse Supervisor",
      actions: [
        { label: "Archive Role", highlighted: true, isDestructive: true },
        { label: "Unarchive Role", highlighted: true },
      ],
      annotationText: "Role archive actions unavailable.",
    },
    infoNoteOn: "The Archive and Unarchive actions appear in a role's actions menu. Archiving clears the role's owners and unassigns every holder but keeps its permissions; unarchiving returns it with those permissions and no users or owners.",
    infoNoteOff: "The Archive and Unarchive actions are not visible. This role cannot archive a role or bring one back.",
    path: "Users & Roles → Roles → Row Actions → Archive / Unarchive",
  },

  "ur-bulk-roles-destructive": {
    permissionName: "Bulk Deactivate or Archive Roles",
    moduleName: "Users & Roles",
    previewData: {
      type: "actionsMenu",
      contextLabel: "Roles: 4 selected",
      actions: [
        { label: "Deactivate", highlighted: true },
        { label: "Archive", highlighted: true, isDestructive: true },
      ],
      annotationText: "Bulk role actions unavailable.",
    },
    infoNoteOn: "The bulk Deactivate and Archive actions appear in the Roles selection bar: act on multiple roles at once.",
    infoNoteOff: "The bulk role actions are not visible. This role cannot deactivate or archive roles in bulk.",
    path: "Users & Roles → Roles → Selection Bar → Deactivate / Archive",
  },

  "ur-manage-permissions": {
    permissionName: "Manage Role Permissions",
    moduleName: "Users & Roles",
    previewData: {
      type: "detail",
      headerTitle: "Role: Warehouse Supervisor, Permissions",
      fields: [
        { label: "Item Library: View Item Details", value: "ON", highlighted: true, offState: "disabled" as const },
        { label: "Item Library: Create and Edit Items", value: "ON", highlighted: true, offState: "disabled" as const },
        { label: "Item Library: Delete Items", value: "OFF", highlighted: true, offState: "disabled" as const },
        { label: "Inventory Management: View Stock Levels", value: "ON", highlighted: true, offState: "disabled" as const },
        { label: "Inventory Management: Adjust Quantities", value: "ON", highlighted: true, offState: "disabled" as const },
      ],
      actionButtons: [
        { label: "Enable All", highlighted: true },
        { label: "Save Permissions", highlighted: true },
      ],
    },
    infoNoteOn: "Enable or disable permissions for this role across all Omne modules and features. Changes take effect immediately for all assigned users.",
    infoNoteOff: "Role permissions cannot be modified. Permission configuration is locked.",
    path: "Users & Roles → Role Detail → Permissions Tab",
  },


  "mfa-access": {
    permissionName: "Access Global MFA Module",
    moduleName: "Global MFA",
    previewData: {
      type: "sidebarNav",
      moduleEntries: [
        { label: "Item Library", isTarget: false },
        { label: "Item Categories", isTarget: false },
        { label: "Cycle Count", isTarget: false },
        { label: "Unit of Measure", isTarget: false },
        { label: "Physical Inventory", isTarget: false },
        { label: "Warehouse Locations", isTarget: false },
        { label: "Partners & Partner Groups", isTarget: false },
        { label: "Purchase Orders", isTarget: false },
        { label: "Receiving", isTarget: false },
        { label: "Inventory Movement", isTarget: false },
        { label: "Shipments", isTarget: false },
        { label: "Quotes", isTarget: false },
        { label: "Sales Orders", isTarget: false },
        { label: "Users & Roles", isTarget: false },
        { label: "Global MFA", isTarget: true },
        { label: "General Settings", isTarget: false },
        { label: "Module Defaults", isTarget: false },
      ],
      pageTitle: "Global MFA",
    },
    infoNoteOn: "Users can access and manage the Global MFA module and all MFA policies.",
    infoNoteOff: "The Global MFA module is hidden and inaccessible.",
    path: "Omne → Sidebar → Global MFA Module",
  },

  "mfa-manage": {
    permissionName: "Manage Global MFA",
    moduleName: "Global MFA",
    previewData: {
      type: "detail",
      headerTitle: "MFA Policy: Enterprise Standard",
      fields: [
        { label: "Policy Name", value: "Enterprise Standard", highlighted: true, offState: "readonly" as const },
        { label: "Enforcement Level", value: "Required for All", highlighted: true, offState: "readonly" as const },
        { label: "Authenticator App", value: "Enabled ☑", highlighted: true, offState: "readonly" as const },
        { label: "SMS", value: "Enabled ☑", highlighted: true, offState: "readonly" as const },
        { label: "Email", value: "Disabled ☐", highlighted: true, offState: "readonly" as const },
        { label: "FIDO2", value: "Disabled ☐", highlighted: true, offState: "readonly" as const },
        { label: "Grace Period", value: "7 days", highlighted: true, offState: "readonly" as const },
        { label: "Sarah Mitchell: MFA Status", value: "Verified · iPhone", highlighted: true, offState: "readonly" as const },
        { label: "James Chen: MFA Status", value: "Unverified · Android", highlighted: true, offState: "readonly" as const },
      ],
      actionButtons: [
        { label: "Create Policy", highlighted: true },
        { label: "Save Policy", highlighted: true },
        { label: "Reset Device", highlighted: true },
        { label: "Generate Bypass Code", highlighted: true },
      ],
    },
    infoNoteOn: "Create and configure MFA policies, set enforcement levels, enable authentication methods, define grace periods, and manage user MFA device status.",
    infoNoteOff: "MFA policy management is locked. Policies can be viewed but not modified.",
    path: "Global MFA → MFA Policies → Policy Detail / User MFA Status",
  },

  "mfa-delete": {
    permissionName: "Delete MFA Policy",
    moduleName: "Global MFA",
    previewData: {
      type: "actionsMenu",
      contextLabel: "MFA Policy: Field User Relaxed",
      actions: [
        { label: "Edit Policy", highlighted: false },
        { label: "Delete Policy", highlighted: true, isDestructive: true },
      ],
      annotationText: "Delete policy action unavailable.",
    },
    infoNoteOn: "Delete an MFA policy. Warning: Deleting removes MFA enforcement for all users assigned to that policy.",
    infoNoteOff: "Policy deletion is not available. MFA policies cannot be deleted.",
    path: "Global MFA → MFA Policies → Policy Actions → Delete",
  },

  "pia-access": {
    permissionName: "Access Physical Inventory Mobile App",
    moduleName: "Physical Inventory App",
    previewData: {
      type: "mobile",
      appName: "Omne Mobile",
      screenElements: [
        { label: "Physical Inventory", highlighted: true, offState: "hidden" as const },
        { label: "Receiving", highlighted: false, offState: "hidden" as const },
        { label: "Movement", highlighted: false, offState: "hidden" as const },
        { label: "Cycle Count", highlighted: false, offState: "hidden" as const },
        { label: "Settings", highlighted: false, offState: "hidden" as const },
        { label: "Help", highlighted: false, offState: "hidden" as const },
      ],
    },
    infoNoteOn: "Users can launch and use the Physical Inventory mobile app on supported devices.",
    infoNoteOff: "Physical Inventory mobile app is not available and cannot be accessed.",
    path: "Mobile → App Launcher → Physical Inventory",
  },

  "pia-view-valuation": {
    permissionName: "View Inventory Valuation Data (Mobile)",
    moduleName: "Physical Inventory App",
    previewData: {
      type: "mobile",
      appName: "Physical Inventory",
      screenElements: [
        { label: "Qty On Hand: 2,450 units", highlighted: false, offState: "hidden" as const },
        { label: "Unit Cost: $24.50", highlighted: true, offState: "hidden" as const },
        { label: "Total Value: $60,025.00", highlighted: true, offState: "hidden" as const },
        { label: "Location: Bin A-12", highlighted: false, offState: "hidden" as const },
        { label: "Last Counted: 2026-03-20", highlighted: false, offState: "hidden" as const },
        { label: "Status: In Stock", highlighted: false, offState: "hidden" as const },
      ],
    },
    infoNoteOn: "View unit cost, total value, and inventory valuation calculations for items in the Physical Inventory app.",
    infoNoteOff: "Valuation data including unit cost and total value are hidden from item details.",
    path: "Physical Inventory App → Item Detail → Valuation Section",
  },

  "pia-increase": {
    permissionName: "Increase Inventory (Mobile)",
    moduleName: "Physical Inventory App",
    previewData: {
      type: "mobile",
      appName: "Physical Inventory",
      screenElements: [
        { label: "Increase", highlighted: true, offState: "hidden" as const },
        { label: "Decrease", highlighted: false, offState: "hidden" as const },
        { label: "Transfer", highlighted: false, offState: "hidden" as const },
      ],
    },
    infoNoteOn: "Increase inventory quantity for items and record the reason for the adjustment.",
    infoNoteOff: "Inventory increase action is not available in the mobile app.",
    path: "Physical Inventory App → Item Detail → Actions → Increase",
  },

  "pia-decrease": {
    permissionName: "Decrease Inventory (Mobile)",
    moduleName: "Physical Inventory App",
    previewData: {
      type: "mobile",
      appName: "Physical Inventory",
      screenElements: [
        { label: "Increase", highlighted: false, offState: "hidden" as const },
        { label: "Decrease", highlighted: true, offState: "hidden" as const },
        { label: "Transfer", highlighted: false, offState: "hidden" as const },
      ],
    },
    infoNoteOn: "Decrease inventory quantity for items and document the reason such as damage, theft, or shrinkage.",
    infoNoteOff: "Inventory decrease action is not available in the mobile app.",
    path: "Physical Inventory App → Item Detail → Actions → Decrease",
  },

  "pia-print-labels": {
    permissionName: "Print Labels (Mobile)",
    moduleName: "Physical Inventory App",
    previewData: {
      type: "mobile",
      appName: "Physical Inventory",
      screenElements: [
        { label: "View Item Details", highlighted: false, offState: "hidden" as const },
        { label: "Scan Barcode", highlighted: false, offState: "hidden" as const },
        { label: "Print Label", highlighted: true, offState: "hidden" as const },
      ],
    },
    infoNoteOn: "Print inventory item labels and location labels from the mobile app.",
    infoNoteOff: "Print label functionality is not available in the mobile app.",
    path: "Physical Inventory App → Item / Location Detail → Actions → Print Label",
  },

  "ra-access": {
    permissionName: "Access Receiving Mobile App",
    moduleName: "Receiving App",
    previewData: {
      type: "mobile",
      appName: "Omne Mobile",
      screenElements: [
        { label: "Physical Inventory", highlighted: false, offState: "hidden" as const },
        { label: "Receiving", highlighted: true, offState: "hidden" as const },
        { label: "Movement", highlighted: false, offState: "hidden" as const },
        { label: "Cycle Count", highlighted: false, offState: "hidden" as const },
        { label: "Settings", highlighted: false, offState: "hidden" as const },
        { label: "Help", highlighted: false, offState: "hidden" as const },
      ],
    },
    infoNoteOn: "Users can launch and use the Receiving mobile app for receiving tasks and shipment verification.",
    infoNoteOff: "Receiving mobile app is not available.",
    path: "Mobile → App Launcher → Receiving",
  },

  "ra-execute": {
    permissionName: "Execute Receiving Tasks",
    moduleName: "Receiving App",
    previewData: {
      type: "mobile",
      appName: "Receiving",
      screenElements: [
        { label: "Scan Barcode", highlighted: true, offState: "disabled" as const },
        { label: "Qty Scanned", highlighted: true, offState: "disabled" as const },
        { label: "Confirm Receipt", highlighted: true, offState: "hidden" as const },
        { label: "Complete Task", highlighted: true, offState: "hidden" as const },
      ],
    },
    infoNoteOn: "Execute receiving tasks including scanning items, confirming receipts, and marking tasks complete.",
    infoNoteOff: "Receiving task execution is disabled. Tasks can be viewed but not processed.",
    path: "Receiving App → Task Detail → Execution Controls",
  },

  "ma-access": {
    permissionName: "Access Movement Mobile App",
    moduleName: "Movement App",
    previewData: {
      type: "mobile",
      appName: "Omne Mobile",
      screenElements: [
        { label: "Physical Inventory", highlighted: false, offState: "hidden" as const },
        { label: "Receiving", highlighted: false, offState: "hidden" as const },
        { label: "Movement", highlighted: true, offState: "hidden" as const },
        { label: "Cycle Count", highlighted: false, offState: "hidden" as const },
        { label: "Settings", highlighted: false, offState: "hidden" as const },
        { label: "Help", highlighted: false, offState: "hidden" as const },
      ],
    },
    infoNoteOn: "Users can launch and use the Movement mobile app for inventory transfer tasks.",
    infoNoteOff: "Movement mobile app is not available.",
    path: "Mobile → App Launcher → Movement",
  },

  "ma-execute": {
    permissionName: "Execute Movement Tasks",
    moduleName: "Movement App",
    previewData: {
      type: "mobile",
      appName: "Movement",
      screenElements: [
        { label: "Accept Task", highlighted: true, offState: "hidden" as const },
        { label: "Scan & Confirm", highlighted: true, offState: "disabled" as const },
        { label: "Confirm Transfer", highlighted: true, offState: "hidden" as const },
        { label: "Complete Task", highlighted: true, offState: "hidden" as const },
      ],
    },
    infoNoteOn: "Execute movement tasks including accepting transfers, scanning items, and confirming movements between locations.",
    infoNoteOff: "Movement task execution is disabled. Tasks are view-only.",
    path: "Movement App → Task Detail → Execution Controls",
  },

  "ma-adhoc": {
    permissionName: "Create Ad-Hoc Movements (Mobile)",
    moduleName: "Movement App",
    previewData: {
      type: "mobile",
      appName: "Movement",
      screenElements: [
        { label: "Pending Tasks", highlighted: false, offState: "hidden" as const },
        { label: "In Progress", highlighted: false, offState: "hidden" as const },
        { label: "Create Movement", highlighted: true, offState: "hidden" as const },
      ],
    },
    infoNoteOn: "Create unscheduled inventory movements directly from the mobile app without a planned task.",
    infoNoteOff: "Ad-hoc movement creation is not available in the mobile app.",
    path: "Movement App → Home → Create Ad-Hoc Movement Action",
  },

  "cca-access": {
    permissionName: "Access Cycle Count Mobile App",
    moduleName: "Cycle Count App",
    previewData: {
      type: "mobile",
      appName: "Omne Mobile",
      screenElements: [
        { label: "Physical Inventory", highlighted: false, offState: "hidden" as const },
        { label: "Receiving", highlighted: false, offState: "hidden" as const },
        { label: "Movement", highlighted: false, offState: "hidden" as const },
        { label: "Cycle Count", highlighted: true, offState: "hidden" as const },
        { label: "Settings", highlighted: false, offState: "hidden" as const },
        { label: "Help", highlighted: false, offState: "hidden" as const },
      ],
    },
    infoNoteOn: "Users can launch and use the Cycle Count mobile app for inventory cycle counting tasks.",
    infoNoteOff: "Cycle Count mobile app is not available.",
    path: "Mobile → App Launcher → Cycle Count",
  },

  "cca-execute": {
    permissionName: "Execute Cycle Count Tasks",
    moduleName: "Cycle Count App",
    previewData: {
      type: "mobile",
      appName: "Cycle Count",
      screenElements: [
        { label: "Start Count", highlighted: true, offState: "hidden" as const },
        { label: "Scan Item Barcode", highlighted: true, offState: "disabled" as const },
        { label: "Actual Qty", highlighted: true, offState: "disabled" as const },
        { label: "Submit Results", highlighted: true, offState: "hidden" as const },
        { label: "Save and Resume", highlighted: true, offState: "hidden" as const },
      ],
    },
    infoNoteOn: "Execute cycle count tasks including scanning items, recording actual quantities, and submitting count results.",
    infoNoteOff: "Cycle count task execution is disabled. Count tasks can be viewed but not processed.",
    path: "Cycle Count App → Task Detail → Execution Controls",
  },
};

// ─── Users & Roles: real screenshots + animated hotspots ────────────────────
// These entries carry actual captures of the running app (On = element active,
// Off = element greyed to 50%). They are keyed by the real permission ids from
// permissions-data.ts and merged in last so they take precedence over any
// legacy recreation-preview entries above. Captured at 1500×900 (5:3); hotspot
// coordinates are normalized percentages of the image.
const UR_REAL_SCREENSHOTS: Record<string, ViewInModuleEntry> = {
  "ur-reset-password": {
    permissionName: "Send Secure Login / Password Reset Instructions",
    moduleName: "Users & Roles",
    infoNoteOn:
      "The Reset Password action is available in a user's row actions menu: send a secure login link or password reset to any user.",
    infoNoteOff:
      "The Reset Password action is not visible. This role cannot trigger password resets or secure login links.",
    path: "Users & Roles → Users → Row Actions → Reset Password",
    imageOn: "/view-in-module/ur-reset-password-on.webp",
    imageOff: "/view-in-module/ur-reset-password-off.webp",
    hotspotOn: { left: 80.67, top: 62.22, width: 14.67, height: 3.56 },
    hotspotOff: { left: 80.67, top: 62.22, width: 14.67, height: 3.56 },
  },
  /* The v1.3 split of the bundled Archive user into Deactivate user + Archive
   * user now has a capture per half. Both are the same row-actions menu with a
   * different row greyed in the Off state, so the hotspots differ by one row
   * height and each entry owns its own image stem. */
  "ur-deactivate-user": {
    permissionName: "Deactivate User",
    moduleName: "Users & Roles",
    infoNoteOn:
      "The Deactivate User action is available in the row actions menu: switch a user's access off reversibly, keeping their roles, permissions, and MFA for when they return.",
    infoNoteOff:
      "The Deactivate User action is not visible. This role cannot deactivate users.",
    path: "Users & Roles → Users → Row Actions → Deactivate User",
    imageOn: "/view-in-module/ur-deactivate-user-on.webp",
    imageOff: "/view-in-module/ur-deactivate-user-off.webp",
    hotspotOn: { left: 80.67, top: 70.28, width: 14.67, height: 3.56 },
    hotspotOff: { left: 80.67, top: 70.28, width: 14.67, height: 3.56 },
  },
  "ur-archive-user": {
    permissionName: "Archive User",
    moduleName: "Users & Roles",
    infoNoteOn:
      "The Archive User action is available in the row actions menu: archive a single user, clearing their roles, direct permission assignments, and MFA enrolments.",
    infoNoteOff:
      "The Archive User action is not visible. This role cannot archive users.",
    path: "Users & Roles → Users → Row Actions → Archive User",
    imageOn: "/view-in-module/ur-archive-user-on.webp",
    imageOff: "/view-in-module/ur-archive-user-off.webp",
    hotspotOn: { left: 80.67, top: 73.83, width: 14.67, height: 3.56 },
    hotspotOff: { left: 80.67, top: 73.83, width: 14.67, height: 3.56 },
  },
  "ur-bulk-deactivate-users": {
    permissionName: "Bulk Deactivate Users",
    moduleName: "Users & Roles",
    infoNoteOn:
      "The Deactivate action is available in the bulk actions bar once users are selected: switch off access for the whole selection in one confirm.",
    infoNoteOff:
      "The bulk Deactivate action is not visible. This role cannot deactivate users in bulk, even where it can deactivate them one at a time.",
    path: "Users & Roles → Users → Select Users → Bulk Actions → Deactivate",
    imageOn: "/view-in-module/ur-bulk-deactivate-users-on.webp",
    imageOff: "/view-in-module/ur-bulk-deactivate-users-off.webp",
    hotspotOn: { left: 45.63, top: 41.44, width: 6.89, height: 3.56 },
    hotspotOff: { left: 45.63, top: 41.44, width: 6.89, height: 3.56 },
  },
  /* Role lifecycle is only offered on CUSTOM roles: predefined roles cannot be
   * deactivated or archived at all, so the captures below are taken on the
   * custom-roles group at the top of the Roles tab. */
  "ur-deactivate-role": {
    permissionName: "Deactivate or Reactivate Role",
    moduleName: "Users & Roles",
    infoNoteOn:
      "The Deactivate Role action is available in a custom role's row actions menu: pause the role, unassigning its holders while its permissions and owners stay as they were.",
    infoNoteOff:
      "The Deactivate Role action is not visible. This role cannot pause or reactivate custom roles.",
    path: "Users & Roles → Roles → Custom Roles → Row Actions → Deactivate Role",
    imageOn: "/view-in-module/ur-deactivate-role-on.webp",
    imageOff: "/view-in-module/ur-deactivate-role-off.webp",
    hotspotOn: { left: 79.33, top: 71.17, width: 16, height: 3.56 },
    hotspotOff: { left: 79.33, top: 71.17, width: 16, height: 3.56 },
  },
  "ur-archive-role": {
    permissionName: "Archive or Unarchive Role",
    moduleName: "Users & Roles",
    infoNoteOn:
      "The Archive Role action is available in a custom role's row actions menu: archive the role, clearing its owners and unassigning every holder while keeping its permissions.",
    infoNoteOff:
      "The Archive Role action is not visible. This role cannot archive or unarchive custom roles.",
    path: "Users & Roles → Roles → Custom Roles → Row Actions → Archive Role",
    imageOn: "/view-in-module/ur-archive-role-on.webp",
    imageOff: "/view-in-module/ur-archive-role-off.webp",
    hotspotOn: { left: 79.33, top: 74.72, width: 16, height: 3.56 },
    hotspotOff: { left: 79.33, top: 74.72, width: 16, height: 3.56 },
  },
  "ur-bulk-roles-destructive": {
    permissionName: "Bulk Deactivate or Archive Roles",
    moduleName: "Users & Roles",
    infoNoteOn:
      "The Deactivate and Archive actions are available in the Roles bulk actions bar once custom roles are selected: one confirm affects every selected role and its holders.",
    infoNoteOff:
      "The bulk Deactivate and Archive actions are not visible. This role cannot deactivate or archive roles in bulk, which is granted independently of the single-role actions.",
    path: "Users & Roles → Roles → Select Custom Roles → Bulk Actions → Deactivate / Archive",
    imageOn: "/view-in-module/ur-bulk-roles-destructive-on.webp",
    imageOff: "/view-in-module/ur-bulk-roles-destructive-off.webp",
    hotspotOn: { left: 27.1, top: 41.44, width: 13.01, height: 3.56 },
    hotspotOff: { left: 27.1, top: 41.44, width: 13.01, height: 3.56 },
  },
  "ur-manage-roles": {
    permissionName: "Manage Roles",
    moduleName: "Users & Roles",
    infoNoteOn:
      "The Manage Roles action is available in the row actions menu: manage role membership for the roles in this user's scope.",
    infoNoteOff:
      "The Manage Roles action is not visible. This role cannot manage role membership.",
    path: "Users & Roles → Users → Row Actions → Manage Roles",
    imageOn: "/view-in-module/ur-manage-roles-on.webp",
    imageOff: "/view-in-module/ur-manage-roles-off.webp",
    hotspotOn: { left: 80.67, top: 58.67, width: 14.67, height: 3.56 },
    hotspotOff: { left: 80.67, top: 58.67, width: 14.67, height: 3.56 },
  },
  "ur-manage-licenses": {
    permissionName: "Upgrade / Downgrade User License",
    moduleName: "Users & Roles",
    infoNoteOn:
      "The per-user License control is active: change a user's license tier directly from the directory (affects billing).",
    infoNoteOff:
      "The License control is read-only. This role cannot upgrade or downgrade license tiers.",
    path: "Users & Roles → Users → License Column",
    imageOn: "/view-in-module/ur-manage-licenses-on.webp",
    imageOff: "/view-in-module/ur-manage-licenses-off.webp",
    hotspotOn: { left: 53.53, top: 51.08, width: 6.63, height: 2.44 },
    hotspotOff: { left: 53.53, top: 51.08, width: 6.63, height: 2.44 },
  },
  "ur-bulk-archive": {
    permissionName: "Bulk Archive Users",
    moduleName: "Users & Roles",
    infoNoteOn:
      "The bulk Archive action appears in the selection bar: archive multiple selected users at once.",
    infoNoteOff:
      "The bulk Archive action is not visible. This role cannot archive users in bulk.",
    path: "Users & Roles → Users → Selection Bar → Archive",
    imageOn: "/view-in-module/ur-bulk-archive-on.webp",
    imageOff: "/view-in-module/ur-bulk-archive-off.webp",
    hotspotOn: { left: 52.92, top: 41.47, width: 5.72, height: 3.56 },
    hotspotOff: { left: 52.92, top: 41.47, width: 5.72, height: 3.56 },
  },
  "ur-bulk-license": {
    permissionName: "Bulk License Changes",
    moduleName: "Users & Roles",
    infoNoteOn:
      "The bulk Change License action appears in the selection bar: change license tier for multiple users at once.",
    infoNoteOff:
      "The bulk Change License action is not visible. This role cannot make bulk license changes.",
    path: "Users & Roles → Users → Selection Bar → Change License",
    imageOn: "/view-in-module/ur-bulk-license-on.webp",
    imageOff: "/view-in-module/ur-bulk-license-off.webp",
    hotspotOn: { left: 21.4, top: 41.47, width: 8.82, height: 3.56 },
    hotspotOff: { left: 21.4, top: 41.47, width: 8.82, height: 3.56 },
  },
  "ur-bulk-import-users": {
    permissionName: "Bulk Import Users",
    moduleName: "Users & Roles",
    infoNoteOn:
      "The Import action is available in the Actions menu: import many users from a template.",
    infoNoteOff:
      "The Import action shows in the Actions menu, but this role cannot use it to bulk-import users.",
    path: "Users & Roles → Users → Actions → Import",
    imageOn: "/view-in-module/ur-bulk-import-users-on.webp",
    imageOff: "/view-in-module/ur-bulk-import-users-off.webp",
    hotspotOn: { left: 67.37, top: 13.67, width: 8.93, height: 3.56 },
    hotspotOff: { left: 67.37, top: 13.67, width: 8.93, height: 3.56 },
  },
  "ur-export-users": {
    permissionName: "Bulk Export Users and Roles",
    moduleName: "Users & Roles",
    infoNoteOn:
      "The Export action is available in the Actions menu: export the user list, profiles, roles, and license data, and the role list.",
    infoNoteOff:
      "The Export action shows in the Actions menu, but this role cannot use it to export users or roles.",
    path: "Users & Roles → Users → Actions → Export",
    imageOn: "/view-in-module/ur-export-users-on.webp",
    imageOff: "/view-in-module/ur-export-users-off.webp",
    hotspotOn: { left: 67.37, top: 17.22, width: 8.93, height: 3.56 },
    hotspotOff: { left: 67.37, top: 17.22, width: 8.93, height: 3.56 },
  },
  "ur-assign-roles": {
    permissionName: "Assign Roles",
    moduleName: "Users & Roles",
    infoNoteOn:
      "The Add Role control is active on the user's Roles & Permissions tab: assign existing roles to users and remove them.",
    infoNoteOff:
      "The Add Role control is not visible. This role cannot assign or remove roles.",
    path: "Users & Roles → User Detail → Roles & Permissions → Add Role",
    imageOn: "/view-in-module/ur-assign-roles-on.webp",
    imageOff: "/view-in-module/ur-assign-roles-off.webp",
    hotspotOn: { left: 89.14, top: 33.97, width: 7.6, height: 4 },
    hotspotOff: { left: 89.14, top: 33.97, width: 7.6, height: 4 },
  },
  "ur-create-role": {
    permissionName: "Create and Edit Roles",
    moduleName: "Users & Roles",
    infoNoteOn:
      "The Create New Role button is available on the Roles tab: create and edit role definitions and their permissions.",
    infoNoteOff:
      "The Create New Role button is not visible. This role cannot create or edit roles.",
    path: "Users & Roles → Roles → Create New Role",
    imageOn: "/view-in-module/ur-create-role-on.webp",
    imageOff: "/view-in-module/ur-create-role-off.webp",
    hotspotOn: { left: 86.98, top: 8.67, width: 10.89, height: 4 },
    hotspotOff: { left: 86.98, top: 8.67, width: 10.89, height: 4 },
  },
  "ur-manage-permissions": {
    permissionName: "Manage Granular Permissions",
    moduleName: "Users & Roles",
    infoNoteOn:
      "The Assigned Permissions tab is active on the User Detail page: add and remove direct permission assignments, layered over what the user's roles grant.",
    infoNoteOff:
      "The Assigned Permissions tab is not visible. This role cannot add or remove direct per-user permissions.",
    path: "Users & Roles → User Detail → Roles & Permissions → Assigned Permissions",
    imageOn: "/view-in-module/ur-manage-permissions-on.webp",
    imageOff: "/view-in-module/ur-manage-permissions-off.webp",
    hotspotOn: { left: 31.06, top: 34.86, width: 9.09, height: 2.22 },
    hotspotOff: { left: 31.06, top: 34.86, width: 9.09, height: 2.22 },
  },
  "ur-view-audit": {
    permissionName: "View Access Audit Logs",
    moduleName: "Users & Roles",
    infoNoteOn:
      "The Activity timeline is visible on the User Detail page: login history, role and permission change logs, and security events.",
    infoNoteOff:
      "The Activity timeline is not visible. Audit logs are hidden from this role.",
    path: "Users & Roles → User Detail → Activity",
    imageOn: "/view-in-module/ur-view-audit-on.webp",
    imageOff: "/view-in-module/ur-view-audit-off.webp",
  },
};

Object.assign(VIEW_IN_MODULE_DATA, UR_REAL_SCREENSHOTS);

/* ─── Partners Management real screenshots ───────────────────────────────────
 * Captured from the live Partners Management module (Partners, Partner Groups,
 * Contacts Directory) at 1500x900 @2x, same pipeline as the Users & Roles set:
 * the ON frame is the real screen, the OFF frame dims the gated control in
 * place, and the hotspot is that control's measured bounding box. */
const PM_REAL_SCREENSHOTS: Record<string, ViewInModuleEntry> = {
  "prt-access": {
    permissionName: "Access Partners Module",
    moduleName: "Partners",
    infoNoteOn:
      "The Partners entry is available in the sidebar: open the partner directory and every partner record with its commercial configuration.",
    infoNoteOff:
      "The Partners entry is not visible. This role cannot open the partner directory.",
    path: "Partners Management → Partners",
    imageOn: "/view-in-module/prt-access-on.webp",
    imageOff: "/view-in-module/prt-access-off.webp",
    hotspotOn: { left: 2.13, top: 17.43, width: 15.8, height: 3.86 },
    hotspotOff: { left: 2.13, top: 17.43, width: 15.8, height: 3.86 },
  },
  "prt-create-edit": {
    permissionName: "Create and Edit Partner",
    moduleName: "Partners",
    infoNoteOn:
      "The Create New Partner button is active: create partners and edit their group, locations, billing, shipping, and freight configuration.",
    infoNoteOff:
      "The Create New Partner button is not visible. This role cannot create or edit partners.",
    path: "Partners Management → Partners → Create New Partner",
    imageOn: "/view-in-module/prt-create-edit-on.webp",
    imageOff: "/view-in-module/prt-create-edit-off.webp",
    hotspotOn: { left: 86.47, top: 7.04, width: 13.13, height: 4.8 },
    hotspotOff: { left: 86.47, top: 7.04, width: 13.13, height: 4.8 },
  },
  "prt-config-vendor": {
    permissionName: "Configure Vendor Settings",
    moduleName: "Partners",
    infoNoteOn:
      "Vendor-side configuration is editable on a partner: vendor sub-types, vendor rules, and the commercial defaults that flow into purchase orders.",
    infoNoteOff:
      "Vendor-side configuration is read-only. This role can read vendor settings but cannot change them.",
    path: "Partners Management → Partners → Vendor Sub-Types",
    imageOn: "/view-in-module/prt-config-vendor-on.webp",
    imageOff: "/view-in-module/prt-config-vendor-off.webp",
    hotspotOn: { left: 52.2, top: 48.82, width: 15.47, height: 4.36 },
    hotspotOff: { left: 52.2, top: 48.82, width: 15.47, height: 4.36 },
  },
  "prt-config-customer": {
    permissionName: "Configure Customer Settings",
    moduleName: "Partners",
    infoNoteOn:
      "Customer-side configuration is editable on a partner: customer sub-types, customer rules, and the defaults that flow into quotes and sales orders.",
    infoNoteOff:
      "Customer-side configuration is read-only. This role can read customer settings but cannot change them.",
    path: "Partners Management → Partners → Customer Sub-Types",
    imageOn: "/view-in-module/prt-config-customer-on.webp",
    imageOff: "/view-in-module/prt-config-customer-off.webp",
    hotspotOn: { left: 66.87, top: 48.82, width: 15.47, height: 4.36 },
    hotspotOff: { left: 66.87, top: 48.82, width: 15.47, height: 4.36 },
  },
  "prt-payment-terms": {
    permissionName: "Configure Payment Terms",
    moduleName: "Partners",
    infoNoteOn:
      "The Payment terms field is editable on the partner: set the terms shown across quotes, sales orders, and purchase orders.",
    infoNoteOff:
      "The Payment terms field is read-only. This role cannot change partner payment terms.",
    path: "Partners Management → Partner → Edit → Financial Details → Payment terms",
    imageOn: "/view-in-module/prt-payment-terms-on.webp",
    imageOff: "/view-in-module/prt-payment-terms-off.webp",
    hotspotOn: { left: 62.53, top: 28.04, width: 24.2, height: 7.63 },
    hotspotOff: { left: 62.53, top: 28.04, width: 24.2, height: 7.63 },
  },
  "prt-credit-limit": {
    permissionName: "Configure Credit Limits",
    moduleName: "Partners",
    infoNoteOn:
      "The Credit limit field is editable: set and enforce the maximum credit a partner may carry.",
    infoNoteOff:
      "The Credit limit field is read-only. This role cannot set or change credit limits.",
    path: "Partners Management → Partner → Edit → Financial Details → Credit limit",
    imageOn: "/view-in-module/prt-credit-limit-on.webp",
    imageOff: "/view-in-module/prt-credit-limit-off.webp",
    hotspotOn: { left: 38.07, top: 36.66, width: 48.67, height: 16.24 },
    hotspotOff: { left: 38.07, top: 36.66, width: 48.67, height: 16.24 },
  },
  "prt-manage-pricing": {
    permissionName: "Configure Pricing Rules",
    moduleName: "Partners",
    infoNoteOn:
      "The Pricing Rules tab is active on the partner record: set partner-level pricing rules that auto-apply to quotes and sales orders.",
    infoNoteOff:
      "The Pricing Rules tab is not visible. This role cannot view or change partner pricing rules.",
    path: "Partners Management → Partner → Pricing Rules",
    imageOn: "/view-in-module/prt-manage-pricing-on.webp",
    imageOff: "/view-in-module/prt-manage-pricing-off.webp",
    hotspotOn: { left: 46.47, top: 14.66, width: 8.0, height: 5.41 },
    hotspotOff: { left: 46.47, top: 14.66, width: 8.0, height: 5.41 },
  },
  "prt-payment-method": {
    permissionName: "Configure Payment Method",
    moduleName: "Partners",
    infoNoteOn:
      "The Payment methods list is editable: choose the payment method used for this partner.",
    infoNoteOff:
      "The Payment methods list is read-only. This role cannot change the partner's payment method.",
    path: "Partners Management → Partner → Edit → Financial Details → Payment methods",
    imageOn: "/view-in-module/prt-payment-method-on.webp",
    imageOff: "/view-in-module/prt-payment-method-off.webp",
    hotspotOn: { left: 38.07, top: 55.77, width: 48.67, height: 18.3 },
    hotspotOff: { left: 38.07, top: 55.77, width: 48.67, height: 18.3 },
  },
  "prt-deactivate": {
    permissionName: "Archive Partner",
    moduleName: "Partners",
    infoNoteOn:
      "The Archive action is available in the row actions menu: archive partner records and locations, with a warning on open POs, SOs, or quotes.",
    infoNoteOff:
      "The Archive action is not visible. This role cannot archive partners.",
    path: "Partners Management → Partners → Row Actions → Archive",
    imageOn: "/view-in-module/prt-deactivate-on.webp",
    imageOff: "/view-in-module/prt-deactivate-off.webp",
    hotspotOn: { left: 83.07, top: 48.32, width: 14.8, height: 4.36 },
    hotspotOff: { left: 83.07, top: 48.32, width: 14.8, height: 4.36 },
  },
  "pg-access": {
    permissionName: "Access Partner Groups Module",
    moduleName: "Partner Group",
    infoNoteOn:
      "The Partner Groups entry is available in the sidebar: open group records and their inherited commercial configuration.",
    infoNoteOff:
      "The Partner Groups entry is not visible. This role cannot open partner groups.",
    path: "Partners Management → Partner Groups",
    imageOn: "/view-in-module/pg-access-on.webp",
    imageOff: "/view-in-module/pg-access-off.webp",
    hotspotOn: { left: 2.13, top: 20.6, width: 15.8, height: 3.86 },
    hotspotOff: { left: 2.13, top: 20.6, width: 15.8, height: 3.86 },
  },
  "pg-create-edit": {
    permissionName: "Create and Edit Partner Group",
    moduleName: "Partner Group",
    infoNoteOn:
      "The Create New Group button is active: create and edit partner groups whose configuration inherits to every attached partner.",
    infoNoteOff:
      "The Create New Group button is not visible. This role cannot create or edit partner groups.",
    path: "Partners Management → Partner Groups → Create New Group",
    imageOn: "/view-in-module/pg-create-edit-on.webp",
    imageOff: "/view-in-module/pg-create-edit-off.webp",
    hotspotOn: { left: 87.0, top: 7.04, width: 12.6, height: 4.8 },
    hotspotOff: { left: 87.0, top: 7.04, width: 12.6, height: 4.8 },
  },
  "pg-config-vendor": {
    permissionName: "Configure Vendor Settings",
    moduleName: "Partner Group",
    infoNoteOn:
      "The Vendor profiles configuration is editable on the group: vendor rules, carrier defaults, and profile-level settings inherited by attached partners.",
    infoNoteOff:
      "The Vendor profiles configuration is read-only. This role cannot change group vendor settings.",
    path: "Partners Management → Partner Group → Configuration → Vendor profiles",
    imageOn: "/view-in-module/pg-config-vendor-on.webp",
    imageOff: "/view-in-module/pg-config-vendor-off.webp",
    hotspotOn: { left: 19.73, top: 21.82, width: 9.27, height: 4.3 },
    hotspotOff: { left: 19.73, top: 21.82, width: 9.27, height: 4.3 },
  },
  "pg-config-customer": {
    permissionName: "Configure Customer Settings",
    moduleName: "Partner Group",
    infoNoteOn:
      "The Customer profiles configuration is editable on the group: customer rules and defaults inherited by attached partners.",
    infoNoteOff:
      "The Customer profiles configuration is read-only. This role cannot change group customer settings.",
    path: "Partners Management → Partner Group → Configuration → Customer profiles",
    imageOn: "/view-in-module/pg-config-customer-on.webp",
    imageOff: "/view-in-module/pg-config-customer-off.webp",
    hotspotOn: { left: 28.2, top: 21.82, width: 10.4, height: 4.3 },
    hotspotOff: { left: 28.2, top: 21.82, width: 10.4, height: 4.3 },
  },
  "pg-payment-terms": {
    permissionName: "Apply Payment Terms",
    moduleName: "Partner Group",
    infoNoteOn:
      "The Payment Terms section is editable in the group rules: set the terms inherited by every attached partner.",
    infoNoteOff:
      "The Payment Terms section is read-only. This role cannot change group payment terms.",
    path: "Partners Management → Partner Group → Configuration → Vendor Rules → Payment Terms",
    imageOn: "/view-in-module/pg-payment-terms-on.webp",
    imageOff: "/view-in-module/pg-payment-terms-off.webp",
    hotspotOn: { left: 11.07, top: 26.43, width: 15.13, height: 4.58 },
    hotspotOff: { left: 11.07, top: 26.43, width: 15.13, height: 4.58 },
  },
  "pg-manage-pricing": {
    permissionName: "Apply Pricing Rules",
    moduleName: "Partner Group",
    infoNoteOn:
      "The Pricing Rules section is editable in the group rules: set group pricing that auto-applies to quotes and sales orders for attached partners.",
    infoNoteOff:
      "The Pricing Rules section is read-only. This role cannot change group pricing rules.",
    path: "Partners Management → Partner Group → Configuration → Vendor Rules → Pricing Rules",
    imageOn: "/view-in-module/pg-manage-pricing-on.webp",
    imageOff: "/view-in-module/pg-manage-pricing-off.webp",
    hotspotOn: { left: 11.07, top: 30.43, width: 15.13, height: 4.58 },
    hotspotOff: { left: 11.07, top: 30.43, width: 15.13, height: 4.58 },
  },
  "pg-credit-limit": {
    permissionName: "Configure Credit Limits",
    moduleName: "Partner Group",
    infoNoteOn:
      "The Credit Limit section is editable in the group rules: set and enforce the maximum credit for the group.",
    infoNoteOff:
      "The Credit Limit section is read-only. This role cannot set group credit limits.",
    path: "Partners Management → Partner Group → Configuration → Vendor Rules → Credit Limit",
    imageOn: "/view-in-module/pg-credit-limit-on.webp",
    imageOff: "/view-in-module/pg-credit-limit-off.webp",
    hotspotOn: { left: 11.07, top: 22.43, width: 15.13, height: 4.58 },
    hotspotOff: { left: 11.07, top: 22.43, width: 15.13, height: 4.58 },
  },
  /* No entry for pg-manage-payment-terms or pg-manage-pricing-rules. Those two
     author the global record rather than touching anything on a group page, so
     there is nothing on the Partner Group screen to point at. Their Partners
     counterparts (prt-manage-payment-terms, prt-manage-pricing-rules) have no
     entry either, for the same reason. */
  "pg-archive": {
    permissionName: "Archive Partner Group",
    moduleName: "Partner Group",
    infoNoteOn:
      "The Archive action is available in the row actions menu: archive a partner group.",
    infoNoteOff:
      "The Archive action is not visible. This role cannot archive partner groups.",
    path: "Partners Management → Partner Groups → Row Actions → Archive",
    imageOn: "/view-in-module/pg-archive-on.webp",
    imageOff: "/view-in-module/pg-archive-off.webp",
    hotspotOn: { left: 86.0, top: 59.77, width: 12.13, height: 4.36 },
    hotspotOff: { left: 86.0, top: 59.77, width: 12.13, height: 4.36 },
  },
  "ct-access": {
    permissionName: "Access Contacts Module",
    moduleName: "Contacts Directory",
    infoNoteOn:
      "The Contacts Directory entry is available in the sidebar: browse contacts across partners and partner groups.",
    infoNoteOff:
      "The Contacts Directory entry is not visible. This role cannot open the contact directory.",
    path: "Partners Management → Contacts Directory",
    imageOn: "/view-in-module/ct-access-on.webp",
    imageOff: "/view-in-module/ct-access-off.webp",
    hotspotOn: { left: 2.13, top: 23.77, width: 15.8, height: 3.86 },
    hotspotOff: { left: 2.13, top: 23.77, width: 15.8, height: 3.86 },
  },
  "ct-create-edit": {
    permissionName: "Create and Edit Contact",
    moduleName: "Contacts Directory",
    infoNoteOn:
      "The Create New Contact button is active: create contacts and edit their details.",
    infoNoteOff:
      "The Create New Contact button is not visible. This role cannot create or edit contacts.",
    path: "Partners Management → Contacts Directory → Create New Contact",
    imageOn: "/view-in-module/ct-create-edit-on.webp",
    imageOff: "/view-in-module/ct-create-edit-off.webp",
    hotspotOn: { left: 86.2, top: 7.04, width: 13.4, height: 4.8 },
    hotspotOff: { left: 86.2, top: 7.04, width: 13.4, height: 4.8 },
  },
  "ct-archive": {
    permissionName: "Archive Contact",
    moduleName: "Contacts Directory",
    infoNoteOn:
      "The Archive action is available in the row actions menu: archive a contact record.",
    infoNoteOff:
      "The Archive action is not visible. This role cannot archive contacts.",
    path: "Partners Management → Contacts Directory → Row Actions → Archive",
    imageOn: "/view-in-module/ct-archive-on.webp",
    imageOff: "/view-in-module/ct-archive-off.webp",
    hotspotOn: { left: 83.07, top: 59.99, width: 14.8, height: 4.36 },
    hotspotOff: { left: 83.07, top: 59.99, width: 14.8, height: 4.36 },
  },
};

Object.assign(VIEW_IN_MODULE_DATA, PM_REAL_SCREENSHOTS);

// ─── Items & Inventory — real screenshots ────────────────────────────────────
const INVENTORY_REAL_SCREENSHOTS: Record<string, ViewInModuleEntry> = {
  "item-access": {
    permissionName: "Access Item Library",
    moduleName: "Item Library",
    infoNoteOn: "The Items Library entry is available in the sidebar: browse the full item catalog.",
    infoNoteOff: "The Items Library entry is not visible. This role cannot open the item catalog.",
    path: "Items & Inventory → Items Library",
    imageOn: "/view-in-module/item-access-on.webp",
    imageOff: "/view-in-module/item-access-off.webp",
    hotspotOn: { left: 2.27, top: 13.33, width: 15.53, height: 3.94 },
    hotspotOff: { left: 2.27, top: 13.33, width: 15.53, height: 3.94 },
  },
  "item-view-cost": {
    permissionName: "View Item Cost",
    moduleName: "Item Library",
    infoNoteOn: "Avg Cost and Total Value KPIs are visible on the item overview.",
    infoNoteOff: "Cost and valuation KPIs are hidden. This role sees quantities only.",
    path: "Items & Inventory → Items Library → Item → Overview → Avg Cost / Total Value",
    imageOn: "/view-in-module/item-view-cost-on.webp",
    imageOff: "/view-in-module/item-view-cost-off.webp",
    hotspotOn: { left: 67.83, top: 23.35, width: 19.85, height: 5.08 },
    hotspotOff: { left: 67.83, top: 23.35, width: 19.85, height: 5.08 },
  },
  "item-create-edit": {
    permissionName: "Create and Edit Item",
    moduleName: "Item Library",
    infoNoteOn: "The Edit action is active on the item record: update item details.",
    infoNoteOff: "The Edit action is not visible. This role can only view item records.",
    path: "Items & Inventory → Items Library → Item → Edit",
    imageOn: "/view-in-module/item-create-edit-on.webp",
    imageOff: "/view-in-module/item-create-edit-off.webp",
    hotspotOn: { left: 91.4, top: 3.09, width: 5.6, height: 4.89 },
    hotspotOff: { left: 91.4, top: 3.09, width: 5.6, height: 4.89 },
  },
  "item-edit-minmax": {
    permissionName: "Edit Min/Max Thresholds",
    moduleName: "Item Library",
    infoNoteOn: "Reorder point and max threshold fields are editable on the Inventory tab.",
    infoNoteOff: "Threshold fields are read-only. This role cannot change replenishment settings.",
    path: "Items & Inventory → Items Library → Item → Inventory → Thresholds",
    imageOn: "/view-in-module/item-edit-minmax-on.webp",
    imageOff: "/view-in-module/item-edit-minmax-off.webp",
    hotspotOn: { left: 22.13, top: 36.19, width: 23.11, height: 15.11 },
    hotspotOff: { left: 22.13, top: 36.19, width: 23.11, height: 15.11 },
  },
  "item-manage-vendors": {
    permissionName: "Manage Vendor Qualification",
    moduleName: "Item Library",
    infoNoteOn: "Add vendor and edit vendor list actions are active on the Purchasing tab.",
    infoNoteOff: "Vendor management actions are not visible. This role can only view qualified vendors.",
    path: "Items & Inventory → Items Library → Item → Purchasing → Qualified Vendors",
    imageOn: "/view-in-module/item-manage-vendors-on.webp",
    imageOff: "/view-in-module/item-manage-vendors-off.webp",
    hotspotOn: { left: 78.87, top: 18.88, width: 18.13, height: 4.44 },
    hotspotOff: { left: 78.87, top: 18.88, width: 18.13, height: 4.44 },
  },
  "item-archive": {
    permissionName: "Deactivate and Archive Item",
    moduleName: "Item Library",
    infoNoteOn: "Mark as Inactive and Archive are available in the item Actions menu.",
    infoNoteOff: "Lifecycle actions are not visible. This role cannot deactivate or archive items.",
    path: "Items & Inventory → Items Library → Item → Actions → Archive",
    imageOn: "/view-in-module/item-archive-on.webp",
    imageOff: "/view-in-module/item-archive-off.webp",
    hotspotOn: { left: 78.4, top: 11.67, width: 12.67, height: 8.0 },
    hotspotOff: { left: 78.4, top: 11.67, width: 12.67, height: 8.0 },
  },
  "item-manage-pricing": {
    permissionName: "Manage Item Pricing",
    moduleName: "Item Library",
    infoNoteOn: "The Selling configuration section is available: manage selling scope, partners and pricing.",
    infoNoteOff: "The Selling configuration section is read-only. This role cannot change item pricing.",
    path: "Items & Inventory → Items Library → Item → Configurations → Selling",
    imageOn: "/view-in-module/item-manage-pricing-on.webp",
    imageOff: "/view-in-module/item-manage-pricing-off.webp",
    hotspotOn: { left: 20.87, top: 48.63, width: 15.53, height: 8.39 },
    hotspotOff: { left: 20.87, top: 48.63, width: 15.53, height: 8.39 },
  },
  "cat-access": {
    permissionName: "Access Categories",
    moduleName: "Item Categories",
    infoNoteOn: "Primary and additional category columns are visible in the item library.",
    infoNoteOff: "Category columns are hidden. This role cannot see item categorization.",
    path: "Items & Inventory → Items Library → Category Columns",
    imageOn: "/view-in-module/cat-access-on.webp",
    imageOff: "/view-in-module/cat-access-off.webp",
    hotspotOn: { left: 82.47, top: 38.36, width: 26.4, height: 3.11 },
    hotspotOff: { left: 82.47, top: 38.36, width: 26.4, height: 3.11 },
  },
  "cc-access": {
    permissionName: "Access Cycle Count",
    moduleName: "Cycle Count",
    infoNoteOn: "The Cycle Count entry is available in the sidebar: view planned and completed counts.",
    infoNoteOff: "The Cycle Count entry is not visible. This role cannot open cycle counts.",
    path: "Items & Inventory → Cycle Count",
    imageOn: "/view-in-module/cc-access-on.webp",
    imageOff: "/view-in-module/cc-access-off.webp",
    hotspotOn: { left: 2.27, top: 13.33, width: 15.53, height: 3.94 },
    hotspotOff: { left: 2.27, top: 13.33, width: 15.53, height: 3.94 },
  },
  "cc-create-plan": {
    permissionName: "Plan Cycle Count",
    moduleName: "Cycle Count",
    infoNoteOn: "The Plan Cycle Count button is active: schedule new counts by item, location or category.",
    infoNoteOff: "The Plan Cycle Count button is not visible. This role cannot schedule counts.",
    path: "Items & Inventory → Cycle Count → Plan Cycle Count",
    imageOn: "/view-in-module/cc-create-plan-on.webp",
    imageOff: "/view-in-module/cc-create-plan-off.webp",
    hotspotOn: { left: 87.73, top: 7.0, width: 11.73, height: 4.89 },
    hotspotOff: { left: 87.73, top: 7.0, width: 11.73, height: 4.89 },
  },
  "cc-execute": {
    permissionName: "Execute Cycle Count",
    moduleName: "Cycle Count",
    infoNoteOn: "Counted quantity entry and Confirm Count are active in the count execution screen.",
    infoNoteOff: "Count entry is disabled. This role can follow progress but cannot record counts.",
    path: "Items & Inventory → Cycle Count → Count → Execute",
    imageOn: "/view-in-module/cc-execute-on.webp",
    imageOff: "/view-in-module/cc-execute-off.webp",
    hotspotOn: { left: 43.73, top: 57.44, width: 36.2, height: 15.67 },
    hotspotOff: { left: 43.73, top: 57.44, width: 36.2, height: 15.67 },
  },
  "cc-adjust": {
    permissionName: "Approve Count Adjustments",
    moduleName: "Cycle Count",
    infoNoteOn: "Approve, Reject and Request Recount are active in discrepancy review.",
    infoNoteOff: "Discrepancy decisions are not visible. This role cannot approve adjustments.",
    path: "Items & Inventory → Cycle Count → Count → Discrepancy Review",
    imageOn: "/view-in-module/cc-adjust-on.webp",
    imageOff: "/view-in-module/cc-adjust-off.webp",
    hotspotOn: { left: 59.4, top: 25.06, width: 23.73, height: 4.44 },
    hotspotOff: { left: 59.4, top: 25.06, width: 23.73, height: 4.44 },
  },
  "uom-access": {
    permissionName: "Access Unit of Measure",
    moduleName: "Unit of Measure",
    infoNoteOn: "The Unit of Measure entry is available in the sidebar: browse standard and custom units.",
    infoNoteOff: "The Unit of Measure entry is not visible. This role cannot open the unit library.",
    path: "Company Setup → Unit of Measure",
    imageOn: "/view-in-module/uom-access-on.webp",
    imageOff: "/view-in-module/uom-access-off.webp",
    hotspotOn: { left: 2.27, top: 13.33, width: 15.53, height: 3.94 },
    hotspotOff: { left: 2.27, top: 13.33, width: 15.53, height: 3.94 },
  },
  "uom-manage": {
    permissionName: "Manage Units of Measure",
    moduleName: "Unit of Measure",
    infoNoteOn: "Create New Unit and Import are active: add and maintain custom units.",
    infoNoteOff: "Unit management actions are not visible. This role can only view units.",
    path: "Company Setup → Unit of Measure → Create New Unit",
    imageOn: "/view-in-module/uom-manage-on.webp",
    imageOff: "/view-in-module/uom-manage-off.webp",
    hotspotOn: { left: 78.87, top: 7.0, width: 18.6, height: 4.89 },
    hotspotOff: { left: 78.87, top: 7.0, width: 18.6, height: 4.89 },
  },
  "pi-access": {
    permissionName: "Access Physical Inventory",
    moduleName: "Physical Inventory",
    infoNoteOn: "The Physical Inventory entry is available in the sidebar: view on-hand stock by item.",
    infoNoteOff: "The Physical Inventory entry is not visible. This role cannot open physical inventory.",
    path: "Items & Inventory → Physical Inventory",
    imageOn: "/view-in-module/pi-access-on.webp",
    imageOff: "/view-in-module/pi-access-off.webp",
    hotspotOn: { left: 2.27, top: 13.33, width: 15.53, height: 3.94 },
    hotspotOff: { left: 2.27, top: 13.33, width: 15.53, height: 3.94 },
  },
  "pi-adjust": {
    permissionName: "Adjust Inventory",
    moduleName: "Physical Inventory",
    infoNoteOn: "The Adjust Inventory action is active on the item stock record.",
    infoNoteOff: "The Adjust Inventory action is not visible. This role cannot change on-hand quantities.",
    path: "Items & Inventory → Physical Inventory → Item → Adjust Inventory",
    imageOn: "/view-in-module/pi-adjust-on.webp",
    imageOff: "/view-in-module/pi-adjust-off.webp",
    hotspotOn: { left: 84.47, top: 9.11, width: 11.33, height: 5.0 },
    hotspotOff: { left: 84.47, top: 9.11, width: 11.33, height: 5.0 },
  },
  "pi-quarantine": {
    permissionName: "Manage Quarantined Stock",
    moduleName: "Physical Inventory",
    infoNoteOn: "The Quarantined Units breakdown is visible and actionable on the stock record.",
    infoNoteOff: "The quarantine breakdown is hidden. This role cannot manage quarantined units.",
    path: "Items & Inventory → Physical Inventory → Item → Quarantined Units",
    imageOn: "/view-in-module/pi-quarantine-on.webp",
    imageOff: "/view-in-module/pi-quarantine-off.webp",
    hotspotOn: { left: 68.16, top: 54.72, width: 28.18, height: 43.78 },
    hotspotOff: { left: 68.16, top: 54.72, width: 28.18, height: 43.78 },
  },
  "mv-access": {
    permissionName: "Access Inventory Movement",
    moduleName: "Inventory Movement",
    infoNoteOn: "The Inventory Movement entry is available in the sidebar: track transfers and replenishments.",
    infoNoteOff: "The Inventory Movement entry is not visible. This role cannot open movements.",
    path: "Items & Inventory → Inventory Movement",
    imageOn: "/view-in-module/mv-access-on.webp",
    imageOff: "/view-in-module/mv-access-off.webp",
    hotspotOn: { left: 2.33, top: 13.33, width: 15.47, height: 3.94 },
    hotspotOff: { left: 2.33, top: 13.33, width: 15.47, height: 3.94 },
  },
  "mv-create": {
    permissionName: "Create Movement",
    moduleName: "Inventory Movement",
    infoNoteOn: "The Create Movement button is active: plan or log a new stock movement.",
    infoNoteOff: "The Create Movement button is not visible. This role can only view movements.",
    path: "Items & Inventory → Inventory Movement → Create Movement",
    imageOn: "/view-in-module/mv-create-on.webp",
    imageOff: "/view-in-module/mv-create-off.webp",
    hotspotOn: { left: 87.2, top: 7.0, width: 12.27, height: 4.89 },
    hotspotOff: { left: 87.2, top: 7.0, width: 12.27, height: 4.89 },
  },
  "mv-execute": {
    permissionName: "Execute Movement",
    moduleName: "Inventory Movement",
    infoNoteOn: "Log Movement and Mark as Completed are active on the movement record.",
    infoNoteOff: "Execution actions are not visible. This role cannot log or complete movements.",
    path: "Items & Inventory → Inventory Movement → Movement → Log Movement",
    imageOn: "/view-in-module/mv-execute-on.webp",
    imageOff: "/view-in-module/mv-execute-off.webp",
    hotspotOn: { left: 67.33, top: 9.11, width: 26.47, height: 25.85 },
    hotspotOff: { left: 67.33, top: 9.11, width: 26.47, height: 25.85 },
  },
  "wl-access": {
    permissionName: "Access Warehouse and Locations",
    moduleName: "Warehouse & Locations",
    infoNoteOn: "Warehouses Management and Locations Management entries are available in Company Setup.",
    infoNoteOff: "Warehouse and location entries are not visible. This role cannot open them.",
    path: "Company Setup → Warehouses Management / Locations Management",
    imageOn: "/view-in-module/wl-access-on.webp",
    imageOff: "/view-in-module/wl-access-off.webp",
    hotspotOn: { left: 2.27, top: 51.22, width: 15.53, height: 7.11 },
    hotspotOff: { left: 2.27, top: 51.22, width: 15.53, height: 7.11 },
  },
  "wl-manage-warehouses": {
    permissionName: "Manage Warehouses",
    moduleName: "Warehouse & Locations",
    infoNoteOn: "The Create action is active on the warehouse listing: add and edit warehouses.",
    infoNoteOff: "The Create action is not visible. This role can only view warehouses.",
    path: "Company Setup → Warehouses Management → Create",
    imageOn: "/view-in-module/wl-manage-warehouses-on.webp",
    imageOff: "/view-in-module/wl-manage-warehouses-off.webp",
    hotspotOn: { left: 91.4, top: 7.06, width: 6.73, height: 4.89 },
    hotspotOff: { left: 91.4, top: 7.06, width: 6.73, height: 4.89 },
  },
  "wl-create-edit": {
    permissionName: "Create and Edit Locations",
    moduleName: "Warehouse & Locations",
    infoNoteOn: "The Create New Location button is active: add and edit storage locations.",
    infoNoteOff: "The Create New Location button is not visible. This role can only view locations.",
    path: "Company Setup → Locations Management → Create New Location",
    imageOn: "/view-in-module/wl-create-edit-on.webp",
    imageOff: "/view-in-module/wl-create-edit-off.webp",
    hotspotOn: { left: 86.0, top: 6.83, width: 12.13, height: 4.89 },
    hotspotOff: { left: 86.0, top: 6.83, width: 12.13, height: 4.89 },
  },
};

Object.assign(VIEW_IN_MODULE_DATA, INVENTORY_REAL_SCREENSHOTS);
