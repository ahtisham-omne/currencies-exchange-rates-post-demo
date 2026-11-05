/* ═══════════════════════════════════════════════════════════════
   PLANNER SESSION STORE
   Publish/subscribe pattern — mirrors cartStore / poStore architecture.

   Holds the buyer's *planning session*: the set of items currently open
   as tabs in the full-screen Procurement Planning workspace
   (`/purchase-orders/plan/:itemCode`). The active tab is driven by the
   route param; this store only owns which items are open and their tab
   order, so the session survives navigation and refreshes.
   ═══════════════════════════════════════════════════════════════ */

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "po:planner-session:v1";

/* The buyer's tab-grouping view preference. Durable like the open-tab set
   (survives navigation + refresh), but kept on a SEPARATE storage key so the
   open-items payload at STORAGE_KEY stays a bare string[]. */
const VIEW_KEY = "po:planner-view:v1";

/* The most-recent item the buyer was planning on in the workspace. Set every
   time the sandbox mounts / the route param changes, so the listing can
   surface a "Continue with <item>" jump-back affordance. Own storage key so
   older sessions without this value migrate silently. */
const LAST_ACTIVE_KEY = "po:planner-last-active:v1";

export type PlannerGroupBy =
  | "category"
  | "owner"
  | "severity"
  | "none";
const GROUP_BY_VALUES: readonly PlannerGroupBy[] = [
  "category",
  "owner",
  "severity",
  "none",
];
// NOTE: "vendor" was removed as a grouping dimension. Any persisted
// `groupBy: "vendor"` from an earlier session is no longer a valid value, so
// `loadGroupBy()` (which validates against GROUP_BY_VALUES) falls it back to
// DEFAULT_GROUP_BY ("category") automatically — no migration needed.
const DEFAULT_GROUP_BY: PlannerGroupBy = "category";

/* ── Internal state ──
   `_openItems` is the ordered list of item codes open as tabs. Replaced
   immutably on every mutation so `useSyncExternalStore` sees a stable
   reference between changes (no render loops). */
let _openItems: string[] = loadOpenItems();

/* Tab-grouping view-state. `_collapsedGroups` is keyed by the *current*
   grouping dimension's group keys, so it is reset whenever `_groupBy` changes.
   Both are replaced immutably on mutation so `useSyncExternalStore` snapshots
   stay reference-stable between notifications (no render loops). */
let _groupBy: PlannerGroupBy = loadGroupBy();
let _collapsedGroups: Set<string> = loadCollapsedGroups();
let _lastActiveItem: string | null = loadLastActiveItem();

type Listener = () => void;
const _listeners = new Set<Listener>();

function loadOpenItems(): string[] {
  try {
    const raw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(STORAGE_KEY)
        : null;
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === "string");
    }
    // Tolerant of an earlier `{ openItems: [...] }` shape.
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as { openItems?: unknown }).openItems)
    ) {
      return (parsed as { openItems: unknown[] }).openItems.filter(
        (x): x is string => typeof x === "string",
      );
    }
  } catch {
    /* ignore malformed storage */
  }
  return [];
}

function loadView(): { groupBy?: unknown; collapsedGroups?: unknown } {
  try {
    const raw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(VIEW_KEY)
        : null;
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as { groupBy?: unknown; collapsedGroups?: unknown };
    }
  } catch {
    /* ignore malformed storage */
  }
  return {};
}

function loadGroupBy(): PlannerGroupBy {
  const g = loadView().groupBy;
  return GROUP_BY_VALUES.includes(g as PlannerGroupBy)
    ? (g as PlannerGroupBy)
    : DEFAULT_GROUP_BY;
}

function loadCollapsedGroups(): Set<string> {
  const c = loadView().collapsedGroups;
  if (Array.isArray(c)) {
    return new Set(c.filter((x): x is string => typeof x === "string"));
  }
  return new Set();
}

function loadLastActiveItem(): string | null {
  try {
    const raw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(LAST_ACTIVE_KEY)
        : null;
    if (typeof raw === "string" && raw.length > 0) return raw;
  } catch {
    /* ignore malformed / disabled storage */
  }
  return null;
}

function persistLastActiveItem() {
  try {
    if (typeof localStorage !== "undefined") {
      if (_lastActiveItem) {
        localStorage.setItem(LAST_ACTIVE_KEY, _lastActiveItem);
      } else {
        localStorage.removeItem(LAST_ACTIVE_KEY);
      }
    }
  } catch {
    /* ignore quota / disabled storage */
  }
}

function persist() {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_openItems));
    }
  } catch {
    /* ignore quota / disabled storage */
  }
}

function persistView() {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(
        VIEW_KEY,
        JSON.stringify({
          groupBy: _groupBy,
          collapsedGroups: [..._collapsedGroups],
        }),
      );
    }
  } catch {
    /* ignore quota / disabled storage */
  }
}

function _notify() {
  _listeners.forEach((fn) => fn());
}

function _commit(next: string[]) {
  _openItems = next;
  persist();
  _notify();
}

/* ── Public API ── */

export function getOpenPlannerItems(): string[] {
  return _openItems;
}

export function subscribePlannerSession(fn: Listener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/** Open an item as a tab (idempotent). Appends to the end of the tab
    order if not already open. Returns nothing — the active tab is the
    caller's responsibility (route param). */
export function openPlannerItem(itemCode: string) {
  if (!itemCode) return;
  if (_openItems.includes(itemCode)) return;
  _commit([..._openItems, itemCode]);
}

/** Close a tab. Returns the item code the workspace should fall back to
    as the new active tab (the neighbour to the left, else the new first
    tab), or `null` when no tabs remain. */
export function closePlannerItem(itemCode: string): string | null {
  const idx = _openItems.indexOf(itemCode);
  if (idx < 0) {
    // Nothing to close — report whatever is currently first.
    return _openItems[0] ?? null;
  }
  const next = _openItems.filter((c) => c !== itemCode);
  _commit(next);
  const fallback = next.length === 0
    ? null
    // Prefer the left neighbour; if we closed the first tab, take the new first.
    : next[Math.min(Math.max(0, idx - 1), next.length - 1)] ?? null;
  // Keep the "last active" pointer honest — if the buyer closed the very tab
  // they were last on, forward it to the fallback (or clear when no tabs remain).
  if (_lastActiveItem === itemCode) {
    _lastActiveItem = fallback;
    persistLastActiveItem();
  }
  return fallback;
}

/** Close every tab — used when the buyer exits the workspace entirely. */
export function clearPlannerSession() {
  if (_openItems.length === 0 && _lastActiveItem == null) return;
  _openItems = [];
  _lastActiveItem = null;
  persist();
  persistLastActiveItem();
  _notify();
}

/* ── Tab-grouping view-state ── */

export function getPlannerGroupBy(): PlannerGroupBy {
  return _groupBy;
}

/** Switch the grouping dimension. Resets the collapsed-group set, since a
    collapsed key only has meaning relative to the dimension that produced it. */
export function setPlannerGroupBy(next: PlannerGroupBy) {
  if (next === _groupBy) return;
  _groupBy = next;
  _collapsedGroups = new Set();
  persistView();
  _notify();
}

export function getCollapsedGroups(): Set<string> {
  return _collapsedGroups;
}

/** Toggle one group's collapsed state. Replaces the Set immutably so the
    `useSyncExternalStore` snapshot reference stays stable between changes. */
export function toggleGroupCollapsed(key: string) {
  const next = new Set(_collapsedGroups);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  _collapsedGroups = next;
  persistView();
  _notify();
}

/** React hook: subscribe to the open-tab set. */
export function useOpenPlannerItems(): string[] {
  return useSyncExternalStore(
    subscribePlannerSession,
    getOpenPlannerItems,
    getOpenPlannerItems,
  );
}

/** React hook: subscribe to the grouping dimension. */
export function usePlannerGroupBy(): PlannerGroupBy {
  return useSyncExternalStore(
    subscribePlannerSession,
    getPlannerGroupBy,
    getPlannerGroupBy,
  );
}

/** React hook: subscribe to the collapsed-group set. */
export function useCollapsedGroups(): Set<string> {
  return useSyncExternalStore(
    subscribePlannerSession,
    getCollapsedGroups,
    getCollapsedGroups,
  );
}

/* ── Last-active item (workspace continuity) ── */

export function getLastActiveItem(): string | null {
  return _lastActiveItem;
}

/** Stamp the most-recent item the buyer was planning on. Called from the
    workspace whenever the route param resolves to a real item — so the
    listing can offer a one-click "Continue with <item>" jump-back. */
export function setLastActiveItem(itemCode: string | null) {
  const next = itemCode && itemCode.length > 0 ? itemCode : null;
  if (next === _lastActiveItem) return;
  _lastActiveItem = next;
  persistLastActiveItem();
  _notify();
}

/** React hook: subscribe to the last-active item. */
export function useLastActiveItem(): string | null {
  return useSyncExternalStore(
    subscribePlannerSession,
    getLastActiveItem,
    getLastActiveItem,
  );
}
