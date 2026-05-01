

## Plan: Integrate Vendor Invoicing UI Codebase

### Overview
Clone the entire vendor invoicing app from the GitHub repo into this Lovable project. This is a Figma Make export — a vendor invoicing UI with invoice list, creation flow, detail views, prepayments, payments, and receiving documents screens.

### Key Challenges & Solutions

**1. Tailwind v4 → v3 Migration**
The source repo uses Tailwind CSS v4 (`@import 'tailwindcss' source(none)`, `@tailwindcss/vite` plugin, oklch colors). Lovable uses Tailwind v3. We'll:
- Convert the theme.css oklch/hex variables to work with Tailwind v3's HSL-based `hsl(var(--...))` pattern or use raw CSS variable references
- Replace `@import 'tailwindcss' source(none)` with `@tailwind base/components/utilities`
- Remove `@tailwindcss/vite` plugin dependency and keep postcss-based Tailwind
- Add `tw-animate-css` animations to the existing tailwind config

**2. Add New Dependencies**
Install: `@emotion/react`, `@emotion/styled`, `@mui/material`, `@mui/icons-material`, `@mui/x-date-pickers`, `dayjs`, `motion`, `react-dnd`, `react-dnd-html5-backend`, `react-hook-form`, `react-slick`, `react-responsive-masonry`, `react-popper`, `@popperjs/core`

**3. Copy All Source Files**
- `src/app/App.tsx` — main app component (state-based navigation, no router needed)
- `src/app/components/` — 20+ components (InvoiceListScreen, InvoiceCreationFlow, InvoiceDetailScreen, Layout, modals, etc.)
- `src/app/components/ui/` — shadcn/ui components (will replace existing `src/components/ui/`)
- `src/app/components/figma/ImageWithFallback.tsx`
- `src/app/data/` — mock data files (mockInvoices, mockPrepayments, mockVendors, mockVendorSearchData)
- `src/styles/` — theme.css, fonts.css, index.css, tailwind.css (adapted for v3)

**4. Update Entry Points**
- Update `src/main.tsx` to import `App` from `./app/App.tsx` and styles from `./styles/index.css`
- Update `src/App.tsx` or remove it (the new App.tsx lives in `src/app/`)
- Update `index.css` to import the new styles structure

**5. No Routing Changes Needed**
The source app uses **state-based navigation** (useState for screen switching), not react-router. The existing Lovable router in App.tsx will render the vendor invoicing App component at the root route.

**6. Adapt UI Component Paths**
All components import from `@/app/components/ui/...` — this will work with the existing `@` alias pointing to `src/`.

### Files to Create/Modify (~50+ files)
- All files under `src/app/` (new)
- `src/styles/` directory (new)  
- `src/main.tsx` (update imports)
- `src/index.css` (update to new theme)
- `tailwind.config.ts` (add new theme variables, colors)
- `package.json` (add dependencies)

