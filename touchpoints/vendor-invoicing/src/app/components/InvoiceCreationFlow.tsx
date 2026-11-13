import type { Payment } from '@/app/data/mockPayments';
import { useState } from 'react';
import { CalendarClock, Lock, Wallet } from 'lucide-react';
import { formatMoney } from '@/app/currency/money';
import { BASE_CURRENCY } from '@/app/currency/currencies';
import { paidRateText } from '@/app/currency/paidRate';
import { InvoiceTypeSelectionModal } from '@/app/components/InvoiceTypeSelectionModal';
import { VendorSelectionModalNested as VendorSelectionModal, SelectedPOData } from '@/app/components/VendorSelectionModalNested';
import { StandaloneVendorSelectionModal, StandaloneVendorData } from '@/app/components/StandaloneVendorSelectionModal';
import { CreateInvoiceScreen } from '@/app/components/CreateInvoiceScreen';
import { Invoice } from '@/app/data/mockInvoices';
import type { CreditMemo } from '@/app/data/creditMemos';
import { mockVendors, resolveRegistryVendor } from '@/app/data/mockVendors';
import { resolvePaymentTerm } from '@/app/data/paymentTermPresets';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { PaymentTermCard } from '@/app/components/vendors/PaymentTermCard';
import { PaymentTermDetailsModal } from '@/app/components/PaymentTermDetailsModal';

interface InvoiceCreationFlowProps {
  onClose: () => void;
  onInvoicesCreated: (invoices: Invoice[]) => void;
  /** Live app invoices — feeds the reconciliation context: POs whose
   *  pre-invoices carry paid prepayments wear flags in the picker and
   *  consume those prepayments at creation (Eli, 8/31/26). */
  invoices?: Invoice[];
  /** Live app payments: real Prepayment records anchored to a pre-invoice
   *  are the cash the reconciliation applies (Mahreen 10/10). */
  payments?: Payment[];
  /** Live credit memos — the reconciliation context subtracts applied
   *  credits so a credit memo never reads as cash prepaid (VI-04). */
  creditMemos?: CreditMemo[];
  /** 'ap' = vendor invoice (Dr expense/inventory, Cr A/P); 'ar' =
   *  customer invoice (Dr A/R, Cr revenue). Flips the GL preview. */
  ledger?: 'ap' | 'ar';
  /** Deep-linked vendor lock (Eli 9/24): creation launched from the
   *  payment flow is FOR that vendor — the type screen is skipped and
   *  the picker opens locked to the vendor's own documents. */
  initialVendorName?: string;
  /** Deep-linked flow assertion (user 9/25): which of the three flows
   *  the split CTA chose. Skips the type screen; standalone skips the
   *  vendor screen too (the vendor is already known). */
  initialType?: 'invoice' | 'pre-invoice' | 'standalone';
}

type FlowStep = 'type-selection' | 'inventory-selection' | 'standalone-vendor-selection' | 'create-invoice';
/* Three separate flows (9/4/26 Eli review, D-01): the Pre-Invoice flow
 * ALWAYS creates a pre-invoice, the Inventory flow ALWAYS creates a
 * receiving invoice, Standalone bills the vendor directly. Pre vs post is
 * decided by the entry point, never inferred from the selection. */
type InvoiceType = 'pre-invoice' | 'inventory' | 'standalone';

export function InvoiceCreationFlow({ onClose, onInvoicesCreated, invoices = [], payments = [], creditMemos = [], ledger = 'ap', initialVendorName, initialType }: InvoiceCreationFlowProps) {
  // Deep-linked vendor + type lock (Eli 9/24, user 9/25): the split CTA
  // hands over a vendor AND a flow. The type screen never shows; the
  // PO-backed flows open the picker locked to that vendor; standalone
  // skips straight to the create screen with the vendor pre-populated.
  // The SHARED tolerant resolver (Eli 9/25 demo bug): the same exact →
  // case-insensitive → first-word chain the split CTA's availability
  // check uses, so the two can never disagree.
  const lockedVendor = resolveRegistryVendor(initialVendorName);
  // A PO-backed deep link whose vendor has NO registry record can only
  // land in an UNFILTERED picker (the bug Eli hit with Southern
  // Industrial Supply) — the vendor has no documents here, so the
  // standalone flow is the only honest destination. The split CTA greys
  // these options with a tooltip; this fallback is the safety net for
  // stale links.
  const lockedType: InvoiceType | null = initialVendorName
    ? initialType === 'standalone' || !lockedVendor
      ? 'standalone'
      : initialType === 'pre-invoice'
        ? 'pre-invoice'
        : 'inventory'
    : null;
  const [currentStep, setCurrentStep] = useState<FlowStep>(
    lockedType === 'standalone' ? 'create-invoice' : lockedType ? 'inventory-selection' : 'type-selection',
  );
  const [invoiceType, setInvoiceType] = useState<InvoiceType | null>(lockedType);
  const [selectedPOs, setSelectedPOs] = useState<SelectedPOData[]>([]);
  const [standaloneVendor, setStandaloneVendor] = useState<StandaloneVendorData | null>(
    lockedType === 'standalone'
      ? lockedVendor
        ? {
            vendorId: lockedVendor.id,
            vendorCode: lockedVendor.vendorCode,
            vendorName: lockedVendor.vendorName,
            vendorCategory: lockedVendor.category,
            currency: lockedVendor.currency,
            paymentTerms: lockedVendor.paymentTerms,
            imageUrl: lockedVendor.imageUrl,
          }
        : initialVendorName
          ? {
              // No registry record for this name — carry the name through
              // with sensible defaults so the create screen still opens
              // pre-populated (standalone needs no documents anyway).
              vendorId: initialVendorName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              vendorCode: '',
              vendorName: initialVendorName,
              vendorCategory: 'Vendor',
              currency: 'USD',
              paymentTerms: 'Net 30',
            }
          : null
      : null,
  );
  // When the standalone flow detects open POs/receivers and the user chooses
  // "Select a document", we route into the inventory picker locked to that
  // vendor via VendorSelectionModalNested's `fixedVendorId`.
  const [fixedVendorId, setFixedVendorId] = useState<string | null>(lockedVendor?.id ?? null);

  // The flow's kind assertion, threaded into the picker (per-flow listing,
  // eligibility, grey-out) and the create screen (invoiceKind).
  const flowKind: 'pre' | 'post' | null =
    invoiceType === 'pre-invoice' ? 'pre' : invoiceType === 'inventory' ? 'post' : null;

  const handleTypeSelection = (type: InvoiceType) => {
    setInvoiceType(type);
    // Both PO-backed flows share the same picker step; behavior forks on
    // the flowKind prop.
    if (type === 'pre-invoice' || type === 'inventory') {
      setCurrentStep('inventory-selection');
    } else {
      setCurrentStep('standalone-vendor-selection');
    }
  };

  // Mixed-terms gate (8/31/26): an invoice follows a SINGLE payment
  // term, so a selection whose POs disagree resolves HERE, before the
  // create screen. Two routes: adopt any selected PO's term for all of
  // them, or pick a different term from the templates. Either way the
  // create screen opens with one term and no conflict.
  const [termGate, setTermGate] = useState<{
    selection: SelectedPOData[];
    pairs: { poNumber: string; term: string }[];
  } | null>(null);
  // The term the gate resolved to — seeds the create screen so every
  // PO opens aligned.
  const [resolvedTerm, setResolvedTerm] = useState<string | null>(null);
  // The templates route: land on the create screen with the Browse
  // Payment Terms modal already open; its Apply aligns every PO.
  const [openTermsPicker, setOpenTermsPicker] = useState(false);
  // All-blocked selections (e.g. all-NET POs in the pre flow) skip the
  // gate modal and open the picker directly with an amber notice strip
  // (BA 9/28: gate + picker made two dialogs saying the same thing).
  const [termsPickerNotice, setTermsPickerNotice] = useState(false);
  // Term detail modal (8/31/26): clicking a term NAME in the gate opens
  // the read-only partner-style details view.
  const [termDetail, setTermDetail] = useState<string | null>(null);
  // Prepayment gate (9/2/26): a received-goods selection that includes
  // POs with paid pre-invoices announces the auto-application BEFORE
  // the create screen — the amounts ride the invoice as totals lines
  // and the pre-invoices reconcile at submit. Fires AFTER the
  // mixed-terms gate resolves, never simultaneously; carries the
  // resolved term / templates-picker intent through to the commit.
  const [prepayGate, setPrepayGate] = useState<{
    selection: SelectedPOData[];
    entries: { poNumber: string; poAmount: number; preInvoiceNumber: string; amount: number; rate?: number; rateDate?: string }[];
    term: string | null;
    openTermsPicker: boolean;
    blockedKindNotice: boolean;
  } | null>(null);

  // Reconciliation context (Eli, 8/31/26): pre-invoices with money paid
  // against them, keyed by their linked POs. The picker flags these POs
  // and the create screen consumes the prepayment.
  const prepaidPOContext = (() => {
    const map: Record<string, { preInvoiceNumber: string; amount: number; rate?: number; rateDate?: string }> = {};
    invoices.forEach((inv) => {
      if (inv.type !== 'Pre-Invoice') return;
      // Already reconciled into an inventory invoice, or cancelled: nothing
      // left to carry. A pre-invoice SETTLED by a credit memo still brings
      // any cash it had (Mahreen 10/10).
      if (inv.status === 'Cancelled' || inv.reconciledIntoInvoiceNumber) return;
      // Only CASH paid against a pre-invoice is a prepayment (VI-04): a
      // credit memo also reduces the outstanding balance, so subtract the
      // applied credits before reading the rest as cash. A $140 credit on
      // an otherwise-unpaid pre-invoice leaves $0 cash — nothing to deduct.
      const creditsApplied = Math.round(
        creditMemos
          .filter((m) => m.invoiceNumber === inv.invoiceNumber && m.status === 'Applied')
          .reduce((s, m) => s + m.amount, 0) * 100,
      ) / 100;
      // Only money ACTUALLY PAID (Mahreen 10/10): the real Prepayment
      // records anchored to this pre-invoice when they exist; seeds with
      // no records fall back to the balance minus every credit. The credit
      // memo amount never carries, and PO price/quantity never change.
      const prepayRecords = payments.filter(
        (p) =>
          p.type === 'Prepayment' &&
          (p.preInvoiceId === inv.invoiceNumber || p.preInvoiceId === inv.id) &&
          !['Reversed', 'Void', 'Draft'].includes(p.status),
      );
      const paid = prepayRecords.length > 0
        ? Math.round(prepayRecords.reduce((s, p) => s + p.amount, 0) * 100) / 100
        : Math.round((inv.amount - inv.outstandingBalance - Math.max(creditsApplied, inv.creditedAmount ?? 0)) * 100) / 100;
      if (paid <= 0.004) return;
      inv.linkedPOs.forEach((po) => {
        const cur = map[po];
        map[po] = {
          preInvoiceNumber: cur ? cur.preInvoiceNumber : inv.invoiceNumber,
          amount: Math.round(((cur?.amount ?? 0) + paid) * 100) / 100,
          // The rate the pre-invoice was paid at (it posts when paid).
          rate: cur ? cur.rate : inv.exchangeRate,
          rateDate: cur ? cur.rateDate : inv.rateDate,
        };
      });
    });
    return map;
  })();

  // The prepaid POs inside a selection — the INVENTORY flow only: a
  // pre-invoice against an already-prepaid PO doesn't reconcile anything
  // (mirrors consumesPrepay = !hasPre on the create screen).
  const prepayEntriesFor = (selection: SelectedPOData[]) =>
    flowKind !== 'post'
      ? []
      : selection.flatMap((po) => {
          const ctx = prepaidPOContext[po.poNumber];
          return ctx ? [{ poNumber: po.poNumber, poAmount: po.poAmount, ...ctx }] : [];
        });

  // Single exit into the create screen: every resolved selection funnels
  // through here so the prepayment gate always speaks LAST, after any
  // terms conflict is settled.
  const proceedToCreate = (
    selection: SelectedPOData[],
    opts: { term?: string | null; openTermsPicker?: boolean; blockedKindNotice?: boolean } = {},
  ) => {
    const entries = prepayEntriesFor(selection);
    if (entries.length > 0) {
      setPrepayGate({ selection, entries, term: opts.term ?? null, openTermsPicker: !!opts.openTermsPicker, blockedKindNotice: !!opts.blockedKindNotice });
      return;
    }
    setSelectedPOs(selection);
    setResolvedTerm(opts.term ?? null);
    setOpenTermsPicker(!!opts.openTermsPicker);
    setTermsPickerNotice(!!opts.blockedKindNotice);
    setCurrentStep('create-invoice');
  };

  const resolveTermsAndContinue = (term: string) => {
    if (!termGate) return;
    const selection = termGate.selection;
    setTermGate(null);
    proceedToCreate(selection, { term });
  };

  const handleInventorySelection = (selectedData: SelectedPOData[]) => {
    setResolvedTerm(null);
    setOpenTermsPicker(false);
    setTermsPickerNotice(false);
    // Same source of truth as the create screen's mixed-terms card:
    // the PO's own term off the vendor record, vendor default fallback.
    const pairs: { poNumber: string; term: string }[] = [];
    selectedData.forEach((po) => {
      for (const vendor of mockVendors) {
        const src = vendor.purchaseOrders.find((p) => p.poNumber === po.poNumber);
        if (src) {
          pairs.push({ poNumber: po.poNumber, term: src.paymentTerms || vendor.paymentTerms });
          break;
        }
      }
    });
    const uniqueTerms = Array.from(new Set(pairs.map((p) => p.term)));
    // When EVERY selected term is the wrong kind for this flow there is
    // no pick to make in the gate — it and the picker's own warning were
    // two consecutive dialogs saying the same thing (BA 9/28). Route
    // straight to the terms picker, which opens on the valid tab and
    // wears the explanation strip.
    const gateKind = flowKind ?? 'post';
    const blockedOf = (term: string) => {
      const cat = resolvePaymentTerm(term).category;
      return (gateKind === 'pre' && cat === 'net') || (gateKind === 'post' && cat === 'prepayment');
    };
    const allBlocked = pairs.length > 0 && pairs.every(({ term }) => blockedOf(term));
    if (allBlocked) {
      proceedToCreate(selectedData, { openTermsPicker: true, blockedKindNotice: true });
      return;
    }
    if (uniqueTerms.length > 1) {
      setTermGate({ selection: selectedData, pairs });
      return;
    }
    // Kind-aware seeding (9/2/26): the create screen opens on the PO's
    // OWN term when its category fits the invoice kind — a prepaid PO
    // almost always carries a prepayment term, and that is what the
    // pre-invoice should open with. When the term doesn't fit (a NET
    // term on a pre-invoice, a prepayment term on received goods) it
    // never seeds; the browse modal opens on the valid tab instead so
    // the sidebar never wears a term it can't keep.
    const uniform = uniqueTerms[0];
    const kind = flowKind ?? 'post';
    const cat = uniform ? resolvePaymentTerm(uniform).category : null;
    const fits = !!cat && !(kind === 'pre' && cat === 'net') && !(kind === 'post' && cat === 'prepayment');
    if (fits) {
      proceedToCreate(selectedData, { term: uniform });
      return;
    }
    // A uniform-but-wrong-kind selection is caught by the allBlocked
    // route above, so a uniform term reaching here has no seedable fit
    // for another reason — open the picker plain.
    if (uniform) {
      proceedToCreate(selectedData, { openTermsPicker: true });
      return;
    }
    proceedToCreate(selectedData, {});
  };

  const handleStandaloneVendorSelection = (vendor: StandaloneVendorData) => {
    setStandaloneVendor(vendor);
    setCurrentStep('create-invoice');
  };

  // "Select a document" from the standalone open-documents prompt — switch to
  // the inventory PO/receiver picker, locked to the chosen vendor.
  const handleSwitchToInventory = (vendorId: string) => {
    setStandaloneVendor(null);
    setSelectedPOs([]);
    setFixedVendorId(vendorId);
    // "Select a document" exists to link receivings — it always lands in
    // the Inventory flow, never the pre-invoice one.
    setInvoiceType('inventory');
    setCurrentStep('inventory-selection');
  };

  const handleGoBack = () => {
    if (currentStep === 'inventory-selection' || currentStep === 'standalone-vendor-selection') {
      setCurrentStep('type-selection');
      setInvoiceType(null);
      setStandaloneVendor(null);
      setFixedVendorId(null);
    } else if (currentStep === 'create-invoice') {
      if (invoiceType === 'pre-invoice' || invoiceType === 'inventory') {
        setCurrentStep('inventory-selection');
      } else if (invoiceType === 'standalone') {
        setCurrentStep('standalone-vendor-selection');
      } else {
        setCurrentStep('type-selection');
      }
    }
  };

  const handleCloseAll = () => {
    setCurrentStep('type-selection');
    setInvoiceType(null);
    setSelectedPOs([]);
    setStandaloneVendor(null);
    setFixedVendorId(null);
    setPrepayGate(null);
    onClose();
  };

  return (
    <>
      {/* Step 1: Invoice Type Selection */}
      {currentStep === 'type-selection' && (
        <InvoiceTypeSelectionModal
          onClose={handleCloseAll}
          onSelectType={handleTypeSelection}
        />
      )}

      {/* Step 2a: Inventory Selection (Vendor-First Nesting) — shared by
          both PO-backed flows; flowKind drives the per-flow listing,
          eligibility and grey-out (9/4/26 split). The old mixed-kind lock
          is gone: pre and post can no longer meet in one selection because
          each flow only ever offers one side. */}
      {currentStep === 'inventory-selection' && (
        <VendorSelectionModal
          isOpen={true}
          onClose={handleCloseAll}
          onBack={handleGoBack}
          onContinue={handleInventorySelection}
          fixedVendorId={fixedVendorId ?? undefined}
          flowKind={flowKind ?? 'post'}
          // Prepaid flags reconcile at INVOICE creation — the pre flow
          // doesn't consume prepayments, so it doesn't wear the chips.
          prepaidPOContext={flowKind === 'post' ? prepaidPOContext : undefined}
        />
      )}

      {/* Step 2b: Standalone Vendor Selection */}
      {currentStep === 'standalone-vendor-selection' && (
        <StandaloneVendorSelectionModal
          isOpen={true}
          onClose={handleCloseAll}
          onBack={handleGoBack}
          onSelectVendor={handleStandaloneVendorSelection}
          onSwitchToInventory={handleSwitchToInventory}
        />
      )}

      {/* Mixed-terms gate — the prepayment-gate recipe in amber: a
          gradient-hero confirmation naming the conflict, each PO's term
          in the standard term treatment, and the two routes out. */}
      {termGate && (() => {
        // How many of the selection's terms the current flow can even
        // adopt (BA 9/5). An ALL-blocked selection no longer reaches this
        // modal (BA 9/28: it duplicated the picker's own explanation) —
        // handleInventorySelection routes it straight to the terms picker
        // with the amber strip. The allBlocked variant below stays as a
        // safety net only.
        const gateKind = flowKind ?? 'post';
        const blockedOf = (term: string) => {
          const cat = resolvePaymentTerm(term).category;
          return (gateKind === 'pre' && cat === 'net') || (gateKind === 'post' && cat === 'prepayment');
        };
        const allBlocked = termGate.pairs.every(({ term }) => blockedOf(term));
        return (
        <div className="fixed inset-0 bg-black/60 z-[400] flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl max-w-[420px] w-full max-h-[calc(100dvh-2rem)] overflow-y-auto animate-in zoom-in-95 duration-200"
            style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
          >
            {/* Amber gradient hero */}
            <div
              className="relative flex flex-col items-center pt-8 pb-5"
              style={{ background: 'linear-gradient(180deg, #FEF3C7 0%, rgba(254,243,199,0.3) 70%, transparent 100%)' }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[90px] rounded-full opacity-25 pointer-events-none" style={{ backgroundColor: '#D97706', filter: 'blur(50px)' }} />
              <div className="relative w-[56px] h-[56px] rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FDE68A' }}>
                <CalendarClock className="w-7 h-7" style={{ color: '#B45309', strokeWidth: 2 }} />
              </div>
              <span className="mt-3 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#FEF3C7', color: '#B45309' }}>
                Payment Terms
              </span>
            </div>
            <div className="flex flex-col items-center text-center px-6">
              <h3 className="text-[20px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600, lineHeight: 1.3 }}>
                {allBlocked ? 'Payment terms need to be updated' : 'Resolve the payment terms first'}
              </h3>
              {/* Honest copy (9/4/26 BB-06 + BA 9/5): when every term is
                  the wrong kind, say so plainly and route to the templates;
                  otherwise name the marking and let the reasons render
                  INLINE (never in a hover). */}
              <p className="text-[13px] mt-2 mx-auto text-muted-foreground" style={{ lineHeight: 1.7, maxWidth: '340px' }}>
                {/* Detection + rule + resolution, in that order (Nophil
                    9/28) — the old "Terms that only apply before goods
                    ship are marked below" line confused everyone; the
                    blocked rows carry their own inline reasons. */}
                {allBlocked
                  ? gateKind === 'pre'
                    ? "The selected POs use NET terms, which apply only after receiving. Since this is a pre-invoice, you'll need to choose a different term from your payment term templates."
                    : "The selected POs use prepayment terms, which apply before goods ship. Since this is an inventory invoice, you'll need to choose a different term from your payment term templates."
                  : flowKind === 'pre'
                    ? 'We detected multiple payment terms across the selected purchase orders, and a pre-invoice follows a single term. Use one of the terms below for every PO, or choose a different term from the templates.'
                    : 'We detected multiple payment terms across the selected purchase orders, and an invoice follows a single term. Use one of the terms below for every PO, or choose a different term from the templates.'}
              </p>
            </div>
            {/* Each PO's term, in the standard treatment — SELECTABLE:
                clicking one adopts it for every PO and continues. The
                "Use for all" CTA is always visible. */}
            <div className="px-6 pt-4 space-y-1.5 max-h-[200px] overflow-y-auto">
              {termGate.pairs.map(({ poNumber, term }) => {
                const preset = resolvePaymentTerm(term);
                // Kind rule (9/1/26, kind asserted by the FLOW; captions
                // per BA 9/5): a pre-invoice cannot adopt a NET term, an
                // inventory invoice cannot adopt a prepayment term. Split
                // fits both kinds.
                const kindBlocked =
                  gateKind === 'pre' && preset.category === 'net'
                    ? "NET terms apply after receiving and can't be used for a pre-invoice."
                    : gateKind === 'post' && preset.category === 'prepayment'
                      ? "Prepayment terms apply before goods ship and can't be used for an inventory invoice."
                      : null;
                return (
                  <div
                    key={poNumber}
                    className={`w-full px-3 py-2 rounded-lg border transition-colors ${
                      kindBlocked
                        ? 'border-slate-200 bg-slate-50/60'
                        : 'border-slate-200 bg-white hover:border-primary/40 hover:bg-blue-50/40'
                    }`}
                  >
                    <div className="w-full flex items-center justify-between gap-2">
                      <span className="min-w-0 inline-flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-500 shrink-0" style={{ fontWeight: 600 }}>
                          PO No. {poNumber} ·
                        </span>
                        {/* Term name only (8/31/26: the type pill was noise
                            here) — the listing's TermName recipe: hover
                            shows the partner card, click opens the read-only
                            details modal. */}
                        <HoverCard openDelay={300} closeDelay={120}>
                          <HoverCardTrigger asChild>
                            <button
                              type="button"
                              onClick={() => setTermDetail(term)}
                              className={`min-w-0 text-[12px] truncate hover:text-primary hover:underline transition-colors cursor-pointer bg-transparent border-0 p-0 ${kindBlocked ? 'text-slate-500' : 'text-foreground'}`}
                              style={{ fontWeight: 500 }}
                            >
                              {term}
                            </button>
                          </HoverCardTrigger>
                          <HoverCardContent side="bottom" align="start" sideOffset={6} className="p-0 bg-transparent border-0 shadow-none w-[300px] z-[420]">
                            <div className="rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
                              <PaymentTermCard term={preset} readOnly hideCheckmark />
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      </span>
                      {/* Blocked rows carry no button (BA 9/5) — a dead
                          locked "Use for all" was noise; the inline caption
                          is the whole explanation. */}
                      {!kindBlocked && (
                        <button
                          type="button"
                          onClick={() => resolveTermsAndContinue(term)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-primary/40 bg-white text-primary hover:bg-blue-50 cursor-pointer text-[10px] whitespace-nowrap shrink-0 transition-colors"
                          style={{ fontWeight: 600 }}
                        >
                          Use for All
                        </button>
                      )}
                    </div>
                    {/* Blocked reason rendered INLINE (9/4/26, BB-06) — it
                        used to hide in a hover tooltip: "if I didn't hover
                        state it, I would not know." */}
                    {kindBlocked && (
                      <p className="text-[10px] text-rose-500 leading-snug mt-1 text-left">
                        {kindBlocked}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="px-6 pt-4 pb-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  // The template route opens the create screen with the
                  // full Browse Payment Terms modal already up — picking
                  // there aligns every PO. Funnels through the same exit
                  // so the prepayment gate still gets its say.
                  const selection = termGate.selection;
                  setTermGate(null);
                  proceedToCreate(selection, { openTermsPicker: true });
                }}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: '#D97706', color: '#fff' }}
              >
                {allBlocked ? 'Choose a Different Term' : 'Choose a Different Term from the Templates'}
              </button>
              <button
                type="button"
                onClick={() => setTermGate(null)}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
              >
                Back to Selection
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Prepayment gate — the mixed-terms recipe in VIOLET (prepayment
          identity color): announces that money already paid on the
          selected POs' pre-invoices applies to this invoice
          automatically at creation. Continue is the last stop before
          the create screen; Back leaves the picker untouched. */}
      {prepayGate && !termGate && (
        <div className="fixed inset-0 bg-black/60 z-[400] flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl max-w-[420px] w-full max-h-[calc(100dvh-2rem)] overflow-y-auto animate-in zoom-in-95 duration-200"
            style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
          >
            {/* Violet gradient hero */}
            <div
              className="relative flex flex-col items-center pt-8 pb-5"
              style={{ background: 'linear-gradient(180deg, #F5F3FF 0%, rgba(245,243,255,0.3) 70%, transparent 100%)' }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[90px] rounded-full opacity-25 pointer-events-none" style={{ backgroundColor: '#7C3AED', filter: 'blur(50px)' }} />
              <div className="relative w-[56px] h-[56px] rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#DDD6FE' }}>
                <Wallet className="w-7 h-7" style={{ color: '#6D28D9', strokeWidth: 2 }} />
              </div>
              <span className="mt-3 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#F5F3FF', color: '#6D28D9' }}>
                Prepayment
              </span>
            </div>
            <div className="flex flex-col items-center text-center px-6">
              <h3 className="text-[20px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600, lineHeight: 1.3 }}>
                {prepayGate.entries.length === 1 ? 'This PO has a prepayment' : 'These POs have prepayments'}
              </h3>
              {/* One concrete sentence (user 10/4): who paid what against
                  which PO, and what we do about it. The card below holds
                  the math. */}
              <p className="text-[13px] mt-2 mx-auto text-muted-foreground" style={{ lineHeight: 1.7, maxWidth: '340px' }}>
                {prepayGate.entries.length === 1 ? (
                  <>
                    <span className="text-violet-700" style={{ fontWeight: 600 }}>{prepayGate.entries[0].preInvoiceNumber}</span> already paid{' '}
                    <span className="text-violet-700" style={{ fontWeight: 600 }}>{formatMoney(prepayGate.entries[0].amount, prepayGate.selection[0]?.currency ?? BASE_CURRENCY)}</span>{' '}
                    against PO-{prepayGate.entries[0].poNumber}. We'll deduct it from this invoice automatically.
                  </>
                ) : (
                  "These purchase orders were already paid against through their pre-invoices. We'll deduct the prepayments from this invoice automatically."
                )}
              </p>
            </div>
            <div className="px-6 pt-4 max-h-[220px] overflow-y-auto">
              {/* Invoice math in three rows (user 10/4): what you selected,
                  what's already paid, what's left to pay. */}
              {(() => {
                // Billable value of the selected receivings: the selected
                // GRN items' totals where the selection is item-level, the
                // PO amount otherwise.
                const receivingsTotal = prepayGate.selection.reduce((sum, po) => {
                  const grnIds = po.selectedGRNItemIds ?? [];
                  if (grnIds.length > 0) {
                    const grnTotal = po.relatedGRNs.reduce(
                      (s, grn) =>
                        s +
                        grn.items
                          .filter((it) => grnIds.includes(`${grn.grnNumber}:${it.id}`))
                          .reduce((t, it) => t + (it.totalPrice ?? 0), 0),
                      0,
                    );
                    if (grnTotal > 0) return sum + grnTotal;
                  }
                  if (po.selectedItemIds.length > 0) {
                    const itemTotal = po.items
                      .filter((it) => po.selectedItemIds.includes(it.id))
                      .reduce((t, it) => t + (it.totalPrice ?? 0), 0);
                    if (itemTotal > 0) return sum + itemTotal;
                  }
                  return sum + po.poAmount;
                }, 0);
                const prepayTotal = prepayGate.entries.reduce((s, e) => s + e.amount, 0);
                // In the PO's currency (Currency & Exchange Rates), not a fixed "$".
                const gateCurrency = prepayGate.selection[0]?.currency ?? BASE_CURRENCY;
                const fmt = (n: number) => formatMoney(n, gateCurrency);
                return (
                  <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
                    <div className="w-full flex items-center justify-between gap-2 px-3 py-2">
                      <span className="text-[11px] text-slate-600" style={{ fontWeight: 500 }}>
                        Selected Receivings
                      </span>
                      <span className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>
                        {fmt(receivingsTotal)}
                      </span>
                    </div>
                    {prepayGate.entries.map((e) => (
                      <div key={e.poNumber} className="w-full px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-600 min-w-0 truncate" style={{ fontWeight: 500 }}>
                            Prepayment · {e.preInvoiceNumber} (PO-{e.poNumber})
                          </span>
                          <span className="text-[12px] text-violet-700 shrink-0" style={{ fontWeight: 600 }}>
                            −{fmt(e.amount)}
                          </span>
                        </div>
                        {/* The rate the prepayment was paid at. */}
                        {paidRateText(gateCurrency, e) && (
                          <p className="text-[10.5px] text-violet-500/80 mt-0.5 text-left">{paidRateText(gateCurrency, e)}</p>
                        )}
                      </div>
                    ))}
                    <div className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-50/60">
                      <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                        Due on This Invoice
                      </span>
                      <span className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>
                        {fmt(Math.max(0, receivingsTotal - prepayTotal))}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="px-6 pt-4 pb-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  if (!prepayGate) return;
                  setSelectedPOs(prepayGate.selection);
                  setResolvedTerm(prepayGate.term);
                  setOpenTermsPicker(prepayGate.openTermsPicker);
                  setTermsPickerNotice(prepayGate.blockedKindNotice);
                  setPrepayGate(null);
                  setCurrentStep('create-invoice');
                }}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: '#6D28D9', color: '#fff' }}
              >
                Continue
              </button>
              <button
                type="button"
                onClick={() => setPrepayGate(null)}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
              >
                Back to Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Term details — the partner-style read-only modal, opened from a
          term name in the gate. */}
      {termDetail && <PaymentTermDetailsModal termLabel={termDetail} onClose={() => setTermDetail(null)} />}

      {/* Step 3: Create Invoice Screen */}
      {currentStep === 'create-invoice' && (
        <CreateInvoiceScreen
          onClose={handleCloseAll}
          onGoBack={handleGoBack}
          invoiceType={invoiceType}
          flowKind={flowKind}
          selectedPOsData={selectedPOs}
          standaloneVendor={standaloneVendor}
          // Session records included (QC16): the duplicate vendor-number
          // check reads the live register, not just the seeds.
          liveInvoices={invoices}
          onInvoicesCreated={onInvoicesCreated}
          initialPaymentTerm={resolvedTerm ?? undefined}
          openTermsPickerOnMount={openTermsPicker}
          termsPickerNotice={termsPickerNotice ? 'kind-conflict' : undefined}
          prepaidPOContext={prepaidPOContext}
          ledger={ledger}
        />
      )}
    </>
  );
}
