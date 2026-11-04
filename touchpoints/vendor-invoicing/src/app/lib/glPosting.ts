/* ── One GL rule (9/22/26 review response) ─────────────────────────────
 * The Sept 20 reviews' recurring defect was "preview is not the posting":
 * the create sidebar, the submit-confirm modal and the saved record each
 * built their own journal and disagreed (1200 Inventory vs 2100 AP
 * Accrual; 6100 vs 6000). This module is the single source: the sidebar
 * preview, the confirmation dialog and the persisted glEntries snapshot
 * all call the same builders, so they can never diverge again.
 *
 * The invoice logic is extracted verbatim from the create-sidebar rule
 * (accrual transfer for received goods per 8/25/26, capitalised freight
 * and charges for unreceived inventory per ASC 330, per-line expense
 * accounts for standalone).
 */

import { QTY_VARIANCE_ACCOUNT } from '@/app/data/glAccounts';

export interface GlRow {
  code: string;
  name: string;
  amount: number;
}

export interface GlEntryLine {
  accountCode: string;
  accountName: string;
  description?: string;
  debit?: number;
  credit?: number;
}

export interface InvoiceGlInput {
  /** 'standalone' expenses per line; 'received' transfers the receiving
   *  accrual; 'unreceived' is the classic Dr Inventory / Cr AP posting
   *  at receiving (pure PO-based). A pre-invoice posts nothing — callers
   *  persist an empty snapshot for those. */
  kind: 'standalone' | 'received' | 'unreceived';
  /** For 'standalone': amount = line amount. For inventory kinds:
   *  amount = lineTotal; accrualAmount = covered qty × original PO price
   *  for lines that have a receiving (grnDate), else 0. Covered qty is
   *  capped at the received quantity (BA 9/28): billing past the receipt
   *  carries the excess in varianceAmount, which debits the Purchase Qty
   *  Variance account instead of over-relieving the accrual. */
  lines: { glAccount: string; amount: number; accrualAmount?: number; varianceAmount?: number }[];
  freightAmount: number;
  freightGlAccount: string;
  additionalChargesTotal: number;
  additionalChargeGlAccount: string;
  /** Per-charge GL routing (Eli 10/5): when present, each charge debits
   *  its OWN account (standalone kind) instead of the single aggregate
   *  account. Any remainder (e.g. seeded tax) falls back to the
   *  aggregate. Inventory kinds still capitalise into inventory. */
  additionalChargeLines?: { glAccount: string; amount: number }[];
  apAccount: string;
  /** Full form total: subtotal + freight + charges. */
  total: number;
  /** Slice-adjusted document total (equals total off split terms). */
  sliceAdjustedTotal: number;
  sliceFraction: number;
}

export interface InvoiceGlResult {
  debits: GlRow[];
  credits: GlRow[];
  balanced: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export const splitAccount = (account: string): { code: string; name: string } => {
  const str = (account || '').trim();
  const spaceIdx = str.indexOf(' ');
  if (spaceIdx > 0) return { code: str.slice(0, spaceIdx), name: str.slice(spaceIdx + 1) };
  // Seed records store some accounts dash-joined ("2110-AP-Trade").
  const m = str.match(/^(\d+)-(.+)$/);
  if (m) return { code: m[1], name: m[2].replace(/-/g, ' ') };
  return { code: str, name: '' };
};

export function buildInvoiceGl(input: InvoiceGlInput): InvoiceGlResult {
  const {
    kind, lines, freightAmount, freightGlAccount,
    additionalChargesTotal, additionalChargeGlAccount, additionalChargeLines,
    apAccount, total, sliceAdjustedTotal, sliceFraction,
  } = input;

  const drMap = new Map<string, number>();
  // Extra credit line beside A/P — used when the invoice prices received
  // goods BELOW the PO estimate, so the correction lands credit-side.
  let inventoryCredit = 0;
  const inventoryAccount = lines[0]?.glAccount || '1200 Inventory';

  // Freight and each additional charge debit the account picked for them
  // on EVERY invoice type (Known 1, Eli 10/5): the per-charge account the
  // form shows — Handling Fees → 6000 General & Admin, say — is the account
  // the journal posts to, instead of silently capitalising into Inventory.
  // Any remainder with no line (e.g. seeded tax) falls back to the
  // aggregate account. The goods math below works on the goods-only total,
  // so the books stay balanced however the charges route.
  const applyFreightAndCharges = (fraction: number) => {
    if (freightAmount > 0) {
      drMap.set(freightGlAccount, round2((drMap.get(freightGlAccount) || 0) + freightAmount * fraction));
    }
    if (additionalChargeLines && additionalChargeLines.length > 0) {
      let linesSum = 0;
      additionalChargeLines.forEach((c) => {
        if (c.amount > 0) {
          drMap.set(c.glAccount, round2((drMap.get(c.glAccount) || 0) + c.amount * fraction));
          linesSum = round2(linesSum + c.amount);
        }
      });
      const remainder = round2(additionalChargesTotal - linesSum);
      if (remainder > 0.004) drMap.set(additionalChargeGlAccount, round2((drMap.get(additionalChargeGlAccount) || 0) + remainder * fraction));
    } else if (additionalChargesTotal > 0) {
      drMap.set(additionalChargeGlAccount, round2((drMap.get(additionalChargeGlAccount) || 0) + additionalChargesTotal * fraction));
    }
  };

  // Goods-only document value — freight and charges leave for their own
  // accounts, so only the goods portion feeds the inventory/accrual math.
  const goodsTotal = round2(total - freightAmount - additionalChargesTotal);

  if (kind === 'standalone') {
    // Each line expenses to the GL account picked at the line level.
    lines.forEach((li) => {
      if (li.amount > 0 && li.glAccount) {
        drMap.set(li.glAccount, round2((drMap.get(li.glAccount) || 0) + li.amount));
      }
    });
    applyFreightAndCharges(1);
  } else if (kind === 'received') {
    // Accrual model (8/25/26): receiving booked Dr Inventory / Cr AP
    // Accrual at PO price. This entry transfers the liability: Dr AP
    // Accrual at received PO value, Cr Accounts Payable at the invoice
    // total, price variance correcting Inventory on whichever side the
    // difference falls. Quantity billed past the receipt (BA 9/28) debits
    // the variance account: only what was received can leave the accrual.
    const accrualValue = round2(lines.reduce((s, li) => s + (li.accrualAmount ?? 0), 0));
    const varianceValue = round2(lines.reduce((s, li) => s + (li.varianceAmount ?? 0), 0));
    if (accrualValue > 0) drMap.set('2100 AP Accrual', accrualValue);
    if (varianceValue > 0.004) drMap.set(QTY_VARIANCE_ACCOUNT, varianceValue);
    // Goods-only correction: only the goods price variance touches
    // Inventory; freight + charges debit their own accounts below.
    const inventoryCorrection = round2(goodsTotal - accrualValue - varianceValue);
    if (inventoryCorrection > 0.004) {
      drMap.set(inventoryAccount, round2((drMap.get(inventoryAccount) || 0) + inventoryCorrection));
    } else if (inventoryCorrection < -0.004) {
      inventoryCredit = -inventoryCorrection;
    }
    applyFreightAndCharges(1);
  } else {
    // Nothing received: classic Dr Inventory / Cr AP, posting at
    // receiving. Slice-adjusted (9/2/26): a split-term pre-invoice books
    // only its slice.
    lines.forEach((li) => {
      drMap.set(li.glAccount, round2((drMap.get(li.glAccount) || 0) + li.amount * sliceFraction));
    });
    applyFreightAndCharges(sliceFraction);
  }

  const debits: GlRow[] = Array.from(drMap.entries()).map(([account, amount]) => ({
    ...splitAccount(account),
    amount,
  }));

  const credits: GlRow[] = [];
  if (inventoryCredit > 0) {
    credits.push({ ...splitAccount(inventoryAccount), amount: round2(inventoryCredit) });
  }
  credits.push({ ...splitAccount(apAccount), amount: sliceAdjustedTotal });

  const drTotal = debits.reduce((s, r) => s + r.amount, 0);
  const balanced = Math.abs(drTotal - (sliceAdjustedTotal + inventoryCredit)) < 0.01;

  return { debits, credits, balanced };
}

/** Flatten an InvoiceGlResult into persistable snapshot lines. */
export function toGlEntries(result: InvoiceGlResult, description?: string): GlEntryLine[] {
  return [
    ...result.debits.map((r) => ({ accountCode: r.code, accountName: r.name, description, debit: r.amount })),
    ...result.credits.map((r) => ({ accountCode: r.code, accountName: r.name, description, credit: r.amount })),
  ];
}

export interface PaymentGlInput {
  type: 'Payment' | 'Prepayment';
  /** Cash out of the bank. */
  cashAmount: number;
  /** "1210 Citibank Operating" style string. */
  bankAccount: string;
  /** A/P account for payments; the prepay asset account for advances. */
  apAccount: string;
  /** Vendor credit / prepayment consumed alongside cash. */
  appliedCreditTotal?: number;
  /** Asset account the consumed credit came from. */
  creditAssetAccount?: string;
  description?: string;
  /** The slice of the debit that is an ADVANCE (user 10/22/26): a run
   *  payment covering pre-invoices debits their advances account for
   *  this much, and payables only for the rest. */
  advanceDebit?: { account: string; amount: number };
}

/** The payment journal the confirmation shows IS the one that saves:
 *  Dr A/P (cash + credit) · Cr credit asset (credit) · Cr bank (cash).
 *  A prepayment debits its advance asset account instead of A/P. */
export function buildPaymentGlEntries(input: PaymentGlInput): GlEntryLine[] {
  const { type, cashAmount, bankAccount, apAccount, appliedCreditTotal = 0, creditAssetAccount, description, advanceDebit } = input;
  const ap = splitAccount(apAccount);
  const bank = splitAccount(bankAccount);
  const advance = advanceDebit && advanceDebit.amount > 0.004 ? round2(advanceDebit.amount) : 0;
  const apDebit = round2(cashAmount + appliedCreditTotal - advance);
  const lines: GlEntryLine[] = [];
  if (advance > 0) {
    const adv = splitAccount(advanceDebit!.account);
    lines.push({ accountCode: adv.code, accountName: adv.name, description: 'Advance to vendor (pre-invoice)', debit: advance });
  }
  if (apDebit > 0.004 || advance === 0) {
    lines.push({
      accountCode: ap.code,
      accountName: ap.name,
      description: description ?? (type === 'Prepayment' ? 'Advance to vendor' : 'Settle vendor invoices'),
      debit: apDebit,
    });
  }
  if (appliedCreditTotal > 0.004 && creditAssetAccount) {
    const credit = splitAccount(creditAssetAccount);
    lines.push({
      accountCode: credit.code,
      accountName: credit.name,
      description: 'Vendor credit applied',
      credit: round2(appliedCreditTotal),
    });
  }
  lines.push({
    accountCode: bank.code,
    accountName: bank.name,
    description: 'Cash out',
    credit: round2(cashAmount),
  });
  return lines;
}
