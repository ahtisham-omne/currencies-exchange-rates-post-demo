import React, { useState } from 'react';
import {
  Banknote,
  Building2,
  Calendar,
  ChevronDown,
  Clock,
  Flag,
  Info,
  Lock,
  Receipt,
  Truck,
  Wallet,
} from 'lucide-react';
import { SubmittedFlagCard, exceptionTypeLabelsFromReason } from '@/app/components/SubmittedFlagCard';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { Invoice } from '@/app/data/mockInvoices';
import { ADVANCES_ACCOUNT } from '@/app/data/glAccounts';
import { CollapseReveal } from '@/app/components/ui/collapse-reveal';
import { presetForVendor } from '@/app/data/paymentTermPresets';
import { PaymentTermDetailsModal } from '@/app/components/PaymentTermDetailsModal';
import { mockVendors, partnerVendorUrl } from '@/app/data/mockVendors';
import { CarrierCard } from '@/app/components/CarrierCard';
import { getCarriersForVendor } from '@/app/data/vendorCarriers';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { VendorQuickCard, statusDisplayLabel } from '@/app/components/InvoiceDataTable';
import { VendorAvatar } from '@/app/components/VendorAvatar';
import { PhotoPersonAvatar } from '@/app/components/data-table';
import { LinkedFinancialRecord, countsTowardBalance } from '@/app/data/invoiceLinkedRecords';
import { overdueDaysOf, overdueLabel, parseDateOnly, todayAtMidnight, formatUsDateTime } from '@/app/lib/dueBucket';

// Partner-management module (separate app) — the vendor links open the
// vendor's OWN detail page there (9/22/26, GPT LINK-01).

/* ════════════════════════════════════════════════════════════════
   Right sidebar — sticky across all detail tabs. Ports the partner /
   PO detail-page sidebar recipe:
   - Each section is a stand-alone card with icon + title + chevron
   - Click the header to collapse/expand
   - Sections sized for invoice context: Summary, Vendor, Payment,
     Linked Records, Timeline
   ════════════════════════════════════════════════════════════════ */

type SectionKey =
  | 'general'
  | 'summary'
  | 'vendor'
  | 'payment'
  | 'matching'
  | 'charges'
  | 'freight'
  | 'flags'
  | 'linked'
  | 'timeline';

function formatMoney(amount: number, currency: string) {
  const symbol = currency === 'USD' ? '$' : `${currency} `;
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// MMM D, YYYY (date format standard 9/3/26) — the card previously showed
// raw ISO dates; the partner-grid rebuild (user 9/25) formats them, now
// with a timestamp next to the date (user 10/7).
function fmtSidebarDate(iso?: string) {
  if (!iso) return '·';
  return formatUsDateTime(iso) || '·';
}

// One type name across the page (VI-29): the General Information row shows
// the same friendly label as the header pill — the internal 'PO-based' /
// 'Receiving-based' / 'GRN-based' variants all read "Inventory Invoice".
function sidebarTypeLabel(type: string): string {
  if (type === 'Standalone') return 'Standalone Invoice';
  if (type === 'Pre-Invoice') return 'Pre-Invoice';
  return 'Inventory Invoice';
}

function daysBetween(later: Date, earlier: Date) {
  const ms = later.getTime() - earlier.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

interface SidebarSectionProps {
  icon: React.ElementType;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  /** Compact one-line value shown collapsed (e.g. "$2,580.80"). */
  collapsedSummary?: React.ReactNode;
}

function SidebarSection({ icon: Icon, title, open, onToggle, children, collapsedSummary }: SidebarSectionProps) {
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
      {/* Waterfall expand/collapse (user 10/8) — the shared recipe. */}
      <CollapseReveal open={open}>
        <div className="px-4 pb-4">{children}</div>
      </CollapseReveal>
    </div>
  );
}

interface InvoiceDetailSidebarProps {
  invoice: Invoice;
  numbers: {
    total: number;
    subtotal: number;
    tax: number;
    freight: number;
    /** Additional charges slice of the total (handling etc.). */
    additional: number;
    outstanding: number;
    paid: number;
    /** Credit memos applied against the invoice — shown as a reduction
     *  line under the invoice total. */
    credits?: number;
    daysOverdue: number;
  };
  status: string;
  statusPalette: { bg: string; color: string; border: string };
  /** Linked financial records — feeds the Timeline (credit memo /
   *  payment / prepayment events with real dates). */
  records?: LinkedFinancialRecord[];
  /** Flags accordion actions (Eli 9/8): the submitted flag card carries
   *  its own Resolve / Release button, so the fix starts right where the
   *  flag is read. Undefined hides the button. */
  onResolveException?: () => void;
  onReleaseHold?: () => void;
}

export function InvoiceDetailSidebar({ invoice, numbers, status, statusPalette, records = [], onResolveException, onReleaseHold }: InvoiceDetailSidebarProps) {
  // Payment term details modal (8/31/26).
  const [termDetailOpen, setTermDetailOpen] = useState(false);
  // Subtotal/Tax/Freight/Charges live in the creation form's breakdown
  // accordion — OPEN by default (user 10/1 evening, flipping the earlier
  // collapsed call): the figures show, Hide breakdown folds them away.
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    general: true,
    summary: true,
    vendor: true,
    payment: true,
    matching: true,
    charges: false,
    freight: false,
    flags: false,
    linked: true,
    timeline: false,
  });
  const toggle = (k: SectionKey) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  // Resolve the full vendor record so the vendor card can surface partner-
  // level facts (code, terms, currency) — mirrors InvoiceDetailScreen.
  const vendorData = mockVendors.find((v) => v.vendorName === invoice.vendor) || null;

  // 3-Way Matching panel removed per BA feedback — match status
  // lives elsewhere (header / linked-records tab). Sidebar focuses
  // on identifying info + summary.

  // Additional charges + freight. User-created records render EXACTLY
  // the charges the form held (9/22/26 review response) — persisted on
  // invoice.charges, never synthesized. Seeds keep the deterministic
  // demo split (seeded off the invoice number so the same invoice
  // renders the same charges across reloads); either way the rows split
  // numbers.additional exactly, so the card's subtotal equals the
  // Additional charges line in the Invoice Summary and everything
  // reconciles to the invoice total.
  const chargeSeed = invoice.invoiceNumber.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const additionalCharges = invoice.charges
    ? invoice.charges.additional.map((c) => ({ label: c.label, amount: c.amount, gl: c.glAccount }))
    : (chargeSeed % 3 === 0)
      ? (() => {
          const doc = Math.round(numbers.additional * 0.35 * 100) / 100;
          return [
            { label: 'Handling fee', amount: Math.round((numbers.additional - doc) * 100) / 100, gl: '6100 Office Supplies' },
            { label: 'Documentation', amount: doc, gl: '6700 Professional Fees' },
          ];
        })()
      : [{ label: 'Handling fee', amount: numbers.additional, gl: '6100 Office Supplies' }];
  // Carrier inherited from the vendor's partner config — the same
  // deterministic slice the create-invoice freight picker uses, so the
  // detail page renders the identical partner-style CarrierCard. The
  // first carrier in the slice is the vendor's primary / default.
  const vendorCarrier = getCarriersForVendor(invoice.vendor)[0];
  const freightDetails = {
    amount: numbers.freight,
    carrier: vendorCarrier,
    glAccount: invoice.charges?.freightGlAccount ?? '5020 Freight Inbound',
  };

  // Timeline events derived from invoice status + dates. One phrasing
  // family everywhere (9/22/26 review response): the shared overdueLabel,
  // never per-screen variants like "Overdue 1d" or "6 days left". A
  // record that owes nothing shows no aging (numbers.daysOverdue is
  // already status-gated upstream).
  const today = todayAtMidnight();
  const dueDate = parseDateOnly(invoice.dueDate);
  // A cancelled / rejected / archived invoice owes nothing, but it was never
  // "Settled" (copy audit): the due badge reads its own terminal state,
  // matching the header pill, instead of claiming payment.
  const voidedView = invoice.status === 'Cancelled' || invoice.status === 'Rejected' || !!invoice.isArchived;
  const voidedLabel = invoice.isArchived ? 'Archived' : invoice.status;
  const settledView = !voidedView && numbers.outstanding <= 0.004;
  const dueColor = voidedView ? '#475569' : !settledView && numbers.daysOverdue > 0 ? '#DC2626' : !settledView && overdueDaysOf(invoice.dueDate) >= -7 ? '#B45309' : '#475569';
  const dueLabel = voidedView ? voidedLabel : settledView ? 'Settled' : overdueLabel(overdueDaysOf(invoice.dueDate));
  const isApprovedOrBeyond = status === 'Approved' || status === 'Partially Paid' || status === 'Paid' || status === 'On Hold';
  const isPaid = status === 'Paid';
  const isPartial = status === 'Partially Paid';

  // Reconciliation math (9/2/26): applied prepayments reduce the amount
  // owed exactly like credit memos, so the summary reads them as
  // explicit reduction rows and the hero nets them out. Capped at the
  // invoice total (mirrors the create screen).
  const prepayTotal = Math.min(
    Math.round((invoice.appliedPrepayments ?? []).reduce((s, p) => s + p.amount, 0) * 100) / 100,
    Math.round(numbers.total * 100) / 100,
  );
  const amountAfterReductions = Math.max(0, Math.round((numbers.total - (numbers.credits ?? 0) - prepayTotal) * 100) / 100);
  // The pre-invoice side: settled and reconciled into a receiving
  // invoice (field stamped at settlement; reason text as fallback).
  const reconciledInto =
    invoice.reconciledIntoInvoiceNumber ??
    (invoice.type === 'Pre-Invoice'
      ? invoice.actionHistory?.filter((e) => e.action === 'reconciled').slice(-1)[0]?.reason?.match(/Reconciled into (\S+);/)?.[1] ?? null
      : null);
  const reconciledEntry = invoice.actionHistory?.filter((e) => e.action === 'reconciled').slice(-1)[0];

  return (
    <aside className="w-[320px] shrink-0 space-y-3 self-start sticky top-[170px]">
      {/* Vendor now lives inside General Information (3rd row) as a clickable
          link — the standalone vendor card was removed per design. */}

      {/* ── General Information ─────────────────────────────── */}
      <SidebarSection
        icon={Info}
        title="General Information"
        open={open.general}
        onToggle={() => toggle('general')}
        collapsedSummary={invoice.invoiceNumber}
      >
        <div>
          {/* Partner-card anatomy (user 9/25): the VENDOR leads as an
              avatar + name hero (never buried under dates), the fields sit
              in the partner two-column grid, and the created-by/created-on
              footer mirrors the Partner Information card. */}
          <HoverCard openDelay={300} closeDelay={120}>
            <HoverCardTrigger asChild>
              <a
                href={partnerVendorUrl(invoice.vendor)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 min-w-0 group/vh"
                title={`Open ${invoice.vendor} in Partners`}
              >
                <VendorAvatar name={invoice.vendor} logoUrl={vendorData?.imageUrl} size="lg" />
                <span className="min-w-0">
                  <span className="block text-[14px] text-foreground truncate transition-colors group-hover/vh:text-primary group-hover/vh:underline" style={{ fontWeight: 600 }}>
                    {invoice.vendor}
                  </span>
                  {/* Subline = the invoice's own description (user 9/25):
                      vendor facts live in the hover card, so the line under
                      the name carries what THIS record is about. */}
                  <span className="block text-[11px] text-slate-400 truncate mt-0.5">
                    {invoice.description || vendorData?.category || 'Vendor'}
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
              <VendorQuickCard vendor={invoice.vendor} description={invoice.description} />
            </HoverCardContent>
          </HoverCard>

          {/* Field grid — partner Partner Information recipe: label over
              value, two columns. */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-3 mt-3.5 pt-3.5 border-t border-slate-100">
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Invoice ID</p>
              <p className="text-[12px] text-foreground truncate mt-0.5" style={{ fontWeight: 600 }}>{invoice.invoiceNumber}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Vendor Invoice No.</p>
              <p className="text-[12px] text-foreground truncate mt-0.5" style={{ fontWeight: 600 }}>{invoice.vendorInvoiceNumber || '·'}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Vendor Invoice Date</p>
              <p className="text-[12px] text-foreground truncate mt-0.5" style={{ fontWeight: 600 }}>{fmtSidebarDate(invoice.invoiceDate)}</p>
            </div>
            <div className="min-w-0">
              {/* Ledger entry date (8/25/26). A pre-invoice posts when its
                  prepayment is paid, so the saved record reads the SAME rule
                  the create screen shows — "Set when paid", not "Set on
                  receiving" (VI-20). */}
              <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Posting Date</p>
              {invoice.postingDate || invoice.type !== 'Pre-Invoice' ? (
                <p className="text-[12px] text-foreground truncate mt-0.5" style={{ fontWeight: 600 }}>{fmtSidebarDate(invoice.postingDate || invoice.invoiceDate)}</p>
              ) : (
                <p className="text-[12px] text-slate-400 truncate mt-0.5" style={{ fontWeight: 500 }}>Set when paid</p>
              )}
            </div>
            <div className="min-w-0">
              {/* Trigger date — the payment clock start; due date =
                  trigger date + term days (8/25/26). */}
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <p className="text-[11px] text-slate-400 cursor-help inline-flex" style={{ fontWeight: 500 }}>Trigger Date</p>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[240px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                  <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>Starts the payment clock</p>
                  <p className="text-[11px] text-slate-500 leading-snug mt-0.5">The due date is this date plus the term days from the vendor's payment terms. The trigger event comes from the term, receiving, invoice date, or another agreed milestone.</p>
                </TooltipContent>
              </Tooltip>
              {invoice.triggerDate || invoice.type !== 'Pre-Invoice' ? (
                // The chosen event rides along ("Sep 28, 2026 (order
                // confirmation)", BA 9/28) — receiving is the default
                // story, so it never repeats itself in parens.
                <p className="text-[12px] text-foreground truncate mt-0.5" style={{ fontWeight: 600 }}>
                  {fmtSidebarDate(invoice.triggerDate || invoice.invoiceDate)}
                  {invoice.triggerEvent && invoice.triggerEvent !== 'Receiving' ? ` (${invoice.triggerEvent})` : ''}
                </p>
              ) : (
                <p className="text-[12px] text-slate-400 truncate mt-0.5" style={{ fontWeight: 500 }}>Set on receiving</p>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Due Date</p>
              <p className="text-[12px] text-foreground mt-0.5 flex items-center gap-1.5 flex-wrap" style={{ fontWeight: 600 }}>
                <span>{fmtSidebarDate(invoice.dueDate)}</span>
                <span
                  className="text-[10px] px-1.5 py-px rounded"
                  style={{
                    fontWeight: 600,
                    color: dueColor,
                    backgroundColor: numbers.daysOverdue > 0 ? '#FEF2F2' : numbers.daysOverdue >= -7 ? '#FFFBEB' : '#F1F5F9',
                  }}
                >
                  {dueLabel}
                </span>
              </p>
            </div>
            <div className="min-w-0">
              {/* Payment terms (8/31/26): the record's OWN chosen term wins
                  (9/22/26); the name opens the details modal. */}
              <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Payment Terms</p>
              <button
                type="button"
                onClick={() => setTermDetailOpen(true)}
                // Full term name, wrapped (user 10/1) — the truncated
                // "30% Prepayment: Pro…" hid the half that mattered.
                className="block max-w-full text-[12px] text-foreground text-left break-words leading-snug mt-0.5 hover:text-primary hover:underline transition-colors cursor-pointer bg-transparent border-0 p-0"
                style={{ fontWeight: 600 }}
              >
                {invoice.paymentTerms || presetForVendor(invoice.vendor).name}
              </button>
            </div>
            <div className="min-w-0">
              {/* One type name across the page (VI-29): the General
                  Information row reads the same label the header pill shows —
                  "Inventory Invoice", not the internal "PO-based". */}
              <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Type</p>
              <p className="text-[12px] text-foreground truncate mt-0.5" style={{ fontWeight: 600 }}>{sidebarTypeLabel(invoice.type)}</p>
            </div>
            <div className="min-w-0">
              {/* A pre-invoice's payment posts to the vendor advances account
                  (1205), matching the create screen's "Advances Account"
                  (VI-20); posted invoices show the vendor A/P account. */}
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <p className="inline-flex items-center gap-1 text-[11px] text-slate-400 cursor-help" style={{ fontWeight: 500 }}>
                    {invoice.type === 'Pre-Invoice' ? 'Advances Account' : 'AP Account'}
                    <Lock className="w-2.5 h-2.5 text-slate-300" />
                  </p>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[240px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                  {invoice.type === 'Pre-Invoice' ? (
                    <>
                      <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>Vendor advances</p>
                      <p className="text-[11px] text-slate-500 leading-snug mt-0.5">A pre-invoice payment posts as a vendor advance to this asset account. It transfers to inventory and A/P when the invoice posts at receiving.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>Set by the vendor profile</p>
                      <p className="text-[11px] text-slate-500 leading-snug mt-0.5">The payable account flows from the vendor's configuration and can't be changed per invoice. Manage it from the vendor record.</p>
                    </>
                  )}
                </TooltipContent>
              </Tooltip>
              <p className="text-[12px] text-foreground truncate mt-0.5" style={{ fontWeight: 600 }}>{invoice.type === 'Pre-Invoice' ? ADVANCES_ACCOUNT : (invoice.apAccount || '·')}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Currency</p>
              <p className="text-[12px] text-foreground truncate mt-0.5" style={{ fontWeight: 600 }}>{invoice.currency}</p>
            </div>
          </div>
          {termDetailOpen && (
            <PaymentTermDetailsModal
              termLabel={invoice.paymentTerms || presetForVendor(invoice.vendor).name}
              onClose={() => setTermDetailOpen(false)}
            />
          )}
          {/* Created By | Created On — the partner card's footer, avatar
              included (user 9/25). The separate Description block is gone:
              the description now rides the vendor hero subline and the
              page header strip. */}
          <div className="grid grid-cols-2 gap-x-3 mt-3.5 pt-3.5 border-t border-slate-100">
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Created By</p>
              <p className="flex items-center gap-1.5 mt-1 min-w-0">
                <PhotoPersonAvatar name={invoice.createdBy} size="sm" />
                <span className="text-[12px] text-foreground truncate" style={{ fontWeight: 600 }}>{invoice.createdBy}</span>
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Created On</p>
              <p className="text-[12px] text-foreground truncate mt-1.5" style={{ fontWeight: 600 }}>{fmtSidebarDate(invoice.createdDate)}</p>
            </div>
          </div>
        </div>
      </SidebarSection>

      {/* 3-Way Matching panel removed per BA. */}

      {/* ── Invoice Summary ─────────────────────────────────── */}
      <SidebarSection
        icon={Wallet}
        title="Invoice Summary"
        open={open.summary}
        onToggle={() => toggle('summary')}
        collapsedSummary={formatMoney(amountAfterReductions, invoice.currency)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400" style={{ fontWeight: 600 }}>Total Amount</p>
            {/* Hero reflects credit memos (feedback 7/20/26) AND applied
                prepayments (9/2/26): the number the AP clerk owes is
                after every reduction; the gross value reads back as
                "Original total" right under it. */}
            <p className="text-[22px] text-foreground mt-0.5" style={{ fontWeight: 700, lineHeight: 1.1 }}>
              {formatMoney(amountAfterReductions, invoice.currency)}
            </p>
            {((numbers.credits ?? 0) > 0 || prepayTotal > 0) && (
              <p className="text-[11px] text-slate-400 mt-1" style={{ fontWeight: 500 }}>
                Original Total {formatMoney(numbers.total, invoice.currency)}
              </p>
            )}
          </div>
          {/* Settled (full credit memo, no cash) reads back as Settled
              here too (feedback 7/22/26), matching the header pill. */}
          {invoice.status === 'Settled' ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-px rounded border text-[10px] shrink-0 mt-0.5"
              style={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }}>
              Settled
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-px rounded border text-[10px] shrink-0 mt-0.5"
              style={{ fontWeight: 600, backgroundColor: statusPalette.bg, color: statusPalette.color, borderColor: statusPalette.border }}>
              {statusDisplayLabel(status, invoice.type)}
            </span>
          )}
        </div>

        {/* Paid | Outstanding — the two load-bearing figures sit ABOVE the
            breakdown accordion in the General Information card's two-column
            label-over-value grid (user 10/1). Paid wears green; Outstanding
            reads grey label, black figure. */}
        {numbers.total > 0 && (() => {
          const settledAmount = Math.max(0, Math.round((numbers.total - numbers.outstanding) * 100) / 100);
          const byCreditsOnly = invoice.status === 'Settled' && !reconciledInto && prepayTotal <= 0;
          const hasCreditSplit = invoice.status !== 'Settled' && (numbers.credits ?? 0) > 0;
          const cashPaid = invoice.isUserCreated
            ? numbers.paid
            // numbers.paid already excludes this session's credits
            // (creditedAmount), so only the seed's own credits come off.
            : Math.max(0, Math.round((numbers.paid - Math.max(0, (numbers.credits ?? 0) - (invoice.creditedAmount ?? 0)) - prepayTotal) * 100) / 100);
          const paidLabel = invoice.status === 'Settled'
            ? byCreditsOnly ? 'Settled by Credit Memos' : 'Settled'
            : hasCreditSplit ? 'Cash Paid' : 'Paid';
          const paidValue = invoice.status === 'Settled'
            ? (byCreditsOnly ? (numbers.credits ?? settledAmount) : settledAmount)
            : hasCreditSplit ? cashPaid : numbers.paid;
          return (
            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 mt-3 pt-3 border-t border-slate-100">
              <div className="min-w-0">
                <p className="text-[11px]" style={{ fontWeight: 500, color: '#059669' }}>{paidLabel}</p>
                <p className="text-[13px] truncate mt-0.5" style={{ fontWeight: 600, color: '#047857' }}>
                  {formatMoney(paidValue, invoice.currency)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Outstanding</p>
                <p className="text-[13px] text-foreground truncate mt-0.5" style={{ fontWeight: 600 }}>
                  {formatMoney(numbers.outstanding, invoice.currency)}
                </p>
              </div>
              {hasCreditSplit && (
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Credited</p>
                  <p className="text-[13px] text-foreground truncate mt-0.5" style={{ fontWeight: 600 }}>
                    {formatMoney(numbers.credits ?? 0, invoice.currency)}
                  </p>
                </div>
              )}
            </div>
          );
        })()}

        <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
          {/* Breakdown folds behind the creation form's Show-breakdown
              accordion (user 10/1): same toggle copy, same grid-rows
              animation, collapsed by default. */}
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
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Subtotal</span>
                  <span className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>{formatMoney(numbers.subtotal, invoice.currency)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Tax</span>
                  <span className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>{formatMoney(numbers.tax, invoice.currency)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Freight</span>
                  <span className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>{formatMoney(numbers.freight, invoice.currency)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Additional Charges</span>
                  <span className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>{formatMoney(numbers.additional, invoice.currency)}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between text-[13px] pt-1.5 mt-1.5 border-t border-slate-100">
            <span className="text-foreground" style={{ fontWeight: 600 }}>Invoice Total</span>
            <span className="text-foreground " style={{ fontWeight: 700 }}>
              {formatMoney(numbers.total, invoice.currency)}
            </span>
          </div>
          {/* Credit memos and applied prepayments reduce the amount owed —
              each reduction and the resulting amount due read back
              explicitly (7/15/26, prepay rows 9/2/26). */}
          {/* One home for the pre-invoice number (Nophil 9/28): its own
              line, clickable through to the pre-invoice — the separate
              "Applied prepayments" card below is gone. */}
          {(invoice.appliedPrepayments ?? []).map((p) => (
            <div key={p.invoiceNumber}>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-violet-700" style={{ fontWeight: 500 }}>Prepayment Applied</span>
                <span className="text-violet-700" style={{ fontWeight: 600 }}>
                  −{formatMoney(Math.min(p.amount, numbers.total), invoice.currency)}
                </span>
              </div>
              <a
                href={`/invoices/${encodeURIComponent(p.invoiceNumber)}`}
                className="inline-block text-[11px] text-violet-700 hover:text-violet-900 hover:underline mt-0.5"
                style={{ fontWeight: 600 }}
              >
                {p.invoiceNumber}
              </a>
            </div>
          ))}
          {(numbers.credits ?? 0) > 0 && (
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-slate-500">Credit Memos</span>
              <span className="" style={{ fontWeight: 600, color: '#047857' }}>
                −{formatMoney(numbers.credits ?? 0, invoice.currency)}
              </span>
            </div>
          )}
          {((numbers.credits ?? 0) > 0 || prepayTotal > 0) && (
            <div className="flex items-center justify-between text-[13px] pt-1.5 mt-1.5 border-t border-slate-100">
              <span className="text-foreground" style={{ fontWeight: 600 }}>
                {prepayTotal > 0 && (numbers.credits ?? 0) > 0
                  ? 'Amount Due After Credits & Prepayments'
                  : prepayTotal > 0
                    ? 'Amount Due After Prepayments'
                    : 'Amount Due After Credits'}
              </span>
              <span className="text-foreground " style={{ fontWeight: 700 }}>
                {formatMoney(amountAfterReductions, invoice.currency)}
              </span>
            </div>
          )}
          {/* Paid / Outstanding moved ABOVE the breakdown accordion as the
              two-column grid (user 10/1) — no duplicate rows down here. */}
        </div>
      </SidebarSection>

      {/* Applied-prepayments card removed (Nophil 9/28): the summary's
          "Prepayment applied" line now names and links the pre-invoice,
          so this card repeated it. */}

      {/* ── Reconciled into (9/2/26) ────────────────────────────
          The pre-invoice side of the same story: this pre-invoice's
          prepayment applied to a receiving invoice and it settled. */}
      {invoice.type === 'Pre-Invoice' && reconciledInto && (
        <div className="rounded-lg border border-violet-200 bg-violet-50/60 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Wallet className="w-3.5 h-3.5 text-violet-600" />
            <p className="text-[10px] text-violet-700" style={{ fontWeight: 600 }}>Reconciled</p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-violet-800" style={{ fontWeight: 500 }}>Reconciled Into</span>
            <a
              href={`/invoices/${encodeURIComponent(reconciledInto)}`}
              className="text-[11px] text-violet-800 hover:underline"
              style={{ fontWeight: 600 }}
            >
              {reconciledInto}
            </a>
          </div>
          <p className="text-[10px] text-violet-600/80 leading-snug mt-1.5" style={{ fontWeight: 500 }}>
            The prepayment on this pre-invoice applied to that invoice at creation
            {reconciledEntry?.by ? `, recorded by ${reconciledEntry.by}` : ''}. This pre-invoice is settled.
          </p>
        </div>
      )}

      {/* ── Flags & Exceptions ──────────────────────────────────
          Full cards (9/4/26 Eli, BB-19): the exception is VISIBLE here —
          what it is, who flagged it, when, why, and its attachments —
          without committing to resolve it ("I can't see the exception
          without resolving the exception"). Resolved exceptions stay as
          a green card while the invoice is pre-approval (BB-17/BB-21a:
          "you're never really turning the exception off, you're just
          resolving it"); after approval the Activity log carries it.
          Same anatomy for the payment hold, attachments included. */}
      {(() => {
        const history = invoice.actionHistory ?? [];
        const lastOf = (action: string) => [...history].reverse().find((e) => e.action === action);
        const exceptionFlag = lastOf('flagException');
        const exceptionResolved = lastOf('resolve');
        const holdFlag = lastOf('paymentHold');
        // A resolved exception stays visible while the invoice is still
        // pre-approval; once approved it drops to the Activity log.
        const showResolvedException =
          !invoice.is_exception && !!exceptionFlag && !!exceptionResolved && invoice.status === 'Pending Approval';
        if (!invoice.is_exception && !invoice.is_payment_held && !showResolvedException) return null;
        return (
          <SidebarSection
            icon={Flag}
            title="Flags"
            open={open.flags}
            onToggle={() => toggle('flags')}
            collapsedSummary={
              invoice.is_exception || invoice.is_payment_held ? (
                <span className="text-amber-700" style={{ fontWeight: 600 }}>
                  {[invoice.is_exception && 'Exception', invoice.is_payment_held && 'Hold'].filter(Boolean).join(' · ')}
                </span>
              ) : (
                <span className="text-emerald-600" style={{ fontWeight: 600 }}>Exception Resolved</span>
              )
            }
          >
            <div className="space-y-3 divide-y divide-slate-100 [&>*+*]:pt-3">
              {invoice.is_exception && (
                <SubmittedFlagCard
                  compact
                  flat
                  kind="exception"
                  reason={exceptionFlag?.reason}
                  typeLabels={exceptionFlag?.reason ? exceptionTypeLabelsFromReason(exceptionFlag.reason) : undefined}
                  by={exceptionFlag?.by ?? invoice.createdBy}
                  at={exceptionFlag?.at}
                  attachments={exceptionFlag?.attachments}
                  footnote="Excluded from GL posting until resolved."
                  actionLabel={onResolveException ? 'Resolve' : undefined}
                  onAction={onResolveException}
                  actionHint={onResolveException ? 'Opens the invoice so you can fix it and resubmit.' : undefined}
                />
              )}
              {showResolvedException && (
                <SubmittedFlagCard
                  compact
                  flat
                  kind="resolved"
                  reason={exceptionFlag?.reason}
                  resolution={{
                    reason: exceptionResolved?.reason,
                    by: exceptionResolved?.by,
                    at: exceptionResolved?.at,
                    attachments: exceptionResolved?.attachments,
                  }}
                />
              )}
              {invoice.is_payment_held && (
                <SubmittedFlagCard
                  compact
                  flat
                  kind="hold"
                  reason={holdFlag?.reason}
                  by={holdFlag?.by ?? invoice.createdBy}
                  at={holdFlag?.at}
                  attachments={holdFlag?.attachments}
                  footnote="Posted to GL but payments are blocked."
                  actionLabel={onReleaseHold ? 'Release' : undefined}
                  onAction={onReleaseHold}
                />
              )}
            </div>
          </SidebarSection>
        );
      })()}

      {/* ── Additional Charges ───────────────────────────────── */}
      <SidebarSection
        icon={Receipt}
        title="Additional Charges"
        open={open.charges}
        onToggle={() => toggle('charges')}
        collapsedSummary={
          additionalCharges.length > 0
            ? formatMoney(additionalCharges.reduce((s, c) => s + c.amount, 0), invoice.currency)
            : 'None'
        }
      >
        {additionalCharges.length === 0 ? (
          <p className="text-[11px] text-slate-400 text-center py-2" style={{ fontWeight: 500 }}>
            No additional charges on this invoice.
          </p>
        ) : (
          <div className="space-y-2">
            {additionalCharges.map((charge, idx) => (
              <div key={idx} className="flex items-start justify-between gap-2 px-2.5 py-2 rounded-md bg-slate-50/60 border border-slate-100">
                <div className="min-w-0">
                  <p className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>{charge.label}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5" style={{ fontWeight: 500 }}>{charge.gl}</p>
                </div>
                <span className="text-[11px] text-foreground shrink-0" style={{ fontWeight: 600 }}>
                  {formatMoney(charge.amount, invoice.currency)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-100 text-[12px]">
              <span className="text-foreground" style={{ fontWeight: 600 }}>Subtotal</span>
              <span className="text-foreground " style={{ fontWeight: 700 }}>
                {formatMoney(additionalCharges.reduce((s, c) => s + c.amount, 0), invoice.currency)}
              </span>
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
        collapsedSummary={freightDetails.amount > 0 ? formatMoney(freightDetails.amount, invoice.currency) : 'None'}
      >
        {freightDetails.amount === 0 ? (
          <p className="text-[11px] text-slate-400 text-center py-2" style={{ fontWeight: 500 }}>
            No freight on this invoice.
          </p>
        ) : (
          <div className="space-y-2.5">
            <div>
              <p className="text-[10px] text-slate-400" style={{ fontWeight: 600 }}>Freight Amount</p>
              <p className="text-[18px] text-foreground mt-0.5" style={{ fontWeight: 700, lineHeight: 1.1 }}>
                {formatMoney(freightDetails.amount, invoice.currency)}
              </p>
            </div>

            {/* Carrier — partner-style CarrierCard, identical to the
                create-invoice freight picker so the carrier identity reads
                the same across capture and review. */}
            {freightDetails.carrier && (
              <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
                <p className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Carrier</p>
                <CarrierCard
                  carrier={freightDetails.carrier}
                  isSelected
                  hideCheckmark
                  readOnly
                  showStatusBadge
                />
              </div>
            )}

            <div className="pt-2.5 border-t border-slate-100">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>GL Account</span>
                <span className="text-[11px] text-foreground text-right" style={{ fontWeight: 600 }}>
                  {freightDetails.glAccount}
                </span>
              </div>
            </div>
          </div>
        )}
      </SidebarSection>

      {/* Vendor Information sidebar section removed per BA — the
          header now carries the vendor pill with a HoverCard quick-
          card preview, so the sidebar card was just duplicating it. */}

      {/* Payment Schedule + Linked Records sidebar sections removed
          per BA — due-date / overdue lives inside General Information
          (where it makes more sense), linked records have their own
          tab at the top of the detail page. */}

      {/* Timeline sidebar card removed per feedback 7/15/26 — lifecycle
          history lives in the Recent Activity tab. */}
    </aside>
  );
}
