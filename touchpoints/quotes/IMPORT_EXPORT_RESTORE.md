# Quote import and export (hidden)

Quote import and export are on the backlog. Nothing was deleted: every entry point is hidden behind one flag.

## Turn it back on

In `src/app/config/featureFlags.ts`, set:

```ts
export const IMPORT_EXPORT_ENABLED = true;
```

That restores everything listed below.

## What the flag hides

All in `src/app/pages/QuotesListPage.tsx`:

| Touchpoint | What it does |
|---|---|
| Header **Actions** dropdown | Import and Export options next to Create New Quote |
| Fullscreen board **Actions** dropdown | Same menu in the fullscreen board header |
| Import notice banner | Shown above the list after an import run |
| `ImportWizardModal` | The import flow (only opens when the flag is on) |
| Export modal | Column and format picker for exporting quotes |

The import wizard itself lives in `src/app/components/import/` and is unchanged.

## Not covered by the flag

The row menu's **Export CSV** item was removed when the row menu was reordered (View or Edit Quote, Copy Link, Print Quote, Download Quote, next step, Archive, Cancel Quote). To bring it back, add this item after Download Quote in the row menu in `QuotesListPage.tsx`:

```tsx
{IMPORT_EXPORT_ENABLED && (
  <DropdownMenuItem onClick={() => { toast.success(`Exporting CSV for ${quote.quoteNumber}…`); }}>
    <FileDown className="w-4 h-4 mr-2" /> Export CSV
  </DropdownMenuItem>
)}
```
