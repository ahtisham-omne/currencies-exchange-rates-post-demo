import { useEffect, useMemo, useState } from "react";
import { FlagImage, flagEmojiCode } from "../currency/FlagImage";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import {
  Archive,
  Search,
  Check,
  ChevronRight,
  Users,
  AlertTriangle,
  X,
  Building2,
  Zap,
  ShieldCheck,
  Maximize2,
  Minimize2,
  MapPin,
  ArrowLeft,
  Plus,
} from "lucide-react";
import { Button } from "../ui/button";
import type { Vendor } from "../../data/vendors";
import { PARTNER_GROUPS } from "./partnerConstants";
import { getAvatarTint } from "../../utils/avatarTints";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "../ui/hover-card";
import { QuickViewPanel, type QuickViewData } from "./QuickViewPanel";
import { highlightMatch } from "../../../lib/utils";

interface ArchivePartnerGroupModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupId: string;
  groupName: string;
  /** Partners that use THIS group as their primary — they must be
   *  reassigned to another group before the group can be archived. */
  primaryPartners: Vendor[];
  /** Fired once reassignment is complete and the user has answered the
   *  configuration-push question. The parent persists the archive. */
  onArchived: (result: { assignments: Record<string, string>; push: boolean }) => void;
}

// Tiny initials-avatar tint, derived deterministically from the name so the
// same partner always reads the same color (matches the list surfaces).
const AVATAR_TINTS = [
  { bg: "#EBF3FF", fg: "#094D9F" },
  { bg: "#F0FDF4", fg: "#15803D" },
  { bg: "#FEF3C7", fg: "#B45309" },
  { bg: "#F0EBFF", fg: "#6D28D9" },
  { bg: "#FFE4E6", fg: "#BE123C" },
  { bg: "#ECFEFF", fg: "#0E7490" },
];
function tintFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}
function initialsFor(name: string) {
  return name
    .split(/[\s&]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
function partnerTypeLabel(v: Vendor) {
  const t = v.partnerTypes || [];
  const parts: string[] = [];
  if (t.includes("vendor")) parts.push("Vendor");
  if (t.includes("customer")) parts.push("Customer");
  return parts.join(" · ") || "Partner";
}

// Group template-type derivation + palette — mirrors the listing
// (PartnerGroupsPage `enrichGroup` / TYPE_PALETTE) so the type pills shown
// here match what the listing shows for the same group.
const GROUP_TYPE_PALETTE: Record<"vendor" | "customer", { bg: string; fg: string; border: string; label: string }> = {
  vendor: { bg: "#EBF3FF", fg: "#0548A3", border: "#A8D2FF", label: "Vendor" },
  customer: { bg: "#F5F3FF", fg: "#5B21B6", border: "#DDD6FE", label: "Customer" },
};
const GROUP_TEMPLATE_TYPES: ("vendor" | "customer" | "both")[] = ["vendor", "customer", "both"];
function groupHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}
function groupScopes(g: { id: string; scope?: ("vendor" | "customer")[] }): ("vendor" | "customer")[] {
  const scope = g.scope;
  const type = scope && scope.length > 0
    ? (scope.includes("vendor") && scope.includes("customer") ? "both" : scope[0] === "customer" ? "customer" : "vendor")
    : GROUP_TEMPLATE_TYPES[groupHash(g.id) % GROUP_TEMPLATE_TYPES.length];
  return type === "both" ? ["vendor", "customer"] : [type];
}

const modalBaseTransition =
  "transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";

export function ArchivePartnerGroupModal({
  open,
  onOpenChange,
  groupId,
  groupName,
  primaryPartners,
  onArchived,
}: ArchivePartnerGroupModalProps) {
  const [step, setStep] = useState<"reassign" | "push">("reassign");
  const [isFullScreen, setIsFullScreen] = useState(false);
  // partnerId -> target groupId
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [partnerSearch, setPartnerSearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  // Quick-view panel opened from a partner avatar/name (same interaction
  // as the listing). Rendered above this modal via a high zIndex.
  const [quickView, setQuickView] = useState<QuickViewData | null>(null);

  // Reset everything whenever the modal is (re)opened so a second archive
  // attempt never inherits stale selections.
  useEffect(() => {
    if (open) {
      setStep("reassign");
      setIsFullScreen(false);
      setAssignments({});
      setCheckedIds(new Set());
      setPartnerSearch("");
      setGroupSearch("");
      setQuickView(null);
    }
  }, [open]);

  const total = primaryPartners.length;
  const assignedCount = Object.keys(assignments).length;
  const allAssigned = total > 0 && assignedCount === total;

  const targetGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    return PARTNER_GROUPS.filter(
      (g) =>
        g.id !== groupId &&
        (!q || g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q)),
    );
  }, [groupSearch, groupId]);

  const filteredPartners = useMemo(() => {
    const q = partnerSearch.trim().toLowerCase();
    if (!q) return primaryPartners;
    return primaryPartners.filter(
      (p) =>
        (p.displayName || p.companyName).toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q),
    );
  }, [partnerSearch, primaryPartners]);

  // Selection drives both bulk-assign (pick partners → click a group) and
  // bulk-remove (pick partners already assigned → Remove from group). All
  // visible rows are selectable so "Select all" covers both flows.
  const allVisibleChecked =
    filteredPartners.length > 0 && filteredPartners.every((p) => checkedIds.has(p.id));

  const groupNameById = (gid: string) => PARTNER_GROUPS.find((g) => g.id === gid)?.name || "Group";

  // Per-target rollup so the user can see how the multi-group split is shaping up.
  const assignedCountByGroup = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(assignments).forEach((gid) => { counts[gid] = (counts[gid] || 0) + 1; });
    return counts;
  }, [assignments]);

  function toggleCheck(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleChecked) filteredPartners.forEach((p) => next.delete(p.id));
      else filteredPartners.forEach((p) => next.add(p.id));
      return next;
    });
  }

  function assignToGroup(gid: string) {
    if (checkedIds.size === 0) return;
    setAssignments((prev) => {
      const next = { ...prev };
      checkedIds.forEach((id) => { next[id] = gid; });
      return next;
    });
    setCheckedIds(new Set());
  }

  function unassign(id: string) {
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  // Bulk remove from a specific group — clears every partner currently
  // assigned to it (the "assigned the wrong partners here" recovery path,
  // triggered from the group card itself).
  function removeFromGroup(gid: string) {
    setAssignments((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((pid) => { if (next[pid] === gid) delete next[pid]; });
      return next;
    });
  }

  function finalize(push: boolean) {
    onArchived({ assignments, push });
    onOpenChange(false);
  }

  const modalSizeClass = isFullScreen
    ? `!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full ${modalBaseTransition} !max-w-[calc(100%-1rem)] sm:!max-w-[calc(100%-1.5rem)] lg:!max-w-[calc(100%-2rem)] !max-h-[calc(100%-1rem)] sm:!max-h-[calc(100%-1.5rem)] lg:!max-h-[calc(100%-2rem)] !rounded-2xl`
    : `!fixed !top-[50%] !left-[50%] !translate-x-[-50%] !translate-y-[-50%] !w-[calc(100%-2rem)] ${modalBaseTransition} !max-w-[100%] sm:!max-w-[min(70vw,1320px)] !h-[100dvh] sm:!h-[90vh] rounded-none sm:!rounded-2xl`;

  return (
   <>
    {/* Reassignment modal stays mounted/visible the whole time — the push
        confirmation layers on top of it, so the user keeps their reassignment
        context until they actually make the push decision. */}
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        overlayClassName="z-[225]"
        className={`flex flex-col p-0 gap-0 border-0 sm:border z-[230] ${modalSizeClass}`}
        style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
        // Keep this modal open when the QuickView panel or the push modal
        // (both rendered outside this content) are interacted with — they
        // handle their own dismissal.
        onPointerDownOutside={(e) => { if (quickView || step === "push") e.preventDefault(); }}
        onInteractOutside={(e) => { if (quickView || step === "push") e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (quickView || step === "push") e.preventDefault(); }}
      >
        <DialogTitle className="sr-only">Move partners to a new primary group before archiving {groupName}</DialogTitle>
        <DialogDescription className="sr-only">
          Reassign the partners that use {groupName} as their primary group, then archive it.
        </DialogDescription>

        {/* Header bar — compact, matching the creation modals. */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border bg-white sm:rounded-t-2xl">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#FEE2E2" }}>
              <Archive className="w-[18px] h-[18px]" style={{ color: "rgb(var(--destructive))" }} />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] tracking-[-0.01em] truncate" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                Move Partners to a New Primary Group
              </h2>
              <p className="text-[12px] text-muted-foreground truncate">
                {groupName} · {total} {total === 1 ? "partner uses" : "partners use"} this group as primary
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              {isFullScreen ? "Exit Full" : "Full View"}
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

            {/* Status banner — tight full-bleed strip under the header,
                matching the creation modal's Configure banner (indigo when
                ready, amber while reassignment is still required). */}
            <div className={`shrink-0 border-b px-4 py-1.5 flex items-center gap-2 ${
              allAssigned ? "bg-[#EEF2FF] border-[#E0E7FF]" : "bg-amber-50/70 border-amber-200"
            }`}>
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-[5px] bg-white border shrink-0 ${
                allAssigned ? "border-[#E0E7FF] text-[#4F46E5]" : "border-amber-200 text-amber-700"
              }`}>
                {allAssigned ? <ShieldCheck className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
              </span>
              <p className={`text-[11px] truncate min-w-0 flex-1 ${allAssigned ? "text-[#312E81]" : "text-amber-900"}`} style={{ fontWeight: 500 }}>
                {allAssigned ? (
                  <>All <span style={{ fontWeight: 700 }}>{total}</span> partners moved to a new primary group. Continue to finish archiving.</>
                ) : (
                  <>Can't archive yet. <span style={{ fontWeight: 700 }}>{total - assignedCount}</span> of {total}{" "}
                  {total - assignedCount === 1 ? "partner uses" : "partners use"} this group as their primary and must be moved to a new primary group first.</>
                )}
              </p>
            </div>

            {/* Two-pane body — full-bleed, split by a single separator line
                (matches the Qualified Items modal: no padded cards). */}
            <div className="flex-1 min-h-0 flex overflow-hidden">
              {/* Left rail — primary partners */}
              <div className="w-[30%] min-w-[300px] shrink-0 flex flex-col border-r border-border overflow-hidden bg-white">
                <div className="px-3 pt-3 pb-2 border-b border-muted shrink-0">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[12px] text-foreground min-w-0 truncate" style={{ fontWeight: 600 }}>
                      Primary Partners for This Group
                      <span className="ml-1.5 text-[11px] text-slate-400" style={{ fontWeight: 500 }}>{assignedCount}/{total}</span>
                    </span>
                    <button
                      onClick={toggleSelectAll}
                      disabled={filteredPartners.length === 0}
                      className="text-[11px] text-primary hover:underline disabled:text-slate-300 disabled:no-underline cursor-pointer disabled:cursor-default shrink-0"
                      style={{ fontWeight: 500 }}
                    >
                      {allVisibleChecked ? "Clear Selection" : "Select All"}
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      value={partnerSearch}
                      onChange={(e) => setPartnerSearch(e.target.value)}
                      placeholder="Search partners…"
                      className="w-full h-8 pl-8 pr-3 rounded-lg border border-border bg-white text-[12px] text-foreground placeholder:text-slate-400 focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
                  {filteredPartners.length === 0 && (
                    <div className="flex-1 flex items-center justify-center text-[12px] text-slate-400 px-3 text-center">
                      No partners match "{partnerSearch}".
                    </div>
                  )}
                  {filteredPartners.map((p) => {
                    const name = p.displayName || p.companyName;
                    const assignedTo = assignments[p.id];
                    const checked = checkedIds.has(p.id);
                    const tint = tintFor(name);
                    return (
                      <div
                        key={p.id}
                        onClick={() => toggleCheck(p.id)}
                        className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                          checked
                            ? "bg-blue-50/60"
                            : assignedTo
                              ? "bg-[#F8FAFC] hover:bg-slate-50"
                              : "hover:bg-slate-50"
                        }`}
                      >
                        <div
                          className={`w-[18px] h-[18px] rounded-md flex items-center justify-center shrink-0 transition-colors ${
                            checked ? "bg-primary" : "border-[1.5px] border-slate-300 bg-white"
                          }`}
                        >
                          {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                        </div>
                        <HoverCard>
                          <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setQuickView({ type: "contact", item: { id: p.id, name, subtitle: "Primary Partner" }, vendorName: name }); }}
                              className="shrink-0 cursor-pointer rounded-lg"
                              aria-label={`Quick view ${name}`}
                            >
                              {p.profileImage ? (
                                <img src={p.profileImage} alt="" className="w-7 h-7 rounded-lg object-cover" />
                              ) : (
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px]" style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 700 }}>
                                  {initialsFor(name)}
                                </div>
                              )}
                            </button>
                          </HoverCardTrigger>
                          <HoverCardContent
                            side="right"
                            align="start"
                            className="z-[290] w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden"
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          >
                            <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
                              <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                              <div className="flex items-center gap-3 relative">
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[11px]" style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 700 }}>
                                  {initialsFor(name)}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{name}</p>
                                  <p className="text-[11px] text-slate-400 truncate">{p.code}</p>
                                </div>
                              </div>
                            </div>
                            <div className="bg-white px-3.5 py-3 space-y-2">
                              <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                                <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{partnerTypeLabel(p)}</span>
                              </div>
                              <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate"><span className="mr-1"><FlagImage code={flagEmojiCode(p.countryFlag)} className="text-[13px]" /></span>{p.country}</span>
                              </div>
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setQuickView({ type: "contact", item: { id: p.id, name, subtitle: "Primary Partner" }, vendorName: name }); }}
                            className="block min-w-0 max-w-full text-left cursor-pointer"
                          >
                            <span className="text-[12.5px] text-foreground truncate leading-tight block hover:text-primary hover:underline transition-colors" style={{ fontWeight: 500 }}>{highlightMatch(name, partnerSearch)}</span>
                          </button>
                          <p className="text-[10.5px] text-slate-400 truncate leading-tight">{partnerTypeLabel(p)}</p>
                        </div>
                        {assignedTo && (
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] border max-w-[120px]" style={{ backgroundColor: "rgb(var(--accent))", color: "rgb(var(--primary))", borderColor: "rgb(var(--primary) / 0.2)", fontWeight: 600 }}>
                              <Building2 className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">{groupNameById(assignedTo)}</span>
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); unassign(p.id); }}
                              className="p-1 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                              title="Undo reassignment"
                            >
                              <X className="w-3 h-3 text-slate-400" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right pane — target group search + assign. Grey panel to
                  distinguish it from the white partners list. */}
              <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[#FAFBFC]">
                <div className="px-4 pt-3.5 pb-3 bg-white shrink-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Reassign to a New Primary Group</span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400" style={{ fontWeight: 500 }}>
                      <Users className="w-3 h-3" />{checkedIds.size} selected
                    </span>
                  </div>
                  <p className="text-[11.5px] text-slate-500 leading-snug">
                    Select partners on the left, then hover a group and click <span style={{ fontWeight: 600 }}>Assign</span> to make it their new primary group. You can assign different partners to different groups to split them across multiple primary groups.
                  </p>
                </div>
                <div className="px-4 pb-3 bg-white border-b border-muted shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      value={groupSearch}
                      onChange={(e) => setGroupSearch(e.target.value)}
                      placeholder="Search groups by name or description…"
                      className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-white text-[13px] text-foreground placeholder:text-slate-400 focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-2 grid grid-cols-1 lg:grid-cols-2 gap-1.5 content-start">
                  {targetGroups.slice(0, 120).map((g) => {
                    const tint = getAvatarTint(g.name);
                    const assignedHere = assignedCountByGroup[g.id] || 0;
                    const canAssign = checkedIds.size > 0;
                    return (
                      <div
                        key={g.id}
                        className={`group/grp relative text-left flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition-colors ${
                          assignedHere > 0
                            ? "border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50/70"
                            : "border-transparent hover:border-blue-200 hover:bg-blue-50/70"
                        }`}
                      >
                        <HoverCard>
                          <HoverCardTrigger asChild>
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[10px] border border-[#E8ECF1]"
                              style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 700 }}
                            >
                              {initialsFor(g.name)}
                            </div>
                          </HoverCardTrigger>
                          <HoverCardContent
                            side="top"
                            align="start"
                            className="z-[290] w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden"
                          >
                            <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
                              <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                              <div className="flex items-center gap-3 relative">
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[11px]" style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 700 }}>
                                  {initialsFor(g.name)}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{g.name}</p>
                                  <p className="text-[11px] text-slate-400 truncate">{g.id}</p>
                                </div>
                              </div>
                            </div>
                            <div className="bg-white px-3.5 py-3 space-y-2">
                              <div className="flex items-center gap-2 text-[12px] text-slate-700">
                                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="flex items-center gap-1">
                                  {groupScopes(g).map((t) => {
                                    const pal = GROUP_TYPE_PALETTE[t];
                                    return (
                                      <span key={t} className="inline-flex items-center px-1.5 py-px rounded-md text-[10px] border" style={{ backgroundColor: pal.bg, color: pal.fg, borderColor: pal.border, fontWeight: 600 }}>
                                        {pal.label}
                                      </span>
                                    );
                                  })}
                                </span>
                              </div>
                              <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                                <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{g.memberCount} members</span>
                              </div>
                              <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate"><span className="mr-1"><FlagImage code={flagEmojiCode(g.countryFlag)} className="text-[13px]" /></span>{g.country}</span>
                              </div>
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] text-foreground truncate leading-tight" style={{ fontWeight: 500 }}>{highlightMatch(g.name, groupSearch)}</p>
                          <div className="flex items-center gap-1 mt-0.5 min-w-0">
                            {groupScopes(g).map((t) => {
                              const pal = GROUP_TYPE_PALETTE[t];
                              return (
                                <span key={t} className="inline-flex items-center px-1.5 py-px rounded-md text-[9.5px] border shrink-0" style={{ backgroundColor: pal.bg, color: pal.fg, borderColor: pal.border, fontWeight: 600 }}>
                                  {pal.label}
                                </span>
                              );
                            })}
                            <span className="text-[10.5px] text-slate-400 truncate">· {g.memberCount} members · {g.country}</span>
                          </div>
                        </div>
                        {/* Right side: a persistent assigned-count chip that
                            swaps on hover to the contextual action — Assign the
                            selected partners, or Remove the ones already here. */}
                        <div className="ml-auto shrink-0 flex items-center min-h-[28px]">
                          {assignedHere > 0 && (
                            <span
                              className="group-hover/grp:hidden inline-flex items-center gap-1 px-2 h-6 rounded-full text-[11px] border"
                              style={{ backgroundColor: "#ECFDF5", color: "#15803D", borderColor: "#BBF7D0", fontWeight: 700 }}
                              title={`${assignedHere} ${assignedHere === 1 ? "partner" : "partners"} assigned to ${g.name}`}
                            >
                              <Check className="w-3 h-3" strokeWidth={3} /> {assignedHere}
                            </span>
                          )}
                          {canAssign ? (
                            <button
                              type="button"
                              onClick={() => assignToGroup(g.id)}
                              className="hidden group-hover/grp:inline-flex items-center gap-1 px-2.5 h-7 rounded-md text-[11.5px] text-white cursor-pointer hover:opacity-90 transition-opacity"
                              style={{ fontWeight: 600, backgroundColor: "rgb(var(--primary))" }}
                              title={`Assign ${checkedIds.size} selected ${checkedIds.size === 1 ? "partner" : "partners"} to ${g.name}`}
                            >
                              <Plus className="w-3.5 h-3.5" strokeWidth={2.5} /> Assign {checkedIds.size}
                            </button>
                          ) : assignedHere > 0 ? (
                            <button
                              type="button"
                              onClick={() => removeFromGroup(g.id)}
                              className="hidden group-hover/grp:inline-flex items-center gap-1 px-2.5 h-7 rounded-md text-[11.5px] cursor-pointer transition-colors border bg-white text-destructive border-red-200 hover:bg-red-50"
                              style={{ fontWeight: 600 }}
                              title={`Remove ${assignedHere} ${assignedHere === 1 ? "partner" : "partners"} from ${g.name}`}
                            >
                              <X className="w-3.5 h-3.5" /> Remove {assignedHere}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  {targetGroups.length === 0 && (
                    <div className="col-span-full flex items-center justify-center text-[12px] text-slate-400 text-center px-3 py-8">
                      No groups match "{groupSearch}".
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer — matches the creation modal: status on the left,
                Cancel + primary CTA on the right. */}
            <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 flex items-center justify-end gap-2 sm:gap-2.5 sm:rounded-b-2xl">
              <span className="mr-auto text-[12px]" style={{ fontWeight: 500, color: allAssigned ? "#16A34A" : "rgb(var(--muted-foreground))" }}>
                {assignedCount}/{total} partners assigned
              </span>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white text-xs sm:text-[13px] text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all shrink-0 cursor-pointer px-3 sm:px-4 h-8 sm:h-9"
                style={{ fontWeight: 500 }}
              >
                Cancel
              </button>
              <Button
                onClick={() => setStep("push")}
                disabled={!allAssigned}
                className="gap-1.5 rounded-lg text-xs sm:text-[13px] px-3 sm:px-4 h-8 sm:h-9 shadow-sm"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

        {/* Quick-view panel — opened from a partner avatar/name. Rendered
            with a zIndex above this modal (DialogContent is z-[230]). */}
        <QuickViewPanel data={quickView} onClose={() => setQuickView(null)} zIndex={300} />
      </DialogContent>
    </Dialog>

    {/* Configuration-push confirmation — a separate centered modal opened
        after reassignment, styled like the GroupBulkApplyModal "Save
        changes" dialog (glow header + two option cards). */}
    <Dialog open={open && step === "push"} onOpenChange={(o) => { if (!o) onOpenChange(false); }}>
      <DialogContent
        className="flex flex-col p-0 gap-0 border-0 sm:border z-[240] !max-w-[600px] !w-[600px] !rounded-2xl overflow-hidden"
        hideCloseButton
        overlayClassName="z-[235]"
      >
        <DialogTitle className="sr-only">Push configuration to reassigned partners</DialogTitle>
        <DialogDescription className="sr-only">
          Choose whether the reassigned partners adopt their new group's configuration.
        </DialogDescription>

        {/* Glow header */}
        <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #EBF3FF 0%, rgba(239,246,255,0.3) 70%, transparent 100%)" }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#0A77FF" }} />
          <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#CFE6FF" }}>
            <Zap className="w-8 h-8" style={{ color: "rgb(var(--primary))" }} />
          </div>
          <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#EBF3FF", color: "#0548A3", letterSpacing: "0.05em" }}>
            Configuration
          </span>
          <button onClick={() => onOpenChange(false)} className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-white/50 transition-colors cursor-pointer" aria-label="Close">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col items-center text-center px-7 pb-7">
          <h2 className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
            Push configuration to reassigned partners?
          </h2>
          <p className="text-[13px] mt-2 max-w-[420px] leading-[1.65]" style={{ color: "rgb(var(--muted-foreground))" }}>
            Choose what happens to the {total} {total === 1 ? "partner" : "partners"} reassigned out of {groupName} once it's archived.
          </p>

          <div className="w-full mt-6 flex flex-col gap-2.5 text-left">
            {/* No — partners unchanged */}
            <button
              type="button"
              onClick={() => finalize(false)}
              className="w-full text-left rounded-xl border border-border bg-white hover:border-slate-300 hover:shadow-[0_2px_8px_-4px_rgba(0,0,0,0.06)] transition-all cursor-pointer p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 bg-slate-100 text-slate-600">
                  <Check className="w-[18px] h-[18px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Keep Partner Configurations Unchanged</p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="text-[11px] text-slate-600">Partners move to their new group but keep current settings.</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="text-[11px] text-slate-600">Existing transactions and defaults are untouched.</span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-2" />
              </div>
            </button>

            {/* Yes — push new group's config */}
            <button
              type="button"
              onClick={() => finalize(true)}
              className="w-full text-left rounded-xl border border-blue-100 bg-accent hover:bg-blue-100 transition-colors cursor-pointer p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 bg-primary text-white shadow-[0_1px_4px_rgba(10,119,255,0.25)]">
                  <Zap className="w-[18px] h-[18px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] text-primary" style={{ fontWeight: 600 }}>Update Configurations from the New Group</p>
                    <span className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] border bg-white text-primary border-primary/20" style={{ fontWeight: 600 }}>
                      {total} {total === 1 ? "Partner" : "Partners"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="text-[11px] text-slate-700">Reassigned partners inherit their new group's defaults.</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="text-[11px] text-slate-700">Past transactions remain unchanged; future ones use the new config.</span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-primary shrink-0 mt-2" />
              </div>
            </button>

            {/* Back to reassignment */}
            <button
              onClick={() => setStep("reassign")}
              className="w-full h-10 text-[13px] rounded-xl border-0 cursor-pointer transition-colors mt-1 inline-flex items-center justify-center gap-1.5"
              style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
            >
              <ArrowLeft className="w-4 h-4" /> Back to Reassignment
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
   </>
  );
}
