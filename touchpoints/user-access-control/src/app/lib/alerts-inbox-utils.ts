import type { InboxAlert } from "../data/alerts-inbox-data";

/* ─── Pure helpers for the alerts inbox: filtering, grouping, time copy ───
 * No React, no store, so the panel, the full page, and the tests all agree. */

export type DateRangeKey = "any" | "24h" | "7d" | "30d" | "90d";

export const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string; ms: number | null }[] = [
  { key: "any", label: "Any time", ms: null },
  { key: "24h", label: "Last 24 hours", ms: 24 * 3_600_000 },
  { key: "7d", label: "Last 7 days", ms: 7 * 86_400_000 },
  { key: "30d", label: "Last 30 days", ms: 30 * 86_400_000 },
  { key: "90d", label: "Last 90 days", ms: 90 * 86_400_000 },
];

export function dateRangeLabel(key: DateRangeKey): string {
  return DATE_RANGE_OPTIONS.find((o) => o.key === key)?.label ?? "Any time";
}

export interface AlertFilters {
  unreadOnly: boolean;
  /** Empty means every module the user can see. */
  moduleIds: string[];
  actionRequired: boolean;
  range: DateRangeKey;
  query: string;
}

export const EMPTY_FILTERS: AlertFilters = {
  unreadOnly: false,
  moduleIds: [],
  actionRequired: false,
  range: "any",
  query: "",
};

/** True when any filter narrows the list. Search counts: an empty result
 *  under a query needs the "no match" copy, not the "no alerts" copy. */
export function hasActiveFilters(f: AlertFilters): boolean {
  return (
    f.unreadOnly ||
    f.moduleIds.length > 0 ||
    f.actionRequired ||
    f.range !== "any" ||
    f.query.trim().length > 0
  );
}

export function countActiveFilters(f: AlertFilters): number {
  return (
    (f.unreadOnly ? 1 : 0) +
    (f.moduleIds.length > 0 ? 1 : 0) +
    (f.actionRequired ? 1 : 0) +
    (f.range !== "any" ? 1 : 0) +
    (f.query.trim() ? 1 : 0)
  );
}

/** Filters combine rather than replace one another (FP-03), and search runs
 *  inside the active filters rather than resetting them (FP-04). */
export function applyFilters(alerts: InboxAlert[], f: AlertFilters, now: number = Date.now()): InboxAlert[] {
  const rangeMs = DATE_RANGE_OPTIONS.find((o) => o.key === f.range)?.ms ?? null;
  const since = rangeMs == null ? null : now - rangeMs;
  const q = f.query.trim().toLowerCase();
  const modules = f.moduleIds.length ? new Set(f.moduleIds) : null;

  return alerts.filter((a) => {
    if (f.unreadOnly && a.read) return false;
    if (modules && !modules.has(a.moduleId)) return false;
    if (f.actionRequired && !a.actionRequired) return false;
    if (since != null && a.firedAt < since) return false;
    if (q) {
      const hay = `${a.title} ${a.body} ${a.name} ${a.moduleName} ${a.target.recordLabel}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/* ─── Day grouping: Today, Yesterday, then the calendar date (NP-02, FP-06) ─── */

export interface DayGroup {
  key: string;
  label: string;
  alerts: InboxAlert[];
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const DAY = 86_400_000;

export function dayLabel(ts: number, now: number = Date.now()): string {
  const today = startOfDay(now);
  const day = startOfDay(ts);
  if (day === today) return "Today";
  if (day === today - DAY) return "Yesterday";
  const d = new Date(ts);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** Alerts must already be sorted newest first. */
export function groupByDay(alerts: InboxAlert[], now: number = Date.now()): DayGroup[] {
  const groups: DayGroup[] = [];
  let current: DayGroup | null = null;
  for (const a of alerts) {
    const key = String(startOfDay(a.firedAt));
    if (!current || current.key !== key) {
      current = { key, label: dayLabel(a.firedAt, now), alerts: [] };
      groups.push(current);
    }
    current.alerts.push(a);
  }
  return groups;
}

/* ─── Time copy ───
 * Rows under Today read relatively; older rows read as a clock time, because
 * the day header already carries the date. Hover gets the absolute stamp with
 * the time zone (NP-03). */

export function formatRowTime(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const isToday = startOfDay(ts) === startOfDay(now);
  if (isToday) {
    const min = Math.floor(diff / 60_000);
    if (min < 1) return "Just now";
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    return `${hr}h ago`;
  }
  return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function formatAbsoluteTime(ts: number): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(ts));
}

export function formatCount(n: number, singular: string, plural: string = `${singular}s`): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? singular : plural}`;
}
