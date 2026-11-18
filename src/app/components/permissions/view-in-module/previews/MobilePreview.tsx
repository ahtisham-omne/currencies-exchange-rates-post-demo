import { cn } from "../../../ui/utils";
import { OMNE_BLUE, OMNE_BLUE_LIGHT } from "../types";
import type { MobilePreviewData } from "../types";

interface MobilePreviewProps {
  data: MobilePreviewData;
  isOn: boolean;
  path: string;
}

export function MobilePreview({ data, isOn, path }: MobilePreviewProps) {
  return (
    <div className="space-y-3">
      {/* Phone frame */}
      <div className="flex justify-center">
        <div className="w-[220px] rounded-[24px] border-[3px] border-gray-300 bg-white overflow-hidden shadow-sm">
          {/* Status bar */}
          <div className="flex items-center justify-between px-4 py-1.5 bg-gray-50">
            <span className="text-[9px] text-gray-400 font-medium">9:41</span>
            <div className="flex items-center gap-1">
              <div className="w-3 h-1.5 rounded-sm bg-gray-300" />
              <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
            </div>
          </div>

          {/* App header */}
          <div
            className="px-4 py-2.5 text-white text-[12px] font-semibold"
            style={{ backgroundColor: OMNE_BLUE }}
          >
            {data.appName}
          </div>

          {/* Screen elements */}
          <div className="px-3 py-3 space-y-2 min-h-[180px]">
            {data.screenElements.map((el, i) => {
              const isHidden = !isOn && el.highlighted && el.offState === "hidden";
              const isDisabled = !isOn && el.highlighted && el.offState === "disabled";

              if (isHidden) {
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-[8px] border border-dashed border-amber-300 bg-amber-50/50 px-3 py-2"
                  >
                    <span className="text-[10px] text-amber-600 font-medium line-through">
                      {el.label}
                    </span>
                    <span className="text-[8px] text-amber-500 font-medium">
                      Hidden
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-center justify-between rounded-[8px] border px-3 py-2",
                    isOn && el.highlighted
                      ? "border-2"
                      : isDisabled
                      ? "border-gray-100 bg-gray-50 opacity-50"
                      : "border-gray-200 bg-white"
                  )}
                  style={
                    isOn && el.highlighted
                      ? {
                          borderColor: OMNE_BLUE,
                          backgroundColor: OMNE_BLUE_LIGHT,
                        }
                      : undefined
                  }
                >
                  <span
                    className={cn(
                      "text-[11px] font-medium",
                      isOn && el.highlighted ? "" : "text-gray-700"
                    )}
                    style={isOn && el.highlighted ? { color: OMNE_BLUE } : undefined}
                  >
                    {el.label}
                  </span>
                  {isOn && el.highlighted && (
                    <span
                      className="inline-flex items-center rounded px-1 py-px text-[7px] font-bold tracking-wide text-white"
                      style={{ backgroundColor: OMNE_BLUE }}
                    >
                      ACTIVE
                    </span>
                  )}
                  {isDisabled && (
                    <span className="text-[8px] text-gray-400 font-medium">
                      Disabled
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom bar */}
          <div className="flex items-center justify-around px-4 py-2 border-t border-gray-100 bg-gray-50">
            <div className="w-5 h-0.5 rounded bg-gray-300" />
            <div className="w-5 h-0.5 rounded bg-gray-300" />
            <div className="w-5 h-0.5 rounded bg-gray-300" />
          </div>
        </div>
      </div>

      {/* Path */}
      <div className="flex items-center justify-center gap-1 flex-wrap pt-1">
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
