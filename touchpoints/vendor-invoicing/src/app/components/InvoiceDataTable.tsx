import type { DataTableEmptyConfig } from '@/app/components/data-table/DataTable';
import { Fragment, useMemo, type ReactNode } from 'react';
import { partnerVendorUrl } from '@/app/data/mockVendors';
import { formatUsDate, formatUsDateTime, overdueDaysOf, overdueLabel, isInvoiceOverdue, MOST_OVERDUE_SORT_KEY } from '@/app/lib/dueBucket';
import {
  FileText,
  Truck,
  Calculator,
  Package,
  AlertTriangle,
  Lock,
  CheckCircle2,
  MoreHorizontal,
  Eye,
  Edit3,
  Download,
  Ban,
  DollarSign,
  GitCompare,
  Printer,
  RotateCcw,
  Archive,
  Undo2,
  CheckCheck,
  XCircle,
  Wallet, Pencil, Banknote, ArchiveRestore } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { Money } from '@/app/components/currency/Money';
import { CurrencyFlag } from '@/app/components/currency/CurrencyChip';
import { getCurrency } from '@/app/currency/currencies';
import { formatCompactMoney, formatMoney } from '@/app/currency/money';
import { invoiceFx, toInvoiceBase } from '@/app/currency/invoiceFx';
import { vendorCurrencyOf } from '@/app/currency/vendorCurrency';
import { PaymentTermDetailsModal } from '@/app/components/PaymentTermDetailsModal';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog';
import {
  Mail,
  Building2,
  Phone,
  MapPin,
  ExternalLink,
  Receipt,
  X,
  BadgeCheck,
  Briefcase,
  ZoomIn,
  Linkedin,
  Twitter,
  Globe,
  MessageCircle,
} from 'lucide-react';
import {
  Tooltip as PTooltip,
  TooltipContent as PTooltipContent,
  TooltipTrigger as PTooltipTrigger,
} from '@/app/components/ui/tooltip';
import { PaymentHoldLock } from '@/app/components/PaymentHoldLock';
import { useState } from 'react';
import type { Invoice } from '@/app/data/mockInvoices';
import { getRowActionGroups, type InvoiceActionId } from '@/app/data/invoiceActions';
import { actionToneClass, type ActionTone } from '@/app/lib/actionMenuTone';
import { VendorAvatar } from '@/app/components/VendorAvatar';
import {
  DataTable,
  OverflowTooltip,
  StatusPill,
  PersonAvatar,
  PhotoPersonAvatar,
  getPersonPhotoUrl,
  searchPatternSource,
  // eslint-disable-next-line no-duplicate-imports
} from '@/app/components/data-table';
import { userPhotoFor } from '@/app/utils/userAvatar';
import { PaymentTermCard } from '@/app/components/vendors/PaymentTermCard';
import { resolvePaymentTerm } from '@/app/data/paymentTermPresets';
import {
  discountAmountOn,
  discountDaysLeft,
  discountIsLive,
  discountTermsFor,
  paymentTermsFor,
} from '@/app/lib/runMath';
import {
  type ColumnDef,
  type ColumnFilterState,
  type DensityOption,
  type SortConfig,
} from '@/app/components/data-table';
// Design-system palette — every hardcoded hex below references palette[hue][stop]
// so changing a token in src/styles/tokens.ts updates the pills here too.
import { palette } from '@/styles/tokens';
import { AmountWithPrepaidNote } from '@/app/components/payments/PrepaidOriginNote';

export const ACTION_ICONS: Record<InvoiceActionId, React.ComponentType<{ className?: string }>> = {
  view: Eye,
  export: Download,
  print: Printer,
  submit: GitCompare,
  resubmit: RotateCcw,
  edit: Pencil,
  approve: CheckCheck,
  reject: Ban,
  flagException: AlertTriangle,
  resolve: CheckCircle2,
  addPayment: Banknote,
  addPrepayment: Wallet,
  reversePayment: Undo2,
  paymentHold: Lock,
  releaseHold: RotateCcw,
  addCreditMemo: Receipt,
  archive: Archive,
  cancel: XCircle,
  uncancel: ArchiveRestore,
  restore: ArchiveRestore,
  download: Download,
  match: GitCompare,
};

/* ─── TYPE palette — aligned with the Create Vendor Invoice flow:
 *    Inventory Invoice → Blue · Pre-Invoice → Violet (dashed) ·
 *    Standalone Invoice → Teal (user 10/10: one identity system-wide)
 *
 *  The creation flow modal shows two top-level routes — "Inventory Invoice"
 *  (blue icon) and "Standalone Invoice" (purple icon). The Type column
 *  mirrors that split: the three inventory sub-types stay inside the blue
 *  band (blue / sky / indigo for differentiation), while Standalone owns
 *  the purple slot. Status's Pending Approval moved off purple to amber
 *  so the two columns never collide on the same hue.
 */
export const TYPE_CONFIG: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    label: string;
    bg: string;
    fg: string;
    border: string;
    /** Pre-invoice only: dashed border marks it as a deposit, not an invoice. */
    dashed?: boolean;
  }
> = {
  // Type identities follow the three creation flows (9/5/26, supersedes
  // the 7/15 green/purple/amber set): BLUE Inventory Invoice, VIOLET
  // dashed Pre-Invoice (the system-wide prepayment identity; dashed = a
  // deposit, not an invoice), TEAL Standalone — the same colors and
  // icons as the New-vendor-invoice starting cards, so the pill and the
  // flow that made it read as one thing everywhere.
  'PO-based': {
    icon: Package,
    label: 'Inventory Invoice',
    bg: palette.blue[50],
    fg: palette.blue[700],
    border: palette.blue[200],
  },
  'Receiving-based': {
    icon: Package,
    label: 'Inventory Invoice',
    bg: palette.blue[50],
    fg: palette.blue[700],
    border: palette.blue[200],
  },
  'GRN-based': {
    icon: Package,
    label: 'Inventory Invoice',
    bg: palette.blue[50],
    fg: palette.blue[700],
    border: palette.blue[200],
  },
  Standalone: {
    icon: Calculator,
    label: 'Standalone Invoice',
    bg: palette.teal[50],
    fg: palette.teal[700],
    border: palette.teal[200],
  },
  'Pre-Invoice': {
    icon: Wallet,
    label: 'Pre-Invoice',
    bg: palette.violet[50],
    fg: palette.violet[700],
    border: palette.violet[300],
    dashed: true,
  },
};

/* Plain-language explainers for each invoice type, written for
 * non-accountants (peer review 7/7/26; taxonomy rev 7/9/26). Shown as
 * tooltips on the type pills here and on the detail-page header pill. */
export const TYPE_EXPLAINER: Record<string, string> = {
  Standalone: 'Invoice created with no purchase order or receiving document. Example: utilities, rent, or subscriptions.',
  'PO-based': 'Invoice created against one or more receiving documents.',
  'Receiving-based': 'Invoice created against one or more receiving documents.',
  'GRN-based': 'Invoice created against one or more receiving documents.',
  // Compact pills say "Pre-Invoice"; the full confirmed name rides the
  // tooltip so it stays accessible (GPT QC13, 9/30 — decision #42).
  'Pre-Invoice': 'Pre-Invoice (Pro-Forma): an invoice created against an open purchase order before items are received. Payments made at this stage are recorded as prepayments.',
};

/** Partner-module "example" tooltip recipe (BA 9/6): body text, then an
 *  inset EXAMPLE card — slate tile, eyebrow — never an inline
 *  bold "Example:" run. Splits legacy "… Example: …" strings so every
 *  explainer tooltip wears the same anatomy system-wide. */
export function TooltipExplainer({ text }: { text: string }) {
  const [body, example] = text.split(/\s*Example:\s*/);
  return (
    <div>
      <p className="text-[11px] leading-snug text-slate-600">{body}</p>
      {example && (
        <div className="mt-1.5 rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5">
          <p className="text-[9px] text-slate-400" style={{ fontWeight: 600 }}>Example</p>
          <p className="text-[11px] text-slate-600 leading-snug mt-0.5">{example}</p>
        </div>
      )}
    </div>
  );
}

// Exported (8/12/26): the run authoring Step 1 Type column wears the
// same pill as the listing.
export function renderType(type: string, searchQuery?: string): ReactNode {
  const explainer = TYPE_EXPLAINER[type] ?? TYPE_EXPLAINER.Standalone;
  const config = TYPE_CONFIG[type] ?? TYPE_CONFIG.Standalone;
  const Icon = config.icon;
  return (
    <PTooltip delayDuration={300}>
      <PTooltipTrigger asChild>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs whitespace-nowrap cursor-default ${config.dashed ? 'border border-dashed' : 'border'}`}
          style={{
            fontWeight: config.dashed ? 600 : 500,
            backgroundColor: config.bg,
            color: config.fg,
            borderColor: config.border,
          }}
        >
          <Icon className="w-3 h-3" style={{ color: config.fg }} />
          {highlightText(config.label, searchQuery)}
        </span>
      </PTooltipTrigger>
      <PTooltipContent side="top" className="max-w-[260px]">
        <TooltipExplainer text={explainer} />
      </PTooltipContent>
    </PTooltip>
  );
}

/* ─── STATUS palette — design-feedback rev.
 *
 *  Color logic (kept consistent with the partner module's pill style):
 *
 *    Pending Approval → Purple              (waiting on a human action — thoughtful pause)
 *    Approved         → Light Emerald       (approved & queued; green WITHOUT icon)
 *    Partially Paid   → Slate Grey          (in motion / partial; neutral progress)
 *    Paid in Full     → Deep Emerald + ✓    (terminal success; green WITH CheckCircle2 icon
 *                                            so it reads distinct from "Approved" at a glance)
 *    Exception        → Orange + ⚠          (needs intervention)
 *    Payment Hold     → Yellow + 🔒         (intentionally blocked — softer than Exception's orange)
 *    Cancelled        → Red                 (terminally void; red WITHOUT icon)
 *
 *  Notes:
 *    • Approved and Paid-in-Full deliberately share the green family but at
 *      different tones, with the CheckCircle2 icon as the differentiator.
 *      Same idea partner uses with its Active/Archived split.
 *    • Payment Hold (yellow) sits adjacent to Exception (orange) in the
 *      warning band but the icon + tone separation makes them readable.
 *    • Draft has been retired from the workflow; if a Draft row sneaks in,
 *      the renderStatus fallback renders a neutral muted pill.
 *
 *  No conflicts with TYPE_CONFIG (Blue / Teal / Pink / Indigo):
 *    – Type uses pink/magenta for Non-PO; Status uses purple for Pending Approval.
 *      They live in different hue bands and never read as the same.
 */
const STATUS_STYLES: Record<
  string,
  { bg: string; fg: string; border: string; icon?: React.ComponentType<{ className?: string }> }
> = {
  // Indigo — waiting on action
  'Pending Approval': { bg: palette.indigo[50], fg: palette.indigo[700], border: palette.indigo[200] },
  // Light emerald — awaiting payment (original palette restored, user
  // direction 7/15/26)
  Approved: { bg: palette.emerald[50], fg: palette.emerald[700], border: palette.emerald[200] },
  // Orange — partial payment in motion (warning band, distinct from Exception/Hold)
  'Partially Paid': { bg: palette.orange[50], fg: palette.orange[700], border: palette.orange[200] },
  // Deep emerald + CheckCircle2 — terminal success
  'Paid in Full': { bg: palette.emerald[100], fg: palette.emerald[800], border: palette.emerald[300], icon: CheckCircle2 },
  Settled: { bg: palette.emerald[50], fg: palette.emerald[700], border: palette.emerald[200], icon: CheckCircle2 },
  // Purple pair — the pre-invoice prepaid lifecycle (advance money in
  // motion, then fully advanced). Purple = the prepayment family.
  'Partially Prepaid': { bg: palette.purple[50], fg: palette.violet[600], border: palette.violet[200] },
  Prepaid: { bg: palette.violet[100], fg: palette.violet[700], border: palette.violet[300], icon: CheckCircle2 },
  // Dark red + AlertTriangle — needs intervention (mirrors the Approved/Paid
  // light-vs-deep pattern, with the higher-priority state earning the icon).
  // Amber, the exception CTA's color (user 9/22; 7/15 rule).
  Exception: { bg: palette.amber[100], fg: palette.amber[800], border: palette.amber[300], icon: AlertTriangle },
  // Yellow + Lock — intentionally held. Light-tone pattern (-50/-700/-200)
  // to match Approved / Pending Approval / Partially Paid / Cancelled.
  'Payment Hold': { bg: palette.yellow[50], fg: palette.yellow[700], border: palette.yellow[200], icon: Lock },
  // Rose — approver said no. Distinct from Cancelled (which can be
  // any-state user-driven) and from Exception (which is recoverable);
  // Rejected is terminal + approver-driven, so a separate hue.
  Rejected: { bg: palette.rose[50], fg: palette.rose[700], border: palette.rose[200] },
  // Light red, no icon — terminally cancelled
  Cancelled: { bg: palette.red[50], fg: palette.red[700], border: palette.red[200] },
};

/** Fallback used when data carries a status no longer in the workflow
 *  (e.g. a legacy "Draft" row). Renders a quiet muted pill so it doesn't
 *  imply a meaning it shouldn't. */
const STATUS_FALLBACK_STYLE = {
  bg: palette.slate[100],
  fg: palette.slate[600],
  border: palette.slate[300],
};

/** Display copy for a raw invoice status. Eli review 7/15/26: the
 *  "Awaiting Payment" rename is OVERRULED — approval and payment are
 *  separate axes, so 'Approved' reads plainly as Approved (a fact about
 *  the approval column, not a payment-readiness claim). Raw status keys
 *  never change. */
export function statusDisplayLabel(status: string, _invoiceType?: string): string {
  // "Exception" is back (Eli 9/24, user 9/25): it's the standard
  // bookkeeping term, so the 9/22 display-only "Problem" rename is
  // reverted and status renders exactly as stored.
  return status;
}

/* ─── Two-axis status (Eli review 7/15/26; taxonomy finalized 7/17/26) ─
 * The single raw status mixes two orthogonal concepts. For display the
 * listing derives BOTH axes from it:
 *   - Approval / control: whose desk is this on
 *     (Pending approval / Approved / On hold / Exception / Rejected /
 *     Cancelled). On hold moved HERE from the payment axis — a hold is
 *     a control state, not a money state.
 *   - Payment: where's the money. Final enum: Unpaid / Partially paid /
 *     Paid in full / Scheduled (a payment is approved or scheduled, not
 *     cleared) / Void (the invoice was cancelled) / Settled (zeroed without cash, e.g.
 *     a full credit memo). Partially prepaid and Prepaid were REMOVED:
 *     prepaid coverage folds into Partially paid / Paid in full.
 * NetSuite/SAP precedent: approval status is its own field. */
type StatusPillStyle = { bg: string; fg: string; border: string; icon?: React.ComponentType<{ className?: string }> };

const APPROVAL_STYLES: Record<string, StatusPillStyle> = {
  'Pending Approval': STATUS_STYLES['Pending Approval'],
  Approved: STATUS_STYLES.Approved,
  'On hold': STATUS_STYLES['Payment Hold'],
  Exception: STATUS_STYLES.Exception,
  Rejected: STATUS_STYLES.Rejected,
  Cancelled: STATUS_STYLES.Cancelled,
  // Archived reads RED, same as the detail header (Eli 10/5).
  Archived: { bg: palette.red[50], fg: palette.red[700], border: palette.red[200] },
};

const PAYMENT_AXIS_STYLES: Record<string, StatusPillStyle> = {
  Unpaid: { bg: palette.slate[100], fg: palette.slate[600], border: palette.slate[300] },
  Scheduled: { bg: palette.blue[50], fg: palette.blue[700], border: palette.blue[200] },
  // Committed to an OPEN run (user 9/23): the money hasn't moved, but
  // the invoice is spoken for — indigo, between Unpaid and Scheduled.
  'In Payment Run': { bg: palette.indigo[50], fg: palette.indigo[700], border: palette.indigo[200] },
  'Partially Paid': STATUS_STYLES['Partially Paid'],
  'Paid in Full': STATUS_STYLES['Paid in Full'],
  Settled: { bg: palette.emerald[50], fg: palette.emerald[700], border: palette.emerald[200] },
  Void: { bg: palette.red[50], fg: palette.red[700], border: palette.red[200] },
};

export function invoiceStatusAxes(
  status: string,
  inv?: Pick<Invoice, 'is_payment_held' | 'outstandingBalance' | 'amount'> & Partial<Pick<Invoice, 'creditedAmount' | 'isArchived'>> & { paymentScheduled?: boolean; inPaymentRun?: boolean },
): { approval: string; payment: string | null } {
  const base = invoiceStatusAxesBase(status);
  if (!inv) return base;
  // Archived is a record fact over the status (Mahreen 10/10): the row
  // reads Archived, the money axis keeps its truth.
  if (inv.isArchived) return { ...base, approval: 'Archived' };
  // Locked in an open (pre-execution) run (user 9/23): the Payment
  // Status axis says so instead of a silent Unpaid.
  if (inv.inPaymentRun && base.payment === 'Unpaid' && !inv.paymentScheduled) {
    return { ...base, payment: 'In Payment Run' };
  }
  // A recorded run's scheduled money shows on the row (9/22/26 review
  // response, GPT C02-D1): the Payment Status axis reads Scheduled while
  // the cash waits for its payment date — never a silent Unpaid.
  if (inv.paymentScheduled && base.payment === 'Unpaid') {
    return { ...base, payment: 'Scheduled' };
  }
  // Payment hold never touches either axis (ERP-8796): it is a flag shown
  // as the lock beside the Invoice ID, and filters on its own.
  return base;
}

function invoiceStatusAxesBase(status: string): { approval: string; payment: string | null } {
  switch (status) {
    case 'Pending Approval': return { approval: 'Pending Approval', payment: 'Unpaid' };
    case 'Approved': return { approval: 'Approved', payment: 'Unpaid' };
    case 'Partially Paid': return { approval: 'Approved', payment: 'Partially Paid' };
    case 'Paid in Full': return { approval: 'Approved', payment: 'Paid in Full' };
    // Zeroed without cash (full credit memo) — the payment axis reads
    // Settled, exactly as the taxonomy planned (wired 7/21/26).
    case 'Settled': return { approval: 'Approved', payment: 'Settled' };
    // Retired status (ERP-8796): a legacy row reads its real status.
    case 'Payment Hold': return { approval: 'Approved', payment: 'Unpaid' };
    case 'Exception': return { approval: 'Exception', payment: 'Unpaid' };
    case 'Rejected': return { approval: 'Rejected', payment: 'Unpaid' };
    // Payment axis reads "Void" (feedback 7/22/26): Cancelled is the
    // INVOICE state on the approval axis; the payment fact is Void.
    case 'Cancelled': return { approval: 'Cancelled', payment: 'Void' };
    // Prepaid states retired from the payment axis (7/17/26): prepayment
    // coverage reads as ordinary paid coverage.
    case 'Partially Prepaid': return { approval: 'Approved', payment: 'Partially Paid' };
    case 'Prepaid': return { approval: 'Approved', payment: 'Paid in Full' };
    default: return { approval: status, payment: null };
  }
}

export function renderApprovalStatus(status: string, inv?: Parameters<typeof invoiceStatusAxes>[1], searchQuery?: string): ReactNode {
  const axes = invoiceStatusAxes(status, inv);
  const s = APPROVAL_STYLES[axes.approval] ?? STATUS_FALLBACK_STYLE;
  return <StatusPill label={highlightText(statusDisplayLabel(axes.approval), searchQuery)} style={s as any} />;
}

export function renderPaymentStatus(status: string, inv?: Parameters<typeof invoiceStatusAxes>[1], searchQuery?: string): ReactNode {
  const axes = invoiceStatusAxes(status, inv);
  if (!axes.payment) return null;
  const s = PAYMENT_AXIS_STYLES[axes.payment] ?? STATUS_FALLBACK_STYLE;
  return <StatusPill label={highlightText(axes.payment, searchQuery)} style={s as any} />;
}

/* ─── Linked records — partner style: small TYPE-letter pill + record number as
 *  separate foreground text, with "+N more" as a primary-blue text link.
 *  Reference: partner module "No. of Items" + "Linked Entities" columns —
 *  the colored pill carries ONLY the entity-type abbreviation (PO / SO / GRN /
 *  QT), while the actual identifier sits next to it in plain dark text. This
 *  keeps the row readable when many linked records line up vertically.
 */
const LINKED_PILL_STYLES: Record<'PO' | 'GRN', { bg: string; fg: string }> = {
  PO: { bg: palette.blue[100], fg: palette.blue[700] },   // Purchase Order → blue
  GRN: { bg: palette.green[100], fg: palette.green[700] }, // Receiving (GRN) → green
};

// Fixed PO target — clicking any PO pill / overflow row in the
// listing's Linked Records column opens this URL in a new tab.
// Receiving Documents don't have an external partner page yet, so
// they remain a no-op click for now. Exported for the detail page's
// Linked Records tab (user 10/4), which links POs to the same target.
export const PO_EXTERNAL_URL = 'https://pleasant-flow.lovable.app/purchase-orders/po-10';

function renderLinkedRecords(invoice: Invoice, searchQuery?: string): ReactNode {
  const linkedPOs = invoice.linkedPOs || [];
  const linkedGRNs = invoice.linkedGRNs || [];
  const all = [
    ...linkedPOs.map((id) => ({ id, type: 'PO' as const })),
    ...linkedGRNs.map((id) => ({ id, type: 'GRN' as const })),
  ];
  if (all.length === 0) return null;
  const first = all[0];
  const others = all.slice(1);
  const firstStyle = LINKED_PILL_STYLES[first.type];

  const firstTrigger = (
    <span className="inline-flex items-center gap-1.5 shrink-0">
      <span
        className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-[4px] text-[10px] tracking-wide"
        style={{
          backgroundColor: firstStyle.bg,
          color: firstStyle.fg,
          fontWeight: 700,
        }}
      >
        {first.type === 'GRN' ? 'REC' : first.type}
      </span>
      <span className="text-foreground" style={{ fontWeight: 400 }}>
        {highlightText(first.id, searchQuery)}
      </span>
    </span>
  );

  return (
    <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap overflow-hidden">
      {/* PO and receiving references are display-only (VI-24): the
          procurement module isn't wired to this prototype, so the old link
          opened one fixed record (po-10) for every PO. */}
      <button type="button" onClick={(e) => e.stopPropagation()}>
        {firstTrigger}
      </button>
      {others.length > 0 && (
        <OverflowTooltip
          category="Linked Entities"
          items={others.map((rec) => ({
            id: rec.id,
            name: rec.id,
            subtitle: rec.type === 'PO' ? 'Purchase Order' : 'Receiving Document',
            initials: rec.type === 'GRN' ? 'REC' : rec.type,
            avatarBg: LINKED_PILL_STYLES[rec.type].bg,
            avatarFg: LINKED_PILL_STYLES[rec.type].fg,
            // Display-only until those module pages resolve a reference.
            nameHref: undefined,
          }))}
        >
          <span
            className="text-xs cursor-pointer transition-colors shrink-0 hover:underline"
            style={{ color: 'hsl(var(--primary))', fontWeight: 500 }}
          >
            +{others.length} more
          </span>
        </OverflowTooltip>
      )}
    </div>
  );
}

/* ─── Search highlight — wraps matching substrings in a yellow <mark>
 *  span. Matches partner module's `highlightText` exactly (case-insensitive,
 *  amber bg, brown text). Returns plain text when there's no query.
 *  Exported for sibling table wrappers (PaymentDataTable). */
export function highlightText(text: string, query?: string): ReactNode {
  // The same pattern the tables match with (data-table/tableSearch), so
  // whatever a search found it can mark: "1250" marks the "1,250" it found.
  const source = searchPatternSource(query);
  if (!source || !text) return text;
  const parts = text.split(new RegExp(`(${source})`, 'gi'));
  if (parts.length === 1) return text;
  // split() on a capturing group puts the matches at the odd indexes.
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark
        key={i}
        className="bg-transparent px-0.5 rounded-sm"
        style={{ backgroundColor: palette.yellow[50], color: palette.yellow[800], fontWeight: 500 }}
      >
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

/* ─── Amount search highlight (user 10/5): a figure like "$49,316.00"
 *  can't be matched by a literal substring search for "49316" (the comma
 *  breaks it), so this maps the query's DIGITS onto the formatted string
 *  and marks the spanning run — commas and all — in the same yellow as
 *  every other search hit. Returns the plain string when nothing lines up. */
export function highlightAmount(formatted: string, query?: string): ReactNode {
  if (!query || !query.trim()) return formatted;
  const q = query.replace(/[^0-9]/g, '');
  if (q.length < 2) return formatted;
  const digitPos: number[] = [];
  let digitsOnly = '';
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] >= '0' && formatted[i] <= '9') { digitsOnly += formatted[i]; digitPos.push(i); }
  }
  const at = digitsOnly.indexOf(q);
  if (at === -1) return formatted;
  const startChar = digitPos[at];
  const endChar = digitPos[at + q.length - 1];
  return (
    <>
      {formatted.slice(0, startChar)}
      <mark
        className="bg-transparent px-0.5 rounded-sm"
        style={{ backgroundColor: palette.yellow[50], color: palette.yellow[800], fontWeight: 500 }}
      >
        {formatted.slice(startChar, endChar + 1)}
      </mark>
      {formatted.slice(endChar + 1)}
    </>
  );
}

/* ─── Date helpers ─── */
export function relativeDate(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d < 0) return '';
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

/* ─── Deterministic dummy contact details (matches partner's hash-derived
   person hover-card data). Same name → same role/dept/email/phone. */
const ROLES = ['Account Manager', 'Finance Lead', 'Procurement Manager', 'Operations Lead', 'AP Specialist'];
const DEPTS = ['Finance', 'Procurement', 'Operations', 'Supply Chain', 'Accounts Payable'];
function getContactDetails(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  const abs = Math.abs(h);
  const role = ROLES[abs % ROLES.length];
  const dept = DEPTS[(abs >> 3) % DEPTS.length];
  const email = `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@company.com`;
  const phone = `(${(abs % 900) + 100}) ${((abs >> 5) % 900) + 100}-${((abs >> 9) % 9000) + 1000}`;
  return { role, dept, email, phone };
}

/* ─── External link targets (partner module). The placeholder ids match
 *  what the partner module ships in mock data; eventually wire to real ids. */
// Vendor links resolve per vendor (9/22/26, GPT LINK-01).
const CONTACT_DETAIL_URL = 'https://partner-management-module.lovable.app/partners/contacts/C-CR-001';

function openVendorDetail(vendorName?: string) {
  window.open(partnerVendorUrl(vendorName ?? ''), '_blank', 'noopener');
}
function openContactDetail() {
  window.open(CONTACT_DETAIL_URL, '_blank', 'noopener');
}

/* ─── Deterministic mock vendor stats for the quick + full cards. Real wiring
 *  comes later — these keep the same vendor showing the same stats. */
function getVendorStats(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  const abs = Math.abs(h);
  return {
    totalInvoices: (abs % 80) + 10,
    outstanding: ((abs >> 3) % 90000) + 10000,
    paid: ((abs >> 5) % 250000) + 50000,
    addressLine: `${(abs % 900) + 100} Industrial Park Dr`,
    city: ['Detroit, MI', 'San Jose, CA', 'Austin, TX', 'Chicago, IL', 'Atlanta, GA'][abs % 5],
    // Division, not bit-shift (VI-24 copy): a >> on a hash past 2^31 wraps
    // to a negative 32-bit int, which printed "+1 (316) -3--6432". These
    // segments stay in valid ranges and the last four always render 4 digits.
    phone: `+1 (${(abs % 800) + 200}) ${(Math.floor(abs / 7) % 800) + 200}-${String(Math.floor(abs / 13) % 10000).padStart(4, '0')}`,
    // The vendor's OWN profile description (VI-49): deterministic from the
    // name so the quick/full card reads about the VENDOR, not the invoice.
    description: [
      // The settlement currency is the partner record's (spec 4.2), not a fixed USD.
      `Established supplier of industrial components with reliable lead times and ${vendorCurrencyOf(name)} settlements.`,
      'Regional distributor specializing in bulk materials and fast, consistent fulfillment.',
      'Long-standing vendor for packaging and logistics consumables across domestic operations.',
      'Specialty manufacturer serving manufacturing lines with on-time delivery and flexible terms.',
      'Trade supplier with a broad catalog, dependable quality, and steady on-time delivery.',
    ][abs % 5],
  };
}

interface VendorQuickCardProps {
  vendor: string;
  description?: string;
}
/** Vendor hover quick-card — matches Created By's dark-slate-gradient header
 *  treatment so both hover surfaces feel like the same design language.
 *  Exported so the detail-page header vendor pill can show the same card
 *  on hover (same component, same data, same micro-interactions). */
export function VendorQuickCard({ vendor, description }: VendorQuickCardProps) {
  const stats = getVendorStats(vendor);
  return (
    <div className="w-[280px]">
      <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
        <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
        <div className="flex items-center gap-3 relative">
          <div className="shrink-0">
            <VendorAvatar name={vendor} size="md" />
          </div>
          <div className="min-w-0">
            <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>
              {vendor}
            </p>
            <p className="text-[11px] text-slate-400 truncate">Vendor · {stats.city}</p>
          </div>
        </div>
      </div>
      <div className="bg-white px-4 py-3 space-y-2">
        {/* The vendor's own description (VI-49), not the invoice's. */}
        {stats.description && (
          <p className="text-[11px] text-slate-600 line-clamp-2">{stats.description}</p>
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
            openVendorDetail(vendor);
          }}
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
          style={{ fontWeight: 500 }}
        >
          Go to Vendor
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

interface VendorFullCardProps {
  vendor: string;
  description?: string;
  open: boolean;
  onClose: () => void;
}

/** Hash-derived avatar tint for the large hero avatar — uses the existing
 *  PersonAvatar tint palette so the gradient and avatar share a deterministic
 *  family per vendor. */
function heroGradientFor(name: string): string {
  // Pull a deterministic accent hue from the name so each vendor's hero
  // feels a little different (matches partner's Kimora-Avila modal where
  // the gradient picks up the avatar's color family). Each gradient is
  // built from three palette stops so it stays tokenized.
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  const g = (a: string, b: string, c: string) =>
    `linear-gradient(135deg, ${a} 0%, ${b} 50%, ${c} 100%)`;
  const hues = [
    g(palette.blue[100], palette.indigo[100], palette.violet[100]),     // blue → indigo → violet
    g(palette.green[100], palette.emerald[100], palette.teal[100]),     // emerald → teal
    g(palette.amber[100], palette.amber[200], palette.orange[200]),     // amber → orange
    g(palette.pink[100], palette.pink[200], palette.fuchsia[200]),      // pink → fuchsia
    g(palette.sky[100], palette.cyan[100], palette.blue[100]),          // sky → cyan → blue
    g(palette.violet[100], palette.violet[200], palette.purple[200]),   // violet → purple
  ];
  return hues[Math.abs(h) % hues.length];
}

/** Vendor full-detail modal — matches partner module's Contact-modal pattern
 *  (Kimora Avila reference): large gradient hero with centered avatar +
 *  initials, status pill top-left, circular close top-right, then name + role,
 *  company/dept pills, 4-column stats grid, connect section, footer with CTA.
 *  Width = 460px. Animates from center via the `modal-pop-center` keyframe
 *  defined in src/index.css. */
function VendorFullCard({ vendor, description, open, onClose }: VendorFullCardProps) {
  const stats = getVendorStats(vendor);
  const contact = getContactDetails(vendor);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-[460px] p-0 overflow-hidden border-0 rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.18)] bg-white"
        // Skip the default top-right X — we render a custom circular close
        // button in the hero band. Without this we'd have two X icons stacked.
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{vendor}, vendor details</DialogTitle>
        <DialogDescription className="sr-only">
          Quick reference for the {vendor} vendor: address, phone, invoice counts,
          primary contact, and a link to the full vendor page.
        </DialogDescription>

        {/* ─── 1. Hero band — large gradient with centered avatar ─── */}
        <div className="relative h-[180px] overflow-hidden">
          <div className="absolute inset-0" style={{ background: heroGradientFor(vendor) }} />
          {/* Soft decorative orbs */}
          <div
            className="absolute -top-16 -right-16 w-56 h-56 rounded-full"
            style={{ background: 'radial-gradient(closest-side, rgba(255,255,255,0.55), transparent)' }}
          />
          <div
            className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full"
            style={{ background: 'radial-gradient(closest-side, rgba(255,255,255,0.30), transparent)' }}
          />

          {/* Status pill (top-left) — partner reference: rounded-full,
              light-green bg, dark-green text. No dot — just the label. */}
          <span
            className="absolute top-3 left-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] shadow-sm border"
            style={{
              backgroundColor: palette.emerald[50],
              color: palette.emerald[800],
              borderColor: palette.emerald[200],
              fontWeight: 600,
            }}
          >
            Active
          </span>

          {/* Close button (top-right) */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center bg-white/90 hover:bg-white shadow-sm text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Centered large avatar — pointer-events-none so it doesn't steal
              clicks from the status pill / close button stacked above it. */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-full bg-white/95 shadow-[0_8px_22px_rgba(0,0,0,0.10)] p-1.5">
              <div
                className="w-[72px] h-[72px] rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: 'hsl(var(--card))',
                  color: 'hsl(var(--foreground))',
                  fontSize: 20,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                }}
              >
                {vendor
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join('')
                  .toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* ─── 2. Title — name + role left-aligned (partner Tanya-Bailey ref) ─── */}
        <div className="px-5 pt-4 pb-2">
          <p
            className="text-[19px] truncate"
            style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}
          >
            {vendor}
          </p>
          <p className="text-[12px] text-muted-foreground truncate mt-0.5">
            Vendor · {stats.city}
          </p>
        </div>

        {/* Partner + Dept pills removed per design — the vendor name + city
            subtitle above already convey the affiliation, and the 4-col
            stats card below carries the "Partners" cell, so the duplicate
            pill row was redundant. */}

        {/* ─── 4. Four-column stats grid — column 1 = partner/vendor name
            (text, label "Partners"), columns 2-4 = numeric stats. Mirrors
            partner Tanya-Bailey reference. ─── */}
        <div className="px-5 pb-3.5">
          <div className="grid grid-cols-4 gap-0 rounded-xl border border-border/60 bg-slate-50/60 overflow-hidden">
            <div className="px-2.5 py-2 text-center">
              <p
                className="text-[13px] text-foreground truncate"
                style={{ fontWeight: 600 }}
                title={vendor}
              >
                {vendor.split(/\s+/)[0]}
              </p>
              <p
                className="text-[10px] text-muted-foreground mt-0.5"
                style={{ fontWeight: 600 }}
              >
                Partners
              </p>
            </div>
            <div className="px-2.5 py-2 text-center border-l border-border/40">
              <p className="text-[16px] text-foreground " style={{ fontWeight: 600 }}>
                {stats.totalInvoices}
              </p>
              <p
                className="text-[10px] text-muted-foreground mt-0.5"
                style={{ fontWeight: 600 }}
              >
                Invoices&nbsp;Issued
              </p>
            </div>
            <div className="px-2.5 py-2 text-center border-l border-border/40">
              <p className="text-[16px] text-foreground " style={{ fontWeight: 600 }}>
                {formatCompactMoney(stats.outstanding, vendorCurrencyOf(vendor))}
              </p>
              <p
                className="text-[10px] text-muted-foreground mt-0.5"
                style={{ fontWeight: 600 }}
              >
                Outstanding
              </p>
            </div>
            <div className="px-2.5 py-2 text-center border-l border-border/40">
              <p className="text-[16px] text-foreground " style={{ fontWeight: 600 }}>
                {formatCompactMoney(stats.paid, vendorCurrencyOf(vendor))}
              </p>
              <p
                className="text-[10px] text-muted-foreground mt-0.5"
                style={{ fontWeight: 600 }}
              >
                Paid
              </p>
            </div>
          </div>
        </div>

        {/* ─── 5. Connect section (address / email / phone) ─── */}
        <div className="px-5 pb-4">
          <p
            className="text-[10px] text-muted-foreground mb-1.5"
            style={{ fontWeight: 600 }}
          >
            Connect
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">
                {stats.addressLine}, {stats.city}
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{contact.email}</span>
            </div>
            <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="">{stats.phone}</span>
            </div>
          </div>
        </div>

        {/* ─── 6. Footer ─── */}
        <div className="bg-slate-50/70 border-t border-border/60 px-5 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="text-[12px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              openVendorDetail(vendor);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[12px] text-white bg-primary hover:bg-primary/90 transition-colors cursor-pointer shadow-sm"
            style={{ fontWeight: 500 }}
          >
            View Vendor Details
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Contact full-detail modal — partner-style person card.
 *  Photo hero (real randomuser portrait) + status pill + close, then name +
 *  role, vendor + department pills, 4-col stats, connect rows, footer CTA
 *  that opens the partner contact URL in a new tab. */
interface ContactFullCardProps {
  contactName: string;
  vendor: string;
  open: boolean;
  onClose: () => void;
}
function getContactStats(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  const abs = Math.abs(h);
  return {
    partnersCovered: (abs % 50) + 5,
    invoicesIssued: ((abs >> 3) % 80) + 10,
    quoteShares: ((abs >> 5) % 25) + 1,
    locations: ((abs >> 7) % 6) + 1,
  };
}
function ContactFullCard({ contactName, vendor, open, onClose }: ContactFullCardProps) {
  const stats = getContactStats(contactName);
  const cd = getContactDetails(contactName);
  // Known headshots win over the deterministic portrait (8/7/26): the
  // quick card must show the same face as every avatar chip.
  const photoUrl = userPhotoFor(contactName) ?? getPersonPhotoUrl(contactName);
  const [heroFailed, setHeroFailed] = useState(false);
  const showPhoto = !heroFailed;

  // Mock multiple phones / emails so the "+N more" tooltip chips have
  // something to surface — matches partner module convention.
  const phones = [
    { id: "p1", type: "Office", number: cd.phone },
    { id: "p2", type: "Mobile", number: cd.phone.replace(/\d$/, "9") },
  ];
  const emails = [
    { id: "e1", type: "Work", address: cd.email },
    { id: "e2", type: "Personal", address: cd.email.replace("@company.com", "@gmail.com") },
  ];

  const socialMeta: Record<string, { icon: typeof Linkedin; color: string; label: string }> = {
    LinkedIn: { icon: Linkedin, color: "#0A66C2", label: "LinkedIn" },
    "Twitter / X": { icon: Twitter, color: "#000000", label: "X (Twitter)" },
    Website: { icon: Globe, color: "hsl(var(--primary))", label: "Website" },
    Skype: { icon: MessageCircle, color: "#00AFF0", label: "Skype" },
    WhatsApp: { icon: MessageCircle, color: "#25D366", label: "WhatsApp" },
  };
  const socials: { id: string; type: keyof typeof socialMeta; url: string }[] = [
    { id: "s1", type: "LinkedIn", url: "#" },
    { id: "s2", type: "Twitter / X", url: "#" },
    { id: "s3", type: "Website", url: "#" },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="w-[calc(100vw-32px)] sm:max-w-[480px] md:max-w-[540px] lg:max-w-[600px] p-0 overflow-hidden border-0 rounded-2xl bg-card flex flex-col max-h-[calc(100vh-48px)]"
        style={{
          boxShadow:
            "0 0 0 1px rgba(0,0,0,0.03), 0 8px 20px rgba(0,0,0,0.08), 0 24px 56px rgba(0,0,0,0.14)",
        }}
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{contactName}, contact details</DialogTitle>
        <DialogDescription className="sr-only">
          Quick reference for {contactName}: role, affiliated partner, department, phone, email, and social handles.
        </DialogDescription>

        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-50 w-8 h-8 rounded-full flex items-center justify-center bg-white/90 hover:bg-white shadow-md transition-all cursor-pointer border border-border"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-slate-700" />
        </button>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div
            className="relative overflow-hidden shrink-0"
            style={{
              height: "clamp(200px, 45vh, 420px)",
              background: showPhoto
                ? palette.indigo[900]
                : "linear-gradient(135deg, hsl(var(--muted)) 0%, hsl(var(--muted)) 55%, #1E293B 100%)",
            }}
          >
            {showPhoto ? (
              <img
                src={photoUrl}
                alt={contactName}
                className="w-full h-full object-cover"
                onError={() => setHeroFailed(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div
                  className="w-28 h-28 rounded-full flex items-center justify-center text-[40px] shadow-[0_6px_24px_rgba(0,0,0,0.25)] border-2 border-white/30 bg-slate-200 text-slate-700"
                  style={{ fontWeight: 700 }}
                >
                  {contactName
                    .split(" ")
                    .map((p) => p[0] || "")
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />

            <span
              className="absolute top-3 left-3 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] border backdrop-blur-sm"
              style={{
                fontWeight: 600,
                // Light-green pill with 90% opacity for the "glassy" backdrop-blur look
                backgroundColor: `${palette.green[100]}E6`,
                color: palette.green[800],
                borderColor: palette.green[200],
              }}
            >
              Active
            </span>

            {showPhoto && (
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="absolute top-3 right-14 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hover:text-white transition-colors cursor-pointer"
                aria-label="Zoom photo"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            )}

            <div className="absolute bottom-3 left-4 right-4">
              <p className="text-[16px] text-white truncate" style={{ fontWeight: 700 }}>
                {contactName}
              </p>
              <div
                className="text-[11px] text-white/80 mt-0.5 truncate"
                style={{ fontWeight: 500 }}
              >
                {cd.role}
              </div>
            </div>
          </div>

          <div className="px-5 pt-4 pb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center gap-1 text-[12px] text-slate-500"
                style={{ fontWeight: 500 }}
              >
                <Building2 className="w-3 h-3" />
                {vendor}
              </span>
              <span className="text-slate-300">•</span>
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border"
                style={{
                  fontWeight: 600,
                  backgroundColor: palette.emerald[50],
                  color: palette.emerald[800],
                  borderColor: palette.emerald[200],
                }}
              >
                <Briefcase className="w-3 h-3" />
                {cd.dept}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 divide-x divide-border rounded-xl border border-border overflow-hidden [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:sm:border-t-0">
              <div className="px-2.5 py-2.5 text-center">
                <div
                  className="text-[13px] text-foreground truncate"
                  style={{ fontWeight: 700 }}
                  title={vendor}
                >
                  {vendor.split(" ").slice(0, 2).join(" ")}
                </div>
                <div
                  className="text-[10px] text-slate-400 mt-0.5"
                  style={{ fontWeight: 500 }}
                >
                  Partner
                </div>
              </div>
              <div className="px-2.5 py-2.5 text-center">
                <div className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>
                  {stats.invoicesIssued}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>
                  Invoices Issued
                </div>
              </div>
              <div className="px-2.5 py-2.5 text-center">
                <div className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>
                  {stats.quoteShares}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>
                  Quote Shares
                </div>
              </div>
              <div className="px-2.5 py-2.5 text-center">
                <div className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>
                  {stats.locations}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>
                  Locations
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-1">
              <div className="flex items-center gap-2.5 py-1">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <a
                  href={`tel:${phones[0].number.replace(/[^\d+]/g, "")}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[13px] text-foreground hover:text-primary hover:underline transition-colors min-w-0 truncate"
                  style={{ fontWeight: 500 }}
                >
                  {phones[0].number}
                </a>
                {phones.length > 1 && (
                  <PTooltip>
                    <PTooltipTrigger asChild>
                      <span
                        className="text-[11px] shrink-0 cursor-default leading-none ml-0.5"
                        style={{ fontWeight: 600, color: palette.blue[600] }}
                      >
                        +{phones.length - 1} more
                      </span>
                    </PTooltipTrigger>
                    <PTooltipContent side="bottom" className="z-[300] max-w-[300px]">
                      <div className="space-y-1.5">
                        {phones.slice(1).map((p) => (
                          <div key={p.id} className="flex items-center gap-2">
                            <span
                              className="text-[10px] text-slate-400 shrink-0"
                              style={{ fontWeight: 500 }}
                            >
                              {p.type}
                            </span>
                            <span className="text-[11px] text-slate-700">{p.number}</span>
                          </div>
                        ))}
                      </div>
                    </PTooltipContent>
                  </PTooltip>
                )}
              </div>

              <div className="flex items-center gap-2.5 py-1">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <a
                  href={`mailto:${emails[0].address}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[13px] text-foreground hover:text-primary hover:underline transition-colors min-w-0 truncate"
                  style={{ fontWeight: 500 }}
                >
                  {emails[0].address}
                </a>
                {emails.length > 1 && (
                  <PTooltip>
                    <PTooltipTrigger asChild>
                      <span
                        className="text-[11px] shrink-0 cursor-default leading-none ml-0.5"
                        style={{ fontWeight: 600, color: palette.blue[600] }}
                      >
                        +{emails.length - 1} more
                      </span>
                    </PTooltipTrigger>
                    <PTooltipContent side="bottom" className="z-[300] max-w-[300px]">
                      <div className="space-y-1.5">
                        {emails.slice(1).map((e) => (
                          <div key={e.id} className="flex items-center gap-2">
                            <span
                              className="text-[10px] text-slate-400 shrink-0"
                              style={{ fontWeight: 500 }}
                            >
                              {e.type}
                            </span>
                            <span className="text-[11px] text-slate-700">{e.address}</span>
                          </div>
                        ))}
                      </div>
                    </PTooltipContent>
                  </PTooltip>
                )}
              </div>

              {socials.length > 0 && (
                <div className="flex items-center gap-2.5 pt-1.5">
                  <span
                    className="text-[11px] text-muted-foreground/70 shrink-0"
                    style={{ fontWeight: 600 }}
                  >
                    Connect
                  </span>
                  <div className="flex items-center gap-1">
                    {socials.map((s) => {
                      const meta = socialMeta[s.type];
                      if (!meta) return null;
                      const SIcon = meta.icon;
                      return (
                        <PTooltip key={s.id}>
                          <PTooltipTrigger asChild>
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="group/social relative w-6 h-6 rounded flex items-center justify-center transition-all duration-150 hover:bg-muted"
                            >
                              <SIcon className="w-3.5 h-3.5 text-slate-400 group-hover/social:opacity-0 transition-opacity duration-150" />
                              <SIcon
                                className="w-3.5 h-3.5 absolute opacity-0 group-hover/social:opacity-100 transition-opacity duration-150"
                                style={{ color: meta.color }}
                              />
                            </a>
                          </PTooltipTrigger>
                          <PTooltipContent side="bottom" className="z-[300]">
                            <span className="text-[11px]">{meta.label}</span>
                          </PTooltipContent>
                        </PTooltip>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border/40 flex items-center justify-between bg-muted/30 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-[13px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              window.open(CONTACT_DETAIL_URL, "_blank", "noopener");
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] text-white transition-colors cursor-pointer"
            style={{ fontWeight: 600, backgroundColor: "hsl(var(--primary))" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = palette.blue[600])}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "hsl(var(--primary))")}
          >
            Go to Contact
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Created By cell — circular real-person photo with hover-card +
 *  click → full ContactFullCard modal. Takes primitives (not an Invoice)
 *  so sibling tables (PaymentDataTable) can reuse the exact same cell. */
interface CreatedByCellProps {
  name: string;
  vendor: string;
  density: DensityOption;
  /** Highlights the name when the table's search matched it (10/9/26). */
  searchQuery?: string;
}
export function CreatedByCell({ name, vendor, density, searchQuery }: CreatedByCellProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const isComfort = density === 'comfort';
  // Card density (user 9/28): the invoice cards reuse this cell, so the
  // name wears the card's value typography (12px semibold) instead of
  // the table row's 14px regular — same interactions, one type scale.
  const isCard = density === 'card';
  const cd = getContactDetails(name);
  return (
    <>
      <div className="flex items-center gap-2 min-w-0">
        <HoverCard openDelay={300} closeDelay={100}>
          <HoverCardTrigger asChild>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setModalOpen(true);
              }}
              className="cursor-pointer shrink-0 rounded-full transition-transform hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              aria-label={`Open ${name} contact details`}
            >
              <PhotoPersonAvatar name={name} size={isComfort ? 'md' : 'sm'} />
            </button>
          </HoverCardTrigger>
          <HoverCardContent
            side="bottom"
            align="start"
            className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
              <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
              <div className="flex items-center gap-3 relative">
                <div className="shrink-0">
                  <PhotoPersonAvatar name={name} size="md" />
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>
                    {name}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">{cd.role}</p>
                </div>
              </div>
            </div>
            <div className="bg-white px-4 py-3 space-y-2">
              <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{cd.email}</span>
              </div>
              <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{cd.dept}</span>
              </div>
              <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{cd.phone}</span>
              </div>
            </div>
            <div className="bg-slate-50/60 border-t border-border/40 px-4 py-2 flex items-center justify-end">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setModalOpen(true);
                }}
                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                View Profile
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </HoverCardContent>
        </HoverCard>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setModalOpen(true);
          }}
          className="min-w-0 flex flex-col cursor-pointer group/cb text-left"
        >
          <span
            className={`block truncate group-hover/cb:text-primary group-hover/cb:underline transition-colors ${
              isCard ? 'text-[12px]' : isComfort ? 'text-[13px]' : 'text-sm'
            } text-foreground`}
            style={{ fontWeight: isCard ? 600 : 400 }}
          >
            {highlightText(name, searchQuery)}
          </span>
          {isComfort && (
            <span className="text-[10px] text-muted-foreground/60 truncate">{cd.role}</span>
          )}
        </button>
      </div>

      <ContactFullCard
        contactName={name}
        vendor={vendor}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

/* ─── Vendor cell — avatar (hover quick-card / click full-modal) + name
 *  (hover-highlight + click opens partner module in a new tab).
 *
 *  Lives as its own component so the modal state survives row re-renders.
 *  Takes primitives (not an Invoice) so sibling tables (PaymentDataTable)
 *  can reuse the exact same cell + hover/modal micro-interactions. */
interface VendorCellProps {
  vendor: string;
  description?: string;
  density: DensityOption;
  searchQuery?: string;
  /** Chips after the description, on its line (comfort density), so they
   *  never squeeze the name. */
  descriptionAddon?: ReactNode;
}
export function VendorCell({ vendor, description, density, searchQuery, descriptionAddon }: VendorCellProps) {
  const [fullCardOpen, setFullCardOpen] = useState(false);
  const isComfort = density === 'comfort';
  // Card density (user 9/28): see CreatedByCell — 12px semibold to match
  // the card's value scale.
  const isCard = density === 'card';
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
              aria-label={`Open ${vendor} details`}
            >
              <VendorAvatar name={vendor} size={isComfort ? 'md' : 'sm'} />
            </button>
          </HoverCardTrigger>
          <HoverCardContent
            side="bottom"
            align="start"
            sideOffset={6}
            className="p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden w-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <VendorQuickCard vendor={vendor} description={description} />
          </HoverCardContent>
        </HoverCard>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openVendorDetail(vendor);
          }}
          className="min-w-0 flex flex-col cursor-pointer group/vn text-left"
        >
          {/* Color = text-foreground (matches partner Partners column exactly).
              Hover → primary blue + underline, same as Created By name. */}
          <span
            className={`truncate text-foreground transition-colors group-hover/vn:text-primary group-hover/vn:underline ${
              isCard ? 'text-[12px]' : isComfort ? 'text-[13px]' : 'text-sm'
            }`}
            style={{ fontWeight: isCard ? 600 : 400 }}
          >
            {highlightText(vendor, searchQuery)}
          </span>
          {isComfort && descriptionAddon ? (
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0 mt-0.5">
              {description && (
                <span className="text-[11px] text-muted-foreground truncate">
                  {highlightText(description, searchQuery)}
                </span>
              )}
              {descriptionAddon}
            </span>
          ) : isComfort && description && (
            <span className="text-[11px] text-muted-foreground truncate">
              {highlightText(description, searchQuery)}
            </span>
          )}
        </button>
      </div>

      <VendorFullCard
        vendor={vendor}
        description={description}
        open={fullCardOpen}
        onClose={() => setFullCardOpen(false)}
      />
    </>
  );
}

/* ─── Payment terms cell (8/28/26 evening) — the run pool's recipe:
 *  the term NAME turning primary-blue on hover with the full partner
 *  card in a hover card; extra PO terms fold into "+N more". Local
 *  mirror of PaymentTermPill's name variant (importing it from
 *  RecordPaymentFlow would cycle back into this file). */
function TermName({ label, searchQuery }: { label: string; searchQuery?: string }) {
  const term = resolvePaymentTerm(label);
  // Click opens the partner-style details modal (8/31/26) — system-wide
  // rule: a payment term name is always a door to its details.
  const [detailOpen, setDetailOpen] = useState(false);
  return (
    <>
    {detailOpen && <PaymentTermDetailsModal termLabel={label} onClose={() => setDetailOpen(false)} />}
    <HoverCard openDelay={300} closeDelay={120}>
      <HoverCardTrigger asChild>
        <span
          className="inline-flex max-w-full cursor-pointer align-middle text-slate-700 whitespace-nowrap hover:text-primary hover:underline transition-colors"
          style={{ fontWeight: 400 }}
          onClick={(e) => { e.stopPropagation(); setDetailOpen(true); }}
        >
          <span className="truncate">{highlightText(term.name, searchQuery)}</span>
        </span>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="p-0 bg-transparent border-0 shadow-none w-[300px] z-[300]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          <PaymentTermCard term={term} readOnly hideCheckmark />
        </div>
      </HoverCardContent>
    </HoverCard>
    </>
  );
}

function renderPaymentTerms(row: Invoice, searchQuery?: string): ReactNode {
  // ONE term per invoice (9/4/26 ruling): mixed-term PO selections
  // resolve to a single term at creation, so the column never lists
  // extra terms and the old "+N more" overflow is gone.
  return (
    <span className="flex items-center gap-2 flex-nowrap whitespace-nowrap overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <TermName label={paymentTermsFor(row)} searchQuery={searchQuery} />
    </span>
  );
}

/* ─── Column definitions ─── */
export const INVOICE_COLUMNS: ColumnDef<Invoice>[] = [
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
      // The number is a LINK (user 10/5, supersedes the old no-hover
      // call): black at rest, blue + underline on hover, opens the
      // invoice in a NEW TAB. The row click keeps the in-app route.
      // A held invoice carries the yellow lock beside it (ERP-8796).
      <span className="flex min-w-0 items-center gap-1.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            window.open(`/invoices/${encodeURIComponent(row.invoiceNumber)}`, '_blank', 'noopener');
          }}
          className={`block truncate whitespace-nowrap text-left cursor-pointer bg-transparent border-0 p-0 text-slate-800 hover:text-primary hover:underline underline-offset-2 transition-colors ${
            density === 'comfort' ? 'text-[13px]' : 'text-sm'
          }`}
          style={{ fontWeight: 400 }}
        >
          {highlightText(row.invoiceNumber, searchQuery)}
        </button>
        <PaymentHoldLock invoice={row} />
      </span>
    ),
  },
  {
    key: 'type',
    label: 'Invoice Type',
    minWidth: 170,
    defaultWidth: 210,
    sortable: true,
    filterType: 'multiselect',
    // Filter/sort on the display labels so the filter menu reads
    // "Receiving Invoice", not the internal 'Receiving-based' key.
    uniqueValues: (rows) => Array.from(new Set(rows.map((r) => TYPE_CONFIG[r.type]?.label ?? r.type))).sort(),
    getValue: (row) => TYPE_CONFIG[row.type]?.label ?? row.type,
    render: (row, { searchQuery }) => renderType(row.type, searchQuery),
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
      <VendorCell
        vendor={row.vendor}
        description={row.description}
        density={ctx.density}
        searchQuery={ctx.searchQuery}
      />
    ),
  },
  {
    key: 'vendorInvoiceNumber',
    filterable: false,
    label: 'Vendor Invoice No.',
    minWidth: 160,
    defaultWidth: 200,
    sortable: true,
    filterType: 'text',
    getValue: (row) => row.vendorInvoiceNumber,
    render: (row, { searchQuery }) => (
      <span className="text-foreground">{highlightText(row.vendorInvoiceNumber, searchQuery)}</span>
    ),
  },
  {
    key: 'invoiceDate',
    label: 'Vendor Invoice Date',
    minWidth: 180,
    defaultWidth: 220,
    sortable: true,
    filterType: 'date',
    getValue: (row) => row.invoiceDate,
    searchText: (row) => formatUsDateTime(row.invoiceDate, row.id),
    render: (row, { searchQuery }) => <span className="text-muted-foreground whitespace-nowrap">{highlightText(formatUsDateTime(row.invoiceDate, row.id), searchQuery)}</span>,
  },
  // The two dates the due date derives from (9/22/26 review response,
  // Claude C13-X3): due = trigger + term days; posting = the ledger entry
  // date. Hidden by default, one palette toggle away.
  {
    key: 'triggerDate',
    label: 'Trigger Date',
    minWidth: 165,
    defaultWidth: 205,
    sortable: true,
    filterType: 'date',
    getValue: (row) => row.triggerDate ?? '',
    searchText: (row) => (row.triggerDate ? formatUsDateTime(row.triggerDate, row.id) : ''),
    render: (row, { searchQuery }) => (
      <span className="text-muted-foreground whitespace-nowrap">
        {row.triggerDate ? highlightText(formatUsDateTime(row.triggerDate, row.id), searchQuery) : <span className="text-muted-foreground/50">Set on receiving</span>}
      </span>
    ),
  },
  {
    key: 'postingDate',
    label: 'Posting Date',
    minWidth: 165,
    defaultWidth: 205,
    sortable: true,
    filterType: 'date',
    getValue: (row) => row.postingDate ?? '',
    searchText: (row) => (row.postingDate ? formatUsDateTime(row.postingDate, row.id) : ''),
    render: (row, { searchQuery }) => (
      <span className="text-muted-foreground whitespace-nowrap">
        {row.postingDate ? highlightText(formatUsDateTime(row.postingDate, row.id), searchQuery) : null}
      </span>
    ),
  },
  {
    key: 'dueDate',
    label: 'Due Date',
    minWidth: 165,
    defaultWidth: 210,
    sortable: true,
    // Aging sort (user 10/9): most days overdue on top.
    extraSorts: [{ key: MOST_OVERDUE_SORT_KEY, direction: 'desc', label: 'Most Overdue First' }],
    filterType: 'date',
    getValue: (row) => row.dueDate,
    searchText: (row) => formatUsDateTime(row.dueDate, row.id),
    render: (row, { searchQuery }) => {
      // The shared date core + the ONE phrasing family (9/22/26 review
      // response): list and detail can never disagree about the same
      // record's day again. Aging shows only while money is owed on a
      // live record — cancelled/rejected rows keep just the date.
      const days = overdueDaysOf(row.dueDate);
      const open =
        (row.outstandingBalance ?? 0) > 0.004 &&
        row.status !== 'Cancelled' &&
        row.status !== 'Rejected';
      // One meaning of overdue (VI-32): a row reads the red "Overdue by N"
      // only when it's overdue by the SAME rule the Overdue card counts, so
      // the rows and the card can never disagree (a Pending / Exception /
      // On-hold row past its date isn't awaiting payment, so it isn't
      // "overdue"). Forward-looking due-today / due-soon hints still ride
      // any open row.
      let hint: { text: string; cls: string } | null = null;
      if (open) {
        if (days > 0) hint = isInvoiceOverdue(row) ? { text: overdueLabel(days), cls: 'text-red-600' } : null;
        else if (days === 0) hint = { text: 'Due Today', cls: 'text-amber-600' };
        else if (-days <= 7) hint = { text: overdueLabel(days), cls: 'text-amber-600' };
        else hint = { text: overdueLabel(days), cls: 'text-slate-400' };
      }
      return (
        <div className="flex flex-col leading-tight">
          <span className="text-foreground whitespace-nowrap">{highlightText(formatUsDateTime(row.dueDate, row.id), searchQuery)}</span>
          {hint && (
            <span className={`text-[10px] ${hint.cls}`} style={{ fontWeight: 600 }}>{hint.text}</span>
          )}
        </div>
      );
    },
  },
  {
    key: 'paymentTerms',
    label: 'Payment Terms',
    // Wider default (8/31/26): the advance-payment labels ("Full Advance
    // Payment: Production Start" + the "+N more" chip) truncated at 210.
    minWidth: 200,
    defaultWidth: 290,
    sortable: true,
    filterType: 'multiselect',
    uniqueValues: (rows) => Array.from(new Set(rows.map((r) => paymentTermsFor(r)))).sort(),
    getValue: (row) => paymentTermsFor(row),
    searchText: (row) => resolvePaymentTerm(paymentTermsFor(row)).name,
    render: (row, { searchQuery }) => renderPaymentTerms(row, searchQuery),
  },
  {
    key: 'linkedRecords',
    filterable: false,
    label: 'Linked Records',
    minWidth: 200,
    defaultWidth: 280,
    sortable: false,
    filterType: 'text',
    getValue: (row) => [...(row.linkedPOs || []), ...(row.linkedGRNs || [])].join(', '),
    render: (row, { searchQuery }) => renderLinkedRecords(row, searchQuery),
  },
  // Two status columns, not one merged pill (Eli review 7/15/26):
  // approval answers "whose desk is this on," payment answers "where's
  // the money."
  {
    key: 'approvalStatus',
    label: 'Invoice Status',
    minWidth: 130,
    defaultWidth: 160,
    sortable: true,
    filterType: 'multiselect',
    // Axes read with the row (10/9/26) so hold context ("On hold") is a
    // filter option and matches, exactly as the pill renders.
    uniqueValues: (rows) => Array.from(new Set(rows.map((r) => invoiceStatusAxes(r.status, r).approval))).sort(),
    getValue: (row) => invoiceStatusAxes(row.status, row).approval,
    searchText: (row) => statusDisplayLabel(invoiceStatusAxes(row.status, row).approval),
    render: (row, { searchQuery }) => renderApprovalStatus(row.status, row, searchQuery),
  },
  {
    key: 'paymentStatus',
    label: 'Payment Status',
    minWidth: 130,
    defaultWidth: 160,
    sortable: true,
    filterType: 'multiselect',
    // Read with the row (10/9/26): "In Payment Run" and "Scheduled" come
    // from the row's run/schedule facts, so they're pickable filter options.
    uniqueValues: (rows) =>
      Array.from(new Set(rows.map((r) => invoiceStatusAxes(r.status, r).payment).filter((v): v is string => !!v))).sort(),
    getValue: (row) => invoiceStatusAxes(row.status, row).payment ?? '',
    render: (row, { searchQuery }) => renderPaymentStatus(row.status, row, searchQuery),
  },
  {
    key: 'amount',
    label: 'Amount',
    tooltip: "In each invoice's own currency. Sorting and the range filter use the PKR (base currency) equivalent.",
    minWidth: 120,
    defaultWidth: 160,
    sortable: true,
    filterType: 'range',
    // Currency & Exchange Rates (spec 4.4): the amount is in the row's own
    // currency (the symbol follows the Currency column), hover for its base
    // equivalent and rate; rows sort and range-filter on that base
    // equivalent, so a ¥ total never outranks a $ one on its face value.
    getValue: (row) => toInvoiceBase(row, row.amount),
    getSortValue: (row) => toInvoiceBase(row, row.amount),
    searchText: (row) => `${row.amount} ${formatMoney(row.amount, row.currency)}`,
    render: (row, { searchQuery }) => (
      <Money value={row.amount} currency={row.currency} fx={invoiceFx(row)} className="text-foreground">
        {highlightAmount(formatMoney(row.amount, row.currency), searchQuery)}
      </Money>
    ),
  },
  {
    key: 'discount',
    label: 'Discount',
    minWidth: 130,
    defaultWidth: 170,
    sortable: true,
    filterable: false,
    getValue: (row) => {
      const terms = discountTermsFor(row);
      return terms && discountIsLive(terms) ? discountAmountOn(row.outstandingBalance, terms) : 0;
    },
    // What the pill prints: "2% · −$120.00", or "2% expired".
    searchText: (row) => {
      const terms = discountTermsFor(row);
      if (!terms || row.outstandingBalance <= 0) return '';
      if (!discountIsLive(terms)) return `${terms.percent}% Expired`;
      const d = discountAmountOn(row.outstandingBalance, terms);
      return `${terms.percent}% · ${formatMoney(-d, row.currency)}`;
    },
    // Early-pay discount from the invoice's PAYMENT TERM (8/28/26
    // evening), measured as of today on the listing; hover explains the
    // window with a worked example.
    render: (row) => {
      const terms = discountTermsFor(row);
      if (!terms || row.outstandingBalance <= 0) {
        return null;
      }
      // A closed window says so (9/22/26 review response, Claude C02-D6):
      // "2% expired" in grey instead of a live green offer on an invoice
      // 46 days past its discount deadline.
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
      const discount = discountAmountOn(row.outstandingBalance, terms);
      const daysLeft = discountDaysLeft(terms);
      return (
        <span onClick={(e) => e.stopPropagation()}>
          <HoverCard openDelay={150} closeDelay={80}>
            <HoverCardTrigger asChild>
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] cursor-help whitespace-nowrap"
                style={{ fontWeight: 600 }}
              >
                {terms.percent}% · {formatMoney(-discount, row.currency)}
              </span>
            </HoverCardTrigger>
            <HoverCardContent side="top" align="start" className="w-[280px] p-3 rounded-xl border border-border shadow-lg bg-white z-[300]">
              <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>
                Early-pay discount, {terms.label}
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                Pay by {formatUsDate(terms.deadline)} and take {terms.percent}% off the open balance.
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
    key: 'outstandingBalance',
    label: 'Amount Due',
    minWidth: 120,
    defaultWidth: 160,
    sortable: true,
    tooltip: "In each invoice's own currency. Sorting and the range filter use the PKR (base currency) equivalent.",
    filterType: 'range',
    // In the row's currency, sorted and range-filtered by base equivalent (as Amount).
    getValue: (row) => toInvoiceBase(row, row.outstandingBalance),
    getSortValue: (row) => toInvoiceBase(row, row.outstandingBalance),
    searchText: (row) =>
      row.outstandingBalance ? `${row.outstandingBalance} ${formatMoney(row.outstandingBalance, row.currency)}` : '',
    // Prepaid-origin note (9/2/26): an invoice that consumed a
    // prepayment at creation says so RIGHT WHERE its balance is read —
    // an inline violet wallet icon with the full math on hover.
    render: (row, { searchQuery }) => (
      <AmountWithPrepaidNote invoice={row}>
        <span
          className=""
          // Same weight as every other column (partner table pattern — no
          // heavier font for money columns, design feedback 7/13/26).
          style={{ fontWeight: 400, color: row.outstandingBalance > 0 ? palette.slate[900] : palette.slate[400] }}
        >
          <Money value={row.outstandingBalance} currency={row.currency} fx={invoiceFx(row)}>
            {highlightAmount(formatMoney(row.outstandingBalance, row.currency), searchQuery)}
          </Money>
        </span>
      </AmountWithPrepaidNote>
    ),
  },
  {
    key: 'apAccount',
    label: 'A/P Account',
    minWidth: 140,
    defaultWidth: 180,
    sortable: true,
    filterType: 'multiselect',
    uniqueValues: (rows) => Array.from(new Set(rows.map((r) => r.apAccount))).sort(),
    getValue: (row) => row.apAccount,
    // Searchable, so it highlights like every other matched cell (10/9/26).
    render: (row, { searchQuery }) => <span className="text-muted-foreground">{highlightText(row.apAccount, searchQuery)}</span>,
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
    // Flag + code, as the Currency & Exchange Rates module shows a currency;
    // the name rides the tooltip.
    searchText: (row) => `${row.currency} ${getCurrency(row.currency)?.name ?? ''}`,
    render: (row, { searchQuery }) => (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <CurrencyFlag code={row.currency} size={16} />
        <span>{highlightText(row.currency, searchQuery)}</span>
      </span>
    ),
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

/** Column filter value for an invoice, read through the column's own
 *  getValue (10/9/26): derived columns like Payment Status have no raw
 *  field, so filtering by the raw key never matched. Falls back to the
 *  raw field for keys outside the catalog. */
const INVOICE_COLUMN_BY_KEY = new Map(INVOICE_COLUMNS.map((c) => [c.key, c]));
export function invoiceColumnValue(invoice: Invoice, columnKey: string): unknown {
  const col = INVOICE_COLUMN_BY_KEY.get(columnKey);
  return col ? col.getValue(invoice) : (invoice as unknown as Record<string, unknown>)[columnKey];
}

interface InvoiceDataTableProps {
  invoices: Invoice[];
  /** UNFILTERED dataset for filter option lists — keeps every option
   *  visible while a multiselect filter is active. Defaults to `invoices`. */
  optionRows?: Invoice[];
  /** Every invoice the search listed, before paging: a hidden column any of
   *  them matched in comes out while the search runs (10/14/26). */
  searchRows?: Invoice[];
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
  onRowClick?: (invoice: Invoice) => void;
  onRowAction?: (actionId: InvoiceActionId, invoiceId: string, e: React.MouseEvent) => void;
  newlyCreatedId?: string | null;
  /** Active search query — text columns highlight matching substrings. */
  searchQuery?: string;
  /** Moves a single row action to the top of the overflow menu (e.g. the
   *  Ready to pay tab surfaces "Add Payment" first). Scoped per usage so the
   *  main invoicing listing keeps its default order. */
  promoteRowAction?: InvoiceActionId;
  /** Custom empty-state node (VI-50): e.g. a search no-match message with
   *  a Clear search action. Falls back to the DataTable default. */
  emptyState?: React.ReactNode;
  /** Table Empty & Error States Standard (11/3/26). */
  emptyConfig?: DataTableEmptyConfig;
}

/** Invoice-flavored DataTable wrapper. The only file that knows about
 *  the Invoice schema. Future Payments/Prepayments screens get their own
 *  thin wrapper. */
export function InvoiceDataTable({
  invoices,
  optionRows,
  searchRows,
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
  promoteRowAction,
  emptyState,
  emptyConfig,
}: InvoiceDataTableProps) {
  const renderRowActions = useMemo(
    () =>
      onRowAction
        ? (invoice: Invoice) => (
            <DropdownMenu>
              <DropdownMenuTrigger
                asChild
                onClick={(e) => e.stopPropagation()}
              >
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-muted" aria-label={`Actions for invoice ${invoice.invoiceNumber}`}>
                  <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[230px]" onClick={(e) => e.stopPropagation()}>
                {(() => {
                  // Category-segregated groups (partner-style), rendered with a
                  // divider between each. When a row promotes an action (e.g.
                  // Ready-to-pay promotes "Add Payment"), lift it into its own
                  // group at the very top and drop it from its normal bucket.
                  let groups = getRowActionGroups(invoice.status, invoice);
                  const promoted =
                    promoteRowAction
                      ? groups.flat().find((a) => a.id === promoteRowAction)
                      : undefined;
                  if (promoted) {
                    groups = [
                      [promoted],
                      ...groups
                        .map((g) => g.filter((a) => a.id !== promoted.id))
                        .filter((g) => g.length > 0),
                    ];
                  }
                  // Pre-invoices get an "Add prepayment" action (type-conditional,
                  // so it isn't in the status matrix) pinned to the top group. A
                  // pre-invoice isn't payable, so "Add Payment" is stripped out.
                  // Pending pre-invoices offer it too (7/16/26): an approver can
                  // prepay directly and the prepayment auto-approves the record.
                  if (invoice.type === 'Pre-Invoice') {
                    // A partly-paid pre-invoice still has an open balance, so
                    // it keeps offering "Add prepayment" (VI-41) — both the
                    // 'Partially Prepaid' and 'Partially Paid' payment states.
                    // A held invoice can't be paid (ERP-8796): no prepay.
                    const offerPrepay = !invoice.is_payment_held && ['Pending Approval', 'Approved', 'Partially Prepaid', 'Partially Paid'].includes(invoice.status);
                    groups = [
                      ...(offerPrepay ? [[{ id: 'addPrepayment', label: 'Add Prepayment', category: 'money' } as ReturnType<typeof getRowActionGroups>[number][number]]] : []),
                      ...groups
                        .map((g) => g.filter((a) => a.id !== 'addPayment'))
                        .filter((g) => g.length > 0),
                    ];
                  }
                  return groups.map((group, gi) => (
                    <Fragment key={gi}>
                      {gi > 0 && <DropdownMenuSeparator />}
                      {group.map((action) => {
                        const Icon = ACTION_ICONS[action.id];
                        const tone: ActionTone =
                          action.destructive || action.category === 'destructive'
                            ? 'destructive'
                            // Payment Hold reads amber like its modal (7/16/26).
                            : action.category === 'warning' || action.id === 'paymentHold'
                              ? 'warning'
                              : action.id === 'approve' || action.id === 'resolve' || action.id === 'releaseHold'
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
                  ));
                })()}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        : undefined,
    [onRowAction, promoteRowAction]
  );

  return (
    <DataTable
      rows={invoices}
      optionRows={optionRows}
      searchRows={searchRows}
      searchRevealAfter="invoiceNumber"
      columns={INVOICE_COLUMNS}
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
      currentPage={currentPage}
      recordsPerPage={recordsPerPage}
      totalRows={totalRows}
      onPageChange={onPageChange}
      onRecordsPerPageChange={onRecordsPerPageChange}
      emptyState={emptyState}
      emptyConfig={emptyConfig}
    />
  );
}
