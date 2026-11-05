# Import / Export data layer (phase 1)

Everything under `src/app/import-export/` is UI-free. The UI phase (Actions menu, Export modal, Import wizard, Review modal, history pages) is built on top of it, following `docs/import-export/SPEC.md`. Every generic piece is written once and parameterised by an `EntitySpec`; the two entities are two spec objects.

## Files

| File | What it holds |
|---|---|
| `spec.data.mjs` (+ `.d.mts`) | Plain ESM: columns, valid-value snapshots, examples, template copy for both entities. Read by the app AND by `scripts/gen-import-templates.mjs`. |
| `spec.ts` | `EntitySpec` type, `PARTNERS_IMPORT_SPEC`, `PARTNER_GROUPS_IMPORT_SPEC`, live label-to-id maps, export field extractors, list helpers. |
| `templateLayout.mjs` (+ `.d.mts`) | The four-sheet ExcelJS workbook layout (UAC standard), shared with the Node script. |
| `templateText.mjs` (+ `.d.mts`) | CSV template and 66-column Guide txt builders, shared with the Node script. |
| `templateWorkbook.ts` | `buildTemplateWorkbook(spec)` and the browser download. |
| `templateCsv.ts` | `buildTemplateCsv(spec)`, `buildGuideText(spec)`, CSV + guide download. |
| `fileParser.ts` | `parseImportFile(spec, file)`: xlsx / csv to review rows. |
| `validation.ts` | `validateRows(spec, rows, ctx)`: per-cell issues, row status, create vs update. |
| `export.ts` | `exportRecords(spec, rows, fieldIds, format)`: PDF / XLSX / CSV listing export. |
| `importHistory.ts` | History, detail, pending-correction stores and correction detection, namespaced per entity. |
| `partnersApply.ts` | Review row to `Vendor` (create) / `Vendor` patch (update). |
| `partnerGroupsApply.ts` | Review row to the create-modal payload the groups store already understands. |
| `download.ts` | Blob / text download and the lazy `exceljs` loader. |
| `__tests__/` | vitest: snapshots vs live constants, parser, validation, template byte-sync, export, history, apply + store upserts. |

Checked-in templates: `public/templates/Omne_Partners_Import_Template.{xlsx,csv}`, `Omne_Partners_Import_Guide.txt`, `Omne_Partner_Groups_Import_Template.{xlsx,csv}`, `Omne_Partner_Groups_Import_Guide.txt`. Regenerate with `node scripts/gen-import-templates.mjs` after any change to `spec.data.mjs`; `__tests__/templates.test.ts` fails until you do.

## How the UI selects a spec

```ts
import { PARTNERS_IMPORT_SPEC, PARTNER_GROUPS_IMPORT_SPEC, getImportSpec, IMPORT_SPECS } from "./import-export/spec";

// On the Partners listing (/vendors):
const spec = PARTNERS_IMPORT_SPEC;            // EntitySpec<Vendor>
// On the Partner Groups listing (/partners/groups):
const spec = PARTNER_GROUPS_IMPORT_SPEC;      // EntitySpec<GroupExportRow>
// On a history route, from the namespace or module slug:
const spec = getImportSpec("partners") ?? getImportSpec("partner-groups");
```

`spec.routes` gives the listing, history and record routes (`/vendors`, `/vendors/imports`, `/vendors/imports/:importId` and `/partners/groups`, `/partners/groups/imports`, `/partners/groups/imports/:importId`; `spec.routes.recordHref(id)` builds the deep link). `spec.storageNamespace` is `"partners"` / `"partner-groups"`.

## `spec.ts`

```ts
type ImportRow = Record<string, string>;                 // column key -> cell text ("|" joined lists)
type ColumnKind = "text" | "select" | "multiselect" | "yesno" | "number" | "date";
type TextFormat = "email" | "phone";                      // extra checks on a text column

interface ImportColumn {                                  // one per template column, in template order
  key: string; label: string; required?: boolean; kind: ColumnKind; format?: TextFormat;
  options?: string[];                                     // display labels (live constants overlaid)
  optionsFrom?: "groups" | "partners" | "contacts";       // resolved from the ValidationContext instead
  unknownSeverity?: "error" | "warning";                  // default warning
  subsetOf?: string; subsetSeverity?: "error" | "warning";
  conditionalOn?: { field: string; includes: string };
  min?: number; max?: number; maxLength?: number; text?: boolean; width?: number;
  aliases: string[]; description: string;                 // description = header tooltip copy
  ref: { format: string; validValues?: string; example: string };
  example1: string; example2: string;
}

interface ExportField<T> { id: string; label: string; locked?: boolean; listing?: boolean; listingKey?: string; extract(row: T): string | string[] | number | null | undefined }

interface EntitySpec<T> {
  data: EntityData;                                       // the raw .mjs block
  entity: string; entitySingular: string; nounLower: string; nounPluralLower: string;  // "Partners", "Partner", "partner", "partners"
  moduleSlug: string; storageNamespace: string;
  routes: { listing: string; history: string; record: string; recordHref(importId: string): string };
  keyColumn: string; headerIdentityKeys: string[];
  columns: ImportColumn[]; bulkSetFields: string[];        // Partners: ["status","partnerTypes"]; Groups: ["status","scope"]
  exportFields: ExportField<T>[]; exportFilePrefix: string;  // listing columns first (locked identity column), then import-only fields
  template: { title; moduleLine; xlsxFileName; csvFileName; guideFileName; xlsxUrl; csvUrl; guideUrl; uploadPath;
              instructions; compareTable; validValues; guide; fieldReferenceRows[] };
}

const PARTNERS_IMPORT_SPEC: EntitySpec<Vendor>;
const PARTNER_GROUPS_IMPORT_SPEC: EntitySpec<GroupExportRow>;   // PartnerGroupRecord, optionally enriched by the listing page
const IMPORT_SPECS: Record<string, EntitySpec<unknown>>;         // by storageNamespace
const ALL_IMPORT_SPECS: EntitySpec<unknown>[];
function getImportSpec(namespaceOrSlug: string): EntitySpec<unknown> | undefined;

function emptyRow(spec): ImportRow;  function findColumn(spec, key): ImportColumn | undefined;
function splitList(value): string[]; function joinList(values): string;  // "|" lists, trimmed, deduped
function normKey(value): string;      function canonicalOption(value, options): string | undefined;
function isoDate(value): string;      function partnerGroupName(vendor): string;
```

Label-to-id maps (live constants, case-insensitive via `lookupCI(map, key)`): `SUB_TYPE_ID_BY_LABEL`, `SUB_TYPE_LABEL_BY_ID`, `VENDOR_TYPE_BY_SUB_TYPE_ID`, `PARTNER_TYPE_ID_BY_LABEL`, `PARTNER_TYPE_LABEL_BY_ID`, `PAYMENT_TERM_BY_NAME`, `PRICING_RULE_BY_NAME`, `PAYMENT_METHOD_BY_LABEL`, `PAYMENT_METHOD_LABEL_BY_ID`, `CARRIER_BY_LABEL`, `CARRIER_LABEL_BY_ID`, `defaultCarrierMethodIds(carrierId)`, `CURRENCY_ID_BY_CODE`, `CREDIT_ENFORCEMENT_ID_BY_LABEL`, `CREDIT_ENFORCEMENT_LABEL_BY_ID`, `CONTACT_BY_NAME`, `contactNameSet()`, `COUNTRY_BY_DIAL_CODE`, `GROUP_COUNTRY_BY_NAME`, `BILLING_TYPE_ID_BY_LABEL`, `STATUS_ID_BY_LABEL`.

The file vocabulary is display labels ("Net 30", "USD", "Vendor Rules", "FedEx", "ACH"). Ids are only produced on apply.

## Templates

```ts
// templateWorkbook.ts
function templateHeaders(spec): string[];                       // Data Entry row 2 == CSV header row (" *" on required)
function templateCountLine(spec): string;                       // "20 columns  ·  2 required, 18 optional"
async function buildTemplateWorkbook(spec): Promise<ExcelJS.Workbook>;
async function buildTemplateWorkbookBuffer(spec): Promise<ArrayBuffer>;
async function downloadTemplateWorkbook(spec): Promise<string>; // returns the filename
const DATA_ENTRY_SHEET = "Data Entry"; const DATA_ROWS = 600;

// templateCsv.ts
function buildTemplateCsv(spec): string;                        // UTF-8 no BOM, LF, RFC-4180, two example rows
function buildGuideText(spec): string;                          // 66-column guide, "=" banner, "-" dividers
function downloadTemplateCsv(spec): { csv: string; guide: string };  // guide follows 400 ms later (GUIDE_DOWNLOAD_DELAY_MS)
```

The static files are served at `spec.template.xlsxUrl` / `csvUrl` / `guideUrl` and are identical to what the builders produce (tested).

## Parser

```ts
class ImportFileParseError extends Error { code: "EMPTY" | "NO_HEADERS" | "NO_DATA" | "READ_FAILED" | "UNSUPPORTED" }
interface ParseResult { rows: ImportRow[]; rawRowCount: number; matchedFieldCount: number }
async function parseImportFile(spec, file: File): Promise<ParseResult>;
function parseGrid(spec, grid: string[][]): ParseResult;        // pure; throws EMPTY / NO_HEADERS / NO_DATA
function parseCSV(text): string[][];  async function xlsxBufferToGrid(buffer): Promise<string[][]>;
function normHeader(raw): string;     function headerAliasMap(spec): Map<string, string>;
```

Header detection: the first of the first 10 non-blank rows that contains the key column's header (label or alias, after stripping `*` and `(required)`). Unknown columns are dropped silently. Show `err.message` verbatim in `toast.error("Couldn't read this file", { description })`.

## Validation

```ts
interface CellIssue { field; severity: "error" | "warning"; code: IssueCode; message; explanation; example?; options? }
type IssueCode = "REQUIRED_EMPTY" | "DUPLICATE_KEY" | "INVALID_OPTION" | "REFERENCE_NOT_FOUND" | "NOT_IN_LIST"
               | "CONDITION_NOT_MET" | "INVALID_NUMBER" | "OUT_OF_RANGE" | "TOO_LONG" | "INVALID_EMAIL" | "INVALID_PHONE";
interface RowValidation { status: "ready" | "warning" | "error"; issues: CellIssue[]; byField; isUpdate: boolean }
interface ValidationResult { rows: RowValidation[]; errorRowCount; warningRowCount; readyRowCount; updateRowCount; createRowCount }
interface ValidationContext { existingKeys?: Set<string>; groups?: Set<string>; partners?: Set<string>; contacts?: Set<string> }  // all lower-cased
function validateRows(spec, rows: ImportRow[], ctx?: ValidationContext): ValidationResult;
function buildValidationContext(spec, partners: {displayName, companyName}[], groups: {name}[]): ValidationContext;  // snapshot when the wizard opens
```

`message` is the one-liner (chip, sub-row), `explanation` + `example` / `options` feed the cell tooltip (EXAMPLE card or OPTIONS chips). Warnings never block; `Start Import` gates on `errorRowCount > 0`.

## Export

```ts
type ExportFormat = "pdf" | "xlsx" | "csv";
async function exportRecords<T>(spec: EntitySpec<T>, rows: T[], fieldIds: string[], format: ExportFormat): Promise<string>;  // returns filename
function exportFilename(spec, ext): string;                     // Partners_Export_YYYY-MM-DD.csv / Partner_Groups_Export_...
function defaultExportFieldIds(spec, columnVisibility?): string[]; // locked + visible listing columns
function buildExportCsv(spec, rows, fieldIds): string;          // pure (no BOM); async buildExportWorkbook(spec, rows, fieldIds)
function exportFieldLabels(spec, fieldIds): string[];  function formatFieldString(spec, row, fieldId, multiJoin): string;
```

Partners rows are `Vendor[]` (pass `filteredVendors` or the selection). Group rows are `GroupExportRow[]`: the store record, optionally spread with the page's enriched fields (`templateType`, `createdOn`, `partnerCount`) and `memberNames` / `primaryMemberNames` resolved from the vendor store. Toasts belong to the modal.

## History, detail, corrections

```ts
type ImporterKey = "sj" | "ac" | "ra" | "am" | "aa";  const CURRENT_IMPORTER_KEY = "aa";  function getImporter(key): Importer;
interface CompletedImportEntry { id; moduleSlug; name; fileName?; description?; dateISO; importerKey; recordCount; importedCount?; failedCount?; parentId?; correctionKind?: "inline" | "reimport" }
interface ImportedRecord { [columnKey: string]: string | number | undefined; _row: number; _outcome: "Created" | "Skipped" | "Failed"; _message?: string }
interface StoredImportDetail { id; moduleSlug; name; description?; dateISO; importerKey; fileName; records: ImportedRecord[] }
interface PendingCorrection { importId; moduleSlug; fileName; rowCount; startedISO }

function storageKeys(spec): { history; detail; pending; historyEvent; pendingEvent };   // omne:<ns>:import-history, ...
function recordCompletedImport(spec, entry): void;  (alias addCompletedImport)   function addFixChildImport(spec, entry & { parentId }): void;
function listImports(spec): CompletedImportEntry[];  (alias getCompletedImports)  function getCompletedImportById(spec, id);
function updateCompletedImportCounts(spec, id, { importedCount, failedCount }): void;  function ensureSeededForLoad(spec): void;
function subscribeToImportHistory(spec, cb): () => void;
function saveImportDetail(spec, detail): void;  function loadImportDetail(spec, id): StoredImportDetail | null;  (alias getImportDetail)
function toImportedRecord(spec, row, rowNumber, outcome, message?): ImportedRecord;  function recordToRow(spec, rec): ImportRow;
function importRecordColumns(spec): { key; label; width; mono? }[];  function importNameToFilenameStem(name): string;  const DOWNLOAD_META;
function newImportId(): string;  function fixChildId(parentId): string;  function reimportChildId(parentId): string;
function startPendingCorrection(spec, entry); clearPendingCorrection(spec, importId); getPendingCorrection(spec, importId); getPendingCorrections(spec); subscribeToPendingCorrections(spec, cb);
function detectCorrectionTarget(spec, { sessionParentId?, rowKeys }): { kind: "none" } | { kind: "linked"; parent: ParentSnapshot; confidence: "session" | "suggested" };
function loadParentSnapshot(spec, importId): ParentSnapshot | null;  function linkRow(parent, key): { bucket: "matched" | "resolved" | "new"; parentRow };
function applyCorrectionToParent(spec, parentId, resolved: { parentRow; values: ImportRow }[]): { importedCount; failedCount } | null;
```

Once per page load (first touch of a namespace) the two mock seed entries (and any fix children under them) are reset and re-seeded clean, and pending corrections are cleared; imports the user made stay in the history list, so a record page opened in a fresh tab or reloaded keeps its entry. Detail is never wiped. Real imports are recorded with `importerKey: CURRENT_IMPORTER_KEY` ("aa", Ahtisham Ahmad).

## Store fold-in

```ts
// VendorContext
upsertImportedVendors(rows: ImportRow[], ctx?: { groups?: GroupLookup[]; now?: string }): { created: number; updated: number }
// PartnerGroupsContext
upsertImportedGroups(rows: ImportRow[], ctx?: { partners?: { id; displayName; companyName }[] }): { created: number; updated: number }
```

Pass every non-error row (ready + warning) after the 2400 ms run. `ctx.groups` should be `usePartnerGroups().groups` (session + seed) so group names resolve; `ctx.partners` should be `useVendors().vendors`. The counts come back synchronously. The pure mappers (`buildVendorFromImport`, `patchVendorFromImport`, `buildGroupPayloadFromImport`) are exported for tests and for the detail page's inline-fix commit.

`Vendor` gained three optional fields the importer fills: `partnerGroups` (all group ids, primary first), `partnerGroupName`, `phone`.

## Rules baked in (decisions the spec left open)

- Non-key required columns are required on create rows only; an update row needs only the key (UAC rule). Blank cells never overwrite.
- Option matching is case-insensitive and canonicalised on apply. Blank optional enums are silent (their defaults are documented in the template); there is no MISSING_LICENSE-style warning.
- `Points of Contact` is a reference (`optionsFrom: "contacts"`) because `CONTACT_DICTIONARY` is extended at runtime; unknown = warning, dropped on apply.
- `Primary Partner Group` given without `Partner Groups` is accepted (it becomes the only group). With `Partner Groups` present it must be listed there (error).
- Sub-types without their type are a warning only when the type column is non-blank; blank inherits the primary group's scope.
- Dates in exports are `YYYY-MM-DD`; "Last Updated By/On" reuse `getLastUpdated`, so they match the listing.
- Guide labels longer than 40 characters go on their own line so no guide line exceeds 66 columns.
