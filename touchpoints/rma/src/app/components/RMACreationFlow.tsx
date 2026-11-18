import { useState } from 'react';
import type { SelectedPOData } from '@/app/components/VendorSelectionModalNested';
import { CreateInvoiceScreen, type VendorDraft } from '@/app/components/CreateInvoiceScreen';
import { RMAStartModal, type RMAStartMode } from '@/app/components/rma/RMAStartModal';
import { ItemSearchModal } from '@/app/components/rma/ItemSearchModal';
import {
  VendorItemsModal,
  type VendorItemsSelection,
} from '@/app/components/rma/VendorItemsModal';
import { itemsForVendor } from '@/app/data/itemProvenance';
import {
  selectionFromItems,
  selectionFromVendorItems,
  type ItemPick,
} from '@/app/components/rma/itemSelectionBridge';
import type { Invoice } from '@/app/data/mockInvoices';
import { mockVendors } from '@/app/data/mockVendors';
import { returnShipToOptions, trackingModeFor, type RMA, type RMALineItem, type RMALineSettlement, type RMALotAllocation, type RMAReturnLeg, type ReturnReason, type ReturnRouting, type ReturnType,
  isLotMode,
} from '@/app/data/mockRMAs';

interface RMACreationFlowProps {
  onClose: () => void;
  /** Every draft the save produced. A return sent back to each vendor site is
   *  one physical shipment per site, so it saves as one draft per site. */
  onCreated: (rmas: RMA[]) => void;
  currentUser: string;
  existingRMAs: RMA[];
}

type FlowStep = 'pick-mode' | 'pick-items' | 'pick-vendor' | 'create';


/**
 * RMA creation flow — reuses the ACTUAL vendor-invoicing create modal
 * (`CreateInvoiceScreen`) so the surface is pixel-identical to the
 * invoice flow. When the invoice flow's onInvoicesCreated fires, we
 * translate the Invoice payload into an RMA record and hand it back to
 * the App's state.
 */
export function RMACreationFlow({
  onClose,
  onCreated,
  currentUser,
  existingRMAs,
}: RMACreationFlowProps) {
  // The two routes again, chosen before anything else happens.
  //
  // They were taken out because the by-item picker asked the first step's
  // question in a modal and then handed the answer over -- the same search,
  // twice. That is still true of `pick-items`, so by item now opens the step
  // itself with nothing on the return: the search bar is the picker.
  //
  // By vendor is a different question. Naming who takes it back before
  // anything is picked settles the vendor for every line at once and narrows
  // the catalogue to what that vendor actually shipped, which the by-item
  // route cannot do because it does not know yet.
  const [step, setStep] = useState<FlowStep>('pick-mode');
  const [startMode, setStartMode] = useState<RMAStartMode>('item');
  const [selectedPOs, setSelectedPOs] = useState<SelectedPOData[]>([]);
  /** Named before anything was picked on the by-vendor route, so the step does
   *  not ask again for something the user has already said. */
  const [pickedVendor, setPickedVendor] = useState<string | null>(null);

  // There is something behind the first step again, so the chevron goes back
  // to it rather than out of the flow.
  const handleGoBack = () => {
    setSelectedPOs([]);
    setPickedVendor(null);
    setStep('pick-mode');
  };

  // The item route hands back part numbers, not orders: what is going back is
  // decided before who it goes back to.
  const handleItemsPicked = (picks: ItemPick[]) => {
    setPickedVendor(null);
    setSelectedPOs(selectionFromItems(picks));
    setStep('create');
  };

  const handleBackToMode = () => setStep('pick-mode');

  // The vendor route asks who first and then shows what they shipped, which is
  // the mirror of the item route: both arrive on the step with the return
  // already sketched rather than with an empty screen.
  // Naming the vendor is the whole of the by-vendor picker. Everything they
  // have shipped goes onto the step's rail with no figure against it, and the
  // figures are typed there -- on the same rail card, with the same field, as
  // every other route. Picking parts in a grid and then again on a rail asked
  // the same question twice.
  const handleVendorPicked = (vendorCode: string) => {
    setPickedVendor(vendorCode);
    setSelectedPOs(
      selectionFromVendorItems(
        vendorCode,
        itemsForVendor(vendorCode).map((i) => ({ sku: i.sku, qty: 0 })),
      ),
    );
    setStep('create');
  };

  const handleVendorItemsPicked = (selection: VendorItemsSelection) => {
    setPickedVendor(selection.vendorCode);
    setSelectedPOs(
      selectionFromVendorItems(selection.vendorCode, selection.picks, selection.unlinkedPicks),
    );
    setStep('create');
  };

  return (
    <>
      {step === 'pick-mode' && (
        <RMAStartModal
          onClose={onClose}
          onSelectMode={(mode) => {
            setStartMode(mode);
            // By item goes straight to the step. Its picker was the step's own
            // search in a modal, and a search that hands its results to a
            // second search is one search too many.
            //
            // By vendor still asks first, because who takes it back is a
            // question the step cannot answer on its own.
            // Both routes open the wizard. They differ only in where it
            // opens: by item on Items and quantity, by vendor on a Vendor step
            // in front of it. The two pickers that used to stand between the
            // chooser and the flow asked the flow's own questions in a modal
            // and handed the answers over.
            setSelectedPOs([]);
            setPickedVendor(null);
            setStep('create');
          }}
        />
      )}
      {step === 'pick-items' && (
        <ItemSearchModal
          onClose={onClose}
          onBack={handleBackToMode}
          onContinue={handleItemsPicked}
        />
      )}
      {step === 'pick-vendor' && (
        <VendorItemsModal
          onClose={onClose}
          onBack={handleBackToMode}
          onContinue={handleVendorItemsPicked}
          onPickVendorOnly={(v) => handleVendorPicked(v.vendorCode)}
        />
      )}
      {step === 'create' && (
        <CreateInvoiceScreen
          onClose={onClose}
          onGoBack={handleGoBack}
          invoiceType="po"
          selectedPOsData={selectedPOs}
          standaloneVendor={null}
          ledger="ap"
          mode="rma"
          startMode={startMode}
          lockedVendor={pickedVendor}
          onInvoicesCreated={(invoices: Invoice[], meta) => {
            // Translate the invoice payload into an RMA record so the
            // App's rmas state stays the source of truth. Line items,
            // vendor, and PO come from the invoice; the RMA lifecycle
            // fields default to Draft with the current user as owner.
            // meta.lineReasons carries the per-line Return Reason the
            // user picked in the create form (keyed by the underlying
            // PO line id — see CreateInvoiceScreen line-item state).
            const invoice = invoices[0];
            // The by-item route never handed this component any orders: the
            // screen assembles them from the parts that were picked. Reading
            // our own empty copy wrote drafts with no lines on them.
            const rmas = invoiceToRMAs(
              invoice,
              meta?.selectedPOs?.length ? meta.selectedPOs : selectedPOs,
              currentUser,
              existingRMAs,
              meta?.lineReasons ?? {},
              meta?.lineReturnTypes ?? {},
              meta?.returnShipTo ?? '',
              meta?.returnShipToPartner ?? '',
              meta?.carrier ?? '',
              meta?.lineSerials ?? {},
              meta?.returnRouting ?? 'origin',
              meta?.returnLegs ?? [],
              meta?.lineQuantities ?? {},
              meta?.lineUnitPrices ?? {},
              meta?.lineOriginalPrices ?? {},
              meta?.lineNotes ?? {},
              meta?.lineAttachments ?? {},
              meta?.lineReceivedQty ?? {},
              meta?.shippingInstruction ?? '',
              meta?.vendorRMANumber ?? '',
              meta?.expectedResolutionDate ?? '',
              meta?.headerAttachments ?? [],
              meta?.payToAccountId ?? '',
              meta?.lineSettlements ?? {},
              meta?.vendorDrafts ?? [],
              meta?.lineLots ?? {},
              meta?.resolutionsByVendor ?? {},
            );
            onCreated(rmas);
          }}
        />
      )}
    </>
  );
}

/** Whether a receiving document carried any of the parts on this return. */
function carriesAny(vendorName: string, grn: string, skus: Set<string>): boolean {
  const doc = mockVendors
    .find((v) => v.vendorName === vendorName)
    ?.receivingDocuments.find((g) => g.grnNumber === grn);
  return !!doc?.items.some((i) => skus.has(i.sku));
}

/** How much of one part a set of receiving documents actually brought in.
 *
 *  A line that was never tied to particular deliveries still has to state a
 *  received figure somebody can check. Read off the catalogue instead, it
 *  printed the whole shelf: "2754 BOX" under Ordered and Received on a return
 *  whose receipts carried fifty-four. */
function receivedOnGRNs(vendorName: string, grns: string[], sku: string, uom: string): number {
  const docs = mockVendors.find((v) => v.vendorName === vendorName)?.receivingDocuments ?? [];
  const seen = new Set(grns);
  const total = docs
    .filter((g) => seen.has(g.grnNumber))
    .flatMap((g) => g.items)
    .filter((i) => i.sku === sku && (i.uom ?? uom) === uom)
    .reduce((n, i) => n + (i.quantity ?? 0), 0);
  return Math.round(total * 100) / 100;
}

/** Which order a receiving document belongs to, read off the vendor's own
 *  copy of it. A receipt the seed stamped against an order with no document
 *  of its own carries that order in its number, as `Rec-1403-11215`. */
function poForGRN(vendorName: string, grn: string): string | undefined {
  const doc = mockVendors
    .find((v) => v.vendorName === vendorName)
    ?.receivingDocuments.find((g) => g.grnNumber === grn);
  if (doc?.poNumber) return doc.poNumber;
  const tail = grn.split('-')[2];
  return tail || undefined;
}

// ─── Translate an Invoice into one or more RMAs ───────────────────
// The invoice create modal returns an Invoice with linkedPOs + amount.
// For RMA purposes we need line items with return qty and reason. We
// pull the underlying PO line items from the selected POs and match by
// index — the invoice already owns the qty each line was invoiced at,
// which for RMA purposes reads as the return qty.
//
// One leg is one physical shipment, so a return that goes back to each
// vendor site becomes one draft per site. Each draft carries only the lines
// received from that site, which is what keeps a vendor's RMA reconcilable
// against the shipment that actually arrived.
function invoiceToRMAs(
  invoice: Invoice,
  selectedPOs: SelectedPOData[],
  currentUser: string,
  existingRMAs: RMA[],
  lineReasons: Record<string, string>,
  lineReturnTypes: Record<string, string>,
  returnShipTo: string,
  returnShipToPartner: string,
  carrier: string,
  lineSerials: Record<string, string[]>,
  returnRouting: ReturnRouting,
  returnLegs: RMAReturnLeg[],
  lineQuantities: Record<string, number>,
  lineUnitPrices: Record<string, number>,
  lineOriginalPrices: Record<string, number>,
  lineNotes: Record<string, string>,
  lineAttachments: Record<string, { name: string }[]>,
  lineReceivedQty: Record<string, number>,
  shippingInstruction: string,
  vendorRMANumber: string,
  expectedResolutionDate: string,
  headerAttachments: { name: string }[],
  payToAccountId: string,
  lineSettlements: Record<string, RMALineSettlement[]>,
  vendorDrafts: VendorDraft[],
  /** Which batches each lot-tracked line is returning. Empty until the picker
   *  has been used, which is the same as saying nobody has answered yet. */
  lineLots: Record<string, RMALotAllocation[]> = {},
  /** Each RMA's resolution, keyed by the vendor that raises it. One RMA is one
   *  vendor, so the answer belongs to the document rather than to a line: a
   *  part split between two vendors is one line and two credits. */
  resolutionsByVendor: Record<
    string,
    {
      returnType: ReturnType | null;
      reason: ReturnReason | null;
      note: string;
      /** Money back, or a credit on the account. Asked only where the goods
       *  were paid for; everything else settles without a choice. */
      settlement?: 'Refund' | 'Credit';
      /** Evidence attached on the last step, for this document. */
      attachments?: { name: string }[];
      /** Words to find the return by, typed on the last step. */
      tags?: string[];
      /** What the vendor keeps back out of the refund, agreed on the call
       *  that authorized the return. */
      charges?: { id: number; type: string; amount: number; description?: string }[];
      /** Why each part is going back, keyed by SKU, as the last step asked it. */
      reasons?: Record<string, ReturnReason>;
      /** What Other means, for the parts that say Other. */
      reasonNotes?: Record<string, string>;
      /** Units the last step counted as paid, keyed `sku|uom`. */
      paidQtyByItem?: Record<string, number>;
      /** The vendor's own number for this return, from the last step. */
      vendorRMANumber?: string;
      /** The date the vendor said the refund would arrive by. */
      refundExpectedDate?: string;
    }
  > = {},
): RMA[] {
  const nextNumber = Math.max(
    1000,
    ...existingRMAs.map((r) => parseInt(r.rmaNumber.replace('RMA-', ''), 10) || 0),
  );
  const now = new Date();
  const createdDate = now.toISOString().split('T')[0]!;

  const vendor = mockVendors.find((v) => v.vendorName === invoice.vendor) ?? null;

  const items: RMALineItem[] = [];
  /** Lines whose reason the user picked by hand, keyed by the id the line
   *  carries until the draft renames it. The document's own resolution fills
   *  in the rest; it must not overwrite an answer somebody already gave. */
  const ownReason = new Set<string>();
  selectedPOs.forEach((po, poIdx) => {
    const chosenItems =
      po.selectedItemIds && po.selectedItemIds.length > 0
        ? po.items.filter((li) => po.selectedItemIds.includes(li.id))
        : po.items;
    chosenItems.forEach((li, j) => {
      const mode = trackingModeFor(li.sku);
      // Create-screen keys line rows by receipt state: `inv-{po}-{poLineId}`
      // once goods are in, `pre-{po}-{poLineId}` while they are not. Reading
      // only one shape drops every value the user typed on the other.
      const createScreenLineId = [`inv-${po.poNumber}-${li.id}`, `pre-${po.poNumber}-${li.id}`]
        .find((k) => k in lineReceivedQty);
      // A standard PO's rows are built from the receipts the user selected, so
      // a PO item with none of them selected was never on screen and must not
      // arrive on the return as a line of defaults.
      if (!createScreenLineId) return;
      // The grid sums what each receipt delivered, which is the figure the user
      // returned against. The PO's own count ignores which receipts were picked.
      const received = lineReceivedQty[createScreenLineId] ?? li.receivedQty ?? li.quantity;
      const serials = mode === 'serialized' ? (lineSerials[createScreenLineId] ?? []) : undefined;
      // On a serialized line the units the user picked are the quantity —
      // anything else would ship a count the serial list can't back up.
      // Otherwise the record takes exactly what was typed on the line.
      const returnQty = serials ? serials.length : (lineQuantities[createScreenLineId] ?? received);
      const unitPrice = lineUnitPrices[createScreenLineId] ?? li.unitPrice;
      const originalUnitPrice = lineOriginalPrices[createScreenLineId] ?? li.unitPrice;
      const lineNote = lineNotes[createScreenLineId]?.trim();
      const files = lineAttachments[createScreenLineId] ?? [];
      const pickedReason = lineReasons[createScreenLineId];
      const reason = (pickedReason ?? 'Failed inspection') as ReturnReason;
      if (pickedReason) ownReason.add(`${poIdx}-${j}`);
      const pickedReturnType = lineReturnTypes[createScreenLineId];
      const returnType = (pickedReturnType ?? 'Refund/Credit') as ReturnType;
      const settlements = lineSettlements[createScreenLineId];
      items.push({
        id: `${poIdx}-${j}`,
        poLineId: li.id,
        originId: po.originId,
        originName: po.originName,
        sku: li.sku,
        description: li.description,
        uom: li.uom,
        unitPrice,
        ...(Math.abs(originalUnitPrice - unitPrice) > 0.004 ? { originalUnitPrice } : {}),
        receivedQty: received,
        returnQty,
        reason,
        returnType,
        ...(settlements && settlements.length > 1 ? { settlements } : {}),
        serialNumbers: serials,
        // The batches the user picked, not an empty list standing in for them.
        // An empty array here saved a lot-tracked line with no lot IDs at all,
        // which reads downstream as untracked stock.
        lots: isLotMode(mode) ? (lineLots[createScreenLineId] ?? []) : undefined,
        ...(lineNote ? { notes: lineNote } : {}),
        ...(files.length > 0 ? { attachments: files } : {}),
        image: li.image,
      });
    });
  });

  // A return always ships somewhere, so fall back to one leg covering every
  // origin on the lines rather than leaving the record with no destination.
  const effectiveLegs: RMAReturnLeg[] =
    returnLegs.length > 0
      ? returnLegs
      : [
          {
            originIds: Array.from(new Set(items.map((li) => li.originId))),
            shipTo: returnShipTo || returnShipToOptions(invoice.vendor)[0],
            shipToPartner: returnShipToPartner || invoice.vendor,
            receivingNumbers: invoice.linkedGRNs ?? [],
          },
        ];

  // One draft per vendor the return settles with, which is what the second
  // step decided and what the confirmation before saving states. Splitting on
  // vendor sites -- the old behaviour, still the fallback for a return that
  // arrives without the answer -- produced a different number of drafts from
  // the one the user had just been shown.
  const drafts: { leg: RMAReturnLeg; vendorName: string; vendorCode: string | undefined; lines: typeof items }[] =
    vendorDrafts.length > 0
      ? vendorDrafts.map((draft) => {
          // A merged draft carries one line per branch it absorbed, so the
          // same part can arrive twice. Keyed by SKU alone the second write
          // replaced the first and the branch's whole share disappeared from
          // the saved return: 300 EA merged from 224 and 76 saved as 76. The
          // shares add up, and so do the ties they unwind.
          //
          // Keyed by part AND unit, because a part can also arrive twice as
          // two different units: three pallets and a hundred and twenty eaches
          // are two lines, and keyed on the part alone they saved as one, in
          // whichever unit happened to be written first.
          const wantKey = (sku: string, uom: string) => `${sku}::${uom}`;
          const wanted = new Map<string, { qty: number; ties: Map<string, number>; untied: boolean; serials: string[] }>();
          draft.lines.forEach((l) => {
            const on = wanted.get(wantKey(l.sku, l.uom)) ?? { qty: 0, ties: new Map<string, number>(), untied: false, serials: [] as string[] };
            on.qty = Math.round((on.qty + l.qty) * 100) / 100;
            (l.ties ?? []).forEach((t) =>
              on.ties.set(t.grnNumber, Math.round(((on.ties.get(t.grnNumber) ?? 0) + t.qty) * 100) / 100),
            );
            // Untied only if nothing on this part is tied to anything. One
            // branch tied and the other not is a part that unwinds in part,
            // which the ties themselves already say.
            on.untied = l.untied === true || on.untied;
            (l.serials ?? []).forEach((sn) => { if (!on.serials.includes(sn)) on.serials.push(sn); });
            wanted.set(wantKey(l.sku, l.uom), on);
          });
          // The deliveries this vendor's lines unwind. They are the return's
          // own answer about what it reverses, so they are what the leg
          // records -- not the invoice's receipts, which say only where the
          // goods came in, and say it for every vendor at once.
          const unwound = Array.from(
            new Set([...wanted.values()].flatMap((on) => [...on.ties.keys()])),
          );
          // A draft whose lines were all sent untied unwinds nothing, and that
          // is an answer rather than a blank. Falling back to the invoice's
          // own receipts there stamped a floating credit with twenty-three
          // receivers it explicitly does not reverse.
          const answered = draft.lines.some((l) => l.untied || (l.ties?.length ?? 0) > 0);
          // A return that never answered the receiving question falls back to
          // the invoice's own receipts, and those cover every delivery the
          // vendor ever made. Cut to the ones that actually carried something
          // on this return, so the record lists the deliveries it could
          // plausibly be unwinding rather than a hundred and fifty of them.
          const onThisReturn = new Set(draft.lines.map((l) => l.sku));
          const legReceipts = answered
            ? unwound
            : (invoice.linkedGRNs ?? []).filter((grn) =>
                carriesAny(draft.vendorName, grn, onThisReturn),
              );
          return {
            vendorName: draft.vendorName,
            vendorCode: draft.vendorCode,
            leg: {
              originIds: Array.from(new Set(items.map((li) => li.originId))),
              shipTo: returnShipTo || returnShipToOptions(draft.vendorName)[0],
              shipToPartner: draft.vendorName,
              receivingNumbers: legReceipts,
            },
            // The quantity is the vendor's share, not the line's total: a part
            // split between two of them is one line on each draft, each for
            // what that vendor is taking. The ties come with it: without them
            // the record cannot say what the credit reverses, and the whole
            // second step would be a question asked and then discarded.
            lines: items
              .filter((li) => wanted.has(wantKey(li.sku, li.uom)))
              .map((li) => {
                const on = wanted.get(wantKey(li.sku, li.uom));
                const ties = on ? [...on.ties].map(([grnNumber, qty]) => ({ grnNumber, qty })) : [];
                // What the line says it received has to be what the
                // deliveries behind it carried. Left as the catalogue's
                // on-hand figure, a line tied to one receipt holding 54 BOX
                // printed "2754 BOX" under both Ordered and Received.
                const tied = ties.reduce((n, t) => n + t.qty, 0);
                const fromDocs = receivedOnGRNs(
                  draft.vendorName,
                  legReceipts,
                  li.sku,
                  li.uom,
                );
                const receivedOnTies =
                  tied > 0 ? Math.round(tied * 100) / 100 : fromDocs > 0 ? fromDocs : null;
                return {
                  ...li,
                  returnQty: on?.qty ?? li.returnQty,
                  ...(receivedOnTies !== null
                    ? { receivedQty: receivedOnTies, orderedQty: receivedOnTies }
                    : {}),
                  ...(on && on.serials.length > 0 ? { serialNumbers: on.serials } : {}),
                  ...(ties.length > 0
                    ? { ties }
                    : on?.untied
                      ? { untied: true, ties: [] }
                      : {}),
                };
              }),
          };
        })
      : effectiveLegs.map((leg) => {
          const onThisLeg = new Set(leg.originIds);
          return {
            leg,
            vendorName: invoice.vendor,
            vendorCode: vendor?.vendorCode,
            lines:
              effectiveLegs.length === 1 ? items : items.filter((li) => onThisLeg.has(li.originId)),
          };
        });

  return drafts.map((draft, legIdx) => {
    const leg = draft.leg;
    const rmaNumber = `RMA-${String(nextNumber + 1 + legIdx).padStart(5, '0')}`;
    const onThisLeg = new Set(leg.originIds);
    // The resolution its own vendor was asked for, written onto the document
    // and onto every line of it. Nothing inherits another vendor's remedy.
    const resolution = draft.vendorCode ? resolutionsByVendor[draft.vendorCode] : undefined;
    // The paid units the last step showed for each part, handed out across
    // the lines that carry it in order, so two lines of one part do not
    // each claim the whole figure.
    const paidLeft = new Map(Object.entries(resolution?.paidQtyByItem ?? {}));
    const legItems = draft.lines.map((li, i) => {
      const paidKey = `${li.sku}|${li.uom}`;
      const paidPool = paidLeft.get(paidKey);
      const paidQty =
        paidPool !== undefined ? Math.min(paidPool, li.approvedQty ?? li.returnQty) : undefined;
      if (paidPool !== undefined && paidQty !== undefined) paidLeft.set(paidKey, paidPool - paidQty);
      // The reason the last step asked for this part is the one the buyer
      // chose last, so it wins over the grid's. Leaving it out saved four
      // different reasons as Failed inspection on every line.
      const stepReason = resolution?.reasons?.[li.sku];
      const otherNote = stepReason === 'Other' ? resolution?.reasonNotes?.[li.sku]?.trim() : undefined;
      return {
        ...li,
        id: `rma-line-${rmaNumber}-${i}`,
        // The document's resolution fills a line that was never asked, and
        // only that line. Writing it over every line turned four lines set to
        // Failed inspection into five reading Other.
        ...(stepReason
          ? { reason: stepReason }
          : resolution?.reason && !ownReason.has(li.id)
            ? { reason: resolution.reason }
            : {}),
        ...(otherNote ? { notes: li.notes ? `${otherNote}\n${li.notes}` : otherNote } : {}),
        ...(paidQty !== undefined ? { paidQty } : {}),
        ...(resolution?.returnType ? { returnType: resolution.returnType } : {}),
      };
    });
    const legPOs = selectedPOs.filter((po) => onThisLeg.has(po.originId));
    // Every line carries the return's one resolution, asked on the last step,
    // so the header reads the first of them rather than summarising a mix that
    // can no longer happen.
    const headerReturnType: ReturnType = legItems[0]?.returnType ?? 'Refund/Credit';
    // The header reason summarises the lines, so it takes the one recorded
    // most often. Hardcoding it would misreport the return and skew the
    // most-common-reason insight.
    const reasonTally = new Map<ReturnReason, number>();
    legItems.forEach((li) => reasonTally.set(li.reason, (reasonTally.get(li.reason) ?? 0) + 1));
    const headerReason: ReturnReason =
      [...reasonTally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Failed inspection';

    return {
      id: `rma-${rmaNumber}`,
      rmaNumber,
      // The orders the return's own receipts belong to, which is not always
      // the order the part was first found on. Naming one PO beside receipts
      // from three others is a record that contradicts itself.
      ...(() => {
        const fromReceipts = [
          ...new Set(
            leg.receivingNumbers
              .map((grn) => poForGRN(draft.vendorName, grn))
              .filter((po): po is string => !!po),
          ),
        ];
        const declared =
          (effectiveLegs.length === 1 ? selectedPOs[0] : legPOs[0])?.poNumber ??
          invoice.linkedPOs[0];
        const all = fromReceipts.length > 0 ? fromReceipts : declared ? [declared] : [];
        return {
          sourcePO: all[0] ?? '–',
          ...(all.length > 0 ? { sourcePOs: all } : {}),
        };
      })(),
      // The leg already decided this when the return named what it unwinds,
      // so an empty list there is deliberate. The fallback is only for a
      // return that arrived without the answer at all.
      receivingNumbers:
        vendorDrafts.length > 0
          ? leg.receivingNumbers
          : leg.receivingNumbers.length > 0
            ? leg.receivingNumbers
            : invoice.linkedGRNs ?? [],
      // The vendor the draft is raised against, which on a return that settles
      // with several is not the one the parent invoice happened to name. Every
      // split draft used to carry that one name, so four drafts all claimed to
      // be with the same company.
      vendor: draft.vendorName,
      vendorCode: draft.vendorCode ?? vendor?.vendorCode,
      status: 'Draft',
      returnType: headerReturnType,
      reason: headerReason,
      // What the user asked for where the goods had already been paid for:
      // money back, or a credit on the account. Nothing else on a return is a
      // choice, so nothing else is recorded here.
      //
      // Always written, even when nobody picked. The ledger and the vendor
      // document both have to say how the return settles, and they already
      // read an unanswered return as money back; leaving the field off put
      // "Not chosen" on the record while those two quietly assumed a refund.
      creditTerms: {
        refundOrCredit: resolution?.settlement ?? 'Refund',
        creditPct: 100,
        restockingFee: 0,
      },
      owner: currentUser,
      createdBy: currentUser,
      createdDate,
      items: legItems,
      // Each draft is one shipment to one address, so the flat field always
      // reads and the sidebar keeps its one-line Return Ship-To.
      ...(leg.shipTo ? { returnShipTo: leg.shipTo } : returnShipTo ? { returnShipTo } : {}),
      // The party the shipment is addressed to, which is not always the
      // vendor the goods came from.
      returnShipToPartner: leg.shipToPartner || returnShipToPartner || invoice.vendor,
      returnRouting,
      // One RMA, one credit, and as many shipments as there are sites. The
      // draft's own leg is a single synthesized one; where the merge and split
      // step actually answered the site question, its legs carry real site ids
      // and a per-site address, so they are what the record keeps.
      returnLegs: (() => {
        // Consolidated is one leg for the whole return, and its partner is
        // whoever owns the address -- which on a redirect is not the vendor.
        if (returnLegs.length === 1) return returnLegs;
        const mine = returnLegs.filter((l) => l.shipToPartner === draft.vendorName);
        return mine.length > 0 ? mine : [leg];
      })(),
      // A fan-out ships each site on its own carrier, so the leg's choice wins
      // over the return-level one.
      ...(leg.carrier || carrier ? { carrier: leg.carrier || carrier } : {}),
      ...(shippingInstruction ? { shippingInstruction } : {}),
      // The last step asks per vendor, so its answer wins over the header's.
      ...(resolution?.vendorRMANumber || vendorRMANumber
        ? { vendorRMANumber: resolution?.vendorRMANumber || vendorRMANumber }
        : {}),
      // A date the vendor named is a promise in the approval's own shape, so
      // the Return Summary reads it the same way and approving can confirm or
      // replace it.
      ...(resolution?.refundExpectedDate
        ? {
            refundExpectation: {
              days: 0,
              from: 'today' as const,
              method: 'Unknown' as const,
              onDate: resolution.refundExpectedDate,
              at: now.toISOString(),
              by: currentUser,
            },
          }
        : {}),
      ...(expectedResolutionDate ? { expectedResolutionDate } : {}),
      // Whatever the header carries, plus whatever the last step attached to
      // this vendor's own document. Both land in the RMA Attachments bucket.
      ...(headerAttachments.length + (resolution?.attachments?.length ?? 0) > 0
        ? { attachments: [...headerAttachments, ...(resolution?.attachments ?? [])] }
        : {}),
      ...(payToAccountId ? { payToAccountId } : {}),
      // What this vendor's resolution said behind its reason, which is the
      // return's own description. A spread higher up the literal lost to this
      // line, so it is set here.
      notes: resolution?.note || invoice.description || undefined,
      ...(resolution?.tags?.length ? { tags: resolution.tags } : {}),
      // What the vendor said they would hold back. Asked on the last step and
      // written onto the record, so the detail page opens on the answer
      // instead of an empty section somebody has to fill in again.
      ...(resolution?.charges?.length ? { additionalCharges: resolution.charges } : {}),
      actionHistory: [{ action: 'create', by: currentUser, at: now.toISOString() }],
    };
  });
}
