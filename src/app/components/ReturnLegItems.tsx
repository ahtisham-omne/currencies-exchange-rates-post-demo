/**
 * What is actually in one vendor's box.
 *
 * The shipment view knew where the goods were going and how they settled but
 * never said what they were: a leg read as a receipt number and a quantity,
 * which is enough to file and not enough to pack. This states the items --
 * and, for each, the paperwork it travels under, the units named on it if they
 * are named, and whatever the returner wrote or attached when they picked it.
 *
 * Everything here is a readout. It was all answered on the previous step, and
 * a shipment is where you check the answers rather than change them.
 */

import { Paperclip, ScanLine, StickyNote } from 'lucide-react';
import { SLICE_STATE_CHIP, SLICE_STATE_LABELS, type SliceState } from '@/app/data/receiptInvoices';
import type { LineAttachmentFile } from '@/app/components/rma/CreateLineAttachments';

export type LegItem = {
  key: string;
  sku: string;
  description: string;
  uom: string;
  image?: string | undefined;
  qty: number;
  serialized: boolean;
  purchaseOrders: string[];
  receipts: string[];
  states: SliceState[];
  invoices: string[];
  remedies: string[];
  serials: string[];
  notes: string;
  attachments: LineAttachmentFile[];
};

/** Every document the item travels under, on one line. Stacked under three
 *  headings they took four rows to say what a row of chips says, and the
 *  headings named what the chips already look like. */
function DocRow({ item }: { item: LegItem }) {
  const docs: { key: string; label: string; tone?: SliceState }[] = [
    ...item.purchaseOrders.map((v) => ({ key: `po-${v}`, label: v })),
    ...item.receipts.map((v) => ({ key: `rec-${v}`, label: v })),
    ...item.states.map((st) => ({ key: `st-${st}`, label: SLICE_STATE_LABELS[st], tone: st })),
  ];
  if (docs.length === 0) return null;
  return (
    <div className="flex items-center gap-1 flex-wrap min-w-0">
      {docs.map((d) => (
        <span
          key={d.key}
          className={`inline-flex items-center px-1.5 py-0.5 rounded-md border text-[10px] whitespace-nowrap ${
            d.tone ? SLICE_STATE_CHIP[d.tone] : 'border-slate-200 bg-slate-50 text-slate-600'
          }`}
          style={{ fontWeight: 600 }}
        >
          {d.label}
        </span>
      ))}
    </div>
  );
}

export function ReturnLegItems({ items }: { items: LegItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.key}
          className="rounded-xl border border-[#E8ECF1] bg-white overflow-hidden shadow-sm"
        >
          {/* The item leads, the way it leads the line on the previous step:
              a shipment is a box of things, and the things are what the
              person opening this needs first. */}
          <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-[#EEF2F6] bg-[#FAFBFC]">
            <div className="w-10 h-10 rounded-md overflow-hidden border border-[#E8ECF1] bg-white shrink-0">
              {item.image && (
                <img src={item.image} alt={item.sku} className="w-full h-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>{item.sku}</span>
                <span
                  className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] border bg-slate-50 text-slate-600 border-slate-200"
                  style={{ fontWeight: 600 }}
                >
                  {item.serialized ? 'Serialized' : 'Non-Serialized'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-px">{item.description}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[13px] text-emerald-700 tabular-nums" style={{ fontWeight: 700 }}>
                {item.qty} {item.uom}
              </p>
              {item.remedies.length > 0 && (
                <p className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
                  {item.remedies.join(' · ')}
                </p>
              )}
            </div>
          </div>

          {/* Two columns under the header, the shape the line detail already
              uses: the paperwork on one side, what the returner added on the
              other. */}
          <div className="grid grid-cols-2 gap-3 p-3">
            <div className="min-w-0">
              <DocRow item={item} />
            </div>

            <div className="space-y-2.5 min-w-0">
              {item.serialized && item.serials.length > 0 && (
                <div className="space-y-1">
                  <p className="flex items-center gap-1 text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
                    <ScanLine className="w-3 h-3 shrink-0" />
                    {item.serials.length} serial {item.serials.length === 1 ? 'number' : 'numbers'}
                  </p>
                  <div className="flex items-center gap-1 flex-wrap max-h-[68px] overflow-y-auto">
                    {item.serials.map((sn) => (
                      <span
                        key={sn}
                        className="inline-flex items-center px-1.5 py-0.5 rounded border border-slate-200 bg-[#FAFBFC] text-[10px] text-slate-600 font-mono whitespace-nowrap"
                      >
                        {sn}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {item.notes.trim() && (
                <div className="space-y-1">
                  <p className="flex items-center gap-1 text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
                    <StickyNote className="w-3 h-3 shrink-0" />
                    Notes
                  </p>
                  <p className="text-[11px] text-slate-600 leading-snug">{item.notes}</p>
                </div>
              )}

              {item.attachments.length > 0 && (
                <div className="space-y-1">
                  <p className="flex items-center gap-1 text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
                    <Paperclip className="w-3 h-3 shrink-0" />
                    {item.attachments.length} {item.attachments.length === 1 ? 'attachment' : 'attachments'}
                  </p>
                  <div className="flex items-center gap-1 flex-wrap">
                    {item.attachments.map((f) => (
                      <span
                        key={f.name}
                        title={f.name}
                        className="inline-flex items-center px-1.5 py-0.5 rounded border border-slate-200 bg-[#FAFBFC] text-[10px] text-slate-600 whitespace-nowrap max-w-[150px] truncate"
                        style={{ fontWeight: 500 }}
                      >
                        {f.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
