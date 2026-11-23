import { formatMoney as moneyIn, formatRateDate, rateSentence } from '@/app/currency/money';
import { BASE_CURRENCY, isBaseCurrency } from '@/app/currency/currencies';
import { RATE_TYPE_LABEL, type MoneyFx } from '@/app/currency/rates';
import { ProviderLink, linkProvider } from '@/app/components/currency/ProviderLink';
import { BaseMoney } from '@/app/components/currency/Money';
import { returnReceipts } from '@/app/currency/returnCurrency';
import { returnSettlementFx, settlementMoneyFx } from '@/app/currency/returnSettlement';
import { fxVarianceColor, signedBase } from '@/app/components/currency/ReturnCurrencyConfig';
import { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  CheckCircle2,
  AlertTriangle,
  CircleDashed,
  BookOpen,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Info,
  Scale,
  Undo2,
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';
import { Invoice } from '@/app/data/mockInvoices';
import type { RMA } from '@/app/data/mockRMAs';
import {
  buildRMAGLEntries,
  returnsPendingBalance,
  rmaSettlementSummary,
  GL_ACCOUNTS,
  type GLEntry,
} from '@/app/data/rmaGLEntries';
import { PaymentRecord } from './ReversePaymentModal';

// Plain-language direction of a journal line: does this account go up or
// down? Normal balances by code prefix — 1xxx = asset, 2xxx = liability,
// 5xxx/6xxx = expense. Assets and expenses rise on a debit, liabilities
// rise on a credit.
function accountDirection(line: JournalLine): { up: boolean; effect: string; explain: string } {
  const isAsset = line.accountCode.startsWith('1');
  const isExpense = line.accountCode.startsWith('5') || line.accountCode.startsWith('6');
  const isDebit = (line.debit || 0) > 0;
  const up = isAsset || isExpense ? isDebit : !isDebit;
  const kind = isAsset ? 'asset' : isExpense ? 'expense' : 'liability';
  const side = isDebit ? 'Debit' : 'Credit';
  return {
    up,
    effect: up ? 'Increases' : 'Decreases',
    explain: `${side} ${up ? 'increases' : 'decreases'} this ${kind} account, ${line.accountCode} ${line.accountName}.`,
  };
}

// GL Impact — per invoice-screens-spec.md §2.
//
// Shows the accounting entries the invoice creates in the general
// ledger, so a reviewer can confirm it posts correctly and in balance
// before approving. Four parts:
//   2.1 Journal entries (Account | Description | Debit | Credit)
//   2.2 Totals + balance check in the table foot (Dr = Cr)
//   2.3 Posting status — exactly one of Not posted / Posted / Exception
//   2.4 GL distribution — paired debit/credit bars segmented by account

interface JournalLine {
  id: string;
  accountCode: string;
  accountName: string;
  description: string;
  debit?: number;
  credit?: number;
}

type PostingStatus = 'not_posted' | 'posted' | 'exception' | 'deferred' | 'reversed';

/** In the return's (the PO's) currency, with its symbol: £30.23 (app/currency/money.ts). */
function formatMoney(amount: number, currency: string) {
  return moneyIn(amount, currency);
}

/* GL Impact is in PKR, the base currency (Currency Touchpoints Map,
   2026-11-24). A return in another currency books every step at the
   receiving rate, the rate its receipt was booked at, with the return's own
   amount on hover; what the vendor settles is worth today's rate (the
   settlement day's once settled), and the gap is its own FX variance step,
   in PKR only. It replaces Mahreen's two-currency ledger of 2026-11-20 (the
   PO's currency with PKR under each amount). */

/** A ledger amount in PKR: the return's own amount and the receiving rate on
 *  hover where it has one; the FX variance and the totals are plain PKR. */
function GLMoney({ base, doc, currency, fx }: { base: number; doc?: number | undefined; currency: string; fx: MoneyFx | null }) {
  if (doc === undefined || !fx || isBaseCurrency(currency)) return <>{formatMoney(base, BASE_CURRENCY)}</>;
  return <BaseMoney value={doc} currency={currency} fx={fx} baseValue={base} role="Return currency" />;
}

// One color per account, shared between the journal table legend and the
// distribution bars so the two read as the same data.
const ACCOUNT_COLORS: Record<string, string> = {
  '1000': '#10B981', // Cash / Bank — emerald
  '1200': '#3B82F6', // Inventory, On Hand — blue
  '1205': '#8B5CF6', // Vendor Prepayments — violet
  '1250': '#0EA5E9', // Inventory Held at Vendor — sky
  '1255': '#0EA5E9', // Other Receivables – Vendor Returns — sky
  '1320': '#A855F7', // Other Receivables, Vendor Credits — purple
  '2000': '#6366F1', // Accounts Payable, Trade — indigo
  '2150': '#F59E0B', // AP Accrual — amber
  '6000': '#F43F5E', // Operating Expenses — rose
  '6810': '#E11D48', // RMA Settlement Loss — rose, darker
  '6820': '#9F1239', // RMA Write-Off Loss — rose, darkest
  '4910': '#059669', // FX Gain — emerald, darker
  '6910': '#DC2626', // FX Loss — red
};

export function GLImpactTab({
  invoice,
  numbers,
  rma,
}: {
  invoice: Invoice;
  numbers: { total: number; subtotal: number; tax: number; freight: number; additional: number; paid: number };
  payments: PaymentRecord[];
  rma?: RMA;
}) {
  // ── 2.1 Journal entries — the entry THIS INVOICE creates. One row per
  // account; the unused side of each row stays blank (faint dash).
  // Per the lifecycle specs (7/15/26):
  //   Inventory invoices AND pre-invoices: Inventory debit + Accounts
  //   Payable credit (a pre-invoice carries the same entry, it just posts
  //   at receiving instead of approval).
  //   Standalone: Expense debit + Accounts Payable credit.
  //   Cancelled (posted types): the original entry PLUS its reversal
  //   (Dr AP / Cr Inventory-or-Expense), so the tab shows exactly what
  //   the cancellation booked. Cancelled pre-invoices never posted, so
  //   they keep just the defined entry.
  const isCancelledReversal = invoice.status === 'Cancelled' && invoice.type !== 'Pre-Invoice';
  const lines = useMemo<JournalLine[]>(() => {
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const rows: JournalLine[] = [];
    const debitAccount = invoice.type === 'Standalone'
      ? { code: '6000', name: 'Operating Expenses' }
      : { code: '1200', name: 'Inventory Asset' };
    rows.push({
      id: 'je-1',
      accountCode: debitAccount.code,
      accountName: debitAccount.name,
      description: isCancelledReversal ? 'Original posting' : '',
      debit: round2(numbers.total),
    });
    rows.push({
      id: 'je-ap',
      accountCode: '2000',
      accountName: 'Accounts Payable',
      description: isCancelledReversal ? 'Original posting' : '',
      credit: round2(numbers.total),
    });
    if (isCancelledReversal) {
      rows.push({
        id: 'je-rev-ap',
        accountCode: '2000',
        accountName: 'Accounts Payable',
        description: 'Cancellation reversal',
        debit: round2(numbers.total),
      });
      rows.push({
        id: 'je-rev-1',
        accountCode: debitAccount.code,
        accountName: debitAccount.name,
        description: 'Cancellation reversal',
        credit: round2(numbers.total),
      });
    }
    return rows.filter((l) => (l.debit ?? l.credit ?? 0) > 0.004);
  }, [invoice.type, numbers, isCancelledReversal]);

  // Inventory invoices carry no per-line descriptions, so the whole
  // Description column drops out of the table for them.
  const showDescriptions = lines.some((l) => l.description);

  // ── 2.2 Totals + balance check ──
  const totalDebits = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredits = lines.reduce((s, l) => s + (l.credit || 0), 0);
  // Double-entry by construction: the debit lines decompose the exact
  // total the A/P credit carries, so the entry is ALWAYS balanced
  // (design feedback 7/9 — GL impact can never read unbalanced).

  // ── 2.3 Posting status — exactly one of three. Mapping per spec:
  //   Pending approval → Not posted (preview, neutral)
  //   Approved and later → Posted (journal reference + posting date)
  //   Failed check (Exception status / unbalanced) → Exception (overrides)
  const postingStatus: PostingStatus = useMemo(() => {
    // Cancelled posted invoices show the reversal; cancelled pre-invoices
    // never posted, so they fall through to not_posted.
    if (invoice.status === 'Cancelled') {
      return invoice.type === 'Pre-Invoice' ? 'not_posted' : 'reversed';
    }
    if (invoice.status === 'Exception' || invoice.is_exception) return 'exception';
    // A pre-invoice's entry is DEFINED but posts only at receiving
    // (lifecycle spec 7/15/26) — it is never "posted" while still a
    // pre-invoice, whatever its approval/prepayment state.
    if (invoice.type === 'Pre-Invoice') return 'deferred';
    const postedStates = ['Approved', 'Partially Paid', 'Paid in Full', 'Settled', 'Payment Hold'];
    if (postedStates.includes(invoice.status)) return 'posted';
    return 'not_posted';
  }, [invoice.status, invoice.type, invoice.is_exception]);

  // A return books a sequence of entries rather than one, so it renders its
  // own view. The invoice path below is untouched.
  if (rma) return <RMAGLImpact rma={rma} currency={invoice.currency} />;

  return (
    <div className="space-y-3.5">
      {/* ── Posting status — slim gradient banner with status pill ── */}
      {postingStatus === 'not_posted' && (
        <div
          className="rounded-xl border border-slate-200/80 px-4 py-3 flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 60%)' }}
        >
          <span className="w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.05)] flex items-center justify-center shrink-0">
            <CircleDashed className="w-4 h-4 text-slate-400" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[13px] text-slate-800 tracking-tight" style={{ fontWeight: 600 }}>
                Not posted
              </p>
              <span
                className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200/80"
                style={{ fontWeight: 700 }}
              >
                Preview
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {invoice.status === 'Cancelled'
                ? 'Cancelled before posting, nothing hit the GL.'
                : 'Invoice is pending approval, nothing has hit the GL yet.'}
            </p>
          </div>
        </div>
      )}
      {postingStatus === 'deferred' && (
        <div
          className="rounded-xl border px-4 py-3 flex items-center gap-3"
          style={{ borderColor: '#DDD6FE', background: 'linear-gradient(135deg, #F5F3FF 0%, #FFFFFF 70%)' }}
        >
          <span className="w-9 h-9 rounded-xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] flex items-center justify-center shrink-0 border" style={{ borderColor: '#DDD6FE' }}>
            <CircleDashed className="w-4 h-4" style={{ color: '#7C3AED' }} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[13px] tracking-tight" style={{ fontWeight: 600, color: '#6D28D9' }}>
                Defined, posts at receiving
              </p>
              <span
                className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] uppercase tracking-wider border"
                style={{ fontWeight: 700, backgroundColor: '#F5F3FF', color: '#6D28D9', borderColor: '#DDD6FE' }}
              >
                Pre-invoice
              </span>
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: '#7C3AED' }}>
              This entry exists on the pre-invoice but takes effect only when goods are received. Prepayments post separately when made.
            </p>
          </div>
        </div>
      )}
      {postingStatus === 'reversed' && (
        <div
          className="rounded-xl border px-4 py-3 flex items-center gap-3"
          style={{ borderColor: '#FECACA', background: 'linear-gradient(135deg, #FEF2F2 0%, #FFFFFF 70%)' }}
        >
          <span className="w-9 h-9 rounded-xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] flex items-center justify-center shrink-0 border" style={{ borderColor: '#FECACA' }}>
            <Undo2 className="w-4 h-4" style={{ color: '#B91C1C' }} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] tracking-tight" style={{ fontWeight: 600, color: '#B91C1C' }}>
              Cancelled, posted entry reversed
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: '#DC2626' }}>
              The original posting was undone with the reversal entry below. Net effect on the books is zero.
            </p>
          </div>
        </div>
      )}
      {postingStatus === 'posted' && (
        /* Title only (feedback 7/20/26): the JE ref, date, and subtitle
           were noise here, the ledger detail lives in the entries below. */
        <div
          className="rounded-xl border px-4 py-3 flex items-center gap-3"
          style={{ borderColor: '#A7F3D0', background: 'linear-gradient(135deg, #ECFDF5 0%, #FFFFFF 70%)' }}
        >
          <span className="w-9 h-9 rounded-xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] flex items-center justify-center shrink-0 border" style={{ borderColor: '#A7F3D0' }}>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </span>
          <p className="min-w-0 flex-1 text-[13px] tracking-tight" style={{ fontWeight: 600, color: '#047857' }}>
            Posted to the general ledger
          </p>
        </div>
      )}
      {postingStatus === 'exception' && (
        <div
          className="rounded-xl border px-4 py-3 flex items-center gap-3"
          style={{ borderColor: '#FDE68A', background: 'linear-gradient(135deg, #FFFBEB 0%, #FFFFFF 70%)' }}
        >
          <span className="w-9 h-9 rounded-xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] flex items-center justify-center shrink-0 border" style={{ borderColor: '#FDE68A' }}>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] tracking-tight" style={{ fontWeight: 600, color: '#92400E' }}>
              Exception, posting blocked
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: '#B45309' }}>
              A validation failed on this invoice, it stays out of the GL until the exception is resolved.
            </p>
          </div>
        </div>
      )}

      {/* ── Journal entries — icon-tile header, chip account codes,
          totals foot with the Dr = Cr check ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#EEF2FF' }}>
            <BookOpen className="w-3.5 h-3.5" style={{ color: '#4338CA' }} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[13px] text-foreground tracking-tight" style={{ fontWeight: 600 }}>GL Impact</h2>
            <p className="text-[11px] text-slate-400">
              How this invoice posts to the general ledger, account by account.
            </p>
          </div>
          <span
            className="text-[10px] tabular-nums rounded-full px-2 py-0.5 bg-muted text-muted-foreground shrink-0"
            style={{ fontWeight: 600 }}
          >
            {lines.length} lines
          </span>
        </div>
        {/* Plain-language explainer — makes the entry readable without
            recalling debit-vs-credit rules. */}
        <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/40 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-px" />
          <p className="text-[11px] text-slate-500 leading-snug">
            This shows how the invoice affects your accounts when approved. Debits increase what you own (like inventory); credits increase what you owe (like accounts payable). The two sides always balance to zero.
          </p>
        </div>
        <table className="w-full text-[12px]">
          <thead className="bg-slate-50/60 border-b border-slate-100">
            <tr>
              <th className="text-left pl-5 pr-4 py-2 text-[10px] uppercase tracking-[0.08em] text-slate-400" style={{ fontWeight: 700 }}>Account</th>
              {showDescriptions && (
                <th className="text-left px-4 py-2 text-[10px] uppercase tracking-[0.08em] text-slate-400" style={{ fontWeight: 700 }}>Description</th>
              )}
              <th className="text-right px-4 py-2 text-[10px] uppercase tracking-[0.08em] text-slate-400" style={{ fontWeight: 700 }}>Debit</th>
              <th className="text-right px-4 py-2 pr-5 text-[10px] uppercase tracking-[0.08em] text-slate-400" style={{ fontWeight: 700 }}>Credit</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr
                key={line.id}
                className={`${idx === lines.length - 1 ? '' : 'border-b border-slate-100'} hover:bg-[#F8FAFF] transition-colors`}
              >
                <td className="pl-5 pr-4 py-2.5 whitespace-nowrap">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-[3px] shrink-0"
                      style={{ backgroundColor: ACCOUNT_COLORS[line.accountCode] ?? '#94A3B8' }}
                    />
                    <span
                      className="inline-flex items-center px-1.5 py-px rounded-md font-mono text-[10px] tabular-nums bg-slate-100/80 text-slate-500 border border-slate-200/60"
                      style={{ fontWeight: 600 }}
                    >
                      {line.accountCode}
                    </span>
                    <span className="text-foreground" style={{ fontWeight: 500 }}>
                      {line.accountName}
                    </span>
                    {/* Direction indicator — arrow only (7/24/26, system-wide):
                        green up / red down; the Increases / Decreases word and
                        the debit/credit rule live in the tooltip. */}
                    {(() => {
                      const d = accountDirection(line);
                      const Arrow = d.up ? ArrowUp : ArrowDown;
                      return (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full border cursor-help"
                              aria-label={d.effect}
                              style={
                                d.up
                                  ? { color: '#047857', backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }
                                  : { color: '#E11D48', backgroundColor: '#FFF1F2', borderColor: '#FECDD3' }
                              }
                            >
                              <Arrow className="w-3 h-3" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[240px]">
                            <p className="text-[11px] leading-snug" style={{ fontWeight: 600, color: d.up ? '#047857' : '#E11D48' }}>{d.effect}</p>
                            <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{d.explain}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })()}
                  </span>
                </td>
                {showDescriptions && <td className="px-4 py-2.5 text-slate-500">{line.description}</td>}
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {line.debit ? (
                    <span className="text-foreground" style={{ fontWeight: 600 }}>{formatMoney(line.debit, invoice.currency)}</span>
                  ) : (
                    <span className="text-slate-200">, </span>
                  )}
                </td>
                <td className="px-4 py-2.5 pr-5 text-right tabular-nums">
                  {line.credit ? (
                    <span className="text-foreground" style={{ fontWeight: 600 }}>{formatMoney(line.credit, invoice.currency)}</span>
                  ) : (
                    <span className="text-slate-200">, </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {/* Totals row + inline balance check (Dr = Cr) */}
          <tfoot>
            <tr className="border-t border-slate-200/80" style={{ backgroundColor: '#F7FDF9' }}>
              <td className="pl-5 pr-4 py-2.5 text-[10px] uppercase tracking-[0.08em] text-slate-400" style={{ fontWeight: 700 }}>
                <span className="inline-flex items-center gap-2.5">
                  Totals
                  {!showDescriptions && (
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-px rounded-full text-[10px] normal-case tracking-normal border"
                      style={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Balanced · Debit = Credit
                    </span>
                  )}
                </span>
              </td>
              {showDescriptions && (
                <td className="px-4 py-2.5">
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-px rounded-full text-[10px] border"
                    style={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Balanced · Debit = Credit
                  </span>
                </td>
              )}
              <td className="px-4 py-2.5 text-right tabular-nums text-foreground text-[13px]" style={{ fontWeight: 700 }}>
                {formatMoney(totalDebits, invoice.currency)}
              </td>
              <td className="px-4 py-2.5 pr-5 text-right tabular-nums text-foreground text-[13px]" style={{ fontWeight: 700 }}>
                {formatMoney(totalCredits, invoice.currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function formatPostedDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * A return does not book one entry, it books a sequence: the goods leave stock
 * at shipment, and a later event drains the clearing account. Which later
 * event depends on the return type and on how far the receipt was billed, so
 * the tab reads as ordered steps rather than a single journal. Steps that have
 * not happened yet show as projected, which is what finance verifies against.
 */
function RMAGLImpact({ rma, currency }: { rma: RMA; currency: string }) {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  // The receiving rate and the settle rate (today's of the configured type,
  // or the settlement day's), and every amount the ledger posts, in PKR.
  const settle = useMemo(() => returnSettlementFx(rma), [rma]);
  const entries = useMemo<GLEntry[]>(() => buildRMAGLEntries(rma, settle), [rma, settle]);
  const clearing = returnsPendingBalance(entries);
  // A return in another currency: its amount and the receiving rate on hover.
  const fx = settle.receiving;
  const receipts = useMemo(() => (fx ? returnReceipts(rma) : []), [fx, rma]);
  const settleFx = settle.foreign ? settlementMoneyFx(settle) : null;

  if (entries.length === 0) {
    return (
      <div
        className="rounded-xl border border-slate-200/80 px-4 py-3 flex items-center gap-3"
        style={{ background: 'linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 60%)' }}
      >
        <span className="w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.05)] flex items-center justify-center shrink-0">
          <CircleDashed className="w-4 h-4 text-slate-400" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-slate-800 tracking-tight" style={{ fontWeight: 600 }}>
            Nothing to post
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            No authorized quantity carries value on this return, so it books no journal entries.
          </p>
        </div>
      </div>
    );
  }

  // Posted, projected, or both. A reviewer checking what has hit the ledger
  // should not have to read past six steps that have not happened yet, and
  // somebody verifying the plan should not have to read past the ones that
  // have.
  const [filter, setFilter] = useState<'all' | 'posted' | 'projected'>('all');
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  const shown = useMemo(
    () =>
      entries.filter((e) =>
        filter === 'all' ? true : filter === 'posted' ? e.posted : !e.posted,
      ),
    [entries, filter],
  );

  /** Where the money actually lands, once the steps are added up.
   *
   *  The sequence says what each event books; nobody was saying what the
   *  return does to the ledger as a whole, so a reviewer had to add six
   *  tables up by hand to find out. Posted and projected are kept apart:
   *  netting them would state a balance the ledger does not hold yet. */
  const rollup = useMemo(() => {
    const byAccount = new Map<
      string,
      { code: string; name: string; debit: number; credit: number; projected: boolean }
    >();
    entries.forEach((entry) => {
      if (filter === 'posted' && !entry.posted) return;
      if (filter === 'projected' && entry.posted) return;
      // Every step is in PKR now, the FX variance with them (2026-11-24).
      entry.postings.forEach((posting) => {
        const at = byAccount.get(posting.account.code) ?? {
          code: posting.account.code,
          name: posting.account.name,
          debit: 0,
          credit: 0,
          projected: false,
        };
        at.debit = round2(at.debit + (posting.debit ?? 0));
        at.credit = round2(at.credit + (posting.credit ?? 0));
        at.projected = at.projected || !entry.posted;
        byAccount.set(posting.account.code, at);
      });
    });
    const rows = [...byAccount.values()].sort(
      (a, b) => Math.abs(b.debit - b.credit) - Math.abs(a.debit - a.credit),
    );
    const debits = round2(rows.reduce((n, r) => n + r.debit, 0));
    const credits = round2(rows.reduce((n, r) => n + r.credit, 0));
    return { rows, debits, credits, balanced: Math.abs(debits - credits) <= 0.004 };
  }, [entries, filter]);

  const postedCount = entries.filter((e) => e.posted).length;
  const allPosted = postedCount === entries.length;
  const resolved = allPosted && Math.abs(clearing) <= 0.004;
  // Two of the endings cost money, and both of them net the holding account
  // to zero the same way a clean settlement does. Read on the balance alone
  // the tab called all three "fully settled", which is the one thing the
  // ledger must never say about a loss.
  const settlement = rmaSettlementSummary(rma);

  return (
    <div className="space-y-3.5">
      {/* Where the return stands in its posting sequence. */}
      {postedCount === 0 ? (
        <div
          className="rounded-xl border border-slate-200/80 px-4 py-3 flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 60%)' }}
        >
          <span className="w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.05)] flex items-center justify-center shrink-0">
            <CircleDashed className="w-4 h-4 text-slate-400" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[13px] text-slate-800 tracking-tight" style={{ fontWeight: 600 }}>
                Not posted
              </p>
              <span
                className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200/80"
                style={{ fontWeight: 700 }}
              >
                Projected
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Nothing has hit the GL yet. The first entry posts when the goods physically leave on the return shipment.
            </p>
          </div>
        </div>
      ) : settlement.kind === 'refused' ? (
        <div
          className="rounded-xl border px-4 py-3 flex items-center gap-3"
          style={{ borderColor: '#FECDD3', background: 'linear-gradient(135deg, #FFF1F2 0%, #FFFFFF 70%)' }}
        >
          <span className="w-9 h-9 rounded-xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] flex items-center justify-center shrink-0 border" style={{ borderColor: '#FECDD3' }}>
            <AlertTriangle className="w-4 h-4" style={{ color: '#E11D48' }} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] tracking-tight" style={{ fontWeight: 600, color: '#9F1239' }}>
              Written off
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: '#BE123C' }}>
              The vendor refused the return, so {formatMoney(settle.base.writtenOff, BASE_CURRENCY)} left
              the books as a write-off loss, at the receiving rate.
            </p>
          </div>
        </div>
      ) : resolved && settlement.kind === 'written-off' ? (
        <div
          className="rounded-xl border px-4 py-3 flex items-center gap-3"
          style={{ borderColor: '#FECDD3', background: 'linear-gradient(135deg, #FFF1F2 0%, #FFFFFF 70%)' }}
        >
          <span className="w-9 h-9 rounded-xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] flex items-center justify-center shrink-0 border" style={{ borderColor: '#FECDD3' }}>
            <AlertTriangle className="w-4 h-4" style={{ color: '#E11D48' }} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] tracking-tight" style={{ fontWeight: 600, color: '#9F1239' }}>
              Closed with nothing back
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: '#BE123C' }}>
              {formatMoney(settle.base.writtenOff, BASE_CURRENCY)} of these goods was already billed and
              claims no credit, so it posted to {GL_ACCOUNTS.writeOffLoss.name}.
            </p>
          </div>
        </div>
      ) : resolved && settlement.kind === 'short' ? (
        <div
          className="rounded-xl border px-4 py-3 flex items-center gap-3"
          style={{ borderColor: '#FDE68A', background: 'linear-gradient(135deg, #FFFBEB 0%, #FFFFFF 70%)' }}
        >
          <span className="w-9 h-9 rounded-xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] flex items-center justify-center shrink-0 border" style={{ borderColor: '#FDE68A' }}>
            <AlertTriangle className="w-4 h-4" style={{ color: '#B45309' }} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] tracking-tight" style={{ fontWeight: 600, color: '#92400E' }}>
              Settled short
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: '#B45309' }}>
              {formatMoney(settlement.received ?? 0, currency)} of{' '}
              {formatMoney(settlement.expected, currency)} came back. The{' '}
              {formatMoney(settlement.loss, currency)} gap posted to{' '}
              {GL_ACCOUNTS.settlementLoss.name}
              {settle.foreign ? ` as ${formatMoney(settle.base.loss, BASE_CURRENCY)} at the receiving rate` : ''}, and the price on the
              return is untouched.
            </p>
          </div>
        </div>
      ) : resolved ? (
        <div
          className="rounded-xl border px-4 py-3 flex items-center gap-3"
          style={{ borderColor: '#A7F3D0', background: 'linear-gradient(135deg, #ECFDF5 0%, #FFFFFF 70%)' }}
        >
          <span className="w-9 h-9 rounded-xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] flex items-center justify-center shrink-0 border" style={{ borderColor: '#A7F3D0' }}>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] tracking-tight" style={{ fontWeight: 600, color: '#047857' }}>
              Fully settled and posted
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: '#059669' }}>
              Every step in the sequence posted and the clearing account nets to zero.
            </p>
          </div>
        </div>
      ) : (
        <div
          className="rounded-xl border px-4 py-3 flex items-center gap-3"
          style={{ borderColor: '#BAE6FD', background: 'linear-gradient(135deg, #F0F9FF 0%, #FFFFFF 70%)' }}
        >
          <span className="w-9 h-9 rounded-xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] flex items-center justify-center shrink-0 border" style={{ borderColor: '#BAE6FD' }}>
            <CircleDashed className="w-4 h-4" style={{ color: '#0284C7' }} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[13px] tracking-tight" style={{ fontWeight: 600, color: '#075985' }}>
                Awaiting vendor settlement
              </p>
              <span
                className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] uppercase tracking-wider border"
                style={{ fontWeight: 700, backgroundColor: '#F0F9FF', color: '#0369A1', borderColor: '#BAE6FD' }}
              >
                {postedCount} of {entries.length} posted
              </span>
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: '#0284C7' }}>
              The value sits in 1255 Other Receivables – Vendor Returns until the remaining steps post.
            </p>
          </div>
        </div>
      )}

      {/* The sequence itself, one card per entry. */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#EEF2FF' }}>
            <BookOpen className="w-3.5 h-3.5" style={{ color: '#4338CA' }} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[13px] text-foreground tracking-tight" style={{ fontWeight: 600 }}>GL Impact</h2>
            <p className="text-[11px] text-slate-400">
              How this return posts to the general ledger, step by step.
            </p>
          </div>
          <span
            className="text-[10px] tabular-nums rounded-full px-2 py-0.5 bg-muted text-muted-foreground shrink-0"
            style={{ fontWeight: 600 }}
          >
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {/* Which half of the sequence is being read, and how much of it is
            open. Six steps of tables is a page to scroll rather than a thing
            to check. */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            {([
              { key: 'all' as const, label: 'All steps', count: entries.length },
              { key: 'posted' as const, label: 'Posted', count: postedCount },
              {
                key: 'projected' as const,
                label: 'Projected',
                count: entries.length - postedCount,
              },
            ]).map((pill) => {
              const on = filter === pill.key;
              return (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => setFilter(pill.key)}
                  aria-pressed={on}
                  disabled={pill.count === 0}
                  className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    on
                      ? 'border-primary bg-accent text-primary'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                  style={{ fontWeight: 600 }}
                >
                  {pill.label}
                  <span className={on ? 'text-primary/70' : 'text-slate-400'}>{pill.count}</span>
                </button>
              );
            })}
          </div>
          {shown.length > 1 && (
            <button
              type="button"
              onClick={() => {
                const anyOpen = shown.some((e) => !closed[e.id]);
                const next: Record<string, boolean> = { ...closed };
                shown.forEach((e) => {
                  next[e.id] = anyOpen;
                });
                setClosed(next);
              }}
              className="text-[11px] text-primary transition-colors hover:text-blue-700"
              style={{ fontWeight: 600 }}
            >
              {shown.some((e) => !closed[e.id]) ? 'Collapse all' : 'Expand all'}
            </button>
          )}
        </div>
        <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/40 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-px" />
          <p className="text-[11px] text-slate-500 leading-snug">
            Every return starts the same way: the goods move out of on-hand stock into a clearing account when the shipment leaves. What clears that account depends on what the vendor owes back, so the later steps stay projected until the event actually happens. Postings are automatic, finance verifies them rather than keying them.
          </p>
        </div>
        {fx && (
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-start gap-2" style={{ backgroundColor: '#F5F3FF66' }}>
            <ArrowLeftRight className="w-3.5 h-3.5 shrink-0 mt-px" style={{ color: '#7C3AED' }} />
            <div className="text-[11px] text-slate-600 leading-snug">
              <p>
                In <span style={{ fontWeight: 600 }}>{BASE_CURRENCY}</span>, the base currency, with the {currency} amount on hover. The
                goods ship back and reverse at the receiving rate, the rate their receipt was booked at. What the vendor settles is worth
                the settlement rate, and the gap is the FX variance.
              </p>
              {receipts.map((r) => (
                <p key={r.grnNumber} className="tabular-nums mt-0.5 text-slate-500">
                  <span style={{ fontWeight: 600 }} className="text-slate-700">{r.grnNumber}</span> received {formatRateDate(r.date)} ·{' '}
                  <span style={{ fontWeight: 600 }} className="text-slate-700">{rateSentence(currency, r.rate)}</span> · Mid-market, <ProviderLink />
                </p>
              ))}
              {receipts.length > 1 && fx.breakdown && (
                <p className="mt-0.5 text-slate-500">Each receipt's share converts at its own rate, {rateSentence(currency, fx.rate)} across them.</p>
              )}
              <p className="tabular-nums mt-0.5 text-slate-500">
                <span style={{ fontWeight: 600 }} className="text-slate-700">{settle.locked ? 'Vendor settled' : 'Vendor settles'}</span>{' '}
                {settle.locked ? formatRateDate(settle.rateDate) : 'today'} ·{' '}
                <span style={{ fontWeight: 600 }} className="text-slate-700">{rateSentence(currency, settle.settleRate)}</span> ·{' '}
                {RATE_TYPE_LABEL[settle.rateType]}, {settle.rateType === 'mid' ? <ProviderLink /> : linkProvider(settle.rateSource.replace(/^Set by/, 'set by'))}
                {settle.locked ? '' : ', until the vendor settles'}
              </p>
            </div>
          </div>
        )}

        {/* What the goods were worth against what came back for them. The
            journal says it in postings; this says it in one line, because
            the gap is the thing a reviewer is looking for and it should not
            have to be read off three tables. In PKR (2026-11-24), with the
            FX variance beside the loss. */}
        {(settlement.received !== null || settlement.writtenOff > 0.004) && (
          <div className={`px-4 py-3 border-b border-slate-100 grid gap-3 ${settle.foreign ? 'grid-cols-4' : 'grid-cols-3'}`}>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.08em] text-slate-400" style={{ fontWeight: 700 }}>
                Return value
              </p>
              <p className="text-[13px] tabular-nums text-foreground mt-0.5" style={{ fontWeight: 700 }}>
                <GLMoney base={settle.base.value} doc={settle.parts.value} currency={currency} fx={fx} />
              </p>
              <p className="text-[10px] text-slate-400 mt-px">{settle.foreign ? 'At the receiving rate' : 'At the original PO price'}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.08em] text-slate-400" style={{ fontWeight: 700 }}>
                Vendor settled
              </p>
              <p
                className="text-[13px] tabular-nums mt-0.5"
                style={{ fontWeight: 700, color: settlement.received === null ? '#94A3B8' : undefined }}
              >
                {settlement.received === null
                  ? 'Not recorded'
                  : <GLMoney base={settle.foreign ? settle.settlesNow : settle.parts.settles} doc={settle.parts.settles} currency={currency} fx={settleFx} />}
              </p>
              <p className="text-[10px] text-slate-400 mt-px">
                {settlement.kind === 'refused'
                  ? 'The vendor refused the return'
                  : settlement.received === null
                    ? 'No amount captured against the credit'
                    : settle.foreign
                      ? 'Credit note and refund, at the settlement rate'
                      : 'Recorded against the return'}
              </p>
            </div>
            {settle.foreign && (
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.08em] text-slate-400" style={{ fontWeight: 700 }}>
                  FX variance
                </p>
                <p className="text-[13px] tabular-nums mt-0.5" style={{ fontWeight: 700, color: fxVarianceColor(settle.fxVariance) }}>
                  {signedBase(settle.fxVariance)}
                </p>
                <p className="text-[10px] text-slate-400 mt-px">
                  {Math.abs(settle.fxVariance) < 0.005 ? 'The rates agree' : settle.fxVariance > 0 ? GL_ACCOUNTS.fxGain.name : GL_ACCOUNTS.fxLoss.name}
                </p>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.08em] text-slate-400" style={{ fontWeight: 700 }}>
                Loss recognised
              </p>
              <p
                className="text-[13px] tabular-nums mt-0.5"
                style={{
                  fontWeight: 700,
                  color:
                    settlement.loss + settlement.writtenOff > 0.004 ? '#BE123C' : '#047857',
                }}
              >
                <GLMoney
                  base={round2(settle.base.loss + settle.base.writtenOff)}
                  doc={round2(settle.parts.loss + settle.parts.writtenOff)}
                  currency={currency}
                  fx={fx}
                />
              </p>
              <p className="text-[10px] text-slate-400 mt-px">
                {settlement.loss > 0.004 && settlement.writtenOff > 0.004
                  ? 'Settlement loss and write-off'
                  : settlement.writtenOff > 0.004
                    ? GL_ACCOUNTS.writeOffLoss.name
                    : settlement.loss > 0.004
                      ? GL_ACCOUNTS.settlementLoss.name
                      : 'Nothing written off'}
              </p>
            </div>
          </div>
        )}

        <div className="p-4 space-y-3">
          {shown.map((entry, idx) => {
          const open = closed[entry.id] !== true;
          const entryDebits = round2(entry.postings.reduce((n, p) => n + (p.debit ?? 0), 0));
          // In PKR; a posting with an amount in the return's currency shows it
          // on hover at the receiving rate. The FX variance has none.
          const pkr = (n: number) => formatMoney(round2(n), BASE_CURRENCY);
          const entryCredits = round2(entry.postings.reduce((n, p) => n + (p.credit ?? 0), 0));
          return (
            <div
              key={entry.id}
              className={`rounded-xl border overflow-hidden ${entry.posted ? 'border-slate-200 bg-white' : 'border-dashed border-slate-200 bg-slate-50/40'}`}
            >
              <button
                type="button"
                onClick={() => setClosed((prev) => ({ ...prev, [entry.id]: open }))}
                aria-expanded={open}
                className="w-full text-left px-3.5 py-2.5 flex items-start gap-2.5 transition-colors hover:bg-slate-50/60"
              >
                <span
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[11px] tabular-nums border"
                  style={
                    entry.posted
                      ? { fontWeight: 700, backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }
                      : { fontWeight: 700, backgroundColor: '#FFFFFF', color: '#94A3B8', borderColor: '#E2E8F0' }
                  }
                >
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[12px] text-foreground tracking-tight" style={{ fontWeight: 600 }}>
                      {entry.title}
                    </p>
                    {entry.posted ? (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[10px] border"
                        style={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Posted{entry.date ? ` ${formatPostedDate(entry.date)}` : ''}
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[10px] border bg-white text-slate-500 border-slate-200"
                        style={{ fontWeight: 600 }}
                      >
                        <CircleDashed className="w-3 h-3" />
                        Projected
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{entry.trigger}</p>
                </div>
                {/* What the step moves, on the row that closes it, so a
                    folded sequence still reads as a sequence of amounts. */}
                <span className="flex shrink-0 items-center gap-2 pt-0.5">
                  <span
                    className="text-[12px] tabular-nums text-foreground text-right"
                    style={{ fontWeight: 600 }}
                  >
                    {entry.id === 'fx-variance' ? (
                      // Signed, + gain / − loss, as the spec writes it.
                      <span style={{ color: fxVarianceColor(settle.fxVariance) }}>{signedBase(settle.fxVariance)}</span>
                    ) : (
                      pkr(entryDebits)
                    )}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`}
                  />
                </span>
              </button>

              {open && (
              <table className="w-full text-[12px] border-t border-slate-100">
                <thead className="bg-slate-50/60 border-b border-slate-100">
                  <tr>
                    <th className="text-left pl-3.5 pr-4 py-1.5 text-[10px] uppercase tracking-[0.08em] text-slate-400" style={{ fontWeight: 700 }}>Account</th>
                    <th className="text-right px-4 py-1.5 text-[10px] uppercase tracking-[0.08em] text-slate-400" style={{ fontWeight: 700 }}>Debit</th>
                    <th className="text-right px-4 py-1.5 pr-3.5 text-[10px] uppercase tracking-[0.08em] text-slate-400" style={{ fontWeight: 700 }}>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {entry.postings.map((posting, pIdx) => {
                    const d = accountDirection({
                      id: `${entry.id}-${pIdx}`,
                      accountCode: posting.account.code,
                      accountName: posting.account.name,
                      description: '',
                      ...(posting.debit !== undefined ? { debit: posting.debit } : {}),
                      ...(posting.credit !== undefined ? { credit: posting.credit } : {}),
                    });
                    const Arrow = d.up ? ArrowUp : ArrowDown;
                    return (
                      <tr
                        key={`${entry.id}-${posting.account.code}-${pIdx}`}
                        className={pIdx === entry.postings.length - 1 ? '' : 'border-b border-slate-100'}
                      >
                        <td className="pl-3.5 pr-4 py-2 whitespace-nowrap">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-[3px] shrink-0"
                              style={{ backgroundColor: ACCOUNT_COLORS[posting.account.code] ?? '#94A3B8' }}
                            />
                            <span
                              className="inline-flex items-center px-1.5 py-px rounded-md font-mono text-[10px] tabular-nums bg-slate-100/80 text-slate-500 border border-slate-200/60"
                              style={{ fontWeight: 600 }}
                            >
                              {posting.account.code}
                            </span>
                            <span className="text-foreground" style={{ fontWeight: 500 }}>
                              {posting.account.name}
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full border cursor-help"
                                  aria-label={d.effect}
                                  style={
                                    d.up
                                      ? { color: '#047857', backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }
                                      : { color: '#E11D48', backgroundColor: '#FFF1F2', borderColor: '#FECDD3' }
                                  }
                                >
                                  <Arrow className="w-3 h-3" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[240px]">
                                <p className="text-[11px] leading-snug" style={{ fontWeight: 600, color: d.up ? '#047857' : '#E11D48' }}>{d.effect}</p>
                                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{d.explain}</p>
                              </TooltipContent>
                            </Tooltip>
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {posting.debit ? (
                            <span className="text-foreground" style={{ fontWeight: 600 }}><GLMoney base={posting.debit} doc={entry.baseOnly ? undefined : posting.doc} currency={currency} fx={fx} /></span>
                          ) : (
                            <span className="text-slate-200">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2 pr-3.5 text-right tabular-nums">
                          {posting.credit ? (
                            <span className="text-foreground" style={{ fontWeight: 600 }}><GLMoney base={posting.credit} doc={entry.baseOnly ? undefined : posting.doc} currency={currency} fx={fx} /></span>
                          ) : (
                            <span className="text-slate-200">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Totals + balance check, the same foot the invoice journal
                    carries. Each step is a paired debit and credit by
                    construction, so it always reads balanced. */}
                <tfoot>
                  <tr className="border-t border-slate-100" style={{ backgroundColor: '#F7FDF9' }}>
                    <td className="pl-3.5 pr-4 py-2 text-[10px] uppercase tracking-[0.08em] text-slate-400" style={{ fontWeight: 700 }}>
                      <span className="inline-flex items-center gap-2">
                        Totals
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[10px] normal-case tracking-normal border"
                          style={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Balanced · Debit = Credit
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-foreground" style={{ fontWeight: 700 }}>
                      {pkr(entry.postings.reduce((s, p) => s + (p.debit ?? 0), 0))}
                    </td>
                    <td className="px-4 py-2 pr-3.5 text-right tabular-nums text-foreground" style={{ fontWeight: 700 }}>
                      {pkr(entry.postings.reduce((s, p) => s + (p.credit ?? 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
              )}
            </div>
          );
          })}

          {shown.length === 0 && (
            <p className="py-6 text-center text-[12px] text-slate-500">
              {filter === 'posted'
                ? 'Nothing has posted on this return yet.'
                : 'Every step on this return has posted.'}
            </p>
          )}

          {/* Where it all lands.
              
              The sequence says what each event books and nothing said what
              the return does to the ledger as a whole, so checking that took
              adding six tables up by hand. Posted and projected stay apart in
              the filter above: netting them would state a balance the ledger
              does not hold yet. */}
          {rollup.rows.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-3.5 py-2">
                <Scale className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                <span className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>
                  Where it lands
                </span>
                <span className="text-[11px] text-slate-500">
                  {filter === 'posted'
                    ? 'Across the steps that have posted'
                    : filter === 'projected'
                      ? 'Across the steps still to post'
                      : 'Across every step of this return'}
                </span>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pl-3.5 pr-4 py-1.5 text-left text-[10px] uppercase tracking-[0.08em] text-slate-400" style={{ fontWeight: 700 }}>
                      Account
                    </th>
                    <th className="px-4 py-1.5 text-right text-[10px] uppercase tracking-[0.08em] text-slate-400" style={{ fontWeight: 700 }}>
                      Debits
                    </th>
                    <th className="px-4 py-1.5 text-right text-[10px] uppercase tracking-[0.08em] text-slate-400" style={{ fontWeight: 700 }}>
                      Credits
                    </th>
                    <th className="px-4 py-1.5 pr-3.5 text-right text-[10px] uppercase tracking-[0.08em] text-slate-400" style={{ fontWeight: 700 }}>
                      Net effect
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rollup.rows.map((row, i) => {
                    const net = round2(row.debit - row.credit);
                    const isAsset = row.code.startsWith('1');
                    const isExpense = row.code.startsWith('5') || row.code.startsWith('6');
                    // Assets and expenses rise on a debit, liabilities on a
                    // credit, which is the only reading that makes "net
                    // effect" mean anything to somebody who is not an
                    // accountant.
                    const up = isAsset || isExpense ? net > 0 : net < 0;
                    const flat = Math.abs(net) <= 0.004;
                    const Arrow = up ? ArrowUp : ArrowDown;
                    return (
                      <tr
                        key={row.code}
                        className={i === rollup.rows.length - 1 ? '' : 'border-b border-slate-100'}
                      >
                        <td className="pl-3.5 pr-4 py-2 whitespace-nowrap">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="w-2 h-2 shrink-0 rounded-[3px]"
                              style={{ backgroundColor: ACCOUNT_COLORS[row.code] ?? '#94A3B8' }}
                            />
                            <span
                              className="inline-flex items-center rounded-md border border-slate-200/60 bg-slate-100/80 px-1.5 py-px font-mono text-[10px] text-slate-500 tabular-nums"
                              style={{ fontWeight: 600 }}
                            >
                              {row.code}
                            </span>
                            <span className="text-foreground" style={{ fontWeight: 500 }}>
                              {row.name}
                            </span>
                            {row.projected && filter === 'all' && (
                              <span
                                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-1.5 text-[10px] text-slate-500"
                                style={{ fontWeight: 600 }}
                              >
                                Includes projected
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {row.debit > 0.004 ? (
                            <span className="text-foreground" style={{ fontWeight: 600 }}>
                              {formatMoney(row.debit, BASE_CURRENCY)}
                            </span>
                          ) : (
                            <span className="text-slate-200">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {row.credit > 0.004 ? (
                            <span className="text-foreground" style={{ fontWeight: 600 }}>
                              {formatMoney(row.credit, BASE_CURRENCY)}
                            </span>
                          ) : (
                            <span className="text-slate-200">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2 pr-3.5 text-right tabular-nums">
                          {flat ? (
                            <span className="text-slate-400" style={{ fontWeight: 600 }}>
                              Nets to nothing
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1"
                              style={{ fontWeight: 700, color: up ? '#047857' : '#E11D48' }}
                            >
                              <Arrow className="w-3 h-3" />
                              <span className="text-right">{formatMoney(Math.abs(net), BASE_CURRENCY)}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr
                    className="border-t border-slate-100"
                    style={{ backgroundColor: rollup.balanced ? '#F7FDF9' : '#FFF1F2' }}
                  >
                    {/* The column sums used to print here, and they added
                        the same money up more than once: a return that
                        moves goods through a holding account debits it on
                        the way in and credits it on the way out, so the
                        debit column totalled thirteen thousand on a return
                        worth five. The one thing those sums were good for
                        is the check that they match each other, so that is
                        all this row says now. */}
                    <td
                      colSpan={4}
                      className="pl-3.5 pr-3.5 py-2 text-[10px] uppercase tracking-[0.08em] text-slate-400"
                      style={{ fontWeight: 700 }}
                    >
                      <span className="inline-flex items-center gap-2">
                        Every entry above
                        <span
                          className="inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] normal-case tracking-normal"
                          style={
                            rollup.balanced
                              ? { fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }
                              : { fontWeight: 600, backgroundColor: '#FFF1F2', color: '#BE123C', borderColor: '#FECDD3' }
                          }
                        >
                          {rollup.balanced ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <AlertTriangle className="w-3 h-3" />
                          )}
                          {rollup.balanced ? 'Balanced · Debit = Credit' : 'Out of balance'}
                        </span>
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* The check finance actually runs: a fully resolved return leaves
            nothing sitting in the clearing account. */}
        <div
          className="px-4 py-3 border-t flex items-center gap-2.5"
          style={
            resolved
              ? { borderColor: '#A7F3D0', backgroundColor: '#F7FDF9' }
              : { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }
          }
        >
          <span
            className="w-2 h-2 rounded-[3px] shrink-0"
            style={{ backgroundColor: ACCOUNT_COLORS[GL_ACCOUNTS.inventoryAtVendor.code] ?? '#94A3B8' }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-slate-500 leading-snug">
              {GL_ACCOUNTS.inventoryAtVendor.name}, balance on posted entries
            </p>
          </div>
          {resolved ? (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-px rounded-full text-[10px] border shrink-0"
              style={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }}
            >
              <CheckCircle2 className="w-3 h-3" />
              Nets to zero
            </span>
          ) : (
            <span className="text-[13px] tabular-nums text-foreground shrink-0" style={{ fontWeight: 700 }}>
              {formatMoney(clearing, BASE_CURRENCY)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

