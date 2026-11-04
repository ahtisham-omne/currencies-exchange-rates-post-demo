import { useEffect, useState, useRef } from 'react';
import { formatUsDateTime } from '@/app/lib/dueBucket';
import {
  X,
  ExternalLink,
  Calendar,
  Wallet,
  FileText,
  User,
  Building2,
  Receipt,
  ArrowRight,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import { VendorAvatar } from '@/app/components/VendorAvatar';
import { PaymentHoldLock } from '@/app/components/PaymentHoldLock';
import type { Invoice } from '@/app/data/mockInvoices';

interface InvoiceQuickViewPanelProps {
  invoice: Invoice | null;
  onClose: () => void;
  onOpenFullDetail: (invoiceId: string) => void;
}

const STATUS_TONE: Record<string, { bg: string; text: string; border: string }> = {
  Draft: { bg: '#F8FAFC', text: '#475569', border: '#E2E8F0' },
  'Pending Approval': { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
  Approved: { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
  'Partially Paid': { bg: '#EBF3FF', text: '#0654BC', border: '#ADD1FF' },
  'Paid in Full': { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
  Exception: { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  'Payment Hold': { bg: '#FEFCE8', text: '#A16207', border: '#FEF08A' },
  Cancelled: { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' },
};

/** Written labels for action-history codes (capitalization standard §2:
 *  never show the raw code, never force case in CSS). */
const HISTORY_ACTION_LABEL: Record<string, string> = {
  approve: 'Approved',
  reject: 'Rejected',
  cancel: 'Cancelled',
  uncancel: 'Uncancelled',
  archive: 'Archived',
  restore: 'Restored',
  resolve: 'Resolved',
  submit: 'Submitted',
  resubmit: 'Resubmitted',
  flagException: 'Flagged as Exception',
  paymentHold: 'Payment Hold',
  releaseHold: 'Hold Released',
  reversePayment: 'Payment Reversed',
  reconciled: 'Reconciled',
};

/**
 * Right-side peek panel for an invoice. Mirrors partners' QuickViewPanel
 * pattern: a slide-in 480px panel with a header (icon + invoice number +
 * status + close), a stats strip (amount / due / outstanding), a "Vendor
 * & references" card, an action history feed if any entries exist, and
 * a footer with "View full details" CTA that hands off to the existing
 * InvoiceDetailScreen.
 */
export function InvoiceQuickViewPanel({
  invoice,
  onClose,
  onOpenFullDetail,
}: InvoiceQuickViewPanelProps) {
  // Smooth mount / unmount with CSS transitions so the panel slides in / out
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (invoice) {
      setMounted(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      timeoutRef.current = setTimeout(() => setMounted(false), 280);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [invoice]);

  // ESC closes the panel
  useEffect(() => {
    if (!invoice) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [invoice, onClose]);

  if (!mounted || !invoice) return null;

  const tone = STATUS_TONE[invoice.status] ?? STATUS_TONE.Draft;
  const fmtMoney = (n: number) =>
    `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[180] transition-opacity duration-[250ms]"
        style={{
          backgroundColor: visible ? 'rgba(0,0,0,0.20)' : 'rgba(0,0,0,0)',
          pointerEvents: visible ? 'auto' : 'none',
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 bottom-0 z-[181] w-full max-w-[480px] bg-white flex flex-col shadow-2xl transition-transform duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ transform: visible ? 'translateX(0)' : 'translateX(100%)' }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'hsl(var(--accent))' }}
              >
                <Receipt className="w-4 h-4" style={{ color: 'hsl(var(--primary))' }} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2
                    className="text-[15px] truncate"
                    style={{ fontWeight: 600 }}
                    title={invoice.invoiceNumber}
                  >
                    {invoice.invoiceNumber}
                  </h2>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-md border whitespace-nowrap"
                    style={{
                      backgroundColor: tone.bg,
                      color: tone.text,
                      borderColor: tone.border,
                      fontWeight: 500,
                    }}
                  >
                    {invoice.status === 'Exception' && <AlertTriangle className="w-3 h-3" />}
                    {invoice.status}
                  </span>
                  <PaymentHoldLock invoice={invoice} />
                </div>
                <p className="text-[12px] text-muted-foreground mt-0.5 truncate">
                  Vendor invoice {invoice.vendorInvoiceNumber}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer -mt-0.5 -mr-1"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-5 py-4 space-y-4">
          {/* Amounts strip */}
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Amount" value={fmtMoney(invoice.amount)} tone="primary" />
            <Stat label="Outstanding" value={fmtMoney(invoice.outstandingBalance)} tone={invoice.outstandingBalance === 0 ? 'success' : 'warning'} />
            <Stat label="Currency" value={invoice.currency} tone="neutral" />
          </div>

          {/* Vendor + dates card */}
          <div className="border border-border rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-3">
              <VendorAvatar name={invoice.vendor} size="md" />
              <div className="min-w-0">
                <div className="text-[13px] truncate" style={{ fontWeight: 500 }}>
                  {invoice.vendor}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {invoice.apAccount}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60">
              <KeyValue label="Invoice Date" value={formatUsDateTime(invoice.invoiceDate, invoice.id)} icon={Calendar} />
              <KeyValue label="Due Date" value={formatUsDateTime(invoice.dueDate, invoice.id)} icon={Calendar} />
              <KeyValue label="Type" value={invoice.type} icon={FileText} />
              <KeyValue label="Created By" value={invoice.createdBy} icon={User} />
            </div>
          </div>

          {/* Description */}
          {invoice.description && (
            <div className="space-y-1">
              <div
                className="text-[10px] text-muted-foreground/60"
                style={{ fontWeight: 600 }}
              >
                Description
              </div>
              <p className="text-[13px] text-foreground">{invoice.description}</p>
            </div>
          )}

          {/* Linked records */}
          {(invoice.linkedPOs.length > 0 || invoice.linkedGRNs.length > 0) && (
            <div className="space-y-1.5">
              <div
                className="text-[10px] text-muted-foreground/60"
                style={{ fontWeight: 600 }}
              >
                Linked Records
              </div>
              <div className="flex flex-wrap gap-1.5">
                {invoice.linkedPOs.map((po) => (
                  <span
                    key={po}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border"
                    style={{
                      backgroundColor: '#EBF3FF',
                      color: '#0654BC',
                      borderColor: '#ADD1FF',
                      fontWeight: 500,
                    }}
                  >
                    <FileText className="w-3 h-3" />
                    {po}
                  </span>
                ))}
                {invoice.linkedGRNs.map((grn) => (
                  <span
                    key={grn}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border"
                    style={{
                      backgroundColor: '#ECFDF5',
                      color: '#047857',
                      borderColor: '#A7F3D0',
                      fontWeight: 500,
                    }}
                  >
                    <Building2 className="w-3 h-3" />
                    {grn}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Flags */}
          {(invoice.is_payment_held || invoice.is_exception) && (
            <div className="space-y-1.5">
              <div
                className="text-[10px] text-muted-foreground/60"
                style={{ fontWeight: 600 }}
              >
                Flags
              </div>
              <div className="flex flex-wrap gap-1.5">
                {invoice.is_payment_held && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border bg-rose-50 text-rose-700 border-rose-200">
                    <Lock className="w-3 h-3" />
                    Payment Hold
                  </span>
                )}
                {invoice.is_exception && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border bg-orange-50 text-orange-700 border-orange-200">
                    <AlertTriangle className="w-3 h-3" />
                    Exception
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Action history */}
          {invoice.actionHistory && invoice.actionHistory.length > 0 && (
            <div className="space-y-2">
              <div
                className="text-[10px] text-muted-foreground/60"
                style={{ fontWeight: 600 }}
              >
                Action History
              </div>
              <div className="space-y-2">
                {invoice.actionHistory.slice().reverse().map((entry, idx) => (
                  <div
                    key={idx}
                    className="border border-border rounded-md p-2.5 text-[12px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span style={{ fontWeight: 500 }}>
                        {HISTORY_ACTION_LABEL[entry.action] ?? entry.action}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(entry.at).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-muted-foreground mt-1">{entry.reason}</div>
                    <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                      by {entry.by}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border shrink-0 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => onOpenFullDetail(invoice.id)}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] text-white"
            style={{ backgroundColor: 'hsl(var(--primary))', fontWeight: 500 }}
          >
            View Full Details
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'primary' | 'success' | 'warning' | 'neutral';
}) {
  const TONE: Record<typeof tone, string> = {
    primary: 'text-foreground',
    success: 'text-emerald-600',
    warning: 'text-orange-600',
    neutral: 'text-slate-700',
  };
  return (
    <div className="border border-border rounded-lg p-2.5">
      <div className="text-[10px] text-muted-foreground/60" style={{ fontWeight: 600 }}>
        {label}
      </div>
      <div
        className={`text-[15px] tracking-tight mt-1 ${TONE[tone]}`}
        style={{ fontWeight: 700 }}
      >
        {value}
      </div>
    </div>
  );
}

function KeyValue({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="min-w-0">
      <div
        className="text-[10px] text-muted-foreground/60 mb-0.5"
        style={{ fontWeight: 600 }}
      >
        {label}
      </div>
      <div className="flex items-center gap-1.5 text-[12px] text-foreground">
        <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
        <span className="truncate" title={value}>
          {value}
        </span>
      </div>
    </div>
  );
}
