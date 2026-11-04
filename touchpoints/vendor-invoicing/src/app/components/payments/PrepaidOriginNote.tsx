import type { ReactNode } from 'react';
import { Wallet } from 'lucide-react';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/app/components/ui/hover-card';
import type { Invoice } from '@/app/data/mockInvoices';

/* ── Prepaid origin note (9/2/26) ────────────────────────────────────
 * Reconciliation was visible at creation and on the invoice detail, but
 * NOT where the remainder gets paid: a $100 invoice with a $30
 * prepayment showed up in the pay surfaces as a bare $70 with no trace
 * of why. This note rides every Amount-Due/Balance-due cell for
 * invoices that consumed a prepayment at creation: an icon-only violet
 * wallet badge inline with the amount (Eli 10/5 — the old "$X after $Y"
 * face read as two competing numbers; the "Prepaid applied" text then
 * wrapped to a second line, so it's an icon now), with the full story
 * (original total, the pre-invoice that paid, what was left to pay) in
 * the hover card he asked us to keep. */

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Total prepayment consumed at this invoice's creation. */
export function prepaidTotalOf(invoice: Pick<Invoice, 'appliedPrepayments'>): number {
  return round2((invoice.appliedPrepayments ?? []).reduce((s, p) => s + p.amount, 0));
}

export function PrepaidOriginNote({
  invoice,
  className = '',
}: {
  invoice: Pick<Invoice, 'appliedPrepayments' | 'amount'>;
  className?: string;
}) {
  const prepaid = prepaidTotalOf(invoice);
  if (prepaid <= 0.004) return null;
  const entries = invoice.appliedPrepayments ?? [];
  const original = invoice.amount;
  const dueAfter = round2(Math.max(0, original - prepaid));
  return (
    <span onClick={(e) => e.stopPropagation()} className={className}>
      <HoverCard openDelay={250} closeDelay={120}>
        <HoverCardTrigger asChild>
          <span
            className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-md bg-violet-50 border border-violet-200 text-violet-600 cursor-help shrink-0 align-middle"
            aria-label={`Prepaid ${fmt(prepaid)} applied`}
          >
            <Wallet className="w-3 h-3" />
          </span>
        </HoverCardTrigger>
        <HoverCardContent
          side="top"
          align="end"
          sideOffset={6}
          className="w-[280px] p-0 rounded-xl border border-border shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[400] bg-white"
        >
          <div className="px-4 py-3 flex items-center gap-3 border-b border-border/60">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#F5F3FF' }}>
              <Wallet className="w-[18px] h-[18px]" style={{ color: '#6D28D9' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>Prepayment Already Applied</p>
              <p className="text-[11px] text-slate-400">Reconciled when this invoice was created</p>
            </div>
          </div>
          <div className="p-3">
            <div className="rounded-lg bg-slate-50 px-3 py-2 space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-[11.5px]">
                <span className="text-slate-500">Original Invoice Total</span>
                <span className="text-slate-700 " style={{ fontWeight: 500 }}>{fmt(original)}</span>
              </div>
              {entries.map((p) => (
                <div key={p.invoiceNumber} className="flex items-center justify-between gap-2 text-[11.5px]">
                  <span className="text-violet-700 truncate " style={{ fontWeight: 500 }}>Prepaid · {p.invoiceNumber}</span>
                  <span className="text-violet-700 shrink-0" style={{ fontWeight: 600 }}>−{fmt(p.amount)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-2 text-[11.5px] pt-1.5 mt-0.5 border-t border-slate-200/70">
                <span className="text-slate-500">Left to Pay</span>
                <span className="text-foreground " style={{ fontWeight: 600 }}>{fmt(dueAfter)}</span>
              </div>
            </div>
            <p className="text-[10.5px] text-slate-400 leading-snug mt-2">
              The prepayment applied automatically at creation and its pre-invoice settled as reconciled. This payment covers only the remainder.
            </p>
          </div>
        </HoverCardContent>
      </HoverCard>
    </span>
  );
}

/** Convenience: the icon-only prepaid note to the LEFT of the amount on
 *  the SAME line (user 10/5: icon left of the value, "[icon] $45,202.50",
 *  so a right-aligned column keeps the figures flush on one row). */
export function AmountWithPrepaidNote({
  invoice,
  children,
}: {
  invoice: Pick<Invoice, 'appliedPrepayments' | 'amount'>;
  children: ReactNode;
}) {
  const prepaid = prepaidTotalOf(invoice);
  if (prepaid <= 0.004) return <>{children}</>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <PrepaidOriginNote invoice={invoice} />
      {children}
    </span>
  );
}
