/**
 * Global empty / error states for every listing table.
 *
 * One component, one decision function. Each grid tells us what it knows
 * (did the load fail? how many rows exist? is there a search or filter?)
 * and `resolveTableEmptyKind` picks the right state, so "nothing matched
 * your search" can never be confused with "the server failed".
 *
 *   loading          → skeleton rows (see TableSkeletonRows)
 *   error            → request failed       — Try again, keeps search/filters/sort
 *   timeout          → request too slow     — Try again
 *   offline          → no connection        — Try again, auto-retries when back online
 *   forbidden        → no permission        — no action, ask an admin
 *   no-data          → nothing created yet  — optional Create CTA
 *   no-results       → search found nothing — Clear search (+ "Did you mean")
 *   no-filter-results→ filters hide all     — Clear filters
 *   no-results-filtered → search + filters  — Search without filters / Clear all
 *   page-empty       → page past the end    — Go to first page
 *
 * A refresh that fails while rows are already on screen does NOT replace
 * the rows; it shows TableStaleBanner above them instead.
 */
import * as React from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Clock,
  FilterX,
  Inbox,
  Lock,
  Plus,
  RefreshCw,
  SearchX,
  Undo2,
  WifiOff,
} from "lucide-react";
import { format } from "date-fns";
import { TableCell, TableRow } from "./table";
import { Skeleton } from "./skeleton";
import { cn } from "./utils";

/* ───────────────────────── types ───────────────────────── */

export type TableLoadState = "ready" | "loading" | "error" | "timeout" | "offline" | "forbidden" | "stale";

export type TableEmptyKind =
  | "error"
  | "timeout"
  | "offline"
  | "forbidden"
  | "no-data"
  | "no-results"
  | "no-filter-results"
  | "no-results-filtered"
  | "page-empty";

export interface ResolveEmptyInput {
  loadState?: TableLoadState;
  /** rows in the dataset before search/filters */
  totalCount: number;
  /** rows after search + filters (all pages) */
  filteredCount: number;
  /** rows on the current page */
  pageCount?: number;
  searchQuery?: string;
  /** number of active non-search filters (quick tab, advanced, column) */
  filterCount?: number;
}

/** Pick the state to show, or null when the grid has rows to render. */
export function resolveTableEmptyKind(i: ResolveEmptyInput): TableEmptyKind | null {
  const ls = i.loadState ?? "ready";
  if (ls === "error" || ls === "timeout" || ls === "offline" || ls === "forbidden") return ls;
  if (ls === "loading") return null; // caller renders skeleton
  const hasSearch = !!i.searchQuery?.trim();
  const filters = i.filterCount ?? 0;
  if (i.totalCount === 0 && !hasSearch && filters === 0) return "no-data";
  if (i.filteredCount === 0) {
    if (hasSearch && filters > 0) return "no-results-filtered";
    if (hasSearch) return "no-results";
    if (filters > 0) return "no-filter-results";
    return "no-data";
  }
  if (i.pageCount === 0) return "page-empty";
  return null;
}

export interface TableEmptyStateProps {
  kind: TableEmptyKind;
  /** e.g. { singular: "partner", plural: "partners" } — lowercase */
  entity: { singular: string; plural: string };
  searchQuery?: string;
  /** "Did you mean" term from findSearchSuggestion */
  suggestion?: string | null;
  onApplySuggestion?: (s: string) => void;
  filterCount?: number;
  onClearSearch?: () => void;
  onClearFilters?: () => void;
  onClearAll?: () => void;
  onRetry?: () => void;
  retrying?: boolean;
  onFirstPage?: () => void;
  onCreate?: () => void;
  createLabel?: string;
  /** Override the no-data / no-filter copy (e.g. "No archived partners") */
  title?: string;
  description?: string;
  /** Shown under error states, e.g. "ERR 500 · ref 7F3A" */
  errorRef?: string;
  /** Tighter padding for side panels, modals and nested tabs */
  compact?: boolean;
  className?: string;
}

/* ───────────────────────── visuals ───────────────────────── */

const TILE = {
  neutral: { bg: "#F1F5F9", fg: "#64748B" },
  info: { bg: "#EFF6FF", fg: "#0A77FF" },
  warn: { bg: "#FFFBEB", fg: "#B45309" },
  danger: { bg: "#FEF2F2", fg: "#DC2626" },
} as const;

const btnBase =
  "inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-60 disabled:cursor-not-allowed";
const btnOutline = `${btnBase} border border-border bg-white text-[#334155] shadow-sm hover:bg-[#F8FAFC] hover:border-[#CBD5E1]`;
const btnPrimary = `${btnBase} bg-primary text-white hover:bg-primary/90 shadow-sm`;
const btnText = { fontSize: "13px", fontWeight: 500 } as const;

function Btn({ variant = "outline", onClick, children, disabled }: { variant?: "outline" | "primary"; onClick?: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={variant === "primary" ? btnPrimary : btnOutline} style={btnText}>
      {children}
    </button>
  );
}

const truncate = (s: string, n = 40) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/* ───────────────────────── vertical centring ───────────────────────── */

const isClipping = (v: string) => v === "auto" || v === "scroll" || v === "hidden" || v === "clip";

/**
 * The nearest ancestor with a fixed height (the grid's scroll area, a modal
 * body, the page scroller). Content-sized wrappers such as the table's own
 * overflow-x container are skipped: they have no spare room to fill.
 * `extra` is the height we already added, so a frame we filled still counts.
 */
function findHeightFrame(el: HTMLElement, extra: number): HTMLElement | null {
  let n = el.parentElement;
  while (n && n !== document.body) {
    if (isClipping(getComputedStyle(n).overflowY) && Math.abs(n.clientHeight - (contentHeight(n) - extra)) > 1) return n;
    n = n.parentElement;
  }
  return null;
}

/** Height of what's inside a box (scrollHeight can't go below clientHeight, so measure the children). */
function contentHeight(box: HTMLElement): number {
  const cs = getComputedStyle(box);
  let top = Infinity;
  let bottom = -Infinity;
  for (const child of Array.from(box.children)) {
    const pos = getComputedStyle(child).position;
    if (pos === "absolute" || pos === "fixed") continue;
    const r = child.getBoundingClientRect();
    if (r.height === 0 && r.width === 0) continue;
    top = Math.min(top, r.top);
    bottom = Math.max(bottom, r.bottom);
  }
  if (top === Infinity) return 0;
  return bottom - top + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
}

/**
 * Grows the empty state to take up the frame's leftover height, so the
 * message sits centred top-to-bottom as well as left-to-right at every
 * screen size. Never shrinks below the content's own height, and never
 * pushes siblings (pagination, footers) out of view.
 */
function useFillFrameHeight(key: string) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [box, setBox] = React.useState<{ minHeight?: number; padY?: number; squeeze?: boolean }>({});
  const fullInner = React.useRef(0);
  const droppableRef = React.useRef(0);
  const squeezeRef = React.useRef(false);
  squeezeRef.current = !!box.squeeze;

  React.useLayoutEffect(() => {
    const root = rootRef.current;
    const content = contentRef.current;
    if (!root || !content) return;
    setBox({});
    fullInner.current = 0;
    delete root.dataset.basePad;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // Natural size = content + the default (un-overridden) padding.
        const inner = content.offsetHeight;
        if (!squeezeRef.current) {
          fullInner.current = inner;
          // Height of the icon tile + reference line we can drop on very short screens.
          let d = 0;
          content.querySelectorAll<HTMLElement>("[data-droppable]").forEach((n) => {
            const m = getComputedStyle(n);
            d += n.offsetHeight + parseFloat(m.marginTop) + parseFloat(m.marginBottom);
          });
          droppableRef.current = d;
        }
        const droppable = droppableRef.current;
        const basePad = root.dataset.basePad ? Number(root.dataset.basePad) : (() => {
          const cs = getComputedStyle(root);
          const v = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
          root.dataset.basePad = String(v);
          return v;
        })();
        const full = fullInner.current || inner;
        const natural = Math.ceil(full + basePad);
        const extra = root.offsetHeight - natural; // signed: what our own sizing added or removed
        const frame = findHeightFrame(root, extra);
        if (!frame) {
          setBox((prev) => (prev.minHeight === undefined && prev.padY === undefined ? prev : {}));
          return;
        }
        // A frame whose content already scrolls (a long detail page, a tall
        // modal body) has no spare room to fill or squeeze: keep the
        // natural size so mid-page states never lose their icon.
        if (contentHeight(frame) - extra > frame.clientHeight + 1) {
          setBox((prev) => (prev.minHeight === undefined && prev.padY === undefined ? prev : {}));
          return;
        }
        const available = Math.floor(root.offsetHeight + frame.clientHeight - contentHeight(frame));
        let next: { minHeight?: number; padY?: number; squeeze?: boolean };
        if (available >= natural) next = { minHeight: available };
        else {
          // Short screens: first trade padding for room, then drop the icon
          // tile and reference line, so the message still fits and stays centred.
          const squeeze = available < full + 16;
          const body = squeeze ? full - droppable : full;
          const h = Math.max(body + 16, available);
          next = { minHeight: h, padY: Math.max(8, Math.floor((h - body) / 2)), squeeze };
        }
        setBox((prev) =>
          prev.padY === next.padY && !!prev.squeeze === !!next.squeeze && prev.minHeight !== undefined && next.minHeight !== undefined && Math.abs(prev.minHeight - next.minHeight) < 2 ? prev : next,
        );
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(content);
    // Any container up the tree resizing (window, sidebar collapse, panels) re-centres.
    for (let n = root.parentElement, i = 0; n && n !== document.body && i < 12; n = n.parentElement, i++) ro.observe(n);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [key]);

  return { rootRef, contentRef, minHeight: box.minHeight, padY: box.padY, squeeze: !!box.squeeze };
}

/* ───────────────────────── component ───────────────────────── */

export function TableEmptyState(props: TableEmptyStateProps) {
  const {
    kind, entity, searchQuery = "", suggestion, onApplySuggestion, filterCount = 0,
    onClearSearch, onClearFilters, onClearAll, onRetry, retrying, onFirstPage,
    onCreate, createLabel, title, description, errorRef, compact, className,
  } = props;

  // Offline: retry by itself as soon as the browser reports a connection.
  React.useEffect(() => {
    if (kind !== "offline" || !onRetry) return;
    const h = () => onRetry();
    window.addEventListener("online", h);
    return () => window.removeEventListener("online", h);
  }, [kind, onRetry]);

  const q = truncate(searchQuery.trim());
  const retryBtn = onRetry && (
    <Btn onClick={onRetry} disabled={retrying}>
      <RefreshCw className={cn("w-3.5 h-3.5", retrying && "animate-spin")} />
      {retrying ? "Trying Again…" : "Try Again"}
    </Btn>
  );

  let tile: { bg: string; fg: string } = TILE.neutral;
  let Icon: React.ElementType = SearchX;
  let heading: React.ReactNode;
  let sub: React.ReactNode = null;
  let actions: React.ReactNode = null;
  let showSuggestion = false;
  let meta: React.ReactNode = null;

  switch (kind) {
    case "error":
      tile = TILE.danger; Icon = AlertTriangle;
      heading = `Couldn't load ${entity.plural}`;
      sub = "Something went wrong on our side. Your search, filters and sorting are kept, so you can try again.";
      actions = retryBtn;
      meta = errorRef;
      break;
    case "timeout":
      tile = TILE.warn; Icon = Clock;
      heading = "This is taking longer than usual";
      sub = `The server didn't respond in time while loading ${entity.plural}. Try again in a moment.`;
      actions = retryBtn;
      meta = errorRef;
      break;
    case "offline":
      tile = TILE.warn; Icon = WifiOff;
      heading = "You're offline";
      sub = `Check your internet connection. ${entity.plural[0].toUpperCase()}${entity.plural.slice(1)} will reload as soon as you're back online.`;
      actions = retryBtn;
      break;
    case "forbidden":
      tile = TILE.neutral; Icon = Lock;
      heading = `You don't have access to ${entity.plural}`;
      sub = "Ask your administrator to give your role permission to view this list.";
      break;
    case "no-data":
      tile = TILE.info; Icon = Inbox;
      heading = title ?? `No ${entity.plural} yet`;
      sub = description ?? `${entity.plural[0].toUpperCase()}${entity.plural.slice(1)} you add will show up here.`;
      actions = onCreate && (
        <Btn variant="primary" onClick={onCreate}>
          <Plus className="w-3.5 h-3.5" />
          {createLabel ?? `Create ${entity.singular}`}
        </Btn>
      );
      break;
    case "no-results":
      heading = <>No results for <span className="text-foreground">"{q}"</span></>;
      sub = "Check the spelling or try a different keyword.";
      showSuggestion = true;
      actions = onClearSearch && <Btn onClick={onClearSearch}>Clear Search</Btn>;
      break;
    case "no-results-filtered":
      heading = <>No results for <span className="text-foreground">"{q}"</span></>;
      sub = `${plural(filterCount, "filter")} ${filterCount === 1 ? "is" : "are"} also applied and may be hiding matches.`;
      showSuggestion = true;
      actions = (
        <>
          {onClearFilters && <Btn onClick={onClearFilters}><FilterX className="w-3.5 h-3.5" />Search Without Filters</Btn>}
          {onClearAll && <Btn onClick={onClearAll}>Clear All</Btn>}
        </>
      );
      break;
    case "no-filter-results":
      Icon = FilterX;
      heading = title ?? `No ${entity.plural} match your filters`;
      sub = description ?? `${plural(filterCount, "filter")} applied. Remove some to see more ${entity.plural}.`;
      actions = onClearFilters && <Btn onClick={onClearFilters}>Clear Filters</Btn>;
      break;
    case "page-empty":
      Icon = Undo2;
      heading = "Nothing on this page";
      sub = `The ${entity.plural} that were here have moved or been removed.`;
      actions = onFirstPage && <Btn onClick={onFirstPage}>Go to First Page</Btn>;
      break;
  }

  const isError = kind === "error" || kind === "timeout" || kind === "offline";
  const fill = useFillFrameHeight(kind);

  return (
    <div
      ref={fill.rootRef}
      role={isError ? "alert" : "status"}
      aria-live="polite"
      className={cn("flex flex-col items-center justify-center text-center px-6", compact ? "py-8" : "py-14", className)}
      style={{ minHeight: fill.minHeight, ...(fill.padY !== undefined ? { paddingTop: fill.padY, paddingBottom: fill.padY } : null) }}
    >
      <div ref={fill.contentRef} className="flex flex-col items-center">
      {!fill.squeeze && (
        <div
          data-droppable
          className={cn("rounded-xl flex items-center justify-center", compact ? "w-10 h-10 mb-2.5" : "w-12 h-12 mb-3")}
          style={{ backgroundColor: tile.bg }}
        >
          <Icon className={compact ? "w-5 h-5" : "w-6 h-6"} style={{ color: tile.fg }} />
        </div>
      )}
      <div className="text-[#334155] max-w-[420px]" style={{ fontSize: compact ? "13px" : "14px", fontWeight: 600 }}>
        {heading}
      </div>
      {showSuggestion && suggestion && onApplySuggestion && (
        <div className="mt-1 text-[#475569]" style={{ fontSize: "13px" }}>
          Did you mean{" "}
          <button
            type="button"
            onClick={() => onApplySuggestion(suggestion)}
            className="text-primary hover:underline underline-offset-2 cursor-pointer outline-none focus-visible:underline"
            style={{ fontWeight: 600 }}
          >
            {suggestion}
          </button>
          ?
        </div>
      )}
      {sub && (
        <div className="text-[#64748B] mt-1 max-w-[420px]" style={{ fontSize: compact ? "12px" : "13px", lineHeight: 1.45 }}>
          {sub}
        </div>
      )}
      {actions && <div className="flex items-center gap-2 mt-3.5">{actions}</div>}
      {meta && !fill.squeeze && (
        <div data-droppable className="text-[#94A3B8] mt-2.5" style={{ fontSize: "11px" }}>
          {meta}
        </div>
      )}
      </div>
    </div>
  );
}

/** Nearest ancestor that scrolls horizontally (the grid's viewport). */
function findScrollViewport(el: HTMLElement | null): HTMLElement | null {
  let n = el?.parentElement ?? null;
  while (n) {
    const ox = getComputedStyle(n).overflowX;
    if (ox === "auto" || ox === "scroll") return n;
    n = n.parentElement;
  }
  return null;
}

/**
 * Table-body wrapper: one full-width row that hosts the empty state.
 * Wide grids scroll sideways, so the message is pinned to the visible
 * viewport (sticky + measured width) instead of centring across every column.
 */
export function TableEmptyRow({ colSpan, ...props }: TableEmptyStateProps & { colSpan: number }) {
  return (
    <TableRow className="hover:bg-transparent border-0">
      <TableCell colSpan={colSpan} className="p-0">
        <PinToViewport>
          <TableEmptyState {...props} />
        </PinToViewport>
      </TableCell>
    </TableRow>
  );
}

/** Keeps its children inside the visible part of a horizontally scrolling grid. Use inside a raw <td colSpan>. */
export function PinToViewport({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState<number | undefined>(undefined);
  React.useLayoutEffect(() => {
    const vp = findScrollViewport(ref.current);
    if (!vp) return;
    const update = () => setWidth(vp.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(vp);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="sticky left-0" style={{ width }}>
      {children}
    </div>
  );
}

/* ───────────────────────── loading ───────────────────────── */

const SKELETON_WIDTHS = ["w-3/4", "w-1/2", "w-2/3", "w-5/6", "w-2/5"];

/** Placeholder rows shown while a grid is loading — keeps headers, toolbar and layout in place. */
export function TableSkeletonRows({ columns, rows = 8, leadingCheckbox }: { columns: number; rows?: number; leadingCheckbox?: boolean }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r} className="hover:bg-transparent" aria-hidden>
          {leadingCheckbox && (
            <TableCell className="w-10">
              <Skeleton className="h-4 w-4 rounded bg-slate-100" />
            </TableCell>
          )}
          {Array.from({ length: columns }).map((__, c) => (
            <TableCell key={c} className="py-3">
              <Skeleton className={cn("h-3.5 rounded bg-slate-100", SKELETON_WIDTHS[(r + c) % SKELETON_WIDTHS.length])} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/** Loading placeholder for card / list views that aren't a <table>. */
export function CardSkeletonGrid({ count = 8, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", className)} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-white p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full bg-slate-100" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/3 rounded bg-slate-100" />
              <Skeleton className="h-3 w-1/3 rounded bg-slate-100" />
            </div>
          </div>
          <Skeleton className="h-3 w-full rounded bg-slate-100" />
          <Skeleton className="h-3 w-4/5 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────── stale data ───────────────────────── */

/**
 * A refresh failed but rows from the last good load are still on screen.
 * We keep them (and the user's page, sort and filters) and say so above the grid.
 */
export function TableStaleBanner({ entity, lastUpdated, onRetry, retrying }: { entity: { plural: string }; lastUpdated?: Date; onRetry?: () => void; retrying?: boolean }) {
  return (
    <div role="alert" className="flex items-center gap-2 px-4 py-2 border-b border-[#FDE68A] bg-[#FFFBEB] shrink-0" style={{ fontSize: "12px" }}>
      <AlertTriangle className="w-3.5 h-3.5 text-[#B45309] shrink-0" />
      <span className="text-[#92400E]" style={{ fontWeight: 500 }}>
        Couldn't refresh {entity.plural}.
      </span>
      <span className="text-[#A16207]">
        {lastUpdated ? `Showing data from ${format(lastUpdated, "h:mm a")}.` : "Showing the last loaded data."}
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="ml-auto inline-flex items-center gap-1 text-[#B45309] hover:text-[#92400E] cursor-pointer disabled:opacity-60"
          style={{ fontSize: "12px", fontWeight: 600 }}
        >
          <RefreshCw className={cn("w-3 h-3", retrying && "animate-spin")} />
          {retrying ? "Trying Again…" : "Try Again"}
        </button>
      )}
    </div>
  );
}

/* ───────────────────────── load state (prototype) ───────────────────────── */

const SIM_STATES: TableLoadState[] = ["loading", "error", "timeout", "offline", "forbidden", "stale"];

/**
 * Load state for a grid. The prototype reads mock data synchronously, so a
 * real request never fails here; append `?tableState=<state>` to any listing
 * URL to preview a state (loading | error | timeout | offline | forbidden |
 * stale | empty). Engineering replaces this with the query's real status.
 *
 * "Try again" keeps every bit of grid state (search, filters, sort, page,
 * columns) because nothing but the load state changes.
 */
export function useTableLoadState() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tableState");
  const simulated = SIM_STATES.includes(raw as TableLoadState) ? (raw as TableLoadState) : "ready";
  const forceEmpty = raw === "empty";
  const [retrying, setRetrying] = React.useState(false);
  const [lastUpdated] = React.useState(() => new Date(Date.now() - 7 * 60 * 1000));

  const retry = React.useCallback(() => {
    setRetrying(true);
    window.setTimeout(() => {
      setRetrying(false);
      setParams(
        (p) => {
          const next = new URLSearchParams(p);
          next.delete("tableState");
          return next;
        },
        { replace: true },
      );
    }, 900);
  }, [setParams]);

  return {
    loadState: (retrying && simulated !== "stale" ? "loading" : simulated) as TableLoadState,
    forceEmpty,
    retrying,
    retry,
    lastUpdated,
    errorRef: simulated === "error" ? `Error 500 · Ref ${lastUpdated.getTime().toString(36).slice(-6).toUpperCase()}` : simulated === "timeout" ? "Error 504 · Gateway timeout" : undefined,
  };
}

/** True when the grid should hide its rows and show a blocking state. */
export const isBlockingLoadState = (s: TableLoadState) => s === "error" || s === "timeout" || s === "offline" || s === "forbidden";
