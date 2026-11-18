/* Quotes import contract.
 *
 * Column list, order and requirement marks mirror QUOTES_Template.xlsx as the
 * Quotes module ships it, so a file prepared for that module imports here
 * without reformatting. The states, priorities and catalogs are the module's
 * own vocabulary: a legacy word outside it either maps (a warning) or is
 * refused with the real values listed (an error). */

import type { SheetImportSpec } from "../sheet-import/sheetSpec";
import {
  CUSTOMERS as MODULE_CUSTOMERS,
  ITEM_CODES,
  UOM_CODES,
  PRICING_RULES as MODULE_PRICING_RULES,
  USER_EMAILS,
  PAYMENT_TERMS as MODULE_PAYMENT_TERMS,
  PAYMENT_METHODS as MODULE_PAYMENT_METHODS,
  LOCATIONS as MODULE_LOCATIONS,
  CONTACTS as MODULE_CONTACTS,
} from "../sheet-import/cells/importCatalog";


/* Verbatim from the Quotes module's StatusBadge (QUOTE_STATUS_DISPLAY): these
   are the labels the listing pills and the detail badge show, so they are the
   only statuses this import accepts. */
const QUOTE_STATES = [
  "Draft",
  "Sent to Customer",
  "Confirmed by Customer",
  "Converted to SO",
  "Expired",
  "Rejected",
  "Cancelled",
  "Archived",
] as const;

const PRIORITIES = ["Low", "Standard", "High"] as const;

/* Catalogs stand in for the records the Quotes module reads at import time.
   Keeping them here, beside the columns they validate, is what lets the
   validator explain a bad cell with the real values rather than a generic
   "not found". */
const CUSTOMERS = [
  "Metro City Fire & Rescue",
  "Tri-County EMS Authority",
  "Lakewood Community Hospital",
  "Pinecrest Volunteer Fire Dept",
  "Summit Regional Medical Center",
  "Eagle County Sheriff's Office",
  "Riverside Utility District",
  "Heartland Air Ambulance",
] as const;

const LOCATIONS = [
  "Main Campus",
  "North Station",
  "South Station",
  "Central Warehouse",
  "Fleet Depot",
  "Receiving Dock",
] as const;

const CONTACTS = [
  "James Mitchell",
  "Robert Chen",
  "Susan Brennan",
  "Tom Parker",
  "Mary Garcia",
  "Anna Kim",
  "William Ellison",
  "Robert Johnson",
] as const;

const USERS = [
  "yahya.naveed@omnesoft.com",
  "sarah.johnson@omnesoft.com",
  "alex.chen@omnesoft.com",
  "rachel.adams@omnesoft.com",
  "amara.okafor@omnesoft.com",
] as const;

const PAYMENT_TERMS = ["Net 15", "Net 30", "Net 45", "Net 60", "Due on Receipt", "2/10 Net 30"] as const;
const PAYMENT_METHODS = ["ACH/Direct Deposit", "Wire Transfer", "Company Check", "Credit Card", "Purchase Order"] as const;
const ITEMS = [
  "000-100-001",
  "000-100-002",
  "000-100-003",
  "000-100-004",
  "000-100-026",
  "000-100-041",
  "000-100-049",
  "000-100-059",
] as const;
const UOMS = ["EA", "BX", "CS", "PL", "FT", "LB"] as const;
const PRICING_RULES = ["Standard Pricing", "Government Contract", "Volume Tier 1", "Volume Tier 2", "Fleet Agreement"] as const;

export const QUOTES_SPEC: SheetImportSpec = {
  slug: "quotes",
  recordLabel: "Quote",
  recordLabelPlural: "Quotes",
  keyColumn: "quoteNo",
  statusColumn: "quoteStatus",
  templateDir: "quotes",
  templateXlsx: "OMNE_Quotes_Import_Template.xlsx",
  templateCsv: "OMNE_Quotes_Import_Template.csv",
  guideFile: "OMNE_Quotes_Import_Guide.txt",
  guideTitle: "Quotes Import Guide",
  previewFieldsText: "quote number, customer, status, line items, pricing",
  remainingFields: [
    "Currency Code",
    "Requested On",
    "Respond By",
    "Expiration Date",
    "Delivery Location",
    "Payment Terms",
    "Payment Method",
    "Sales Rep",
    "Secondary Sales Reps",
    "Primary Contact",
    "Secondary Contacts",
    "Priority",
    "Tags",
    "Lead Source",
    "RFQ/RFP ID",
    "Win Probability",
    "Expected Close Date",
    "Competitive Situation",
    "Quote-Level Discount/Premium",
    "External Notes",
    "Internal Notes",
    "External Links",
    "Line / Pricing Rule",
    "Line / Discount/Premium",
    "Line / Expected Ship By",
    "Line / Expected Delivery Date",
    "Line / Freight Carrier/Method",
    "Line / Description",
    "Line / Notes",
  ],
  catalogs: {
    customer: MODULE_CUSTOMERS,
    location: MODULE_LOCATIONS,
    contact: MODULE_CONTACTS,
    user: USER_EMAILS,
    paymentTerm: MODULE_PAYMENT_TERMS,
    paymentMethod: MODULE_PAYMENT_METHODS,
    item: ITEM_CODES,
    uom: UOM_CODES,
    pricingRule: MODULE_PRICING_RULES,
  },
  catalogModules: {
    customer: "Partners Management",
    location: "Company Setup, Location Management",
    contact: "Partners Management, Contact Directory",
    user: "Company Setup, User Access Control",
    paymentTerm: "Partners Management, Payment Terms",
    paymentMethod: "Partners Management, Payment Methods",
    item: "Items & Inventory, Item Library",
    uom: "Company Setup, Units of Measure",
    pricingRule: "Partners Management, Pricing Rules",
  },
  aliases: {
    /* Legacy status and priority words this import can place. */
    open: "Draft",
    sent: "Sent to Customer",
    accepted: "Confirmed by Customer",
    "converted": "Converted to SO",
    won: "Confirmed by Customer",
    lost: "Rejected",
    declined: "Rejected",
    void: "Cancelled",
    medium: "Standard",
    normal: "Standard",
    urgent: "High",
    critical: "High",
    /* Unit and payment words a legacy system tends to spell differently. */
    each: "EA",
    box: "BX",
    case: "CS",
    pallet: "PL",
    "net-30": "Net 30",
    net30: "Net 30",
    ach: "ACH/Direct Deposit",
    check: "Company Check",
  },
  columns: [
    { key: "quoteNo", label: "Quote No", level: "record", requirement: "required" },
    { key: "customerName", label: "Customer Name", level: "record", requirement: "required", catalog: "customer", width: 210 },
    { key: "quoteStatus", label: "Quote Status", level: "record", requirement: "required", set: QUOTE_STATES },
    { key: "currencyCode", label: "Currency Code", level: "record", requirement: "conditional", conditionalNote: "Required only when your company trades in more than one currency." },
    { key: "requestedOn", label: "Requested On", level: "record", requirement: "optional", kind: "date" },
    { key: "respondBy", label: "Respond By", level: "record", requirement: "optional", kind: "date" },
    { key: "expirationDate", label: "Expiration Date", level: "record", requirement: "conditional", conditionalNote: "Required on Sent to Customer and Confirmed by Customer.", kind: "date" },
    { key: "deliveryLocation", label: "Delivery Location", level: "record", requirement: "optional", catalog: "location", width: 230 },
    { key: "paymentTerms", label: "Payment Terms", level: "record", requirement: "optional", catalog: "paymentTerm" },
    { key: "paymentMethod", label: "Payment Method", level: "record", requirement: "optional", catalog: "paymentMethod", width: 180 },
    { key: "salesRep", label: "Sales Rep", level: "record", requirement: "optional", catalog: "user", width: 210 },
    { key: "secondarySalesReps", label: "Secondary Sales Reps", level: "record", requirement: "optional", catalog: "user", list: true, width: 230 },
    { key: "primaryContact", label: "Primary Contact", level: "record", requirement: "optional", catalog: "contact" },
    { key: "secondaryContacts", label: "Secondary Contacts", level: "record", requirement: "optional", catalog: "contact", list: true, width: 230 },
    { key: "priority", label: "Priority", level: "record", requirement: "optional", set: PRIORITIES },
    { key: "tags", label: "Tags", level: "record", requirement: "optional", list: true },
    { key: "leadSource", label: "Lead Source", level: "record", requirement: "optional" },
    { key: "rFQRFPID", label: "RFQ/RFP ID", level: "record", requirement: "optional" },
    { key: "winProbability", label: "Win Probability", level: "record", requirement: "optional", kind: "number" },
    { key: "expectedCloseDate", label: "Expected Close Date", level: "record", requirement: "optional", kind: "date" },
    { key: "competitiveSituation", label: "Competitive Situation", level: "record", requirement: "optional", set: ["None", "Competitive", "Sole Source", "Incumbent"] },
    { key: "quoteLevelDiscountPremium", label: "Quote-Level Discount/Premium", level: "record", requirement: "optional", list: true, width: 210 },
    { key: "externalNotes", label: "External Notes", level: "record", requirement: "optional", width: 260 },
    { key: "internalNotes", label: "Internal Notes", level: "record", requirement: "optional", width: 260 },
    { key: "externalLinks", label: "External Links", level: "record", requirement: "optional", list: true },
    { key: "lineType", label: "Line / Type", level: "line", requirement: "required", set: ["Item"] },
    { key: "lineItem", label: "Line / Item", level: "line", requirement: "required", catalog: "item" },
    { key: "lineUnitOfMeasure", label: "Line / Unit of Measure", level: "line", requirement: "required", catalog: "uom" },
    { key: "lineQuantity", label: "Line / Quantity", level: "line", requirement: "required", kind: "number" },
    { key: "linePricePerUnit", label: "Line / Price Per Unit", level: "line", requirement: "conditional", conditionalNote: "Blank takes the customer price list. Blank with no price-list entry drops the line.", kind: "number" },
    { key: "linePricingRule", label: "Line / Pricing Rule", level: "line", requirement: "optional", catalog: "pricingRule", list: true, width: 220 },
    { key: "lineDiscountPremium", label: "Line / Discount/Premium", level: "line", requirement: "optional", list: true, width: 210 },
    { key: "lineExpectedShipBy", label: "Line / Expected Ship By", level: "line", requirement: "optional", kind: "date" },
    { key: "lineExpectedDeliveryDate", label: "Line / Expected Delivery Date", level: "line", requirement: "optional", kind: "date" },
    { key: "lineFreightCarrierMethod", label: "Line / Freight Carrier/Method", level: "line", requirement: "optional", width: 220 },
    { key: "lineDescription", label: "Line / Description", level: "line", requirement: "optional", width: 260 },
    { key: "lineNotes", label: "Line / Notes", level: "line", requirement: "optional", width: 220 },
  ],
};

/** Quote numbers the module already holds. A file re-using one of these is
 *  caught in review rather than silently creating a second record. */
export const EXISTING_QUOTE_NUMBERS = [
  "Q-000-100-001",
  "Q-000-102-007",
  "Q-000-103-010",
  "Q-000-105-016",
] as const;
