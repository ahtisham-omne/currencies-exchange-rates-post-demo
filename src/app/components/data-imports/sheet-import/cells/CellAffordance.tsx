import { CalendarDays, ChevronDown, ChevronRight } from "lucide-react";
import type { SheetColumn } from "../sheetSpec";

/* What this cell opens, shown before it is clicked: a picker (chevron), a
   closed list (caret) or a date (calendar). Matches the affordances the Quote
   and Sales Order review sheets put on their cells. */
export function CellAffordance({ column }: { column: SheetColumn }) {
  const style = { width: 12, height: 12, flexShrink: 0 } as const;
  if (column.catalog) return <ChevronRight className="text-[#CBD5E1] group-hover/cell:text-[#0A77FF] transition-colors" style={style} />;
  if (column.set) return <ChevronDown className="text-[#CBD5E1] group-hover/cell:text-[#0A77FF] transition-colors" style={style} />;
  if (column.kind === "date") return <CalendarDays className="text-[#CBD5E1] group-hover/cell:text-[#0A77FF] transition-colors" style={style} />;
  return null;
}
