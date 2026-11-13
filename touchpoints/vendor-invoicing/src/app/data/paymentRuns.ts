import { mockInvoices, type Invoice } from './mockInvoices';
import {
  PAY_FROM_ACCOUNTS,
  accountTypeForMethod,
  accountsForCurrency,
  vendorPaymentCurrency,
  type Payment,
} from './mockPayments';
import { vendorPaymentMethods, type VendorPaymentMethod } from './vendorPaymentMethods';
import { memoLimitFor } from '@/app/lib/memoLimits';
import { formatPaymentId, formatRunId, nextRunNumber } from '@/app/lib/invoiceIds';
import { stampPaymentRate } from '@/app/currency/paymentFx';

/* ── Payment runs (payment-run-flow.md, 7/29/26) ─────────────────────────
 *
 * A payment run pays many vendors in one reviewed, approved, recorded
 * batch. Parameters-first: the user sets criteria and the vendors fall
 * out of the query. Everything up to Execute is a free, editable draft;
 * Execute is the one irreversible step (the commit line).
 *
 * Lifecycle:  Draft → Pending approval → Approved ═ COMMIT ═ Executed
 *             → Partially executed → Completed
 * The approver never blunt-rejects (8/5/26): they REQUEST CHANGES with
 * per-line issues, and the creator resolves each one and resubmits.
 * Runs are long-lived objects: reopening one resumes at the stage its
 * status implies. "Clear to pay" is a RUN-LEVEL fact (a live line of an
 * Approved run), never a new invoice status. */

export type PaymentRunStatus =
  | 'Draft'
  | 'Pending Approval'
  // Changes requested stays on the DETAIL page (8/5/26): the creator
  // resolves each flagged issue there and resubmits, not a silent
  // draft flip. Orange identity, needs work, never terminal.
  | 'Changes Requested'
  | 'Approved'
  | 'Executed'
  | 'Partially Executed'
  | 'Completed'
  // Cancelled pre-execution (8/4/26): nothing posted, the invoices
  // return to the payable pool. Post-execution undo stays per-payment
  // reversal, never a run cancel.
  | 'Cancelled';

/** Where a Draft resumes: P1 (parameters) or P2 (proposal). */
export type PaymentRunStage = 'setup' | 'proposal';

export interface PaymentRunLine {
  invoiceId: string;
  /** Denormalized for display + payment records (survives invoice edits). */
  invoiceNumber: string;
  vendor: string;
  /** The invoice's currency (Currency & Exchange Rates), denormalized like
   *  invoiceNumber. Every amount on the line is in it, and it decides
   *  which payment the line joins: one payment can't mix currencies.
   *  Optional so lines predating it read the vendor's currency. */
  currency?: string;
  dueDate: string;
  /** Snapshot of the outstanding balance when the line was ticked. */
  balanceAtAdd: number;
  /** Editable in the proposal; over-balance warns, never blocks. */
  payAmount: number;
  /** Partial recording (user 10/21/26): what earlier passes of THIS run
   *  already recorded against the line (cash + credit). The rest of
   *  payAmount stays open on the run for a later pass. */
  recordedAmount?: number;
  /** The payables account the INVOICE posted to (9/22/26 review
   *  response, GPT C08-D4): the payment debits this, never a hardcoded
   *  2000. Optional so drafts predating the field still load. */
  apAccount?: string;
  /** The line pays a PRE-INVOICE (user 10/22/26): its payment is an
   *  advance, so the debit lands on the vendor group's advances account,
   *  not payables. Denormalized like invoiceNumber. */
  isPreInvoice?: boolean;
  /** Set when the line is dropped in review/approval, or leaves during
   *  change-request resolution ('changes'). Removed lines stay on the
   *  run for the audit trail but count nowhere. */
  removed?: { reason: string; by: string; at: string; stage: 'proposal' | 'approval' | 'changes' };
}

/* ── Request changes (8/5/26, replaces blunt rejection) ─────────────── */

/** How the creator resolved one flagged issue. */
export type RunIssueOutcome = 'fixed' | 'moved' | 'released';

/** One flagged issue on a change request: pinned to a line when
 *  invoiceId is set, run-level otherwise. */
export interface RunIssue {
  id: string;
  invoiceId?: string;
  /** Denormalized for display (survives the line leaving the run). */
  invoiceNumber?: string;
  vendor?: string;
  reason: string;
  note?: string;
  /** Display-only, no notification infra. Defaults to the run creator. */
  assignees: string[];
  resolution?: {
    outcome: RunIssueOutcome;
    /** Destination when the line moved to another run. */
    movedToRunId?: string;
    by: string;
    at: string;
  };
}

/** The approver's request-changes decision. Kept after resubmit (with
 *  resolvedAt stamped) so the story survives on the timeline. */
export interface RunChangeRequest {
  by: string;
  at: string;
  /** Optional request-level summary from the approver. */
  note?: string;
  issues: RunIssue[];
  /** Stamped when the run goes back to the approval queue. */
  resolvedAt?: string;
}

export interface RunCreditDraw {
  /** The prepayment record the credit draws from. */
  paymentId: string;
  paymentNumber: string;
  amount: number;
  /** Set when the prepayment was recorded AGAINST a specific invoice
   *  (8/28/26 review): the draw auto-applies when that invoice enters a
   *  run, and its allocation goes to that invoice first, never spread. */
  anchoredInvoiceNumber?: string;
}

export interface RunVendorGroup {
  vendor: string;
  /** The payment's currency (Currency & Exchange Rates): every line in the
   *  group is in it. A run pays one payment per vendor AND currency, so a
   *  vendor with open invoices in two currencies gets two groups. The
   *  payment goes out in it even from a base-currency account. Optional so
   *  groups predating it read the vendor's currency. */
  currency?: string;
  /** Saved-method instance id (vendorPaymentMethods). */
  methodId: string;
  /** Method type: Check / ACH / Wire / Bank Transfer / Card / Cash. */
  methodType: string;
  /** True when the user overrode the vendor's primary, for this run only. */
  methodOverridden?: boolean;
  payFromAccountId: string;
  accountOverridden?: boolean;
  /** Advances account the vendor's pre-invoice payments debit (user
   *  10/22/26, the Record Payment "Prepayment Account" field). Blank =
   *  1205 Advance Payments, the account a pre-invoice names. */
  advanceAccount?: string;
  /** Prepaid credit applied against this vendor's net. */
  creditApplied: RunCreditDraw[];
  /** Memo line (8/5/26, the Record Payment field): rides the payment,
   *  e.g. the ACH addenda. Blank means the invoice numbers are used. */
  note?: string;
  /** Method reference: ACH trace number, check number, wire confirmation, etc. */
  reference?: string;
  /** The reference came from the print flow's blocking confirm (Eli
   *  9/25): the recorded payment reads "printed"; a hand-typed check
   *  number reads "manual check" instead. */
  printedViaFlow?: boolean;
  /** Size in bytes when the file came through the real picker (8/4/26). */
  attachments?: { name: string; size?: number }[];
  /** The posted payment, stamped at Execute. Set only once the vendor's
   *  whole amount is recorded; partial passes leave it empty. */
  paymentId?: string;
  /** Payments posted by partial passes (user 10/21/26), oldest first.
   *  The vendor stays open on the run until a pass records the rest. */
  partialPaymentIds?: string[];
  /** The applied prepayment credit posted with an earlier partial pass,
   *  so later passes are cash only. */
  creditPosted?: boolean;
}

export type RunExceptionKind =
  | 'no-method'
  | 'bank-changed'
  | 'possible-duplicate'
  | 'unapplied-credit'
  | 'over-threshold'
  | 'first-payment';

export interface RunException {
  /** Stable identity so acknowledgements survive recomputes. */
  id: string;
  kind: RunExceptionKind;
  severity: 'blocking' | 'warning';
  vendor: string;
  invoiceId?: string;
  message: string;
  /** Blocking exceptions the user may acknowledge past (duplicates). */
  ackable?: boolean;
}

export interface CheckAssignment {
  paymentId: string;
  vendor: string;
  amount: number;
  checkNumber: number;
  /** Voided numbers stay in the lot forever, never reused. */
  status: 'assigned' | 'printed' | 'void';
}

export interface CheckLot {
  accountId: string;
  assignments: CheckAssignment[];
  confirmedAt?: string;
}

export interface NachaFileRecord {
  accountId: string;
  fileName: string;
  entryCount: number;
  total: number;
  generatedAt?: string;
  transmittedAt?: string;
  rejection?: { reason: string; at: string };
}

export interface WireInstruction {
  paymentId: string;
  vendor: string;
  amount: number;
  /** OBI field memo, 140 characters max. */
  obiMemo: string;
  confirmationNumber?: string;
}

export interface RunFilters {
  /** "Due by": everything due up to and including this date. */
  dueOnOrBefore?: string;
  /** Lower bound of a due-date window (the Last 7/14/30... presets). */
  dueFrom?: string;
  /** Overdue windows (Current, 1-30 days, ...), relabeled in
   *  overdue-days language on the filter (8/5/26). */
  agingBuckets?: string[];
  /** Amount due range, in the base currency (Currency & Exchange Rates):
   *  each invoice is compared at its own rate. */
  amountMin?: number;
  amountMax?: number;
  /** Vendor is an OPTIONAL filter, never the starting point. */
  vendors?: string[];
  /** Invoice currencies (Currency & Exchange Rates). */
  currencies?: string[];
  /** Payment terms, the partner template names (8/12/26). */
  paymentTerms?: string[];
  /** Invoice type families (8/12/26): Receiving Invoice, Pre-Invoice,
   *  Standalone Invoice. */
  types?: string[];
  /** Early-pay discount filter (8/28/26): 'with' keeps only invoices
   *  whose payment-term discount is still live on the run's payment
   *  date; 'without' hides them. Separate from the terms filter because
   *  pricing-rule discounts are a different, already-applied concept. */
  discount?: 'with' | 'without';
}

export interface PaymentRun {
  id: string;
  status: PaymentRunStatus;
  stage: PaymentRunStage;
  createdBy: string;
  createdAt: string;
  /** Drives Paid vs Scheduled at Execute. */
  paymentDate: string;
  filters: RunFilters;
  lines: PaymentRunLine[];
  groups: RunVendorGroup[];
  /** Acknowledged exception ids (possible duplicates the user vouched for). */
  exceptionAcks: Record<string, { reason?: string; by: string; at: string }>;
  submittedAt?: string;
  submittedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  /** Last time an approved run was sent back to the queue (8/5/26):
   *  pre-execution edits are fine, the run is recordation not posting. */
  returnedToPending?: { by: string; at: string };
  /** The approver's last request-changes decision with its issue list.
   *  resolvedAt set = the cycle closed with a resubmission. */
  changeRequest?: RunChangeRequest;
  /** Control FLAG (payment-hold model): a held run keeps its status but
   *  approve/execute stay locked until the hold is released. */
  hold?: { reason: string; by: string; at: string };
  /** Last hold release (user 10/22/26), the invoice release record:
   *  notes, who was told, supporting documents. */
  holdReleased?: { by: string; at: string; notes?: string; notifiedRecipientIds?: string[]; attachments?: string[] };
  /** Set when the run was cancelled pre-execution. */
  cancelled?: { reason: string; by: string; at: string };
  executedAt?: string;
  executedBy?: string;
  print: {
    checkLots: CheckLot[];
    nachaFiles: NachaFileRecord[];
    wires: WireInstruction[];
    remittanceSentAt?: string;
  };
  completedAt?: string;
  /** Last hands-on edit to the run (lines, groups, references), stamped
   *  by updateRun (user 10/22/26). Lifecycle steps carry their own stamps;
   *  runLastUpdate picks whichever is latest. */
  updatedAt?: string;
  updatedBy?: string;
}

/** Who touched the run last and when (user 10/22/26, the Last Updated
 *  By / On columns): the latest of creation, edits, submission, approval,
 *  change requests, holds, cancellation, recording and completion. */
export function runLastUpdate(run: PaymentRun): { by: string; at: string } {
  const events: { by?: string; at?: string }[] = [
    { by: run.createdBy, at: run.createdAt },
    { by: run.updatedBy, at: run.updatedAt },
    { by: run.submittedBy, at: run.submittedAt },
    { by: run.approvedBy, at: run.approvedAt },
    { by: run.returnedToPending?.by, at: run.returnedToPending?.at },
    { by: run.changeRequest?.by, at: run.changeRequest?.at },
    { by: run.hold?.by, at: run.hold?.at },
    { by: run.holdReleased?.by, at: run.holdReleased?.at },
    { by: run.cancelled?.by, at: run.cancelled?.at },
    { by: run.executedBy, at: run.executedAt },
    { by: run.executedBy, at: run.completedAt },
  ];
  const time = (iso: string) => new Date(iso.includes('T') ? iso : `${iso}T00:00:00`).getTime();
  let latest = { by: run.createdBy, at: run.createdAt };
  events.forEach((e) => {
    if (e.by && e.at && time(e.at) > time(latest.at)) latest = { by: e.by, at: e.at };
  });
  return latest;
}

/* ── Locking + clear-to-pay ─────────────────────────────────────────── */

/** An invoice can sit in only one OPEN run at a time. */
export const OPEN_RUN_STATUSES: PaymentRunStatus[] = ['Draft', 'Pending Approval', 'Changes Requested', 'Approved'];

/** Live (not removed) lines of a run. */
export function liveLines(run: PaymentRun): PaymentRunLine[] {
  return run.lines.filter((l) => !l.removed);
}

/* ── One payment per vendor and currency (Currency & Exchange Rates) ──
 * A payment can't mix currencies, so a run's payment is keyed by vendor
 * AND currency: a vendor with open invoices in two currencies is paid
 * twice. The key is what the run surfaces select, expand and record by;
 * the vendor name stays the display and the lookup for methods,
 * defaults and credit. */

/** A line's currency: its invoice's, else the vendor's (older lines). */
export const lineCurrency = (line: Pick<PaymentRunLine, 'currency' | 'vendor'>): string =>
  (line.currency || vendorPaymentCurrency(line.vendor)).toUpperCase();

/** A payment group's currency: its own, else the vendor's (older groups). */
export const groupCurrency = (group: Pick<RunVendorGroup, 'currency' | 'vendor'>): string =>
  (group.currency || vendorPaymentCurrency(group.vendor)).toUpperCase();

/** The identity of one payment on a run. */
export const runGroupKey = (vendor: string, currency: string): string => `${vendor}::${currency.toUpperCase()}`;

export const groupKeyOf = (group: Pick<RunVendorGroup, 'currency' | 'vendor'>): string =>
  runGroupKey(group.vendor, groupCurrency(group));

/** The payment a line belongs to. */
export const lineGroupKey = (line: Pick<PaymentRunLine, 'currency' | 'vendor'>): string =>
  runGroupKey(line.vendor, lineCurrency(line));

/** invoiceId → runId for every invoice locked by an open run. */
export function openRunInvoiceIds(runs: PaymentRun[], excludeRunId?: string): Map<string, string> {
  const map = new Map<string, string>();
  runs.forEach((run) => {
    if (run.id === excludeRunId) return;
    if (!OPEN_RUN_STATUSES.includes(run.status)) return;
    // A run being built reserves nothing (10/29, C-02): it isn't saved
    // until submit, so its invoices stay open to hold, credit memo and
    // cancel. The submit recheck catches anything that changed.
    if (run.status === 'Draft') return;
    liveLines(run).forEach((l) => map.set(l.invoiceId, run.id));
  });
  return map;
}

/** "Clear to pay" is run-level: a live line of an APPROVED run. The
 *  invoice's own status is untouched (Approved = the bill is valid;
 *  clear to pay = released for payment by this run). */
export function clearToPayRunId(runs: PaymentRun[], invoiceId: string): string | null {
  for (const run of runs) {
    if (run.status !== 'Approved') continue;
    if (liveLines(run).some((l) => l.invoiceId === invoiceId)) return run.id;
  }
  return null;
}

/* ── Run identity ───────────────────────────────────────────────────── */

/** System generated, never editable. The pattern is a system setting
 *  (8/5/26): PR-YYYY-MM-DD-NN, or compact MMDDYY-NN, with NN counting
 *  runs created the same day. */
export function nextRunId(runs: PaymentRun[], _date?: Date): string {
  // One sequence, six digits (10/29): RUN-000001, RUN-000002, ...
  return nextRunNumber(runs.map((r) => r.id));
}

/* ── Per-vendor payment defaults ────────────────────────────────────── */

export interface VendorPayDefaults {
  method: VendorPaymentMethod | null;
  payFromAccountId: string;
}

const FALLBACK_ACCOUNT =
  PAY_FROM_ACCOUNTS.find((a) => a.type === 'bank')?.id ?? PAY_FROM_ACCOUNTS[0].id;

/** The account a saved method draws from: the Cash Management account
 *  linked to the method's bank when one exists (the snap-to-bank
 *  convention from the single-payment flow), else the first account of
 *  the method's type, else the operating account. With a payment
 *  currency (Currency & Exchange Rates), only accounts in that currency
 *  or the base currency qualify. */
export function accountForMethod(method: VendorPaymentMethod | null, currency?: string): string {
  const pool = currency ? accountsForCurrency(PAY_FROM_ACCOUNTS, currency) : PAY_FROM_ACCOUNTS;
  const fallback = pool.find((a) => a.type === 'bank')?.id ?? FALLBACK_ACCOUNT;
  if (!method) return fallback;
  const wantType = accountTypeForMethod(method.type);
  const byBank = method.bankName
    ? pool.find((a) => a.type === wantType && a.bankName === method.bankName)
    : undefined;
  if (byBank) return byBank.id;
  const byType = pool.find((a) => (wantType === 'any' ? a.type === 'bank' : a.type === wantType));
  return byType?.id ?? fallback;
}

/** Each vendor carries its own method and pay-from account into a run;
 *  the account fits the payment's currency when one is given. */
export function vendorPayDefaults(vendor: string, currency?: string): VendorPayDefaults {
  const methods = vendorPaymentMethods(vendor);
  const primary = methods.find((m) => m.isPrimary) ?? methods[0] ?? null;
  return { method: primary, payFromAccountId: accountForMethod(primary, currency) };
}

/* ── Seeded example runs ────────────────────────────────────────────────
 * The Payment runs tab opens with history in it: one Completed run from
 * three weeks back (its posted payments ship as SEED_RUN_PAYMENTS) and
 * one run sitting in Pending approval. No Draft seed — runs have no
 * draft state (feedback 8/5/26). Fully deterministic slices of the
 * seeded invoice data, so the tab shows the same runs on every reload. */

const iso = (d: Date) => d.toISOString().split('T')[0];
function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
}
function atDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

/** Payable pool for the open seed runs: same predicate the Ready-to-pay
 *  tab uses, so seeded locks always point at rows the user can see. */
function seedEligible(): Invoice[] {
  return mockInvoices.filter(
    (inv) =>
      inv.status === 'Approved' &&
      inv.outstandingBalance > 0 &&
      inv.type !== 'Pre-Invoice' &&
      !inv.is_payment_held &&
      !inv.is_exception,
  );
}

function toLine(inv: Invoice): PaymentRunLine {
  return {
    invoiceId: inv.id,
    invoiceNumber: inv.invoiceNumber,
    vendor: inv.vendor,
    currency: inv.currency,
    dueDate: inv.dueDate,
    balanceAtAdd: inv.outstandingBalance,
    payAmount: inv.outstandingBalance,
    apAccount: inv.apAccount,
    isPreInvoice: inv.type === 'Pre-Invoice' || undefined,
  };
}

/** One group per vendor and currency, in line order (the runMath
 *  deriveGroups rule, for the seeds). */
function groupsFor(lines: PaymentRunLine[]): RunVendorGroup[] {
  const firstOfKey = new Map<string, PaymentRunLine>();
  lines.forEach((l) => {
    if (!firstOfKey.has(lineGroupKey(l))) firstOfKey.set(lineGroupKey(l), l);
  });
  return [...firstOfKey.values()].map((l) => {
    const currency = lineCurrency(l);
    const d = vendorPayDefaults(l.vendor, currency);
    return {
      vendor: l.vendor,
      currency,
      methodId: d.method?.id ?? '',
      methodType: d.method?.type ?? 'Check',
      payFromAccountId: d.payFromAccountId,
      creditApplied: [],
    };
  });
}

/** Take lines until we cover `vendorTarget` vendors or run out. */
function takeByVendor(pool: Invoice[], vendorTarget: number, maxLines: number): Invoice[] {
  const out: Invoice[] = [];
  const vendors = new Set<string>();
  for (const inv of pool) {
    if (out.length >= maxLines) break;
    if (!vendors.has(inv.vendor) && vendors.size >= vendorTarget) continue;
    vendors.add(inv.vendor);
    out.push(inv);
  }
  return out;
}

function buildSeeds(): { runs: PaymentRun[]; payments: Payment[] } {
  const eligible = seedEligible();
  const BY = 'Ahtisham Ahmad';
  const APPROVER = 'Eli Rosenbloom';

  /* Completed run, ~3 weeks ago. Its invoices come from the already
   * Paid-in-Full block so the books read coherently: the run paid them. */
  const paidPool = mockInvoices.filter(
    (inv) => inv.status === 'Paid in Full' && inv.type !== 'Pre-Invoice',
  );
  const completedInvoices = takeByVendor(paidPool, 4, 7);
  const completedLines: PaymentRunLine[] = completedInvoices.map((inv) => ({
    invoiceId: inv.id,
    invoiceNumber: inv.invoiceNumber,
    vendor: inv.vendor,
    currency: inv.currency,
    dueDate: inv.dueDate,
    balanceAtAdd: inv.amount,
    payAmount: inv.amount,
  }));
  const completedGroups = groupsFor(completedLines);
  // Demo guarantee (check-printing spec 9/22): the completed run always
  // carries at least one CHECK payment so the Print-checks flow is
  // reachable from seeded data — the first group prints from Corporate
  // Checking, the account whose register and number sequence are seeded.
  if (!completedGroups.some((g) => g.methodType === 'Check') && completedGroups.length > 0) {
    completedGroups[0].methodType = 'Check';
    completedGroups[0].payFromAccountId = '1020-Payroll';
  }
  const completedId = formatRunId(1);
  const completedVendorCount = new Set(completedGroups.map((g) => g.vendor)).size;
  const completedPayments: Payment[] = completedGroups.map((g, i) => {
    const glines = completedLines.filter((l) => lineGroupKey(l) === groupKeyOf(g));
    const amount = glines.reduce((s, l) => s + l.payAmount, 0);
    // In the group's currency with the rate on its payment date (Currency
    // & Exchange Rates), like every payment a run records.
    const currency = groupCurrency(g);
    const paymentDate = daysFromNow(-22);
    const isCheck = g.methodType === 'Check';
    const reference = isCheck
      ? `CHK-${44900 + i}`
      : g.methodType === 'ACH'
        ? `ACH-${910200 + i * 7}`
        : g.methodType === 'Wire'
          ? `WIRE-${770400 + i * 3}`
          : `TRF-${330500 + i * 9}`;
    g.paymentId = `pmt-run-c-${i + 1}`;
    return {
      id: `pmt-run-c-${i + 1}`,
      paymentNumber: formatPaymentId(201 + i),
      type: 'Payment',
      vendor: g.vendor,
      paymentDate,
      createdDate: paymentDate,
      paymentMethod: g.methodType,
      bankAccount: g.payFromAccountId,
      apAccount: '2000-Accounts Payable',
      amount,
      appliedInvoices: glines.map((l) => ({ invoiceNumber: l.invoiceNumber, amount: l.payAmount })),
      appliedAmount: amount,
      unappliedAmount: 0,
      currency,
      ...stampPaymentRate(currency, paymentDate),
      reference,
      memo: `Payment run ${completedId}`,
      printMemo: `${completedId} · ${glines.map((l) => l.invoiceNumber).join(', ')}`.slice(0, memoLimitFor(g.methodType)),
      status: 'Paid',
      runId: completedId,
      runLabel: `${completedId} · ${completedVendorCount} vendors`,
      runApprovedBy: APPROVER,
      wasScheduled: false,
      createdBy: BY,
      updatedDate: daysFromNow(-21),
      updatedBy: BY,
      // The completed run's check lot WAS confirmed printed (its checkLots
      // carry confirmedAt) — the payment records agree (Eli 9/25).
      ...(g.methodType === 'Check'
        ? { checkPrint: { status: 'printed' as const, by: BY, at: daysFromNow(-22) } }
        : {}),
    };
  });
  const checkAccounts = [...new Set(completedGroups.filter((g) => g.methodType === 'Check').map((g) => g.payFromAccountId))];
  const achAccounts = [...new Set(completedGroups.filter((g) => g.methodType === 'ACH').map((g) => g.payFromAccountId))];
  const completedRun: PaymentRun = {
    id: completedId,
    status: 'Completed',
    stage: 'proposal',
    createdBy: BY,
    createdAt: atDaysAgo(23),
    paymentDate: daysFromNow(-22),
    filters: { dueOnOrBefore: daysFromNow(-20) },
    lines: completedLines,
    groups: completedGroups,
    exceptionAcks: {},
    submittedAt: atDaysAgo(23),
    submittedBy: BY,
    approvedAt: atDaysAgo(22),
    approvedBy: APPROVER,
    executedAt: atDaysAgo(22),
    executedBy: BY,
    print: {
      checkLots: checkAccounts.map((accountId) => ({
        accountId,
        confirmedAt: atDaysAgo(22),
        assignments: completedGroups
          .filter((g) => g.methodType === 'Check' && g.payFromAccountId === accountId)
          .map((g, j) => ({
            paymentId: g.paymentId!,
            vendor: g.vendor,
            amount: completedPayments.find((p) => p.id === g.paymentId)!.amount,
            checkNumber: 44900 + j,
            status: 'printed' as const,
          })),
      })),
      nachaFiles: achAccounts.map((accountId) => {
        const entries = completedGroups.filter((g) => g.methodType === 'ACH' && g.payFromAccountId === accountId);
        return {
          accountId,
          fileName: `ACH-${accountId}-${daysFromNow(-22)}.ach`,
          entryCount: entries.length,
          total: entries.reduce((s, g) => s + (completedPayments.find((p) => p.id === g.paymentId)?.amount ?? 0), 0),
          generatedAt: atDaysAgo(22),
          transmittedAt: atDaysAgo(22),
        };
      }),
      wires: completedGroups
        .filter((g) => g.methodType === 'Wire')
        .map((g, j) => ({
          paymentId: g.paymentId!,
          vendor: g.vendor,
          amount: completedPayments.find((p) => p.id === g.paymentId)?.amount ?? 0,
          obiMemo: `Payment run ${completedId}`,
          confirmationNumber: `FED${77100 + j * 13}`,
        })),
      remittanceSentAt: atDaysAgo(21),
    },
    completedAt: atDaysAgo(21),
  };

  /* Pending approval run: submitted yesterday, waiting on the approver.
   * Its lines lock real ready-to-pay rows. */
  const pendingInvoices = takeByVendor(eligible, 3, 5);
  const pendingLines = pendingInvoices.map(toLine);
  const pendingRun: PaymentRun = {
    id: formatRunId(3),
    status: 'Pending Approval',
    stage: 'proposal',
    createdBy: 'Mahreen Ghafoor',
    createdAt: atDaysAgo(1),
    paymentDate: daysFromNow(3),
    filters: { agingBuckets: ['1-30 days', '31-60 days'] },
    lines: pendingLines,
    groups: groupsFor(pendingLines),
    exceptionAcks: {},
    submittedAt: atDaysAgo(1),
    submittedBy: 'Mahreen Ghafoor',
    print: { checkLots: [], nachaFiles: [], wires: [] },
  };

  /* Changes-requested run: the approver flagged two issues yesterday,
   * nothing resolved yet, so the demo opens onto the request-changes
   * flow. Lines come from the pool AFTER the pending run took its
   * slice, so the two open runs never double-lock an invoice. */
  const pendingIds = new Set(pendingInvoices.map((i) => i.id));
  const changesInvoices = takeByVendor(eligible.filter((i) => !pendingIds.has(i.id)), 2, 3);
  const changesLines = changesInvoices.map(toLine);
  const changesRun: PaymentRun = {
    id: formatRunId(2),
    status: 'Changes Requested',
    stage: 'proposal',
    createdBy: 'Mahreen Ghafoor',
    createdAt: atDaysAgo(2),
    paymentDate: daysFromNow(2),
    filters: {},
    lines: changesLines,
    groups: groupsFor(changesLines),
    exceptionAcks: {},
    changeRequest: {
      by: APPROVER,
      at: atDaysAgo(1),
      issues: [
        ...(changesLines[0]
          ? [{
              id: 'iss-seed-1',
              invoiceId: changesLines[0].invoiceId,
              invoiceNumber: changesLines[0].invoiceNumber,
              vendor: changesLines[0].vendor,
              reason: 'Wrong payment method',
              note: 'Pay this one by card instead of check.',
              assignees: ['Mahreen Ghafoor'],
            }]
          : []),
        {
          id: 'iss-seed-2',
          reason: 'Payment date needs to move',
          note: 'Push the run to after the funding confirmation lands.',
          assignees: ['Mahreen Ghafoor'],
        },
      ],
    },
    print: { checkLots: [], nachaFiles: [], wires: [] },
  };

  return { runs: [pendingRun, changesRun, completedRun], payments: completedPayments };
}

const seeds = buildSeeds();

export const SEED_RUNS: PaymentRun[] = seeds.runs;
/** The Completed seed run's posted payments; App.tsx merges these into
 *  the payments state so Payment history tells the same story. */
export const SEED_RUN_PAYMENTS: Payment[] = seeds.payments;
