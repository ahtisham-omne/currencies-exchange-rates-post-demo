import { COMPANY_CURRENCY } from '@/app/data/ar/arGlAccounts';
import type { CustomerDeposit } from '@/app/data/ar/mockCustomerDeposits';
import { depositRemaining } from '@/app/data/ar/customerInvoiceStatus';
import { lockedUnitsFor, unitsAllocated } from '@/app/data/ar/mockCustomers';
import {
  CLOSED_PERIOD_MSG,
  EPS,
  closedPeriod,
  fmtQty,
  money,
  type AdvanceAvail,
  type DuplicateHit,
  type FormContext,
  type FormState,
  type Issue,
  type Totals,
} from './formModel';

// Submit / Approve validation, in page order so the FIRST issue is the
// one highlighted and scrolled to (never-disabled CTA rule). Field ids
// are the DOM ids the screen renders.

export const fid = {
  termGate: 'cif-term-gate',
  invoiceNumber: 'cif-invoice-number',
  invoiceDate: 'cif-invoice-date',
  postingDate: 'cif-posting-date',
  triggerDate: 'cif-trigger-date',
  lines: 'cif-lines',
  qty: (k: string) => `cif-qty-${k}`,
  price: (k: string) => `cif-price-${k}`,
  rev: (k: string) => `cif-rev-${k}`,
  desc: (k: string) => `cif-desc-${k}`,
  advAmount: (k: string) => `cif-adv-${k}`,
  units: (k: string) => `cif-units-${k}`,
  arAccount: 'cif-ar-account',
  depositAccount: 'cif-deposit-account',
  stage: 'cif-stage',
  chargeType: (k: string) => `cif-charge-type-${k}`,
  chargeDesc: (k: string) => `cif-charge-desc-${k}`,
  chargeAcct: (k: string) => `cif-charge-acct-${k}`,
  freightAccount: 'cif-freight-account',
  deposit: (id: string) => `cif-deposit-${id}`,
  // FAD 11/2
  treatment: 'cif-treatment',
  fxRate: 'cif-fx-rate',
  flagReason: 'cif-flag-reason',
  flagDesc: 'cif-flag-desc',
  disputeReason: 'cif-dispute-reason',
  disputeDesc: 'cif-dispute-desc',
};

export function validateForSubmit(args: {
  ctx: FormContext;
  s: FormState;
  totals: Totals;
  shipAvail: Map<string, number>;
  advAvail: AdvanceAvail;
  deposits: CustomerDeposit[];
  depositsApplied: number;
  glBalanced: boolean;
  /** FAD 11/2: effective pre-invoice treatment (Revenue posts at approval). */
  treatment?: 'Revenue' | 'Deposit';
  /** FAD 11/2: lines already billed by another live invoice. */
  duplicates?: Map<string, DuplicateHit>;
  /** FAD 11/2: units still open on each line's SO line. */
  orderedLeft?: Map<string, number>;
}): Issue[] {
  const { ctx, s, totals, shipAvail, advAvail, deposits, depositsApplied } = args;
  const duplicates = args.duplicates ?? new Map<string, DuplicateHit>();
  const issues: Issue[] = [];
  const cur = s.currency;
  const name = ctx.customerName || 'the customer';
  const isAdv = ctx.kind === 'Advance Invoice';
  // A Revenue pre-invoice posts at approval, so it needs a posting date
  // and an A/R account like any other invoice (FAD 11/2).
  const posts = !isAdv || args.treatment === 'Revenue';

  if (isAdv && !s.termApplied) {
    issues.push({ fieldId: fid.termGate, message: 'Net terms do not fit an advance invoice. Use Change on Payment Terms to pick a prepayment or split term.', section: 'general-info' });
    return issues;
  }

  if (!s.invoiceNumber.trim()) issues.push({ fieldId: fid.invoiceNumber, message: 'Enter an invoice number.' });
  if (!s.invoiceDate) issues.push({ fieldId: fid.invoiceDate, message: 'Pick an invoice date.' });
  if (posts) {
    if (!s.postingDate) issues.push({ fieldId: fid.postingDate, message: 'Pick a posting date.' });
    else if (closedPeriod(s.postingDate)) issues.push({ fieldId: fid.postingDate, message: CLOSED_PERIOD_MSG });
  }
  if (!isAdv && !s.triggerDate) issues.push({ fieldId: fid.triggerDate, message: 'Pick a trigger date so the due date can be worked out.' });
  if (s.currency !== COMPANY_CURRENCY && !(s.fxRate > 0)) issues.push({ fieldId: fid.fxRate, message: `Enter the ${s.currency} to ${COMPANY_CURRENCY} rate at the invoice date.`, section: 'general-info' });

  // Lines
  if (ctx.kind === 'Shipment Invoice') {
    const billed = s.lines.filter((l) => l.invoiceQty > EPS);
    if (billed.length === 0) issues.push({ fieldId: fid.lines, message: 'Bill at least one line. Every invoice quantity is zero.' });
    for (const l of s.lines) {
      if (l.manual) continue;
      // Duplicate check on Post (FAD 11/2) comes before the quantity cap.
      const dup = duplicates.get(l.key);
      if (dup) {
        issues.push({ fieldId: fid.qty(l.key), message: dup.message });
        continue;
      }
      const avail = shipAvail.get(l.shipmentLineId ?? '') ?? 0;
      if (l.invoiceQty > avail + EPS) {
        issues.push({ fieldId: fid.qty(l.key), message: `You can bill up to ${fmtQty(avail)} on this line.` });
        continue;
      }
      const left = args.orderedLeft?.get(l.key);
      if (left !== undefined && l.invoiceQty > left + EPS) {
        issues.push({ fieldId: fid.qty(l.key), message: `${l.sku} bills more than is left on SO ${l.soNumber}. You can bill up to ${fmtQty(left)}.` });
      }
    }
    for (const l of billed) {
      if (!l.manual && !l.glAccount) issues.push({ fieldId: fid.rev(l.key), message: `Set a revenue account on ${l.sku} first.` });
    }
    // Manual lines (FAD 11/2): description, quantity, rate and account.
    for (const l of s.lines.filter((x) => x.manual)) {
      if (!l.description.trim()) issues.push({ fieldId: fid.desc(l.key), message: 'Every added line needs a description.' });
      if (l.invoiceQty <= EPS) issues.push({ fieldId: fid.qty(l.key), message: 'Enter a quantity above zero on every added line.' });
      if (l.unitPrice <= EPS) issues.push({ fieldId: fid.price(l.key), message: 'Enter a rate on every added line.' });
      if (!l.glAccount) issues.push({ fieldId: fid.rev(l.key), message: 'Every added line needs a revenue account.' });
    }
  } else if (isAdv) {
    const billed = s.lines.filter((l) => (l.advanceAmount ?? 0) > EPS);
    if (billed.length === 0) issues.push({ fieldId: fid.lines, message: 'Enter an advance amount on at least one line.' });
    if (totals.total > advAvail.availableTotal + EPS) {
      issues.push({
        fieldId: fid.advAmount(s.lines.find((l) => (l.advanceAmount ?? 0) > (advAvail.perLine.get(l.soLineId ?? '') ?? 0) + EPS)?.key ?? s.lines[0]?.key ?? ''),
        message: `You can advance-bill up to ${money(advAvail.availableTotal, cur)} on this order.`,
      });
    }
    for (const l of s.lines) {
      const cap = advAvail.perLine.get(l.soLineId ?? '') ?? 0;
      if ((l.advanceAmount ?? 0) > cap + EPS) {
        issues.push({ fieldId: fid.advAmount(l.key), message: `You can advance-bill up to ${money(cap, cur)} on this line.` });
      }
      // Revenue on invoice (Mahreen 11/4): every open unit is locked to the customer.
      if (args.treatment === 'Revenue' && !l.manual && l.soLineId && (l.advanceAmount ?? 0) > EPS) {
        const u = lockedUnitsFor(l, ctx.so?.lines.find((x) => x.id === l.soLineId));
        const got = unitsAllocated(u.units);
        if (got < u.needed) {
          issues.push({ fieldId: fid.units(l.key), message: `Lock ${u.needed - got} more ${u.tracking === 'Serial' ? 'serial numbers' : 'units from a lot'} on ${l.sku}. Revenue on invoice locks every open unit.` });
        }
      }
    }
  } else {
    const used = s.lines.filter((l) => l.description.trim() || l.unitPrice > EPS || l.glAccount);
    if (used.length === 0) issues.push({ fieldId: fid.lines, message: 'Add at least one line with a description and a rate.' });
    for (const l of s.lines) {
      if (!l.description.trim()) issues.push({ fieldId: fid.desc(l.key), message: 'Every line needs a description.' });
      if (l.invoiceQty <= EPS) issues.push({ fieldId: fid.qty(l.key), message: 'Every line needs a quantity above zero.' });
      if (!l.glAccount) issues.push({ fieldId: fid.rev(l.key), message: 'Every line needs a revenue account.' });
    }
  }

  // Rail: accounts
  if (posts && !s.arAccount) {
    issues.push({ fieldId: fid.arAccount, message: `Set an A/R account on ${name} first.`, section: 'general-info' });
  }
  if (isAdv && !posts && !s.depositAccount) {
    issues.push({ fieldId: fid.depositAccount, message: `Set a customer deposit account on ${name} first.`, section: 'general-info' });
  }

  // Freight and charges (BR-013)
  if (!isAdv) {
    if (s.freightAmount > EPS && !s.freightAccount) {
      issues.push({ fieldId: fid.freightAccount, message: 'Pick a freight income account.', section: 'freight' });
    }
    for (const c of s.charges) {
      if (!c.type) issues.push({ fieldId: fid.chargeType(c.key), message: 'Pick a type for every charge, or remove the empty one.', section: 'charges' });
      else if (c.type === 'Other' && !c.description.trim()) {
        issues.push({ fieldId: fid.chargeDesc(c.key), message: 'Describe the charge. "Other" needs a description.', section: 'charges' });
      }
      if (c.type && !c.account) issues.push({ fieldId: fid.chargeAcct(c.key), message: 'Pick an account for every charge.', section: 'charges' });
    }
  }

  // Deposits (payment side): never above what is held or what is owed.
  if (ctx.kind === 'Shipment Invoice') {
    for (const d of deposits) {
      const amt = s.depositAmounts[d.id] ?? 0;
      if (amt > depositRemaining(d) + EPS) {
        issues.push({ fieldId: fid.deposit(d.id), message: `You can apply up to ${money(depositRemaining(d), cur)} from ${d.depositNumber}.`, section: 'deposits' });
      }
    }
    if (depositsApplied > totals.total + EPS) {
      issues.push({ fieldId: fid.deposit(deposits[0]?.id ?? ''), message: `Deposits applied cannot be more than the invoice total of ${money(totals.total, cur)}.`, section: 'deposits' });
    }
  }

  // Dispute at creation (vendor Payment Hold slot, user 11/4): a type,
  // and a description when the type is Other.
  if (s.disputeOn) {
    if (!s.disputeReason) issues.push({ fieldId: fid.disputeReason, message: 'Pick a dispute type.', section: 'dispute' });
    else if (s.disputeReason === 'Other' && !s.disputeDescription.trim()) {
      issues.push({ fieldId: fid.disputeDesc, message: 'Describe the dispute. "Other" needs a description.', section: 'dispute' });
    }
  }

  // Dispute or exception at creation (FAD 11/2): a reason, and a
  // description when the reason is Other.
  if (s.flagOn) {
    if (!s.flagReason) issues.push({ fieldId: fid.flagReason, message: 'Pick an exception type.', section: 'flag' });
    else if (s.flagReason === 'Other' && !s.flagDescription.trim()) {
      issues.push({ fieldId: fid.flagDesc, message: 'Describe the issue. "Other" needs a description.', section: 'flag' });
    }
  }

  if (posts && !args.glBalanced) {
    issues.push({ fieldId: 'cif-gl', message: 'The journal entry does not balance. Check the lines, freight and charges.', section: 'gl-impact' });
  }
  return issues;
}
