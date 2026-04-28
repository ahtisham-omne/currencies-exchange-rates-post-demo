// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { X, Check, Users, Package, ChevronRight, ArrowLeft } from 'lucide-react';
import { Step1CustomerSelection } from '@/app/components/quote-creation/Step1CustomerSelection';
import { Step3LineItems } from '@/app/components/quote-creation/Step3LineItems';
import { ConfirmationModal } from '@/app/components/ConfirmationModal';
import { toast } from 'sonner';
import { QuoteCreatedToast } from '@/app/components/QuoteCreatedToast';

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
  /** Customer's primary currency at the moment of selection (ISO 4217). Persists separately so we can show "differs from customer default" hints when the user picks a different `currency` for this quote. */
  customerDefaultCurrency?: string;
  /** Currency the quote will settle in (ISO 4217). Defaults to `customerDefaultCurrency` on customer select; user-overrideable per quote without affecting the customer's default. */
  currency?: string;
  configuration: {
    billingAddress: string;
    shippingAddress: string;
    pricingRule: string;
    validUntil: string;
    expiryDate: string;
    tags: string[];
    notes: string;
  };
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

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (hasUnsavedChanges) {
        setQuoteDraft(prev => ({ ...prev, lastSaved: new Date() }));
        setHasUnsavedChanges(false);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [hasUnsavedChanges]);

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [hasUnsavedChanges]);

  const handleClose = () => {
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

  const handleSaveDraft = () => {
    setQuoteDraft(prev => ({ ...prev, lastSaved: new Date() }));
    setHasUnsavedChanges(false);
    toast.success('Draft saved successfully');
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
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(1px)',
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
      `}</style>

      <div
        className="bg-white flex overflow-hidden flex-col rounded-none sm:rounded-2xl"
        style={{
          width: '100%',
          maxWidth: '1200px',
          height: '100dvh',
          maxHeight: '88vh',
          animation: isAnimatingOut ? 'slideDown 200ms ease-out' : 'slideUp 200ms ease-out',
          boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header */}
          <div className="border-b border-[#EEF2F6] flex-shrink-0 bg-white rounded-t-none sm:rounded-t-2xl">
            {/* Title Row */}
            <div className="px-3 sm:px-4 lg:px-5 pt-3 sm:pt-4 pb-0 flex items-start justify-between gap-3">
              {/* Left: Title & Subtitle */}
              <div className="min-w-0">
                <h2 className="text-[15px] sm:text-[17px] text-[#0F172A]" style={{ fontWeight: 700 }}>
                  Create New Quote
                </h2>
                <p className="text-[11px] sm:text-xs text-[#64748B] mt-0.5" style={{ fontWeight: 400 }}>
                  Configure the details and line items for the new quote.
                </p>
              </div>

              {/* Right: Close */}
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-all shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step Tabs */}
            <div className="flex items-center gap-4 sm:gap-6 mt-3 sm:mt-3.5 overflow-x-auto -mb-px px-3 sm:px-4 lg:px-5">
              {STEPS.map((step) => {
                const isCompleted = isStepComplete(step.id);
                const isCurrent = step.id === currentStep;
                const showCheck = isCompleted && !isCurrent;

                return (
                  <div
                    key={step.id}
                    className={`relative flex items-center gap-2 pb-2.5 sm:pb-3 ${
                      step.id < currentStep ? 'cursor-pointer' : 'cursor-default'
                    }`}
                    onClick={() => { if (step.id < currentStep) setCurrentStep(step.id); }}
                  >
                    {/* Circle Indicator */}
                    <div
                      className={`w-[22px] h-[22px] sm:w-6 sm:h-6 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 ${
                        showCheck
                          ? 'bg-[#10B981] text-white'
                          : isCurrent
                          ? 'bg-[#0A77FF] text-white'
                          : 'border-[1.5px] border-[#CBD5E1] text-[#64748B] bg-white'
                      }`}
                    >
                      {showCheck ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <span className="text-[11px] sm:text-[12px]" style={{ fontWeight: 600 }}>
                          {step.id}
                        </span>
                      )}
                    </div>

                    {/* Label */}
                    <span
                      className={`text-[12px] sm:text-[13px] whitespace-nowrap transition-colors ${
                        isCurrent
                          ? 'text-[#0A77FF]'
                          : showCheck
                          ? 'text-[#10B981]'
                          : 'text-[#334155]'
                      }`}
                      style={{ fontWeight: isCurrent || showCheck ? 600 : 500 }}
                    >
                      {step.label}
                    </span>

                    {/* Active/completed bottom indicator */}
                    {(isCurrent || showCheck) && (
                      <div className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full ${showCheck ? 'bg-[#10B981]' : 'bg-[#0A77FF]'}`} />
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

          {/* Footer */}
          <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 flex items-center justify-end gap-2 sm:gap-2.5 sm:rounded-b-2xl">
            {/* Back button (shown after step 1) */}
            {currentStep > 1 && (
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                className="inline-flex items-center gap-1.5 text-xs sm:text-[13px] text-[#64748B] hover:text-[#0F172A] transition-colors mr-auto"
                style={{ fontWeight: 500 }}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Back</span>
              </button>
            )}

            {/* Cancel */}
            <button
              onClick={handleClose}
              className="border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 transition-colors"
              style={{ fontWeight: 500 }}
            >
              Cancel
            </button>

            {currentStep < 2 ? (
              /* Continue button */
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={!isStepComplete(currentStep)}
                className={`gap-1.5 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 shadow-sm transition-colors inline-flex items-center ${
                  isStepComplete(currentStep)
                    ? 'bg-[#0A77FF] text-white hover:bg-[#0862D0]'
                    : 'bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed'
                }`}
                style={{ fontWeight: 500 }}
              >
                Continue
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <>
                {/* Create & Make Another */}
                <button
                  onClick={() => {
                    if (onQuoteCreated) {
                      onQuoteCreated(quoteDraft);
                    }
                    toast.success('Quote created! Starting a new one...');
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
                    setCurrentStep(1);
                    setHasUnsavedChanges(false);
                  }}
                  disabled={!isStepComplete(currentStep)}
                  className={`rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 transition-colors inline-flex items-center border ${
                    isStepComplete(currentStep)
                      ? 'border-[#0A77FF] text-[#0A77FF] hover:bg-[#F0F7FF]'
                      : 'border-[#E2E8F0] text-[#94A3B8] cursor-not-allowed'
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  Create & Make Another
                </button>

                {/* Create Quote */}
                <button
                  onClick={() => {
                    let newQuoteId: string | undefined;
                    let newQuoteNumber: string | undefined;
                    if (onQuoteCreated) {
                      const result = onQuoteCreated(quoteDraft);
                      newQuoteId = result.quoteId;
                      newQuoteNumber = result.quoteNumber;
                    }
                    if (onNavigateToQuote && newQuoteId) {
                      onNavigateToQuote(newQuoteId);
                    } else {
                      onClose();
                    }
                    const TOAST_DURATION = 5000;
                    const quoteLabel = newQuoteNumber || quoteDraft.id;
                    toast.custom((tid) => {
                      return (
                        <QuoteCreatedToast
                          toastId={tid}
                          quoteLabel={quoteLabel}
                          customerName={quoteDraft.customer?.name || 'Customer'}
                          duration={TOAST_DURATION}
                        />
                      );
                    }, { position: 'top-right', duration: TOAST_DURATION + 500 });
                  }}
                  disabled={!isStepComplete(currentStep)}
                  className={`gap-1.5 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 shadow-sm transition-colors inline-flex items-center ${
                    isStepComplete(currentStep)
                      ? 'bg-[#0A77FF] text-white hover:bg-[#0862D0]'
                      : 'bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed'
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  Create Quote
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Unsaved Changes Confirmation Modal */}
      <ConfirmationModal
        isOpen={showUnsavedConfirm}
        title="Unsaved Changes"
        message="You have unsaved changes. Are you sure you want to close?"
        confirmText="Yes, Close"
        cancelText="No, Keep Editing"
        onConfirm={() => {
          animateAndClose();
          setShowUnsavedConfirm(false);
        }}
        onCancel={() => setShowUnsavedConfirm(false)}
        variant="red"
      />
    </div>
  );
}