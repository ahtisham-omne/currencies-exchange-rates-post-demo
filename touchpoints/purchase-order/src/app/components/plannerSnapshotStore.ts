/* ═══════════════════════════════════════════════════════════════
   PLANNER GRAPH SNAPSHOTS
   ───────────────────────────────────────────────────────────────
   A "snapshot" is the buyer's frozen picture of the planning graph
   at one moment: their plot intent (allocations, extra POs, drag
   overrides, simulated txns, horizon, recommendation config) PLUS
   a fingerprint of the world around it (real event IDs + item
   thresholds at save time). Snapshots are per-item, timestamped,
   optionally named, and persisted to localStorage.

   Compare uses the intent + world fingerprint to overlay curves and
   surface a "what changed since" delta. Execute re-projects the
   intent against the CURRENT world and warns when new/removed
   events would change the outcome.

   Publish/subscribe pattern mirrors plannerRecommendationStore and
   plannerSession — a single localStorage key + a listener set +
   `useSyncExternalStore` for React consumers.
   ═══════════════════════════════════════════════════════════════ */

import { useSyncExternalStore } from "react";
import type { RecommendationConfig } from "./plannerRecommendationStore";
import type { SimulatedTxn } from "./UnifiedTransactionStream";

const STORAGE_KEY = "po:planner-snapshots:v1";

/** The buyer's intent — everything they've plotted / overridden. */
export interface PlannerSnapshotIntent {
  /** Vendor primary allocations (`Map<vendorId, qty>` serialized). */
  allocations: Array<[string, number]>;
  /** Per-vendor proposed arrival days (`Map<vendorId, day>` serialized). */
  proposedArrival: Array<[string, number]>;
  /** Extra POs added on the Timeline. */
  extraPOs: Array<{ id: string; vendorId: string; qty: number; arrivalDay: number }>;
  /** Predicted mock transactions on the graph. */
  mockEvents: Array<{ id: string; kind: "demand" | "supply"; qty: number; day: number; label: string; excluded?: boolean }>;
  /** Simulated what-ifs from the transaction table. */
  simulatedTxns: SimulatedTxn[];
  /** Manual overrides — rescheduled/excluded real events. */
  overrides: Array<[string, { dayOffset?: number; excluded?: boolean }]>;
  /** Selected qualified vendors at save time. */
  selectedVendorIds: string[];
  /** Horizon window. */
  horizonDays: number;
  horizonStartDay: number;
  /** Which item-library rule / custom config the buyer had picked. */
  recommendationConfig: RecommendationConfig;
}

/** A fingerprint of the item + real events at snapshot time — used
    to detect drift when the snapshot is later opened or executed. */
export interface PlannerSnapshotWorld {
  onHand: number;
  minLevel: number;
  maxLevel: number;
  /** IDs of real demand events visible at save time. */
  demandEventIds: string[];
  /** IDs of real incoming POs visible at save time. */
  incomingIds: string[];
  /** IDs of draft POs visible at save time. */
  draftPOIds: string[];
  /** IDs of vendors qualified on the item at save time. */
  qualifiedVendorIds: string[];
}

/** Summary metrics cached at save time — the drawer + compare
    surface these without re-running projection. */
export interface PlannerSnapshotMetrics {
  poCount: number;
  vendorCount: number;
  totalUnits: number;
  totalCost: number;
  /** POs arriving after the item's need-by (or arrival past horizon). */
  lateCount: number;
}

export interface PlannerSnapshot {
  id: string;
  itemCode: string;
  name: string;
  /** Epoch ms — sortable, comparable, no timezone assumption. */
  createdAt: number;
  intent: PlannerSnapshotIntent;
  world: PlannerSnapshotWorld;
  metrics: PlannerSnapshotMetrics;
  /** Per-day projected on-hand values captured at snapshot time
   *  (`curve.map(p => p.atp)` from the workspace's live projection).
   *  Powers the plan image / sparkline in the compare modal — the
   *  reader gets to see what the plan *looked like* without
   *  re-running projectAtpCurve against possibly-drifted data. */
  curvePreview?: number[];
}

/* ── Storage layer ─────────────────────────────────────────────── */

/** All snapshots, grouped by itemCode. Missing key = no snapshots. */
type SnapshotMap = Record<string, PlannerSnapshot[]>;

let _snapshots: SnapshotMap = load();
type Listener = () => void;
const _listeners = new Set<Listener>();

function load(): SnapshotMap {
  try {
    const raw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(STORAGE_KEY)
        : null;
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: SnapshotMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        out[k] = v.filter((x) => x && typeof x === "object" && "id" in x && "intent" in x) as PlannerSnapshot[];
      }
    }
    return out;
  } catch {
    return {};
  }
}

function persist() {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_snapshots));
    }
  } catch {
    /* ignore quota / disabled storage */
  }
}

function _notify() {
  _listeners.forEach((fn) => fn());
}

/* ── Public API ────────────────────────────────────────────────── */

export function listSnapshots(itemCode: string): PlannerSnapshot[] {
  return _snapshots[itemCode] ?? [];
}

export function addSnapshot(snap: PlannerSnapshot): void {
  const list = _snapshots[snap.itemCode] ?? [];
  _snapshots = { ..._snapshots, [snap.itemCode]: [snap, ...list] };
  persist();
  _notify();
}

export function removeSnapshot(itemCode: string, id: string): void {
  const list = _snapshots[itemCode] ?? [];
  const next = list.filter((s) => s.id !== id);
  if (next.length === list.length) return;
  if (next.length === 0) {
    const nextMap = { ..._snapshots };
    delete nextMap[itemCode];
    _snapshots = nextMap;
  } else {
    _snapshots = { ..._snapshots, [itemCode]: next };
  }
  persist();
  _notify();
}

export function renameSnapshot(itemCode: string, id: string, name: string): void {
  const list = _snapshots[itemCode] ?? [];
  const idx = list.findIndex((s) => s.id === id);
  if (idx < 0) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  if (list[idx].name === trimmed) return;
  const next = list.slice();
  next[idx] = { ...next[idx], name: trimmed };
  _snapshots = { ..._snapshots, [itemCode]: next };
  persist();
  _notify();
}

export function getSnapshot(itemCode: string, id: string): PlannerSnapshot | null {
  return (_snapshots[itemCode] ?? []).find((s) => s.id === id) ?? null;
}

function subscribe(fn: Listener): () => void {
  _listeners.add(fn);
  return () => {
    _listeners.delete(fn);
  };
}

/** React hook — subscribes to the snapshot list for a specific item. */
export function useSnapshotsForItem(itemCode: string | null | undefined): PlannerSnapshot[] {
  return useSyncExternalStore(
    subscribe,
    () => (itemCode ? _snapshots[itemCode] ?? EMPTY : EMPTY),
    () => (itemCode ? _snapshots[itemCode] ?? EMPTY : EMPTY),
  );
}
const EMPTY: PlannerSnapshot[] = [];

/* ── Helpers used by callers ───────────────────────────────────── */

/** Compare a snapshot's world fingerprint against the current one and
    return the additions / removals for each real-event stream. Used
    by the "since snapshot" banner and by execute-time confirmation. */
export interface SnapshotWorldDiff {
  demand: { added: string[]; removed: string[] };
  incoming: { added: string[]; removed: string[] };
  drafts: { added: string[]; removed: string[] };
  vendors: { added: string[]; removed: string[] };
  onHandDelta: number; // current − snapshot
  minLevelChanged: boolean;
  maxLevelChanged: boolean;
  hasAnyChange: boolean;
}

export function diffSnapshotWorld(
  snap: PlannerSnapshot,
  current: PlannerSnapshotWorld,
): SnapshotWorldDiff {
  const addedRemoved = (a: string[], b: string[]) => {
    const setA = new Set(a);
    const setB = new Set(b);
    const added: string[] = [];
    const removed: string[] = [];
    for (const id of b) if (!setA.has(id)) added.push(id);
    for (const id of a) if (!setB.has(id)) removed.push(id);
    return { added, removed };
  };
  const demand = addedRemoved(snap.world.demandEventIds, current.demandEventIds);
  const incoming = addedRemoved(snap.world.incomingIds, current.incomingIds);
  const drafts = addedRemoved(snap.world.draftPOIds, current.draftPOIds);
  const vendors = addedRemoved(snap.world.qualifiedVendorIds, current.qualifiedVendorIds);
  const onHandDelta = current.onHand - snap.world.onHand;
  const minLevelChanged = current.minLevel !== snap.world.minLevel;
  const maxLevelChanged = current.maxLevel !== snap.world.maxLevel;
  const hasAnyChange =
    demand.added.length > 0 ||
    demand.removed.length > 0 ||
    incoming.added.length > 0 ||
    incoming.removed.length > 0 ||
    drafts.added.length > 0 ||
    drafts.removed.length > 0 ||
    vendors.added.length > 0 ||
    vendors.removed.length > 0 ||
    onHandDelta !== 0 ||
    minLevelChanged ||
    maxLevelChanged;
  return {
    demand,
    incoming,
    drafts,
    vendors,
    onHandDelta,
    minLevelChanged,
    maxLevelChanged,
    hasAnyChange,
  };
}

/** Short human summary of a diff — used for the restore banner. */
export function summarizeDiff(diff: SnapshotWorldDiff): string {
  const parts: string[] = [];
  if (diff.demand.added.length > 0) {
    parts.push(`${diff.demand.added.length} new sales order${diff.demand.added.length === 1 ? "" : "s"}`);
  }
  if (diff.demand.removed.length > 0) {
    parts.push(`${diff.demand.removed.length} removed sales order${diff.demand.removed.length === 1 ? "" : "s"}`);
  }
  if (diff.incoming.added.length > 0) {
    parts.push(`${diff.incoming.added.length} new incoming purchase order${diff.incoming.added.length === 1 ? "" : "s"}`);
  }
  if (diff.incoming.removed.length > 0) {
    parts.push(`${diff.incoming.removed.length} removed incoming purchase order${diff.incoming.removed.length === 1 ? "" : "s"}`);
  }
  if (diff.drafts.added.length > 0) {
    parts.push(`${diff.drafts.added.length} new draft purchase order${diff.drafts.added.length === 1 ? "" : "s"}`);
  }
  if (diff.onHandDelta !== 0) {
    parts.push(
      diff.onHandDelta > 0
        ? `on-hand up ${diff.onHandDelta}`
        : `on-hand down ${Math.abs(diff.onHandDelta)}`,
    );
  }
  if (diff.minLevelChanged) parts.push("minimum changed");
  if (diff.maxLevelChanged) parts.push("maximum changed");
  return parts.length > 0 ? parts.join(", ") : "no changes";
}
