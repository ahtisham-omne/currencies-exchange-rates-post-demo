import { Package, CheckCircle2, Clock, Undo2 } from "lucide-react";
import { FONT } from "./designTokens";
import type { POVersionEntry } from "./poStore";
import {
  versionPalette as C,
  formatCurrency,
  formatSignedCurrency,
  rateTypeText,
  useDocFx,
  versionFx,
} from "./poVersionDisplay";
import { snapshotOneTimeNet } from "./poOrderPricing";
import { getCurrency } from "@/app/currency/currencies";
import { formatRateDate, rateSentence } from "@/app/currency/money";
import type { PoFx } from "@/app/currency/poFx";
import { Money } from "./currency/Money";
import { CurrencyFlag } from "./currency/CurrencyChip";

/* Price / Total columns: wide enough for ₨3,453,648.00 or MXN 12,400.00. */
const AMOUNT_W = 96;

/* Uppercase caption — same recipe as the Subtotal / Total labels. */
const CAPTION: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: C.text500,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  lineHeight: 1,
  fontFamily: FONT,
};

/* The version's currency and rate (spec 4.3): flag + code, then
   "1 USD = 274.3045 PKR · Mid-market · Feb 20, 2026". A version in the
   base currency has no rate. */
function VersionCurrencyStrip({ fx }: { fx: PoFx }) {
  return (
    <div
      className="flex items-center flex-wrap px-3.5 py-2 border-t"
      style={{ gap: "6px 16px", borderColor: C.border, backgroundColor: "#FFFFFF" }}
    >
      <div className="flex items-center" style={{ gap: 6 }}>
        <span style={CAPTION}>Currency</span>
        <span
          className="inline-flex items-center"
          title={getCurrency(fx.currency)?.name}
          style={{ gap: 5, fontSize: 12, fontWeight: 500, color: C.text700, lineHeight: 1, fontFamily: FONT }}
        >
          <CurrencyFlag code={fx.currency} size={11} />
          {fx.currency}
        </span>
      </div>
      <div className="flex items-center min-w-0" style={{ gap: 6 }}>
        <span style={CAPTION}>Exchange rate</span>
        {fx.isBase ? (
          <span style={{ fontSize: 11, fontWeight: 400, color: C.text500, lineHeight: 1, fontFamily: FONT }}>
            No conversion
          </span>
        ) : (
          <span
            className="tabular-nums"
            style={{ fontSize: 11, fontWeight: 500, color: C.text700, lineHeight: 1.3, fontFamily: FONT }}
          >
            {rateSentence(fx.currency, fx.rate)}
            <span style={{ fontWeight: 400, color: C.text500 }}>
              {" · "}
              <span style={{ fontWeight: 500, color: fx.rateType === "mid" ? "#6D28D9" : "#B45309" }}>
                {rateTypeText(fx)}
              </span>
              {` · ${formatRateDate(fx.rateDate)}`}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Line-items snapshot panel + timestamp/delivery strip.
 *
 * Extracted from POVersionHistoryTab.tsx (was inline lines ~416-527 of the
 * original 774-LOC file) as part of the 2026-07-10 component split.
 *
 * Renders the expanded body of a version row: the timestamps strip
 * (Created / Confirmed / Delivery), the Line Items table with header +
 * rows + subtotal, the version's currency + exchange rate, and the
 * Discount summary + Total footer. Amounts are in the version's currency.
 *
 * Pure presentational component — no state, no callbacks.
 */
interface POVersionSnapshotPanelProps {
  version: POVersionEntry;
  /** The PO's current currency, for snapshots that recorded none.
      Defaults to the PO page's (DocCurrency). */
  fallbackFx?: PoFx | null;
}

export default function POVersionSnapshotPanel({
  version: ver,
  fallbackFx,
}: POVersionSnapshotPanelProps) {
  const lineItems = ver.snapshot.lineItems ?? [];
  // Every amount below is in this version's own currency.
  const docFx = useDocFx();
  const fx = versionFx(ver.snapshot, fallbackFx ?? docFx);
  const code = fx.currency;

  return (
    <>
      {/* Timestamps strip — meta chips with Partners icon tints. */}
      <div
        className="flex flex-wrap items-center pt-2.5 mb-3.5"
        style={{ gap: 16, borderTop: `1px solid ${C.divider}` }}
      >
        <div className="flex items-center" style={{ gap: 5 }}>
          <Clock style={{ width: 12, height: 12, color: C.text400 }} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 400,
              color: C.text500,
              lineHeight: 1,
              fontFamily: FONT,
            }}
            className="tabular-nums"
          >
            Created {new Date(ver.createdAt).toLocaleString()}
          </span>
        </div>
        {ver.versionStatus === "confirmed" && (
          <div className="flex items-center" style={{ gap: 5 }}>
            <CheckCircle2 style={{ width: 12, height: 12, color: "#065F46" }} />
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "#065F46",
                lineHeight: 1,
                fontFamily: FONT,
              }}
            >
              Confirmed
            </span>
          </div>
        )}
        <div className="flex items-center" style={{ gap: 5 }}>
          <Package style={{ width: 12, height: 12, color: C.text400 }} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 400,
              color: C.text500,
              lineHeight: 1,
              fontFamily: FONT,
            }}
          >
            Delivery:{" "}
            <span
              className="tabular-nums"
              style={{ fontWeight: 500, color: C.text700 }}
            >
              {ver.snapshot.deliveryDate}
            </span>
          </span>
        </div>
      </div>

      {/* Revert reason — surfaced when the buyer reverted the PO to
          this version. The reason is stamped onto the source version
          in `revertPOToVersion` (poStore.ts) so the version card can
          render it. Buyer 2026-07-31: "show revert reason that user
          have added while reverting a version". */}
      {ver.revertReason && (
        <div
          className="rounded-md border mb-4"
          style={{
            borderColor: "#FDE68A",
            backgroundColor: "#FFFBEB",
            padding: "10px 12px",
          }}
        >
          <div className="flex items-center" style={{ gap: 6, marginBottom: 4 }}>
            <Undo2 style={{ width: 12, height: 12, color: "#92400E" }} />
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "#92400E",
                textTransform: "uppercase" as const,
                letterSpacing: "0.04em",
                lineHeight: 1,
                fontFamily: FONT,
              }}
            >
              Revert reason
            </span>
            {ver.revertReasonBy && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: "#78350F",
                  lineHeight: 1,
                  fontFamily: FONT,
                }}
              >
                · by {ver.revertReasonBy}
              </span>
            )}
            {ver.revertReasonAt && (
              <span
                className="tabular-nums"
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: "#78350F",
                  lineHeight: 1,
                  fontFamily: FONT,
                }}
              >
                · {new Date(ver.revertReasonAt).toLocaleString()}
              </span>
            )}
          </div>
          <p
            style={{
              fontSize: 12,
              fontWeight: 400,
              color: "#78350F",
              lineHeight: 1.5,
              fontFamily: FONT,
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            {ver.revertReason}
          </p>
        </div>
      )}

      {/* Line Items table — Partners DataTable recipe (rounded-md
          border-border, muted/30 column header strip, soft row
          dividers, tabular-nums for numeric columns). */}
      <div
        className="rounded-md border overflow-hidden mb-4 w-full"
        style={{ borderColor: C.border, maxWidth: "100%" }}
      >
        {/* Section header — icon + caption + count chip */}
        <div
          className="flex items-center px-3.5 py-2 border-b"
          style={{
            gap: 6,
            borderColor: C.border,
            backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)",
          }}
        >
          <Package style={{ width: 12, height: 12, color: C.text500 }} />
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: C.text500,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              lineHeight: 1,
              fontFamily: FONT,
            }}
          >
            Line Items
          </span>
          <span
            className="inline-flex items-center rounded-md tabular-nums"
            style={{
              padding: "1px 6px",
              backgroundColor: C.divider,
              color: C.text600,
              fontSize: 10,
              fontWeight: 600,
              fontFamily: FONT,
              lineHeight: 1.4,
            }}
          >
            {lineItems.length}
          </span>
        </div>

        {/* Column headers */}
        <div
          className="flex items-center px-3.5 py-1.5 border-b"
          style={{
            gap: 8,
            borderColor: C.border,
            backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 18%, transparent)",
          }}
        >
          <div style={{ width: 24, flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: C.text500,
                textTransform: "uppercase" as const,
                letterSpacing: "0.04em",
                lineHeight: 1,
                fontFamily: FONT,
              }}
            >
              Item
            </span>
          </div>
          {(["Qty", "UOM", "Price", "Total"] as const).map((h) => (
            <span
              key={h}
              className="shrink-0"
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: C.text500,
                textTransform: "uppercase" as const,
                letterSpacing: "0.04em",
                lineHeight: 1,
                fontFamily: FONT,
                width: h === "Qty" ? 40 : h === "UOM" ? 44 : AMOUNT_W,
                textAlign: h === "UOM" ? "center" : ("right" as const),
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {lineItems.length > 0 ? (
          <div style={{ backgroundColor: "#FFFFFF" }}>
            {lineItems.map((li, liIdx) => (
              <div
                key={li.id}
                className="flex items-center px-3.5 py-2"
                style={{
                  gap: 8,
                  borderTop: liIdx > 0 ? `1px solid ${C.divider}` : "none",
                }}
              >
                <div
                  className="flex items-center justify-center shrink-0 rounded-md border"
                  style={{
                    width: 24,
                    height: 24,
                    backgroundColor: C.divider,
                    borderColor: C.border,
                  }}
                >
                  <Package style={{ width: 11, height: 11, color: C.text400 }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: C.text700,
                      lineHeight: 1,
                      marginBottom: 2,
                      fontFamily: FONT,
                    }}
                  >
                    {li.itemNumber}
                  </div>
                  <div
                    className="overflow-hidden text-ellipsis whitespace-nowrap"
                    style={{
                      fontSize: 12,
                      fontWeight: 400,
                      color: C.text600,
                      lineHeight: 1.3,
                      fontFamily: FONT,
                    }}
                  >
                    {li.descriptiveName}
                  </div>
                </div>
                <span
                  className="tabular-nums shrink-0"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: C.text700,
                    lineHeight: 1,
                    fontFamily: FONT,
                    width: 40,
                    textAlign: "right" as const,
                  }}
                >
                  {li.vendorQty}
                </span>
                <span
                  className="shrink-0"
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: C.text500,
                    lineHeight: 1,
                    fontFamily: FONT,
                    width: 44,
                    textAlign: "center" as const,
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.04em",
                  }}
                >
                  {li.vendorUOM}
                </span>
                <span
                  className="tabular-nums shrink-0"
                  style={{
                    fontSize: 12,
                    fontWeight: 400,
                    color: C.text600,
                    lineHeight: 1,
                    fontFamily: FONT,
                    width: AMOUNT_W,
                    textAlign: "right" as const,
                  }}
                >
                  {formatCurrency(li.unitPrice, code)}
                </span>
                <span
                  className="tabular-nums shrink-0"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: C.text900,
                    lineHeight: 1,
                    fontFamily: FONT,
                    width: AMOUNT_W,
                    textAlign: "right" as const,
                  }}
                >
                  {formatCurrency(li.lineTotal, code)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="px-3.5 py-3"
            style={{
              fontSize: 12,
              color: C.text400,
              fontStyle: "italic",
              fontFamily: FONT,
            }}
          >
            No line items
          </div>
        )}

        {/* Subtotal */}
        {lineItems.length > 0 && (
          <div
            className="flex items-center justify-end px-3.5 py-2 border-t"
            style={{ borderColor: C.border, backgroundColor: "#FFFFFF" }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: C.text500,
                textTransform: "uppercase" as const,
                letterSpacing: "0.04em",
                lineHeight: 1,
                marginRight: 8,
                fontFamily: FONT,
              }}
            >
              Subtotal
            </span>
            <span
              className="tabular-nums"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.text900,
                lineHeight: 1,
                width: AMOUNT_W,
                textAlign: "right" as const,
                fontFamily: FONT,
              }}
            >
              {formatCurrency(lineItems.reduce((s, li) => s + li.lineTotal, 0), code)}
            </span>
          </div>
        )}

        <VersionCurrencyStrip fx={fx} />

        {/* Footer — Discount / One-time summary + Total (shipping is
            excluded from the total, so it's no longer shown here). */}
        <div
          className="flex items-center justify-between px-3.5 py-2 border-t"
          style={{
            borderColor: C.border,
            backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)",
          }}
        >
          <span
            className="tabular-nums"
            style={{
              fontSize: 11,
              fontWeight: 400,
              color: C.text500,
              lineHeight: 1,
              fontFamily: FONT,
            }}
          >
            Discount:{" "}
            <span style={{ fontWeight: 500, color: C.text700 }}>
              {formatCurrency(ver.snapshot.discountTotal, code)}
            </span>{" "}
            &nbsp;·&nbsp; One-Time Discounts/Premiums:{" "}
            <span style={{ fontWeight: 500, color: C.text700 }}>
              {formatSignedCurrency(snapshotOneTimeNet(ver.snapshot), code)}
            </span>
          </span>
          <div className="flex items-center" style={{ gap: 8 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: C.text500,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                lineHeight: 1,
                fontFamily: FONT,
              }}
            >
              Total
            </span>
            <span
              className="tabular-nums"
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: C.text900,
                lineHeight: 1,
                fontFamily: FONT,
              }}
            >
              {/* Hover: the total in the base currency, at this version's rate. */}
              <Money value={ver.snapshot.total} currency={code} fx={fx} dateLabel="PO date" />
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
