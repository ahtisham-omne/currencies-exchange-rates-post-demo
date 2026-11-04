import type { DataTableEmptyConfig } from '@/app/components/data-table/DataTable';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { useArPermissions } from '@/app/hooks/useArSettings';
import {
  AlertTriangle,
  ArrowRightLeft,
  Ban,
  CheckCircle2,
  CheckCheck,
  Copy,
  DollarSign,
  Download,
  Edit3,
  Eraser,
  ExternalLink,
  Eye,
  FileText,
  GitCompare,
  Lock,
  MapPin,
  MoreHorizontal,
  Calculator,
  Phone,
  RotateCcw,
  Send,
  Truck,
  XCircle,
  Archive,
  ArchiveRestore,
  Trash2,
  Wallet,
  Flag,
  ShieldCheck,
  FilePenLine,
  Undo2,
} from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { Button } from '@/app/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import {
  Tooltip as PTooltip,
  TooltipContent as PTooltipContent,
  TooltipTrigger as PTooltipTrigger,
} from '@/app/components/ui/tooltip';
import type { CustomerInvoice, CustomerDocKind } from '@/app/data/ar/mockCustomerInvoices';
import { netDue, paymentStatusOf, isOverdue, treatmentOf, showsExceptionStatus, TREATMENT_LABEL } from '@/app/data/ar/customerInvoiceStatus';
import type { CustomerDeposit } from '@/app/data/ar/mockCustomerDeposits';
import { creditMemosFor } from '@/app/data/ar/arBilling';
import {
  getCustomerRowActionGroups,
  type CustomerInvoiceActionId,
} from '@/app/data/ar/customerInvoiceActions';
import { actionToneClass, type ActionTone } from '@/app/lib/actionMenuTone';
import { VendorAvatar } from '@/app/components/VendorAvatar';
// Person cell + text helpers are shared with the vendor listing so the AR
// table keeps the exact same micro-interactions (sibling-table pattern —
// same reuse PaymentDataTable relies on).
import { CreatedByCell, highlightAmount, highlightText, relativeDate, TooltipExplainer } from '@/app/components/InvoiceDataTable';
import {
  DataTable,
  OverflowTooltip,
  StatusPill,
  type ColumnDef,
  type ColumnFilterState,
  type DensityOption,
  type SortConfig,
  type StatusPillStyle,
} from '@/app/components/data-table';
// Design-system palette — every hardcoded hex below references palette[hue][stop]
// so changing a token in src/styles/tokens.ts updates the pills here too.
import { palette } from '@/styles/tokens';
import { arTermById, arTermByName } from '@/app/data/ar/arPaymentTerms';
import { discountIsLive, discountAmountOn, discountDaysLeft, type DiscountTerms } from '@/app/lib/runMath';
import { renderCustomerTermCell } from '@/app/components/customer/CustomerTermName';
import { CreditHoldLock, InvoiceFlagIcons, QuoteHover, SentOnCell, ShipmentHover } from '@/app/components/customer/CustomerCellHovers';
import { CustomerFullCard, getCustomerStats, openCustomerPartner } from '@/app/components/customer/CustomerFullCard';
import { addDaysIso, formatUsDate, formatUsDateTime, overdueDaysOf, overdueLabel } from '@/app/lib/dueBucket';

/* ─── Row-action icons — same icon language as the vendor listing ─── */
export const CUSTOMER_ACTION_ICONS: Record<CustomerInvoiceActionId, React.ComponentType<{ className?: string }>> = {
  view: Eye,
  edit: Edit3,
  submit: GitCompare,
  approve: CheckCheck,
  reject: Ban,
  send: Send,
  resend: Send,
  downloadPdf: Download,
  recordPayment: DollarSign,
  createBalanceInvoice: ArrowRightLeft,
  issueCreditMemo: FileText,
  creditHold: Lock,
  releaseCreditHold: RotateCcw,
  writeOff: Eraser,
  cancel: XCircle,
  archive: Archive,
  restore: ArchiveRestore,
  deleteDraft: Trash2,
  duplicate: Copy,
  markDisputed: Flag,
  resolveDispute: ShieldCheck,
  flagException: AlertTriangle,
  resolveException: CheckCircle2,
  reviseInvoice: FilePenLine,
  refundPrepayment: Undo2,
};

/** Empty cells stay blank (ERP-9875, 11/4): no dash in any table. */
export function mutedDot(): ReactNode {
  return null;
}

/* ─── TYPE palette — the AR fork of the vendor TYPE_CONFIG recipe.
 *  Shipment Invoice keeps the vendor's green "goods moved" band, the
 *  Advance Invoice is violet + dashed (billed before goods ship;
 *  violet = the system-wide pre-invoice identity, user 10/1),
 *  Standalone owns purple, and Credit Memo takes rose (money flowing
 *  BACK to the customer). */
export const CUSTOMER_TYPE_CONFIG: Record<
  CustomerDocKind,
  {
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    label: string;
    bg: string;
    fg: string;
    border: string;
    /** Advance only: dashed border marks it as billed before shipping. */
    dashed?: boolean;
  }
> = {
  // Same identities as the vendor listing and the New customer invoice
  // cards (user 10/27): BLUE Shipment (vendor Inventory), VIOLET dashed
  // Advance (vendor Pre-Invoice), TEAL Standalone.
  'Shipment Invoice': {
    icon: Truck,
    label: 'Shipment Invoice',
    bg: palette.blue[50],
    fg: palette.blue[700],
    border: palette.blue[200],
  },
  'Advance Invoice': {
    icon: Wallet,
    label: 'Advance Invoice',
    bg: palette.violet[50],
    fg: palette.violet[700],
    border: palette.violet[300],
    dashed: true,
  },
  Standalone: {
    icon: Calculator,
    label: 'Standalone Invoice',
    bg: palette.teal[50],
    fg: palette.teal[700],
    border: palette.teal[200],
  },
  'Credit Memo': {
    icon: FileText,
    label: 'Credit Memo',
    bg: palette.rose[50],
    fg: palette.rose[700],
    border: palette.rose[200],
  },
};

/* Plain-language explainers, mirroring the vendor pill tooltips. */
const CUSTOMER_TYPE_EXPLAINER: Record<CustomerDocKind, string> = {
  'Shipment Invoice': 'Bills goods that have shipped, from one or more shipments of one customer.',
  'Advance Invoice': 'Bills part of an order before it ships, such as a deposit. The rest is billed on shipment invoices, nothing twice.',
  Standalone: 'Bills a charge with no order or shipment, such as a service fee or tooling.',
  'Credit Memo': 'Credit we issue to the customer against an approved invoice, lowering what they owe.',
};

/* ─── Pre-invoice treatment badge (FAD 11/2): Revenue (emerald) books at
 *  invoice and locks the units; Deposit (violet) holds the money until the
 *  goods ship. Label on tone, no dot. ─── */
export const TREATMENT_TONES = {
  Revenue: { bg: palette.emerald[50], fg: palette.emerald[700], border: palette.emerald[200] },
  Deposit: { bg: palette.violet[50], fg: palette.violet[700], border: palette.violet[200] },
} as const;

/* Advance invoices (user 11/3): type and treatment ride ONE segmented
 *  pill, the vendor payment-term pill's clubbed recipe: tinted type
 *  segment + white segment carrying Revenue (emerald) or Deposit
 *  (violet). Other types keep the single pill. */
function renderDocKind(invoice: CustomerInvoice, searchQuery?: string): ReactNode {
  const docKind = invoice.docKind;
  const config = CUSTOMER_TYPE_CONFIG[docKind] ?? CUSTOMER_TYPE_CONFIG.Standalone;
  const explainer = CUSTOMER_TYPE_EXPLAINER[docKind] ?? CUSTOMER_TYPE_EXPLAINER.Standalone;
  const treatment = docKind === 'Advance Invoice' ? treatmentOf(invoice) : null;
  const Icon = config.icon;
  return (
    <PTooltip delayDuration={300}>
      <PTooltipTrigger asChild>
        <span
          className={`inline-flex items-stretch rounded-md overflow-hidden text-xs whitespace-nowrap cursor-default ${config.dashed ? 'border border-dashed' : 'border'}`}
          style={{ borderColor: config.border }}
        >
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5"
            style={{ fontWeight: config.dashed ? 600 : 500, backgroundColor: config.bg, color: config.fg }}
          >
            <Icon className="w-3 h-3" style={{ color: config.fg }} />
            {highlightText(config.label, searchQuery)}
          </span>
          {treatment && (
            <span
              className={`inline-flex items-center px-2 py-0.5 bg-white border-l ${config.dashed ? 'border-dashed' : ''}`}
              style={{ fontWeight: 500, color: TREATMENT_TONES[treatment].fg, borderColor: config.border }}
            >
              {highlightText(TREATMENT_LABEL[treatment], searchQuery)}
            </span>
          )}
        </span>
      </PTooltipTrigger>
      <PTooltipContent side="top" className="max-w-[260px]">
        <TooltipExplainer text={explainer} />
      </PTooltipContent>
    </PTooltip>
  );
}

/* ─── STATUS palette — AR invoice-status pills (spec §1.6 col 7).
 *  Same token approach as the vendor STATUS_STYLES: light-tone
 *  bg-50 / fg-700 / border-200 triads, terminal-success states carry
 *  the CheckCircle2 icon. Archived reads red (Oct 5 standard). */
const CUSTOMER_STATUS_STYLES: Record<string, StatusPillStyle> = {
  Draft: { bg: palette.slate[100], fg: palette.slate[600], border: palette.slate[300] },
  // Indigo, the vendor listing's Pending Approval tone.
  'Pending Approval': { bg: palette.indigo[50], fg: palette.indigo[700], border: palette.indigo[200] },
  Approved: { bg: palette.emerald[50], fg: palette.emerald[700], border: palette.emerald[200] },
  Rejected: { bg: palette.rose[50], fg: palette.rose[700], border: palette.rose[200] },
  Cancelled: { bg: palette.red[50], fg: palette.red[700], border: palette.red[200] },
  Archived: { bg: palette.red[50], fg: palette.red[700], border: palette.red[200] },
  // FAD 11/2: a version replaced by a revision reads a quiet grey.
  Revised: { bg: palette.slate[100], fg: palette.slate[500], border: palette.slate[300] },
  // Vendor parity (user 11/3): an open exception IS the status, the vendor
  // listing's amber + warning pill.
  Exception: { bg: palette.amber[100], fg: palette.amber[800], border: palette.amber[300], icon: AlertTriangle },
};

/* ─── PAYMENT palette — derived pill (spec §1.6 col 8). Written off is a
 *  quiet slate (money given up, not in motion); Overdue reads red. */
const CUSTOMER_PAYMENT_STYLES: Record<string, StatusPillStyle> = {
  Unpaid: { bg: palette.slate[100], fg: palette.slate[600], border: palette.slate[300] },
  'Partially Paid': { bg: palette.orange[50], fg: palette.orange[700], border: palette.orange[200] },
  Paid: { bg: palette.emerald[100], fg: palette.emerald[800], border: palette.emerald[300], icon: CheckCircle2 },
  Overdue: { bg: palette.red[50], fg: palette.red[700], border: palette.red[200], icon: AlertTriangle },
  'Written Off': { bg: palette.slate[100], fg: palette.slate[500], border: palette.slate[300] },
  Cancelled: { bg: palette.red[50], fg: palette.red[700], border: palette.red[200] },
  'Deposit Awaited': { bg: palette.amber[50], fg: palette.amber[700], border: palette.amber[200] },
  'Deposit Received': { bg: palette.emerald[50], fg: palette.emerald[700], border: palette.emerald[200] },
};

const STATUS_FALLBACK_STYLE: StatusPillStyle = {
  bg: palette.slate[100],
  fg: palette.slate[600],
  border: palette.slate[300],
};

/** The label the Status column shows (PRD §14): an archived cancelled
 *  invoice reads Archived. Sent is a flag, shown in its own column. */
export function invoiceStatusLabelOf(inv: CustomerInvoice): string {
  if (inv.archived) return 'Archived';
  // Revise (FAD 11/2): the replaced version stays in history as Revised.
  if (inv.supersededById) return 'Revised';
  if (showsExceptionStatus(inv)) return 'Exception';
  return inv.invoiceStatus;
}


export const CUSTOMER_STATUS_PILL_STYLES = CUSTOMER_STATUS_STYLES;

/** Invoice Status pill — exported so the list screen's quick views reuse
 *  the exact same pill. */
export function renderCustomerInvoiceStatus(inv: CustomerInvoice, searchQuery?: string): ReactNode {
  const label = invoiceStatusLabelOf(inv);
  const style = CUSTOMER_STATUS_STYLES[label] ?? STATUS_FALLBACK_STYLE;
  return <StatusPill label={highlightText(label, searchQuery)} style={style} />;
}

/** Payment Status pill — derived from paymentStatusOf(); credit memos
 *  (null) render the muted placeholder. Exported for quick views. */
export function renderCustomerPaymentStatus(inv: CustomerInvoice, searchQuery?: string): ReactNode {
  const status = paymentStatusOf(inv);
  if (!status) return mutedDot();
  const style = CUSTOMER_PAYMENT_STYLES[status] ?? STATUS_FALLBACK_STYLE;
  return <StatusPill label={highlightText(status, searchQuery)} style={style} />;
}

/* ─── Linked records — partner style, same recipe as the vendor listing:
 *  small TYPE-letter pill + record number as separate foreground text,
 *  first two shown, the rest collapsed behind a "+N more" text link. */
type LinkedKind = 'SO' | 'SHP' | 'INV' | 'QT' | 'CRN';

const LINKED_PILL_STYLES: Record<LinkedKind, { bg: string; fg: string }> = {
  SO: { bg: palette.blue[100], fg: palette.blue[700] },    // Sales Order → blue
  QT: { bg: palette.violet[100], fg: palette.violet[700] }, // Quote (advance from a quote) → violet
  SHP: { bg: palette.green[100], fg: palette.green[700] }, // Shipment → green
  INV: { bg: palette.rose[100], fg: palette.rose[700] },   // Related invoice (credit memo) → rose
  // Credit memos applied to this invoice (user 11/4): the credit memo
  // type's pink-rose identity, a step apart from the related invoice.
  CRN: { bg: palette.pink[100], fg: palette.pink[700] },
};

const LINKED_SUBTITLE: Record<LinkedKind, string> = {
  SO: 'Sales Order',
  QT: 'Quote',
  SHP: 'Shipment',
  INV: 'Invoice',
  CRN: 'Credit Memo',
};

interface LinkedItem {
  kind: LinkedKind;
  /** The number shown next to the type pill (prefix stripped). */
  display: string;
}

function linkedItemsOf(invoice: CustomerInvoice): LinkedItem[] {
  // Credit memos (and standalones raised against an invoice) link back
  // to the invoice they relate to; advances from a quote show the quote.
  const related: LinkedItem[] = invoice.relatedInvoiceNumber
    ? [{ kind: 'INV', display: invoice.relatedInvoiceNumber }]
    : [];
  if (invoice.docKind === 'Credit Memo') return related;
  return [
    ...(invoice.linkedSOs || []).map<LinkedItem>((id) => ({ kind: 'SO', display: id })),
    ...(invoice.docKind === 'Advance Invoice' && invoice.quoteNumber
      ? [{ kind: 'QT' as const, display: invoice.quoteNumber }]
      : []),
    ...(invoice.linkedShipments || []).map<LinkedItem>((id) => ({
      kind: 'SHP',
      display: id.replace(/^SHP\s*/i, ''),
    })),
    ...related,
    // Credit memos live inside the invoice they credit (user 11/4).
    ...listingCreditMemosOf(invoice).map<LinkedItem>((m) => ({ kind: 'CRN', display: m.invoiceNumber })),
  ];
}

/* Demo sales-order page in the inventory suite — the AR mirror of the
   vendor listing's PO_EXTERNAL_URL (po-10) convention. */
export const SO_EXTERNAL_URL = 'https://pleasant-flow.lovable.app/sales-orders/so-10';

function linkedChip(item: LinkedItem, searchQuery?: string): ReactNode {
  const style = LINKED_PILL_STYLES[item.kind];
  // Vendor listing's linked-record grammar (user 10/1 parity): pill +
  // number with the number turning primary-blue + underlined on hover.
  const chip = (
    <span className="inline-flex items-center gap-1.5 shrink-0 group/lr cursor-pointer">
      <span
        className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-[4px] text-[10px] tracking-wide"
        style={{ backgroundColor: style.bg, color: style.fg, fontWeight: 700 }}
      >
        {item.kind}
      </span>
      <span className="text-foreground group-hover/lr:text-primary group-hover/lr:underline transition-colors" style={{ fontWeight: 400 }}>
        {/* Every record number is searchable (the column is read by search),
            so each one highlights like any other matched cell. */}
        {highlightText(item.display, searchQuery)}
      </span>
    </span>
  );
  if (item.kind === 'SO') {
    return (
      <a
        href={SO_EXTERNAL_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        {chip}
      </a>
    );
  }
  if (item.kind === 'INV' || item.kind === 'CRN') {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          window.open(`/customer-invoices/${encodeURIComponent(item.display)}`, '_blank', 'noopener,noreferrer');
        }}
      >
        {chip}
      </button>
    );
  }
  // Shipments and quotes are display-only until those surfaces exist (the
  // vendor call for receiving documents), but each shows its summary in
  // the vendor quick-card on hover.
  const btn = (
    <button type="button" onClick={(e) => e.stopPropagation()}>
      {chip}
    </button>
  );
  if (item.kind === 'SHP') return <ShipmentHover shipmentNumber={`SHP ${item.display}`}>{btn}</ShipmentHover>;
  if (item.kind === 'QT') return <QuoteHover quoteNumber={item.display}>{btn}</QuoteHover>;
  return btn;
}

function renderLinkedRecords(invoice: CustomerInvoice, searchQuery?: string): ReactNode {
  const all = linkedItemsOf(invoice);
  if (all.length === 0) return mutedDot();
  const shown = all.slice(0, 1);
  const overflow = all.slice(1);
  return (
    <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap overflow-hidden">
      {shown.map((item, i) => (
        <Fragment key={`${item.kind}-${item.display}-${i}`}>{linkedChip(item, searchQuery)}</Fragment>
      ))}
      {overflow.length > 0 && (
        <OverflowTooltip
          category="Linked Entities"
          items={overflow.map((rec, i) => ({
            id: `${rec.kind}-${rec.display}-${i}`,
            name: rec.kind === 'SHP' ? `SHP ${rec.display}` : rec.display,
            subtitle: LINKED_SUBTITLE[rec.kind],
            initials: rec.kind,
            avatarBg: LINKED_PILL_STYLES[rec.kind].bg,
            avatarFg: LINKED_PILL_STYLES[rec.kind].fg,
            // SOs route out to the inventory suite, related AR invoices
            // open in-app; shipments stay display-only (vendor parity).
            nameHref: rec.kind === 'SO'
              ? SO_EXTERNAL_URL
              : rec.kind === 'INV' || rec.kind === 'CRN'
                ? `/customer-invoices/${encodeURIComponent(rec.display)}`
                : undefined,
          }))}
        >
          <span
            className="text-xs cursor-pointer transition-colors shrink-0 hover:underline"
            style={{ color: 'hsl(var(--primary))', fontWeight: 500 }}
          >
            +{overflow.length} more
          </span>
        </OverflowTooltip>
      )}
    </div>
  );
}

/* ─── Customer cell — the vendor listing's VendorCell grammar verbatim
 *  (user 10/1 parity): hover-scale avatar with a quick-card on hover,
 *  name turning primary-blue + underlined on hover, click opening the
 *  partner record in a new tab. Stats are hash-derived from the name,
 *  the same deterministic recipe the vendor quick-card uses. */
// Re-exported: the Ready to Invoice table and the detail page import it here.
export { openCustomerPartner };

export function CustomerQuickCard({ customer, description }: { customer: string; description?: string }) {
  const stats = getCustomerStats(customer);
  return (
    <div className="w-[280px]">
      <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
        <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
        <div className="flex items-center gap-3 relative">
          <div className="shrink-0">
            <VendorAvatar name={customer} size="md" />
          </div>
          <div className="min-w-0">
            <p className="text-[14px] text-white truncate" style={{ fontWeight: 500 }}>
              {customer}
            </p>
            <p className="text-[11px] text-slate-400 truncate">Customer · {stats.city}</p>
          </div>
        </div>
      </div>
      <div className="bg-white px-4 py-3 space-y-2">
        {description && (
          <p className="text-[11px] text-slate-600 line-clamp-2">{description}</p>
        )}
        <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">
            {stats.addressLine}, {stats.city}
          </span>
        </div>
        <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="">{stats.phone}</span>
        </div>
      </div>
      <div className="bg-slate-50/60 border-t border-border/40 px-4 py-2 flex items-center justify-end">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openCustomerPartner(customer);
          }}
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
          style={{ fontWeight: 500 }}
        >
          Go to Customer
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

interface CustomerCellProps {
  customer: string;
  description?: string;
  density: DensityOption;
  searchQuery?: string;
}
export function CustomerCell({ customer, description, density, searchQuery }: CustomerCellProps) {
  // Vendor VendorCell parity: the avatar opens the full customer card,
  // the name opens the partner record in a new tab.
  const [fullCardOpen, setFullCardOpen] = useState(false);
  const isComfort = density === 'comfort';
  return (
    <>
    <div className="flex items-center gap-2 min-w-0">
      <HoverCard openDelay={300} closeDelay={120}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setFullCardOpen(true);
            }}
            className="shrink-0 rounded-md transition-transform hover:scale-[1.04] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-label={`Open ${customer} details`}
          >
            <VendorAvatar name={customer} size={isComfort ? 'md' : 'sm'} />
          </button>
        </HoverCardTrigger>
        <HoverCardContent
          side="bottom"
          align="start"
          sideOffset={6}
          className="p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden w-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <CustomerQuickCard customer={customer} description={description} />
        </HoverCardContent>
      </HoverCard>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openCustomerPartner(customer);
        }}
        className="min-w-0 flex flex-col cursor-pointer group/cn text-left"
      >
        <span
          className={`truncate text-foreground transition-colors group-hover/cn:text-primary group-hover/cn:underline ${
            density === 'card' ? 'text-[12px]' : isComfort ? 'text-[13px]' : 'text-sm'
          }`}
          style={{ fontWeight: density === 'card' ? 600 : 400 }}
        >
          {highlightText(customer, searchQuery)}
        </span>
        {isComfort && description && (
          <span className="text-[11px] text-muted-foreground truncate">
            {highlightText(description, searchQuery)}
          </span>
        )}
      </button>
    </div>
    <CustomerFullCard customer={customer} open={fullCardOpen} onClose={() => setFullCardOpen(false)} />
    </>
  );
}

/* ─── Money formatting — `$49,316.00`; credit-memo negatives read red
 *  with a leading minus sign (spec §1.6 col 9). */
function formatMoney(n: number): string {
  return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** The payment term name the Payment Terms column prints. */
export function paymentTermsOf(inv: CustomerInvoice): string {
  return inv.paymentTerms || arTermById(inv.paymentTermId)?.name || '';
}

/** Signed amount: credit memos always read negative, whatever sign the
 *  record stores, so the column, sort and search agree. */
export function signedAmountOf(inv: CustomerInvoice): number {
  return inv.docKind === 'Credit Memo' ? -Math.abs(inv.amount) : inv.amount;
}

/** The amount exactly as its cell prints it ("−$1,250.00" for credits). */
function amountText(amount: number): string {
  return `${amount < 0 ? '−' : ''}${formatMoney(amount)}`;
}

function renderAmount(amount: number, searchQuery?: string): ReactNode {
  const negative = amount < 0;
  return (
    <span
      className=""
      style={{ fontWeight: 400, color: negative ? palette.red[600] : 'hsl(var(--foreground))' }}
    >
      {negative ? '−' : ''}
      {/* Amounts are searchable, so the matched digits highlight (10/9/26). */}
      {highlightAmount(formatMoney(amount), searchQuery)}
    </span>
  );
}

/* ─── Due date cell — the vendor recipe verbatim: date + the ONE aging
 *  phrase family (overdueLabel) while money is still owed on a live
 *  record. Advance invoices and credit memos without a date stay blank. */
function dueHintOf(row: CustomerInvoice): { text: string; cls: string } | null {
  if (!row.dueDate) return null;
  const open = netDue(row) > 0.004 && !row.writtenOff && row.invoiceStatus !== 'Cancelled' && row.invoiceStatus !== 'Rejected';
  if (!open) return null;
  const days = overdueDaysOf(row.dueDate);
  if (days > 0) return isOverdue(row) ? { text: overdueLabel(days), cls: 'text-red-600' } : null;
  if (days === 0) return { text: 'Due Today', cls: 'text-amber-600' };
  if (-days <= 7) return { text: overdueLabel(days), cls: 'text-amber-600' };
  return { text: overdueLabel(days), cls: 'text-slate-400' };
}

function renderDueDate(row: CustomerInvoice, searchQuery?: string): ReactNode {
  if (!row.dueDate) return mutedDot();
  const hint = dueHintOf(row);
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-foreground whitespace-nowrap">{highlightText(formatUsDateTime(row.dueDate, row.id), searchQuery)}</span>
      {hint && (
        <span className={`text-[10px] ${hint.cls}`} style={{ fontWeight: 600 }}>{hint.text}</span>
      )}
    </div>
  );
}

/* ─── Column definitions — spec §1.6: 17 columns + Net due. Same
 *  ColumnDef contract the vendor INVOICE_COLUMNS uses. ─── */
export const CUSTOMER_INVOICE_COLUMNS: ColumnDef<CustomerInvoice>[] = [
  {
    key: 'invoiceNumber',
    filterable: false,
    label: 'Invoice ID',
    minWidth: 180,
    defaultWidth: 200,
    sortable: true,
    locked: true,
    sticky: 'left',
    filterType: 'text',
    getValue: (row) => row.invoiceNumber,
    render: (row, { density, searchQuery }) => (
      // The number is a LINK (user 10/5, vendor-listing parity): black at
      // rest, blue + underline on hover, opens the invoice in a NEW TAB.
      // A credit-held invoice carries the yellow lock (vendor hold recipe).
      <span className="flex min-w-0 items-center gap-1.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          window.open(`/customer-invoices/${encodeURIComponent(row.invoiceNumber)}`, '_blank', 'noopener');
        }}
        className={`block truncate whitespace-nowrap text-left cursor-pointer bg-transparent border-0 p-0 text-slate-800 hover:text-primary hover:underline underline-offset-2 transition-colors ${
          density === 'comfort' ? 'text-[13px]' : 'text-sm'
        }`}
        style={{ fontWeight: 400 }}
      >
        {highlightText(row.invoiceNumber, searchQuery)}
      </button>
      <CreditHoldLock invoice={row} />
      <InvoiceFlagIcons invoice={row} />
      </span>
    ),
  },
  {
    key: 'docKind',
    label: 'Invoice Type',
    minWidth: 170,
    // FAD 11/2: room for the Revenue or Deposit segment of the type pill.
    defaultWidth: 236,
    sortable: true,
    filterType: 'multiselect',
    uniqueValues: (rows) => Array.from(new Set(rows.map((r) => r.docKind))).sort(),
    getValue: (row) => row.docKind,
    searchText: (row) => `${(CUSTOMER_TYPE_CONFIG[row.docKind] ?? CUSTOMER_TYPE_CONFIG.Standalone).label} ${treatmentOf(row) ? TREATMENT_LABEL[treatmentOf(row)!] : ''}`.trim(),
    render: (row, { searchQuery }) => renderDocKind(row, searchQuery),
  },
  {
    key: 'customer',
    label: 'Customer',
    minWidth: 200,
    defaultWidth: 240,
    sortable: true,
    filterType: 'text',
    getValue: (row) => row.customer,
    render: (row, ctx) => (
      <CustomerCell
        customer={row.customer}
        description={row.description}
        density={ctx.density}
        searchQuery={ctx.searchQuery}
      />
    ),
  },
  {
    // The number printed for the customer (SI- sequence, BA 10/29), the
    // vendor listing's Vendor Invoice No. counterpart (user 11/3).
    key: 'documentNumber',
    filterable: false,
    label: 'Invoice Number',
    minWidth: 150,
    defaultWidth: 180,
    sortable: true,
    filterType: 'text',
    getValue: (row) => row.documentNumber ?? '',
    render: (row, { searchQuery }) =>
      row.documentNumber ? (
        <span className="text-foreground">{highlightText(row.documentNumber, searchQuery)}</span>
      ) : (
        mutedDot()
      ),
  },
  {
    key: 'customerPONumber',
    filterable: false,
    label: 'Customer PO No.',
    minWidth: 150,
    defaultWidth: 180,
    sortable: true,
    filterType: 'text',
    getValue: (row) => row.customerPONumber ?? '',
    render: (row, { searchQuery }) =>
      row.customerPONumber ? (
        <span className="text-foreground">{highlightText(row.customerPONumber, searchQuery)}</span>
      ) : (
        mutedDot()
      ),
  },
  {
    key: 'invoiceDate',
    label: 'Invoice Date',
    minWidth: 165,
    defaultWidth: 205,
    sortable: true,
    filterType: 'date',
    getValue: (row) => row.invoiceDate,
    searchText: (row) => formatUsDateTime(row.invoiceDate, row.id),
    render: (row, { searchQuery }) => (
      <span className="text-muted-foreground whitespace-nowrap">
        {highlightText(formatUsDateTime(row.invoiceDate, row.id), searchQuery)}
      </span>
    ),
  },
  {
    key: 'dueDate',
    label: 'Due Date',
    minWidth: 165,
    defaultWidth: 210,
    sortable: true,
    filterType: 'date',
    getValue: (row) => row.dueDate ?? '',
    searchText: (row) => (row.dueDate ? formatUsDateTime(row.dueDate, row.id) : ''),
    render: (row, { searchQuery }) => renderDueDate(row, searchQuery),
  },
  {
    key: 'paymentTerms',
    label: 'Payment Terms',
    minWidth: 200,
    defaultWidth: 290,
    sortable: true,
    filterType: 'multiselect',
    uniqueValues: (rows) => Array.from(new Set(rows.map((r) => paymentTermsOf(r)).filter(Boolean))).sort(),
    getValue: (row) => paymentTermsOf(row),
    // Vendor TermName parity: hover shows the AR term card, click opens
    // its details modal (the row never opens).
    render: (row, { searchQuery }) => renderCustomerTermCell(row.paymentTermId, paymentTermsOf(row), searchQuery, mutedDot()),
  },
  {
    key: 'invoiceStatus',
    label: 'Invoice Status',
    minWidth: 140,
    defaultWidth: 170,
    sortable: true,
    filterType: 'multiselect',
    uniqueValues: (rows) => Array.from(new Set(rows.map((r) => invoiceStatusLabelOf(r)))).sort(),
    getValue: (row) => invoiceStatusLabelOf(row),
    render: (row, { searchQuery }) => renderCustomerInvoiceStatus(row, searchQuery),
  },
  {
    key: 'paymentStatus',
    label: 'Payment Status',
    minWidth: 140,
    defaultWidth: 170,
    sortable: true,
    filterType: 'multiselect',
    uniqueValues: (rows) =>
      Array.from(
        new Set(rows.map((r) => paymentStatusOf(r)).filter((s) => s !== null) as string[]),
      ).sort(),
    getValue: (row) => paymentStatusOf(row) ?? '',
    render: (row, { searchQuery }) => renderCustomerPaymentStatus(row, searchQuery),
  },
  {
    // PRD §14: Sent is a flag with a date, not a status.
    key: 'sent',
    label: 'Sent On',
    minWidth: 120,
    defaultWidth: 140,
    sortable: true,
    filterType: 'date',
    getValue: (row) => row.sentAt ?? '',
    searchText: (row) => (row.sentAt ? formatUsDate(row.sentAt) : ''),
    // Hover: who sent it, to whom, and when (the send log).
    render: (row, { searchQuery }) => <SentOnCell invoice={row} searchQuery={searchQuery} />,
  },
  {
    key: 'amount',
    label: 'Amount',
    minWidth: 120,
    defaultWidth: 160,
    sortable: true,
    filterType: 'range',
    getValue: (row) => signedAmountOf(row),
    getSortValue: (row) => signedAmountOf(row),
    searchText: (row) => (row.amount ? amountText(signedAmountOf(row)) : ''),
    render: (row, { searchQuery }) => renderAmount(signedAmountOf(row), searchQuery),
  },
  {
    key: 'discount',
    label: 'Discount',
    minWidth: 130,
    defaultWidth: 170,
    sortable: true,
    filterable: false,
    getValue: (row) => {
      const terms = customerDiscountTerms(row);
      return terms && discountIsLive(terms) && netDue(row) > 0 ? discountAmountOn(netDue(row), terms) : 0;
    },
    // What the pill prints: "2% · −$120.00", or "2% Expired".
    searchText: (row) => {
      const terms = customerDiscountTerms(row);
      if (!terms || netDue(row) <= 0) return '';
      if (!discountIsLive(terms)) return `${terms.percent}% Expired`;
      return `${terms.percent}% · −${money2(discountAmountOn(netDue(row), terms))}`;
    },
    render: (row) => {
      const terms = customerDiscountTerms(row);
      if (!terms || netDue(row) <= 0) return null;
      if (!discountIsLive(terms)) {
        return (
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 text-[11px] whitespace-nowrap"
            style={{ fontWeight: 600 }}
            title={`The ${terms.percent}% early-pay window closed on ${formatUsDate(terms.deadline)}.`}
          >
            {terms.percent}% Expired
          </span>
        );
      }
      const discount = discountAmountOn(netDue(row), terms);
      const daysLeft = discountDaysLeft(terms);
      return (
        <span onClick={(e) => e.stopPropagation()}>
          <HoverCard openDelay={150} closeDelay={80}>
            <HoverCardTrigger asChild>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] cursor-help whitespace-nowrap" style={{ fontWeight: 600 }}>
                {terms.percent}% · −{money2(discount)}
              </span>
            </HoverCardTrigger>
            <HoverCardContent side="top" align="start" className="w-[280px] p-3 rounded-xl border border-border shadow-lg bg-white z-[300]">
              <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Early-pay discount, {terms.label}</p>
              <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                If the customer pays by {formatUsDate(terms.deadline)}, they can take {terms.percent}% off the open balance.
              </p>
              <p className="text-[11px] mt-1.5" style={{ fontWeight: 600, color: daysLeft <= 2 ? '#B45309' : '#047857' }}>
                {daysLeft === 0 ? 'Today is the last day of the window.' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left.`}
              </p>
            </HoverCardContent>
          </HoverCard>
        </span>
      );
    },
  },
  {
    key: 'premium',
    label: 'Premium',
    minWidth: 120,
    defaultWidth: 150,
    sortable: true,
    filterable: false,
    getValue: (row) => pricingRulesTotals(row).premium,
    searchText: (row) => {
      const p = pricingRulesTotals(row).premium;
      return p > 0 ? `+${money2(p)}` : '';
    },
    render: (row) => {
      const { rules, premium } = pricingRulesTotals(row);
      if (premium <= 0) return null;
      return (
        <span onClick={(e) => e.stopPropagation()}>
          <HoverCard openDelay={150} closeDelay={80}>
            <HoverCardTrigger asChild>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[11px] cursor-help whitespace-nowrap" style={{ fontWeight: 600 }}>
                +{money2(premium)}
              </span>
            </HoverCardTrigger>
            <HoverCardContent side="top" align="start" className="w-[280px] p-3 rounded-xl border border-border shadow-lg bg-white z-[300]">
              <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Pricing rules on {row.invoiceNumber}</p>
              <p className="text-[11px] text-slate-500 leading-relaxed mt-1">Already inside the invoice amount.</p>
              <div className="mt-2 rounded-lg border border-slate-100 overflow-hidden text-[11px]">
                {rules.map((r, i) => (
                  <div key={r.rule} className={`flex items-center justify-between gap-2 px-2.5 py-1.5 ${i > 0 ? 'border-t border-slate-100' : ''}`}>
                    <span className="text-foreground truncate" style={{ fontWeight: 500 }}>
                      {r.rule}
                      {r.percent !== undefined ? <span className="text-slate-400" style={{ fontWeight: 400 }}> · {Math.abs(r.percent)}%</span> : null}
                    </span>
                    <span className={r.amount < 0 ? 'text-emerald-700' : 'text-amber-700'} style={{ fontWeight: 500 }}>
                      {r.amount < 0 ? '−' : '+'}
                      {money2(Math.abs(r.amount))}
                    </span>
                  </div>
                ))}
              </div>
            </HoverCardContent>
          </HoverCard>
        </span>
      );
    },
  },
  {
    // User 11/4: the customer deposit money tied to the invoice. Shipment
    // and standalone invoices show the deposits applied to them; a Deposit
    // treatment advance shows the deposit it received (held until shipping).
    key: 'customerDeposits',
    label: 'Customer Deposits',
    minWidth: 140,
    defaultWidth: 170,
    sortable: true,
    filterable: false,
    getValue: (row) => listingDepositsTotal(row),
    searchText: (row) => {
      const t = listingDepositsTotal(row);
      return t > 0 ? money2(t) : '';
    },
    render: (row, { searchQuery }) => {
      const deposits = listingDepositsOf(row);
      const total = listingDepositsTotal(row);
      if (deposits.length === 0 || total <= 0) return null;
      const received = row.docKind === 'Advance Invoice';
      return (
        <span onClick={(e) => e.stopPropagation()}>
          <HoverCard openDelay={150} closeDelay={80}>
            <HoverCardTrigger asChild>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 text-[11px] cursor-help whitespace-nowrap" style={{ fontWeight: 500 }}>
                {highlightAmount(money2(total), searchQuery)}
              </span>
            </HoverCardTrigger>
            <HoverCardContent side="top" align="start" className="w-[300px] p-3 rounded-xl border border-border shadow-lg bg-white z-[300]">
              <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>
                {received ? `Deposit received on ${row.invoiceNumber}` : `Deposits applied to ${row.invoiceNumber}`}
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                {received
                  ? 'Held in Customer Deposits until the goods ship, then released to revenue.'
                  : 'Customer deposits released against this invoice, lowering what the customer owes.'}
              </p>
              <div className="mt-2 rounded-lg border border-slate-100 overflow-hidden text-[11px]">
                {deposits.map((d, i) => (
                  <div key={`${d.depositNumber}-${i}`} className={`flex items-center justify-between gap-2 px-2.5 py-1.5 ${i > 0 ? 'border-t border-slate-100' : ''}`}>
                    <span className="min-w-0">
                      <span className="block text-foreground truncate" style={{ fontWeight: 500 }}>{d.depositNumber}</span>
                      <span className="block text-slate-400" style={{ fontWeight: 400 }}>
                        {d.note ? `${d.note} · ` : ''}{d.date ? formatUsDate(d.date) : ''}
                      </span>
                    </span>
                    <span className="text-violet-700 shrink-0" style={{ fontWeight: 500 }}>{money2(d.amount)}</span>
                  </div>
                ))}
              </div>
            </HoverCardContent>
          </HoverCard>
        </span>
      );
    },
  },
  {
    // User 11/4: a credit memo is not an invoice type; it lives inside the
    // invoice it credits. The cell totals the approved credit applied.
    key: 'creditMemos',
    label: 'Credit Memos',
    minWidth: 130,
    defaultWidth: 160,
    sortable: true,
    filterable: false,
    getValue: (row) => listingCreditAppliedTotal(row),
    searchText: (row) => {
      const memos = listingCreditMemosOf(row);
      if (memos.length === 0) return '';
      const t = listingCreditAppliedTotal(row);
      return [t > 0 ? `−${money2(t)}` : '', ...memos.map((m) => m.invoiceNumber)].join(' ').trim();
    },
    render: (row, { searchQuery }) => {
      const memos = listingCreditMemosOf(row);
      if (memos.length === 0) return null;
      const total = listingCreditAppliedTotal(row);
      const pending = memos.filter((m) => m.status !== 'Approved');
      return (
        <span onClick={(e) => e.stopPropagation()}>
          <HoverCard openDelay={150} closeDelay={80}>
            <HoverCardTrigger asChild>
              {total > 0 ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 text-[11px] cursor-help whitespace-nowrap" style={{ fontWeight: 500 }}>
                  −{highlightAmount(money2(total), searchQuery)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[11px] cursor-help whitespace-nowrap" style={{ fontWeight: 500 }}>
                  {pending.length} Pending
                </span>
              )}
            </HoverCardTrigger>
            <HoverCardContent side="top" align="start" className="w-[300px] p-3 rounded-xl border border-border shadow-lg bg-white z-[300]">
              <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Credit memos on {row.invoiceNumber}</p>
              <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                {pending.length > 0
                  ? 'Approved credit lowers what the customer owes. Pending credit applies once approved.'
                  : 'Approved credit, already taken off what the customer owes.'}
              </p>
              <div className="mt-2 rounded-lg border border-slate-100 overflow-hidden text-[11px]">
                {memos.map((m, i) => (
                  <div key={m.id} className={`flex items-center justify-between gap-2 px-2.5 py-1.5 ${i > 0 ? 'border-t border-slate-100' : ''}`}>
                    <span className="min-w-0">
                      <button
                        type="button"
                        className="block text-foreground truncate hover:text-primary hover:underline underline-offset-2 transition-colors bg-transparent border-0 p-0 text-left"
                        style={{ fontWeight: 500 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`/customer-invoices/${encodeURIComponent(m.invoiceNumber)}`, '_blank', 'noopener,noreferrer');
                        }}
                      >
                        {m.invoiceNumber}
                      </button>
                      <span className="block text-slate-400" style={{ fontWeight: 400 }}>
                        {m.status}{m.date ? ` · ${formatUsDate(m.date)}` : ''}
                      </span>
                    </span>
                    <span className={m.status === 'Approved' ? 'text-rose-700 shrink-0' : 'text-slate-400 shrink-0'} style={{ fontWeight: 500 }}>
                      −{money2(m.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </HoverCardContent>
          </HoverCard>
        </span>
      );
    },
  },
  {
    key: 'linked',
    filterable: false,
    label: 'Linked Records',
    minWidth: 200,
    defaultWidth: 280,
    sortable: false,
    filterType: 'text',
    getValue: (row) =>
      linkedItemsOf(row)
        .map((i) => (i.kind === 'SHP' ? `SHP ${i.display}` : `${i.kind} ${i.display}`))
        .join(', '),
    // The record numbers the chips print (the type letters are labels).
    searchText: (row) => linkedItemsOf(row).map((i) => i.display).join(' '),
    render: (row, { searchQuery }) => renderLinkedRecords(row, searchQuery),
  },
  {
    key: 'arAccount',
    label: 'A/R Account',
    minWidth: 140,
    defaultWidth: 180,
    sortable: true,
    filterType: 'multiselect',
    uniqueValues: (rows) => Array.from(new Set(rows.map((r) => r.arAccount))).sort(),
    getValue: (row) => row.arAccount,
    render: (row, { searchQuery }) => <span className="text-muted-foreground">{highlightText(row.arAccount, searchQuery)}</span>,
  },
  {
    key: 'currency',
    label: 'Currency',
    minWidth: 90,
    defaultWidth: 120,
    sortable: true,
    filterType: 'multiselect',
    uniqueValues: (rows) => Array.from(new Set(rows.map((r) => r.currency))).sort(),
    getValue: (row) => row.currency,
    render: (row, { searchQuery }) => <span className="text-muted-foreground">{highlightText(row.currency, searchQuery)}</span>,
  },
  {
    key: 'description',
    label: 'Description',
    minWidth: 200,
    defaultWidth: 300,
    sortable: true,
    filterType: 'text',
    getValue: (row) => row.description,
    render: (row, { searchQuery }) => (
      <span className="text-muted-foreground truncate block" title={row.description}>
        {highlightText(row.description, searchQuery)}
      </span>
    ),
  },
  {
    key: 'updatedBy',
    label: 'Last Updated By',
    minWidth: 160,
    defaultWidth: 200,
    sortable: true,
    filterType: 'multiselect',
    uniqueValues: (rows) => Array.from(new Set(rows.map((r) => r.updatedBy ?? r.createdBy))).sort(),
    getValue: (row) => row.updatedBy ?? row.createdBy,
    render: (row, { density, searchQuery }) => (
      <CreatedByCell name={row.updatedBy ?? row.createdBy} vendor={row.customer} density={density} searchQuery={searchQuery} />
    ),
  },
  {
    key: 'updatedDate',
    label: 'Last Updated On',
    minWidth: 170,
    defaultWidth: 215,
    sortable: true,
    filterType: 'date',
    getValue: (row) => row.updatedDate ?? row.createdDate,
    searchText: (row) => formatUsDateTime(row.updatedDate ?? row.createdDate, `${row.id}:upd`),
    render: (row, { density, searchQuery }) => {
      const value = row.updatedDate ?? row.createdDate;
      const rel = relativeDate(value);
      return (
        <div>
          <span className="text-muted-foreground whitespace-nowrap">{highlightText(formatUsDateTime(value, `${row.id}:upd`), searchQuery)}</span>
          {density === 'comfort' && rel && (
            <span className="text-[10px] text-muted-foreground/50 block">{rel}</span>
          )}
        </div>
      );
    },
  },
  {
    key: 'createdBy',
    label: 'Created By',
    minWidth: 160,
    defaultWidth: 200,
    sortable: true,
    filterType: 'multiselect',
    uniqueValues: (rows) => Array.from(new Set(rows.map((r) => r.createdBy))).sort(),
    getValue: (row) => row.createdBy,
    render: (row, { density, searchQuery }) => (
      <CreatedByCell name={row.createdBy} vendor={row.customer} density={density} searchQuery={searchQuery} />
    ),
  },
  {
    key: 'createdDate',
    label: 'Created On',
    minWidth: 165,
    defaultWidth: 205,
    sortable: true,
    filterType: 'date',
    getValue: (row) => row.createdDate,
    searchText: (row) => formatUsDateTime(row.createdDate, `${row.id}:crt`),
    render: (row, { density, searchQuery }) => {
      const rel = relativeDate(row.createdDate);
      return (
        <div>
          <span className="text-muted-foreground whitespace-nowrap">{highlightText(formatUsDateTime(row.createdDate, `${row.id}:crt`), searchQuery)}</span>
          {density === 'comfort' && rel && (
            <span className="text-[10px] text-muted-foreground/50 block">{rel}</span>
          )}
        </div>
      );
    },
  },
];

/* ─── Discount and Premium columns (user 11/3, vendor listing parity) ───
 *  Discount: the early-pay discount from the invoice's payment term, as of
 *  today, the vendor Discount column's rule. Premium: pricing-rule premiums
 *  already inside the SO prices, summed across the lines. */
function customerDiscountTerms(inv: CustomerInvoice): DiscountTerms | null {
  if (inv.docKind === 'Credit Memo') return null;
  const preset = arTermById(inv.paymentTermId) ?? arTermByName(paymentTermsOf(inv));
  if (!preset?.applyDiscount || !inv.invoiceDate) return null;
  const percent = Number(preset.discountPercent ?? '2') || 2;
  const period = Number(preset.discountPeriod ?? '10') || 10;
  const raw = addDaysIso(inv.invoiceDate, period);
  const deadline = inv.dueDate && raw > inv.dueDate ? inv.dueDate : raw;
  const base = netDue(inv);
  return { label: preset.name, percent, deadline, value: Math.round(base * percent) / 100 };
}

function pricingRulesTotals(inv: CustomerInvoice) {
  const byRule = new Map<string, { rule: string; amount: number; percent?: number }>();
  for (const l of inv.lines ?? []) {
    for (const r of l.pricingAdjustments ?? []) {
      const row = byRule.get(r.rule) ?? { rule: r.rule, amount: 0, percent: r.percent };
      row.amount = Math.round((row.amount + r.perUnit * l.invoiceQty) * 100) / 100;
      byRule.set(r.rule, row);
    }
  }
  const rules = [...byRule.values()].filter((r) => Math.abs(r.amount) > 0.004);
  const premium = Math.round(rules.filter((r) => r.amount > 0).reduce((a, r) => a + r.amount, 0) * 100) / 100;
  return { rules, premium };
}

const money2 = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ─── Listing context (user 11/4): credit memos are not listing rows, they
 *  ride on the invoice they credit; deposits come from the customer
 *  deposits store. The list screen decorates each row once with what it
 *  needs (decorateCustomerListingRows), so the static column defs, sort,
 *  search and filters all read the same values. ─── */
export interface ListingCreditMemo {
  id: string;
  invoiceNumber: string;
  /** Positive credit amount. */
  amount: number;
  status: string;
  date?: string;
}

export interface ListingDeposit {
  depositNumber: string;
  amount: number;
  date?: string;
  note?: string;
}

type CustomerListingRow = CustomerInvoice & {
  listingCreditMemos?: ListingCreditMemo[];
  listingDeposits?: ListingDeposit[];
};

const round2c = (n: number) => Math.round(n * 100) / 100;

function listingCreditMemosOf(inv: CustomerInvoice): ListingCreditMemo[] {
  return (inv as CustomerListingRow).listingCreditMemos ?? [];
}

function listingDepositsOf(inv: CustomerInvoice): ListingDeposit[] {
  return (inv as CustomerListingRow).listingDeposits ?? [];
}

/** Approved credit on the invoice; falls back to the stored creditApplied
 *  when the memo records are not in the listing set. */
export function listingCreditAppliedTotal(inv: CustomerInvoice): number {
  const memos = listingCreditMemosOf(inv);
  const approved = round2c(memos.filter((m) => m.status === 'Approved').reduce((s, m) => s + m.amount, 0));
  return approved > 0 ? approved : memos.length === 0 ? round2c(inv.creditApplied || 0) : 0;
}

export function listingDepositsTotal(inv: CustomerInvoice): number {
  return round2c(listingDepositsOf(inv).reduce((s, d) => s + d.amount, 0));
}

/** The listing rows: credit memos dropped (they are not an invoice type),
 *  each invoice carrying its credit memos and customer deposits. */
export function decorateCustomerListingRows(all: CustomerInvoice[], deposits: CustomerDeposit[]): CustomerInvoice[] {
  const depById = new Map(deposits.map((d) => [d.id, d]));
  return all
    .filter((inv) => inv.docKind !== 'Credit Memo')
    .map((inv) => {
      const listingCreditMemos: ListingCreditMemo[] = creditMemosFor(inv.invoiceNumber, all).map((m) => ({
        id: m.id,
        invoiceNumber: m.invoiceNumber,
        amount: Math.abs(m.amount),
        status: m.invoiceStatus,
        date: m.approvedAt ?? m.invoiceDate,
      }));
      const listingDeposits: ListingDeposit[] = [];
      if (inv.docKind === 'Advance Invoice') {
        // Deposit treatment only: a Revenue advance books revenue at invoice.
        if (treatmentOf(inv) === 'Deposit' && inv.invoiceStatus !== 'Cancelled') {
          const received = deposits.filter((d) => d.preInvoiceNumber === inv.invoiceNumber);
          received.forEach((d) => {
            const kept = round2c(d.amount - (d.refunded ? d.amount : d.refundedAmount ?? 0));
            if (kept <= 0) return;
            const applied = round2c(d.applications.reduce((s, a) => s + a.amount, 0));
            const held = Math.max(0, round2c(kept - applied));
            listingDeposits.push({
              depositNumber: d.depositNumber,
              amount: kept,
              date: d.receivedDate,
              note: held <= 0 ? 'Fully Applied' : held < kept ? `${money2(held)} Held` : 'Held',
            });
          });
          if (received.length === 0 && inv.depositReceived) {
            listingDeposits.push({ depositNumber: 'Deposit Received', amount: inv.amount, date: inv.sentAt?.split('T')[0], note: 'Held' });
          }
        }
      } else {
        // Applications recorded on the invoice, then deposit-store
        // applications pointing at it that the invoice does not carry yet.
        const seen = new Set<string>();
        inv.depositApplications.forEach((app) => {
          seen.add(app.depositId);
          listingDeposits.push({
            depositNumber: depById.get(app.depositId)?.depositNumber ?? app.depositId,
            amount: app.amount,
            date: app.appliedOn,
            note: 'Applied',
          });
        });
        deposits.forEach((d) => {
          if (seen.has(d.id) || d.preInvoiceNumber === inv.invoiceNumber) return;
          d.applications
            .filter((a) => a.invoiceNumber === inv.invoiceNumber)
            .forEach((a) => listingDeposits.push({ depositNumber: d.depositNumber, amount: a.amount, date: a.appliedOn, note: 'Applied' }));
        });
      }
      if (listingCreditMemos.length === 0 && listingDeposits.length === 0) return inv;
      return { ...inv, listingCreditMemos, listingDeposits } as CustomerListingRow;
    });
}

/* ─── Column catalog — default order for the ColumnSelector; Net Due sits
 *  right after Amount and is visible by default (spec §1.6). ─── */
export const CUSTOMER_COLUMN_CATALOG: { key: string; label: string }[] = [
  // PRD §5.4 default order.
  { key: 'invoiceNumber', label: 'Invoice ID' },
  { key: 'docKind', label: 'Invoice Type' },
  { key: 'customer', label: 'Customer' },
  { key: 'documentNumber', label: 'Invoice Number' },
  { key: 'customerPONumber', label: 'Customer PO No.' },
  { key: 'invoiceDate', label: 'Invoice Date' },
  { key: 'dueDate', label: 'Due Date' },
  { key: 'paymentTerms', label: 'Payment Terms' },
  { key: 'invoiceStatus', label: 'Invoice Status' },
  { key: 'sent', label: 'Sent On' },
  { key: 'amount', label: 'Amount' },
  // Vendor listing parity (user 11/3).
  { key: 'discount', label: 'Discount' },
  { key: 'premium', label: 'Premium' },
  // User 11/4: deposits and credit memos read on the invoice row.
  { key: 'customerDeposits', label: 'Customer Deposits' },
  { key: 'creditMemos', label: 'Credit Memos' },
  { key: 'currency', label: 'Currency' },
  { key: 'linked', label: 'Linked Records' },
  // Kept (payment features stay) but hidden by default.
  { key: 'paymentStatus', label: 'Payment Status' },
  { key: 'arAccount', label: 'A/R Account' },
  { key: 'description', label: 'Description' },
  // Audit columns close the row and show by default (10/30), the vendor
  // invoice order: Last Updated By, Last Updated On, Created By, Created On.
  { key: 'updatedBy', label: 'Last Updated By' },
  { key: 'updatedDate', label: 'Last Updated On' },
  { key: 'createdBy', label: 'Created By' },
  { key: 'createdDate', label: 'Created On' },
];

/** Columns available in the selector but off in the default view. */
export const DEFAULT_HIDDEN_CUSTOMER_COLUMNS: string[] = [
  'paymentStatus',
  'arAccount',
  'description',
];

export const DEFAULT_CUSTOMER_COLUMN_VISIBILITY: Record<string, boolean> = Object.fromEntries(
  CUSTOMER_COLUMN_CATALOG.map((c) => [c.key, !DEFAULT_HIDDEN_CUSTOMER_COLUMNS.includes(c.key)]),
);

export const LOCKED_CUSTOMER_COLUMNS: string[] = ['invoiceNumber']; // Invoice ID is always pinned/visible

export interface CustomerInvoiceDataTableProps {
  invoices: CustomerInvoice[];
  /** UNFILTERED dataset for filter option lists — keeps every option
   *  visible while a multiselect filter is active. Defaults to `invoices`. */
  optionRows?: CustomerInvoice[];
  /* Controlled state — parent owns persistence */
  selectedIds: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
  columnOrder: string[];
  onColumnOrderChange: (next: string[]) => void;
  columnVisibility: Record<string, boolean>;
  columnFilters: Record<string, ColumnFilterState>;
  onColumnFilterChange: (columnKey: string, filter: ColumnFilterState) => void;
  onAddColumnFilter: (columnKey: string) => void;
  onHideColumn: (columnKey: string) => void;
  sortConfig: SortConfig | null;
  onSort: (columnKey: string, direction: 'asc' | 'desc' | null) => void;
  frozenColumns: Set<string>;
  onFreezeColumn: (columnKey: string) => void;
  density: DensityOption;
  currentPage: number;
  recordsPerPage: number;
  totalRows: number;
  onPageChange: (page: number) => void;
  onRecordsPerPageChange: (n: number) => void;
  onRowClick?: (invoice: CustomerInvoice) => void;
  onRowAction?: (actionId: CustomerInvoiceActionId, invoiceId: string, e: React.MouseEvent) => void;
  newlyCreatedId?: string | null;
  /** Active search query — text columns highlight matching substrings. */
  searchQuery?: string;
  /** Every row the search listed (filtered + sorted, before paging), so
   *  hidden columns with a match anywhere come out while searching. */
  searchRows?: CustomerInvoice[];
  /** Column the brought-out columns are placed after. */
  searchRevealAfter?: string;
  /** Shown in place of rows when the list is empty. */
  emptyState?: ReactNode;
  /** Table Empty & Error States Standard (11/3/26). */
  emptyConfig?: DataTableEmptyConfig;
}

/** Customer-invoice-flavored DataTable wrapper — the AR fork of the
 *  vendor InvoiceDataTable. The only file that knows about the
 *  CustomerInvoice schema; everything generic lives in data-table/. */
export function CustomerInvoiceDataTable({
  invoices,
  optionRows,
  selectedIds,
  onSelectionChange,
  columnOrder,
  onColumnOrderChange,
  columnVisibility,
  columnFilters,
  onColumnFilterChange,
  onAddColumnFilter,
  onHideColumn,
  sortConfig,
  onSort,
  frozenColumns,
  onFreezeColumn,
  density,
  currentPage,
  recordsPerPage,
  totalRows,
  onPageChange,
  onRecordsPerPageChange,
  onRowClick,
  onRowAction,
  newlyCreatedId,
  searchQuery,
  searchRows,
  searchRevealAfter,
  emptyState,
  emptyConfig,
}: CustomerInvoiceDataTableProps) {
  // PRD §15: users without a permission don't see the action.
  const perms = useArPermissions();
  const renderRowActions = useMemo(
    () =>
      onRowAction
        ? (invoice: CustomerInvoice) => {
            const groups = getCustomerRowActionGroups(invoice, perms);
            if (groups.length === 0) return null;
            return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-muted" aria-label={`Actions for invoice ${invoice.invoiceNumber}`}>
                  <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[230px]" onClick={(e) => e.stopPropagation()}>
                {groups.map((group, gi) => (
                  <Fragment key={gi}>
                    {gi > 0 && <DropdownMenuSeparator />}
                    {group.map((action) => {
                      const Icon = CUSTOMER_ACTION_ICONS[action.id];
                      const tone: ActionTone =
                        action.destructive || action.category === 'destructive'
                          ? 'destructive'
                          // Credit hold reads amber like the vendor Payment Hold.
                          : action.id === 'creditHold' || action.id === 'markDisputed' || action.id === 'flagException'
                            ? 'warning'
                            : action.id === 'approve' || action.id === 'releaseCreditHold' || action.id === 'resolveDispute' || action.id === 'resolveException'
                              ? 'positive'
                              : 'neutral';
                      const cls = actionToneClass(tone);
                      return (
                        <DropdownMenuItem
                          key={action.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRowAction(action.id, invoice.id, e);
                          }}
                          className={cls.item}
                        >
                          <Icon className={`w-4 h-4 mr-2 ${cls.icon}`} />
                          {action.label}
                        </DropdownMenuItem>
                      );
                    })}
                  </Fragment>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            );
          }
        : undefined,
    [onRowAction, perms]
  );

  return (
    <DataTable
      rows={invoices}
      optionRows={optionRows}
      columns={CUSTOMER_INVOICE_COLUMNS}
      getRowId={(invoice) => invoice.id}
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      columnOrder={columnOrder}
      onColumnOrderChange={onColumnOrderChange}
      columnVisibility={columnVisibility}
      columnFilters={columnFilters}
      onColumnFilterChange={onColumnFilterChange}
      onAddColumnFilter={onAddColumnFilter}
      onHideColumn={onHideColumn}
      sortConfig={sortConfig}
      onSort={onSort}
      frozenColumns={frozenColumns}
      onFreezeColumn={onFreezeColumn}
      density={density}
      onRowClick={onRowClick}
      renderRowActions={renderRowActions}
      newlyCreatedId={newlyCreatedId}
      searchQuery={searchQuery}
      searchRows={searchRows}
      searchRevealAfter={searchRevealAfter}
      emptyState={emptyState}
      emptyConfig={emptyConfig}
      currentPage={currentPage}
      recordsPerPage={recordsPerPage}
      totalRows={totalRows}
      onPageChange={onPageChange}
      onRecordsPerPageChange={onRecordsPerPageChange}
    />
  );
}
