import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { localTodayIso } from '@/app/lib/dueBucket';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Layout, type AppView } from '@/app/components/Layout';
import { OverviewScreen } from '@/app/components/OverviewScreen';
import { InvoiceListScreen } from '@/app/components/InvoiceListScreen';
import { cashPaidOn } from '@/app/lib/invoiceCash';
import { AccountingDashboardScreen } from '@/app/components/AccountingDashboardScreen';
import { InvoiceCreationFlow } from '@/app/components/InvoiceCreationFlow';
import { InvoiceDetailScreen } from '@/app/components/InvoiceDetailScreen';
import { PrepaymentsScreen } from '@/app/components/PrepaymentsScreen';
import { PaymentsScreen } from '@/app/components/PaymentsScreen';
import type { ReleaseHoldResult } from '@/app/components/ReleaseHoldDialog';
import { PaymentDetailScreen } from '@/app/components/PaymentDetailScreen';
import { CreditMemoDetailScreen } from '@/app/components/CreditMemoDetailScreen';
import type { CreditMemo } from '@/app/data/creditMemos';
import type { InvoiceNote } from '@/app/components/invoice-details/NotesTab';
import { stampRate } from '@/app/currency/invoiceFx';

// Stable empty array so the detail screen's notes prop stays
// referentially equal for invoices without notes.
const EMPTY_NOTES: InvoiceNote[] = [];
import { ReceivingDocumentsScreen } from '@/app/components/ReceivingDocumentsScreen';
import { Toaster } from '@/app/components/ui/sonner';
import { SafeMuiThemeProvider } from '@/app/components/MuiThemeContext';
import { mockInvoices, Invoice, type InvoiceCharges } from '@/app/data/mockInvoices';
import { DEFAULT_FREIGHT_GL_ACCOUNT, DEFAULT_ADDITIONAL_CHARGE_GL_ACCOUNT } from '@/app/data/glAccounts';
import { presetForVendor } from '@/app/data/paymentTermPresets';
import { generateLines } from '@/app/components/invoice-details/LineItemsTab';
import { mockPayments, Payment } from '@/app/data/mockPayments';
import { SEED_RUN_PAYMENTS } from '@/app/data/paymentRuns';
import { mockVendors, applyInvoiceToVendorDocs, releaseInvoiceFromVendorDocs, billedLineRefsFromSaved } from '@/app/data/mockVendors';
import { CreateInvoiceScreen } from '@/app/components/CreateInvoiceScreen';
import type { SelectedPOData } from '@/app/components/VendorSelectionModalNested';
import { RecordPaymentFlow, type InvoiceAllocation, type RecordPaymentMode, type PrepaymentConsumption } from '@/app/components/payments/RecordPaymentFlow';
import { TerminologySwap } from '@/app/components/TerminologySwap';
import { CustomerInvoiceListScreen } from '@/app/components/customer/CustomerInvoiceListScreen';
import { CustomerInvoiceCreationFlow } from '@/app/components/customer/CustomerInvoiceCreationFlow';
import { CustomerInvoiceDetailScreen } from '@/app/components/customer/CustomerInvoiceDetailScreen';
import { SendToCustomerModal } from '@/app/components/customer/SendToCustomerModal';
import { RecordReceiptModal } from '@/app/components/customer/RecordReceiptModal';
import { IssueCreditMemoModal } from '@/app/components/customer/IssueCreditMemoModal';
import type { ArCreateEntry } from '@/app/components/customer/arCreateContract';
import { useCustomerInvoicing } from '@/app/hooks/useCustomerInvoicing';
import { usePaymentRuns } from '@/app/hooks/usePaymentRuns';
import { PaymentRunScreen } from '@/app/components/payments/run/PaymentRunScreen';
import { RunDetailScreen } from '@/app/components/payments/run/RunDetailScreen';
import { ImportInvoicesModal } from '@/app/components/invoice-import/ImportInvoicesModal';
import { toast } from 'sonner';

// URL → AppView resolver. Pathname segments are matched against the
// known view ids defined in Layout.tsx. Unknown / root paths fall
// back to the overview surface.
function viewFromPath(pathname: string): AppView {
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  // AR mirrors (7/17/26) — checked before the AP prefixes on principle,
  // though '/customer-*' never collides with them.
  if (pathname.startsWith('/customer-invoices')) return 'customer-invoices';
  if (pathname.startsWith('/customer-payments')) return 'customer-payments';
  if (pathname.startsWith('/invoices')) return 'invoices';
  // Credit memo pages live in the invoicing context (9/22/26): the nav
  // highlights Vendor Invoicing while a memo is open.
  if (pathname.startsWith('/credit-memos')) return 'invoices';
  if (pathname.startsWith('/prepayments')) return 'prepayments';
  if (pathname.startsWith('/payments-v2')) return 'payments-v2';
  if (pathname.startsWith('/receiving')) return 'receiving';
  return 'overview';
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ invoiceNumber?: string; paymentNumber?: string; runId?: string; creditMemoNumber?: string }>();

  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  // Vendor + type lock for deep-linked creation (Eli 9/24, user 9/25):
  // the payment flow's split Create CTA passes ?create=<type>&vendor= —
  // the flow opens with THAT type asserted (no type screen) and locked
  // to that vendor so the new record can't land on anyone else.
  const [createVendorLock, setCreateVendorLock] = useState<string | null>(null);
  const [createTypeLock, setCreateTypeLock] = useState<'invoice' | 'pre-invoice' | 'standalone' | null>(null);
  const [showImportInvoices, setShowImportInvoices] = useState(false);
  // Edit-and-resubmit: the rejected invoice being fixed in the creation
  // modal, plus the rejection reason replayed in its banner (7/15/26).
  const [resubmitInvoice, setResubmitInvoice] = useState<Invoice | null>(null);
  const [resubmitReason, setResubmitReason] = useState('');
  // Who to tell when the resolve/resubmit completes (feedback 7/22/26) —
  // captured by the detail page's confirm, recorded on the action entry.
  const [resubmitNotifyIds, setResubmitNotifyIds] = useState<string[] | undefined>(undefined);
  // Resolution record captured in the resubmit confirm (9/5/26 review):
  // notes + documents + the notify choice ride the resolve/submit entry.
  // A ref, not state — the confirm hands it over and submits in the SAME
  // click, so state wouldn't be visible to the created callback yet.
  const resubmitRecordationRef = useRef<{ notes: string; attachments?: string[]; notifyIds?: string[] } | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>(mockInvoices);
  // Always-current mirror so action handlers (deps []) can read the live
  // invoice records for side effects — e.g. giving a cancelled invoice's
  // billed quantities back to its PO (VI-02) — without re-subscribing.
  const invoicesRef = useRef(invoices);
  useEffect(() => { invoicesRef.current = invoices; }, [invoices]);
  // Payments live here (like invoices) so the listing, the Record
  // Payment wizard, and the payment detail page share one source. The
  // Completed seed run's posted payments lead the register so Payment
  // history and the runs tab tell one story.
  const [payments, setPayments] = useState<Payment[]>(() => [...SEED_RUN_PAYMENTS, ...mockPayments]);
  // Credit memos are real records too (9/22/26 review response): they
  // persist across navigation and back a real detail page.
  const [creditMemos, setCreditMemos] = useState<CreditMemo[]>([]);
  // Invoice notes (GPT QC02, 9/30): session records keyed by invoice id,
  // same pattern as credit memos. Seeded on the first Pending Approval
  // invoice (user 10/6) so the Notes tab reads as a live surface.
  const [invoiceNotes, setInvoiceNotes] = useState<Record<string, InvoiceNote[]>>(() => {
    const target = mockInvoices.find((i) => i.status === 'Pending Approval') ?? mockInvoices[0];
    if (!target) return {};
    return {
      [target.id]: [
        { id: 'note-seed-1', text: 'Vendor confirmed the revised unit price by email. Holding approval until the updated PO acknowledgement comes through.', author: 'Mahreen Ghafoor', createdAt: '2026-10-02T15:12:00.000Z' },
        { id: 'note-seed-2', text: 'Quantities reconcile against the receiving report. Fine to approve once the price note clears.', author: 'Ahtisham Ahmad', createdAt: '2026-10-03T09:40:00.000Z' },
      ],
    };
  });
  const handleAddNote = useCallback((invoiceId: string, text: string) => {
    setInvoiceNotes((prev) => ({
      ...prev,
      [invoiceId]: [
        ...(prev[invoiceId] ?? []),
        { id: `note-${Date.now()}`, text, author: 'Ahtisham Ahmad', createdAt: new Date().toISOString() },
      ],
    }));
  }, []);
  const handleUpdateNote = useCallback((invoiceId: string, noteId: string, text: string) => {
    setInvoiceNotes((prev) => ({
      ...prev,
      [invoiceId]: (prev[invoiceId] ?? []).map((n) =>
        n.id === noteId ? { ...n, text, updatedAt: new Date().toISOString() } : n,
      ),
    }));
  }, []);
  const handleDeleteNote = useCallback((invoiceId: string, noteId: string) => {
    setInvoiceNotes((prev) => ({
      ...prev,
      [invoiceId]: (prev[invoiceId] ?? []).filter((n) => n.id !== noteId),
    }));
  }, []);
  // Record Payment / Prepayment launched from an invoice (listing row / detail
  // page). Rendered as an App-level overlay so the user stays on the invoice
  // screen. Where recording lands depends on the origin (design feedback
  // 7/8/26): from the invoice DETAIL page the user stays right there; from
  // the invoice LISTING they land on that invoice's detail page.
  const [invoiceFlow, setInvoiceFlow] = useState<{
    mode: RecordPaymentMode;
    paySelection?: string[];
    prepayPrefill?: { vendor: string; preInvoiceId?: string };
    origin: 'detail' | 'listing';
  } | null>(null);

  // Source of truth for "which screen / which invoice" is the URL,
  // so browser back/forward + reload + deep-link all work the same
  // way the partner module does (e.g. /vendors/v-001).
  const currentScreen = viewFromPath(location.pathname);

  // Deep-link creation (7/24/26): the Record Payment flow's Create Invoice /
  // Create Pre-Invoice CTAs open /invoices?create=invoice|pre-invoice in a
  // new tab — landing here auto-launches the invoice creation flow. The
  // param is consumed (stripped) so refresh/back doesn't relaunch it.
  useEffect(() => {
    if (currentScreen !== 'invoices') return;
    const qs = new URLSearchParams(location.search);
    const create = qs.get('create');
    if (create === 'invoice' || create === 'pre-invoice' || create === 'standalone') {
      // The vendor AND the type ride along (Eli 9/24, user 9/25):
      // creation from the payment flow is FOR that vendor with the type
      // already chosen — no type screen, no vendor re-pick.
      setCreateVendorLock(qs.get('vendor'));
      setCreateTypeLock(create);
      setShowCreateInvoice(true);
      // Through the router so its basename stays in the URL (embedded in the shell).
      navigate(location.pathname, { replace: true });
    }
  }, [currentScreen, location.search, location.pathname, navigate]);
  const selectedInvoiceId = useMemo(() => {
    if (!params.invoiceNumber) return null;
    const decoded = decodeURIComponent(params.invoiceNumber);
    const inv = invoices.find((i) => i.invoiceNumber === decoded);
    return inv?.id || null;
  }, [params.invoiceNumber, invoices]);

  // ── Customer Invoicing (AR) — its OWN data and screens (spec 7/22/26).
  // The terminology-swap mirage is retired for this module; Customer
  // Payments keeps it until that module is rebuilt.
  const ar = useCustomerInvoicing();
  // The creation flow opens with an entry: fresh (type picker), part way
  // through (Ready to Invoice row, deep link) or editing a record.
  const [customerCreateEntry, setCustomerCreateEntry] = useState<ArCreateEntry | null>(null);
  // Which modal is open, and against which invoice. A credit memo modal
  // is keyed by the PARENT invoice; editId names the credit memo edited.
  const [customerModal, setCustomerModal] = useState<{
    kind: 'send' | 'receipt' | 'creditMemo';
    invoiceId: string;
    editId?: string;
  } | null>(null);
  const customerModalInvoice = useMemo(
    () => (customerModal ? ar.customerInvoices.find((i) => i.id === customerModal.invoiceId) ?? null : null),
    [customerModal, ar.customerInvoices],
  );

  // Shared router for customer-invoice row + detail actions. Reason-free
  // workflow transitions apply immediately; money actions open their
  // modal; reason actions open the detail (which owns those dialogs).
  const handleCustomerRowAction = useCallback(
    (actionId: string, invoiceId: string) => {
      const inv = ar.customerInvoices.find((i) => i.id === invoiceId);
      if (!inv) return;
      const openDetail = () =>
        navigate(`/customer-invoices/${encodeURIComponent(inv.invoiceNumber)}`, {
          state: { from: location.pathname + location.search },
        });
      switch (actionId) {
        case 'view':
          openDetail();
          return;
        case 'submit':
        case 'approve':
        case 'releaseCreditHold': {
          // FAD 11/2: an open exception holds approval (vendor parity), and
          // the hook's approve-time duplicate check may block it.
          if (actionId === 'approve' && inv.exception) {
            toast.error('Resolve the exception first', { description: `${inv.invoiceNumber} has an open exception. Open it to resolve, then approve.` });
            return;
          }
          const { blocked } = ar.applyCustomerInvoiceAction([invoiceId], actionId, '');
          if (blocked.includes(invoiceId)) return;
          toast.success(
            actionId === 'approve' ? `${inv.invoiceNumber} approved`
              : actionId === 'submit' ? `${inv.invoiceNumber} submitted for approval`
                : 'Credit hold released',
            actionId === 'approve' && (inv.docKind !== 'Advance Invoice' || inv.treatment === 'Revenue')
              ? { description: 'It posted to the general ledger.' }
              : undefined,
          );
          return;
        }
        case 'send':
        case 'resend':
          setCustomerModal({ kind: 'send', invoiceId });
          return;
        case 'recordPayment':
          setCustomerModal({ kind: 'receipt', invoiceId });
          return;
        case 'issueCreditMemo':
          setCustomerModal({ kind: 'creditMemo', invoiceId });
          return;
        case 'edit': {
          if (inv.docKind === 'Credit Memo') {
            const parent = ar.customerInvoices.find((i) => i.invoiceNumber === inv.relatedInvoiceNumber);
            if (!parent) {
              toast.error(`The invoice ${inv.relatedInvoiceNumber ?? ''} behind this credit memo was not found.`);
              return;
            }
            setCustomerModal({ kind: 'creditMemo', invoiceId: parent.id, editId: inv.id });
            return;
          }
          setCustomerCreateEntry({ editInvoiceId: inv.id });
          return;
        }
        case 'createBalanceInvoice': {
          // PRD §8.2: the balance is billed on a shipment invoice once the
          // goods ship. Open the shipment flow on the order's customer.
          const soNumber = inv.linkedSOs[0];
          if (!soNumber) {
            toast.info('Bill the balance once the quote becomes a sales order and the goods ship.');
            return;
          }
          setCustomerCreateEntry({ kind: 'Shipment Invoice', customerName: inv.customer, soNumber });
          return;
        }
        case 'reject':
        case 'cancel':
        case 'creditHold':
        case 'writeOff':
        case 'archive':
        case 'restore':
        case 'deleteDraft':
        // FAD 11/2: flags, revise and refund also run on the detail page.
        case 'markDisputed':
        case 'resolveDispute':
        case 'flagException':
        case 'resolveException':
        case 'reviseInvoice':
        case 'refundPrepayment':
          // These need a reason or a confirm; the detail page owns those dialogs.
          openDetail();
          return;
        default:
          // duplicate · downloadPdf arrive with Document Builder.
          toast.info('Coming in this prototype soon', {
            description: actionId === 'downloadPdf'
              ? 'The printed layout comes from Document Builder, where the customer invoice layout has not been designed yet.'
              : 'This action arrives with a later customer invoicing update.',
          });
      }
    },
    [ar, navigate, location.pathname, location.search],
  );
  // Entry points from other modules (PRD §3 "Other ways in"): the Sales
  // Order Invoicing tab, a Shipment record and a Quote link here with
  // ?create=shipment|advance plus so= / shipment= / quote=. The query is
  // consumed once so a refresh or back does not reopen the flow.
  useEffect(() => {
    if (!location.pathname.startsWith('/customer-invoices')) return;
    const q = new URLSearchParams(location.search);
    const create = q.get('create');
    if (!create) return;
    const so = q.get('so') ?? undefined;
    const shipment = q.get('shipment') ?? undefined;
    const quote = q.get('quote') ?? undefined;
    const kind = create === 'advance' || quote ? 'Advance Invoice' : create === 'standalone' ? 'Standalone' : 'Shipment Invoice';
    setCustomerCreateEntry({ kind, soNumber: so, shipmentNumber: shipment, quoteNumber: quote });
    navigate(location.pathname, { replace: true });
  }, [location.pathname, location.search, navigate]);

  const selectedCustomerInvoice = useMemo(() => {
    if (!params.invoiceNumber) return null;
    const decoded = decodeURIComponent(params.invoiceNumber);
    return ar.customerInvoices.find((i) => i.invoiceNumber === decoded) ?? null;
  }, [params.invoiceNumber, ar.customerInvoices]);

  const setCurrentScreen = useCallback(
    (next: AppView) => {
      navigate(next === 'overview' ? '/' : `/${next}`);
    },
    [navigate],
  );

  // Sidebar highlight — usually follows the URL, but an invoice detail
  // opened FROM Vendor Payments (Invoices to pay row, Applied To link)
  // keeps Vendor Payments active so the user doesn't feel teleported to
  // the invoicing module (design feedback 7/13/26).
  const navView: AppView = useMemo(() => {
    const from = (location.state as { from?: string } | null)?.from;
    if (currentScreen === 'invoices' && from) {
      if (from.startsWith('/payments-v2')) return 'payments-v2';
    }
    if (currentScreen === 'customer-invoices' && from?.startsWith('/customer-payments')) {
      return 'customer-payments';
    }
    return currentScreen;
  }, [currentScreen, location.state]);

  // ── AR module plumbing (7/17/26) ──────────────────────────────────
  // Customer Invoicing / Customer Payments run the SAME screens on the
  // SAME data; navigation stays inside whichever ledger the user is in,
  // and the terminology layer swaps vendor/PO wording for customer/SO.
  const isCustomerModule = currentScreen === 'customer-invoices' || currentScreen === 'customer-payments';
  const invoicesBase = isCustomerModule ? '/customer-invoices' : '/invoices';
  // AR runs the receivable ledger: header icons, copy direction, and GL
  // journal previews all flip off this (7/20/26).
  const screenModule = isCustomerModule ? 'customer' as const : 'vendor' as const;
  const ledger = isCustomerModule ? 'ar' as const : 'ap' as const;

  const handleViewInvoice = useCallback(
    (id: string) => {
      const inv = invoices.find((i) => i.id === id);
      // Remember where we came from (e.g. the Ready-to-pay tab) so closing the
      // invoice detail returns there instead of always the invoicing listing.
      if (inv) navigate(`${invoicesBase}/${encodeURIComponent(inv.invoiceNumber)}`, {
        state: { from: location.pathname + location.search },
      });
    },
    [invoices, navigate, invoicesBase, location.pathname, location.search],
  );

  const handleCloseDetail = useCallback(() => {
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from && !from.startsWith(invoicesBase) ? from : invoicesBase);
  }, [navigate, invoicesBase, location.state]);

  // ── Payments — detail routing + invoice settlement (PRD §7) ──
  const selectedPayment = useMemo(() => {
    if (!params.paymentNumber) return null;
    const decoded = decodeURIComponent(params.paymentNumber);
    return payments.find((p) => p.paymentNumber === decoded) ?? null;
  }, [params.paymentNumber, payments]);

  // Payment detail routing stays within whichever listing you came from
  // (AP → /payments-v2, AR → /customer-payments) so back/close returns
  // to it.
  const paymentsBase =
    currentScreen === 'customer-payments' ? '/customer-payments' : '/payments-v2';
  const handleViewPayment = useCallback(
    (payment: Payment) =>
      navigate(`${paymentsBase}/${encodeURIComponent(payment.paymentNumber)}`, {
        // Remember the exact listing URL (incl. the ?tab= param) so back
        // returns to the tab the user drilled in from.
        state: { from: location.pathname + location.search },
      }),
    [navigate, paymentsBase, location.pathname, location.search],
  );
  const handleClosePaymentDetail = useCallback(() => {
    const from = (location.state as { from?: string } | null)?.from;
    // Payments are only listed on the Payment history tab, so that's the
    // fallback when there's no recorded origin (deep link / reload).
    navigate(from && !from.startsWith(`${paymentsBase}/`) ? from : `${paymentsBase}?tab=history`);
  }, [navigate, paymentsBase, location.state]);

  // Effect on the invoices when a payment posts: outstanding balance
  // drops by the applied amount; fully settled → Paid in Full,
  // partially settled → Partially Paid. A payment against a Pending
  // Approval invoice auto-approves it in the same step (7/16/26): the
  // approver shouldn't have to approve first and then pay, so the
  // action history records the implicit approval before the settle.
  // opts.via 'credit': a FULL credit memo zeroes the balance without
  // cash, so the invoice lands on 'Settled', not 'Paid in Full'
  // (taxonomy 7/17/26, wired 7/21/26).
  const handleSettleInvoices = useCallback((allocations: InvoiceAllocation[], opts?: { via?: 'credit' }) => {
    const byId = new Map(allocations.map((a) => [a.invoiceId, a.applied]));
    const approveEntry = { action: 'approve', reason: 'Approved via payment', by: 'Ahtisham Ahmad', at: new Date().toISOString() };
    setInvoices((prev) =>
      prev.map((inv) => {
        const applied = byId.get(inv.id);
        if (!applied) return inv;
        const wasPending = inv.status === 'Pending Approval';
        const outstanding = Math.max(0, Math.round((inv.outstandingBalance - applied) * 100) / 100);
        // Pre-invoices settle through prepayments, so they carry the
        // prepaid lifecycle (Partially Prepaid → Prepaid). Receiving later
        // converts them to PO invoices with the paid lifecycle.
        const isPre = inv.type === 'Pre-Invoice';
        // A credit memo is NOT a payment (user 10/1, overriding BA 9/28's
        // Partially-Paid call): a partial credit only reduces the payable,
        // the payment status stays exactly where it was — and the journey
        // timeline no longer reads credit coverage as "Partially Paid", so
        // the two agree again. Only a credit that zeroes the balance moves
        // the invoice, and it moves to Settled, never a paid state.
        const viaCredit = opts?.via === 'credit';
        return {
          ...inv,
          outstandingBalance: outstanding,
          creditedAmount: viaCredit
            ? Math.round(((inv.creditedAmount ?? 0) + (inv.outstandingBalance - outstanding)) * 100) / 100
            : inv.creditedAmount,
          // A credit that zeroes a pre-invoice settles it too (user 10/9):
          // no cash moved, so it reads Settled like any inventory invoice,
          // never Prepaid.
          status: outstanding <= 0.005
            ? (viaCredit ? 'Settled' : isPre ? 'Prepaid' : 'Paid in Full')
            : viaCredit
              ? inv.status
              : (isPre ? 'Partially Prepaid' : 'Partially Paid'),
          // Credits never approve: the July 16 approve-via-payment rule
          // is about paying, not crediting.
          actionHistory: wasPending && !viaCredit ? [...(inv.actionHistory ?? []), approveEntry] : inv.actionHistory,
          // A pre-invoice posts when it is first paid, so it takes its rate
          // then (Currency & Exchange Rates, spec 4.4); later payments keep it.
          ...(isPre && !viaCredit && !inv.exchangeRate ? stampRate(inv.currency, localTodayIso()) : {}),
        };
      }),
    );
  }, []);

  // Scheduled payments settle nothing yet, but recording one against a
  // Pending Approval invoice still approves it: the invoice moves to
  // Approved (awaiting payment) and waits for the payment date.
  const approveViaPayment = useCallback((invoiceIds: string[]) => {
    if (invoiceIds.length === 0) return;
    const approveEntry = { action: 'approve', reason: 'Approved via payment', by: 'Ahtisham Ahmad', at: new Date().toISOString() };
    setInvoices((prev) =>
      prev.map((inv) =>
        invoiceIds.includes(inv.id) && inv.status === 'Pending Approval'
          ? { ...inv, status: 'Approved', actionHistory: [...(inv.actionHistory ?? []), approveEntry] }
          : inv,
      ),
    );
  }, []);

  // ── Credit memos (9/22/26 review response) ────────────────────────
  // Real records in App state: they persist across navigation, settle
  // the invoice through the same handler payments use (via 'credit', so
  // a partial credit never reads as "paid"), and open a real page at
  // /credit-memos/:creditMemoNumber.
  const handleAddCreditMemo = useCallback((invoiceId: string, memo: CreditMemo) => {
    setCreditMemos((prev) => [memo, ...prev]);
    handleSettleInvoices([{ invoiceId, applied: memo.amount }], { via: 'credit' });
  }, [handleSettleInvoices]);

  const selectedCreditMemo = useMemo(() => {
    if (!params.creditMemoNumber) return null;
    const decoded = decodeURIComponent(params.creditMemoNumber);
    return creditMemos.find((m) => m.creditMemoNumber === decoded) ?? null;
  }, [params.creditMemoNumber, creditMemos]);
  const handleViewCreditMemo = useCallback(
    (creditMemoNumber: string) =>
      navigate(`/credit-memos/${encodeURIComponent(creditMemoNumber)}`, {
        state: { from: location.pathname + location.search },
      }),
    [navigate, location.pathname, location.search],
  );
  const handleCloseCreditMemo = useCallback(() => {
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from && !from.startsWith('/credit-memos') ? from : invoicesBase);
  }, [navigate, location.state, invoicesBase]);

  // Payment reversal lifted to App state so EVERYTHING reads it: the
  // reversed record retires (drops out of the reverse dropdown), the
  // invoice's outstanding balance restores, and its status walks back —
  // so the listing and the Record Payment flow show post-reversal
  // numbers (feedback 7/15/26).
  //
  // Payment-centric since 9/22/26 (review response, GPT C09): reversing
  // a payment restores EVERY invoice it covered (per the persisted
  // per-invoice split), returns consumed vendor credit to its source
  // prepayments, and stamps the action history — never just the invoice
  // the reversal was started from. Records without the persisted split
  // (seed synthetic rows) keep the single-invoice fallback.
  // Void from the payment page (user 10/22/26), behind the invoice Cancel
  // dialog: the same record change the Payment history void makes.
  const handleVoidPayment = useCallback((paymentId: string, _reason: string) => {
    setPayments((prev) =>
      prev.map((p) => (p.id === paymentId && p.status !== 'Cancelled' ? { ...p, status: 'Cancelled', appliedAmount: 0, unappliedAmount: 0 } : p)),
    );
  }, []);

  // Mark as paid from the payment detail page — the listing's handler
  // verbatim: the scheduled payment flips to Paid, its planned
  // application posts, and the applied invoices settle now.
  const handleMarkPaymentPaid = useCallback((paymentId: string) => {
    const target = payments.find((p) => p.id === paymentId && p.status === 'Scheduled');
    if (!target) return;
    setPayments((prev) =>
      prev.map((p) =>
        p.id === paymentId
          ? { ...p, status: 'Paid', wasScheduled: true, appliedAmount: (p.appliedInvoices ?? []).reduce((s, a) => s + a.amount, 0) }
          : p,
      ),
    );
    const allocations = (target.appliedInvoices ?? []).flatMap((a) => {
      const inv = invoices.find((i) => i.invoiceNumber === a.invoiceNumber);
      return inv ? [{ invoiceId: inv.id, applied: a.amount }] : [];
    });
    if (allocations.length > 0) handleSettleInvoices(allocations);
    toast.success('Payment marked as paid', { description: 'Applied invoices settled and balances updated.' });
  }, [payments, invoices, handleSettleInvoices]);

  const handleReversePayment = useCallback((args: { invoiceId?: string; paymentReference: string; amount?: number; reason?: string }) => {
    const { invoiceId, paymentReference, amount, reason } = args;
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const record = payments.find((p) => p.paymentNumber === paymentReference);

    // 1. Retire the payment; return its consumed credit to the source
    //    advances (unapplied climbs back, status walks back).
    setPayments((prev) =>
      prev.map((p) => {
        if (p.paymentNumber === paymentReference) return { ...p, status: 'Reversed', appliedAmount: 0 };
        const credit = record?.appliedCredits?.find(
          (c) => c.sourcePaymentId === p.id || c.sourcePaymentNumber === p.paymentNumber,
        );
        if (!credit) return p;
        const unapplied = round2(p.unappliedAmount + credit.amount);
        const applied = Math.max(0, round2(p.appliedAmount - credit.amount));
        return {
          ...p,
          unappliedAmount: unapplied,
          appliedAmount: applied,
          status: applied <= 0.004 ? 'Unapplied' : 'Partially Applied',
        };
      }),
    );

    // 2. Restore every invoice the payment covered. The persisted split
    //    carries cash + credit per invoice; older records fall back to
    //    their cash allocations; synthetic rows to the single invoice.
    const restores: { invoiceNumber?: string; invoiceId?: string; amount: number }[] = record
      ? record.type === 'Prepayment' && record.preInvoiceId
        ? [{ invoiceNumber: record.preInvoiceId, invoiceId: record.preInvoiceId, amount: record.amount }]
        : (record.perInvoiceSplit && record.perInvoiceSplit.length > 0
            ? record.perInvoiceSplit.map((s) => ({ invoiceNumber: s.invoiceNumber, amount: round2(s.cash + s.credit) }))
            : record.appliedInvoices.map((a) => ({ invoiceNumber: a.invoiceNumber, amount: a.amount })))
      : invoiceId
        ? [{ invoiceId, amount: amount ?? 0 }]
        : [];
    if (restores.length === 0) return;
    const reversalEntry = {
      action: 'reversePayment',
      reason: reason?.trim() ? `${paymentReference} reversed: ${reason}` : `Payment ${paymentReference} reversed`,
      by: 'Ahtisham Ahmad',
      at: new Date().toISOString(),
    };
    setInvoices((prev) =>
      prev.map((inv) => {
        const rest = restores.find(
          (r) => (r.invoiceNumber && r.invoiceNumber === inv.invoiceNumber) || (r.invoiceId && r.invoiceId === inv.id),
        );
        if (!rest || rest.amount <= 0.004) return inv;
        // Never above what's owed after credits (a credit stays applied).
        const outstanding = Math.min(round2(inv.amount - (inv.creditedAmount ?? 0)), round2(inv.outstandingBalance + rest.amount));
        const isPre = inv.type === 'Pre-Invoice';
        // Cash left after the reversal (Mahreen 10/10): a remaining credit
        // memo is not a payment, so no cash means back to Approved (or
        // still on hold), never Partially Paid.
        const cashLeft = cashPaidOn({ ...inv, outstandingBalance: outstanding });
        const fullyRestored = cashLeft <= 0.004;
        return {
          ...inv,
          outstandingBalance: outstanding,
          status: fullyRestored ? 'Approved' : (isPre ? 'Partially Prepaid' : 'Partially Paid'),
          actionHistory: [...(inv.actionHistory ?? []), reversalEntry],
        };
      }),
    );
  }, [payments]);

  // Draw down on-account prepayment records consumed in a pay run
  // (feedback 7/22/26): each selected advance's unapplied balance drops
  // by the amount applied, its applied list grows, and its status walks
  // Unapplied → Partially applied → Fully applied.
  const handlePrepayConsumption = useCallback((consumption: PrepaymentConsumption[]) => {
    if (!consumption || consumption.length === 0) return;
    // Sum draws per record in case one advance covered several invoices.
    const byId = new Map<string, { amount: number; invoiceNumbers: string[]; invoiceDraws: { invoiceNumber: string; amount: number }[] }>();
    consumption.forEach((c) => {
      const cur = byId.get(c.paymentId) ?? { amount: 0, invoiceNumbers: [], invoiceDraws: [] };
      cur.amount = Math.round((cur.amount + c.amount) * 100) / 100;
      cur.invoiceNumbers = [...cur.invoiceNumbers, ...c.invoiceNumbers];
      if (c.invoiceDraws) cur.invoiceDraws = [...cur.invoiceDraws, ...c.invoiceDraws];
      byId.set(c.paymentId, cur);
    });
    setPayments((prev) =>
      prev.map((p) => {
        const draw = byId.get(p.id);
        if (!draw) return p;
        const applied = Math.round((p.appliedAmount + draw.amount) * 100) / 100;
        const unapplied = Math.max(0, Math.round((p.unappliedAmount - draw.amount) * 100) / 100);
        // Real per-invoice dollars when the producer attributed them
        // (9/22/26 review response, GPT RR12): the advance's own page
        // then shows Applied $X, never a stale "Unapplied" full balance.
        const newlyApplied = draw.invoiceDraws.length > 0
          ? draw.invoiceDraws
          : draw.invoiceNumbers.map((invoiceNumber) => ({ invoiceNumber, amount: 0 }));
        return {
          ...p,
          appliedAmount: applied,
          unappliedAmount: unapplied,
          appliedInvoices: [...p.appliedInvoices, ...newlyApplied],
          // Status is the application axis for a prepayment record.
          status: unapplied <= 0.004 ? 'Fully Applied' : 'Partially Applied',
        };
      }),
    );
  }, []);

  // ── Payment runs (payment-run-flow.md, 7/29/26) ───────────────────
  // Long-lived batch runs living at /payments-v2/runs/:runId. The hook
  // owns the run objects and every lifecycle mutation; Execute posts
  // payments and settles invoices through the same handlers the single
  // payment flow uses.
  const runsApi = usePaymentRuns({
    invoices,
    payments,
    setPayments,
    settleInvoices: handleSettleInvoices,
    consumePrepayments: handlePrepayConsumption,
  });
  const isRunRoute = location.pathname.startsWith('/payments-v2/runs');
  // Set while intentionally closing a run (handleCloseRun): deleting the
  // draft nulls selectedRun in a render where the location is still the
  // run route, which would otherwise trip the deep-link fallback effect
  // below and hijack the close navigation to ?tab=runs (user 9/25).
  const closingRunRef = useRef(false);
  const selectedRun = useMemo(() => {
    if (!isRunRoute || !params.runId) return null;
    const decoded = decodeURIComponent(params.runId);
    return runsApi.runs.find((r) => r.id === decoded) ?? null;
  }, [isRunRoute, params.runId, runsApi.runs]);

  // Start a run: mint the Draft first, then land on its screen, so the
  // route always points at a real run (no effect-created drafts). The
  // mint is provisional: closing the screen before Continue discards it
  // (handleCloseRun), so abandoned opens never litter the runs tab.
  // The run route carries the originating tab's query along (?tab=...),
  // so the listing behind the overlay doesn't snap to another tab, and
  // remembers the exact origin URL so close returns where the flow
  // started (feedback 8/4/26).
  const handleStartRun = useCallback(
    (seedInvoiceIds?: string[]) => {
      const run = runsApi.createRun(seedInvoiceIds);
      navigate(`/payments-v2/runs/${encodeURIComponent(run.id)}${location.search}`, {
        state: { from: location.pathname + location.search },
      });
    },
    [runsApi, navigate, location.pathname, location.search],
  );
  // There is NO draft state (feedback 8/5/26): closing the authoring
  // modal discards the run entirely, nothing is ever saved as a draft.
  // The one exception is a changes-requested run reopened for resolve-
  // and-resubmit: closing without resubmitting returns it, untouched.
  const handleCloseRun = useCallback(() => {
    // Guard the deep-link fallback effect: deleting the draft nulls
    // selectedRun before the location leaves the run route, so mark this
    // as an intentional close (user 9/25).
    closingRunRef.current = true;
    if (selectedRun && selectedRun.status === 'Draft') {
      if (selectedRun.changeRequest && !selectedRun.changeRequest.resolvedAt) {
        runsApi.updateRun(selectedRun.id, { status: 'Changes Requested' });
      } else if (selectedRun.submittedAt) {
        // Withdrawn from Pending approval (8/5/26): closing without
        // resubmitting restores the status untouched.
        runsApi.updateRun(selectedRun.id, { status: 'Pending Approval' });
      } else {
        runsApi.deleteRun(selectedRun.id);
      }
    }
    // Return to the screen the flow started from; runs tab as fallback
    // (deep links, stale state).
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from && from.startsWith('/payments-v2') && !from.startsWith('/payments-v2/runs') ? from : '/payments-v2?tab=runs');
  }, [selectedRun, runsApi, navigate, location.state]);
  const handleOpenRun = useCallback(
    (runId: string) =>
      navigate(`/payments-v2/runs/${encodeURIComponent(runId)}${location.search}`, {
        state: { from: location.pathname + location.search },
      }),
    [navigate, location.pathname, location.search],
  );
  // Approve / reject straight from the runs listing (8/4/26) — same
  // mutations the detail page's heads-up modals fire.
  const handleApproveRunFromList = useCallback(
    (runId: string) => {
      runsApi.approveRun(runId, 'Ahtisham Ahmad');
      toast.success('Run approved', { description: 'Every invoice in the run is clear to pay. Execute when ready.' });
    },
    [runsApi],
  );
  const handleHoldRun = useCallback(
    (runId: string, reason: string) => {
      runsApi.holdRun(runId, reason, 'Ahtisham Ahmad');
      toast.success('Run placed on hold', { description: 'Approve and execute stay locked until the hold is released.' });
    },
    [runsApi],
  );
  const handleReleaseHold = useCallback(
    (runId: string, release: ReleaseHoldResult) => {
      // Recorded like an invoice release (user 10/22/26).
      runsApi.releaseHold(runId, { notes: release.notes, notifiedRecipientIds: release.recipientIds, attachments: release.attachments });
      const names = release.recipientNames;
      toast.success('Hold released', {
        description: names.length > 0
          ? `The run continues from where it paused. Release notification sent to ${names.slice(0, 2).join(', ')}${names.length > 2 ? ` +${names.length - 2} more` : ''}.`
          : 'The run continues from where it paused.',
      });
    },
    [runsApi],
  );
  const handleCancelRun = useCallback(
    (runId: string, reason: string) => {
      runsApi.cancelRun(runId, reason, 'Ahtisham Ahmad');
      toast.success('Run cancelled', { description: 'The invoices returned to the payable pool. Nothing was posted.' });
    },
    [runsApi],
  );
  // Bare /payments-v2/runs and unknown run ids fall back to the tab
  // silently, no toast (feedback 8/4/26: refreshing a run URL toasted on
  // every load since runs are session state).
  useEffect(() => {
    // Off the run route: nothing to redirect, and clear any close guard.
    if (!isRunRoute) { closingRunRef.current = false; return; }
    if (selectedRun) return;
    // An intentional close nulled the run while the location is still the
    // run route (user 9/25): let handleCloseRun's own navigation stand.
    if (closingRunRef.current) { closingRunRef.current = false; return; }
    navigate('/payments-v2?tab=runs', { replace: true });
  }, [isRunRoute, selectedRun, navigate]);

  // "Add Payment" from an invoice → open the Record Payment flow as an overlay
  // on the current (invoice) screen. No navigation until a payment is recorded.
  const handlePayInvoices = useCallback((invoiceIds: string[], origin: 'detail' | 'listing' = 'detail') => {
    if (invoiceIds.length === 0) return;
    setInvoiceFlow({ mode: 'pay', paySelection: invoiceIds, origin });
  }, []);

  // "Add prepayment" from a pre-invoice → open the Record Prepayment flow as an
  // overlay, seeded with the vendor + pre-invoice (jumps to step 2). No nav.
  const handleAddPrepayment = useCallback((vendor: string, preInvoiceId?: string, origin: 'detail' | 'listing' = 'detail') => {
    if (!vendor) return;
    setInvoiceFlow({ mode: 'prepay', prepayPrefill: { vendor, preInvoiceId }, origin });
  }, []);

  // Completion of the invoice-initiated flow: record the payment(s), settle the
  // invoices (posted only), then land on the new payment's detail page. Drafts
  // and closes keep the user on the invoice they launched from.
  const handleInvoiceFlowComplete = useCallback(
    (records: Payment[], allocations: InvoiceAllocation[], asDraft: boolean, prepayConsumption?: PrepaymentConsumption[]) => {
      setPayments((prev) => [...records, ...prev]);
      // Any pending invoice in the pay selection approves via the payment,
      // even a scheduled one that settles nothing yet (7/16/26). Settle
      // runs after, so a posted payment walks Pending → Approved → Paid.
      const pendingTargets = (invoiceFlow?.paySelection ?? []).filter(
        (id) => invoices.find((i) => i.id === id)?.status === 'Pending Approval',
      );
      if (!asDraft && pendingTargets.length > 0) approveViaPayment(pendingTargets);
      if (!asDraft && allocations.length > 0) handleSettleInvoices(allocations);
      if (!asDraft && prepayConsumption) handlePrepayConsumption(prepayConsumption);
      const noun = records[0]?.type === 'Prepayment' ? 'prepayment' : 'payment';
      toast.success(
        asDraft
          ? `Saved ${records.length} draft${records.length === 1 ? '' : 's'}`
          : `Recorded ${records.length} ${noun}${records.length === 1 ? '' : 's'}`,
        asDraft
          ? { description: 'No GL impact until it posts.' }
          : pendingTargets.length > 0
            ? { description: 'Invoice approved via payment.' }
            : undefined,
      );
      // Landing rules (design feedback 7/8/26): from the invoice detail
      // page the user stays there and watches the status update; from the
      // invoice listing they land on the paid invoice's detail page.
      const origin = invoiceFlow?.origin ?? 'detail';
      const firstInvoiceId = invoiceFlow?.paySelection?.[0];
      // Drafts close the wizard immediately; recorded payments stay on
      // the flow's success step, where Print check and Download
      // remittance advice live (feedback 7/20/26) — the flow closes
      // itself on Done, same as the Payments screen path.
      if (asDraft) setInvoiceFlow(null);
      if (!asDraft && records[0] && origin === 'listing') {
        const inv = invoices.find((i) => i.id === firstInvoiceId);
        if (inv) navigate(`${invoicesBase}/${encodeURIComponent(inv.invoiceNumber)}`);
      }
    },
    [handleSettleInvoices, approveViaPayment, handlePrepayConsumption, navigate, invoiceFlow, invoices, invoicesBase],
  );

  const handleInvoicesCreated = useCallback(
    (newInvoices: Invoice[]) => {
      // Reconciliation (Eli, 8/31/26): an invoice created against POs
      // with paid pre-invoices consumes those prepayments — the linked
      // pre-invoices close here, and only here.
      const reconciled = new Set(newInvoices.flatMap((inv) => inv.reconcilesPreInvoiceNumbers ?? []));
      setInvoices((prev) => [
        ...newInvoices,
        ...prev.map((inv) => {
          if (!reconciled.has(inv.invoiceNumber)) return inv;
          const into = newInvoices.find((n) => n.reconcilesPreInvoiceNumbers?.includes(inv.invoiceNumber));
          return {
            ...inv,
            status: 'Settled',
            outstandingBalance: 0,
            reconciledIntoInvoiceNumber: into?.invoiceNumber,
            actionHistory: [
              ...(inv.actionHistory ?? []),
              { action: 'reconciled', reason: `Reconciled into ${into?.invoiceNumber ?? 'the receiving invoice'}; the prepayment applied there`, by: 'Ahtisham Ahmad', at: new Date().toISOString() },
            ],
          };
        }),
      ]);
      // After Submit-for-approval, land the user on the new invoice's
      // detail screen. When the create flow generates a Pre-Invoice +
      // Standard pair, surface the parent Pre-Invoice (first in the
      // array) so the relationship is obvious from the deep link.
      if (newInvoices.length > 0) {
        navigate(`${invoicesBase}/${encodeURIComponent(newInvoices[0].invoiceNumber)}`);
      }
    },
    [navigate, invoicesBase],
  );

  // Import run commit: the batch lands in front (newest first, matching
  // invoice creation), imported payments join payment history. Rollback
  // removes exactly the records the run inserted, nothing else.
  const handleImportCommit = useCallback((newInvoices: Invoice[], newPayments: Payment[]) => {
    setInvoices((prev) => [...newInvoices, ...prev]);
    if (newPayments.length > 0) setPayments((prev) => [...newPayments, ...prev]);
  }, []);

  const handleImportRollback = useCallback((invoiceIds: string[], paymentIds: string[]) => {
    const inv = new Set(invoiceIds);
    const pay = new Set(paymentIds);
    setInvoices((prev) => prev.filter((i) => !inv.has(i.id)));
    setPayments((prev) => prev.filter((p) => !pay.has(p.id)));
  }, []);

  /**
   * Apply an invoice action across one-or-more invoice IDs.
   * Mutates status / flags and appends an actionHistory entry per PRD §1.7.4.
   * No-op for invoices whose current status makes the action ineligible.
   */
  const applyInvoiceAction = useCallback(
    (
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
    ) => {
      const at = new Date().toISOString();
      const by = 'Ahtisham Ahmad';

      // PO quantity give-back (VI-02): a cancel returns the invoice's
      // billed quantities to its PO/GRNs; an uncancel re-bills them. Done
      // as a one-shot side effect off the live records (not inside the
      // setInvoices reducer, which can re-run) so the math never drifts.
      if (action === 'cancel' || action === 'uncancel') {
        for (const id of invoiceIds) {
          const inv = invoicesRef.current.find((i) => i.id === id);
          if (!inv) continue;
          const refs = billedLineRefsFromSaved(inv);
          if (refs.length === 0) continue;
          if (action === 'cancel' && inv.status !== 'Cancelled') releaseInvoiceFromVendorDocs(inv.vendor, refs);
          if (action === 'uncancel' && inv.status === 'Cancelled') applyInvoiceToVendorDocs(inv.vendor, refs);
        }
      }

      setInvoices((prev) =>
        prev.map((inv) => {
          if (!invoiceIds.includes(inv.id)) return inv;
          let nextStatus = inv.status;
          let nextHeld = inv.is_payment_held;
          let nextException = inv.is_exception;
          let nextArchived = inv.isArchived;
          let nextStatusBeforeCancel = inv.statusBeforeCancel;

          switch (action) {
            case 'submit':
              // Draft submission AND the rejected fix-and-resubmit path both
              // land in the approval queue (lifecycle specs 7/15/26).
              if (inv.status === 'Draft' || inv.status === 'Rejected') nextStatus = 'Pending Approval';
              break;
            case 'approve':
              // Approving a HELD invoice makes it Approved with the hold
              // still open (ERP-8796): hold is a flag, never a status.
              if (inv.status === 'Pending Approval') nextStatus = 'Approved';
              break;
            case 'reject':
              // Reject is terminal — Draft was retired, so a rejected
              // invoice lands in the "Rejected" state (archivable).
              if (inv.status === 'Pending Approval') nextStatus = 'Rejected';
              break;
            case 'flagException':
              if (inv.status === 'Pending Approval') {
                nextStatus = 'Exception';
                nextException = true;
              }
              break;
            case 'resolve':
              // Clearing an exception returns the invoice to the approval
              // queue. The flag clears but BOTH history entries survive
              // (9/4/26 Eli, BB-16/17: "you're never really turning the
              // exception off, you're just resolving it").
              if (inv.status === 'Exception') {
                nextStatus = 'Pending Approval';
                nextException = false;
              }
              break;
            case 'releaseHold':
              // Release clears the flag only; the status never moved
              // while the hold was open (ERP-8796).
              if (inv.is_payment_held) nextHeld = false;
              break;
            case 'cancel':
              if (inv.status !== 'Cancelled') {
                // Remember where it was so Uncancel can rewind to the exact
                // state (user 10/5), not a blanket Pending Approval.
                nextStatusBeforeCancel = inv.status;
                nextStatus = 'Cancelled';
              }
              break;
            case 'uncancel':
              // Uncancel ALWAYS returns to Pending Approval (Mahreen 10/10,
              // supersedes 10/5's rewind): it must be approved again.
              if (inv.status === 'Cancelled') {
                nextStatus = 'Pending Approval';
                nextStatusBeforeCancel = undefined;
              }
              break;
            case 'archive':
              // Archive persists on the record (9/22/26, GPT F17) —
              // never a page-local display override that navigation eats.
              nextArchived = true;
              break;
            case 'restore':
              // Restore returns the invoice to the state it was archived
              // from (user 10/9, supersedes 10/1's Pending Approval): archive
              // is a flag over the status, so a cancelled invoice comes back
              // Cancelled and the user decides from there (e.g. Uncancel).
              nextArchived = false;
              break;
            case 'paymentHold':
              // A hold is a flag that sits beside any status (ERP-8796):
              // placing it never changes the Invoice Status.
              nextHeld = true;
              break;
          }

          // Ineligible row — skip silently.
          if (
            nextStatus === inv.status &&
            nextHeld === inv.is_payment_held &&
            nextException === inv.is_exception &&
            nextArchived === inv.isArchived &&
            nextStatusBeforeCancel === inv.statusBeforeCancel
          ) {
            return inv;
          }

          const entry = { action, reason, by, at, notifiedRecipientIds, attachments };
          return {
            ...inv,
            status: nextStatus,
            is_payment_held: nextHeld,
            is_exception: nextException,
            isArchived: nextArchived,
            statusBeforeCancel: nextStatusBeforeCancel,
            // Every action touches the audit stamp (VI-42): approve, reject,
            // hold, cancel… all move Last Updated By / On to the actor + now.
            updatedBy: by,
            updatedDate: localTodayIso(),
            actionHistory: [...(inv.actionHistory ?? []), entry],
          };
        }),
      );
    },
    [],
  );

  return (
    <SafeMuiThemeProvider>
      {/* AR wording layer — Customer PAYMENTS only now: Customer
          Invoicing is AR-native (own data + real copy, 7/22/26) and
          must not be text-rewritten. */}
      <TerminologySwap active={currentScreen === 'customer-payments'} />
      <Layout activeView={navView} onViewChange={setCurrentScreen}>
        {currentScreen === 'overview' && (
          <OverviewScreen onNavigate={setCurrentScreen} />
        )}
        {currentScreen === 'dashboard' && (
          <AccountingDashboardScreen
            invoices={invoices}
            payments={payments}
            onNavigate={setCurrentScreen}
          />
        )}
        {currentScreen === 'invoices' && !selectedInvoiceId && !selectedCreditMemo && (
          <InvoiceListScreen
            key={currentScreen}
            invoices={invoices}
            payments={payments}
            onCreateInvoice={() => setShowCreateInvoice(true)}
            onImportInvoices={() => setShowImportInvoices(true)}
            onViewInvoice={handleViewInvoice}
            applyInvoiceAction={applyInvoiceAction}
            onPayInvoices={(ids) => handlePayInvoices(ids, 'listing')}
            onAddPrepayment={(vendor, preInvoiceId) => handleAddPrepayment(vendor, preInvoiceId, 'listing')}
            onEditResubmit={(inv, reason, notifyIds) => { setResubmitInvoice(inv); setResubmitReason(reason); setResubmitNotifyIds(notifyIds); }}
            onReversePayment={handleReversePayment}
            runs={runsApi.runs}
            module={screenModule}
          />
        )}
        {currentScreen === 'invoices' && selectedInvoiceId && (
          <InvoiceDetailScreen
            key={currentScreen}
            invoiceId={selectedInvoiceId}
            onClose={handleCloseDetail}
            invoices={invoices}
            payments={payments}
            applyInvoiceAction={applyInvoiceAction}
            onSettleInvoices={handleSettleInvoices}
            onPayInvoices={handlePayInvoices}
            onAddPrepayment={handleAddPrepayment}
            onEditResubmit={(inv, reason, notifyIds) => { setResubmitInvoice(inv); setResubmitReason(reason); setResubmitNotifyIds(notifyIds); }}
            onReversePayment={handleReversePayment}
            creditMemos={creditMemos}
            onAddCreditMemo={handleAddCreditMemo}
            onViewCreditMemo={handleViewCreditMemo}
            runs={runsApi.runs}
            onViewRun={(runId) => navigate(`/payments-v2/runs/${encodeURIComponent(runId)}`)}
            notes={invoiceNotes[selectedInvoiceId] ?? EMPTY_NOTES}
            onAddNote={handleAddNote}
            onUpdateNote={handleUpdateNote}
            onDeleteNote={handleDeleteNote}
          />
        )}
        {/* Credit memo detail — a real page for a real record (9/22/26
            review response, GPT F16): the memo number finally opens
            something. */}
        {currentScreen === 'invoices' && !selectedInvoiceId && selectedCreditMemo && (
          <CreditMemoDetailScreen
            memo={selectedCreditMemo}
            onClose={handleCloseCreditMemo}
            onViewInvoice={(invoiceNumber) =>
              navigate(`${invoicesBase}/${encodeURIComponent(invoiceNumber)}`, {
                state: { from: location.pathname + location.search },
              })
            }
          />
        )}

        {/* ── Customer Invoicing (AR) — spec-native listing + detail. ── */}
        {currentScreen === 'customer-invoices' && !selectedCustomerInvoice && (
          <CustomerInvoiceListScreen
            invoices={ar.customerInvoices}
            deposits={ar.customerDeposits}
            customers={ar.customers}
            onCreateInvoice={(entry) => setCustomerCreateEntry(entry ?? {})}
            onImportInvoices={() => setShowImportInvoices(true)}
            onViewInvoice={(id) => handleCustomerRowAction('view', id)}
            onRowAction={(actionId, invoiceId) => handleCustomerRowAction(actionId, invoiceId)}
            onBulkAction={(actionId, invoiceIds) => {
              if (invoiceIds.length === 0) return;
              if (actionId === 'approve') {
                // FAD 11/2: open exceptions and duplicate shipment lines stay unapproved.
                const withException = invoiceIds.filter((id) => ar.customerInvoices.find((i) => i.id === id)?.exception);
                const eligible = invoiceIds.filter((id) => !withException.includes(id));
                if (withException.length > 0) {
                  toast.error(`${withException.length} with an open exception skipped`, { description: 'Resolve the exception on each, then approve.' });
                }
                if (eligible.length === 0) return;
                const { blocked } = ar.applyCustomerInvoiceAction(eligible, 'approve', '');
                const approvedCount = eligible.length - blocked.length;
                if (approvedCount === 0) return;
                toast.success(`${approvedCount} ${approvedCount === 1 ? 'invoice' : 'invoices'} approved`, {
                  description: 'Posting invoices posted to the general ledger. Advance invoices post nothing.',
                });
                return;
              }
              if (invoiceIds.length === 1) {
                handleCustomerRowAction(actionId, invoiceIds[0]);
                return;
              }
              // Reasons and recipients are per invoice (BR-019, PRD §10.3).
              toast.info('Do this one invoice at a time', {
                description: actionId === 'send'
                  ? 'Each invoice goes to its own customer contact. Open them one by one to send.'
                  : 'Each invoice needs its own reason. Open them one by one.',
              });
            }}
          />
        )}
        {currentScreen === 'customer-invoices' && selectedCustomerInvoice && (
          <CustomerInvoiceDetailScreen
            key={selectedCustomerInvoice.id}
            invoice={selectedCustomerInvoice}
            allInvoices={ar.customerInvoices}
            deposits={ar.customerDeposits}
            customers={ar.customers}
            onClose={() => {
              const from = (location.state as { from?: string } | null)?.from;
              navigate(from && !from.startsWith('/customer-invoices/') ? from : '/customer-invoices');
            }}
            applyAction={(ids, action, reason, notifyIds) => ar.applyCustomerInvoiceAction(ids, action, reason, notifyIds)}
            onRevise={(invoiceId, reason, notifyIds) => {
              // FAD 11/2 Revise: reverse the posted version, open the new one for editing.
              const next = ar.reviseCustomerInvoice(invoiceId, reason, notifyIds);
              if (!next) return;
              toast.success(`${next.invoiceNumber} opened for editing`, {
                description: 'The posted version was reversed and stays in history as Revised.',
              });
              navigate(`/customer-invoices/${encodeURIComponent(next.invoiceNumber)}`);
              setCustomerCreateEntry({ editInvoiceId: next.id });
            }}
            onRefundPrepayment={(invoiceId, payload) => ar.refundPrepayment(invoiceId, payload)}
            onAction={(actionId, invoiceId) => handleCustomerRowAction(actionId, invoiceId)}
            onDeleteDraft={(invoiceId) => {
              const inv = ar.customerInvoices.find((i) => i.id === invoiceId);
              ar.deleteCustomerInvoice(invoiceId);
              navigate('/customer-invoices');
              if (inv) toast.success(`Draft ${inv.invoiceNumber} deleted`);
            }}
          />
        )}
        {currentScreen === 'prepayments' && <PrepaymentsScreen />}
        {/* The listing stays mounted on DRAFT run routes: the two-step
            authoring modal is an overlay shell (like the creation flows),
            so the table shows dimmed behind it. Non-draft runs render
            their full detail page INSTEAD of the listing (below), the
            same swap the payment detail page does. */}
        {(currentScreen === 'payments-v2' || currentScreen === 'customer-payments') && !selectedPayment &&
          !(isRunRoute && selectedRun && selectedRun.status !== 'Draft') && (
          <PaymentsScreen
            key={currentScreen}
            payments={payments}
            setPayments={setPayments}
            invoices={invoices}
            onSettleInvoices={handleSettleInvoices}
            onPrepayConsumption={handlePrepayConsumption}
            onViewPayment={handleViewPayment}
            onViewInvoice={handleViewInvoice}
            variant="workspace"
            module={screenModule}
            // Uncommitted setup drafts (minted for the route, deleted on
            // close) stay OFF the runs tab: no ghost row flashing behind
            // the overlay while the user is still deciding (8/4/26).
            runs={runsApi.runs.filter((r) => !(r.status === 'Draft' && r.stage === 'setup' && r.groups.length === 0))}
            onStartRun={handleStartRun}
            onOpenRun={handleOpenRun}
            onApproveRun={handleApproveRunFromList}
            onHoldRun={handleHoldRun}
            onReleaseHold={handleReleaseHold}
            onCancelRun={handleCancelRun}
            lockedInvoiceIds={runsApi.lockedInvoiceIds}
          />
        )}
        {(currentScreen === 'payments-v2' || currentScreen === 'customer-payments') && selectedPayment && !isRunRoute && (
          <PaymentDetailScreen
            key={currentScreen}
            payment={selectedPayment}
            onClose={handleClosePaymentDetail}
            ledger={ledger}
            invoices={invoices}
            onReversePayment={handleReversePayment}
            onVoidPayment={handleVoidPayment}
            onMarkPaid={ledger === 'ap' ? handleMarkPaymentPaid : undefined}
            // Notes share the invoice notes store, keyed per payment (user 10/22/26).
            notes={invoiceNotes[`payment:${selectedPayment.id}`] ?? EMPTY_NOTES}
            onAddNote={(text) => handleAddNote(`payment:${selectedPayment.id}`, text)}
            onUpdateNote={(noteId, text) => handleUpdateNote(`payment:${selectedPayment.id}`, noteId, text)}
            onDeleteNote={(noteId) => handleDeleteNote(`payment:${selectedPayment.id}`, noteId)}
          />
        )}
        {/* Draft runs: the two-step authoring modal over the listing. */}
        {currentScreen === 'payments-v2' && isRunRoute && selectedRun && selectedRun.status === 'Draft' && (
          <PaymentRunScreen
            key={selectedRun.id}
            run={selectedRun}
            invoices={invoices}
            payments={payments}
            runsApi={runsApi}
            onClose={handleCloseRun}
            onViewInvoice={handleViewInvoice}
            onViewPayment={handleViewPayment}
          />
        )}
        {/* Every other status: the payment run detail page, where the
            lifecycle continues (approve, execute, print & complete). */}
        {currentScreen === 'payments-v2' && isRunRoute && selectedRun && selectedRun.status !== 'Draft' && (
          <RunDetailScreen
            key={selectedRun.id}
            run={selectedRun}
            invoices={invoices}
            payments={payments}
            runsApi={runsApi}
            onClose={handleCloseRun}
            onViewPayment={handleViewPayment}
            onOpenRun={handleOpenRun}
            // Notes share the invoice notes store, keyed per run (user 10/22/26).
            notes={invoiceNotes[`run:${selectedRun.id}`] ?? EMPTY_NOTES}
            onAddNote={(text) => handleAddNote(`run:${selectedRun.id}`, text)}
            onUpdateNote={(noteId, text) => handleUpdateNote(`run:${selectedRun.id}`, noteId, text)}
            onDeleteNote={(noteId) => handleDeleteNote(`run:${selectedRun.id}`, noteId)}
          />
        )}
        {currentScreen === 'receiving' && <ReceivingDocumentsScreen />}

        {showCreateInvoice && (
          <InvoiceCreationFlow
            onClose={() => { setShowCreateInvoice(false); setCreateVendorLock(null); setCreateTypeLock(null); }}
            onInvoicesCreated={handleInvoicesCreated}
            invoices={invoices}
            payments={payments}
            creditMemos={creditMemos}
            ledger={ledger}
            initialVendorName={createVendorLock ?? undefined}
            initialType={createTypeLock ?? undefined}
          />
        )}

        {/* Bulk import — the staged pipeline (upload, map, validate,
            commit); rows never write straight to the ledger. */}
        {showImportInvoices && (
          <ImportInvoicesModal
            invoices={invoices}
            onClose={() => setShowImportInvoices(false)}
            onCommit={handleImportCommit}
            onRollback={handleImportRollback}
          />
        )}

        {/* Customer invoice creation (PRD §3, §6 to §9): type picker →
            selection step → invoice form, or straight to the form for
            Ready to Invoice rows, deep links and Edit and Resubmit. */}
        {customerCreateEntry && (
          <CustomerInvoiceCreationFlow
            customers={ar.customers}
            invoices={ar.customerInvoices}
            deposits={ar.customerDeposits}
            entry={customerCreateEntry}
            onClose={() => setCustomerCreateEntry(null)}
            onSaved={({ invoice, mode, isEdit }) => {
              ar.saveCustomerInvoice(invoice, isEdit ? (mode === 'draft' ? 'edit' : 'resubmit') : 'create');
              // On-account deposits applied on the form land on the deposit records too.
              invoice.depositApplications.forEach(({ depositId, amount }) => {
                const dep = ar.customerDeposits.find((d) => d.id === depositId);
                if (dep && !dep.applications.some((a) => a.invoiceNumber === invoice.invoiceNumber)) {
                  ar.updateCustomerDeposit(depositId, {
                    applications: [...dep.applications, { invoiceNumber: invoice.invoiceNumber, amount, appliedOn: localTodayIso() }],
                  });
                }
              });
              setCustomerCreateEntry(null);
              const noun = invoice.docKind === 'Advance Invoice' ? 'Advance invoice' : 'Invoice';
              if (mode === 'draft') toast.success(`${invoice.invoiceNumber} saved as a draft`, { description: 'Nothing posts until it is approved.' });
              else if (mode === 'approve') toast.success(`${invoice.invoiceNumber} approved`, {
                description: invoice.docKind === 'Advance Invoice'
                  ? 'Nothing posts on approval. Send it to the customer next.'
                  : 'It posted to the general ledger. Send it to the customer next.',
              });
              else toast.success(`${noun} ${invoice.invoiceNumber} submitted for approval`, { description: 'The approver has been notified.' });
              navigate(`/customer-invoices/${encodeURIComponent(invoice.invoiceNumber)}`);
            }}
          />
        )}

        {/* ── Customer money actions (spec §6, §7) — send, record
            receipt/deposit, issue credit memo, convert pre-invoice. ── */}
        {customerModal?.kind === 'send' && customerModalInvoice && (
          <SendToCustomerModal
            invoice={customerModalInvoice}
            customer={ar.customers.find((c) => c.customerName === customerModalInvoice.customer)}
            onClose={() => setCustomerModal(null)}
            onSend={(payload, outcome) => {
              ar.sendToCustomer(customerModalInvoice.id, payload, outcome);
              if (outcome === 'failed') return;
              setCustomerModal(null);
              toast.success(
                `${customerModalInvoice.invoiceNumber} ${customerModalInvoice.sentAt ? 'sent again' : 'sent'} to ${payload.to.join(', ')}`,
              );
            }}
          />
        )}
        {customerModal?.kind === 'receipt' && customerModalInvoice && (
          <RecordReceiptModal
            invoice={customerModalInvoice}
            onClose={() => setCustomerModal(null)}
            onRecordReceipt={(payload) => {
              ar.recordReceipt(customerModalInvoice.id, payload);
              setCustomerModal(null);
              toast.success(`Payment recorded against ${customerModalInvoice.invoiceNumber}`, {
                description: payload.overpaymentToDeposit && payload.overpaymentToDeposit > 0
                  ? 'The overpayment is held as a customer deposit.'
                  : payload.markDisputed
                    ? 'The remaining balance is flagged as disputed.'
                    : undefined,
              });
            }}
            onRecordDeposit={(payload) => {
              ar.recordDeposit(customerModalInvoice.id, payload);
              setCustomerModal(null);
              toast.success(`Deposit recorded against ${customerModalInvoice.invoiceNumber}`, {
                description: 'Held as a customer deposit until the shipment invoice is raised.',
              });
            }}
          />
        )}
        {customerModal?.kind === 'creditMemo' && customerModalInvoice && (
          <IssueCreditMemoModal
            invoice={customerModalInvoice}
            allInvoices={ar.customerInvoices}
            customers={ar.customers}
            editCreditMemo={customerModal.editId ? ar.customerInvoices.find((i) => i.id === customerModal.editId) : undefined}
            onClose={() => setCustomerModal(null)}
            onSave={({ invoice: memo, mode, isEdit }) => {
              ar.saveCustomerInvoice(memo, isEdit ? (mode === 'draft' ? 'edit' : 'resubmit') : 'create');
              setCustomerModal(null);
              toast.success(
                mode === 'draft' ? `${memo.invoiceNumber} saved as a draft`
                  : mode === 'approve' ? `${memo.invoiceNumber} approved against ${customerModalInvoice.invoiceNumber}`
                    : `${memo.invoiceNumber} submitted for approval`,
                mode === 'approve'
                  ? { description: customerModalInvoice.docKind === 'Advance Invoice' ? 'No accounting entry. Send it to the customer next.' : 'A/R drops by the credit. Send it to the customer next.' }
                  : undefined,
              );
              navigate(`/customer-invoices/${encodeURIComponent(memo.invoiceNumber)}`);
            }}
          />
        )}

        {/* Edit and Resubmit — the creation modal opens directly (no type /
            vendor pickers), prefilled from the rejected invoice, with the
            rejection reason replayed in a banner. Submitting moves the
            ORIGINAL invoice back to Pending Approval instead of minting a
            duplicate (feedback 7/15/26). */}
        {resubmitInvoice && (() => {
          // The invoice and vendor mock datasets use different name and PO
          // numbering schemes, so exact lookups can miss — fall back to a
          // DETERMINISTIC vendor and map the invoice's POs positionally
          // onto that vendor's catalogue so the form always opens with the
          // full line items, as-is like creation (feedback 7/15/26).
          const isStandaloneResubmit = resubmitInvoice.type === 'Standalone';
          // The sheet opens the RECORD'S OWN vendor and data (9/22/26
          // review response, GPT F01 / Claude C06-D1): the old hash-picked
          // fallback vendor is dead — it opened Urban Industrial Group's
          // exception as Omega Corp with someone else's lines and totals.
          // Vendor facts come from the exact partner match or from the
          // invoice itself; lines come from the record when it carries
          // them, else from the vendor's own catalogue.
          const exact = mockVendors.find((v) => v.vendorName === resubmitInvoice.vendor);
          const vendor = exact ?? null;
          // Charges ride the resubmit too (GPT QC14, 9/30): a seeded
          // invoice's detail decomposes amount into the 7/3/1
          // tax/freight/additional split, but the form reopened with zero
          // charges — an untouched resubmit silently dropped ~11% of the
          // total. One decomposition now feeds the form AND the lines.
          const seedCharges: InvoiceCharges = resubmitInvoice.charges ?? (() => {
            const total = resubmitInvoice.amount;
            return {
              tax: Math.round(total * 0.07 * 100) / 100,
              freight: Math.round(total * 0.03 * 100) / 100,
              freightGlAccount: DEFAULT_FREIGHT_GL_ACCOUNT,
              additional: [{ label: 'Additional charges', amount: Math.round(total * 0.01 * 100) / 100, glAccount: DEFAULT_ADDITIONAL_CHARGE_GL_ACCOUNT }],
            };
          })();
          // The resolve sheet edits THE RECORD'S OWN LINES (user 9/22):
          // user-created records carry them on savedLineItems; seeds
          // derive the exact set the detail page renders (generateLines),
          // so what you fix is what you were looking at.
          const resolveLines = (resubmitInvoice.savedLineItems?.length ?? 0) > 0
            ? (resubmitInvoice.savedLineItems ?? [])
            : (() => {
                const total = resubmitInvoice.amount;
                const additional = seedCharges.additional.reduce((s, c) => s + c.amount, 0);
                const subtotal = Math.round((total - seedCharges.tax - seedCharges.freight - additional) * 100) / 100;
                return generateLines(resubmitInvoice, subtotal).map((l) => ({
                  sku: l.sku,
                  description: l.productName,
                  quantity: l.invoicedQty,
                  uom: l.uom,
                  unitPrice: l.unitPrice,
                  lineTotal: l.amount,
                  glAccount: l.glAccount,
                  // Source quantities ride along (Mahreen 9/29): the resolve
                  // form re-reads ordered/received instead of synthesizing
                  // them from the invoiced amount.
                  orderedQty: l.orderedQty,
                  receivedQty: l.receivedQty,
                }));
              })();
          const savedSelection: SelectedPOData[] = !isStandaloneResubmit && resolveLines.length > 0
            ? [(() => {
                const poNumber = resubmitInvoice.linkedPOs[0] ?? '1';
                // The resolve form re-reads the SAVED source quantities
                // (Mahreen 9/29 retest: it synthesized 41/41 from the
                // invoiced amount, so the 3-way match passed when it
                // should fail). PO items carry the ordered quantity and
                // pin the saved invoiced amount as the typed value; the
                // GRN slice carries the received quantity.
                const items = resolveLines.map((l, k) => ({
                  id: `resub-${k + 1}`,
                  sku: l.sku || `LINE-${k + 1}`,
                  description: l.description,
                  quantity: l.orderedQty ?? l.quantity,
                  uom: l.uom,
                  unitPrice: l.unitPrice,
                  totalPrice: l.lineTotal,
                  receivedQty: l.receivedQty ?? l.quantity,
                  customInvoiceQty: l.quantity,
                  poUnitPrice: l.poUnitPrice,
                }));
                const grnItems = resolveLines.map((l, k) => ({
                  ...items[k],
                  quantity: l.receivedQty ?? l.quantity,
                }));
                return {
                  vendorCode: vendor?.vendorCode ?? 'V-EXT',
                  vendorName: resubmitInvoice.vendor,
                  vendorCategory: vendor?.category ?? 'Vendor',
                  currency: resubmitInvoice.currency || vendor?.currency || 'USD',
                  paymentTerms: resubmitInvoice.paymentTerms ?? vendor?.paymentTerms ?? 'Net 30',
                  poNumber,
                  poDate: resubmitInvoice.invoiceDate,
                  poAmount: resubmitInvoice.amount,
                  poStatus: 'Received',
                  itemCount: items.length,
                  isPreInvoice: resubmitInvoice.type === 'Pre-Invoice',
                  relatedGRNs: resubmitInvoice.type === 'Pre-Invoice'
                    ? []
                    : [{
                        grnNumber: resubmitInvoice.linkedGRNs[0] ?? `REC-${poNumber}`,
                        // The saved trigger date IS the receiving date on
                        // the record (Mahreen 9/29: the resolve form
                        // showed today + invoice date instead of the
                        // saved Feb receiving), so the trigger dropdown
                        // reopens on it.
                        grnDate: resubmitInvoice.triggerDate || resubmitInvoice.invoiceDate,
                        receivedQty: grnItems.reduce((sq, i) => sq + i.quantity, 0),
                        poNumber,
                        status: 'Received',
                        items: grnItems,
                      }],
                  items,
                  selectedItemIds: items.map((i) => i.id),
                } as SelectedPOData;
              })()]
            : [];
          const sourcePOs = resubmitInvoice.linkedPOs.length > 0 ? resubmitInvoice.linkedPOs : ['1'];
          const selection: SelectedPOData[] = savedSelection.length > 0
            ? savedSelection
            : !isStandaloneResubmit && vendor && vendor.purchaseOrders.length > 0
            ? sourcePOs.map((poNumber, j) => {
                const po =
                  vendor.purchaseOrders.find((p) => p.poNumber === poNumber)
                  ?? vendor.purchaseOrders[j % vendor.purchaseOrders.length];
                return {
                  vendorCode: vendor.vendorCode,
                  vendorName: resubmitInvoice.vendor,
                  vendorCategory: vendor.category,
                  currency: vendor.currency,
                  paymentTerms: vendor.paymentTerms,
                  // The invoice's own PO number stays on display; the
                  // catalogue rows come from the matched vendor PO.
                  poNumber: resubmitInvoice.linkedPOs[j] ?? po.poNumber,
                  poDate: po.poDate,
                  poAmount: po.poAmount,
                  poStatus: po.status,
                  itemCount: po.itemCount,
                  isPreInvoice: resubmitInvoice.type === 'Pre-Invoice',
                  // A PO with no receipts on file would open the resubmit
                  // form with an empty line-item table, making a rejection
                  // about the lines unfixable — synthesize a full receipt
                  // from the PO's own items so the lines always render and
                  // stay editable (feedback 7/16/26).
                  relatedGRNs: resubmitInvoice.type === 'Pre-Invoice'
                    ? []
                    : (() => {
                        const grns = vendor.receivingDocuments.filter((g) => g.poNumber === po.poNumber);
                        if (grns.length > 0) return grns;
                        return [{
                          grnNumber: `REC-${po.poNumber}`,
                          grnDate: po.poDate,
                          receivedQty: po.items.reduce((s, i) => s + i.quantity, 0),
                          poNumber: po.poNumber,
                          status: 'Received',
                          items: po.items,
                        }];
                      })(),
                  items: po.items,
                  selectedItemIds: po.items.map((i) => i.id),
                };
              })
            : [];
          const resubmitVendor = isStandaloneResubmit
            ? {
                vendorId: vendor?.id ?? 'v-ext',
                vendorCode: vendor?.vendorCode ?? 'V-EXT',
                // The record's own vendor NAME always (9/22/26): the
                // partner match only enriches code/category facts.
                vendorName: resubmitInvoice.vendor,
                vendorCategory: vendor?.category ?? 'Vendor',
                currency: resubmitInvoice.currency || vendor?.currency || 'USD',
                paymentTerms: resubmitInvoice.paymentTerms ?? vendor?.paymentTerms ?? 'Net 30',
                imageUrl: vendor?.imageUrl,
              }
            : null;
          return (
            <CreateInvoiceScreen
              onClose={() => { setResubmitInvoice(null); setResubmitNotifyIds(undefined); }}
              invoiceType={isStandaloneResubmit ? 'standalone' : 'inventory'}
              // The flow split (9/4/26): resubmits assert the kind from the
              // invoice being fixed instead of relying on GRN inference.
              flowKind={isStandaloneResubmit ? null : resubmitInvoice.type === 'Pre-Invoice' ? 'pre' : 'post'}
              selectedPOsData={selection}
              standaloneVendor={resubmitVendor}
              liveInvoices={invoices}
              // The record's own term seeds the form (Mahreen 9/29): without
              // it the resolve form fell back to Net 30 and the trigger
              // flipped from receiving to invoice date. Seeds carry no
              // explicit term, so the DETAIL PAGE'S derivation fills in
              // (GPT QC14 retest 10/2: an untouched resolve rewrote the
              // displayed Full Advance term to Net 30) — but only when the
              // derived term's KIND fits the invoice (9/1/26 rules: pre =
              // Prepayment/Split, post = NET/Split); a mismatched seed
              // would gate the resubmit on the kind-conflict strip.
              initialPaymentTerm={resubmitInvoice.paymentTerms ?? (() => {
                const derived = presetForVendor(resubmitInvoice.vendor);
                const fits = resubmitInvoice.type === 'Pre-Invoice'
                  ? derived.category !== 'net'
                  : derived.category !== 'prepayment';
                return fits ? derived.name : undefined;
              })()}
              // Charges always populated (QC14): seeds get the same 7/3/1
              // decomposition the detail page shows, so the form seeds
              // freight/charges/tax and the round-trip total is exact.
              resubmitInvoice={{ ...resubmitInvoice, charges: seedCharges }}
              resubmitReason={resubmitReason}
              onResubmitRecordation={(p) => { resubmitRecordationRef.current = p; }}
              onInvoicesCreated={(created) => {
                const invoiceNumber = resubmitInvoice.invoiceNumber;
                // ONE merge contract for every edit path (GPT QC14, 9/30):
                // the submitted invoice's figures — lines, GL snapshot,
                // charges, dates, terms, linked docs — land back on the
                // stored record. Identity, status, flags and history stay
                // with the record; applyInvoiceAction owns transitions.
                const edited = created?.length === 1 ? created[0] : undefined;
                const mergeEditedInvoice = (inv: Invoice): Invoice =>
                  !edited
                    ? inv
                    : {
                        ...inv,
                        vendorInvoiceNumber: edited.vendorInvoiceNumber || inv.vendorInvoiceNumber,
                        invoiceDate: edited.invoiceDate || inv.invoiceDate,
                        dueDate: edited.dueDate || inv.dueDate,
                        triggerDate: edited.triggerDate ?? inv.triggerDate,
                        triggerEvent: edited.triggerEvent ?? inv.triggerEvent,
                        postingDate: edited.postingDate ?? inv.postingDate,
                        // Currency and the posting-date rate (Currency &
                        // Exchange Rates, spec 4.4): the edit re-takes the
                        // rate, so the saved figures move with it.
                        currency: edited.currency || inv.currency,
                        exchangeRate: edited.exchangeRate,
                        rateType: edited.rateType,
                        rateDate: edited.rateDate,
                        rateEdited: edited.rateEdited,
                        // A cleared description stays cleared (Mahreen 10/10).
                        description: edited.description ?? inv.description,
                        amount: edited.amount,
                        // The applied prepayment and any cash already paid
                        // survive the edit (VI-03): the outstanding balance
                        // moves by the SAME delta as the total, never back to
                        // the full amount. A $43,338 invoice with $33,480
                        // prepaid stays $9,858 due after a line drops, instead
                        // of flipping to Paid $0.00 / Outstanding $43,338.
                        outstandingBalance: Math.max(0, Math.round((inv.outstandingBalance + (edited.amount - inv.amount)) * 100) / 100),
                        paymentTerms: edited.paymentTerms ?? inv.paymentTerms,
                        charges: edited.charges ?? inv.charges,
                        savedLineItems: edited.savedLineItems ?? inv.savedLineItems,
                        glEntries: edited.glEntries ?? inv.glEntries,
                        apAccount: edited.apAccount || inv.apAccount,
                        linkedPOs: edited.linkedPOs?.length
                          ? Array.from(new Set([...(inv.linkedPOs ?? []), ...edited.linkedPOs]))
                          : inv.linkedPOs,
                        // Every receiving document survives a quantity edit
                        // (VI-10): the edit form only carries the first GRN,
                        // so union the edited set with the stored one instead
                        // of letting 3 receiving docs collapse to 1.
                        linkedGRNs: Array.from(new Set([...(inv.linkedGRNs ?? []), ...(edited.linkedGRNs ?? [])])),
                        // Files attached inside Edit Invoice stay on the record
                        // (VI-13): merge the edited payload's attachments with
                        // whatever the invoice already carried.
                        // The edit form reopens on the saved files and sends
                        // its full list (BA 10/10), so it REPLACES the old one.
                        attachments: edited.attachments ?? inv.attachments,
                        attachmentSizes: { ...(inv.attachmentSizes ?? {}), ...(edited.attachmentSizes ?? {}) },
                        // Reconciliation survives the edit (VI-03): the
                        // prepayment this invoice consumed, the pre-invoices
                        // it settled, and (pre-invoice side) what it
                        // reconciled into all stay on the record even when
                        // the edited payload doesn't re-send them.
                        appliedPrepayments: edited.appliedPrepayments ?? inv.appliedPrepayments,
                        reconcilesPreInvoiceNumbers: edited.reconcilesPreInvoiceNumbers ?? inv.reconcilesPreInvoiceNumbers,
                        reconciledIntoInvoiceNumber: edited.reconciledIntoInvoiceNumber ?? inv.reconciledIntoInvoiceNumber,
                        // Edited records render their persisted data from
                        // now on — never re-synthesized seeds.
                        isUserCreated: true,
                        updatedBy: 'Ahtisham Ahmad',
                        updatedDate: localTodayIso(),
                      };
                // Edit mode (9/3/26): a Pending Approval invoice saves its
                // changes IN PLACE — the edited figures merge onto the
                // stored record, the status never moves, no resubmission
                // action posts. The outstanding balance shifts by the edit
                // delta so any applied prepayment survives (VI-03).
                if (resubmitInvoice.status === 'Pending Approval') {
                  setInvoices((prev) =>
                    prev.map((inv) => (inv.id === resubmitInvoice.id ? mergeEditedInvoice(inv) : inv)),
                  );
                  setResubmitInvoice(null);
                  setResubmitNotifyIds(undefined);
                  toast.success('Invoice updated', {
                    description: `${invoiceNumber} stays in the approval queue with your changes.`,
                  });
                  navigate(`${invoicesBase}/${encodeURIComponent(invoiceNumber)}`);
                  return;
                }
                // Rejected invoices resubmit; exceptions resolve — both land
                // back in the approval queue (7/15/26). The corrected
                // figures merge onto the record FIRST (QC14: a 41→20
                // correction used to vanish — applyInvoiceAction only
                // flipped the status), then the transition posts with the
                // resolution record captured in the confirm (9/5/26).
                setInvoices((prev) =>
                  prev.map((inv) => (inv.id === resubmitInvoice.id ? mergeEditedInvoice(inv) : inv)),
                );
                const rec = resubmitRecordationRef.current;
                resubmitRecordationRef.current = null;
                applyInvoiceAction(
                  [resubmitInvoice.id],
                  resubmitInvoice.status === 'Exception' ? 'resolve' : 'submit',
                  rec?.notes ?? '',
                  rec?.notifyIds ?? resubmitNotifyIds,
                  rec?.attachments,
                );
                const notified = !!(rec?.notifyIds ?? resubmitNotifyIds);
                setResubmitInvoice(null);
                setResubmitNotifyIds(undefined);
                toast.success('Invoice resubmitted for approval', {
                  description: notified
                    ? `${invoiceNumber} is back in the approval queue. The flag recipients were notified.`
                    : `${invoiceNumber} is back in the approval queue.`,
                });
                navigate(`${invoicesBase}/${encodeURIComponent(invoiceNumber)}`);
              }}
            />
          );
        })()}

        {/* Invoice-initiated Record Payment / Prepayment — an overlay so the
            user stays on the invoice screen until a payment is recorded. */}
        {invoiceFlow && (
          <RecordPaymentFlow
            key={`${invoiceFlow.mode}-${invoiceFlow.paySelection?.join(',') ?? ''}-${invoiceFlow.prepayPrefill?.preInvoiceId ?? ''}`}
            open
            // Invoice-initiated flows use the V2 workspace layout and land
            // straight on step 2 (the invoice is already chosen), so the
            // vendor/invoice selection step never shows (design feedback).
            variant="workspace"
            initialMode={invoiceFlow.mode}
            invoices={invoices}
            payments={payments}
            runs={runsApi.runs}
            paySelection={invoiceFlow.paySelection ? { invoiceIds: invoiceFlow.paySelection } : undefined}
            prefill={invoiceFlow.prepayPrefill}
            onClose={() => setInvoiceFlow(null)}
            onBack={() => setInvoiceFlow(null)}
            onComplete={handleInvoiceFlowComplete}
            onViewPayment={(p) => navigate(`/payments-v2/${encodeURIComponent(p.paymentNumber)}`, {
              state: { from: location.pathname + location.search },
            })}
          />
        )}
      </Layout>
      <Toaster position="top-right" />
    </SafeMuiThemeProvider>
  );
}
