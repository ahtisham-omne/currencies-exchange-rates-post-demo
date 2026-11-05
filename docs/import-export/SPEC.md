# Omne Import / Export: source spec and port contract

Written 2026-09-29 from role-zen @ 2d4b48ea (User Access Control, Users flow). This is the index
for mirroring the Users Import/Export experience into other Omne modules. The user's acceptance
test is "exact": functions, interaction and styling must match User Access Control.

## 1. Source extracts (read these, do not reopen role-zen)

| File | Covers | Size |
|---|---|---|
| `export-modal.md` | Actions ▾ menu, Export Users modal (format cards, columns list with drag reorder, tri-state select, Full View), PDF/XLSX/CSV generation, filenames, toasts, bulk-bar export | 2,867 lines |
| `import-wizard.md` | Import Users modal (template card, +N more hover, dropzone states, description, discard confirm), the uploaded-file ATTACHMENT CARD (uploadedFileCard.tsx) exhaustively, parser contract and error strings, Reading Room guide drawer | 908 lines |
| `template-and-validation.md` | The 4-sheet xlsx standard reverse-engineered cell by cell, a reconstructed ExcelJS generator parameterised by an entity spec, CSV + Guide txt formats, fileParser.ts, validation.ts rules, filename conventions | 2,139 lines |
| `review-modal-ui.md` | "Review and Fix Your Data" structure and styling: header, search, density, chips, table (sticky cols, tints, pills, tooltips), editors, pagination, importing overlay, Import Complete card, CorrectionBanner, tokens, z-index ladder | 518 lines |
| `review-modal-logic.md` | State model, filters, sort, pagination, row menu (Duplicate, Revert, Skip, Delete), bulk bar (Set X, Delete Rows), Skip N error rows, editing keys, revalidation, Start Import gating, 2400 ms progress ramp, completion counts, storage keys, listing merge, corrections loop, discard guard | 620 lines |
| `import-history-and-sheet-import.md` | Import history routes/pages/data layer, record detail page, downloads, correction strip; assessment of the generic sheet-import cluster | 562 lines |

Screenshots the user supplied: `_crossref/context/role-zen/2026-09-29-*.png` (Actions menu, Export modal, Import modal, Review with roles dropdown, Importing overlay, Import Complete).

## 2. Port base decision

Port the **Users** flow (ImportReviewModal.tsx + ImportSetupStep/ImportWizardModal + ExportUsersModal + importHistory/importDetailStore/importRecords + ImportRecordDetailPage), NOT the `sheet-import/` cluster. sheet-import is a reduced second UI for two-level Quotes/Sales Orders sheets and lacks ~40 behaviours the user sees in Users (frozen Result column, sort, keyboard cell nav, edited-cell triangle + Revert, Duplicate Row, right-click menu, bulk set/delete, Skip N error rows, issue tooltips with examples, importing overlay, Import Complete card with deep links, correction loop). Lift only its `SheetImportSpec`-style contract idea: every entity-specific thing becomes one spec object.

## 3. What is generic vs entity-specific

Generic (copy the mechanics verbatim, re-express styling in the target's tokens):
- Actions ▾ trigger + two items (Import / Export), gated only if the target has permission gating.
- Export modal shell, format cards, columns list (drag reorder, move to top/bottom, search, tri-state), Full View, count banner, CTA label per format, toasts, filename `<Entity>_Export_YYYY-MM-DD.<ext>`.
- Import wizard shell (portal, spring), template card, dropzone (6 states), AttachmentCard + UploadingCard, description textarea, discard confirm, Review Data gating, parser error toasts.
- Review modal: everything in review-modal-ui.md and review-modal-logic.md.
- Import run overlay, Import Complete dialog, history record + detail page, corrections loop, storage keys (namespaced per module).
- Template workbook layout (4 sheets, styles, freeze panes, 600 rows, red required headers, grey optional headers, italic examples), CSV (UTF-8 no BOM, " *" on required), Guide txt.

Entity-specific (one spec object per entity; see section 4):
- Nouns: "Users" -> "Categories" / "Items" / "Partners" / "Partner Groups" (title, subtitle, "Importing N categories...", "Categories Created / Updated", "View Categories Listing").
- Columns: label, key, required, type, valid values, example values, description (tooltip copy), width, editor kind (text / select / multi-select with groups / date / number / yes-no).
- Natural key for new-vs-existing (Users: email). Categories: Category Code. Items: Part Number. Partners: Partner Name. Partner Groups: Group Name. Match is trimmed, case-insensitive.
- Validation rules: required-empty, duplicate-in-file, invalid option, not-found reference (categories, partners, groups, users, locations), numeric range, conditional required. Severity follows Users: required/invalid identity = error; missing optional enum / unknown reference that can be blanked = warning.
- Store mappers: review row -> new record, review row -> update patch, and the listing merge (prepend, stamp createdBy/createdOn from the module's current user, status default).
- Routes: `<listing>/imports` and `<listing>/imports/:importId` for history; deep links with `?filter=imported|failed`.
- Bulk-set fields in the review bulk bar (Users: License, Status). Each entity: Status plus its second most common enum.

## 4. Entity specs

### 4.1 Categories (radiant-core-fusion, /categories)
Key: Category Code. Required: Category Code. 12 columns.

| # | Header | Key | Type / editor | Required | Valid values | Default | Rule | Why (from Create New Category) |
|---|---|---|---|---|---|---|---|---|
| 1 | Category Code | code | text | yes | free text, e.g. C-1021 | | unique (trim, case-insens.) among categories and within file: duplicate = error; existing code = Update | Step 1 identifier; items reference it |
| 2 | Status | status | select | no | Active, Inactive | Active | invalid = warning, falls back to Active | Step 1 lifecycle pill |
| 3 | Description | description | text | no | <= 5000 chars | | over cap = error | Step 1 |
| 4 | Tags | tags | text, "\|" separated | no | each <= 30 chars | | trimmed, deduped; tag > 30 = warning (truncated) | Step 1 |
| 5 | Inventory Type | inventoryType | select | no | Stock, Non-stock, Asset | Stock | invalid = warning | Step 2 configuration |
| 6 | Control Type | controlType | select | no | Serialized, Non-Serialized | Non-Serialized | invalid = warning | Step 2 |
| 7 | Lot Tracking | lotControlEnabled | yes/no | no | Yes, No | No | invalid = warning | Step 2 toggle |
| 8 | Lot ID Assignment | lotIdSource | select | only when Lot Tracking = Yes | System Generated, Vendor Lot | System Generated | value with Lot Tracking = No -> warning (ignored) | Step 2 radio |
| 9 | Base Unit of Measure | uom | select (65 unit names, grouped by category) | no | allUnitNames() | Each | unknown unit = error | Step 2 |
| 10 | Alternative Units | alternativeUnits | text "Unit=factor\|Unit=factor" | no | unit from another UOM category than base; factor > 0 | | bad pair = error | Step 2 |
| 11 | Acquisition Method | acquisitionMethods | multi-select "\|" | no | Purchased, Manufactured (>= 1) | Purchased | invalid = warning | Step 2 |
| 12 | Primary Acquisition | primaryAcquisition | select | only when both methods | Purchased, Manufactured | sole method | value not in Acquisition Method = warning | Step 2 star |

System fields (never imported, exported only): Created By, Created On, No. of Items.
Export fields (for Columns to Include): Category Code (locked), Description, Tags, No. of Items, Created By, Created On, Status, then the 8 configuration fields. Default checked = listing's visible columns.
Bulk-set in review: Status, Inventory Type.

### 4.2 Items (nimble-palette, /items)
Key: Part Number. Required: Part Number, Primary Category. 39 columns.

| # | Header | Key | Type / editor | Required | Valid values | Default | Rule | Why (from Create New Item) |
|---|---|---|---|---|---|---|---|---|
| 1 | Part Number | partNumber | text | yes | free text | | unique (trim, case-insens.) among items and in file; existing = Update | Step 2 identifier |
| 2 | Description | description | text | no | <= 5000 | | over cap = error | Step 2 |
| 3 | Status | status | select | no | Active, Inactive | Active | invalid = warning | Step 2 |
| 4 | Tags | tags | "\|" list | no | free text, deduped | | | Step 2 |
| 5 | Primary Category | primaryCategory | select (category codes C-1001..C-1050 + seed names) | yes | catalog codes | | not found = error | Step 1, toast blocks save without it |
| 6 | Additional Categories | additionalCategories | multi "\|" | no | catalog codes != primary | | unknown = warning (dropped); equals primary = warning | Step 1 |
| 7 | Inventory Type | inventoryType | select | no | Stock, Non-stock, Asset | Stock | | Definition tab |
| 8 | Inventory Control | inventoryControlType | select | no | Serialized, Non-Serialized | Non-Serialized | | Definition tab |
| 9 | Lot Tracking | lotControl | yes/no | no | Yes, No | No | | Definition |
| 10 | Lot ID Assignment | lotIdSource | select | cond (Lot Tracking Yes) | System Generated, Vendor Lot | System Generated | | Definition |
| 11 | Shelf Life | shelfLifeValue | number | no | >= 0 | | non-numeric = error | Definition |
| 12 | Shelf Life Unit | shelfLifeUnit | select | cond (Shelf Life set) | Days, Months, Years | Days | | Definition |
| 13 | Base Unit of Measure | unit | select (65 names) | no | allUnitNames() | Each | unknown = error | Definition |
| 14 | Alternative Units | alternativeUnits | "Unit=factor\|..." | no | other UOM category; factor > 0 | | bad pair = error | Definition |
| 15 | Acquisition Method | acquisitionMethods | multi "\|" | no | Purchased, Manufactured | Purchased | | Definition |
| 16 | Primary Acquisition | primaryAcquisition | select | cond (both) | Purchased, Manufactured | sole | | Definition |
| 17 | Min Level | minStock | number | no | >= 0 | 10 | min >= max = error "Min level must be less than max level" | Stock & Logistics |
| 18 | Max Level | maxStock | number | no | >= 0 | 1000 | | Stock & Logistics |
| 19 | Inbound Locations | inboundLocations | multi "\|" | no | LOCATIONS list | Warehouse A - Main Hall | unknown = warning | Stock & Logistics; first = default |
| 20 | Outbound Locations | outboundLocations | multi "\|" | no | LOCATIONS | Warehouse A - Main Hall | | Stock & Logistics |
| 21 | Receiving Staging Locations | receivingStagingLocation | multi "\|" | no | LOCATIONS | | | Stock & Logistics |
| 22 | Shipping Staging Locations | shippingStagingLocation | multi "\|" | no | LOCATIONS | | | Stock & Logistics |
| 23 | Min Order Qty | minPurchase | number | no | >= 0 | 50 | | Procurement |
| 24 | Max Order Qty | maxPurchase | number | no | >= min | 5000 | | Procurement |
| 25 | Order Multiples | multiples | number | no | > 0 | 10 | | Procurement |
| 26 | PO Recommendation Rule | shortageRule | select | no | Demand, Min, Zero, Off | Demand | | Procurement |
| 27 | Selling Scope | sellingScope | select | no | All, Specific | All | | Selling |
| 28 | Specific Partners | specificPartners | multi "\|" | cond (Specific) | AVAILABLE_VENDORS names | | unknown = warning | Selling |
| 29 | Custom Price Per Unit | pricing | "price Unit\|price Unit" | no | decimal + UOMS | 0.00 Each | bad = error | Selling |
| 30 | Inventory Valuation | valuationMethod | select | no | FIFO, LIFO, WAC, Specific | FIFO | | Governance |
| 31 | Material Handling Owners | owners.materialHandling | multi "\|" | no | MOCK_USERS names | | unknown = warning | Governance |
| 32 | Purchasing Owner | owners.purchasing | select | no | MOCK_USERS | | | Governance |
| 33 | Finance Owner | owners.finance | select | no | MOCK_USERS | | | Governance |
| 34 | Acceptable Variance (%) | cycleTolerance | number | no | >= 0 | 0 | | Material Handling |
| 35 | Approvers | approvers | multi "\|" | no | MOCK_APPROVERS | | | Material Handling |
| 36 | Location Scan | scanLocation | yes/no | no | Yes, No | No | | Material Handling |
| 37 | Item Scan | scanItem | yes/no | no | Yes, No | No | | Material Handling |
| 38 | Lot Scan | scanLot | yes/no | no | Yes, No | No | only meaningful with Lot Tracking | Material Handling |
| 39 | Serial Scan | scanSerial | yes/no | no | Yes, No | No | only when Serialized, else warning | Material Handling |

System fields: On-Hand Qty (0 on create), Created By, Created On, Owner. Image is not importable.
Export fields: the 14 listing columns (Part Number locked) then the remaining import fields. Default checked = visible listing columns.
Bulk-set: Status, Inventory Control.
Note: `addItem` drops tags/valuationMethod; the importer must call `updateItem` after or extend the context.

### 4.3 Partners (partner-management-module, /vendors)
Key: Partner Name. Required: Partner Name, Primary Partner Group. 20 columns.

| # | Header | Key | Type / editor | Required | Valid values | Default | Rule | Why (from Create New Partner) |
|---|---|---|---|---|---|---|---|---|
| 1 | Partner Name | partnerName | text | yes | free text | | unique (trim, case-insens.) vs displayName/companyName and in file; existing = Update | Step 2 identity |
| 2 | Status | status | select | no | Active, Inactive | Active | | Step 2 |
| 3 | Partner Groups | partnerGroups | multi "\|" | no | existing group names (PARTNER_GROUPS + session) | | unknown = error | Step 1 group picker |
| 4 | Primary Partner Group | primaryPartnerGroup | select | yes | one of Partner Groups | first listed | not in Partner Groups = error | Step 1 Continue is blocked without a primary |
| 5 | Partner Type | partnerTypes | multi "\|" | no | Vendor, Customer | inherited from primary group scope | invalid = warning | Step 2 pills |
| 6 | Vendor Sub-Types | vendorSubTypes | multi "\|" | no | Vendor Rules, Carrier, Online Vendor, In-Store Vendor, Sub Contractor, Service Provider | | value without Vendor type = warning | Step 3 rail |
| 7 | Customer Sub-Types | customerSubTypes | multi "\|" | no | Customer Rules, Wholesale Buyer, Distributor, End Consumer, B2B Client, Reseller | | | Step 3 rail |
| 8 | Phone Country Code | phoneCode | select | no | COUNTRY_CODES (+1 United States ... +48 Poland) | +1 | unknown = warning | Step 2 |
| 9 | Phone Number | phone | text | no | digits, spaces, ( ) - | | invalid = warning | Step 2 |
| 10 | Email | email | text | no | email format | | invalid = error | Step 2 |
| 11 | Website | website | text | no | url-ish | | | Step 2 |
| 12 | Address | address | text | no | free text | | | Step 2 |
| 13 | Description | description | text | no | free text | | | Step 2 |
| 14 | Points of Contact | pointsOfContact | multi "\|" | no | CONTACT_DICTIONARY names | | unknown = warning | Step 2/3 |
| 15 | Currency | currency | select | no | CURRENCY_OPTIONS codes (USD, EUR, ...) | from group, else USD | unknown = warning | Step 3 Billing |
| 16 | Credit Enforcement | creditEnforcement | select | no | None, Soft Warning, Hard Block | None | | Step 3 |
| 17 | Payment Term | paymentTerm | select | no | PAYMENT_TERM_PRESETS names | from group | unknown = warning | Step 3 |
| 18 | Pricing Rules | pricingRules | multi "\|" | no | pr-1..pr-8 names | from group | unknown = warning | Step 3 |
| 19 | Payment Methods | paymentMethods | multi "\|" | no | ACH, Wire, Card, Digital Wallet, Check, Cash, Other | | | Step 3 |
| 20 | Carriers | carriers | multi "\|" | no | FedEx, TCS, DHL, UPS, SF, USPS, Aramex, Maersk, Customer Pickup, Vendor Pickup | | unknown = warning | Step 3 Freight |

Export fields: the 22 listing columns (Partners locked) then remaining import fields. Bulk-set: Status, Partner Type.

### 4.4 Partner Groups (partner-management-module, /partners/groups)
Key: Group Name. Required: Group Name. 18 columns.

| # | Header | Key | Type / editor | Required | Valid values | Default | Rule | Why (from Create New Group) |
|---|---|---|---|---|---|---|---|---|
| 1 | Group Name | groupName | text | yes | free text | | unique (trim, case-insens.) vs groups and in file; existing = Update | Identity step |
| 2 | Status | status | select | no | Active, Inactive | Active | | Identity |
| 3 | Country | country | select | no | GROUP_COUNTRY_OPTIONS (45) | | unknown = warning | Identity; pre-fills partner country |
| 4 | Description | description | text | no | <= 5000 | | over cap = error | Identity |
| 5 | Group Scope | scope | multi "\|" | no | Vendor, Customer | | invalid = warning | Identity pills |
| 6 | Vendor Profiles | defaultVendorSubTypes | multi "\|" | no | vendor sub-type labels | | | Template rail |
| 7 | Customer Profiles | defaultCustomerSubTypes | multi "\|" | no | customer sub-type labels | | | Template rail |
| 8 | Linked Partners | memberIds | multi "\|" | no | existing partner names | | unknown = warning (dropped) | Add Partners step |
| 9 | Primary Partners | primaryMemberIds | multi "\|" | no | subset of Linked Partners | | not linked = warning | Add Partners star |
| 10 | Billing Type | billingType | select | no | Domestic, International | Domestic | | Template config |
| 11 | Currency | currency | select | no | CURRENCY_OPTIONS | USD | | Template |
| 12 | Credit Enforcement | creditEnforcement | select | no | None, Soft Warning, Hard Block | None | | Template |
| 13 | Max Credit Limit | maxCreditLimit | number | no | >= 0 | | non-numeric = error | Template |
| 14 | Warning Threshold (%) | warningThreshold | number | no | 0-100 | | out of range = error | Template |
| 15 | Payment Term | paymentTerm | select | no | preset names | | | Template |
| 16 | Pricing Rules | pricingRules | multi "\|" | no | pr names | | | Template |
| 17 | Payment Methods | paymentMethods | multi "\|" | no | ACH, Wire, Card, Digital Wallet, Check, Cash, Other | | | Template |
| 18 | Carriers | carriers | multi "\|" | no | carrier names | | | Template |

Export fields: the 11 listing columns (Partner Groups locked) then remaining import fields. Bulk-set: Status, Group Scope.

## 5. Files each target gets (mirror of the source layout, one folder per module)

```
src/<module>/import-export/
  spec.ts                 entity spec: nouns, columns, valid values, examples, key, validators, bulk-set fields, routes
  templateWorkbook.ts     ExcelJS 4-sheet generator from template-and-validation.md section 1.6 (parameterised by spec)
  templateCsv.ts          CSV + Guide txt text from spec
  fileParser.ts           port of import-review/fileParser.ts (sheet pick, header scan, aliases, CSV)
  validation.ts           port of validation.ts, rules from spec
  export.ts               port of users-export.ts (jspdf+autotable, exceljs, csv, filename)
  importHistory.ts        port of importHistory.ts + importDetailStore.ts + importRecords.ts (localStorage keys namespaced omne:<module>:import-*)
  ActionsMenu.tsx         Actions ▾ (Import / Export)
  ExportModal.tsx         port of ExportUsersModal.tsx
  ImportWizardModal.tsx   port of ImportWizardModal + ImportSetupStep + uploadedFileCard (AttachmentCard, UploadingCard)
  ImportReviewModal.tsx   port of ImportReviewModal.tsx (+ CellIssueTooltip, CellInput, editors, ImportCompleteDialog, CorrectionBanner)
  ImportHistoryPage.tsx   port of DataImportDetailPage (records table for this module)
  ImportRecordPage.tsx    port of ImportRecordDetailPage (rows, outcomes, downloads, corrections)
public/templates/Omne_<Entity>_Import_Template.xlsx / .csv / Omne_<Entity>_Import_Guide.txt   (generated once by a scripts/gen-import-templates.mjs, checked in, byte-identical to what the in-app generator produces)
```

Dependencies to add where missing: exceljs ^4.4.0, jspdf ^4.2.1, jspdf-autotable (same versions as role-zen; install with --legacy-peer-deps).

## 6. The verifiable checklist

Every target repo carries `docs/import-export/CHECKLIST.md`, a copy of `CHECKLIST.md` beside this file with the entity's columns filled in. Each line is ticked only after it is verified in the running app (Playwright or manual), and the side-by-side screenshot against role-zen on :8087 is saved to `_crossref/context/<repo>/`.
