import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { PaymentTermCard } from '@/app/components/vendors/PaymentTermCard';
import { arTermById, termLockReason, type ArInvoiceKind } from '@/app/data/ar/arPaymentTerms';
import { TermBrowseModal } from './form/TermBrowseModal';

export interface MixedTermPair {
  soNumber: string;
  termId: string;
}

interface ArMixedTermsGateProps {
  kind: ArInvoiceKind;
  pairs: MixedTermPair[];
  /** Opens the term templates straight away (every order term is the wrong kind). */
  templatesOnly?: boolean;
  /** Preselected term in the templates list. */
  fallbackTermId?: string;
  onBack: () => void;
  onConfirm: (termId: string) => void;
}

// BR-003: one payment term per invoice. A fork of the vendor mixed-terms
// gate in InvoiceCreationFlow (amber gradient hero, each order's term in
// the term hover treatment, "Use for all" per row, the templates route and
// Back to selection). The templates route opens the AR Browse Payment
// Terms modal; its Apply resolves the gate.
export function ArMixedTermsGate({ kind, pairs, templatesOnly = false, fallbackTermId, onBack, onConfirm }: ArMixedTermsGateProps) {
  const [browsing, setBrowsing] = useState(templatesOnly);
  const blockedOf = (termId: string) => {
    const t = arTermById(termId);
    return t ? termLockReason(kind, t) : 'This term no longer exists.';
  };
  const allBlocked = pairs.every(({ termId }) => !!blockedOf(termId));
  const noun = kind === 'Advance Invoice' ? 'an advance invoice' : 'an invoice';

  if (browsing) {
    return (
      <TermBrowseModal
        open
        onOpenChange={(v) => { if (!v) { if (templatesOnly) onBack(); else setBrowsing(false); } }}
        kind={kind}
        currentId={fallbackTermId ?? ''}
        onApply={(term) => onConfirm(term.id)}
      />
    );
  }

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
          <p className="text-[13px] mt-2 mx-auto text-muted-foreground" style={{ lineHeight: 1.7, maxWidth: '340px' }}>
            {allBlocked
              ? `The selected sales orders use terms that can't be used for ${noun}. Choose a different term from your payment term templates.`
              : `We detected multiple payment terms across the selected sales orders, and ${noun} follows a single term. Use one of the terms below for every order, or choose a different term from the templates.`}
          </p>
        </div>
        <div className="px-6 pt-4 space-y-1.5 max-h-[200px] overflow-y-auto">
          {pairs.map(({ soNumber, termId }) => {
            const term = arTermById(termId);
            const kindBlocked = blockedOf(termId);
            return (
              <div
                key={soNumber}
                className={`w-full px-3 py-2 rounded-lg border transition-colors ${
                  kindBlocked ? 'border-slate-200 bg-slate-50/60' : 'border-slate-200 bg-white hover:border-primary/40 hover:bg-blue-50/40'
                }`}
              >
                <div className="w-full flex items-center justify-between gap-2">
                  <span className="min-w-0 inline-flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 shrink-0" style={{ fontWeight: 600 }}>
                      SO No. {soNumber} ·
                    </span>
                    {term ? (
                      <HoverCard openDelay={300} closeDelay={120}>
                        <HoverCardTrigger asChild>
                          <span
                            className={`min-w-0 text-[12px] truncate hover:text-primary hover:underline transition-colors cursor-default ${kindBlocked ? 'text-slate-500' : 'text-foreground'}`}
                            style={{ fontWeight: 500 }}
                          >
                            {term.name}
                          </span>
                        </HoverCardTrigger>
                        <HoverCardContent side="bottom" align="start" sideOffset={6} className="p-0 bg-transparent border-0 shadow-none w-[300px] z-[420]">
                          <div className="rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
                            <PaymentTermCard term={term} readOnly hideCheckmark />
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    ) : (
                      <span className="text-[12px] text-slate-500">{termId}</span>
                    )}
                  </span>
                  {!kindBlocked && (
                    <button
                      type="button"
                      onClick={() => onConfirm(termId)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-primary/40 bg-white text-primary hover:bg-blue-50 cursor-pointer text-[10px] whitespace-nowrap shrink-0 transition-colors"
                      style={{ fontWeight: 600 }}
                    >
                      Use for All
                    </button>
                  )}
                </div>
                {kindBlocked && <p className="text-[10px] text-rose-500 leading-snug mt-1 text-left">{kindBlocked}</p>}
              </div>
            );
          })}
        </div>
        <div className="px-6 pt-4 pb-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => setBrowsing(true)}
            className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
            style={{ fontWeight: 600, backgroundColor: '#D97706', color: '#fff' }}
          >
            {allBlocked ? 'Choose a Different Term' : 'Choose a Different Term from the Templates'}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
            style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
          >
            Back to Selection
          </button>
        </div>
      </div>
    </div>
  );
}
