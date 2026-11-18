import { Pencil, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/app/components/ui/hover-card";
import { parseAdjustmentList, adjustmentImpact, netImpact, type ParsedAdjustment } from "./importAdjustments";

/**
 * The Discount/Premium cell.
 *
 * `Expedited Build:+4500|Grant Discount:-2%` is the file's notation, not
 * something to read in a grid, so the cell shows what the module shows
 * everywhere else: a chip per adjustment, green for a discount, violet
 * for a premium, the same semantic pair the adjustment form uses. Two
 * chips fit; the rest collapse into a count, and the hover card lists
 * them all with the dollar impact each one resolves to.
 *
 * Editing is a pencil, revealed on row hover, the affordance Partners
 * uses for every editable detail field. Empty cells get a quiet "Add"
 * instead, because a legacy file usually leaves these blank and the
 * person reviewing needs an obvious way in.
 */

const TONE = {
  discount: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700" },
  premium: { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700" },
} as const;

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function Chip({ adj }: { adj: ParsedAdjustment }) {
  const tone = TONE[adj.type];
  const Icon = adj.type === "discount" ? TrendingDown : TrendingUp;
  return (
    <span
      className={`inline-flex items-center gap-1 h-[20px] px-1.5 rounded-md border ${tone.bg} ${tone.border} ${tone.text}`}
      style={{ fontSize: "10.5px", fontWeight: 600, maxWidth: 132 }}
    >
      <Icon style={{ width: 10, height: 10 }} strokeWidth={2.5} />
      <span className="truncate">{adj.label}</span>
      <span className="shrink-0 opacity-80">
        {adj.type === "discount" ? "-" : "+"}
        {adj.amountType === "%" ? `${adj.amount}%` : fmtMoney(adj.amount)}
      </span>
    </span>
  );
}

export function AdjustmentCell({
  raw,
  base,
  onEdit,
  disabled = false,
}: {
  raw: string | undefined;
  /** Subtotal the percentages resolve against, for the hover card. */
  base: number;
  onEdit: () => void;
  disabled?: boolean;
}) {
  const list = parseAdjustmentList(raw);

  if (list.length === 0) {
    return (
      <div className="px-3 py-2">
        <button
          type="button"
          disabled={disabled}
          onClick={onEdit}
          className="group/adj inline-flex items-center gap-1 h-6 px-1.5 -ml-1.5 rounded-md text-slate-400 hover:text-primary hover:bg-accent transition-colors cursor-pointer disabled:cursor-not-allowed"
          style={{ fontSize: "11.5px", fontWeight: 500 }}
        >
          <Plus style={{ width: 11, height: 11 }} strokeWidth={2.5} />
          Add
        </button>
      </div>
    );
  }

  const shown = list.slice(0, 2);
  const rest = list.length - shown.length;
  const net = netImpact(list, base);

  return (
    <div className="px-3 py-2 flex items-start gap-1.5">
      <HoverCard openDelay={150} closeDelay={80}>
        <HoverCardTrigger asChild>
          <span className="flex flex-wrap items-center gap-1 min-w-0" style={{ cursor: "help" }}>
            {shown.map((a, i) => <Chip key={i} adj={a} />)}
            {rest > 0 && (
              <span
                className="inline-flex items-center h-[20px] px-1.5 rounded-md border border-border bg-slate-50 text-slate-600"
                style={{ fontSize: "10.5px", fontWeight: 600 }}
              >
                +{rest}
              </span>
            )}
          </span>
        </HoverCardTrigger>

        <HoverCardContent
          side="bottom"
          align="start"
          sideOffset={8}
          className="w-[260px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[12500]"
        >
          <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-2.5">
            <p className="text-[12px] text-white" style={{ fontWeight: 600, letterSpacing: "0.01em" }}>
              One-time adjustments
            </p>
          </div>
          <div className="bg-white px-3.5 py-3 flex flex-col" style={{ gap: 7 }}>
            {list.map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-3 min-w-0">
                <span className="text-[11.5px] text-slate-600 truncate">{a.label}</span>
                <span
                  className={`text-[11.5px] shrink-0 ${a.type === "discount" ? "text-emerald-700" : "text-violet-700"}`}
                  style={{ fontWeight: 600 }}
                >
                  {a.type === "discount" ? "-" : "+"}
                  {a.amountType === "%" ? `${a.amount}%` : fmtMoney(a.amount)}
                  {a.amountType === "%" && base > 0 && (
                    <span className="text-slate-400" style={{ fontWeight: 500 }}>
                      {" "}({fmtMoney(Math.abs(adjustmentImpact(a, base)))})
                    </span>
                  )}
                </span>
              </div>
            ))}
            {base > 0 && (
              <div className="flex items-center justify-between gap-3 pt-2 mt-0.5 border-t border-border">
                <span className="text-[11px] text-slate-400" style={{ fontWeight: 600 }}>Net</span>
                <span className="text-[11.5px] text-foreground" style={{ fontWeight: 600 }}>
                  {net < 0 ? "-" : "+"}{fmtMoney(Math.abs(net))}
                </span>
              </div>
            )}
          </div>
        </HoverCardContent>
      </HoverCard>

      <button
        type="button"
        disabled={disabled}
        onClick={onEdit}
        aria-label="Edit adjustments"
        className="shrink-0 mt-[1px] w-5 h-5 rounded-md flex items-center justify-center text-slate-400 opacity-0 group-hover/row:opacity-100 focus:opacity-100 hover:text-primary hover:bg-accent transition-all cursor-pointer disabled:cursor-not-allowed"
      >
        <Pencil style={{ width: 11, height: 11 }} strokeWidth={2.25} />
      </button>
    </div>
  );
}
