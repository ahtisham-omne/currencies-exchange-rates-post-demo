import { CalendarDays, Lock } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { PhotoPersonAvatar } from '@/app/components/data-table';
import type { InvoiceActionHistoryEntry } from '@/app/data/mockInvoices';
import { splitHoldReason } from '@/app/data/holdReasons';
import { formatUsDate } from '@/app/lib/dueBucket';

/* PaymentHoldLock — the ONE payment hold indicator (ERP-8796, 10/26/26).
 * Payment hold is a flag, not an invoice status, so it never takes a
 * status pill's place: a yellow lock rides beside the Invoice ID wherever
 * an invoice is listed. Renders nothing when the invoice is not held.
 *
 * Hover opens a quick card in the CreatedByCell recipe (rounded-xl, soft
 * shadow, footer strip): the hold type leads, the note follows, and who
 * placed it, and when, sits in the footer. */
export function PaymentHoldLock({
  invoice,
  size = 14,
}: {
  invoice: { is_payment_held?: boolean; actionHistory?: InvoiceActionHistoryEntry[] };
  size?: number;
}) {
  if (!invoice.is_payment_held) return null;
  const hold = [...(invoice.actionHistory ?? [])].reverse().find((e) => e.action === 'paymentHold');
  const { type, note } = splitHoldReason(hold?.reason);
  return (
    <HoverCard openDelay={300} closeDelay={120}>
      <HoverCardTrigger asChild>
        <span
          role="img"
          aria-label="On Payment Hold"
          className="inline-flex shrink-0 items-center justify-center rounded p-0.5 text-yellow-600 hover:bg-yellow-100 hover:text-yellow-700 transition-colors cursor-default"
          onClick={(e) => e.stopPropagation()}
        >
          <Lock style={{ width: size, height: size }} strokeWidth={2.25} />
        </span>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="w-[300px] p-0 rounded-xl border border-border/60 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[300]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — what this is, in the hold's yellow. */}
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-yellow-50/70 border-b border-yellow-100">
          <div className="w-7 h-7 rounded-lg bg-yellow-100 flex items-center justify-center shrink-0">
            <Lock className="w-3.5 h-3.5 text-yellow-700" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] text-slate-900 leading-tight" style={{ fontWeight: 500 }}>
              On Payment Hold
            </p>
            <p className="text-[11px] text-slate-500 leading-tight mt-0.5">Can't be paid until the hold is released</p>
          </div>
        </div>

        {/* Body — the hold type, then the note. */}
        <div className="px-3.5 py-3 space-y-2.5 bg-white">
          <div>
            <p className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Hold Type</p>
            <span
              className="mt-1 inline-flex items-center rounded-md border border-yellow-300 bg-yellow-50 px-2 py-0.5 text-[12px] text-yellow-900"
              style={{ fontWeight: 500 }}
            >
              {type}
            </span>
          </div>
          {note && (
            <div>
              <p className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Note</p>
              <p className="mt-0.5 text-[12px] text-slate-700 leading-snug">{note}</p>
            </div>
          )}
        </div>

        {/* Footer — who placed it, and when. */}
        {hold && (
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-slate-50/70 border-t border-border/50">
            <PhotoPersonAvatar name={hold.by} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-slate-800 truncate leading-tight" style={{ fontWeight: 500 }}>
                {hold.by}
              </p>
              <p className="text-[11px] text-slate-500 leading-tight mt-0.5">Placed the hold</p>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
              <CalendarDays className="w-3 h-3 text-slate-400" />
              {formatUsDate(hold.at)}
            </span>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
