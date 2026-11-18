import { FileInput, Clock } from "lucide-react";
import type { ElementType, ReactNode } from "react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../ui/tooltip";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { HighlightMatch } from "../alerts-settings/HighlightMatch";
import type { DataImportModuleRow } from "./DataImportModuleTable";

interface DataImportModuleCardGridProps {
  cards: DataImportModuleRow[];
  onCardClick: (card: DataImportModuleRow) => void;
  searchQuery?: string;
  emptySectionIcon?: ElementType;
  emptySectionLabel?: string;
  /** Overrides the empty-state heading, e.g. when filters rather than the
   *  search box are what cleared the grid. */
  emptyTitle?: string;
  /** Replaces the whole empty state. Used when the selected category has no
   *  import surfaces at all, which is a different story than a search miss. */
  emptyState?: ReactNode;
}

export function DataImportModuleCardGrid({
  cards,
  onCardClick,
  searchQuery = "",
  emptySectionIcon,
  emptySectionLabel,
  emptyTitle,
  emptyState,
}: DataImportModuleCardGridProps) {
  if (cards.length === 0) {
    if (emptyState) return <>{emptyState}</>;
    const EmptyIcon = emptySectionIcon || FileInput;
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: "#F3F4F6" }}>
          <EmptyIcon className="w-8 h-8" style={{ color: "#9CA3AF" }} />
        </div>
        <h3 className="text-base text-gray-900 mb-1.5 text-center" style={{ fontWeight: 600 }}>
          {emptyTitle || "No Modules Match Your Search."}
        </h3>
        <p className="text-sm text-gray-500 max-w-sm text-center leading-relaxed">
          {emptySectionLabel || "Try a different search or category."}
        </p>
      </div>
    );
  }

  const sorted = [...cards].sort((a, b) => {
    const aDisabled = !a.hasTemplates ? 1 : 0;
    const bDisabled = !b.hasTemplates ? 1 : 0;
    return aDisabled - bDisabled;
  });

  return (
    <TooltipProvider delayDuration={300}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sorted.map((card) => {
          const Icon = card.icon;
          const disabled = !card.hasTemplates;

          if (disabled) {
            return (
              <Tooltip key={card.id}>
                <TooltipTrigger asChild>
                  <div className="w-full text-left bg-white border border-[#E2E8F0] rounded-xl p-5 cursor-default select-none flex flex-col shadow-[0_1px_2px_0_rgba(15,23,42,0.05),0_1px_3px_-1px_rgba(15,23,42,0.04)]">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 bg-gray-100">
                      <Icon className="w-5 h-5 text-gray-400" />
                    </div>
                    <p className="text-[14px] mb-1 text-gray-500" style={{ fontWeight: 600 }}>
                      <HighlightMatch text={card.title} query={searchQuery} matchClassName="bg-[#FEF3C7] text-[#B45309] rounded-sm px-0.5" />
                    </p>
                    <p className="text-[12.5px] text-gray-400 leading-relaxed flex-1">
                      <HighlightMatch text={card.description} query={searchQuery} matchClassName="bg-[#FEF3C7] text-[#B45309] rounded-sm px-0.5" />
                    </p>
                    {/* -mx-5 px-5 cancels the card's padding so the rule runs
                        edge to edge instead of floating inset. */}
                    <div className="mt-4 pt-3 -mx-5 px-5 border-t border-[#F1F5F9] text-[12px] text-gray-400">
                      Coming soon
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  sideOffset={8}
                  className="bg-white text-[#0F172A] border border-[#E2E8F0] text-[13px] px-3 py-2 rounded-lg shadow-[0_8px_24px_-8px_rgba(15,23,42,0.18),0_2px_6px_-2px_rgba(15,23,42,0.06)]"
                  style={{ fontWeight: 500 }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
                    Imports Coming Soon
                  </span>
                  <TooltipPrimitive.Arrow
                    width={14}
                    height={7}
                    style={{ fill: "#FFFFFF", stroke: "#E2E8F0", strokeWidth: 1 }}
                  />
                </TooltipContent>
              </Tooltip>
            );
          }

          const importsCount = card.importsCount ?? 0;
          const lastStatus = card.lastImportStatus ?? null;
          const lastRelative = card.lastImportRelative ?? "";
          const dotColor =
            lastStatus === "completed" ? "#10B981" :
            lastStatus === "inProgress" ? "#0A77FF" :
            lastStatus === "failed" ? "#EF4444" :
            null;

          return (
            <button
              key={card.id}
              onClick={() => onCardClick(card)}
              /* Hover fill borrows the Reading Room ("How it works") drawer
               * technique: a near-vertical 178deg three-stop wash plus the
               * drawer's white top highlight and blue bottom glow, dialled
               * right down so the card only just warms to blue. */
              className="group card-hover-wash w-full text-left bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-[0_1px_2px_0_rgba(15,23,42,0.05),0_1px_3px_-1px_rgba(15,23,42,0.04)] hover:border-[#0A77FF]/30 cursor-pointer flex flex-col"
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                style={{ backgroundColor: "#EDF4FF" }}
              >
                <Icon className="w-5 h-5" style={{ color: "#0A77FF" }} />
              </div>
              <p className="text-[14px] text-[#0F172A] mb-1" style={{ fontWeight: 600 }}>
                <HighlightMatch text={card.title} query={searchQuery} matchClassName="bg-[#FEF3C7] text-[#B45309] rounded-sm px-0.5" />
              </p>
              <p className="text-[12.5px] text-[#64748B] leading-relaxed flex-1">
                <HighlightMatch text={card.description} query={searchQuery} matchClassName="bg-[#FEF3C7] text-[#B45309] rounded-sm px-0.5" />
              </p>
              {/* -mx-5 px-5 cancels the card's padding so the rule runs edge
                  to edge instead of floating inset. */}
              <div className="mt-4 pt-3 -mx-5 px-5 border-t border-[#F1F5F9] flex items-center justify-between">
                <span className="text-[12px] text-[#64748B]" style={{ fontWeight: 400 }}>
                  {importsCount} {importsCount === 1 ? "import" : "imports"}
                </span>
                {importsCount === 0 || !dotColor ? (
                  <span
                    className="text-[#94A3B8]"
                    style={{ fontSize: "11.5px", fontWeight: 500 }}
                  >
                    No Imports Yet
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-[6px] bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]"
                    style={{ fontSize: "11px", fontWeight: 500 }}
                  >
                    {lastRelative}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
