import { cn } from "../../../ui/utils";
import { OMNE_BLUE, OMNE_BLUE_LIGHT, OMNE_BLUE_BORDER } from "../types";
import type { ListingPreviewData } from "../types";

interface ListingPreviewProps {
  data: ListingPreviewData;
  isOn: boolean;
  path: string;
}

function ActiveBadge() {
  return (
    <span
      className="ml-1.5 inline-flex items-center rounded px-1 py-px text-[9px] font-bold tracking-wide text-white"
      style={{ backgroundColor: OMNE_BLUE }}
    >
      ACTIVE
    </span>
  );
}

function HiddenSlot({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-dashed border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-600 font-medium">
      {label}: Hidden
    </span>
  );
}

export function ListingPreview({ data, isOn, path }: ListingPreviewProps) {
  const visibleButtons = isOn
    ? data.toolbarButtons
    : data.toolbarButtons.filter((b) => !b.highlighted);

  const visibleColumns = isOn
    ? data.columns
    : data.columns.filter((c) => !c.highlighted);

  const hiddenColumns = data.columns.filter((c) => c.highlighted);

  return (
    <div className="space-y-3">
      {/* Mini toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {isOn
          ? data.toolbarButtons.map((btn, i) => (
              <span
                key={i}
                className={cn(
                  "inline-flex items-center rounded px-2.5 py-1 text-[11px] font-medium",
                  btn.highlighted
                    ? "border-2 text-white"
                    : "bg-gray-100 text-gray-600 border border-gray-200"
                )}
                style={
                  btn.highlighted
                    ? { backgroundColor: OMNE_BLUE, borderColor: OMNE_BLUE }
                    : undefined
                }
              >
                {btn.label}
                {btn.highlighted && <ActiveBadge />}
              </span>
            ))
          : visibleButtons.map((btn, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded px-2.5 py-1 text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200"
              >
                {btn.label}
              </span>
            ))}
        {!isOn &&
          data.toolbarButtons
            .filter((b) => b.highlighted)
            .map((b, i) => <HiddenSlot key={`h-${i}`} label={b.label} />)}
      </div>

      {/* Mini data table */}
      <div className="rounded-md border border-gray-200 overflow-hidden">
        {/* Header */}
        <div
          className="flex bg-gray-50 border-b border-gray-200"
          style={{ fontSize: 11 }}
        >
          {visibleColumns.map((col, i) => (
            <div
              key={i}
              className={cn(
                "flex-1 px-2.5 py-1.5 font-semibold text-gray-500 truncate",
                isOn && col.highlighted && "relative"
              )}
              style={
                isOn && col.highlighted
                  ? {
                      backgroundColor: OMNE_BLUE_LIGHT,
                      color: OMNE_BLUE,
                      borderBottom: `2px solid ${OMNE_BLUE}`,
                    }
                  : undefined
              }
            >
              {col.header}
              {isOn && col.highlighted && <ActiveBadge />}
            </div>
          ))}
          {!isOn && hiddenColumns.length > 0 && (
            <div className="px-2.5 py-1.5 text-[10px] text-amber-600 font-medium bg-amber-50/50 flex items-center gap-1 border-l border-dashed border-amber-200">
              {hiddenColumns.length} col{hiddenColumns.length > 1 ? "s" : ""} hidden
            </div>
          )}
        </div>

        {/* Rows */}
        {data.sampleRows.map((row, ri) => (
          <div
            key={ri}
            className={cn(
              "flex border-b border-gray-100 last:border-b-0",
              isOn && row.rowHighlighted && "ring-1 ring-inset",
            )}
            style={
              isOn && row.rowHighlighted
                ? { borderColor: OMNE_BLUE_BORDER, backgroundColor: OMNE_BLUE_LIGHT }
                : undefined
            }
          >
            {visibleColumns.map((col, ci) => (
              <div
                key={ci}
                className={cn(
                  "flex-1 px-2.5 py-1.5 text-[11px] text-gray-700 truncate",
                  isOn && col.highlighted && "font-medium"
                )}
                style={isOn && col.highlighted ? { color: OMNE_BLUE } : undefined}
              >
                {row.cells[data.columns.indexOf(col)] ?? "-"}
              </div>
            ))}
            {!isOn && hiddenColumns.length > 0 && (
              <div className="px-2.5 py-1.5 text-[10px] text-gray-300 flex items-center">
                -
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Row actions */}
      {data.rowActions && data.rowActions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
            Row Actions:
          </span>
          {isOn
            ? data.rowActions.map((a, i) => (
                <span
                  key={i}
                  className={cn(
                    "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium",
                    a.highlighted
                      ? "text-white"
                      : "bg-gray-100 text-gray-500 border border-gray-200"
                  )}
                  style={a.highlighted ? { backgroundColor: OMNE_BLUE } : undefined}
                >
                  {a.label}
                </span>
              ))
            : data.rowActions
                .filter((a) => !a.highlighted)
                .map((a, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200"
                  >
                    {a.label}
                  </span>
                ))}
          {!isOn &&
            data.rowActions
              .filter((a) => a.highlighted)
              .map((a, i) => <HiddenSlot key={`rh-${i}`} label={a.label} />)}
        </div>
      )}

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
