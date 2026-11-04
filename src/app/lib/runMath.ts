import type { Invoice } from '@/app/data/mockInvoices';
import { PAY_FROM_ACCOUNTS, type Payment, type PayFromAccount } from '@/app/data/mockPayments';
import { buildPaymentGlEntries } from '@/app/lib/glPosting';
import { ADVANCES_ACCOUNT, DEFAULT_PREPAYMENT_ASSET_ACCOUNT } from '@/app/data/glAccounts';
import { localTodayIso, addDaysIso } from '@/app/lib/dueBucket';
import {
  openRunInvoiceIds,
  liveLines,
  vendorPayDefaults,
  type PaymentRun,
  type PaymentRunLine,
  type RunVendorGroup,
  type RunException,
  type RunFilters,
} from '@/app/data/paymentRuns';
import { agingBucketOf } from './dueBucket';
import { presetForVendor, findPresetByLabel } from '@/app/data/paymentTermPresets';
import { memoLimitFor } from '@/app/lib/memoLimits';
import { claimPaymentNumber } from '@/app/lib/invoiceIds';

/* ── Payment run math: pure functions, no React ──────────────────────
 * Eligibility, grouping, per-account cash totals, exception checks, the
 * execute-time re-validation, and the payment records a run posts. All
 * vendor lookups are keyed by name (the convention across the mock
 * datasets); centralizing them here keeps a future id-based fix to one
 * file. */

const round2 = (n: number) => Math.round(n * 100) / 100;
// LOCAL calendar today (9/22/26 review response): toISOString() is UTC
// and flips to tomorrow in the evening for positive-offset timezones —
// the reviews' "several screens run on tomorrow's date" family.
const todayIso = () => localTodayIso();

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (s.charCodeAt(i) + ((h << 5) - h)) | 0;
  return Math.abs(h);
}

/* ── Synthetic vendor facts (deterministic mock flags) ───────────────
 * The datasets don't carry these yet, so they derive from stable name
 * hashes: the same vendors read the same way on every reload. */

/** ~2 of the 28 vendors have no payment method on file (greys their
 *  rows in P1 and raises the blocking no-method exception in P2). */
export function vendorHasNoMethod(vendor: string): boolean {
  return hash(vendor) % 17 === 3;
}

/** ~10% of vendors changed bank details recently (warning exception). */
export function vendorBankChanged(vendor: string): boolean {
  return hash(vendor) % 10 === 1;
}

/* ── Early-pay discount terms ─────────────────────────────────────────
 * A discount belongs to the invoice's PAYMENT TERM (8/28/26 evening
 * review): only term presets flagged applyDiscount carry one (e.g.
 * "2/10 Net 30 Post Shipping"), replacing the old id-hash phantom
 * discounts that ignored the vendor's actual terms. */

export interface DiscountTerms {
  label: string;
  percent: number;
  /** Last day the discount can be taken. */
  deadline: string;
  /** Dollar value of the discount on the outstanding balance. */
  value: number;
}

export function discountTermsFor(invoice: Invoice): DiscountTerms | null {
  // The record's own chosen term wins (same rule as paymentTermsFor):
  // an invoice carrying "2/10 Net 30 Post Shipping" gets that discount
  // even when the vendor's default template has none.
  const preset =
    (invoice.paymentTerms && findPresetByLabel(invoice.paymentTerms)) ||
    presetForVendor(invoice.vendor);
  if (!preset.applyDiscount) return null;
  const percent = Number(preset.discountPercent ?? '2') || 2;
  const period = Number(preset.discountPeriod ?? '10') || 10;
  // The early-pay window can never outlast the due date (user 9/25): an
  // overdue invoice is by definition past its discount window, so cap the
  // deadline at the due date. This also heals inconsistent seed data where
  // a recent invoice date collides with a far-past due date — without the
  // cap such rows showed a live discount while reading "Overdue by N days".
  // addDaysIso is calendar-correct across Feb 29 and never round-trips
  // through UTC (9/22/26 review response, Claude C03-D7).
  const rawDeadline = addDaysIso(invoice.invoiceDate, period);
  const deadline = invoice.dueDate && rawDeadline > invoice.dueDate ? invoice.dueDate : rawDeadline;
  return {
    label: preset.name,
    percent,
    deadline,
    value: round2(invoice.outstandingBalance * (percent / 100)),
  };
}

/** Whether the discount window is still open as of `asOf` (defaults to
 *  today). Payment runs pass their payment date so the discount reflects
 *  the day the money actually moves (8/28/26 review). */
export function discountIsLive(terms: DiscountTerms | null, asOf: string = todayIso()): boolean {
  return !!terms && terms.deadline >= asOf;
}

/** Days left in the discount window as of `asOf` (0 = last day). */
export function discountDaysLeft(terms: DiscountTerms, asOf: string = todayIso()): number {
  return Math.round(
    (new Date(`${terms.deadline}T00:00:00`).getTime() - new Date(`${asOf}T00:00:00`).getTime()) /
      86400000,
  );
}

/** Discount dollars on a given base amount (a row's own balance or
 *  snapshot), so settled rows don't drift with the live invoice. */
export function discountAmountOn(base: number, terms: DiscountTerms): number {
  return round2(base * (terms.percent / 100));
}

/** The invoice's payment terms label: the vendor's partner template
 *  (8/12/26, supersedes the date-derived Net N). Terms are a partner
 *  fact, pulled from the same template catalog the partner profile
 *  browses (NET / Pre / Split), one per vendor. An invoice carries
 *  exactly ONE term (9/4/26 ruling) — mixed-term PO selections resolve
 *  to a single term at creation, so nothing downstream lists terms. */
export function paymentTermsFor(invoice: Invoice): string {
  // The record's own chosen term wins (9/22/26 review response): the
  // vendor default is only the fallback for seeds carrying no term.
  return invoice.paymentTerms || presetForVendor(invoice.vendor).name;
}

/** The three type families the run filter and Type column speak
 *  (8/12/26; renamed 9/5/26 to match the creation flows): the inventory
 *  sub-types (PO-based / Receiving-based / GRN-based) all read
 *  Inventory Invoice. */
export function invoiceTypeLabel(type: string): string {
  // One label everywhere (9/22/26 review response); "Pro-Forma"
  // hyphenated again per the user's 10/5 reversal.
  if (type === 'Pre-Invoice') return 'Pre-Invoice (Pro-Forma)';
  if (type === 'Standalone') return 'Standalone Invoice';
  return 'Inventory Invoice';
}

/* ── P1 · eligibility ────────────────────────────────────────────────── */

export interface EligibleRow {
  invoice: Invoice;
  /** Vendor has no payment method on file: greyed with the reason. */
  noPaymentMethod?: boolean;
  /** e.g. "Net 30" or "2/10 net 30". */
  terms: string;
}

/** The base pool a run can draw from: approved invoices with a balance.
 *  On hold, exception, rejected, and rows already sitting in another
 *  open run are out entirely (BA 7/31/26: in-run invoices don't appear
 *  at all, they're simply not available). Pre-invoices JOIN the pool
 *  (8/12/26, supersedes the 7/31 exclusion): all three type families
 *  are selectable, with the Type filter to slice them.
 *
 *  HARD REQUIREMENT (9/4/26 Eli, L-05 / Option A): a pre-invoice posts
 *  nothing to the GL, so no ledger account will ever surface it — the
 *  payment run engine (here), the AP aging report and the cash forecast
 *  (AccountingDashboardScreen.isOpenInvoice) are the ONLY places an open
 *  pre-invoice becomes visible to AP. Never add a type exclusion back. */
export function eligibleInvoices(
  invoices: Invoice[],
  runs: PaymentRun[],
  thisRunId: string,
  filters: RunFilters,
  /** Discount liveness reference date, the run's payment date. */
  asOf?: string,
): EligibleRow[] {
  const locked = openRunInvoiceIds(runs, thisRunId);
  return invoices
    .filter(
      (inv) =>
        inv.status === 'Approved' &&
        inv.outstandingBalance > 0 &&
        !inv.is_payment_held &&
        !inv.is_exception &&
        !locked.has(inv.id),
    )
    .filter((inv) => {
      // Date axis (Jennifer 9/1/26 session): the "Due by" window and the
      // Overdue brackets UNION with each other — "everything overdue plus
      // everything due this week" is exactly why both get selected, and a
      // Next-N-days window (dueFrom = today) can never intersect a
      // past-due bracket. Each alone still narrows; together an invoice
      // passes by matching EITHER. Every other filter stacks with AND.
      const dueWindowActive = !!(filters.dueOnOrBefore || filters.dueFrom);
      const agingActive = !!filters.agingBuckets?.length;
      const inDueWindow =
        (!filters.dueOnOrBefore || inv.dueDate <= filters.dueOnOrBefore) &&
        (!filters.dueFrom || inv.dueDate >= filters.dueFrom);
      const inAgingBucket = (filters.agingBuckets ?? []).includes(agingBucketOf(inv.dueDate));
      if (dueWindowActive && agingActive) {
        if (!inDueWindow && !inAgingBucket) return false;
      } else if (dueWindowActive) {
        if (!inDueWindow) return false;
      } else if (agingActive) {
        if (!inAgingBucket) return false;
      }
      if (filters.amountMin != null && inv.outstandingBalance < filters.amountMin) return false;
      if (filters.amountMax != null && inv.outstandingBalance > filters.amountMax) return false;
      if (filters.vendors?.length && !filters.vendors.includes(inv.vendor)) return false;
      if (filters.paymentTerms?.length && !filters.paymentTerms.includes(paymentTermsFor(inv))) return false;
      if (filters.types?.length && !filters.types.includes(invoiceTypeLabel(inv.type))) return false;
      if (filters.discount) {
        const live = discountIsLive(discountTermsFor(inv), asOf);
        if (filters.discount === 'with' && !live) return false;
        if (filters.discount === 'without' && live) return false;
      }
      return true;
    })
    .map((inv) => ({
      invoice: inv,
      noPaymentMethod: vendorHasNoMethod(inv.vendor) || undefined,
      terms: paymentTermsFor(inv),
    }))
    .sort((a, b) => (a.invoice.dueDate < b.invoice.dueDate ? -1 : 1));
}

/* ── P2 · grouping ───────────────────────────────────────────────────── */

/** One payment per pay-to vendor, method and pay-from account inherited
 *  from the vendor's own defaults. User overrides on existing groups
 *  survive a regroup (lines added or removed in P1). */
export function deriveGroups(lines: PaymentRunLine[], existing: RunVendorGroup[]): RunVendorGroup[] {
  const vendors = [...new Set(lines.filter((l) => !l.removed).map((l) => l.vendor))];
  return vendors.map((vendor) => {
    const prior = existing.find((g) => g.vendor === vendor);
    if (prior) return prior;
    const d = vendorPayDefaults(vendor);
    return {
      vendor,
      methodId: d.method?.id ?? '',
      methodType: d.method?.type ?? 'Check',
      payFromAccountId: d.payFromAccountId,
      creditApplied: [],
    };
  });
}

export function groupLines(run: PaymentRun, vendor: string): PaymentRunLine[] {
  return liveLines(run).filter((l) => l.vendor === vendor);
}

/** Gross = sum of the vendor's line amounts. */
export function groupGross(run: PaymentRun, group: RunVendorGroup): number {
  return round2(groupLines(run, group.vendor).reduce((s, l) => s + l.payAmount, 0));
}

export function groupCredit(group: RunVendorGroup): number {
  return round2(group.creditApplied.reduce((s, c) => s + c.amount, 0));
}

/** Net cash out for the vendor: gross minus applied credit, floored at 0. */
export function groupNet(run: PaymentRun, group: RunVendorGroup): number {
  return Math.max(0, round2(groupGross(run, group) - groupCredit(group)));
}

/** Oldest-due-first credit allocation (Jennifer 9/1/26 session,
 *  supersedes the 8/5 proportional spread): on-account credit covers the
 *  oldest invoice IN FULL, then cascades the remainder to the next in
 *  line — the way a clerk works a statement. A $20k credit against a
 *  $10k oldest invoice takes the whole $10k and rolls the rest forward,
 *  never even or proportional chunks "for no reason you can recognize."
 *  ANCHORED draws still go first (8/28/26 review): a prepayment recorded
 *  against a specific invoice lands on that invoice, capped at its pay
 *  amount; only on-account credit cascades. Shared by the execution plan
 *  and the per-invoice credit chips so the preview always matches what
 *  posts. */
export function creditAllocation(run: PaymentRun, group: RunVendorGroup): Map<string, number> {
  const vlines = groupLines(run, group.vendor);
  const gross = round2(vlines.reduce((s, l) => s + l.payAmount, 0));
  const map = new Map<string, number>();
  if (gross <= 0.004) return map;

  // Pass 1: anchored draws pin to their own invoice, capped at the
  // line's pay amount (and at the gross overall).
  let anchoredUsed = 0;
  group.creditApplied
    .filter((c) => c.anchoredInvoiceNumber)
    .forEach((c) => {
      const line = vlines.find((l) => l.invoiceNumber === c.anchoredInvoiceNumber);
      if (!line) return;
      const already = map.get(line.invoiceId) ?? 0;
      const take = round2(Math.min(c.amount, Math.max(0, line.payAmount - already)));
      if (take <= 0.004) return;
      map.set(line.invoiceId, round2(already + take));
      anchoredUsed = round2(anchoredUsed + take);
    });

  // Pass 2: on-account credit cascades oldest due date first, each
  // invoice covered in full before the remainder rolls to the next.
  const onAccount = round2(
    group.creditApplied.filter((c) => !c.anchoredInvoiceNumber).reduce((s, c) => s + c.amount, 0),
  );
  const residualOf = (l: PaymentRunLine) => round2(Math.max(0, l.payAmount - (map.get(l.invoiceId) ?? 0)));
  const residualGross = round2(vlines.reduce((s, l) => s + residualOf(l), 0));
  const credit = Math.min(onAccount, residualGross);
  if (credit <= 0.004) return map;
  let remaining = credit;
  [...vlines]
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0))
    .forEach((l) => {
      if (remaining <= 0.004) return;
      const take = round2(Math.min(residualOf(l), remaining));
      if (take <= 0.004) return;
      map.set(l.invoiceId, round2((map.get(l.invoiceId) ?? 0) + take));
      remaining = round2(remaining - take);
    });
  return map;
}

/* ── Partial recording (user 10/21/26) ───────────────────────────────
 * A pass can pay a vendor LESS than its full amount; the rest stays open
 * on the run for a later pass. Each line tracks what earlier passes
 * recorded, and the vendor's prepayment credit posts with the first. */

/** What is still to record on a line. */
export function lineRemaining(line: PaymentRunLine): number {
  return round2(Math.max(0, line.payAmount - (line.recordedAmount ?? 0)));
}

/** Net cash still to record for the vendor: remaining gross, less the
 *  credit unless an earlier pass already posted it. */
export function groupRemainingNet(run: PaymentRun, group: RunVendorGroup): number {
  if (group.paymentId) return 0;
  const gross = round2(groupLines(run, group.vendor).reduce((s, l) => s + lineRemaining(l), 0));
  const credit = group.creditPosted ? 0 : groupCredit(group);
  return Math.max(0, round2(gross - credit));
}

export interface GroupPassSlice {
  line: PaymentRunLine;
  cash: number;
  credit: number;
}

/** One pass for one vendor: credit lands first (the shared allocation,
 *  measured on what is still open), then `cashAmount` cascades oldest
 *  due date first. Omitted cash = everything still open. `full` is true
 *  when the pass leaves nothing open on the vendor. */
export function planGroupPass(
  run: PaymentRun,
  group: RunVendorGroup,
  cashAmount?: number,
): { slices: GroupPassSlice[]; cash: number; credit: number; full: boolean } {
  const openRun = { ...run, lines: run.lines.map((l) => ({ ...l, payAmount: lineRemaining(l) })) };
  const vlines = groupLines(openRun, group.vendor).filter((l) => l.payAmount > 0.004);
  const alloc = group.creditPosted ? new Map<string, number>() : creditAllocation(openRun, group);
  const open = vlines.map((line) => {
    const credit = alloc.get(line.invoiceId) ?? 0;
    return { line, credit, cashOpen: round2(line.payAmount - credit) };
  });
  const cashOpen = round2(open.reduce((s, o) => s + o.cashOpen, 0));
  const target = cashAmount == null ? cashOpen : round2(Math.min(Math.max(0, cashAmount), cashOpen));
  let left = target;
  const cashBy = new Map<string, number>();
  [...open]
    .sort((a, b) => (a.line.dueDate < b.line.dueDate ? -1 : a.line.dueDate > b.line.dueDate ? 1 : 0))
    .forEach((o) => {
      const take = round2(Math.min(o.cashOpen, left));
      cashBy.set(o.line.invoiceId, take);
      left = round2(left - take);
    });
  // Slices keep the original line (its recordedAmount is what passes add to).
  const original = new Map(groupLines(run, group.vendor).map((l) => [l.invoiceId, l]));
  const slices = open.map((o) => ({
    line: original.get(o.line.invoiceId) ?? o.line,
    cash: cashBy.get(o.line.invoiceId) ?? 0,
    credit: o.credit,
  }));
  return {
    slices,
    cash: target,
    credit: round2(slices.reduce((s, x) => s + x.credit, 0)),
    full: target >= cashOpen - 0.004,
  };
}

/* ── Advances for pre-invoices (user 10/22/26) ─────────────────────── */

/** The account a vendor's pre-invoice payments debit on this run. */
export function advanceAccountFor(group: RunVendorGroup): string {
  return group.advanceAccount ?? ADVANCES_ACCOUNT;
}

/** Debit side of a run's journal: invoices debit Accounts Payable,
 *  pre-invoices debit the vendor's advances account. One row per
 *  account, at the gross the lines pay (cash + credit). */
export function runDebitRows(
  run: PaymentRun,
  groups: RunVendorGroup[] = run.groups,
): { code: string; name: string; debit: number; credit: number }[] {
  const byAccount = new Map<string, number>();
  groups.forEach((g) => {
    groupLines(run, g.vendor).forEach((l) => {
      const account = l.isPreInvoice ? advanceAccountFor(g) : '2000 Accounts Payable';
      byAccount.set(account, round2((byAccount.get(account) ?? 0) + l.payAmount));
    });
  });
  // Payables first, then advances, so the familiar line leads.
  return [...byAccount.entries()]
    .sort(([a], [b]) => (a.startsWith('2') ? -1 : b.startsWith('2') ? 1 : a.localeCompare(b)))
    .map(([account, debit]) => {
      const code = account.split(' ')[0];
      return { code, name: account.slice(code.length + 1), debit, credit: 0 };
    });
}

export function runTotal(run: PaymentRun): number {
  return round2(run.groups.reduce((s, g) => s + groupNet(run, g), 0));
}

/* ── Per-account cash readout (Available · Selected · Remaining) ─────── */

export interface AccountTotal {
  account: PayFromAccount;
  available: number;
  selected: number;
  remaining: number;
}

export function accountTotalsFromPairs(pairs: { accountId: string; amount: number }[]): AccountTotal[] {
  const byAccount = new Map<string, number>();
  pairs.forEach((p) => byAccount.set(p.accountId, round2((byAccount.get(p.accountId) ?? 0) + p.amount)));
  return [...byAccount.entries()]
    .map(([accountId, selected]) => {
      const account = PAY_FROM_ACCOUNTS.find((a) => a.id === accountId);
      if (!account) return null;
      return { account, available: account.balance, selected, remaining: round2(account.balance - selected) };
    })
    .filter((t): t is AccountTotal => t !== null)
    .sort((a, b) => b.selected - a.selected);
}

/** P2 rail: totals from the proposal's groups (net of credit). */
export function accountTotals(run: PaymentRun): AccountTotal[] {
  return accountTotalsFromPairs(
    run.groups.map((g) => ({ accountId: g.payFromAccountId, amount: groupNet(run, g) })),
  );
}

/** P1 readout: no groups yet, so each ticked invoice projects onto its
 *  vendor's default account. */
export function projectedAccountTotals(selected: Invoice[]): AccountTotal[] {
  return accountTotalsFromPairs(
    selected.map((inv) => ({
      accountId: vendorPayDefaults(inv.vendor).payFromAccountId,
      amount: inv.outstandingBalance,
    })),
  );
}

/* ── Exception checks (P2 gate + P3a review-by-exception) ────────────── */

const OVER_THRESHOLD = 50_000;

export function computeRunExceptions(
  run: PaymentRun,
  payments: Payment[],
): RunException[] {
  const out: RunException[] = [];
  const lines = liveLines(run);

  run.groups.forEach((group) => {
    const vendor = group.vendor;
    const vlines = lines.filter((l) => l.vendor === vendor);
    if (vlines.length === 0) return;

    if (vendorHasNoMethod(vendor) && !group.methodOverridden) {
      out.push({
        id: `no-method:${vendor}`,
        kind: 'no-method',
        severity: 'blocking',
        vendor,
        message: 'No payment method on file. Set a method for this run to continue.',
      });
    }

    // Possible duplicate: an existing live payment to the same vendor for
    // the same amount inside 30 days, or two identical line amounts for
    // one vendor in this run. Blocking until acknowledged.
    const net = groupNet(run, group);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const dup = payments.find(
      (p) =>
        p.vendor === vendor &&
        p.type === 'Payment' &&
        p.status !== 'Cancelled' &&
        p.status !== 'Reversed' &&
        Math.abs(p.amount - net) < 0.005 &&
        p.paymentDate >= cutoff.toISOString().split('T')[0],
    );
    const amounts = vlines.map((l) => l.payAmount);
    const twinLines = amounts.some((a, i) => amounts.findIndex((b) => Math.abs(a - b) < 0.005) !== i);
    if (dup) {
      out.push({
        id: `possible-duplicate:${vendor}`,
        kind: 'possible-duplicate',
        severity: 'blocking',
        ackable: true,
        vendor,
        message: `${dup.paymentNumber} already paid this vendor the same amount in the last 30 days. Acknowledge to keep it in the run.`,
      });
    } else if (twinLines) {
      out.push({
        id: `possible-duplicate:${vendor}`,
        kind: 'possible-duplicate',
        severity: 'blocking',
        ackable: true,
        vendor,
        message: 'Two invoices in this run bill the same amount for this vendor. Acknowledge if both are genuine.',
      });
    }

    if (vendorBankChanged(vendor)) {
      out.push({
        id: `bank-changed:${vendor}`,
        kind: 'bank-changed',
        severity: 'warning',
        vendor,
        message: 'Bank details on file changed in the last 30 days. Verify before paying.',
      });
    }

    // Unapplied credit the run is not using.
    const availableCredit = payments
      .filter((p) => p.type === 'Prepayment' && p.vendor === vendor && p.unappliedAmount > 0)
      .reduce((s, p) => s + p.unappliedAmount, 0);
    const appliedHere = groupCredit(group);
    if (availableCredit - appliedHere > 0.005) {
      out.push({
        id: `unapplied-credit:${vendor}`,
        kind: 'unapplied-credit',
        severity: 'warning',
        vendor,
        message: `$${round2(availableCredit - appliedHere).toLocaleString('en-US')} in prepayments is available and not applied in this run.`,
      });
    }

    if (net > OVER_THRESHOLD) {
      out.push({
        id: `over-threshold:${vendor}`,
        kind: 'over-threshold',
        severity: 'warning',
        vendor,
        message: `Payment exceeds the $${OVER_THRESHOLD.toLocaleString('en-US')} review threshold.`,
      });
    }

    const priorPayment = payments.some(
      (p) => p.vendor === vendor && p.type === 'Payment' && p.status !== 'Cancelled',
    );
    if (!priorPayment) {
      out.push({
        id: `first-payment:${vendor}`,
        kind: 'first-payment',
        severity: 'warning',
        vendor,
        message: 'First payment to this vendor. Double-check the payee details.',
      });
    }
  });

  return out;
}

/** Submit gate: any blocking exception that hasn't been acknowledged
 *  (and can't be, like no-method). Over-balance never blocks. */
export function unresolvedBlocking(run: PaymentRun, exceptions: RunException[]): RunException[] {
  return exceptions.filter(
    (e) => e.severity === 'blocking' && !(e.ackable && run.exceptionAcks[e.id]),
  );
}

/* ── Posting period ──────────────────────────────────────────────────── */

/** Anything before the first day of the current month posts to a closed
 *  period: blocked at P1 and re-checked at Execute. */
export function isClosedPeriod(dateIso: string): boolean {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  return dateIso < monthStart;
}

/* ── P3b · execute-time re-validation ───────────────────────────────── */

export interface RevalidationCheck {
  label: string;
  ok: boolean;
  detail?: string;
}

export interface LineFailure {
  invoiceId: string;
  invoiceNumber: string;
  vendor: string;
  reason: string;
}

export interface RevalidationResult {
  ok: boolean;
  checks: RevalidationCheck[];
  lineFailures: LineFailure[];
}

/** Re-validate before posting: period still open, accounts still valid,
 *  nothing paid elsewhere since approval. */
export function revalidateRun(run: PaymentRun, invoices: Invoice[]): RevalidationResult {
  const lineFailures: LineFailure[] = [];
  // Only what is STILL to record (user 10/15): a partially executed run
  // settled its own recorded invoices, and re-checking those flagged
  // every one as "paid elsewhere".
  const recordedVendors = new Set(run.groups.filter((g) => g.paymentId).map((g) => g.vendor));
  liveLines(run).forEach((line) => {
    if (recordedVendors.has(line.vendor)) return;
    // A partial pass settled part of the line already (user 10/21/26):
    // only what is still open has to be covered.
    const open = lineRemaining(line);
    if (open <= 0.004) return;
    const inv = invoices.find((i) => i.id === line.invoiceId);
    if (!inv) {
      lineFailures.push({ ...line, reason: 'Invoice no longer exists.' });
      return;
    }
    if (inv.status !== 'Approved' && inv.status !== 'Partially Paid') {
      lineFailures.push({ ...line, reason: `Invoice is now ${inv.status}.` });
      return;
    }
    if (inv.outstandingBalance < open - 0.005) {
      lineFailures.push({
        ...line,
        reason: `Paid elsewhere since approval: only $${inv.outstandingBalance.toLocaleString('en-US')} remains due.`,
      });
    }
  });

  const badAccounts = run.groups.filter(
    (g) => !g.paymentId && !PAY_FROM_ACCOUNTS.some((a) => a.id === g.payFromAccountId),
  );
  const periodOpen = !isClosedPeriod(run.paymentDate);

  const checks: RevalidationCheck[] = [
    {
      label: 'Posting period is open',
      ok: periodOpen,
      detail: periodOpen ? undefined : `${run.paymentDate} falls in a closed period. Change the payment date.`,
    },
    {
      label: 'Pay-from accounts are valid',
      ok: badAccounts.length === 0,
      detail: badAccounts.length ? `${badAccounts.map((g) => g.vendor).join(', ')} points at a missing account.` : undefined,
    },
    {
      label: 'Nothing was paid elsewhere since approval',
      ok: lineFailures.length === 0,
      detail: lineFailures.length
        ? `${lineFailures.length} invoice${lineFailures.length === 1 ? '' : 's'} changed since approval.`
        : undefined,
    },
  ];

  return { ok: checks.every((c) => c.ok), checks, lineFailures };
}

/* ── Execute: build the payment records ─────────────────────────────── */

export interface RunExecutionPlan {
  records: Payment[];
  /** invoiceId → applied, for the invoices that settle NOW: everything on
   *  Paid groups, plus the credit slice of Scheduled groups (credit
   *  commits at Execute; scheduled cash settles later via Mark as paid). */
  settleNow: { invoiceId: string; applied: number }[];
  /** Prepayment records drawn down by applied credit. */
  creditDraws: { paymentId: string; amount: number; invoiceNumbers: string[]; invoiceDraws?: { invoiceNumber: string; amount: number }[] }[];
  /** paymentId per vendor group, to stamp back onto the run. Only
   *  vendors this pass records IN FULL. */
  groupPayments: Record<string, string>;
  /** paymentId per vendor paid only in part this pass (user 10/21/26). */
  partialPayments: Record<string, string>;
  /** invoiceId → what this pass recorded on the line (cash + credit). */
  lineRecorded: { invoiceId: string; amount: number }[];
  /** Vendors whose prepayment credit posted with this pass. */
  creditPostedVendors: string[];
}

/** One payment per pay-to vendor. Future payment date posts Scheduled,
 *  today or past posts Paid. appliedInvoices carries the CASH slices
 *  only, so the existing Mark-as-paid path settles a scheduled payment
 *  without double-counting credit. */
export function buildRunExecution(
  run: PaymentRun,
  approvedBy?: string,
  /** Recording in pieces (Eli 9/25): only these vendors' payments post
   *  now; the rest stay recordable on a later pass. Omitted = all. */
  onlyVendors?: string[],
  /** Partial recording (user 10/21/26): vendor → cash to pay this pass.
   *  Less than what is open leaves the rest on the run. Omitted = all. */
  cashAmounts?: Record<string, number>,
): RunExecutionPlan {
  const today = todayIso();
  const scheduled = run.paymentDate > today;
  const year = new Date().getFullYear();
  const stampBase = Date.now();
  const records: Payment[] = [];
  const settleNow: RunExecutionPlan['settleNow'] = [];
  const creditDraws: RunExecutionPlan['creditDraws'] = [];
  const groupPayments: Record<string, string> = {};
  const partialPayments: Record<string, string> = {};
  const lineRecorded: RunExecutionPlan['lineRecorded'] = [];
  const creditPostedVendors: string[] = [];
  const vendorCount = run.groups.filter((g) => groupLines(run, g.vendor).length > 0).length;

  // Pay-from account id → its credit-side GL string for journal lines.
  const payFromGlFor = (accountId: string) =>
    PAY_FROM_ACCOUNTS.find((a) => a.id === accountId)?.creditGl ?? accountId;

  run.groups.forEach((group, idx) => {
    // Partial recording (Eli 9/25): skip unselected vendors and anything
    // an earlier pass already posted (it carries its paymentId).
    if (onlyVendors && !onlyVendors.includes(group.vendor)) return;
    if (group.paymentId) return;

    // Credit cascades OLDEST DUE FIRST across the vendor's lines
    // (Jennifer 9/1/26); whatever credit covers is NOT in the payment's
    // cash allocation. A partial pass (user 10/21/26) then spreads its
    // cash oldest due first and leaves the rest open on the run.
    const pass = planGroupPass(run, group, cashAmounts?.[group.vendor]);
    const cashSlices = pass.slices.filter((c) => c.cash + c.credit > 0.004);
    if (cashSlices.length === 0) return;
    const vlines = cashSlices.map((c) => c.line);

    // The payment debits the payables account its invoices posted to
    // (9/22/26 review response, GPT C08-D4) — never a hardcoded 2000.
    const groupApAccount = vlines.find((l) => l.apAccount)?.apAccount ?? '2000 Accounts Payable';

    const amount = round2(cashSlices.reduce((s, c) => s + c.cash, 0));
    const paymentId = `pmt-run-${stampBase}-${idx + 1}`;
    if (pass.full) groupPayments[group.vendor] = paymentId;
    else partialPayments[group.vendor] = paymentId;
    cashSlices.forEach((c) => lineRecorded.push({ invoiceId: c.line.invoiceId, amount: round2(c.cash + c.credit) }));
    if (pass.credit > 0.004) creditPostedVendors.push(group.vendor);

    if (pass.credit > 0.004 && group.creditApplied.length > 0) {
      // Attribute each source advance's draw to the invoices its credit
      // covered, in the same oldest-due order the allocation used, so
      // the advance's applied list carries real per-invoice dollars
      // (9/22/26 review response, GPT RR12).
      const creditQueue = cashSlices
        .filter((c) => c.credit > 0.004)
        .map((c) => ({ invoiceNumber: c.line.invoiceNumber, remaining: c.credit }));
      let qi = 0;
      group.creditApplied.forEach((draw) => {
        let left = round2(draw.amount);
        const invoiceDraws: { invoiceNumber: string; amount: number }[] = [];
        while (left > 0.004 && qi < creditQueue.length) {
          const q = creditQueue[qi];
          const take = round2(Math.min(left, q.remaining));
          if (take > 0.004) {
            invoiceDraws.push({ invoiceNumber: q.invoiceNumber, amount: take });
            q.remaining = round2(q.remaining - take);
            left = round2(left - take);
          }
          if (q.remaining <= 0.004) qi += 1;
        }
        creditDraws.push({
          paymentId: draw.paymentId,
          amount: draw.amount,
          invoiceNumbers: invoiceDraws.length > 0 ? invoiceDraws.map((d) => d.invoiceNumber) : vlines.map((l) => l.invoiceNumber),
          invoiceDraws: invoiceDraws.length > 0 ? invoiceDraws : undefined,
        });
      });
    }

    // Settlement: Paid groups settle everything now; Scheduled groups
    // settle only the credit slice now (cash waits for Mark as paid).
    cashSlices.forEach(({ line, cash, credit }) => {
      const applied = scheduled ? credit : round2(cash + credit);
      if (applied > 0.004) settleNow.push({ invoiceId: line.invoiceId, applied });
    });

    if (amount <= 0.004) return; // fully credit-covered, no cash record

    records.push({
      id: paymentId,
      paymentNumber: claimPaymentNumber(),
      type: 'Payment',
      vendor: group.vendor,
      paymentDate: run.paymentDate,
      createdDate: today,
      paymentMethod: group.methodType,
      bankAccount: group.payFromAccountId,
      apAccount: groupApAccount,
      amount,
      appliedInvoices: cashSlices
        .filter((c) => c.cash > 0.004)
        .map((c) => ({ invoiceNumber: c.line.invoiceNumber, amount: c.cash })),
      appliedAmount: scheduled ? 0 : amount,
      unappliedAmount: 0,
      currency: 'USD',
      // The reference typed at recording wins (9/22/26 review response,
      // Claude C11-X1) — the generated trace is only the fallback. Checks
      // without one get their number at Print.
      reference: group.reference?.trim()
        ? group.reference.trim()
        : group.methodType === 'Check'
          ? ''
          : group.methodType === 'ACH'
            ? `ACH-${900000 + ((stampBase + idx * 11) % 90000)}`
            : group.methodType === 'Wire'
              ? `WIRE-${700000 + ((stampBase + idx * 13) % 90000)}`
              : `TRF-${300000 + ((stampBase + idx * 17) % 90000)}`,
      // Memo auto-populates with the invoices paid (Eli 10/5: "payment
      // for invoice number blah blah" should be the default, editable):
      // a user note on the group wins, else the invoice list stands in.
      memo: group.note?.trim()
        ? group.note.trim()
        : vlines.length > 0
          ? `Payment for ${vlines.map((l) => l.invoiceNumber).join(', ')}`
          : `Payment to ${group.vendor}`,
      printMemo: `${run.id} · ${vlines.map((l) => l.invoiceNumber).join(', ')}`.slice(0, memoLimitFor(group.methodType)),
      status: scheduled ? 'Scheduled' : 'Paid',
      runId: run.id,
      runLabel: `${run.id} · ${vendorCount} vendor${vendorCount === 1 ? '' : 's'}`,
      runApprovedBy: approvedBy ?? run.approvedBy,
      wasScheduled: scheduled,
      createdBy: 'Ahtisham Ahmad',
      // The credit bridge + per-invoice split + journal snapshot persist
      // on the record (9/22/26 review response) — the same structures
      // this builder already computed and previously threw away.
      appliedCredits: group.creditApplied.length > 0
        ? group.creditApplied.map((d) => ({ sourcePaymentId: d.paymentId, sourcePaymentNumber: d.paymentNumber, amount: d.amount }))
        : undefined,
      perInvoiceSplit: cashSlices.map((c) => ({ invoiceNumber: c.line.invoiceNumber, cash: c.cash, credit: c.credit })),
      glEntries: buildPaymentGlEntries({
        type: 'Payment',
        cashAmount: amount,
        bankAccount: payFromGlFor(group.payFromAccountId),
        apAccount: groupApAccount,
        appliedCreditTotal: round2(cashSlices.reduce((s, c) => s + c.credit, 0)),
        creditAssetAccount: DEFAULT_PREPAYMENT_ASSET_ACCOUNT,
        description: `Payment run ${run.id} · ${group.vendor}`,
        // Pre-invoice slices are advances (user 10/22/26): they debit the
        // group's advances account, invoices debit payables.
        advanceDebit: {
          account: advanceAccountFor(group),
          amount: round2(cashSlices.filter((c) => c.line.isPreInvoice).reduce((s, c) => s + c.cash + c.credit, 0)),
        },
      }),
      // Check trail (Eli 9/25): a reference issued by the print flow's
      // blocking confirm records as PRINTED; a hand-typed number means
      // the check exists outside the flow — a MANUAL check.
      ...(group.methodType === 'Check' && group.reference?.trim()
        ? { checkPrint: { status: (group.printedViaFlow ? 'printed' : 'manual') as 'printed' | 'manual', by: 'Ahtisham Ahmad', at: today } }
        : {}),
    });
  });

  return { records, settleNow, creditDraws, groupPayments, partialPayments, lineRecorded, creditPostedVendors };
}
