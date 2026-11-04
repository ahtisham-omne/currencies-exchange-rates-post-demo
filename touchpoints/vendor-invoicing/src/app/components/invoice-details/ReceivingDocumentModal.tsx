import { Package, Building2, Calendar, User, CheckCircle2, ExternalLink, Truck, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';

/* ════════════════════════════════════════════════════════════════
   Receiving Document (GRN) detail modal — opens from a Linked
   Documents chip click in the Line Items table. Shows the
   goods-receipt header (number, status, dates, signed-by) and the
   per-line item received quantities so the user can verify the
   three-way match without leaving the invoice page.
   ════════════════════════════════════════════════════════════════ */

export interface ReceivingDocumentLine {
  sku: string;
  productName: string;
  uom: string;
  orderedQty: number;
  receivedQty: number;
  serialized: boolean;
}

interface ReceivingDocumentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grnNumber: string;
  vendorName: string;
  poRef?: string;
  receivedDate: string;
  receivedBy?: string;
  carrier?: string;
  status?: 'Received' | 'Partial' | 'Pending';
  lines: ReceivingDocumentLine[];
}

const STATUS_PALETTE = {
  Received: { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  Partial: { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' },
  Pending: { bg: '#F1F5F9', color: '#475569', border: '#E2E8F0' },
};

export function ReceivingDocumentModal({
  open,
  onOpenChange,
  grnNumber,
  vendorName,
  poRef,
  receivedDate,
  receivedBy = 'Warehouse Team',
  carrier = 'In-house Logistics',
  status = 'Received',
  lines,
}: ReceivingDocumentModalProps) {
  const palette = STATUS_PALETTE[status];
  const totalOrdered = lines.reduce((s, l) => s + l.orderedQty, 0);
  const totalReceived = lines.reduce((s, l) => s + l.receivedQty, 0);
  const receivedPct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#EEF2F6] bg-white">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-emerald-700" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-[15px] text-foreground " style={{ fontWeight: 700 }}>
                  {grnNumber}
                </DialogTitle>
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border"
                  style={{ fontWeight: 600, backgroundColor: palette.bg, color: palette.color, borderColor: palette.border }}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {status}
                </span>
                {poRef && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] bg-blue-50 text-blue-700 border border-blue-100" style={{ fontWeight: 600 }}>
                    <FileText className="w-3 h-3" />
                    {poRef}
                  </span>
                )}
              </div>
              <DialogDescription className="text-[12px] text-slate-500 mt-1">
                Goods receipt from <span className="text-foreground" style={{ fontWeight: 600 }}>{vendorName}</span>, {totalReceived} of {totalOrdered} units received ({receivedPct}%).
              </DialogDescription>
            </div>
          </div>

          {/* Receiving metadata */}
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 px-3 py-2.5 rounded-lg bg-slate-50/80 border border-slate-200">
            <div className="flex items-start gap-2">
              <Building2 className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Vendor</p>
                <p className="text-[11px] text-foreground truncate" style={{ fontWeight: 600 }}>{vendorName}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Calendar className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Received On</p>
                <p className="text-[11px] text-foreground " style={{ fontWeight: 600 }}>{receivedDate}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Truck className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Carrier</p>
                <p className="text-[11px] text-foreground truncate" style={{ fontWeight: 600 }}>{carrier}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <User className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Received By</p>
                <p className="text-[11px] text-foreground truncate" style={{ fontWeight: 600 }}>{receivedBy}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Items body */}
        <div className="max-h-[55vh] overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-slate-50/60 border-b border-slate-100 text-slate-500 text-[11px] sticky top-0" style={{ fontWeight: 600 }}>
              <tr>
                <th className="px-5 py-2.5 text-left">Items</th>
                <th className="px-4 py-2.5 text-right">Ordered</th>
                <th className="px-4 py-2.5 text-right bg-emerald-50/60 text-emerald-700">Received</th>
                <th className="px-5 py-2.5 text-right">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((line, idx) => {
                const variance = line.receivedQty - line.orderedQty;
                const varianceColor = variance < 0 ? '#B45309' : variance > 0 ? '#DC2626' : '#047857';
                return (
                  <tr key={idx} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[12px] text-slate-900" style={{ fontWeight: 600 }}>{line.sku}</span>
                        <span
                          className="inline-flex items-center px-1.5 py-px rounded text-[10px] border"
                          style={{
                            fontWeight: 600,
                            backgroundColor: line.serialized ? '#EEF2FF' : '#F1F5F9',
                            color: line.serialized ? '#4338CA' : '#475569',
                            borderColor: line.serialized ? '#C7D2FE' : '#E2E8F0',
                          }}
                        >
                          {line.serialized ? 'Serialized' : 'Non-Serialized'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 truncate" style={{ fontWeight: 500 }}>
                        {line.productName}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right text-foreground" style={{ fontWeight: 600 }}>
                      {line.orderedQty} <span className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>{line.uom}</span>
                    </td>
                    <td className="px-4 py-3 text-right bg-emerald-50/30">
                      <span className="text-emerald-700 " style={{ fontWeight: 700 }}>
                        {line.receivedQty} <span className="text-[10px]" style={{ fontWeight: 600 }}>{line.uom}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right " style={{ fontWeight: 600, color: varianceColor }}>
                      {variance === 0 ? ', ' : `${variance > 0 ? '+' : ''}${variance} ${line.uom}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#EEF2F6] bg-slate-50/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
            <span>
              Total Ordered: <span className="text-foreground " style={{ fontWeight: 700 }}>{totalOrdered}</span>
            </span>
            <span className="text-slate-300">·</span>
            <span>
              Total Received: <span className="text-emerald-700 " style={{ fontWeight: 700 }}>{totalReceived}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('#', '_blank')}
              className="h-9 px-3 text-[12px]"
              style={{ fontWeight: 500 }}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Open Full GRN
            </Button>
            <Button
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-9 px-4 text-[12px] bg-primary text-primary-foreground"
              style={{ fontWeight: 600 }}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
