# Roles Import Template: Generation Spec

Generate the three downloadable files for the **Roles** import flow and place them in
`public/templates/`, next to the existing Users files. Build them the same way the
Users templates were built (`OMNE_Users_Import_Template.xlsx` / `.csv` /
`OMNE_Users_Import_Guide.txt` are the visual and structural reference, match their
look, tone, and layout exactly).

Files to produce:

1. `public/templates/OMNE_Roles_Import_Template.csv`
2. `public/templates/OMNE_Roles_Import_Template.xlsx`
3. `public/templates/OMNE_Roles_Import_Guide.txt`

The app already references these exact filenames (see `ROLES_TEMPLATE_CONFIG` in
`src/app/components/data-imports/import-wizard/ImportSetupStep.tsx`), so the names
must match byte-for-byte.

---

## 1. Column layout (single source of truth)

The template creates or updates roles and places users in them. It does **not** set
permissions and it has **no license column**: a role's permissions, and the license
those permissions require, are set in the role builder in Omne, not in a spreadsheet.
Status is managed by Omne, not the import.

The header row must match `ROLES_TEMPLATE_HEADERS` in
`src/app/components/data-imports/rolesImportTemplateExport.ts` **byte-for-byte**;
the failed-records download reproduces this template and the parser re-reads it:

| # | Header | Required | Valid values / format |
|---|--------|----------|------------------------|
| 1 | `Role Name *` | Yes | Unique role name. Matching key: if it equals an existing custom role's name, the row **updates** that role; otherwise it **creates** one. Must not equal a predefined system role name. Must be unique within the file. |
| 2 | `Description` | No | Free text: what the role is for. |
| 3 | `Role Owner` | No | A single owner. Email **or** full name of an existing Omne user. Unknown owner imports with a warning (role imports without an owner). |
| 4 | `Assigned Users` | No | Pipe-separated user emails, e.g. `alex@acme.com\|priya@acme.com`. Users must already exist in Omne; unknown emails import with a warning (role imports without those users). |

Parser constraints (from `src/app/components/data-imports/import-review/rolesFileParser.ts`):

- The header row is detected by scanning the first ~10 non-blank rows for one that
  contains **Role Name** (trailing `*` is stripped before matching, matching is
  case-insensitive). Role Name is the only required column.
- In the XLSX, only the sheet named **`Data Entry`** is read (fallback: first sheet).

## 2. `OMNE_Roles_Import_Template.csv`

- UTF-8, RFC-4180 quoting (quote cells containing commas/quotes/newlines).
- Row 1: the 4 headers above, in order.
- Rows 2–3: **two example rows** (the guide tells people to delete them before
  importing):

```csv
Role Name *,Description,Role Owner,Assigned Users
Warehouse Auditor,"Reviews inventory, receiving, and cycle count records for audits.",alex.johnson@acme.com,priya.sharma@acme.com|marcus.lee@acme.com
Field Service Technician,Handles assigned field jobs and captures proof of delivery.,,dana.wu@acme.com
```

## 3. `OMNE_Roles_Import_Template.xlsx`

Mirror the Users workbook's 4-sheet structure, styling, and polish:

1. **`Data Entry`** (the only sheet the importer reads)
   - Row 1: title banner `OMNE  ·  Roles Import Template` (note the two spaces
     around the `·`), bold, size 14, blue `FF1E40AF`.
   - Row 2: the 5 headers. Bold, font color `FF1E40AF`, solid fill `FFDBEAFE`,
     thin bottom border `FF93C5FD`, row height 22.
   - Rows 3–4: the same two example rows as the CSV.
   - Frozen panes: `ySplit: 2` (and optionally `xSplit: 1` so Role Name stays
     visible).
   - No data-validation dropdowns: none of the five columns is a fixed-value field.
   - Auto-fit column widths (min 12, max 48), gridlines hidden.
2. **`Instructions`**: same layout as the users sheet: title block
   (`Roles Import Template`, `Omne Pioneer  ·  User Access Control`,
   `5 columns  ·  1 required, 4 optional`), then a short numbered quick-start
   (open Data Entry, delete the 2 example rows, fill roles, upload under
   Company Setup → Data Imports → Roles).
3. **`Field Reference`**: banner `OMNE  ·  Roles Import, Field Reference`,
   subtitle `Every column explained. The red row is required and cannot be left blank.`,
   then a table with columns `Field | Required | Description | Format | Valid Values | Example`,
   one row per template column (use the table in section 1), plus a trailing
   "Not set here" note explaining permissions, license, and status are not in this
   template. Tint the required row (Role Name) red like the users sheet does.
4. **`Valid Values`**: title `Valid Values & Reference`, subtitle
   `Use these exact values in the Data Entry sheet.`, then notes for Role Name
   (unique; must not match a predefined system role), Role Owner (single email or
   full name), Assigned Users (pipe-separated emails), and a "Permissions and
   license" note explaining neither is set in this template.

## 4. `OMNE_Roles_Import_Guide.txt`

Plain text, wrapped at 66 characters, following the **exact** structural format of
`OMNE_Users_Import_Guide.txt`, the in-app guide drawer parses it
(`parseImportGuide` in `ImportSetupStep.tsx`):

- Top banner: a line of 66 `=`, then `OMNE ROLES IMPORT GUIDE`, then
  `Omne Pioneer  ·  User Access Control`, then a closing line of 66 `=`.
- Intro paragraph after the banner (becomes the "Overview" section).
- Each section delimited by a line of 66 `-`, the section title on the next
  line, another line of 66 `-`, then the body.
- Labeled entries use the `Label` + 2-or-more spaces + description format;
  sub-headers are a line followed by a row of dashes.

Sections to include (mirroring the users guide):

1. **WHAT THIS TEMPLATE DOES, AND WHAT IT DOES NOT**: creates/updates roles and
   places users in them; does not set permissions and has no license column.
2. **QUICK START**: open the CSV, delete the 2 example rows, fill in roles,
   only Role Name is required, pipe-separate multiple assigned users, upload
   under Company Setup, Data Imports, Roles.
3. **HOW ROLES ARE MATCHED**: Omne matches rows by **role name**: no existing
   role with that name → creates a new role; name matches an existing custom
   role → updates it (blank cells leave existing values unchanged; the name
   itself is never changed by an import). Predefined system roles cannot be
   created or changed by an import. Rows with errors don't import until fixed;
   rows with warnings import and are flagged.
4. **PERMISSIONS AND LICENSE**: not set in this template; chosen in the role
   builder in Omne, which derives the license from them.
5. **FILE LIMITS**: Excel or CSV up to 10 MB, single sheet (keep only the
   Data Entry sheet if using the Excel template).
6. **FIELD REFERENCE**: "Required column" (Role Name) and "Optional columns"
   (Description, Role Owner, Assigned Users), one labeled entry
   each, using the descriptions from section 1.
7. **VALID VALUES**: notes for Role Name, Role Owner, Assigned Users, plus a
   "Permissions and license" note.

## 5. Acceptance checks

After generating, verify:

1. Uploading `OMNE_Roles_Import_Template.csv` in the Import Roles wizard parses
   **2 rows / 5 fields** and both example rows validate as **Ready** (their
   fictional owner/assigned emails may show warnings, that's acceptable; no
   errors).
2. Uploading the XLSX parses identically (the parser reads the `Data Entry` sheet
   and skips the banner row).
3. The "Excel" and "CSV" buttons in the Import Roles wizard download the files,
   and the guide drawer opens and renders all sections of the TXT.
