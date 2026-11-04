/* ── Credit memo detail page (9/22/26 review response, GPT F16) ────────
 * The Sept 20 reviews found the credit memo number linking to a "coming
 * soon" toast. This is its real page: identity, the invoice it reduced,
 * and the journal it books — composed from the same visual idioms the
 * payment detail page uses (status-tinted header card, white cards on
 * slate, weight ≤ 600).
 */

import { ArrowLeft, FileMinus2, Receipt } from 'lucide-react';
import type { CreditMemo } from '@/app/data/creditMemos';
import { splitAccount } from '@/app/lib/glPosting';

const fmt = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
};

export function CreditMemoDetailScreen({
  memo,
  onClose,
  onViewInvoice,
}: {
  memo: CreditMemo;
  onClose: () => void;
  onViewInvoice: (invoiceNumber: string) => void;
}) {
  // The journal a vendor credit books: it reduces what is owed (Dr A/P)
  // against the cost it corrects — inventory for inventory-backed
  // invoices, the expense side otherwise.
  const isInventory = memo.invoiceType !== 'Standalone';
  // A pre-invoice credit books NOTHING (Mahreen 10/10): the pre-invoice
  // hasn't posted, so there is no A/P or inventory to reverse.
  const isPreInvoice = memo.invoiceType === 'Pre-Invoice';
  const creditSide = isInventory
    ? splitAccount('1200 Inventory')
    : splitAccount('6000 General & Admin');
  const glLines = [
    { code: '2000', name: 'Accounts Payable', desc: `Reduces the balance of ${memo.invoiceNumber}`, debit: memo.amount, credit: 0 },
    { code: creditSide.code, name: creditSide.name, desc: memo.reason, debit: 0, credit: memo.amount },
  ];

  const statusPill = memo.status === 'Applied'
    ? { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' }
    : { bg: '#F1F5F9', color: '#475569', border: '#E2E8F0' };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto">
      {/* Breadcrumb */}
      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-foreground transition-colors cursor-pointer bg-transparent border-0 p-0"
          style={{ fontWeight: 500 }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
      </div>

      {/* Header card */}
      <div className="px-3 pt-2.5">
        <div className="rounded-xl border border-border bg-white shadow-sm px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <FileMinus2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-[17px] text-foreground" style={{ fontWeight: 600 }}>{memo.creditMemoNumber}</h1>
                <span
                  className="inline-flex items-center px-2 py-px rounded-full text-[10.5px] border"
                  style={{ fontWeight: 600, backgroundColor: statusPill.bg, color: statusPill.color, borderColor: statusPill.border }}
                >
                  {memo.status}
                </span>
              </div>
              <p className="text-[12px] text-slate-500 mt-0.5 truncate" style={{ fontWeight: 400 }}>
                Credit memo from {memo.vendor}, applied to invoice {memo.invoiceNumber} on {fmtDate(memo.date)}. Created by {memo.createdBy}.
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] text-slate-400" style={{ fontWeight: 600 }}>Credit Amount</p>
            <p className="text-[20px] text-foreground " style={{ fontWeight: 600 }}>{fmt(memo.amount)}</p>
          </div>
        </div>
      </div>

      <div className="px-3 py-3 grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3 items-start">
        {/* Applied to */}
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-slate-400" />
              <h2 className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Applied To</h2>
            </div>
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                {/* No glyph, black at rest, hover blue + underline, NEW
                    TAB (user 10/5 link standard). */}
                <button
                  type="button"
                  onClick={() => window.open(`/invoices/${encodeURIComponent(memo.invoiceNumber)}`, '_blank', 'noopener')}
                  className="inline-flex items-center text-[13px] text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors cursor-pointer bg-transparent border-0 p-0"
                  style={{ fontWeight: 600 }}
                >
                  {memo.invoiceNumber}
                </button>
                <p className="text-[11.5px] text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                  {memo.invoiceType} · {memo.vendor}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Credited</p>
                <p className="text-[13px] text-foreground " style={{ fontWeight: 600 }}>{fmt(memo.amount)}</p>
              </div>
            </div>
          </div>

          {/* GL impact */}
          <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>GL Impact</h2>
              {!isPreInvoice && (
                <p className="text-[11.5px] text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                  The credit reduces what is owed on the invoice; nothing was paid in cash.
                </p>
              )}
            </div>
            {isPreInvoice ? (
              <div className="px-4 py-3">
                <p className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>No accounting entry</p>
                <p className="text-[11.5px] text-slate-500 mt-0.5">A pre-invoice posts nothing until it is paid.</p>
              </div>
            ) : (
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50/70 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-2 text-[10px] text-slate-500" style={{ fontWeight: 600 }}>Account</th>
                  <th className="text-right px-4 py-2 text-[10px] text-slate-500" style={{ fontWeight: 600 }}>Debit</th>
                  <th className="text-right px-4 py-2 text-[10px] text-slate-500" style={{ fontWeight: 600 }}>Credit</th>
                </tr>
              </thead>
              <tbody>
                {glLines.map((l) => (
                  <tr key={`${l.code}-${l.debit ? 'dr' : 'cr'}`} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-4 py-2">
                      <span className="text-[11px] text-slate-500 " style={{ fontWeight: 500 }}>{l.code}</span>
                      <span className="text-slate-700 ml-1.5" style={{ fontWeight: 500 }}>{l.name}</span>
                      {l.desc && <span className="text-slate-400 ml-1.5 text-[11px]">{l.desc}</span>}
                    </td>
                    <td className="px-4 py-2 text-right ">{l.debit ? fmt(l.debit) : null}</td>
                    <td className="px-4 py-2 text-right ">{l.credit ? fmt(l.credit) : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        </div>

        {/* Details sidebar */}
        <div className="rounded-xl border border-border bg-white shadow-sm px-4 py-3.5 flex flex-col gap-2.5">
          <h2 className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Credit Memo Details</h2>
          {[
            ['Credit Memo Number', memo.creditMemoNumber],
            ['Vendor', memo.vendor],
            ['Invoice', memo.invoiceNumber],
            ['Date', fmtDate(memo.date)],
            ['Reason', memo.reason],
            ['Amount', fmt(memo.amount)],
            ['Created By', memo.createdBy],
          ].map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-3">
              <span className="text-[11.5px] text-slate-500" style={{ fontWeight: 500 }}>{label}</span>
              <span className="text-[11.5px] text-foreground text-right" style={{ fontWeight: 600 }}>{value}</span>
            </div>
          ))}
          {memo.description && (
            <div className="pt-1 border-t border-slate-100">
              <p className="text-[11px] text-slate-400 mb-0.5" style={{ fontWeight: 500 }}>Description</p>
              <p className="text-[12px] text-slate-600" style={{ fontWeight: 400 }}>{memo.description}</p>
            </div>
          )}
          {memo.attachments && memo.attachments.length > 0 && (
            <div className="pt-1 border-t border-slate-100">
              <p className="text-[11px] text-slate-400 mb-0.5" style={{ fontWeight: 500 }}>Supporting Documents</p>
              {memo.attachments.map((a) => (
                <p key={a} className="text-[12px] text-slate-600" style={{ fontWeight: 400 }}>{a}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
