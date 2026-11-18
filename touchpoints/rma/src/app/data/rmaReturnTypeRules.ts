/**
 * Which return types a line may take.
 *
 * Two rules narrow the choice. The reason says what kind of remedy makes
 * sense: a defective item goes back for a credit or a replacement, never on
 * its own. The line's invoice state says what is financially possible right
 * now: there is nothing to credit until something has been billed.
 *
 * They agree on almost every combination. Where they do not, the reason wins
 * and the caller shows the accrual warning, because refusing every type would
 * leave the line unfinishable.
 */

import type { ReturnReason, ReturnType } from './mockRMAs';
import type { LineInvoiceSplit } from './receiptInvoiceStatus';

/** What a return can be asked for.
 *
 *  Repair and replacement are deferred from this release (brief 8.4). Return
 *  Only left with them: it is not a thing anybody chooses, it is what a
 *  return of goods nobody has paid for already is, and the system books it
 *  without asking. The union keeps both members because returns raised
 *  before this carry them and a record has to be able to say what it is, and
 *  because the accounting still writes `Return Only` where that is what
 *  happened.
 *
 *  What is left to ask is money back against a credit, and the resolution
 *  step asks that only where the receipt has actually been paid. */
export const RETURN_TYPES: ReturnType[] = ['Refund/Credit'];

interface ReasonRule {
  types: ReturnType[];
  /** Null on 'Other', which says nothing about the remedy, so the user picks. */
  fallback: ReturnType | null;
}

const REASON_RULES: Record<ReturnReason, ReasonRule> = {
  // No fallback on either of these. A failed inspection is not guaranteed to
  // be a replacement and neither is a wrong variant, so filling one in was
  // answering for the user (brief 8.6). They pick.
  'Failed inspection': {
    types: ['Refund/Credit', 'Return Only'],
    fallback: null,
  },
  'Wrong item or variant': {
    types: ['Refund/Credit', 'Return Only'],
    fallback: null,
  },
  'Over-shipped': {
    types: ['Return Only'],
    fallback: 'Return Only',
  },
  'Not ordered': {
    types: ['Return Only', 'Refund/Credit'],
    fallback: 'Return Only',
  },
  'Price or terms discrepancy': {
    types: ['Refund/Credit'],
    fallback: 'Refund/Credit',
  },
  Other: {
    types: ['Refund/Credit', 'Return Only'],
    fallback: null,
  },
};

/** A pre-invoice line has no receipt behind it, so its invoice state is
 *  unknown rather than empty, and the rule stays out of the way. */
function invoiceAllows(type: ReturnType, split: LineInvoiceSplit | undefined): boolean {
  if (type !== 'Refund/Credit') return true;
  if (!split) return true;
  return split.invoicedUnpaid + split.paid > 0.004;
}

export interface ReturnTypeOption {
  type: ReturnType;
  disabled: boolean;
}

/** A draft saved before the reason list last changed carries a reason no rule
 *  knows, and refusing to read it would take the line down rather than let it
 *  be corrected. An unrecognised reason implies nothing, so it is judged on
 *  the invoice state alone. */
function ruleFor(reason: ReturnReason): ReasonRule {
  return REASON_RULES[reason] ?? REASON_RULES.Other;
}

export function returnTypeOptions(
  reason: ReturnReason,
  split: LineInvoiceSplit | undefined,
): ReturnTypeOption[] {
  const rule = ruleFor(reason);
  const allowedByInvoice = rule.types.filter((t) => invoiceAllows(t, split));
  const enabled = new Set(allowedByInvoice.length > 0 ? allowedByInvoice : rule.types);
  return RETURN_TYPES.map((type) => ({ type, disabled: !enabled.has(type) }));
}

/** The type to start on when the reason changes. Null means the reason
 *  implies nothing, so the field stays empty until the user chooses. */
export function defaultReturnType(
  reason: ReturnReason,
  split: LineInvoiceSplit | undefined,
): ReturnType | null {
  const options = returnTypeOptions(reason, split);
  const preferred = ruleFor(reason).fallback;
  if (preferred && options.some((o) => o.type === preferred && !o.disabled)) return preferred;
  if (preferred === null) return null;
  return options.find((o) => !o.disabled)?.type ?? null;
}

/** Shown under the field when a credit is being claimed against a line that
 *  was never billed, since the entry that books is not the one the type
 *  implies. Reads off the same rule the GL entry builder uses. */
export function accrualWarning(
  type: ReturnType | undefined,
  split: LineInvoiceSplit | undefined,
): string | null {
  if (!type || invoiceAllows(type, split)) return null;
  return 'Nothing on this line has been invoiced yet, so this reverses the goods-receipt accrual rather than crediting an invoice.';
}
