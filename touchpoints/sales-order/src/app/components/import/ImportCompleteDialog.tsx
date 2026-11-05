import { createPortal } from "react-dom";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { RECORD_LABEL, RECORD_NOUN, RECORD_NOUN_PLURAL } from "./importSpec";

/**
 * Import Complete.
 *
 * A direct port of the User Access Control completion dialog: same
 * AnimatePresence backdrop and spring card, same radial-green header with
 * the 64px tile and a 36px CheckCircle2, same 20px/700 title, same 2×2
 * grid of summary cards, same green primary over a slate secondary.
 *
 * Its interactions are ported too, not just its looks. A summary card is
 * only a button when its count is above zero, and then it lifts and takes
 * a blue border tint on hover and carries an aria-label naming where it
 * goes. The primary button takes autoFocus so the keyboard lands on the
 * useful exit. The secondary label is overridable, because the same dialog
 * ends both a fresh import and a re-run of a corrected file.
 *
 * The counts are records rather than spreadsheet rows, which is the one
 * place our data model shows through: "2 quotes created" is the useful
 * number, not the nine rows those quotes occupied in the file.
 */
export function ImportCompleteDialog({
  createdCount,
  skippedCount,
  failedCount,
  warningCount,
  onGoToListing,
  onViewHistory,
  onViewDetail,
  historyLabel = "View Import History",
  financials,
}: {
  createdCount: number;
  skippedCount: number;
  failedCount: number;
  warningCount: number;
  onGoToListing: () => void;
  onViewHistory: () => void;
  /** Deep-link into this run's detail page on a given filter. */
  onViewDetail?: (filter: "imported" | "failed") => void;
  historyLabel?: string;
  /** What the run did to the books. UAC has no money to report, so it has
   *  no equivalent panel; here the whole point of importing a batch of
   *  records is the value that lands with them, and the person who just
   *  imported forty legacy records should not have to open forty of them
   *  to find out. Omitted (and the panel hidden) when nothing landed. */
  financials?: {
    /** Line subtotals across every record created. */
    subtotal: number;
    /** Net of the one-time discounts and premiums the file carried. */
    adjustments: number;
    /** Line count across every record created. */
    lineCount: number;
    /** Biggest single record in the batch, for a sense of the spread. */
    largest?: { label: string; value: number };
    /** Value held back with the rows that failed, so the gap is visible. */
    heldBack?: number;
  };
}) {
  const view = (filter: "imported" | "failed") =>
    onViewDetail ? () => onViewDetail(filter) : undefined;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="complete-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 bg-black/50"
        style={{ zIndex: 12500 }}
      />
      <div
        key="complete-wrap"
        className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
        style={{ zIndex: 12501 }}
      >
        <motion.div
          role="dialog"
          aria-labelledby="import-complete-title"
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
          className="bg-white rounded-2xl overflow-hidden pointer-events-auto w-[calc(100vw-2rem)] max-w-[460px] flex flex-col"
          style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.05)" }}
        >
          <div
            className="relative px-6 pt-8 pb-4 flex flex-col items-center"
            style={{
              background:
                "radial-gradient(120% 100% at 50% 0%, #D1FAE5 0%, rgba(209,250,229,0.4) 40%, rgba(255,255,255,0) 75%)",
            }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: "rgba(167,243,208,0.45)" }}
            >
              <CheckCircle2 className="w-9 h-9" style={{ color: "#059669" }} strokeWidth={2} />
            </div>
            <h2
              id="import-complete-title"
              className="text-foreground mt-4"
              style={{ fontSize: "20px", fontWeight: 700 }}
            >
              Import Complete
            </h2>
            <p className="text-slate-500 mt-1 text-center" style={{ fontSize: "12.5px" }}>
              Imported as version 1 and tagged Legacy Import.
            </p>
          </div>

          <div className="px-6 pb-5 pt-1 grid grid-cols-2 gap-3">
            <SummaryCard label={`${RECORD_LABEL}s Created`} count={createdCount} onClick={view("imported")} />
            <SummaryCard label={`${RECORD_LABEL}s Skipped`} count={skippedCount} onClick={view("failed")} />
            <SummaryCard label="Failed Rows" count={failedCount} onClick={view("failed")} />
            <SummaryCard label="Warnings" count={warningCount} onClick={view("imported")} />
          </div>

          {financials && createdCount > 0 && (
            /* Same card language as the counts above (slate border, white
               surface, tabular figures) so the addition reads as part of
               UAC's summary rather than a different design. */
            <div className="mx-6 mb-4 rounded-xl border border-border bg-white overflow-hidden">
              <div className="px-3.5 pt-3 pb-2.5 flex items-baseline justify-between gap-3">
                <span className="text-slate-500" style={{ fontSize: "11.5px", fontWeight: 600 }}>
                  Value imported
                </span>
                <span
                  className="text-foreground"
                  style={{ fontSize: "19px", fontWeight: 700, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}
                >
                  {fmtMoney(financials.subtotal + financials.adjustments)}
                </span>
              </div>
              <div className="px-3.5 pb-3 flex flex-col" style={{ gap: 5 }}>
                <FinRow label="Line subtotal" value={fmtMoney(financials.subtotal)} />
                {financials.adjustments !== 0 && (
                  <FinRow
                    label="One-time adjustments"
                    value={`${financials.adjustments < 0 ? "-" : "+"}${fmtMoney(Math.abs(financials.adjustments))}`}
                    tone={financials.adjustments < 0 ? "discount" : "premium"}
                  />
                )}
                <FinRow
                  label={`Line items`}
                  value={`${financials.lineCount} across ${createdCount} ${createdCount === 1 ? RECORD_NOUN : RECORD_NOUN_PLURAL}`}
                />
                {financials.largest && (
                  <FinRow label="Largest" value={`${financials.largest.label} · ${fmtMoney(financials.largest.value)}`} />
                )}
                {!!financials.heldBack && financials.heldBack > 0 && (
                  <FinRow
                    label="Held back with failed rows"
                    value={fmtMoney(financials.heldBack)}
                    tone="held"
                  />
                )}
              </div>
            </div>
          )}

          {failedCount > 0 && (
            <div className="mx-6 mb-4 px-3.5 py-2.5 rounded-lg border border-blue-200 bg-blue-50">
              <p className="text-muted-foreground leading-relaxed" style={{ fontSize: "11.5px" }}>
                <span className="text-foreground" style={{ fontWeight: 600 }}>Failed rows are kept.</span>{" "}
                Create the missing records in their own modules, then finish these from Company Setup, Data Imports.
              </p>
            </div>
          )}

          <div className="px-6 pt-2 pb-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onGoToListing}
              autoFocus
              className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white shadow-sm transition-colors cursor-pointer"
              style={{ fontSize: "14px", fontWeight: 600 }}
            >
              View {RECORD_NOUN_PLURAL.charAt(0).toUpperCase() + RECORD_NOUN_PLURAL.slice(1)} Listing
            </button>
            <button
              type="button"
              onClick={onViewHistory}
              className="w-full h-11 rounded-xl bg-slate-100 hover:bg-border text-foreground transition-colors cursor-pointer"
              style={{ fontSize: "14px", fontWeight: 600 }}
            >
              {historyLabel}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body,
  );
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function FinRow({ label, value, tone }: { label: string; value: string; tone?: "discount" | "premium" | "held" }) {
  const color =
    tone === "discount" ? "text-emerald-700" : tone === "premium" ? "text-violet-700" : tone === "held" ? "text-slate-500" : "text-foreground";
  return (
    <div className="flex items-baseline justify-between gap-3 min-w-0">
      <span className="text-slate-500 truncate" style={{ fontSize: "11.5px" }}>{label}</span>
      <span className={`${color} shrink-0`} style={{ fontSize: "11.5px", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
    </div>
  );
}

function SummaryCard({
  label,
  count,
  onClick,
}: {
  label: string;
  count: number;
  onClick?: () => void;
}) {
  /* Clickable only when the count is meaningful. Same rule and the same
     lift-plus-blue-tint hover as the UAC original. */
  const isClickable = count > 0 && !!onClick;
  const body = (
    <>
      <div className="flex flex-col gap-1.5 min-w-0">
        <span className="text-slate-500" style={{ fontSize: "12.5px", fontWeight: 500 }}>
          {label}
        </span>
        <span className="text-foreground tabular-nums" style={{ fontSize: "22px", fontWeight: 600, lineHeight: 1 }}>
          {count}
        </span>
      </div>
      {isClickable && (
        <ChevronRight className="w-4 h-4 shrink-0 self-start mt-0.5" style={{ color: "var(--text-tertiary)" }} aria-hidden />
      )}
    </>
  );
  const baseClass =
    "rounded-xl border border-border bg-white px-4 py-3 flex items-start justify-between gap-2";
  if (!isClickable) return <div className={baseClass}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${count}. View on import detail page.`}
      className={`${baseClass} text-left transition-all cursor-pointer hover:shadow-md hover:border-primary/30`}
    >
      {body}
    </button>
  );
}
