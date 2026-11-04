/**
 * ═══════════════════════════════════════════════════════════════
 * RESPONSIVE GUIDELINES — Single source of truth for layout rules
 * ═══════════════════════════════════════════════════════════════
 *
 * Tailwind mobile-first breakpoints:
 *   sm: 640px  |  md: 768px  |  lg: 1024px  |  xl: 1280px
 *
 * ── LAYOUT PATTERN DETECTION ──────────────────────────────────
 *
 * Pattern B — Centered, constrained-width pages (no sidebar).
 *   Used for: Dashboard (max-w-[1440px]), Detail pages (max-w-[1152px]).
 *   Full viewport width → use standard md: and lg: breakpoints.
 *
 * Pattern C2 — Full-width pages with a fixed left sidebar.
 *   Used for: Listing pages, configuration pages.
 *   Because ~56-260px of sidebar space is consumed, shift
 *   toolbar/filter-bar wrapping to xl: instead of md: and shift
 *   grid column increases one tier higher.
 *
 * ── RESPONSIVE RULES BY ELEMENT TYPE ─────────────────────────
 *
 * Page Headers (breadcrumb + title + action buttons):
 *   Default: flex-col
 *   md: flex-row items-center justify-between
 *
 * KPI / Stats Card Grids:
 *   Default: grid-cols-1
 *   sm: grid-cols-2
 *   lg: grid-cols-4 (or 5 depending on count)
 *   Dynamic: adapt column count to number of active cards
 *
 * KPI Strips (inline stat row with dividers):
 *   Default: grid-cols-2
 *   md: grid-cols-5 with md:border-l dividers
 *
 * Widget / Content Grids (dashboard cards):
 *   Default: grid-cols-1
 *   lg: grid-cols-3 with lg:col-span-2 / lg:col-span-3
 *
 * Toolbars & Filter Bars:
 *   Pattern B: flex-col → md:flex-row
 *   Pattern C2: flex-col → xl:flex-row xl:items-center
 *     Search: flex-1 xl:w-[240px]
 *     Tab/filter groups: w-full xl:w-auto
 *
 * Data Tables:
 *   Always overflow-x-auto for horizontal scroll on small viewports
 *   Tables never collapse — they scroll horizontally
 *
 * Tab Navigation:
 *   overflow-x-auto no-scrollbar for horizontal scrolling on mobile
 *   Tab width: w-full sm:w-auto
 *
 * Side-by-Side Content (charts + legends, status panels):
 *   Default: flex-col
 *   lg: flex-row
 *
 * Alert / Warning Card Grids:
 *   Default: grid-cols-1
 *   md: grid-cols-3
 *
 * 2-Column Status / Detail Panels:
 *   Default: grid-cols-1
 *   lg: grid-cols-2
 *
 * Grid-View Card Layouts (product cards, media thumbnails):
 *   Pattern B: grid-cols-2 md:grid-cols-4 lg:grid-cols-6
 *   Pattern C2: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
 *
 * Secondary Action Buttons (Print, Export):
 *   Hide on small: hidden sm:flex or hidden sm:inline
 *   Dividers: hidden sm:block
 *
 * Modals / Dialogs:
 *   Standard: sm:max-w-[425px]
 *   Image preview: sm:max-w-3xl with flex-col md:flex-row
 *
 * Side Drawers / Sheets:
 *   Width: w-[420px] sm:w-[540px]
 *
 * Document Card Grids:
 *   Default: grid-cols-1
 *   md: grid-cols-2 or md:grid-cols-3
 *
 * ── GLOBAL OUTER PADDING ─────────────────────────────────────
 *   Default: p-4
 *   lg: lg:p-8
 *
 * ── HIGH-RES PADDING SCALE (2K / 4K) ────────────────────────
 *   All pages use the same horizontal padding scale for
 *   consistent visual margins across breakpoints:
 *     Base:  px-4   (16px)
 *     lg:    lg:px-8  (32px)
 *     2xl:   2xl:px-16 (64px)
 *     3xl:   3xl:px-24 (96px)
 *
 * ── SIDEBAR OFFSET (Pattern C2 only) ─────────────────────────
 *   Main content area inherits from AppShell flex layout.
 *   Sidebar manages its own collapsed/expanded width.
 */

/* ── Tailwind class presets for quick reference ── */

/*
 * ── COMPOSABLE PADDING SCALE ────────────────���────────────────
 * Horizontal padding is aligned across ALL pages (Pattern B & C2)
 * for consistent visual margins at every breakpoint.
 * Vertical padding varies per section — compose with PX below.
 */

/** Aligned horizontal padding — shared by all pages */
export const PX = "px-4 lg:px-8 2xl:px-16 3xl:px-24";

/** Pattern C2 — Main content area (inside AppShell) */
export const PATTERN_C2_CONTENT = "px-4 pt-5 pb-4 lg:px-8 lg:pb-8 2xl:px-16 3xl:px-24";

/** Dashboard / Module home — outer padding */
export const DASHBOARD_PADDING = "p-4 lg:p-6 lg:px-8 2xl:px-16 3xl:px-24";

/** Page header — responsive flex */
export const PAGE_HEADER_FLEX = "flex flex-col gap-3 md:flex-row md:items-center md:justify-between";

/** Tab nav — scrollable on mobile */
export const TAB_NAV = "overflow-x-auto no-scrollbar";

/** Side-by-side content */
export const SIDE_BY_SIDE = "flex flex-col gap-6 lg:flex-row";