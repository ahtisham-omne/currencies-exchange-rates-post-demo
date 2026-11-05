/**
 * LotPill — small neutral pill rendered next to Inventory Control values
 * when an item has lotControl === true.
 *
 * Visual: subtle slate token chip. Designed to be scannable but not loud.
 */
export function LotPill() {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[10px] whitespace-nowrap shrink-0"
      style={{ fontWeight: 500 }}
    >
      Lot
    </span>
  );
}