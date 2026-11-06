import React from 'react';
import { Calendar, Clock, Info } from 'lucide-react';
import { SmallCard } from '@/app/components/shared/SmallCard';
import { RelativeDateValue } from '@/app/components/shared/RelativeDateValue';
import { DateFieldPopover } from '@/app/components/shared/DateFieldPopover';

interface DateConfigCardsProps {
  requestDateType: 'absolute' | 'relative';
  requestDateValue: string;
  requestUnit: string;
  effectiveWhenSent: boolean;
  effectiveDateType: 'absolute' | 'relative';
  effectiveDateValue: string;
  effectiveUnit: string;
  hasExpiry: boolean;
  expiryType: 'absolute' | 'relative';
  expiryValue: string;
  expiryUnit: string;
  onEdit: (card: 'request' | 'effective' | 'expiry') => void;
  /** Direct date-only update — fires from the inline popover when the
   *  user picks a date for a card that's currently in absolute mode
   *  with no other toggles active. Caller updates state without
   *  spinning up the full DateEditModal. When omitted, the popover is
   *  not rendered and clicks fall back to onEdit. */
  onSimpleDateChange?: (card: 'request' | 'effective' | 'expiry', date: Date) => void;
  /** Stack the three date cards vertically instead of laying them out
   *  in a 3-column grid. Used by Step 2 in full-view mode where the
   *  cards live inside a narrow right-side column. */
  isStacked?: boolean;
  /** Rendered as the last cell of the same row, so priority sits beside the
   *  dates rather than starting a second row. Mirrors the SO layout. */
  trailingElement?: React.ReactNode;
}

/* Parse a mm/dd/yyyy string into a Date. Returns undefined for empty
   or relative values like "7 days before today". */
function parseMMDDYYYY(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return undefined;
  const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  return isNaN(d.getTime()) ? undefined : d;
}

export function DateConfigCards({
  requestDateType,
  requestDateValue,
  requestUnit,
  effectiveWhenSent,
  effectiveDateType,
  effectiveDateValue,
  effectiveUnit,
  hasExpiry,
  expiryType,
  expiryValue,
  expiryUnit,
  onEdit,
  onSimpleDateChange,
  isStacked = false,
  trailingElement,
}: DateConfigCardsProps) {
  const fmtNow = () => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const getRequestDisplay = () => {
    if (requestDateType === 'absolute') {
      return requestDateValue || fmtNow();
    }
    /* Relative: show the day it resolves to, with the rule on hover. */
    const resolved = fmt(addUnits(new Date(), -Number(requestDateValue), requestUnit));
    return (
      <RelativeDateValue
        display={resolved}
        rule={`${requestDateValue} ${requestUnit} before today`}
        anchor="today"
      />
    );
  };

  const getEffectiveDisplay = () => {
    if (effectiveWhenSent) {
      /* Also a relative date: it lands on the send date. Like every other
         relative card it shows a date, the day it lands on if the quote is
         sent today, and the asterisk's hover card explains the rule. */
      return (
        <RelativeDateValue
          display={fmtNow()}
          rule="set to the day the quote is sent"
          anchor="the send date"
        />
      );
    }
    if (effectiveDateType === 'absolute') {
      return effectiveDateValue || fmtNow();
    }
    const resolved = fmt(addUnits(new Date(), Number(effectiveDateValue), effectiveUnit));
    return (
      <RelativeDateValue
        display={resolved}
        rule={`${effectiveDateValue} ${effectiveUnit} after the quote is sent`}
        anchor="the send date"
      />
    );
  };

  const getExpiryDisplay = () => {
    if (!hasExpiry) {
      return 'Never expires';
    }
    if (expiryType === 'absolute') {
      return expiryValue || fmtNow();
    }
    const resolved = fmt(addUnits(new Date(), Number(expiryValue), expiryUnit));
    return (
      <RelativeDateValue
        display={resolved}
        rule={`${expiryValue} ${expiryUnit} after the quote is sent`}
        anchor="the send date"
      />
    );
  };

  /* Inline-popover criteria per card. When in absolute mode with no
     override toggles active, picking a date is the only thing the
     user wants — open a popover with the shared Calendar instead of
     the full DateEditModal. The modal still opens via "Advanced
     settings" inside the popover for switching to relative mode. */
  const requestPopoverable = requestDateType === 'absolute' && !!onSimpleDateChange;
  const effectivePopoverable = effectiveDateType === 'absolute' && !effectiveWhenSent && !!onSimpleDateChange;
  const expiryPopoverable = expiryType === 'absolute' && hasExpiry && !!onSimpleDateChange;


/* A relative offset resolved against today, so a card can show the day the
   rule currently lands on rather than the rule itself. */
function addUnits(from: Date, amount: number, unit: string): Date {
  const d = new Date(from);
  const n = Number.isFinite(amount) ? amount : 0;
  if (/week/i.test(unit)) d.setDate(d.getDate() + n * 7);
  else if (/month/i.test(unit)) d.setMonth(d.getMonth() + n);
  else d.setDate(d.getDate() + n);
  return d;
}

function fmt(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

  const requestCard = (
    <SmallCard
      icon={Calendar}
      variant="field"
      title="Request date"
      subtitle={getRequestDisplay()}
      onClick={requestPopoverable ? undefined : () => onEdit('request')}
    />
  );
  const effectiveCard = (
    <SmallCard
      icon={Clock}
      variant="field"
      title="Effective from"
      subtitle={getEffectiveDisplay()}
      onClick={effectivePopoverable ? undefined : () => onEdit('effective')}
    />
  );
  const expiryCard = (
    <SmallCard
      icon={Info}
      variant="field"
      title="Expiration date"
      subtitle={getExpiryDisplay()}
      onClick={expiryPopoverable ? undefined : () => onEdit('expiry')}
    />
  );

  return (
    <div className={isStacked ? 'grid grid-cols-1 gap-3' : trailingElement ? 'grid grid-cols-4 gap-3' : 'grid grid-cols-3 gap-3'}>
      {requestPopoverable ? (
        <DateFieldPopover
          value={parseMMDDYYYY(requestDateValue)}
          onChange={(d) => onSimpleDateChange!('request', d)}
          onAdvanced={() => onEdit('request')}
        >
          {requestCard}
        </DateFieldPopover>
      ) : requestCard}

      {effectivePopoverable ? (
        <DateFieldPopover
          value={parseMMDDYYYY(effectiveDateValue)}
          onChange={(d) => onSimpleDateChange!('effective', d)}
          onAdvanced={() => onEdit('effective')}
        >
          {effectiveCard}
        </DateFieldPopover>
      ) : effectiveCard}

      {expiryPopoverable ? (
        <DateFieldPopover
          value={parseMMDDYYYY(expiryValue)}
          onChange={(d) => onSimpleDateChange!('expiry', d)}
          onAdvanced={() => onEdit('expiry')}
        >
          {expiryCard}
        </DateFieldPopover>
      ) : expiryCard}

      {trailingElement}

    </div>
  );
}
