import { ExternalLink } from 'lucide-react';
import { VendorAvatar } from '@/app/components/VendorAvatar';

export interface BulkInvoiceListItem {
  invoiceNumber: string;
  vendor: string;
  amount: number;
}

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The invoices a bulk action touches (user 10/9): the list is the point of
 * the modal, so it leads the body. A count + total header, then one row per
 * invoice: vendor avatar, the invoice ID as a new-tab link (black at rest,
 * blue + underline on hover, the listing's link recipe), vendor name, and
 * the amount on the right. Shared by bulk approve and the reason dialogs.
 */
// The list caps against the viewport (user 10/9) so short screens keep the
// whole modal, CTAs included, on screen; it scrolls inside its own box.
export function BulkInvoiceList({
  items,
  maxHeight = 'min(220px, 26vh)',
  noun = 'invoice',
  hrefBase = '/invoices/',
}: {
  items: BulkInvoiceListItem[];
  maxHeight?: number | string;
  /** Payments reuse the list (user 10/22/26): "3 payments", linking to
   *  each payment's page. */
  noun?: string;
  hrefBase?: string;
}) {
  const total = items.reduce((s, i) => s + i.amount, 0);
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-2 px-3.5 py-2 border-b border-slate-100">
        <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
          {items.length} {noun}{items.length === 1 ? '' : 's'}
        </span>
        <span className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>
          <span className="text-slate-400 mr-1" style={{ fontWeight: 400 }}>Total</span>
          {fmt(total)}
        </span>
      </div>
      <div className="divide-y divide-slate-100 overflow-y-auto custom-scrollbar" style={{ maxHeight }}>
        {items.map((t) => (
          <div key={t.invoiceNumber} className="flex items-center gap-2.5 px-3.5 py-2 hover:bg-slate-50/60 transition-colors">
            <VendorAvatar name={t.vendor} size="sm" />
            <div className="min-w-0 flex-1">
              <a
                href={`${hrefBase}${encodeURIComponent(t.invoiceNumber)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-1 max-w-full text-[12px] text-slate-800 hover:text-primary hover:underline underline-offset-2 transition-colors"
                style={{ fontWeight: 500 }}
              >
                <span className="truncate">{t.invoiceNumber}</span>
                <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
              <p className="text-[11px] text-slate-500 truncate leading-tight">{t.vendor}</p>
            </div>
            <span className="text-[12px] text-slate-700 shrink-0" style={{ fontWeight: 500 }}>{fmt(t.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
