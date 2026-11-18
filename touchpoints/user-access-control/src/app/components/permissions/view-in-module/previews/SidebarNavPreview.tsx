import { cn } from "../../../ui/utils";
import { OMNE_BLUE, OMNE_BLUE_LIGHT } from "../types";
import type { SidebarNavPreviewData } from "../types";

interface SidebarNavPreviewProps {
  data: SidebarNavPreviewData;
  isOn: boolean;
  path: string;
}

export function SidebarNavPreview({ data, isOn, path }: SidebarNavPreviewProps) {
  const entries = isOn
    ? data.moduleEntries
    : data.moduleEntries.filter((e) => !e.isTarget);

  const removedEntry = data.moduleEntries.find((e) => e.isTarget);

  return (
    <div className="space-y-3">
      <div className="flex rounded-md border border-gray-200 overflow-hidden min-h-[200px]">
        {/* Sidebar */}
        <div className="w-[180px] shrink-0 bg-gray-50 border-r border-gray-200 py-2">
          <div className="px-3 pb-2 mb-1 border-b border-gray-200">
            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
              Modules
            </span>
          </div>
          <div className="space-y-0.5 px-1">
            {entries.map((entry, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2 rounded px-2 py-1.5 text-[11px] font-medium transition-colors",
                  isOn && entry.isTarget
                    ? "text-white"
                    : "text-gray-600 hover:bg-gray-100"
                )}
                style={
                  isOn && entry.isTarget
                    ? { backgroundColor: OMNE_BLUE }
                    : undefined
                }
              >
                <div
                  className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    isOn && entry.isTarget ? "bg-white/60" : "bg-gray-300"
                  )}
                />
                {entry.label}
              </div>
            ))}
            {!isOn && removedEntry && (
              <div className="flex items-center gap-2 rounded px-2 py-1.5 border border-dashed border-amber-300 bg-amber-50/50">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-300 shrink-0" />
                <span className="text-[10px] text-amber-600 font-medium line-through">
                  {removedEntry.label}
                </span>
                <span className="text-[9px] text-amber-500 ml-auto">Removed</span>
              </div>
            )}
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 p-4 flex flex-col items-center justify-center">
          {isOn ? (
            <div className="text-center space-y-2">
              <div
                className="w-10 h-10 rounded-[8px] flex items-center justify-center mx-auto"
                style={{ backgroundColor: OMNE_BLUE_LIGHT }}
              >
                <div
                  className="w-5 h-5 rounded"
                  style={{ backgroundColor: OMNE_BLUE, opacity: 0.3 }}
                />
              </div>
              <p className="text-[12px] font-semibold text-gray-700">
                {data.pageTitle}
              </p>
              <p className="text-[10px] text-gray-400">
                Module content loads here
              </p>
            </div>
          ) : (
            <div className="text-center space-y-2">
              <div className="w-10 h-10 rounded-[8px] bg-gray-100 flex items-center justify-center mx-auto">
                <span className="text-gray-300 text-lg">∅</span>
              </div>
              <p className="text-[11px] text-gray-400 font-medium">
                No Access
              </p>
              <p className="text-[10px] text-gray-300">
                This module is not available
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Path */}
      <div className="flex items-center gap-1 flex-wrap pt-1">
        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
          Path:
        </span>
        {path.split(" → ").map((seg, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-gray-300 text-[10px]">/</span>}
            <span className="text-[10px] text-gray-500 font-medium">{seg}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
