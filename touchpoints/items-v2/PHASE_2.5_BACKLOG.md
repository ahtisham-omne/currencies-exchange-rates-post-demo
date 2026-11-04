# Phase 2.5 Backlog — Items Library

Deferred from Phase 2. These are interaction features present in Partners' `VendorsListPage` that were not built when forking to `ItemsListPage`. Decide case-by-case later whether each is worth implementing.

- **Column drag-to-reorder** — Custom mouse-event system with ghost element; drag table headers to reorder columns.
- **Column resize** — Per-column width state with drag-handle on header right edge.
- **Freeze column** — Sticky-position columns via `frozenColumns` Set; option in Column Header Menu.
- **Functional checkboxes + bulk action bar** — Wire `selectedRows` Set; show contextual bulk-action toolbar when rows are selected.
- **QuickViewPanel** — Side panel that opens on row click showing condensed Item summary without leaving the list.
- **Card View density** — Third density option ("card") that renders Items as a responsive card grid with `cardSize` toggle (large/medium/small).
- **URL query param sync** — `useSearchParams` for deep-linkable state (e.g., auto-open Create modal via `?createItem=...`).
- **Newly-created flash animation** — Highlight a newly-added row briefly via `newlyCreatedId` state.
- **Embedded mode** — `embedded` prop to hide page chrome (top bar, header, KPIs, Create button) for nesting inside other pages (e.g., a future "Linked Items" tab).
