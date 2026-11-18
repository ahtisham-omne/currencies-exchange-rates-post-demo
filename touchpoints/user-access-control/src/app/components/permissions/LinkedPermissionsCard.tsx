import { useMemo } from "react";
import { ArrowRight, ChevronRight, Link } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "../ui/tooltip";
import {
  getLinkedGroup,
  getLinkedPermissionRefs,
  type LinkedPermissionRef,
} from "../../data/linked-permissions";

/* ─── Linked permissions banner ──────────────────────────────────────────────
 *
 * Repurposes the "Recommended permissions to turn on" card (same construction:
 * slate card, icon tile, title, copy, chip row) for the linked-permission
 * groups in data/linked-permissions.ts. Where the recommendations card was
 * advisory and emptied out as things got turned on, this one is a standing
 * fact about the permission: it renders whenever the permission belongs to a
 * linked group, in read-only and editable contexts alike.
 *
 * The card itself toggles nothing. The cascade lives in PermissionDetailModal,
 * behind its confirmation modal; chips here only navigate.
 */

interface LinkedPermissionsCardProps {
  /** The permission whose detail panel this card sits in. */
  permissionId: string;
  /** Module the panel belongs to, used to tell local from cross-module chips. */
  moduleId: string;
  /** Navigate to a linked permission, never toggles it. */
  onNavigate: (permissionId: string, moduleId: string) => void;
  /** Whether chips pointing at other modules can be opened. False on the
   *  standalone single-module modals, where those chips render as plain labels
   *  instead of dead buttons. */
  canNavigateCrossModule?: boolean;
}

export function LinkedPermissionsCard({
  permissionId,
  moduleId,
  onNavigate,
  canNavigateCrossModule = false,
}: LinkedPermissionsCardProps) {
  const group = useMemo(() => getLinkedGroup(permissionId), [permissionId]);
  const linked = useMemo(() => getLinkedPermissionRefs(permissionId), [permissionId]);

  if (!group || linked.length === 0) return null;

  return (
    <div className="flex items-start justify-between p-4 bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] gap-5">
      <div className="flex items-start gap-3 flex-1">
        <div className="w-10 h-10 bg-white rounded-[8px] flex items-center justify-center shrink-0 text-[#475569] shadow-sm border border-[#CBD5E1]/30">
          <Link className="w-[18px] h-[18px]" />
        </div>
        <div className="flex-1">
          <h3
            className="text-[#334155]"
            style={{ fontSize: "13.5px", fontWeight: 500, lineHeight: "1.3" }}
          >
            Linked {linked.length === 1 ? "Permission" : "Permissions"}
          </h3>
          <p
            className="text-[#475569] mt-0.5"
            style={{ fontSize: "12.5px", fontWeight: 400, lineHeight: "1.45" }}
          >
            This permission edits the same {group.entity} on the back end as{" "}
            {linked.length === 1 ? "the permission" : "the permissions"} below, so
            they turn on and off together. Toggling one toggles{" "}
            {linked.length === 1 ? "the other" : "all of them"}.
          </p>

          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            {linked.map((ref) => (
              <LinkedPermissionChip
                key={ref.permissionId}
                item={ref}
                showModule={ref.moduleId !== moduleId}
                onNavigate={
                  ref.moduleId === moduleId || canNavigateCrossModule
                    ? onNavigate
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Same chip treatment as the recommendations card, but neutral: the whole
   label sits in slate and only turns blue on hover, so the chip reads as
   quiet metadata until the pointer says otherwise. */
const CHIP_CLASS =
  "inline-flex items-center gap-1 rounded-[6px] border whitespace-nowrap px-2 py-[5px] text-xs shadow-sm bg-white border-[#CBD5E1]";
const CHIP_STYLE = { fontWeight: 500 } as const;

/** Names the linked permission and its module ("Module -> Permission").
 *  Clicking navigates to that permission's detail. It never toggles anything. */
function LinkedPermissionChip({
  item,
  showModule,
  onNavigate,
}: {
  item: LinkedPermissionRef;
  showModule: boolean;
  onNavigate?: (permissionId: string, moduleId: string) => void;
}) {
  const label = (
    <>
      {showModule && (
        <>
          <span className="text-[#64748B] group-hover:text-[#0E69E2] transition-colors">
            {item.moduleName}
          </span>
          <ArrowRight className="w-3 h-3 shrink-0 text-[#94A3B8] group-hover:text-[#0E69E2] transition-colors" />
        </>
      )}
      <span className="text-[#64748B] group-hover:text-[#0E69E2] transition-colors">
        {item.permissionName}
      </span>
    </>
  );

  if (!onNavigate) {
    return (
      <span className={`${CHIP_CLASS} group`} style={CHIP_STYLE}>
        {label}
      </span>
    );
  }

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onNavigate(item.permissionId, item.moduleId)}
          className={`${CHIP_CLASS} group relative overflow-hidden cursor-pointer transition-all hover:bg-[#F0F7FF] hover:border-[#0E69E2]/40 hover:shadow`}
          style={CHIP_STYLE}
        >
          {label}
          {/* Hover chevron over a soft gradient, matching the recommendations
              card, so the chip reads as "this takes you there" without changing
              width and shifting its neighbours. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 flex items-center pl-7 pr-1.5 bg-gradient-to-l from-[#DBEAFE] via-[#DBEAFE]/95 to-transparent opacity-0 translate-x-2 transition-all duration-200 ease-out group-hover:opacity-100 group-hover:translate-x-0"
          >
            <ChevronRight className="w-3.5 h-3.5 text-[#0E69E2]" />
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="z-[9999]">
        <p className="text-xs">
          {showModule
            ? `View this permission in ${item.moduleName}`
            : `View ${item.permissionName}`}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
