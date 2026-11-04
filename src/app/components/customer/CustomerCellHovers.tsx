import type { ReactNode } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Clock,
  FileText,
  Flag,
  Layers,
  Lock,
  Mail,
  Package,
  Send,
  Truck,
  Wallet,
} from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import {
  Tooltip as PTooltip,
  TooltipContent as PTooltipContent,
  TooltipTrigger as PTooltipTrigger,
} from '@/app/components/ui/tooltip';
import { PhotoPersonAvatar } from '@/app/components/data-table';
import { highlightText } from '@/app/components/InvoiceDataTable';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { ITEMS_MODULE_URL, LineItemImage, imageForSku } from '@/app/components/customer/form/VendorFormKit';
import { formatUsDate, formatUsDateTime } from '@/app/lib/dueBucket';
import type { CustomerInvoice } from '@/app/data/ar/mockCustomerInvoices';
import { showsExceptionStatus } from '@/app/data/ar/customerInvoiceStatus';
import {
  findQuote,
  findSalesOrder,
  findShipment,
  type CustomerShipment,
  type CustomerShipmentLine,
} from '@/app/data/ar/mockCustomers';
import { availableQty, type DueStage, type LineBilling } from '@/app/data/ar/arBilling';

/* ─── Cell hover surfaces for the Customer Invoicing listings. Every one
 *  wears a vendor recipe verbatim: the dark-slate quick card of
 *  VendorQuickCard / CreatedByCell (rounded-xl, soft shadow, footer
 *  strip), the PaymentHoldLock flag card, and the white date tooltip of
 *  the vendor invoice cards. Only the data is AR. */

const money = (n: number, currency = 'USD') => {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(n);
  } catch {
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
};

const QUICK_CARD_CLASS = 'p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden w-[280px] z-[300]';

/** Dark-slate header of the vendor quick cards. */
function QuickHeader({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
      <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
      <div className="flex items-center gap-3 relative">
        <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-white">{icon}</div>
        <div className="min-w-0">
          <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{title}</p>
          <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function QuickRow({ icon: Icon, children }: { icon: typeof Truck; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
      <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <span className="truncate min-w-0">{children}</span>
    </div>
  );
}

function HoverShell({ trigger, children, side = 'bottom' }: { trigger: ReactNode; children: ReactNode; side?: 'bottom' | 'top' }) {
  return (
    <HoverCard openDelay={300} closeDelay={120}>
      <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
      <HoverCardContent side={side} align="start" sideOffset={6} className={QUICK_CARD_CLASS} onClick={(e) => e.stopPropagation()}>
        {children}
      </HoverCardContent>
    </HoverCard>
  );
}

/* ─── Shipment quick card — the AR mirror of the vendor receiving-document
 *  hover: ship date, carrier, lines and value, plus the order it ships. */
export function ShipmentQuickCard({ shipment }: { shipment: CustomerShipment }) {
  const units = shipment.lines.reduce((s, l) => s + l.shippedQty, 0);
  const currency = findSalesOrder(shipment.soNumber)?.so.currency;
  return (
    <div>
      <QuickHeader
        icon={<Truck className="w-4 h-4" />}
        title={shipment.shipmentNumber}
        subtitle={`Shipment · ${shipment.status}`}
      />
      <div className="bg-white px-4 py-3 space-y-2">
        <QuickRow icon={CalendarDays}>Shipped {formatUsDate(shipment.shipDate)}</QuickRow>
        <QuickRow icon={Truck}>{shipment.carrier || 'No carrier recorded'}</QuickRow>
        <QuickRow icon={Layers}>
          {shipment.lines.length} line{shipment.lines.length === 1 ? '' : 's'} · {units.toLocaleString('en-US')} unit{units === 1 ? '' : 's'}
        </QuickRow>
        <QuickRow icon={FileText}>Sales Order {shipment.soNumber}</QuickRow>
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-slate-500">Shipment Value</span>
          <span className="text-[12px] text-slate-900" style={{ fontWeight: 500 }}>{money(shipment.totalValue, currency)}</span>
        </div>
      </div>
    </div>
  );
}

/** Wraps a trigger (a SHP chip or a source cell) in the shipment hover. */
export function ShipmentHover({ shipmentNumber, children }: { shipmentNumber: string; children: ReactNode }) {
  const hit = findShipment(shipmentNumber);
  if (!hit) return <>{children}</>;
  return (
    <HoverShell trigger={children}>
      <ShipmentQuickCard shipment={hit.shipment} />
    </HoverShell>
  );
}

/* ─── Quote quick card (advances raised from a quote). */
export function QuoteHover({ quoteNumber, children }: { quoteNumber: string; children: ReactNode }) {
  const hit = findQuote(quoteNumber);
  if (!hit) return <>{children}</>;
  const q = hit.quote;
  return (
    <HoverShell trigger={children}>
      <QuickHeader icon={<FileText className="w-4 h-4" />} title={q.quoteNumber} subtitle={`Quote · ${q.status}`} />
      <div className="bg-white px-4 py-3 space-y-2">
        <QuickRow icon={CalendarDays}>Quoted {formatUsDate(q.quoteDate)}, expires {formatUsDate(q.expiresOn)}</QuickRow>
        <QuickRow icon={Layers}>{q.lines.length} line{q.lines.length === 1 ? '' : 's'}</QuickRow>
        {q.convertedToSO && <QuickRow icon={FileText}>Converted to sales order {q.convertedToSO}</QuickRow>}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-slate-500">Quote Value</span>
          <span className="text-[12px] text-slate-900" style={{ fontWeight: 500 }}>{money(q.totalValue, q.currency)}</span>
        </div>
      </div>
    </HoverShell>
  );
}

/* ─── Advance stage quick card (Ready to Invoice ADV rows). */
export function AdvanceStageHover({
  stage,
  soNumber,
  currency,
  children,
}: {
  stage: DueStage;
  soNumber: string;
  currency: string;
  children: ReactNode;
}) {
  return (
    <HoverShell trigger={children}>
      <QuickHeader
        icon={<Wallet className="w-4 h-4" />}
        title={`Stage ${stage.stage.index} of ${stage.total}`}
        subtitle={`Advance Stage · Sales Order ${soNumber}`}
      />
      <div className="bg-white px-4 py-3 space-y-2">
        <QuickRow icon={Wallet}>{stage.stage.percent}% of the order at {stage.stage.trigger}</QuickRow>
        <QuickRow icon={CalendarDays}>Fell due {formatUsDate(stage.dueOn)}</QuickRow>
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-slate-500">Stage Amount</span>
          <span className="text-[12px] text-slate-900" style={{ fontWeight: 500 }}>{money(stage.amount, currency)}</span>
        </div>
      </div>
    </HoverShell>
  );
}

/* ─── Lines to bill as items: the partner item cell (thumbnail + item code
 *  that opens the item in a new tab, black turning blue) with a "+N more"
 *  that opens the Lines to bill detail hover. Falls back to "N lines"
 *  when the shipment's lines can't be resolved. */
export function LinesToBillItemsCell({
  shipmentNumber,
  billing,
  currency,
  lineCount,
  searchQuery,
}: {
  shipmentNumber?: string;
  billing: Map<string, LineBilling>;
  currency: string;
  lineCount: number;
  searchQuery?: string;
}) {
  const hit = shipmentNumber ? findShipment(shipmentNumber) : undefined;
  const lines = hit
    ? hit.shipment.lines
        .map((line) => ({ line, avail: availableQty(line, billing) }))
        .filter((x) => x.avail > 0)
    : [];
  if (lines.length === 0) {
    return (
      <LinesToBillHover shipmentNumber={shipmentNumber} billing={billing} currency={currency}>
        <span className="text-foreground cursor-default" style={{ fontWeight: 400 }}>
          {highlightText(`${lineCount} line${lineCount === 1 ? '' : 's'}`, searchQuery)}
        </span>
      </LinesToBillHover>
    );
  }
  const first = lines[0].line;
  const more = lines.length - 1;
  const openItem = () => window.open(ITEMS_MODULE_URL, '_blank', 'noopener,noreferrer');
  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <LineItemImage sku={first.sku} src={imageForSku(first.sku)} alt={first.sku} onPreview={openItem} />
      {/* The partner PO listing's Items cell: the first code in full at the
          row's own font size, then "+N more" in the partner blue. */}
      <span
        role="link"
        onClick={openItem}
        className="ml-0.5 whitespace-nowrap shrink-0 text-foreground hover:text-primary hover:underline transition-colors cursor-pointer"
        style={{ fontWeight: 400 }}
        title="Open item in a new tab"
      >
        {highlightText(first.sku, searchQuery)}
      </span>
      {more > 0 && (
        <LinesToBillHover shipmentNumber={shipmentNumber} billing={billing} currency={currency}>
          <span className="text-[11px] shrink-0 whitespace-nowrap cursor-default leading-none" style={{ fontWeight: 600, color: '#085FCC' }}>
            +{more} more
          </span>
        </LinesToBillHover>
      )}
    </div>
  );
}

/* ─── Lines to bill hover: each line still open on the shipment with the
 *  quantity available to bill. */
export function LinesToBillHover({
  shipmentNumber,
  billing,
  currency,
  children,
}: {
  shipmentNumber?: string;
  billing: Map<string, LineBilling>;
  currency: string;
  children: ReactNode;
}) {
  const hit = shipmentNumber ? findShipment(shipmentNumber) : undefined;
  if (!hit) return <>{children}</>;
  const lines: { line: CustomerShipmentLine; avail: number }[] = hit.shipment.lines
    .map((line) => ({ line, avail: availableQty(line, billing) }))
    .filter((x) => x.avail > 0);
  if (lines.length === 0) return <>{children}</>;
  return (
    <HoverCard openDelay={300} closeDelay={120}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden w-[320px] z-[300]"
        onClick={(e) => e.stopPropagation()}
      >
        <QuickHeader
          icon={<Package className="w-4 h-4" />}
          title={`${lines.length} Line${lines.length === 1 ? '' : 's'} to Bill`}
          subtitle={`${hit.shipment.shipmentNumber} · Sales Order ${hit.shipment.soNumber}`}
        />
        <div className="bg-white divide-y divide-slate-100 max-h-[260px] overflow-y-auto">
          {lines.map(({ line, avail }) => (
            <div key={line.id} className="px-4 py-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-md border border-border bg-slate-50 overflow-hidden shrink-0">
                  <ImageWithFallback src={imageForSku(line.sku)} alt={line.sku} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] text-slate-800 truncate" style={{ fontWeight: 500 }}>{line.sku}</p>
                  <p className="text-[11px] text-slate-500 truncate">{line.description}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[12px] text-slate-800" style={{ fontWeight: 500 }}>
                  {avail.toLocaleString('en-US')} of {line.shippedQty.toLocaleString('en-US')} {line.uom}
                </p>
                <p className="text-[11px] text-slate-500">{money(avail * line.unitPrice, currency)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-slate-50/60 border-t border-border/40 px-4 py-2 text-[11px] text-slate-500">
          Quantity available to bill, of the quantity shipped.
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

/* ─── Days Waiting tooltip: a tone-tinted clock, the headline, a three-band
 *  meter (0 to 14 days, 15 to 30, over 30) with a marker at this row, and
 *  the urgency note. */
export function WaitingTooltip({
  days,
  headline,
  note,
  children,
}: {
  days: number;
  headline: string;
  note: string;
  children: ReactNode;
}) {
  const tone = days > 30 ? 'red' : days > 14 ? 'amber' : 'slate';
  const T = {
    red: { tile: 'bg-red-50 text-red-600', note: 'bg-red-50 text-red-700 border-red-100' },
    amber: { tile: 'bg-amber-50 text-amber-600', note: 'bg-amber-50 text-amber-700 border-amber-100' },
    slate: { tile: 'bg-slate-100 text-slate-500', note: 'bg-slate-50 text-slate-500 border-slate-100' },
  }[tone];
  // Marker position across a 0 to 45 day scale, bands at 14 and 30.
  const SCALE = 45;
  const pct = Math.min(days, SCALE) / SCALE * 100;
  return (
    <PTooltip delayDuration={200}>
      <PTooltipTrigger asChild>{children}</PTooltipTrigger>
      <PTooltipContent
        side="top"
        className="p-0 w-[260px] bg-white border border-slate-200/70 rounded-xl shadow-[0_12px_32px_-8px_rgba(15,23,42,0.18),0_2px_6px_rgba(15,23,42,0.05)] overflow-hidden"
      >
        <div className="px-3.5 pt-3 pb-3">
          <div className="flex items-start gap-2.5">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${T.tile}`}>
              <Clock className="w-3.5 h-3.5" />
            </div>
            <p className="text-[12px] text-slate-800 leading-snug pt-0.5" style={{ fontWeight: 500 }}>{headline}</p>
          </div>
          <div className="mt-3">
            <div className="relative h-1.5 rounded-full overflow-hidden flex">
              <div className="h-full bg-slate-200" style={{ width: `${14 / SCALE * 100}%` }} />
              <div className="h-full bg-amber-200" style={{ width: `${16 / SCALE * 100}%` }} />
              <div className="h-full bg-red-200 flex-1" />
            </div>
            <div className="relative h-0">
              <span
                className={`absolute -top-[9px] w-3 h-3 rounded-full border-2 border-white shadow-sm ${tone === 'red' ? 'bg-red-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-slate-500'}`}
                style={{ left: `calc(${pct}% - 6px)` }}
              />
            </div>
            <div className="relative mt-1.5 h-3 text-[10px] text-slate-400">
              <span className="absolute left-0">0</span>
              <span className="absolute -translate-x-1/2" style={{ left: `${14 / SCALE * 100}%` }}>14</span>
              <span className="absolute -translate-x-1/2" style={{ left: `${30 / SCALE * 100}%` }}>30</span>
            </div>
          </div>
          <p className={`mt-2.5 text-[11px] leading-snug rounded-lg border px-2.5 py-1.5 ${T.note}`} style={{ fontWeight: tone === 'slate' ? 400 : 500 }}>
            {note}
          </p>
        </div>
      </PTooltipContent>
    </PTooltip>
  );
}

/* ─── White date tooltip — the vendor invoice card's Due Date hover. */
export function DateTooltip({ children, lines }: { children: ReactNode; lines: { text: string; color?: string; strong?: boolean }[] }) {
  return (
    <PTooltip delayDuration={200}>
      <PTooltipTrigger asChild>{children}</PTooltipTrigger>
      <PTooltipContent side="top" className="px-2.5 py-1.5 bg-white border border-border rounded-lg shadow-md max-w-[260px]">
        {lines.map((l, i) => (
          <p
            key={i}
            className={`text-[11px] leading-snug ${i > 0 ? 'mt-0.5' : ''}`}
            style={{ fontWeight: l.strong ? 600 : 400, color: l.color ?? '#475569' }}
          >
            {l.text}
          </p>
        ))}
      </PTooltipContent>
    </PTooltip>
  );
}

/* ─── Sent On cell: the date, with who sent it and to whom on hover
 *  (from the send log). Sent is a flag, never a status (PRD §14). */
export function SentOnCell({ invoice, searchQuery }: { invoice: CustomerInvoice; searchQuery?: string }) {
  if (!invoice.sentAt) return null;
  const log = [...(invoice.sendLog ?? [])].filter((r) => r.outcome === 'sent');
  const last = log[log.length - 1];
  const text = <span className="text-muted-foreground whitespace-nowrap cursor-default">{highlightText(formatUsDate(invoice.sentAt), searchQuery)}</span>;
  if (!last) return text;
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <HoverCard openDelay={300} closeDelay={120}>
        <HoverCardTrigger asChild>{text}</HoverCardTrigger>
        <HoverCardContent
          side="bottom"
          align="start"
          sideOffset={6}
          className="w-[300px] p-0 rounded-xl border border-border/60 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[300]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* PaymentHoldLock card anatomy: header, body, who-and-when footer. */}
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-blue-50/70 border-b border-blue-100">
            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <Send className="w-3.5 h-3.5 text-blue-700" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] text-slate-900 leading-tight" style={{ fontWeight: 500 }}>
                Sent to the Customer
              </p>
              <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                {log.length > 1 ? `Sent ${log.length} times, latest shown` : formatUsDateTime(last.at, invoice.id)}
              </p>
            </div>
          </div>
          <div className="px-3.5 py-3 space-y-2.5 bg-white">
            <div>
              <p className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>To</p>
              {last.to.map((addr) => (
                <p key={addr} className="mt-0.5 flex items-center gap-1.5 text-[12px] text-slate-700 truncate">
                  <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                  {addr}
                </p>
              ))}
            </div>
            {last.cc.length > 0 && (
              <div>
                <p className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Cc</p>
                <p className="mt-0.5 text-[12px] text-slate-700 leading-snug">{last.cc.join(', ')}</p>
              </div>
            )}
            {last.subject && (
              <div>
                <p className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Subject</p>
                <p className="mt-0.5 text-[12px] text-slate-700 leading-snug">{last.subject}</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-slate-50/70 border-t border-border/50">
            <PhotoPersonAvatar name={last.by} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-slate-800 truncate leading-tight" style={{ fontWeight: 500 }}>{last.by}</p>
              <p className="text-[11px] text-slate-500 leading-tight mt-0.5">Sent the invoice</p>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
              <CalendarDays className="w-3 h-3 text-slate-400" />
              {formatUsDate(last.at)}
            </span>
          </div>
        </HoverCardContent>
      </HoverCard>
    </span>
  );
}

/* ─── Credit hold lock — the AR fork of PaymentHoldLock: a yellow lock
 *  beside the Invoice ID while the invoice is on credit hold (a flag, not
 *  a status). Hover names who placed it and why. */
export function CreditHoldLock({ invoice, size = 14 }: { invoice: CustomerInvoice; size?: number }) {
  if (!invoice.creditHold) return null;
  const hold = [...(invoice.actionHistory ?? [])].reverse().find((e) => e.action === 'creditHold');
  return (
    <HoverCard openDelay={300} closeDelay={120}>
      <HoverCardTrigger asChild>
        <span
          role="img"
          aria-label="On Credit Hold"
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
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-yellow-50/70 border-b border-yellow-100">
          <div className="w-7 h-7 rounded-lg bg-yellow-100 flex items-center justify-center shrink-0">
            <Lock className="w-3.5 h-3.5 text-yellow-700" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] text-slate-900 leading-tight" style={{ fontWeight: 500 }}>
              On Credit Hold
            </p>
            <p className="text-[11px] text-slate-500 leading-tight mt-0.5">New billing for this customer waits until it is released</p>
          </div>
        </div>
        {hold?.reason && (
          <div className="px-3.5 py-3 space-y-2.5 bg-white">
            <div>
              <p className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Note</p>
              <p className="mt-0.5 text-[12px] text-slate-700 leading-snug">{hold.reason}</p>
            </div>
          </div>
        )}
        {hold && (
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-slate-50/70 border-t border-border/50">
            <PhotoPersonAvatar name={hold.by} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-slate-800 truncate leading-tight" style={{ fontWeight: 500 }}>{hold.by}</p>
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

/* ─── Dispute and exception flags (FAD 11/2): the CreditHoldLock recipe
 *  beside the Invoice ID. Disputed wears rose, Exception amber. The hover
 *  names the reason, the note, and who flagged it. */
function splitFlagReason(text: string | undefined): { reason?: string; note?: string } {
  if (!text) return {};
  const idx = text.indexOf(': ');
  return idx > 0 ? { reason: text.slice(0, idx), note: text.slice(idx + 2) } : { reason: text };
}

const FLAG_TONES = {
  disputed: {
    icon: Flag,
    label: 'Disputed',
    sub: 'The customer is contesting this invoice',
    trigger: 'text-rose-600 hover:bg-rose-100 hover:text-rose-700',
    strip: 'bg-rose-50/70 border-rose-100',
    tile: 'bg-rose-100',
    tileIcon: 'text-rose-700',
    chip: 'bg-rose-100 text-rose-700',
    by: 'Flagged the dispute',
  },
  exception: {
    icon: AlertTriangle,
    label: 'Exception',
    sub: 'Something on this invoice needs a look',
    trigger: 'text-amber-600 hover:bg-amber-100 hover:text-amber-700',
    strip: 'bg-amber-50/70 border-amber-100',
    tile: 'bg-amber-100',
    tileIcon: 'text-amber-700',
    chip: 'bg-amber-100 text-amber-700',
    by: 'Flagged the exception',
  },
} as const;

function InvoiceFlagHover({ kind, invoice, size }: { kind: keyof typeof FLAG_TONES; invoice: CustomerInvoice; size: number }) {
  const tone = FLAG_TONES[kind];
  const Icon = tone.icon;
  const historyAction = kind === 'disputed' ? 'markDisputed' : 'flagException';
  const fromHistory = [...(invoice.actionHistory ?? [])].reverse().find((e) => e.action === historyAction);
  const detail = (kind === 'disputed' ? invoice.disputeDetail : invoice.exception) ?? fromHistory;
  const { reason, note } = splitFlagReason(detail?.reason);
  return (
    <HoverCard openDelay={300} closeDelay={120}>
      <HoverCardTrigger asChild>
        <span
          role="img"
          aria-label={tone.label}
          className={`inline-flex shrink-0 items-center justify-center rounded p-0.5 transition-colors cursor-default ${tone.trigger}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Icon style={{ width: size, height: size }} strokeWidth={2.25} />
        </span>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="w-[300px] p-0 rounded-xl border border-border/60 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[300]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center gap-2.5 px-3.5 py-2.5 border-b ${tone.strip}`}>
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tone.tile}`}>
            <Icon className={`w-3.5 h-3.5 ${tone.tileIcon}`} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] text-slate-900 leading-tight" style={{ fontWeight: 500 }}>{tone.label}</p>
            <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{tone.sub}</p>
          </div>
        </div>
        {(reason || note) && (
          <div className="px-3.5 py-3 space-y-2.5 bg-white">
            {reason && (
              <div>
                <p className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Reason</p>
                <span className={`mt-1 inline-flex px-1.5 py-px rounded-md text-[11px] ${tone.chip}`} style={{ fontWeight: 500 }}>{reason}</span>
              </div>
            )}
            {note && (
              <div>
                <p className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Note</p>
                <p className="mt-0.5 text-[12px] text-slate-700 leading-snug">{note}</p>
              </div>
            )}
          </div>
        )}
        {detail && (
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-slate-50/70 border-t border-border/50">
            <PhotoPersonAvatar name={detail.by} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-slate-800 truncate leading-tight" style={{ fontWeight: 500 }}>{detail.by}</p>
              <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{tone.by}</p>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
              <CalendarDays className="w-3 h-3 text-slate-400" />
              {formatUsDate(detail.at)}
            </span>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

/** Disputed (rose flag) and Exception (amber triangle) beside the Invoice ID. */
export function InvoiceFlagIcons({ invoice, size = 14 }: { invoice: CustomerInvoice; size?: number }) {
  // An exception that reads as the Status (vendor parity, 11/3) needs no icon.
  const exceptionIcon = !!invoice.exception && !showsExceptionStatus(invoice);
  if (!invoice.disputed && !exceptionIcon) return null;
  return (
    <>
      {invoice.disputed && <InvoiceFlagHover kind="disputed" invoice={invoice} size={size} />}
      {exceptionIcon && <InvoiceFlagHover kind="exception" invoice={invoice} size={size} />}
    </>
  );
}
