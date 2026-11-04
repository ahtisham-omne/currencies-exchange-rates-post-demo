import { useState, type ReactNode } from 'react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { PaymentTermDetailsModal } from '@/app/components/PaymentTermDetailsModal';
import { PaymentTermCard } from '@/app/components/vendors/PaymentTermCard';
import { highlightText } from '@/app/components/InvoiceDataTable';
import type { PaymentTermPreset } from '@/app/data/paymentTermPresets';
import { arTermById, arTermByName, stagesForTerm } from '@/app/data/ar/arPaymentTerms';

/* ─── Payment terms cell — the AR fork of the vendor listing's TermName
 *  (InvoiceDataTable): the term NAME turns primary-blue on hover with
 *  the full partner card in a hover card, and a click opens the term's
 *  details modal. Terms resolve from the AR catalog (arPaymentTerms), so
 *  the card and the modal read the customer term, never a vendor preset
 *  that happens to share the label. */

/** The AR term an id or a printed name points at. */
export function resolveArTerm(termId?: string, label?: string): PaymentTermPreset | undefined {
  return arTermById(termId) ?? arTermByName(label);
}

interface CustomerTermNameProps {
  term: PaymentTermPreset;
  searchQuery?: string;
  /** Overrides the printed label (defaults to the term name). */
  label?: string;
  /** Opt-in slice selection for the hover card (the Stage column):
   *  index of the stage this row bills. */
  stageIndex?: number;
  /** Card typography (user 9/28): 12px, the card's value scale. */
  card?: boolean;
}

export function CustomerTermName({ term, searchQuery, label, stageIndex, card }: CustomerTermNameProps) {
  // Click opens the partner-style details modal (8/31/26 system rule:
  // a payment term name is always a door to its details).
  const [detailOpen, setDetailOpen] = useState(false);
  const text = label ?? term.name;
  return (
    <>
      {detailOpen && (
        <PaymentTermDetailsModal termLabel={term.name} term={term} onClose={() => setDetailOpen(false)} />
      )}
      <HoverCard openDelay={300} closeDelay={120}>
        <HoverCardTrigger asChild>
          <span
            className={`inline-flex max-w-full cursor-pointer align-middle text-slate-700 whitespace-nowrap hover:text-primary hover:underline transition-colors ${card ? 'text-[12px]' : ''}`}
            style={{ fontWeight: 400 }}
            onClick={(e) => {
              e.stopPropagation();
              setDetailOpen(true);
            }}
          >
            <span className="truncate">{highlightText(text, searchQuery)}</span>
          </span>
        </HoverCardTrigger>
        <HoverCardContent
          side="bottom"
          align="start"
          sideOffset={6}
          className="p-0 bg-transparent border-0 shadow-none w-[300px] z-[300]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <PaymentTermCard term={term} readOnly hideCheckmark {...stageSliceProps(term, stageIndex)} />
          </div>
        </HoverCardContent>
      </HoverCard>
    </>
  );
}

/** Slice chips on the hover card, pinned to the stage the row bills
 *  (the create screen's sidebar recipe). Net terms and terms without a
 *  stage pass nothing, so the card renders exactly as the vendor's. */
function stageSliceProps(term: PaymentTermPreset, stageIndex?: number) {
  if (!stageIndex || term.category !== 'split') return {};
  const stages = stagesForTerm(term);
  return {
    sliceIdx: Math.max(0, stageIndex - 1),
    onSliceSelect: () => undefined,
    splitNote: 'This row bills the highlighted stage. The balance is billed when the goods ship.',
    sliceDisabledReasons: stages.map((st) =>
      st.index === stageIndex
        ? null
        : st.kind === 'balance'
          ? `This ${st.percent}% stage is due ${st.netDays > 0 ? `${st.netDays} days after` : 'at'} ${st.trigger}, so it is billed on a shipment invoice.`
          : `This ${st.percent}% stage is due at ${st.trigger} and bills on its own advance invoice.`,
    ),
  };
}

/** Listing cell: the term name with its hover + modal, or the muted
 *  placeholder when the record carries no term. */
export function renderCustomerTermCell(
  termId: string | undefined,
  label: string | undefined,
  searchQuery?: string,
  placeholder?: ReactNode,
): ReactNode {
  const term = resolveArTerm(termId, label);
  if (!term) {
    return label ? (
      <span className="block truncate text-slate-700" style={{ fontWeight: 400 }}>{highlightText(label, searchQuery)}</span>
    ) : (
      placeholder ?? null
    );
  }
  return (
    <span className="flex items-center gap-2 flex-nowrap whitespace-nowrap overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <CustomerTermName term={term} label={label || term.name} searchQuery={searchQuery} />
    </span>
  );
}
