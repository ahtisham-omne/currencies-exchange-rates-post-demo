/** Date-window bucketing for the dashboard chart widgets.
 *
 * BA rule (Jun 2026): a time filter re-buckets the x-axis one level of
 * granularity below the window — Last 7 days renders day-on-day,
 * Last 30 days week-on-week (whatever calendar weeks fall inside the
 * window), Last 90 days month-on-month (whatever calendar months fall
 * inside the window). Edge buckets are clipped to the window, so the
 * first "month" of a 90-day view may only span e.g. Mar 14 – Mar 31 —
 * the `range` field carries the actual clipped dates for the chart
 * tooltip so a partial bucket is never ambiguous.
 */

export type BucketWindow = "7d" | "30d" | "90d";

export interface PeriodBucket {
  /** Short x-axis label — weekday for 7d, "Wk n" for 30d, month name for 90d. */
  label: string;
  /** The bucket's actual (window-clipped) date range, surfaced on hover. */
  range: string;
  /** Fraction of the full day/week/month the clipped bucket covers (0–1]. */
  weight: number;
}

const DAY_MS = 86400000;
const fmtDay = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY_MS) + 1;

/** Deterministic 0.75–1.24 multiplier so mock bucket volumes vary
 *  without Math.random() re-rolling the chart on every render. */
export const bucketWobble = (i: number) => 0.75 + ((Math.abs(i) * 37) % 50) / 100;

export function buildPeriodBuckets(window: BucketWindow, now: Date = new Date()): PeriodBucket[] {
  const today = startOfDay(now);

  if (window === "7d") {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, i - 6);
      return {
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        range: fmtDay(d),
        weight: 1,
      };
    });
  }

  if (window === "30d") {
    const windowStart = addDays(today, -29);
    // Monday-started calendar weeks overlapping the window, clipped to it.
    const buckets: PeriodBucket[] = [];
    let weekStart = addDays(windowStart, -((windowStart.getDay() + 6) % 7));
    while (weekStart <= today) {
      const weekEnd = addDays(weekStart, 6);
      const clipStart = weekStart < windowStart ? windowStart : weekStart;
      const clipEnd = weekEnd > today ? today : weekEnd;
      const days = daysBetween(clipStart, clipEnd);
      buckets.push({
        label: `Wk ${buckets.length + 1}`,
        range: days === 1 ? fmtDay(clipStart) : `${fmtDay(clipStart)} to ${fmtDay(clipEnd)}`,
        weight: days / 7,
      });
      weekStart = addDays(weekStart, 7);
    }
    return buckets;
  }

  // 90d — calendar months overlapping the window, clipped to it.
  const windowStart = addDays(today, -89);
  const buckets: PeriodBucket[] = [];
  let monthStart = new Date(windowStart.getFullYear(), windowStart.getMonth(), 1);
  while (monthStart <= today) {
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    const clipStart = monthStart < windowStart ? windowStart : monthStart;
    const clipEnd = monthEnd > today ? today : monthEnd;
    const days = daysBetween(clipStart, clipEnd);
    buckets.push({
      label: monthStart.toLocaleDateString("en-US", { month: "short" }),
      range: days === 1 ? fmtDay(clipStart) : `${fmtDay(clipStart)} to ${fmtDay(clipEnd)}`,
      weight: days / monthEnd.getDate(),
    });
    monthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
  }
  return buckets;
}
