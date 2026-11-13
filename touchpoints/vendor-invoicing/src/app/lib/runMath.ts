import type { Invoice } from '@/app/data/mockInvoices';
import { PAY_FROM_ACCOUNTS, type Payment, type PayFromAccount } from '@/app/data/mockPayments';
import { buildPaymentGlEntries, type GlEntryLine } from '@/app/lib/glPosting';
import { ADVANCES_ACCOUNT, DEFAULT_PREPAYMENT_ASSET_ACCOUNT } from '@/app/data/glAccounts';
import { localTodayIso, addDaysIso } from '@/app/lib/dueBucket';
import {
  openRunInvoiceIds,
  liveLines,
  vendorPayDefaults,
  groupCurrency,
  groupKeyOf,
  lineCurrency,
  lineGroupKey,
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
import { BASE_CURRENCY, isBaseCurrency } from '@/app/currency/currencies';
import { formatMoney } from '@/app/currency/money';
import { toBase } from '@/app/currency/rates';
import { toInvoiceBase, type InvoiceFx } from '@/app/currency/invoiceFx';
import { paymentFx, stampPaymentRate } from '@/app/currency/paymentFx';

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
      // The amount range is in the base currency (Currency & Exchange
      // Rates): each invoice compares at its own rate, so a ¥ balance
      // never passes on its face value.
      const dueInBase = toInvoiceBase(inv, inv.outstandingBalance);
      if (filters.amountMin != null && dueInBase < filters.amountMin) return false;
      if (filters.amountMax != null && dueInBase > filters.amountMax) return false;
      if (filters.vendors?.length && !filters.vendors.includes(inv.vendor)) return false;
      if (filters.currencies?.length && !filters.currencies.includes((inv.currency || BASE_CURRENCY).toUpperCase())) return false;
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

/** One payment per pay-to vendor AND currency (Currency & Exchange
 *  Rates: one payment can't mix currencies, so a vendor with invoices in
 *  two currencies is paid twice). Method and pay-from account are
 *  inherited from the vendor's own defaults, the account limited to the
 *  payment's currency or the base currency. User overrides on existing
 *  groups survive a regroup (lines added or removed in P1). */
export function deriveGroups(lines: PaymentRunLine[], existing: RunVendorGroup[]): RunVendorGroup[] {
  const firstOfKey = new Map<string, PaymentRunLine>();
  lines.filter((l) => !l.removed).forEach((l) => {
    if (!firstOfKey.has(lineGroupKey(l))) firstOfKey.set(lineGroupKey(l), l);
  });
  return [...firstOfKey.entries()].map(([key, line]) => {
    const prior = existing.find((g) => groupKeyOf(g) === key);
    const currency = lineCurrency(line);
    if (prior) return prior.currency ? prior : { ...prior, currency };
    const d = vendorPayDefaults(line.vendor, currency);
    return {
      vendor: line.vendor,
      currency,
      methodId: d.method?.id ?? '',
      methodType: d.method?.type ?? 'Check',
      payFromAccountId: d.payFromAccountId,
      creditApplied: [],
    };
  });
}

/** The live lines one payment settles: its vendor's, in its currency. */
export function groupLines(run: PaymentRun, group: RunVendorGroup): PaymentRunLine[] {
  const key = groupKeyOf(group);
  return liveLines(run).filter((l) => lineGroupKey(l) === key);
}

/** The vendor's run is split by currency: it has more than one payment here. */
export function isSplitVendor(run: PaymentRun, vendor: string): boolean {
  return run.groups.filter((g) => g.vendor === vendor && groupLines(run, g).length > 0).length > 1;
}

/** Gross = sum of the payment's line amounts (in its currency). */
export function groupGross(run: PaymentRun, group: RunVendorGroup): number {
  return round2(groupLines(run, group).reduce((s, l) => s + l.payAmount, 0));
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
  const vlines = groupLines(run, group);
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
  const gross = round2(groupLines(run, group).reduce((s, l) => s + lineRemaining(l), 0));
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
  const vlines = groupLines(openRun, group).filter((l) => l.payAmount > 0.004);
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
  const original = new Map(groupLines(run, group).map((l) => [l.invoiceId, l]));
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

/* ── A run's money across currencies (Currency & Exchange Rates) ─────
 * Each payment goes out in its own currency at the rate on the run's
 * payment date, the rate its record is stamped with. Run totals are kept
 * per currency, plus one base total that converts each payment at its
 * own rate before adding up; a raw sum across currencies is never shown. */

/** An amount in its currency, with its base-currency equivalent. */
export interface CurrencyAmount {
  currency: string;
  amount: number;
  base: number;
}

/** Adds amounts up per currency, largest (in base) first. */
export function addByCurrency(items: CurrencyAmount[]): CurrencyAmount[] {
  const map = new Map<string, CurrencyAmount>();
  items.forEach((i) => {
    const code = (i.currency || BASE_CURRENCY).toUpperCase();
    const cur = map.get(code) ?? { currency: code, amount: 0, base: 0 };
    map.set(code, { currency: code, amount: round2(cur.amount + i.amount), base: round2(cur.base + i.base) });
  });
  return [...map.values()].sort((a, b) => b.base - a.base || a.currency.localeCompare(b.currency));
}

/** The base total of amounts each already converted at its own rate. */
export const baseSum = (items: CurrencyAmount[]): number => round2(items.reduce((s, i) => s + i.base, 0));

/** Base per one unit of a payment currency on a payment date: the rate a
 *  run's payment is stamped with (stampPaymentRate). */
export function paymentRateOn(currency: string, paymentDate: string): number {
  if (isBaseCurrency(currency)) return 1;
  return stampPaymentRate(currency, paymentDate).exchangeRate ?? 1;
}

/** An amount in one currency in another, through the base at the
 *  payment-date rates (a payment drawn on an account in another currency). */
export function convertOn(amount: number, from: string, to: string, date: string): number {
  if ((from || BASE_CURRENCY).toUpperCase() === (to || BASE_CURRENCY).toUpperCase()) return amount;
  const base = toBase(amount, paymentRateOn(from, date));
  return isBaseCurrency(to) ? base : round2(base / paymentRateOn(to, date));
}

/** The payment's rate: its currency's, on the run's payment date. */
export const groupRate = (run: PaymentRun, group: RunVendorGroup): number =>
  paymentRateOn(groupCurrency(group), run.paymentDate);

/** The rate card for a payment amount before it posts (Money's hover). */
export function groupFx(run: PaymentRun, group: RunVendorGroup): InvoiceFx {
  const currency = groupCurrency(group);
  return paymentFx({ currency, paymentDate: run.paymentDate, ...stampPaymentRate(currency, run.paymentDate) });
}

/** One of the payment's amounts with its base equivalent. */
export const groupAmount = (run: PaymentRun, group: RunVendorGroup, amount: number): CurrencyAmount => ({
  currency: groupCurrency(group),
  amount,
  base: toBase(amount, groupRate(run, group)),
});

/** Net cash out per currency (and in base) across payments. */
export const runNetByCurrency = (run: PaymentRun, groups: RunVendorGroup[] = run.groups): CurrencyAmount[] =>
  addByCurrency(groups.map((g) => groupAmount(run, g, groupNet(run, g))));

/** What the payments settle (cash + credit) per currency. */
export const runGrossByCurrency = (run: PaymentRun, groups: RunVendorGroup[] = run.groups): CurrencyAmount[] =>
  addByCurrency(groups.map((g) => groupAmount(run, g, groupGross(run, g))));

/** Vendor credit drawn per currency. */
export const runCreditByCurrency = (run: PaymentRun, groups: RunVendorGroup[] = run.groups): CurrencyAmount[] =>
  addByCurrency(groups.filter((g) => groupCredit(g) > 0.004).map((g) => groupAmount(run, g, groupCredit(g))));

/** The run's cash out in the base currency, each payment at its own rate. */
export function runTotalBase(run: PaymentRun): number {
  return baseSum(runNetByCurrency(run));
}

export interface GlPreviewRow {
  code: string;
  name: string;
  debit: number;
  credit: number;
}

const splitGl = (account: string) => {
  const code = account.split(' ')[0];
  return { code, name: account.slice(code.length + 1) };
};

/** The run's journal in the base currency (the ledger's): invoices debit
 *  Accounts Payable, pre-invoices the vendor's advances account, each
 *  pay-from account is credited its cash out and prepayments the credit
 *  drawn. Each payment converts at its own rate; the cent rounding lands
 *  on its largest debit so every payment still balances (the invoice
 *  journal's rule, glFx). */
export function runGlRows(run: PaymentRun, groups: RunVendorGroup[] = run.groups): GlPreviewRow[] {
  const debitBy = new Map<string, number>();
  const creditBy = new Map<string, GlPreviewRow>();
  let prepaymentCredit = 0;
  groups.forEach((g) => {
    const lines = groupLines(run, g);
    if (lines.length === 0) return;
    const rate = groupRate(run, g);
    const inCurrency = new Map<string, number>();
    lines.forEach((l) => {
      const account = l.isPreInvoice ? advanceAccountFor(g) : '2000 Accounts Payable';
      inCurrency.set(account, round2((inCurrency.get(account) ?? 0) + l.payAmount));
    });
    const debits = [...inCurrency.entries()].map(([account, amount]) => ({ account, base: toBase(amount, rate) }));
    const net = groupNet(run, g);
    const credit = groupCredit(g);
    const cashBase = toBase(net, rate);
    const creditBase = toBase(credit, rate);
    const balancedInCurrency = Math.abs(groupGross(run, g) - round2(net + credit)) < 0.005;
    const diff = round2(cashBase + creditBase - debits.reduce((s, d) => s + d.base, 0));
    if (balancedInCurrency && debits.length > 0 && Math.abs(diff) >= 0.005) {
      const largest = debits.reduce((best, d, i) => (d.base > debits[best].base ? i : best), 0);
      debits[largest] = { ...debits[largest], base: round2(debits[largest].base + diff) };
    }
    debits.forEach((d) => debitBy.set(d.account, round2((debitBy.get(d.account) ?? 0) + d.base)));
    const acct = PAY_FROM_ACCOUNTS.find((a) => a.id === g.payFromAccountId);
    const row = creditBy.get(g.payFromAccountId) ?? {
      code: g.payFromAccountId.split('-')[0],
      name: acct ? (acct.label.includes('·') ? acct.label.split('·')[1].trim() : acct.label) : g.payFromAccountId,
      debit: 0,
      credit: 0,
    };
    creditBy.set(g.payFromAccountId, { ...row, credit: round2(row.credit + cashBase) });
    prepaymentCredit = round2(prepaymentCredit + creditBase);
  });
  // Payables first, then advances, so the familiar line leads.
  const debitRows = [...debitBy.entries()]
    .sort(([a], [b]) => (a.startsWith('2') ? -1 : b.startsWith('2') ? 1 : a.localeCompare(b)))
    .map(([account, debit]) => ({ ...splitGl(account), debit, credit: 0 }));
  const creditRows = [...creditBy.values()].filter((r) => r.credit > 0.004).sort((a, b) => b.credit - a.credit);
  return [
    ...debitRows,
    ...creditRows,
    ...(prepaymentCredit > 0.004 ? [{ ...splitGl(DEFAULT_PREPAYMENT_ASSET_ACCOUNT), debit: 0, credit: prepaymentCredit }] : []),
  ];
}

/* ── Per-account cash readout (Available · Selected · Remaining) ─────── */

/** One pay-from account's readout, all three figures in the ACCOUNT's
 *  currency (Currency & Exchange Rates): a payment in another currency
 *  converts through the base at the payment-date rates. */
export interface AccountTotal {
  account: PayFromAccount;
  available: number;
  selected: number;
  remaining: number;
}

export function accountTotalsFromPairs(
  pairs: { accountId: string; amount: number; currency?: string }[],
  date: string = todayIso(),
): AccountTotal[] {
  const byAccount = new Map<string, number>();
  pairs.forEach((p) => {
    const account = PAY_FROM_ACCOUNTS.find((a) => a.id === p.accountId);
    const inAccount = account && p.currency ? convertOn(p.amount, p.currency, account.currency, date) : p.amount;
    byAccount.set(p.accountId, round2((byAccount.get(p.accountId) ?? 0) + inAccount));
  });
  const inBase = (t: AccountTotal) => toBase(t.selected, paymentRateOn(t.account.currency, date));
  return [...byAccount.entries()]
    .map(([accountId, selected]) => {
      const account = PAY_FROM_ACCOUNTS.find((a) => a.id === accountId);
      if (!account) return null;
      return { account, available: account.balance, selected, remaining: round2(account.balance - selected) };
    })
    .filter((t): t is AccountTotal => t !== null)
    // Largest cash out first, compared in the base currency.
    .sort((a, b) => inBase(b) - inBase(a));
}

/** P2 rail: totals from the proposal's groups (net of credit). */
export function accountTotals(run: PaymentRun): AccountTotal[] {
  return accountTotalsFromPairs(
    run.groups.map((g) => ({ accountId: g.payFromAccountId, amount: groupNet(run, g), currency: groupCurrency(g) })),
    run.paymentDate,
  );
}

/** P1 readout: no groups yet, so each ticked invoice projects onto its
 *  vendor's default account for its currency. */
export function projectedAccountTotals(selected: Invoice[]): AccountTotal[] {
  return accountTotalsFromPairs(
    selected.map((inv) => ({
      accountId: vendorPayDefaults(inv.vendor, inv.currency).payFromAccountId,
      amount: inv.outstandingBalance,
      currency: inv.currency,
    })),
  );
}

/* ── Exception checks (P2 gate + P3a review-by-exception) ────────────── */

/** Review threshold, in the base currency (Currency & Exchange Rates):
 *  each payment is compared at its rate on the payment date. */
const OVER_THRESHOLD_BASE = 10_000_000;

export function computeRunExceptions(
  run: PaymentRun,
  payments: Payment[],
): RunException[] {
  const out: RunException[] = [];
  // Vendor facts (method, bank details, first payment) raise once per
  // vendor; payment facts once per payment, which is per vendor AND
  // currency (Currency & Exchange Rates).
  const vendorSeen = new Set<string>();

  run.groups.forEach((group) => {
    const vendor = group.vendor;
    const key = groupKeyOf(group);
    const currency = groupCurrency(group);
    const vlines = groupLines(run, group);
    if (vlines.length === 0) return;
    const firstForVendor = !vendorSeen.has(vendor);
    vendorSeen.add(vendor);

    if (vendorHasNoMethod(vendor) && !group.methodOverridden) {
      out.push({
        id: `no-method:${key}`,
        kind: 'no-method',
        severity: 'blocking',
        vendor,
        message: 'No payment method on file. Set a method for this run to continue.',
      });
    }

    // Possible duplicate: an existing live payment to the same vendor for
    // the same amount in the same currency inside 30 days, or two
    // identical line amounts on one payment in this run. Blocking until
    // acknowledged.
    const net = groupNet(run, group);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const dup = payments.find(
      (p) =>
        p.vendor === vendor &&
        (p.currency || BASE_CURRENCY).toUpperCase() === currency &&
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
        id: `possible-duplicate:${key}`,
        kind: 'possible-duplicate',
        severity: 'blocking',
        ackable: true,
        vendor,
        message: `${dup.paymentNumber} already paid this vendor the same amount in the last 30 days. Acknowledge to keep it in the run.`,
      });
    } else if (twinLines) {
      out.push({
        id: `possible-duplicate:${key}`,
        kind: 'possible-duplicate',
        severity: 'blocking',
        ackable: true,
        vendor,
        message: 'Two invoices in this run bill the same amount for this vendor. Acknowledge if both are genuine.',
      });
    }

    if (firstForVendor && vendorBankChanged(vendor)) {
      out.push({
        id: `bank-changed:${vendor}`,
        kind: 'bank-changed',
        severity: 'warning',
        vendor,
        message: 'Bank details on file changed in the last 30 days. Verify before paying.',
      });
    }

    // Unapplied credit the payment is not using: only prepayments in its
    // own currency can be drawn against it.
    const availableCredit = payments
      .filter(
        (p) =>
          p.type === 'Prepayment' &&
          p.vendor === vendor &&
          (p.currency || BASE_CURRENCY).toUpperCase() === currency &&
          p.unappliedAmount > 0,
      )
      .reduce((s, p) => s + p.unappliedAmount, 0);
    const appliedHere = groupCredit(group);
    if (availableCredit - appliedHere > 0.005) {
      out.push({
        id: `unapplied-credit:${key}`,
        kind: 'unapplied-credit',
        severity: 'warning',
        vendor,
        message: `${formatMoney(round2(availableCredit - appliedHere), currency)} in prepayments is available and not applied in this run.`,
      });
    }

    if (toBase(net, groupRate(run, group)) > OVER_THRESHOLD_BASE) {
      out.push({
        id: `over-threshold:${key}`,
        kind: 'over-threshold',
        severity: 'warning',
        vendor,
        message: `Payment exceeds the ${formatMoney(OVER_THRESHOLD_BASE, BASE_CURRENCY)} review threshold.`,
      });
    }

    const priorPayment = payments.some(
      (p) => p.vendor === vendor && p.type === 'Payment' && p.status !== 'Cancelled',
    );
    if (firstForVendor && !priorPayment) {
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
  // Recorded payments are keyed by vendor and currency: a split vendor's
  // other payment still checks its own lines.
  const recordedGroups = new Set(run.groups.filter((g) => g.paymentId).map(groupKeyOf));
  liveLines(run).forEach((line) => {
    if (recordedGroups.has(lineGroupKey(line))) return;
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
        reason: `Paid elsewhere since approval: only ${formatMoney(inv.outstandingBalance, lineCurrency(line))} remains due.`,
      });
    }
  });

  const open = run.groups.filter((g) => !g.paymentId && groupLines(run, g).length > 0);
  const badAccounts = open.filter((g) => !PAY_FROM_ACCOUNTS.some((a) => a.id === g.payFromAccountId));
  // A payment draws on an account in its own currency or the base
  // currency (Currency & Exchange Rates), never a third one.
  const wrongCurrency = open.filter((g) => {
    const account = PAY_FROM_ACCOUNTS.find((a) => a.id === g.payFromAccountId);
    return !!account && !isBaseCurrency(account.currency) && account.currency !== groupCurrency(g);
  });
  const periodOpen = !isClosedPeriod(run.paymentDate);
  const vendorList = (groups: RunVendorGroup[]) => [...new Set(groups.map((g) => g.vendor))].join(', ');

  const checks: RevalidationCheck[] = [
    {
      label: 'Posting period is open',
      ok: periodOpen,
      detail: periodOpen ? undefined : `${run.paymentDate} falls in a closed period. Change the payment date.`,
    },
    {
      label: 'Pay-from accounts are valid',
      ok: badAccounts.length === 0 && wrongCurrency.length === 0,
      detail: badAccounts.length
        ? `${vendorList(badAccounts)} points at a missing account.`
        : wrongCurrency.length
          ? `${vendorList(wrongCurrency)} draws on an account in another currency. Pick one in the payment's currency or the base currency.`
          : undefined,
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
  /** paymentId per payment group (keyed by groupKeyOf: vendor and
   *  currency), to stamp back onto the run. Only groups this pass records
   *  IN FULL. */
  groupPayments: Record<string, string>;
  /** paymentId per group paid only in part this pass (user 10/21/26). */
  partialPayments: Record<string, string>;
  /** invoiceId → what this pass recorded on the line (cash + credit). */
  lineRecorded: { invoiceId: string; amount: number }[];
  /** Groups (groupKeyOf) whose prepayment credit posted with this pass. */
  creditPostedGroups: string[];
}

/** One payment per pay-to vendor and currency (Currency & Exchange
 *  Rates): each goes out in its group's currency, stamped with that
 *  currency's rate on the payment date, even from a base-currency
 *  account. Future payment date posts Scheduled,
 *  today or past posts Paid. appliedInvoices carries the CASH slices
 *  only, so the existing Mark-as-paid path settles a scheduled payment
 *  without double-counting credit. */
export function buildRunExecution(
  run: PaymentRun,
  approvedBy?: string,
  /** Recording in pieces (Eli 9/25): only these payments (groupKeyOf)
   *  post now; the rest stay recordable on a later pass. Omitted = all. */
  onlyGroups?: string[],
  /** Partial recording (user 10/21/26): group key → cash to pay this
   *  pass, in the payment's currency. Less than what is open leaves the
   *  rest on the run. Omitted = all. */
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
  const creditPostedGroups: string[] = [];
  // The run label counts vendors; a vendor split by currency is one vendor.
  const vendorCount = new Set(run.groups.filter((g) => groupLines(run, g).length > 0).map((g) => g.vendor)).size;

  // Pay-from account id → its credit-side GL string for journal lines.
  const payFromGlFor = (accountId: string) =>
    PAY_FROM_ACCOUNTS.find((a) => a.id === accountId)?.creditGl ?? accountId;

  run.groups.forEach((group, idx) => {
    // Partial recording (Eli 9/25): skip unselected payments and anything
    // an earlier pass already posted (it carries its paymentId).
    const key = groupKeyOf(group);
    const currency = groupCurrency(group);
    if (onlyGroups && !onlyGroups.includes(key)) return;
    if (group.paymentId) return;

    // Credit cascades OLDEST DUE FIRST across the vendor's lines
    // (Jennifer 9/1/26); whatever credit covers is NOT in the payment's
    // cash allocation. A partial pass (user 10/21/26) then spreads its
    // cash oldest due first and leaves the rest open on the run.
    const pass = planGroupPass(run, group, cashAmounts?.[key]);
    const cashSlices = pass.slices.filter((c) => c.cash + c.credit > 0.004);
    if (cashSlices.length === 0) return;
    const vlines = cashSlices.map((c) => c.line);

    // The payment debits the payables account its invoices posted to
    // (9/22/26 review response, GPT C08-D4) — never a hardcoded 2000.
    const groupApAccount = vlines.find((l) => l.apAccount)?.apAccount ?? '2000 Accounts Payable';

    const amount = round2(cashSlices.reduce((s, c) => s + c.cash, 0));
    const paymentId = `pmt-run-${stampBase}-${idx + 1}`;
    if (pass.full) groupPayments[key] = paymentId;
    else partialPayments[key] = paymentId;
    cashSlices.forEach((c) => lineRecorded.push({ invoiceId: c.line.invoiceId, amount: round2(c.cash + c.credit) }));
    if (pass.credit > 0.004) creditPostedGroups.push(key);

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
      // In the group's currency (Currency & Exchange Rates), with that
      // currency's rate on the payment date; a base-currency account still
      // pays in it, so there is no separate settled currency.
      currency,
      ...stampPaymentRate(currency, run.paymentDate),
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
      glEntries: paymentGlInBase(buildPaymentGlEntries({
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
      }), currency, paymentRateOn(currency, run.paymentDate)),
      // Check trail (Eli 9/25): a reference issued by the print flow's
      // blocking confirm records as PRINTED; a hand-typed number means
      // the check exists outside the flow — a MANUAL check.
      ...(group.methodType === 'Check' && group.reference?.trim()
        ? { checkPrint: { status: (group.printedViaFlow ? 'printed' : 'manual') as 'printed' | 'manual', by: 'Ahtisham Ahmad', at: today } }
        : {}),
    });
  });

  return { records, settleNow, creditDraws, groupPayments, partialPayments, lineRecorded, creditPostedGroups };
}

/** A payment's journal in the base currency, the ledger's (Currency &
 *  Exchange Rates): debit and credit post at the payment's rate, each line
 *  keeping its payment-currency amount and the rate, the snapshot the
 *  invoice journal keeps (glFx). Cent rounding lands on the largest debit
 *  so the entry still balances. */
function paymentGlInBase(lines: GlEntryLine[], currency: string, rate: number): GlEntryLine[] {
  if (isBaseCurrency(currency)) return lines;
  const total = (side: 'debit' | 'credit', rows: GlEntryLine[]) => round2(rows.reduce((s, l) => s + (l[side] ?? 0), 0));
  const balanced = Math.abs(total('debit', lines) - total('credit', lines)) < 0.005;
  const out: GlEntryLine[] = lines.map((l) => ({
    ...l,
    ...(l.debit != null ? { debit: toBase(l.debit, rate) } : {}),
    ...(l.credit != null ? { credit: toBase(l.credit, rate) } : {}),
    currency,
    foreignAmount: l.debit ?? l.credit ?? 0,
    rate,
  }));
  const diff = round2(total('credit', out) - total('debit', out));
  if (balanced && Math.abs(diff) >= 0.005) {
    const largest = out.reduce((best, l, i) => ((l.debit ?? 0) > (out[best].debit ?? 0) ? i : best), 0);
    if (out[largest].debit != null) out[largest] = { ...out[largest], debit: round2((out[largest].debit ?? 0) + diff) };
  }
  return out;
}
