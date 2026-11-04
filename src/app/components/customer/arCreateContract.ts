import type { CustomerInvoice } from '@/app/data/ar/mockCustomerInvoices';
import type { CustomerDeposit } from '@/app/data/ar/mockCustomerDeposits';
import type { Customer } from '@/app/data/ar/mockCustomers';
import type { ArInvoiceKind } from '@/app/data/ar/arPaymentTerms';

// Contract between the customer invoice creation steps (PRD §3, §6–§9):
//   type picker → selection step → invoice form.
// The selection step resolves WHAT is billed into an ArCreateSeed; the
// form builds the invoice from it. Entry points (Ready to Invoice rows,
// Sales Order / Shipment / Quote deep links, Edit and Resubmit) start
// the flow part way through with an ArCreateEntry.

export type ArCreateSeed =
  | {
      kind: 'Shipment Invoice';
      customerName: string;
      /** Shipments being billed; `lineIds` limits to single lines (omit = all lines with something left). */
      shipments: Array<{ shipmentNumber: string; lineIds?: string[] }>;
      /** BR-003: the single term picked when the orders' terms differ. */
      paymentTermId: string;
    }
  | {
      kind: 'Advance Invoice';
      customerName: string;
      source: { type: 'so'; soNumber: string } | { type: 'quote'; quoteNumber: string };
      /** The stage being billed (from Ready to Invoice, or picked on the form). */
      stageIndex?: number;
      /** BR-007: a prepayment or split term applied in place of a net term. */
      paymentTermId?: string;
    }
  | {
      kind: 'Standalone';
      customerName: string;
    };

export interface ArCreateEntry {
  /** Skip the type picker. */
  kind?: ArInvoiceKind;
  /** Customer prefilled (deep links, Ready to Invoice). */
  customerName?: string;
  /** Skip the selection step entirely. */
  seed?: ArCreateSeed;
  /** Edit an existing Draft / Pending Approval / Rejected invoice. */
  editInvoiceId?: string;
  /** Deep-link prefill for the selection step. */
  soNumber?: string;
  shipmentNumber?: string;
  quoteNumber?: string;
  /** Ready to Invoice "Create One Invoice": shipments preselected in the
   *  selection step (it still runs, so the BR-003 term gate can fire). */
  shipmentNumbers?: string[];
}

/** What the form emits. `mode` says which footer button was used. */
export type ArSaveMode = 'draft' | 'submit' | 'approve';

export interface ArSaveResult {
  invoice: CustomerInvoice;
  mode: ArSaveMode;
  /** True when an existing invoice was edited (same id and number). */
  isEdit: boolean;
}

/** Props of the invoice form (CreateCustomerInvoiceScreen). */
export interface CreateCustomerInvoiceFormProps {
  seed: ArCreateSeed;
  /** Set when editing; the form loads its values from this record. */
  editInvoice?: CustomerInvoice;
  customers: Customer[];
  /** Every invoice, for available-quantity math (exclude editInvoice's own lines). */
  invoices: CustomerInvoice[];
  deposits: CustomerDeposit[];
  /** Back to the selection step. Absent when the form was opened directly (edit, deep link). */
  onBack?: () => void;
  onClose: () => void;
  onSaved: (result: ArSaveResult) => void;
}
