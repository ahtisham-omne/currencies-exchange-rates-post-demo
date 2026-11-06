/**
 * PdfDocument — shared, data-driven PDF-lookalike template
 * ═══════════════════════════════════════════════════════════
 * Used by both the Quote module and the Sales Order module for
 * in-app preview AND print/download (via `window.print()` on the
 * root element). Renders as HTML+CSS styled to read like a
 * professional B2B document; the same component is duplicated
 * verbatim into the SO module's `shared/` folder so both listings
 * / detail pages import from a co-located path.
 *
 * Design reference: FR Conversions' production quote PDF (multi-page
 * document with header logo + doc number, meta grid, ship-to / bill-to,
 * long line-item table with options + discounts, subtotal + terms,
 * signed agreement page). Sections are opt-in via `visibility` so
 * callers can render leaner variants for internal preview vs. the
 * customer-facing send-out.
 *
 * The visible chrome is intentionally paper-like:
 *   • 816×1056 px pages (US Letter at ~96dpi) with fixed margins so
 *     the same layout looks identical in preview and print.
 *   • Inter for UI text; system serif is avoided to keep the read
 *     consistent with the rest of the app.
 *   • Every table cell uses tabular-nums where a number is shown so
 *     the columns align without a monospace font.
 */
import React from "react";
import { formatMoney } from "@/app/currency/money";

/* ─── Design tokens (kept local so the template survives theme drift) ─── */
export const PDF_TOKENS = {
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fg: "#0F172A",
  fgSoft: "#1E293B",
  muted: "#64748B",
  mutedSoft: "#94A3B8",
  border: "#E2E8F0",
  borderSoft: "#EEF2F6",
  panelBg: "#F8FAFC",
  panelBgSoft: "#F9FAFB",
  primary: "#1B6EF3",
  primaryBg: "#EFF6FF",
  primaryBorder: "#BFDBFE",
  green: "#16A34A",
  greenBg: "#DCFCE7",
  greenBorder: "#86EFAC",
  destructive: "#DC2626",
  destructiveBg: "#FEF2F2",
  amberBg: "#FEF3C7",
  amberFg: "#92400E",
  amberBorder: "#FDE68A",
} as const;

/* ═══════════════════════════════════════════════
 * DATA CONTRACT
 * ═══════════════════════════════════════════════ */

export type PdfDocKind = "quote" | "so";

export interface PdfAddress {
  /** Line 1 (company name / recipient) shown as the block heading. */
  displayName: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
  email?: string;
}

export interface PdfItemRefLink {
  /** [1], [2], … printed as the marker inside the row + in the References list. */
  index: number;
  label: string;
  url?: string;
}

export interface PdfLinePricingRule {
  /** Human label — e.g. "Fleet Volume Discount". */
  label: string;
  /** "discount" applies as a negative amount; "premium" as positive. */
  kind: "discount" | "premium";
  /** Percent applied to the base line total (before this rule). */
  percent: number;
  /** Computed amount already applied (signed). Supplied by the caller
   *  so the breakdown adds up without re-deriving in the template. */
  amount: number;
}

export interface PdfLineAdjustment {
  /** Free-text label for the one-time adjustment. */
  label: string;
  /** Signed amount — negative for a credit, positive for an add-on fee. */
  amount: number;
}

export interface PdfLineItem {
  id: string;
  /** Item code (e.g. "BP-1001"). Rendered as the row's headline. */
  code: string;
  /** Optional thumbnail — either a real URL or an emoji/character fallback. */
  imageUrl?: string;
  description: string;
  /** Free-text comment shown as a small line beneath the description. */
  comment?: string;
  /** Attachment / reference markers rendered as [1] [2] links below the row. */
  refs?: PdfItemRefLink[];
  quantity: number;
  unitOfMeasure: string;
  unitPrice: number;
  /** Legacy convenience — a single blanket discount pct. When
   *  `pricingRules` is supplied it takes precedence and this is
   *  ignored. */
  discountPercent?: number;
  /** Legacy convenience — a single premium pct. Ignored when
   *  `pricingRules` is supplied. */
  premiumPercent?: number;
  /** Full breakdown of the pricing rules applied to this line. Each
   *  rule renders as its own row in the item card's price block so
   *  the customer sees WHERE the discount came from, not just the
   *  final number. */
  pricingRules?: PdfLinePricingRule[];
  /** One-time premiums / credits / fees applied to this specific
   *  line. Rendered beneath the pricing-rule rows in the breakdown. */
  adjustments?: PdfLineAdjustment[];
  /** Precomputed line total (already reflects rules + adjustments).
   *  Caller supplies this so rounding stays consistent with the
   *  totals block. */
  lineTotal: number;
  /** Carrier / shipping method label (e.g. "FedEx Express"). */
  shipMethod?: string;
  /** Carrier operator name (e.g. "Estes Forwarding (LTL)") — shown
   *  alongside the method when both are known. */
  shipCarrier?: string;
  /** Tracking / BOL identifier. Rendered next to the carrier when
   *  available; when absent, `shipStatus` alone identifies progress. */
  trackingNumber?: string;
  /** Human status pill (e.g. "IN TRANSIT", "DELIVERED"). Rendered as
   *  a small tone-aware badge in the metadata strip. */
  shipStatus?: string;
  /** Pickup / origin warehouse label — shown when relevant to the
   *  line's fulfilment path. */
  shipFrom?: string;
  /** Ship-by date shown in the metadata strip. */
  shipByDate?: string;
}

export interface PdfPricingRule {
  /** Human label — e.g. "Volume Discount 12+ units". */
  label: string;
  /** Signed amount already computed (negative for discount). */
  amount: number;
  /** Optional scope — "Order-level" or a line code — for display. */
  scope?: string;
}

export interface PdfAdjustment {
  label: string;
  amount: number;
  /** "Premium" tag lets callers show a positive adjustment differently
   *  from discounts even when both are surfaced in the same section. */
  kind: "premium" | "discount" | "fee";
  scope?: string;
}

export interface PdfTermsBlock {
  /** Long, section-numbered body copy. Rendered as `<p>` blocks with
   *  the marker embedded ("1. ACCEPTANCE..."). */
  paragraphs: string[];
}

export interface PdfDocumentData {
  kind: PdfDocKind;
  /** Doc number shown centred at the top of every page. */
  docNumber: string;
  /** Optional short label under the number (e.g. "v3 draft"). */
  docSubtitle?: string;
  /** Right-aligned status pill next to the doc number. */
  statusLabel?: string;
  statusTone?: "neutral" | "success" | "warning" | "info";

  /** Brand block on the top-left. Two lines max. */
  brand: {
    name: string;
    tagline?: string;
    /** Optional square logo (any renderable child — usually a `<svg>`
     *  or `<img>`; falls back to a monogram tile when absent). */
    logo?: React.ReactNode;
  };

  /** Meta grid — two columns of {label, value} pairs shown under the
   *  header. Left column typically dates; right column recipient +
   *  effective/valid + sales person. Order preserved. */
  metaLeft: { label: string; value: string }[];
  metaRight: { label: string; value: string }[];

  /** Bottom row of the header — three address panels. */
  customer: PdfAddress;
  shipTo: PdfAddress;
  billTo: PdfAddress;

  /** Line items table. */
  items: PdfLineItem[];
  /** Currency label ("USD", "EUR") used in totals row. */
  currency?: string;
  /** UOM column header — usually "Unit"; some catalogs use "UOM". */
  unitLabel?: string;
  /** Total number of items in the source SO/Quote (for "1 to 4 of 8"). */
  totalItemCount?: number;

  /** Order-level pricing rules (rendered above the totals block). */
  pricingRules?: PdfPricingRule[];
  /** Order-level premiums / one-time adjustments. */
  adjustments?: PdfAdjustment[];

  /** Payment info — rendered under the items table. */
  paymentMethod?: string;
  paymentTerms?: string;

  /** Precomputed totals — caller owns the rounding. */
  subtotal: number;
  discountsTotal?: number;
  premiumsTotal?: number;
  adjustmentsTotal?: number;
  taxTotal?: number;
  freightTotal?: number;
  grandTotal: number;

  /** Numbered notes list rendered before Terms. */
  notes?: string[];
  /** External URL references rendered as a plain list, one URL per
   *  line. No `[N]` markers — sales reps inline a URL in their
   *  descriptions when they want to point at a specific one. */
  references?: string[];
  /** Terms & Conditions body. */
  terms?: PdfTermsBlock;

  /** Signature / agreement block. Shown by default; hide via visibility. */
  signature?: {
    heading: string;
    body: string;
    /** Number of signature slots (typically 1 or 2). */
    slotCount?: number;
  };

  /** Copy for the very bottom "Powered by …" label. */
  poweredBy?: string;
}

export interface PdfVisibility {
  brand?: boolean;
  meta?: boolean;
  addresses?: boolean;
  items?: boolean;
  pricingRules?: boolean;
  adjustments?: boolean;
  payment?: boolean;
  totals?: boolean;
  notes?: boolean;
  references?: boolean;
  terms?: boolean;
  signature?: boolean;
}

const ALL_ON: Required<PdfVisibility> = {
  brand: true, meta: true, addresses: true, items: true,
  pricingRules: true, adjustments: true, payment: true,
  totals: true, notes: true, references: true,
  terms: true, signature: true,
};

/* ═══════════════════════════════════════════════
 * FORMATTERS
 * ═══════════════════════════════════════════════ */

export function fmtCurrency(n: number, currency = "USD"): string {
  /* The same symbols and minor units as the rest of the module ("¥" has none). */
  return formatMoney(n, currency);
}

function statusToneStyles(tone: PdfDocumentData["statusTone"] = "info") {
  switch (tone) {
    case "success": return { bg: PDF_TOKENS.greenBg, fg: "#166534", border: PDF_TOKENS.greenBorder };
    case "warning": return { bg: PDF_TOKENS.amberBg, fg: PDF_TOKENS.amberFg, border: PDF_TOKENS.amberBorder };
    case "neutral": return { bg: PDF_TOKENS.panelBg, fg: PDF_TOKENS.muted, border: PDF_TOKENS.border };
    case "info":
    default: return { bg: PDF_TOKENS.primaryBg, fg: PDF_TOKENS.primary, border: PDF_TOKENS.primaryBorder };
  }
}

function initialsOf(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

/* ═══════════════════════════════════════════════
 * PAGE PRIMITIVES
 * ═══════════════════════════════════════════════ */

/** A single printable page. Sized at 780×1040 px so the layout fits
 *  both US Letter (8.5×11 in ≈ 816×1056) and A4 (8.27×11.69 in ≈ 794×1122)
 *  with a small margin — no forced scaling in either print size. */
function PdfPage({ children, pageNumber, totalPages, docNumber, poweredBy }: {
  children: React.ReactNode;
  pageNumber: number;
  totalPages: number;
  docNumber: string;
  poweredBy?: string;
}) {
  return (
    <div
      data-pdf-page
      style={{
        width: 780,
        minHeight: 1040,
        padding: "40px 44px",
        boxSizing: "border-box",
        background: "#FFFFFF",
        color: PDF_TOKENS.fg,
        fontFamily: PDF_TOKENS.font,
        fontSize: 12,
        lineHeight: 1.45,
        margin: "0 auto",
        boxShadow: "0 4px 12px rgba(15, 23, 42, 0.08)",
        borderRadius: 4,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        pageBreakAfter: "always",
      }}
    >
      <div style={{ flex: 1 }}>{children}</div>
      <div
        style={{
          marginTop: 24,
          paddingTop: 12,
          borderTop: `1px solid ${PDF_TOKENS.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 10,
          color: PDF_TOKENS.mutedSoft,
        }}
      >
        <span>Doc# {docNumber}</span>
        <span>Page {pageNumber} of {totalPages}</span>
        <span>
          Powered by <strong style={{ color: PDF_TOKENS.fg }}>{poweredBy || "Omne ERP"}</strong>
        </span>
      </div>
    </div>
  );
}

/** Doc header — brand + centered doc number. Right column is a
 *  flex-1 spacer so the title stays visually centered on the page;
 *  the previous status pill has been removed. */
function PdfHeader({ data }: { data: PdfDocumentData }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, paddingBottom: 16, borderBottom: `1px solid ${PDF_TOKENS.borderSoft}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
        <div
          style={{
            width: 40, height: 40, borderRadius: 8,
            background: PDF_TOKENS.primaryBg,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {data.brand.logo ?? (
            <span style={{ fontSize: 15, fontWeight: 800, color: PDF_TOKENS.primary, letterSpacing: 0.5 }}>
              {initialsOf(data.brand.name)}
            </span>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: PDF_TOKENS.fg, lineHeight: 1.2 }}>
            {data.brand.name}
          </div>
          {data.brand.tagline && (
            <div style={{ fontSize: 10.5, color: PDF_TOKENS.muted, marginTop: 2 }}>{data.brand.tagline}</div>
          )}
        </div>
      </div>
      <div style={{ textAlign: "center", flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 20, fontWeight: 700, color: PDF_TOKENS.fg,
            letterSpacing: -0.3, lineHeight: 1.15,
            /* Doc numbers like "Q-000-000-000" have soft-break points
               at each hyphen; forcing nowrap keeps the whole title
               on one row. Font size drops slightly (from 22px) so a
               long "Sales Order SO-000-000-000" still fits. */
            whiteSpace: "nowrap",
          }}
        >
          {data.kind === "quote" ? "Quote" : "Sales Order"}{" "}
          <span style={{ color: PDF_TOKENS.primary }}>{data.docNumber}</span>
        </div>
        {data.docSubtitle && (
          <div style={{ fontSize: 11, color: PDF_TOKENS.muted, marginTop: 2 }}>{data.docSubtitle}</div>
        )}
      </div>
      <div style={{ flex: 1 }} aria-hidden />
    </div>
  );
}

/** Two-column meta grid — Order Date / Version / etc on the left,
 *  Recipient / Effective From / Sales Person on the right. */
function PdfMetaGrid({ left, right }: {
  left: PdfDocumentData["metaLeft"];
  right: PdfDocumentData["metaRight"];
}) {
  const renderRow = (label: string, value: string, key: string) => (
    <div key={key} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "5px 0" }}>
      <span style={{ fontSize: 11, color: PDF_TOKENS.muted, minWidth: 130 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: PDF_TOKENS.fg, flex: 1 }}>{value || "—"}</span>
    </div>
  );
  return (
    <div
      style={{
        marginTop: 16,
        padding: "14px 18px",
        borderRadius: 8,
        background: PDF_TOKENS.panelBg,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        columnGap: 32,
      }}
    >
      <div>{left.map((r, i) => renderRow(r.label, r.value, `L${i}`))}</div>
      <div>{right.map((r, i) => renderRow(r.label, r.value, `R${i}`))}</div>
    </div>
  );
}

/** Three-column address block — Customer / Ship To / Bill To. */
function PdfAddresses({ data }: { data: PdfDocumentData }) {
  const cell = (title: string, addr: PdfAddress) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: PDF_TOKENS.muted, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: PDF_TOKENS.fg, lineHeight: 1.4 }}>
        {addr.displayName}
      </div>
      {addr.phone && (
        <div style={{ fontSize: 11.5, color: PDF_TOKENS.muted, marginTop: 4 }}>{addr.phone}</div>
      )}
      {(addr.street || addr.city) && (
        <div style={{ fontSize: 11.5, color: PDF_TOKENS.muted, marginTop: 4, lineHeight: 1.4 }}>
          {addr.street && <div>{addr.street}</div>}
          {(addr.city || addr.state || addr.zip) && (
            <div>{[addr.city, addr.state, addr.zip].filter(Boolean).join(", ")}</div>
          )}
          {addr.country && <div>{addr.country}</div>}
        </div>
      )}
      {addr.email && (
        /* Long emails (no natural spaces) would overflow into the
           adjacent column on print. `overflow-wrap: anywhere` lets
           them break at any character when they can't fit — the
           correct choice for print/PDF since ellipsis truncation
           would silently hide the address on paper. */
        <div style={{ fontSize: 11.5, color: PDF_TOKENS.muted, marginTop: 4, overflowWrap: "anywhere", wordBreak: "break-word" }}>{addr.email}</div>
      )}
    </div>
  );
  return (
    <div style={{ marginTop: 18, display: "flex", gap: 24 }}>
      {cell("Customer", data.customer)}
      {cell("Ship To", data.shipTo)}
      {cell("Bill To", data.billTo)}
    </div>
  );
}

/* ═══════════════════════════════════════════════
 * LINE ITEM TABLE
 * ═══════════════════════════════════════════════ */

function PdfItemsHeader({ shownFrom, shownTo, totalCount }: {
  shownFrom: number; shownTo: number; totalCount: number; unitLabel?: string;
}) {
  const rangeSuffix = totalCount > (shownTo - shownFrom + 1)
    ? ` · showing ${shownFrom}–${shownTo} of ${totalCount}`
    : "";
  return (
    <div
      style={{
        marginTop: 18,
        marginBottom: 8,
        display: "flex",
        alignItems: "baseline",
        gap: 8,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color: PDF_TOKENS.fg, letterSpacing: 0.1 }}>
        Item Details
      </span>
      {rangeSuffix && (
        <span style={{ fontSize: 11, color: PDF_TOKENS.mutedSoft, fontWeight: 400 }}>
          {rangeSuffix}
        </span>
      )}
    </div>
  );
}

/** Compact metadata pair shown in the strip beneath each item. */
function MetaCell({ label, value, align = "left", numeric = false }: {
  label: string; value: React.ReactNode; align?: "left" | "right"; numeric?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, textAlign: align, minWidth: 0 }}>
      <span
        style={{
          fontSize: 9.5, fontWeight: 700, color: PDF_TOKENS.mutedSoft,
          textTransform: "uppercase", letterSpacing: 0.4,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 11.5, fontWeight: 600, color: PDF_TOKENS.fg,
          fontVariantNumeric: numeric ? "tabular-nums" : "normal",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function PdfLineRow({ index, item, currency = "USD" }: {
  index: number; item: PdfLineItem; currency?: string;
}) {
  /* Consolidate the legacy discountPercent/premiumPercent props into
     the same rules list the caller may supply directly, so the
     breakdown treats both entry points uniformly. */
  const consolidatedRules: PdfLinePricingRule[] = item.pricingRules ?? [];
  if ((consolidatedRules.length === 0) && (item.discountPercent ?? 0) > 0) {
    consolidatedRules.push({
      label: "Discount",
      kind: "discount",
      percent: item.discountPercent!,
      amount: -(item.unitPrice * item.quantity * (item.discountPercent! / 100)),
    });
  }
  if ((item.pricingRules == null) && (item.premiumPercent ?? 0) > 0) {
    consolidatedRules.push({
      label: "Premium",
      kind: "premium",
      percent: item.premiumPercent!,
      amount: (item.unitPrice * item.quantity * (item.premiumPercent! / 100)),
    });
  }

  const baseLine = item.unitPrice * item.quantity;
  const hasBreakdown =
    consolidatedRules.length > 0 ||
    (item.adjustments && item.adjustments.length > 0) ||
    Math.abs(item.lineTotal - baseLine) > 0.005;

  return (
    <div
      style={{
        marginBottom: 12,
        padding: "14px 16px",
        border: `1px solid ${PDF_TOKENS.border}`,
        borderRadius: 8,
        background: "#FFFFFF",
        pageBreakInside: "avoid",
      }}
    >
      {/* Row 1 — index + thumb + code + description block on the left,
          line total (prominent) on the right. Description wraps freely
          across the whole body width and is never truncated so long
          catalogue copy stays fully readable. */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span
          style={{
            fontSize: 10.5, color: PDF_TOKENS.mutedSoft, fontWeight: 700,
            letterSpacing: 0.4, minWidth: 22, paddingTop: 2,
          }}
        >
          {String(index).padStart(2, "0")}
        </span>
        {item.imageUrl ? (
          <div
            style={{
              width: 56, height: 56, borderRadius: 6, overflow: "hidden",
              flexShrink: 0, background: PDF_TOKENS.panelBg,
              border: `1px solid ${PDF_TOKENS.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <img
              src={item.imageUrl}
              alt={item.code}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        ) : (
          <div
            style={{
              width: 56, height: 56, borderRadius: 6, background: PDF_TOKENS.panelBg,
              border: `1px solid ${PDF_TOKENS.border}`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              fontSize: 13, fontWeight: 700, color: PDF_TOKENS.mutedSoft,
              letterSpacing: 0.4,
            }}
          >
            {item.code.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13, fontWeight: 700, color: PDF_TOKENS.fg,
              lineHeight: 1.25, wordBreak: "break-word",
              whiteSpace: "normal", overflow: "visible",
            }}
          >
            {item.code}
          </div>
          <div
            style={{
              fontSize: 10.5, color: PDF_TOKENS.fgSoft, lineHeight: 1.55,
              marginTop: 3, wordBreak: "break-word",
              /* Explicit `normal` + `visible` guards against any
                 ancestor accidentally clipping long descriptions —
                 we never want an ellipsis on the customer's PDF. */
              whiteSpace: "normal", overflow: "visible", textOverflow: "clip",
            }}
          >
            {item.description}
          </div>
          {item.comment && (
            <div
              style={{
                fontSize: 10.5, color: PDF_TOKENS.muted, marginTop: 6,
                lineHeight: 1.5, wordBreak: "break-word",
                whiteSpace: "normal", overflow: "visible", textOverflow: "clip",
                padding: "6px 8px", background: PDF_TOKENS.panelBg, borderRadius: 4,
                borderLeft: `2px solid ${PDF_TOKENS.border}`,
              }}
            >
              <strong style={{ color: PDF_TOKENS.fgSoft, fontWeight: 600 }}>Instructions:</strong>{" "}
              {item.comment}
            </div>
          )}
          {/* Line-item `[N]` reference markers removed — References
              section is a plain URL list, referenced inline from the
              description if the rep wants to point at a specific URL. */}
        </div>
        {/* Line total — anchored top-right so it aligns across cards
            even when the description block wraps to different heights. */}
        <div style={{ textAlign: "right", flexShrink: 0, minWidth: 100 }}>
          <div
            style={{
              fontSize: 9.5, fontWeight: 700, color: PDF_TOKENS.mutedSoft,
              textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2,
            }}
          >
            Line Total
          </div>
          <div
            style={{
              fontSize: 15, fontWeight: 700, color: PDF_TOKENS.fg,
              fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
            }}
          >
            {fmtCurrency(item.lineTotal, currency)}
          </div>
        </div>
      </div>

      {/* Row 2 — metadata strip. Fixed 4-column grid so the last
          row's cells always align under the top row's first N
          columns — no orphaned single cell on its own centred row.
          Cell count scales up to 8 fields (Qty · Unit · Shipping ·
          Carrier · Tracking # · Ship from · Ship by · Status),
          wrapping into a second 4-column row when needed. */}
      <div
        style={{
          marginTop: 10, paddingTop: 10,
          borderTop: `1px dashed ${PDF_TOKENS.border}`,
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          columnGap: 20, rowGap: 12,
        }}
      >
        <MetaCell label="Qty" value={item.quantity} numeric />
        <MetaCell label="Unit" value={item.unitOfMeasure} />
        {item.shipMethod && <MetaCell label="Shipping" value={item.shipMethod} />}
        {item.shipCarrier && <MetaCell label="Carrier" value={item.shipCarrier} />}
        {item.trackingNumber && <MetaCell label="Tracking #" value={item.trackingNumber} numeric />}
        {item.shipFrom && <MetaCell label="Ship from" value={item.shipFrom} />}
        {item.shipByDate && <MetaCell label="Ship by" value={item.shipByDate} numeric />}
        {item.shipStatus && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span
              style={{
                fontSize: 9.5, fontWeight: 700, color: PDF_TOKENS.mutedSoft,
                textTransform: "uppercase", letterSpacing: 0.4,
              }}
            >
              Status
            </span>
            <span
              style={{
                display: "inline-flex", alignItems: "center", width: "fit-content",
                height: 18, padding: "0 6px", borderRadius: 3,
                fontSize: 9.5, fontWeight: 700, whiteSpace: "nowrap",
                letterSpacing: 0.3,
                background: /delivered/i.test(item.shipStatus) ? PDF_TOKENS.greenBg
                  : /transit|shipped/i.test(item.shipStatus) ? PDF_TOKENS.primaryBg
                  : PDF_TOKENS.amberBg,
                color: /delivered/i.test(item.shipStatus) ? "#166534"
                  : /transit|shipped/i.test(item.shipStatus) ? PDF_TOKENS.primary
                  : PDF_TOKENS.amberFg,
                border: `1px solid ${/delivered/i.test(item.shipStatus) ? PDF_TOKENS.greenBorder
                  : /transit|shipped/i.test(item.shipStatus) ? PDF_TOKENS.primaryBorder
                  : PDF_TOKENS.amberBorder}`,
              }}
            >
              {item.shipStatus}
            </span>
          </div>
        )}
      </div>

      {/* Row 3 — itemised pricing breakdown. Shows the base line
          (unit × qty), each pricing-rule delta, each line-level
          one-time adjustment, and the reconciled line total. Only
          renders when there IS a breakdown; a simple unit-price row
          replaces it when the line has no rules or adjustments. */}
      <div
        style={{
          marginTop: 10, paddingTop: 10,
          borderTop: `1px dashed ${PDF_TOKENS.border}`,
        }}
      >
        {hasBreakdown ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginLeft: "auto", maxWidth: 340 }}>
            {/* Base line = unit × qty */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 11, gap: 12 }}>
              <span style={{ color: PDF_TOKENS.muted }}>
                Unit price × {item.quantity}
                <span style={{ marginLeft: 6, color: PDF_TOKENS.mutedSoft }}>
                  ({fmtCurrency(item.unitPrice, currency)} each)
                </span>
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums", color: PDF_TOKENS.fg, fontWeight: 500 }}>
                {fmtCurrency(baseLine, currency)}
              </span>
            </div>
            {consolidatedRules.map((r, i) => (
              <div
                key={`rule-${i}`}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 11, gap: 12 }}
              >
                <span style={{ color: PDF_TOKENS.muted, display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span
                    style={{
                      display: "inline-flex", alignItems: "center", height: 15,
                      padding: "0 5px", borderRadius: 3,
                      background: r.kind === "discount" ? PDF_TOKENS.greenBg : PDF_TOKENS.amberBg,
                      color: r.kind === "discount" ? "#166534" : PDF_TOKENS.amberFg,
                      border: `1px solid ${r.kind === "discount" ? PDF_TOKENS.greenBorder : PDF_TOKENS.amberBorder}`,
                      fontSize: 9, fontWeight: 700, whiteSpace: "nowrap",
                    }}
                  >
                    {r.kind === "discount" ? `-${r.percent}%` : `+${r.percent}%`}
                  </span>
                  <span>{r.label}</span>
                </span>
                <span
                  style={{
                    fontVariantNumeric: "tabular-nums", fontWeight: 500,
                    color: r.amount < 0 ? PDF_TOKENS.green : PDF_TOKENS.amberFg,
                  }}
                >
                  {r.amount < 0 ? "-" : "+"}{fmtCurrency(Math.abs(r.amount), currency)}
                </span>
              </div>
            ))}
            {item.adjustments && item.adjustments.map((a, i) => (
              <div
                key={`adj-${i}`}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 11, gap: 12 }}
              >
                <span style={{ color: PDF_TOKENS.muted }}>
                  <span style={{ fontStyle: "italic" }}>Adj.</span> {a.label}
                </span>
                <span
                  style={{
                    fontVariantNumeric: "tabular-nums", fontWeight: 500,
                    color: a.amount < 0 ? PDF_TOKENS.green : PDF_TOKENS.fg,
                  }}
                >
                  {a.amount < 0 ? "-" : "+"}{fmtCurrency(Math.abs(a.amount), currency)}
                </span>
              </div>
            ))}
            <div
              style={{
                marginTop: 4, paddingTop: 6,
                borderTop: `1px solid ${PDF_TOKENS.border}`,
                display: "flex", justifyContent: "space-between", alignItems: "baseline",
                fontSize: 12, gap: 12,
              }}
            >
              <span style={{ color: PDF_TOKENS.fg, fontWeight: 700 }}>Line total</span>
              <span style={{ fontVariantNumeric: "tabular-nums", color: PDF_TOKENS.fg, fontWeight: 700 }}>
                {fmtCurrency(item.lineTotal, currency)}
              </span>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
              fontSize: 11, maxWidth: 340, marginLeft: "auto", gap: 12,
            }}
          >
            <span style={{ color: PDF_TOKENS.muted }}>
              Unit price × {item.quantity}
              <span style={{ marginLeft: 6, color: PDF_TOKENS.mutedSoft }}>
                ({fmtCurrency(item.unitPrice, currency)} each)
              </span>
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums", color: PDF_TOKENS.fg, fontWeight: 700 }}>
              {fmtCurrency(item.lineTotal, currency)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
 * PRICING RULES / ADJUSTMENTS / TOTALS
 * ═══════════════════════════════════════════════ */

function PdfPricingSection({ title, rows, currency }: {
  title: string;
  rows: { label: string; amount: number; scope?: string }[];
  currency?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 8, border: `1px solid ${PDF_TOKENS.borderSoft}`, background: PDF_TOKENS.panelBgSoft }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: PDF_TOKENS.muted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 11.5 }}>
            <span style={{ color: PDF_TOKENS.fg }}>
              {r.label}
              {r.scope && (
                <span style={{ marginLeft: 6, fontSize: 10.5, color: PDF_TOKENS.mutedSoft }}>· {r.scope}</span>
              )}
            </span>
            <span style={{
              fontVariantNumeric: "tabular-nums",
              fontWeight: 600,
              color: r.amount < 0 ? PDF_TOKENS.green : PDF_TOKENS.fg,
            }}>
              {r.amount < 0 ? "-" : ""}{fmtCurrency(Math.abs(r.amount), currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PdfPaymentTotals({ data }: { data: PdfDocumentData }) {
  const c = data.currency || "USD";
  return (
    <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 32 }}>
      <div style={{ paddingTop: 4, fontSize: 12, color: PDF_TOKENS.muted, lineHeight: 1.8 }}>
        {data.paymentMethod && (
          <div>Payment Method: <span style={{ fontWeight: 700, color: PDF_TOKENS.fg }}>{data.paymentMethod}</span></div>
        )}
        {data.paymentTerms && (
          <div>Payment Terms: <span style={{ fontWeight: 700, color: PDF_TOKENS.fg }}>{data.paymentTerms}</span></div>
        )}
      </div>
      <div style={{ minWidth: 300 }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12 }}>
          <span style={{ color: PDF_TOKENS.muted }}>Subtotal ({data.items.length} item{data.items.length !== 1 ? "s" : ""})</span>
          <span style={{ fontWeight: 600, color: PDF_TOKENS.fg, fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(data.subtotal, c)}</span>
        </div>
        {(data.discountsTotal ?? 0) > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12 }}>
            <span style={{ color: PDF_TOKENS.muted }}>Discounts Applied</span>
            <span style={{ fontWeight: 600, color: PDF_TOKENS.green, fontVariantNumeric: "tabular-nums" }}>-{fmtCurrency(data.discountsTotal!, c)}</span>
          </div>
        )}
        {(data.premiumsTotal ?? 0) > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12 }}>
            <span style={{ color: PDF_TOKENS.muted }}>Premiums Applied</span>
            <span style={{ fontWeight: 600, color: PDF_TOKENS.amberFg, fontVariantNumeric: "tabular-nums" }}>+{fmtCurrency(data.premiumsTotal!, c)}</span>
          </div>
        )}
        {(data.adjustmentsTotal ?? 0) !== 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12 }}>
            <span style={{ color: PDF_TOKENS.muted }}>One-time adjustments</span>
            <span style={{ fontWeight: 600, color: PDF_TOKENS.fg, fontVariantNumeric: "tabular-nums" }}>
              {data.adjustmentsTotal! < 0 ? "-" : ""}{fmtCurrency(Math.abs(data.adjustmentsTotal!), c)}
            </span>
          </div>
        )}
        {(data.taxTotal ?? 0) > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12 }}>
            <span style={{ color: PDF_TOKENS.muted }}>Tax</span>
            <span style={{ fontWeight: 600, color: PDF_TOKENS.fg, fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(data.taxTotal!, c)}</span>
          </div>
        )}
        {(data.freightTotal ?? 0) > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12 }}>
            <span style={{ color: PDF_TOKENS.muted }}>Freight</span>
            <span style={{ fontWeight: 600, color: PDF_TOKENS.fg, fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(data.freightTotal!, c)}</span>
          </div>
        )}
        <div
          style={{
            borderTop: `2px solid ${PDF_TOKENS.fg}`,
            marginTop: 8, paddingTop: 10,
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
            background: PDF_TOKENS.panelBg,
            padding: "10px 12px",
            borderRadius: 4,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700 }}>Total Amount</span>
          <span style={{ fontSize: 19, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(data.grandTotal, c)}</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
 * NOTES / REFERENCES / TERMS / SIGNATURE
 * ═══════════════════════════════════════════════ */

function PdfNotes({ notes }: { notes: string[] }) {
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: PDF_TOKENS.fg, marginBottom: 10 }}>Notes</div>
      <ol style={{ margin: 0, paddingLeft: 20, fontSize: 11.5, color: PDF_TOKENS.fg, lineHeight: 1.7 }}>
        {notes.map((n, i) => (
          <li key={i} style={{ marginTop: i > 0 ? 4 : 0 }}
            dangerouslySetInnerHTML={{ __html: n }}
          />
        ))}
      </ol>
    </div>
  );
}

function PdfReferences({ refs }: { refs: string[] }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: PDF_TOKENS.fg, marginBottom: 6 }}>References</div>
      <div style={{ fontSize: 11, color: PDF_TOKENS.primary, lineHeight: 1.7 }}>
        {refs.map((url, i) => (
          <div key={`${i}-${url}`}>
            <a href={url} style={{ color: PDF_TOKENS.primary, textDecoration: "none" }}>{url}</a>
          </div>
        ))}
      </div>
    </div>
  );
}

function PdfTermsSection({ terms }: { terms: PdfTermsBlock }) {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, color: PDF_TOKENS.fg, marginBottom: 18, letterSpacing: 0.2 }}>
        TERMS AND CONDITIONS
      </div>
      <div style={{ fontSize: 11, color: PDF_TOKENS.fg, lineHeight: 1.65 }}>
        {terms.paragraphs.map((p, i) => (
          <p key={i} style={{ marginBottom: 12 }} dangerouslySetInnerHTML={{ __html: p }} />
        ))}
      </div>
    </div>
  );
}

function PdfSignatureBlock({ block }: { block: NonNullable<PdfDocumentData["signature"]> }) {
  const slots = Math.max(1, Math.min(3, block.slotCount ?? 1));
  return (
    <div style={{ marginTop: 28, padding: "18px 20px", border: `1px solid ${PDF_TOKENS.border}`, borderRadius: 8, background: PDF_TOKENS.panelBgSoft }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: PDF_TOKENS.fg, marginBottom: 8 }}>
        {block.heading}
      </div>
      <div style={{ fontSize: 11.5, color: PDF_TOKENS.fgSoft, lineHeight: 1.6, marginBottom: 20 }}>
        {block.body}
      </div>
      {/* Signature + Date lines — width split 2:1 so the date line
          is wide enough to actually write a date into (previously the
          date column was auto-sized and collapsed to ~30px). */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: slots === 1 ? "2fr 1fr" : "1fr 1fr 1fr",
          columnGap: 24, rowGap: 18,
        }}
      >
        {Array.from({ length: slots }).map((_, i) => (
          <div key={i}>
            <div style={{ borderBottom: `1px solid ${PDF_TOKENS.fg}`, height: 32 }} />
            <div style={{ fontSize: 10, color: PDF_TOKENS.muted, marginTop: 4 }}>
              Signature{slots > 1 ? ` (${i === 0 ? "Customer" : "Authorized"})` : ""}
            </div>
          </div>
        ))}
        <div>
          <div style={{ borderBottom: `1px solid ${PDF_TOKENS.fg}`, height: 32 }} />
          <div style={{ fontSize: 10, color: PDF_TOKENS.muted, marginTop: 4 }}>Date</div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
 * MAIN COMPONENT
 * ═══════════════════════════════════════════════ */

export interface PdfDocumentProps {
  data: PdfDocumentData;
  visibility?: PdfVisibility;
  /** When set, `items` are chunked across page 1 body + subsequent
   *  pages. Terms sit on the last page. Default: 6 items on page 1,
   *  10 per subsequent page — matches a US-Letter body height at
   *  the visual weight the current template uses. */
  itemsPerFirstPage?: number;
  itemsPerNextPage?: number;
}

/**
 * Pages the document prints to: the item pages (page 1 carries the
 * head content plus the first items) and a final terms page. Same
 * chunking as PdfDocument below, so the Print window's count matches
 * the preview page for page.
 */
export function getPdfPageCount(
  data: PdfDocumentData,
  visibility?: PdfVisibility,
  itemsPerFirstPage = 4,
  itemsPerNextPage = 6,
): number {
  const vis = { ...ALL_ON, ...(visibility ?? {}) };
  const itemCount = vis.items ? data.items.length : 0;
  const itemPages = itemCount <= itemsPerFirstPage ? 1 : 1 + Math.ceil((itemCount - itemsPerFirstPage) / itemsPerNextPage);
  const hasTerms = !!(vis.terms && data.terms && data.terms.paragraphs.length > 0);
  return itemPages + (hasTerms ? 1 : 0);
}

/**
 * Render a full multi-page PDF-lookalike for a Quote or Sales Order.
 * Preview-safe (renders inline as HTML) and print-safe (each `PdfPage`
 * carries `pageBreakAfter: always`).
 */
export function PdfDocument({
  data,
  visibility,
  itemsPerFirstPage = 4,
  itemsPerNextPage = 6,
}: PdfDocumentProps) {
  const vis = { ...ALL_ON, ...(visibility ?? {}) };

  /* Chunk items across pages. Item page = pages that carry line rows.
     The head content (header, meta, addresses) only appears on page 1.
     Terms + signature sit on the final page. */
  const itemChunks: PdfLineItem[][] = [];
  let cursor = 0;
  if (vis.items && data.items.length > 0) {
    const firstChunk = data.items.slice(cursor, cursor + itemsPerFirstPage);
    itemChunks.push(firstChunk);
    cursor += firstChunk.length;
    while (cursor < data.items.length) {
      itemChunks.push(data.items.slice(cursor, cursor + itemsPerNextPage));
      cursor += itemsPerNextPage;
    }
  } else {
    itemChunks.push([]); // still render page 1 for header/meta
  }

  const hasTerms = vis.terms && data.terms && data.terms.paragraphs.length > 0;
  const hasSignature = vis.signature && data.signature;
  const totalPages = getPdfPageCount(data, visibility, itemsPerFirstPage, itemsPerNextPage);

  const totalItemCount = data.totalItemCount ?? data.items.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, padding: 24, background: PDF_TOKENS.panelBg }}>
      {/* Print CSS — page size + margins + break behaviour. The 780px
          page width fits both US Letter (816px) and A4 (~794px) so the
          browser doesn't downscale; we still declare `size: auto` so
          it defers to the user's printer selection. */}
      <style>{`
        @media print {
          @page { size: auto; margin: 12mm; }
          body { background: #fff !important; }
          [data-pdf-page] {
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            min-height: 0 !important;
            page-break-after: always;
          }
          [data-pdf-page]:last-child { page-break-after: auto; }
        }
      `}</style>

      {itemChunks.map((chunk, pageIdx) => {
        const isFirst = pageIdx === 0;
        const pageNumber = pageIdx + 1;
        const shownFrom = data.items.slice(0, itemChunks.slice(0, pageIdx).reduce((s, c) => s + c.length, 0)).length + 1;
        const shownTo = shownFrom + chunk.length - 1;
        return (
          <PdfPage
            key={`items-${pageIdx}`}
            pageNumber={pageNumber}
            totalPages={totalPages}
            docNumber={data.docNumber}
            poweredBy={data.poweredBy}
          >
            {isFirst && vis.brand && <PdfHeader data={data} />}
            {isFirst && vis.meta && <PdfMetaGrid left={data.metaLeft} right={data.metaRight} />}
            {isFirst && vis.addresses && <PdfAddresses data={data} />}

            {vis.items && chunk.length > 0 && (
              <>
                <PdfItemsHeader
                  shownFrom={shownFrom}
                  shownTo={shownTo}
                  totalCount={totalItemCount}
                  unitLabel={data.unitLabel}
                />
                {/* Card-per-item layout — each `PdfLineRow` is a
                    self-contained bordered card, so long descriptions
                    have room to wrap freely and rows never squish
                    into one-character columns on narrow widths. */}
                <div>
                  {chunk.map((it, i) => (
                    <PdfLineRow
                      key={it.id}
                      index={shownFrom + i}
                      item={it}
                      currency={data.currency}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Pricing rules + adjustments + payment + totals ONLY on the
                last items page (before Terms). */}
            {pageIdx === itemChunks.length - 1 && (
              <>
                {vis.pricingRules && data.pricingRules && data.pricingRules.length > 0 && (
                  /* Customer-facing label — "Pricing Rules" is the
                     internal sales-team term; the printed doc calls
                     the same block "Discounts & Surcharges" so the
                     customer reads what they see (a credit or a fee
                     applied to the order), not the mechanism. */
                  <PdfPricingSection title="Discounts & Surcharges" rows={data.pricingRules} currency={data.currency} />
                )}
                {vis.adjustments && data.adjustments && data.adjustments.length > 0 && (
                  /* Customer-facing label for order-level one-offs
                     like early-payment credits or oversized-freight
                     surcharges. Internal name is "One-Time Premiums
                     & Discounts" / "Adjustments"; on the doc it reads
                     as "Additional Charges & Credits". */
                  <PdfPricingSection
                    title="Additional Charges & Credits"
                    rows={data.adjustments.map(a => ({ label: a.label, amount: a.kind === "premium" ? Math.abs(a.amount) : -Math.abs(a.amount), scope: a.scope }))}
                    currency={data.currency}
                  />
                )}
                {(vis.payment || vis.totals) && <PdfPaymentTotals data={data} />}
                {vis.notes && data.notes && data.notes.length > 0 && <PdfNotes notes={data.notes} />}
                {vis.references && data.references && data.references.length > 0 && <PdfReferences refs={data.references} />}
              </>
            )}
          </PdfPage>
        );
      })}

      {hasTerms && (
        <PdfPage
          key="terms"
          pageNumber={totalPages}
          totalPages={totalPages}
          docNumber={data.docNumber}
          poweredBy={data.poweredBy}
        >
          <div style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: PDF_TOKENS.muted, marginBottom: 24, paddingTop: 8 }}>
            {data.brand.name} — {data.kind === "quote" ? "Quote" : "Sales Order"} Terms and Conditions
          </div>
          <PdfTermsSection terms={data.terms!} />
          {hasSignature && <PdfSignatureBlock block={data.signature!} />}
        </PdfPage>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
 * DEFAULT TERMS
 * Two variants — Quote vs SO — the caller picks. Trimmed down from
 * the FR Conversions reference (per-business policies stripped;
 * generic B2B ERP terms retained).
 * ═══════════════════════════════════════════════ */

export const DEFAULT_QUOTE_TERMS: PdfTermsBlock = {
  paragraphs: [
    "<strong>1. ACCEPTANCE & VALIDITY:</strong> This quotation is valid for the period stated on page 1 from the issue date. It becomes a binding contract upon the customer's signature or written approval. We reserve the right to modify or withdraw this quotation prior to acceptance. Any changes after acceptance require written agreement from both parties.",
    "<strong>2. PRICING & PAYMENT:</strong> All prices are in the stated currency and based on current costs. Prices may be adjusted for changes after the quote's expiry. Payment terms are as stated on page 1 from the invoice date. Overdue amounts may incur monthly interest and may result in suspended deliveries; the customer is responsible for all collection costs.",
    "<strong>3. DELIVERY & SHIPPING:</strong> We are not liable for carrier delays. Estimated ship and delivery dates are targets, not guarantees. The customer must inspect items upon delivery and report damage or discrepancies within 7 days. Ownership and risk of loss transfer upon dispatch unless otherwise agreed.",
    "<strong>4. WARRANTIES & DISCLAIMERS:</strong> Products are warranted against defects in materials and workmanship for 12 months from delivery. Our sole obligation is to repair or replace defective products. Warranty is void if products are modified, misused, or damaged by the customer. We disclaim all other warranties, express or implied, including merchantability and fitness for a particular purpose.",
    "<strong>5. LIMITATION OF LIABILITY:</strong> Our total liability shall not exceed the price paid for the products. We are not liable for indirect, incidental, consequential, special, or punitive damages, including lost profits, business interruption, or data loss, regardless of cause.",
    "<strong>6. CANCELLATIONS & RETURNS:</strong> Orders cannot be cancelled after acceptance without written consent. Custom or made-to-order items are non-cancellable and non-returnable. Standard products may be returned within 30 days with prior authorization, subject to a restocking fee. Products must be unused in their original packaging. The customer pays return shipping unless products are defective.",
    "<strong>7. COMPLIANCE & EXPORT:</strong> The customer must comply with all export control laws and sanctions regulations. Products may not be exported to prohibited countries or used for prohibited purposes.",
    "<strong>8. INTELLECTUAL PROPERTY:</strong> All designs, specifications, documentation, and intellectual property remain our exclusive property. The customer receives no license except as necessary to use purchased products.",
    "<strong>9. FORCE MAJEURE:</strong> Neither party is liable for delays or failures due to events beyond reasonable control, including natural disasters, war, pandemics, strikes, or government actions. Performance obligations are suspended during such events.",
    "<strong>10. GENERAL PROVISIONS:</strong> This quotation, together with any attached specifications, constitutes the entire agreement and supersedes all prior communications.",
  ],
};

export const DEFAULT_SO_TERMS: PdfTermsBlock = {
  paragraphs: [
    "<strong>1. ACCEPTANCE & CONTRACT:</strong> This Sales Order constitutes a binding contract upon issuance and, where applicable, references the customer's purchase order and originating quote. Any changes after issuance require written agreement from both parties.",
    "<strong>2. PRICING & PAYMENT:</strong> Prices are locked at the values agreed in the referenced quote and stated on page 1. Payment terms are as stated on page 1 from invoice date. Overdue amounts may incur monthly interest, and we may suspend further deliveries and pursue collection; the customer is responsible for all collection costs.",
    "<strong>3. DELIVERY & SHIPPING:</strong> Each line item has its own shipping milestone shown in the Items table. We are not liable for carrier delays. Per-line tracking is provided once carrier pickup is confirmed. The customer must inspect items upon delivery and report damage or discrepancies within 7 days. Risk of loss transfers on dispatch unless otherwise agreed.",
    "<strong>4. WARRANTIES & DISCLAIMERS:</strong> Products are warranted against defects in materials and workmanship for 12 months from delivery. Our sole obligation is to repair or replace defective products. Warranty is void if products are modified, misused, or damaged by the customer. We disclaim all other warranties, express or implied, including merchantability and fitness for a particular purpose.",
    "<strong>5. LIMITATION OF LIABILITY:</strong> Our total liability shall not exceed the price paid for the products. We are not liable for indirect, incidental, consequential, special, or punitive damages, including lost profits, business interruption, or data loss, regardless of cause.",
    "<strong>6. CANCELLATIONS & RETURNS:</strong> This Sales Order cannot be cancelled after acceptance without written consent. Custom or made-to-order items are non-cancellable and non-returnable. Standard products may be returned within 30 days with prior authorization, subject to a restocking fee. Products must be unused in their original packaging. The customer pays return shipping unless products are defective.",
    "<strong>7. COMPLIANCE & EXPORT:</strong> The customer must comply with all export control laws and sanctions regulations. Products may not be exported to prohibited countries or used for prohibited purposes.",
    "<strong>8. INTELLECTUAL PROPERTY:</strong> All designs, specifications, documentation, and intellectual property remain our exclusive property. The customer receives no license except as necessary to use purchased products.",
    "<strong>9. FORCE MAJEURE:</strong> Neither party is liable for delays or failures due to events beyond reasonable control, including natural disasters, war, pandemics, strikes, or government actions. Performance obligations are suspended during such events.",
    "<strong>10. GENERAL PROVISIONS:</strong> This Sales Order, together with the referenced quote and any customer purchase order, constitutes the entire agreement and supersedes all prior communications.",
  ],
};
