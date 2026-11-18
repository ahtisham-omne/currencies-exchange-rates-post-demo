import type { ElementType } from "react";
import { MoreHorizontal, Layers } from "lucide-react";
import { cn } from "../ui/utils";
import { HighlightMatch } from "../alerts-settings/HighlightMatch";

export type LastImportStatus = "completed" | "inProgress" | "failed";

export interface DataImportModuleRow {
  id: string;
  slug?: string;
  title: string;
  description: string;
  icon: ElementType;
  hasTemplates?: boolean;
  importsCount?: number;
  lastImportStatus?: LastImportStatus | null;
  lastImportRelative?: string;
  /** Position among the available modules, lowest first. See moduleData. */
  order?: number;
  _category: string;
}

interface DataImportModuleTableProps {
  cards: DataImportModuleRow[];
  density: "condensed" | "comfort";
  onRowClick: (card: DataImportModuleRow) => void;
  searchQuery?: string;
  columnVisibility?: Record<string, boolean>;
}

export function DataImportModuleTable({
  cards,
  density,
  onRowClick,
  searchQuery = "",
  columnVisibility = {},
}: DataImportModuleTableProps) {
  if (cards.length === 0) return <EmptyState />;

  const showDescription = columnVisibility.description !== false;
  const showTotal = columnVisibility.total !== false;
  const showEnabled = columnVisibility.enabled !== false;
  const isComfort = density === "comfort";
  const rowPadY = isComfort ? "py-3" : "py-1";
  const headerH = isComfort ? "h-11" : "h-8";
  const iconBox = isComfort ? "w-9 h-9" : "w-7 h-7";
  const iconSize = isComfort ? "[&_svg]:!w-[18px] [&_svg]:!h-[18px]" : "[&_svg]:!w-3.5 [&_svg]:!h-3.5";

  return (
    <div className="bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className={cn("bg-[#F8FAFC] border-b border-[#CBD5E1] [&>th:first-child]:border-r [&>th:last-child]:border-l [&>th]:border-[#E2E8F0]", headerH)}>
              <Th className="pl-4 w-[40%]">Module</Th>
              {!isComfort && showDescription && <Th className="w-[36%]">Description</Th>}
              {showTotal && <Th className="w-[140px]">Total Imports</Th>}
              {showEnabled && <Th className="w-[180px]">Last Imported On</Th>}
              <Th className="w-[80px] text-right pr-4">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => {
              const Icon = card.icon;
              const disabled = !card.hasTemplates;
              return (
                <tr
                  key={card.id}
                  className={cn(
                    "border-b border-[#E2E8F0] last:border-b-0 transition-colors group [&>td:first-child]:border-r [&>td:last-child]:border-l [&>td]:border-[#E2E8F0]",
                    !disabled && "hover:bg-[#EFF6FF] cursor-pointer"
                  )}
                  onClick={() => !disabled && onRowClick(card)}
                >
                  <td className={cn("pl-4 pr-3 align-middle", rowPadY)}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn("rounded-lg flex items-center justify-center shrink-0", iconBox, iconSize)}
                        style={{ backgroundColor: "#EDF4FF" }}
                      >
                        <Icon style={{ color: "#0A77FF" }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className={cn("text-[#0F172A] truncate", disabled && "opacity-50")}
                          style={{ fontSize: "13.5px", fontWeight: 600, lineHeight: "1.35" }}
                        >
                          <HighlightMatch text={card.title} query={searchQuery} matchClassName="bg-[#FEF3C7] text-[#B45309] rounded-sm px-0.5" />
                        </div>
                        {isComfort && showDescription && (
                          <div
                            className={cn("text-[#64748B] mt-0.5 truncate", disabled && "opacity-50")}
                            style={{ fontSize: "12.5px", fontWeight: 400, lineHeight: "1.45" }}
                          >
                            <HighlightMatch text={card.description} query={searchQuery} matchClassName="bg-[#FEF3C7] text-[#B45309] rounded-sm px-0.5" />
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {!isComfort && showDescription && (
                    <td className={cn("px-3 align-middle", rowPadY)}>
                      <div
                        className={cn("text-[#64748B] truncate max-w-[480px]", disabled && "opacity-50")}
                        style={{ fontSize: "13px", fontWeight: 400, lineHeight: "1.45" }}
                        title={card.description}
                      >
                        <HighlightMatch text={card.description} query={searchQuery} matchClassName="bg-[#FEF3C7] text-[#B45309] rounded-sm px-0.5" />
                      </div>
                    </td>
                  )}

                  {showTotal && (
                    <td className={cn("px-3 align-middle", rowPadY)}>
                      <span
                        className={cn("inline-flex items-center text-[#0F172A] tabular-nums", disabled && "text-[#94A3B8]")}
                        style={{ fontSize: "13px", fontWeight: 500 }}
                      >
                        {disabled ? "-" : (card.importsCount ?? 0)}
                      </span>
                    </td>
                  )}

                  {showEnabled && (
                    <td className={cn("px-3 align-middle", rowPadY)}>
                      {disabled ? (
                        <span className="text-[#94A3B8]" style={{ fontSize: "12px", fontWeight: 500 }}>
                          Coming soon
                        </span>
                      ) : card.lastImportRelative && card.lastImportStatus ? (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]"
                          style={{ fontSize: "11px", fontWeight: 500 }}
                        >
                          {card.lastImportRelative}
                        </span>
                      ) : (
                        <span className="text-[#94A3B8]" style={{ fontSize: "11.5px", fontWeight: 500 }}>
                          No Imports Yet
                        </span>
                      )}
                    </td>
                  )}

                  <td className={cn("pl-2 pr-4 align-middle text-right", rowPadY)}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!disabled) onRowClick(card);
                      }}
                      className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[#64748B] hover:bg-white hover:text-[#0F172A] transition-colors"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn("text-left align-middle px-3 first:pl-4 whitespace-nowrap", className)}
      style={{
        fontSize: "13px",
        fontWeight: 500,
        color: "#334155",
        lineHeight: "1.2",
      }}
    >
      {children}
    </th>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-5">
        <Layers className="w-6 h-6 text-gray-300" />
      </div>
      <p className="text-gray-500" style={{ fontSize: "15px", fontWeight: 500 }}>
        No Modules Match Your Search.
      </p>
      <p className="text-gray-400 mt-1.5 max-w-sm" style={{ fontSize: "13px" }}>
        Try a different search or category.
      </p>
    </div>
  );
}
