import type { DataTableEmptyConfig } from '@/app/components/data-table/DataTable';
import { Fragment, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Banknote,
  CheckCircle2,
  MoreHorizontal,
  Eye,
  Download,
  Ban,
  DollarSign,
  Wallet,
  Edit3,
  ArrowLeftRight,
  ShieldCheck,
  Layers,
  Printer,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import {
  paymentMethodInfo,
  paymentMethodDetail,
} from '@/app/data/paymentMethodCatalog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import type { Payment } from '@/app/data/mockPayments';
import { getCurrency } from '@/app/currency/currencies';
import { formatMoney } from '@/app/currency/money';
import { paymentFx, toPaymentBase } from '@/app/currency/paymentFx';
import { Money } from '@/app/components/currency/Money';
import { CurrencyFlag } from '@/app/components/currency/CurrencyChip';
import { getRowActionGroups, type PaymentActionId } from '@/app/data/paymentActions';
import { actionToneClass, type ActionTone } from '@/app/lib/actionMenuTone';
import {
  VendorCell,
  CreatedByCell,
  highlightText,
  highlightAmount,
  relativeDate,
} from '@/app/components/InvoiceDataTable';
import {
  DataTable,
  OverflowTooltip,
  StatusPill,
  type ColumnDef,
  type ColumnFilterState,
  type DensityOption,
  type SortConfig,
} from '@/app/components/data-table';
import { palette } from '@/styles/tokens';
import { formatUsDate, formatUsDateTime } from '@/app/lib/dueBucket';

const ACTION_ICONS: Record<PaymentActionId, React.ComponentType<{ className?: string }>> = {
  view: Eye,
  edit: Edit3,
  download: Download,
  markPaid: CheckCircle2,
  applyPrepayment: DollarSign,
  reverse: ArrowLeftRight,
  void: Ban,
};

/* ─── TYPE pill — Payment (green / Banknote) vs Prepayment (purple /
 *  Wallet), matching the Record-payment type picker so the icon + colour are
 *  consistent between creation and the data table. */
const TYPE_CONFIG: Record<string, { icon: typeof Banknote; bg: string; fg: string; border: string }> = {
  Payment: { icon: Banknote, bg: palette.emerald[50], fg: palette.emerald[700], border: palette.emerald[200] },
  Prepayment: { icon: Wallet, bg: palette.purple[50], fg: palette.purple[700], border: palette.purple[200] },
};

export function renderPaymentType(type: string, searchQuery?: string): ReactNode {
  const config = TYPE_CONFIG[type] ?? TYPE_CONFIG.Payment;
  const Icon = config.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs whitespace-nowrap"
      style={{ fontWeight: 500, backgroundColor: config.bg, color: config.fg, borderColor: config.border }}
    >
      <Icon className="w-3 h-3" style={{ color: config.fg }} />
      {highlightText(type, searchQuery)}
    </span>
  );
}

/* ─── METHOD pill — partner category colors: Bank rails on the primary blue
 *  ramp, Card on warning amber, Traditional (check / cash) on violet. Icons
 *  come from the shared catalog so every surface shows the same glyph. */
const METHOD_CATEGORY_TONE: Record<string, { bg: string; fg: string; border: string }> = {
  Bank: { bg: palette.blue[50], fg: palette.blue[700], border: palette.blue[200] },
  Card: { bg: palette.amber[50], fg: palette.amber[700], border: palette.amber[200] },
  Traditional: { bg: palette.violet[50], fg: palette.violet[600], border: palette.violet[200] },
};

function methodTone(method: string): { icon: typeof Banknote; bg: string; fg: string; border: string } {
  const info = paymentMethodInfo(method);
  return { icon: info.icon, ...(METHOD_CATEGORY_TONE[info.category] ?? METHOD_CATEGORY_TONE.Bank) };
}

function renderMethod(method: string, searchQuery?: string): ReactNode {
  const config = methodTone(method);
  const Icon = config.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs whitespace-nowrap"
      style={{ fontWeight: 500, backgroundColor: config.bg, color: config.fg, borderColor: config.border }}
    >
      <Icon className="w-3 h-3" style={{ color: config.fg }} />
      {highlightText(method, searchQuery)}
    </span>
  );
}

/** Hover quick-card for a payment method — mirrors the vendor quick-card's
 *  dark-gradient-header treatment. The "how it works" copy, captured fields,
 *  and governance note are pulled from the Partners → Payment Methods catalog;
 *  the masked detail rows are synthesized deterministically per vendor+method. */
function PaymentMethodQuickCard({ method, vendor }: { method: string; vendor: string }) {
  const info = paymentMethodInfo(method);
  const detail = paymentMethodDetail(method, vendor);
  const tone = methodTone(method);
  const Icon = info.icon;
  return (
    <div className="w-[280px]">
      <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
        <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
        <div className="flex items-center gap-3 relative">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: tone.bg }}
          >
            <Icon className="w-[18px] h-[18px]" style={{ color: tone.fg }} />
          </div>
          <div className="min-w-0">
            <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>
              {detail.nickname}
            </p>
            <p className="text-[11px] text-slate-400 truncate">
              {info.label} · {info.category}
            </p>
          </div>
        </div>
      </div>
      <div className="bg-white px-4 py-3 space-y-2.5">
        <p className="text-[11px] text-slate-600 leading-snug">{info.description}</p>
        {detail.rows.length > 0 && (
          <div className="space-y-1.5">
            {detail.rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-3 text-[12px]">
                <span className="text-slate-400 shrink-0">{r.label}</span>
                <span
                  className="text-slate-700 truncate text-right "
                  style={{ fontWeight: 500 }}
                >
                  {r.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="bg-slate-50/60 border-t border-border/40 px-4 py-2 flex items-center gap-2">
        <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="text-[10px] text-slate-500 leading-tight">
          {info.security}{' '}
          <span className="text-slate-400">({info.governance})</span>
        </span>
      </div>
    </div>
  );
}

function MethodCell({ method, vendor, searchQuery }: { method: string; vendor: string; searchQuery?: string }) {
  return (
    <HoverCard openDelay={300} closeDelay={120}>
      <HoverCardTrigger asChild>
        <span className="inline-flex cursor-default">{renderMethod(method, searchQuery)}</span>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden w-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <PaymentMethodQuickCard method={method} vendor={vendor} />
      </HoverCardContent>
    </HoverCard>
  );
}

/* ─── STATUS pills — both lifecycles, same recipe as invoices:
 *  Payment:    Scheduled → Paid → (Cancelled)
 *  Prepayment: Unapplied → Partially applied → Fully applied → (Cancelled)
 */
export const PAYMENT_STATUS_STYLES: Record<
  string,
  { bg: string; fg: string; border: string; icon?: React.ComponentType<{ className?: string }> }
> = {
  Scheduled: { bg: palette.blue[50], fg: palette.blue[700], border: palette.blue[200] },
  Paid: { bg: palette.emerald[100], fg: palette.emerald[800], border: palette.emerald[300], icon: CheckCircle2 },
  Reversed: { bg: palette.rose[50], fg: palette.rose[700], border: palette.rose[200], icon: ArrowLeftRight },
  Cancelled: { bg: palette.red[50], fg: palette.red[700], border: palette.red[200] },
  Unapplied: { bg: palette.amber[50], fg: palette.amber[700], border: palette.amber[200] },
  'Partially Applied': { bg: palette.orange[50], fg: palette.orange[700], border: palette.orange[200] },
  'Fully Applied': { bg: palette.emerald[50], fg: palette.emerald[700], border: palette.emerald[200] },
};

const STATUS_FALLBACK_STYLE = { bg: palette.slate[100], fg: palette.slate[600], border: palette.slate[300] };

/** Payment status DISPLAY copy only (feedback 7/22/26): a cancelled
 *  payment reads "Void" wherever a payment status shows — Cancelled is
 *  an INVOICE state, Void is the payment one. An advance wears exactly
 *  three names everywhere — Fully applied / Partially applied / Unapplied
 *  (BA 9/28: one $25 advance read three different labels on three
 *  surfaces). The underlying status values stay unchanged in state,
 *  filters, and the action matrix. */
// Prepayments read exactly Unapplied / Partially applied / Fully applied
// (user 10/12, supersedes the 9/28 "Applied" short form); legacy
// "Applied" on an advance reads Fully applied too.
export const paymentStatusLabel = (status: string) =>
  status === 'Cancelled' ? 'Void' : status === 'Applied' ? 'Fully Applied' : status;

const displayStatusOf = (p: Pick<Payment, 'type' | 'status'>): string =>
  p.type === 'Prepayment' && (p.status === 'Paid' || p.status === 'Applied') ? 'Fully Applied' : p.status;

export function renderPaymentStatus(status: string, searchQuery?: string): ReactNode {
  const s = PAYMENT_STATUS_STYLES[status] ?? STATUS_FALLBACK_STYLE;
  return <StatusPill label={highlightText(paymentStatusLabel(status), searchQuery)} style={s as any} />;
}

/* ─── Applied to — partner "Linked Entities" style: the first invoice shows
 *  as an INV type pill + number, the rest collapse into a primary-blue
 *  "+N more" that opens the overflow tooltip. Prepayments keep their
 *  application-state text. */
const INV_PILL_STYLE = { bg: palette.blue[100], fg: palette.blue[700] };

/* Invoice click-through — registered by the PaymentDataTable wrapper (which
 * receives the navigation callback as a prop) so the static column render
 * below can open an invoice without threading context through DataTable. */
let openInvoiceByNumber: ((invoiceNumber: string) => void) | null = null;

/** The application state a prepayment's Applied To cell prints. */
function prepaymentAppliedLabel(payment: Payment): string {
  if (payment.status === 'Fully Applied') {
    const n = payment.appliedInvoices.length;
    return `Fully Applied · ${n} Invoice${n === 1 ? '' : 's'}`;
  }
  if (payment.status === 'Partially Applied' || payment.status === 'Unapplied') return payment.status;
  return '';
}

/** Everything the Applied To cell prints (the "+N more" invoices included,
 *  since their numbers sit one hover away). */
function appliedToSearchText(payment: Payment): string {
  if (payment.type === 'Prepayment') {
    const left = payment.unappliedAmount > 0 ? `$${payment.unappliedAmount.toLocaleString()} left` : '';
    return [prepaymentAppliedLabel(payment), left].filter(Boolean).join(' ');
  }
  return payment.appliedInvoices.map((i) => i.invoiceNumber).join(' ');
}

const checkPrintLabel = (row: Payment): string => {
  if (row.paymentMethod !== 'Check') return '';
  if (!row.checkPrint) return 'Unprinted';
  if (row.checkPrint.status === 'manual') return 'Manual Check';
  if (row.checkPrint.status === 'void') return 'Void';
  return 'Printed';
};

function renderAppliedTo(payment: Payment, searchQuery?: string): ReactNode {
  if (payment.type === 'Prepayment') {
    const tone =
      payment.status === 'Fully Applied'
        ? palette.emerald[700]
        : payment.status === 'Cancelled'
          ? palette.slate[400]
          : palette.amber[700];
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        {/* Cell-standard size (user 10/5): the application state reads at
            the same 13px as every other cell. */}
        <span className="text-[13px]" style={{ fontWeight: 500, color: tone }}>
          {highlightText(prepaymentAppliedLabel(payment) || ', ', searchQuery)}
        </span>
        {payment.unappliedAmount > 0 && (
          <span className="text-[10px] text-muted-foreground/70">
            {highlightAmount(`$${payment.unappliedAmount.toLocaleString()}`, searchQuery)} left
          </span>
        )}
      </span>
    );
  }
  const all = payment.appliedInvoices;
  if (all.length === 0) return null;
  const first = all[0];
  const others = all.slice(1);
  return (
    <div className="flex items-center gap-1.5 flex-nowrap whitespace-nowrap min-w-0">
      {/* Partner No. of Items spec: plain text-sm identifier (truncates when
          tight) with the MoreBadge pinned beside it, no type pill. */}
      <button
        type="button"
        // Cell-standard type scale (user 10/5): the invoice ref sits at
        // the same size and weight as every other cell — no outsized
        // identifier. Black at rest, blue + underline on hover.
        className="text-[13px] text-foreground hover:text-primary hover:underline transition-colors cursor-pointer p-0 bg-transparent border-0 truncate min-w-0"
        style={{ fontWeight: 400 }}
        title={`$${first.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} applied · open invoice`}
        onClick={(e) => {
          e.stopPropagation();
          openInvoiceByNumber?.(first.invoiceNumber);
        }}
      >
        {/* Searchable, so it highlights like every other matched cell (10/9/26). */}
        {highlightText(first.invoiceNumber, searchQuery)}
      </button>
      {others.length > 0 && (
        <OverflowTooltip
          category="Applied Invoices"
          onItemClick={(item) => openInvoiceByNumber?.(item.id)}
          items={others.map((inv) => ({
            id: inv.invoiceNumber,
            name: inv.invoiceNumber,
            subtitle: `$${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} applied`,
            initials: 'INV',
            avatarBg: INV_PILL_STYLE.bg,
            avatarFg: INV_PILL_STYLE.fg,
          }))}
        >
          {/* Partner "+N more" spec (DataTableStyleReference MoreBadge):
              text-xs, weight 500, primary-600 ink. */}
          <span
            className="text-xs cursor-pointer transition-colors shrink-0 hover:underline"
            style={{ color: 'var(--color-blue-600)', fontWeight: 500 }}
          >
            +{others.length} more
          </span>
        </OverflowTooltip>
      )}
    </div>
  );
}

const fmtMoney = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ─── Column definitions — PRD §4 table ─── */
/** Run membership chip → deep-links to the run's screen (7/29/26). A
 *  component (not inline render) so it can reach the router. */
function RunChip({ runId, runLabel }: { runId: string; runLabel?: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 shrink-0 px-1.5 py-px rounded-full text-[10px] border border-indigo-100 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
      style={{ fontWeight: 600 }}
      title={runLabel ?? 'Part of a payment run'}
      onClick={(e) => {
        e.stopPropagation();
        navigate(`/payments-v2/runs/${encodeURIComponent(runId)}`);
      }}
    >
      <Layers className="w-2.5 h-2.5" /> Run
    </button>
  );
}

export const PAYMENT_COLUMNS: ColumnDef<Payment>[] = [
  {
    key: 'paymentNumber',
    filterable: false,
    label: 'Payment ID',
    minWidth: 160,
    defaultWidth: 180,
    sortable: true,
    locked: true,
    sticky: 'left',
    filterType: 'text',
    getValue: (row) => row.paymentNumber,
    render: (row, { density, searchQuery }) => (
      <span className="flex items-center gap-1.5 min-w-0">
        {/* The number is a LINK (user 10/5): black at rest, blue +
            underline on hover, opens the payment in a NEW TAB. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            window.open(`/payments-v2/${encodeURIComponent(row.paymentNumber)}`, '_blank', 'noopener');
          }}
          className={`truncate whitespace-nowrap text-left cursor-pointer bg-transparent border-0 p-0 text-slate-800 hover:text-primary hover:underline underline-offset-2 transition-colors ${
            density === 'comfort' ? 'text-[13px]' : 'text-sm'
          }`}
          style={{ fontWeight: 400 }}
        >
          {highlightText(row.paymentNumber, searchQuery)}
        </button>
        {/* Payment run grouping (7/23/26): a Run chip marks payments approved
            together on a run. Clicking deep-links to the run's screen (7/29/26). */}
        {row.runId && <RunChip runId={row.runId} runLabel={row.runLabel} />}
      </span>
    ),
  },
  {
    key: 'type',
    label: 'Type',
    minWidth: 130,
    defaultWidth: 150,
    sortable: true,
    filterType: 'multiselect',
    uniqueValues: (rows) => Array.from(new Set(rows.map((r) => r.type))).sort(),
    getValue: (row) => row.type,
    render: (row, { searchQuery }) => renderPaymentType(row.type, searchQuery),
  },
  {
    key: 'vendor',
    label: 'Vendor',
    minWidth: 200,
    defaultWidth: 240,
    sortable: true,
    filterType: 'text',
    getValue: (row) => row.vendor,
    render: (row, ctx) => (
      <VendorCell vendor={row.vendor} description={row.memo} density={ctx.density} searchQuery={ctx.searchQuery} />
    ),
  },
  {
    key: 'reference',
    filterable: false,
    label: 'Reference',
    minWidth: 140,
    defaultWidth: 170,
    sortable: true,
    filterType: 'text',
    getValue: (row) => row.reference,
    render: (row, { searchQuery }) =>
      // Empty cells stay blank (ERP-9875, 11/4): no dash in any table.
      row.reference?.trim() ? (
        <span className="text-foreground">{highlightText(row.reference, searchQuery)}</span>
      ) : null,
  },
  {
    key: 'paymentMethod',
    label: 'Method',
    minWidth: 140,
    defaultWidth: 170,
    sortable: true,
    filterType: 'multiselect',
    uniqueValues: (rows) => Array.from(new Set(rows.map((r) => r.paymentMethod))).sort(),
    getValue: (row) => row.paymentMethod,
    render: (row, { searchQuery }) => (
      <MethodCell method={row.paymentMethod} vendor={row.vendor} searchQuery={searchQuery} />
    ),
  },
  {
    key: 'bankAccount',
    label: 'Pay-From Account',
    minWidth: 150,
    defaultWidth: 180,
    sortable: true,
    filterType: 'multiselect',
    uniqueValues: (rows) => Array.from(new Set(rows.map((r) => r.bankAccount))).sort(),
    getValue: (row) => row.bankAccount,
    // Searchable, so it highlights like every other matched cell (10/9/26).
    render: (row, { searchQuery }) => <span className="text-muted-foreground">{highlightText(row.bankAccount, searchQuery)}</span>,
  },
  {
    key: 'paymentDate',
    label: 'Date',
    minWidth: 165,
    defaultWidth: 205,
    sortable: true,
    filterType: 'date',
    getValue: (row) => row.paymentDate,
    searchText: (row) => formatUsDateTime(row.paymentDate, row.id),
    // Scheduled payments call out WHICH date the money moves (feedback
    // 7/14/26) — the date doubles as the scheduled-for date until it's paid.
    render: (row, { searchQuery }) =>
      row.status === 'Scheduled' ? (
        <span className="inline-flex flex-col leading-tight">
          <span className="text-muted-foreground whitespace-nowrap">{highlightText(formatUsDateTime(row.paymentDate, row.id), searchQuery)}</span>
          <span className="text-[10px] text-blue-600" style={{ fontWeight: 600 }}>Scheduled for this date</span>
        </span>
      ) : (
        <span className="text-muted-foreground whitespace-nowrap">{highlightText(formatUsDateTime(row.paymentDate, row.id), searchQuery)}</span>
      ),
  },
  {
    key: 'appliedTo',
    label: 'Applied To',
    minWidth: 200,
    defaultWidth: 260,
    sortable: false,
    filterType: 'text',
    getValue: (row) =>
      row.type === 'Prepayment' ? row.status : row.appliedInvoices.map((i) => i.invoiceNumber).join(', '),
    searchText: appliedToSearchText,
    render: (row, { searchQuery }) => renderAppliedTo(row, searchQuery),
  },
  {
    key: 'amount',
    label: 'Amount',
    tooltip: "In each payment's own currency. Sorting and the range filter use the base currency equivalent.",
    minWidth: 120,
    defaultWidth: 150,
    align: 'right',
    sortable: true,
    filterType: 'range',
    // Currency & Exchange Rates: the amount is in the payment currency (the
    // symbol follows the Currency column); hover for its base value at the
    // payment's rate. Sorting and the range filter compare in the base.
    getValue: (row) => toPaymentBase(row, row.amount),
    getSortValue: (row) => toPaymentBase(row, row.amount),
    searchText: (row) => formatMoney(row.amount, row.currency),
    // Same weight as every other column (partner table pattern — no
    // heavier font for money columns, design feedback 7/13/26).
    render: (row, { searchQuery }) => (
      <span className="text-foreground" style={{ fontWeight: 400 }}>
        <Money value={row.amount} currency={row.currency} fx={paymentFx(row)} role="payment currency">
          {highlightAmount(formatMoney(row.amount, row.currency), searchQuery)}
        </Money>
      </span>
    ),
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
    // Flag + code, as the invoice listing shows a currency; the name rides the search.
    searchText: (row) => `${row.currency} ${getCurrency(row.currency)?.name ?? ''}`,
    render: (row, { searchQuery }) => (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <CurrencyFlag code={row.currency} size={16} />
        <span>{highlightText(row.currency, searchQuery)}</span>
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    minWidth: 150,
    defaultWidth: 180,
    sortable: true,
    filterType: 'multiselect',
    // A prepayment only ever reads Unapplied / Partially applied / Fully
    // applied (user 10/12); a legacy Paid or Applied reads Fully applied.
    uniqueValues: (rows) => Array.from(new Set(rows.map((r) => displayStatusOf(r)))).sort(),
    getValue: (row) => displayStatusOf(row),
    searchText: (row) => paymentStatusLabel(displayStatusOf(row)),
    render: (row, { searchQuery }) => renderPaymentStatus(displayStatusOf(row), searchQuery),
  },
  {
    key: 'checkPrint',
    label: 'Check Print',
    minWidth: 120,
    defaultWidth: 150,
    sortable: false,
    filterType: 'multiselect',
    uniqueValues: () => ['Printed', 'Unprinted', 'Manual Check', 'Void'],
    getValue: checkPrintLabel,
    render: (row, { searchQuery }) => {
      if (row.paymentMethod !== 'Check') return null;
      if (!row.checkPrint) {
        return (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-px rounded border text-[10px]"
            style={{ fontWeight: 600, backgroundColor: '#FFFBEB', color: '#B45309', borderColor: '#FDE68A' }}
          >
            <Printer className="w-2.5 h-2.5" />
            {highlightText('Unprinted', searchQuery)}
          </span>
        );
      }
      if (row.checkPrint.status === 'manual') {
        return (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-px rounded border text-[10px]"
            style={{ fontWeight: 600, backgroundColor: '#F0FDF4', color: '#15803D', borderColor: '#BBF7D0' }}
          >
            <Printer className="w-2.5 h-2.5" />
            {highlightText('Manual Check', searchQuery)}
          </span>
        );
      }
      if (row.checkPrint.status === 'void') {
        return (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-px rounded border text-[10px]"
            style={{ fontWeight: 600, backgroundColor: '#FFF1F2', color: '#BE123C', borderColor: '#FECDD3' }}
          >
            <Printer className="w-2.5 h-2.5" />
            {highlightText('Void', searchQuery)}
          </span>
        );
      }
      return (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-px rounded border text-[10px]"
          style={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }}
        >
          <Printer className="w-2.5 h-2.5" />
          {highlightText('Printed', searchQuery)}
        </span>
      );
    },
  },
  {
    key: 'memo',
    label: 'Description',
    minWidth: 200,
    defaultWidth: 260,
    sortable: true,
    filterType: 'text',
    getValue: (row) => row.memo,
    render: (row, { searchQuery }) => (
      <span className="text-muted-foreground truncate block" title={row.memo}>
        {highlightText(row.memo, searchQuery)}
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
      <CreatedByCell name={row.updatedBy ?? row.createdBy} vendor={row.vendor} density={density} searchQuery={searchQuery} />
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
      <CreatedByCell name={row.createdBy} vendor={row.vendor} density={density} searchQuery={searchQuery} />
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

interface PaymentDataTableProps {
  payments: Payment[];
  /** UNFILTERED dataset for filter option lists — keeps every option
   *  visible while a multiselect filter is active. Defaults to `payments`. */
  optionRows?: Payment[];
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
  onRowClick?: (payment: Payment) => void;
  onRowAction?: (actionId: PaymentActionId, paymentId: string, e: React.MouseEvent) => void;
  newlyCreatedId?: string | null;
  /** Active search query — text columns highlight matching substrings. */
  searchQuery?: string;
  /** Every row the search listed (after filters, before pagination), so
   *  hidden columns that matched can be brought out. */
  searchRows?: Payment[];
  /** Column the brought-out hidden columns sit after. */
  searchRevealAfter?: string;
  /** Opens an applied invoice's detail page (by invoice number). */
  onOpenInvoice?: (invoiceNumber: string) => void;
  /** Table Empty & Error States Standard (11/3/26). */
  emptyConfig?: DataTableEmptyConfig;
}

/** Payment-flavored DataTable wrapper — the only file that knows about the
 *  Payment schema. Mirrors InvoiceDataTable's structure exactly. */
export function PaymentDataTable({
  payments,
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
  onOpenInvoice,
  emptyConfig,
}: PaymentDataTableProps) {
  // Static column renders read this at click time.
  openInvoiceByNumber = onOpenInvoice ?? null;
  const renderRowActions = useMemo(
    () =>
      onRowAction
        ? (payment: Payment) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-muted">
                  <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[230px]" onClick={(e) => e.stopPropagation()}>
                {getRowActionGroups(payment.status).map((group, gi) => (
                  <Fragment key={gi}>
                    {gi > 0 && <DropdownMenuSeparator />}
                    {group.map((action) => {
                      const Icon = ACTION_ICONS[action.id];
                      const tone: ActionTone =
                        action.category === 'destructive'
                          ? 'destructive'
                          : action.id === 'applyPrepayment' || action.id === 'markPaid'
                            ? 'positive'
                            : 'neutral';
                      const cls = actionToneClass(tone);
                      return (
                        <DropdownMenuItem
                          key={action.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRowAction(action.id, payment.id, e);
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
          )
        : undefined,
    [onRowAction]
  );

  return (
    <DataTable
      emptyConfig={emptyConfig}
      rows={payments}
      optionRows={optionRows}
      columns={PAYMENT_COLUMNS}
      getRowId={(payment) => payment.id}
      // No left accent strips — row meaning is carried by the type and
      // status pills alone (design feedback 7/14/26).
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
      currentPage={currentPage}
      recordsPerPage={recordsPerPage}
      totalRows={totalRows}
      onPageChange={onPageChange}
      onRecordsPerPageChange={onRecordsPerPageChange}
    />
  );
}
