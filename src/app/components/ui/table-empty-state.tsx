/**
 * Global empty / error states for every listing table.
 *
 * One component, one decision function. Each grid tells us what it knows
 * (did the load fail? how many rows exist? is there a search or filter?)
 * and `resolveTableEmptyKind` picks the right state, so "nothing matched
 * your search" can never be confused with "the server failed".
 *
 *   loading          → skeleton rows (see TableSkeletonRows)
 *   error            → request failed or timed out — heading + Try again only;
 *                      count and pagination hide (they came from the failed load)
 *   forbidden        → no permission        — full-page takeover below the
 *                      breadcrumb (see AccessDeniedTakeover), no action
 *   no-data          → nothing created yet  — optional Create CTA
 *   no-results       → search found nothing — Clear search (+ "Did you mean")
 *   no-filter-results→ filters hide all     — Clear filters
 *   no-results-filtered → search + filters  — Search without filters / Clear all
 *   page-empty       → page past the end    — Go to first page
 *
 * Offline is not a table state: one bar across the top of the app
 * (OfflineBar) and the table keeps what's on screen. A request that fails
 * while offline shows `error`; when the connection returns the bar goes and
 * a failed table reloads by itself.
 */
import * as React from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  FilterX,
  Inbox,
  Lock,
  Plus,
  RefreshCw,
  SearchX,
  Undo2,
  WifiOff,
} from "lucide-react";
import { TableCell, TableRow } from "./table";
import { Skeleton } from "./skeleton";
import { cn } from "./utils";

/* ───────────────────────── types ───────────────────────── */

export type TableLoadState = "ready" | "loading" | "error" | "forbidden";

export type TableEmptyKind =
  | "error"
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
  if (ls === "error" || ls === "forbidden") return ls;
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

/* ───────────────────────── vertical centring ───────────────────────── */

const isClipping = (v: string) => v === "auto" || v === "scroll" || v === "hidden" || v === "clip";

/** Nearest ancestor that scrolls vertically (the page or modal scroller). */
function findScroller(el: HTMLElement): HTMLElement | null {
  let n = el.parentElement;
  while (n && n !== document.body) {
    const v = getComputedStyle(n).overflowY;
    if (v === "auto" || v === "scroll") return n;
    n = n.parentElement;
  }
  return null;
}

/**
 * The nearest ancestor with spare height: a fixed-height scroll area (the
 * grid's viewport, a modal body, the page scroller) or a box stretched past
 * its content by flex or min-height (an embedded grid's card, e.g. Partner
 * Group > Linked Partners). Content-sized wrappers have no spare room and
 * are skipped. Call it with the empty state at its natural size.
 */
function findHeightFrame(el: HTMLElement): HTMLElement | null {
  let n = el.parentElement;
  while (n && n !== document.body) {
    if (n.clientHeight - contentHeight(n) > 1) return n;
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
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const inner = content.offsetHeight;
        if (!squeezeRef.current) {
          fullInner.current = inner;
          // Height of the icon tile we can drop on very short screens.
          let d = 0;
          content.querySelectorAll<HTMLElement>("[data-droppable]").forEach((n) => {
            const m = getComputedStyle(n);
            d += n.offsetHeight + parseFloat(m.marginTop) + parseFloat(m.marginBottom);
          });
          droppableRef.current = d;
        }
        // Measure at natural size: drop our own sizing for one synchronous
        // layout read (no paint in between), so a frame we already filled
        // still shows its true spare room and shrinking windows re-centre.
        const saved = [root.style.minHeight, root.style.paddingTop, root.style.paddingBottom];
        root.style.minHeight = root.style.paddingTop = root.style.paddingBottom = "";
        const cs = getComputedStyle(root);
        const basePad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
        const frame = findHeightFrame(root);
        let available = frame ? Math.floor(root.offsetHeight + frame.clientHeight - contentHeight(frame)) : 0;
        // A stretched (non-scrolling) frame can run past the screen; centre in
        // the part the user can see instead of the whole box.
        const scroller = frame && !isClipping(getComputedStyle(frame).overflowY) ? findScroller(frame) : null;
        const visible = scroller ? Math.floor(scroller.getBoundingClientRect().bottom - root.getBoundingClientRect().top) : Infinity;
        [root.style.minHeight, root.style.paddingTop, root.style.paddingBottom] = saved;
        const droppable = droppableRef.current;
        const full = fullInner.current || inner;
        const natural = Math.ceil(full + basePad);
        available = Math.min(available, Math.max(natural, visible));
        if (!frame) {
          setBox((prev) => (prev.minHeight === undefined && prev.padY === undefined ? prev : {}));
          return;
        }
        let next: { minHeight?: number; padY?: number; squeeze?: boolean };
        if (available >= natural) next = { minHeight: available };
        else {
          // Short screens: first trade padding for room, then drop the icon
          // tile, so the message still fits and stays centred.
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

/** Button labels are Title Case (Omne Capitalization Standard §5), but
 *  `entity` nouns are lowercase for sentences, so the Create fallback
 *  builds the Title Case form: "partner group" → "Partner Group". */
const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into", "nor", "of", "on", "or", "per", "the", "to", "via", "vs", "with"]);
function titleCaseNoun(noun: string): string {
  const words = noun.split(" ");
  return words
    .map((w, i) => (i > 0 && i < words.length - 1 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export function TableEmptyState(props: TableEmptyStateProps) {
  const {
    kind, entity, searchQuery = "", suggestion, onApplySuggestion, filterCount = 0,
    onClearSearch, onClearFilters, onClearAll, onRetry, retrying, onFirstPage,
    onCreate, createLabel, title, description, compact, className,
  } = props;

  // A failed table reloads by itself when the connection comes back.
  React.useEffect(() => {
    if (kind !== "error" || !onRetry) return;
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

  switch (kind) {
    case "error":
      tile = TILE.danger; Icon = AlertTriangle;
      // No helper sentence: we don't know what failed, so the copy promises nothing.
      // Covers a timed-out request too: by the time it shows, loading has stopped.
      heading = `Couldn't load ${entity.plural}`;
      actions = retryBtn;
      break;
    case "forbidden":
      break; // rendered by AccessDeniedTakeover below
    case "no-data":
      tile = TILE.info; Icon = Inbox;
      heading = title ?? `No ${entity.plural} yet`;
      sub = description ?? `${entity.plural[0].toUpperCase()}${entity.plural.slice(1)} you add will show up here.`;
      actions = onCreate && (
        <Btn variant="primary" onClick={onCreate}>
          <Plus className="w-3.5 h-3.5" />
          {createLabel ?? `Create ${titleCaseNoun(entity.singular)}`}
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
      sub = description ?? null;
      actions = onClearFilters && <Btn onClick={onClearFilters}>Clear Filters</Btn>;
      break;
    case "page-empty":
      Icon = Undo2;
      heading = "Nothing on this page";
      sub = `The ${entity.plural} that were here have moved or been removed.`;
      actions = onFirstPage && <Btn onClick={onFirstPage}>Go to First Page</Btn>;
      break;
  }

  const isError = kind === "error";
  const fill = useFillFrameHeight(kind);

  // The record count and page numbers came from the load that failed, so
  // hide them (anything marked data-table-meta in the grid's frame).
  React.useLayoutEffect(() => {
    if (kind !== "error") return;
    const frame = fill.rootRef.current?.closest<HTMLElement>('[data-table-frame],[role="tabpanel"],[role="dialog"],main');
    if (!frame) return;
    frame.setAttribute("data-table-load-failed", "");
    return () => frame.removeAttribute("data-table-load-failed");
  }, [kind, fill.rootRef]);

  // No access takes over the whole page (or modal), not just the grid:
  // search, filters and the rest of the toolbar are useless without it.
  if (kind === "forbidden") return <AccessDeniedTakeover entity={entity} />;

  return (
    <div
      ref={fill.rootRef}
      role={isError ? "alert" : "status"}
      aria-live="polite"
      className={cn("flex flex-col items-center justify-center text-center px-6 whitespace-normal", compact ? "py-8" : "py-14", className)}
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
      <div className="text-[#334155] max-w-[420px]" style={{ fontSize: compact ? "13px" : "14px", fontWeight: 600, textWrap: "balance" }}>
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
        <div className="text-[#64748B] mt-1 max-w-[360px]" style={{ fontSize: compact ? "12px" : "13px", lineHeight: 1.45, textWrap: "balance" }}>
          {sub}
        </div>
      )}
      {actions && <div className="flex items-center gap-2 mt-3.5">{actions}</div>}
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

/* ───────────────────────── load state (prototype) ───────────────────────── */

const SIM_STATES: TableLoadState[] = ["loading", "error", "forbidden"];

/**
 * Load state for a grid. The prototype reads mock data synchronously, so a
 * real request never fails here; append `?tableState=<state>` to any listing
 * URL to preview a state (loading | error | forbidden | empty), or
 * `?tableState=offline` for the app-wide offline bar over a loaded table.
 * `timeout` is kept as an alias of `error`. Engineering replaces this with
 * the query's real status; a timed-out request maps to "error".
 *
 * "Try again" keeps every bit of grid state (search, filters, sort, page,
 * columns) because nothing but the load state changes.
 */
export function useTableLoadState() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tableState");
  const simulated = raw === "timeout" ? "error" : SIM_STATES.includes(raw as TableLoadState) ? (raw as TableLoadState) : "ready";
  const forceEmpty = raw === "empty";
  const [retrying, setRetrying] = React.useState(false);

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
    loadState: (retrying ? "loading" : simulated) as TableLoadState,
    forceEmpty,
    retrying,
    retry,
  };
}

/** True when the grid should hide its rows and show a blocking state. */
export const isBlockingLoadState = (s: TableLoadState) => s === "error" || s === "forbidden";

/* ───────────────────────── no access (full page) ───────────────────────── */

/**
 * Covers the page the grid lives on, below its top bar, with the no-access
 * message. The frame is, nearest first: an element marked
 * `data-access-frame`, the open modal, or the app's <main>. Anything in the
 * frame marked `data-page-topbar` (breadcrumbs, modal header, tab strip)
 * stays visible above the cover so the user can still navigate away.
 * Everything else goes, including a listing page's title, description and
 * icon. The breadcrumb names the module and the list only (e.g. Partners
 * Management / Contacts Directory), never a record.
 */
export function AccessDeniedTakeover({ entity }: { entity: { plural: string } }) {
  const anchorRef = React.useRef<HTMLSpanElement>(null);
  const [frame, setFrame] = React.useState<{ el: HTMLElement; top: number } | null>(null);

  React.useLayoutEffect(() => {
    const a = anchorRef.current;
    if (!a) return;
    const el = a.closest<HTMLElement>('[data-access-frame],[role="dialog"],main');
    if (!el) return;
    const ownBars = () => Array.from(el.querySelectorAll<HTMLElement>("[data-page-topbar]")).filter((b) => b.closest('[data-access-frame],[role="dialog"],main') === el);
    const measure = () => {
      const bars = ownBars();
      const fr = el.getBoundingClientRect();
      const top = bars.reduce((m, b) => Math.max(m, b.getBoundingClientRect().bottom - fr.top), 0);
      setFrame((prev) => (prev && prev.el === el && Math.abs(prev.top - top) < 1 ? prev : { el, top: Math.max(0, Math.round(top)) }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ownBars().forEach((b) => ro.observe(b));
    return () => {
      ro.disconnect();
    };
  }, []);

  return (
    <>
      <span ref={anchorRef} hidden />
      {frame &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            data-access-denied
            className="absolute inset-x-0 bottom-0 z-[25] flex items-center justify-center bg-slate-50 px-6 text-center whitespace-normal"
            style={{ top: frame.top }}
          >
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: TILE.neutral.bg }}>
                <Lock className="w-7 h-7" style={{ color: TILE.neutral.fg }} />
              </div>
              <div className="text-[#334155] max-w-[420px]" style={{ fontSize: "16px", fontWeight: 600, textWrap: "balance" }}>
                You don't have access to {entity.plural}
              </div>
              <div className="text-[#64748B] mt-1.5 max-w-[360px]" style={{ fontSize: "13px", lineHeight: 1.45, textWrap: "balance" }}>
                Ask your administrator to give your role permission to view {entity.plural}.
              </div>
            </div>
          </div>,
          frame.el,
        )}
    </>
  );
}
