/* ═══════════════════════════════════════════════════════════════
   PLANNER DEV MODE STORE
   Publish/subscribe pattern — mirrors plannerSession.ts.

   A *dev-only* lever that flips the Procurement Planning tab between the
   two journeys the team is iterating on:

     · "first-time"  — the DEFAULT and the only journey real users get.
                       Every fresh load re-arms the first-run scope modal,
                       resets the scope clean, hides the resume-sandbox
                       banner, hides in-plan items from the listing, and
                       lands the sandbox graph-only. (See PODemands.tsx /
                       PlannerWorkspacePage.tsx gate comments.)

     · "recurring"   — the returning-user path, reachable ONLY through the
                       dev widget. Restores the saved scope directly (skips
                       the modal when there's something to restore), shows
                       the resume-sandbox banner, lists in-plan items, and
                       restores the last sandbox panel layout.

   IMPORTANT: the default is "first-time", so nothing changes for a real
   user unless a developer flips this. The recurring path was explicitly
   reverted as a production default — this store re-exposes it for
   comparison/refinement behind the dev widget only.
   ═══════════════════════════════════════════════════════════════ */

import { useSyncExternalStore } from "react";

export type PlannerUserMode = "first-time" | "recurring";

const MODE_KEY = "po:planner-dev-mode:v1";
const DEFAULT_MODE: PlannerUserMode = "first-time";

/* Every localStorage key the planner owns. Used by the dev widget's
   "reset to true first-time" action to wipe persisted state in one shot.
   Mirrors the keys declared in procurementPlanningParams.ts (params +
   saved-view), plannerSession.ts (session + view) and
   PlannerWorkspacePage.tsx (panels). Keep in sync if a key is added. */
export const PLANNER_STORAGE_KEYS = [
  "po:procurement-planning:params:v7",
  "po:procurement-planning:saved-view:v1",
  "po:planner-session:v1",
  "po:planner-view:v1",
  "po:planner-panels:v4",
] as const;

/* ── Internal state ──
   Replaced (never mutated) on change so `useSyncExternalStore` snapshots
   stay reference-stable between notifications. */
let _mode: PlannerUserMode = loadMode();

type Listener = () => void;
const _listeners = new Set<Listener>();

function loadMode(): PlannerUserMode {
  try {
    const raw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(MODE_KEY)
        : null;
    return raw === "recurring" || raw === "first-time" ? raw : DEFAULT_MODE;
  } catch {
    /* ignore malformed/disabled storage */
  }
  return DEFAULT_MODE;
}

function persist() {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(MODE_KEY, _mode);
    }
  } catch {
    /* ignore quota / disabled storage */
  }
}

function _notify() {
  _listeners.forEach((fn) => fn());
}

/* ── Public API ── */

export function getPlannerUserMode(): PlannerUserMode {
  return _mode;
}

export function setPlannerUserMode(next: PlannerUserMode) {
  if (next === _mode) return;
  _mode = next;
  persist();
  _notify();
}

export function subscribePlannerDevMode(fn: Listener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/** Convenience predicate for the load-time gate sites. */
export function isRecurringMode(): boolean {
  return _mode === "recurring";
}

/** Wipe every persisted planner key — the dev widget's "reset to a true
    first-time visitor" action. Callers reload immediately afterwards so the
    in-memory stores (plannerSession, etc.) re-initialise from clean storage. */
export function resetAllPlannerState() {
  try {
    if (typeof localStorage !== "undefined") {
      PLANNER_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
    }
  } catch {
    /* ignore disabled storage */
  }
}

/** React hook: subscribe to the current dev user-mode. */
export function usePlannerUserMode(): PlannerUserMode {
  return useSyncExternalStore(
    subscribePlannerDevMode,
    getPlannerUserMode,
    getPlannerUserMode,
  );
}
