import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { TableEmptyState, resolveTableEmptyKind } from '@/app/components/ui/table-empty-state';
import { findSearchSuggestion } from '@/app/utils/searchSuggestion';
import { formatUsDate, formatUsDateTime, overdueDaysOf, overdueLabel } from '@/app/lib/dueBucket';
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  Ban,
  Banknote,
  BookOpen,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Cog,
  Copy,
  Download,
  Eraser,
  FilePlus,
  FileText,
  Info,
  Link2,
  Lock,
  Mail,
  MailX,
  Maximize2,
  Minimize2,
  Package,
  Pencil,
  Receipt,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  MoreHorizontal,
  Eye,
  Trash2,
  Truck,
  Wallet,
  X,
  XCircle,
  MessageSquare,
  FileSignature,
  Flag,
  FilePenLine,
  Undo2,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { VendorAvatar } from '@/app/components/VendorAvatar';
import { PhotoPersonAvatar } from '@/app/components/data-table';
import { EmptyState } from '@/app/components/EmptyState';
import { LineItemsTable, ItemDescriptionWithToggle } from '@/app/components/invoice-details/LineItemsTab';
import { CreatedByCell, highlightAmount, highlightText } from '@/app/components/InvoiceDataTable';

/** Search highlight for a record's amount (10/9/26): the filter matches the
 *  raw figure ("1250" or "1250.00"), so the digits only mark when that
 *  match really happened, never on a digit run from another field. */
const amountMatches = (amount: number, query: string) => {
  const q = query.trim().toLowerCase();
  return !!q && (amount.toFixed(2).includes(q) || String(Math.round(amount)).includes(q));
};
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import {
  CustomerQuickCard,
  CUSTOMER_TYPE_CONFIG,
  TREATMENT_TONES,
  invoiceStatusLabelOf,
} from '@/app/components/customer/CustomerInvoiceDataTable';
import { RefundPrepaymentModal, refundGlEntries } from '@/app/components/customer/RefundPrepaymentModal';
import { partnerVendorUrl } from '@/app/data/mockVendors';
import { ItemImageWithPreview, ItemQuickViewModal } from '@/app/components/invoice-details/ItemQuickView';
import type { ColumnDef } from '@/app/components/data-table/types';
import { PaymentTermCard } from '@/app/components/vendors/PaymentTermCard';
import { actionToneClass, type ActionTone } from '@/app/lib/actionMenuTone';
import { palette } from '@/styles/tokens';
import type {
  CustomerInvoice,
  CustomerInvoiceLine,
  CustomerInvoiceHistoryEntry,
} from '@/app/data/ar/mockCustomerInvoices';
import type { CustomerDeposit } from '@/app/data/ar/mockCustomerDeposits';
import {
  addressLine,
  customerByName,
  findQuote,
  findSalesOrder,
  findShipment,
  lineCostOf,
  lockedUnitsFor,
  type Customer,
} from '@/app/data/ar/mockCustomers';
import { LockedUnitsChip } from './form/LockedUnitsChip';
import {
  daysOverdue,
  depositsAppliedTotal,
  isOverdue,
  netDue,
  paymentStatusOf,
  receiptsTotal,
  treatmentOf,
  settledTotal,
  depositHeldRemaining,
  showsExceptionStatus,
  TREATMENT_HELPER,
  TREATMENT_LABEL,
} from '@/app/data/ar/customerInvoiceStatus';
import {
  getCustomerRowActionGroups,
  hasMoneyApplied,
  type CustomerInvoiceActionId,
} from '@/app/data/ar/customerInvoiceActions';
import {
  BAD_DEBT_ACCOUNT,
  COGS_ACCOUNT,
  CUSTOMER_DEPOSITS_ACCOUNT,
  INVENTORY_ACCOUNT,
  DEFAULT_REVENUE_ACCOUNT,
  FREIGHT_INCOME_ACCOUNT,
  splitGlAccount,
} from '@/app/data/ar/arGlAccounts';
import { arTermById } from '@/app/data/ar/arPaymentTerms';
import {
  advanceInvoicesFor,
  advanceInvoicesForQuote,
  billingByShipmentLine,
  creditMemosFor,
  creditableRemaining,
  HOLDING_STATUSES,
  orderBilling,
  shipmentBillingStatus,
} from '@/app/data/ar/arBilling';
import { useArPermissions } from '@/app/hooks/useArSettings';
import type { CustomerInvoiceWorkflowAction, RefundPrepaymentPayload } from '@/app/hooks/useCustomerInvoicing';
import { AttachmentsTab } from '@/app/components/invoice-details/AttachmentsTab';
import { CollapseReveal } from '@/app/components/ui/collapse-reveal';
import { SegmentedCountPill } from '@/app/components/SegmentedCountPill';
import { InvoiceReasonDialog, type ReasonAction, type ReasonActionConfig } from '@/app/components/InvoiceReasonDialog';
import { ReleaseHoldDialog } from '@/app/components/ReleaseHoldDialog';
import { InvoiceTransitionOverlay } from '@/app/components/invoice-details/InvoiceTransitionOverlay';
import { CustomerNotesTab, type InvoiceNote } from '@/app/components/customer/CustomerNotesTab';
import { AR_ACTING_USER } from '@/app/hooks/useCustomerInvoicing';

/* ════════════════════════════════════════════════════════════════════
   CustomerInvoiceDetailScreen. The AR-native fork of the vendor
   InvoiceDetailScreen. One detail page carries all four document kinds
   (Shipment Invoice · Advance Invoice · Standalone · Credit Memo) in the
   visual language of the vendor page: status-tinted gradient header
   card with the morphing scrolled header, the pills row, the journey
   strip, the tab bar, the grouped Actions dropdown, the gradient-hero
   confirm/reason dialogs, and the collapsible right sidebar cards.

   Status model (PRD §14): Draft → Pending Approval → Approved, Send Back
   → Rejected (reason kept), Rejected → Cancelled, Cancelled → Archived
   flag → Restore. Sent is a FLAG with a date, never a status. Approved
   is read-only (BR-020): corrections go through a customer credit memo.
   Payment-side flags (credit hold, dispute, write-off) stay as they were
   until the Customer Payments PRD.
   ════════════════════════════════════════════════════════════════════ */

// ── Public contract ─────────────────────────────────────────────────

/** Workflow transitions this page applies itself (after its own confirm
 *  or reason dialog). Same vocabulary as the hook's applyCustomerInvoiceAction. */
export type CustomerWorkflowActionId = CustomerInvoiceWorkflowAction;

export interface CustomerInvoiceDetailScreenProps {
  invoice: CustomerInvoice;
  /** Full dataset, for related-document lookups (credit memos against
   *  this invoice, the order's other advance and balance invoices). */
  allInvoices: CustomerInvoice[];
  deposits: CustomerDeposit[];
  customers: Customer[];
  onClose: () => void;
  /** Workflow transitions the detail owns: it renders its own
   *  confirm/reason dialogs and then calls this to persist. */
  applyAction: (
    invoiceIds: string[],
    action: CustomerWorkflowActionId,
    reason: string,
    notifiedRecipientIds?: string[],
  ) => { blocked: string[] } | void;
  /** FAD 11/2 Revise: the parent creates the new version and opens it
   *  for editing. */
  onRevise?: (invoiceId: string, reason: string, notifiedRecipientIds?: string[]) => void;
  /** FAD 11/2 Refund or reverse the prepayment on an advance invoice. */
  onRefundPrepayment?: (invoiceId: string, payload: RefundPrepaymentPayload) => void;
  /** Actions the PARENT owns: edit (and Edit and Resubmit), send, resend
   *  (App opens SendToCustomerModal), recordPayment, issueCreditMemo,
   *  createBalanceInvoice, duplicate, downloadPdf. */
  onAction: (actionId: CustomerInvoiceActionId, invoiceId: string) => void;
  /** Delete Draft, after this page's destructive confirm. */
  onDeleteDraft: (invoiceId: string) => void;
}

// ── Display status + palettes ───────────────────────────────────────
// Mirrors the vendor InvoiceDetailScreen STATUS_PALETTE / STEP_COLORS
// exactly, so the header gradient, pills, journey circles and the
// transition overlay read the same on both detail pages. Draft (AR only)
// wears the vendor's neutral slate.

interface PillPalette {
  bg: string;
  color: string;
  border: string;
}

const STATUS_PALETTE: Record<string, PillPalette> = {
  Draft: { bg: '#F1F5F9', color: '#475569', border: '#E2E8F0' },
  'Pending Approval': { bg: '#EEF2FF', color: '#4338CA', border: '#C7D2FE' },
  Approved: { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  'Partially Paid': { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
  Paid: { bg: '#D1FAE5', color: '#065F46', border: '#6EE7B7' },
  'On Hold': { bg: '#FEF9C3', color: '#854D0E', border: '#FACC15' },
  Rejected: { bg: '#FFF1F2', color: '#BE123C', border: '#FECDD3' },
  Cancelled: { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' },
  Archived: { bg: '#FEE2E2', color: '#B91C1C', border: '#FECACA' },
  // FAD 11/2: a version replaced by a revision.
  Revised: { bg: '#F1F5F9', color: '#64748B', border: '#CBD5E1' },
  // Vendor parity (user 11/3): an open exception reads as the status.
  Exception: { bg: '#FEF3C7', color: '#92400E', border: '#FCD34D' },
};

const glowOf = (solid: string) => `color-mix(in srgb, ${solid} 18%, transparent)`;
const STEP_COLORS: Record<string, { solid: string; glow: string }> = {
  Draft: { solid: '#64748B', glow: glowOf('#64748B') },
  'Pending Approval': { solid: '#4338CA', glow: glowOf('#4338CA') },
  Approved: { solid: '#047857', glow: glowOf('#047857') },
  'Partially Paid': { solid: '#C2410C', glow: glowOf('#C2410C') },
  Paid: { solid: '#065F46', glow: glowOf('#065F46') },
  'On Hold': { solid: '#A16207', glow: glowOf('#A16207') },
  Rejected: { solid: '#BE123C', glow: glowOf('#BE123C') },
  Cancelled: { solid: '#B91C1C', glow: glowOf('#B91C1C') },
  Archived: { solid: '#DC2626', glow: 'color-mix(in srgb, #DC2626 14%, transparent)' },
  Revised: { solid: '#64748B', glow: glowOf('#64748B') },
};
const SENT_COLORS = { solid: '#0866E0', glow: glowOf('#0866E0') };
const UNPAID_COLORS = { solid: '#64748B', glow: glowOf('#64748B') };

// Payment axis pills: the vendor header's payment pill tones.
const PAYMENT_PALETTE: Record<string, PillPalette> = {
  Unpaid: { bg: '#F1F5F9', color: '#475569', border: '#E2E8F0' },
  'Partially Paid': STATUS_PALETTE['Partially Paid'],
  Paid: STATUS_PALETTE.Paid,
  Overdue: { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' },
  'Written Off': { bg: '#F1F5F9', color: '#475569', border: '#E2E8F0' },
  Cancelled: STATUS_PALETTE.Cancelled,
  'Deposit Awaited': { bg: '#F1F5F9', color: '#475569', border: '#E2E8F0' },
  'Deposit Received': { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
};

const FALLBACK_PALETTE: PillPalette = { bg: '#F1F5F9', color: '#475569', border: '#E2E8F0' };

// Flag pills ride beside the approval pill like the vendor "On hold"
// pill: Sent (a fact with a date), credit hold, dispute.
const SENT_PALETTE: PillPalette = { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' };
const CREDIT_HOLD_PALETTE: PillPalette = STATUS_PALETTE['On Hold'];
const DISPUTED_PALETTE: PillPalette = { bg: '#FFF1F2', color: '#BE123C', border: '#FECDD3' };
const EXCEPTION_PALETTE: PillPalette = { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' };

const isCreditMemo = (inv: CustomerInvoice) => inv.docKind === 'Credit Memo';
const nounOf = (inv: CustomerInvoice) =>
  inv.docKind === 'Credit Memo' ? 'credit memo' : inv.docKind === 'Advance Invoice' ? 'advance invoice' : 'invoice';
const titleNounOf = (inv: CustomerInvoice) =>
  inv.docKind === 'Credit Memo' ? 'Credit Memo' : inv.docKind === 'Advance Invoice' ? 'Advance Invoice' : 'Invoice';
const sentenceNounOf = (inv: CustomerInvoice) =>
  inv.docKind === 'Credit Memo' ? 'Credit memo' : inv.docKind === 'Advance Invoice' ? 'Advance invoice' : 'Invoice';

// Status-tinted gradient header card: the vendor headerCardStyle recipe
// verbatim (Archived wears the archive action's red family).
function headerCardStyle(statusLabel: string): React.CSSProperties {
  const p = STATUS_PALETTE[statusLabel] ?? FALLBACK_PALETTE;
  const base = statusLabel === 'Archived' ? '#FEE2E2' : p.bg;
  const softMix = `color-mix(in srgb, ${base} 35%, white)`;
  return {
    background: `linear-gradient(to top, ${base} 0%, ${softMix} 45%, #FFFFFF 90%)`,
    borderColor: statusLabel === 'Archived' ? '#FECACA' : p.border,
  };
}

/** Customer invoices open in a NEW TAB (linked-record standard). */
const openInvoiceTab = (invoiceNumber: string) =>
  window.open(`/customer-invoices/${encodeURIComponent(invoiceNumber)}`, '_blank', 'noopener');

// ── Money + date helpers ────────────────────────────────────────────

function fmtMoney(n: number): string {
  const negative = n < -0.004;
  return `${negative ? '−' : ''}$${Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// "Mar 28, 2026 at 03:15 PM", the vendor banner stamp.
const BANNER_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function bannerTimestamp(iso: string) {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso.trim());
  const d = new Date(dateOnly ? `${iso.trim()}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (dateOnly) return `${BANNER_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${BANNER_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${hours.toString().padStart(2, '0')}:${minutes} ${period}`;
}

// ── Tabs (vendor order and names) ───────────────────────────────────

type TabKey = 'line-items' | 'linked-records' | 'payments' | 'gl-impact' | 'notes' | 'communication' | 'attachments' | 'activity';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'line-items', label: 'Line Items' },
  { key: 'linked-records', label: 'Linked Records' },
  { key: 'payments', label: 'Payments' },
  { key: 'gl-impact', label: 'GL Impact' },
  { key: 'notes', label: 'Notes' },
  { key: 'communication', label: 'Communications' },
  { key: 'attachments', label: 'Attachments' },
  { key: 'activity', label: 'Activity' },
];

// ── Action menu: the vendor icon language and DETAIL_CATEGORY_ORDER ─

const ACTION_ICONS: Record<string, React.ElementType> = {
  edit: Pencil,
  submit: Send,
  approve: CheckCheck,
  reject: Ban,
  send: Send,
  resend: Send,
  downloadPdf: Download,
  recordPayment: Banknote,
  createBalanceInvoice: Truck,
  issueCreditMemo: Receipt,
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

type DetailActionCategory = 'money' | 'primary' | 'workflow' | 'adjust' | 'output' | 'warning' | 'destructive';
const DETAIL_CATEGORY_ORDER: DetailActionCategory[] = ['money', 'primary', 'workflow', 'adjust', 'output', 'warning', 'destructive'];

function detailActionCategory(key: string): DetailActionCategory {
  switch (key) {
    case 'recordPayment':
    case 'refundPrepayment':
      return 'money';
    case 'submit':
    case 'approve':
    case 'reject':
    case 'send':
    case 'resend':
    case 'createBalanceInvoice':
    case 'releaseCreditHold':
    case 'restore':
      return 'workflow';
    case 'issueCreditMemo':
    case 'creditHold':
    case 'writeOff':
    case 'reviseInvoice':
      return 'adjust';
    case 'markDisputed':
    case 'resolveDispute':
    case 'flagException':
    case 'resolveException':
      return 'warning';
    case 'downloadPdf':
      return 'output';
    case 'cancel':
    case 'archive':
    case 'deleteDraft':
      return 'destructive';
    default:
      return 'primary';
  }
}

interface MenuAction {
  id: string;
  label: string;
}

function groupDetailActions(actions: MenuAction[]): MenuAction[][] {
  return DETAIL_CATEGORY_ORDER.map((cat) => actions.filter((a) => detailActionCategory(a.id) === cat)).filter((g) => g.length > 0);
}

// ══════════════════════════════════════════════════════════════════
// Status journey: the vendor StatusWorkflowBar recipe. Approval track
// (Draft → Pending approval → send back / resubmit cycles → Approved →
// Sent, a flag with a date) | payments track once approved (Unpaid →
// Partially paid → Paid in full; advance: Deposit awaited → Deposit
// received). A live credit hold rides next to Approved, like the
// vendor's payment hold node.
// ══════════════════════════════════════════════════════════════════

interface JourneyNode {
  key: string;
  label: string;
  icon: React.ElementType;
  colors: { solid: string; glow: string };
  /** Tooltip detail: reason, who, when. */
  detail?: string;
}

interface JourneyTrackState {
  nodes: JourneyNode[];
  /** Index of the current (glowing) node; -1 = nothing happened yet. */
  currentIndex: number;
  allCompleted: boolean;
}

function lastEntry(history: CustomerInvoiceHistoryEntry[] | undefined, action: string): CustomerInvoiceHistoryEntry | undefined {
  return [...(history ?? [])].reverse().find((e) => e.action === action);
}

function lastReason(history: CustomerInvoiceHistoryEntry[] | undefined, action: string): string | undefined {
  return lastEntry(history, action)?.reason || undefined;
}

function journeyMoney(amount: number) {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function buildCustomerJourney(invoice: CustomerInvoice): { approval: JourneyTrackState; payments: JourneyTrackState } {
  const history = invoice.actionHistory ?? [];
  const s = invoice.invoiceStatus;
  const timeOf = (x?: string) => {
    const t = x ? Date.parse(x) : NaN;
    return Number.isNaN(t) ? 0 : t;
  };
  const happened: JourneyNode[] = [];
  const future: JourneyNode[] = [];
  const payHappened: JourneyNode[] = [];
  const payFuture: JourneyNode[] = [];

  happened.push({ key: 'draft', label: 'Draft', icon: Pencil, colors: STEP_COLORS.Draft, detail: `Created by ${invoice.createdBy}` });
  const reachedPending = s !== 'Draft' && (!!invoice.submittedAt || s !== 'Cancelled' || history.some((e) => e.action === 'submit' || e.action === 'reject'));
  if (reachedPending) {
    happened.push({ key: 'pending', label: 'Pending Approval', icon: FileText, colors: STEP_COLORS['Pending Approval'] });
  } else if (s === 'Draft') {
    future.push({ key: 'pending', label: 'Pending Approval', icon: FileText, colors: STEP_COLORS['Pending Approval'] });
  }
  // Send back / resubmit cycles: the record's real approval story.
  const cycles: Array<{ time: number; node: JourneyNode }> = [];
  history.forEach((e, i) => {
    const t = timeOf(e.at) + i;
    if (e.action === 'reject') cycles.push({ time: t, node: { key: `reject-${i}`, label: 'Rejected', icon: Ban, colors: STEP_COLORS.Rejected, detail: e.reason || undefined } });
    else if (e.action === 'resubmit' || (e.action === 'submit' && history.slice(0, i).some((p) => p.action === 'reject'))) {
      cycles.push({ time: t, node: { key: `resubmit-${i}`, label: 'Resubmitted', icon: RotateCcw, colors: STEP_COLORS['Pending Approval'], detail: 'Back in the approval queue' } });
    }
  });
  cycles.sort((a, b) => a.time - b.time).forEach((c) => happened.push(c.node));
  if (s === 'Rejected' && happened[happened.length - 1]?.label !== 'Rejected') {
    happened.push({ key: 'rejected-now', label: 'Rejected', icon: Ban, colors: STEP_COLORS.Rejected, detail: invoice.rejectionReason ?? lastReason(history, 'reject') });
  }

  const approvedNode: JourneyNode = {
    key: 'approved',
    label: 'Approved',
    icon: CheckCircle2,
    colors: STEP_COLORS.Approved,
    detail: invoice.docKind === 'Advance Invoice' ? 'Approved. Nothing posts on an advance invoice.' : invoice.approvedBy ? `Approved by ${invoice.approvedBy}` : undefined,
  };
  const sentNode: JourneyNode = {
    key: 'sent',
    label: 'Sent',
    icon: Send,
    colors: SENT_COLORS,
    detail: invoice.sentAt ? `Sent ${formatUsDateTime(invoice.sentAt)}` : 'Not sent to the customer yet',
  };
  const holdNode: JourneyNode = { key: 'hold', label: 'Credit Hold', icon: Lock, colors: STEP_COLORS['On Hold'], detail: lastReason(history, 'creditHold') };

  if (s === 'Approved') {
    happened.push(approvedNode);
    if (invoice.creditHold) happened.push(holdNode);
    if (invoice.sentAt) happened.push(sentNode);
    else future.push(sentNode);
  } else if (s === 'Cancelled') {
    happened.push({ key: 'cancelled', label: 'Cancelled', icon: X, colors: STEP_COLORS.Cancelled, detail: lastReason(history, 'cancel') });
    if (invoice.archived) {
      happened.push({ key: 'archived', label: 'Archived', icon: Archive, colors: STEP_COLORS.Archived, detail: lastReason(history, 'archive') });
    }
  } else {
    future.push(approvedNode);
    future.push(sentNode);
  }

  // ── Payments track: approved, money-bearing documents only ──
  let paymentsAllCompleted = false;
  if (s === 'Approved' && invoice.docKind !== 'Credit Memo') {
    if (invoice.docKind === 'Advance Invoice') {
      payHappened.push({ key: 'awaited', label: 'Deposit Awaited', icon: Wallet, colors: UNPAID_COLORS });
      const received: JourneyNode = { key: 'received', label: 'Deposit Received', icon: Check, colors: STEP_COLORS.Paid };
      if (invoice.depositReceived) {
        payHappened.push(received);
        paymentsAllCompleted = true;
      } else payFuture.push(received);
    } else {
      const paid = r2(receiptsTotal(invoice) + depositsAppliedTotal(invoice));
      const due = netDue(invoice);
      payHappened.push({
        key: 'unpaid',
        label: 'Unpaid',
        icon: Wallet,
        colors: UNPAID_COLORS,
        detail: paid <= 0.005 ? 'No payments recorded yet' : undefined,
      });
      if (paid > 0.005 && due > 0.004) {
        payHappened.push({
          key: 'partial',
          label: 'Partially Paid',
          icon: Banknote,
          colors: STEP_COLORS['Partially Paid'],
          detail: `${journeyMoney(paid)} of ${journeyMoney(invoice.amount)} settled`,
        });
      }
      if (invoice.writtenOff) {
        payHappened.push({ key: 'written-off', label: 'Written Off', icon: Eraser, colors: UNPAID_COLORS, detail: lastReason(history, 'writeOff') });
        paymentsAllCompleted = true;
      } else if (due <= 0.004) {
        payHappened.push({ key: 'paid', label: 'Paid in Full', icon: Check, colors: STEP_COLORS.Paid });
        paymentsAllCompleted = true;
      } else {
        payFuture.push({ key: 'paid', label: 'Paid in Full', icon: Check, colors: STEP_COLORS.Paid });
      }
    }
  }


  return {
    approval: {
      nodes: [...happened, ...future],
      currentIndex: happened.length - 1,
      allCompleted: s === 'Approved' && !!invoice.sentAt && !invoice.creditHold,
    },
    payments: {
      nodes: [...payHappened, ...payFuture],
      currentIndex: payHappened.length - 1,
      allCompleted: paymentsAllCompleted,
    },
  };
}

// One connected run of journey nodes: the vendor JourneyTrack verbatim.
function JourneyTrack({ track, grow }: { track: JourneyTrackState; grow: boolean }) {
  const { nodes, currentIndex, allCompleted } = track;
  return (
    <div className={`flex items-center gap-1.5 min-w-0 ${grow ? 'flex-1' : 'shrink-0'}`}>
      {nodes.map((node, idx) => {
        const isCompleted = idx < currentIndex || (allCompleted && idx <= currentIndex);
        const isCurrent = idx === currentIndex && !allCompleted;
        const isLast = idx === nodes.length - 1;
        const NodeIcon = node.icon;
        return (
          <div key={node.key} className="contents">
            <div className="flex items-center gap-1.5 shrink-0" title={node.detail}>
              <div
                className="flex items-center justify-center rounded-full shrink-0"
                style={{
                  width: isCurrent ? 24 : isCompleted ? 22 : 20,
                  height: isCurrent ? 24 : isCompleted ? 22 : 20,
                  ...(isCompleted
                    ? { backgroundColor: node.colors.solid, boxShadow: `0 2px 6px ${node.colors.glow}` }
                    : isCurrent
                      ? { backgroundColor: node.colors.solid, boxShadow: `0 0 0 3px ${node.colors.glow}, 0 2px 8px color-mix(in srgb, currentColor 8%, transparent)` }
                      : { backgroundColor: 'transparent', border: '1.5px solid hsl(var(--border))' }),
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                {isCompleted ? (
                  <Check className="size-2.5 text-white" style={{ strokeWidth: 3 }} />
                ) : isCurrent ? (
                  <NodeIcon className="size-3 text-white" style={{ strokeWidth: 2.5 }} />
                ) : (
                  <NodeIcon className="size-2.5" style={{ color: '#64748B', strokeWidth: 2 }} />
                )}
              </div>
              <span
                className="hidden sm:block whitespace-nowrap text-[12px] transition-all duration-300"
                style={
                  isCompleted
                    ? { fontWeight: 500, color: node.colors.solid }
                    : isCurrent
                      ? { fontWeight: 600, color: '#0F172A' }
                      : { fontWeight: 500, color: '#475569' }
                }
              >
                {node.label}
              </span>
            </div>
            {!isLast && (
              <div className="flex-1 mx-1.5 lg:mx-2 min-w-[10px] relative" style={{ height: 4 }}>
                {idx < currentIndex || allCompleted ? (
                  <div className="absolute inset-0 rounded-full" style={{ backgroundColor: node.colors.solid, height: 2, top: '50%', transform: 'translateY(-50%)' }} />
                ) : (
                  <div
                    className="absolute rounded-full"
                    style={{
                      inset: 0,
                      height: 2,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      backgroundColor: '#94A3B8',
                      WebkitMaskImage: 'repeating-linear-gradient(90deg, black 0px, black 5px, transparent 5px, transparent 10px)',
                      maskImage: 'repeating-linear-gradient(90deg, black 0px, black 5px, transparent 5px, transparent 10px)',
                      opacity: 0.85,
                    }}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusWorkflowBar({ invoice }: { invoice: CustomerInvoice }) {
  const { approval, payments } = useMemo(() => buildCustomerJourney(invoice), [invoice]);
  return (
    <div className="px-4 lg:px-5 py-2.5 overflow-x-auto">
      <div className="relative flex items-center w-full gap-3 py-1" style={{ minHeight: 32 }}>
        <JourneyTrack track={approval} grow={payments.nodes.length === 0} />
        {payments.nodes.length > 0 && (
          <>
            <div className="w-px h-6 bg-border shrink-0" />
            <JourneyTrack track={payments} grow />
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Status-reason banner: the vendor StatusReasonBanner recipe. Blocked
// or terminal states replay their reason at the top of every tab.
// ══════════════════════════════════════════════════════════════════

interface BannerSpec {
  key: string;
  title: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  border: string;
  reason?: string;
  by?: string;
  at?: string;
  fallback: string;
  chip?: string;
  cta?: { label: string; icon: React.ElementType; className: string; onClick: () => void };
}

function StatusReasonBanner({ banner }: { banner: BannerSpec }) {
  const Icon = banner.icon;
  return (
    <div className="rounded-xl border bg-white px-4 py-3 flex items-start gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]" style={{ borderColor: banner.border }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: banner.iconBg }}>
        <Icon className="w-4 h-4" style={{ color: banner.iconColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-foreground" style={{ fontWeight: 700 }}>{banner.title}</p>
        <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">
          <span
            className="inline-flex px-1.5 py-px rounded-md text-[9px] align-middle mr-1.5"
            style={{ fontWeight: 700, backgroundColor: banner.iconBg, color: banner.iconColor }}
          >
            {banner.chip ?? 'Reason'}
          </span>
          {banner.reason ? banner.reason : banner.fallback}
          {(banner.by || banner.at) && (
            <span className="text-slate-400">
              {' '}
              · {[banner.by ? `by ${banner.by}` : '', banner.at ? `on ${bannerTimestamp(banner.at)}` : ''].filter(Boolean).join(' ')}
            </span>
          )}
        </p>
      </div>
      {banner.cta && (
        <button
          type="button"
          onClick={banner.cta.onClick}
          className={`shrink-0 self-center h-8 px-3.5 rounded-lg bg-white border text-[12px] inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm ${banner.cta.className}`}
          style={{ fontWeight: 600 }}
        >
          <banner.cta.icon className="w-3.5 h-3.5" />
          {banner.cta.label}
        </button>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Reason dialogs: the shared vendor InvoiceReasonDialog, reused AS IS
// through its configOverride seam with the AR copy and reason lists.
// ══════════════════════════════════════════════════════════════════

type ReasonActionId =
  | 'reject' | 'cancel' | 'archive' | 'restore' | 'creditHold' | 'writeOff'
  // FAD 11/2
  | 'markDisputed' | 'resolveDispute' | 'flagException' | 'resolveException' | 'reviseInvoice';

const OTHER = 'Other';

function reasonDialogSpec(action: ReasonActionId, inv: CustomerInvoice): { base: ReasonAction; override: Partial<ReasonActionConfig> } {
  const noun = nounOf(inv);
  const titleNoun = titleNounOf(inv);
  switch (action) {
    case 'reject':
      return {
        base: 'reject',
        override: {
          targetLabel: 'Send Back',
          title: `Send this ${noun} back?`,
          description: 'It moves to Rejected and the reason stays on the record. The clerk edits it and resubmits. Nothing posts.',
          actionText: `Send Back ${titleNoun}`,
          reasons: ['Incorrect Amount', 'Wrong Customer or Order', 'Missing Customer PO Number', 'Duplicate', OTHER],
          notify: { label: 'Notify People', helper: `They'll be told this ${noun} was sent back.`, accentColor: 'hsl(var(--destructive))', accentBg: '#FEF2F2', accentBorder: '#FECACA', accentText: '#B91C1C' },
          descriptionPlaceholder: `Why is this ${noun} going back?`,
        },
      };
    case 'cancel':
      return {
        base: 'cancel',
        override: {
          title: `Cancel this ${noun}?`,
          description: `A cancelled ${noun} is kept as a record and releases anything it held. Nothing posts. It can then be archived.`,
          actionText: `Cancel ${titleNoun}`,
          reasons: ['Created in Error', 'Duplicate', 'Order Was Cancelled', 'Customer Request', OTHER],
          notify: { label: 'Notify People', helper: `They'll be told this ${noun} was cancelled.`, accentColor: 'hsl(var(--destructive))', accentBg: '#FEF2F2', accentBorder: '#FECACA', accentText: '#B91C1C' },
          descriptionPlaceholder: `Why is this ${noun} being cancelled?`,
          secondaryText: `Keep ${titleNoun}`,
        },
      };
    case 'archive':
      return {
        base: 'archive',
        override: {
          title: `Archive this ${noun}?`,
          description: 'It leaves the active views and stays searchable as Archived. Restore brings it back as Cancelled.',
          actionText: `Archive ${titleNoun}`,
          reasons: ['No Longer Needed', 'Duplicate', 'Clean Up', OTHER],
          notify: { label: 'Notify People', helper: `They'll be told this ${noun} was archived.`, accentColor: 'hsl(var(--destructive))', accentBg: '#FEF2F2', accentBorder: '#FECACA', accentText: '#B91C1C' },
          descriptionPlaceholder: `Why is this ${noun} being archived?`,
          secondaryText: `Keep ${titleNoun}`,
        },
      };
    case 'restore':
      return {
        base: 'restore',
        override: {
          title: `Restore this ${noun}?`,
          description: `The ${noun} comes out of the archive and goes back to Cancelled.`,
          actionText: `Restore ${titleNoun}`,
          reasons: ['Archived in error', 'Needed for audit', 'Needed to match a customer statement', OTHER],
          notify: { label: 'Notify People', helper: `They'll be told this ${noun} was restored to Cancelled.`, accentColor: 'hsl(var(--primary))', accentBg: '#EFF6FF', accentBorder: '#BFDBFE', accentText: '#1D4ED8' },
          descriptionPlaceholder: `Why is this ${noun} being restored?`,
        },
      };
    case 'creditHold':
      return {
        base: 'paymentHold',
        override: {
          targetLabel: 'Credit Hold',
          title: 'Put this invoice on credit hold?',
          description: "It can't be sent and no money can be recorded against it until the hold is released. Approval and posting aren't affected.",
          actionText: 'Place on Credit Hold',
          reasons: ['Past Due Balance', 'Credit Limit Exceeded', 'Dispute in Progress', 'Payment History Concerns', OTHER],
          notify: { label: 'Notify People', helper: "They'll be told it's on credit hold, and again when it's released.", accentColor: '#A16207', accentBg: '#FEFCE8', accentBorder: '#FEF08A', accentText: '#A16207' },
          descriptionPlaceholder: "What's holding this up?",
          secondaryText: 'Go Back',
        },
      };
    case 'writeOff': {
      // FAD 11/2: all or nothing, the GL line rides in the description.
      const due = netDue(inv);
      const { code, name } = splitGlAccount(BAD_DEBT_ACCOUNT);
      return {
        base: 'cancel',
        override: {
          targetLabel: 'Write Off',
          title: 'Write off the remaining balance?',
          description: `${fmtMoney(due)} moves to bad debt and the invoice stops aging. Posts Debit ${code} ${name}, Credit ${inv.arAccount}.`,
          actionText: 'Write Off Balance',
          icon: Eraser,
          reasons: ['Uncollectible Balance', 'Customer Bankruptcy', 'Small Balance Adjustment', 'Settlement Agreement', OTHER],
          notify: { label: 'Notify People', helper: "They'll be told the balance was written off.", accentColor: 'hsl(var(--destructive))', accentBg: '#FEF2F2', accentBorder: '#FECACA', accentText: '#B91C1C' },
          descriptionPlaceholder: 'Why is this balance being written off?',
          secondaryText: 'Go Back',
        },
      };
    }
    // FAD 11/2: dispute and exception flags store who and why.
    case 'markDisputed':
      return {
        // Single reason (radios), the hold recipe in rose.
        base: 'paymentHold',
        override: {
          targetLabel: 'Disputed',
          title: 'Flag this invoice as disputed?',
          description: 'Collections sees the customer is contesting it. It keeps aging until the dispute is resolved.',
          actionText: 'Flag as Disputed',
          icon: Flag,
          bg: '#FFF1F2',
          solid: '#E11D48',
          reasons: ['Pricing disagreement', 'Quantity disagreement', 'Damaged goods', 'Not received', OTHER],
          notify: { label: 'Notify People', helper: "They'll be told this invoice is disputed.", accentColor: '#E11D48', accentBg: '#FFF1F2', accentBorder: '#FECDD3', accentText: '#BE123C' },
          descriptionPlaceholder: 'What is the customer contesting?',
          secondaryText: 'Go Back',
        },
      };
    case 'resolveDispute':
      return {
        base: 'restore',
        override: {
          targetLabel: 'Resolve Dispute',
          title: 'Resolve the dispute?',
          description: `The disputed flag comes off ${inv.invoiceNumber} and collections resumes normally.`,
          actionText: 'Resolve Dispute',
          icon: ShieldCheck,
          bg: '#ECFDF5',
          solid: '#047857',
          reasons: ['Customer agreed to pay', 'Credit memo issued', 'Price corrected', 'Goods received', OTHER],
          notify: { label: 'Notify People', helper: "They'll be told the dispute was resolved.", accentColor: '#047857', accentBg: '#ECFDF5', accentBorder: '#A7F3D0', accentText: '#047857' },
          descriptionPlaceholder: 'How was the dispute resolved?',
          secondaryText: 'Keep Disputed',
        },
      };
    case 'flagException':
      return {
        base: 'flagException',
        override: {
          title: `Flag this ${noun} as an exception?`,
          description: inv.invoiceStatus === 'Approved'
            ? 'The exception stays on the record until someone resolves it. Posting is not affected.'
            : `The ${noun} can't be approved until the exception is resolved.`,
          actionText: 'Flag as Exception',
          reasons: ['Price variance', 'Quantity variance', 'Missing documents', OTHER],
          notify: { label: 'Notify People', helper: "They'll be told about the exception.", accentColor: '#D97706', accentBg: '#FFFBEB', accentBorder: '#FDE68A', accentText: '#B45309' },
          descriptionPlaceholder: 'What needs a look?',
          secondaryText: 'Go Back',
        },
      };
    case 'resolveException':
      return {
        base: 'restore',
        override: {
          targetLabel: 'Resolve Exception',
          title: 'Resolve the exception?',
          description: `The exception comes off ${inv.invoiceNumber}.${inv.invoiceStatus === 'Pending Approval' ? ' It can then be approved.' : ''}`,
          actionText: 'Resolve Exception',
          icon: CheckCircle2,
          bg: '#ECFDF5',
          solid: '#047857',
          reasons: ['Variance accepted', 'Corrected on the invoice', 'Documents received', OTHER],
          notify: { label: 'Notify People', helper: "They'll be told the exception was resolved.", accentColor: '#047857', accentBg: '#ECFDF5', accentBorder: '#A7F3D0', accentText: '#047857' },
          descriptionPlaceholder: 'How was it resolved?',
          secondaryText: 'Keep Exception',
        },
      };
    case 'reviseInvoice':
      return {
        base: 'cancel',
        override: {
          targetLabel: 'Revise',
          title: 'Revise Invoice',
          description: 'The posted version is reversed and a new version opens for editing. The old version stays in history.',
          actionText: 'Revise Invoice',
          icon: FilePenLine,
          bg: '#EFF6FF',
          solid: '#0866E0',
          reasons: ['Pricing correction', 'Quantity correction', 'Wrong customer details', OTHER],
          notify: { label: 'Notify People', helper: `They'll be told ${inv.invoiceNumber} is being revised.`, accentColor: 'hsl(var(--primary))', accentBg: '#EFF6FF', accentBorder: '#BFDBFE', accentText: '#1D4ED8' },
          descriptionPlaceholder: 'What needs to change?',
          secondaryText: 'Go Back',
        },
      };
  }
}

// ══════════════════════════════════════════════════════════════════
// Confirm dialogs: the vendor status-change confirmation recipe (glow
// header, 72px icon tile, action pill, 20px title, h-12 stacked CTAs).
// ══════════════════════════════════════════════════════════════════

type ConfirmActionId = 'submit' | 'approve' | 'deleteDraft';

const strong = (text: string) => (
  <span className="text-foreground" style={{ fontWeight: 600 }}>
    {text}
  </span>
);

const CONFIRM_CONFIG: Record<
  ConfirmActionId,
  {
    pill: string;
    target: string;
    destructive?: boolean;
    title: (inv: CustomerInvoice) => string;
    body: (inv: CustomerInvoice) => React.ReactNode;
    actionText: (inv: CustomerInvoice) => string;
    cancelText: (inv: CustomerInvoice) => string;
    toastText: (inv: CustomerInvoice) => string;
  }
> = {
  submit: {
    pill: 'Submit',
    target: 'Pending Approval',
    title: (inv) => `Submit this ${nounOf(inv)}?`,
    body: (inv) => (
      <>
        {strong(inv.invoiceNumber)} moves to {strong('Pending Approval')} and the approver is notified. Nothing posts until it is approved.
      </>
    ),
    actionText: (inv) => `Submit ${titleNounOf(inv)}`,
    cancelText: (inv) => `Keep as ${invoiceStatusLabelOf(inv)}`,
    toastText: (inv) => `${sentenceNounOf(inv)} submitted for approval`,
  },
  approve: {
    pill: 'Approve',
    target: 'Approved',
    title: (inv) => `Approve this ${nounOf(inv)}?`,
    body: (inv) =>
      inv.docKind === 'Credit Memo' ? (
        <>
          {strong(inv.invoiceNumber)} posts and lowers what {strong(inv.customer)} owes
          {inv.relatedInvoiceNumber ? <> on {strong(inv.relatedInvoiceNumber)}</> : null}.
        </>
      ) : inv.docKind === 'Advance Invoice' && treatmentOf(inv) === 'Revenue' ? (
        <>
          {strong(inv.invoiceNumber)} posts revenue and cost now, and the locked units move out of available stock as a hard allocation.
        </>
      ) : inv.docKind === 'Advance Invoice' ? (
        <>
          {strong(inv.invoiceNumber)} moves to {strong('Approved')}. Revenue on shipment: it posts as a pre-invoice and nothing reaches revenue until the goods ship.
        </>
      ) : (
        <>
          {strong(inv.invoiceNumber)} will post to the general ledger and move to {strong('Approved')}.
        </>
      ),
    actionText: (inv) => `Approve ${titleNounOf(inv)}`,
    cancelText: (inv) => `Keep as ${invoiceStatusLabelOf(inv)}`,
    toastText: (inv) => `${sentenceNounOf(inv)} approved`,
  },
  deleteDraft: {
    pill: 'Delete Draft',
    target: 'Cancelled',
    destructive: true,
    title: () => 'Delete this draft?',
    body: (inv) => (
      <>
        {strong(inv.invoiceNumber)} is removed for good and anything it held is released. Nothing ever posted. This cannot be undone.
      </>
    ),
    actionText: () => 'Delete Draft',
    cancelText: () => 'Keep Draft',
    toastText: () => 'Draft deleted',
  },
};

function CustomerConfirmDialog({
  action,
  invoice,
  onOpenChange,
  onConfirm,
}: {
  action: ConfirmActionId | null;
  invoice: CustomerInvoice;
  onOpenChange: (open: boolean) => void;
  onConfirm: (action: ConfirmActionId) => void;
}) {
  return (
    <AlertDialog open={!!action} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="max-w-[calc(100%-2rem)] sm:max-w-[420px] p-0 overflow-hidden gap-0 rounded-2xl border-0"
        style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
      >
        {(() => {
          if (!action) return null;
          const config = CONFIRM_CONFIG[action];
          const targetStep = STEP_COLORS[config.target] ?? STEP_COLORS.Approved;
          const targetPalette = STATUS_PALETTE[config.target] ?? STATUS_PALETTE.Approved;
          const solid = targetStep.solid;
          const HeaderIcon = config.destructive ? AlertTriangle : CheckCircle2;
          const lightTint = `color-mix(in srgb, ${targetPalette.bg} 50%, white)`;
          return (
            <>
              <div
                className="relative flex flex-col items-center pt-11 pb-7"
                style={{
                  background: `linear-gradient(180deg, ${lightTint} 0%, color-mix(in srgb, ${lightTint} 30%, transparent) 70%, transparent 100%)`,
                }}
              >
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[90px] rounded-full opacity-25 pointer-events-none"
                  style={{ backgroundColor: solid, filter: 'blur(50px)' }}
                />
                <div className="relative w-[72px] h-[72px] rounded-2xl flex items-center justify-center" style={{ backgroundColor: targetPalette.bg }}>
                  <HeaderIcon className="w-9 h-9" style={{ color: solid, strokeWidth: 2 }} />
                </div>
                <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: lightTint, color: targetPalette.color }}>
                  {config.pill}
                </span>
              </div>

              <div className="flex flex-col items-center text-center px-9 pb-9">
                <AlertDialogTitle className="text-[20px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600, lineHeight: 1.3 }}>
                  {config.title(invoice)}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-[13px] mt-3 mx-auto text-muted-foreground" style={{ lineHeight: 1.7, maxWidth: '340px' }}>
                  {config.body(invoice)}
                </AlertDialogDescription>

                <div className="w-full mt-8 flex flex-col gap-2.5">
                  <AlertDialogAction
                    onClick={() => onConfirm(action)}
                    className="w-full h-12 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
                    style={{ fontWeight: 600, backgroundColor: solid, color: '#fff' }}
                  >
                    {config.actionText(invoice)}
                  </AlertDialogAction>
                  <AlertDialogCancel
                    className="w-full h-12 text-[14px] rounded-xl border-0 cursor-pointer transition-colors mt-0"
                    style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                  >
                    {config.cancelText(invoice)}
                  </AlertDialogCancel>
                </div>
              </div>
            </>
          );
        })()}
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Notes: the vendor NotesTab, session store keyed by document id ──
const NOTES_STORE = new Map<string, InvoiceNote[]>();

// ══════════════════════════════════════════════════════════════════
// Tab: Line Items. The vendor LineItemsTable chrome (search, count,
// density, columns, item thumbnails with the quick view) with the
// columns each document kind bills by (PRD §7.4, §8.4, §9.3):
//   Shipment   · Shipment, SO, Qty Shipped, Invoice Qty, Price, Line
//                Total (advance-covered caption, BR-009), Revenue Account
//   Advance    · Ordered, Shipped, Advance %, Advance Amount (no account)
//   Standalone · Description, Qty, Rate, Line Total, Revenue Account
//   Credit     · Source Line, Credited Qty, Price, Credit Amount, Account
// Freight and charges follow in their own compact card.
// ══════════════════════════════════════════════════════════════════

const qtyCell = (qty: number | undefined, uom: string) =>
  qty === undefined ? null : (
    <div>
      <div className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>{qty}</div>
      <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>{uom}</div>
    </div>
  );

const accountCell = (account: string, searchQuery: string) =>
  account ? (
    <span className="text-[12px] text-slate-600 ">{highlightText(account, searchQuery)}</span>
  ) : null;

/* Settled at Shipment (FAD 11/2): a Deposit pre-invoice turns into
   revenue on the SAME invoice as each shipment on its order goes out.
   One row per shipment, then what is still held. */
function SettledAtShipmentCard({ invoice }: { invoice: CustomerInvoice }) {
  const rows = invoice.settlements ?? [];
  const settled = settledTotal(invoice);
  const held = depositHeldRemaining(invoice);
  return (
    <div className="mt-3.5 rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2.5">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#F0FDFA' }}>
          <Truck className="w-3.5 h-3.5" style={{ color: '#0F766E' }} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] text-foreground tracking-tight" style={{ fontWeight: 500 }}>Settled at Shipment</h3>
          <p className="text-[11px] text-slate-400">The deposit applies and revenue is recognised on this invoice as each shipment goes out.</p>
        </div>
        <span className="text-[10px] rounded-full px-2 py-0.5 bg-muted text-muted-foreground shrink-0" style={{ fontWeight: 500 }}>
          {rows.length} {rows.length === 1 ? 'shipment' : 'shipments'}
        </span>
      </div>
      <table className="w-full text-[12px]">
        <thead className="bg-slate-50/60 border-b border-slate-100">
          <tr>
            <th className="text-left pl-5 pr-4 py-2 text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Shipment No.</th>
            <th className="text-left px-4 py-2 text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Ship Date</th>
            <th className="text-right px-4 py-2 text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Units</th>
            <th className="text-right px-4 py-2 pr-5 text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Moved to Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((st) => (
            <tr key={st.shipmentNumber} className="border-b border-slate-100 hover:bg-[#F8FAFF] transition-colors">
              <td className="pl-5 pr-4 py-2.5 text-foreground" style={{ fontWeight: 500 }}>{st.shipmentNumber}</td>
              <td className="px-4 py-2.5 text-slate-600">{formatUsDate(st.date)}</td>
              <td className="px-4 py-2.5 text-right text-slate-600">{st.units}</td>
              <td className="px-4 py-2.5 pr-5 text-right text-foreground" style={{ fontWeight: 500 }}>{fmtMoney(st.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-b border-slate-100 bg-slate-50/50">
            <td colSpan={3} className="pl-5 pr-4 py-2 text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Settled So Far</td>
            <td className="px-4 py-2 pr-5 text-right text-foreground" style={{ fontWeight: 500 }}>{fmtMoney(settled)}</td>
          </tr>
          <tr style={{ backgroundColor: '#F5F3FF' }}>
            <td colSpan={3} className="pl-5 pr-4 py-2 text-[11px]" style={{ fontWeight: 500, color: '#6D28D9' }}>
              Still Held in {CUSTOMER_DEPOSITS_ACCOUNT}
            </td>
            <td className="px-4 py-2 pr-5 text-right" style={{ fontWeight: 500, color: '#6D28D9' }}>{fmtMoney(held)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function CustomerLineItemsTab({ invoice, allInvoices }: { invoice: CustomerInvoice; allInvoices: CustomerInvoice[] }) {
  const lines = invoice.lines;
  const [itemPreview, setItemPreview] = useState<{ sku: string; description: string; unitPrice: number; uom: string } | null>(null);
  const kind = invoice.docKind;
  const parent = kind === 'Credit Memo' && invoice.relatedInvoiceNumber
    ? allInvoices.find((i) => i.invoiceNumber === invoice.relatedInvoiceNumber)
    : undefined;

  if (lines.length === 0) {
    return (
      <div>
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-slate-200 bg-white">
          <Package className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-[13px] text-slate-600" style={{ fontWeight: 600 }}>
            {kind === 'Credit Memo' ? 'This credit memo credits an amount, not lines.' : `No line items on this ${nounOf(invoice)}.`}
          </p>
        </div>
      </div>
    );
  }

  const itemColumn: ColumnDef<CustomerInvoiceLine> = {
    key: 'item', label: kind === 'Standalone' ? 'Description' : 'Item', minWidth: 200, defaultWidth: 260, align: 'left', locked: true, sticky: 'left', flex: true,
    getValue: (l) => l.sku || l.description,
    getSortValue: (l) => l.sku || l.description,
    render: (line, { searchQuery }) =>
      line.sku ? (
        <div className="flex items-start gap-3 py-1">
          <ItemImageWithPreview
            sku={line.sku}
            alt={line.sku}
            unitPrice={line.unitPrice}
            uom={line.uom}
            serialized={false}
            onPreview={() => setItemPreview({ sku: line.sku, description: line.description, unitPrice: line.unitPrice, uom: line.uom })}
            disabled={!!itemPreview}
            size={36}
          />
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setItemPreview({ sku: line.sku, description: line.description, unitPrice: line.unitPrice, uom: line.uom })}
              className="text-[12px] text-slate-900 hover:text-primary hover:underline decoration-primary/60 underline-offset-2 transition-colors cursor-pointer"
              style={{ fontWeight: 700 }}
            >
              {highlightText(line.sku, searchQuery)}
            </button>
            {kind === 'Advance Invoice' && treatmentOf(invoice) === 'Revenue' && line.soLineId && (
              <span className="ml-1.5 align-middle">
                <LockedUnitsChip
                  sku={line.sku}
                  uom={line.uom}
                  info={lockedUnitsFor(line, line.soNumber ? findSalesOrder(line.soNumber)?.so.lines.find((x) => x.id === line.soLineId) : undefined)}
                />
              </span>
            )}
            <ItemDescriptionWithToggle shortText={line.description} longText="" searchQuery={searchQuery} />
          </div>
        </div>
      ) : (
        <span className="text-[12px] text-slate-900 break-words py-1" style={{ fontWeight: 700 }}>{highlightText(line.description, searchQuery)}</span>
      ),
  };

  const priceColumn = (label: string): ColumnDef<CustomerInvoiceLine> => ({
    key: 'unitPrice', label, minWidth: 100, defaultWidth: 120, sortable: true,
    getValue: (l) => l.unitPrice,
    render: (line) => (
      <div>
        <div className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>{fmtMoney(line.unitPrice)}</div>
        {line.originalUnitPrice !== undefined && Math.abs(line.originalUnitPrice - line.unitPrice) > 0.004 ? (
          <div className="text-[10px] text-amber-700 mt-0.5" style={{ fontWeight: 500 }}>Order price {fmtMoney(line.originalUnitPrice)}</div>
        ) : (
          line.uom && <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>per {line.uom}</div>
        )}
      </div>
    ),
  });

  const accountColumn = (label: string): ColumnDef<CustomerInvoiceLine> => ({
    key: 'glAccount', label, minWidth: 160, defaultWidth: 200, align: 'left', sortable: true,
    getValue: (l) => l.glAccount,
    render: (line, { searchQuery }) => accountCell(line.glAccount, searchQuery),
  });

  let columns: ColumnDef<CustomerInvoiceLine>[];
  if (kind === 'Shipment Invoice') {
    columns = [
      itemColumn,
      {
        key: 'shipment', label: 'Shipment', minWidth: 110, defaultWidth: 120, align: 'left', sortable: true,
        getValue: (l) => l.shipmentNumber ?? '',
        render: (l, { searchQuery }) => <span className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>{highlightText(l.shipmentNumber ?? '', searchQuery)}</span>,
      },
      {
        key: 'so', label: 'SO', minWidth: 90, defaultWidth: 100, align: 'left', sortable: true,
        getValue: (l) => l.soNumber ?? '',
        render: (l, { searchQuery }) => <span className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>{highlightText(l.soNumber ?? '', searchQuery)}</span>,
      },
      { key: 'shipped', label: 'Shipped', minWidth: 100, defaultWidth: 110, sortable: true, getValue: (l) => l.shippedQty ?? 0, render: (l) => qtyCell(l.shippedQty, l.uom) },
      {
        key: 'invoiceQty', label: 'Invoiced', minWidth: 110, defaultWidth: 120, sortable: true,
        tooltip: 'The shipped units this invoice bills.',
        getValue: (l) => l.invoiceQty, render: (l) => qtyCell(l.invoiceQty, l.uom),
      },
      priceColumn('Price per Unit'),
      {
        key: 'total', label: 'Total', minWidth: 120, defaultWidth: 150, sortable: true,
        getValue: (l) => l.total,
        render: (l) => (
          <div>
            <div className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>{fmtMoney(l.total)}</div>
            {(l.advanceCovered ?? 0) > 0.004 && (
              <div className="text-[10px] text-violet-700 mt-0.5" style={{ fontWeight: 500 }}>
                {fmtMoney(l.advanceCovered!)} on advance
              </div>
            )}
          </div>
        ),
      },
      accountColumn('Revenue Account'),
    ];
  } else if (kind === 'Advance Invoice') {
    columns = [
      itemColumn,
      { key: 'ordered', label: 'Ordered', minWidth: 90, defaultWidth: 100, sortable: true, getValue: (l) => l.orderedQty, render: (l) => qtyCell(l.orderedQty, l.uom) },
      { key: 'shipped', label: 'Shipped', minWidth: 90, defaultWidth: 100, sortable: true, getValue: (l) => l.shippedQty ?? 0, render: (l) => qtyCell(l.shippedQty ?? 0, l.uom) },
      {
        key: 'advancePercent', label: 'Advance %', minWidth: 90, defaultWidth: 100, sortable: true,
        getValue: (l) => l.advancePercent ?? 0,
        render: (l) => <span className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>{l.advancePercent !== undefined ? `${l.advancePercent}%` : '·'}</span>,
      },
      {
        key: 'total', label: 'Advance Amount', minWidth: 130, defaultWidth: 150, sortable: true,
        getValue: (l) => l.total,
        render: (l) => (
          <div>
            <div className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>{fmtMoney(l.total)}</div>
            <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>of {fmtMoney(l.orderedQty * l.unitPrice)}</div>
          </div>
        ),
      },
    ];
  } else if (kind === 'Standalone') {
    columns = [
      itemColumn,
      { key: 'invoiceQty', label: 'Qty', minWidth: 80, defaultWidth: 90, sortable: true, getValue: (l) => l.invoiceQty, render: (l) => qtyCell(l.invoiceQty, l.uom) },
      priceColumn('Rate'),
      {
        key: 'total', label: 'Line Total', minWidth: 120, defaultWidth: 140, sortable: true,
        getValue: (l) => l.total,
        render: (l) => <span className="text-foreground text-[13px]" style={{ fontWeight: 500 }}>{fmtMoney(l.total)}</span>,
      },
      accountColumn('Revenue Account'),
    ];
  } else {
    const sourceLabel = (l: CustomerInvoiceLine) => {
      const src = parent?.lines.find((p) => p.id === l.creditOfLineId);
      if (!src) return l.creditOfLineId ? `Line ${l.creditOfLineId.replace(/^L/, '')}` : '·';
      return `Line ${src.id.replace(/^L/, '')} · ${src.invoiceQty} ${src.uom} invoiced`;
    };
    columns = [
      itemColumn,
      {
        key: 'source', label: 'Source Line', minWidth: 150, defaultWidth: 180, align: 'left',
        getValue: (l) => sourceLabel(l),
        render: (l) => (
          <div>
            <div className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>{sourceLabel(l)}</div>
            {parent && <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>on {parent.invoiceNumber}</div>}
          </div>
        ),
      },
      { key: 'invoiceQty', label: 'Credited Qty', minWidth: 100, defaultWidth: 110, sortable: true, getValue: (l) => l.invoiceQty, render: (l) => qtyCell(l.invoiceQty, l.uom) },
      priceColumn('Price per Unit'),
      {
        key: 'total', label: 'Credit Amount', minWidth: 120, defaultWidth: 140, sortable: true,
        getValue: (l) => l.total,
        render: (l) => <span className="text-[13px]" style={{ fontWeight: 500, color: palette.red[600] }}>{fmtMoney(-Math.abs(l.total))}</span>,
      },
      accountColumn('Account'),
    ];
  }
  const catalog = columns.map((c) => ({ key: c.key, label: c.label }));

  const credit = kind === 'Credit Memo';

  return (
    <>
      {lines.length > 0 && (
        <LineItemsTable<CustomerInvoiceLine>
          rows={lines}
          columns={columns}
          catalog={catalog}
          lockedKeys={['item']}
          storageKey={`omnesoft:customer-invoice-lines-${kind.replace(/\s+/g, '-').toLowerCase()}`}
          getRowId={(l) => l.id}
          rowHeight={62}
          title={credit ? 'Credited Lines' : 'Line Items'}
          countNoun="items"
          searchAccessor={(l) => `${l.sku} ${l.description} ${l.glAccount} ${l.shipmentNumber ?? ''} ${l.soNumber ?? ''}`}
          searchPlaceholder="Search items…"
          defaultHiddenKeys={kind === 'Shipment Invoice' ? ['shipment', 'so', 'glAccount'] : ['glAccount']}
        />
      )}
      {kind === 'Advance Invoice' && (invoice.settlements?.length ?? 0) > 0 && <SettledAtShipmentCard invoice={invoice} />}
      <ItemQuickViewModal
        open={!!itemPreview}
        onClose={() => setItemPreview(null)}
        sku={itemPreview?.sku || ''}
        vendorName={invoice.customer}
        description={itemPreview?.description}
        unitPrice={itemPreview?.unitPrice}
        uom={itemPreview?.uom}
        serialized={false}
      />
    </>
  );
}

/* The vendor LinkedRecordsTab recipe (user 10/1 parity): toolbar card
   with search + type pills, then one collapsible table card per record
   type. Groups: the sales orders and shipments billed, the quote, the
   related invoice, the order's OTHER advance invoices and the balance
   invoices that bill what shipped (BR-009), deposits, and the credit
   memos issued against this invoice. Customer invoices open in a new
   tab at /customer-invoices/<number>. */

type ARLinkedType =
  | 'Sales Order'
  | 'Shipment'
  | 'Quote'
  | 'Related Invoice'
  | 'Advance Invoice'
  | 'Balance Invoice'
  | 'Deposit'
  | 'Credit Memo';

interface ARLinkedRecord {
  id: string;
  type: ARLinkedType;
  reference: string;
  description: string;
  status: string;
  date: string;
  amount: number;
  updatedBy: string;
  createdBy: string;
  open?: () => void;
  openLabel: string;
}

const AR_GROUP_META: Record<ARLinkedType, {
  icon: React.ElementType;
  plural: string;
  chipBg: string;
  chipText: string;
  chipBorder: string;
}> = {
  'Sales Order': { icon: ShoppingCart, plural: 'Sales Orders', chipBg: '#EFF6FF', chipText: '#1D4ED8', chipBorder: '#BFDBFE' },
  Shipment: { icon: Truck, plural: 'Shipments', chipBg: '#F0FDFA', chipText: '#0F766E', chipBorder: '#99F6E4' },
  Quote: { icon: FileSignature, plural: 'Quotes', chipBg: '#FFFBEB', chipText: '#B45309', chipBorder: '#FDE68A' },
  'Related Invoice': { icon: ArrowRightLeft, plural: 'Related Invoices', chipBg: '#F5F3FF', chipText: '#6D28D9', chipBorder: '#DDD6FE' },
  'Advance Invoice': { icon: Wallet, plural: 'Advance Invoices on the Order', chipBg: '#F5F3FF', chipText: '#6D28D9', chipBorder: '#C4B5FD' },
  'Balance Invoice': { icon: Truck, plural: 'Balance Invoices', chipBg: '#F0FDF4', chipText: '#15803D', chipBorder: '#BBF7D0' },
  Deposit: { icon: Wallet, plural: 'Deposits', chipBg: '#ECFDF5', chipText: '#047857', chipBorder: '#A7F3D0' },
  'Credit Memo': { icon: Receipt, plural: 'Credit Memos', chipBg: '#FFF1F2', chipText: '#BE123C', chipBorder: '#FECDD3' },
};

const AR_GROUP_ORDER: ARLinkedType[] = [
  'Sales Order', 'Shipment', 'Quote', 'Related Invoice', 'Advance Invoice', 'Balance Invoice', 'Deposit', 'Credit Memo',
];

const AR_LINKED_STATUS: Record<string, { bg: string; text: string; border: string }> = {
  // Shipment billing states
  'Not Invoiced': { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' },
  'Partially Invoiced': { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  'Fully Invoiced': { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  // Order / shipment / quote lifecycle
  Confirmed: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  'Partially Shipped': { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  Shipped: { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' },
  'Ready to Ship': { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' },
  Reversed: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  Sent: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  Expired: { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' },
  // Customer invoice statuses (PRD §14)
  Draft: { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' },
  'Pending Approval': { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
  Approved: { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
  Rejected: { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' },
  Cancelled: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  Archived: { bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5' },
  // Money
  Applied: { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  Held: { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' },
  // FAD 11/2
  Settled: { bg: '#F0FDFA', text: '#0F766E', border: '#99F6E4' },
  Revised: { bg: '#F1F5F9', text: '#64748B', border: '#CBD5E1' },
  Refunded: { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' },
};
const AR_LINKED_STATUS_FALLBACK = { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };

function CustomerLinkedRecordsTab({
  invoice,
  allInvoices,
  deposits,
  customers,
}: {
  invoice: CustomerInvoice;
  allInvoices: CustomerInvoice[];
  deposits: CustomerDeposit[];
  customers: Customer[];
}) {
  const [activeChip, setActiveChip] = useState<'all' | ARLinkedType>('all');
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleGroup = (key: string) => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  // ── Flatten every linked thing into the vendor record shape. ──
  const records = useMemo<ARLinkedRecord[]>(() => {
    const rows: ARLinkedRecord[] = [];
    const seen = new Set<string>();
    const invRow = (target: CustomerInvoice, type: ARLinkedType, description: string): ARLinkedRecord => ({
      id: `${type}-${target.id}`,
      type,
      reference: target.invoiceNumber,
      description,
      status: invoiceStatusLabelOf(target),
      date: target.invoiceDate,
      amount: Math.abs(target.amount),
      updatedBy: target.updatedBy ?? target.createdBy,
      createdBy: target.createdBy,
      open: () => openInvoiceTab(target.invoiceNumber),
      openLabel: target.docKind === 'Credit Memo' ? 'View Credit Memo' : target.docKind === 'Advance Invoice' ? 'View Advance Invoice' : 'View Invoice',
    });
    const pushInv = (target: CustomerInvoice | undefined, type: ARLinkedType, description: string) => {
      if (!target || target.id === invoice.id || seen.has(target.id)) return;
      seen.add(target.id);
      rows.push(invRow(target, type, description));
    };

    const sos = invoice.linkedSOs.map((n) => findSalesOrder(n, customers)).filter((x): x is NonNullable<typeof x> => !!x);
    for (const soNum of invoice.linkedSOs) {
      const hit = sos.find((x) => x.so.soNumber === soNum);
      const ob = hit ? orderBilling(hit.so, hit.customer, allInvoices) : undefined;
      rows.push({
        id: `so-${soNum}`,
        type: 'Sales Order',
        reference: `SO ${soNum}`,
        description: ob
          ? `Invoiced ${fmtMoney(ob.invoicedApproved)} of ${fmtMoney(ob.orderTotal)}${hit?.so.customerPONumber ? ` · Customer PO ${hit.so.customerPONumber}` : ''}`
          : 'Sales order this document bills against',
        status: hit?.so.status ?? 'Confirmed',
        date: hit?.so.soDate ?? invoice.invoiceDate,
        amount: hit?.so.totalValue ?? 0,
        updatedBy: invoice.updatedBy ?? invoice.createdBy,
        createdBy: invoice.createdBy,
        open: () => window.open('https://pleasant-flow.lovable.app/sales-orders/so-10', '_blank', 'noopener,noreferrer'),
        openLabel: 'View Sales Order',
      });
    }

    const billingMap = billingByShipmentLine(allInvoices);
    const protects = invoice.docKind === 'Shipment Invoice' && invoice.invoiceStatus === 'Approved';
    const settledShipments = new Set<string>();
    // FAD 11/2: shipments a Deposit pre-invoice settled on itself.
    for (const st of invoice.settlements ?? []) {
      settledShipments.add(st.shipmentNumber);
      const hit = findShipment(st.shipmentNumber, customers);
      rows.push({
        id: `shp-settle-${st.shipmentNumber}`,
        type: 'Shipment',
        reference: st.shipmentNumber,
        description: `${st.units} ${st.units === 1 ? 'unit' : 'units'} shipped ${formatUsDate(st.date)}. Deposit applied and revenue recognised on this invoice`,
        status: 'Settled',
        date: st.date,
        amount: st.amount,
        updatedBy: invoice.updatedBy ?? invoice.createdBy,
        createdBy: invoice.createdBy,
        open: hit ? undefined : () => toast.info(`${st.shipmentNumber} opens in Shipments`, { description: 'The shipment record lives in the Shipping module.' }),
        openLabel: 'View Shipment',
      });
    }
    for (const shpNum of invoice.linkedShipments) {
      if (settledShipments.has(shpNum)) continue;
      const hit = findShipment(shpNum, customers);
      rows.push({
        id: `shp-${shpNum}`,
        type: 'Shipment',
        reference: shpNum,
        // BR-023: an approved invoice protects the units it bills.
        description: hit
          ? `Shipped ${formatUsDate(hit.shipment.shipDate)} against SO ${hit.shipment.soNumber}${protects ? '. Cannot be reversed while this invoice bills it' : ''}`
          : 'Shipment this document bills',
        status: hit ? (hit.shipment.status === 'Shipped' ? shipmentBillingStatus(hit.shipment, billingMap) : hit.shipment.status) : 'Shipped',
        date: hit?.shipment.shipDate ?? invoice.invoiceDate,
        amount: hit?.shipment.totalValue ?? 0,
        updatedBy: invoice.updatedBy ?? invoice.createdBy,
        createdBy: invoice.createdBy,
        openLabel: 'View Shipment',
      });
    }

    const quoteNumbers = new Set<string>();
    if (invoice.quoteNumber) quoteNumbers.add(invoice.quoteNumber);
    sos.forEach((x) => x.so.quoteNumber && quoteNumbers.add(x.so.quoteNumber));
    for (const qn of quoteNumbers) {
      const hit = findQuote(qn, customers);
      rows.push({
        id: `qt-${qn}`,
        type: 'Quote',
        reference: qn,
        description: hit?.quote.convertedToSO ? `Became SO ${hit.quote.convertedToSO}` : 'Quote this advance bills',
        status: hit?.quote.status ?? 'Confirmed',
        date: hit?.quote.quoteDate ?? invoice.invoiceDate,
        amount: hit?.quote.totalValue ?? 0,
        updatedBy: invoice.updatedBy ?? invoice.createdBy,
        createdBy: invoice.createdBy,
        openLabel: 'View Quote',
      });
    }

    // Related invoice: the invoice a credit memo credits, or the earlier
    // invoice a standalone bills more on, plus the reverse direction.
    if (invoice.relatedInvoiceNumber) {
      const target = allInvoices.find((i) => i.invoiceNumber === invoice.relatedInvoiceNumber);
      if (target) {
        pushInv(target, 'Related Invoice', isCreditMemo(invoice) ? 'The invoice this credit memo credits' : 'Earlier invoice this one relates to');
      } else {
        rows.push({
          id: `rel-${invoice.relatedInvoiceNumber}`, type: 'Related Invoice', reference: invoice.relatedInvoiceNumber,
          description: 'Related invoice', status: 'Approved', date: invoice.invoiceDate, amount: 0,
          updatedBy: invoice.createdBy, createdBy: invoice.createdBy, openLabel: 'View Invoice',
          open: () => openInvoiceTab(invoice.relatedInvoiceNumber!),
        });
      }
    }
    allInvoices
      .filter((i) => i.docKind !== 'Credit Memo' && i.relatedInvoiceNumber === invoice.invoiceNumber)
      .forEach((i) => pushInv(i, 'Related Invoice', 'Bills more against this invoice'));
    // Revise (FAD 11/2): both directions of the version chain.
    if (invoice.revisedFromId) pushInv(allInvoices.find((i) => i.id === invoice.revisedFromId), 'Related Invoice', 'Earlier version, replaced by this revision');
    if (invoice.supersededById) pushInv(allInvoices.find((i) => i.id === invoice.supersededById), 'Related Invoice', 'Newer version that replaced this one');

    // BR-009: the order's advance invoices and its balance invoices.
    if (!isCreditMemo(invoice)) {
      const advances = new Map<string, CustomerInvoice>();
      sos.forEach((x) => advanceInvoicesFor(x.so, allInvoices).forEach((a) => advances.set(a.id, a)));
      if (invoice.quoteNumber) {
        const q = findQuote(invoice.quoteNumber, customers);
        if (q) advanceInvoicesForQuote(q.quote, allInvoices).forEach((a) => advances.set(a.id, a));
      }
      (invoice.advanceReferences ?? []).forEach((ref) => {
        const a = allInvoices.find((i) => i.invoiceNumber === ref.invoiceNumber);
        if (a) advances.set(a.id, a);
      });
      for (const a of advances.values()) {
        const ref = invoice.advanceReferences?.find((r) => r.invoiceNumber === a.invoiceNumber);
        pushInv(
          a,
          'Advance Invoice',
          ref
            ? `Already billed ${fmtMoney(ref.amount)} of this invoice's value`
            : `${a.advanceStage?.label ?? 'Advance'} billed before shipping`,
        );
      }
      if (invoice.docKind === 'Advance Invoice') {
        allInvoices
          .filter(
            (i) =>
              i.docKind === 'Shipment Invoice' &&
              HOLDING_STATUSES.includes(i.invoiceStatus) &&
              (i.advanceReferences?.some((r) => r.invoiceNumber === invoice.invoiceNumber) ||
                i.linkedSOs.some((so) => invoice.linkedSOs.includes(so))),
          )
          .forEach((i) => pushInv(i, 'Balance Invoice', 'Bills the shipped balance of the order'));
      }
    }

    for (const app of invoice.depositApplications) {
      const dep = deposits.find((d) => d.id === app.depositId);
      rows.push({
        id: `dep-${app.depositId}`,
        type: 'Deposit',
        reference: dep?.depositNumber ?? app.depositId,
        description: dep?.preInvoiceNumber ? `Received against ${dep.preInvoiceNumber}` : 'Customer deposit applied to this invoice',
        status: 'Applied',
        date: app.appliedOn,
        amount: app.amount,
        updatedBy: invoice.updatedBy ?? invoice.createdBy,
        createdBy: invoice.createdBy,
        openLabel: 'View Deposit',
      });
    }
    if (invoice.docKind === 'Advance Invoice') {
      deposits
        .filter((d) => d.preInvoiceNumber === invoice.invoiceNumber)
        .forEach((d) =>
          rows.push({
            id: `dep-recv-${d.id}`,
            type: 'Deposit',
            reference: d.depositNumber,
            description: `${d.method} ${d.reference}`.trim() || 'Deposit received against this advance',
            status: d.refunded ? 'Refunded' : d.applications.length > 0 ? 'Applied' : 'Held',
            date: d.receivedDate,
            amount: d.amount,
            updatedBy: invoice.updatedBy ?? invoice.createdBy,
            createdBy: invoice.createdBy,
            openLabel: 'View Deposit',
          }),
        );
    }

    if (!isCreditMemo(invoice)) {
      creditMemosFor(invoice.invoiceNumber, allInvoices).forEach((crn) =>
        pushInv(crn, 'Credit Memo', crn.creditReason ? `${crn.creditReason}${crn.rmaNumber ? ` · ${crn.rmaNumber}` : ''}` : 'Credit issued against this invoice'),
      );
    }
    return rows;
  }, [invoice, allInvoices, deposits, customers]);

  // ── Search narrows the full record set before grouping. ──
  const filteredRecords = useMemo(() => {
    if (!query.trim()) return records;
    const q = query.trim().toLowerCase();
    return records.filter(
      (r) =>
        r.reference.toLowerCase().includes(q)
        || r.description.toLowerCase().includes(q)
        || r.status.toLowerCase().includes(q)
        || r.createdBy.toLowerCase().includes(q)
        || r.type.toLowerCase().includes(q)
        || r.amount.toFixed(2).includes(q)
        || String(Math.round(r.amount)).includes(q),
    );
  }, [records, query]);

  const groups = useMemo(() => {
    return AR_GROUP_ORDER.map((type) => {
      const items = filteredRecords
        .filter((r) => r.type === type)
        .sort((a, b) => b.date.localeCompare(a.date));
      const total = items.reduce((s, r) => s + r.amount, 0);
      return { type, items, total };
    }).filter((g) => g.items.length > 0);
  }, [filteredRecords]);

  const counts = Object.fromEntries([
    ['all', records.length],
    ...AR_GROUP_ORDER.map((t) => [t, records.filter((r) => r.type === t).length]),
  ]) as Record<'all' | ARLinkedType, number>;

  // Only the record types this document actually has get a pill.
  const chips: Array<{ key: 'all' | ARLinkedType; label: string }> = [
    { key: 'all', label: 'All' },
    ...AR_GROUP_ORDER.filter((t) => counts[t] > 0).map((t) => ({ key: t, label: AR_GROUP_META[t].plural })),
  ];

  const visibleGroups = activeChip === 'all' ? groups : groups.filter((g) => g.type === activeChip);
  const resultCount = visibleGroups.reduce((s, g) => s + g.items.length, 0);

  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-white py-6">
        <EmptyState
          icon={Link2}
          title="No linked records yet"
          description="Sales orders, shipments, quotes, related invoices, deposits and credit memos linked to this document appear here."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" role="region" aria-label="Linked Records">
      {/* ── Toolbar card — search + type pills (vendor recipe). ── */}
      <div className="border border-border rounded-xl bg-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
              <input
                placeholder="Search type, ref, status, creator…"
                className="w-full pl-9 pr-8 h-9 text-sm rounded-lg border bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 transition-shadow"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={() => toast.info('Advanced filters', { description: 'Date range, status, and amount filters coming soon.' })}
              className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 shrink-0 text-foreground border-border/80"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>Filters</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm hidden sm:inline" style={{ fontWeight: 500 }}>
              <span className="text-foreground">{resultCount}</span>
              <span className="text-muted-foreground/70"> record{resultCount !== 1 ? 's' : ''}</span>
            </span>
          </div>
        </div>

        {/* Type filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3">
          {chips.map((chip) => {
            const isActive = activeChip === chip.key;
            return (
              <button
                key={chip.key}
                onClick={() => setActiveChip(chip.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'border-primary bg-accent'
                    : 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30'
                }`}
                style={isActive ? { color: 'hsl(var(--primary))', fontWeight: 500 } : { fontWeight: 400 }}
              >
                {chip.label}
                <span
                  className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${isActive ? 'bg-primary/10' : 'bg-muted'}`}
                  style={{ color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))', fontWeight: 600 }}
                >
                  {counts[chip.key]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Section cards — one collapsible table card per record type. ── */}
      {visibleGroups.length === 0 ? (
        /* Table Empty States Standard (11/3/26): search, type pill, or both. */
        <div className="rounded-xl border border-dashed border-slate-200 bg-white">
          <TableEmptyState
            compact
            kind={resolveTableEmptyKind({ totalCount: records.length, filteredCount: 0, searchQuery: query, filterCount: activeChip === 'all' ? 0 : 1 }) ?? 'no-data'}
            entity={{ singular: 'linked record', plural: 'linked records' }}
            searchQuery={query}
            filterCount={activeChip === 'all' ? 0 : 1}
            suggestion={findSearchSuggestion(query, records.flatMap((r) => [r.reference, r.description, r.createdBy]))}
            onApplySuggestion={setQuery}
            onClearSearch={() => setQuery('')}
            onClearFilters={() => setActiveChip('all')}
            onClearAll={() => { setQuery(''); setActiveChip('all'); }}
          />
        </div>
      ) : (
        visibleGroups.map(({ type, items, total }) => {
          const meta = AR_GROUP_META[type];
          const Icon = meta.icon;
          const open = collapsed[type] !== true;
          return (
            <div
              key={type}
              className="border border-border rounded-xl bg-card overflow-hidden"
              style={{ boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}
            >
              <button
                type="button"
                onClick={() => toggleGroup(type)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 bg-[#fafbfc] hover:bg-[#f4f6f9] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
                style={{ borderBottom: open ? '1px solid #EEF2F6' : 'none' }}
                aria-expanded={open}
                aria-controls={`ar-linked-${type}`}
              >
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border"
                  style={{ backgroundColor: meta.chipBg, color: meta.chipText, borderColor: meta.chipBorder }}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </div>
                <span className="text-foreground text-left text-[13px]" style={{ fontWeight: 600 }}>
                  {/* Record type is searchable, so the section title marks the hit (10/9/26). */}
                  {query.trim() && type.toLowerCase().includes(query.trim().toLowerCase()) ? highlightText(meta.plural, query) : meta.plural}
                </span>
                <span
                  className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[11px]"
                  style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--primary))', fontWeight: 600 }}
                >
                  {items.length}
                </span>
                {total > 0 && (
                  <span className="ml-auto text-foreground text-[13px]" style={{ fontWeight: 600 }}>
                    {fmtMoney(total)}
                  </span>
                )}
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground/60 shrink-0 transition-transform duration-300 ${total > 0 ? 'ml-2.5' : 'ml-auto'}`}
                  style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                  aria-hidden="true"
                />
              </button>

              <CollapseReveal open={open}>
                <div className="overflow-x-auto" id={`ar-linked-${type}`}>
                  <table className="w-full table-fixed text-[12px]">
                    <thead>
                      <tr className="border-b border-border bg-white">
                        {[
                          { col: 'Reference', width: '15%', align: 'text-left', hide: '' },
                          { col: 'Description', width: '23%', align: 'text-left', hide: 'hidden sm:table-cell' },
                          { col: 'Status', width: '12%', align: 'text-left', hide: '' },
                          { col: 'Date', width: '12%', align: 'text-left', hide: 'hidden md:table-cell' },
                          { col: 'Amount', width: '12%', align: 'text-right', hide: '' },
                          { col: 'Last Updated By', width: '13%', align: 'text-left', hide: 'hidden lg:table-cell' },
                          { col: 'Created By', width: '13%', align: 'text-left', hide: 'hidden lg:table-cell' },
                        ].map((c) => (
                          <th
                            key={c.col}
                            scope="col"
                            className={`py-2 px-4 text-[11px] text-muted-foreground/60 whitespace-nowrap ${c.align} ${c.hide}`}
                            style={{ width: c.width, fontWeight: 600 }}
                          >
                            {c.col}
                          </th>
                        ))}
                        <th className="w-[4%]"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((r) => {
                        const s = AR_LINKED_STATUS[r.status] ?? AR_LINKED_STATUS_FALLBACK;
                        return (
                          <tr
                            key={r.id}
                            onClick={() => r.open?.()}
                            className={`border-b border-border/70 last:border-b-0 hover:bg-muted/30 transition-colors group ${r.open ? 'cursor-pointer' : ''}`}
                          >
                            <td className="py-2.5 px-4">
                              {r.open ? (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); r.open?.(); }}
                                  className="max-w-full text-foreground hover:text-primary hover:underline underline-offset-2 text-[12px] truncate block text-left transition-colors cursor-pointer"
                                  style={{ fontWeight: 600 }}
                                  aria-label={`Open ${r.reference}`}
                                >
                                  {highlightText(r.reference, query)}
                                </button>
                              ) : (
                                <span className="text-foreground text-[12px] truncate block max-w-full" style={{ fontWeight: 600 }}>
                                  {highlightText(r.reference, query)}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 hidden sm:table-cell">
                              <span className="text-muted-foreground truncate block" title={r.description}>
                                {highlightText(r.description, query)}
                              </span>
                            </td>
                            <td className="py-2.5 px-4">
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border whitespace-nowrap"
                                style={{ fontWeight: 500, backgroundColor: s.bg, color: s.text, borderColor: s.border }}
                              >
                                {r.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap hidden md:table-cell">
                              {formatUsDateTime(r.date)}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              {r.amount > 0 ? (
                                <span className="text-foreground" style={{ fontWeight: 600 }}>
                                  {amountMatches(r.amount, query) ? highlightAmount(fmtMoney(r.amount), query) : fmtMoney(r.amount)}
                                </span>
                              ) : null}
                            </td>
                            <td className="py-2.5 px-4 hidden lg:table-cell">
                              <CreatedByCell name={r.updatedBy} vendor={invoice.customer} density="condensed" />
                            </td>
                            <td className="py-2.5 px-4 hidden lg:table-cell">
                              <CreatedByCell name={r.createdBy} vendor={invoice.customer} density="condensed" />
                            </td>
                            <td className="py-2.5 px-2">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground/60 hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer opacity-40 group-hover:opacity-100 focus-visible:opacity-100"
                                    aria-label="Row actions"
                                  >
                                    <MoreHorizontal className="w-4 h-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[180px]" onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenuItem onClick={() => r.open ? r.open() : toast.info(`${r.type} details`, { description: `${r.type} page coming soon.` })}>
                                    <Eye className="w-4 h-4 mr-2 text-muted-foreground" />
                                    {r.openLabel}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => toast.success('Download started', { description: `Downloading ${r.reference} as PDF...` })}
                                  >
                                    <Download className="w-4 h-4 mr-2 text-muted-foreground" />
                                    Download
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CollapseReveal>
            </div>
          );
        })
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Tab: GL Impact (PRD §11.3). The vendor Dr/Cr table recipe.
//   Shipment / Standalone · Dr A/R, Cr each line's revenue account
//     (grouped), Cr freight income, Cr each charge account. A shipment
//     line an advance already billed carries its FULL revenue, with the
//     covered share debited to Customer Deposits (BR-009).
//   Advance · nothing posts on approval (D2).
//   Credit memo · Dr the credited revenue accounts (4900 Sales Returns
//     and Allowances for returns), Dr freight / charge accounts, Cr A/R.
//     A credit memo on an advance invoice has no accounting entry.
// Draft, Pending Approval and Rejected show the entry as a preview:
// nothing posts until approved.
// ══════════════════════════════════════════════════════════════════

interface JournalLine {
  id: string;
  account: string;
  description?: string;
  debit?: number;
  credit?: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

interface GlEntry {
  key: string;
  title: string;
  /** Posting date (or the date the entry previews). */
  date?: string;
  helper: string;
  lines: JournalLine[];
}

type GlPlan =
  | { kind: 'advance' }
  | { kind: 'creditOnAdvance' }
  | { kind: 'entries'; entries: GlEntry[] };

/** The entry the document itself posts (or previews) at approval. FAD
 *  11/2: a Revenue pre-invoice posts Dr A/R, Cr revenue; a Deposit
 *  pre-invoice posts nothing at approval. */
function postedLinesOf(invoice: CustomerInvoice, allInvoices: CustomerInvoice[], customers: Customer[]): JournalLine[] {
  const byAccount = new Map<string, number>();
  const add = (acct: string, amt: number) => byAccount.set(acct, r2((byAccount.get(acct) ?? 0) + amt));
  const lines: JournalLine[] = [];

  if (invoice.docKind === 'Advance Invoice') {
    if (treatmentOf(invoice) !== 'Revenue') return [];
    invoice.lines.forEach((l) => add(l.glAccount || DEFAULT_REVENUE_ACCOUNT, l.total));
    lines.push({ id: 'dr-ar', account: invoice.arAccount, description: 'Advance billed, booked as revenue', debit: invoice.amount });
    for (const [acct, amt] of byAccount) {
      if (amt > 0.004) lines.push({ id: `cr-${acct}`, account: acct, description: 'Revenue at invoice, units locked', credit: amt });
    }
    return lines;
  }

  const parent = invoice.relatedInvoiceNumber ? allInvoices.find((i) => i.invoiceNumber === invoice.relatedInvoiceNumber) : undefined;
  if (isCreditMemo(invoice) && parent?.docKind === 'Advance Invoice' && treatmentOf(parent) !== 'Revenue') return [];

  if (isCreditMemo(invoice)) {
    invoice.lines.forEach((l) => add(l.glAccount || DEFAULT_REVENUE_ACCOUNT, Math.abs(l.total)));
    for (const [acct, amt] of byAccount) {
      if (amt > 0.004) lines.push({ id: `dr-${acct}`, account: acct, description: 'Revenue credited', debit: amt });
    }
    const freight = Math.abs(invoice.freightAmount ?? 0);
    if (freight > 0.004) lines.push({ id: 'dr-frt', account: invoice.freightAccount || FREIGHT_INCOME_ACCOUNT, description: 'Freight credited', debit: freight });
    invoice.charges.forEach((c) => {
      if (Math.abs(c.amount) > 0.004) lines.push({ id: `dr-ch-${c.id}`, account: c.account, description: `${c.type} credited`, debit: Math.abs(c.amount) });
    });
    lines.push({ id: 'cr-ar', account: invoice.arAccount, description: 'Amount the customer owes reduced', credit: Math.abs(invoice.amount) });
    return lines;
  }

  let covered = 0;
  invoice.lines.forEach((l) => {
    add(l.glAccount || DEFAULT_REVENUE_ACCOUNT, l.grossTotal ?? l.total);
    covered += l.advanceCovered ?? 0;
  });
  covered = r2(covered);
  lines.push({ id: 'dr-ar', account: invoice.arAccount, description: 'Invoice total receivable', debit: invoice.amount });
  if (covered > 0.004) {
    const depositAccount = customerByName(invoice.customer, customers)?.depositAccount || CUSTOMER_DEPOSITS_ACCOUNT;
    const refs = (invoice.advanceReferences ?? []).map((r) => r.invoiceNumber).join(', ');
    lines.push({ id: 'dr-dep', account: depositAccount, description: refs ? `Billed on ${refs}` : 'Billed on the advance', debit: covered });
  }
  for (const [acct, amt] of byAccount) {
    if (amt > 0.004) lines.push({ id: `cr-${acct}`, account: acct, description: invoice.docKind === 'Standalone' ? 'Line revenue' : 'Product revenue', credit: amt });
  }
  const freight = invoice.freightAmount ?? 0;
  if (freight > 0.004) lines.push({ id: 'cr-frt', account: invoice.freightAccount || FREIGHT_INCOME_ACCOUNT, description: invoice.carrier ? `Freight · ${invoice.carrier}` : 'Freight billed', credit: freight });
  invoice.charges.forEach((c) => {
    if (c.amount > 0.004) lines.push({ id: `cr-ch-${c.id}`, account: c.account, description: c.description || c.type, credit: c.amount });
  });
  return lines;
}

function buildGlPlan(invoice: CustomerInvoice, allInvoices: CustomerInvoice[], customers: Customer[]): GlPlan {
  const approved = invoice.invoiceStatus === 'Approved';
  const postingDate = invoice.postingDate ?? invoice.approvedAt?.split('T')[0] ?? invoice.invoiceDate;
  const entries: GlEntry[] = [];
  const main = postedLinesOf(invoice, allInvoices, customers);
  if (main.length > 0) {
    entries.push({
      key: 'main',
      title: invoice.docKind === 'Advance Invoice' ? 'Revenue at Invoice' : isCreditMemo(invoice) ? 'Credit Memo Posting' : 'Invoice Posting',
      date: approved ? postingDate : undefined,
      helper: approved ? `How this ${nounOf(invoice)} posted to the general ledger, account by account.` : `Preview: nothing posts until this ${nounOf(invoice)} is approved.`,
      lines: main,
    });
    // Mahreen 11/4: Revenue on invoice posts cost with the revenue.
    if (invoice.docKind === 'Advance Invoice' && treatmentOf(invoice) === 'Revenue') {
      const cost = r2(invoice.lines.reduce((a, l) => a + lineCostOf(l), 0));
      if (cost > 0.004) {
        entries.push({
          key: 'cost',
          title: 'Cost at Invoice',
          date: approved ? postingDate : undefined,
          helper: approved
            ? 'The locked units left available stock as a hard allocation, at standard cost.'
            : 'Preview: posts with the revenue when this advance invoice is approved.',
          lines: [
            { id: 'dr-cogs', account: COGS_ACCOUNT, description: 'Cost of the locked units', debit: cost },
            { id: 'cr-inv', account: INVENTORY_ACCOUNT, description: 'Units locked to this customer', credit: cost },
          ],
        });
      }
    }
  }

  // FAD 11/2 settlement at shipment: a Deposit pre-invoice moves the
  // deposit to revenue on the SAME invoice as each shipment goes out.
  if (invoice.docKind === 'Advance Invoice' && treatmentOf(invoice) === 'Deposit') {
    const depositAccount = invoice.depositAccount || CUSTOMER_DEPOSITS_ACCOUNT;
    const revenueAccount = invoice.lines.find((l) => l.glAccount)?.glAccount || DEFAULT_REVENUE_ACCOUNT;
    (invoice.settlements ?? []).forEach((st) => {
      entries.push({
        key: `settle-${st.shipmentNumber}`,
        title: `Settled at Shipment · ${st.shipmentNumber}`,
        date: st.date,
        helper: `${st.units} ${st.units === 1 ? 'unit' : 'units'} shipped. The deposit applies and revenue is recognised on this invoice.`,
        lines: [
          { id: `dr-dep-${st.shipmentNumber}`, account: depositAccount, description: 'Deposit applied', debit: st.amount },
          { id: `cr-rev-${st.shipmentNumber}`, account: revenueAccount, description: 'Revenue recognised', credit: st.amount },
        ],
      });
    });
  }

  // FAD 11/2 write-off: the amount moved to bad debt.
  if (invoice.writtenOff) {
    const amt = invoice.writeOffAmount ?? netDue(invoice);
    if (amt > 0.004) {
      const e = lastEntry(invoice.actionHistory, 'writeOff');
      entries.push({
        key: 'write-off',
        title: 'Write Off',
        date: e?.at.split('T')[0],
        helper: 'The uncollected balance moved to bad debt.',
        lines: [
          { id: 'dr-bad', account: BAD_DEBT_ACCOUNT, description: 'Balance written off', debit: amt },
          { id: 'cr-ar-wo', account: invoice.arAccount, description: 'Receivable cleared', credit: amt },
        ],
      });
    }
  }

  // FAD 11/2 refund or reverse of the prepayment.
  if (invoice.prepaymentReversal) {
    const pr = invoice.prepaymentReversal;
    refundGlEntries(invoice, pr.amount).forEach((e, i) => {
      entries.push({
        key: `refund-${i}`,
        title: e.title === 'Refund' ? 'Prepayment Refund' : e.title,
        date: pr.at.split('T')[0],
        helper: e.title === 'Refund' ? 'Money returned to the customer.' : e.title === 'Reverse Cost' ? 'Cost reversed and the units back in available stock.' : 'Revenue reversed and the units released back to stock.',
        lines: e.rows.map((r, j) => ({ id: `rf-${i}-${j}`, account: r.account, debit: r.debit || undefined, credit: r.credit || undefined })),
      });
    });
  }

  // FAD 11/2 revise: the replaced version's posting is reversed.
  if (invoice.supersededById && main.length > 0 && approved) {
    const e = lastEntry(invoice.actionHistory, 'revised');
    entries.push({
      key: 'revise-reversal',
      title: 'Reversal · Revised',
      date: e?.at.split('T')[0],
      helper: 'This version was replaced, so its posting is backed out of the ledger.',
      lines: [...main, ...(entries.find((e) => e.key === 'cost')?.lines ?? [])].map((l) => ({ ...l, id: `rev-${l.id}`, description: 'Reversed', debit: l.credit, credit: l.debit })),
    });
  }

  if (entries.length === 0) {
    if (invoice.docKind === 'Advance Invoice') return { kind: 'advance' };
    if (isCreditMemo(invoice)) return { kind: 'creditOnAdvance' };
  }
  return { kind: 'entries', entries };
}

/* Direction indicator (vendor GL tab recipe, 7/24/26): arrow only, green
   up / red down; the effect and the debit/credit rule live in the tooltip.
   Assets (1xxx) grow on a debit; liabilities, equity and revenue (2xxx+)
   grow on a credit, except contra revenue (49xx), which grows on a debit. */
function accountDirection(line: JournalLine): { up: boolean; effect: string; explain: string } {
  const code = splitGlAccount(line.account).code || '';
  const debitNormal = code.startsWith('1') || code.startsWith('5') || code.startsWith('6') || code.startsWith('49');
  const isDebit = (line.debit ?? 0) > 0;
  const up = debitNormal ? isDebit : !isDebit;
  const kind = code.startsWith('1') ? 'An asset' : code.startsWith('2') ? 'A liability' : code.startsWith('49') ? 'A contra revenue account' : code.startsWith('4') ? 'A revenue account' : 'An expense account';
  return {
    up,
    effect: up ? 'Increases' : 'Decreases',
    explain: `${kind} ${debitNormal ? 'grows with a debit and shrinks with a credit' : 'grows with a credit and shrinks with a debit'}.`,
  };
}

function JournalTable({ lines }: { lines: JournalLine[] }) {
  const totalDebits = r2(lines.reduce((s, l) => s + (l.debit || 0), 0));
  const totalCredits = r2(lines.reduce((s, l) => s + (l.credit || 0), 0));
  const balanced = Math.abs(totalDebits - totalCredits) < 0.005;
  const showDescriptions = lines.some((l) => l.description);
  const balancePill = (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-px rounded-full text-[10px] tracking-normal border"
      style={
        balanced
          ? { fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }
          : { fontWeight: 600, backgroundColor: '#FEF2F2', color: '#B91C1C', borderColor: '#FECACA' }
      }
    >
      {balanced ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
      {balanced ? 'Balanced · Debit = Credit' : 'Out of Balance'}
    </span>
  );
  return (
    <table className="w-full text-[12px]">
      <thead className="bg-slate-50/60 border-b border-slate-100">
        <tr>
          <th className="text-left pl-5 pr-4 py-2 text-[10px] text-slate-400" style={{ fontWeight: 700 }}>Account</th>
          {showDescriptions && (
            <th className="text-left px-4 py-2 text-[10px] text-slate-400" style={{ fontWeight: 700 }}>Description</th>
          )}
          <th className="text-right px-4 py-2 text-[10px] text-slate-400" style={{ fontWeight: 700 }}>Debit</th>
          <th className="text-right px-4 py-2 pr-5 text-[10px] text-slate-400" style={{ fontWeight: 700 }}>Credit</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line, idx) => {
          const { code, name } = splitGlAccount(line.account);
          const d = accountDirection(line);
          const Arrow = d.up ? ArrowUp : ArrowDown;
          return (
            <tr key={line.id} className={`${idx === lines.length - 1 ? '' : 'border-b border-slate-100'} hover:bg-[#F8FAFF] transition-colors`}>
              <td className="pl-5 pr-4 py-2.5">
                <span className="inline-flex items-center gap-2">
                  <span
                    className="inline-flex items-center px-1.5 py-px rounded-md text-[10px] bg-slate-100/80 text-slate-500 border border-slate-200/60"
                    style={{ fontWeight: 600 }}
                  >
                    {code || '·'}
                  </span>
                  <span className="text-foreground" style={{ fontWeight: 500 }}>
                    {name}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full border cursor-help"
                        aria-label={d.effect}
                        style={
                          d.up
                            ? { color: '#047857', backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }
                            : { color: '#E11D48', backgroundColor: '#FFF1F2', borderColor: '#FECDD3' }
                        }
                      >
                        <Arrow className="w-3 h-3" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[240px]">
                      <p className="text-[11px] leading-snug" style={{ fontWeight: 600, color: d.up ? '#047857' : '#E11D48' }}>{d.effect}</p>
                      <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{d.explain}</p>
                    </TooltipContent>
                  </Tooltip>
                </span>
              </td>
              {showDescriptions && <td className="px-4 py-2.5 text-slate-500">{line.description}</td>}
              <td className="px-4 py-2.5 text-right ">
                {line.debit ? (
                  <span className="text-foreground" style={{ fontWeight: 600 }}>{fmtMoney(line.debit)}</span>
                ) : null}
              </td>
              <td className="px-4 py-2.5 pr-5 text-right ">
                {line.credit ? (
                  <span className="text-foreground" style={{ fontWeight: 600 }}>{fmtMoney(line.credit)}</span>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
      {/* Totals row + inline balance check (Dr = Cr) */}
      <tfoot>
        <tr className="border-t border-slate-200/80" style={{ backgroundColor: balanced ? '#F7FDF9' : '#FEF2F2' }}>
          <td className="pl-5 pr-4 py-2.5 text-[10px] text-slate-400" style={{ fontWeight: 700 }}>
            <span className="inline-flex items-center gap-2.5">
              Totals
              {!showDescriptions && balancePill}
            </span>
          </td>
          {showDescriptions && <td className="px-4 py-2.5">{balancePill}</td>}
          <td className="px-4 py-2.5 text-right text-foreground text-[13px]" style={{ fontWeight: 700 }}>
            {fmtMoney(totalDebits)}
          </td>
          <td className="px-4 py-2.5 pr-5 text-right text-foreground text-[13px]" style={{ fontWeight: 700 }}>
            {fmtMoney(totalCredits)}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

function GlEmptyState({ pill, title, body }: { pill: string; title: string; body: string }) {
  return (
    <div className="border border-border rounded-xl bg-white overflow-hidden flex flex-col" style={{ minHeight: 'max(400px, calc(100vh - 269px))' }}>
      <div className="flex-1 flex flex-col items-center justify-center w-full py-12 px-6 text-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-primary/5 animate-ping" style={{ animationDuration: '3s' }} />
          <div
            className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-50 to-accent border border-border flex items-center justify-center shadow-sm"
            style={{ animation: 'glFloat 4s ease-in-out infinite' }}
          >
            <BookOpen className="w-7 h-7 text-slate-400" />
          </div>
        </div>
        <div className="inline-flex items-center px-3 py-1 rounded-full bg-muted border border-border mb-3">
          <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 600 }}>{pill}</span>
        </div>
        <h3 className="text-foreground text-[16px] mb-1.5" style={{ fontWeight: 600 }}>{title}</h3>
        <p className="text-slate-400 text-[13px] max-w-sm leading-relaxed">{body}</p>
      </div>
      <style>{`@keyframes glFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }`}</style>
    </div>
  );
}

function CustomerGLImpactTab({
  invoice,
  allInvoices,
  customers,
}: {
  invoice: CustomerInvoice;
  allInvoices: CustomerInvoice[];
  customers: Customer[];
}) {
  const plan = buildGlPlan(invoice, allInvoices, customers);

  if (plan.kind === 'advance') {
    return (
      <GlEmptyState
        pill="Not Posted"
        title="No GL impact yet"
        body={`This advance invoice is a Deposit: the money is held in ${CUSTOMER_DEPOSITS_ACCOUNT} and nothing posts at approval. As each shipment on the order goes out, the deposit applies and revenue is recognised on this same invoice.`}
      />
    );
  }
  if (plan.kind === 'creditOnAdvance') {
    return (
      <GlEmptyState
        pill="Not Posted"
        title="No GL impact"
        body="This credit memo lowers a Deposit advance invoice. The advance never posted, so there is nothing to reverse."
      />
    );
  }

  if (invoice.invoiceStatus === 'Cancelled') {
    return (
      <GlEmptyState
        pill="Not Posted"
        title="No GL impact"
        body={`This ${nounOf(invoice)} was cancelled before it was approved, so nothing ever posted to the general ledger.`}
      />
    );
  }

  return (
    <div className="space-y-3.5">
      {/* One card per journal entry: the posting, then settlements, write
          off, refunds and revise reversals in order (FAD 11/2). */}
      {plan.entries.map((entry) => (
        <div key={entry.key} className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#EEF2FF' }}>
              <BookOpen className="w-3.5 h-3.5" style={{ color: '#4338CA' }} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-[13px] text-foreground tracking-tight" style={{ fontWeight: 600 }}>{plan.entries.length > 1 ? entry.title : 'GL Impact'}</h3>
              <p className="text-[11px] text-slate-400">{entry.helper}</p>
            </div>
            {entry.date && (
              <span className="text-[10px] rounded-full px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-500 shrink-0" style={{ fontWeight: 500 }}>
                Posting Date · {formatUsDate(entry.date)}
              </span>
            )}
            <span
              className="text-[10px] rounded-full px-2 py-0.5 bg-muted text-muted-foreground shrink-0"
              style={{ fontWeight: 600 }}
            >
              {entry.lines.length} lines
            </span>
          </div>
          <JournalTable lines={entry.lines} />
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Tab: Payments & Deposits — receipts, deposit applications and credit
// memos against this invoice, with the "Applied to this invoice"
// subtotal that reconciles to Net due.
// ══════════════════════════════════════════════════════════════════

// MoneyRow card list retired (user 10/1): the tab renders through the
// vendor PaymentsTab's LineItemsTable chrome below.

function CustomerPaymentsTab({
  invoice,
  allInvoices,
  deposits,
}: {
  invoice: CustomerInvoice;
  allInvoices: CustomerInvoice[];
  deposits: CustomerDeposit[];
}) {
  // Vendor PaymentsTab parity (user 10/1): receipts, applied deposits and
  // credit memos render through the same LineItemsTable chrome the vendor
  // invoice's Payments tab uses — search, count, density, columns — with
  // the pure empty-state card when nothing is applied yet.
  interface ARMoneyRow {
    id: string;
    reference: string;
    type: 'Receipt' | 'Deposit' | 'Credit Memo';
    date: string;
    method: string;
    status: string;
    amount: number;
    creditMemoId?: string;
  }
  const creditMemos = isCreditMemo(invoice) ? [] : creditMemosFor(invoice.invoiceNumber, allInvoices);
  const receipts = invoice.receipts;
  const depositApps = invoice.depositApplications;
  const hasAnything = receipts.length > 0 || depositApps.length > 0 || creditMemos.length > 0;

  if (!hasAnything) {
    return (
      <div className="border border-border rounded-xl bg-white overflow-hidden flex flex-col" style={{ minHeight: 'max(400px, calc(100vh - 269px))' }}>
        <div className="flex-1 flex flex-col items-center justify-center w-full py-12 px-6 text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-primary/5 animate-ping" style={{ animationDuration: '3s' }} />
            <div
              className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-50 to-accent border border-border flex items-center justify-center shadow-sm"
              style={{ animation: 'arPayEmptyFloat 4s ease-in-out infinite' }}
            >
              <Banknote className="w-7 h-7 text-slate-400" />
            </div>
          </div>
          <h3 className="text-foreground text-[16px] mb-1.5" style={{ fontWeight: 600, animation: 'arPayEmptyFade 0.5s ease-out both', animationDelay: '0.1s' }}>
            No payments yet
          </h3>
          <p className="text-slate-400 text-[13px] max-w-sm leading-relaxed" style={{ animation: 'arPayEmptyFade 0.5s ease-out both', animationDelay: '0.2s' }}>
            Receipts, applied deposits, and credit memos recorded against this invoice show up here.
          </p>
        </div>
        <style>{`
          @keyframes arPayEmptyFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
          @keyframes arPayEmptyFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
      </div>
    );
  }

  const rows: ARMoneyRow[] = [
    ...receipts.map<ARMoneyRow>((r) => ({
      id: r.id, reference: r.reference, type: 'Receipt', date: r.date, method: r.method, status: 'Received', amount: r.amount,
    })),
    ...depositApps.map<ARMoneyRow>((app) => {
      const dep = deposits.find((d) => d.id === app.depositId);
      return {
        id: `dep-${app.depositId}`,
        reference: dep?.depositNumber ?? app.depositId,
        type: 'Deposit',
        date: app.appliedOn,
        method: dep?.method ?? '',
        status: 'Applied',
        amount: app.amount,
      };
    }),
    ...creditMemos.map<ARMoneyRow>((crn) => ({
      id: crn.id, reference: crn.invoiceNumber, type: 'Credit Memo', date: crn.invoiceDate, method: '', status: crn.invoiceStatus, amount: Math.abs(crn.amount), creditMemoId: crn.id,
    })),
  ];

  const TYPE_PILL: Record<ARMoneyRow['type'], { bg: string; color: string; border: string }> = {
    Receipt: { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
    Deposit: { bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE' },
    'Credit Memo': { bg: palette.rose[50], color: palette.rose[700], border: '#FECDD3' },
  };
  const STATUS_PILL: Record<string, { bg: string; color: string; border: string }> = {
    Received: { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
    Applied: { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  };
  const STATUS_FALLBACK = { bg: '#F1F5F9', color: '#475569', border: '#E2E8F0' };

  const columns: ColumnDef<ARMoneyRow>[] = [
    {
      key: 'reference', label: 'Payment No.', minWidth: 160, defaultWidth: 190, align: 'left', locked: true, sticky: 'left', flex: true,
      getValue: (r) => r.reference,
      // Searchable, so it highlights like every other matched cell (10/9/26).
      render: (r, { searchQuery }) => r.creditMemoId ? (
        <button
          type="button"
          onClick={() => openInvoiceTab(r.reference)}
          className="text-[12px] text-foreground hover:text-primary hover:underline transition-colors cursor-pointer bg-transparent border-0 p-0"
          style={{ fontWeight: 600 }}
         
        >
          {highlightText(r.reference, searchQuery)}
        </button>
      ) : (
        <span className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>{highlightText(r.reference, searchQuery)}</span>
      ),
    },
    {
      key: 'type', label: 'Type', minWidth: 110, defaultWidth: 130, align: 'left', sortable: true,
      getValue: (r) => r.type,
      render: (r) => {
        const pill = TYPE_PILL[r.type];
        return (
          <span className="inline-flex items-center px-2 py-[2px] rounded-full border text-[11px]" style={{ fontWeight: 600, backgroundColor: pill.bg, color: pill.color, borderColor: pill.border }}>
            {r.type}
          </span>
        );
      },
    },
    {
      key: 'date', label: 'Date', minWidth: 110, defaultWidth: 130, align: 'left', sortable: true,
      getValue: (r) => r.date,
      render: (r) => <span className="text-[12px] text-slate-600">{formatUsDate(r.date)}</span>,
    },
    {
      key: 'method', label: 'Method', minWidth: 120, defaultWidth: 150, align: 'left', sortable: true,
      getValue: (r) => r.method,
      render: (r, { searchQuery }) => r.method
        ? <span className="text-[12px] text-slate-600">{highlightText(r.method, searchQuery)}</span>
        : <span className="text-muted-foreground/50">·</span>,
    },
    {
      key: 'status', label: 'Status', minWidth: 110, defaultWidth: 130, align: 'left', sortable: true,
      getValue: (r) => r.status,
      render: (r) => {
        const pill = STATUS_PILL[r.status] ?? STATUS_FALLBACK;
        return (
          <span className="inline-flex items-center px-2 py-[2px] rounded-full border text-[11px]" style={{ fontWeight: 600, backgroundColor: pill.bg, color: pill.color, borderColor: pill.border }}>
            {r.status}
          </span>
        );
      },
    },
    {
      key: 'amount', label: 'Applied to Invoice', minWidth: 116, defaultWidth: 140, sortable: true, align: 'right',
      getValue: (r) => r.amount,
      render: (r) => (
        <span className="text-[12px]" style={{ fontWeight: 600, color: r.type === 'Credit Memo' ? palette.rose[700] : 'hsl(var(--foreground))' }}>
          {fmtMoney(r.amount)}
        </span>
      ),
    },
  ];
  const catalog = columns.map((c) => ({ key: c.key, label: c.label }));

  return (
    <LineItemsTable<ARMoneyRow>
      rows={rows}
      columns={columns}
      catalog={catalog}
      lockedKeys={['reference']}
      storageKey="omnesoft:customer-invoice-payments"
      getRowId={(r) => r.id}
      rowHeight={52}
      title="Payments"
      countNoun="payments"
      searchAccessor={(r) => `${r.reference} ${r.type} ${r.method} ${r.status}`}
      searchPlaceholder="Search payments…"
      emptyTitle="No payments yet"
      emptyIcon={Banknote}
      emptyMessage="Receipts, applied deposits, and credit memos recorded against this invoice show up here."
      fillViewport
    />
  );
}

// ══════════════════════════════════════════════════════════════════
// Tab: Recent Activity — the vendor ActivityTab's visual recipe forked
// to the AR action vocabulary: vertical timeline, icon circle per
// event, absolute timestamp, actor bolded, reason line beneath.
// ══════════════════════════════════════════════════════════════════

const ACTIVITY_META: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  created: { icon: FilePlus, color: '#2563EB', bg: '#EFF6FF', label: 'created' },
  create: { icon: FilePlus, color: '#2563EB', bg: '#EFF6FF', label: 'created' },
  edit: { icon: Pencil, color: '#475569', bg: '#F1F5F9', label: 'edited' },
  resubmit: { icon: RotateCcw, color: '#4338CA', bg: '#EEF2FF', label: 'edited and resubmitted' },
  submit: { icon: Send, color: '#4338CA', bg: '#EEF2FF', label: 'submitted for approval' },
  approve: { icon: CheckCircle2, color: '#047857', bg: '#ECFDF5', label: 'approved' },
  reject: { icon: XCircle, color: '#991B1B', bg: '#FEF2F2', label: 'sent back' },
  send: { icon: Mail, color: '#1D4ED8', bg: '#EFF6FF', label: 'sent to the customer' },
  resend: { icon: Mail, color: '#1D4ED8', bg: '#EFF6FF', label: 'resent to the customer' },
  sendFailed: { icon: MailX, color: '#991B1B', bg: '#FEF2F2', label: 'could not send' },
  cancel: { icon: XCircle, color: '#991B1B', bg: '#FEF2F2', label: 'cancelled' },
  archive: { icon: Archive, color: '#475569', bg: '#F1F5F9', label: 'archived' },
  restore: { icon: ArchiveRestore, color: '#047857', bg: '#ECFDF5', label: 'restored' },
  creditHold: { icon: Lock, color: '#92400E', bg: '#FFFBEB', label: 'placed a credit hold on' },
  releaseCreditHold: { icon: RotateCcw, color: '#047857', bg: '#ECFDF5', label: 'released the credit hold on' },
  writeOff: { icon: Eraser, color: '#B45309', bg: '#FFFBEB', label: 'wrote off the balance of' },
  markDisputed: { icon: Flag, color: '#BE123C', bg: '#FFF1F2', label: 'flagged as disputed' },
  // FAD 11/2
  flagException: { icon: AlertTriangle, color: '#B45309', bg: '#FFFBEB', label: 'flagged an exception on' },
  resolveException: { icon: CheckCircle2, color: '#047857', bg: '#ECFDF5', label: 'resolved the exception on' },
  revised: { icon: History, color: '#475569', bg: '#F1F5F9', label: 'revised and reversed' },
  revisedFrom: { icon: FilePenLine, color: '#1D4ED8', bg: '#EFF6FF', label: 'opened a revision as' },
  refundPrepayment: { icon: Undo2, color: '#BE123C', bg: '#FFF1F2', label: 'refunded the prepayment on' },
  reverseRefund: { icon: Undo2, color: '#BE123C', bg: '#FFF1F2', label: 'reversed revenue and refunded' },
  resolveDispute: { icon: ShieldCheck, color: '#047857', bg: '#ECFDF5', label: 'resolved the dispute on' },
  recordPayment: { icon: Banknote, color: '#6D28D9', bg: '#F5F3FF', label: 'recorded a receipt on' },
};

const SEND_ACTIONS = new Set(['send', 'resend', 'sendFailed']);

const ACTIVITY_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** The vendor ActivityTab stamp: "Mar 28, 2026 at 03:15 PM"; a date-only
 *  string renders as a plain date. */
function activityTimestamp(iso: string) {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso.trim());
  const d = new Date(dateOnly ? `${iso.trim()}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  const head = `${ACTIVITY_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  if (dateOnly) return head;
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${head} at ${hours.toString().padStart(2, '0')}:${minutes} ${period}`;
}

/* Activity: the vendor ActivityTab recipe verbatim (single card, rail,
   icon dot, timestamp, "<actor> <verb> <subject chip>", detail line), fed
   from the AR action history plus the send log. */
function CustomerActivityTab({ invoice }: { invoice: CustomerInvoice }) {
  const events = useMemo(() => {
    const rows: Array<{ id: string; action: string; by: string; at: string; detail?: string }> = [];
    const history = invoice.actionHistory ?? [];
    history.forEach((e, i) => {
      rows.push({ id: `h-${i}`, action: e.action, by: e.by, at: e.at, detail: e.reason || undefined });
    });
    // Seeded sends live only in the send log; live sends are in both, so
    // a log entry is added only when no send event shares its moment.
    const sendMoments = new Set(history.filter((e) => SEND_ACTIONS.has(e.action)).map((e) => e.at));
    (invoice.sendLog ?? []).forEach((s, i) => {
      if (sendMoments.has(s.at)) return;
      const earlier = (invoice.sendLog ?? []).slice(0, i).some((x) => x.outcome === 'sent');
      rows.push({
        id: `s-${s.id}`,
        action: s.outcome === 'failed' ? 'sendFailed' : earlier ? 'resend' : 'send',
        by: s.by,
        at: s.at,
        detail: `To ${s.to.join(', ')}`,
      });
    });
    // Synthesized creation event: every document has at least this one.
    if (!history.some((e) => e.action === 'create' || e.action === 'created')) {
      rows.push({ id: 'created', action: 'created', by: invoice.createdBy, at: invoice.createdDate });
    }
    if (invoice.approvedAt && !history.some((e) => e.action === 'approve')) {
      rows.push({ id: 'approved-seed', action: 'approve', by: invoice.approvedBy ?? '', at: invoice.approvedAt });
    }
    if (invoice.submittedAt && !history.some((e) => e.action === 'submit')) {
      rows.push({ id: 'submitted-seed', action: 'submit', by: invoice.submittedBy ?? '', at: invoice.submittedAt });
    }
    return rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [invoice]);

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white py-4 flex items-center justify-center" style={{ minHeight: 'max(400px, calc(100vh - 269px))' }}>
        <EmptyState
          icon={Cog}
          title="No activity recorded yet"
          description="Approvals, sends, credit memos and other events on this invoice show up here."
        />
      </div>
    );
  }

  const subjectTone = credit_tone(invoice);
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col" style={{ minHeight: 'max(400px, calc(100vh - 269px))' }}>
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
        <h3 className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Activity</h3>
        <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
          {events.length} event{events.length === 1 ? '' : 's'}
        </span>
      </div>

      <ol className="relative px-4 py-4 flex-1">
        {/* Vertical timeline rail */}
        <div className="absolute left-[28px] top-6 bottom-6 w-px bg-slate-200 pointer-events-none" />

        {events.map((event) => {
          const meta = ACTIVITY_META[event.action] ?? {
            icon: Pencil,
            color: '#475569',
            bg: '#F1F5F9',
            // Form saves carry their own wording ("Saved as draft", ...).
            label: event.action.charAt(0).toLowerCase() + event.action.slice(1),
          };
          const Icon = meta.icon;
          return (
            <li key={event.id} className="relative pl-10 pr-2 py-2.5 group">
              <div
                className="absolute left-[14px] top-3 w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow-sm"
                style={{ backgroundColor: meta.bg }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
              </div>
              <p className="text-[11px] text-slate-500 " style={{ fontWeight: 500 }}>
                {activityTimestamp(event.at)}
              </p>
              <p className="mt-0.5 text-[12px] text-slate-700 leading-snug" style={{ fontWeight: 400 }}>
                <span className="text-foreground" style={{ fontWeight: 600 }}>
                  {event.by || 'System'}
                </span>{' '}
                <span className="text-slate-600">{meta.label}</span>{' '}
                <span
                  className="inline-flex items-center px-1.5 py-px rounded text-[11px] align-baseline"
                  style={{
                    fontWeight: 700,
                    backgroundColor: subjectTone.bg,
                    color: subjectTone.text,
                    border: `1px solid ${subjectTone.border}`,
                  }}
                >
                  {invoice.invoiceNumber}
                </span>
              </p>
              {event.detail && (
                <p className="mt-1 text-[11px] text-slate-500 leading-snug">
                  {event.detail}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const credit_tone = (inv: CustomerInvoice) =>
  inv.docKind === 'Credit Memo'
    ? { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' }
    : inv.docKind === 'Advance Invoice'
      ? { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' }
      : { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' };

// ══════════════════════════════════════════════════════════════════
// Tab: Communications. The vendor CommunicationTab card (icon tile,
// title, helper, count pill, honest empty state); once emails exist they
// render through the shared LineItemsTable chrome (search, count, full
// screen, density, columns), newest first (PRD §10.3).
// ══════════════════════════════════════════════════════════════════

type SendLogRow = NonNullable<CustomerInvoice['sendLog']>[number];

function CustomerCommunicationsTab({ invoice }: { invoice: CustomerInvoice }) {
  const log = useMemo(() => [...(invoice.sendLog ?? [])].sort((a, b) => (a.at < b.at ? 1 : -1)), [invoice.sendLog]);
  if (log.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col" style={{ minHeight: 'max(400px, calc(100vh - 269px))' }}>
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2.5 shrink-0">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#EFF6FF' }}>
            <MessageSquare className="w-3.5 h-3.5" style={{ color: '#1D4ED8' }} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[13px] text-foreground tracking-tight" style={{ fontWeight: 600 }}>Communications</h3>
            <p className="text-[11px] text-slate-400">Emails sent to the customer, attached to the record they are about.</p>
          </div>
          <span className="text-[10px] rounded-full px-2 py-0.5 bg-muted text-muted-foreground shrink-0" style={{ fontWeight: 600 }}>
            0 messages
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center py-10">
          <EmptyState
            icon={MessageSquare}
            title={`No messages on this ${nounOf(invoice)} yet`}
            description={
              invoice.invoiceStatus === 'Approved'
                ? `Each email sent to ${invoice.customer} lands here with its recipients, subject and outcome.`
                : `Only an approved ${nounOf(invoice)} can be sent. Each email lands here once it goes out.`
            }
          />
        </div>
      </div>
    );
  }

  const columns: ColumnDef<SendLogRow>[] = [
    {
      key: 'date', label: 'Date', minWidth: 150, defaultWidth: 180, align: 'left', locked: true, sticky: 'left', sortable: true,
      getValue: (s) => s.at,
      render: (s) => <span className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>{formatUsDateTime(s.at)}</span>,
    },
    {
      key: 'to', label: 'To', minWidth: 180, defaultWidth: 220, align: 'left', flex: true,
      getValue: (s) => s.to.join(', '),
      render: (s, { searchQuery }) => <span className="text-[12px] text-slate-600 truncate block">{highlightText(s.to.join(', '), searchQuery)}</span>,
    },
    {
      key: 'cc', label: 'CC', minWidth: 120, defaultWidth: 160, align: 'left',
      getValue: (s) => s.cc.join(', '),
      render: (s, { searchQuery }) =>
        s.cc.length ? <span className="text-[12px] text-slate-600 truncate block">{highlightText(s.cc.join(', '), searchQuery)}</span> : null,
    },
    {
      key: 'subject', label: 'Subject', minWidth: 200, defaultWidth: 260, align: 'left',
      getValue: (s) => s.subject,
      render: (s, { searchQuery }) => (
        <div className="min-w-0">
          <div className="text-[12px] text-foreground truncate">{highlightText(s.subject, searchQuery)}</div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate" style={{ fontWeight: 500 }}>Attached {invoice.invoiceNumber}.pdf</div>
        </div>
      ),
    },
    {
      key: 'by', label: 'Sent By', minWidth: 140, defaultWidth: 160, align: 'left', sortable: true,
      getValue: (s) => s.by,
      render: (s) => <CreatedByCell name={s.by} vendor={invoice.customer} density="condensed" />,
    },
    {
      key: 'outcome', label: 'Outcome', minWidth: 100, defaultWidth: 110, align: 'left', sortable: true,
      getValue: (s) => s.outcome,
      render: (s) => (
        <span
          className="inline-flex items-center px-2 py-[2px] rounded-full border text-[11px] whitespace-nowrap"
          style={
            s.outcome === 'sent'
              ? { fontWeight: 600, backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }
              : { fontWeight: 600, backgroundColor: '#FEF2F2', color: '#B91C1C', borderColor: '#FECACA' }
          }
        >
          {s.outcome === 'sent' ? 'Sent' : 'Failed'}
        </span>
      ),
    },
  ];
  const catalog = columns.map((c) => ({ key: c.key, label: c.label }));
  return (
    <LineItemsTable<SendLogRow>
      rows={log}
      columns={columns}
      catalog={catalog}
      lockedKeys={['date']}
      defaultHiddenKeys={['cc']}
      storageKey="omnesoft:customer-invoice-communications"
      getRowId={(s) => s.id}
      rowHeight={52}
      title="Communications"
      countNoun="emails"
      searchAccessor={(s) => `${s.to.join(' ')} ${s.cc.join(' ')} ${s.subject} ${s.by} ${s.outcome}`}
      searchPlaceholder="Search emails…"
      emptyTitle="No messages yet"
      emptyIcon={MessageSquare}
      emptyMessage="No emails match the current search."
      fillViewport
    />
  );
}

// ══════════════════════════════════════════════════════════════════
// Right sidebar — the InvoiceDetailSidebar recipes: collapsible
// section cards (icon + title + chevron), General Information and
// Invoice Summary with the paid-progress bar.
// ══════════════════════════════════════════════════════════════════

function SidebarSection({
  icon: Icon,
  title,
  open,
  onToggle,
  children,
  collapsedSummary,
}: {
  icon: React.ElementType;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  collapsedSummary?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50/60 transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/[0.08] flex items-center justify-center">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!open && collapsedSummary && (
            <span className="text-[11px] text-slate-500 " style={{ fontWeight: 500 }}>
              {collapsedSummary}
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      <CollapseReveal open={open}>
        <div className="px-4 pb-4">{children}</div>
      </CollapseReveal>
    </div>
  );
}

/** One partner-grid field: 11px slate label over a 12px value (vendor
 *  InvoiceDetailSidebar recipe). */
function InfoField({
  label,
  children,
  full,
  muted,
  wrap,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  full?: boolean;
  muted?: boolean;
  wrap?: boolean;
}) {
  return (
    <div className={`min-w-0 ${full ? 'col-span-2' : ''}`}>
      <div className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>{label}</div>
      <div
        className={`text-[12px] mt-0.5 ${wrap ? 'break-words leading-snug' : 'truncate'} ${muted ? 'text-slate-400' : 'text-foreground'}`}
        style={{ fontWeight: muted ? 500 : 600 }}
      >
        {children}
      </div>
    </div>
  );
}

function LockedLabel({ label, title, body }: { label: string; title: string; body: string }) {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 cursor-help">
          {label}
          <Lock className="w-2.5 h-2.5 text-slate-300" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
        <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>{title}</p>
        <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{body}</p>
      </TooltipContent>
    </Tooltip>
  );
}

const refLinkClass =
  'text-[12px] text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors cursor-pointer bg-transparent border-0 p-0 text-left';

const sidebarDate = (iso?: string) => (iso ? formatUsDateTime(iso) || '·' : '·');

/* Right sidebar: the vendor InvoiceDetailSidebar forked to AR data.
   General Information (customer hero, partner field grid, created and
   approved footer), Invoice Summary (hero total, Paid | Outstanding grid,
   breakdown accordion, reductions), Additional Charges, Freight &
   Logistics. */
function CustomerDetailSidebar({
  invoice,
  allInvoices,
  customers,
  statusLabel,
  statusPalette,
}: {
  invoice: CustomerInvoice;
  allInvoices: CustomerInvoice[];
  customers: Customer[];
  statusLabel: string;
  statusPalette: PillPalette;
}) {
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [open, setOpen] = useState<Record<'general' | 'summary' | 'charges' | 'freight', boolean>>({
    general: true,
    summary: true,
    charges: false,
    freight: false,
  });
  const toggle = (k: keyof typeof open) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const credit = isCreditMemo(invoice);
  const advance = invoice.docKind === 'Advance Invoice';
  const customer = customerByName(invoice.customer, customers);
  const billTo = customer?.addresses.find((a) => a.id === invoice.billToAddressId) ?? customer?.addresses.find((a) => a.id === customer.defaultBillToId);
  const term = arTermById(invoice.paymentTermId);

  const sign = credit ? -1 : 1;
  const subtotal = r2(invoice.lines.reduce((s, l) => s + Math.abs(l.total), 0));
  const freight = Math.abs(invoice.freightAmount ?? 0);
  const taxCharges = invoice.charges.filter((c) => c.type === 'Tax');
  const otherCharges = invoice.charges.filter((c) => c.type !== 'Tax');
  const tax = r2(taxCharges.reduce((s, c) => s + Math.abs(c.amount), 0));
  const additional = r2(otherCharges.reduce((s, c) => s + Math.abs(c.amount), 0));
  const total = Math.abs(invoice.amount);
  const depositsApplied = depositsAppliedTotal(invoice);
  const receipts = receiptsTotal(invoice);
  const due = netDue(invoice);
  const payStatus = invoice.invoiceStatus === 'Approved' ? paymentStatusOf(invoice) : null;
  const payPalette = payStatus ? PAYMENT_PALETTE[payStatus] ?? FALLBACK_PALETTE : FALLBACK_PALETTE;
  const overdue = isOverdue(invoice);
  const overdueDays = daysOverdue(invoice);

  // Credit memos against this invoice (statuses are approval only; the
  // parent's status never moves, its summary shows the reduction).
  const memos = credit ? [] : creditMemosFor(invoice.invoiceNumber, allInvoices);
  const creditedApproved = r2(memos.filter((m) => m.invoiceStatus === 'Approved').reduce((s, m) => s + Math.abs(m.amount), 0));
  const creditedPending = r2(memos.filter((m) => m.invoiceStatus !== 'Approved').reduce((s, m) => s + Math.abs(m.amount), 0));
  const advanceCovered = r2(invoice.lines.reduce((s, l) => s + (l.advanceCovered ?? 0), 0));

  // Advance: order totals (PRD §8.4) from the SO, or the quote.
  const advanceTotals = (() => {
    if (!advance) return null;
    const so = invoice.linkedSOs[0] ? findSalesOrder(invoice.linkedSOs[0], customers) : undefined;
    if (so) {
      const ob = orderBilling(so.so, so.customer, allInvoices, invoice.id);
      return { orderTotal: ob.orderTotal, already: ob.advanceBilled };
    }
    const q = invoice.quoteNumber ? findQuote(invoice.quoteNumber, customers) : undefined;
    if (q) {
      const already = r2(advanceInvoicesForQuote(q.quote, allInvoices, invoice.id).reduce((s, i) => s + i.amount, 0));
      return { orderTotal: q.quote.totalValue, already };
    }
    return null;
  })();

  const parent = credit && invoice.relatedInvoiceNumber ? allInvoices.find((i) => i.invoiceNumber === invoice.relatedInvoiceNumber) : undefined;
  const parentRemaining = parent ? creditableRemaining(parent, allInvoices) : 0;

  const accountLabel = advance ? 'Deposit Account' : 'A/R Account';
  const accountValue = advance ? invoice.depositAccount || customer?.depositAccount || CUSTOMER_DEPOSITS_ACCOUNT : invoice.arAccount;

  const voided = invoice.invoiceStatus === 'Cancelled' || invoice.invoiceStatus === 'Rejected' || !!invoice.archived;
  const settled = !voided && invoice.invoiceStatus === 'Approved' && (advance ? !!invoice.depositReceived : due <= 0.004 || !!invoice.writtenOff);
  const dueDays = invoice.dueDate ? overdueDaysOf(invoice.dueDate) : 0;
  const late = !settled && !voided && (advance ? dueDays > 0 : overdue);
  const dueLabel = voided ? statusLabel : settled ? 'Settled' : late ? overdueLabel(advance ? dueDays : overdueDays) : overdueLabel(dueDays);
  const dueColor = voided ? '#475569' : late ? '#DC2626' : !settled && dueDays >= -7 ? '#B45309' : '#475569';
  const dueBg = voided || settled ? '#F1F5F9' : late ? '#FEF2F2' : dueDays >= -7 ? '#FFFBEB' : '#F1F5F9';

  const paidValue = r2(receipts + depositsApplied);
  const reductions = r2(creditedApproved);
  const amountAfterReductions = Math.max(0, r2(total - reductions));
  const money = (n: number) => fmtMoney(sign * n);

  const chargeRows = [...otherCharges, ...taxCharges];

  return (
    <aside className="w-[320px] shrink-0 space-y-3 self-start sticky top-[170px]">
      {/* ── General Information ─────────────────────────────── */}
      <SidebarSection icon={Info} title="General Information" open={open.general} onToggle={() => toggle('general')} collapsedSummary={invoice.invoiceNumber}>
        <div>
          {/* Partner-card anatomy: the CUSTOMER leads as an avatar + name
              hero, the fields sit in the partner two-column grid. */}
          <HoverCard openDelay={300} closeDelay={120}>
            <HoverCardTrigger asChild>
              <a
                href={partnerVendorUrl(invoice.customer)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 min-w-0 group/vh"
              >
                <VendorAvatar name={invoice.customer} size="lg" />
                <span className="min-w-0">
                  <span className="block text-[14px] text-foreground truncate transition-colors group-hover/vh:text-primary group-hover/vh:underline" style={{ fontWeight: 600 }}>
                    {invoice.customer}
                  </span>
                  <span className="block text-[11px] text-slate-400 truncate mt-0.5">
                    {invoice.description || 'Customer'}
                  </span>
                </span>
              </a>
            </HoverCardTrigger>
            <HoverCardContent
              side="left"
              align="start"
              sideOffset={8}
              className="p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden w-auto"
            >
              <CustomerQuickCard customer={invoice.customer} description={invoice.description} />
            </HoverCardContent>
          </HoverCard>

          <div className="grid grid-cols-2 gap-x-3 gap-y-3 mt-3.5 pt-3.5 border-t border-slate-100">
            <InfoField label={credit ? 'Credit Memo ID' : 'Invoice ID'}>{invoice.invoiceNumber}</InfoField>
            {!credit && invoice.documentNumber && <InfoField label="Invoice Number">{invoice.documentNumber}</InfoField>}
            {credit ? (
              <InfoField label="Credits Invoice">
                {invoice.relatedInvoiceNumber ? (
                  <button type="button" className={refLinkClass} style={{ fontWeight: 600 }} onClick={() => openInvoiceTab(invoice.relatedInvoiceNumber!)}>
                    {invoice.relatedInvoiceNumber}
                  </button>
                ) : (
                  '·'
                )}
              </InfoField>
            ) : (
              <InfoField label={invoice.docKind === 'Standalone' ? 'Customer Reference' : 'Customer PO Number'} muted={!invoice.customerPONumber}>
                {invoice.customerPONumber || '·'}
              </InfoField>
            )}
            <InfoField label={credit ? 'Credit Date' : 'Invoice Date'}>{sidebarDate(invoice.invoiceDate)}</InfoField>
            <InfoField label="Posting Date" muted={!invoice.postingDate}>
              {invoice.postingDate ? sidebarDate(invoice.postingDate) : advance ? 'Nothing posts' : 'Set on approval'}
            </InfoField>
            {!credit && (
              <div className="min-w-0">
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <p className="text-[11px] text-slate-400 cursor-help inline-flex" style={{ fontWeight: 500 }}>Trigger Date</p>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[240px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                    <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>Starts the payment clock</p>
                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">The due date is this date plus the term days from the customer's payment terms. The trigger event comes from the term: shipment, invoice date, or another agreed milestone.</p>
                  </TooltipContent>
                </Tooltip>
                {invoice.triggerDate ? (
                  <p className="text-[12px] text-foreground truncate mt-0.5" style={{ fontWeight: 600 }}>{sidebarDate(invoice.triggerDate)}</p>
                ) : (
                  <p className="text-[12px] text-slate-400 truncate mt-0.5" style={{ fontWeight: 500 }}>Not reached yet</p>
                )}
              </div>
            )}
            {!credit && (
              <div className="min-w-0">
                <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Due Date</p>
                {invoice.dueDate ? (
                  <p className="text-[12px] text-foreground mt-0.5 flex items-center gap-1.5 flex-wrap" style={{ fontWeight: 600 }}>
                    <span>{sidebarDate(invoice.dueDate)}</span>
                    <span className="text-[10px] px-1.5 py-px rounded" style={{ fontWeight: 600, color: dueColor, backgroundColor: dueBg }}>
                      {dueLabel}
                    </span>
                  </p>
                ) : (
                  <p className="text-[12px] text-slate-400 truncate mt-0.5" style={{ fontWeight: 500 }}>Set by the trigger date</p>
                )}
              </div>
            )}
            {!credit && (
              <div className="min-w-0">
                <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Payment Terms</p>
                {term ? (
                  <HoverCard openDelay={250} closeDelay={120}>
                    <HoverCardTrigger asChild>
                      <button
                        type="button"
                        className="block max-w-full text-[12px] text-foreground text-left break-words leading-snug mt-0.5 hover:text-primary hover:underline transition-colors cursor-pointer bg-transparent border-0 p-0"
                        style={{ fontWeight: 600 }}
                      >
                        {term.name}
                      </button>
                    </HoverCardTrigger>
                    <HoverCardContent side="left" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none w-[300px] z-[300]">
                      <div className="rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
                        <PaymentTermCard term={term} readOnly hideCheckmark />
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                ) : (
                  <p className="text-[12px] text-foreground break-words leading-snug mt-0.5" style={{ fontWeight: 600 }}>{invoice.paymentTerms || '·'}</p>
                )}
              </div>
            )}
            <InfoField label="Type">{CUSTOMER_TYPE_CONFIG[invoice.docKind]?.label ?? invoice.docKind}</InfoField>
            {advance && invoice.advanceStage && (
              <InfoField label="Stage" wrap>
                {invoice.advanceStage.label} · {invoice.advanceStage.percent}%
              </InfoField>
            )}
            {invoice.quoteNumber && <InfoField label="Quote">{invoice.quoteNumber}</InfoField>}
            {credit && <InfoField label="Credit Reason">{invoice.creditReason || '·'}</InfoField>}
            {credit && (
              <InfoField label="Credit Basis">{invoice.creditBasis === 'lines' ? 'By Lines' : invoice.creditBasis === 'amount' ? 'By Amount' : '·'}</InfoField>
            )}
            {credit && invoice.rmaNumber && <InfoField label="RMA Number">{invoice.rmaNumber}</InfoField>}
            {!credit && invoice.relatedInvoiceNumber && (
              <InfoField label="Related Invoice">
                <button type="button" className={refLinkClass} style={{ fontWeight: 600 }} onClick={() => openInvoiceTab(invoice.relatedInvoiceNumber!)}>
                  {invoice.relatedInvoiceNumber}
                </button>
              </InfoField>
            )}
            <InfoField
              label={
                <LockedLabel
                  label={accountLabel}
                  title="Set by the customer profile"
                  body={
                    advance
                      ? 'The deposit account comes from the customer in Partners. It changes per invoice only when the company setting allows it.'
                      : 'The receivable account comes from the customer in Partners and can change per invoice only when the company setting allows it.'
                  }
                />
              }
            >
              {accountValue || 'Not Set'}
            </InfoField>
            <InfoField label="Currency">{invoice.currency}</InfoField>
            {billTo && (
              <InfoField label="Bill-to Address" full wrap>
                {addressLine(billTo)}
              </InfoField>
            )}
          </div>

          {/* Created By | Created On (+ Approved By | Approved On), the
              partner card's footer, avatar included. */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-3 mt-3.5 pt-3.5 border-t border-slate-100">
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Created By</p>
              <p className="flex items-center gap-1.5 mt-1 min-w-0">
                <PhotoPersonAvatar name={invoice.createdBy} size="sm" />
                <span className="text-[12px] text-foreground truncate" style={{ fontWeight: 600 }}>{invoice.createdBy}</span>
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Created On</p>
              <p className="text-[12px] text-foreground truncate mt-1.5" style={{ fontWeight: 600 }}>{sidebarDate(invoice.createdDate)}</p>
            </div>
            {invoice.approvedBy && (
              <>
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Approved By</p>
                  <p className="flex items-center gap-1.5 mt-1 min-w-0">
                    <PhotoPersonAvatar name={invoice.approvedBy} size="sm" />
                    <span className="text-[12px] text-foreground truncate" style={{ fontWeight: 600 }}>{invoice.approvedBy}</span>
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Approved On</p>
                  <p className="text-[12px] text-foreground truncate mt-1.5" style={{ fontWeight: 600 }}>{sidebarDate(invoice.approvedAt)}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </SidebarSection>

      {/* ── Invoice Summary ─────────────────────────────────── */}
      <SidebarSection
        icon={Wallet}
        title={credit ? 'Credit Summary' : 'Invoice Summary'}
        open={open.summary}
        onToggle={() => toggle('summary')}
        collapsedSummary={money(credit ? total : amountAfterReductions)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400" style={{ fontWeight: 600 }}>{credit ? 'Credit Amount' : 'Total Amount'}</p>
            <p className="text-[22px] mt-0.5" style={{ fontWeight: 700, lineHeight: 1.1, color: credit ? palette.red[600] : 'hsl(var(--foreground))' }}>
              {money(credit ? total : amountAfterReductions)}
            </p>
            {!credit && reductions > 0.004 && (
              <p className="text-[11px] text-slate-400 mt-1" style={{ fontWeight: 500 }}>
                Original Total {fmtMoney(total)}
              </p>
            )}
          </div>
          <span
            className="inline-flex items-center gap-1 px-1.5 py-px rounded border text-[10px] shrink-0 mt-0.5"
            style={{
              fontWeight: 600,
              backgroundColor: payStatus ? payPalette.bg : statusPalette.bg,
              color: payStatus ? payPalette.color : statusPalette.color,
              borderColor: payStatus ? payPalette.border : statusPalette.border,
            }}
          >
            {payStatus ?? statusLabel}
          </span>
        </div>

        {/* Paid | Outstanding: the two load-bearing figures above the
            breakdown accordion (approved, money-bearing documents). */}
        {!credit && invoice.invoiceStatus === 'Approved' && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 mt-3 pt-3 border-t border-slate-100">
            <div className="min-w-0">
              <p className="text-[11px]" style={{ fontWeight: 500, color: '#059669' }}>{advance ? 'Deposit Received' : 'Paid'}</p>
              <p className="text-[13px] truncate mt-0.5" style={{ fontWeight: 600, color: '#047857' }}>
                {fmtMoney(advance ? (invoice.depositReceived ? total : 0) : paidValue)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Outstanding</p>
              <p className="text-[13px] text-foreground truncate mt-0.5" style={{ fontWeight: 600 }}>
                {fmtMoney(advance ? (invoice.depositReceived ? 0 : total) : due)}
              </p>
            </div>
            {creditedApproved > 0.004 && (
              <div className="min-w-0">
                <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Credited</p>
                <p className="text-[13px] text-foreground truncate mt-0.5" style={{ fontWeight: 600 }}>{fmtMoney(creditedApproved)}</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-blue-700 transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            {showBreakdown ? <ChevronDown className="w-3 h-3 rotate-180" /> : <ChevronDown className="w-3 h-3" />}
            {showBreakdown ? 'Hide Breakdown' : 'Show Breakdown'}
          </button>
          <div
            className="grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{ gridTemplateRows: showBreakdown ? '1fr' : '0fr', opacity: showBreakdown ? 1 : 0 }}
            aria-hidden={!showBreakdown}
          >
            <div className="overflow-hidden">
              <div className="space-y-1.5 pt-1 pb-2">
                {(advance && advanceTotals
                  ? [
                      ['Order Total', fmtMoney(advanceTotals.orderTotal)],
                      ['Already Advance Billed', fmtMoney(advanceTotals.already)],
                      ['Left on Order', fmtMoney(Math.max(0, r2(advanceTotals.orderTotal - advanceTotals.already - total)))],
                    ]
                  : [
                      [credit ? 'Lines Credited' : 'Subtotal', money(subtotal)],
                      ['Tax', money(tax)],
                      ['Freight', money(freight)],
                      ['Additional Charges', money(additional)],
                    ]
                ).map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>{label}</span>
                    <span className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between text-[13px] pt-1.5 mt-1.5 border-t border-slate-100">
            <span className="text-foreground" style={{ fontWeight: 600 }}>{credit ? 'Credit Total' : advance ? 'This Advance' : 'Invoice Total'}</span>
            <span className="" style={{ fontWeight: 700, color: credit ? palette.red[600] : 'hsl(var(--foreground))' }}>
              {money(total)}
            </span>
          </div>

          {/* BR-009: the advance shows as a reference, never a deduction. */}
          {invoice.docKind === 'Shipment Invoice' && advanceCovered > 0.004 &&
            (invoice.advanceReferences?.length ? invoice.advanceReferences : [{ invoiceNumber: '', amount: advanceCovered }]).map((ref, i) => (
              <div key={ref.invoiceNumber || i}>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-violet-700" style={{ fontWeight: 500 }}>Billed on Advance</span>
                  <span className="text-violet-700" style={{ fontWeight: 600 }}>{fmtMoney(ref.amount)}</span>
                </div>
                {ref.invoiceNumber && (
                  <button
                    type="button"
                    onClick={() => openInvoiceTab(ref.invoiceNumber)}
                    className="inline-block text-[11px] text-violet-700 hover:text-violet-900 hover:underline mt-0.5 cursor-pointer bg-transparent border-0 p-0"
                    style={{ fontWeight: 600 }}
                  >
                    {ref.invoiceNumber}
                  </button>
                )}
              </div>
            ))}

          {creditedApproved > 0.004 && (
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-slate-500">Credit Memos</span>
              <span className="" style={{ fontWeight: 600, color: '#047857' }}>−{fmtMoney(creditedApproved)}</span>
            </div>
          )}
          {creditedPending > 0.004 && (
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-slate-500">Credit Awaiting Approval</span>
              <span className="text-slate-500" style={{ fontWeight: 600 }}>{fmtMoney(creditedPending)}</span>
            </div>
          )}
          {creditedApproved > 0.004 && (
            <div className="flex items-center justify-between text-[13px] pt-1.5 mt-1.5 border-t border-slate-100">
              <span className="text-foreground" style={{ fontWeight: 600 }}>Amount Due After Credits</span>
              <span className="text-foreground " style={{ fontWeight: 700 }}>{fmtMoney(amountAfterReductions)}</span>
            </div>
          )}

          {credit && parent && (
            <>
              <div className="flex items-center justify-between text-[12px] pt-1.5 mt-1.5 border-t border-slate-100">
                <span className="text-slate-500">Invoice Total</span>
                <span className="text-foreground" style={{ fontWeight: 600 }}>{fmtMoney(parent.amount)}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-slate-500">Still Creditable</span>
                <span className="text-foreground" style={{ fontWeight: 600 }}>{fmtMoney(parentRemaining)}</span>
              </div>
            </>
          )}
        </div>
      </SidebarSection>

      {/* ── Additional Charges ───────────────────────────────── */}
      <SidebarSection
        icon={Receipt}
        title="Additional Charges"
        open={open.charges}
        onToggle={() => toggle('charges')}
        collapsedSummary={chargeRows.length > 0 ? money(r2(tax + additional)) : 'None'}
      >
        {chargeRows.length === 0 ? (
          <p className="text-[11px] text-slate-400 text-center py-2" style={{ fontWeight: 500 }}>
            No additional charges on this {nounOf(invoice)}.
          </p>
        ) : (
          <div className="space-y-2">
            {chargeRows.map((charge) => (
              <div key={charge.id} className="flex items-start justify-between gap-2 px-2.5 py-2 rounded-md bg-slate-50/60 border border-slate-100">
                <div className="min-w-0">
                  <p className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>{charge.description || charge.type}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5" style={{ fontWeight: 500 }}>{charge.account}</p>
                </div>
                <span className="text-[11px] text-foreground shrink-0" style={{ fontWeight: 600 }}>
                  {money(Math.abs(charge.amount))}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-100 text-[12px]">
              <span className="text-foreground" style={{ fontWeight: 600 }}>Subtotal</span>
              <span className="text-foreground " style={{ fontWeight: 700 }}>{money(r2(tax + additional))}</span>
            </div>
          </div>
        )}
      </SidebarSection>

      {/* ── Freight & Logistics ──────────────────────────────── */}
      <SidebarSection
        icon={Truck}
        title="Freight & Logistics"
        open={open.freight}
        onToggle={() => toggle('freight')}
        collapsedSummary={freight > 0.004 ? money(freight) : 'None'}
      >
        {freight <= 0.004 ? (
          <p className="text-[11px] text-slate-400 text-center py-2" style={{ fontWeight: 500 }}>
            No freight on this {nounOf(invoice)}.
          </p>
        ) : (
          <div className="space-y-2.5">
            <div>
              <p className="text-[10px] text-slate-400" style={{ fontWeight: 600 }}>Freight Amount</p>
              <p className="text-[18px] mt-0.5" style={{ fontWeight: 700, lineHeight: 1.1, color: credit ? palette.red[600] : 'hsl(var(--foreground))' }}>
                {money(freight)}
              </p>
            </div>
            {invoice.carrier && (
              <div className="pt-2.5 border-t border-slate-100">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Carrier</span>
                  <span className="text-[11px] text-foreground text-right" style={{ fontWeight: 600 }}>{invoice.carrier}</span>
                </div>
              </div>
            )}
            <div className="pt-2.5 border-t border-slate-100">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>GL Account</span>
                <span className="text-[11px] text-foreground text-right" style={{ fontWeight: 600 }}>
                  {invoice.freightAccount || FREIGHT_INCOME_ACCOUNT}
                </span>
              </div>
            </div>
          </div>
        )}
      </SidebarSection>
    </aside>
  );
}

// ══════════════════════════════════════════════════════════════════
// Main screen
// ══════════════════════════════════════════════════════════════════

// Per-action CTA color: the vendor PRIMARY_CTA_TONE language.
const PRIMARY_CTA_TONE: Record<string, string> = {
  submit: 'bg-primary hover:bg-[#0862D0]',
  approve: 'bg-emerald-600 hover:bg-emerald-700',
  send: 'bg-primary hover:bg-[#0862D0]',
  resend: 'bg-primary hover:bg-[#0862D0]',
  edit: 'bg-emerald-600 hover:bg-emerald-700',
  restore: 'bg-primary hover:bg-[#0862D0]',
  archive: 'bg-red-600 hover:bg-red-700',
  releaseCreditHold: 'bg-emerald-600 hover:bg-emerald-700',
  downloadPdf: 'bg-primary hover:bg-[#0862D0]',
};

interface CtaSpec {
  id: string;
  label: string;
  icon: React.ElementType;
}

/** Overlay status for each workflow action (InvoiceTransitionOverlay keys). */
const TRANSITION_TARGET: Partial<Record<string, string>> = {
  submit: 'Pending Approval',
  approve: 'Approved',
  reject: 'Rejected',
  cancel: 'Cancelled',
  archive: 'Archived',
  restore: 'Cancelled',
};

export function CustomerInvoiceDetailScreen({
  invoice,
  allInvoices,
  deposits,
  customers,
  onClose,
  applyAction,
  onRevise,
  onRefundPrepayment,
  onAction,
  onDeleteDraft,
}: CustomerInvoiceDetailScreenProps) {
  const perms = useArPermissions();
  const [activeTab, setActiveTab] = useState<TabKey>('line-items');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [reasonAction, setReasonAction] = useState<ReasonActionId | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmActionId | null>(null);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [transitionOverlay, setTransitionOverlay] = useState<{ visible: boolean; from: string; to: string } | null>(null);
  const [notes, setNotes] = useState<InvoiceNote[]>(() => NOTES_STORE.get(invoice.id) ?? []);

  useEffect(() => {
    // A jump to another document resets the page state.
    setActiveTab('line-items');
    setDescExpanded(false);
    setReasonAction(null);
    setConfirmAction(null);
    setReleaseOpen(false);
    setRefundOpen(false);
    setNotes(NOTES_STORE.get(invoice.id) ?? []);
  }, [invoice.id]);

  const writeNotes = (next: InvoiceNote[]) => {
    NOTES_STORE.set(invoice.id, next);
    setNotes(next);
  };

  // IntersectionObserver-driven header morph (vendor recipe).
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const io = new IntersectionObserver(([entry]) => setIsScrolled(!entry.isIntersecting), { threshold: 0 });
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  const credit = isCreditMemo(invoice);
  const statusLabel = invoiceStatusLabelOf(invoice);
  const statusPalette = STATUS_PALETTE[statusLabel] ?? FALLBACK_PALETTE;
  const typeConfig = CUSTOMER_TYPE_CONFIG[invoice.docKind] ?? CUSTOMER_TYPE_CONFIG.Standalone;
  const TypeIcon = typeConfig.icon;
  const payStatus = invoice.invoiceStatus === 'Approved' ? paymentStatusOf(invoice) : null;
  const payPalette = payStatus ? PAYMENT_PALETTE[payStatus] ?? FALLBACK_PALETTE : FALLBACK_PALETTE;
  const treatment = treatmentOf(invoice);

  // ── Actions: the single-source AR matrix filtered by role (PRD §15,
  // hidden when not allowed), plus the dispute toggle the detail owns. ──
  const actions = useMemo(() => getCustomerRowActionGroups(invoice, perms).flat().filter((a) => a.id !== 'view'), [invoice, perms]);
  const allowed = (id: string) => actions.some((a) => a.id === id);

  // ── Flagship CTAs by state (PRD §14, BR-018, BR-020). ──
  const { primary, secondary } = useMemo((): { primary: CtaSpec | null; secondary: CtaSpec | null } => {
    const s = invoice.invoiceStatus;
    if (invoice.creditHold && !credit && s === 'Approved' && allowed('releaseCreditHold')) {
      return { primary: { id: 'releaseCreditHold', label: 'Release Credit Hold', icon: RotateCcw }, secondary: null };
    }
    switch (s) {
      case 'Draft': {
        const editCta = allowed('edit') ? { id: 'edit', label: 'Edit', icon: Pencil } : null;
        // Drafts always go through approval (10/29): Submit for Approval, never a direct Approve.
        if (allowed('submit')) return { primary: { id: 'submit', label: 'Submit for Approval', icon: Send }, secondary: editCta };
        return { primary: editCta, secondary: null };
      }
      case 'Pending Approval':
        if (allowed('approve')) {
          return {
            primary: { id: 'approve', label: 'Approve', icon: CheckCheck },
            secondary: allowed('reject') ? { id: 'reject', label: 'Send Back', icon: Ban } : null,
          };
        }
        return { primary: allowed('edit') ? { id: 'edit', label: 'Edit', icon: Pencil } : null, secondary: null };
      case 'Approved':
        if (allowed('send')) return { primary: { id: 'send', label: 'Send to Customer', icon: Send }, secondary: null };
        if (allowed('resend')) return { primary: { id: 'resend', label: 'Resend', icon: Send }, secondary: null };
        return { primary: { id: 'downloadPdf', label: 'Download PDF', icon: Download }, secondary: null };
      case 'Rejected':
        return { primary: allowed('edit') ? { id: 'edit', label: 'Edit and Resubmit', icon: RotateCcw } : null, secondary: null };
      case 'Cancelled':
        if (invoice.archived) return { primary: allowed('restore') ? { id: 'restore', label: 'Restore', icon: ArchiveRestore } : null, secondary: null };
        return { primary: allowed('archive') ? { id: 'archive', label: 'Archive', icon: Archive } : null, secondary: null };
      default:
        return { primary: null, secondary: null };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice, perms, actions]);

  const menuActions = useMemo<MenuAction[]>(() => {
    const ctaIds = new Set([primary?.id, secondary?.id].filter(Boolean) as string[]);
    // Dispute and exception toggles live in the shared action matrix (FAD 11/2).
    return actions.filter((a) => !ctaIds.has(a.id)).map((a) => ({ id: a.id, label: a.label }));
  }, [actions, invoice, perms, primary, secondary, credit]);

  // ── Dispatch: the detail owns the workflow dialogs; everything else
  // (edit, send/resend, payments, credit memo, balance invoice,
  // duplicate, PDF) goes to the parent. ──
  const dispatchAction = (actionId: string) => {
    switch (actionId) {
      case 'approve':
        // Vendor parity: an exception holds approval until it is resolved.
        if (invoice.exception) {
          toast.error('Resolve the exception first', { description: `${invoice.invoiceNumber} has an open exception. Resolve it, then approve.` });
          return;
        }
        setConfirmAction(actionId);
        return;
      case 'submit':
      case 'deleteDraft':
        setConfirmAction(actionId);
        return;
      case 'reviseInvoice':
        // Never-disabled rule: the action shows, the click explains the gate.
        if (hasMoneyApplied(invoice)) {
          toast.error('Reverse the payments first', {
            description: `${invoice.invoiceNumber} has receipts, deposits or credits applied. Reverse them, then revise the invoice.`,
          });
          return;
        }
        setReasonAction('reviseInvoice');
        return;
      case 'refundPrepayment':
        setRefundOpen(true);
        return;
      case 'markDisputed':
      case 'resolveDispute':
      case 'flagException':
      case 'resolveException':
        setReasonAction(actionId);
        return;
      case 'releaseCreditHold':
        setReleaseOpen(true);
        return;
      case 'reject':
      case 'cancel':
      case 'archive':
      case 'restore':
      case 'creditHold':
      case 'writeOff':
        setReasonAction(actionId);
        return;
      default:
        onAction(actionId as CustomerInvoiceActionId, invoice.id);
    }
  };

  const playTransition = (action: string) => {
    const to = TRANSITION_TARGET[action];
    if (!to) return;
    setTransitionOverlay({ visible: true, from: statusLabel, to });
  };

  const handleReasonConfirm = (reason: string, notifiedRecipientIds?: string[]) => {
    if (!reasonAction) return;
    const action = reasonAction;
    setReasonAction(null);
    if (action === 'reviseInvoice') {
      onRevise?.(invoice.id, reason, notifiedRecipientIds);
      return;
    }
    applyAction([invoice.id], action, reason, notifiedRecipientIds);
    const noun = sentenceNounOf(invoice);
    const text: Record<Exclude<ReasonActionId, 'reviseInvoice'>, string> = {
      reject: `${noun} sent back`,
      cancel: `${noun} cancelled`,
      archive: `${noun} archived`,
      restore: `${noun} restored`,
      creditHold: 'Placed on credit hold',
      writeOff: `${fmtMoney(netDue(invoice))} written off to bad debt`,
      markDisputed: 'Flagged as disputed',
      resolveDispute: 'Dispute resolved',
      flagException: 'Flagged as exception',
      resolveException: 'Exception resolved',
    };
    toast.success(text[action], action === 'restore' ? { description: `${invoice.invoiceNumber} is back to Cancelled.` } : undefined);
    playTransition(action);
  };

  const handleConfirm = (action: ConfirmActionId) => {
    setConfirmAction(null);
    if (action === 'deleteDraft') {
      // The parent removes the record, navigates away and confirms.
      onDeleteDraft(invoice.id);
      return;
    }
    const result = applyAction([invoice.id], action, '');
    // Approve-time duplicate check (FAD 11/2): the hook already said why.
    if (result && result.blocked.includes(invoice.id)) return;
    toast.success(CONFIRM_CONFIG[action].toastText(invoice), { description: TRANSITION_TARGET[action] ? `${invoice.invoiceNumber} is now ${TRANSITION_TARGET[action]}.` : undefined });
    playTransition(action);
  };

  const descriptionText = invoice.description ?? '';
  const descNeedsTruncation = descriptionText.length > 140;

  const linkedCount = (() => {
    const counts: string[] = [];
    if (invoice.linkedSOs.length) counts.push(`${invoice.linkedSOs.length} SO${invoice.linkedSOs.length === 1 ? '' : 's'}`);
    if (invoice.linkedShipments.length) counts.push(`${invoice.linkedShipments.length} Shipment${invoice.linkedShipments.length === 1 ? '' : 's'}`);
    if (invoice.quoteNumber) counts.push('1 Quote');
    const memoCount = credit ? 0 : creditMemosFor(invoice.invoiceNumber, allInvoices).length;
    if (memoCount) counts.push(`${memoCount} Credit Memo${memoCount === 1 ? '' : 's'}`);
    return counts;
  })();

  const pillStyle = (p: PillPalette): React.CSSProperties => ({
    padding: isScrolled ? '1px 6px' : '2px 8px',
    fontSize: isScrolled ? 10 : 11,
    fontWeight: 600,
    backgroundColor: p.bg,
    color: p.color,
    borderColor: p.border,
  });

  // ── Banners: blocked or terminal states replay their reason. ──
  const banners: BannerSpec[] = [];
  const history = invoice.actionHistory ?? [];
  const rejectEntry = lastEntry(history, 'reject');
  if (invoice.invoiceStatus === 'Rejected') {
    banners.push({
      key: 'rejected',
      title: `${titleNounOf(invoice)} sent back, fix the issue and resubmit`,
      icon: Ban,
      iconBg: '#FEF2F2',
      iconColor: '#DC2626',
      border: '#FECACA',
      reason: invoice.rejectionReason ?? rejectEntry?.reason,
      by: rejectEntry?.by,
      at: rejectEntry?.at,
      fallback: 'No reason was recorded when this was sent back.',
      cta: allowed('edit')
        ? { label: 'Edit and Resubmit', icon: RotateCcw, className: 'border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400', onClick: () => dispatchAction('edit') }
        : undefined,
    });
  } else if (invoice.rejectionReason) {
    // BR-019: the reason stays on the invoice after resubmitting.
    banners.push({
      key: 'sent-back-earlier',
      title: 'Sent back earlier',
      icon: Ban,
      iconBg: '#F1F5F9',
      iconColor: '#64748B',
      border: '#E2E8F0',
      reason: invoice.rejectionReason,
      by: rejectEntry?.by,
      at: rejectEntry?.at,
      fallback: '',
    });
  }
  if (invoice.invoiceStatus === 'Cancelled') {
    const archiveEntry = lastEntry(history, 'archive');
    const cancelEntry = lastEntry(history, 'cancel');
    banners.push(
      invoice.archived
        ? {
            key: 'archived',
            title: `${titleNounOf(invoice)} archived`,
            icon: Archive,
            iconBg: '#FEF2F2',
            iconColor: '#DC2626',
            border: '#FECACA',
            reason: archiveEntry?.reason,
            by: archiveEntry?.by,
            at: archiveEntry?.at,
            fallback: 'This cancelled record was archived. Restore brings it back as Cancelled.',
          }
        : {
            key: 'cancelled',
            title: `${titleNounOf(invoice)} cancelled`,
            icon: XCircle,
            iconBg: '#FEF2F2',
            iconColor: '#DC2626',
            border: '#FECACA',
            reason: cancelEntry?.reason,
            by: cancelEntry?.by,
            at: cancelEntry?.at,
            fallback: 'No reason was recorded when this was cancelled.',
          },
    );
  }
  if (invoice.creditHold) {
    const e = lastEntry(history, 'creditHold');
    banners.push({
      key: 'credit-hold',
      title: 'On credit hold',
      icon: Lock,
      iconBg: '#FEFCE8',
      iconColor: '#A16207',
      border: '#FEF08A',
      reason: e?.reason,
      by: e?.by,
      at: e?.at,
      fallback: 'No reason was recorded when the hold was placed.',
      cta: allowed('releaseCreditHold')
        ? { label: 'Release Hold', icon: RotateCcw, className: 'border-yellow-300 text-yellow-700 hover:bg-yellow-50 hover:border-yellow-400', onClick: () => dispatchAction('releaseCreditHold') }
        : undefined,
    });
  }
  if (invoice.supersededById) {
    // Revise (FAD 11/2): the replaced version points at its successor.
    const successor = allInvoices.find((i) => i.id === invoice.supersededById);
    const e = lastEntry(history, 'revised');
    banners.push({
      key: 'revised',
      title: successor ? `Replaced by ${successor.invoiceNumber}` : 'Replaced by a newer version',
      icon: History,
      iconBg: '#F1F5F9',
      iconColor: '#475569',
      border: '#E2E8F0',
      chip: 'Revised',
      reason: e?.reason?.split(' · Replaced by')[0],
      by: e?.by,
      at: e?.at,
      fallback: 'This version was reversed and stays in history. Work on the newer version.',
      cta: successor
        ? { label: `Open ${successor.invoiceNumber}`, icon: Link2, className: 'border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400', onClick: () => openInvoiceTab(successor.invoiceNumber) }
        : undefined,
    });
  }
  if (invoice.revisedFromId) {
    const prior = allInvoices.find((i) => i.id === invoice.revisedFromId);
    const e = lastEntry(history, 'revisedFrom');
    banners.push({
      key: 'revised-from',
      title: prior ? `Revision of ${prior.invoiceNumber}` : 'Revision of an earlier version',
      icon: FilePenLine,
      iconBg: '#EFF6FF',
      iconColor: '#1D4ED8',
      border: '#BFDBFE',
      chip: `Version ${invoice.revision ?? 2}`,
      reason: e?.reason,
      by: e?.by,
      at: e?.at,
      fallback: 'The earlier version was reversed when this one opened.',
      cta: prior
        ? { label: `Open ${prior.invoiceNumber}`, icon: Link2, className: 'border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300', onClick: () => openInvoiceTab(prior.invoiceNumber) }
        : undefined,
    });
  }
  if (invoice.exception) {
    const ex = invoice.exception;
    banners.push({
      key: 'exception',
      title: invoice.invoiceStatus === 'Pending Approval' || invoice.invoiceStatus === 'Draft' ? 'Exception, resolve it before approval' : 'Exception on this invoice',
      icon: AlertTriangle,
      iconBg: '#FFFBEB',
      iconColor: '#B45309',
      border: '#FDE68A',
      reason: ex.reason,
      by: ex.by,
      at: ex.at,
      fallback: 'Something on this invoice needs a look.',
      cta: allowed('resolveException')
        ? { label: 'Resolve Exception', icon: CheckCircle2, className: 'border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400', onClick: () => dispatchAction('resolveException') }
        : undefined,
    });
  }
  if (invoice.disputed) {
    const e = invoice.disputeDetail ?? lastEntry(history, 'markDisputed');
    banners.push({
      key: 'disputed',
      title: 'Disputed by the customer',
      icon: Flag,
      iconBg: '#FFF1F2',
      iconColor: '#BE123C',
      border: '#FECDD3',
      reason: e?.reason,
      by: e?.by,
      at: e?.at,
      fallback: 'The customer is contesting this invoice.',
      cta: allowed('resolveDispute')
        ? { label: 'Resolve Dispute', icon: ShieldCheck, className: 'border-rose-300 text-rose-600 hover:bg-rose-50 hover:border-rose-400', onClick: () => dispatchAction('resolveDispute') }
        : undefined,
    });
  }
  if (invoice.writtenOff) {
    const e = lastEntry(history, 'writeOff');
    // FAD 11/2: the banner names the amount moved to bad debt.
    const title = invoice.writeOffAmount !== undefined ? `${fmtMoney(invoice.writeOffAmount)} moved to bad debt` : 'Balance written off';
    banners.push({ key: 'written-off', title, icon: Eraser, iconBg: '#F1F5F9', iconColor: '#475569', border: '#E2E8F0', reason: e?.reason, by: e?.by, at: e?.at, fallback: 'The remaining balance was written off to bad debt.' });
  }
  if (invoice.prepaymentReversal) {
    const pr = invoice.prepaymentReversal;
    banners.push({
      key: 'prepayment-reversal',
      title: pr.mode === 'reverse'
        ? `${fmtMoney(pr.amount)} reversed and refunded, units released`
        : `${fmtMoney(pr.amount)} prepayment refunded`,
      icon: Undo2,
      iconBg: '#FFF1F2',
      iconColor: '#BE123C',
      border: '#FECDD3',
      reason: pr.reason,
      by: pr.by,
      at: pr.at,
      fallback: '',
    });
  }
  const lastSend = [...(invoice.sendLog ?? [])].sort((a, b) => (a.at < b.at ? 1 : -1))[0];
  if (lastSend?.outcome === 'failed' && invoice.invoiceStatus === 'Approved') {
    banners.push({
      key: 'send-failed',
      title: 'The last send failed',
      icon: MailX,
      iconBg: '#FEF2F2',
      iconColor: '#DC2626',
      border: '#FECACA',
      chip: 'Error',
      reason: `The invoice could not be sent to ${lastSend.to.join(', ')}. Check the email address and try again.`,
      at: lastSend.at,
      fallback: '',
      cta: allowed('send') || allowed('resend')
        ? { label: 'Try Again', icon: Send, className: 'border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400', onClick: () => dispatchAction(allowed('send') ? 'send' : 'resend') }
        : undefined,
    });
  }

  const reasonSpec = reasonAction ? reasonDialogSpec(reasonAction, invoice) : null;
  // Revise (FAD 11/2): the confirm shows the posting it reverses.
  const reviseReversalRows = reasonAction === 'reviseInvoice'
    ? postedLinesOf(invoice, allInvoices, customers).map((l) => {
        const { code, name } = splitGlAccount(l.account);
        return { code, name, debit: l.credit ?? 0, credit: l.debit ?? 0 };
      })
    : undefined;
  const holdEntry = lastEntry(history, 'creditHold');

  return (
    <div ref={scrollContainerRef} className="flex-1 flex flex-col bg-slate-50">
      {/* IntersectionObserver sentinel, sits just below the topbar */}
      <div ref={sentinelRef} className="shrink-0 h-px" />

      {/* ══════════════════════════════════════════════
          STICKY MORPHING HEADER CARD (vendor recipe)
         ══════════════════════════════════════════════ */}
      <div className="shrink-0 sticky top-0 z-30 bg-slate-50">
        <div style={{ paddingTop: isScrolled ? '8px' : '12px', paddingBottom: '4px', transition: 'padding-top 250ms ease' }}>
          <div className={`mx-auto px-3 transition-all duration-300 ${isFullscreen ? 'max-w-full' : 'max-w-[1440px] 2xl:max-w-[1600px]'}`}>
            <div
              className={`border rounded-xl overflow-hidden transition-shadow duration-250 ${
                isScrolled ? 'shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_4px_12px_-4px_rgba(0,0,0,0.05)]' : 'shadow-sm'
              }`}
              style={headerCardStyle(statusLabel)}
            >
              {/* Main header row */}
              <div
                className="flex items-center justify-between gap-4 px-4 lg:px-5 transition-all duration-250 ease-in-out"
                style={{ padding: isScrolled ? '6px 16px' : '12px 16px' }}
              >
                {/* Left: Back + Tile + Info */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    onClick={onClose}
                    className="rounded-xl border border-border bg-white hover:bg-slate-50 flex items-center justify-center shrink-0 cursor-pointer shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] transition-all duration-250"
                    style={{ width: isScrolled ? 32 : 44, height: isScrolled ? 32 : 44 }}
                    aria-label="Back to customer invoices"
                  >
                    <ChevronLeft className="text-slate-400 transition-all duration-250" style={{ width: isScrolled ? 16 : 20, height: isScrolled ? 16 : 20 }} />
                  </button>

                  {/* Avatar tile: the listing type pill's icon + colors. */}
                  <div
                    className="rounded-xl flex items-center justify-center shrink-0 transition-all duration-250"
                    style={{
                      width: isScrolled ? 32 : 44,
                      height: isScrolled ? 32 : 44,
                      backgroundColor: typeConfig.bg,
                      border: `1px ${typeConfig.dashed ? 'dashed' : 'solid'} ${typeConfig.border}`,
                      boxShadow: '0 1px 3px 0 rgba(0,0,0,0.04)',
                    }}
                  >
                    <TypeIcon className="transition-all duration-250" style={{ width: isScrolled ? 14 : 18, height: isScrolled ? 14 : 18, color: typeConfig.fg }} />
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* Line 1: number, type, customer, status, linked records */}
                    <div className="flex items-center flex-wrap" style={{ gap: isScrolled ? 6 : 8 }}>
                      <h1
                        className="text-foreground truncate transition-all duration-250 "
                        style={{ fontSize: isScrolled ? 13 : 16, fontWeight: isScrolled ? 600 : 700, lineHeight: isScrolled ? '18px' : '22px' }}
                      >
                        {invoice.invoiceNumber}
                      </h1>

                      <span
                        className={`inline-flex items-center gap-1 rounded-md transition-all duration-250 cursor-default ${typeConfig.dashed ? 'border border-dashed' : 'border'}`}
                        style={{
                          padding: isScrolled ? '1px 6px' : '2px 8px',
                          fontSize: isScrolled ? 10 : 11,
                          fontWeight: 600,
                          backgroundColor: typeConfig.bg,
                          color: typeConfig.fg,
                          borderColor: typeConfig.border,
                        }}
                      >
                        <TypeIcon className="transition-all duration-250" style={{ width: isScrolled ? 10 : 12, height: isScrolled ? 10 : 12 }} />
                        {typeConfig.label}
                      </span>

                      {/* Revenue treatment (Mahreen 11/4): on invoice or on shipment, hover explains. */}
                      {treatment && (
                        <HoverCard openDelay={200} closeDelay={120}>
                          <HoverCardTrigger asChild>
                            <span
                              className="inline-flex items-center rounded-md border transition-all duration-250 cursor-default"
                              style={{
                                padding: isScrolled ? '1px 6px' : '2px 8px',
                                fontSize: isScrolled ? 10 : 11,
                                fontWeight: 500,
                                backgroundColor: TREATMENT_TONES[treatment].bg,
                                color: TREATMENT_TONES[treatment].fg,
                                borderColor: TREATMENT_TONES[treatment].border,
                              }}
                            >
                              {TREATMENT_LABEL[treatment]}
                            </span>
                          </HoverCardTrigger>
                          <HoverCardContent side="bottom" align="start" sideOffset={6} className="w-[280px] p-0 rounded-xl border border-border/60 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[300]">
                            <div className="px-3.5 py-2.5 border-b border-border/50" style={{ backgroundColor: TREATMENT_TONES[treatment].bg }}>
                              <p className="text-[13px]" style={{ fontWeight: 500, color: TREATMENT_TONES[treatment].fg }}>{TREATMENT_LABEL[treatment]}</p>
                            </div>
                            <div className="px-3.5 py-3 space-y-2 bg-white">
                              <p className="text-[12px] text-slate-700 leading-snug">
                                {TREATMENT_HELPER[treatment]} Locked once posted.
                              </p>
                              <p className="text-[11px] text-slate-500 leading-snug">
                                {treatment === 'Revenue'
                                  ? 'Payments settle this invoice. Shipments use the locked units and post no new revenue.'
                                  : 'Payments go to customer prepayment. Revenue posts for what ships, and the prepayment is applied.'}
                              </p>
                              {invoice.treatmentNote && (
                                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5 leading-snug">{invoice.treatmentNote}</p>
                              )}
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      )}

                      {/* Customer pill: Partners in a new tab, quick card on hover. */}
                      <HoverCard openDelay={300} closeDelay={120}>
                        <HoverCardTrigger asChild>
                          <button
                            type="button"
                            onClick={() => window.open(partnerVendorUrl(invoice.customer), '_blank', 'noopener,noreferrer')}
                            className="inline-flex items-center gap-1 rounded-md border bg-white hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 cursor-pointer"
                            style={{
                              padding: isScrolled ? '1px 6px 1px 4px' : '2px 8px 2px 4px',
                              fontSize: isScrolled ? 10 : 11,
                              fontWeight: 600,
                              color: 'hsl(var(--primary))',
                              borderColor: 'hsl(var(--border))',
                            }}
                          >
                            <VendorAvatar name={invoice.customer} size="xs" />
                            <span className="truncate max-w-[180px]">{invoice.customer}</span>
                          </button>
                        </HoverCardTrigger>
                        <HoverCardContent
                          side="bottom"
                          align="start"
                          sideOffset={6}
                          className="p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden w-auto"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <CustomerQuickCard customer={invoice.customer} description={invoice.description} />
                        </HoverCardContent>
                      </HoverCard>

                      {/* Status pills, two axes like the vendor header:
                          approval (with flags beside it) and payment. */}
                      <span className="inline-flex items-center rounded-full border" style={pillStyle(statusPalette)}>
                        {statusLabel === 'Pending Approval' ? 'Pending Approval' : statusLabel}
                      </span>
                      {invoice.creditHold && (
                        <span className="inline-flex items-center gap-1 rounded-full border" style={pillStyle(CREDIT_HOLD_PALETTE)}>
                          <Lock style={{ width: isScrolled ? 9 : 11, height: isScrolled ? 9 : 11 }} />
                          On Credit Hold
                        </span>
                      )}
                      {invoice.sentAt && (
                        <span className="inline-flex items-center gap-1 rounded-full border" style={pillStyle(SENT_PALETTE)}>
                          <Mail style={{ width: isScrolled ? 9 : 11, height: isScrolled ? 9 : 11 }} />
                          Sent {formatUsDate(invoice.sentAt)}
                        </span>
                      )}
                      {invoice.disputed && (
                        <span className="inline-flex items-center rounded-full border" style={pillStyle(DISPUTED_PALETTE)}>
                          Disputed
                        </span>
                      )}
                      {invoice.exception && !showsExceptionStatus(invoice) && (
                        <span className="inline-flex items-center rounded-full border" style={pillStyle(EXCEPTION_PALETTE)}>
                          Exception
                        </span>
                      )}
                      {payStatus && payStatus !== 'Cancelled' && (
                        <span className="inline-flex items-center rounded-full border" style={pillStyle(payPalette)}>
                          {payStatus === 'Paid' ? 'Paid in Full' : payStatus}
                        </span>
                      )}

                      {!isScrolled && linkedCount.length > 0 && (
                        <SegmentedCountPill
                          segments={linkedCount}
                          icon={Link2}
                          onClick={() => setActiveTab('linked-records')}
                          title="Open the Linked Records tab"
                        />
                      )}
                    </div>

                    {/* Row 2: description block with show more/less. */}
                    {descriptionText && (
                      <div
                        className="overflow-hidden transition-all duration-250 ease-in-out max-w-3xl relative"
                        style={{ maxHeight: isScrolled ? 0 : descExpanded ? 500 : 20, opacity: isScrolled ? 0 : 1, marginTop: isScrolled ? 0 : 4 }}
                      >
                        <p className="text-[12px] text-slate-500 leading-[1.6]">
                          {descExpanded || !descNeedsTruncation ? descriptionText : `${descriptionText.slice(0, 140)}…`}
                          {descExpanded && descNeedsTruncation && (
                            <>
                              {' '}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setDescExpanded(false); }}
                                className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:text-[#0862D0] cursor-pointer align-baseline"
                                style={{ fontWeight: 500 }}
                              >
                                Show less <ChevronUp className="w-3 h-3 inline" />
                              </button>
                            </>
                          )}
                        </p>
                        {!descExpanded && descNeedsTruncation && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setDescExpanded(true); }}
                            className="absolute right-0 bottom-0 bg-gradient-to-l from-white via-white to-transparent pl-6 pr-0 inline-flex items-center gap-0.5 text-[11px] text-primary hover:text-[#0862D0] cursor-pointer"
                            style={{ fontWeight: 500, lineHeight: '20px' }}
                          >
                            more <ChevronDown className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Fullscreen + Actions + secondary + primary CTA */}
                <div className="flex items-center shrink-0 transition-all duration-250" style={{ gap: isScrolled ? 6 : 8 }}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="rounded-lg border border-border bg-white hover:bg-slate-50 flex items-center justify-center cursor-pointer shadow-sm transition-all duration-250"
                        style={{ width: isScrolled ? 32 : 36, height: isScrolled ? 32 : 36 }}
                      >
                        {isFullscreen ? (
                          <Minimize2 className="text-slate-500 transition-all duration-250" style={{ width: isScrolled ? 14 : 16, height: isScrolled ? 14 : 16 }} />
                        ) : (
                          <Maximize2 className="text-slate-500 transition-all duration-250" style={{ width: isScrolled ? 14 : 16, height: isScrolled ? 14 : 16 }} />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="z-[300]">{isFullscreen ? 'Exit Full Screen' : 'Full Screen'}</TooltipContent>
                  </Tooltip>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={`rounded-lg border border-border bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm ${isScrolled ? 'h-8 px-3 text-[12px]' : 'h-9 px-3.5 text-[13px]'}`}
                        style={{ fontWeight: 500 }}
                      >
                        Actions
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="z-[200] w-56">
                      {menuActions.length === 0 ? (
                        <div className="px-3 py-2 text-[12px] text-slate-400">No actions available.</div>
                      ) : (
                        groupDetailActions(menuActions).map((group, gi) => (
                          <Fragment key={gi}>
                            {gi > 0 && <DropdownMenuSeparator />}
                            {group.map((action) => {
                              const cat = detailActionCategory(action.id);
                              const isAffirmative =
                                action.id === 'approve' || action.id === 'releaseCreditHold' || action.id === 'restore' || action.id === 'resolveDispute' || action.id === 'resolveException';
                              const tone: ActionTone =
                                cat === 'destructive'
                                  ? 'destructive'
                                  : action.id === 'creditHold' || action.id === 'markDisputed' || action.id === 'flagException'
                                    ? 'warning'
                                    : isAffirmative
                                      ? 'positive'
                                      : 'neutral';
                              const cls = actionToneClass(tone);
                              const Icon = ACTION_ICONS[action.id] ?? FileText;
                              return (
                                <DropdownMenuItem key={action.id} onClick={() => dispatchAction(action.id)} className={cls.item}>
                                  <Icon className={`w-4 h-4 mr-2 ${cls.icon}`} />
                                  {action.label}
                                </DropdownMenuItem>
                              );
                            })}
                          </Fragment>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Send Back sits beside Approve while pending (vendor
                      Reject recipe); a draft's Edit takes the neutral
                      outline. */}
                  {secondary && (() => {
                    const SIcon = secondary.icon;
                    const tone = secondary.id === 'reject'
                      ? 'bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300'
                      : 'bg-white border border-border text-slate-700 hover:bg-slate-50';
                    return (
                      <button
                        onClick={() => dispatchAction(secondary.id)}
                        className={`rounded-lg ${tone} inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm ${isScrolled ? 'h-8 px-3.5 text-[12px]' : 'h-9 px-4 text-[13px]'}`}
                        style={{ fontWeight: 600 }}
                      >
                        <SIcon className={isScrolled ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                        {secondary.label}
                      </button>
                    );
                  })()}

                  {primary && (() => {
                    const PIcon = primary.icon;
                    const tone = PRIMARY_CTA_TONE[primary.id] ?? 'bg-primary hover:bg-[#0862D0]';
                    return (
                      <button
                        onClick={() => dispatchAction(primary.id)}
                        className={`rounded-lg ${tone} text-white inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm ${isScrolled ? 'h-8 px-3.5 text-[12px]' : 'h-9 px-4 text-[13px]'}`}
                        style={{ fontWeight: 600 }}
                      >
                        <PIcon className={isScrolled ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                        {primary.label}
                      </button>
                    );
                  })()}
                </div>
              </div>

              {/* Status workflow bar, hidden in compact mode */}
              <div
                className="overflow-hidden transition-all duration-250 ease-in-out border-t border-muted"
                style={{ maxHeight: isScrolled ? 0 : 80, opacity: isScrolled ? 0 : 1 }}
              >
                <StatusWorkflowBar invoice={invoice} />
              </div>

              {/* Tab bar, always visible at the bottom of the card */}
              <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide border-t border-muted px-4 lg:px-5">
                {TABS.map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex items-center gap-1.5 px-3.5 border-b-2 transition-all duration-200 whitespace-nowrap cursor-pointer ${
                        isActive ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                      }`}
                      style={{
                        padding: isScrolled ? '8px 14px' : '10px 14px',
                        fontSize: isScrolled ? 12 : 13,
                        fontWeight: isActive ? 600 : 400,
                        transition: 'padding 250ms ease, font-size 250ms ease',
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        {/* Bottom gradient fade */}
        <div
          className="pointer-events-none transition-opacity duration-300"
          style={{
            height: 8,
            background: 'linear-gradient(to bottom, rgba(248,250,252,0.8) 0%, rgba(248,250,252,0.4) 40%, rgba(248,250,252,0) 100%)',
            opacity: isScrolled ? 1 : 0,
          }}
        />
      </div>

      {/* ── Scroll to top FAB ── */}
      <button
        onClick={() => {
          let el: HTMLElement | null = scrollContainerRef.current;
          while (el) {
            const style = window.getComputedStyle(el);
            if (style.overflowY === 'auto' || style.overflowY === 'scroll') break;
            el = el.parentElement;
          }
          (el || window).scrollTo({ top: 0, behavior: 'smooth' });
        }}
        className="fixed bottom-6 right-6 z-40 rounded-full bg-white border border-border shadow-[0_2px_12px_-3px_rgba(0,0,0,0.12),0_4px_16px_-4px_rgba(0,0,0,0.08)] flex items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-slate-300 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15)] active:scale-95 transition-all duration-300"
        style={{
          width: 40,
          height: 40,
          opacity: isScrolled ? 1 : 0,
          transform: isScrolled ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.9)',
          pointerEvents: isScrolled ? 'auto' : 'none',
        }}
        aria-label="Scroll to top"
      >
        <ChevronUp className="w-5 h-5 text-slate-500" />
      </button>

      {/* ══════════════════════════════════════════════
          BODY
         ══════════════════════════════════════════════ */}
      <div className="flex-1">
        <div className={`mx-auto px-3 pt-3 pb-3 transition-all duration-300 ${isFullscreen ? 'max-w-full' : 'max-w-[1440px] 2xl:max-w-[1600px]'}`}>
          <div className="flex gap-4 items-start">
            {/* ── LEFT: tab content ── */}
            <div className="flex-1 min-w-0 space-y-4">
              {banners.map((b) => (
                <StatusReasonBanner key={b.key} banner={b} />
              ))}

              {activeTab === 'line-items' && <CustomerLineItemsTab invoice={invoice} allInvoices={allInvoices} />}
              {activeTab === 'linked-records' && (
                <CustomerLinkedRecordsTab invoice={invoice} allInvoices={allInvoices} deposits={deposits} customers={customers} />
              )}
              {activeTab === 'payments' && <CustomerPaymentsTab invoice={invoice} allInvoices={allInvoices} deposits={deposits} />}
              {activeTab === 'gl-impact' && <CustomerGLImpactTab invoice={invoice} allInvoices={allInvoices} customers={customers} />}
              {activeTab === 'notes' && (
                <CustomerNotesTab
                  notes={notes}
                  recordNoun={nounOf(invoice)}
                  onAddNote={(text) =>
                    writeNotes([{ id: `note-${Date.now()}`, text, author: AR_ACTING_USER, createdAt: new Date().toISOString() }, ...notes])
                  }
                  onUpdateNote={(noteId, text) =>
                    writeNotes(notes.map((n) => (n.id === noteId ? { ...n, text, updatedAt: new Date().toISOString() } : n)))
                  }
                  onDeleteNote={(noteId) => writeNotes(notes.filter((n) => n.id !== noteId))}
                />
              )}
              {activeTab === 'communication' && <CustomerCommunicationsTab invoice={invoice} />}
              {activeTab === 'attachments' && <AttachmentsTab customerInvoice={invoice} />}
              {activeTab === 'activity' && <CustomerActivityTab invoice={invoice} />}
            </div>

            {/* ── RIGHT: sticky sidebar, visible across every tab ── */}
            <CustomerDetailSidebar invoice={invoice} allInvoices={allInvoices} customers={customers} statusLabel={statusLabel} statusPalette={statusPalette} />
          </div>
        </div>
      </div>

      {/* ── Dialogs owned by this screen ── */}
      <InvoiceReasonDialog
        open={!!reasonAction}
        onOpenChange={(open) => {
          if (!open) setReasonAction(null);
        }}
        action={reasonSpec?.base ?? null}
        count={1}
        currentStatus={statusLabel}
        configOverride={reasonSpec?.override}
        glReversal={reasonAction === 'reviseInvoice' ? reviseReversalRows : undefined}
        onConfirm={handleReasonConfirm}
      />
      <CustomerConfirmDialog
        action={confirmAction}
        invoice={invoice}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
        onConfirm={handleConfirm}
      />
      {/* Release credit hold: the shared vendor ReleaseHoldDialog. */}
      <ReleaseHoldDialog
        open={releaseOpen}
        onOpenChange={setReleaseOpen}
        description="The invoice can be sent and take money again. Its approval status doesn't change."
        holdBy={holdEntry?.by}
        holdAt={holdEntry?.at}
        seedRecipientIds={holdEntry?.notifiedRecipientIds ?? []}
        onConfirm={({ notes: releaseNotes, recipientIds, recipientNames }) => {
          applyAction([invoice.id], 'releaseCreditHold', releaseNotes, recipientIds);
          setReleaseOpen(false);
          toast.success('Credit hold released', {
            description: recipientNames.length > 0
              ? `Release notification sent to ${recipientNames.slice(0, 2).join(', ')}${recipientNames.length > 2 ? ` +${recipientNames.length - 2} more` : ''}.`
              : undefined,
          });
        }}
      />
      {/* Refund or reverse the prepayment (FAD 11/2), detail-local like the vendor reversal. */}
      {invoice.docKind === 'Advance Invoice' && (
        <RefundPrepaymentModal
          open={refundOpen}
          onOpenChange={setRefundOpen}
          invoice={invoice}
          deposits={deposits.filter((d) => d.preInvoiceNumber === invoice.invoiceNumber)}
          onSubmit={(payload) => {
            onRefundPrepayment?.(invoice.id, payload);
            toast.success(treatment === 'Revenue' ? 'Reversed and refunded' : 'Prepayment refunded', {
              description: `${fmtMoney(payload.amount)} returns to ${invoice.customer}.`,
            });
          }}
        />
      )}
      {/* Status-change transition animation (vendor overlay). */}
      <InvoiceTransitionOverlay
        visible={!!transitionOverlay?.visible}
        fromStatus={transitionOverlay?.from || statusLabel}
        toStatus={transitionOverlay?.to || statusLabel}
        duration={1200}
        onDismiss={() => setTransitionOverlay((s) => (s ? { ...s, visible: false } : null))}
      />
    </div>
  );
}
