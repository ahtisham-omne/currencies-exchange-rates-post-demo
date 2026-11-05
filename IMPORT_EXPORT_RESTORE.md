# Sales order import and export (hidden)

Sales order import and export are on the backlog. Nothing was deleted: every entry point is hidden behind one flag.

## Turn it back on

In `src/app/config/featureFlags.ts`, set:

```ts
export const IMPORT_EXPORT_ENABLED = true;
```

That restores everything listed below.

## What the flag hides

| Touchpoint | Where | What it does |
|---|---|---|
| Header **Actions** dropdown | `src/app/components/so/SOList.tsx` | Import and Export options next to Create New SO |
| Fullscreen **Actions** dropdown | `SOList.tsx` | Same menu in the fullscreen header |
| Import notice banner | `SOList.tsx` | Shown above the list after an import run |
| `ImportWizardModal` | `SOList.tsx` | The import flow (only opens when the flag is on) |
| Export modal | `SOList.tsx` | Column and format picker for exporting orders |
| **Import Orders** tile | `src/app/components/so/SalesHomePage.tsx` | Recommended action on the Sales home page |

The import wizard itself lives in `src/app/components/import/` and is unchanged. `handleExportCSV` in `SOList.tsx` is also unchanged.

## Not covered by the flag

The row menu's **Export CSV** item was removed when the row menu was rebuilt (`renderRowMenuItems` in `SOList.tsx`: View or Edit Sales Order, Copy Link, Print, Download, next step, Archive, Cancel). To bring it back, add this after Download Sales Order in `renderRowMenuItems`:

```tsx
{IMPORT_EXPORT_ENABLED && (
  <DropdownMenuItem onClick={() => handleExportCSV(so.id)}>
    <FileDown className="w-4 h-4 mr-2" /> Export CSV
  </DropdownMenuItem>
)}
```

## Left as is

- **Download Sales Order** on the detail page exports a PDF of the order, not data, so it stays.
- **Export CSV** on the Invoicing tab exports invoices, not orders, so it stays.
