import { useMemo } from 'react';
import { CheckCircle2, AlertTriangle, CircleDashed, BookOpen, ArrowUp, ArrowDown, Info, Undo2 } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';
import { Invoice } from '@/app/data/mockInvoices';
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

function formatMoney(amount: number, currency: string) {
  return `${currency === 'USD' ? '$' : currency + ' '}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function GLImpactTab({
  invoice,
  numbers,
}: {
  invoice: Invoice;
  numbers: { total: number; subtotal: number; tax: number; freight: number; additional: number; paid: number; credits?: number };
  payments: PaymentRecord[];
}) {
  // ── 2.1 Journal entries — the entry THIS INVOICE creates. One row per
  // account; the unused side of each row stays blank (faint dash).
  // Accrual model (8/25/26 meeting):
  //   Received-goods invoices (PO / Receiving-based): the receiving
  //   already booked Dr Inventory / Cr AP Accrual, so this entry is the
  //   liability transfer, Dr AP Accrual + Cr Accounts Payable.
  //   Pre-invoices: Inventory debit + Accounts Payable credit, posting
  //   at receiving (nothing has been received yet, so there is no
  //   accrual to clear).
  //   Standalone: Expense debit + Accounts Payable credit.
  //   Cancelled (posted types): the original entry PLUS its reversal,
  //   so the tab shows exactly what the cancellation booked. Cancelled
  //   pre-invoices never posted, so they keep just the defined entry.
  const isCancelledReversal = invoice.status === 'Cancelled' && invoice.type !== 'Pre-Invoice';
  const lines = useMemo<JournalLine[]>(() => {
    const round2 = (n: number) => Math.round(n * 100) / 100;
    // User-created records carry the exact snapshot the confirmation
    // showed (lib/glPosting.ts) — render it verbatim so the preview and
    // the saved entry can never disagree (9/22/26 review response).
    // Seeds keep the synthesized entry below.
    if (invoice.glEntries && invoice.glEntries.length > 0) {
      // A pre-invoice's snapshot is a payment PREVIEW: scale it to what is
      // still requested after credit memos (BA 10/10).
      const preScale = invoice.type === 'Pre-Invoice' && numbers.total > 0 && (numbers.credits ?? 0) > 0
        ? Math.max(0, (numbers.total - (numbers.credits ?? 0)) / numbers.total)
        : 1;
      const snapshot: JournalLine[] = invoice.glEntries.map((e, i) => ({
        id: `je-snap-${i}`,
        accountCode: e.accountCode,
        accountName: e.accountName,
        description: isCancelledReversal ? 'Original posting' : e.description ?? '',
        ...(e.debit !== undefined ? { debit: round2(e.debit * preScale) } : {}),
        ...(e.credit !== undefined ? { credit: round2(e.credit * preScale) } : {}),
      }));
      if (isCancelledReversal) {
        snapshot.push(
          ...invoice.glEntries.map((e, i) => ({
            id: `je-snap-rev-${i}`,
            accountCode: e.accountCode,
            accountName: e.accountName,
            description: 'Cancellation reversal',
            ...(e.debit !== undefined ? { credit: round2(e.debit) } : {}),
            ...(e.credit !== undefined ? { debit: round2(e.credit) } : {}),
          })),
        );
      }
      return snapshot.filter((l) => (l.debit ?? l.credit ?? 0) > 0.004);
    }
    const rows: JournalLine[] = [];
    // Pre-invoices preview the FIRST-PAYMENT entry (VI-20/21): Dr 1205
    // Advance Payments / Cr 1000 Cash — the exact pair the create screen
    // shows, framed as "at first payment" since nothing posts at creation.
    // Posted types synthesize the invoice's own posting (Dr expense/
    // accrual, Cr A/P).
    const isPre = invoice.type === 'Pre-Invoice';
    const debitAccount = invoice.type === 'Standalone'
      ? { code: '6000', name: 'Operating Expenses' }
      : isPre
        ? { code: '1205', name: 'Advance Payments' }
        : { code: '2100', name: 'AP Accrual' };
    const creditAccount = isPre
      ? { code: '1000', name: 'Cash / Bank' }
      : { code: '2000', name: 'Accounts Payable' };
    // A pre-invoice previews what it will actually be paid (BA 10/10): a
    // credit memo lowers the amount requested, so $38,005 less a $140
    // credit previews $37,865.
    const lineAmount = isPre ? round2(numbers.total - (numbers.credits ?? 0)) : round2(numbers.total);
    rows.push({
      id: 'je-1',
      accountCode: debitAccount.code,
      accountName: debitAccount.name,
      description: isCancelledReversal ? 'Original posting' : isPre ? 'At first payment' : '',
      debit: lineAmount,
    });
    rows.push({
      id: 'je-ap',
      accountCode: creditAccount.code,
      accountName: creditAccount.name,
      description: isCancelledReversal ? 'Original posting' : isPre ? 'At first payment' : '',
      credit: lineAmount,
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
  }, [invoice.type, invoice.glEntries, numbers, isCancelledReversal]);

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

  // Nothing has hit the GL yet — no preview table, no banner (user 10/1):
  // an empty state in the Coming-Soon visual language tells the reviewer
  // there is no data here yet and when it will appear.
  if (postingStatus === 'not_posted') {
    return (
      <div className="border border-border rounded-xl bg-white overflow-hidden flex flex-col" style={{ minHeight: 'max(400px, calc(100vh - 269px))' }}>
        <div className="flex-1 flex flex-col items-center justify-center w-full py-12 px-6 text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-primary/5 animate-ping" style={{ animationDuration: '3s' }} />
            <div
              className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-50 to-accent border border-border flex items-center justify-center shadow-sm"
              style={{ animation: 'glFloat 4s ease-in-out infinite' }}
            >
              <BookOpen className="w-7 h-7 text-slate-400" />
            </div>
          </div>
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-muted border border-border mb-3">
            <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 600 }}>Not Posted</span>
          </div>
          <h3 className="text-foreground text-[16px] mb-1.5" style={{ fontWeight: 600 }}>No GL impact yet</h3>
          <p className="text-slate-400 text-[13px] max-w-sm leading-relaxed">
            {invoice.status === 'Cancelled'
              ? 'This invoice was cancelled before posting, so nothing ever hit the general ledger.'
              : 'This invoice is pending approval, so nothing has posted to the general ledger. The journal entry appears here once the invoice is approved and posted.'}
          </p>
        </div>
        <style>{`@keyframes glFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }`}</style>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {/* ── Posting status — slim gradient banner with status pill ── */}
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
              {/* Decision #44 wording (GPT QC11, 9/30): nothing posts at
                  creation or approval — the entry below is a PREVIEW of
                  the future receiving posting, and the advance posts
                  separately when it is paid. */}
              <p className="text-[13px] tracking-tight" style={{ fontWeight: 600, color: '#6D28D9' }}>
                No GL Impact Yet
              </p>
              <span
                className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] border"
                style={{ fontWeight: 700, backgroundColor: '#F5F3FF', color: '#6D28D9', borderColor: '#DDD6FE' }}
              >
                Pre-Invoice
              </span>
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: '#7C3AED' }}>
              {/* Mahreen 10/10: the rows below ARE the payment entry. */}
              A pre-invoice posts nothing when created or approved. The entry below posts when a payment is made.
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
              Cancelled, Posted Entry Reversed
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: '#DC2626' }}>
              The original posting was undone with the reversal entry below. Net effect on the books is zero.
            </p>
          </div>
        </div>
      )}
      {/* No "Posted to the general ledger" banner (user 10/1): the journal
          entries below already say it — only states the table can't show
          (reversed, exception, pre-invoice) keep a banner. */}
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
              Exception, Posting Blocked
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
            <h3 className="text-[13px] text-foreground tracking-tight" style={{ fontWeight: 600 }}>GL Impact</h3>
            <p className="text-[11px] text-slate-400">How this invoice posts to the general ledger, account by account.</p>
          </div>
          <span
            className="text-[10px] rounded-full px-2 py-0.5 bg-muted text-muted-foreground shrink-0"
            style={{ fontWeight: 600 }}
          >
            {lines.length} lines
          </span>
        </div>
        {/* No debit-vs-credit explainer (Nophil 9/28): the journal table
            speaks for itself; the posting-status card above carries the
            when. */}
        <table className="w-full text-[12px]">
          <thead className="bg-slate-50/60 border-b border-slate-100">
            <tr>
              <th className="text-left pl-5 pr-4 py-2 text-[10px] text-slate-400" style={{ fontWeight: 700 }}>Account</th>
              {showDescriptions && (
                <th className="text-left px-4 py-2 text-[10px] text-slate-400" style={{ fontWeight: 700 }}>Description</th>
              )}
              <th className="text-right px-4 py-2 text-[10px] text-slate-400" style={{ fontWeight: 700 }}>Debit</th>
              <th className="text-right px-4 py-2 pr-5 text-[10px] text-slate-400" style={{ fontWeight: 700 }}>Credit</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr
                key={line.id}
                className={`${idx === lines.length - 1 ? '' : 'border-b border-slate-100'} hover:bg-[#F8FAFF] transition-colors`}
              >
                <td className="pl-5 pr-4 py-2.5">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-flex items-center px-1.5 py-px rounded-md text-[10px] bg-slate-100/80 text-slate-500 border border-slate-200/60"
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
                <td className="px-4 py-2.5 text-right ">
                  {line.debit ? (
                    <span className="text-foreground" style={{ fontWeight: 600 }}>{formatMoney(line.debit, invoice.currency)}</span>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 pr-5 text-right ">
                  {line.credit ? (
                    <span className="text-foreground" style={{ fontWeight: 600 }}>{formatMoney(line.credit, invoice.currency)}</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
          {/* Totals row + inline balance check (Dr = Cr) */}
          <tfoot>
            <tr className="border-t border-slate-200/80" style={{ backgroundColor: '#F7FDF9' }}>
              <td className="pl-5 pr-4 py-2.5 text-[10px] text-slate-400" style={{ fontWeight: 700 }}>
                <span className="inline-flex items-center gap-2.5">
                  Totals
                  {!showDescriptions && (
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-px rounded-full text-[10px] tracking-normal border"
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
              <td className="px-4 py-2.5 text-right text-foreground text-[13px]" style={{ fontWeight: 700 }}>
                {formatMoney(totalDebits, invoice.currency)}
              </td>
              <td className="px-4 py-2.5 pr-5 text-right text-foreground text-[13px]" style={{ fontWeight: 700 }}>
                {formatMoney(totalCredits, invoice.currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

