/* ═══════════════════════════════════════════════════════════════
   PLANNER DEV WIDGET  (dev / QA tool)

   A top-bar launcher for the Procurement Planning tab that lets the team:
     1. Switch the active journey between "first-time" and "recurring".
     2. Read the full scenario map for both journeys + see which one the
        current persisted state will produce on the next load.
     3. One-click set up a clean first-time visitor or a seeded recurring
        user (saved scope + an open sandbox session), then reload.

   This is the lever for refining the first-time journey: flip to
   "recurring" to see the returning-user path side-by-side, then tune
   first-time against it. The default / production journey is always
   first-time — this panel never changes that unless a developer flips it.

   The LAUNCHER renders inline so it can sit in a top bar (the listing's
   global TopBar actions slot, the workspace header's right cluster). The
   expanded PANEL is a fixed top-right dropdown with a click-away backdrop.
   Reads its state from plannerDevMode + plannerSession; no props.
   ═══════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import {
  Check,
  FlaskConical,
  RefreshCw,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";

import {
  type PlannerUserMode,
  resetAllPlannerState,
  setPlannerUserMode,
  usePlannerUserMode,
} from "./plannerDevMode";
import { openPlannerItem, useOpenPlannerItems } from "./plannerSession";
import {
  DEFAULT_PARAMS,
  loadParams,
  paramsEqual,
  type ProcurementPlanningParams,
  saveParams,
} from "./procurementPlanningParams";
import { PLANNER_ITEMS } from "./plannerData";

const VIOLET = "#0A77FF";
const PANELS_KEY = "po:planner-panels:v4";

/* Scope a seeded recurring user lands on — differs from DEFAULT_PARAMS so
   `hasActiveScope` is true and the table shows data straight away. SO + PR
   sources with the two critical bands return well over a handful of rows. */
const RECURRING_SCOPE: ProcurementPlanningParams = {
  ...DEFAULT_PARAMS,
  horizonDays: 90,
  sources: ["SO", "Request"],
  bands: ["below-zero", "below-min"],
};

/* A few curated item codes to seed an "active sandbox session" so the resume
   banner + in-plan behaviours have something to act on. Explicit (not
   slice(0,3)) so it stays on the recognisable curated items regardless of the
   PLANNER_ITEMS array order. Falls back to the first 3 if any are missing. */
const SANDBOX_SEED = (() => {
  const want = ["HYD-4420-A1", "BFA-4210-R2", "CLP-2290-M3"];
  const known = new Set(PLANNER_ITEMS.map((i) => i.itemCode));
  const picks = want.filter((c) => known.has(c));
  return picks.length ? picks : PLANNER_ITEMS.slice(0, 3).map((i) => i.itemCode);
})();

/* ── Scenario map ── */
type ModeTag = "first-time" | "recurring" | "both";
interface Scenario {
  id: string;
  title: string;
  expected: string;
  tag: ModeTag;
}

const ENTRY_SCENARIOS: Scenario[] = [
  {
    id: "ft",
    tag: "first-time",
    title: "Fresh load",
    expected:
      "Table renders immediately with default filters (categories I own · me as owner · 30d · mineOnly). No questionnaire wall — parked to the backlog 2026-07-31.",
  },
  {
    id: "rec-saved",
    tag: "recurring",
    title: "Return with saved scope",
    expected:
      "Table renders with the saved scope's data immediately.",
  },
  {
    id: "rec-empty",
    tag: "recurring",
    title: "Return, nothing saved",
    expected:
      "Table renders with default filters (same as first-time). No modal.",
  },
];

/* Parked scenarios — kept for reference so the team can see what the
   FTU questionnaire used to gate. Eli 2026-07-31: "keep in the
   backlog" — the code is still in PODemands.tsx behind an unreachable
   `!scopeApplied` branch. Flipping scopeApplied's initial state back
   to false would re-arm the FTU questionnaire. */
const BACKLOG_SCENARIOS: Scenario[] = [
  {
    id: "bl-ftu-questionnaire",
    tag: "first-time",
    title: "FTU scope questionnaire (parked)",
    expected:
      "Historically: fresh load showed an inline questionnaire (Sources / Categories / Bands / Owner / Planning window) as a wall before the table. Parked 2026-07-31 — table now loads with defaults instead.",
  },
];

const LISTING_SCENARIOS: Scenario[] = [
  {
    id: "match",
    tag: "both",
    title: "Scope applied · items match",
    expected: "Table renders the rows plus the “N of M items” count.",
  },
  {
    id: "nomatch",
    tag: "both",
    title: "Scope applied · no match",
    expected: "“No items match your filters” empty state.",
  },
  {
    id: "cleared",
    tag: "both",
    title: "Clear all / reset",
    expected: "“No results… apply filters to view data” empty state.",
  },
  {
    id: "bulk-add",
    tag: "both",
    title: "Select multiple · add to sandbox",
    expected:
      "Row checkboxes + a select-all header show; ticking rows reveals the “N selected” bar with “Create / Add to Sandbox (N)”, which opens them all as sandbox tabs in one action.",
  },
  {
    id: "resume",
    tag: "recurring",
    title: "Resume-sandbox banner",
    expected:
      "“N in sandbox / Resume sandbox” strip shows when a session exists. First-time never shows it.",
  },
  {
    id: "inplan",
    tag: "recurring",
    title: "In-plan items in the listing",
    expected:
      "Items already open in the sandbox are listed (with the “In plan” pill). First-time hides them.",
  },
];

const SANDBOX_SCENARIOS: Scenario[] = [
  {
    id: "s-ft",
    tag: "first-time",
    title: "Open sandbox",
    expected:
      "Lands graph-only — Qualified Vendors + Transactions panels start folded.",
  },
  {
    id: "s-rec",
    tag: "recurring",
    title: "Open sandbox",
    expected: "Restores your last panel layout (folds as you left them).",
  },
  {
    id: "s-nav",
    tag: "both",
    title: "Switch items in-session",
    expected:
      "Fold state persists across item switches; only a hard refresh re-folds.",
  },
];

/* Eli's 2026-07-31 auto-mode brief: gated vendor selection with two
   manual-resolve options when nothing fits. These rows document what to
   look for in the "Review N POs" modal (Sandbox → Auto → See on graph)
   and inside each card's "Why this vendor?" reveal. Applies to both
   journeys — auto mode isn't gated by first-time/recurring. */
const AUTO_STEP1_SCENARIOS: Scenario[] = [
  {
    id: "a-single",
    tag: "both",
    title: "Single-vendor solve",
    expected:
      "One vendor covers the whole need on time. Card has a blue accent, no late pill. Reveal badge: SINGLE-VENDOR SOLVE. Candidate table shows one ✓/✓ row (the picked one, emerald).",
  },
  {
    id: "a-priority",
    tag: "both",
    title: "Highest priority won",
    expected:
      "Multiple vendors could each cover the whole need alone. Reveal badge: HIGHEST PRIORITY WON. Roll-up says “N/M on time · N/M solves alone”; the emerald-highlighted row is the lowest-rank number.",
  },
  {
    id: "a-split",
    tag: "both",
    title: "Split across vendors",
    expected:
      "No single vendor's max order qty covers the need — plan lands as one card per vendor. Each card's reveal shows a “chunk X of N” line and SPLIT ACROSS VENDORS badge. Candidates show ✓ On time but × Solves alone.",
  },
  {
    id: "a-late",
    tag: "both",
    title: "Late fallback + resolvers",
    expected:
      "No vendor arrives on time. Card gets a red-left accent + late pill; the amber strip says “Step X of Y — resolve {vendor}”. Reveal badge: LATE FALLBACK. Under the card: [Accept soonest available] (chip shows “· via {Vendor}, {Date}” when a faster vendor swap is offered) and [Force it] which opens an inline vendor+qty picker fixed at the shortfall date.",
  },
];

const TAG_STYLE: Record<
  ModeTag,
  { dot: string; label: string; chip: string }
> = {
  "first-time": { dot: VIOLET, label: "First-time", chip: "bg-[#EFF6FF] text-[#0A77FF]" },
  recurring: { dot: "#7C3AED", label: "Recurring", chip: "bg-violet-50 text-violet-700" },
  both: { dot: "#94A3B8", label: "Both", chip: "bg-slate-100 text-slate-500" },
};

function readPanelFold(): { graphOnly: boolean; label: string } {
  try {
    const raw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(PANELS_KEY)
        : null;
    if (!raw) return { graphOnly: true, label: "graph-only (default)" };
    const parsed = JSON.parse(raw) as { collapsed?: Record<string, boolean> };
    const c = parsed.collapsed ?? {};
    const graphOnly = !!c.vendors && !!c.transactions;
    const folded = Object.entries(c)
      .filter(([, v]) => v)
      .map(([k]) => k);
    return {
      graphOnly,
      label: graphOnly
        ? "graph-only"
        : folded.length
          ? `folded: ${folded.join(", ")}`
          : "all expanded",
    };
  } catch {
    return { graphOnly: true, label: "graph-only (default)" };
  }
}

export function PlannerDevWidget() {
  const mode = usePlannerUserMode();
  const openTabs = useOpenPlannerItems();
  const [open, setOpen] = useState(false);
  /* Saved scope + panel-fold aren't reactive stores; bump this after any
     mutation to force the inspector to re-read localStorage. */
  const [tick, setTick] = useState(0);

  const savedScope = useMemo(
    () => loadParams() ?? DEFAULT_PARAMS,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick, open],
  );
  const hasSavedScope = !paramsEqual(savedScope, DEFAULT_PARAMS);
  const panelFold = useMemo(
    () => readPanelFold(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick, open],
  );

  const reload = () => window.location.reload();

  /** What the NEXT fresh load will do, given the persisted state. */
  const entryActiveId =
    mode === "first-time" ? "ft" : hasSavedScope ? "rec-saved" : "rec-empty";
  const sandboxActiveId = mode === "first-time" ? "s-ft" : "s-rec";

  const applyMode = (next: PlannerUserMode) => {
    setPlannerUserMode(next);
    setTick((t) => t + 1);
  };

  const setupRecurring = () => {
    saveParams(RECURRING_SCOPE);
    SANDBOX_SEED.forEach(openPlannerItem);
    setPlannerUserMode("recurring");
    reload();
  };

  const resetFirstTime = () => {
    resetAllPlannerState();
    setPlannerUserMode("first-time");
    reload();
  };

  return (
    <>
      {/* Inline launcher — lives in the page's top bar (listing TopBar actions
         slot / workspace header). Toggles the floating panel below. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="Procurement Planning — dev journey switcher"
        className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border pl-2 pr-2.5 text-[11px] font-semibold transition-colors 2xl:h-8 2xl:gap-2 2xl:pl-2.5 2xl:pr-3 2xl:text-xs ${
          open
            ? "border-[#0A77FF]/40 bg-[#EFF6FF] text-[#0A77FF]"
            : "border-border/60 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        <FlaskConical className="h-3 w-3 2xl:h-3.5 2xl:w-3.5" style={{ color: VIOLET }} />
        <span
          className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide 2xl:text-[10px] ${TAG_STYLE[mode].chip}`}
        >
          {TAG_STYLE[mode].label}
        </span>
      </button>

      {/* Click-away backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[9998]"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Floating panel — drops from the top bar, anchored top-right */}
      {open && (
        <div className="fixed right-4 top-16 z-[9999] flex max-h-[80vh] w-[348px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-3.5 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <FlaskConical className="h-4 w-4 shrink-0" style={{ color: VIOLET }} />
                <h2 className="text-sm font-semibold text-slate-900">
                  Planning · Dev
                </h2>
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
                  Dev only
                </span>
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                Switch the journey & map every first-time vs recurring scenario.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="-mr-1 -mt-0.5 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close dev widget"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3.5 py-3">
            {/* Mode toggle */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {(["first-time", "recurring"] as PlannerUserMode[]).map((m) => {
                const active = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => applyMode(m)}
                    className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: TAG_STYLE[m].dot }}
                      />
                      {TAG_STYLE[m].label}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[10.5px] leading-snug text-slate-400">
              <span className="flex-1">
                Resume banner & in-plan rows update live. The entry modal and
                sandbox fold apply on the next load.
              </span>
              <button
                type="button"
                onClick={reload}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-1.5 py-1 font-semibold text-slate-600 hover:bg-slate-50"
              >
                <RefreshCw className="h-3 w-3" />
                Reload
              </button>
            </div>

            {/* Quick setup */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={resetFirstTime}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                title="Wipe all planner storage, set first-time, reload"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                True first-time
              </button>
              <button
                type="button"
                onClick={setupRecurring}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold text-white hover:opacity-90"
                style={{ backgroundColor: VIOLET }}
                title="Seed a saved scope + open sandbox session, set recurring, reload"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Seed recurring
              </button>
            </div>

            {/* Scenario map */}
            <ScenarioSection
              title="Entry — on a fresh load"
              scenarios={ENTRY_SCENARIOS}
              activeId={entryActiveId}
              mode={mode}
            />
            <ScenarioSection
              title="Listing"
              scenarios={LISTING_SCENARIOS}
              mode={mode}
            />
            <p className="mt-1.5 pl-0.5 text-[10px] leading-snug text-slate-400">
              Bulk multi-select (add several items to the sandbox at once) is on
              for both journeys — an independent flag, not gated by this mode.
            </p>
            <ScenarioSection
              title="Sandbox — workspace"
              scenarios={SANDBOX_SCENARIOS}
              activeId={sandboxActiveId}
              mode={mode}
            />
            <ScenarioSection
              title="Auto mode · Step-1 gate (Eli 2026-07-31)"
              scenarios={AUTO_STEP1_SCENARIOS}
              mode={mode}
            />
            <ScenarioSection
              title="Backlog (parked for later)"
              scenarios={BACKLOG_SCENARIOS}
              mode={mode}
            />
            {/* How-to-test — quick recipe so the buyer knows where to
                open each auto outcome. Sits under the Step-1 section so
                the four scenarios above are one click of context away. */}
            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-2">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                How to reproduce
              </div>
              <ol className="ml-3.5 list-decimal space-y-0.5 text-[10.5px] leading-snug text-slate-600">
                <li>Open Procurement Planning → pick any item into the sandbox.</li>
                <li>Turn Auto on (e.g. Min → Min) — the graph plots proposed POs.</li>
                <li>
                  Click <span className="font-semibold text-slate-800">See on graph</span>{" "}
                  to open the “Review N POs” modal.
                </li>
                <li>
                  For each card, click{" "}
                  <span className="font-semibold text-slate-800">Why this vendor?</span>{" "}
                  to reveal the Step-1 trace — verify against the scenarios above.
                </li>
                <li>
                  For a late card, test both{" "}
                  <span className="font-semibold text-slate-800">Accept soonest available</span>{" "}
                  (swaps to fastest vendor when one exists) and{" "}
                  <span className="font-semibold text-slate-800">Force it</span>{" "}
                  (inline picker; overrides lead time at the shortfall day). Each
                  action re-runs the projection.
                </li>
              </ol>
            </div>

            {/* Live state inspector */}
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-2">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Current persisted state
              </div>
              <StateRow label="Mode" value={TAG_STYLE[mode].label} />
              <StateRow
                label="Saved scope"
                value={
                  hasSavedScope
                    ? `${savedScope.sources.length || "all"} sources · ${
                        savedScope.bands.length || 0
                      } bands · ${savedScope.horizonDays}d`
                    : "none (clean)"
                }
              />
              <StateRow
                label="Sandbox tabs"
                value={
                  openTabs.length
                    ? `${openTabs.length} — ${openTabs.slice(0, 2).join(", ")}${
                        openTabs.length > 2 ? "…" : ""
                      }`
                    : "none"
                }
              />
              <StateRow label="Sandbox panels" value={panelFold.label} />
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 px-3.5 py-2">
            <p className="text-[10px] leading-snug text-slate-400">
              Default &amp; production always run <strong>first-time</strong>.
              This panel only changes things for you, locally.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function ScenarioSection({
  title,
  scenarios,
  activeId,
  mode,
}: {
  title: string;
  scenarios: Scenario[];
  activeId?: string;
  mode: PlannerUserMode;
}) {
  return (
    <div className="mt-3">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {title}
      </div>
      <div className="space-y-1">
        {scenarios.map((s) => {
          const isActive = !!activeId && s.id === activeId;
          /* Mode-gated listing rows: show whether they're on in the current mode. */
          const gated = s.tag !== "both";
          const onInMode = s.tag === mode;
          return (
            <div
              key={s.id}
              className={`rounded-lg border px-2.5 py-1.5 ${
                isActive
                  ? "border-emerald-200 bg-emerald-50/70"
                  : "border-slate-100 bg-white"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: TAG_STYLE[s.tag].dot }}
                />
                <span className="flex-1 text-[11.5px] font-semibold text-slate-800">
                  {s.title}
                </span>
                {isActive ? (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                    <Check className="h-2.5 w-2.5" />
                    Now
                  </span>
                ) : !activeId && gated ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                      onInMode
                        ? TAG_STYLE[s.tag].chip
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {onInMode ? "On" : "Off"}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 pl-3 text-[10.5px] leading-snug text-slate-500">
                {s.expected}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className="text-right text-[11px] font-medium text-slate-800">
        {value}
      </span>
    </div>
  );
}
