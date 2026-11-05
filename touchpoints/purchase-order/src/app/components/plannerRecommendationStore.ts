/* ═══════════════════════════════════════════════════════════════
   PLANNER RECOMMENDATION MODE STORE
   Publish/subscribe pattern — mirrors plannerSession / cartStore.
   Holds a per-item "auto-supply" recommendation mode that the buyer
   picks in the sandbox: OFF (default), or one of ZERO / MIN / MAX.

   When the mode is not OFF, the workspace synthesises supply events
   that lift the projected curve back to the picked threshold. Turning
   the mode OFF removes them cleanly (the events are ephemeral — never
   persisted, never committed).
   ═══════════════════════════════════════════════════════════════ */

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "po:planner-recommendation-modes:v1";
const CONFIG_STORAGE_KEY = "po:planner-recommendation-configs:v2";

export type RecommendationMode = "off" | "zero" | "min" | "max";
const MODE_VALUES: readonly RecommendationMode[] = ["off", "zero", "min", "max"];
const DEFAULT_MODE: RecommendationMode = "off";

/* ── Trigger / Fill-to / Source (Eli's fullest spec) ──
   Buyer feedback 2026-07-14: the classic dropdown collapsed *when to
   fire* and *how much to buy* into one label, but they're independent
   decisions. A cheap non-perishable item might trigger at below-min
   yet fill to max (bulk buy to amortize the $45/PO admin cost); a
   perishable one triggers at below-min and fills to min.
   ─────────────────────────────────────────────────────
   Trigger = the threshold projected on-hand must dip below to fire a
             PO. `"off"` = engine idle.
   FillTo  = the level a fired PO tops the running curve back up to.
   Source  = which knob the buyer is using:
             `item-master` — follows the item card's rule (defaults
               `trigger:min, fillTo:max`; if the item ever carries its
               own rule config we read it from there).
             `manual` — buyer picked trigger + fillTo directly in
               the dropdown. */
export type RecommendationTrigger = "off" | "zero" | "min" | "max";
export type RecommendationFillTo = "zero" | "min" | "max";
export type RecommendationSource = "item-master" | "manual";

export interface RecommendationConfig {
  source: RecommendationSource;
  trigger: RecommendationTrigger;
  fillTo: RecommendationFillTo;
}

const TRIGGER_VALUES: readonly RecommendationTrigger[] = ["off", "zero", "min", "max"];
const FILL_VALUES: readonly RecommendationFillTo[] = ["zero", "min", "max"];
const SOURCE_VALUES: readonly RecommendationSource[] = ["item-master", "manual"];

/** Item-master default rule — the recipe the "item card" implies.
    Eli's baseline: trigger at below-min, fill up to max (amortize the
    per-PO admin cost). If a future item ever carries its own explicit
    trigger/fillTo, thread it through from there. */
export const ITEM_MASTER_DEFAULT_CONFIG: RecommendationConfig = {
  source: "item-master",
  trigger: "min",
  fillTo: "max",
};
export const OFF_CONFIG: RecommendationConfig = {
  source: "manual",
  trigger: "off",
  fillTo: "min",
};

/** Convert a legacy single-mode value into a config, for read-through
    from the old localStorage payload. Each legacy mode = trigger AND
    fillTo at the same level. */
function configFromLegacyMode(mode: RecommendationMode): RecommendationConfig {
  if (mode === "off") return OFF_CONFIG;
  return { source: "manual", trigger: mode, fillTo: mode };
}

/** Derive the classic single-mode for callers that still use it
    (`computeAutoSupplyEvents` fallback + on-graph "auto · min" labels).
    Uses trigger when firing, `off` otherwise. */
export function legacyModeFromConfig(cfg: RecommendationConfig): RecommendationMode {
  return cfg.trigger;
}

/* Per-item mode map, keyed by itemCode. Missing key = DEFAULT_MODE. */
let _modes: Record<string, RecommendationMode> = load();
let _configs: Record<string, RecommendationConfig> = loadConfigs();
/* Migrate legacy `_modes` entries into `_configs` at boot so
   `getRecommendationConfig` always finds a stored config for known
   items. Without this, the fallback path built a NEW config object
   on every call — useSyncExternalStore then saw a "new" value every
   render and re-rendered forever. Buyer feedback 2026-07-14
   ("Maximum update depth exceeded"). */
for (const [k, mode] of Object.entries(_modes)) {
  if (!_configs[k]) _configs[k] = configFromLegacyMode(mode);
}
type Listener = () => void;
const _listeners = new Set<Listener>();

function load(): Record<string, RecommendationMode> {
  try {
    const raw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(STORAGE_KEY)
        : null;
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, RecommendationMode> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof k === "string" && MODE_VALUES.includes(v as RecommendationMode)) {
        out[k] = v as RecommendationMode;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function loadConfigs(): Record<string, RecommendationConfig> {
  try {
    const raw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(CONFIG_STORAGE_KEY)
        : null;
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, RecommendationConfig> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (
        typeof k === "string" &&
        v &&
        typeof v === "object" &&
        !Array.isArray(v)
      ) {
        const raw = v as Record<string, unknown>;
        const source = raw.source;
        const trigger = raw.trigger;
        const fillTo = raw.fillTo;
        if (
          SOURCE_VALUES.includes(source as RecommendationSource) &&
          TRIGGER_VALUES.includes(trigger as RecommendationTrigger) &&
          FILL_VALUES.includes(fillTo as RecommendationFillTo)
        ) {
          out[k] = {
            source: source as RecommendationSource,
            trigger: trigger as RecommendationTrigger,
            fillTo: fillTo as RecommendationFillTo,
          };
        }
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_modes));
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(_configs));
    }
  } catch {
    /* ignore quota / disabled storage */
  }
}

function _notify() {
  _listeners.forEach((fn) => fn());
}

export function getRecommendationMode(itemCode: string): RecommendationMode {
  const cfg = _configs[itemCode];
  if (cfg) return cfg.trigger;
  return _modes[itemCode] ?? DEFAULT_MODE;
}

export function setRecommendationMode(itemCode: string, mode: RecommendationMode) {
  setRecommendationConfig(itemCode, configFromLegacyMode(mode));
}

/** Look up the full config. When only the legacy single-mode is stored
    (older localStorage), synthesise a config from it so callers never
    see a "no config" state. Untouched items fall back to OFF. */
export function getRecommendationConfig(itemCode: string): RecommendationConfig {
  const cfg = _configs[itemCode];
  if (cfg) return cfg;
  const legacy = _modes[itemCode];
  if (legacy) return configFromLegacyMode(legacy);
  return OFF_CONFIG;
}

/** True when the buyer has explicitly set (or unset) a rule for this
    item. Callers use this to distinguish "user chose Off" from
    "never touched" — the latter should default to the item's own
    rule from the item library, not OFF. */
export function hasRecommendationConfig(itemCode: string): boolean {
  return _configs[itemCode] != null || _modes[itemCode] != null;
}

export function setRecommendationConfig(itemCode: string, cfg: RecommendationConfig) {
  const current = getRecommendationConfig(itemCode);
  if (
    current.source === cfg.source &&
    current.trigger === cfg.trigger &&
    current.fillTo === cfg.fillTo
  ) {
    return;
  }
  if (cfg.trigger === "off") {
    // Prune both stores so `off` doesn't grow the payload.
    const nextModes = { ..._modes };
    delete nextModes[itemCode];
    _modes = nextModes;
    const nextCfg = { ..._configs };
    delete nextCfg[itemCode];
    _configs = nextCfg;
  } else {
    _configs = { ..._configs, [itemCode]: cfg };
    _modes = { ..._modes, [itemCode]: cfg.trigger };
  }
  persist();
  _notify();
}

export function subscribeRecommendationMode(fn: Listener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/** React hook — subscribes to the mode for a specific item code. */
export function useRecommendationMode(itemCode: string | null | undefined): RecommendationMode {
  return useSyncExternalStore(
    subscribeRecommendationMode,
    () => (itemCode ? getRecommendationMode(itemCode) : DEFAULT_MODE),
    () => (itemCode ? getRecommendationMode(itemCode) : DEFAULT_MODE),
  );
}

/** React hook — subscribes to the full config for a specific item. */
export function useRecommendationConfig(
  itemCode: string | null | undefined,
): RecommendationConfig {
  return useSyncExternalStore(
    subscribeRecommendationMode,
    () => (itemCode ? getRecommendationConfig(itemCode) : OFF_CONFIG),
    () => (itemCode ? getRecommendationConfig(itemCode) : OFF_CONFIG),
  );
}

/* ─── Auto-supply generator ───
   Given a baseline curve (real events only) and a mode, produce a list of
   ephemeral supply events that lift the curve back to the picked threshold
   each time it dips. Deterministic; walks the curve once. Called from the
   workspace with the pre-auto curve, and the result is fed BACK into
   projectAtpCurve to render the enhanced curve. */

export interface AutoSupplyEvent {
  /** Day offset from today the auto supply lands on. */
  day: number;
  /** Quantity in the item's base UoM. */
  qty: number;
  /** Human label — surfaced on the graph as e.g. "Auto-supply · min". */
  label: string;
}

export function autoSupplyThreshold(
  mode: RecommendationMode,
  minLevel: number,
  maxLevel: number,
): number | null {
  if (mode === "off") return null;
  if (mode === "zero") return 0;
  if (mode === "min") return minLevel;
  return maxLevel;
}

/* ─── Item-master recommendation ─────────────────────────────────
   Derive the SUGGESTED order quantity from the item master (not the
   vendor). Buyer feedback 2026-07-14: "the suggested number must
   come from the item master rules … the UI must explain why". The
   returned `reason` is a short human string the day-detail card
   surfaces beneath the Plot button, e.g.:
     "Rule: bring to max (100 EA) · need 116 · ×25 · MOQ 50"

   Rounding + clamp order matches the buyer's mental model:
     1. Target level per recommendation mode (max / min / zero).
        When mode is off, we fall back to `min` as the implicit
        default (the buyer sees "min (default)" so it's obvious no
        explicit rule is set).
     2. Shortfall = ceil(target - currentAtp). Negative → 0 (already
        covered) and we still return `item.moq` so a Plot button
        never shows "0 EA".
     3. Round shortfall UP to `orderMultiples`.
     4. Floor at `item.moq`.
     5. Cap at `item.maxOrderQty`.

   All levers here are ITEM properties, not vendor. Vendor-specific
   MOQ / max / multiples are intentionally NOT read (that's a
   separate downstream concern — the vendor may reject if its own
   MOQ is higher; the UI already surfaces that under each row). */

export type ItemMasterMode = RecommendationMode;

interface ItemMasterInput {
  minLevel: number;
  maxLevel: number;
  moq: number;
  orderMultiples: number;
  maxOrderQty: number;
  baseUom: string;
}

export interface QtyRecommendation {
  qty: number;
  /** Which target level the rule aimed at ("max"/"min"/"zero"/"min (default)"). */
  targetLabel: string;
  /** The numeric target used. */
  targetLevel: number;
  /** Uncovered units before rounding: ceil(target − currentAtp), clamped ≥ 0. */
  shortfall: number;
  /** True when rounding up to `orderMultiples` changed the number. */
  rounded: boolean;
  /** True when `moq` bumped the number up. */
  moqApplied: boolean;
  /** True when `maxOrderQty` capped the number down. */
  capped: boolean;
  multiplesOf: number;
  moq: number;
  maxOrderQty: number;
  /** Short one-line "why" for the UI. */
  reason: string;
  /** Longer, multi-clause version — useful in tooltips. */
  detailedReason: string[];
}

export function recommendedQtyFromItemMaster(
  item: ItemMasterInput,
  currentAtp: number,
  mode: ItemMasterMode,
): QtyRecommendation {
  let target: number;
  let targetLabel: string;
  if (mode === "max") {
    target = item.maxLevel;
    targetLabel = "max";
  } else if (mode === "min") {
    target = item.minLevel;
    targetLabel = "min";
  } else if (mode === "zero") {
    target = 0;
    targetLabel = "zero";
  } else {
    target = item.minLevel;
    targetLabel = "min (default)";
  }

  const shortfallRaw = Math.ceil(target - currentAtp);
  const shortfall = Math.max(0, shortfallRaw);
  const mult = Math.max(1, item.orderMultiples);
  const preRound = shortfall > 0 ? shortfall : item.moq;
  const rounded = Math.ceil(preRound / mult) * mult;
  const wasRounded = rounded !== preRound && mult > 1;
  const withMOQ = Math.max(rounded, item.moq);
  const moqApplied = item.moq > 0 && withMOQ === item.moq && rounded < item.moq;
  const capped = withMOQ > item.maxOrderQty;
  const qty = Math.min(withMOQ, item.maxOrderQty);

  const uom = item.baseUom || "";
  const detailedReason: string[] = [];
  detailedReason.push(`Rule: bring to ${targetLabel} (${target}${uom ? ` ${uom}` : ""})`);
  if (shortfall > 0) {
    detailedReason.push(
      `Projected on-hand ${currentAtp >= 0 ? currentAtp : `−${Math.abs(currentAtp)}`}${
        uom ? ` ${uom}` : ""
      } → need ${shortfall}${uom ? ` ${uom}` : ""}`,
    );
  } else {
    detailedReason.push("Already covered → falling back to item MOQ");
  }
  if (wasRounded) {
    detailedReason.push(`Rounded up to multiple of ${mult} → ${rounded}${uom ? ` ${uom}` : ""}`);
  }
  if (moqApplied) {
    detailedReason.push(`Bumped up to item MOQ ${item.moq}${uom ? ` ${uom}` : ""}`);
  }
  if (capped) {
    detailedReason.push(`Capped at item max order ${item.maxOrderQty}${uom ? ` ${uom}` : ""}`);
  }

  const shortParts: string[] = [];
  shortParts.push(`Take to ${targetLabel}`);
  if (wasRounded) shortParts.push(`×${mult}`);
  if (moqApplied) shortParts.push(`MOQ ${item.moq}`);
  if (capped) shortParts.push(`capped ${item.maxOrderQty}`);
  const reason = shortParts.join(" · ");

  return {
    qty,
    targetLabel,
    targetLevel: target,
    shortfall,
    rounded: wasRounded,
    moqApplied,
    capped,
    multiplesOf: mult,
    moq: item.moq,
    maxOrderQty: item.maxOrderQty,
    reason,
    detailedReason,
  };
}

/**
 * Walk the baseline curve; every time projected ATP drops below the
 * TRIGGER threshold, push a supply event sized to lift the running
 * curve back to the FILL-TO level. Trigger and fill are independent —
 * e.g. trigger at "min" but fill to "max" is the classic
 * amortize-admin-cost recipe. The synthetic supply carries forward
 * from that day so we only emit ONE event per dip, not one per bad day.
 *
 * The buyer sees a clean line of auto events at each shortfall — one
 * dot per dip — that they can inspect, override with a real vendor
 * plot, or dismiss by turning auto Off.
 */
export function computeAutoSupplyEvents(
  baselineCurve: Array<{ day: number; atp: number }>,
  triggerOrConfig: RecommendationMode | RecommendationConfig,
  minLevel: number,
  maxLevel: number,
): AutoSupplyEvent[] {
  const cfg: RecommendationConfig =
    typeof triggerOrConfig === "string"
      ? configFromLegacyMode(triggerOrConfig)
      : triggerOrConfig;
  if (cfg.trigger === "off" || !baselineCurve.length) return [];

  const triggerLevel =
    cfg.trigger === "zero" ? 0 : cfg.trigger === "min" ? minLevel : maxLevel;
  const fillLevel =
    cfg.fillTo === "zero" ? 0 : cfg.fillTo === "min" ? minLevel : maxLevel;
  const label = `Auto-supply · ${cfg.trigger}→${cfg.fillTo}`;
  const running = baselineCurve.map((p) => p.atp);
  const events: AutoSupplyEvent[] = [];

  for (let i = 0; i < baselineCurve.length; i++) {
    if (running[i] < triggerLevel) {
      const shortfall = Math.ceil(Math.max(fillLevel, triggerLevel) - running[i]);
      if (shortfall <= 0) continue;
      events.push({
        day: baselineCurve[i].day,
        qty: shortfall,
        label,
      });
      // Lift the running curve from this day forward so we don't over-emit.
      for (let j = i; j < running.length; j++) running[j] += shortfall;
    }
  }
  return events;
}
