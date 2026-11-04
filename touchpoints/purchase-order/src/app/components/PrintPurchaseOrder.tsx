/* ═══════════════════════════════════════════════════════════════
   Print Purchase Order — generates a print-ready PO document
   Opens in a hidden iframe, triggers the native print dialog. All
   styling is inline so the document is self-contained.
   Typography: Inter only (via Google Fonts import).
   Currency rule: amounts are always shown with a currency symbol,
   and — when the user opts in via PrintOptions — both the vendor
   and base-currency equivalents are surfaced in headers, line
   items, and the footer.
   ═══════════════════════════════════════════════════════════════ */

import type { PurchaseOrderData, POVersionEntry } from "./poStore";
import { getShipmentMethodLabel, getPOVendorCurrency, getPOSettlementCurrency } from "./poStore";
import { getPrintStatusBadgeStyle } from "./statusColors";
import {
  BASE_CURRENCY,
  activeRateSnapshot,
  convertBetween,
  getLibraryCurrency,
  rateTypeLabel,
} from "@/app/data/currencyLibrary";
import type { PrintOptions } from "./PrintOptionsDialog";
import { DEFAULT_PRINT_OPTIONS } from "./PrintOptionsDialog";

/* ── Color tokens (mirrored from theme.css for inline use) ── */
const C = {
  bg: "#ffffff",
  fg: "#000000",
  muted: "#71717a",
  border: "#eaebf0",
  primary: "#0a77ff",
  accent: "#27b973",
  destructive: "#ff453a",
  secondary: "#f7f7f8",
  cardBg: "#ffffff",
};

/* ── Helpers ── */
function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

function fmtNow(): string {
  return new Date().toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function symbolFor(code: string): string {
  const cur = getLibraryCurrency(code);
  return cur?.symbol ?? code;
}

function fmtAmount(value: number, code: string): string {
  const zeroDecimals = new Set(["JPY", "KRW", "VND", "IDR", "HUF", "ISK", "CLP"]);
  const threeDecimals = new Set(["KWD", "BHD", "OMR", "JOD", "TND"]);
  const upper = code.toUpperCase();
  const decimals = zeroDecimals.has(upper) ? 0 : threeDecimals.has(upper) ? 3 : 2;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Render a single amount with its currency symbol, optionally with the
 *  partner / base equivalent appended in muted text underneath. */
function fmtMoney(valueBasePKR: number, opts: {
  primary: "vendor" | "base";
  vendorCurrency: string;
  showConversion: boolean;
}): string {
  const v = valueBasePKR;
  const baseSym = symbolFor(BASE_CURRENCY);
  const vendor = opts.vendorCurrency.toUpperCase();
  const sameAsBase = vendor === BASE_CURRENCY;
  const partnerValue = sameAsBase ? v : convertBetween(v, BASE_CURRENCY, vendor);
  const partnerSym = symbolFor(vendor);
  const primaryLabel = opts.primary === "vendor"
    ? `${partnerSym} ${fmtAmount(partnerValue, vendor)}`
    : `${baseSym} ${fmtAmount(v, BASE_CURRENCY)}`;
  if (sameAsBase || !opts.showConversion) return primaryLabel;
  const secondary = opts.primary === "vendor"
    ? `${baseSym} ${fmtAmount(v, BASE_CURRENCY)} ${BASE_CURRENCY}`
    : `${partnerSym} ${fmtAmount(partnerValue, vendor)} ${vendor}`;
  return `${primaryLabel}<span style="display:block;font-size:10px;color:${C.muted};margin-top:1px;">≈ ${secondary}</span>`;
}

/* ── Main export: print via hidden iframe (no popup needed) ── */
export function printPurchaseOrder(
  po: PurchaseOrderData,
  options?: { version?: POVersionEntry; printOptions?: PrintOptions },
): void {
  const printOptions = options?.printOptions ?? DEFAULT_PRINT_OPTIONS;
  const html = generatePrintHTML(po, options?.version, printOptions);

  // Remove any previous print iframe
  const existingFrame = document.getElementById("__po-print-frame__");
  if (existingFrame) existingFrame.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "__po-print-frame__";
  iframe.style.position = "fixed";
  iframe.style.top = "-10000px";
  iframe.style.left = "-10000px";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    alert("Could not prepare print document.");
    iframe.remove();
    return;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // Wait for fonts/content to load, then trigger print
  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        // Fallback: copy to current window
        window.print();
      }
      // Clean up after printing
      setTimeout(() => iframe.remove(), 1000);
    }, 500);
  };
}

/* ═══════════════════════════════════════════════════════════════
   HTML GENERATOR — full standalone document
   ═══════════════════════════════════════════════════════════════ */

function generatePrintHTML(
  po: PurchaseOrderData,
  selectedVersion: POVersionEntry | undefined,
  printOptions: PrintOptions,
): string {
  const sourceLineItems = selectedVersion
    ? selectedVersion.snapshot.lineItems.map((li) => {
        const source = po.lineItems.find((x) => x.itemNumber === li.itemNumber);
        return {
          ...source,
          id: li.id,
          itemNumber: li.itemNumber,
          descriptiveName: li.descriptiveName,
          quantity: li.quantity,
          vendorQty: li.vendorQty,
          vendorUOM: li.vendorUOM,
          unitPrice: li.unitPrice,
          discount: li.discount,
          lineTotal: li.lineTotal,
          dueDeliveryDate: li.dueDeliveryDate,
          inboundLocation: li.inboundLocation,
          shipmentMethod: source?.shipmentMethod || "fedex-ground",
          defaultUOM: source?.defaultUOM || "Unit",
          description: source?.description,
          receivedQuantity: source?.receivedQuantity || 0,
          originalCurrency: source?.originalCurrency,
          originalPrice: source?.originalPrice,
          lockedRate: source?.lockedRate,
          lockedAt: source?.lockedAt,
        };
      })
    : po.lineItems;

  const display = selectedVersion
    ? {
        ...po,
        status: selectedVersion.snapshot.status,
        deliveryDate: selectedVersion.snapshot.deliveryDate,
        notes: selectedVersion.snapshot.notes,
        payment: selectedVersion.snapshot.payment,
        subtotal: selectedVersion.snapshot.subtotal,
        discountTotal: selectedVersion.snapshot.discountTotal,
        shippingFee: selectedVersion.snapshot.shippingFee,
        total: selectedVersion.snapshot.total,
        lineItems: sourceLineItems,
      }
    : po;

  const statusLabel = display.status;
  const versionLabel = selectedVersion
    ? `Version ${selectedVersion.version} of ${po.versions.length}`
    : `Version ${po.currentVersion} of ${po.versions.length}`;

  const vendorCurrency = (selectedVersion?.snapshot.vendorAmountCurrency ?? getPOVendorCurrency(po)).toUpperCase();
  const settlementCurrency = (selectedVersion?.snapshot.settlementCurrency ?? getPOSettlementCurrency(po)).toUpperCase();
  const baseSym = symbolFor(BASE_CURRENCY);
  const vendorSym = symbolFor(vendorCurrency);
  const settleSym = symbolFor(settlementCurrency);
  const isBase = vendorCurrency === BASE_CURRENCY;
  // Print is single-currency: either base or vendor. (PKR-only POs always use base.)
  const primaryColumn: "vendor" | "base" = !isBase && printOptions.currencyMode === "vendor"
    ? "vendor"
    : "base";

  const rateSnap = selectedVersion?.rateSnapshot;
  const activeSnap = activeRateSnapshot();
  const rateType = rateSnap?.rateType ?? activeSnap.type;
  const rateLabel = rateType === "market" ? "Mid-market" : "Corporate";
  const fullRateLabel = rateTypeLabel(rateType);
  const lockedRate = rateSnap?.lockedRate
    ?? (isBase ? 1 : convertBetween(1, vendorCurrency, BASE_CURRENCY));
  const lockedAt = rateSnap?.lockedAt ?? po.sentDate ?? po.orderDate;
  const lockedAtLabel = fmtDateTime(lockedAt);
  const rateSource = rateType === "market" ? activeSnap.source : "Corporate Treasury";

  /* Get vendor-facing notes for line items */
  const getVendorNotesForItem = (lineItemId: string) =>
    (display.poNotes || []).filter(n => n.type === "vendor" && n.lineItemId === lineItemId);

  const lineRows = display.lineItems
    .map(
      (li, idx) => {
        const itemVendorNotes = getVendorNotesForItem(li.id);
        const notesHtml = itemVendorNotes.length > 0
          ? `<tr><td colspan="${baseRowSpan(printOptions, isBase)}" style="padding:0 8px 8px 40px;">
              ${itemVendorNotes.map(n => `<div style="font-size:10px;color:#52525b;line-height:1.5;padding:4px 8px;background:#f7f7f8;border-radius:4px;margin-top:4px;border-left:2px solid ${C.primary};">
                <span style="font-weight:500;color:${C.fg};">${esc(n.author)}:</span> ${esc(n.text)}
              </div>`).join("")}
            </td></tr>`
          : "";

        const unitPriceHtml = fmtMoney(li.unitPrice, {
          primary: primaryColumn,
          vendorCurrency,
          showConversion: printOptions.showConversion,
        });
        const lineTotalHtml = fmtMoney(li.lineTotal, {
          primary: primaryColumn,
          vendorCurrency,
          showConversion: printOptions.showConversion,
        });

        return `
    <tr style="border-bottom:1px solid ${C.border};">
      <td style="padding:10px 8px;color:${C.muted};font-size:12px;text-align:center;vertical-align:top;">${idx + 1}</td>
      <td style="padding:10px 8px;vertical-align:top;">
        <div style="font-size:13px;font-weight:600;color:${C.fg};">${esc(li.itemNumber)}</div>
        <div style="font-size:11px;color:${C.muted};margin-top:2px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(li.descriptiveName)}</div>
        ${li.description ? `<div style="font-size:10px;color:#a1a1aa;margin-top:2px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(li.description)}</div>` : ""}
      </td>
      <td style="padding:10px 8px;font-size:12px;text-align:center;vertical-align:top;">
        <div>${li.vendorQty} ${esc(li.vendorUOM)}${li.vendorQty > 1 ? "s" : ""}</div>
        ${li.vendorUOMQty > 1 ? `<div style="color:${C.muted};font-size:10px;margin-top:1px;">(${li.quantity} ${esc(li.defaultUOM)}${li.quantity > 1 ? "s" : ""})</div>` : ""}
      </td>
      <td style="padding:10px 8px;font-size:12px;text-align:right;vertical-align:top;">${unitPriceHtml}<span style="color:${C.muted};font-size:10px;">/${esc(li.defaultUOM)}</span></td>
      <td style="padding:10px 8px;font-size:12px;text-align:center;vertical-align:top;color:${li.discount > 0 ? C.accent : C.muted};">${li.discount > 0 ? li.discount + "%" : "—"}</td>
      <td style="padding:10px 8px;font-size:13px;font-weight:600;text-align:right;vertical-align:top;">${lineTotalHtml}</td>
    </tr>${notesHtml}`;
      }
    )
    .join("");

  /* Shipping details per line item */
  const shippingRows = display.lineItems
    .map(
      (li) => `
    <tr style="border-bottom:1px solid ${C.border};">
      <td style="padding:7px 8px;font-size:12px;font-weight:500;">${esc(li.itemNumber)}</td>
      <td style="padding:7px 8px;font-size:11px;">${fmtDate(li.dueDeliveryDate)}</td>
      <td style="padding:7px 8px;font-size:11px;">${esc(getShipmentMethodLabel(li.shipmentMethod))}</td>
      <td style="padding:7px 8px;font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(li.inboundLocation)}</td>
    </tr>`
    )
    .join("");

  /* Receiving progress (only if any receiving has happened) */
  const hasReceiving = display.lineItems.some((li) => li.receivedQuantity > 0);
  const receivingSection = hasReceiving
    ? `
    <div style="margin-top:28px;">
      <div style="font-size:14px;font-weight:600;color:${C.fg};margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid ${C.primary};">Receiving Status</div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:${C.secondary};border-bottom:2px solid ${C.border};">
            <th style="padding:8px;font-size:11px;font-weight:600;text-align:left;color:${C.muted};text-transform:uppercase;letter-spacing:0.05em;">Item</th>
            <th style="padding:8px;font-size:11px;font-weight:600;text-align:center;color:${C.muted};text-transform:uppercase;letter-spacing:0.05em;">Ordered</th>
            <th style="padding:8px;font-size:11px;font-weight:600;text-align:center;color:${C.muted};text-transform:uppercase;letter-spacing:0.05em;">Received</th>
            <th style="padding:8px;font-size:11px;font-weight:600;text-align:center;color:${C.muted};text-transform:uppercase;letter-spacing:0.05em;">Remaining</th>
            <th style="padding:8px;font-size:11px;font-weight:600;text-align:center;color:${C.muted};text-transform:uppercase;letter-spacing:0.05em;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${display.lineItems
            .map((li) => {
              const remaining = li.quantity - li.receivedQuantity;
              const isFull = remaining <= 0;
              return `
              <tr style="border-bottom:1px solid ${C.border};">
                <td style="padding:7px 8px;font-size:12px;font-weight:500;">${esc(li.itemNumber)}</td>
                <td style="padding:7px 8px;font-size:12px;text-align:center;">${li.quantity}</td>
                <td style="padding:7px 8px;font-size:12px;text-align:center;color:${isFull ? C.accent : C.primary};font-weight:500;">${li.receivedQuantity}</td>
                <td style="padding:7px 8px;font-size:12px;text-align:center;">${remaining > 0 ? remaining : "—"}</td>
                <td style="padding:7px 8px;font-size:11px;text-align:center;font-weight:500;color:${isFull ? C.accent : C.muted};">${isFull ? "Complete" : li.receivedQuantity > 0 ? "Partial" : "Pending"}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>`
    : "";

  const headerRateBlock = printOptions.includeRateInfo && !isBase
    ? `<div style="margin-top:6px;font-size:10.5px;color:${C.muted};">
        <span style="font-weight:600;color:${C.fg};">${rateLabel}</span>
        · 1 ${vendorCurrency} = ${baseSym} ${fmtAmount(lockedRate, BASE_CURRENCY)} ${BASE_CURRENCY}
        · locked on ${esc(lockedAtLabel)}
      </div>`
    : "";

  const dualTotalRow = !isBase
    ? `<div style="font-size:11px;color:${C.muted};margin-top:2px;">
        ${vendorSym} ${fmtAmount(convertBetween(display.total, BASE_CURRENCY, vendorCurrency), vendorCurrency)} ${vendorCurrency}
        ${settlementCurrency !== vendorCurrency
          ? ` · ${settleSym} ${fmtAmount(convertBetween(display.total, BASE_CURRENCY, settlementCurrency), settlementCurrency)} ${settlementCurrency}`
          : ""}
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PO ${esc(display.poNumber)} — ${esc(display.vendor.name)} · ${esc(versionLabel)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { font-family:'Inter',sans-serif; font-size:14px; color:${C.fg}; background:${C.bg}; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    @page { margin:16mm 14mm; size:A4; }
    @media print {
      body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .no-print { display:none !important; }
      .page-break { page-break-before:always; }
    }
  </style>
</head>
<body>
  <!-- Print Action Bar (hidden on print) -->
  <div class="no-print" style="position:sticky;top:0;z-index:100;background:${C.secondary};border-bottom:1px solid ${C.border};padding:12px 32px;display:flex;align-items:center;justify-content:space-between;">
    <div style="display:flex;align-items:center;gap:12px;">
      <div style="width:32px;height:32px;border-radius:8px;background:${C.primary};display:flex;align-items:center;justify-content:center;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      </div>
      <div>
        <div style="font-size:14px;font-weight:600;">Print Preview — PO ${esc(display.poNumber)}</div>
        <div style="font-size:11px;color:${C.muted};">${esc(display.vendor.name)} &middot; ${display.lineItems.length} line item${display.lineItems.length !== 1 ? "s" : ""} &middot; ${esc(versionLabel)}</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;">
      <button onclick="window.close()" style="font-family:'Inter',sans-serif;font-size:12px;font-weight:500;padding:6px 16px;border:1px solid ${C.border};border-radius:8px;background:white;cursor:pointer;color:${C.fg};">Close</button>
      <button onclick="window.print()" style="font-family:'Inter',sans-serif;font-size:12px;font-weight:500;padding:6px 20px;border:none;border-radius:8px;background:${C.primary};color:white;cursor:pointer;">Print Document</button>
    </div>
  </div>

  <!-- Document Container -->
  <div style="max-width:800px;margin:0 auto;padding:32px;">

    <!-- ═══ HEADER ═══ -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
      <div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
          <div style="width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,${C.primary},#2563eb);display:flex;align-items:center;justify-content:center;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </div>
          <div>
            <div style="font-size:11px;color:${C.muted};text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">Omne Manufacturing Corp.</div>
            <div style="font-size:9px;color:#a1a1aa;margin-top:1px;">1200 Industrial Blvd, Suite 400 · Detroit, MI 48201</div>
          </div>
        </div>
        <div style="font-size:24px;font-weight:700;color:${C.fg};letter-spacing:-0.02em;margin-top:8px;">PURCHASE ORDER</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:22px;font-weight:700;color:${C.primary};">PO ${esc(display.poNumber)}</div>
        <div style="font-size:11px;color:${C.muted};margin-top:2px;">${esc(versionLabel)}</div>
        <div style="display:inline-block;margin-top:6px;padding:3px 12px;border-radius:6px;font-size:11px;font-weight:600;background:${statusBg(display.status)};color:${statusFg(display.status)};border:1px solid ${statusBorder(display.status)};">${esc(statusLabel)}</div>
        <div style="margin-top:6px;font-size:13px;font-weight:600;color:${C.fg};">
          ${baseSym} ${fmtAmount(display.total, BASE_CURRENCY)} ${BASE_CURRENCY}
        </div>
        ${dualTotalRow}
        ${headerRateBlock}
      </div>
    </div>

    <!-- Divider -->
    <div style="height:2px;background:linear-gradient(to right,${C.primary},${C.accent});border-radius:2px;margin-bottom:20px;"></div>

    <!-- ═══ KEY DATES ROW ═══ -->
    <div style="display:flex;gap:0;margin-bottom:24px;border:1px solid ${C.border};border-radius:10px;overflow:hidden;">
      ${datePill("Order Date", fmtDate(display.orderDate))}
      ${datePill("Expected Delivery", fmtDate(display.deliveryDate))}
      ${datePill("Confirmation", display.confirmationDate ? fmtDate(display.confirmationDate) : "Pending")}
      ${datePill("Created By", display.createdBy, true)}
    </div>

    <!-- ═══ VENDOR + CONTACT CARDS ═══ -->
    <div style="display:flex;gap:16px;margin-bottom:24px;">
      <!-- Vendor -->
      <div style="flex:1;border:1px solid ${C.border};border-radius:10px;padding:16px;">
        <div style="font-size:10px;font-weight:600;color:${C.muted};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Vendor</div>
        <div style="font-size:15px;font-weight:600;color:${C.fg};margin-bottom:6px;">${esc(display.vendor.name)}</div>
        <div style="font-size:11px;color:${C.muted};line-height:1.6;">
          ${esc(display.vendor.address)}<br/>
          ${esc(display.vendor.phone)}<br/>
          ${esc(display.vendor.email)}<br/>
          <span style="color:#a1a1aa;">Tax ID: ${esc(display.vendor.taxId)}</span>
        </div>
      </div>

      <!-- Ship To / Contact -->
      <div style="flex:1;border:1px solid ${C.border};border-radius:10px;padding:16px;">
        <div style="font-size:10px;font-weight:600;color:${C.muted};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Vendor Contact</div>
        <div style="font-size:15px;font-weight:600;color:${C.fg};margin-bottom:2px;">${esc(display.recipient.name)}</div>
        <div style="font-size:11px;color:${C.primary};margin-bottom:6px;">${esc(display.recipient.role)}</div>
        <div style="font-size:11px;color:${C.muted};line-height:1.6;">
          ${esc(display.recipient.email)}<br/>
          ${esc(display.recipient.phone)}
        </div>
      </div>
    </div>

    <!-- ═══ LINE ITEMS TABLE ═══ -->
    <div style="margin-bottom:24px;">
      <div style="font-size:14px;font-weight:600;color:${C.fg};margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid ${C.primary};">Line Items (${display.lineItems.length})</div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:${C.secondary};border-bottom:2px solid ${C.border};">
            <th style="padding:8px;font-size:11px;font-weight:600;text-align:center;color:${C.muted};text-transform:uppercase;letter-spacing:0.05em;width:36px;">#</th>
            <th style="padding:8px;font-size:11px;font-weight:600;text-align:left;color:${C.muted};text-transform:uppercase;letter-spacing:0.05em;">Item</th>
            <th style="padding:8px;font-size:11px;font-weight:600;text-align:center;color:${C.muted};text-transform:uppercase;letter-spacing:0.05em;">Qty</th>
            <th style="padding:8px;font-size:11px;font-weight:600;text-align:right;color:${C.muted};text-transform:uppercase;letter-spacing:0.05em;">Unit ${primaryColumn === "vendor" ? `(${vendorCurrency})` : `(${BASE_CURRENCY})`}</th>
            <th style="padding:8px;font-size:11px;font-weight:600;text-align:center;color:${C.muted};text-transform:uppercase;letter-spacing:0.05em;">Disc.</th>
            <th style="padding:8px;font-size:11px;font-weight:600;text-align:right;color:${C.muted};text-transform:uppercase;letter-spacing:0.05em;">Total ${primaryColumn === "vendor" ? `(${vendorCurrency})` : `(${BASE_CURRENCY})`}</th>
          </tr>
        </thead>
        <tbody>
          ${lineRows}
        </tbody>
      </table>
    </div>

    <!-- ═══ SHIPPING DETAILS TABLE ═══ -->
    <div style="margin-bottom:24px;">
      <div style="font-size:14px;font-weight:600;color:${C.fg};margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid ${C.primary};">Shipping Details</div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:${C.secondary};border-bottom:2px solid ${C.border};">
            <th style="padding:8px;font-size:11px;font-weight:600;text-align:left;color:${C.muted};text-transform:uppercase;letter-spacing:0.05em;">Item</th>
            <th style="padding:8px;font-size:11px;font-weight:600;text-align:left;color:${C.muted};text-transform:uppercase;letter-spacing:0.05em;">Due Delivery</th>
            <th style="padding:8px;font-size:11px;font-weight:600;text-align:left;color:${C.muted};text-transform:uppercase;letter-spacing:0.05em;">Method</th>
            <th style="padding:8px;font-size:11px;font-weight:600;text-align:left;color:${C.muted};text-transform:uppercase;letter-spacing:0.05em;">Inbound Location</th>
          </tr>
        </thead>
        <tbody>
          ${shippingRows}
        </tbody>
      </table>
    </div>

    <!-- ═══ RECEIVING STATUS (conditional) ═══ -->
    ${receivingSection}

    <!-- ═══ ORDER SUMMARY + PAYMENT (side by side) ═══ -->
    <div style="display:flex;gap:16px;margin-top:28px;margin-bottom:24px;">
      <!-- Payment & Delivery -->
      <div style="flex:1;border:1px solid ${C.border};border-radius:10px;padding:16px;">
        <div style="font-size:10px;font-weight:600;color:${C.muted};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Payment &amp; Delivery</div>
        ${paymentRow("Payment Terms", display.payment.paymentTerms)}
        ${paymentRow("Pay To", display.payment.payTo)}
        ${paymentRow("Payment Method", display.payment.paymentMethod)}
        <div style="height:1px;background:${C.border};margin:8px 0;"></div>
        ${paymentRow("Ship To", display.payment.shippedTo)}
        ${paymentRow("Funded By", display.payment.fundedBy)}
      </div>

      <!-- Order Summary — rendered in the user's chosen currency (Print in: ...) -->
      ${(() => {
        // Pick primary currency once and render every summary row through it.
        const useVendor = primaryColumn === "vendor" && !isBase;
        const code = useVendor ? vendorCurrency : BASE_CURRENCY;
        const sym = useVendor ? vendorSym : baseSym;
        const toPrimary = (pkr: number) => useVendor ? convertBetween(pkr, BASE_CURRENCY, vendorCurrency) : pkr;
        const moneyLabel = (pkr: number) => `${sym} ${fmtAmount(toPrimary(pkr), code)} ${code}`;
        const negLabel = (pkr: number) => `-${sym} ${fmtAmount(toPrimary(pkr), code)} ${code}`;
        // Optional secondary line: when printing in vendor currency, surface
        // the base equivalent below the grand total (and vice versa) so the
        // document still answers "what's this in PKR" at a glance.
        const otherCode = useVendor ? BASE_CURRENCY : vendorCurrency;
        const otherSym = useVendor ? baseSym : vendorSym;
        const otherValue = useVendor
          ? display.total
          : (isBase ? display.total : convertBetween(display.total, BASE_CURRENCY, vendorCurrency));
        const showSecondary = !isBase && printOptions.showConversion;
        return `
      <div style="flex:1;border:1px solid ${C.border};border-radius:10px;padding:16px;background:${C.secondary};">
        <div style="font-size:10px;font-weight:600;color:${C.muted};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Order Summary</div>
        ${summaryRow("Subtotal", moneyLabel(display.subtotal))}
        ${summaryRow("Shipping & Handling", moneyLabel(display.shippingFee))}
        ${display.discountTotal > 0 ? summaryRow("Discount", negLabel(display.discountTotal), C.accent) : ""}
        <div style="height:2px;background:${C.border};margin:10px 0;"></div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;">
          <span style="font-size:14px;font-weight:600;color:${C.fg};">Grand Total</span>
          <span style="font-size:20px;font-weight:700;color:${C.fg};">${moneyLabel(display.total)}</span>
        </div>
        ${showSecondary ? `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:6px;">
          <span style="font-size:11px;color:${C.muted};">In ${otherCode}</span>
          <span style="font-size:13px;font-weight:600;color:${C.muted};">${otherSym} ${fmtAmount(otherValue, otherCode)} ${otherCode}</span>
        </div>` : ""}
        ${!isBase && settlementCurrency !== vendorCurrency ? `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:4px;">
          <span style="font-size:11px;color:${C.muted};">In ${settlementCurrency} (settlement)</span>
          <span style="font-size:13px;font-weight:600;color:${C.muted};">${settleSym} ${fmtAmount(convertBetween(display.total, BASE_CURRENCY, settlementCurrency), settlementCurrency)} ${settlementCurrency}</span>
        </div>` : ""}
        ${!isBase && printOptions.includeRateInfo ? `<div style="margin-top:10px;padding-top:10px;border-top:1px dashed ${C.border};font-size:10.5px;color:${C.muted};line-height:1.5;">
          <div><span style="font-weight:600;color:${C.fg};">${rateLabel}</span> · 1 ${vendorCurrency} = ${baseSym} ${fmtAmount(lockedRate, BASE_CURRENCY)} ${BASE_CURRENCY}</div>
          <div>Source: ${esc(rateSource)} · Locked on ${esc(lockedAtLabel)}</div>
        </div>` : ""}
      </div>`;
      })()}
    </div>

    <!-- ═══ NOTES (Vendor-Facing Only) ═══ -->
    ${(() => {
      const poLevelVendorNotes = (display.poNotes || []).filter(n => n.type === "vendor" && !n.lineItemId);
      const hasLegacyNotes = !!display.notes;
      const hasVendorNotes = poLevelVendorNotes.length > 0;
      if (!hasLegacyNotes && !hasVendorNotes) return "";
      return `
    <div style="border:1px solid ${C.border};border-radius:10px;padding:16px;margin-bottom:24px;">
      <div style="font-size:10px;font-weight:600;color:${C.muted};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Notes to Vendor</div>
      ${hasLegacyNotes ? `<div style="font-size:12px;color:#52525b;line-height:1.6;margin-bottom:${hasVendorNotes ? "10px" : "0"};">${esc(display.notes)}</div>` : ""}
      ${poLevelVendorNotes.map(n => `
        <div style="font-size:11px;color:#52525b;line-height:1.5;padding:6px 10px;background:#f7f7f8;border-radius:6px;margin-top:6px;border-left:3px solid ${C.primary};">
          <div style="font-size:10px;font-weight:500;color:${C.muted};margin-bottom:2px;">${esc(n.author)} · ${esc(n.timestamp)}</div>
          <div>${esc(n.text)}</div>
        </div>
      `).join("")}
    </div>`;
    })()}

    <!-- ═══ FOOTER ═══ -->
    <div style="border-top:1px solid ${C.border};padding-top:16px;display:flex;justify-content:space-between;align-items:flex-start;">
      <div style="max-width:60%;">
        <div style="font-size:10px;color:${C.muted};">This document is a computer-generated Purchase Order from Omne ERP.</div>
        <div style="font-size:10px;color:#a1a1aa;margin-top:2px;">Printed on ${esc(fmtNow())}</div>
        ${!isBase && printOptions.includeRateInfo ? `<div style="font-size:10px;color:${C.muted};margin-top:6px;">
          <span style="font-weight:600;color:${C.fg};">${fullRateLabel}</span> · Source: ${esc(rateSource)} · Locked on ${esc(lockedAtLabel)}
        </div>` : ""}
        ${!isBase ? `<div style="font-size:10px;color:#a1a1aa;margin-top:4px;font-style:italic;">Amounts reflect the exchange rate locked at PO creation.</div>` : ""}
      </div>
      <div style="text-align:right;">
        <div style="font-size:10px;color:${C.muted};">PO ${esc(display.poNumber)} · ${esc(versionLabel)}</div>
        <div style="font-size:10px;color:#a1a1aa;">Page 1 of 1</div>
      </div>
    </div>

    <!-- ═══ SIGNATURE BLOCK ═══ -->
    <div style="display:flex;gap:48px;margin-top:40px;padding-top:16px;">
      <div style="flex:1;">
        <div style="border-bottom:1px solid ${C.fg};height:40px;"></div>
        <div style="font-size:10px;color:${C.muted};margin-top:4px;">Authorized Signature (Buyer)</div>
        <div style="font-size:10px;color:#a1a1aa;margin-top:1px;">Date: _______________</div>
      </div>
      <div style="flex:1;">
        <div style="border-bottom:1px solid ${C.fg};height:40px;"></div>
        <div style="font-size:10px;color:${C.muted};margin-top:4px;">Acknowledged by Vendor</div>
        <div style="font-size:10px;color:#a1a1aa;margin-top:1px;">Date: _______________</div>
      </div>
    </div>

  </div>
</body>
</html>`;
}

/* Number of `<td>`s a notes row needs to span. Always six now that the
 * print document renders a single currency column (# | Item | Qty | Unit |
 * Disc | Total). */
function baseRowSpan(_opts: PrintOptions, _isBase: boolean): number {
  return 6;
}

/* ── Micro-template helpers ── */

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function datePill(label: string, value: string, isLast = false): string {
  return `
    <div style="flex:1;padding:10px 14px;${!isLast ? `border-right:1px solid ${C.border};` : ""}">
      <div style="font-size:10px;font-weight:500;color:${C.muted};text-transform:uppercase;letter-spacing:0.05em;">${label}</div>
      <div style="font-size:13px;font-weight:600;color:${C.fg};margin-top:2px;">${esc(value)}</div>
    </div>`;
}

function paymentRow(label: string, value: string): string {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;">
      <span style="font-size:11px;color:${C.muted};">${label}</span>
      <span style="font-size:12px;font-weight:500;color:${C.fg};text-align:right;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(value)}</span>
    </div>`;
}

function summaryRow(label: string, value: string, color?: string): string {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;">
      <span style="font-size:12px;color:${color || "#52525b"};">${label}</span>
      <span style="font-size:13px;font-weight:600;color:${color || C.fg};">${value}</span>
    </div>`;
}

function statusBg(status: string): string {
  const s = getPrintStatusBadgeStyle(status);
  return s.bg;
}

function statusFg(status: string): string {
  const s = getPrintStatusBadgeStyle(status);
  return s.text;
}

function statusBorder(status: string): string {
  const s = getPrintStatusBadgeStyle(status);
  return s.border;
}
