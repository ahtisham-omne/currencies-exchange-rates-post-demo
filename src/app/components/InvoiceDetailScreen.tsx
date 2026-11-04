import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  FileText,
  Pencil,
  Maximize2,
  Minimize2,
  Check,
  CheckCircle2,
  CheckCheck,
  Ban,
  Banknote,
  Clock,
  Receipt,
  RotateCcw,
  Undo2,
  Archive,
  ArchiveRestore,
  Link2,
  X,
  XCircle,
  Lock,
  ShieldAlert,
  Truck,
  Calculator,
  Package,
  AlertTriangle,
  Printer,
  Download,
  Wallet,
  Paperclip,
  Upload,
  StickyNote,
  MessageSquare,
  History,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/app/components/ui/dialog';
import { ReleaseHoldDialog } from '@/app/components/ReleaseHoldDialog';
import { downloadRemittanceAdvice } from '@/app/lib/remittanceAdvice';
import { DiscardConfirm } from '@/app/components/ui/discard-guard';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { VendorQuickCard, TYPE_EXPLAINER, TooltipExplainer, statusDisplayLabel } from './InvoiceDataTable';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Switch } from '@/app/components/ui/switch';
import { Invoice, mockInvoices } from '@/app/data/mockInvoices';
import { SYSTEM_USERS, SYSTEM_ROLES } from '@/app/data/systemUsers';
import { mockVendors, partnerVendorUrl } from '@/app/data/mockVendors';
import { toast } from 'sonner';
import { InvoiceReasonDialog, type ReasonAction } from '@/app/components/InvoiceReasonDialog';
import { SearchableUserPicker, NotifyToggleCard } from '@/app/components/vendors/SearchableUserPicker';
import { actionToneClass, type ActionTone } from '@/app/lib/actionMenuTone';
import { AddCreditMemoModal } from './invoice-details/AddCreditMemoModal';
import { openRunInvoiceIds, type PaymentRun } from '@/app/data/paymentRuns';
import { ReversePaymentModal, type PaymentRecord } from './invoice-details/ReversePaymentModal';
import { InvoiceTransitionOverlay } from './invoice-details/InvoiceTransitionOverlay';
import { VendorAvatar } from '@/app/components/VendorAvatar';
import { LineItemsTab } from './invoice-details/LineItemsTab';
import { InvoiceDocumentModal } from './invoice-details/InvoiceDocumentModal';
import { NotesTab, type InvoiceNote } from './invoice-details/NotesTab';
import { CommunicationTab } from './invoice-details/CommunicationTab';
import { ActivityTab } from './invoice-details/ActivityTab';
import { LinkedRecordsTab } from './invoice-details/LinkedRecordsTab';
import { GLImpactTab } from './invoice-details/GLImpactTab';
import { getLinkedFinancials, getLinkedProcurement, countsTowardBalance, LinkedFinancialRecord } from '@/app/data/invoiceLinkedRecords';
import { Payment, mockPayments } from '@/app/data/mockPayments';
import { SEED_RUN_PAYMENTS } from '@/app/data/paymentRuns';
import { reversiblePaymentsFrom, reversedRefsFromHistory } from '@/app/lib/reversiblePayments';
import type { CreditMemo } from '@/app/data/creditMemos';
import { formatUsDate, overdueDaysOf, parseDateOnly, todayAtMidnight } from '@/app/lib/dueBucket';
import { PaymentsTab } from './invoice-details/PaymentsTab';
import { AttachmentsTab } from './invoice-details/AttachmentsTab';
import { ComingSoonTab } from './invoice-details/ComingSoonTab';
import { InvoiceDetailSidebar } from './invoice-details/InvoiceDetailSidebar';
import { SegmentedCountPill } from '@/app/components/SegmentedCountPill';

interface InvoiceDetailScreenProps {
  invoiceId: string;
  onClose: () => void;
  invoices: Invoice[];
  /** App-level payment records — feeds the Payments tab so drafts,
   *  scheduled payments and prepayments against this invoice are visible. */
  payments?: Payment[];
  /** Open payment runs (Eli 9/24 R06): an invoice reserved in one reads
   *  "In Payment Run" here too and offers View payment run instead of an
   *  Add Payment that would open an empty form. */
  runs?: PaymentRun[];
  onViewRun?: (runId: string) => void;
  /** Invoice notes (GPT QC02): App-state records keyed by invoice id,
   *  same session-persistence pattern as credit memos. */
  notes?: InvoiceNote[];
  onAddNote?: (invoiceId: string, text: string) => void;
  onUpdateNote?: (invoiceId: string, noteId: string, text: string) => void;
  onDeleteNote?: (invoiceId: string, noteId: string) => void;
  /** Central invoice-status mutation (shared with the listing page) so
   *  Approve / Reject / Flag / Resolve / Hold / Release persist to the
   *  App-level invoices state. */
  applyInvoiceAction?: (
    invoiceIds: string[],
    action:
      | 'submit'
      | 'approve'
      | 'reject'
      | 'cancel'
      | 'uncancel'
      | 'paymentHold'
      | 'flagException'
      | 'resolve'
      | 'releaseHold'
      | 'archive'
      | 'restore',
    reason: string,
    notifiedRecipientIds?: string[],
    attachments?: string[],
  ) => void;
  /** Settle invoice balances in App state — a credit memo that covers
   *  the full remaining balance settles the invoice for real, not just
   *  as a local display override (feedback 7/21/26). via 'credit' lands
   *  on the Settled status (zeroed without cash). */
  onSettleInvoices?: (allocations: { invoiceId: string; applied: number }[], opts?: { via?: 'credit' }) => void;
  /** Launch the Record Payment flow pre-scoped to these invoices. */
  onPayInvoices?: (invoiceIds: string[]) => void;
  /** Launch the Record Prepayment flow seeded from this pre-invoice. */
  onAddPrepayment?: (vendor: string, preInvoiceId?: string) => void;
  /** Edit-and-resubmit a rejected invoice — opens the creation modal
   *  prefilled from the invoice, with the rejection reason replayed in
   *  a banner (feedback 7/15/26). */
  onEditResubmit?: (invoice: Invoice, reason: string, notifyRecipientIds?: string[]) => void;
  /** Reverses a payment at App level — retires the payment record,
   *  restores EVERY invoice it covered plus consumed vendor credit
   *  (9/22/26 review response), so every other surface reads
   *  post-reversal numbers. The invoiceId/amount pair is the fallback
   *  for seed synthetic rows with no record behind them. */
  onReversePayment?: (args: { invoiceId?: string; paymentReference: string; amount?: number; reason?: string }) => void;
  /** Credit memos live in App state (9/22/26): real records that persist
   *  across navigation and open a real page. */
  creditMemos?: CreditMemo[];
  onAddCreditMemo?: (invoiceId: string, memo: CreditMemo) => void;
  onViewCreditMemo?: (creditMemoNumber: string) => void;
}

// ── Status mapping ────────────────────────────────────────────────
// Detail-page status names compress some of the raw values for
// readability ("Paid in Full" -> "Paid", "Payment Hold" -> "On
// Hold") but every state in the BA-approved action matrix has a
// distinct entry here so the actions/transitions can branch
// correctly. "Archived" is a terminal display-only state reachable
// from the Archive action (Paid / Rejected / Cancelled -> Archived).
type DisplayStatus =
  | 'Pending Approval'
  | 'Approved'
  | 'On Hold'
  | 'Partially Paid'
  | 'Paid'
  // Pre-invoice lifecycle: prepayments settle a pre-invoice into
  // Partially Prepaid / Prepaid; receiving later converts it to a PO
  // invoice whose states read Partially Paid / Paid.
  | 'Partially Prepaid'
  | 'Prepaid'
  | 'Exception'
  | 'Rejected'
  | 'Cancelled'
  | 'Archived';

function mapStatus(raw: string): DisplayStatus {
  switch (raw) {
    case 'Paid in Full': return 'Paid';
    // Settled (full credit memo, no cash) behaves like Paid everywhere on
    // the detail page; only the payment pill reads "Settled" (7/21/26).
    case 'Settled': return 'Paid';
    case 'Payment Hold': return 'On Hold';
    case 'Cancelled': return 'Cancelled';
    case 'Exception': return 'Exception';
    case 'Rejected': return 'Rejected';
    case 'Draft': return 'Pending Approval';
    default: return (raw as DisplayStatus) || 'Pending Approval';
  }
}

// Listing-page pill palette — matches `STATUS_STYLES` in
// InvoiceDataTable.tsx so the chip on the row and the chip on the
// detail page are visually identical. Colors flow through to the
// workflow step circles and the transition overlay.
// Mirrors STATUS_STYLES in InvoiceDataTable.tsx exactly — the
// listing's status pill and the detail header gradient must share
// a colour so the row → detail navigation feels continuous.
const STATUS_PALETTE: Record<DisplayStatus, { bg: string; color: string; border: string }> = {
  'Pending Approval': { bg: '#EEF2FF', color: '#4338CA', border: '#C7D2FE' }, // indigo 50/700/200
  Approved: { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' },           // emerald 50/700/200
  'Partially Paid': { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },   // orange 50/700/200
  Paid: { bg: '#D1FAE5', color: '#065F46', border: '#6EE7B7' },               // emerald 100/800/300
  'Partially Prepaid': { bg: '#FAF5FF', color: '#7C3AED', border: '#DDD6FE' },// purple 50/600/200
  Prepaid: { bg: '#EDE9FE', color: '#6D28D9', border: '#C4B5FD' },            // violet 100/700/300
  'On Hold': { bg: '#FEF9C3', color: '#854D0E', border: '#FACC15' },          // yellow 100/800/400 (contrast, 10/26/26)
  // Amber, the exception CTA's own color (user 9/22; 7/15 rule):
  // red is reserved for destructive states like Rejected/Cancelled.
  Exception: { bg: '#FEF3C7', color: '#92400E', border: '#FCD34D' },          // amber 100/800/300
  Rejected: { bg: '#FFF1F2', color: '#BE123C', border: '#FECDD3' },           // rose 50/700/200
  Cancelled: { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' },          // red 50/700/200
  // Archived reads RED system-wide (Eli 10/5): the header pill and the
  // timeline node match the red Archive CTA / overlay, not stone.
  Archived: { bg: '#FEE2E2', color: '#B91C1C', border: '#FECACA' },           // red 100/700/200
};

// Per-type pill palette — keyed to InvoiceDataTable.TYPE_CONFIG so
// the Type chip on the row and the chip on the detail header read
// identically. 9/5/26: identities follow the three creation flows —
// BLUE Inventory, VIOLET dashed Pre-Invoice (a deposit, not an
// invoice), TEAL Standalone.
const TYPE_PALETTE: Record<string, { icon: React.ElementType; label: string; bg: string; color: string; border: string; dashed?: boolean }> = {
  'PO-based': { icon: Package, label: 'Inventory Invoice', bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  'Receiving-based': { icon: Package, label: 'Inventory Invoice', bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  'GRN-based': { icon: Package, label: 'Inventory Invoice', bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  Standalone: { icon: Calculator, label: 'Standalone Invoice', bg: '#F0FDFA', color: '#0F766E', border: '#99F6E4' },
  'Pre-Invoice': { icon: Wallet, label: 'Pre-Invoice', bg: '#F5F3FF', color: '#6D28D9', border: '#C4B5FD', dashed: true },
};

// High-level invoice category — the same Inventory vs Standalone split
// the "New vendor invoice" picker uses (Inventory = Package/blue,
// Standalone = FileText/purple). PO / Receiving / Pre-Invoice are all
// inventory-linked; only the Standalone type is documentless. The
// avatar tile + a header pill both key off this so the detail page
// reads back the choice made at creation.
type InvoiceCategory = 'inventory' | 'standalone';
function invoiceCategory(type: string): InvoiceCategory {
  return type === 'Standalone' ? 'standalone' : 'inventory';
}
const CATEGORY_META: Record<InvoiceCategory, { icon: React.ElementType; label: string; bg: string; color: string; border: string }> = {
  // Light tints (50-weight) so the avatar tile reads soft, not dark.
  // Same identities as TYPE_PALETTE (user 10/10): blue inventory, teal standalone.
  inventory: { icon: Package, label: 'Inventory Invoice', bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  standalone: { icon: FileText, label: 'Standalone Invoice', bg: '#F0FDFA', color: '#0F766E', border: '#99F6E4' },
};

// Solid-color tokens for step circles + glow rings. Mirrors the PO
// `STEP_COLORS` recipe but keyed to our invoice palette.
// Solid colour for step circles + transition glow rings. Each
// `solid` equals the corresponding STATUS_PALETTE.color so the
// circle's fill matches the listing pill's text colour.
const STEP_COLORS: Record<DisplayStatus, { solid: string; glow: string }> = {
  'Pending Approval': { solid: '#4338CA', glow: 'color-mix(in srgb, #4338CA 18%, transparent)' },
  Approved: { solid: '#047857', glow: 'color-mix(in srgb, #047857 18%, transparent)' },
  'Partially Paid': { solid: '#C2410C', glow: 'color-mix(in srgb, #C2410C 18%, transparent)' },
  Paid: { solid: '#065F46', glow: 'color-mix(in srgb, #065F46 18%, transparent)' },
  'Partially Prepaid': { solid: '#7C3AED', glow: 'color-mix(in srgb, #7C3AED 18%, transparent)' },
  Prepaid: { solid: '#6D28D9', glow: 'color-mix(in srgb, #6D28D9 18%, transparent)' },
  'On Hold': { solid: '#A16207', glow: 'color-mix(in srgb, #A16207 18%, transparent)' },
  Exception: { solid: '#B45309', glow: 'color-mix(in srgb, #B45309 18%, transparent)' },
  Rejected: { solid: '#BE123C', glow: 'color-mix(in srgb, #BE123C 18%, transparent)' },
  Cancelled: { solid: '#B91C1C', glow: 'color-mix(in srgb, #B91C1C 18%, transparent)' },
  Archived: { solid: '#DC2626', glow: 'color-mix(in srgb, #DC2626 14%, transparent)' },
};

// Status-tinted gradient header card — soft listing-color tint at
// the bottom edge fading to white moving upward. Mirrors the
// partner VendorDetailsPage recipe so the header reads as one
// continuous status surface that flows into the workflow ladder.
function headerCardStyle(status: DisplayStatus): React.CSSProperties {
  const p = STATUS_PALETTE[status];
  // Gradient runs from the status tint at the bottom (where the
  // tab bar / workflow ladder sits) up through a soft midpoint to
  // white at the top. Old recipe hit pure white at 55% so the tint
  // was nearly invisible for muted palettes (Cancelled stone);
  // 80%-to-soft-mix-to-white pushes the status colour further up
  // the card so the header visually reads as the status colour.
  // Archived wears the archive action's RED family (user 10/4; 10/5
  // extends it to the pill + timeline node too, see STATUS_PALETTE /
  // STEP_COLORS): header, pill, and stepper all match the red Archive
  // CTA, modal, and listing overlay.
  const base = status === 'Archived' ? '#FEE2E2' : p.bg;
  const softMix = `color-mix(in srgb, ${base} 35%, white)`;
  return {
    background: `linear-gradient(to top, ${base} 0%, ${softMix} 45%, #FFFFFF 90%)`,
    borderColor: status === 'Archived' ? '#FECACA' : p.border,
  };
}

// ── Tabs ──────────────────────────────────────────────────────────
type TabKey = 'line-items' | 'linked-records' | 'payments' | 'gl-impact' | 'notes' | 'communication' | 'attachments' | 'activity';
// Dashboard / Overview tab removed entirely per user feedback —
// the page lands directly on Line Items, mirroring the PO/SO
// detail-page UX. KPI strip, widget grid, customize-widgets sheet,
// and sidebar Invoice Information panel were removed with it; the
// Available Actions are reachable from the header Actions dropdown.
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'line-items', label: 'Line Items' },
  { key: 'linked-records', label: 'Linked Records' },
  { key: 'payments', label: 'Payments' },
  { key: 'gl-impact', label: 'GL Impact' },
  // The four standard record tabs (10/1/26): every detail page in the
  // module carries Notes, Communication, Attachments, Recent Activity.
  { key: 'notes', label: 'Notes' },
  // "Communications" + "Activity" exactly (GPT QC02: the Sept 28 OMNE
  // standard names the tabs Activity, Notes, Communications, Attachments).
  { key: 'communication', label: 'Communications' },
  { key: 'attachments', label: 'Attachments' },
  { key: 'activity', label: 'Activity' },
];

// ── Action matrix ─────────────────────────────────────────────────
interface ActionDef {
  key: string;
  label: string;
  icon: typeof Banknote;
  variant?: 'primary' | 'default' | 'destructive';
}

// Matches the BA-approved action matrix in `invoiceActions.ts` —
// the listing row menu and the detail page must offer the same set
// of actions for the same status. "Print" and "Export" are always
// available (the row menu also surfaces "View Details" — omitted
// here since the user is already on the detail page).
function actionsForStatus(status: DisplayStatus, paid: number): ActionDef[] {
  // Cancel windows per the lifecycle specs (7/15/26): before posting
  // (Pending / Rejected), or after posting only while $0 has been paid.
  // Anything paid must be reversed first.
  const cancellable = paid <= 0.004;
  switch (status) {
    case 'Pending Approval':
      // Approver journey: Approve is the CTA, Reject (with reason) is the
      // counterpart. An approver can also Add Payment directly (7/16/26):
      // recording the payment approves the invoice in the same step, so
      // approve-then-pay is one action, not two. A payment hold is
      // placeable at ANY time, not only after approval (meeting feedback
      // 7/17/26) — a control state can precede payability.
      return [
        { key: 'make-payment', label: 'Add Payment', icon: Banknote },
        { key: 'approve', label: 'Approve', icon: CheckCheck, variant: 'primary' },
        { key: 'reject', label: 'Reject', icon: Ban, variant: 'destructive' },
        { key: 'payment-hold', label: 'Payment Hold', icon: Lock },
        { key: 'raise-exception', label: 'Flag as Exception', icon: AlertTriangle },
        { key: 'cancel', label: 'Cancel Invoice', icon: XCircle, variant: 'destructive' },
        { key: 'print', label: 'Print Invoice', icon: Printer },
        { key: 'export', label: 'Export Invoice', icon: Download },
      ];
    case 'Approved':
      return [
        { key: 'make-payment', label: 'Add Payment', icon: Banknote, variant: 'primary' },
        { key: 'payment-hold', label: 'Payment Hold', icon: Lock },
        { key: 'add-credit', label: 'Add Credit Memo', icon: Receipt },
        ...(cancellable ? [{ key: 'cancel', label: 'Cancel Invoice', icon: XCircle, variant: 'destructive' as const }] : []),
        { key: 'print', label: 'Print Invoice', icon: Printer },
        { key: 'export', label: 'Export Invoice', icon: Download },
      ];
    case 'Partially Paid':
      // Not fully paid yet, so Add Payment stays the flagship CTA and
      // Remittance waits in the Actions menu (design feedback 7/9).
      // Reverse Payment renders as its own header button.
      return [
        { key: 'make-payment', label: 'Add Payment', icon: Banknote, variant: 'primary' },
        { key: 'reverse-payment', label: 'Reverse Payment', icon: Undo2 },
        { key: 'remittance', label: 'Remittance Advice', icon: Download },
        { key: 'payment-hold', label: 'Payment Hold', icon: Lock },
        { key: 'add-credit', label: 'Add Credit Memo', icon: Receipt },
        { key: 'print', label: 'Print Invoice', icon: Printer },
        { key: 'export', label: 'Export Invoice', icon: Download },
      ];
    case 'Paid':
      // Fully paid: Remittance leads (design feedback 7/8/26); credit
      // memos are no longer possible once the invoice is settled in full,
      // and Reverse Payment is the only remaining state action (spec
      // quick-reference table 7/15/26).
      return [
        { key: 'remittance', label: 'Remittance Advice', icon: Download, variant: 'primary' },
        { key: 'reverse-payment', label: 'Reverse Payment', icon: Undo2 },
        { key: 'print', label: 'Print Invoice', icon: Printer },
        { key: 'export', label: 'Export Invoice', icon: Download },
      ];
    case 'On Hold':
      return [
        { key: 'release-hold', label: 'Release Hold', icon: RotateCcw, variant: 'primary' },
        { key: 'add-credit', label: 'Add Credit Memo', icon: Receipt },
        ...(cancellable ? [{ key: 'cancel', label: 'Cancel Invoice', icon: XCircle, variant: 'destructive' as const }] : []),
        { key: 'print', label: 'Print Invoice', icon: Printer },
        { key: 'export', label: 'Export Invoice', icon: Download },
      ];
    case 'Exception':
      return [
        { key: 'resolve', label: 'Resolve', icon: CheckCircle2, variant: 'primary' },
        // Hold is placeable at any time (meeting feedback 7/17/26).
        { key: 'payment-hold', label: 'Payment Hold', icon: Lock },
        { key: 'cancel', label: 'Cancel Invoice', icon: XCircle, variant: 'destructive' },
        { key: 'print', label: 'Print Invoice', icon: Printer },
        { key: 'export', label: 'Export Invoice', icon: Download },
      ];
    case 'Rejected':
      // Rejected is FIXABLE: correcting the issues returns the invoice to
      // the approval queue; it can also be cancelled outright
      // (lifecycle specs 7/15/26).
      return [
        { key: 'resubmit', label: 'Edit and Resubmit', icon: RotateCcw, variant: 'primary' },
        { key: 'cancel', label: 'Cancel Invoice', icon: XCircle, variant: 'destructive' },
        { key: 'print', label: 'Print Invoice', icon: Printer },
        { key: 'export', label: 'Export Invoice', icon: Download },
      ];
    case 'Cancelled':
      return [
        { key: 'uncancel', label: 'Uncancel Invoice', icon: ArchiveRestore, variant: 'primary' },
        { key: 'archive', label: 'Archive', icon: Archive },
        { key: 'print', label: 'Print Invoice', icon: Printer },
        { key: 'export', label: 'Export Invoice', icon: Download },
      ];
    case 'Partially Prepaid':
      // Prepaid lifecycle mid-step (spec 7/15/26): hold, credit memo and
      // prepayment reversal available; more prepayments arrive via the
      // type-conditional Add prepayment action.
      return [
        { key: 'remittance', label: 'Remittance Advice', icon: Download, variant: 'primary' },
        { key: 'reverse-payment', label: 'Reverse Prepayment', icon: Undo2 },
        { key: 'payment-hold', label: 'Payment Hold', icon: Lock },
        { key: 'add-credit', label: 'Add Credit Memo', icon: Receipt },
        { key: 'print', label: 'Print Invoice', icon: Printer },
        { key: 'export', label: 'Export Invoice', icon: Download },
      ];
    case 'Prepaid':
      // Fully prepaid: credit memos and prepayment reversal stay possible
      // until receiving converts it to a receiving invoice (spec 7/15/26).
      return [
        { key: 'remittance', label: 'Remittance Advice', icon: Download, variant: 'primary' },
        { key: 'reverse-payment', label: 'Reverse Prepayment', icon: Undo2 },
        { key: 'add-credit', label: 'Add Credit Memo', icon: Receipt },
        { key: 'print', label: 'Print Invoice', icon: Printer },
        { key: 'export', label: 'Export Invoice', icon: Download },
      ];
    case 'Archived':
      return [{ key: 'restore', label: 'Restore', icon: ArchiveRestore, variant: 'primary' }];
    default:
      return [];
  }
}

function formatCurrency(amount: number) {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ── Status workflow (PRD §10 happy path) ──────────────────────────
// Defines the linear milestone progression shown in the header step-
// bar. On-Hold, Rejected, and Archived are off-path branches handled
// inside the bar by inserting an aux node where they sit relative to
// the main line.
const WORKFLOW_NODES: DisplayStatus[] = ['Pending Approval', 'Approved', 'Partially Paid', 'Paid'];

function statusOrder(s: DisplayStatus): number {
  switch (s) {
    case 'Pending Approval': return 0;
    case 'Approved': return 1;
    case 'Partially Paid': return 2;
    case 'Paid': return 3;
    default: return -1;
  }
}

// Which statuses the user can transition TO from each current status.
// Mirrors the partner Status Pill dropdown but keyed to invoice
// lifecycle. Includes the current status itself (rendered as the
// already-selected item with a check, mirroring partner UX).
// Mirrors the BA state-transition spec: Submit → Pending Approval;
// Flag as Exception → Exception → Resolve → Pending Approval;
// Approved → Add Payment → Partially Paid / Paid; reverse payment
// rolls back; Payment Hold ↔ Approved/Partially Paid; terminal
// states (Rejected, Cancelled, Paid) → Archived.
function allowedTransitions(current: DisplayStatus): DisplayStatus[] {
  switch (current) {
    case 'Pending Approval':
      // Reject was cut in the 7/7/26 peer review; existing Rejected
      // invoices keep their terminal transitions below.
      return ['Pending Approval', 'Approved', 'Exception', 'Cancelled'];
    case 'Approved':
      return ['Approved', 'Partially Paid', 'Paid', 'On Hold', 'Cancelled'];
    case 'Partially Paid':
      return ['Partially Paid', 'Approved', 'Paid', 'On Hold'];
    case 'Paid':
      return ['Paid', 'Partially Paid', 'Approved', 'Archived'];
    case 'On Hold':
      return ['On Hold', 'Approved', 'Partially Paid', 'Cancelled'];
    case 'Exception':
      return ['Exception', 'Pending Approval', 'Cancelled'];
    case 'Rejected':
      return ['Rejected', 'Archived'];
    case 'Cancelled':
      return ['Cancelled', 'Archived'];
    case 'Archived':
      return ['Archived'];
    default:
      return [current];
  }
}

// Map a header status-pill transition to the central invoice action so the
// change persists via applyInvoiceAction. Payment-driven targets (Partially
// Paid / Paid) and Archived have no single action — they return null and the
// pill falls back to a local visual override (unchanged behavior).
type PersistableAction =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'cancel'
  | 'uncancel'
  | 'paymentHold'
  | 'flagException'
  | 'resolve'
  | 'releaseHold'
  | 'archive'
  | 'restore';

function actionForTransition(from: DisplayStatus, to: DisplayStatus): PersistableAction | null {
  switch (to) {
    case 'Approved':
      if (from === 'Pending Approval') return 'approve';
      if (from === 'On Hold') return 'releaseHold';
      return null;
    case 'Rejected':
      return 'reject';
    case 'Exception':
      return 'flagException';
    case 'Cancelled':
      return 'cancel';
    case 'On Hold':
      return 'paymentHold';
    case 'Pending Approval':
      // Exceptions resolve back; rejected invoices fix-and-resubmit back
      // (lifecycle specs 7/15/26).
      if (from === 'Exception') return 'resolve';
      if (from === 'Rejected') return 'submit';
      return null;
    case 'Archived':
      // Persists on the record (9/22/26, GPT F17).
      return 'archive';
    default:
      // Leaving Archived = restore; every other unmapped transition stays
      // a local display override.
      if (from === 'Archived') return 'restore';
      return null;
  }
}

// ── Action-menu segregation ───────────────────────────────────────
// Bucket the header Actions into partner-style groups so the menu renders
// dividers between them. Order rev 7/16/26 (user-specified): pay first,
// then edit, then the approve/reject decision group, then balance
// adjustments (hold, credit memo, reversal), then output, with
// flag-exception and cancel/archive pinned at the bottom.
type DetailActionCategory = 'money' | 'primary' | 'workflow' | 'adjust' | 'output' | 'warning' | 'destructive';

const DETAIL_CATEGORY_ORDER: DetailActionCategory[] = ['money', 'primary', 'workflow', 'adjust', 'output', 'warning', 'destructive'];

function detailActionCategory(key: string): DetailActionCategory {
  switch (key) {
    case 'make-payment':
    case 'add-prepayment':
      return 'money';
    case 'approve':
    case 'reject':
    case 'resolve':
    case 'resubmit':
    case 'release-hold':
    case 'restore':
      return 'workflow';
    case 'payment-hold':
    case 'add-credit':
    case 'reverse-payment':
      return 'adjust';
    case 'print':
    case 'export':
    case 'remittance':
      return 'output';
    case 'raise-exception':
      return 'warning';
    case 'cancel':
    case 'archive':
      return 'destructive';
    default:
      return 'primary';
  }
}

function groupDetailActions(actions: ActionDef[]): ActionDef[][] {
  return DETAIL_CATEGORY_ORDER
    .map((cat) => actions.filter((a) => detailActionCategory(a.key) === cat))
    .filter((group) => group.length > 0);
}

/* ── Status-reason banner ─────────────────────────────────────────
 * Blocked / terminal states carry a reason (picked in the reason
 * modal); the banner replays it at the top of every tab — the GL
 * tab's "Not posted" card recipe with a status tint — so nobody has
 * to dig through the activity log to learn why an invoice stopped. */
const REASON_BANNER: Record<string, {
  historyAction: string;
  title: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  border: string;
  fallback: string;
}> = {
  Rejected: {
    historyAction: 'reject',
    title: 'Invoice rejected, fix the issue and resubmit',
    icon: Ban,
    iconBg: '#FEF2F2',
    iconColor: '#DC2626',
    border: '#FECACA',
    fallback: 'No reason was recorded when this invoice was rejected.',
  },
  Cancelled: {
    historyAction: 'cancel',
    title: 'Invoice cancelled',
    icon: XCircle,
    iconBg: '#FEF2F2',
    iconColor: '#DC2626',
    border: '#FECACA',
    fallback: 'No reason was recorded when this invoice was cancelled.',
  },
  'On Hold': {
    historyAction: 'paymentHold',
    title: 'On Payment Hold',
    icon: Lock,
    iconBg: '#FEFCE8',
    iconColor: '#A16207',
    border: '#FEF08A',
    fallback: 'No reason was recorded when the hold was placed.',
  },
  Exception: {
    historyAction: 'flagException',
    title: 'Exception flagged, resolve to continue',
    icon: AlertTriangle,
    iconBg: '#FFF7ED',
    iconColor: '#C2410C',
    border: '#FED7AA',
    fallback: 'No reason was recorded when the exception was flagged.',
  },
};

// "Mar 28, 2026 at 03:15 PM" — same format as the Activity History feed,
// so the banner's "by X on <when>" reads human instead of raw ISO.
const BANNER_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function bannerTimestamp(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${BANNER_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${hours.toString().padStart(2, '0')}:${minutes} ${period}`;
}

function StatusReasonBanner({ invoice, status, onResolveException, onResubmit, onReleaseHold }: { invoice: Invoice; status: DisplayStatus; onResolveException?: () => void; onResubmit?: () => void; onReleaseHold?: () => void }) {
  const cfg = REASON_BANNER[status];
  if (!cfg) return null;
  const entry = [...(invoice.actionHistory ?? [])].reverse().find((e) => e.action === cfg.historyAction);
  const Icon = cfg.icon;
  return (
    <div className="rounded-xl border bg-white px-4 py-3 flex items-start gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]" style={{ borderColor: cfg.border }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: cfg.iconBg }}>
        <Icon className="w-4 h-4" style={{ color: cfg.iconColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-foreground" style={{ fontWeight: 700 }}>{cfg.title}</p>
        {/* The Reason chip labels the reason line itself, not the title. */}
        <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">
          <span
            className="inline-flex px-1.5 py-px rounded-md text-[9px] align-middle mr-1.5"
            style={{ fontWeight: 700, backgroundColor: cfg.iconBg, color: cfg.iconColor }}
          >
            Reason
          </span>
          {entry?.reason ? entry.reason : cfg.fallback}
          {entry && (
            <span className="text-slate-400"> · by {entry.by} on {bannerTimestamp(entry.at)}</span>
          )}
        </p>
      </div>
      {/* Resolve / resubmit straight from the banner — Actions-button
          chrome (white bg + outline) tinted to the banner's state color
          (feedback 7/15/26). */}
      {status === 'Exception' && onResolveException && (
        <button
          type="button"
          onClick={onResolveException}
          className="shrink-0 self-center h-8 px-3.5 rounded-lg bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 text-[12px] inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          style={{ fontWeight: 600 }}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Resolve Exception
        </button>
      )}
      {status === 'Rejected' && onResubmit && (
        <button
          type="button"
          onClick={onResubmit}
          className="shrink-0 self-center h-8 px-3.5 rounded-lg bg-white border border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 text-[12px] inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          style={{ fontWeight: 600 }}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Edit and Resubmit
        </button>
      )}
      {status === 'On Hold' && onReleaseHold && (
        <button
          type="button"
          onClick={onReleaseHold}
          className="shrink-0 self-center h-8 px-3.5 rounded-lg bg-white border border-yellow-300 text-yellow-700 hover:bg-yellow-50 hover:border-yellow-400 text-[12px] inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          style={{ fontWeight: 600 }}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Release Hold
        </button>
      )}
    </div>
  );
}

/* Both blocks in ONE frame (user 9/23): an exception AND a live payment
 * hold used to stack two full banners. One card carries both rows and
 * says plainly that they are independent blocks. */
function CombinedFlagsBanner({ invoice, onResolveException, onReleaseHold }: { invoice: Invoice; onResolveException: () => void; onReleaseHold: () => void }) {
  const exc = [...(invoice.actionHistory ?? [])].reverse().find((e) => e.action === 'flagException');
  const hold = [...(invoice.actionHistory ?? [])].reverse().find((e) => e.action === 'paymentHold');
  const row = (
    icon: React.ElementType,
    iconBg: string,
    iconColor: string,
    title: string,
    reason: string | undefined,
    entry: { by: string; at: string } | undefined,
    cta: React.ReactNode,
  ) => {
    const Icon = icon;
    return (
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: iconBg }}>
          <Icon className="w-4 h-4" style={{ color: iconColor }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-foreground" style={{ fontWeight: 700 }}>{title}</p>
          <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">
            <span
              className="inline-flex px-1.5 py-px rounded-md text-[9px] align-middle mr-1.5"
              style={{ fontWeight: 700, backgroundColor: iconBg, color: iconColor }}
            >
              Reason
            </span>
            {reason || 'No reason was recorded.'}
            {entry && <span className="text-slate-400"> · by {entry.by} on {bannerTimestamp(entry.at)}</span>}
          </p>
        </div>
        {cta}
      </div>
    );
  };
  return (
    <div className="rounded-xl border border-amber-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="divide-y divide-amber-100">
        {row(AlertTriangle, '#FFF7ED', '#C2410C', 'Exception flagged, resolve to continue', exc?.reason, exc, (
          <button
            type="button"
            onClick={onResolveException}
            className="shrink-0 self-center h-8 px-3.5 rounded-lg bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 text-[12px] inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            style={{ fontWeight: 600 }}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Resolve Exception
          </button>
        ))}
        {row(Lock, '#FEFCE8', '#A16207', 'On Payment Hold', hold?.reason, hold, (
          <button
            type="button"
            onClick={onReleaseHold}
            className="shrink-0 self-center h-8 px-3.5 rounded-lg bg-white border border-yellow-300 text-yellow-700 hover:bg-yellow-50 hover:border-yellow-400 text-[12px] inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            style={{ fontWeight: 600 }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Release Hold
          </button>
        ))}
      </div>
      {/* The "Two separate blocks" footer strip is gone (user 10/4):
          each row's own CTA already makes the independence clear. */}
    </div>
  );
}

function daysBetween(later: Date, earlier: Date) {
  const ms = later.getTime() - earlier.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

// ══════════════════════════════════════════════════════════════════
// Main screen
// ══════════════════════════════════════════════════════════════════

export function InvoiceDetailScreen({ invoiceId, onClose, invoices, payments = [], applyInvoiceAction, onSettleInvoices, onPayInvoices, onAddPrepayment, onEditResubmit, onReversePayment, creditMemos = [], onAddCreditMemo, onViewCreditMemo, runs, onViewRun, notes = [], onAddNote, onUpdateNote, onDeleteNote }: InvoiceDetailScreenProps) {
  const navigate = useNavigate();
  const location = useLocation();
  // Opened from Vendor Payments (Ready to pay row, Applied To link) — the
  // page reads as a payment workspace: the approval step drops out of the
  // workflow bar and "Approved" reads "Awaiting Payment" (feedback 7/14/26).
  const fromPayments = (((location.state as { from?: string } | null)?.from) ?? '').startsWith('/payments');
  const invoice = invoices.find((inv) => inv.id === invoiceId);

  const [activeTab, setActiveTab] = useState<TabKey>('line-items');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [creditMemoOpen, setCreditMemoOpen] = useState(false);
  // Credit memos come from App state now (9/22/26 review response): real
  // records that persist across navigation. Mapped to linked-record shape
  // here so the Linked Records tab and the summaries pick them up in the
  // same merge session-local memos used to ride.
  const sessionCreditMemos = useMemo<LinkedFinancialRecord[]>(
    () =>
      creditMemos
        .filter((m) => m.invoiceNumber === (invoice?.invoiceNumber ?? '') && m.status === 'Applied')
        .map((m) => ({
          id: `cm-${m.id}`,
          type: 'Credit Memo' as const,
          reference: m.creditMemoNumber,
          description: m.description || m.reason,
          status: 'Applied' as const,
          date: m.date,
          amount: m.amount,
          createdBy: m.createdBy,
          updatedBy: m.createdBy,
        })),
    [creditMemos, invoice?.invoiceNumber],
  );
  // Payment / prepayment reversals recorded this session — each carries the
  // reversed source reference so the merge below can retire the original
  // record and restore the outstanding balance (lifecycle specs 7/15/26).
  // Reversals only remember WHICH reference was reversed — the source row
  // keeps its line and flips status, no mirror row is added (7/15/26).
  const [sessionReversals, setSessionReversals] = useState<Array<{ reversedReference: string }>>([]);
  useEffect(() => { setSessionReversals([]); }, [invoiceId]);
  const [reversePaymentOpen, setReversePaymentOpen] = useState(false);
  // Print / Export document modal (9/5/26, BB-26) — which framing opened it.
  const [documentModal, setDocumentModal] = useState<'print' | 'export' | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [statusChangeTarget, setStatusChangeTarget] = useState<DisplayStatus | null>(null);
  const [statusOverride, setStatusOverride] = useState<DisplayStatus | null>(null);
  // Reason capture for reject / cancel / payment-hold / flag-as-exception,
  // reusing the shared InvoiceReasonDialog (same as the listing page).
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [reasonOpen, setReasonOpen] = useState(false);
  // Release-hold confirm (meeting feedback 7/17/26): offers, never
  // forces, notifying the people who were told about the hold.
  const [releaseConfirmOpen, setReleaseConfirmOpen] = useState(false);
  // Reply-all on release (Eli 7/22/26): seeded with the original hold
  // recipients, but the user can ADD anyone who joined the conversation.
  // Notes, documents and the dirty guard live in ReleaseHoldDialog.
  const [releaseSeed, setReleaseSeed] = useState<string[]>([]);
  // Approving while a payment hold is live confirms first (Nophil 9/22).
  const [approveHoldConfirmOpen, setApproveHoldConfirmOpen] = useState(false);
  // Notify choice on the status-pill resolve confirm (feedback 7/22/26).
  // The pre-fix resolve/resubmit CONFIRM modal is gone (BA 9/6): Resolve
  // opens the edit screen directly and the recordation form lives at
  // Resubmit inside it.
  const [resolveNotify, setResolveNotify] = useState(true);
  const [transitionOverlay, setTransitionOverlay] = useState<{ visible: boolean; from: DisplayStatus; to: DisplayStatus } | null>(null);

  // IntersectionObserver-driven header morph — sentinel sits right
  // below the (sticky) breadcrumb so the moment the page scrolls past
  // it, `isScrolled` flips and the header card transitions to compact.
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const io = new IntersectionObserver(
      ([entry]) => setIsScrolled(!entry.isIntersecting),
      { threshold: 0 },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  const vendorData = useMemo(() => {
    if (!invoice) return null;
    return mockVendors.find((v) => v.vendorName === invoice.vendor) || null;
  }, [invoice]);

  // Linked financial records (prepayments / payments / credit memos) —
  // shared source of truth with the Linked Records tab so the header
  // outstanding, sidebar summary, and the tab's reconciliation line all
  // tie: total − prepayments − payments − credits = outstanding.
  // Synthesized history derives from the FROZEN seed row, not the live
  // invoice — session payments already exist as real app records, so
  // deriving from the live balance would double-represent them as
  // phantom PAY/PRE/CM rows (reversal bug, 7/15/26). Invoices created
  // this session have no seed row and fall back to their live state.
  const seedInvoice = useMemo(
    () => (invoice ? mockInvoices.find((m) => m.id === invoice.id) ?? invoice : null),
    [invoice?.id],
  );
  // Boot-time real payment records already cover part of a seed's settled
  // slice (9/15/26 alignment): the synthetic decomposition shrinks by that
  // amount so the same money never renders as BOTH a real payment row and
  // a phantom PAY- row (9/22/26 review response, GPT F03).
  const bootRealSettled = useMemo(() => {
    if (!invoice) return 0;
    const applied = [...SEED_RUN_PAYMENTS, ...mockPayments]
      .filter((p) => p.status !== 'Reversed' && p.status !== 'Void')
      .reduce((s, p) => s + (p.appliedInvoices?.find((a) => a.invoiceNumber === invoice.invoiceNumber)?.amount ?? 0), 0);
    return Math.round(applied * 100) / 100;
  }, [invoice?.invoiceNumber]);
  const linkedFinancialsBase = useMemo(
    () => (invoice && seedInvoice ? getLinkedFinancials(seedInvoice, seedInvoice.amount, bootRealSettled) : null),
    [invoice, seedInvoice, bootRealSettled]
  );

  // Session credit memos AND reversals merge into the same source of truth,
  // so the header outstanding, sidebar summary, Linked Records tab, and the
  // reconciliation line all pick them up in one place. Credits reduce the
  // outstanding; reversal balance math lives at App level (onReversePayment
  // restores invoice.outstandingBalance) — here reversals only add their
  // mirror records and retire the reversed source rows.
  const linkedFinancials = useMemo(() => {
    if (!linkedFinancialsBase || !invoice) return linkedFinancialsBase;
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const creditTotal = round2(sessionCreditMemos.reduce((s, r) => s + r.amount, 0));
    // History-logged reversals count too, so a reversal made from the
    // listing row action (or before navigating away) stays retired.
    const reversedRefs = reversedRefsFromHistory(invoice);
    sessionReversals.forEach((r) => reversedRefs.add(r.reversedReference));
    // Real session advances against this invoice surface as Prepayment
    // linked records (Eli 9/24 R09): the pre-invoice names the actual
    // PRE record, its amount, date and reversal status.
    const existingRefs = new Set(linkedFinancialsBase.records.map((r) => r.reference));
    const sessionPrepays: LinkedFinancialRecord[] = payments
      .filter(
        (p) =>
          p.type === 'Prepayment' &&
          (p.preInvoiceId === invoice.invoiceNumber || p.preInvoiceId === invoice.id) &&
          !existingRefs.has(p.paymentNumber),
      )
      .map((p) => ({
        id: `pp-${p.id}`,
        type: 'Prepayment' as const,
        reference: p.paymentNumber,
        description: p.memo || `Advance to ${p.vendor}`,
        status: p.status === 'Reversed' ? ('Reversed' as const) : ('Applied' as const),
        date: p.paymentDate,
        amount: p.amount,
        createdBy: p.createdBy,
        updatedBy: p.createdBy,
      }));
    const records = [
      ...linkedFinancialsBase.records.map((r) =>
        (r.type === 'Payment' || r.type === 'Prepayment') && reversedRefs.has(r.reference)
          ? { ...r, status: 'Reversed' as const }
          : r,
      ),
      ...sessionPrepays,
      ...sessionCreditMemos,
    ];
    // Live outstanding comes from App state — credit memos settle the
    // invoice for real now (9/22/26), so the balance already carries
    // them; the reconciliation identity prepays + credits + payments +
    // outstanding = total stays exact.
    const cancelled = invoice.status === 'Cancelled';
    const effectiveOutstanding = cancelled ? 0 : Math.max(0, round2(invoice.outstandingBalance));
    const creditsApplied = round2(linkedFinancialsBase.creditsApplied + creditTotal);
    // Cancel only happens at $0 paid (lifecycle spec), and a cancellation
    // RELEASES the balance, it pays nothing (Mahreen 10/10): the forced
    // zero outstanding must never back-solve into "Paid = total".
    const prepaymentsApplied = cancelled ? 0 : linkedFinancialsBase.prepaymentsApplied;
    const paymentsApplied = cancelled ? 0 : Math.max(0, round2(invoice.amount - effectiveOutstanding - prepaymentsApplied - creditsApplied));
    return {
      ...linkedFinancialsBase,
      records,
      creditsApplied,
      prepaymentsApplied,
      paymentsApplied,
      effectiveOutstanding,
    };
  }, [linkedFinancialsBase, sessionCreditMemos, sessionReversals, invoice, payments]);

  // Procurement documents (POs + receiving) shown alongside the financial
  // records in the Linked Records tab. Display-only — they never touch the
  // invoice balance, so they are kept out of getLinkedFinancials.
  const linkedProcurement = useMemo(
    () => (invoice ? getLinkedProcurement(invoice) : []),
    [invoice]
  );

  // Forward reconciliation link (9/2/26): a settled pre-invoice names the
  // receiving invoice its prepayment applied to. Derived from the LIVE
  // invoice (the seed row is frozen pre-settlement). Amount 0 — a pure
  // reference that never counts toward any balance.
  const reconciliationRecords = useMemo<LinkedFinancialRecord[]>(() => {
    if (!invoice?.reconciledIntoInvoiceNumber) return [];
    const entry = invoice.actionHistory?.filter((e) => e.action === 'reconciled').slice(-1)[0];
    return [
      {
        id: 'recon-into',
        type: 'Invoice',
        reference: invoice.reconciledIntoInvoiceNumber,
        description: 'Receiving invoice this pre-invoice reconciled into',
        status: 'Applied',
        date: (entry?.at ?? invoice.updatedDate ?? invoice.invoiceDate).slice(0, 10),
        amount: 0,
        createdBy: entry?.by ?? invoice.createdBy,
        updatedBy: entry?.by ?? invoice.updatedBy ?? invoice.createdBy,
      },
    ];
  }, [invoice]);

  const numbers = useMemo(() => {
    if (!invoice) {
      return { total: 0, subtotal: 0, tax: 0, freight: 0, additional: 0, outstanding: 0, paid: 0, credits: 0, burdenPct: 0, cycleDays: 0, cycleAvgDays: 4, cycleDelta: 0, daysOverdue: 0 };
    }
    const total = invoice.amount;
    // One reconciling decomposition of the invoice total (design
    // feedback 7/8/26): line items sum to the SUBTOTAL, and
    // subtotal + tax + freight + additional charges = invoice total =
    // the amount on the listing. Every card reads from this split so
    // no number on the page disagrees with another.
    // User-created records carry their EXACT entered charges (9/22/26
    // review response): tax is always 0 (the form has none), freight and
    // additional are what the form held — nothing is synthesized. Seeds
    // keep the proportional demo split.
    const c = invoice.charges;
    const tax = c ? c.tax : Math.round(total * 0.07 * 100) / 100;
    const freight = c ? c.freight : Math.round(total * 0.03 * 100) / 100;
    const additional = c
      ? Math.round(c.additional.reduce((s, x) => s + x.amount, 0) * 100) / 100
      : Math.round(total * 0.01 * 100) / 100;
    const subtotal = Math.round((total - tax - freight - additional) * 100) / 100;
    // Outstanding reflects everything applied against the invoice —
    // payments AND linked documents (prepayments, credit memos). "paid"
    // here is the settled complement so progress bars stay in tune.
    const outstanding = linkedFinancials?.effectiveOutstanding ?? invoice.outstandingBalance;
    // Credit memos applied — surfaced as an explicit reduction line in
    // the Invoice Summary (7/15/26).
    const credits = Math.round((linkedFinancials?.creditsApplied ?? 0) * 100) / 100;
    // Credited is not paid (9/22/26 GPT F19, upheld by BA 9/28): on
    // user-created records the paid figure carries CASH only — the
    // credit reduction shows on its own line, and the sidebar splits
    // Cash paid from Credited. What the BA 9/28 review DID change is
    // the status: a partial credit now moves the invoice to Partially
    // Paid (see App.tsx handleSettleInvoices) so header and timeline
    // agree. Seeds keep the settled complement so their demo
    // composition doesn't shift.
    // A cancellation RELEASES the balance, it doesn't pay it (GPT QC19,
    // 9/30: a cancelled unpaid invoice read "Paid $2,878.50" because the
    // zeroed liability masqueraded as settlement) — cancelled invoices
    // show only the money actually applied before the cancel.
    const paid = invoice.status === 'Cancelled'
      ? Math.round(((linkedFinancials?.paymentsApplied ?? 0) + (linkedFinancials?.prepaymentsApplied ?? 0)) * 100) / 100
      : invoice.isUserCreated
        ? Math.max(0, Math.round((total - outstanding - credits) * 100) / 100)
        // Seeds keep their demo composition, but a credit memo added this
        // session is never cash (Mahreen 10/10): Paid stays put.
        : Math.max(0, Math.round((total - outstanding - (invoice.creditedAmount ?? 0)) * 100) / 100);
    const burdenPct = subtotal > 0 ? ((tax + freight) / subtotal) * 100 : 0;
    // One "today", local-midnight anchored (9/22/26 review response) —
    // and aging is gated on the invoice actually OWING money: a paid,
    // settled, cancelled or rejected invoice never shows an overdue
    // counter (the reviews' "Overdue 917d" on a paid record).
    const terminalOrPaid =
      outstanding <= 0.004 ||
      ['Paid in Full', 'Prepaid', 'Settled', 'Cancelled', 'Rejected'].includes(invoice.status);
    const daysOverdue = terminalOrPaid ? 0 : overdueDaysOf(invoice.dueDate);
    const today = todayAtMidnight();
    const received = parseDateOnly(invoice.createdDate || invoice.invoiceDate);
    const cycleDays = Math.max(0, daysBetween(today, received));
    const cycleAvgDays = 4;
    const cycleDelta = ((cycleDays - cycleAvgDays) / cycleAvgDays) * 100;
    return { total, subtotal, tax, freight, additional, outstanding, paid, credits, burdenPct, cycleDays, cycleAvgDays, cycleDelta, daysOverdue };
  }, [invoice, linkedFinancials]);

  // Actual payment records (bank money, not prepayments/credits) — feeds
  // ReversePaymentModal and the GL Impact payment lines. Derived from the
  // same linked-records source the Linked Records tab renders.
  const priorPayments: PaymentRecord[] = useMemo(() => {
    if (!linkedFinancials || !invoice) return [];
    // Shared with the listing's Reverse Payment row action (10/9/26).
    return reversiblePaymentsFrom(linkedFinancials.records, invoice, payments, invoices);
  }, [linkedFinancials, invoice, payments, invoices]);

  if (!invoice) return null;

  // Archive is a record fact (9/22/26, GPT F17): it wins over the raw
  // status and survives navigation and re-entry.
  const status: DisplayStatus = statusOverride ?? (invoice.isArchived ? 'Archived' : mapStatus(invoice.status));
  const statusPalette = STATUS_PALETTE[status];
  const isPending = status === 'Pending Approval';
  // Pre-invoices get an "Add prepayment" action (type-conditional, so it isn't
  // in the status matrix) — it opens the Record Prepayment flow. A pre-invoice
  // isn't payable, so "Add Payment" (make-payment) is removed. Prepayments
  // require an APPROVED pre-invoice (design feedback 7/8/26): while pending,
  // the action doesn't exist at all; once approved it takes over the CTA
  // (mirroring how Add Payment takes over on regular invoices).
  // The open run holding this invoice, if any (Eli 9/24 R06): drives the
  // In-payment-run pill, the View-payment-run action and the run chip.
  const inRunId = runs && runs.length > 0 ? openRunInvoiceIds(runs).get(invoice.id) : undefined;
  const actions = invoice.type === 'Pre-Invoice'
    ? (() => {
        // Payments stay locked until receiving (spec 7/15/26) — strip Add
        // Payment, and reversals read as prepayment reversals.
        const base = actionsForStatus(status, numbers.paid)
          .filter((a) => a.key !== 'make-payment')
          .map((a) => (a.key === 'reverse-payment' ? { ...a, label: 'Reverse Prepayment' } : a));
        // Pending pre-invoices offer Add prepayment too (7/16/26): the
        // prepayment auto-approves the record in the same step. None once
        // fully prepaid.
        if (status === 'Pending Approval') {
          return [{ key: 'add-prepayment', label: 'Add Prepayment', icon: Wallet }, ...base];
        }
        if (status === 'Prepaid') return base;
        // Settled by a credit memo (user 10/9): same as an inventory
        // invoice settled by credit, nothing left to credit or reverse.
        if (invoice.status === 'Settled' && !invoice.reconciledIntoInvoiceNumber) {
          return base.filter((a) => a.key !== 'reverse-payment');
        }
        // Raw Paid in Full on a pre-invoice = Fully Prepaid: credit memos
        // and prepayment reversal stay available; no further prepayments
        // and no archive shortcut (spec quick-reference table).
        if (status === 'Paid') {
          return [
            ...base.filter((a) => a.key !== 'archive'),
            { key: 'add-credit', label: 'Add Credit Memo', icon: Receipt },
          ];
        }
        // Approved: Add prepayment IS the flagship CTA.
        if (status === 'Approved') {
          return [
            { key: 'add-prepayment', label: 'Add Prepayment', icon: Wallet, variant: 'primary' as const },
            ...base,
          ];
        }
        // Partially Prepaid / Partially Paid: Remittance keeps the CTA,
        // further prepayments wait in the menu. Filtering out make-payment
        // can strip the status's only primary action — without a primary the
        // header falls back to actions[0] (Reverse Payment) and renders it
        // TWICE, once as the CTA and once as the standalone reverse button.
        // Promote Remittance so the CTA stays sensible.
        const withPrimary = base.some((a) => a.variant === 'primary')
          ? base
          : base.map((a) => (a.key === 'remittance' ? { ...a, variant: 'primary' as const } : a));
        // Only a pre-invoice with an OPEN balance offers more prepayment
        // (VI-06): Cancelled, Rejected, Settled, Exception and Payment Hold
        // fall through here too, and recording a prepayment on a cancelled
        // pre-invoice used to flip it Approved + Prepaid with no approval.
        const offersMore = status === 'Partially Prepaid' || status === 'Partially Paid';
        return offersMore
          ? [...withPrimary, { key: 'add-prepayment', label: 'Add Prepayment', icon: Wallet }]
          : withPrimary;
      })()
    : (() => {
        // Any real cash against this invoice — the same sources the
        // remittance handler prints from, plus the linked-records slice
        // for seeds. Credit memos and prepayments never count.
        const hasCashPayment =
          payments.some(
            (p) => p.type === 'Payment' && p.status === 'Paid' && (p.appliedInvoices ?? []).some((a) => a.invoiceNumber === invoice.invoiceNumber),
          ) || (linkedFinancials?.paymentsApplied ?? 0) > 0.004;
        return actionsForStatus(status, numbers.paid)
          // Settled via credit memo: no cash moved, nothing to reverse
          // (feedback 7/21/26) and no remittance to print (BA 9/28: a
          // credit-only settlement still offered Remittance Advice).
          // Remittance stays wherever real cash is on record.
          .filter((a) => !(invoice.status === 'Settled' && a.key === 'reverse-payment'))
          .filter((a) => !(a.key === 'remittance' && !hasCashPayment));
      })();
  // Live hold — an invoice-level control fact (feedback 7/21/26). A hold
  // placed BEFORE approval keeps the status in the approval queue and
  // rides along as the held flag, so the action set adjusts here: swap
  // Payment Hold for Release Hold and pull the pay actions (a held
  // invoice can't take money; paying a pending one would auto-approve).
  const held = invoice.is_payment_held === true || status === 'On Hold';
  // Reverse Payment exists only where a real payment does (Mahreen 10/10):
  // a credit memo can lower the balance, but there's nothing to reverse.
  const hasReversiblePayment = priorPayments.length > 0;
  // Pre-invoice credit memo (Mahreen 10/10): offered only while money is
  // still owed; hidden at $0.00 outstanding.
  const gatedActions = actions.filter(
    (a) =>
      (a.key !== 'reverse-payment' || hasReversiblePayment) &&
      !(a.key === 'add-credit' && invoice.type === 'Pre-Invoice' && numbers.outstanding <= 0.004),
  );
  const heldActionsBase = held && status !== 'On Hold'
    ? gatedActions
        .filter((a) => a.key !== 'make-payment' && a.key !== 'add-prepayment')
        .map((a) => (a.key === 'payment-hold' ? { key: 'release-hold', label: 'Release Hold', icon: RotateCcw } : a))
    : gatedActions;
  // Reserved in an open run (Eli 9/24 R06): Add Payment would open an
  // empty allocation form, so the action becomes the run itself.
  const heldActions = inRunId
    ? heldActionsBase.map((a) => (a.key === 'make-payment' ? { ...a, key: 'view-run', label: 'View Payment Run' } : a))
    : heldActionsBase;
  // The status's flagship action renders as the colored header CTA (like
  // the PO / SO modules); everything else, including Edit, lives in the
  // Actions dropdown (design feedback 7/8/26).
  const primaryAction = heldActions.find((a) => a.variant === 'primary') ?? heldActions[0];
  // Editing is only possible before approval (design feedback 7/8/26):
  // once an invoice is approved and posted, its content is locked.
  // Reject (pending) and Reverse Payment (any paid state) render as
  // standalone header buttons (design feedback 7/9), so they leave the menu.
  const headerOnlyKeys = new Set([
    primaryAction?.key,
    ...(isPending ? ['reject'] : []),
    ...((status === 'Partially Paid' || status === 'Paid') && hasReversiblePayment ? ['reverse-payment'] : []),
  ]);
  const menuActions = [
    // Edit lives BEFORE approval only (9/3/26): Pending Approval reopens
    // the creation modal in edit mode; approved/posted invoices never
    // offer it. Exceptions keep their own resolve-and-resubmit path.
    ...(status === 'Pending Approval' ? [{ key: 'edit', label: 'Edit Invoice', icon: Pencil }] : []),
    ...heldActions.filter((a) => !headerOnlyKeys.has(a.key)),
  ];
  // Status-transition CTAs run through the same confirm modal + state
  // transition animation the status pill dropdown used, so approving from
  // the CTA and from the old pill feel identical.
  const statusTargetForPrimary = (key: string): DisplayStatus | null => {
    switch (key) {
      case 'approve': return 'Approved';
      // 'resolve' and 'resubmit' intentionally absent — both open the
      // prefilled edit-and-resubmit creation modal instead of a status
      // confirm (7/15/26).
      // 'release-hold' intentionally absent (ERP-8796): a hold is a flag,
      // not a status, so there is no status to transition to. It opens the
      // Release Hold dialog, which clears the flag.
      // 'archive' intentionally absent (user 10/1): archiving is a soft
      // delete, not a status change — it opens the reason dialog instead.
      default: return null;
    }
  };
  // Per-action CTA color, matching the tone each action carries in the
  // status stepper (approve/resolve green, money blue, prepay amber,
  // credit violet, archive slate).
  const PRIMARY_CTA_TONE: Record<string, string> = {
    approve: 'bg-emerald-600 hover:bg-emerald-700',
    resolve: 'bg-emerald-600 hover:bg-emerald-700',
    resubmit: 'bg-emerald-600 hover:bg-emerald-700',
    'release-hold': 'bg-emerald-600 hover:bg-emerald-700',
    'make-payment': 'bg-emerald-600 hover:bg-emerald-700',
    'add-prepayment': 'bg-violet-600 hover:bg-violet-700',
    'add-credit': 'bg-violet-600 hover:bg-violet-700',
    'reverse-payment': 'bg-rose-600 hover:bg-rose-700',
    remittance: 'bg-primary hover:bg-[#0862D0]',
    archive: 'bg-red-600 hover:bg-red-700',
    restore: 'bg-primary hover:bg-[#0862D0]',
  };

  // Names of the people notified when a hold / exception was placed —
  // resolved from the action history so release + resolve confirms can
  // offer to notify the same list again (feedback 7/20/26).
  const notifiedNamesFor = (action: string): string[] => {
    const entry = [...(invoice.actionHistory ?? [])].reverse().find((e) => e.action === action);
    return (entry?.notifiedRecipientIds ?? [])
      .map((id) => SYSTEM_ROLES.find((r) => r.id === id)?.name ?? SYSTEM_USERS.find((u) => u.id === id)?.name)
      .filter((n): n is string => !!n);
  };
  const namesSummary = (names: string[]) =>
    names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length - 2} more` : '');
  // Map a picked recipient-id list (roles + users) to display names, for the
  // confirmation toasts on reversal / credit memo (Eli 7/24/26).
  const namesFromIds = (ids: string[]): string[] =>
    ids
      .map((id) => SYSTEM_ROLES.find((r) => r.id === id)?.name ?? SYSTEM_USERS.find((u) => u.id === id)?.name)
      .filter((n): n is string => !!n);
  const notifyLine = (ids: string[]): string | undefined => {
    const names = namesFromIds(ids);
    return names.length > 0 ? `Notification sent to ${namesSummary(names)}.` : undefined;
  };
  const notifiedIdsFor = (action: string): string[] => {
    const entry = [...(invoice.actionHistory ?? [])].reverse().find((e) => e.action === action);
    return entry?.notifiedRecipientIds ?? [];
  };
  const holdNotifiedNames = notifiedNamesFor('paymentHold');
  // The live hold the release confirm names (user 10/4).
  const releaseHoldEntry = [...(invoice.actionHistory ?? [])].reverse().find((e) => e.action === 'paymentHold');
  const exceptionNotifiedNames = notifiedNamesFor('flagException');
  const rejectNotifiedNames = notifiedNamesFor('reject');

  const handleReasonConfirm = (reason: string, notifiedRecipientIds?: string[]) => {
    if (!reasonAction) return;
    const fromStatus = status;
    applyInvoiceAction?.([invoice.id], reasonAction, reason, notifiedRecipientIds);
    setStatusOverride(null);
    const verb =
      reasonAction === 'reject'
        ? 'Invoice rejected'
        : reasonAction === 'cancel'
          ? 'Invoice cancelled'
          : reasonAction === 'flagException'
            ? 'Exception flagged'
            : reasonAction === 'archive'
              ? 'Invoice archived'
              : reasonAction === 'restore'
                ? 'Invoice restored'
                : reasonAction === 'uncancel'
                  ? 'Invoice uncancelled'
                  : 'Placed on payment hold';
    if (reasonAction === 'uncancel') {
      // Uncancel always lands on Pending Approval (Mahreen 10/10).
      toast.success(`${invoice.invoiceNumber} is back to Pending Approval.`);
    } else {
      toast.success(
        verb,
        reasonAction === 'restore'
          ? { description: `${invoice.invoiceNumber} is back to ${mapStatus(invoice.status)}.` }
          : undefined,
      );
    }
    setReasonOpen(false);
    setReasonAction(null);
    // Payment hold is a flag, not a status (ERP-8796): no status moved,
    // so there is no transition to play. The toast says it.
    if (reasonAction === 'paymentHold') return;
    // Same "State Transitioned" response the approve flow plays — every
    // state change answers with the transition overlay (design feedback).
    const target: DisplayStatus =
      reasonAction === 'reject' ? 'Rejected'
        : reasonAction === 'cancel' ? 'Cancelled'
          : reasonAction === 'flagException' ? 'Exception'
            : reasonAction === 'archive' ? 'Archived'
              : reasonAction === 'restore' ? mapStatus(invoice.status)
                : reasonAction === 'uncancel' ? 'Pending Approval'
                  : 'On Hold';
    setTransitionOverlay({ visible: true, from: fromStatus, to: target });
  };

  const handleAction = (action: ActionDef) => {
    switch (action.key) {
      // ── Approval workflow — persist to the shared invoices state ──
      case 'approve':
        // Approving an invoice on a live payment hold confirms first
        // (Nophil 9/22): somebody might ignore the hold otherwise. The
        // confirm spells out that approval does NOT release the hold.
        if (held) {
          setApproveHoldConfirmOpen(true);
          return;
        }
        applyInvoiceAction?.([invoice.id], 'approve', '');
        setStatusOverride(null);
        toast.success('Invoice approved');
        return;
      // ── Resolve exception — same edit-and-resubmit flow as rejection:
      //    the prefilled creation modal opens with the exception reason
      //    replayed, fix anything, then resubmit (7/15/26) ──
      case 'resolve':
        // Resolve = FIX FIRST (BA 9/6, supersedes the resolve-in-place
        // confirm): the edit screen opens DIRECTLY with the exception
        // replayed and the offending column highlighted; the green
        // recordation form (notes + documents + notify) appears at
        // Resubmit — never before the fix.
        onEditResubmit?.(
          invoice,
          [...(invoice.actionHistory ?? [])].reverse().find((e) => e.action === 'flagException')?.reason ?? '',
          undefined,
        );
        return;
      case 'release-hold':
        // Confirm first — releasing OFFERS (never forces) notifying the
        // people who were told about the hold (meeting feedback 7/17/26).
        // Only the people MANUALLY notified when the hold was placed are
        // pre-selected (Eli 9/23 meeting: "you took the time to notify
        // them — they're a watcher; notify them on the unwind"). Nobody
        // is auto-added by role or authorship. Still removable.
        setReleaseSeed(notifiedIdsFor('paymentHold'));
        setReleaseConfirmOpen(true);
        return;
      // ── Reason-required transitions → shared reason dialog ──
      case 'reject':
        setReasonAction('reject');
        setReasonOpen(true);
        return;
      // Archive and Restore (user 10/1): archive is a SOFT DELETE, not a
      // status change, so both ride the reason-required modal family —
      // red archive, blue restore — with the standard notify block.
      case 'archive':
        setReasonAction('archive');
        setReasonOpen(true);
        return;
      case 'restore':
        setReasonAction('restore');
        setReasonOpen(true);
        return;
      case 'cancel':
        setReasonAction('cancel');
        setReasonOpen(true);
        return;
      case 'uncancel':
        setReasonAction('uncancel');
        setReasonOpen(true);
        return;
      case 'payment-hold':
        setReasonAction('paymentHold');
        setReasonOpen(true);
        return;
      case 'raise-exception':
        setReasonAction('flagException');
        setReasonOpen(true);
        return;
      // ── Edit (9/3/26): a Pending Approval invoice reopens the
      //    creation modal in edit mode — no reason banner, saving keeps
      //    it in the approval queue with the changes. ──
      case 'edit':
        onEditResubmit?.(invoice, '', undefined);
        return;
      // ── Edit and resubmit — open the prefilled creation modal with the
      //    rejection reason replayed in a banner (7/15/26; DIRECT since
      //    BA 9/6 — the recordation form lives at Resubmit, not here) ──
      case 'resubmit':
        onEditResubmit?.(
          invoice,
          [...(invoice.actionHistory ?? [])].reverse().find((e) => e.action === 'reject')?.reason ?? '',
          undefined,
        );
        return;
      // ── Payment — launch the pre-scoped Record Payment flow ──
      case 'make-payment':
        if (inRunId) {
          onViewRun?.(inRunId);
          return;
        }
        onPayInvoices?.([invoice.id]);
        return;
      case 'view-run':
        if (inRunId) onViewRun?.(inRunId);
        return;
      // ── Prepayment — launch the Record Prepayment flow for this pre-invoice ──
      case 'add-prepayment':
        onAddPrepayment?.(invoice.vendor, invoice.id);
        return;
      // ── Existing modal flows ──
      case 'add-credit':
        // Reserved in an open run (user 10/1, supersedes the BA 9/28
        // warn-but-allow banner): a credit would change the balance under
        // the run, so the action is blocked. Toast only, no modal; the
        // run ID opens the run in a new tab. A PRE-INVOICE is the exception
        // (Mahreen 10/10): its credit is allowed and the modal warns to
        // lower the run amount instead.
        if (inRunId && invoice.type !== 'Pre-Invoice') {
          toast.info('This invoice is in a payment run', {
            description: (
              <span>
                A credit memo can't be added while {invoice.invoiceNumber} is reserved in{' '}
                <button
                  type="button"
                  onClick={() => window.open(`/payments-v2/runs/${encodeURIComponent(inRunId)}`, '_blank', 'noopener,noreferrer')}
                  className="underline underline-offset-2 text-foreground hover:text-primary transition-colors cursor-pointer"
                  // Sonner buttons carry their own font reset — pin the run
                  // ID to the surrounding description's size and rhythm.
                  style={{ fontWeight: 600, fontSize: 'inherit', lineHeight: 'inherit', fontFamily: 'inherit', padding: 0 }}
                >
                  {inRunId}
                </button>
                . Review the run or remove the invoice from it first.
              </span>
            ),
          });
          return;
        }
        setCreditMemoOpen(true);
        return;
      case 'reverse-payment':
        if (priorPayments.length === 0) {
          toast.info('No prior payments on this invoice to reverse.');
          return;
        }
        setReversePaymentOpen(true);
        return;
      // ── Print / Export (9/5/26, BB-26): one document surface — the
      //    preview modal with Print, Download PDF and Download CSV. ──
      case 'print':
        setDocumentModal('print');
        return;
      case 'export':
        setDocumentModal('export');
        return;
      // Real remittance advice (user 9/23): the paid invoice's header CTA
      // downloads the PDF the payments module already builds.
      case 'remittance': {
        const paid = payments.filter(
          (p) => p.status === 'Paid' && (p.appliedInvoices ?? []).some((a) => a.invoiceNumber === invoice.invoiceNumber),
        );
        const latest = paid[paid.length - 1];
        if (latest) {
          downloadRemittanceAdvice(latest);
          toast.success('Remittance advice downloaded', { description: `${latest.paymentNumber} · ${invoice.vendor}` });
        } else {
          toast.info('No recorded payment to build the advice from', {
            description: 'Record a payment against this invoice first.',
          });
        }
        return;
      }
      default:
        toast.info(`${action.label}, coming next PR.`);
    }
  };

  // One segment per linked document kind, rendered as the payment run's
  // segmented vendors | invoices pill (user 10/10).
  const linkedRecordSegments = (() => {
    const counts: string[] = [];
    if (invoice.linkedPOs?.length) counts.push(`${invoice.linkedPOs.length} PO${invoice.linkedPOs.length === 1 ? '' : 's'}`);
    if (invoice.linkedGRNs?.length) {
      const n = invoice.linkedGRNs.length;
      counts.push(`${n} Receiving Document${n === 1 ? '' : 's'}`);
    }
    return counts;
  })();

  // Header description: the invoice's own description, nothing else
  // (user 10/4). The synthesized metadata recital (type, balance, AP
  // account, dates) read like a system dump — all of it already lives
  // in the summary cards and Linked Records.
  const descriptionText = invoice.description || '';
  const descNeedsTruncation = descriptionText.length > 140;

  return (
    <div ref={scrollContainerRef} className="flex-1 flex flex-col bg-slate-50">
      {/* IntersectionObserver sentinel — sits just below the topbar */}
      <div ref={sentinelRef} className="shrink-0 h-px" />

      {/* ══════════════════════════════════════════════
          STICKY MORPHING HEADER CARD
         ══════════════════════════════════════════════ */}
      {/* z-30 (user 9/29): the shared DataTable's sticky header + frozen
          columns sit at z-20 and painted OVER this header while scrolling
          (they come later in the DOM). The page header wins, like the
          partner module's. */}
      <div className="shrink-0 sticky top-0 z-30 bg-slate-50">
        <div style={{ paddingTop: isScrolled ? '8px' : '12px', paddingBottom: '4px', transition: 'padding-top 250ms ease' }}>
          <div className={`mx-auto px-3 transition-all duration-300 ${isFullscreen ? 'max-w-full' : 'max-w-[1440px] 2xl:max-w-[1600px]'}`}>
            <div
              className={`border rounded-xl overflow-hidden transition-shadow duration-250 ${
                isScrolled
                  ? 'shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_4px_12px_-4px_rgba(0,0,0,0.05)]'
                  : 'shadow-sm'
              }`}
              style={headerCardStyle(status)}
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
                    aria-label="Back to invoice list"
                  >
                    <ChevronLeft className="text-slate-400 transition-all duration-250" style={{ width: isScrolled ? 16 : 20, height: isScrolled ? 16 : 20 }} />
                  </button>

                  {/* Avatar tile — dynamic per INVOICE TYPE, wearing the
                      exact icon + colors of the listing's Invoice Type
                      pill (TYPE_PALETTE): Receiving truck/green,
                      Pre-Invoice package/amber-dashed, Standalone
                      calculator/purple (feedback 7/15/26). */}
                  {(() => {
                    const t = TYPE_PALETTE[invoice.type] ?? CATEGORY_META[invoiceCategory(invoice.type)];
                    const TypeIcon = t.icon;
                    const dashed = 'dashed' in t && t.dashed;
                    return (
                      <div
                        className="rounded-xl flex items-center justify-center shrink-0 transition-all duration-250"
                        style={{
                          width: isScrolled ? 32 : 44,
                          height: isScrolled ? 32 : 44,
                          backgroundColor: t.bg,
                          border: `1px ${dashed ? 'dashed' : 'solid'} ${t.border}`,
                          boxShadow: '0 1px 3px 0 rgba(0,0,0,0.04)',
                        }}
                      >
                        <TypeIcon className="transition-all duration-250" style={{ width: isScrolled ? 14 : 18, height: isScrolled ? 14 : 18, color: t.color }} />
                      </div>
                    );
                  })()}

                  <div className="min-w-0 flex-1">
                    {/* Line 1 — title + status + type + linked-records pill */}
                    <div className="flex items-center flex-wrap" style={{ gap: isScrolled ? 6 : 8 }}>
                      <h1
                        className="text-foreground truncate transition-all duration-250 "
                        style={{ fontSize: isScrolled ? 13 : 16, fontWeight: isScrolled ? 600 : 700, lineHeight: isScrolled ? '18px' : '22px' }}
                      >
                        {invoice.invoiceNumber}
                      </h1>

                      {/* Type pill — mirrors the listing table's Type column
                          exactly: one flat pill per type (taxonomy rev
                          7/9/26); Pre-Invoice alone is violet + dashed since
                          it's a deposit, not an invoice. Tooltip explains
                          the type in plain language (peer review 7/7/26).
                          Pill order rev 7/16/26: number, type, vendor,
                          status, linked records. */}
                      {(() => {
                        const explainer = TYPE_EXPLAINER[invoice.type] ?? TYPE_EXPLAINER.Standalone;
                        const pal = TYPE_PALETTE[invoice.type] ?? TYPE_PALETTE.Standalone;
                        const PalIcon = pal.icon;
                        return (
                          <Tooltip delayDuration={300}>
                            <TooltipTrigger asChild>
                              <span
                                className={`inline-flex items-center gap-1 rounded-md transition-all duration-250 cursor-default ${pal.dashed ? 'border border-dashed' : 'border'}`}
                                style={{
                                  padding: isScrolled ? '1px 6px' : '2px 8px',
                                  fontSize: isScrolled ? 10 : 11,
                                  fontWeight: 600,
                                  backgroundColor: pal.bg,
                                  color: pal.color,
                                  borderColor: pal.border,
                                }}
                              >
                                <PalIcon className="transition-all duration-250" style={{ width: isScrolled ? 10 : 12, height: isScrolled ? 10 : 12 }} />
                                {pal.label}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-[260px] z-[300]">
                              <TooltipExplainer text={explainer} />
                            </TooltipContent>
                          </Tooltip>
                        );
                      })()}

                      {/* Vendor pill — clickable to the partner page with the
                          VendorQuickCard hover preview. (The vendor is also
                          surfaced prominently in the sidebar vendor card.) */}
                      <HoverCard openDelay={300} closeDelay={120}>
                        <HoverCardTrigger asChild>
                          <button
                            type="button"
                            onClick={() => window.open(partnerVendorUrl(invoice.vendor), '_blank', 'noopener,noreferrer')}
                            className="inline-flex items-center gap-1 rounded-md border bg-white hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 cursor-pointer"
                            style={{
                              padding: isScrolled ? '1px 6px 1px 4px' : '2px 8px 2px 4px',
                              fontSize: isScrolled ? 10 : 11,
                              fontWeight: 600,
                              color: 'hsl(var(--primary))',
                              borderColor: 'hsl(var(--border))',
                            }}
                            title={`Open ${invoice.vendor} in Partners`}
                          >
                            {/* Initials avatar, not the truck (user 10/1):
                                the AR pill's treatment, both modules match. */}
                            <VendorAvatar name={invoice.vendor} size="xs" />
                            <span className="truncate max-w-[180px]">{invoice.vendor}</span>
                          </button>
                        </HoverCardTrigger>
                        <HoverCardContent
                          side="bottom"
                          align="start"
                          sideOffset={6}
                          className="p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden w-auto"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <VendorQuickCard vendor={invoice.vendor} description={invoice.description} />
                        </HoverCardContent>
                      </HoverCard>

                      {/* Status pills — read-only, TWO axes (Eli review
                          7/15/26): approval answers "whose desk is this
                          on," payment answers "where's the money."
                          Archived keeps its single terminal pill. */}
                      {status === 'Archived' ? (
                        <span
                          className="inline-flex items-center rounded-full border"
                          style={{
                            padding: isScrolled ? '1px 6px' : '2px 8px',
                            fontSize: isScrolled ? 10 : 11,
                            fontWeight: 600,
                            backgroundColor: statusPalette.bg,
                            color: statusPalette.color,
                            borderColor: statusPalette.border,
                          }}
                        >
                          Archived
                        </span>
                      ) : (() => {
                        const approvalLabel =
                          status === 'Pending Approval' ? 'Pending Approval'
                          : status === 'Rejected' || status === 'Exception' || status === 'Cancelled' ? statusDisplayLabel(status)
                          : 'Approved';
                        const approvalPalette =
                          status === 'Pending Approval' ? STATUS_PALETTE['Pending Approval']
                          : status === 'Rejected' || status === 'Exception' || status === 'Cancelled' ? STATUS_PALETTE[status]
                          : STATUS_PALETTE.Approved;
                        // The hold gets its OWN pill (feedback 7/21/26): it
                        // is a control fact, so the approval pill keeps
                        // telling the approval truth (a held pending
                        // invoice still reads Pending approval) and the
                        // payment pill keeps telling the money truth (a
                        // held, partially paid invoice reads Partially paid).
                        const partiallyCovered = numbers.paid > 0.004;
                        const paymentLabel =
                          invoice.status === 'Settled' ? 'Settled'
                          : status === 'Partially Paid' ? 'Partially Paid'
                          : status === 'Paid' ? 'Paid in Full'
                          : status === 'On Hold' ? (partiallyCovered ? 'Partially Paid' : 'Unpaid')
                          : status === 'Partially Prepaid' ? 'Partially Prepaid'
                          : status === 'Prepaid' ? 'Prepaid'
                          : status === 'Cancelled' ? null
                          // In a run, the segmented run pill below carries
                          // the payment story — no separate pill (user 10/1).
                          : inRunId && !partiallyCovered ? null
                          : 'Unpaid';
                        const paymentPalette =
                          invoice.status === 'Settled' ? { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' }
                          : status === 'Partially Paid' ? STATUS_PALETTE['Partially Paid']
                          : status === 'Paid' ? STATUS_PALETTE.Paid
                          : status === 'On Hold' ? (partiallyCovered ? STATUS_PALETTE['Partially Paid'] : { bg: '#F1F5F9', color: '#475569', border: '#E2E8F0' })
                          : status === 'Partially Prepaid' ? STATUS_PALETTE['Partially Prepaid']
                          : status === 'Prepaid' ? STATUS_PALETTE.Prepaid
                          : inRunId && !partiallyCovered ? { bg: '#EEF2FF', color: '#4338CA', border: '#C7D2FE' }
                          : { bg: '#F1F5F9', color: '#475569', border: '#E2E8F0' };
                        const pillStyle = (p: { bg: string; color: string; border: string }) => ({
                          padding: isScrolled ? '1px 6px' : '2px 8px',
                          fontSize: isScrolled ? 10 : 11,
                          fontWeight: 600,
                          backgroundColor: p.bg,
                          color: p.color,
                          borderColor: p.border,
                        });
                        return (
                          <>
                            <span className="inline-flex items-center rounded-full border" style={pillStyle(approvalPalette)}>
                              {approvalLabel}
                            </span>
                            {held && status !== 'Cancelled' && (
                              /* Beside the status, never replacing it
                                 (ERP-8796, AC8); the lock matches the
                                 listing's Invoice ID indicator. */
                              <span className="inline-flex items-center gap-1 rounded-full border" style={pillStyle(STATUS_PALETTE['On Hold'])}>
                                <Lock style={{ width: isScrolled ? 9 : 11, height: isScrolled ? 9 : 11 }} />
                                On Hold
                              </span>
                            )}
                            {paymentLabel && (
                              <span className="inline-flex items-center rounded-full border" style={pillStyle(paymentPalette)}>
                                {paymentLabel}
                              </span>
                            )}
                            {inRunId && (
                              /* ONE segmented pill (user 10/1), the payment-
                                 term pill's clubbed recipe: tinted label
                                 segment + white ID segment. Clicking opens
                                 the run in a new tab like every other
                                 cross-record link from the header. */
                              <button
                                type="button"
                                onClick={() => window.open(`/payments-v2/runs/${encodeURIComponent(inRunId)}`, '_blank', 'noopener,noreferrer')}
                                className="inline-flex items-stretch rounded-full overflow-hidden border shrink-0 cursor-pointer group/runpill"
                                style={{ borderColor: '#C7D2FE' }}
                                title="Open the payment run holding this invoice"
                              >
                                <span
                                  className="inline-flex items-center"
                                  style={{
                                    padding: isScrolled ? '1px 6px' : '2px 8px',
                                    fontSize: isScrolled ? 10 : 11,
                                    fontWeight: 600,
                                    backgroundColor: '#EEF2FF',
                                    color: '#4338CA',
                                  }}
                                >
                                  In Payment Run
                                </span>
                                <span
                                  className="inline-flex items-center bg-white text-slate-500 border-l transition-colors group-hover/runpill:bg-indigo-50 group-hover/runpill:text-indigo-700 group-hover/runpill:underline underline-offset-2"
                                  style={{
                                    padding: isScrolled ? '1px 6px' : '2px 8px',
                                    fontSize: isScrolled ? 10 : 11,
                                    fontWeight: 500,
                                    borderColor: '#C7D2FE',
                                  }}
                                >
                                  {inRunId}
                                </span>
                              </button>
                            )}
                          </>
                        );
                      })()}

                      {!isScrolled && (
                        /* The payment run's segmented pill (user 10/10);
                           clicking jumps to the Linked Records tab. */
                        <SegmentedCountPill
                          segments={linkedRecordSegments}
                          icon={Link2}
                          onClick={() => setActiveTab('linked-records')}
                          title="Open the Linked Records tab"
                        />
                      )}
                    </div>

                    {/* Row 2 — description block with show more/less.
                        Matches the partner two-row title pattern: code +
                        pills on row 1, description on row 2. Vendor /
                        posting / match metadata lives in the sidebar's
                        General Information + 3-Way Matching sections.
                        Records without a description skip the row (user
                        10/4 — no synthesized filler). */}
                    {descriptionText && (
                    <div
                      className="overflow-hidden transition-all duration-250 ease-in-out max-w-3xl relative"
                      style={{
                        maxHeight: isScrolled ? 0 : descExpanded ? 500 : 20,
                        opacity: isScrolled ? 0 : 1,
                        marginTop: isScrolled ? 0 : 4,
                      }}
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

                {/* Right: Fullscreen + Actions + Edit CTA */}
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
                              const cat = detailActionCategory(action.key);
                              const isAffirmative =
                                action.key === 'approve' ||
                                action.key === 'resolve' ||
                                action.key === 'release-hold' ||
                                action.key === 'restore';
                              const tone: ActionTone =
                                cat === 'destructive'
                                  ? 'destructive'
                                  // Payment Hold reads amber like its modal
                                  // (feedback 7/16/26) even though it groups
                                  // with the balance adjustments.
                                  : cat === 'warning' || action.key === 'payment-hold'
                                    ? 'warning'
                                    : isAffirmative
                                      ? 'positive'
                                      : 'neutral';
                              const cls = actionToneClass(tone);
                              return (
                                <DropdownMenuItem
                                  key={action.key}
                                  onClick={() => handleAction(action)}
                                  className={cls.item}
                                >
                                  <action.icon className={`w-4 h-4 mr-2 ${cls.icon}`} />
                                  {action.label}
                                </DropdownMenuItem>
                              );
                            })}
                          </Fragment>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Reject sits beside Approve while pending (design 7/9). */}
                  {isPending && (
                    <button
                      onClick={() => handleAction({ key: 'reject', label: 'Reject', icon: Ban })}
                      className={`rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm ${isScrolled ? 'h-8 px-3.5 text-[12px]' : 'h-9 px-4 text-[13px]'}`}
                      style={{ fontWeight: 600 }}
                    >
                      <Ban className={isScrolled ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                      Reject
                    </button>
                  )}

                  {/* Reverse Payment sits beside the money CTA once any
                      payment exists — partially or fully paid (design 7/9).
                      NOT for Settled: a full credit memo moved no cash, so
                      there is no payment to reverse (feedback 7/21/26). */}
                  {(status === 'Partially Paid' || status === 'Paid') && invoice.status !== 'Settled' && hasReversiblePayment && (
                    <button
                      onClick={() => handleAction({ key: 'reverse-payment', label: 'Reverse Payment', icon: Undo2 })}
                      className={`rounded-lg bg-rose-600 hover:bg-rose-700 text-white inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm ${isScrolled ? 'h-8 px-3.5 text-[12px]' : 'h-9 px-4 text-[13px]'}`}
                      style={{ fontWeight: 600 }}
                    >
                      <Undo2 className={isScrolled ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                      Reverse Payment
                    </button>
                  )}

                  {/* State-aware primary CTA (design feedback 7/8/26, PO / SO
                      recipe): the status's flagship action is the one colored
                      button — Approve, Add Payment, Resolve, Release Hold,
                      Add Credit Memo, Archive — and pure status transitions
                      run through the same confirm modal + transition
                      animation the status pill used. Edit lives in Actions. */}
                  {primaryAction && (() => {
                    const PIcon = primaryAction.icon;
                    const tone = PRIMARY_CTA_TONE[primaryAction.key] ?? 'bg-primary hover:bg-[#0862D0]';
                    return (
                      <button
                        onClick={() => {
                          // Approving with a live payment hold confirms
                          // first (Nophil 9/22) — same gate as the menu.
                          if (primaryAction.key === 'approve' && held) {
                            setApproveHoldConfirmOpen(true);
                            return;
                          }
                          const target = statusTargetForPrimary(primaryAction.key);
                          if (target) setStatusChangeTarget(target);
                          else handleAction(primaryAction);
                        }}
                        className={`rounded-lg ${tone} text-white inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm ${isScrolled ? 'h-8 px-3.5 text-[12px]' : 'h-9 px-4 text-[13px]'}`}
                        style={{ fontWeight: 600 }}
                      >
                        <PIcon className={isScrolled ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                        {primaryAction.label}
                      </button>
                    );
                  })()}
                </div>
              </div>

              {/* Status workflow bar — hidden in compact mode */}
              <div
                className="overflow-hidden transition-all duration-250 ease-in-out border-t border-muted"
                style={{
                  maxHeight: isScrolled ? 0 : 80,
                  opacity: isScrolled ? 0 : 1,
                }}
              >
                <StatusWorkflowBar status={status} invoice={invoice} records={linkedFinancials?.records ?? []} appPayments={payments} paymentsContext={fromPayments} />
              </div>

              {/* Tab bar — always visible at the bottom of the card */}
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
          // The real scroll container is Layout's children div
          // (`<div className="flex-1 overflow-y-auto">` in Layout.tsx)
          // — we walk up the DOM until we find the first element
          // whose `overflow-y` is auto/scroll so the FAB works
          // regardless of where the scroll context lives.
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
              {/* Exception + live hold share ONE card (user 9/23) instead
                  of two stacked banners; anything else keeps the single
                  status banner, with the hold banner alongside when a
                  pre-approval hold rides another status (7/21/26). */}
              {held && status === 'Exception' ? (
                <CombinedFlagsBanner
                  invoice={invoice}
                  onResolveException={() => handleAction({ key: 'resolve', label: 'Resolve', icon: CheckCircle2 })}
                  onReleaseHold={() => handleAction({ key: 'release-hold', label: 'Release Hold', icon: RotateCcw })}
                />
              ) : (
                <>
                  <StatusReasonBanner
                    invoice={invoice}
                    status={status}
                    onResolveException={() => handleAction({ key: 'resolve', label: 'Resolve', icon: CheckCircle2 })}
                    onResubmit={() => handleAction({ key: 'resubmit', label: 'Edit and Resubmit', icon: RotateCcw })}
                    onReleaseHold={() => handleAction({ key: 'release-hold', label: 'Release Hold', icon: RotateCcw })}
                  />
                  {held && status !== 'On Hold' && (
                    <StatusReasonBanner
                      invoice={invoice}
                      status={'On Hold'}
                      onReleaseHold={() => handleAction({ key: 'release-hold', label: 'Release Hold', icon: RotateCcw })}
                    />
                  )}
                </>
              )}
              {activeTab === 'line-items' && (
                <LineItemsTab invoice={invoice} subtotal={numbers.subtotal} isPending={isPending} />
              )}
              {activeTab === 'linked-records' && (
                <LinkedRecordsTab
                  invoice={invoice}
                  records={[...linkedProcurement, ...reconciliationRecords, ...(linkedFinancials?.records ?? [])]}
                  totalAmount={numbers.total}
                  onViewCreditMemo={(creditMemoNumber) => {
                    // Session memos have a real page (VI-18); a seed's
                    // synthetic row has no record behind it, so say so
                    // instead of navigating to nothing.
                    if (creditMemos.some((m) => m.creditMemoNumber === creditMemoNumber)) {
                      onViewCreditMemo?.(creditMemoNumber);
                    } else {
                      toast.info('Sample credit memo', { description: `${creditMemoNumber} is seeded demo history without a full record behind it. Memos you create open their own page.` });
                    }
                  }}
                />
              )}
              {activeTab === 'payments' && (
                <PaymentsTab
                  invoice={invoice}
                  payments={payments}
                  records={linkedFinancials?.records ?? []}
                  onViewPayment={(paymentNumber) =>
                    // Stay inside the ledger the invoice was opened in: a
                    // customer invoice links to Customer Payments (7/17/26).
                    navigate(
                      `${location.pathname.startsWith('/customer-') ? '/customer-payments' : '/payments-v2'}/${encodeURIComponent(paymentNumber)}`,
                      { state: { from: location.pathname } },
                    )
                  }
                  onContinuePayment={() => onPayInvoices?.([invoice.id])}
                  onViewCreditMemo={(creditMemoNumber) => {
                    // Session memos have a real page; a seed's synthetic
                    // memo row has no record behind it, so say so instead
                    // of navigating to nothing.
                    if (creditMemos.some((m) => m.creditMemoNumber === creditMemoNumber)) {
                      onViewCreditMemo?.(creditMemoNumber);
                    } else {
                      toast.info('Sample credit memo', { description: `${creditMemoNumber} is seeded demo history without a full record behind it. Memos you create open their own page.` });
                    }
                  }}
                />
              )}
              {activeTab === 'gl-impact' && (
                <GLImpactTab invoice={invoice} numbers={numbers} payments={priorPayments} />
              )}
              {/* Coming Soon placeholders (user 10/2, superseding the QC02
                  full pass for now): the built NotesTab / CommunicationTab
                  / ActivityTab stay in the codebase, dormant, until the
                  design is wanted — these tabs show the full-height
                  placeholder meanwhile. */}
              {activeTab === 'notes' && (
                <NotesTab
                  notes={notes}
                  onAddNote={(text) => onAddNote?.(invoice.id, text)}
                  onUpdateNote={(noteId, text) => onUpdateNote?.(invoice.id, noteId, text)}
                  onDeleteNote={(noteId) => onDeleteNote?.(invoice.id, noteId)}
                />
              )}
              {activeTab === 'communication' && (
                <ComingSoonTab
                  label="Communications"
                  icon={MessageSquare}
                  description="Message history for this invoice, with your team and the vendor, will live here. The shared communication surface keeps every conversation attached to the record it is about."
                />
              )}
              {activeTab === 'attachments' && <AttachmentsTab invoice={invoice} />}
              {activeTab === 'activity' && (
                <ComingSoonTab
                  label="Activity"
                  icon={History}
                  description="A chronological audit trail of every action on this invoice: edits, approvals, payments, holds, and exceptions. The activity feed arrives with backend integration."
                />
              )}
            </div>

            {/* ── RIGHT: sticky sidebar, visible across every tab ── */}
            <InvoiceDetailSidebar
              invoice={invoice}
              numbers={numbers}
              status={status}
              statusPalette={statusPalette}
              records={linkedFinancials?.records ?? []}
              // Flags cards resolve/release in place (Eli 9/8) — same
              // actions the status banner offers, one more entry point.
              onResolveException={() => handleAction({ key: 'resolve', label: 'Resolve', icon: CheckCircle2 })}
              onReleaseHold={() => handleAction({ key: 'release-hold', label: 'Release Hold', icon: RotateCcw })}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddCreditMemoModal
        open={creditMemoOpen}
        onOpenChange={setCreditMemoOpen}
        invoiceNumber={invoice.invoiceNumber}
        invoiceType={invoice.type}
        invoiceGlAccount={invoice.savedLineItems?.[0]?.glAccount}
        invoiceApAccount={invoice.apAccount}
        vendorName={invoice.vendor}
        outstandingBalance={numbers.outstanding}
        currency={invoice.currency}
        inRunId={invoice.type === 'Pre-Invoice' ? inRunId : undefined}
        onSubmit={(payload) => {
          // Credit memos are REAL records in App state (9/22/26 review
          // response): they persist across navigation, reduce the balance
          // through the same settle handler payments use (via 'credit',
          // so nothing reads as "paid"), and open a real page.
          const settled = numbers.outstanding - payload.amount <= 0.004;
          onAddCreditMemo?.(invoice.id, {
            id: `cm-${Date.now()}`,
            creditMemoNumber: payload.creditMemoNumber,
            vendor: invoice.vendor,
            invoiceNumber: invoice.invoiceNumber,
            invoiceType: invoice.type,
            date: payload.date,
            reason: payload.reason,
            description: payload.description || '',
            amount: settled ? invoice.outstandingBalance : payload.amount,
            currency: invoice.currency,
            createdBy: 'Ahtisham Ahmad',
            status: 'Applied',
          });
          if (invoice.type === 'Pre-Invoice') {
            // Mahreen 10/10: one plain toast; the run reminder rides along.
            const newOutstanding = Math.max(0, Math.round((numbers.outstanding - payload.amount) * 100) / 100);
            setStatusOverride(null);
            toast.success('Credit memo added', {
              description: [
                inRunId ? `This pre-invoice is in a payment run. Lower the run amount to ${invoice.currency === 'USD' ? '$' : invoice.currency + ' '}${newOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} before it is paid.` : undefined,
                payload.notify ? notifyLine(payload.notifiedRecipientIds) : undefined,
              ].filter(Boolean).join(' ') || undefined,
            });
          } else if (settled) {
            setStatusOverride(null);
            toast.success(`${payload.creditMemoNumber} created, invoice settled`, {
              description: ['The credit memo covered the entire remaining balance.', payload.notify ? notifyLine(payload.notifiedRecipientIds) : undefined].filter(Boolean).join(' '),
            });
          } else {
            toast.success(`${payload.creditMemoNumber} created`, {
              description: [`${payload.reason} · ${invoice.currency === 'USD' ? '$' : invoice.currency + ' '}${payload.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, payload.notify ? notifyLine(payload.notifiedRecipientIds) : undefined].filter(Boolean).join(' · '),
            });
          }
        }}
      />
      <ReversePaymentModal
        open={reversePaymentOpen}
        onOpenChange={setReversePaymentOpen}
        invoiceNumber={invoice.invoiceNumber}
        vendorName={invoice.vendor}
        outstandingBalance={numbers.outstanding}
        totalAmount={numbers.total}
        currency={invoice.currency}
        payments={priorPayments}
        entity={invoice.type === 'Pre-Invoice' ? 'prepayment' : 'payment'}
        onSubmit={(payload) => {
          const isPre = invoice.type === 'Pre-Invoice';
          // Retire the reversed source row IN PLACE — its line stays with a
          // Reversed status, no mirror record is appended (7/15/26).
          setSessionReversals((prev) => [
            ...prev,
            { reversedReference: payload.paymentReference },
          ]);
          // Balance + status restore at App level so the listing, the
          // Record Payment flow and the reverse dropdown all read the
          // post-reversal numbers (feedback 7/15/26). The handler is
          // payment-centric (9/22/26): a real record restores every
          // invoice it covered plus consumed credit; the id/amount pair
          // only drives the seed-synthetic fallback.
          onReversePayment?.({ invoiceId: invoice.id, paymentReference: payload.paymentReference, amount: payload.reversalAmount, reason: payload.reason });
          setStatusOverride(null);
          toast.success(`${isPre ? 'Prepayment' : 'Payment'} ${payload.paymentReference} reversed`, {
            description: [`${payload.reason} · ${invoice.currency === 'USD' ? '$' : invoice.currency + ' '}${payload.reversalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, payload.notify ? notifyLine(payload.notifiedRecipientIds) : undefined].filter(Boolean).join(' · '),
          });
        }}
      />

      {/* Print / Export — one document surface (9/5/26, BB-26). */}
      {documentModal && (
        <InvoiceDocumentModal
          open
          mode={documentModal}
          onOpenChange={(o) => { if (!o) setDocumentModal(null); }}
          invoice={invoice}
          subtotal={numbers.subtotal}
          // The INVOICE'S OWN term prints (GPT QC20, 9/30): the vendor
          // default printed "Net 45 Post Receiving" on a Net 30 invoice.
          paymentTerms={invoice.paymentTerms ?? vendorData?.paymentTerms}
          // Cash vs credit split for the output (QC19): a credit memo is
          // not money paid, so the document never calls it Paid to date.
          creditsTotal={numbers.credits}
        />
      )}

      {/* Reason capture for reject / cancel / payment-hold / flag-as-exception */}
      <InvoiceReasonDialog
        open={reasonOpen}
        onOpenChange={(open) => {
          setReasonOpen(open);
          if (!open) setReasonAction(null);
        }}
        action={reasonAction}
        count={1}
        currentStatus={status}
        // Gates cancel/archive reasons to this invoice's state (Eli 10/5).
        invoiceType={invoice.type}
        onConfirm={handleReasonConfirm}
        // Cancelling a POSTED invoice reverses its GL posting — the modal
        // previews the reversing entry (feedback 7/21/26). The preview
        // FLIPS the invoice's actual journal (GPT QC18, 9/30: a
        // hardcoded AP/Inventory pair previewed while the real reversal
        // mirrored the 2100 accrual + 5205 variance lines): the saved
        // glEntries snapshot when the record carries one, the GL tab's
        // type fallback for seeds. Unposted invoices show nothing.
        glReversal={
          reasonAction === 'cancel' &&
          ['Approved', 'Partially Paid', 'Paid in Full', 'Payment Hold'].includes(invoice.status)
            ? (invoice.glEntries && invoice.glEntries.length > 0
                ? invoice.glEntries.map((e) => ({
                    code: e.accountCode,
                    name: e.accountName,
                    // The reversal flips each side of the original entry.
                    debit: e.credit ?? 0,
                    credit: e.debit ?? 0,
                  }))
                : [
                    { code: '2000', name: 'Accounts Payable', debit: invoice.amount, credit: 0 },
                    invoice.type === 'Standalone'
                      ? { code: '6000', name: 'Operating Expenses', debit: 0, credit: invoice.amount }
                      : { code: '2100', name: 'AP Accrual', debit: 0, credit: invoice.amount },
                  ])
            : undefined
        }
      />

      {/* Approve-on-hold confirm (Nophil 9/22): approving does NOT
          release the hold, and somebody might miss that — so it says so,
          and offers the release right here ("now or later"). */}
      <AlertDialog open={approveHoldConfirmOpen} onOpenChange={setApproveHoldConfirmOpen}>
        <AlertDialogContent
          className="p-0 overflow-hidden gap-0 rounded-2xl border-0 max-w-[calc(100%-2rem)] sm:max-w-[440px]"
          style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
        >
          <div
            className="relative flex flex-col items-center pt-7 pb-4 shrink-0"
            style={{ background: 'linear-gradient(180deg, #FEFCE8 0%, rgba(254,252,232,0.3) 70%, transparent 100%)' }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full opacity-25 pointer-events-none" style={{ backgroundColor: '#A16207', filter: 'blur(50px)' }} />
            <div className="relative w-[56px] h-[56px] rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FEF9C3' }}>
              <Lock className="w-7 h-7" style={{ color: '#A16207', strokeWidth: 2 }} />
            </div>
            <span className="mt-2.5 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#FEFCE8', color: '#A16207' }}>
              Payment Hold
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-6">
            <AlertDialogTitle className="text-[20px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600, lineHeight: 1.3 }}>
              Approve this invoice?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] mt-1.5 mx-auto text-muted-foreground" style={{ lineHeight: 1.6, maxWidth: '360px' }}>
              You're approving an invoice which was placed on a "Payment Hold". Approving this invoice will not release it for vendor payments. You can release the payment hold now or later.
            </AlertDialogDescription>
          </div>
          <div className="px-6 pt-4 pb-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setApproveHoldConfirmOpen(false);
                applyInvoiceAction?.([invoice.id], 'approve', '');
                setStatusOverride(null);
                toast.success('Invoice approved', { description: 'The payment hold stays on until you release it.' });
              }}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90 text-white"
              style={{ fontWeight: 600, backgroundColor: '#047857' }}
            >
              Approve Invoice
            </button>
            {/* Outlined, like the header action CTAs (user 9/23):
                yellow border + text, yellow fill on hover. */}
            <button
              type="button"
              onClick={() => {
                setApproveHoldConfirmOpen(false);
                applyInvoiceAction?.([invoice.id], 'approve', '');
                setStatusOverride(null);
                toast.success('Invoice approved');
                handleAction({ key: 'release-hold', label: 'Release Hold', icon: RotateCcw });
              }}
              className="w-full h-11 text-[14px] rounded-xl bg-white border border-yellow-300 text-yellow-700 hover:bg-yellow-50 hover:border-yellow-400 cursor-pointer transition-colors shadow-sm"
              style={{ fontWeight: 600 }}
            >
              Approve and Release Hold
            </button>
            <button
              type="button"
              onClick={() => setApproveHoldConfirmOpen(false)}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
              style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
            >
              Go Back
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Release hold confirm — the shared ReleaseHoldDialog (user
          10/22/26): the same dialog payment runs use. */}
      <ReleaseHoldDialog
        open={releaseConfirmOpen}
        onOpenChange={setReleaseConfirmOpen}
        // One line (user 10/4), replacing the conditional trio.
        description="The invoice can be paid again. Its approval status doesn't change."
        // Hold provenance (user 10/4), from the latest paymentHold entry.
        holdBy={releaseHoldEntry?.by}
        holdAt={releaseHoldEntry?.at}
        seedRecipientIds={releaseSeed}
        onConfirm={({ notes, recipientIds, recipientNames, attachments }) => {
          applyInvoiceAction?.([invoice.id], 'releaseHold', notes, recipientIds, attachments);
          setStatusOverride(null);
          setReleaseConfirmOpen(false);
          toast.success(status === 'Pending Approval' || status === 'Exception' ? 'Hold released, invoice back in the approval queue.' : 'Hold released, invoice ready for payment.', {
            // The toast names the people actually SELECTED (Eli 9/23: no
            // auto-notified creator), so names == count.
            description: recipientNames.length > 0
              ? `Release notification sent to ${namesSummary(recipientNames)}.`
              : undefined,
          });
        }}
      />


      {/* Status change confirmation — 1:1 port of the partner
          "Discard partner creation?" modal recipe
          (VendorSelectionModalNested.tsx lines 1908-2016), tinted
          per target status:
            - Soft radial glow header (linear-gradient + blurred
              status-colored blob)
            - 64x64 rounded-2xl icon tile (NOT a circle) with the
              target's container tint and the saturated icon color
            - Uppercase status chip below the tile
            - 18px tracking-tight heading + 13px muted body
              line-height 1.65, 300px max-width
            - Full-width stacked buttons, h-11, rounded-xl. Primary
              uses STEP_COLORS[target].solid; secondary is the
              partner slate footer band.
       */}
      <AlertDialog open={!!statusChangeTarget} onOpenChange={(open) => { if (!open) setStatusChangeTarget(null); }}>
        <AlertDialogContent
          // sm:-scoped width (user 9/9): the bare max-w-[420px] lost to the
          // base's sm:max-w-lg on desktop, so this confirm rendered 512px
          // wide — wider than the discard modal it should match.
          className="max-w-[calc(100%-2rem)] sm:max-w-[420px] p-0 overflow-hidden gap-0 rounded-2xl border-0"
          style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
        >
          {(() => {
            if (!statusChangeTarget) return null;
            // Resolving an exception always returns to Pending Approval,
            // but the moment is a positive resolution — the modal and its
            // CTA wear the Resolve button's emerald, not the indigo of
            // the target status (feedback 7/15/26).
            const isResolveException = statusChangeTarget === 'Pending Approval' && status === 'Exception';
            // Resubmitting a rejected invoice is the same positive-return
            // moment — it wears the header button's emerald too (7/15/26).
            const isResubmit = statusChangeTarget === 'Pending Approval' && status === 'Rejected';
            const isPositiveReturn = isResolveException || isResubmit;
            const targetStep = isPositiveReturn ? STEP_COLORS.Approved : STEP_COLORS[statusChangeTarget];
            const targetPalette = isPositiveReturn ? STATUS_PALETTE.Approved : STATUS_PALETTE[statusChangeTarget];
            const solid = targetStep.solid;
            // Destructive transitions get the partner-style red
            // alert-triangle icon; positive / neutral transitions use
            // the CheckCircle that the partner Mark-as-Inactive modal
            // shows for non-destructive confirmations.
            const isDestructive =
              statusChangeTarget === 'Rejected'
              || statusChangeTarget === 'Cancelled'
              || statusChangeTarget === 'Exception';
            const HeaderIcon = isDestructive ? AlertTriangle : CheckCircle2;
            // Lighter shade for gradient + chip — color-mix lifts the
            // STATUS_PALETTE.bg 50% toward white so it reads as the
            // "50" step of the palette ladder.
            const lightTint = `color-mix(in srgb, ${targetPalette.bg} 50%, white)`;
            return (
              <>
                {/* Colored glow header */}
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

                  {/* 72x72 icon tile — partner reference */}
                  <div
                    className="relative w-[72px] h-[72px] rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: targetPalette.bg }}
                  >
                    <HeaderIcon className="w-9 h-9" style={{ color: solid, strokeWidth: 2 }} />
                  </div>

                  {/* Pill wears the ACTION, not the resulting status — this
                      is a confirmation, nothing has changed yet (7/15/26). */}
                  <span
                    className="mt-4 px-3 py-1 rounded-full text-[11px]"
                    style={{
                      fontWeight: 600,
                      backgroundColor: lightTint,
                      color: targetPalette.color,
                    }}
                  >
                    {statusChangeTarget === 'Approved' && status === 'Pending Approval'
                      ? 'Approve'
                      : statusChangeTarget === 'Approved' && status === 'On Hold'
                        ? 'Release Hold'
                        : statusChangeTarget === 'Pending Approval' && status === 'Rejected'
                          ? 'Resubmit'
                          : isResolveException
                            ? 'Resolve'
                            : `To ${statusDisplayLabel(statusChangeTarget, invoice.type)}`}
                  </span>
                </div>

                {/* Body */}
                <div className="flex flex-col items-center text-center px-9 pb-9">
                  <AlertDialogTitle
                    className="text-[20px] tracking-[-0.02em] text-foreground"
                    style={{ fontWeight: 600, lineHeight: 1.3 }}
                  >
                    {statusChangeTarget === 'Approved' && status === 'Pending Approval'
                      ? 'Approve this invoice?'
                      : statusChangeTarget === 'Approved' && status === 'On Hold'
                        ? 'Release this hold?'
                        : statusChangeTarget === 'Pending Approval' && status === 'Rejected'
                          ? 'Edit and resubmit?'
                          : isResolveException
                            ? 'Resolve this exception?'
                            : `Change status to ${statusChangeTarget}?`}
                  </AlertDialogTitle>
                  <AlertDialogDescription
                    className="text-[13px] mt-3 mx-auto text-muted-foreground"
                    style={{ lineHeight: 1.7, maxWidth: '340px' }}
                  >
                    {statusChangeTarget === 'Approved' && status === 'Pending Approval' ? (
                      // Approval copy explains the outcome, not the status
                      // mechanics (design feedback 7/8/26; wording rev 7/14/26).
                      // A pre-invoice posts NOTHING at approval (Eli 9/24
                      // R07): the advance posts when paid, inventory and
                      // A/P post at receiving — the copy says exactly that.
                      invoice.type === 'Pre-Invoice' ? (
                        <>
                          <span className="text-foreground " style={{ fontWeight: 600 }}>{invoice.invoiceNumber}</span> moves to{' '}
                          <span className="text-foreground" style={{ fontWeight: 600 }}>Approved</span>. Nothing posts to the general ledger until a payment is made.
                        </>
                      ) : (
                      <>
                        <span className="text-foreground " style={{ fontWeight: 600 }}>{invoice.invoiceNumber}</span> will post to the
                        general ledger and move to <span className="text-foreground" style={{ fontWeight: 600 }}>Approved</span>.
                      </>
                      )
                    ) : statusChangeTarget === 'Pending Approval' && status === 'Rejected' ? (
                      <>
                        <span className="text-foreground " style={{ fontWeight: 600 }}>{invoice.invoiceNumber}</span> goes back to the approval queue for review.
                      </>
                    ) : statusChangeTarget === 'Approved' && status === 'On Hold' ? (
                      // The action is RELEASE HOLD — the copy explains the
                      // outcome instead of renaming the action (review 7/14/26).
                      <>
                        <span className="text-foreground " style={{ fontWeight: 600 }}>{invoice.invoiceNumber}</span> moves from{' '}
                        <span className="text-foreground" style={{ fontWeight: 600 }}>On Hold</span> back to{' '}
                        <span className="text-foreground" style={{ fontWeight: 600 }}>{statusDisplayLabel('Approved', invoice.type)}</span>. An activity log entry will be recorded.
                      </>
                    ) : isResolveException ? (
                      <>
                        Invoice <span className="text-foreground " style={{ fontWeight: 600 }}>{invoice.invoiceNumber}</span> moves from{' '}
                        <span className="text-foreground" style={{ fontWeight: 600 }}>Exception</span> to{' '}
                        <span className="text-foreground" style={{ fontWeight: 600 }}>Pending Approval</span> and enters the approval queue.
                      </>
                    ) : (
                      <>
                        Invoice <span className="text-foreground " style={{ fontWeight: 600 }}>{invoice.invoiceNumber}</span> will move from{' '}
                        <span className="text-foreground" style={{ fontWeight: 600 }}>{statusDisplayLabel(status, invoice.type)}</span> to{' '}
                        <span className="text-foreground" style={{ fontWeight: 600 }}>{statusDisplayLabel(statusChangeTarget, invoice.type)}</span>. An activity-log entry will be recorded.
                      </>
                    )}
                  </AlertDialogDescription>

                  {/* Resolving offers to notify the same people who were
                      told about the exception (feedback 7/20/26; toggle-
                      right layout per BA 9/6). */}
                  {isResolveException && (
                    <div className="w-full mt-5 flex items-start justify-between gap-3 rounded-xl border border-border bg-white shadow-sm px-3.5 py-3 text-left">
                      <div className="min-w-0">
                        <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Notify the Flag Recipients</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {exceptionNotifiedNames.length > 0
                            ? `${invoice.createdBy}, ${namesSummary(exceptionNotifiedNames)} will be told it's resolved.`
                            : `${invoice.createdBy} and anyone notified when the exception was flagged will be told it's resolved.`}
                        </p>
                      </div>
                      <Switch checked={resolveNotify} onCheckedChange={(v) => setResolveNotify(v === true)} className="scale-90 shrink-0 mt-0.5" />
                    </div>
                  )}

                  <div className="w-full mt-8 flex flex-col gap-2.5">
                    <AlertDialogAction
                      onClick={() => {
                        const fromStatus = status;
                        // Persist the transition through the shared mutation when
                        // it maps to an invoice action; otherwise fall back to the
                        // local visual override (payment / archive transitions).
                        const act = actionForTransition(fromStatus, statusChangeTarget);
                        if (act && applyInvoiceAction) {
                          applyInvoiceAction([invoice.id], act, '');
                          setStatusOverride(null);
                        } else {
                          setStatusOverride(statusChangeTarget);
                        }
                        if (isResolveException && resolveNotify) {
                          toast.success('Exception resolved', {
                            description: exceptionNotifiedNames.length > 0
                              ? `Resolution notification sent to ${invoice.createdBy}, ${namesSummary(exceptionNotifiedNames)}.`
                              : `Resolution notification sent to ${invoice.createdBy} and the flag recipients.`,
                          });
                        } else {
                          // Every confirmed transition answers with a message
                          // (VI-51): approving through this confirm played only
                          // the overlay, so two approvals read as nothing
                          // happening. Reject/cancel/hold keep their own
                          // reason-dialog toasts and never reach here.
                          const confirmToast =
                            statusChangeTarget === 'Approved' && fromStatus === 'On Hold' ? 'Hold released'
                              : statusChangeTarget === 'Approved' ? 'Invoice approved'
                                : statusChangeTarget === 'Pending Approval' && fromStatus === 'Rejected' ? 'Invoice resubmitted for approval'
                                  : isResolveException ? 'Exception resolved'
                                    : `Invoice moved to ${statusDisplayLabel(statusChangeTarget, invoice.type)}`;
                          toast.success(confirmToast, { description: `${invoice.invoiceNumber} is now ${statusDisplayLabel(statusChangeTarget, invoice.type)}.` });
                        }
                        setTransitionOverlay({ visible: true, from: fromStatus, to: statusChangeTarget });
                        setStatusChangeTarget(null);
                      }}
                      className="w-full h-12 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
                      style={{ fontWeight: 600, backgroundColor: solid, color: '#fff' }}
                    >
                      {statusChangeTarget === 'Approved' && status === 'Pending Approval'
                        ? 'Approve Invoice'
                        : statusChangeTarget === 'Approved' && status === 'On Hold'
                          ? 'Release Hold'
                          : statusChangeTarget === 'Pending Approval' && status === 'Rejected'
                            ? 'Resubmit Invoice'
                            : isResolveException
                              ? 'Resolve Exception'
                              : isDestructive ? `Move to ${statusChangeTarget}` : `Mark as ${statusChangeTarget}`}
                    </AlertDialogAction>
                    <AlertDialogCancel
                      className="w-full h-12 text-[14px] rounded-xl border-0 cursor-pointer transition-colors mt-0"
                      style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                    >
                      {statusChangeTarget === 'Approved' && status === 'Pending Approval'
                        ? 'Keep as Pending Approval'
                        : statusChangeTarget === 'Approved' && status === 'On Hold'
                          ? 'Keep on Hold'
                          : `Keep as ${statusDisplayLabel(status, invoice.type)}`}
                    </AlertDialogCancel>
                  </div>
                </div>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>

      {/* Status-change transition animation */}
      <InvoiceTransitionOverlay
        visible={!!transitionOverlay?.visible}
        fromStatus={transitionOverlay?.from || status}
        toStatus={transitionOverlay?.to || status}
        duration={1200}
        onDismiss={() => setTransitionOverlay((s) => (s ? { ...s, visible: false } : null))}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Status journey — TWO tracks (7/16/26, payment-detail parity):
// approval (Pending approval → reject/resubmit cycles → Approved) |
// payments (Unpaid → Partially paid → Paid in full). The payments
// track is STATE-driven: net coverage (payments + credits, minus
// reversals) picks the current node, so a reversal moves the state
// back instead of adding a node. Transient states (scheduled payment,
// payment hold, exception) render only while unresolved; the full
// event log lives on the Payments tab and Recent Activity. Circle/
// connector visual language kept from the PO stepper: current =
// filled + glow ring, completed = filled + check, future = dashed.
// ══════════════════════════════════════════════════════════════════

interface JourneyNode {
  key: string;
  label: string;
  icon: React.ElementType;
  colors: { solid: string; glow: string };
  /** Tooltip detail: reason, reference, amount. */
  detail?: string;
}

const SCHEDULED_COLORS = { solid: '#0866E0', glow: 'color-mix(in srgb, #0866E0 18%, transparent)' };

function journeyMoney(amount: number) {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

interface JourneyTrackState {
  nodes: JourneyNode[];
  /** Index of the current (glowing) node; -1 = nothing happened yet. */
  currentIndex: number;
  allCompleted: boolean;
}

function buildInvoiceJourney(args: {
  invoice: Invoice;
  status: DisplayStatus;
  records: LinkedFinancialRecord[];
  appPayments: Payment[];
  paymentsContext: boolean;
}): { approval: JourneyTrackState; payments: JourneyTrackState } {
  const { invoice, status, records, appPayments, paymentsContext } = args;
  const isPre = invoice.type === 'Pre-Invoice';
  const total = invoice.amount;
  const history = invoice.actionHistory ?? [];
  const timeOf = (s?: string) => {
    const t = s ? Date.parse(s) : NaN;
    return Number.isNaN(t) ? 0 : t;
  };

  // ── Approval-phase events (reject / resubmit cycles) ──
  // Reject/resubmit cycles always render: they're the invoice's real
  // approval story. Exception and hold history renders WHILE the
  // invoice is still pre-approval (9/4/26 Eli, BB-21: "it was pending,
  // it was an exception, then it was cleared, then pending approval") —
  // once Approved they drop from the compressed trail and live in
  // Recent Activity (BB-21a: "once it's been approved, I don't really
  // care… you have it in the activity").
  const preApprovalPhase = status === 'Pending Approval' || status === 'Rejected' || status === 'Exception';
  const approvalNodes: Array<{ time: number; node: JourneyNode }> = [];
  history.forEach((e, i) => {
    const t = timeOf(e.at) + i; // +i keeps same-timestamp entries in insertion order
    if (e.action === 'reject') {
      approvalNodes.push({ time: t, node: { key: `reject-${i}`, label: 'Rejected', icon: Ban, colors: STEP_COLORS.Rejected, detail: e.reason || undefined } });
    } else if (e.action === 'submit') {
      approvalNodes.push({ time: t, node: { key: `resubmit-${i}`, label: 'Resubmitted', icon: RotateCcw, colors: STEP_COLORS['Pending Approval'], detail: 'Back in the approval queue' } });
    } else if (preApprovalPhase && e.action === 'flagException') {
      approvalNodes.push({ time: t, node: { key: `exception-${i}`, label: 'Exception Flagged', icon: AlertTriangle, colors: STEP_COLORS.Exception, detail: e.reason || undefined } });
    } else if (preApprovalPhase && e.action === 'resolve') {
      approvalNodes.push({ time: t, node: { key: `resolved-${i}`, label: 'Exception Resolved', icon: CheckCircle2, colors: STEP_COLORS.Approved, detail: e.reason ? `${e.by}: ${e.reason}` : `Resolved by ${e.by}` } });
    } else if (preApprovalPhase && e.action === 'paymentHold' && !invoice.is_payment_held) {
      // Only HISTORIC holds join the trail here — a live hold already
      // renders as its transient node next to Approved.
      approvalNodes.push({ time: t, node: { key: `held-${i}`, label: 'Payment Hold', icon: Lock, colors: STEP_COLORS['On Hold'], detail: e.reason || undefined } });
    } else if (preApprovalPhase && e.action === 'releaseHold') {
      approvalNodes.push({ time: t, node: { key: `released-${i}`, label: 'Hold Released', icon: Undo2, colors: STEP_COLORS.Approved, detail: e.reason || `Released by ${e.by}` } });
    } else if (preApprovalPhase && e.action === 'archive' && history.some((e2, j) => j > i && e2.action === 'restore')) {
      // Archive/restore cycles join the trail (user 10/1) — only CLOSED
      // cycles here; a live archive renders as the terminal node below.
      approvalNodes.push({ time: t, node: { key: `archived-${i}`, label: 'Archived', icon: Archive, colors: STEP_COLORS.Archived, detail: e.reason || undefined } });
    } else if (preApprovalPhase && e.action === 'restore') {
      // Restored wears the Restore CTA's blue, like the overlay (10/1).
      approvalNodes.push({ time: t, node: { key: `restored-${i}`, label: 'Restored', icon: ArchiveRestore, colors: SCHEDULED_COLORS, detail: e.reason || `Restored by ${e.by}` } });
    }
  });

  // ── Money events: seeded/linked records + app payment records ──
  type MoneyEvent = { time: number; kind: 'payment' | 'prepayment' | 'credit'; state: 'scheduled' | 'paid' | 'reversed'; amount: number; ref: string };
  const moneyEvents: MoneyEvent[] = [];
  const seenRefs = new Set<string>();
  for (const r of records) {
    if (r.type !== 'Payment' && r.type !== 'Prepayment' && r.type !== 'Credit Memo') continue;
    seenRefs.add(r.reference);
    moneyEvents.push({
      time: timeOf(r.date),
      kind: r.type === 'Payment' ? 'payment' : r.type === 'Prepayment' ? 'prepayment' : 'credit',
      state: r.status === 'Reversed' || r.status === 'Returned' ? 'reversed' : 'paid',
      amount: r.amount,
      ref: r.reference,
    });
  }
  for (const p of appPayments) {
    const applied = (p.appliedInvoices ?? []).filter((a) => a.invoiceNumber === invoice.invoiceNumber);
    if (applied.length === 0 || seenRefs.has(p.paymentNumber)) continue;
    // Session records carry a ms timestamp in their id (pmt-<stamp>), which
    // orders same-day events (pay, then hold, then pay again) correctly.
    const stamp = /^pmt-(\d+)/.exec(p.id)?.[1];
    moneyEvents.push({
      time: stamp ? Number(stamp) : timeOf(p.paymentDate),
      kind: p.type === 'Prepayment' ? 'prepayment' : 'payment',
      state: p.status === 'Scheduled' ? 'scheduled' : p.status === 'Reversed' ? 'reversed' : 'paid',
      amount: applied.reduce((s, a) => s + a.amount, 0),
      ref: p.paymentNumber,
    });
  }
  // ── Coverage, not events (feedback 7/16/26) ──
  // The payments track shows STATES, not the transaction log (that lives
  // on the Payments tab / Recent Activity). Net coverage decides the
  // current node: reversals simply subtract — the state falls back to
  // Partially paid or Unpaid instead of rendering a reversal node, and
  // credit memos count toward coverage without a node of their own.
  let coverage = 0;
  // Cash only (user 10/1): credit memos reduce the payable but are NOT
  // payments — only cash coverage may move the track to Partially paid.
  let cashCoverage = 0;
  let paidCount = 0;
  let scheduledTotal = 0;
  for (const ev of moneyEvents) {
    if (ev.state === 'paid') {
      coverage += ev.amount;
      if (ev.kind !== 'credit') {
        paidCount += 1;
        cashCoverage += ev.amount;
      }
    } else if (ev.state === 'scheduled') {
      scheduledTotal += ev.amount;
    }
    // Reversed events contribute nothing: the money came back.
  }

  // ── Assemble two tracks (feedback 7/16/26, payment-detail parity) ──
  // The approval phase (Pending approval → reject/resubmit cycles →
  // Approved) is its own compact track; the money phase renders as a
  // SEPARATE track after a divider, exactly like the payment detail's
  // status | application strip. Until the invoice is approved the
  // payments track stays hidden entirely — an unapproved invoice never
  // reaches the Invoices to pay queue, so payment nodes would be noise.
  const pendingPhase = status === 'Pending Approval' || status === 'Rejected' || status === 'Exception';
  const approvedEver =
    !pendingPhase &&
    (history.some((e) => e.action === 'approve') ||
      moneyEvents.length > 0 ||
      ['Approved', 'Partially Paid', 'Paid', 'On Hold', 'Partially Prepaid', 'Prepaid', 'Archived'].includes(status));
  const approvalHappened: JourneyNode[] = [];
  const approvalFuture: JourneyNode[] = [];
  const payHappened: JourneyNode[] = [];
  const payFuture: JourneyNode[] = [];

  if (!paymentsContext) {
    approvalHappened.push({ key: 'pending', label: 'Pending Approval', icon: FileText, colors: STEP_COLORS['Pending Approval'] });
    approvalNodes.sort((a, b) => a.time - b.time).forEach((e) => approvalHappened.push(e.node));
    // Seeded invoices carry a status but no action history — synthesize
    // the node their status implies.
    const last = approvalHappened[approvalHappened.length - 1]?.label;
    if (status === 'Rejected' && last !== 'Rejected') {
      approvalHappened.push({ key: 'rejected-now', label: 'Rejected', icon: Ban, colors: STEP_COLORS.Rejected });
    }
    if (status === 'Exception' && last !== 'Exception Flagged') {
      approvalHappened.push({
        key: 'exception-now',
        label: 'Exception Flagged',
        icon: AlertTriangle,
        colors: STEP_COLORS.Exception,
        detail: [...history].reverse().find((e) => e.action === 'flagException')?.reason || undefined,
      });
    }
  }

  // "Approved" closes the approval track (copy feedback 7/16/26); the
  // payments track then opens with "Unpaid", the state the record enters
  // at approval, and closes with "Paid in Full".
  const awaitingNode: JourneyNode = { key: 'awaiting', label: 'Approved', icon: CheckCircle2, colors: STEP_COLORS.Approved, detail: 'Approved and ready to pay' };
  const cancelled = status === 'Cancelled';
  const archived = status === 'Archived';
  const inMoneyPhase = approvedEver || paymentsContext;
  const settled = status === 'Paid' || status === 'Prepaid';
  // Live hold — an invoice-level CONTROL fact (feedback 7/21/26): its
  // node renders right next to Approved wherever the invoice is in the
  // lifecycle, never tailing the money track. Held before approval, the
  // node sits on the approval track ("on hold and not approved"); held
  // after, it opens the payments track ("approved, on hold, and unpaid
  // or partially paid").
  const heldNow = invoice.is_payment_held === true || status === 'On Hold';
  const holdNode = (key: string): JourneyNode => ({
    key,
    label: 'Payment Hold',
    icon: Lock,
    colors: STEP_COLORS['On Hold'],
    detail: [...history].reverse().find((e) => e.action === 'paymentHold')?.reason || undefined,
  });
  // Grey in the initial state (feedback 7/16/26) — Unpaid is the neutral
  // starting point, not a warning.
  const UNPAID_COLORS = { solid: '#64748B', glow: 'color-mix(in srgb, #64748B 18%, transparent)' };

  if (inMoneyPhase) {
    approvalHappened.push(awaitingNode);
    // The hold closes the INVOICE track, before the separator (feedback
    // 7/21/26 PM): it's an invoice control status, so it lives with
    // Approved on the left; the money track stays pure money states.
    if (heldNow) approvalHappened.push(holdNode('hold-now'));
    payHappened.push({
      key: 'unpaid',
      label: 'Unpaid',
      icon: Wallet,
      colors: UNPAID_COLORS,
      detail: coverage <= 0.005
        ? 'No payments recorded yet'
        : cashCoverage <= 0.005
          ? 'No payments yet; credit memos reduced the payable'
          : undefined,
    });
    // Partial coverage is a single state node — its detail aggregates the
    // net settled amount, however many payments (or reversals) produced it.
    // CASH coverage gates it (user 10/1): a credit-only invoice stays on
    // Unpaid, matching the header pill and the unchanged status.
    const partial = !settled && (cashCoverage > 0.005 && coverage < total - 0.005 || status === 'Partially Paid' || status === 'Partially Prepaid');
    if (partial) {
      const prepaid = status === 'Partially Prepaid';
      payHappened.push({
        key: 'partial',
        label: prepaid ? 'Partially Prepaid' : 'Partially Paid',
        icon: prepaid ? Wallet : Banknote,
        colors: STEP_COLORS[prepaid ? 'Partially Prepaid' : 'Partially Paid'],
        detail: `${paidCount} payment${paidCount === 1 ? '' : 's'} · ${journeyMoney(coverage)} of ${journeyMoney(total)} settled`,
      });
    }
    // Reversals join the trail as completed events (9/4/26 Eli, BB-29 —
    // same principle as BB-21: the record survives in the compressed
    // story, not just the Payments tab). The coverage math above already
    // subtracted them, so the CURRENT state node stays honest.
    moneyEvents
      .filter((ev) => ev.state === 'reversed')
      .forEach((ev, i) => {
        payHappened.push({
          key: `reversed-${i}`,
          label: ev.kind === 'prepayment' ? 'Prepayment Reversed' : 'Payment Reversed',
          icon: Undo2,
          colors: { solid: '#E11D48', glow: 'color-mix(in srgb, #E11D48 18%, transparent)' },
          detail: `${ev.ref} · ${journeyMoney(ev.amount)} returned to the balance`,
        });
      });
    // Live pending states render while they exist and disappear once
    // resolved: a scheduled payment (until it posts) and a payment hold
    // (until released).
    if (!settled && scheduledTotal > 0.005) {
      const coversRest = scheduledTotal >= total - coverage - 0.005;
      payHappened.push({
        key: 'scheduled',
        label: coversRest ? 'Full Payment Scheduled' : 'Partial Payment Scheduled',
        icon: Clock,
        colors: SCHEDULED_COLORS,
        detail: journeyMoney(scheduledTotal),
      });
    }
  } else if (!cancelled && !archived) {
    // Pre-approval hold: the node joins the approval track so the story
    // reads "pending approval, on hold" — Approved stays in the future.
    if (heldNow) approvalHappened.push(holdNode('hold-preapproval'));
    approvalFuture.push(awaitingNode);
  }

  // A full credit memo zeroes the balance without cash: the journey
  // closes on "Settled", never "Paid in Full" (feedback 7/21/26). The
  // raw status carries the distinction; the display status maps both
  // to Paid for everything else on the page.
  const settledNoCash = invoice.status === 'Settled';
  const terminalLabel = settledNoCash ? 'Settled' : isPre ? 'Prepaid' : 'Paid in Full';
  if (cancelled) {
    // Terminal: the user can do nothing after a cancel, so no future
    // nodes. A pre-approval cancel belongs on the approval track.
    const cancelNode: JourneyNode = { key: 'cancelled', label: 'Cancelled', icon: X, colors: STEP_COLORS.Cancelled, detail: [...history].reverse().find((e) => e.action === 'cancel')?.reason || undefined };
    (inMoneyPhase ? payHappened : approvalHappened).push(cancelNode);
  } else if (archived) {
    // The terminal node carries the archive reason as its tooltip (10/1).
    const archEntry = [...history].reverse().find((e) => e.action === 'archive');
    (inMoneyPhase ? payHappened : approvalHappened).push({
      key: 'archived',
      label: 'Archived',
      icon: Archive,
      colors: STEP_COLORS.Archived,
      detail: archEntry ? archEntry.reason || `Archived by ${archEntry.by}` : undefined,
    });
  } else if (inMoneyPhase) {
    if (settled) {
      payHappened.push({
        key: 'settled',
        label: terminalLabel,
        icon: Check,
        colors: isPre && !settledNoCash ? STEP_COLORS.Prepaid : STEP_COLORS.Paid,
        // Settled has two flavors (9/2/26): a reconciled pre-invoice
        // names the receiving invoice its prepayment applied to; the
        // credit-memo copy stays for the no-cash credit path.
        detail: settledNoCash
          ? invoice.reconciledIntoInvoiceNumber
            ? `Reconciled into ${invoice.reconciledIntoInvoiceNumber}; the prepayment applied there`
            : 'A credit memo covered the remaining balance, no cash moved'
          : undefined,
      });
    } else {
      payFuture.push({ key: 'terminal', label: terminalLabel, icon: Check, colors: isPre ? STEP_COLORS.Prepaid : STEP_COLORS.Paid });
    }
  }

  return {
    approval: {
      nodes: [...approvalHappened, ...approvalFuture],
      currentIndex: approvalHappened.length - 1,
      // Approval is a done deal the moment it happens — the payments
      // track's Unpaid node carries the live state from then on.
      allCompleted: inMoneyPhase,
    },
    payments: {
      nodes: [...payHappened, ...payFuture],
      currentIndex: payHappened.length - 1,
      allCompleted: settled,
    },
  };
}

// One connected run of journey nodes — the same circle/connector recipe
// as the payment detail's workflow tracks, so both screens stay
// consistent. `grow` stretches the track's connectors to fill the row.
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

function StatusWorkflowBar({ status, invoice, records, appPayments, paymentsContext = false }: { status: DisplayStatus; invoice: Invoice; records: LinkedFinancialRecord[]; appPayments: Payment[]; paymentsContext?: boolean }) {
  const { approval, payments } = buildInvoiceJourney({ invoice, status, records, appPayments, paymentsContext });
  return (
    <div className="px-4 lg:px-5 py-2.5 overflow-x-auto">
      <div className="relative flex items-center w-full gap-3 py-1" style={{ minHeight: 32 }}>
        {/* Approval phase — compact track; the payments track only exists
            once the invoice is approved (it isn't payable before that). */}
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

