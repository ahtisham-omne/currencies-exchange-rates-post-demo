/**
 * Send to Vendor — the RMA counterpart of the Sales Order module's Send to
 * Customer dialog. Same shape: a paged preview of the exact document the
 * counterparty receives, then the send. What differs is the payload, because
 * a return authorization asks for goods to be taken back and a credit to be
 * issued, so the document leads with what is being returned, why, where it is
 * going and what credit is expected, rather than with pricing and delivery.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Paperclip, Printer, Send, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { rmaAttachments } from '@/app/components/rma/rmaAttachments';
import { Button } from '@/app/components/ui/button';
import { imageForSku } from '@/app/lib/itemImages';
import { PARTNER_LOCATION_ITEMS } from '@/app/data/partnerLocations';
import { mockVendors, vendorAddress } from '@/app/data/mockVendors';
import type { RMA, RMALineItem } from '@/app/data/mockRMAs';
import { BUCKET_LABELS } from '@/app/data/rmaReturnAllocation';
import { restockingFeeAmount, rmaSettlementSummary } from '@/app/data/rmaGLEntries';

/* Paper palette — the document is a fixed-contrast artifact the vendor
   prints or reads in an email client, so it uses literal hex rather than the
   app's themeable tokens. */
const DOC = {
  fg: '#1F2937',
  muted: '#6B7280',
  mutedSoft: '#9CA3AF',
  border: '#E5E7EB',
  panel: '#F9FAFB',
  primary: '#2563EB',
  destructive: '#DC2626',
  green: '#059669',
  greenBg: '#D1FAE5',
  greenFg: '#065F46',
  amberBg: '#FEF3C7',
  amberFg: '#92400E',
  blueBg: '#DBEAFE',
  blueFg: '#1E40AF',
  grayBg: '#F3F4F6',
  grayFg: '#4B5563',
  headerBg: '#111827',
};

/* How the return settles, in the vendor's words.

   Read off the resolution the return actually chose, which lives once on the
   document. It used to be read off a return type, so a record whose
   resolution said credit could print terms that settled by replacement, and
   a record that had chosen nothing printed terms anyway. */
type SettlementCopy = {
  chip: string;
  lineValue: string;
  method: string;
  totalLabel: string;
  footerLabel: string;
  clause: string;
  bg: string;
  fg: string;
};

const SETTLEMENT_COPY: Record<'Refund' | 'Credit', SettlementCopy> = {
  Credit: {
    chip: 'CREDIT',
    lineValue: 'CREDIT VALUE',
    method: 'Credit memo against open payables',
    totalLabel: 'Credit Expected',
    footerLabel: 'Credit expected',
    clause: 'Authorized lines settle by credit memo issued against open payables. The credit memo must reference this authorization number and be issued within 15 business days of acceptance.',
    bg: DOC.greenBg,
    fg: DOC.greenFg,
  },
  Refund: {
    chip: 'REFUND',
    lineValue: 'REFUND VALUE',
    // ERP-8714 AC2 (Oct 29): accounting logs the refund into the account it
    // arrives in. The rule that it returns to the paying account was dropped
    // on Oct 23.
    method: 'Refund, logged by accounting into the account it arrives in',
    totalLabel: 'Refund Expected',
    footerLabel: 'Refund expected',
    clause: 'Authorized lines settle by refund. The refund must reference this authorization number and be remitted within 15 business days of acceptance.',
    bg: DOC.greenBg,
    fg: DOC.greenFg,
  },
};

function statusBadge(status: string): { bg: string; fg: string } {
  const map: Record<string, { bg: string; fg: string }> = {
    Draft: { bg: DOC.grayBg, fg: DOC.grayFg },
    Sent: { bg: DOC.amberBg, fg: DOC.amberFg },
    Approved: { bg: DOC.blueBg, fg: DOC.blueFg },
    'Shipped to Vendor': { bg: DOC.blueBg, fg: DOC.blueFg },
    Closed: { bg: DOC.greenBg, fg: DOC.greenFg },
    Cancelled: { bg: '#FEE2E2', fg: '#991B1B' },
  };
  return map[status] ?? map['Draft']!;
}

function formatDate(iso?: string): string {
  if (!iso) return '–';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** Address book lookup for the party blocks. A vendor can route returns to
 *  another partner's site, so the ship-to address is resolved from the
 *  partner named on the RMA rather than from the vendor. */
function addressFor(name?: string): string {
  if (!name) return '';
  const match = PARTNER_LOCATION_ITEMS.find(
    (p) => name === p.name || name.startsWith(p.name),
  );
  return match?.location ?? '';
}

interface Party {
  title: string;
  name: string;
  phone: string;
  address: string;
  extra?: { label: string; value: string }[];
}

/** The pill switch the sales order's own send modal uses for its visibility
 *  settings, brought over so a document option looks the same in both. */
function DocToggle({
  enabled,
  onChange,
  ariaLabel,
}: {
  enabled: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={ariaLabel}
      onClick={() => onChange(!enabled)}
      className="relative shrink-0 rounded-full transition-colors"
      style={{
        width: 34,
        height: 19,
        backgroundColor: enabled ? 'hsl(var(--primary))' : '#CBD5E1',
      }}
    >
      <span
        className="absolute top-[2px] rounded-full bg-white transition-transform"
        style={{
          width: 15,
          height: 15,
          transform: enabled ? 'translateX(17px)' : 'translateX(2px)',
          boxShadow: '0 1px 3px rgba(15,23,42,0.25)',
        }}
      />
    </button>
  );
}

export function SendToVendorModal({
  open,
  onOpenChange,
  rma,
  currency,
  isResend,
  mode = 'send',
  autoPrint,
  onSend,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rma: RMA;
  currency: string;
  isResend?: boolean;
  /** 'print' reuses the document as a read-only artifact, with no send. */
  mode?: 'send' | 'print';
  /** Download opens the same document straight into the print dialog, where
   *  "Save as PDF" writes it out under the return number. */
  autoPrint?: boolean;
  onSend: () => void;
}) {
  const docRef = useRef<HTMLDivElement>(null);
  const isPrint = mode === 'print';

  // The document is inline-styled with literal hex (see DOC above), so it
  // survives being lifted out of the app and into a bare print frame with no
  // stylesheet. An iframe keeps the browser's print dialog scoped to the
  // return rather than to the whole detail page behind it.
  const printDocument = () => {
    const node = docRef.current;
    if (!node) return;
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) {
      frame.remove();
      return;
    }
    doc.open();
    doc.write(
      `<!doctype html><html><head><title>${rma.rmaNumber}</title></head>` +
        `<body style="margin:0;padding:32px 40px">${node.innerHTML}</body></html>`,
    );
    doc.close();
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1000);
  };

  // The dialog needs the document in the DOM to copy it, so the wait is for
  // the modal's mount rather than for an arbitrary delay.
  useEffect(() => {
    if (!open || !autoPrint) return;
    const id = window.requestAnimationFrame(() => printDocument());
    return () => window.cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoPrint]);
  const sym = currency === 'USD' ? '$' : `${currency} `;
  const money = (n: number) =>
    `${sym}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const lines = rma.items;
  // Units are counted per unit of measure and never added across them:
  // 12 EA and 4 BOX is not 16 of anything. The document summed 451 units
  // across six units of measure.
  const unitsByUom = (() => {
    const byUom = new Map<string, number>();
    lines.forEach((l) => byUom.set(l.uom.toUpperCase(), (byUom.get(l.uom.toUpperCase()) ?? 0) + l.returnQty));
    return [...byUom.entries()]
      .map(([uom, qty]) => `${qty.toLocaleString('en-US')} ${uom}`)
      .join(', ');
  })();
  const subtotal = lines.reduce((s, l) => s + l.returnQty * l.unitPrice, 0);
  // What the vendor owes back in money: what was paid, plus what is credited
  // against an invoice still open. Goods never invoiced owe nothing -- the
  // accrual simply unwinds -- so the document no longer asks for them as a
  // refund. It asked for the whole return value before.
  const summary = rmaSettlementSummary(rma);
  const notOwed = Math.max(0, Math.round((subtotal - summary.claimed) * 100) / 100);
  const creditPct = rma.creditTerms?.creditPct;
  // A vendor who credits at less than full value is agreeing to a haircut on
  // the return, which the document has to state before it is a credit claim.
  const creditReduction =
    creditPct != null && creditPct < 100 ? summary.claimed * (1 - creditPct / 100) : 0;
  // Every agreed charge by name, in dollars. A restocking fee agreed only as a
  // percentage is said in dollars on the same base the approval used.
  const restockingPct = rma.creditTerms?.restockingFee ?? 0;
  const chargeLines = (() => {
    const listed = (rma.additionalCharges ?? []).filter((c) => c.amount > 0.004);
    const feeListed = listed.some((c) => c.type === 'Restocking fee');
    const fee = feeListed ? 0 : restockingFeeAmount(rma, restockingPct);
    return [
      ...listed.map((c) => ({ label: c.type, amount: c.amount })),
      ...(fee > 0.004 ? [{ label: 'Restocking fee', amount: fee }] : []),
    ];
  })();
  const restockingFee =
    chargeLines.filter((c) => c.label === 'Restocking fee').reduce((n, c) => n + c.amount, 0);
  const expectedCredit = Math.max(
    0,
    Math.round(
      (summary.claimed - creditReduction - chargeLines.reduce((n, c) => n + c.amount, 0)) * 100,
    ) / 100,
  );

  // A return that has not recorded its resolution yet is read as taking the
  // money back, the same default the settlement step carries.
  const takesCredit = rma.creditTerms?.refundOrCredit === 'Credit';
  const settlementCopy = SETTLEMENT_COPY[takesCredit ? 'Credit' : 'Refund'];
  // Every order behind the goods, not the first one on the record. The header
  // printed a single PO beside a list of receiving documents belonging to
  // three different orders, which reads as a document that contradicts itself
  // on the line above.
  const sourcePOs = [...new Set(rma.sourcePOs ?? [rma.sourcePO])].filter(Boolean);
  const sourcePOList = sourcePOs.join(', ') || '\u2014';
  /** For a sentence, where a list of three needs the word to agree with it. */
  const sourcePOPhrase =
    sourcePOs.length > 1 ? `purchase orders ${sourcePOList}` : `purchase order ${sourcePOList}`;
  /** How this return settles, said to the vendor.
   *
   *  A credit settles on their account and needs no instrument. A refund
   *  settles by whatever was agreed at approval; where nobody has said yet,
   *  the vendor's usual method is named as the expectation rather than left
   *  blank, and where even that is unknown the document says the question is
   *  still open instead of inventing an answer. */
  const settlementMethod = (() => {
    if (takesCredit) return 'Credit against the open invoice';
    const agreed = rma.refundExpectation?.method;
    if (agreed && agreed !== 'Unknown') return agreed;
    const usual =
      rma.paymentMethodName ??
      mockVendors.find((v) => v.vendorName === rma.vendor)?.primaryPaymentMethod;
    return usual ? `${usual} (your usual method)` : 'To be confirmed';
  })();
  const shipToName = rma.returnShipTo ?? `${rma.vendor} Returns Dept, Dock 4`;
  const shipToPartner = rma.returnShipToPartner ?? rma.vendor;
  const isRedirect = shipToPartner !== rma.vendor;

  const parties: Party[] = [
    {
      title: 'VENDOR',
      name: rma.vendor,
      phone: '+1 (866) 590-2588',
      // The vendor's own address, from the vendor master. The placeholder was
      // printed on both documents for every vendor: a return authorization
      // that tells the vendor to look their own address up in our ledger.
      address:
        addressFor(rma.vendor) ||
        (rma.vendorCode ? (vendorAddress(rma.vendorCode) ?? '') : '') ||
        'No address on the vendor record',
    },
    {
      title: 'RETURN SHIP TO',
      name: shipToName,
      phone: '+1 (844) 372-8267',
      address: addressFor(shipToPartner) || 'Address supplied on the vendor authorization',
      extra: [
        ...(isRedirect ? [{ label: 'Received by', value: shipToPartner }] : []),
        { label: 'Carrier', value: rma.carrier ?? 'To be assigned' },
      ],
    },
    {
      title: 'SHIPS FROM',
      name: 'Omne',
      phone: '+1 (412) 456-6879',
      address: '1231 Tech Ct, Westminster\nMD 21157\nUnited States',
      extra: [
        { label: 'Freight arranged by', value: rma.freightArrangedBy ?? 'Tenant' },
        { label: 'Freight paid by', value: rma.freightPaidBy ?? 'Vendor' },
      ],
    },
  ];

  const metaCell = (label: string, val: string) => (
    <div key={label} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
      <span style={{ color: DOC.muted, minWidth: 140, fontSize: 12 }}>{label}</span>
      <span style={{ fontWeight: 700, color: DOC.fg, fontSize: 12 }}>{val}</span>
    </div>
  );

  const statCell = (label: string, val: ReactNode) => (
    <div key={label} style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: DOC.mutedSoft, letterSpacing: '0.08em', marginBottom: 3 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: DOC.fg, lineHeight: 1.35 }}>{val}</div>
    </div>
  );

  /** Serial or lot identifiers the vendor checks the returned units against. */
  const trackedIds = (li: RMALineItem): string | null => {
    if (li.serialNumbers && li.serialNumbers.length > 0) return li.serialNumbers.join(', ');
    if (li.lots && li.lots.length > 0) return li.lots.map((l) => `${l.lot} (${l.qty})`).join(', ');
    return null;
  };

  /** Whether the paperwork travels with the authorization.
   *
   *  Eli, Oct 9: the attachments on a return are gathered and sent with it
   *  rather than listed on their own tab, so whether they go is a decision
   *  about this send, made here. The sales order asks the same question of
   *  its own document, one switch per section; this document has one section
   *  to ask about. */
  const [includeAttachments, setIncludeAttachments] = useState(true);
  /** Every file the return carries.
   *
   *  Read through the same bridge the Attachments tab reads, not off
   *  `rma.attachments` directly. That raw list is the thin `{ name }[]` the
   *  data model carries and it is empty on every seeded return, so the
   *  document's References block had never once printed while the tab beside
   *  it listed twenty-six files. */
  const docAttachments = useMemo(() => rmaAttachments(rma), [rma]);
  const attachmentCount = docAttachments.length;

  /** The status this document goes out under. A draft being sent is a sent
   *  authorization by the time the vendor opens it. */
  const documentStatus = rma.status === 'Draft' ? 'Sent' : rma.status;
  const sb = statusBadge(documentStatus);


  function renderDocument() {
    return (
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: DOC.fg }}>
        {/* Header bar */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: DOC.headerBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>O</span>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: DOC.fg, letterSpacing: '0.04em' }}>OMNE ERP</div>
              <div style={{ fontSize: 10, color: DOC.muted, letterSpacing: '0.02em' }}>Procurement &amp; Returns Management</div>
            </div>
          </div>
          <div style={{ textAlign: 'right', minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: DOC.fg, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              Return Authorization
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: DOC.primary }}>{rma.rmaNumber}</span>
              {/* What the vendor is looking at is a sent authorization, so
                  it never says DRAFT: sending it is what stops it being one,
                  and a document stamped DRAFT is one nobody acts on. */}
              <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 5, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', background: sb.bg, color: sb.fg, whiteSpace: 'nowrap' }}>
                {documentStatus.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Return details grid */}
        <div style={{ background: DOC.panel, border: `1px solid ${DOC.border}`, borderRadius: 10, padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 36, rowGap: 8 }}>
            {/* Return type and reason are set per line, so the header no
                longer summarizes either. Each line states its own below. */}
            {metaCell('RMA Date:', formatDate(rma.createdDate))}
            {metaCell(sourcePOs.length > 1 ? 'Source PO #s:' : 'Source PO #:', sourcePOList)}
            {/* No receiving documents here. They are our numbers for our
                own goods-in, and the vendor has no way to look one up:
                what they match the return against is their own PO and
                the RMA number. (Eli, Sept 23.) */}
            {metaCell('Vendor RMA #:', rma.vendorRMANumber || 'To be assigned by vendor')}
            {metaCell('Requested By:', rma.owner)}
            {metaCell('Raised By:', rma.createdBy)}
            {metaCell('Return Routing:', rma.returnRouting === 'consolidated' ? 'Consolidated to one address' : 'Back to receiving site')}
            {/* How the money comes back, not which of our accounts it lands
                in. The pay-to account was an internal ledger code the vendor
                has no use for and cannot act on. (Eli, Sept 23 and Oct 9.)
                What they need to know is which instrument to settle by. */}
            {metaCell(
              takesCredit ? 'Settlement:' : 'Payment method:',
              settlementMethod,
            )}
          </div>
        </div>

        {/* Party blocks */}
        <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
          {parties.map((p) => (
            <div key={p.title} style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: DOC.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{p.title}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: DOC.fg, marginBottom: 4, lineHeight: 1.3 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: DOC.fg, marginBottom: 3 }}>{p.phone}</div>
              <div style={{ fontSize: 11, color: DOC.muted, lineHeight: 1.55, whiteSpace: 'pre-line' }}>{p.address}</div>
              {p.extra && (
                <div style={{ marginTop: 8, fontSize: 11, color: DOC.muted, lineHeight: 1.6 }}>
                  {p.extra.map((e) => (
                    <div key={e.label}>{e.label}: <strong style={{ color: DOC.fg }}>{e.value}</strong></div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Items being returned */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: DOC.fg }}>Items Being Returned</span>
          <span style={{ fontSize: 11, color: DOC.muted }}>({lines.length} lines, {unitsByUom})</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lines.map((li, idx) => {
            const lineCredit = li.returnQty * li.unitPrice;
            const ids = trackedIds(li);
            const priceCorrected = li.originalUnitPrice != null && li.originalUnitPrice !== li.unitPrice;
            // Goods billed in more than one invoice state settle on different
            // terms, so the vendor gets each state as its own line rather than
            // a single figure they cannot reconcile against their ledger.
            const settlements = li.settlements && li.settlements.length > 1 ? li.settlements : undefined;
            const mixedReasons = settlements ? new Set(settlements.map((s) => s.reason)).size > 1 : false;
            return (
              <div key={li.id} style={{ border: `1px solid ${DOC.border}`, borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: DOC.mutedSoft, paddingTop: 3, flexShrink: 0 }}>{String(idx + 1).padStart(2, '0')}</span>
                  <img
                    src={imageForSku(li.sku, 96)}
                    alt=""
                    style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover', border: `1px solid ${DOC.border}`, flexShrink: 0 }}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: DOC.fg, marginBottom: 2 }}>{li.sku}</div>
                    <div style={{ fontSize: 11, color: DOC.muted, lineHeight: 1.4 }}>{li.description}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: DOC.muted, letterSpacing: '0.08em', marginBottom: 3 }}>
                      LINE VALUE
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: DOC.fg }}>{money(lineCredit)}</div>
                  </div>
                </div>

                <div style={{ marginTop: 12, background: DOC.panel, border: `1px solid ${DOC.border}`, borderRadius: 8, padding: '9px 14px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {statCell('Received', `${li.receivedQty} ${li.uom}`)}
                  {statCell('Returning', `${li.returnQty} ${li.uom}`)}
                  {statCell(
                    'Unit Price',
                    priceCorrected ? (
                      <>
                        <span style={{ textDecoration: 'line-through', color: DOC.mutedSoft, fontWeight: 400, marginRight: 5 }}>{money(li.originalUnitPrice!)}</span>
                        {money(li.unitPrice)}
                      </>
                    ) : (
                      money(li.unitPrice)
                    ),
                  )}
                  {statCell('Reason', mixedReasons ? 'Per state, below' : li.reason)}
                </div>

                {settlements && (
                  <div style={{ marginTop: 10, marginLeft: 24, borderLeft: `2px solid ${DOC.border}`, paddingLeft: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: DOC.muted, letterSpacing: '0.08em', marginBottom: 6 }}>
                      SETTLEMENT BY INVOICE STATE
                    </div>
                    {settlements.map((s) => (
                      <div key={s.state} style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 11, padding: '3px 0' }}>
                        <span style={{ color: DOC.fg, fontWeight: 700, minWidth: 190 }}>
                          {BUCKET_LABELS[s.state]}
                        </span>
                        <span style={{ color: DOC.muted }}>
                          {s.qty} {li.uom} × {money(s.unitPrice)}
                        </span>
                        <span style={{ color: DOC.muted }}>{s.reason}</span>
                        <span style={{ marginLeft: 'auto', color: DOC.fg, fontWeight: 700 }}>{money(s.qty * s.unitPrice)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 10, display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 11 }}>
                  {/* Where we took the goods in, which is the fact the
                      vendor needs to match the line against their despatch.
                      It printed `originName`, the vendor's own site, so every
                      line told the vendor the goods were received at their
                      own address. */}
                  <span style={{ color: DOC.muted }}>Received at: <strong style={{ color: DOC.fg }}>{li.receivedAtSite ?? 'Not recorded'}</strong></span>
                  {ids && (
                    <span style={{ color: DOC.muted, minWidth: 0 }}>
                      {li.serialNumbers ? 'Serial #' : 'Lot'}: <strong style={{ color: DOC.fg, wordBreak: 'break-all' }}>{ids}</strong>
                    </span>
                  )}
                </div>

                {li.notes && (
                  <div style={{ marginTop: 4, fontSize: 11, color: DOC.muted, lineHeight: 1.5 }}>
                    <strong style={{ color: DOC.fg }}>Notes:</strong> {li.notes}
                  </div>
                )}
                {includeAttachments && li.attachments && li.attachments.length > 0 && (
                  <div style={{ marginTop: 5, fontSize: 11, color: DOC.primary, fontWeight: 600 }}>
                    {li.attachments.map((a, i) => (
                      <span key={a.name} style={{ marginRight: 12 }}>[{i + 1}] {a.name}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Freight terms + credit totals */}
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 32 }}>
          <div style={{ paddingTop: 4 }}>
            <div style={{ fontSize: 12, color: DOC.muted, marginBottom: 6 }}>Settlement Method: <span style={{ fontWeight: 700, color: DOC.fg }}>{settlementCopy.method}</span></div>
            <div style={{ fontSize: 12, color: DOC.muted, marginBottom: 6 }}>Freight Paid By: <span style={{ fontWeight: 700, color: DOC.fg }}>{rma.freightPaidBy ?? 'Vendor'}</span></div>
            <div style={{ fontSize: 12, color: DOC.muted }}>Carrier: <span style={{ fontWeight: 700, color: DOC.fg }}>{rma.carrier ?? 'To be assigned'}</span></div>
          </div>
          <div style={{ minWidth: 300 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 12 }}>
              <span style={{ color: DOC.muted }}>Return value ({unitsByUom})</span>
              <span style={{ fontWeight: 600, color: DOC.fg }}>{money(subtotal)}</span>
            </div>
            {notOwed > 0.004 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 12 }}>
                <span style={{ color: DOC.muted }}>Not yet invoiced, nothing owed</span>
                <span style={{ fontWeight: 600, color: DOC.muted }}>-{money(notOwed)}</span>
              </div>
            )}
            {creditReduction > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 12 }}>
                <span style={{ color: DOC.muted }}>Agreed credit rate ({creditPct}%)</span>
                <span style={{ fontWeight: 600, color: DOC.destructive }}>-{money(creditReduction)}</span>
              </div>
            )}
            {chargeLines.map((c, i) => (
              <div key={`${c.label}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 12 }}>
                <span style={{ color: DOC.muted }}>{c.label}</span>
                <span style={{ fontWeight: 600, color: DOC.destructive }}>-{money(c.amount)}</span>
              </div>
            ))}
            <div style={{ borderTop: `2px solid ${DOC.fg}`, marginTop: 8, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{settlementCopy.totalLabel}</span>
              <span style={{ fontSize: 20, fontWeight: 700 }}>{money(expectedCredit)}</span>
            </div>
          </div>
        </div>

        {/* Credit status */}
        <div style={{ marginTop: 28, background: DOC.panel, border: `1px solid ${DOC.border}`, borderRadius: 10, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            {/* Named from the resolution, like the figures under it. A return
                settling by refund printed a box headed Credit Status waiting
                on a vendor credit, two lines under "Settlement Method:
                Refund to the account the invoice was paid from". */}
            <div style={{ fontSize: 11, fontWeight: 700, color: DOC.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{takesCredit ? 'Credit Status' : 'Refund Status'}</div>
            <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', background: rma.creditAmountReceived ? DOC.greenBg : DOC.amberBg, color: rma.creditAmountReceived ? DOC.greenFg : DOC.amberFg }}>
              {rma.creditAmountReceived
                ? takesCredit ? 'CREDIT RECEIVED' : 'REFUND RECEIVED'
                : takesCredit ? 'AWAITING VENDOR CREDIT' : 'AWAITING VENDOR REFUND'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 7, fontSize: 12 }}>
            <span style={{ color: DOC.muted }}>{takesCredit ? 'Credit note #' : 'Refund reference'}</span>
            <span style={{ textAlign: 'right', fontWeight: 700, color: DOC.primary }}>{rma.creditNoteRef ?? 'Not yet issued'}</span>
            <span style={{ color: DOC.muted }}>Authorization date</span>
            <span style={{ textAlign: 'right', fontWeight: 600, color: DOC.fg }}>{formatDate(rma.approvedDate ?? rma.sentDate ?? rma.createdDate)}</span>
            <span style={{ color: DOC.muted }}>Goods dispatched</span>
            <span style={{ textAlign: 'right', fontWeight: 600, color: DOC.fg }}>{formatDate(rma.shippedDate)}</span>
            {/* Named from the resolution like every other figure on the
                document, so a return taking its money back does not print a
                block that only talks about credits. */}
            <span style={{ color: DOC.muted }}>{settlementCopy.footerLabel}</span>
            <span style={{ textAlign: 'right', fontWeight: 600, color: DOC.fg }}>{money(expectedCredit)}</span>
            <span style={{ color: DOC.muted }}>{takesCredit ? 'Credit received' : 'Refund received'}</span>
            <span style={{ textAlign: 'right', fontWeight: 700, color: DOC.green }}>{money(rma.creditAmountReceived ?? 0)}</span>
            <span style={{ color: DOC.muted }}>Outstanding</span>
            <span style={{ textAlign: 'right', fontWeight: 700, color: DOC.destructive }}>{money(Math.max(0, expectedCredit - (rma.creditAmountReceived ?? 0)))}</span>
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: DOC.fg, marginBottom: 10 }}>Notes</div>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: DOC.fg, lineHeight: 1.7 }}>
            {rma.notes && <li>{rma.notes}</li>}
            {rma.shippingInstruction && <li style={{ marginTop: 4 }}>{rma.shippingInstruction}</li>}
            <li style={{ marginTop: 4 }}>Quote {rma.rmaNumber} and your own RMA number on the outside of every carton and on the packing list.</li>
            {/* The routing is stated in the header, so the note cannot
                contradict it. A return the header calls "Consolidated to one
                address" carried a note forbidding exactly that. */}
            <li style={{ marginTop: 4 }}>
              Goods are shipped back against {sourcePOPhrase}.{' '}
              {rma.returnRouting === 'consolidated'
                ? 'They travel as one consolidated shipment to the address above.'
                : 'Do not consolidate them with any other return.'}
            </li>
            <li style={{ marginTop: 4 }}>
              {takesCredit
                ? <>Issue the credit memo to Accounts Payable at <strong>ap@omne.com</strong> referencing {rma.rmaNumber}.</>
                : <>Remit the refund to the account above and send the remittance advice to Accounts Payable at <strong>ap@omne.com</strong> referencing {rma.rmaNumber}.</>}
            </li>
            <li style={{ marginTop: 4 }}>Serial and lot identifiers listed against each line are the units authorized for return. Any unit outside that list will be refused.</li>
          </ol>
        </div>

        {/* Terms summary */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: DOC.fg, marginBottom: 8 }}>Return Terms</div>
          <div style={{ fontSize: 11, color: DOC.muted, lineHeight: 1.65 }}>
            This authorization is valid for 30 days from the date issued. Goods travel {rma.freightPaidBy === 'Tenant' ? 'at our expense' : 'at the vendor’s expense'} and remain our property until the credit is issued. Inspection findings must be raised within 10 business days of receipt, after which the return is deemed accepted as described. Full terms are set out below.
          </div>
        </div>

        {/* References */}
        {includeAttachments && docAttachments.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: DOC.fg, marginBottom: 6 }}>
              Attachments
            </div>
            <div style={{ fontSize: 11, color: DOC.muted, marginBottom: 6 }}>
              {docAttachments.length} {docAttachments.length === 1 ? 'file travels' : 'files travel'}{' '}
              with this authorization.
            </div>
            <div style={{ fontSize: 11, color: DOC.primary, lineHeight: 1.7 }}>
              {docAttachments.map((a, i) => (
                <div key={a.id}>
                  [{i + 1}] {a.name}
                  <span style={{ color: DOC.muted }}> · {a.size}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 36, paddingTop: 28, borderTop: `1px solid ${DOC.border}` }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: DOC.fg, marginBottom: 16, letterSpacing: '0.02em' }}>TERMS AND CONDITIONS</div>

          <div style={{ fontSize: 11, color: DOC.fg, lineHeight: 1.65 }}>
          <p style={{ marginBottom: 12 }}><strong>1. AUTHORIZATION & VALIDITY:</strong> This Return Authorization {rma.rmaNumber} is raised against {sourcePOPhrase} and the receiving documents listed above. It is valid for 30 days from the date issued. Goods received by the vendor without a valid authorization number visible on the carton may be refused and returned at the sender's cost.</p>

          <p style={{ marginBottom: 6 }}><strong>2. SCOPE OF THE RETURN:</strong></p>
          <ul style={{ paddingLeft: 22, marginBottom: 12, listStyle: 'disc' }}>
            <li><strong>Quantities:</strong> Only the quantities itemized above ({unitsByUom}) are authorized. Quantities returned may not exceed the quantity originally received on each line.</li>
            <li style={{ marginTop: 3 }}><strong>Identified units:</strong> Where serial or lot identifiers are listed, those specific units constitute the return. Substituted units will be held pending instruction and are not eligible for credit.</li>
            <li style={{ marginTop: 3 }}><strong>Reason of record:</strong> The reason stated against each line is the basis of the claim and governs how the line is settled.</li>
          </ul>

          <p style={{ marginBottom: 12 }}><strong>3. PACKAGING & SHIPPING:</strong> Goods will be returned in their original packaging where it survives receipt, otherwise in equivalent protective packaging. Freight is arranged by {rma.freightArrangedBy ?? 'the tenant'} and paid by {rma.freightPaidBy ?? 'the vendor'}. Risk of loss passes to the vendor on delivery to the address shown under Return Ship To. Tracking will be provided at dispatch.</p>

          <p style={{ marginBottom: 12 }}><strong>4. INSPECTION & ACCEPTANCE:</strong> The vendor will inspect the returned goods within 10 business days of receipt. Any discrepancy between the goods received and this authorization must be raised in writing within that window, quoting {rma.rmaNumber}. Absent such notice the return is deemed accepted as described.</p>

          <p style={{ marginBottom: 12 }}><strong>5. SETTLEMENT:</strong> {settlementCopy.clause} Any deduction from the value shown above must be itemized on the credit memo.</p>

          <p style={{ marginBottom: 12 }}><strong>6. RESTOCKING & VENDOR CHARGES:</strong> {restockingFee > 0 ? `A restocking fee${restockingPct > 0 ? ` of ${restockingPct}%` : ''} (${money(restockingFee)}) has been agreed and is reflected in the value expected above.` : 'No restocking fee has been agreed on this authorization.'} Any further deduction, handling charge, or fee must be agreed in writing and itemized before it is applied. Returns arising from defect, failed inspection, over-shipment, or goods not ordered are not subject to a restocking fee under any circumstance.</p>

          <p style={{ marginBottom: 12 }}><strong>7. TITLE & RISK:</strong> Title to the returned goods remains with us until the credit memo is issued or the refund is remitted. The vendor holds the goods as bailee in the interim and will not resell, scrap, or otherwise dispose of them before settlement.</p>

          <p style={{ marginBottom: 12 }}><strong>8. WARRANTY & DEFECTS:</strong> Lines returned as defective or as having failed inspection are returned under the warranty terms of the original purchase order. Settlement of those lines does not waive any further remedy available for the same defect across the remainder of the delivered quantity.</p>

          <p style={{ marginBottom: 12 }}><strong>9. RECORDS & CONFIDENTIALITY:</strong> Evidence attached to this authorization, including inspection photographs and correspondence, is provided solely to substantiate the return and remains confidential. Both parties will retain records of this return for the period required by their respective audit obligations.</p>

            <p style={{ marginBottom: 12 }}><strong>10. GENERAL PROVISIONS:</strong> This authorization, together with {sourcePOPhrase} and the referenced receiving documents, constitutes the entire agreement in respect of these goods and supersedes all prior communications about them. Nothing in this authorization varies the payment terms of the underlying purchase order.</p>
          </div>
        </div>

        <div style={{ marginTop: 36, paddingTop: 14, borderTop: `1px solid ${DOC.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: DOC.mutedSoft }}>Return Authorization {rma.rmaNumber}</span>
          <span style={{ fontSize: 10, color: DOC.mutedSoft }}>Powered by <strong style={{ color: DOC.fg }}>Omne</strong></span>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[210] flex flex-col gap-0 overflow-hidden border-0 p-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.18)] sm:max-w-none"
        style={{ maxWidth: 880, width: 'calc(100% - 2rem)', maxHeight: '90vh', borderRadius: 16 }}
        showCloseButton={false}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#EEF2F6] bg-card px-5 py-3.5 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#EFF6FF' }}>
              {isPrint ? <Printer className="w-4 h-4 text-primary" /> : <Send className="w-4 h-4 text-primary" />}
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                {isPrint ? 'Print RMA' : isResend ? 'Resend to vendor' : 'Send to vendor'}
              </DialogTitle>
              <DialogDescription className="text-[11px] text-muted-foreground">
                {isPrint
                  ? `${rma.rmaNumber} as it prints, unchanged from what ${rma.vendor} is sent.`
                  : `Review what ${rma.vendor} receives. Sending moves ${rma.rmaNumber} to Sent.`}
              </DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {attachmentCount > 0 && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] text-slate-600" style={{ fontWeight: 500 }}>
                  Include attachments
                  <span className="text-slate-400"> ({attachmentCount})</span>
                </span>
                <DocToggle
                  enabled={includeAttachments}
                  onChange={setIncludeAttachments}
                  ariaLabel="Include attachments on this document"
                />
              </label>
            )}
            <button
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-foreground hover:bg-muted transition-all shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4" style={{ maxHeight: 'calc(90vh - 130px)' }}>
            <div ref={docRef} className="bg-white rounded-lg border border-border" style={{ padding: '32px 40px', minHeight: 500, boxShadow: '0 1px 3px rgba(16,24,40,0.06)' }}>
              {renderDocument()}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[#EEF2F6] bg-card px-5 py-3 shrink-0">
          <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
            {settlementCopy.footerLabel}{' '}
            <span className="text-[12px] text-gray-900 tabular-nums" style={{ fontWeight: 600 }}>{money(expectedCredit)}</span>
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 px-4 text-[12px] rounded-lg bg-white">
              {isPrint ? 'Close' : 'Cancel'}
            </Button>
            {isPrint ? (
              <Button size="sm" onClick={printDocument} className="h-8 px-4 text-[12px] rounded-lg">
                <Printer className="w-3.5 h-3.5" />
                Print
              </Button>
            ) : (
              <Button size="sm" onClick={onSend} className="h-8 px-4 text-[12px] rounded-lg">
                <Send className="w-3.5 h-3.5" />
                {isResend ? 'Resend' : 'Send to vendor'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
