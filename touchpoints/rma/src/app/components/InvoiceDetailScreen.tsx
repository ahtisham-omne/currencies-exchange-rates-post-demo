import { formatMoney as moneyIn, rateSentence } from '@/app/currency/money';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { CurrencyHeaderControls, ReturnCurrencyTag } from '@/app/components/currency/CurrencyHeaderControls';
import { ReturnCurrencyConfigDialog } from '@/app/components/currency/ReturnCurrencyConfig';
import { ReturnViewProvider } from '@/app/components/currency/returnView';
import { returnFx as returnFxOf, rmaCurrency as returnCurrencyOf, rmaCurrencyPO } from '@/app/currency/returnCurrency';
import { returnSettlementFx } from '@/app/currency/returnSettlement';
import { useRMAEditGate } from './rma-versions/RMAEditGate';
import { useNavigate as useTanstackNavigate } from '@tanstack/react-router';

// react-router-dom shims. TanStack Router doesn't expose an equivalent of
// useLocation() with typed state, and the RMA port never needs to route
// back to a payments module. Tiny stubs keep the source structure intact.
const useLocation = () => ({
  pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
  state: null as { from?: string } | null,
});
const useNavigate = () => {
  const nav = useTanstackNavigate();
  return (to: string) => {
    void nav({ to } as unknown as Parameters<typeof nav>[0]);
  };
};
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  FileText,
  Upload,
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
  CircleDollarSign,
  Replace,
  Send,
  PackageCheck,
  Save,
} from 'lucide-react';
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
import { VendorQuickCard, TYPE_EXPLAINER, statusDisplayLabel } from './InvoiceDataTable';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { Checkbox } from '@/app/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { Button } from '@/app/components/ui/button';
import { Invoice, mockInvoices } from '@/app/data/mockInvoices';
import type { RMA, RMAStatus } from '@/app/data/mockRMAs';
import { authorizedQty, PAYMENT_OVERDUE_DAYS, rmaCanRevert, rmaMaterialEditable, rmaDaysSinceShipped, rmaLifecycleSteps, rmaPaymentOverdue, rmaShipsDirect, rmaStatusLabel } from '@/app/data/mockRMAs';
import { RMA_STATUS_STYLES } from '@/app/components/RMADataTable';
import type { RMAActionId, RMAActionPayload } from './RMADetailScreen';
import { SYSTEM_USERS, SYSTEM_ROLES } from '@/app/data/systemUsers';
import { mockVendors } from '@/app/data/mockVendors';
import { toast } from 'sonner';
import { InvoiceReasonDialog, type ReasonAction } from '@/app/components/InvoiceReasonDialog';
import { SearchableUserPicker } from '@/app/components/vendors/SearchableUserPicker';
import { actionToneClass, type ActionTone } from '@/app/lib/actionMenuTone';
import { AddCreditMemoModal } from './invoice-details/AddCreditMemoModal';
import { LogSettlementModal } from './rma/LogSettlementModal';
import { ReversePaymentModal, type PaymentRecord } from './invoice-details/ReversePaymentModal';
import {
  restockingFeeBase,
  rmaSettlementSummary,
  scenarioValue,
} from '@/app/data/rmaGLEntries';
import { InvoiceTransitionOverlay } from './invoice-details/InvoiceTransitionOverlay';
import { LineItemsTab } from './invoice-details/LineItemsTab';
import { ShippingTab } from './invoice-details/ShippingTab';
import { LinkedRecordsTab } from './invoice-details/LinkedRecordsTab';
import { getRMALinkedRecords } from '@/app/data/rmaLinkedRecords';

/** The signed-in user, as the chrome names them. */
const CURRENT_USER_NAME = 'Ahtisham Ahmad';
import { GLImpactTab } from './invoice-details/GLImpactTab';
import { getLinkedFinancials, getLinkedProcurement, countsTowardBalance, LinkedFinancialRecord } from '@/app/data/invoiceLinkedRecords';
import { Payment } from '@/app/data/mockPayments';
import { PaymentsTab } from './invoice-details/PaymentsTab';
import { AttachmentsTab } from './invoice-details/AttachmentsTab';
import { ActivityTab } from './invoice-details/ActivityTab';
import { InvoiceDetailSidebar } from './invoice-details/InvoiceDetailSidebar';
import { RMAApproveModal, type RMAApprovalAnswer } from '@/app/components/rma/RMAApproveModal';
import { RestockingFeeScopeModal } from '@/app/components/rma/RestockingFeeScopeModal';
import { RMAArchiveModal } from '@/app/components/rma/RMAArchiveModal';
import { rmaShipmentInProcess, rmaShipmentProgress } from '@/app/data/rmaShipments';
import { RMANotesTab, RMACommunicationTab } from './invoice-details/RMANotesTab';
import { useRMAContext } from '@/app/rma-context';
import { SendToVendorModal } from './invoice-details/SendToVendorModal';
import RMAVersionHistoryTab from './rma-versions/RMAVersionHistoryTab';
import RMAVersionDropdown from './rma-versions/RMAVersionDropdown';
import RMAVersionRevertModal from './rma-versions/RMAVersionRevertModal';
import { RMAEditGateProvider } from './rma-versions/RMAEditGate';
import RMAVersionSaveModal from './rma-versions/RMAVersionSaveModal';
import { changeTypeConfig } from './rma-versions/rmaVersionDisplay';
import { buildInitialVersion, type RMAVersionEntry } from '@/app/data/rmaVersions';
import { imageForSku } from '@/app/lib/itemImages';

interface InvoiceDetailScreenProps {
  invoiceId: string;
  onClose: () => void;
  invoices: Invoice[];
  /** App-level payment records — feeds the Payments tab so drafts,
   *  scheduled payments and prepayments against this invoice are visible. */
  payments?: Payment[];
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
      | 'paymentHold'
      | 'flagException'
      | 'resolve'
      | 'releaseHold',
    reason: string,
    notifiedRecipientIds?: string[],
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
  /** Reverses a payment at App level — retires the payment record and
   *  restores the invoice's outstanding balance + status so every other
   *  surface reads post-reversal numbers (7/15/26). */
  onReversePayment?: (invoiceId: string, paymentReference: string, amount: number) => void;
  /** When 'rma', the detail chrome renders for a Return Merchandise
   *  Authorization payload adapted into Invoice shape. The header
   *  workflow bar swaps to the RMA lifecycle steps. Default: 'invoice'. */
  mode?: 'invoice' | 'rma';
  /** The original RMA status string ("Draft" | "Approved" | ...). Only
   *  read when mode === 'rma'; drives the RMA workflow bar. */
  rmaStatus?: string;
  /** Raw RMA payload passed through when mode === 'rma'. Feeds the
   *  RMA-specific header chip, sidebar sections, line-items, activity
   *  and attachments tabs without fattening the Invoice type. */
  rma?: RMA;
  /** RMA lifecycle action callback. Wired to state mutations at the
   *  route level (approve → applyRMAAction, etc.). */
  onRmaAction?: (action: RMAActionId, payload?: RMAActionPayload) => void;
  /** Clones the RMA to a new Draft and routes to it. */
  /** Emits the RMA as a downloadable file. */
  /** Restores the return to an earlier version. */
  onRmaRevert?: (version: number, reason: string) => void;
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
  'On Hold': { bg: '#FEFCE8', color: '#A16207', border: '#FEF08A' },          // yellow 50/700/200
  Exception: { bg: '#FEE2E2', color: '#991B1B', border: '#FCA5A5' },          // red 100/800/300
  Rejected: { bg: '#FFF1F2', color: '#BE123C', border: '#FECDD3' },           // rose 50/700/200
  Cancelled: { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' },          // red 50/700/200
  Archived: { bg: '#F5F5F4', color: '#57534E', border: '#E7E5E4' },           // stone 100/600/200
};

// Per-type pill palette — keyed to InvoiceDataTable.TYPE_CONFIG so
// the Type chip on the row and the chip on the detail header read
// identically. Taxonomy rev 7/9/26: one flat pill per type; Pre-Invoice
// is a deposit, not an invoice, so it alone wears amber + dashed.
const TYPE_PALETTE: Record<string, { icon: React.ElementType; label: string; bg: string; color: string; border: string; dashed?: boolean }> = {
  'PO-based': { icon: Truck, label: 'Receiving Invoice', bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
  'Receiving-based': { icon: Truck, label: 'Receiving Invoice', bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
  'GRN-based': { icon: Truck, label: 'Receiving Invoice', bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
  Standalone: { icon: Calculator, label: 'Standalone Invoice', bg: '#FAF5FF', color: '#7C3AED', border: '#DDD6FE' },
  'Pre-Invoice': { icon: Package, label: 'Pre-Invoice', bg: '#FFFBEB', color: '#B45309', border: '#FBBF24', dashed: true },
};

// Return-type chip palette — mirrors RMADataTable.RMA_TYPE_CONFIG so the
// listing row's Return Type pill and the detail header chip stay in sync.
// Refund/Credit=blue, Replacement=violet, Return Only=amber.
const RMA_TYPE_PALETTE: Record<string, { icon: React.ElementType; label: string; bg: string; color: string; border: string }> = {
  'Refund/Credit': { icon: CircleDollarSign, label: 'Refund/Credit', bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  Replacement: { icon: Replace, label: 'Replacement', bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE' },
  'Return Only': { icon: Undo2, label: 'Return Only', bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' },
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
  inventory: { icon: Package, label: 'Inventory Invoice', bg: '#EBF3FF', color: '#0866E0', border: '#ADD1FF' },   // blue 50/600/200
  standalone: { icon: FileText, label: 'Standalone Invoice', bg: '#FAF5FF', color: '#9333EA', border: '#E9D5FF' }, // purple 50/600/200
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
  Exception: { solid: '#991B1B', glow: 'color-mix(in srgb, #991B1B 18%, transparent)' },
  Rejected: { solid: '#BE123C', glow: 'color-mix(in srgb, #BE123C 18%, transparent)' },
  Cancelled: { solid: '#B91C1C', glow: 'color-mix(in srgb, #B91C1C 18%, transparent)' },
  Archived: { solid: '#57534E', glow: 'color-mix(in srgb, #57534E 14%, transparent)' },
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
  const softMix = `color-mix(in srgb, ${p.bg} 35%, white)`;
  return {
    background: `linear-gradient(to top, ${p.bg} 0%, ${softMix} 45%, #FFFFFF 90%)`,
    borderColor: p.border,
  };
}

// RMA-mode variant. The Invoice-shaped adapter pins every non-Draft RMA
// status to 'Approved', which would render the header emerald regardless
// of where the RMA actually sits in its lifecycle. Instead, key the
// gradient off the real RMA status so the header tint tracks the pill +
// stepper colours: Draft slate, Sent blue, Approved indigo, Shipped
// amber, Closed emerald.
const RMA_HEADER_PALETTE: Record<string, { bg: string; border: string }> = {
  Draft: { bg: '#F1F5F9', border: '#CBD5E1' },
  Sent: { bg: '#EBF3FF', border: '#ADD1FF' },
  Approved: { bg: '#EEF2FF', border: '#C7D2FE' },
  'Shipped to Vendor': { bg: '#FFFBEB', border: '#FCD34D' },
  Closed: { bg: '#ECFDF5', border: '#A7F3D0' },
  Cancelled: { bg: '#FEF2F2', border: '#FECACA' },
};

function rmaHeaderCardStyle(rmaStatus: string): React.CSSProperties {
  const p = RMA_HEADER_PALETTE[rmaStatus] ?? RMA_HEADER_PALETTE['Draft']!;
  const softMix = `color-mix(in srgb, ${p.bg} 35%, white)`;
  return {
    background: `linear-gradient(to top, ${p.bg} 0%, ${softMix} 45%, #FFFFFF 90%)`,
    borderColor: p.border,
  };
}

// ── Tabs ──────────────────────────────────────────────────────────
type TabKey = 'line-items' | 'shipping' | 'linked-records' | 'payments' | 'gl-impact' | 'attachments' | 'notes' | 'communication' | 'versions' | 'activity';
// Dashboard / Overview tab removed entirely per user feedback —
// the page lands directly on Line Items, mirroring the PO/SO
// detail-page UX. KPI strip, widget grid, customize-widgets sheet,
// and sidebar Invoice Information panel were removed with it; the
// Available Actions are reachable from the header Actions dropdown.
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'line-items', label: 'Line Items' },
  { key: 'shipping', label: 'Shipping' },
  { key: 'linked-records', label: 'Linked Records' },
  { key: 'payments', label: 'Payments' },
  { key: 'gl-impact', label: 'GL Impact' },
  { key: 'attachments', label: 'Attachments' },
  { key: 'notes', label: 'Notes' },
  { key: 'communication', label: 'Communication' },
  { key: 'versions', label: 'Versions' },
  { key: 'activity', label: 'Activity' },
];

/** Tabs a return names differently from an invoice. The lines are the goods
 *  going back rather than what was billed. Everything else, the activity
 *  feed included, keeps the shared label. */
const RMA_TAB_LABELS: Partial<Record<TabKey, string>> = {
  'line-items': 'Return Items',
};

// A return that is still being drafted or is sitting with the vendor has no
// shipment against it and has posted nothing, so the tabs that report those
// two things have nothing to report yet.
const RMA_PRE_SETTLEMENT_STATUSES: string[] = ['Draft', 'Sent'];

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
        { key: 'archive', label: 'Archive', icon: Archive, variant: 'primary' },
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
  | 'paymentHold'
  | 'flagException'
  | 'resolve'
  | 'releaseHold';

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
    default:
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
    case 'rma-record-refund':
      return 'workflow';
    case 'payment-hold':
    case 'add-credit':
    case 'reverse-payment':
      return 'adjust';
    case 'print':
    case 'export':
    case 'remittance':
    case 'rma-print':
    case 'rma-download':
      return 'output';
    case 'raise-exception':
      return 'warning';
    case 'cancel':
    case 'archive':
    case 'rma-cancel':
    case 'rma-archive':
    case 'rma-refusal':
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
    title: 'On payment hold',
    icon: Lock,
    iconBg: '#FEFCE8',
    iconColor: '#A16207',
    border: '#FEF08A',
    fallback: 'No reason was recorded when the hold was placed.',
  },
  Exception: {
    historyAction: 'flagException',
    title: 'Exception flagged, resolve and resubmit',
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

function StatusReasonBanner({ invoice, status, isRma, onResolveException, onResubmit, onReleaseHold }: { invoice: Invoice; status: DisplayStatus; isRma?: boolean; onResolveException?: () => void; onResubmit?: () => void; onReleaseHold?: () => void }) {
  const base = REASON_BANNER[status];
  if (!base) return null;
  // The banner copy names the document; in RMA mode there is no invoice.
  const cfg = isRma
    ? { ...base, title: base.title.replace(/^Invoice /, 'RMA '), fallback: base.fallback.replace(/this invoice/, 'this RMA') }
    : base;
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
            className="inline-flex px-1.5 py-px rounded-md text-[10px] uppercase tracking-[0.08em] align-middle mr-1.5"
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
          Resolve exception
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

function daysBetween(later: Date, earlier: Date) {
  const ms = later.getTime() - earlier.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

// ══════════════════════════════════════════════════════════════════
// Main screen
// ══════════════════════════════════════════════════════════════════

export function InvoiceDetailScreen({ invoiceId, onClose, invoices, payments = [], applyInvoiceAction, onSettleInvoices, onPayInvoices, onAddPrepayment, onEditResubmit, onReversePayment, mode = 'invoice', rmaStatus, rma, onRmaAction, onRmaRevert }: InvoiceDetailScreenProps) {
  const isRma = mode === 'rma';
  // The return's page reads in PKR, the base currency, with the PO's amount
  // on hover (Currency Touchpoints Map, 2026-11-24: no Base | Vendor Currency
  // toggle). The header's Currency button opens its currency configuration.
  const [currencyConfigOpen, setCurrencyConfigOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  // Opened from Vendor Payments (Ready to pay row, Applied To link) — the
  // page reads as a payment workspace: the approval step drops out of the
  // workflow bar and "Approved" reads "Awaiting Payment" (feedback 7/14/26).
  const fromPayments = (((location.state as { from?: string } | null)?.from) ?? '').startsWith('/payments');
  const invoice = invoices.find((inv) => inv.id === invoiceId);

  const [activeTab, setActiveTab] = useState<TabKey>('line-items');
  /** Non-null while the user is reading an older version. The page stays on
   *  live data; the banner and the amber pill mark the read as historical. */
  const [viewingVersion, setViewingVersion] = useState<number | null>(null);
  const [revertTarget, setRevertTarget] = useState<number | null>(null);
  /* Returns seeded before versioning existed carry no history, so v1 is
     derived on read the same way the store derives it on first write. */
  const rmaVersions = useMemo<RMAVersionEntry[]>(() => {
    if (!rma) return [];
    if (rma.versions && rma.versions.length > 0) return rma.versions;
    return [buildInitialVersion(rma)];
  }, [rma]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [creditMemoOpen, setCreditMemoOpen] = useState(false);
  // Credit memos created this session — full linked-record shape so they
  // appear in the Linked Records tab and reduce the outstanding balance the
  // moment they're created.
  const [sessionCreditMemos, setSessionCreditMemos] = useState<LinkedFinancialRecord[]>([]);
  // Payment / prepayment reversals recorded this session — each carries the
  // reversed source reference so the merge below can retire the original
  // record and restore the outstanding balance (lifecycle specs 7/15/26).
  // Reversals only remember WHICH reference was reversed — the source row
  // keeps its line and flips status, no mirror row is added (7/15/26).
  const [sessionReversals, setSessionReversals] = useState<Array<{ reversedReference: string }>>([]);
  useEffect(() => { setSessionCreditMemos([]); setSessionReversals([]); }, [invoiceId]);
  const [reversePaymentOpen, setReversePaymentOpen] = useState(false);
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
  const [releaseNotify, setReleaseNotify] = useState(true);
  // Reply-all on release (Eli 7/22/26): seeded with the original hold
  // recipients, but the user can ADD anyone who joined the conversation.
  const [releaseRecipients, setReleaseRecipients] = useState<Set<string>>(new Set());
  // Resolve-exception / resubmit-rejection confirms (feedback 7/22/26):
  // every state-RESOLVING prompt offers the same optional notify the
  // Release Hold confirm carries, aimed at the people told when the
  // state was flagged.
  const [resolveConfirm, setResolveConfirm] = useState<'resolve' | 'resubmit' | null>(null);
  const [resolveNotify, setResolveNotify] = useState(true);
  // Reply-all on resolve/resubmit (Eli 7/24/26): seeded with the people
  // told when the exception/rejection was flagged, but editable — the same
  // Manage-recipients picker the Release Hold confirm uses.
  const [resolveRecipients, setResolveRecipients] = useState<Set<string>>(new Set());
  const [transitionOverlay, setTransitionOverlay] = useState<{ visible: boolean; from: DisplayStatus; to: DisplayStatus } | null>(null);
  const [rmaSettleOpen, setRmaSettleOpen] = useState(false);
  /** What the vendor agreed to send back: what was paid, plus what is
   *  credited against an invoice still open, at the agreed rate, less every
   *  agreed vendor charge. Goods never invoiced are not in it -- nothing was
   *  paid for them and the accrual just unwinds -- and a replacement or a
   *  write-off line settles in something other than money. Counting the whole
   *  return here made Log settlement expect $1,025.81 on RMA-01020, where the
   *  vendor owed $125.09. */
  const rmaExpectedSettlement = useMemo(() => {
    if (!rma) return 0;
    const { claimed, charges } = rmaSettlementSummary(rma);
    const pct = rma.creditTerms?.creditPct;
    const afterRate = pct != null && pct < 100 ? claimed * (pct / 100) : claimed;
    return Math.max(0, Math.round((afterRate - charges) * 100) / 100);
  }, [rma]);
  /** Part payments already logged, and what is left to come after them. A
   *  return settled in instalments asks only for the rest each time. */
  const rmaReceivedSoFar = useMemo(
    () =>
      Math.round((rma?.settlementEntries ?? []).reduce((s, e) => s + e.amount, 0) * 100) / 100,
    [rma],
  );
  const rmaSettlementRemaining = Math.max(
    0,
    Math.round((rmaExpectedSettlement - rmaReceivedSoFar) * 100) / 100,
  );
  const [rmaRefuseOpen, setRmaRefuseOpen] = useState(false);
  const [rmaArchiveOpen, setRmaArchiveOpen] = useState(false);
  const [rmaSendOpen, setRmaSendOpen] = useState(false);
  // Approving asks what the vendor said about paying, so the step opens a
  // dialog rather than committing on the click.
  const [rmaApproveOpen, setRmaApproveOpen] = useState(false);
  // A fee entered against a vendor with none on file pauses the approval on
  // the scope question, so the answer is held until that is settled.
  const [feeScopeOpen, setFeeScopeOpen] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<RMAApprovalAnswer | null>(null);
  /** What the vendor charges as a matter of course. Read off the context so
   *  that a fee pushed to a profile here is already on file when the vendor
   *  charges panel below, or the next return's create flow, asks the same
   *  question. */
  const {
    restockingStandardFor,
    setRestockingStandard,
    editSessionActive,
    editSessionChanges,
    commitEditSession,
    discardEditSession,
  } = useRMAContext();
  /* The PO editing session (ERP-11107): open from the first confirmed edit
     after Draft until Save Version or Discard Changes. */
  const [rmaSaveVersionOpen, setRmaSaveVersionOpen] = useState(false);
  const rmaEditing = isRma && !!rma && editSessionActive(rma.id);
  const rmaSessionChanges = rmaEditing && rma ? editSessionChanges(rma.id) : [];
  const rmaSessionTags = [...new Set(rmaSessionChanges.map((c) => changeTypeConfig[c.type]?.label ?? 'Details'))];
  const rmaNextVersion = (rma?.currentVersion ?? rma?.versions?.[0]?.version ?? 1) + 1;
  const vendorStandardRestockingPct = restockingStandardFor;
  /** What a restocking fee is charged on, the full return value, and the
   *  parts it is made of. */
  const rmaFeeBase = rma ? restockingFeeBase(rma) : 0;
  const rmaFeeSplit = {
    paid: rma ? scenarioValue(rma, 'credit-paid') : 0,
    credit: rma ? scenarioValue(rma, 'credit-unpaid') : 0,
    notInvoiced: rma
      ? Math.round(
          (scenarioValue(rma, 'accrual') + scenarioValue(rma, 'accrual-noclaim')) * 100,
        ) / 100
      : 0,
  };
  const rmaReturnValue = rma
    ? Math.round(
        rma.items.reduce(
          (sum, li) => sum + authorizedQty(li) * (li.originalUnitPrice ?? li.unitPrice),
          0,
        ) * 100,
      ) / 100
    : 0;
  /** The restocking fee this return already carries, as a percentage of
   *  the base it is charged on, so the approval opens on it rather than 0%. */
  const rmaFeeCharge = (rma?.additionalCharges ?? [])
    .filter((c) => c.type === 'Restocking fee')
    .reduce((n, c) => n + (c.amount || 0), 0);
  const rmaHasFeeCharge = rmaFeeCharge > 0.004;
  const rmaCurrentFeePct =
    rma?.creditTerms?.restockingFee && rma.creditTerms.restockingFee > 0
      ? rma.creditTerms.restockingFee
      : rmaHasFeeCharge && rmaFeeBase > 0.004
        ? Math.round((rmaFeeCharge / rmaFeeBase) * 10000) / 100
        : undefined;
  /** Approve, with whatever the vendor said attached. */
  const commitApproval = (answer: RMAApprovalAnswer) => {
    if (!rma) return;
    onRmaAction?.('approve', {
      refundExpectation: {
        days: answer.days,
        from: answer.from,
        method: answer.method,
        ...(answer.onDate ? { onDate: answer.onDate } : {}),
      },
      // An untouched fee on a return that already carries one keeps that
      // charge as it is: rewriting it from the percentage could drop a
      // dollar fee agreed at creation, which Versions then logged as removed.
      ...(answer.feeChanged || !rmaHasFeeCharge ? { restockingPct: answer.restockingPct } : {}),
    });
    setRmaApproveOpen(false);
    const when = answer.onDate
      ? `Refund expected by ${new Date(`${answer.onDate}T00:00:00`).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}.`
      : answer.from === 'today'
        ? `Refund expected in ${answer.days} days.`
        : answer.from === 'shipped'
          ? `Refund expected ${answer.days} days after it ships.`
          : `Refund expected ${answer.days} days after they receive it.`;
    toast.success('RMA approved', {
      description:
        answer.restockingPct > 0
          ? `${rma.vendor} authorized the return. ${when} They keep ${answer.restockingPct}%.`
          : `${rma.vendor} authorized the return. ${when}`,
    });
  };
  const [rmaPrintOpen, setRmaPrintOpen] = useState(false);
  // Download is the same document as Print, handed straight to the print
  // dialog so "Save as PDF" writes it out under the return number.
  const [rmaAutoPrint, setRmaAutoPrint] = useState(false);

  // RMA lifecycle moves through a dozen entry points — the workflow bar, the
  // send / approve / ship / receive modals, the cancel reason dialog — so the
  // overlay watches the resulting status rather than each action. Guarded by
  // rma.id: Duplicate lands on a fresh Draft, and without the guard that
  // mount would replay the source RMA's status as a spurious transition.
  const [rmaTransition, setRmaTransition] = useState<{
    visible: boolean;
    from: RMAStatus;
    to: RMAStatus;
  } | null>(null);
  const prevRmaStatusRef = useRef<RMAStatus | null>(null);
  const prevRmaIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!rma) return;
    const next = rma.status;
    const prev = prevRmaStatusRef.current;
    if (prevRmaIdRef.current === rma.id && prev && prev !== next) {
      setRmaTransition({ visible: true, from: prev, to: next });
    }
    prevRmaStatusRef.current = next;
    prevRmaIdRef.current = rma.id;
  }, [rma?.id, rma?.status]);

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
  const linkedFinancialsBase = useMemo(
    () => (invoice && seedInvoice ? getLinkedFinancials(seedInvoice, seedInvoice.amount) : null),
    [invoice, seedInvoice]
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
    const reversedRefs = new Set(sessionReversals.map((r) => r.reversedReference));
    const records = [
      ...linkedFinancialsBase.records.map((r) =>
        (r.type === 'Payment' || r.type === 'Prepayment') && reversedRefs.has(r.reference)
          ? { ...r, status: 'Reversed' as const }
          : r,
      ),
      ...sessionCreditMemos,
    ];
    // Live outstanding comes from App state (settlements + reversals),
    // reduced by session credit memos; the reconciliation identity
    // prepays + credits + payments + outstanding = total stays exact.
    const cancelled = invoice.status === 'Cancelled';
    const effectiveOutstanding = cancelled ? 0 : Math.max(0, round2(invoice.outstandingBalance - creditTotal));
    const creditsApplied = round2(linkedFinancialsBase.creditsApplied + creditTotal);
    const prepaymentsApplied = linkedFinancialsBase.prepaymentsApplied;
    const paymentsApplied = Math.max(0, round2(invoice.amount - effectiveOutstanding - prepaymentsApplied - creditsApplied));
    return {
      ...linkedFinancialsBase,
      records,
      creditsApplied,
      prepaymentsApplied,
      paymentsApplied,
      effectiveOutstanding,
    };
  }, [linkedFinancialsBase, sessionCreditMemos, sessionReversals, invoice]);

  // Procurement documents (POs + receiving) shown alongside the financial
  // records in the Linked Records tab. Display-only — they never touch the
  // invoice balance, so they are kept out of getLinkedFinancials.
  const linkedProcurement = useMemo(
    () => (invoice ? getLinkedProcurement(invoice) : []),
    [invoice]
  );

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
    const tax = Math.round(total * 0.07 * 100) / 100;
    const freight = Math.round(total * 0.03 * 100) / 100;
    const additional = Math.round(total * 0.01 * 100) / 100;
    const subtotal = Math.round((total - tax - freight - additional) * 100) / 100;
    // Outstanding reflects everything applied against the invoice —
    // payments AND linked documents (prepayments, credit memos). "paid"
    // here is the settled complement so progress bars stay in tune.
    const outstanding = linkedFinancials?.effectiveOutstanding ?? invoice.outstandingBalance;
    const paid = Math.max(0, Math.round((total - outstanding) * 100) / 100);
    // Credit memos applied — surfaced as an explicit reduction line in
    // the Invoice Summary (7/15/26).
    const credits = Math.round((linkedFinancials?.creditsApplied ?? 0) * 100) / 100;
    const burdenPct = subtotal > 0 ? ((tax + freight) / subtotal) * 100 : 0;
    const due = new Date(invoice.dueDate);
    const today = new Date();
    const daysOverdue = daysBetween(today, due);
    const received = new Date(invoice.createdDate || invoice.invoiceDate);
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
    // Pre-invoices settle through prepayments, so the reversal flow lists
    // their PREPAYMENT records instead (lifecycle spec 7/15/26).
    const reversibleType = invoice.type === 'Pre-Invoice' ? 'Prepayment' : 'Payment';
    const fromLinked = linkedFinancials.records
      .filter((r) => r.type === reversibleType && countsTowardBalance(r.status as any))
      .map((r) => ({ id: r.id, reference: r.reference, date: r.date, amount: r.amount }));
    // App-recorded payments applied to this invoice appear too, so every
    // payment on the Payments tab is reversible (feedback 7/15/26).
    const fromApp = payments
      .filter((p) => p.type === reversibleType && p.status === 'Paid')
      .flatMap((p) =>
        (p.appliedInvoices ?? [])
          .filter((a) => a.invoiceNumber === invoice.invoiceNumber)
          .map((a) => ({ id: p.id, reference: p.paymentNumber, date: p.paymentDate, amount: a.amount })),
      );
    const seen = new Set(fromLinked.map((r) => r.reference));
    return [...fromLinked, ...fromApp.filter((r) => !seen.has(r.reference))];
  }, [linkedFinancials, invoice, payments]);

  if (!invoice) return null;

  const status: DisplayStatus = statusOverride ?? mapStatus(invoice.status);
  const statusPalette = STATUS_PALETTE[status];
  const isPending = status === 'Pending Approval';
  // Pre-invoices get an "Add prepayment" action (type-conditional, so it isn't
  // in the status matrix) — it opens the Record Prepayment flow. A pre-invoice
  // isn't payable, so "Add Payment" (make-payment) is removed. Prepayments
  // require an APPROVED pre-invoice (design feedback 7/8/26): while pending,
  // the action doesn't exist at all; once approved it takes over the CTA
  // (mirroring how Add Payment takes over on regular invoices).
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
          return [{ key: 'add-prepayment', label: 'Add prepayment', icon: Wallet }, ...base];
        }
        if (status === 'Prepaid') return base;
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
            { key: 'add-prepayment', label: 'Add prepayment', icon: Wallet, variant: 'primary' as const },
            ...base,
          ];
        }
        // Partially Prepaid (and other mid states): Remittance keeps the
        // CTA, further prepayments wait in the menu. Filtering out
        // make-payment can strip the status's only primary action — without
        // a primary the header falls back to actions[0] (Reverse Payment)
        // and renders it TWICE, once as the CTA and once as the standalone
        // reverse button. Promote Remittance so the CTA stays sensible.
        const withPrimary = base.some((a) => a.variant === 'primary')
          ? base
          : base.map((a) => (a.key === 'remittance' ? { ...a, variant: 'primary' as const } : a));
        return [...withPrimary, { key: 'add-prepayment', label: 'Add prepayment', icon: Wallet }];
      })()
    : actionsForStatus(status, numbers.paid)
        // Settled via credit memo: no cash moved, nothing to reverse
        // (feedback 7/21/26). Remittance stays for any prior partial
        // payments on record.
        .filter((a) => !(invoice.status === 'Settled' && a.key === 'reverse-payment'));
  // Live hold — an invoice-level control fact (feedback 7/21/26). A hold
  // placed BEFORE approval keeps the status in the approval queue and
  // rides along as the held flag, so the action set adjusts here: swap
  // Payment Hold for Release Hold and pull the pay actions (a held
  // invoice can't take money; paying a pending one would auto-approve).
  const held = invoice.is_payment_held === true || status === 'On Hold';
  const heldActions = held && status !== 'On Hold'
    ? actions
        .filter((a) => a.key !== 'make-payment' && a.key !== 'add-prepayment')
        .map((a) => (a.key === 'payment-hold' ? { key: 'release-hold', label: 'Release Hold', icon: RotateCcw } : a))
    : actions;
  // The status's flagship action renders as the colored header CTA (like
  // the PO / SO modules); everything else, including Edit, lives in the
  // Actions dropdown (design feedback 7/8/26).
  const primaryAction = heldActions.find((a) => a.variant === 'primary') ?? heldActions[0];
  // Editing is only possible before approval (design feedback 7/8/26):
  // once an invoice is approved and posted, its content is locked.
  const canEdit = status === 'Pending Approval' || status === 'Exception';
  // Reject (pending) and Reverse Payment (any paid state) render as
  // standalone header buttons (design feedback 7/9), so they leave the menu.
  const headerOnlyKeys = new Set([
    primaryAction?.key,
    ...(isPending ? ['reject'] : []),
    ...(status === 'Partially Paid' || status === 'Paid' ? ['reverse-payment'] : []),
  ]);
  const invoiceMenuActions = [
    ...(canEdit ? [{ key: 'edit', label: 'Edit Invoice', icon: Pencil }] : []),
    ...heldActions.filter((a) => !headerOnlyKeys.has(a.key)),
  ];
  // ── RMA action set ────────────────────────────────────────────────
  // Per lifecycle spec (item #10): each state exposes ONLY the actions
  // that make sense for that step. Primary CTA is the next-step verb;
  // everything else lives in the Actions dropdown.
  const rmaCancelAction: ActionDef = { key: 'rma-cancel', label: 'Cancel RMA', icon: Ban, variant: 'destructive' };
  const rmaPrintAction: ActionDef = { key: 'rma-print', label: 'Print RMA', icon: Printer };
  const rmaDownloadAction: ActionDef = { key: 'rma-download', label: 'Download RMA', icon: Download };
  // Only on a cancelled return: archiving puts away something that is over
  // and settled nothing. A live return has a next step and a closed one is
  // the record of a credit.
  const rmaArchiveAction: ActionDef = { key: 'rma-archive', label: 'Archive', icon: Archive };
  // The two endings that cost money. A refusal can only happen once the
  // goods are with the vendor, and a refund only follows a credit on a
  // receipt that was already paid.
  const rmaRefusalAction: ActionDef = {
    key: 'rma-refusal',
    label: 'Vendor refused the return',
    icon: AlertTriangle,
    variant: 'destructive',
  };
  // Whether the vendor owes money or a credit. A credit needs no logging
  // step: the system raises it with the resolution and the return closes on
  // its own. Money has to be seen to land.
  const settlesInCash = rma?.creditTerms?.refundOrCredit !== 'Credit';
  const rmaActionsByStatus: Record<string, { primary?: ActionDef; menu: ActionDef[] }> = {
    // With Sent and Approved off in the company setup (DQ-03), there is no
    // authorization to ask for: a Draft ships straight to the vendor.
    Draft: rma && rmaShipsDirect(rma)
      ? {
          primary: { key: 'rma-ship', label: 'Ship to vendor', icon: Truck, variant: 'primary' },
          menu: [rmaPrintAction, rmaDownloadAction],
        }
      : {
          primary: { key: 'rma-submit', label: 'Send to vendor', icon: Send, variant: 'primary' },
          menu: [rmaPrintAction, rmaDownloadAction],
        },
    Sent: {
      primary: { key: 'rma-approve', label: 'Mark as approved', icon: CheckCheck, variant: 'primary' },
      menu: [rmaPrintAction, rmaDownloadAction, rmaCancelAction],
    },
    Approved: {
      // Not offered again while a shipment is in process (ERP-8659 AC2):
      // the shipment exists, and the last one moving the return on is the
      // Shipments team's, not a second press of the button.
      ...(rma && rmaShipmentInProcess(rma)
        ? {}
        : { primary: { key: 'rma-ship', label: 'Ship to vendor', icon: Truck, variant: 'primary' as const } }),
      // Once a shipment has gone out, part of the return is with the vendor,
      // so the RMA can no longer be cancelled whole. Unshipped lines can
      // still be removed one by one.
      menu: rma && rmaShipmentInProcess(rma)
        ? [rmaPrintAction, rmaDownloadAction]
        : [rmaPrintAction, rmaDownloadAction, rmaCancelAction],
    },
    // The goods are in transit, and how the return ends depends on how it
    // settles. Eli, Oct 7: there is no close action. A credit return creates
    // its credit and closes itself, so the button here only stands in for
    // that system. A refund return stays open the way an invoice stays open,
    // and logging what came back is what closes it.
    'Shipped to Vendor': {
      primary: settlesInCash
        ? { key: 'rma-log-settlement', label: 'Log settlement', icon: Banknote, variant: 'primary' }
        : { key: 'rma-close', label: 'Close return', icon: PackageCheck, variant: 'primary' },
      // No Cancel once the goods have shipped: they are with the vendor, and
      // the way out from here is a settlement or a refusal, not a cancel.
      menu: [
        rmaRefusalAction,
        rmaPrintAction,
        rmaDownloadAction,
      ],
    },
    // A closed return is settled. Recording money against it, or letting the
    // vendor refuse it, are both answers to questions the close already
    // answered, so the menu keeps only the two acts that read the record
    // rather than change it.
    Closed: {
      menu: [rmaPrintAction, rmaDownloadAction],
    },
    Cancelled: {
      menu: [rmaPrintAction, rmaDownloadAction, rmaArchiveAction],
    },
  };
  // Neither of these transitions is this team's to make. Shipping is stamped
  // by Shipments the moment a shipment is raised against the return, and the
  // close is stamped once Vendor Invoicing has settled the credit. The button
  // stands in for that system so the flow can be walked end to end, so it is
  // drawn as a stand-in and names who really moves the return.
  const RMA_SIMULATED_CTA: Record<string, string> = {
    'rma-ship':
      'Simulated step. The return moves to Shipped to Vendor on its own once the Shipments team raises a shipment against it. Use this to preview that state.',
    'rma-close':
      'Simulated step. A return that settles in credit closes on its own: Vendor Invoicing raises the credit with the resolution and nobody logs anything. Use this to preview that state.',
  };
  const rmaBundle = isRma ? (rmaActionsByStatus[rmaStatus ?? 'Draft'] ?? { menu: [] }) : null;
  const rmaPrimaryAction = rmaBundle?.primary ?? null;
  const rmaMenuActions = rmaBundle?.menu ?? [];
  const menuActions: ActionDef[] = isRma ? rmaMenuActions : invoiceMenuActions;
  // Status-transition CTAs run through the same confirm modal + state
  // transition animation the status pill dropdown used, so approving from
  // the CTA and from the old pill feel identical.
  const statusTargetForPrimary = (key: string): DisplayStatus | null => {
    switch (key) {
      case 'approve': return 'Approved';
      // 'resolve' and 'resubmit' intentionally absent — both open the
      // prefilled edit-and-resubmit creation modal instead of a status
      // confirm (7/15/26).
      case 'release-hold': return 'Approved';
      case 'archive': return 'Archived';
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
  const exceptionNotifiedNames = notifiedNamesFor('flagException');
  const rejectNotifiedNames = notifiedNamesFor('reject');

  const handleReasonConfirm = (reason: string, notifiedRecipientIds?: string[]) => {
    if (!reasonAction) return;
    const fromStatus = status;
    // RMA mode has no invoice to mutate — the reason rides the RMA action
    // so it lands in the action history and the cancelled banner.
    if (isRma && reasonAction === 'cancel') {
      onRmaAction?.('cancel', { reason });
      toast.success('RMA cancelled');
      setReasonOpen(false);
      setReasonAction(null);
      return;
    }
    applyInvoiceAction?.([invoice.id], reasonAction, reason, notifiedRecipientIds);
    setStatusOverride(null);
    const verb =
      reasonAction === 'reject'
        ? 'Invoice rejected'
        : reasonAction === 'cancel'
          ? 'Invoice cancelled'
          : reasonAction === 'flagException'
            ? 'Flagged as exception'
            : 'Placed on payment hold';
    toast.success(verb);
    setReasonOpen(false);
    setReasonAction(null);
    // Same "State Transitioned" response the approve flow plays — every
    // state change answers with the transition overlay (design feedback).
    const target: DisplayStatus =
      reasonAction === 'reject' ? 'Rejected'
        : reasonAction === 'cancel' ? 'Cancelled'
          : reasonAction === 'flagException' ? 'Exception'
            : 'On Hold';
    setTransitionOverlay({ visible: true, from: fromStatus, to: target });
  };

  const handleAction = (action: ActionDef) => {
    // RMA lifecycle actions (item #10 / #11) — the parent route wires
    // onRmaAction to applyRMAAction. Toast is a UX affordance only;
    // the real state mutation happens at the route level.
    switch (action.key) {
      // Sending is what the vendor actually sees, so it previews the
      // document before the status moves, the same way dispatch confirms
      // against a summary of the goods.
      case 'rma-submit':
        setRmaSendOpen(true);
        return;
      // A vendor who cuts the request is recorded by editing the lines, and
      // each edit is already kept as a version, so approval is the status move
      // on its own.
      case 'rma-approve':
        setRmaApproveOpen(true);
        return;
      case 'rma-ship':
        onRmaAction?.('ship');
        // A credit return closes once everything has shipped (DQ-01), and
        // the credit waits on accounting rather than on this return.
        if (rma?.creditTerms?.refundOrCredit === 'Credit') {
          toast.success(`${rma.rmaNumber} shipped and closed`, {
            description: 'A pending credit was raised. Accounting confirms it against the vendor\'s memo.',
          });
        } else {
          toast.success('Simulated shipment to vendor');
        }
        return;
      // The credit can land well after the goods do, so closing is a plain
      // status move and the amount is recorded separately.
      case 'rma-close':
        onRmaAction?.('close');
        toast.success('Return closed', {
          // The goods reached the vendor when the return shipped, which is a
          // different step. Closing says this return is done being worked;
          // whatever the vendor still owes is recorded on its own.
          description: 'No further action is tracked against it.',
        });
        return;
      case 'rma-cancel':
        setReasonAction('cancel');
        setReasonOpen(true);
        return;
      case 'rma-log-settlement':
        setRmaSettleOpen(true);
        return;
      case 'rma-record-refund':
        onRmaAction?.('record-refund');
        toast.success('Refund recorded', {
          description: 'The money is back and the receivable clears.',
        });
        return;
      case 'rma-refusal':
        setRmaRefuseOpen(true);
        return;
      case 'rma-print':
        setRmaAutoPrint(false);
        setRmaPrintOpen(true);
        return;
      case 'rma-download':
        setRmaAutoPrint(true);
        setRmaPrintOpen(true);
        return;
      case 'rma-archive':
        // Asked first: the return leaves the list, and acting on the click
        // gave nobody the chance to say they meant a different row.
        setRmaArchiveOpen(true);
        return;
    }
    switch (action.key) {
      // ── Approval workflow — persist to the shared invoices state ──
      case 'approve':
        applyInvoiceAction?.([invoice.id], 'approve', '');
        setStatusOverride(null);
        toast.success('Invoice approved');
        return;
      // ── Resolve exception — same edit-and-resubmit flow as rejection:
      //    the prefilled creation modal opens with the exception reason
      //    replayed, fix anything, then resubmit (7/15/26) ──
      case 'resolve':
        // Confirm first with the optional notify (feedback 7/22/26) —
        // the edit-and-resubmit flow opens on confirm.
        setResolveNotify(true);
        setResolveRecipients(new Set(notifiedIdsFor('flagException')));
        setResolveConfirm('resolve');
        return;
      case 'release-hold':
        // Confirm first — releasing OFFERS (never forces) notifying the
        // people who were told about the hold (meeting feedback 7/17/26).
        setReleaseNotify(true);
        setReleaseRecipients(new Set(notifiedIdsFor('paymentHold')));
        setReleaseConfirmOpen(true);
        return;
      // ── Reason-required transitions → shared reason dialog ──
      case 'reject':
        setReasonAction('reject');
        setReasonOpen(true);
        return;
      case 'cancel':
        setReasonAction('cancel');
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
      // ── Edit and resubmit — open the prefilled creation modal with the
      //    rejection reason replayed in a banner (7/15/26) ──
      case 'resubmit':
        setResolveNotify(true);
        setResolveRecipients(new Set(notifiedIdsFor('reject')));
        setResolveConfirm('resubmit');
        return;
      // ── Payment — launch the pre-scoped Record Payment flow ──
      case 'make-payment':
        onPayInvoices?.([invoice.id]);
        return;
      // ── Prepayment — launch the Record Prepayment flow for this pre-invoice ──
      case 'add-prepayment':
        onAddPrepayment?.(invoice.vendor, invoice.id);
        return;
      // ── Existing modal flows ──
      case 'add-credit':
        setCreditMemoOpen(true);
        return;
      case 'reverse-payment':
        if (priorPayments.length === 0) {
          toast.info('No prior payments on this invoice to reverse.');
          return;
        }
        setReversePaymentOpen(true);
        return;
      default:
        toast.info(`${action.label}, coming next PR.`);
    }
  };

  const linkedRecordsHint = (() => {
    const counts: string[] = [];
    if (invoice.linkedPOs?.length) counts.push(`${invoice.linkedPOs.length} PO${invoice.linkedPOs.length === 1 ? '' : 's'}`);
    if (invoice.linkedGRNs?.length) {
      const n = invoice.linkedGRNs.length;
      counts.push(`${n} Receiving Document${n === 1 ? '' : 's'}`);
    }
    if (!counts.length) return null;
    return counts.join(' + ');
  })();

  // Header description sentence. 3-way / 2-way match phrasing was
  // removed per BA — match metadata lives in Linked Records tab
  // now, not in the page-header description.
  const descriptionText = (() => {
    // RMA mode: the reason the goods are going back. The return type used
    // to lead this line; it is not asked on the return any more, so it is
    // not stated on it either.
    // A return prints no description line at all -- the reasons sit on the
    // lines, one per line, where each can be read against the goods it
    // belongs to. Nothing here has to answer for a return any more.
    if (isRma) return '';
    if (invoice.description && invoice.description.length > 120) return invoice.description;
    const baseDesc = invoice.description ? `${invoice.description}.` : '';
    const matchPhrase = invoice.linkedPOs?.length
      ? `linked to ${invoice.linkedPOs.length === 1 ? 'PO' : `${invoice.linkedPOs.length} POs`}${invoice.linkedGRNs?.length ? ` and ${invoice.linkedGRNs.length === 1 ? 'Receiving Document' : `${invoice.linkedGRNs.length} Receiving Documents`}` : ''}`
      : 'standalone, no purchase order linked';
    const vendorClause = vendorData
      ? `submitted by ${invoice.vendor} (${vendorData.category}, ${vendorData.type} operations)`
      : `submitted by ${invoice.vendor}`;
    const balanceClause = numbers.outstanding > 0
      ? `Outstanding balance ${moneyIn(numbers.outstanding, invoice.currency)} due ${invoice.dueDate}`
      : `Paid in full on ${invoice.postingDate || invoice.invoiceDate}`;
    const typeClause = `${invoice.type} invoice ${matchPhrase}`;
    const apClause = invoice.apAccount
      ? `Posts to AP account ${invoice.apAccount}`
      : 'AP account pending mapping';
    return `${baseDesc} ${typeClause} ${vendorClause}. ${balanceClause}. ${apClause}. Invoice number ${invoice.invoiceNumber} dated ${invoice.invoiceDate}, posted ${invoice.postingDate || invoice.invoiceDate}, payment terms ${vendorData?.paymentTerms || 'Net 30'}.`.trim();
  })();
  const descNeedsTruncation = descriptionText.length > 140;

  return (
    <RMAEditGateProvider rma={isRma ? rma : null}>
    <ReturnViewProvider value={isRma ? 'base' : 'document'}>
    <div ref={scrollContainerRef} className="flex-1 flex flex-col bg-slate-50">
      {/* IntersectionObserver sentinel — sits just below the topbar */}
      <div ref={sentinelRef} className="shrink-0 h-px" />

      {/* ══════════════════════════════════════════════
          STICKY MORPHING HEADER CARD
         ══════════════════════════════════════════════ */}
      <div className="shrink-0 sticky top-0 z-20 bg-slate-50">
        <div style={{ paddingTop: isScrolled ? '8px' : '12px', paddingBottom: '4px', transition: 'padding-top 250ms ease' }}>
          <div className={`mx-auto px-3 transition-all duration-300 ${isFullscreen ? 'max-w-full' : 'max-w-[1440px] 2xl:max-w-[1600px]'}`}>
            <div
              className={`border rounded-xl overflow-hidden transition-shadow duration-250 ${
                isScrolled
                  ? 'shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_4px_12px_-4px_rgba(0,0,0,0.05)]'
                  : 'shadow-sm'
              }`}
              style={isRma ? rmaHeaderCardStyle(rmaStatus ?? 'Draft') : headerCardStyle(status)}
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
                    aria-label={isRma ? 'Back to RMA list' : 'Back to invoice list'}
                  >
                    <ChevronLeft className="text-slate-400 transition-all duration-250" style={{ width: isScrolled ? 16 : 20, height: isScrolled ? 16 : 20 }} />
                  </button>

                  {/* Avatar tile — dynamic per INVOICE TYPE, wearing the
                      exact icon + colors of the listing's Invoice Type
                      pill (TYPE_PALETTE): Receiving truck/green,
                      Pre-Invoice package/amber-dashed, Standalone
                      calculator/purple (feedback 7/15/26). */}
                  {(() => {
                    // RMA mode: avatar tile picks up the return-type
                    // palette so header icon + type chip match hue.
                    const t = isRma && rma
                      ? RMA_TYPE_PALETTE['Refund/Credit']
                      : (TYPE_PALETTE[invoice.type] ?? CATEGORY_META[invoiceCategory(invoice.type)]);
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
                        className="text-foreground truncate transition-all duration-250 tabular-nums"
                        style={{ fontSize: isScrolled ? 13 : 16, fontWeight: isScrolled ? 600 : 700, lineHeight: isScrolled ? '18px' : '22px' }}
                      >
                        {invoice.invoiceNumber}
                      </h1>

                      {/* The vendor, then the return's currency tag
                          (2026-11-24; the spec's "RMA-01024 · Oakmoor
                          Transport [EUR] [Currency]"), as Purchase Orders,
                          Quotes and Sales Orders show theirs. A PKR return
                          gets no tag. */}
                      {isRma && rma && (
                        <>
                          {invoice.vendor && (
                            <span
                              className="truncate text-slate-600"
                              style={{ fontSize: isScrolled ? 11.5 : 12.5, fontWeight: 500, lineHeight: isScrolled ? '18px' : '22px', maxWidth: 320 }}
                              title={invoice.vendor}
                            >
                              {invoice.vendor}
                            </span>
                          )}
                          <ReturnCurrencyTag currency={returnCurrencyOf(rma)} po={`PO-${rmaCurrencyPO(rma)}`} />
                        </>
                      )}

                      {/* Type pill — mirrors the listing table's Type column
                          exactly: one flat pill per type (taxonomy rev
                          7/9/26); Pre-Invoice alone is amber + dashed since
                          it's a deposit, not an invoice. Tooltip explains
                          the type in plain language (peer review 7/7/26).
                          Pill order rev 7/16/26: number, type, vendor,
                          status, linked records. */}
                      {(() => {
                        // No return-type chip in RMA mode. Return type is set
                        // per line, so a single header chip would speak for
                        // lines that may not share it.
                        if (isRma && rma) return null;
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
                            <TooltipContent side="bottom" className="max-w-[240px] z-[300]">
                              <p className="text-[11px] leading-snug">{explainer}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })()}

                      {/* Vendor pill — clickable to the partner page with the
                          VendorQuickCard hover preview. (The vendor is also
                          surfaced prominently in the sidebar vendor card.)
                          Invoice-only: on a return the sidebar vendor card is
                          the single read, so the header stays uncluttered. */}
                      {!isRma && (
                      <HoverCard openDelay={300} closeDelay={120}>
                        <HoverCardTrigger asChild>
                          <button
                            type="button"
                            onClick={() => window.open('https://partner-management-module.lovable.app/vendors/v-001', '_blank', 'noopener,noreferrer')}
                            className="inline-flex items-center gap-1 rounded-md border bg-white hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 cursor-pointer"
                            style={{
                              padding: isScrolled ? '1px 6px' : '2px 8px',
                              fontSize: isScrolled ? 10 : 11,
                              fontWeight: 600,
                              color: 'hsl(var(--primary))',
                              borderColor: 'hsl(var(--border))',
                            }}
                            title={`Open ${invoice.vendor} in Partners`}
                          >
                            <Truck className="transition-all duration-250" style={{ width: isScrolled ? 10 : 12, height: isScrolled ? 10 : 12 }} />
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
                      )}

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
                      ) : isRma ? (() => {
                        // A return has one axis, not two. The Invoice-shaped
                        // adapter flattens every post-Sent RMA to 'Approved'
                        // and every live one to unpaid, so reusing the invoice
                        // pills would print "Approved · Unpaid" on an RMA the
                        // stepper below shows as Shipped to Vendor. Read the
                        // real status instead, in the list screen's palette so
                        // the pill matches the row the user clicked in from.
                        const key = rma
                          ? rmaStatusLabel(rma)
                          : ((rmaStatus ?? 'Draft') as RMAStatus);
                        const p = RMA_STATUS_STYLES[key] ?? RMA_STATUS_STYLES.Draft;
                        // The goods are with the vendor and the money is not
                        // back yet. Only on a return that settles in cash: a
                        // credit return closes itself, so it never waits.
                        const awaitingRefund = key === 'Shipped to Vendor' && settlesInCash;
                        // DQ-02: past the company's setting, the wait becomes
                        // the thing to act on, so it takes the tag's place.
                        const overdue = !!rma && rmaPaymentOverdue(rma);
                        const overdueDays = rma ? rmaDaysSinceShipped(rma) : null;
                        // ERP-8637 AC9: the return keeps its status until the
                        // last shipment ships, and says so beside it.
                        const shipmentProgress =
                          rma && rmaShipmentInProcess(rma) ? rmaShipmentProgress(rma) : null;
                        return (
                          <>
                            <span
                              className="inline-flex items-center rounded-full border"
                              style={{
                                padding: isScrolled ? '1px 6px' : '2px 8px',
                                fontSize: isScrolled ? 10 : 11,
                                fontWeight: 600,
                                backgroundColor: p.bg,
                                color: p.fg,
                                borderColor: p.border,
                              }}
                            >
                              {key}
                            </span>
                            {overdue && (
                              <span
                                className="inline-flex items-center gap-1 rounded-full border"
                                style={{
                                  padding: isScrolled ? '1px 6px' : '2px 8px',
                                  fontSize: isScrolled ? 10 : 11,
                                  fontWeight: 600,
                                  backgroundColor: '#FEF2F2',
                                  color: '#B91C1C',
                                  borderColor: '#FECACA',
                                }}
                                title={`Shipped ${overdueDays} days ago, past the ${PAYMENT_OVERDUE_DAYS}-day setting, and the refund has not been logged.`}
                              >
                                <AlertTriangle className={isScrolled ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
                                Payment overdue
                              </span>
                            )}
                            {awaitingRefund && !overdue && (
                              <span
                                className="inline-flex items-center gap-1 rounded-full border"
                                style={{
                                  padding: isScrolled ? '1px 6px' : '2px 8px',
                                  fontSize: isScrolled ? 10 : 11,
                                  fontWeight: 600,
                                  // Neutral, so it reads as a note on the
                                  // status beside it rather than a second
                                  // status in Shipped's own amber.
                                  backgroundColor: '#FFFFFF',
                                  color: '#475569',
                                  borderColor: '#CBD5E1',
                                }}
                                title="Shipped to the vendor. The refund has not been logged yet."
                              >
                                <Clock className={isScrolled ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
                                Pending refund
                              </span>
                            )}
                            {shipmentProgress && (
                              <span
                                className="inline-flex items-center gap-1 rounded-full border"
                                style={{
                                  padding: isScrolled ? '1px 6px' : '2px 8px',
                                  fontSize: isScrolled ? 10 : 11,
                                  fontWeight: 600,
                                  backgroundColor: '#FFFFFF',
                                  color: '#475569',
                                  borderColor: '#CBD5E1',
                                }}
                                title={`${shipmentProgress.shipped} of ${shipmentProgress.total} shipments have gone out. The return moves to Shipped to Vendor once the last one ships.`}
                              >
                                <Truck className={isScrolled ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
                                Shipment in process
                              </span>
                            )}
                          </>
                        );
                      })() : (() => {
                        const approvalLabel =
                          status === 'Pending Approval' ? 'Pending approval'
                          : status === 'Rejected' || status === 'Exception' || status === 'Cancelled' ? status
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
                          : status === 'Partially Paid' ? 'Partially paid'
                          : status === 'Paid' ? 'Paid in full'
                          : status === 'On Hold' ? (partiallyCovered ? 'Partially paid' : 'Unpaid')
                          : status === 'Partially Prepaid' ? 'Partially prepaid'
                          : status === 'Prepaid' ? 'Prepaid'
                          : status === 'Cancelled' ? null
                          : 'Unpaid';
                        const paymentPalette =
                          invoice.status === 'Settled' ? { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' }
                          : status === 'Partially Paid' ? STATUS_PALETTE['Partially Paid']
                          : status === 'Paid' ? STATUS_PALETTE.Paid
                          : status === 'On Hold' ? (partiallyCovered ? STATUS_PALETTE['Partially Paid'] : { bg: '#F1F5F9', color: '#475569', border: '#E2E8F0' })
                          : status === 'Partially Prepaid' ? STATUS_PALETTE['Partially Prepaid']
                          : status === 'Prepaid' ? STATUS_PALETTE.Prepaid
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
                              <span className="inline-flex items-center rounded-full border" style={pillStyle(STATUS_PALETTE['On Hold'])}>
                                On hold
                              </span>
                            )}
                            {paymentLabel && (
                              <span className="inline-flex items-center rounded-full border" style={pillStyle(paymentPalette)}>
                                {paymentLabel}
                              </span>
                            )}
                          </>
                        );
                      })()}

                      {/* Version pill — opens the history panel and puts the
                          page into the read-only viewing state. */}
                      {isRma && rma && (
                        <RMAVersionDropdown
                          versions={rmaVersions}
                          currentVersion={rma.currentVersion ?? rmaVersions[0]?.version ?? 1}
                          viewingVersion={viewingVersion}
                          onViewVersion={setViewingVersion}
                          {...(onRmaRevert && rmaCanRevert(rma) ? { onRevertToVersion: setRevertTarget } : {})}
                          compact={isScrolled}
                        />
                      )}

                      {!isScrolled && !isRma && linkedRecordsHint && (
                        /* Clickable (design review 7/9/26): the linked-records
                           chip jumps to the Linked Records tab where each PO
                           and receiver links out to its source document.
                           Invoice-only: a return already names its source PO
                           and receipts on the sidebar and its line rows. */
                        <button
                          type="button"
                          onClick={() => setActiveTab('linked-records')}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border bg-white text-slate-700 hover:text-primary hover:border-primary/40 hover:bg-blue-50/40 transition-colors cursor-pointer"
                          style={{ fontWeight: 500, borderColor: 'hsl(var(--border))' }}
                          title="Open the Linked Records tab"
                        >
                          <Link2 className="w-3 h-3 text-slate-400" />
                          {linkedRecordsHint} linked
                        </button>
                      )}
                    </div>

                    {/* Vendor RMA # — small subtitle under the title
                        line when present (item #3). Hidden while
                        scrolled to keep the sticky header compact. */}
                    {isRma && rma?.vendorRMANumber && !isScrolled && (
                      <p className="text-[11px] text-slate-500 tabular-nums mt-0.5" style={{ fontWeight: 500 }}>
                        Vendor RMA #{' '}
                        <span className="text-slate-700" style={{ fontWeight: 600 }}>
                          {rma.vendorRMANumber}
                        </span>
                      </p>
                    )}

                    {/* Row 2 — description block with show more/less.
                        Matches the partner two-row title pattern: code +
                        pills on row 1, description on row 2. Vendor /
                        posting / match metadata lives in the sidebar's
                        General Information + 3-Way Matching sections.

                        A return has no description of its own: the line it
                        carried was the reason, and a reason stated once at the
                        top of a record whose lines each carry their own is
                        either a repeat or a half-truth. The reasons live on
                        the lines, in their own column, which is where somebody
                        reading them can see which line each belongs to. */}
                    {!isRma && (
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
                  {/* The Currency button, which opens the return's currency
                      configuration. No Base | Vendor Currency toggle
                      (2026-11-24): the page reads in PKR. */}
                  {isRma && rma && (
                    <CurrencyHeaderControls
                      onOpenConfig={() => setCurrencyConfigOpen(true)}
                      compact={isScrolled}
                    />
                  )}
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

                  {/* Reject sits beside Approve while pending (design 7/9).
                      RMA mode uses a distinct action set — no reject. */}
                  {!isRma && isPending && (
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
                  {!isRma && (status === 'Partially Paid' || status === 'Paid') && invoice.status !== 'Settled' && (
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
                      animation the status pill used. Edit lives in Actions.
                      RMA mode swaps in the next-step verb per status
                      (item #11); Closed / Cancelled hide the button. */}
                  {isRma
                    ? (rmaPrimaryAction && (() => {
                        const PIcon = rmaPrimaryAction.icon;
                        // A dashed, tinted button rather than the solid CTA:
                        // the step is real but the trigger is not.
                        const simulatedNote = RMA_SIMULATED_CTA[rmaPrimaryAction.key];
                        const cta = (
                          <button
                            onClick={() => handleAction(rmaPrimaryAction)}
                            className={`rounded-lg inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
                              simulatedNote
                                ? 'border border-dashed border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-500'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                            } ${isScrolled ? 'h-8 px-3.5 text-[12px]' : 'h-9 px-4 text-[13px]'}`}
                            style={{ fontWeight: 600 }}
                          >
                            <PIcon className={isScrolled ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                            {rmaPrimaryAction.label}
                            {simulatedNote && (
                              <span
                                className="ml-0.5 rounded border border-emerald-300 bg-white px-1.5 py-0.5 text-[10px] tracking-wide text-emerald-600"
                                style={{ fontWeight: 700 }}
                              >
                                SIMULATED
                              </span>
                            )}
                          </button>
                        );
                        if (!simulatedNote) return cta;
                        return (
                          <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>{cta}</TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-[280px] z-[300]">
                              {simulatedNote}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })())
                    : primaryAction && (() => {
                    const PIcon = primaryAction.icon;
                    const tone = PRIMARY_CTA_TONE[primaryAction.key] ?? 'bg-primary hover:bg-[#0862D0]';
                    return (
                      <button
                        onClick={() => {
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
                {isRma ? (
                  <RmaWorkflowBar rmaStatus={rmaStatus ?? 'Draft'} closedWithLoss={!!rma?.closedWithLoss} steps={rma ? rmaLifecycleSteps(rma) : undefined} />
                ) : (
                  <StatusWorkflowBar status={status} invoice={invoice} records={linkedFinancials?.records ?? []} appPayments={payments} paymentsContext={fromPayments} />
                )}
              </div>

              {/* Tab bar — always visible at the bottom of the card.
                  RMA mode hides Payments, since returns are never settled
                  here. Before the vendor has agreed to take the goods back
                  there is no shipment and nothing has posted, so Shipping
                  and GL Impact stay out of the bar until then. */}
              <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide border-t border-muted px-4 lg:px-5">
                {TABS.filter((t) =>
                  isRma
                    ? t.key !== 'payments' &&
                      !(RMA_PRE_SETTLEMENT_STATUSES.includes(rma?.status ?? 'Draft') &&
                        (t.key === 'gl-impact' || t.key === 'shipping'))
                    : t.key !== 'versions' && t.key !== 'notes' && t.key !== 'communication',
                ).map((tab) => {
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
                      {(isRma && RMA_TAB_LABELS[tab.key]) ?? tab.label}
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
              <StatusReasonBanner
                invoice={invoice}
                status={status}
                isRma={isRma}
                onResolveException={() => handleAction({ key: 'resolve', label: 'Resolve', icon: CheckCircle2 })}
                onResubmit={() => handleAction({ key: 'resubmit', label: 'Edit and Resubmit', icon: RotateCcw })}
                onReleaseHold={() => handleAction({ key: 'release-hold', label: 'Release Hold', icon: RotateCcw })}
              />
              {/* A hold placed BEFORE approval rides on the held flag while
                  the status keeps its queue place (feedback 7/21/26) — the
                  hold banner still needs to show, so it renders alongside
                  the status's own banner. */}
              {isRma && viewingVersion !== null && (
                <div
                  className="flex items-center gap-3 rounded-xl border mb-4"
                  style={{ padding: '10px 14px', backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}
                >
                  <div
                    className="flex items-center justify-center shrink-0"
                    style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#FEF3C7' }}
                  >
                    <FileText style={{ width: 14, height: 14, color: '#D97706' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#92400E', lineHeight: 1.3 }}>
                      Viewing Version {viewingVersion}
                    </div>
                    <div style={{ fontSize: 11, color: '#B45309', lineHeight: 1.4 }}>
                      Read-only historical snapshot. Editing is disabled until you switch back.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewingVersion(null)}
                    className="shrink-0 transition-opacity hover:opacity-90"
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#FFFFFF',
                      backgroundColor: '#D97706',
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Switch to current
                  </button>
                </div>
              )}
              {/* Approved is a waiting state, not an idle one: the next move
                  belongs to Shipments, and the return advances on their
                  dispatch rather than on anything done here. */}
              {/* Only once a shipment exists (ERP-8659 AC2). It used to show
                  the moment the return was approved, saying the Shipments team
                  had it before anyone had pressed Ship to vendor. */}
              {/* Editing banner, ported from the PO detail page: which
                  version is being built, what it has so far, and the two
                  ways out of it. */}
              {rmaEditing && rma && (
                <div
                  className="flex items-center justify-between gap-3 rounded-md border bg-white shadow-sm px-4 py-3 flex-wrap"
                  style={{ borderColor: 'hsl(var(--border))' }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex items-center justify-center shrink-0 rounded-md border"
                      style={{ width: 28, height: 28, backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
                    >
                      <Pencil style={{ width: 14, height: 14, color: '#1E40AF' }} />
                    </div>
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <span className="text-foreground" style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>
                        Editing Version <span className="tabular-nums">{rmaNextVersion}</span>
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 400, color: '#64748B', lineHeight: 1.4 }}>
                        {`· RMA stays ${rma.status} on save · `}
                        <span className="tabular-nums">{rmaSessionChanges.length}</span> change{rmaSessionChanges.length !== 1 ? 's' : ''} made
                      </span>
                      {rmaSessionTags.length > 0 && (() => {
                        const MAX_VISIBLE = 4;
                        const visible = rmaSessionTags.slice(0, MAX_VISIBLE);
                        const overflow = rmaSessionTags.length - MAX_VISIBLE;
                        const tagPillStyle: React.CSSProperties = {
                          padding: '1px 6px',
                          fontSize: 10,
                          fontWeight: 500,
                          backgroundColor: '#EFF6FF',
                          color: '#1E40AF',
                          borderColor: '#BFDBFE',
                          borderWidth: 1,
                          borderStyle: 'solid',
                          lineHeight: 1.4,
                          whiteSpace: 'nowrap',
                        };
                        return (
                          <div className="flex items-center gap-1.5 ml-1 min-w-0 overflow-hidden">
                            {visible.map((tag) => (
                              <span key={tag} className="inline-flex items-center rounded-md shrink-0" style={tagPillStyle}>
                                {tag}
                              </span>
                            ))}
                            {overflow > 0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    className="inline-flex items-center rounded-md shrink-0 cursor-default"
                                    style={{ ...tagPillStyle, backgroundColor: '#F1F5F9', color: '#475569', borderColor: '#E2E8F0' }}
                                  >
                                    +{overflow} more
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                  <div className="flex flex-col">
                                    {rmaSessionTags.slice(MAX_VISIBLE).map((t) => (
                                      <span key={t} className="py-0.5" style={{ fontSize: 12 }}>{t}</span>
                                    ))}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        discardEditSession(rma.id);
                        toast('Changes discarded');
                      }}
                      className="h-8 px-3 rounded-md inline-flex items-center cursor-pointer transition-colors duration-150 hover:bg-muted/60"
                      style={{ fontSize: 12, fontWeight: 500, color: '#64748B', backgroundColor: 'transparent', border: 'none', lineHeight: 1 }}
                    >
                      Discard Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => setRmaSaveVersionOpen(true)}
                      className="h-8 px-3 rounded-md inline-flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors duration-150 hover:opacity-90"
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'hsl(var(--primary-foreground))',
                        backgroundColor: 'hsl(var(--primary))',
                        border: 'none',
                        lineHeight: 1,
                      }}
                    >
                      <Save style={{ width: 12, height: 12 }} />
                      Save Version
                    </button>
                  </div>
                </div>
              )}
              {isRma && rmaStatus === 'Approved' && rma && rmaShipmentInProcess(rma) && (
                <div
                  className="flex items-center gap-3 rounded-xl border"
                  style={{ padding: '10px 14px', backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' }}
                >
                  <div
                    className="flex items-center justify-center shrink-0"
                    style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#E0F2FE' }}
                  >
                    <Truck style={{ width: 14, height: 14, color: '#0284C7' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#075985', lineHeight: 1.3 }}>
                      {`${rmaShipmentProgress(rma).shipped} of ${rmaShipmentProgress(rma).total} shipments have gone out`}
                    </div>
                    <div style={{ fontSize: 11, color: '#0369A1', lineHeight: 1.4 }}>
                      {`The Shipments team has the rest. It moves to Shipped to Vendor once the last shipment is on its way to ${invoice.vendor}. Lines still in the warehouse can be reduced or cancelled until then.`}
                    </div>
                  </div>
                </div>
              )}
              {held && status !== 'On Hold' && (
                <StatusReasonBanner
                  invoice={invoice}
                  status={'On Hold'}
                  onReleaseHold={() => handleAction({ key: 'release-hold', label: 'Release Hold', icon: RotateCcw })}
                />
              )}
              {activeTab === 'line-items' && (
                <LineItemsTab
                  invoice={invoice}
                  subtotal={numbers.subtotal}
                  isPending={isPending}
                  rma={rma}
                  readOnly={viewingVersion !== null}
                />
              )}
              {activeTab === 'shipping' && rma && (
                <ShippingTab invoice={invoice} rma={rma} />
              )}
              {activeTab === 'linked-records' && (
                <LinkedRecordsTab
                  invoice={invoice}
                  // A return has its own chain: the order and the receipt the
                  // goods came in on, what was billed and paid for them, and
                  // everything the return itself raises as it ships and
                  // settles. The invoice-side builders know none of that.
                  records={
                    rma
                      ? getRMALinkedRecords(rma)
                      : [...linkedProcurement, ...(linkedFinancials?.records ?? [])]
                  }
                  totalAmount={numbers.total}
                  {...(rma ? { rma } : {})}
                />
              )}
              {!isRma && activeTab === 'payments' && (
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
                />
              )}
              {activeTab === 'gl-impact' && (
                <GLImpactTab invoice={invoice} numbers={numbers} payments={priorPayments} {...(isRma && rma ? { rma } : {})} />
              )}
              {activeTab === 'attachments' && <AttachmentsTab invoice={invoice} rma={rma} />}
              {activeTab === 'notes' && rma && (
                <RMANotesTab rma={rma} readOnly={viewingVersion !== null} />
              )}
              {activeTab === 'communication' && rma && <RMACommunicationTab />}
              {activeTab === 'versions' && rma && (
                <RMAVersionHistoryTab
                  versions={rmaVersions}
                  currentVersion={rma.currentVersion ?? rmaVersions[0]?.version ?? 1}
                  // Only before the first shipment (DQ-09). After it the
                  // return is locked and corrections go through its lines.
                  onRevert={
                    rmaCanRevert(rma)
                      ? (version, reason) => {
                          setViewingVersion(null);
                          onRmaRevert?.(version, reason);
                        }
                      : undefined
                  }
                  lockedNote={
                    rmaCanRevert(rma)
                      ? undefined
                      : rma.status === 'Cancelled' || rma.archived
                        ? 'This return is over, so no earlier version can be made current.'
                        : 'Locked since the first shipment. To correct it, remove a line that has not shipped, or use Vendor refused.'
                  }
                  // Every version's PKR figures are at the receiving rate,
                  // locked with the return at the first shipment (2026-11-24).
                  rate={(() => {
                    const fx = returnFxOf(rma);
                    if (!fx) return undefined;
                    return {
                      sentence: rateSentence(returnCurrencyOf(rma), fx.rate),
                      qualifier: fx.provisional ? 'today' : fx.breakdown && fx.breakdown.length > 1 ? 'receiving dates, blended' : 'receiving date',
                      locked: Boolean(rma.shippedDate || rma.shipmentStartedDate),
                    };
                  })()}
                />
              )}
              {activeTab === 'activity' && (
                <ActivityTab
                  invoice={invoice}
                  payments={priorPayments}
                  records={linkedFinancials?.records ?? []}
                  appPayments={payments}
                  rma={rma}
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
              mode={mode}
              rma={rma}
              readOnly={viewingVersion !== null}
              onOpenCurrencyConfig={() => setCurrencyConfigOpen(true)}
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
        vendorName={invoice.vendor}
        outstandingBalance={numbers.outstanding}
        currency={invoice.currency}
        onSubmit={(payload) => {
          setSessionCreditMemos((prev) => [
            ...prev,
            {
              id: `cm-session-${prev.length + 1}`,
              type: 'Credit Memo',
              reference: payload.creditMemoNumber,
              description: payload.description || payload.reason,
              status: 'Applied',
              date: payload.date,
              amount: payload.amount,
              // Whoever is signed in raised it, which is the one place a
              // single name is right.
              createdBy: CURRENT_USER_NAME,
              updatedBy: CURRENT_USER_NAME,
            },
          ]);
          // A credit memo that zeroes the remaining balance settles the
          // invoice (lifecycle specs 7/15/26) — for REAL, in App state,
          // so the listing and status pills agree (feedback 7/21/26).
          const settled = numbers.outstanding - payload.amount <= 0.004;
          if (settled) {
            if (onSettleInvoices) {
              onSettleInvoices([{ invoiceId: invoice.id, applied: invoice.outstandingBalance }], { via: 'credit' });
              setStatusOverride(null);
            } else {
              setStatusOverride(invoice.type === 'Pre-Invoice' ? 'Prepaid' : 'Paid');
            }
            toast.success(`${payload.creditMemoNumber} created, invoice settled`, {
              description: ['The credit memo covered the entire remaining balance.', payload.notify ? notifyLine(payload.notifiedRecipientIds) : undefined].filter(Boolean).join(' '),
            });
          } else {
            toast.success(`${payload.creditMemoNumber} created`, {
              description: [`${payload.reason} · ${moneyIn(payload.amount, invoice.currency)}`, payload.notify ? notifyLine(payload.notifiedRecipientIds) : undefined].filter(Boolean).join(' · '),
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
          // post-reversal numbers (feedback 7/15/26).
          onReversePayment?.(invoice.id, payload.paymentReference, payload.reversalAmount);
          setStatusOverride(null);
          toast.success(`${isPre ? 'Prepayment' : 'Payment'} ${payload.paymentReference} reversed`, {
            description: [`${payload.reason} · ${moneyIn(payload.reversalAmount, invoice.currency)}`, payload.notify ? notifyLine(payload.notifiedRecipientIds) : undefined].filter(Boolean).join(' · '),
          });
        }}
      />

      {/* Reason capture for reject / cancel / payment-hold / flag-as-exception */}
      <InvoiceReasonDialog
        open={reasonOpen}
        onOpenChange={(open) => {
          setReasonOpen(open);
          if (!open) setReasonAction(null);
        }}
        action={reasonAction}
        count={1}
        currentStatus={isRma ? rmaStatus : status}
        onConfirm={handleReasonConfirm}
        // The dialog is shared with the invoice flow, so RMA mode swaps the
        // document noun and the reason list through the same override hook
        // payment runs use.
        {...(isRma && reasonAction === 'cancel'
          ? {
              configOverride: {
                title: 'Cancel this RMA?',
                // "Irreversible" says what cancelling costs you and nothing
                // about what it leaves behind: a vendor left waiting, which
                // is the part somebody needs before they press it. A draft
                // holds no stock (Eli, Nov 3), so there is none to release.
                description:
                  'This cannot be reversed. Nothing ships, and a vendor already expecting the goods will need telling.',
                actionText: 'Cancel RMA',
                notePlaceholder: 'Why is this RMA cancelled?',
                reasons: [
                  'Created in error',
                  'Duplicate RMA',
                  'Vendor rejected the return',
                  'Goods no longer being returned',
                  'Other',
                ],
              },
            }
          : {})}
        // Cancelling a POSTED invoice reverses its GL posting — the modal
        // previews the reversing entry (feedback 7/21/26). The original
        // posting was Dr Inventory (or Expense for standalone) / Cr A/P,
        // so the reversal flips it. Unposted invoices show nothing.
        // RMAs never posted an A/P credit, so there's nothing to reverse.
        glReversal={
          !isRma &&
          reasonAction === 'cancel' &&
          ['Approved', 'Partially Paid', 'Paid in Full', 'Payment Hold'].includes(invoice.status)
            ? [
                { code: '2000', name: 'Accounts Payable', debit: invoice.amount, credit: 0 },
                invoice.type === 'Standalone'
                  ? { code: '6000', name: 'Operating Expenses', debit: 0, credit: invoice.amount }
                  : { code: '1200', name: 'Inventory', debit: 0, credit: invoice.amount },
              ]
            : undefined
        }
      />

      {/* Release hold confirm — optional notify (meeting feedback 7/17/26). */}
      <AlertDialog open={releaseConfirmOpen} onOpenChange={setReleaseConfirmOpen}>
        <AlertDialogContent className="p-0 overflow-hidden gap-0 rounded-2xl border-0 max-w-[calc(100%-2rem)] sm:max-w-[420px]" style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}>
          <div
            className="relative flex flex-col items-center pt-8 pb-5 shrink-0"
            style={{ background: 'linear-gradient(180deg, #ECFDF5 0%, rgba(236,253,245,0.3) 70%, transparent 100%)' }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[90px] rounded-full opacity-25 pointer-events-none" style={{ backgroundColor: '#047857', filter: 'blur(50px)' }} />
            <div className="relative w-[56px] h-[56px] rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#D1FAE5' }}>
              <RotateCcw className="w-7 h-7" style={{ color: '#047857', strokeWidth: 2 }} />
            </div>
            <span className="mt-3 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Release Hold
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-6">
            <AlertDialogTitle className="text-[20px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600, lineHeight: 1.3 }}>
              Release this hold?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] mt-2 mx-auto text-muted-foreground" style={{ lineHeight: 1.7, maxWidth: '340px' }}>
              {status === 'On Hold'
                ? 'The invoice returns to the payment queue and can be paid again.'
                : 'The invoice stays where it was in the approval queue, ready to approve or pay.'}
            </AlertDialogDescription>
          </div>
          <div className="px-6 pt-4 text-left">
            <label className="flex items-start gap-2.5 rounded-lg border border-border bg-slate-50/60 px-3 py-2.5 cursor-pointer">
              <Checkbox checked={releaseNotify} onCheckedChange={(v) => setReleaseNotify(v === true)} className="mt-0.5" />
              <span className="min-w-0">
                <span className="block text-[12px] text-foreground" style={{ fontWeight: 600 }}>Notify the hold recipients</span>
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  {holdNotifiedNames.length > 0
                    ? `${invoice.createdBy}, ${namesSummary(holdNotifiedNames)} will be told it's released. Optional.`
                    : `${invoice.createdBy} and anyone added when the hold was placed will be told it's released. Optional.`}
                </span>
              </span>
            </label>
            {/* Add recipients (reply-all) — anyone who joined the conversation
                mid-hold can be added to the release notification. */}
            {releaseNotify && (
              <div className="pt-3">
                <SearchableUserPicker
                  selectedIds={releaseRecipients}
                  onSelectionChange={setReleaseRecipients}
                  accentColor="#047857"
                  accentBg="#ECFDF5"
                  accentBorder="#A7F3D0"
                  accentText="#047857"
                  label="Notify on release"
                />
              </div>
            )}
          </div>
          <div className="px-6 pt-4 pb-6 flex flex-col gap-2.5">
            <AlertDialogAction
              onClick={() => {
                applyInvoiceAction?.(
                  [invoice.id],
                  'releaseHold',
                  '',
                  releaseNotify ? Array.from(releaseRecipients) : undefined,
                );
                setStatusOverride(null);
                setReleaseConfirmOpen(false);
                toast.success(status === 'On Hold' ? 'Hold released, invoice ready for payment.' : 'Hold released, invoice back in the approval queue.', {
                  description: releaseNotify
                    ? holdNotifiedNames.length > 0
                      ? `Release notification sent to ${invoice.createdBy}, ${namesSummary(holdNotifiedNames)}.`
                      : `Release notification sent to ${invoice.createdBy} and the hold recipients.`
                    : undefined,
                });
              }}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
              style={{ fontWeight: 600, backgroundColor: '#047857', color: '#fff' }}
            >
              Release Hold
            </AlertDialogAction>
            <AlertDialogCancel
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors mt-0"
              style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
            >
              Keep on hold
            </AlertDialogCancel>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resolve exception / resubmit rejection confirm — the Release
          Hold recipe with the same optional notify (feedback 7/22/26):
          every state-resolving prompt offers to tell the people who
          were notified when the state was flagged. Confirm opens the
          edit-and-resubmit flow with the notify choice riding along. */}
      <AlertDialog open={!!resolveConfirm} onOpenChange={(o) => { if (!o) setResolveConfirm(null); }}>
        <AlertDialogContent className="p-0 overflow-hidden gap-0 rounded-2xl border-0 max-w-[calc(100%-2rem)] sm:max-w-[420px]" style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}>
          {(() => {
            if (!resolveConfirm) return null;
            const isResolve = resolveConfirm === 'resolve';
            const HeroIcon = isResolve ? CheckCircle2 : RotateCcw;
            const flagAction = isResolve ? 'flagException' : 'reject';
            const flagNames = isResolve ? exceptionNotifiedNames : rejectNotifiedNames;
            const flagNoun = isResolve ? 'exception' : 'rejection';
            return (
              <>
                <div
                  className="relative flex flex-col items-center pt-8 pb-5 shrink-0"
                  style={{ background: 'linear-gradient(180deg, #ECFDF5 0%, rgba(236,253,245,0.3) 70%, transparent 100%)' }}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[90px] rounded-full opacity-25 pointer-events-none" style={{ backgroundColor: '#047857', filter: 'blur(50px)' }} />
                  <div className="relative w-[56px] h-[56px] rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#D1FAE5' }}>
                    <HeroIcon className="w-7 h-7" style={{ color: '#047857', strokeWidth: 2 }} />
                  </div>
                  <span className="mt-3 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {isResolve ? 'Resolve Exception' : 'Resubmit'}
                  </span>
                </div>
                <div className="flex flex-col items-center text-center px-6">
                  <AlertDialogTitle className="text-[20px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600, lineHeight: 1.3 }}>
                    {isResolve ? 'Resolve this exception?' : 'Fix and resubmit this invoice?'}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-[13px] mt-2 mx-auto text-muted-foreground" style={{ lineHeight: 1.7, maxWidth: '340px' }}>
                    {isResolve
                      ? 'You will review the flagged invoice next and resubmit it back to the approval queue.'
                      : 'You will correct the rejection reasons next and send it back to the approval queue.'}
                  </AlertDialogDescription>
                </div>
                <div className="px-6 pt-4 text-left">
                  <label className="flex items-start gap-2.5 rounded-lg border border-border bg-slate-50/60 px-3 py-2.5 cursor-pointer">
                    <Checkbox checked={resolveNotify} onCheckedChange={(v) => setResolveNotify(v === true)} className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="block text-[12px] text-foreground" style={{ fontWeight: 600 }}>Notify the {flagNoun} recipients</span>
                      <span className="block text-[11px] text-slate-500 mt-0.5">
                        {flagNames.length > 0
                          ? `${invoice.createdBy}, ${namesSummary(flagNames)} will be told it's ${isResolve ? 'resolved' : 'resubmitted'}. Optional.`
                          : `${invoice.createdBy} and anyone added when the ${flagNoun} was recorded will be told it's ${isResolve ? 'resolved' : 'resubmitted'}. Optional.`}
                      </span>
                    </span>
                  </label>
                  {/* Manage recipients (Eli 7/24/26): same reply-all picker the
                      Release Hold confirm uses — seeded with the flag's original
                      recipients, editable so anyone who joined mid-thread can be
                      added to the resolution notice. */}
                  {resolveNotify && (
                    <div className="pt-3">
                      <SearchableUserPicker
                        selectedIds={resolveRecipients}
                        onSelectionChange={setResolveRecipients}
                        accentColor="#047857"
                        accentBg="#ECFDF5"
                        accentBorder="#A7F3D0"
                        accentText="#047857"
                        label={`Notify on ${isResolve ? 'resolution' : 'resubmit'}`}
                      />
                    </div>
                  )}
                </div>
                <div className="px-6 pt-4 pb-6 flex flex-col gap-2.5">
                  <AlertDialogAction
                    onClick={() => {
                      const reasonText = [...(invoice.actionHistory ?? [])].reverse().find((e) => e.action === flagAction)?.reason ?? '';
                      onEditResubmit?.(invoice, reasonText, resolveNotify ? Array.from(resolveRecipients) : undefined);
                      setResolveConfirm(null);
                    }}
                    className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
                    style={{ fontWeight: 600, backgroundColor: '#047857', color: '#fff' }}
                  >
                    {isResolve ? 'Resolve and review' : 'Fix and resubmit'}
                  </AlertDialogAction>
                  <AlertDialogCancel
                    className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors mt-0"
                    style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
                  >
                    {isResolve ? 'Keep the exception' : 'Not now'}
                  </AlertDialogCancel>
                </div>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>

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
          className="max-w-[420px] p-0 overflow-hidden gap-0 rounded-2xl border-0"
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
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
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
                      <>
                        <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>{invoice.invoiceNumber}</span> will post to the
                        general ledger and move to <span className="text-foreground" style={{ fontWeight: 600 }}>Approved</span>.
                      </>
                    ) : statusChangeTarget === 'Pending Approval' && status === 'Rejected' ? (
                      <>
                        <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>{invoice.invoiceNumber}</span> goes back to the approval queue for review.
                      </>
                    ) : statusChangeTarget === 'Approved' && status === 'On Hold' ? (
                      // The action is RELEASE HOLD — the copy explains the
                      // outcome instead of renaming the action (review 7/14/26).
                      <>
                        <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>{invoice.invoiceNumber}</span> moves from{' '}
                        <span className="text-foreground" style={{ fontWeight: 600 }}>On Hold</span> back to{' '}
                        <span className="text-foreground" style={{ fontWeight: 600 }}>{statusDisplayLabel('Approved', invoice.type)}</span>. An activity log entry will be recorded.
                      </>
                    ) : isResolveException ? (
                      <>
                        Invoice <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>{invoice.invoiceNumber}</span> moves from{' '}
                        <span className="text-foreground" style={{ fontWeight: 600 }}>Exception</span> to{' '}
                        <span className="text-foreground" style={{ fontWeight: 600 }}>Pending Approval</span> and enters the approval queue.
                      </>
                    ) : statusChangeTarget === 'Archived' ? (
                      <>
                        Invoice <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>{invoice.invoiceNumber}</span> will move from{' '}
                        <span className="text-foreground" style={{ fontWeight: 600 }}>{statusDisplayLabel(status, invoice.type)}</span> to{' '}
                        <span className="text-foreground" style={{ fontWeight: 600 }}>Archived</span>.
                      </>
                    ) : (
                      <>
                        Invoice <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>{invoice.invoiceNumber}</span> will move from{' '}
                        <span className="text-foreground" style={{ fontWeight: 600 }}>{statusDisplayLabel(status, invoice.type)}</span> to{' '}
                        <span className="text-foreground" style={{ fontWeight: 600 }}>{statusDisplayLabel(statusChangeTarget, invoice.type)}</span>. An activity-log entry will be recorded.
                      </>
                    )}
                  </AlertDialogDescription>

                  {/* Resolving offers to notify the same people who were
                      told about the exception (feedback 7/20/26). */}
                  {isResolveException && (
                    <label className="w-full mt-5 flex items-start gap-2.5 rounded-lg border border-border bg-slate-50/60 px-3 py-2.5 cursor-pointer text-left">
                      <Checkbox checked={resolveNotify} onCheckedChange={(v) => setResolveNotify(v === true)} className="mt-0.5" />
                      <span className="min-w-0">
                        <span className="block text-[12px] text-foreground" style={{ fontWeight: 600 }}>Notify the exception recipients</span>
                        <span className="block text-[11px] text-slate-500 mt-0.5">
                          {exceptionNotifiedNames.length > 0
                            ? `${invoice.createdBy}, ${namesSummary(exceptionNotifiedNames)} will be told it's resolved. Optional.`
                            : `${invoice.createdBy} and anyone notified when the exception was flagged will be told it's resolved. Optional.`}
                        </span>
                      </span>
                    </label>
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
                              : `Resolution notification sent to ${invoice.createdBy} and the exception recipients.`,
                          });
                        }
                        setTransitionOverlay({ visible: true, from: fromStatus, to: statusChangeTarget });
                        setStatusChangeTarget(null);
                      }}
                      className="w-full h-12 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
                      style={{ fontWeight: 600, backgroundColor: solid, color: '#fff' }}
                    >
                      {statusChangeTarget === 'Approved' && status === 'Pending Approval'
                        ? 'Approve invoice'
                        : statusChangeTarget === 'Approved' && status === 'On Hold'
                          ? 'Release hold'
                          : statusChangeTarget === 'Pending Approval' && status === 'Rejected'
                            ? 'Resubmit invoice'
                            : isResolveException
                              ? 'Resolve exception'
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
                          ? 'Keep on hold'
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

      {/* Same animation in the return lifecycle's own vocabulary and tones */}
      {isRma && rmaTransition && (
        <InvoiceTransitionOverlay
          visible={rmaTransition.visible}
          fromStatus={rmaTransition.from}
          toStatus={rmaTransition.to}
          variant="rma"
          duration={1200}
          onDismiss={() => setRmaTransition((s) => (s ? { ...s, visible: false } : null))}
        />
      )}

      {isRma && rma && (
        <>
          {/* What the vendor said about paying, asked on the approval. */}
          <RMAApproveModal
            open={rmaApproveOpen}
            onOpenChange={setRmaApproveOpen}
            vendorName={rma.vendor}
            vendorPrimaryMethod={
              rma.paymentMethodName ??
              mockVendors.find((v) => v.vendorName === rma.vendor)?.primaryPaymentMethod
            }
            vendorRestockingPct={vendorStandardRestockingPct(rma.vendor)}
            currentFeePct={rmaCurrentFeePct}
            returnValue={rmaReturnValue}
            feeBase={rmaFeeBase}
            paidBack={rmaFeeSplit.paid}
            creditBack={rmaFeeSplit.credit}
            notInvoiced={rmaFeeSplit.notInvoiced}
            // The fee being agreed here replaces any on file, so only the
            // other charges ride along.
            otherCharges={(rma.additionalCharges ?? []).filter((c) => c.type !== 'Restocking fee')}
            currency={invoice.currency}
            onConfirm={(answer) => {
              // A fee that is not the one on their profile is a new fact, so
              // the approval pauses on the one question that turns it into a
              // default. A fee that already matches the profile has been
              // agreed before, and asking again every time trains people to
              // dismiss the dialog.
              if (
                answer.feeChanged &&
                answer.restockingPct > 0 &&
                vendorStandardRestockingPct(rma.vendor) !== answer.restockingPct
              ) {
                setPendingApproval(answer);
                setFeeScopeOpen(true);
                return;
              }
              commitApproval(answer);
            }}
          />
          <RMAArchiveModal
            rma={rma}
            open={rmaArchiveOpen}
            onOpenChange={setRmaArchiveOpen}
            onConfirm={() => {
              setRmaArchiveOpen(false);
              onRmaAction?.('archive');
              toast.success(`${rma.rmaNumber} archived`, {
                description: 'Find it with the Archived status filter.',
              });
            }}
          />
          {/* How far a newly learned fee reaches. */}
          <RestockingFeeScopeModal
            open={feeScopeOpen}
            onOpenChange={(next) => {
              setFeeScopeOpen(next);
              if (!next) setPendingApproval(null);
            }}
            vendorName={rma.vendor}
            pct={pendingApproval?.restockingPct ?? 0}
            // What the fee comes to here is taken on the same base the modal
            // above quoted it on: the full return value.
            amount={
              Math.round(rmaFeeBase * ((pendingApproval?.restockingPct ?? 0) / 100) * 100) / 100
            }
            currentPct={vendorStandardRestockingPct(rma.vendor)}
            currency={invoice.currency}
            onChoose={(scope) => {
              if (!pendingApproval) return;
              if (scope === 'vendor') {
                setRestockingStandard(rma.vendor, pendingApproval.restockingPct);
              }
              setFeeScopeOpen(false);
              commitApproval(pendingApproval);
              setPendingApproval(null);
            }}
          />
          <SendToVendorModal
            open={rmaSendOpen}
            onOpenChange={setRmaSendOpen}
            rma={rma}
            currency={invoice.currency}
            isResend={rmaStatus !== 'Draft'}
            onSend={() => {
              onRmaAction?.('submit');
              setRmaSendOpen(false);
              toast.success('RMA sent to vendor', {
                description: `${rma.rmaNumber} is with ${rma.vendor} for authorization.`,
              });
            }}
          />
          {/* Printing is reading, never sending, so it reuses the vendor
              document with the send removed and stays available in every
              state, including cancelled. */}
          <SendToVendorModal
            open={rmaPrintOpen}
            onOpenChange={(v) => {
              setRmaPrintOpen(v);
              if (!v) setRmaAutoPrint(false);
            }}
            rma={rma}
            currency={invoice.currency}
            mode="print"
            autoPrint={rmaAutoPrint}
            onSend={() => {}}
          />
          {revertTarget !== null && (
            <RMAVersionRevertModal
              version={revertTarget}
              onClose={() => setRevertTarget(null)}
              onConfirm={(reason) => {
                onRmaRevert?.(revertTarget, reason);
                setRevertTarget(null);
                setViewingVersion(null);
                toast.success(`Reverted to Version ${revertTarget}`, {
                  description: 'The return now reads as that version recorded it.',
                  position: 'top-right',
                });
              }}
            />
          )}
          <LogSettlementModal
            open={rmaSettleOpen}
            onOpenChange={setRmaSettleOpen}
            rmaNumber={rma.rmaNumber}
            vendorName={rma.vendor}
            // What they agreed to send back, not the gross return value: what
            // was paid and credited, less every agreed vendor charge, the same
            // figure the authorization they were sent asks for.
            expected={rmaSettlementRemaining}
            receivedSoFar={rmaReceivedSoFar}
            currency={invoice.currency}
            // The currency configuration's deposit account and rate type: the
            // settlement is recorded at that type's rate on the day the money
            // landed (2026-11-24).
            payToAccountId={returnSettlementFx(rma).account?.id ?? rma.payToAccountId}
            rateType={returnSettlementFx(rma).chosenType}
            existingCharges={rma.additionalCharges ?? []}
            fx={returnFxOf(rma)}
            onSubmit={(payload) => {
              onRmaAction?.('log-settlement', {
                settlement: {
                  kind: payload.kind,
                  amount: payload.amount,
                  date: payload.date,
                  reference: payload.reference,
                  ...(payload.method ? { method: payload.method } : {}),
                  ...(payload.depositedToAccountId
                    ? { depositedToAccountId: payload.depositedToAccountId }
                    : {}),
                  ...(payload.bankReceived ? { bankReceived: payload.bankReceived } : {}),
                  ...(payload.rate ? { rate: payload.rate } : {}),
                  ...(payload.rateType ? { rateType: payload.rateType } : {}),
                  ...(payload.description ? { description: payload.description } : {}),
                  ...(payload.fileName ? { fileName: payload.fileName } : {}),
                  ...(payload.lossAcknowledged ? { lossAcknowledged: true } : {}),
                },
                ...(payload.settlementLoss ? { settlementLoss: payload.settlementLoss } : {}),
                ...(payload.keepOpen ? { keepOpen: true } : {}),
                ...(payload.addedCharges?.length ? { addedCharges: payload.addedCharges } : {}),
              });
              setRmaSettleOpen(false);
              const added = (payload.addedCharges ?? []).reduce((n, c) => n + c.amount, 0);
              const short = Math.round((rmaSettlementRemaining - added - payload.amount) * 100) / 100;
              const money = (n: number) => moneyIn(n, invoice.currency);
              toast.success(
                payload.amount <= 0
                  ? 'Loss recorded'
                  : 'Payment recorded',
                {
                  description: [
                    payload.keepOpen
                      ? `${money(short)} still to come. The return stays open.`
                      : short > 0.004 && payload.lossAcknowledged
                        ? `The return is Closed with loss. ${money(short)} posted to RMA Settlement Loss.`
                        : 'The return is closed.',
                    payload.notify ? notifyLine(payload.notifiedRecipientIds) : undefined,
                  ]
                    .filter(Boolean)
                    .join(' '),
                },
              );
            }}
          />
          <RmaRefusalModal
            open={rmaRefuseOpen}
            onOpenChange={setRmaRefuseOpen}
            rma={rma}
            value={numbers.total}
            currency={invoice.currency}
            onConfirm={(reason) => {
              onRmaAction?.('record-refusal', { reason });
              setRmaRefuseOpen(false);
              toast.success('Refusal recorded', {
                description: 'The return is closed and its value is written off.',
              });
            }}
          />
        </>
      )}
    </div>
    {isRma && rma && (
      <RMAVersionSaveModal
        open={rmaSaveVersionOpen}
        onOpenChange={setRmaSaveVersionOpen}
        rmaNumber={rma.rmaNumber}
        nextVersion={rmaNextVersion}
        status={rma.status}
        changes={rmaSessionChanges.map((c) => ({
          tag: changeTypeConfig[c.type]?.label ?? 'Details',
          type: c.type,
          action: c.action,
          subject: c.subject,
          ...(c.subjectDetail ? { detail: c.subjectDetail } : {}),
        }))}
        onConfirm={() => {
          const n = rmaSessionChanges.length;
          commitEditSession(rma.id, n === 1 ? rmaSessionChanges[0]?.subject : `${n} changes`);
          toast.success(`Version ${rmaNextVersion} created. ${rma.rmaNumber} stays ${rma.status}`);
        }}
      />
    )}
    {isRma && rma && (
      <ReturnCurrencyConfigHost
        rma={rma}
        open={currencyConfigOpen}
        onOpenChange={setCurrencyConfigOpen}
        readOnly={viewingVersion !== null}
      />
    )}
    </ReturnViewProvider>
    </RMAEditGateProvider>
  );
}

/** The return's currency configuration, inside the page's edit gate.
 *
 *  Its two choices, the deposit account and the rate type, stay open until
 *  the vendor settles (Currency Touchpoints Map, 2026-11-24), which is later
 *  than the return's lines lock (the first shipment, DQ-09). Before the
 *  shipment a change goes through the usual version prompt; after it, while
 *  the return waits on the vendor, it is saved on the current version, as a
 *  minor edit is. A closed, cancelled or archived return reads only. */
function ReturnCurrencyConfigHost({
  rma,
  open,
  onOpenChange,
  readOnly,
}: {
  rma: RMA;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly: boolean;
}) {
  const guardEdit = useRMAEditGate();
  const { updateRMA } = useRMAContext();
  const settlement = returnSettlementFx(rma);
  const canEdit =
    !readOnly &&
    !settlement.locked &&
    !rma.archived &&
    ['Draft', 'Sent', 'Approved', 'Shipped to Vendor'].includes(rma.status);
  return (
    <ReturnCurrencyConfigDialog
      rma={rma}
      open={open}
      onOpenChange={onOpenChange}
      canEdit={canEdit}
      onApply={(change) => {
        guardEdit(
          () => {
            updateRMA(rma.id, { payToAccountId: change.payToAccountId, settlementRateType: change.settlementRateType });
            toast.success('Currency configuration applied', {
              description: `${rma.rmaNumber} settles at today's ${change.settlementRateType === 'corporate' ? 'corporate' : 'mid-market'} rate until the vendor settles.`,
            });
          },
          rmaMaterialEditable(rma) ? 'material' : 'minor',
        );
      }}
    />
  );
}

/** The vendor would not take the goods back.
 *
 *  The end of the road for a return that has already shipped: the stock is
 *  gone, no credit is coming, and the value has to leave the books. Put
 *  behind a reason because it is the one RMA outcome nobody can undo, and
 *  because the write-off is the first thing finance will ask about. */
function RmaRefusalModal({
  open,
  onOpenChange,
  rma,
  value,
  currency,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rma: RMA;
  value: number;
  currency: string;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const money = (n: number) => moneyIn(n, currency);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[210] flex flex-col gap-0 overflow-hidden border-0 p-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.18)] sm:max-w-none"
        style={{ maxWidth: 520, width: 'calc(100% - 2rem)', borderRadius: 16 }}
        showCloseButton={false}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#EEF2F6] bg-card px-5 py-3.5 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
              style={{ backgroundColor: '#FFF1F2', color: '#BE123C', borderColor: '#FECDD3' }}
            >
              <AlertTriangle className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                Record that {rma.vendor} refused the return
              </DialogTitle>
              <DialogDescription className="text-[11px] text-muted-foreground">
                The goods are with them and nothing is coming back.
              </DialogDescription>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-foreground hover:bg-muted transition-all shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4 bg-white">
          <div
            className="rounded-lg border px-3 py-2.5 flex items-center justify-between gap-3"
            style={{ borderColor: '#FECDD3', backgroundColor: '#FFF7F7' }}
          >
            <span className="text-[11px]" style={{ color: '#9F1239', fontWeight: 500 }}>
              Written off to RMA Write-Off Loss
            </span>
            <span className="text-[13px] tabular-nums" style={{ color: '#9F1239', fontWeight: 700 }}>
              {money(value)}
            </span>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rma-refusal-reason" className="text-[11px] text-slate-500">
              What did they say?
            </Label>
            <Textarea
              id="rma-refusal-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Outside the return window, goods not in resalable condition, no RMA number on the carton"
              className="min-h-[76px] text-[12px]"
            />
            <p className="text-[10px] text-slate-400">
              Kept on the return and on the write-off, so the loss can be explained later.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#EEF2F6] bg-card px-5 py-3 shrink-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 px-4 text-[12px] rounded-lg bg-white">
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={reason.trim().length === 0}
            className="h-8 px-4 text-[12px] rounded-lg bg-rose-600 text-white hover:bg-rose-700"
            onClick={() => onConfirm(reason.trim())}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Write the return off
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
  // Exceptions, holds and their releases are TRANSIENT (feedback
  // 7/16/26): they only render while unresolved — the moment they're
  // resolved their nodes leave the timeline (Recent Activity keeps the
  // full record). Reject/resubmit cycles stay: they're the invoice's
  // real approval story.
  const approvalNodes: Array<{ time: number; node: JourneyNode }> = [];
  history.forEach((e, i) => {
    const t = timeOf(e.at) + i; // +i keeps same-timestamp entries in insertion order
    if (e.action === 'reject') {
      approvalNodes.push({ time: t, node: { key: `reject-${i}`, label: 'Rejected', icon: Ban, colors: STEP_COLORS.Rejected, detail: e.reason || undefined } });
    } else if (e.action === 'submit') {
      approvalNodes.push({ time: t, node: { key: `resubmit-${i}`, label: 'Resubmitted', icon: RotateCcw, colors: STEP_COLORS['Pending Approval'], detail: 'Back in the approval queue' } });
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
  let paidCount = 0;
  let scheduledTotal = 0;
  for (const ev of moneyEvents) {
    if (ev.state === 'paid') {
      coverage += ev.amount;
      if (ev.kind !== 'credit') paidCount += 1;
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
    approvalHappened.push({ key: 'pending', label: 'Pending approval', icon: FileText, colors: STEP_COLORS['Pending Approval'] });
    approvalNodes.sort((a, b) => a.time - b.time).forEach((e) => approvalHappened.push(e.node));
    // Seeded invoices carry a status but no action history — synthesize
    // the node their status implies.
    const last = approvalHappened[approvalHappened.length - 1]?.label;
    if (status === 'Rejected' && last !== 'Rejected') {
      approvalHappened.push({ key: 'rejected-now', label: 'Rejected', icon: Ban, colors: STEP_COLORS.Rejected });
    }
    if (status === 'Exception' && last !== 'Exception flagged') {
      approvalHappened.push({
        key: 'exception-now',
        label: 'Exception flagged',
        icon: AlertTriangle,
        colors: STEP_COLORS.Exception,
        detail: [...history].reverse().find((e) => e.action === 'flagException')?.reason || undefined,
      });
    }
  }

  // "Approved" closes the approval track (copy feedback 7/16/26); the
  // payments track then opens with "Unpaid", the state the record enters
  // at approval, and closes with "Paid in full".
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
    label: 'Payment hold',
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
    payHappened.push({ key: 'unpaid', label: 'Unpaid', icon: Wallet, colors: UNPAID_COLORS, detail: coverage <= 0.005 ? 'No payments recorded yet' : undefined });
    // Partial coverage is a single state node — its detail aggregates the
    // net settled amount, however many payments (or reversals) produced it.
    const partial = !settled && (coverage > 0.005 && coverage < total - 0.005 || status === 'Partially Paid' || status === 'Partially Prepaid');
    if (partial) {
      const prepaid = status === 'Partially Prepaid';
      payHappened.push({
        key: 'partial',
        label: prepaid ? 'Partially prepaid' : 'Partially paid',
        icon: prepaid ? Wallet : Banknote,
        colors: STEP_COLORS[prepaid ? 'Partially Prepaid' : 'Partially Paid'],
        detail: `${paidCount} payment${paidCount === 1 ? '' : 's'} · ${journeyMoney(coverage)} of ${journeyMoney(total)} settled`,
      });
    }
    // Live pending states render while they exist and disappear once
    // resolved: a scheduled payment (until it posts) and a payment hold
    // (until released).
    if (!settled && scheduledTotal > 0.005) {
      const coversRest = scheduledTotal >= total - coverage - 0.005;
      payHappened.push({
        key: 'scheduled',
        label: coversRest ? 'Full payment scheduled' : 'Partial payment scheduled',
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
  // closes on "Settled", never "Paid in full" (feedback 7/21/26). The
  // raw status carries the distinction; the display status maps both
  // to Paid for everything else on the page.
  const settledNoCash = invoice.status === 'Settled';
  const terminalLabel = settledNoCash ? 'Settled' : isPre ? 'Prepaid' : 'Paid in full';
  if (cancelled) {
    // Terminal: the user can do nothing after a cancel, so no future
    // nodes. A pre-approval cancel belongs on the approval track.
    const cancelNode: JourneyNode = { key: 'cancelled', label: 'Cancelled', icon: X, colors: STEP_COLORS.Cancelled, detail: [...history].reverse().find((e) => e.action === 'cancel')?.reason || undefined };
    (inMoneyPhase ? payHappened : approvalHappened).push(cancelNode);
  } else if (archived) {
    (inMoneyPhase ? payHappened : approvalHappened).push({ key: 'archived', label: 'Archived', icon: Archive, colors: STEP_COLORS.Archived });
  } else if (inMoneyPhase) {
    if (settled) {
      payHappened.push({
        key: 'settled',
        label: terminalLabel,
        icon: Check,
        colors: isPre && !settledNoCash ? STEP_COLORS.Prepaid : STEP_COLORS.Paid,
        detail: settledNoCash ? 'A credit memo covered the remaining balance, no cash moved' : undefined,
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

// ── RMA workflow bar ──────────────────────────────────────────────
// Single-track lifecycle: Draft → Sent → Approved → Shipped to Vendor →
// Closed. Cancelled short-circuits the track.
// Same visual recipe as `StatusWorkflowBar` — reuses `JourneyTrack`.
// Step colors mirror the list-view RMA_STATUS_STYLES palette so the
// detail stepper reads consistently with the row pills:
// Draft = slate-600, Sent = blue-700, Approved = indigo-700,
// Shipped = amber-700, Closed = emerald-700. The JourneyTrack connectors
// interpolate between adjacent solids, so the gradient naturally flows
// slate → blue → indigo → amber → emerald.
const RMA_STEP_COLORS: Record<string, { solid: string; glow: string }> = {
  Draft: { solid: '#475569', glow: 'color-mix(in srgb, #475569 18%, transparent)' },
  Sent: { solid: '#0654BC', glow: 'color-mix(in srgb, #0654BC 18%, transparent)' },
  Approved: { solid: '#4338CA', glow: 'color-mix(in srgb, #4338CA 18%, transparent)' },
  Shipped: { solid: '#B45309', glow: 'color-mix(in srgb, #B45309 18%, transparent)' },
  Closed: { solid: '#047857', glow: 'color-mix(in srgb, #047857 18%, transparent)' },
  Cancelled: { solid: '#B91C1C', glow: 'color-mix(in srgb, #B91C1C 18%, transparent)' },
};

const RMA_STEP_ORDER = [
  'Draft',
  'Sent',
  'Approved',
  'Shipped to Vendor',
  'Closed',
] as const;

function RmaWorkflowBar({
  rmaStatus,
  closedWithLoss = false,
  steps,
}: {
  rmaStatus: string;
  closedWithLoss?: boolean;
  /** The company's lifecycle for this return. Without Sent and Approved it
   *  is three steps, Draft, Shipped to vendor, Closed (DQ-03). */
  steps?: readonly string[] | undefined;
}) {
  const order = (steps ?? RMA_STEP_ORDER) as readonly (typeof RMA_STEP_ORDER)[number][];
  const cancelled = rmaStatus === 'Cancelled';
  const currentIdx = order.indexOf(rmaStatus as typeof RMA_STEP_ORDER[number]);

  const nodeFor = (label: (typeof RMA_STEP_ORDER)[number]): JourneyNode => {
    switch (label) {
      case 'Draft':
        return { key: 'draft', label: 'Draft', icon: FileText, colors: RMA_STEP_COLORS.Draft };
      case 'Sent':
        return { key: 'sent', label: 'Sent', icon: Send, colors: RMA_STEP_COLORS.Sent };
      case 'Approved':
        return { key: 'approved', label: 'Approved', icon: CheckCircle2, colors: RMA_STEP_COLORS.Approved };
      case 'Shipped to Vendor':
        return { key: 'shipped', label: 'Shipped to vendor', icon: Truck, colors: RMA_STEP_COLORS.Shipped };
      case 'Closed':
        return {
          key: 'closed',
          label: closedWithLoss && rmaStatus === 'Closed' ? 'Closed with loss' : 'Closed',
          icon: CheckCheck,
          colors: RMA_STEP_COLORS['Closed'],
        };
    }
  };

  const nodes: JourneyNode[] = [];
  let currentIndex = -1;
  let allCompleted = false;

  if (cancelled) {
    nodes.push({ key: 'draft', label: 'Draft', icon: FileText, colors: RMA_STEP_COLORS.Draft });
    nodes.push({ key: 'cancelled', label: 'Cancelled', icon: X, colors: RMA_STEP_COLORS.Cancelled });
    currentIndex = 1;
    allCompleted = true;
  } else {
    order.forEach((label) => nodes.push(nodeFor(label)));
    currentIndex = currentIdx >= 0 ? currentIdx : 0;
    allCompleted = currentIdx === order.length - 1;
  }

  return (
    <div className="px-4 lg:px-5 py-2.5 overflow-x-auto">
      <div className="relative flex items-center w-full gap-3 py-1" style={{ minHeight: 32 }}>
        <JourneyTrack track={{ nodes, currentIndex, allCompleted }} grow />
      </div>
    </div>
  );
}

