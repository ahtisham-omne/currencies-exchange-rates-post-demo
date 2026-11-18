/**
 * Expand-to-full-width toggle shared by the Data Imports pages (landing,
 * module page, import record pages). Same bordered 36px square and tooltip as
 * the one the Data Imports landing header introduced. The choice is kept for
 * the session so moving between import pages doesn't snap the width back.
 */
import { useCallback, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

const STORAGE_KEY = "omne.dataImports.expanded";
export const DATA_IMPORTS_MAX_WIDTH = "1400px";
export const WIDTH_TRANSITION_CLASS = "mx-auto w-full transition-[max-width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]";

function readExpanded(): boolean {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function useExpandedWidth() {
  const [isExpanded, setIsExpandedState] = useState(readExpanded);
  const setIsExpanded = useCallback((next: boolean | ((v: boolean) => boolean)) => {
    setIsExpandedState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      try { window.sessionStorage.setItem(STORAGE_KEY, value ? "1" : "0"); } catch { /* storage blocked */ }
      return value;
    });
  }, []);
  const containerMaxWidth = isExpanded ? "100%" : DATA_IMPORTS_MAX_WIDTH;
  return { isExpanded, setIsExpanded, containerMaxWidth };
}

export function ExpandWidthButton({ isExpanded, onToggle }: { isExpanded: boolean; onToggle: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onToggle}
          aria-label={isExpanded ? "Collapse width" : "Expand to full width"}
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-[#E2E8F0] bg-white shadow-sm hover:bg-slate-50 cursor-pointer transition-colors shrink-0"
        >
          {isExpanded ? <Minimize2 className="w-4 h-4 text-slate-500" /> : <Maximize2 className="w-4 h-4 text-slate-500" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-[12px]">
        {isExpanded ? "Collapse to default width" : "Expand to full width"}
      </TooltipContent>
    </Tooltip>
  );
}
