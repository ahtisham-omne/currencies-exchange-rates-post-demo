/* Sample rows behind the seeded Sales Orders imports: two that imported in full
 * and the June update, a partial import whose failed records together exercise
 * every rule the sheet validator (sheet-import/sheetValidation.ts) applies to
 * Sales Orders, so the record page shows each kind of problem an admin can meet.
 *
 * Values are checked against the live catalogs the spec validates with
 * (sheet-import/cells/importCatalog.ts), so the clean records carry no issue.
 *
 * June coverage, record -> rule (R = record column, L = line column):
 *   SO-000-190-001  clean, imported
 *   SO-000-190-002  imported with warnings: status alias (cleared), priority alias
 *                   (medium), blank conditional Currency Code and Ship By, payment
 *                   term alias (net30), line unit alias (each), blank
 *                   conditional line price
 *   SO-000-190-003  clean, imported (two lines)
 *   SO-000-190-004  R required: Customer Name blank
 *   SO-000-190-005  R dropdown: Order Status "On Hold" not a status
 *   SO-000-190-006  R catalog: customer "Fairview Ambulance Service" not in Partners
 *   SO-000-190-007  R catalog: Source Quote No "Q-000-199-999" not a quote
 *   SO-000-190-008  R date: Confirmation Date "June 21, 2026" not MM/DD/YYYY
 *   SO-000-190-009  R catalog: Sales Rep not a user
 *   SO-000-190-010  R catalog list: one Secondary Sales Rep not a user
 *   SO-000-190-011  R catalog: Delivery Location "Tri-County EMS Authority > Denver
 *                   Service Center", a site that customer does not have
 *   SO-000-190-012  R catalog: Primary Contact not a contact
 *   SO-000-190-013  R catalog list: one Secondary Contact not a contact
 *   SO-000-190-014  R dropdown: Priority "Rush"
 *   SO-000-190-015  R dropdown: Competitive Situation "Open Bid"
 *   SO-000-190-016  R catalog: Payment Terms "Net 90"
 *   SO-000-190-017  R catalog: Payment Method "Money Order"
 *   SO-000-190-018  L catalog: second line's item 000-999-111 not in Item Library
 *   SO-000-190-019  L catalog: unit "Drum" not a unit of measure
 *   SO-000-190-020  L number: quantity "two"
 *   SO-000-190-021  L number: quantity "-3" negative
 *   SO-000-190-022  L number: price "$1,2O0" (letter O)
 *   SO-000-190-023  L dropdown: line type "Service"
 *   SO-000-190-024  L required: quantity blank
 *   SO-000-190-025  L catalog list: pricing rule "Loyalty Discount"
 *   SO-000-190-026  L date: Expected Delivery Date "2026/08/04"
 *   SO-000-000-042  R existing key: the number is already in Sales Orders
 *   SO-000-190-001  (second time) R duplicate key, first on row 1
 * Sales Orders has no record-level number column, so the record-level number
 * rules have nothing to attach to. */

import type { MockRecordSeed } from "../sheet-import/sheetMockSeed";
import { buildSheetMockSeed } from "../sheet-import/sheetMockSeed";
import { SALES_ORDERS_SPEC, EXISTING_SO_NUMBERS } from "./salesOrdersSpec";

/* Delivery Location reads `Customer > Location` for a customer's own site, or
   a warehouse name on its own; both shapes are in the location catalog. */
const WAREHOUSE = "Columbus Conversion Plant";

/* One clean line and one clean record the failure cases vary from. */
const LINE = { lineType: "Item", lineItem: "000-100-026", lineUnitOfMeasure: "Box", lineQuantity: "4", linePricePerUnit: "3250" };

function base(soNumber: string): Record<string, string> {
  return {
    soNumber,
    sourceQuoteNo: "Q-000-102-007",
    customerName: "Tri-County EMS Authority",
    orderStatus: "Released",
    currencyCode: "USD",
    requestedOn: "06/18/2026",
    confirmationDate: "06/19/2026",
    shipBy: "07/18/2026",
    deliveryDate: "07/22/2026",
    deliveryLocation: "Tri-County EMS Authority > Dispatch Center",
    paymentTerms: "Net 30",
    paymentMethod: "ACH/Direct Deposit",
    salesRep: "sarah.chen@omnesoft.com",
    primaryContact: "Robert Chen",
    priority: "Standard",
  };
}

function failing(soNumber: string, record: Record<string, string>, lines = [LINE]): MockRecordSeed {
  return { record: { ...base(soNumber), ...record }, lines };
}

const JULY: MockRecordSeed[] = [
  {
    record: {
      soNumber: "SO-000-200-001",
      customerName: "Metro City Fire & Rescue",
      orderStatus: "Released",
      currencyCode: "USD",
      requestedOn: "07/02/2026",
      shipBy: "08/01/2026",
      deliveryLocation: "Metro City Fire & Rescue > Station 1 HQ",
      sourceQuoteNo: "Q-000-100-001",
      paymentTerms: "Net 30",
      paymentMethod: "ACH/Direct Deposit",
      salesRep: "sarah.chen@omnesoft.com",
      primaryContact: "James Mitchell",
      priority: "Standard",
      tags: "Engine Components|Hydraulics",
      leadSource: "Trade show",
    },
    lines: [
      { lineType: "Item", lineItem: "000-100-001", lineUnitOfMeasure: "EA", lineQuantity: "4", linePricePerUnit: "42500", linePricingRule: "Government Contract Pricing" },
      { lineType: "Item", lineItem: "000-100-002", lineUnitOfMeasure: "EA", lineQuantity: "2", linePricePerUnit: "48200" },
    ],
  },
  {
    record: {
      soNumber: "SO-000-200-002",
      customerName: "Tri-County EMS Authority",
      orderStatus: "Draft",
      currencyCode: "USD",
      requestedOn: "07/08/2026",
      shipBy: "08/08/2026",
      paymentTerms: "Net 45",
      salesRep: "marcus.taylor@omnesoft.com",
      primaryContact: "Jennifer Anderson",
      priority: "High",
    },
    lines: [
      { lineType: "Item", lineItem: "000-100-003", lineUnitOfMeasure: "EA", lineQuantity: "6", linePricePerUnit: "39800" },
    ],
  },
];

const PARTIAL: MockRecordSeed[] = [
  {
    record: {
      ...base("SO-000-190-001"),
      customerName: "Metro City Fire & Rescue",
      sourceQuoteNo: "Q-000-100-001",
      deliveryLocation: "Metro City Fire & Rescue > Central Maintenance Depot",
      primaryContact: "James Mitchell",
      secondaryContacts: "fleet@metrocityfire.gov|billing@metrocityfire.gov",
      secondarySalesReps: "emily.rios@omnesoft.com",
      competitiveSituation: "Competitive",
    },
    lines: [
      { lineType: "Item", lineItem: "000-100-001", lineUnitOfMeasure: "EA", lineQuantity: "2", linePricePerUnit: "42500", linePricingRule: "Government Contract Pricing", lineExpectedShipBy: "07/20/2026" },
    ],
  },
  {
    /* Imports, with every warning the validator can raise on this module. */
    record: {
      ...base("SO-000-190-002"),
      customerName: "Lakewood Community Hospital",
      deliveryLocation: "Lakewood Community Hospital > Receiving Dock",
      orderStatus: "cleared",
      currencyCode: "",
      shipBy: "",
      paymentTerms: "net30",
      primaryContact: "Laura Whitfield",
      priority: "medium",
    },
    lines: [
      { lineType: "Item", lineItem: "000-100-041", lineUnitOfMeasure: "each", lineQuantity: "3", linePricePerUnit: "" },
    ],
  },
  {
    record: { ...base("SO-000-190-003"), priority: "Low" },
    lines: [
      { lineType: "Item", lineItem: "000-100-049", lineUnitOfMeasure: "EA", lineQuantity: "2", linePricePerUnit: "7850" },
      { lineType: "Item", lineItem: "000-100-059", lineUnitOfMeasure: "EA", lineQuantity: "1", linePricePerUnit: "18500", linePricingRule: "Patient-Care Bulk Discount" },
    ],
  },
  failing("SO-000-190-004", { customerName: "", deliveryLocation: WAREHOUSE }),
  failing("SO-000-190-005", { orderStatus: "On Hold" }),
  failing("SO-000-190-006", { customerName: "Fairview Ambulance Service", deliveryLocation: WAREHOUSE }),
  failing("SO-000-190-007", { sourceQuoteNo: "Q-000-199-999" }),
  failing("SO-000-190-008", { confirmationDate: "June 21, 2026" }),
  failing("SO-000-190-009", { salesRep: "jordan.blake@omnesoft.com" }),
  failing("SO-000-190-010", { secondarySalesReps: "emily.rios@omnesoft.com|kim.lee@omnesoft.com" }),
  failing("SO-000-190-011", { deliveryLocation: "Tri-County EMS Authority > Denver Service Center" }),
  failing("SO-000-190-012", { primaryContact: "Olivia Grant" }),
  failing("SO-000-190-013", { secondaryContacts: "Jennifer Anderson|Derek Soto" }),
  failing("SO-000-190-014", { priority: "Rush" }),
  failing("SO-000-190-015", { competitiveSituation: "Open Bid" }),
  failing("SO-000-190-016", { paymentTerms: "Net 90" }),
  failing("SO-000-190-017", { paymentMethod: "Money Order" }),
  failing("SO-000-190-018", {}, [LINE, { ...LINE, lineItem: "000-999-111", linePricePerUnit: "2400" }]),
  failing("SO-000-190-019", {}, [{ ...LINE, lineUnitOfMeasure: "Drum" }]),
  failing("SO-000-190-020", {}, [{ ...LINE, lineQuantity: "two" }]),
  failing("SO-000-190-021", {}, [{ ...LINE, lineQuantity: "-3" }]),
  failing("SO-000-190-022", {}, [{ ...LINE, linePricePerUnit: "$1,2O0" }]),
  failing("SO-000-190-023", {}, [{ ...LINE, lineType: "Service" }]),
  failing("SO-000-190-024", {}, [{ ...LINE, lineQuantity: "" }]),
  failing("SO-000-190-025", {}, [{ ...LINE, linePricingRule: "Loyalty Discount" }]),
  failing("SO-000-190-026", {}, [{ ...LINE, lineExpectedDeliveryDate: "2026/08/04" }]),
  /* A number the module already holds. */
  failing("SO-000-000-042", {}),
  /* The same number as the first record in this file. */
  failing("SO-000-190-001", { customerName: "Metro City Fire & Rescue", deliveryLocation: "Metro City Fire & Rescue > Station 1 HQ", primaryContact: "James Mitchell" }),
];

/* The initial load: the same shape, older numbers. */
const INITIAL: MockRecordSeed[] = [
  {
    record: {
      soNumber: "SO-000-150-001",
      customerName: "Summit Regional Medical Center",
      orderStatus: "Shipped",
      currencyCode: "USD",
      requestedOn: "06/12/2026",
      shipBy: "07/12/2026",
      paymentTerms: "Net 30",
      paymentMethod: "Wire Transfer",
      salesRep: "michael.rodriguez@omnesoft.com",
      primaryContact: "Laura Whitfield",
      priority: "Standard",
    },
    lines: [
      { lineType: "Item", lineItem: "000-100-041", lineUnitOfMeasure: "EA", lineQuantity: "5", linePricePerUnit: "685" },
      { lineType: "Item", lineItem: "000-100-049", lineUnitOfMeasure: "EA", lineQuantity: "2", linePricePerUnit: "7850" },
    ],
  },
  {
    record: {
      soNumber: "SO-000-150-002",
      customerName: "Eagle County Sheriff's Office",
      orderStatus: "Partially Shipped",
      currencyCode: "USD",
      requestedOn: "06/14/2026",
      shipBy: "07/14/2026",
      paymentTerms: "Net 60",
      salesRep: "david.kowalski@omnesoft.com",
      primaryContact: "Robert Chen",
      priority: "Low",
    },
    lines: [
      { lineType: "Item", lineItem: "000-100-059", lineUnitOfMeasure: "EA", lineQuantity: "1", linePricePerUnit: "18500" },
    ],
  },
];

export const SALES_ORDERS_MOCK_SEED = buildSheetMockSeed(SALES_ORDERS_SPEC, JULY, INITIAL, PARTIAL, EXISTING_SO_NUMBERS);
