// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { X, Check, Users, Package, ChevronRight, ArrowLeft, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { Step1CustomerSelection } from '@/app/components/quote-creation/Step1CustomerSelection';
import { Step3LineItems } from '@/app/components/quote-creation/Step3LineItems';
import { ConfirmDiscardModal } from '@/app/components/shared/ConfirmDiscardModal';
import { toast } from 'sonner';

interface CreateQuoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQuoteCreated?: (draft: QuoteDraft) => { quoteId: string; quoteNumber: string };
  onNavigateToQuote?: (quoteId: string) => void;
}

export interface QuoteDraft {
  id: string;
  customer: {
    id: string;
    name: string;
    location?: string;
  } | null;
  primaryPoC: {
    id: string;
    name: string;
    email: string;
  } | null;
  recipients?: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    mobile?: string;
    title: string;
    department: string;
    initials: string;
    isPrimary?: boolean;
  }>;
  configuration: {
    billingAddress: string;
    shippingAddress: string;
    pricingRule: string;
    validUntil: string;
    expiryDate: string;
    tags: string[];
    notes: string;
  };
  /** Sales reps picked in Step 2 — kept on the draft so the create
   *  handler can persist them as primary + additionalSalesReps on the
   *  saved quote. Previously the Step 2 modal held this state locally
   *  and it was discarded on save, which is why newly-created quotes
   *  always showed "Unassigned" in the detail sidebar. */
  salesReps?: Array<{
    id: string;
    name: string;
    initials: string;
    isPrimary: boolean;
    isCurrentUser?: boolean;
    isCustomerDefault?: boolean;
  }>;
  lineItems: Array<{
    id: string;
    productId: string;
    name: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
    image?: string;
  }>;
  /** Bill to / Ship to / payment terms / payment method picked in
   *  Step 1b. '' means "not set" and renders the empty state on the
   *  saved quote's detail page. */
  commercial?: {
    billingAddress: string;
    shippingAddress: string;
    paymentTerms: string;
    paymentMethod: string;
  };
  lastSaved: Date;
}

const STEPS = [
  {
    id: 1,
    key: 'customer',
    label: 'Select Recipient',
    Icon: Users,
    description: 'Choose customer and configure quote',
  },
  {
    id: 2,
    key: 'items',
    label: 'Add Line Items',
    Icon: Package,
    description: 'Select products and services',
  },
];

export function CreateQuoteModal({ open: isOpen, onOpenChange, onQuoteCreated, onNavigateToQuote }: CreateQuoteModalProps) {
  const onClose = () => onOpenChange(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [createdQuoteId, setCreatedQuoteId] = useState<string | null>(null);
  const [createdQuoteNumber, setCreatedQuoteNumber] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [creatingLabel, setCreatingLabel] = useState<'create' | 'another'>('create');
  /* Partner validation pattern: Continue / Create stay enabled at all
     times. Clicking with a required selection missing flips this on,
     which paints the offending surface red with helper text. Errors
     are derived from live state, so they clear once the user fixes
     the field. */
  const [showErrors, setShowErrors] = useState(false);
  /* Full-view toggle mirrors the AttachmentPreviewModal pattern: the
     modal expands to fill the viewport so users can see more of the
     line-item grid / recipient picker without scrolling. */
  const [isFullView, setIsFullView] = useState(false);
  
  const [quoteDraft, setQuoteDraft] = useState<QuoteDraft>({
    id: `D-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    customer: null,
    primaryPoC: null,
    configuration: {
      billingAddress: '',
      shippingAddress: '',
      pricingRule: '',
      validUntil: '',
      expiryDate: '',
      tags: [],
      notes: '',
    },
    lineItems: [],
    lastSaved: new Date(),
  });

  // Reset state when modal opens fresh
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setHasUnsavedChanges(false);
      setIsAnimatingOut(false);
      setShowUnsavedConfirm(false);
      setCreatedQuoteId(null);
      setCreatedQuoteNumber(null);
      setIsCreating(false);
      setShowErrors(false);
      setQuoteDraft({
        id: `D-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        customer: null,
        primaryPoC: null,
        configuration: {
          billingAddress: '',
          shippingAddress: '',
          pricingRule: '',
          validUntil: '',
          expiryDate: '',
          tags: [],
          notes: '',
        },
        lineItems: [],
        lastSaved: new Date(),
      });
    }
  }, [isOpen]);

  /* Note: a 30 s background interval used to flip `hasUnsavedChanges`
     back to false (labelled "auto-save") even though nothing was being
     persisted. It silently cleared the dirty flag while the user was
     parked in a nested modal (e.g., the Advanced Configurator), so
     closing the parent afterwards skipped the discard confirmation.
     Removed entirely — the dirty flag now stays sticky for the
     lifetime of the draft, matching every other creation flow. */

  // ESC key handler. Capture phase, so it runs before a nested dialog
  // (payment terms picker, term details, discard confirm) closes itself:
  // while one is open, Escape belongs to it and must not also prompt to
  // discard the quote.
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) return;
      handleClose();
    };

    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [isOpen, hasUnsavedChanges]);

  const handleClose = () => {
    if (isCreating) return;
    if (hasUnsavedChanges) {
      setShowUnsavedConfirm(true);
    } else {
      animateAndClose();
    }
  };

  const animateAndClose = () => {
    setIsAnimatingOut(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return quoteDraft.customer !== null;
      case 2:
        return quoteDraft.lineItems.length > 0;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (canProceed() && currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSendQuote = () => {
    toast.success('Quote sent successfully!');
    setTimeout(() => {
      animateAndClose();
    }, 1500);
  };

  const progressPercentage = ((currentStep - 1) / (STEPS.length - 1)) * 100;

  const isStepComplete = (step: number) => {
    switch (step) {
      case 1:
        return quoteDraft.customer !== null && quoteDraft.primaryPoC !== null;
      case 2:
        return quoteDraft.lineItems.length > 0;
      default:
        return false;
    }
  };

  /* Step 1 gate. Continue is never disabled; a click with no customer
     or point of contact shows the error in step 1 instead. */
  const handleContinue = () => {
    if (!isStepComplete(1)) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setCurrentStep(2);
  };

  const freshDraft = (): QuoteDraft => ({
    id: `D-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    customer: null,
    primaryPoC: null,
    configuration: {
      billingAddress: '',
      shippingAddress: '',
      pricingRule: '',
      validUntil: '',
      expiryDate: '',
      tags: [],
      notes: '',
    },
    lineItems: [],
    lastSaved: new Date(),
  });

  /* Create Quote already saves the quote as a Draft. "another" also
     creates it, then resets the wizard to a clean step 1 for the next
     quote instead of navigating away. */
  const handleCreate = (mode: 'create' | 'another') => {
    if (isCreating) return;
    if (!isStepComplete(1)) {
      setShowErrors(true);
      setCurrentStep(1);
      return;
    }
    /* Line items are optional at creation: the quote lands as a Draft
       and lines can be added on the detail page. */
    setCreatingLabel(mode);
    setIsCreating(true);
    setHasUnsavedChanges(false);
    setTimeout(() => {
      let newQuoteId: string | undefined;
      let newQuoteNumber: string | undefined;
      if (onQuoteCreated) {
        const result = onQuoteCreated(quoteDraft);
        newQuoteId = result.quoteId;
        newQuoteNumber = result.quoteNumber;
      }
      /* Partner create toast: "<Entity> <name> created successfully". */
      toast.success(`Quote ${newQuoteNumber || quoteDraft.id} created successfully`, { duration: 5000 });
      if (mode === 'another') {
        setQuoteDraft(freshDraft());
        setCurrentStep(1);
        setShowErrors(false);
        setIsCreating(false);
        return;
      }
      if (onNavigateToQuote && newQuoteId) {
        onNavigateToQuote(newQuoteId);
      } else {
        onClose();
      }
    }, 1100);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1CustomerSelection
            quoteDraft={quoteDraft}
            onUpdate={(updates) => {
              setQuoteDraft(prev => ({ ...prev, ...updates }));
              setHasUnsavedChanges(true);
            }}
            onNext={() => setCurrentStep(2)}
            isFullView={isFullView}
            showErrors={showErrors}
          />
        );
      case 2:
        return (
          <Step3LineItems
            quoteDraft={quoteDraft}
            onUpdate={(updates) => {
              setQuoteDraft(prev => ({ ...prev, ...updates }));
              setHasUnsavedChanges(true);
            }}
          />
        );
      default:
        return null;
    }
  };

  const currentStepData = STEPS[currentStep - 1];

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center"
      onClick={handleBackdropClick}
      style={{ 
        zIndex: 10000,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(2px)',
        opacity: isAnimatingOut ? 0 : 1,
        transition: 'opacity 200ms ease-out'
      }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px) scale(0.98);
          }
          to { 
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes slideDown {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateY(20px) scale(0.98);
          }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div
        className={`bg-white flex overflow-hidden flex-col relative ${isFullView ? 'rounded-none' : 'rounded-none sm:rounded-2xl'}`}
        style={{
          /* Sizing mirrors the Partner Management CreatePartner modal:
           * width caps at min(70vw, 1320px) and height locks at
           * min(840px, 90vh) so the modal stays the same size across
           * every step. The customer-pick empty state in step 1 reads
           * as a centered column with whitespace above and below,
           * while step 1b / step 2 fill the same canvas with their
           * cards; nothing about the modal grows when the screen does,
           * so a 4K portrait display no longer shows a stretched
           * 1944px tall surface. */
          width: isFullView ? '100vw' : 'min(70vw, 1320px)',
          maxWidth: isFullView ? '100vw' : 1320,
          /* Locked at 1020px so step 1b can fit its full stack — Selected
           * Customer + Billing/Shipping/Payment + Request/Effective/
           * Expiration row + Priority/Tags row — without internal
           * scroll on any normal-aspect screen. Falls back to 94vh on
           * shorter screens. Step 1 (empty state) and step 2 (line item
           * catalogue) inherit the same canvas so the modal stays a
           * stable size across the wizard. */
          height: isFullView ? '100vh' : 'min(1020px, 94vh)',
          maxHeight: isFullView ? '100vh' : 'min(1020px, 94vh)',
          animation: isAnimatingOut ? 'slideDown 200ms ease-out' : 'slideUp 200ms ease-out',
          boxShadow: isFullView ? 'none' : '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)',
          transition: 'width 200ms ease, height 200ms ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {isCreating && (
          <div
            aria-live="polite"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(4px)',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              borderRadius: 'inherit',
              animation: 'fadeIn 160ms ease-out',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: '#EFF6FF',
                border: '1px solid #DBEAFE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Loader2 style={{ width: 26, height: 26, color: '#0A77FF', animation: 'spin 900ms linear infinite' }} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>
              {creatingLabel === 'another' ? 'Creating quote…' : 'Creating quote…'}
            </div>
            <div style={{ fontSize: 12, color: '#64748B' }}>
              {creatingLabel === 'another' ? 'Saving, then starting a new one.' : 'Taking you to the new quote.'}
            </div>
          </div>
        )}
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* ── Header — Partner CreatePartnerModal pattern (mirrors SO CreateSOModal) ── */}
          <div
            className="shrink-0 bg-white"
            style={{ padding: '16px 20px 0', borderBottom: '1px solid #EEF2F6', borderRadius: '16px 16px 0 0' }}
          >
            {/* Title row */}
            <div className="flex items-start justify-between" style={{ gap: 12 }}>
              <div className="min-w-0">
                <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.3, margin: 0 }}>
                  Create New Quote
                </h2>
                <p style={{ fontSize: 12, fontWeight: 400, color: '#64748B', marginTop: 4 }}>
                  Configure the details and line items for the new quote.
                </p>
              </div>

              <div className="flex items-center shrink-0" style={{ gap: 6 }}>
                <button
                  onClick={() => setIsFullView((v) => !v)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-foreground hover:bg-[hsl(210,100%,96%)] hover:border-[hsl(0,0%,70%)] transition-all cursor-pointer active:scale-[0.97]"
                  style={{ fontWeight: 500 }}
                  aria-label={isFullView ? 'Exit full view' : 'Full view'}
                >
                  {isFullView ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  {isFullView ? 'Exit full' : 'Full view'}
                </button>
                <button
                  onClick={handleClose}
                  className="flex items-center justify-center transition-all hover:bg-muted"
                  style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8' }}
                  aria-label="Close"
                >
                  <X style={{ width: 18, height: 18 }} />
                </button>
              </div>
            </div>

            {/* Step tabs flush with the header bottom border (Partner pattern) */}
            <div className="flex items-center overflow-x-auto" style={{ gap: 24, marginTop: 14, marginBottom: -1 }}>
              {STEPS.map((step) => {
                const isCompleted = isStepComplete(step.id);
                const isCurrent = step.id === currentStep;
                const done = isCompleted && !isCurrent;
                const clickable = step.id < currentStep;
                return (
                  <div
                    key={step.id}
                    className="relative flex items-center gap-2"
                    onClick={() => { if (clickable) setCurrentStep(step.id); }}
                    style={{ paddingBottom: 12, cursor: clickable ? 'pointer' : 'default', opacity: isCurrent || done ? 1 : 0.4 }}
                  >
                    <div
                      className="shrink-0 flex items-center justify-center transition-all duration-200"
                      style={{
                        width: 22, height: 22, borderRadius: '50%',
                        fontSize: 12, fontWeight: 600,
                        ...(done
                          ? { background: '#10B981', color: 'white' }
                          : isCurrent
                          ? { background: '#0A77FF', color: 'white' }
                          : { border: '1.5px solid #CBD5E1', color: '#64748B', background: 'white' }),
                      }}
                    >
                      {done ? <Check style={{ width: 12, height: 12, strokeWidth: 3 }} /> : step.id}
                    </div>
                    <span
                      className="whitespace-nowrap transition-colors"
                      style={{
                        fontSize: 13,
                        fontWeight: isCurrent || done ? 600 : 500,
                        color: isCurrent ? '#0A77FF' : done ? '#10B981' : '#334155',
                      }}
                    >
                      {step.label}
                    </span>
                    {(isCurrent || done) && (
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded-t-full"
                        style={{ height: 2, background: done ? '#10B981' : '#0A77FF' }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step Content - No padding, let step handle layout */}
          <div className="flex-1 overflow-y-auto min-h-0 bg-white">
            {/* Step Component */}
            {renderStepContent()}
          </div>

          {/* Footer — Partners action bar */}
          <div className="shrink-0 border-t border-border bg-white px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 flex items-center justify-end gap-2 sm:gap-2.5 sm:rounded-b-2xl">
            {/* Back button (shown after step 1) */}
            {currentStep > 1 && (
              <button
                onClick={() => { setShowErrors(false); setCurrentStep(currentStep - 1); }}
                className="inline-flex items-center gap-1.5 text-xs sm:text-[13px] text-muted-foreground hover:text-foreground transition-colors mr-auto"
                style={{ fontWeight: 500 }}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Back</span>
              </button>
            )}

            {/* Cancel */}
            <button
              onClick={handleClose}
              className="border border-border bg-white text-foreground hover:bg-muted/60 hover:border-border rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 transition-colors"
              style={{ fontWeight: 500 }}
            >
              Cancel
            </button>

            {currentStep < 2 ? (
              /* Continue button. Never disabled (Partner pattern);
                 validation runs on click. */
              <button
                onClick={handleContinue}
                className="gap-1.5 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 shadow-sm transition-all inline-flex items-center bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20"
                style={{ fontWeight: 500 }}
              >
                Continue
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <>
                {/* Create & Make Another */}
                <button
                  onClick={() => handleCreate('another')}
                  disabled={isCreating}
                  className="rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 transition-colors inline-flex items-center border border-primary/40 text-primary hover:bg-accent"
                  style={{ fontWeight: 500 }}
                >
                  Create & Make Another
                </button>

                {/* Create Quote */}
                <button
                  onClick={() => handleCreate('create')}
                  disabled={isCreating}
                  className="gap-1.5 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 shadow-sm transition-all inline-flex items-center bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20"
                  style={{ fontWeight: 500 }}
                >
                  Create Quote
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Unsaved Changes Confirmation Modal — Partner red-themed discard chrome */}
      <ConfirmDiscardModal
        open={showUnsavedConfirm}
        onOpenChange={(o) => { if (!o) setShowUnsavedConfirm(false); }}
        title="Discard quote draft?"
        description="All unsaved changes will be lost. This action cannot be undone."
        confirmLabel="Discard changes"
        cancelLabel="Continue editing"
        onConfirm={() => {
          animateAndClose();
          setShowUnsavedConfirm(false);
        }}
      />
    </div>
  );
}