# Import / Export mirror checklist (source: User Access Control, role-zen @ 2d4b48ea)

Copy this file into `<repo>/docs/import-export/CHECKLIST.md`, fill the header, and tick a line only
after it is verified in the running target app. "Same as UAC" means pixel and behaviour parity with
role-zen on http://localhost:8087/company-settings/user-access-control (Users tab), re-expressed in
the target's own tokens. Every section ends with a side-by-side screenshot line.

Repo: partner-management-module  Entity: Partner Groups  Listing route: /partners/groups  Key column: Group Name  Verified by: Claude (verifier agent)  Date: 2026-09-30

## A. Entry point (listing header)
- [x] A1 "Actions ▾" outline button sits immediately LEFT of the primary "Create New <Entity>" button, same height, 13px label, chevron-down icon, gap 8px (same as UAC).
- [x] A2 Dropdown opens aligned end, width 144px, two items in order: Upload icon "Import", Download icon "Export"; no separator; hover/focus states same as UAC.
- [x] A3 "Import" opens the Import wizard; "Export" opens the Export modal with context kind = "filtered" when a filter/search is active, else "all".
- [x] A4 Bulk action bar (when rows are selected) keeps or gains an "Export" action that opens the Export modal with kind = "selected" and excludes Archived rows.
- [x] A5 Screenshot: header with menu open, target vs UAC.

## B. Export modal
- [x] B1 Shell: 1024px wide, min(860px, 100vh-48px) tall, radius 16, header tile with download icon, title "Export <Entities>", subtitle copy with the entity noun, "Full View" / "Exit Full" toggle (300ms cubic-bezier(0.32,0.72,0,1)), X close.
- [x] B2 Count banner copy for all three contexts: "Every <entity> on your list will be exported" / "Only the <entities> matching your current filters will be exported" / "Only the <entities> you selected will be exported", with the live count.
- [x] B3 File Format panel (wider column, grid 1.55fr/1fr): three radio cards PDF (blue badge #EFF6FF/#2563EB) / XLS (green #ECFDF5/#047857) / CSV (amber #FFFBEB/#B45309), titles and descriptions verbatim, selected border #0A77FF, radio dot #2563EB, PDF selected by default.
- [x] B4 Columns to Include panel: search "Search columns", tri-state select-all with labels "All N columns selected" / "n of N columns selected" / "Select All Columns", scoped to visible non-locked rows.
- [x] B5 Column rows: drag handle, checkbox, label, info icon with the field description tooltip; key column locked with lock icon and tooltip "<Key> is always included. It is how each <entity> is identified in the file."; default checked = the listing's currently visible columns.
- [x] B6 Drag reorder with pointer handlers (5px threshold, midpoint swap, auto-scroll), "Move to Top / Move to Bottom" chevrons on hover for rows at visible index >= 6, 1.5s blue ring flash after a move. (superseded 2026-09-30: replaced by the Financial Reporting Selected Columns drag, verified side by side, see _crossref/context/partner-management-module/2026-09-30-export-drag-*.png)
- [x] B7 Empty search state "No Columns Match Your Search."; zero selected shows amber notice "Pick at least one column to export." and disables the CTA. (matches UAC: unreachable in both, key column always selected; empty search "No Columns Match Your Search." driven in both apps)
- [x] B8 Footer: "Cancel" + blue CTA whose label follows the format ("Export as PDF" / "Export as Excel" / "Export as CSV"), "Exporting…" while busy.
- [x] B9 PDF: jspdf + autotable, landscape A4, 8pt helvetica, header "<Entities> Export" + date, "Page X of Y"; multi-values joined ", ".
- [x] B10 XLSX: exceljs, sheet named "<Entities>", frozen header row, blue header fill, dates as real Date cells with numFmt.
- [x] B11 CSV: RFC-4180, UTF-8 BOM, multi-values joined "|".
- [x] B12 Filename `<Entities>_Export_YYYY-MM-DD.<pdf|xlsx|csv>`; toast "Exported <filename>" (green check, 3s) or "Export failed. Please try again."
- [x] B13 Exported rows = exactly the rows given by the context (filtered/sorted listing rows, or the selection); display labels used for enums.
- [x] B14 Screenshot: export modal default state and Full View, target vs UAC. (captured: 02 default and 02b Full View, target-groups vs UAC)

## C. Import wizard (upload step)
- [x] C1 Shell: portal, width min(58vw, 880px), max-h 90vh, radius 16, spring 0.35s, header "Import <Entities>" + "Upload a spreadsheet to add or update <entities> in bulk.", X close.
- [x] C2 Blue info card "Download the Import Template" with subtitle "Includes <first five field names> and +N more"; "+N more" HoverCard (240px, "FIELDS" heading, "Scroll for more") listing the remaining fields.
- [x] C3 "Excel" and "CSV" outline buttons download `Omne_<Entities>_Import_Template.xlsx` / `.csv`; CSV also fetches `Omne_<Entities>_Import_Guide.txt` 400ms later; each download opens the in-modal Reading Room drawer "<Entities> Import Guide" rendering the guide. (driven: Excel and CSV download with the right names, the Guide txt follows the CSV about 404 ms later, and the Reading Room "<Entities> Import Guide" opens after each)
- [x] C4 "Upload Your File *" dropzone: "Click to Upload or drag and drop" / "Excel or CSV. Up to 10 MB."; accept .xlsx/.csv; six states (default, hover, drag-over, missing-red, uploading, has-file) with UAC colours; files[0] only. (driven: default, hover #CBD5E1 on #FAFBFC, drag-over #0A77FF on rgba(214,232,255,0.3) with a #D6E8FF tile via a synthetic dragenter/dragover, missing-red #EF4444 on #FEF2F2 with "Upload an Excel or CSV file to continue." while the disabled Review Data is hovered, uploading, has-file; computed colours equal UAC)
- [x] C5 UploadingCard: shimmer gradient, 56px ring (r=24, strokeWidth 4), synthetic 850ms progress, skeleton lines.
- [x] C6 AttachmentCard (the attachment card): 10px radius, faux spreadsheet DocumentPreview, green xlsx/csv thumbnail (#e9f8f1/#176f45), file name + "{n} KB", 9px uppercase type badge, always-visible 22px X with red hover, hover border #90C2FF + shadow; removing returns to the empty dropzone.
- [x] C7 Wrong extension shows the "Unsupported file type" toast; empty file / no headers / no data rows / read failure show their exact UAC toast strings ("Couldn't read this file" family). (driven: wrong extension, empty file, no headers, no data rows and read failure toasts all match UAC wording with the entity noun swapped)
- [x] C8 "Import Description (Optional)" textarea, placeholder "e.g. <entity-appropriate example>. A short note that helps you find this import later.", helper "Helps you find this import later in your history. It does not affect the file.", resize-y, rows 3, focus border #0A77FF + 2px 20% ring; description persists to the history record.
- [x] C9 Footer "Cancel" + "Review Data →" enabled only when a file parsed with validationState "valid".
- [x] C10 Close via X / Cancel / backdrop / Escape when dirty opens "Discard This Import?" with "Discard" / "Keep Editing".
- [x] C11 Screenshot: empty state, uploading, attachment card, target vs UAC. (captured: 04 empty, 05 uploading, 06 attachment card, target-groups vs UAC)

## D. Template standard (4-sheet workbook, CSV, guide)
- [x] D1 Workbook sheets in order: "Data Entry", "Instructions", "Field Reference", "Valid Values"; gridlines off on all; Arial everywhere.
- [x] D2 Data Entry: row 1 heading band "Omne  ·  <Entities> Import Template  ·  Data Entry" (#1D4E89 fill A to last column, Arial 12 bold white, height 32, indent 1, no borders, same band on all four tabs); row 2 headers height 30, required headers white on #C0392B with " *" suffix, optional #1A1A18 on #E8E6E1, thin #D8D6D1 borders, left/middle/wrap; rows 3-4 two example rows italic #6B6B66 on #F2F1EE; rows 5 to 600 a fillable grid (thin #D8D6D1 borders on every template column, white fill, every empty cell white (no required tint), Arial 10 #1A1A18, wrap / top / left so typed text never spills, no explicit row height on rows 3 to 600 (Excel autofits, sheet default row height 20), same numFmt as the column); freeze xSplit per spec / ySplit 2 (headers only, no divider under the examples; row 4 keeps the thin #D8D6D1 bottom border); text numFmt "@" on date/phone/code columns; column widths per spec. The failed-rows Data Entry export on the import record page carries the same grid (rows 3 to 600, incl. Error Message).
- [x] D3 Instructions: row 1 heading band, then title block in the first content column on every reference tab (row 2 title Arial 15 bold height 26: "Instructions" / "Field Reference" / "Valid Values & Reference"; row 3 subtitle 10 #6B6B66 height 18; Instructions row 4 "N columns  ·  R required, O optional"; one 18-high spacer row before the first table, every spacer row 18, no row below 15); every section a card over B:C in the Valid Values style (title bar #F2F1EE 11 bold 24, #3A3A36 header row 24 "Step | What to do" / "Case | What happens" / "Topic | Details", first column on #F7F6F3, other column zebra white / #FAFAF8, single-paragraph sections a merged regular row, 18pt spacer between cards); every cell vertically centred, left, indent 1, row heights from real Arial 10 measurement in textMeasure.mjs (Excel-measured advance widths, wrap at spaces and hyphens; max(20, lines*13.5+8), one-line rows 21.5); widths 2/30/100.
- [x] D4 Field Reference: banner + "Every column explained. Red rows are required.", "New <entity> vs existing <entity>" compare card (title bar merged A:F, #3A3A36 header height 24 with blank A, new-entity text merged B:C, existing-entity text merged D:F, computed row heights); field table as a card with an "All columns" title bar and #3A3A36 header height 24 (no autoFilter), Field column on #F7F6F3 for optional rows, required rows #FBE9E7 with bold #C0392B "Yes", optional rows zebra white / #FAFAF8; every cell thin #D8D6D1, wrap, vertically centred, left, indent 1; widths 26/11/56/22/30/28.
- [x] D5 Valid Values: title 15pt, one block per enum/reference column listing the exact accepted values; the new/existing/archived case table; each block a bordered table (title merged B:C on #F2F1EE, #3A3A36 header height 24, value B on #F7F6F3, meaning C zebra white / #FAFAF8, notes merged B:C italic #6B6B66 with computed height, spacer between blocks); widths 2/30/90. Verified in Excel via PDF export 2026-09-30.
- [x] D6 CSV: UTF-8, no BOM, LF, RFC-4180, header row with " *" on required, the same two example rows.
- [x] D7 Guide txt: 66-col wrap, "=" banner, "-" dividers, sections parseable by the Reading Room parser.
- [x] D8 The three shipped files in public/templates are byte-identical to what `scripts/gen-import-templates.mjs` produces; the column count in Instructions equals the real column count.
- [x] D9 Open the xlsx in Excel: freeze panes hold, required headers red, examples grey italic, no gridlines. (checked in real Excel via COM render, 2026-09-30: Data Entry frozen through the last required column and row 4, showGridLines false on all four sheets, required headers C0392B with white bold font, example rows italic 6B6B66 on F2F1EE, Arial)

## E. Parser
- [x] E1 Extension routing xlsx vs csv; "Data Entry" sheet by name else first sheet.
- [x] E2 Header row found by scanning the first 10 non-blank rows for the key header after stripping "*" and "(required)"; HEADER_ALIASES normalise case/whitespace and known synonyms.
- [x] E3 Unknown columns ignored; blank rows skipped; returns {rows, rawRowCount, matchedFieldCount}.
- [x] E4 CSV parser handles quotes, embedded commas and newlines; Excel dates read as YYYY-MM-DD text.
- [x] E5 Missing key header -> "Couldn't read this file" toast path; zero data rows -> NO_DATA toast.

## F. Validation
- [x] F1 Required-empty on key and other required fields = error, message verbatim pattern "<Field> is required".
- [x] F2 Duplicate key within the file = error on every duplicate row.
- [x] F3 Existing key in the store = row marked Update (blue Update badge + update-cell tint), never an error.
- [x] F4 Invalid enum value = warning with the options list in the tooltip; unknown reference (category/partner/group/location/user) = per spec (error when the field is required, warning otherwise).
- [x] F5 Numeric fields: non-numeric = error, range rules per spec (min < max, 0-100, > 0).
- [x] F6 Conditional fields (Lot ID Assignment, Shelf Life Unit, Primary Acquisition, Specific Partners, Serial Scan) warn when set without their condition. (entity equivalents checked: Primary Partners not in Linked Partners, and Vendor Profiles without Vendor in Group Scope, both warn in the grid; the listed Items fields do not exist for Partner Groups)
- [x] F7 Length caps (5000 description, 30 per tag) enforced.
- [x] F8 Whole-grid revalidation after every edit (cross-row duplicates recompute).

## G. Review and Fix Your Data (structure and styling)
- [x] G1 Second portal (z 150/151) over the wizard; Full View is the DEFAULT (toggle reads "Exit Full View"), Normal = min(92vw, 1280px) max-h 80vh.
- [x] G2 Header: title "Review and Fix Your Data", subtitle "Check your <entities> before importing. Rows with errors will not be imported until you fix them. Rows with warnings will import as they are.", toggle + X.
- [x] G3 Toolbar: search "Search records..." over all data columns; density dropdown (list icon) Comfort (row 52 / th 44) and Condensed (row 36 / th 36).
- [x] G4 Filter chips "Show All / Ready / Errors / Warnings" with count badges, four tones, exact-status semantics; bulk bar swaps in place when rows are selected.
- [x] G5 Table: border-separate, fixed layout; sticky "#" (36px), checkbox (40px), "Result" (150px, seam shadow when scrolled), sticky right "Actions" (72px, inset seam); data columns with spec labels, widths and header tooltips; sort cycles asc/desc/none.
- [x] G6 Row background priority active #E8F2FF > hover #F1F5F9 > selected #EFF6FF > zebra #F8FAFC > white.
- [x] G7 Cell tints: error #FEF2F2 + inset #FECACA, warning #FFFBEB + #FDE68A, update #EFF6FF + #BFDBFE; active cell 2px #0A77FF inset; editing white + 2px + 3px 15% halo.
- [x] G8 Result pills Ready / Warning / Error with UAC colours; issue hover Tooltip with badge, explanation and Example / Options card.
- [x] G9 Edited cell shows the blue corner triangle with the original value on hover. (driven: 6px #0A77FF top-left triangle; hovering it shows "Edited, original value: ...")
- [x] G10 Editors: text input; single-select popover list (Status and other enums); multi-select popover 288px with search, grouped sections in caps, checkbox rows, footer "{n} selected" + "Done" (for tags, categories, partners, methods, locations); yes/no select; numeric input; date text "YYYY-MM-DD" where applicable.
- [x] G11 Pagination bar centred: "Records per Page" native select 20/50/100/All, First/Prev/page numbers/Next/Last, current page #0A77FF, disabled opacity-40; default 100.
- [x] G12 Empty states: no rows / no matches copy same as UAC. (driven: "No Rows Match Your Search." with Clear Search, and "All Rows Have Been Removed." / "There is nothing left to import." with Cancel Import; same as UAC)
- [x] G13 Footer "Cancel" + "Start Import".
- [x] G14 z-index ladder: menus/tooltips 200, dialogs 300/301, cell popovers 320, drag ghost 9999; nothing clipped inside the modal. (driven: cell popovers 320, tooltips 200, confirm dialog 300/301; a popover opened on the last row stays fully visible; the drag ghost is now 400 with the Financial Reporting drag)
- [x] G15 Screenshot: review grid with a warning row, an error row, an open multi-select editor, target vs UAC. (captured: 09 with warning and error rows, 11 multi-select open, 12 issue tooltip, target-groups vs UAC)

## H. Review behaviour and logic
- [x] H1 Row "..." menu and right-click menu: "Duplicate Row" (copy with key cleared), "Revert Changes" (only when edited), separator, "Skip Row" (red, error rows only), "Delete Row" (red, no confirm).
- [x] H2 Skipped rows leave the grid into a skipped set (excluded from tabs and counts), reported as Rows Skipped at completion, and appear as Failed rows in the record detail for the correction loop.
- [x] H3 "Skip N error rows" button when errors exist; sonner toast "N rows skipped from this import" with the UAC description.
- [x] H4 Bulk bar: "Set <enum 1>", "Set <enum 2>" (spec bulk-set fields), "Delete Rows" with "Delete These Rows?" confirm, "N selected", "Cancel"; header checkbox tri-state over the current page. (driven: Set <field> menus apply to the selected rows, "Delete These Rows?" confirm removes them, header checkbox goes mixed with one row selected)
- [x] H5 Editing keys: single click edits; Enter commits and moves down; Tab / Shift+Tab commit and move right/left; Esc cancels; blur commits; arrow keys move the active cell when not editing; multi-select click-outside commits, single-select click-outside cancels. (driven: arrow keys move the active cell, blur into another cell commits, multi-select click-outside commits, single-select click-outside cancels; outside click now also clears the active cell as in UAC)
- [x] H6 Status derivation error > warning > ready; counts update live; Start Import enabled only when errors === 0 (warnings never block).
- [x] H7 Start Import: overlay over the grid only (bg-white/50 + backdrop-blur 1px), card with Loader2 32px, "Importing {n} <entities>..." / "Importing... {p} of {n} <entities> processed", fixed 2400ms requestAnimationFrame ramp, footer button spinner + "Importing...", everything disabled during the run.
- [x] H8 Import Complete dialog (z 300/301, max-w 460, green radial header, 64px check tile): tiles "<Entities> Created", "<Entities> Updated", "Rows Skipped", "Warnings" with chevron and click-through only when count > 0, each deep-linking in the SAME tab to the new import's record page with `?filter=imported|failed`; buttons "View <Entities> Listing" (#10B981, replaces to the listing) and "View Import History" (#F1F5F9), which navigates in the SAME tab (never a new tab) to the new import's record page, or to the correction parent ("View Original Import"). Only the listing notice banner opens a new tab, as in UAC. (driven 2026-09-30: page count 1 -> 1, URL changed to the record route, h1 = uploaded file name)
- [x] H9 Created rows land in the module store (prepend, createdBy = module current user, createdOn now, defaults per spec); Updated rows patch the existing record by key; the listing shows them immediately with a notice banner like UAC's.
- [x] H10 Close via X / Escape / backdrop / Cancel when dirty shows "Close Without Importing?" / "Your fixes on this screen will not be saved." with Discard / Keep Editing.
- [x] H11 CorrectionBanner appears when the upload is detected as a correction of an earlier import (session parent id or >= 50% key overlap with its failing rows), with link/unlink and remove-already-imported actions. (driven on Groups: a key-matched upload shows "Link to it"; linked shows "Import separately", "1 matched", "1 already imported" and "Remove the row already imported", which drops the resolved row)
- [x] H12 Screenshot: importing overlay and Import Complete, target vs UAC. (captured: 15 importing overlay and 16 Import Complete, target-groups vs UAC)

## I. Import history and record detail
- [x] I1 Routes `<listing>/imports` (history for this module) and `<listing>/imports/:importId` (record), added inside the app layout; sidebar keeps the module item active.
- [x] I2 History table columns: File Name | Description | Imported By | Imported On (sortable) | Results with chips "{n} imported" (#ECFDF5/#065F46/#D1FAE5), "{n} failed" (#FEF2F2/#991B1B/#FEE2E2), "Awaiting file" amber; nested child rows for corrections with Pencil/FileUp glyphs; search, density, pagination; empty "No Imports Found"; a "New Import" CTA opening the wizard.
- [x] I3 Record page = UAC Users record page: header card (44px back button, 44px #EDF4FF icon tile, 16px/700 file name, importer chip, date chip, "Description: <text>" or italic "No Description Added"); NO summary tiles; table card with "Search records...", chips Show All always plus Imported / Failed only when count > 0 (Failed counts only rows still in error), Comfort / Condensed density (52/36) on the right; table checkbox | Row | Result (Imported/Ready/Error/Failed) | data columns with horizontal + vertical scroll and pagination; error reason sub-rows; correction strip; `?filter=imported|failed` deep links. Opens directly or after a reload from the persisted detail store; a real import keeps its history entry across reloads (only the two seeds and pending corrections reset per load). (driven 2026-09-30 against UAC at 1440x900: default, Imported, Download menu, Condensed, reload, fresh tab)
- [x] I4 Downloads, as UAC: the header shows ONLY the failed-rows menu "Fix Error Rows Manually", and only when rows failed (info note, Download as Excel, Download as CSV, Upload Corrected File); the failed export regenerates the one-sheet Data Entry layout with an appended "Error Message" column, named `<ImportNameStem>_failed.<csv|xlsx>`. Selected rows export from the selection bar ("Export Selected Records", CSV / Excel) as `<ImportNameStem>_selected.<ext>`. No all / imported header download menu.
- [x] I5 Corrections: "Fix Error Rows Manually" -> CorrectionStrip "Waiting on your corrected file" -> wizard with parentImportId; "Import N Correct Rows" inline path; child logs `{id}-fix-{ts}` / `{parent}-reimport-{ts}` nest under the parent; matched parent rows flip to Created. (driven: editing a failed row turns the button into "Import 1 Correct Row", the run completes, the child {id}-fix-{ts} nests under the parent and the parent row flips to Created)
- [x] I6 Storage keys namespaced per module (`omne:<module>:import-history`, `omne:<module>:import-detail`, `omne:<module>:import-pending-corrections`); history seeded with two mock entries per module like UAC.
- [x] I7 Screenshot: history table and a record page, target vs UAC. (captured: 18 history, 18c nested inline child, 19 record with the Failed filter, target-groups vs UAC)

## J. Repo hygiene and verification
- [x] J1 Styling re-expressed in the target's own tokens where the target has them (primary, border, muted, accent, radius); raw hexes only where UAC also used raw hexes and the target has no token.
- [x] J2 No em dashes in any new user-facing string.
- [x] J3 Typecheck clean (`node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit`), lint clean on changed files, existing tests pass, `vitest` for the new parser/validation/template modules.
- [x] J4 Neighbouring UI consistency: the Actions button matches the target's own toolbar outline buttons; the new modals match the target's existing modal frame conventions.
- [x] J5 End-to-end run recorded: download template -> fill 3 rows (one new, one update, one with an error) -> import -> fix error inline -> Start Import -> Import Complete counts correct -> listing shows the rows -> history record shows outcomes -> failed download contains the Error Message column. (recorded run: Excel template filled with new, update, inline-fix and two error rows; 2 created / 1 updated / 2 skipped; listing shows the rows; history and record show outcomes; failed CSV and XLSX carry Error Message; record-page inline fix and corrected file follow)
- [x] J6 Prompt inbox line flipped to [x]; crossref CASES.md row added with file:line landing spots. (not verified: the brief forbids touching .inbox/prompts.md and CASES.md) (done 2026-09-30 by the parent session: inbox flipped, CASES row added)
