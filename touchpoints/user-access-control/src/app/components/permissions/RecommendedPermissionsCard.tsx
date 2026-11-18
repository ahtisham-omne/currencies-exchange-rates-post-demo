import { useMemo } from "react";
import { ChevronRight, Lightbulb } from "lucide-react";
import {
  getPermissionRecommendations,
  type RecommendedPermission,
} from "../../data/permission-recommendations";

/* ─── Recommended permissions to turn on ────────────────────────────────────
 *
 * Third card in the permission detail stack, below "When to Restrict This".
 * Same card construction as the other two in a green theme, and purely
 * educational: it names permissions that pair well with the one on screen.
 * It gates nothing, cascades nothing, enables nothing, and opens no modal.
 *
 * It only lists recommendations that are currently off, so the card empties out
 * as the admin turns things on and disappears once they are all on.
 */

interface RecommendedPermissionsCardProps {
  /** The permission whose detail panel this card sits in. */
  permissionId: string;
  /** Module the panel belongs to, used to tell local from cross-module chips. */
  moduleId: string;
  /** Live toggle map for the open module (includes unsaved edits). */
  toggles?: Record<string, boolean>;
  /** Permission ids inherited from assigned roles, effectively on. */
  inheritedPermissions?: Set<string>;
  /** Resolves the on/off state of a permission in any other module. Without it
   *  cross-module recommendations are treated as off, so the chip still shows. */
  isPermissionEnabled?: (permissionId: string) => boolean;
  /** Navigate to a recommendation, never toggles it. */
  onNavigate: (permissionId: string, moduleId: string) => void;
  /** Whether recommendations in other modules can be opened. False on the
   *  standalone single-module modals, where those chips render as plain labels
   *  instead of dead buttons. */
  canNavigateCrossModule?: boolean;
}

export function RecommendedPermissionsCard({
  permissionId,
  moduleId,
  toggles,
  inheritedPermissions,
  isPermissionEnabled,
  onNavigate,
  canNavigateCrossModule = false,
}: RecommendedPermissionsCardProps) {
  const groups = useMemo(
    () => getPermissionRecommendations(permissionId),
    [permissionId]
  );

  /** A recommendation counts as satisfied when it is effectively on, matching
   *  the left list: inherited from a role, or toggled on directly. */
  const visibleGroups = useMemo(() => {
    if (groups.length === 0) return [];

    const isOn = (item: RecommendedPermission): boolean => {
      if (inheritedPermissions?.has(item.permissionId)) return true;
      if (item.moduleId === moduleId) return toggles?.[item.permissionId] === true;
      return isPermissionEnabled?.(item.permissionId) ?? false;
    };

    // An "either of" pair is satisfied as soon as one side is on, so the whole
    // group drops out rather than leaving a lone chip behind.
    return groups.filter((group) => !group.options.some(isOn));
  }, [groups, toggles, inheritedPermissions, isPermissionEnabled, moduleId]);

  if (visibleGroups.length === 0) return null;

  return (
    <div className="flex items-start justify-between p-4 bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] gap-5">
      <div className="flex items-start gap-3 flex-1">
        <div className="w-10 h-10 bg-white rounded-[8px] flex items-center justify-center shrink-0 text-[#475569] shadow-sm border border-[#CBD5E1]/30">
          <Lightbulb className="w-[18px] h-[18px]" />
        </div>
        <div className="flex-1">
          <h3
            className="text-[#334155]"
            style={{ fontSize: "13.5px", fontWeight: 500, lineHeight: "1.3" }}
          >
            Recommended Permissions to Turn On
          </h3>
          <p
            className="text-[#475569] mt-0.5"
            style={{ fontSize: "12.5px", fontWeight: 400, lineHeight: "1.45" }}
          >
            This permission works on its own, but it works better when either of
            these are on too.
          </p>

          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            {visibleGroups.flatMap((group) =>
              group.options.map((option) => {
                const isCrossModule = option.moduleId !== moduleId;
                return (
                  <RecommendationChip
                    key={option.permissionId}
                    option={option}
                    showModule={isCrossModule}
                    onNavigate={
                      !isCrossModule || canNavigateCrossModule ? onNavigate : undefined
                    }
                  />
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Chips carry the brand blue so they read as something to click, 6px taller
   than the label chips in the header above (py-[5px] rather than py-0.5). Colors
   stay in classes, not inline styles, so the hover variants can win. */
const CHIP_CLASS =
  "inline-flex items-center gap-1 rounded-[6px] border whitespace-nowrap px-2 py-[5px] text-xs shadow-sm bg-white text-[#0E69E2] border-[#BFDBFE]";
const CHIP_STYLE = { fontWeight: 500 } as const;

/** Names the permission, and its module too when it lives somewhere else.
 *  Clicking navigates to that permission's detail. It never toggles anything. */
function RecommendationChip({
  option,
  showModule,
  onNavigate,
}: {
  option: RecommendedPermission;
  showModule: boolean;
  onNavigate?: (permissionId: string, moduleId: string) => void;
}) {
  const label = (
    <>
      {showModule && (
        <>
          <span className="text-[#64748B]">{option.moduleName}</span>
          <span className="text-[#94A3B8]">/</span>
        </>
      )}
      {option.permissionName}
    </>
  );

  if (!onNavigate) {
    return (
      <span className={CHIP_CLASS} style={CHIP_STYLE}>
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onNavigate(option.permissionId, option.moduleId)}
      className={`${CHIP_CLASS} group relative overflow-hidden cursor-pointer transition-all hover:bg-[#F0F7FF] hover:border-[#0E69E2]/40 hover:shadow`}
      style={CHIP_STYLE}
      title={
        showModule
          ? `View ${option.permissionName} in ${option.moduleName}`
          : `View ${option.permissionName}`
      }
    >
      {label}
      {/* On hover a chevron slides in from the right edge over a soft blue
          gradient, so the chip reads as "this takes you there". The gradient
          fades the tail of the label out underneath it, which keeps the chip
          from changing width and shifting its neighbours. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 flex items-center pl-7 pr-1.5 bg-gradient-to-l from-[#DBEAFE] via-[#DBEAFE]/95 to-transparent opacity-0 translate-x-2 transition-all duration-200 ease-out group-hover:opacity-100 group-hover:translate-x-0"
      >
        <ChevronRight className="w-3.5 h-3.5 text-[#0E69E2]" />
      </span>
    </button>
  );
}
