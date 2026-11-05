# Items Import / Export, data layer (phase 1)

Port of the User Access Control (role-zen) Users import/export pipeline onto the Items module, per
`docs/import-export/SPEC.md` section 4.2 (39 columns, key = Part Number, required = Part Number +
Primary Category). No UI in this phase; everything here is what `ActionsMenu`, `ExportModal`,
`ImportWizardModal`, `ImportReviewModal`, `ImportHistoryPage` and `ImportRecordPage` will call.

```
spec.data.mjs        raw entity data (plain ESM, no imports): columns, enums, examples, template copy, option SNAPSHOTS
spec.data.d.mts      its types
templateLayout.mjs   the 4-sheet workbook / CSV / Guide txt builders (plain ESM, shared with scripts/gen-import-templates.mjs)
templateLayout.d.mts its types
helpers.ts           pure vocabulary helpers (splitPipe, parseYesNo, matchOption, ...)
spec.ts              ITEMS_IMPORT_SPEC: the typed EntitySpec, options read LIVE from the app constants
templateWorkbook.ts  buildTemplateWorkbook(spec) (+ buffer / blob), dynamic exceljs
templateCsv.ts       buildTemplateCsv(spec), buildGuideText(spec) (+ blobs)
fileParser.ts        parseImportFile(file) -> ItemReviewRow[]
validation.ts        validateRows(rows, ctx) -> per-cell issues, per-row status, isUpdate
mappers.ts           reviewRowToItem / reviewRowToPatch / itemToReviewRow
export.ts            exportItems(rows, fields, format) -> filename (pdf / xlsx / csv)
importHistory.ts     history + detail + pending corrections + correction linking, keys omne:items:*
*.test.ts            vitest: options snapshot vs live, template byte-sync, parser, validation, export, store, history
```

Checked-in outputs (regenerate with `node scripts/gen-import-templates.mjs`): `public/templates/OMNE_Items_Import_Template.xlsx`,
`OMNE_Items_Import_Template.csv`, `OMNE_Items_Import_Guide.txt`. `template.test.ts` fails if they drift from the generator.

The store method lives in `src/app/context/ItemsContext.tsx`: `upsertImportedItems(rows, lookups?)`.

---

## spec.ts

```ts
type ItemReviewField = "partNumber" | "description" | ... | "scanSerial";   // the 39 column keys (dotted: "owners.materialHandling", "owners.purchasing", "owners.finance")
type ItemReviewRow = Record<ItemReviewField, string>;                        // every cell a string, lists pipe-joined
type ColumnKind = "text" | "select" | "multiselect" | "yesno" | "number" | "date";

interface SpecColumn {
  key: ItemReviewField; label: string; required: boolean; kind: ColumnKind;
  options: string[];                 // accepted file values ([] for free text)
  optionsGroups?: OptionGroup[];     // { label, options }[] (units grouped by UOM category)
  example1: string; example2: string;
  description: string;               // column-header tooltip copy
  width: number;                     // review-grid default width (px)
  aliases: string[];                 // normalised header names mapping to this column
  conditionalOn?: ItemReviewField;   // the column that makes this one meaningful
  group: string;                     // "Required columns" | "Identity" | "Categories" | "Item Definition" | ...
  defaultValue: string;              // what a blank takes on a new item
  text: boolean;                     // Excel numFmt "@" column
}

interface EntitySpec {
  nouns: { singular; plural; titleSingular; titlePlural; moduleSlug; moduleTitle; moduleLine };
  storageNamespace: "items";
  routes: { listing: "/items"; history: "/items/imports"; record: "/items/imports/:importId" };
  keyColumn: "partNumber";
  columns: SpecColumn[]; columnByKey: Record<ItemReviewField, SpecColumn>;
  requiredColumns: ItemReviewField[];               // ["partNumber", "primaryCategory"]
  bulkSetFields: ItemReviewField[];                 // ["status", "inventoryControlType"]
  exportFields: ExportField[];                      // 14 listing columns first (part_number locked), then the remaining import fields
  templateHeaders: string[];                        // header row exactly as shipped ("Part Number *", ...)
  headerDetectNorms: string[];                      // ["part number"]
  headerAliases: Record<string, ItemReviewField>;   // normalised header -> column
  files: { xlsx; csv; guide; exportStem };          // OMNE_Items_Import_Template.xlsx / .csv, OMNE_Items_Import_Guide.txt, Items_Export
  template: TemplateModel;                          // resolved copy for the 4 sheets / CSV / guide
  descriptionMax: 5000;
  lookups: SpecLookups;                             // lower-cased -> canonical Maps: units, unitCategory, priceUnits, categories, locations, partners, users, approvers
}
interface ExportField { id: string; label: string; locked: boolean; listing: boolean; field?: ItemReviewField; system: boolean; date: boolean }

const ITEMS_IMPORT_SPEC: EntitySpec;
const ITEM_REVIEW_COLUMNS: { key; label; defaultWidth; description; required }[];   // review grid columns, template order
const EMPTY_ROW: Readonly<ItemReviewRow>;  function makeEmptyRow(): ItemReviewRow;
const LIVE_UNIT_NAMES, LIVE_LOCATIONS, LIVE_PARTNER_NAMES, LIVE_USER_NAMES, LIVE_APPROVER_NAMES, LIVE_CATEGORY_CODES, LIVE_PRICE_UNITS: string[];
function unitOptionGroups(): OptionGroup[];
// re-exported from spec.data.mjs: PIPE, VOCAB, ENUMS, DESCRIPTION_MAX, OPTION_SNAPSHOTS
// re-exported from helpers.ts:
function splitPipe(value: string): string[];               // trim, drop empties, case-insensitive dedupe
function joinPipe(values?: readonly string[] | null): string;
function normalizeKey(value?: string | null): string;       // trim + lower-case (the Part Number match rule)
function parseYesNo(value: string): boolean | null;         // yes/y/true/1, no/n/false/0
function matchOption(value: string, options: readonly string[]): string | null;   // case-insensitive, returns canonical
function canonical(value: string, known?: Map<string, string>): string | null;
function knownOnly(values: readonly string[], known?: Map<string, string>): string[];
```

## templateWorkbook.ts / templateCsv.ts

```ts
async function buildTemplateWorkbook(spec: EntitySpec): Promise<ExcelJS.Workbook>;   // 4 sheets: Data Entry, Instructions, Field Reference, Valid Values
async function buildTemplateWorkbookBuffer(spec): Promise<ArrayBuffer>;
async function buildTemplateWorkbookBlob(spec): Promise<Blob>;
const DATA_ENTRY_SHEET = "Data Entry"; const DATA_ROWS = 600; const FROZEN_COLUMNS = 3;

function buildTemplateCsv(spec: EntitySpec): string;      // header + 2 example rows, UTF-8 no BOM, LF, RFC-4180
function buildGuideText(spec: EntitySpec): string;        // 66-col wrap, "=" banner, "-" dividers, UAC section format
function buildTemplateCsvBlob(spec): Blob;  function buildGuideBlob(spec): Blob;
function wrapText(text: string, width?: number, indent?: number, firstIndent?: number): string[];
```

Download names: `spec.files.xlsx`, `spec.files.csv` (+ `spec.files.guide` 400 ms later, per UAC). The files under
`public/templates/` are byte-identical to these builders' output; serve them statically or build on the fly.

## fileParser.ts

```ts
type ParseErrorCode = "EMPTY" | "NO_HEADERS" | "NO_DATA" | "READ_FAILED" | "UNSUPPORTED";
class ImportFileParseError extends Error { code: ParseErrorCode }       // message = PARSE_MESSAGES[code], show verbatim in toast.error("Couldn't read this file", { description })
const PARSE_MESSAGES: Record<ParseErrorCode, string>;
interface ParseResult { rows: ItemReviewRow[]; rawRowCount: number; matchedFieldCount: number; headerRowIndex: number; unmatchedHeaders: string[] }

async function parseImportFile(file: File, spec?: EntitySpec): Promise<ParseResult>;   // .csv | .xlsx by extension
function gridToRows(grid: string[][], spec?: EntitySpec): ParseResult;                  // header scan (10 rows), aliases, blank rows
function parseCsvText(text: string): string[][];                                        // RFC-4180 (quotes, "" escapes, embedded commas/newlines, CRLF, BOM)
async function parseXlsxBuffer(buffer: ArrayBuffer): Promise<string[][]>;               // "Data Entry" sheet else first; dates -> YYYY-MM-DD
function planColumns(headerRow: string[], spec?): { direct: Map<number, ItemReviewField>; unmatched: string[] };
function normHeader(raw: string): string;  function cellToString(value: unknown): string;  function isRowBlank(values: string[]): boolean;
const HEADER_SCAN_LIMIT = 10;
```

## validation.ts

```ts
type IssueSeverity = "error" | "warning";
type IssueCode = "REQUIRED_EMPTY" | "DUPLICATE_KEY" | "TOO_LONG" | "CATEGORY_NOT_FOUND" | "ADDITIONAL_EQUALS_PRIMARY"
  | "INVALID_DROPDOWN" | "UNIT_NOT_FOUND" | "INVALID_ALT_UNIT" | "INVALID_NUMBER" | "RANGE_INVALID" | "INVALID_PRICE"
  | "CONDITIONAL_IGNORED" | "MISSING_CONDITIONAL" | "REFERENCE_NOT_FOUND";
interface CellIssue { field: ItemReviewField; severity; code; message: string; explanation: string; example?: string; options?: string[] }
type RowStatus = "ready" | "warning" | "error";
interface RowValidation { status: RowStatus; issues: CellIssue[]; byField: Partial<Record<ItemReviewField, CellIssue[]>>; isUpdate: boolean }
interface ValidationResult { rows: RowValidation[]; errorRowCount; warningRowCount; readyRowCount; updateRowCount; createRowCount }
interface ValidationContext {           // all lower-cased; a missing lookup skips that reference rule
  existingKeys?: Set<string>; knownCategories?, knownUnits?, knownPriceUnits?, knownLocations?, knownPartners?, knownUsers?, knownApprovers?: Map<string, string>;
  unitCategory?: Map<string, string>;   // canonical unit -> UOM category
}

function validateRows(rows: readonly ItemReviewRow[], ctx?: ValidationContext, spec?: EntitySpec): ValidationResult;
function buildValidationContext(items: readonly Item[], spec?: EntitySpec): ValidationContext;   // snapshot when the wizard opens (existing part numbers + catalog codes + category names in use)
function describeIssue(code: IssueCode): string;
```

Rules (SPEC.md 4.2): Part Number required + duplicate-in-file (error); isUpdate = trimmed, case-insensitive match
against `existingKeys`; Primary Category required on create rows and must exist (error); additional category unknown
or equal to primary (warning); enum values case-insensitive, unrecognised = warning with `options`; yes/no columns
accept yes/y/true/1 and no/n/false/0; unknown base unit (error); Alternative Units `Unit=factor` pairs, unknown
unit, factor <= 0, same UOM category as base (error); numbers must parse, >= 0 (error); Min Level < Max Level, Max
Order Qty >= Min Order Qty, Order Multiples > 0, Acceptable Variance 0..100 (error); conditional warnings for Lot ID
Assignment (needs Lot Tracking = Yes), Shelf Life Unit (needs Shelf Life), Primary Acquisition (must be a listed
method), Specific Partners (needs Selling Scope = Specific; Specific without partners also warns), Serial Scan
(needs Serialized); unknown locations / partners / users / approvers (warning, UAC phrasing); Custom Price Per Unit
`price Unit` pairs with a listed price unit (error); Description > 5000 (error). Blank optional cells never warn; on
update rows a blank driving column keeps the conditional rule silent.

## mappers.ts

```ts
interface MapperLookups { categories?, units?, priceUnits?, locations?, partners?, users?, approvers?: Map<string, string> }   // = spec.lookups
interface MapperActor { currentUserId: string; currentUserName: string }

function reviewRowToItem(row: ItemReviewRow, actor: MapperActor, lookups?: MapperLookups): Omit<Item, "id" | "createdAt" | "updatedAt">;
    // all 39 columns onto Item (+ the optional configuration fields); blanks take the Create New Item defaults;
    // status default Active, onHandQty 0, images [placeholder], createdBy = actor name, ownerId = actor id, manufacturer "Internal", mpn = part number
function reviewRowToPatch(row: ItemReviewRow, existing: Item, lookups?: MapperLookups): Partial<Item>;   // only filled columns; Part Number never written
function itemToReviewRow(item: Item): ItemReviewRow;      // Item -> file vocabulary (Yes/No, pipe lists, Unit=factor, price Unit); export + round trip
function parseAlternativeUnits(value: string, units?: Map<string, string>): { id; unit; conversionFactor }[];
function parsePricing(value: string, priceUnits?: Map<string, string>): { id; price; uom }[];
```

## ItemsContext.tsx (store)

```ts
const CURRENT_USER_ID = "user-123";  const CURRENT_USER_NAME = "Ahtisham Ahmad";
interface Item { ...existing fields..., inventoryType?, lotIdSource?, shelfLifeValue?, shelfLifeUnit?, alternativeUnits?, minStock?, maxStock?,
  defaultInboundLocation?, defaultOutboundLocation?, receivingStagingLocation?, shippingStagingLocation?, minPurchase?, maxPurchase?, multiples?,
  shortageRule?, sellingScope?, specificPartners?, pricing?, owners?, cycleTolerance?, approvers?, scanLocation?, scanItem?, scanLot?, scanSerial? }
interface UpsertImportedResult { created: number; updated: number; createdIds: string[]; updatedIds: string[] }
upsertImportedItems(rows: ItemReviewRow[], lookups?: MapperLookups): UpsertImportedResult;   // one state update: patches by part number, new items prepended
addItem(...)   // now keeps tags, valuationMethod, hasTransactionHistory and the configuration fields (defaults unchanged)
```

Typical review-modal apply: `const res = upsertImportedItems(keptRows, ITEMS_IMPORT_SPEC.lookups)`; the
validator's `createRowCount` / `updateRowCount` drive the Import Complete card, `res.createdIds[0]` the row flash.

## export.ts

```ts
type ExportFormat = "pdf" | "xlsx" | "csv";
async function exportItems(rows: readonly Item[], fields: readonly string[], format: ExportFormat, spec?): Promise<string>;   // fields = export field ids; resolves to the filename
function exportFilename(ext: ExportFormat, spec?, date?: Date): string;      // Items_Export_YYYY-MM-DD.<ext>
function exportItemsCsv(rows, fieldIds, spec?): string;                       // UTF-8 BOM, CRLF, ", " joins
async function exportItemsPdf(rows, fieldIds, spec?): Promise<string>;        // jspdf + jspdf-autotable, landscape A4, "Items Export" header, Page X of Y
async function exportItemsExcel(rows, fieldIds, spec?): Promise<string>;      // exceljs sheet "Items", frozen header, blue fill, date numFmt
function buildItemsCsv(rows, fieldIds, spec?): string;                        // pure CSV text (no BOM), for tests / previews
function extractField(item: Item, fieldId: string, spec?): Extracted;         // { kind: "string" | "multi" | "date" | "empty" }
function formatFieldString(item, fieldId, multiJoin: string): string;
function isDateField(fieldId, spec?): boolean;  function categoryDisplayCode(name: string): string;
```

## importHistory.ts

```ts
const HISTORY_KEY = "omne:items:import-history"; const DETAIL_KEY = "omne:items:import-detail"; const PENDING_KEY = "omne:items:import-pending-corrections";
const PENDING_EVENT = "omne:items:pending-corrections-changed"; const MODULE_SLUG = "items";
type ImporterKey = "aa" | "sj" | "ac" | "ra" | "am";  const IMPORTERS: Record<ImporterKey, Importer>;  const CURRENT_IMPORTER_KEY = "aa";  function getImporter(key): Importer;

type RowOutcome = "Created" | "Updated" | "Skipped" | "Failed";  type RowFilter = "all" | "imported" | "failed";
type ImportedItemRow = ItemReviewRow & { _row: number; _outcome: RowOutcome; _message?: string };
const IMPORT_RECORD_COLUMNS: { key; label; width; mono? }[];  function isImported(o): boolean;  function isFailed(o): boolean;
const DOWNLOAD_META: Record<RowFilter, { downloadLabel; exportLabel; fileSuffix }>;  function importNameToFilenameStem(name): string;
function toImportedItemRow(row, index, outcome, message?): ImportedItemRow;

interface CompletedImportEntry { id; moduleSlug; name; fileName?; description?; dateISO; importerKey; recordCount; importedCount?; failedCount?; parentId?; correctionKind?: "inline" | "reimport" }
function recordCompletedImport(entry): CompletedImportEntry;    // = addCompletedImport; child log when parentId is set (addFixChildImport)
function listImports(moduleSlug?): CompletedImportEntry[];      // newest first, seeds included (= getCompletedImports)
function listChildImports(parentId): CompletedImportEntry[];
function getCompletedImportById(id): CompletedImportEntry | null;
function updateCompletedImportCounts(id, { importedCount, failedCount }): void;
function ensureSeededForLoad(moduleSlug?): void;                // two mocks: imp-items-1 (12 rows, 1 failed), imp-items-2 (8 rows)

interface StoredImportDetail { id; moduleSlug; name; description?; dateISO; importerKey; fileName; records: ImportedItemRow[] }
function saveImportDetail(detail): void;  function loadImportDetail(id): StoredImportDetail | null;   // = getImportDetail

interface PendingCorrection { importId; moduleSlug; fileName; rowCount; startedISO }
function startPendingCorrection(entry): void;  function clearPendingCorrection(importId): void;
function getPendingCorrection(importId): PendingCorrection | null;  function getPendingCorrections(moduleSlug?): Record<string, PendingCorrection>;
function subscribeToPendingCorrections(cb): () => void;

interface ParentSnapshot { id; name; fileName; moduleSlug; rowStatus: Map<number, "failed" | "imported">; keyToRow: Map<string, number>; failedCount }
function loadParentSnapshot(importId): ParentSnapshot | null;
function detectCorrectionTarget({ moduleSlug?, sessionParentId?, rowKeys, loadSnapshot? }): { kind: "linked"; parent; confidence: "session" | "suggested" } | { kind: "none" };   // MIN_SUGGEST_RATIO 0.5
function linkRow(parent, key): { bucket: "matched" | "resolved" | "new"; parentRow: number | null };
function applyCorrectionToParent(parentId, resolved: { parentRow; values; outcome? }[]): StoredImportDetail | null;
function newImportId(now?): string;  function reimportChildId(parentId, now?): string;  function inlineFixChildId(parentId, now?): string;   // imp-{ts}, {parent}-reimport-{ts}, {parent}-fix-{ts}
function resetHistoryForTests(): void;
```

History and pending corrections are wiped once per page load at module evaluation (UAC behaviour); detail payloads persist.
