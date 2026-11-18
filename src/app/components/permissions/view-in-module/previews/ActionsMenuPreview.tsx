import { MoreHorizontal } from "lucide-react";
import { cn } from "../../../ui/utils";
import { OMNE_BLUE, OMNE_BLUE_LIGHT } from "../types";
import type { ActionsMenuPreviewData } from "../types";

interface ActionsMenuPreviewProps {
  data: ActionsMenuPreviewData;
  isOn: boolean;
  path: string;
}

export function ActionsMenuPreview({ data, isOn, path }: ActionsMenuPreviewProps) {
  const visibleActions = isOn
    ? data.actions
    : data.actions.filter((a) => !a.highlighted);

  const hiddenActions = data.actions.filter((a) => a.highlighted);

  return (
    <div className="space-y-3">
      {/* Context label */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-t-md border border-gray-200">
        <MoreHorizontal size={14} className="text-gray-400" />
        <span className="text-[11px] font-semibold text-gray-600">
          {data.contextLabel}
        </span>
      </div>

      {/* Actions menu */}
      <div className="rounded-b-md border border-t-0 border-gray-200 overflow-hidden divide-y divide-gray-100">
        {isOn
          ? data.actions.map((action, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center justify-between px-3 py-2",
                  action.highlighted && "border-l-2"
                )}
                style={
                  action.highlighted
                    ? {
                        backgroundColor: OMNE_BLUE_LIGHT,
                        borderLeftColor: OMNE_BLUE,
                      }
                    : undefined
                }
              >
                <span
                  className={cn(
                    "text-[11px] font-medium",
                    action.isDestructive
                      ? "text-red-600"
                      : action.highlighted
                      ? ""
                      : "text-gray-700"
                  )}
                  style={
                    action.highlighted && !action.isDestructive
                      ? { color: OMNE_BLUE }
                      : undefined
                  }
                >
                  {action.label}
                </span>
                {action.highlighted && (
                  <span
                    className="inline-flex items-center rounded px-1 py-px text-[8px] font-bold tracking-wide text-white"
                    style={{ backgroundColor: OMNE_BLUE }}
                  >
                    ACTIVE
                  </span>
                )}
              </div>
            ))
          : (
            <>
              {visibleActions.map((action, i) => (
                <div key={i} className="flex items-center px-3 py-2">
                  <span
                    className={cn(
                      "text-[11px] font-medium",
                      action.isDestructive ? "text-red-600" : "text-gray-700"
                    )}
                  >
                    {action.label}
                  </span>
                </div>
              ))}
              {hiddenActions.map((action, i) => (
                <div
                  key={`h-${i}`}
                  className="flex items-center justify-between px-3 py-2 bg-amber-50/50 border-l-2 border-l-amber-300"
                >
                  <span className="text-[11px] text-amber-600 font-medium line-through">
                    {action.label}
                  </span>
                  <span className="text-[9px] text-amber-500 font-medium">
                    Hidden
                  </span>
                </div>
              ))}
            </>
          )}
      </div>

      {/* Annotation */}
      {data.annotationText && !isOn && (
        <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2">
          <span className="text-amber-500 text-[11px]">⚠</span>
          <span className="text-[11px] text-amber-700 leading-relaxed">
            {data.annotationText}
          </span>
        </div>
      )}

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
