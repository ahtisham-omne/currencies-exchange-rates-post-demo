/* Partners_June_2026.csv and Partner_Groups_June_2026.csv: the seeded
 * imports that cover every rule ./validation.ts can raise for each spec.
 * Each row starts from the template's example row 1 and changes only the
 * cells listed.
 *
 * The validator is spec-driven, so a rule only exists where the spec has a
 * column for it: Partners has no number columns (no INVALID_NUMBER /
 * OUT_OF_RANGE), Partner Groups has no email or phone columns (no
 * INVALID_EMAIL / INVALID_PHONE), and neither caps a column's length (no
 * TOO_LONG), because Omne does not cap descriptions.
 *
 * Partners coverage (row: rule -> issue)
 *   1  clean create                                         -> none
 *   2  clean create, other valid vocabulary                 -> none
 *   3  unknown Status, Phone Code, Currency, Credit
 *      Enforcement, Payment Term                            -> INVALID_OPTION x5
 *   4  unknown list values (types, rules, methods, carriers) -> INVALID_OPTION x4 (single and plural)
 *   5  unknown vendor / customer sub-types                  -> INVALID_OPTION x2
 *   6  vendor sub-types without Vendor type                 -> CONDITION_NOT_MET (vendorSubTypes)
 *   7  customer sub-types without Customer type             -> CONDITION_NOT_MET (customerSubTypes)
 *   8  unknown point of contact                             -> REFERENCE_NOT_FOUND (warning)
 *   9  phone with letters                                   -> INVALID_PHONE (characters)
 *  10  phone with too few digits                            -> INVALID_PHONE (digit count)
 *  11  existing partner UPS (update), blank required group  -> no REQUIRED_EMPTY on an update
 *  12  blank Partner Name                                   -> REQUIRED_EMPTY (key)
 *  13  name repeated in row 14                              -> DUPLICATE_KEY
 *  14  same name, other case                                -> DUPLICATE_KEY
 *  15  blank Primary Partner Group on a new partner         -> REQUIRED_EMPTY
 *  16  Partner Group Omne does not know                     -> REFERENCE_NOT_FOUND (error)
 *  17  Primary Partner Group Omne does not know             -> REFERENCE_NOT_FOUND (error)
 *  18  Primary group not in the row's Partner Groups        -> NOT_IN_LIST (error)
 *  19  email without a domain                               -> INVALID_EMAIL
 *
 * Partner Groups coverage (row: rule -> issue)
 *   1  clean create                                         -> none
 *   2  clean create, other valid vocabulary                 -> none
 *   3  unknown Status, Country, Billing, Currency, Credit
 *      Enforcement, Payment Term                            -> INVALID_OPTION x6
 *   4  unknown Scope, sub-types, rules, methods, carriers   -> INVALID_OPTION x6
 *   5  vendor sub-types without Vendor scope                -> CONDITION_NOT_MET (defaultVendorSubTypes)
 *   6  customer sub-types without Customer scope            -> CONDITION_NOT_MET (defaultCustomerSubTypes)
 *   7  unknown members; primary member not in Members       -> REFERENCE_NOT_FOUND (memberIds), NOT_IN_LIST (warning)
 *   8  unknown primary member                               -> REFERENCE_NOT_FOUND (primaryMemberIds)
 *   9  existing group Brake Systems (update), unknown status -> INVALID_OPTION on an update row
 *  10  blank Group Name                                     -> REQUIRED_EMPTY
 *  11  name repeated in row 12                              -> DUPLICATE_KEY
 *  12  same name, other case                                -> DUPLICATE_KEY
 *  13  description over 5000 characters imports in full     -> none
 *  14  Max Credit Limit not a number                        -> INVALID_NUMBER
 *  15  Max Credit Limit below 0                             -> OUT_OF_RANGE
 *  16  Warning Threshold not a number                       -> INVALID_NUMBER
 *  17  Warning Threshold over 100                           -> OUT_OF_RANGE
 */

import { longText, type SeedCase } from "../failedSeedTypes";

export const PARTNERS_FAILED_SEED: SeedCase[] = [
  { outcome: "Created", rule: "Clean new partner", values: { partnerName: "Harbor Fleet Services", email: "orders@harborfleet.com" }, demonstrates: [] },
  {
    outcome: "Created",
    rule: "Clean new partner with other valid values",
    values: {
      partnerName: "Keystone Upfitters", status: "Inactive", partnerGroups: "Brake Systems", primaryPartnerGroup: "Brake Systems",
      partnerTypes: "Customer", vendorSubTypes: "", customerSubTypes: "Distributor", currency: "EUR", paymentTerm: "Net 45 Post Delivery",
      email: "ap@keystoneupfit.com", phone: "+1 555 010 2030",
    },
    demonstrates: [],
  },
  {
    outcome: "Created",
    rule: "Unrecognised single-choice values are left out",
    values: { partnerName: "Cascade Freight", email: "hello@cascadefreight.com", status: "Pending", phoneCode: "+999", currency: "Dollars", creditEnforcement: "Strict", paymentTerm: "Net 90" },
    demonstrates: [
      "status:INVALID_OPTION~is not a recognised status", "phoneCode:INVALID_OPTION", "currency:INVALID_OPTION",
      "creditEnforcement:INVALID_OPTION", "paymentTerm:INVALID_OPTION~See the Valid Values sheet",
    ],
  },
  {
    outcome: "Created",
    rule: "Unrecognised list values are left out",
    values: {
      partnerName: "Summit Parts Supply", email: "sales@summitparts.com", partnerTypes: "Vendor|Customer|Reseller",
      pricingRules: "Summer Promo", paymentMethods: "Crypto|Barter", carriers: "Pony Express",
    },
    demonstrates: [
      "partnerTypes:INVALID_OPTION~is not a recognised", "pricingRules:INVALID_OPTION",
      "paymentMethods:INVALID_OPTION~are not recognised", "carriers:INVALID_OPTION",
    ],
  },
  {
    outcome: "Created",
    rule: "Unrecognised vendor and customer sub-types",
    values: { partnerName: "Northgate Industrial", email: "info@northgate.com", vendorSubTypes: "Drop Shipper", customerSubTypes: "Government" },
    demonstrates: ["vendorSubTypes:INVALID_OPTION", "customerSubTypes:INVALID_OPTION"],
  },
  {
    outcome: "Created",
    rule: "Sub-types only apply with the matching Partner Type",
    values: { partnerName: "Ironwood Logistics", email: "ops@ironwood.com", partnerTypes: "Customer", vendorSubTypes: "Carrier", customerSubTypes: "" },
    demonstrates: ["vendorSubTypes:CONDITION_NOT_MET~includes Vendor"],
  },
  {
    outcome: "Created",
    rule: "Customer sub-types without Customer type",
    values: { partnerName: "Prairie Metal Works", email: "buy@prairiemetal.com", partnerTypes: "Vendor", vendorSubTypes: "Carrier", customerSubTypes: "Distributor" },
    demonstrates: ["customerSubTypes:CONDITION_NOT_MET~includes Customer"],
  },
  {
    outcome: "Created",
    rule: "Unknown point of contact is dropped",
    values: { partnerName: "Lakeshore Coachworks", email: "fleet@lakeshore.com", pointsOfContact: "Issac Archer|Dana Whitfield" },
    demonstrates: ["pointsOfContact:REFERENCE_NOT_FOUND~doesn't exist in Omne"],
  },
  {
    outcome: "Created",
    rule: "Phone with letters imports as-is",
    values: { partnerName: "Redline Auto Glass", email: "service@redlineglass.com", phone: "555-GLASS-01" },
    demonstrates: ["phone:INVALID_PHONE"],
  },
  {
    outcome: "Created",
    rule: "Phone with too few digits imports as-is",
    values: { partnerName: "Bayview Tire Co.", email: "orders@bayviewtire.com", phone: "12-34" },
    demonstrates: ["phone:INVALID_PHONE"],
  },
  {
    outcome: "Created",
    rule: "Existing partner updates; required columns can stay blank",
    values: { partnerName: "UPS", email: "", partnerGroups: "", primaryPartnerGroup: "", description: "Parcel and freight carrier" },
    demonstrates: ["@update"],
  },
  { outcome: "Failed", rule: "Partner Name is required", values: { partnerName: "", email: "info@unnamed.com" }, demonstrates: ["partnerName:REQUIRED_EMPTY"] },
  { outcome: "Failed", rule: "Partner name appears twice in the file", values: { partnerName: "Granite State Towing", email: "dispatch@granitetow.com" }, demonstrates: ["partnerName:DUPLICATE_KEY~row 14"] },
  { outcome: "Failed", rule: "Duplicate match ignores case", values: { partnerName: "granite state towing", email: "billing@granitetow.com" }, demonstrates: ["partnerName:DUPLICATE_KEY~row 13"] },
  {
    outcome: "Failed",
    rule: "Primary Partner Group is required on a new partner",
    values: { partnerName: "Mesa Ambulance Supply", email: "orders@mesaamb.com", partnerGroups: "", primaryPartnerGroup: "" },
    demonstrates: ["primaryPartnerGroup:REQUIRED_EMPTY"],
  },
  {
    outcome: "Failed",
    rule: "Partner Group Omne does not know",
    values: { partnerName: "Copperline Electric", email: "ap@copperline.com", partnerGroups: "Tier 1 Automotive OEMs|Solar Installers" },
    demonstrates: ["partnerGroups:REFERENCE_NOT_FOUND~doesn't exist in Omne."],
  },
  {
    outcome: "Failed",
    rule: "Primary Partner Group Omne does not know",
    values: { partnerName: "Silverline Coaches", email: "info@silverline.com", partnerGroups: "Tier 1 Automotive OEMs", primaryPartnerGroup: "Luxury Coaches" },
    demonstrates: ["primaryPartnerGroup:REFERENCE_NOT_FOUND"],
  },
  {
    outcome: "Failed",
    rule: "Primary Partner Group must be one of the row's Partner Groups",
    values: { partnerName: "Pinecrest Fabrication", email: "info@pinecrestfab.com", partnerGroups: "Brake Systems", primaryPartnerGroup: "Tier 1 Automotive OEMs" },
    demonstrates: ["primaryPartnerGroup:NOT_IN_LIST~is not listed in"],
  },
  { outcome: "Failed", rule: "Email must be a valid address", values: { partnerName: "Westbrook Supply", email: "sales@westbrook" }, demonstrates: ["email:INVALID_EMAIL"] },
];

export const PARTNER_GROUPS_FAILED_SEED: SeedCase[] = [
  { outcome: "Created", rule: "Clean new group", values: { groupName: "Virginia Fleet Dealers", description: "Fleet dealers across Virginia." }, demonstrates: [] },
  {
    outcome: "Created",
    rule: "Clean new group with other valid values",
    values: {
      groupName: "Ontario Ambulance Builders", status: "Inactive", country: "Canada", description: "Ambulance body builders in Ontario.",
      scope: "Vendor", defaultCustomerSubTypes: "", billingType: "International", currency: "CAD", maxCreditLimit: "250000", warningThreshold: "75",
    },
    demonstrates: [],
  },
  {
    outcome: "Created",
    rule: "Unrecognised single-choice values are left out",
    values: {
      groupName: "Texas Upfit Partners", status: "Paused", country: "Atlantis", billingType: "Overseas", currency: "Pesos",
      creditEnforcement: "Strict", paymentTerm: "Net 120",
    },
    demonstrates: [
      "status:INVALID_OPTION", "country:INVALID_OPTION~See the Valid Values sheet", "billingType:INVALID_OPTION", "currency:INVALID_OPTION",
      "creditEnforcement:INVALID_OPTION", "paymentTerm:INVALID_OPTION",
    ],
  },
  {
    outcome: "Created",
    rule: "Unrecognised list values are left out",
    values: {
      groupName: "Great Lakes Distributors", scope: "Vendor|Customer|Partner", defaultVendorSubTypes: "Vendor Rules|Drop Shipper",
      defaultCustomerSubTypes: "Customer Rules|Government", pricingRules: "Holiday Promo|Spring Promo", paymentMethods: "Barter", carriers: "Pony Express",
    },
    demonstrates: [
      "scope:INVALID_OPTION", "defaultVendorSubTypes:INVALID_OPTION", "defaultCustomerSubTypes:INVALID_OPTION",
      "pricingRules:INVALID_OPTION~are not recognised", "paymentMethods:INVALID_OPTION", "carriers:INVALID_OPTION",
    ],
  },
  {
    outcome: "Created",
    rule: "Default sub-types only apply with the matching Scope",
    values: { groupName: "Mountain West Carriers", scope: "Customer", defaultVendorSubTypes: "Carrier", defaultCustomerSubTypes: "Distributor" },
    demonstrates: ["defaultVendorSubTypes:CONDITION_NOT_MET~includes Vendor"],
  },
  {
    outcome: "Created",
    rule: "Default customer sub-types without Customer scope",
    values: { groupName: "Gulf Coast Suppliers", scope: "Vendor", defaultVendorSubTypes: "Carrier", defaultCustomerSubTypes: "Distributor" },
    demonstrates: ["defaultCustomerSubTypes:CONDITION_NOT_MET~includes Customer"],
  },
  {
    outcome: "Created",
    rule: "Unknown members are dropped; the primary member must be a member",
    values: { groupName: "Pacific Northwest Fleet", memberIds: "Toyota International|Evergreen Motors|Cascade Trucking", primaryMemberIds: "UPS" },
    demonstrates: ["memberIds:REFERENCE_NOT_FOUND~don't exist in Omne", "primaryMemberIds:NOT_IN_LIST~will import without it"],
  },
  {
    outcome: "Created",
    rule: "Unknown primary member is dropped",
    values: { groupName: "Carolina Service Centers", memberIds: "Toyota International", primaryMemberIds: "Evergreen Motors" },
    demonstrates: ["primaryMemberIds:REFERENCE_NOT_FOUND~doesn't exist in Omne"],
  },
  {
    outcome: "Created",
    rule: "Existing group updates; unrecognised status is left out",
    values: { groupName: "Brake Systems", status: "Archived", description: "Brake system suppliers." },
    demonstrates: ["@update", "status:INVALID_OPTION"],
  },
  { outcome: "Failed", rule: "Group Name is required", values: { groupName: "", description: "Dealers without a name." }, demonstrates: ["groupName:REQUIRED_EMPTY"] },
  { outcome: "Failed", rule: "Group name appears twice in the file", values: { groupName: "New England Towing", description: "Towing partners." }, demonstrates: ["groupName:DUPLICATE_KEY~row 12"] },
  { outcome: "Failed", rule: "Duplicate match ignores case", values: { groupName: "new england towing", description: "Towing partners, north." }, demonstrates: ["groupName:DUPLICATE_KEY~row 11"] },
  {
    outcome: "Created",
    rule: "A description over 5000 characters imports in full",
    values: {
      groupName: "Midwest Ambulance Network",
      description: longText("Regional ambulance dealers, upfitters and service centers across Ohio, Indiana and Michigan that share pricing rules, carriers and credit terms for chassis and module orders."),
    },
    demonstrates: [],
  },
  { outcome: "Failed", rule: "Max Credit Limit is not a number", values: { groupName: "Delta Parts Alliance", maxCreditLimit: "$100k" }, demonstrates: ["maxCreditLimit:INVALID_NUMBER"] },
  { outcome: "Failed", rule: "Max Credit Limit below 0", values: { groupName: "Sierra Fleet Group", maxCreditLimit: "-5000" }, demonstrates: ["maxCreditLimit:OUT_OF_RANGE~0 or more"] },
  { outcome: "Failed", rule: "Warning Threshold is not a number", values: { groupName: "Bluegrass Dealers", warningThreshold: "eighty" }, demonstrates: ["warningThreshold:INVALID_NUMBER"] },
  { outcome: "Failed", rule: "Warning Threshold over 100", values: { groupName: "Keystone Dealers", warningThreshold: "120" }, demonstrates: ["warningThreshold:OUT_OF_RANGE~between 0 and 100"] },
];
