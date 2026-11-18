/**
 * What is actually going back to one vendor, listed by receiving document.
 *
 * Step 1 asks the question per invoice, because that is what a remedy answers
 * to. This is the other half: goods leave against a receipt, so the shipment a
 * vendor is about to receive reads by receiving document, with the invoice it
 * settles and the remedy it settles as riding along beside it.
 */

import { useState } from 'react';
import { Package } from 'lucide-react';
import {
  SLICE_STATE_ACCENT,
  SLICE_STATE_CHIP,
  SLICE_STATE_LABELS,
  type SliceState,
} from '@/app/data/receiptInvoices';

export type ReturnReceiptRow = {
  key: string;
  sku: string;
  uom: string;
  grnNumber: string;
  poNumber: string;
  invoiceNumber: string | null;
  state: SliceState;
  qty: number;
  remedy: string;
};

/** How many receiving documents are listed before the rest fold away. */
const ROWS_SHOWN = 5;

export function ReturnUnitsByReceipt({
  rows,
  vendorName,
}: {
  rows: ReturnReceiptRow[];
  vendorName: string;
}) {
  const [all, setAll] = useState(false);
  if (rows.length === 0) return null;
  // Units only total across one item; a mixed shipment counts documents.
  const skus = new Set(rows.map((r) => r.sku));
  const uoms = new Set(rows.map((r) => r.uom));
  const total = rows.reduce((n, r) => n + r.qty, 0);
  const receipts = new Set(rows.map((r) => r.grnNumber));
  // A shipment that draws on forty receipts is still one shipment. Listing
  // every one of them turned the card into a ledger, so the first few stand
  // for the rest and the tail is a click away.
  const shown = all ? rows : rows.slice(0, ROWS_SHOWN);
  const hidden = rows.length - shown.length;
  const hiddenQty = rows.slice(shown.length).reduce((n, r) => n + r.qty, 0);

  return (
    <div className="border-t border-slate-100">
      <div className="flex items-center justify-between gap-2 px-4 py-2 bg-[#FAFBFC] border-b border-slate-100">
        <div className="flex items-center gap-1.5 min-w-0">
          <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-[11px] text-slate-600 truncate" style={{ fontWeight: 600 }}>
            Going back to {vendorName}
          </span>
        </div>
        <span className="text-[11px] text-slate-500 tabular-nums shrink-0" style={{ fontWeight: 600 }}>
          {uoms.size === 1 && skus.size === 1
            ? `${total} ${[...uoms][0]}`
            : `${receipts.size} receiving ${receipts.size === 1 ? 'document' : 'documents'}`}
        </span>
      </div>
      <div className="divide-y divide-slate-100">
        {shown.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-3 px-4 py-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-foreground truncate" style={{ fontWeight: 600 }}>
                  {row.grnNumber}
                </span>
                {skus.size > 1 && (
                  <span className="text-[10px] text-slate-500 truncate" style={{ fontWeight: 500 }}>
                    {row.sku}
                  </span>
                )}
                <span
                  className={`inline-flex items-center px-1.5 py-px rounded-full text-[10px] border ${SLICE_STATE_CHIP[row.state]}`}
                  style={{ fontWeight: 600 }}
                >
                  {SLICE_STATE_LABELS[row.state]}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate mt-0.5" style={{ fontWeight: 500 }}>
                PO {row.poNumber} · {row.invoiceNumber ?? 'Not yet invoiced'}
                {row.remedy ? ` · ${row.remedy}` : ''}
              </p>
            </div>
            {/* Same colour the invoice carried in step 1, so a shipment row
                and the bill it settles read as the same thing. */}
            <span
              className={`shrink-0 text-[11px] tabular-nums ${SLICE_STATE_ACCENT[row.state].num}`}
              style={{ fontWeight: 600 }}
            >
              {row.qty} {row.uom}
            </span>
          </div>
        ))}
      </div>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="w-full px-4 py-2 text-left text-[11px] text-primary hover:bg-primary/[0.03] transition-colors border-t border-slate-100"
          style={{ fontWeight: 600 }}
        >
          Show {hidden} more {hidden === 1 ? 'receiving document' : 'receiving documents'}
          <span className="text-slate-400 tabular-nums" style={{ fontWeight: 500 }}>
            {' '}· {hiddenQty} {[...uoms][0] ?? ''}
          </span>
        </button>
      )}
    </div>
  );
}
