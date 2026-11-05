/* ═══════════════════════════════════════════════════════════════
   Print Sales Order — generates a print-ready SO document
   Layout matches the reference docx (FR Conversions style):
   - Expanded order details grid with PO + Recipient
   - Customer/Ship To/Bill To with phone numbers
   - Per-line shipment status row (carrier · tracking · ETA)
   - Payment Status block
   - Notes (5 items), References, full T&C on its own page
   ═══════════════════════════════════════════════════════════════ */

import type { SalesOrder, SOLine } from "./types";
import {
  DOC_C, fmtCurrency as fmtDocCurrency, escHtml,
  getLineShipment, shipStatusColors,
  getLineComments, getLinePricingRules,
  statusBadgeColors, getPaymentInfo, getHeaderMeta, getParties, docPaymentTerms, docPaymentMethod, docPaymentTermsSentence,
} from "./soDocumentData";
import { getExternalLinksList } from "@/app/data/linksRepository";

/* ── Main entry point ── */
export function printSalesOrder(so: SalesOrder): void {
  const html = generatePrintHTML(so);
  const existingFrame = document.getElementById("__so-print-frame__");
  if (existingFrame) existingFrame.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "__so-print-frame__";
  iframe.style.position = "fixed";
  iframe.style.top = "-10000px";
  iframe.style.left = "-10000px";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) { alert("Could not prepare print document."); iframe.remove(); return; }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  iframe.onload = () => {
    setTimeout(() => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); }
      catch { window.print(); }
      setTimeout(() => iframe.remove(), 1000);
    }, 500);
  };
}

/* ── HTML Generation ── */
function generatePrintHTML(so: SalesOrder): string {
  const fmtCurrency = (n: number) => fmtDocCurrency(n, so.currency);
  const activeLines = so.lines.filter(l => !l.cancelled);
  const cancelledLines = so.lines.filter(l => l.cancelled);
  const subtotal = activeLines.reduce((s, l) => s + l.orderedQty * l.unitPrice, 0);

  let totalDiscounts = 0;
  let discountItemCount = 0;
  activeLines.forEach(l => {
    getLinePricingRules(l.itemCode).forEach(r => {
      const lineTotal = l.orderedQty * l.unitPrice;
      if (r.type === "discount") { totalDiscounts += lineTotal * r.percent / 100; discountItemCount++; }
    });
  });
  const grandTotal = subtotal - totalDiscounts;
  const totalUnits = activeLines.reduce((s, l) => s + l.orderedQty, 0);

  const meta = getHeaderMeta(so);
  const parties = getParties(so);
  const payment = getPaymentInfo(so, grandTotal);
  const sb = statusBadgeColors(so.status);

  const itemRowsHTML = activeLines.map((li, idx) => itemRowHTML(li, idx, so.currency)).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SO ${escHtml(so.soNumber)} — ${escHtml(so.customer)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { font-family:'Inter',sans-serif; font-size:14px; color:${DOC_C.fg}; background:${DOC_C.bg}; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    @page { margin:14mm 12mm; size:A4; }
    @media print {
      body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .no-print { display:none !important; }
      .page-break { page-break-before:always; }
    }
    table { border-collapse:collapse; }
    a { text-decoration:none; }
  </style>
</head>
<body>

  <!-- Print Action Bar (hidden on print) -->
  <div class="no-print" style="position:sticky;top:0;z-index:100;background:${DOC_C.panelBgSoft};border-bottom:1px solid ${DOC_C.border};padding:12px 32px;display:flex;align-items:center;justify-content:space-between;">
    <div style="display:flex;align-items:center;gap:12px;">
      <div style="width:32px;height:32px;border-radius:8px;background:${DOC_C.headerBg};display:flex;align-items:center;justify-content:center;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      </div>
      <div>
        <div style="font-size:14px;font-weight:600;">Print Preview — SO ${escHtml(so.soNumber)}</div>
        <div style="font-size:11px;color:${DOC_C.muted};">${escHtml(so.customer)} · ${activeLines.length} line items</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;">
      <button onclick="window.close()" style="font-family:'Inter',sans-serif;font-size:12px;font-weight:500;padding:6px 16px;border:1px solid ${DOC_C.border};border-radius:8px;background:white;cursor:pointer;color:${DOC_C.fg};">Close</button>
      <button onclick="window.print()" style="font-family:'Inter',sans-serif;font-size:12px;font-weight:500;padding:6px 20px;border:none;border-radius:8px;background:${DOC_C.headerBg};color:white;cursor:pointer;">Print Document</button>
    </div>
  </div>

  <div style="max-width:820px;margin:0 auto;padding:32px;">

    <!-- ═══ HEADER BAR ═══ -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:36px;height:36px;border-radius:8px;background:${DOC_C.headerBg};display:flex;align-items:center;justify-content:center;">
          <span style="font-size:14px;font-weight:700;color:white;">O</span>
        </div>
        <span style="font-size:13px;font-weight:700;color:${DOC_C.fg};letter-spacing:0.04em;">PIONEER ERP</span>
      </div>
      <div style="font-size:22px;font-weight:700;color:${DOC_C.fg};letter-spacing:-0.01em;">
        Sales Order <span style="color:${DOC_C.primary};">${escHtml(so.soNumber)}</span>
      </div>
      <span style="display:inline-block;padding:5px 14px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:0.04em;background:${sb.bg};color:${sb.fg};white-space:nowrap;">${escHtml(so.status.toUpperCase())}</span>
    </div>

    <!-- ═══ ORDER DETAILS GRID (2 columns × multiple rows) ═══ -->
    <div style="background:${DOC_C.panelBgSoft};border:1px solid ${DOC_C.border};border-radius:10px;padding:16px 20px;margin-bottom:24px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;column-gap:36px;row-gap:8px;font-size:12px;">
        ${metaRow("Order Date:", meta.orderDate, "Customer PO #:", meta.customerPo)}
        ${metaRow("Estimated Delivery Date:", meta.estDelivery, "Customer PO Date:", meta.customerPoDate)}
        ${metaRow("Reference Quote #:", meta.refQuote, "Recipient:", meta.recipient)}
        ${metaRow("Version:", String(meta.versionNum), "Effective From:", meta.effectiveFrom)}
        ${metaRow("Version Draft Date:", meta.versionDraftDate, "Sales Person:", meta.salesPerson)}
        ${metaRow("", "", "Sales Person Contact:", meta.salesPersonContact)}
      </div>
    </div>

    <!-- ═══ CUSTOMER / SHIP TO / BILL TO ═══ -->
    <div style="display:flex;gap:24px;margin-bottom:24px;">
      ${parties.map(p => `
        <div style="flex:1;">
          <div style="font-size:10px;font-weight:700;color:${DOC_C.muted};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">${escHtml(p.title)}</div>
          <div style="font-size:13px;font-weight:700;color:${DOC_C.fg};margin-bottom:4px;line-height:1.3;">${escHtml(p.name)}</div>
          <div style="font-size:11px;color:${DOC_C.fg};margin-bottom:3px;">${escHtml(p.phone)}</div>
          <div style="font-size:11px;color:${DOC_C.muted};line-height:1.55;white-space:pre-line;">${escHtml(p.address)}</div>
          ${p.extra ? `<div style="margin-top:8px;font-size:11px;color:${DOC_C.muted};line-height:1.6;">
            ${p.extra.map(e => `<div>${escHtml(e.label)}: <strong style="color:${DOC_C.fg};">${escHtml(e.value)}</strong></div>`).join("")}
          </div>` : ""}
        </div>
      `).join("")}
    </div>

    <!-- ═══ ITEM DETAILS HEADER ═══ -->
    <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px;">
      <span style="font-size:16px;font-weight:700;color:${DOC_C.fg};">Item Details</span>
      <span style="font-size:11px;color:${DOC_C.muted};">(${activeLines.length} items, ${totalUnits} units total)</span>
    </div>

    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:${DOC_C.panelBgSoft};border-top:1px solid ${DOC_C.border};border-bottom:1px solid ${DOC_C.border};">
          ${tableHeader()}
        </tr>
      </thead>
      <tbody>
        ${itemRowsHTML}
      </tbody>
    </table>

    ${cancelledLines.length > 0 ? `
    <div style="margin-top:20px;">
      <div style="font-size:13px;font-weight:600;color:${DOC_C.destructive};padding:8px 0;border-bottom:2px solid ${DOC_C.destructive};margin-bottom:4px;">Cancelled Lines (${cancelledLines.length})</div>
      <table style="width:100%;">
        <tbody>
          ${cancelledLines.map(li => `
          <tr style="border-bottom:1px solid ${DOC_C.border};">
            <td style="padding:8px 8px 8px 0;font-size:12px;font-weight:500;text-decoration:line-through;color:${DOC_C.muted};">${escHtml(li.itemCode)} — ${escHtml(li.itemName)}</td>
            <td style="padding:8px;font-size:12px;text-align:center;color:${DOC_C.muted};">${li.cancelledQty || li.orderedQty}</td>
            <td style="padding:8px;font-size:11px;color:${DOC_C.muted};">${escHtml(li.cancelledReason || "—")}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>` : ""}

    <!-- ═══ PAYMENT METHOD + TOTALS ═══ -->
    <div style="margin-top:24px;display:flex;justify-content:space-between;align-items:flex-start;gap:32px;">
      <div style="padding-top:4px;">
        <div style="font-size:12px;color:${DOC_C.muted};margin-bottom:6px;">Payment Method: <span style="font-weight:700;color:${DOC_C.fg};">${escHtml(docPaymentMethod(so))}</span></div>
        <div style="font-size:12px;color:${DOC_C.muted};">Payment Terms: <span style="font-weight:700;color:${DOC_C.fg};">${escHtml(docPaymentTerms(so))}</span></div>
      </div>
      <div style="min-width:300px;">
        <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;">
          <span style="color:${DOC_C.muted};">Subtotal (${totalUnits} items)</span>
          <span style="font-weight:600;color:${DOC_C.fg};">${fmtCurrency(subtotal)}</span>
        </div>
        ${totalDiscounts > 0 ? `
        <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;">
          <span style="color:${DOC_C.muted};">Discounts Applied (${discountItemCount} items)</span>
          <span style="font-weight:600;color:${DOC_C.green};">-${fmtCurrency(totalDiscounts)}</span>
        </div>` : ""}
        <div style="border-top:2px solid ${DOC_C.fg};margin-top:8px;padding-top:10px;display:flex;justify-content:space-between;align-items:baseline;">
          <span style="font-size:16px;font-weight:700;">Total Amount</span>
          <span style="font-size:20px;font-weight:700;">${fmtCurrency(grandTotal)}</span>
        </div>
      </div>
    </div>

    <!-- ═══ PAYMENT STATUS ═══ -->
    <div style="margin-top:28px;background:${DOC_C.panelBgSoft};border:1px solid ${DOC_C.border};border-radius:10px;padding:18px 20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <div style="font-size:11px;font-weight:700;color:${DOC_C.muted};text-transform:uppercase;letter-spacing:0.08em;">Payment Status</div>
        <span style="display:inline-block;padding:4px 10px;border-radius:6px;font-size:10px;font-weight:700;letter-spacing:0.04em;background:${DOC_C.amberBg};color:${DOC_C.amberFg};">${escHtml(payment.status)}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr auto;row-gap:7px;font-size:12px;">
        <span style="color:${DOC_C.muted};">Invoice #</span>             <span style="text-align:right;font-weight:700;color:${DOC_C.primary};">${escHtml(payment.invoiceNumber)}</span>
        <span style="color:${DOC_C.muted};">Invoice Date</span>          <span style="text-align:right;font-weight:600;color:${DOC_C.fg};">${escHtml(payment.invoiceDate)}</span>
        <span style="color:${DOC_C.muted};">Payment Due Date</span>      <span style="text-align:right;font-weight:600;color:${DOC_C.fg};">${escHtml(payment.dueDate)}</span>
        <span style="color:${DOC_C.muted};">Amount Invoiced</span>       <span style="text-align:right;font-weight:600;color:${DOC_C.fg};">${fmtCurrency(payment.amountInvoiced)}</span>
        <span style="color:${DOC_C.muted};">${escHtml(payment.paidLabel)}</span> <span style="text-align:right;font-weight:700;color:${DOC_C.green};">${fmtCurrency(payment.amountPaid)}</span>
        <span style="color:${DOC_C.muted};">Outstanding Balance</span>   <span style="text-align:right;font-weight:700;color:${DOC_C.destructive};">${fmtCurrency(payment.amountInvoiced - payment.amountPaid)}</span>
      </div>
    </div>

    <!-- ═══ NOTES ═══ -->
    <div style="margin-top:28px;">
      <div style="font-size:14px;font-weight:700;color:${DOC_C.fg};margin-bottom:10px;">Notes</div>
      <ol style="margin:0;padding-left:20px;font-size:12px;color:${DOC_C.fg};line-height:1.7;">
        <li>The amount of the Sales Order is the agreed fixed price and shall not be exceeded without advanced written consent from the Bill To contact identified on the order.</li>
        <li style="margin-top:4px;">Include Sales Order# and Invoice# in ACH addenda (CCD/CTX) or remittance email.</li>
        <li style="margin-top:4px;">Remittance Advice Email: <strong>ap@pioneer-erp.com</strong></li>
        <li style="margin-top:4px;">Important Security information: Banking details on file. We do not accept account changes via email, call AP at +1 (844)-372-8267 to verify.</li>
        <li style="margin-top:4px;">Per-line shipment status will be updated automatically as carrier scans are received. For real-time status, visit the customer portal.</li>
      </ol>
    </div>

    <!-- ═══ TERMS SUMMARY ═══ -->
    <div style="margin-top:24px;">
      <div style="font-size:14px;font-weight:700;color:${DOC_C.fg};margin-bottom:8px;">Terms and Conditions</div>
      <div style="font-size:11px;color:${DOC_C.muted};line-height:1.65;">
        Prices are guaranteed for 30 days from quote conversion. ${escHtml(docPaymentTermsSentence(so))} A 1.5% late fee will be applied to overdue invoices. Warranty covers defects in material and workmanship for one year. Customer is responsible for shipping costs on warranty returns. Full Terms and Conditions are included on the next page.
      </div>
    </div>

    <!-- ═══ REFERENCES ═══ -->
    ${(() => {
      const externalUrls = getExternalLinksList(so.id);
      if (externalUrls.length === 0) return "";
      return `
    <div style="margin-top:20px;">
      <div style="font-size:14px;font-weight:700;color:${DOC_C.fg};margin-bottom:6px;">References</div>
      <div style="font-size:11px;color:${DOC_C.primary};line-height:1.7;">
        ${externalUrls.map((u) => `<div>${escHtml(u)}</div>`).join("")}
      </div>
    </div>`;
    })()}

    <!-- ═══ PAGE FOOTER ═══ -->
    <div style="margin-top:36px;padding-top:14px;border-top:1px solid ${DOC_C.border};display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:10px;color:${DOC_C.mutedSoft};">Sales Order# ${escHtml(so.soNumber)}</div>
      <div style="font-size:10px;color:${DOC_C.mutedSoft};">Page 1 of 2</div>
      <div style="font-size:10px;color:${DOC_C.mutedSoft};">Powered by <span style="font-weight:700;color:${DOC_C.fg};">Pioneer ERP</span></div>
    </div>

    <!-- ═══ PAGE 2: TERMS & CONDITIONS ═══ -->
    <div class="page-break"></div>
    <div style="text-align:center;font-size:12px;font-weight:600;color:${DOC_C.muted};margin-bottom:24px;padding-top:8px;">Pioneer ERP — Sales Order Terms and Conditions</div>
    <div style="font-size:18px;font-weight:700;color:${DOC_C.fg};margin-bottom:18px;letter-spacing:0.02em;">TERMS AND CONDITIONS</div>

    <div style="font-size:11px;color:${DOC_C.fg};line-height:1.65;">
      <p style="margin-bottom:12px;"><strong>1. ACCEPTANCE & VALIDITY:</strong> This Sales Order constitutes a binding contract upon issuance and references the customer's Purchase Order ${escHtml(meta.customerPo)} and Quote #${escHtml(meta.refQuote.split(" ")[0])}. Any changes after issuance require written agreement from both parties.</p>

      <p style="margin-bottom:6px;"><strong>2. PRICING & PAYMENT:</strong></p>
      <ul style="padding-left:22px;margin-bottom:12px;list-style:disc;">
        <li><strong>Pricing:</strong> All prices are in ${escHtml(so.currency || "USD")} and locked at the values agreed in the referenced Quote.</li>
        <li style="margin-top:3px;"><strong>Payment Terms:</strong> ${escHtml(docPaymentTermsSentence(so))} 50% deposit due upon order acceptance.</li>
        <li style="margin-top:3px;"><strong>Late Payment:</strong> Overdue amounts incur 1.5% monthly interest. We may suspend deliveries and pursue collection, with the customer responsible for all collection costs.</li>
      </ul>

      <p style="margin-bottom:12px;"><strong>3. DELIVERY & SHIPPING:</strong> We are not liable for carrier delays. Each line item has its own shipping milestone shown in the Items table. Customer must inspect upon delivery and report damage/discrepancies within 7 days. Per-line tracking numbers are provided once carrier pickup is confirmed.</p>

      <p style="margin-bottom:12px;"><strong>4. WARRANTIES & DISCLAIMERS:</strong> Products are warranted against defects in materials and workmanship for 12 months from delivery. Our sole obligation is to repair or replace defective products. Warranty is void if products are modified, misused, or damaged by the customer. We disclaim all other warranties, express or implied, including merchantability and fitness for particular purpose.</p>

      <p style="margin-bottom:12px;"><strong>5. LIMITATION OF LIABILITY:</strong> Our total liability shall not exceed the price paid for the products. We are not liable for indirect, incidental, consequential, special, or punitive damages, including lost profits, business interruption, or data loss, regardless of cause.</p>

      <p style="margin-bottom:12px;"><strong>6. CANCELLATIONS & RETURNS:</strong> Orders cannot be cancelled after acceptance without written consent. Custom or made-to-order items (including all EV-series vehicles on this order) are non-cancellable and non-returnable. Standard products may be returned within 30 days with prior authorization, subject to a restocking fee. Products must be unused in their original packaging. Customer pays return shipping unless products are defective.</p>

      <p style="margin-bottom:12px;"><strong>7. COMPLIANCE & EXPORT:</strong> Customer must comply with all export control laws and sanctions regulations. Products may not be exported to prohibited countries or used for prohibited purposes. Customer warrants they are not on restricted party lists and will obtain required export licenses.</p>

      <p style="margin-bottom:12px;"><strong>8. INTELLECTUAL PROPERTY:</strong> All designs, specifications, documentation, and intellectual property remain our exclusive property. Customer receives no license except as necessary to use purchased products. Customer must maintain the confidentiality of proprietary information.</p>

      <p style="margin-bottom:12px;"><strong>9. PRODUCT SPECIFICATIONS:</strong> Specifications are based on current standards and may change to comply with regulations or improve products. We are not liable for minor deviations that do not affect functionality. Custom specifications require a separate written agreement.</p>

      <p style="margin-bottom:12px;"><strong>10. FORCE MAJEURE:</strong> Neither party is liable for delays or failures due to events beyond reasonable control, including natural disasters, war, pandemics, strikes, or government actions. Performance obligations are suspended during such events.</p>

      <p style="margin-bottom:12px;"><strong>11. GENERAL PROVISIONS:</strong> Entire Agreement: This Sales Order, together with the referenced Quote and Customer Purchase Order, constitutes the entire agreement and supersedes all prior communications.</p>
    </div>

    <!-- Page 2 Footer -->
    <div style="margin-top:36px;padding-top:14px;border-top:1px solid ${DOC_C.border};display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:10px;color:${DOC_C.mutedSoft};">Sales Order# ${escHtml(so.soNumber)}</div>
      <div style="font-size:10px;color:${DOC_C.mutedSoft};">Page 2 of 2</div>
      <div style="font-size:10px;color:${DOC_C.mutedSoft};">Powered by <span style="font-weight:700;color:${DOC_C.fg};">Pioneer ERP</span></div>
    </div>

  </div>
</body>
</html>`;
}

/* ── Sub-renderers (HTML strings) ── */

function metaRow(l1: string, v1: string, l2: string, v2: string): string {
  const cell = (label: string, val: string) => label
    ? `<div style="display:flex;gap:10px;align-items:baseline;">
         <span style="color:${DOC_C.muted};min-width:140px;">${escHtml(label)}</span>
         <span style="font-weight:700;color:${DOC_C.fg};">${escHtml(val)}</span>
       </div>`
    : `<div></div>`;
  return cell(l1, v1) + cell(l2, v2);
}

function tableHeader(): string {
  const cols = [
    { label: "#",            w: "30px",  align: "center" },
    { label: "Item Details", w: "auto",  align: "left"   },
    { label: "Qty",          w: "44px",  align: "center" },
    { label: "Unit",         w: "60px",  align: "center" },
    { label: "Unit Price",   w: "90px",  align: "right"  },
    { label: "Ship Method",  w: "92px",  align: "center" },
    { label: "Subtotal",     w: "100px", align: "right"  },
    { label: "Ship by",      w: "78px",  align: "right"  },
  ];
  return cols.map(c =>
    `<th style="padding:10px 6px;font-size:10px;font-weight:700;color:${DOC_C.muted};text-transform:uppercase;letter-spacing:0.05em;width:${c.w};text-align:${c.align};">${c.label}</th>`
  ).join("");
}

function itemRowHTML(li: SOLine, idx: number, currency: string): string {
  const fmtCurrency = (n: number) => fmtDocCurrency(n, currency);
  const lineTotal = li.orderedQty * li.unitPrice;
  const ship = getLineShipment(li, idx);
  const comments = getLineComments(li);
  const pricingRules = getLinePricingRules(li.itemCode);
  const hasDiscount = pricingRules.some(r => r.type === "discount");
  const sc = shipStatusColors(ship.status);

  return `
  <tr style="vertical-align:top;">
    <td style="padding:14px 6px;color:${DOC_C.muted};font-size:11px;font-weight:600;text-align:center;">${String(idx + 1).padStart(2, "0")}</td>
    <td style="padding:14px 6px;">
      <div style="display:flex;gap:10px;align-items:flex-start;">
        <div style="width:48px;height:48px;border-radius:6px;background:${DOC_C.panelBgSoft};border:1px solid ${DOC_C.border};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <span style="font-size:20px;">📦</span>
        </div>
        <div style="min-width:0;flex:1;">
          <div style="font-size:13px;font-weight:700;color:${DOC_C.fg};margin-bottom:2px;">${escHtml(li.itemCode)}</div>
          <div style="font-size:11px;color:${DOC_C.muted};line-height:1.4;">${escHtml(li.itemName)}</div>
        </div>
      </div>
    </td>
    <td style="padding:14px 6px;font-size:12px;text-align:center;font-weight:600;">${li.orderedQty}</td>
    <td style="padding:14px 6px;font-size:11px;text-align:center;color:${DOC_C.muted};">Each</td>
    <td style="padding:14px 6px;font-size:12px;text-align:right;">
      ${hasDiscount
        ? `<span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700;background:${DOC_C.greenBg};color:${DOC_C.greenFg};margin-bottom:3px;">5% off</span><br/>
           <span style="text-decoration:line-through;color:${DOC_C.muted};font-size:11px;">${fmtCurrency(li.unitPrice)}</span><br/>
           <span style="font-weight:700;">${fmtCurrency(li.unitPrice * 0.95)}</span>`
        : `<span style="font-weight:600;">${fmtCurrency(li.unitPrice)}</span>`}
    </td>
    <td style="padding:14px 6px;font-size:11px;text-align:center;color:${DOC_C.fg};font-weight:500;">${escHtml(ship.shipMethod)}</td>
    <td style="padding:14px 6px;font-size:12px;font-weight:700;text-align:right;">${fmtCurrency(lineTotal)}</td>
    <td style="padding:14px 6px;font-size:11px;text-align:right;color:${DOC_C.fg};font-weight:500;white-space:nowrap;">${escHtml(ship.shipBy)}</td>
  </tr>
  <tr>
    <td></td>
    <td colspan="7" style="padding:0 6px 14px 6px;border-bottom:1px solid ${DOC_C.border};">
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:${DOC_C.panelBgSoft};border-radius:6px;padding:6px 10px;font-size:10px;">
        <span style="display:inline-block;padding:3px 8px;border-radius:4px;font-size:9px;font-weight:700;letter-spacing:0.06em;background:${sc.bg};color:${sc.fg};">${ship.status}</span>
        <span style="color:${DOC_C.muted};">Carrier: <strong style="color:${DOC_C.fg};">${escHtml(ship.carrier)}</strong></span>
        <span style="color:${DOC_C.muted};">Tracking #: <strong style="color:${ship.tracking === "Awaiting BOL" ? DOC_C.muted : DOC_C.primary};">${escHtml(ship.tracking)}</strong></span>
        <span style="margin-left:auto;font-weight:700;color:${DOC_C.fg};">${escHtml(ship.etaLabel)}</span>
      </div>
      ${comments ? `
      <div style="margin-top:6px;font-size:11px;color:${DOC_C.muted};line-height:1.5;">
        <strong style="color:${DOC_C.fg};">Comments:</strong> ${escHtml(comments)}
      </div>` : ""}
      <!-- Line-item `[N]` reference markers removed. References are
           now a plain URL list from the External Links textarea, shown
           at the bottom of the doc. -->

    </td>
  </tr>`;
}
