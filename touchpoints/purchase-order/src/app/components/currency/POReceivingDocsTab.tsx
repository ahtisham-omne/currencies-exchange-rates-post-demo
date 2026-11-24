import * as React from "react";
import { ChevronRight, ClipboardCheck, PackageOpen } from "lucide-react";
import { FONT } from "../designTokens";
import type { PurchaseOrderData } from "../poStore";
import { BASE_CURRENCY } from "@/app/currency/currencies";
import { formatMoney, formatRateDate } from "@/app/currency/money";
import { poFx } from "@/app/currency/poFx";
import { RATE_PROVIDER, RATE_TYPE_LABEL } from "@/app/currency/rates";
import { CurrencyCodeCell } from "./CurrencyCodeCell";
import { BaseMoney } from "./Money";
import { CurrencyBlock, blockRateText } from "./CurrencyBlock";
import { poReceivingDocs, type ReceivingDoc } from "./receivingDocs";

/* ── Receiving Docs tab (Currency Touchpoints Map, Receiving 1–2) ──────
 * Receiving Doc | Currency | Completed | Value: each doc's currency (the
 * PO's, in its own column), its value in the base currency with the rate
 * hover, its rate ("Rate 1 USD =
 * ₨278.5200 PKR · receiving date") and its lock. A doc in progress takes
 * today's rate and is unlocked; a completed one is locked at its completion
 * day's rate. Opening a row shows what was received and the currency block:
 * "Received so far / Base value / Rate · today" (in progress) or
 * "Received / Base value / Rate · Nov 20, 2026" (completed). The docs are
 * read from the PO's receiving data (receivingDocs.ts). */

// Receiving Doc | Currency (fits "United Arab Emirates Dirham") | Completed | Value
const COLS = "minmax(0,1fr) 264px 200px 180px";

const COL_HEADER: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  lineHeight: "16px",
  fontFamily: FONT,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "#64748B",
};

function lockTitle(doc: ReceivingDoc): string {
  return doc.status === "completed"
    ? `Locked when the receiving completed on ${formatRateDate(doc.date)}`
    : "Locks when the receiving is completed";
}

function rateTypeTip(doc: ReceivingDoc): string {
  const type = RATE_TYPE_LABEL[doc.fx.rateType].toLowerCase();
  const source = doc.fx.rateType === "mid" ? ` · ${RATE_PROVIDER}` : "";
  return doc.status === "completed"
    ? `The ${type} rate on ${formatRateDate(doc.date)}, the receiving date${source}. The rate type follows the PO; nobody changes it by hand.`
    : `Today's ${type} rate${source}. The rate type follows the PO.`;
}

function DocRow({ doc, isBase, open, onToggle }: { doc: ReceivingDoc; isBase: boolean; open: boolean; onToggle: () => void }) {
  const completed = doc.status === "completed";
  const units = doc.lines.reduce((s, l) => s + l.qty, 0);
  return (
    <div className="border-b border-border last:border-b-0">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className="grid items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-slate-50/70 focus-visible:outline-none focus-visible:bg-slate-50"
        style={{ gridTemplateColumns: COLS }}
      >
        {/* Receiving Doc */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ChevronRight
              className="w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150"
              style={{ transform: open ? "rotate(90deg)" : "none" }}
            />
            <span className="text-slate-900 tabular-nums" style={{ fontSize: 13, fontWeight: 600, lineHeight: "18px" }}>
              {doc.number}
            </span>
          </div>
          <p className="mt-0.5 pl-[22px] text-[11px] text-slate-500 tabular-nums truncate">
            {isBase
              ? `${doc.lines.length} line${doc.lines.length === 1 ? "" : "s"} · ${units.toLocaleString()} unit${units === 1 ? "" : "s"}`
              : <>Rate {blockRateText(doc.currency, doc.fx.rate)} · {completed ? "receiving date" : "today"}</>}
          </p>
        </div>

        {/* Currency — the PO's, base currency included. */}
        <div className="min-w-0">
          <span className="inline-flex whitespace-nowrap max-w-full" style={{ fontSize: 13, lineHeight: "18px" }}>
            <CurrencyCodeCell code={doc.currency} title="The PO's currency. Values show in the base currency." />
          </span>
        </div>

        {/* Completed */}
        <div className="flex items-center gap-2 min-w-0">
          {completed ? (
            <span className="text-slate-700 tabular-nums whitespace-nowrap" style={{ fontSize: 12.5, fontWeight: 500 }}>
              {formatRateDate(doc.date)}
            </span>
          ) : (
            <span className="min-w-0">
              <span className="block text-slate-500 whitespace-nowrap" style={{ fontSize: 12.5, fontWeight: 500 }}>In progress</span>
              <span className="block text-slate-400 tabular-nums whitespace-nowrap" style={{ fontSize: 10.5 }}>
                Started {formatRateDate(doc.date)}
              </span>
            </span>
          )}

        </div>

        {/* Value */}
        <div className="text-right">
          <span className="text-slate-900 tabular-nums" style={{ fontSize: 13, fontWeight: 600 }}>
            <BaseMoney value={doc.value} currency={doc.currency} fx={doc.fx} dateLabel="receiving date" role="Vendor currency" />
          </span>
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 pl-[38px] flex flex-col lg:flex-row gap-4">
          {/* What was received */}
          <div className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div
              className="grid items-center gap-3 px-3 py-1.5 border-b border-slate-100"
              style={{ gridTemplateColumns: "minmax(0,1fr) 90px 150px", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)" }}
            >
              <span style={COL_HEADER}>Item</span>
              <span style={{ ...COL_HEADER, textAlign: "right" }}>Received</span>
              <span style={{ ...COL_HEADER, textAlign: "right" }}>Value</span>
            </div>
            {doc.lines.map((l) => (
              <div
                key={l.lineItemId}
                className="grid items-center gap-3 px-3 py-2 border-b border-slate-100 last:border-b-0"
                style={{ gridTemplateColumns: "minmax(0,1fr) 90px 150px" }}
              >
                <div className="min-w-0">
                  <p className="text-slate-800 truncate" style={{ fontSize: 12, fontWeight: 600 }}>{l.itemNumber}</p>
                  <p className="text-slate-500 truncate" style={{ fontSize: 11 }}>{l.descriptiveName}</p>
                </div>
                <p className="text-right text-slate-700 tabular-nums" style={{ fontSize: 12 }}>
                  {l.qty.toLocaleString()} <span className="text-slate-400">{l.uom}</span>
                </p>
                <p className="text-right text-slate-700 tabular-nums" style={{ fontSize: 12, fontWeight: 500 }}>
                  <BaseMoney value={l.value} currency={doc.currency} fx={doc.fx} dateLabel="receiving date" role="Vendor currency" />
                </p>
              </div>
            ))}
          </div>

          {/* The currency block */}
          <div className="w-full lg:w-[300px] shrink-0 rounded-lg border border-slate-200 bg-white px-3.5 py-3">
            <CurrencyBlock
              isBase={isBase}
              rateType={doc.fx.rateType}
              rateTypeTip={rateTypeTip(doc)}
              lock={{ locked: completed, title: lockTitle(doc) }}
              rows={[
                { label: completed ? "Received" : "Received so far", code: doc.currency, amount: doc.value },
                { label: "Base value", code: BASE_CURRENCY, amount: doc.baseValue },
              ]}
              rate={{ code: doc.currency, rate: doc.fx.rate, qualifier: completed ? formatRateDate(doc.date) : "today" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function POReceivingDocsTab({ po }: { po: PurchaseOrderData }) {
  const docs = React.useMemo(() => poReceivingDocs(po), [po]);
  const fx = poFx(po);
  const [openKeys, setOpenKeys] = React.useState<Set<string>>(() => new Set(docs.length === 1 ? [docs[0].key] : []));
  const toggle = (key: string) =>
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const totalBase = docs.reduce((s, d) => s + d.baseValue, 0);
  const inProgress = docs.filter((d) => d.status !== "completed").length;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ fontFamily: FONT }}>
      {/* Header — the Line Items card recipe: icon tile, title, counter chips. */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/8 shrink-0">
            <ClipboardCheck className="size-3.5 text-primary" />
          </div>
          <span className="text-foreground" style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35 }}>Receiving Docs</span>
          <span
            className="inline-flex items-center rounded-md tabular-nums"
            style={{ padding: "1px 6px", backgroundColor: "#F1F5F9", color: "#475569", fontSize: 10, fontWeight: 600, lineHeight: 1.4 }}
          >
            {docs.length} {docs.length === 1 ? "doc" : "docs"}
          </span>
          {inProgress > 0 && (
            <span
              className="inline-flex items-center rounded-md tabular-nums"
              style={{ padding: "1px 6px", backgroundColor: "#FFFBEB", color: "#92400E", fontSize: 10, fontWeight: 600, lineHeight: 1.4 }}
            >
              {inProgress} in progress
            </span>
          )}
        </div>
        <span className="text-slate-500 truncate" style={{ fontSize: 11 }}>
          {fx.isBase
            ? `Valued in ${BASE_CURRENCY}, the base currency`
            : `Valued in ${BASE_CURRENCY} at each receiving date's ${RATE_TYPE_LABEL[fx.rateType].toLowerCase()} rate`}
        </span>
      </div>

      {docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center px-6 py-16">
          <div className="w-12 h-12 rounded-xl border border-border bg-slate-50 flex items-center justify-center mb-3">
            <PackageOpen className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-slate-700" style={{ fontSize: 14, fontWeight: 600 }}>Nothing received yet</p>
          <p className="text-slate-400 mt-1 max-w-sm leading-relaxed" style={{ fontSize: 12.5 }}>
            Each receiving doc shows here with its value in {BASE_CURRENCY}, at the rate on its receiving date.
          </p>
        </div>
      ) : (
        <>
          <div
            className="grid items-center gap-3 px-4 py-2 border-b border-border"
            style={{ gridTemplateColumns: COLS, backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)" }}
          >
            <span style={{ ...COL_HEADER, paddingLeft: 22 }}>Receiving Doc</span>
            <span style={COL_HEADER}>Currency</span>
            <span style={COL_HEADER}>Completed</span>
            <span style={{ ...COL_HEADER, textAlign: "right" }}>Value</span>
          </div>
          {docs.map((doc) => (
            <DocRow key={doc.key} doc={doc} isBase={fx.isBase} open={openKeys.has(doc.key)} onToggle={() => toggle(doc.key)} />
          ))}
          {docs.length > 1 && (
            <div className="grid items-center gap-3 px-4 py-2.5 border-t border-border bg-slate-50/60" style={{ gridTemplateColumns: COLS }}>
              <span className="text-slate-500" style={{ fontSize: 12, fontWeight: 500, paddingLeft: 22 }}>Total received value</span>
              <span />
              <span />
              <span className="text-right text-slate-900 tabular-nums" style={{ fontSize: 13, fontWeight: 700 }}>
                {formatMoney(totalBase, BASE_CURRENCY)}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
