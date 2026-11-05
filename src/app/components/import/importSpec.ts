import { SO_STATUS_DISPLAY } from "@/app/components/so/StatusBadge";
import { SO_PRIORITIES } from "@/app/components/so/types";

/* The states and priorities this import accepts are the module's own, not a
   vocabulary invented for the template: the status column offers exactly the
   labels the listing's pills and the detail badge show (so "Released" rather
   than the internal "Cleared"), and the priority column offers the three the
   record can actually hold. A legacy file using another word fails validation
   with a dropdown of the real ones. */
const ORDER_STATES = Object.values(SO_STATUS_DISPLAY);

/**
 * Column contract for the Sales Orders legacy import.
 *
 * Mirrors `SO_Template.xlsx` exactly: same 38 columns in the same
 * order, same required (*) and conditional (†) marks, same level split.
 * Nothing here may drift from the workbook the customer is handed, so
 * treat the workbook as the source of truth and this file as its mirror.
 */

import type { ColumnSpec, EntityKind, EntityMeta } from "./importModel";

export const RECORD_NOUN = "order";
export const RECORD_NOUN_PLURAL = "orders";
export const RECORD_LABEL = "Sales Order";
/** Column holding the legacy reference that groups the rows. */
export const KEY_COLUMN = "soNumber";
/** Column holding the record's status. */
export const STATUS_COLUMN = "orderStatus";

export const COLUMNS: ColumnSpec[] = [
  { key: "soNumber", label: "SO Number", level: "record", requirement: "required" },
  { key: "sourceQuoteNo", label: "Source Quote No", level: "record", requirement: "optional", entity: "sourceQuote" },
  { key: "customerName", label: "Customer Name", level: "record", requirement: "required", entity: "customer", width: 210 },
  { key: "orderStatus", label: "Order Status", level: "record", requirement: "required", set: ORDER_STATES },
  { key: "currencyCode", label: "Currency Code", level: "record", requirement: "conditional", conditionalNote: "Required only when your company trades in more than one currency." },
  { key: "requestedOn", label: "Requested On", level: "record", requirement: "optional", kind: "date" },
  { key: "confirmationDate", label: "Confirmation Date", level: "record", requirement: "optional", kind: "date" },
  { key: "shipBy", label: "Ship By", level: "record", requirement: "conditional", conditionalNote: "Required on Released and Shipped.", kind: "date" },
  { key: "deliveryDate", label: "Delivery Date", level: "record", requirement: "optional", kind: "date" },
  { key: "deliveryLocation", label: "Delivery Location", level: "record", requirement: "optional", entity: "location", width: 230 },
  { key: "paymentTerms", label: "Payment Terms", level: "record", requirement: "optional", entity: "paymentTerm" },
  { key: "paymentMethod", label: "Payment Method", level: "record", requirement: "optional", entity: "paymentMethod" },
  { key: "salesRep", label: "Sales Rep", level: "record", requirement: "optional", entity: "user" },
  { key: "secondarySalesReps", label: "Secondary Sales Reps", level: "record", requirement: "optional", entity: "user", list: true },
  { key: "primaryContact", label: "Primary Contact", level: "record", requirement: "optional", entity: "contact" },
  { key: "secondaryContacts", label: "Secondary Contacts", level: "record", requirement: "optional", entity: "contact", list: true, width: 230 },
  { key: "priority", label: "Priority", level: "record", requirement: "optional", set: SO_PRIORITIES },
  { key: "tags", label: "Tags", level: "record", requirement: "optional", list: true },
  { key: "leadSource", label: "Lead Source", level: "record", requirement: "optional" },
  { key: "rFQRFPID", label: "RFQ/RFP ID", level: "record", requirement: "optional" },
  { key: "competitiveSituation", label: "Competitive Situation", level: "record", requirement: "optional", set: ["None", "Competitive", "Sole Source", "Incumbent"] },
  { key: "orderLevelDiscountPremium", label: "Order-Level Discount/Premium", level: "record", requirement: "optional", list: true, width: 210 },
  { key: "externalNotes", label: "External Notes", level: "record", requirement: "optional", width: 260 },
  { key: "internalNotes", label: "Internal Notes", level: "record", requirement: "optional", width: 260 },
  { key: "externalLinks", label: "External Links", level: "record", requirement: "optional", list: true },
  /* Line / Type came over from the Purchase Order template, where a line can
     be an item or a service. Every line here is an item, so the column was a
     required field with one legal value. Dropped. */
  { key: "lineItem", label: "Line / Item", level: "line", requirement: "required", entity: "item" },
  { key: "lineUnitOfMeasure", label: "Line / Unit of Measure", level: "line", requirement: "required", entity: "uom" },
  { key: "lineQuantity", label: "Line / Quantity", level: "line", requirement: "required", kind: "number" },
  { key: "linePricePerUnit", label: "Line / Price Per Unit", level: "line", requirement: "conditional", conditionalNote: "Blank takes the customer price list. Blank with no price-list entry drops the line.", kind: "number" },
  { key: "linePricingRule", label: "Line / Pricing Rule", level: "line", requirement: "optional", entity: "pricingRule", list: true, width: 220 },
  { key: "lineDiscountPremium", label: "Line / Discount/Premium", level: "line", requirement: "optional", list: true, width: 210 },
  { key: "lineExpectedShipBy", label: "Line / Expected Ship By", level: "line", requirement: "optional", kind: "date" },
  { key: "lineExpectedDeliveryDate", label: "Line / Expected Delivery Date", level: "line", requirement: "optional", kind: "date" },
  { key: "lineFreightCarrierMethod", label: "Line / Freight Carrier/Method", level: "line", requirement: "optional", width: 220 },
  /* Line / Sequence was carried over from the Purchase Order template. Line
     order here is the order of the rows in the file, so a sequence column was
     a second source of truth for the same thing. Dropped. */
  { key: "lineDescription", label: "Line / Description", level: "line", requirement: "optional", width: 260 },
  { key: "lineNotes", label: "Line / Notes", level: "line", requirement: "optional", width: 220 },
];

export const RECORD_COLUMNS = COLUMNS.filter((c) => c.level === "record");
export const LINE_COLUMNS = COLUMNS.filter((c) => c.level === "line");
export const COLUMN_BY_KEY: Record<string, ColumnSpec> = Object.fromEntries(
  COLUMNS.map((c) => [c.key, c]),
);

/** Where each dependency is created, for the "create it there" touchpoint. */
export const ENTITY_META: Record<EntityKind, EntityMeta> = {
  customer:      { kind: "customer",      noun: "customer",        module: "Partners",       createHref: "/partners/new" },
  item:          { kind: "item",          noun: "item",            module: "Items",          createHref: "/items/new" },
  uom:           { kind: "uom",           noun: "unit of measure", module: "Company Setup",  createHref: "/company-setup/units" },
  pricingRule:   { kind: "pricingRule",   noun: "pricing rule",    module: "Partners",       createHref: "/partners/pricing-rules/new" },
  user:          { kind: "user",          noun: "user",            module: "User Access Control", createHref: "/user-access-control/users/new" },
  /* Warehouses are the one dependency most sales roles cannot create: the
     module is owned by operations. The card says so rather than sending
     someone to a screen that will refuse them. */
  location:      { kind: "location",      noun: "warehouse",       module: "Warehouses",     createHref: "/company-setup/warehouses", canCreate: false },
  paymentTerm:   { kind: "paymentTerm",   noun: "payment term",    module: "Partners",       createHref: "/partners/payment-terms/new" },
  paymentMethod: { kind: "paymentMethod", noun: "payment method",  module: "Partners",       createHref: "/partners/payment-methods/new" },
  contact:       { kind: "contact",       noun: "contact",         module: "Partners",       createHref: "/partners/contacts/new" },
  sourceQuote:   { kind: "sourceQuote",   noun: "quote",           module: "Quotes",         createHref: "/quotes" },
};
