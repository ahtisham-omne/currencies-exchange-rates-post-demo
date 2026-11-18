import { OverviewTab } from "./OverviewTab";


import { RolesPermissionsTab } from "./RolesPermissionsTab";
import { AlertsTab } from "./AlertsTab";
import { ActivityTab } from "./ActivityTab";
import { AttachmentsTab } from "./AttachmentsTab";
import { UserNotesTab } from "./UserNotesTab";
import { CommunicationsTab } from "./CommunicationsTab";
import { motion, AnimatePresence } from "motion/react";

import { useState, useRef, useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Mail,
  Pencil,
  ChevronDown,
  ChevronLeft,
  Phone,
  Maximize2,
  Minimize2,
  Tag as TagIcon,
  Plus,
  X,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getUserDetail, subscribeUserDetail, type UserDetail } from "../../data/user-detail-data";
import { setUserNotes, useUserNotes } from "../../data/user-notes";
import { CURRENT_USER } from "../../data/current-user";
import { sampleOnly } from "../../data/tenant";
import { getInitials } from "../../lib/avatar";
import { USER_AVATAR_MAP } from "../../data/user-avatars";
import { StatusDropdown } from "../shared/StatusDropdown";
import { LicenseDropdown } from "../shared/LicenseDropdown";
import { UserActionsMenu } from "../shared/UserActionsMenu";
import { ProtectedUserBadge } from "../shared/SystemRoleBadge";
import { useAccountOwnerRules } from "../../data/account-owner";
import { EditUserModal } from "./EditUserModal";
import { UnarchiveUserModal } from "./UnarchiveUserModal";
import {
  ResendInviteModal,
} from "../shared/ActionModals";
import {
  getStatusHeaderTheme,
  StatusGradientOverlay,
  StatusPrimaryButton,
  editPrimary,
} from "../shared/StatusHeaderTheme";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { useUserQuickView } from "../shared/UserQuickViewPanel";
import { AccessGate, useAccessMode, useGate } from "../access-mode";

/* ─── Phone Overflow Popover ─── */
function PhoneOverflow({ phones }: { phones: { label?: string; countryCode?: string; number: string }[] }) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setOpen(true), 200);
  };
  const handleLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setOpen(false), 100);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          className="text-[11px] shrink-0 cursor-pointer leading-none select-none"
          style={{ fontWeight: 600, color: "#085FCC" }}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        >
          +{phones.length} more
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-auto min-w-[180px] p-1.5 rounded-lg shadow-lg"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        <div className="flex flex-col gap-0.5">
          {phones.map((p, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] text-[#334155] hover:bg-[#F1F5F9] transition-colors"
            >
              <Phone className="w-3 h-3 text-[#94A3B8] shrink-0" />
              <span className="font-medium">{p.countryCode} {p.number}</span>
              {p.label && (
                <span className="text-[10px] text-[#94A3B8] ml-auto">{p.label}</span>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}


/* ─── Tab definitions ─── */
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "roles", label: "Roles & Permissions" },
  { id: "alerts", label: "Alerts" },
  { id: "communications", label: "Communications" },
  /* ERP-5167: Notes sits beside Attachments, each on its own id. */
  { id: "notes", label: "Notes" },
  { id: "attachments", label: "Attachments" },
  { id: "activity", label: "Activity" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function UserDetailPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const access = useAccessMode();
  const gate = useGate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (searchParams.get("tab") === "roles") return "roles";
    if (sessionStorage.getItem("uac_open_tab") === "roles") return "roles";
    return "overview";
  });

  useEffect(() => {
    if (searchParams.get("tab") === "roles") {
      setActiveTab("roles");
      return;
    }

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const stored = sessionStorage.getItem("uac_open_tab");
      if (stored === "roles") {
        setActiveTab("roles");
        sessionStorage.removeItem("uac_open_tab");
        clearInterval(interval);
      }
      if (attempts >= 10) clearInterval(interval);
    }, 50);

    return () => clearInterval(interval);
  }, [userId, searchParams]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isCompact, setIsCompact] = useState(false);

  // Sticky compact header via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsCompact(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-1px 0px 0px 0px", root: scrollContainerRef.current }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  /* ─── Action modal state: only state for modals owned by this page;
   *  UserActionsMenu owns its own internal state for menu-triggered actions. ─── */
  const [editOpen, setEditOpen] = useState(false);
  const [unarchiveOpen, setUnarchiveOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [resendInviteOpen, setResendInviteOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  /* Placeholder tags; a company from onboarding hasn't tagged anyone yet. */
  const [userTags, setUserTags] = useState<string[]>(() => sampleOnly(["full-time", "field-team"]));
  const [tagInputOpen, setTagInputOpen] = useState(false);
  const [tagInputValue, setTagInputValue] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);

  const handleAddTag = () => {
    const v = tagInputValue.trim().toLowerCase();
    if (v && !userTags.includes(v)) setUserTags((p) => [...p, v]);
    setTagInputValue("");
    setTagInputOpen(false);
  };
  const handleRemoveTag = (t: string) =>
    setUserTags((p) => p.filter((x) => x !== t));

  const [localStatus, setLocalStatus] = useState("Active");
  const [localLicense, setLocalLicense] = useState("Field User");
  /* Tracks which flow left the user awaiting an invite, so the Overview
   * Send-Invitation banner shows context-aware copy. */
  const [inviteContext, setInviteContext] =
    useState<"created" | "unarchived" | "cancelled">("created");

  const id = parseInt(userId ?? "0", 10);
  // Re-render when user-detail data mutates (e.g., role removed).
  const [, forceTick] = useState(0);
  useEffect(() => subscribeUserDetail(() => forceTick((n) => n + 1)), []);
  const user = getUserDetail(id);

  // Sync local status when userId changes
  const prevIdRef = useRef(id);
  if (prevIdRef.current !== id) {
    prevIdRef.current = id;
    if (user) setLocalStatus(user.status);
  }
  const initializedRef = useRef(false);
  if (!initializedRef.current && user) {
    initializedRef.current = true;
    setLocalStatus(user.status);
    setLocalLicense(user.license);
  }

  /* Archived users are read-only: access data is cleared and every edit
   * affordance is hidden across all tabs. Driven by live status so an
   * in-session unarchive restores the editable state immediately. */
  const isArchived = localStatus === "Archived";
  const userNotes = useUserNotes(id);

  /* ─── Access gating ───
   *
   * `capability && statusAllows`. The archived read-only mode above is an
   * ENTITY fact and stays exactly as it was; the persona capability is ANDed
   * onto it rather than replacing it. */
  const canEditThisUser = access.canCreateEditUser && !isArchived;

  /* Tag editing: archived is the status half (always hides), the capability half
   * follows the header's hidden/disabled setting. */
  const tagGate = gate(!isArchived, access.canCreateEditUser);

  /* Tabs are data, then filtered. A persona without audit access loses the
   * Activity tab entirely and the remaining tabs re-flow with no layout hole,
   * rather than showing a tab that opens onto a refusal. */
  const tabs = useMemo(
    () => TABS.filter((t) => (t.id === "activity" ? access.canViewAudit : true)),
    [access.canViewAudit],
  );

  /* A filtered-out tab must not stay selected, including via a deep link. */
  useEffect(() => {
    if (!tabs.some((t) => t.id === activeTab)) setActiveTab("overview");
  }, [tabs, activeTab]);

  /* Account Owner (any holder): the header status chip is locked, to other
   * users and to the owner themselves (ERP-5149 AC8). */
  const owner = useAccountOwnerRules(user?.id ?? -1);
  const protectedTip = owner.status.allowed ? undefined : owner.status.reason;

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full font-['Inter',sans-serif]">
        <div className="text-center space-y-3">
          <p className="text-sm" style={{ color: "#64748B" }}>
            User Not Found
          </p>
          <button
            onClick={() => navigate("/company-settings/user-access-control")}
            className="text-sm cursor-pointer hover:underline"
            style={{ color: "#2563EB", fontWeight: 500 }}
          >
            Back to User Access Control
          </button>
        </div>
      </div>
    );
  }

  const initials = getInitials(user.fullName);
  const avatarUrl = USER_AVATAR_MAP[user.id];
  const primaryPhone = user.phones?.find((p) => p.type === "Mobile") || user.phones?.[0];
  const { openQuickView } = useUserQuickView();
  const handleAvatarClick = () => openQuickView(user.id);

  /* Listing tabs (Roles & Permissions, Alerts) fill the viewport and scroll
   * internally with a sticky pagination footer; dashboard tabs scroll the page. */
  const isListTab = activeTab === "roles" || activeTab === "alerts";

  return (
    <div ref={scrollContainerRef} className={`flex-1 flex flex-col bg-[#F8FAFC] font-['Inter',sans-serif] ${isListTab ? "overflow-hidden" : "overflow-y-auto"}`}>
      {/* Sentinel for compact detection */}
      <div ref={sentinelRef} className="shrink-0 h-px" />

      {/* ═══ STICKY HEADER CARD (Contact Detail pattern) ═══ */}
      <div className="shrink-0 sticky top-0 z-20 bg-[#F8FAFC]">
        <div
          style={{
            paddingTop: isCompact ? "8px" : "12px",
            paddingBottom: "4px",
            transition: "padding 250ms ease",
          }}
        >
          <div
            className={`mx-auto px-4 lg:px-6 xl:px-8 transition-all duration-300 ${
              isFullscreen ? "max-w-full" : "max-w-[1440px] 2xl:max-w-[1600px]"
            }`}
          >
            <div
              className={`relative bg-white border rounded-xl overflow-hidden transition-shadow duration-250 ${
                isCompact
                  ? "shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_4px_12px_-4px_rgba(0,0,0,0.05)]"
                  : "shadow-sm"
              }`}
              style={{
                borderColor:
                  getStatusHeaderTheme(localStatus, "user").borderColor ?? "#E2E8F0",
              }}
            >
              <StatusGradientOverlay
                theme={getStatusHeaderTheme(localStatus, "user")}
                rounded={12}
              />
              <div className="relative">
              {/* ─── Single morphing header ─── */}
              <div
                className="flex justify-between transition-all duration-250 ease-in-out"
                style={{
                  padding: isCompact ? "8px 16px" : "16px 20px",
                  gap: isCompact ? 12 : 16,
                }}
              >
                {/* ═══ LEFT: Back + Avatar + Info ═══ */}
                <div
                  className="flex items-start min-w-0 flex-1 transition-all duration-250"
                  style={{ gap: isCompact ? 10 : 16 }}
                >
                  <button
                    onClick={() =>
                      window.history.length > 1
                        ? navigate(-1)
                        : navigate("/company-settings/user-access-control")
                    }
                    className="rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] flex items-center justify-center shrink-0 cursor-pointer shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] transition-all duration-250 self-start"
                    style={{
                      width: isCompact ? 32 : 40,
                      height: isCompact ? 32 : 40,
                      marginTop: isCompact ? 0 : 4,
                    }}
                  >
                    <ChevronLeft
                      className="text-[#94A3B8] transition-all duration-250"
                      style={{
                        width: isCompact ? 16 : 18,
                        height: isCompact ? 16 : 18,
                      }}
                    />
                  </button>

                  {/* Avatar: morphs between 96px and 36px */}
                  <div
                    onClick={handleAvatarClick}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleAvatarClick(); }}
                    className="flex items-center justify-center shrink-0 overflow-hidden transition-all duration-250 cursor-pointer hover:ring-2 hover:ring-[#007FFF]/30"
                    style={{
                      width: isCompact ? 36 : 96,
                      height: isCompact ? 36 : 96,
                      borderRadius: isCompact ? 12 : 16,
                      border: isCompact ? "1px solid #E2E8F0" : "3px solid white",
                      boxShadow: isCompact
                        ? "0 1px 3px rgba(0,0,0,0.04)"
                        : "0 4px 16px -4px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)",
                      backgroundColor: "#e0e7ff",
                    }}
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={user.fullName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span
                        className="transition-all duration-250"
                        style={{
                          fontSize: isCompact ? 12 : 28,
                          fontWeight: 700,
                          color: "#3730a3",
                        }}
                      >
                        {initials}
                      </span>
                    )}
                  </div>

                  {/* Info column: flex-col with a single `gap` so every
                   *  pair of rows is separated by the same value. Text rows
                   *  use `line-height: 1` to remove half-leading; without
                   *  this the h1/p boxes would each carry ~2–3px of invisible
                   *  padding the chip/tag rows don't have, breaking the
                   *  rhythm even though the CSS gap is constant. */}
                  <div
                    className="min-w-0 flex-1 flex flex-col"
                    style={{
                      paddingTop: isCompact ? 0 : 2,
                      gap: isCompact ? 2 : 8,
                    }}
                  >
                    {/* Row 1: Name, licence, then status. The licence chip sits
                     *  with the name because it is an attribute of the person,
                     *  not a lifecycle state, and it stays visible when the
                     *  header collapses. */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1
                        className="text-[#0F172A] truncate transition-all duration-250"
                        style={{
                          fontSize: isCompact ? 14 : 17,
                          fontWeight: isCompact ? 600 : 700,
                          lineHeight: 1,
                        }}
                      >
                        {user.fullName}
                      </h1>
                      {owner.isOwner && (
                        <ProtectedUserBadge size={isCompact ? 13 : 15} />
                      )}
                      {localStatus !== "Archived" && (
                        <LicenseDropdown
                          license={localLicense}
                          userName={user.fullName}
                          userEmail={user.email}
                          userId={user.id}
                          userStatus={localStatus}
                          onLicenseChange={setLocalLicense}
                        />
                      )}
                      <StatusDropdown
                        status={localStatus}
                        userName={user.fullName}
                        userId={user.id}
                        userLicense={localLicense}
                        onStatusChange={setLocalStatus}
                        onLicenseChange={setLocalLicense}
                        onRestoreRequest={(mode) =>
                          mode === "reactivate" ? setReactivateOpen(true) : setUnarchiveOpen(true)
                        }
                        isDetailPage
                        lockedReason={protectedTip}
                      />
                    </div>

                    {/* Row 2: Job title. Captured in the Create User flow, so
                     *  it is the one line of context that belongs under a
                     *  person's name here. Empty reads as an italic, lighter
                     *  placeholder rather than a blank line, so the row keeps
                     *  its height and the absence is legible. */}
                    <p
                      className="truncate transition-all duration-250"
                      style={{
                        fontSize: isCompact ? 11 : 13,
                        lineHeight: 1,
                        color: user.jobTitle ? "#64748B" : "#94A3B8",
                        fontStyle: user.jobTitle ? "normal" : "italic",
                      }}
                    >
                      {user.jobTitle || "Job Title Not Defined"}
                    </p>

                    {/* Row 3: Tags, collapse on scroll. Extra 2px marginTop
                     *  adds to the flex `gap` so the name→tag gap reads as
                     *  slightly larger than the gaps above. */}
                    <div
                      className="overflow-hidden transition-all duration-250 ease-in-out"
                      style={{
                        maxHeight: isCompact ? 0 : 200,
                        opacity: isCompact ? 0 : 1,
                        marginTop: isCompact ? 0 : 2,
                      }}
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <TagIcon className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                        {/* Every tag reads the same: a tag is a label the admin
                         *  typed, not a status, so colour would imply meaning
                         *  the value does not carry. One slate treatment. */}
                        {userTags.map((tag) => {
                          return (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px]"
                              style={{
                                fontWeight: 600,
                                backgroundColor: "#FAFBFC",
                                color: "#475569",
                                borderColor: "#F1F5F9",
                              }}
                            >
                              {tag}
                              {tagGate.render && (
                                <button
                                  onClick={() => handleRemoveTag(tag)}
                                  className="opacity-60 hover:opacity-100 transition-opacity cursor-pointer ml-0.5 -mr-0.5"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </span>
                          );
                        })}
                        {!tagGate.render ? null : tagInputOpen ? (
                          <div className="inline-flex items-center gap-1.5">
                            <input
                              ref={tagInputRef}
                              value={tagInputValue}
                              onChange={(e) => setTagInputValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleAddTag();
                                if (e.key === "Escape") {
                                  setTagInputOpen(false);
                                  setTagInputValue("");
                                }
                              }}
                              placeholder="Enter tag..."
                              className="h-6 w-[120px] px-2 text-[11px] rounded-md border border-[#0A77FF]/40 bg-white text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:ring-2 focus:ring-[#0A77FF]/20"
                              autoFocus
                            />
                            <button
                              onClick={handleAddTag}
                              className="h-6 px-2 rounded-md bg-[#0A77FF] text-white text-[10px] cursor-pointer hover:bg-[#0862D0] transition-colors"
                              style={{ fontWeight: 600 }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setTagInputOpen(false);
                                setTagInputValue("");
                              }}
                              className="h-6 px-2 rounded-md border border-[#E2E8F0] bg-white text-[#64748B] text-[10px] cursor-pointer hover:bg-[#F8FAFC] transition-colors"
                              style={{ fontWeight: 500 }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setTagInputOpen(true);
                              setTimeout(() => tagInputRef.current?.focus(), 50);
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-dashed border-[#CBD5E1] px-2 py-0.5 text-[11px] text-[#94A3B8] hover:border-[#94A3B8] hover:text-[#64748B] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                            style={{ fontWeight: 500 }}
                          >
                            <Plus className="w-3 h-3" /> Add Tag
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ═══ RIGHT: CTAs + contact data ═══ */}
                <div className="shrink-0 flex flex-col items-end justify-between self-stretch">
                  <div
                    className="flex items-center transition-all duration-250"
                    style={{ gap: isCompact ? 6 : 8 }}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setIsFullscreen(!isFullscreen)}
                          className="rounded-lg border border-[#E2E8F0] flex items-center justify-center cursor-pointer shadow-sm transition-all duration-250"
                          /* Background pinned inline so the status-tinted
                             gradient overlay (Archived / Inactive) never
                             bleeds through. Hover is driven via inline
                             handlers because the inline `backgroundColor`
                             would otherwise win over Tailwind's hover
                             utility on specificity. */
                          style={{
                            width: isCompact ? 32 : 36,
                            height: isCompact ? 32 : 36,
                            backgroundColor: "#FFFFFF",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
                        >
                          {isFullscreen ? (
                            <Minimize2 className="w-4 h-4 text-[#64748B]" />
                          ) : (
                            <Maximize2 className="w-4 h-4 text-[#64748B]" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="z-[300]">
                        {isFullscreen ? "Exit Full Screen" : "Full Screen"}
                      </TooltipContent>
                    </Tooltip>

                    {localStatus !== "Archived" && (
                      <UserActionsMenu
                        user={{
                          id: user.id,
                          fullName: user.fullName,
                          email: user.email,
                          license: localLicense,
                          status: localStatus,
                        }}
                        variant="pill"
                        showLicenseActions
                        showArchive
                        onManageRoles={() => setActiveTab("roles")}
                        onStatusChange={(s) => {
                          // Cancelling an outstanding invite is the only menu
                          // action that lands on Pending Setup here. Reactivate
                          // returns the user to Active, and Unarchive is not
                          // offered because this menu is hidden on Archived.
                          if (s === "Pending Setup") setInviteContext("cancelled");
                          setLocalStatus(s);
                        }}
                        onLicenseChange={setLocalLicense}
                        trigger={
                          <button
                            className={`rounded-lg border border-[#E2E8F0] text-[#334155] inline-flex items-center gap-1.5 cursor-pointer shadow-sm transition-all duration-250 ${
                              isCompact ? "h-8 px-3 text-[12px]" : "h-9 px-3.5 text-[13px]"
                            }`}
                            /* Same pinned-background pattern as the
                               fullscreen toggle, guarantees solid white
                               over any status wash. */
                            style={{ fontWeight: 500, backgroundColor: "#FFFFFF" }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
                          >
                            Actions
                            <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
                          </button>
                        }
                      />
                    )}

                    {(() => {
                      const theme = getStatusHeaderTheme(localStatus, "user");
                      const spec = theme.primary ?? editPrimary("user");
                      /* One button, four meanings depending on status — so the
                       * capability it needs depends on status too. Unarchive
                       * and Reactivate are lifecycle, Resend is invitation,
                       * the default is plain editing. */
                      const capability =
                        theme.accent === "red" || localStatus === "Inactive"
                          ? access.canArchiveUser
                          : theme.accent === "blue" || localStatus === "Invite Expired"
                            ? access.canInvite
                            : access.canCreateEditUser;
                      const g = gate(true, capability);
                      if (!g.render) return null;
                      const onClick = () => {
                        if (theme.accent === "red") setUnarchiveOpen(true);
                        else if (localStatus === "Inactive") {
                          setReactivateOpen(true);
                        } else if (theme.accent === "blue" || localStatus === "Invite Expired") {
                          setResendInviteOpen(true);
                        } else {
                          setEditOpen(true);
                        }
                      };
                      const button = (
                        <StatusPrimaryButton spec={spec} onClick={onClick} compact={isCompact} />
                      );
                      /* Under the "disabled" style the CTA stays in place, dimmed,
                       * with the reason on hover rather than vanishing. */
                      return g.disabled ? (
                        <AccessGate capability={false} reason={g.reason}>
                          {button}
                        </AccessGate>
                      ) : (
                        button
                      );
                    })()}
                  </div>

                  {/* Contact data: collapses on scroll, right-aligned at bottom */}
                  <div
                    className="overflow-hidden transition-all duration-250 ease-in-out hidden md:block"
                    style={{
                      maxHeight: isCompact ? 0 : 120,
                      opacity: isCompact ? 0 : 1,
                    }}
                  >
                    <div className="flex flex-col gap-2 items-end pt-2">
                      {/* Email */}
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                        <a
                          href={`mailto:${user.email}`}
                          className="text-[12px] text-[#334155] hover:text-[#0A77FF] hover:underline transition-colors truncate max-w-[220px]"
                          style={{ fontWeight: 500 }}
                        >
                          {user.email}
                        </a>
                      </div>

                      {/* Phone */}
                      {primaryPhone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                          <span
                            className="text-[12px] text-[#334155]"
                            style={{ fontWeight: 500 }}
                          >
                            {primaryPhone.countryCode} {primaryPhone.number}
                          </span>
                          {user.phones && user.phones.length > 1 && (
                            <PhoneOverflow phones={user.phones.slice(1)} />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tab bar */}
              <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide border-t border-[#F1F5F9] px-4 lg:px-5">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`border-b-2 transition-all duration-200 whitespace-nowrap cursor-pointer ${
                        isActive
                          ? "border-[#0A77FF] text-[#0A77FF]"
                          : "border-transparent text-[#64748B] hover:text-[#334155] hover:border-[#CBD5E1]"
                      }`}
                      style={{
                        padding: isCompact ? "7px 12px" : "9px 12px",
                        fontSize: isCompact ? 12 : 12.5,
                        fontWeight: isActive ? 600 : 500,
                        transition:
                          "padding 250ms ease, font-size 250ms ease",
                      }}
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
        {/* Fade shadow under sticky header */}
        <div
          className="pointer-events-none transition-opacity duration-300"
          style={{
            height: 8,
            background:
              "linear-gradient(to bottom, rgba(248,250,252,0.8) 0%, rgba(248,250,252,0.4) 40%, rgba(248,250,252,0) 100%)",
            opacity: isCompact ? 1 : 0,
          }}
        />
      </div>

      {/* ═══ BODY ═══ */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
          className="flex-1 flex flex-col min-h-0"
        >
          <div
            className={`mx-auto px-4 lg:px-6 xl:px-8 py-5 flex-1 flex flex-col min-h-0 w-full transition-all duration-300 ${
              isFullscreen ? "max-w-full" : "max-w-[1440px] 2xl:max-w-[1600px]"
            }`}
          >
            {activeTab === "overview" && (
              <OverviewTab
                user={user}
                userStatus={localStatus}
                onStatusChange={setLocalStatus}
                onLicenseChange={setLocalLicense}
                onSwitchTab={(tab) => setActiveTab(tab as TabId)}
                inviteContext={inviteContext}
              />
            )}

            {activeTab === "roles" && <RolesPermissionsTab user={user} liveLicense={localLicense as UserDetail["license"]} liveStatus={localStatus as UserDetail["status"]} />}
            {activeTab === "alerts" && <AlertsTab user={user} archived={isArchived} />}
            {activeTab === "activity" && <ActivityTab user={user} archived={isArchived} />}
            {/* Notes are not permission controlled (Eli, 7 Oct 2026): anyone
                who can open the user can view, add and delete them. An archived
                user is read-only here, as on Attachments. */}
            {activeTab === "notes" && (
              <UserNotesTab
                notes={userNotes}
                onNotesChange={(next) => setUserNotes(id, next)}
                author={CURRENT_USER.name}
                recordName={user.fullName}
                placeholder="Add a note about this user"
                readOnly={isArchived}
              />
            )}
            {activeTab === "attachments" && <AttachmentsTab archived={isArchived} />}
            {activeTab === "communications" && <CommunicationsTab />}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* ─── Action Modals owned by this page ─── */}
      <EditUserModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        userId={id}
      />
      <UnarchiveUserModal
        open={unarchiveOpen}
        onClose={() => setUnarchiveOpen(false)}
        userId={id}
        wasInvitePending={false}
        onStatusChange={(s) => {
          setLocalStatus(s);
          if (s === "Pending Setup") setInviteContext("unarchived");
        }}
        onLicenseChange={(l) => setLocalLicense(l)}
      />
      <UnarchiveUserModal
        open={reactivateOpen}
        onClose={() => setReactivateOpen(false)}
        userId={id}
        wasInvitePending={false}
        onStatusChange={(s) => setLocalStatus(s)}
        onLicenseChange={(l) => setLocalLicense(l)}
        mode="reactivate"
      />
      <ResendInviteModal
        open={resendInviteOpen}
        onClose={() => setResendInviteOpen(false)}
        email={user.email}
        userName={user.fullName}
      />
    </div>
  );
}
