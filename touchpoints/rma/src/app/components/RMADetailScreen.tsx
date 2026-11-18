import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  RotateCcw,
  Truck,
  PackageCheck,
  CheckCircle2,
  CheckCheck,
  FileEdit,
  Send,
  Replace,
  Undo2,
  CircleDollarSign,
  Paperclip,
  MessageSquare,
  Clock,
  Ban,
  Calculator,
  ExternalLink,
  Shuffle,
  StickyNote,
  Layers,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { StatusPill, type StatusPillStyle } from '@/app/components/data-table/StatusPill';
import { PhotoPersonAvatar } from '@/app/components/data-table/PersonAvatar';
import { EmptyState } from '@/app/components/EmptyState';
import { rmaStatusLabel, trackingModeFor, type RMA, type RMARefundExpectation, type RMAStatus, type RMAStatusLabel, type ReturnType as RMAReturnType } from '@/app/data/mockRMAs';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { BUCKET_CHIP, BUCKET_HINTS, BUCKET_LABELS } from '@/app/data/rmaReturnAllocation';
import { AttachmentsTab as RMAAttachmentsTab } from '@/app/components/rma/AttachmentsTab';
import { rmaAttachments, rmaAttachmentLines } from '@/app/components/rma/rmaAttachments';
import { palette } from '@/styles/tokens';
import { toast } from 'sonner';

const STATUS_STYLES: Record<RMAStatusLabel, StatusPillStyle> = {
  Draft: { bg: palette.slate[100], fg: palette.slate[600], border: palette.slate[300] },
  Sent: { bg: palette.blue[50], fg: palette.blue[700], border: palette.blue[200] },
  Approved: { bg: palette.indigo[50], fg: palette.indigo[700], border: palette.indigo[200] },
  'Shipped to Vendor': { bg: palette.amber[50], fg: palette.amber[700], border: palette.amber[300] },
  Closed: { bg: palette.emerald[50], fg: palette.emerald[700], border: palette.emerald[200] },
  'Closed with loss': { bg: palette.red[50], fg: palette.red[700], border: palette.red[200] },
  Cancelled: { bg: palette.red[50], fg: palette.red[700], border: palette.red[200] },
};

const RETURN_TYPE_ICON: Record<RMAReturnType, React.ComponentType<{ className?: string }>> = {
  'Refund/Credit': CircleDollarSign,
  Replacement: Replace,
  'Return Only': Undo2,
};

type TabKey =
  | 'items'
  | 'resolution'
  | 'shipment'
  | 'financial'
  | 'attachments'
  | 'communications'
  | 'activity';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'items', label: 'Items' },
  { key: 'resolution', label: 'Resolution & Terms' },
  { key: 'shipment', label: 'Shipment' },
  { key: 'financial', label: 'Financial' },
  { key: 'attachments', label: 'Attachments' },
  { key: 'communications', label: 'Communications' },
  { key: 'activity', label: 'Activity' },
];

interface RMADetailScreenProps {
  rma: RMA;
  onClose: () => void;
  applyAction: (rmaId: string, action: RMAActionId, payload?: RMAActionPayload) => void;
}

export type RMAActionId =
  | 'submit'
  | 'approve'
  | 'ship'
  /** Logs the goods back and settles the return in one step. */
  | 'close'
  | 'cancel'
  /** The same close with the arrival date and condition captured. */
  | 'receive-goods'
  | 'record-credit'
  /** The refund landing on a return whose receipt was already paid. */
  | 'record-refund'
  /** Money, or a credit memo in place of it, logged against a refund return.
   *  This is what closes the return: there is no close action of its own. */
  | 'log-settlement'
  /** The vendor refused the goods after they shipped: nothing is coming
   *  back, so the return's value is written off. */
  | 'record-refusal'
  | 'archive';

/** What the vendor authorized on one line. A zero `approvedQty` is a refusal. */
export interface RMALineApproval {
  lineId: string;
  approvedQty: number;
  /** Set when the vendor authorized a different return type than the one
   *  asked for, such as a replacement in place of a credit. */
  returnType?: RMAReturnType;
  note?: string;
}

export interface RMAActionPayload {
  reason?: string;
  vendorRMANumber?: string;
  /** Present on `approve`. Omitted when the vendor authorized the return as
   *  requested, which leaves every line's approved qty equal to what was asked. */
  lineApprovals?: RMALineApproval[];
  carrier?: string;
  returnShipTo?: string;
  receivedDate?: string;
  receivedCondition?: string;
  creditAmountReceived?: number;
  creditNoteRef?: string;
  /** The receipt the vendor issued with the credit, filed against the RMA. */
  creditReceiptFileName?: string;
  /** Present on `record-refund`: the day the money actually landed. */
  refundedDate?: string;
  /** Present on `log-settlement`: the refund payment being recorded. */
  settlement?: {
    kind: 'payment';
    amount: number;
    date: string;
    reference: string;
    method?: string;
    depositedToAccountId?: string;
    description?: string;
    fileName?: string;
    /** The user confirmed a short settlement should be written off. */
    lossAcknowledged?: boolean;
  };
  /** Present on a short `log-settlement`: the gap written off to RMA
   *  Settlement Loss, which closes the return as Closed with loss. */
  settlementLoss?: number;
  /** Present on a short `log-settlement` the user did not write off: a part
   *  payment, so the return stays open for the rest. */
  keepOpen?: boolean;
  /** Present on `log-settlement` when accounting added a charge the vendor
   *  kept back that was not on the return yet (ERP-8664). */
  addedCharges?: { id: number; type: string; amount: number; description?: string }[];
  /** Present on `approve`: what the vendor said about when and how they pay,
   *  taken down on the call that authorized the return. */
  refundExpectation?: RMARefundExpectation;
  /** Present on `approve`: what the vendor keeps back, as a percentage of the
   *  value of the goods. Zero where they charge nothing. */
  restockingPct?: number;
}

export function RMADetailScreen({ rma, onClose, applyAction }: RMADetailScreenProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('items');
  const [approveOpen, setApproveOpen] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const style = STATUS_STYLES[rmaStatusLabel(rma)];

  // Every line settles on its own terms — one unit can come back damaged for
  // credit while the next is a wrong part going out for replacement. The
  // header can only name a type when the lines agree on one.
  const lineTypes = useMemo(
    () => new Set(rma.items.map((li) => li.returnType ?? rma.returnType)),
    [rma.items, rma.returnType],
  );
  const mixedTypes = lineTypes.size > 1;
  const headerType = mixedTypes ? null : ([...lineTypes][0] ?? rma.returnType);
  const TypeIcon = headerType ? RETURN_TYPE_ICON[headerType] : Shuffle;

  const totalUnits = useMemo(
    () => rma.items.reduce((s, li) => s + li.returnQty, 0),
    [rma.items],
  );

  const totalValue = useMemo(
    () => rma.items.reduce((s, li) => s + li.returnQty * li.unitPrice, 0),
    [rma.items],
  );

  const primary = primaryActionFor(rma.status);
  const canCancel = rma.status !== 'Closed';

  const handlePrimary = () => {
    if (!primary) return;
    switch (primary.id) {
      case 'submit':
        applyAction(rma.id, 'submit');
        toast.success('Submitted for approval', {
          description: 'The RMA is awaiting approval.',
        });
        return;
      case 'approve':
        setApproveOpen(true);
        return;
      case 'ship':
        setShipOpen(true);
        return;
      case 'close':
        applyAction(rma.id, 'close');
        toast.success('Return closed', { description: 'The goods are back with the vendor and the return is settled.' });
        return;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Breadcrumb */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <button
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to RMAs
        </button>
      </div>

      {/* Header card */}
      <div className="mx-3 rounded-xl border border-border bg-white shrink-0 overflow-hidden">
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: palette.amber[50] }}
                >
                  <RotateCcw className="w-4 h-4" style={{ color: palette.amber[700] }} />
                </div>
                <h1 className="font-bold text-[20px] truncate" style={{ letterSpacing: '-0.01em' }}>
                  {rma.rmaNumber}
                </h1>
                <StatusPill label={rmaStatusLabel(rma)} style={style} />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
                <span>
                  Source PO:{' '}
                  <span className="text-slate-700" style={{ fontWeight: 500 }}>
                    {rma.sourcePO}
                  </span>
                </span>
                <span>·</span>
                <span>
                  Vendor:{' '}
                  <span className="text-slate-700" style={{ fontWeight: 500 }}>
                    {rma.vendor}
                  </span>
                </span>
                <span>·</span>
                <span className="inline-flex items-center gap-1.5">
                  Created by:
                  <PhotoPersonAvatar name={rma.owner} size="xs" />
                  <span className="text-slate-700" style={{ fontWeight: 500 }}>
                    {rma.owner}
                  </span>
                </span>
              </div>
            </div>

            {/* Action bar */}
            <div className="flex items-center gap-2 shrink-0">
              {canCancel && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  onClick={() => setCancelOpen(true)}
                >
                  <Ban className="w-3.5 h-3.5 mr-1.5" />
                  Cancel
                </Button>
              )}
              {primary && (
                <Button
                  size="sm"
                  className="h-9 bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={handlePrimary}
                >
                  <primary.Icon className="w-3.5 h-3.5 mr-1.5" />
                  {primary.label}
                </Button>
              )}
            </div>
          </div>

          {/* Key dates row */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-4 text-[12px]">
            <KeyDate label="Created" value={rma.createdDate} />
            <KeyDate label="Approved" value={rma.approvedDate} />
            <KeyDate label="Shipped" value={rma.shippedDate} />
            <KeyDate label="Received" value={rma.receivedDate} />
            <KeyDate label="Closed" value={rma.resolvedDate} />
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide border-t border-muted px-4">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 border-b-2 transition-all duration-200 whitespace-nowrap cursor-pointer text-[13px] ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
                style={{ fontWeight: isActive ? 600 : 400 }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {activeTab === 'items' && (
          <ItemsTab rma={rma} totalUnits={totalUnits} totalValue={totalValue} />
        )}
        {activeTab === 'resolution' && <ResolutionTab rma={rma} />}
        {activeTab === 'shipment' && <ShipmentTab rma={rma} />}
        {activeTab === 'financial' && <FinancialTab rma={rma} />}
        {activeTab === 'attachments' && <AttachmentsTab rma={rma} />}
        {activeTab === 'communications' && <CommunicationsTab />}
        {activeTab === 'activity' && <ActivityTab rma={rma} />}
      </div>

      {/* Modals */}
      <ApproveModal
        open={approveOpen}
        onOpenChange={setApproveOpen}
        rma={rma}
        onConfirm={(payload) => {
          applyAction(rma.id, 'approve', payload);
          setApproveOpen(false);
          toast.success('RMA approved', {
            description: 'Vendor authorization captured. Ready to ship.',
          });
        }}
      />
      <ShipModal
        open={shipOpen}
        onOpenChange={setShipOpen}
        rma={rma}
        onConfirm={(payload) => {
          applyAction(rma.id, 'ship', payload);
          setShipOpen(false);
          toast.success('Return shipped to vendor', {
            description: `Carrier ${payload.carrier}`,
          });
        }}
      />
      <CancelModal
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onConfirm={(reason) => {
          applyAction(rma.id, 'cancel', { reason });
          setCancelOpen(false);
          toast.success('RMA cancelled');
          onClose();
        }}
      />
    </div>
  );
}

function KeyDate({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide" style={{ fontWeight: 500 }}>
        {label}
      </div>
      <div className="text-slate-700 tabular-nums" style={{ fontWeight: 500 }}>
        {value ?? '—'}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────

function ItemsTab({
  rma,
  totalUnits,
  totalValue,
}: {
  rma: RMA;
  totalUnits: number;
  totalValue: number;
}) {
  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="text-[13px] text-slate-700" style={{ fontWeight: 600 }}>
          Items to return
        </div>
        <div className="text-[12px] text-muted-foreground">
          {rma.items.length} line{rma.items.length === 1 ? '' : 's'} · {totalUnits} unit
          {totalUnits === 1 ? '' : 's'} · $
          {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
            <TableHead>Item</TableHead>
            <TableHead className="w-[110px] text-right">Return qty</TableHead>
            <TableHead className="w-[100px] text-right">Received</TableHead>
            <TableHead className="w-[110px] text-right">Unit price</TableHead>
            <TableHead className="w-[110px] text-right">Line total</TableHead>
            <TableHead className="w-[140px]">Reason</TableHead>
            <TableHead className="w-[200px]">Serial / Lot</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rma.items.map((li) => {
            const serialized = trackingModeFor(li.sku) === 'serialized';
            const priceCorrected =
              li.originalUnitPrice != null &&
              Math.abs(li.originalUnitPrice - li.unitPrice) > 0.004;
            const files = li.attachments ?? [];
            const settlements = li.settlements && li.settlements.length > 1 ? li.settlements : undefined;
            const mixedReasons = settlements ? new Set(settlements.map((s) => s.reason)).size > 1 : false;
            return (
              <TableRow key={li.id} className="align-top">
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px]" style={{ fontWeight: 500 }}>
                        {li.sku}
                      </span>
                      <span
                        className="shrink-0 rounded-full px-1.5 py-px text-[10px] border"
                        style={{
                          backgroundColor: palette.slate[100],
                          color: palette.slate[500],
                          borderColor: palette.slate[200],
                          fontWeight: 600,
                        }}
                      >
                        {serialized ? 'Serialized' : 'Non-Serialized'}
                      </span>
                    </div>
                    <span className="text-[12px] text-muted-foreground truncate max-w-[380px]">
                      {li.description}
                    </span>
                    {/* Context and evidence captured against this line while the
                        return was built, kept with the line it explains. */}
                    {li.notes && (
                      <span className="flex items-start gap-1.5 text-[12px] text-slate-600 mt-1 max-w-[380px]">
                        <StickyNote className="w-3 h-3 mt-0.5 shrink-0 text-muted-foreground" />
                        {li.notes}
                      </span>
                    )}
                    {files.length > 0 && (
                      <span className="flex flex-wrap items-center gap-1.5 mt-1">
                        {files.map((f) => (
                          <span
                            key={f.name}
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px]"
                            style={{ backgroundColor: palette.slate[100], color: palette.slate[700] }}
                          >
                            <Paperclip className="w-2.5 h-2.5" />
                            {f.name}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {li.returnQty} {li.uom}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {li.receivedQty} {li.uom}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <div style={{ color: priceCorrected ? palette.amber[700] : undefined }}>
                    ${li.unitPrice.toFixed(2)}
                  </div>
                  {priceCorrected && (
                    <div className="text-[11px] text-muted-foreground line-through tabular-nums">
                      ${li.originalUnitPrice!.toFixed(2)}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  ${(li.returnQty * li.unitPrice).toFixed(2)}
                </TableCell>
                <TableCell>
                  {/* Goods billed in several invoice states settle several ways
                      at once, and the cell has room for one answer. The chip
                      says how many, the card behind it says what each one is. */}
                  {settlements ? (
                    <HoverCard openDelay={150} closeDelay={120}>
                      <HoverCardTrigger asChild>
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] whitespace-nowrap cursor-help"
                          style={{ backgroundColor: palette.blue[50], color: palette.blue[700], fontWeight: 500 }}
                        >
                          <Layers className="w-3 h-3" />
                          {settlements.length} states
                        </span>
                      </HoverCardTrigger>
                      <HoverCardContent side="left" align="start" className="w-[320px] p-3">
                        <p className="text-[11px] text-slate-500 leading-snug mb-2">
                          These units were billed in different states, so each one settles on its own
                          terms.
                        </p>
                        <div className="space-y-2">
                          {settlements.map((s) => {
                            return (
                              <div key={s.state} className="space-y-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`inline-flex items-center px-1.5 py-px rounded-full text-[10px] border ${BUCKET_CHIP[s.state]}`}
                                    style={{ fontWeight: 600 }}
                                  >
                                    {BUCKET_LABELS[s.state]}
                                  </span>
                                  <span className="text-[11px] text-slate-600 tabular-nums" style={{ fontWeight: 600 }}>
                                    {s.qty} {li.uom}
                                  </span>
                                  <span className="ml-auto text-[11px] text-slate-600 tabular-nums" style={{ fontWeight: 600 }}>
                                    ${(s.qty * s.unitPrice).toFixed(2)}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 leading-snug">
                                  {s.reason} · {BUCKET_HINTS[s.state]}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  ) : null}
                </TableCell>
                <TableCell>
                  <span className="text-[12px] text-slate-600">
                    {mixedReasons ? 'Mixed' : li.reason}
                  </span>
                </TableCell>
                <TableCell>
                  {li.serialNumbers && li.serialNumbers.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {li.serialNumbers.slice(0, 3).map((sn) => (
                        <span
                          key={sn}
                          className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-mono"
                          style={{ backgroundColor: palette.slate[100], color: palette.slate[700] }}
                        >
                          {sn}
                        </span>
                      ))}
                      {li.serialNumbers.length > 3 && (
                        <span className="text-[11px] text-muted-foreground">
                          +{li.serialNumbers.length - 3}
                        </span>
                      )}
                    </div>
                  ) : li.lots && li.lots.length > 0 ? (
                    <div className="flex flex-col gap-0.5">
                      {li.lots.map((l) => (
                        <span key={l.lot} className="text-[11px] font-mono text-slate-600">
                          {l.lot} · {l.qty} {li.uom}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function ResolutionTab({ rma }: { rma: RMA }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card title="Return details">
        {/* Type and reason are settled per line, so this states how the
            lines divide rather than naming one answer for the return. */}
        <Field label="Return reasons" value={<Breakdown counts={countBy(rma.items, (li) => li.reason)} />} multiline />
        <Field label="Notes" value={rma.notes ?? '—'} multiline />
      </Card>
      <Card title="Vendor authorization">
        <Field label="Vendor RMA number" value={rma.vendorRMANumber ?? '—'} />
      </Card>
      <Card title="Credit terms">
        <Field
          label="Resolution"
          value={rma.creditTerms?.refundOrCredit ?? '—'}
        />
        <Field
          label="Credit %"
          value={rma.creditTerms?.creditPct != null ? `${rma.creditTerms.creditPct}%` : '—'}
        />
        <Field
          label="Restocking fee"
          value={rma.creditTerms?.restockingFee != null ? `${rma.creditTerms.restockingFee}%` : '—'}
        />
      </Card>
    </div>
  );
}

function countBy<T>(rows: T[], key: (row: T) => string): Array<[string, number]> {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const k = key(row);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function Breakdown({ counts }: { counts: Array<[string, number]> }) {
  if (counts.length === 0) return <>—</>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {counts.map(([label, n]) => (
        <span
          key={label}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px]"
          style={{ backgroundColor: palette.slate[100], color: palette.slate[700] }}
        >
          {label}
          <span className="tabular-nums text-muted-foreground">
            {n} line{n === 1 ? '' : 's'}
          </span>
        </span>
      ))}
    </div>
  );
}

function ShipmentTab({ rma }: { rma: RMA }) {
  const hasShipment =
    rma.status === 'Shipped to Vendor' ||
    rma.status === 'Closed';
  if (!hasShipment) {
    return (
      <div className="border border-border rounded-xl bg-card">
        <EmptyState
          icon={Truck}
          title="No shipment yet"
          description="A return shipment surfaces here once you execute Ship Now on this RMA."
        />
      </div>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card title="Return shipment">
        <Field label="Carrier" value={rma.carrier ?? '—'} />
        <Field label="Ship-to" value={rma.returnShipTo ?? '—'} multiline />
      </Card>
      <Card title="Freight">
        <Field label="Arranged by" value={rma.freightArrangedBy ?? '—'} />
        <Field label="Paid by" value={rma.freightPaidBy ?? '—'} />
      </Card>
      <Card title="Documents">
        <ul className="text-[12px] text-slate-600 space-y-1.5">
          <li className="flex items-center gap-2">
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" /> Pick list
          </li>
          <li className="flex items-center gap-2">
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" /> Packing slip
          </li>
          <li className="flex items-center gap-2">
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" /> Bill of lading
          </li>
          <li className="flex items-center gap-2">
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" /> Shipping label
          </li>
        </ul>
      </Card>
    </div>
  );
}

function FinancialTab({ rma }: { rma: RMA }) {
  return (
    <div className="border border-border rounded-xl bg-card">
      <EmptyState
        icon={Calculator}
        title="Financial entries post automatically"
        description={
          rma.status === 'Draft' || rma.status === 'Sent'
            ? 'Reclass entries appear here once the RMA is approved and shipped. Finance verifies — nothing is keyed here.'
            : rma.status === 'Approved'
              ? 'Reclass to a held inventory account will post once the return shipment leaves the dock.'
              : rma.status === 'Shipped to Vendor'
                ? 'Reclass to an off-site "at vendor" account posted on ship. Reversal posts on return receipt; credit posts on resolution.'
                : 'All auto-posted GL entries will appear here for finance verification.'
        }
      />
    </div>
  );
}

/* Attachments tab, ported from the Purchase Order module. The RMA model
   carries only a thin `{ name }[]` list, so `rmaAttachments` widens it into
   the richer shape the ported tab reads and seeds the rest. */
function AttachmentsTab({ rma }: { rma: RMA }) {
  const attachments = useMemo(() => rmaAttachments(rma), [rma]);
  const lines = useMemo(() => rmaAttachmentLines(rma), [rma]);
  return (
    <RMAAttachmentsTab
      attachments={attachments}
      lines={lines}
      rmaStatus={rma.status}
      rmaId={rma.id}
    />
  );
}

function CommunicationsTab() {
  return (
    <div className="border border-border rounded-xl bg-card">
      <EmptyState
        icon={MessageSquare}
        title="Communications ship with the Communications module"
        description="Vendor threads, emails, and shared notes surface here once the Communications module ships."
      />
    </div>
  );
}

function ActivityTab({ rma }: { rma: RMA }) {
  const entries = rma.actionHistory ?? [];
  if (entries.length === 0) {
    return (
      <div className="border border-border rounded-xl bg-card">
        <EmptyState
          icon={Clock}
          title="No activity yet"
          description="Every status change and edit lands here for the audit trail."
        />
      </div>
    );
  }
  return (
    <div className="border border-border rounded-xl bg-card p-4">
      <ol className="relative border-l border-border ml-3 space-y-4">
        {[...entries].reverse().map((e, i) => (
          <li key={i} className="ml-4">
            <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-white border-2 border-primary" />
            <div className="flex items-center gap-2 text-[13px]">
              <span style={{ fontWeight: 500 }}>{friendlyAction(e.action)}</span>
              <span className="text-muted-foreground">by {e.by}</span>
            </div>
            <div className="text-[11px] text-muted-foreground tabular-nums">
              {new Date(e.at).toLocaleString()}
            </div>
            {e.reason && (
              <div className="mt-1 text-[12px] text-slate-600 italic">"{e.reason}"</div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function friendlyAction(action: string): string {
  switch (action) {
    case 'create': return 'RMA created';
    case 'submit': return 'Submitted for approval';
    case 'approve': return 'RMA approved';
    case 'ship': return 'Return shipped to vendor';
    case 'close': return 'Return closed';
    case 'receive-goods': return 'Return closed';
    case 'cancel': return 'RMA cancelled';
    default: return action;
  }
}

// ─────────────────────────────────────────────────────────────
// Helpers + modals
// ─────────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-xl bg-card p-4">
      <div className="text-[13px] text-slate-700 mb-3" style={{ fontWeight: 600 }}>
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, value, multiline }: { label: string; value: React.ReactNode; multiline?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide" style={{ fontWeight: 500 }}>
        {label}
      </div>
      <div className={`text-[13px] text-slate-700 ${multiline ? '' : 'truncate'}`} style={{ fontWeight: 500 }}>
        {value}
      </div>
    </div>
  );
}

function primaryActionFor(status: RMAStatus): { id: RMAActionId; label: string; Icon: React.ComponentType<{ className?: string }> } | null {
  switch (status) {
    case 'Draft':
      return { id: 'submit', label: 'Send to vendor', Icon: Send };
    case 'Sent':
      return { id: 'approve', label: 'Approve', Icon: CheckCircle2 };
    case 'Approved':
      return { id: 'ship', label: 'Ship Now', Icon: Truck };
    case 'Shipped to Vendor':
      return { id: 'close', label: 'Close return', Icon: PackageCheck };
    default:
      return null;
  }
}

function ApproveModal({
  open,
  onOpenChange,
  rma,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rma: RMA;
  onConfirm: (payload: RMAActionPayload) => void;
}) {
  const [vendorRMANumber, setVendorRMANumber] = useState(rma.vendorRMANumber ?? '');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Approve RMA</DialogTitle>
          <DialogDescription>
            Record what the vendor sent back (RMA number, email confirmation, or a note) so the audit trail is complete.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="vendor-rma">Vendor RMA number</Label>
            <Input
              id="vendor-rma"
              value={vendorRMANumber}
              onChange={(e) => setVendorRMANumber(e.target.value)}
              placeholder="V-RMA-0088123"
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onConfirm({
                vendorRMANumber: vendorRMANumber.trim() || undefined,
              })
            }
          >
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShipModal({
  open,
  onOpenChange,
  rma,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rma: RMA;
  onConfirm: (payload: RMAActionPayload) => void;
}) {
  const [carrier, setCarrier] = useState(rma.carrier ?? '');
  const [shipTo, setShipTo] = useState(rma.returnShipTo ?? `${rma.vendor} Returns Dept`);
  const canShip = carrier.trim();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ship return to vendor</DialogTitle>
          <DialogDescription>
            The return shipment leaves the dock with these carrier details. Value reclassifies to an off-site "at vendor" account on ship.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="carrier">Carrier</Label>
            <Input
              id="carrier"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="FedEx Freight"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="ship-to">Return ship-to</Label>
            <Textarea
              id="ship-to"
              value={shipTo}
              onChange={(e) => setShipTo(e.target.value)}
              rows={2}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!canShip}
            onClick={() =>
              onConfirm({
                carrier: carrier.trim(),
                returnShipTo: shipTo.trim() || undefined,
              })
            }
          >
            Ship Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelModal({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel RMA</DialogTitle>
          <DialogDescription>
            Quarantined units release back to on-hand and the RMA closes. This can't be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Label htmlFor="cancel-reason">Reason</Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this RMA being cancelled?"
            rows={3}
            className="mt-1"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button
            variant="destructive"
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            Cancel RMA
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
