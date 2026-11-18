import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Shield,
  ChevronLeft,
  ChevronDown,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { UnarchiveRoleModal } from "./UnarchiveRoleModal";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "../ui/tooltip";
import { getRoleDetail, subscribeRoleChanges } from "../../data/role-detail-data";
import { LicenseBadge } from "../table-cells";
import { StatusDropdown } from "../shared/StatusDropdown";
import { ExpandableDescription } from "../shared/ExpandableDescription";
import { SystemRoleLock, ProtectedRoleBadge } from "../shared/SystemRoleBadge";
import { RoleOverviewTab } from "./RoleOverviewTab";
import { RoleUsersTab } from "./RoleUsersTab";
import { RolePermissionsTab } from "./RolePermissionsTab";
import { RoleActivityTab } from "./RoleActivityTab";
import { RoleAlertsTab } from "./RoleAlertsTab";
import { RoleOwnersTab } from "./RoleOwnersTab";
import { CommunicationsTab } from "../user-detail/CommunicationsTab";
import { AttachmentsTab } from "../user-detail/AttachmentsTab";
import { DeactivateRoleModal } from "../shared/DeactivateRoleModal";
import { RoleActionsMenu } from "../shared/RoleActionsMenu";
import { EditRoleModal } from "./EditRoleModal";
import {
  getStatusHeaderTheme,
  StatusGradientOverlay,
  StatusPrimaryButton,
  editPrimary,
} from "../shared/StatusHeaderTheme";
import { toast } from "sonner";
import { AccessGate, useAccessMode, useGate } from "../access-mode";

/* ─── Tab definitions ─── */
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "permissions", label: "Permissions" },
  { id: "alerts", label: "Alerts" },
  { id: "owners", label: "Owners" },
  { id: "communications", label: "Communications" },
  { id: "notes", label: "Attachments" },
  { id: "activity", label: "Activity" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function RoleDetailPage() {
  const { roleId } = useParams();
  const navigate = useNavigate();
  const access = useAccessMode();
  const gate = useGate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const tabParam = searchParams.get("tab");
    return (tabParam && TABS.some(t => t.id === tabParam)) ? tabParam as TabId : "overview";
  });
  const [codeCopied, setCodeCopied] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  /* ─── Action modal state: only state for modals owned by this page;
   *  RoleActionsMenu owns its own internal state for menu-triggered actions. ─── */
  const [editOpen, setEditOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [unarchiveOpen, setUnarchiveOpen] = useState(false);
  const [localStatus, setLocalStatus] = useState("Active");
  const [isFullscreen, setIsFullscreen] = useState(false);
  /* Bumped whenever an in-place mutation to the roles store fires
   * (license tier change, name/description edit, etc.) so the memoised
   * role detail re-reads fresh values. */
  const [roleVersion, setRoleVersion] = useState(0);
  useEffect(() => subscribeRoleChanges(() => setRoleVersion((v) => v + 1)), []);
  const role = useMemo(() => {
    const id = parseInt(roleId ?? "0", 10);
    return getRoleDetail(id);
  }, [roleId, roleVersion]);

  // Sync local status when role loads
  useEffect(() => {
    if (role) setLocalStatus(role.status);
  }, [role]);

  /* Tabs are data, then filtered. Activity is the audit trail (ur-view-audit)
   * and Owners is role-ownership administration (ur-manage-roles), so a persona
   * without either loses the tab entirely and the remaining tabs re-flow with
   * no gap. Distinct from `ownersDisabled` below, an ENTITY rule that keeps the
   * Owners tab visible-but-locked with an explanation. Declared above the
   * role-not-found early return so the hook order stays stable. */
  const tabs = useMemo(
    () =>
      TABS.filter((t) => {
        if (t.id === "activity") return access.canViewAudit;
        if (t.id === "owners") return access.canManageRoleOwners;
        return true;
      }),
    [access.canViewAudit, access.canManageRoleOwners],
  );

  /* ─── Scroll detection with hysteresis to prevent glitching ─── */
  const isScrolledRef = useRef(false);
  const rafRef = useRef<number>(0);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const scrollTop = el.scrollTop;
      const wasScrolled = isScrolledRef.current;
      const shouldBeScrolled = wasScrolled ? scrollTop > 4 : scrollTop > 20;
      if (shouldBeScrolled !== wasScrolled) {
        isScrolledRef.current = shouldBeScrolled;
        setIsScrolled(shouldBeScrolled);
      }
    });
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => {
      el.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [handleScroll]);

  if (!role) {
    return (
      <div className="flex items-center justify-center h-full font-['Inter',sans-serif]">
        <div className="text-center space-y-3">
          <p className="text-sm" style={{ color: "#64748B" }}>
            Role Not Found
          </p>
          <button
             onClick={() => window.history.length > 1 ? navigate(-1) : navigate("/company-settings/user-access-control?tab=roles")}
            className="text-sm cursor-pointer hover:underline"
            style={{ color: "#007FFF", fontWeight: 500 }}
          >
            Back to User Access Control
          </button>
        </div>
      </div>
    );
  }


  

  /* ─── Role icon color ─── */
  /* Draft is a not-yet-set-up state, not a problem state, so its header icon
   *  stays the normal blue (like an Active role). The amber draft banner in the
   *  overview already signals the "needs permissions" nudge. Only genuinely
   *  inactive states (Deactivated, Archived) get the red treatment. */
  const neutralIcon = localStatus === "Active" || localStatus === "Draft";
  const iconBg = neutralIcon ? "#EDF4FF" : "#FEF2F2";
  const iconColor = neutralIcon ? "#007FFF" : "#DC2626";

  /* The protected Account Owner role can't have a role owner, so its Owners
   * tab is disabled. If the page was deep-linked to ?tab=owners, fall back to
   * Overview so the body never renders the (inaccessible) owners view. */
  const ownersDisabled = !!role.isProtected;

  const effectiveTab: TabId =
    (ownersDisabled && activeTab === "owners") || !tabs.some((t) => t.id === activeTab)
      ? "overview"
      : activeTab;

  /* Listing tabs (table / module-grid) fill the viewport and scroll internally
   * with a sticky pagination footer. Dashboard-style tabs scroll the page. */
  const isListTab =
    effectiveTab === "users" ||
    effectiveTab === "owners" ||
    effectiveTab === "permissions" ||
    effectiveTab === "alerts";

  return (
    <div ref={scrollContainerRef} className={`flex-1 flex flex-col bg-[#F8FAFC] font-['Inter',sans-serif] ${isListTab ? "overflow-hidden" : "overflow-y-auto"}`}>
      {/* ════════════════════════════════════════════
          HEADER CARD: sticky
         ═══════════════════════════════════════════ */}
      <div
        className="shrink-0 sticky top-0 z-20 relative"
        style={{ paddingTop: isScrolled ? "6px" : "10px", transition: "padding-top 200ms ease" }}
      >
        {/* Background gradient */}
        <div
          style={{
            position: "absolute",
            inset: "-12px 0 -6px 0",
            background: "linear-gradient(180deg, #F8FAFC 0%, #F8FAFC calc(100% - 6px), transparent 100%)",
            pointerEvents: "none",
            zIndex: -1,
          }}
        />
        <div
          className={`mx-auto px-4 lg:px-6 xl:px-8 transition-all duration-300 ${
            isFullscreen ? "max-w-full" : "max-w-[1440px] 2xl:max-w-[1600px]"
          }`}
        >
          <div
            className={`relative bg-white border transition-all duration-200 ${
              isScrolled
                ? "rounded-[8px] shadow-[0_1px_2px_0_rgba(0,0,0,0.03),0_4px_12px_-2px_rgba(0,0,0,0.06)]"
                : "rounded-xl shadow-sm"
            }`}
            style={{
              borderColor:
                getStatusHeaderTheme(localStatus, "role").borderColor ?? "#E2E8F0",
            }}
          >
            <StatusGradientOverlay
              theme={getStatusHeaderTheme(localStatus, "role")}
              rounded={isScrolled ? 8 : 12}
            />
            <div className="relative">
            {/* Main header row */}
            <div
              className={`flex items-center justify-between gap-4 px-4 lg:px-5 transition-all duration-200 ${
                isScrolled ? "py-1.5" : "py-3"
              }`}
            >
              {/* Left: Back + Icon + Info */}
              <div
                className={`flex items-center min-w-0 transition-all duration-200 ${
                  isScrolled ? "gap-2.5" : "gap-3"
                }`}
              >
                <button
                  onClick={() => window.history.length > 1 ? navigate(-1) : navigate("/company-settings/user-access-control?tab=roles")}
                  className={`rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] flex items-center justify-center shrink-0 transition-all duration-200 cursor-pointer shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] ${
                    isScrolled ? "w-8 h-8" : "w-11 h-11"
                  }`}
                >
                  <ChevronLeft
                    className={`text-[#94A3B8] transition-all duration-200 ${
                      isScrolled ? "w-4 h-4" : "w-5 h-5"
                    }`}
                  />
                </button>

                <div
                  className={`rounded-xl flex items-center justify-center shrink-0 border border-white transition-all duration-200 ${
                    isScrolled ? "w-8 h-8" : "w-11 h-11"
                  }`}
                  style={{
                    backgroundColor: iconBg,
                    boxShadow: `0 1px 3px 0 rgba(0,0,0,0.06), 0 0 0 2px rgba(10,119,255,0.10)`,
                    transition: "width 200ms, height 200ms",
                  }}
                >
                  <Shield
                    className={`transition-all duration-200 ${
                      isScrolled ? "w-4 h-4" : "w-5 h-5"
                    }`}
                    style={{ color: iconColor }}
                  />
                </div>

                <div className="min-w-0">
                  <div
                    className={`flex items-center flex-wrap transition-all duration-200 ${
                      isScrolled ? "gap-1.5" : "gap-2"
                    }`}
                  >
                    {role.isSystem && <SystemRoleLock size={isScrolled ? 12 : 14} />}
                    {role.isProtected && <ProtectedRoleBadge size={isScrolled ? 13 : 15} />}
                    <h1
                      className="text-[#0F172A] truncate"
                      style={{
                        fontSize: isScrolled ? "13px" : "16px",
                        fontWeight: isScrolled ? 600 : 700,
                        lineHeight: isScrolled ? "18px" : "22px",
                        transition: "font-size 200ms, line-height 200ms, font-weight 200ms",
                      }}
                    >
                      {role.roleName}
                    </h1>

                    <StatusDropdown
                      status={localStatus}
                      userName={role.roleName}
                      onStatusChange={setLocalStatus}
                      entityType="role"
                      isDetailPage
                      // Predefined (system) roles are locked: status is read-only,
                      // matching the locked actions menu and the lock badge.
                      lockedReason={
                        role.isSystem
                          ? "System role. Its status is managed by the system and can't be changed."
                          : undefined
                      }
                      hideLockIcon
                    />

                    {!isScrolled && (() => {
                      const cfg: Record<string, { bg: string; color: string; border: string; label: string }> = {
                        "Full Access": { bg: "#EDE9FE", color: "#5B21B6", border: "#C4B5FD", label: "Requires Full Access" },
                        "Field User":  { bg: "#F1F5F9", color: "#475569", border: "#CBD5E1", label: "Requires Field Access" },
                        "No License":  { bg: "#F8FAFC", color: "#94A3B8", border: "#E2E8F0", label: "No License Required" },
                      };
                      const c = cfg[role.licenseRequired] ?? cfg["Field User"];
                      return (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs"
                          style={{
                            backgroundColor: c.bg,
                            color: c.color,
                            borderColor: c.border,
                            fontWeight: 500,
                          }}
                        >
                          {c.label}
                        </span>
                      );
                    })()}
                  </div>

                  {/* ── Description: hidden when compact ── */}
                  {!isScrolled && role.description && (
                    <ExpandableDescription
                      maxExpandedLines={8}
                      text={role.description}
                      className="max-w-3xl mt-1.5 text-[12px] text-[#64748B] leading-[1.6]"
                    />
                  )}
                </div>
              </div>

              {/* Right: Actions, order is Expand → Actions → Primary CTA,
               *  matching the User Detail header layout. */}
              <div
                className={`flex items-center shrink-0 transition-all duration-200 ${
                  isScrolled ? "gap-1.5" : "gap-2"
                }`}
              >
                {/* Expand / collapse icon: toggles fullscreen layout */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setIsFullscreen((v) => !v)}
                      className={`rounded-[8px] border border-[#E2E8F0] flex items-center justify-center transition-all duration-200 cursor-pointer shadow-sm ${
                        isScrolled ? "w-8 h-8" : "w-9 h-9"
                      }`}
                      /* Background pinned inline so the status gradient
                       *  (Archived / Inactive) never bleeds through; hover
                       *  via inline handlers because the inline bg would
                       *  win over Tailwind's hover utility. */
                      style={{ backgroundColor: "#FFFFFF" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
                    >
                      {isFullscreen ? (
                        <Minimize2
                          className={`text-[#64748B] transition-all duration-200 ${
                            isScrolled ? "w-3.5 h-3.5" : "w-4 h-4"
                          }`}
                        />
                      ) : (
                        <Maximize2
                          className={`text-[#64748B] transition-all duration-200 ${
                            isScrolled ? "w-3.5 h-3.5" : "w-4 h-4"
                          }`}
                        />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{isFullscreen ? "Exit Full Screen" : "Full Screen"}</TooltipContent>
                </Tooltip>

                {/* Action dropdown: shared component */}
                <RoleActionsMenu
                  role={role}
                  variant="pill"
                  onEditClick={() => setEditOpen(true)}
                  onAssignedUsersClick={() => setActiveTab("users")}
                  onDeactivated={() => setLocalStatus("Inactive")}
                  trigger={
                    <button
                      className={`rounded-[8px] border border-[#E2E8F0] text-[#334155] inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm ${
                        isScrolled ? "h-8 px-3 text-[12px]" : "h-9 px-3.5 text-[13px]"
                      }`}
                      /* Same pinned-white background pattern as the
                       *  expand button, keeps the chip readable over
                       *  any status wash. */
                      style={{ fontWeight: 500, backgroundColor: "#FFFFFF" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
                    >
                      Action
                      <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
                    </button>
                  }
                />

                {/* Primary action: status-aware (Edit by default; Unarchive/Reactivate when applicable) */}
                {(() => {
                  const theme = getStatusHeaderTheme(localStatus, "role");

                  /* Predefined (system) roles can't be edited. Keep the Edit
                   * Role button visible for affordance, but render it disabled
                   * (50% opacity) and explain why on hover. We use aria-disabled
                   * rather than the native disabled attribute so the button
                   * still receives hover events and the tooltip can fire. */
                  /* Edit, Unarchive and Reactivate are all role authoring, so
                   * one capability covers every variant of this button. A
                   * persona without it gets no primary action at all — hidden,
                   * not disabled. The disabled-with-tooltip treatment below is
                   * reserved for the ENTITY reason (predefined roles can't be
                   * edited), which is worth explaining. */
                  const g = gate(true, access.canCreateEditRole);
                  if (!g.render) return null;

                  if (role.isSystem && !theme.primary) {
                    const spec = editPrimary("role");
                    const EditIcon = spec.Icon;
                    return (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            aria-disabled
                            onClick={(e) => e.preventDefault()}
                            className={`rounded-lg text-white inline-flex items-center gap-1.5 shadow-sm opacity-50 cursor-not-allowed ${
                              isScrolled ? "h-8 px-3.5 text-[12px]" : "h-9 px-4 text-[13px]"
                            }`}
                            style={{ fontWeight: 600, backgroundColor: spec.bg }}
                          >
                            <EditIcon className={isScrolled ? "w-3 h-3" : "w-3.5 h-3.5"} />
                            {spec.label}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={6}>
                          Predefined roles can't be edited.
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  const spec = theme.primary ?? editPrimary("role");
                  if (!spec) return null;
                  const onClick = () => {
                    if (theme.accent === "red") setUnarchiveOpen(true);
                    else if (theme.accent === "amber") {
                      setLocalStatus("Active");
                      toast.success(`${role.roleName} was reactivated.`);
                    } else setEditOpen(true);
                  };
                  const button = (
                    <StatusPrimaryButton spec={spec} onClick={onClick} compact={isScrolled} />
                  );
                  return g.disabled ? (
                    <AccessGate capability={false} reason={g.reason}>
                      {button}
                    </AccessGate>
                  ) : (
                    button
                  );
                })()}
              </div>
            </div>

            {/* Tab bar */}
            <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide border-t border-[#F1F5F9] px-4 lg:px-5">
              {tabs.map((tab) => {
                const isActive = effectiveTab === tab.id;
                const sizing = isScrolled
                  ? "py-1.5 px-3.5 text-[12px]"
                  : "py-2.5 px-3.5 text-[13px]";

                /* Owners tab is disabled for the protected Account Owner role:
                 * not-allowed cursor, muted styling, and a white tooltip that
                 * explains why. aria-disabled (not the native disabled attr) so
                 * the trigger still receives hover events and the tooltip fires. */
                if (tab.id === "owners" && ownersDisabled) {
                  return (
                    <Tooltip key={tab.id}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-disabled
                          onClick={(e) => e.preventDefault()}
                          className={`flex items-center gap-1.5 border-b-2 border-transparent whitespace-nowrap cursor-not-allowed text-[#CBD5E1] ${sizing}`}
                          style={{ fontWeight: 400 }}
                        >
                          {tab.label}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" sideOffset={6} className="max-w-[300px]">
                        <div className="space-y-0.5">
                          <p style={{ fontWeight: 600, color: "#0F172A", whiteSpace: "nowrap" }}>
                            Account Owner Can't Have a Role Owner
                          </p>
                          <p style={{ color: "#64748B" }}>
                            It sits above every other role.
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 border-b-2 transition-all duration-200 whitespace-nowrap cursor-pointer ${sizing} ${
                      isActive
                        ? "border-[#007FFF] text-[#007FFF]"
                        : "border-transparent text-[#64748B] hover:text-[#334155] hover:border-[#CBD5E1]"
                    }`}
                    style={{ fontWeight: isActive ? 600 : 400 }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          BODY
         ════════════════════════════════════════════ */}
      <AnimatePresence mode="wait">
        <motion.div
          key={effectiveTab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
          className={`flex-1 ${isListTab ? "min-h-0 flex flex-col" : ""}`}
        >
          <div
            className={`mx-auto w-full px-4 lg:px-6 xl:px-8 py-5 transition-all duration-300 ${
              isFullscreen ? "max-w-full" : "max-w-[1440px] 2xl:max-w-[1600px]"
            } ${isListTab ? "flex-1 min-h-0 flex flex-col" : ""}`}
          >
            {effectiveTab === "overview" && <RoleOverviewTab role={role} onNavigateToTab={(tab) => setActiveTab(tab as TabId)} />}
            {effectiveTab === "users" && <RoleUsersTab role={role} />}
            {effectiveTab === "permissions" && <RolePermissionsTab role={role} />}
            {effectiveTab === "alerts" && <RoleAlertsTab role={role} />}
            {effectiveTab === "owners" && <RoleOwnersTab role={role} />}
            {effectiveTab === "activity" && <RoleActivityTab role={role} />}
            {effectiveTab === "communications" && <CommunicationsTab subject="role" />}
            {effectiveTab === "notes" && <AttachmentsTab context="role" />}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* ─── Action Modals owned by this page ─── */}
      <EditRoleModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        roleId={parseInt(roleId ?? "0", 10)}
        onDeactivate={() => setDeactivateOpen(true)}
      />
      <DeactivateRoleModal
        open={deactivateOpen}
        onClose={() => setDeactivateOpen(false)}
        roleName={role.roleName}
        usersCount={role.usersCount}
        assignedUserIds={role.assignedUserIds}
        onConfirm={() => setLocalStatus("Inactive")}
      />
      <UnarchiveRoleModal
        open={unarchiveOpen}
        onClose={() => setUnarchiveOpen(false)}
        roleId={parseInt(roleId ?? "0", 10)}
        onStatusChange={setLocalStatus}
      />
    </div>
  );
}
