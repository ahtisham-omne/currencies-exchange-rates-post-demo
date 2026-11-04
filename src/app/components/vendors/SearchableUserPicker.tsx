import React, { useState, useMemo } from "react";
import { Search, X, Users, Shield, Plus, Bell, Info } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/app/components/ui/dialog";
import { OverflowTooltip } from "@/app/components/data-table/OverflowTooltip";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/app/components/ui/tooltip";
import { Switch } from "@/app/components/ui/switch";
import { SYSTEM_USERS, SYSTEM_ROLES } from "@/app/data/systemUsers";
import { userPhotoFor } from "@/app/utils/userAvatar";
import { CollapseReveal } from '@/app/components/ui/collapse-reveal';

// Notification recipients picker (review 7/14/26):
// - Inactive users have no system access and can't receive notifications,
//   so they are filtered out entirely — no Active/Inactive labels either.
// - Access level ("Full access") isn't meaningful here; rows show the ROLE
//   (e.g. Procurement Manager) so you know who you're notifying by function.
// - Role rows show how many recipients they resolve to, with an expandable
//   "See users" list (first N + "+X more") instead of dumping everyone.
// - Compacted ~20% so it reads right at 100% zoom.

const ROLE_COLORS = ["hsl(var(--accent))", "#F0FDF4", "#F5F3FF", "#FEFCE8", "#FEF2F2", "#ECFDF5", "#FDF4FF", "#FFFBEB"];
const ROLE_TEXT_COLORS = ["#1D4ED8", "#15803D", "hsl(var(--violet))", "#A16207", "hsl(var(--destructive))", "hsl(var(--success))", "#A21CAF", "#B45309"];
const USER_BG_COLORS = ["#DBEAFE", "#D1FAE5", "#EDE9FE", "#FEF9C3", "#FEE2E2", "#CFFAFE", "#FCE7F3", "#FEF3C7"];
const USER_TEXT_COLORS = ["#1E40AF", "#166534", "#5B21B6", "#854D0E", "#991B1B", "#0E7490", "#9D174D", "#92400E"];

function getRoleColor(i: number) { return { bg: ROLE_COLORS[i % ROLE_COLORS.length], text: ROLE_TEXT_COLORS[i % ROLE_TEXT_COLORS.length] }; }
function getUserColor(i: number) { return { bg: USER_BG_COLORS[i % USER_BG_COLORS.length], text: USER_TEXT_COLORS[i % USER_TEXT_COLORS.length] }; }

// Everything this picker shows is an ACTIVE user — inactive users can't
// receive notifications, so they never enter any list here.
const ACTIVE_USERS = SYSTEM_USERS.filter((u) => u.status === "Active");
const ACTIVE_ROLES = SYSTEM_ROLES.filter((r) => r.status === "Active");
const activeUsersForRole = (roleName: string) => ACTIVE_USERS.filter((u) => u.role === roleName);

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return <>{parts.map((p, i) => p.toLowerCase() === query.toLowerCase() ? <mark key={i} className="bg-transparent px-0.5 rounded-sm" style={{ backgroundColor: "#FEFCE8", color: "#854D0E", fontWeight: 500 }}>{p}</mark> : <React.Fragment key={i}>{p}</React.Fragment>)}</>;
}

// The Department filter dropdown that used to live beside the Roles/Users
// chips is gone (user 10/1): search already matches department text, and
// the dropdown was noise in every notify modal.

/** Expandable member preview for a role — first N users, "+X more". */
function RoleUsersPreview({ roleName }: { roleName: string }) {
  const members = activeUsersForRole(roleName);
  const SHOWN = 8;
  const shown = members.slice(0, SHOWN);
  const more = members.length - shown.length;
  return (
    <div className="mt-1.5 rounded-lg border border-border/70 bg-slate-50/60 max-h-[148px] overflow-y-auto divide-y divide-border/50">
      {shown.map((u, i) => {
        const c = getUserColor(i);
        return (
          <div key={u.id} className="flex items-center gap-2 px-2.5 py-1.5">
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] shrink-0" style={{ fontWeight: 700, backgroundColor: c.bg, color: c.text }}>
              {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </span>
            <span className="text-[11px] text-foreground truncate flex-1" style={{ fontWeight: 500 }}>{u.name}</span>
            <span className="text-[10px] text-slate-400 truncate max-w-[140px]">{u.email}</span>
          </div>
        );
      })}
      {more > 0 && (
        <div className="px-2.5 py-1.5 text-[10px] text-slate-400" style={{ fontWeight: 600 }}>+{more} more</div>
      )}
      {members.length === 0 && (
        <div className="px-2.5 py-2 text-[11px] text-slate-400">No active users in this role yet.</div>
      )}
    </div>
  );
}

interface SearchableUserPickerProps {
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  accentColor?: string;
  accentBg?: string;
  accentBorder?: string;
  accentText?: string;
  label?: string;
  placeholder?: string;
}

// ── Notify card (the system's ONE notify interaction, user 9/9) ──────
// Bordered card, heading + helper flush-left, Switch on the RIGHT
// (BA 9/6), and the recipients picker only while the toggle is on —
// exactly the resubmit modal's recipe, exported so the exception, hold,
// reversal and credit-memo modals all render the same block.
export function NotifyToggleCard({
  title,
  helper,
  checked,
  onCheckedChange,
  selectedIds,
  onSelectionChange,
  accentColor,
  accentBg,
  accentBorder,
  accentText,
}: {
  title: string;
  helper: string;
  checked: boolean;
  onCheckedChange: (on: boolean) => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  accentColor?: string;
  accentBg?: string;
  accentBorder?: string;
  accentText?: string;
}) {
  return (
    <div className="w-full rounded-xl border border-border bg-white shadow-sm px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 text-left">
          <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>{title}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{helper}</p>
        </div>
        <Switch checked={checked} onCheckedChange={(v) => onCheckedChange(v === true)} className="scale-90 shrink-0 mt-0.5" />
      </div>
      {checked && (
        <div className="pt-2.5">
          <SearchableUserPicker
            selectedIds={selectedIds}
            onSelectionChange={onSelectionChange}
            accentColor={accentColor}
            accentBg={accentBg}
            accentBorder={accentBorder}
            accentText={accentText}
            label=""
          />
        </div>
      )}
    </div>
  );
}

export function SearchableUserPicker({
  selectedIds,
  onSelectionChange,
  accentColor = "hsl(var(--primary))",
  accentBg = "hsl(var(--accent))",
  accentBorder = "#BFDBFE",
  accentText = "#1E40AF",
  label = "Select Recipients",
}: SearchableUserPickerProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"roles" | "users">("roles");
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());

  const filteredUsers = useMemo(() => {
    let list = [...ACTIVE_USERS];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((u) => u.name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q) || u.department.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    return list;
  }, [search]);

  const filteredRoles = useMemo(() => {
    let list = [...ACTIVE_ROLES];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q) || r.department.toLowerCase().includes(q));
    }
    return list;
  }, [search]);

  const selectedUsers = useMemo(() => ACTIVE_USERS.filter((u) => selectedIds.has(u.id)), [selectedIds]);
  const selectedRoles = useMemo(() => ACTIVE_ROLES.filter((r) => selectedIds.has(r.id)), [selectedIds]);
  // The count equals the PEOPLE who will be notified (9/22/26 review
  // response, Claude C06-U3): a role selection resolves to its members,
  // deduplicated against directly picked users — never "3 names beside
  // 2 recipients" again.
  const totalSelected = useMemo(() => {
    const people = new Set(selectedUsers.map((u) => u.id));
    selectedRoles.forEach((r) => activeUsersForRole(r.name).forEach((u) => people.add(u.id)));
    return people.size;
  }, [selectedUsers, selectedRoles]);

  const toggle = (id: string) => { const next = new Set(selectedIds); next.has(id) ? next.delete(id) : next.add(id); onSelectionChange(next); };
  const remove = (id: string) => { const next = new Set(selectedIds); next.delete(id); onSelectionChange(next); };
  const toggleExpanded = (id: string) => setExpandedRoles((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  return (
    <div>
      {/* One affordance per state (BA 9/6): the header row only renders
          when there's a label to show — an empty label used to leave the
          count pill floating alone. The count itself lives on the summary
          row, so no duplicate pill either. */}
      {label && (
        <div className="mb-2">
          <p className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>{label}</p>
        </div>
      )}

      {totalSelected > 0 && (() => {
        /* One fixed-height summary row (feedback 7/20/26): overlapping
           initials avatars + count + Manage. The modal never grows with
           the selection; hovering the stack opens the rich scrollable
           panel (Linked Records / partner Points of Contact recipe) and
           the Manage recipients modal stays the place to edit. */
        const entries = [
          ...selectedRoles.map((r) => ({ id: r.id, name: r.name, isRole: true, count: activeUsersForRole(r.name).length, sub: "" })),
          ...selectedUsers.map((u) => ({ id: u.id, name: u.name, isRole: false, count: 0, sub: u.role })),
        ];
        const STACKED = 4;
        const stacked = entries.slice(0, STACKED);
        const extra = entries.length - stacked.length;
        const openManage = () => { setModalOpen(true); setSearch(""); };
        return (
          <div
            className="flex items-center gap-2 h-9 px-2.5 rounded-md border"
            style={{ backgroundColor: accentBg, borderColor: accentBorder }}
          >
            <OverflowTooltip
              category="Recipients"
              items={entries.map((e) => ({
                id: e.id,
                name: e.name,
                subtitle: e.isRole ? `Role · ${e.count} recipient${e.count === 1 ? "" : "s"}` : e.sub,
                initials: e.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase(),
                avatarBg: accentBg,
                avatarFg: accentText,
              }))}
              onItemClick={openManage}
              onViewMore={openManage}
              viewMoreLabel={`Manage All ${totalSelected} Recipients`}
            >
              <span className="flex items-center cursor-default">
                {stacked.map((e, i) => (
                  <span
                    key={e.id}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] ring-2 ring-white shrink-0 overflow-hidden ${i > 0 ? "-ml-1.5" : ""}`}
                    style={{ fontWeight: 700, backgroundColor: accentColor, color: "#fff", zIndex: STACKED - i }}
                  >
                    {userPhotoFor(e.name)
                      ? <img src={userPhotoFor(e.name)} alt="" className="w-full h-full object-cover" />
                      : e.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                ))}
                {extra > 0 && (
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] ring-2 ring-white bg-white shrink-0 -ml-1.5 "
                    style={{ fontWeight: 700, color: accentText }}
                  >
                    +{extra}
                  </span>
                )}
              </span>
            </OverflowTooltip>
            <span className="text-[11px] min-w-0 truncate" style={{ fontWeight: 600, color: accentText }}>
              {totalSelected} recipient{totalSelected === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); openManage(); }}
              className="ml-auto text-[11px] shrink-0 hover:underline cursor-pointer"
              style={{ fontWeight: 600, color: accentText }}
            >
              Manage
            </button>
          </div>
        );
      })()}

      {/* Proper button chrome, not a dashed chip — solid border, white bg,
          shadow, accent tint on hover (CTA feedback 7/15/26). ONE CTA per
          state (BA 9/6): this add button exists only while nothing is
          selected — once recipients exist, the summary row's Manage is
          the single edit affordance. */}
      {totalSelected === 0 && (
        <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setModalOpen(true); setSearch(""); }}
          className="w-full inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg border bg-white shadow-sm transition-all cursor-pointer text-[12px]"
          style={{ borderColor: accentBorder, color: accentText, fontWeight: 600 }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = accentBg; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
        >
          <Plus className="w-3.5 h-3.5" />Add notification recipients
        </button>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent overlayClassName="z-[290]" className="!p-0 !gap-0 !bg-white overflow-hidden flex flex-col z-[300] !border-border/60 w-[calc(100%-2rem)] sm:w-[520px]"
          style={{ maxWidth: "min(560px, calc(100vw - 2rem))", maxHeight: "min(80vh, 640px)", borderRadius: 16, boxShadow: "0 24px 80px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
          showCloseButton={false}>
          <DialogTitle className="sr-only">Select Notification Recipients</DialogTitle>
          <DialogDescription className="sr-only">Search and select users or roles to notify.</DialogDescription>

          <div className="px-4 pt-4 pb-3 border-b border-border bg-white shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: accentBg }}><Bell className="w-4 h-4" style={{ color: accentColor }} /></div>
                <div>
                  <h3 className="text-[14px] text-foreground" style={{ fontWeight: 700 }}>Notification Recipients</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Select roles or individual users to notify</p>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div className="relative mb-2.5">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users and roles by name, department, or email…"
                className="w-full h-9 pl-9 pr-8 rounded-lg border border-border bg-slate-50 text-[12px] text-foreground placeholder:text-slate-400/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white transition-colors" autoFocus />
              {search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted transition-colors cursor-pointer"><X className="w-3.5 h-3.5 text-slate-400" /></button>}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {(["roles", "users"] as const).map((t) => {
                const isActive = tab === t;
                const count = t === "roles" ? filteredRoles.length : filteredUsers.length;
                return (
                  <button key={t} type="button" onClick={() => { setTab(t); setSearch(""); }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? "border-primary bg-accent hover:bg-[#D6E8FF]"
                        : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"
                    }`}
                    style={{ fontWeight: isActive ? 500 : 400, color: isActive ? "hsl(var(--primary))" : undefined }}
                  >
                    {t === "roles" ? <Shield className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                    {t === "roles" ? "Roles" : "Users"}
                    <span className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${isActive ? "bg-primary/10" : "bg-muted"}`}
                      style={{ fontWeight: 600, color: isActive ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}>{count}</span>
                  </button>
                );
              })}

            </div>
          </div>

          <div className="flex items-center gap-3 mx-3 px-4 py-1.5 bg-muted/30 border-b border-border shrink-0 rounded-t-md">
            {(() => {
              const currentList = tab === "roles" ? filteredRoles : filteredUsers;
              const allIds = currentList.map((item) => item.id);
              const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
              const someSelected = !allSelected && allIds.some((id) => selectedIds.has(id));
              return (
                <button type="button" onClick={() => {
                  const next = new Set(selectedIds);
                  if (allSelected) { allIds.forEach((id) => next.delete(id)); } else { allIds.forEach((id) => next.add(id)); }
                  onSelectionChange(next);
                }}
                  className="w-[16px] h-[16px] rounded-[4px] border-[1.5px] flex items-center justify-center shrink-0 transition-all cursor-pointer"
                  style={{ borderColor: allSelected || someSelected ? accentColor : "#CBD5E1", backgroundColor: allSelected ? accentColor : "transparent" }}
                >
                  {allSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  {someSelected && !allSelected && <div className="w-2 h-0.5 rounded-full" style={{ backgroundColor: accentColor }} />}
                </button>
              );
            })()}
            <div className="w-7" />
            <span className="flex-1 text-muted-foreground text-[11px] font-normal">{tab === "roles" ? "Role" : "User"}</span>
            <span className="w-[110px] text-muted-foreground text-[11px] font-normal">{tab === "roles" ? "Recipients" : "Role"}</span>
            <span className="w-[100px] text-muted-foreground text-[11px] font-normal">Department</span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide bg-white px-3 pb-2">
            {/* Global search shows BOTH result sets — searching a name
                surfaces users and roles together, grouped, regardless of
                the active tab (design review 7/9/26). Tabs still scope
                browsing when there's no query. */}
            {(() => {
              const searchActive = search.trim().length > 0;
              const showRoles = searchActive ? filteredRoles.length > 0 : tab === "roles";
              const showUsers = searchActive ? filteredUsers.length > 0 : tab === "users";
              const nothingToShow = searchActive
                ? filteredRoles.length === 0 && filteredUsers.length === 0
                : tab === "roles"
                  ? filteredRoles.length === 0
                  : filteredUsers.length === 0;
              if (nothingToShow) {
                return (
                  <div className="px-4 py-10 text-center">
                    <Users className="w-8 h-8 text-border mx-auto mb-2" />
                    <p className="text-[12px] text-slate-400" style={{ fontWeight: 500 }}>
                      {searchActive ? "No users or roles match your search" : tab === "roles" ? "No roles match your filters" : "No users match your filters"}
                    </p>
                  </div>
                );
              }
              return (
                <>
                  {showRoles && (
                <div>
                  {searchActive && (
                    <div className="flex items-center gap-1.5 px-4 py-1 bg-muted/30 border-b border-border/50">
                      <Shield className="w-3 h-3 text-slate-400" />
                      <span className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Roles ({filteredRoles.length})</span>
                    </div>
                  )}
                  {filteredRoles.map((role, i) => {
                    const isSelected = selectedIds.has(role.id);
                    const c = getRoleColor(i);
                    const memberCount = activeUsersForRole(role.name).length;
                    const expanded = expandedRoles.has(role.id);
                    return (
                      <div key={role.id} className={`border-b border-border/50 ${isSelected ? "bg-primary/[0.03]" : "hover:bg-muted/50"}`}>
                        <div role="button" tabIndex={0} onClick={() => toggle(role.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(role.id); } }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-left transition-colors cursor-pointer">
                          <div className="w-[16px] h-[16px] rounded-[4px] border-[1.5px] flex items-center justify-center shrink-0 transition-all"
                            style={{ borderColor: isSelected ? accentColor : "#CBD5E1", backgroundColor: isSelected ? accentColor : "transparent" }}>
                            {isSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: c.bg }}><Shield className="w-3.5 h-3.5" style={{ color: c.text }} /></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-[12px] text-foreground truncate" style={{ fontWeight: 600 }}><HighlightText text={role.name} query={search} /></p>
                              {role.description && (
                                <Tooltip><TooltipTrigger asChild><span><Info className="w-3 h-3 text-slate-300 shrink-0" /></span></TooltipTrigger>
                                  <TooltipContent side="bottom" className="max-w-[240px] text-[11px] z-[350] rounded-xl bg-white/95 backdrop-blur-md border border-border/80 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)]">{role.description}</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </div>
                          <div className="w-[110px] flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] px-1.5 py-[2px] rounded-full bg-muted text-slate-500 " style={{ fontWeight: 600 }}>{memberCount}</span>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleExpanded(role.id); }}
                              className="text-[10px] text-primary hover:text-blue-700 transition-colors cursor-pointer"
                              style={{ fontWeight: 600 }}
                            >
                              {expanded ? "Hide" : "See Users"}
                            </button>
                          </div>
                          <span className="w-[100px] text-[11px] text-slate-500 truncate shrink-0"><HighlightText text={role.department} query={search} /></span>
                        </div>
                        <CollapseReveal open={expanded}>
                          <div className="px-4 pb-2 pl-[72px]">
                            <RoleUsersPreview roleName={role.name} />
                          </div>
                        </CollapseReveal>
                      </div>
                    );
                  })}
                </div>
                  )}
                  {showUsers && (
                <div>
                  {searchActive && (
                    <div className="flex items-center gap-1.5 px-4 py-1 bg-muted/30 border-b border-border/50">
                      <Users className="w-3 h-3 text-slate-400" />
                      <span className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Users ({filteredUsers.length})</span>
                    </div>
                  )}
                  {filteredUsers.map((user, i) => {
                    const isSelected = selectedIds.has(user.id);
                    const c = getUserColor(i);
                    return (
                      <button key={user.id} type="button" onClick={() => toggle(user.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors border-b border-border/50 ${isSelected ? "bg-primary/[0.03]" : "hover:bg-muted/50"}`}>
                        <div className="w-[16px] h-[16px] rounded-[4px] border-[1.5px] flex items-center justify-center shrink-0 transition-all"
                          style={{ borderColor: isSelected ? accentColor : "#CBD5E1", backgroundColor: isSelected ? accentColor : "transparent" }}>
                          {isSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] shrink-0" style={{ fontWeight: 700, backgroundColor: c.bg, color: c.text }}>
                          {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-foreground truncate" style={{ fontWeight: 600 }}><HighlightText text={user.name} query={search} /></p>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5"><HighlightText text={user.email} query={search} /></p>
                        </div>
                        <span className="w-[110px] text-[11px] text-slate-500 truncate shrink-0"><HighlightText text={user.role} query={search} /></span>
                        <span className="w-[100px] text-[11px] text-slate-500 truncate shrink-0"><HighlightText text={user.department} query={search} /></span>
                      </button>
                    );
                  })}
                </div>
                  )}
                </>
              );
            })()}
          </div>

          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-white shrink-0">
            <span className="text-[12px] text-slate-500" style={{ fontWeight: 500 }}>{totalSelected > 0 ? `${totalSelected} recipient${totalSelected !== 1 ? "s" : ""} selected` : "No recipients selected"}</span>
            <div className="flex items-center gap-2.5">
              {totalSelected > 0 && (
                <button onClick={() => onSelectionChange(new Set())} className="text-[12px] text-slate-500 hover:text-red-500 transition-colors cursor-pointer px-3 py-1.5 rounded-lg hover:bg-red-50 border border-border hover:border-red-200" style={{ fontWeight: 500 }}>Clear All</button>
              )}
              <button onClick={() => setModalOpen(false)} className="px-4 py-1.5 rounded-lg text-[12px] text-white cursor-pointer transition-colors hover:opacity-90 shadow-sm" style={{ fontWeight: 600, backgroundColor: accentColor }}>Done</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
