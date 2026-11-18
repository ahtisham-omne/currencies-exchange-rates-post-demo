/* Sample rows behind the seeded Quotes imports: two that imported in full and
 * the June update, a partial import whose failed records together exercise
 * every rule the sheet validator (sheet-import/sheetValidation.ts) applies to
 * Quotes, so the record page shows each kind of problem an admin can meet.
 *
 * Values are checked against the live catalogs the spec validates with
 * (sheet-import/cells/importCatalog.ts), so the clean records carry no issue.
 *
 * June coverage, record -> rule (R = record column, L = line column):
 *   Q-000-190-001  clean, imported
 *   Q-000-190-002  imported with warnings: status alias (won), priority alias
 *                  (medium), blank conditional Currency Code and Expiration Date,
 *                  payment term alias (net30), line
 *                  unit alias (each), blank conditional line price
 *   Q-000-190-003  clean, imported (two lines)
 *   Q-000-190-004  R required: Customer Name blank
 *   Q-000-190-005  R dropdown: Quote Status "Pending Approval" not a status
 *   Q-000-190-006  R catalog: customer "Fairview Ambulance Service" not in Partners
 *   Q-000-190-007  R date: Requested On "2026-06-24" not MM/DD/YYYY
 *   Q-000-190-008  R number: Win Probability "high"
 *   Q-000-190-009  R number: Win Probability "-20" negative
 *   Q-000-190-010  R catalog: Sales Rep not a user
 *   Q-000-190-011  R catalog list: one Secondary Sales Rep not a user
 *   Q-000-190-012  R catalog: Delivery Location "Tri-County EMS Authority > Denver
 *                  Service Center", a site that customer does not have
 *   Q-000-190-013  R catalog: Primary Contact not a contact
 *   Q-000-190-014  R catalog list: one Secondary Contact not a contact
 *   Q-000-190-015  R dropdown: Priority "Rush"
 *   Q-000-190-016  R dropdown: Competitive Situation "Open Bid"
 *   Q-000-190-017  R catalog: Payment Terms "Net 90"
 *   Q-000-190-018  R catalog: Payment Method "Money Order"
 *   Q-000-190-019  L catalog: second line's item 000-999-111 not in Item Library
 *   Q-000-190-020  L catalog: unit "Drum" not a unit of measure
 *   Q-000-190-021  L number: quantity "two"
 *   Q-000-190-022  L number: quantity "-3" negative
 *   Q-000-190-023  L number: price "$1,2O0" (letter O)
 *   Q-000-190-024  L dropdown: line type "Service"
 *   Q-000-190-025  L required: quantity blank
 *   Q-000-190-026  L catalog list: pricing rule "Loyalty Discount"
 *   Q-000-190-027  L date: Expected Ship By "Jul 30 2026"
 *   Q-000-102-007  R existing key: the number is already in Quotes
 *   Q-000-190-001  (second time) R duplicate key, first on row 1
 */

import type { MockRecordSeed } from "../sheet-import/sheetMockSeed";
import { buildSheetMockSeed } from "../sheet-import/sheetMockSeed";
import { QUOTES_SPEC, EXISTING_QUOTE_NUMBERS } from "./quotesSpec";

/* Delivery Location reads `Customer > Location` for a customer's own site, or
   a warehouse name on its own; both shapes are in the location catalog. */
const WAREHOUSE = "Columbus Conversion Plant";

/* One clean line and one clean record the failure cases vary from. */
const LINE = { lineType: "Item", lineItem: "000-100-026", lineUnitOfMeasure: "Box", lineQuantity: "4", linePricePerUnit: "3250" };

function base(quoteNo: string): Record<string, string> {
  return {
    quoteNo,
    customerName: "Tri-County EMS Authority",
    quoteStatus: "Sent to Customer",
    currencyCode: "USD",
    requestedOn: "06/18/2026",
    respondBy: "06/25/2026",
    expirationDate: "07/18/2026",
    deliveryLocation: "Tri-County EMS Authority > Dispatch Center",
    paymentTerms: "Net 30",
    paymentMethod: "ACH/Direct Deposit",
    salesRep: "sarah.chen@omnesoft.com",
    primaryContact: "Robert Chen",
    priority: "Standard",
  };
}

function failing(quoteNo: string, record: Record<string, string>, lines = [LINE]): MockRecordSeed {
  return { record: { ...base(quoteNo), ...record }, lines };
}

const JULY: MockRecordSeed[] = [
  {
    record: {
      quoteNo: "Q-000-200-001",
      customerName: "Metro City Fire & Rescue",
      quoteStatus: "Sent to Customer",
      currencyCode: "USD",
      requestedOn: "07/02/2026",
      expirationDate: "08/01/2026",
      deliveryLocation: "Metro City Fire & Rescue > Station 1 HQ",
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
      quoteNo: "Q-000-200-002",
      customerName: "Tri-County EMS Authority",
      quoteStatus: "Draft",
      currencyCode: "USD",
      requestedOn: "07/08/2026",
      expirationDate: "08/08/2026",
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
      ...base("Q-000-190-001"),
      customerName: "Metro City Fire & Rescue",
      deliveryLocation: "Metro City Fire & Rescue > Central Maintenance Depot",
      primaryContact: "James Mitchell",
      secondaryContacts: "fleet@metrocityfire.gov|billing@metrocityfire.gov",
      secondarySalesReps: "emily.rios@omnesoft.com",
      winProbability: "70",
      expectedCloseDate: "07/31/2026",
      competitiveSituation: "Competitive",
    },
    lines: [
      { lineType: "Item", lineItem: "000-100-001", lineUnitOfMeasure: "EA", lineQuantity: "2", linePricePerUnit: "42500", linePricingRule: "Government Contract Pricing", lineExpectedShipBy: "07/20/2026" },
    ],
  },
  {
    /* Imports, with every warning the validator can raise on this module. */
    record: {
      ...base("Q-000-190-002"),
      customerName: "Lakewood Community Hospital",
      deliveryLocation: "Lakewood Community Hospital > Receiving Dock",
      quoteStatus: "won",
      currencyCode: "",
      expirationDate: "",
      paymentTerms: "net30",
      primaryContact: "Laura Whitfield",
      priority: "medium",
    },
    lines: [
      { lineType: "Item", lineItem: "000-100-041", lineUnitOfMeasure: "each", lineQuantity: "3", linePricePerUnit: "" },
    ],
  },
  {
    record: { ...base("Q-000-190-003"), priority: "Low" },
    lines: [
      { lineType: "Item", lineItem: "000-100-049", lineUnitOfMeasure: "EA", lineQuantity: "2", linePricePerUnit: "7850" },
      { lineType: "Item", lineItem: "000-100-059", lineUnitOfMeasure: "EA", lineQuantity: "1", linePricePerUnit: "18500", linePricingRule: "Patient-Care Bulk Discount" },
    ],
  },
  failing("Q-000-190-004", { customerName: "", deliveryLocation: WAREHOUSE }),
  failing("Q-000-190-005", { quoteStatus: "Pending Approval" }),
  failing("Q-000-190-006", { customerName: "Fairview Ambulance Service", deliveryLocation: WAREHOUSE }),
  failing("Q-000-190-007", { requestedOn: "2026-06-24" }),
  failing("Q-000-190-008", { winProbability: "high" }),
  failing("Q-000-190-009", { winProbability: "-20" }),
  failing("Q-000-190-010", { salesRep: "jordan.blake@omnesoft.com" }),
  failing("Q-000-190-011", { secondarySalesReps: "emily.rios@omnesoft.com|kim.lee@omnesoft.com" }),
  failing("Q-000-190-012", { deliveryLocation: "Tri-County EMS Authority > Denver Service Center" }),
  failing("Q-000-190-013", { primaryContact: "Olivia Grant" }),
  failing("Q-000-190-014", { secondaryContacts: "Jennifer Anderson|Derek Soto" }),
  failing("Q-000-190-015", { priority: "Rush" }),
  failing("Q-000-190-016", { competitiveSituation: "Open Bid" }),
  failing("Q-000-190-017", { paymentTerms: "Net 90" }),
  failing("Q-000-190-018", { paymentMethod: "Money Order" }),
  failing("Q-000-190-019", {}, [LINE, { ...LINE, lineItem: "000-999-111", linePricePerUnit: "2400" }]),
  failing("Q-000-190-020", {}, [{ ...LINE, lineUnitOfMeasure: "Drum" }]),
  failing("Q-000-190-021", {}, [{ ...LINE, lineQuantity: "two" }]),
  failing("Q-000-190-022", {}, [{ ...LINE, lineQuantity: "-3" }]),
  failing("Q-000-190-023", {}, [{ ...LINE, linePricePerUnit: "$1,2O0" }]),
  failing("Q-000-190-024", {}, [{ ...LINE, lineType: "Service" }]),
  failing("Q-000-190-025", {}, [{ ...LINE, lineQuantity: "" }]),
  failing("Q-000-190-026", {}, [{ ...LINE, linePricingRule: "Loyalty Discount" }]),
  failing("Q-000-190-027", {}, [{ ...LINE, lineExpectedShipBy: "Jul 30 2026" }]),
  /* A number the module already holds. */
  failing("Q-000-102-007", {}),
  /* The same number as the first record in this file. */
  failing("Q-000-190-001", { customerName: "Metro City Fire & Rescue", deliveryLocation: "Metro City Fire & Rescue > Station 1 HQ", primaryContact: "James Mitchell" }),
];

/* The initial load: the same shape, older numbers. */
const INITIAL: MockRecordSeed[] = [
  {
    record: {
      quoteNo: "Q-000-150-001",
      customerName: "Summit Regional Medical Center",
      quoteStatus: "Confirmed by Customer",
      currencyCode: "USD",
      requestedOn: "06/12/2026",
      expirationDate: "07/12/2026",
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
      quoteNo: "Q-000-150-002",
      customerName: "Eagle County Sheriff's Office",
      quoteStatus: "Expired",
      currencyCode: "USD",
      requestedOn: "06/14/2026",
      expirationDate: "07/14/2026",
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

export const QUOTES_MOCK_SEED = buildSheetMockSeed(QUOTES_SPEC, JULY, INITIAL, PARTIAL, EXISTING_QUOTE_NUMBERS);
