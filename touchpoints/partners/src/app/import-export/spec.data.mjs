/* Plain ESM, no TypeScript, no React: the raw column / valid-value / example
 * data for the two import specs. Read by BOTH the app (`spec.ts`) and the
 * Node template generator (`scripts/gen-import-templates.mjs`), so the
 * checked-in template files and the in-app generator can never drift.
 *
 * Option lists that come from a TS constant in the repo are SNAPSHOTS here;
 * `__tests__/spec.snapshots.test.ts` asserts every snapshot equals the live
 * constant. Update both together.
 *
 * Copy rule: no em dashes anywhere in user-facing strings. */

/* ───────────────────────── option snapshots ───────────────────────── */

/** VENDOR_SUB_TYPES (partnerConstants.tsx), label -> id. */
export const VENDOR_SUB_TYPES = [
  { id: "vendor_rules", label: "Vendor Rules" },
  { id: "carrier", label: "Carrier" },
  { id: "online_vendor", label: "Online Vendor" },
  { id: "in_store_vendor", label: "In-Store Vendor" },
  { id: "sub_contractor", label: "Sub Contractor" },
  { id: "service_provider", label: "Service Provider" },
];

/** CUSTOMER_SUB_TYPES (partnerConstants.tsx), label -> id. */
export const CUSTOMER_SUB_TYPES = [
  { id: "customer_rules", label: "Customer Rules" },
  { id: "wholesale_buyer", label: "Wholesale Buyer" },
  { id: "distributor", label: "Distributor" },
  { id: "end_consumer", label: "End Consumer" },
  { id: "b2b_client", label: "B2B Client" },
  { id: "reseller", label: "Reseller" },
];

/** Partner Type pills (CreatePartnerModal Step 2), label -> id. */
export const PARTNER_TYPES = [
  { id: "vendor", label: "Vendor" },
  { id: "customer", label: "Customer" },
];

/** COUNTRY_CODES (CreatePartnerModal.tsx, local useMemo). The file value is the
 *  dial code; two entries share "+1" so the first wins on apply. */
export const COUNTRY_CODES = [
  { code: "+1", country: "United States", flag: "🇺🇸" },
  { code: "+1", country: "Canada", flag: "🇨🇦" },
  { code: "+44", country: "United Kingdom", flag: "🇬🇧" },
  { code: "+49", country: "Germany", flag: "🇩🇪" },
  { code: "+33", country: "France", flag: "🇫🇷" },
  { code: "+81", country: "Japan", flag: "🇯🇵" },
  { code: "+86", country: "China", flag: "🇨🇳" },
  { code: "+91", country: "India", flag: "🇮🇳" },
  { code: "+61", country: "Australia", flag: "🇦🇺" },
  { code: "+55", country: "Brazil", flag: "🇧🇷" },
  { code: "+971", country: "UAE", flag: "🇦🇪" },
  { code: "+65", country: "Singapore", flag: "🇸🇬" },
  { code: "+82", country: "South Korea", flag: "🇰🇷" },
  { code: "+52", country: "Mexico", flag: "🇲🇽" },
  { code: "+31", country: "Netherlands", flag: "🇳🇱" },
  { code: "+46", country: "Sweden", flag: "🇸🇪" },
  { code: "+41", country: "Switzerland", flag: "🇨🇭" },
  { code: "+34", country: "Spain", flag: "🇪🇸" },
  { code: "+39", country: "Italy", flag: "🇮🇹" },
  { code: "+48", country: "Poland", flag: "🇵🇱" },
];

/** CURRENCY_OPTIONS ids (partnerConstants.tsx), in order. The file value is
 *  the upper-cased code ("USD"); apply maps it back to the id ("usd"). */
export const CURRENCY_IDS = [
  "usd", "eur", "gbp", "jpy", "chf", "cad", "aud", "cny",
  "inr", "krw", "sgd", "hkd", "twd", "thb", "myr", "idr", "php", "vnd", "nzd", "pkr", "bdt", "lkr", "mmk", "khr", "lak", "fjd", "pgk",
  "mxn", "brl", "ars", "clp", "cop", "pen", "uyu", "jmd",
  "sek", "nok", "dkk", "pln", "czk", "huf", "ron", "bgn", "hrk", "rsd", "try", "rub", "uah", "isk",
  "aed", "sar", "qar", "kwd", "bhd", "omr", "jod", "ils", "egp", "zar", "ngn", "kes", "ghs", "mad", "tnd", "kzt", "gel",
];
export const CURRENCY_CODES = CURRENCY_IDS.map((id) => id.toUpperCase());

/** Credit enforcement radio ids (both create modals). */
export const CREDIT_ENFORCEMENT = [
  { id: "none", label: "None" },
  { id: "soft_warning", label: "Soft Warning" },
  { id: "hard_block", label: "Hard Block" },
];

/** PAYMENT_TERM_PRESETS (partnerConstants.tsx), id + name. */
export const PAYMENT_TERM_PRESETS = [
  { id: "pt-1", name: "Net 10" },
  { id: "pt-2", name: "Net 15" },
  { id: "pt-3", name: "Net 30" },
  { id: "pt-4", name: "Net 30 Post Shipping" },
  { id: "pt-5", name: "Net 45 Post Delivery" },
  { id: "pt-6", name: "Net 60 Post Production End" },
  { id: "pt-7", name: "Full Advance Payment: Order Confirmation" },
  { id: "pt-8", name: "Full Advance Payment: Production Start" },
  { id: "pt-9", name: "30/70 Split: Production Start & Delivery" },
  { id: "pt-10", name: "50/50 Split: Order Confirmation & Delivery" },
  { id: "pt-11", name: "40/60 Split: Production Start & Shipping" },
  { id: "pt-12", name: "2/10 Net 30 Post Shipping" },
  { id: "pt-custom-1", name: "Net 25 Post Production End" },
  { id: "pt-custom-2", name: "Order Confirmation Advance" },
  { id: "pt-custom-3", name: "40/60 Split: Production End & Delivery" },
  { id: "pt-custom-4", name: "Net 90 Post Shipping" },
  { id: "pt-custom-5", name: "20/30/50 Split: Order Confirmation, Production End & Delivery" },
];

/** PRICING_RULE_PRESETS (partnerConstants.tsx), id + name. */
export const PRICING_RULE_PRESETS = [
  { id: "pr-1", name: "Standard Discount, Value (Single-Tier)" },
  { id: "pr-2", name: "Standard Discount, Volume (Single-Tier)" },
  { id: "pr-3", name: "Tiered Discount, Value (Multi-Tier)" },
  { id: "pr-4", name: "Tiered Discount, Volume (Multi-Tier)" },
  { id: "pr-5", name: "Standard Premium, Value (Single-Tier)" },
  { id: "pr-6", name: "Standard Premium, Volume (Single-Tier)" },
  { id: "pr-7", name: "Tiered Premium, Value (Multi-Tier)" },
  { id: "pr-8", name: "Tiered Premium, Volume (Multi-Tier)" },
  { id: "pr-custom-1", name: "Q2 Loyalty Value Discount" },
  { id: "pr-custom-2", name: "Bulk Fastener Discount" },
  { id: "pr-custom-3", name: "Annual Value-Based Savings Plan" },
  { id: "pr-custom-4", name: "Seasonal Volume Boost" },
  { id: "pr-custom-5", name: "Rush Order Premium" },
  { id: "pr-custom-6", name: "Small Batch Handling Fee" },
];

/** PAYMENT_TYPE_CARDS ids (partnerConstants.tsx). `label` is the short file
 *  vocabulary from the import spec; `typeLabel` is the card label the record
 *  stores. */
export const PAYMENT_METHODS = [
  { id: "ach", label: "ACH", typeLabel: "ACH / Direct Deposit" },
  { id: "wire", label: "Wire", typeLabel: "Wire Transfer" },
  { id: "card", label: "Card", typeLabel: "Credit / Debit Card" },
  { id: "digital_wallet", label: "Digital Wallet", typeLabel: "Digital Wallet" },
  { id: "check", label: "Check", typeLabel: "Check (Paper)" },
  { id: "cash", label: "Cash", typeLabel: "Cash" },
  { id: "other", label: "Other", typeLabel: "Other (Record Only)" },
];

/** SHIPPING_CARRIER_CATALOG ids (ShippingCarrierCard.tsx). `label` is the
 *  short file vocabulary; `name` is the catalog display name. */
export const CARRIERS = [
  { id: "customer-pickup", label: "Customer Pickup", name: "Customer Pickup" },
  { id: "vendor-pickup", label: "Vendor Pickup", name: "Vendor Pickup" },
  { id: "fedex", label: "FedEx", name: "FedEx Express" },
  { id: "tcs", label: "TCS", name: "TCS (Tranzum Courier Service)" },
  { id: "dhl", label: "DHL", name: "DHL Express" },
  { id: "ups", label: "UPS", name: "UPS (United Parcel Service)" },
  { id: "sf", label: "SF", name: "SF Express" },
  { id: "usps", label: "USPS", name: "USPS" },
  { id: "aramex", label: "Aramex", name: "Aramex" },
  { id: "maersk", label: "Maersk", name: "Maersk" },
];

/** GROUP_COUNTRY_OPTIONS (CreatePartnerGroupModal.tsx, local const), 45. */
export const GROUP_COUNTRIES = [
  { name: "United States", flag: "🇺🇸" }, { name: "Canada", flag: "🇨🇦" }, { name: "Mexico", flag: "🇲🇽" },
  { name: "United Kingdom", flag: "🇬🇧" }, { name: "Germany", flag: "🇩🇪" }, { name: "France", flag: "🇫🇷" },
  { name: "Italy", flag: "🇮🇹" }, { name: "Spain", flag: "🇪🇸" }, { name: "Netherlands", flag: "🇳🇱" },
  { name: "Switzerland", flag: "🇨🇭" }, { name: "Sweden", flag: "🇸🇪" }, { name: "Norway", flag: "🇳🇴" },
  { name: "Denmark", flag: "🇩🇰" }, { name: "Ireland", flag: "🇮🇪" }, { name: "Poland", flag: "🇵🇱" },
  { name: "Australia", flag: "🇦🇺" }, { name: "New Zealand", flag: "🇳🇿" }, { name: "Japan", flag: "🇯🇵" },
  { name: "South Korea", flag: "🇰🇷" }, { name: "China", flag: "🇨🇳" }, { name: "Taiwan", flag: "🇹🇼" },
  { name: "Hong Kong", flag: "🇭🇰" }, { name: "Singapore", flag: "🇸🇬" }, { name: "Malaysia", flag: "🇲🇾" },
  { name: "Indonesia", flag: "🇮🇩" }, { name: "Philippines", flag: "🇵🇭" }, { name: "Thailand", flag: "🇹🇭" },
  { name: "Vietnam", flag: "🇻🇳" }, { name: "India", flag: "🇮🇳" }, { name: "Pakistan", flag: "🇵🇰" },
  { name: "Bangladesh", flag: "🇧🇩" }, { name: "United Arab Emirates", flag: "🇦🇪" }, { name: "Saudi Arabia", flag: "🇸🇦" },
  { name: "Israel", flag: "🇮🇱" }, { name: "Turkey", flag: "🇹🇷" }, { name: "South Africa", flag: "🇿🇦" },
  { name: "Egypt", flag: "🇪🇬" }, { name: "Nigeria", flag: "🇳🇬" }, { name: "Kenya", flag: "🇰🇪" },
  { name: "Brazil", flag: "🇧🇷" }, { name: "Argentina", flag: "🇦🇷" }, { name: "Chile", flag: "🇨🇱" },
  { name: "Colombia", flag: "🇨🇴" }, { name: "Peru", flag: "🇵🇪" },
];

/** The hand-written CONTACT_DICTIONARY entries (partnerConstants.tsx
 *  C-001..C-024), deduplicated in order of first appearance (C-013..C-020
 *  repeat C-001..C-008). The live dictionary is extended at runtime with
 *  generated contacts, so Points of Contact is validated as a reference
 *  (`optionsFrom: "contacts"`), not against this list. These names only
 *  feed the example rows. */
export const CONTACT_NAMES = [
  "Issac Archer", "Braelyn Lowe", "Leah Wilkins", "Jamya House", "Peyton Ellison", "Jimena Morrow",
  "Jackson Mahoney", "Kelvin Levy", "Jesse Donovan", "Sonia Bean", "Angie Webb", "Jay Massey",
  "Marcus Chen", "Diana Ross", "Tyler Brooks", "Sofia Martinez",
];

export const STATUS_OPTIONS = ["Active", "Inactive"];
export const YES_NO = ["Yes", "No"];
export const BILLING_TYPES = ["Domestic", "International"];

const labels = (list) => list.map((o) => o.label);
const names = (list) => list.map((o) => o.name);
const listOf = (arr) => arr.join(", ");
const PIPE_HINT = "Separate several values with a pipe character ( | ).";

/* ───────────────────────── shared copy ───────────────────────── */

const COPY_FROM_OLD_SYSTEM =
  "This template is plain text, so you can copy and paste from an export of your old system. Line your old columns up with these columns, fill in any that your old system did not have, and paste. Enter phone numbers as you already have them, including any plus sign or country code. You do not need to reformat or split them.";

const FILE_LIMITS = "Upload an Excel or CSV file up to 10 MB. Omne reads a single sheet. Keep only the data sheet before you upload.";
const EMPTY_CELLS = "Safe to leave blank in optional columns. Omne skips an empty cell and never overwrites an existing value with a blank.";

/* ───────────────────────── Partners ───────────────────────── */

const PARTNER_COLUMNS = [
  {
    key: "partnerName", label: "Partner Name", required: true, kind: "text", width: 26,
    aliases: ["partner", "partners", "name", "company name", "display name", "partner_name"],
    description: "The partner's name and the matching key. A new name creates a partner, a matching name updates that partner. Required.",
    ref: { format: "Text", example: "Acme Supply Co." },
    example1: "Acme Supply Co.", example2: "Nordic Fasteners AB",
  },
  {
    key: "status", label: "Status", kind: "select", options: STATUS_OPTIONS, width: 14,
    aliases: ["partner status"],
    description: "Active or Inactive. Blank imports a new partner as Active and leaves an existing partner unchanged.",
    ref: { format: "Set value", validValues: "Active, Inactive, or blank", example: "Active" },
    example1: "Active", example2: "",
  },
  {
    key: "partnerGroups", label: "Partner Groups", kind: "multiselect", optionsFrom: "groups", unknownSeverity: "error", width: 34,
    aliases: ["groups", "partner group", "group"],
    description: "Every partner group this partner belongs to. Each name must match an existing partner group. Separate several with a pipe character ( | ).",
    ref: { format: "Text, pipe-separated", validValues: "Existing partner group names", example: "[ Tier 1 Automotive OEMs | Powertrain Components ]" },
    example1: "Tier 1 Automotive OEMs|Powertrain Components", example2: "Nordic Countries",
  },
  {
    key: "primaryPartnerGroup", label: "Primary Partner Group", required: true, kind: "select", optionsFrom: "groups", unknownSeverity: "error",
    subsetOf: "partnerGroups", width: 28,
    aliases: ["primary group"],
    description: "The one group whose configuration this partner inherits. Must be one of the Partner Groups on the row. Required.",
    ref: { format: "Set value", validValues: "One of the row's Partner Groups", example: "Tier 1 Automotive OEMs" },
    example1: "Tier 1 Automotive OEMs", example2: "Nordic Countries",
  },
  {
    key: "partnerTypes", label: "Partner Type", kind: "multiselect", options: labels(PARTNER_TYPES), width: 18,
    aliases: ["type", "partner types", "types"],
    description: "Vendor, Customer, or both. Blank inherits the primary group's scope.",
    ref: { format: "Set value, pipe-separated", validValues: "Vendor, Customer", example: "[ Vendor | Customer ]" },
    example1: "Vendor|Customer", example2: "Vendor",
  },
  {
    key: "vendorSubTypes", label: "Vendor Sub-Types", kind: "multiselect", options: labels(VENDOR_SUB_TYPES), width: 24,
    conditionalOn: { field: "partnerTypes", includes: "Vendor" },
    aliases: ["vendor subtypes", "vendor profiles", "vendor sub types"],
    description: "Vendor profiles to enable. Only applied when the partner is a Vendor.",
    ref: { format: "Set value, pipe-separated", validValues: listOf(labels(VENDOR_SUB_TYPES)), example: "[ Vendor Rules | Carrier ]" },
    example1: "Vendor Rules|Carrier", example2: "Vendor Rules",
  },
  {
    key: "customerSubTypes", label: "Customer Sub-Types", kind: "multiselect", options: labels(CUSTOMER_SUB_TYPES), width: 24,
    conditionalOn: { field: "partnerTypes", includes: "Customer" },
    aliases: ["customer subtypes", "customer profiles", "customer sub types"],
    description: "Customer profiles to enable. Only applied when the partner is a Customer.",
    ref: { format: "Set value, pipe-separated", validValues: listOf(labels(CUSTOMER_SUB_TYPES)), example: "Customer Rules" },
    example1: "Customer Rules", example2: "",
  },
  {
    key: "phoneCode", label: "Phone Country Code", kind: "select", options: Array.from(new Set(COUNTRY_CODES.map((c) => c.code))), text: true, width: 14,
    aliases: ["country code", "dial code", "phone code"],
    description: "Dial code for the phone number, such as +1 or +44. Blank means +1.",
    ref: { format: "Dial code", validValues: listOf(Array.from(new Set(COUNTRY_CODES.map((c) => c.code)))), example: "+1" },
    example1: "+1", example2: "+46",
  },
  {
    key: "phone", label: "Phone Number", kind: "text", format: "phone", text: true, width: 18,
    aliases: ["phone", "mobile", "telephone", "partner phone"],
    description: "The partner's main phone number, entered as you have it. Kept as text.",
    ref: { format: "Phone", example: "(555) 123-4567" },
    example1: "(555) 123-4567", example2: "8 123 456 78",
  },
  {
    key: "email", label: "Email", kind: "text", format: "email", width: 26,
    aliases: ["email address", "partner email"],
    description: "The partner's main email address.",
    ref: { format: "Email address", example: "contact@acme.com" },
    example1: "contact@acme.com", example2: "sales@nordicfasteners.se",
  },
  {
    key: "website", label: "Website", kind: "text", width: 24,
    aliases: ["url", "web"],
    description: "The partner's website.",
    ref: { format: "Text", example: "https://acme.com" },
    example1: "https://acme.com", example2: "",
  },
  {
    key: "address", label: "Address", kind: "text", width: 34,
    aliases: ["billing address", "street address"],
    description: "The partner's address on a single line.",
    ref: { format: "Text", example: "123 Oak Street, Springfield, IL 62701" },
    example1: "123 Oak Street, Springfield, IL 62701", example2: "",
  },
  {
    key: "description", label: "Description", kind: "text", width: 34,
    aliases: ["notes", "summary"],
    description: "A short summary of the partner's purpose or context.",
    ref: { format: "Free text", example: "Primary supplier of stamped steel brackets." },
    example1: "Primary supplier of stamped steel brackets.", example2: "",
  },
  {
    key: "pointsOfContact", label: "Points of Contact", kind: "multiselect", optionsFrom: "contacts", unknownSeverity: "warning", width: 28,
    aliases: ["contacts", "point of contact", "poc"],
    description: "Contacts from the Contact Directory to attach at partner level. Unknown names import with a warning and are dropped.",
    ref: { format: "Text, pipe-separated", validValues: "Existing Contact Directory names", example: "[ Issac Archer | Braelyn Lowe ]" },
    example1: "Issac Archer|Braelyn Lowe", example2: "",
  },
  {
    key: "currency", label: "Currency", kind: "select", options: CURRENCY_CODES, width: 12,
    aliases: ["billing currency"],
    description: "Three-letter currency code, such as USD or EUR. Blank inherits the primary group's currency, else USD.",
    ref: { format: "Set value", validValues: "ISO code from the Valid Values sheet", example: "USD" },
    example1: "USD", example2: "SEK",
  },
  {
    key: "creditEnforcement", label: "Credit Enforcement", kind: "select", options: labels(CREDIT_ENFORCEMENT), width: 18,
    aliases: ["enforcement", "credit limit enforcement"],
    description: "What happens when the partner reaches its credit limit. Blank means None.",
    ref: { format: "Set value", validValues: listOf(labels(CREDIT_ENFORCEMENT)), example: "Soft Warning" },
    example1: "Soft Warning", example2: "None",
  },
  {
    key: "paymentTerm", label: "Payment Term", kind: "select", options: names(PAYMENT_TERM_PRESETS), width: 26,
    aliases: ["payment terms", "term"],
    description: "The name of a payment term preset. Blank inherits the primary group's term.",
    ref: { format: "Set value", validValues: "Payment term preset names, see Valid Values", example: "Net 30" },
    example1: "Net 30", example2: "Net 45 Post Delivery",
  },
  {
    key: "pricingRules", label: "Pricing Rules", kind: "multiselect", options: names(PRICING_RULE_PRESETS), width: 34,
    aliases: ["pricing rule", "pricing"],
    description: "Pricing rule preset names to apply. Blank inherits the primary group's rules.",
    ref: { format: "Text, pipe-separated", validValues: "Pricing rule preset names, see Valid Values", example: "Standard Discount, Value (Single-Tier)" },
    example1: "Standard Discount, Value (Single-Tier)", example2: "",
  },
  {
    key: "paymentMethods", label: "Payment Methods", kind: "multiselect", options: labels(PAYMENT_METHODS), width: 22,
    aliases: ["payment method", "methods"],
    description: "Accepted payment method types.",
    ref: { format: "Set value, pipe-separated", validValues: listOf(labels(PAYMENT_METHODS)), example: "[ ACH | Wire ]" },
    example1: "ACH|Wire", example2: "Wire",
  },
  {
    key: "carriers", label: "Carriers", kind: "multiselect", options: labels(CARRIERS), width: 22,
    aliases: ["carrier", "shipping carriers", "freight"],
    description: "Preferred shipping carriers. The first one becomes the default.",
    ref: { format: "Set value, pipe-separated", validValues: listOf(labels(CARRIERS)), example: "[ FedEx | UPS ]" },
    example1: "FedEx|UPS", example2: "DHL",
  },
];

export const PARTNERS_DATA = {
  entity: "Partners",
  entitySingular: "Partner",
  nounLower: "partner",
  nounPluralLower: "partners",
  moduleSlug: "partners",
  moduleLine: "Omne Pioneer  ·  Partners Management",
  fileBase: "Omne_Partners_Import_Template",
  guideFile: "Omne_Partners_Import_Guide.txt",
  keyColumn: "partnerName",
  freezeColumns: 4,
  uploadPath: "Partners Management, Partners, Actions, Import Partners",
  columns: PARTNER_COLUMNS,
  frSubtitle: "Every column explained. Red rows are required and cannot be left blank.",
  instructions: {
    quickStart: [
      "Go to the Data Entry sheet. That is where you enter your partners, one partner per row.",
      "Review the two example rows. They show the expected format for each column. Delete them before you import.",
      "Enter your partners. The two required columns have red headers and cannot be left blank: Partner Name, Primary Partner Group.",
      "Partner Groups must already exist in Omne, and the Primary Partner Group must be one of the groups listed on the row. Other set-value columns fall back to a safe default when blank. See How Partners Are Matched below.",
      "For columns that can hold a list, such as Partner Groups, Partner Type, Pricing Rules, and Carriers, separate each value with a pipe character ( | ). The pipe is on most keyboards above the backslash key, typed with Shift. Example: [ Vendor | Customer ].",
      "Save the file, then upload it in Omne under Partners Management, Partners, Actions, Import Partners.",
    ],
    sections: [
      {
        heading: "How Partners Are Matched",
        intro: "Omne matches each row by Partner Name, then decides whether to create a new partner or update an existing one. Matching is not case sensitive and ignores surrounding spaces.",
        items: [
          ["New Partner", "The name is not in Omne yet, so a new partner is created. Status: blank means Active. Partner Type: blank inherits the primary group's scope. Currency, Payment Term, and Pricing Rules: blank inherits the primary group's template."],
          ["Existing Partner", "The name already belongs to a partner, so that partner is updated. Any blank cell leaves the existing value unchanged. Only the Partner Name is required on an update row."],
          ["Partner Name", "The name is the matching key and is never changed by an import. A different spelling is treated as a different partner."],
        ],
      },
      { heading: "Copying from Another System", intro: COPY_FROM_OLD_SYSTEM },
      {
        heading: "Important Notes",
        items: [
          ["Partner Groups", "Each group name must match a partner group that already exists in Omne. An unknown group blocks the row. The Primary Partner Group must be one of the groups listed in Partner Groups."],
          ["Partner Type", "Vendor, Customer, or both, separated with a pipe. Vendor Sub-Types apply only to vendors and Customer Sub-Types only to customers; a sub-type without its type imports with a warning and is ignored."],
          ["Phone Number", "Enter the number as you have it. Phone Country Code takes the dial code, such as +1 or +44. Both are kept as text so leading zeros and the plus sign are preserved."],
          ["Email", "Must look like name@domain.com. An invalid email blocks the row."],
          ["Currency, Payment Term, Pricing Rules", "Use the exact names from the Valid Values sheet. An unknown value imports with a warning and the partner keeps the group default."],
          ["File Limits", FILE_LIMITS],
          ["Empty Cells", EMPTY_CELLS],
        ],
      },
    ],
  },
  compareTable: {
    heading: "New Partner vs Existing Partner",
    colHeaders: ["For a New Partner (Name Not in Omne)", "For an Existing Partner (Name Already in Omne)"],
    rows: [
      ["The Row", "Creates a new partner.", "Updates the existing partner. The name is never changed by the import."],
      ["Blank Cell", "Fields left blank are simply empty on the new partner, or take the default noted below.", "A blank cell leaves the existing value unchanged."],
      ["Status", "Blank means Active.", "Blank keeps the current status."],
      ["Primary Partner Group", "Required. The partner inherits this group's template.", "Blank keeps the current primary group. A value re-points the partner to that group."],
      ["Partner Type", "Blank inherits the primary group's scope.", "Blank keeps the current types."],
    ],
    mergedLast: ["Archived", "If the name belongs to an archived partner, the row updates that partner but does not restore it. Unarchive it from the listing afterwards if needed."],
  },
  validValues: [
    {
      heading: "New and Existing Partners",
      subHeader: ["Case", "What the Import Does"],
      rows: [
        ["New Name", "Creates a new partner. Blank Status means Active. Blank Partner Type inherits the primary group's scope."],
        ["Existing Name", "Updates the partner. Blank cells keep existing values. Only Partner Name is required."],
      ],
    },
    { heading: "Status", subHeader: ["Value", "What It Means"], rows: [["Active", "A current, active partner."], ["Inactive", "A partner that is kept on file but not used in new transactions."], ["(blank)", "New partner: Active. Existing partner: unchanged."]], note: "Archived is set by Omne from the listing, not from this file." },
    { heading: "Partner Type", subHeader: ["Value", "What It Means"], rows: [["Vendor", "Supplies goods or services to you."], ["Customer", "Purchases goods or services from you."], ["(blank)", "Inherits the primary group's scope."]] },
    { heading: "Vendor Sub-Types", subHeader: ["Value", "What It Means"], rows: VENDOR_SUB_TYPES.map((s) => [s.label, s.id === "vendor_rules" ? "The base vendor profile. Always on for a vendor." : s.id === "carrier" ? "The partner also acts as a shipping carrier." : "Coming soon in Omne. Accepted and stored, not yet configurable."]) },
    { heading: "Customer Sub-Types", subHeader: ["Value", "What It Means"], rows: CUSTOMER_SUB_TYPES.map((s) => [s.label, s.id === "customer_rules" ? "The base customer profile. Always on for a customer." : "Coming soon in Omne. Accepted and stored, not yet configurable."]) },
    { heading: "Phone Country Code", subHeader: ["Value", "Country"], rows: COUNTRY_CODES.map((c) => [c.code, c.country]) },
    { heading: "Currency", subHeader: ["Value", "What It Means"], rows: [["ISO Code", listOf(CURRENCY_CODES)], ["(blank)", "Inherits the primary group's currency, else USD."]] },
    { heading: "Credit Enforcement", subHeader: ["Value", "What It Means"], rows: [["None", "No credit limit is enforced."], ["Soft Warning", "Transactions past the limit go through with a warning."], ["Hard Block", "Transactions past the limit are blocked."], ["(blank)", "None."]] },
    { heading: "Payment Term", subHeader: ["Value", "What It Means"], rows: PAYMENT_TERM_PRESETS.map((p) => [p.name, `Payment term preset ${p.id}.`]), note: "Blank inherits the primary group's payment term." },
    { heading: "Pricing Rules", subHeader: ["Value", "What It Means"], rows: PRICING_RULE_PRESETS.map((p) => [p.name, `Pricing rule preset ${p.id}.`]), note: "Blank inherits the primary group's pricing rules." },
    { heading: "Payment Methods", subHeader: ["Value", "What It Means"], rows: PAYMENT_METHODS.map((m) => [m.label, m.typeLabel]) },
    { heading: "Carriers", subHeader: ["Value", "What It Means"], rows: CARRIERS.map((c) => [c.label, c.name]) },
    { heading: "Lists (Partner Groups, Partner Type, Sub-Types, Points of Contact, Pricing Rules, Payment Methods, Carriers)", note: "These columns can hold more than one value. Separate each value with a pipe character ( | ), found above the backslash key using Shift. Example: [ Vendor | Customer ]. For Partner Groups and Points of Contact, each name must match a record that already exists in your Omne instance, and matching is not case sensitive." },
  ],
  guide: {
    intro: [
      "This guide explains how to fill in the Partners import CSV. It covers the steps, every column, and what the import does for a new partner and an existing partner.",
      "The CSV has 2 required columns and 18 optional ones.",
    ],
    quickStart: [
      "Open the CSV. The first row is the column headers. Each row below it is one partner.",
      "Two example rows are included to show the expected format. Delete both before you import.",
      "Fill in your partners. The two required columns are marked with an asterisk and cannot be left blank: Partner Name, Primary Partner Group.",
      "Partner Groups must already exist in Omne, and the Primary Partner Group must be one of the groups listed on the row. Other set-value columns fall back to a safe default when blank. See How Partners Are Matched below.",
      "For columns that can hold a list, such as Partner Groups, Partner Type, Pricing Rules, and Carriers, separate each value with a pipe character ( | ). The pipe is on most keyboards above the backslash key, typed with Shift. Example: [ Vendor | Customer ]",
      "Save the file, then upload it in Omne under Partners Management, Partners, Actions, Import Partners.",
    ],
    matchedSections: [
      {
        title: "For a New Partner (Name Not in Omne)",
        lead: "A new partner is created.",
        items: [
          ["Status", "Blank means Active."],
          ["Partner Type", "Blank inherits the primary group's scope."],
          ["Template", "Currency, Payment Term, and Pricing Rules inherit the primary group's template when blank."],
        ],
      },
      {
        title: "For an Existing Partner (Name Already in Omne)",
        lead: "The matching partner is updated with the values you provide. A blank cell leaves the existing value unchanged.",
        items: [
          ["Status", "Blank keeps the current status."],
          ["Groups", "Partner Groups and Primary Partner Group replace the current groups when given."],
        ],
      },
    ],
    fieldGroups: [
      { title: "Required Columns", keys: ["partnerName", "primaryPartnerGroup"] },
      { title: "Identity and Grouping", keys: ["status", "partnerGroups", "partnerTypes", "vendorSubTypes", "customerSubTypes"] },
      { title: "Contact", keys: ["phoneCode", "phone", "email", "website", "address", "description", "pointsOfContact"] },
      { title: "Billing and Freight", keys: ["currency", "creditEnforcement", "paymentTerm", "pricingRules", "paymentMethods", "carriers"] },
    ],
  },
  examples: [
    PARTNER_COLUMNS.map((c) => c.example1),
    PARTNER_COLUMNS.map((c) => c.example2),
  ],
};

/* ───────────────────────── Partner Groups ───────────────────────── */

const GROUP_COLUMNS = [
  {
    key: "groupName", label: "Group Name", required: true, kind: "text", width: 28,
    aliases: ["group", "name", "partner group", "partner groups", "group_name"],
    description: "The group's display name and the matching key. A new name creates a group, a matching name updates that group. Required.",
    ref: { format: "Text", example: "Maryland Ambulance Dealers" },
    example1: "Maryland Ambulance Dealers", example2: "Nordic Fasteners",
  },
  {
    key: "status", label: "Status", kind: "select", options: STATUS_OPTIONS, width: 14,
    aliases: ["group status"],
    description: "Active or Inactive. Blank imports a new group as Active and leaves an existing group unchanged.",
    ref: { format: "Set value", validValues: "Active, Inactive, or blank", example: "Active" },
    example1: "Active", example2: "",
  },
  {
    key: "country", label: "Country", kind: "select", options: names(GROUP_COUNTRIES), width: 20,
    aliases: ["default country"],
    description: "Default country for partners created under this group. Pre-fills the partner's country and dial code.",
    ref: { format: "Set value", validValues: "Country names, see Valid Values", example: "United States" },
    example1: "United States", example2: "Sweden",
  },
  {
    key: "description", label: "Description", kind: "text", maxLength: 5000, width: 40,
    aliases: ["summary", "notes"],
    description: "A short summary of the group's purpose or context. Up to 5000 characters.",
    ref: { format: "Free text, up to 5000 characters", example: "Regional ambulance dealers and upfitters across Maryland." },
    example1: "Regional ambulance dealers and upfitters across Maryland.", example2: "",
  },
  {
    key: "scope", label: "Group Scope", kind: "multiselect", options: labels(PARTNER_TYPES), width: 18,
    aliases: ["type", "partner group type", "partner type"],
    description: "Which partner types this template applies to: Vendor, Customer, or both. Optional.",
    ref: { format: "Set value, pipe-separated", validValues: "Vendor, Customer", example: "[ Vendor | Customer ]" },
    example1: "Vendor|Customer", example2: "Vendor",
  },
  {
    key: "defaultVendorSubTypes", label: "Vendor Profiles", kind: "multiselect", options: labels(VENDOR_SUB_TYPES), width: 24,
    conditionalOn: { field: "scope", includes: "Vendor" },
    aliases: ["vendor sub-types", "vendor subtypes", "default vendor profiles"],
    description: "Vendor profiles enabled by default for partners in this group.",
    ref: { format: "Set value, pipe-separated", validValues: listOf(labels(VENDOR_SUB_TYPES)), example: "[ Vendor Rules | Carrier ]" },
    example1: "Vendor Rules|Carrier", example2: "Vendor Rules",
  },
  {
    key: "defaultCustomerSubTypes", label: "Customer Profiles", kind: "multiselect", options: labels(CUSTOMER_SUB_TYPES), width: 24,
    conditionalOn: { field: "scope", includes: "Customer" },
    aliases: ["customer sub-types", "customer subtypes", "default customer profiles"],
    description: "Customer profiles enabled by default for partners in this group.",
    ref: { format: "Set value, pipe-separated", validValues: listOf(labels(CUSTOMER_SUB_TYPES)), example: "Customer Rules" },
    example1: "Customer Rules", example2: "",
  },
  {
    key: "memberIds", label: "Linked Partners", kind: "multiselect", optionsFrom: "partners", unknownSeverity: "warning", width: 34,
    aliases: ["partners", "members", "linked partner"],
    description: "Existing partners to place in this group, by name. Unknown names import with a warning and are dropped.",
    ref: { format: "Text, pipe-separated", validValues: "Existing partner names", example: "[ Toyota International | NTN Corporation ]" },
    example1: "Toyota International|NTN Corporation", example2: "",
  },
  {
    key: "primaryMemberIds", label: "Primary Partners", kind: "multiselect", optionsFrom: "partners", unknownSeverity: "warning",
    subsetOf: "memberIds", subsetSeverity: "warning", width: 30,
    aliases: ["primary partner", "primary members"],
    description: "Linked partners that use this group as their primary group. Must be a subset of Linked Partners.",
    ref: { format: "Text, pipe-separated", validValues: "Subset of Linked Partners", example: "Toyota International" },
    example1: "Toyota International", example2: "",
  },
  {
    key: "billingType", label: "Billing Type", kind: "select", options: BILLING_TYPES, width: 14,
    aliases: ["billing"],
    description: "Domestic or International. Blank means Domestic.",
    ref: { format: "Set value", validValues: "Domestic, International", example: "Domestic" },
    example1: "Domestic", example2: "International",
  },
  {
    key: "currency", label: "Currency", kind: "select", options: CURRENCY_CODES, width: 12,
    aliases: ["default currency"],
    description: "Three-letter currency code inherited by partners in this group. Blank means USD.",
    ref: { format: "Set value", validValues: "ISO code from the Valid Values sheet", example: "USD" },
    example1: "USD", example2: "SEK",
  },
  {
    key: "creditEnforcement", label: "Credit Enforcement", kind: "select", options: labels(CREDIT_ENFORCEMENT), width: 18,
    aliases: ["enforcement"],
    description: "What happens when a partner in this group reaches its credit limit. Blank means None.",
    ref: { format: "Set value", validValues: listOf(labels(CREDIT_ENFORCEMENT)), example: "Soft Warning" },
    example1: "Soft Warning", example2: "None",
  },
  {
    key: "maxCreditLimit", label: "Max Credit Limit", kind: "number", min: 0, width: 16,
    aliases: ["credit limit", "max credit"],
    description: "Default credit limit amount, 0 or more. Non-numeric values block the row.",
    ref: { format: "Number, 0 or more", example: "100000" },
    example1: "100000", example2: "",
  },
  {
    key: "warningThreshold", label: "Warning Threshold (%)", kind: "number", min: 0, max: 100, width: 20,
    aliases: ["warning threshold", "threshold"],
    description: "Percentage of the credit limit at which a warning is raised, 0 to 100.",
    ref: { format: "Number, 0 to 100", example: "80" },
    example1: "80", example2: "",
  },
  {
    key: "paymentTerm", label: "Payment Term", kind: "select", options: names(PAYMENT_TERM_PRESETS), width: 26,
    aliases: ["payment terms", "default payment term"],
    description: "The name of a payment term preset inherited by partners in this group.",
    ref: { format: "Set value", validValues: "Payment term preset names, see Valid Values", example: "Net 30" },
    example1: "Net 30", example2: "Net 45 Post Delivery",
  },
  {
    key: "pricingRules", label: "Pricing Rules", kind: "multiselect", options: names(PRICING_RULE_PRESETS), width: 34,
    aliases: ["pricing rule", "default pricing rules"],
    description: "Pricing rule preset names inherited by partners in this group.",
    ref: { format: "Text, pipe-separated", validValues: "Pricing rule preset names, see Valid Values", example: "[ Standard Discount, Value (Single-Tier) | Tiered Discount, Value (Multi-Tier) ]" },
    example1: "Standard Discount, Value (Single-Tier)|Tiered Discount, Value (Multi-Tier)", example2: "",
  },
  {
    key: "paymentMethods", label: "Payment Methods", kind: "multiselect", options: labels(PAYMENT_METHODS), width: 22,
    aliases: ["payment method", "default payment methods"],
    description: "Accepted payment method types inherited by partners in this group.",
    ref: { format: "Set value, pipe-separated", validValues: listOf(labels(PAYMENT_METHODS)), example: "[ ACH | Wire | Card ]" },
    example1: "ACH|Wire|Card", example2: "Wire",
  },
  {
    key: "carriers", label: "Carriers", kind: "multiselect", options: labels(CARRIERS), width: 22,
    aliases: ["carrier", "default carriers"],
    description: "Preferred shipping carriers inherited by partners in this group. The first one becomes the default.",
    ref: { format: "Set value, pipe-separated", validValues: listOf(labels(CARRIERS)), example: "[ FedEx | UPS ]" },
    example1: "FedEx|UPS", example2: "DHL",
  },
];

export const PARTNER_GROUPS_DATA = {
  entity: "Partner Groups",
  entitySingular: "Partner Group",
  nounLower: "partner group",
  nounPluralLower: "partner groups",
  moduleSlug: "partner-groups",
  moduleLine: "Omne Pioneer  ·  Partners Management",
  fileBase: "Omne_Partner_Groups_Import_Template",
  guideFile: "Omne_Partner_Groups_Import_Guide.txt",
  keyColumn: "groupName",
  freezeColumns: 1,
  uploadPath: "Partners Management, Partner Groups, Actions, Import Partner Groups",
  columns: GROUP_COLUMNS,
  frSubtitle: "Every column explained. The red row is required and cannot be left blank.",
  instructions: {
    quickStart: [
      "Go to the Data Entry sheet. That is where you enter your partner groups, one group per row.",
      "Review the two example rows. They show the expected format for each column. Delete them before you import.",
      "Enter your groups. The one required column has a red header and cannot be left blank: Group Name.",
      "Status, Country, and Group Scope are optional. What a blank value means depends on whether the group is new or already exists. See How Partner Groups Are Matched below.",
      "For columns that can hold a list, such as Group Scope, Linked Partners, Pricing Rules, and Carriers, separate each value with a pipe character ( | ). The pipe is on most keyboards above the backslash key, typed with Shift. Example: [ Vendor | Customer ].",
      "Save the file, then upload it in Omne under Partners Management, Partner Groups, Actions, Import Partner Groups.",
    ],
    sections: [
      {
        heading: "How Partner Groups Are Matched",
        intro: "Omne matches each row by Group Name, then decides whether to create a new group or update an existing one. Matching is not case sensitive and ignores surrounding spaces.",
        items: [
          ["New Group", "The name is not in Omne yet, so a new group is created. Status: blank means Active. Billing Type: blank means Domestic. Currency: blank means USD. Credit Enforcement: blank means None."],
          ["Existing Group", "The name already belongs to a group, so that group is updated. Any blank cell leaves the existing value unchanged. Only the Group Name is required on an update row."],
          ["Group Name", "The name is the matching key and is never changed by an import. A different spelling is treated as a different group."],
        ],
      },
      { heading: "Copying from Another System", intro: COPY_FROM_OLD_SYSTEM },
      {
        heading: "Important Notes",
        items: [
          ["Linked Partners", "Each name must match a partner that already exists in Omne. Unknown names import with a warning and are dropped. Primary Partners must be a subset of Linked Partners."],
          ["Group Scope", "Vendor, Customer, or both, separated with a pipe. Vendor Profiles apply only when the scope includes Vendor and Customer Profiles only when it includes Customer."],
          ["Credit Limit", "Max Credit Limit must be 0 or more and Warning Threshold must be between 0 and 100. A non-numeric value blocks the row."],
          ["Currency, Payment Term, Pricing Rules", "Use the exact names from the Valid Values sheet. An unknown value imports with a warning and the group keeps its default."],
          ["File Limits", FILE_LIMITS],
          ["Empty Cells", EMPTY_CELLS],
        ],
      },
    ],
  },
  compareTable: {
    heading: "New Group vs Existing Group",
    colHeaders: ["For a New Group (Name Not in Omne)", "For an Existing Group (Name Already in Omne)"],
    rows: [
      ["The Row", "Creates a new partner group.", "Updates the existing group. The name is never changed by the import."],
      ["Blank Cell", "Fields left blank are simply empty on the new group, or take the default noted below.", "A blank cell leaves the existing value unchanged."],
      ["Status", "Blank means Active.", "Blank keeps the current status."],
      ["Linked Partners", "Blank creates the group with no members.", "Blank keeps the current members. A value replaces them."],
      ["Template Defaults", "Billing Type Domestic, Currency USD, Credit Enforcement None when blank.", "Blank keeps the current template values."],
    ],
    mergedLast: ["Archived", "If the name belongs to an archived group, the row updates that group but does not restore it. Unarchive it from the listing afterwards if needed."],
  },
  validValues: [
    {
      heading: "New and Existing Groups",
      subHeader: ["Case", "What the Import Does"],
      rows: [
        ["New Name", "Creates a new partner group. Blank Status means Active. Blank template values take the defaults."],
        ["Existing Name", "Updates the group. Blank cells keep existing values. Only Group Name is required."],
      ],
    },
    { heading: "Status", subHeader: ["Value", "What It Means"], rows: [["Active", "Available when creating new vendors or customers."], ["Inactive", "Hidden from the create flow. Existing partners keep the settings they inherited."], ["(blank)", "New group: Active. Existing group: unchanged."]], note: "Archived is set by Omne from the listing, not from this file." },
    { heading: "Group Scope", subHeader: ["Value", "What It Means"], rows: [["Vendor", "The template applies to vendors."], ["Customer", "The template applies to customers."], ["(blank)", "No preselected scope. The defaults can still be configured."]] },
    { heading: "Vendor Profiles", subHeader: ["Value", "What It Means"], rows: VENDOR_SUB_TYPES.map((s) => [s.label, s.id === "vendor_rules" ? "The base vendor profile." : s.id === "carrier" ? "Partners in the group also act as shipping carriers." : "Coming soon in Omne. Accepted and stored, not yet configurable."]) },
    { heading: "Customer Profiles", subHeader: ["Value", "What It Means"], rows: CUSTOMER_SUB_TYPES.map((s) => [s.label, s.id === "customer_rules" ? "The base customer profile." : "Coming soon in Omne. Accepted and stored, not yet configurable."]) },
    { heading: "Country", subHeader: ["Value", "What It Means"], rows: [["Country Name", listOf(names(GROUP_COUNTRIES))]] },
    { heading: "Billing Type", subHeader: ["Value", "What It Means"], rows: [["Domestic", "Partners in the group are billed domestically."], ["International", "Partners in the group are billed internationally."], ["(blank)", "Domestic."]] },
    { heading: "Currency", subHeader: ["Value", "What It Means"], rows: [["ISO Code", listOf(CURRENCY_CODES)], ["(blank)", "USD."]] },
    { heading: "Credit Enforcement", subHeader: ["Value", "What It Means"], rows: [["None", "No credit limit is enforced."], ["Soft Warning", "Transactions past the limit go through with a warning."], ["Hard Block", "Transactions past the limit are blocked."], ["(blank)", "None."]] },
    { heading: "Payment Term", subHeader: ["Value", "What It Means"], rows: PAYMENT_TERM_PRESETS.map((p) => [p.name, `Payment term preset ${p.id}.`]) },
    { heading: "Pricing Rules", subHeader: ["Value", "What It Means"], rows: PRICING_RULE_PRESETS.map((p) => [p.name, `Pricing rule preset ${p.id}.`]) },
    { heading: "Payment Methods", subHeader: ["Value", "What It Means"], rows: PAYMENT_METHODS.map((m) => [m.label, m.typeLabel]) },
    { heading: "Carriers", subHeader: ["Value", "What It Means"], rows: CARRIERS.map((c) => [c.label, c.name]) },
    { heading: "Lists (Group Scope, Profiles, Linked Partners, Primary Partners, Pricing Rules, Payment Methods, Carriers)", note: "These columns can hold more than one value. Separate each value with a pipe character ( | ), found above the backslash key using Shift. Example: [ Vendor | Customer ]. For Linked Partners and Primary Partners, each name must match a partner that already exists in your Omne instance, and matching is not case sensitive." },
  ],
  guide: {
    intro: [
      "This guide explains how to fill in the Partner Groups import CSV. It covers the steps, every column, and what the import does for a new group and an existing group.",
      "The CSV has 1 required column and 17 optional ones.",
    ],
    quickStart: [
      "Open the CSV. The first row is the column headers. Each row below it is one partner group.",
      "Two example rows are included to show the expected format. Delete both before you import.",
      "Fill in your groups. The one required column is marked with an asterisk and cannot be left blank: Group Name.",
      "Status, Country, and Group Scope are optional. What a blank value means depends on whether the group is new or already exists. See How Partner Groups Are Matched below.",
      "For columns that can hold a list, such as Group Scope, Linked Partners, Pricing Rules, and Carriers, separate each value with a pipe character ( | ). The pipe is on most keyboards above the backslash key, typed with Shift. Example: [ Vendor | Customer ]",
      "Save the file, then upload it in Omne under Partners Management, Partner Groups, Actions, Import Partner Groups.",
    ],
    matchedSections: [
      {
        title: "For a New Group (Name Not in Omne)",
        lead: "A new partner group is created.",
        items: [
          ["Status", "Blank means Active."],
          ["Template", "Billing Type Domestic, Currency USD, and Credit Enforcement None when blank."],
          ["Members", "Linked Partners are attached by name; unknown names are dropped with a warning."],
        ],
      },
      {
        title: "For an Existing Group (Name Already in Omne)",
        lead: "The matching group is updated with the values you provide. A blank cell leaves the existing value unchanged.",
        items: [
          ["Status", "Blank keeps the current status."],
          ["Members", "Linked Partners replace the current members when given."],
        ],
      },
    ],
    fieldGroups: [
      { title: "Required Column", keys: ["groupName"] },
      { title: "Identity", keys: ["status", "country", "description", "scope", "defaultVendorSubTypes", "defaultCustomerSubTypes"] },
      { title: "Members", keys: ["memberIds", "primaryMemberIds"] },
      { title: "Template Configuration", keys: ["billingType", "currency", "creditEnforcement", "maxCreditLimit", "warningThreshold", "paymentTerm", "pricingRules", "paymentMethods", "carriers"] },
    ],
  },
  examples: [
    GROUP_COLUMNS.map((c) => c.example1),
    GROUP_COLUMNS.map((c) => c.example2),
  ],
};

export const ALL_ENTITY_DATA = [PARTNERS_DATA, PARTNER_GROUPS_DATA];
