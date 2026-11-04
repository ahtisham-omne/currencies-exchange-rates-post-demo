import { localTodayIso } from '@/app/lib/dueBucket';
import { arTermById, stageLabel, stagesForTerm } from '@/app/data/ar/arPaymentTerms';
import { CHARGE_DEFAULT_ACCOUNT, COMPANY_CURRENCY, DEFAULT_REVENUE_ACCOUNT, SALES_TAX_ACCOUNT } from '@/app/data/ar/arGlAccounts';
import { lockedUnitsFor, revenueAccountFor } from '@/app/data/ar/mockCustomers';
import type { CustomerInvoice, CustomerInvoiceLine } from '@/app/data/ar/mockCustomerInvoices';
import { AR_ACTING_USER } from '@/app/hooks/useCustomerInvoicing';
import type { ArSaveMode } from '../arCreateContract';
import { EPS, dueDateFor, round2, stageOf, type FormContext, type FormState, type Totals, type TreatmentState } from './formModel';

// FormState → a complete CustomerInvoice (PRD §12). App persists it.

const STATUS: Record<ArSaveMode, CustomerInvoice['invoiceStatus']> = {
  draft: 'Draft',
  submit: 'Pending Approval',
  approve: 'Approved',
};

export function buildInvoice(args: {
  ctx: FormContext;
  s: FormState;
  totals: Totals;
  mode: ArSaveMode;
  edit?: CustomerInvoice;
  /** FAD 11/2: the effective pre-invoice treatment (advance only). */
  treatment?: TreatmentState;
}): CustomerInvoice {
  const { ctx, s, totals, mode, edit } = args;
  const isRevenueAdvance = ctx.kind === 'Advance Invoice' && args.treatment?.effective === 'Revenue';
  const now = new Date().toISOString();
  const today = localTodayIso();
  const term = arTermById(s.paymentTermId);
  const kind = ctx.kind;

  let lines: CustomerInvoiceLine[];
  if (kind === 'Shipment Invoice') {
    lines = s.lines
      .filter((l) => l.invoiceQty > EPS)
      .map((l, i) => {
        const m = totals.lineMoney.get(l.key)!;
        return {
          id: `L${i + 1}`,
          sku: l.sku,
          description: l.description,
          uom: l.uom,
          orderedQty: l.orderedQty,
          shippedQty: l.shippedQty,
          invoiceQty: l.invoiceQty,
          unitPrice: l.unitPrice,
          originalUnitPrice: l.originalUnitPrice,
          grossTotal: m.gross,
          advanceCovered: m.covered > EPS ? m.covered : undefined,
          total: m.total,
          glAccount: l.glAccount,
          soNumber: l.soNumber,
          soLineId: l.soLineId,
          shipmentNumber: l.shipmentNumber,
          shipmentLineId: l.shipmentLineId,
          manual: l.manual || undefined,
          pricingAdjustments: l.pricingAdjustments?.length ? l.pricingAdjustments : undefined,
        };
      });
  } else if (kind === 'Advance Invoice') {
    lines = s.lines
      .filter((l) => (l.advanceAmount ?? 0) > EPS)
      .map((l, i) => ({
        id: `L${i + 1}`,
        sku: l.sku,
        description: l.description,
        uom: l.uom,
        orderedQty: l.orderedQty,
        shippedQty: l.shippedQty,
        invoiceQty: l.orderedQty,
        unitPrice: l.unitPrice,
        total: round2(l.advanceAmount ?? 0),
        // A Revenue pre-invoice credits revenue per line (FAD 11/2).
        glAccount: isRevenueAdvance ? revenueAccountFor(l.sku, ctx.customer) ?? DEFAULT_REVENUE_ACCOUNT : '',
        soNumber: l.soNumber,
        soLineId: l.soLineId,
        advancePercent: l.advancePercent,
        // Revenue on invoice: the serials or lots locked to the customer.
        lockedUnits: isRevenueAdvance && l.soLineId ? lockedUnitsFor(l, ctx.so?.lines.find((x) => x.id === l.soLineId)).units : undefined,
      }));
  } else {
    lines = s.lines
      .filter((l) => l.description.trim() || l.unitPrice > EPS)
      .map((l, i) => ({
        id: `L${i + 1}`,
        sku: l.sku,
        description: l.description.trim(),
        uom: l.uom,
        orderedQty: l.invoiceQty,
        invoiceQty: l.invoiceQty,
        unitPrice: l.unitPrice,
        total: round2(l.invoiceQty * l.unitPrice),
        glAccount: l.glAccount,
        chargeTemplateId: l.chargeTemplateId,
      }));
  }

  const stages = stagesForTerm(term);
  const stage = kind === 'Advance Invoice' ? stageOf(term, s.stageIndex) : undefined;
  const status = STATUS[mode];
  const submitted = mode !== 'draft';
  const approved = mode === 'approve';
  const noFreightOrCharges = kind === 'Advance Invoice';

  return {
    id: edit?.id ?? `cinv-${Date.now()}`,
    invoiceNumber: ctx.invoiceNumber,
    documentNumber: s.invoiceNumber.trim() || undefined,
    docKind: kind,
    customer: ctx.customerName,
    customerPONumber: poNumberFor(s),
    poBySo: Object.keys(s.poBySo).length > 1 ? trimmedPoBySo(s) : undefined,
    invoiceDate: s.invoiceDate,
    createdDate: edit?.createdDate ?? today,
    postingDate: kind === 'Advance Invoice' && !isRevenueAdvance ? undefined : s.postingDate || undefined,
    triggerDate: s.triggerDate || undefined,
    dueDate: dueDateFor(kind, s) || undefined,
    paymentTermId: term?.id,
    paymentTerms: term?.name,
    advanceStage: stage
      ? { index: stage.index, total: stages.length, percent: stage.percent, trigger: stage.trigger, label: stageLabel(stage, stages.length) }
      : undefined,
    quoteNumber: ctx.quote?.quoteNumber ?? (kind === 'Advance Invoice' ? edit?.quoteNumber : undefined),
    billToAddressId: s.billToAddressId || undefined,
    amount: totals.total,
    freightAmount: !noFreightOrCharges && totals.freight > EPS ? totals.freight : undefined,
    freightAccount: !noFreightOrCharges && totals.freight > EPS ? s.freightAccount : undefined,
    carrier: kind === 'Shipment Invoice' ? [...new Set(ctx.shipments.map((x) => x.carrier))].join(', ') || undefined : undefined,
    charges: noFreightOrCharges
      ? []
      : [
          ...s.charges
            .filter((c) => c.type && (c.amount || 0) > EPS)
            .map((c, i) => ({
              id: c.key || `CH${i + 1}`,
              type: c.type as Exclude<typeof c.type, ''>,
              description: c.description.trim(),
              amount: round2(c.amount),
              account: c.account || CHARGE_DEFAULT_ACCOUNT[c.type as Exclude<typeof c.type, ''>],
            })),
          // Manual sales tax rides as one 'Tax' charge (FAD 11/2), so the
          // detail page's tax split keeps working.
          ...(totals.tax > EPS ? [{ id: 'TAX', type: 'Tax' as const, description: 'Sales tax', amount: totals.tax, account: SALES_TAX_ACCOUNT }] : []),
        ],
    currency: s.currency,
    fxRate: s.currency !== COMPANY_CURRENCY && s.fxRate > 0 ? s.fxRate : undefined,
    arAccount: s.arAccount,
    depositAccount: kind === 'Advance Invoice' ? s.depositAccount : undefined,
    description: s.description.trim(),
    notesToCustomer: s.notesToCustomer.trim() || undefined,
    linkedSOs:
      kind === 'Shipment Invoice'
        ? [...new Set(lines.map((l) => l.soNumber).filter((x): x is string => !!x))]
        : kind === 'Advance Invoice' && ctx.so
          ? [ctx.so.soNumber]
          : [],
    linkedShipments: kind === 'Shipment Invoice' ? [...new Set(lines.map((l) => l.shipmentNumber).filter((x): x is string => !!x))] : [],
    relatedInvoiceNumber: kind === 'Standalone' ? s.relatedInvoiceNumber || undefined : undefined,
    advanceReferences: kind === 'Shipment Invoice' && totals.advanceRefs.length ? totals.advanceRefs : undefined,
    invoiceStatus: status,
    archived: undefined,
    rejectionReason: edit?.rejectionReason,
    sentAt: undefined,
    sendLog: edit?.sendLog,
    submittedBy: submitted ? AR_ACTING_USER : undefined,
    submittedAt: submitted ? now : undefined,
    approvedBy: approved ? AR_ACTING_USER : undefined,
    approvedAt: approved ? now : undefined,
    // Payment side: preserved on edit, empty on create.
    writtenOff: edit?.writtenOff,
    // FAD 11/2: pre-invoice treatment; the note says why it differs from the pick.
    treatment: kind === 'Advance Invoice' ? args.treatment?.effective ?? s.treatment : undefined,
    treatmentNote: kind === 'Advance Invoice' ? args.treatment?.note : undefined,
    // FAD 11/2: dispute or exception flagged at creation.
    // Dispute and Exception are separate sections (user 11/4).
    disputed: s.disputeOn || undefined,
    disputeDetail: s.disputeOn ? detailOf(s.disputeReason, s.disputeDescription, edit?.disputeDetail) : undefined,
    exception: s.flagOn ? detailOf(s.flagReason, s.flagDescription, edit?.exception) : undefined,
    creditHold: s.creditHold || undefined,
    depositReceived: edit?.depositReceived,
    depositApplications:
      kind === 'Shipment Invoice'
        ? Object.entries(s.depositAmounts)
            .filter(([, amt]) => amt > EPS)
            .map(([depositId, amount]) => ({ depositId, amount: round2(amount), appliedOn: today }))
        : edit?.depositApplications ?? [],
    receipts: edit?.receipts ?? [],
    creditApplied: edit?.creditApplied ?? 0,
    lines,
    createdBy: edit?.createdBy ?? AR_ACTING_USER,
    updatedBy: edit ? AR_ACTING_USER : undefined,
    updatedDate: edit ? today : undefined,
    actionHistory: edit?.actionHistory,
  };
}

function trimmedPoBySo(s: FormState): Record<string, string> {
  return Object.fromEntries(Object.entries(s.poBySo).map(([so, po]) => [so, po.trim()]));
}

/** One PO per SO on a combined invoice; the header field joins them. */
function poNumberFor(s: FormState): string | undefined {
  const per = Object.values(s.poBySo).map((p) => p.trim()).filter(Boolean);
  if (Object.keys(s.poBySo).length > 0) return [...new Set(per)].join(', ') || undefined;
  return s.customerPONumber.trim() || undefined;
}

function detailOf(type: string, description: string, prev?: { reason: string; by: string; at: string }) {
  const reason = description.trim() ? `${type}: ${description.trim()}` : type;
  // Keep who and when from the original flag if the reason did not change.
  if (prev && prev.reason === reason) return prev;
  return { reason, by: AR_ACTING_USER, at: localTodayIso() };
}
