/* ── One date core (9/22/26 review response) ──────────────────────────
 * The Sept 20 reviews' one-day drift family (list "Due Today" vs detail
 * "Overdue 1d", "Sep 21 due today" on Sep 20, Feb 3 + 45 = Mar 18, "next
 * Sep 22 in 1 day") traced to ONE cause: `new Date('2026-09-21')` parses
 * a date-only string as UTC midnight, which lands on the previous or the
 * next calendar day once the local timezone offset applies — and
 * `toISOString()` re-introduces the shift on the way out. Every
 * date-only string in the app parses and formats through these helpers.
 */

/** Parse a date-only ISO string at LOCAL midnight, never UTC. */
export function parseDateOnly(iso: string): Date {
  return new Date(`${(iso ?? '').slice(0, 10)}T00:00:00`);
}

/** Local midnight of the machine's today — the ONE "today". */
export function todayAtMidnight(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

/** Format a Date as a date-only ISO string in LOCAL time. */
export function toDateOnlyIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Today as a date-only ISO string, local calendar (toISOString flips to
 *  tomorrow/yesterday around midnight in offset timezones). */
export function localTodayIso(): string {
  return toDateOnlyIso(new Date());
}

/** OMNE's US display standard for dates (user 9/25, partner module
 *  reference): "Apr 02, 2026" — MMM DD, YYYY with a two-digit day.
 *  Data stays ISO; ONLY rendering goes through here. Invalid or empty
 *  input falls through unchanged so placeholders keep working. */
export function formatUsDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : `${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

/** Date + time for data-table cells (user 10/7): "Oct 05, 2026, 2:30 PM".
 *  If the ISO carries a real clock time it's used verbatim; otherwise a
 *  STABLE business-hours time (08:xx–17:xx) is synthesized from `seed`
 *  (+ the date), so the mock's date-only records read as realistic,
 *  consistent timestamps and each row/column pair stays put across
 *  renders. The date half always matches formatUsDate. */
/** The moment formatUsDateTime prints: the real clock when the value has
 *  one, else the seeded 08:00–17:59 business-hours time. Sorting by this
 *  keeps same-day rows in the order their displayed times read
 *  (user 10/22/26). */
export function usDateTimeValue(iso?: string | null, seed?: string): Date | null {
  if (!iso) return null;
  const hasClock = iso.includes('T') && !/T00:00(:00)?/.test(iso);
  let d = new Date(iso.includes('T') ? iso : `${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  if (!hasClock) {
    const s = `${seed ?? ''}|${iso}`;
    let h = 0;
    for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
    const abs = Math.abs(h);
    d = new Date(`${iso.slice(0, 10)}T00:00:00`);
    d.setHours(8 + (abs % 10), abs % 60, 0, 0); // 08:00–17:59
  }
  return d;
}

export function formatUsDateTime(iso?: string | null, seed?: string): string {
  if (!iso) return '';
  const datePart = formatUsDate(iso);
  if (!datePart || datePart === iso) return datePart;
  const d = usDateTimeValue(iso, seed)!;
  // Space between date and time, no comma (user 10/7): "Oct 05, 2026 2:30 PM".
  return `${datePart} ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

/** Signed whole days until a date: positive = future, 0 = today. */
export function daysUntil(iso: string): number {
  return Math.round((parseDateOnly(iso).getTime() - todayAtMidnight().getTime()) / 86400000);
}

/** Calendar-day addition that survives leap days and DST (Feb 3, 2024 +
 *  45 = Mar 19, counting Feb 29). */
export function addDaysIso(iso: string, days: number): string {
  const d = parseDateOnly(iso);
  d.setDate(d.getDate() + days);
  return toDateOnlyIso(d);
}

// Due-date urgency buckets for the listing quick filters (7/16/26) —
// shared by Vendor Invoicing and the Invoices to pay tab so both slice
// the same way.
export const DUE_BUCKETS = ['Overdue', 'Due Today', 'Due This Week', 'Due Later'] as const;

export function dueBucketOf(dueDate: string): string {
  const days = daysUntil(dueDate);
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Due Today';
  if (days <= 7) return 'Due This Week';
  return 'Due Later';
}

// AP aging buckets for the payment run query: how far past DUE the
// invoice is, measured from the DUE DATE (corrected 8/5/26 — aging was
// wrongly keyed to the vendor invoice date). The classic AP aging
// report: Current = not yet due, then 1-30, 31-60, 61-90, 90+ days
// past due.
export const AGING_BUCKETS = ['Current', 'Due Today', '1-30 days', '31-60 days', '61-90 days', '90+ days'] as const;

export function agingBucketOf(dueDate: string): string {
  const days = overdueDaysOf(dueDate);
  if (days < 0) return 'Current';
  // Due today is its own window (8/7/26): the day-of decision slice.
  if (days === 0) return 'Due Today';
  if (days <= 30) return '1-30 days';
  if (days <= 60) return '31-60 days';
  if (days <= 90) return '61-90 days';
  return '90+ days';
}

/* ── Overdue days (8/5/26) ────────────────────────────────────────────
 * Aging brackets are an AR concept for tracking who owes YOU. This is
 * payables: the useful number is how many days each invoice is overdue
 * by, shown per invoice. The brackets stay only as filter windows,
 * relabeled in overdue-days language. */

/** Days past due: positive = overdue, 0 = due today, negative = due in
 *  the future. */
export function overdueDaysOf(dueDate: string): number {
  return -daysUntil(dueDate);
}

/** The ONE overdue definition shared by the listing rows and the Overdue
 *  KPI (VI-32; user 10/8): any LIVE invoice past its due date with money
 *  still owed counts — inventory invoices, pre-invoices and standalone
 *  invoices alike, whatever their approval state. Only terminal rows
 *  (Cancelled / Rejected) never age. Keep both call sites on this. */
export function isInvoiceOverdue(inv: { status: string; type?: string; outstandingBalance: number; dueDate: string }): boolean {
  if (inv.outstandingBalance <= 0.004) return false;
  if (overdueDaysOf(inv.dueDate) <= 0) return false;
  return inv.status !== 'Cancelled' && inv.status !== 'Rejected';
}

/** Sort key for the Due Date column's "Most overdue" option (user
 *  10/9): overdue invoices first, most days past due on top; everything
 *  that isn't overdue follows in due-date order. */
export const MOST_OVERDUE_SORT_KEY = 'daysOverdue';
export function compareMostOverdue(
  a: { status: string; type?: string; outstandingBalance: number; dueDate: string },
  b: { status: string; type?: string; outstandingBalance: number; dueDate: string },
): number {
  const ao = isInvoiceOverdue(a) ? overdueDaysOf(a.dueDate) : -1;
  const bo = isInvoiceOverdue(b) ? overdueDaysOf(b.dueDate) : -1;
  if (ao !== bo) return bo - ao;
  return String(a.dueDate ?? '').localeCompare(String(b.dueDate ?? ''));
}

/** "Overdue by 6 days" · "Due Today" · "Due in 4 days". */
export function overdueLabel(days: number): string {
  if (days > 0) return `Overdue by ${days} Day${days === 1 ? '' : 's'}`;
  if (days === 0) return 'Due Today';
  return `Due in ${-days} Day${days === -1 ? '' : 's'}`;
}

/** Severity-graded tone: calm before due, then warming with the days
 *  overdue (yellow due today, amber to 30, orange to 60, red past). */
export function overdueTone(days: number): string {
  if (days < 0) return 'bg-slate-100 text-slate-600';
  if (days === 0) return 'bg-yellow-50 text-yellow-700';
  if (days <= 30) return 'bg-amber-50 text-amber-700';
  if (days <= 60) return 'bg-orange-50 text-orange-700';
  if (days <= 90) return 'bg-red-50 text-red-700';
  return 'bg-red-100 text-red-800';
}

/** Filter labels for the bracket windows, in overdue-days language. */
export const OVERDUE_BUCKET_LABELS: Record<(typeof AGING_BUCKETS)[number], string> = {
  Current: 'Not Yet Due',
  'Due Today': 'Due Today',
  '1-30 days': 'Overdue 1 to 30 Days',
  '31-60 days': 'Overdue 31 to 60 Days',
  '61-90 days': 'Overdue 61 to 90 Days',
  '90+ days': 'Overdue 90+ Days',
};
