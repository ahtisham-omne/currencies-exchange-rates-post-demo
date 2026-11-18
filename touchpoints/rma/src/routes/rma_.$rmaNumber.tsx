/**
 * /rma/$rmaNumber — RMA detail. Client-only for the same reasons as the
 * list route (browser-only APIs, portals, react-dnd downstream).
 *
 * Renders the vendor-invoicing InvoiceDetailScreen chrome verbatim,
 * with an RMA payload adapted into Invoice shape. Payments is the only
 * hidden tab — returns are never settled here. Linked Records reads
 * linkedPOs below, so the source PO traces through. GL Impact reads
 * the adapted invoice, so its journal entry follows the "PO-based"
 * type set below.
 */
import { useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { InvoiceDetailScreen } from "@/app/components/InvoiceDetailScreen";
import { useRMAContext } from "@/app/rma-context";
import { Layout, type AppView } from "@/app/components/Layout";
import type { Invoice, InvoiceActionHistoryEntry } from "@/app/data/mockInvoices";
import { authorizedQty, receivingsForRMA, type RMA } from "@/app/data/mockRMAs";
import { rmaCurrency } from "@/app/currency/returnCurrency";

export const Route = createFileRoute("/rma_/$rmaNumber")({
  ssr: false,
  component: RMADetailRoute,
});

/**
 * Fold an RMA into the Invoice shape the vendor-invoicing detail screen
 * expects. Every field is populated with a real value or a safe empty
 * so nothing the invoice tabs / sidebar deref can trip on undefined.
 *
 * Notes:
 *   - status is pinned to a value mapStatus() handles cleanly. RMA
 *     statuses ("Shipped to Vendor", "Closed", ...)
 *     aren't in the invoice switch — we route Draft/Sent to
 *     "Pending Approval", "Approved" for downstream states, so the
 *     header pill + workflow bar always render.
 *   - amount = Σ (authorizedQty × unitPrice) across RMA lines, so the header
 *     agrees with the line grid and the sidebar once a vendor has cut a line.
 *   - type is "PO-based" so the Receiving-Invoice chip renders and the
 *     inventory-flavoured line-items grid picks up linkedPOs.
 *   - actionHistory carries the RMA's own history so Recent Activity
 *     has content.
 */
function rmaToInvoice(rma: RMA): Invoice {
  const amount = rma.items.reduce(
    (sum, li) => sum + authorizedQty(li) * li.unitPrice,
    0,
  );
  const roundedAmount = Math.round(amount * 100) / 100;

  // Every RMA state renders as a live invoice header — Draft and Sent
  // (both pre-approval states) map to Pending Approval; everything from
  // Approved onward reads as Approved so the sidebar shows a healthy
  // paid/balance split without needing prepayment/payment records.
  const status: Invoice["status"] =
    rma.status === "Cancelled"
      ? "Cancelled"
      : rma.status === "Draft" || rma.status === "Sent"
        ? "Pending Approval"
        : "Approved";

  const invoiceDate = rma.createdDate;
  const created = new Date(invoiceDate);
  const due = new Date(created);
  due.setDate(created.getDate() + 30);
  const dueDate = due.toISOString().split("T")[0];

  const actionHistory: InvoiceActionHistoryEntry[] = (rma.actionHistory ?? []).map(
    (h) => ({
      action: h.action,
      reason: h.reason ?? "",
      by: h.by,
      at: h.at,
    }),
  );

  return {
    id: rma.id,
    invoiceNumber: rma.rmaNumber,
    type: "PO-based",
    vendor: rma.vendor,
    vendorInvoiceNumber: rma.vendorRMANumber ?? rma.rmaNumber,
    reference: rma.sourcePO,
    date: invoiceDate,
    invoiceDate,
    createdDate: invoiceDate,
    dueDate,
    amount: roundedAmount,
    outstandingBalance: roundedAmount,
    // The return's PO's currency (app/currency/returnCurrency.ts): every amount
    // on the page reads in it, dollars on hover.
    currency: rmaCurrency(rma),
    apAccount: "2100-AP",
    description: rma.notes ?? `Return authorization against PO-${rma.sourcePO}`,
    postingDate: invoiceDate,
    linkedPOs: [rma.sourcePO],
    linkedGRNs: receivingsForRMA(rma),
    status,
    createdBy: rma.createdBy,
    updatedBy: rma.owner,
    updatedDate: rma.resolvedDate ?? rma.receivedDate ?? rma.shippedDate ?? rma.approvedDate ?? invoiceDate,
    is_payment_held: false,
    is_exception: false,
    actionHistory,
  };
}

function RMADetailRoute() {
  const navigate = useNavigate();
  const { rmaNumber } = Route.useParams();
  const { rmas, applyRMAAction, revertRMAToVersion } = useRMAContext();

  const decoded = decodeURIComponent(rmaNumber);
  const rma = rmas.find((r) => r.rmaNumber === decoded);

  const proxy = useMemo(() => (rma ? rmaToInvoice(rma) : null), [rma]);

  const onViewChange = (view: AppView) => {
    if (view === "rma") {
      void navigate({ to: "/rma" });
      return;
    }
    if (view === "supply-chain") {
      void navigate({ to: "/supply-chain" });
      return;
    }
    void navigate({ to: "/" });
  };

  if (!rma || !proxy) {
    return (
      <Layout activeView="rma" onViewChange={onViewChange}>
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <div className="max-w-md text-center">
            <h1 className="text-xl font-semibold text-foreground">
              RMA not found
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              No RMA matches “{decoded}”. It may have been deleted or the link is
              wrong.
            </p>
            <button
              onClick={() => void navigate({ to: "/rma" })}
              className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Back to Vendor Returns
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout activeView="rma" onViewChange={onViewChange} record={rma.rmaNumber}>
      <InvoiceDetailScreen
        key={proxy.id}
        mode="rma"
        rmaStatus={rma.status}
        rma={rma}
        onRmaAction={(action, payload) => {
          applyRMAAction(rma.id, action, payload);
          // Archived RMAs drop out of the list, so there's nothing to come
          // back to — send the user to the list rather than a stale detail.
          if (action === "archive") void navigate({ to: "/rma" });
        }}
        onRmaRevert={(version, reason) => revertRMAToVersion(rma.id, version, reason)}
        invoiceId={proxy.id}
        invoices={[proxy]}
        onClose={() => void navigate({ to: "/rma" })}
        applyInvoiceAction={() => {}}
      />
    </Layout>
  );
}
