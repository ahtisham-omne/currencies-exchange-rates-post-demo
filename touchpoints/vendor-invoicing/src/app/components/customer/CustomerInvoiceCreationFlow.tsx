import { useMemo, useState } from 'react';
import { CustomerInvoiceStartModal } from './CustomerInvoiceStartModal';
import { CustomerSelectionModalNested } from './CustomerSelectionModalNested';
import { StandaloneCustomerSelectModal } from './StandaloneCustomerSelectModal';
import { CreateCustomerInvoiceScreen } from './CreateCustomerInvoiceScreen';
import type { ArCreateEntry, ArCreateSeed, ArSaveResult, CreateCustomerInvoiceFormProps } from './arCreateContract';
import { findQuote, findSalesOrder, findShipment, type Customer } from '@/app/data/ar/mockCustomers';
import type { CustomerDeposit } from '@/app/data/ar/mockCustomerDeposits';
import type { CustomerInvoice } from '@/app/data/ar/mockCustomerInvoices';
import type { ArInvoiceKind } from '@/app/data/ar/arPaymentTerms';
import { availableQty, billingByShipmentLine, isInvoiceableShipment, readyToInvoiceRows } from '@/app/data/ar/arBilling';
import { useArPermissions } from '@/app/hooks/useArSettings';

export interface CustomerInvoiceCreationFlowProps {
  customers: Customer[];
  invoices: CustomerInvoice[];
  deposits: CustomerDeposit[];
  /** Where the flow starts (deep links, Ready to Invoice, Edit). Omit for the type picker. */
  entry?: ArCreateEntry;
  onClose: () => void;
  onSaved: (result: ArSaveResult) => void;
}

type Step = 'type' | 'selection' | 'form';

/** What a selection step opens with (deep link, or Back from the form). */
interface SelectionInit {
  customerName?: string;
  shipments?: Array<{ shipmentNumber: string; lineIds?: string[] }>;
  source?: Extract<ArCreateSeed, { kind: 'Advance Invoice' }>['source'];
}

interface FlowState {
  step: Step;
  kind: ArInvoiceKind | null;
  init: SelectionInit;
  seed: ArCreateSeed | null;
  editInvoice?: CustomerInvoice;
  /** The form was reached through a selection step, so Back goes there. */
  formHasBack: boolean;
  /** Remount key for the selection step so it re-reads `init`. */
  rev: number;
}

/** Edit and Resubmit (PRD §10.2): rebuild the seed from the saved invoice. */
function seedFromInvoice(inv: CustomerInvoice, customers: Customer[]): ArCreateSeed | null {
  const customer = customers.find((c) => c.customerName === inv.customer);
  if (inv.docKind === 'Shipment Invoice') {
    const byShipment = new Map<string, string[]>();
    for (const l of inv.lines) {
      if (!l.shipmentLineId) continue;
      const shipmentNumber =
        l.shipmentNumber ?? customer?.shipments.find((s) => s.lines.some((x) => x.id === l.shipmentLineId))?.shipmentNumber;
      if (!shipmentNumber) continue;
      byShipment.set(shipmentNumber, [...(byShipment.get(shipmentNumber) ?? []), l.shipmentLineId]);
    }
    for (const n of inv.linkedShipments) if (!byShipment.has(n)) byShipment.set(n, []);
    return {
      kind: 'Shipment Invoice',
      customerName: inv.customer,
      shipments: [...byShipment.entries()].map(([shipmentNumber, lineIds]) =>
        lineIds.length ? { shipmentNumber, lineIds } : { shipmentNumber },
      ),
      paymentTermId: inv.paymentTermId ?? customer?.paymentTermId ?? '',
    };
  }
  if (inv.docKind === 'Advance Invoice') {
    const source = inv.linkedSOs[0]
      ? { type: 'so' as const, soNumber: inv.linkedSOs[0] }
      : inv.quoteNumber
        ? { type: 'quote' as const, quoteNumber: inv.quoteNumber }
        : null;
    if (!source) return null;
    return {
      kind: 'Advance Invoice',
      customerName: inv.customer,
      source,
      stageIndex: inv.advanceStage?.index,
      paymentTermId: inv.paymentTermId,
    };
  }
  if (inv.docKind === 'Standalone') return { kind: 'Standalone', customerName: inv.customer };
  return null;
}

function initialState(
  entry: ArCreateEntry | undefined,
  customers: Customer[],
  invoices: CustomerInvoice[],
  advanceOnly: boolean,
): FlowState {
  const base: FlowState = { step: 'type', kind: null, init: {}, seed: null, formHasBack: false, rev: 0 };
  if (!entry) return base;
  const at = (kind: ArInvoiceKind, init: SelectionInit): FlowState =>
    advanceOnly && kind !== 'Advance Invoice'
      ? { ...base, init: { customerName: init.customerName } }
      : { ...base, step: 'selection', kind, init };

  if (entry.editInvoiceId) {
    const inv = invoices.find((i) => i.id === entry.editInvoiceId);
    const seed = inv ? seedFromInvoice(inv, customers) : null;
    if (inv && seed) return { ...base, step: 'form', kind: seed.kind, seed, editInvoice: inv };
    return base;
  }
  if (entry.seed) {
    if (advanceOnly && entry.seed.kind !== 'Advance Invoice') return base;
    return { ...base, step: 'form', kind: entry.seed.kind, seed: entry.seed };
  }

  const billing = billingByShipmentLine(invoices);
  const openShipmentsOfSO = (customer: Customer, soNumber: string) =>
    customer.shipments
      .filter((s) => s.soNumber === soNumber && isInvoiceableShipment(s) && s.lines.some((l) => availableQty(l, billing) > 0))
      .map((s) => ({ shipmentNumber: s.shipmentNumber }));

  if (entry.shipmentNumbers?.length) {
    const first = findShipment(entry.shipmentNumbers[0], customers);
    return at('Shipment Invoice', {
      customerName: entry.customerName ?? first?.customer.customerName,
      shipments: entry.shipmentNumbers.map((shipmentNumber) => ({ shipmentNumber })),
    });
  }
  if (entry.shipmentNumber) {
    const hit = findShipment(entry.shipmentNumber, customers);
    return at('Shipment Invoice', {
      customerName: entry.customerName ?? hit?.customer.customerName,
      shipments: [{ shipmentNumber: entry.shipmentNumber }],
    });
  }
  if (entry.quoteNumber) {
    const hit = findQuote(entry.quoteNumber, customers);
    return at('Advance Invoice', {
      customerName: entry.customerName ?? hit?.customer.customerName,
      source: { type: 'quote', quoteNumber: entry.quoteNumber },
    });
  }
  if (entry.soNumber) {
    const hit = findSalesOrder(entry.soNumber, customers);
    const customerName = entry.customerName ?? hit?.customer.customerName;
    const shipments = hit ? openShipmentsOfSO(hit.customer, entry.soNumber) : [];
    // No kind given: shipped goods waiting → bill them; otherwise an advance.
    const kind: ArInvoiceKind = entry.kind ?? (shipments.length ? 'Shipment Invoice' : 'Advance Invoice');
    if (kind === 'Shipment Invoice') return at(kind, { customerName, shipments });
    if (kind === 'Advance Invoice') return at(kind, { customerName, source: { type: 'so', soNumber: entry.soNumber } });
    return at(kind, { customerName });
  }
  if (entry.kind) return at(entry.kind, { customerName: entry.customerName });
  return { ...base, init: { customerName: entry.customerName } };
}

// Customer invoice creation (PRD §3, §6-§9): type picker → selection step
// → invoice form. Entries can start part way (deep links, Ready to
// Invoice, Edit). Back always returns to the previous step; X, Cancel
// and the backdrop close the flow, behind the discard guard once
// something is selected.
export function CustomerInvoiceCreationFlow({
  customers,
  invoices,
  deposits,
  entry,
  onClose,
  onSaved,
}: CustomerInvoiceCreationFlowProps) {
  const perms = useArPermissions();
  const advanceOnly = perms.advanceFromQuoteOnly;
  const [state, setState] = useState<FlowState>(() => initialState(entry, customers, invoices, advanceOnly));

  const shipmentsWaiting = useMemo(
    () => readyToInvoiceRows(customers, invoices).filter((r) => r.kind === 'shipment').length,
    [customers, invoices],
  );

  const toType = () => setState((s) => ({ ...s, step: 'type', seed: null, formHasBack: false }));

  const pickType = (kind: ArInvoiceKind) =>
    setState((s) => ({
      ...s,
      step: 'selection',
      kind,
      // Keep a prefilled customer; drop picks that belonged to another type.
      init: s.kind === kind ? s.init : { customerName: s.init.customerName },
      rev: s.rev + 1,
    }));

  const toForm = (seed: ArCreateSeed) => setState((s) => ({ ...s, step: 'form', seed, formHasBack: true }));

  const backFromForm = () =>
    setState((s) => {
      const seed = s.seed;
      const init: SelectionInit = !seed
        ? s.init
        : seed.kind === 'Shipment Invoice'
          ? { customerName: seed.customerName, shipments: seed.shipments }
          : seed.kind === 'Advance Invoice'
            ? { customerName: seed.customerName, source: seed.source }
            : { customerName: seed.customerName };
      return { ...s, step: 'selection', init, rev: s.rev + 1 };
    });

  const switchToShipments = (customerName: string) =>
    setState((s) => ({ ...s, step: 'selection', kind: 'Shipment Invoice', init: { customerName }, rev: s.rev + 1 }));

  if (state.step === 'type') {
    return (
      <CustomerInvoiceStartModal
        onClose={onClose}
        onContinue={pickType}
        shipmentsWaiting={shipmentsWaiting}
        advanceOnly={advanceOnly}
        initialKind={state.kind ?? undefined}
      />
    );
  }

  // Shipment and Advance flows share ONE nested picker, exactly like the
  // vendor inventory and pre-invoice flows share VendorSelectionModalNested.
  if (state.step === 'selection' && (state.kind === 'Shipment Invoice' || state.kind === 'Advance Invoice')) {
    const isAdvance = state.kind === 'Advance Invoice';
    return (
      <CustomerSelectionModalNested
        key={`${isAdvance ? 'adv' : 'shp'}-${state.rev}`}
        flow={isAdvance ? 'advance' : 'shipment'}
        customers={customers}
        invoices={invoices}
        initialCustomerName={state.init.customerName}
        initialShipments={isAdvance ? undefined : state.init.shipments}
        initialSource={isAdvance ? state.init.source : undefined}
        quotesOnly={isAdvance && advanceOnly}
        onBack={toType}
        onClose={onClose}
        onContinue={toForm}
      />
    );
  }

  if (state.step === 'selection' && state.kind === 'Standalone') {
    return (
      <StandaloneCustomerSelectModal
        key={`std-${state.rev}`}
        customers={customers}
        invoices={invoices}
        initialCustomerName={state.init.customerName}
        onBack={toType}
        onClose={onClose}
        onContinue={(c) => toForm({ kind: 'Standalone', customerName: c.customerName })}
        onSwitchToShipments={switchToShipments}
      />
    );
  }

  if (state.step === 'form' && state.seed) {
    const formProps: CreateCustomerInvoiceFormProps = {
      seed: state.seed,
      editInvoice: state.editInvoice,
      customers,
      invoices,
      deposits,
      onBack: state.formHasBack ? backFromForm : undefined,
      onClose,
      onSaved,
    };
    return <CreateCustomerInvoiceScreen {...formProps} />;
  }

  return null;
}
