import { Lock } from "lucide-react";
import { cn } from "../../../ui/utils";
import { OMNE_BLUE, OMNE_BLUE_LIGHT, OMNE_BLUE_BORDER } from "../types";
import type { DetailPreviewData } from "../types";

interface DetailPreviewProps {
  data: DetailPreviewData;
  isOn: boolean;
  path: string;
}

export function DetailPreview({ data, isOn, path }: DetailPreviewProps) {
  return (
    <div className="space-y-3">
      {/* Mini detail header */}
      <div className="flex items-center justify-between rounded-t-md bg-gray-50 border border-gray-200 px-3 py-2">
        <span className="text-[12px] font-semibold text-gray-800">
          {data.headerTitle}
        </span>
        {data.actionButtons && (
          <div className="flex items-center gap-1.5">
            {isOn
              ? data.actionButtons.map((btn, i) => (
                  <span
                    key={i}
                    className={cn(
                      "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium",
                      btn.highlighted
                        ? "text-white"
                        : "bg-gray-100 text-gray-500 border border-gray-200"
                    )}
                    style={btn.highlighted ? { backgroundColor: OMNE_BLUE } : undefined}
                  >
                    {btn.label}
                  </span>
                ))
              : data.actionButtons
                  .filter((b) => !b.highlighted)
                  .map((btn, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200"
                    >
                      {btn.label}
                    </span>
                  ))}
          </div>
        )}
      </div>

      {/* Fields */}
      <div className="rounded-b-md border border-t-0 border-gray-200 divide-y divide-gray-100 overflow-hidden">
        {data.fields.map((field, i) => {
          const isHiddenOff = !isOn && field.highlighted && field.offState === "hidden";
          const isReadonlyOff = !isOn && field.highlighted && field.offState === "readonly";
          const isDisabledOff = !isOn && field.highlighted && field.offState === "disabled";

          if (isHiddenOff) {
            return (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2 bg-amber-50/50 border-l-2 border-l-amber-300"
              >
                <span className="text-[11px] text-amber-600 font-medium">
                  {field.label}
                </span>
                <span className="inline-flex items-center gap-1 rounded border border-dashed border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] text-amber-600 font-medium">
                  Hidden
                </span>
              </div>
            );
          }

          return (
            <div
              key={i}
              className={cn(
                "flex items-center justify-between px-3 py-2",
                isOn && field.highlighted && "border-l-2",
                (isReadonlyOff || isDisabledOff) && "opacity-50"
              )}
              style={
                isOn && field.highlighted
                  ? {
                      backgroundColor: OMNE_BLUE_LIGHT,
                      borderLeftColor: OMNE_BLUE,
                    }
                  : undefined
              }
            >
              <span className="text-[11px] text-gray-500 font-medium">
                {field.label}
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "text-[11px] font-medium",
                    isOn && field.highlighted ? "" : "text-gray-700"
                  )}
                  style={isOn && field.highlighted ? { color: OMNE_BLUE } : undefined}
                >
                  {field.value}
                </span>
                {isOn && field.highlighted && (
                  <span
                    className="inline-flex items-center rounded px-1 py-px text-[8px] font-bold tracking-wide text-white"
                    style={{ backgroundColor: OMNE_BLUE }}
                  >
                    ACTIVE
                  </span>
                )}
                {isReadonlyOff && (
                  <Lock size={10} className="text-gray-400" />
                )}
                {isDisabledOff && (
                  <span className="text-[9px] text-gray-400 font-medium">Disabled</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Path */}
      <PathBreadcrumb path={path} />
    </div>
  );
}

function PathBreadcrumb({ path }: { path: string }) {
  const segments = path.split(" → ");
  return (
    <div className="flex items-center gap-1 flex-wrap pt-1">
      <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
        Path:
      </span>
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-gray-300 text-[10px]">/</span>}
          <span className="text-[10px] text-gray-500 font-medium">{seg}</span>
        </span>
      ))}
    </div>
  );
}
