

# Slice D1a — Execute Now

Spec is locked from the prior two greenlights. Approving this plan switches to default mode and the implementation runs in the next turn exactly as documented.

## Files

**Create**
- `src/app/components/modules/itemDetail/ItemDetailHeader.tsx`

**Edit**
- `src/app/components/modules/ItemDetail.tsx` — remove breadcrumb `<nav>` (~1441–1447), static header card (~1449–1620), tab bar wrapper (~1624–1676). Mount `<ItemDetailHeader>`. Lift `isFullscreen` state. Accept `scrollContainerRef` prop. Keep `<Tabs>` shell + all 7 `<TabsContent>` blocks untouched. `@ts-nocheck` stays.
- `src/app/pages/ItemDetailPage.tsx` — drop `max-w-[1152px] mx-auto p-4 lg:p-8` wrapper. New container `<div ref={scrollContainerRef} className="flex flex-col h-full overflow-y-auto bg-slate-50">`. Pass `scrollContainerRef` to `<ItemDetail>`.

## ItemDetailHeader.tsx contract

**Props**: `item, activeTab, onTabChange, onBack, onEdit, onDuplicate?, isFullscreen, onFullscreenChange, scrollContainerRef`

**Internal state**: `isScrolled` (IntersectionObserver on sentinel, root = `scrollContainerRef.current`), `descExpanded`

**Layout**
- Sentinel `<div ref={sentinelRef} className="shrink-0 h-px" />` above sticky wrapper
- Sticky wrapper `sticky top-[48px] z-20 bg-slate-50`
- Container `mx-auto px-4 lg:px-6 xl:px-8` + `max-w-full` when fullscreen else `max-w-[1440px] 2xl:max-w-[1600px]`
- Card `bg-white border border-border rounded-xl overflow-hidden`, shadow upgrades on scroll
- Top row morph: padding `16px 20px → 10px 14px`, back button 44→32, thumbnail 44→32, name `16/700 → 13/600`, description hidden when `isScrolled`
- Badge row: static StatusPill (Partners visual, no dropdown wired) · Acquisition pill · Manufacturer chip · Primary category + `+N` popover
- Right controls: Fullscreen toggle (Maximize2/Minimize2) · Actions dropdown (Duplicate / Audit Log / Share / Deactivate) · Edit CTA — all compact when scrolled
- Inner tab bar inside card with `border-t border-muted overflow-x-auto`, underline-active, all 7 tab IDs preserved
- Bottom gradient fade `h-2 bg-gradient-to-b from-slate-50 to-transparent` when scrolled
- Scroll-to-top FAB `fixed bottom-6 right-6 w-10 h-10 rounded-full bg-white border shadow-md z-30`, scrolls `scrollContainerRef.current`
- All morph transitions: inline `style` with `transition: all 250ms ease`

## Verification (10 steps)

1. `bun run build` passes
2. `/items/1` renders new sticky card with thumbnail, name, badges, description, right controls, inner tab bar
3. Scroll → morph (back/avatar 44→32, name 16→13/700→600, description hides)
4. Bottom gradient fade on scroll
5. Scroll-to-top FAB appears + works
6. Fullscreen toggle expands/restores max-width
7. Actions dropdown opens (Duplicate / Audit Log / Share / Deactivate)
8. Edit CTA fires existing handler unchanged
9. **Cross-tab check** — click through all 7 tabs (Overview, Inventory, Configurations, Purchasing, Production, Sales, Attachments) at wider container. If any body breaks, re-introduce `max-w-[1152px]` inside that tab body (not the page wrapper)
10. No console errors

## Report after execution

- Files created (line count)
- Files edited (diff size)
- Build exit status
- Cross-tab check result + any sub-fixes applied
- Any runtime issues
- Scope deviation (expected: none)

## Stop

After D1a + verification + report. Do not start D1b.

